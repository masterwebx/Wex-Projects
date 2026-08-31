import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const vba = fs.readFileSync(path.join(dir, 'CopyForGraphS4.bas'), 'utf8');
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
  if (compact.some(h => h === 'monoorcoex' || h === 'basisweight' || h === 'bwtarget')) return true;
  if (compact.includes('material') && compact.some(h => h === 'time' || h === 'dateint' || h === 'structure')) return true;
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
  const sections = { CURRENT: [], LOOKUP: [], TABLES4: [], TABLES1S3: [], TABLESBUBBLE: [], TABLESGARLAND: [], TABLESP1: [], TABLESRTS: [] };
  let cur = null;
  for (const line of lines.slice(1)) {
    const m = line.trim().match(/^\[(CURRENT|LOOKUP|TABLES4|TABLES1S3|TABLESBUBBLE|TABLESGARLAND|TABLESP1|TABLESRTS|HISTORY)\]$/i);
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
assert.ok(!fs.existsSync(path.join(dir, 'CopyForGraph.bas')));
assert.match(vba, /Attribute VB_Name = "CopyForGraphS4"/);
assert.match(vba, /densMin=/);
assert.match(vba, /cellMd=/);
assert.match(vba, /width=/);
assert.match(vba, /CopyForGraphS1S3\.bas/);
assert.match(vba, /WriteHandoffAndOpenHta/);
assert.match(vba, /1 - Quality\\Wex Quality/);
assert.match(vba, /qualitydesk\.hta/);
assert.match(vba, /DIEGRAPH2\.txt/);
assert.match(vba, /\[TABLES4\]/);
assert.match(vba, /source=S4/);
assert.match(vba, /SheetByName\("S4"\)/);
assert.match(vba, /Data S4/);
assert.match(vba, /TableS4/);
assert.match(vba, /Range\("B8"\)/);
assert.match(vba, /Range\("B12"\)/);
assert.doesNotMatch(vba, /\[TABLES1S3\]/);
assert.match(vbaS1, /WriteHandoffAndOpenHta/);
assert.match(vbaS1, /1 - Quality\\Wex Quality/);
assert.match(vbaS1, /qualitydesk\.hta/);
assert.match(vbaS1, /DIEGRAPH2\.txt/);

assert.match(vbaS1, /Attribute VB_Name = "CopyForGraphS1S3"/);
assert.match(vbaS1, /CopyForGraphS4\.bas/);
assert.match(vbaS1, /SheetByName\("S1 S3"\)/);
assert.match(vbaS1, /Data S1 S3/);
assert.match(vbaS1, /TableS1S3/);
assert.match(vbaS1, /source=S1S3/);
assert.match(vbaS1, /\[TABLES1S3\]/);
assert.match(vbaS1, /Range\("B14"\)/);
assert.match(vbaS1, /Range\("B12"\)/);
assert.match(vbaS1, /Range\("B10"\)/);
assert.doesNotMatch(vbaS1, /Data S4/);
assert.doesNotMatch(vbaS1, /SheetByName\("S4"\)/);
assert.doesNotMatch(vbaS1, /\[TABLES4\]/);

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
assert.match(vbaFrom, /WriteHandoffAndOpenHta/);
assert.match(vbaFrom, /qualitydesk\.hta/);
assert.match(vbaFrom, /DIEGRAPH2\.txt/);
assert.match(vbaFrom, /NOT into S4\.xlsm/);
assert.match(vbaFrom, /S1 S3\.xlsm, Bubble\.xlsm, P1\.xlsm, or RTS\.xlsm/);
assert.doesNotMatch(vbaFrom, /Application\.Run/);
assert.doesNotMatch(vbaFrom, /CopyForGraph\.CopyForGraph/);
assert.doesNotMatch(vbaFrom, /CopyForGraphS1S3\.CopyForGraph/);
assert.doesNotMatch(vbaFrom, /Left\$\(src, i\)/);

assert.match(html, /data-screen="welcome"/);
assert.match(html, /SAP\.csv/);
assert.match(html, /function currentSheetSourceLabel/);
assert.match(html, /TABLES1S3/);
assert.match(html, /Reload from disk/);
assert.doesNotMatch(html, /Put[\s\S]{0,80}SAP\.csv[\s\S]{0,80}quality-desk\.hta/);
assert.match(html, /MISSING CHECK/);
assert.match(html, /filterJustOpened/);
assert.doesNotMatch(html, /id="welcomePasteMore"/);
assert.doesNotMatch(html, /id="histPasteMore"/);
assert.match(html, /id="histMspecs"/);
assert.match(html, /id="screenMspecs"/);
assert.match(html, /id="welcomeHistory"/);
assert.match(html, /id="welcomeTrends"/);
assert.match(html, /id="welcomeSpc"/);
assert.match(html, /id="welcomeCompliance"/);
assert.match(html, /id="screenTrends"/);
assert.match(html, /id="trendsSection"/);
assert.match(html, /function goTo/);
assert.match(html, /function goBack/);
assert.match(html, /function renderCrumbs/);
assert.match(html, /function cpkBundle/);
assert.match(html, /function buildComplianceData/);
assert.match(html, /function filterComplianceData/);
assert.match(html, /function aggregateMissedByDay/);
assert.match(html, /function aggregateMissedByWeek/);
assert.match(html, /function aggregateFailsByWeek/);
assert.match(html, /function groupFailTypes/);
assert.match(html, /function groupFailKeys/);
assert.match(html, /function weekKeyFromYmd/);
assert.match(html, /function spcDataMonths/);
assert.match(html, /function spcCompressedScale/);
assert.match(html, /function openHistoryForTrendBar/);
assert.match(html, /id="trendItemChart"/);
assert.match(html, /id="trendMspecChart"/);
assert.match(html, /Quality fails by item #/);
assert.match(html, /Fails by MSPEC/);
assert.match(html, /Missed checks by week/);
assert.match(html, /Fails by week/);
assert.match(html, /Each check is one step across/);
assert.match(html, /No failing items/);
assert.match(html, /trendFailPtsLabel/);
assert.match(html, /id="spcSeries"/);
assert.match(html, /Each T point over time/);
assert.doesNotMatch(html, /id="spcStatsBtn"/);
assert.match(html, /id="spcStatsBox"/);
assert.match(html, /id="welcomeDocs"/);
assert.match(html, /id="screenDocs"/);
assert.match(html, /function openDocs/);
assert.match(html, /function spcIndexAtSerial/);
assert.match(html, /goTo\(['"]view['"], \{ mode: ['"]centration['"] \}\)/);
assert.match(html, /src="vendor\/chart\.umd\.min\.js"/);
assert.doesNotMatch(html, /cdn\.jsdelivr\.net/);
assert.doesNotMatch(html, /fonts\.googleapis\.com/);
assert.doesNotMatch(html, /fonts\.gstatic\.com/);
assert.doesNotMatch(html, /id="welcomeEnter"/);
assert.match(html, /APP_VERSION/);
assert.match(html, /function persistPack/);
assert.match(html, /function canonMspec/);
assert.match(html, /Lower Control/);
assert.match(html, /id="histTable"/);
assert.match(html, /Reset filters/);
assert.match(html, /id="filterBar"/);
assert.match(html, /id="histResetFilters"/);
assert.match(html, /function resetFilters/);
assert.match(html, /timeZone:\s*['"]UTC['"]/);
assert.match(html, /getUTCFullYear/);
assert.match(html, /excelSerialDate/);
assert.match(html, /isoToExcelSerial/);
assert.doesNotMatch(html, /id="histClearFilters"/);
assert.match(html, /data-view/);
assert.match(html, /id="viewBack"/);
assert.match(html, /class="crumbs"/);
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
assert.match(html, /leavingChart && screenName === 'view'/);
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
assert.match(html, /APP_VERSION = ["']1\.7\.60["']/);
assert.match(html, /if \(cell === ""\) continue;/);
assert.match(html, /histJumpDate/);
assert.match(html, /"T13"/);
assert.match(html, /"Reason for Check"/);
assert.match(html, /function fileUrl\(rel\)/);
assert.match(html, /location\.protocol \|\| ""\)\.toLowerCase\(\) === "file:"/);
assert.match(html, /src = src\.replace\(\/\\\?t=\\d\+\$\/, ""\)/);
assert.match(html, /timeoutMs \|\| 20000/);
assert.match(html, /\(0, eval\)\(stripBom\(text\)\)/);
assert.match(html, /Quality Desk History/);
assert.match(html, /function claimHtmlInstance/);
assert.match(html, /function maximizeHtml/);
assert.match(html, /idx % 800/);
assert.match(html, /id="welcomeReloadDisk"/);
assert.match(html, /id="histReloadDisk"/);
assert.match(html, /function applyDiskHandoff/);
assert.match(html, /function readDiskHandoff/);
assert.match(html, /QD_DISK_MANIFEST/);
assert.match(html, /timeoutMs/);
assert.match(html, /results\/manifest\.js/);
assert.match(html, /__source !== 'hta'/);
assert.match(html, /data-docs="offline"/);
assert.match(html, /docs-aid-offline/);
assert.match(html, /quality-desk\.hta/);
assert.match(html, /id="spcSeriesGraph"/);
assert.match(html, /id="seriesLimit"/);
assert.match(html, /id="seriesBtn"/);
assert.match(html, /function openSeriesGraph/);
assert.match(html, /function drawSeriesCentration/);
assert.match(html, /function seriesPointRows/);
assert.match(html, /function seriesLimitN/);
assert.match(html, /function takeLast/);
assert.match(html, /function normalizeViewMode/);
assert.match(html, /docs-aid-series/);
assert.match(html, /data-docs="series"/);
function takeLast(rows, n) {
  const list = rows || [];
  if (!isFinite(n) || list.length <= n) return list;
  return list.slice(list.length - n);
}
assert.deepEqual(takeLast([1, 2, 3, 4, 5], 2), [4, 5]);
assert.deepEqual(takeLast([1, 2], Infinity), [1, 2]);
assert.equal((function seriesLimitN(raw) {
  if (raw === 'all') return Infinity;
  const n = parseInt(raw, 10);
  return isFinite(n) && n > 0 ? n : 50;
})('50'), 50);
assert.equal((function seriesLimitN(raw) {
  if (raw === 'all') return Infinity;
  const n = parseInt(raw, 10);
  return isFinite(n) && n > 0 ? n : 50;
})('all'), Infinity);
assert.match(html, /function firstOfPriorMonthYmd/);
assert.match(html, /function sortKeysByCount/);
assert.match(html, /function spcXAt/);
assert.match(html, /function spcXLayout/);
assert.match(html, /function spcFilledTimes/);
assert.match(html, /function showDocsTopic/);
assert.match(html, /function bindTrendCombo/);
assert.match(html, /function trendNeedle/);
assert.match(html, /function trendSelectedKey/);
assert.match(html, /function trendMatchesItem/);
assert.match(html, /itemWithTargets\(key\)/);
assert.match(html, /class="trend-plot"/);
assert.match(html, /let trendPick/);
assert.match(html, /function exclusiveTrendPick/);
assert.match(html, /function clearTrendCombo/);
assert.match(html, /function syncTrendExclusiveUi/);
assert.match(html, /trends-body > \*/);
assert.match(html, /fails\?\|pts\?/);
assert.match(html, /Each check is one step across/);
assert.match(html, /id="docsNav"/);
assert.match(html, /docs-aid-radial/);
assert.match(html, /docs-aid-spc/);
assert.match(html, /docs-aid-cpk/);
assert.match(html, /docs-aid-trends/);
assert.match(html, /id="trendItemCombo"/);
assert.match(html, /id="trendMspecCombo"/);
assert.match(html, /<input type="search" id="trendItem"/);
assert.match(html, /<input type="search" id="trendMspec"/);
assert.doesNotMatch(html, /<select id="trendItem"/);
assert.match(html, /sortKeysByCount\(counts\)/);
assert.match(html, /spcXAt\(plot, pts/);

function firstOfPriorMonthYmd(now) {
  const d = now instanceof Date ? now : new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  return `${m === 0 ? y - 1 : y}-${String(m === 0 ? 12 : m).padStart(2, '0')}-01`;
}
assert.equal(firstOfPriorMonthYmd(new Date(2026, 7, 26)), '2026-07-01');
assert.equal(firstOfPriorMonthYmd(new Date(2026, 0, 5)), '2025-12-01');
function sortKeysByCount(counts) {
  return Object.keys(counts || {}).sort((a, b) =>
    (Number(counts[b]) || 0) - (Number(counts[a]) || 0)
    || String(a).localeCompare(String(b), undefined, { numeric: true }));
}
assert.deepEqual(sortKeysByCount({ a: 2, b: 9, c: 9 }), ['b', 'c', 'a']);
function spcFilledTimes(pts) {
  const n = (pts || []).length;
  const times = new Array(n);
  let prev = NaN;
  for (let i = 0; i < n; i++) {
    const t = Number(pts[i] && pts[i].t);
    if (isFinite(t) && t > 0) { times[i] = t; prev = t; }
    else times[i] = prev;
  }
  let next = NaN;
  for (let i = n - 1; i >= 0; i--) {
    if (isFinite(times[i])) next = times[i];
    else times[i] = next;
  }
  return times;
}
function spcCalX(plot, t, t0, span) {
  const u = Math.min(1, Math.max(0, ((isFinite(t) ? t : t0) - t0) / span));
  return plot.x + u * plot.w;
}
function spcXLayout(plot, pts) {
  const n = (pts || []).length;
  if (!plot || n <= 0) return [];
  if (n === 1) return [plot.x + plot.w / 2];
  return pts.map((_, i) => plot.x + (i / (n - 1)) * plot.w);
}
function spcXAt(plot, pts, iOrTick, xs) {
  const n = (pts || []).length;
  if (!plot || n <= 0) return 0;
  if (n === 1) return plot.x + plot.w / 2;
  let i = -1;
  if (typeof iOrTick === 'number') i = iOrTick;
  else if (iOrTick && typeof iOrTick === 'object' && isFinite(Number(iOrTick.i))) i = Number(iOrTick.i);
  if (i >= 0 && xs && isFinite(xs[i])) return xs[i];
  if (i >= 0) return plot.x + (Math.min(n - 1, Math.max(0, i)) / (n - 1)) * plot.w;
  return plot.x;
}
const plot = { x: 100, w: 200 };
assert.equal(spcXAt(plot, [{ t: 10 }, { t: 20 }], 0), 100);
assert.equal(spcXAt(plot, [{ t: 10 }, { t: 20 }], 1), 300);
assert.equal(spcXAt(plot, [{ t: 10 }, { t: 20 }], { i: 0 }), 100);
const stacked = [{ t: 10, avg: 1 }, { t: 10, avg: 40 }, { t: 10, avg: 2 }, { t: 20, avg: 3 }];
const stackedXs = spcXLayout(plot, stacked);
assert.ok(stackedXs[1] > stackedXs[0] + 0.3);
assert.ok(stackedXs[2] > stackedXs[1] + 0.3);
assert.ok(stackedXs[2] < stackedXs[3]);
assert.equal(spcXAt(plot, stacked, 0, stackedXs), stackedXs[0]);
const sameDay = [{ t: 45800 }, { t: 45800 }, { t: 45800 }, { t: 45800 }, { t: 45800 }];
const sameXs = spcXLayout({ x: 0, w: 400 }, sameDay);
assert.ok(sameXs[0] < sameXs[4]);
assert.ok(sameXs[4] - sameXs[0] > 50);
for (let i = 1; i < sameXs.length; i++) assert.ok(sameXs[i] > sameXs[i - 1]);
const endStack = [{ t: 10 }, { t: 20 }, { t: 30 }, { t: 30 }, { t: 30 }, { t: 30 }, { t: 30 }, { t: 30 }, { t: 30 }, { t: 30 }];
const endXs = spcXLayout({ x: 0, w: 200 }, endStack);
for (let i = 1; i < endXs.length; i++) assert.ok(endXs[i] > endXs[i - 1] + 0.2);
assert.ok(endXs[endXs.length - 1] <= 200 + 1e-6);
assert.ok(endXs[endXs.length - 1] - endXs[2] > 10);
assert.doesNotMatch(html, /id="welcomeSap"/);
assert.doesNotMatch(html, /id="welcomePaste"/);
assert.match(html, /id="welcomeReloadDisk"/);
assert.match(html, /QD_DISK_SAP/);
assert.match(html, /applySapFromDisk/);
assert.match(html, /plantRows\('foam'\)\.length/);
assert.match(html, /data-spc-series="points"] canvas/);
assert.match(html, /max-height: none/);
assert.match(html, /function sapRealignRow/);
assert.match(html, /function sapLooksUnit/);
assert.match(html, /id="histSpace"/);
assert.match(html, /hist-virt/);
assert.match(html, /translate3d/);
assert.doesNotMatch(html, /function spacerRow/);
assert.match(html, /function rowPick/);
assert.match(html, /function cellDisplay/);
assert.match(html, /function ensurePostingRows/);
assert.match(html, /function rebuildSapDayIndex/);
assert.match(html, /function qualityRowsForDay/);
assert.match(html, /function spcDotStride/);
assert.match(html, /Loading postings/);
assert.match(html, /canvasLayoutKey/);
assert.doesNotMatch(html, /rows\.map\(r => rowHtml\(r\)\)\.join\(''\)/);
assert.match(html, /<title>Quality Desk<\/title>/);
assert.match(html, /<h1>Quality Desk<\/h1>/);
assert.match(html, /History, specs, compliance, trends, and posting checks/);
assert.match(html, /Centration graph/);
assert.match(html, /function syncDocTitle/);
assert.match(html, /FILE_PREFIX = 'quality-desk'/);
assert.doesNotMatch(html, /Die Centration Graph/);
assert.doesNotMatch(html, /Die Centration Radial Graph/);
assert.match(html, /\.comp-all-table \{ width: max-content/);
assert.match(html, /function complianceUncheckedByLine/);
assert.match(html, /function complianceAllLinesHtml/);
assert.match(html, /function complianceAllLineTable/);
assert.match(html, /function pdfDrawAllLinesUnchecked/);
assert.match(html, /Qty posted/);
assert.match(html, /comp-all-table/);
assert.match(html, /fmtDayDate/);
assert.match(html, /id="complianceChart"/);
assert.match(html, /data-comp/);
assert.match(html, /\.comp-legend\[hidden\]/);
assert.match(html, /Posted items with no quality check/);
assert.match(html, /Every posted item this week has a quality check/);
assert.match(html, /which lines posted items without a quality check/);
assert.match(html, /function spcComboStats/);
assert.match(html, /function spcPtsLabel/);
assert.match(html, /function countBySpcKey/);
assert.match(html, /class="spc-pts"/);
assert.match(html, /justify-content: flex-end/);
assert.match(html, /class="week-nav"/);
assert.doesNotMatch(html, /id="complianceMore"/);
assert.doesNotMatch(html, /function closeComplianceMore/);
assert.match(html, /id="complianceTheme"/);
assert.match(html, /id="complianceMspecs"/);
assert.match(html, />SAP audit</);
assert.doesNotMatch(html, /postingsOpt/);
assert.match(html, /if \(isPostingsPlant\(\)\) setActivePlant\('foam'/);
assert.match(html, /SAP_WORK_CENTERS/);
assert.match(html, /SAP_LINE_NAMES/);
assert.match(html, /no postings for COEX, S1, S3, S4, MONO, P1, or RTS/);
assert.match(html, /skipped \$\{otherLines\} other line/);
assert.match(html, /qualityDayItemIndex/);
assert.match(html, /Loading saved results/);
assert.match(html, /function sapMapWorkCenter/);
assert.match(html, /function parseSapTime/);
assert.match(html, /function sapHitsOnDay/);
assert.match(html, /function qualityNotesForRow/);
assert.match(html, /Checked previous day/);
assert.match(html, /function findSapHeaderRow/);
assert.match(html, /function sapColsFromHeader/);
assert.match(html, /qty in unit of entry/);
assert.match(html, /document date/);
assert.doesNotMatch(html, /No date \/ item rows found/);
assert.match(html, /function sapAuditToStore/);
assert.match(html, /function applyStoredSapAudit/);
assert.match(html, /sapAudit: sapAuditToStore\(\)/);
assert.match(html, /function dedupeHistoryRows/);
assert.match(html, /function rowHasNativeS1S3Keys/);
assert.match(html, /function rowDedupeScore/);
assert.doesNotMatch(html, /catcher\.addEventListener\('paste'/);
assert.match(html, /let applyingClipboard = false/);
assert.match(html, /All lines/);
assert.doesNotMatch(html, /id="complianceSap"/);
assert.doesNotMatch(html, /id="histSap"/);
assert.doesNotMatch(html, /id="histPaste"/);
assert.doesNotMatch(html, /id="complianceSapClear"/);
assert.match(html, /Load an SAP export to see postings/);
assert.match(html, /function summarizeChecks/);
assert.match(html, /function parseSapPairs/);
assert.match(html, /function loadSapFile/);
assert.match(html, /function sapDayHtml/);
assert.match(html, /function sapRowsForYmd/);
assert.match(html, /function complianceMergedRows/);
assert.match(html, /function complianceDayTableHtml/);
assert.match(html, /function parseSapNumber/);
assert.match(html, /function formatSapPosted/);
assert.match(html, /function sortComplianceRows/);
assert.match(html, /function sapUtcToLocal/);
assert.match(html, /function sapPlantTimeZone/);
assert.match(html, /SAP_PLANT_TZ = 'America\/Los_Angeles'/);
assert.match(html, /Posted \(PT\)/);
assert.match(html, /SAP Time of Entry/);
assert.doesNotMatch(html, /SAP posted in Pacific \(from UTC\)/);
assert.doesNotMatch(html.slice(html.indexOf('function parseSapPairs'), html.indexOf('function sapPrevYmd')), /sapUtcToLocal/);
assert.match(html, /function sapZoneToZone/);
assert.match(html, /function plantFromLine/);
assert.match(html, /function plantForItemDay/);
assert.match(html, /function itemFilterKey/);
assert.match(html, /data-comp-line/);
assert.match(html, /setActivePlant\(plant, \{ keepFilters: true \}\)/);
assert.match(html, /function sapQtyCombined/);
assert.match(html, /function sapPostedList/);
assert.match(html, /function fmtDayDate/);
assert.match(html, /function periodWithDayDate/);
assert.match(html, /function pdfFailNotes/);
assert.match(html, /pdfFailNotes\(r\.fails\)/);
assert.doesNotMatch(html, /r\.fails\.join\('; '\) \|\| '—'/);
assert.match(html, /function detectSapDelim/);
assert.match(html, /Try a CSV export from SAP/);
assert.match(html, /function isHeaderishLine/);
assert.match(html, /function realLineName/);
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
assert.match(html, /function historyExcelFilename/);
assert.match(html, /function xlsxUniqueHeaders/);
assert.match(html, /numFmtId="164"/);
assert.doesNotMatch(html, /<sheetData>\$\{sheetData\}<\/sheetData>\s*<autoFilter/);
assert.match(html, /historyExcelFilename\(\)/);
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
assert.match(html, /id="compRptModeCombined"/);
assert.match(html, /Combined All lines \(one PDF\)/);
assert.match(html, /function syncCompRptMode/);
assert.match(html, /all-lines/);
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
assert.match(html, /function postingRows/);
assert.match(html, /function isPostingsPlant/);
assert.match(html, /POSTING_COLS/);
assert.match(html, /option value="postings">Postings/);
assert.doesNotMatch(html, /POSTINGS_LINE/);
assert.match(html, /data-post-item/);
assert.match(html, /postings: 'Postings'/);
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
  const s = String(v || '').trim().toUpperCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  return s === 'NO CHECK' || s === 'LINE DOWN' || s === 'LINE UP'
    || s === 'EQUIPMENT FAIL' || s === 'EQUIPMENT FAILURE'
    || s === 'NO ORDERS' || s === 'PREVENTATIVE MAINTENANCE'
    || s === 'STARTUP' || s === 'DIE CHANGE' || s === 'CYLINDER CHANGE';
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
assert.equal(hourComplianceStatus(['LINE DOWN'], false), 'nocheck');
assert.equal(hourComplianceStatus(['LINE UP'], false), 'nocheck');
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
  if (t === 'foam' || t === 'bubble' || t === 'garland' || t === 'p1' || t === 'rts') return t;
  const line = String(col(row, 'Line') || '').trim().toUpperCase();
  if (/^GARLAND\s*(COEX|MONO)$/.test(line) || /^G-?(COEX|MONO)$/.test(line)) return 'garland';
  if (line === 'COEX' || line === 'MONO') return 'bubble';
  if (line === 'P1') return 'p1';
  if (line === 'RTS') return 'rts';
  return 'foam';
}
assert.equal(inferPlant({ Line: 'S4' }), 'foam');
assert.equal(inferPlant({ Line: 'S1' }), 'foam');
assert.equal(inferPlant({ Line: 'COEX' }), 'bubble');
assert.equal(inferPlant({ Line: 'MONO' }), 'bubble');
assert.equal(inferPlant({ Line: 'Garland COEX' }), 'garland');
assert.equal(inferPlant({ Line: 'Garland MONO' }), 'garland');
assert.equal(inferPlant({ __plant: 'garland', Line: 'COEX' }), 'garland');
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
const pdfApi = new Function(pdfChunk + '; return { writePdf, newPdfDoc, pdfAddPage, pdfText, pdfFillRect, pdfWrap };')();
const pdfDoc = pdfApi.newPdfDoc(612, 792);
const pdfPage = pdfApi.pdfAddPage(pdfDoc);
pdfApi.pdfText(pdfPage, 40, 40, 'Compliance report', { size: 16, bold: true });
pdfApi.pdfFillRect(pdfPage, 40, 60, 20, 20, '#22c55e');
const pdfBytes = pdfApi.writePdf(pdfDoc);
assert.equal(Buffer.from(pdfBytes.subarray(0, 8)).toString(), '%PDF-1.4');
assert.ok(pdfBytes.length > 400);
assert.ok(!Buffer.from(pdfBytes).includes(Buffer.from('/DCTDecode')));
assert.deepEqual(pdfApi.pdfWrap('- 5:16 PM range over\n- 7:31 PM density over', 8, 400), [
  '- 5:16 PM range over',
  '- 7:31 PM density over'
]);

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
function parseSapNumber(v) {
  if (v == null || v === '') return NaN;
  if (typeof v === 'number' && isFinite(v)) return v;
  const s = String(v).trim().replace(/,/g, '');
  if (!s || s[0] === '#') return NaN;
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}
function parseSapDate(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = parseSapNumber(s);
  if (isFinite(n) && n > 20000 && n < 80000) {
    const dt = new Date(Math.round((n - 25569) * 86400000));
    if (!isNaN(dt.getTime())) return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }
  if (/^\d{8}$/.test(s)) {
    const y = +s.slice(0, 4), m = +s.slice(4, 6), d = +s.slice(6, 8);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { y, m, d };
  }
  const m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  const m2 = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m2) {
    let y = +m2[3];
    if (y < 100) y += 2000;
    return { y, m: +m2[1], d: +m2[2] };
  }
  return null;
}
const SAP_WORK_CENTERS = {
  VISCBE01: 'COEX', VISFSE01: 'S1', VISFSE03: 'S3', VISFSE04: 'S4',
  VISMBE01: 'MONO', VISMSL01: 'RTS', VISPLE01: 'P1'
};
function looksLikeLineValue(v) {
  return /^(S[134]|COEX|MONO|P1|RTS|S1\s*S3)$/i.test(String(v ?? '').trim());
}
function looksLikeWorkCenter(v) {
  return /^VIS[A-Z]{2,3}\d{2}$/i.test(String(v || '').trim());
}
function sapLooksUnit(v) {
  return /^(EA|PC|PCS|KG|LB|M|FT|CS|RL|ROL|BDL|BAG|PAL|PK|PKS|BOX)$/i.test(String(v || '').trim());
}
function sapRealignRow(row, cols) {
  const wcIdx = cols && cols.wc;
  if (!row || wcIdx == null || wcIdx < 0) return row;
  if (looksLikeWorkCenter(row[wcIdx])) return row;
  let found = -1;
  for (let i = 0; i < row.length; i++) {
    if (looksLikeWorkCenter(row[i])) { found = i; break; }
  }
  if (found < 0 || found === wcIdx) return row;
  const out = row.slice();
  const delta = wcIdx - found;
  let at = -1;
  if (cols.qtyEntry >= 0 && sapLooksUnit(out[cols.qtyEntry]) && !sapLooksUnit(out[cols.unit])) at = cols.qtyEntry;
  else if (cols.unit >= 0 && !sapLooksUnit(out[cols.unit]) && isFinite(parseSapNumber(out[cols.unit]))) at = cols.unit;
  else if (cols.qty >= 0 && sapLooksUnit(out[cols.qty])) at = cols.qty;
  if (at < 0) {
    at = delta > 0
      ? (cols.unit >= 0 ? cols.unit + 1 : (cols.qtyEntry >= 0 ? cols.qtyEntry + 1 : wcIdx))
      : wcIdx;
  }
  if (delta > 0) {
    for (let k = 0; k < delta; k++) out.splice(at, 0, '');
  } else {
    out.splice(at, -delta);
  }
  return out;
}
function sapMapWorkCenter(v) {
  const key = String(v ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (SAP_WORK_CENTERS[key]) return SAP_WORK_CENTERS[key];
  if (looksLikeLineValue(v)) return key;
  return '';
}
function sapNormHeader(h) {
  return String(h || '').replace(/\s+/g, ' ').trim().toLowerCase();
}
function sapHeaderKind(h) {
  const s = sapNormHeader(h);
  if (!s) return '';
  if (s === 'work center') return 'wc';
  if (s === 'line') return 'line';
  if (s === 'time of entry' || s === 'time') return 'time';
  if (s === 'entry date') return 'entryDate';
  if (s === 'posting date') return 'postingDate';
  if (s === 'document date') return 'docDate';
  if (s === 'date') return 'date';
  if (s === 'material description' || s === 'description') return 'desc';
  if (s === 'material' || s === 'item' || s === 'item #') return 'item';
  if (s === 'quantity' || s === 'qty') return 'qty';
  if (s === 'qty in unit of entry') return 'qtyEntry';
  if (s === 'unit of entry' || s === 'unit') return 'unit';
  return '';
}
function sapHeaderScore(row) {
  const kinds = new Set();
  (row || []).forEach(h => { const k = sapHeaderKind(h); if (k) kinds.add(k); });
  return kinds.size;
}
function findSapHeaderRow(grid) {
  let best = -1, bestScore = 0;
  for (let i = 0; i < Math.min(grid.length, 50); i++) {
    const score = sapHeaderScore(grid[i]);
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return bestScore >= 2 ? best : -1;
}
function sapColsFromHeader(header) {
  const cols = {
    date: -1, entryDate: -1, postingDate: -1, docDate: -1,
    item: -1, line: -1, wc: -1, time: -1, desc: -1, qty: -1, qtyEntry: -1, unit: -1
  };
  (header || []).forEach((h, i) => {
    const kind = sapHeaderKind(h);
    if (kind && cols[kind] < 0) cols[kind] = i;
  });
  if (cols.date < 0) cols.date = cols.entryDate >= 0 ? cols.entryDate
    : (cols.postingDate >= 0 ? cols.postingDate : cols.docDate);
  if (cols.qty < 0) cols.qty = cols.qtyEntry;
  return cols;
}
function sapPickDate(row, cols) {
  for (const key of ['entryDate', 'postingDate', 'docDate', 'date']) {
    if (cols[key] >= 0) {
      const dt = parseSapDate(row[cols[key]]);
      if (dt) return dt;
    }
  }
  return null;
}
function parseSapTime(v) {
  const s = String(v ?? '').trim();
  const n = parseSapNumber(s);
  if (isFinite(n)) {
    const frac = n >= 1 ? n - Math.floor(n) : n;
    if (frac >= 0 && frac < 1) {
      const mins = Math.round(frac * 24 * 60);
      return { hour: Math.floor(mins / 60) % 24, minute: mins % 60, text: `${Math.floor(mins / 60) % 24}:${String(mins % 60).padStart(2, '0')}` };
    }
  }
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  if (!m) return { hour: NaN, minute: 0, text: /e/i.test(s) ? '' : s };
  let hour = +m[1];
  const minute = +m[2];
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && hour < 12) hour += 12;
  if (ap === 'AM' && hour === 12) hour = 0;
  return { hour, minute, text: s };
}
function parseSapPairs(grid) {
  const headerAt = findSapHeaderRow(grid);
  const header = (headerAt >= 0 ? grid[headerAt] : grid[0]) || [];
  const cols = sapColsFromHeader(header);
  const start = headerAt >= 0 ? headerAt + 1 : 0;
  const out = [];
  if (cols.item < 0) return out;
  for (let i = start; i < grid.length; i++) {
    let row = grid[i];
    if (!row || !row.length) continue;
    row = sapRealignRow(row, cols);
    const dt = sapPickDate(row, cols);
    const item = String(row[cols.item] ?? '').trim();
    if (!dt || !sapItemKey(item)) continue;
    const wc = cols.wc >= 0 ? String(row[cols.wc] || '').trim() : '';
    const rawLine = cols.line >= 0 ? String(row[cols.line] || '').trim() : '';
    const line = sapMapWorkCenter(wc) || sapMapWorkCenter(rawLine);
    if ((cols.wc >= 0 || cols.line >= 0 || wc || rawLine) && !line) continue;
    const tm = parseSapTime(cols.time >= 0 ? row[cols.time] : '');
    out.push({
      y: dt.y, m: dt.m, d: dt.d, item, itemKey: sapItemKey(item),
      line,
      desc: cols.desc >= 0 ? String(row[cols.desc] || '').trim() : '',
      qty: cols.qty >= 0 ? String(row[cols.qty] || '').trim() : '',
      unit: cols.unit >= 0 ? String(row[cols.unit] || '').trim() : '',
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
assert.equal(sapHeaderKind('Qty in unit of entry'), 'qtyEntry');
assert.equal(sapHeaderKind('Unit of Entry'), 'unit');
assert.equal(sapHeaderKind('Time of Entry'), 'time');
assert.equal(sapHeaderKind('Entry Date'), 'entryDate');
assert.equal(sapHeaderKind('Posting Date'), 'postingDate');
assert.equal(sapHeaderKind('Document Date'), 'docDate');
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
const sapLiveHeader = ['Plant','Document Date','Posting Date','Material','Material Description','Quantity','Qty in unit of entry','Unit of Entry','Amt.in Loc.Cur.','Material Document','Order','Movement Type Text','Purchase order','Document Header Text','User Name','Time of Entry','Entry Date','Work Center','Movement Type','Movement indicator','Storage Location','Reason for Movement'];
const sapLive = parseSapPairs([
  ['Goods movements'],
  [],
  sapLiveHeader,
  ['1000', '8/19/2026', '8/20/2026', '3030053', 'AF500 foam plank', '2400', '2400', 'LB', '12', '490001', '100', 'GI', '', '', 'JSMITH', '14:32:00', '8/20/2026', 'VISFSE04', '101', '', 'FG', ''],
  ['1000', '8/20/2026', '8/21/2026', '410805', 'AF250 roll', '18.5', '18.5', 'ROL', '3', '490002', '101', 'GI', '', '', 'JDOE', '02:05:00', '8/21/2026', 'VISFSE01', '101', '', 'FG', '']
]);
assert.equal(findSapHeaderRow([
  ['Goods movements'],
  [],
  sapLiveHeader
]), 2);
assert.equal(sapLive.length, 2);
assert.equal(sapLive[0].itemKey, '3030053');
assert.equal(sapLive[0].desc, 'AF500 foam plank');
assert.equal(sapLive[0].qty, '2400');
assert.equal(sapLive[0].unit, 'LB');
assert.equal(sapLive[0].line, 'S4');
assert.equal(sapLive[0].d, 20);
assert.equal(sapLive[0].m, 8);
assert.equal(sapLive[1].line, 'S1');
assert.equal(sapLive[1].itemKey, '410805');
const sapOtherLines = parseSapPairs([
  sapLiveHeader,
  ['6509', '8/23/2026', '8/23/2026', '471345', 'LAB roll', '91', '91', 'BDL', '', '', '', '', '', '', '', '17:10', '8/23/2026', 'VISCBE01', '', '', '', ''],
  ['6509', '8/23/2026', '8/23/2026', '111111', 'warehouse', '5', '5', 'EA', '', '', '', '', '', '', '', '17:11', '8/23/2026', 'VISWARE01', '', '', '', ''],
  ['6509', '8/23/2026', '8/23/2026', '222222', 'no wc', '1', '1', 'EA', '', '', '', '', '', '', '', '17:12', '8/23/2026', '', '', '', '', '']
]);
assert.equal(sapOtherLines.length, 1);
assert.equal(sapOtherLines[0].itemKey, '471345');
assert.equal(sapOtherLines[0].line, 'COEX');
const sapSerial = parseSapDate('46257');
assert.equal(sapSerial.y, 2026);
assert.equal(sapSerial.m, 8);
assert.equal(sapSerial.d, 23);
const sapSerialRow = parseSapPairs([
  ['Material', 'Entry Date', 'Work Center', 'Quantity', 'Unit of Entry', 'Time of Entry', 'Material Description'],
  ['471345', '46257', 'VISCBE01', '91', 'BDL', '0.71539351851851996', 'LAB 2/24"X250\' P12"']
]);
assert.equal(sapSerialRow.length, 1);
assert.equal(sapSerialRow[0].itemKey, '471345');
assert.equal(sapSerialRow[0].line, 'COEX');
assert.equal(sapSerialRow[0].y, 2026);
assert.equal(sapSerialRow[0].m, 8);
assert.equal(sapSerialRow[0].d, 23);
assert.equal(sapSerialRow[0].qty, '91');
function formatSapPosted(v) {
  const n = parseSapNumber(v);
  if (isFinite(n) && n >= 0 && n < 1) {
    const mins = Math.round(n * 24 * 60);
    const hour = Math.floor(mins / 60) % 24;
    const minute = mins % 60;
    const h = ((hour + 11) % 12) + 1;
    return `${h}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
  }
  return String(v || '');
}
assert.equal(formatSapPosted('4.5138888888889998E-2'), '1:05 AM');
assert.equal(formatSapPosted('5:00 AM'), '5:00 AM');
function detectSapDelim(line) {
  const s = String(line || '');
  const tab = (s.match(/\t/g) || []).length;
  const semi = (s.match(/;/g) || []).length;
  let comma = 0, q = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"') q = !q;
    else if (s[i] === ',' && !q) comma += 1;
  }
  if (tab && tab >= semi && tab >= comma) return '\t';
  if (semi > comma) return ';';
  return ',';
}
assert.equal(detectSapDelim('Plant\tDocument Date\tMaterial'), '\t');
assert.equal(detectSapDelim('Plant;Document Date;Material'), ';');
assert.equal(detectSapDelim('Plant,Document Date,Material'), ',');
function parseDelimitedGrid(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => String(l).trim());
  const delim = detectSapDelim(lines[0] || '');
  return lines.map(line => {
    if (delim === '\t') return line.split('\t');
    const out = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i++; }
        else if (q || cur.length === 0) q = !q;
        else cur += ch;
      } else if (ch === delim && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  });
}
const sapInchCsv = parseDelimitedGrid('Material,Material Description,Quantity\n43013,AF125 1/8 48"X450\',172');
assert.equal(sapInchCsv[1][1], 'AF125 1/8 48"X450\'');
assert.equal(sapInchCsv[1][2], '172');
const sapCsv = parseSapPairs([
  'Plant;Document Date;Posting Date;Material;Material Description;Quantity;Time of Entry;Entry Date;Work Center'.split(';'),
  '6509;8/24/2026;8/24/2026;303405;SPC SLIP;7;10:00:14 AM;8/24/2026;VISCBE01'.split(';')
]);
assert.equal(sapCsv.length, 1);
assert.equal(sapCsv[0].itemKey, '303405');
assert.equal(sapCsv[0].line, 'COEX');
function sortComplianceRows(rows) {
  return rows.slice().sort((a, b) => {
    const lc = String(a.line || '~~~~').localeCompare(String(b.line || '~~~~'), undefined, { numeric: true });
    if (lc) return lc;
    if (!!a.hasCheck !== !!b.hasCheck) return a.hasCheck ? -1 : 1;
    const av = finiteNum(a.firstSerial) ? a.firstSerial : (a.hasCheck ? 50000 : 60000 + (a.postedMins || 0) / 1440);
    const bv = finiteNum(b.firstSerial) ? b.firstSerial : (b.hasCheck ? 50000 : 60000 + (b.postedMins || 0) / 1440);
    return av - bv;
  });
}
const sortedDay = sortComplianceRows([
  { item: 'A', hasCheck: false, postedMins: 18 * 60, firstSerial: NaN },
  { item: 'B', hasCheck: true, postedMins: 16 * 60, firstSerial: 46258.5 },
  { item: 'C', hasCheck: true, postedMins: NaN, firstSerial: 46258.65 },
  { item: 'D', hasCheck: false, postedMins: 5 * 60, firstSerial: NaN }
]);
assert.deepEqual(sortedDay.map(r => r.item), ['B', 'C', 'D', 'A']);
const sortedLines = sortComplianceRows([
  { item: 'X', line: 'S4', hasCheck: false, firstSerial: NaN, postedMins: 60 },
  { item: 'Y', line: 'COEX', hasCheck: true, firstSerial: 46258.8, postedMins: NaN },
  { item: 'Z', line: 'S4', hasCheck: true, firstSerial: 46258.2, postedMins: NaN },
  { item: 'W', line: 'COEX', hasCheck: false, firstSerial: NaN, postedMins: 120 }
]);
assert.deepEqual(sortedLines.map(r => r.item), ['Y', 'W', 'Z', 'X']);
function sapQtyCombined(saps) {
  let total = 0;
  for (const sap of saps) total += Number(String(sap.qty).replace(/,/g, ''));
  return `${total} ${saps[0].unit} · ${saps.length} postings`;
}
assert.equal(sapQtyCombined([
  { qty: '20', unit: 'BDL' }, { qty: '102', unit: 'BDL' }, { qty: '101', unit: 'BDL' }
]), '223 BDL · 3 postings');
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function fmtDayDate(y, m, d) {
  if (!y || !m || !d) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[dt.getUTCDay()]} ${m}/${d}`;
}
assert.equal(fmtDayDate(2026, 8, 19), 'Wednesday 8/19');
assert.equal(fmtDayDate(2026, 8, 18), 'Tuesday 8/18');
function excelTimeShort(serial) {
  const dt = excelSerialDate(serial);
  return dt.toLocaleTimeString(undefined, { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' });
}
function dateParts(serial) {
  const dt = excelSerialDate(serial);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
function periodWithDayDate(first, last) {
  const t1 = excelTimeShort(first);
  const t2 = excelTimeShort(last);
  const p1 = dateParts(first);
  const p2 = dateParts(last);
  const d1 = fmtDayDate(p1.y, p1.m, p1.d);
  const d2 = fmtDayDate(p2.y, p2.m, p2.d);
  if (t1 && t2 && t1 !== t2) {
    if (d1 && d2 && d1 !== d2) return `${d1} ${t1} – ${d2} ${t2}`;
    const day = d1 || d2;
    return day ? `${day} ${t1} – ${t2}` : `${t1} – ${t2}`;
  }
  const t = t1 || t2;
  const day = d1 || d2;
  if (day && t) return `${day} ${t}`;
  return t || day || '';
}
const periodSameDay = periodWithDayDate(46253 + (17 * 60 + 16) / 1440, 46253 + (20 * 60 + 24) / 1440);
assert.match(periodSameDay, /Wednesday 8\/19/);
assert.match(periodSameDay, /5:16/);
assert.match(periodSameDay, /8:24/);
const periodPrevDay = periodWithDayDate(46252 + 21 / 24, 46252 + 22 / 24);
assert.match(periodPrevDay, /Tuesday 8\/18/);
function pdfFailNotes(fails) {
  const list = (fails || []).map(x => String(x || '').trim()).filter(Boolean);
  if (!list.length) return '—';
  return list.map(x => '- ' + x).join('\n');
}
assert.equal(pdfFailNotes(['5:16 PM range over', '7:31 PM density over']), '- 5:16 PM range over\n- 7:31 PM density over');
assert.equal(pdfFailNotes([]), '—');
function sapPostedList(saps) {
  const times = [];
  const seen = new Set();
  for (const sap of saps || []) {
    const t = sap.timeText;
    if (!t || seen.has(t)) continue;
    seen.add(t);
    times.push({ t, day: fmtDayDate(sap.y, sap.m, sap.d) });
  }
  const days = [...new Set(times.map(x => x.day).filter(Boolean))];
  if (days.length === 1) return `${days[0]} ${times.map(x => x.t).join(', ')}`;
  return times.map(x => (x.day ? `${x.day} ${x.t}` : x.t)).join(', ');
}
assert.equal(sapPostedList([
  { y: 2026, m: 8, d: 19, timeText: '8:50 PM' }
]), 'Wednesday 8/19 8:50 PM');
assert.equal(sapPostedList([
  { y: 2026, m: 8, d: 19, timeText: '3:55 PM' },
  { y: 2026, m: 8, d: 19, timeText: '12:20 PM' }
]), 'Wednesday 8/19 3:55 PM, 12:20 PM');
assert.equal(sapPostedList([
  { y: 2026, m: 8, d: 18, timeText: '9:00 PM' },
  { y: 2026, m: 8, d: 19, timeText: '3:55 PM' }
]), 'Tuesday 8/18 9:00 PM, Wednesday 8/19 3:55 PM');
function sapUtcToLocal(y, m, d, hour, minute, tz) {
  const utc = new Date(Date.UTC(y, m - 1, d, hour, minute || 0, 0));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz || 'America/Los_Angeles',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
  }).formatToParts(utc);
  const get = type => +((parts.find(p => p.type === type) || {}).value || 0);
  return { y: get('year'), m: get('month'), d: get('day'), hour: get('hour'), minute: get('minute') };
}
const sapLaEve = sapUtcToLocal(2026, 8, 17, 19, 55, 'America/Los_Angeles');
assert.deepEqual(sapLaEve, { y: 2026, m: 8, d: 17, hour: 12, minute: 55 });
const sapLaEarly = sapUtcToLocal(2026, 8, 17, 1, 0, 'America/Los_Angeles');
assert.deepEqual(sapLaEarly, { y: 2026, m: 8, d: 16, hour: 18, minute: 0 });
const sapLaAfternoon = sapUtcToLocal(2026, 8, 17, 16, 20, 'America/Los_Angeles');
assert.deepEqual(sapLaAfternoon, { y: 2026, m: 8, d: 17, hour: 9, minute: 20 });
const sapLaMorning = sapUtcToLocal(2026, 8, 17, 9, 5, 'America/Los_Angeles');
assert.deepEqual(sapLaMorning, { y: 2026, m: 8, d: 17, hour: 2, minute: 5 });
const sapNyEve = sapUtcToLocal(2026, 8, 17, 19, 55, 'America/New_York');
assert.deepEqual(sapNyEve, { y: 2026, m: 8, d: 17, hour: 15, minute: 55 });
function sapZoneToZone(y, m, d, hour, minute, fromTz, toTz) {
  const want = Date.UTC(y, m - 1, d, hour, minute || 0, 0);
  let guess = want;
  for (let i = 0; i < 4; i++) {
    const g = new Date(guess);
    const shown = sapUtcToLocal(g.getUTCFullYear(), g.getUTCMonth() + 1, g.getUTCDate(), g.getUTCHours(), g.getUTCMinutes(), fromTz);
    const delta = Date.UTC(shown.y, shown.m - 1, shown.d, shown.hour, shown.minute) - want;
    if (!delta) break;
    guess -= delta;
  }
  const g = new Date(guess);
  return sapUtcToLocal(g.getUTCFullYear(), g.getUTCMonth() + 1, g.getUTCDate(), g.getUTCHours(), g.getUTCMinutes(), toTz);
}
assert.deepEqual(
  sapZoneToZone(2026, 8, 17, 15, 55, 'America/New_York', 'America/Los_Angeles'),
  { y: 2026, m: 8, d: 17, hour: 12, minute: 55 }
);
function plantFromLine(line) {
  const s = String(line || '').trim().toUpperCase().replace(/\s+/g, '');
  if (s === 'GARLANDCOEX' || s === 'GARLANDMONO' || s === 'G-COEX' || s === 'G-MONO' || s === 'GCOEX' || s === 'GMONO') return 'garland';
  if (s === 'COEX' || s === 'MONO') return 'bubble';
  if (s === 'P1') return 'p1';
  if (s === 'RTS') return 'rts';
  if (/^S[134]$/.test(s) || s === 'S1S3') return 'foam';
  return '';
}
function itemFilterKey(plant) {
  const cols = { foam: ['Item #'], bubble: ['Item'], garland: ['Item #'], p1: ['Item #'], rts: ['Item #'] }[plant] || ['Item #'];
  return cols.includes('Item') && !cols.includes('Item #') ? 'Item' : 'Item #';
}
assert.equal(plantFromLine('COEX'), 'bubble');
assert.equal(plantFromLine('MONO'), 'bubble');
assert.equal(plantFromLine('Garland COEX'), 'garland');
assert.equal(plantFromLine('Garland MONO'), 'garland');
assert.equal(plantFromLine('S4'), 'foam');
assert.equal(plantFromLine('S1'), 'foam');
assert.equal(plantFromLine('P1'), 'p1');
assert.equal(plantFromLine('RTS'), 'rts');
assert.equal(itemFilterKey('bubble'), 'Item');
assert.equal(itemFilterKey('foam'), 'Item #');
assert.equal(itemFilterKey('garland'), 'Item #');
assert.deepEqual(parseSapDate('4.6257E4'), { y: 2026, m: 8, d: 23 });
assert.deepEqual(parseSapDate('4.6258E4'), { y: 2026, m: 8, d: 24 });
assert.equal(parseSapDate('5.2245370370369998E-2'), null);
const sapSciTime = parseSapTime('5.2245370370369998E-2');
assert.equal(sapSciTime.hour, 1);
assert.equal(sapSciTime.minute, 15);
const sapSciRow = parseSapPairs([
  ['Material', 'Entry Date', 'Work Center', 'Quantity', 'Time of Entry', 'Material Description'],
  ['471345', '4.6257E4', 'VISCBE01', '91', '5.2245370370369998E-2', 'LAB roll']
]);
assert.equal(sapSciRow.length, 1);
assert.equal(sapSciRow[0].itemKey, '471345');
assert.equal(sapSciRow[0].line, 'COEX');
assert.equal(sapSciRow[0].d, 23);
assert.equal(sapSciRow[0].hour, 1);
function isHeaderishLine(v) {
  return /^(line|item|item #|mspec|date\/?time|description|pass\/?fail)$/i.test(String(v || '').trim());
}
function realLineName(v) {
  const s = String(v || '').trim();
  return s && !isHeaderishLine(s) ? s : '';
}
assert.equal(realLineName('Line'), '');
assert.equal(realLineName('COEX'), 'COEX');
assert.equal(realLineName('S4'), 'S4');
assert.deepEqual([...new Set(['COEX', 'Line', 'S4'].map(realLineName).filter(Boolean))].sort(), ['COEX', 'S4']);
const sapUserSlice = parseSapPairs([
  sapLiveHeader,
  ['', '', '', '', '', '', '217203', 'BDL'],
  ['6509', '8/24/2026', '8/24/2026', '36761', 'AF750 HD2.2', '3', '3', 'BDL', '', '', '', '', '', '', '', '11:05:11 AM', '8/24/2026', 'VISFSE04', '101', 'F', 'FG', '0'],
  ['6509', '8/24/2026', '8/24/2026', '402567', 'AF060', '2', '2', 'BDL', '', '', '', '', '', '', '', '11:05:00 AM', '8/24/2026', 'VISPFR01', '101', 'F', 'FG', '0'],
  ['6509', '8/24/2026', '8/24/2026', '303405', 'SPC SLIP', '1', '1', 'BDL', '', '', '', '', '', '', '', '10:00:14 AM', '8/24/2026', 'VISCBE01', '101', 'F', 'FG', '0'],
  ['6509', '8/23/2026', '8/23/2026', '471345', 'LAB 2/24', '91', '91', 'BDL', '', '', '', '', '', '', '', '5:10:10 PM', '8/23/2026', 'VISCBE01', '101', 'F', 'FG', '0'],
  ['6509', '8/24/2026', '8/24/2026', '462270', 'PE LAM', '250', '250', 'EA', '', '', '', '', '', '', '', '9:15:11 AM', '8/24/2026', 'VISMSL01', '101', 'F', 'FG', '0']
]);
assert.equal(sapUserSlice.length, 4);
assert.deepEqual(sapUserSlice.map(r => r.line).sort(), ['COEX', 'COEX', 'RTS', 'S4']);
assert.ok(!sapUserSlice.some(r => r.itemKey === '402567'));
const sap1105 = sapUserSlice.find(r => r.itemKey === '36761');
assert.equal(sap1105.hour, 11);
assert.match(String(sap1105.timeText), /11:05/);
const sapShiftText = [
  sapLiveHeader.join('\t'),
  '6509\t8/13/2026\t8/13/2026\t43013\tAF125 1/8 48"X450\'\t172\t172\tBDL\t5699.91\t4910573454\t2914169\tGR for order\t\t\tBTCH-USER\t16:35:01\t8/13/2026\tVISFSE01\t101\tF\tFG\t0',
  '6509\t8/13/2026\t8/13/2026\t300715\tAF1000 1.7# WIP NA 53"X 200\'\t22\t22\tBDL\t2557.43\t4910573454\t2908363\tGR for order\t\t\tBTCH-USER\t16:35:01\t8/13/2026\tVISFSE04\t101\tF\tFG\t0',
  '6509\t8/13/2026\t8/13/2026\t3030054\tAF500 HD1.7# WIP WH 1/2 53"X 500\'\t40\t40\tBDL\t6290.67\t4910573419\t2916113\tGR for order\t\t\tBTCH-USER\t16:30:01\t8/13/2026\tVISFSE03\t101\tF\tFG\t0',
  '6509\t8/12/2026\t8/13/2026\t\tLABOR WISEMAN,JUSTIN 7/24/2026\t0\t1\tEA\t202\t5003071201\t\tGR for acct assgmnt\t4501145610\t\tPREYNOLDS\t16:15:17\t8/13/2026\t\t101\tB\t\t0',
  '6509\t8/13/2026\t8/13/2026\t44903\tMPC REG 1/48"X375\' P12",20"\t20\tBDL\t797.12\t4910573357\t2922232\tGR for order\t\t\tBTCH-USER\t16:10:00\t8/13/2026\tVISCBE01\t101\tF\tFG\t0\t',
  '6509\t8/13/2026\t8/13/2026\t439097\tPANTA PAK LA16 BLK A 500/CS\t96\t96\tCS\t4694.5\t4910573342\t2926746\tGR for order\t\t\tBTCH-USER\t16:05:00\t8/13/2026\tVISPPL01\t101\tF\tFG\t0',
  '6509\t8/12/2026\t8/13/2026\t\t15665A906 STEEL PIANO HINGE W/O HOLES\t0\t1\tEA\t4.55\t5003071200\t\tGR for acct assgmnt\t4501145634\t\tPREYNOLDS\t16:04:19\t8/13/2026\t\t101\tB\t\t0'
].join('\n');
const sapShifted = parseSapPairs(parseDelimitedGrid(sapShiftText));
assert.deepEqual(sapShifted.map(r => r.itemKey).sort(), ['300715', '3030054', '43013', '44903']);
const sapShift44903 = sapShifted.find(r => r.itemKey === '44903');
assert.equal(sapShift44903.line, 'COEX');
assert.equal(sapShift44903.workCenter, 'VISCBE01');
assert.equal(sapShift44903.qty, '20');
assert.equal(sapShift44903.unit, 'BDL');
assert.equal(sapShift44903.hour, 16);
assert.match(String(sapShift44903.timeText), /16:10/);
assert.match(sapShift44903.desc, /P12",20"/);
assert.equal(sapShifted.find(r => r.itemKey === '43013').line, 'S1');
assert.ok(!sapShifted.some(r => /LABOR|HINGE|PANTA/i.test(r.desc)));
const sapShiftExtra = parseSapPairs([
  sapLiveHeader,
  ['6509', '8/13/2026', '8/13/2026', '44903', 'MPC REG', '20', '20', 'BDL', '797.12', '4910573357', '2922232', 'GR for order', '', '', 'BTCH-USER', '16:10:00', '8/13/2026', '', 'VISCBE01', '101', 'F', 'FG', '0']
]);
assert.equal(sapShiftExtra.length, 1);
assert.equal(sapShiftExtra[0].line, 'COEX');
assert.equal(sapShiftExtra[0].qty, '20');
assert.equal(sapShiftExtra[0].unit, 'BDL');
assert.equal(sapShiftExtra[0].hour, 16);

function unzipEntriesNode(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= 0 && i >= u8.length - 65557; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip');
  const count = view.getUint16(eocd + 10, true);
  let off = view.getUint32(eocd + 16, true);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (view.getUint32(off, true) !== 0x02014b50) break;
    const method = view.getUint16(off + 10, true);
    const comp = view.getUint32(off + 20, true);
    const nameLen = view.getUint16(off + 28, true);
    const extraLen = view.getUint16(off + 30, true);
    const commentLen = view.getUint16(off + 32, true);
    const localOff = view.getUint32(off + 42, true);
    const name = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + nameLen));
    const localName = view.getUint16(localOff + 26, true);
    const localExtra = view.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + localName + localExtra;
    const packed = u8.subarray(dataStart, dataStart + comp);
    files[name] = method === 8 ? zlib.inflateRawSync(packed) : packed;
    off += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}
function parseSharedStrings(xml) {
  const out = [];
  const siRe = /<(?:[\w.]+:)?si\b[^>]*>([\s\S]*?)<\/(?:[\w.]+:)?si>/gi;
  let m;
  while ((m = siRe.exec(xml))) {
    const texts = [];
    const tRe = /<(?:[\w.]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w.]+:)?t>/gi;
    let t;
    while ((t = tRe.exec(m[1]))) texts.push(String(t[1] || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'));
    out.push(texts.join(''));
  }
  return out;
}
function colRowFromRef(ref) {
  const m = String(ref || '').match(/^([A-Z]+)(\d+)$/i);
  if (!m) return { c: -1, r: 0 };
  let col = 0;
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { c: col - 1, r: +m[2] - 1 };
}
function parseSheetGrid(xml, strings) {
  const grid = [];
  const rowRe = /<(?:[\w.]+:)?row\b([^>]*)>([\s\S]*?)<\/(?:[\w.]+:)?row>/gi;
  let rowM;
  while ((rowM = rowRe.exec(xml))) {
    const rowAttrs = rowM[1] || '';
    const rowNum = +((rowAttrs.match(/\br="(\d+)"/) || [])[1] || 0);
    const cells = [];
    let nextC = 0;
    const cRe = /<(?:[\w.]+:)?c\b([^>]*)(?:\/>|>([\s\S]*?)<\/(?:[\w.]+:)?c>)/gi;
    let cM;
    while ((cM = cRe.exec(rowM[2]))) {
      const attrs = cM[1] || '';
      const body = cM[2] || '';
      const ref = (attrs.match(/\br="([^"]+)"/) || [])[1];
      const t = (attrs.match(/\bt="([^"]+)"/) || [])[1] || '';
      const pos = ref ? colRowFromRef(ref).c : nextC;
      if (pos < 0) continue;
      nextC = pos + 1;
      let val = '';
      if (t === 's') {
        const v = (body.match(/<(?:[\w.]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[\w.]+:)?v>/i) || [])[1];
        val = strings[Number(v)] || '';
      } else {
        const v = (body.match(/<(?:[\w.]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[\w.]+:)?v>/i) || [])[1];
        val = v == null ? '' : v;
      }
      cells[pos] = val;
    }
    if (rowNum > 0) grid[rowNum - 1] = cells;
    else grid.push(cells);
  }
  return grid;
}
const sapXlsx = fs.readFileSync(path.join(dir, 'fixtures/sap-oneitem.xlsx'));
assert.equal(sapXlsx[0], 0x50);
assert.equal(sapXlsx[1], 0x4B);
const sapFiles = unzipEntriesNode(sapXlsx);
const sapSheet = Object.keys(sapFiles).find(n => /worksheets\/sheet\d+\.xml$/i.test(n));
const sapSs = Object.keys(sapFiles).find(n => /sharedstrings\.xml$/i.test(n));
assert.ok(sapSheet);
const sapGrid = parseSheetGrid(new TextDecoder().decode(sapFiles[sapSheet]), sapSs ? parseSharedStrings(new TextDecoder().decode(sapFiles[sapSs])) : []);
const sapFromXlsx = parseSapPairs(sapGrid);
assert.equal(sapFromXlsx.length, 1);
assert.equal(sapFromXlsx[0].itemKey, '471345');
assert.equal(sapFromXlsx[0].line, 'COEX');
assert.equal(sapFromXlsx[0].qty, '91');
assert.equal(sapFromXlsx[0].unit, 'BDL');
assert.equal(sapFromXlsx[0].y, 2026);
assert.equal(sapFromXlsx[0].m, 8);
assert.equal(sapFromXlsx[0].d, 23);
assert.match(sapFromXlsx[0].desc, /LAB 2\/24/);
assert.equal(sapFromXlsx[0].workCenter, 'VISCBE01');
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

function fileSlug(v) {
  return String(v ?? '').trim().replace(/[^\w.#+-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
function historyExcelFilename(plantLabel, filters) {
  const bits = ['quality-desk', fileSlug(String(plantLabel || 'history').replace(/\s+/g, '-'))];
  const lineSel = filters.Line;
  if (lineSel instanceof Set && lineSel.size === 1) bits.push(fileSlug([...lineSel][0]));
  if (filters.year) bits.push(String(filters.year));
  if (filters.month) bits.push(String(+filters.month).padStart(2, '0'));
  if (filters.day) bits.push(String(+filters.day).padStart(2, '0'));
  const itemSel = filters.item;
  if (itemSel instanceof Set && itemSel.size === 1) bits.push(fileSlug([...itemSel][0]));
  return bits.filter(Boolean).join('-').replace(/-+/g, '-') + '.xlsx';
}
assert.equal(historyExcelFilename('Extrusion Foam', {
  Line: new Set(['S4']), year: '2026', month: '8', day: '19', item: new Set(['43035'])
}), 'quality-desk-Extrusion-Foam-S4-2026-08-19-43035.xlsx');
assert.equal(historyExcelFilename('Extrusion Bubble', {}), 'quality-desk-Extrusion-Bubble.xlsx');
function xlsxUniqueHeaders(headers) {
  const seen = new Map();
  return headers.map((raw, i) => {
    let name = String(raw ?? '').replace(/[,\[\]]/g, ' ').replace(/\s+/g, ' ').trim() || ('Column ' + (i + 1));
    const n = (seen.get(name) || 0) + 1;
    seen.set(name, n);
    return n === 1 ? name : `${name} ${n}`;
  });
}
assert.deepEqual(xlsxUniqueHeaders(['Date/Time', 'Item #', 'Item #']), ['Date/Time', 'Item #', 'Item # 2']);
const xlsxChunk = html.slice(html.indexOf('const CRC_TABLE'), html.indexOf('function histCellValue'));
const xlsxApi = new Function(
  'PLANTS', 'activePlant', 'tableFilters', 'dateFilter',
  xlsxChunk + '; return { buildXlsx };'
)({ foam: 'Extrusion Foam' }, 'foam', {}, () => ({ year: '', month: '', day: '' }));
const xlsxBytes = xlsxApi.buildXlsx('History', ['Date/Time', 'Item #', 'Line'], [
  [46253.72, '43035', 'S4']
], [22, 12, 8]);
const xlsxFiles = unzipEntriesNode(xlsxBytes);
const sheetXml = new TextDecoder().decode(xlsxFiles['xl/worksheets/sheet1.xml']);
const tableXml = new TextDecoder().decode(xlsxFiles['xl/tables/table1.xml']);
const styleXml = new TextDecoder().decode(xlsxFiles['xl/styles.xml']);
assert.doesNotMatch(sheetXml, /<autoFilter\b/);
assert.match(sheetXml, /<tableParts count="1"/);
assert.match(sheetXml, /t="n" s="2"><v>46253\.72<\/v>/);
assert.match(tableXml, /<autoFilter ref="A1:C2"/);
assert.match(tableXml, /name="Date\/Time"/);
assert.match(styleXml, /numFmtId="164"/);
assert.match(styleXml, /m\/d\/yyyy h:mm AM\/PM/);

const countBySpcKey = new Function('rows', 'by',
  html.slice(html.indexOf('function spcKeyOf'), html.indexOf('function syncSpcByOptions')) +
  html.slice(html.indexOf('function countBySpcKey'), html.indexOf('function spcComboStats')) +
  'return countBySpcKey(rows, by);'
);
const itemCounts = countBySpcKey([
  { item: 'A', mspec: '4780' },
  { item: 'A', mspec: '4780' },
  { item: 'B', mspec: '4780' }
], 'item');
assert.equal(itemCounts.A, 2);
assert.equal(itemCounts.B, 1);
const mspecCounts = countBySpcKey([
  { item: 'A', mspec: '4780' },
  { item: 'A', mspec: '4780' },
  { item: 'B', mspec: '4780' }
], 'mspec');
assert.equal(mspecCounts['4780'], 3);
assert.equal(html.includes("c === 1 ? '1 pt' : `${c} pts`"), true);

function cpkBundle(values, lsl, usl) {
  const xs = (values || []).filter(v => finiteNum(v)).map(Number);
  const n = xs.length;
  if (n < 2) return { n, mean: NaN, stdev: NaN, cp: NaN, cpk: NaN, cpl: NaN, cpu: NaN };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const stdev = Math.sqrt(xs.reduce((s, x) => s + (x - mean) * (x - mean), 0) / (n - 1));
  const cpl = finiteNum(lsl) && stdev > 0 ? (mean - Number(lsl)) / (3 * stdev) : NaN;
  const cpu = finiteNum(usl) && stdev > 0 ? (Number(usl) - mean) / (3 * stdev) : NaN;
  const sides = [cpl, cpu].filter(finiteNum);
  const cpk = sides.length ? Math.min.apply(null, sides) : NaN;
  const cp = finiteNum(lsl) && finiteNum(usl) && stdev > 0 ? (Number(usl) - Number(lsl)) / (6 * stdev) : NaN;
  return { n, mean, stdev, cp, cpk, cpl, cpu };
}
function cpkTone(cpk) {
  if (!finiteNum(cpk)) return 'na';
  if (cpk >= 1.33) return 'good';
  if (cpk >= 1) return 'ok';
  return 'bad';
}
const cpkOk = cpkBundle([0.248, 0.250, 0.251, 0.249, 0.250, 0.252], 0.240, 0.260);
assert.equal(cpkOk.n, 6);
assert.ok(cpkOk.cpk > 2);
assert.equal(cpkTone(cpkOk.cpk), 'good');
const cpkBad = cpkBundle([0.230, 0.270, 0.220, 0.280], 0.240, 0.260);
assert.equal(cpkTone(cpkBad.cpk), 'bad');
function filterComplianceData(rows, filters) {
  const f = filters || {};
  return (rows || []).filter(r => {
    if (f.from && r.date < f.from) return false;
    if (f.to && r.date > f.to) return false;
    if (f.line && r.line !== f.line) return false;
    if (f.item && !String(r.itemNumber).includes(f.item)) return false;
    if (f.failType && !(r.failType || '').includes(f.failType)) return false;
    return true;
  });
}
function aggregateMissedByDay(rows) {
  const map = new Map();
  for (const r of rows || []) {
    if (!map.has(r.date)) map.set(r.date, { date: r.date, missed: 0 });
    map.get(r.date).missed += Number(r.missedChecks || 0);
  }
  return [...map.values()];
}
function groupFailTypes(rows) {
  const map = new Map();
  for (const r of rows || []) map.set(r.failType, (map.get(r.failType) || 0) + 1);
  return [...map.entries()].map(([failType, count]) => ({ failType, count })).sort((a, b) => b.count - a.count);
}
const complianceData = [
  { date: '2026-08-13', line: 'S1', itemNumber: '43013', expectedChecks: 2, completedChecks: 1, missedChecks: 1, failCount: 1, failType: 'thickness over' },
  { date: '2026-08-13', line: 'S4', itemNumber: '300715', expectedChecks: 1, completedChecks: 1, missedChecks: 0, failCount: 0, failType: '' },
  { date: '2026-08-14', line: 'S1', itemNumber: '43013', expectedChecks: 1, completedChecks: 0, missedChecks: 1, failCount: 1, failType: 'density under' }
];
assert.equal(filterComplianceData(complianceData, { line: 'S1' }).length, 2);
assert.equal(filterComplianceData(complianceData, { item: '300715' }).length, 1);
assert.equal(aggregateMissedByDay(complianceData).find(r => r.date === '2026-08-13').missed, 1);
assert.equal(groupFailTypes([{ failType: 'thickness over' }, { failType: 'thickness over' }, { failType: 'density under' }])[0].failType, 'thickness over');
function ymdStamp(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function mondayFromYmd(ymd) {
  const parts = String(ymd || '').split('-').map(Number);
  if (parts.length < 3 || !parts[0]) return null;
  return mondayOfLocalDate(new Date(parts[0], parts[1] - 1, parts[2]));
}
function weekKeyFromYmd(ymd) {
  const mon = mondayFromYmd(ymd);
  if (!mon) return String(ymd || '');
  return ymdStamp(mon.getUTCFullYear(), mon.getUTCMonth() + 1, mon.getUTCDate());
}
assert.equal(weekKeyFromYmd('2026-08-13'), '2026-08-10');
assert.equal(weekKeyFromYmd('2026-08-10'), '2026-08-10');
assert.equal(weekKeyFromYmd('2026-08-16'), '2026-08-10');
assert.equal(weekKeyFromYmd('2026-08-17'), '2026-08-17');
function aggregateMissedByWeek(rows) {
  const map = new Map();
  for (const r of rows || []) {
    const week = weekKeyFromYmd(r.date);
    if (!map.has(week)) map.set(week, { date: week, missed: 0 });
    map.get(week).missed += Number(r.missedChecks || 0);
  }
  return [...map.values()];
}
assert.equal(aggregateMissedByWeek(complianceData).find(r => r.date === '2026-08-10').missed, 2);
function groupFailKeys(rows, keyFn) {
  const map = new Map();
  for (const r of rows || []) {
    const key = keyFn(r);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}
assert.equal(groupFailKeys([{ itemNumber: 'A' }, { itemNumber: 'A' }, { itemNumber: 'B' }], r => r.itemNumber)[0].key, 'A');
function isoToExcelSerial(iso) {
  const parts = String(iso || '').split('-').map(Number);
  return Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000 + 25569;
}
function excelDatePartsFromSerial(v) {
  const n = parseFloat(v);
  if (!isFinite(n) || n < 20000 || n > 90000) return null;
  const d = excelSerialDate(n);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), serial: n };
}
function spcDataMonths(pts) {
  const map = new Map();
  for (const p of pts || []) {
    const dp = excelDatePartsFromSerial(p.t);
    if (!dp) continue;
    const key = dp.y + '-' + String(dp.m).padStart(2, '0');
    if (!map.has(key)) map.set(key, { y: dp.y, m: dp.m, key });
  }
  return [...map.values()].sort((a, b) => a.y - b.y || a.m - b.m);
}
const jul = isoToExcelSerial('2026-07-15');
const sep = isoToExcelSerial('2026-09-02');
const dataMonths = spcDataMonths([{ t: jul }, { t: sep }]);
assert.deepEqual(dataMonths.map(m => m.key), ['2026-07', '2026-09']);
assert.ok(!dataMonths.some(m => m.key === '2026-08'));
assert.match(html, /let complianceData = \[\]/);
assert.match(html, /MONTHS\[mo\.m - 1\]\.slice\(0, 3\) \+ ' ' \+ String\(mo\.y\)\.slice\(2\)/);
assert.doesNotMatch(html, /const maxTicks = 10/);
function stripSpcPtsSuffix(s) {
  return String(s || '')
    .replace(/\s·\s\d+\s(fails?|pts?)$/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
}
assert.equal(stripSpcPtsSuffix('3030053 · 37 fails'), '3030053');
assert.equal(stripSpcPtsSuffix('4780 (.515 1.60#) · 12 fails'), '4780');
assert.equal(stripSpcPtsSuffix('4780 (.515 1.60#)'), '4780');
assert.equal(stripSpcPtsSuffix('4001 · 3 pts'), '4001');

const vbaGarland = fs.readFileSync(path.join(dir, 'CopyForGraphGarland.bas'), 'utf8');
assert.match(vbaGarland, /Attribute VB_Name = "CopyForGraphGarland"/);
assert.match(vbaGarland, /Public Sub CopyForGraph/);
assert.match(vbaGarland, /SheetByName\("Data"\)/);
assert.match(vbaGarland, /ListObjects\("Table1"\)/);
assert.match(vbaGarland, /\[TABLESGARLAND\]/);
assert.match(vbaGarland, /source=GARLAND/);
assert.match(vbaGarland, /WriteHandoffAndOpenHta/);
assert.match(vbaGarland, /qualitydesk\.hta/);
assert.match(vbaGarland, /DIEGRAPH2\.txt/);
assert.match(vbaGarland, /LTrim\$\(Str\$\(CDbl\(v\)\)\)/);
assert.match(vbaGarland, /Never use CLng or VBA\.Round/);
assert.match(vbaGarland, /CDbl\(Len\(s\)\) > 1000000000/);
assert.doesNotMatch(vbaGarland, /CLng\(/);
assert.doesNotMatch(vbaGarland, /Function NumToTsv/);
assert.doesNotMatch(vbaGarland, /OpenGraphHtml/);
assert.doesNotMatch(vbaGarland, /GRAPH_HTML/);
assert.match(vbaGarland, /FollowHyperlink/);

assert.match(html, /TABLESGARLAND/);
assert.match(html, /Garland Bubble/);
assert.match(html, /function normalizeGarlandRow/);
assert.match(html, /function garlandLineName/);
assert.match(html, /function isBwSpcPlant/);
assert.match(html, /function isSpcPlant/);
assert.match(html, /function spcSourceRows/);
assert.match(html, /function bwValueFromRow/);
assert.match(html, /option value="garland"/);
assert.match(html, /CopyForGraphGarland/);
assert.match(html, /basis weight fail/);
assert.match(html, /view by <b>Structure<\/b>/);

function garlandLineName(raw) {
  const s = String(raw || '').trim().toUpperCase().replace(/[\s_-]+/g, '');
  if (!s) return '';
  if (/^(GARLAND)?MONO$/.test(s) || s === 'GMONO') return 'Garland MONO';
  if (/^(GARLAND)?COEX$/.test(s) || s === 'GCOEX') return 'Garland COEX';
  if (/MONO/.test(s)) return 'Garland MONO';
  if (/COEX/.test(s)) return 'Garland COEX';
  return '';
}
function garlandFlagFail(v) {
  const s = String(v ?? '').trim().toUpperCase();
  return /^(0|FAIL|FALSE|N|F|NO)$/.test(s);
}
function garlandFlagPass(v) {
  const s = String(v ?? '').trim().toUpperCase();
  return /^(1|PASS|TRUE|Y|P|YES)$/.test(s);
}
function garlandPassFail(row) {
  if (garlandFlagFail(row['VTF']) || garlandFlagFail(row['Vacuum Test']) || garlandFlagFail(row['PT']) || garlandFlagFail(row['BWT']) || garlandFlagFail(row['Weight Pass'])) return 'Fail';
  if (garlandFlagPass(row['VTP']) || garlandFlagPass(row['PT']) || garlandFlagPass(row['BWT']) || garlandFlagPass(row['Weight Pass']) || garlandFlagPass(row['Vacuum Test'])) return 'Pass';
  return 'Pass';
}
function parseWhenToSerial(v) {
  const raw = String(v ?? '').trim();
  if (!raw) return NaN;
  const n = parseFloat(raw);
  if (isFinite(n) && n >= 20000 && n < 90000) return n;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AP]M))?)?/i);
  if (!m) return NaN;
  let h = +(m[4] || 0);
  const min = +(m[5] || 0);
  const sec = +(m[6] || 0);
  const ap = (m[7] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  const utc = Date.UTC(+m[3], +m[1] - 1, +m[2], h, min, sec);
  return utc / 86400000 + 25569;
}
assert.equal(garlandLineName('Mono'), 'Garland MONO');
assert.equal(garlandLineName('Coex'), 'Garland COEX');
assert.equal(garlandLineName('MONO'), 'Garland MONO');
assert.equal(garlandPassFail({ BWT: '1' }), 'Pass');
assert.equal(garlandPassFail({ BWT: '0', 'Vacuum Test': 'Fail' }), 'Fail');
assert.ok(parseWhenToSerial('44390.36') > 44000);
assert.ok(Math.abs(parseWhenToSerial('7/13/2021 8:39') - 44390.36) < 1);

const payloadGarland = fs.readFileSync(path.join(dir, 'fixtures/sample-diegraph2-garland.txt'), 'utf8');
const garlandSecs = splitDieGraph2(payloadGarland);
assert.ok(garlandSecs.TABLESGARLAND.length > 1);
const garlandTable = parseTsv(garlandSecs.TABLESGARLAND);
assert.equal(garlandTable.rows.length, 4);
assert.equal(String(garlandTable.rows[0].Material), '4060844');
assert.equal(garlandTable.rows[0].Structure, 'SPC');
assert.equal(garlandTable.rows[0].MonoorCoex, 'Mono');
assert.equal(garlandTable.rows[2].Structure, 'SAB');
assert.equal(garlandTable.rows[3].MonoorCoex, 'Coex');
assert.equal(garlandLineName(garlandTable.rows[3].MonoorCoex), 'Garland COEX');
assert.equal(garlandPassFail(garlandTable.rows[3]), 'Fail');
assert.ok(isTsvHeaderLine(garlandSecs.TABLESGARLAND[0]));

const hta = fs.readFileSync(path.join(dir, 'quality-desk.hta'), 'utf8');
assert.match(hta, /<HTA:APPLICATION/i);
assert.match(hta, /APPLICATIONNAME="Quality Desk Checks"/);
assert.match(hta, /function getAppFolder/);
assert.match(hta, /Scripting\.FileSystemObject/);
assert.match(hta, /Quality AIO\.xlsm/);
assert.match(hta, /function submitCheck/);
assert.match(hta, /function deskIsOpen/);
assert.match(hta, /user-data-dir/);
assert.match(hta, /edge-profile/);
assert.match(hta, /new VBArray/);
assert.match(hta, /function loadAio/);
assert.doesNotMatch(hta, /Reload AIO/);
assert.match(hta, /aio-csv/);
assert.match(hta, /showTab\('users'\)/);
assert.match(hta, /showTab\('mspecs'\)/);
assert.match(hta, /showTab\('items'\)/);
assert.doesNotMatch(hta, /id="tabLookup"/);
assert.doesNotMatch(hta, /showTab\('lookup'\)/);
assert.match(hta, /function viewItem/);
assert.match(hta, /id="itemViewOverlay"/);
assert.match(hta, /themeToggle/);
assert.match(hta, /scheduleCompute/);
assert.match(hta, /function computeNow/);
assert.match(hta, /radialCard/);
assert.match(hta, /body\.light/);
assert.match(hta, /v1\.7\.62/);
assert.match(hta, /function userCanSeeHistFile/);
assert.match(hta, /QD\.histColumnsForLine\(file\)/);
assert.match(hta, /function clearHistFilters/);
assert.match(hta, /function selectHistLine/);
assert.match(hta, /function loadMoreHistRows/);
assert.match(hta, /QD\.bubbleFamilyAllowed\(r\.family, currentSite\)/);
assert.match(hta, /QD\.histRowBand\(r\)/);
assert.match(hta, /hist-row-/);
assert.match(hta, /pickReason\('LPA'\)/);
assert.match(hta, /Changeover checklist/);
assert.match(hta, /id="profilesTabBtn"/);
assert.match(hta, /function renderProfiles/);
assert.match(hta, /id="tabProfiles"/);
assert.match(hta, /id="bcolor"/);
assert.match(hta, /id="newBarcode"/);
assert.match(hta, /id="bweb"/);
assert.match(hta, /id="bperfLeft"/);
assert.match(hta, /id="bperfRight"/);
assert.match(hta, /id="bwidthWrap"/);
assert.match(hta, /id="bslitsWrap"/);
assert.match(hta, /id="newSlitsF"/);
assert.match(hta, /syncFoamSlits/);
assert.doesNotMatch(hta, /id="bpostv"/);
assert.match(hta, /Extruder A/);
assert.match(hta, /th class='group' colspan='3'>Extruder A/);
assert.doesNotMatch(hta, /id="bdeadPre"/);
assert.doesNotMatch(hta, /id="btester"/);
assert.doesNotMatch(hta, /Start of shift\/Changeover/);
assert.match(hta, /id="histAdminHelp"/);
assert.doesNotMatch(hta, /id="histTabBtn" class="admin-only"/);
assert.match(hta, /function unhidePath\(path\)/);
assert.match(hta, /function exposeResultsJs\(\)/);
assert.match(hta, /QD\.parseDiskJson\(text, fileKey\)/);
assert.match(hta, /stream\.Type = 1;/);
assert.match(hta, /stream\.Position = 3;/);
assert.match(hta, /dbg\("results\/" \+ fileKey \+ "\.js eval: "/);
assert.match(hta, /function streamReadLocal/);
assert.match(hta, /function streamWriteLocal/);
assert.match(hta, /function copyFile/);
assert.match(hta, /function tempFile/);
assert.match(hta, /Welcome,/);
assert.match(hta, /function claimHtaInstance/);
assert.match(hta, /function maximizeWindow/);
assert.match(hta, /function importHandoffIfPresent/);
assert.match(hta, /function renderAdminHistory/);
assert.match(hta, /function editUserRoles/);
assert.match(hta, /id="histTabBtn"/);
assert.match(hta, /id="newUserOperator"/);
assert.match(hta, /hideResult/);
assert.match(hta, /id="workOverlay"/);
assert.match(hta, /id="bootProgress"/);
assert.match(hta, /function importLegacyWrite/);
assert.match(hta, /Thickness \(frac\)/);
assert.match(hta, /View as operator/);
assert.match(hta, /function toggleOperatorView/);
assert.match(hta, /function publishSapCsv/);
assert.match(hta, /function openDebug/);
assert.match(hta, /newUserLineBox/);
assert.match(hta, /mspecText/);
assert.match(hta, /COEX weight/);
assert.doesNotMatch(hta, /Home → line → check/);
assert.doesNotMatch(hta, /var\(--bg\)/);
assert.match(hta, /Add new #/);
assert.match(hta, /function openItemModal/);
assert.match(hta, /function addUser/);
assert.match(hta, /function doLogin/);
assert.match(hta, /function goHome/);
assert.match(hta, /function pickReason/);
assert.match(hta, /function confirmItem/);
assert.match(hta, /function ackDoc/);
assert.match(hta, /function openDocThenPrompt/);
assert.match(hta, /function docsLocked/);
assert.match(hta, /function updateNav/);
assert.match(hta, /function bindFormWatch/);
assert.match(hta, /function requestNewUser/);
assert.match(hta, /function requestReset/);
assert.match(hta, /function approveInbox/);
assert.match(hta, /function issueTempPass/);
assert.match(hta, /function renderAuditTable/);
assert.match(hta, /id="usersTabBtn" class="admin-only"/);
assert.match(hta, /id="auditTabBtn"/);
assert.match(hta, /id="btnInbox"/);
assert.match(hta, /id="docReviewWrap"/);
assert.match(hta, /New User/);
assert.match(hta, /Forgot Password/);
assert.match(hta, /MONO weight/);
assert.match(hta, /form-col/);
assert.match(hta, /chip\.need/);
assert.match(hta, /hist-changed/);
assert.match(hta, /bumpSpecVersion/);
assert.match(hta, /thicknessFieldIds/);
assert.match(hta, /inbox-btn/);
assert.doesNotMatch(hta, /Import legacy data/);
assert.doesNotMatch(hta, /function importLegacyPicked/);
assert.doesNotMatch(hta, /id="btnLegacy"/);
assert.match(hta, /function importLegacyWrite/);
assert.match(hta, /openDesk\(false\)">History/);
assert.match(hta, /class="filter-row"/);
assert.match(hta, /item-tools/);
assert.match(hta, /login-kicker/);
assert.match(hta, /function bootDesk/);
assert.match(hta, /function viewItem/);
assert.match(hta, /setSite\('GARLAND'\)/);
assert.match(hta, /LINE UP/);
assert.match(hta, /Documentation/);
assert.match(hta, /submitBar/);
assert.match(hta, /radialCanvas/);
assert.match(hta, /id="crumbs"/);
assert.match(hta, /function logout/);
assert.match(hta, /function clearCheckForm/);
assert.match(hta, /missingCheckFields/);
assert.match(hta, /loginOverlay/);
assert.match(hta, /setSpecTab\('foam'\)/);
assert.match(hta, /setSpecTab\('bubble'\)/);
assert.match(hta, /setSpecTab\('p1'\)/);
assert.match(hta, /setSpecTab\('rts'\)/);
assert.match(hta, /View history/);
assert.match(hta, /USERS_FILE|users\.dat/);
assert.match(hta, /function revealFile/);
assert.match(hta, /function unlockPath/);
assert.match(hta, /icacls/);
assert.match(hta, /\/reset/);
assert.doesNotMatch(hta, /inheritance:r/);
assert.match(hta, /QD\.IDLE_MS/);
assert.match(hta, /newType/);
assert.match(hta, /BUBBLE — COEX/);
assert.doesNotMatch(hta, /openDesk\(true\)/);
assert.match(hta, /Win32_Process/);
assert.match(hta, /writeLineRows/);
assert.match(hta, /DISK_DIR|resultsDir|results\\\\/);
assert.match(hta, /src="qd-check\.js"/);
assert.match(hta, /index\.html/);
assert.match(hta, /centration\.html/);
assert.match(hta, /msedge/);
assert.match(hta, /--app=/);
assert.doesNotMatch(hta, /https:\/\//);
assert.doesNotMatch(hta, /<iframe/i);
assert.doesNotMatch(hta, /<frame/i);
assert.doesNotMatch(hta, /src=['"]https?:/);

const gitignore = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');
assert.match(gitignore, /Quality AIO\.xlsm/);
assert.match(gitignore, /results\/\*\.js/);
assert.match(gitignore, /results\/\*\.dat/);
assert.match(gitignore, /results\/\*\.txt/);
assert.match(gitignore, /users\.dat/);
assert.match(gitignore, /BubbleSpecs\.csv/);
assert.ok(!fs.existsSync(path.join(dir, 'BubbleSpecs.csv')));
assert.ok(!fs.existsSync(path.join(dir, 'results/users.dat')));
assert.ok(!fs.existsSync(path.join(dir, 'Quality AIO.xlsm')));
assert.ok(!fs.existsSync(path.join(dir, 'Quality_AIO.xlsm')));

const QD = (await import('./qd-check.js')).default;
assert.equal(QD.fileForLine('S4'), 's4');
assert.equal(QD.fileForLine('S1'), 's1');
assert.equal(QD.fileForLine('S3'), 's3');
assert.equal(QD.fileForLine('COEX'), 'coex');
assert.equal(QD.plantForLine('MONO'), 'bubble');
assert.ok(QD.skipReason('S4', 'STARTUP'));
assert.ok(!QD.skipReason('S4', 'HOURLY'));
assert.ok(Math.abs(QD.densityS4(16, 0.5) - ((16 / 453.592) / ((16 * 0.5) / 1728))) < 1e-9);
assert.ok(Math.abs(QD.densityS1(20, 0.2) - ((20 * 12) / (0.2 * 1000))) < 1e-9);
const s4row = QD.buildRow({
  line: 'S4', item: '3030053', description: 'AF500', mspec: '4780',
  user: 'GWEXLER', reason: 'HOURLY', notes: 'hta',
  width: 53, cellMd: 20, cellCd: 20, avg: 0.52, range: 12, density: 1.6,
  passFail: 'Pass', points: [0.52, 0.53]
});
assert.equal(s4row.__source, 'hta');
assert.equal(s4row.__lineFile, 's4');
assert.equal(s4row.__plant, 'foam');
assert.equal(s4row.Line, 'S4');
const s1row = QD.buildRow({ line: 'S1', item: '35613', user: 'GWEXLER', reason: 'HOURLY', passFail: 'Pass' });
assert.equal(s1row.__lineFile, 's1');
assert.notEqual(s1row.__lineFile, s4row.__lineFile);
const merged = QD.mergeDisk({
  lookupRows: [{ 'MSPEC #': '4780', Target: 0.54 }],
  lines: { s4: { rows: [s4row] }, s1: { rows: [s1row] } }
});
assert.equal(merged.rows.length, 2);
assert.equal(merged.lookupRows[0]['MSPEC #'], '4780');
const diskJs = QD.diskScript('s4', { file: 's4', rows: [s4row] });
assert.match(diskJs, /QD_DISK\.lines/);
assert.match(diskJs, /"s4"/);
assert.doesNotMatch(fs.readFileSync(path.join(dir, 'qd-check.js'), 'utf8'), /Quality AIO\.xlsm/);
assert.equal(QD.parseCsv('Item #,Description\n3030053,"AF500, 53"""').rows[0]['Item #'], '3030053');
assert.equal(QD.mergeUsers(['GWEXLER'], ['gwexler', 'AGARCIA']).join(','), 'GWEXLER,AGARCIA');
assert.equal(QD.mergeItems([{ item: '1', description: 'old' }], [{ item: '1', description: 'new', local: true }])[0].description, 'new');
assert.equal(QD.VERSION, '1.7.69');
assert.ok(QD.CHECK_TYPES.indexOf('LPA') >= 0);
assert.ok(QD.REASONS.foam.indexOf('LPA') >= 0);
assert.ok(QD.REASONS.bubble.indexOf('LPA') >= 0);
assert.equal(QD.frontToBackRatio({ description: 'ULINE 48' }), 1.75);
assert.equal(QD.frontToBackRatio({ description: 'VAB CLEAR' }), 1.5);
assert.ok(QD.histColumnsForLine('coex').indexOf('Slit Width') >= 0);
assert.ok(QD.histColumnsForLine('s4').indexOf('Thickness Average') >= 0);
assert.ok(!QD.needsStartup({ 'Item #': '1', User: 'GWEXLER', 'Date/Time': QD.nowSerial(new Date('2026-08-27T08:00:00')) }, '1', new Date('2026-08-27T16:00:00'), 'GWEXLER'));
assert.ok(QD.needsStartup({ 'Item #': '1', User: 'OPA', 'Date/Time': QD.nowSerial(new Date('2026-08-27T08:00:00')) }, '1', new Date('2026-08-27T09:00:00'), 'OPB'));
assert.ok(QD.needsCoexSpeeds('COEX', null, { bubbleType: 'VAB' }, []));
assert.ok(!QD.needsCoexSpeeds('COEX', { 'Bubble Type': 'VAB' }, { bubbleType: 'VAB' }, []));
assert.ok(QD.needsCoexSpeeds('COEX', { 'Bubble Type': 'VAB' }, { bubbleType: 'SAB' }, []));
assert.ok(!QD.needsCoexSpeeds('MONO', null, { bubbleType: 'VAB' }, []));
assert.ok(QD.startupComplete({
  labelsOut: 'YES', poVerify: 'YES', labelsMatch: 'YES', lineSpeed: '200',
  A_speed: '40', A_meltPump1: '10', A_meltPump2: '12',
  B_speed: '41', B_meltPump1: '11', B_meltPump2: '13',
  C_speed: '42', C_meltPump1: '12', C_meltPump2: '14'
}, false, true));
assert.ok(!QD.startupComplete({ labelsOut: 'YES', poVerify: 'YES', labelsMatch: 'YES', lineSpeed: '200', A_speed: '40' }, false, true));
assert.ok(!QD.startupComplete({ labelsOut: 'YES', poVerify: 'YES', labelsMatch: 'YES' }, false, true));
assert.ok(!QD.skipReason('COEX', 'LPA'));
assert.equal(QD.missingCheckFields('COEX', 'HOURLY', {
  user: 'GWEXLER', item: '1', itemObj: { width: '48', footage: '750', bubbleType: 'VAB' },
  width: '48', webWidth: '48', footage: '750', weight: '12', deadPost: '0',
  color: 'Clear', delam: 'PASS', prodNo: '1', rollNo: '2'
}).length, 0);
assert.ok(QD.itemNeedsSlitWidth({ width: '24' }));
assert.ok(!QD.itemNeedsSlitWidth({ width: '48' }));
assert.ok(QD.itemHasSlits({ slits: '2' }));
assert.ok(!QD.itemHasSlits({ slits: '' }));
assert.equal(QD.COEX_CHANGEOVER_FIELDS.filter((f) => f.extruder).length, 9);
assert.deepEqual(QD.bubbleFamiliesForSite('GARLAND'), ['COEX']);
assert.deepEqual(QD.bubbleFamiliesForSite('VISALIA'), ['COEX', 'MONO']);
assert.ok(QD.bubbleFamilyAllowed('COEX', 'GARLAND'));
assert.ok(!QD.bubbleFamilyAllowed('MONO', 'GARLAND'));
assert.ok(QD.bubbleFamilyAllowed('MONO', 'VISALIA'));
assert.equal(QD.STARTUP_ITEMS[0].text, 'Were old labels from prior production order thrown away?');
assert.ok(QD.histColumns([{ row: { Line: 'S4', T1: 0.5, Extra: 'x' } }]).indexOf('T1') >= 0);
assert.ok(QD.histColumns([{ row: { Line: 'S4', Extra: 'x' } }]).indexOf('Extra') >= 0);
const histSpec = { 'Lower Control': 0.51, 'Upper Control': 0.53, 'Thickness Range Max': 4, 'Density Min': 0.8, 'Density Max': 1.2 };
assert.equal(QD.histCellBand({ T1: 0.50 }, 'T1', { spec: histSpec }), 'under');
assert.equal(QD.histCellBand({ T1: 0.52 }, 'T1', { spec: histSpec }), 'in');
assert.equal(QD.histCellBand({ T1: 0.54 }, 'T1', { spec: histSpec }), 'over');
assert.equal(QD.histCellBand({ 'Pass/Fail': 'Pass' }, 'Pass/Fail', {}), 'in');
assert.equal(QD.histCellBand({ 'Pass/Fail': 'Fail' }, 'Pass/Fail', {}), 'over');
assert.equal(QD.histRowBand({ T1: 0.50, 'Pass/Fail': 'Pass' }, { spec: histSpec }), 'in');
assert.equal(QD.histRowBand({ T1: 0.54, 'Pass/Fail': 'Pass' }, { spec: histSpec }), 'in');
assert.equal(QD.histRowBand({ T1: 0.52, 'Pass/Fail': 'Fail' }, { spec: histSpec }), 'over');
const opUser = QD.makeUserRecord('OP', 'x', false, false, 'VISALIA', 'S4');
assert.ok(QD.userCanSeeLine(opUser, 'S4', 'VISALIA'));
assert.ok(!QD.userCanSeeLine(opUser, 'S1', 'VISALIA'));
assert.equal(QD.stripBom('\uFEFFwindow.QD_DISK=[]'), 'window.QD_DISK=[]');
assert.equal(QD.stripBom('window.QD_DISK=[]'), 'window.QD_DISK=[]');
assert.equal(QD.stripBom('\u00EF\u00BB\u00BFwindow.QD_DISK=[]'), 'window.QD_DISK=[]');
const bomDisk = QD.diskScript('s4', { file: 's4', rows: [{ Line: 'S4', 'Item #': '1' }] });
assert.equal(QD.parseDiskJson('\uFEFF' + bomDisk, 's4').rows[0]['Item #'], '1');
assert.ok(QD.parseDiskJson(bomDisk, 's4').rows.length);
assert.equal(QD.HANDOFF_FILE, 'DIEGRAPH2.txt');
assert.ok(QD.HIST_CHECK_FIELDS.indexOf('Item #') >= 0);
assert.match(QD.formatClock(25569 + (8 + 4 / 60) / 24), /8:04 AM/);
assert.equal(QD.itemType({ mspec: '4780', slits: '2', footage: '500' }), 'FOAM');
assert.ok(QD.isCoveredNoMeasure('LINE DOWN'));
assert.ok(QD.isCoveredNoMeasure('NO CHECK'));
assert.ok(QD.isCoveredNoMeasure('LINE UP'));
assert.equal(QD.noMeasureLabel('NO CHECK'), 'LINE DOWN');
assert.equal(QD.noMeasureLabel('LINE UP'), 'LINE UP');
assert.ok(QD.checkLinkFieldsForDocLines('S4').some((f) => f.id === 'entries'));
const legacyPack = QD.importLegacyChecks(payload);
assert.ok(legacyPack.count >= 4);
assert.ok(legacyPack.s4.length >= 4);
assert.equal(legacyPack.s4[0].__source, 'legacy');
assert.ok(QD.trim(legacyPack.s4[0].T1));
assert.equal(QD.normalizeBubbleType('COEX-VAB'), 'VAB');
assert.equal(QD.normalizeBubbleType('MONO VAB'), 'VAB');
assert.equal(QD.bumpSpecVersion('1.0.0'), '1.0.1');
assert.equal(QD.bumpSpecVersion(''), '1.0.1');
assert.equal(QD.ensureSpecVersion({}).version, '1.0.0');
assert.ok(QD.specChangedKeys({ Target: '1' }, { Target: '2', version: '1.0.1' }).indexOf('Target') >= 0);
assert.equal(QD.thicknessFieldIds('S4').length, 13);
assert.equal(QD.thicknessFieldIds('S4')[0], 's4t1');
assert.equal(QD.thicknessFieldIds('S1').length, 13);
assert.deepEqual(QD.thicknessFieldIds('RTS'), ['rt1', 'rt2', 'rt3']);
const weightPair = QD.bubbleWeightPair([], 'VAB');
assert.ok(weightPair.coex && weightPair.mono);
assert.equal(String(weightPair.coex.target), '3.8');
assert.equal(String(weightPair.mono.target), '4.5');
const inboxReq = QD.makeInboxRequest('newUser', 'OP', { salt: 's', hash: 'h' });
assert.equal(inboxReq.type, 'newUser');
assert.equal(QD.pendingInbox([inboxReq]).length, 1);
assert.ok(QD.findPendingNewUser([inboxReq], 'op'));
assert.match(QD.tempPassword(), /^TMP\d{6}$/);
assert.equal(QD.auditEntry('login', 'GWEXLER', 'ok').action, 'login');
assert.ok(QD.missingCheckFields('S4', 'HOURLY', {
  user: 'GWEXLER', item: '1', bundle: '1', width: '53', footage: '200',
  cellMd: '20', cellCd: '20', weight: '16', points: new Array(12).fill('0.5')
}).indexOf('Thickness points') >= 0);
assert.equal(QD.fileForLine('G-COEX'), 'gcoex');
assert.equal(QD.lineLabel('COEX', 'GARLAND'), 'COEX');
assert.equal(QD.linesForSite('GARLAND').length, 1);
assert.equal(QD.linesForSite('GARLAND')[0].id, 'G-COEX');
assert.equal(QD.lineInfo('MONO', 'GARLAND'), null);
assert.equal(QD.canonDocLine('COEX'), 'COEX');
assert.equal(QD.canonDocLine('G-COEX'), 'G-COEX');
assert.equal(QD.canonDocLine('Garland COEX'), 'G-COEX');
assert.ok(QD.docMatchesUserLines('COEX', ['COEX']));
assert.ok(!QD.docMatchesUserLines('COEX', ['G-COEX']));
assert.ok(QD.docMatchesUserLines('G-COEX', ['G-COEX']));
assert.ok(!QD.docMatchesUserLines('G-COEX', ['COEX']));
assert.ok(QD.docMatchesUserLines('*', ['G-COEX']));
assert.ok(QD.docMatchesUserLines('COEX,G-COEX', ['G-COEX']));
assert.match(QD.sapDiskScript({ name: 'SAP.csv', csv: 'a,b' }), /QD_DISK_SAP/);
assert.equal(QD.hasMspec('S4'), true);
assert.equal(QD.hasMspec('COEX'), false);
assert.equal(QD.shiftAt(new Date('2026-08-27T08:00:00')), '1');
assert.equal(QD.shiftAt(new Date('2026-08-27T16:00:00')), '2');
assert.equal(QD.shiftAt(new Date('2026-08-27T23:30:00')), '3');
assert.ok(QD.needsStartup(null, '35613', new Date()));
assert.ok(QD.needsStartup({ 'Item #': '1', User: 'GWEXLER', 'Date/Time': QD.nowSerial(new Date('2026-08-27T08:00:00')) }, '2', new Date('2026-08-27T09:00:00'), 'GWEXLER'));
assert.ok(QD.needsLineUp({ 'Reason for Check': 'NO CHECK' }));
assert.match(QD.lastCheckLabel({ 'Date/Time': QD.nowSerial(new Date('2026-08-27T08:38:00')), 'Pass/Fail': 'Pass', 'Reason for Check': 'HOURLY' }), /PASS @/i);
assert.match(QD.lastCheckLabel({
  'Date/Time': QD.nowSerial(new Date('2026-08-27T08:38:00')), 'Pass/Fail': 'Pass', 'Reason for Check': 'HOURLY',
  'Item #': '35613', 'Item Desc': 'VAB CLEAR'
}), /35613 VAB CLEAR @/i);
assert.match(QD.lastCheckLabel({
  'Date/Time': QD.nowSerial(new Date('2026-08-27T08:38:00')), 'Pass/Fail': 'Fail', 'Reason for Check': 'HOURLY',
  Notes: 'weight high', 'Item #': '9'
}), /Fail: weight high · 9 @/i);
assert.match(QD.lastCheckLabel({
  'Date/Time': QD.nowSerial(new Date('2026-08-27T08:38:00')), 'Reason for Check': 'NO CHECK',
  'No Check Reason': 'LINE DOWN', Notes: 'drive fault'
}), /LINE DOWN — drive fault @/i);
assert.ok(QD.docNeedsReview({ version: '2' }, { version: '1', at: new Date().toISOString() }));
assert.ok(!QD.docNeedsReview({ version: '1' }, { version: '1', at: new Date().toISOString() }));
assert.ok(QD.pendingDocs([{ id: 'd1', name: 'WI', line: 'S4', version: '1' }], [], 'GWEXLER', ['S4']).length === 1);
assert.ok(!QD.startupComplete({}));
assert.ok(QD.startupComplete({ labelsOut: 'YES', poVerify: 'YES', labelsMatch: 'YES' }));
assert.equal(QD.pointBand(0.50, 0.51, 0.53), 'under');
assert.equal(QD.pointBand(0.52, 0.51, 0.53), 'in');
assert.equal(QD.pointBand(0.54, 0.51, 0.53), 'over');
assert.equal(QD.pointExtremes(['0.51', '0.54', '0.52']).maxIndex, 1);
const linedUser = QD.makeUserRecord('OP', 'x', false, false, 'GARLAND', 'COEX,MONO');
assert.ok(QD.userCanSeeLine(linedUser, 'COEX', 'GARLAND'));
assert.ok(!QD.userCanSeeLine(linedUser, 'S4', 'VISALIA'));
assert.match(QD.formatUsersDat([linedUser]), /GARLAND\|COEX,MONO/);
assert.equal(QD.lineItemType('COEX'), 'BUBBLE');
assert.equal(QD.lineItemType('S4'), 'FOAM');
assert.equal(QD.lineItemType('RTS'), 'LAM');
assert.equal(QD.lineItemType('P1'), 'PLANK');
assert.equal(QD.itemType({ bubbleType: 'VAB', slits: 2 }), 'BUBBLE');
assert.deepEqual(QD.fieldsForType('FOAM'), ['item', 'description', 'width', 'slits', 'footage', 'perf', 'mspec']);
assert.deepEqual(QD.fieldsForType('BUBBLE'), ['item', 'description', 'width', 'slits', 'footage', 'perf', 'bubbleType', 'color', 'barcodeLabel', 'boxLabel']);
const lpaRow = QD.buildRow({
  line: 'COEX', item: '9', description: 'VAB', user: 'GWEXLER', reason: 'LPA', passFail: 'Pass',
  width: '48', webWidth: '48', footage: '750', weight: '12', deadPost: '0',
  color: 'Clear', delam: 'PASS', prodNo: '1', rollNo: '2', bubbleType: 'VAB',
  perfLeft: '12', perfRight: '13'
});
assert.equal(lpaRow['Reason for Check'], 'LPA');
assert.equal(lpaRow['Slit Width'], '48');
assert.equal(lpaRow['Web Width'], '48');
assert.equal(lpaRow['Basis Weight'], '12');
assert.ok(!lpaRow['Dead Cell Pre']);
assert.ok(!lpaRow['Perf Tester Results']);
assert.deepEqual(QD.missingCheckFields('S4', 'STARTUP', { user: 'GWEXLER', notes: '' }), ['Notes']);
assert.ok(QD.missingCheckFields('S4', 'HOURLY', { user: 'GWEXLER', item: '' }).includes('Item #'));
assert.ok(QD.missingCheckFields('S4', 'HOURLY', {
  user: 'GWEXLER', item: '1', bundle: '1', width: '53', footage: '200',
  cellMd: '20', cellCd: '20', weight: '16', points: new Array(13).fill('0.5')
}).length === 0);
assert.equal(QD.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
const hashed = QD.makeUserRecord('GWEXLER', 'secret', true, false);
assert.equal(hashed.name, 'GWEXLER');
assert.ok(hashed.admin);
assert.ok(QD.verifyPassword(hashed, 'secret'));
assert.ok(!QD.verifyPassword(hashed, 'wrong'));
const dat = QD.formatUsersDat([hashed]);
assert.match(dat, /GWEXLER\|1\|/);
assert.doesNotMatch(dat, /secret/);
assert.equal(QD.parseUsersDat(dat)[0].name, 'GWEXLER');
const bubbleSpecs = QD.parseBubbleSpecs(',COEX\nAbbreviation,PRODUCT,Calc. Gauge,Minimum,Target,Maximum,,Bubble Type,Abbreviations,Max dead cells (5%)\nVAB,VAB,1.7,3.65,3.8,3.95,,Very Small,VAB,151\n,MONO\nAbbreviation,PRODUCT,Calc. Gauge,Minimum,Target,Maximum\nVPC-LD,VPC-LD,2.6,5.47,5.7,5.93\n');
assert.equal(bubbleSpecs.specs.length, 2);
assert.equal(bubbleSpecs.specs[0].family, 'COEX');
assert.equal(bubbleSpecs.specs[0].abbreviation, 'VAB');
assert.equal(String(bubbleSpecs.specs[0].min), '3.65');
assert.equal(bubbleSpecs.specs[1].family, 'MONO');
assert.equal(bubbleSpecs.deadCells[0].maxDead, '151');
assert.equal(QD.findBubbleSpec(bubbleSpecs.specs, 'COEX', 'VAB').target, '3.8');
assert.equal(QD.deadCellMaxFromFile(bubbleSpecs.deadCells, 'VAB'), 151);
const rtsSpecs = QD.parseRtsSpecs('Product,Min,Target,Max\nCoex 48,1.1,1.2,1.3\n');
assert.equal(rtsSpecs[0].product, 'Coex 48');
assert.equal(String(rtsSpecs[0].target), '1.2');
const p1Specs = QD.parseP1Specs('Thickness,Density,Min,Max,CC Min,CC Max,Thick Min,Thick Max,Thick Target\n0.5,0.9,0.85,0.95,0.9,1.3,0.438,0.513,0.5\n');
assert.equal(String(p1Specs[0].thickness), '0.5');
assert.equal(String(p1Specs[0].ccMax), '1.3');
assert.match(QD.diskManifestScript(['lookup.js', 's4.js']), /QD_DISK_MANIFEST/);
assert.equal(QD.SEED_USER, 'GWEXLER');
assert.equal(QD.IDLE_MS, 60 * 60 * 1000);
const vbaCsv = fs.readFileSync(path.join(dir, 'ExportAioCsv.bas'), 'utf8');
assert.match(vbaCsv, /Public Sub ExportAioCsv/);
assert.match(vbaCsv, /MasterDatabase\.csv/);
assert.match(vbaCsv, /MasterSheet\.csv/);
assert.match(vbaCsv, /UserList\.csv/);
assert.match(vbaCsv, /RtsSpecs\.csv/);
assert.match(vbaCsv, /P1Specs\.csv/);
assert.match(vbaCsv, /Table114/);
assert.match(vbaCsv, /Table7/);
assert.match(vbaCsv, /Table86/);
assert.match(vbaCsv, /Table97/);
assert.match(vbaCsv, /Table18/);
assert.match(vbaCsv, /do not import FromQuality/);

const sealedHello = QD.seal('hello café — π\nline2');
assert.ok(QD.isSealed(sealedHello));
assert.match(sealedHello, /^QDSEAL1/);
assert.doesNotMatch(sealedHello, /hello/);
assert.doesNotMatch(sealedHello, /café/);
assert.equal(QD.unseal(sealedHello), 'hello café — π\nline2');
assert.equal(QD.unseal('plain text'), 'plain text');
const packed = QD.makePack('<hta>APP</hta>', '<html>WEB</html>');
assert.match(packed, /^QDPACK1/);
const split = QD.splitPack(packed);
assert.equal(split.app, '<hta>APP</hta>');
assert.equal(split.web, '<html>WEB</html>');
const sealedPack = QD.seal(packed);
assert.equal(QD.splitPack(QD.unseal(sealedPack)).web, '<html>WEB</html>');

const gRow = {
  'Date/Time': '8/31/2026 8:00 AM', User: 'JSMITH', Line: 'G-COEX',
  'Item #': '9', 'Item Desc': 'VAB', 'Reason for Check': 'HOURLY', 'Pass/Fail': 'Pass',
  'Slit Width': '24', 'Web Width': '48', Footage: '750', 'Basis Weight': '12',
  'Perf Strength Left': '12', 'Perf Strength Right': '13',
  Color: 'Clear', 'Delam Check': 'PASS', 'Production #': '1', 'Roll #': '2', Notes: 'ok'
};
const firstBackup = QD.garlandBackupMerge('', [gRow]);
assert.equal(firstBackup.added, 1);
assert.match(firstBackup.csv, /JSMITH/);
assert.match(firstBackup.csv, /G-COEX/);
const secondBackup = QD.garlandBackupMerge(firstBackup.csv, [gRow, Object.assign({}, gRow, { Notes: 'new' })]);
assert.equal(secondBackup.added, 1);
assert.match(secondBackup.csv, /new/);
assert.equal(QD.GARLAND_BACKUP_DIR, 'C:\\Users\\csccoex1\\OneDrive - Pregis LLC\\Quality\\');
assert.equal(QD.GARLAND_BACKUP_FILE, 'COEX data.csv');
assert.equal(QD.CORE_FILE, 'qd.core');
const checkSrc = fs.readFileSync(path.join(dir, 'qd-check.js'), 'utf8');
assert.match(checkSrc, /<QD-CRYPT-BEGIN>/);
assert.match(checkSrc, /<QD-CRYPT-END>/);
assert.match(hta, /function backupGarlandCoex/);
assert.match(hta, /function materializeDeskHtml/);
assert.match(hta, /function loadReleasePack/);
assert.match(hta, /shouldSealPath/);
assert.match(hta, /QD_RELEASE_CRYPT/);
assert.match(hta, /results\\\\" \+ name\), text, true/);
assert.match(hta, /"index\.html"\), html, true/);
assert.match(hta, /v1\.7\.69/);

const chartJs = fs.readFileSync(path.join(dir, 'vendor/chart.umd.min.js'), 'utf8');
assert.match(chartJs, /Chart\.js v4\.4\.1/);
assert.match(chartJs, /t="undefined"!=typeof globalThis\?globalThis:t\|\|self\)\.Chart=/);

const releaseHtaPath = path.join(dir, 'release/QualityDesk.hta');
const releaseCorePath = path.join(dir, 'release/qd.core');
if (fs.existsSync(releaseHtaPath) && fs.existsSync(releaseCorePath)) {
  const releaseHta = fs.readFileSync(releaseHtaPath, 'utf8');
  const releaseCore = fs.readFileSync(releaseCorePath, 'utf8');
  assert.doesNotMatch(releaseHta, /function doLogin/);
  assert.doesNotMatch(releaseHta, /SEED_USER/);
  assert.doesNotMatch(releaseHta, /hashPassword/);
  assert.doesNotMatch(releaseHta, /=>/);
  assert.match(releaseHta, /qd\.core/);
  assert.match(releaseHta, /Opening sealed desk/);
  assert.ok(QD.isSealed(releaseCore));
  const releasePack = QD.splitPack(QD.unseal(releaseCore));
  assert.ok(releasePack && releasePack.app && releasePack.web);
  assert.match(releasePack.app, /Quality Desk Checks/);
  assert.match(releasePack.app, /v1\.7\.69/);
  assert.match(releasePack.app, /loginOverlay/);
  assert.match(releasePack.web, /<!DOCTYPE html>|<html/i);
  assert.doesNotMatch(releaseCore, /function doLogin/);
  assert.doesNotMatch(releaseCore, /SEED_USER/);
  assert.ok(!fs.existsSync(path.join(dir, 'release/index.html')));
}

console.log('parse-diegraph tests passed');
