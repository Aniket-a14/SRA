
import Redis from 'ioredis';
import { log } from '../middleware/logger.js';

let redisClient;

const getRedisClient = () => {
    if (!redisClient) {
        if (!process.env.REDIS_URL) {
            log.warn('REDIS_URL not set, Redis features will be disabled.');
            return null;
        }

        const isRediss = process.env.REDIS_URL.startsWith('rediss://');
        const redisOptions = {
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3, // Fail fast if Redis is down
            // ioredis 6 defaults to RESP3. Pinned to RESP2, the protocol every caller here
            // (rate-limit-redis Lua replies, cache GET/SET, pub/sub progress) was written and
            // tested against, so the upgrade changes no reply shapes against Upstash.
            protocol: 2
        };

        if (isRediss) {
            redisOptions.tls = {
                rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED === 'false' ? false : (process.env.NODE_ENV === 'production')
            };
        }

        redisClient = new Redis(process.env.REDIS_URL, redisOptions);

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
