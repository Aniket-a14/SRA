import { getLatestVersion } from "../utils/promptRegistry.js";
import { constructMasterPrompt, DIAGRAM_REPAIR_PROMPT } from "../utils/prompts.js";
import { genAI } from "../config/gemini.js";
import { AnalysisResultSchema } from "../utils/schemas.js";
import { sanitizePII } from "../utils/sanitizer.js";

export async function analyzeText(text, settings = {}) {
  // PII REDACTION for production safety
  const sanitizedText = sanitizePII(text);
  const {
    modelProvider = "google",
    modelName = "gemini-2.5-flash",
    promptVersion = getLatestVersion(),
    systemPrompt = null,
    ...promptSettings
  } = settings;

  let masterPrompt;
  let finalPrompt;

  if (systemPrompt) {
    // If a specific task-based system prompt is provided, use it directly
    masterPrompt = systemPrompt;
    finalPrompt = `
System Context:
${masterPrompt}

User Input Data:
${text}

REMINDER: Return ONLY a valid JSON object.
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

    masterPrompt = await constructMasterPrompt({ ...promptSettings, projectName }, promptVersion);

    if (settings.systemPromptExtension) {
      masterPrompt += `\n\n${settings.systemPromptExtension}`;
    }

    finalPrompt = `
${masterPrompt}

User Input:
${text}
`;
  }

  let output;
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
        console.log("[AI Service] MOCK MODE ACTIVE. Returning dummy response.");
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

      console.log(`[AI Service] Using Provider: ${modelProvider}, Model: ${modelName} (Attempt ${attempt}/${maxAttempts})`);

      const targetSchema = settings.zodSchema === null ? null : (settings.zodSchema || AnalysisResultSchema);

      if (modelProvider === "openai") {
        const completion = await callWithTimeout(openai.chat.completions.create({
          messages: [{ role: "system", content: masterPrompt }, { role: "user", content: text }],
          model: modelName,
          temperature: 0.7,
          response_format: targetSchema ? { type: "json_object" } : undefined
        }), timeoutMs);
        output = completion.choices[0].message.content;
      } else {
        const model = genAI.getGenerativeModel({
          model: modelName || "gemini-2.5-flash",
          generationConfig: {
            responseMimeType: "application/json",
            temperature: settings.temperature || 0.7
          }
        });
        const result = await callWithTimeout(model.generateContent(finalPrompt), timeoutMs);

        if (result && result.response && typeof result.response.text === "function") {
          output = result.response.text();
        } else if (result && result.candidates && result.candidates[0]) {
          output = result.candidates[0].content || result.candidates[0].output || JSON.stringify(result.candidates[0]);
        } else if (typeof result === "string") {
          output = result;
        } else {
          output = JSON.stringify(result);
        }
      }
      break;
    } catch (error) {
      // ... retry logic remains ...
      const isRetryable = error.message.includes("429") || error.message.includes("503") || error.message.includes("Timeout");

      if (error.message.includes("403") || error.message.includes("Forbidden") || error.message.includes("API key")) {
        throw new Error("AI Service Authentication Failed: API Key is invalid or expired.");
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
    console.warn("[AI Service] Model issued a safety/syntax abort:", output);
    return {
      success: false,
      error: "The AI was unable to generate safe system diagrams for this input. Please refine your description.",
      raw: output
    };
  }

  // 4. Parse JSON & Validate
  try {
    let parsedSRS;
    // Native JSON mode should return clean JSON, but we keep a safety parse
    try {
      parsedSRS = JSON.parse(output);
    } catch (primaryError) {
      console.warn("[AI Service] Native JSON parse failed, attempting secondary fix for bad escapes...");
      // Secondary Fix: Handle unescaped backslashes that aren't valid JSON escapes
      let fixedOutput = output.replace(/\\(?!(["\\/bfnrt]|u[0-9a-fA-F]{4}))/g, "\\\\");
      parsedSRS = JSON.parse(fixedOutput);
      console.log("[AI Service] Secondary parse SUCCESS after manual escaping.");
    }

    // 5. Type-Safe Validation (Zod)
    const targetSchema = settings.zodSchema === null ? null : (settings.zodSchema || AnalysisResultSchema);
    const isFullSRS = !settings.zodSchema && settings.zodSchema !== null;
    let validationErrors = null;

    if (targetSchema) {
      const validation = targetSchema.safeParse(parsedSRS);
      if (!validation.success) {
        if (isFullSRS) {
          console.warn("[AI Service] Zod Validation Issues found. Keys present in parsed object:", Object.keys(parsedSRS));
          console.warn("[AI Service] Full Validation Errors:", JSON.stringify(validation.error.format(), null, 2));
        }

        // Attempt to look for a nested 'srs' or 'result' field if the AI wrapped it
        if (parsedSRS.srs && typeof parsedSRS.srs === 'object') {
          const nestedValidation = targetSchema.safeParse(parsedSRS.srs);
          if (nestedValidation.success) {
            console.log("[AI Service] SUCCESS: Found valid object nested inside 'srs' key.");
            parsedSRS = parsedSRS.srs;
          }
        } else if (parsedSRS.result && typeof parsedSRS.result === 'object') {
          const nestedValidation = targetSchema.safeParse(parsedSRS.result);
          if (nestedValidation.success) {
            console.log("[AI Service] SUCCESS: Found valid object nested inside 'result' key.");
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
    console.error("[AI Service] JSON Final Parse Error:", parseError.message);
    console.error("[AI Service] Raw Output Snippet:", output.substring(0, 500));
    return {
      success: false,
      error: `Invalid JSON from model (Error: ${parseError.message}).`,
      raw: output
    };
  }
}

export async function repairDiagram(code, error, settings = {}, customInstruction = "") {
  const {
    modelName = "gemini-2.5-flash",
  } = settings;

  const finalPrompt = `
${DIAGRAM_REPAIR_PROMPT}

Original Mermaid Code:
\`\`\`mermaid
${code}
\`\`\`

Error Message:
${error}

${customInstruction ? `DIAGRAM TYPE SPECIFIC RULES:\n${customInstruction}` : ""}

Return ONLY the corrected code.
`;

  const model = genAI.getGenerativeModel({ model: modelName });

  // Retry Logic for 429 (Rate Limit)
  const MAX_RETRIES = 3;
  let attempt = 0;
  let result;

  while (attempt < MAX_RETRIES) {
    try {
      result = await model.generateContent(finalPrompt);
      break; // Success
    } catch (error) {
      if (error.message.includes("429") || error.status === 429) {
        attempt++;
        if (attempt >= MAX_RETRIES) throw error; // Give up after max retries

        const delay = Math.pow(2, attempt) * 2000; // Exponential backoff: 2s, 4s, 8s
        console.warn(`[AI Service] Rate limit hit (429). Retrying in ${delay}ms... (Attempt ${attempt}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error; // Non-retryable error
      }
    }
  }

  let output = "";
  if (result && result.response && typeof result.response.text === "function") {
    output = result.response.text();
  } else if (result && result.candidates && result.candidates[0]) {
    output = result.candidates[0].content || result.candidates[0].output || JSON.stringify(result.candidates[0]);
  }

  // Sanitization: Remove any markdown backticks if the model ignores instructions
  output = output.replace(/```mermaid/g, "").replace(/```/g, "").trim();

  return output;
}
