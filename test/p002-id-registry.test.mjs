import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { allocateId, initializeIdRegistry, readIdRegistry } from '../framework/engine/id-registry.mjs';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function withProject(run, initialize = true) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'knowflux-p002-'));
  try {
    if (initialize) await initializeIdRegistry(directory);
    return await run(directory);
  }
  finally { await rm(directory, { recursive: true, force: true }); }
}

async function git(directory, ...args) {
  return exec('git', ['-C', directory, ...args]);
}

async function writeEntity(directory, id, status, suffix = '') {
  const relative = `knowledge/business-rules/${id}${suffix}/rule.yaml`;
  const file = path.join(directory, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, YAML.stringify({ schema_version: 2.1, id, id_status: status }));
  return relative;
}

test('§55 P002 conformance slice: engine allocates provisional IDs per prefix', async () => {
  const fixture = YAML.parse(await readFile(path.join(root, 'framework/conformance/p002-id-registry.yaml'), 'utf8'));
  assert.equal(fixture.schema_version, 2.1);
  await withProject(async (directory) => {
    for (const item of fixture.cases) {
      assert.deepEqual(await allocateId(directory, item.prefix), item.expected, item.name);
    }
    assert.deepEqual((await readIdRegistry(directory)).events.map((event) => event.id),
      fixture.cases.map((item) => item.expected.id));
  });
});

test('§8: allocation is serialized, per-prefix, never reuses, and expands after 9999', async () => {
  await withProject(async (directory) => {
    const allocations = await Promise.all(Array.from({ length: 24 }, () => allocateId(directory, 'BR')));
    const ids = allocations.map((item) => item.id);
    assert.equal(new Set(ids).size, 24);
    assert.deepEqual(ids.slice().sort(), Array.from({ length: 24 }, (_, index) =>
      `BR-${String(index + 1).padStart(4, '0')}`));
    assert.deepEqual(await allocateId(directory, 'DE'), { id: 'DE-0001', id_status: 'provisional' });
    const registryPath = path.join(directory, '.kf/id-registry.yaml');
    const registry = await readIdRegistry(directory);
    registry.events.push({ op: 'allocate', id: 'BR-9999', id_status: 'provisional' });
    await writeFile(registryPath, YAML.stringify(registry));
    assert.deepEqual(await allocateId(directory, 'BR'), { id: 'BR-10000', id_status: 'provisional' });
    assert.deepEqual(await allocateId(directory, 'BR'), { id: 'BR-10001', id_status: 'provisional' });
    assert.equal((await readIdRegistry(directory)).events.length, 28);
  });
});

test('§8.2: allocation on a noncanonical branch remains provisional', async () => {
  await withProject(async (directory) => {
    await git(directory, 'init', '-q', '-b', 'main');
    await git(directory, 'config', 'user.name', 'KnowFlux Test');
    await git(directory, 'config', 'user.email', 'test@example.invalid');
    await writeFile(path.join(directory, 'README.md'), 'base\n');
    await git(directory, 'add', '.');
    await git(directory, 'commit', '-qm', 'Base');
    await git(directory, 'checkout', '-qb', 'feature');
    const allocation = await allocateId(directory, 'BR');
    assert.equal(allocation.id_status, 'provisional');
    await writeEntity(directory, allocation.id, allocation.id_status);
    assert.equal((await readIdRegistry(directory)).events[0].id_status, 'provisional');
  });
});

test('§8: missing or corrupt registry cannot reissue an existing ID', async () => {
  await withProject(async (directory) => {
    await writeEntity(directory, 'BR-0001', 'provisional');
    await assert.rejects(initializeIdRegistry(directory), { code: 'EXISTING_ENTITIES' });
    await assert.rejects(allocateId(directory, 'BR'), { code: 'REGISTRY_MISSING' });
  }, false);
  await withProject(async (directory) => {
    await allocateId(directory, 'BR');
    await writeFile(path.join(directory, '.kf/id-registry.yaml'), 'events: [invalid\n');
    await assert.rejects(allocateId(directory, 'BR'), { code: 'INVALID_YAML' });
  });
  await withProject(async (directory) => {
    await allocateId(directory, 'BR');
    await unlink(path.join(directory, '.kf/id-registry.yaml'));
    await assert.rejects(allocateId(directory, 'BR'), { code: 'REGISTRY_MISSING' });
    await assert.rejects(initializeIdRegistry(directory), { code: 'REGISTRY_EXISTS' });
  });
});

test('§8: duplicate provisional IDs fail closed without consuming a new ID', async () => {
  await withProject(async (directory) => {
    await allocateId(directory, 'BR');
    await writeEntity(directory, 'BR-0001', 'provisional');
    await writeEntity(directory, 'BR-0001', 'provisional', '-other');
    await assert.rejects(allocateId(directory, 'BR'), { code: 'UNRESOLVED_COLLISION' });
    assert.equal((await readIdRegistry(directory)).events.length, 1);
  });
});

test('§§8.2, 42.2: any permanent collision yields KF-E-101', async () => {
  await withProject(async (directory) => {
    await allocateId(directory, 'BR');
    await writeEntity(directory, 'BR-0001', 'permanent');
    await writeEntity(directory, 'BR-0001', 'provisional', '-other');
    await assert.rejects(allocateId(directory, 'BR'), { code: 'KF-E-101' });
    assert.equal((await readIdRegistry(directory)).events.length, 1);
  });
  await withProject(async (directory) => {
    await allocateId(directory, 'BR');
    const registryPath = path.join(directory, '.kf/id-registry.yaml');
    const registry = await readIdRegistry(directory);
    registry.events.push({ op: 'promote', id: 'BR-0001' });
    await writeFile(registryPath, YAML.stringify(registry));
    await writeEntity(directory, 'BR-0001', 'provisional');
    await writeEntity(directory, 'BR-0001', 'provisional', '-other');
    await assert.rejects(allocateId(directory, 'BR'), { code: 'KF-E-101' });
  });
});

test('§8.1: an existing lock blocks allocation without changing the registry', async () => {
  await withProject(async (directory) => {
    await allocateId(directory, 'BR');
    const before = await readFile(path.join(directory, '.kf/id-registry.yaml'), 'utf8');
    await mkdir(path.join(directory, '.kf/id-registry.lock'));
    await assert.rejects(allocateId(directory, 'BR'), { code: 'LOCK_TIMEOUT' });
    assert.equal(await readFile(path.join(directory, '.kf/id-registry.yaml'), 'utf8'), before);
  });
});
