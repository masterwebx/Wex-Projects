/**
 * Build release/ floor package: single HTA with JScript.Encode obfuscation.
 * Usage: node tools/build-release.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { encodeScript } from './screnc.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'release');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function inlineAndEncode(htaSrc, checkJs) {
  let html = htaSrc.replace(/\r\n/g, '\n');

  // Inline qd-check.js (must not stay as external editable file on the floor)
  html = html.replace(
    /<script\b[^>]*\bsrc\s*=\s*["']qd-check\.js["'][^>]*>\s*<\/script>/i,
    () => `<script type="text/javascript">\n${checkJs}\n</script>`
  );

  let blocks = 0;
  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, body) => {
    if (/src\s*=/i.test(attrs)) return full;
    const trimmed = body.replace(/^\uFEFF/, '');
    if (!trimmed.trim()) return full;
    // Skip already-encoded blocks
    if (/JScript\.Encode/i.test(attrs) || /#@~\^/.test(trimmed)) return full;
    blocks += 1;
    const encoded = encodeScript(trimmed);
    return `<script language="JScript.Encode">\n${encoded}\n</script>`;
  });

  if (blocks < 1) throw new Error('No script blocks were encoded.');
  return { html, blocks };
}

function main() {
  const hta = read('qualitydesk.hta');
  const checkJs = read('qd-check.js');
  const { html, blocks } = inlineAndEncode(hta, checkJs);

  fs.mkdirSync(outDir, { recursive: true });
  const outHta = path.join(outDir, 'QualityDesk.hta');
  fs.writeFileSync(outHta, html.replace(/\n/g, '\r\n'), 'utf8');

  const readme = [
    'Quality Desk Checks — Floor Release',
    '===================================',
    '',
    'This folder is for operators. Script source is obfuscated with Microsoft',
    'JScript.Encode so casual viewing/editing of the code is much harder.',
    '(This is obfuscation, not strong encryption — do not store secrets in it.)',
    '',
    'How to run',
    '----------',
    '1. Copy this entire release folder to the shop PC (keep QualityDesk.hta',
    '   next to a writable "results" folder — the app creates it if missing).',
    '2. Double-click QualityDesk.hta (opens with mshta.exe).',
    '3. Do NOT edit QualityDesk.hta. Changes belong in the developer sources',
    '   (qualitydesk.hta + qd-check.js), then rebuild release.',
    '',
    'Rebuild (developers)',
    '--------------------',
    '  node tools/build-release.mjs',
    '',
    'Source of truth: projects/die-centration-graph on GitHub (Wex-Projects).',
    ''
  ].join('\r\n');
  fs.writeFileSync(path.join(outDir, 'README.txt'), readme, 'utf8');

  // Keep results placeholder so operators have a place to write
  const resultsKeep = path.join(outDir, 'results');
  fs.mkdirSync(resultsKeep, { recursive: true });
  fs.writeFileSync(
    path.join(resultsKeep, '.gitkeep'),
    'Runtime data is written here by the HTA. Do not commit shop data.\n',
    'utf8'
  );

  const sizeKb = Math.round(fs.statSync(outHta).size / 1024);
  console.log('Encoded script blocks:', blocks);
  console.log('Wrote', outHta, `(${sizeKb} KB)`);
  console.log('Wrote', path.join(outDir, 'README.txt'));
}

main();
