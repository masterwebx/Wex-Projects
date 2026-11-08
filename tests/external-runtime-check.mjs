/**
 * Validate external runtime assets used by the landing page.
 * Run: node tests/external-runtime-check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function fail(message) {
  failures.push(message);
}

const heroPath = path.join(root, "assets/js/hero-three.js");
const htmlPath = path.join(root, "index.html");
const heroSource = fs.readFileSync(heroPath, "utf8");
const html = fs.readFileSync(htmlPath, "utf8");

if (!html.includes('type="module"') || !html.includes('src="assets/js/hero-three.js"')) {
  fail("index.html must load hero-three.js as an ES module");
}

if (/three\.min\.js/.test(heroSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""))) {
  fail("hero-three.js still references unsupported three.min.js UMD build");
}

const heroModule = await import(pathToFileURL(heroPath).href);
const moduleUrl = heroModule.THREE_MODULE_URL;
if (typeof moduleUrl !== "string" || !moduleUrl.includes("three.module.js")) {
  fail("THREE_MODULE_URL must point at three.module.js");
}

const urls = [
  {
    label: "Three.js ES module",
    url: moduleUrl,
    mustInclude: "WebGLRenderer",
  },
];

const fontMatch = html.match(/href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"/);
if (fontMatch) {
  urls.push({
    label: "Google Fonts CSS",
    url: fontMatch[1],
    mustInclude: "@font-face",
  });
}

for (const item of urls) {
  let response;
  try {
    response = await fetch(item.url, {
      redirect: "follow",
      headers: { Accept: "*/*" },
    });
  } catch (err) {
    fail(item.label + " fetch failed: " + err.message + " (" + item.url + ")");
    continue;
  }

  if (!response.ok) {
    fail(item.label + " HTTP " + response.status + " (" + item.url + ")");
    continue;
  }

  const body = await response.text();
  if (!body || body.length < 32) {
    fail(item.label + " returned an empty/short body (" + item.url + ")");
  }
  if (item.mustInclude && !body.includes(item.mustInclude)) {
    fail(item.label + " body missing expected marker '" + item.mustInclude + "'");
  }
}

if (failures.length) {
  console.error("external-runtime-check FAILED:");
  for (const item of failures) console.error(" - " + item);
  process.exit(1);
}

console.log(
  "external-runtime-check passed (" + urls.length + " remote assets reachable)."
);
