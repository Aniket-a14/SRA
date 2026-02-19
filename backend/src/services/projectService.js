import prisma from '../config/prisma.js';
import logger from '../config/logger.js';

export const ensureProjectExists = async (userId, projectId, srsData, text) => {
    if (projectId) return projectId;

    logger.info("Analysis started without Project ID. Auto-creating...");
    let projectName = "New Project";

    // Try to extract a meaningful name
    if (srsData?.details?.projectName?.content) {
        projectName = srsData.details.projectName.content.trim();
    } else if (srsData?.details?.fullDescription?.content) {
        projectName = srsData.details.fullDescription.content.split('\n')[0].slice(0, 50).trim();
    } else if (text) {
        projectName = text.split('\n')[0].slice(0, 50).trim();
    }

    if (!projectName || projectName.length < 3) {
        projectName = `Project ${new Date().toLocaleDateString()}`;
    }

    // Check for existing project with same name
    const existingProject = await prisma.project.findFirst({
        where: {
            userId: userId,
            name: projectName
        }
    });

    if (existingProject) {
        logger.info({ msg: "Reusing existing project", projectId: existingProject.id });
        return existingProject.id;
    } else {
        const newProject = await prisma.project.create({
            data: {
                name: projectName,
                description: "Auto-created from analysis",
                userId: userId
            }
        });
        logger.info({ msg: "Auto-created project", projectId: newProject.id });
        return newProject.id;
    }
};
