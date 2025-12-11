import { genAI } from "../config/gemini.js";
import { MASTER_PROMPT } from "../utils/prompts.js";

export async function analyzeText(text) {
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
${MASTER_PROMPT}

User Input:
${text}
`;

  const result = await model.generateContent(prompt);

  // Defensive extraction of the textual output from the model response
  let output;
  try {
    if (result && result.response && typeof result.response.text === "function") {
      output = await result.response.text();
    } else if (result && result.candidates && result.candidates[0]) {
      // common SDK shapes sometimes put the text under candidates[0].content or .output
      output = result.candidates[0].content || result.candidates[0].output || JSON.stringify(result.candidates[0]);
    } else if (typeof result === "string") {
      output = result;
    } else {
      output = JSON.stringify(result);
    }
  } catch (extractionError) {
    output = JSON.stringify(result);
  }

  // Parse JSON safely and return a helpful structure on failure
  try {
    // Clean up markdown code blocks if present
    output = output.replace(/```json/g, "").replace(/```/g, "").trim();
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
