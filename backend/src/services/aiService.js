import { getLatestVersion } from "../utils/promptRegistry.js";
import { constructMasterPrompt } from "../utils/prompts.js";
import { genAI } from "../config/gemini.js";

// ... imports remain the same

export async function analyzeText(text, settings = {}) {
  const {
    modelProvider = "google",
    modelName = "gemini-2.5-flash",
    promptVersion = getLatestVersion(),
    ...promptSettings
  } = settings;

  // Use versioned prompt
  const masterPrompt = constructMasterPrompt(promptSettings, promptVersion);

  const finalPrompt = `
${masterPrompt}

User Input:
${text}
`;

  let output;
  const maxAttempts = 3;
  const timeoutMs = 60000;

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

  // Parse JSON
  let parsedSRS;
  try {
    output = output.replace(/```json/g, "").replace(/```/g, "").trim();
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) output = jsonMatch[0];
    parsedSRS = JSON.parse(output);
  } catch (parseError) {
    return {
      success: false,
      error: "Invalid JSON from model",
      raw: output
    };
  }

  return {
    srs: parsedSRS,
    meta: {
      promptVersion,
      modelProvider,
      modelName
    }
  };
}
