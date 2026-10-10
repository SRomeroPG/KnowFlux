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

/** Replay model (order-tolerant where a union merge can reorder lines, E-0012). Throws INVALID_REGISTRY. */
export function buildModel(events) {
  const allocates = new Map(); // id -> [{index, path}]
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
      if (!allocates.has(event.id)) allocates.set(event.id, []);
      allocates.get(event.id).push({ index, path: event.path });
    } else if (event.op === 'promote') {
      if (promotes.has(event.id)) throw invalid(`event ${index}: ${event.id} is promoted twice`);
      promotes.set(event.id, { path: event.path, commit: event.commit, index });
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
  for (const [index, event] of events.entries()) {
    if (event.op !== 'move') continue;
    if (!holder.has(event.id)) throw invalid(`event ${index}: move of ${event.id}, which has no promote`);
    if (holder.get(event.id) !== event.from) throw invalid(`event ${index}: move.from is not the current path of ${event.id}`);
    holder.set(event.id, event.to);
  }
  const aliases = [];
  const aliasesFrom = new Map();
  const aliasesTo = new Map();
  for (const [index, event] of events.entries()) {
    if (event.op !== 'alias') continue;
    const list = allocates.get(event.to);
    // The renumbered entity is the file at the path of the allocate of `to` written by the same renumbering:
    // the nearest one before the alias line (D-02c puts it immediately before), else the nearest one after.
    const before = list.filter((a) => a.index < index).at(-1);
    const rpath = (before ?? list.find((a) => a.index > index)).path;
    const alias = { index, from: event.from, to: event.to, commit: event.commit, rpath };
    aliases.push(alias);
    if (!aliasesFrom.has(alias.from)) aliasesFrom.set(alias.from, []);
    if (!aliasesTo.has(alias.to)) aliasesTo.set(alias.to, []);
    aliasesFrom.get(alias.from).push(alias);
    aliasesTo.get(alias.to).push(alias);
  }
  assertAcyclic(aliasesFrom);
  return { events, allocates, seen, promotes, holder, aliases, aliasesFrom, aliasesTo, max };
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

/** `id_alias` projection (E-0011, E-0016 2a): aliases whose renumbered entity is the file at `filePath`, oldest first. */
export function aliasProjection(model, id, filePath) {
  const out = [];
  const visit = (target) => {
    for (const alias of model.aliasesTo.get(target) ?? []) {
      if (alias.rpath !== filePath) continue;
      visit(alias.from);
      if (!out.includes(alias.from)) out.push(alias.from);
    }
  };
  visit(id);
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
