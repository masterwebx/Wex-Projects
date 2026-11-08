import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const failures = [];

for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
  const ref = match[1];
  if (/^(https?:|data:|#|mailto:)/i.test(ref)) continue;
  const full = path.join(root, ref);
  if (!fs.existsSync(full)) failures.push(ref);
}

if (failures.length) {
  console.error("Unresolved local refs:");
  for (const item of failures) console.error(" - " + item);
  process.exit(1);
}

console.log("All local href/src assets resolve.");
