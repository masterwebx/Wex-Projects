import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const payload = fs.readFileSync(path.join(dir, 'fixtures/sample-diegraph2.txt'), 'utf8');

function parseRangeSpec(raw) {
  const n = parseFloat(raw); if (!isFinite(n)) return NaN;
  return Math.abs(n) >= 1 ? n / 1000 : n;
}
function parseTsv(lines) {
  const nonempty = lines.map(s => String(s ?? '').replace(/\r/g, '')).filter(l => l.length);
  if (!nonempty.length) return { headers: [], rows: [] };
  const headers = nonempty[0].split('\t').map(s => s.trim());
  const rows = [];
  for (let i = 1; i < nonempty.length; i++) {
    const parts = nonempty[i].split('\t');
    const obj = {};
    headers.forEach((h, j) => { obj[h] = parts[j] == null ? '' : parts[j]; });
    rows.push(obj);
  }
  return { headers, rows };
}
function splitDieGraph2(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const sections = { CURRENT: [], LOOKUP: [], TABLES4: [] };
  let cur = null;
  for (const line of lines.slice(1)) {
    const m = line.trim().match(/^\[(CURRENT|LOOKUP|TABLES4)\]$/i);
    if (m) { cur = m[1].toUpperCase(); continue; }
    if (cur) sections[cur].push(line);
  }
  return sections;
}
function col(row, ...names) {
  if (!row) return '';
  for (const n of names) {
    if (row[n] != null && String(row[n]).trim() !== '') return row[n];
  }
  return '';
}

assert.match(html, /DIEGRAPH2/);
assert.match(html, /id="histItem"/);
assert.match(html, /id="histRecord"/);
assert.match(html, /function clearClipboard/);
assert.match(html, /navigator\.clipboard\.writeText\(''\)/);
assert.match(html, /\^DIEGRAPH\\b/);

assert.equal(parseRangeSpec('6'), 0.006);
assert.equal(parseRangeSpec('0.025'), 0.025);
assert.ok(!/^DIEGRAPH\b/i.test('DIEGRAPH2'));
assert.ok(/^DIEGRAPH2\b/i.test('DIEGRAPH2\n[CURRENT]'));

const sections = splitDieGraph2(payload);
assert.ok(sections.CURRENT.some(l => l.startsWith('item=3030053')));
const lookup = parseTsv(sections.LOOKUP);
const table = parseTsv(sections.TABLES4);
assert.ok(lookup.headers.includes('MSPEC #'));
assert.ok(lookup.headers.includes('Lower Control'));
assert.ok(lookup.headers.includes('Thickness Range Max'));
assert.ok(table.headers.includes('Item #'));
assert.ok(table.headers.includes('T1'));
assert.ok(table.headers.includes('T13'));
assert.equal(table.rows.length, 4);

const row4010 = lookup.rows.find(r => col(r, 'MSPEC #') === '4010');
assert.ok(row4010, 'lookup contains MSPEC 4010');
assert.equal(parseFloat(col(row4010, 'Lower Control')), 0.032);
assert.equal(parseFloat(col(row4010, 'Target')), 0.035);
assert.equal(parseFloat(col(row4010, 'Upper Control')), 0.038);
assert.equal(parseRangeSpec(col(row4010, 'Thickness Range Max')), 0.006);

const first = table.rows[0];
assert.equal(col(first, 'Item #'), '3030053');
assert.ok(parseFloat(col(first, 'T1')) > 0.5);
const items = [...new Set(table.rows.map(r => col(r, 'Item #')))];
assert.ok(items.includes('3030053'));
assert.ok(items.includes('3030058'));

const tvals = [];
let inPoints = false;
for (const raw of sections.CURRENT) {
  const line = String(raw || '').trim();
  const m = line.match(/^(min|max|range|target|item|mspec)\s*=\s*(.*)$/i);
  if (m && !inPoints) continue;
  if (!line && !inPoints) continue;
  inPoints = true;
  if (!line) { tvals.push(''); continue; }
  const num = parseFloat(line);
  tvals.push(isFinite(num) ? num : '');
}
assert.equal(tvals[0], 0.5307);
assert.equal(tvals[3], '');
assert.equal(tvals[4], 0.5171);

console.log('parse-diegraph tests passed');
console.log(`lookup rows=${lookup.rows.length} table rows=${table.rows.length} items=${items.join(',')}`);
