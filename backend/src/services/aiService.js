import { genAI } from "../config/gemini.js";
import OpenAI from "openai";
import { constructMasterPrompt } from "../utils/prompts.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeText(text, settings = {}) {
  const {
    modelProvider = "google", // 'google' or 'openai'
    modelName = "gemini-2.5-flash", // 'gemini-2.5-flash', 'gpt-4o', etc.
    ...promptSettings
  } = settings;

  const masterPrompt = constructMasterPrompt(promptSettings);
  const finalPrompt = `
${masterPrompt}

User Input:
${text}
`;

  let output;
  const maxAttempts = 3;
  const timeoutMs = 60000; // 60s timeout

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const callWithTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("AI Request Timeout")), ms))
  ]);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[AI Service] Using Provider: ${modelProvider}, Model: ${modelName} (Attempt ${attempt}/${maxAttempts})`);

      if (modelProvider === "openai") {
        const completion = await callWithTimeout(openai.chat.completions.create({
          messages: [{ role: "system", content: masterPrompt }, { role: "user", content: text }],
          model: modelName,
          temperature: 0.7,
        }), timeoutMs);
        output = completion.choices[0].message.content;
      } else {
        // Default to Google (Gemini)
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
      break; // Success, exit retry loop
    } catch (error) {
      const isRetryable = error.message.includes("429") || error.message.includes("503") || error.message.includes("Timeout");

      if (attempt === maxAttempts || !isRetryable) {
        return {
          success: false,
          error: `AI Service Error (${modelProvider}) - ${error.message}`,
          parseError: error.message,
          raw: "",
        };
      }

      console.warn(`[AI Service] Attempt ${attempt} failed: ${error.message}. Retrying in ${attempt * 2}s...`);
      await sleep(attempt * 2000);
    }
  }

  // Parse JSON safely and return a helpful structure on failure
  try {
    // Clean up markdown code blocks if present
    output = output.replace(/```json/g, "").replace(/```/g, "").trim();
    // Defensive: sometimes models add text before/after JSON
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      output = jsonMatch[0];
    }
    return JSON.parse(output);
  } catch (parseError) {
    return {
      success: false,
      error: "Invalid JSON from model",
      parseError: parseError.message,
      raw: output,
    };
  }
}
