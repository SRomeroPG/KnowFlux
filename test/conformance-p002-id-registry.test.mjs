// P002 ID Registry - conformance slice (spec section 55; l.2103: the fixture is the operative definition
// of "done" and is written together with, never after, the feature).
//
// Written by the conformance engineer from PLAN.md (incl. "Foreman decisions after planning"), the spec and
// errata E-0001..E-0004, E-0007, E-0009..E-0015, BEFORE any implementer code was read. Data and per-case
// citations live in framework/conformance/p002-id-registry.yaml; scenario builders in
// framework/conformance/p002-id-registry/. Case ids (F-xx) and targets (V-nn) are those of the PLAN.
//
// Every case is marked todo while the engine is being built: it runs and reports but does not fail
// `npm test`. Removing the marker is the one-line change below (PENDING = false). Expectations are never
// weakened to pass.
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { loadSchemas } from '../scripts/check-schemas.mjs';
import {
  A, B, ENGINE_URL, FAKE_SHA, G, HEADER, REGISTRY_REL, REPO_ROOT, Repo, SEED_PATH,
  alloc, aliasEv, assertProjection, br, cleanupTemp, entityText, eventLine, eventLines, exitedPid,
  isoAgo, lockLeftovers, moveEv, oracleFirstCanonical, parseRegistryText, plantLock, promo,
  registryBytes, registryEvents, registryText, run, runChild, snapshot, tmpLeftovers, tmpProject, writeRegistry,
} from '../framework/conformance/p002-id-registry/scratch.mjs';
import {
  allocWrite, appendRegistryLine, buildE1, buildE1Promoted, buildE2, buildE3, buildE5, buildFeature,
  makeBase, noopHistory, promote,
} from '../framework/conformance/p002-id-registry/scenarios.mjs';

const PENDING = 'P002 implementation pending'; // set to false to enforce the whole slice

const dataFile = path.join(REPO_ROOT, 'framework', 'conformance', 'p002-id-registry.yaml');
const data = YAML.parse(await fs.readFile(dataFile, 'utf8'));
const T = data.tables;

let ENGINE = null;
let ENGINE_ERROR = null;
try {
  ENGINE = await import(ENGINE_URL);
} catch (error) {
  ENGINE_ERROR = error;
}

const covered = new Set();

function check(caseId, title, fn) {
  covered.add(caseId);
  test(`${caseId} ${title}`, { todo: PENDING, timeout: 180000 }, async () => {
    if (!ENGINE && fn.length > 0) throw new Error(`framework/engine/id-registry.mjs not importable: ${ENGINE_ERROR?.message}`);
    await fn(ENGINE);
  });
}

after(cleanupTemp);

// ------------------------------------------------------------------ shared assertions
async function rejectsWith(E, promise, code) {
  let error = null;
  try {
    await promise;
  } catch (caught) {
    error = caught;
  }
  assert.ok(error, `expected rejection with ${code}`);
  assert.equal(error.name, 'IdRegistryError', `error name (got ${error.name}: ${error.message})`);
  assert.ok(error instanceof E.IdRegistryError, 'instance of IdRegistryError');
  assert.equal(error.code, code, `error code (message: ${error.message})`);
  return error;
}

const sortBytes = (items) => [...items].sort((x, y) => Buffer.compare(Buffer.from(x), Buffer.from(y)));
const DIAG_KEYS = [...T.diagnostic_keys].sort();

function assertDiag(diagnostic, { id, path: offending, permanent_path: holder }) {
  assert.deepEqual(Object.keys(diagnostic).sort(), DIAG_KEYS, 'diagnostic field set (spec l.1742, PLAN Diagnostic)');
  assert.equal(diagnostic.code, T.diagnostic.code);
  assert.equal(diagnostic.severity, T.diagnostic.severity);
  assert.equal(diagnostic.remediation, T.diagnostic.remediation);
  assert.equal(typeof diagnostic.message, 'string');
  assert.ok(diagnostic.message.length > 0);
  assert.equal(diagnostic.id, id);
  assert.equal(diagnostic.path, offending);
  assert.equal(diagnostic.permanent_path, holder);
}

function assertEventLinesMatch(text, events) {
  const lines = text.split('\n');
  assert.equal(lines[0], 'schema_version: 2.1', 'header line 1 exact');
  assert.equal(lines[1], 'events:', 'header line 2 exact');
  assert.equal(lines.at(-1), '', 'LF-terminated');
  assert.ok(!text.includes('\r'), 'no CR');
  assert.deepEqual(lines.slice(2, -1).map((l) => l.trim()), events.map((e) => eventLine(e).trim()),
    'one physical line per event, keys in E-0012 order');
}

async function seededProject(events, label = 'seed') {
  const dir = await tmpProject(label);
  await writeRegistry(dir, registryText(events));
  return dir;
}

const SEED = alloc('CAP-0001', SEED_PATH);
const HOST = 'kf-test-host';
const LOCK = { deadlineMs: 300, staleAfterMs: 1000, pollMs: 10, hostname: HOST };

async function writeEntity(dir, repoPath, spec) {
  const abs = path.join(dir, ...repoPath.split('/'));
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, entityText(spec));
}
const readEntity = (dir, repoPath) => fs.readFile(path.join(dir, ...repoPath.split('/')), 'utf8');

function fillRow(line, subst) {
  return line.replaceAll('<A>', subst.A).replaceAll('<B>', subst.B).replaceAll('<G>', subst.G);
}

const BASE_EVENTS = [alloc('BR-0001', A), alloc('BR-0002', B), alloc('BR-0003', G)];

function rowRegistry(lines) {
  return registryText(BASE_EVENTS) + lines.map((l) => `  - ${fillRow(l, { A, B, G })}\n`).join('');
}

// ================================================================== Allocation and format
check('F-A1', 'allocation sequence, provisional status, exact file format', async (E) => {
  const dir = await tmpProject('a1');
  await E.initializeIdRegistry(dir);
  const steps = [['BR', br('p1'), 'BR-0001'], ['BR', br('p2'), 'BR-0002'], ['DE', 'knowledge/data/p3/entity.yaml', 'DE-0001'],
    ['BR', br('p4'), 'BR-0003'], ['CAP', 'knowledge/capabilities/p5/capability.yaml', 'CAP-0001']];
  for (const [prefix, p, id] of steps) {
    assert.deepEqual(await E.allocateId(dir, prefix, p), { id, id_status: 'provisional', path: p });
  }
  const events = steps.map(([, p, id]) => alloc(id, p));
  const registry = await E.readIdRegistry(dir);
  assert.equal(registry.schema_version, 2.1);
  assert.deepEqual(registry.events, events);
  assertEventLinesMatch(await registryBytes(dir), events);
  assert.deepEqual(await lockLeftovers(dir), []);
});

check('F-A2', 'numbers grow past 9999 without touching earlier IDs', async (E) => {
  const dir = await seededProject([alloc('BR-9999', br('old'))], 'a2');
  let previous = await registryBytes(dir);
  for (const [prefix, id] of [['BR', 'BR-10000'], ['BR', 'BR-10001'], ['DE', 'DE-0001']]) {
    const got = await E.allocateId(dir, prefix, br(`n-${id}`));
    assert.equal(got.id, id);
    const text = await registryBytes(dir);
    assert.ok(text.startsWith(previous), `seeded bytes are an exact prefix after ${id}`);
    previous = text;
  }
  const second = await seededProject([alloc('BR-12345', br('old'))], 'a2b');
  assert.equal((await E.allocateId(second, 'BR', br('x'))).id, 'BR-12346');
});

check('F-A3', 'no ID is ever reused (delete, rename, gap, other prefixes)', async (E) => {
  const repo = await Repo.create('a3');
  await E.initializeIdRegistry(repo.dir);
  const p = [br('one'), br('two'), br('three')];
  for (const [i, prefixPath] of p.entries()) assert.equal((await E.allocateId(repo.dir, 'BR', prefixPath)).id, `BR-000${i + 1}`);
  await repo.write(p[0], entityText({ id: 'BR-0001', name: 'One' }));
  await repo.write(p[2], entityText({ id: 'BR-0003', name: 'Three' }));
  await repo.commit('entities');
  await repo.remove(p[2]); // BR-0003 entity deleted
  await fs.mkdir(path.dirname(repo.abs(br('uno'))), { recursive: true });
  await repo.git('mv', p[0], br('uno')); // BR-0001 entity renamed
  await repo.write(br('uno'), entityText({ id: 'BR-0001', name: 'Renamed label' }));
  assert.equal((await E.allocateId(repo.dir, 'BR', br('four'))).id, 'BR-0004');
  const gap = await seededProject([alloc('BR-0007', br('gap'))], 'a3b');
  assert.equal((await E.allocateId(gap, 'BR', br('x'))).id, 'BR-0008', 'gaps are not filled');
  // V-04: the counter is per prefix and ranges over every recorded ID
  const other = await seededProject([alloc('DE-0050', 'knowledge/data/x/entity.yaml')], 'a3c');
  assert.equal((await E.allocateId(other, 'BR', br('x'))).id, 'BR-0001');
  const aliased = await seededProject([alloc('BR-0001', br('a')), alloc('BR-0003', br('b')), aliasEv('BR-0001', 'BR-0003', FAKE_SHA.a)], 'a3d');
  assert.equal((await E.allocateId(aliased, 'BR', br('x'))).id, 'BR-0004');
});

check('F-A4', 'only the 11 core prefixes are accepted', async (E) => {
  const dir = await seededProject([SEED], 'a4');
  const before = await snapshot(dir);
  for (const bad of T.invalid_prefixes) {
    await rejectsWith(E, E.allocateId(dir, bad, br('x')), 'INVALID_PREFIX');
    assert.deepEqual(await snapshot(dir), before, `registry unchanged after prefix ${JSON.stringify(bad)}`);
  }
  assert.deepEqual(E.CORE_ID_PREFIXES, T.core_prefixes);
  const fresh = await tmpProject('a4b');
  await E.initializeIdRegistry(fresh);
  for (const prefix of T.core_prefixes) {
    assert.deepEqual(await E.allocateId(fresh, prefix, `knowledge/x/${prefix}.yaml`),
      { id: `${prefix}-0001`, id_status: 'provisional', path: `knowledge/x/${prefix}.yaml` });
  }
});

check('F-A5', 'repo-relative path rule', async (E) => {
  const dir = await seededProject([SEED], 'a5');
  const before = await snapshot(dir);
  for (const bad of T.invalid_paths) {
    await rejectsWith(E, E.allocateId(dir, 'BR', bad), 'INVALID_PATH');
    assert.deepEqual(await snapshot(dir), before, `registry unchanged after path ${JSON.stringify(bad)}`);
  }
  for (const good of T.valid_paths) {
    assert.equal((await E.allocateId(dir, 'BR', good)).path, good, `near-miss ${JSON.stringify(good)} accepted`);
  }
});

check('F-A6', 'one physical line per event for hostile and 300-character paths', async (E) => {
  const dir = await tmpProject('a6');
  await E.initializeIdRegistry(dir);
  const paths = [...T.hostile_paths, `knowledge/${'x'.repeat(290)}.yaml`];
  for (const p of paths) await E.allocateId(dir, 'BR', p);
  const registry = await E.readIdRegistry(dir);
  assert.deepEqual(registry.events.map((e) => e.path), paths, 'paths round-trip');
  const text = await registryBytes(dir);
  const lines = eventLines(text);
  assert.equal(lines.length, paths.length);
  assert.equal(text.split('\n').filter((l) => l !== '').length, paths.length + 2, 'header plus one line per event');
  for (const [i, line] of lines.entries()) {
    assert.ok(line.trimEnd().endsWith('}'));
    assert.deepEqual(YAML.parse(line.trim().slice(2)), alloc(`BR-${String(i + 1).padStart(4, '0')}`, paths[i]),
      'each event line parses stand-alone to the same mapping');
  }
});

check('F-A7', 'allocation needs neither Git nor entity files', async (E) => {
  const dir = await tmpProject('a7');
  await E.initializeIdRegistry(dir);
  await assert.rejects(fs.stat(path.join(dir, '.git')));
  assert.deepEqual(await E.allocateId(dir, 'BR', br('x')), { id: 'BR-0001', id_status: 'provisional', path: br('x') });
});

// ================================================================== Locking and atomicity
check('F-B1', '24 concurrent in-process allocations', async (E) => {
  const dir = await tmpProject('b1');
  await E.initializeIdRegistry(dir);
  const results = await Promise.all(Array.from({ length: 24 }, (_, i) =>
    E.allocateId(dir, 'BR', br(`c${i}`), { lock: { deadlineMs: 60000, pollMs: 5 } })));
  const ids = results.map((r) => r.id).sort();
  assert.deepEqual(ids, Array.from({ length: 24 }, (_, i) => `BR-${String(i + 1).padStart(4, '0')}`));
  const events = await registryEvents(dir);
  assert.equal(events.length, 24);
  assert.equal(eventLines(await registryBytes(dir)).length, 24);
  for (const r of results) assert.deepEqual(events.find((e) => e.id === r.id), alloc(r.id, r.path));
  assert.deepEqual(await lockLeftovers(dir), []);
});

check('F-B2', '6 processes x 5 allocations', async (E) => {
  const dir = await tmpProject('b2');
  await E.initializeIdRegistry(dir);
  const outputs = await Promise.all(Array.from({ length: 6 }, (_, i) => runChild([dir, '5', 'BR', `proc${i}`])));
  const ids = outputs.flatMap((o) => JSON.parse(o)).sort();
  assert.deepEqual(ids, Array.from({ length: 30 }, (_, i) => `BR-${String(i + 1).padStart(4, '0')}`));
  assert.equal((await E.readIdRegistry(dir)).events.length, 30);
  assert.equal(eventLines(await registryBytes(dir)).length, 30);
  assert.deepEqual(await lockLeftovers(dir), []);
});

async function lockScenario(label, owner, lockOptions = LOCK, extra = {}) {
  const dir = await seededProject([SEED], label);
  const lock = await plantLock(dir, { owner, ...extra });
  const ownerBytes = owner || extra.rawOwner ? await fs.readFile(path.join(lock, 'owner.json'), 'utf8') : null;
  return { dir, lock, ownerBytes, bytes: await registryBytes(dir), options: lockOptions };
}

async function assertLockKept(s) {
  assert.equal(await registryBytes(s.dir), s.bytes, 'registry bytes unchanged');
  await fs.stat(s.lock);
  if (s.ownerBytes !== null) assert.equal(await fs.readFile(path.join(s.lock, 'owner.json'), 'utf8'), s.ownerBytes, 'owner file untouched');
}

check('F-B3', '(i) stale lock (same host, dead pid, old) is recovered', async (E) => {
  const s = await lockScenario('b3i', { pid: await exitedPid(), host: HOST, acquired_at: isoAgo(600000) });
  const got = await E.allocateId(s.dir, 'BR', br('x'), { lock: s.options });
  assert.equal(got.id, 'BR-0001');
  assert.deepEqual(await lockLeftovers(s.dir), [], 'no lock directory and no broken sibling remains');
  assert.equal((await registryEvents(s.dir)).length, 2);
});

check('F-B3', '(ii) lock held by a live pid on this host is not broken', async (E) => {
  const s = await lockScenario('b3ii', { pid: process.pid, host: HOST, acquired_at: isoAgo(600000) });
  await rejectsWith(E, E.allocateId(s.dir, 'BR', br('x'), { lock: s.options }), 'LOCK_TIMEOUT');
  await assertLockKept(s);
});

check('F-B3', '(iii) lock younger than the threshold is not broken even if the pid is dead', async (E) => {
  const s = await lockScenario('b3iii', { pid: await exitedPid(), host: HOST, acquired_at: isoAgo(1000) },
    { ...LOCK, staleAfterMs: 60000 });
  await rejectsWith(E, E.allocateId(s.dir, 'BR', br('x'), { lock: s.options }), 'LOCK_TIMEOUT');
  await assertLockKept(s);
});

check('F-B3', '(iv) lock owned by another host is never broken', async (E) => {
  const s = await lockScenario('b3iv', { pid: await exitedPid(), host: 'some-other-host', acquired_at: isoAgo(600000) });
  await rejectsWith(E, E.allocateId(s.dir, 'BR', br('x'), { lock: s.options }), 'LOCK_TIMEOUT');
  await assertLockKept(s);
});

check('F-B3', '(v) owner-less lock blocks to LOCK_TIMEOUT naming the lock path, fresh or old (E-0015 D-04)', async (E) => {
  const fresh = await lockScenario('b3v', null);
  const started = Date.now();
  const error = await rejectsWith(E, E.allocateId(fresh.dir, 'BR', br('x'), { lock: fresh.options }), 'LOCK_TIMEOUT');
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 200 && elapsed < 5000, `waited about deadlineMs (${elapsed} ms)`);
  assert.ok(error.message.includes('id-registry.lock'), 'message names the lock path');
  await assertLockKept(fresh);
  const old = await lockScenario('b3v2', null, LOCK, { ageMs: 600000 });
  await rejectsWith(E, E.allocateId(old.dir, 'BR', br('x'), { lock: old.options }), 'LOCK_TIMEOUT');
  await assertLockKept(old);
  const unreadable = await lockScenario('b3v3', null, LOCK, { rawOwner: '{not json', ageMs: 600000 });
  await rejectsWith(E, E.allocateId(unreadable.dir, 'BR', br('x'), { lock: unreadable.options }), 'LOCK_TIMEOUT');
  await assertLockKept(unreadable);
});

check('F-B3', '(vi) deadlineMs is honored in bounded time', async (E) => {
  const s = await lockScenario('b3vi', { pid: process.pid, host: HOST, acquired_at: isoAgo(1000) }, { ...LOCK, deadlineMs: 50 });
  const started = Date.now();
  await rejectsWith(E, E.allocateId(s.dir, 'BR', br('x'), { lock: s.options }), 'LOCK_TIMEOUT');
  assert.ok(Date.now() - started < 2000);
  await assertLockKept(s);
});

check('F-B3', '(vii) contenders on one stale lock: single winner, distinct IDs, no leftover', async (E) => {
  const s = await lockScenario('b3vii', { pid: await exitedPid(), host: HOST, acquired_at: isoAgo(600000) });
  const options = { lock: { ...LOCK, deadlineMs: 30000 } };
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => E.allocateId(s.dir, 'BR', br(`s${i}`), options)));
  assert.deepEqual(results.map((r) => r.id).sort(), Array.from({ length: 8 }, (_, i) => `BR-${String(i + 1).padStart(4, '0')}`));
  assert.deepEqual(await lockLeftovers(s.dir), []);
  assert.equal(eventLines(await registryBytes(s.dir)).length, 9);
  // variant: three child processes (default staleAfterMs 60000, real hostname and pid liveness)
  const dir = await seededProject([SEED], 'b3vii-c');
  await plantLock(dir, { owner: { pid: await exitedPid(), host: os.hostname(), acquired_at: isoAgo(600000) } });
  const outputs = await Promise.all(Array.from({ length: 3 }, (_, i) => runChild([dir, '3', 'BR', `st${i}`])));
  assert.deepEqual(outputs.flatMap((o) => JSON.parse(o)).sort(), Array.from({ length: 9 }, (_, i) => `BR-${String(i + 1).padStart(4, '0')}`));
  assert.deepEqual(await lockLeftovers(dir), []);
  assert.equal(eventLines(await registryBytes(dir)).length, 10);
});

check('F-B4', 'lock released on success and failure; atomic write; rename retry; stray tmp', async (E) => {
  const dir = await seededProject([SEED], 'b4');
  await rejectsWith(E, E.allocateId(dir, 'ZZ', br('x')), 'INVALID_PREFIX');
  assert.deepEqual(await lockLeftovers(dir), []);
  assert.equal((await E.allocateId(dir, 'BR', br('one'))).id, 'BR-0001');
  assert.deepEqual(await lockLeftovers(dir), []);

  // injected failure at the registry rename (other errors propagate unchanged)
  const before = await registryBytes(dir);
  const injected = Object.assign(new Error('injected EIO'), { code: 'EIO' });
  let sawTemporaryFile = false;
  const failing = async (from, to) => {
    if (path.basename(to) === 'id-registry.yaml') {
      await fs.stat(from);
      sawTemporaryFile = true;
      throw injected;
    }
    return fs.rename(from, to);
  };
  let caught = null;
  try {
    await E.allocateId(dir, 'BR', br('two'), { rename: failing });
  } catch (error) {
    caught = error;
  }
  assert.strictEqual(caught, injected, 'the rename error propagates unchanged');
  assert.ok(sawTemporaryFile, 'a temporary file existed when the rename was attempted');
  assert.equal(await registryBytes(dir), before, 'registry byte-identical');
  assert.deepEqual(await tmpLeftovers(dir), [], 'temporary file removed');
  assert.deepEqual(await lockLeftovers(dir), [], 'lock released');
  assert.equal((await E.allocateId(dir, 'BR', br('two'))).id, 'BR-0002');

  // EPERM, EBUSY, EACCES are retried, then success
  const codes = ['EPERM', 'EBUSY', 'EACCES'];
  let calls = 0;
  const flaky = async (from, to) => {
    if (path.basename(to) === 'id-registry.yaml') {
      calls += 1;
      if (codes.length > 0) throw Object.assign(new Error('blocked'), { code: codes.shift() });
    }
    return fs.rename(from, to);
  };
  assert.equal((await E.allocateId(dir, 'BR', br('three'), { rename: flaky, lock: { pollMs: 5, deadlineMs: 5000 } })).id, 'BR-0003');
  assert.equal(calls, 4);
  assert.equal((await registryEvents(dir)).filter((e) => e.path === br('three')).length, 1, 'exactly one event');

  // retry until the deadline then LOCK_TIMEOUT
  const stuck = await registryBytes(dir);
  const always = async (from, to) => {
    if (path.basename(to) === 'id-registry.yaml') throw Object.assign(new Error('blocked'), { code: 'EPERM' });
    return fs.rename(from, to);
  };
  await rejectsWith(E, E.allocateId(dir, 'BR', br('four'), { rename: always, lock: { pollMs: 10, deadlineMs: 300 } }), 'LOCK_TIMEOUT');
  assert.equal(await registryBytes(dir), stuck);
  assert.deepEqual(await tmpLeftovers(dir), []);
  assert.deepEqual(await lockLeftovers(dir), []);

  // V-21: a stray temporary file has no effect
  const other = await seededProject([SEED], 'b4b');
  await fs.writeFile(path.join(other, '.kf', 'id-registry.yaml.leftover.tmp'), 'garbage');
  assert.equal((await E.allocateId(other, 'BR', br('x'))).id, 'BR-0001');
  assert.equal((await registryEvents(other)).length, 2);
});

// ================================================================== Registry read and validity
check('F-C1', 'missing registry is never recreated; init refusals; fresh registry bytes', async (E) => {
  for (const withKf of [false, true]) {
    const dir = await tmpProject(`c1-${withKf}`);
    if (withKf) await fs.mkdir(path.join(dir, '.kf'));
    await writeEntity(dir, A, { id: 'BR-0001', name: 'Alpha' });
    const calls = {
      readIdRegistry: () => E.readIdRegistry(dir),
      allocateId: () => E.allocateId(dir, 'BR', B),
      promoteIds: () => E.promoteIds(dir, { canonicalBranch: 'main', history: noopHistory }),
      checkIdCollisions: () => E.checkIdCollisions(dir),
      resolveId: () => E.resolveId(dir, 'BR-0001'),
    };
    for (const [name, call] of Object.entries(calls)) {
      await rejectsWith(E, call(), 'REGISTRY_MISSING');
      await assert.rejects(fs.stat(path.join(dir, ...REGISTRY_REL.split('/'))), `${name} did not create a registry`);
    }
    await rejectsWith(E, E.initializeIdRegistry(dir), 'EXISTING_ENTITIES');
    await assert.rejects(fs.stat(path.join(dir, ...REGISTRY_REL.split('/'))));
  }
  // D-05: exact bytes; readers see an empty registry
  const fresh = await tmpProject('c1-fresh');
  const created = await E.initializeIdRegistry(fresh);
  assert.deepEqual(created, { schema_version: 2.1, events: [] });
  assert.equal(await registryBytes(fresh), 'schema_version: 2.1\nevents:\n');
  assert.deepEqual(await E.readIdRegistry(fresh), { schema_version: 2.1, events: [] });
  const bytes = await registryBytes(fresh);
  await rejectsWith(E, E.initializeIdRegistry(fresh), 'REGISTRY_EXISTS');
  assert.equal(await registryBytes(fresh), bytes);
  assert.deepEqual(await lockLeftovers(fresh), []);
  // D-01: `.kf/` pre-exists without registry and lock, no entity carries an ID
  const prepared = await tmpProject('c1-d01');
  await fs.mkdir(path.join(prepared, '.kf'));
  await fs.writeFile(path.join(prepared, '.kf', 'notes.txt'), 'operational note');
  await fs.mkdir(path.join(prepared, 'knowledge', 'business-rules', 'alpha', 'observed'), { recursive: true });
  await fs.writeFile(path.join(prepared, 'knowledge', 'business-rules', 'alpha', 'observed', 'legacy.yaml'), 'schema_version: 2.1\nentity: BR-0001\n');
  await E.initializeIdRegistry(prepared);
  assert.equal(await registryBytes(prepared), 'schema_version: 2.1\nevents:\n');
  // D-01: a held lock refuses like any locked operation
  const locked = await tmpProject('c1-lock');
  await plantLock(locked, { owner: { pid: process.pid, host: HOST, acquired_at: isoAgo(1000) } });
  await rejectsWith(E, E.initializeIdRegistry(locked, { lock: { ...LOCK, deadlineMs: 150 } }), 'LOCK_TIMEOUT');
  await assert.rejects(fs.stat(path.join(locked, ...REGISTRY_REL.split('/'))));
});

check('F-C2', 'corrupt registries are rejected unchanged; null and [] events are empty', async (E) => {
  for (const row of T.corrupt_registries) {
    const dir = await tmpProject('c2');
    await fs.mkdir(path.join(dir, '.kf'));
    await fs.writeFile(path.join(dir, ...REGISTRY_REL.split('/')), row.text);
    await rejectsWith(E, E.readIdRegistry(dir), row.code);
    await rejectsWith(E, E.allocateId(dir, 'BR', br('x')), row.code);
    assert.equal(await registryBytes(dir), row.text, `${row.name}: file unchanged`);
    assert.deepEqual(await lockLeftovers(dir), []);
  }
  for (const text of ['schema_version: 2.1\nevents: []\n', 'schema_version: 2.1\nevents:\n']) {
    const dir = await tmpProject('c2n');
    await fs.mkdir(path.join(dir, '.kf'));
    await fs.writeFile(path.join(dir, ...REGISTRY_REL.split('/')), text);
    assert.deepEqual(await E.readIdRegistry(dir), { schema_version: 2.1, events: [] });
    assert.equal((await E.allocateId(dir, 'BR', br('x'))).id, 'BR-0001');
    assert.deepEqual((await E.readIdRegistry(dir)).events, [alloc('BR-0001', br('x'))]);
  }
});

check('F-C3', 'every invalid event row is INVALID_REGISTRY; near-misses read', async (E) => {
  for (const row of T.invalid_events) {
    const dir = await tmpProject('c3');
    await fs.mkdir(path.join(dir, '.kf'));
    const text = rowRegistry(row.lines);
    await fs.writeFile(path.join(dir, ...REGISTRY_REL.split('/')), text);
    await rejectsWith(E, E.readIdRegistry(dir), 'INVALID_REGISTRY').catch((e) => { e.message = `${row.name}: ${e.message}`; throw e; });
    await rejectsWith(E, E.allocateId(dir, 'BR', br('y')), 'INVALID_REGISTRY');
    assert.equal(await registryBytes(dir), text, `${row.name}: file unchanged`);
  }
  for (const row of T.valid_events) {
    const dir = await tmpProject('c3v');
    await fs.mkdir(path.join(dir, '.kf'));
    const text = rowRegistry(row.lines);
    await fs.writeFile(path.join(dir, ...REGISTRY_REL.split('/')), text);
    const registry = await E.readIdRegistry(dir);
    assert.deepEqual(registry.events, parseRegistryText(text).events, `${row.name}: events read as written`);
  }
});

check('F-C4', 'duplicate provisional allocations replay; next ID skips them', async (E) => {
  const dir = await seededProject([alloc('BR-0005', A), alloc('BR-0005', B)], 'c4');
  assert.equal((await E.readIdRegistry(dir)).events.length, 2);
  assert.equal((await E.allocateId(dir, 'BR', G)).id, 'BR-0006');
});

check('F-C5', 'real Git union merge of appended allocations', async (E) => {
  const repo = await makeBase('c5');
  await repo.checkout('f1', { create: true });
  assert.equal((await E.allocateId(repo.dir, 'BR', A)).id, 'BR-0001');
  await repo.commit('f1');
  await repo.checkout('main');
  await repo.checkout('f2', { create: true });
  assert.equal((await E.allocateId(repo.dir, 'BR', B)).id, 'BR-0001');
  await repo.commit('f2');
  await repo.checkout('main');
  await repo.mergeNoFf('f1', 'M1');
  await repo.mergeNoFf('f2', 'M2');
  const text = await registryBytes(repo.dir);
  assert.ok(!/^(<<<<<<<|=======|>>>>>>>)/m.test(text), 'no conflict markers');
  const events = (await E.readIdRegistry(repo.dir)).events;
  assert.equal(events.length, 3);
  assert.deepEqual(events[0], SEED);
  assert.deepEqual(events.slice(1).map((e) => e.path).sort(), [A, B]);
  assert.equal((await E.allocateId(repo.dir, 'BR', G)).id, 'BR-0002');

  // D-05: both branches append their first event to the empty registry
  const empty = await Repo.create('c5b');
  await empty.write('.gitattributes', '* text=auto\n\n.kf/id-registry.yaml merge=union\n');
  await writeRegistry(empty.dir, HEADER);
  await empty.commit('B0');
  await empty.checkout('g1', { create: true });
  await E.allocateId(empty.dir, 'BR', A);
  await empty.commit('g1');
  await empty.checkout('main');
  await empty.checkout('g2', { create: true });
  await E.allocateId(empty.dir, 'BR', B);
  await empty.commit('g2');
  await empty.checkout('main');
  await empty.mergeNoFf('g1', 'N1');
  await empty.mergeNoFf('g2', 'N2');
  const merged = await E.readIdRegistry(empty.dir);
  assert.deepEqual(merged.events.map((e) => e.path).sort(), [A, B], 'parseable, both events present');
});

check('F-C6', 'allocate after promote replays in either order', async (E) => {
  const forward = [alloc('BR-0001', A), promo('BR-0001', A, FAKE_SHA.a), alloc('BR-0001', B)];
  const reversed = [alloc('BR-0001', B), alloc('BR-0001', A), promo('BR-0001', A, FAKE_SHA.a)];
  for (const events of [forward, reversed]) {
    const dir = await seededProject(events, 'c6');
    assert.deepEqual((await E.readIdRegistry(dir)).events, events);
  }
});

// ================================================================== Branches and promotion
check('F-D1', 'non-canonical entity stays provisional', async (E) => {
  const ctx = await buildFeature(E, 'd1');
  assert.equal(ctx.allocation.id, 'BR-0001');
  const before = await snapshot(ctx.dir);
  const result = await promote(E, ctx.dir);
  assert.deepEqual([result.promoted, result.renumbered, result.entities_rewritten, result.diagnostics], [[], [], [], []]);
  assert.deepEqual(await snapshot(ctx.dir), before);
});

for (const variant of ['a', 'b', 'c']) {
  check('F-D2', `(${variant}) canonical entry via ${{ a: 'merge commit', b: 'fast-forward', c: 'squash' }[variant]}`, async (E) => {
    const ctx = await buildFeature(E, `d2${variant}`);
    const { repo, dir } = ctx;
    await repo.checkout('main');
    const expected = variant === 'a' ? await repo.mergeNoFf('feature', 'M')
      : variant === 'b' ? await repo.mergeFastForward('feature') : await repo.mergeSquash('feature', 'S');
    if (variant === 'b') assert.equal(expected, ctx.featureCommit);
    assert.equal(await oracleFirstCanonical(repo, 'main', A, 'BR-0001'), expected, 'oracle agrees with the scenario');
    const before = await registryEvents(dir);
    const result = await promote(E, dir);
    assert.deepEqual(result.promoted, [{ id: 'BR-0001', path: A, commit: expected }]);
    assert.deepEqual([result.renumbered, result.diagnostics, result.entities_rewritten], [[], [], [A]]);
    assert.equal(result.canonical_branch, 'main');
    const events = (await E.readIdRegistry(dir)).events;
    assert.deepEqual(events, [...before, promo('BR-0001', A, expected)], 'only the promote event is added');
    assert.deepEqual(events, await registryEvents(dir));
    assertProjection(await repo.read(A), ctx.origA, { id: 'BR-0001', id_status: 'permanent', id_alias: null });
  });
}

check('F-D3', 'canonicalBranch is explicit and never assumed', async (E) => {
  const ctx = await buildFeature(E, 'd3');
  const { repo, dir } = ctx;
  await repo.checkout('main');
  await repo.mergeNoFf('feature', 'M');
  await repo.git('branch', '-m', 'main', 'trunk');
  const before = await snapshot(dir);
  await rejectsWith(E, promote(E, dir), 'CANONICAL_BRANCH_UNRESOLVED');
  for (const bad of ['-x', '--upload-pack=evil']) {
    await rejectsWith(E, E.promoteIds(dir, { canonicalBranch: bad }), 'CANONICAL_BRANCH_UNRESOLVED');
  }
  for (const options of [{}, { canonicalBranch: '' }, { canonicalBranch: 42 }, { canonicalBranch: null }, { canonicalBranch: undefined }]) {
    await rejectsWith(E, E.promoteIds(dir, options), 'CANONICAL_BRANCH_REQUIRED');
  }
  assert.deepEqual(await snapshot(dir), before, 'every rejection leaves registry and entities byte-identical');
  const result = await E.promoteIds(dir, { canonicalBranch: 'trunk' });
  assert.equal(result.canonical_branch, 'trunk');
  assert.equal(result.promoted.length, 1);
  assert.equal(result.promoted[0].id, 'BR-0001');
});

check('F-D4', 'promotion is independent of the checked-out branch', async (E) => {
  const ctx = await buildFeature(E, 'd4');
  const { repo, dir } = ctx;
  await repo.checkout('main');
  const M = await repo.mergeNoFf('feature', 'M');
  await repo.checkout('feature');
  await repo.write('notes/readme.txt', 'later feature work\n');
  await repo.commit('c2 on feature');
  assert.notEqual(ctx.featureCommit, M);
  const result = await promote(E, dir);
  assert.deepEqual(result.promoted, [{ id: 'BR-0001', path: A, commit: M }]);
  assert.equal(await oracleFirstCanonical(repo, 'main', A, 'BR-0001'), M);
});

check('F-D5', 'first-parent semantics', async (E) => {
  // (1) side-branch commits are not used
  const repo = await makeBase('d5a');
  await repo.checkout('feature', { create: true });
  assert.equal((await E.allocateId(repo.dir, 'BR', A)).id, 'BR-0001'); // allocated before the entity file exists
  await repo.write(A, entityText({ id: 'BR-0009', name: 'Alpha' }));
  await repo.commit('c1 other id');
  await repo.write(A, entityText({ id: 'BR-0001', name: 'Alpha' }));
  const c2 = await repo.commit('c2');
  await repo.write('notes/x.txt', 'x\n');
  await repo.commit('c3');
  await repo.checkout('main');
  const M = await repo.mergeNoFf('feature', 'M');
  const result = await promote(E, repo.dir);
  assert.deepEqual(result.promoted, [{ id: 'BR-0001', path: A, commit: M }]);
  assert.notEqual(result.promoted[0].commit, c2);
  // (2) an earlier canonical commit with another ID at the path does not count
  const direct = await makeBase('d5b');
  assert.equal((await E.allocateId(direct.dir, 'BR', A)).id, 'BR-0001');
  await direct.write(A, entityText({ id: 'BR-0009', name: 'Alpha' }));
  await direct.commit('X1');
  await direct.write(A, entityText({ id: 'BR-0001', name: 'Alpha' }));
  const X2 = await direct.commit('X2');
  assert.deepEqual((await promote(E, direct.dir)).promoted, [{ id: 'BR-0001', path: A, commit: X2 }]);
});

check('F-D6', 'shallow clone is refused; a full clone works', async (E) => {
  const repo = await makeBase('d6');
  await allocWrite(E, repo, 'BR', A, 'Alpha');
  await repo.commit('c1');
  await repo.write('notes/a.txt', 'a\n');
  await repo.commit('c2');
  await repo.write('notes/b.txt', 'b\n');
  await repo.commit('c3');
  const url = pathToFileURL(repo.dir).href;
  const flags = ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf'];
  const shallow = await tmpProject('d6s');
  await run('git', [...flags, 'clone', '-q', '--depth', '1', url, shallow]);
  assert.equal((await run('git', ['rev-parse', '--is-shallow-repository'], { cwd: shallow })).trim(), 'true');
  const before = await snapshot(shallow);
  await rejectsWith(E, promote(E, shallow), 'HISTORY_INCOMPLETE');
  assert.deepEqual(await snapshot(shallow), before, 'nothing changes');
  const full = await tmpProject('d6f');
  await run('git', [...flags, 'clone', '-q', url, full]);
  const result = await promote(E, full);
  assert.deepEqual(result.promoted, [{ id: 'BR-0001', path: A, commit: await oracleFirstCanonical(new Repo(full), 'main', A, 'BR-0001') }]);
});

check('F-D7', 'repeat promotion is idempotent and the recorded commit is stable', async (E) => {
  const ctx = await buildFeature(E, 'd7');
  const { repo, dir } = ctx;
  await repo.checkout('main');
  const M = await repo.mergeNoFf('feature', 'M');
  await promote(E, dir);
  const frozen = { registry: await registryBytes(dir), entity: await repo.read(A) };
  for (const step of ['again', 'after another canonical commit']) {
    if (step !== 'again') {
      await repo.commit('promotion result');
      await repo.write('notes/other.txt', 'other\n');
      await repo.commit('unrelated canonical commit');
    }
    const result = await promote(E, dir);
    assert.deepEqual([result.promoted, result.renumbered, result.entities_rewritten, result.diagnostics], [[], [], [], []], step);
    assert.equal(await registryBytes(dir), frozen.registry, step);
    assert.equal(await repo.read(A), frozen.entity, step);
  }
  assert.equal((await registryEvents(dir)).find((e) => e.op === 'promote').commit, M);
});

check('F-D8', 'promote.path is the entity path at promotion', async (E) => {
  const repo = await makeBase('d8');
  await repo.checkout('feature', { create: true });
  assert.equal((await E.allocateId(repo.dir, 'BR', A)).id, 'BR-0001');
  await repo.write(G, entityText({ id: 'BR-0001', name: 'Moved before canonical entry' }));
  await repo.commit('entity created at another path');
  await repo.checkout('main');
  const M = await repo.mergeNoFf('feature', 'M');
  const result = await promote(E, repo.dir);
  assert.deepEqual(result.promoted, [{ id: 'BR-0001', path: G, commit: M }]);
  assert.deepEqual((await registryEvents(repo.dir)).filter((e) => e.op === 'promote'), [promo('BR-0001', G, M)]);
});

check('F-D9', 'interrupted entity rewrite converges without a new event', async (E) => {
  const ctx = await buildFeature(E, 'd9');
  const { repo, dir } = ctx;
  await repo.checkout('main');
  await repo.mergeNoFf('feature', 'M');
  await promote(E, dir);
  const registryAfter = await registryBytes(dir);
  await repo.write(A, ctx.origA);
  const result = await promote(E, dir);
  assert.deepEqual([result.promoted, result.renumbered, result.entities_rewritten], [[], [], [A]]);
  assert.equal(await registryBytes(dir), registryAfter);
  assertProjection(await repo.read(A), ctx.origA, { id: 'BR-0001', id_status: 'permanent', id_alias: null });
});

check('F-D10', 'registry rename failure leaves everything unchanged; one registry write before entity rewrites', async (E) => {
  const ctx = await buildFeature(E, 'd10');
  const { repo, dir } = ctx;
  await repo.checkout('main');
  await repo.mergeNoFf('feature', 'M');
  const before = await snapshot(dir);
  const injected = Object.assign(new Error('injected EIO'), { code: 'EIO' });
  const failing = async (from, to) => {
    if (path.basename(to) === 'id-registry.yaml') throw injected;
    return fs.rename(from, to);
  };
  let caught = null;
  try {
    await promote(E, dir, { rename: failing });
  } catch (error) {
    caught = error;
  }
  assert.strictEqual(caught, injected);
  assert.deepEqual(await snapshot(dir), before, 'registry, entities, tmp files and lock all as before');
  assert.equal((await promote(E, dir)).promoted.length, 1, 'a later call succeeds');

  // all events of one call land in one registry write, before any entity rewrite (five events here)
  const three = await buildE3('d10b');
  let registryWrites = 0;
  const atWrite = [];
  const watching = async (from, to) => {
    if (path.basename(to) === 'id-registry.yaml') {
      registryWrites += 1;
      for (const p of Object.values(three.paths)) atWrite.push(await readEntity(three.dir, p));
    }
    return fs.rename(from, to);
  };
  const result = await promote(E, three.dir, { rename: watching });
  assert.equal(result.promoted.length + result.renumbered.length * 2, 5);
  assert.equal(registryWrites, 1, 'one atomic registry write');
  assert.deepEqual(atWrite, ['c3', 'b2', 'a1'].map((k) => three.orig[k]), 'no entity rewritten before the registry write');
});

check('F-D11', 'an unpromoted entity present in the first canonical commit is promoted with that commit', async (E) => {
  const repo = await makeBase('d11', { seedEntity: true });
  const original = await repo.read(SEED_PATH);
  const result = await promote(E, repo.dir);
  assert.deepEqual(result.promoted, [{ id: 'CAP-0001', path: SEED_PATH, commit: repo.b0 }]);
  assert.deepEqual(result.entities_rewritten, [SEED_PATH]);
  assert.deepEqual(await registryEvents(repo.dir), [SEED, promo('CAP-0001', SEED_PATH, repo.b0)]);
  assertProjection(await repo.read(SEED_PATH), original, { id: 'CAP-0001', id_status: 'permanent', id_alias: null });
});

check('F-D12', 'default Git reader contract', async (E) => {
  const ctx = await buildFeature(E, 'd12');
  const { repo } = ctx;
  await repo.checkout('main');
  const M = await repo.mergeNoFf('feature', 'M');
  const reader = E.createGitHistoryReader(repo.dir);
  assert.deepEqual(await reader.firstParentCommits('main'), await repo.firstParent('main'));
  assert.equal(await reader.readFile(M, A), ctx.origA);
  assert.equal(await reader.readFile(repo.b0, A), null, 'absent at that commit');
  assert.equal(await reader.readFile(M, 'no/such/file.yaml'), null);
  await rejectsWith(E, reader.firstParentCommits('does-not-exist'), 'CANONICAL_BRANCH_UNRESOLVED');
  await rejectsWith(E, reader.firstParentCommits('-x'), 'CANONICAL_BRANCH_UNRESOLVED');
});

check('F-D13', 'injected history reader: first sha whose file parses to a mapping with that id', async (E) => {
  const sha = (n) => `${'a'.repeat(39)}${n}`;
  const files = {
    [sha(1)]: null,
    [sha(2)]: '- not\n- a mapping\n',
    [sha(3)]: entityText({ id: 'BR-0009', name: 'Other' }),
    [sha(4)]: entityText({ id: 'BR-0001', name: 'Alpha' }),
    [sha(5)]: entityText({ id: 'BR-0001', name: 'Alpha again' }),
  };
  const dir = await seededProject([SEED, alloc('BR-0001', A)], 'd13');
  await writeEntity(dir, A, { id: 'BR-0001', name: 'Alpha' });
  const reads = [];
  const branches = [];
  const history = {
    firstParentCommits: async (branch) => { branches.push(branch); return [1, 2, 3, 4, 5].map(sha); },
    readFile: async (commit, p) => { reads.push([commit, p]); return files[commit] ?? null; },
  };
  const result = await E.promoteIds(dir, { canonicalBranch: 'whatever/branch', history });
  assert.deepEqual(result.promoted, [{ id: 'BR-0001', path: A, commit: sha(4) }]);
  assert.ok(branches.length >= 1 && branches.every((b) => b === 'whatever/branch'));
  assert.ok(reads.length >= 1 && reads.every(([, p]) => p === A), 'files are read at their repo path');
});

// ================================================================== Collisions and renumbering
check('F-E1', 'provisional colliders in different canonical commits: later one renumbered', async (E) => {
  const ctx = await buildE1(E, 'e1');
  const { dir, repo, M1, M2 } = ctx;
  assert.equal(ctx.a1.id, 'BR-0001');
  assert.equal(ctx.a2.id, 'BR-0001');
  const evBefore = await registryEvents(dir);
  assert.equal(evBefore.length, 3);
  const textBefore = await registryBytes(dir);
  const pre = await E.checkIdCollisions(dir);
  assert.deepEqual(pre.diagnostics, [], 'near-miss: two provisional colliders are not KF-E-101');
  assert.deepEqual(pre.provisional_collisions, [{ id: 'BR-0001', paths: [A, B] }]);
  assert.equal(await oracleFirstCanonical(repo, 'main', A, 'BR-0001'), M1);
  assert.equal(await oracleFirstCanonical(repo, 'main', B, 'BR-0001'), M2);

  const result = await promote(E, dir);
  assert.deepEqual(result.promoted, [{ id: 'BR-0001', path: A, commit: M1 }]);
  assert.deepEqual(result.renumbered, [{ from: 'BR-0001', to: 'BR-0002', path: B, commit: M2 }]);
  assert.deepEqual(result.entities_rewritten, [A, B]);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(await registryEvents(dir), [...evBefore,
    promo('BR-0001', A, M1), alloc('BR-0002', B), aliasEv('BR-0001', 'BR-0002', M2)], 'D-02c event order, D-02a alias.commit');
  assert.ok((await registryBytes(dir)).startsWith(textBefore), 'append-only');
  assertProjection(await repo.read(A), ctx.origA, { id: 'BR-0001', id_status: 'permanent', id_alias: null });
  assertProjection(await repo.read(B), ctx.origB, { id: 'BR-0002', id_status: 'provisional', id_alias: ['BR-0001'] });
  const post = await E.checkIdCollisions(dir);
  assert.deepEqual([post.diagnostics, post.provisional_collisions], [[], []]);
});

check('F-E1', 'later first-parent index loses even when its path sorts first (injected history)', async (E) => {
  const sha = (n) => `${'b'.repeat(39)}${n}`;
  const dir = await seededProject([alloc('BR-0001', A), alloc('BR-0001', B)], 'e1b');
  await writeEntity(dir, A, { id: 'BR-0001', name: 'Alpha' });
  await writeEntity(dir, B, { id: 'BR-0001', name: 'Beta' });
  const presence = { [A]: [sha(3), sha(4)], [B]: [sha(2), sha(3), sha(4)] };
  const history = {
    firstParentCommits: async () => [1, 2, 3, 4].map(sha),
    readFile: async (commit, p) => (presence[p]?.includes(commit) ? entityText({ id: 'BR-0001', name: p }) : null),
  };
  const result = await E.promoteIds(dir, { canonicalBranch: 'main', history });
  assert.deepEqual(result.promoted, [{ id: 'BR-0001', path: B, commit: sha(2) }], 'index beats path order (E-0009)');
  assert.deepEqual(result.renumbered, [{ from: 'BR-0001', to: 'BR-0002', path: A, commit: sha(3) }]);
});

for (const [index, pair] of T.tie_pairs.entries()) {
  for (const registered of index === 1 ? ['both', 'loser'] : ['both']) {
    check('F-E2', `same-commit tie ${pair.name} (registry: ${registered})`, async (E) => {
      assert.ok(Buffer.compare(Buffer.from(br(pair.winner)), Buffer.from(br(pair.loser))) < 0, 'winner is smaller in UTF-8 byte order');
      const ctx = await buildE2(E, `e2-${index}`, { winner: pair.winner, loser: pair.loser, creation: 'reverse', registered });
      const evBefore = await registryEvents(ctx.dir);
      const result = await promote(E, ctx.dir);
      assert.deepEqual(result.promoted, [{ id: 'BR-0001', path: ctx.winnerPath, commit: ctx.M }]);
      assert.deepEqual(result.renumbered, [{ from: 'BR-0001', to: 'BR-0002', path: ctx.loserPath, commit: ctx.M }]);
      assert.deepEqual(result.entities_rewritten, sortBytes([ctx.winnerPath, ctx.loserPath]));
      assert.deepEqual(await registryEvents(ctx.dir), [...evBefore,
        promo('BR-0001', ctx.winnerPath, ctx.M), alloc('BR-0002', ctx.loserPath), aliasEv('BR-0001', 'BR-0002', ctx.M)]);
      assertProjection(await ctx.repo.read(ctx.winnerPath), ctx.origWinner, { id: 'BR-0001', id_status: 'permanent', id_alias: null });
      assertProjection(await ctx.repo.read(ctx.loserPath), ctx.origLoser, { id: 'BR-0002', id_status: 'provisional', id_alias: ['BR-0001'] });
    });
  }
}

check('F-E3', 'three colliders in one commit', async (E) => {
  const ctx = await buildE3('e3');
  const { paths, M } = ctx;
  const evBefore = await registryEvents(ctx.dir);
  const result = await promote(E, ctx.dir);
  assert.deepEqual(result.promoted, [{ id: 'BR-0001', path: paths.a1, commit: M }]);
  assert.deepEqual(result.renumbered, [
    { from: 'BR-0001', to: 'BR-0005', path: paths.b2, commit: M },
    { from: 'BR-0001', to: 'BR-0006', path: paths.c3, commit: M },
  ], 'fresh IDs larger than every existing BR ID, lowest first in total order (D-02b)');
  assert.deepEqual(result.entities_rewritten, [paths.a1, paths.b2, paths.c3]);
  assert.deepEqual(await registryEvents(ctx.dir), [...evBefore,
    promo('BR-0001', paths.a1, M),
    alloc('BR-0005', paths.b2), aliasEv('BR-0001', 'BR-0005', M),
    alloc('BR-0006', paths.c3), aliasEv('BR-0001', 'BR-0006', M)], 'D-02c order');
  assertProjection(await ctx.repo.read(paths.a1), ctx.orig.a1, { id: 'BR-0001', id_status: 'permanent', id_alias: null });
  assertProjection(await ctx.repo.read(paths.b2), ctx.orig.b2, { id: 'BR-0005', id_status: 'provisional', id_alias: ['BR-0001'] });
  assertProjection(await ctx.repo.read(paths.c3), ctx.orig.c3, { id: 'BR-0006', id_status: 'provisional', id_alias: ['BR-0001'] });
});

check('F-E4', 'the renumbered entity is promoted by a later call; alias retained', async (E) => {
  const ctx = await buildE1Promoted(E, 'e4a');
  const { dir, repo, P1 } = ctx;
  const rewrittenB = await repo.read(B);
  const evBefore = await registryEvents(dir);
  assert.equal(await oracleFirstCanonical(repo, 'main', B, 'BR-0002'), P1);
  const result = await promote(E, dir);
  assert.deepEqual(result.promoted, [{ id: 'BR-0002', path: B, commit: P1 }]);
  assert.deepEqual([result.renumbered, result.entities_rewritten, result.diagnostics], [[], [B], []]);
  assert.deepEqual(await registryEvents(dir), [...evBefore, promo('BR-0002', B, P1)]);
  assert.ok((await registryEvents(dir)).some((e) => e.op === 'alias' && e.from === 'BR-0001' && e.to === 'BR-0002'));
  assertProjection(await repo.read(B), rewrittenB, { id: 'BR-0002', id_status: 'permanent', id_alias: ['BR-0001'] });
  const frozen = await registryBytes(dir);
  const again = await promote(E, dir);
  assert.deepEqual([again.promoted, again.renumbered, again.entities_rewritten], [[], [], []]);
  assert.equal(await registryBytes(dir), frozen);
});

check('F-E4', 'a second renumber extends id_alias oldest first', async (E) => {
  const ctx = await buildE1(E, 'e4b');
  const { dir, repo } = ctx;
  await promote(E, dir); // first renumbering; its result is NOT committed yet
  const C = br('aaa'); // sorts before B in byte order
  await appendRegistryLine(dir, alloc('BR-0002', C));
  await repo.write(C, entityText({ id: 'BR-0002', name: 'Late claimant' }));
  const originalB = await repo.read(B); // B as BR-0002 with id_alias [BR-0001]
  const M3 = await repo.commit('B (as BR-0002) and C enter canonical together');
  const evBefore = await registryEvents(dir);
  const result = await promote(E, dir);
  assert.deepEqual(result.promoted, [{ id: 'BR-0002', path: C, commit: M3 }]);
  assert.deepEqual(result.renumbered, [{ from: 'BR-0002', to: 'BR-0003', path: B, commit: M3 }]);
  assert.deepEqual(result.entities_rewritten, [C, B]);
  assert.deepEqual(await registryEvents(dir), [...evBefore,
    promo('BR-0002', C, M3), alloc('BR-0003', B), aliasEv('BR-0002', 'BR-0003', M3)]);
  assertProjection(await repo.read(B), originalB, { id: 'BR-0003', id_status: 'provisional', id_alias: ['BR-0001', 'BR-0002'] });
  // E-0016 (2a): C holds the alias target BR-0002 but was never renumbered, so it gets no id_alias
  assertProjection(await repo.read(C), entityText({ id: 'BR-0002', name: 'Late claimant' }), { id: 'BR-0002', id_status: 'permanent', id_alias: null });
});

check('F-E5', 'provisional vs permanent: KF-E-101 on the non-matching path only', async (E) => {
  const ctx = await buildE5(E, 'e5');
  const { dir, repo, M2 } = ctx;
  assert.equal(ctx.b.id, 'BR-0001');
  assert.equal(ctx.g.id, 'BR-0002');
  const report = await E.checkIdCollisions(dir);
  assert.equal(report.diagnostics.length, 1);
  assertDiag(report.diagnostics[0], { id: 'BR-0001', path: B, permanent_path: A });
  assert.deepEqual(report.provisional_collisions, []);
  assert.deepEqual(report.unregistered, []);
  const evBefore = await registryEvents(dir);
  const textA = await repo.read(A);
  const result = await promote(E, dir);
  assert.deepEqual(result.promoted, [{ id: 'BR-0002', path: G, commit: M2 }], 'other IDs are processed normally (D-03c)');
  assert.deepEqual([result.renumbered, result.entities_rewritten], [[], [G]]);
  assert.equal(result.diagnostics.length, 1);
  assertDiag(result.diagnostics[0], { id: 'BR-0001', path: B, permanent_path: A });
  assert.deepEqual(await registryEvents(dir), [...evBefore, promo('BR-0002', G, M2)], 'no new BR-0001 event, no renumbering');
  assert.equal(await repo.read(B), ctx.origB, 'the colliding file is not rewritten');
  assert.equal(await repo.read(A), textA, 'the permanent holder is untouched');
  const frozen = await registryBytes(dir);
  const again = await promote(E, dir);
  assert.equal(again.diagnostics.length, 1);
  assert.equal(await registryBytes(dir), frozen);
});

check('F-E6', 'two permanent claims: KF-E-101 on the non-matching path only', async (E) => {
  const dir = await seededProject([alloc('BR-0001', A), promo('BR-0001', A, FAKE_SHA.a), alloc('BR-0001', B)], 'e6');
  await writeEntity(dir, A, { id: 'BR-0001', status: 'permanent', name: 'Alpha' });
  await writeEntity(dir, B, { id: 'BR-0001', status: 'permanent', name: 'Beta' });
  const report = await E.checkIdCollisions(dir);
  assert.equal(report.diagnostics.length, 1);
  assertDiag(report.diagnostics[0], { id: 'BR-0001', path: B, permanent_path: A });
});

async function continuityProject(label) {
  const dir = await seededProject([alloc('BR-0001', A), promo('BR-0001', A, FAKE_SHA.a)], label);
  await writeEntity(dir, A, { id: 'BR-0001', status: 'permanent', name: 'Alpha' });
  return dir;
}

check('F-E7', 'identity continuity (E-0004)', async (E) => {
  const moveDir = async (dir, from, to) => {
    await fs.mkdir(path.dirname(path.dirname(path.join(dir, ...to.split('/')))), { recursive: true });
    await fs.rename(path.dirname(path.join(dir, ...from.split('/'))), path.dirname(path.join(dir, ...to.split('/'))));
  };
  // (a) unrecorded move
  const a = await continuityProject('e7a');
  await fs.rm(path.join(a, 'knowledge', 'business-rules', 'gamma'), { recursive: true, force: true });
  await moveDir(a, A, G);
  const reportA = await E.checkIdCollisions(a);
  assert.equal(reportA.diagnostics.length, 1);
  assertDiag(reportA.diagnostics[0], { id: 'BR-0001', path: G, permanent_path: A });
  // (b) the same state with a recorded move
  await fs.appendFile(path.join(a, ...REGISTRY_REL.split('/')), `${eventLine(moveEv('BR-0001', A, G))}\n`);
  assert.deepEqual((await E.checkIdCollisions(a)).diagnostics, []);
  const resolved = await E.resolveId(a, 'BR-0001');
  assert.equal(resolved.status, 'live');
  assert.equal(resolved.path, G);
  // (c) only the name changed
  const c = await continuityProject('e7c');
  await writeEntity(c, A, { id: 'BR-0001', status: 'permanent', name: 'A completely different label' });
  assert.deepEqual((await E.checkIdCollisions(c)).diagnostics, []);
  // (d) deleted and recreated at the same path with the same ID and content
  const d = await continuityProject('e7d');
  await fs.rm(path.join(d, 'knowledge'), { recursive: true });
  await writeEntity(d, A, { id: 'BR-0001', status: 'permanent', name: 'Alpha' });
  assert.deepEqual((await E.checkIdCollisions(d)).diagnostics, []);
  // (e) a case-only rename is a different path (paths are exact byte strings)
  const e = await continuityProject('e7e');
  await fs.rm(path.join(e, 'knowledge'), { recursive: true });
  const cased = 'knowledge/business-rules/Alpha/rule.yaml';
  await writeEntity(e, cased, { id: 'BR-0001', status: 'permanent', name: 'Alpha' });
  const reportE = await E.checkIdCollisions(e);
  assert.equal(reportE.diagnostics.length, 1);
  assertDiag(reportE.diagnostics[0], { id: 'BR-0001', path: cased, permanent_path: A });
});

check('F-E8', 'near-miss: provisional holders are not KF-E-101', async (E) => {
  const dir = await seededProject([SEED, alloc('BR-0001', B), alloc('BR-0001', A), alloc('BR-0001', G)], 'e8');
  for (const p of [G, B, A]) await writeEntity(dir, p, { id: 'BR-0001', name: p });
  const report = await E.checkIdCollisions(dir);
  assert.deepEqual(report.diagnostics, []);
  assert.deepEqual(report.provisional_collisions, [{ id: 'BR-0001', paths: [A, B, G] }]);
  assert.deepEqual(report.unregistered, []);
  const clean = await seededProject([SEED, alloc('BR-0001', A)], 'e8b');
  await writeEntity(clean, A, { id: 'BR-0001', name: 'Alpha' });
  const none = await E.checkIdCollisions(clean);
  assert.deepEqual([none.diagnostics, none.provisional_collisions, none.unregistered], [[], [], []]);
});

check('F-E9', 'a pending renumber is not a collision and converges without a new event', async (E) => {
  const ctx = await buildE1Promoted(E, 'e9');
  const { dir, repo } = ctx;
  const rewrittenB = await repo.read(B);
  await repo.write(B, ctx.origB); // process died after the registry write
  const report = await E.checkIdCollisions(dir);
  assert.deepEqual([report.diagnostics, report.provisional_collisions], [[], []]);
  const registryBefore = await registryBytes(dir);
  const result = await promote(E, dir);
  assert.deepEqual([result.promoted, result.renumbered, result.entities_rewritten, result.diagnostics], [[], [], [B], []]);
  assert.equal(await registryBytes(dir), registryBefore);
  assert.equal(await repo.read(B), rewrittenB);
  assertProjection(await repo.read(B), ctx.origB, { id: 'BR-0002', id_status: 'provisional', id_alias: ['BR-0001'] });
});

check('F-E10', 'determinism across builds, a clone, creation order, clock and hostname', async (E) => {
  const one = await buildE1(E, 'e10a');
  const two = await buildE1(E, 'e10b');
  assert.equal(one.M1, two.M1, 'scratch repositories are reproducible');
  assert.equal(one.M2, two.M2);
  const cloneDir = await tmpProject('e10c');
  await run('git', ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', 'clone', '-q', one.dir, cloneDir]);
  await promote(E, one.dir);
  await promote(E, two.dir, { lock: { now: () => new Date(0), hostname: 'another-host', pollMs: 1 } });
  await promote(E, cloneDir);
  const reading = async (dir) => [await registryBytes(dir), await readEntity(dir, A), await readEntity(dir, B)];
  const reference = await reading(one.dir);
  assert.deepEqual(await reading(two.dir), reference, 'independent build');
  assert.deepEqual(await reading(cloneDir), reference, 'clone');
  // creation order of the entity files does not matter (F-E2 shape)
  const pair = T.tie_pairs[0];
  const sorted = await buildE2(E, 'e10d', { winner: pair.winner, loser: pair.loser, creation: 'sorted' });
  const reverse = await buildE2(E, 'e10e', { winner: pair.winner, loser: pair.loser, creation: 'reverse' });
  assert.equal(sorted.M, reverse.M);
  await promote(E, sorted.dir);
  await promote(E, reverse.dir);
  assert.equal(await registryBytes(sorted.dir), await registryBytes(reverse.dir));
  assert.equal(await readEntity(sorted.dir, sorted.winnerPath), await readEntity(reverse.dir, reverse.winnerPath));
  assert.equal(await readEntity(sorted.dir, sorted.loserPath), await readEntity(reverse.dir, reverse.loserPath));
});

check('F-E11', 'invariant sweep: promote lines and holders never change; no ID is reissued', async (E) => {
  const ctx = await buildE1Promoted(E, 'e11');
  const { dir, repo } = ctx;
  const ledger = await registryBytes(dir);
  const promotes = (await registryEvents(dir)).filter((e) => e.op === 'promote');
  assert.equal(promotes.length, 1);
  await repo.remove(A); // the permanent entity is deleted
  const next = await E.allocateId(dir, 'BR', br('delta'));
  assert.equal(next.id, 'BR-0003', 'neither BR-0001 nor BR-0002 is reissued');
  await repo.write(G, entityText({ id: 'BR-0001', name: 'Hijack of a deleted permanent ID' }));
  const report = await E.checkIdCollisions(dir);
  assert.equal(report.diagnostics.length, 1);
  assertDiag(report.diagnostics[0], { id: 'BR-0001', path: G, permanent_path: A });
  const result = await promote(E, dir);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(await repo.read(G), entityText({ id: 'BR-0001', name: 'Hijack of a deleted permanent ID' }), 'not rewritten');
  const final = await registryBytes(dir);
  assert.ok(final.startsWith(ledger), 'registry only ever appended to');
  const events = await registryEvents(dir);
  assert.deepEqual(events.filter((e) => e.op === 'promote' && e.id === 'BR-0001'), promotes, 'promote line unchanged');
  assert.equal(events.filter((e) => e.op === 'move').length, 0, 'holder path never changed');
});

check('F-E12', 'unregistered ID fails closed (E-0015 D-03a)', async (E) => {
  const dir = await seededProject([SEED, alloc('BR-0001', A)], 'e12');
  await writeEntity(dir, A, { id: 'BR-0001', name: 'Alpha' });
  await writeEntity(dir, br('zz'), { id: 'BR-0007', name: 'Stranger 1' });
  await writeEntity(dir, br('aa'), { id: 'BR-0007', name: 'Stranger 2' });
  await writeEntity(dir, 'knowledge/data/x/entity.yaml', { id: 'DE-0003', name: 'Stranger 3', type: 'data-entity' });
  const report = await E.checkIdCollisions(dir);
  assert.deepEqual(report.unregistered, [
    { id: 'BR-0007', path: br('aa') }, { id: 'BR-0007', path: br('zz') }, { id: 'DE-0003', path: 'knowledge/data/x/entity.yaml' },
  ]);
  assert.deepEqual(report.diagnostics, []);
  const before = await snapshot(dir);
  await rejectsWith(E, E.allocateId(dir, 'BR', br('new')), 'UNREGISTERED_ID');
  await rejectsWith(E, E.promoteIds(dir, { canonicalBranch: 'main', history: noopHistory }), 'UNREGISTERED_ID');
  assert.deepEqual(await snapshot(dir), before, 'nothing mutated');
});

check('F-E13', 'only knowledge/, changes/ and divergences/ yaml/yml records are scanned', async (E) => {
  const dir = await seededProject([SEED, alloc('BR-0001', A)], 'e13');
  await writeEntity(dir, A, { id: 'BR-0001', name: 'Alpha' });
  await writeEntity(dir, 'docs/stray.yaml', { id: 'BR-0077', name: 'outside the roots' });
  await fs.mkdir(path.join(dir, 'knowledge'), { recursive: true });
  await fs.writeFile(path.join(dir, 'knowledge', 'notes.txt'), 'id: BR-0078\n');
  await fs.writeFile(path.join(dir, 'knowledge', 'business-rules', 'alpha', 'observed.yaml'), 'schema_version: 2.1\nentity: BR-0001\n');
  await fs.mkdir(path.join(dir, 'changes'), { recursive: true });
  await fs.writeFile(path.join(dir, 'changes', 'CHG-0009.yml'), 'schema_version: 2.1\nid: CHG-0009\n');
  await writeEntity(dir, 'divergences/DIV-0001/divergence.yaml', { id: 'DIV-0001', name: 'd' });
  const report = await E.checkIdCollisions(dir);
  assert.deepEqual(report.unregistered, [
    { id: 'CHG-0009', path: 'changes/CHG-0009.yml' },
    { id: 'DIV-0001', path: 'divergences/DIV-0001/divergence.yaml' },
  ]);
});

// ================================================================== Resolution
const WARNING_KEYS = ['alias_from', 'alias_to', 'kind', 'message'];
const RESOLUTION_KEYS = ['id', 'input', 'path', 'registered', 'status', 'via', 'warnings'];

check('F-R1', 'live holder wins; shadowed alias is a code-less warning', async (E) => {
  const ctx = await buildE1Promoted(E, 'r1');
  const live = await E.resolveId(ctx.dir, 'BR-0001');
  assert.deepEqual(Object.keys(live).sort(), RESOLUTION_KEYS);
  assert.deepEqual([live.input, live.status, live.registered, live.id, live.path, live.via], ['BR-0001', 'live', true, 'BR-0001', A, ['BR-0001']]);
  assert.equal(live.warnings.length, 1);
  assert.deepEqual(Object.keys(live.warnings[0]).sort(), WARNING_KEYS, 'no code key (E-0003)');
  assert.deepEqual([live.warnings[0].kind, live.warnings[0].alias_from, live.warnings[0].alias_to], ['shadowed_alias', 'BR-0001', 'BR-0002']);
  assert.equal(typeof live.warnings[0].message, 'string');
  const other = await E.resolveId(ctx.dir, 'BR-0002');
  assert.deepEqual([other.status, other.id, other.path, other.via, other.warnings], ['live', 'BR-0002', B, ['BR-0002'], []]);
});

check('F-R2', 'alias-only resolution persists across later activity', async (E) => {
  const ctx = await buildE1Promoted(E, 'r2');
  const { dir, repo } = ctx;
  await repo.remove(A);
  const expectAlias = async () => {
    const r = await E.resolveId(dir, 'BR-0001');
    assert.deepEqual([r.input, r.status, r.registered, r.id, r.path, r.via, r.warnings],
      ['BR-0001', 'alias', true, 'BR-0002', B, ['BR-0001', 'BR-0002'], []]);
  };
  await expectAlias();
  await repo.commit('delete A');
  await promote(E, dir);
  await repo.commit('promotion result 2');
  await promote(E, dir);
  assert.ok((await registryEvents(dir)).some((e) => e.op === 'alias' && e.from === 'BR-0001'), 'alias event retained');
  await expectAlias();
});

check('F-R3', 'alias chain stops at the first live holder', async (E) => {
  const [p1, p2, p3] = [br('r1'), br('r2'), br('r3')];
  const events = [alloc('BR-0001', p1), alloc('BR-0002', p2), alloc('BR-0003', p3),
    aliasEv('BR-0001', 'BR-0002', FAKE_SHA.a), aliasEv('BR-0002', 'BR-0003', FAKE_SHA.b)];
  const dir = await seededProject(events, 'r3');
  await writeEntity(dir, p3, { id: 'BR-0003', name: 'Three' });
  const chain = await E.resolveId(dir, 'BR-0001');
  assert.deepEqual([chain.status, chain.id, chain.path, chain.via, chain.warnings], ['alias', 'BR-0003', p3, ['BR-0001', 'BR-0002', 'BR-0003'], []]);
  const middle = await E.resolveId(dir, 'BR-0002');
  assert.deepEqual([middle.status, middle.id, middle.via], ['alias', 'BR-0003', ['BR-0002', 'BR-0003']]);
  await writeEntity(dir, p2, { id: 'BR-0002', name: 'Two' });
  const stopped = await E.resolveId(dir, 'BR-0001');
  assert.deepEqual([stopped.status, stopped.id, stopped.path, stopped.via], ['alias', 'BR-0002', p2, ['BR-0001', 'BR-0002']]);
  const live = await E.resolveId(dir, 'BR-0002');
  assert.equal(live.status, 'live');
  assert.deepEqual(live.warnings.map((w) => [w.alias_from, w.alias_to]), [['BR-0002', 'BR-0003']]);
});

check('F-R4', 'unresolved, invalid and ambiguous addresses', async (E) => {
  const dir = await seededProject([SEED, alloc('BR-0001', A)], 'r4');
  const allocated = await E.resolveId(dir, 'BR-0001');
  assert.deepEqual([allocated.status, allocated.registered, allocated.id, allocated.path, allocated.via, allocated.warnings],
    ['unresolved', true, null, null, [], []]);
  const never = await E.resolveId(dir, 'BR-9999');
  assert.deepEqual([never.status, never.registered, never.id], ['unresolved', false, null]);
  for (const bad of T.invalid_addresses) await rejectsWith(E, E.resolveId(dir, bad), 'INVALID_ID');
  assert.equal((await E.resolveId(dir, 'BR-10000')).status, 'unresolved', 'near-miss: five digits are a valid address');

  // E-0015 D-03b + E-0016 (1b): an unheld ID aliased to two live targets is ambiguous; candidates are
  // {id, path} objects sorted by id then path in ascending UTF-8 byte order
  const target = T.valid_events.find((r) => r.name === 'alias-two-targets');
  const amb = await tmpProject('r4b');
  await writeRegistry(amb, rowRegistry(target.lines));
  await writeEntity(amb, B, { id: 'BR-0002', name: 'Beta' });
  await writeEntity(amb, G, { id: 'BR-0003', name: 'Gamma' });
  const aliased = await E.resolveId(amb, 'BR-0001');
  assert.equal(aliased.status, 'ambiguous');
  assert.deepEqual(aliased.candidates, [{ id: 'BR-0002', path: B }, { id: 'BR-0003', path: G }]);
  // ... and so are two live provisional holders of one ID
  const twin = await seededProject([alloc('BR-0001', B), alloc('BR-0001', A)], 'r4c');
  for (const p of [B, A]) await writeEntity(twin, p, { id: 'BR-0001', name: p });
  const ambiguous = await E.resolveId(twin, 'BR-0001');
  assert.equal(ambiguous.status, 'ambiguous');
  assert.deepEqual(ambiguous.candidates, [{ id: 'BR-0001', path: A }, { id: 'BR-0001', path: B }]);
});

check('F-R5', 'an alias cycle in the registry makes resolveId reject INVALID_REGISTRY', async (E) => {
  const row = T.invalid_events.find((r) => r.name === 'alias-cycle-2');
  const dir = await tmpProject('r5');
  await writeRegistry(dir, rowRegistry(row.lines));
  await rejectsWith(E, E.resolveId(dir, 'BR-0001'), 'INVALID_REGISTRY');
});

// ================================================================== Schema and scope guards
check('F-S1', 'id_alias in entityBase', async () => {
  const { ajv } = await loadSchemas();
  const fixtureRoot = path.join(REPO_ROOT, 'framework', 'conformance', 'acme-formulation');
  for (const [schemaName, rel] of T.schema_cases.schemas) {
    const validate = ajv.getSchema(`https://knowflux.dev/schemas/${schemaName}.schema.json`);
    assert.ok(validate, `schema ${schemaName}`);
    const base = YAML.parse(await fs.readFile(path.join(fixtureRoot, rel), 'utf8'));
    assert.ok(validate(base), `${schemaName}: the unchanged P001 entity stays valid`);
    for (const accepted of T.schema_cases.accepted) {
      assert.ok(validate({ ...base, ...accepted }), `${schemaName}: ${JSON.stringify(accepted)} accepted ${JSON.stringify(validate.errors)}`);
    }
    for (const rejected of T.schema_cases.rejected) {
      assert.ok(!validate({ ...base, id_status: 'permanent', id_alias: rejected.id_alias }), `${schemaName}: ${rejected.name} rejected`);
    }
  }
});

check('F-X1', 'P002 ships no CLI (E-0014)', async () => {
  await assert.rejects(fs.stat(path.join(REPO_ROOT, 'bin')), 'no bin/ directory');
  const manifest = JSON.parse(await fs.readFile(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  assert.ok(!('bin' in manifest), 'no package.json bin entry');
});

// ================================================================== Slice self-check (not a todo case)
test('conformance index: every case_index entry of p002-id-registry.yaml has a test and vice versa', () => {
  assert.deepEqual([...covered].sort(), Object.keys(data.case_index).sort());
  for (const [id, entry] of Object.entries(data.case_index)) {
    assert.ok(Array.isArray(entry.targets) && entry.targets.length > 0, `${id} targets`);
    assert.ok(Array.isArray(entry.cites) && entry.cites.length > 0, `${id} cites a clause, errata entry or PLAN target`);
  }
});
