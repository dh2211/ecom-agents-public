#!/usr/bin/env node
/*
 * ecom-agents
 *
 *   node installer/cli.mjs hire <agent> [--to <folder>]
 *   node installer/cli.mjs list
 *
 * Copies one agent folder into place, refuses a folder under cloud sync,
 * runs the kit's three self tests, and prints its install prompt with the
 * path filled in. It registers no schedule, sends nothing, and reports
 * nothing anywhere. The only network call is the download of the repo
 * tarball when the agent folder is not already beside this script.
 *
 * Requires Node 18 or newer. No dependencies.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { upgrade as runUpgrade, contribute as runContribute, writeReceipt } from "./upgrade.mjs";

const SELF = fileURLToPath(import.meta.url);
const HERE = path.dirname(SELF);
const REPO = "thienduy2211/ecom-agents";
const VERSION = readVersion();

const AGENTS = {
  "gtm-engineer": { name: "GTM Engineer", role: "Go to market and launch", aliases: ["gtm", "go-to-market", "launch", "growth"] },
  "seo-agent": { name: "SEO/AEO Agent", role: "Search and answer visibility", aliases: ["seo", "aeo", "geo", "search", "content"] },
  "web-dev-agent": { name: "Web Dev Agent", role: "Engineering and maintenance", aliases: ["web-dev", "webdev", "web", "developer", "dev"] },
  "social-media-agent": { name: "Social Media Agent", role: "Audience and distribution", aliases: ["social", "social-media"] },
  "ad-manager-agent": { name: "Ad Manager Agent", role: "Paid acquisition", aliases: ["ads", "ad-manager", "paid"] },
  "sales-agent": { name: "Sales Agent", role: "Pipeline and outreach", aliases: ["sales", "sdr"] },
  "customer-satisfaction-agent": { name: "Customer Satisfaction Agent", role: "Support and retention", aliases: ["csat", "support", "customer-satisfaction", "customer"] },
  "chief-of-staff": { name: "Chief of Staff", role: "Oversight and strategy", aliases: ["cos", "chief", "chief-of-staff"] },
  "pod-design-agent": { name: "POD Design Agent", role: "Print artwork and niche design skills", aliases: ["pod-design", "design", "artwork", "pod-art"] },
};

const SYNC_MARKERS = ["onedrive", "dropbox", "icloud", "google drive", "googledrive", "mobile documents"];

function readVersion() {
  try { return JSON.parse(fs.readFileSync(path.join(HERE, "..", "package.json"), "utf8")).version || "0.0.0"; }
  catch { return "0.0.0"; }
}

function out(s) { process.stdout.write(s + "\n"); }
function fail(s, code = 1) { process.stderr.write("ecom-agents: " + s + "\n"); process.exit(code); }

function usage() {
  out([
    "ecom-agents " + VERSION,
    "",
    "  node installer/cli.mjs hire <agent> [--to <folder>]   copy one agent into place and print its install prompt",
    "  node installer/cli.mjs list                              the agents, one line each",
    "  node installer/cli.mjs upgrade <agent> [--to <folder>] [--apply]   report what a new version would change, then apply it",
    "  node installer/cli.mjs contribute <agent> [--to <folder>] [--since YYYY-MM-DD]  turn your agent's own field repairs into an issue",
    "",
    "The folder must be outside OneDrive, Dropbox, Google Drive and iCloud. Without --to it is ./agents/<slug>.",
    "Nothing is scheduled and nothing is sent. Prerequisites: https://github.com/" + REPO + "/blob/main/docs/PREREQUISITES.md",
  ].join("\n"));
}

function list() {
  for (const [slug, e] of Object.entries(AGENTS)) out("  " + slug.padEnd(32) + e.name.padEnd(32) + e.role);
}

function resolveSlug(word) {
  if (!word) return null;
  const w = word.toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
  if (AGENTS[w]) return w;
  // Slugs from before the rename still resolve to the same agent.
  if (w.endsWith("-employee")) {
    const stem = w.slice(0, -"-employee".length);
    for (const candidate of [stem, stem.endsWith("-agent") ? stem : stem + "-agent"]) if (AGENTS[candidate]) return candidate;
  }
  for (const [slug, e] of Object.entries(AGENTS)) {
    if (e.aliases.includes(w) || slug.startsWith(w) || e.name.toLowerCase().replace(/\s+/g, "-") === w) return slug;
  }
  return null;
}

function underCloudSync(p) {
  const norm = path.resolve(p).toLowerCase().replace(/\\/g, "/");
  return SYNC_MARKERS.some((m) => norm.includes(m));
}

function isEmptyDir(p) {
  return fs.existsSync(p) && fs.statSync(p).isDirectory() && fs.readdirSync(p).length === 0;
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    // A kit is plain files. A symlink or device entry in a downloaded tree
    // must not be followed or copied into someone's working folder.
    if (e.isDirectory()) copyDir(s, d);
    else if (e.isFile()) fs.copyFileSync(s, d);
    else throw new Error("the agent folder contains an unsupported entry and cannot be copied: " + e.name);
  }
}

async function fetchTarball(slug, dst) {
  const refs = ["refs/tags/v" + VERSION]; // Fail closed: never silently fetch a different main branch.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ecom-agents-"));
  try {
    for (const ref of refs) {
      const url = "https://codeload.github.com/" + REPO + "/tar.gz/" + ref;
      let res;
      try { res = await fetch(url); } catch (err) { out("  download failed for " + ref + ": " + err.message); continue; }
      if (!res.ok) { out("  " + ref + " is not available (" + res.status + ")"); continue; }
      const file = path.join(tmp, "repo.tgz");
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      const listing = spawnSync("tar", ["-tzf", file], { encoding: "utf8" });
      if (listing.status !== 0) throw new Error("tar is needed to extract the download and it is not available: " + (listing.stderr || "").trim());
      const top = (listing.stdout.split("\n")[0] || "").split("/")[0];
      const member = top + "/agents/" + slug;
      if (!listing.stdout.split("\n").some((l) => l.startsWith(member + "/"))) throw new Error("the download has no agents/" + slug + " folder");
      const extractRoot = path.join(tmp, "x");
      fs.mkdirSync(extractRoot);
      const x = spawnSync("tar", ["-xzf", file, "-C", extractRoot, member], { encoding: "utf8" });
      if (x.status !== 0) throw new Error("extract failed: " + (x.stderr || "").trim());
      copyDir(path.join(extractRoot, member), dst);
      out("  downloaded " + ref + " and copied agents/" + slug);
      return;
    }
    throw new Error("could not download the repo. Clone https://github.com/" + REPO + " and copy agents/" + slug + " by hand.");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function selftests(dst) {
  let allOk = true;
  for (const script of ["copy-check.mjs", "runlog.mjs", "guard.mjs"]) {
    const p = path.join(dst, "scripts", script);
    if (!fs.existsSync(p)) { out("  missing " + script); allOk = false; continue; }
    const r = spawnSync(process.execPath, [p, "--selftest"], { encoding: "utf8" });
    const last = (r.stdout || "").trim().split("\n").pop() || (r.stderr || "").trim();
    out("  " + (r.status === 0 ? "ok    " : "FAIL  ") + last);
    if (r.status !== 0) allOk = false;
  }
  return allOk;
}

function loginStatus() {
  const r = spawnSync("claude", ["auth", "status"], { encoding: "utf8", shell: process.platform === "win32" });
  if (r.error || r.status === null) return "unknown (claude is not on PATH here; the Desktop app has its own login, and another harness has its own login check)";
  const text = (r.stdout || "") + (r.stderr || "");
  if (/loggedIn"?\s*:\s*true/i.test(text)) return "logged in";
  if (/loggedIn"?\s*:\s*false/i.test(text) || /not logged in/i.test(text)) return "NOT logged in";
  return "unknown";
}

async function hire(args) {
  const slug = resolveSlug(args._[0]);
  if (!slug) { out("Which agent? One of:"); list(); process.exit(2); }
  const e = AGENTS[slug];
  const dst = path.resolve(args.to || path.join(process.cwd(), "agents", slug));

  if (underCloudSync(dst)) {
    fail(dst + " sits under a cloud sync folder. The routines write state and a run log mid run, and a sync client corrupts exactly the file that tells tomorrow's run what already happened. Pick a local folder such as " + (process.platform === "win32" ? "D:\\AgentOps\\" + slug : "~/ecom-agents/" + slug) + " and pass it with --to.", 3);
  }
  if (fs.existsSync(dst) && !isEmptyDir(dst)) {
    fail(dst + " already exists and is not empty. Never copy over an installed agent; its strategy, state and ledgers are yours. To update one, follow docs/UPGRADING.md in this checkout.", 4);
  }

  out("Hiring the " + e.name + " into " + dst);
  const local = path.join(HERE, "..", "agents", slug);
  const existed = fs.existsSync(dst);
  let version = "unknown";
  try {
    if (fs.existsSync(path.join(local, "CONTRACT.md"))) {
      copyDir(local, dst);
      out("  copied agents/" + slug + " from the package");
    } else {
      await fetchTarball(slug, dst);
    }
    version = fs.existsSync(path.join(dst, "VERSION")) ? fs.readFileSync(path.join(dst, "VERSION"), "utf8").trim() : "unknown";
    out("  kit version " + version);
    out("Self tests:");
    if (!selftests(dst)) {
      const err = new Error("mandatory self tests failed. The incomplete copy was removed and no trusted receipt was written. Correct the kit, then hire again.");
      err.code = "SELFTEST";
      throw err;
    }
    writeReceipt(dst, slug, version);
  } catch (err) {
    fs.rmSync(dst, { recursive: true, force: true });
    if (existed) fs.mkdirSync(dst);
    if (err.code === "SELFTEST") fail(err.message, 6);
    fail(err.message);
  }
  out("  wrote .installed.json so a later upgrade can tell your edits from ours");
  out("Login: " + loginStatus());

  const promptPath = path.join(dst, "INSTALL-PROMPT.md");
  let prompt = fs.readFileSync(promptPath, "utf8");
  const rootToken = (prompt.match(/«[A-Z_]+_ROOT»/) || [])[0];
  if (rootToken) prompt = prompt.split(rootToken).join(dst);

  out("");
  out("=".repeat(78));
  out("Next: open a session in " + dst + " in the agent you use (Claude Code or any of the other ten) and say");
  out("\"install the " + e.name + " from this folder\". It reads INSTALL-PROMPT.md itself and asks for whatever");
  out("the FILL THIS IN block still needs only if it cannot find it. Or paste it yourself: the prompt is printed");
  out("below with the path already filled in;");
  out("copy everything between === BEGIN PROMPT === and === END PROMPT ===. The agent's first run takes");
  out("about an hour and may ask for a second session.");
  out("=".repeat(78));
  out("");
  out(prompt.trim());
  out("");
  out("Updates and new agents: github.com/thienduy2211/ecom-agents (https://github.com/thienduy2211/ecom-agents)");
}


async function resolveFreshKit(slug) {
  const local = path.join(HERE, "..", "agents", slug);
  if (fs.existsSync(path.join(local, "CONTRACT.md"))) return { dir: local, cleanup: null };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ecom-agents-up-"));
  const dst = path.join(tmp, slug);
  await fetchTarball(slug, dst);
  return { dir: dst, cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}

async function upgradeCmd(args) {
  const slug = resolveSlug(args._[0]);
  if (!slug) { out("Which agent? One of:"); list(); process.exit(2); }
  const installed = path.resolve(args.to || path.join(process.cwd(), "agents", slug));
  const fresh = await resolveFreshKit(slug);
  try {
    runUpgrade({ installed, fresh: fresh.dir, slug, apply: args.apply, out, fail });
  } finally {
    if (fresh.cleanup) fresh.cleanup();
  }
}

function contributeCmd(args) {
  const slug = resolveSlug(args._[0]);
  if (!slug) { out("Which agent? One of:"); list(); process.exit(2); }
  const installed = path.resolve(args.to || path.join(process.cwd(), "agents", slug));
  runContribute({ installed, slug, since: args.since, out, fail });
}

function parse(argv) {
  const args = { _: [], to: null, help: false, apply: false, since: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--to") { args.to = argv[++i]; if (!args.to) fail("--to needs a folder", 2); continue; }
    if (a.startsWith("--to=")) { args.to = a.slice(5); continue; }
    if (a === "--apply") { args.apply = true; continue; }
    if (a === "--since") { args.since = argv[++i]; if (!args.since) fail("--since needs a date, YYYY-MM-DD", 2); continue; }
    if (a.startsWith("--since=")) { args.since = a.slice(8); continue; }
    if (a === "--help" || a === "-h") { args.help = true; continue; }
    if (a === "--version" || a === "-v") { out(VERSION); process.exit(0); }
    if (a.startsWith("--")) fail("unknown option " + a, 2);
    args._.push(a);
  }
  return args;
}

const args = parse(process.argv.slice(2));
const cmd = args._.shift();
if (args.help || !cmd) { usage(); process.exit(cmd ? 0 : 2); }
if (args._.length > 1) fail("one agent at a time; unexpected argument(s): " + args._.slice(1).join(" "), 2);
if (cmd === "list") { list(); process.exit(0); }
if (cmd === "hire") { await hire(args); process.exit(0); }
if (cmd === "upgrade") { await upgradeCmd(args); process.exit(0); }
if (cmd === "contribute") { contributeCmd(args); process.exit(0); }
fail("unknown command " + cmd + ". Try one of: list, hire, upgrade, contribute", 2);
