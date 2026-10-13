#!/usr/bin/env node
// Fails on any em dash (U+2014) or en dash (U+2013) in shipped text.
// Covers README.md, the root documents, docs/, skills/, installer/, and every file under
// agents/. In a Markdown file that carries a "## Corrections" heading, only the text above
// that heading is checked, because the section below it belongs to whoever installed the kit.
// A subtree inside skills/ is skipped entirely when its root carries manifest.json
// declaring "generator_id": "pod-design-skill-builder": that marks a machine-emitted
// generated pod-design-<niche> skill, whose contents are regenerated from source data
// and must never be hand-edited, so an authored-copy style rule cannot apply to it.
// The vendored pod-design-skill-builder tree itself is scanned: it is kept free of
// em and en dashes so the same rule holds for the text it emits into generated
// skills. A marker anywhere else, or naming any other generator, is not an exemption.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
if (!fs.existsSync(path.join(ROOT, "agents"))) { process.stderr.write("no-dashes: cannot find agents/ under " + ROOT + "\n"); process.exit(2); }
const ROOTS = ["README.md", "CONTRIBUTING.md", "SECURITY.md", "CHANGELOG.md", "CREDITS.md", "docs", "skills", "installer", "agents", "assets", "package.json"];
const SKIP_DIRS = new Set([".git", "node_modules"]);
const TEXT = /\.(md|mjs|js|cjs|json|yml|yaml|txt|example|csv|jsonl)$/i;
// The en dash and the em dash, built from code points so this file never carries either character itself.
const DASHES = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");

const hits = [];
function scan(file) {
  let text = fs.readFileSync(file, "utf8");
  if (file.endsWith(".md")) {
    const cut = text.indexOf("\n## Corrections");
    if (cut >= 0) text = text.slice(0, cut);
  }
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    const col = line.search(DASHES);
    if (col >= 0) hits.push(path.relative(ROOT, file) + ":" + (i + 1) + ":" + (col + 1));
  });
}
const SKILLS_ROOT = path.join(ROOT, "skills");
function isGeneratedTree(dir) {
  const rel = path.relative(SKILLS_ROOT, dir);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return false;
  const file = path.join(dir, "manifest.json");
  if (!fs.existsSync(file)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return !!(data && data.generator_id === "pod-design-skill-builder");
  } catch {
    return false;
  }
}
function walk(p) {
  if (!fs.existsSync(p)) return;
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    if (isGeneratedTree(p)) return;
    for (const e of fs.readdirSync(p)) if (!SKIP_DIRS.has(e)) walk(path.join(p, e));
  } else if (TEXT.test(p) || path.basename(p) === "VERSION") {
    scan(p);
  }
}
for (const r of ROOTS) walk(path.join(ROOT, r));

if (hits.length) {
  process.stdout.write("no-dashes: FAIL, " + hits.length + " dash character(s) found:\n  " + hits.join("\n  ") + "\n");
  process.exit(1);
}
process.stdout.write("no-dashes: PASS\n");
