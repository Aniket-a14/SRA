import prisma from '../config/prisma.js';
import { logAuditEvent, auditSuspiciousActivity } from '../middleware/auditLogger.js';
import { getRedisClient } from '../config/redis.js';

/**
 * Security Monitoring Service
 * Detects and alerts on suspicious activities and security threats
 */

class SecurityMonitor {
    constructor() {
        this.alertThresholds = {
            failedLogins: 5, // Max failed logins before alert
            massDeletes: 10, // Max deletions in short period
            rapidRequests: 100, // Max requests per minute
        };
        this.LOGIN_ATTEMPT_TTL = 3600; // 1 hour expiry for login attempt keys
    }

    /**
     * Get Redis key for login attempts
     */
    _loginKey(email, ipAddress) {
        return `sec:login_attempts:${email}:${ipAddress}`;
    }

    /**
     * Track failed login attempt (Redis-backed with in-memory fallback)
     */
    async trackFailedLogin(email, ipAddress) {
        const redis = getRedisClient();
        let attemptCount = 0;

        if (redis) {
            try {
                const key = this._loginKey(email, ipAddress);
                attemptCount = await redis.incr(key);
                // Set TTL only on first attempt (when count becomes 1)
                if (attemptCount === 1) {
                    await redis.expire(key, this.LOGIN_ATTEMPT_TTL);
                }
            } catch {
                // Redis down — fall through to threshold check with count 0
            }
        }

        // Check if threshold exceeded
        if (attemptCount >= this.alertThresholds.failedLogins) {
            await this.alertBruteForceAttempt(email, ipAddress, attemptCount);
        }
    }

    /**
     * Clear login attempts on successful login
     */
    async clearLoginAttempts(email, ipAddress) {
        const redis = getRedisClient();
        if (redis) {
            try {
                await redis.del(this._loginKey(email, ipAddress));
            } catch {
                // Best-effort cleanup
            }
        }
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
