// P002 adversarial tests (implementer-owned): stale-lock break race, concurrent promotion, interrupted writes,
// entity rewrite fidelity, hostile inputs. Titles start with the clause or errata entry exercised.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { promisify } from 'node:util';
import YAML from 'yaml';
import { allocateId, checkIdCollisions, initializeIdRegistry, promoteIds, readIdRegistry, resolveId } from '../framework/engine/id-registry.mjs';
import { projectEntityText } from '../framework/engine/id-registry-entities.mjs';

const exec = promisify(execFile);
const HEADER = 'schema_version: 2.1\nevents:\n';
const REGISTRY = '.kf/id-registry.yaml';
const A = 'knowledge/business-rules/alpha/rule.yaml';
const B = 'knowledge/business-rules/beta/rule.yaml';
const SHA = 'a'.repeat(40);

const created = [];
after(async () => {
  for (const dir of created.splice(0)) await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }).catch(() => {});
});
async function tmp(label) {
  const dir = await mkdtemp(path.join(await realpath(os.tmpdir()), `kf-adv-${label}-`));
  created.push(dir);
  return dir;
}
const abs = (dir, rel) => path.join(dir, ...rel.split('/'));
const put = async (dir, rel, text) => { await mkdir(path.dirname(abs(dir, rel)), { recursive: true }); await writeFile(abs(dir, rel), text); };
const get = (dir, rel) => readFile(abs(dir, rel), 'utf8');
const alloc = (id, p) => `  - {op: allocate, id: ${id}, id_status: provisional, path: ${p}}\n`;
const entity = (id, status = 'provisional', name = 'Label') =>
  `# keep me\nschema_version: 2.1\nid: ${id}\nid_status: ${status}\ntype: business-rule\nname: ${name}\n`;

async function assertCode(promise, code) {
  let caught = null;
  try { await promise; } catch (error) { caught = error; }
  assert.ok(caught, `expected ${code}`);
  assert.equal(caught.code, code, caught.message);
  return caught;
}

async function project(lines) {
  const dir = await tmp('p');
  await put(dir, REGISTRY, HEADER + lines.join(''));
  return dir;
}
const kfLeftovers = async (dir) => (await readdir(abs(dir, '.kf'))).filter((name) => /lock|tmp/.test(name));

// ------------------------------------------------------------------ E-0013 stale-lock break race (R-03)
test('E-0013: a lock acquired after staleness was determined is never removed by the breaker', async () => {
  const dir = await project([alloc('BR-0001', A)]);
  const hostname = 'race-host';
  const staleOwner = JSON.stringify({ pid: 777001, host: hostname, acquired_at: new Date(Date.now() - 600000).toISOString() });
  await put(dir, '.kf/id-registry.lock/owner.json', staleOwner);
  const freshOwner = JSON.stringify({ pid: process.pid, host: hostname, acquired_at: new Date().toISOString() });
  let calls = 0;
  // the swap has to happen synchronously inside the hook, after the stale owner was read and judged
  const { rmSync, mkdirSync, writeFileSync } = await import('node:fs');
  const lockDir = abs(dir, '.kf/id-registry.lock');
  const swapping = (pid) => {
    calls += 1;
    if (calls === 1) {
      rmSync(lockDir, { recursive: true, force: true });
      mkdirSync(lockDir);
      writeFileSync(path.join(lockDir, 'owner.json'), freshOwner);
      return false; // the stale owner's pid is dead
    }
    return pid === process.pid;
  };
  await assertCode(allocateId(dir, 'BR', B, { lock: { hostname, isProcessAlive: swapping, deadlineMs: 250, pollMs: 5, staleAfterMs: 1000 } }), 'LOCK_TIMEOUT');
  assert.equal(calls, 1, 'the stale verdict was reached once; the younger owner is judged by age alone');
  assert.equal(await get(dir, '.kf/id-registry.lock/owner.json'), freshOwner, 'the newer lock and its owner file are intact');
  assert.deepEqual((await readdir(abs(dir, '.kf'))).filter((n) => n !== 'id-registry.yaml' && n !== 'id-registry.lock'), [], 'nothing was left behind');
  assert.equal(await get(dir, REGISTRY), HEADER + alloc('BR-0001', A));
});

test('E-0013: many contenders on one stale lock - exactly one breaks it, all get distinct IDs, nothing is left over', async () => {
  const dir = await project([alloc('BR-0001', A)]);
  const hostname = 'many-host';
  await put(dir, '.kf/id-registry.lock/owner.json', JSON.stringify({ pid: 777002, host: hostname, acquired_at: new Date(Date.now() - 600000).toISOString() }));
  const lock = { hostname, isProcessAlive: (pid) => pid === process.pid, staleAfterMs: 1000, deadlineMs: 30000, pollMs: 3 };
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) => allocateId(dir, 'BR', `knowledge/x/c${i}.yaml`, { lock })));
  assert.deepEqual(results.map((r) => r.id).sort(), Array.from({ length: 10 }, (_, i) => `BR-${String(i + 2).padStart(4, '0')}`));
  assert.deepEqual(await kfLeftovers(dir), []);
  assert.equal((await readIdRegistry(dir)).events.length, 11);
});

test('E-0013: the lock is released when the operation fails, on every failure path', async () => {
  const dir = await project([alloc('BR-0001', A)]);
  await put(dir, A, entity('BR-0001'));
  await put(dir, B, entity('BR-0099')); // unregistered: operation fails after the lock was taken
  await assertCode(allocateId(dir, 'BR', 'knowledge/x/y.yaml'), 'UNREGISTERED_ID');
  assert.deepEqual(await kfLeftovers(dir), []);
  await rm(abs(dir, B)); // negative: with the stranger gone, a failure inside the operation still releases the lock
  await assert.rejects(promoteIds(dir, { canonicalBranch: 'main', history: { firstParentCommits: async () => { throw new Error('boom'); }, readFile: async () => null } }), { message: 'boom' });
  assert.deepEqual(await kfLeftovers(dir), []);
  await assertCode(initializeIdRegistry(dir), 'REGISTRY_EXISTS');
  assert.deepEqual(await kfLeftovers(dir), []);
});

// ------------------------------------------------------------------ E-0011 / E-0012 interrupted and concurrent promotion
async function gitRepo() {
  const dir = await tmp('git');
  const env = { ...process.env, GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@t.invalid', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@t.invalid', GIT_CONFIG_NOSYSTEM: '1' };
  const git = async (...args) => (await exec('git', args, { cwd: dir, env })).stdout.trim();
  await git('init', '-q', '-b', 'main');
  await git('config', 'core.autocrlf', 'false');
  return { dir, git };
}

test('§8.2: two promoters racing on the same repository promote exactly once', async () => {
  const { dir, git } = await gitRepo();
  await put(dir, REGISTRY, HEADER);
  await allocateId(dir, 'BR', A);
  await allocateId(dir, 'BR', B);
  await put(dir, A, entity('BR-0001'));
  await put(dir, B, entity('BR-0002'));
  await git('add', '-A');
  await git('commit', '-q', '-m', 'base');
  const lock = { deadlineMs: 30000, pollMs: 5 };
  const results = await Promise.all([promoteIds(dir, { canonicalBranch: 'main', lock }), promoteIds(dir, { canonicalBranch: 'main', lock })]);
  assert.deepEqual(results.map((r) => r.promoted.length).sort(), [0, 2]);
  const events = (await readIdRegistry(dir)).events;
  assert.equal(events.filter((e) => e.op === 'promote').length, 2);
  assert.deepEqual(await kfLeftovers(dir), []);
});

test('E-0011: an interrupted entity rewrite leaves registry events and converges on the next call without new events', async () => {
  const { dir, git } = await gitRepo();
  await put(dir, REGISTRY, HEADER);
  await allocateId(dir, 'BR', A);
  await allocateId(dir, 'BR', B);
  await put(dir, A, entity('BR-0001'));
  await put(dir, B, entity('BR-0002'));
  await git('add', '-A');
  await git('commit', '-q', '-m', 'base');
  const failing = async (from, to) => {
    if (to.endsWith('beta\\rule.yaml') || to.endsWith('beta/rule.yaml')) throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
    return (await import('node:fs/promises')).rename(from, to);
  };
  await assert.rejects(promoteIds(dir, { canonicalBranch: 'main', rename: failing }), { code: 'ENOSPC' });
  const afterCrash = await get(dir, REGISTRY);
  assert.equal(afterCrash.split('\n').filter((l) => l.includes('op: promote')).length, 2, 'the registry write happened before any entity rewrite');
  assert.match(await get(dir, A), /id_status: permanent/);
  assert.match(await get(dir, B), /id_status: provisional/);
  assert.deepEqual((await readdir(abs(dir, 'knowledge/business-rules/beta'))), ['rule.yaml'], 'temporary file removed');
  const result = await promoteIds(dir, { canonicalBranch: 'main' });
  assert.deepEqual([result.promoted, result.entities_rewritten], [[], [B]]);
  assert.equal(await get(dir, REGISTRY), afterCrash);
  assert.match(await get(dir, B), /id_status: permanent/);
});

test('E-0013: EPERM/EBUSY/EACCES on an entity rename are retried within the deadline, other errors propagate', async () => {
  const { dir, git } = await gitRepo();
  await put(dir, REGISTRY, HEADER);
  await allocateId(dir, 'BR', A);
  await put(dir, A, entity('BR-0001'));
  await git('add', '-A');
  await git('commit', '-q', '-m', 'base');
  const codes = ['EPERM', 'EBUSY', 'EACCES'];
  const { rename } = await import('node:fs/promises');
  const flaky = async (from, to) => {
    if (to.endsWith('rule.yaml') && codes.length > 0) throw Object.assign(new Error('blocked'), { code: codes.shift() });
    return rename(from, to);
  };
  const result = await promoteIds(dir, { canonicalBranch: 'main', rename: flaky, lock: { pollMs: 2, deadlineMs: 5000 } });
  assert.deepEqual(result.entities_rewritten, [A]);
  assert.equal(codes.length, 0);
});

test('E-0015: D-02(c) several colliding IDs in one call - promotes by ID byte order, then each loser (allocate, alias) in ID then total order', async () => {
  const { dir, git } = await gitRepo();
  const DE_A = 'knowledge/data/a/entity.yaml';
  const DE_B = 'knowledge/data/b/entity.yaml';
  await put(dir, REGISTRY, HEADER + alloc('BR-0001', A) + alloc('BR-0001', B) + alloc('DE-0001', DE_A) + alloc('DE-0001', DE_B));
  await put(dir, A, entity('BR-0001')); await put(dir, B, entity('BR-0001'));
  await put(dir, DE_A, entity('DE-0001').replace('business-rule', 'data-entity')); await put(dir, DE_B, entity('DE-0001').replace('business-rule', 'data-entity'));
  await git('add', '-A');
  await git('commit', '-q', '-m', 'all four in one commit');
  const commit = await git('rev-parse', 'HEAD');
  const result = await promoteIds(dir, { canonicalBranch: 'main' });
  assert.deepEqual(result.promoted.map((p) => [p.id, p.path]), [['BR-0001', A], ['DE-0001', DE_A]]);
  assert.deepEqual(result.renumbered, [
    { from: 'BR-0001', to: 'BR-0002', path: B, commit },
    { from: 'DE-0001', to: 'DE-0002', path: DE_B, commit },
  ]);
  const events = (await readIdRegistry(dir)).events.slice(4).map((e) => `${e.op}:${e.id ?? `${e.from}>${e.to}`}`);
  assert.deepEqual(events, ['promote:BR-0001', 'promote:DE-0001', 'allocate:BR-0002', 'alias:BR-0001>BR-0002', 'allocate:DE-0002', 'alias:DE-0001>DE-0002']);
});

test('E-0010: a permanent ID squatted from another path after the holder was deleted is KF-E-101, never re-homed (R-01)', async () => {
  const dir = await project([alloc('BR-0001', A), `  - {op: promote, id: BR-0001, path: ${A}, commit: ${SHA}}\n`]);
  await put(dir, B, entity('BR-0001', 'provisional', 'Impostor'));
  const history = { firstParentCommits: async () => [SHA], readFile: async (c, p) => (p === B ? entity('BR-0001') : null) };
  const before = await get(dir, REGISTRY);
  const result = await promoteIds(dir, { canonicalBranch: 'main', history });
  assert.deepEqual(result.diagnostics.map((d) => [d.path, d.permanent_path]), [[B, A]]);
  assert.equal(await get(dir, REGISTRY), before);
  assert.equal(await get(dir, B), entity('BR-0001', 'provisional', 'Impostor'));
  assert.equal((await resolveId(dir, 'BR-0001')).status, 'unresolved');
  assert.equal((await allocateId(dir, 'BR', 'knowledge/x/new.yaml')).id, 'BR-0002');
});

// ------------------------------------------------------------------ E-0011 rewrite fidelity
const project3 = (original, id, status, alias = []) => projectEntityText(original, { id, id_status: status, id_alias: alias });

test('E-0011: the rewrite changes only the identity keys and keeps comments, order and quoting elsewhere', () => {
  const source = '# header\nschema_version: 2.1\nid: "BR-0001"  # trailing\nid_status: provisional # status\ntype: business-rule\nname:   spaced   value\nlist:\n  - a   # c\n  - b\n';
  const out = project3(source, 'BR-0002', 'permanent', ['BR-0001']);
  assert.equal(out, '# header\nschema_version: 2.1\nid: BR-0002  # trailing\nid_status: permanent # status\nid_alias: [BR-0001]\ntype: business-rule\nname:   spaced   value\nlist:\n  - a   # c\n  - b\n');
  assert.deepEqual(YAML.parse(project3(out, 'BR-0002', 'permanent', [])).id_alias, undefined, 'alias removed when empty');
});

test('E-0011: missing id_status is inserted after id, id_alias after id_status; block id_alias is replaced; CRLF becomes LF', () => {
  assert.equal(project3('id: BR-0001\nname: x\n', 'BR-0001', 'permanent'), 'id: BR-0001\nid_status: permanent\nname: x\n');
  assert.equal(project3('id: BR-0001\nname: x\n', 'BR-0003', 'provisional', ['BR-0001', 'BR-0002']),
    'id: BR-0003\nid_status: provisional\nid_alias: [BR-0001, BR-0002]\nname: x\n');
  assert.equal(project3('id: BR-0003\nid_status: provisional\nid_alias:\n  - BR-0001\nname: x\n', 'BR-0003', 'provisional', ['BR-0001', 'BR-0002']),
    'id: BR-0003\nid_status: provisional\nid_alias: [BR-0001, BR-0002]\nname: x\n');
  assert.equal(project3('id: BR-0003\nid_status: provisional\nid_alias:\n  - BR-0001\nname: x\n', 'BR-0003', 'permanent'), 'id: BR-0003\nid_status: permanent\nname: x\n');
  assert.equal(project3('id: BR-0001\r\nid_status: provisional\r\nname: x\r\n', 'BR-0001', 'permanent'), 'id: BR-0001\nid_status: permanent\nname: x\n');
  assert.equal(project3('name: x\nid: BR-0001', 'BR-0001', 'permanent'), 'name: x\nid: BR-0001\nid_status: permanent', 'no trailing newline is invented');
});

test('E-0011: a flow-style document falls back to a structural rewrite that still preserves every other key', () => {
  const out = project3('{id: BR-0001, id_status: provisional, name: x, tags: [a, b]}\n', 'BR-0001', 'permanent');
  assert.deepEqual(YAML.parse(out), { id: 'BR-0001', id_status: 'permanent', name: 'x', tags: ['a', 'b'] });
});

// ------------------------------------------------------------------ hostile inputs
test('§8.1: hostile entity inputs - unparsable files, non-core IDs, symlinks and non-entity roots do not become records or crash the scan', async () => {
  const dir = await project([alloc('BR-0001', A)]);
  await put(dir, A, entity('BR-0001'));
  await put(dir, 'knowledge/broken/rule.yaml', 'id: BR-0777\n  bad: [indent\n');
  await put(dir, 'knowledge/numeric/rule.yaml', 'id: 12\n');
  await put(dir, 'knowledge/list/rule.yaml', '- id: BR-0888\n');
  await put(dir, 'knowledge/foreign/rule.yaml', 'id: ZZ-0001\n');
  await put(dir, 'docs/outside.yaml', 'id: BR-0999\n');
  await put(dir, 'knowledge/upper/RULE.YAML', 'id: BR-0998\n');
  try { await symlink(abs(dir, A), abs(dir, 'knowledge/link.yaml')); } catch { /* symlinks may need privileges on Windows */ }
  const report = await checkIdCollisions(dir);
  assert.deepEqual([report.diagnostics, report.provisional_collisions, report.unregistered], [[], [], []]);
  assert.equal((await allocateId(dir, 'BR', B)).id, 'BR-0002');
});

test('§8: hostile registry text - duplicate keys, anchors and tags cannot smuggle an event', async () => {
  for (const text of [
    'schema_version: 2.1\nevents:\n  - &a {op: allocate, id: BR-0001, id_status: provisional, path: knowledge/a.yaml}\n  - *a\n',
    'schema_version: 2.1\nevents:\n  - {op: allocate, op: promote, id: BR-0001, id_status: provisional, path: knowledge/a.yaml}\n',
    'schema_version: 2.1\nevents:\n  - !!binary {op: allocate}\n',
    'schema_version: "2.1"\nevents:\n',
    'schema_version: 2.1\nevents: "x"\n',
  ]) {
    const dir = await tmp('hostile');
    await put(dir, REGISTRY, text);
    const error = await readIdRegistry(dir).then(() => null, (e) => e);
    if (text.includes('*a')) {
      // an alias to an identical, valid event is a duplicate provisional allocation, which is allowed (E-0012)
      assert.equal(error, null);
    } else {
      assert.ok(error && ['INVALID_YAML', 'INVALID_REGISTRY'].includes(error.code), text);
    }
  }
});
