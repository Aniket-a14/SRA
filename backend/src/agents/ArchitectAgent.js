import { BaseAgent } from './BaseAgent.js';
import { retrieveContext, formatRagContext } from '../services/ragService.js';
import { constructMasterPrompt } from '../utils/prompts.js';
import { ArchitectSchema, ArchitectFoundationSchema, ArchitectDataSchema, ArchitectPrinciplesSchema } from '../utils/aiSchemas.js';
import { SchemaType } from "@google/generative-ai";
import logger from '../config/logger.js';

const QUERY_EXPANSION_PROMPT = `
<role>
You are an expert technical researcher.
</role>

<task>
Given a list of software features, generate 3 specific, distinct search queries for architectural patterns.
</task>

<output_format>
Output ONLY valid JSON matching this schema:
{ "queries": ["query1", "query2", "query3"] }
</output_format>

<input>
Features:
{{features}}
</input>
`;

export class ArchitectAgent extends BaseAgent {
  constructor() {
    super("System Architect");
  }

  async generateQueries(features) {
    const featureList = features.map(f => `- ${f.name || f}`).join('\n');
    const prompt = QUERY_EXPANSION_PROMPT.replace("{{features}}", featureList);

    try {
      const querySchema = {
        type: SchemaType.OBJECT,
        properties: {
          queries: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
        },
        required: ["queries"]
      };
      const result = await this.callLLM(prompt, 0.5, true, querySchema);
      return result.queries || [featureList.substring(0, 100)];
    } catch (e) {
      return [featureList.substring(0, 100)];
    }
  }

  async designSystem(poOutput, settings = {}) {
    const { projectName = "Project", projectId = null, version = "latest" } = settings;

    logger.info(`[Architect] Blueprinting Product Architecture (Sectional Approach)...`);
    
    // 1. System Components
    const components = await this.analyzeSystemComponents(poOutput, settings);
    
    // 2. Logical Data Model
    const model = await this.modelEntities(poOutput, components, settings);
    
    // 3. Technical Principles
    const principles = await this.identifyPrinciples(poOutput, components, model, settings);

    return {
      ...components,
      ...model,
      ...principles
    };
  }

  async analyzeSystemComponents(poOutput, settings = {}) {
    const { projectName = "Project", version = "latest", ragContext = "" } = settings;
    const masterPrompt = await constructMasterPrompt(null, {
      profile: "system_architect",
      projectName,
      noSchema: true
    }, version);

    const prompt = `
${masterPrompt}

<role>
You are acting as the Principal Systems Engineer focus on Product Architecture.
</role>

<task>
Identify the core logical components or subsystems of the product (e.g., UI Shell, Data Engine, Firmware Layer, Sensor Array). 
STRICT RULE: The product is NOT necessarily a website or web app. Think holistically. 
Do NOT invent specific technologies (e.g., React, Node) unless explicitly stated in the input. 
</task>

<input>
High-Level Requirements:
${JSON.stringify(poOutput, null, 2)}

Historical Context (RAG):
${ragContext}
</input>
`;

    logger.info(`[Architect] Analyzing System Components (1/3)...`);
    return this.callLLM(prompt, 0.4, true, ArchitectFoundationSchema);
  }

  async modelEntities(poOutput, components, settings = {}) {
    const { projectName = "Project", version = "latest", ragContext = "" } = settings;
    const masterPrompt = await constructMasterPrompt(null, {
      profile: "system_architect",
      projectName,
      noSchema: true
    }, version);

    const prompt = `
${masterPrompt}

<role>
You are acting as the Data Architect focused on logical Product Information Models.
</role>

<task>
Define the core logical entities (data objects), their necessary attributes, and relationships.
STRICT RULE: Avoid web-specific "database" terminology unless appropriate. 
Keep the model technology-agnostic. Use generic data types (e.g., "String", "ID", "Timestamp").
Focus on the top 10 core entities required for the features.
</task>

<foundation>
System Components:
${JSON.stringify(components, null, 2)}
</foundation>

<input>
High-Level Requirements:
${JSON.stringify(poOutput, null, 2)}

Historical Context (RAG):
${ragContext}
</input>
`;

    logger.info(`[Architect] Modeling Product Entities (2/3)...`);
    return this.callLLM(prompt, 0.4, true, ArchitectDataSchema);
  }

  async identifyPrinciples(poOutput, components, model, settings = {}) {
    const { projectName = "Project", version = "latest", ragContext = "" } = settings;
    const masterPrompt = await constructMasterPrompt(null, {
      profile: "system_architect",
      projectName,
      noSchema: true
    }, version);

    const prompt = `
${masterPrompt}

<role>
You are acting as the Principal Architect focused on Product technical Needs.
</role>

<task>
Identify high-level architectural needs, constraints, and non-functional principles (Stability, Safety, Performance).
STRICT RULE: Do NOT invent design decisions (e.g., "Use AWS") unless explicitly requested. 
Focus on PRODUCT NECESSITIES (e.g., "The product must operate in offline environments", "Critical data requires hardware-level encryption").
</task>

<context>
System Components: ${JSON.stringify(components, null, 2)}
Entity Model: ${JSON.stringify(model, null, 2)}
</context>

<input>
High-Level Requirements:
${JSON.stringify(poOutput, null, 2)}

Historical Context (RAG):
${ragContext}
</input>
`;

    logger.info(`[Architect] Identifying Product Principles (3/3)...`);
    return this.callLLM(prompt, 0.4, true, ArchitectPrinciplesSchema);
  }
}
