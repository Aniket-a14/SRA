import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockFindMany = jest.fn();
const mockCount = jest.fn();

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        auditLog: {
            findMany: mockFindMany,
            count: mockCount,
            create: jest.fn().mockResolvedValue({})
        }
    }
}));

const { getMyAuditLogs } = await import('../../src/controllers/authController.js');
const { generateAuditReport } = await import('../../src/middleware/auditLogger.js');

describe('Audit Log Controller & Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns paginated audit logs for the authenticated user', async () => {
        const mockLogs = [
            {
                id: 'log-1',
                action: 'LOGIN_SUCCESS',
                resource: '/auth/login',
                resourceId: null,
                ipAddress: '127.0.0.1',
                userAgent: 'Mozilla/5.0',
                status: 'success',
                metadata: { method: 'POST' },
                createdAt: new Date('2026-08-30T09:00:00Z')
            }
        ];

        mockFindMany.mockResolvedValue(mockLogs);
        mockCount.mockResolvedValue(1);

        const req = {
            user: { userId: 'user-123' },
            query: { page: '1', limit: '10' }
        };

        const res = {
            json: jest.fn()
        };
        const next = jest.fn();

        await getMyAuditLogs(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { userId: 'user-123' },
            skip: 0,
            take: 10
        }));
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: mockLogs,
            pagination: {
                page: 1,
                limit: 10,
                total: 1,
                totalPages: 1
            }
        });
    });

    it('generates an audit report aggregated by event type and security alerts', async () => {
        const mockEvents = [
            { id: '1', action: 'LOGIN_SUCCESS', status: 'success' },
            { id: '2', action: 'SUSPICIOUS_ACTIVITY', status: 'warning' },
            { id: '3', action: 'EXPORT_DATA', status: 'success' }
        ];

        mockFindMany.mockResolvedValue(mockEvents);
        mockCount.mockResolvedValue(3);

        const report = await generateAuditReport('2026-08-01', '2026-08-30', 'user-123');

        expect(report.totalEvents).toBe(3);
        expect(report.eventsByType.LOGIN_SUCCESS).toBe(1);
        expect(report.eventsByType.SUSPICIOUS_ACTIVITY).toBe(1);
        expect(report.eventsByType.EXPORT_DATA).toBe(1);
        expect(report.securityAlerts.length).toBe(1);
        expect(report.securityAlerts[0].action).toBe('SUSPICIOUS_ACTIVITY');
    });
});
