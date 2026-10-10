// P002 unit tests (implementer-owned; the conformance slice lives in test/conformance-p002-id-registry.test.mjs).
// Every test title starts with the clause or errata entry it exercises (TRACEABILITY.md). Expected registry
// text, entity text and SHAs are built here from the spec/errata, never by the engine under test.
// The superseded checkpoint tests (v1 format: events without `path`, UNRESOLVED_COLLISION, allocation-time
// KF-E-101 throw, `cases:` block of the conformance yaml) were replaced by the tests below (E-0012).
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, stat, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import YAML from 'yaml';
import * as engine from '../framework/engine/id-registry.mjs';

const {
  CORE_ID_PREFIXES, IdRegistryError, allocateId, checkIdCollisions, createGitHistoryReader, initializeIdRegistry,
  promoteIds, readIdRegistry, resolveId,
} = engine;

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE_URL = pathToFileURL(path.join(root, 'framework', 'engine', 'id-registry.mjs')).href;
const HEADER = 'schema_version: 2.1\nevents:\n';
const A = 'knowledge/business-rules/alpha/rule.yaml';
const B = 'knowledge/business-rules/beta/rule.yaml';
const G = 'knowledge/business-rules/gamma/rule.yaml';
const SHA = { a: 'a'.repeat(40), b: 'b'.repeat(40) };
const REGISTRY = '.kf/id-registry.yaml';

// ------------------------------------------------------------------ helpers
const created = [];
after(async () => {
  for (const dir of created.splice(0)) await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }).catch(() => {});
});

async function tmp(label) {
  const dir = await mkdtemp(path.join(await realpath(os.tmpdir()), `kf-u002-${label}-`));
  created.push(dir);
  return dir;
}

const abs = (dir, rel) => path.join(dir, ...rel.split('/'));
const put = async (dir, rel, text) => { await mkdir(path.dirname(abs(dir, rel)), { recursive: true }); await writeFile(abs(dir, rel), text); };
const get = (dir, rel) => readFile(abs(dir, rel), 'utf8');
const registryOf = (dir) => get(dir, REGISTRY);
const alloc = (id, p) => `  - {op: allocate, id: ${id}, id_status: provisional, path: ${p}}\n`;
// a SHA that starts with a digit could read as a number, so the writer quotes it (letters-first stay plain)
const sha40 = (sha) => (/^[a-f]/.test(sha) ? sha : JSON.stringify(sha));
const promo = (id, p, sha) => `  - {op: promote, id: ${id}, path: ${p}, commit: ${sha40(sha)}}\n`;
const aliasLine = (from, to, sha) => `  - {op: alias, from: ${from}, to: ${to}, commit: ${sha40(sha)}}\n`;
const moveLine = (id, from, to) => `  - {op: move, id: ${id}, from: ${from}, to: ${to}}\n`;

async function projectWith(lines, label = 'p') {
  const dir = await tmp(label);
  await put(dir, REGISTRY, HEADER + lines.join(''));
  return dir;
}

const entity = (id, status = 'provisional', name = 'Label') =>
  `# keep me\nschema_version: 2.1\nid: ${id}\nid_status: ${status}\ntype: business-rule\nname: ${name}\n`;

async function snapshot(dir) {
  const out = {};
  async function walk(rel) {
    for (const entry of (await readdir(abs(dir, rel || '.'), { withFileTypes: true })).sort((x, y) => (x.name < y.name ? -1 : 1))) {
      if (rel === '' && entry.name === '.git') continue;
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) { out[`${child}/`] = ''; await walk(child); } else out[child] = await readFile(abs(dir, child), 'latin1');
    }
  }
  await walk('');
  return out;
}

async function assertCode(promise, code) {
  let caught = null;
  try { await promise; } catch (error) { caught = error; }
  assert.ok(caught, `expected rejection ${code}`);
  assert.ok(caught instanceof IdRegistryError, `IdRegistryError expected, got ${caught?.name}: ${caught?.message}`);
  assert.equal(caught.name, 'IdRegistryError');
  assert.equal(caught.code, code, caught.message);
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

async function repo(label, registryLines = [alloc('CAP-0001', 'knowledge/capabilities/seed/capability.yaml')]) {
  const dir = await tmp(label);
  await git(dir, 'init', '-q', '-b', 'main');
  for (const [key, value] of [['core.autocrlf', 'false'], ['core.eol', 'lf'], ['commit.gpgsign', 'false'], ['user.name', 'T'], ['user.email', 't@t.invalid']]) {
    await git(dir, 'config', key, value);
  }
  await put(dir, '.gitattributes', '.kf/id-registry.yaml merge=union\n');
  await put(dir, '.gitignore', '.kf/*.lock/\n.kf/id-registry.yaml.*.tmp\n');
  await put(dir, REGISTRY, HEADER + registryLines.join(''));
  await git(dir, 'add', '-A');
  await git(dir, 'commit', '-q', '-m', 'B0');
  return dir;
}
const commit = async (dir, message) => { await git(dir, 'add', '-A'); await git(dir, 'commit', '-q', '--allow-empty', '-m', message); return git(dir, 'rev-parse', 'HEAD'); };
const promote = (dir, extra = {}) => promoteIds(dir, { canonicalBranch: 'main', ...extra });

/** repo + feature branch with entity A allocated and committed on `feature` only. */
async function featureRepo(label) {
  const dir = await repo(label);
  await git(dir, 'checkout', '-q', '-b', 'feature');
  const got = await allocateId(dir, 'BR', A);
  await put(dir, A, entity(got.id));
  await commit(dir, 'feature');
  await git(dir, 'checkout', '-q', 'main');
  return dir;
}

// ------------------------------------------------------------------ §4.1, §8
test('§4.1: the eleven core prefixes are allocated, anything else is INVALID_PREFIX and mutates nothing', async () => {
  assert.deepEqual([...CORE_ID_PREFIXES], ['CAP', 'BP', 'BR', 'DE', 'OUT', 'SC', 'EV', 'UNK', 'CHG', 'DIV', 'DSP']);
  const dir = await tmp('prefix');
  await initializeIdRegistry(dir);
  for (const prefix of CORE_ID_PREFIXES) assert.equal((await allocateId(dir, prefix, `knowledge/x/${prefix}.yaml`)).id, `${prefix}-0001`);
  const before = await snapshot(dir);
  for (const bad of ['POL', 'ACT', 'MAP', 'br', 'Br', 'BR-', 'BR-0001', ' BR', '', undefined, null, 5, ['BR']]) {
    await assertCode(allocateId(dir, bad, 'knowledge/x/y.yaml'), 'INVALID_PREFIX');
  }
  assert.deepEqual(await snapshot(dir), before);
});

test('§8: IDs are zero-padded to four digits and grow past 9999 without touching earlier IDs', async () => {
  const dir = await projectWith([alloc('BR-0009', A), alloc('BR-9998', B)]);
  assert.equal((await allocateId(dir, 'BR', G)).id, 'BR-9999');
  let before = await registryOf(dir);
  assert.equal((await allocateId(dir, 'BR', 'knowledge/x/1.yaml')).id, 'BR-10000');
  assert.ok((await registryOf(dir)).startsWith(before), 'earlier bytes are an exact prefix');
  before = await registryOf(dir);
  assert.equal((await allocateId(dir, 'BR', 'knowledge/x/2.yaml')).id, 'BR-10001');
  assert.ok((await registryOf(dir)).startsWith(before));
  assert.equal((await allocateId(dir, 'DE', 'knowledge/x/3.yaml')).id, 'DE-0001', 'counters are per prefix');
  await assertCode(resolveId(dir, 'BR-001'), 'INVALID_ID'); // negative: three digits is not an ID
});

test('§8: no ID is reissued after delete, rename, failure, gap or an alias-only highest number', async () => {
  const dir = await repo('reuse', []);
  const ids = [];
  for (const rel of ['knowledge/business-rules/one/rule.yaml', 'knowledge/business-rules/two/rule.yaml', 'knowledge/business-rules/three/rule.yaml']) {
    ids.push((await allocateId(dir, 'BR', rel)).id);
    await put(dir, rel, entity(ids.at(-1)));
  }
  await unlink(abs(dir, 'knowledge/business-rules/three/rule.yaml')); // deleted entity
  await rm(abs(dir, 'knowledge/business-rules/two'), { recursive: true }); // deleted directory
  assert.equal((await allocateId(dir, 'BR', G)).id, 'BR-0004');
  const gap = await projectWith([alloc('BR-0007', A)]);
  assert.equal((await allocateId(gap, 'BR', B)).id, 'BR-0008', 'gaps are not filled');
  const aliased = await projectWith([alloc('BR-0001', A), alloc('BR-0005', B), aliasLine('BR-0001', 'BR-0005', SHA.a)]);
  assert.equal((await allocateId(aliased, 'BR', G)).id, 'BR-0006', 'alias endpoints count');
});

test('§8: the name is a label - changing it neither changes the ID nor creates a collision', async () => {
  const dir = await projectWith([alloc('BR-0001', A), promo('BR-0001', A, SHA.a)]);
  await put(dir, A, entity('BR-0001', 'permanent', 'First name'));
  await put(dir, A, entity('BR-0001', 'permanent', 'A completely different label'));
  const report = await checkIdCollisions(dir);
  assert.deepEqual([report.diagnostics, report.provisional_collisions, report.unregistered], [[], [], []]);
  assert.equal((await resolveId(dir, 'BR-0001')).path, A);
  assert.equal((await allocateId(dir, 'BR', B)).id, 'BR-0002');
});

test('§8.1: agents never assign IDs - an entity with an ID outside the registry fails allocation and promotion closed', async () => {
  const dir = await projectWith([alloc('BR-0001', A)]);
  await put(dir, A, entity('BR-0001'));
  await put(dir, B, entity('BR-0042')); // hand-assigned by an agent
  const before = await snapshot(dir);
  const error = await assertCode(allocateId(dir, 'BR', G), 'UNREGISTERED_ID');
  assert.deepEqual(error.details.unregistered, [{ id: 'BR-0042', path: B }]);
  await assertCode(promoteIds(dir, { canonicalBranch: 'main', history: { firstParentCommits: async () => [], readFile: async () => null } }), 'UNREGISTERED_ID');
  assert.deepEqual(await snapshot(dir), before);
  assert.deepEqual((await checkIdCollisions(dir)).unregistered, [{ id: 'BR-0042', path: B }]);
  await unlink(abs(dir, B)); // negative: once removed, allocation works again
  assert.equal((await allocateId(dir, 'BR', G)).id, 'BR-0002', 'the counter is derived from the registry alone');
});

test('§8.1: the engine allocates from .kf/id-registry.yaml alone - no Git, no entity files', async () => {
  const dir = await tmp('nogit');
  await initializeIdRegistry(dir);
  assert.deepEqual(await allocateId(dir, 'BR', A), { id: 'BR-0001', id_status: 'provisional', path: A });
  assert.equal(await registryOf(dir), `${HEADER}${alloc('BR-0001', A)}`);
  await assert.rejects(stat(abs(dir, '.git')));
  const before = await registryOf(dir);
  await unlink(abs(dir, REGISTRY));
  await assertCode(allocateId(dir, 'BR', B), 'REGISTRY_MISSING'); // negative: never recreated
  await assert.rejects(stat(abs(dir, REGISTRY)));
  assert.equal(before.split('\n').length, 4);
});

test('§8.1: transactional lock - in-process and cross-process allocators get distinct, gapless IDs', async () => {
  const dir = await tmp('lock');
  await initializeIdRegistry(dir);
  const options = { lock: { deadlineMs: 60000, pollMs: 5 } };
  const local = await Promise.all(Array.from({ length: 12 }, (_, i) => allocateId(dir, 'BR', `knowledge/x/l${i}.yaml`, options)));
  const script = 'const e = await import(process.argv[1]); const ids = [];'
    + 'for (let i = 0; i < 4; i++) ids.push((await e.allocateId(process.argv[2], "BR", `knowledge/x/${process.argv[3]}${i}.yaml`, {lock: {deadlineMs: 60000, pollMs: 5}})).id);'
    + 'process.stdout.write(JSON.stringify(ids));';
  const remote = await Promise.all([0, 1, 2].map(async (n) => JSON.parse((await exec(process.execPath, ['--input-type=module', '-e', script, ENGINE_URL, dir, `r${n}-`])).stdout)));
  const all = [...local.map((x) => x.id), ...remote.flat()].sort();
  assert.deepEqual(all, Array.from({ length: 24 }, (_, i) => `BR-${String(i + 1).padStart(4, '0')}`));
  assert.equal((await readIdRegistry(dir)).events.length, 24);
  assert.deepEqual((await readdir(abs(dir, '.kf'))).filter((n) => /lock|tmp/.test(n)), []);
});

// ------------------------------------------------------------------ §8.2 promotion and collisions
test('§8.2: an ID is permanent only after its first appearance on the canonical branch (l.308, l.315)', async () => {
  const dir = await featureRepo('canon');
  await git(dir, 'checkout', '-q', 'feature'); // checked out on the non-canonical branch
  const before = await snapshot(dir);
  const result = await promote(dir);
  assert.deepEqual([result.promoted, result.renumbered, result.entities_rewritten, result.diagnostics], [[], [], [], []]);
  assert.deepEqual(await snapshot(dir), before, 'allocation on a non-canonical branch stays provisional');
  assert.match(await get(dir, A), /id_status: provisional/);
  await git(dir, 'checkout', '-q', 'main');
  await git(dir, 'merge', '--no-ff', '-q', '-m', 'M', 'feature');
  const merged = await git(dir, 'rev-parse', 'HEAD');
  const after = await promote(dir);
  assert.deepEqual(after.promoted, [{ id: 'BR-0001', path: A, commit: merged }]);
  assert.match(await get(dir, A), /id_status: permanent/);
});

test('§8.2: promotion on canonical entry by merge commit, fast-forward and squash (l.316, l.1117)', async () => {
  for (const mode of ['merge', 'ff', 'squash']) {
    const dir = await featureRepo(`entry-${mode}`);
    let expected;
    if (mode === 'merge') { await git(dir, 'merge', '--no-ff', '-q', '-m', 'M', 'feature'); expected = await git(dir, 'rev-parse', 'HEAD'); }
    if (mode === 'ff') { await git(dir, 'merge', '--ff-only', '-q', 'feature'); expected = await git(dir, 'rev-parse', 'feature'); }
    if (mode === 'squash') { await git(dir, 'merge', '--squash', '-q', 'feature'); expected = await commit(dir, 'S'); }
    const [first] = (await git(dir, 'rev-list', '--first-parent', '--reverse', 'main')).split('\n').slice(-1);
    assert.equal(first, expected);
    const result = await promote(dir);
    assert.deepEqual(result.promoted, [{ id: 'BR-0001', path: A, commit: expected }], mode);
    assert.ok((await registryOf(dir)).endsWith(promo('BR-0001', A, expected)), `${mode}: ${JSON.stringify(await registryOf(dir))}`);
  }
  // negative: a side-branch commit that is not first-parent history is never recorded
  const dir = await featureRepo('side');
  const featureCommit = await git(dir, 'rev-parse', 'feature');
  await git(dir, 'merge', '--no-ff', '-q', '-m', 'M', 'feature');
  assert.notEqual((await promote(dir)).promoted[0].commit, featureCommit);
});

test('§8.2: provisional colliders - the later first_canonical_commit is renumbered with an alias (l.317)', async () => {
  const dir = await repo('collide');
  await git(dir, 'checkout', '-q', '-b', 'f1');
  await allocateId(dir, 'BR', A); await put(dir, A, entity('BR-0001', 'provisional', 'Alpha')); await commit(dir, 'f1');
  await git(dir, 'checkout', '-q', 'main');
  await git(dir, 'checkout', '-q', '-b', 'f2');
  await allocateId(dir, 'BR', B); await put(dir, B, entity('BR-0001', 'provisional', 'Beta')); await commit(dir, 'f2');
  await git(dir, 'checkout', '-q', 'main');
  await git(dir, 'merge', '--no-ff', '-q', '-m', 'M1', 'f1'); const M1 = await git(dir, 'rev-parse', 'HEAD');
  await git(dir, 'merge', '--no-ff', '-q', '-m', 'M2', 'f2'); const M2 = await git(dir, 'rev-parse', 'HEAD');
  const result = await promote(dir);
  assert.deepEqual(result.promoted, [{ id: 'BR-0001', path: A, commit: M1 }]);
  assert.deepEqual(result.renumbered, [{ from: 'BR-0001', to: 'BR-0002', path: B, commit: M2 }]);
  const registry = await registryOf(dir);
  assert.ok(registry.endsWith(promo('BR-0001', A, M1) + alloc('BR-0002', B) + aliasLine('BR-0001', 'BR-0002', M2)));
  assert.equal(await get(dir, B), '# keep me\nschema_version: 2.1\nid: BR-0002\nid_status: provisional\nid_alias: [BR-0001]\ntype: business-rule\nname: Beta\n');
  assert.equal(await get(dir, A), entity('BR-0001', 'permanent', 'Alpha'));
  // negative: BR-0001 is permanent now; the renumbered entity is never promoted by the same call
  assert.equal(registry.split('\n').filter((l) => l.includes('op: promote')).length, 1);
});

test('§8.2: a permanent ID is never renumbered; any collision with it is KF-E-101 and nothing is rewritten (l.318, E-0010)', async () => {
  const dir = await projectWith([alloc('BR-0001', A), promo('BR-0001', A, SHA.a), alloc('BR-0001', B)]);
  await put(dir, A, entity('BR-0001', 'permanent'));
  await put(dir, B, entity('BR-0001', 'provisional'));
  const report = await checkIdCollisions(dir);
  assert.equal(report.diagnostics.length, 1);
  assert.deepEqual({ ...report.diagnostics[0], message: undefined }, {
    code: 'KF-E-101', severity: 'E', remediation: 'resolución manual', id: 'BR-0001', path: B, permanent_path: A, message: undefined,
  });
  assert.equal(typeof report.diagnostics[0].message, 'string');
  const before = await snapshot(dir);
  const history = { firstParentCommits: async () => [SHA.b], readFile: async () => entity('BR-0001') };
  const result = await promoteIds(dir, { canonicalBranch: 'main', history });
  assert.equal(result.diagnostics.length, 1, 'returned, not thrown (E-0015 D-03c)');
  assert.deepEqual([result.promoted, result.renumbered, result.entities_rewritten], [[], [], []]);
  assert.deepEqual(await snapshot(dir), before);
  // negative: the same ID held by one file at the promoted path is clean
  await unlink(abs(dir, B));
  assert.deepEqual((await checkIdCollisions(dir)).diagnostics, []);
});

test('§8.2: id_alias resolves indefinitely; the live holder wins with a code-less warning (l.319, E-0003)', async () => {
  const dir = await projectWith([alloc('BR-0001', A), promo('BR-0001', A, SHA.a), alloc('BR-0002', B), aliasLine('BR-0001', 'BR-0002', SHA.b)]);
  await put(dir, A, entity('BR-0001', 'permanent'));
  await put(dir, B, `${entity('BR-0002').replace('id_status: provisional\n', 'id_status: provisional\nid_alias: [BR-0001]\n')}`);
  const live = await resolveId(dir, 'BR-0001');
  assert.equal(live.status, 'live');
  assert.equal(live.path, A);
  assert.equal(live.warnings.length, 1);
  assert.deepEqual(Object.keys(live.warnings[0]).sort(), ['alias_from', 'alias_to', 'kind', 'message']);
  await unlink(abs(dir, A));
  const viaAlias = await resolveId(dir, 'BR-0001');
  assert.deepEqual([viaAlias.status, viaAlias.id, viaAlias.path, viaAlias.via, viaAlias.warnings], ['alias', 'BR-0002', B, ['BR-0001', 'BR-0002'], []]);
  assert.deepEqual(await resolveId(dir, 'BR-0001'), viaAlias, 'pure function of registry and tree');
  assert.equal((await resolveId(dir, 'BR-0003')).status, 'unresolved'); // negative
});

// ------------------------------------------------------------------ §9, §9.1, §10.7, §10.8
test('§9: the registry is .kf/id-registry.yaml; missing is REGISTRY_MISSING for every operation and is never recreated', async () => {
  const dir = await tmp('missing');
  await put(dir, A, entity('BR-0001'));
  const history = { firstParentCommits: async () => [], readFile: async () => null };
  for (const call of [() => readIdRegistry(dir), () => allocateId(dir, 'BR', B), () => promoteIds(dir, { canonicalBranch: 'main', history }),
    () => checkIdCollisions(dir), () => resolveId(dir, 'BR-0001')]) await assertCode(call(), 'REGISTRY_MISSING');
  await assert.rejects(stat(abs(dir, '.kf')), 'no .kf/ appeared');
  await assertCode(initializeIdRegistry(dir), 'EXISTING_ENTITIES');
  await unlink(abs(dir, A));
  await initializeIdRegistry(dir);
  assert.equal(await registryOf(dir), HEADER);
  await assertCode(initializeIdRegistry(dir), 'REGISTRY_EXISTS');
});

test('§9.1: .kf is append-only - allocation and promotion only append lines', async () => {
  const dir = await featureRepo('append');
  await git(dir, 'merge', '--no-ff', '-q', '-m', 'M', 'feature');
  const seen = [await registryOf(dir)];
  await allocateId(dir, 'DE', 'knowledge/data/x/entity.yaml'); seen.push(await registryOf(dir));
  await promote(dir); seen.push(await registryOf(dir));
  await allocateId(dir, 'BR', B); seen.push(await registryOf(dir));
  for (let i = 1; i < seen.length; i += 1) assert.ok(seen[i].startsWith(seen[i - 1]) && seen[i].length > seen[i - 1].length, `step ${i}`);
  assert.equal((await registryOf(dir)).split('\n').filter((l) => l.startsWith('  - {')).length, 5);
});

test('§10.7: only the bare entity address is resolved; fragment addresses are INVALID_ID', async () => {
  const dir = await projectWith([alloc('BR-0001', A)]);
  await put(dir, A, entity('BR-0001'));
  assert.equal((await resolveId(dir, 'BR-0001')).status, 'live');
  for (const bad of ['BR-0001#specified', 'BR-0001#observed:legacy', 'br-0001', 'BR-1', '', 'BR-0001 ', 7, null, undefined]) {
    await assertCode(resolveId(dir, bad), 'INVALID_ID');
  }
});

test('§10.8: the engine writes no time or commit fields into entity files', async () => {
  const dir = await featureRepo('notime');
  await git(dir, 'merge', '--no-ff', '-q', '-m', 'M', 'feature');
  const sha = (await promote(dir)).promoted[0].commit;
  const text = await get(dir, A);
  assert.ok(!text.includes(sha) && !/created_at|updated_at|first_canonical_commit|commit/.test(text));
  assert.deepEqual(Object.keys(YAML.parse(text)), ['schema_version', 'id', 'id_status', 'type', 'name']);
});

// ------------------------------------------------------------------ §19.1, §36, §42.2
test('§19.1: first_canonical_commit is the first first-parent commit carrying the file with that ID; history is never rewritten', async () => {
  const dir = await repo('first');
  await git(dir, 'checkout', '-q', '-b', 'feature');
  await allocateId(dir, 'BR', A);
  await put(dir, A, entity('BR-0009')); await commit(dir, 'c1 other id');
  await put(dir, A, entity('BR-0001')); const c2 = await commit(dir, 'c2');
  await git(dir, 'checkout', '-q', 'main');
  await git(dir, 'merge', '--no-ff', '-q', '-m', 'M', 'feature');
  const M = await git(dir, 'rev-parse', 'HEAD');
  assert.notEqual(M, c2, 'c2 is reachable from main but is not first-parent history');
  const first = await promote(dir);
  assert.equal(first.promoted[0].commit, M);
  await commit(dir, 'promotion result');
  await put(dir, 'notes/x.txt', 'later\n'); await commit(dir, 'later canonical commit');
  const again = await promote(dir);
  assert.deepEqual([again.promoted, again.entities_rewritten], [[], []]);
  assert.equal((await readIdRegistry(dir)).events.find((e) => e.op === 'promote').commit, M, 'recorded commit is stable as canonical advances');
});

test('§19.1: a shallow repository is refused (HISTORY_INCOMPLETE) and nothing changes', async () => {
  const dir = await featureRepo('shallow-src');
  await git(dir, 'merge', '--no-ff', '-q', '-m', 'M', 'feature');
  await put(dir, 'notes/a.txt', 'a\n'); await commit(dir, 'c3');
  const clone = await tmp('shallow');
  await exec('git', ['clone', '-q', '--depth', '1', pathToFileURL(dir).href, clone], { env: gitEnv() });
  const before = await snapshot(clone);
  await assertCode(promote(clone), 'HISTORY_INCOMPLETE');
  assert.deepEqual(await snapshot(clone), before);
});

test('§36.1: engine errors are typed, internal codes - no invented KF- code (E-0014)', async () => {
  const dir = await tmp('codes');
  await put(dir, REGISTRY, 'events: [invalid\n');
  const seen = new Map();
  for (const call of [() => readIdRegistry(dir), () => allocateId(dir, 'ZZ', A), () => allocateId(dir, 'BR', '/abs'), () => promoteIds(dir, {}),
    () => resolveId(dir, 'x'), () => promoteIds(dir, { canonicalBranch: 'main', history: { firstParentCommits: async () => [], readFile: async () => null } })]) {
    try { await call(); assert.fail('should reject'); } catch (error) { seen.set(error.code, error); }
  }
  assert.deepEqual([...seen.keys()].sort(), ['CANONICAL_BRANCH_REQUIRED', 'INVALID_ID', 'INVALID_PATH', 'INVALID_PREFIX', 'INVALID_YAML']);
  for (const [code, error] of seen) { assert.ok(!code.startsWith('KF-'), code); assert.ok(error instanceof Error && error.name === 'IdRegistryError'); }
});

test('§42.2: KF-E-101 diagnostics carry exactly the catalog fields and only for permanent collisions', async () => {
  const dir = await projectWith([alloc('BR-0001', A), promo('BR-0001', A, SHA.a)]);
  await put(dir, A, entity('BR-0001', 'permanent'));
  await put(dir, G, entity('BR-0001', 'permanent'));
  const [diagnostic, ...rest] = (await checkIdCollisions(dir)).diagnostics;
  assert.deepEqual(rest, []);
  assert.deepEqual(Object.keys(diagnostic).sort(), ['code', 'id', 'message', 'path', 'permanent_path', 'remediation', 'severity']);
  assert.deepEqual([diagnostic.code, diagnostic.severity, diagnostic.remediation, diagnostic.id, diagnostic.path, diagnostic.permanent_path],
    ['KF-E-101', 'E', 'resolución manual', 'BR-0001', G, A]);
  // negative: two provisional holders are not a KF-E-101
  const provisional = await projectWith([alloc('BR-0002', A), alloc('BR-0002', B)]);
  await put(provisional, A, entity('BR-0002')); await put(provisional, B, entity('BR-0002'));
  const report = await checkIdCollisions(provisional);
  assert.deepEqual(report.diagnostics, []);
  assert.deepEqual(report.provisional_collisions, [{ id: 'BR-0002', paths: [A, B] }]);
});

// ------------------------------------------------------------------ errata
test('E-0001: canonicalBranch is explicit - never assumed, never read from the checked-out branch or configuration', async () => {
  const dir = await featureRepo('e0001');
  await git(dir, 'merge', '--no-ff', '-q', '-m', 'M', 'feature');
  await put(dir, 'workspace.yaml', 'knowledge:\n  canonical_branch: main\n'); // must be ignored
  await git(dir, 'branch', '-m', 'main', 'trunk');
  await assertCode(promote(dir), 'CANONICAL_BRANCH_UNRESOLVED');
  for (const bad of [undefined, '', 42, null, {}]) await assertCode(promoteIds(dir, { canonicalBranch: bad }), 'CANONICAL_BRANCH_REQUIRED');
  await assertCode(promoteIds(dir), 'CANONICAL_BRANCH_REQUIRED');
  await assertCode(promoteIds(dir, { canonicalBranch: '-x' }), 'CANONICAL_BRANCH_UNRESOLVED');
  assert.equal((await promoteIds(dir, { canonicalBranch: 'trunk' })).promoted.length, 1);
});

test('E-0002: same-commit ties go to the smaller UTF-8 byte-order path (not UTF-16 order)', async () => {
  const bmp = `knowledge/business-rules/${String.fromCharCode(0xff5e)}/rule.yaml`; // EF BD 9E
  const astral = `knowledge/business-rules/${String.fromCodePoint(0x1f600)}/rule.yaml`; // F0 9F 98 80
  assert.ok(astral < bmp, 'UTF-16 code unit order would pick the astral path');
  assert.ok(Buffer.compare(Buffer.from(bmp), Buffer.from(astral)) < 0, 'UTF-8 byte order picks the BMP path');
  const dir = await repo('e0002', [alloc('BR-0001', astral)]);
  await git(dir, 'checkout', '-q', '-b', 'feat');
  await put(dir, astral, entity('BR-0001', 'provisional', 'astral'));
  await put(dir, bmp, entity('BR-0001', 'provisional', 'bmp'));
  await commit(dir, 'feat');
  await git(dir, 'checkout', '-q', 'main');
  await git(dir, 'merge', '--no-ff', '-q', '-m', 'M', 'feat');
  const result = await promote(dir);
  assert.deepEqual(result.promoted.map((p) => p.path), [bmp]);
  assert.deepEqual(result.renumbered.map((r) => [r.path, r.to]), [[astral, 'BR-0002']]);
});

test('E-0003: the live holder wins; an alias is used only when the ID is unheld, and the alias chain stops at the first live holder', async () => {
  const events = [alloc('BR-0001', A), alloc('BR-0002', B), alloc('BR-0003', G), aliasLine('BR-0001', 'BR-0002', SHA.a), aliasLine('BR-0002', 'BR-0003', SHA.b)];
  const dir = await projectWith(events);
  await put(dir, G, entity('BR-0003'));
  assert.deepEqual((await resolveId(dir, 'BR-0001')).via, ['BR-0001', 'BR-0002', 'BR-0003']);
  await put(dir, B, entity('BR-0002'));
  assert.deepEqual((await resolveId(dir, 'BR-0001')).via, ['BR-0001', 'BR-0002']);
  const live = await resolveId(dir, 'BR-0002');
  assert.deepEqual([live.status, live.warnings.map((w) => w.alias_to)], ['live', ['BR-0003']]);
});

test('E-0004: a promoted ID keeps its holder path; an unrecorded move is KF-E-101, a recorded move is clean', async () => {
  const dir = await projectWith([alloc('BR-0001', A), promo('BR-0001', A, SHA.a)]);
  await put(dir, G, entity('BR-0001', 'permanent'));
  const [diagnostic] = (await checkIdCollisions(dir)).diagnostics;
  assert.deepEqual([diagnostic.path, diagnostic.permanent_path], [G, A]);
  const recorded = await projectWith([alloc('BR-0001', A), promo('BR-0001', A, SHA.a), moveLine('BR-0001', A, G)]);
  await put(recorded, G, entity('BR-0001', 'permanent'));
  assert.deepEqual((await checkIdCollisions(recorded)).diagnostics, []);
  assert.equal((await resolveId(recorded, 'BR-0001')).path, G);
  await put(recorded, A, entity('BR-0001', 'permanent')); // the old path is now the offender
  assert.deepEqual((await checkIdCollisions(recorded)).diagnostics.map((d) => [d.path, d.permanent_path]), [[A, G]]);
  // deleted and recreated at the same path is the same holder
  const again = await projectWith([alloc('BR-0001', A), promo('BR-0001', A, SHA.a)]);
  await put(again, A, entity('BR-0001', 'permanent')); await unlink(abs(again, A)); await put(again, A, entity('BR-0001', 'permanent'));
  assert.deepEqual((await checkIdCollisions(again)).diagnostics, []);
});

test('E-0007: union-merged registries replay - both appended allocations survive and the next ID skips them', async () => {
  const dir = await repo('e0007');
  await git(dir, 'checkout', '-q', '-b', 'f1'); await allocateId(dir, 'BR', A); await commit(dir, 'f1');
  await git(dir, 'checkout', '-q', 'main'); await git(dir, 'checkout', '-q', '-b', 'f2'); await allocateId(dir, 'BR', B); await commit(dir, 'f2');
  await git(dir, 'checkout', '-q', 'main');
  await git(dir, 'merge', '--no-ff', '-q', '-m', 'M1', 'f1');
  await git(dir, 'merge', '--no-ff', '-q', '-m', 'M2', 'f2');
  const text = await registryOf(dir);
  assert.ok(!/^(<<<<<<<|=======|>>>>>>>)/m.test(text));
  assert.deepEqual((await readIdRegistry(dir)).events.filter((e) => e.id === 'BR-0001').map((e) => e.path), [A, B]);
  assert.equal((await allocateId(dir, 'BR', G)).id, 'BR-0002');
  // negative: duplicate keys (a union of two `events:` headers) are invalid YAML, not silently merged
  await put(dir, REGISTRY, 'schema_version: 2.1\nevents: []\nevents: []\n');
  await assertCode(readIdRegistry(dir), 'INVALID_YAML');
});

test('E-0008(a): the catalog row used is §42.2 l.1742 - KF-E-101 is the only KF- identifier code the engine emits', async () => {
  const sources = await Promise.all(['id-registry.mjs', 'id-registry-codec.mjs', 'id-registry-lock.mjs', 'id-registry-entities.mjs', 'id-registry-git.mjs', 'id-registry-errors.mjs']
    .map((name) => readFile(path.join(root, 'framework', 'engine', name), 'utf8')));
  const codes = new Set(sources.flatMap((source) => source.match(/KF-[A-Z]-\d+/g) ?? []));
  assert.deepEqual([...codes], ['KF-E-101']);
});

test('E-0009: ordering is by first-parent index, never by timestamp, via an injected history reader', async () => {
  const sha = (n) => `${'c'.repeat(39)}${n}`;
  const dir = await projectWith([alloc('BR-0001', A), alloc('BR-0001', B)]);
  await put(dir, A, entity('BR-0001')); await put(dir, B, entity('BR-0001'));
  const present = { [A]: [sha(5)], [B]: [sha(2), sha(5)] }; // B enters earlier although its path sorts later
  const calls = [];
  const history = {
    firstParentCommits: async (branch) => { calls.push(branch); return [1, 2, 3, 4, 5].map(sha); },
    readFile: async (commit, p) => (present[p].includes(commit) ? entity('BR-0001') : null),
  };
  const result = await promoteIds(dir, { canonicalBranch: 'canon', history });
  assert.deepEqual(result.promoted, [{ id: 'BR-0001', path: B, commit: sha(2) }]);
  assert.deepEqual(result.renumbered, [{ from: 'BR-0001', to: 'BR-0002', path: A, commit: sha(5) }]);
  assert.deepEqual(calls, ['canon']);
  // negative: a malformed SHA from a reader is refused before anything is written
  const bad = await projectWith([alloc('BR-0001', A)]);
  await put(bad, A, entity('BR-0001'));
  const before = await snapshot(bad);
  await assertCode(promoteIds(bad, { canonicalBranch: 'x', history: { firstParentCommits: async () => ['NOTASHA'], readFile: async () => null } }), 'GIT_FAILED');
  assert.deepEqual(await snapshot(bad), before);
});

test('E-0010: provisional-vs-permanent - KF-E-101 on the non-matching path, holder untouched, no renumbering', async () => {
  const dir = await projectWith([alloc('BR-0001', A), promo('BR-0001', A, SHA.a), alloc('BR-0001', B)]);
  await put(dir, A, entity('BR-0001', 'permanent')); await put(dir, B, entity('BR-0001'));
  const events = (await registryOf(dir));
  const result = await promoteIds(dir, { canonicalBranch: 'main', history: { firstParentCommits: async () => [SHA.b], readFile: async () => entity('BR-0001') } });
  assert.deepEqual(result.diagnostics.map((d) => [d.id, d.path, d.permanent_path]), [['BR-0001', B, A]]);
  assert.equal(await registryOf(dir), events);
  assert.equal(await get(dir, B), entity('BR-0001'));
  assert.equal(await get(dir, A), entity('BR-0001', 'permanent'));
});

test('E-0011: entity identity fields are a projection of the registry - rewrite touches only id, id_status, id_alias', async () => {
  const dir = await featureRepo('e0011');
  await git(dir, 'merge', '--no-ff', '-q', '-m', 'M', 'feature');
  const original = await get(dir, A);
  await promote(dir);
  assert.equal(await get(dir, A), original.replace('id_status: provisional', 'id_status: permanent'));
  // converge: a drifted status is rewritten back without a new event
  const registry = await registryOf(dir);
  await put(dir, A, original);
  const result = await promote(dir);
  assert.deepEqual([result.promoted, result.entities_rewritten], [[], [A]]);
  assert.equal(await registryOf(dir), registry);
  assert.equal(await get(dir, A), original.replace('id_status: provisional', 'id_status: permanent'));
  // a converged file is left alone: a further call rewrites nothing
  const text = await get(dir, A);
  assert.deepEqual((await promote(dir)).entities_rewritten, []);
  assert.equal(await get(dir, A), text);
});

test('E-0012: events are one flow-mapping line each, keys in order, hostile values quoted and round-tripped', async () => {
  const dir = await tmp('e0012');
  await initializeIdRegistry(dir);
  const paths = ['knowledge/a, b/rule.yaml', 'knowledge/c: d/rule.yaml', 'knowledge/e # f/rule.yaml', 'knowledge/{g}/rule.yaml',
    'knowledge/null/rule.yaml', 'true', 'knowledge/h"i/rule.yaml', 'knowledge/ j/rule.yaml', 'knowledge/k/rule.yaml ', `knowledge/${'x'.repeat(400)}.yaml`,
    `knowledge/${String.fromCharCode(0x2028)}/rule.yaml`, 'knowledge/é/rule.yaml'];
  for (const p of paths) await allocateId(dir, 'BR', p);
  const text = await registryOf(dir);
  const lines = text.split('\n');
  assert.equal(lines[0], 'schema_version: 2.1');
  assert.equal(lines[1], 'events:');
  assert.equal(lines.at(-1), '');
  assert.equal(lines.length, paths.length + 3);
  for (const [i, line] of lines.slice(2, -1).entries()) {
    assert.ok(line.startsWith('  - {op: allocate, id: BR-') && line.endsWith('}'), line.slice(0, 40));
    assert.deepEqual(YAML.parse(line.slice(4)), { op: 'allocate', id: `BR-${String(i + 1).padStart(4, '0')}`, id_status: 'provisional', path: paths[i] });
  }
  assert.deepEqual((await readIdRegistry(dir)).events.map((e) => e.path), paths);
  for (const bad of ['a\nb.yaml', `a${String.fromCharCode(1)}b`, '', '/a', 'a//b', 'a/./b', '../a', 'C:/a', 'a\\b']) await assertCode(allocateId(dir, 'BR', bad), 'INVALID_PATH');
  assert.equal(await registryOf(dir), text, 'rejections do not touch the registry');
  assert.deepEqual(Object.keys((await readIdRegistry(dir)).events[0]), ['op', 'id', 'id_status', 'path']);
});

test('E-0012: replay validity - every malformed event is INVALID_REGISTRY, near-misses read, the file is never changed', async () => {
  const base = [alloc('BR-0001', A), alloc('BR-0002', B)];
  const invalid = {
    'unknown op': '  - {op: delete, id: BR-0001}\n',
    'allocate permanent': '  - {op: allocate, id: BR-0003, id_status: permanent, path: knowledge/x.yaml}\n',
    'extra key': '  - {op: allocate, id: BR-0003, id_status: provisional, path: knowledge/x.yaml, actor: me}\n',
    'missing key': '  - {op: allocate, id: BR-0003, path: knowledge/x.yaml}\n',
    'bad id': '  - {op: allocate, id: bR-0003, id_status: provisional, path: knowledge/x.yaml}\n',
    'short id': '  - {op: allocate, id: BR-003, id_status: provisional, path: knowledge/x.yaml}\n',
    'bad commit': promo('BR-0001', A, 'abc'),
    'uppercase commit': promo('BR-0001', A, 'A'.repeat(40)),
    'double promote': promo('BR-0001', A, SHA.a) + promo('BR-0001', A, SHA.b),
    'promote without allocate': promo('BR-0009', A, SHA.a),
    'alias self': aliasLine('BR-0001', 'BR-0001', SHA.a),
    'alias dangling': aliasLine('BR-0001', 'BR-0009', SHA.a),
    'alias cycle': aliasLine('BR-0001', 'BR-0002', SHA.a) + aliasLine('BR-0002', 'BR-0001', SHA.a),
    'move wrong from': promo('BR-0001', A, SHA.a) + moveLine('BR-0001', G, B),
    'move without promote': moveLine('BR-0001', A, B),
    'path traversal': '  - {op: allocate, id: BR-0003, id_status: provisional, path: "../x.yaml"}\n',
    'control character in path': '  - {op: allocate, id: BR-0003, id_status: provisional, path: "a\\x01b"}\n',
    'non-string value': '  - {op: allocate, id: BR-0003, id_status: provisional, path: 5}\n',
    'not a mapping': '  - plain\n',
  };
  for (const [name, extra] of Object.entries(invalid)) {
    const dir = await tmp('replay');
    const text = HEADER + base.join('') + extra;
    await put(dir, REGISTRY, text);
    await assertCode(readIdRegistry(dir), 'INVALID_REGISTRY').catch((error) => { error.message = `${name}: ${error.message}`; throw error; });
    await assertCode(allocateId(dir, 'BR', G), 'INVALID_REGISTRY');
    assert.equal(await registryOf(dir), text, name);
  }
  const valid = {
    'duplicate provisional allocation': alloc('BR-0001', G),
    'allocate after promote': promo('BR-0001', A, SHA.a) + alloc('BR-0001', G),
    'promote before its allocate line': promo('BR-0004', G, SHA.a) + alloc('BR-0004', G),
    'move chain': promo('BR-0001', A, SHA.a) + moveLine('BR-0001', A, G) + moveLine('BR-0001', G, B),
    '64 hex commit': promo('BR-0001', A, 'f'.repeat(64)),
    'alias chain': aliasLine('BR-0001', 'BR-0002', SHA.a),
  };
  for (const [name, extra] of Object.entries(valid)) {
    const dir = await tmp('replay-ok');
    await put(dir, REGISTRY, HEADER + base.join('') + extra);
    assert.ok((await readIdRegistry(dir)).events.length >= 3, name);
  }
  for (const [text, code] of [['', 'INVALID_REGISTRY'], ['schema_version: 2.0\nevents:\n', 'INVALID_REGISTRY'], ['schema_version: 2.1\nevents: {a: 1}\n', 'INVALID_REGISTRY'],
    ['schema_version: 2.1\nevents:\nextra: 1\n', 'INVALID_REGISTRY'], ['events: [invalid\n', 'INVALID_YAML'], ['schema_version: 2.1\n---\nschema_version: 2.1\n', 'INVALID_YAML']]) {
    const dir = await tmp('corrupt');
    await put(dir, REGISTRY, text);
    await assertCode(readIdRegistry(dir), code);
  }
});

test('E-0012: the empty registry is two exact lines (E-0015 D-05); null and [] events read as empty and gain events by append', async () => {
  const dir = await tmp('empty');
  assert.deepEqual(await initializeIdRegistry(dir), { schema_version: 2.1, events: [] });
  assert.equal(await registryOf(dir), 'schema_version: 2.1\nevents:\n');
  for (const text of ['schema_version: 2.1\nevents: []\n', 'schema_version: 2.1\nevents:\n']) {
    await put(dir, REGISTRY, text);
    assert.deepEqual((await readIdRegistry(dir)).events, []);
    await allocateId(dir, 'BR', A);
    assert.equal(await registryOf(dir), `${HEADER}${alloc('BR-0001', A)}`);
  }
});

test('E-0012: a hand-written registry in block style is still appended to, with its events preserved', async () => {
  const dir = await tmp('block');
  await put(dir, REGISTRY, 'schema_version: 2.1\nevents:\n- op: allocate\n  id: BR-0001\n  id_status: provisional\n  path: knowledge/a.yaml\n');
  assert.equal((await allocateId(dir, 'BR', B)).id, 'BR-0002');
  assert.deepEqual((await readIdRegistry(dir)).events.map((e) => [e.id, e.path]), [['BR-0001', 'knowledge/a.yaml'], ['BR-0002', B]]);
  await put(dir, REGISTRY, `${HEADER.replace('\n', '\r\n').replace('events:\n', 'events:\r\n')}${alloc('BR-0001', A).replace('\n', '\r\n')}`);
  assert.equal((await allocateId(dir, 'BR', B)).id, 'BR-0002');
  assert.ok(!(await registryOf(dir)).includes('\r'), 'LF output');
});

test('E-0013: staleness needs age AND same host AND a dead pid - injected clock, host and liveness', async () => {
  const now = new Date('2026-06-01T12:00:00.000Z');
  const lock = (over) => ({ deadlineMs: 150, pollMs: 5, staleAfterMs: 60000, hostname: 'h1', now: () => now, isProcessAlive: () => false, ...over });
  const owner = (over) => JSON.stringify({ pid: 4242, host: 'h1', acquired_at: new Date(now.getTime() - 120000).toISOString(), ...over });
  const attempt = async (ownerText, over = {}) => {
    const dir = await projectWith([alloc('BR-0001', A)]);
    await put(dir, '.kf/id-registry.lock/owner.json', ownerText);
    const bytes = await registryOf(dir);
    const outcome = await allocateId(dir, 'BR', B, { lock: lock(over) }).then(() => 'acquired', (error) => error.code);
    return { outcome, kept: await stat(abs(dir, '.kf/id-registry.lock')).then(() => true, () => false), same: bytes === await registryOf(dir) };
  };
  assert.deepEqual(await attempt(owner({})), { outcome: 'acquired', kept: false, same: false });
  assert.deepEqual(await attempt(owner({ acquired_at: new Date(now.getTime() - 5000).toISOString() })), { outcome: 'LOCK_TIMEOUT', kept: true, same: true });
  assert.deepEqual(await attempt(owner({ host: 'h2' })), { outcome: 'LOCK_TIMEOUT', kept: true, same: true });
  assert.deepEqual(await attempt(owner({}), { isProcessAlive: (pid) => pid === 4242 }), { outcome: 'LOCK_TIMEOUT', kept: true, same: true });
  assert.deepEqual(await attempt(owner({}), { staleAfterMs: 130000 }), { outcome: 'LOCK_TIMEOUT', kept: true, same: true });
  for (const bad of ['{not json', '{}', JSON.stringify({ pid: 'x', host: 'h1', acquired_at: now.toISOString() }), JSON.stringify({ pid: 1, host: 'h1', acquired_at: 'yesterday' })]) {
    assert.deepEqual(await attempt(bad), { outcome: 'LOCK_TIMEOUT', kept: true, same: true }, bad);
  }
});

test('E-0013: the default liveness probe and deadline work against real processes', async () => {
  const dir = await projectWith([alloc('BR-0001', A)]);
  const dead = await new Promise((resolve) => { const child = execFile(process.execPath, ['-e', '0']); const { pid } = child; child.on('exit', () => resolve(pid)); });
  await put(dir, '.kf/id-registry.lock/owner.json', JSON.stringify({ pid: dead, host: os.hostname(), acquired_at: new Date(Date.now() - 600000).toISOString() }));
  assert.equal((await allocateId(dir, 'BR', B)).id, 'BR-0002', 'a dead owner on this host is recovered with default options');
  await put(dir, '.kf/id-registry.lock/owner.json', JSON.stringify({ pid: process.pid, host: os.hostname(), acquired_at: new Date(Date.now() - 600000).toISOString() }));
  const started = Date.now();
  await assertCode(allocateId(dir, 'BR', G, { lock: { deadlineMs: 80 } }), 'LOCK_TIMEOUT');
  assert.ok(Date.now() - started < 3000);
});

test('E-0014: P002 is an engine API - no bin/, no package.json bin, no CLI', async () => {
  await assert.rejects(stat(path.join(root, 'bin')));
  assert.ok(!('bin' in JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))));
  assert.deepEqual(Object.keys(engine).sort(), ['CORE_ID_PREFIXES', 'IdRegistryError', 'allocateId', 'checkIdCollisions', 'createGitHistoryReader',
    'initializeIdRegistry', 'promoteIds', 'readIdRegistry', 'resolveId']);
});

test('E-0015: D-01 initialize over a pre-existing .kf/ and D-04 owner-less locks are never auto-broken', async () => {
  const dir = await tmp('d01');
  await put(dir, '.kf/notes.txt', 'operational');
  await put(dir, 'knowledge/business-rules/alpha/observed/legacy.yaml', 'schema_version: 2.1\nentity: BR-0001\n'); // a facet file is not a record
  await initializeIdRegistry(dir);
  assert.equal(await registryOf(dir), HEADER);
  const held = await tmp('d04');
  await mkdir(abs(held, '.kf/id-registry.lock'), { recursive: true });
  const error = await assertCode(initializeIdRegistry(held, { lock: { deadlineMs: 100, pollMs: 5 } }), 'LOCK_TIMEOUT');
  assert.ok(error.message.includes('id-registry.lock'));
  await stat(abs(held, '.kf/id-registry.lock'));
  await assert.rejects(stat(abs(held, REGISTRY)));
});

test('E-0015: D-03(b) ambiguous resolution never picks one; candidates are {id, path} sorted by bytes (E-0016)', async () => {
  const dir = await projectWith([alloc('BR-0001', B), alloc('BR-0001', A)]);
  await put(dir, A, entity('BR-0001')); await put(dir, B, entity('BR-0001'));
  const result = await resolveId(dir, 'BR-0001');
  assert.equal(result.status, 'ambiguous');
  assert.deepEqual(result.candidates, [{ id: 'BR-0001', path: A }, { id: 'BR-0001', path: B }]);
  await unlink(abs(dir, B)); // negative: one holder is no longer ambiguous
  assert.equal((await resolveId(dir, 'BR-0001')).status, 'live');
});

test('E-0016: id_alias is projected only onto the renumbered entity, never onto another holder of the alias target', async () => {
  const dir = await projectWith([alloc('BR-0001', A), promo('BR-0001', A, SHA.a), alloc('BR-0002', B), aliasLine('BR-0001', 'BR-0002', SHA.b), alloc('BR-0002', G)]);
  await put(dir, A, entity('BR-0001', 'permanent'));
  await put(dir, B, entity('BR-0002').replace('id_status: provisional\n', 'id_status: provisional\nid_alias: [BR-0001]\n'));
  await put(dir, G, entity('BR-0002'));
  const result = await promoteIds(dir, { canonicalBranch: 'main', history: { firstParentCommits: async () => [SHA.a], readFile: async (c, p) => (p === G ? entity('BR-0002') : null) } });
  assert.deepEqual(result.promoted, [{ id: 'BR-0002', path: G, commit: SHA.a }]);
  assert.equal(await get(dir, G), entity('BR-0002', 'permanent'), 'no id_alias on the unrenumbered holder');
  assert.deepEqual(result.diagnostics.map((d) => [d.id, d.path, d.permanent_path]), [['BR-0002', B, G]]);
});

test('E-0012: the checkpoint behaviours are retired (no UNRESOLVED_COLLISION, no allocation-time collision throw)', async () => {
  const dir = await projectWith([alloc('BR-0001', A), alloc('BR-0001', B)]);
  await put(dir, A, entity('BR-0001')); await put(dir, B, entity('BR-0001'));
  assert.equal((await allocateId(dir, 'BR', G)).id, 'BR-0002', 'a provisional collision does not block allocation (l.317 resolves it at promotion)');
});

test('§10.1: the schema carries id_alias in entityBase as a unique array of entity IDs', async () => {
  const schema = JSON.parse(await readFile(path.join(root, 'framework', 'schemas', 'common.schema.json'), 'utf8'));
  assert.deepEqual(schema.$defs.entityBase.properties.id_alias, { type: 'array', items: { $ref: '#/$defs/entityId' }, uniqueItems: true });
});

test('createGitHistoryReader: contract of the default reader (branch resolution, text or null, no option injection)', async () => {
  const dir = await featureRepo('reader');
  await git(dir, 'merge', '--no-ff', '-q', '-m', 'M', 'feature');
  const reader = createGitHistoryReader(dir);
  const listed = await reader.firstParentCommits('main');
  assert.deepEqual(listed, (await git(dir, 'rev-list', '--first-parent', '--reverse', 'main')).split('\n'));
  assert.equal(await reader.readFile(listed.at(-1), A), await get(dir, A));
  assert.equal(await reader.readFile(listed[0], A), null);
  assert.equal(await reader.readFile(listed.at(-1), 'knowledge/business-rules'), null, 'a directory is not a file');
  await assertCode(reader.firstParentCommits('nope'), 'CANONICAL_BRANCH_UNRESOLVED');
  await assertCode(reader.firstParentCommits('--output=evil'), 'CANONICAL_BRANCH_UNRESOLVED');
  await assert.rejects(stat(path.join(dir, 'evil')));
  await assertCode(createGitHistoryReader(await tmp('nogit')).firstParentCommits('main'), 'GIT_FAILED');
  await assertCode(reader.readFile('--help', A), 'GIT_FAILED');
});
