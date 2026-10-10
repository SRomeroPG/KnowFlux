// P002 ID Registry - conformance slice (spec section 55; l.2103: the fixture is the operative definition
// of "done" and is written together with, never after, the feature).
//
// Written by the conformance engineer from PLAN.md (incl. "Foreman decisions after planning"), the spec and
// errata E-0001..E-0004, E-0007, E-0009..E-0015, BEFORE any implementer code was read. Data and per-case
// citations live in framework/conformance/p002-id-registry.yaml; scenario builders in
// framework/conformance/p002-id-registry/. Case ids (F-xx) and targets (V-nn) are those of the PLAN.
//
// The slice is enforced: PENDING is false, so every case below runs as a normal test and a failing
// expectation fails `npm test`. Expectations are never weakened to pass.
//
// Round R01 remediation (audit .strike-team/phases/P002-id-registry/audits/AUDIT_R01.md, findings F01-F10)
// added F-M1, F-M2, F-E14..F-E19, F-D14, F-B5 and the U+FF5E / U+1F600 tie pair. They were written from the
// audit, PLAN.md and errata E-0001, E-0004, E-0007, E-0009..E-0016, E-0023, E-0024 without reading the engine.
//
// Round R02 remediation (audit .strike-team/phases/P002-id-registry/audits/AUDIT_R02.md, findings F01-F05)
// restated F-D4 under E-0029 and added F-D15 (promotion only at the canonical tip), F-D16 (the R02 merge
// regression), F-D17 (an unreadable blob fails closed), F-D18 (concurrent entity edits survive), F-M3 (E-0034
// replay position) and F-E20 (two relocated copies). Written from the audit, PLAN.md and errata E-0009, E-0011,
// E-0024, E-0028, E-0029, E-0034 only, without reading the engine.
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { loadSchemas } from '../scripts/check-schemas.mjs';
import {
  A, B, ENGINE_URL, FAKE_SHA, G, HEADER, LOCK_REL, REGISTRY_REL, REPO_ROOT, Repo, SEED_PATH,
  alloc, aliasEv, assertProjection, br, cleanupTemp, entityText, eventLine, eventLines, exitedPid,
  isoAgo, lockLeftovers, moveEv, oracleFirstCanonical, parseRegistryText, plantLock, promo,
  registryBytes, registryEvents, registryText, run, runChild, snapshot, spawnLockHolder, tmpLeftovers, tmpProject,
  writeRegistry,
} from '../framework/conformance/p002-id-registry/scratch.mjs';
import {
  allocWrite, appendRegistryLine, buildBlobLoss, buildE1, buildE1Promoted, buildE17, buildE2, buildE3, buildE5,
  buildFeature, buildMergeRegression, buildUnionPromote, buildUnionRenumber, dePath, makeBase, noopHistory, promote,
} from '../framework/conformance/p002-id-registry/scenarios.mjs';

const PENDING = false; // slice enforced (was 'P002 implementation pending')

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

async function rejectsWithAny(E, promise, codes) {
  let error = null;
  try {
    await promise;
  } catch (caught) {
    error = caught;
  }
  assert.ok(error, `expected rejection with one of ${codes.join(' | ')}`);
  assert.equal(error.name, 'IdRegistryError', `error name (got ${error.name}: ${error.message})`);
  assert.ok(error instanceof E.IdRegistryError, 'instance of IdRegistryError');
  assert.ok(codes.includes(error.code), `error code ${error.code} is one of ${codes.join(' | ')} (message: ${error.message})`);
  return error;
}

/** E-0029: the normal "not at the canonical tip" result (not an error). */
function assertSkipped(result, label = '') {
  assert.equal(result.skipped, 'not_canonical_tip', `${label} skipped`);
  assert.deepEqual([result.promoted, result.renumbered, result.entities_rewritten], [[], [], []], `${label} nothing promoted, renumbered or rewritten`);
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
  return line.replaceAll('<A>', subst.A).replaceAll('<B>', subst.B).replaceAll('<G>', subst.G)
    .replaceAll('<Sa>', FAKE_SHA.a).replaceAll('<Sb>', FAKE_SHA.b);
}

const BASE_EVENTS = [alloc('BR-0001', A), alloc('BR-0002', B), alloc('BR-0003', G)];

function rowRegistry(lines) {
  return registryText(BASE_EVENTS) + lines.map((l) => `  - ${fillRow(l, { A, B, G })}\n`).join('');
}

/** Complete event list without the base events (same placeholders). */
function fullRegistry(lines) {
  return HEADER + lines.map((l) => `  - ${fillRow(l, { A, B, G })}\n`).join('');
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

// Audit R01 F07 (V-12, V-17; E-0013): every earlier lock test plants owner.json by hand. These read the file the
// ENGINE writes (PLAN "Lock and atomic write": {"pid": <int>, "host": <string>, "acquired_at": <ISO-8601 UTC string>}).
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const ownerFile = (dir) => path.join(dir, ...LOCK_REL.split('/'), 'owner.json');

function assertEngineOwner(owner, startedAt, endedAt, label) {
  assert.deepEqual(Object.keys(owner).sort(), ['acquired_at', 'host', 'pid'], `${label}: exactly pid, host, acquired_at`);
  assert.ok(Number.isInteger(owner.pid) && owner.pid > 0, `${label}: pid is a positive integer (got ${owner.pid})`);
  assert.equal(owner.pid, process.pid, `${label}: pid is the process that took the lock`);
  assert.equal(owner.host, os.hostname(), `${label}: host is os.hostname()`);
  assert.equal(typeof owner.acquired_at, 'string');
  assert.match(owner.acquired_at, ISO_UTC, `${label}: acquired_at is an ISO-8601 UTC string`);
  const at = Date.parse(owner.acquired_at);
  assert.ok(at >= startedAt - 1000 && at <= endedAt + 1000, `${label}: acquired_at is current (${owner.acquired_at})`);
}

check('F-B5', '(i) allocateId: owner.json written while the lock is held is exactly {pid, host, acquired_at}', async (E) => {
  const dir = await seededProject([SEED], 'b5a');
  let owner = null;
  const spy = async (from, to) => {
    if (path.basename(to) === 'id-registry.yaml') owner = JSON.parse(await fs.readFile(ownerFile(dir), 'utf8'));
    return fs.rename(from, to);
  };
  const startedAt = Date.now();
  await E.allocateId(dir, 'BR', br('x'), { rename: spy });
  assert.ok(owner, 'the lock owner file existed while the registry was being written');
  assertEngineOwner(owner, startedAt, Date.now(), 'allocateId');
  assert.deepEqual(await lockLeftovers(dir), [], 'lock released');
});

check('F-B5', '(ii) promoteIds: the same owner file while promotion holds the lock', async (E) => {
  const ctx = await buildFeature(E, 'b5b');
  await ctx.repo.checkout('main');
  await ctx.repo.mergeNoFf('feature', 'M');
  let owner = null;
  const spy = async (from, to) => {
    if (path.basename(to) === 'id-registry.yaml') owner = JSON.parse(await fs.readFile(ownerFile(ctx.dir), 'utf8'));
    return fs.rename(from, to);
  };
  const startedAt = Date.now();
  await promote(E, ctx.dir, { rename: spy });
  assert.ok(owner, 'the lock owner file existed while the registry was being written');
  assertEngineOwner(owner, startedAt, Date.now(), 'promoteIds');
});

check('F-B5', '(iii) end to end: a lock held by a killed process is recovered with a small staleAfterMs', async (E) => {
  const dir = await seededProject([SEED], 'b5c');
  const holder = spawnLockHolder(dir);
  try {
    await holder.ready;
    const owner = JSON.parse(await fs.readFile(ownerFile(dir), 'utf8'));
    assert.deepEqual(Object.keys(owner).sort(), ['acquired_at', 'host', 'pid']);
    assert.equal(owner.pid, holder.child.pid, 'owner.pid is the holder process, not the parent');
    assert.equal(owner.host, os.hostname());
    assert.match(owner.acquired_at, ISO_UTC);
    // near-miss: while the holder is alive the lock is never broken, however small staleAfterMs is
    const bytes = await registryBytes(dir);
    await rejectsWith(E, E.allocateId(dir, 'BR', br('blocked'), { lock: { deadlineMs: 400, staleAfterMs: 1, pollMs: 10 } }), 'LOCK_TIMEOUT');
    assert.equal(await registryBytes(dir), bytes, 'registry untouched while the holder lives');
    await fs.stat(path.join(dir, ...LOCK_REL.split('/')));
    holder.child.kill('SIGKILL');
    await holder.exited;
    // the holder died inside the registry rename: no registry change was ever published
    const got = await E.allocateId(dir, 'BR', br('after'), { lock: { deadlineMs: 60000, staleAfterMs: 50, pollMs: 10 } });
    assert.equal(got.id, 'BR-0001');
    assert.equal((await registryEvents(dir)).length, 2);
    assert.deepEqual(await lockLeftovers(dir), [], 'dead holder lock removed, new lock released');
  } finally {
    holder.child.kill('SIGKILL');
  }
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

// Audit R01 F01/F10, E-0024 (1): a routine union merge must not disable the registry.
check('F-M1', '(a) two branches each ran promoteIds (allocateId in opposite orders), union-merged', async (E) => {
  const ctx = await buildUnionPromote(E, 'm1a');
  const { dir } = ctx;
  assert.equal(ctx.x1.id, 'BR-0002');
  assert.equal(ctx.y1.id, 'BR-0002');
  const text = await registryBytes(dir);
  assert.ok(!/^(<<<<<<<|=======|>>>>>>>)/m.test(text), 'no conflict markers');
  const promoteLines = eventLines(text).filter((line) => line.includes('op: promote'));
  assert.equal(promoteLines.length, 2, 'precondition: the union merge left two promote lines');
  assert.equal(promoteLines[0], promoteLines[1], 'precondition: they are byte-identical');
  assert.ok(promoteLines[0].includes(ctx.M0), 'both record the commit where BR-0001 first appeared on main');
  const registry = await E.readIdRegistry(dir); // E-0024 (1): must not throw
  assert.ok(registry.events.some((e) => e.op === 'promote' && e.id === 'BR-0001' && e.path === A && e.commit === ctx.M0));

  const before = await snapshot(dir);
  const result = await promote(E, dir);
  assert.deepEqual([result.promoted, result.renumbered, result.entities_rewritten, result.diagnostics], [[], [], [], []],
    'a repeat promotion after the merge has nothing to do');
  assert.deepEqual(await snapshot(dir), before, 'no new event and no rewrite');
  const report = await E.checkIdCollisions(dir);
  assert.deepEqual([report.diagnostics, report.unregistered], [[], []]);
  const live = await E.resolveId(dir, 'BR-0001');
  assert.deepEqual([live.status, live.path, live.warnings], ['live', A, []]);
  assert.equal((await E.allocateId(dir, 'BR', br('z1'))).id, 'BR-0003', 'BR-0002 was allocated on both branches; the counter skips it');
});

check('F-M1', '(b) the same with a pending renumber: duplicate promote, allocate and alias lines', async (E) => {
  const ctx = await buildUnionRenumber(E, 'm1b');
  const { dir, repo } = ctx;
  const text = await registryBytes(dir);
  const lines = (op) => eventLines(text).filter((line) => line.includes(`op: ${op}`));
  assert.equal(lines('promote').length, 2, 'precondition: duplicated promote');
  assert.equal(lines('alias').length, 2, 'precondition: duplicated alias');
  await E.readIdRegistry(dir); // must not throw
  const live = await E.resolveId(dir, 'BR-0001');
  assert.equal(live.status, 'live');
  assert.equal(live.warnings.length, 1, 'a duplicated alias line is one alias, so one shadowed_alias warning');
  assert.deepEqual([live.warnings[0].alias_from, live.warnings[0].alias_to], ['BR-0001', 'BR-0002']);
  // BR-0002 (file B) entered main with the merge of p1; promoting it is the only thing left to do
  const entered = await oracleFirstCanonical(repo, 'main', B, 'BR-0002');
  const eventsBefore = await registryEvents(dir);
  const result = await promote(E, dir);
  assert.deepEqual(result.promoted, [{ id: 'BR-0002', path: B, commit: entered }]);
  assert.deepEqual([result.renumbered, result.diagnostics, result.entities_rewritten], [[], [], [B]],
    'BR-0001 is already promoted and BR-0001 is not renumbered a second time');
  assert.deepEqual((await registryEvents(dir)).slice(eventsBefore.length), [promo('BR-0002', B, entered)]);
  assertProjection(await repo.read(B), ctx.origB, { id: 'BR-0002', id_status: 'permanent', id_alias: ['BR-0001'] });
  const frozen = await registryBytes(dir);
  const again = await promote(E, dir);
  assert.deepEqual([again.promoted, again.renumbered, again.entities_rewritten], [[], [], []]);
  assert.equal(await registryBytes(dir), frozen);
});

check('F-M2', 'exact duplicate promote, alias and move events are no-op repeats', async (E) => {
  for (const row of T.idempotent_events) {
    const dir = await tmpProject('m2');
    await fs.mkdir(path.join(dir, '.kf'));
    const text = rowRegistry(row.lines);
    await fs.writeFile(path.join(dir, ...REGISTRY_REL.split('/')), text);
    await E.readIdRegistry(dir).catch((error) => { error.message = `${row.name}: ${error.message}`; throw error; });
    const got = await E.allocateId(dir, 'BR', br('n'));
    assert.equal(got.id, 'BR-0004', `${row.name}: the registry stays usable`);
    const after = await registryBytes(dir);
    assert.ok(after.startsWith(text), `${row.name}: append-only, duplicates are not rewritten`);
    assert.equal(eventLines(after).length, eventLines(text).length + 1, `${row.name}: exactly one line appended`);
  }
});

check('F-M2', 'a non-identical conflicting promote, alias or move stays invalid (fail closed)', async (E) => {
  for (const row of T.conflicting_events) {
    const dir = await tmpProject('m2c');
    await fs.mkdir(path.join(dir, '.kf'));
    const text = rowRegistry(row.lines);
    await fs.writeFile(path.join(dir, ...REGISTRY_REL.split('/')), text);
    await rejectsWith(E, E.readIdRegistry(dir), 'INVALID_REGISTRY').catch((error) => { error.message = `${row.name}: ${error.message}`; throw error; });
    await rejectsWith(E, E.allocateId(dir, 'BR', br('y')), 'INVALID_REGISTRY');
    assert.equal(await registryBytes(dir), text, `${row.name}: file unchanged`);
  }
});

// Audit R02 F04, E-0034: the E-0024 (2) check is made at the alias's replay position.
check('F-M3', 'E-0034: the permanent-renumber check is judged at the alias replay position', async (E) => {
  for (const row of T.replay_position_valid) {
    const dir = await tmpProject('m3v');
    await fs.mkdir(path.join(dir, '.kf'));
    const text = fullRegistry(row.lines);
    await fs.writeFile(path.join(dir, ...REGISTRY_REL.split('/')), text);
    const registry = await E.readIdRegistry(dir).catch((error) => { error.message = `${row.name}: ${error.message}`; throw error; });
    assert.deepEqual(registry.events, parseRegistryText(text).events, `${row.name}: events read as written`);
    const got = await E.allocateId(dir, 'BR', br('n'));
    assert.equal(got.id, 'BR-0003', `${row.name}: the registry stays usable`);
    assert.ok((await registryBytes(dir)).startsWith(text), `${row.name}: append-only`);
  }
  for (const row of T.replay_position_invalid) {
    const dir = await tmpProject('m3i');
    await fs.mkdir(path.join(dir, '.kf'));
    const text = fullRegistry(row.lines);
    await fs.writeFile(path.join(dir, ...REGISTRY_REL.split('/')), text);
    await rejectsWith(E, E.readIdRegistry(dir), 'INVALID_REGISTRY').catch((error) => { error.message = `${row.name}: ${error.message}`; throw error; });
    await rejectsWith(E, E.allocateId(dir, 'BR', br('y')), 'INVALID_REGISTRY');
    assert.equal(await registryBytes(dir), text, `${row.name}: file unchanged`);
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

// RESTATED under E-0029 (audit R02 F01): the PLAN statement "promotion from a feature checkout reads main's history
// and promotes" (F-D4, V-33/V-35) is superseded. Only the canonical tip checkout promotes; elsewhere it is a no-op.
check('F-D4', 'E-0029: a feature-branch checkout skips promotion and writes nothing; main promotes with its own history', async (E) => {
  const ctx = await buildFeature(E, 'd4');
  const { repo, dir } = ctx;
  await repo.checkout('main');
  const M = await repo.mergeNoFf('feature', 'M');
  await repo.checkout('feature');
  await repo.write('notes/readme.txt', 'later feature work\n');
  await repo.commit('c2 on feature');
  assert.notEqual(ctx.featureCommit, M);
  const before = await snapshot(dir);
  const result = await promote(E, dir);
  assertSkipped(result, 'feature checkout');
  assert.deepEqual(await snapshot(dir), before, 'E-0029: registry, entities and .kf are byte-identical');
  assert.equal(await oracleFirstCanonical(repo, 'main', A, 'BR-0001'), M);
  await repo.checkout('main');
  const onMain = await promote(E, dir);
  assert.equal(onMain.skipped, undefined, 'near-miss: the canonical tip checkout is not skipped');
  assert.deepEqual(onMain.promoted, [{ id: 'BR-0001', path: A, commit: M }], 'main promotes with its own first-parent commit');
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

// Audit R01 F04, E-0024 (4): the canonical branch is a branch, resolved as refs/heads/<name> then
// refs/remotes/origin/<name>; Git ignores replace refs.
check('F-D14', '(a) a same-named tag does not shadow the branch; revision expressions, tags and invalid names are rejected', async (E) => {
  const repo = await makeBase('d14a');
  for (const n of [2, 3, 4]) {
    await repo.write(`notes/${n}.txt`, `${n}\n`);
    await repo.commit(`c${n}`);
  }
  const all = await repo.firstParent('main');
  assert.equal(all.length, 4);
  await repo.git('checkout', '-q', '-b', 'side'); // gives "@{-1}" something to name
  await repo.git('checkout', '-q', 'main');
  await repo.git('tag', 'main', all[1]); // lightweight tag named like the branch, at HEAD~2
  await repo.git('tag', 'v1', all[3]);
  await repo.git('branch', 'release/1.0', all[2]);
  const reader = E.createGitHistoryReader(repo.dir);
  assert.deepEqual(await reader.firstParentCommits('main'), all, 'refs/heads/main wins over refs/tags/main');
  assert.deepEqual(await reader.firstParentCommits('release/1.0'), all.slice(0, 3), 'near-miss: a branch name with a slash and a dot');
  for (const bad of T.not_a_branch) {
    await rejectsWith(E, reader.firstParentCommits(bad), 'CANONICAL_BRANCH_UNRESOLVED').catch((error) => {
      error.message = `${JSON.stringify(bad)}: ${error.message}`;
      throw error;
    });
  }
});

check('F-D14', '(b) promoteIds follows the branch, not a same-named tag; a tag-only name is refused unchanged', async (E) => {
  const ctx = await buildFeature(E, 'd14b');
  const { repo, dir } = ctx;
  await repo.checkout('main');
  const M = await repo.mergeNoFf('feature', 'M');
  await repo.git('tag', 'main', repo.b0); // would hide the merge if tags won
  await repo.git('tag', 'only-a-tag', M);
  const before = await snapshot(dir);
  await rejectsWith(E, E.promoteIds(dir, { canonicalBranch: 'only-a-tag' }), 'CANONICAL_BRANCH_UNRESOLVED');
  await rejectsWith(E, E.promoteIds(dir, { canonicalBranch: 'main~0' }), 'CANONICAL_BRANCH_UNRESOLVED');
  assert.deepEqual(await snapshot(dir), before, 'refusals leave registry and entities byte-identical');
  const result = await promote(E, dir);
  assert.deepEqual(result.promoted, [{ id: 'BR-0001', path: A, commit: M }]);
});

check('F-D14', '(c) a clone resolves a remote-only branch; a local branch wins over origin/<name>', async (E) => {
  const origin = await makeBase('d14o');
  await origin.checkout('release', { create: true });
  await origin.write('notes/r.txt', 'r\n');
  await origin.commit('release work');
  await origin.checkout('main');
  const flags = ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf'];
  const cloneDir = await tmpProject('d14c');
  await run('git', [...flags, 'clone', '-q', pathToFileURL(origin.dir).href, cloneDir]);
  const clone = new Repo(cloneDir);
  assert.equal(await clone.git('branch', '--list', 'release'), '', 'precondition: no local release branch');
  const reader = E.createGitHistoryReader(cloneDir);
  const remoteRelease = await clone.firstParent('refs/remotes/origin/release');
  assert.equal(remoteRelease.length, 2);
  assert.deepEqual(await reader.firstParentCommits('release'), remoteRelease, 'refs/remotes/origin/release is the fallback');
  await clone.write('notes/local.txt', 'l\n');
  const local = await clone.commit('local work on main');
  const localMain = await clone.firstParent('refs/heads/main');
  assert.equal(localMain.at(-1), local);
  assert.notDeepEqual(localMain, await clone.firstParent('refs/remotes/origin/main'));
  assert.deepEqual(await reader.firstParentCommits('main'), localMain, 'the local branch wins');
  await rejectsWith(E, reader.firstParentCommits('origin/release'), 'CANONICAL_BRANCH_UNRESOLVED');
  await rejectsWith(E, reader.firstParentCommits('does-not-exist'), 'CANONICAL_BRANCH_UNRESOLVED');
});

check('F-D14', '(d) replace refs do not alter the history the engine reads', async (E) => {
  const repo = await makeBase('d14d');
  for (const n of [2, 3, 4]) {
    await repo.write(`notes/${n}.txt`, `${n}\n`);
    await repo.commit(`c${n}`);
  }
  const all = await repo.firstParent('main');
  const tree = await repo.git('rev-parse', `${all[2]}^{tree}`);
  const fake = await repo.git('commit-tree', tree, '-p', all[0], '-m', 'replacement');
  await repo.git('replace', all[2], fake);
  assert.notDeepEqual(await repo.firstParent('main'), all, 'precondition: plain git sees the replacement');
  assert.deepEqual(await E.createGitHistoryReader(repo.dir).firstParentCommits('main'), all);
});

// Audit R02 F01, E-0029: promotion runs only when the commit of HEAD equals the commit the canonical branch
// resolves to (E-0024 (4)); otherwise it is a normal result with skipped: 'not_canonical_tip' and writes nothing.
check('F-D15', '(a) a feature-branch checkout never promotes, even when main holds colliders', async (E) => {
  const ctx = await buildE1(E, 'd15a');
  const { repo, dir, M1, M2 } = ctx;
  await repo.checkout('side', { create: true });
  await repo.write('notes/side.txt', 'side work\n');
  assert.notEqual(await repo.commit('side work'), M2, 'precondition: HEAD is not the tip of main');
  const before = await snapshot(dir);
  const skipped = await promote(E, dir);
  assertSkipped(skipped, 'feature checkout');
  assert.deepEqual(await snapshot(dir), before, 'registry and entities are byte-identical');
  assert.deepEqual(await lockLeftovers(dir), []);
  // near-miss: the same repository with main checked out promotes and renumbers
  await repo.checkout('main');
  const done = await promote(E, dir);
  assert.equal(done.skipped, undefined);
  assert.deepEqual(done.promoted, [{ id: 'BR-0001', path: A, commit: M1 }]);
  assert.deepEqual(done.renumbered, [{ from: 'BR-0001', to: 'BR-0002', path: B, commit: M2 }]);
});

check('F-D15', '(b) a detached HEAD at an older main commit skips', async (E) => {
  const ctx = await buildE1(E, 'd15b');
  const { repo, dir, M1, M2 } = ctx;
  await repo.git('checkout', '-q', '--detach', M1);
  assert.notEqual(await repo.head(), M2);
  assert.equal(await repo.git('rev-parse', 'refs/heads/main'), M2, 'precondition: main itself is ahead');
  const before = await snapshot(dir);
  assertSkipped(await promote(E, dir), 'older main commit');
  assert.deepEqual(await snapshot(dir), before, 'registry and entities are byte-identical');
});

check('F-D15', '(c) a detached HEAD exactly at the canonical tip promotes normally', async (E) => {
  const ctx = await buildE1(E, 'd15c');
  const { repo, dir, M1, M2 } = ctx;
  await repo.git('checkout', '-q', '--detach', 'main');
  assert.equal(await repo.head(), M2);
  const evBefore = await registryEvents(dir);
  const result = await promote(E, dir);
  assert.equal(result.skipped, undefined);
  assert.deepEqual(result.promoted, [{ id: 'BR-0001', path: A, commit: M1 }]);
  assert.deepEqual(result.renumbered, [{ from: 'BR-0001', to: 'BR-0002', path: B, commit: M2 }]);
  assert.deepEqual(result.entities_rewritten, [A, B]);
  assert.deepEqual(await registryEvents(dir), [...evBefore,
    promo('BR-0001', A, M1), alloc('BR-0002', B), aliasEv('BR-0001', 'BR-0002', M2)]);
  assertProjection(await repo.read(A), ctx.origA, { id: 'BR-0001', id_status: 'permanent', id_alias: null });
  assertProjection(await repo.read(B), ctx.origB, { id: 'BR-0002', id_status: 'provisional', id_alias: ['BR-0001'] });
});

check('F-D15', '(d) a clone with only refs/remotes/origin/main: detached older commit skips, detached at it promotes', async (E) => {
  const origin = await buildE1(E, 'd15o');
  const { M1, M2 } = origin;
  const cloneDir = await tmpProject('d15d');
  await run('git', ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', 'clone', '-q', pathToFileURL(origin.dir).href, cloneDir]);
  const clone = new Repo(cloneDir);
  await clone.git('config', 'core.autocrlf', 'false');
  await clone.git('config', 'core.eol', 'lf');
  await clone.git('checkout', '-q', '--detach');
  await clone.git('branch', '-D', 'main');
  assert.equal(await clone.git('branch', '--list', 'main'), '', 'precondition: no local main');
  assert.equal(await clone.git('rev-parse', 'refs/remotes/origin/main'), M2, 'precondition: the remote-tracking branch is the tip');

  await clone.git('checkout', '-q', '--detach', M1);
  const before = await snapshot(cloneDir);
  assertSkipped(await promote(E, cloneDir), 'older origin/main commit');
  assert.deepEqual(await snapshot(cloneDir), before, 'registry and entities are byte-identical');

  await clone.git('checkout', '-q', '--detach', 'refs/remotes/origin/main');
  assert.equal(await clone.head(), M2);
  const evBefore = await registryEvents(cloneDir);
  const result = await promote(E, cloneDir);
  assert.equal(result.skipped, undefined);
  assert.deepEqual(result.promoted, [{ id: 'BR-0001', path: A, commit: M1 }]);
  assert.deepEqual(result.renumbered, [{ from: 'BR-0001', to: 'BR-0002', path: B, commit: M2 }]);
  assert.deepEqual(await registryEvents(cloneDir), [...evBefore,
    promo('BR-0001', A, M1), alloc('BR-0002', B), aliasEv('BR-0001', 'BR-0002', M2)]);
});

// Audit R02 F01 reproduction (p1.mjs): promotion on f2, then on main, then merge f2. With E-0029 the registry
// never contains two different promote (or renumber) facts for one ID.
check('F-D16', 'promote on f2 (skipped), then on main, then merge f2: the registry stays valid and writable', async (E) => {
  const ctx = await buildMergeRegression(E, 'd16');
  const { repo, dir, M1, M2 } = ctx;
  assert.equal(await repo.git('rev-parse', '--abbrev-ref', 'HEAD'), 'f2');
  assert.equal(ctx.deAllocation.id, 'DE-0001');
  const before = await snapshot(dir);
  assertSkipped(await promote(E, dir), 'f2');
  assert.deepEqual(await snapshot(dir), before, 'f2 is untouched');

  await repo.checkout('main');
  const onMain = await promote(E, dir);
  assert.deepEqual(onMain.promoted, [{ id: 'BR-0001', path: A, commit: M1 }]);
  assert.deepEqual(onMain.renumbered, [{ from: 'BR-0001', to: 'BR-0002', path: B, commit: M2 }]);
  const P = await repo.commit('promotion result on main');
  await repo.mergeNoFf('f2', 'merge f2'); // clean: registry union, entity B only changed on main

  const text = await registryBytes(dir);
  assert.ok(!/^(<<<<<<<|=======|>>>>>>>)/m.test(text), 'no conflict markers');
  const registry = await E.readIdRegistry(dir); // R02 F01: used to throw INVALID_REGISTRY "promoted twice"
  assert.deepEqual(registry.events.filter((e) => e.op === 'promote'), [promo('BR-0001', A, M1)], 'exactly one promote of BR-0001');
  assert.equal(eventLines(text).filter((line) => line.includes('op: promote')).length, 1, 'one physical promote line');
  assert.ok(registry.events.some((e) => e.op === 'allocate' && e.id === 'DE-0001'), 'the allocation made on f2 survived the merge');
  assert.deepEqual((await E.checkIdCollisions(dir)).diagnostics, []);
  // the registry is still usable: the renumbered BR-0002 (entered main with the promotion result) is promoted
  const later = await promote(E, dir);
  assert.equal(later.skipped, undefined);
  assert.deepEqual(later.promoted, [{ id: 'BR-0002', path: B, commit: P }]);
  assert.deepEqual(later.diagnostics, []);
});

// E-0035 (2): the optional headCommit() of the history reader gives the checkout's HEAD; without it the reader is
// treated as positioned at the canonical tip (so the injected-history cases above stay as written).
check('F-D19', 'an injected reader with headCommit(): different from the last first-parent commit skips, equal promotes', async (E) => {
  const sha = (n) => `${'c'.repeat(39)}${n}`;
  const commits = [1, 2, 3, 4].map(sha);
  const reader = (head) => ({
    firstParentCommits: async () => commits,
    headCommit: async () => head,
    readFile: async (commit, p) => (p === A && commit >= sha(2) ? entityText({ id: 'BR-0001', name: 'Alpha' }) : null),
  });
  const dir = await seededProject([SEED, alloc('BR-0001', A)], 'd19');
  await writeEntity(dir, A, { id: 'BR-0001', name: 'Alpha' });
  const before = await snapshot(dir);
  for (const head of [sha(3), sha(1), sha(9)]) {
    assertSkipped(await E.promoteIds(dir, { canonicalBranch: 'main', history: reader(head) }), `headCommit ${head}`);
    assert.deepEqual(await snapshot(dir), before, 'registry and entities are byte-identical');
  }
  const result = await E.promoteIds(dir, { canonicalBranch: 'main', history: reader(sha(4)) });
  assert.equal(result.skipped, undefined, 'headCommit equals the last first-parent commit');
  assert.deepEqual(result.promoted, [{ id: 'BR-0001', path: A, commit: sha(2) }]);
  assert.deepEqual(result.entities_rewritten, [A]);
});

// Audit R02 F02: an object-read failure is not "the path is absent".
check('F-D17', '(a) the default reader fails closed on a missing blob; absent paths still read as null', async (E) => {
  const ctx = await buildBlobLoss(E, 'd17a');
  const { repo, dir, c1, c2, v2 } = ctx;
  assert.equal((await run('git', ['rev-parse', '--is-shallow-repository'], { cwd: dir })).trim(), 'false', 'precondition: not shallow');
  const reader = E.createGitHistoryReader(dir);
  await rejectsWithAny(E, reader.readFile(c1, A), ['GIT_FAILED', 'HISTORY_INCOMPLETE']);
  // near-misses: genuinely absent paths / readable blobs
  assert.equal(await reader.readFile(c1, 'no/such/file.yaml'), null, 'path absent from an existing commit');
  assert.equal(await reader.readFile(repo.b0, A), null, 'A is absent from B0');
  assert.equal(await reader.readFile(c2, A), v2, 'the v2 blob is intact');
  assert.deepEqual(await reader.firstParentCommits('main'), [repo.b0, c1, c2]);
});

check('F-D17', '(b) promoteIds at the canonical tip fails closed and mutates nothing', async (E) => {
  const ctx = await buildBlobLoss(E, 'd17b');
  const { repo, dir } = ctx;
  assert.equal(await repo.git('rev-parse', 'HEAD'), await repo.git('rev-parse', 'refs/heads/main'), 'precondition: at the tip');
  const before = await snapshot(dir);
  await rejectsWithAny(E, promote(E, dir), ['GIT_FAILED', 'HISTORY_INCOMPLETE']);
  assert.deepEqual(await snapshot(dir), before, 'registry, entity, tmp files and lock all as before');
  assert.deepEqual(await registryEvents(dir), [SEED, alloc('BR-0001', A)], 'no promote event with the wrong (later) commit');
});

// Audit R02 F03: a concurrent edit to an entity file is never discarded by the rewrite.
const EDIT_LINE = 'reviewer_note: edited while promotion ran';

async function appendEdit(dir, rel) {
  await fs.appendFile(path.join(dir, ...rel.split('/')), `${EDIT_LINE}\n`);
}

/** Default Git reader whose readFile appends the edit to `target` the first time that path is read. */
function racingHistory(E, dir, target) {
  const real = E.createGitHistoryReader(dir);
  const state = { fired: false };
  return {
    state,
    history: {
      firstParentCommits: (branch) => real.firstParentCommits(branch),
      readFile: async (commit, p) => {
        if (!state.fired && p === target) {
          state.fired = true;
          await appendEdit(dir, target);
        }
        return real.readFile(commit, p);
      },
    },
  };
}

/** Injected rename that appends the edit to `target` just before the registry is renamed into place. */
function racingRename(dir, target) {
  const state = { fired: false };
  return {
    state,
    rename: async (from, to) => {
      if (!state.fired && path.basename(to) === 'id-registry.yaml') {
        state.fired = true;
        await appendEdit(dir, target);
      }
      return fs.rename(from, to);
    },
  };
}

/**
 * First call: the edit line is still in the file, and the file is either rewritten (identity keys only, edit kept)
 * or byte-identical to the edited text. Second call: converged to `expected` with the edit kept. Third: idempotent.
 * E-0035 (3): a file not rewritten because its bytes changed is listed in entities_skipped (else []).
 */
async function assertEditSurvives(E, { repo, dir, target, edited, expected, first }) {
  const afterFirst = await repo.read(target);
  assert.ok(afterFirst.split('\n').includes(EDIT_LINE), 'the concurrent edit is still in the file after the first call');
  if (first.entities_rewritten.includes(target)) {
    assertProjection(afterFirst, edited, expected);
    assert.deepEqual(first.entities_skipped, [], 'E-0035 (3): nothing skipped when the file was rewritten');
  } else {
    assert.equal(afterFirst, edited, 'a file not listed as rewritten is byte-identical to the edited text');
    assert.deepEqual(first.entities_skipped, [target], 'E-0035 (3): the held-back file is listed in entities_skipped');
  }
  const second = await promote(E, dir);
  assert.equal(second.skipped, undefined);
  assert.deepEqual(second.entities_skipped, [], 'E-0035 (3): the converging call skips nothing');
  assert.deepEqual(second.diagnostics, []);
  assertProjection(await repo.read(target), edited, expected);
  const frozen = { registry: await registryBytes(dir), entity: await repo.read(target) };
  const third = await promote(E, dir);
  assert.deepEqual([third.promoted, third.renumbered, third.entities_rewritten], [[], [], []], 'converged: idempotent');
  assert.equal(await registryBytes(dir), frozen.registry);
  assert.equal(await repo.read(target), frozen.entity);
}

async function mainWithFeatureA(E, label) {
  const ctx = await buildFeature(E, label);
  await ctx.repo.checkout('main');
  await ctx.repo.mergeNoFf('feature', 'M');
  return { ...ctx, edited: `${ctx.origA}${EDIT_LINE}\n` };
}

check('F-D18', '(a) an edit made while history.readFile runs is preserved; the next call converges', async (E) => {
  const ctx = await mainWithFeatureA(E, 'd18a');
  const { repo, dir, edited } = ctx;
  const { history, state } = racingHistory(E, dir, A);
  const first = await promote(E, dir, { history });
  assert.ok(state.fired, 'precondition: the injected edit ran');
  assert.equal(first.skipped, undefined);
  await assertEditSurvives(E, { repo, dir, target: A, edited, first, expected: { id: 'BR-0001', id_status: 'permanent', id_alias: null } });
  assert.equal((await registryEvents(dir)).filter((e) => e.op === 'promote').length, 1, 'one promote event overall');
});

check('F-D18', '(b) an edit made just before the registry rename is preserved; the next call converges', async (E) => {
  const ctx = await mainWithFeatureA(E, 'd18b');
  const { repo, dir, edited } = ctx;
  const { rename, state } = racingRename(dir, A);
  const first = await promote(E, dir, { rename });
  assert.ok(state.fired, 'precondition: the injected edit ran');
  await assertEditSurvives(E, { repo, dir, target: A, edited, first, expected: { id: 'BR-0001', id_status: 'permanent', id_alias: null } });
  assert.equal((await registryEvents(dir)).filter((e) => e.op === 'promote').length, 1, 'one promote event overall');
});

check('F-D18', '(c) only the edited file is held back: the other entity is rewritten, the renumbered one converges with its edit', async (E) => {
  const ctx = await buildE1(E, 'd18c');
  const { repo, dir } = ctx;
  const editedB = `${ctx.origB}${EDIT_LINE}\n`;
  const { history, state } = racingHistory(E, dir, B);
  const first = await promote(E, dir, { history });
  assert.ok(state.fired, 'precondition: the injected edit ran');
  assert.deepEqual(first.diagnostics, []);
  assert.ok(first.entities_rewritten.includes(A), 'the unedited file is rewritten normally');
  assertProjection(await repo.read(A), ctx.origA, { id: 'BR-0001', id_status: 'permanent', id_alias: null });
  await assertEditSurvives(E, {
    repo, dir, target: B, edited: editedB, first, expected: { id: 'BR-0002', id_status: 'provisional', id_alias: ['BR-0001'] },
  });
  const events = await registryEvents(dir);
  assert.equal(events.filter((e) => e.op === 'promote' && e.id === 'BR-0001').length, 1, 'one promote of BR-0001');
  assert.equal(events.filter((e) => e.op === 'allocate' && e.id === 'BR-0002').length, 1, 'BR-0002 allocated once');
  assert.equal(events.filter((e) => e.op === 'alias').length, 1, 'one renumbering');
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

// ------------------------------------------------------------------ audit R01 remediation (F02, F03, F05, F06, F08, F09)
check('F-E14', '(a) renumbered entity promoted, then moved with a recorded move: id_alias stays at the new path', async (E) => {
  const ctx = await buildE1Promoted(E, 'e14a');
  const { dir, repo } = ctx;
  const second = await promote(E, dir); // BR-0002 promoted at B (F-E4)
  assert.deepEqual(second.promoted.map((p) => [p.id, p.path]), [['BR-0002', B]], 'precondition');
  await repo.commit('promotion of BR-0002');
  const promotedText = await repo.read(B);
  assert.deepEqual(YAML.parse(promotedText).id_alias, ['BR-0001'], 'precondition: B carries id_alias');
  await repo.write(G, promotedText);
  await repo.remove(B);
  await appendRegistryLine(dir, moveEv('BR-0002', B, G));
  await repo.commit('B moved to G with a recorded move');
  assert.deepEqual((await E.checkIdCollisions(dir)).diagnostics, [], 'near-miss: a recorded move is not KF-E-101');

  const registryBefore = await registryBytes(dir);
  const result = await promote(E, dir);
  assert.deepEqual([result.promoted, result.renumbered, result.entities_rewritten, result.diagnostics], [[], [], [], []],
    'the moved file already carries the registry projection: nothing to rewrite');
  assert.equal(await registryBytes(dir), registryBefore, 'no new event');
  assert.equal(await repo.read(G), promotedText, 'id_alias is not erased by the move');
  const moved = await E.resolveId(dir, 'BR-0002');
  assert.deepEqual([moved.status, moved.path], ['live', G]);

  // the same state with the alias missing from the moved file converges to the alias at the NEW path
  const stripped = entityText({ id: 'BR-0002', status: 'permanent', name: 'Beta' });
  await repo.write(G, stripped);
  const healed = await promote(E, dir);
  assert.deepEqual([healed.promoted, healed.renumbered, healed.diagnostics], [[], [], []]);
  assert.deepEqual(healed.entities_rewritten, [G]);
  assert.equal(await registryBytes(dir), registryBefore);
  assertProjection(await repo.read(G), stripped, { id: 'BR-0002', id_status: 'permanent', id_alias: ['BR-0001'] });
});

check('F-E14', '(b) still provisional and relocated without a record, then promoted: id_alias kept, new path promoted', async (E) => {
  const ctx = await buildE1(E, 'e14b');
  const { dir, repo } = ctx;
  await promote(E, dir); // renumbering events + projections, not committed yet
  const relocated = br('BR-0002'); // directory renamed to match the new ID
  const text = await repo.read(B);
  assert.deepEqual(YAML.parse(text).id_alias, ['BR-0001'], 'precondition: the renumbered entity carries id_alias');
  assert.equal(YAML.parse(text).id_status, 'provisional');
  await repo.write(relocated, text);
  await repo.remove(B);
  const P2 = await repo.commit('renumbered entity relocated to match its new ID');
  assert.equal(await oracleFirstCanonical(repo, 'main', relocated, 'BR-0002'), P2, 'oracle: first canonical commit at the new path');
  const eventsBefore = await registryEvents(dir);
  const result = await promote(E, dir);
  assert.deepEqual(result.promoted, [{ id: 'BR-0002', path: relocated, commit: P2 }], 'the promote path is the new path');
  assert.deepEqual([result.renumbered, result.diagnostics, result.entities_rewritten], [[], [], [relocated]]);
  assert.deepEqual(await registryEvents(dir), [...eventsBefore, promo('BR-0002', relocated, P2)], 'only the promote event is added');
  assertProjection(await repo.read(relocated), text, { id: 'BR-0002', id_status: 'permanent', id_alias: ['BR-0001'] });
  const frozen = await registryBytes(dir);
  const again = await promote(E, dir);
  assert.deepEqual([again.promoted, again.renumbered, again.entities_rewritten], [[], [], []]);
  assert.equal(await registryBytes(dir), frozen);
});

check('F-E14', '(c) an unrelated holder of the target ID gets no id_alias, even after its own recorded move', async (E) => {
  const C = br('late');
  const D = br('late-moved');
  const events = [
    alloc('BR-0001', A), alloc('BR-0001', B), promo('BR-0001', A, FAKE_SHA.a),
    alloc('BR-0002', B), aliasEv('BR-0001', 'BR-0002', FAKE_SHA.b), // the renumbering of B
    alloc('BR-0002', C), promo('BR-0002', C, FAKE_SHA.c), moveEv('BR-0002', C, D), // another entity's own BR-0002
  ];
  const dir = await seededProject(events, 'e14c');
  await writeEntity(dir, A, { id: 'BR-0001', status: 'permanent', name: 'Alpha' });
  await writeEntity(dir, D, { id: 'BR-0002', status: 'permanent', name: 'Late claimant' });
  const before = await snapshot(dir);
  const result = await E.promoteIds(dir, { canonicalBranch: 'main', history: noopHistory });
  assert.deepEqual([result.promoted, result.renumbered, result.entities_rewritten, result.diagnostics], [[], [], [], []]);
  assert.deepEqual(await snapshot(dir), before, 'D is not given id_alias: [BR-0001] (E-0016 2a, E-0024 3)');
  const holder = await E.resolveId(dir, 'BR-0002');
  assert.deepEqual([holder.status, holder.path], ['live', D]);
});

check('F-E15', 'an alias that renumbers the current holder of a permanent ID is INVALID_REGISTRY (spec l.318, E-0024 2)', async (E) => {
  for (const row of T.permanent_renumber_invalid) {
    const dir = await tmpProject('e15');
    await fs.mkdir(path.join(dir, '.kf'));
    const text = fullRegistry(row.lines);
    await fs.writeFile(path.join(dir, ...REGISTRY_REL.split('/')), text);
    await rejectsWith(E, E.readIdRegistry(dir), 'INVALID_REGISTRY').catch((error) => { error.message = `${row.name}: ${error.message}`; throw error; });
    await rejectsWith(E, E.allocateId(dir, 'BR', br('y')), 'INVALID_REGISTRY');
    assert.equal(await registryBytes(dir), text, `${row.name}: file unchanged`);
  }
  for (const row of T.permanent_renumber_valid) {
    const dir = await tmpProject('e15v');
    await fs.mkdir(path.join(dir, '.kf'));
    const text = fullRegistry(row.lines);
    await fs.writeFile(path.join(dir, ...REGISTRY_REL.split('/')), text);
    const registry = await E.readIdRegistry(dir).catch((error) => { error.message = `${row.name}: ${error.message}`; throw error; });
    assert.deepEqual(registry.events, parseRegistryText(text).events, `${row.name}: events read as written`);
  }
});

check('F-E16', 'persisted alias.commit is the loser entering commit, not the tip or the winner commit (injected history)', async (E) => {
  const sha = (n) => `${'b'.repeat(39)}${n}`;
  const dir = await seededProject([alloc('BR-0001', A), alloc('BR-0001', B)], 'e16a');
  await writeEntity(dir, A, { id: 'BR-0001', name: 'Alpha' });
  await writeEntity(dir, B, { id: 'BR-0001', name: 'Beta' });
  const presence = { [A]: [sha(3), sha(4)], [B]: [sha(2), sha(3), sha(4)] };
  const history = {
    firstParentCommits: async () => [1, 2, 3, 4].map(sha),
    readFile: async (commit, p) => (presence[p]?.includes(commit) ? entityText({ id: 'BR-0001', name: p }) : null),
  };
  const eventsBefore = await registryEvents(dir);
  await E.promoteIds(dir, { canonicalBranch: 'main', history });
  assert.deepEqual(await registryEvents(dir), [...eventsBefore,
    promo('BR-0001', B, sha(2)), alloc('BR-0002', A), aliasEv('BR-0001', 'BR-0002', sha(3))],
  'alias.commit = the loser first-parent entry (index 2 of 0..3), not the tip (sha 4) and not the winner (sha 2)');
  assert.deepEqual((await E.readIdRegistry(dir)).events.at(-1), aliasEv('BR-0001', 'BR-0002', sha(3)));
});

check('F-E16', 'persisted alias.commit with real Git when canonical history continues past the loser', async (E) => {
  const ctx = await buildE1(E, 'e16b');
  const { dir, repo, M1, M2 } = ctx;
  await repo.write('notes/later.txt', 'later\n');
  const tip = await repo.commit('later canonical commit');
  assert.ok(new Set([M1, M2, tip]).size === 3, 'precondition: winner, loser and tip are three different commits');
  const eventsBefore = await registryEvents(dir);
  await promote(E, dir);
  assert.deepEqual(await registryEvents(dir), [...eventsBefore,
    promo('BR-0001', A, M1), alloc('BR-0002', B), aliasEv('BR-0001', 'BR-0002', M2)]);
});

check('F-E17', 'cross-ID order: promotes by ID, then each loser by ID (allocate, alias); path order is the opposite', async (E) => {
  const ctx = await buildE17('e17');
  const { dir, paths, M } = ctx;
  assert.ok(Buffer.compare(Buffer.from(paths.d1), Buffer.from(paths.b1)) < 0, 'precondition: DE paths sort before BR paths');
  const eventsBefore = await registryEvents(dir);
  const result = await promote(E, dir);
  assert.deepEqual(result.promoted, [
    { id: 'BR-0001', path: paths.b1, commit: M },
    { id: 'DE-0001', path: paths.d1, commit: M },
  ]);
  assert.deepEqual(result.renumbered, [
    { from: 'BR-0001', to: 'BR-0002', path: paths.b2, commit: M },
    { from: 'DE-0001', to: 'DE-0002', path: paths.d2, commit: M },
  ]);
  assert.deepEqual(result.entities_rewritten, sortBytes(Object.values(paths)));
  assert.deepEqual(await registryEvents(dir), [...eventsBefore,
    promo('BR-0001', paths.b1, M), promo('DE-0001', paths.d1, M),
    alloc('BR-0002', paths.b2), aliasEv('BR-0001', 'BR-0002', M),
    alloc('DE-0002', paths.d2), aliasEv('DE-0001', 'DE-0002', M)], 'E-0015 D-02(c), E-0023 (1a)');
  assert.equal(dePath('d1'), paths.d1);
  assertProjection(await ctx.repo.read(paths.b1), ctx.orig.b1, { id: 'BR-0001', id_status: 'permanent', id_alias: null });
  assertProjection(await ctx.repo.read(paths.b2), ctx.orig.b2, { id: 'BR-0002', id_status: 'provisional', id_alias: ['BR-0001'] });
  assertProjection(await ctx.repo.read(paths.d1), ctx.orig.d1, { id: 'DE-0001', id_status: 'permanent', id_alias: null });
  assertProjection(await ctx.repo.read(paths.d2), ctx.orig.d2, { id: 'DE-0002', id_status: 'provisional', id_alias: ['DE-0001'] });
});

check('F-E18', 'an entity whose only drift is a missing id_alias is rewritten, then converged', async (E) => {
  const dir = await seededProject([alloc('BR-0001', A), alloc('BR-0002', B), aliasEv('BR-0001', 'BR-0002', FAKE_SHA.a)], 'e18');
  const drifted = entityText({ id: 'BR-0002', name: 'Beta' }); // BR-0002, provisional, no id_alias
  await writeEntity(dir, B, { id: 'BR-0002', name: 'Beta' });
  const registryBefore = await registryBytes(dir);
  const result = await E.promoteIds(dir, { canonicalBranch: 'main', history: noopHistory });
  assert.deepEqual([result.promoted, result.renumbered, result.diagnostics], [[], [], []]);
  assert.deepEqual(result.entities_rewritten, [B]);
  assert.equal(await registryBytes(dir), registryBefore, 'convergence writes no event');
  assertProjection(await readEntity(dir, B), drifted, { id: 'BR-0002', id_status: 'provisional', id_alias: ['BR-0001'] });
  const converged = await readEntity(dir, B);
  const again = await E.promoteIds(dir, { canonicalBranch: 'main', history: noopHistory });
  assert.deepEqual([again.promoted, again.renumbered, again.entities_rewritten], [[], [], []]);
  assert.equal(await readEntity(dir, B), converged);
});

check('F-E19', 'unregistered is sorted by id first, then by path', async (E) => {
  const dir = await seededProject([SEED], 'e19');
  await writeEntity(dir, 'changes/CHG-0009.yaml', { id: 'CHG-0009', name: 'change', type: 'change' });
  await writeEntity(dir, br('x'), { id: 'BR-0007', name: 'rule' });
  assert.ok(Buffer.compare(Buffer.from('changes/CHG-0009.yaml'), Buffer.from(br('x'))) < 0, 'precondition: path order is CHG first');
  const report = await E.checkIdCollisions(dir);
  assert.deepEqual(report.unregistered, [
    { id: 'BR-0007', path: br('x') },
    { id: 'CHG-0009', path: 'changes/CHG-0009.yaml' },
  ]);
  assert.deepEqual(report.diagnostics, []);
});

// Audit R02 F05, E-0024 (3): "otherwise the unique file carrying Y whose path equals no path of any allocate Y
// event; otherwise none".
check('F-E20', 'two relocated copies of the renumbered ID: no id_alias until exactly one remains', async (E) => {
  const ctx = await buildE1Promoted(E, 'e20');
  const { dir, repo } = ctx;
  const R1 = br('relocated-1');
  const R2 = br('relocated-2');
  const bare = entityText({ id: 'BR-0002', name: 'Beta' }); // BR-0002, provisional, no id_alias
  assert.deepEqual(YAML.parse(await repo.read(B)).id_alias, ['BR-0001'], 'precondition: B was renumbered by the promotion');
  await repo.remove(B); // the entity left its anchor path ...
  await repo.write(R1, bare); // ... and exists twice, at paths that equal no allocate BR-0002 path (uncommitted)
  await repo.write(R2, bare);
  const eventsBefore = await registryEvents(dir);
  assert.ok(!eventsBefore.some((e) => e.op === 'allocate' && e.id === 'BR-0002' && [R1, R2].includes(e.path)));
  const report = await E.checkIdCollisions(dir);
  assert.deepEqual(report.provisional_collisions, [{ id: 'BR-0002', paths: [R1, R2] }], 'precondition: two holders');
  const before = await snapshot(dir);
  const none = await promote(E, dir);
  assert.equal(none.skipped, undefined, 'main is checked out at its tip');
  assert.deepEqual([none.promoted, none.renumbered, none.entities_rewritten, none.diagnostics], [[], [], [], []],
    'no unique relocated holder: neither copy gets id_alias, nothing is promoted');
  assert.deepEqual(await snapshot(dir), before, 'no event written, no file rewritten');
  assert.equal(await repo.read(R1), bare);
  assert.equal(await repo.read(R2), bare);

  // one copy is deleted and the rest is committed: the unique survivor is the renumbered entity
  await repo.remove(R2);
  const P2 = await repo.commit('survivor committed');
  assert.equal(await oracleFirstCanonical(repo, 'main', R1, 'BR-0002'), P2);
  const done = await promote(E, dir);
  assert.equal(done.skipped, undefined);
  assert.deepEqual(done.promoted, [{ id: 'BR-0002', path: R1, commit: P2 }]);
  assert.deepEqual([done.renumbered, done.diagnostics, done.entities_rewritten], [[], [], [R1]]);
  assert.deepEqual(await registryEvents(dir), [...eventsBefore, promo('BR-0002', R1, P2)]);
  assertProjection(await repo.read(R1), bare, { id: 'BR-0002', id_status: 'permanent', id_alias: ['BR-0001'] });
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
