import { randomUUID } from 'node:crypto';
import { access, mkdir, open, readFile, readdir, rename, rmdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import YAML from 'yaml';

const prefixes = new Set(['CAP', 'BP', 'BR', 'DE', 'OUT', 'SC', 'EV', 'UNK', 'CHG', 'DIV', 'DSP']);
const idPattern = /^(CAP|BP|BR|DE|OUT|SC|EV|UNK|CHG|DIV|DSP)-([0-9]{4,})$/;

export class IdRegistryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'IdRegistryError';
    this.code = code;
  }
}

function parseDocument(source, label) {
  const document = YAML.parseDocument(source, { uniqueKeys: true });
  if (document.errors.length) throw new IdRegistryError('INVALID_YAML', `${label}: ${document.errors[0].message}`);
  return document;
}

function inspectRegistry(value) {
  if (!value || value.schema_version !== 2.1 || !Array.isArray(value.events)) {
    throw new IdRegistryError('INVALID_REGISTRY', 'Expected schema_version: 2.1 and an events array');
  }
  const states = new Map();
  for (const [index, event] of value.events.entries()) {
    if (!event || !idPattern.test(event.id ?? '')) {
      throw new IdRegistryError('INVALID_REGISTRY', `Event ${index} has an invalid ID`);
    }
    if (event.op === 'allocate') {
      if (states.has(event.id) || event.id_status !== 'provisional') {
        throw new IdRegistryError('INVALID_REGISTRY', `Event ${index} repeats or misstates allocation ${event.id}`);
      }
      states.set(event.id, 'provisional');
    } else if (event.op === 'promote') {
      if (states.get(event.id) !== 'provisional') {
        throw new IdRegistryError('INVALID_REGISTRY', `Event ${index} cannot promote ${event.id}`);
      }
      states.set(event.id, 'permanent');
    } else {
      throw new IdRegistryError('INVALID_REGISTRY', `Event ${index} has an invalid operation`);
    }
  }
  return states;
}

async function entityFiles(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const groups = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return entityFiles(target);
    return entry.isFile() && /\.ya?ml$/i.test(entry.name) ? [target] : [];
  }));
  return groups.flat().sort();
}

async function records(projectRoot) {
  const files = (await Promise.all(['knowledge', 'changes', 'divergences']
    .map((name) => entityFiles(path.join(projectRoot, name))))).flat().sort();
  const found = [];
  for (const file of files) {
    const value = parseDocument(await readFile(file, 'utf8'), file).toJS();
    if (value?.id !== undefined) found.push({ file, id: value.id, id_status: value.id_status });
  }
  return found;
}

async function loadRegistry(projectRoot) {
  const file = path.join(projectRoot, '.kf', 'id-registry.yaml');
  let source;
  try { source = await readFile(file, 'utf8'); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    throw new IdRegistryError('REGISTRY_MISSING', 'ID registry is missing; refusing to reissue IDs');
  }
  const value = parseDocument(source, file).toJS();
  inspectRegistry(value);
  return value;
}

async function writeAtomic(file, source) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(temporary, 'wx');
    await handle.writeFile(source, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, file);
  } finally {
    if (handle) await handle.close();
    await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
}

async function withRegistryLock(projectRoot, operation) {
  const dir = path.join(projectRoot, '.kf');
  const lock = path.join(dir, 'id-registry.lock');
  const deadline = Date.now() + 5000;
  for (;;) {
    try { await mkdir(lock); break; }
    catch (error) {
      if (error.code === 'ENOENT') throw new IdRegistryError('REGISTRY_MISSING', 'ID registry is not initialized');
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) throw new IdRegistryError('LOCK_TIMEOUT', 'ID registry remains locked');
      await pause(20);
    }
  }
  try { return await operation(); }
  finally { await rmdir(lock); }
}

async function saveRegistry(projectRoot, value) {
  inspectRegistry(value);
  await writeAtomic(path.join(projectRoot, '.kf', 'id-registry.yaml'), YAML.stringify(value));
}

export async function readIdRegistry(projectRoot) {
  return loadRegistry(path.resolve(projectRoot));
}

export async function initializeIdRegistry(projectRoot) {
  const root = path.resolve(projectRoot);
  const directory = path.join(root, '.kf');
  try {
    await access(directory);
    throw new IdRegistryError('REGISTRY_EXISTS', 'Operational state already exists; refusing to reset ID history');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if ((await records(root)).length) {
    throw new IdRegistryError('EXISTING_ENTITIES', 'Cannot initialize an empty registry over existing entities');
  }
  try { await mkdir(directory); }
  catch (error) {
    if (error.code === 'EEXIST') throw new IdRegistryError('REGISTRY_EXISTS', 'Operational state already exists');
    throw error;
  }
  return withRegistryLock(root, async () => {
    await saveRegistry(root, { schema_version: 2.1, events: [] });
    return { schema_version: 2.1, events: [] };
  });
}

export async function allocateId(projectRoot, prefix) {
  if (!prefixes.has(prefix)) throw new IdRegistryError('INVALID_PREFIX', `Unknown core ID prefix: ${prefix}`);
  const root = path.resolve(projectRoot);
  return withRegistryLock(root, async () => {
    const registry = await loadRegistry(root);
    const states = inspectRegistry(registry);
    const used = await records(root);
    for (const record of used) collisionFor(record, used, states);
    for (const record of used) {
      if (!states.has(record.id)) {
        throw new IdRegistryError('UNREGISTERED_ID', `${record.id} exists outside the registry`);
      }
    }
    let maximum = 0n;
    for (const id of states.keys()) {
      const match = idPattern.exec(id);
      if (match[1] === prefix) {
        const sequence = BigInt(match[2]);
        if (sequence > maximum) maximum = sequence;
      }
    }
    const id = `${prefix}-${(maximum + 1n).toString().padStart(4, '0')}`;
    registry.events.push({ op: 'allocate', id, id_status: 'provisional' });
    await saveRegistry(root, registry);
    return { id, id_status: 'provisional' };
  });
}

function collisionFor(record, all, states) {
  const collisions = all.filter((other) => other.id === record.id);
  if (collisions.length <= 1) return;
  if (states.get(record.id) === 'permanent' || collisions.some((other) => other.id_status === 'permanent')) {
    throw new IdRegistryError('KF-E-101', `ID ${record.id} collides with a permanent ID; manual resolution required`);
  }
  throw new IdRegistryError('UNRESOLVED_COLLISION', `ID ${record.id} collides between provisional entities`);
}
