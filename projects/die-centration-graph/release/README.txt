Quality Desk — Floor Release
============================

Contents
--------
  QualityDesk.hta   Checks app (mshta). Encoded with Microsoft Script Encoder.
  index.html        History / die graph (Edge). Scripts packed for casual viewing.
  vendor/           Chart.js dependency for index.html
  results/          Runtime data folder (writable)

How to run
----------
1. Copy this entire folder to the shop PC.
2. Double-click QualityDesk.hta
3. Keep index.html + vendor next to the HTA (History button needs them).

Rebuild
-------
  node tools/build-release.mjs
Uses tools/screnc.exe when present (Microsoft Script Encoder 1.0).

Encoder used: Microsoft screnc.exe (tools/screnc.exe)
