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
  let headerIdx = 0;
  for (let i = 0; i < Math.min(nonempty.length, 8); i++) {
    const heads = nonempty[i].split('\t').map(s => s.trim());
    if (heads.some(h => /^(mspec#?|mspec)$/i.test(String(h).replace(/\s+/g, '')) || /^mspec\s*#?$/i.test(h))) {
      headerIdx = i;
      break;
    }
  }
  const headers = nonempty[headerIdx].split('\t').map(s => s.trim());
  const rows = [];
  for (let i = headerIdx + 1; i < nonempty.length; i++) {
    const parts = nonempty[i].split('\t');
    const obj = {};
    headers.forEach((h, j) => { if (h) obj[h] = parts[j] == null ? '' : parts[j]; });
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

assert.match(vbaFromS1, /Attribute VB_Name = "CopyForGraphFromS1S3"/);
assert.match(vbaFromS1, /Files\\S1 S3\.xlsm/);
assert.match(vbaFromS1, /FileCopy src, dest/);
assert.match(vbaFromS1, /CopyForGraphFromS1S3/);
assert.match(vbaFromS1, /TableS1S3/);
assert.match(vbaFromS1, /source=S1S3/);
assert.match(vbaFromS1, /Range\("B14"\)/);
assert.match(vbaFromS1, /msoAutomationSecurityForceDisable/);
assert.match(vbaFromS1, /NOT into S1 S3\.xlsm/);
assert.doesNotMatch(vbaFromS1, /Application\.Run/);
assert.doesNotMatch(vbaFromS1, /CopyForGraphS1S3\.CopyForGraph/);

assert.match(html, /data-screen="welcome"/);
assert.match(html, /S1 S3 quality check sheet/);
assert.match(html, /function currentSheetSourceLabel/);
assert.match(html, /TABLES1S3/);
assert.match(html, /Paste results/);
assert.match(html, /Paste more data/);
assert.match(html, /id="histMspecs"/);
assert.match(html, /id="screenMspecs"/);
assert.doesNotMatch(html, /id="welcomeHistory"/);
assert.doesNotMatch(html, /id="welcomeEnter"/);
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
assert.match(html, /No Master Sheet row for MSPEC/);
assert.doesNotMatch(html, /keeping last specs/);
assert.match(html, /id="spcTip"/);
assert.match(html, /function showSpcTip/);
assert.match(html, /spcHits\.push\(\{ x: xx, y: yy, r: 10, idx: p\.idx, key, title, value: p\[key\], t: p\.t, unit \}\)/);
assert.doesNotMatch(html, /viewResult\(hit\.idx\);\s*setViewMode\('spc'\)/);
assert.match(html, /id="spcValueSearch"/);
assert.match(html, /spcSearch\.oninput/);
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
assert.match(html, /function specOutlier/);
assert.match(html, /id="histMspecs"/);
assert.match(html, /id="screenCompliance"/);
assert.match(html, /id="histCompliance"/);
assert.match(html, /function openCompliance/);
assert.match(html, /function renderComplianceHours/);
assert.match(html, /function failReasonsForRow/);
assert.match(html, /function hourComplianceStatus/);
assert.match(html, /function mspecWithTarget/);
assert.match(html, /function pickSpcValue/);
assert.match(html, /color-scheme:\s*dark/);
assert.match(html, /calendar-picker-indicator/);
assert.match(html, /thickness under/);
assert.match(html, /range over/);
assert.match(html, /data-comp-item/);
assert.match(html, /APP_VERSION = '1\.6\.6'/);
assert.match(html, /Missing checks/);
assert.match(html, /function asThousandths/);
assert.match(html, /function specTargetsText/);
assert.match(html, /function itemWithTargets/);
assert.match(html, /function downloadHistoryExcel/);
assert.match(html, /function downloadCompliancePdf/);
assert.match(html, /function downloadSpcReportPdf/);
assert.match(html, /function buildXlsx/);
assert.match(html, /function isMeasuredFail/);
assert.match(html, /function densitySpecsFromLookupRow/);
assert.match(html, /id="histDownload"/);
assert.match(html, /id="complianceDownload"/);
assert.match(html, /Download PDF/);
assert.match(html, /id="spcDownloadPdf"/);
assert.match(html, /id="spcReportOverlay"/);
assert.match(html, /id="rptItems"/);
assert.match(html, /spcRowsInDateRange/);
assert.match(html, /color-scheme:\s*light/);
assert.doesNotMatch(html, /snapNum\(snap, 'cellmin'\)/);
assert.match(html, /function indexHistory/);
assert.match(html, /function renderHistoryBody/);
assert.match(html, /id="histSpc"/);
assert.match(html, /id="modeBtn"/);
assert.doesNotMatch(html, /id="modeBtn"[^>]*hidden/);
assert.match(html, /option value="mspec"/);
assert.match(html, /navigator\.clipboard\.readText/);
assert.match(html, /function densityFromFilename/);
assert.match(html, /function failLineForCheck/);
assert.match(html, /function openMspecs/);
assert.match(html, /function openComplianceReport/);
assert.doesNotMatch(html, /id="complianceMissWeek"/);
assert.match(html, /function formatHourRanges/);
assert.match(html, /Pass\*/);
assert.match(html, /function displayOverallPf/);
assert.match(html, /id="complianceJumpDate"/);
assert.match(html, /id="compRptLines"/);
assert.match(html, /sticky-eye/);
assert.match(html, /hasHistory/);
assert.match(html, /YELLOW_R - t \* \(YELLOW_R - inner\)/);
assert.match(html, /downloadCompliancePdf\(days, lines\)/);
assert.match(html, /id="complianceReportOverlay"/);
assert.match(html, /id="progressOverlay"/);
assert.match(html, /id="prevResult"/);
assert.match(html, /id="nextResult"/);
assert.match(html, /id="viewMeta"/);
assert.match(html, /Density min/);
assert.doesNotMatch(html, /id="widthMinSpec"/);
assert.doesNotMatch(html, /id="widthTargetSpec"/);
assert.doesNotMatch(html, />Width min</);
assert.doesNotMatch(html, />Width target</);
assert.match(html, /id="complianceLine"/);
assert.match(html, /id="spcLine"/);
assert.match(html, /function lineFilteredRows/);
assert.match(html, /function fillLineSelects/);
assert.match(html, /spcPointSelected/);
assert.match(html, /MSPEC_COL_W/);
assert.match(html, /function applyMspecColgroup/);
assert.match(html, /setLineDash\(\[7, 6\]\)/);
assert.match(html, /class="card comp-chart"/);
assert.match(html, /repeat\(24, 18px\)/);
assert.match(html, /Sort all passing/);
assert.match(html, /Sort all under/);
assert.match(html, /Sort all over/);
assert.match(html, /TONE_COLS/);
assert.match(html, /viewMode !== 'spc'/);
assert.match(html, /function applySharedOutliers/);
assert.match(html, /function spcAxisTicks/);
assert.match(html, /function excelDateOnly/);
assert.match(html, /function writePdf/);
assert.match(html, /function pdfDrawTable/);
assert.match(html, /function pdfDrawSpcChart/);
assert.match(html, /modal input\[type="date"\]/);
assert.match(html, /MSPEC_AUDIT_COLS = \['MSPEC','AF#','Thick min','Thick target','Thick max','Range','Cell min','Cell max','Dens min','Dens target','Dens max'\]/);
assert.doesNotMatch(html, /'Dens used'/);
assert.doesNotMatch(html, /MSPEC_AUDIT_COLS = \[[^\]]*'Filename'/);
assert.doesNotMatch(html, /MSPEC_AUDIT_COLS = \[[^\]]*'Note'/);
assert.doesNotMatch(html, /canvas\.toDataURL\('image\/jpeg'/);
assert.doesNotMatch(html, /function wrapCanvasText/);
assert.doesNotMatch(html, /function captureSpcJpeg/);
assert.match(vba, /FindOrOpenQualityAio/);
assert.match(vba, /LookupTsvHasDensity/);
assert.match(vba, /Quality AIO/);
assert.match(vba, /MasterSheetRangeToTsv/);
assert.match(vba, /FindMspecHeaderRow/);
assert.match(vba, /For r = 1 To 2000/);
assert.match(vbaS1, /A:BH/);
assert.match(vbaS1, /FindOrOpenQualityAio/);
assert.match(vbaFromS4, /FindOrOpenQualityAio/);
assert.match(vbaFromS1, /LookupTsvHasDensity/);
assert.match(html, /headerIdx/);
assert.match(html, /incomingHasDens/);
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
assert.match(vba, /A:BH/);
assert.match(vbaFromS4, /A:BH/);
assert.match(vbaFromS1, /A:BH/);
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
assert.match(html, /incomingHasMspec/);
assert.match(html, /buildLookupMap\(lookupRows\)/);

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

function isNoCheckPf(v) {
  const s = String(v || '').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  return /^no check$/i.test(s);
}
function hourComplianceStatus(pfs, isFuture) {
  if (isFuture) return 'future';
  const list = (pfs || []).map(v => String(v == null ? '' : v));
  if (!list.length) return 'miss';
  const hasCheck = list.some(v => v.trim() && !isNoCheckPf(v));
  if (hasCheck) return 'check';
  if (list.some(isNoCheckPf)) return 'nocheck';
  return 'check';
}
assert.equal(hourComplianceStatus([], true), 'future');
assert.equal(hourComplianceStatus([], false), 'miss');
assert.equal(hourComplianceStatus(['NO CHECK'], false), 'nocheck');
assert.equal(hourComplianceStatus(['No-Check'], false), 'nocheck');
assert.equal(hourComplianceStatus(['NO CHECK', 'Pass'], false), 'check');
assert.equal(hourComplianceStatus(['Pass'], false), 'check');
assert.equal(hourComplianceStatus([''], false), 'check');

function mondayOfLocalDate(d) {
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - day + 1);
  return utc;
}
function isoWeekFromMonday(monday) {
  const thu = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 3));
  const year = thu.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7;
  const week1 = new Date(jan4);
  week1.setUTCDate(jan4.getUTCDate() - jan4Dow);
  const week = 1 + Math.round((monday.getTime() - week1.getTime()) / 604800000);
  return { year, week };
}
const mon2026 = mondayOfLocalDate(new Date(2026, 7, 21));
assert.equal(mon2026.getUTCFullYear(), 2026);
assert.equal(mon2026.getUTCMonth(), 7);
assert.equal(mon2026.getUTCDate(), 17);
assert.equal(isoWeekFromMonday(mon2026).week, 34);
assert.equal(isoWeekFromMonday(mon2026).year, 2026);

function finiteNum(v) {
  if (v == null || v === '') return false;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isFinite(n);
}
function numVal(v) {
  const s = String(v ?? '').trim();
  if (!s || s[0] === '#') return NaN;
  const n = parseFloat(s);
  return isFinite(n) ? n : NaN;
}
function rangeAsThousandths(v) {
  const n = parseFloat(v);
  if (!finiteNum(n)) return NaN;
  return Math.abs(n) < 1 ? n * 1000 : n;
}
function normalizePf(v) {
  const s = String(v || '').trim().toLowerCase();
  if (s === 'pass') return 'Pass';
  if (s === 'fail') return 'Fail';
  return '';
}
function judgeBetween(v, min, max) {
  if (!isFinite(v)) return '';
  if (isFinite(min) && v < min) return 'Fail';
  if (isFinite(max) && v > max) return 'Fail';
  if (isFinite(min) || isFinite(max)) return 'Pass';
  return '';
}
function failReasonsForRow(row, specs) {
  const overall = col(row, 'Pass/Fail');
  if (isNoCheckPf(overall)) return [];
  const s = specs || {};
  const reasons = [];
  const avg = numVal(col(row, 'Thickness Average'));
  const rangeThou = rangeAsThousandths(col(row, 'Thickness Range'));
  const dens = numVal(col(row, 'Density'));
  const cellMd = numVal(col(row, 'Cell Count MD'));
  const cellCd = numVal(col(row, 'Cell Count CD'));
  const width = numVal(col(row, 'Slit/Width'));
  const failed = (stored, computed) => {
    const pf = normalizePf(stored);
    if (pf === 'Pass') return false;
    if (pf === 'Fail') return true;
    return computed === 'Fail';
  };
  if (failed(col(row, 'Thickness Average Pass/Fail'), judgeBetween(avg, s.min, s.max))) {
    if (finiteNum(avg) && finiteNum(s.min) && avg < s.min) reasons.push('thickness under');
    else if (finiteNum(avg) && finiteNum(s.max) && avg > s.max) reasons.push('thickness over');
    else reasons.push('thickness fail');
  }
  if (failed(col(row, 'Thickness Range Pass/Fail'), judgeBetween(rangeThou, 0, s.rangeThou))) {
    reasons.push('range over');
  }
  if (failed(col(row, 'Density Pass/Fail'), judgeBetween(finiteNum(dens) ? Math.round(dens * 100) / 100 : NaN, s.densMin, s.densMax))) {
    if (finiteNum(dens) && finiteNum(s.densMin) && dens < s.densMin) reasons.push('density under');
    else if (finiteNum(dens) && finiteNum(s.densMax) && dens > s.densMax) reasons.push('density over');
    else reasons.push('density fail');
  }
  if (failed(col(row, 'Cell Count MD Pass/Fail'), judgeBetween(cellMd, s.cellMin, s.cellMax))) {
    if (finiteNum(cellMd) && finiteNum(s.cellMin) && cellMd < s.cellMin) reasons.push('cell count MD under');
    else if (finiteNum(cellMd) && finiteNum(s.cellMax) && cellMd > s.cellMax) reasons.push('cell count MD over');
    else reasons.push('cell count MD fail');
  }
  if (failed(col(row, 'Cell Count CD Pass/Fail'), judgeBetween(cellCd, s.cellMin, s.cellMax))) {
    if (finiteNum(cellCd) && finiteNum(s.cellMin) && cellCd < s.cellMin) reasons.push('cell count CD under');
    else if (finiteNum(cellCd) && finiteNum(s.cellMax) && cellCd > s.cellMax) reasons.push('cell count CD over');
    else reasons.push('cell count CD fail');
  }
  if (failed(col(row, 'Slit/Width Pass/Fail'), judgeBetween(width, s.widthMin, NaN))) {
    if (finiteNum(width) && finiteNum(s.widthMin) && width < s.widthMin) reasons.push('width under');
    else reasons.push('width fail');
  }
  if (normalizePf(overall) === 'Fail' && !reasons.length) reasons.push('failed check');
  return reasons;
}
const failReasons = failReasonsForRow({
  'Pass/Fail': 'Fail',
  'Thickness Average': '0.54',
  'Thickness Average Pass/Fail': 'Fail',
  'Thickness Range': '50',
  'Thickness Range Pass/Fail': 'Fail',
  'Density': '1.8',
  'Density Pass/Fail': 'Fail'
}, {
  min: 0.505, max: 0.53, rangeThou: 40, densMin: 1.55, densMax: 1.65, cellMin: 18, cellMax: 24, widthMin: 52
});
assert.ok(failReasons.includes('thickness over'));
assert.ok(failReasons.includes('range over'));
assert.ok(failReasons.includes('density over') || failReasons.includes('density fail'));
assert.deepEqual(failReasonsForRow({ 'Pass/Fail': 'NO CHECK', 'Thickness Average Pass/Fail': 'Fail' }, { min: 0.5, max: 0.6 }), []);
assert.deepEqual(failReasonsForRow({
  'Pass/Fail': 'Pass',
  'Thickness Average': '0.529',
  'Thickness Average Pass/Fail': 'Pass'
}, { min: 0.24, max: 0.26 }), []);
assert.equal(mspecWithTargetFromLookup(m4780), '4780 (.515 1.60#)');
function mspecWithTargetFromLookup(row) {
  const key = String(col(row, 'MSPEC #')).replace(/\.0+$/, '');
  const t = parseFloat(col(row, 'Target'));
  const d = parseFloat(col(row, 'Density Target'));
  const thick = t.toFixed(3).replace(/^0(?=\.)/, '');
  return `${key} (${thick} ${d.toFixed(2)}#)`;
}
function asThousandths(v) {
  const n = parseFloat(v);
  if (!isFinite(n)) return NaN;
  return Math.abs(n) < 1 ? n * 1000 : n;
}
assert.equal(asThousandths(40), 40);
assert.equal(asThousandths(0.04), 40);
assert.equal(asThousandths(0.036), 36);
function densityFromFilename(row) {
  const raw = String((row && (row.Filename || row['File Name'])) || Object.values(row || {}).join(' '));
  const m = raw.match(/(\d+(?:\.\d+)?)\s*#/);
  return m ? parseFloat(m[1]) : NaN;
}
function isDummyDensityTriple(min, target, max) {
  const nums = [min, target, max].filter(n => Number.isFinite(n));
  if (!nums.length) return true;
  const hasBand = Number.isFinite(min) && Number.isFinite(max) && (max - min) >= 0.049;
  if (hasBand) return false;
  return nums.every(n => Math.abs(n - 1) < 0.02);
}
const dump4460 = parseTsv([
  'MSPEC #\tAF#\tLower Spec\tLower Control\tTarget\tUpper Control\tUpper Spec\tThickness Range Max\tCell Count Min\tCell Count Max\tDensity Min\tDensity Target\tDensity Max\tWeight Min\tWeight Target\tWeight Max\tFilename',
  '4460\tAF500\t\t.505\t.515\t.52\t\t30\t18\t22\t\t\t\t\t\t\t4460 S3-6.0 Richter-AF500 2.0#',
  '5000\tAF030\t\t.032\t.035\t.038\t\t10\t28\t32\t\t\t\t\t\t\t5000 S1 9.3 die AF030 2.1# Rev 7-25-13'
]);
const row4460 = dump4460.rows[0];
assert.equal(col(row4460, 'MSPEC #'), '4460');
assert.equal(col(row4460, 'Filename'), '4460 S3-6.0 Richter-AF500 2.0#');
assert.equal(String(col(row4460, 'Density Max') || ''), '');
assert.equal(densityFromFilename(row4460), 2);
assert.equal(col(dump4460.rows[1], 'Filename'), '5000 S1 9.3 die AF030 2.1# Rev 7-25-13');
const titled = parseTsv([
  '\t\tThickness',
  'MSPEC #\tAF#\tLower Control\tTarget\tUpper Control\tDensity Min\tDensity Target\tDensity Max\tFilename',
  '4460\tAF500\t.505\t.515\t.52\t2\t2.1\t2.2\t4460 S3-6.0 Richter-AF500 2.0#'
]);
assert.equal(col(titled.rows[0], 'MSPEC #'), '4460');
assert.equal(parseFloat(col(titled.rows[0], 'Density Target')), 2.1);
assert.equal(parseFloat(col(titled.rows[0], 'Density Min')), 2);
const aioLike = parseTsv([
  'MSPEC #\tAF#\tLower Control\tTarget\tUpper Control\tCell Count Min\tCell Count Max\tDensity Min\tDensity Target\tDensity Max\tFilename',
  '4005\tAF060\t.057\t.062\t.067\t24\t28\t1.1\t1.2\t1.3\t4005 S1 AF060 1.2# DOW',
  '4460\tAF500\t.505\t.515\t.52\t18\t22\t2\t2.1\t2.2\t4460 S3-6.0 Richter-AF500 2.0#'
]);
assert.equal(parseFloat(col(aioLike.rows.find(r => col(r, 'MSPEC #') === '4005'), 'Density Target')), 1.2);
assert.equal(parseFloat(col(aioLike.rows.find(r => col(r, 'MSPEC #') === '4460'), 'Density Max')), 2.2);
assert.equal(densityFromFilename({ Filename: '4005 S1  5.8 Die 26 Mandrel AF060 1.2# DOW' }), 1.2);
assert.equal(isDummyDensityTriple(NaN, 1, 1), true);
assert.equal(isDummyDensityTriple(1.1, 1.2, 1.3), false);
function failLineForCheck(when, details) {
  if (!details || !details.length) return `${when} failed check`;
  return `${when} ${details.map(x => x.detail).join('; ')}`;
}
assert.equal(failLineForCheck('1:00 AM', [{ detail: 'thickness over (max 0.530, got 0.535)' }, { detail: 'range over (max 40.0, got 50.0)' }]), '1:00 AM thickness over (max 0.530, got 0.535); range over (max 40.0, got 50.0)');

const declaredIds = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]));
const missingIds = [];
for (const m of html.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) {
  if (!declaredIds.has(m[1])) missingIds.push(m[1]);
}
assert.deepEqual(missingIds, [], `getElementById missing in markup: ${missingIds.join(', ')}`);

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const script = scripts[scripts.length - 1];
assert.ok(script, 'inline script present');
const tmpJs = path.join(dir, '.script-check.js');
fs.writeFileSync(tmpJs, script[1]);
const check = spawnSync(process.execPath, ['--check', tmpJs], { encoding: 'utf8' });
fs.unlinkSync(tmpJs);
assert.equal(check.status, 0, check.stderr || check.stdout);

const pdfChunk = html.slice(html.indexOf('function pdfSafe'), html.indexOf('function downloadPdfDoc'));
const pdfApi = new Function(pdfChunk + '; return { writePdf, newPdfDoc, pdfAddPage, pdfText, pdfFillRect };')();
const pdfDoc = pdfApi.newPdfDoc(612, 792);
const pdfPage = pdfApi.pdfAddPage(pdfDoc);
pdfApi.pdfText(pdfPage, 40, 40, 'Compliance report', { size: 16, bold: true });
pdfApi.pdfFillRect(pdfPage, 40, 60, 20, 20, '#22c55e');
const pdfBytes = pdfApi.writePdf(pdfDoc);
assert.equal(Buffer.from(pdfBytes.subarray(0, 8)).toString(), '%PDF-1.4');
assert.ok(pdfBytes.length > 400);
assert.ok(!Buffer.from(pdfBytes).includes(Buffer.from('/DCTDecode')));

function fmtHourLabel(h) {
  const hr = ((h + 11) % 12) + 1;
  return `${hr}:00 ${h < 12 ? 'AM' : 'PM'}`;
}
function formatHourRanges(hours) {
  const sorted = [...new Set((hours || []).map(Number).filter(h => h >= 0 && h < 24))].sort((a, b) => a - b);
  if (!sorted.length) return '';
  const ranges = [];
  let start = sorted[0], prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const h = sorted[i];
    if (h === prev + 1) { prev = h; continue; }
    ranges.push(start === prev ? fmtHourLabel(start) : `${fmtHourLabel(start)}–${fmtHourLabel(prev)}`);
    start = prev = h;
  }
  return ranges.join(', ');
}
assert.equal(formatHourRanges([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,23]), '12:00 AM–2:00 PM, 11:00 PM');
assert.equal(formatHourRanges([12]), '12:00 PM');

console.log('parse-diegraph tests passed');
