// P002 remediation R01 tests (implementer-owned): E-0024 replay/projection/branch resolution, E-0028 readings, and the
// audit R01 coverage gaps (F05-F09). Titles start with the clause or errata entry exercised.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import YAML from 'yaml';
import { aliasProjection, parseRegistryText } from '../framework/engine/id-registry-codec.mjs';
import { createGitHistoryReader } from '../framework/engine/id-registry-git.mjs';
import { withRegistryLock } from '../framework/engine/id-registry-lock.mjs';
import { allocateId, checkIdCollisions, promoteIds, readIdRegistry } from '../framework/engine/id-registry.mjs';

const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const LOCK_URL = pathToFileURL(path.resolve(here, '..', 'framework', 'engine', 'id-registry-lock.mjs')).href;
const HEADER = 'schema_version: 2.1\nevents:\n';
const REGISTRY = '.kf/id-registry.yaml';
const A = 'knowledge/business-rules/alpha/rule.yaml';
const B = 'knowledge/business-rules/beta/rule.yaml';
const G = 'knowledge/business-rules/gamma/rule.yaml';
const Sa = 'a'.repeat(40);
const Sb = 'b'.repeat(40);

const created = [];
after(async () => {
  for (const dir of created.splice(0)) await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }).catch(() => {});
});
async function tmp(label) {
  const dir = await mkdtemp(path.join(await realpath(os.tmpdir()), `kf-r01-${label}-`));
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

async function assertCode(promise, code) {
  let caught = null;
  try { await promise; } catch (error) { caught = error; }
  assert.ok(caught, `expected rejection ${code}`);
  assert.equal(caught.code, code, caught.message);
  return caught;
}
const invalidRegistry = (events) => assert.throws(() => parseRegistryText(registryText(events)), (e) => e.code === 'INVALID_REGISTRY');
const validRegistry = (events) => parseRegistryText(registryText(events));

async function project(events, label = 'p') {
  const dir = await tmp(label);
  await put(dir, REGISTRY, registryText(events));
  return dir;
}
const registryEvents = async (dir) => (await readIdRegistry(dir)).events;
const sha = (n) => `${'c'.repeat(39)}${n}`;

// ------------------------------------------------------------------ E-0024 (1), E-0028 (2): replay
test('E-0024 (1): exact repeats of promote, alias and move are no-op repeats, adjacent or not', () => {
  const base = [alloc('BR-0001', A), alloc('BR-0002', B), alloc('BR-0003', G)];
  const p1 = promo('BR-0001', A, Sa);
  const p2 = promo('BR-0002', B, Sb);
  const al = aliasEv('BR-0001', 'BR-0002', Sa);
  const mv = moveEv('BR-0001', A, G);
  for (const extra of [[p1, p1], [p1, p2, p1], [al, al], [al, p2, al], [p1, mv, mv], [p1, mv, p2, mv], [p1, al, p1, al]]) {
    const { model } = validRegistry([...base, ...extra]);
    assert.equal(model.aliases.length, extra.filter((e) => e.op === 'alias').length ? 1 : 0, 'a repeated alias is one alias');
  }
});

test('E-0024 (1): a move is a repeat only when exactly equal; sequential moves, including back and forth, replay in order', () => {
  const base = [alloc('BR-0001', A), promo('BR-0001', A, Sa)];
  const { model } = validRegistry([...base, moveEv('BR-0001', A, G), moveEv('BR-0001', G, A), moveEv('BR-0001', A, G)]);
  assert.equal(model.holder.get('BR-0001'), G);
  invalidRegistry([...base, moveEv('BR-0001', A, G), moveEv('BR-0001', A, B)]);
  invalidRegistry([...base, moveEv('BR-0001', B, G)]);
});

test('E-0024 (1): a promote that differs in path or commit stays invalid, adjacent or not', () => {
  const base = [alloc('BR-0001', A), alloc('BR-0001', G), alloc('BR-0002', B)];
  invalidRegistry([...base, promo('BR-0001', A, Sa), promo('BR-0001', G, Sa)]);
  invalidRegistry([...base, promo('BR-0001', A, Sa), promo('BR-0002', B, Sb), promo('BR-0001', A, Sb)]);
});

test('E-0028 (2): the same alias with a different commit is INVALID_REGISTRY; an exact repeat is not', () => {
  const base = [alloc('BR-0001', A), alloc('BR-0002', B)];
  validRegistry([...base, aliasEv('BR-0001', 'BR-0002', Sa), aliasEv('BR-0001', 'BR-0002', Sa)]);
  invalidRegistry([...base, aliasEv('BR-0001', 'BR-0002', Sa), aliasEv('BR-0001', 'BR-0002', Sb)]);
});

test('E-0024 (1): the same ID renumbered twice at one anchor to different targets is invalid; at two anchors it is valid', () => {
  invalidRegistry([alloc('BR-0001', A), alloc('BR-0002', B), alloc('BR-0004', B),
    aliasEv('BR-0001', 'BR-0002', Sa), aliasEv('BR-0001', 'BR-0004', Sa)]);
  validRegistry([alloc('BR-0001', A), alloc('BR-0002', B), aliasEv('BR-0001', 'BR-0002', Sa),
    alloc('BR-0003', G), aliasEv('BR-0001', 'BR-0003', Sa)]);
});

test('E-0028 (1): an alias anchors on the nearest allocate of its target that precedes it; none preceding is invalid', () => {
  // BR-0002 allocated at B (the renumbering) and again later at G (another branch): the anchor is B
  const { model } = validRegistry([alloc('BR-0001', A), alloc('BR-0002', G), alloc('BR-0002', B), aliasEv('BR-0001', 'BR-0002', Sa), alloc('BR-0002', G)]);
  assert.equal(model.aliases[0].rpath, B);
  invalidRegistry([alloc('BR-0001', A), aliasEv('BR-0001', 'BR-0002', Sa), alloc('BR-0002', B)]);
});

// ------------------------------------------------------------------ E-0024 (2): l.318
test('E-0024 (2): an alias that renumbers the current holder of a permanent ID is INVALID_REGISTRY (l.318)', async () => {
  invalidRegistry([alloc('BR-0001', A), promo('BR-0001', A, Sa), alloc('BR-0002', A), aliasEv('BR-0001', 'BR-0002', Sb)]);
  invalidRegistry([alloc('BR-0001', A), promo('BR-0001', A, Sa), moveEv('BR-0001', A, G), alloc('BR-0002', G), aliasEv('BR-0001', 'BR-0002', Sb)]);
  invalidRegistry([alloc('BR-0001', A), alloc('BR-0002', A), aliasEv('BR-0001', 'BR-0002', Sb), promo('BR-0001', A, Sa)]);
  validRegistry([alloc('BR-0001', B), promo('BR-0001', B, Sa), alloc('BR-0002', A), aliasEv('BR-0001', 'BR-0002', Sb)]);
  validRegistry([alloc('BR-0001', A), promo('BR-0001', A, Sa), moveEv('BR-0001', A, G), alloc('BR-0002', A), aliasEv('BR-0001', 'BR-0002', Sb)]);
  validRegistry([alloc('BR-0001', A), alloc('BR-0002', A), aliasEv('BR-0001', 'BR-0002', Sb)]);
  const dir = await project([alloc('BR-0001', A), promo('BR-0001', A, Sa), alloc('BR-0002', A), aliasEv('BR-0001', 'BR-0002', Sb)]);
  const before = await get(dir, REGISTRY);
  await assertCode(readIdRegistry(dir), 'INVALID_REGISTRY');
  await assertCode(allocateId(dir, 'BR', G), 'INVALID_REGISTRY');
  assert.equal(await get(dir, REGISTRY), before);
});

// ------------------------------------------------------------------ E-0024 (3): projection follows the entity
const projectionOf = (events, id, filePath, files) => aliasProjection(validRegistry(events).model, id, filePath, files);

test('E-0024 (3): a promoted renumbered entity keeps id_alias after a recorded move, and the old path loses it', () => {
  const events = [alloc('BR-0001', A), alloc('BR-0001', B), promo('BR-0001', A, Sa), alloc('BR-0002', B), aliasEv('BR-0001', 'BR-0002', Sb),
    promo('BR-0002', B, Sb), moveEv('BR-0002', B, G)];
  const files = [{ path: A, id: 'BR-0001' }, { path: G, id: 'BR-0002' }];
  assert.deepEqual(projectionOf(events, 'BR-0002', G, files), ['BR-0001']);
  assert.deepEqual(projectionOf(events, 'BR-0002', B, files), []);
  assert.deepEqual(projectionOf(events, 'BR-0001', A, files), []);
});

test('E-0024 (3): a still-provisional renumbered entity relocated without a record keeps id_alias, before and after promotion', () => {
  const events = [alloc('BR-0001', A), alloc('BR-0001', B), promo('BR-0001', A, Sa), alloc('BR-0002', B), aliasEv('BR-0001', 'BR-0002', Sb)];
  const files = [{ path: A, id: 'BR-0001' }, { path: G, id: 'BR-0002' }];
  assert.deepEqual(projectionOf(events, 'BR-0002', G, files), ['BR-0001'], 'provisional, relocated');
  assert.deepEqual(projectionOf([...events, promo('BR-0002', G, sha(1))], 'BR-0002', G, files), ['BR-0001'], 'promoted at the new path');
  assert.deepEqual(projectionOf(events, 'BR-0002', B, [{ path: B, id: 'BR-0002' }]), ['BR-0001'], 'not relocated');
});

test('E-0024 (3): an unrelated holder of the target ID gets no id_alias, even after its own recorded move', () => {
  const events = [alloc('BR-0001', A), alloc('BR-0001', B), promo('BR-0001', A, Sa), alloc('BR-0002', B), aliasEv('BR-0001', 'BR-0002', Sb),
    alloc('BR-0002', G), promo('BR-0002', G, sha(2)), moveEv('BR-0002', G, 'knowledge/business-rules/delta/rule.yaml')];
  const moved = 'knowledge/business-rules/delta/rule.yaml';
  assert.deepEqual(projectionOf(events, 'BR-0002', moved, [{ path: moved, id: 'BR-0002' }]), []);
  // provisional variant: the unrelated claimant is at a path that has its own allocate
  const provisional = [alloc('BR-0001', A), alloc('BR-0001', B), promo('BR-0001', A, Sa), alloc('BR-0002', B), aliasEv('BR-0001', 'BR-0002', Sb), alloc('BR-0002', G)];
  assert.deepEqual(projectionOf(provisional, 'BR-0002', G, [{ path: G, id: 'BR-0002' }]), []);
});

test('E-0024 (3): a second renumbering of the same entity extends id_alias oldest first, also when the intermediate ID went to another entity', () => {
  const events = [alloc('BR-0001', A), alloc('BR-0001', B), promo('BR-0001', A, Sa), alloc('BR-0002', B), aliasEv('BR-0001', 'BR-0002', Sb),
    alloc('BR-0002', G), promo('BR-0002', G, sha(3)), alloc('BR-0003', B), aliasEv('BR-0002', 'BR-0003', sha(4))];
  assert.deepEqual(projectionOf(events, 'BR-0003', B, [{ path: B, id: 'BR-0003' }, { path: G, id: 'BR-0002' }]), ['BR-0001', 'BR-0002']);
  assert.deepEqual(projectionOf(events, 'BR-0002', G, [{ path: B, id: 'BR-0003' }, { path: G, id: 'BR-0002' }]), []);
});

test('E-0024 (3): promoteIds keeps id_alias on a renumbered entity that was moved with a recorded move (end to end, no Git)', async () => {
  const events = [alloc('BR-0001', A), alloc('BR-0001', B), promo('BR-0001', A, Sa), alloc('BR-0002', B), aliasEv('BR-0001', 'BR-0002', Sb),
    promo('BR-0002', B, Sb), moveEv('BR-0002', B, G)];
  const dir = await project(events, 'proj');
  await put(dir, A, entity('BR-0001', 'permanent'));
  await put(dir, G, entity('BR-0002', 'permanent'));
  const result = await promoteIds(dir, { canonicalBranch: 'main', history: { firstParentCommits: async () => [], readFile: async () => null } });
  assert.deepEqual(result.entities_rewritten, [G], 'the moved file lost its id_alias and is healed at the new path');
  assert.deepEqual(YAML.parse(await get(dir, G)).id_alias, ['BR-0001']);
  assert.equal(YAML.parse(await get(dir, A)).id_alias, undefined);
  const again = await promoteIds(dir, { canonicalBranch: 'main', history: { firstParentCommits: async () => [], readFile: async () => null } });
  assert.deepEqual(again.entities_rewritten, []);
});

test('E-0024 (1): a repeat promotion after a duplicated promote line (union merge shape) writes nothing', async () => {
  const dir = await project([alloc('BR-0001', A), promo('BR-0001', A, Sa), alloc('BR-0002', B), promo('BR-0001', A, Sa)], 'dup');
  await put(dir, A, entity('BR-0001', 'permanent'));
  const before = await get(dir, REGISTRY);
  const result = await promoteIds(dir, { canonicalBranch: 'main', history: { firstParentCommits: async () => [], readFile: async () => null } });
  assert.deepEqual([result.promoted, result.renumbered, result.entities_rewritten, result.diagnostics], [[], [], [], []]);
  assert.equal(await get(dir, REGISTRY), before);
  assert.deepEqual(await checkIdCollisions(dir).then((r) => r.diagnostics), []);
});

// ------------------------------------------------------------------ E-0024 (4): canonical ref resolution (real Git)
let tick = 0;
function gitEnv() {
  const when = new Date(Date.UTC(2026, 0, 1) + (tick += 1) * 60000).toISOString();
  return {
    ...process.env, GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@t.invalid', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@t.invalid',
    GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when, GIT_CONFIG_NOSYSTEM: '1', LC_ALL: 'C',
  };
}
const git = async (dir, ...args) => (await exec('git', args, { cwd: dir, env: gitEnv() })).stdout.replace(/\r?\n$/, '');
async function gitRepo(label, commits = 4) {
  const dir = await tmp(label);
  await git(dir, 'init', '-q', '-b', 'main');
  for (const [key, value] of [['commit.gpgsign', 'false'], ['user.name', 'T'], ['user.email', 't@t.invalid'], ['core.autocrlf', 'false']]) await git(dir, 'config', key, value);
  for (let i = 1; i <= commits; i += 1) {
    await put(dir, 'f.txt', `${i}\n`);
    await git(dir, 'add', '-A');
    await git(dir, 'commit', '-q', '-m', `c${i}`);
  }
  return dir;
}
const unresolved = (reader, name) => assertCode(reader.firstParentCommits(name), 'CANONICAL_BRANCH_UNRESOLVED');

test('E-0024 (4): a tag with the branch name does not shadow the branch; revision expressions and tags are unresolved', async () => {
  const dir = await gitRepo('ref');
  const all = (await git(dir, 'rev-list', '--first-parent', '--reverse', 'main')).split('\n');
  assert.equal(all.length, 4);
  await git(dir, 'tag', 'main', 'HEAD~2');
  await git(dir, 'tag', 'v1', 'HEAD~1');
  const reader = createGitHistoryReader(dir);
  assert.deepEqual(await reader.firstParentCommits('main'), all, 'refs/heads/main, not the tag');
  for (const name of ['main~1', 'main^', 'main^0', 'main@{0}', 'main@{yesterday}', '@{-1}', 'HEAD', 'v1', 'tags/v1', 'refs/tags/v1',
    'refs/heads/main', 'origin/main', 'main..HEAD', 'a b', 'a~b', 'a:b', 'a?b', 'a*b', 'a[b', 'a//b', 'a.lock', '.hidden', '-x', '']) {
    await unresolved(reader, name);
  }
  await unresolved(reader, 'only-a-tag-name-that-does-not-exist');
});

test('E-0024 (4): a remote-only branch resolves through refs/remotes/origin/<name>; a local branch wins', async () => {
  const origin = await gitRepo('origin', 3);
  await git(origin, 'branch', 'trunk');
  const clone = await tmp('clone');
  await exec('git', ['clone', '-q', origin, clone], { env: gitEnv() });
  const reader = createGitHistoryReader(clone);
  const trunk = (await git(origin, 'rev-list', '--first-parent', '--reverse', 'trunk')).split('\n');
  assert.deepEqual(await reader.firstParentCommits('trunk'), trunk, 'no local trunk: the remote-tracking branch');
  await put(clone, 'g.txt', 'x\n');
  await git(clone, 'add', '-A');
  await git(clone, 'commit', '-q', '-m', 'local');
  await git(clone, 'branch', 'trunk');
  assert.equal((await reader.firstParentCommits('trunk')).length, 4, 'a local branch wins over origin/<name>');
});

test('E-0024 (4): replace refs do not alter the history the reader returns', async () => {
  const dir = await gitRepo('replace');
  const [c1, , c3] = (await git(dir, 'rev-list', '--first-parent', '--reverse', 'main')).split('\n');
  const before = await createGitHistoryReader(dir).firstParentCommits('main');
  await git(dir, 'replace', c3, c1);
  assert.deepEqual(await createGitHistoryReader(dir).firstParentCommits('main'), before);
});

// ------------------------------------------------------------------ E-0028 (3), E-0013: lock owner file
test('E-0028 (3): the owner file holds exactly pid, host and acquired_at, from the injected now and hostname', async () => {
  const dir = await project([], 'owner');
  const fixed = new Date('2026-03-04T05:06:07.000Z');
  await withRegistryLock(dir, { now: () => fixed, hostname: 'injected-host' }, async () => {
    const owner = JSON.parse(await get(dir, '.kf/id-registry.lock/owner.json'));
    assert.deepEqual(owner, { pid: process.pid, host: 'injected-host', acquired_at: '2026-03-04T05:06:07.000Z' });
  });
  const started = Date.now();
  await withRegistryLock(dir, {}, async () => {
    const owner = JSON.parse(await get(dir, '.kf/id-registry.lock/owner.json'));
    assert.deepEqual(Object.keys(owner).sort(), ['acquired_at', 'host', 'pid']);
    assert.equal(owner.pid, process.pid);
    assert.equal(owner.host, os.hostname());
    assert.ok(owner.pid > 0);
    assert.equal(new Date(owner.acquired_at).toISOString(), owner.acquired_at);
    assert.ok(Math.abs(Date.parse(owner.acquired_at) - started) < 10000, 'a current time');
  });
});

test('E-0013: a lock left by a killed engine process is recovered by the engine-written owner file alone', async () => {
  const dir = await project([alloc('BR-0001', A)], 'killed');
  const script = `import { withRegistryLock } from ${JSON.stringify(LOCK_URL)};
await withRegistryLock(${JSON.stringify(dir)}, {}, async () => { process.stdout.write('held\\n'); await new Promise(() => {}); });`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', () => reject(new Error('child exited before holding the lock')));
    child.stdout.once('data', resolve);
  });
  const owner = JSON.parse(await get(dir, '.kf/id-registry.lock/owner.json'));
  assert.equal(owner.pid, child.pid, 'the owner file names the real child pid');
  await new Promise((resolve) => { child.once('exit', resolve); child.kill('SIGKILL'); });
  const got = await allocateId(dir, 'BR', B, { lock: { staleAfterMs: 150, deadlineMs: 10000, pollMs: 10 } });
  assert.equal(got.id, 'BR-0002');
  assert.deepEqual((await readdir(abs(dir, '.kf'))).filter((n) => /lock|tmp/.test(n)), []);
});

// ------------------------------------------------------------------ E-0015 D-02: persisted alias events
async function collidingProject(paths, ids, label) {
  const events = [];
  for (const [i, p] of paths.entries()) events.push(alloc(ids[i], p));
  const dir = await project(events, label);
  for (const [i, p] of paths.entries()) await put(dir, p, entity(ids[i]));
  return dir;
}

test('E-0015 D-02(a): the persisted alias.commit is the loser entering commit, not the tip and not the winner', async () => {
  const dir = await collidingProject([A, B], ['BR-0001', 'BR-0001'], 'd02a');
  const commits = [1, 2, 3, 4].map(sha);
  const reader = {
    firstParentCommits: async () => commits,
    readFile: async (commit, p) => ({ [A]: [sha(3), sha(4)], [B]: [sha(2), sha(3), sha(4)] }[p]?.includes(commit) ? entity('BR-0001') : null),
  };
  await promoteIds(dir, { canonicalBranch: 'main', history: reader });
  assert.deepEqual((await registryEvents(dir)).slice(2), [promo('BR-0001', B, sha(2)), alloc('BR-0002', A), aliasEv('BR-0001', 'BR-0002', sha(3))]);
});

test('E-0015 D-02(c), E-0023 (1a): promotes in ID order, then each loser by ID; path order is the opposite', async () => {
  const b1 = 'knowledge/business-rules/b1/rule.yaml';
  const b2 = 'knowledge/business-rules/b2/rule.yaml';
  const d1 = 'knowledge/a-data/d1/entity.yaml';
  const d2 = 'knowledge/a-data/d2/entity.yaml';
  const dir = await collidingProject([b1, b2, d1, d2], ['BR-0001', 'BR-0001', 'DE-0001', 'DE-0001'], 'd02c');
  const one = sha(1);
  const reader = { firstParentCommits: async () => [one], readFile: async (commit, p) => entity([b1, b2].includes(p) ? 'BR-0001' : 'DE-0001') };
  await promoteIds(dir, { canonicalBranch: 'main', history: reader });
  assert.deepEqual((await registryEvents(dir)).slice(4), [
    promo('BR-0001', b1, one), promo('DE-0001', d1, one),
    alloc('BR-0002', b2), aliasEv('BR-0001', 'BR-0002', one),
    alloc('DE-0002', d2), aliasEv('DE-0001', 'DE-0002', one),
  ]);
});

// ------------------------------------------------------------------ E-0011, E-0015 D-03(a)
test('E-0011: drift in id_alias alone is converged, with no new event', async () => {
  const dir = await project([alloc('BR-0001', A), alloc('BR-0002', B), aliasEv('BR-0001', 'BR-0002', Sa)], 'drift');
  await put(dir, A, entity('BR-0001'));
  await put(dir, B, entity('BR-0002'));
  const before = await get(dir, REGISTRY);
  const noHistory = { firstParentCommits: async () => [], readFile: async () => null };
  const result = await promoteIds(dir, { canonicalBranch: 'main', history: noHistory });
  assert.deepEqual(result.entities_rewritten, [B]);
  assert.deepEqual(YAML.parse(await get(dir, B)).id_alias, ['BR-0001']);
  assert.equal(await get(dir, REGISTRY), before);
  assert.deepEqual((await promoteIds(dir, { canonicalBranch: 'main', history: noHistory })).entities_rewritten, []);
});

test('E-0015 D-03(a): unregistered is sorted by ID first, then by path', async () => {
  const dir = await project([alloc('BR-0001', A)], 'unreg');
  await put(dir, A, entity('BR-0001'));
  await put(dir, 'changes/CHG-0009.yaml', 'schema_version: 2.1\nid: CHG-0009\n');
  await put(dir, 'knowledge/business-rules/x/rule.yaml', entity('BR-0007'));
  assert.deepEqual((await checkIdCollisions(dir)).unregistered, [
    { id: 'BR-0007', path: 'knowledge/business-rules/x/rule.yaml' },
    { id: 'CHG-0009', path: 'changes/CHG-0009.yaml' },
  ]);
});
