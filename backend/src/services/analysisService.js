import axios from 'axios';
import prisma from '../config/prisma.js';

export const performAnalysis = async (userId, text) => {
    // Call AI Service
    // Default to local internal endpoint if env var is missing or incorrect
    const port = process.env.PORT || 3000;
    const ANALYZER_URL = process.env.ANALYZER_URL || `http://localhost:${port}/internal/analyze`;

    // Fallback: If ANALYZER_URL is set to port 3001 but we are on 3000, force correction for localhost
    const targetUrl = ANALYZER_URL.includes('localhost:3001') && port === '3000'
        ? ANALYZER_URL.replace('3001', '3000')
        : ANALYZER_URL;

    console.log(`[DEBUG] performAnalysis: Connecting to ${targetUrl} (Original env: ${process.env.ANALYZER_URL})`);

    let resultJson;
    try {
        const response = await axios.post(targetUrl, { text });
        resultJson = response.data;
    } catch (error) {
        console.error("AI Analysis connection failed:", error.message);
        throw new Error('Failed to communicate with analysis service');
    }

    // Save to DB
    const analysis = await prisma.analysis.create({
        data: {
            userId,
            inputText: text,
            resultJson,
        },
    });

    return analysis;
};

export const getUserAnalyses = async (userId) => {
    const analyses = await prisma.analysis.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            createdAt: true,
            inputText: true,
        }
    });

    // Return truncated review
    return analyses.map(a => ({
        ...a,
        inputPreview: a.inputText.substring(0, 50) + (a.inputText.length > 50 ? '...' : '')
    }));
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
