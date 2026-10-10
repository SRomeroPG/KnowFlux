// Entity files as the registry's projection (E-0011): scan of entity records and the minimal-diff rewrite of the
// three identity keys. Scan order never affects results (paths are sorted in UTF-8 byte order).
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import YAML from 'yaml';
import { ID_PATTERN, compareBytes } from './id-registry-codec.mjs';

export const ENTITY_ROOTS = Object.freeze(['knowledge', 'changes', 'divergences']);

async function walk(root, relative, found) {
  let entries;
  try {
    entries = await readdir(path.join(root, ...relative.split('/')), { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return;
    throw error;
  }
  for (const entry of entries) {
    const child = `${relative}/${entry.name}`;
    if (entry.isDirectory()) await walk(root, child, found);
    else if (entry.isFile() && /\.ya?ml$/.test(entry.name)) found.push(child);
  }
}

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

/**
 * Entity records under knowledge/, changes/, divergences/: *.yaml / *.yml files that parse to a mapping with a
 * top-level `id` key holding a core ID. Unparsable files and files whose `id` is not a core ID are not records
 * (not asserted by the PLAN, TRIAGE N-07). Sorted by repo path in byte order.
 */
export async function scanEntities(root) {
  const files = [];
  for (const top of ENTITY_ROOTS) await walk(root, top, files);
  files.sort(compareBytes);
  const records = [];
  for (const file of files) {
    const text = await readFile(path.join(root, ...file.split('/')), 'utf8');
    const value = parseMapping(text);
    if (!value || !Object.hasOwn(value, 'id')) continue;
    if (typeof value.id !== 'string' || !ID_PATTERN.test(value.id)) continue;
    records.push({ path: file, id: value.id, id_status: value.id_status, id_alias: value.id_alias, text });
  }
  return records;
}

export function sameIdentity(entity, desired) {
  const current = Array.isArray(entity.id_alias) ? entity.id_alias : entity.id_alias === undefined ? [] : null;
  return entity.id === desired.id && entity.id_status === desired.id_status && isDeepStrictEqual(current, desired.id_alias);
}

// ------------------------------------------------------------------ minimal-diff rewrite
const IDENTITY_KEYS = new Set(['id', 'id_status', 'id_alias']);

const eol = (text, from) => {
  const index = text.indexOf('\n', from);
  return index === -1 ? text.length : index;
};

function trimEnd(text, end, floor) {
  let at = end;
  while (at > floor && /\s/.test(text[at - 1])) at -= 1;
  return at;
}

function aliasText(aliases) {
  return `id_alias: [${aliases.join(', ')}]`;
}

function splice(text, desired) {
  const document = YAML.parseDocument(text, { uniqueKeys: true });
  if (document.errors.length || !YAML.isMap(document.contents) || document.contents.flow) return null;
  const pairOf = (name) => document.contents.items.find((pair) => YAML.isScalar(pair.key) && pair.key.value === name);
  const idPair = pairOf('id');
  const statusPair = pairOf('id_status');
  const aliasPair = pairOf('id_alias');
  if (!idPair || !YAML.isScalar(idPair.value) || !idPair.value.range) return null;
  if (statusPair && (!YAML.isScalar(statusPair.value) || !statusPair.value.range)) return null;
  const edits = [{ start: idPair.value.range[0], end: idPair.value.range[1], insert: desired.id }];
  if (statusPair) {
    edits.push({ start: statusPair.value.range[0], end: statusPair.value.range[1], insert: desired.id_status });
  }
  const inserted = [];
  if (!statusPair) inserted.push(`id_status: ${desired.id_status}`);
  if (aliasPair) {
    if (!aliasPair.value || !aliasPair.value.range || !aliasPair.key.range) return null;
    const keyStart = aliasPair.key.range[0];
    const valueEnd = trimEnd(text, aliasPair.value.range[1], aliasPair.key.range[1]);
    if (desired.id_alias.length > 0) {
      edits.push({ start: keyStart, end: valueEnd, insert: aliasText(desired.id_alias) });
    } else {
      const lineStart = text.lastIndexOf('\n', keyStart - 1) + 1;
      const lineEnd = eol(text, valueEnd);
      edits.push({ start: lineStart, end: Math.min(lineEnd + 1, text.length), insert: '' });
    }
  } else if (desired.id_alias.length > 0) {
    inserted.push(aliasText(desired.id_alias));
  }
  if (inserted.length > 0) {
    const anchor = statusPair ? statusPair.value.range[1] : idPair.value.range[1];
    const at = eol(text, anchor);
    edits.push({ start: at, end: at, insert: inserted.map((line) => `\n${line}`).join('') });
  }
  let result = text;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, edit.start) + edit.insert + result.slice(edit.end);
  }
  return result;
}

function verify(candidate, original, desired) {
  const after = parseMapping(candidate);
  const before = parseMapping(original);
  if (!after || !before) return false;
  if (after.id !== desired.id || after.id_status !== desired.id_status) return false;
  const aliases = after.id_alias === undefined ? [] : after.id_alias;
  if (!isDeepStrictEqual(aliases, desired.id_alias)) return false;
  const rest = (value) => Object.entries(value).filter(([key]) => !IDENTITY_KEYS.has(key));
  return isDeepStrictEqual(rest(after), rest(before));
}

function viaDocument(text, desired) {
  const document = YAML.parseDocument(text);
  const map = document.contents;
  const put = (key, value, after) => {
    if (map.has(key)) {
      map.set(key, value);
      return;
    }
    const index = map.items.findIndex((pair) => pair.key?.value === after);
    map.items.splice(index + 1, 0, document.createPair(key, value));
  };
  put('id', desired.id, 'id');
  put('id_status', desired.id_status, 'id');
  if (desired.id_alias.length > 0) {
    const alias = document.createNode(desired.id_alias);
    alias.flow = true;
    put('id_alias', alias, 'id_status');
  } else {
    map.delete('id_alias');
  }
  return document.toString({ lineWidth: 0 });
}

/**
 * Entity text with `id`, `id_status` and `id_alias` set to `desired` and nothing else changed: other keys, values,
 * comments and key order are preserved, new keys sit directly after `id_status` (`id_status` after `id`), LF output.
 */
export function projectEntityText(original, desired) {
  const text = original.replace(/\r\n/g, '\n');
  const spliced = splice(text, desired);
  if (spliced !== null && verify(spliced, text, desired)) return spliced;
  return viaDocument(text, desired);
}
