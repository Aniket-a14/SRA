import fs from 'fs';
import path from 'path';

const inputPath = 'golden_training_dataset.jsonl';
const trainPath = 'train_sft.jsonl';
const testPath = 'test_sft.jsonl';

const content = fs.readFileSync(inputPath, 'utf-8');
const lines = content.split('\n').filter(l => l.trim());

const trainLines = lines.slice(0, 69);
const testLines = lines.slice(69);

fs.writeFileSync(trainPath, trainLines.join('\n') + '\n');
fs.writeFileSync(testPath, testLines.join('\n') + '\n');

console.log(`Split complete: ${trainLines.length} train, ${testLines.length} test.`);
