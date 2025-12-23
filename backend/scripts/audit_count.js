import prisma from '../src/config/prisma.js';

async function count() {
    try {
        const u = await prisma.user.count();
        const p = await prisma.project.count();
        const a = await prisma.analysis.count();
        console.log(`USERS: ${u}, PROJECTS: ${p}, ANALYSES: ${a}`);
    } catch (e) { console.error(e); }
    finally { await prisma.$disconnect(); }
}
count();
