
import Redis from 'ioredis';
import { log } from '../middleware/logger.js';

let redisClient;

const getRedisClient = () => {
    if (!redisClient) {
        if (!process.env.REDIS_URL) {
            log.warn('REDIS_URL not set, Redis features will be disabled.');
            return null;
        }

        redisClient = new Redis(process.env.REDIS_URL, {
            tls: {
                rejectUnauthorized: false // Required for some Upstash/cloud configurations if certs are self-signed or handled externally
            },
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3 // Fail fast if Redis is down
        });

        redisClient.on('connect', () => {
            log.info('Redis Connected Successfully');
        });

        redisClient.on('error', (err) => {
            log.error({ msg: 'Redis Connection Error', error: err.message });
        });
    }
    return redisClient;
};

export { getRedisClient };
