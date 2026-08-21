import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const vba = fs.readFileSync(path.join(dir, 'CopyForGraph.bas'), 'utf8');
const vbaS1 = fs.readFileSync(path.join(dir, 'CopyForGraphS1S3.bas'), 'utf8');
const vbaFromS4 = fs.readFileSync(path.join(dir, 'CopyForGraphFromS4.bas'), 'utf8');
const vbaFromS1 = fs.readFileSync(path.join(dir, 'CopyForGraphFromS1S3.bas'), 'utf8');
const payload = fs.readFileSync(path.join(dir, 'fixtures/sample-diegraph2.txt'), 'utf8');
const payloadS1 = fs.readFileSync(path.join(dir, 'fixtures/sample-diegraph2-s1s3.txt'), 'utf8');

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
    const m = line.trim().match(/^\[(CURRENT|LOOKUP|TABLES4|TABLES1S3|HISTORY)\]$/i);
    if (m) {
      const name = m[1].toUpperCase();
      cur = (name === 'TABLES1S3' || name === 'HISTORY') ? 'TABLES4' : name;
      continue;
    }
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
assert.match(vba, /CopyForGraphS1S3\.bas/);
assert.match(vba, /OpenGraphHtml/);
assert.match(vba, /1 - Quality\\centration\.html/);
assert.match(vbaS1, /OpenGraphHtml/);
assert.match(vbaS1, /1 - Quality\\centration\.html/);

assert.match(vbaS1, /Attribute VB_Name = "CopyForGraphS1S3"/);
assert.match(vbaS1, /SheetByName\("S1 S3"\)/);
assert.match(vbaS1, /Data S1 S3/);
assert.match(vbaS1, /TableS1S3/);
assert.match(vbaS1, /source=S1S3/);
assert.match(vbaS1, /Range\("B14"\)/);
assert.match(vbaS1, /Range\("B12"\)/);
assert.match(vbaS1, /Range\("B10"\)/);
assert.doesNotMatch(vbaS1, /Data S4/);
assert.doesNotMatch(vbaS1, /SheetByName\("S4"\)/);

assert.match(vbaFromS4, /Attribute VB_Name = "CopyForGraphFromS4"/);
assert.match(vbaFromS4, /Files\\S4\.xlsm/);
assert.match(vbaFromS4, /FileCopy src, dest/);
assert.match(vbaFromS4, /Environ\$\("TEMP"\)/);
assert.match(vbaFromS4, /CopyWorkbookFile/);
assert.match(vbaFromS4, /AlreadyOpenWorkbook/);
assert.match(vbaFromS4, /openedByLauncher/);
assert.match(vbaFromS4, /Workbooks\.Open/);
assert.match(vbaFromS4, /w\.Visible = False/);
assert.match(vbaFromS4, /msoAutomationSecurityForceDisable/);
assert.match(vbaFromS4, /Function TargetWorkbook/);
assert.match(vbaFromS4, /TableS4/);
assert.match(vbaFromS4, /densMin=/);
assert.match(vbaFromS4, /PutTextOnClipboard/);
assert.match(vbaFromS4, /OpenGraphHtml/);
assert.match(vbaFromS4, /NOT into S4\.xlsm/);
assert.doesNotMatch(vbaFromS4, /Application\.Run/);
assert.doesNotMatch(vbaFromS4, /CopyForGraph\.CopyForGraph/);
assert.doesNotMatch(vbaFromS4, /Left\$\(src, i\)/);

assert.match(vbaFromS1, /Attribute VB_Name = "CopyForGraphFromS1S3"/);
assert.match(vbaFromS1, /Files\\S1 S3\.xlsm/);
assert.match(vbaFromS1, /FileCopy src, dest/);
assert.match(vbaFromS1, /Environ\$\("TEMP"\)/);
assert.match(vbaFromS1, /CopyWorkbookFile/);
assert.match(vbaFromS1, /AlreadyOpenWorkbook/);
assert.match(vbaFromS1, /CopyForGraphFromS1S3/);
assert.match(vbaFromS1, /TableS1S3/);
assert.match(vbaFromS1, /source=S1S3/);
assert.match(vbaFromS1, /Range\("B14"\)/);
assert.match(vbaFromS1, /msoAutomationSecurityForceDisable/);
assert.match(vbaFromS1, /NOT into S1 S3\.xlsm/);
assert.doesNotMatch(vbaFromS1, /Application\.Run/);
assert.doesNotMatch(vbaFromS1, /CopyForGraphS1S3\.CopyForGraph/);
assert.doesNotMatch(vbaFromS1, /Left\$\(src, i\)/);

assert.match(html, /data-screen="welcome"/);
assert.match(html, /S1 S3 quality check sheet/);
assert.match(html, /function currentSheetSourceLabel/);
assert.match(html, /TABLES1S3/);
assert.match(html, /Paste results/);
assert.match(html, /Enter points by hand/);
assert.match(html, /Paste more data/);
assert.match(html, /Go to main/);
assert.match(html, /id="welcomeHistory"/);
assert.doesNotMatch(html, /id="welcomeSpc"/);
assert.match(html, /APP_VERSION/);
assert.match(html, /function persistPack/);
assert.match(html, /function canonMspec/);
assert.match(html, /Lower Control/);
assert.match(html, /id="histTable"/);
assert.match(html, /Reset filters/);
assert.match(html, /id="filterBar"/);
assert.match(html, /id="histResetFilters"/);
assert.match(html, /function resetFilters/);
assert.match(html, /timeZone:\s*'UTC'/);
assert.match(html, /getUTCFullYear/);
assert.match(html, /excelSerialDate/);
assert.match(html, /isoToExcelSerial/);
assert.doesNotMatch(html, /id="histClearFilters"/);
assert.match(html, /data-view/);
assert.match(html, /Back to history/);
assert.match(html, /SPC mode/);
assert.match(html, /Cell count MD/);
assert.match(html, /Density/);
assert.match(html, /Width/);
assert.match(html, /HIST_COL_W/);
assert.match(html, /function applyHistColgroup/);
assert.match(html, /function syncHistHeaderGutter/);
assert.match(html, /function renderHistoryChrome/);
assert.doesNotMatch(html, /\bhistCount\b/);
assert.doesNotMatch(html, /\bupdateHistNav\b/);
assert.match(html, /rel="icon"/);
assert.match(html, /function redrawSpc/);
assert.match(html, /function fillSpcControls\(fromView\)/);
assert.match(html, /function spcPreferredFromView/);
assert.match(html, /function selectSpcPoint/);
assert.match(html, /function specsHaveValues/);
assert.match(html, /function syncPlotFromInputs/);
assert.match(html, /leavingSpc && screenName === 'view'/);
assert.match(html, /syncPlotFromInputs\(\);/);
assert.match(html, /keeping last specs/);
assert.match(html, /id="spcTip"/);
assert.match(html, /function showSpcTip/);
assert.match(html, /spcHits\.push\(\{ x: xx, y: yy, r: 10, idx: p\.idx, key, title, value: p\[key\], t: p\.t, unit \}\)/);
assert.doesNotMatch(html, /viewResult\(hit\.idx\);\s*setViewMode\('spc'\)/);
assert.match(html, /spcValue'\)\.oninput/);
assert.match(html, /spcFrom'\)\.oninput/);
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

const s1 = splitDieGraph2(payloadS1);
assert.match(payloadS1, /source=S1S3/);
assert.match(payloadS1, /\[TABLES1S3\]/);
const s1Lookup = parseTsv(s1.LOOKUP);
const s1Table = parseTsv(s1.TABLES4);
assert.equal(s1Table.rows.length, 2);
assert.equal(col(s1Table.rows[0], 'Line'), 'S3');
assert.equal(col(s1Table.rows[1], 'Line'), 'S1');
assert.equal(col(s1Table.rows[0], 'MSPEC'), '4003');
assert.equal(parseFloat(col(s1Table.rows[0], 'T1')), 0.252);
assert.equal(parseFloat(col(s1Table.rows[0], 'T13')), 0.258);
assert.equal(parseFloat(col(s1Table.rows[0], 'Thickness Average')), 0.25530769230769229);
assert.ok(s1Table.headers.includes('Tape Color'));
assert.ok(s1Table.headers.includes('Winder Tension'));
const s1Current = Object.fromEntries(s1.CURRENT.filter(l => l.includes('=')).map(l => {
  const i = l.indexOf('=');
  return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
}));
assert.equal(s1Current.item, '410805');
assert.equal(s1Current.mspec, '4003');
assert.equal(s1Current.line, 'S3');
assert.equal(parseFloat(s1Current.min), 0.24);
assert.equal(parseFloat(s1Current.max), 0.26);
const s14003 = s1Lookup.rows.find(r => String(col(r, 'MSPEC #')) === '4003');
assert.ok(s14003);
assert.equal(parseFloat(col(s14003, 'Lower Control')), 0.24);
assert.equal(parseFloat(col(s14003, 'Upper Control')), 0.26);

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

const m4780 = lookup.rows.find(r => String(col(r, 'MSPEC #')).replace(/\.0+$/, '') === '4780');
assert.ok(m4780);
assert.equal(parseFloat(col(m4780, 'Lower Control')), 0.505);
assert.equal(parseFloat(col(m4780, 'Upper Control')), 0.53);
assert.notEqual(parseFloat(col(m4780, 'Lower Control')), 0.032);
assert.notEqual(parseFloat(col(m4780, 'Upper Control')), 0.525);

const m4540 = lookup.rows.find(r => String(col(r, 'MSPEC #')).replace(/\.0+$/, '') === '4540');
assert.ok(m4540);
assert.equal(parseFloat(col(m4540, 'Lower Control')), 0.505);
assert.equal(parseFloat(col(m4540, 'Target')), 0.515);
assert.equal(parseFloat(col(m4540, 'Upper Control')), 0.53);
assert.notEqual(parseFloat(col(m4540, 'Upper Control')), 0.52);

const m4460 = lookup.rows.find(r => String(col(r, 'MSPEC #')).replace(/\.0+$/, '') === '4460');
assert.ok(m4460);
assert.equal(parseFloat(col(m4460, 'Upper Control')), 0.53);

const row3000 = {
  'MSPEC #': '3000', AF: 'AF500', 'Lower Control': '0.530', Target: '0.540',
  'Upper Control': '0.555', 'Thickness Range Max': '40', 'Cell Count Min': '18',
  'Cell Count Max': '24', 'Density Min': '1.55', 'Density Target': '1.6', 'Density Max': '1.65'
};
assert.equal(parseFloat(col(row3000, 'Lower Control')), 0.53);
assert.equal(parseFloat(col(row3000, 'Density Min')), 1.55);
assert.match(html, /'Item'/);
assert.match(html, /'Width'/);
assert.match(vba, /Master Sheet/);
assert.match(vba, /Table7/);
assert.match(vba, /LookupTableTsv/);
assert.match(vba, /LinkSources/);
assert.match(vba, /\[1\]Master Sheet/);
assert.match(vba, /LinkedMasterSheetToTsv/);
assert.match(vba, /Quality AIO/);

assert.match(html, /dieGraphPack\.v2/);
assert.match(html, /id="specSource"/);
assert.match(html, /Master Sheet MSPEC/);
assert.doesNotMatch(html, /Object\.assign\(\{\}, historyPack\.lookupByMspec/);
assert.match(html, /if \(!lookupRows\.length && historyPack && historyPack\.lookupRows\)/);

function canonMspec(v) {
  let s = String(v ?? '').trim();
  if (!s || s[0] === '#') return '';
  s = s.replace(/,/g, '');
  const n = parseFloat(s);
  if (isFinite(n) && /^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) {
    if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
    return String(n);
  }
  return s.replace(/\.0+$/, '').toUpperCase();
}
assert.equal(canonMspec('3000.0'), '3000');
assert.equal(canonMspec('4780'), '4780');
assert.equal(canonMspec('#N/A'), '');
assert.equal(canonMspec('4540.0'), '4540');

function buildLookupMap(rows) {
  const map = {};
  for (const row of rows || []) {
    const raw = String(col(row, 'MSPEC #', 'MSPEC') || '').trim();
    const key = canonMspec(raw);
    if (!key || map[key]) continue;
    map[key] = row;
    if (raw && raw !== key) map[raw] = row;
    if (/^\d+$/.test(key)) map[key + '.0'] = row;
  }
  return map;
}
const map = buildLookupMap(lookup.rows);
assert.equal(parseFloat(col(map['4540'], 'Upper Control')), 0.53);
assert.equal(parseFloat(col(map['4540.0'], 'Upper Control')), 0.53);
assert.equal(parseFloat(col(map[canonMspec('4540.0')], 'Upper Control')), 0.53);

const dupes = [
  { 'MSPEC #': '4540', 'Lower Control': '0.505', Target: '0.515', 'Upper Control': '0.53' },
  { 'MSPEC #': '4540.0', 'Lower Control': '0.505', Target: '0.515', 'Upper Control': '0.52' }
];
const firstWins = buildLookupMap(dupes);
const colW = html.match(/const HIST_COL_W = \[([^\]]+)\]/);
assert.ok(colW);
assert.equal(colW[1].split(',').length, 15);

function excelSerialDate(n) {
  return new Date(Math.round((Number(n) - 25569) * 86400000));
}
function excelWhen(v) {
  const n = parseFloat(v);
  const d = excelSerialDate(n);
  return d.toLocaleString('en-US', { timeZone: 'UTC' });
}
const nineTwentyFour = 25569 + 9 / 24 + 24 / (24 * 60);
const shown = excelWhen(nineTwentyFour);
assert.match(shown, /9:24/);
assert.doesNotMatch(shown, /2:24/);
const d924 = excelSerialDate(nineTwentyFour);
assert.equal(d924.getUTCHours(), 9);
assert.equal(d924.getUTCMinutes(), 24);
const sampleWhen = parseFloat(col(table.rows[3], 'Date/Time'));
const sampleDt = excelSerialDate(sampleWhen);
assert.equal(sampleDt.getUTCFullYear(), 2026);
assert.equal(sampleDt.getUTCHours(), Math.floor((sampleWhen - Math.floor(sampleWhen)) * 24 + 1e-9));

const declaredIds = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]));
const missingIds = [];
for (const m of html.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) {
  if (!declaredIds.has(m[1])) missingIds.push(m[1]);
}
assert.deepEqual(missingIds, [], `getElementById missing in markup: ${missingIds.join(', ')}`);

const script = html.match(/<script>([\s\S]*)<\/script>/);
assert.ok(script, 'inline script present');
const tmpJs = path.join(dir, '.script-check.js');
fs.writeFileSync(tmpJs, script[1]);
const check = spawnSync(process.execPath, ['--check', tmpJs], { encoding: 'utf8' });
fs.unlinkSync(tmpJs);
assert.equal(check.status, 0, check.stderr || check.stdout);

console.log('parse-diegraph tests passed');
