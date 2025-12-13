
import 'dotenv/config';
import prisma from '../src/config/prisma.js';

async function checkVersions() {
    try {
        console.log("🔍 Checking Analysis Version History...\n");

        // 1. Find all analyses that are "roots" (version 1 or no rootId)
        // Actually, better to just group by rootId.
        // If rootId is null, it might be an old record or the root itself (depending on implementation).
        // implementation: root has rootId = its own ID (or null? let's check).
        // implementation said: "rootId: id" for the first version? or "rootId: null"?
        // Let's just fetch ALL and group in JS to be safe and see what's really there.

        const allAnalyses = await prisma.analysis.findMany({
            select: {
                id: true,
                title: true,
                version: true,
                rootId: true,
                parentId: true,
                createdAt: true
            },
            orderBy: { createdAt: 'asc' }
        });

        if (allAnalyses.length === 0) {
            console.log("No analyses found.");
            return;
        }

        const groups = {};

        allAnalyses.forEach(a => {
            // If it has a rootId, group by that. If not, it's a standalone or a root itself.
            // In our logic, rootId should be present on V1 too? Or maybe V1 is the root.
            const groupKey = a.rootId || a.id;
            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(a);
        });

        Object.keys(groups).forEach((key, index) => {
            const chain = groups[key];
            console.log(`📂 Chain #${index + 1} (Root ID: ${key})`);

            chain.forEach(item => {
                const date = new Date(item.createdAt).toLocaleString();
                const symbol = item.version === 1 ? "ROOT" : " └─>";
                console.log(`   ${symbol} [v${item.version}] ${item.title || 'Untitled'} (ID: ${item.id.substring(0, 8)}...) Created: ${date}`);
                if (item.parentId) console.log(`         ↳ Parent: ${item.parentId.substring(0, 8)}...`);
            });
            console.log("");
        });

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

checkVersions();
