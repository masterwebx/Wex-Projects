Quality Desk — Floor Release
============================

Contents
--------
  QualityDesk.hta   Booter (double-click). Decrypts qd.core and opens the desk.
  QualityDesk.ico   Window / taskbar icon. Keep beside the HTA.
  qd.core           Sealed app + History HTML. Keep beside the HTA.
  vendor/           Chart.js (History graphs)
  results/          Runtime data (sealed on this PC when the booter is used)
  aio-csv/          Lookup CSVs (sealed on first boot if you drop a plaintext copy here)

How to run: copy this folder to the shop PC, open QualityDesk.hta.
Do not copy the development quality-desk.hta as the floor launcher.
On first boot the release desk seals plaintext files in results/ and aio-csv/
(peek-only on later boots — already-sealed files are skipped).
Lookup uses aio-cache.js when CSVs have not changed. History reuses %TEMP%\qd-desk
when results have not changed.

Do not edit qd.core. There is no plaintext index.html in this folder.
History opens a decrypted copy under the Windows temp folder.

Garland COEX backup
-------------------
When this PC has the folder
  C:\Users\csccoex1\OneDrive - Pregis LLC\Quality\
each Garland COEX save appends new rows to COEX data.csv there.
If that folder is missing, checks still save locally and backup is skipped.

Obfuscation
-----------
The booter is packed. App source, History HTML, users.dat, and results
are sealed (not Notepad / not a one-page base64 decoder).
Scripts inside qd.core are not eval-packed: mshta cannot eval >100KB, and
splitting qd-check.js broke the desk with Expected } / QD is undefined.
This is not unbreakable: the booter must be able to open qd.core.
Microsoft screnc.exe is NOT used: modern mshta will not run JScript.Encode.

Rebuild: node tools/build-release.mjs
