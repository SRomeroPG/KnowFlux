// P012 implementer tests: formula checker and evaluator (spec section 11 l.576-613, section 12.2 l.636-664, section 42.2
// l.1765-1771; errata E-0017..E-0022, E-0025..E-0027, E-0030..E-0033, E-0036, E-0037). Test names start with the clause.
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { compareDecimal, formatDecimal, parseDecimal } from '../framework/engine/decimal.mjs';
import { compileLogicInputs, compileLogicPredicate, evaluateLogicPredicate, typeLogicValues } from '../framework/engine/decision-table.mjs';
import { DEFAULT_PRECISION, MAX_EXPRESSION_DEPTH, checkFormula, evaluateFormula } from '../framework/engine/formula.mjs';
import { FORMULA_DIAGNOSTIC_CATALOG, LOGIC_DIAGNOSTIC_CATALOG, makeFormulaDiagnostic } from '../framework/engine/logic-diagnostics.mjs';
import { FORMULA_ERROR_CODES, LOGIC_ERROR_CODES, LogicError } from '../framework/engine/logic-errors.mjs';
import { buildUnitRegistry } from '../framework/engine/units.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = buildUnitRegistry({
  units: [
    { id: 'percent_mass', dimension: 'mass_fraction', symbol: '% m/m' },
    { id: 'ppm_mass', dimension: 'mass_fraction', symbol: 'ppm' },
    { id: 'percent_volume', dimension: 'volume_fraction', symbol: '% v/v' },
    { id: 'kg', dimension: 'mass', symbol: 'kg' },
    { id: 'ratio', dimension: 'dimensionless', symbol: '1' },
    { id: 'look_alike', dimension: 'dimensionless', symbol: '%' },
    { id: 'percent_mass_squared', dimension: 'mass_fraction_squared', symbol: '(% m/m)^2' },
  ],
  conversions: [],
});
const REGISTRY_NO_DIMENSIONLESS = buildUnitRegistry({ units: [{ id: 'percent_mass', dimension: 'mass_fraction', symbol: '%' }], conversions: [] });
const INPUTS = [
  { ref: 'DE.c', type: 'quantity', unit: 'percent_mass' },
  { ref: 'DE.h', type: 'quantity', unit: 'percent_mass' },
  { ref: 'DE.p', type: 'quantity', unit: 'ppm_mass' },
  { ref: 'DE.f', type: 'decimal' },
  { ref: 'DE.g', type: 'decimal' },
  { ref: 'DE.e', type: 'enum', domain: ['X', 'Y', 'Z'] },
  { ref: 'DE.s', type: 'string' },
  { ref: 'DE.b', type: 'boolean' },
];
const opts = (extra = {}) => ({ unitRegistry: REGISTRY, inputs: INPUTS, ...extra });
const R = (name) => ({ ref: `DE.${name}` });
const K = (value, unit) => (unit === undefined ? { const: value } : { const: value, unit });
const op = (name, ...args) => ({ op: name, args });
const FX = (expression, unit = 'ratio', extra = {}) => ({ kind: 'formula', output: { ref: 'DE.out', unit }, expression, ...extra });
const Q = (value, unit = 'percent_mass') => ({ value, unit });
const iff = (cond, then, other) => ({ op: 'if', cond, then, else: other });

function code(fn) {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof LogicError, `LogicError expected, got ${error}`);
    assert.ok(!String(error.code).startsWith('KF-'), 'a KF- code is never thrown');
    return error.code;
  }
  return 'NO_THROW';
}
const valueOf = (logic, values = {}, extra = {}) => {
  const result = evaluateFormula(logic, values, opts(extra));
  assert.equal(result.status, 'ok', JSON.stringify(result));
  return result.value === null ? null : result.value.value;
};
const checkCodes = (logic, extra = {}) => checkFormula(logic, opts(extra)).map((d) => `${d.code}@${d.pointer}`);

test('§11.1 l.582: add, subtract and multiply are exact decimals, never binary floats', () => {
  assert.equal(valueOf(FX(op('add', R('f'), R('g'))), { 'DE.f': '0.1', 'DE.g': '0.2' }), '0.3');
  assert.equal(valueOf(FX(op('add', R('f'), R('g'))), { 'DE.f': '9007199254740992', 'DE.g': '1' }), '9007199254740993');
  assert.equal(valueOf(FX(op('subtract', R('f'), R('g'))), { 'DE.f': '0.3', 'DE.g': '0.1' }), '0.2');
  assert.equal(valueOf(FX(op('multiply', R('f'), R('g'))), { 'DE.f': '123456789012345678901234567890', 'DE.g': '987654321098765432109876543210' }), '121932631137021795226185032733622923332237463801111263526900');
  assert.equal(valueOf(FX(op('multiply', R('f'), R('g'))), { 'DE.f': '0.000001', 'DE.g': '0.000001' }), '0.000000000001');
  assert.equal(valueOf(FX(op('add', R('f'), R('g'))), { 'DE.f': '0.1', 'DE.g': '-0.1' }), '0', 'never "-0"');
  const a = '7'.repeat(2000);
  const b = '3'.repeat(2000);
  assert.equal(valueOf(FX(op('multiply', K(a), K(b)))), (BigInt(a) * BigInt(b)).toString());
});

test('§11.1 l.582: divide, min, max, abs and clamp are exact and numeric', () => {
  assert.equal(valueOf(FX(op('divide', K('1'), K('8')))), '0.125');
  assert.equal(valueOf(FX(op('min', R('f'), R('g'))), { 'DE.f': '10', 'DE.g': '9' }), '9', 'numeric, not lexical');
  assert.equal(valueOf(FX(op('max', R('f'), R('g'))), { 'DE.f': '10', 'DE.g': '9' }), '10');
  assert.equal(valueOf(FX(op('abs', R('f'))), { 'DE.f': '-3.50' }), '3.5');
  assert.equal(valueOf(FX(op('clamp', R('f'), K('0'), K('1'))), { 'DE.f': '1.5' }), '1');
  assert.equal(valueOf(FX(op('clamp', R('f'), K('0'), K('1'))), { 'DE.f': '-1.5' }), '0');
  assert.equal(valueOf(FX(op('clamp', R('f'), K('0'), K('1'))), { 'DE.f': '0.5' }), '0.5');
  assert.equal(code(() => evaluateFormula(FX(op('clamp', R('f'), K('1'), K('0'))), { 'DE.f': '0.5' }, opts())), 'INVALID_RANGE');
  assert.deepEqual(checkFormula(FX(op('clamp', R('f'), K('1'), K('0'))), opts()), [], 'lo > hi is a runtime defect only');
});

test('§11.1 l.582: no binary floating point in the new modules (static scan)', async () => {
  for (const file of ['formula.mjs', 'decimal-ops.mjs']) {
    const source = (await fs.readFile(path.join(ROOT, 'framework', 'engine', file), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
    for (const banned of [/\bparseFloat\b/, /\btoFixed\b/, /\btoPrecision\b/, /\bMath\./, /\bNumber\(/, /\bparseInt\b/, /\beval\(/, /new\s+Function/, /\bimport\s*\(/]) {
      assert.doesNotMatch(source, banned, `${file}: ${banned}`);
    }
    for (const specifier of source.matchAll(/from\s+'([^']+)'/g)) assert.match(specifier[1], /^\.\/[a-z0-9-]+\.mjs$/, `${file} imports only siblings`);
  }
});

test('§11.1 l.583: a const or a supplied value that is not a decimal string is INVALID_DECIMAL', () => {
  for (const bad of [1, 1.5, '1,5', '1e3', '.5', '+1', null, true, '', '1.', ' 1', '١']) {
    assert.equal(code(() => checkFormula(FX({ const: bad }), opts())), 'INVALID_DECIMAL', JSON.stringify(bad));
  }
  for (const bad of [0.1, '1e3', '0,1', 1n]) assert.equal(code(() => evaluateFormula(FX(R('f')), { 'DE.f': bad }, opts())), 'INVALID_DECIMAL');
  assert.equal(code(() => evaluateFormula(FX(R('c'), 'percent_mass'), { 'DE.c': { value: 4.2, unit: 'percent_mass' } }, opts())), 'INVALID_DECIMAL');
  assert.equal(valueOf(FX(op('add', K('-0'), K('007'), K('0.10')))), '7.1');
});

test('§11.1 l.584: rounding is only the declared one, with four modes and exact decimals', () => {
  const rounding = (mode, decimals) => ({ rounding: { mode, decimals } });
  const at = (mode, decimals, f) => valueOf(FX(R('f'), 'ratio', rounding(mode, decimals)), { 'DE.f': f });
  assert.deepEqual(['2.5', '3.5', '-2.5', '-3.5'].map((f) => at('half-even', 0, f)), ['2', '4', '-2', '-4']);
  assert.deepEqual(['2.5', '3.5', '-2.5', '-3.5'].map((f) => at('half-up', 0, f)), ['3', '4', '-3', '-4']);
  assert.deepEqual(['2.6', '-2.6', '2.1', '-2.1'].map((f) => at('down', 0, f)), ['2', '-2', '2', '-2']);
  assert.deepEqual(['2.1', '-2.1', '2.0', '-0.4'].map((f) => at('up', 0, f)), ['3', '-3', '2', '-1']);
  assert.equal(at('half-even', 4, '3.78'), '3.7800', 'exactly decimals fraction digits');
  assert.equal(at('half-even', 2, '-0.001'), '0.00', 'never -0.00');
  assert.equal(at('down', 3, '1'), '1.000');
  assert.equal(at('half-even', 100, '1'), `1.${'0'.repeat(100)}`);
});

test('§11.1 l.584: without a rounding declaration nothing is rounded and the value is canonical', () => {
  assert.equal(valueOf(FX(R('f')), { 'DE.f': '0.123456789012345678901234567890123' }), '0.123456789012345678901234567890123');
  assert.equal(valueOf(FX(R('f')), { 'DE.f': '1000.000' }), '1000');
  assert.equal(code(() => evaluateFormula(FX(op('divide', R('f'), K('3'))), { 'DE.f': '1' }, opts())), 'INEXACT_DIVISION');
  assert.equal(code(() => checkFormula(FX(op('round', R('f'))), opts())), 'INVALID_EXPRESSION', 'round needs a rounding block');
  assert.equal(code(() => checkFormula(FX(iff({ b: true }, R('f'), op('round', R('f')))), opts())), 'INVALID_EXPRESSION', 'also in an unselected branch');
});

test('E-0032 (1): rounding is applied once at the end; round() applies it at that point only', () => {
  const half = { rounding: { mode: 'half-up', decimals: 0 } };
  assert.equal(valueOf(FX(op('add', R('f'), R('g')), 'ratio', half), { 'DE.f': '0.4', 'DE.g': '0.4' }), '1', 'intermediates exact');
  assert.equal(valueOf(FX(op('add', op('round', R('f')), op('round', R('g'))), 'ratio', half), { 'DE.f': '0.4', 'DE.g': '0.4' }), '0');
  const even = { rounding: { mode: 'half-even', decimals: 1 } };
  assert.equal(valueOf(FX(op('multiply', op('round', R('f')), R('g')), 'ratio', even), { 'DE.f': '0.25', 'DE.g': '3' }), '0.6');
  assert.equal(valueOf(FX(op('multiply', R('f'), R('g')), 'ratio', even), { 'DE.f': '0.25', 'DE.g': '3' }), '0.8');
  assert.equal(valueOf(FX(op('round', op('round', R('f'))), 'ratio', { rounding: { mode: 'half-up', decimals: 1 } }), { 'DE.f': '2.25' }), '2.3');
  assert.equal(valueOf(FX(op('round', R('c')), 'percent_mass', even), { 'DE.c': Q('4.26') }), '4.3', 'round keeps the unit');
  assert.equal(valueOf(FX(op('round', R('f')), 'ratio', even), {}), null, 'round of null is null');
});

test('E-0032 (2): a malformed rounding block is INVALID_EXPRESSION; decimals 0, 30 and 100 are accepted', () => {
  const bad = [null, [], 'half-even', {}, { mode: 'half-even' }, { decimals: 2 }, { mode: 'half-down', decimals: 2 }, { mode: 'HALF-EVEN', decimals: 2 }, { mode: 5, decimals: 2 },
    { mode: 'half-even', decimals: -1 }, { mode: 'half-even', decimals: 1.5 }, { mode: 'half-even', decimals: '4' }, { mode: 'half-even', decimals: null }, { mode: 'half-even', decimals: true },
    { mode: 'half-even', decimals: 2, extra: 1 }];
  for (const rounding of bad) assert.equal(code(() => checkFormula({ ...FX(R('f')), rounding }, opts())), 'INVALID_EXPRESSION', JSON.stringify(rounding));
  for (const decimals of [0, 30, 100]) assert.deepEqual(checkFormula(FX(R('f'), 'ratio', { rounding: { mode: 'down', decimals } }), opts()), []);
});

test('E-0032 (3): inexact quotients round to precision significant digits first, then again at the end', () => {
  const third = (mode, decimals, f, precision) => valueOf(FX(op('divide', R('f'), K('3')), 'ratio', { rounding: { mode, decimals } }), { 'DE.f': f }, precision === undefined ? {} : { precision });
  assert.equal(third('half-even', 4, '1'), '0.3333');
  assert.equal(third('half-even', 4, '2'), '0.6667');
  assert.equal(third('down', 4, '2'), '0.6666');
  assert.equal(third('up', 4, '1'), '0.3334');
  assert.equal(third('up', 4, '-1'), '-0.3334');
  assert.equal(third('half-even', 6, '1', 3), '0.333000', 'rounded twice, observable');
  assert.equal(third('half-even', 30, '1'), '0.333333333333333333333333333300');
  assert.equal(valueOf(FX(op('divide', R('f'), K('10000000')), 'ratio', { rounding: { mode: 'half-even', decimals: 2 } }), { 'DE.f': '1250001' }, { precision: 3 }), '0.12', 'a single rounding would give 0.13');
  assert.equal(DEFAULT_PRECISION, 28);
});

test('E-0036 (3): exact quotients up to precision significant digits; trailing zeros do not count', () => {
  assert.equal(valueOf(FX(op('divide', R('f'), K('1099511627776'))), { 'DE.f': '1' }), '0.0000000000009094947017729282379150390625');
  assert.equal(code(() => evaluateFormula(FX(op('divide', R('f'), K('2199023255552'))), { 'DE.f': '1' }, opts())), 'INEXACT_DIVISION');
  assert.equal(valueOf(FX(op('divide', R('f'), K('2199023255552'))), { 'DE.f': '1' }, { precision: 29 }), '0.00000000000045474735088646411895751953125');
  assert.equal(valueOf(FX(op('divide', K(`1${'0'.repeat(32)}`), K('1')))), `1${'0'.repeat(32)}`);
  assert.equal(code(() => evaluateFormula(FX(op('divide', K(`1${'0'.repeat(31)}1`), K('1'))), {}, opts())), 'INEXACT_DIVISION');
});

test('§11.1 l.585: a division by a nonzero constant is protected; a constant zero never is', () => {
  assert.deepEqual(checkFormula(FX(op('divide', R('f'), K('2'))), opts()), []);
  assert.deepEqual(checkFormula(FX(op('divide', R('f'), K('-0.001'))), opts()), []);
  for (const zero of ['0', '0.00', '-0', '0.0000']) {
    const [finding, ...rest] = checkFormula(FX(op('divide', R('f'), K(zero))), opts());
    assert.equal(rest.length, 0);
    assert.equal(finding.code, 'KF-E-313');
    assert.equal(finding.reason, 'zero_constant');
    assert.equal(finding.input, null);
    assert.equal(finding.pointer, '/expression');
  }
  const guarded = FX(op('divide', R('f'), K('0')), 'ratio', { guards: [{ when: { g: '0' }, raise: 'OUT-0001' }] });
  assert.equal(checkFormula(guarded, opts())[0].reason, 'zero_constant', 'a guard never protects a constant zero');
});

test('E-0032 (4): a guard on the bare-ref divisor that is true at zero protects it (and raises at evaluation)', () => {
  const division = op('divide', R('f'), R('g'));
  const guard = (when) => FX(division, 'ratio', { guards: [{ when, raise: 'OUT-0001' }] });
  const protecting = [{ g: '0' }, { 'DE.g': { eq: '0.00' } }, { g: { in: ['1', '0'] } }, { g: { lte: '0' } }, { g: { gte: '-1' } }, { g: { between: ['-1', '1'] } }, { g: { lt: '1' } }, { g: { ne: '5' } },
    { g: { not_in: ['5'] } }, { g: { is_null: false } }, { any: [{ g: { is_null: true } }, { g: { eq: '0' } }] }, { any: [{ g: { eq: '0' } }, { g: { eq: '1' } }] },
    { all: [{ g: { eq: '0' } }] }, { not: { g: { ne: '0' } } }, { all: [{ g: { lte: '0' } }, { g: { gte: '0' } }] }];
  for (const when of protecting) assert.deepEqual(checkFormula(guard(when), opts()), [], JSON.stringify(when));
  const unprotecting = [{ g: '1' }, { g: { gt: '0' } }, { g: { lt: '0' } }, { g: { ne: '0' } }, { g: { lte: '-1' } }, { g: { gte: '1' } }, { g: { between: ['1', '5'] } }, { g: { not_in: ['0'] } },
    { g: { is_null: true } }, { any: [{ g: { is_null: true } }, { g: { ne: '0' } }] }, { f: { eq: '0' } }, { g: { eq: '0' }, f: { gt: '0' } }, { any: [{ g: { eq: '0' } }, { f: { gt: '0' } }] }];
  for (const when of unprotecting) {
    const found = checkFormula(guard(when), opts());
    assert.equal(found.length, 1, JSON.stringify(when));
    assert.equal(found[0].code, 'KF-E-313');
    assert.equal(found[0].reason, 'unprotected');
    assert.equal(found[0].input, 'DE.g');
  }
  const run = (values) => evaluateFormula(guard({ g: '0' }), values, opts());
  assert.deepEqual(run({ 'DE.f': '2', 'DE.g': '0.000' }), { status: 'raised', value: null, outcome: 'OUT-0001', guard_index: 0, diagnostics: [] });
  assert.equal(run({ 'DE.f': '2', 'DE.g': '4' }).value.value, '0.5');
  assert.equal(run({ 'DE.f': '2' }).value, null);
});

test('E-0036 (2): an if condition protects the then branch when false at zero and the else branch when true at zero', () => {
  const division = op('divide', R('f'), R('g'));
  const thenOk = [{ g: { ne: '0' } }, { g: { gt: '0' } }, { g: { lt: '0' } }, { g: { not_in: ['0', '1'] } }, { g: { gt: '1' } }, { g: { eq: '1' } }, { g: { is_null: true } }];
  for (const cond of thenOk) assert.deepEqual(checkFormula(FX(iff(cond, division, K('0'))), opts()), [], `then ${JSON.stringify(cond)}`);
  const elseOk = [{ g: { eq: '0' } }, { g: { lte: '0' } }, { g: { gte: '0' } }, { g: { in: ['0'] } }, { g: { lt: '1' } }, { any: [{ g: { is_null: true } }, { g: { eq: '0' } }] }];
  for (const cond of elseOk) assert.deepEqual(checkFormula(FX(iff(cond, K('0'), division)), opts()), [], `else ${JSON.stringify(cond)}`);
  for (const cond of [{ g: { eq: '0' } }, { g: { gt: '-1' } }, { f: { ne: '0' } }, { g: { ne: '0' }, b: true }]) {
    assert.deepEqual(checkCodes(FX(iff(cond, division, K('0')))), ['KF-E-313@/expression/then'], `wrong then ${JSON.stringify(cond)}`);
  }
  for (const cond of [{ g: { ne: '0' } }, { g: { gt: '0' } }]) {
    assert.deepEqual(checkCodes(FX(iff(cond, K('0'), division))), ['KF-E-313@/expression/else'], `wrong else ${JSON.stringify(cond)}`);
  }
  assert.deepEqual(checkFormula(FX(iff({ g: { ne: '0' } }, op('add', K('1'), op('multiply', R('f'), op('divide', R('f'), R('g')))), K('0'))), opts()), [], 'deep inside the branch');
  assert.deepEqual(checkFormula(FX(iff({ g: { ne: '0' } }, iff({ b: true }, division, K('1')), K('0'))), opts()), [], 'nested if');
  const lazy = FX(iff({ g: { ne: '0' } }, division, K('0')));
  assert.equal(valueOf(lazy, { 'DE.f': '2', 'DE.g': '0' }), '0');
  assert.equal(valueOf(lazy, { 'DE.f': '2', 'DE.g': '4' }), '0.5');
  assert.equal(valueOf(lazy, { 'DE.f': '2' }), '0', 'a null condition is false');
});

test('E-0032 (4): compound divisors and divisors of another field are unprotected; each division is judged alone', () => {
  const guards = [{ when: { g: '0' }, raise: 'OUT-0001' }];
  for (const divisor of [op('subtract', K('1'), R('g')), op('abs', R('g')), op('max', R('g'), K('1')), op('multiply', R('g'), K('2')), iff({ b: true }, R('g'), K('1')), op('add', K('1'), K('1'))]) {
    const [finding, ...rest] = checkFormula(FX(op('divide', R('f'), divisor), 'ratio', { guards }), opts());
    assert.equal(rest.length, 0);
    assert.equal(finding.code, 'KF-E-313');
    assert.equal(finding.input, null);
  }
  const two = op('add', op('divide', R('f'), R('g')), op('divide', R('g'), R('f')));
  assert.deepEqual(checkCodes(FX(two, 'ratio', { guards })), ['KF-E-313@/expression/args/1']);
  assert.deepEqual(checkCodes(FX(two)), ['KF-E-313@/expression/args/0', 'KF-E-313@/expression/args/1']);
  assert.deepEqual(checkCodes(FX(two, 'ratio', { guards: [...guards, { when: { f: '0' }, raise: 'OUT-0002' }] })), []);
  const dividedDivisor = op('divide', R('f'), op('divide', R('g'), R('f')));
  assert.deepEqual(checkCodes(FX(dividedDivisor, 'ratio', { guards })), ['KF-E-313@/expression', 'KF-E-313@/expression/args/1'], 'a division is a compound divisor, and the inner division (by f) is judged on its own');
});

test('E-0032 (4): a quantity divisor is protected by the zero quantity in its own unit', () => {
  const division = FX(op('divide', R('c'), R('h')));
  const guard = (when) => ({ ...division, guards: [{ when, raise: 'OUT-0001' }] });
  assert.deepEqual(checkFormula(guard({ h: { eq: Q('0') } }), opts()), []);
  assert.deepEqual(checkFormula(guard({ h: { lte: Q('0') } }), opts()), []);
  assert.deepEqual(checkFormula(guard({ h: { between: [Q('-1'), Q('1')] } }), opts()), []);
  assert.deepEqual(checkCodes(guard({ h: { gt: Q('0') } })), ['KF-E-313@/expression']);
  assert.deepEqual(checkCodes(guard({ h: { eq: Q('0', 'ppm_mass') } })), ['KF-E-310@/guards/0/when/h/eq', 'KF-E-313@/expression']);
  const result = evaluateFormula(guard({ h: { eq: Q('0') } }), { 'DE.c': Q('5'), 'DE.h': Q('2') }, opts());
  assert.equal(result.value.value, '2.5');
  assert.equal(evaluateFormula(guard({ h: { eq: Q('0') } }), { 'DE.c': Q('5'), 'DE.h': Q('0.0') }, opts()).status, 'raised');
});

test('E-0032 (5): static findings block evaluation; a zero divisor is never reached; findings precede value binding', () => {
  const unprotected = FX(op('divide', R('f'), R('g')));
  for (const values of [{ 'DE.f': '1', 'DE.g': '2' }, { 'DE.f': '1', 'DE.g': '0' }, { 'DE.f': 0.1 }]) {
    const result = evaluateFormula(unprotected, values, opts());
    assert.equal(result.status, 'error');
    assert.equal(result.value, null);
    assert.equal(result.outcome, null);
    assert.equal(result.guard_index, null);
    assert.deepEqual(result.diagnostics, checkFormula(unprotected, opts()));
  }
  assert.equal(evaluateFormula(FX(op('divide', R('f'), K('0'))), {}, opts()).diagnostics[0].reason, 'zero_constant');
});

test('§11.2 l.589: a unit different from the expected one is KF-E-310, by unit id and never by dimension', () => {
  for (const name of ['add', 'subtract', 'min', 'max']) {
    assert.deepEqual(checkCodes(FX(op(name, R('c'), R('p')), 'percent_mass')), ['KF-E-310@/expression/args/1'], `${name}: convertible pair`);
    assert.deepEqual(checkCodes(FX(op(name, R('c'), R('h')), 'percent_mass')), [], `${name}: same unit id`);
    assert.deepEqual(checkCodes(FX(op(name, R('c'), R('f')), 'percent_mass')), ['KF-E-310@/expression/args/1']);
    assert.deepEqual(checkCodes(FX(op(name, R('c'), K('1')), 'percent_mass')), ['KF-E-310@/expression/args/1']);
  }
  const [finding] = checkFormula(FX(op('add', R('c'), R('p')), 'percent_mass'), opts());
  assert.deepEqual([finding.expected_unit, finding.found_unit, finding.source, finding.rule, finding.rule_index], ['percent_mass', 'ppm_mass', 'expression', null, null]);
  assert.deepEqual(checkCodes(FX(op('add', R('c'), R('p'), R('c'), R('p')), 'percent_mass')), ['KF-E-310@/expression/args/1', 'KF-E-310@/expression/args/3'], 'one per offender');
  assert.deepEqual(checkCodes(FX(op('clamp', R('c'), R('p'), R('p')), 'percent_mass')), ['KF-E-310@/expression/args/1', 'KF-E-310@/expression/args/2']);
  assert.deepEqual(checkCodes(FX(iff({ b: true }, R('c'), R('p')), 'percent_mass')), ['KF-E-310@/expression/else']);
});

test('§11.2 l.591: percent_* variants and look-alike units are never interchangeable; bare percent has no built-in meaning', () => {
  assert.deepEqual(checkCodes(FX(R('c'), 'ppm_mass')), ['KF-E-310@/output/unit']);
  assert.deepEqual(checkCodes(FX(R('c'), 'percent_volume')), ['KF-E-310@/output/unit']);
  assert.deepEqual(checkCodes(FX(op('add', K('1', 'ratio'), K('1', 'look_alike')), 'ratio')), ['KF-E-310@/expression/args/1'], 'two dimensionless units differ by id');
  assert.equal(code(() => checkFormula(FX(R('f'), 'percent'), opts())), 'UNKNOWN_UNIT');
  assert.equal(code(() => checkFormula(FX(K('1', 'percent')), opts())), 'UNKNOWN_UNIT');
});

test('§11.2 l.593-599: units come from the units.yaml shape; a unit the registry lacks is UNKNOWN_UNIT', () => {
  assert.equal(code(() => checkFormula(FX(K('1', 'furlong')), opts())), 'UNKNOWN_UNIT');
  assert.equal(code(() => checkFormula(FX(R('f'), 'furlong'), opts())), 'UNKNOWN_UNIT');
  assert.equal(code(() => checkFormula(FX(K('1')), opts({ inputs: [{ ref: 'DE.z', type: 'quantity', unit: 'furlong' }] }))), 'UNKNOWN_UNIT');
  assert.equal(code(() => checkFormula({ ...FX(R('f')), guards: [{ when: { c: { gt: Q('1', 'furlong') } }, raise: 'OUT-0001' }] }, opts())), 'UNKNOWN_UNIT');
  assert.equal(code(() => checkFormula(FX(R('f')), { unitRegistry: { has: () => true, units: [] }, inputs: INPUTS })), 'INVALID_ARGUMENT');
  assert.equal(code(() => checkFormula(FX(R('f')), { unitRegistry: { units: [{ id: 'ratio', dimension: 'dimensionless', symbol: '1' }], conversions: [] }, inputs: INPUTS })), 'INVALID_ARGUMENT');
});

test('§11.2 l.602: no conversion is ever inferred; a product has no unit even if the registry names its dimension', () => {
  assert.deepEqual(checkCodes(FX(op('multiply', R('c'), R('c')), 'percent_mass')), ['KF-E-316@/expression']);
  assert.deepEqual(checkCodes(FX(op('multiply', R('c'), R('c')), 'percent_mass_squared')), ['KF-E-316@/expression'], 'not looked up by name or dimension');
  assert.deepEqual(checkCodes(FX(op('multiply', R('c'), R('p')), 'percent_mass')), ['KF-E-316@/expression'], 'same dimension, still no unit');
});

test('§11.3 l.606-607: null is absent, never zero; every comparison with null is false except is_null', () => {
  const none = {};
  assert.equal(valueOf(FX(op('add', R('f'), R('g'))), { 'DE.f': '5' }), null);
  assert.equal(valueOf(FX(op('multiply', R('f'), R('g'))), { 'DE.f': '5' }), null, 'not 0');
  assert.equal(valueOf(FX(op('min', R('f'), R('g'))), { 'DE.f': '5' }), null, 'not the other operand');
  assert.equal(valueOf(FX(op('multiply', R('f'), R('g'))), { 'DE.f': '5', 'DE.g': '0' }), '0');
  assert.equal(valueOf(FX(op('divide', K('1'), R('g')), 'ratio', { guards: [{ when: { g: '0' }, raise: 'OUT-0001' }] }), none), null);
  assert.equal(valueOf(FX(op('clamp', K('0.5'), R('f'), K('1'))), none), null);
  assert.equal(valueOf(FX(op('abs', R('f'))), { 'DE.f': null }), null);
  assert.equal(valueOf(FX(R('f'), 'ratio', { rounding: { mode: 'down', decimals: 2 } }), none), null);
  const guarded = (when) => evaluateFormula(FX(K('1'), 'ratio', { guards: [{ when, raise: 'OUT-0001' }] }), none, opts()).status;
  for (const when of [{ f: { eq: '0' } }, { f: { ne: '1' } }, { f: { lt: '5' } }, { f: { lte: '0' } }, { f: { not_in: ['1'] } }, { f: { in: ['1'] } }, { f: { between: ['0', '1'] } }, { e: 'X' }, { s: { matches: '' } }]) {
    assert.equal(guarded(when), 'ok', JSON.stringify(when));
  }
  for (const when of [{ f: { is_null: true } }, { not: { f: { eq: '1' } } }, { not: { b: true } }]) assert.equal(guarded(when), 'raised', JSON.stringify(when));
  assert.equal(valueOf(FX(iff({ f: { gt: '0' } }, K('1'), K('2'))), none), '2', 'a null condition runs else');
});

test('§11.3 l.608: an out-of-domain enum literal or supplied value is KF-E-314', () => {
  const guard = (when) => ({ ...FX(R('f')), guards: [{ when, raise: 'OUT-0001' }] });
  assert.deepEqual(checkCodes(guard({ e: 'W' })), ['KF-E-314@/guards/0/when/e']);
  assert.deepEqual(checkCodes(guard({ e: { in: ['X', 'W'] } })), ['KF-E-314@/guards/0/when/e/in/1']);
  assert.deepEqual(checkCodes(FX(iff({ e: 'W' }, R('f'), R('g')))), ['KF-E-314@/expression/cond/e']);
  assert.deepEqual(checkCodes(guard({ e: 'X' })), []);
  const result = evaluateFormula(FX(R('f')), { 'DE.f': '1', 'DE.e': 'W' }, opts());
  assert.equal(result.status, 'error');
  assert.deepEqual(result.diagnostics.map((d) => [d.code, d.pointer, d.input, d.value, d.source]), [['KF-E-314', '/inputs/5', 'DE.e', 'W', 'value']]);
  assert.equal(evaluateFormula(FX(R('f')), { 'DE.f': '1', 'DE.e': null }, opts()).status, 'ok');
});

test('§11.4 l.612: matches follows the RE2 subset; an uncompilable pattern is KF-E-315 with the pattern pointer', () => {
  const guard = (pattern) => ({ ...FX(R('f')), guards: [{ when: { s: { matches: pattern } }, raise: 'OUT-0001' }] });
  const [finding] = checkFormula(guard('(a)\\1'), opts());
  assert.deepEqual([finding.code, finding.pointer, finding.pattern, typeof finding.reason], ['KF-E-315', '/guards/0/when/s/matches', '(a)\\1', 'string']);
  assert.deepEqual(checkCodes(guard('(?=a)')), ['KF-E-315@/guards/0/when/s/matches']);
  assert.deepEqual(checkCodes(guard('^(a|b)+$')), []);
  assert.deepEqual(checkCodes(FX(iff({ s: { matches: '(' } }, R('f'), R('g')))), ['KF-E-315@/expression/cond/s/matches']);
  assert.equal(evaluateFormula(guard('^AB[0-9]+$'), { 'DE.f': '1', 'DE.s': 'AB12' }, opts()).status, 'raised');
  assert.equal(evaluateFormula(guard('^AB[0-9]+$'), { 'DE.f': '1', 'DE.s': 'xAB12' }, opts()).status, 'ok');
});

test('§12 l.616: logic.kind other than formula is INVALID_EXPRESSION', () => {
  for (const kind of ['decision-table', 'state-machine', 'narrative', 'Formula', undefined, null, 5]) {
    const logic = FX(R('f'));
    if (kind === undefined) delete logic.kind;
    else logic.kind = kind;
    assert.equal(code(() => checkFormula(logic, opts())), 'INVALID_EXPRESSION', String(kind));
    assert.equal(code(() => evaluateFormula(logic, {}, opts())), 'INVALID_EXPRESSION');
  }
  for (const logic of [null, undefined, [], 'formula', 5, [FX(R('f'))]]) assert.equal(code(() => checkFormula(logic, opts())), 'INVALID_EXPRESSION');
});

test('§12.2 l.638: an expression is a structured tree; strings, unknown operators and malformed nodes are INVALID_EXPRESSION', () => {
  const bad = ['DE.f + DE.g', undefined, null, 5, [], {}, { op: 'pow', args: [R('f')] }, { op: 'ADD', args: [R('f')] }, { op: '', args: [R('f')] }, { op: 'sum', args: [R('f')] },
    { op: 'add' }, { op: 'add', args: 'x' }, { op: 'add', args: [] }, { op: 'add', args: [R('f'), 1] }, { op: 'add', args: [R('f'), null] }, { op: 'add', args: [R('f'), 'x'] }, { op: 'add', args: [R('f'), []] },
    { ref: 'DE.f', const: '1' }, { ref: '' }, { ref: 5 }, { ref: 'DE.f', extra: 1 }, { const: '1', op: 'add', args: [R('f')] }, { const: '1', extra: 1 }, { const: '1', unit: 5 }, { op: 'add', args: [R('f')], extra: 1 },
    { op: 'constructor', args: [R('f')] }, { op: '__proto__', args: [R('f')] },
    { op: 'if', cond: { b: true }, then: R('f') }, { op: 'if', cond: { b: true }, else: R('f') }, { op: 'if', then: R('f'), else: R('g') }, { op: 'if', cond: 'b', then: R('f'), else: R('g') },
    { op: 'if', cond: { b: true }, then: R('f'), else: R('g'), args: [] }, { op: 'if', args: [] }];
  for (const expression of bad) {
    const logic = FX(R('f'));
    if (expression === undefined) delete logic.expression;
    else logic.expression = expression;
    assert.equal(code(() => checkFormula(logic, opts())), 'INVALID_EXPRESSION', JSON.stringify(expression));
    assert.equal(code(() => evaluateFormula(logic, {}, opts())), 'INVALID_EXPRESSION');
  }
});

test('§12.2 l.656 / E-0033: operator arities (subtract and divide 2; add, multiply, min, max one or more; abs and round 1; clamp 3)', () => {
  const arities = { add: [1, 3], subtract: [2, 2], multiply: [1, 3], divide: [2, 2], min: [1, 3], max: [1, 3], abs: [1, 1], clamp: [3, 3] };
  for (const [name, [least, most]] of Object.entries(arities)) {
    for (let count = 0; count <= 5; count += 1) {
      const logic = FX({ op: name, args: Array.from({ length: count }, () => K('2')) });
      const accepted = count >= least && count <= (name === 'add' || name === 'multiply' || name === 'min' || name === 'max' ? 5 : most);
      assert.equal(code(() => checkFormula(logic, opts())), accepted ? 'NO_THROW' : 'INVALID_EXPRESSION', `${name}/${count}`);
    }
  }
  for (const count of [0, 2]) assert.equal(code(() => checkFormula(FX({ op: 'round', args: Array.from({ length: count }, () => K('2')) }, 'ratio', { rounding: { mode: 'up', decimals: 1 } }), opts())), 'INVALID_EXPRESSION');
  assert.equal(valueOf(FX(op('add', K('1')))), '1');
  assert.equal(valueOf(FX(op('add', K('1'), K('2'), K('3'), K('4')))), '10');
  assert.equal(valueOf(FX(op('subtract', op('multiply', K('2'), K('3'), K('4')), K('1')))), '23');
});

test('§12.2 l.641-652: the worked example loaded from the frozen spec checks clean and evaluates end to end', async () => {
  const lines = (await fs.readFile(path.join(ROOT, 'knowledge-framework-spec-v2.1.md'), 'utf8')).split(/\r?\n/);
  assert.match(lines[639], /^```/, 'l.640 opens the fence');
  assert.equal(lines[652], '```', 'l.653 closes the fence');
  const logic = YAML.parse(lines.slice(640, 652).join('\n')).logic;
  const o = opts({ inputs: [{ ref: 'DE-0017.concentration', type: 'quantity', unit: 'percent_mass' }, { ref: 'DE-0017.loss_factor', type: 'decimal' }] });
  assert.deepEqual(checkFormula(logic, o), []);
  const run = (values) => evaluateFormula(logic, values, o);
  const c = Q('4.2');
  assert.deepEqual(run({ 'DE-0017.concentration': c, 'DE-0017.loss_factor': '0.1' }).value, { value: '3.7800', unit: 'percent_mass' });
  assert.deepEqual(run({ concentration: c, loss_factor: '0.05' }).value, { value: '3.9900', unit: 'percent_mass' }, 'binding by suffix');
  assert.equal(run({ concentration: c, loss_factor: '-1' }).value.value, '8.4000');
  assert.equal(run({ concentration: c, loss_factor: '0.99995' }).value.value, '0.0002');
  assert.deepEqual(run({ concentration: c, loss_factor: '1' }), { status: 'raised', value: null, outcome: 'OUT-0011', guard_index: 0, diagnostics: [] });
  assert.equal(run({ loss_factor: '1000000' }).status, 'raised', 'the guard precedes the expression and needs no concentration');
  assert.equal(run({ concentration: c }).value, null);
  assert.equal(run({}).value, null);
  assert.equal(run({ concentration: Q('4.2', 'ppm_mass'), loss_factor: '2' }).status, 'error', 'values are validated before the guards');
  assert.deepEqual(checkFormula({ ...logic, expression: { ...logic.expression, op: 'add' } }, o).map((d) => d.pointer), ['/expression/args/1']);
  assert.deepEqual(checkFormula({ ...logic, output: { ...logic.output, unit: 'ppm_mass' } }, o).map((d) => d.pointer), ['/output/unit']);
  const unrounded = { kind: logic.kind, output: logic.output, expression: logic.expression, guards: logic.guards };
  assert.equal(evaluateFormula(unrounded, { concentration: c, loss_factor: '0.1' }, o).value.value, '3.78');
});

test('§12.2 l.660: the result of add, subtract, min, max, clamp and if keeps the unit of its operands', () => {
  for (const name of ['add', 'subtract', 'min', 'max']) {
    assert.deepEqual(checkFormula(FX(op(name, R('c'), R('h')), 'percent_mass'), opts()), []);
    assert.deepEqual(checkCodes(FX(op(name, R('c'), R('h')), 'ppm_mass')), ['KF-E-310@/output/unit']);
  }
  assert.deepEqual(checkFormula(FX(op('abs', R('c')), 'percent_mass'), opts()), []);
  assert.deepEqual(checkCodes(FX(op('abs', R('c')), 'ppm_mass')), ['KF-E-310@/output/unit']);
  assert.deepEqual(checkFormula(FX(iff({ b: true }, R('c'), R('h')), 'percent_mass'), opts()), []);
  assert.deepEqual(checkFormula(FX(op('clamp', R('c'), R('h'), R('h')), 'percent_mass'), opts()), []);
  assert.equal(valueOf(FX(op('max', R('c'), K('5', 'percent_mass')), 'percent_mass'), { 'DE.c': Q('4.2') }), '5');
});

test('§12.2 l.661-662: multiply and divide combine units; a result that is neither dimensionless nor one registered unit is KF-E-316', () => {
  const clean = [op('multiply', R('c'), R('f')), op('multiply', R('f'), R('c')), op('divide', R('c'), K('2')), op('multiply', op('divide', R('c'), K('2', 'percent_mass')), R('c')), iff({ b: true }, op('multiply', R('c'), R('f')), R('c'))];
  for (const expression of clean) assert.deepEqual(checkFormula(FX(expression, 'percent_mass'), opts()), [], JSON.stringify(expression));
  assert.deepEqual(checkFormula(FX(op('divide', R('c'), K('2', 'percent_mass')), 'ratio'), opts()), [], 'units cancel');
  assert.deepEqual(checkFormula(FX(op('multiply', K('2', 'ratio'), R('f')), 'ratio'), opts()), [], '{ratio: 1} is one registered unit');
  const texts = [
    [op('multiply', R('c'), R('c')), 'multiply', 'percent_mass^2'], [op('multiply', R('c'), R('p')), 'multiply', 'percent_mass*ppm_mass'],
    [op('divide', R('c'), K('2', 'ppm_mass')), 'divide', 'percent_mass*ppm_mass^-1'], [op('divide', K('1'), K('2', 'percent_mass')), 'divide', 'percent_mass^-1'],
    [op('multiply', K('2', 'ratio'), K('2', 'ratio')), 'multiply', 'ratio^2'],
  ];
  for (const [expression, operation, unit] of texts) {
    const [finding, ...rest] = checkFormula(FX(expression, 'percent_mass'), opts());
    assert.equal(rest.length, 0);
    assert.deepEqual([finding.code, finding.pointer, finding.operation, finding.unit, finding.rule, finding.rule_index], ['KF-E-316', '/expression', operation, unit, null, null]);
    assert.ok(!('remediation' in finding));
  }
  assert.deepEqual(checkCodes(FX(op('multiply', op('multiply', R('c'), R('f')), R('c')), 'percent_mass')), ['KF-E-316@/expression'], 'the inner node is admissible');
});

test('§12.2 l.662: a const without unit is dimensionless; a const with a registered unit carries it', () => {
  assert.deepEqual(checkCodes(FX(op('add', R('c'), K('1')), 'percent_mass')), ['KF-E-310@/expression/args/1']);
  assert.deepEqual(checkFormula(FX(op('add', R('c'), K('1', 'percent_mass')), 'percent_mass'), opts()), []);
  assert.deepEqual(checkCodes(FX(op('add', K('1', 'ratio'), R('f')), 'ratio')), ['KF-E-310@/expression/args/1'], '{ratio: 1} differs from {}');
  assert.deepEqual(checkFormula(FX(op('subtract', K('1'), R('f')), 'ratio'), opts()), []);
});

test('§12.2 l.663: the computed unit must equal output.unit; a dimensionless value needs a registered dimensionless unit', () => {
  const unit = (logic, o = opts()) => checkFormula(logic, o).map((d) => [d.pointer, d.expected_unit, d.found_unit, d.source]);
  assert.deepEqual(unit(FX(R('c'), 'percent_mass')), []);
  assert.deepEqual(unit(FX(R('c'), 'ppm_mass')), [['/output/unit', 'ppm_mass', 'percent_mass', 'output']]);
  assert.deepEqual(unit(FX(R('c'), 'ratio')), [['/output/unit', 'ratio', 'percent_mass', 'output']]);
  assert.deepEqual(unit(FX(op('multiply', R('f'), R('g')), 'ratio')), []);
  assert.deepEqual(unit(FX(op('multiply', R('f'), R('g')), 'look_alike')), [], 'any registered unit whose dimension is dimensionless');
  assert.deepEqual(unit(FX(op('multiply', R('f'), R('g')), 'percent_mass')), [['/output/unit', 'percent_mass', null, 'output']]);
  assert.deepEqual(unit(FX(op('multiply', R('f'), R('g')), 'kg')), [['/output/unit', 'kg', null, 'output']]);
  assert.deepEqual(unit(FX(op('multiply', K('2', 'ratio'), R('f')), 'look_alike')), [['/output/unit', 'look_alike', 'ratio', 'output']]);
  const bare = { unitRegistry: REGISTRY_NO_DIMENSIONLESS, inputs: [{ ref: 'DE.f', type: 'decimal' }, { ref: 'DE.g', type: 'decimal' }] };
  assert.deepEqual(unit(FX(op('multiply', R('f'), R('g')), 'percent_mass'), bare), [['/output/unit', 'percent_mass', null, 'output']]);
  assert.equal(code(() => checkFormula(FX(op('multiply', R('f'), R('g')), 'ratio'), bare)), 'UNKNOWN_UNIT');
  assert.deepEqual(unit(FX(op('multiply', R('f'), R('g')), 'ratio'), opts({ inputs: [{ ref: 'DE.f', type: 'decimal' }, { ref: 'DE.g', type: 'decimal' }] })), []);
});

test('E-0036 (1) / E-0037 (2): a KF-E-316 node has an unknown unit: one finding per defect, no cascade', () => {
  const squared = op('multiply', R('c'), R('c'));
  const cases = [
    [FX(squared, 'ratio'), ['KF-E-316@/expression']],
    [FX(op('multiply', squared, R('c')), 'percent_mass'), ['KF-E-316@/expression/args/0']],
    [FX(op('divide', squared, K('2', 'percent_mass')), 'ratio'), ['KF-E-316@/expression/args/0']],
    [FX(op('add', R('c'), squared), 'percent_mass'), ['KF-E-316@/expression/args/1']],
    [FX(op('abs', squared), 'percent_mass'), ['KF-E-316@/expression/args/0']],
    [FX(op('add', squared, squared), 'ratio'), ['KF-E-316@/expression/args/0', 'KF-E-316@/expression/args/1']],
    [FX(op('add', squared, R('p'), R('c')), 'ppm_mass'), ['KF-E-310@/expression/args/2', 'KF-E-316@/expression/args/0']],
    [FX(op('add', R('c'), squared, R('p')), 'percent_mass'), ['KF-E-310@/expression/args/2', 'KF-E-316@/expression/args/1']],
    [FX(iff({ b: true }, squared, R('c')), 'percent_mass'), ['KF-E-316@/expression/then']],
    [FX(iff({ b: true }, R('c'), squared), 'percent_mass'), ['KF-E-316@/expression/else']],
    [FX(iff({ b: true }, squared, squared), 'kg'), ['KF-E-316@/expression/else', 'KF-E-316@/expression/then']],
    [FX(op('add', R('c'), op('multiply', R('c'), R('f'))), 'percent_mass'), []],
  ];
  for (const [logic, expected] of cases) assert.deepEqual(checkCodes(logic), expected, JSON.stringify(logic.expression));
});

test('§12.2 l.656: if is lazy, selects by the condition, and both branches are checked statically', () => {
  const lazy = FX(iff({ b: true }, R('f'), op('clamp', R('f'), K('1'), K('0'))));
  assert.equal(valueOf(lazy, { 'DE.b': true, 'DE.f': '0.5' }), '0.5');
  assert.equal(code(() => evaluateFormula(lazy, { 'DE.b': false, 'DE.f': '0.5' }, opts())), 'INVALID_RANGE');
  assert.equal(code(() => evaluateFormula(lazy, { 'DE.f': '0.5' }, opts())), 'INVALID_RANGE', 'a null condition runs else');
  assert.equal(valueOf(FX(iff({ e: 'X' }, R('f'), R('g'))), { 'DE.e': 'X', 'DE.f': '1', 'DE.g': '2' }), '1');
  assert.equal(valueOf(FX(iff({ e: 'X' }, R('f'), R('g'))), { 'DE.e': 'Y', 'DE.f': '1', 'DE.g': '2' }), '2');
  assert.equal(valueOf(FX(iff({ b: true }, R('f'), R('g'))), { 'DE.b': true }), null, 'a selected null branch is null');
  const wrongUnselected = FX(iff({ b: true }, R('c'), R('f')), 'percent_mass');
  const result = evaluateFormula(wrongUnselected, { 'DE.b': true, 'DE.c': Q('1') }, opts());
  assert.equal(result.status, 'error');
  assert.deepEqual(result.diagnostics.map((d) => d.pointer), ['/expression/else']);
  assert.equal(code(() => checkFormula(FX({ op: 'if', cond: {}, then: R('f'), else: R('g') }), opts())), 'EMPTY_PREDICATE');
  assert.equal(code(() => checkFormula(FX(iff({ nope: 'X' }, R('f'), R('g'))), opts())), 'UNBOUND_FIELD');
});

test('§12.1 l.621-629: guards and conditions accept the whole predicate grammar with the P011 semantics', () => {
  const raises = (when, values) => evaluateFormula({ ...FX(K('1')), guards: [{ when, raise: 'OUT-0001' }] }, values, opts()).status === 'raised';
  assert.equal(raises({ e: 'X' }, { 'DE.e': 'X' }), true);
  assert.equal(raises({ e: { in: ['X', 'Y'] } }, { 'DE.e': 'Z' }), false);
  assert.equal(raises({ c: { between: [Q('1'), Q('2')] } }, { 'DE.c': Q('2') }), true);
  assert.equal(raises({ f: { in: ['1', '2.0'] } }, { 'DE.f': '2' }), true);
  assert.equal(raises({ all: [{ e: 'X' }, { f: { gt: '0' } }] }, { 'DE.e': 'X', 'DE.f': '1' }), true);
  assert.equal(raises({ any: [{ e: 'X' }, { f: { gt: '0' } }] }, { 'DE.e': 'Y', 'DE.f': '0' }), false);
  assert.equal(raises({ e: 'X', f: { gt: '0' } }, { 'DE.e': 'X', 'DE.f': '0' }), false, 'two keys are a conjunction');
  for (const empty of [{}, { all: [] }, { any: [] }, { not: {} }, { all: [{}] }]) {
    assert.equal(code(() => checkFormula({ ...FX(K('1')), guards: [{ when: empty, raise: 'OUT-0001' }] }, opts())), 'EMPTY_PREDICATE', JSON.stringify(empty));
  }
  assert.equal(code(() => checkFormula({ ...FX(K('1')), guards: [{ when: { f: { between: ['5', '1'] } }, raise: 'OUT-0001' }] }, opts())), 'INVALID_RANGE');
  assert.equal(code(() => checkFormula({ ...FX(K('1')), guards: [{ when: { e: { lt: 'X' } }, raise: 'OUT-0001' }] }, opts())), 'TYPE_MISMATCH');
  assert.equal(code(() => checkFormula({ ...FX(K('1')), guards: [{ when: 'f', raise: 'OUT-0001' }] }, opts())), 'INVALID_EXPRESSION');
});

test('E-0031 (2): guards run in document order before the expression; raise is checked only against ^OUT-[0-9]{4,}$', () => {
  const guards = [{ when: { f: { gte: '2' } }, raise: 'OUT-0012' }, { when: { f: { gte: '1' } }, raise: 'OUT-0011' }];
  const run = (f) => evaluateFormula(FX(op('clamp', R('f'), K('1'), K('0')), 'ratio', { guards }), { 'DE.f': f }, opts());
  assert.deepEqual(run('3'), { status: 'raised', value: null, outcome: 'OUT-0012', guard_index: 0, diagnostics: [] });
  assert.deepEqual(run('1.5'), { status: 'raised', value: null, outcome: 'OUT-0011', guard_index: 1, diagnostics: [] });
  assert.equal(code(() => run('0.5')), 'INVALID_RANGE', 'no guard is true: the expression runs');
  for (const raise of ['OUT-0011', 'OUT-123456', 'OUT-9999']) assert.deepEqual(checkFormula({ ...FX(R('f')), guards: [{ when: { f: '1' }, raise }] }, opts()), [], raise);
  for (const raise of ['OUT-11', 'out-0011', 'OUT-0011 ', 'OUT-0011\n', ' OUT-0011', 'OUT-00a1', 'OUT-٣٣٣٣', 'OUT-', '', 5, null, undefined, {}]) {
    assert.equal(code(() => checkFormula({ ...FX(R('f')), guards: [{ when: { f: '1' }, raise }] }, opts())), 'INVALID_EXPRESSION', JSON.stringify(raise));
  }
  for (const guard of [{ when: { f: '1' } }, { raise: 'OUT-0011' }, { when: { f: '1' }, raise: 'OUT-0011', extra: 1 }, 'x', null]) {
    assert.equal(code(() => checkFormula({ ...FX(R('f')), guards: [guard] }, opts())), 'INVALID_EXPRESSION');
  }
  assert.equal(code(() => checkFormula({ ...FX(R('f')), guards: {} }, opts())), 'INVALID_EXPRESSION');
  assert.deepEqual(evaluateFormula({ ...FX(R('f')), guards: [] }, { 'DE.f': '4' }, opts()).value, { value: '4', unit: 'ratio' });
});

test('E-0031 (1): refs bind by full ref or suffix; only quantity and decimal inputs are operands', () => {
  assert.equal(valueOf(FX({ ref: 'f' }), { f: '0.1' }), '0.1');
  assert.equal(valueOf(FX({ ref: 'f' }), { 'DE.f': '0.1' }), '0.1');
  assert.equal(code(() => checkFormula(FX({ ref: 'DE.nope' }), opts())), 'UNBOUND_FIELD');
  assert.equal(code(() => evaluateFormula(FX(R('f')), { 'DE.f': '1', nope: '1' }, opts())), 'UNBOUND_FIELD');
  assert.equal(code(() => evaluateFormula(FX(R('f')), { f: '1', 'DE.f': '1' }, opts())), 'AMBIGUOUS_FIELD');
  const twin = [{ ref: 'A.x', type: 'decimal' }, { ref: 'B.x', type: 'decimal' }];
  assert.equal(code(() => checkFormula(FX({ ref: 'x' }), opts({ inputs: twin }))), 'AMBIGUOUS_FIELD');
  assert.equal(valueOf(FX({ ref: 'A.x' }), { 'A.x': '1', 'B.x': '2' }, { inputs: twin }), '1');
  assert.equal(code(() => checkFormula(FX({ ref: 'x' }), opts({ inputs: [{ ref: 'x', type: 'decimal' }, { ref: 'A.x', type: 'decimal' }] }))), 'AMBIGUOUS_FIELD', 'E-0027 (2)');
  for (const name of ['e', 's', 'b']) {
    for (const expression of [R(name), op('add', R('f'), R(name)), iff({ b: true }, R('f'), R(name))]) assert.equal(code(() => checkFormula(FX(expression), opts())), 'TYPE_MISMATCH', name);
  }
  assert.equal(code(() => checkFormula(FX(R('f')), opts({ inputs: [{ ref: 'DE.f', type: 'date' }] }))), 'UNSUPPORTED_INPUT_TYPE');
  assert.equal(code(() => checkFormula(FX(R('f')), opts({ inputs: [{ ref: 'DE.f', type: 'quantity' }] }))), 'INVALID_INPUT_DECLARATION');
  assert.equal(code(() => checkFormula(FX(R('f')), opts({ inputs: [{ ref: 'DE.f', type: 'decimal', unit: 'percent_mass' }] }))), 'INVALID_INPUT_DECLARATION');
  assert.equal(code(() => checkFormula(FX(R('f')), opts({ inputs: [{ ref: 'DE.f', type: 'decimal' }, { ref: 'DE.f', type: 'decimal' }] }))), 'INVALID_INPUT_DECLARATION');
  assert.equal(code(() => checkFormula(FX(R('f')), opts({ inputs: [null] }))), 'INVALID_ARGUMENT', 'a malformed declaration is the caller argument');
  assert.equal(code(() => evaluateFormula(FX(R('f')), { 'DE.f': '1', 'DE.s': 5 }, opts())), 'TYPE_MISMATCH');
  assert.equal(code(() => evaluateFormula(FX(R('f')), { 'DE.f': '1', 'DE.b': 'yes' }, opts())), 'TYPE_MISMATCH');
});

test('E-0031 (1) / E-0025 (3): supplied values are validated in inputs[] order; a wrong unit or bare scalar is KF-E-310', () => {
  const run = (values) => evaluateFormula(FX(R('f')), { 'DE.f': '1', ...values }, opts());
  const shape = (r) => r.diagnostics.map((d) => [d.code, d.pointer, d.expected_unit, d.found_unit, d.source]);
  assert.deepEqual(shape(run({ 'DE.c': Q('1', 'ppm_mass') })), [['KF-E-310', '/inputs/0', 'percent_mass', 'ppm_mass', 'value']]);
  assert.deepEqual(shape(run({ 'DE.c': '4.2' })), [['KF-E-310', '/inputs/0', 'percent_mass', null, 'value']]);
  assert.deepEqual(shape(run({ 'DE.f': Q('1') })), [['KF-E-310', '/inputs/3', null, 'percent_mass', 'value']]);
  assert.deepEqual(run({ 'DE.e': 'W', 'DE.c': Q('1', 'ppm_mass') }).diagnostics.map((d) => d.code), ['KF-E-310', 'KF-E-314']);
  assert.equal(run({ 'DE.c': Q('1', 'ppm_mass') }).status, 'error');
  assert.equal(run({ 'DE.e': null, 'DE.c': null }).status, 'ok');
});

test('E-0033 (diagnostics inventory): only the five catalog codes are returned, and only KF-E-313 carries a remediation', () => {
  const formulas = [
    FX(op('add', R('c'), R('p')), 'percent_mass'), FX(R('c'), 'ppm_mass'), FX(op('divide', R('f'), R('g'))), { ...FX(R('f')), guards: [{ when: { e: 'W' }, raise: 'OUT-0001' }] },
    { ...FX(R('f')), guards: [{ when: { s: { matches: '(a)\\1' } }, raise: 'OUT-0001' }] }, FX(op('multiply', R('c'), R('c')), 'percent_mass'),
  ];
  const seen = new Set();
  for (const logic of formulas) {
    for (const d of checkFormula(logic, opts())) {
      seen.add(d.code);
      assert.equal(d.severity, 'E');
      assert.equal(d.rule, null);
      assert.equal(d.rule_index, null);
      assert.equal(typeof d.message, 'string');
      assert.ok(!('error' in d));
      if (d.code === 'KF-E-313') assert.equal(d.remediation, 'añadir `guard`');
      else assert.ok(!('remediation' in d));
    }
  }
  assert.deepEqual([...seen].sort(), ['KF-E-310', 'KF-E-313', 'KF-E-314', 'KF-E-315', 'KF-E-316']);
});

test('§42.2 l.1765-1771: the formula catalog rows equal KF-E-313 and KF-E-316 of the spec; the P011 constants are unchanged', async () => {
  const spec = (await fs.readFile(path.join(ROOT, 'knowledge-framework-spec-v2.1.md'), 'utf8')).split(/\r?\n/);
  assert.match(spec[1767], /^\| `KF-E-313` \| E \| División por cero no protegida \| añadir `guard` \|$/);
  assert.match(spec[1770], /^\| `KF-E-316` \| E \| Dimensión resultante inexistente en `units.yaml` \| — \|$/);
  assert.deepEqual(Object.keys(FORMULA_DIAGNOSTIC_CATALOG), ['KF-E-313', 'KF-E-316']);
  assert.deepEqual({ ...FORMULA_DIAGNOSTIC_CATALOG['KF-E-313'] }, { code: 'KF-E-313', severity: 'E', remediation: 'añadir `guard`' });
  assert.deepEqual({ ...FORMULA_DIAGNOSTIC_CATALOG['KF-E-316'] }, { code: 'KF-E-316', severity: 'E' });
  assert.ok(Object.isFrozen(FORMULA_DIAGNOSTIC_CATALOG) && Object.isFrozen(FORMULA_DIAGNOSTIC_CATALOG['KF-E-313']));
  assert.deepEqual(Object.keys(LOGIC_DIAGNOSTIC_CATALOG), ['KF-E-310', 'KF-E-311', 'KF-E-312', 'KF-E-314', 'KF-E-315']);
  assert.deepEqual([...FORMULA_ERROR_CODES], ['DIVISION_BY_ZERO', 'INEXACT_DIVISION', 'INVALID_EXPRESSION']);
  assert.equal(LOGIC_ERROR_CODES.length, 14);
  const d = makeFormulaDiagnostic('KF-E-313', 'm', { pointer: '/expression', input: undefined, reason: 'unprotected' });
  assert.deepEqual(d, { code: 'KF-E-313', severity: 'E', message: 'm', remediation: 'añadir `guard`', pointer: '/expression', reason: 'unprotected' });
  assert.deepEqual(makeFormulaDiagnostic('KF-E-314', 'm', { pointer: '/x' }), { code: 'KF-E-314', severity: 'E', message: 'm', pointer: '/x' });
});

test('§50 l.1953-1956: precision is the explicit option; DEFAULT_PRECISION is 28; invalid precision is INVALID_ARGUMENT in both functions', () => {
  assert.equal(DEFAULT_PRECISION, 28);
  assert.equal(MAX_EXPRESSION_DEPTH, 1000);
  for (const bad of [0, -1, 1.5, '28', Number.NaN, null, Number.POSITIVE_INFINITY, true, {}, [], 2 ** 60]) {
    assert.equal(code(() => checkFormula(FX(K('1')), opts({ precision: bad }))), 'INVALID_ARGUMENT', String(bad));
    assert.equal(code(() => evaluateFormula(FX(K('1')), {}, opts({ precision: bad }))), 'INVALID_ARGUMENT');
  }
  for (const good of [undefined, 1, 28, 100]) assert.equal(code(() => evaluateFormula(FX(K('1')), {}, opts({ precision: good }))), 'NO_THROW');
  assert.equal(valueOf(FX(op('divide', R('f'), K('8')), 'ratio', { rounding: { mode: 'half-even', decimals: 3 } }), { 'DE.f': '1' }, { precision: 1 }), '0.100');
});

test('P-08: options, inputs and values are validated (INVALID_ARGUMENT) by both functions', () => {
  const logic = FX(K('1'));
  for (const bad of [undefined, null, 'x', 5, [], {}, { unitRegistry: undefined, inputs: INPUTS }, { unitRegistry: null, inputs: INPUTS }, { inputs: INPUTS }]) {
    assert.equal(code(() => checkFormula(logic, bad)), 'INVALID_ARGUMENT');
    assert.equal(code(() => evaluateFormula(logic, {}, bad)), 'INVALID_ARGUMENT');
  }
  for (const inputs of [undefined, null, {}, 'inputs', 5, { ref: 'x' }]) {
    assert.equal(code(() => checkFormula(logic, { unitRegistry: REGISTRY, inputs })), 'INVALID_ARGUMENT');
    assert.equal(code(() => evaluateFormula(logic, {}, { unitRegistry: REGISTRY, inputs })), 'INVALID_ARGUMENT');
  }
  for (const values of [null, undefined, [], ['x'], 'values', 5]) assert.equal(code(() => evaluateFormula(logic, values, opts())), 'INVALID_ARGUMENT');
  assert.equal(code(() => checkFormula(FX(R('f')), { unitRegistry: REGISTRY, inputs: [] })), 'UNBOUND_FIELD');
  assert.deepEqual(checkFormula(logic, { unitRegistry: REGISTRY, inputs: [] }), []);
  assert.equal(valueOf(logic, {}, { inputs: [] }), '1');
});

test('P-03: the FormulaResult has exactly status, value, outcome, guard_index and diagnostics, and a fresh object each call', () => {
  const keys = ['diagnostics', 'guard_index', 'outcome', 'status', 'value'];
  const ok = evaluateFormula(FX(R('f')), { 'DE.f': '1' }, opts());
  const raised = evaluateFormula({ ...FX(R('f')), guards: [{ when: { f: '1' }, raise: 'OUT-0001' }] }, { 'DE.f': '1' }, opts());
  const error = evaluateFormula(FX(op('divide', R('f'), R('g'))), {}, opts());
  const nothing = evaluateFormula(FX(R('f')), {}, opts());
  for (const result of [ok, raised, error, nothing]) assert.deepEqual(Object.keys(result).sort(), keys);
  assert.deepEqual(ok, { status: 'ok', value: { value: '1', unit: 'ratio' }, outcome: null, guard_index: null, diagnostics: [] });
  assert.deepEqual(nothing, { status: 'ok', value: null, outcome: null, guard_index: null, diagnostics: [] });
  assert.notEqual(evaluateFormula(FX(R('f')), { 'DE.f': '1' }, opts()), ok);
  assert.notEqual(evaluateFormula(FX(R('f')), { 'DE.f': '1' }, opts()).value, ok.value);
});

test('P-06: diagnostics are sorted by (code, pointer, message) in byte order and no two share (code, pointer)', () => {
  const logic = FX(op('add', R('c'), R('p'), op('multiply', R('c'), op('divide', R('f'), R('g')))), 'ratio', {
    guards: [{ when: { e: 'W' }, raise: 'OUT-0001' }, { when: { s: { matches: '(a)\\1' } }, raise: 'OUT-0002' }],
  });
  const list = checkFormula(logic, opts());
  assert.deepEqual(list.map((d) => [d.code, d.pointer]), [
    ['KF-E-310', '/expression/args/1'], ['KF-E-310', '/output/unit'], ['KF-E-313', '/expression/args/2/args/1'], ['KF-E-314', '/guards/0/when/e'], ['KF-E-315', '/guards/1/when/s/matches'],
  ]);
  assert.deepEqual(evaluateFormula(logic, {}, opts()).diagnostics, list);
  const squared = FX(op('add', R('c'), R('p'), op('multiply', R('c'), R('c')), op('multiply', R('c'), op('divide', R('f'), R('g')))), 'ratio', { guards: logic.guards });
  assert.equal(checkFormula(squared, opts()).at(-1).code, 'KF-E-316', 'KF-E-316 sorts after KF-E-315');
});

test('P-07: order of work: arguments, structure, static findings, supplied values, guards, expression, rounding', () => {
  const staticError = FX(op('add', R('c'), R('p')), 'percent_mass');
  assert.equal(evaluateFormula(staticError, { 'DE.f': 0.1 }, opts()).status, 'error', 'static findings win over an invalid supplied value');
  assert.equal(code(() => evaluateFormula(FX(R('f')), { 'DE.f': 0.1 }, opts())), 'INVALID_DECIMAL');
  const guarded = { ...FX(R('f')), guards: [{ when: { f: { gte: '1' } }, raise: 'OUT-0001' }] };
  assert.equal(evaluateFormula(guarded, { 'DE.f': '2', 'DE.c': Q('1', 'ppm_mass') }, opts()).status, 'error', 'values are validated before the guards');
  assert.equal(code(() => evaluateFormula(FX(R('f')), null, opts({ precision: 0 }))), 'INVALID_ARGUMENT');
});

test('P-09: the appended predicate wrappers behave as the formula engine needs them', () => {
  const { inputs, bind } = compileLogicInputs(INPUTS, REGISTRY);
  assert.equal(inputs.length, INPUTS.length);
  assert.equal(code(() => compileLogicInputs({}, REGISTRY)), 'INVALID_ARGUMENT');
  assert.equal(code(() => compileLogicInputs(INPUTS, {})), 'INVALID_ARGUMENT');
  assert.equal(code(() => compileLogicInputs([5], REGISTRY)), 'INVALID_ARGUMENT');
  const context = { inputs, bind, registry: REGISTRY };
  const compiled = compileLogicPredicate({ f: { gt: '0' }, c: { gt: Q('1', 'ppm_mass') } }, context, '/x');
  assert.deepEqual(compiled.findings.map((d) => [d.code, d.pointer, d.rule, d.rule_index, d.source]), [['KF-E-310', '/x/c/gt', null, null, 'literal']]);
  assert.deepEqual(compiled.mentions, [0, 3]);
  assert.equal(code(() => compileLogicPredicate({}, context, '/x')), 'EMPTY_PREDICATE');
  assert.equal(code(() => compileLogicPredicate('f', context, '/x')), 'INVALID_EXPRESSION', 'INVALID_TABLE is re-thrown as INVALID_EXPRESSION');
  assert.equal(code(() => compileLogicPredicate({ f: { nope: 1 } }, context, '/x')), 'INVALID_EXPRESSION');
  const { typed, diagnostics } = typeLogicValues(inputs, bind, { 'DE.f': '1', 'DE.e': 'W' });
  assert.equal(typed.length, INPUTS.length);
  assert.deepEqual(diagnostics.map((d) => d.code), ['KF-E-314']);
  assert.equal(evaluateLogicPredicate(compileLogicPredicate({ f: { gt: '0' } }, context, '/x').node, typed), true);
  assert.equal(evaluateLogicPredicate(compileLogicPredicate({ g: { is_null: true } }, context, '/x').node, typed), true);
  assert.equal(code(() => typeLogicValues(inputs, bind, [])), 'INVALID_ARGUMENT');
});

test('E-0032 (6): nesting deeper than 1000 is INVALID_EXPRESSION from both functions, never a RangeError; width and digits are unbounded', () => {
  const chain = (depth, make) => {
    let node = R('f');
    for (let i = 0; i < depth; i += 1) node = make(node);
    return FX(node);
  };
  const adds = (depth) => chain(depth, (inner) => ({ op: 'add', args: [inner, K('1')] }));
  const ifs = (depth) => chain(depth, (inner) => iff({ b: true }, inner, K('0')));
  assert.equal(valueOf(adds(900), { 'DE.f': '0' }), '900');
  assert.equal(valueOf(ifs(900), { 'DE.f': '7', 'DE.b': true }), '7');
  for (const depth of [1100, 5000, 100000]) {
    for (const logic of [adds(depth), ifs(depth)]) {
      for (const call of [() => checkFormula(logic, opts()), () => evaluateFormula(logic, { 'DE.f': '0', 'DE.b': true }, opts())]) {
        let caught = null;
        try {
          call();
        } catch (error) {
          caught = error;
        }
        assert.ok(caught instanceof LogicError && !(caught instanceof RangeError), `${depth}: ${caught?.name}`);
        assert.equal(caught.code, 'INVALID_EXPRESSION');
      }
    }
  }
  const wide = Array.from({ length: 100000 }, () => K('1'));
  assert.equal(valueOf(FX({ op: 'add', args: wide })), '100000');
  assert.equal(valueOf(FX({ op: 'max', args: wide })), '1');
  assert.deepEqual(checkFormula(FX({ op: 'multiply', args: wide }), opts()), []);
  const digits = '9'.repeat(5000);
  assert.equal(valueOf(FX(K(digits))), digits);
  const predicateDepth = (n) => {
    let when = { f: '1' };
    for (let i = 0; i < n; i += 1) when = { not: when };
    return { ...FX(R('f')), guards: [{ when, raise: 'OUT-0001' }] };
  };
  assert.equal(code(() => checkFormula(predicateDepth(5000), opts())), 'INVALID_EXPRESSION', 'a deep predicate is also typed');
});

test('§12.2 l.636: hostile names are data: __proto__, constructor and prototype keys never reach a lookup table', () => {
  const hostile = [{ ref: '__proto__' }, { ref: 'constructor' }, { ref: 'toString' }, { ref: 'hasOwnProperty' }];
  for (const expression of hostile) assert.equal(code(() => checkFormula(FX(expression), opts())), 'UNBOUND_FIELD');
  const inputs = [{ ref: '__proto__', type: 'decimal' }, { ref: 'constructor.value', type: 'decimal' }];
  assert.equal(valueOf(FX({ ref: '__proto__' }), JSON.parse('{"__proto__": "5"}'), { inputs }), '5');
  assert.equal(valueOf(FX({ ref: 'value' }), { value: '3' }, { inputs }), '3');
  assert.equal(code(() => evaluateFormula(FX(R('f')), JSON.parse('{"__proto__": "5", "DE.f": "1"}'), opts())), 'UNBOUND_FIELD');
  assert.equal(Object.prototype.x, undefined, 'Object.prototype is untouched');
  assert.equal(({}).value, undefined);
  assert.equal(code(() => checkFormula(JSON.parse('{"kind":"formula","output":{"ref":"x","unit":"ratio"},"expression":{"const":"1"},"__proto__":{"x":1}}'), opts())), 'INVALID_EXPRESSION');
  assert.equal(code(() => checkFormula(JSON.parse('{"kind":"formula","output":{"ref":"x","unit":"ratio"},"expression":{"op":"add","args":[{"const":"1"}],"__proto__":1}}'), opts())), 'INVALID_EXPRESSION');
});

test('P-01 purity and determinism: frozen inputs are accepted and never mutated; key order never changes a result', () => {
  const freeze = (value) => {
    if (value && typeof value === 'object') for (const key of Object.keys(value)) freeze(value[key]);
    return Object.freeze(value);
  };
  const logic = FX(op('add', R('c'), R('p'), op('divide', R('f'), R('g'))), 'ratio', { rounding: { mode: 'half-even', decimals: 2 }, guards: [{ when: { e: { in: ['X', 'W'] } }, raise: 'OUT-0001' }] });
  const values = { 'DE.c': Q('1', 'ppm_mass'), 'DE.f': '1', 'DE.e': 'W' };
  const snapshot = JSON.stringify([logic, values, INPUTS]);
  freeze(logic);
  freeze(values);
  const options = opts({ inputs: freeze(structuredCloneInputs()) });
  const first = checkFormula(logic, options);
  const second = checkFormula(logic, options);
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.deepEqual(evaluateFormula(logic, values, options), evaluateFormula(logic, values, options));
  assert.equal(JSON.stringify([logic, values, INPUTS]), snapshot);
  const reversed = (value) => {
    if (Array.isArray(value)) return value.map(reversed);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).reverse().map((key) => [key, reversed(value[key])]));
    return value;
  };
  assert.deepEqual(checkFormula(reversed(logic), opts({ inputs: reversed(INPUTS) })), first);
  const plain = FX(op('multiply', R('c'), R('f')), 'percent_mass', { rounding: { mode: 'half-up', decimals: 3 }, guards: [{ when: { f: { gte: '1' }, c: { gt: Q('9') } }, raise: 'OUT-0003' }] });
  const v = { 'DE.f': '0.333', 'DE.c': Q('4.2') };
  assert.deepEqual(evaluateFormula(reversed(plain), reversed(v), opts({ inputs: reversed(INPUTS) })), evaluateFormula(plain, v, opts()));
});

function structuredCloneInputs() {
  return JSON.parse(JSON.stringify(INPUTS));
}

test('E-0017: a quantity keeps decimal arithmetic exact end to end and compares by value', () => {
  assert.equal(compareDecimal(parseDecimal('4.2'), parseDecimal('4.20')), 0);
  assert.equal(formatDecimal(parseDecimal('4.20')), '4.2');
  const logic = FX(op('multiply', R('c'), op('subtract', K('1'), R('f'))), 'percent_mass', { rounding: { mode: 'half-even', decimals: 4 } });
  assert.deepEqual(evaluateFormula(logic, { 'DE.c': Q('4.2'), 'DE.f': '0.1' }, opts()).value, { value: '3.7800', unit: 'percent_mass' });
  assert.equal(evaluateFormula(logic, { 'DE.c': Q('0.1'), 'DE.f': '0' }, opts()).value.value, '0.1000');
});

test('E-0033: INVALID_TABLE is never thrown and a KF- code is never thrown by the entry points', () => {
  const attempts = [
    () => checkFormula(null, opts()), () => checkFormula(FX('x'), opts()), () => checkFormula({ ...FX(R('f')), guards: [{ when: 5, raise: 'OUT-0001' }] }, opts()),
    () => checkFormula(FX(iff(5, R('f'), R('g'))), opts()), () => checkFormula(FX(R('f')), opts({ inputs: [5] })), () => checkFormula(FX(iff({ f: { eq: [] } }, R('f'), R('g'))), opts()),
    () => checkFormula(FX(iff({ f: { between: [1] } }, R('f'), R('g'))), opts()), () => evaluateFormula(FX(R('f')), null, opts()), () => checkFormula(FX(iff({ f: { matches: 5 } }, R('f'), R('g'))), opts()),
  ];
  for (const attempt of attempts) {
    const outcome = code(attempt);
    assert.notEqual(outcome, 'INVALID_TABLE');
    assert.notEqual(outcome, 'NO_THROW');
  }
});
