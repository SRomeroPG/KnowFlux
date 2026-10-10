// P011 implementer tests: exact decimals (spec section 11.1; errata E-0017, E-0022 D-04).
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDecimal, compareDecimal, equalsDecimal, formatDecimal, isDecimal, isDecimalString, multiplyDecimal, parseDecimal, subtractDecimal,
} from '../framework/engine/decimal.mjs';
import { LogicError } from '../framework/engine/logic-errors.mjs';

const D = parseDecimal;
const fmt = (op, a, b) => formatDecimal(op(D(a), D(b)));

function code(fn) {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof LogicError, `LogicError expected, got ${error}`);
    return error.code;
  }
  return 'NO_THROW';
}

test('§11.1 l.582: equality and order are by numeric value, not text', () => {
  const pairs = [
    ['4.20', '4.2', 0], ['-0', '0', 0], ['-0.00', '0', 0], ['007', '7', 0], ['1', '1.0000', 0],
    ['10', '9', 1], ['-10', '-9', -1], ['-4.2', '4.2', -1], ['0.5', '0.05', 1], ['5', '-5', 1],
  ];
  for (const [a, b, expected] of pairs) {
    assert.equal(compareDecimal(D(a), D(b)), expected, `${a} vs ${b}`);
    assert.equal(compareDecimal(D(b), D(a)), expected === 0 ? 0 : -expected, `${b} vs ${a}`);
    assert.equal(equalsDecimal(D(a), D(b)), expected === 0);
  }
});

test('§11.1 l.582: values that collide as binary doubles stay distinct (no binary float)', () => {
  assert.equal(Number('9007199254740993') === Number('9007199254740992'), true, 'sanity: the doubles collide');
  assert.equal(compareDecimal(D('9007199254740993'), D('9007199254740992')), 1);
  assert.equal(compareDecimal(D('0.3'), D('0.30000000000000004')), -1);
  assert.equal(compareDecimal(D('0.1000000000000000055511151231257827'), D('0.1')), 1);
  assert.equal(fmt(addDecimal, '0.1', '0.2'), '0.3');
  assert.equal(equalsDecimal(addDecimal(D('0.1'), D('0.2')), D('0.3')), true);
  assert.equal(fmt(addDecimal, '9007199254740992', '1'), '9007199254740993');
});

test('§11.1 l.582: arbitrary precision for very long digit strings', () => {
  const big = `1${'0'.repeat(4000)}`;
  const bigger = `${'9'.repeat(4000)}`;
  assert.equal(compareDecimal(D(big), D(bigger)), 1);
  assert.equal(formatDecimal(D(big)), big);
  const tiny = `0.${'0'.repeat(5000)}1`;
  assert.equal(compareDecimal(D(tiny), D('0')), 1);
  assert.equal(formatDecimal(D(tiny)), tiny);
  assert.equal(fmt(multiplyDecimal, '123456789012345678901234567890', '987654321098765432109876543210'),
    '121932631137021795226185032733622923332237463801111263526900');
  assert.equal(fmt(subtractDecimal, `1${'0'.repeat(300)}`, '1'), '9'.repeat(300));
});

test('§11.1 l.582: exact add, subtract and multiply with scale alignment', () => {
  assert.equal(fmt(subtractDecimal, '0.3', '0.1'), '0.2');
  assert.equal(fmt(subtractDecimal, '1', '1.000'), '0');
  assert.equal(fmt(multiplyDecimal, '1.5', '-2.5'), '-3.75');
  assert.equal(fmt(multiplyDecimal, '0.000001', '0.000001'), '0.000000000001');
  assert.equal(fmt(addDecimal, '-0', '-0'), '0');
  assert.equal(fmt(multiplyDecimal, '-0', '5'), '0');
  assert.equal(fmt(addDecimal, '-5', '5'), '0');
  assert.equal(fmt(addDecimal, '1.25', '-3'), '-1.75');
});

test('§11.1 l.583: only quoted strings of the lexical form are decimals; everything else is INVALID_DECIMAL', () => {
  const bad = [
    '4,2', '.5', '5.', '1e3', '1E3', '+1', '', ' 4.2', '4.2 ', '4.2\n', '\n4.2', '--1', '-', '0x10', 'NaN', 'Infinity', '1_000',
    '٣', '4.2.1', '1 000', '-.5', '--', '4.', '0,5', ' 4',
  ];
  for (const text of bad) {
    assert.equal(code(() => parseDecimal(text)), 'INVALID_DECIMAL', JSON.stringify(text));
    assert.equal(isDecimalString(text), false, JSON.stringify(text));
  }
  for (const value of [4.2, 42, 0, true, false, null, undefined, {}, [], 10n, Symbol.iterator, () => 1]) {
    assert.equal(code(() => parseDecimal(value)), 'INVALID_DECIMAL', String(typeof value));
    assert.equal(isDecimalString(value), false);
  }
  for (const text of ['4.2', '-0', '007', '0.10', '0', '-1', `${'9'.repeat(100)}.${'1'.repeat(100)}`]) {
    assert.equal(isDecimalString(text), true, text);
    assert.doesNotThrow(() => parseDecimal(text));
  }
});

test('§11.1 l.583: formatDecimal gives the canonical minimal form and never "-0"', () => {
  const cases = [
    ['4.20', '4.2'], ['-0', '0'], ['007.500', '7.5'], ['0.0', '0'], ['-0.50', '-0.5'], ['100', '100'], ['0.001', '0.001'],
    ['1000.000', '1000'], ['-0.000', '0'], ['0.10', '0.1'], ['12.0034', '12.0034'],
  ];
  for (const [text, expected] of cases) assert.equal(formatDecimal(D(text)), expected, text);
  assert.equal(D('-0').unscaled, 0n);
  assert.equal(D('-0.00').unscaled, 0n);
});

test('§11.1 l.584: no rounding exists in the decimal module (no division, no rounding exports)', async () => {
  const module = await import('../framework/engine/decimal.mjs');
  assert.deepEqual(Object.keys(module).sort(), [
    'addDecimal', 'compareDecimal', 'equalsDecimal', 'formatDecimal', 'isDecimal', 'isDecimalString', 'multiplyDecimal',
    'parseDecimal', 'subtractDecimal',
  ]);
});

test('E-0017: a Decimal is {unscaled: bigint, scale >= 0}, produced only by the module, and immutable', () => {
  const d = D('1.50');
  assert.equal(typeof d.unscaled, 'bigint');
  assert.equal(d.unscaled, 150n);
  assert.equal(d.scale, 2);
  assert.equal(isDecimal(d), true);
  assert.equal(isDecimal({ unscaled: 150n, scale: 2 }), false);
  assert.equal(isDecimal('1.5'), false);
  assert.equal(isDecimal(null), false);
  assert.equal(Object.isFrozen(d), true);
  assert.throws(() => { d.unscaled = 1n; }, TypeError);
});

test('E-0017: non-Decimal arguments are INVALID_ARGUMENT for every operation', () => {
  const one = D('1');
  const look = { unscaled: 1n, scale: 0 };
  for (const bad of [look, '1', 1, null, undefined, 1n]) {
    assert.equal(code(() => compareDecimal(bad, one)), 'INVALID_ARGUMENT');
    assert.equal(code(() => compareDecimal(one, bad)), 'INVALID_ARGUMENT');
    assert.equal(code(() => equalsDecimal(bad, one)), 'INVALID_ARGUMENT');
    assert.equal(code(() => addDecimal(bad, one)), 'INVALID_ARGUMENT');
    assert.equal(code(() => subtractDecimal(one, bad)), 'INVALID_ARGUMENT');
    assert.equal(code(() => multiplyDecimal(bad, bad)), 'INVALID_ARGUMENT');
    assert.equal(code(() => formatDecimal(bad)), 'INVALID_ARGUMENT');
  }
});

test('E-0017: operations never mutate their arguments and return fresh values', () => {
  const a = D('2.5');
  const b = D('0.25');
  const sum = addDecimal(a, b);
  assert.equal(formatDecimal(a), '2.5');
  assert.equal(formatDecimal(b), '0.25');
  assert.notEqual(sum, a);
  assert.notEqual(addDecimal(a, b), sum);
  assert.deepEqual(addDecimal(a, b), sum);
});
