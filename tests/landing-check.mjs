/**
 * Minimal static checks for the JustWex landing page.
 * Run: node tests/landing-check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function fail(message) {
  failures.push(message);
}

function mustExist(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) fail("Missing file: " + rel);
  return full;
}

const indexPath = mustExist("index.html");
const cssPath = mustExist("assets/css/site.css");
const themePath = mustExist("assets/js/theme.js");
const heroPath = mustExist("assets/js/hero-three.js");

const html = fs.readFileSync(indexPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const theme = fs.readFileSync(themePath, "utf8");
const hero = fs.readFileSync(heroPath, "utf8");

const requiredRefs = [
  ['href="projects/offline-journal/index.html"', "Offline Journal link"],
  ['href="https://color-vault.github.io/Color-Vault/dist/index.html"', "Pixel Art Recolor link"],
  ['href="https://github.com/masterwebx/Pressor/releases"', "Pressor download link"],
  ['href="projects/ssf2-replay-editor/replay-editor.html"', "Replay Editor link"],
  ['href="projects/goal-flowchart/goals.html"', "Goals Tool link"],
  ['href="projects/practice-test/index.html"', "Practice Test link"],
  ['href="https://ko-fi.com/justwex"', "Ko-fi link"],
  ['href="https://github.com/masterwebx"', "GitHub link"],
  ['href="assets/css/site.css"', "stylesheet"],
  ['src="assets/js/theme.js"', "theme script"],
  ['src="assets/js/hero-three.js"', "hero script"],
];

for (const [needle, label] of requiredRefs) {
  if (!html.includes(needle)) {
    fail("Landing HTML missing expected " + label + ": " + needle);
  }
}

const requiredAssets = [
  "projects/offline-journal/splash.png",
  "projects/pixelartrecoloronline.png",
  "projects/pressor.png",
  "projects/replayeditor.png",
  "projects/goals.png",
  "projects/practicetest.png",
  "projects/offline-journal/index.html",
  "projects/ssf2-replay-editor/replay-editor.html",
  "projects/goal-flowchart/goals.html",
  "projects/practice-test/index.html",
];

for (const asset of requiredAssets) {
  mustExist(asset);
}

if (!html.includes('id="projects"')) fail("Missing #projects landmark target");
if (!html.includes("data-theme-toggle")) fail("Missing theme toggle hook");
if (!html.includes('id="hero-canvas"')) fail("Missing hero canvas");
if (!html.includes("localStorage.getItem(\"dark\")")) {
  fail("Missing early dark preference bootstrap");
}
if (!theme.includes('localStorage.setItem(storageKey')) {
  fail("Theme script does not persist preference");
}
if (!hero.includes("setPixelRatio") || !hero.includes("1.5")) {
  fail("Hero must cap device pixel ratio");
}
if (!hero.includes("prefers-reduced-motion") || !hero.includes("IntersectionObserver")) {
  fail("Hero must respect reduced motion and offscreen pause");
}
if (!hero.includes("visibilitychange")) {
  fail("Hero must pause when document is hidden");
}
if (!hero.includes("three.module.js")) {
  fail("Hero must load supported three.module.js build");
}
if (/three\.min\.js/.test(hero.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""))) {
  fail("Hero must not depend on removed three.min.js UMD build");
}
if (!html.includes('type="module"') || !html.includes('src="assets/js/hero-three.js"')) {
  fail("Hero script must be loaded as type=module");
}
if (!css.includes("@media (prefers-reduced-motion: reduce)")) {
  fail("CSS missing reduced-motion handling");
}
if (!css.includes("min-width: 320px")) {
  fail("CSS missing 320px minimum width guard");
}

// Guard against accidental absolute /Wex-Projects/ hardcoding in new assets
for (const [label, text] of [
  ["index.html", html],
  ["site.css", css],
  ["theme.js", theme],
  ["hero-three.js", hero],
]) {
  if (text.includes("/Wex-Projects/")) {
    fail(label + " hardcodes /Wex-Projects/ absolute path");
  }
}

if (failures.length) {
  console.error("landing-check FAILED:");
  for (const item of failures) console.error(" - " + item);
  process.exit(1);
}

console.log(
  "landing-check passed (" + requiredRefs.length + " refs, " + requiredAssets.length + " assets)."
);
