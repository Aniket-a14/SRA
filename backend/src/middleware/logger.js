import pinoHttp from 'pino-http';
import pino from 'pino';

import { v4 as uuidv4 } from 'uuid';

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
    autoLogging: true,
    // Streamline: Don't log the full req/res objects which clutter the terminal
    serializers: {
        req: () => undefined,
        res: () => undefined,
    },
    genReqId: (req) => req.id || req.headers['x-request-id'] || uuidv4(),
    customSuccessMessage: (req, res, responseTime) => {
        return `${req.method} ${req.url} ${res.statusCode} - ${responseTime}ms`;
    },
    customErrorMessage: (req, res, err) => {
        return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
    },
    customProps: (req, res) => ({
        userId: req.user?.userId,
        requestId: req.id
    })
});

export const log = pinoLogger;
