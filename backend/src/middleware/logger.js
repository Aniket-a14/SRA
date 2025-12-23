import pinoHttp from 'pino-http';
import pino from 'pino';

const pinoLogger = pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
        },
    } : undefined,
});

export const logger = pinoHttp({
    logger: pinoLogger,
    autoLogging: true, // Enable logging for debugging
    customProps: (req, res) => ({
        method: req.method,
        url: req.url,
        userId: req.user?.userId
    })
});

export const log = pinoLogger;
