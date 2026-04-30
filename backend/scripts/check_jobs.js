import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function check() {
    const jobs = await prisma.analysis.findMany({
        where: {
            id: {
                in: [
                    '8cd98988-ecc0-4cf1-804a-4f116726503d',
                    '3b954a24-ac4a-4328-907e-c0edd6f5bc68'
                ]
            }
        },
        select: {
            id: true,
            status: true,
            version: true,
            rootId: true,
            parentId: true,
            title: true
        }
    });
    console.log(JSON.stringify(jobs, null, 2));
}

check().then(() => prisma.$disconnect()).catch(console.error);
