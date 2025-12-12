import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from '../config/prisma.js';
import { CODE_GEN_PROMPT } from '../utils/prompts.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Robustly extracts the FIRST valid JSON object from a string, 
 * handling nested braces and ignoring trailing text/garbage.
 */
function extractJson(text) {
    let startIndex = text.indexOf('{');
    if (startIndex === -1) return null;

    let braceCount = 0;
    let inString = false;
    let escaped = false;

    for (let i = startIndex; i < text.length; i++) {
        const char = text[i];

        if (inString) {
            if (char === '\\') {
                escaped = !escaped;
            } else if (char === '"' && !escaped) {
                inString = false;
            } else {
                escaped = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === '{') {
            braceCount++;
        } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
                return text.substring(startIndex, i + 1);
            }
        }
    }
    // If we get here, braces were unbalanced (truncated output)
    return null;
}

export const generateCodeFromAnalysis = async (userId, analysisId) => {
    // 1. Fetch the analysis
    const analysis = await prisma.analysis.findUnique({
        where: { id: analysisId }
    });

    if (!analysis || analysis.userId !== userId) {
        throw new Error("Analysis not found or unauthorized");
    }

    // 2. Prepare Prompt
    // Using gemini-2.5-flash as requested, but with JSON mode
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = CODE_GEN_PROMPT + JSON.stringify(analysis.resultJson);

    // 3. Call AI
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();



    // 4. Parse JSON
    let generatedCode;
    try {
        // First try standard parse (fastest)
        generatedCode = JSON.parse(text);
    } catch (e) {
        console.warn("Direct JSON parse failed, attempting robust extraction...");

        const extracted = extractJson(text);
        if (extracted) {
            try {
                generatedCode = JSON.parse(extracted);
            } catch (innerE) {
                console.error("Extracted JSON failed to parse:", innerE);
                throw new Error("Generated code contained invalid JSON.");
            }
        } else {
            console.error("Failed to extract valid JSON from response.");
            throw new Error("Failed to generate complete code. The output might be truncated.");
        }
    }

    // 5. Save to DB
    await prisma.analysis.update({
        where: { id: analysisId },
        data: { generatedCode: generatedCode }
    });

    return generatedCode;
};
