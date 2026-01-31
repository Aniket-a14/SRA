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
    genReqId: (req) => req.id || req.headers['x-request-id'] || uuidv4(),
    customProps: (req, res) => ({
        method: req.method,
        url: req.url,
        userId: req.user?.userId,
        requestId: req.id
    })
});

export const log = pinoLogger;
