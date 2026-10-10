// P011 implementer tests: unit registry (spec section 11.2; errata E-0018).
import assert from 'node:assert/strict';
import test from 'node:test';
import { LogicError } from '../framework/engine/logic-errors.mjs';
import { buildUnitRegistry, isUnitRegistry } from '../framework/engine/units.mjs';

const unit = (id, dimension = 'mass_fraction', symbol = id) => ({ id, dimension, symbol });
const data = (...units) => ({ units, conversions: [] });
const U1 = () => data(unit('percent_mass', 'mass_fraction', '% m/m'), unit('ppm_mass', 'mass_fraction', 'ppm'), unit('percent_volume', 'volume_fraction', '% v/v'), unit('kg', 'mass', 'kg'));

function code(fn) {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof LogicError);
    return error.code;
  }
  return 'NO_THROW';
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

test('§11.2 l.596-599: a registry accepts exactly the units/conversions shape and keeps the input order', () => {
  const source = deepFreeze(U1());
  const registry = buildUnitRegistry(source);
  assert.equal(isUnitRegistry(registry), true);
  assert.deepEqual(registry.units, U1().units);
  assert.deepEqual(registry.units.map((u) => u.id), ['percent_mass', 'ppm_mass', 'percent_volume', 'kg']);
  assert.equal(buildUnitRegistry(data()).units.length, 0, 'an empty registry is valid');
});

test('§11.2 l.591: no built-in unit; bare percent is valid only if declared; ids match exactly', () => {
  const registry = buildUnitRegistry(U1());
  for (const id of ['percent_mass', 'ppm_mass', 'percent_volume', 'kg']) assert.equal(registry.has(id), true, id);
  for (const id of ['percent', 'ppm', 'PERCENT_MASS', 'percent_mass ', '', '% m/m', 'mass_fraction', 'percent_mass_per_volume']) {
    assert.equal(registry.has(id), false, JSON.stringify(id));
  }
  for (const bad of [undefined, null, 5, {}, ['kg']]) assert.equal(registry.has(bad), false);
  const withPercent = buildUnitRegistry(data(unit('percent', 'mass_fraction', '%')));
  assert.equal(withPercent.has('percent'), true);
  assert.equal(buildUnitRegistry(data()).has('percent_mass'), false);
});

test('§11.2 l.591: hostile ids are plain ids (no prototype lookups)', () => {
  const registry = buildUnitRegistry(data(unit('kg')));
  for (const id of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) assert.equal(registry.has(id), false, id);
  const declared = buildUnitRegistry(data(unit('__proto__')));
  assert.equal(declared.has('__proto__'), true);
  assert.equal(declared.has('constructor'), false);
});

test('§11.2 l.602: conversions must be an empty list; no conversion is ever accepted', () => {
  const d = U1();
  d.conversions = [{ from: 'percent_mass', to: 'ppm_mass', factor: '10000' }];
  assert.equal(code(() => buildUnitRegistry(d)), 'INVALID_UNITS');
  assert.equal(code(() => buildUnitRegistry({ units: U1().units })), 'INVALID_UNITS', 'conversions must be present (shape of l.599)');
  assert.equal(code(() => buildUnitRegistry({ units: [], conversions: {} })), 'INVALID_UNITS');
  assert.equal(code(() => buildUnitRegistry({ units: [], conversions: null })), 'INVALID_UNITS');
  const registry = buildUnitRegistry(U1());
  assert.equal(Object.keys(registry).some((key) => /convert/i.test(key)), false, 'the registry exposes no conversion');
});

test('§11.2 l.596-599: invalid registries are INVALID_UNITS with a location', () => {
  const mutate = (fn) => { const d = U1(); fn(d); return d; };
  const invalid = {
    duplicate_id: mutate((d) => d.units.push(unit('kg'))),
    units_mapping: { units: { kg: { dimension: 'mass', symbol: 'kg' } }, conversions: [] },
    units_missing: { conversions: [] },
    entry_without_id: mutate((d) => { delete d.units[0].id; }),
    entry_id_number: mutate((d) => { d.units[0].id = 5; }),
    entry_empty_id: mutate((d) => { d.units[0].id = ''; }),
    dimension_number: mutate((d) => { d.units[0].dimension = 1; }),
    dimension_missing: mutate((d) => { delete d.units[1].dimension; }),
    symbol_null: mutate((d) => { d.units[0].symbol = null; }),
    symbol_missing: mutate((d) => { delete d.units[0].symbol; }),
    extra_entry_key: mutate((d) => { d.units[0].factor = '1'; }),
    extra_top_key: mutate((d) => { d.extra = true; }),
    entry_string: { units: ['kg'], conversions: [] },
    entry_list: { units: [[]], conversions: [] },
    top_null: null,
    top_list: [],
    top_string: 'units',
    top_undefined: undefined,
  };
  for (const [name, value] of Object.entries(invalid)) {
    try {
      buildUnitRegistry(value);
      assert.fail(`${name} should be rejected`);
    } catch (error) {
      assert.ok(error instanceof LogicError, name);
      assert.equal(error.code, 'INVALID_UNITS', name);
      assert.equal(typeof error.details, 'object', name);
    }
  }
});

test('E-0018: isUnitRegistry is true only for built registries (raw data and look-alikes are not)', () => {
  assert.equal(isUnitRegistry(buildUnitRegistry(U1())), true);
  assert.equal(isUnitRegistry(U1()), false);
  assert.equal(isUnitRegistry({ has: () => true, units: [] }), false);
  assert.equal(isUnitRegistry(Object.create(buildUnitRegistry(U1()))), false);
  for (const value of [null, undefined, 1, 'x', []]) assert.equal(isUnitRegistry(value), false);
});

test('E-0018: a built registry is immutable and independent of the source data', () => {
  const source = U1();
  const registry = buildUnitRegistry(source);
  source.units[0].id = 'changed';
  source.units.push(unit('extra'));
  assert.equal(registry.has('percent_mass'), true);
  assert.equal(registry.has('changed'), false);
  assert.equal(registry.has('extra'), false);
  assert.equal(Object.isFrozen(registry), true);
  assert.equal(Object.isFrozen(registry.units), true);
  assert.equal(Object.isFrozen(registry.units[0]), true);
});
