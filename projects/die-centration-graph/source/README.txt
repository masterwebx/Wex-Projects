Quality Desk — plaintext source (v1.7.82)
==========================================

This folder is the readable app. It is not the shop-floor package.
The floor copy lives in ../release and is sealed (qd.core + packed booter).
Zip this folder and send it when someone needs the source.

How to run (Windows)
--------------------
Keep these files together and double-click quality-desk.hta:

  quality-desk.hta     Check sheet (development launcher, not the floor booter)
  qd-check.js          App logic loaded by the HTA
  index.html           History / graphs (opened from the HTA)
  QualityDesk.ico      Window icon
  vendor/chart.umd.min.js

History also opens in a browser from index.html. Trends needs the vendor file
beside it. Do not rename the folder layout.

Excel macros (import, do not drop next to the HTA)
---------------------------------------------------
  vba/ExportAioCsv.bas            Import into Quality AIO.xlsm. Writes aio-csv.
  vba/CopyForGraphS4.bas          Import into S4.xlsm.
  vba/CopyForGraphS1S3.bas        Import into S1 S3.xlsm.
  vba/CopyForGraphGarland.bas     Import into the Garland Bubble workbook.
  vba/CopyForGraphFromQuality.bas Import into Personal.xlsb or a launcher book,
                                  not into the quality workbooks.

Left out on purpose
-------------------
  ../release/          Sealed floor package (qd.core, packed QualityDesk.hta)
  ../tools/            Encoder and release build script
  ../fixtures/         Sample parse files, not the app
  Quality AIO.xlsm     Plant workbook — never commit or send from this repo
  BubbleSpecs.csv      Plant specs
  aio-csv/ and results/  Lookup tables and saved checks (created on the PC)

On the PC that runs the desk, put the AIO workbook or aio-csv next to
quality-desk.hta. The HTA creates results/ for saved checks.
