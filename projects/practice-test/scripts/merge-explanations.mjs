/**
 * Merge explanation sidecar files into amt-rpt-mock-exam.json
 * Usage: node scripts/merge-explanations.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const examPath = join(root, 'app/src/data/amt-rpt-mock-exam.json');

const exam = JSON.parse(readFileSync(examPath, 'utf8'));
const sidecars = [
  'app/src/data/explanations-1-70.json',
  'app/src/data/explanations-71-140.json',
  'app/src/data/explanations-141-210.json',
];

const byNumber = new Map();
for (const rel of sidecars) {
  try {
    const data = JSON.parse(readFileSync(join(root, rel), 'utf8'));
    for (const [num, text] of Object.entries(data)) {
      byNumber.set(Number(num), String(text).trim());
    }
  } catch (err) {
    console.warn(`Skipping ${rel}: ${err.message}`);
  }
}

let merged = 0;
for (const q of exam) {
  const exp = byNumber.get(q.number);
  if (exp) {
    q.explanation = exp;
    merged++;
  }
}

writeFileSync(examPath, JSON.stringify(exam, null, 2) + '\n', 'utf8');
console.log(`Merged ${merged} explanations into ${exam.length} questions.`);
