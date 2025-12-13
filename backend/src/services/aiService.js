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

  try {
    console.log(`[AI Service] Using Provider: ${modelProvider}, Model: ${modelName}`);
    if (modelProvider === "openai") {
      const completion = await openai.chat.completions.create({
        messages: [{ role: "system", content: masterPrompt }, { role: "user", content: text }],
        model: modelName,
        temperature: 0.7,
      });
      output = completion.choices[0].message.content;
    } else {
      // Default to Google (Gemini)
      const model = genAI.getGenerativeModel({ model: modelName || "gemini-2.5-flash" });
      const result = await model.generateContent(finalPrompt);

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
  } catch (error) {
    return {
      success: false,
      error: `AI Service Error (${modelProvider})`,
      parseError: error.message,
      raw: "",
    };
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
