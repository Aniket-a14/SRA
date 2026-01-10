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
      if (process.env.MOCK_AI === 'true') {
        console.log("[AI Service] MOCK MODE ACTIVE. Returning dummy response.");
        await sleep(500); // Simulate latency
        output = JSON.stringify({
          projectTitle: "Unified Mock Project",
          revisionHistory: [{ version: "1.0", date: "2024-01-01", description: "Mock", author: "AI" }],
          introduction: {
            purpose: "Mock Purpose derived from Unified Input.",
            documentConventions: "IEEE",
            intendedAudience: "Testers",
            productScope: "Mock Scope",
            references: []
          },
          overallDescription: {
            productPerspective: "Mock Perspective",
            productFunctions: ["Mock Function 1"],
            userClassesAndCharacteristics: [{ userClass: "Mock User", characteristics: "Mock" }],
            operatingEnvironment: "Mock Env",
            designAndImplementationConstraints: [],
            userDocumentation: [],
            assumptionsAndDependencies: []
          },
          externalInterfaceRequirements: {
            userInterfaces: "Mock UI",
            hardwareInterfaces: "N/A",
            softwareInterfaces: "N/A",
            communicationsInterfaces: "Mock Comm"
          },
          systemFeatures: [
            {
              name: "Post Scheduling",
              description: "Allows scheduling posts.",
              stimulusResponseSequences: ["Stimulus: Schedule -> Response: Scheduled"],
              functionalRequirements: ["The system shall schedule posts."]
            },
            {
              name: "Analytics",
              description: "View stats.",
              stimulusResponseSequences: ["Stimulus: View -> Response: Stats shown"],
              functionalRequirements: ["The system shall show stats."]
            }
          ],
          nonFunctionalRequirements: {
            performanceRequirements: [],
            safetyRequirements: [],
            securityRequirements: ["OAuth2"],
            softwareQualityAttributes: [],
            businessRules: []
          },
          otherRequirements: [],
          glossary: [],
          appendices: { analysisModels: { tbdList: [] } }
        });
        break;
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
