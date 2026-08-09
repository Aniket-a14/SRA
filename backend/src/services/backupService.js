import prisma from '../config/prisma.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import logger from '../config/logger.js';

const execFileAsync = promisify(execFile);

// Supabase's transaction pooler. PgBouncer in transaction mode cannot serve pg_dump.
const TRANSACTION_POOLER_PORT = 6543;

/**
 * Automated Backup Service
 * Handles database backups, encryption, and retention management
 */
class BackupService {
    constructor() {
        this.backupDir = process.env.BACKUP_DIR || './backups';
        this.encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
        this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '30');
        this.salt = process.env.BACKUP_ENCRYPTION_SALT; // Used for key derivation

        // scryptSync throws on an undefined salt — better to fail at startup than mid-backup.
        if (this.encryptionKey && !this.salt) {
            throw new Error('BACKUP_ENCRYPTION_SALT is required when BACKUP_ENCRYPTION_KEY is set');
        }
    }

    /**
     * Connection strings worth handing to pg_dump, best first.
     *
     * DIRECT_URL leads because pg_dump needs a session-mode connection. Supabase's
     * transaction pooler (port 6543) is PgBouncer in transaction mode, which cannot serve a
     * dump at all — it rejects the attempt at authentication with a "tenant/user not found"
     * that looks like a credentials problem and is not. Including it as a fallback did
     * nothing but overwrite the real error from the previous target.
     *
     * @returns {string[]}
     * @throws {Error} when nothing usable is configured
     */
    resolveDumpTargets() {
        const candidates = [process.env.DIRECT_URL, process.env.DATABASE_URL].filter(Boolean);
        if (candidates.length === 0) {
            throw new Error('Neither DIRECT_URL nor DATABASE_URL is configured');
        }

        const targets = [...new Set(candidates)].filter((connectionString) => {
            try {
                return new URL(connectionString).port !== String(TRANSACTION_POOLER_PORT);
            } catch {
                return false;
            }
        });

        if (targets.length === 0) {
            throw new Error(
                `Every configured connection string points at the transaction pooler (port ${TRANSACTION_POOLER_PORT}), ` +
                'which cannot serve pg_dump. Set DIRECT_URL to the session-mode connection (port 5432).'
            );
        }

        return targets;
    }

    /**
     * Refuse to start a dump that pg_dump will abort anyway.
     *
     * pg_dump will not dump a server newer than itself. This is exactly how the scheduled
     * backup broke: the runner installed client 16 against a server that had moved to 17,
     * so every run failed — and because the error was then masked by a pooler fallback, the
     * logs blamed credentials for five weeks.
     *
     * Non-fatal if the versions can't be read; a real incompatibility still surfaces from
     * pg_dump itself, just less clearly.
     */
    async assertDumpClientIsCompatible(connectionString) {
        let clientMajor;
        try {
            const { stdout } = await execFileAsync('pg_dump', ['--version']);
            clientMajor = parseInt(stdout.match(/(\d+)/)?.[1], 10);
        } catch {
            throw new Error('pg_dump is not installed or not on PATH.');
        }

        let serverMajor;
        try {
            const { stdout } = await execFileAsync('psql', [connectionString, '-tAc', 'show server_version']);
            serverMajor = parseInt(stdout.trim().match(/(\d+)/)?.[1], 10);
        } catch {
            logger.warn('Could not read the server version; proceeding without a compatibility check.');
            return;
        }

        if (Number.isFinite(clientMajor) && Number.isFinite(serverMajor) && clientMajor < serverMajor) {
            throw new Error(
                `pg_dump ${clientMajor} cannot dump a PostgreSQL ${serverMajor} server — pg_dump refuses any server ` +
                `newer than itself. Install postgresql-client-${serverMajor} (or newer) and retry.`
            );
        }
    }

    /**
     * Create encrypted database backup
     */
    async createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `sra_backup_${timestamp}.sql`;
            const backupPath = path.join(this.backupDir, backupFileName);

            // Ensure backup directory exists
            await fs.mkdir(this.backupDir, { recursive: true });

            // Create database dump (Windows-compatible approach)
            logger.info({ backupFileName }, 'Creating backup');

            const connectionStrings = this.resolveDumpTargets();

            // Fail before spending a connection attempt on a client that cannot possibly
            // work: pg_dump refuses any server newer than itself. This check is what turns
            // "tenant/user not found" (the misleading error from a doomed pooler fallback)
            // into a message naming the actual problem.
            await this.assertDumpClientIsCompatible(connectionStrings[0]);

            let dumpSuccessful = false;
            const failures = [];

            for (const connectionString of connectionStrings) {
                const dbUrl = new URL(connectionString);
                const host = dbUrl.hostname;
                const port = dbUrl.port || '5432';
                const database = dbUrl.pathname.slice(1);
                const user = dbUrl.username;
                const password = decodeURIComponent(dbUrl.password);
                const isWindows = process.platform === 'win32';
                let pgpassFile = null;

                try {
                    if (isWindows) {
                        // Create temporary pgpass file for Windows
                        pgpassFile = path.join(os.tmpdir(), '.pgpass');
                        const pgpassContent = `${host}:${port}:${database}:${user}:${password}`;
                        await fs.writeFile(pgpassFile, pgpassContent, { mode: 0o600 });

                        // Set PGPASSFILE environment variable
                        process.env.PGPASSFILE = pgpassFile;
                    }

                    const execOptions = isWindows ? undefined : { env: { ...process.env, PGPASSWORD: password } };
                    await execFileAsync(
                        'pg_dump',
                        ['-h', host, '-p', port, '-U', user, '-d', database, '-F', 'c', '-f', backupPath],
                        execOptions
                    );
                    dumpSuccessful = true;
                    break;
                } catch (error) {
                    // Collect every attempt. Keeping only the last one meant a real failure
                    // on the first target was overwritten by the second target's error, and
                    // the log named a cause that was not the cause.
                    failures.push(`${host}:${port} — ${(error.stderr || error.message || '').toString().trim().split('\n')[0]}`);
                } finally {
                    // Clean up pgpass file on Windows
                    if (isWindows && pgpassFile) {
                        try {
                            await fs.unlink(pgpassFile);
                        } catch {
                            // Ignore cleanup errors
                        } finally {
                            // Unset PGPASSFILE environment variable
                            delete process.env.PGPASSFILE;
                        }
                    }
                }
            }

            if (!dumpSuccessful) {
                throw new Error(`pg_dump failed against every candidate:\n  ${failures.join('\n  ')}`);
            }

            // Encrypt backup if encryption key is provided
            let finalPath = backupPath;
            if (this.encryptionKey) {
                finalPath = await this.encryptBackup(backupPath);
                // Remove unencrypted backup
                await fs.unlink(backupPath);
            }

            // Verify backup integrity
            const stats = await fs.stat(finalPath);
            const checksum = await this.calculateChecksum(finalPath);

            // Log backup metadata
            await this.logBackupMetadata({
                fileName: path.basename(finalPath),
                size: stats.size,
                checksum,
                timestamp: new Date(),
                encrypted: !!this.encryptionKey
            });

            logger.info({ finalPath, sizeMB: (stats.size / 1024 / 1024).toFixed(2), checksum }, 'Backup created successfully');

            return {
                success: true,
                fileName: path.basename(finalPath),
                size: stats.size,
                checksum
            };
        } catch (error) {
            logger.error({ err: error }, 'Backup creation failed');
            throw error;
        }
    }

    /**
     * Encrypt backup file using AES-256-GCM
     */
    async encryptBackup(filePath) {
        const encryptedPath = `${filePath}.enc`;
        const fileData = await fs.readFile(filePath);

        // Generate random IV
        const iv = crypto.randomBytes(16);

        // Create cipher
        const key = crypto.scryptSync(this.encryptionKey, this.salt, 32);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        // Encrypt data
        const encrypted = Buffer.concat([
            cipher.update(fileData),
            cipher.final()
        ]);

        // Get auth tag
        const authTag = cipher.getAuthTag();

        // Write encrypted file with IV and auth tag prepended
        const finalData = Buffer.concat([iv, authTag, encrypted]);
        await fs.writeFile(encryptedPath, finalData);

        return encryptedPath;
    }

    /**
     * Decrypt backup file
     */
    async decryptBackup(encryptedPath, outputPath) {
        const encryptedData = await fs.readFile(encryptedPath);

        // Extract IV, auth tag, and encrypted data
        const iv = encryptedData.slice(0, 16);
        const authTag = encryptedData.slice(16, 32);
        const encrypted = encryptedData.slice(32);

        // Create decipher
        const key = crypto.scryptSync(this.encryptionKey, this.salt, 32);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        // Decrypt data
        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);

        await fs.writeFile(outputPath, decrypted);
        return outputPath;
    }

    /**
     * Calculate SHA-256 checksum for backup verification
     */
    async calculateChecksum(filePath) {
        const fileData = await fs.readFile(filePath);
        return crypto.createHash('sha256').update(fileData).digest('hex');
    }

    /**
     * Log backup metadata to database
     */
    async logBackupMetadata(metadata) {
        // Store in a dedicated BackupLog table (you'd need to add this to schema.prisma)
        // For now, we'll just log to console and file
        const logEntry = {
            ...metadata,
            timestamp: metadata.timestamp.toISOString()
        };

        const logPath = path.join(this.backupDir, 'backup_log.json');
        let logs = [];

        try {
            const existingLogs = await fs.readFile(logPath, 'utf-8');
            logs = JSON.parse(existingLogs);
        } catch {
            // File doesn't exist yet
        }

        logs.push(logEntry);
        await fs.writeFile(logPath, JSON.stringify(logs, null, 2));
    }

    /**
     * Clean up old backups based on retention policy
     */
    async cleanupOldBackups() {
        try {
            const files = await fs.readdir(this.backupDir);
            const now = Date.now();
            const retentionMs = this.retentionDays * 24 * 60 * 60 * 1000;

            let deletedCount = 0;

            for (const file of files) {
                if (!file.startsWith('sra_backup_')) continue;

                const filePath = path.join(this.backupDir, file);
                const stats = await fs.stat(filePath);
                const age = now - stats.mtimeMs;

                if (age > retentionMs) {
                    await fs.unlink(filePath);
                    logger.info({ file }, 'Deleted old backup');
                    deletedCount++;
                }
            }

            logger.info({ deletedCount }, 'Cleanup complete');
            return { deletedCount };
        } catch (error) {
            logger.error({ err: error }, 'Cleanup failed');
            throw error;
        }
    }

    /**
     * Restore database from backup
     */
    async restoreBackup(backupFileName) {
        try {
            const backupPath = path.join(this.backupDir, backupFileName);

            // Check if backup exists
            await fs.access(backupPath);

            // Decrypt if needed
            let restorePath = backupPath;
            if (backupFileName.endsWith('.enc')) {
                const decryptedPath = backupPath.replace('.enc', '');
                await this.decryptBackup(backupPath, decryptedPath);
                restorePath = decryptedPath;
            }

            // Restore database (Windows-compatible)
            logger.info({ backupFileName }, 'Restoring backup');
            const connectionStrings = [...new Set([process.env.DIRECT_URL, process.env.DATABASE_URL].filter(Boolean))];
            if (connectionStrings.length === 0) {
                throw new Error('Neither DIRECT_URL nor DATABASE_URL is configured');
            }

            let restoreSuccessful = false;
            let lastError = null;

            for (const connectionString of connectionStrings) {
                const dbUrl = new URL(connectionString);
                const host = dbUrl.hostname;
                const port = dbUrl.port || '5432';
                const database = dbUrl.pathname.slice(1);
                const user = dbUrl.username;
                const password = decodeURIComponent(dbUrl.password);
                const isWindows = process.platform === 'win32';
                let pgpassFile = null;

                try {
                    if (isWindows) {
                        pgpassFile = path.join(os.tmpdir(), '.pgpass');
                        const pgpassContent = `${host}:${port}:${database}:${user}:${password}`;
                        await fs.writeFile(pgpassFile, pgpassContent, { mode: 0o600 });
                        process.env.PGPASSFILE = pgpassFile;
                    }

                    const execOptions = isWindows ? undefined : { env: { ...process.env, PGPASSWORD: password } };
                    await execFileAsync(
                        'pg_restore',
                        ['-h', host, '-p', port, '-U', user, '-d', database, '-c', restorePath],
                        execOptions
                    );
                    restoreSuccessful = true;
                    break;
                } catch (error) {
                    lastError = error;
                } finally {
                    if (isWindows && pgpassFile) {
                        try {
                            await fs.unlink(pgpassFile);
                        } catch {
                            // Ignore cleanup errors
                        } finally {
                            delete process.env.PGPASSFILE;
                        }
                    }
                }
            }

            if (!restoreSuccessful) throw lastError;

            // Clean up decrypted file if it was encrypted
            if (backupFileName.endsWith('.enc')) {
                await fs.unlink(restorePath);
            }

            logger.info('Backup restored successfully');
            return { success: true };
        } catch (error) {
            logger.error({ err: error }, 'Restore failed');
            throw error;
        }
    }

    /**
     * List all available backups
     */
    async listBackups() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backups = [];

            for (const file of files) {
                if (!file.startsWith('sra_backup_')) continue;

                const filePath = path.join(this.backupDir, file);
                const stats = await fs.stat(filePath);

                backups.push({
                    fileName: file,
                    size: stats.size,
                    created: stats.mtime,
                    encrypted: file.endsWith('.enc')
                });
            }

            return backups.sort((a, b) => b.created - a.created);
        } catch (error) {
            logger.error({ err: error }, 'Failed to list backups');
            throw error;
        }
    }
}

export default new BackupService();
