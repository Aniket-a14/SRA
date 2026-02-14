import { createRequire } from 'module';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../generated/prisma/index.js');

// Setup Client
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
    console.error("FATAL: No DATABASE_URL or DIRECT_URL found.");
    process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Dynamic import of service
const { extractGraph, traverseGraph } = await import("../services/graphService.js");

const SAMPLE_TEXT = `
The Admin User logs into the System Portal.
The System Portal uses the Authentication Service to verify credentials.
If successful, the Admin User can access the User Management Dashboard.
The User Management Dashboard reads from the User Database.
`;

async function verify() {
    console.log("Starting GraphRAG Verification (Real API)...");

    try {
        // 1. Setup
        const user = await prisma.user.create({
            data: {
                email: "graphrag-test+" + Date.now() + "@example.com",
                name: "GraphRAG Tester"
            }
        });

        const project = await prisma.project.create({
            data: {
                name: "GraphRAG Test Project",
                userId: user.id
            }
        });
        console.log("Created Project:", project.id);

        // 2. Extract & Store
        console.log("Extracting Graph from text...");
        // Pass our custom client instance
        await extractGraph(SAMPLE_TEXT, project.id, prisma);

        // 3. Verify
        const nodeCount = await prisma.graphNode.count({ where: { projectId: project.id } });
        const edgeCount = await prisma.graphEdge.count({ where: { source: { projectId: project.id } } });
        console.log(`Extracted: ${nodeCount} nodes, ${edgeCount} edges.`);

        // 4. Traverse
        console.log("Testing Traversal...");
        // We guess a node name that might handle be extracted, e.g. "Admin User"
        // But extraction is nondeterministic. We'll search for any node created.
        const firstNode = await prisma.graphNode.findFirst({ where: { projectId: project.id } });

        if (firstNode) {
            console.log(`Traversing from '${firstNode.name}'...`);
            const context = await traverseGraph([firstNode.name], project.id, 1, prisma);
            console.log("Context:\n", context);
        } else {
            console.warn("No nodes found to traverse.");
        }

        // Cleanup
        await prisma.project.delete({ where: { id: project.id } });
        await prisma.user.delete({ where: { id: user.id } });

    } catch (error) {
        console.error("Verification Failed:", error);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

verify();
