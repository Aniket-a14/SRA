
// Simple script to verify Rate Limiting headers
const BASE_URL = 'http://localhost:3000';

async function verifyRateLimit() {
    console.log(`\n🔍 Verifying Rate Limiting (Redis) at ${BASE_URL}/api/health\n`);

    try {
        const initialRes = await fetch(`${BASE_URL}/api/health`);
        if (!initialRes.ok) {
            console.error("❌ Stats Check Failed: Service might be down.");
            return;
        }

        console.log("Checking headers...");

        // Loop a few times to see decrement
        for (let i = 1; i <= 5; i++) {
            const res = await fetch(`${BASE_URL}/api/health`);
            const limit = res.headers.get('ratelimit-limit');
            const remaining = res.headers.get('ratelimit-remaining');
            const reset = res.headers.get('ratelimit-reset');

            if (limit && remaining) {
                console.log(`   Request ${i}: ✅ Success | Limit: ${limit} | Remaining: ${remaining}`);
            } else {
                console.log(`   Request ${i}: ⚠️ Missing Headers (Is Redis connected?)`);
            }
        }

        console.log("\n✅ Verification Complete: If 'Remaining' count decreased, Redis Rate Limiting is working.");
    } catch (error) {
        console.error("❌ Error running verification:", error.message);
    }
}

verifyRateLimit();
