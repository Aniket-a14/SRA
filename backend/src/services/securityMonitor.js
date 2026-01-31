import prisma from '../config/prisma.js';
import { logAuditEvent, auditSuspiciousActivity } from '../middleware/auditLogger.js';

/**
 * Security Monitoring Service
 * Detects and alerts on suspicious activities and security threats
 */

class SecurityMonitor {
    constructor() {
        this.loginAttempts = new Map(); // Track failed login attempts
        this.suspiciousPatterns = new Map(); // Track unusual patterns
        this.alertThresholds = {
            failedLogins: 5, // Max failed logins before alert
            massDeletes: 10, // Max deletions in short period
            rapidRequests: 100, // Max requests per minute
        };
    }

    /**
     * Track failed login attempt
     */
    async trackFailedLogin(email, ipAddress) {
        const key = `${email}:${ipAddress}`;
        const attempts = this.loginAttempts.get(key) || { count: 0, firstAttempt: Date.now() };

        attempts.count++;
        attempts.lastAttempt = Date.now();

        this.loginAttempts.set(key, attempts);

        // Check if threshold exceeded
        if (attempts.count >= this.alertThresholds.failedLogins) {
            await this.alertBruteForceAttempt(email, ipAddress, attempts.count);
        }

        // Clean up old entries (older than 1 hour)
        this.cleanupOldAttempts();
    }

    /**
     * Clear login attempts on successful login
     */
    clearLoginAttempts(email, ipAddress) {
        const key = `${email}:${ipAddress}`;
        this.loginAttempts.delete(key);
    }

    /**
     * Detect mass deletion attempts
     */
    async detectMassDeletion(userId, deletionCount, resourceType) {
        if (deletionCount >= this.alertThresholds.massDeletes) {
            await auditSuspiciousActivity(userId, 'MASS_DELETION', {
                resourceType,
                count: deletionCount,
                timestamp: new Date().toISOString()
            });

            console.warn(`⚠️  SECURITY ALERT: User ${userId} deleted ${deletionCount} ${resourceType} records`);

            // TODO: Send email/Slack notification
            return true;
        }
        return false;
    }

    /**
     * Detect unusual access patterns
     */
    async detectUnusualAccess(userId, ipAddress, userAgent) {
        // Check if user is accessing from a new location/device
        const recentSessions = await prisma.session.findMany({
            where: {
                userId,
                createdAt: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                }
            },
            select: {
                ipAddress: true,
                userAgent: true,
                location: true
            }
        });

        const knownIPs = new Set(recentSessions.map(s => s.ipAddress));
        const knownAgents = new Set(recentSessions.map(s => s.userAgent));

        const isNewIP = !knownIPs.has(ipAddress);
        const isNewDevice = !knownAgents.has(userAgent);

        if (isNewIP && isNewDevice) {
            await auditSuspiciousActivity(userId, 'NEW_DEVICE_LOGIN', {
                ipAddress,
                userAgent,
                timestamp: new Date().toISOString()
            });

            console.warn(`⚠️  SECURITY ALERT: User ${userId} logged in from new device/location`);

            // TODO: Send email notification to user
            return true;
        }

        return false;
    }

    /**
     * Detect data exfiltration attempts
     */
    async detectDataExfiltration(userId, exportSize, exportType) {
        const LARGE_EXPORT_THRESHOLD = 1000; // records

        if (exportSize > LARGE_EXPORT_THRESHOLD) {
            await auditSuspiciousActivity(userId, 'LARGE_DATA_EXPORT', {
                exportType,
                recordCount: exportSize,
                timestamp: new Date().toISOString()
            });

            console.warn(`⚠️  SECURITY ALERT: User ${userId} exported ${exportSize} ${exportType} records`);

            return true;
        }

        return false;
    }

    /**
     * Alert on brute force login attempts
     */
    async alertBruteForceAttempt(email, ipAddress, attemptCount) {
        await auditSuspiciousActivity(null, 'BRUTE_FORCE_ATTEMPT', {
            email,
            ipAddress,
            attemptCount,
            timestamp: new Date().toISOString()
        });

        console.error(`🚨 SECURITY ALERT: Brute force attack detected!`);
        console.error(`   Email: ${email}`);
        console.error(`   IP: ${ipAddress}`);
        console.error(`   Attempts: ${attemptCount}`);

        // TODO: Implement IP blocking or rate limiting
        // TODO: Send alert to security team
    }

    /**
     * Clean up old login attempt records
     */
    cleanupOldAttempts() {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;

        for (const [key, attempts] of this.loginAttempts.entries()) {
            if (attempts.firstAttempt < oneHourAgo) {
                this.loginAttempts.delete(key);
            }
        }
    }

    /**
     * Generate security report
     */
    async generateSecurityReport(startDate, endDate) {
        // TODO: Query audit logs for security events
        const report = {
            period: {
                start: startDate,
                end: endDate
            },
            summary: {
                totalSecurityEvents: 0,
                bruteForceAttempts: 0,
                massDeletions: 0,
                unusualAccess: 0,
                largeExports: 0
            },
            topThreats: [],
            recommendations: []
        };

        return report;
    }

    /**
     * Check for compromised credentials
     */
    async checkCompromisedCredentials(email, password) {
        // In production, integrate with HaveIBeenPwned API
        // For now, just a placeholder
        return {
            isCompromised: false,
            breachCount: 0
        };
    }

    /**
     * Validate session security
     */
    async validateSession(sessionToken) {
        const session = await prisma.session.findUnique({
            where: { token: sessionToken },
            include: { user: true }
        });

        if (!session) {
            return { valid: false, reason: 'Session not found' };
        }

        if (session.revoked) {
            return { valid: false, reason: 'Session revoked' };
        }

        if (new Date() > session.expiresAt) {
            return { valid: false, reason: 'Session expired' };
        }

        // Check if session is too old (force re-auth after 30 days)
        const sessionAge = Date.now() - new Date(session.createdAt).getTime();
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

        if (sessionAge > maxAge) {
            return { valid: false, reason: 'Session too old, re-authentication required' };
        }

        return { valid: true, session };
    }
}

export default new SecurityMonitor();
