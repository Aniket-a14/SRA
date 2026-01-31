import pino from 'pino';

/**
 * Centralized logger for backend observability.
 * Uses 'pino' for structured JSON logging in production and 'pino-pretty' in development.
 */
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    base: {
        env: process.env.NODE_ENV,
        service: 'sra-backend'
    },
    transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname'
        }
    } : undefined
});

export default logger;
