// Helper: reads temp_record.json and appends it as a single line to golden_training_dataset.jsonl
const fs = require('fs');
const raw = fs.readFileSync('temp_record.json', 'utf8');
// Remove BOM and any trailing whitespace/garbage
const cleaned = raw.replace(/^\uFEFF/, '').trim();
const record = JSON.parse(cleaned);
const line = JSON.stringify(record);
fs.appendFileSync('golden_training_dataset.jsonl', '\n' + line);
console.log('Appended record for: ' + record.source + ' (' + line.length + ' chars)');
