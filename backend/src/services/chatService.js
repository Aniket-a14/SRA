import { genAI } from "../config/gemini.js";
import { CHAT_PROMPT } from "../utils/prompts.js";
import prisma from "../config/prisma.js";
import { invalidateUserAnalysesCache } from "./analysisService.js";

const VERSION_CONFLICT_MAX_RETRIES = 5;

const isVersionConflictError = (error) => {
    if (error?.code === 'P2002') {
        const target = Array.isArray(error?.meta?.target) ? error.meta.target : [];
        return target.includes('rootId') && target.includes('version');
    }

    return typeof error?.message === 'string' &&
        (error.message.includes('Analysis_rootId_version_key') ||
            error.message.includes('rootId') && error.message.includes('version'));
};

export async function processChat(userId, analysisId, userMessage) {
    // 1. Fetch current analysis to get context
    const currentAnalysis = await prisma.analysis.findUnique({
        where: { id: analysisId }
    });

    if (!currentAnalysis) throw new Error("Analysis not found");
    if (currentAnalysis.userId !== userId) throw new Error("Unauthorized");

    // 2. Fetch full chat history for context across versions
    const rootId = currentAnalysis.rootId || currentAnalysis.id;
    const chainAnalyses = await prisma.analysis.findMany({
        where: {
            OR: [
                { id: rootId },
                { rootId: rootId }
            ]
        },
        select: { id: true }
    });
    const chainIds = chainAnalyses.map(a => a.id);

    const history = await prisma.chatMessage.findMany({
        where: { analysisId: { in: chainIds } },
        orderBy: { createdAt: 'asc' },
        // maximize context within reason, maybe last 20 messages?
        take: 20
    });

    // 3. Prepare Prompt
    const historyText = history.map(msg => `${msg.role}: ${msg.content}`).join("\n");
    const fullPrompt = `
${CHAT_PROMPT}
${JSON.stringify(currentAnalysis.resultJson, null, 2)}

CHAT HISTORY:
${historyText}

User: ${userMessage}
`;

    // 4. Call Gemini (with retry logic)
    let outputText;
    if (process.env.MOCK_AI === 'true') {
        outputText = JSON.stringify({
            reply: "Mocked AI Reply",
            updatedAnalysis: {
                projectTitle: "Mocked V2",
                functionalRequirements: ["New Reqs"],
                nonFunctionalRequirements: [],
                userStories: []
            }
        });
    } else {
        const modelName = process.env.GEMINI_MODEL_NAME || "gemini-2.5-flash";
        const model = genAI.getGenerativeModel({ model: modelName });
        
        let attempt = 0;
        const maxRetries = 3;
        let delay = 2000;
        
        while (attempt < maxRetries) {
            try {
                const result = await model.generateContent(fullPrompt);
                outputText = result.response.text();
                break;
            } catch (err) {
                attempt++;
                const isRetryable = err.message?.includes("429") || err.message?.includes("503") || err.message?.includes("fetch failed") || err.message?.includes("ECONNREFUSED");
                
                if (isRetryable && attempt < maxRetries) {
                    console.warn(`[Chat Service] Retryable error (${err.message}). Retry ${attempt}/${maxRetries} in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2;
                    continue;
                }
                throw err;
            }
        }
        
        if (!outputText) {
            throw new Error("[Chat Service] All retry attempts exhausted.");
        }
    }

    // 51. Clean markdown
    outputText = outputText.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsedResponse;
    try {
        // Try direct parse first
        parsedResponse = JSON.parse(outputText);
    } catch (e) {
        // If direct parse fails, try to find the JSON object using regex
        const jsonMatch = outputText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                parsedResponse = JSON.parse(jsonMatch[0]);
            } catch (innerErr) {
                console.error("Failed to parse extracted JSON:", jsonMatch[0]);
                parsedResponse = { reply: outputText, updatedAnalysis: null };
            }
        } else {
            console.error("Failed to parse chat response (no JSON found):", outputText);
            parsedResponse = { reply: outputText, updatedAnalysis: null };
        }
    }

    // 5. Save User Message
    await prisma.chatMessage.create({
        data: {
            analysisId,
            role: "user",
            content: userMessage
        }
    });

    // 6. Save AI Message
    await prisma.chatMessage.create({
        data: {
            analysisId,
            role: "assistant",
            content: parsedResponse.reply
        }
    });

    let newAnalysisId = null;

    // 7. Handle Updates
    if (parsedResponse.updatedAnalysis) {
        let created = null;
        const rootId = currentAnalysis.rootId || currentAnalysis.id;

        for (let attempt = 1; attempt <= VERSION_CONFLICT_MAX_RETRIES; attempt++) {
            try {
                created = await prisma.$transaction(async (tx) => {
                    // Find max version for this root
                    const maxVersionAgg = await tx.analysis.findFirst({
                        where: { rootId },
                        orderBy: { version: 'desc' },
                        select: { version: true }
                    });
                    const version = (maxVersionAgg?.version || 0) + 1;

                    const title = parsedResponse.updatedAnalysis.projectTitle 
                        || parsedResponse.updatedAnalysis.introduction?.purpose?.slice(0, 50)
                        || currentAnalysis.title
                        || `Version ${version}`;

                    return tx.analysis.create({
                        data: {
                            userId,
                            inputText: currentAnalysis.inputText,
                            resultJson: parsedResponse.updatedAnalysis,
                            version,
                            title,
                            status: 'COMPLETED',
                            projectId: currentAnalysis.projectId,
                            rootId,
                            parentId: currentAnalysis.id,
                            metadata: {
                                trigger: 'chat',
                                source: 'ai',
                                promptSettings: {
                                    ...(currentAnalysis.metadata?.promptSettings || {}),
                                    modelName: currentAnalysis.metadata?.promptSettings?.modelName || process.env.GEMINI_MODEL_NAME || "gemini-3-flash-preview",
                                    modelProvider: currentAnalysis.metadata?.promptSettings?.modelProvider || "google"
                                }
                            }
                        }
                    });
                });
                break;
            } catch (error) {
                if (isVersionConflictError(error) && attempt < VERSION_CONFLICT_MAX_RETRIES) {
                    console.warn(`[Chat Service] Version conflict while creating chat refinement. Retry ${attempt}/${VERSION_CONFLICT_MAX_RETRIES}`);
                    continue;
                }
                throw error;
            }
        }

        if (!created) {
            throw new Error("Failed to create chat refinement version after retries");
        }

        newAnalysisId = created.id;

        // Invalidate cache so the new version appears in the user's history list
        await invalidateUserAnalysesCache(userId);
    }

    return {
        reply: parsedResponse.reply,
        newAnalysisId // If present, frontend should redirect/refresh
    };
}
