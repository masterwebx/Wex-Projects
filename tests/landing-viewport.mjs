/**
 * Optional viewport load smoke via Playwright CLI.
 * Skips cleanly when Chromium is not installed (no install/permission bypass).
 * Run: node tests/landing-viewport.mjs
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "tests", ".viewport-smoke");
const port = 4177;
const base = "http://127.0.0.1:" + port + "/";

const probe = spawnSync(
  "playwright",
  ["screenshot", "--help"],
  { cwd: root, encoding: "utf8", windowsHide: true }
);

if (probe.error || probe.status !== 0) {
  console.log("landing-viewport skipped: Playwright CLI unavailable.");
  process.exit(0);
}

fs.mkdirSync(outDir, { recursive: true });
const probeShot = path.join(outDir, "probe.png");
const browserProbe = spawnSync(
  "playwright",
  [
    "screenshot",
    "--viewport-size=320,480",
    "--timeout=15000",
    "data:text/html,<h1>ok</h1>",
    probeShot,
  ],
  { cwd: root, encoding: "utf8", windowsHide: true }
);

if (browserProbe.status !== 0) {
  try {
    fs.rmSync(outDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  console.log(
    "landing-viewport skipped: Playwright browser binary unavailable in this environment."
  );
  process.exit(0);
}

const server = spawn("python", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
  cwd: root,
  stdio: "ignore",
  windowsHide: true,
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(base);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(100);
  }
  throw new Error("Local preview server did not start");
}

const failures = [];

try {
  await waitForServer();
  const home = await fetch(base).then((r) => r.text());
  if (!home.includes('id="projects"') || !home.includes("Open Journal")) {
    failures.push("Served index.html missing expected project markup");
  }

  for (const [width, height] of [
    [320, 720],
    [768, 900],
    [1280, 800],
  ]) {
    const file = path.join(outDir, "landing-" + width + ".png");
    const result = spawnSync(
      "playwright",
      [
        "screenshot",
        "--viewport-size=" + width + "," + height,
        "--wait-for-selector=#projects",
        "--timeout=20000",
        base,
        file,
      ],
      { cwd: root, encoding: "utf8", windowsHide: true }
    );
    if (result.status !== 0) {
      failures.push(
        "Screenshot failed at " +
          width +
          "px: " +
          (result.stderr || result.stdout || "unknown error")
      );
      continue;
    }
    if (!fs.existsSync(file) || fs.statSync(file).size < 1000) {
      failures.push("Screenshot missing or too small at " + width + "px");
    }
  }
} catch (err) {
  failures.push(String(err && err.stack ? err.stack : err));
} finally {
  if (!server.killed) server.kill("SIGTERM");
  try {
    fs.rmSync(outDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

if (failures.length) {
  console.error("landing-viewport FAILED:");
  for (const item of failures) console.error(" - " + item);
  process.exit(1);
}

console.log("landing-viewport passed (served HTML + 320/768/1280 load smoke).");
