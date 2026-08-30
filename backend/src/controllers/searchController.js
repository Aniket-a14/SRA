import prisma from '../config/prisma.js';
import { successResponse } from '../utils/response.js';
import logger from '../config/logger.js';

/**
 * Global Search Controller
 * Searches across user's Analyses, Projects, and Knowledge Chunks.
 * Strictly enforces user isolation (req.user.userId).
 */
export const globalSearch = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            const err = new Error('Authentication required');
            err.statusCode = 401;
            throw err;
        }

        const rawQuery = req.query.q || '';
        const q = typeof rawQuery === 'string' ? rawQuery.trim() : '';

        if (!q || q.length === 0) {
            return successResponse(res, {
                query: '',
                total: 0,
                results: {
                    analyses: [],
                    projects: [],
                    knowledgeChunks: []
                }
            });
        }

        const sanitizedQuery = q.slice(0, 100);

        // Perform parallel queries scoped strictly to the authenticated user
        const [analyses, projects, knowledgeChunks] = await Promise.all([
            // 1. Search Analyses
            prisma.analysis.findMany({
                where: {
                    userId,
                    OR: [
                        { title: { contains: sanitizedQuery, mode: 'insensitive' } },
                        { inputText: { contains: sanitizedQuery, mode: 'insensitive' } }
                    ]
                },
                select: {
                    id: true,
                    title: true,
                    version: true,
                    status: true,
                    resultQuality: true,
                    createdAt: true,
                    projectId: true,
                    inputText: true,
                    project: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                orderBy: { updatedAt: 'desc' },
                take: 8
            }),

            // 2. Search Projects
            prisma.project.findMany({
                where: {
                    userId,
                    OR: [
                        { name: { contains: sanitizedQuery, mode: 'insensitive' } },
                        { description: { contains: sanitizedQuery, mode: 'insensitive' } }
                    ]
                },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    updatedAt: true,
                    _count: {
                        select: { analyses: true }
                    }
                },
                orderBy: { updatedAt: 'desc' },
                take: 5
            }),

            // 3. Search Knowledge Chunks
            prisma.knowledgeChunk.findMany({
                where: {
                    userId,
                    OR: [
                        { type: { contains: sanitizedQuery, mode: 'insensitive' } },
                        { tags: { hasSome: [sanitizedQuery.toLowerCase()] } }
                    ]
                },
                select: {
                    id: true,
                    type: true,
                    tags: true,
                    qualityScore: true,
                    sourceAnalysisId: true,
                    createdAt: true
                },
                orderBy: { createdAt: 'desc' },
                take: 5
            })
        ]);

        // Format search snippets
        const formattedAnalyses = analyses.map(a => {
            let snippet = '';
            const lowerInput = a.inputText.toLowerCase();
            const matchIdx = lowerInput.indexOf(sanitizedQuery.toLowerCase());
            if (matchIdx !== -1) {
                const start = Math.max(0, matchIdx - 40);
                const end = Math.min(a.inputText.length, matchIdx + sanitizedQuery.length + 60);
                snippet = (start > 0 ? '...' : '') + a.inputText.substring(start, end).trim() + (end < a.inputText.length ? '...' : '');
            } else {
                snippet = a.inputText.slice(0, 100) + (a.inputText.length > 100 ? '...' : '');
            }

            return {
                id: a.id,
                title: a.title || 'Untitled Analysis',
                version: a.version,
                status: a.status,
                resultQuality: a.resultQuality,
                createdAt: a.createdAt,
                projectId: a.projectId,
                projectName: a.project?.name || null,
                snippet
            };
        });

        const formattedProjects = projects.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            updatedAt: p.updatedAt,
            analysisCount: p._count.analyses
        }));

        const totalCount = formattedAnalyses.length + formattedProjects.length + knowledgeChunks.length;

        logger.info({
            msg: 'Global search executed',
            userId,
            query: sanitizedQuery,
            totalCount
        });

        return successResponse(res, {
            query: sanitizedQuery,
            total: totalCount,
            results: {
                analyses: formattedAnalyses,
                projects: formattedProjects,
                knowledgeChunks
            }
        });
    } catch (error) {
        next(error);
    }
};
