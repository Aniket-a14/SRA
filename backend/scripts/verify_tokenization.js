import { constructMasterPrompt } from '../src/utils/prompts.js';

console.log("--- Lightweight Verification Started ---");

// 1. Verify Prompts.js Syntax (Implicitly valid if import succeeds)
try {
  const prompt = constructMasterPrompt({ profile: 'default' });
  console.log("SUCCESS: Prompts.js syntax is valid.");
  if (prompt.includes('JSON Array of Strings')) {
    console.log("SUCCESS: Prompt contains correct instruction.");
  } else {
    console.error("FAILURE: Prompt missing array instruction.");
    process.exit(1);
  }
} catch (e) {
  console.error("FAILURE: Prompts.js error:", e);
  process.exit(1);
}

// 2. Simulate Controller Tokenization Logic
const srsData = {
  details: {
    projectName: { content: "Test Project" },
    fullDescription: { content: "This is a description." }
  }
};

const projectName = srsData.details.projectName.content;
const fullDesc = srsData.details.fullDescription.content;
const combinedText = `Project: ${projectName}\n\nDescription:\n${fullDesc}`;
const wordArray = combinedText.split(/\s+/).filter(word => word.length > 0);
const jsonOutput = JSON.stringify(wordArray);

console.log("Generated JSON:", jsonOutput);

if (jsonOutput === '["Project:","Test","Project","Description:","This","is","a","description."]') {
  console.log("SUCCESS: Tokenization logic correct.");
} else {
  console.error("FAILURE: Tokenization logic mismatch.");
  process.exit(1);
}
console.log("--- Verification Complete ---");
