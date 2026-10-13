#!/usr/bin/env node
// Repository-specific checks for scheduled skills, whose paths resolve from the kit root.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const directories = dir => fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();

export function checkRoutine({ id, text, schedule, manifestIds, launcher, exists }) {
  const errors = [];
  const check = (ok, message) => { if (!ok) errors.push(message); };
  const front = /^---\nname: ([^\n]+)\ndescription: ([^\n]+)\nmetadata:\n  internal: true\n---\n/.exec(text);
  check(front && front[1] === id, 'frontmatter name must match the routine folder and remain internal');
  if (front) {
    const description = front[2].replace(/^(["'])(.*)\1$/, '$2');
    check(description.trim().length > 0 && description.length <= 1024, 'description must contain 1 to 1024 characters');
  }
  check(manifestIds.filter(value => value === id).length === 1, 'manifest must register the routine exactly once');
  const rows = schedule.split('\n').filter(line => line.startsWith('|') && line.split('|').length === 10).map(line => line.split('|')[1].trim().replaceAll('`', ''));
  check(rows.filter(value => value === id).length === 1, 'SCHEDULE.md must contain exactly one routine row');
  check(new RegExp('run-routine\\.mjs"?\\s+' + id + '(?:\\s|$)').test(launcher), 'launcher must wrap the named routine with run-routine.mjs');

  const corrections = text.indexOf('\n## Corrections\n');
  check(corrections >= 0, 'member Corrections section is required');
  const body = corrections < 0 ? text : text.slice(0, corrections);
  check(!/\n## (?:SEO\/AEO work|Improving this routine|The one push)\n/.test(text.slice(corrections)), 'shipped instructions must precede member Corrections');
  const workStart = body.search(/\n## (?:What you own|Step 0|0\. Begin)/);
  const opening = body.slice(0, workStart < 0 ? body.length : workStart);
  for (const name of ['RELEASES.md', 'POD.md', 'DROPSHIP.md', 'scripts/run-routine.mjs']) {
    check(opening.includes(name), 'opening preflight must name ' + name);
  }
  check(!/Two instances[^.\n]*cannot both proceed/.test(body), 'state rename must not claim exclusive execution');
  check(!/is the job, not a send/.test(body), 'publishing must not bypass the release gate');
  check(!/If this routine concludes[^.\n]*, change its (?:own )?row/.test(body), 'routine self-improvement must not change its schedule');
  check(!/\*\*Its own row in `SCHEDULE\.md` is a narrow exception/.test(body), 'routine self-improvement must not own schedule windows');

  // Only concrete bundled script references are checked. Member data and output paths need not exist yet.
  // A scripts/ segment rooted under a placeholder that is not the kit root, for
  // example <pod_workbench>/scripts/cli.mjs, names another install's file and is
  // not a bundled resource.
  const scripts = new Set();
  for (const m of body.matchAll(/\b([^\s"'`/]+\/)?scripts\/([a-z0-9-]+\.mjs)\b/g)) {
    if (m[1] !== undefined && !m[1].endsWith('ROOT»/')) continue;
    scripts.add('scripts/' + m[2]);
  }
  for (const script of scripts) {
    // This optional scanner has an explicit bundled copy-check fallback in web-site-sweep.
    if (script === 'scripts/secret-scan.mjs' && body.includes('scripts/copy-check.mjs --secrets-only')) continue;
    check(exists(script), 'missing kit resource: ' + script);
  }
  return errors;
}

export function checkSeoPublish(text) {
  const errors = [];
  const check = (ok, message) => { if (!ok) errors.push(message); };
  check(text.includes('state/publish-attempts.jsonl'), 'SEO publish routine must own the publish-attempts ledger');
  check(text.includes('active_publish_attempt'), 'SEO publish routine must persist the active attempt id');
  check(text.includes('`pending`') && text.includes('`confirmed`') && text.includes('`uncertain`'), 'SEO publish routine must define pending, confirmed and uncertain attempt outcomes');
  check(text.includes('`reconciled-not-published`'), 'SEO publish routine must require explicit reconciliation before a new press');
  check(/`confirmed` row with no matching `published` line/i.test(text), 'SEO publish routine must resume a confirmed attempt without pressing again');
  check(/do not press anything/i.test(text), 'SEO publish routine must prohibit a second press after an ambiguous outcome');
  return errors;
}

export function audit(root = ROOT) {
  const errors = [];
  let routines = 0;
  const inventory = [];
  for (const slug of directories(path.join(root, 'agents'))) {
    const kit = path.join(root, 'agents', slug);
    const manifest = JSON.parse(read(path.join(kit, 'agent.json')));
    const version = read(path.join(kit, 'VERSION')).trim();
    if (manifest.version !== version) errors.push(slug + ': manifest version differs from VERSION');
    const schedule = read(path.join(kit, 'SCHEDULE.md'));
    const ids = directories(path.join(kit, 'routines'));
    const manifestIds = manifest.routines.map(r => r.id);
    for (const id of manifestIds) if (!ids.includes(id)) errors.push(slug + ': missing routine folder ' + id);
    let bytes = 0;
    for (const id of ids) {
      const text = read(path.join(kit, 'routines', id, 'SKILL.md'));
      const launcherPath = path.join(kit, 'run', id + '.cmd.example');
      const launcher = fs.existsSync(launcherPath) ? read(launcherPath) : '';
      bytes += Buffer.byteLength(text);
      routines++;
      for (const error of checkRoutine({ id, text, schedule, manifestIds, launcher, exists: rel => fs.existsSync(path.join(kit, rel)) })) errors.push(slug + '/' + id + ': ' + error);
    }
    if (slug === 'seo-agent') {
      const publish = read(path.join(kit, 'routines', 'seo-publish-run', 'SKILL.md'));
      for (const error of checkSeoPublish(publish)) errors.push(slug + '/seo-publish-run: ' + error);
    }
    inventory.push({ slug, routines: ids.length, bytes });
  }
  return { routines, inventory, errors };
}

function selftest() {
  const sample = {
    id: 'sample-run',
    text: '---\nname: sample-run\ndescription: Test routine\nmetadata:\n  internal: true\n---\n# Test\n\nRead RELEASES.md, POD.md and DROPSHIP.md. Use scripts/run-routine.mjs.\n\n## Step 0\n\nWork.\n\n## Corrections\n\nMember text.\n',
    schedule: '| `sample-run` | `mon-fri` | 08:00 | 07:00 | 09:00 | YYYY-MM-DD | 10 min | never |', manifestIds: ['sample-run'],
    launcher: 'node "kit/scripts/run-routine.mjs" sample-run -- node harness.mjs', exists: () => true,
  };
  let checks = 0;
  const expect = (patch, pattern) => {
    const errors = checkRoutine({ ...sample, ...patch });
    if (pattern) assert(errors.some(error => pattern.test(error)), JSON.stringify(errors));
    else assert.deepEqual(errors, []);
    checks++;
  };
  expect({});
  expect({ manifestIds: [] }, /manifest/);
  expect({ manifestIds: ['sample-run', 'sample-run'] }, /manifest/);
  expect({ schedule: '' }, /SCHEDULE/);
  expect({ schedule: sample.schedule + '\n' + sample.schedule }, /SCHEDULE/);
  expect({ launcher: 'node scripts/guard.mjs sample-run' }, /launcher/);
  expect({ text: sample.text.replace('name: sample-run', 'name: wrong') }, /frontmatter/);
  expect({ text: sample.text.replace('Test routine', 'a'.repeat(1025)) }, /description/);
  expect({ exists: () => false }, /missing kit resource/);
  expect({ text: sample.text.replace('Work.', 'Run node "<pod_workbench>/scripts/cli.mjs" print-qa a.png spec.json.'), exists: (rel) => rel !== 'scripts/cli.mjs' });
  expect({ text: sample.text + '\n## SEO/AEO work\n\nShipped instructions.\n' }, /precede member/);
  expect({ text: sample.text + '\n## Improving this routine\n\nShipped instructions.\n' }, /precede member/);
  expect({ text: sample.text + '\n## The one push\n\nShipped instructions.\n' }, /precede member/);
  for (const name of ['RELEASES.md', 'POD.md', 'DROPSHIP.md', 'scripts/run-routine.mjs']) {
    expect({ text: sample.text.replace(name, '') + '\n' + name }, /opening preflight/);
  }
  expect({ text: sample.text.replace('Work.', 'Two instances starting in the same second cannot both proceed.') }, /exclusive execution/);
  expect({ text: sample.text.replace('Work.', 'Publishing is the job, not a send.') }, /release gate/);
  expect({ text: sample.text.replace('Work.', 'If this routine concludes its window is wrong, change its own row.') }, /must not change its schedule/);
  expect({ text: sample.text.replace('Work.', '**Its own row in `SCHEDULE.md` is a narrow exception.**') }, /must not own schedule windows/);
  expect({ text: sample.text.replace('## Corrections', '## Other') }, /Corrections section/);
  const seoSample = sample.text + '\nstate/publish-attempts.jsonl active_publish_attempt `pending` `confirmed` `uncertain` `reconciled-not-published` `confirmed` row with no matching `published` line. Do not press anything again.\n';
  assert.deepEqual(checkSeoPublish(seoSample), []);
  assert(checkSeoPublish(sample.text).some(error => /publish-attempts/.test(error)));
  checks += 2;
  console.log('skill-check: selftest PASS (' + checks + ' checks)');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--selftest')) selftest();
  else {
    const result = audit();
    if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
    else {
      for (const error of result.errors) console.error('  FAIL  ' + error);
      console.log('skill-check: ' + (result.errors.length ? 'FAIL' : 'PASS') + ' (' + result.routines + ' routines, ' + result.errors.length + ' findings)');
    }
    process.exitCode = result.errors.length ? 1 : 0;
  }
}
