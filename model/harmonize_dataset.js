import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Load env from backend
const backendEnvPath = path.resolve(process.cwd(), '../backend/.env');
dotenv.config({ path: backendEnvPath });

// Fetch keys: Either a single key or a comma-separated list
const keysString = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
if (!keysString) {
    console.error("❌ GEMINI_API_KEY or GEMINI_API_KEYS missing in backend/.env");
    process.exit(1);
}

// Split and clean the keys
const apiKeys = keysString.split(',').map(k => k.trim()).filter(k => k.length > 0);
let currentKeyIndex = 0;

console.log(`🔑 Loaded ${apiKeys.length} Gemini API Key(s) for load balancing.`);

function getNextModel() {
    const key = apiKeys[currentKeyIndex];
    // Rotate index
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    const genAI = new GoogleGenerativeAI(key);
    return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

const INPUT_FILE = './pure_raw_dataset.json';
const OUTPUT_FILE = './golden_training_dataset.jsonl';

import { generate as generateMasterPrompt } from '../backend/src/utils/versions/v1_1_0.js';

async function harmonize(text, filename) {
    // Attempt to extract a project name from the text for governance
    let projectName = filename.replace(/\.(pdf|html|htm|doc|docx)$/i, '').replace(/[\d\-\s]+/, '').trim();
    if (!projectName) projectName = "Legacy-Project";

    // Generate the professional SRA Master Prompt
    const masterPrompt = await generateMasterPrompt({
        projectName,
        depth: 5, // Maximum detail for training data
        strictness: 1 // High creativity for synthetic expansion
    });

    const finalPrompt = `
${masterPrompt}

ACT AS A TEACHER: 
Your objective is to ingest the following RAW ARCHIVE TEXT and map it into the "srs_json" structure defined in the instructions above. 
If the text is missing any IEEE section (e.g. Non-Functional Requirements), you MUST synthesize high-quality alternatives based on the project's domain.

================================================================
RAW ARCHIVE TEXT (Source: ${filename}):
================================================================
${text.slice(0, 32000)}
`;

    try {
        const model = getNextModel();
        const result = await model.generateContent(finalPrompt);
        const response = await result.response;
        let jsonText = response.text().trim();

        // Robust JSON extraction: Find the first '{' and the last '}'
        const firstBrace = jsonText.indexOf('{');
        const lastBrace = jsonText.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1) {
            jsonText = jsonText.substring(firstBrace, lastBrace + 1);
        }

        try {
            return JSON.parse(jsonText);
        } catch (parseError) {
            console.error(`❌ JSON Syntax Error in ${filename}: ${parseError.message}`);
            return { sra_error: "SYNTAX_ERROR", details: parseError.message };
        }
    } catch (error) {
        console.error(`❌ API Error for ${filename}:`, error.message);
        if (error.message.includes("429") || error.message.includes("Too Many Requests") || error.message.includes("quota")) {
            return { sra_error: "API_ERROR" };
        }
        return { sra_error: "FATAL_ERROR", details: error.message };
    }
}

async function main() {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error("Input file not found!");
        return;
    }

    const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

    // Resume Logic: Read existing output to see what's done
    const processedFiles = new Set();
    if (fs.existsSync(OUTPUT_FILE)) {
        const lines = fs.readFileSync(OUTPUT_FILE, 'utf-8').split('\n');
        for (const line of lines) {
            if (line.trim()) {
                try {
                    const entry = JSON.parse(line);
                    processedFiles.add(entry.source);
                } catch (e) { /* ignore */ }
            }
        }
    }

    const limit = process.argv.includes('--limit') ? parseInt(process.argv[process.argv.indexOf('--limit') + 1]) : Infinity;
    let count = 0;

    console.log(`🚀 Starting harmonization for ${data.length} documents... (${processedFiles.size} already processed)`);

    const stream = fs.createWriteStream(OUTPUT_FILE, { flags: 'a' });

    for (let i = 0; i < data.length && count < limit; i++) {
        const entry = data[i];

        if (processedFiles.has(entry.source_file)) {
            console.log(`[${i + 1}/${data.length}] Skipping ${entry.source_file} (Already done)`);
            continue;
        }

        console.log(`[${i + 1}/${data.length}] Processing ${entry.source_file}...`);

        const harmonized = await harmonize(entry.raw_text, entry.source_file);

        if (harmonized && !harmonized.sra_error) {
            const outputEntry = {
                source: entry.source_file,
                srs_json: harmonized
            };
            stream.write(JSON.stringify(outputEntry) + '\n');
            console.log(`✅ Finished ${entry.source_file}`);
            count++;

            // Respect API limit spacing
            await new Promise(resolve => setTimeout(resolve, 4000));
        } else if (harmonized && harmonized.sra_error === "SYNTAX_ERROR") {
            console.log(`⚠️  SKIPPING ${entry.source_file} due to JSON Syntax Error. (Will be retried next run)`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
            console.log(`❌ FAILED at [${i + 1}/${data.length}]: ${entry.source_file}`);
            console.log(`📊 Stop Index: ${i}`);
            console.log("🛑 API Limit hit (Quota 429). Please rotate your key in backend/.env.");
            console.log("💡 TIP: The next time you run this, it will automatically resume from this exact document.");
            break;
        }
    }

    stream.end();
    console.log("\n✨ Harmonization script exited.");
}

main();
