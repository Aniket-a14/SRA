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

    // 2. Fetch recent chat history for context (optional, but good)
    const history = await prisma.chatMessage.findMany({
        where: { analysisId },
        orderBy: { createdAt: 'asc' },
        take: 10 // Limit context window
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(fullPrompt);
    let outputText = result.response.text();

    // Clean markdown
    outputText = outputText.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsedResponse;
    try {
        parsedResponse = JSON.parse(outputText);
    } catch (e) {
        console.error("Failed to parse chat response:", outputText);
        // Fallback
        parsedResponse = { reply: outputText, updatedAnalysis: null };
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
        // Create NEW version
        const count = await prisma.analysis.count({ where: { userId } });
        const version = count + 1;
        const title = parsedResponse.updatedAnalysis.projectTitle || `Version ${version}`;

        const newAnalysis = await prisma.analysis.create({
            data: {
                userId,
                inputText: currentAnalysis.inputText, // Keep original input or maybe append user request? Keeping original for now.
                resultJson: parsedResponse.updatedAnalysis,
                version,
                title
            }
        });
        newAnalysisId = newAnalysis.id;
    }

    return {
        reply: parsedResponse.reply,
        newAnalysisId // If present, frontend should redirect/refresh
    };
}
