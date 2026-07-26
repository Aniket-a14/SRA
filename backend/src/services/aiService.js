import { getLatestVersion } from "../utils/promptRegistry.js";
import { constructMasterPrompt, DIAGRAM_REPAIR_PROMPT } from "../utils/prompts.js";
import { getAdapter, normalizeProvider, DEFAULT_MODELS } from "./providers/index.js";
import { AnalysisResultSchema } from "../utils/schemas.js";
import { sanitizePII } from "../utils/sanitizer.js";
import { repairAndParseJSON } from "../utils/jsonRepair.js";
import { isExhaustedQuota, buildExhaustedQuotaError } from "../utils/quotaErrors.js";
import logger from "../config/logger.js";
import { OUTPUT_TOKEN_LIMITS, TEMPERATURES, resolveOutputTokenLimits, clampOutputTokens } from "../utils/llmGenerationConfig.js";

import { retrieveContext, formatRagContext } from "./knowledge/ragService.js";

export async function analyzeText(text, settings = {}) {
  // PII REDACTION for production safety — reassign in place so EVERY downstream use
  // (projectName extraction, RAG retrieval query, master-prompt construction, and the
  // provider call itself) operates on the redacted text. Previously the sanitized value
  // was computed and then discarded, so raw emails/phones/cards reached the provider.
  text = sanitizePII(text);
  const {
    modelProvider = "google",
    // Resolved below rather than defaulted here: the canonical Gemini default lives in the
    // provider registry (DEFAULT_MODELS.GEMINI → GEMINI_MODEL_NAME), and reading it eagerly
    // would demand model env even on the MOCK_AI path, which never calls a provider.
    modelName: requestedModelName = null,
    promptVersion = getLatestVersion(),
    systemPrompt = null,
    projectId = null, // Extract projectId if available
    ...promptSettings
  } = settings;

  let masterPrompt;
  let finalPrompt;

  if (systemPrompt) {
    // If a specific task-based system prompt is provided, use it directly
    masterPrompt = systemPrompt;
    finalPrompt = `
<input>
User Input Data:
${text}
</input>
`;
  } else {
    // Standard SRA generation flow
    // Extract Project Name for Governance
    let projectName = settings.projectName || "Project";

    // If not provided in settings, attempt extraction from text
    if (projectName === "Project") {
      try {
        const words = JSON.parse(text);
        if (Array.isArray(words)) {
          // Look for "Project:" and join all subsequent words until the next section marker "Description:"
          const pIdx = words.findIndex(w => w === "Project:");
          const dIdx = words.findIndex(w => w === "Description:");
          if (pIdx !== -1) {
            const endIdx = dIdx !== -1 ? dIdx : words.length;
            projectName = words.slice(pIdx + 1, endIdx).join(" ").trim();
          }
        }
      } catch (e) {
        if (text && typeof text === 'string') {
          // Regex for multi-line/multi-word name extraction
          const match = text.match(/Project:\s*([^\n\r]+)/);
          if (match) projectName = match[1].trim();
        }
      }
    }

    if (!projectName) projectName = "Project";

    // --- INTELLIGENT RECYCLING (RAG INJECTION) ---
    // Retrieve context from similar past projects to guide generation
    let ragContextString = "";
    try {
      // Retrieval is scoped to the requesting user, so a caller that did not say who is
      // asking gets no RAG rather than a search across everyone's chunks. Fail closed: the
      // cost of skipping retrieval is a less informed draft, the cost of guessing is one
      // customer's requirement text appearing in another's document.
      //
      // The pipeline proper (analysisService) retrieves explicitly and always has a userId;
      // the callers that reach here without one — diagram repair, quality lint, feature
      // expansion — are single-purpose calls that never wanted historical context anyway.
      if (!settings.userId) {
        logger.debug('[AI Service] No userId in settings — skipping RAG injection');
      } else {
        const ragResults = await retrieveContext(text, { userId: settings.userId, projectId });
        ragContextString = await formatRagContext(ragResults);

        if (ragContextString) {
          logger.info(`[AI Service] Injected RAG Context (${ragResults.length} chunks) for project: ${projectName}`);
        }
      }
    } catch (ragError) {
      logger.warn({ msg: "[AI Service] RAG Injection warning", error: ragError.message });
      // Continue without RAG if it fails (fallback to base model)
    }
    // ---------------------------------------------

    finalPrompt = await constructMasterPrompt(text, {
      ...promptSettings,
      projectName,
      ragContext: ragContextString,
      systemPromptExtension: settings.systemPromptExtension
    }, promptVersion);
  }

  let output;
  // Only resolved on a real call (see the MOCK_AI early return inside the loop).
  let modelName = requestedModelName;
  const maxAttempts = 3;
  const timeoutMs = 360000; // Increased to 6 mins for large enterprise SRS generation

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const callWithTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("AI Request Timeout")), ms))
  ]);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (process.env.MOCK_AI === 'true') {
        logger.warn("[AI Service] MOCK MODE ACTIVE. Returning dummy response.");
        await sleep(500);
        output = JSON.stringify({
          // ... Mock Data ...
          projectTitle: "Unified Mock Project",
          // Keep the rest of the mock data minimal or same to save space in this replacement
          introduction: { purpose: "Mock Purpose" },
          systemFeatures: [],
          // ...
        });

        // Return structured response
        return {
          srs: JSON.parse(output),
          meta: {
            promptVersion: "mock-1.0",
            modelProvider: "mock",
            modelName: "mock-model"
          }
        };
      }

      const normalizedProvider = normalizeProvider(modelProvider);
      modelName ||= DEFAULT_MODELS[normalizedProvider];
      logger.info(`[AI Service] Using Provider: ${normalizedProvider}, Model: ${modelName} (Attempt ${attempt}/${maxAttempts})`);

      const targetSchema = settings.zodSchema === null ? null : (settings.zodSchema || AnalysisResultSchema);

      // UNIFIED PROVIDER PATH — every provider (incl. Gemini) now goes through the adapter
      // registry, removing the second, divergent Gemini call stack this file used to keep
      // (BE-16). Behavior is preserved per-provider: Gemini always ran in JSON mode with no
      // extra system instruction beyond masterPrompt; the others keyed jsonMode off targetSchema
      // and fell back to a generic "return valid JSON" instruction. OpenAI/Claude/Grok still
      // require the caller's own key (settings.apiKey) — the adapter throws a clear
      // "API key is required" error rather than silently mis-routing to Gemini.
      const isGemini = normalizedProvider === "GEMINI";
      const adapter = getAdapter(normalizedProvider, settings.apiKey);
      output = await callWithTimeout(adapter.generateContent({
        prompt: systemPrompt ? text : finalPrompt,
        systemInstruction: masterPrompt || (isGemini ? undefined : "Return valid JSON that satisfies the requested task."),
        temperature: settings.temperature ?? TEMPERATURES.developer,
        maxOutputTokens: clampOutputTokens(
          settings.maxOutputTokens || resolveOutputTokenLimits(settings.outputTokenLimit).mediumJson,
          settings.outputTokenLimit
        ),
        jsonMode: isGemini ? true : !!targetSchema,
        responseSchema: settings.responseSchema,
        modelName
      }), timeoutMs);
      break;
    } catch (error) {
      // ... retry logic remains ...
      const isRetryable = error.message.includes("429") || error.message.includes("503") || error.message.includes("Timeout");

      if (error.message.includes("403") || error.message.includes("Forbidden") || error.message.includes("API key")) {
        throw new Error("AI Service Authentication Failed: API Key is invalid or expired.");
      }

      // A spent daily quota is a 429 that no backoff can clear. Bail out before burning
      // the remaining attempts (and, on serverless, the function's execution budget).
      if (isExhaustedQuota(error)) {
        logger.error({ msg: "[AI Service] Daily quota exhausted — not retrying", model: modelName });
        throw buildExhaustedQuotaError(error, modelName);
      }

      if (attempt === maxAttempts || !isRetryable) {
        // Enhance error message for 429
        if (error.message.includes("429")) {
          const retryMatch = error.message.match(/retry in\s+([0-9.]+)/i);
          const retrySeconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 60;
          const enhancedError = new Error(`AI Quota Exceeded. Please retry in ${retrySeconds} seconds.`);
          enhancedError.statusCode = 429;
          enhancedError.retryAfter = retrySeconds;
          throw enhancedError;
        }
        throw error; // Let outer try/catch handle it or return error object
      }
      console.warn(`[AI Service] Attempt ${attempt} failed: ${error.message}. Retrying...`);
      await sleep(attempt * 2000);
    }
  }

  // Handle explicit abort messages from Diagram Authority (it might ignore JSON wraps)
  if (output.includes("DIAGRAM GENERATION ABORTED")) {
    logger.warn({ msg: "[AI Service] Model issued a safety/syntax abort", output });
    return {
      success: false,
      error: "The AI was unable to generate safe system diagrams for this input. Please refine your description.",
      raw: output
    };
  }

  // 4. Parse JSON & Validate
  try {
    let parsedSRS;
    // Native JSON mode usually returns clean JSON; when it doesn't, fall back to the same
    // repair pipeline BaseAgent uses. This path previously only retried a bad-escape fix,
    // so a stray trailing comma or unquoted key ("Expected double-quoted property name")
    // failed the whole validation gate on output jsonrepair handles trivially.
    try {
      parsedSRS = JSON.parse(output);
    } catch {
      logger.warn("[AI Service] Native JSON parse failed, running the shared repair pipeline...");
      parsedSRS = repairAndParseJSON(output, { label: 'AI Service' });
      logger.info("[AI Service] Recovered malformed JSON via repair pipeline.");
    }

    // 5. Type-Safe Validation (Zod)
    const targetSchema = settings.zodSchema === null ? null : (settings.zodSchema || AnalysisResultSchema);
    const isFullSRS = !settings.zodSchema && settings.zodSchema !== null;
    let validationErrors = null;

    if (targetSchema) {
      const validation = targetSchema.safeParse(parsedSRS);
      if (!validation.success) {
        if (isFullSRS) {
          logger.warn({ msg: "[AI Service] Zod Validation Issues", keys: Object.keys(parsedSRS) });
          // logger.warn({ msg: "[AI Service] Full Validation Errors", errors: JSON.stringify(validation.error.format(), null, 2) });
        }

        // Attempt to look for a nested 'srs' or 'result' field if the AI wrapped it
        if (parsedSRS.srs && typeof parsedSRS.srs === 'object') {
          const nestedValidation = targetSchema.safeParse(parsedSRS.srs);
          if (nestedValidation.success) {
            logger.info("[AI Service] SUCCESS: Found valid object nested inside 'srs' key.");
            parsedSRS = parsedSRS.srs;
          }
        } else if (parsedSRS.result && typeof parsedSRS.result === 'object') {
          const nestedValidation = targetSchema.safeParse(parsedSRS.result);
          if (nestedValidation.success) {
            logger.info("[AI Service] SUCCESS: Found valid object nested inside 'result' key.");
            parsedSRS = parsedSRS.result;
          }
        }
        validationErrors = validation.error.issues;
      }
    }

    return {
      success: true,
      srs: parsedSRS,
      validationErrors,
      meta: {
        promptVersion: systemPrompt ? "task-specific" : promptVersion,
        modelProvider,
        modelName
      }
    };
  } catch (parseError) {
    logger.error({ msg: "[AI Service] JSON Final Parse Error", error: parseError.message });
    logger.debug({ msg: "[AI Service] Raw Output Snippet", snippet: output.substring(0, 500) });
    return {
      success: false,
      error: `Invalid JSON from model (Error: ${parseError.message}).`,
      raw: output
    };
  }
}

export async function repairDiagram(code, error, settings = {}, customInstruction = "") {
  const { modelProvider, modelName: requestedModelName, apiKey } = settings;

  const finalPrompt = `
${DIAGRAM_REPAIR_PROMPT}

Original Mermaid Code:
\`\`\`mermaid
${code}
\`\`\`

Error Message:
${error}

${customInstruction ? `DIAGRAM TYPE SPECIFIC RULES:\n${customInstruction}` : ""}

SPECIFIC ERROR GUIDANCE:
${error.includes("Trying to inactivate an inactive participant") ? "CRITICAL: The error 'Trying to inactivate an inactive participant' means you have a 'deactivate Actor' line without a preceding 'activate Actor'. FIX: Remove the offending 'deactivate' line completely. do NOT try to add an activate line unless you are sure." : ""}

Return ONLY the corrected code.
`;

  // Goes through the adapter registry on the caller's own key, like every other
  // generation call — this used to reach for the shared platform client directly,
  // which meant diagram repair was billed to the platform's Gemini quota.
  const normalizedProvider = normalizeProvider(modelProvider);
  const modelName = requestedModelName || DEFAULT_MODELS[normalizedProvider];
  const adapter = getAdapter(normalizedProvider, apiKey);

  // Optimize for speed: Frontend handles high-level retries.
  // Backend should fail fast so UI can show "Retrying..." state.
  const MAX_RETRIES = 1;
  let attempt = 0;
  let output = "";

  while (attempt < MAX_RETRIES) {
    try {
      output = await adapter.generateContent({
        prompt: finalPrompt,
        modelName,
        temperature: TEMPERATURES.logic,
        maxOutputTokens: OUTPUT_TOKEN_LIMITS.smallJson,
        jsonMode: false
      }) || "";
      break;
    } catch (error) {
      if (error.message.includes("429") || error.status === 429) {
        attempt++;
        if (attempt >= MAX_RETRIES) throw error;
        // Short delay only if we have retries left (which we don't for n=1)
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        throw error;
      }
    }
  }

  // Sanitization: Extract code block if present, otherwise clean markdown
  const codeBlockMatch = output.match(/```(?:mermaid)?\n([\s\S]*?)\n```/);
  if (codeBlockMatch) {
    output = codeBlockMatch[1];
  } else {
    output = output.replace(/```mermaid/g, "").replace(/```/g, "").trim();
  }

  return output;
}
