import { BaseAgent } from './BaseAgent.js';
import { retrieveContext, formatRagContext } from '../services/ragService.js';
import { constructMasterPrompt } from '../utils/prompts.js';
import logger from '../config/logger.js';

const QUERY_EXPANSION_PROMPT = `
You are an expert technical researcher.
Given a list of software features, generate 3 specific, distinct search queries for architectural patterns.

Features:
{features}

Output JSON: { "queries": ["..."] }
`;

export class ArchitectAgent extends BaseAgent {
  constructor() {
    super("System Architect");
  }

  async generateQueries(features) {
    const featureList = features.map(f => `- ${f.name || f}`).join('\n');
    const prompt = QUERY_EXPANSION_PROMPT.replace("{features}", featureList);

    try {
      const result = await this.callLLM(prompt, 0.5, true);
      return result.queries || [featureList.substring(0, 100)];
    } catch (e) {
      return [featureList.substring(0, 100)];
    }
  }

  async designSystem(poOutput, settings = {}) {
    const { projectName = "Project", projectId = null, version = "latest" } = settings;

    // Robustly extract features from PO output (v1.1.0 schema)
    const features = (poOutput?.systemFeatures || poOutput?.features || []);

    if (features.length === 0) {
      logger.warn("[Architect] No features found in PO output.");
    }

    // 1. Advanced RAG: Query Expansion (Fire and Forget)
    logger.info(`[Architect] Generating search queries...`);
    const queries = await this.generateQueries(features);

    // 2. Parallel Retrieval
    let allChunks = [];
    try {
      const retrievalPromises = queries.map(q => retrieveContext(q, projectId, 2));
      const results = await Promise.all(retrievalPromises);
      allChunks = results.flat();
    } catch (e) {
      logger.warn({ msg: "[Architect] RAG retrieval failed", error: e });
    }

    const uniqueChunks = [];
    const seenContent = new Set();
    for (const chunk of allChunks) {
      const key = chunk.id || JSON.stringify(chunk.content).substring(0, 50);
      if (!seenContent.has(key)) {
        seenContent.add(key);
        uniqueChunks.push(chunk);
      }
    }

    const finalChunks = uniqueChunks.slice(0, 5);
    const ragContext = formatRagContext(finalChunks);

    // 3. Use v1_1_0 system_architect profile
    const masterPrompt = await constructMasterPrompt({
      profile: "system_architect",
      projectName,
      projectId,
      noSchema: true
    }, version);

    const prompt = `
${masterPrompt}

### SPECIFIC GOAL:
Design a robust, scalable technical architecture based on the provided features and historical context.
Enforce tech stack consistency and security best practices.

Input Requirements (PO Draft):
${JSON.stringify(poOutput, null, 2)}

Historical Context (RAG):
${ragContext || "No historical context available."}

### OUTPUT SCHEMA (STRICTLY v1.1.0 COMPATIBLE):
Return a JSON object only. NO markdown blocks.
{
  "techStack": { 
    "frontend": "string (e.g. Next.js, Tailwind)", 
    "backend": "string (e.g. Node.js, Express)", 
    "database": "string (e.g. PostgreSQL, Redis)" 
  },
  "databaseSchema": [ 
    { 
      "table": "string", 
      "columns": ["string (type)"], 
      "relationships": ["string"] 
    } 
  ],
  "designDecisions": [ 
    "A single string starting with a Title: and followed by a justification. DO NOT use an object here. Use a flat array of strings." 
  ]
}

### FINAL RULES:
1. "designDecisions" MUST be an ARRAY of strings, not an object.
2. Ensure the JSON is complete and all arrays are closed. 
3. Do not include any text before or after the JSON.
`;

    return this.callLLM(prompt, 0.4, true);
  }
}
