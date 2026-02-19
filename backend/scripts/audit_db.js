
import 'dotenv/config'; // Load env vars before imports run

// Mock environment
process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/sra_db?schema=public";

import prisma from '../src/config/prisma.js';
import AuditService from '../src/services/AuditService.js';

async function main() {
    console.log("🧪 Starting Audit DB Integration Test...");

    try {
        // 1. Find a user with projects
        const user = await prisma.user.findFirst({
            include: { projects: true }
        });

        if (!user) {
            console.log("⚠️ No users found. Skipping test.");
            return;
        }

        console.log(`👤 Testing with User: ${user.email} (${user.id})`);

        if (user.projects.length === 0) {
            console.log("⚠️ User has no projects. Skipping test.");
            return;
        }

        const projectId = user.projects[0].id;
        console.log(`📂 Using Project: ${user.projects[0].name} (${projectId})`);

        // 2. Test Get Pending Reviews
        console.log("🔍 Fetching Pending Reviews...");
        const pending = await AuditService.getPendingReviews(user.id);
        console.log(`✅ Found ${pending.length} pending reviews.`);

        if (pending.length > 0) {
            const target = pending[0];
            console.log(`🎯 Target Requirement: ${target.id}`);

            // 3. Test Verification
            console.log(`🔄 Verifying ${target.id} as APPROVED_HUMAN...`);
            await AuditService.verifyRequirement(target.analysisId, target.id, user.id, 'APPROVED_HUMAN');
            console.log("✅ Verification API call succeeded.");

            // 4. Verify Persistence
            const updatedAnalysis = await prisma.analysis.findUnique({
                where: { id: target.analysisId }
            });

            // Deep check json
            let verified = false;
            const features = updatedAnalysis.resultJson.systemFeatures || [];
            for (const f of features) {
                const reqs = f.functionalRequirements || [];
                for (const r of reqs) {
                    const rid = r.id || (typeof r === 'string' ? r.match(/^([A-Z]+-[A-Z]+-\d+)/)[1] : null);
                    if (rid === target.id) {
                        if (r.metadata?.verification_status === 'APPROVED_HUMAN') {
                            verified = true;
                        }
                    }
                }
            }

            if (verified) {
                console.log("🎉 SUCCESS: Requirement is stamped APPROVED_HUMAN in DB.");
            } else {
                console.error("❌ FAILURE: Requirement update not found in DB.");
                process.exit(1);
            }

        } else {
            console.log("ℹ️ No pending reviews found to verify. Ensure the project has AI drafts.");
        }

    } catch (e) {
        console.error("❌ Test Failed:", e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
