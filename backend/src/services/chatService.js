import { genAI } from "../config/gemini.js";
import { CHAT_PROMPT } from "../utils/prompts.js";
import prisma from "../config/prisma.js";

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

    // 4. Call Gemini
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
        const modelName = process.env.GEMINI_API_MODEL || "gemini-2.5-flash";
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(fullPrompt);
        outputText = result.response.text();
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
        // Create NEW version with Transaction
        await prisma.$transaction(async (tx) => {
            let rootId = currentAnalysis.rootId;
            // If the current analysis didn't have a rootId (legacy), it is its own root. 
            // BUT for consistency, if we are branching from it, we should probably set the new one's rootId to the currentAnalysis.id.
            // AND update the OLD one to have rootId = id? No, that's messy side effect.
            // Better: If parent has no rootId, assume parent is root.
            if (!rootId) {
                rootId = currentAnalysis.id;
                // Ideally we should backfill the parent's rootId, but let's just treat it as the root for the new child.
            }

            // Find max version for this root
            const maxVersionAgg = await tx.analysis.findFirst({
                where: { rootId },
                orderBy: { version: 'desc' },
                select: { version: true }
            });
            const version = (maxVersionAgg?.version || 0) + 1;

            const title = parsedResponse.updatedAnalysis.projectTitle || `Version ${version}`;

            const newAnalysis = await tx.analysis.create({
                data: {
                    userId,
                    inputText: currentAnalysis.inputText, // Keep original input or maybe append user request? Keeping original for now.
                    resultJson: parsedResponse.updatedAnalysis,
                    version,
                    title,

                    rootId,
                    parentId: currentAnalysis.id,
                    metadata: {
                        trigger: 'chat',
                        source: 'ai',
                        promptSettings: {
                            ...(currentAnalysis.metadata?.promptSettings || {}),
                            // Ensure model info is carried over or defaults
                            modelName: currentAnalysis.metadata?.promptSettings?.modelName || "gemini-2.5-flash",
                            modelProvider: currentAnalysis.metadata?.promptSettings?.modelProvider || "google"
                        }
                    }
                }
            });
            newAnalysisId = newAnalysis.id;
        });
    }

    return {
        reply: parsedResponse.reply,
        newAnalysisId // If present, frontend should redirect/refresh
    };
}
