// Scratch-project helpers for the P002 conformance slice.
// Independent of framework/engine/**: registry text, entity text and the "first canonical commit"
// oracle are produced here from the spec/errata (E-0009, E-0011, E-0012), never by the engine.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
// KF_P002_ENGINE_URL lets a reviewer point the slice at another module that honors the PLAN API contract.
export const ENGINE_URL = process.env.KF_P002_ENGINE_URL
  ?? pathToFileURL(path.join(REPO_ROOT, 'framework', 'engine', 'id-registry.mjs')).href;
export const CHILD_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'child-allocator.mjs');
export const HOLDER_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'child-lock-holder.mjs');
export const REGISTRY_REL = '.kf/id-registry.yaml';

// ---------------------------------------------------------------- temporary directories
const created = [];

export async function tmpProject(label = 'p') {
  const base = await fs.realpath(os.tmpdir());
  const dir = await fs.mkdtemp(path.join(base, `kf-p002-${label}-`));
  created.push(dir);
  return dir;
}

export async function cleanupTemp() {
  for (const dir of created.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }).catch(() => {});
  }
}

// Git variables that would redirect a scratch repository to the caller's repository (audit R01 A-07).
const INHERITED_GIT_VARS = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_NO_REPLACE_OBJECTS', 'GIT_REPLACE_REF_BASE'];

export function run(cmd, args, { cwd, env } = {}) {
  const childEnv = { ...process.env, ...env };
  for (const name of INHERITED_GIT_VARS) delete childEnv[name];
  return new Promise((resolve, reject) => {
    execFile(cmd, args, {
      cwd, env: childEnv, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true,
    }, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(new Error(`${cmd} ${args.join(' ')} failed: ${stderr || error.message}`), { stdout, stderr }));
      } else {
        resolve(stdout);
      }
    });
  });
}

export function runChild(args, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [CHILD_SCRIPT, ...args], {
      encoding: 'utf8', timeout: timeoutMs, windowsHide: true,
    }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(new Error(`child failed: ${stderr || error.message}`), { stdout, stderr }));
      else resolve(stdout);
    });
  });
}

/**
 * F-B5: a child process that takes the registry lock through the engine and then hangs inside the registry
 * rename (see child-lock-holder.mjs). `ready` resolves once the lock is held; `exited` after the child is gone.
 */
export function spawnLockHolder(projectRoot, readyTimeoutMs = 60000) {
  const child = spawn(process.execPath, [HOLDER_SCRIPT, projectRoot], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let out = '';
  let err = '';
  child.stderr.on('data', (chunk) => { err += chunk; });
  const exited = new Promise((resolve) => { child.once('exit', resolve); });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`lock holder never reported the lock; stderr: ${err}`)), readyTimeoutMs);
    child.stdout.on('data', (chunk) => {
      out += chunk;
      if (out.includes('locked')) { clearTimeout(timer); resolve(); }
    });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`lock holder exited early (${code}); stderr: ${err}`)); });
  });
  ready.catch(() => {});
  return { child, ready, exited };
}

/** PID of a process that has certainly exited (spawn, wait). */
export async function exitedPid() {
  const child = spawn(process.execPath, ['-e', '0'], { stdio: 'ignore', windowsHide: true });
  const { pid } = child;
  await new Promise((resolve, reject) => {
    child.once('exit', resolve);
    child.once('error', reject);
  });
  return pid;
}

// ---------------------------------------------------------------- Git scratch repositories
const GIT_IDENTITY = {
  GIT_AUTHOR_NAME: 'KF Conformance',
  GIT_AUTHOR_EMAIL: 'conformance@kf.invalid',
  GIT_COMMITTER_NAME: 'KF Conformance',
  GIT_COMMITTER_EMAIL: 'conformance@kf.invalid',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_TERMINAL_PROMPT: '0',
  LC_ALL: 'C',
};
const EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0);

export class Repo {
  constructor(dir) {
    this.dir = dir;
    this.tick = 0;
  }

  static async create(label) {
    const repo = new Repo(await tmpProject(label));
    await repo.git('init', '-q', '-b', 'main');
    await repo.git('config', 'user.name', GIT_IDENTITY.GIT_AUTHOR_NAME);
    await repo.git('config', 'user.email', GIT_IDENTITY.GIT_AUTHOR_EMAIL);
    await repo.git('config', 'core.autocrlf', 'false');
    await repo.git('config', 'core.eol', 'lf'); // `* text=auto` would otherwise check out CRLF on Windows
    await repo.git('config', 'core.safecrlf', 'false');
    await repo.git('config', 'commit.gpgsign', 'false');
    await repo.git('config', 'core.longpaths', 'true');
    return repo;
  }

  /** Fixed identity and a fixed, monotonically advancing date: SHAs are reproducible. */
  env() {
    const when = new Date(EPOCH + this.tick * 60000).toISOString();
    return { ...GIT_IDENTITY, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when };
  }

  async git(...args) {
    const out = await run('git', args, { cwd: this.dir, env: this.env() });
    return out.replace(/\r?\n$/, '');
  }

  async head() { return this.git('rev-parse', 'HEAD'); }

  async commit(message) {
    this.tick += 1;
    await this.git('add', '-A');
    await this.git('commit', '-q', '--allow-empty', '-m', message);
    return this.head();
  }

  async checkout(branch, { create = false } = {}) {
    await this.git('checkout', '-q', ...(create ? ['-b'] : []), branch);
  }

  async mergeNoFf(branch, message) {
    this.tick += 1;
    await this.git('merge', '--no-ff', '-q', '-m', message, branch);
    return this.head();
  }

  async mergeFastForward(branch) {
    this.tick += 1;
    await this.git('merge', '--ff-only', '-q', branch);
    return this.head();
  }

  async mergeSquash(branch, message) {
    this.tick += 1;
    await this.git('merge', '--squash', '-q', branch);
    return this.commit(message);
  }

  /** `git rev-list --first-parent --reverse <branch>`: full SHAs, oldest first. */
  async firstParent(branch) {
    const out = await this.git('rev-list', '--first-parent', '--reverse', branch);
    return out === '' ? [] : out.split('\n');
  }

  abs(rel) { return path.join(this.dir, ...rel.split('/')); }

  async write(rel, text) {
    await fs.mkdir(path.dirname(this.abs(rel)), { recursive: true });
    await fs.writeFile(this.abs(rel), text);
  }

  async read(rel) { return fs.readFile(this.abs(rel), 'utf8'); }

  async remove(rel) { await fs.rm(this.abs(rel), { force: true }); }
}

/**
 * Independent oracle for E-0009: the first SHA of `git rev-list --first-parent --reverse <branch>` whose
 * tree holds <repoPath> parsing to a YAML mapping whose `id` equals <id>. null when there is none.
 */
export async function oracleFirstCanonical(repo, branch, repoPath, id) {
  for (const sha of await repo.firstParent(branch)) {
    let text;
    try {
      text = await repo.git('show', `${sha}:${repoPath}`);
    } catch {
      continue;
    }
    let doc;
    try {
      doc = YAML.parse(text);
    } catch {
      continue;
    }
    if (doc && typeof doc === 'object' && !Array.isArray(doc) && doc.id === id) return sha;
  }
  return null;
}

// ---------------------------------------------------------------- registry text (E-0012, E-0015 D-05)
export const HEADER = 'schema_version: 2.1\nevents:\n';
const KEY_ORDER = {
  allocate: ['op', 'id', 'id_status', 'path'],
  promote: ['op', 'id', 'path', 'commit'],
  alias: ['op', 'from', 'to', 'commit'],
  move: ['op', 'id', 'from', 'to'],
};

export function scalar(value) {
  return /^[A-Za-z][A-Za-z0-9_./-]*$/.test(value) ? value : JSON.stringify(value);
}

export function eventLine(event) {
  return `  - {${KEY_ORDER[event.op].map((key) => `${key}: ${scalar(event[key])}`).join(', ')}}`;
}

export function registryText(events) {
  return HEADER + events.map((event) => `${eventLine(event)}\n`).join('');
}

export const alloc = (id, p) => ({ op: 'allocate', id, id_status: 'provisional', path: p });
export const promo = (id, p, commit) => ({ op: 'promote', id, path: p, commit });
export const aliasEv = (from, to, commit) => ({ op: 'alias', from, to, commit });
export const moveEv = (id, from, to) => ({ op: 'move', id, from, to });
export const FAKE_SHA = { a: 'a'.repeat(40), b: 'b'.repeat(40), c: 'c'.repeat(40) };

export async function writeRegistry(dir, text) {
  await fs.mkdir(path.join(dir, '.kf'), { recursive: true });
  await fs.writeFile(path.join(dir, ...REGISTRY_REL.split('/')), text);
}

export async function registryBytes(dir) {
  return fs.readFile(path.join(dir, ...REGISTRY_REL.split('/')), 'utf8');
}

export function parseRegistryText(text) {
  const doc = YAML.parse(text);
  return { schema_version: doc.schema_version, events: doc.events ?? [] };
}

export async function registryEvents(dir) {
  return parseRegistryText(await registryBytes(dir)).events;
}

/** Physical lines of the registry that carry one event (`- {` after indentation). */
export function eventLines(text) {
  return text.split('\n').filter((line) => /^\s*- \{/.test(line));
}

// ---------------------------------------------------------------- entity files (E-0011)
export function entityText({ id, status = 'provisional', name = 'Label', alias = null, type = 'business-rule' }) {
  return [
    '# keep me',
    'schema_version: 2.1',
    `id: ${id}`,
    `id_status: ${status}`,
    ...(alias ? [`id_alias: [${alias.join(', ')}]`] : []),
    `type: ${type}`,
    `name: ${name}`,
    '',
  ].join('\n');
}

function nonIdentityLines(text) {
  const kept = [];
  let inAlias = false;
  for (const line of text.split('\n')) {
    if (/^id_alias:/.test(line)) { inAlias = true; continue; }
    if (inAlias && /^(\s+|- )/.test(line)) continue;
    inAlias = false;
    if (/^(id|id_status):/.test(line)) continue;
    kept.push(line);
  }
  return kept;
}

/**
 * V-37 / E-0011: only id, id_status and id_alias change; every other key, value, comment and the key
 * order is preserved; new keys sit directly after id_status; LF only.
 */
export function assertProjection(text, original, { id, id_status: status, id_alias: alias }) {
  assert.ok(!text.includes('\r'), 'entity output uses LF only');
  const doc = YAML.parse(text);
  const before = YAML.parse(original);
  assert.equal(doc.id, id, 'id');
  assert.equal(doc.id_status, status, 'id_status');
  if (alias === undefined) {
    // not asserted (pending decision)
  } else if (alias === null) {
    assert.ok(!('id_alias' in doc), 'id_alias omitted when empty');
  } else {
    assert.deepEqual(doc.id_alias, alias, 'id_alias');
  }
  const strip = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !['id', 'id_status', 'id_alias'].includes(k)));
  assert.deepEqual(strip(doc), strip(before), 'other keys unchanged');
  const keys = Object.keys(doc);
  assert.deepEqual(keys.filter((k) => !['id', 'id_status', 'id_alias'].includes(k)),
    Object.keys(before).filter((k) => !['id', 'id_status', 'id_alias'].includes(k)), 'key order preserved');
  assert.equal(keys.indexOf('id_status'), keys.indexOf('id') + 1, 'id_status directly after id');
  if ('id_alias' in doc) assert.equal(keys.indexOf('id_alias'), keys.indexOf('id_status') + 1, 'id_alias directly after id_status');
  assert.deepEqual(nonIdentityLines(text), nonIdentityLines(original), 'comments and other lines byte-identical');
  assert.equal(text.split('\n')[0], '# keep me', 'comment preserved');
}

// ---------------------------------------------------------------- tree snapshots
export async function snapshot(dir) {
  const out = {};
  async function walk(abs, rel) {
    const entries = await fs.readdir(abs, { withFileTypes: true });
    for (const entry of entries.sort((x, y) => (x.name < y.name ? -1 : 1))) {
      if (rel === '' && entry.name === '.git') continue;
      const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        out[`${childRel}/`] = '';
        await walk(path.join(abs, entry.name), childRel);
      } else {
        out[childRel] = await fs.readFile(path.join(abs, entry.name), 'latin1');
      }
    }
  }
  await walk(dir, '');
  return out;
}

export async function kfEntries(dir) {
  try {
    return (await fs.readdir(path.join(dir, '.kf'))).sort();
  } catch {
    return [];
  }
}

export const lockLeftovers = async (dir) => (await kfEntries(dir)).filter((name) => /\.lock/.test(name));
export const tmpLeftovers = async (dir) => (await kfEntries(dir)).filter((name) => /\.tmp$/.test(name));

// ---------------------------------------------------------------- locks (E-0013)
export const LOCK_REL = '.kf/id-registry.lock';

/** Plant a lock directory with an owner file (object), a raw owner string, or no owner (null). */
export async function plantLock(dir, { owner = null, rawOwner = null, ageMs = 0 } = {}) {
  const lock = path.join(dir, ...LOCK_REL.split('/'));
  await fs.mkdir(lock, { recursive: true });
  if (owner) await fs.writeFile(path.join(lock, 'owner.json'), JSON.stringify(owner));
  if (rawOwner !== null) await fs.writeFile(path.join(lock, 'owner.json'), rawOwner);
  if (ageMs > 0) {
    const then = new Date(Date.now() - ageMs);
    await fs.utimes(lock, then, then);
  }
  return lock;
}

export const isoAgo = (ms) => new Date(Date.now() - ms).toISOString();

// ---------------------------------------------------------------- paths used by the scenarios
export const A = 'knowledge/business-rules/alpha/rule.yaml';
export const B = 'knowledge/business-rules/beta/rule.yaml';
export const G = 'knowledge/business-rules/gamma/rule.yaml';
export const SEED_PATH = 'knowledge/capabilities/seed/capability.yaml';
export const br = (dir) => `knowledge/business-rules/${dir}/rule.yaml`;

export const GITATTRIBUTES = '* text=auto\n\n.kf/id-registry.yaml merge=union\n';
export const GITIGNORE = '.kf/*.lock/\n.kf/id-registry.yaml.*.tmp\n';
