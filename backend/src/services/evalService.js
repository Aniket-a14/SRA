import { genAI } from '../config/gemini.js';
import { BaseAgent } from '../agents/BaseAgent.js';

/**
 * RAG Evaluation Service (Simplified RAGAS)
 * Evaluates the quality of generated requirements based on retrieved context.
 */

const EVAL_PROMPT = `
You are an expert Quality Assurance Judge for RAG (Retrieval-Augmented Generation) systems.
Your goal is to evaluate the quality of a generated response based on the provided context.

Context: 
{context}

Generated Response:
{response}

Evaluate based on these metrics (Score 0.0 to 1.0):
1. **Faithfulness**: Is the response factually grounded ONLY in the retrieved context? (1.0 = Highly Faithful, 0.0 = Hallucinated)
2. **Context Precision**: How much of the retrieved context was relevant to the user's intent? (1.0 = Highly Precise, 0.0 = Noise)
3. **Answer Relevancy**: Does the response directly and exhaustively address the user's core request? (1.0 = Highly Relevant, 0.0 = Off-topic)

Return ONLY JSON:
{{
  "faithfulness": 0.0,
  "contextPrecision": 0.0,
  "answerRelevancy": 0.0,
  "reasoning": "Brief explanation for the scores."
}}
`;

export class EvalService extends BaseAgent {
    constructor() {
        super("QA Judge");
    }

    async evaluateRAG(query, context, response) {
        // Simple heuristic: If no context, faithfulness might be low if response is long
        if (!context || context.length === 0) {
            return {
                faithfulness: 0.1,
                contextPrecision: 0.0,
                answerRelevancy: 0.5,
                reasoning: "No context provided for evaluation."
            };
        }

        const prompt = EVAL_PROMPT
            .replace("{context}", typeof context === 'string' ? context : JSON.stringify(context))
            .replace("{response}", typeof response === 'string' ? response : JSON.stringify(response));

        try {
            const result = await this.callLLM(prompt, 0.2, true);
            return result;
        } catch (error) {
            console.error("Evaluation Error:", error);
            return {
                faithfulness: 0.0,
                contextPrecision: 0.0,
                answerRelevancy: 0.0,
                reasoning: "Evaluation failed."
            };
        }
    }
}

export const evalService = new EvalService();
