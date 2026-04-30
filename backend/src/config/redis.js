
import Redis from 'ioredis';
import { log } from '../middleware/logger.js';

let redisClient;

const getRedisClient = () => {
    if (!redisClient) {
        if (!process.env.REDIS_URL) {
            log.warn('REDIS_URL not set, Redis features will be disabled.');
            return null;
        }

        const redisUrl = process.env.REDIS_URL;
        const shouldUseTls = redisUrl.startsWith('rediss://') || process.env.REDIS_TLS === 'true';
        const redisOptions = {
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3 // Don't crash the process if Redis is down, keep trying in background
        };

        if (shouldUseTls) {
            redisOptions.tls = {
                rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false'
            };
        }

        redisClient = new Redis(redisUrl, redisOptions);

        let hasLoggedSuccess = false;
        redisClient.on('ready', () => {
            if (!hasLoggedSuccess) {
                log.info('Redis Connected Successfully and Ready');
                hasLoggedSuccess = true;
            }
        });

        redisClient.on('error', (err) => {
            // Only log errors that aren't simple connection resets to avoid noise
            if (err.message !== 'read ECONNRESET') {
                log.error({ msg: 'Redis Connection Error', error: err.message });
            }
        });
    }
    return redisClient;
};

export { getRedisClient };
