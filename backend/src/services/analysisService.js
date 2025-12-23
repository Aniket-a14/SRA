import axios from 'axios';
import prisma from '../config/prisma.js';
import { lintRequirements } from './qualityService.js';
import crypto from 'crypto';

export const performAnalysis = async (userId, text, projectId = null, parentId = null, rootId = null, settings = {}, analysisId = null) => {
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
            introduction: {
                purpose: "Mock Purpose",
                scope: "Mock Scope",
                intendedAudience: "Developers",
                references: []
            },
            overallDescription: {
                productPerspective: "Mock Perspective",
                productFunctions: ["Function A", "Function B"],
                userClassesAndCharacteristics: [{ userClass: "Admin", characteristics: "High privilege" }],
                operatingEnvironment: "Web",
                designAndImplementationConstraints: [],
                userDocumentation: [],
                assumptionsAndDependencies: []
            },
            externalInterfaceRequirements: {
                userInterfaces: "Mock UI",
                hardwareInterfaces: "N/A",
                softwareInterfaces: "N/A",
                communicationsInterfaces: "HTTP"
            },
            systemFeatures: [
                {
                    name: "Mock Feature 1",
                    description: "A mocked feature.",
                    stimulusResponseSequences: ["User clicks -> System responds"],
                    functionalRequirements: ["The system shall work."]
                }
            ],
            nonFunctionalRequirements: {
                performanceRequirements: ["Response < 1s"],
                safetyRequirements: [],
                securityRequirements: [],
                softwareQualityAttributes: [],
                businessRules: []
            },
            otherRequirements: [],
            glossary: [],
            appendices: {
                analysisModels: {},
                tbdList: []
            },
            inputText: text
        };
    } else {
        try {
            const response = await axios.post(targetUrl, { text, settings }, { timeout: 120000 }); // 2 min timeout
            resultJson = response.data;
        } catch (error) {
            console.error("AI Analysis connection failed:", error.message);
            // If we have an ID, we should fail it
            if (analysisId) {
                await prisma.analysis.update({
                    where: { id: analysisId },
                    data: { status: 'FAILED' }
                });
            }
            throw new Error('Failed to communicate with analysis service');
        }
    }

    // Run Quality Check (Linting)
    const qualityAudit = lintRequirements(resultJson);
    resultJson = {
        ...resultJson,
        qualityAudit,
        promptSettings: settings // Store settings (including model info) used for versioning
    };

    // Atomic Creation with Transaction
    return await prisma.$transaction(async (tx) => {
        // If analysisId is provided, we update the existing record
        if (analysisId) {
            const existing = await tx.analysis.findUnique({ where: { id: analysisId } });
            if (!existing) throw new Error("Analysis ID not found during processing");

            // We still need to calculate title if missing
            const title = resultJson.projectTitle || `Version ${existing.version}`;

            return await tx.analysis.update({
                where: { id: analysisId },
                data: {
                    resultJson,
                    title,
                    status: 'COMPLETED',
                    isFinalized: false // default
                }
            });
        }

        // --- LEGACY / DIRECT SYNC FLOW ---
        // DEPRECATED: All analyses should now be created via queueService with an ID upfront.
        throw new Error("performAnalysis called without analysisId. Legacy direct creation is deprecated.");
    });
};

export const getUserAnalyses = async (userId) => {
    // Optimized: Get LATEST version for each rootId using PostgreSQL DISTINCT ON
    try {
        const analyses = await prisma.$queryRaw`
            SELECT DISTINCT ON ("rootId")
                id,
                "createdAt",
                "inputText",
                version,
                title,
                "rootId",
                "parentId",
                metadata
            FROM "Analysis"
            WHERE "userId" = ${userId}
            ORDER BY "rootId", version DESC
        `;

        // Sort resulting list by createdAt desc (most recent projects first)
        // Note: Raw query returns objects, we can sort them in JS or wrap the SQL.
        // Sorting in JS is fine for reasonable page sizes.
        analyses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Return truncated review with intelligent JSON preview extraction
        return analyses.map(a => {
            let preview = a.inputText;

            // If it looks like JSON (starts with {), try to extract purpose or scope
            if (preview && preview.trim().startsWith('{')) {
                try {
                    const parsed = JSON.parse(preview);
                    // Extract purpose or scope for a better preview, otherwise fallback to name
                    preview = parsed.introduction?.purpose?.content ||
                        parsed.introduction?.productScope?.content ||
                        parsed.projectTitle ||
                        "Draft analysis data";
                } catch (e) {
                    // Not valid JSON, fallback to standard truncation
                }
            }

            return {
                ...a,
                inputPreview: preview.substring(0, 100) + (preview.length > 100 ? '...' : '')
            };
        });
    } catch (error) {
        console.error("Error fetching user analyses:", error);
        throw error;
    }
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
            rootId: true,
            metadata: true
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
