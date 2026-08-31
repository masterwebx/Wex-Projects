/**
 * Build release/ floor package.
 *
 * QualityDesk.hta is a small booter. The packed app + History HTML live in
 * sealed qd.core (custom alphabet, not base64). Runtime data (users.dat,
 * results/*.js) is sealed on disk when the booter sets QD_RELEASE_CRYPT.
 *
 * Scripts inside qd.core are NOT eval-packed. mshta rejects a single eval
 * larger than ~100KB, and splitting qd-check.js (one IIFE) mid-function
 * yields "Expected '}'" then "'QD' is undefined". The seal hides source;
 * after decrypt, mshta parses normal script tags (same as the dev HTA).
 *
 * Microsoft screnc.exe / JScript.Encode does not run under modern mshta.
 *
 * Usage: node tools/build-release.mjs
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'release');
const MAX_CHUNK = 90000;
const require = createRequire(import.meta.url);

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function write(rel, text) {
  const p = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text.replace(/\n/g, '\r\n'), 'utf8');
}

function copyFile(fromRel, toRel) {
  const from = path.join(root, fromRel);
  const to = path.join(outDir, toRel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function asciiFold(s) {
  return String(s)
    .replace(/\uFEFF/g, '')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/\u00B7/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?');
}

function packScript(jsSource) {
  const plain = asciiFold(jsSource);
  const b64 = Buffer.from(plain, 'utf8').toString('base64');
  const chunks = [];
  for (let i = 0; i < b64.length; i += 120) chunks.push(JSON.stringify(b64.slice(i, i + 120)));
  return (
    '!function(){var a=' +
    chunks.join('+') +
    ',s=atob(a),o="";for(var i=0;i<s.length;i++)o+=String.fromCharCode(s.charCodeAt(i));(0,eval)(o)}();'
  );
}

/**
 * Split source into chunks under maxLen, preferring breaks before
 * top-level `function` declarations.
 */
function splitScript(src, maxLen) {
  const text = asciiFold(src);
  if (text.length <= maxLen) return [text];

  const breaks = [0];
  const re = /\n[ \t]*function\s+/g;
  let m;
  while ((m = re.exec(text))) breaks.push(m.index + 1);
  breaks.push(text.length);

  const out = [];
  let start = 0;
  let i = 1;
  while (start < text.length) {
    let end = start;
    while (i < breaks.length && breaks[i] - start <= maxLen) {
      end = breaks[i];
      i += 1;
    }
    if (end <= start) {
      end = Math.min(start + maxLen, text.length);
      const nl = text.lastIndexOf('\n', end);
      if (nl > start + maxLen * 0.5) end = nl + 1;
      while (i < breaks.length && breaks[i] <= end) i += 1;
    }
    out.push(text.slice(start, end));
    start = end;
  }
  return out.filter((c) => c.trim().length);
}

function packHtmlScripts(html) {
  let blocks = 0;
  let chunks = 0;
  const out = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, body) => {
    if (/src\s*=/i.test(attrs)) return full;
    const trimmed = body.replace(/^\uFEFF/, '');
    if (!trimmed.trim()) return full;
    blocks += 1;
    const parts = splitScript(trimmed, MAX_CHUNK);
    chunks += parts.length;
    return parts.map((p) => `<script language="JScript">\n${packScript(p)}\n</script>`).join('\n');
  });
  return { html: out, blocks, chunks };
}

function extractCrypt(checkJs) {
  const beginTag = '// <QD-CRYPT-BEGIN>';
  const endTag = '// <QD-CRYPT-END>';
  const begin = checkJs.indexOf(beginTag);
  const end = checkJs.indexOf(endTag);
  if (begin < 0 || end < 0 || end <= begin) throw new Error('QD-CRYPT markers missing from qd-check.js');
  return checkJs.slice(begin + beginTag.length, end).trim();
}

function booterSource(cryptJs) {
  return [
    'var QD = {};',
    cryptJs,
    '',
    'function bootFolder() {',
    '    var fso = new ActiveXObject("Scripting.FileSystemObject");',
    '    var href = String(location.href || "");',
    '    var path = String(location.pathname || "");',
    '    var raw = href;',
    '    if (href.toLowerCase().indexOf("file:") === 0) raw = href.replace(/^file:\\/\\//i, "");',
    '    else if (path) raw = path;',
    '    raw = raw.replace(/^\\/+/, "");',
    '    try { raw = decodeURIComponent(raw); } catch (eDec) {}',
    '    raw = raw.replace(/\\//g, "\\\\");',
    '    if (raw.toLowerCase().indexOf("localhost\\\\") === 0) raw = raw.substring(10);',
    '    return fso.GetParentFolderName(raw);',
    '}',
    '',
    'function bootRead(path) {',
    '    var stream = new ActiveXObject("ADODB.Stream");',
    '    var text;',
    '    stream.Type = 2;',
    '    stream.Charset = "utf-8";',
    '    stream.Open();',
    '    stream.LoadFromFile(path);',
    '    text = stream.ReadText();',
    '    stream.Close();',
    '    return text;',
    '}',
    '',
    'function stripHtaApp(html) {',
    '    var s = String(html || "");',
    '    s = s.replace(/<HTA:APPLICATION[\\s\\S]*?\\/>/i, "");',
    '    s = s.replace(/<HTA:APPLICATION[\\s\\S]*?<\\/HTA:APPLICATION>/i, "");',
    '    return s;',
    '}',
    '',
    'function injectReleaseFlag(html) {',
    '    var tag = "<script language=\\"JScript\\">window.QD_RELEASE_CRYPT=1;<\\/script>";',
    '    var s = String(html || "");',
    '    var i = s.search(/<head\\b[^>]*>/i);',
    '    var end;',
    '    if (i >= 0) {',
    '        end = s.indexOf(">", i);',
    '        return s.substring(0, end + 1) + tag + s.substring(end + 1);',
    '    }',
    '    return tag + s;',
    '}',
    '',
    'function bootFail(msg) {',
    '    var el = document.getElementById("bootErr");',
    '    if (el) el.innerText = String(msg || "Could not open sealed desk.");',
    '}',
    '',
    'function bootApp() {',
    '    try {',
    '        var fso = new ActiveXObject("Scripting.FileSystemObject");',
    '        var path = fso.BuildPath(bootFolder(), QD.CORE_FILE);',
    '        var raw, pack, html;',
    '        if (!fso.FileExists(path)) {',
    '            bootFail("Missing " + QD.CORE_FILE + " next to this HTA.");',
    '            return;',
    '        }',
    '        raw = bootRead(path);',
    '        if (QD.isSealed(raw)) raw = QD.unseal(raw);',
    '        pack = QD.splitPack(raw);',
    '        if (!pack || !pack.app) {',
    '            bootFail("qd.core is damaged or not a Quality Desk pack.");',
    '            return;',
    '        }',
    '        html = injectReleaseFlag(stripHtaApp(pack.app));',
    '        document.open();',
    '        document.write(html);',
    '        document.close();',
    '    } catch (eBoot) {',
    '        bootFail(eBoot && eBoot.message ? eBoot.message : eBoot);',
    '    }',
    '}',
    '',
    'window.onload = bootApp;'
  ].join('\n');
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const checkJs = read('qd-check.js');
  const cryptJs = extractCrypt(checkJs);
  const QD = require(path.join(root, 'qd-check.js'));

  let hta = asciiFold(read('quality-desk.hta').replace(/\r\n/g, '\n'));
  hta = hta.replace(
    /<script\b[^>]*\bsrc\s*=\s*["']qd-check\.js["'][^>]*>\s*<\/script>/i,
    () => `<script language="JScript">\n${asciiFold(checkJs)}\n</script>`
  );
  if (!/QD\.VERSION/.test(hta) || !/function doLogin/.test(hta)) {
    throw new Error('Sealed HTA is missing QD or doLogin — inline failed');
  }
  if (/\(0,eval\)\(o\)\}/.test(hta)) {
    throw new Error('Sealed HTA must not eval-pack scripts (mshta 100KB eval limit)');
  }

  if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('index.html missing');
  if (!fs.existsSync(path.join(root, 'vendor', 'chart.umd.min.js'))) {
    throw new Error('vendor/chart.umd.min.js missing');
  }
  const web = read('index.html').replace(/\r\n/g, '\n').replace(/\uFEFF/g, '');
  if (/\/\?\/[gimuy]*/.test(web)) {
    throw new Error('index.html would throw Invalid regular expression /?/g in History');
  }

  const pack = QD.makePack(hta, web);
  const sealed = QD.seal(pack);
  if (!QD.isSealed(sealed)) throw new Error('seal() did not mark qd.core');
  const round = QD.splitPack(QD.unseal(sealed));
  if (!round || round.app !== hta || round.web !== web) {
    throw new Error('qd.core pack round-trip failed');
  }
  fs.writeFileSync(path.join(outDir, QD.CORE_FILE), sealed, 'utf8');

  const bootJs = booterSource(cryptJs);
  if (/\(\s*\)\s*=>/.test(bootJs)) throw new Error('Booter source has arrow functions');
  const bootHtml = [
    '<html>',
    '<head>',
    '    <title>Quality Desk Checks</title>',
    '    <meta http-equiv="X-UA-Compatible" content="IE=11">',
    '    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">',
    '    <HTA:APPLICATION',
    '        ID="QualityDeskChecks"',
    '        APPLICATIONNAME="Quality Desk Checks"',
    '        BORDER="thick"',
    '        CAPTION="yes"',
    '        SHOWINTASKBAR="yes"',
    '        SINGLEINSTANCE="yes"',
    '        SYSMENU="yes"',
    '        WINDOWSTATE="maximize"',
    '        SCROLL="yes"',
    '    />',
    '    <style>',
    '        html, body { background: #121212; color: #f3f4f6; font-family: Segoe UI, Arial; margin: 0; height: 100%; }',
    '        #boot { padding: 32px 28px; }',
    '        h1 { margin: 0 0 12px; font-size: 20px; }',
    '        .err { color: #fca5a5; white-space: pre-wrap; }',
    '    </style>',
    '    <script language="JScript">',
    packScript(bootJs),
    '    </script>',
    '</head>',
    '<body>',
    '<div id="boot">',
    '    <h1>Quality Desk</h1>',
    '    <p>Opening sealed desk from qd.core...</p>',
    '    <p id="bootErr" class="err"></p>',
    '</div>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
  write('QualityDesk.hta', bootHtml);

  const leftoverIndex = path.join(outDir, 'index.html');
  if (fs.existsSync(leftoverIndex)) fs.unlinkSync(leftoverIndex);

  copyFile('vendor/chart.umd.min.js', 'vendor/chart.umd.min.js');

  fs.mkdirSync(path.join(outDir, 'results'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'results', '.gitkeep'), 'Runtime data folder.\n', 'utf8');

  write(
    'README.txt',
    [
      'Quality Desk — Floor Release',
      '============================',
      '',
      'Contents',
      '--------',
      '  QualityDesk.hta   Booter (double-click). Decrypts qd.core and opens the desk.',
      '  qd.core           Sealed app + History HTML. Keep beside the HTA.',
      '  vendor/           Chart.js (History graphs)',
      '  results/          Runtime data (sealed on this PC when the booter is used)',
      '  aio-csv/          Lookup CSVs (sealed on first boot if you drop a plaintext copy here)',
      '',
      'How to run: copy this folder to the shop PC, open QualityDesk.hta.',
      'Do not copy the development quality-desk.hta as the floor launcher.',
      'On first boot the release desk seals plaintext files in results/ and aio-csv/',
      '(peek-only on later boots — already-sealed files are skipped).',
      'Lookup uses aio-cache.js when CSVs have not changed. History reuses %TEMP%\\qd-desk',
      'when results have not changed.',
      '',
      'Do not edit qd.core. There is no plaintext index.html in this folder.',
      'History opens a decrypted copy under the Windows temp folder.',
      '',
      'Garland COEX backup',
      '-------------------',
      'When this PC has the folder',
      '  C:\\Users\\csccoex1\\OneDrive - Pregis LLC\\Quality\\',
      'each Garland COEX save appends new rows to COEX data.csv there.',
      'If that folder is missing, checks still save locally and backup is skipped.',
      '',
      'Obfuscation',
      '-----------',
      'The booter is packed. App source, History HTML, users.dat, and results',
      'are sealed (not Notepad / not a one-page base64 decoder).',
      'Scripts inside qd.core are not eval-packed: mshta cannot eval >100KB, and',
      'splitting qd-check.js broke the desk with Expected } / QD is undefined.',
      'This is not unbreakable: the booter must be able to open qd.core.',
      'Microsoft screnc.exe is NOT used: modern mshta will not run JScript.Encode.',
      '',
      'Rebuild: node tools/build-release.mjs',
      ''
    ].join('\r\n')
  );

  console.log('qd.core app bytes:', Buffer.byteLength(hta, 'utf8'), 'web bytes:', Buffer.byteLength(web, 'utf8'));
  console.log('qd.core sealed bytes:', Buffer.byteLength(sealed, 'utf8'));
  console.log('Release ready:', outDir);
}

main();
