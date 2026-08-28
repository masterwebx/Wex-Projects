Quality Desk — Floor Release
============================

Contents
--------
  QualityDesk.hta   Checks app (double-click)
  index.html        History / die graph (keep beside HTA)
  vendor/           Chart.js
  results/          Runtime data

How to run: copy this folder to the shop PC, open QualityDesk.hta

Obfuscation
-----------
Scripts are packed (base64) so casual editing is hard.
Microsoft screnc.exe is NOT used in this build: modern mshta will not
run JScript.Encode (that caused "doLogin is undefined").
tools/screnc.exe remains for legacy reference only.

Rebuild: node tools/build-release.mjs
