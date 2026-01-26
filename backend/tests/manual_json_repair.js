
// Standalone verification for JSON repair logic
// This mimics the logic added to aiService.js

function repairJson(output) {
    let cleanOutput = output.replace(/```json/g, "").replace(/```/g, "").trim();

    const firstBrace = cleanOutput.indexOf('{');
    const lastBrace = cleanOutput.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanOutput = cleanOutput.substring(firstBrace, lastBrace + 1);
    }

    // 3. Advanced Cleaning
    cleanOutput = cleanOutput
        .replace(/\/\*[\s\S]*?\*\//g, "") // Block comments
        .replace(/\/\/.*$/gm, "");         // Line comments

    // 4. Remove Trailing Commas
    cleanOutput = cleanOutput.replace(/,\s*}/g, "}").replace(/,\s*\]/g, "]");

    // Secondary Fix: Bad escapes
    const fixedOutput = cleanOutput.replace(/\\(?!(["\\/bfnrt]|u[0-9a-fA-F]{4}))/g, "\\\\");

    return fixedOutput;
}

const testCases = [
    {
        name: "Clean JSON",
        input: '{"key": "value"}',
        expected: '{"key": "value"}'
    },
    {
        name: "Markdown Blocks",
        input: '```json\n{"key": "value"}\n```',
        expected: '{"key": "value"}'
    },
    {
        name: "Line Comments",
        input: '{\n "key": "value", // comment\n "n": 1\n}',
        expected: '{\n "key": "value", \n "n": 1\n}'
    },
    {
        name: "Block Comments",
        input: '{\n "key": "value" /* comment */\n}',
        expected: '{\n "key": "value" \n}'
    },
    {
        name: "Trailing Comma Object",
        input: '{"key": "value", }',
        expected: '{"key": "value"}'
    },
    {
        name: "Trailing Comma Array",
        input: '{"list": [1, 2, ]}',
        expected: '{"list": [1, 2]}'
    },
    {
        name: "Bad Backslash",
        input: '{"path": "C:\\Program Files"}', // Input has ONE backslash
        expected: '{"path": "C:\\\\Program Files"}'
    }
];

let failed = false;
console.log("Running JSON Repair Verification...");

testCases.forEach(test => {
    try {
        const repaired = repairJson(test.input);
        // Verify it parses
        const parsed = JSON.parse(repaired);
        console.log(`[PASS] ${test.name}`);
    } catch (e) {
        console.error(`[FAIL] ${test.name}`);
        console.error(`Input:    ${test.input}`);
        console.error(`Repaired: ${repairJson(test.input)}`);
        console.error(`Error:    ${e.message}`);
        failed = true;
    }
});

if (failed) {
    console.log("\n❌ logical verification FAILED");
    process.exit(1);
} else {
    console.log("\n✅ logical verification PASSED");
    process.exit(0);
}
