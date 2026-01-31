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
    'EXPORT_DATA'
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

        console.log('📋 AUDIT LOG:', JSON.stringify(auditEntry));

        // TODO: Store in database when AuditLog model is added to schema
        // await prisma.auditLog.create({ data: auditEntry });

        return auditEntry;
    } catch (error) {
        console.error('Failed to log audit event:', error);
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
    const action = determineAction(req);

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
function determineAction(req) {
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
        return req.statusCode === 200 ? 'LOGIN_SUCCESS' : 'LOGIN_FAILURE';
    }
    if (path.includes('/auth/logout')) return 'LOGOUT';

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
