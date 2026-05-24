import { BaseAgent } from './BaseAgent.js';
import { constructMasterPrompt } from '../utils/prompts.js';
import { ArchitectFoundationSchema, ArchitectDataSchema, ArchitectPrinciplesSchema } from '../utils/aiSchemas.js';
import { SchemaType } from "@google/generative-ai";
import logger from '../config/logger.js';
import { OUTPUT_TOKEN_LIMITS, TEMPERATURES } from '../utils/llmGenerationConfig.js';
import { stringifyForPrompt } from '../utils/promptCompaction.js';

const QUERY_EXPANSION_PROMPT = `
<role>
You are an expert technical researcher specializing in software architecture pattern discovery.
</role>

<task>
Given a list of software features, generate 3 specific, distinct search queries optimized for retrieving relevant architectural patterns, design decisions, and system blueprints from a knowledge base.
</task>

<constraints>
1. Each query must target a different architectural concern (e.g., data flow, security model, integration pattern).
2. Queries must be specific enough to retrieve relevant results, not generic (e.g., "event-driven order processing pipeline" not "order management").
3. Do NOT include technology-specific terms unless the features explicitly mention them.
</constraints>

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
      const result = await this.callLLM(prompt, TEMPERATURES.architect, true, querySchema, 3, 5000, {
        maxOutputTokens: OUTPUT_TOKEN_LIMITS.smallJson
      });
      return result.queries || [featureList.substring(0, 100)];
    } catch {
      return [featureList.substring(0, 100)];
    }
  }

  async designSystem(poOutput, settings = {}) {
    const { projectName = "Project", version = "latest" } = settings;

    logger.info(`[Architect] Blueprinting Product Architecture (Sectional Approach)...`);

    const systemInstruction = await constructMasterPrompt(null, {
      profile: "system_architect",
      projectName,
      noSchema: true
    }, version);
    const agentSettings = { ...settings, systemInstruction };

      // settings may include a ragContexts object with domain-specific RAG strings
      // e.g. settings.ragContexts = { components: '...', entities: '...', principles: '...' }
      // 1. System Components
      const components = await this.analyzeSystemComponents(poOutput, { ...agentSettings, ragContext: settings.ragContexts?.components || settings.ragContext });

    // 2. Logical Data Model
      const model = await this.modelEntities(poOutput, components, { ...agentSettings, ragContext: settings.ragContexts?.entities || settings.ragContext });

    // 3. Technical Principles
      const principles = await this.identifyPrinciples(poOutput, components, model, { ...agentSettings, ragContext: settings.ragContexts?.principles || settings.ragContext });

    return {
      ...components,
      ...model,
      ...principles
    };
  }

  async analyzeSystemComponents(poOutput, settings = {}) {
    const { ragContext = "", systemInstruction } = settings;

    const prompt = `
<role>
You are the Principal Systems Engineer focused on Product Architecture. You identify core logical components and subsystems that form the product's structural backbone.
</role>

<task>
Identify the core logical components or subsystems of the product (e.g., UI Shell, Data Engine, Firmware Layer, Sensor Array). Define their responsibilities and inter-component communication patterns.
</task>

<constraints>
1. The product is NOT necessarily a website or web app. Think holistically — it could be embedded, mobile, IoT, desktop, or hybrid.
2. Do NOT invent specific technologies (e.g., React, Node, AWS) unless explicitly stated in the input.
3. Components must be defined at the logical level (what they do), not implementation level (how they're built).
4. Identify 3-8 core components depending on product complexity.
</constraints>

<context>
<historical_patterns>${ragContext}</historical_patterns>
</context>

<input>
High-Level Requirements:
${stringifyForPrompt(poOutput)}
</input>
`;

    logger.info(`[Architect] Analyzing System Components (1/3)...`);
    return this.callLLM(prompt, TEMPERATURES.architect, true, ArchitectFoundationSchema, 3, 5000, {
      systemInstruction,
      maxOutputTokens: OUTPUT_TOKEN_LIMITS.architectSection
    });
  }

  async modelEntities(poOutput, components, settings = {}) {
    const { ragContext = "", systemInstruction } = settings;

    const prompt = `
<role>
You are the Data Architect focused on logical Product Information Models. You design technology-agnostic data structures that capture the product's core domain.
</role>

<task>
Define the core logical entities (data objects), their necessary attributes, and relationships. Focus on the top 10 core entities required for the features.
</task>

<constraints>
1. Avoid web-specific "database" terminology unless the product is explicitly a web application.
2. Keep the model technology-agnostic. Use generic data types (e.g., "String", "ID", "Timestamp").
3. Each entity must have a clear purpose traceable to a product feature.
4. Relationships must specify cardinality (1:1, 1:N, M:N) and direction.
</constraints>

<context>
<system_components>${stringifyForPrompt(components)}</system_components>
<historical_patterns>${ragContext}</historical_patterns>
</context>

<input>
High-Level Requirements:
${stringifyForPrompt(poOutput)}
</input>
`;

    logger.info(`[Architect] Modeling Product Entities (2/3)...`);
    return this.callLLM(prompt, TEMPERATURES.architect, true, ArchitectDataSchema, 3, 5000, {
      systemInstruction,
      maxOutputTokens: OUTPUT_TOKEN_LIMITS.architectSection
    });
  }

  async identifyPrinciples(poOutput, components, model, settings = {}) {
    const { ragContext = "", systemInstruction } = settings;

    const prompt = `
<role>
You are the Principal Architect focused on Product Technical Principles. You identify the non-functional necessities that govern how the product must behave at a systemic level.
</role>

<task>
Identify high-level architectural principles, constraints, and non-functional necessities (Stability, Safety, Performance, Resilience). These are product-level requirements, not implementation choices.
</task>

<constraints>
1. Do NOT invent design decisions (e.g., "Use AWS", "Use microservices") unless explicitly requested in the input.
2. Focus on PRODUCT NECESSITIES (e.g., "The product must operate in offline environments", "Critical data requires hardware-level encryption").
3. Each principle must be justified by a feature or constraint from the requirements.
4. Distinguish between hard constraints (must-have) and soft preferences (nice-to-have).
</constraints>

<context>
<system_components>${stringifyForPrompt(components)}</system_components>
<entity_model>${stringifyForPrompt(model)}</entity_model>
<historical_patterns>${ragContext}</historical_patterns>
</context>

<input>
High-Level Requirements:
${stringifyForPrompt(poOutput)}
</input>
`;

    logger.info(`[Architect] Identifying Product Principles (3/3)...`);
    return this.callLLM(prompt, TEMPERATURES.architect, true, ArchitectPrinciplesSchema, 3, 5000, {
      systemInstruction,
      maxOutputTokens: OUTPUT_TOKEN_LIMITS.architectSection
    });
  }
}
