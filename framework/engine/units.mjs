// Unit registry (spec l.591-602; errata E-0018, E-0022).
//
// The registry is built from already-parsed `units.yaml` content of exactly the l.596-599 shape:
//   units: [{ id, dimension, symbol }, ...]   (unique `id`)
//   conversions: []                           (empty in v1, l.599; never any inferred conversion, l.602)
// There is no built-in unit: bare `percent` is valid only if the registry declares it. Units are compared by
// `id` only, never by `dimension` or `symbol`. Discovery and loading of `extensions/<domain>/units.yaml` is
// P007; this module reads no file.
import { LogicError } from './logic-errors.mjs';

const BRAND = new WeakSet();

function isPlainRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(message, details) {
  return new LogicError('INVALID_UNITS', message, details);
}

function ownKeys(record) {
  return Object.keys(record);
}

/**
 * Build a registry from parsed `units.yaml` data. Anything off-shape is INVALID_UNITS.
 * Beyond the shape of l.596-599 this is strict (fail closed): `conversions` must be present and empty,
 * entries carry exactly `id`, `dimension`, `symbol` (strings; `id` and `dimension` non-empty).
 */
export function buildUnitRegistry(data) {
  if (!isPlainRecord(data)) throw invalid('units data must be a mapping with `units` and `conversions`', { at: '' });
  const topKeys = ownKeys(data);
  for (const key of topKeys) {
    if (key !== 'units' && key !== 'conversions') throw invalid(`unexpected top-level key "${key}"`, { at: `/${key}` });
  }
  if (!Array.isArray(data.units)) throw invalid('`units` must be a list', { at: '/units' });
  if (!Array.isArray(data.conversions)) throw invalid('`conversions` must be present and be an empty list', { at: '/conversions' });
  if (data.conversions.length !== 0) {
    throw invalid('`conversions` must be empty in v1: no conversion is ever added or inferred (l.599, l.602)', { at: '/conversions' });
  }

  const ids = new Set();
  const units = [];
  data.units.forEach((entry, index) => {
    const at = `/units/${index}`;
    if (!isPlainRecord(entry)) throw invalid('a unit entry must be a mapping', { at });
    for (const key of ownKeys(entry)) {
      if (key !== 'id' && key !== 'dimension' && key !== 'symbol') throw invalid(`unexpected key "${key}" in a unit entry`, { at: `${at}/${key}` });
    }
    const { id, dimension, symbol } = entry;
    if (typeof id !== 'string' || id.length === 0) throw invalid('unit `id` must be a non-empty string', { at: `${at}/id` });
    if (typeof dimension !== 'string' || dimension.length === 0) throw invalid('unit `dimension` must be a non-empty string', { at: `${at}/dimension` });
    if (typeof symbol !== 'string') throw invalid('unit `symbol` must be a string', { at: `${at}/symbol` });
    if (ids.has(id)) throw invalid(`unit id "${id}" is declared twice`, { at: `${at}/id`, id });
    ids.add(id);
    units.push(Object.freeze({ id, dimension, symbol }));
  });

  const registry = Object.freeze({
    units: Object.freeze(units),
    has(id) {
      return typeof id === 'string' && ids.has(id);
    },
  });
  BRAND.add(registry);
  return registry;
}

/** True only for values returned by `buildUnitRegistry`. */
export function isUnitRegistry(value) {
  return typeof value === 'object' && value !== null && BRAND.has(value);
}
