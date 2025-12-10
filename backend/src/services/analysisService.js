import axios from 'axios';
import prisma from '../config/prisma.js';

const ANALYZER_URL = process.env.ANALYZER_URL;

export const performAnalysis = async (userId, text) => {
    // Call AI Service
    let resultJson;
    try {
        const response = await axios.post(ANALYZER_URL, { text });
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
