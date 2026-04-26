import { BaseAgent } from '../agents/BaseAgent.js';

/**
 * RAG Evaluation Service (Simplified RAGAS)
 * Evaluates the quality of generated requirements based on retrieved context.
 */

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

        const prompt = `
<role>
You are an expert Quality Assurance Judge for RAG (Retrieval-Augmented Generation) systems.
Your goal is to evaluate the quality of a generated response based on the provided context.
</role>

<task>
Analyze the provided context and the generated response. Evaluate the response against key RAG metrics (Faithfulness, Context Precision, Answer Relevancy) and assign a score from 0 to 100 for each.
</task>

<constraints>
[METRICS (Score 0 to 100)]
1. Faithfulness: Is the response factually grounded ONLY in the retrieved context? (100 = Highly Faithful, 0 = Hallucinated)
2. Context Precision: How much of the retrieved context was relevant to the user's intent? (100 = Highly Precise, 0 = Noise)
3. Answer Relevancy: Does the response directly and exhaustively address the user's core request? (100 = Highly Relevant, 0 = Off-topic)
</constraints>

<output_format>
Return ONLY a valid JSON object matching this schema. No markdown wrappers.
{
  "faithfulness": 0,
  "contextPrecision": 0,
  "answerRelevancy": 0,
  "reasoning": "Brief explanation for the scores."
}
</output_format>

<input>
Context: 
${typeof context === 'string' ? context : JSON.stringify(context, null, 2)}

Generated Response:
${typeof response === 'string' ? response : JSON.stringify(response, null, 2)}
</input>
`;

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
