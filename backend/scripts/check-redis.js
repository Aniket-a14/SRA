
import 'dotenv/config';
import { analysisQueue } from '../src/services/queueService.js';

async function check() {
    console.log("Checking Redis Connection...");
    try {
        const client = await analysisQueue.client;
        console.log("Client status:", client.status);
        console.log("Redis Info:", await client.info());
        console.log("Everything looks good!");
        process.exit(0);
    } catch (e) {
        console.error("Redis Check Failed:", e);
        process.exit(1);
    }
}

check();
