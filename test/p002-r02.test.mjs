// P002 remediation R02 tests (implementer-owned): audit R02 F01-F05. Titles start with the clause or errata entry
// exercised: E-0029 (promotion only at the canonical tip), E-0035 (headCommit, entities_skipped), E-0034 (replay
// position), E-0009 / E-0024 (object-read failure is not "absent"), E-0011 (no lost concurrent edit), E-0024 (3).
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { appendFile, chmod, mkdtemp, mkdir, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { promisify } from 'node:util';
import YAML from 'yaml';
import { parseRegistryText } from '../framework/engine/id-registry-codec.mjs';
import { createGitHistoryReader } from '../framework/engine/id-registry-git.mjs';
import { atomicWrite } from '../framework/engine/id-registry-lock.mjs';
import { allocateId, promoteIds, readIdRegistry } from '../framework/engine/id-registry.mjs';

const exec = promisify(execFile);
const HEADER = 'schema_version: 2.1\nevents:\n';
const REGISTRY = '.kf/id-registry.yaml';
const A = 'knowledge/business-rules/alpha/rule.yaml';
const B = 'knowledge/business-rules/beta/rule.yaml';
const G = 'knowledge/business-rules/gamma/rule.yaml';
const D = 'knowledge/business-rules/delta/rule.yaml';
const Sa = 'a'.repeat(40);
const Sb = 'b'.repeat(40);
const EDIT_LINE = 'reviewer_note: edited while promotion ran';

const created = [];
after(async () => {
  for (const dir of created.splice(0)) await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }).catch(() => {});
});
async function tmp(label) {
  const dir = await mkdtemp(path.join(await realpath(os.tmpdir()), `kf-r02-${label}-`));
  created.push(dir);
  return dir;
}
const abs = (dir, rel) => path.join(dir, ...rel.split('/'));
const put = async (dir, rel, text) => { await mkdir(path.dirname(abs(dir, rel)), { recursive: true }); await writeFile(abs(dir, rel), text); };
const get = (dir, rel) => readFile(abs(dir, rel), 'utf8');

const alloc = (id, p) => ({ op: 'allocate', id, id_status: 'provisional', path: p });
const promo = (id, p, commit) => ({ op: 'promote', id, path: p, commit });
const aliasEv = (from, to, commit) => ({ op: 'alias', from, to, commit });
const moveEv = (id, from, to) => ({ op: 'move', id, from, to });
const line = (e) => `  - {${Object.entries(e).map(([k, v]) => `${k}: ${v}`).join(', ')}}\n`;
const registryText = (events) => HEADER + events.map(line).join('');
const entity = (id, status = 'provisional', extra = '') =>
  `# keep me\nschema_version: 2.1\nid: ${id}\nid_status: ${status}\n${extra}type: business-rule\nname: Label\n`;
const invalidRegistry = (events) => assert.throws(() => parseRegistryText(registryText(events)), (e) => e.code === 'INVALID_REGISTRY');
const validRegistry = (events) => parseRegistryText(registryText(events));

async function assertCode(promise, codes) {
  let caught = null;
  try { await promise; } catch (error) { caught = error; }
  assert.ok(caught, `expected rejection ${codes}`);
  assert.ok([codes].flat().includes(caught.code), `${caught.code}: ${caught.message}`);
  return caught;
}

let tick = 0;
function gitEnv() {
  const when = new Date(Date.UTC(2026, 0, 1) + (tick += 1) * 60000).toISOString();
  return {
    ...process.env, GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@t.invalid', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@t.invalid',
    GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when, GIT_CONFIG_NOSYSTEM: '1', LC_ALL: 'C',
  };
}
const git = async (dir, ...args) => (await exec('git', args, { cwd: dir, env: gitEnv() })).stdout.replace(/\r?\n$/, '');
const commit = async (dir, message) => { await git(dir, 'add', '-A'); await git(dir, 'commit', '-q', '--allow-empty', '-m', message); return git(dir, 'rev-parse', 'HEAD'); };
const promote = (dir, extra = {}) => promoteIds(dir, { canonicalBranch: 'main', ...extra });

async function repo(label) {
  const dir = await tmp(label);
  await git(dir, 'init', '-q', '-b', 'main');
  for (const [key, value] of [['core.autocrlf', 'false'], ['core.eol', 'lf'], ['commit.gpgsign', 'false'], ['user.name', 'T'], ['user.email', 't@t.invalid']]) {
    await git(dir, 'config', key, value);
  }
  await put(dir, '.gitattributes', '.kf/id-registry.yaml merge=union\n');
  await put(dir, '.gitignore', '.kf/*.lock/\n.kf/id-registry.yaml.*.tmp\n');
  await put(dir, REGISTRY, HEADER);
  await commit(dir, 'B0');
  return dir;
}

/** main has A (BR-0001, provisional) merged from `feature`; returns the merge commit M. */
async function mergedRepo(label) {
  const dir = await repo(label);
  await git(dir, 'checkout', '-q', '-b', 'feature');
  const got = await allocateId(dir, 'BR', A);
  await put(dir, A, entity(got.id));
  await commit(dir, 'feature');
  await git(dir, 'checkout', '-q', 'main');
  await git(dir, 'merge', '--no-ff', '-q', '-m', 'M', 'feature');
  return { dir, M: await git(dir, 'rev-parse', 'HEAD') };
}

async function snapshot(dir) {
  const out = {};
  const walk = async (rel) => {
    for (const entry of await readdir(abs(dir, rel), { withFileTypes: true }).catch(() => [])) {
      if (entry.name === '.git') continue;
      const child = rel === '.' ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) { out[`${child}/`] = ''; await walk(child); } else out[child] = await get(dir, child);
    }
  };
  await walk('.');
  return out;
}

// ------------------------------------------------------------------ E-0029, E-0035 (2): promotion only at the canonical tip
test('E-0029: a feature-branch checkout skips promotion with not_canonical_tip and writes nothing; the tip checkout promotes', async () => {
  const { dir, M } = await mergedRepo('tip');
  await git(dir, 'checkout', '-q', 'feature');
  await put(dir, 'notes/later.txt', 'more feature work\n');
  await commit(dir, 'later on feature');
  const before = await snapshot(dir);
  const skipped = await promote(dir);
  assert.equal(skipped.skipped, 'not_canonical_tip');
  assert.equal(skipped.canonical_branch, 'main');
  assert.deepEqual([skipped.promoted, skipped.renumbered, skipped.entities_rewritten, skipped.entities_skipped, skipped.diagnostics], [[], [], [], [], []]);
  assert.deepEqual(await snapshot(dir), before, 'registry, entities and .kf are byte-identical');
  await git(dir, 'checkout', '-q', 'main');
  const done = await promote(dir);
  assert.equal(done.skipped, undefined, 'near-miss: the tip checkout is not a skip');
  assert.deepEqual(done.promoted, [{ id: 'BR-0001', path: A, commit: M }]);
});

test('E-0029: a detached HEAD at an older canonical commit skips; a detached HEAD at the tip promotes', async () => {
  const { dir, M } = await mergedRepo('detached');
  await put(dir, 'notes/after.txt', 'after the merge\n');
  const tip = await commit(dir, 'after merge');
  await git(dir, 'checkout', '-q', '--detach', M);
  const before = await snapshot(dir);
  assert.equal((await promote(dir)).skipped, 'not_canonical_tip');
  assert.deepEqual(await snapshot(dir), before);
  await git(dir, 'checkout', '-q', '--detach', tip);
  const done = await promote(dir);
  assert.equal(done.skipped, undefined);
  assert.deepEqual(done.promoted, [{ id: 'BR-0001', path: A, commit: M }]);
});

test('E-0029: promotion on a feature checkout and then on main never leaves two promote facts after a merge (audit R02 F01)', async () => {
  const dir = await repo('merge');
  // f2 allocates BR-0001 for B only; main holds A as BR-0001 (conflicting provisional IDs, as two branches would)
  await git(dir, 'checkout', '-q', '-b', 'f1');
  await put(dir, REGISTRY, `${HEADER}${line(alloc('BR-0001', A))}`);
  await put(dir, A, entity('BR-0001'));
  await commit(dir, 'f1');
  await git(dir, 'checkout', '-q', 'main');
  await git(dir, 'checkout', '-q', '-b', 'f2');
  await put(dir, REGISTRY, `${HEADER}${line(alloc('BR-0001', B))}`);
  await put(dir, B, entity('BR-0001'));
  await commit(dir, 'f2');
  await git(dir, 'checkout', '-q', 'main');
  await git(dir, 'merge', '--no-ff', '-q', '-m', 'M1', 'f1');
  await git(dir, 'checkout', '-q', 'f2');
  const skipped = await promote(dir);
  assert.equal(skipped.skipped, 'not_canonical_tip');
  assert.equal((await readIdRegistry(dir)).events.some((e) => e.op === 'promote'), false, 'f2 recorded no promote');
  await git(dir, 'checkout', '-q', 'main');
  const onMain = await promote(dir);
  assert.equal(onMain.promoted.length, 1);
  await commit(dir, 'promotion on main');
  await git(dir, 'merge', '--no-ff', '-q', '-m', 'M2', 'f2');
  const events = (await readIdRegistry(dir)).events; // used to throw INVALID_REGISTRY "promoted twice"
  assert.equal(events.filter((e) => e.op === 'promote' && e.id === 'BR-0001').length, 1);
});

test('E-0035 (2): the default reader provides headCommit() equal to HEAD; an injected reader without headCommit is at the tip', async () => {
  const { dir, M } = await mergedRepo('head');
  const reader = createGitHistoryReader(dir);
  assert.equal(await reader.headCommit(), M);
  await git(dir, 'checkout', '-q', 'feature');
  assert.equal(await reader.headCommit(), await git(dir, 'rev-parse', 'HEAD'));
  assert.notEqual(await reader.headCommit(), M);
  await git(dir, 'checkout', '-q', 'main');
  const noHead = { firstParentCommits: (b) => reader.firstParentCommits(b), readFile: (c, p) => reader.readFile(c, p) };
  assert.equal(typeof noHead.headCommit, 'undefined');
  const done = await promote(dir, { history: noHead });
  assert.equal(done.skipped, undefined);
  assert.equal(done.promoted.length, 1);
});

test('E-0035 (2): an injected headCommit that differs from the last first-parent commit skips; equal promotes; a malformed one is GIT_FAILED', async () => {
  const sha = (n) => `${'c'.repeat(39)}${n}`;
  const reader = (head) => ({
    firstParentCommits: async () => [sha(1), sha(2), sha(3)],
    headCommit: async () => head,
    readFile: async (commit, p) => (p === A && commit >= sha(2) ? entity('BR-0001') : null),
  });
  const dir = await tmp('inject');
  await put(dir, REGISTRY, registryText([alloc('BR-0001', A)]));
  await put(dir, A, entity('BR-0001'));
  const before = await snapshot(dir);
  for (const head of [sha(2), sha(9)]) {
    assert.equal((await promote(dir, { history: reader(head) })).skipped, 'not_canonical_tip');
    assert.deepEqual(await snapshot(dir), before);
  }
  await assertCode(promote(dir, { history: reader('HEAD') }), 'GIT_FAILED');
  assert.deepEqual(await snapshot(dir), before);
  const done = await promote(dir, { history: reader(sha(3)) });
  assert.deepEqual(done.promoted, [{ id: 'BR-0001', path: A, commit: sha(2) }]);
});

// ------------------------------------------------------------------ E-0009, E-0024 (4): an object-read failure is not "path absent"
test('E-0009: the default reader fails closed when a blob cannot be read; absent paths and special characters still read as null', async () => {
  const { dir, M } = await mergedRepo('blob');
  const reader = createGitHistoryReader(dir);
  const text = await reader.readFile(M, A);
  assert.match(text, /^# keep me/);
  assert.equal(await reader.readFile(M, 'no/such/file.yaml'), null, 'path absent');
  assert.equal(await reader.readFile(M, 'knowledge'), null, 'a directory is not a file');
  assert.equal(await reader.readFile(M, `${A}/below.yaml`), null, 'below a file');
  assert.equal(await reader.readFile(M, ':(glob)knowledge/**'), null, 'pathspec magic is literal');
  assert.equal(await reader.readFile(M, 'knowledge/*/alpha/rule.yaml'), null, 'globs are literal');
  assert.equal(await reader.readFile(M, 'a[1].yaml'), null);
  const blob = await git(dir, 'rev-parse', `${M}:${A}`);
  const loose = path.join(dir, '.git', 'objects', blob.slice(0, 2), blob.slice(2));
  await chmod(loose, 0o666).catch(() => {});
  await rm(loose, { force: true });
  await assertCode(reader.readFile(M, A), ['GIT_FAILED', 'HISTORY_INCOMPLETE']);
  assert.equal(await reader.readFile(M, 'no/such/file.yaml'), null, 'near-miss: absent paths are unaffected');
  await assertCode(reader.readFile('f'.repeat(40), A), 'HISTORY_INCOMPLETE');
});

test('E-0009: promoteIds at the tip fails closed on an unreadable blob and mutates nothing (audit R02 F02)', async () => {
  const { dir, M } = await mergedRepo('closed');
  const blob = await git(dir, 'rev-parse', `${M}:${A}`);
  const loose = path.join(dir, '.git', 'objects', blob.slice(0, 2), blob.slice(2));
  await chmod(loose, 0o666).catch(() => {});
  await rm(loose, { force: true });
  const before = await snapshot(dir);
  await assertCode(promote(dir), ['GIT_FAILED', 'HISTORY_INCOMPLETE']);
  assert.deepEqual(await snapshot(dir), before);
  assert.equal((await readIdRegistry(dir)).events.some((e) => e.op === 'promote'), false);
});

// ------------------------------------------------------------------ E-0011, E-0035 (3): concurrent edits are never lost
const racingHistory = (dir, target, real) => {
  const state = { fired: false };
  return {
    state,
    history: {
      firstParentCommits: (b) => real.firstParentCommits(b),
      readFile: async (c, p) => {
        if (!state.fired && p === target) { state.fired = true; await appendFile(abs(dir, target), `${EDIT_LINE}\n`); }
        return real.readFile(c, p);
      },
    },
  };
};

test('E-0011: an entity edited while promoteIds runs keeps the edit, is listed in entities_skipped and converges on the next run (audit R02 F03)', async () => {
  const { dir, M } = await mergedRepo('race');
  const { history, state } = racingHistory(dir, A, createGitHistoryReader(dir));
  const first = await promote(dir, { history });
  assert.ok(state.fired);
  assert.deepEqual(first.promoted, [{ id: 'BR-0001', path: A, commit: M }]);
  assert.deepEqual(first.entities_rewritten, []);
  assert.deepEqual(first.entities_skipped, [A]);
  assert.ok((await get(dir, A)).split('\n').includes(EDIT_LINE), 'the edit survived');
  assert.match(await get(dir, A), /id_status: provisional/, 'the file was not touched');
  assert.deepEqual((await readdir(abs(dir, 'knowledge/business-rules/alpha'))).filter((n) => n.endsWith('.tmp')), [], 'no temporary file left');
  const second = await promote(dir);
  assert.deepEqual([second.promoted, second.entities_rewritten, second.entities_skipped], [[], [A], []]);
  const converged = await get(dir, A);
  assert.ok(converged.split('\n').includes(EDIT_LINE), 'the edit is still there');
  assert.equal(YAML.parse(converged).id_status, 'permanent');
  const third = await promote(dir);
  assert.deepEqual([third.promoted, third.renumbered, third.entities_rewritten, third.entities_skipped], [[], [], [], []]);
  assert.equal(await get(dir, A), converged, 'idempotent');
});

test('E-0011: an edit made just before the registry rename is also preserved (the guard re-reads right before each entity rename)', async () => {
  const { dir } = await mergedRepo('race2');
  const fs = await import('node:fs/promises');
  const state = { fired: false };
  const rename = async (from, to) => {
    if (!state.fired && path.basename(to) === 'id-registry.yaml') { state.fired = true; await appendFile(abs(dir, A), `${EDIT_LINE}\n`); }
    return fs.rename(from, to);
  };
  const first = await promote(dir, { rename });
  assert.ok(state.fired);
  assert.deepEqual([first.entities_rewritten, first.entities_skipped], [[], [A]]);
  assert.ok((await get(dir, A)).split('\n').includes(EDIT_LINE));
  assert.deepEqual((await promote(dir)).entities_rewritten, [A]);
  assert.ok((await get(dir, A)).split('\n').includes(EDIT_LINE));
});

test('E-0011: atomicWrite with expectedText replaces an unchanged file and leaves a changed or removed one alone', async () => {
  const dir = await tmp('atomic');
  const file = path.join(dir, 'x.yaml');
  await writeFile(file, 'one\n');
  assert.equal(await atomicWrite(file, 'two\n', { expectedText: 'one\n' }), true);
  assert.equal(await readFile(file, 'utf8'), 'two\n');
  await writeFile(file, 'two\nedit\n');
  assert.equal(await atomicWrite(file, 'three\n', { expectedText: 'two\n' }), false);
  assert.equal(await readFile(file, 'utf8'), 'two\nedit\n');
  await rm(file);
  assert.equal(await atomicWrite(file, 'four\n', { expectedText: 'two\n' }), false);
  await assert.rejects(stat(file), { code: 'ENOENT' });
  assert.deepEqual(await readdir(dir), [], 'no temporary file left');
  assert.equal(await atomicWrite(file, 'five\n'), true, 'without expectedText the write is unconditional');
});

// ------------------------------------------------------------------ E-0034, E-0035 (1): the permanent-renumber check is positional
test('E-0034: a move of the permanent ID into the former anchor after the alias is valid (audit R02 F04)', () => {
  validRegistry([alloc('BR-0001', A), alloc('BR-0001', B), promo('BR-0001', A, Sa), alloc('BR-0002', B), aliasEv('BR-0001', 'BR-0002', Sb),
    moveEv('BR-0001', A, B)]);
  validRegistry([alloc('BR-0001', A), promo('BR-0001', A, Sa), alloc('BR-0002', B), aliasEv('BR-0001', 'BR-0002', Sb),
    moveEv('BR-0001', A, B), moveEv('BR-0001', B, G)]);
});

test('E-0034: a holder at the anchor at the alias position is invalid, whether it got there by promote or by an earlier move', () => {
  invalidRegistry([alloc('BR-0001', A), promo('BR-0001', A, Sa), alloc('BR-0002', A), aliasEv('BR-0001', 'BR-0002', Sb)]);
  invalidRegistry([alloc('BR-0001', A), promo('BR-0001', A, Sa), alloc('BR-0002', B), moveEv('BR-0001', A, B), aliasEv('BR-0001', 'BR-0002', Sb)]);
  invalidRegistry([alloc('BR-0001', A), promo('BR-0001', A, Sa), alloc('BR-0002', A), aliasEv('BR-0001', 'BR-0002', Sb), moveEv('BR-0001', A, G)]);
});

test('E-0035 (1): a later promote of the renumbered ID at the anchor path is invalid; a later promote elsewhere is valid', () => {
  invalidRegistry([alloc('BR-0001', A), alloc('BR-0002', A), aliasEv('BR-0001', 'BR-0002', Sb), promo('BR-0001', A, Sa)]);
  validRegistry([alloc('BR-0001', A), alloc('BR-0001', B), alloc('BR-0002', B), aliasEv('BR-0001', 'BR-0002', Sb), promo('BR-0001', A, Sa)]);
  validRegistry([alloc('BR-0001', A), alloc('BR-0001', B), alloc('BR-0002', B), aliasEv('BR-0001', 'BR-0002', Sb), promo('BR-0001', A, Sa),
    moveEv('BR-0001', A, B)]);
});

// ------------------------------------------------------------------ E-0024 (3): the "otherwise none" arm (audit R02 F05)
test('E-0024 (3): two non-anchor files carrying the renumbered ID get no id_alias; the unique survivor converges to it', async () => {
  const events = [alloc('BR-0001', A), alloc('BR-0001', B), promo('BR-0001', A, Sa), alloc('BR-0002', B), aliasEv('BR-0001', 'BR-0002', Sb)];
  const dir = await tmp('relocated');
  await put(dir, REGISTRY, registryText(events));
  await put(dir, A, entity('BR-0001', 'permanent'));
  await put(dir, G, entity('BR-0002'));
  await put(dir, D, entity('BR-0002'));
  const none = { firstParentCommits: async () => [], readFile: async () => null };
  const before = await snapshot(dir);
  const first = await promoteIds(dir, { canonicalBranch: 'main', history: none });
  assert.deepEqual([first.entities_rewritten, first.entities_skipped], [[], []], 'ambiguous: neither copy gets id_alias, nothing is written');
  assert.deepEqual(await snapshot(dir), before);
  await rm(abs(dir, D));
  const second = await promoteIds(dir, { canonicalBranch: 'main', history: none });
  assert.deepEqual(second.entities_rewritten, [G], 'the unique survivor converges');
  assert.deepEqual(YAML.parse(await get(dir, G)).id_alias, ['BR-0001']);
});
