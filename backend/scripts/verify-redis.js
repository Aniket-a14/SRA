import { getRedisClient } from '../src/config/redis.js';
import dotenv from 'dotenv';

dotenv.config();

async function verifyRedis() {
    console.log(`\n🔍 Verifying Redis Connection and Cache Operations...\n`);

    const redis = getRedisClient();
    
    if (!redis) {
        console.error("❌ Redis client not initialized. Check your REDIS_URL in .env");
        process.exit(1);
    }

    try {
        // 1. Check Ping
        const pong = await redis.ping();
        console.log(`   Ping Result: ✅ ${pong}`);

        // 2. Test Set/Get
        const testKey = 'verify:test:key';
        const testValue = JSON.stringify({ status: 'success', timestamp: Date.now() });
        
        await redis.set(testKey, testValue, 'EX', 10);
        const retrieved = await redis.get(testKey);

        if (retrieved === testValue) {
            console.log(`   Cache Set/Get: ✅ Success`);
            console.log(`   Retrieved Data: ${retrieved}`);
        } else {
            console.error(`   Cache Set/Get: ❌ Failure (Mismatched data)`);
        }

        // 3. Cleanup
        await redis.del(testKey);
        
        console.log("\n✅ Redis Infrastructure Verified Successfully.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Redis verification failed:", error.message);
        process.exit(1);
    }
}

verifyRedis();
