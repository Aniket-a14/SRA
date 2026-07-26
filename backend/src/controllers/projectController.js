import prisma from '../config/prisma.js';
import { successResponse } from '../utils/response.js';
import logger from '../config/logger.js';

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

        return successResponse(res, project, 'Project created', 201);
    } catch (error) {
        next(error);
    }
};

export const getProjects = async (req, res, next) => {
    try {
        // This used to log `req.headers` wholesale on the no-user branch, which writes the
        // caller's `Authorization: Bearer <jwt>` — a live credential — into stdout, where it
        // is picked up by the platform's log aggregator and retained. Log the fact, never
        // the headers. (The route is behind `authenticate`, so this branch is unreachable in
        // practice; it stays as a defensive assertion.)
        if (!req.user || !req.user.userId) {
            logger.error({ msg: 'getProjects reached without a user context', requestId: req.id });
            return res.status(401).json({ error: "User context missing" });
        }

        const projects = await prisma.project.findMany({
            where: { userId: req.user.userId },
            orderBy: { updatedAt: 'desc' },
            include: {
                _count: {
                    select: { analyses: true }
                }
            }
        });

        return successResponse(res, projects);
    } catch (error) {
        // errorHandler already logs the stack at error level with the request id.
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

        return successResponse(res, project);
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

        return successResponse(res, updated);
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
        return successResponse(res, null, 'Project deleted successfully');
    } catch (error) {
        next(error);
    }
};
