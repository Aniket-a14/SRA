import { getLatestVersion } from "../utils/promptRegistry.js";
import { constructMasterPrompt, DIAGRAM_REPAIR_PROMPT } from "../utils/prompts.js";
import { genAI } from "../config/gemini.js";


export async function analyzeText(text, settings = {}) {
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
    // Extract Project Name for Governance if using Word Array format
    let projectName = "Project";
    try {
      const words = JSON.parse(text);
      if (Array.isArray(words)) {
        const pIdx = words.findIndex(w => w === "Project:");
        if (pIdx !== -1 && words[pIdx + 1]) {
          projectName = words[pIdx + 1];
        }
      }
    } catch (e) {
      if (text && typeof text === 'string') {
        const match = text.match(/Project:\s*([^\n\r]+)/);
        if (match) projectName = match[1].trim();
      }
    }

    masterPrompt = constructMasterPrompt({ ...promptSettings, projectName }, promptVersion);
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

      if (modelProvider === "openai") {
        const completion = await callWithTimeout(openai.chat.completions.create({
          messages: [{ role: "system", content: masterPrompt }, { role: "user", content: text }],
          model: modelName,
          temperature: 0.7,
        }), timeoutMs);
        output = completion.choices[0].message.content;
      } else {
        const model = genAI.getGenerativeModel({ model: modelName || "gemini-2.5-flash" });
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

      if (attempt === maxAttempts || !isRetryable) {
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

  // Parse JSON
  let parsedSRS;
  try {
    // 1. Remove markdown code blocks
    let cleanOutput = output.replace(/```json/g, "").replace(/```/g, "").trim();

    // 2. Try to find the first '{' and last '}' to isolate the JSON object
    const firstBrace = cleanOutput.indexOf('{');
    const lastBrace = cleanOutput.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanOutput = cleanOutput.substring(firstBrace, lastBrace + 1);
    }

    try {
      parsedSRS = JSON.parse(cleanOutput);
    } catch (primaryError) {
      console.warn("[AI Service] Initial JSON parse failed, attempting secondary fix for bad escapes...");

      // Secondary Fix: Handle unescaped backslashes that aren't valid JSON escapes
      // Valid JSON escapes: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
      // We look for a backslash that is NOT followed by any of those and escape it.
      // This is a common AI error especially in Mermaid/diagram strings.
      let fixedOutput = cleanOutput.replace(/\\(?!(["\\/bfnrt]|u[0-9a-fA-F]{4}))/g, "\\\\");

      // Also handle cases where AI might have literal newlines inside strings 
      // This is harder to fix with regex without breaking structure, but we can try to fix the most common.

      parsedSRS = JSON.parse(fixedOutput);
      console.log("[AI Service] Secondary parse SUCCESS after manual escaping.");
    }
  } catch (parseError) {
    console.error("[AI Service] JSON Final Parse Error:", parseError.message);
    console.error("[AI Service] Raw Output Snippet:", output.substring(0, 500));
    return {
      success: false,
      error: `Invalid JSON from model (Error: ${parseError.message}). The AI might have struggled with the complexity of the request or generated invalid escape sequences.`,
      raw: output
    };
  }

  return {
    success: true, // Standardize success flag
    srs: parsedSRS,
    meta: {
      promptVersion: systemPrompt ? "task-specific" : promptVersion,
      modelProvider,
      modelName
    }
  };
}

export async function repairDiagram(code, error, settings = {}) {
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

Return ONLY the corrected code.
`;

  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(finalPrompt);

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
