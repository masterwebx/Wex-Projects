/**
 * Build release/ floor package using Microsoft screnc.exe when available.
 * Usage: node tools/build-release.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { encodeScript } from './screnc.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'release');

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

function findScrenc() {
  if (process.env.SCRENC && fs.existsSync(process.env.SCRENC)) return process.env.SCRENC;
  const local = path.join(root, 'tools', 'screnc.exe');
  if (fs.existsSync(local)) return local;
  const candidates = [
    'C:\\Program Files\\Windows Script Encoder\\screnc.exe',
    'C:\\Program Files (x86)\\Windows Script Encoder\\screnc.exe'
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return '';
}

function preparePlainHta(htaSrc, checkJs) {
  let html = htaSrc.replace(/\r\n/g, '\n');
  // Inline shared logic — floor package must not ship editable qd-check.js
  html = html.replace(
    /<script\b[^>]*\bsrc\s*=\s*["']qd-check\.js["'][^>]*>\s*<\/script>/i,
    () => `<script language="JScript">\n//**Start Encode**\n${checkJs}\n</script>`
  );
  // Mark the main HTA script for encoding
  html = html.replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
    (full, attrs, body) => {
      if (/src\s*=/i.test(attrs)) return full;
      if (/JScript\.Encode/i.test(attrs) || /#@~\^/.test(body)) return full;
      if (/language\s*=\s*["']JScript["']/i.test(attrs) && /\/\/\*\*Start Encode\*\*/.test(body)) {
        return full;
      }
      const trimmed = body.replace(/^\uFEFF/, '');
      if (!trimmed.trim()) return full;
      return `<script language="JScript">\n//**Start Encode**\n${trimmed}\n</script>`;
    }
  );
  return html;
}

function encodeWithScrenc(plainHtml) {
  const screnc = findScrenc();
  if (!screnc) return null;
  const tmpDir = path.join(outDir, '_tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const inFile = path.join(tmpDir, 'in.htm');
  const outFile = path.join(tmpDir, 'out.htm');
  fs.writeFileSync(inFile, plainHtml.replace(/\n/g, '\r\n'), 'utf8');
  const r = spawnSync(screnc, ['/s', '/e', 'htm', inFile, outFile], {
    encoding: 'utf8',
    windowsHide: true
  });
  let encoded = null;
  if (r.status === 0 && fs.existsSync(outFile)) {
    encoded = fs.readFileSync(outFile, 'utf8');
    if (!/JScript\.Encode/i.test(encoded) || !/#@~\^/.test(encoded)) {
      console.warn('screnc.exe ran but output missing JScript.Encode markers');
      encoded = null;
    }
  } else {
    console.warn('screnc.exe failed:', r.status, r.stderr || r.stdout || '');
  }
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  if (encoded) console.log('Encoded HTA with Microsoft screnc.exe:', screnc);
  return encoded;
}

function encodeWithNode(plainHtml) {
  let blocks = 0;
  const html = plainHtml.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, body) => {
    if (/src\s*=/i.test(attrs)) return full;
    let src = body.replace(/^\uFEFF/, '');
    src = src.replace(/^[\s\r\n]*\/\/\*\*Start Encode\*\*[\s\r\n]*/, '');
    if (!src.trim()) return full;
    if (/JScript\.Encode/i.test(attrs) || /#@~\^/.test(src)) return full;
    blocks += 1;
    return `<script language="JScript.Encode">\n${encodeScript(src)}\n</script>`;
  });
  console.log('Encoded HTA with Node screnc port; blocks=', blocks);
  return html;
}

function packForBrowser(jsSource) {
  const b64 = Buffer.from(String(jsSource), 'utf8').toString('base64');
  return (
    '!function(){var a="' +
    b64 +
    '",s=atob(a),o="";for(var i=0;i<s.length;i++)o+=String.fromCharCode(s.charCodeAt(i));(0,eval)(o)}();'
  );
}

function packIndexHtml(indexSrc) {
  let html = indexSrc.replace(/\r\n/g, '\n');
  let blocks = 0;
  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, body) => {
    if (/src\s*=/i.test(attrs)) return full;
    const trimmed = body.replace(/^\uFEFF/, '');
    if (!trimmed.trim()) return full;
    blocks += 1;
    return `<script>\n${packForBrowser(trimmed)}\n</script>`;
  });
  if (blocks < 1) throw new Error('No index.html script blocks packed');
  return { html, blocks };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const plain = preparePlainHta(read('qualitydesk.hta'), read('qd-check.js'));
  let encoderNote = '';
  let encodedHta = encodeWithScrenc(plain);
  if (encodedHta) {
    encoderNote = 'Microsoft screnc.exe (tools/screnc.exe)';
  } else {
    encodedHta = encodeWithNode(plain);
    encoderNote = 'Node JScript.Encode port (fallback)';
  }
  write('QualityDesk.hta', encodedHta);

  if (!fs.existsSync(path.join(root, 'index.html'))) {
    throw new Error('index.html missing');
  }
  if (!fs.existsSync(path.join(root, 'vendor', 'chart.umd.min.js'))) {
    throw new Error('vendor/chart.umd.min.js missing');
  }
  const { html: packedIndex, blocks: indexBlocks } = packIndexHtml(read('index.html'));
  write('index.html', packedIndex);
  copyFile('vendor/chart.umd.min.js', 'vendor/chart.umd.min.js');

  fs.mkdirSync(path.join(outDir, 'results'), { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'results', '.gitkeep'),
    'Runtime data is written here by the HTA.\n',
    'utf8'
  );

  write(
    'README.txt',
    [
      'Quality Desk — Floor Release',
      '============================',
      '',
      'Contents',
      '--------',
      '  QualityDesk.hta   Checks app (mshta). Encoded with Microsoft Script Encoder.',
      '  index.html        History / die graph (Edge). Scripts packed for casual viewing.',
      '  vendor/           Chart.js dependency for index.html',
      '  results/          Runtime data folder (writable)',
      '',
      'How to run',
      '----------',
      '1. Copy this entire folder to the shop PC.',
      '2. Double-click QualityDesk.hta',
      '3. Keep index.html + vendor next to the HTA (History button needs them).',
      '',
      'Rebuild',
      '-------',
      '  node tools/build-release.mjs',
      'Uses tools/screnc.exe when present (Microsoft Script Encoder 1.0).',
      '',
      'Encoder used: ' + encoderNote,
      ''
    ].join('\r\n')
  );

  console.log('Encoder:', encoderNote);
  console.log('index.html packed blocks:', indexBlocks);
  console.log('Release ready in', outDir);
}

main();
