import prisma from '../config/prisma.js';

export const createProject = async (req, res, next) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            const error = new Error('Project name is required');
            error.statusCode = 400;
            throw error;
        }

        const project = await prisma.project.create({
            data: {
                name,
                description,
                userId: req.user.userId
            }
        });

        res.status(201).json(project);
    } catch (error) {
        next(error);
    }
};

export const getProjects = async (req, res, next) => {
    try {
        const projects = await prisma.project.findMany({
            where: { userId: req.user.userId },
            orderBy: { updatedAt: 'desc' },
            include: {
                _count: {
                    select: { analyses: true }
                }
            }
        });
        res.json(projects);
    } catch (error) {
        next(error);
    }
};

export const getProject = async (req, res, next) => {
    try {
        const { id } = req.params;
        const project = await prisma.project.findUnique({
            where: { id },
            include: {
                analyses: {
                    orderBy: { createdAt: 'desc' },
                    take: 20 // Limit to recent analyses
                }
            }
        });

        if (!project || project.userId !== req.user.userId) {
            const error = new Error('Project not found or unauthorized');
            error.statusCode = 404;
            throw error;
        }

        res.json(project);
    } catch (error) {
        next(error);
    }
};

export const updateProject = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const existing = await prisma.project.findUnique({ where: { id } });
        if (!existing || existing.userId !== req.user.userId) {
            const error = new Error('Project not found or unauthorized');
            error.statusCode = 404;
            throw error;
        }

        const updated = await prisma.project.update({
            where: { id },
            data: {
                name: name || undefined,
                description: description || undefined,
                settings: req.body.settings || undefined
            }
        });

        res.json(updated);
    } catch (error) {
        next(error);
    }
};

export const deleteProject = async (req, res, next) => {
    try {
        const { id } = req.params;

        const existing = await prisma.project.findUnique({ where: { id } });
        if (!existing || existing.userId !== req.user.userId) {
            const error = new Error('Project not found or unauthorized');
            error.statusCode = 404;
            throw error;
        }

        await prisma.project.delete({ where: { id } });
        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        next(error);
    }
};
