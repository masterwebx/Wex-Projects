import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const vba = fs.readFileSync(path.join(dir, 'CopyForGraph.bas'), 'utf8');
const vbaS1 = fs.readFileSync(path.join(dir, 'CopyForGraphS1S3.bas'), 'utf8');
const vbaFrom = fs.readFileSync(path.join(dir, 'CopyForGraphFromQuality.bas'), 'utf8');
const payload = fs.readFileSync(path.join(dir, 'fixtures/sample-diegraph2.txt'), 'utf8');
const payloadS1 = fs.readFileSync(path.join(dir, 'fixtures/sample-diegraph2-s1s3.txt'), 'utf8');

function parseRangeSpec(raw) {
  const n = parseFloat(raw); if (!isFinite(n)) return NaN;
  return Math.abs(n) >= 1 ? n / 1000 : n;
}
function isTsvHeaderLine(line) {
  const heads = String(line ?? '').split('\t').map(s => s.trim());
  if (!heads.length) return false;
  const compact = heads.map(h => String(h).replace(/\s+/g, '').toLowerCase());
  if (compact.some(h => h === 'mspec' || h === 'mspec#')) return true;
  const hasDate = heads.some(h => /^date\/?time$/i.test(h));
  const hasLine = heads.some(h => /^line$/i.test(h));
  const hasItem = compact.some(h => h === 'item' || h === 'item#' || h === 'itemnumber' || h === 'itemdesc' || h === 'itemdescription' || h === 'description');
  const hasPf = heads.some(h => /^pass\/?fail$/i.test(h));
  return hasDate && (hasLine || hasItem || hasPf);
}
function parseTsv(lines) {
  const nonempty = lines.map(s => String(s ?? '').replace(/\r/g, '')).filter(l => l.length);
  if (!nonempty.length) return { headers: [], rows: [] };
  const allHeaders = [];
  const rows = [];
  let headers = [];
  for (const line of nonempty) {
    if (isTsvHeaderLine(line)) {
      headers = line.split('\t').map(s => s.trim());
      headers.forEach(h => { if (h && !allHeaders.includes(h)) allHeaders.push(h); });
      continue;
    }
    if (!headers.length) continue;
    const parts = line.split('\t');
    const obj = {};
    headers.forEach((h, j) => { if (h) obj[h] = parts[j] == null ? '' : parts[j]; });
    rows.push(obj);
  }
  return { headers: allHeaders, rows };
}
function splitDieGraph2(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const sections = { CURRENT: [], LOOKUP: [], TABLES4: [], TABLES1S3: [], TABLESBUBBLE: [], TABLESP1: [], TABLESRTS: [] };
  let cur = null;
  for (const line of lines.slice(1)) {
    const m = line.trim().match(/^\[(CURRENT|LOOKUP|TABLES4|TABLES1S3|TABLESBUBBLE|TABLESP1|TABLESRTS|HISTORY)\]$/i);
    if (m) {
      const name = m[1].toUpperCase();
      cur = (name === 'HISTORY') ? 'TABLES4' : name;
      continue;
    }
    if (cur) sections[cur].push(line);
  }
  return sections;
}
function historyLines(sections) {
  return (sections.TABLES4 || []).concat(sections.TABLES1S3 || []);
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

assert.ok(!fs.existsSync(path.join(dir, 'CopyForGraphFromS4.bas')));
assert.ok(!fs.existsSync(path.join(dir, 'CopyForGraphFromS1S3.bas')));
assert.match(vbaFrom, /Attribute VB_Name = "CopyForGraphFromQuality"/);
assert.match(vbaFrom, /Public Sub CopyForGraphFromQuality/);
assert.match(vbaFrom, /Public Sub CopyForGraphFromS4/);
assert.match(vbaFrom, /Public Sub CopyForGraphFromS1S3/);
assert.match(vbaFrom, /Sub CopyForGraphFromBothBooks/);
assert.match(vbaFrom, /Function AcquireSource/);
assert.match(vbaFrom, /Function PreferredCurrentKind/);
assert.match(vbaFrom, /Function DetectKindFromWorkbook/);
assert.match(vbaFrom, /\[TABLES4\]/);
assert.match(vbaFrom, /\[TABLES1S3\]/);
assert.match(vbaFrom, /\[TABLESBUBBLE\]/);
assert.match(vbaFrom, /\[TABLESP1\]/);
assert.match(vbaFrom, /\[TABLESRTS\]/);
assert.match(vbaFrom, /Copying TableS4/);
assert.match(vbaFrom, /Copying TableS1S3/);
assert.match(vbaFrom, /Copying TableBubble/);
assert.match(vbaFrom, /Copying TableP1/);
assert.match(vbaFrom, /Copying TableRTS/);
assert.match(vbaFrom, /Files\\S4\.xlsm/);
assert.match(vbaFrom, /Files\\S1 S3\.xlsm/);
assert.match(vbaFrom, /Files\\Bubble\.xlsm/);
assert.match(vbaFrom, /Files\\P1\.xlsm/);
assert.match(vbaFrom, /Files\\RTS\.xlsm/);
assert.match(vbaFrom, /TableBubble/);
assert.match(vbaFrom, /TableP1/);
assert.match(vbaFrom, /TableRTS/);
assert.match(vbaFrom, /Data Bubble/);
assert.match(vbaFrom, /Data P1/);
assert.match(vbaFrom, /Data RTS/);
assert.match(vbaFrom, /FileCopy src, dest/);
assert.match(vbaFrom, /Environ\$\("TEMP"\)/);
assert.match(vbaFrom, /CopyWorkbookFile/);
assert.match(vbaFrom, /AlreadyOpenWorkbook/);
assert.match(vbaFrom, /openedByLauncher/);
assert.match(vbaFrom, /Workbooks\.Open/);
assert.match(vbaFrom, /w\.Visible = False/);
assert.match(vbaFrom, /msoAutomationSecurityForceDisable/);
assert.match(vbaFrom, /Function TargetWorkbook/);
assert.match(vbaFrom, /TableS4/);
assert.match(vbaFrom, /TableS1S3/);
assert.match(vbaFrom, /source=S4/);
assert.match(vbaFrom, /source=S1S3/);
assert.match(vbaFrom, /Range\("B8"\)/);
assert.match(vbaFrom, /Range\("B14"\)/);
assert.match(vbaFrom, /densMin=/);
assert.match(vbaFrom, /PutTextOnClipboard/);
assert.match(vbaFrom, /OpenGraphHtml/);
assert.match(vbaFrom, /NOT into S4\.xlsm/);
assert.match(vbaFrom, /S1 S3\.xlsm, Bubble\.xlsm, P1\.xlsm, or RTS\.xlsm/);
assert.doesNotMatch(vbaFrom, /Application\.Run/);
assert.doesNotMatch(vbaFrom, /CopyForGraph\.CopyForGraph/);
assert.doesNotMatch(vbaFrom, /CopyForGraphS1S3\.CopyForGraph/);
assert.doesNotMatch(vbaFrom, /Left\$\(src, i\)/);

assert.match(html, /data-screen="welcome"/);
assert.match(html, /S4, S1 S3, Bubble, P1, and RTS quality check sheets/);
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
assert.match(html, /APP_VERSION = '1\.7\.6'/);
assert.match(html, /SAP_WORK_CENTERS/);
assert.match(html, /function sapMapWorkCenter/);
assert.match(html, /function parseSapTime/);
assert.match(html, /function sapHitsOnDay/);
assert.match(html, /function qualityNotesForRow/);
assert.match(html, /Checked previous day/);
assert.match(html, /function sapAuditToStore/);
assert.match(html, /function applyStoredSapAudit/);
assert.match(html, /sapAudit: sapAuditToStore\(\)/);
assert.match(html, /function dedupeHistoryRows/);
assert.match(html, /function rowHasNativeS1S3Keys/);
assert.match(html, /function rowDedupeScore/);
assert.doesNotMatch(html, /catcher\.addEventListener\('paste'/);
assert.match(html, /let applyingClipboard = false/);
assert.match(html, /All lines/);
assert.match(html, /id="complianceSap"/);
assert.match(html, /Audit against SAP/);
assert.match(html, /function summarizeChecks/);
assert.match(html, /function parseSapPairs/);
assert.match(html, /function loadSapFile/);
assert.match(html, /function sapDayHtml/);
assert.match(html, /function sapRowsForYmd/);
assert.match(html, /function sapPdfRowsForYmd/);
assert.match(html, /function sapHeaderKind/);
assert.match(html, /#complianceReportOverlay \.modal/);
assert.doesNotMatch(html, /id="complianceSapCard"/);
assert.doesNotMatch(html, /function renderSapAudit/);
assert.doesNotMatch(html, /function sapPdfTableRows/);
assert.doesNotMatch(html, /activeLine = preferredLine\(\)/);
assert.doesNotMatch(html, /\$\{starred\} Pass\*/);
assert.match(html, /function foamRowLooksShifted/);
assert.match(html, /function unshiftS1S3FromS4Keys/);
assert.match(html, /function normalizeFoamRow/);
assert.doesNotMatch(html, /if \(headers\.length\) continue/);
assert.match(html, /function allLineChoices/);
assert.match(html, /function rowsForLine/);
assert.match(html, /function failLinesForRows/);
assert.match(html, /function thicknessAvgFromRow/);
assert.match(html, /function buildCompliancePdf/);
assert.match(html, /function lineFileTag/);
assert.match(html, /Downloaded \$\{lineList\.length\} compliance PDFs/);
assert.match(html, /function complianceSumHtml/);
assert.match(html, /function pickPfMin/);
assert.doesNotMatch(html, /id="cellMaxSpec"/);
assert.match(html, /function isTsvHeaderLine/);
assert.match(html, /function parseHistorySections/);
assert.match(html, /TABLESBUBBLE/);
assert.match(html, /TABLESP1/);
assert.match(html, /TABLESRTS/);
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
assert.match(html, /Show all passing/);
assert.match(html, /Show all under/);
assert.match(html, /Show all over/);
assert.doesNotMatch(html, /Sort all passing/);
assert.match(html, /Reset sort/);
assert.match(html, /id="histResetSort"/);
assert.match(html, /id="histPlant"/);
assert.match(html, /Extrusion Foam/);
assert.match(html, /Extrusion Bubble/);
assert.match(html, /function setActivePlant/);
assert.match(html, /function isFoamPlant/);
assert.match(html, /function plantRows/);
assert.match(html, /tableToneShow/);
assert.match(html, /function inferPlant/);
assert.match(html, /function resetSort/);
assert.match(html, /function histCols/);
assert.match(html, /function withNotesLast/);
assert.match(html, /const FOAM_COLS/);
assert.match(html, /const BUBBLE_COLS/);
assert.match(html, /const P1_COLS/);
assert.match(html, /const RTS_COLS/);
assert.match(html, /const PLANT_COLS/);
function parseJsStringArray(name) {
  const m = html.match(new RegExp(`const ${name} = \\[([^\\]]+)\\]`));
  assert.ok(m, name);
  return m[1].split(',').map(s => s.trim().replace(/^'|'$/g, ''));
}
const foamCols = parseJsStringArray('FOAM_COLS');
const bubbleCols = parseJsStringArray('BUBBLE_COLS');
const p1Cols = parseJsStringArray('P1_COLS');
const rtsCols = parseJsStringArray('RTS_COLS');
assert.equal(foamCols.at(-1), 'Notes');
assert.equal(bubbleCols.at(-1), 'Notes');
assert.equal(p1Cols.at(-1), 'Notes');
assert.equal(rtsCols.at(-1), 'Notes');
assert.ok(foamCols.includes('Slit/Width'));
assert.ok(foamCols.includes('MSPEC'));
assert.ok(!bubbleCols.includes('Slit/Width'));
assert.ok(!bubbleCols.includes('MSPEC'));
assert.ok(!bubbleCols.includes('Bundle #'));
assert.ok(!bubbleCols.includes('Thickness Average'));
assert.ok(!p1Cols.includes('Slit/Width'));
assert.ok(!p1Cols.includes('MSPEC'));
assert.ok(!p1Cols.includes('Bundle #'));
assert.ok(!rtsCols.includes('Slit/Width'));
assert.ok(!rtsCols.includes('MSPEC'));
assert.ok(!rtsCols.includes('Thickness Average'));
assert.ok(bubbleCols.includes('Item Description'));
assert.ok(bubbleCols.includes('Product Verification'));
assert.ok(p1Cols.includes('Average Single Shot'));
assert.ok(rtsCols.includes('Parent Material'));
assert.match(html, /TONE_COLS/);
assert.match(html, /viewMode !== 'spc'/);
assert.match(html, /function applySharedOutliers/);
assert.match(html, /function spcAxisTicks/);
assert.match(html, /function excelDateOnly/);
assert.match(html, /function writePdf/);
assert.match(html, /function pdfDrawTable/);
assert.match(html, /function pdfDrawSpcChart/);
assert.match(html, /modal input\[type="date"\]/);
assert.match(html, /MSPEC_AUDIT_COLS = \['MSPEC','AF#','Thick min','Thick target','Thick max','Range','Cell min','Dens min','Dens target','Dens max'\]/);
assert.doesNotMatch(html, /'Cell max'/);
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
assert.match(vbaFrom, /FindOrOpenQualityAio/);
assert.match(vbaFrom, /LookupTsvHasDensity/);
assert.match(html, /isTsvHeaderLine/);
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
const table = parseTsv(historyLines(sections));
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

const s1Sections = splitDieGraph2(payloadS1);
const s4Header = (sections.TABLES4 || []).find(isTsvHeaderLine);
const s4Row = (sections.TABLES4 || []).find(l => l && !isTsvHeaderLine(l));
const s1Header = (s1Sections.TABLES1S3 || []).find(isTsvHeaderLine);
const s1Row = (s1Sections.TABLES1S3 || []).find(l => l && !isTsvHeaderLine(l));
assert.ok(s4Header && s4Row && s1Header && s1Row);
const mixed = parseTsv([s4Header, s4Row, s1Header, s1Row]);
assert.equal(mixed.rows.length, 2);
assert.equal(String(col(mixed.rows[0], 'User')), 'GWEXLER');
assert.equal(String(col(mixed.rows[1], 'User')), 'SONOFRE');
assert.equal(String(col(mixed.rows[1], 'Tape Color')), 'BROWN');
assert.equal(String(col(mixed.rows[1], 'Cell Count MD')), '22');
assert.notEqual(String(col(mixed.rows[1], 'Cell Count MD')).toUpperCase(), 'PASS');

function foamRowLooksShifted(row) {
  if (!row) return false;
  if (String(row['Tape Color'] || '').trim() || String(row['Bundle Tight/Loose'] || '').trim()) return false;
  const md = String(row['Cell Count MD'] ?? '').trim();
  const cd = String(row['Cell Count CD'] ?? '').trim();
  if (!md || !cd) return false;
  const mdNum = parseFloat(md);
  const cdNum = parseFloat(cd);
  if (isFinite(mdNum) && isFinite(cdNum) && md !== 'PASS') return false;
  const bundle = /^(pass|fail|pass\*|tight|loose|yes|no)$/i.test(md);
  const color = /^(light\s+)?(blue|red|brown|green|yellow|orange|white|black|pink|purple|tan|clear|grey|gray|gold|silver|teal|navy)$/i.test(cd);
  return bundle && color;
}
function unshiftS1S3FromS4Keys(row) {
  const out = Object.assign({}, row);
  out['Perf'] = row['Perf Roller On'];
  out['Bundle Tight/Loose'] = row['Cell Count MD'];
  out['Tape Color'] = row['Cell Count CD'];
  out['Cell Count MD'] = row['Thickness Average'];
  out['Cell Count CD'] = row['Thickness Range'];
  out['Thickness Average'] = row['Density'];
  out['Thickness Range'] = row['Pass/Fail'];
  out['Density'] = row['User'];
  out['Pass/Fail'] = row['Reason for Check'];
  out['User'] = row['Notes'];
  out['Reason for Check'] = row['T1'];
  out['Notes'] = row['T2'];
  return out;
}
const scrambled = {};
s4Header.split('\t').forEach((h, j) => { if (h) scrambled[h.trim()] = s1Row.split('\t')[j] ?? ''; });
assert.equal(String(scrambled['Cell Count MD']), 'PASS');
assert.equal(String(scrambled['Cell Count CD']), 'BROWN');
assert.equal(String(scrambled.Notes), 'SONOFRE');
assert.ok(foamRowLooksShifted(scrambled));
const fixedShift = unshiftS1S3FromS4Keys(scrambled);
assert.equal(String(fixedShift.User), 'SONOFRE');
assert.equal(String(fixedShift['Tape Color']), 'BROWN');
assert.equal(String(fixedShift['Bundle Tight/Loose']), 'PASS');
assert.equal(String(fixedShift['Cell Count MD']), '22');
assert.ok(!foamRowLooksShifted(fixedShift));
assert.ok(!foamRowLooksShifted(first));

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
const s1Table = parseTsv(historyLines(s1));
assert.ok(s1.TABLES1S3.length > 0);
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

const combined = [
  'DIEGRAPH2',
  '[CURRENT]',
  ...sections.CURRENT,
  '[LOOKUP]',
  ...sections.LOOKUP,
  '[TABLES4]',
  ...sections.TABLES4,
  '[TABLES1S3]',
  ...s1.TABLES1S3
].join('\n');
const both = splitDieGraph2(combined);
const bothTable = parseTsv(historyLines(both));
assert.equal(bothTable.rows.length, table.rows.length + s1Table.rows.length);
assert.ok(bothTable.rows.some(r => col(r, 'Line') === 'S4'));
assert.ok(bothTable.rows.some(r => col(r, 'Line') === 'S1'));
assert.ok(bothTable.rows.some(r => col(r, 'Line') === 'S3'));
assert.ok(bothTable.headers.includes('Tape Color'));
assert.ok(bothTable.headers.includes('Winder Tension'));
assert.ok(bothTable.headers.includes('Roll Weight'));

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
assert.match(vbaFrom, /A:BH/);
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
assert.equal(colW[1].split(',').length, 16);

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
  if (judgeBetween(cellMd, s.cellMin, NaN) === 'Fail') {
    if (finiteNum(cellMd) && finiteNum(s.cellMin) && cellMd < s.cellMin) reasons.push('cell count MD under');
    else reasons.push('cell count MD fail');
  }
  if (judgeBetween(cellCd, s.cellMin, NaN) === 'Fail') {
    if (finiteNum(cellCd) && finiteNum(s.cellMin) && cellCd < s.cellMin) reasons.push('cell count CD under');
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
assert.deepEqual(failReasonsForRow({
  'Pass/Fail': 'Pass',
  'Cell Count MD': '30',
  'Cell Count MD Pass/Fail': 'Fail',
  'Cell Count CD': '22',
  'Cell Count CD Pass/Fail': 'Fail'
}, { cellMin: 18, cellMax: 24 }), []);
assert.ok(failReasonsForRow({
  'Pass/Fail': 'Pass',
  'Cell Count MD': '10',
  'Cell Count MD Pass/Fail': 'Pass'
}, { cellMin: 18, cellMax: 24 }).includes('cell count MD under'));
function looksLikeThicknessIn(n) {
  return isFinite(n) && n > 0 && n < 4;
}
function thicknessFromPoints(row) {
  const pts = [];
  for (let i = 1; i <= 13; i++) {
    const n = parseFloat(row['T' + i]);
    if (looksLikeThicknessIn(n)) pts.push(n);
  }
  if (pts.length < 3) return NaN;
  return pts.reduce((a, b) => a + b, 0) / pts.length;
}
function thicknessAvgFromRow(row) {
  const stored = parseFloat(col(row, 'Thickness Average'));
  if (looksLikeThicknessIn(stored)) return stored;
  const fromPts = thicknessFromPoints(row);
  if (isFinite(fromPts)) return fromPts;
  return stored;
}
assert.ok(Math.abs(thicknessAvgFromRow({
  'Thickness Average': '20',
  T1: '0.120', T2: '0.125', T3: '0.124', T4: '0.122'
}) - 0.12275) < 1e-6);
assert.equal(thicknessAvgFromRow({ 'Thickness Average': '0.125', T1: '0.120', T2: '0.125', T3: '0.124' }), 0.125);
assert.doesNotMatch(html, /r\.pf === 'Pass\*'\) \{\s*starred \+= 1;\s*failLines\.push/);
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

function inferPlant(row, tagged) {
  const t = String(tagged || (row && row.__plant) || '').toLowerCase();
  if (t === 'foam' || t === 'bubble' || t === 'p1' || t === 'rts') return t;
  const line = String(col(row, 'Line') || '').trim().toUpperCase();
  if (line === 'COEX' || line === 'MONO') return 'bubble';
  if (line === 'P1') return 'p1';
  if (line === 'RTS') return 'rts';
  return 'foam';
}
assert.equal(inferPlant({ Line: 'S4' }), 'foam');
assert.equal(inferPlant({ Line: 'S1' }), 'foam');
assert.equal(inferPlant({ Line: 'COEX' }), 'bubble');
assert.equal(inferPlant({ Line: 'MONO' }), 'bubble');
assert.equal(inferPlant({ Line: 'P1' }), 'p1');
assert.equal(inferPlant({ Line: 'RTS' }), 'rts');
assert.ok(isTsvHeaderLine('Item Description\tDate/Time\tLine\tItem\tWidth\tPass/Fail'));
assert.ok(isTsvHeaderLine('Description\tDate/Time\tLine\tItem #\tWidth\tPass/Fail'));
assert.ok(isTsvHeaderLine('Item Description\tDate/Time\tLine\tItem #\tDensity\tPass/Fail'));

const plantPayload = [
  'DIEGRAPH2',
  '[CURRENT]',
  'source=S4',
  '[LOOKUP]',
  '[TABLES4]',
  'Date/Time\tLine\tItem #\tMSPEC\tPass/Fail\tDensity',
  '45900.5\tS4\t1001\t4003\tPass\t1.2',
  '[TABLES1S3]',
  'Date/Time\tLine\tItem #\tMSPEC\tPass/Fail\tDensity',
  '45900.6\tS1\t1002\t4003\tPass\t1.1',
  '[TABLESBUBBLE]',
  'Item Description\tDate/Time\tLine\tItem\tWidth\tDensity\tPass/Fail\tUser',
  'SAB 12\t45900.7\tMONO\t4077550\t12\t7.23\tPass\tMPEREZ',
  'SPC SLIP\t45900.8\tCOEX\t3036576\t16\t5.8\tFail\tJVELASQUEZ',
  '[TABLESP1]',
  'Item Description\tDate/Time\tLine\tItem #\tCell Count MD\tDensity\tPass/Fail\tUser',
  'Old Item Description\tDate/Time\tLine\tItem #\tCell Count MD\tDensity\tPass/Fail\tUser',
  'PE PLK\t45900.9\tP1\t471232\t24\t3.78\tFail\tJJAIMES',
  '[TABLESRTS]',
  'Description\tDate/Time\tLine\tItem #\tWidth\tLength\tPass/Fail\tUser',
  'PE LAM\t45901.1\tRTS\t4072527\t48\t108\tFail\tGWEXLER'
].join('\n');
const plantSecs = splitDieGraph2(plantPayload);
assert.ok(plantSecs.TABLESBUBBLE.length > 0);
assert.ok(plantSecs.TABLESP1.length > 0);
assert.ok(plantSecs.TABLESRTS.length > 0);
const bubble = parseTsv(plantSecs.TABLESBUBBLE);
assert.equal(bubble.rows.length, 2);
assert.equal(col(bubble.rows[0], 'Line'), 'MONO');
assert.equal(col(bubble.rows[1], 'Line'), 'COEX');
assert.equal(String(col(bubble.rows[0], 'Item') || col(bubble.rows[0], 'Item #')), '4077550');
const p1 = parseTsv(plantSecs.TABLESP1);
assert.ok(p1.rows.some(r => col(r, 'Line') === 'P1' && col(r, 'Item #') === '471232'));
const rts = parseTsv(plantSecs.TABLESRTS);
assert.equal(col(rts.rows[0], 'Line'), 'RTS');
assert.equal(col(rts.rows[0], 'Item #'), '4072527');

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

function summarizeChecks(rows) {
  const buckets = new Map();
  for (const r of rows || []) {
    const key = `${r.y}|${r.d}|${r.t}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(r);
  }
  let passed = 0, failed = 0, noCheck = 0;
  for (const group of buckets.values()) {
    if (group.some(r => r.pf === 'Fail')) failed += 1;
    else if (group.every(r => r.pf === 'NO CHECK')) noCheck += 1;
    else passed += 1;
  }
  return { passed, failed, noCheck };
}
assert.deepEqual(summarizeChecks([
  { y: 2026, d: 1, t: '8:00 AM', pf: 'Fail' },
  { y: 2026, d: 1, t: '8:00 AM', pf: 'Fail' },
  { y: 2026, d: 1, t: '9:00 AM', pf: 'Pass*' },
  { y: 2026, d: 1, t: '10:00 AM', pf: 'NO CHECK' }
]), { passed: 1, failed: 1, noCheck: 1 });

function sapItemKey(v) {
  let s = String(v ?? '').trim();
  if (!s) return '';
  if (/^\d+\.0+$/.test(s)) s = String(Math.round(Number(s)));
  return s.toUpperCase();
}
function parseSapDate(v) {
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  return null;
}
const SAP_WORK_CENTERS = {
  VISCBE01: 'COEX', VISFSE01: 'S1', VISFSE03: 'S3', VISFSE04: 'S4',
  VISMBE01: 'MONO', VISMSL01: 'RTS', VISPLE01: 'P1'
};
function sapMapWorkCenter(v) {
  const key = String(v ?? '').trim().toUpperCase().replace(/\s+/g, '');
  return SAP_WORK_CENTERS[key] || '';
}
function sapHeaderKind(h) {
  const s = String(h || '').replace(/\s+/g, ' ').trim();
  if (/work\s*center/i.test(s)) return 'wc';
  if (/^line\b/i.test(s)) return 'line';
  if (/time\s*of\s*entry|entry\s*time|^time\b/i.test(s)) return 'time';
  if (/entry\s*date|posting\s*date|^date\b/i.test(s)) return 'date';
  if (/material\s*desc|item\s*desc|^description$/i.test(s)) return 'desc';
  if ((/^material$|item/i.test(s)) && !/desc/i.test(s)) return 'item';
  if (/^qty$|^quantity$/i.test(s)) return 'qty';
  if (/unit\s*of\s*entry|^uom$|^unit$/i.test(s)) return 'unit';
  return '';
}
function parseSapTime(v) {
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  if (!m) {
    if (/^0\.\d+$/.test(s)) {
      const mins = Math.round(Number(s) * 24 * 60);
      return { hour: Math.floor(mins / 60) % 24, minute: mins % 60 };
    }
    return { hour: NaN, minute: 0, text: s };
  }
  let hour = +m[1];
  const minute = +m[2];
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && hour < 12) hour += 12;
  if (ap === 'AM' && hour === 12) hour = 0;
  return { hour, minute, text: s };
}
function parseSapPairs(grid) {
  const header = (grid[0] || []).map(h => String(h || '').trim());
  const cols = { date: -1, item: -1, line: -1, wc: -1, time: -1, desc: -1, qty: -1, unit: -1 };
  let start = 0;
  header.forEach((h, i) => {
    const kind = sapHeaderKind(h);
    if (kind && cols[kind] < 0) cols[kind] = i;
  });
  if (Object.values(cols).some(i => i >= 0)) start = 1;
  if (cols.item < 0) cols.item = cols.date === 0 ? 1 : 0;
  if (cols.date < 0) cols.date = 0;
  const out = [];
  for (let i = start; i < grid.length; i++) {
    const dt = parseSapDate(grid[i][cols.date]);
    const item = String(grid[i][cols.item] ?? '').trim();
    if (!dt || !sapItemKey(item)) continue;
    const wc = cols.wc >= 0 ? String(grid[i][cols.wc] || '').trim() : '';
    const rawLine = cols.line >= 0 ? String(grid[i][cols.line] || '').trim() : '';
    const tm = parseSapTime(cols.time >= 0 ? grid[i][cols.time] : '');
    out.push({
      y: dt.y, m: dt.m, d: dt.d, item, itemKey: sapItemKey(item),
      line: sapMapWorkCenter(wc) || rawLine,
      desc: cols.desc >= 0 ? String(grid[i][cols.desc] || '').trim() : '',
      qty: cols.qty >= 0 ? String(grid[i][cols.qty] || '').trim() : '',
      unit: cols.unit >= 0 ? String(grid[i][cols.unit] || '').trim() : '',
      timeText: tm.text || '',
      hour: tm.hour,
      workCenter: wc
    });
  }
  return out;
}
const sapRows = parseSapPairs([
  ['Date', 'Item'],
  ['2026-08-20', '3030053'],
  ['2026-08-20', '410805.0']
]);
assert.equal(sapRows.length, 2);
assert.equal(sapRows[0].itemKey, '3030053');
assert.equal(sapRows[1].itemKey, '410805');
assert.equal(sapRows[0].d, 20);
assert.equal(sapRows[0].line, '');
const sapLined = parseSapPairs([
  ['Date', 'Item', 'Line'],
  ['2026-08-20', '3030053', 'S4'],
  ['2026-08-21', '410805', 'S1'],
  ['2026-08-22', '999', 'COEX']
]);
assert.equal(sapLined.length, 3);
assert.equal(sapLined[0].line, 'S4');
assert.equal(sapLined[1].line, 'S1');
assert.equal(sapLined[2].line, 'COEX');
const onlyUploaded = sapLined.filter(r => r.y === 2026 && r.m === 8 && r.d === 20);
assert.equal(onlyUploaded.length, 1);
assert.equal(onlyUploaded[0].item, '3030053');

assert.equal(sapHeaderKind('Work Center'), 'wc');
assert.equal(sapHeaderKind('Material'), 'item');
assert.equal(sapHeaderKind('Material Description'), 'desc');
assert.equal(sapHeaderKind('Quantity'), 'qty');
assert.equal(sapHeaderKind('Unit of Entry'), 'unit');
assert.equal(sapHeaderKind('Time of Entry'), 'time');
assert.equal(sapHeaderKind('Entry Date'), 'date');
assert.equal(sapMapWorkCenter('VISCBE01'), 'COEX');
assert.equal(sapMapWorkCenter('VISFSE01'), 'S1');
assert.equal(sapMapWorkCenter('VISFSE03'), 'S3');
assert.equal(sapMapWorkCenter('VISFSE04'), 'S4');
assert.equal(sapMapWorkCenter('VISMBE01'), 'MONO');
assert.equal(sapMapWorkCenter('VISMSL01'), 'RTS');
assert.equal(sapMapWorkCenter('VISPLE01'), 'P1');
const sapExport = parseSapPairs([
  ['Material', 'Material Description', 'Quantity', 'Unit of Entry', 'Time of Entry', 'Entry Date', 'Work Center'],
  ['3030053', 'AF500 foam plank', '2400', 'LB', '14:32:00', '2026-08-20', 'VISFSE04'],
  ['410805', 'AF250 roll', '18.5', 'ROL', '2:05 AM', '2026-08-21', 'VISFSE01'],
  ['999', 'bubble wrap', '100', 'FT', '22:10', '2026-08-22', 'VISCBE01']
]);
assert.equal(sapExport.length, 3);
assert.equal(sapExport[0].itemKey, '3030053');
assert.equal(sapExport[0].desc, 'AF500 foam plank');
assert.equal(sapExport[0].qty, '2400');
assert.equal(sapExport[0].unit, 'LB');
assert.equal(sapExport[0].line, 'S4');
assert.equal(sapExport[0].workCenter, 'VISFSE04');
assert.equal(sapExport[0].hour, 14);
assert.equal(sapExport[1].line, 'S1');
assert.equal(sapExport[1].hour, 2);
assert.equal(sapExport[2].line, 'COEX');
assert.equal(sapExport[2].hour, 22);
function sapPrevYmd(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
assert.deepEqual(sapPrevYmd(2026, 8, 21), { y: 2026, m: 8, d: 20 });
assert.deepEqual(sapPrevYmd(2026, 3, 1), { y: 2026, m: 2, d: 28 });
function qualityNotesForRow(r) {
  const notes = String((r && r.text && r.text.Notes) || '').trim();
  const user = String((r && r.text && r.text.User) || '').trim();
  if (notes && user) return `${notes} (${user})`;
  return notes;
}
assert.equal(qualityNotesForRow({ text: { Notes: 'thin on south', User: 'Pat' } }), 'thin on south (Pat)');
assert.equal(qualityNotesForRow({ text: { Notes: '', User: 'Pat' } }), '');

function testRowIdentity(row) {
  const when = col(row, 'Date/Time');
  const item = col(row, 'Item #', 'Item');
  const bundle = col(row, 'Bundle #');
  const core = [
    row.__plant || 'foam', col(row, 'Line'), when, String(col(row, 'MSPEC') || '').replace(/\.0+$/, ''), item, bundle
  ].join('|');
  if (when && (item || bundle)) return core;
  return core + '|' + col(row, 'Thickness Average') + '|' + col(row, 'Density') + '|' + col(row, 'User');
}
function testHasNativeS1S3(row) {
  return Object.prototype.hasOwnProperty.call(row, 'Tape Color')
    || Object.prototype.hasOwnProperty.call(row, 'Bundle Tight/Loose');
}
function testDedupeScore(row) {
  let n = 0;
  Object.keys(row || {}).forEach(k => { if (k !== '__plant' && String(row[k] || '').trim()) n += 1; });
  if (testHasNativeS1S3(row)) n += 50;
  return n;
}
function testDedupeHistoryRows(rows) {
  const best = new Map();
  (rows || []).forEach(row => {
    const id = testRowIdentity(row);
    const prev = best.get(id);
    if (!prev || testDedupeScore(row) >= testDedupeScore(prev)) best.set(id, row);
  });
  return [...best.values()];
}
const shiftedS1 = {
  __plant: 'foam', Line: 'S1', 'Date/Time': '45821.5', MSPEC: '4003', 'Item #': '410805', 'Bundle #': '12',
  'Thickness Average': '1.1', Density: 'alice', User: 'note'
};
const nativeS1 = {
  __plant: 'foam', Line: 'S1', 'Date/Time': '45821.5', MSPEC: '4003', 'Item #': '410805', 'Bundle #': '12',
  'Thickness Average': '0.255', Density: '1.1', User: 'alice', 'Tape Color': 'BLUE', 'Bundle Tight/Loose': 'TIGHT'
};
const s4Once = {
  __plant: 'foam', Line: 'S4', 'Date/Time': '45822', MSPEC: '4780', 'Item #': '3030053', 'Bundle #': '4',
  'Thickness Average': '0.52', Density: '1.6', User: 'bob'
};
assert.equal(testRowIdentity(shiftedS1), testRowIdentity(nativeS1));
assert.notEqual(testRowIdentity(shiftedS1), testRowIdentity(s4Once));
const deduped = testDedupeHistoryRows([shiftedS1, s4Once, nativeS1, Object.assign({}, s4Once)]);
assert.equal(deduped.length, 2);
assert.equal(deduped.find(r => r.Line === 'S1'), nativeS1);
assert.equal(deduped.filter(r => r.Line === 'S4').length, 1);

console.log('parse-diegraph tests passed');
