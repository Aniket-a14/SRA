import logger from '../config/logger.js';
import prisma from '../config/prisma.js';

/**
 * Audit Logger Middleware
 * Tracks all sensitive operations for compliance and security monitoring
 */

const SENSITIVE_OPERATIONS = [
    'CREATE_PROJECT',
    'DELETE_PROJECT',
    'CREATE_ANALYSIS',
    'DELETE_ANALYSIS',
    'FINALIZE_ANALYSIS',
    'UPDATE_USER',
    'DELETE_USER',
    'LOGIN_SUCCESS',
    'LOGIN_FAILURE',
    'LOGOUT',
    'PASSWORD_CHANGE',
    'EXPORT_DATA',
    'RESTORE_ACCOUNT',
    'SUSPICIOUS_ACTIVITY'
];

/**
 * Log audit event to database
 */
async function logAuditEvent(event) {
    try {
        // In production, you'd store this in a dedicated AuditLog table
        // For now, we'll use console and file logging
        const auditEntry = {
            timestamp: new Date().toISOString(),
            userId: event.userId || 'anonymous',
            action: event.action,
            resource: event.resource,
            resourceId: event.resourceId,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            status: event.status || 'success',
            metadata: event.metadata || {},
            changes: event.changes || null
        };

        // Two destinations, deliberately. The log stream is for alerting and for the case
        // where the database is the thing that is broken; the table is the queryable,
        // retention-bounded record that GDPR Art. 30 and SOC 2 actually ask for. Writing
        // only to the stream — which is what this did — gives you evidence you can grep but
        // cannot answer "what happened to this account?" from.
        //
        // `audit: true` is the marker to filter/alert on.
        logger.info({ audit: true, ...auditEntry }, `AUDIT ${auditEntry.action}`);

        // Fire-and-forget: an audit write must never add latency to, or fail, the operation
        // it describes. A failure here is logged loudly rather than swallowed, because an
        // audit trail with silent gaps is worse than none — it looks complete.
        //
        // `userId: undefined` for an anonymous action; the column is nullable and the FK is
        // ON DELETE SET NULL, so erasing an account detaches its history without destroying
        // the record that something happened.
        prisma.auditLog.create({
            data: {
                userId: event.userId || null,
                action: auditEntry.action,
                resource: auditEntry.resource,
                resourceId: auditEntry.resourceId ? String(auditEntry.resourceId) : null,
                ipAddress: auditEntry.ipAddress,
                userAgent: auditEntry.userAgent,
                status: auditEntry.status,
                metadata: auditEntry.metadata
            }
        }).catch((error) => {
            logger.error({ msg: 'Audit record could not be persisted', action: auditEntry.action, error: error.message });
        });

        return auditEntry;
    } catch (error) {
        logger.error({ msg: 'Failed to log audit event', error: error.message });
        // Don't throw - audit logging should never break the main operation
    }
}

/**
 * Middleware to automatically log API requests
 */
export const auditLogger = (req, res, next) => {
    // Capture original methods
    const originalJson = res.json;
    const originalSend = res.send;

    // Track request start time
    const startTime = Date.now();

    // Override response methods to capture status
    res.json = function (data) {
        logRequestAudit(req, res, startTime, data);
        return originalJson.call(this, data);
    };

    res.send = function (data) {
        logRequestAudit(req, res, startTime, data);
        return originalSend.call(this, data);
    };

    next();
};

/**
 * Log request audit trail
 */
function logRequestAudit(req, res, startTime, responseData) {
    const duration = Date.now() - startTime;
    const action = determineAction(req, res);

    // Only log sensitive operations
    if (!SENSITIVE_OPERATIONS.includes(action)) {
        return;
    }

    logAuditEvent({
        userId: req.user?.userId,
        action,
        resource: req.baseUrl + req.path,
        resourceId: req.params.id || req.body?.id,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        status: res.statusCode >= 400 ? 'failure' : 'success',
        metadata: {
            method: req.method,
            duration,
            statusCode: res.statusCode
        }
    });
}

/**
 * Determine action type from request
 */
function determineAction(req, res) {
    const { method, path } = req;

    // Project operations
    if (path.includes('/projects')) {
        if (method === 'POST') return 'CREATE_PROJECT';
        if (method === 'DELETE') return 'DELETE_PROJECT';
    }

    // Analysis operations
    if (path.includes('/analyze')) {
        if (method === 'POST') return 'CREATE_ANALYSIS';
        if (method === 'DELETE') return 'DELETE_ANALYSIS';
        if (path.includes('/finalize')) return 'FINALIZE_ANALYSIS';
    }

    // Auth operations
    if (path.includes('/auth/login')) {
        return res.statusCode === 200 ? 'LOGIN_SUCCESS' : 'LOGIN_FAILURE';
    }
    if (path.includes('/auth/logout')) return 'LOGOUT';

    // Subject-rights operations. These are the events a data-protection enquiry actually
    // asks about — "when did they ask, and did we do it?" — so they are recorded before
    // any other /user matching, which would otherwise never see them: the routes are
    // /auth/me, not /user.
    if (path.includes('/auth/me/export')) return 'EXPORT_DATA';
    if (path.includes('/auth/me/restore')) return 'RESTORE_ACCOUNT';
    if (path.endsWith('/auth/me') && method === 'DELETE') return 'DELETE_USER';

    // User operations
    if (path.includes('/user')) {
        if (method === 'PUT' || method === 'PATCH') return 'UPDATE_USER';
        if (method === 'DELETE') return 'DELETE_USER';
    }

    return 'UNKNOWN_OPERATION';
}

/**
 * Manual audit logging for specific events
 */
export async function auditDataExport(userId, exportType, recordCount) {
    return logAuditEvent({
        userId,
        action: 'EXPORT_DATA',
        resource: 'data_export',
        metadata: {
            exportType,
            recordCount,
            timestamp: new Date().toISOString()
        }
    });
}

export async function auditPasswordChange(userId, ipAddress) {
    return logAuditEvent({
        userId,
        action: 'PASSWORD_CHANGE',
        resource: 'user_credentials',
        ipAddress,
        metadata: {
            timestamp: new Date().toISOString()
        }
    });
}

export async function auditSuspiciousActivity(userId, activityType, details) {
    return logAuditEvent({
        userId,
        action: 'SUSPICIOUS_ACTIVITY',
        resource: 'security_alert',
        status: 'warning',
        metadata: {
            activityType,
            details,
            timestamp: new Date().toISOString()
        }
    });
}

/**
 * Generate audit report for a date range
 */
export async function generateAuditReport(startDate, endDate, userId = null) {
    // TODO: Query AuditLog table when implemented
    // For now, return placeholder
    return {
        startDate,
        endDate,
        userId,
        totalEvents: 0,
        eventsByType: {},
        securityAlerts: []
    };
}

export { logAuditEvent };
