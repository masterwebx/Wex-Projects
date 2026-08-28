/* Quality Desk check logic — ES3/IE11. Loaded by quality-desk.hta and Node tests. */
(function (global) {
  var QD = global.QD || {};

  QD.VERSION = '1.7.53';
  QD.DISK_DIR = 'results';
  QD.LINE_FILES = ['s4', 's1', 's3', 'coex', 'mono', 'p1', 'rts', 'gcoex', 'gmono'];
  QD.DISK_FILES = ['lookup'].concat(QD.LINE_FILES);
  QD.IDLE_MS = 60 * 60 * 1000;
  QD.CHECK_IDLE_MS = 15 * 60 * 1000;
  QD.USERS_FILE = 'users.dat';
  QD.SEED_USER = 'GWEXLER';
  QD.SITES = ['VISALIA', 'GARLAND'];
  QD.CHECK_TYPES = ['HOURLY', 'RETEST', 'NO CHECK'];
  QD.NO_CHECK_REASONS = ['EQUIPMENT FAILURE', 'NO ORDERS', 'LINE DOWN', 'PREVENTATIVE MAINTENANCE'];
  QD.DOC_TYPES = ['Work Instruction', 'QAN', 'Construction Card'];
  QD.DOC_REVIEW_MS = 90 * 24 * 60 * 60 * 1000;
  QD.STARTUP_ITEMS = [
    { id: 'labelsOut', text: 'Were old labels thrown away?' },
    { id: 'poVerify', text: 'Do you have the Production Order and verify everything is correct?' },
    { id: 'labelsMatch', text: 'Verify new labels match Production Order' }
  ];
  QD.STARTUP_PERF_ITEM = { id: 'perfTear', text: 'Perf teared cleanly and easily' };
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
    { id: 'S4', file: 's4', site: 'VISALIA', plant: 'foam', form: 's4', reasons: 'foam', label: 'S4' },
    { id: 'S1', file: 's1', site: 'VISALIA', plant: 'foam', form: 's1s3', reasons: 'foam', label: 'S1' },
    { id: 'S3', file: 's3', site: 'VISALIA', plant: 'foam', form: 's1s3', reasons: 'foam', label: 'S3' },
    { id: 'COEX', file: 'coex', site: 'VISALIA', plant: 'bubble', form: 'bubble', reasons: 'bubble', label: 'COEX' },
    { id: 'MONO', file: 'mono', site: 'VISALIA', plant: 'bubble', form: 'bubble', reasons: 'bubble', label: 'MONO' },
    { id: 'P1', file: 'p1', site: 'VISALIA', plant: 'p1', form: 'p1', reasons: 'foam', label: 'P1' },
    { id: 'RTS', file: 'rts', site: 'VISALIA', plant: 'rts', form: 'rts', reasons: 'foam', label: 'RTS' },
    { id: 'G-COEX', file: 'gcoex', site: 'GARLAND', plant: 'bubble', form: 'bubble', reasons: 'bubble', label: 'COEX' }
  ];

  QD.REASONS = {
    foam: ['HOURLY', 'RETEST', 'NO CHECK'],
    bubble: ['HOURLY', 'RETEST', 'NO CHECK']
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
    return x.getTime() / 86400000 + 25569;
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

  QD.docMatchesUserLines = function (docLine, lineIds) {
    var parts = QD.parseDocLines(docLine);
    var i, j, p, want;
    if (parts[0] === '*') return true;
    for (i = 0; i < (lineIds || []).length; i++) {
      want = String(lineIds[i] || '').toUpperCase();
      for (j = 0; j < parts.length; j++) {
        p = String(parts[j]).toUpperCase();
        if (p === want) return true;
        if (p === String(QD.lineLabel(lineIds[i]) || '').toUpperCase()) return true;
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
    for (i = 0; i < QD.CHECK_LINK_FIELDS.length; i++) {
      cf = QD.CHECK_LINK_FIELDS[i];
      if (allowed[cf.id]) out.push(cf);
    }
    return out;
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
    var key, best = '';
    if (!raw) return null;
    if (table[raw]) return { key: raw, min: table[raw][0], target: table[raw][1], max: table[raw][2] };
    for (key in table) {
      if (!table.hasOwnProperty(key)) continue;
      if (raw.indexOf(key) === 0 && key.length > best.length) best = key;
    }
    if (best) return { key: best, min: table[best][0], target: table[best][1], max: table[best][2] };
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
    return {
      coex: QD.findBubbleSpec(specs, 'COEX', bubbleType) || QD.matchBubbleWeight('COEX', bubbleType),
      mono: QD.findBubbleSpec(specs, 'MONO', bubbleType) || QD.matchBubbleWeight('MONO', bubbleType)
    };
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
      setIf(row, 'Item Description', desc);
      setIf(row, 'Product Verification', input.productVf);
      setIf(row, 'COH/ADH Verification', input.cohAdh);
      setIf(row, 'Post-Visual Inspection', input.postVisual);
      setIf(row, '# Slits', input.slits);
      setIf(row, 'Width', input.width);
      setIf(row, 'Footage', input.footage);
      setIf(row, 'Perf Width', input.perfWidth);
      setIf(row, 'Perf Tester Results', input.perfTester);
      setIf(row, 'Weight', input.weight);
      setIf(row, 'Density', input.density);
      setIf(row, 'Diameter (ULINE only)', input.diameter);
      setIf(row, 'Diameter Pass/Fail', input.diameterPf);
      setIf(row, 'Dead Cell Pre', input.deadPre);
      setIf(row, '# Air Transfers Pre', input.airPre);
      setIf(row, 'Dead Cell Post', input.deadPost);
      setIf(row, '# Air Transfers Post', input.airPost);
      setIf(row, 'Width Pass', input.widthPf);
      setIf(row, 'Footage Pass', input.footagePf);
      setIf(row, 'Perf Width Pass', input.perfWidthPf);
      setIf(row, 'Per Tester Pass', input.perfTesterPf);
      setIf(row, 'Weight Pass', input.weightPf);
      setIf(row, 'Pre Pass', input.prePf);
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

  QD.CSV_FILES = {
    items: ['MasterDatabase.csv', 'Master Database.csv'],
    mspecs: ['MasterSheet.csv', 'Master Sheet.csv'],
    users: ['UserList.csv', 'User List.csv'],
    rts: ['RtsSpecs.csv', 'RTS Specs.csv', 'Rts Specs.csv'],
    p1: ['P1Specs.csv', 'P1 Specs.csv'],
    bubble: ['BubbleSpecs.csv', 'Bubble Specs.csv']
  };

  QD.ITEM_TYPES = {
    BUBBLE: { id: 'BUBBLE', label: 'Bubble', lines: 'COEX and MONO', fields: ['description', 'width', 'slits', 'footage', 'perf', 'bubbleType'] },
    FOAM: { id: 'FOAM', label: 'Foam', lines: 'S1, S3, and S4', fields: ['description', 'width', 'footage', 'perf', 'mspec'] },
    LAM: { id: 'LAM', label: 'Lam', lines: 'RTS', fields: ['description', 'length', 'width', 'parent', 'mspec', 'thickness'] },
    PLANK: { id: 'PLANK', label: 'Plank', lines: 'P1', fields: ['description', 'length', 'width', 'density', 'shots', 'soft'] }
  };

  QD.ITEM_FIELDS = [
    { key: 'item', label: 'Item #', required: true },
    { key: 'type', label: 'Type' },
    { key: 'description', label: 'Description' },
    { key: 'length', label: 'Length' },
    { key: 'width', label: 'Width' },
    { key: 'slits', label: '# Slits' },
    { key: 'footage', label: 'Footage' },
    { key: 'perf', label: 'Perf' },
    { key: 'bubbleType', label: 'Bubble Type' },
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
    if (trim(it.bubbleType) || trim(it.slits)) return 'BUBBLE';
    if (trim(it.shots) || (it.soft != null && String(it.soft) !== '')) return 'PLANK';
    if (trim(it.parent) || (trim(it.thickness) && trim(it.length) && !trim(it.footage))) return 'LAM';
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
      { key: 'footage', label: 'Footage' },
      { key: 'cellMd', label: 'Cell Count MD' },
      { key: 'cellCd', label: 'Cell Count CD' },
      { key: 'weight', label: 'Weight (g)' },
      { key: 'points', label: 'Thickness points', kind: 'points', count: 13 }
    ],
    s1s3: [
      { key: 'bundle', label: 'Bundle #' },
      { key: 'width', label: 'Width' },
      { key: 'footage', label: 'Footage' },
      { key: 'perf', label: 'Perf', when: 'perf' },
      { key: 'cellMd', label: 'Cell Count MD' },
      { key: 'cellCd', label: 'Cell Count CD' },
      { key: 'weight', label: 'Weight' },
      { key: 'points', label: 'Thickness points', kind: 'points', count: 13 },
      { key: 'winderTension', label: 'Winder tension', when: 's1' },
      { key: 'bumperPressure', label: 'Bumper roll pressure', when: 's1' },
      { key: 'diameter', label: 'Diameter (ULINE)', when: 'uline' }
    ],
    bubble: [
      { key: 'cohAdh', label: 'COH/ADH Verification', when: 'cohAdh' },
      { key: 'deadPre', label: 'Dead Cell Pre' },
      { key: 'deadPost', label: 'Dead Cell Post' },
      { key: 'postVisual', label: 'Post-Visual Inspection', when: 'deadDone' },
      { key: 'width', label: 'Width' },
      { key: 'footage', label: 'Footage' },
      { key: 'perfWidth', label: 'Perf Width', when: 'perf' },
      { key: 'perfTester', label: 'Perf Tester Results', when: 'perf' },
      { key: 'weight', label: 'Weight' },
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
    { id: 'width', label: 'Width' },
    { id: 'footage', label: 'Footage' },
    { id: 'weight', label: 'Weight' },
    { id: 'cellMd', label: 'Cell Count MD' },
    { id: 'cellCd', label: 'Cell Count CD' },
    { id: 'perf', label: 'Perf' },
    { id: 'productVf', label: 'Product Verification' },
    { id: 'cohAdh', label: 'COH/ADH Verification' },
    { id: 'postVisual', label: 'Post-Visual Inspection' },
    { id: 'deadPre', label: 'Dead Cell Pre' },
    { id: 'deadPost', label: 'Dead Cell Post' },
    { id: 'perfWidth', label: 'Perf Width' },
    { id: 'perfTester', label: 'Perf Tester Results' },
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

  QD.fieldApplies = function (f, ctx) {
    if (!f || !f.when) return true;
    var w = String(f.when);
    if (w === 'perf') return !!ctx.hasPerf;
    if (w === 'uline') return !!ctx.isUline;
    if (w === 'cohAdh') return !!ctx.hasCohAdh;
    if (w === 's1') return ctx.lineId === 'S1';
    if (w === 'deadDone') return !!ctx.deadDone;
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
    var deadDone = QD.trim(src.deadPre) !== '' && QD.trim(src.deadPost) !== '';
    var ctx = { lineId: lineId, hasPerf: hasPerf, isUline: isUline, hasCohAdh: hasCohAdh, deadDone: deadDone };
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
    var i, row, key, bt, best = null, bestLen = 0;
    if (!raw || !specs) return null;
    for (i = 0; i < specs.length; i++) {
      row = specs[i];
      if (fam && String(row.family || '').toUpperCase() !== fam) continue;
      key = trim(row.abbreviation).toUpperCase();
      bt = trim(row.bubbleType || '').toUpperCase();
      if (key === raw || bt === full || bt === raw) return row;
      if (raw.indexOf(key) === 0 && key.length > bestLen) { best = row; bestLen = key.length; }
      if (full.indexOf(key) === 0 && key.length > bestLen) { best = row; bestLen = key.length; }
    }
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

  QD.formatClock = function (serial) {
    var d = QD.dateFromSerial(serial);
    var h = d.getHours(), m = d.getMinutes();
    var ap = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12;
    if (!h12) h12 = 12;
    return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
  };

  QD.shiftAt = function (when) {
    var h = (when instanceof Date ? when : QD.dateFromSerial(when)).getHours();
    if (h >= 7 && h < 15) return '1';
    if (h >= 15 && h < 23) return '2';
    return '3';
  };

  QD.rowItem = function (row) {
    if (!row) return '';
    return QD.canonItem(row['Item #'] || row.Item || row.item);
  };

  QD.needsStartup = function (lastRow, itemNo, when) {
    if (!lastRow) return true;
    if (QD.canonItem(itemNo) !== QD.rowItem(lastRow)) return true;
    return QD.shiftAt(lastRow['Date/Time']) !== QD.shiftAt(when || new Date());
  };

  QD.needsLineUp = function (lastRow) {
    if (!lastRow) return false;
    return String(lastRow['Reason for Check'] || '').toUpperCase() === 'NO CHECK';
  };

  QD.lastCheckLabel = function (row) {
    if (!row) return 'No checks yet';
    var d = QD.dateFromSerial(row['Date/Time']);
    var now = new Date();
    var sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    var when;
    if (sameDay) when = QD.formatClock(row['Date/Time']);
    else {
      var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      when = days[d.getDay()] + ' ' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + QD.formatClock(row['Date/Time']);
    }
    var reason = String(row['Reason for Check'] || '').toUpperCase();
    var extra = trim(row['No Check Reason'] || '');
    var pf = trim(row['Pass/Fail'] || '');
    if (reason === 'NO CHECK') return 'last check ' + (extra || 'NO CHECK') + ' @ ' + when;
    if (reason === 'LINE UP') return 'last check LINE UP @ ' + when;
    return 'last check ' + (pf || reason || '—') + ' @ ' + when;
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
    var out = [], i, d, a, j, items, item = QD.canonItem(itemNo), line = QD.lineLabel(lineId);
    if (!item) return out;
    for (i = 0; i < (docs || []).length; i++) {
      d = docs[i];
      if (!QD.docIsConstructionCard(d)) continue;
      if (d.line && d.line !== '*' && String(d.line).toUpperCase() !== 'ALL'
          && String(d.line).toUpperCase() !== String(lineId || '').toUpperCase()
          && String(d.line).toUpperCase() !== String(line || '').toUpperCase()) continue;
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

  QD.startupComplete = function (answers, includePerf) {
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
    if (!isFinite(n) || !isFinite(lo) || !isFinite(hi)) return '';
    if (n < lo) return 'under';
    if (n > hi) return 'over';
    return 'in';
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
    var w = canvas.width || 260, h = canvas.height || 260;
    var S = Math.min(w, h);
    var cx = w / 2, cy = h / 2;
    var yellowR = S * 0.18, greenR = S * 0.36, maxR = S * 0.45, boltR = S / 2 - 22;
    var i, n, ang, start, val, r, x, y, band, pts = values || [];
    var light = String(theme || '') === 'light';
    var bolt = 9;
    function toR(v) {
      if (!isFinite(v) || !isFinite(lo) || !isFinite(hi) || hi === lo) return (yellowR + greenR) / 2;
      if (v < lo) return Math.max(S * 0.06, yellowR - Math.min(1, (lo - v) / Math.max(hi - lo, 1e-6)) * (yellowR * 0.7));
      if (v > hi) return Math.min(maxR, greenR + Math.min(1, (v - hi) / Math.max(hi - lo, 1e-6)) * (maxR - greenR));
      return yellowR + ((v - lo) / (hi - lo)) * (greenR - yellowR);
    }
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath(); ctx.arc(cx, cy, greenR, 0, Math.PI * 2); ctx.fillStyle = light ? 'rgba(34,197,94,0.18)' : 'rgba(34,197,94,0.12)'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, yellowR, 0, Math.PI * 2); ctx.fillStyle = light ? 'rgba(234,179,8,0.22)' : 'rgba(234,179,8,0.16)'; ctx.fill();
    ctx.strokeStyle = light ? '#d1d5db' : '#334155'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, greenR, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, yellowR, 0, Math.PI * 2); ctx.stroke();
    start = Math.PI / 2;
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
    n = pts.length;
    for (i = 0; i < n; i++) {
      val = QD.num(pts[i]);
      if (!isFinite(val)) continue;
      ang = -Math.PI / 2 + (i + 0.5) * (Math.PI * 2 / Math.max(n, 1));
      r = toR(val);
      x = cx + Math.cos(ang) * r;
      y = cy + Math.sin(ang) * r;
      band = QD.pointBand(val, lo, hi);
      ctx.fillStyle = band === 'over' ? '#ef4444' : (band === 'under' ? '#eab308' : '#22c55e');
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    }
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

  QD.diskManifestScript = function (files) {
    return 'window.QD_DISK_MANIFEST=' + stringify({
      files: files || [],
      writtenAt: (new Date()).toISOString(),
      version: QD.VERSION
    }) + ';\n';
  };

  function stringify(v) {
    if (typeof JSON !== 'undefined' && JSON.stringify) return JSON.stringify(v);
    throw new Error('JSON.stringify is required');
  }

  global.QD = QD;
  if (typeof module !== 'undefined' && module.exports) module.exports = QD;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));