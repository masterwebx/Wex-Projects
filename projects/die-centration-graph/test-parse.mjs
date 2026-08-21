import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const vba = fs.readFileSync(path.join(dir, 'CopyForGraph.bas'), 'utf8');
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

assert.doesNotMatch(vba, /Item # must be filled in/);
assert.match(vba, /densMin=/);
assert.match(vba, /cellMd=/);
assert.match(vba, /width=/);

assert.match(html, /data-screen="welcome"/);
assert.match(html, /Paste from clipboard/);
assert.match(html, /Enter results/);
assert.match(html, /id="histTable"/);
assert.match(html, /Clear filters/);
assert.match(html, /data-view/);
assert.match(html, /Back to history/);
assert.match(html, /SPC mode/);
assert.match(html, /Cell count MD/);
assert.match(html, /Density/);
assert.match(html, /Width/);
assert.match(html, /function drawSpc/);
assert.match(html, /function clearClipboard/);
assert.match(html, /navigator\.clipboard\.writeText\(''\)/);
assert.match(html, /id="dateYear"/);
assert.match(html, /id="dateMonth"/);
assert.match(html, /id="dateDay"/);
assert.match(html, /Sort A to Z/);
assert.match(html, /Sort smallest to largest/);
assert.match(html, /id="spcBy"/);
assert.match(html, /id="spcValue"/);
assert.match(html, /id="spcFrom"/);
assert.match(html, /id="spcTo"/);
assert.match(html, /id="spcOutliers"/);
assert.match(html, /Show outliers/);
assert.match(html, /spcHideOutliers = true/);
assert.match(html, /function extremeFences/);
assert.match(html, /function indexHistory/);
assert.match(html, /function renderHistoryBody/);
assert.match(html, /id="welcomeSpc"/);
assert.match(html, /id="histSpc"/);
assert.match(html, /id="modeBtn"/);
assert.doesNotMatch(html, /id="modeBtn"[^>]*hidden/);
assert.match(html, /option value="mspec"/);
assert.match(html, /navigator\.clipboard\.readText/);
assert.match(html, /id="progressOverlay"/);
assert.match(html, /id="prevResult"/);
assert.match(html, /id="nextResult"/);
assert.match(html, /id="viewMeta"/);
assert.match(html, /Density min/);
assert.match(html, /Width min/);
assert.match(html, /Cell count min/);
assert.match(html, /Target thickness/);
assert.match(html, /function axisRange/);
assert.match(html, /function valuesForFilter/);
assert.match(html, /enterMode/);
assert.match(html, /tone-\$\{/);
assert.match(html, /specLine\(specMin/);
assert.match(html, /'Min'/);
assert.match(html, /results-only/);
assert.doesNotMatch(html, /id="checks"/);

assert.equal(parseRangeSpec('6'), 0.006);
assert.ok(!/^DIEGRAPH\b/i.test('DIEGRAPH2'));
assert.ok(/^DIEGRAPH2\b/i.test('DIEGRAPH2\n[CURRENT]'));

const sections = splitDieGraph2(payload);
const lookup = parseTsv(sections.LOOKUP);
const table = parseTsv(sections.TABLES4);
assert.ok(lookup.headers.includes('Density Min'));
assert.ok(lookup.headers.includes('Cell Count Min'));
assert.ok(table.headers.includes('Slit/Width'));
assert.ok(table.headers.includes('Density'));
assert.ok(table.headers.includes('Cell Count MD'));
assert.equal(table.rows.length, 4);

const first = table.rows[0];
assert.ok(parseFloat(col(first, 'Density')) === 0 || parseFloat(col(first, 'Density')) >= 0);
assert.ok(col(first, 'Cell Count MD'));
assert.ok(col(first, 'Slit/Width'));

const tvals = [];
let inPoints = false;
for (const raw of sections.CURRENT) {
  const line = String(raw || '').trim();
  const m = line.match(/^([A-Za-z][A-Za-z0-9]*)\s*=\s*(.*)$/);
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

const dated = table.rows.map((row, idx) => ({ row, idx }))
  .sort((a, b) => parseFloat(col(b.row, 'Date/Time')) - parseFloat(col(a.row, 'Date/Time')));
assert.ok(parseFloat(col(dated[0].row, 'Date/Time')) >= parseFloat(col(dated[dated.length - 1].row, 'Date/Time')));

function extremeFences(values) {
  const s = values.filter(v => isFinite(v)).slice().sort((a, b) => a - b);
  if (s.length < 4) return { lo: -Infinity, hi: Infinity };
  const at = p => {
    const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
    return s[lo] + (s[hi] - s[lo]) * (i - lo);
  };
  const iqr = at(0.75) - at(0.25);
  return { lo: at(0.25) - 3 * iqr, hi: at(0.75) + 3 * iqr };
}
const fences = extremeFences([1, 2, 2, 3, 3, 3, 4, 100]);
assert.ok(100 > fences.hi);
assert.ok(3 < fences.hi);

console.log('parse-diegraph tests passed');
