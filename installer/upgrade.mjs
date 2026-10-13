/* Safe kit upgrades. Member files and unknown files are never replaced. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const RECEIPT = '.installed.json';
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')); } catch { return null; } }
function parseVersion(version) {
  const m = SEMVER_RE.exec(version);
  if (!m) throw new Error('Invalid semantic version: ' + version);
  const prerelease = m[4] ? m[4].split('.') : [];
  if (prerelease.some(id => /^\d+$/.test(id) && !/^(0|[1-9]\d*)$/.test(id))) throw new Error('Invalid semantic version: ' + version);
  return { core: [BigInt(m[1]), BigInt(m[2]), BigInt(m[3])], prerelease };
}
function compareIdentifier(a, b) {
  const an = /^\d+$/.test(a), bn = /^\d+$/.test(b);
  if (an && bn) { const aa = BigInt(a), bb = BigInt(b); return aa < bb ? -1 : aa > bb ? 1 : 0; }
  if (an !== bn) return an ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}
export function compareVersions(a, b) {
  const left = parseVersion(a), right = parseVersion(b);
  for (let i = 0; i < left.core.length; i++) if (left.core[i] !== right.core[i]) return left.core[i] < right.core[i] ? -1 : 1;
  if (!left.prerelease.length || !right.prerelease.length) return left.prerelease.length ? -1 : right.prerelease.length ? 1 : 0;
  for (let i = 0; i < Math.max(left.prerelease.length, right.prerelease.length); i++) {
    if (i >= left.prerelease.length) return -1;
    if (i >= right.prerelease.length) return 1;
    const result = compareIdentifier(left.prerelease[i], right.prerelease[i]);
    if (result) return result;
  }
  return 0;
}
function readVersion(root) {
  const p = path.join(root, 'VERSION');
  if (!fs.existsSync(p)) throw new Error('Missing VERSION file');
  const version = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').trim();
  parseVersion(version);
  return version;
}
function readOptionalVersion(root) {
  const p = path.join(root, 'VERSION');
  if (!fs.existsSync(p)) return null;
  return readVersion(root);
}
function validRel(p) {
  return typeof p === 'string' && p !== '' && !p.includes('\\') && !p.includes('\0') && !p.includes(':') &&
    !path.posix.isAbsolute(p) && p.split('/').every(x => x && x !== '.' && x !== '..');
}
function globToRe(glob) {
  if (!validRel(glob)) throw new Error('Unsafe manifest pattern');
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    if (glob[i] === '*' && glob[i + 1] === '*') {
      i++;
      if (glob[i + 1] === '/') { re += '(?:.*/)?'; i++; } else re += '.*';
    } else if (glob[i] === '*') re += '[^/]*';
    else if (glob[i] === '?') re += '[^/]';
    else re += glob[i].replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}
export function classify(manifest, rel) {
  const p = rel.split(path.sep).join('/');
  if (!validRel(p)) throw new Error('Unsafe relative path');
  const test = key => (manifest?.files?.[key] || []).some(g => globToRe(g).test(p));
  if (test('member')) return 'member';
  if (test('merge')) return 'merge';
  if (test('kit')) return 'kit';
  return 'unknown';
}
function assertSafe(p) {
  const abs = path.resolve(p);
  let cursor = path.parse(abs).root;
  for (const part of abs.slice(cursor.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw new Error('Symlink paths are not supported');
    // lstat also detects dangling links, for which existsSync returns false.
    try { if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error('Symlink paths are not supported'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return abs;
}
export function walkFiles(root, base = root, acc = []) {
  assertSafe(root);
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules' || e.name === '.upgrade-lock') continue;
    const p = path.join(root, e.name);
    if (e.isSymbolicLink()) throw new Error('Symlink found in kit tree');
    if (e.isDirectory()) walkFiles(p, base, acc);
    else if (e.isFile()) acc.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return acc;
}
export function hashFile(p) { assertSafe(p); return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16); }
function atomicWrite(p, content) {
  assertSafe(p);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp-' + crypto.randomUUID();
  try { fs.writeFileSync(tmp, content, { flag: 'wx', mode: 0o600 }); fs.renameSync(tmp, p); }
  finally { fs.rmSync(tmp, { force: true }); }
}
function verifyManifest(m, slug) {
  if (!m || m.slug !== slug || typeof m.version !== 'string') throw new Error('Manifest identity/version mismatch');
  parseVersion(m.version);
  for (const kind of ['kit', 'merge', 'member']) {
    if (!Array.isArray(m.files?.[kind])) throw new Error('Incomplete file classification');
    m.files[kind].forEach(globToRe);
  }
}
/* Call ONLY directly after copying a pristine kit (the hire command does this).
 * Never re-baseline a running install. A receipt is not a security signature. */
export function writeReceipt(dst, slug, version) {
  const m = readJson(path.join(dst, 'agent.json'));
  verifyManifest(m, slug);
  const p = path.join(dst, RECEIPT);
  if (fs.existsSync(p)) throw new Error('Refusing to re-baseline an existing install');
  const files = {};
  for (const rel of walkFiles(dst)) if (['kit', 'merge'].includes(classify(m, rel))) files[rel] = hashFile(path.join(dst, rel));
  const r = { schema: 'ecom-agent-receipt/2', baseline_kind: 'upstream', slug, version, standard: m.standard ?? null,
    installed_on: new Date().toISOString().slice(0, 10), files, pending: {} };
  atomicWrite(p, JSON.stringify(r, null, 2) + '\n');
  return r;
}
function stageBeside(installed, fresh, rel, version) {
  const data = fs.readFileSync(path.join(fresh, rel));
  let target = path.join(installed, rel + '.new');
  assertSafe(target);
  if (fs.existsSync(target)) {
    if (fs.readFileSync(target).equals(data)) return path.relative(installed, target);
    target += '.' + version + '.' + crypto.createHash('sha256').update(data).digest('hex').slice(0, 12);
    assertSafe(target);
    if (fs.existsSync(target)) {
      if (fs.readFileSync(target).equals(data)) return path.relative(installed, target);
      throw new Error('Conflicting staged upgrade file; nothing will overwrite it');
    }
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data, { flag: 'wx', mode: 0o600 });
  return path.relative(installed, target);
}
export function upgrade({ installed, fresh, slug, apply = false, out = console.log, fail }) {
  let lock;
  try {
    installed = assertSafe(installed); fresh = assertSafe(fresh);
    if (installed === fresh || fresh.startsWith(installed + path.sep) || installed.startsWith(fresh + path.sep)) throw new Error('Fresh and installed trees must be separate');
    if (!fs.existsSync(path.join(installed, 'CONTRACT.md'))) throw new Error('Not an installed agent');
    const m = readJson(path.join(fresh, 'agent.json')); verifyManifest(m, slug);
    const freshVersion = readVersion(fresh);
    if (freshVersion !== m.version) throw new Error('Manifest and VERSION disagree');
    const oldM = readJson(path.join(installed, 'agent.json')) ?? readJson(path.join(installed, 'employee.json'));
    const legacySlug = slug.endsWith('-agent') ? slug.replace(/-agent$/, '-employee') : slug + '-employee';
    if (oldM?.slug && oldM.slug !== slug && oldM.slug !== legacySlug) throw new Error('Installed agent identity mismatch');
    const installedFileVersion = readOptionalVersion(installed);
    if (oldM?.version !== undefined) {
      parseVersion(oldM.version);
      if (installedFileVersion && installedFileVersion !== oldM.version) throw new Error('Installed manifest and VERSION disagree');
    }
    const installedVersion = oldM?.version || installedFileVersion;
    const receipt = readJson(path.join(installed, RECEIPT));
    if (receipt?.slug && receipt.slug !== slug && receipt.slug !== legacySlug) throw new Error('Receipt identity mismatch');
    // Legacy receipts might already contain a user-edited hash from the old bug.
    // Treat them as untrusted; stage changes beside the original rather than guess.
    const trusted = ['ai-employee-receipt/2', 'ecom-agent-receipt/2'].includes(receipt?.schema) && receipt.baseline_kind === 'upstream';
    let latestVersion = installedVersion;
    if (trusted) {
      try {
        if (typeof receipt.version !== 'string') throw new Error('Missing semantic version');
        parseVersion(receipt.version);
      } catch { throw new Error('Invalid trusted receipt version; reconcile the receipt before upgrading'); }
      // Customized metadata may stay at an older version while other kit files
      // have already advanced to the version recorded in this receipt.
      if (!latestVersion || compareVersions(receipt.version, latestVersion) > 0) latestVersion = receipt.version;
    }
    if (latestVersion && compareVersions(freshVersion, latestVersion) < 0) throw new Error('Refusing downgrade from ' + latestVersion + ' to ' + freshVersion);
    if (apply) { const candidate = path.join(installed, '.upgrade-lock'); fs.mkdirSync(candidate, { mode: 0o700 }); lock = candidate; }
    const baseline = trusted ? receipt.files || {} : {};
    const rows = { replace: [], drifted: [], added: [], merge: [], identical: [], unknown: [], member: 0 };
    for (const rel of walkFiles(installed)) if (classify(m, rel) === 'member') rows.member++;
    for (const rel of walkFiles(fresh)) {
      if (rel === RECEIPT) continue;
      const kind = classify(m, rel), target = path.join(installed, rel);
      if (kind === 'member') continue;
      if (kind === 'unknown') { rows.unknown.push(rel); continue; }
      assertSafe(target);
      if (fs.existsSync(target) && !fs.statSync(target).isFile()) throw new Error('A target file is occupied by a directory');
      if (!fs.existsSync(target)) { rows.added.push(rel); continue; }
      const localHash = hashFile(target), newHash = hashFile(path.join(fresh, rel));
      if (localHash === newHash) { rows.identical.push(rel); continue; }
      if (kind === 'merge') { rows.merge.push(rel); continue; }
      if (trusted && own(baseline, rel) && baseline[rel] === localHash) rows.replace.push(rel);
      else rows.drifted.push(rel);
    }
    // Manifest and VERSION are one installed identity. If either needs owner
    // reconciliation, stage both and retain both old upstream baselines.
    const metadata = ['agent.json', 'VERSION'];
    if (metadata.some(rel => rows.drifted.includes(rel) || rows.merge.includes(rel))) {
      if (metadata.some(rel => !['kit', 'merge'].includes(classify(m, rel)))) throw new Error('Metadata reconciliation requires both agent.json and VERSION to be kit files');
      for (const rel of metadata) {
        for (const kind of ['replace', 'added', 'identical', 'merge']) rows[kind] = rows[kind].filter(x => x !== rel);
        if (!rows.drifted.includes(rel)) rows.drifted.push(rel);
      }
    }
    out('Agent: ' + slug + '; available: ' + m.version + '; trusted baseline: ' + trusted);
    out(JSON.stringify(Object.fromEntries(Object.entries(rows).map(([k,v]) => [k, Array.isArray(v) ? v.length : v]))));
    if (!apply) { out('Report only; no files written. Use --apply to apply safe changes.'); return rows; }
    // Preserve OLD upstream baselines for conflicts; never hash the local custom file.
    const nextFiles = { ...baseline }, pending = {};
    for (const rel of rows.replace.concat(rows.added)) {
      atomicWrite(path.join(installed, rel), fs.readFileSync(path.join(fresh, rel)));
      nextFiles[rel] = hashFile(path.join(fresh, rel));
    }
    for (const rel of rows.identical) nextFiles[rel] = hashFile(path.join(fresh, rel));
    for (const rel of rows.drifted.concat(rows.merge)) {
      const staged = stageBeside(installed, fresh, rel, m.version);
      pending[rel] = { upstream_hash: hashFile(path.join(fresh, rel)), version: m.version, staged };
    }
    const next = { schema: 'ecom-agent-receipt/2', baseline_kind: 'upstream', slug, version: m.version,
      standard: m.standard ?? null, installed_on: receipt?.installed_on ?? null,
      checked_on: new Date().toISOString(), files: nextFiles, pending };
    atomicWrite(path.join(installed, RECEIPT), JSON.stringify(next, null, 2) + '\n');
    out('Applied safe files. Conflicts remain beside originals; review pending entries before use.');
    return rows;
  } catch (e) { if (lock) { try { fs.rmdirSync(lock); } catch {} lock = null; } if (fail) { fail(e.message, 5); return null; } throw e; }
  finally { if (lock) { try { fs.rmdirSync(lock); } catch { /* Never recurse into a foreign lock. */ } } }
}
export function contribute({ installed, slug, since, out = console.log, fail }) {
  const p = path.join(installed, 'improvements', 'CHANGELOG.md');
  if (!fs.existsSync(p)) { if (fail) return fail('No improvements changelog yet', 4); throw new Error('No improvements changelog yet'); }
  if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error('since must use YYYY-MM-DD');
  const entries = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(l => /^\d{4}-\d{2}-\d{2}\s*\|/.test(l) && (!since || l.slice(0, 10) >= since));
  out('LOCAL DRAFT ONLY. Manually redact customer data and credentials before sharing. This command does not redact.');
  out('Field report: ' + slug + '; repairs: ' + entries.length);
  entries.forEach(out);
}
