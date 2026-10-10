// ID registry (spec section 8; errata E-0001..E-0004, E-0007, E-0009..E-0016): engine API only, no CLI (E-0014).
//
// The registry `.kf/id-registry.yaml` is the sole allocator and is authoritative (E-0011, E-0012): entity files
// are a projection of it. Nothing here reads the wall clock or a random source to decide an ID, an event or an
// event order; lock `acquired_at` values and temporary file names are operational only.
import { mkdir, readFile, rmdir, stat } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import {
  CORE_ID_PREFIXES, COMMIT_PATTERN, HEADER, ID_PATTERN, REGISTRY_DIR, REGISTRY_FILE,
  aliasProjection, appendedRegistryText, buildModel, compareBytes, effectiveId, isValidRepoPath, nextNumberedId,
  parseRegistryText,
} from './id-registry-codec.mjs';
import { projectEntityText, sameIdentity, scanEntities } from './id-registry-entities.mjs';
import { IdRegistryError } from './id-registry-errors.mjs';
import { createGitHistoryReader } from './id-registry-git.mjs';
import { atomicWrite, withRegistryLock } from './id-registry-lock.mjs';

export { CORE_ID_PREFIXES, IdRegistryError, createGitHistoryReader };

// KF-E-101 is declared once from spec l.1742 until the diagnostics catalog module exists (TRIAGE N-06).
const KF_E_101 = Object.freeze({ code: 'KF-E-101', severity: 'E', remediation: 'resolución manual' });

const registryFile = (root) => path.join(root, REGISTRY_DIR, REGISTRY_FILE);

function missing() {
  return new IdRegistryError('REGISTRY_MISSING', 'ID registry .kf/id-registry.yaml is missing; it is never recreated from an entity scan');
}

async function assertRegistryExists(root) {
  try {
    await stat(registryFile(root));
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') throw missing();
    throw error;
  }
}

async function loadRegistry(root) {
  let text;
  try {
    text = await readFile(registryFile(root), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') throw missing();
    throw error;
  }
  return { text, ...parseRegistryText(text) };
}

function assertRegistered(model, entities) {
  const unregistered = entities.filter((entity) => !model.seen.has(entity.id)).map((entity) => ({ id: entity.id, path: entity.path }));
  if (unregistered.length > 0) {
    const first = unregistered[0];
    throw new IdRegistryError('UNREGISTERED_ID', `${first.id} (${first.path}) is carried by an entity but recorded in no registry event`, { unregistered });
  }
}

/** Append `added` to the registry in one atomic write (events are only ever appended, E-0012 / spec l.371). */
async function appendEvents(root, loaded, added, rename, lockContext) {
  const events = [...loaded.registry.events, ...added];
  buildModel(events); // replay validation before anything is written
  const text = appendedRegistryText(loaded.text, loaded.registry.events, added);
  parseRegistryText(text); // what is about to be written must read back as valid
  await atomicWrite(registryFile(root), text, { rename, ...lockContext });
}

const byId = (a, b) => compareBytes(a.id, b.id) || compareBytes(a.path, b.path);

// ------------------------------------------------------------------ initialization and reading
export async function initializeIdRegistry(projectRoot, options = {}) {
  const root = path.resolve(projectRoot);
  const settings = options ?? {};
  const refuse = async () => {
    try {
      await stat(registryFile(root));
      throw new IdRegistryError('REGISTRY_EXISTS', 'the ID registry already exists; refusing to reset ID history');
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
    }
    if ((await scanEntities(root)).length > 0) {
      throw new IdRegistryError('EXISTING_ENTITIES', 'entity files already carry IDs; refusing to initialize an empty registry over them');
    }
  };
  await refuse();
  const directory = path.join(root, REGISTRY_DIR);
  const created = await mkdir(directory, { recursive: true });
  try {
    await withRegistryLock(root, settings.lock, async (lockContext) => {
      await refuse();
      await atomicWrite(registryFile(root), HEADER, { rename: settings.rename, ...lockContext });
    });
  } catch (error) {
    if (created !== undefined) await rmdir(directory).catch(() => {});
    throw error;
  }
  return { schema_version: 2.1, events: [] };
}

export async function readIdRegistry(projectRoot) {
  const { registry } = await loadRegistry(path.resolve(projectRoot));
  return registry;
}

// ------------------------------------------------------------------ allocation
export async function allocateId(projectRoot, prefix, entityPath, options = {}) {
  if (typeof prefix !== 'string' || !CORE_ID_PREFIXES.includes(prefix)) {
    throw new IdRegistryError('INVALID_PREFIX', `not a core ID prefix: ${JSON.stringify(prefix)}`);
  }
  if (!isValidRepoPath(entityPath)) {
    throw new IdRegistryError('INVALID_PATH', `not a repo-relative POSIX path: ${JSON.stringify(entityPath)}`);
  }
  const root = path.resolve(projectRoot);
  const settings = options ?? {};
  await assertRegistryExists(root);
  return withRegistryLock(root, settings.lock, async (lockContext) => {
    const loaded = await loadRegistry(root);
    assertRegistered(loaded.model, await scanEntities(root)); // an unregistered ID could be reissued by the counter (l.300)
    const id = nextNumberedId(prefix, new Map(loaded.model.max));
    await appendEvents(root, loaded, [{ op: 'allocate', id, id_status: 'provisional', path: entityPath }], settings.rename, lockContext);
    return { id, id_status: 'provisional', path: entityPath };
  });
}

// ------------------------------------------------------------------ shared classification
function holdersOf(model, items, id) {
  const holders = items.filter((item) => item.eff === id);
  if (!model.promotes.has(id)) return holders;
  return holders.filter((item) => item.path === model.holder.get(id));
}

function offenderDiagnostics(model, items) {
  const found = [];
  for (const item of items) {
    const id = item.eff;
    if (!model.promotes.has(id)) continue;
    const holderPath = model.holder.get(id);
    if (item.path === holderPath) continue;
    found.push({
      ...KF_E_101,
      message: `${id} is permanent at ${holderPath}; ${item.path} carries the same ID (manual resolution required)`,
      id,
      path: item.path,
      permanent_path: holderPath,
    });
  }
  return found.sort(byId);
}

function registeredItems(model, entities) {
  return entities.filter((entity) => model.seen.has(entity.id))
    .map((entity) => ({ ...entity, eff: effectiveId(model, entity.id, entity.path) }));
}

export async function checkIdCollisions(projectRoot) {
  const root = path.resolve(projectRoot);
  const { model } = await loadRegistry(root);
  const entities = await scanEntities(root);
  const items = registeredItems(model, entities);
  const groups = new Map();
  for (const item of items) {
    if (model.promotes.has(item.eff)) continue;
    if (!groups.has(item.eff)) groups.set(item.eff, []);
    groups.get(item.eff).push(item.path);
  }
  const provisionalCollisions = [...groups]
    .filter(([, paths]) => paths.length > 1)
    .map(([id, paths]) => ({ id, paths: [...paths].sort(compareBytes) }))
    .sort((a, b) => compareBytes(a.id, b.id));
  const unregistered = entities.filter((entity) => !model.seen.has(entity.id)).map((entity) => ({ id: entity.id, path: entity.path })).sort(byId);
  return { diagnostics: offenderDiagnostics(model, items), provisional_collisions: provisionalCollisions, unregistered };
}

// ------------------------------------------------------------------ resolution
export async function resolveId(projectRoot, address) {
  if (typeof address !== 'string' || !ID_PATTERN.test(address)) {
    throw new IdRegistryError('INVALID_ID', `not a bare entity ID: ${JSON.stringify(address)}`);
  }
  const root = path.resolve(projectRoot);
  const { model } = await loadRegistry(root);
  const items = registeredItems(model, await scanEntities(root));
  const result = (status, extra) => ({
    input: address, status, registered: model.seen.has(address), id: null, path: null, via: [], warnings: [], ...extra,
  });
  const live = holdersOf(model, items, address);
  if (live.length === 1) {
    const targets = [...new Set((model.aliasesFrom.get(address) ?? []).map((alias) => alias.to))].sort(compareBytes);
    return result('live', {
      id: address,
      path: live[0].path,
      via: [address],
      warnings: targets.map((to) => ({
        kind: 'shadowed_alias',
        alias_from: address,
        alias_to: to,
        message: `${address} is held by the live entity at ${live[0].path} and is also an alias of ${to}; the live holder is returned`,
      })),
    });
  }
  if (live.length > 1) {
    return result('ambiguous', { candidates: live.map((item) => ({ id: address, path: item.path })).sort(byId) });
  }
  const leaves = [];
  const follow = (from, chain) => {
    const targets = [...new Set((model.aliasesFrom.get(from) ?? []).map((alias) => alias.to))].sort(compareBytes);
    for (const to of targets) {
      const holders = holdersOf(model, items, to);
      if (holders.length > 0) for (const holder of holders) leaves.push({ id: to, path: holder.path, via: [...chain, to] });
      else follow(to, [...chain, to]);
    }
  };
  follow(address, [address]);
  const distinct = new Map(leaves.map((leaf) => [`${leaf.id}\u0000${leaf.path}`, leaf]));
  if (distinct.size === 1) {
    const [leaf] = distinct.values();
    return result('alias', { id: leaf.id, path: leaf.path, via: leaf.via });
  }
  if (distinct.size > 1) {
    return result('ambiguous', { candidates: [...distinct.values()].map(({ id, path: leafPath }) => ({ id, path: leafPath })).sort(byId) });
  }
  return result('unresolved', {});
}

// ------------------------------------------------------------------ promotion
function parseMapping(text) {
  try {
    const document = YAML.parseDocument(text, { uniqueKeys: true });
    if (document.errors.length) return null;
    const value = document.toJS();
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/** E-0009: index and SHA of the first first-parent commit whose file at `repoPath` is a mapping with this `id`. */
async function firstCanonicalCommit(history, commits, repoPath, id) {
  for (const [index, commit] of commits.entries()) {
    const text = await history.readFile(commit, repoPath);
    if (typeof text !== 'string') continue;
    const value = parseMapping(text);
    if (value && value.id === id) return { index, commit };
  }
  return null;
}

export async function promoteIds(projectRoot, options) {
  const branch = options?.canonicalBranch;
  if (typeof branch !== 'string' || branch === '') {
    throw new IdRegistryError('CANONICAL_BRANCH_REQUIRED', 'canonicalBranch must be given explicitly as a non-empty string (E-0001)');
  }
  const root = path.resolve(projectRoot);
  const history = options.history ?? createGitHistoryReader(root);
  await assertRegistryExists(root);
  return withRegistryLock(root, options.lock, async (lockContext) => {
    const loaded = await loadRegistry(root);
    const { model } = loaded;
    const entities = await scanEntities(root);
    assertRegistered(model, entities);
    const commits = await history.firstParentCommits(branch);
    if (!Array.isArray(commits) || commits.some((sha) => typeof sha !== 'string' || !COMMIT_PATTERN.test(sha))) {
      throw new IdRegistryError('GIT_FAILED', 'the history reader returned something other than a list of full lowercase commit SHAs');
    }
    const items = registeredItems(model, entities);
    const actual = items.filter((item) => item.eff === item.id); // pending renumbers are converged, never promoted
    const plan = new Map(items.map((item) => [item.path, item.eff])); // repo path -> ID the file will carry
    const promoteEvents = [];
    const losers = [];
    const skipped = new Set();
    const ids = [...new Set(actual.map((item) => item.id))].sort(compareBytes);
    for (const id of ids) {
      const holders = actual.filter((item) => item.id === id);
      if (model.promotes.has(id)) {
        if (holders.some((item) => item.path !== model.holder.get(id))) {
          // KF-E-101 (E-0010, E-0015 D-03c): nothing is written for this ID and the holder is left untouched
          skipped.add(id);
          for (const item of items) if (item.eff === id) plan.delete(item.path);
        }
        continue;
      }
      const located = [];
      for (const holder of holders) {
        const found = await firstCanonicalCommit(history, commits, holder.path, id);
        if (found) located.push({ item: holder, ...found });
      }
      if (located.length === 0) continue;
      located.sort((a, b) => a.index - b.index || compareBytes(a.item.path, b.item.path)); // E-0009, E-0002
      const [winner, ...rest] = located;
      promoteEvents.push({ op: 'promote', id, path: winner.item.path, commit: winner.commit });
      for (const loser of rest) losers.push({ id, item: loser.item, commit: loser.commit });
    }
    const counters = new Map(model.max);
    const renumberEvents = [];
    const renumbered = [];
    for (const loser of losers) {
      const prefix = loser.id.slice(0, loser.id.indexOf('-'));
      const to = nextNumberedId(prefix, counters);
      renumberEvents.push(
        { op: 'allocate', id: to, id_status: 'provisional', path: loser.item.path },
        { op: 'alias', from: loser.id, to, commit: loser.commit },
      );
      plan.set(loser.item.path, to);
      renumbered.push({ from: loser.id, to, path: loser.item.path, commit: loser.commit });
    }
    const added = [...promoteEvents, ...renumberEvents];
    const post = added.length > 0 ? buildModel([...model.events, ...added]) : model;

    const rewrites = [];
    for (const item of items) {
      const finalId = plan.get(item.path);
      if (finalId === undefined) continue;
      const promotedNow = post.promotes.has(finalId);
      const holder = promotedNow && post.holder.get(finalId) === item.path;
      if (promotedNow && !holder) continue; // an offender: never rewritten
      const desired = {
        id: finalId,
        id_status: holder ? 'permanent' : 'provisional',
        id_alias: aliasProjection(post, finalId, item.path),
      };
      if (sameIdentity(item, desired)) continue;
      const text = projectEntityText(item.text, desired);
      if (text !== item.text) rewrites.push({ path: item.path, text });
    }

    if (added.length > 0) await appendEvents(root, loaded, added, options.rename, lockContext);
    for (const rewrite of rewrites) {
      await atomicWrite(path.join(root, ...rewrite.path.split('/')), rewrite.text, { rename: options.rename, ...lockContext });
    }

    const finalItems = items.map((item) => ({ ...item, eff: plan.get(item.path) ?? item.eff }));
    return {
      canonical_branch: branch,
      promoted: promoteEvents.map(({ id, path: eventPath, commit }) => ({ id, path: eventPath, commit })),
      renumbered,
      entities_rewritten: rewrites.map((rewrite) => rewrite.path),
      diagnostics: offenderDiagnostics(post, finalItems),
    };
  });
}
