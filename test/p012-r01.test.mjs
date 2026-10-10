// P012 remediation R01 unit tests (AUDIT_R01 D01, T01, T06; errata E-0032 (1), E-0033, E-0038 (1)-(3)). Test names start with the clause.
import assert from 'node:assert/strict';
import test from 'node:test';
import { checkFormula, evaluateFormula } from '../framework/engine/formula.mjs';
import { LogicError } from '../framework/engine/logic-errors.mjs';
import { buildUnitRegistry } from '../framework/engine/units.mjs';

const REGISTRY = buildUnitRegistry({
  units: [
    { id: 'percent_mass', dimension: 'mass_fraction', symbol: '% m/m' },
    { id: 'ratio', dimension: 'dimensionless', symbol: '1' },
  ],
  conversions: [],
});
const INPUTS = [
  { ref: 'DE.f', type: 'decimal' },
  { ref: 'DE.g', type: 'decimal' },
  { ref: 'DE.h', type: 'decimal' },
  { ref: 'DE.c', type: 'quantity', unit: 'percent_mass' },
];
const opts = (extra = {}) => ({ unitRegistry: REGISTRY, inputs: INPUTS, ...extra });
const R = (name) => ({ ref: `DE.${name}` });
const K = (value) => ({ const: value });
const op = (name, ...args) => ({ op: name, args });
const FX = (expression, extra = {}, unit = 'ratio') => ({ kind: 'formula', output: { ref: 'DE.out', unit }, expression, ...extra });
const HALF_UP_0 = { rounding: { mode: 'half-up', decimals: 0 } };
const holes = (length, fill = {}) => {
  const list = new Array(length);
  for (const [index, value] of Object.entries(fill)) list[Number(index)] = value;
  return list;
};
const run = (logic, values = {}, extra = {}) => evaluateFormula(logic, values, opts(extra));
const okValue = (logic, values) => {
  const result = run(logic, values);
  assert.equal(result.status, 'ok', JSON.stringify(result));
  return result.value === null ? null : result.value.value;
};
function codeOf(fn) {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof LogicError, `LogicError expected, got ${error?.name}: ${error?.message}`);
    return error.code;
  }
  return 'NO_THROW';
}

test('E-0033: a sparse all/any list in a guard or an if cond is INVALID_EXPRESSION from check and evaluate, never a TypeError (AUDIT_R01 D01)', () => {
  const x = { f: { eq: '1' } };
  const shapes = [
    { all: holes(2, { 1: x }) },
    { all: holes(2, { 0: x }) },
    { any: holes(2) },
    { all: holes(1) },
    { any: holes(3, { 0: x, 2: x }) },
    { all: [{ any: holes(2) }] },
    { not: { all: holes(2, { 1: x }) } },
  ];
  for (const when of shapes) {
    for (const logic of [FX(R('f'), { guards: [{ when, raise: 'OUT-0001' }] }), FX({ op: 'if', cond: when, then: R('f'), else: R('g') })]) {
      assert.equal(codeOf(() => checkFormula(logic, opts())), 'INVALID_EXPRESSION');
      assert.equal(codeOf(() => run(logic, { 'DE.f': '1', 'DE.g': '2' })), 'INVALID_EXPRESSION');
    }
  }
  // near miss: the same shapes without holes are well formed
  assert.deepEqual(checkFormula(FX(R('f'), { guards: [{ when: { all: [x, x] }, raise: 'OUT-0001' }] }), opts()), []);
  assert.deepEqual(checkFormula(FX({ op: 'if', cond: { any: [x, { not: x }] }, then: R('f'), else: R('g') }), opts()), []);
});

test('E-0033: a sparse operator args list, a sparse guards list and a sparse options.inputs list raise typed errors, never a TypeError (AUDIT_R01 D01)', () => {
  for (const logic of [
    FX({ op: 'add', args: holes(2) }),
    FX({ op: 'add', args: holes(2, { 1: K('1') }) }),
    FX({ op: 'abs', args: holes(1) }),
    FX(R('f'), { guards: holes(1) }),
    FX(R('f'), { guards: holes(2, { 1: { when: { f: { eq: '1' } }, raise: 'OUT-0001' } }) }),
  ]) {
    assert.equal(codeOf(() => checkFormula(logic, opts())), 'INVALID_EXPRESSION');
    assert.equal(codeOf(() => run(logic, { 'DE.f': '1' })), 'INVALID_EXPRESSION');
  }
  const sparseInputs = holes(2, { 0: { ref: 'DE.f', type: 'decimal' } });
  assert.equal(codeOf(() => checkFormula(FX(R('f')), opts({ inputs: sparseInputs }))), 'INVALID_ARGUMENT');
  assert.equal(codeOf(() => run(FX(R('f')), {}, { inputs: sparseInputs })), 'INVALID_ARGUMENT');
});

test('E-0032 (1): nested add, subtract, multiply, min, max, abs, clamp and exact divide are never rounded before the single final rounding (AUDIT_R01 T01)', () => {
  const v = { 'DE.f': '0.4', 'DE.g': '1', 'DE.h': '0.4' };
  const cases = [
    ['add(multiply(f,g),h)', op('add', op('multiply', R('f'), R('g')), R('h')), v, '1'],
    ['add(multiply(f,h),h)', op('add', op('multiply', R('f'), R('h')), R('h')), { 'DE.f': '0.4', 'DE.h': '0.4' }, '1'],
    ['add(min(f,g),h)', op('add', op('min', R('f'), R('g')), R('h')), v, '1'],
    ['add(max(f,0.1),h)', op('add', op('max', R('f'), K('0.1')), R('h')), v, '1'],
    ['add(abs(-0.4),h)', op('add', op('abs', K('-0.4')), R('h')), v, '1'],
    ['add(clamp(f,0,g),h)', op('add', op('clamp', R('f'), K('0'), R('g')), R('h')), v, '1'],
    ['add(subtract(g,0.6),h)', op('add', op('subtract', R('g'), K('0.6')), R('h')), v, '1'],
    ['add(divide(0.8,2),h) exact', op('add', op('divide', K('0.8'), K('2')), R('h')), v, '1'],
  ];
  for (const [name, expression, values, expected] of cases) {
    assert.equal(okValue(FX(expression, HALF_UP_0), values), expected, name);
  }
  // multiply(divide(f, 8), 8) with 'down' and f = 1: the exact quotient 0.125 must not be rounded to 0 before the multiply
  assert.equal(okValue(FX(op('multiply', op('divide', R('f'), K('8')), K('8')), { rounding: { mode: 'down', decimals: 0 } }), { 'DE.f': '1' }), '1');
  // control: a single final rounding of the exact sum
  assert.equal(okValue(FX(op('add', K('0.4'), K('0.4')), HALF_UP_0), {}), '1');
});

test('E-0032 (6) and E-0038 (2): the root expression has depth 1; depth 1000 is accepted, depth 1001 is INVALID_EXPRESSION (AUDIT_R01 T06)', () => {
  const chain = (depth) => {
    let node = R('f');
    for (let level = 1; level < depth; level += 1) node = op('abs', node);
    return node;
  };
  assert.deepEqual(checkFormula(FX(chain(1000)), opts()), []);
  assert.equal(okValue(FX(chain(1000)), { 'DE.f': '-3' }), '3');
  assert.equal(codeOf(() => checkFormula(FX(chain(1001)), opts())), 'INVALID_EXPRESSION');
  assert.equal(codeOf(() => run(FX(chain(1001)), { 'DE.f': '1' })), 'INVALID_EXPRESSION');
  // a leaf root is depth 1
  assert.deepEqual(checkFormula(FX(R('f')), opts()), []);
  // an if node is one level for its branches
  const ifChain = (depth) => {
    let node = R('f');
    for (let level = 1; level < depth; level += 1) node = { op: 'if', cond: { f: { is_null: false } }, then: node, else: R('g') };
    return node;
  };
  assert.deepEqual(checkFormula(FX(ifChain(1000)), opts()), []);
  assert.equal(codeOf(() => checkFormula(FX(ifChain(1001)), opts())), 'INVALID_EXPRESSION');
});

test('E-0038 (1): all arguments of an operator are evaluated before null propagation, so a defect in a sibling is raised', () => {
  const nullF = { 'DE.f': null };
  // INEXACT_DIVISION in a sibling of a null operand, without a rounding block
  for (const name of ['add', 'subtract', 'multiply', 'min', 'max']) {
    const logic = FX(op(name, R('f'), op('divide', K('1'), K('3'))));
    assert.equal(codeOf(() => run(logic, nullF)), 'INEXACT_DIVISION', name);
    assert.equal(codeOf(() => run(logic, {})), 'INEXACT_DIVISION', `${name} absent`);
  }
  assert.equal(codeOf(() => run(FX(op('divide', op('add', R('f'), op('divide', K('1'), K('3'))), K('2'))), nullF)), 'INEXACT_DIVISION');
  // nested
  assert.equal(codeOf(() => run(FX(op('abs', op('add', R('f'), op('divide', K('1'), K('3'))))), nullF)), 'INEXACT_DIVISION');
  // with a rounding block the sibling is rounded, not an error, and the null result stays null
  assert.equal(okValue(FX(op('add', R('f'), op('divide', K('1'), K('3'))), HALF_UP_0), nullF), null);
  // exact sibling, or a null numerator: null
  assert.equal(okValue(FX(op('add', R('f'), op('divide', K('1'), K('4')))), nullF), null);
  assert.equal(okValue(FX(op('divide', R('f'), K('3'))), nullF), null);
  // if stays lazy: the unselected branch is not evaluated
  const lazy = FX({ op: 'if', cond: { f: { is_null: true } }, then: K('7'), else: op('divide', K('1'), K('3')) });
  assert.equal(okValue(lazy, nullF), '7');
});

test('E-0038 (3): clamp with a null x raises INVALID_RANGE when lo and hi are non-null and lo > hi, at evaluation only', () => {
  const logic = FX(op('clamp', R('f'), K('2'), K('1')));
  assert.deepEqual(checkFormula(logic, opts()), []);
  assert.equal(codeOf(() => run(logic, { 'DE.f': null })), 'INVALID_RANGE');
  assert.equal(codeOf(() => run(logic, {})), 'INVALID_RANGE');
  assert.equal(codeOf(() => run(FX(op('add', K('1'), op('clamp', R('f'), K('2'), K('1'))), HALF_UP_0), {})), 'INVALID_RANGE');
  // near misses: lo <= hi, or a null bound, give null
  assert.equal(okValue(FX(op('clamp', R('f'), K('1'), K('2'))), {}), null);
  assert.equal(okValue(FX(op('clamp', R('f'), K('1'), K('1'))), {}), null);
  assert.equal(okValue(FX(op('clamp', R('f'), R('g'), K('1'))), { 'DE.g': null }), null);
  assert.equal(okValue(FX(op('clamp', R('f'), K('2'), R('g'))), {}), null);
});
