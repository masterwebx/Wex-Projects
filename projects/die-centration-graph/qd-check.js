/* Quality Desk check logic — ES3/IE11. Loaded by quality-desk.hta and Node tests. */
(function (global) {
  var QD = global.QD || {};

  QD.VERSION = '1.7.76';
  QD.DISK_DIR = 'results';
  QD.LINE_FILES = ['s4', 's1', 's3', 'coex', 'mono', 'p1', 'rts', 'gcoex', 'gmono'];
  QD.DISK_FILES = ['lookup'].concat(QD.LINE_FILES);
  QD.IDLE_MS = 60 * 60 * 1000;
  QD.CHECK_IDLE_MS = 15 * 60 * 1000;
  QD.USERS_FILE = 'users.dat';
  QD.HANDOFF_FILE = 'DIEGRAPH2.txt';
  QD.stripBom = function (text) {
    var s = String(text == null ? '' : text);
    if (!s) return '';
    if (s.charCodeAt(0) === 0xFEFF || s.charCodeAt(0) === 0xFFFE) return s.substring(1);
    if (s.charCodeAt(0) === 0xEF && s.charCodeAt(1) === 0xBB && s.charCodeAt(2) === 0xBF) return s.substring(3);
    return s;
  };
  QD.HIST_CHECK_FIELDS = [
    'Date/Time', 'Line', 'User', 'Item #', 'Item Desc', 'MSPEC',
    'Reason for Check', 'No Check Reason', 'Pass/Fail', 'Notes',
    'Bundle #', 'Slit/Width', 'Footage', 'Cell Count MD', 'Cell Count CD',
    'Thickness Average', 'Thickness Range', 'Density', 'Weight',
    'Slit Width', 'Web Width', 'Basis Weight',
    'Dead Cells and Air Transfers Post Vacuum Test',
    'Perf Distance', 'Perf Width', 'Perf Strength Left', 'Perf Strength Right', 'Color', 'Delam Check',
    'Barcode Label', 'Box Label', 'Work Order #', 'Bundle #', 'Bubble Type', '# Slits',
    'Line Speed',
    'Extruder A Speed', 'Extruder A Melt Pump 1', 'Extruder A Melt Pump 2',
    'Extruder B Speed', 'Extruder B Melt Pump 1', 'Extruder B Melt Pump 2',
    'Extruder C Speed', 'Extruder C Melt Pump 1', 'Extruder C Melt Pump 2'
  ];
  QD.HIST_PAGE = 80;
  QD.BUBBLE_COLORS = ['Clear', 'Green', 'Pink', 'Gray'];
  QD.WEB_WIDTH_TARGET = 48;
  QD.WEB_WIDTH_TOL = 0.5;
  QD.PERF_STRENGTH_MIN = 11;
  QD.PERF_STRENGTH_MAX = 15;
  QD.FRONT_TO_BACK_ULINE = 1.75;
  QD.FRONT_TO_BACK_OTHER = 1.5;
  QD.SEED_USER = 'GWEXLER';
  QD.SITES = ['VISALIA', 'GARLAND'];
  QD.CHECK_TYPES = ['HOURLY', 'RETEST', 'LPA', 'NO CHECK'];
  QD.NO_CHECK_REASONS = ['EQUIPMENT FAILURE', 'NO ORDERS', 'LINE DOWN', 'PREVENTATIVE MAINTENANCE'];
  QD.DOC_TYPES = ['Work Instruction', 'QAN', 'Construction Card'];
  QD.DOC_REVIEW_MS = 90 * 24 * 60 * 60 * 1000;
  QD.STARTUP_ITEMS = [
    { id: 'labelsOut', text: 'Were old labels from prior production order thrown away?' },
    { id: 'poVerify', text: 'Do you have the Production Order and verify everything is correct?' },
    { id: 'labelsMatch', text: 'Verify new labels match Production Order' }
  ];
  QD.STARTUP_PERF_ITEM = { id: 'perfTear', text: 'Perf teared cleanly and easily' };
  QD.COEX_EXTRUDERS = ['A', 'B', 'C'];
  QD.COEX_EXTRUDER_FIELDS = [
    { key: 'speed', text: 'Extruder Speed' },
    { key: 'meltPump1', text: 'Melt Pump 1 speed' },
    { key: 'meltPump2', text: 'Melt Pump 2 speed' }
  ];
  QD.COEX_CHANGEOVER_FIELDS = (function () {
    var out = [{ id: 'lineSpeed', text: 'Line speed' }];
    var i, j, ex, f;
    for (i = 0; i < QD.COEX_EXTRUDERS.length; i++) {
      ex = QD.COEX_EXTRUDERS[i];
      for (j = 0; j < QD.COEX_EXTRUDER_FIELDS.length; j++) {
        f = QD.COEX_EXTRUDER_FIELDS[j];
        out.push({
          id: ex + '_' + f.key,
          text: f.text,
          extruder: ex,
          groupLabel: 'Extruder ' + ex
        });
      }
    }
    return out;
  })();
  QD.coexSpeedAnswer = function (answers, extruder, key) {
    if (!answers) return '';
    var flat = answers[extruder + '_' + key];
    if (flat != null && trim(flat) !== '') return flat;
    var nested = answers[extruder];
    if (nested && nested[key] != null) return nested[key];
    return '';
  };
  QD.RTS_STARTUP_STATIONS = ['0', '1', '2', '3'];
  QD.RTS_STARTUP_ACTIONS = [
    { id: 'heat', text: 'Turn on heater and verify heat is distributed evenly', stations: true },
    { id: 'airKnives', text: 'Check and clean air knives', stations: true },
    { id: 'airFilters', text: 'Check and clean air filters', stations: true },
    { id: 'heatKnife', text: 'Move heat knife and check in correct position', stations: true },
    { id: 'heaterConn', text: 'Check heater connection isn\'t loose. No loose screws', stations: true },
    { id: 'grease', text: 'Grease heater belts and hydraulic screws', stations: true },
    { id: 'blower', text: 'Verify blower is working', stations: true },
    { id: 'hoses', text: 'Check air hoses and listen for air leaks', stations: true },
    { id: 'printhead', text: 'Check printhead is clean and ink is full', stations: false }
  ];
  QD.ULINE_DIAM_MIN = 36;
  QD.ULINE_DIAM_MAX = 38;

  QD.LINES = [
    { id: 'COEX', file: 'coex', site: 'VISALIA', plant: 'bubble', form: 'bubble', reasons: 'bubble', label: 'COEX', homeGroup: 'bubble' },
    { id: 'MONO', file: 'mono', site: 'VISALIA', plant: 'bubble', form: 'bubble', reasons: 'bubble', label: 'MONO', homeGroup: 'bubble' },
    { id: 'S1', file: 's1', site: 'VISALIA', plant: 'foam', form: 's1s3', reasons: 'foam', label: 'S1', homeGroup: 'extrusion' },
    { id: 'S3', file: 's3', site: 'VISALIA', plant: 'foam', form: 's1s3', reasons: 'foam', label: 'S3', homeGroup: 'extrusion' },
    { id: 'S4', file: 's4', site: 'VISALIA', plant: 'foam', form: 's4', reasons: 'foam', label: 'S4', homeGroup: 'extrusion' },
    { id: 'P1', file: 'p1', site: 'VISALIA', plant: 'p1', form: 'p1', reasons: 'foam', label: 'P1', homeGroup: 'engineered' },
    { id: 'RTS', file: 'rts', site: 'VISALIA', plant: 'rts', form: 'rts', reasons: 'foam', label: 'RTS', homeGroup: 'engineered' },
    { id: 'G-COEX', file: 'gcoex', site: 'GARLAND', plant: 'bubble', form: 'bubble', reasons: 'bubble', label: 'COEX', homeGroup: 'bubble' }
  ];
  QD.HOME_GROUPS = [
    { id: 'bubble', title: 'Bubble Lines' },
    { id: 'extrusion', title: 'Extrusion Lines' },
    { id: 'engineered', title: 'Engineered Lines' }
  ];

  QD.REASONS = {
    foam: ['HOURLY', 'RETEST', 'LPA', 'NO CHECK'],
    bubble: ['HOURLY', 'RETEST', 'LPA', 'NO CHECK']
  };

  QD.SKIP_REASONS = {
    foam: { STARTUP: 1, 'EQUIPMENT FAIL': 1, 'EQUIPMENT FAILURE': 1, 'NO ORDERS': 1, 'NO CHECK': 1, 'DIE CHANGE': 1, 'LINE DOWN': 1, 'PREVENTATIVE MAINTENANCE': 1, 'LINE UP': 1 },
    bubble: { STARTUP: 1, 'EQUIPMENT FAIL': 1, 'EQUIPMENT FAILURE': 1, 'NO ORDERS': 1, 'NO CHECK': 1, 'CYLINDER CHANGE': 1, 'LINE DOWN': 1, 'PREVENTATIVE MAINTENANCE': 1, 'LINE UP': 1 },
    s4: { STARTUP: 1, 'EQUIPMENT FAIL': 1, 'EQUIPMENT FAILURE': 1, 'NO ORDERS': 1, 'NO CHECK': 1, 'LINE DOWN': 1, 'PREVENTATIVE MAINTENANCE': 1, 'LINE UP': 1 },
    p1: { STARTUP: 1, 'EQUIPMENT FAIL': 1, 'EQUIPMENT FAILURE': 1, 'NO ORDERS': 1, 'NO CHECK': 1, 'LINE DOWN': 1, 'PREVENTATIVE MAINTENANCE': 1, 'LINE UP': 1 }
  };

  QD.TAPE_COLORS = ['RED', 'YELLOW', 'GREEN', 'BLUE', 'BROWN', 'TAN', 'CLEAR', 'ULINE', 'BLACK'];
  QD.SHIFTS = ['A', 'B', 'C', 'D'];

  QD.BUBBLE_WEIGHT = {
    COEX: {
      VAB: [3.65, 3.8, 3.95], VPC: [3.94, 4.1, 4.26], VN: [4.8, 5, 5.2], SAB: [3.65, 3.8, 3.95],
      SPC: [3.94, 4.1, 4.26], 'SN-12': [5.66, 5.9, 6.14], 'SN-24': [8.16, 8.5, 8.84],
      AK: [4.32, 4.5, 4.68], BOB: [4.32, 4.5, 4.68], MAB: [4.13, 4.3, 4.47],
      MPC: [4.8, 5, 5.2], 'MN-12': [7.2, 7.5, 7.8], 'MN-24': [10.18, 10.6, 11.02],
      LAB: [4.7, 4.9, 5.1], LPC: [6.05, 6.3, 6.55], 'LN-12': [8.16, 8.5, 8.84],
      'LN-24': [11.04, 11.5, 11.96], SRB: [3.65, 3.8, 3.95]
    },
    MONO: {
      VAB: [4.32, 4.5, 4.68], 'VPC-LD': [5.47, 5.7, 5.93], 'VPC-HD': [6.91, 7.2, 7.49],
      'VPC-XHD': [9.6, 10, 10.4], SAB: [5.38, 5.6, 5.82], 'SPC-LD': [6.05, 6.3, 6.55],
      'SPC-HD': [7.97, 8.3, 8.63], 'SPC-XHD': [10.27, 10.7, 11.13], AK: [6.14, 6.4, 6.66],
      BOB: [6.14, 6.4, 6.66], MAB: [6.05, 6.3, 6.55], 'MPC-LD': [7.97, 8.3, 8.63],
      'MPC-HD': [9.89, 10.3, 10.71], 'MPC-XHD': [12.48, 13, 13.52], LAB: [6.82, 7.1, 7.38],
      'LPC-LD': [8.93, 9.3, 9.67], 'LPC-HD': [10.85, 11.3, 11.75], 'LPC-XHD': [13.44, 14, 14.56]
    }
  };

  QD.DEAD_CELLS = [
    { prefix: 'VAB', max: 151 }, { prefix: 'VPC', max: 151 }, { prefix: 'VN', max: 151 },
    { prefix: 'VRBC', max: 151 }, { prefix: 'SAB', max: 107 }, { prefix: 'SRP', max: 107 },
    { prefix: 'SPC', max: 107 }, { prefix: 'SN-', max: 107 }, { prefix: 'SN', max: 107 },
    { prefix: 'SRB', max: 107 }, { prefix: 'MAB', max: 23 }, { prefix: 'MPC', max: 23 },
    { prefix: 'MN', max: 23 }, { prefix: 'MRB', max: 23 }, { prefix: 'LPC', max: 18 },
    { prefix: 'LAB', max: 18 }, { prefix: 'LN', max: 18 }, { prefix: 'LRB', max: 18 },
    { prefix: 'LRP', max: 18 }
  ];

  QD.LOOKUP_COLS = ['MSPEC #', 'AF#', 'Lower Spec', 'Lower Control', 'Target', 'Upper Control', 'Upper Spec', 'Thickness Range Max', 'Cell Count Min', 'Cell Count Max', 'Density Min', 'Density Target', 'Density Max', 'Weight Min', 'Weight Target', 'Weight Max'];

  function trim(v) {
    return String(v == null ? '' : v).replace(/^\s+|\s+$/g, '');
  }

  QD.trim = trim;

  QD.num = function (v) {
    if (v == null || v === '') return NaN;
    var n = parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : NaN;
  };

  QD.normalizeThicknessEntry = function (raw) {
    var s = trim(raw);
    if (!s) return '';
    if (s.indexOf('.') >= 0) return s;
    if (!/^\d+$/.test(s)) return s;
    var n = parseInt(s, 10);
    if (!isFinite(n)) return s;
    var out = (n / 1000).toFixed(3);
    if (out.charAt(0) === '0') out = out.substring(1);
    return out;
  };

  QD.lineInfo = function (id, site) {
    var key = String(id || '').toUpperCase().replace(/\s+/g, '');
    var sit = String(site || '').toUpperCase();
    if (sit === 'GARLAND') {
      if (key === 'COEX' || key === 'G-COEX') key = 'G-COEX';
      if (key === 'MONO' || key === 'G-MONO') return null;
    }
    var i;
    for (i = 0; i < QD.LINES.length; i++) {
      if (QD.LINES[i].id === key) return QD.LINES[i];
    }
    return null;
  };

  QD.resolveLineId = function (site, id) {
    var info = QD.lineInfo(id, site);
    return info ? info.id : String(id || '').toUpperCase();
  };

  QD.lineLabel = function (id, site) {
    var info = QD.lineInfo(id, site);
    return info ? info.label : String(id || '');
  };

  QD.linesForSite = function (site) {
    var sit = String(site || 'VISALIA').toUpperCase();
    var out = [], i;
    for (i = 0; i < QD.LINES.length; i++) {
      if (QD.LINES[i].site === sit) out.push(QD.LINES[i]);
    }
    return out;
  };

  QD.hasMspec = function (lineId, site) {
    var info = QD.lineInfo(lineId, site);
    return !!(info && (info.id === 'S4' || info.id === 'S1' || info.id === 'S3'));
  };

  QD.fileForLine = function (id) {
    var info = QD.lineInfo(id);
    return info ? info.file : '';
  };

  QD.plantForLine = function (id) {
    var info = QD.lineInfo(id);
    return info ? info.plant : '';
  };

  QD.skipReason = function (lineId, reason) {
    var r = String(reason || '').toUpperCase();
    if (r === 'NO CHECK' || r === 'LINE UP' || r === 'LINE DOWN' || r === 'EQUIPMENT FAILURE' || r === 'PREVENTATIVE MAINTENANCE') return true;
    var info = QD.lineInfo(lineId);
    var table = (info && QD.SKIP_REASONS[info.form]) || QD.SKIP_REASONS.foam;
    if (info && info.form === 's1s3') table = QD.SKIP_REASONS.foam;
    if (info && info.form === 'bubble') table = QD.SKIP_REASONS.bubble;
    if (info && info.id === 'S4') table = QD.SKIP_REASONS.s4;
    return !!table[r];
  };

  QD.canonItem = function (v) {
    var s = trim(v).replace(/,/g, '');
    if (!s) return '';
    var n = parseFloat(s);
    if (isFinite(n) && /^[-+]?\d*\.?\d+$/.test(s)) {
      if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
    }
    return s;
  };

  QD.canonMspec = function (v) {
    var s = trim(v);
    if (!s || /^#(N\/A|DIV\/0|VALUE|REF|NAME|NULL)/i.test(s)) return '';
    s = s.replace(/,/g, '');
    var n = parseFloat(s);
    if (isFinite(n) && /^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) {
      if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
      return String(n);
    }
    return s.replace(/\.0+$/, '').toUpperCase();
  };

  QD.nowSerial = function (d) {
    var x = d || new Date();
    return Date.UTC(x.getFullYear(), x.getMonth(), x.getDate(), x.getHours(), x.getMinutes(), x.getSeconds(), x.getMilliseconds()) / 86400000 + 25569;
  };

  QD.avg = function (vals) {
    var i, n = 0, s = 0, v;
    for (i = 0; i < vals.length; i++) {
      v = QD.num(vals[i]);
      if (isFinite(v)) { s += v; n += 1; }
    }
    return n ? s / n : NaN;
  };

  QD.rangeMil = function (vals) {
    var i, v, mn = NaN, mx = NaN;
    for (i = 0; i < vals.length; i++) {
      v = QD.num(vals[i]);
      if (!isFinite(v)) continue;
      if (!isFinite(mn) || v < mn) mn = v;
      if (!isFinite(mx) || v > mx) mx = v;
    }
    if (!isFinite(mn) || !isFinite(mx)) return NaN;
    return (mx - mn) * 1000;
  };

  QD.densityS4 = function (weightG, avgThk) {
    var w = QD.num(weightG), a = QD.num(avgThk);
    if (!isFinite(w) || !isFinite(a) || a === 0) return NaN;
    return (w / 453.592) / ((16 * a) / 1728);
  };

  QD.densityS1 = function (weight, avgThk) {
    var w = QD.num(weight), a = QD.num(avgThk);
    if (!isFinite(w) || !isFinite(a) || a === 0) return NaN;
    return (w * 12) / (a * 1000);
  };

  QD.pf = function (ok) {
    if (ok == null) return '';
    return ok ? 'Pass' : 'Fail';
  };

  QD.inRange = function (v, lo, hi) {
    var n = QD.num(v);
    if (!isFinite(n)) return null;
    if (isFinite(lo) && n < lo) return false;
    if (isFinite(hi) && n > hi) return false;
    return true;
  };

  QD.findItem = function (items, itemNo) {
    var want = QD.canonItem(itemNo);
    var i, it, key;
    if (!want || !items) return null;
    for (i = 0; i < items.length; i++) {
      it = items[i];
      if (it.deleted) continue;
      key = QD.canonItem(it.item || it['Item #']);
      if (key === want) return it;
    }
    return null;
  };

  QD.searchItems = function (items, q, limit, typeFilter) {
    var needle = trim(q).toLowerCase();
    var wantType = trim(typeFilter).toUpperCase();
    var out = [];
    var cap = limit || (needle ? 20 : 5000);
    var i, it, item, desc, typ;
    if (!items) return out;
    for (i = 0; i < items.length; i++) {
      it = items[i];
      if (it.deleted) continue;
      item = String(it.item || it['Item #'] || '');
      desc = String(it.description || it.Description || '');
      typ = QD.itemType(it);
      if (wantType && typ && typ !== wantType) continue;
      if (!needle || item.toLowerCase().indexOf(needle) >= 0 || desc.toLowerCase().indexOf(needle) >= 0) {
        out.push(it);
        if (out.length >= cap) break;
      }
    }
    return out;
  };

  QD.itemHasPerf = function (it) {
    if (!it) return false;
    var p = QD.num(it.perf);
    return isFinite(p) && p > 0;
  };

  QD.itemIsUline = function (it) {
    return /ULINE/i.test(String(it && it.description || ''));
  };

  QD.itemDescHasCohAdh = function (it) {
    var d = String(it && it.description || '').toUpperCase();
    return d.indexOf('COH') >= 0 || d.indexOf('ADH') >= 0;
  };

  QD.formatThkFraction = function (n) {
    var val = QD.num(n);
    if (!isFinite(val)) return '';
    var whole = Math.floor(val + 0.0001);
    var frac = val - whole;
    if (frac < 0.001) return whole > 0 ? String(whole) : '0';
    var fracs = [[0.0625, '1/16'], [0.125, '1/8'], [0.1875, '3/16'], [0.25, '1/4'], [0.3125, '5/16'],
      [0.375, '3/8'], [0.4375, '7/16'], [0.5, '1/2'], [0.5625, '9/16'], [0.625, '5/8'],
      [0.6875, '11/16'], [0.75, '3/4'], [0.8125, '13/16'], [0.875, '7/8'], [0.9375, '15/16']];
    var i, best = null, diff;
    for (i = 0; i < fracs.length; i++) {
      diff = Math.abs(frac - fracs[i][0]);
      if (!best || diff < best.diff) best = { diff: diff, label: fracs[i][1] };
    }
    if (best && best.diff <= 0.02) return whole > 0 ? (whole + ' ' + best.label) : best.label;
    return val.toFixed(3);
  };

  QD.allThkInRange = function (vals, lo, hi) {
    var i, v, any = false, ok = true;
    for (i = 0; i < (vals || []).length; i++) {
      v = vals[i];
      if (v == null || trim(v) === '') continue;
      any = true;
      if (QD.inRange(v, lo, hi) === false) ok = false;
    }
    if (!any) return null;
    return ok;
  };

  QD.lineToForm = function (lineId) {
    var info = QD.lineInfo(lineId);
    return info ? info.form : '';
  };

  QD.docLinePlant = function (lineId) {
    var info = QD.lineInfo(lineId);
    if (!info) return '';
    if (info.plant === 'bubble') return 'bubble';
    if (info.plant === 'p1') return 'p1';
    if (info.plant === 'rts') return 'rts';
    return 'foam';
  };

  QD.parseDocLines = function (lineStr) {
    if (!lineStr || lineStr === '*' || String(lineStr).toUpperCase() === 'ALL') return ['*'];
    var parts = String(lineStr).split(/[,;]+/);
    var out = [], i, p;
    for (i = 0; i < parts.length; i++) {
      p = trim(parts[i]);
      if (p) out.push(p);
    }
    return out.length ? out : ['*'];
  };

  /* Canonical doc-line ids. Visalia COEX and Garland G-COEX stay distinct
     (both display as "COEX" in the UI, so never match on display label). */
  QD.canonDocLine = function (token) {
    var t = String(token || '').toUpperCase().replace(/\s+/g, '');
    var info, i;
    if (!t) return '';
    if (t === '*' || t === 'ALL') return '*';
    if (t === 'G-COEX' || t === 'GARLANDCOEX' || t === 'GCOEX') return 'G-COEX';
    if (t === 'G-MONO' || t === 'GARLANDMONO' || t === 'GMONO') return 'G-MONO';
    if (t === 'COEX' || t === 'VISALIACOEX') return 'COEX';
    if (t === 'MONO' || t === 'VISALIAMONO') return 'MONO';
    info = QD.lineInfo(token);
    if (info) return info.id;
    for (i = 0; i < QD.LINES.length; i++) {
      if (String(QD.LINES[i].id).toUpperCase() === t) return QD.LINES[i].id;
    }
    return t;
  };

  QD.docMatchesUserLines = function (docLine, lineIds) {
    var parts = QD.parseDocLines(docLine);
    var i, j, p, want;
    if (parts[0] === '*') return true;
    for (i = 0; i < (lineIds || []).length; i++) {
      want = QD.canonDocLine(lineIds[i]);
      if (!want) continue;
      for (j = 0; j < parts.length; j++) {
        p = QD.canonDocLine(parts[j]);
        if (p && p === want) return true;
      }
    }
    return false;
  };

  QD.docAppliesToSection = function (docLine, section) {
    var parts = QD.parseDocLines(docLine);
    var i, plant;
    if (parts[0] === '*') return true;
    for (i = 0; i < parts.length; i++) {
      plant = QD.docLinePlant(parts[i]);
      if (plant === section) return true;
    }
    return false;
  };

  QD.checkLinkFieldsForDocLines = function (lineStr) {
    var lines = QD.parseDocLines(lineStr);
    var allowed = {}, out = [], i, j, form, fields, cf, lid;
    if (lines[0] === '*') {
      for (i = 0; i < QD.CHECK_LINK_FIELDS.length; i++) out.push(QD.CHECK_LINK_FIELDS[i]);
      return out;
    }
    for (i = 0; i < lines.length; i++) {
      lid = lines[i];
      form = QD.lineToForm(lid);
      if (!form && String(lid).toUpperCase() === 'G-COEX') form = 'bubble';
      if (!form) form = QD.docLinePlant(lid);
      fields = QD.CHECK_FIELDS[form];
      if (fields) {
        for (j = 0; j < fields.length; j++) allowed[fields[j].key] = true;
      }
      if (form === 'p1') {
        fields = QD.CHECK_FIELDS.p1Double;
        for (j = 0; j < fields.length; j++) allowed[fields[j].key] = true;
      }
      if (form === 's1s3' || form === 's4') allowed.points = true;
    }
    allowed.entries = true;
    for (i = 0; i < QD.CHECK_LINK_FIELDS.length; i++) {
      cf = QD.CHECK_LINK_FIELDS[i];
      if (allowed[cf.id] || cf.id === 'entries') out.push(cf);
    }
    return out;
  };

  QD.isCoveredNoMeasure = function (v) {
    var s = trim(v).toUpperCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    return s === 'NO CHECK' || s === 'LINE DOWN' || s === 'LINE UP'
      || s === 'EQUIPMENT FAIL' || s === 'EQUIPMENT FAILURE'
      || s === 'NO ORDERS' || s === 'PREVENTATIVE MAINTENANCE'
      || s === 'STARTUP' || s === 'DIE CHANGE' || s === 'CYLINDER CHANGE';
  };

  QD.noMeasureLabel = function (v) {
    var s = trim(v).toUpperCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    if (s === 'LINE UP') return 'LINE UP';
    return 'LINE DOWN';
  };

  QD.thkSpecLabel = function (min, target, max) {
    var a = QD.formatThkFraction(min);
    var b = QD.formatThkFraction(target);
    var c = QD.formatThkFraction(max);
    if (!a && !b && !c) return '';
    return (a || '—') + ' / ' + (b || '—') + ' / ' + (c || '—');
  };

  QD.findMspec = function (mspecs, mspec) {
    var want = QD.canonMspec(mspec);
    var i, row, key;
    if (!want || !mspecs) return null;
    for (i = 0; i < mspecs.length; i++) {
      row = mspecs[i];
      key = QD.canonMspec(row['MSPEC #'] || row.mspec);
      if (key === want) return row;
    }
    return null;
  };

  QD.lookupToDeskRow = function (row) {
    if (!row) return {};
    return {
      'MSPEC #': row['MSPEC #'] || row.mspec || '',
      'AF#': row['AF#'] || row.af || '',
      'Lower Spec': row['Lower Spec'] || '',
      'Lower Control': row['Lower Control'] || row.lcl || '',
      'Target': row.Target || row.target || '',
      'Upper Control': row['Upper Control'] || row.ucl || '',
      'Upper Spec': row['Upper Spec'] || '',
      'Thickness Range Max': row['Thickness Range Max'] || row.rangeMax || '',
      'Cell Count Min': row['Cell Count Min'] || row.cellMin || '',
      'Cell Count Max': row['Cell Count Max'] || row.cellMax || '',
      'Density Min': row['Density Min'] || row.densMin || '',
      'Density Target': row['Density Target'] || row.densTarget || '',
      'Density Max': row['Density Max'] || row.densMax || '',
      'Weight Min': row['Weight Min'] || '',
      'Weight Target': row['Weight Target'] || '',
      'Weight Max': row['Weight Max'] || ''
    };
  };

  QD.normalizeBubbleType = function (bubbleType) {
    var raw = trim(bubbleType).toUpperCase();
    return raw.replace(/^(G-)?(COEX|MONO)[\s\-_\/:]*/, '');
  };

  QD.bubbleFamiliesForSite = function (site) {
    var sit = String(site || 'VISALIA').toUpperCase();
    if (sit === 'GARLAND') return ['COEX'];
    return ['COEX', 'MONO'];
  };

  QD.bubbleFamilyAllowed = function (family, site) {
    var fam = QD.bubbleFamily(family) || String(family || '').toUpperCase();
    var allowed = QD.bubbleFamiliesForSite(site);
    var i;
    if (!fam) return false;
    for (i = 0; i < allowed.length; i++) if (allowed[i] === fam) return true;
    return false;
  };

  QD.bubbleFamily = function (line) {
    var key = String(line || '').toUpperCase().replace(/\s+/g, '');
    if (key === 'MONO' || key === 'G-MONO') return 'MONO';
    if (key === 'COEX' || key === 'G-COEX') return 'COEX';
    var info = QD.lineInfo(line);
    if (info && info.plant === 'bubble') {
      if (String(info.id).indexOf('MONO') >= 0) return 'MONO';
      return 'COEX';
    }
    return '';
  };

  QD.matchBubbleWeight = function (line, bubbleType) {
    var fam = QD.bubbleFamily(line) || String(line || '').toUpperCase();
    var table = QD.BUBBLE_WEIGHT[fam] || {};
    var raw = QD.normalizeBubbleType(bubbleType);
    var key, best = '', hits = 0;
    if (!raw) return null;
    if (table[raw]) return { key: raw, min: table[raw][0], target: table[raw][1], max: table[raw][2] };
    for (key in table) {
      if (!table.hasOwnProperty(key)) continue;
      if (raw.indexOf(key) === 0 && key.length > best.length) {
        best = key;
        hits = 1;
      } else if (key.indexOf(raw) === 0 && raw.length >= 2) {
        if (raw.length > best.length) {
          best = key;
          hits = 1;
        } else if (raw.length === best.length && key !== best) {
          hits += 1;
        }
      }
    }
    /* Ambiguous short tokens (SN-, MN, LN) map to multiple gauges — skip guess. */
    if (best && hits <= 1) return { key: best, min: table[best][0], target: table[best][1], max: table[best][2] };
    if (best && raw.indexOf(best) === 0) return { key: best, min: table[best][0], target: table[best][1], max: table[best][2] };
    return null;
  };

  QD.normalizeBubbleWeightRow = function (row) {
    if (!row) return null;
    var min = QD.num(row.min);
    var target = QD.num(row.target);
    var max = QD.num(row.max);
    if (!isFinite(min) && !isFinite(target) && !isFinite(max)) return null;
    return {
      key: trim(row.abbreviation || row.key || ''),
      min: min,
      target: target,
      max: max
    };
  };

  QD.bubbleWeightForLine = function (specs, line, bubbleType) {
    var fam = QD.bubbleFamily(line);
    var raw = trim(bubbleType);
    var row, bt;
    if (!fam || !raw) return QD.matchBubbleWeight(fam, bubbleType);
    row = QD.findBubbleSpec(specs, fam, bubbleType);
    if (row) {
      bt = QD.normalizeBubbleWeightRow(row);
      if (bt) return bt;
    }
    row = QD.matchBubbleWeight(fam, bubbleType);
    return row ? { key: row.key, min: row.min, target: row.target, max: row.max } : null;
  };

  QD.bubbleWeightPair = function (specs, bubbleType) {
    function one(fam) {
      var n = QD.normalizeBubbleWeightRow(QD.findBubbleSpec(specs, fam, bubbleType));
      return n || QD.matchBubbleWeight(fam, bubbleType);
    }
    return { coex: one('COEX'), mono: one('MONO') };
  };

  QD.isDoubleShot = function (shots) {
    var s = trim(shots).toUpperCase();
    if (!s) return false;
    if (s === '2' || s === 'DOUBLE' || s === 'DBL' || s.indexOf('DOUBLE') >= 0) return true;
    var n = QD.num(s);
    return isFinite(n) && n >= 2;
  };

  QD.parseLooseDate = function (raw) {
    var s = trim(raw);
    if (!s) return null;
    var m, d;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      d = new Date(s.substring(0, 10) + 'T12:00:00');
      return isNaN(d.getTime()) ? null : d;
    }
    m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      var yy = parseInt(m[3], 10);
      if (yy < 100) yy += 2000;
      d = new Date(yy, parseInt(m[1], 10) - 1, parseInt(m[2], 10), 12, 0, 0);
      return isNaN(d.getTime()) ? null : d;
    }
    d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  /** Pass when today is at least 5 calendar days after MFG date. */
  QD.mfgDatePf = function (mfgDate, now) {
    var mfg = QD.parseLooseDate(mfgDate);
    if (!mfg) return null;
    var today = now instanceof Date ? now : new Date();
    var a = new Date(mfg.getFullYear(), mfg.getMonth(), mfg.getDate());
    var b = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var days = Math.round((b.getTime() - a.getTime()) / 86400000);
    return days >= 5;
  };

  QD.homeStatusTone = function (row) {
    if (!row) return 'gray';
    var reason = String(row['Reason for Check'] || '').toUpperCase();
    var extra = String(row['No Check Reason'] || '').toUpperCase();
    var pf = String(row['Pass/Fail'] || '').toUpperCase();
    if (reason === 'LINE UP' || pf === 'PASS' || pf === 'LINE UP') return 'green';
    if (extra === 'LINE DOWN' || pf === 'FAIL' || pf === 'LINE DOWN' || reason === 'LINE DOWN') return 'red';
    if (extra === 'NO ORDERS' || extra === 'PREVENTATIVE MAINTENANCE' || pf === 'NO ORDERS' || pf === 'PREVENTATIVE MAINTENANCE') return 'gray';
    if (reason === 'NO CHECK') return 'gray';
    if (pf === 'FAIL') return 'red';
    if (pf === 'PASS') return 'green';
    return 'gray';
  };

  QD.deadCellMax = function (bubbleType) {
    var raw = trim(bubbleType).toUpperCase();
    var i, row, best = null;
    for (i = 0; i < QD.DEAD_CELLS.length; i++) {
      row = QD.DEAD_CELLS[i];
      if (raw.indexOf(row.prefix) === 0) {
        if (!best || row.prefix.length > best.prefix.length) best = row;
      }
    }
    return best ? best.max : NaN;
  };

  QD.overallFromFlags = function (lineId, reason, flags) {
    var r = trim(reason).toUpperCase();
    if (QD.skipReason(lineId, r)) return r;
    var i;
    for (i = 0; i < (flags || []).length; i++) {
      if (String(flags[i] || '').toLowerCase() === 'fail') return 'Fail';
    }
    return 'Pass';
  };

  function setIf(row, key, v) {
    if (v != null && v !== '' && !(typeof v === 'number' && !isFinite(v))) row[key] = v;
  }

  QD.buildRow = function (input) {
    var line = trim(input.line).toUpperCase();
    var info = QD.lineInfo(line);
    if (!info) return null;
    var reason = trim(input.reason);
    var skip = QD.skipReason(line, reason);
    var row = {
      'Date/Time': input.when != null ? input.when : QD.nowSerial(),
      Line: info.id,
      User: trim(input.user),
      'Reason for Check': reason,
      Notes: trim(input.notes),
      __plant: info.plant,
      __source: 'hta',
      __lineFile: info.file
    };
    var item = QD.canonItem(input.item);
    var desc = trim(input.description);
    var mspec = QD.canonMspec(input.mspec);
    if (info.plant === 'foam') {
      setIf(row, 'Item #', item);
      setIf(row, 'Item Desc', desc);
      setIf(row, 'MSPEC', mspec);
      setIf(row, 'Bundle #', input.bundle);
      setIf(row, 'Slit/Width', input.width);
      setIf(row, '# Slits', input.slits);
      setIf(row, 'Footage', input.footage);
      setIf(row, 'Cell Count MD', input.cellMd);
      setIf(row, 'Cell Count CD', input.cellCd);
      setIf(row, 'Thickness Average', input.avg);
      setIf(row, 'Thickness Range', input.range);
      setIf(row, 'Density', input.density);
      if (info.form === 's4') {
        setIf(row, 'Perf Roller On', input.perfOn);
        setIf(row, 'Talc Reading', input.talc);
        setIf(row, 'Sheet Length', input.sheetLength);
      }
      if (info.form === 's1s3') {
        setIf(row, 'Width', input.width);
        setIf(row, 'Perf', input.perf);
        setIf(row, 'Bundle Tight/Loose', input.bundleFit);
        setIf(row, 'Tape Color', input.tape);
        setIf(row, 'Diameter (ULINE only)', input.diameter);
        setIf(row, 'Diameter Pass/Fail', input.diameterPf);
      }
      var i;
      if (input.points) {
        for (i = 0; i < input.points.length; i++) setIf(row, 'T' + (i + 1), input.points[i]);
      }
    } else if (info.plant === 'bubble') {
      setIf(row, 'Item', item);
      setIf(row, 'Item #', item);
      setIf(row, 'Item Description', desc);
      setIf(row, 'Item Desc', desc);
      setIf(row, 'Product Verification', input.productVf);
      setIf(row, 'COH/ADH Verification', input.cohAdh);
      setIf(row, '# Slits', input.slits);
      setIf(row, 'Bubble Type', input.bubbleType);
      setIf(row, 'Slit Width', input.width);
      setIf(row, 'Width', input.width);
      setIf(row, 'Web Width', input.webWidth);
      setIf(row, 'Footage', input.footage);
      setIf(row, 'Perf Distance', input.perfWidth);
      setIf(row, 'Perf Width', input.perfWidth);
      setIf(row, 'Perf Strength Left', input.perfLeft);
      setIf(row, 'Perf Strength Right', input.perfRight);
      setIf(row, 'Basis Weight', input.weight);
      setIf(row, 'Weight', input.weight);
      setIf(row, 'Density', input.density);
      setIf(row, 'Diameter (ULINE only)', input.diameter);
      setIf(row, 'Diameter Pass/Fail', input.diameterPf);
      setIf(row, 'Dead Cells and Air Transfers Post Vacuum Test', input.deadPost);
      setIf(row, 'Dead Cell Post', input.deadPost);
      setIf(row, 'Color', input.color);
      setIf(row, 'Delam Check', input.delam);
      setIf(row, 'Barcode Label', input.barcodeLabel);
      setIf(row, 'Box Label', input.boxLabel);
      setIf(row, 'Work Order #', input.prodNo);
      setIf(row, 'Bundle #', input.rollNo);
      setIf(row, 'Line Speed', input.lineSpeed);
      setIf(row, 'Extruder A Speed', QD.coexSpeedAnswer(input, 'A', 'speed'));
      setIf(row, 'Extruder A Melt Pump 1', QD.coexSpeedAnswer(input, 'A', 'meltPump1'));
      setIf(row, 'Extruder A Melt Pump 2', QD.coexSpeedAnswer(input, 'A', 'meltPump2'));
      setIf(row, 'Extruder B Speed', QD.coexSpeedAnswer(input, 'B', 'speed'));
      setIf(row, 'Extruder B Melt Pump 1', QD.coexSpeedAnswer(input, 'B', 'meltPump1'));
      setIf(row, 'Extruder B Melt Pump 2', QD.coexSpeedAnswer(input, 'B', 'meltPump2'));
      setIf(row, 'Extruder C Speed', QD.coexSpeedAnswer(input, 'C', 'speed'));
      setIf(row, 'Extruder C Melt Pump 1', QD.coexSpeedAnswer(input, 'C', 'meltPump1'));
      setIf(row, 'Extruder C Melt Pump 2', QD.coexSpeedAnswer(input, 'C', 'meltPump2'));
      setIf(row, 'Width Pass', input.widthPf);
      setIf(row, 'Web Width Pass', input.webWidthPf);
      setIf(row, 'Footage Pass', input.footagePf);
      setIf(row, 'Perf Width Pass', input.perfWidthPf);
      setIf(row, 'Perf Strength Left Pass', input.perfLeftPf);
      setIf(row, 'Perf Strength Right Pass', input.perfRightPf);
      setIf(row, 'Weight Pass', input.weightPf);
      setIf(row, 'Post Pass', input.postPf);
      setIf(row, 'Maximum allowed', input.deadMax);
    } else if (info.plant === 'p1') {
      var pi;
      setIf(row, 'Item #', item);
      setIf(row, 'Item Description', desc);
      setIf(row, 'Length', input.length);
      setIf(row, 'Width', input.width);
      setIf(row, 'Cell Count MD', input.cellMd);
      setIf(row, 'Cell Count CD', input.cellCd);
      setIf(row, 'Plank Weight', input.weight);
      setIf(row, 'Volume', input.volume);
      setIf(row, 'Density', input.density);
      setIf(row, '# Shots', input.shots);
      setIf(row, 'Average Single Shot', input.avgSingle);
      setIf(row, 'Width Pass', input.widthPf);
      setIf(row, 'Length Pass', input.lengthPf);
      setIf(row, 'Density Pass/Fail', input.densityPf);
      if (input.headPoints) {
        for (pi = 0; pi < input.headPoints.length; pi++) setIf(row, 'Head T' + (pi + 1), input.headPoints[pi]);
      }
      setIf(row, 'Tail Length', input.tailLength);
      setIf(row, 'Tail Width', input.tailWidth);
      if (input.tailPoints) {
        for (pi = 0; pi < input.tailPoints.length; pi++) setIf(row, 'Tail T' + (pi + 1), input.tailPoints[pi]);
      }
      setIf(row, 'P1', input.head);
      setIf(row, 'P2', input.end1);
      setIf(row, 'P3', input.end2);
      setIf(row, 'P4', input.tail);
    } else if (info.plant === 'rts') {
      setIf(row, 'Item #', item);
      setIf(row, 'Description', desc);
      setIf(row, 'Parent Material', input.parent);
      setIf(row, 'Parent MFG Date', input.parentDate);
      setIf(row, 'Parent Shift', input.shift);
      setIf(row, 'Width', input.width);
      setIf(row, 'Length', input.length);
      setIf(row, 'Color', input.color);
      setIf(row, 'Delamination', input.delam);
      setIf(row, 'Blistering', input.blister);
      setIf(row, 'Alligator Skin', input.alligator);
      setIf(row, 'T Point 1', input.t1);
      setIf(row, 'T Point 2', input.t2);
      setIf(row, 'T Point 3', input.t3);
      setIf(row, 'MFG Date Pass', input.mfgPf);
      setIf(row, 'Width Pass', input.widthPf);
      setIf(row, 'Length Pass', input.lengthPf);
      setIf(row, 'Thickness Pass', input.thkPf);
    }
    row['Pass/Fail'] = skip ? String(reason).toUpperCase() : (input.passFail || 'Pass');
    return row;
  };

  QD.appendLineRows = function (existing, row) {
    var list = (existing || []).slice();
    if (row) list.push(row);
    return list;
  };

  QD.mergeDisk = function (disk) {
    var rows = [];
    var lookup = (disk && disk.lookupRows) || [];
    var lines = (disk && disk.lines) || {};
    var i, key, pack, j;
    for (i = 0; i < QD.LINE_FILES.length; i++) {
      key = QD.LINE_FILES[i];
      pack = lines[key];
      if (!pack || !pack.rows) continue;
      for (j = 0; j < pack.rows.length; j++) rows.push(pack.rows[j]);
    }
    return { rows: rows, lookupRows: lookup, users: (disk && disk.users) || [] };
  };

  QD.diskScript = function (kind, payload) {
    var body = 'window.QD_DISK=window.QD_DISK||{lines:{},lookupRows:[],users:[]};\n';
    if (kind === 'lookup') {
      body += 'QD_DISK.lookupRows=' + stringify(payload.lookupRows || []) + ';\n';
      body += 'QD_DISK.users=' + stringify(payload.users || []) + ';\n';
    } else {
      body += 'QD_DISK.lines[' + stringify(kind) + ']=' + stringify(payload) + ';\n';
    }
    return body;
  };

  QD.parseDiskJson = function (text, fileKey) {
    var src = QD.stripBom(text);
    var key = String(fileKey || '');
    var needle, i, json, parsed;
    if (!src || !key) return null;
    if (key === 'lookup') {
      needle = 'QD_DISK.lookupRows=';
      i = src.indexOf(needle);
      if (i < 0) return null;
      json = QD.trim(src.substring(i + needle.length));
      i = json.indexOf(';\nQD_DISK.users=');
      if (i < 0) i = json.indexOf(';QD_DISK.users=');
      if (i >= 0) json = json.substring(0, i);
      try { return { lookupRows: JSON.parse(json) }; } catch (e0) { return null; }
    }
    needle = 'QD_DISK.lines[' + stringify(key) + ']=';
    i = src.indexOf(needle);
    if (i < 0) {
      needle = 'QD_DISK.lines["' + key + '"]=';
      i = src.indexOf(needle);
    }
    if (i < 0) return null;
    json = QD.trim(src.substring(i + needle.length));
    if (json.charAt(json.length - 1) === ';') json = json.substring(0, json.length - 1);
    try { parsed = JSON.parse(json); } catch (e1) { return null; }
    return parsed;
  };

  QD.CSV_FILES = {
    items: ['MasterDatabase.csv', 'Master Database.csv'],
    mspecs: ['MasterSheet.csv', 'Master Sheet.csv'],
    users: ['UserList.csv', 'User List.csv'],
    rts: ['RtsSpecs.csv', 'RTS Specs.csv', 'Rts Specs.csv'],
    p1: ['P1Specs.csv', 'P1 Specs.csv'],
    bubble: ['BubbleSpecs.csv', 'Bubble Specs.csv']
  };

  QD.ITEM_TYPES = {
    BUBBLE: { id: 'BUBBLE', label: 'Bubble', lines: 'COEX and MONO', fields: ['description', 'width', 'slits', 'footage', 'perf', 'bubbleType', 'color', 'barcodeLabel', 'boxLabel'] },
    FOAM: { id: 'FOAM', label: 'Foam', lines: 'S1, S3, and S4', fields: ['description', 'width', 'slits', 'footage', 'perf', 'mspec'] },
    LAM: { id: 'LAM', label: 'Lam', lines: 'RTS', fields: ['description', 'length', 'width', 'parent', 'mspec', 'thickness'] },
    PLANK: { id: 'PLANK', label: 'Plank', lines: 'P1', fields: ['description', 'length', 'width', 'density', 'shots', 'soft'] }
  };

  QD.ITEM_FIELDS = [
    { key: 'item', label: 'Item #', required: true },
    { key: 'type', label: 'Type' },
    { key: 'description', label: 'Description' },
    { key: 'length', label: 'Length' },
    { key: 'width', label: 'Slit Width' },
    { key: 'slits', label: '# Slits' },
    { key: 'footage', label: 'Footage' },
    { key: 'perf', label: 'Perf' },
    { key: 'bubbleType', label: 'Bubble Type' },
    { key: 'color', label: 'Color' },
    { key: 'barcodeLabel', label: 'Barcode Label' },
    { key: 'boxLabel', label: 'Box Label' },
    { key: 'parent', label: 'Parent Material' },
    { key: 'mspec', label: 'MSPEC' },
    { key: 'thickness', label: 'Thickness' },
    { key: 'density', label: 'Density' },
    { key: 'shots', label: '# Shots' },
    { key: 'soft', label: 'Soft' }
  ];

  QD.lineItemType = function (lineId) {
    var info = QD.lineInfo(lineId);
    if (!info) return '';
    if (info.plant === 'bubble') return 'BUBBLE';
    if (info.plant === 'p1') return 'PLANK';
    if (info.plant === 'rts') return 'LAM';
    return 'FOAM';
  };

  QD.itemType = function (it) {
    if (!it) return '';
    var t = trim(it.type || it.Type || it.TYPE).toUpperCase();
    if (QD.ITEM_TYPES[t]) return t;
    if (trim(it.bubbleType)) return 'BUBBLE';
    if (trim(it.shots) || (it.soft != null && String(it.soft) !== '')) return 'PLANK';
    if (trim(it.parent) || (it.parents && it.parents.length)) return 'LAM';
    if (trim(it.thickness) && trim(it.length) && !trim(it.footage) && !trim(it.mspec)) return 'LAM';
    if (trim(it.mspec) || trim(it.footage)) return 'FOAM';
    if (trim(it.slits) && !trim(it.mspec)) return 'BUBBLE';
    return 'FOAM';
  };

  QD.fieldsForType = function (typeId) {
    var spec = QD.ITEM_TYPES[String(typeId || '').toUpperCase()];
    return spec ? ['item'].concat(spec.fields) : ['item', 'description'];
  };

  QD.CHECK_FIELDS = {
    s4: [
      { key: 'bundle', label: 'Bundle #' },
      { key: 'width', label: 'Width' },
      { key: 'slits', label: '# Slits', when: 'hasSlits' },
      { key: 'footage', label: 'Footage' },
      { key: 'cellMd', label: 'Cell Count MD' },
      { key: 'cellCd', label: 'Cell Count CD' },
      { key: 'weight', label: 'Weight (g)' },
      { key: 'points', label: 'Thickness points', kind: 'points', count: 13 }
    ],
    s1s3: [
      { key: 'bundle', label: 'Bundle #' },
      { key: 'width', label: 'Width' },
      { key: 'slits', label: '# Slits', when: 'hasSlits' },
      { key: 'footage', label: 'Footage' },
      { key: 'perf', label: 'Perf', when: 'perf' },
      { key: 'cellMd', label: 'Cell Count MD' },
      { key: 'cellCd', label: 'Cell Count CD' },
      { key: 'weight', label: 'Weight' },
      { key: 'points', label: 'Thickness points', kind: 'points', count: 13 },
      { key: 'winderTension', label: 'Winder tension', when: 's1s3' },
      { key: 'bumperPressure', label: 'Bumper roll pressure', when: 's1s3' },
      { key: 'diameter', label: 'Diameter (ULINE)', when: 'uline' }
    ],
    bubble: [
      { key: 'cohAdh', label: 'COH/ADH Verification', when: 'cohAdh' },
      { key: 'deadPost', label: 'Dead Cells and Air Transfers Post Vacuum Test' },
      { key: 'slits', label: '# Slits', when: 'hasSlits' },
      { key: 'width', label: 'Slit Width', when: 'slitWidth' },
      { key: 'webWidth', label: 'Web Width' },
      { key: 'footage', label: 'Footage' },
      { key: 'perfWidth', label: 'Perf Distance', when: 'perf' },
      { key: 'perfLeft', label: 'Perf Strength Left', when: 'perf' },
      { key: 'perfRight', label: 'Perf Strength Right', when: 'perf' },
      { key: 'weight', label: 'Basis Weight' },
      { key: 'color', label: 'Color' },
      { key: 'delam', label: 'Delam Check' },
      { key: 'prodNo', label: 'Work Order #' },
      { key: 'rollNo', label: 'Bundle #' },
      { key: 'diameter', label: 'Diameter (ULINE)', when: 'uline' }
    ],
    p1: [
      { key: 'length', label: 'Head Length' },
      { key: 'width', label: 'Head Width' },
      { key: 'cellMd', label: 'Cell Count MD' },
      { key: 'cellCd', label: 'Cell Count CD' },
      { key: 'weight', label: 'Plank Weight' },
      { key: 'headPoints', label: 'Head thickness points', kind: 'points', count: 12 }
    ],
    p1Double: [
      { key: 'tailLength', label: 'Tail Length' },
      { key: 'tailWidth', label: 'Tail Width' },
      { key: 'tailPoints', label: 'Tail thickness points', kind: 'points', count: 12 }
    ],
    rts: [
      { key: 'parent', label: 'Parent Material' },
      { key: 'parentDate', label: 'Parent MFG Date' },
      { key: 'shift', label: 'Parent Shift' },
      { key: 'width', label: 'Width' },
      { key: 'length', label: 'Length' },
      { key: 'color', label: 'Color' },
      { key: 'delam', label: 'Delamination' },
      { key: 'blister', label: 'Blistering' },
      { key: 'alligator', label: 'Alligator Skin' },
      { key: 'tattoo', label: 'Verify side tattoo exists' },
      { key: 't1', label: 'T Point 1' },
      { key: 't2', label: 'T Point 2' },
      { key: 't3', label: 'T Point 3' }
    ]
  };

  QD.CHECK_LINK_FIELDS = [
    { id: 'bundle', label: 'Bundle #' },
    { id: 'width', label: 'Slit Width' },
    { id: 'webWidth', label: 'Web Width' },
    { id: 'footage', label: 'Footage' },
    { id: 'weight', label: 'Basis Weight' },
    { id: 'cellMd', label: 'Cell Count MD' },
    { id: 'cellCd', label: 'Cell Count CD' },
    { id: 'perf', label: 'Perf' },
    { id: 'productVf', label: 'Product Verification' },
    { id: 'cohAdh', label: 'COH/ADH Verification' },
    { id: 'deadPost', label: 'Dead Cells and Air Transfers Post Vacuum Test' },
    { id: 'perfWidth', label: 'Perf Distance' },
    { id: 'slits', label: '# Slits' },
    { id: 'perfLeft', label: 'Perf Strength Left' },
    { id: 'perfRight', label: 'Perf Strength Right' },
    { id: 'delam', label: 'Delam Check' },
    { id: 'prodNo', label: 'Work Order #' },
    { id: 'rollNo', label: 'Bundle #' },
    { id: 'diameter', label: 'Diameter (ULINE)' },
    { id: 'parent', label: 'Parent Material' },
    { id: 'parentDate', label: 'Parent MFG Date' },
    { id: 'shift', label: 'Parent Shift' },
    { id: 'color', label: 'Color' },
    { id: 'delam', label: 'Delamination' },
    { id: 'blister', label: 'Blistering' },
    { id: 'alligator', label: 'Alligator Skin' },
    { id: 'tattoo', label: 'Verify side tattoo exists' },
    { id: 'winderTension', label: 'Winder tension' },
    { id: 'bumperPressure', label: 'Bumper roll pressure' },
    { id: 'points', label: 'Thickness points (T1–T13)' },
    { id: 'headPoints', label: 'Head thickness points (T1–T12)' },
    { id: 'tailPoints', label: 'Tail thickness points (T1–T12)' },
    { id: 'entries', label: '… entries section' }
  ];

  QD.itemNeedsSlitWidth = function (it) {
    var w = QD.num(it && it.width);
    return isFinite(w) && w !== 48;
  };

  QD.itemHasSlits = function (it) {
    return trim(it && it.slits) !== '';
  };

  QD.slitsExactMatch = function (entered, expected) {
    var a = trim(entered), b = trim(expected);
    if (!a || !b) return null;
    var na = QD.num(a), nb = QD.num(b);
    if (isFinite(na) && isFinite(nb)) return na === nb;
    return a === b;
  };

  QD.fieldApplies = function (f, ctx) {
    if (!f || !f.when) return true;
    var w = String(f.when);
    if (w === 'perf') return !!ctx.hasPerf;
    if (w === 'uline') return !!ctx.isUline;
    if (w === 'cohAdh') return !!ctx.hasCohAdh;
    if (w === 's1') return ctx.lineId === 'S1';
    if (w === 's1s3') return ctx.lineId === 'S1' || ctx.lineId === 'S3';
    if (w === 'slitWidth') return !!ctx.needsSlitWidth;
    if (w === 'hasSlits') return !!ctx.hasSlits;
    if (w === 'barcode') return !!ctx.hasBarcode;
    if (w === 'box') return !!ctx.hasBox;
    return true;
  };

  QD.mergeItemRows = function (items) {
    var map = {}, out = [], i, it, item, parent, rec, j;
    for (i = 0; i < (items || []).length; i++) {
      it = items[i];
      item = QD.canonItem(it.item || it['Item #']);
      if (!item) continue;
      parent = trim(it.parent || it['Parent Material'] || '');
      if (!map[item]) {
        rec = {};
        for (j in it) if (it.hasOwnProperty(j)) rec[j] = it[j];
        rec.item = item;
        rec.parents = parent ? [parent] : [];
        if (parent) rec.parent = parent;
        map[item] = rec;
        out.push(rec);
      } else {
        rec = map[item];
        if (parent && rec.parents.indexOf(parent) < 0) rec.parents.push(parent);
        if (!rec.parent && parent) rec.parent = parent;
      }
    }
    return out;
  };

  QD.missingCheckFields = function (lineId, reason, input) {
    var miss = [];
    var src = input || {};
    var r = String(reason || '').toUpperCase();
    if (!trim(reason)) miss.push('Reason for Check');
    if (r === 'NO CHECK') {
      if (!trim(src.noCheckReason)) miss.push('Additional reason');
      if (!trim(src.notes)) miss.push('Notes');
      return miss;
    }
    if (r === 'LINE UP') {
      if (!trim(src.notes)) miss.push('Notes');
      return miss;
    }
    if (QD.skipReason(lineId, reason)) {
      if (!trim(src.notes)) miss.push('Notes');
      return miss;
    }
    if (!QD.canonItem(src.item)) miss.push('Item #');
    var info = QD.lineInfo(lineId);
    var form = info ? info.form : '';
    var it = src.itemObj || null;
    var hasPerf = QD.itemHasPerf(it);
    var isUline = QD.itemIsUline(it);
    var hasCohAdh = QD.itemDescHasCohAdh(it);
    var needsSlitWidth = QD.itemNeedsSlitWidth(it);
    var hasSlits = QD.itemHasSlits(it);
    var ctx = { lineId: lineId, hasPerf: hasPerf, isUline: isUline, hasCohAdh: hasCohAdh, needsSlitWidth: needsSlitWidth, hasSlits: hasSlits };
    var fields = (QD.CHECK_FIELDS[form] || []).slice();
    if (form === 'p1' && QD.isDoubleShot(src.shots)) {
      fields = fields.concat(QD.CHECK_FIELDS.p1Double || []);
    }
    var i, f, v, pts, filled, j;
    for (i = 0; i < fields.length; i++) {
      f = fields[i];
      if (!QD.fieldApplies(f, ctx)) continue;
      if (f.kind === 'points') {
        pts = src[f.key] || (f.key === 'points' ? src.points : []) || [];
        filled = 0;
        for (j = 0; j < pts.length; j++) if (trim(pts[j]) !== '') filled += 1;
        if (filled < (f.count || 13)) miss.push(f.label);
      } else {
        v = src[f.key];
        if (v == null || trim(v) === '') miss.push(f.label);
      }
    }
    if (form === 's4' && isFinite(QD.num(src.itemLength)) && QD.num(src.itemLength) > 0) {
      if (!trim(src.sheetLength)) miss.push('Sheet Length');
    }
    return miss;
  };

  QD.parseCsv = function (text) {
    var s = String(text || '').replace(/^\ufeff/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var rows = [];
    var i = 0, field = '', row = [], q = false, c;
    function pushField() { row.push(field); field = ''; }
    function pushRow() {
      if (row.length === 1 && row[0] === '' && rows.length) return;
      rows.push(row);
      row = [];
    }
    if (!s) return { headers: [], rows: [] };
    while (i < s.length) {
      c = s.charAt(i);
      if (q) {
        if (c === '"') {
          if (s.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
          q = false; i += 1; continue;
        }
        field += c; i += 1; continue;
      }
      if (c === '"') { q = true; i += 1; continue; }
      if (c === ',') { pushField(); i += 1; continue; }
      if (c === '\n') { pushField(); pushRow(); i += 1; continue; }
      field += c; i += 1;
    }
    pushField();
    if (row.length) pushRow();
    if (!rows.length) return { headers: [], rows: [] };
    var headers = rows[0];
    var objects = [];
    var r, col, obj;
    for (r = 1; r < rows.length; r++) {
      obj = {};
      for (col = 0; col < headers.length; col++) {
        if (headers[col]) obj[headers[col]] = rows[r][col] == null ? '' : rows[r][col];
      }
      objects.push(obj);
    }
    return { headers: headers, rows: objects };
  };

  QD.mergeUsers = function (base, extra) {
    var seen = {};
    var out = [];
    function add(name) {
      var u = trim(name);
      if (!u) return;
      var key = u.toUpperCase();
      if (seen[key]) return;
      seen[key] = 1;
      out.push(u);
    }
    var i;
    for (i = 0; i < (base || []).length; i++) add(base[i]);
    for (i = 0; i < (extra || []).length; i++) add(extra[i]);
    return out;
  };

  QD.mergeItems = function (base, extra) {
    var out = (base || []).slice();
    var i, it, existing, k;
    for (i = 0; i < (extra || []).length; i++) {
      it = extra[i];
      existing = QD.findItem(out, it.item);
      if (existing) {
        for (k in it) if (Object.prototype.hasOwnProperty.call(it, k) && it[k] != null && it[k] !== '') existing[k] = it[k];
        if (it.deleted) existing.deleted = true;
      } else out.push(it);
    }
    return out.filter(function (row) { return !row.deleted; });
  };

  QD.parseRtsSpecs = function (text) {
    var parsed = QD.parseCsv(text);
    var out = [];
    var i, r, product;
    for (i = 0; i < parsed.rows.length; i++) {
      r = parsed.rows[i];
      product = trim(r.Product || r.product || r['Product label'] || r.Label);
      if (!product || /^product$/i.test(product)) continue;
      out.push({
        product: product,
        min: r.Min != null ? r.Min : r.Minimum,
        target: r.Target != null ? r.Target : r.target,
        max: r.Max != null ? r.Max : r.Maximum
      });
    }
    return out;
  };

  QD.parseP1Specs = function (text) {
    var parsed = QD.parseCsv(text);
    var out = [];
    var i, r, thk;
    for (i = 0; i < parsed.rows.length; i++) {
      r = parsed.rows[i];
      thk = trim(r.Thickness || r.thickness);
      if (!thk || /^thickness$/i.test(thk)) continue;
      out.push({
        thickness: thk,
        density: r.Density != null ? r.Density : r.density,
        min: r.Min != null ? r.Min : r.Minimum,
        max: r.Max != null ? r.Max : r.Maximum,
        ccMin: r['CC Min'] != null ? r['CC Min'] : r.ccMin,
        ccMax: r['CC Max'] != null ? r['CC Max'] : r.ccMax,
        thickMin: r['Thick Min'] != null ? r['Thick Min'] : r.thickMin,
        thickMax: r['Thick Max'] != null ? r['Thick Max'] : r.thickMax,
        thickTarget: r['Thick Target'] != null ? r['Thick Target'] : r.thickTarget
      });
    }
    return out;
  };

  QD.parseCsvLine = function (line) {
    var parsed = QD.parseCsv(String(line || '') + '\n');
    if (parsed.headers && parsed.headers.length) return parsed.headers;
    return [];
  };

  QD.parseBubbleSpecs = function (text) {
    var s = String(text || '').replace(/^\ufeff/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var lines = s.split('\n');
    var family = '';
    var specs = [];
    var dead = [];
    var i, row, abbr, bt, ab2, mx;
    for (i = 0; i < lines.length; i++) {
      if (!trim(lines[i])) continue;
      row = QD.parseCsvLine(lines[i]);
      if (!row.length) continue;
      if ((!row[0] || trim(row[0]) === '') && /^(COEX|MONO)$/i.test(trim(row[1]))) {
        family = trim(row[1]).toUpperCase();
        continue;
      }
      if (/^abbreviation$/i.test(trim(row[0]))) continue;
      abbr = trim(row[0]);
      if (abbr && family) {
        specs.push({
          family: family,
          abbreviation: abbr,
          product: trim(row[1]),
          calcGauge: row[2],
          min: row[3],
          target: row[4],
          max: row[5],
          bubbleType: trim(row[6])
        });
      }
      bt = trim(row[7]);
      ab2 = trim(row[8]);
      mx = trim(row[9]);
      if (bt && ab2 && !/^bubble type$/i.test(bt) && !/^abbreviations$/i.test(ab2)) {
        dead.push({ bubbleType: bt, abbreviations: ab2, maxDead: mx });
      }
    }
    return { specs: specs, deadCells: dead };
  };

  QD.findBubbleSpec = function (specs, family, bubbleType) {
    var fam = QD.bubbleFamily(family) || trim(family).toUpperCase();
    var raw = QD.normalizeBubbleType(bubbleType);
    var full = trim(bubbleType).toUpperCase();
    var i, row, key, bt, prod, best = null, bestLen = 0, prefixHits = 0, cand;
    if (!raw || !specs) return null;
    for (i = 0; i < specs.length; i++) {
      row = specs[i];
      if (fam && String(row.family || '').toUpperCase() !== fam) continue;
      key = trim(row.abbreviation).toUpperCase();
      bt = trim(row.bubbleType || '').toUpperCase();
      prod = trim(row.product || '').toUpperCase();
      if (key === raw || bt === full || bt === raw) return row;
      if (prod && (prod === full || prod === raw || prod.indexOf(raw + '-') === 0 || prod.indexOf(raw + ' ') === 0 || prod.indexOf(raw + '&') === 0)) {
        if (key.length >= bestLen) { best = row; bestLen = key.length; }
        continue;
      }
      if (key && raw.indexOf(key) === 0 && key.length > bestLen) { best = row; bestLen = key.length; prefixHits = 0; }
      if (key && full.indexOf(key) === 0 && key.length > bestLen) { best = row; bestLen = key.length; prefixHits = 0; }
      if (key && key.indexOf(raw) === 0 && raw.length >= 2) {
        if (raw.length > bestLen) {
          best = row;
          bestLen = raw.length;
          prefixHits = 1;
          cand = key;
        } else if (raw.length === bestLen && key !== cand) {
          prefixHits += 1;
        }
      }
    }
    if (prefixHits > 1) return null;
    return best;
  };

  QD.findP1Spec = function (specs, item) {
    if (!item || !specs) return null;
    var thk = trim(item.thickness);
    var dens = trim(item.density);
    var i, row;
    for (i = 0; i < specs.length; i++) {
      row = specs[i];
      if (trim(row.thickness) === thk && String(row.density) === String(dens)) return row;
    }
    for (i = 0; i < specs.length; i++) {
      row = specs[i];
      if (trim(row.thickness) === thk) return row;
    }
    return null;
  };

  QD.findRtsSpec = function (specs, parentMaterial) {
    var want = trim(parentMaterial).toUpperCase();
    var i, row, product;
    if (!want || !specs) return null;
    for (i = 0; i < specs.length; i++) {
      row = specs[i];
      product = trim(row.product).toUpperCase();
      if (product === want) return row;
      if (want.indexOf(product) >= 0 || product.indexOf(want) >= 0) return row;
    }
    return null;
  };

  QD.deadCellMaxFromFile = function (deadCells, bubbleType) {
    var raw = trim(bubbleType).toUpperCase();
    var i, row, list, j, token, best = null, bestLen = 0;
    if (!raw || !deadCells) return NaN;
    for (i = 0; i < deadCells.length; i++) {
      row = deadCells[i];
      list = String(row.abbreviations || row.bubbleType || '').split(/[,;]+/);
      for (j = 0; j < list.length; j++) {
        token = trim(list[j]).toUpperCase();
        if (!token) continue;
        if (raw === token || raw.indexOf(token) === 0) {
          if (token.length > bestLen) {
            best = row;
            bestLen = token.length;
          }
        }
      }
    }
    return best ? QD.num(best.maxDead) : NaN;
  };

  QD.foamKey = function (r) { return QD.canonMspec(r && (r['MSPEC #'] || r.mspec)); };
  QD.bubbleKey = function (r) { return trim(r && r.family).toUpperCase() + '|' + trim(r && r.abbreviation).toUpperCase(); };
  QD.p1Key = function (r) { return trim(r && r.thickness) + '|' + trim(r && r.density); };
  QD.rtsKey = function (r) { return trim(r && r.product); };

  QD.bumpSpecVersion = function (v) {
    var parts = String(v || '1.0.0').split('.');
    while (parts.length < 3) parts.push('0');
    parts[2] = String((parseInt(parts[2], 10) || 0) + 1);
    return parts[0] + '.' + parts[1] + '.' + parts[2];
  };

  QD.ensureSpecVersion = function (row) {
    if (!row) return row;
    if (!trim(row.version)) row.version = '1.0.0';
    return row;
  };

  QD.specChangedKeys = function (before, after) {
    var seen = {}, keys = [], changed = [], i, k, a, b;
    function collect(src) {
      var key;
      for (key in (src || {})) {
        if (!src.hasOwnProperty(key) || seen[key]) continue;
        seen[key] = 1;
        keys.push(key);
      }
    }
    collect(before);
    collect(after);
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      b = before && before[k] != null ? String(before[k]) : '';
      a = after && after[k] != null ? String(after[k]) : '';
      if (b !== a) changed.push(k);
    }
    return changed;
  };

  QD.thicknessFieldIds = function (lineId, site) {
    var info = QD.lineInfo(lineId, site);
    var i, out = [];
    if (!info) return out;
    if (info.form === 's4') {
      for (i = 1; i <= 13; i++) out.push('s4t' + i);
    } else if (info.form === 's1s3') {
      for (i = 1; i <= 13; i++) out.push('s1t' + i);
    } else if (info.form === 'rts') {
      out.push('rt1', 'rt2', 'rt3');
    }
    return out;
  };

  QD.makeInboxRequest = function (type, name, extra) {
    extra = extra || {};
    return {
      id: 'r' + (new Date()).getTime() + String(Math.floor(Math.random() * 1000)),
      type: trim(type) || 'reset',
      name: trim(name),
      at: (new Date()).toISOString(),
      status: 'pending',
      salt: extra.salt || '',
      hash: extra.hash || '',
      plant: trim(extra.plant || 'VISALIA').toUpperCase() || 'VISALIA',
      line: trim(extra.line || ''),
      item: trim(extra.item || ''),
      disposition: trim(extra.disposition || ''),
      detail: trim(extra.detail || ''),
      checkAt: trim(extra.checkAt || '')
    };
  };

  QD.DISPOSITIONS = ['SCRAP', 'QUALITY HOLD', 'PASS AS IS'];

  QD.pendingInbox = function (requests, user) {
    var out = [], i, r;
    for (i = 0; i < (requests || []).length; i++) {
      r = requests[i];
      if (!r || r.status !== 'pending') continue;
      if (user) {
        if (r.type === 'newUser' || r.type === 'reset') {
          if (!user.admin) continue;
        } else if (r.type === 'deviation' || r.type === 'rtsStartup' || r.type === 'itemChange') {
          if (!QD.userCanApprovePlant(user, r.plant)) continue;
        } else if (!user.admin && !QD.userIsSupervisor(user) && !QD.userIsLead(user)) continue;
      }
      out.push(r);
    }
    return out;
  };

  QD.findPendingNewUser = function (requests, name) {
    var want = trim(name).toUpperCase();
    var i, r;
    if (!want) return null;
    for (i = 0; i < (requests || []).length; i++) {
      r = requests[i];
      if (r && r.type === 'newUser' && r.status === 'pending' && trim(r.name).toUpperCase() === want) return r;
    }
    return null;
  };

  QD.tempPassword = function () {
    return 'TMP' + String(100000 + Math.floor(Math.random() * 900000));
  };

  QD.auditEntry = function (action, user, detail) {
    return {
      at: (new Date()).toISOString(),
      action: trim(action),
      user: trim(user),
      detail: trim(detail)
    };
  };

  QD.specHistoryEntry = function (kind, key, user, why, before, after) {
    return {
      kind: kind,
      key: key,
      at: (new Date()).toISOString(),
      user: trim(user),
      why: trim(why),
      before: before || {},
      after: after || {}
    };
  };

  QD.historyForSpec = function (history, kind, key) {
    var out = [];
    var i, row;
    var want = String(key || '');
    for (i = 0; i < (history || []).length; i++) {
      row = history[i];
      if (row && row.kind === kind && String(row.key) === want) out.push(row);
    }
    return out;
  };

  /* SHA-256 hex digest. ES3/IE11. */
  QD.sha256 = function (ascii) {
    function rotr(n, x) { return (x >>> n) | (x << (32 - n)); }
    var k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    var bytes = [];
    var i, j, n, len, bitLen, h0, h1, h2, h3, h4, h5, h6, h7;
    var w, a, b, c, d, e, f, g, h, t1, t2, s0, s1, ch, maj, msg;
    msg = String(ascii || '');
    for (i = 0; i < msg.length; i++) {
      n = msg.charCodeAt(i);
      if (n < 128) bytes.push(n);
      else if (n < 2048) { bytes.push(192 | (n >> 6)); bytes.push(128 | (n & 63)); }
      else { bytes.push(224 | (n >> 12)); bytes.push(128 | ((n >> 6) & 63)); bytes.push(128 | (n & 63)); }
    }
    bitLen = bytes.length * 8;
    bytes.push(0x80);
    while ((bytes.length % 64) !== 56) bytes.push(0);
    for (i = 7; i >= 0; i--) bytes.push((bitLen / Math.pow(2, i * 8)) & 255);
    h0 = 0x6a09e667; h1 = 0xbb67ae85; h2 = 0x3c6ef372; h3 = 0xa54ff53a;
    h4 = 0x510e527f; h5 = 0x9b05688c; h6 = 0x1f83d9ab; h7 = 0x5be0cd19;
    for (i = 0; i < bytes.length; i += 64) {
      w = [];
      for (j = 0; j < 16; j++) {
        w[j] = (bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) | (bytes[i + j * 4 + 2] << 8) | bytes[i + j * 4 + 3];
      }
      for (j = 16; j < 64; j++) {
        s0 = rotr(7, w[j - 15]) ^ rotr(18, w[j - 15]) ^ (w[j - 15] >>> 3);
        s1 = rotr(17, w[j - 2]) ^ rotr(19, w[j - 2]) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      a = h0; b = h1; c = h2; d = h3; e = h4; f = h5; g = h6; h = h7;
      for (j = 0; j < 64; j++) {
        s1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
        ch = (e & f) ^ ((~e) & g);
        t1 = (h + s1 + ch + k[j] + w[j]) | 0;
        s0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
        maj = (a & b) ^ (a & c) ^ (b & c);
        t2 = (s0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    function hex(v) {
      var s = (v < 0 ? (v + 0x100000000) : v).toString(16);
      return ('00000000' + s).slice(-8);
    }
    return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7);
  };

  QD.randomSalt = function () {
    return QD.sha256(String(new Date().getTime()) + ':' + Math.random() + ':' + Math.random());
  };

  QD.hashPassword = function (password, salt) {
    return QD.sha256(String(salt || '') + '\n' + String(password || ''));
  };

  QD.makeUserRecord = function (name, password, admin, mustChange, plant, lines, supervisor, lead) {
    var salt = QD.randomSalt();
    return {
      name: trim(name),
      admin: !!admin,
      salt: salt,
      hash: QD.hashPassword(password, salt),
      mustChange: !!mustChange,
      plant: trim(plant || (admin ? 'BOTH' : 'VISALIA')).toUpperCase() || 'VISALIA',
      lines: trim(lines || '*') || '*',
      supervisor: !!supervisor,
      lead: !!lead
    };
  };

  QD.userIsSupervisor = function (user) {
    return !!(user && (user.supervisor || user.admin));
  };

  QD.userIsLead = function (user) {
    return !!(user && (user.lead || user.admin));
  };

  QD.userCanApprovePlant = function (user, plant) {
    if (!user) return false;
    if (user.admin) return true;
    if (!QD.userIsSupervisor(user) && !QD.userIsLead(user)) return false;
    var up = String(user.plant || 'VISALIA').toUpperCase();
    var want = String(plant || 'VISALIA').toUpperCase();
    return up === 'BOTH' || up === want;
  };

  QD.parseUsersDat = function (text) {
    var out = [];
    var lines = String(text || '').replace(/^\ufeff/, '').split(/\r?\n/);
    var i, parts, name;
    for (i = 0; i < lines.length; i++) {
      if (!trim(lines[i]) || lines[i].charAt(0) === '#') continue;
      parts = lines[i].split('|');
      name = trim(parts[0]);
      if (!name) continue;
      out.push({
        name: name,
        admin: parts[1] === '1' || /^true$/i.test(parts[1] || ''),
        salt: parts[2] || '',
        hash: parts[3] || '',
        mustChange: parts[4] === '1',
        plant: trim(parts[5] || (name.toUpperCase() === QD.SEED_USER ? 'BOTH' : 'VISALIA')).toUpperCase() || 'VISALIA',
        lines: trim(parts[6] || '*') || '*',
        supervisor: parts[7] === '1' || /^true$/i.test(parts[7] || ''),
        lead: parts[8] === '1' || /^true$/i.test(parts[8] || '')
      });
    }
    return out;
  };

  QD.formatUsersDat = function (users) {
    var lines = ['# quality-desk users — hashed passwords, do not share'];
    var i, u;
    for (i = 0; i < (users || []).length; i++) {
      u = users[i];
      if (!u || !trim(u.name)) continue;
      lines.push([
        trim(u.name),
        u.admin ? '1' : '0',
        u.salt || '',
        u.hash || '',
        u.mustChange ? '1' : '0',
        trim(u.plant || 'VISALIA').toUpperCase(),
        trim(u.lines || '*') || '*',
        u.supervisor ? '1' : '0',
        u.lead ? '1' : '0'
      ].join('|'));
    }
    return lines.join('\n') + '\n';
  };

  QD.userCanSeeSite = function (user, site) {
    if (!user) return false;
    var plant = String(user.plant || 'VISALIA').toUpperCase();
    var sit = String(site || 'VISALIA').toUpperCase();
    if (user.admin || plant === 'BOTH') return true;
    return plant === sit;
  };

  QD.userCanSeeLine = function (user, lineId, site) {
    if (!QD.userCanSeeSite(user, site)) return false;
    var info = QD.lineInfo(lineId, site);
    if (!info) return false;
    if (user.admin || String(user.lines || '*') === '*') return true;
    var label = String(info.label || info.id).toUpperCase();
    var parts = String(user.lines || '').toUpperCase().split(/[,;]+/);
    var i;
    for (i = 0; i < parts.length; i++) {
      if (trim(parts[i]) === label || trim(parts[i]) === info.id) return true;
    }
    return false;
  };

  QD.dateFromSerial = function (serial) {
    if (serial instanceof Date) return serial;
    var n = QD.num(serial);
    if (isFinite(n) && n > 20000) return new Date(Math.round((n - 25569) * 86400000));
    var d = new Date(serial);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  QD.serialWall = function (serial) {
    var d = QD.dateFromSerial(serial);
    if (serial instanceof Date) {
      return { y: d.getFullYear(), m: d.getMonth(), day: d.getDate(), h: d.getHours(), min: d.getMinutes(), dow: d.getDay() };
    }
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate(), h: d.getUTCHours(), min: d.getUTCMinutes(), dow: d.getUTCDay() };
  };

  QD.formatClock = function (serial) {
    var w = QD.serialWall(serial);
    var h = w.h, m = w.min;
    var ap = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12;
    if (!h12) h12 = 12;
    return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
  };

  QD.formatDateTime = function (serial) {
    var w = QD.serialWall(serial);
    if (!w || !isFinite(w.y)) return QD.formatClock(serial);
    return (w.m + 1) + '/' + w.day + '/' + w.y + ' ' + QD.formatClock(serial);
  };

  QD.shiftAt = function (when) {
    var h = when instanceof Date ? when.getHours() : QD.serialWall(when).h;
    if (h >= 7 && h < 15) return '1';
    if (h >= 15 && h < 23) return '2';
    return '3';
  };

  QD.rowItem = function (row) {
    if (!row) return '';
    return QD.canonItem(row['Item #'] || row.Item || row.item);
  };

  QD.rowUser = function (row) {
    if (!row) return '';
    return String(row.User || row.user || row.Operator || '').toUpperCase();
  };

  QD.needsStartup = function (lastRow, itemNo, when, userName) {
    if (!lastRow) return true;
    if (QD.canonItem(itemNo) !== QD.rowItem(lastRow)) return true;
    var nextUser = String(userName || '').toUpperCase();
    if (nextUser && QD.rowUser(lastRow) && QD.rowUser(lastRow) !== nextUser) return true;
    return false;
  };

  QD.lastBubbleType = function (row, items) {
    if (!row) return '';
    var stored = trim(row['Bubble Type'] || row.bubbleType || '');
    if (stored) return stored;
    var it = items ? QD.findItem(items, QD.rowItem(row)) : null;
    return it ? trim(it.bubbleType) : '';
  };

  QD.needsCoexSpeeds = function (lineId, lastRow, item, items) {
    var fam = QD.bubbleFamily(lineId);
    if (fam !== 'COEX') return false;
    var next = item ? trim(item.bubbleType) : '';
    if (!next) return false;
    if (!lastRow) return true;
    return QD.normalizeBubbleType(QD.lastBubbleType(lastRow, items)) !== QD.normalizeBubbleType(next);
  };

  QD.frontToBackRatio = function (item) {
    return QD.itemIsUline(item) ? QD.FRONT_TO_BACK_ULINE : QD.FRONT_TO_BACK_OTHER;
  };

  QD.emptyCoexStructure = function (name) {
    return {
      name: trim(name),
      version: '1.0.0',
      lineSpeed: '',
      A: { speed: '', meltPump1: '', meltPump2: '' },
      B: { speed: '', meltPump1: '', meltPump2: '' },
      C: { speed: '', meltPump1: '', meltPump2: '' }
    };
  };

  QD.emptyLineProfile = function () {
    return { version: '1.0.0', structures: [] };
  };

  QD.emptyPlantProfiles = function () {
    return {};
  };

  QD.normalizeStructure = function (st) {
    st = st || {};
    return {
      name: trim(st.name),
      version: trim(st.version) || '1.0.0',
      lineSpeed: st.lineSpeed != null ? st.lineSpeed : '',
      A: { speed: (st.A && st.A.speed) || '', meltPump1: (st.A && st.A.meltPump1) || '', meltPump2: (st.A && st.A.meltPump2) || '' },
      B: { speed: (st.B && st.B.speed) || '', meltPump1: (st.B && st.B.meltPump1) || '', meltPump2: (st.B && st.B.meltPump2) || '' },
      C: { speed: (st.C && st.C.speed) || '', meltPump1: (st.C && st.C.meltPump1) || '', meltPump2: (st.C && st.C.meltPump2) || '' }
    };
  };

  QD.normalizeLineProfile = function (src) {
    var out = QD.emptyLineProfile(), i;
    if (!src) return out;
    out.version = trim(src.version) || '1.0.0';
    out.structures = [];
    for (i = 0; i < (src.structures || []).length; i++) out.structures.push(QD.normalizeStructure(src.structures[i]));
    return out;
  };

  QD.normalizeProfiles = function (raw) {
    var out = { VISALIA: {}, GARLAND: {} };
    var site, lines, i, id, src, plant, k;
    if (!raw) raw = {};
    for (site in out) {
      if (!out.hasOwnProperty(site)) continue;
      plant = raw[site] || {};
      lines = QD.linesForSite(site) || [];
      for (i = 0; i < lines.length; i++) {
        id = lines[i].id;
        src = plant[id] || null;
        if (!src && (id === 'COEX' || id === 'G-COEX')) src = plant.COEX || plant.coex || null;
        out[site][id] = QD.normalizeLineProfile(src);
      }
      /* keep any extra legacy keys that look like line profiles */
      for (k in plant) {
        if (!plant.hasOwnProperty(k) || out[site][k]) continue;
        if (plant[k] && plant[k].structures) out[site][k] = QD.normalizeLineProfile(plant[k]);
      }
    }
    return out;
  };

  QD.needsLineUp = function (lastRow) {
    if (!lastRow) return false;
    return String(lastRow['Reason for Check'] || '').toUpperCase() === 'NO CHECK';
  };

  QD.lastCheckLabel = function (row) {
    if (!row) return 'No checks yet';
    var w = QD.serialWall(row['Date/Time']);
    var now = new Date();
    var sameDay = w.y === now.getFullYear() && w.m === now.getMonth() && w.day === now.getDate();
    var when;
    if (sameDay) when = QD.formatClock(row['Date/Time']);
    else {
      var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      when = days[w.dow] + ' ' + (w.m + 1) + '/' + w.day + ' ' + QD.formatClock(row['Date/Time']);
    }
    var reason = String(row['Reason for Check'] || '').toUpperCase();
    var extra = trim(row['No Check Reason'] || '');
    var extraU = extra.toUpperCase();
    var pf = trim(row['Pass/Fail'] || '');
    var pfU = pf.toUpperCase();
    var notes = trim(row.Notes || '');
    var item = trim(row['Item #'] || row.Item || '');
    var desc = trim(row['Item Desc'] || row['Item Description'] || '');
    var itemBit = item ? (item + (desc ? ' ' + desc : '')) : '';
    var status;
    var isLineDown = reason === 'LINE DOWN' || extraU === 'LINE DOWN' || pfU === 'LINE DOWN';

    function finish(part) {
      if (itemBit) return 'last check ' + part + ' · ' + itemBit + ' @ ' + when;
      return 'last check ' + part + ' @ ' + when;
    }

    if (isLineDown) {
      status = 'LINE DOWN';
      if (extra && extraU !== 'LINE DOWN') status += ' — ' + extra;
      else if (reason === 'NO CHECK' && extraU === 'LINE DOWN') status = 'LINE DOWN';
      if (notes) status += (status.indexOf('—') >= 0 ? '; ' : ' — ') + notes;
      return finish(status);
    }
    if (reason === 'NO CHECK') {
      status = extra || 'NO CHECK';
      if (notes) status += ' — ' + notes;
      return finish(status);
    }
    if (reason === 'LINE UP' || pfU === 'LINE UP') return finish('LINE UP');
    if (pfU === 'FAIL' || pfU === 'FAILED') {
      status = 'Fail';
      if (notes) status += ': ' + notes;
      return finish(status);
    }
    return finish(pf || reason || '—');
  };

  QD.docIsConstructionCard = function (doc) {
    return doc && String(doc.type || '') === 'Construction Card';
  };

  QD.conCardLinkedItems = function (doc) {
    var out = [], raw = doc && doc.linkedItems, i;
    if (!raw) return out;
    if (typeof raw === 'string') {
      raw = raw.split(/[,;]+/);
      for (i = 0; i < raw.length; i++) {
        if (trim(raw[i])) out.push(QD.canonItem(raw[i]));
      }
      return out;
    }
    if (raw.length) {
      for (i = 0; i < raw.length; i++) if (trim(raw[i])) out.push(QD.canonItem(raw[i]));
    }
    return out;
  };

  QD.pendingConCardsForCheck = function (docs, acks, userName, lineId, itemNo) {
    var out = [], i, d, a, j, items, item = QD.canonItem(itemNo);
    if (!item) return out;
    for (i = 0; i < (docs || []).length; i++) {
      d = docs[i];
      if (!QD.docIsConstructionCard(d)) continue;
      if (d.line && !QD.docMatchesUserLines(d.line, [lineId])) continue;
      items = QD.conCardLinkedItems(d);
      if (!items.length) continue;
      if (items.indexOf(item) < 0) continue;
      a = null;
      for (j = 0; j < (acks || []).length; j++) {
        if (acks[j] && acks[j].docId === d.id && String(acks[j].user || '').toUpperCase() === String(userName || '').toUpperCase()) {
          if (!a || String(acks[j].at) > String(a.at)) a = acks[j];
        }
      }
      if (QD.docNeedsReview(d, a)) out.push(d);
    }
    return out;
  };

  QD.docNeedsReview = function (doc, ack, now) {
    if (!doc) return false;
    if (!ack || String(ack.version) !== String(doc.version)) return true;
    var at = new Date(ack.at).getTime();
    var t = (now || new Date()).getTime();
    return !isFinite(at) || (t - at) >= QD.DOC_REVIEW_MS;
  };

  QD.docsForAssignedLines = function (docs, lineIds) {
    var out = [], i, d;
    for (i = 0; i < (docs || []).length; i++) {
      d = docs[i];
      if (!d || QD.docIsConstructionCard(d)) continue;
      if (QD.docMatchesUserLines(d.line, lineIds)) out.push(d);
    }
    return out;
  };

  QD.pendingDocs = function (docs, acks, userName, lineIds) {
    var out = [];
    var i, d, a, j, match;
    var lines = lineIds || [];
    for (i = 0; i < (docs || []).length; i++) {
      d = docs[i];
      if (!d) continue;
      if (QD.docIsConstructionCard(d)) continue;
      match = QD.docMatchesUserLines(d.line, lines);
      if (!match) continue;
      a = null;
      for (j = 0; j < (acks || []).length; j++) {
        if (acks[j] && acks[j].docId === d.id && String(acks[j].user || '').toUpperCase() === String(userName || '').toUpperCase()) {
          if (!a || String(acks[j].at) > String(a.at)) a = acks[j];
        }
      }
      if (QD.docNeedsReview(d, a)) out.push(d);
    }
    return out;
  };

  QD.bubbleStartupIncludePerf = function (lineId, it) {
    var fam = QD.bubbleFamily(lineId);
    return (fam === 'COEX' || fam === 'MONO') && QD.itemHasPerf(it);
  };

  QD.startupComplete = function (answers, includePerf, includeCoexSpeeds) {
    var i, id;
    for (i = 0; i < QD.STARTUP_ITEMS.length; i++) {
      id = QD.STARTUP_ITEMS[i].id;
      if (!answers || String(answers[id] || '').toUpperCase() !== 'YES') return false;
    }
    if (includePerf) {
      id = QD.STARTUP_PERF_ITEM.id;
      var v = String((answers && answers[id]) || '').toUpperCase();
      if (v !== 'PASS' && v !== 'FAIL') return false;
    }
    if (includeCoexSpeeds) {
      for (i = 0; i < QD.COEX_CHANGEOVER_FIELDS.length; i++) {
        id = QD.COEX_CHANGEOVER_FIELDS[i].id;
        if (!answers || !trim(answers[id])) return false;
      }
    }
    return true;
  };

  QD.rtsStartupComplete = function (answers) {
    var i, j, act, st, v, stations = QD.RTS_STARTUP_STATIONS;
    for (i = 0; i < QD.RTS_STARTUP_ACTIONS.length; i++) {
      act = QD.RTS_STARTUP_ACTIONS[i];
      if (act.stations) {
        for (j = 0; j < stations.length; j++) {
          v = answers ? answers[act.id + '_s' + stations[j]] : '';
          if (String(v).toUpperCase() !== 'PASS' && String(v).toUpperCase() !== 'FAIL') return false;
        }
      } else {
        v = answers ? answers[act.id] : '';
        if (String(v).toUpperCase() !== 'PASS' && String(v).toUpperCase() !== 'FAIL') return false;
      }
    }
    return true;
  };

  QD.itemAllowedOnLine = function (item, lineId, site) {
    if (!item) return false;
    var want = QD.lineItemType(QD.resolveLineId(site, lineId));
    var typ = QD.itemType(item);
    return !want || typ === want;
  };

  QD.pointBand = function (val, lo, hi) {
    var n = QD.num(val);
    if (!isFinite(n)) return '';
    if (isFinite(lo) && n < lo) return 'under';
    if (isFinite(hi) && n > hi) return 'over';
    if (isFinite(lo) || isFinite(hi)) return 'in';
    return '';
  };

  QD.histTFields = function () {
    var out = [], i;
    for (i = 1; i <= 13; i++) out.push('T' + i);
    return out;
  };

  QD.histPreferredFields = function () {
    return QD.HIST_CHECK_FIELDS.concat(QD.histTFields());
  };

  QD.histColumnsForLine = function (fileKey) {
    var info = null, i;
    for (i = 0; i < QD.LINES.length; i++) {
      if (QD.LINES[i].file === fileKey) { info = QD.LINES[i]; break; }
    }
    var common = ['Date/Time', 'User', 'Item #', 'Item Desc', 'Reason for Check', 'Pass/Fail', 'Notes'];
    if (!info) return common;
    if (info.plant === 'foam') {
      return common.concat(['MSPEC', 'Bundle #', 'Slit/Width', '# Slits', 'Footage', 'Cell Count MD', 'Cell Count CD', 'Thickness Average', 'Thickness Range', 'Density', 'Weight']);
    }
    if (info.plant === 'bubble') {
      return common.concat([
        'Slit Width', 'Web Width', '# Slits', 'Footage', 'Basis Weight',
        'Dead Cells and Air Transfers Post Vacuum Test',
        'Perf Distance', 'Perf Strength Left', 'Perf Strength Right', 'Color', 'Delam Check',
        'Work Order #', 'Bundle #', 'Barcode Label', 'Box Label', 'Bubble Type',
        'Line Speed',
        'Extruder A Speed', 'Extruder A Melt Pump 1', 'Extruder A Melt Pump 2',
        'Extruder B Speed', 'Extruder B Melt Pump 1', 'Extruder B Melt Pump 2',
        'Extruder C Speed', 'Extruder C Melt Pump 1', 'Extruder C Melt Pump 2'
      ]);
    }
    if (info.plant === 'p1') {
      return common.concat(['Length', 'Width', 'Plank Weight', 'Density', '# Shots']);
    }
    if (info.plant === 'rts') {
      return common.concat(['Parent Material', 'Width', 'Length', 'Color', 'Delam Check']);
    }
    return common;
  };

  QD.histColumns = function (rows) {
    var seen = {}, out = [], preferred = QD.histPreferredFields(), i, rec, row, k;
    for (i = 0; i < preferred.length; i++) {
      k = preferred[i];
      if (!seen[k]) { seen[k] = 1; out.push(k); }
    }
    for (i = 0; i < (rows || []).length; i++) {
      rec = rows[i];
      row = rec && (rec.row || rec);
      if (!row) continue;
      for (k in row) {
        if (!row.hasOwnProperty(k) || !k || k.charAt(0) === '_') continue;
        if (seen[k]) continue;
        seen[k] = 1;
        out.push(k);
      }
    }
    return out;
  };

  QD.histValue = function (row, key) {
    if (!row) return '';
    if (row[key] != null && trim(row[key]) !== '') return row[key];
    var aliases = {
      'Item #': ['Item', 'Item Number'],
      'Item Desc': ['Item Description', 'Description'],
      'Slit Width': ['Width', 'Slit/Width'],
      'Basis Weight': ['Weight', 'Gram Weight'],
      'Perf Distance': ['Perf Width', 'Perf'],
      'Dead Cells and Air Transfers Post Vacuum Test': ['Dead Cell Post', '# Dead Cells Post', 'DeadCellCount'],
      'Delam Check': ['Delam', 'Delamination']
    };
    var list = aliases[key], i;
    if (!list) return row[key] == null ? '' : row[key];
    for (i = 0; i < list.length; i++) {
      if (row[list[i]] != null && trim(row[list[i]]) !== '') return row[list[i]];
    }
    return '';
  };

  QD.histSpecCtx = function (row, aio) {
    aio = aio || {};
    var line = row ? (row.Line || '') : '';
    var info = QD.lineInfo(line);
    var itemNo = row ? (row['Item #'] || row.Item || '') : '';
    var mspec = row ? (row.MSPEC || row['MSPEC #'] || '') : '';
    return {
      spec: QD.findMspec(aio.mspecs, mspec),
      item: QD.findItem(aio.items, itemNo),
      lineId: info ? info.id : line,
      form: info ? info.form : '',
      plant: info ? info.plant : '',
      bubble: aio.bubble || [],
      bubbleDead: aio.bubbleDead || [],
      p1: aio.p1 || [],
      rts: aio.rts || []
    };
  };

  QD.histStoredBand = function (row, key) {
    var stored = row ? (row[key + ' Pass/Fail'] || row[key + ' Pass'] || row[key + 'Pass'] || '') : '';
    stored = String(stored).toUpperCase();
    if (stored === 'PASS' || stored === 'OK') return 'in';
    if (stored === 'FAIL') return 'over';
    return '';
  };

  QD.histCellBand = function (row, key, ctx) {
    var spec, item, v, lo, hi, bw, p1, wt, form, plant, stored;
    if (!row || !key) return '';
    ctx = ctx || {};
    spec = ctx.spec || {};
    item = ctx.item || {};
    form = ctx.form || '';
    plant = ctx.plant || '';
    if (key === 'Pass/Fail') {
      v = String(row['Pass/Fail'] || '').toUpperCase();
      if (v === 'PASS') return 'in';
      if (v === 'FAIL') return 'over';
      return '';
    }
    if (/^T\d+$/.test(key) || key === 'Thickness Average') {
      return QD.pointBand(row[key], QD.num(spec['Lower Control']), QD.num(spec['Upper Control']));
    }
    if (key === 'Thickness Range') {
      v = QD.num(row[key]);
      hi = QD.num(spec['Thickness Range Max']);
      if (!isFinite(v) || !isFinite(hi)) return '';
      return v > hi ? 'over' : 'in';
    }
    if (key === 'Density') {
      if (plant === 'p1') {
        p1 = QD.findP1Spec(ctx.p1, item);
        if (p1) return QD.pointBand(row[key], QD.num(p1.min), QD.num(p1.max));
      }
      return QD.pointBand(row[key], QD.num(spec['Density Min']), QD.num(spec['Density Max']));
    }
    if (key === 'Cell Count MD' || key === 'Cell Count CD') {
      lo = QD.num(spec['Cell Count Min']);
      hi = QD.num(spec['Cell Count Max']);
      if (plant === 'p1') {
        p1 = QD.findP1Spec(ctx.p1, item);
        if (p1) { lo = QD.num(p1.ccMin); hi = QD.num(p1.ccMax); }
      }
      return QD.pointBand(row[key], lo, hi);
    }
    if (key === 'Slit/Width' || (key === 'Width' && plant === 'foam')) {
      v = QD.num(row['Slit/Width'] != null && row['Slit/Width'] !== '' ? row['Slit/Width'] : row.Width);
      wt = QD.num(item.width);
      if (!isFinite(v) || !isFinite(wt)) return QD.histStoredBand(row, key);
      lo = wt - (form === 's4' ? 1.5 : 0.5);
      return QD.pointBand(v, lo, Infinity);
    }
    if (key === 'Weight' || key === 'Basis Weight') {
      bw = QD.bubbleWeightForLine(ctx.bubble, ctx.lineId, item.bubbleType);
      if (bw) return QD.pointBand(row[key], QD.num(bw.min), QD.num(bw.max));
      return QD.pointBand(row[key], QD.num(spec['Weight Min']), QD.num(spec['Weight Max']));
    }
    if (key === 'Width' && plant === 'bubble') {
      v = QD.num(row.Width);
      wt = QD.num(item.width);
      if (!isFinite(v) || !isFinite(wt)) return QD.histStoredBand(row, 'Width');
      return QD.pointBand(v, wt - 0.25, wt + 0.25);
    }
    if (key === '# Dead Cells Post' || key === 'DeadCellCount' || key === 'Dead Cells and Air Transfers Post Vacuum Test' || key === 'Dead Cell Post') {
      hi = QD.deadCellMaxFromFile(ctx.bubbleDead, item.bubbleType);
      if (!isFinite(hi)) hi = QD.deadCellMax(item.bubbleType);
      v = QD.num(QD.histValue(row, 'Dead Cells and Air Transfers Post Vacuum Test') || row[key]);
      if (!isFinite(v) || !isFinite(hi)) return '';
      return v > hi ? 'over' : 'in';
    }
    if (key === 'Web Width') {
      return QD.pointBand(row[key], QD.WEB_WIDTH_TARGET - QD.WEB_WIDTH_TOL, QD.WEB_WIDTH_TARGET + QD.WEB_WIDTH_TOL);
    }
    if (key === 'Perf Strength Left' || key === 'Perf Strength Right') {
      return QD.pointBand(row[key], QD.PERF_STRENGTH_MIN, QD.PERF_STRENGTH_MAX);
    }
    stored = QD.histStoredBand(row, key);
    return stored;
  };

  QD.histRowBand = function (row) {
    var v = String((row && row['Pass/Fail']) || '').toUpperCase();
    if (v === 'PASS') return 'in';
    if (v === 'FAIL') return 'over';
    return '';
  };

  QD.pointExtremes = function (vals) {
    var i, v, mn = NaN, mx = NaN, imn = -1, imx = -1;
    for (i = 0; i < (vals || []).length; i++) {
      v = QD.num(vals[i]);
      if (!isFinite(v)) continue;
      if (!isFinite(mn) || v < mn) { mn = v; imn = i; }
      if (!isFinite(mx) || v > mx) { mx = v; imx = i; }
    }
    return { min: mn, max: mx, minIndex: imn, maxIndex: imx };
  };

  QD.drawCentration = function (canvas, values, lo, hi, theme) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width || 320, h = canvas.height || 320;
    var S = Math.min(w, h);
    var cx = w / 2, cy = h / 2;
    var yellowR = S * 0.20, greenR = S * 0.38, maxR = S * 0.46, boltR = S / 2 - 28;
    var i, n, ang, start, val, r, x, y, pts = values || [];
    var light = String(theme || '') === 'light';
    var bolt = 10, coords = [], step, c, started, first;
    function toR(v) {
      if (!isFinite(v) || !isFinite(lo) || !isFinite(hi) || hi === lo) return (yellowR + greenR) / 2;
      if (v < lo) return Math.max(S * 0.07, yellowR - Math.min(1, (lo - v) / Math.max(hi - lo, 1e-6)) * (yellowR * 0.75));
      if (v > hi) return Math.min(maxR, greenR + Math.min(1, (v - hi) / Math.max(hi - lo, 1e-6)) * (maxR - greenR));
      return yellowR + ((v - lo) / (hi - lo)) * (greenR - yellowR);
    }
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath(); ctx.arc(cx, cy, greenR, 0, Math.PI * 2);
    ctx.fillStyle = light ? 'rgba(22,163,74,0.42)' : 'rgba(34,197,94,0.38)'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, yellowR, 0, Math.PI * 2);
    ctx.fillStyle = light ? 'rgba(202,138,4,0.55)' : 'rgba(234,179,8,0.48)'; ctx.fill();
    ctx.strokeStyle = light ? '#86efac' : '#4ade80'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, greenR, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = light ? '#eab308' : '#facc15'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, yellowR, 0, Math.PI * 2); ctx.stroke();
    start = -Math.PI / 2;
    for (i = 0; i < 8; i++) {
      ang = start + i * (Math.PI * 2 / 8);
      x = cx + Math.cos(ang) * boltR;
      y = cy + Math.sin(ang) * boltR;
      ctx.fillStyle = '#0f4c5c';
      ctx.fillRect(x - bolt, y - bolt, bolt * 2, bolt * 2);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Segoe UI, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x, y);
    }
    n = pts.length || 13;
    step = (Math.PI * 2) / Math.max(n, 1);
    for (i = 0; i < n; i++) {
      val = QD.num(pts[i]);
      ang = start - (0.5 * step) - i * step;
      if (!isFinite(val)) { coords.push(null); continue; }
      r = toR(val);
      x = cx + Math.cos(ang) * r;
      y = cy + Math.sin(ang) * r;
      coords.push({ x: x, y: y, ang: ang, band: QD.pointBand(val, lo, hi), i: i });
    }
    ctx.beginPath();
    started = false; first = null;
    for (i = 0; i < coords.length; i++) {
      c = coords[i];
      if (!c) continue;
      if (!started) { ctx.moveTo(c.x, c.y); first = c; started = true; }
      else ctx.lineTo(c.x, c.y);
    }
    if (started && first) {
      ctx.lineTo(first.x, first.y);
      ctx.strokeStyle = light ? '#1d4ed8' : '#93c5fd';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (i = 0; i < coords.length; i++) {
      c = coords[i];
      if (!c) continue;
      ctx.fillStyle = c.band === 'over' ? '#ef4444' : (c.band === 'under' ? '#eab308' : '#22c55e');
      ctx.beginPath(); ctx.arc(c.x, c.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = light ? '#111827' : '#f8fafc';
      ctx.font = 'bold 10px Segoe UI, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('T' + (c.i + 1), c.x + Math.cos(c.ang) * 14, c.y + Math.sin(c.ang) * 14);
    }
  };

  QD.LEGACY_ALIASES = {
    'Work Order #': ['Work Order #', 'Work Order', 'Production #', 'Production'],
    'Bundle #': ['Bundle #', 'Bundle', 'Bundle Number', 'Roll #', 'Roll'],
    'Item #': ['Item #', 'Item', 'Item Number', 'Material'],
    'Item Desc': ['Item Desc', 'Item Description', 'ItemDescription', 'Description', 'Material Description'],
    'Date/Time': ['Date/Time', 'Time', 'Date Int', 'Date', 'Timestamp'],
    Line: ['Line', 'MonoorCoex', 'Mono or Coex', 'Line Name'],
    User: ['User', 'Operator', 'Initials'],
    Notes: ['Notes', 'Comments', 'Comment'],
    'Reason for Check': ['Reason for Check', 'Check Type', 'Type of Check', 'Reason', 'Check Reason'],
    'No Check Reason': ['No Check Reason', 'Additional Reason', 'Skip Reason', 'Why No Check'],
    'Pass/Fail': ['Pass/Fail', 'Result', 'Overall', 'PF', 'P/F'],
    MSPEC: ['MSPEC', 'MSPEC #', 'M-Spec Number', 'MSpec'],
    'Bundle #': ['Bundle #', 'Bundle', 'Bundle Number'],
    'Slit/Width': ['Slit/Width', 'Width', 'Slit Width'],
    Footage: ['Footage', 'Feet', 'FT'],
    'Cell Count MD': ['Cell Count MD', 'Cell MD', 'MD Cell'],
    'Cell Count CD': ['Cell Count CD', 'Cell CD', 'CD Cell'],
    'Thickness Average': ['Thickness Average', 'Avg', 'Average', 'Thk Avg'],
    'Thickness Range': ['Thickness Range', 'Range'],
    Density: ['Density', 'Dens'],
    Weight: ['Weight', 'Basis Weight', 'BW', 'Gram Weight', 'Weight (g)']
  };

  QD.pickLegacy = function (row, key) {
    var aliases = QD.LEGACY_ALIASES[key] || [key];
    var i, v;
    if (!row) return '';
    if (row[key] != null && trim(row[key]) !== '') return row[key];
    for (i = 0; i < aliases.length; i++) {
      v = row[aliases[i]];
      if (v != null && trim(v) !== '') return v;
    }
    return '';
  };

  QD.splitDieGraph2 = function (text) {
    var lines = String(text || '').replace(/\r/g, '').split('\n');
    var sections = {
      CURRENT: [], LOOKUP: [], TABLES4: [], TABLES1S3: [],
      TABLESBUBBLE: [], TABLESGARLAND: [], TABLESP1: [], TABLESRTS: []
    };
    var cur = null, i, m, name;
    for (i = 0; i < lines.length; i++) {
      m = String(lines[i] || '').trim().match(/^\[(CURRENT|LOOKUP|TABLES4|TABLES1S3|TABLESBUBBLE|TABLESGARLAND|TABLESP1|TABLESRTS|HISTORY)\]$/i);
      if (m) {
        name = m[1].toUpperCase();
        cur = name === 'HISTORY' ? 'TABLES4' : name;
        continue;
      }
      if (cur) sections[cur].push(lines[i]);
    }
    return sections;
  };

  QD.parseLegacyTsv = function (lines) {
    var rows = [];
    var headers = [];
    var i, j, parts, row, line, delim;
    if (!lines || !lines.length) return rows;
    line = String(lines[0] || '');
    delim = line.indexOf('\t') >= 0 ? '\t' : ',';
    headers = line.split(delim);
    for (i = 0; i < headers.length; i++) headers[i] = trim(headers[i]);
    for (i = 1; i < lines.length; i++) {
      if (!trim(lines[i])) continue;
      parts = String(lines[i]).split(delim);
      row = {};
      for (j = 0; j < headers.length; j++) row[headers[j]] = parts[j] != null ? parts[j] : '';
      rows.push(row);
    }
    return rows;
  };

  QD.normalizeLegacyCheckRow = function (row) {
    var out = {};
    var keys = [
      'Date/Time', 'Line', 'User', 'Item #', 'Item Desc', 'MSPEC',
      'Reason for Check', 'No Check Reason', 'Notes', 'Pass/Fail',
      'Bundle #', 'Slit/Width', 'Footage', 'Cell Count MD', 'Cell Count CD',
      'Thickness Average', 'Thickness Range', 'Density', 'Weight'
    ];
    var i, key, reason, pf;
    if (!row) return null;
    for (i = 0; i < keys.length; i++) {
      key = keys[i];
      out[key] = QD.pickLegacy(row, key);
    }
    for (i = 1; i <= 13; i++) {
      key = 'T' + i;
      if (row[key] != null && trim(row[key]) !== '') out[key] = row[key];
    }
    for (key in row) {
      if (!row.hasOwnProperty(key) || !key || key.charAt(0) === '_') continue;
      if (out[key] != null && trim(out[key]) !== '') continue;
      if (trim(row[key]) === '') continue;
      out[key] = row[key];
    }
    reason = trim(out['Reason for Check']).toUpperCase();
    pf = trim(out['Pass/Fail']).toUpperCase().replace(/[_-]+/g, ' ');
    if (QD.isCoveredNoMeasure(reason) || QD.isCoveredNoMeasure(pf)) {
      if (reason === 'LINE UP' || pf === 'LINE UP') {
        out['Reason for Check'] = 'LINE UP';
        out['Pass/Fail'] = 'LINE UP';
      } else {
        out['Reason for Check'] = 'NO CHECK';
        if (!trim(out['No Check Reason'])) {
          if (QD.isCoveredNoMeasure(pf) && pf !== 'NO CHECK') out['No Check Reason'] = pf;
          else if (reason && reason !== 'NO CHECK') out['No Check Reason'] = reason;
          else out['No Check Reason'] = 'LINE DOWN';
        }
        out['Pass/Fail'] = out['No Check Reason'] || 'LINE DOWN';
      }
    }
    out.__source = 'legacy';
    return out;
  };

  QD.legacySectionFile = function (section) {
    var name = String(section || '').toUpperCase();
    if (name === 'TABLES4' || name === 'HISTORY') return 's4';
    if (name === 'TABLES1S3') return 's1';
    if (name === 'TABLESBUBBLE') return 'coex';
    if (name === 'TABLESGARLAND') return 'gcoex';
    if (name === 'TABLESP1') return 'p1';
    if (name === 'TABLESRTS') return 'rts';
    return '';
  };

  QD.legacyRowFile = function (row, fallback) {
    var line = trim(QD.pickLegacy(row, 'Line')).toUpperCase().replace(/\s+/g, '');
    if (line === 'S4') return 's4';
    if (line === 'S1') return 's1';
    if (line === 'S3') return 's3';
    if (line === 'COEX' || line === 'VISALIACOEX') return 'coex';
    if (line === 'MONO' || line === 'VISALIAMONO') return 'mono';
    if (line === 'P1') return 'p1';
    if (line === 'RTS') return 'rts';
    if (line === 'G-COEX' || line === 'GARLANDCOEX' || line === 'GARLAND' || line === 'GCOEX') return 'gcoex';
    if (line === 'G-MONO' || line === 'GARLANDMONO' || line === 'GMONO') return 'gmono';
    return fallback || '';
  };

  QD.importLegacyChecks = function (text) {
    var raw = String(text || '');
    var out = { s4: [], s1: [], s3: [], coex: [], mono: [], p1: [], rts: [], gcoex: [], gmono: [] };
    var sections, name, rows, i, row, file, n = 0;
    if (/^DIEGRAPH2\b/i.test(trim(raw))) {
      sections = QD.splitDieGraph2(raw);
      for (name in sections) {
        if (!sections.hasOwnProperty(name) || name === 'CURRENT' || name === 'LOOKUP') continue;
        rows = QD.parseLegacyTsv(sections[name]);
        for (i = 0; i < rows.length; i++) {
          row = QD.normalizeLegacyCheckRow(rows[i]);
          if (!row || (!trim(row['Date/Time']) && !trim(row.Line) && !trim(row['Item #']))) continue;
          file = QD.legacyRowFile(row, QD.legacySectionFile(name));
          if (!file || !out[file]) continue;
          row.__lineFile = file;
          out[file].push(row);
          n += 1;
        }
      }
    } else {
      rows = QD.parseLegacyTsv(raw.replace(/\r/g, '').split('\n'));
      for (i = 0; i < rows.length; i++) {
        row = QD.normalizeLegacyCheckRow(rows[i]);
        if (!row) continue;
        file = QD.legacyRowFile(row, '');
        if (!file || !out[file]) continue;
        row.__lineFile = file;
        out[file].push(row);
        n += 1;
      }
    }
    out.count = n;
    return out;
  };

  QD.findUserRecord = function (users, name) {
    var want = trim(name).toUpperCase();
    var i, u;
    if (!want) return null;
    for (i = 0; i < (users || []).length; i++) {
      u = users[i];
      if (u && trim(u.name).toUpperCase() === want) return u;
    }
    return null;
  };

  QD.verifyPassword = function (record, password) {
    if (!record || !record.hash || !record.salt) return false;
    if (!trim(password)) return false;
    return record.hash === QD.hashPassword(password, record.salt);
  };

  QD.sapDiskScript = function (payload) {
    return 'window.QD_DISK_SAP=' + stringify(payload || {}) + ';\n';
  };

  QD.profileDiskScript = function (payload) {
    return 'window.QD_DISK_PROFILES=' + stringify(QD.normalizeProfiles(payload)) + ';\n';
  };

  QD.diskManifestScript = function (files) {
    return 'window.QD_DISK_MANIFEST=' + stringify({
      files: files || [],
      writtenAt: (new Date()).toISOString(),
      version: QD.VERSION
    }) + ';\n';
  };

  QD.GARLAND_BACKUP_DIR = 'C:\\Users\\csccoex1\\OneDrive - Pregis LLC\\Quality\\';
  QD.GARLAND_BACKUP_FILE = 'COEX data.csv';

  // <QD-CRYPT-BEGIN>
  QD.SEAL_MAGIC = 'QDSEAL1';
  QD.SEAL2_MAGIC = 'QDSEAL2';
  QD.PACK_MAGIC = 'QDPACK1';
  QD.CORE_FILE = 'qd.core';
  var _sealKeyCache = null;

  QD.sealKeyBytes = function () {
    var seed, out, i, x, a;
    if (_sealKeyCache) return _sealKeyCache;
    seed = [0x5A, 0x17, 0xC3, 0x8E, 0x41, 0xB9, 0x02, 0x6D, 0xE4, 0x33, 0x90, 0x7F, 0x1C, 0xA8, 0x55, 0xD2];
    out = [];
    x = 0xA5C37E19;
    for (i = 0; i < 48; i++) {
      x = (Math.imul ? Math.imul(x, 1664525) : (x * 1664525)) >>> 0;
      x = (x + 1013904223) >>> 0;
      a = seed[i % seed.length];
      out.push((x ^ a ^ ((i * 19 + 47) & 255) ^ (out.length ? out[i - 1] : 0x5C)) & 255);
    }
    _sealKeyCache = out;
    return out;
  };

  QD.utf8Bytes = function (s) {
    var out = [], i, c, c2, cp;
    s = String(s == null ? '' : s);
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) {
        out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      } else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
        c2 = s.charCodeAt(i + 1);
        if (c2 >= 0xDC00 && c2 <= 0xDFFF) {
          cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
          i += 1;
          out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
          continue;
        }
        out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      } else {
        out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
    }
    return out;
  };

  QD.utf8String = function (bytes) {
    var out = '', i = 0, c, c2, c3, c4, cp;
    bytes = bytes || [];
    while (i < bytes.length) {
      c = bytes[i++];
      if (c < 0x80) out += String.fromCharCode(c);
      else if (c >= 0xC0 && c < 0xE0 && i < bytes.length) {
        c2 = bytes[i++];
        out += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
      } else if (c >= 0xE0 && c < 0xF0 && i + 1 < bytes.length) {
        c2 = bytes[i++];
        c3 = bytes[i++];
        out += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
      } else if (c >= 0xF0 && i + 2 < bytes.length) {
        c2 = bytes[i++];
        c3 = bytes[i++];
        c4 = bytes[i++];
        cp = ((c & 7) << 18) | ((c2 & 63) << 12) | ((c3 & 63) << 6) | (c4 & 63);
        cp -= 0x10000;
        out += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 1023));
      }
    }
    return out;
  };

  QD.scrambleBytes = function (bytes) {
    var key = QD.sealKeyBytes();
    var s = [], i, j = 0, t, n, out = [], drop, k;
    for (i = 0; i < 256; i++) s[i] = i;
    for (i = 0; i < 256; i++) {
      j = (j + s[i] + key[i % key.length] + ((i * 13) & 255)) & 255;
      t = s[i]; s[i] = s[j]; s[j] = t;
    }
    n = bytes.length;
    for (i = 0; i < n; i++) {
      if ((i % 7) === 6 && i > 0) {
        t = bytes[i];
        bytes[i] = bytes[i - 1];
        bytes[i - 1] = t;
      }
    }
    i = 0; j = 0;
    drop = 768;
    for (k = 0; k < drop + n; k++) {
      i = (i + 1) & 255;
      j = (j + s[i]) & 255;
      t = s[i]; s[i] = s[j]; s[j] = t;
      if (k >= drop) out.push(bytes[k - drop] ^ s[(s[i] + s[j]) & 255] ^ key[k % key.length]);
    }
    return out;
  };

  QD.unscrambleBytes = function (bytes) {
    var key = QD.sealKeyBytes();
    var s = [], i, j = 0, t, n, out = [], drop, k;
    for (i = 0; i < 256; i++) s[i] = i;
    for (i = 0; i < 256; i++) {
      j = (j + s[i] + key[i % key.length] + ((i * 13) & 255)) & 255;
      t = s[i]; s[i] = s[j]; s[j] = t;
    }
    n = bytes.length;
    i = 0; j = 0;
    drop = 768;
    for (k = 0; k < drop + n; k++) {
      i = (i + 1) & 255;
      j = (j + s[i]) & 255;
      t = s[i]; s[i] = s[j]; s[j] = t;
      if (k >= drop) out.push(bytes[k - drop] ^ s[(s[i] + s[j]) & 255] ^ key[k % key.length]);
    }
    for (i = 0; i < n; i++) {
      if ((i % 7) === 6 && i > 0) {
        t = out[i];
        out[i] = out[i - 1];
        out[i - 1] = t;
      }
    }
    return out;
  };

  QD.SEAL_ABC = '#$%&()*+,-.0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_abcdefghijklmnopqrstuvwxyz{|}~';

  QD.encodeSeal = function (bytes) {
    var abc = QD.SEAL_ABC, out = '', i, n = bytes.length, v, a, b, c, d;
    for (i = 0; i < n; i += 4) {
      a = bytes[i] || 0;
      b = i + 1 < n ? bytes[i + 1] : 0;
      c = i + 2 < n ? bytes[i + 2] : 0;
      d = i + 3 < n ? bytes[i + 3] : 0;
      v = ((a * 16777216) + (b * 65536) + (c * 256) + d) >>> 0;
      out += abc.charAt(Math.floor(v / 52200625) % 85);
      out += abc.charAt(Math.floor(v / 614125) % 85);
      out += abc.charAt(Math.floor(v / 7225) % 85);
      out += abc.charAt(Math.floor(v / 85) % 85);
      out += abc.charAt(v % 85);
      if (((i / 4) % 9) === 8) out += '~';
    }
    return out + '.' + n;
  };

  QD.decodeSeal = function (text) {
    var abc = QD.SEAL_ABC, map = {}, i, raw, parts, n, out = [], pos, ch, v, block;
    for (i = 0; i < abc.length; i++) map[abc.charAt(i)] = i;
    text = String(text || '');
    parts = text.split('.');
    n = parseInt(parts[parts.length - 1], 10);
    if (!isFinite(n) || n < 0) return null;
    raw = parts.slice(0, parts.length - 1).join('.');
    block = '';
    for (i = 0; i < raw.length; i++) {
      ch = raw.charAt(i);
      if (ch === '~') continue;
      if (map[ch] == null) continue;
      block += ch;
      if (block.length === 5) {
        v = map[block.charAt(0)] * 52200625 + map[block.charAt(1)] * 614125 + map[block.charAt(2)] * 7225 + map[block.charAt(3)] * 85 + map[block.charAt(4)];
        out.push(Math.floor(v / 16777216) & 255, Math.floor(v / 65536) & 255, Math.floor(v / 256) & 255, v & 255);
        block = '';
      }
    }
    return out.slice(0, n);
  };

  QD.isSealed = function (text) {
    var s = String(text || '');
    return s.indexOf(QD.SEAL2_MAGIC) === 0 || s.indexOf(QD.SEAL_MAGIC) === 0;
  };

  QD.flushChars = function (buf, out) {
    if (buf.length) {
      out.push(String.fromCharCode.apply(String, buf));
      buf.length = 0;
    }
  };

  QD.seal2 = function (text) {
    var key = QD.sealKeyBytes();
    var s = String(text == null ? '' : text);
    var i, n = s.length, c, x, buf = [], out = [], klen = key.length;
    for (i = 0; i < n; i++) {
      c = s.charCodeAt(i);
      x = key[i % klen] ^ ((i * 13 + 47) & 255);
      if (c < 128) buf.push(0x100 + (c ^ x));
      else {
        buf.push(0x200, 0x100 + (((c >> 8) ^ x) & 255), 0x100 + ((c ^ x) & 255));
      }
      if (buf.length >= 256) QD.flushChars(buf, out);
    }
    QD.flushChars(buf, out);
    return QD.SEAL2_MAGIC + out.join('');
  };

  QD.unseal2 = function (text) {
    var key = QD.sealKeyBytes();
    var s = String(text || '').substring(QD.SEAL2_MAGIC.length);
    var i = 0, pos = 0, n = s.length, c, x, hi, lo, buf = [], out = [], klen = key.length;
    while (pos < n) {
      c = s.charCodeAt(pos++);
      x = key[i % klen] ^ ((i * 13 + 47) & 255);
      if (c === 0x200 && pos + 1 < n) {
        hi = (s.charCodeAt(pos++) - 0x100) ^ x;
        lo = (s.charCodeAt(pos++) - 0x100) ^ x;
        buf.push(((hi & 255) << 8) | (lo & 255));
      } else {
        buf.push((c - 0x100) ^ x);
      }
      i += 1;
      if (buf.length >= 256) QD.flushChars(buf, out);
    }
    QD.flushChars(buf, out);
    return out.join('');
  };

  QD.seal1 = function (text) {
    var bytes = QD.utf8Bytes(text);
    var mix = QD.scrambleBytes(bytes);
    return QD.SEAL_MAGIC + QD.encodeSeal(mix);
  };

  QD.unseal1 = function (text) {
    var s = String(text == null ? '' : text);
    if (s.indexOf(QD.SEAL_MAGIC) !== 0) return s;
    var bytes = QD.decodeSeal(s.substring(QD.SEAL_MAGIC.length));
    if (!bytes) return '';
    return QD.utf8String(QD.unscrambleBytes(bytes));
  };

  QD.seal = function (text) {
    return QD.seal2(text);
  };

  QD.unseal = function (text) {
    var s = String(text == null ? '' : text);
    if (s.indexOf(QD.SEAL2_MAGIC) === 0) return QD.unseal2(s);
    if (s.indexOf(QD.SEAL_MAGIC) === 0) return QD.unseal1(s);
    return s;
  };

  QD.pad10 = function (n) {
    var s = String(n);
    while (s.length < 10) s = '0' + s;
    return s;
  };

  QD.makePack = function (app, web) {
    app = String(app == null ? '' : app);
    web = String(web == null ? '' : web);
    return QD.PACK_MAGIC + '\nA' + QD.pad10(app.length) + '\n' + app + 'W' + QD.pad10(web.length) + '\n' + web;
  };

  QD.splitPack = function (raw) {
    var s = String(raw || '');
    var aMark, wMark, aLen, wLen, app, web;
    if (s.substring(0, QD.PACK_MAGIC.length) !== QD.PACK_MAGIC) return null;
    aMark = s.indexOf('\nA');
    if (aMark < 0) return null;
    aLen = parseInt(s.substring(aMark + 2, aMark + 12), 10);
    if (!isFinite(aLen) || aLen < 0) return null;
    app = s.substring(aMark + 13, aMark + 13 + aLen);
    wMark = aMark + 13 + aLen;
    if (s.charAt(wMark) !== 'W') return null;
    wLen = parseInt(s.substring(wMark + 1, wMark + 11), 10);
    if (!isFinite(wLen) || wLen < 0) return null;
    web = s.substring(wMark + 12, wMark + 12 + wLen);
    return { app: app, web: web };
  };
  // <QD-CRYPT-END>

  QD.csvCell = function (v) {
    var s = v == null ? '' : String(v);
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };

  QD.garlandBackupKey = function (row) {
    if (!row) return '';
    return [
      row['Date/Time'] || '',
      row['Item #'] || row.Item || '',
      row.User || '',
      row['Pass/Fail'] || '',
      row['Reason for Check'] || ''
    ].join('|');
  };

  QD.garlandBackupHeaders = function () {
    return [
      'Timestamp', 'Operator', 'Line', 'Item #', 'Item Desc', 'Reason for Check', 'Pass/Fail',
      'Slit Width', 'Web Width', 'Footage', 'Basis Weight', 'Perf Strength Left', 'Perf Strength Right',
      'Color', 'Delam Check', 'Production #', 'Roll #', 'Notes'
    ];
  };

  QD.garlandBackupCells = function (row) {
    if (!row) return [];
    return [
      row['Date/Time'], row.User, row.Line || 'G-COEX',
      row['Item #'] || row.Item, row['Item Desc'] || row['Item Description'],
      row['Reason for Check'], row['Pass/Fail'],
      row['Slit Width'] || row.Width, row['Web Width'], row.Footage,
      row['Basis Weight'] || row.Weight,
      row['Perf Strength Left'], row['Perf Strength Right'],
      row.Color, row['Delam Check'], row['Production #'], row['Roll #'], row.Notes
    ];
  };

  QD.garlandBackupLine = function (row) {
    var cells = QD.garlandBackupCells(row), i, out = [];
    for (i = 0; i < cells.length; i++) out.push(QD.csvCell(cells[i]));
    return out.join(',');
  };

  QD.parseBackupKeys = function (csv) {
    var seen = {}, lines, i, parts;
    lines = String(csv || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    for (i = 1; i < lines.length; i++) {
      if (!trim(lines[i])) continue;
      parts = lines[i].split(',');
      if (parts.length) seen[trim(parts[0]) + '|' + trim(parts[3] || '') + '|' + trim(parts[1] || '')] = 1;
    }
    return seen;
  };

  QD.garlandBackupMerge = function (existingCsv, rows) {
    var headers = QD.garlandBackupHeaders().join(',');
    var have = {}, lines, i, row, key, added = 0, out = [];
    lines = String(existingCsv || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (!lines.length || !trim(lines[0])) out.push(headers);
    else {
      out.push(lines[0]);
      for (i = 1; i < lines.length; i++) {
        if (!trim(lines[i])) continue;
        out.push(lines[i]);
        have[trim(lines[i])] = 1;
      }
    }
    for (i = 0; i < (rows || []).length; i++) {
      row = rows[i];
      if (!row) continue;
      key = QD.garlandBackupLine(row);
      if (have[key]) continue;
      out.push(key);
      have[key] = 1;
      added += 1;
    }
    return { csv: out.join('\r\n') + '\r\n', added: added };
  };

  function stringify(v) {
    if (typeof JSON !== 'undefined' && JSON.stringify) return JSON.stringify(v);
    throw new Error('JSON.stringify is required');
  }

  global.QD = QD;
  if (typeof module !== 'undefined' && module.exports) module.exports = QD;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));