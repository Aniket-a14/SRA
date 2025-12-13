import axios from 'axios';
import prisma from '../config/prisma.js';
import { lintRequirements } from './qualityService.js';
import crypto from 'crypto';

export const performAnalysis = async (userId, text, projectId = null, parentId = null, rootId = null, settings = {}) => {
    // Call AI Service
    // Default to local internal endpoint if env var is missing or incorrect
    const port = process.env.PORT || 3000;
    const ANALYZER_URL = process.env.ANALYZER_URL || `http://localhost:${port}/internal/analyze`;

    // Fallback: If ANALYZER_URL is set to port 3001 but we are on 3000, force correction for localhost
    const targetUrl = ANALYZER_URL.includes('localhost:3001') && port === '3000'
        ? ANALYZER_URL.replace('3001', '3000')
        : ANALYZER_URL;

    let resultJson;

    // MOCK FOR TESTING
    if (process.env.MOCK_AI === 'true') {
        resultJson = {
            projectTitle: "Mocked Project",
            functionalRequirements: [],
            nonFunctionalRequirements: [],
            userStories: [],
            inputText: text
        };
    } else {
        try {
            const response = await axios.post(targetUrl, { text, settings });
            resultJson = response.data;
        } catch (error) {
            console.error("AI Analysis connection failed:", error.message);
            throw new Error('Failed to communicate with analysis service');
        }
    }

    // Run Quality Check (Linting)
    const qualityAudit = lintRequirements(resultJson);
    resultJson = {
        ...resultJson,
        qualityAudit,
        promptSettings: settings // Store settings used for versioning
    };

    // Atomic Creation with Transaction
    return await prisma.$transaction(async (tx) => {
        // 1. Determine Root and Version
        let finalRootId = rootId;
        let version = 1;

        // Generate a new ID upfront to use as rootId if needed
        const newId = crypto.randomUUID();

        if (!finalRootId) {
            // New Analysis Project -> It is its own root
            finalRootId = newId;
            version = 1;
        } else {
            // Existing Project -> Find max version
            const maxVersionAgg = await tx.analysis.findFirst({
                where: { rootId: finalRootId },
                orderBy: { version: 'desc' },
                select: { version: true }
            });
            version = (maxVersionAgg?.version || 0) + 1;
        }

        const title = resultJson.projectTitle || `Version ${version}`;

        // 2. Create Analysis
        const analysis = await tx.analysis.create({
            data: {
                id: newId,
                userId,
                inputText: text,
                resultJson,
                version,
                title,
                rootId: finalRootId,
                parentId: parentId, // Can be null if new project or just branching from nothing (rare)
                projectId: projectId // Associate with Project
            },
        });

        return analysis;
    });
};

export const getUserAnalyses = async (userId) => {
    // Get LATEST version for each rootId
    // Prisma doesn't support "DISTINCT ON" easily with other databases, but for Postgres we can use distinct.
    // However, finding the *latest* by date per rootId is better done by fetching distinct rootIds or using native query.
    // Simpler approach for now: Fetch all, group in code (if dataset small) OR findMany with distinct.

    // Better: Fetch all where it's the latest version.
    // BUT we don't store "isLatest".
    // Strategy: distinct on rootId, order by version desc? Prisma `distinct` selects the *first* it finds.
    // So if we order by rootId asc, version desc, distinct rootId will give us the latest.

    const analyses = await prisma.analysis.findMany({
        where: { userId },
        distinct: ['rootId'],
        orderBy: [
            { rootId: 'asc' },
            { version: 'desc' }
        ],
        select: {
            id: true,
            createdAt: true,
            inputText: true,
            version: true,
            title: true,
            rootId: true,
            parentId: true
        }
    });

    // Sort resulting list by createdAt desc (most recent projects first)
    analyses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Return truncated review
    return analyses.map(a => ({
        ...a,
        inputPreview: a.inputText.substring(0, 50) + (a.inputText.length > 50 ? '...' : '')
    }));
};

export const getAnalysisHistory = async (userId, rootId) => {
    const history = await prisma.analysis.findMany({
        where: { userId, rootId },
        orderBy: { version: 'desc' },
        select: {
            id: true,
            createdAt: true,
            version: true,
            title: true,
            parentId: true,
            rootId: true
        }
    });
    return history;
};

export const getAnalysisById = async (userId, analysisId) => {
    const analysis = await prisma.analysis.findUnique({
        where: { id: analysisId },
    });

    if (!analysis) return null;
    if (analysis.userId !== userId) {
        const error = new Error('Unauthorized access to this analysis');
        error.statusCode = 403;
        throw error;
    }

    return analysis;
};
