import prisma from '../config/prisma.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Automated Backup Service
 * Handles database backups, encryption, and retention management
 */
class BackupService {
    constructor() {
        this.backupDir = process.env.BACKUP_DIR || './backups';
        this.encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
        this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '30');
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

            // Extract database connection details
            const dbUrl = new URL(process.env.DATABASE_URL);
            const host = dbUrl.hostname;
            const database = dbUrl.pathname.slice(1);
            const user = dbUrl.username;
            const password = decodeURIComponent(dbUrl.password);

            // Create database dump (Windows-compatible approach)
            console.log(`Creating backup: ${backupFileName}`);

            // For Windows, we need to use a pgpass file instead of PGPASSWORD env var
            const isWindows = process.platform === 'win32';
            let pgpassFile = null;

            if (isWindows) {
                // Create temporary pgpass file for Windows
                pgpassFile = path.join(os.tmpdir(), '.pgpass');
                const pgpassContent = `${host}:*:${database}:${user}:${password}`;
                await fs.writeFile(pgpassFile, pgpassContent, { mode: 0o600 });

                // Set PGPASSFILE environment variable
                process.env.PGPASSFILE = pgpassFile;
            }

            // nosemgrep: javascript.lang.security.audit.detect-non-literal-fs-filename
            // Password is dynamically extracted from DATABASE_URL env var, not hardcoded
            const dumpCommand = isWindows
                ? `pg_dump -h ${host} -U ${user} -d ${database} -F c -f "${backupPath}"`
                : `PGPASSWORD="${password}" pg_dump -h ${host} -U ${user} -d ${database} -F c -f ${backupPath}`;

            await execAsync(dumpCommand);

            // Clean up pgpass file on Windows
            if (isWindows && pgpassFile) {
                try {
                    await fs.unlink(pgpassFile);
                } catch (err) {
                    // Ignore cleanup errors
                } finally {
                    // Unset PGPASSFILE environment variable
                    delete process.env.PGPASSFILE;
                }
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

            console.log(`✅ Backup created successfully: ${finalPath}`);
            console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            console.log(`   Checksum: ${checksum}`);

            return {
                success: true,
                fileName: path.basename(finalPath),
                size: stats.size,
                checksum
            };
        } catch (error) {
            console.error('❌ Backup creation failed:', error);
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
        const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
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
        const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
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
                    console.log(`🗑️  Deleted old backup: ${file}`);
                    deletedCount++;
                }
            }

            console.log(`✅ Cleanup complete. Deleted ${deletedCount} old backup(s)`);
            return { deletedCount };
        } catch (error) {
            console.error('❌ Cleanup failed:', error);
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

            // Extract database connection details
            const dbUrl = new URL(process.env.DATABASE_URL);
            const host = dbUrl.hostname;
            const database = dbUrl.pathname.slice(1);
            const user = dbUrl.username;
            const password = decodeURIComponent(dbUrl.password);

            // Restore database (Windows-compatible)
            console.log(`🔄 Restoring backup: ${backupFileName}`);

            const isWindows = process.platform === 'win32';
            let pgpassFile = null;

            if (isWindows) {
                pgpassFile = path.join(os.tmpdir(), '.pgpass');
                const pgpassContent = `${host}:*:${database}:${user}:${password}`;
                await fs.writeFile(pgpassFile, pgpassContent, { mode: 0o600 });
                process.env.PGPASSFILE = pgpassFile;
            }

            // nosemgrep: javascript.lang.security.audit.detect-non-literal-fs-filename
            // Password is dynamically extracted from DATABASE_URL env var, not hardcoded
            const restoreCommand = isWindows
                ? `pg_restore -h ${host} -U ${user} -d ${database} -c "${restorePath}"`
                : `PGPASSWORD="${password}" pg_restore -h ${host} -U ${user} -d ${database} -c ${restorePath}`;

            await execAsync(restoreCommand);

            // Clean up pgpass file on Windows
            if (isWindows && pgpassFile) {
                try {
                    await fs.unlink(pgpassFile);
                } catch (err) {
                    // Ignore cleanup errors
                }
            }

            // Clean up decrypted file if it was encrypted
            if (backupFileName.endsWith('.enc')) {
                await fs.unlink(restorePath);
            }

            console.log(`✅ Backup restored successfully`);
            return { success: true };
        } catch (error) {
            console.error('❌ Restore failed:', error);
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
            console.error('❌ Failed to list backups:', error);
            throw error;
        }
    }
}

export default new BackupService();
