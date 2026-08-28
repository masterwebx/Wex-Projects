Quality Desk Checks — Floor Release
===================================

This folder is for operators. Script source is obfuscated with Microsoft
JScript.Encode so casual viewing/editing of the code is much harder.
(This is obfuscation, not strong encryption — do not store secrets in it.)

How to run
----------
1. Copy this entire release folder to the shop PC (keep QualityDesk.hta
   next to a writable "results" folder — the app creates it if missing).
2. Double-click QualityDesk.hta (opens with mshta.exe).
3. Do NOT edit QualityDesk.hta. Changes belong in the developer sources
   (qualitydesk.hta + qd-check.js), then rebuild release.

Rebuild (developers)
--------------------
  node tools/build-release.mjs

Source of truth: projects/die-centration-graph on GitHub (Wex-Projects).
