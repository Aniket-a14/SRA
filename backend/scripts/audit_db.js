import prisma from '../src/config/prisma.js';

async function auditProjects() {
    try {
        console.log("--- Users ---");
        const users = await prisma.user.findMany({ select: { id: true, email: true } });
        console.table(users);

        console.log("\n--- Projects ---");
        const projects = await prisma.project.findMany();
        if (projects.length === 0) console.log("NO PROJECTS FOUND.");
        else console.table(projects);

        console.log("\n--- Analyses ---");
        const count = await prisma.analysis.count();
        console.log(`Total Analyses: ${count}`);

        const analyses = await prisma.analysis.findMany({
            take: 5,
            select: { id: true, title: true, projectId: true, userId: true }
        });
        console.table(analyses);

    } catch (error) {
        console.error("Audit failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

auditProjects();
