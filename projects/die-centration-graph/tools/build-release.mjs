/**
 * Build release/ floor package.
 *
 * Microsoft screnc.exe / JScript.Encode does not run under modern mshta.
 * We pack scripts as base64+eval instead. mshta also rejects a single eval
 * larger than ~100KB, so large scripts are split into <90KB chunks at
 * top-level function boundaries.
 *
 * Usage: node tools/build-release.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'release');
const MAX_CHUNK = 90000;

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

  // Break candidates: newline + spaces + "function "
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
      // No function break within window — hard split
      end = Math.min(start + maxLen, text.length);
      // try not to split mid-line
      const nl = text.lastIndexOf('\n', end);
      if (nl > start + maxLen * 0.5) end = nl + 1;
      while (i < breaks.length && breaks[i] <= end) i += 1;
    }
    out.push(text.slice(start, end));
    start = end;
  }
  return out.filter((c) => c.trim().length);
}

function scriptTagsFromSource(jsSource) {
  const parts = splitScript(jsSource, MAX_CHUNK);
  return parts
    .map((p) => `<script language="JScript">\n${packScript(p)}\n</script>`)
    .join('\n');
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

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  let hta = read('qualitydesk.hta').replace(/\r\n/g, '\n');
  const checkJs = read('qd-check.js');
  hta = hta.replace(
    /<script\b[^>]*\bsrc\s*=\s*["']qd-check\.js["'][^>]*>\s*<\/script>/i,
    () => `<script language="JScript">\n${checkJs}\n</script>`
  );
  const htaPack = packHtmlScripts(hta);
  if (htaPack.chunks < 1) throw new Error('No HTA scripts packed');
  write('QualityDesk.hta', htaPack.html);

  if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('index.html missing');
  if (!fs.existsSync(path.join(root, 'vendor', 'chart.umd.min.js'))) {
    throw new Error('vendor/chart.umd.min.js missing');
  }
  const idxPack = packHtmlScripts(read('index.html').replace(/\r\n/g, '\n'));
  write('index.html', idxPack.html);
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
      '  QualityDesk.hta   Checks app (double-click)',
      '  index.html        History / die graph (keep beside HTA)',
      '  vendor/           Chart.js',
      '  results/          Runtime data',
      '',
      'How to run: copy this folder to the shop PC, open QualityDesk.hta',
      '',
      'Obfuscation',
      '-----------',
      'Scripts are packed (base64) so casual editing is hard.',
      'Microsoft screnc.exe is NOT used in this build: modern mshta will not',
      'run JScript.Encode (that caused "doLogin is undefined").',
      'tools/screnc.exe remains for legacy reference only.',
      '',
      'Rebuild: node tools/build-release.mjs',
      ''
    ].join('\r\n')
  );

  console.log('HTA logical scripts:', htaPack.blocks, 'packed chunks:', htaPack.chunks);
  console.log('index logical scripts:', idxPack.blocks, 'packed chunks:', idxPack.chunks);
  console.log('Release ready:', outDir);
}

main();
