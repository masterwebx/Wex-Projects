/**
 * AMT RPT Mock Exam categories — tuned for weak-area tracking.
 *
 * Procedure        — venipuncture/capillary technique & patient care during draws
 * Blood issue      — hematoma, veins, bleeding, specimen quality
 * Vial Info        — tubes, additives, colors, draw order, blood specimen handling
 * Specimen collection — urine, sputum, CSF, cultures, non-blood fluids
 * Communication    — patient interaction, empathy, professionalism
 * Safety & Legal   — OSHA, HIPAA, infection control, legal/ethics, office workflow
 * Medical knowledge — anatomy, body systems, terminology
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'app/src/data/amt-rpt-mock-exam.json');
const questions = JSON.parse(readFileSync(path, 'utf8'));

const P = 'Procedure';
const B = 'Blood issue';
const V = 'Vial Info';
const S = 'Specimen collection';
const C = 'Communication';
const L = 'Safety & Legal';
const M = 'Medical knowledge';

/** @type {Record<number, string>} */
const byNumber = {
  // Q1–19 (from scan markings)
  1: P, 2: P, 3: B, 4: B, 5: P, 6: V, 7: P, 8: V, 9: V,
  10: V, 11: P, 12: V, 13: B, 14: P, 15: P, 16: V, 17: B, 18: V, 19: P,
  // Q20–49
  20: P, 21: V, 22: P, 23: P, 24: P, 25: B, 26: P, 27: P, 28: P, 29: V,
  30: P, 31: V, 32: P, 33: P, 34: P, 35: V, 36: P, 37: V, 38: P, 39: P,
  40: V, 41: P, 42: P, 43: P, 44: B, 45: P, 46: P, 47: V, 48: P, 49: P,
  // Q50–89
  50: P, 51: V, 52: P, 53: V, 54: V, 55: P, 56: B, 57: B, 58: V, 59: V,
  60: P, 61: V, 62: V, 63: B, 64: V, 65: P, 66: B, 67: V, 68: V, 69: P,
  70: P, 71: B, 72: B, 73: B, 74: B, 75: S, 76: P, 77: P, 78: V, 79: P,
  80: B, 81: B, 82: P, 83: V, 84: S, 85: V, 86: S, 87: S, 88: S, 89: S,
  // Q90–115
  90: S, 91: V, 92: V, 93: S, 94: S, 95: S, 96: B, 97: B, 98: S, 99: V,
  100: S, 101: V, 102: V, 103: S, 104: S, 105: S, 106: V, 107: V, 108: V, 109: V,
  110: S, 111: P, 112: B, 113: V, 114: P, 115: P,
  // Q116–138 Communication
  116: C, 117: C, 118: C, 119: C, 120: C, 121: C, 122: C, 123: C, 124: C, 125: C,
  126: C, 127: C, 128: C, 129: C, 130: C, 131: C, 132: C, 133: C, 134: C, 135: C,
  136: C, 137: C, 138: C,
  // Q139–181 Safety & Legal
  139: L, 140: L, 141: L, 142: L, 143: L, 144: L, 145: L, 146: L, 147: L, 148: L,
  149: L, 150: L, 151: L, 152: L, 153: L, 154: L, 155: L, 156: L, 157: L, 158: L,
  159: L, 160: L, 161: L, 162: L, 163: L, 164: L, 165: L, 166: L, 167: L, 168: L,
  169: L, 170: L, 171: L, 172: L, 173: L, 174: L, 175: L, 176: L, 177: L, 178: L,
  179: L, 180: L, 181: L,
  // Q182–210 Medical knowledge
  182: M, 183: M, 184: M, 185: M, 186: M, 187: M, 188: M, 189: M, 190: M, 191: M,
  192: M, 193: M, 194: M, 195: M, 196: M, 197: M, 198: M, 199: M, 200: M, 201: M,
  202: M, 203: M, 204: M, 205: M, 206: M, 207: M, 208: M, 209: M, 210: M,
};

for (const q of questions) {
  q.category = byNumber[q.number] || q.category || '';
}

const counts = {};
for (const q of questions) {
  counts[q.category] = (counts[q.category] || 0) + 1;
}

const empty = questions.filter((q) => !q.category);
if (empty.length) {
  console.error('Uncategorized:', empty.map((q) => q.number));
  process.exit(1);
}

writeFileSync(path, JSON.stringify(questions, null, 2));
console.log('Categories assigned:', counts);
