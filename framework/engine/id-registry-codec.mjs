// Registry file codec and replay model (E-0012, E-0015 D-05). Pure functions: no I/O, no clock, no randomness.
import YAML from 'yaml';
import { IdRegistryError } from './id-registry-errors.mjs';

export const CORE_ID_PREFIXES = Object.freeze(['CAP', 'BP', 'BR', 'DE', 'OUT', 'SC', 'EV', 'UNK', 'CHG', 'DIV', 'DSP']);
export const ID_PATTERN = /^(CAP|BP|BR|DE|OUT|SC|EV|UNK|CHG|DIV|DSP)-([0-9]{4,})$/;
export const COMMIT_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
export const REGISTRY_DIR = '.kf';
export const REGISTRY_FILE = 'id-registry.yaml';
export const HEADER = 'schema_version: 2.1\nevents:\n';

const KEY_ORDER = {
  allocate: ['op', 'id', 'id_status', 'path'],
  promote: ['op', 'id', 'path', 'commit'],
  alias: ['op', 'from', 'to', 'commit'],
  move: ['op', 'id', 'from', 'to'],
};

/** Ascending order of UTF-8 bytes (E-0002); never locale- or UTF-16-dependent. */
export function compareBytes(a, b) {
  return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/** True when the string holds a character in U+0000..U+001F or U+007F. */
export function hasControlCharacter(value) {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/** Repo-relative POSIX path rule of the PLAN "Public engine API contract". */
export function isValidRepoPath(value) {
  if (typeof value !== 'string' || value === '') return false;
  if (typeof value.isWellFormed === 'function' && !value.isWellFormed()) return false;
  if (value.startsWith('/') || value.includes('\\')) return false;
  if (hasControlCharacter(value)) return false;
  if (/^[A-Za-z]:/.test(value)) return false;
  return value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

export function nextNumberedId(prefix, counters) {
  const next = (counters.get(prefix) ?? 0n) + 1n;
  counters.set(prefix, next);
  return `${prefix}-${next.toString().padStart(4, '0')}`;
}

// ------------------------------------------------------------------ serialization (one physical line per event)
const PLAIN_SCALAR = /^[A-Za-z][A-Za-z0-9_./-]*$/;
// NEL, LINE SEPARATOR, PARAGRAPH SEPARATOR (built from code points so the source holds no raw separators)
const LINE_SEPARATORS = new RegExp(`[${String.fromCharCode(0x85, 0x2028, 0x2029)}]`, 'g');
const RESERVED_SCALAR =/^(?:null|true|false|yes|no|on|off|y|n)$/i;

function scalar(value) {
  if (PLAIN_SCALAR.test(value) && !RESERVED_SCALAR.test(value)) return value;
  // A JSON string is a YAML double-quoted scalar; U+0085/U+2028/U+2029 are escaped so no parser sees a line break.
  return JSON.stringify(value).replace(LINE_SEPARATORS, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export function eventLine(event) {
  return `  - {${KEY_ORDER[event.op].map((key) => `${key}: ${scalar(event[key])}`).join(', ')}}`;
}

export function canonicalRegistryText(events) {
  return HEADER + events.map((event) => `${eventLine(event)}\n`).join('');
}

/**
 * Text of the registry after appending `added` to a registry whose current text is `oldText` and whose events
 * are `oldEvents`. Events are only appended: the byte prefix is kept (CRLF is normalized to LF). The list header is
 * rewritten only when the list goes from empty to non-empty. If the append would not parse back to exactly the
 * expected events (hand-written registry in an unusual layout), the whole file is re-rendered canonically.
 */
export function appendedRegistryText(oldText, oldEvents, added) {
  const lines = added.map((event) => `${eventLine(event)}\n`).join('');
  if (oldEvents.length === 0) return HEADER + lines;
  let base = oldText.replace(/\r\n/g, '\n');
  if (!base.endsWith('\n')) base += '\n';
  const candidate = base + lines;
  try {
    const reread = parseRegistryText(candidate).registry.events;
    if (sameEvents(reread, [...oldEvents, ...added])) return candidate;
  } catch {
    // fall through to the canonical rendering
  }
  return canonicalRegistryText([...oldEvents, ...added]);
}

function sameEvents(a, b) {
  return a.length === b.length && a.every((event, i) => KEY_ORDER[event.op].every((key) => event[key] === b[i][key]));
}

// ------------------------------------------------------------------ parsing and validation
function invalid(message) {
  return new IdRegistryError('INVALID_REGISTRY', message);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateEvent(raw, index) {
  if (!isPlainObject(raw)) throw invalid(`event ${index} is not a mapping`);
  const op = raw.op;
  if (typeof op !== 'string' || !Object.hasOwn(KEY_ORDER, op)) throw invalid(`event ${index} has an unknown op`);
  const keys = KEY_ORDER[op];
  const present = Object.keys(raw).sort();
  if (present.length !== keys.length || [...keys].sort().some((key, i) => key !== present[i])) {
    throw invalid(`event ${index} (${op}) must have exactly the keys ${keys.join(', ')}`);
  }
  for (const key of keys) {
    if (typeof raw[key] !== 'string') throw invalid(`event ${index}: ${key} must be a string`);
  }
  const event = Object.fromEntries(keys.map((key) => [key, raw[key]]));
  for (const key of op === 'alias' ? ['from', 'to'] : ['id']) {
    if (!ID_PATTERN.test(event[key])) throw invalid(`event ${index}: ${key} is not a valid core ID`);
  }
  if (op === 'allocate' && event.id_status !== 'provisional') throw invalid(`event ${index}: allocate must be provisional`);
  if ((op === 'promote' || op === 'alias') && !COMMIT_PATTERN.test(event.commit)) {
    throw invalid(`event ${index}: commit must be a full lowercase hexadecimal SHA`);
  }
  for (const key of op === 'alias' ? [] : ['path', 'from', 'to']) {
    if (key in event && !isValidRepoPath(event[key])) throw invalid(`event ${index}: ${key} is not a valid repo path`);
  }
  if (op === 'alias' && event.from === event.to) throw invalid(`event ${index}: alias from equals to`);
  return event;
}

/** Parse and fully validate registry text. Rejects INVALID_YAML or INVALID_REGISTRY. */
export function parseRegistryText(text) {
  let value;
  try {
    const document = YAML.parseDocument(text, { uniqueKeys: true });
    if (document.errors.length) throw new IdRegistryError('INVALID_YAML', `registry is not valid YAML: ${document.errors[0].message}`);
    value = document.toJS();
  } catch (error) {
    if (error instanceof IdRegistryError) throw error;
    throw new IdRegistryError('INVALID_YAML', `registry is not valid YAML: ${error.message}`);
  }
  if (!isPlainObject(value)) throw invalid('registry must be a mapping with schema_version and events');
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== 'events' || keys[1] !== 'schema_version') {
    throw invalid('registry must have exactly the keys schema_version and events');
  }
  if (value.schema_version !== 2.1) throw invalid('schema_version must be 2.1');
  const list = value.events === null ? [] : value.events;
  if (!Array.isArray(list)) throw invalid('events must be a list');
  const events = list.map(validateEvent);
  const registry = { schema_version: 2.1, events };
  return { registry, model: buildModel(events) };
}

/**
 * Replay model (order-tolerant where a union merge can reorder lines, E-0012). Throws INVALID_REGISTRY.
 * Exact repeats of a `promote`, `alias` or `move` event are no-ops (E-0024 (1)); every non-identical conflict is invalid.
 */
export function buildModel(events) {
  const allocates = new Map(); // id -> [{index, path}]
  const allocatePaths = new Map(); // id -> Set(path)
  const seen = new Set();
  const promotes = new Map(); // id -> {path, commit, index}
  const max = new Map(); // prefix -> bigint
  const touch = (id) => {
    seen.add(id);
    const [, prefix, digits] = ID_PATTERN.exec(id);
    const number = BigInt(digits);
    if (number > (max.get(prefix) ?? 0n)) max.set(prefix, number);
  };
  for (const [index, event] of events.entries()) {
    for (const key of event.op === 'alias' ? ['from', 'to'] : ['id']) if (key in event) touch(event[key]);
    if (event.op === 'allocate') {
      if (!allocates.has(event.id)) {
        allocates.set(event.id, []);
        allocatePaths.set(event.id, new Set());
      }
      allocates.get(event.id).push({ index, path: event.path });
      allocatePaths.get(event.id).add(event.path);
    } else if (event.op === 'promote') {
      const earlier = promotes.get(event.id);
      if (earlier === undefined) promotes.set(event.id, { path: event.path, commit: event.commit, index });
      else if (earlier.path !== event.path || earlier.commit !== event.commit) {
        throw invalid(`event ${index}: ${event.id} is promoted twice with different content`);
      }
    }
  }
  for (const [index, event] of events.entries()) {
    if (event.op === 'promote' && !allocates.has(event.id)) throw invalid(`event ${index}: promote of unallocated ${event.id}`);
    if (event.op === 'alias') {
      for (const id of [event.from, event.to]) {
        if (!allocates.has(id)) throw invalid(`event ${index}: alias refers to unallocated ${id}`);
      }
    }
  }
  const holder = new Map([...promotes].map(([id, record]) => [id, record.path]));
  const movesSeen = new Set();
  const moveLog = new Map(); // id -> [{index, to}] applied moves in replay order (E-0034 judges aliases at their position)
  for (const [index, event] of events.entries()) {
    if (event.op !== 'move') continue;
    if (!holder.has(event.id)) throw invalid(`event ${index}: move of ${event.id}, which has no promote`);
    const key = `${event.id}\u0000${event.from}\u0000${event.to}`;
    if (holder.get(event.id) === event.from) {
      holder.set(event.id, event.to);
      if (!moveLog.has(event.id)) moveLog.set(event.id, []);
      moveLog.get(event.id).push({ index, to: event.to });
    } else if (!movesSeen.has(key)) {
      throw invalid(`event ${index}: move.from is not the current path of ${event.id}`);
    }
    movesSeen.add(key);
  }
  const aliases = [];
  const aliasesFrom = new Map();
  const aliasesTo = new Map();
  const aliasCommit = new Map(); // from NUL to -> commit
  const aliasAnchorTarget = new Map(); // from NUL anchor -> to
  for (const [index, event] of events.entries()) {
    if (event.op !== 'alias') continue;
    const pair = `${event.from}\u0000${event.to}`;
    if (aliasCommit.has(pair)) {
      if (aliasCommit.get(pair) !== event.commit) throw invalid(`event ${index}: alias ${event.from} -> ${event.to} repeated with a different commit`);
      continue; // exact repeat (E-0024 (1))
    }
    aliasCommit.set(pair, event.commit);
    // The renumbered entity is the file at the path of the nearest allocate of `to` that precedes the alias line
    // (D-02c writes them adjacently; a union merge keeps each side's relative order; E-0028 (1)).
    const before = allocates.get(event.to).filter((a) => a.index < index).at(-1);
    if (before === undefined) throw invalid(`event ${index}: alias ${event.from} -> ${event.to} has no preceding allocate of ${event.to}`);
    const anchorKey = `${event.from}\u0000${before.path}`;
    if (aliasAnchorTarget.has(anchorKey) && aliasAnchorTarget.get(anchorKey) !== event.to) {
      throw invalid(`event ${index}: ${event.from} is renumbered twice at ${before.path}`);
    }
    aliasAnchorTarget.set(anchorKey, event.to);
    const alias = { index, from: event.from, to: event.to, commit: event.commit, rpath: before.path };
    aliases.push(alias);
    if (!aliasesFrom.has(alias.from)) aliasesFrom.set(alias.from, []);
    if (!aliasesTo.has(alias.to)) aliasesTo.set(alias.to, []);
    aliasesFrom.get(alias.from).push(alias);
    aliasesTo.get(alias.to).push(alias);
  }
  // l.318 / E-0024 (2) as amended by E-0034 and E-0035 (1): a permanent ID is never renumbered. Judged at the alias's
  // replay position: invalid iff `from` already has a promote and its holder path there (promote path followed through
  // the moves before the alias) is the anchor, or a promote of `from` at the anchor path comes later. Later moves into
  // the anchor are legitimate path reuse.
  for (const alias of aliases) {
    const promote = promotes.get(alias.from);
    if (promote === undefined) continue;
    let contradicts;
    if (promote.index > alias.index) {
      contradicts = promote.path === alias.rpath;
    } else {
      let at = promote.path;
      for (const move of moveLog.get(alias.from) ?? []) if (move.index < alias.index) at = move.to;
      contradicts = at === alias.rpath;
    }
    if (contradicts) {
      throw invalid(`event ${alias.index}: alias ${alias.from} -> ${alias.to} renumbers the permanent holder of ${alias.from} at ${alias.rpath}`);
    }
  }
  assertAcyclic(aliasesFrom);
  return { events, allocates, allocatePaths, seen, promotes, holder, aliases, aliasesFrom, aliasesTo, max };
}

function assertAcyclic(aliasesFrom) {
  const state = new Map(); // id -> 1 visiting, 2 done
  const visit = (id) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) throw invalid(`alias cycle through ${id}`);
    state.set(id, 1);
    for (const alias of aliasesFrom.get(id) ?? []) visit(alias.to);
    state.set(id, 2);
  };
  for (const id of aliasesFrom.keys()) visit(id);
}

function connectedIds(model, start, anchor) {
  const ids = new Set([start]);
  for (let grew = true; grew;) {
    grew = false;
    for (const alias of model.aliases) {
      if (alias.rpath !== anchor || ids.has(alias.from) === ids.has(alias.to)) continue;
      ids.add(alias.from).add(alias.to);
      grew = true;
    }
  }
  return ids;
}

function forwardIds(model, start) {
  const ids = new Set([start]);
  for (const id of ids) for (const alias of model.aliasesFrom.get(id) ?? []) ids.add(alias.to);
  return ids;
}

/**
 * Current path of the entity renumbered by `alias` (E-0024 (3), anchor per E-0028 (1)), or null when the alias
 * projects onto no file. `files` = [{path, id}] with the ID each entity file carries (or will carry).
 */
export function aliasCurrentPath(model, alias, files) {
  const target = alias.to;
  const promote = model.promotes.get(target);
  if (promote) {
    // Promoted for the renumbered entity (at the anchor, or after an unrecorded relocation): its holder path.
    // Promoted for a different entity that had its own allocate of the same ID: no file.
    return promote.path === alias.rpath || !model.allocatePaths.get(target).has(promote.path) ? model.holder.get(target) : null;
  }
  const atAnchor = connectedIds(model, target, alias.rpath);
  if (files.some((file) => file.path === alias.rpath && atAnchor.has(file.id))) return alias.rpath;
  const forward = forwardIds(model, target);
  const relocated = files.filter((file) => forward.has(file.id) && !model.allocatePaths.get(target).has(file.path));
  return relocated.length === 1 ? relocated[0].path : null;
}

/**
 * `id_alias` projection (E-0011, E-0024 (3)): aliases whose renumbered entity currently lives at `filePath`,
 * oldest first, recursing through earlier aliases of the same entity.
 */
export function aliasProjection(model, id, filePath, files) {
  const out = [];
  const memo = new Map();
  const currentPath = (alias) => {
    if (!memo.has(alias)) memo.set(alias, aliasCurrentPath(model, alias, files));
    return memo.get(alias);
  };
  // An earlier alias of the same entity is one that renumbered it in place (same anchor) or whose entity is also here.
  const visit = (target, later) => {
    for (const alias of model.aliasesTo.get(target) ?? []) {
      if (currentPath(alias) !== filePath && !(later && alias.rpath === later.rpath)) continue;
      visit(alias.from, alias);
      if (!out.includes(alias.from)) out.push(alias.from);
    }
  };
  visit(id, null);
  return out;
}

/**
 * Effective ID of an entity file: its own `id`, unless the file is the pending half of an interrupted renumber
 * (registry has allocate Y at this path and alias X -> Y while the file still carries X; PLAN promoteIds item 4).
 */
export function effectiveId(model, id, filePath) {
  if (model.promotes.has(id) && model.holder.get(id) === filePath) return id;
  let current = id;
  const visited = new Set([id]);
  for (;;) {
    const targets = [...new Set((model.aliasesFrom.get(current) ?? []).filter((a) => a.rpath === filePath).map((a) => a.to))];
    if (targets.length !== 1 || visited.has(targets[0])) break;
    current = targets[0];
    visited.add(current);
  }
  return current;
}
