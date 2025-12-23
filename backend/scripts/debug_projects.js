import prisma from '../src/config/prisma.js';

async function testProjectFetch() {
    try {
        console.log("Testing Prisma Connection...");
        // Fetch any user to use as context
        const user = await prisma.user.findFirst();
        if (!user) {
            console.log("No users found in DB. Cannot test project fetch.");
            return;
        }
        console.log("Found user:", user.id);

        console.log("Attempting project fetch...");
        const projects = await prisma.project.findMany({
            where: { userId: user.id },
            orderBy: { updatedAt: 'desc' },
            include: {
                _count: {
                    select: { analyses: true }
                }
            }
        });
        console.log("Project fetch successful:", projects);
    } catch (error) {
        console.error("Project fetch failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

testProjectFetch();
