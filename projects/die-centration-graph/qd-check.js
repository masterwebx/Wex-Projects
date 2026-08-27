/* Quality Desk check logic — ES3/IE11. Loaded by quality-desk.hta and Node tests. */
(function (global) {
  var QD = global.QD || {};

  QD.VERSION = '1.7.43';
  QD.DISK_DIR = 'results';
  QD.LINE_FILES = ['s4', 's1', 's3', 'coex', 'mono', 'p1', 'rts'];
  QD.DISK_FILES = ['lookup'].concat(QD.LINE_FILES);

  QD.LINES = [
    { id: 'S4', file: 's4', plant: 'foam', form: 's4', reasons: 'foam' },
    { id: 'S1', file: 's1', plant: 'foam', form: 's1s3', reasons: 'foam' },
    { id: 'S3', file: 's3', plant: 'foam', form: 's1s3', reasons: 'foam' },
    { id: 'COEX', file: 'coex', plant: 'bubble', form: 'bubble', reasons: 'bubble' },
    { id: 'MONO', file: 'mono', plant: 'bubble', form: 'bubble', reasons: 'bubble' },
    { id: 'P1', file: 'p1', plant: 'p1', form: 'p1', reasons: 'foam' },
    { id: 'RTS', file: 'rts', plant: 'rts', form: 'rts', reasons: 'foam' }
  ];

  QD.REASONS = {
    foam: ['HOURLY', 'NEW ORDER', 'RETEST', 'DIE CHANGE', 'STARTUP', 'EQUIPMENT FAIL', 'NO ORDERS', 'NO CHECK'],
    bubble: ['HOURLY', 'NEW ORDER', 'RETEST', 'CYLINDER CHANGE', 'STARTUP', 'EQUIPMENT FAIL', 'NO ORDERS', 'NO CHECK']
  };

  QD.SKIP_REASONS = {
    foam: { STARTUP: 1, 'EQUIPMENT FAIL': 1, 'NO ORDERS': 1, 'NO CHECK': 1, 'DIE CHANGE': 1 },
    bubble: { STARTUP: 1, 'EQUIPMENT FAIL': 1, 'NO ORDERS': 1, 'NO CHECK': 1, 'CYLINDER CHANGE': 1 },
    s4: { STARTUP: 1, 'EQUIPMENT FAIL': 1, 'NO ORDERS': 1, 'NO CHECK': 1 },
    p1: { STARTUP: 1, 'EQUIPMENT FAIL': 1, 'NO ORDERS': 1, 'NO CHECK': 1 }
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

  QD.lineInfo = function (id) {
    var key = String(id || '').toUpperCase().replace(/\s+/g, '');
    var i;
    for (i = 0; i < QD.LINES.length; i++) {
      if (QD.LINES[i].id === key) return QD.LINES[i];
    }
    return null;
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
    var info = QD.lineInfo(lineId);
    var table = (info && QD.SKIP_REASONS[info.form]) || QD.SKIP_REASONS.foam;
    if (info && info.form === 's1s3') table = QD.SKIP_REASONS.foam;
    if (info && info.form === 'bubble') table = QD.SKIP_REASONS.bubble;
    if (info && info.id === 'S4') table = QD.SKIP_REASONS.s4;
    return !!table[String(reason || '').toUpperCase()];
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
      key = QD.canonItem(it.item || it['Item #']);
      if (key === want) return it;
    }
    return null;
  };

  QD.searchItems = function (items, q, limit) {
    var needle = trim(q).toLowerCase();
    var out = [];
    var i, it, item, desc;
    if (!items) return out;
    for (i = 0; i < items.length; i++) {
      it = items[i];
      item = String(it.item || it['Item #'] || '');
      desc = String(it.description || it.Description || '');
      if (!needle || item.toLowerCase().indexOf(needle) >= 0 || desc.toLowerCase().indexOf(needle) >= 0) {
        out.push(it);
        if (out.length >= (limit || 20)) break;
      }
    }
    return out;
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

  QD.matchBubbleWeight = function (line, bubbleType) {
    var table = QD.BUBBLE_WEIGHT[String(line || '').toUpperCase()] || {};
    var raw = trim(bubbleType).toUpperCase();
    var key, best = '';
    if (table[raw]) return { key: raw, min: table[raw][0], target: table[raw][1], max: table[raw][2] };
    for (key in table) {
      if (!table.hasOwnProperty(key)) continue;
      if (raw.indexOf(key) === 0 && key.length > best.length) best = key;
    }
    if (best) return { key: best, min: table[best][0], target: table[best][1], max: table[best][2] };
    return null;
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
      setIf(row, 'Item #', item);
      setIf(row, 'Item Description', desc);
      setIf(row, 'Length', input.length);
      setIf(row, 'Width', input.width);
      setIf(row, 'Cell Count MD', input.cellMd);
      setIf(row, 'Cell Count CD', input.cellCd);
      setIf(row, 'Plank Weight', input.weight);
      setIf(row, 'Volume', input.volume);
      setIf(row, 'Density', input.density);
      setIf(row, 'P1', input.head);
      setIf(row, 'P2', input.end1);
      setIf(row, 'P3', input.end2);
      setIf(row, 'P4', input.tail);
      setIf(row, 'Average Single Shot', input.avgSingle);
      setIf(row, 'Width Pass', input.widthPf);
      setIf(row, 'Length Pass', input.lengthPf);
      setIf(row, 'Density Pass/Fail', input.densityPf);
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
    users: ['UserList.csv', 'User List.csv']
  };

  QD.ITEM_FIELDS = [
    { key: 'item', label: 'Item #', required: true },
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
      } else out.push(it);
    }
    return out;
  };

  function stringify(v) {
    if (typeof JSON !== 'undefined' && JSON.stringify) return JSON.stringify(v);
    throw new Error('JSON.stringify is required');
  }

  global.QD = QD;
  if (typeof module !== 'undefined' && module.exports) module.exports = QD;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
