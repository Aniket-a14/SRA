import { createRequire } from 'module';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
// Load the generated client class
const { PrismaClient } = require('../generated/prisma/index.js');

// 1. Setup Adapter with DIRECT_URL
// We use the Direct URL to bypass PgBouncer transaction mode which might conflict with Adapter prepared statements
// (though adapter usually handles it, direct is safer for verification)
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
    console.error("FATAL: No DATABASE_URL or DIRECT_URL found.");
    process.exit(1);
}

console.log("Connecting via Prisma Adapter to:", connectionString.split('@')[1] || "Hidden Host");

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 2. Dynamic Import of Service
// We import dynamically to ensure we can pass our own prisma instance
const { storeGraph, traverseGraph } = await import("../services/graphService.js");

async function verifyMock() {
    console.log("Starting MOCK GraphRAG Verification (Adapter + Direct)...");

    try {
        // Log model availability to be sure
        if (prisma._dmmf) {
            console.log("Available Models:", prisma._dmmf.datamodel.models.map(m => m.name));
        }

        // 1. Create a dummy user & project
        console.log("Creating dummy user...");
        const user = await prisma.user.create({
            data: {
                email: "mockgraph+" + Date.now() + "@example.com",
                name: "Mock Graph Tester"
            }
        });

        console.log("Creating dummy project...");
        const project = await prisma.project.create({
            data: {
                name: "Mock Graph Project",
                userId: user.id
            }
        });

        console.log("Created test project:", project.id);

        // 2. Simulate AI Output
        const mockGraphData = {
            nodes: [
                { name: "MockAdmin", type: "ACTOR" },
                { name: "MockLogin", type: "FEATURE" },
                { name: "MockPortal", type: "SYSTEM" }
            ],
            edges: [
                { source: "MockAdmin", target: "MockLogin", relation: "USES" },
                { source: "MockLogin", target: "MockPortal", relation: "DEPENDS_ON" }
            ]
        };

        console.log("Storing mock graph data...");
        // Pass our custom prisma instance with adapter
        await storeGraph(mockGraphData, project.id, prisma);

        // 3. Verify Storage
        console.log("Verifying storage...");
        const nodes = await prisma.graphNode.count({ where: { projectId: project.id } });
        const edges = await prisma.graphEdge.count({ where: { source: { projectId: project.id } } });

        console.log(`Stored ${nodes} nodes and ${edges} edges.`);

        // 4. Verify Traversal
        console.log("\nTesting Traversal for 'MockAdmin'...");
        const context = await traverseGraph(["MockAdmin"], project.id, 1, prisma);
        console.log("Traversal Context:\n", context);

        if (context.includes("MockAdmin") && context.includes("MockLogin")) {
            console.log("SUCCESS: GraphRAG Logic Verification Passed.");
        } else {
            console.log("WARNING: Traversal did not return expected context.");
        }

        // Cleanup
        console.log("Cleaning up...");
        await prisma.project.delete({ where: { id: project.id } });
        await prisma.user.delete({ where: { id: user.id } });

    } catch (error) {
        console.error("Verification Failed:", JSON.stringify(error, null, 2));
        console.error("Stack:", error.stack);
    } finally {
        await prisma.$disconnect();
        await pool.end(); // Close the pool explicitly
    }
}

verifyMock();
