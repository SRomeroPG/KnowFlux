// P012 implementer tests: exact decimal operations (spec section 11.1 l.582-585; errata E-0017, E-0032 (2)-(5), E-0036 (3)).
import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDecimal, isDecimal, parseDecimal } from '../framework/engine/decimal.mjs';
import { absDecimal, divideDecimal, formatDecimalFixed, roundDecimal, roundDecimalSignificant } from '../framework/engine/decimal-ops.mjs';
import { LogicError } from '../framework/engine/logic-errors.mjs';

const D = parseDecimal;
const MODES = ['half-even', 'half-up', 'down', 'up'];

function code(fn) {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof LogicError, `LogicError expected, got ${error}`);
    return error.code;
  }
  return 'NO_THROW';
}

/** Independent reference: round |u|/10^drop to an integer by comparing against floor and ceiling (no remainder tricks). */
function referenceRound(u, drop, mode) {
  const sign = u < 0n ? -1n : 1n;
  const magnitude = u < 0n ? -u : u;
  const unit = 10n ** BigInt(drop);
  const floor = magnitude / unit;
  const ceil = magnitude % unit === 0n ? floor : floor + 1n;
  const toFloor = magnitude - floor * unit; // distance to the floor, in units of 10^-drop
  const toCeil = ceil * unit - magnitude;
  let pick;
  if (floor === ceil) pick = floor;
  else if (mode === 'down') pick = floor;
  else if (mode === 'up') pick = ceil;
  else if (toFloor < toCeil) pick = floor;
  else if (toCeil < toFloor) pick = ceil;
  else if (mode === 'half-up') pick = ceil;
  else pick = floor % 2n === 0n ? floor : ceil;
  return sign * pick;
}

test('§11.1 l.584: absDecimal is exact and a negative zero never appears', () => {
  assert.equal(formatDecimal(absDecimal(D('-3.50'))), '3.5');
  assert.equal(absDecimal(D('-3.50')).scale, 2, 'the scale is kept');
  assert.equal(formatDecimal(absDecimal(D('-0'))), '0');
  assert.equal(formatDecimal(absDecimal(D('4'))), '4');
  assert.equal(formatDecimal(absDecimal(D('-123456789012345678901234567890.123456789'))), '123456789012345678901234567890.123456789');
  assert.ok(isDecimal(absDecimal(D('-1'))));
});

test('§11.1 l.584: absDecimal rejects anything that is not a Decimal of decimal.mjs', () => {
  for (const bad of ['1', 1, null, undefined, { unscaled: 1n, scale: 0 }, 1n, []]) assert.equal(code(() => absDecimal(bad)), 'INVALID_ARGUMENT');
});

test('E-0032 (2): roundDecimal ties for the four modes, positive and negative, at decimals 0', () => {
  const table = [
    ['2.5', '2', '3', '2', '3'], ['3.5', '4', '4', '3', '4'], ['-2.5', '-2', '-3', '-2', '-3'], ['-3.5', '-4', '-4', '-3', '-4'],
    ['0.5', '0', '1', '0', '1'], ['-0.5', '0', '-1', '0', '-1'], ['-0.4', '0', '0', '0', '-1'], ['2', '2', '2', '2', '2'],
  ];
  for (const [input, ...expected] of table) {
    MODES.forEach((mode, i) => assert.equal(formatDecimalFixed(roundDecimal(D(input), { mode, decimals: 0 })), expected[i], `${input} ${mode}`));
  }
});

test('E-0032 (2): roundDecimal agrees with an independent reference over every sign, scale and tie pattern', () => {
  let checked = 0;
  for (const scale of [1, 2, 3, 4]) {
    for (let unscaled = -1300n; unscaled <= 1300n; unscaled += 1n) {
      const magnitude = (unscaled < 0n ? -unscaled : unscaled).toString().padStart(scale + 1, '0');
      const text = `${unscaled < 0n ? '-' : ''}${magnitude.slice(0, magnitude.length - scale)}.${magnitude.slice(magnitude.length - scale)}`;
      for (let decimals = 0; decimals < scale; decimals += 1) {
        for (const mode of MODES) {
          const rounded = roundDecimal(D(text), { mode, decimals });
          assert.equal(rounded.scale, decimals);
          assert.equal(rounded.unscaled, referenceRound(unscaled, scale - decimals, mode), `${text} ${mode} ${decimals}`);
          checked += 1;
        }
      }
    }
  }
  assert.ok(checked > 40000);
});

test('E-0032 (2): roundDecimal pads shorter operands, keeps trailing zeros and has no cap on decimals', () => {
  assert.equal(formatDecimalFixed(roundDecimal(D('3.78'), { mode: 'half-even', decimals: 4 })), '3.7800');
  assert.equal(formatDecimalFixed(roundDecimal(D('5'), { mode: 'down', decimals: 2 })), '5.00');
  assert.equal(formatDecimalFixed(roundDecimal(D('-0'), { mode: 'up', decimals: 2 })), '0.00');
  assert.equal(formatDecimalFixed(roundDecimal(D('1'), { mode: 'up', decimals: 100 })), `1.${'0'.repeat(100)}`);
  assert.equal(roundDecimal(D('1'), { mode: 'up', decimals: 100 }).scale, 100);
  assert.equal(formatDecimalFixed(roundDecimal(D('123456789012345678901234567890.5'), { mode: 'half-even', decimals: 0 })), '123456789012345678901234567890');
  assert.equal(formatDecimalFixed(roundDecimal(D('-123456789012345678901234567890.5'), { mode: 'half-up', decimals: 0 })), '-123456789012345678901234567891');
  assert.equal(formatDecimalFixed(roundDecimal(D('-0.00005'), { mode: 'half-even', decimals: 4 })), '0.0000', 'never -0.0000');
  assert.equal(formatDecimalFixed(roundDecimal(D('-0.00005'), { mode: 'half-up', decimals: 4 })), '-0.0001');
});

test('E-0032 (2): roundDecimal validates its arguments (INVALID_ARGUMENT)', () => {
  const ok = { mode: 'half-even', decimals: 2 };
  for (const bad of [{ ...ok, mode: 'half-down' }, { ...ok, mode: 'HALF-EVEN' }, { ...ok, decimals: -1 }, { ...ok, decimals: 1.5 }, { ...ok, decimals: '2' }, { ...ok, decimals: Number.NaN },
    { ...ok, decimals: Number.POSITIVE_INFINITY }, { mode: 'half-even' }, { decimals: 2 }, {}, undefined, null, [], 'x']) {
    assert.equal(code(() => roundDecimal(D('1.005'), bad)), 'INVALID_ARGUMENT');
  }
  assert.equal(code(() => roundDecimal('1.005', ok)), 'INVALID_ARGUMENT');
  assert.equal(code(() => roundDecimal(null, ok)), 'INVALID_ARGUMENT');
  assert.equal(code(() => roundDecimal(D('1'), { mode: 'up', decimals: 2 ** 50 })), 'INVALID_ARGUMENT', 'an unrepresentable scale is a typed error, never a RangeError');
});

test('E-0032 (3): roundDecimalSignificant keeps the requested significant digits, left digits become zeros', () => {
  const rows = [
    ['123456', 3, 'half-even', '123000'], ['123500', 3, 'half-even', '124000'], ['122500', 3, 'half-even', '122000'], ['123500', 3, 'down', '123000'],
    ['123500', 3, 'up', '124000'], ['0.0012345', 3, 'half-even', '0.00123'], ['0.0012355', 3, 'half-up', '0.00124'], ['-0.0012355', 3, 'half-up', '-0.00124'],
    ['-0.0012355', 3, 'down', '-0.00123'], ['-0.0012355', 3, 'up', '-0.00124'], ['0', 5, 'half-even', '0'], ['999.5', 3, 'half-up', '1000'],
    ['12', 5, 'up', '12'], ['1.5', 1, 'half-even', '2'], ['2.5', 1, 'half-even', '2'], ['2.5', 1, 'half-up', '3'],
  ];
  for (const [input, digits, mode, expected] of rows) {
    const result = roundDecimalSignificant(D(input), { mode, digits });
    assert.ok(isDecimal(result));
    assert.equal(formatDecimal(result), expected, `${input} ${digits} ${mode}`);
  }
  for (const bad of [0, -1, 1.5, '3', undefined, null, Number.NaN]) assert.equal(code(() => roundDecimalSignificant(D('123456'), { mode: 'half-even', digits: bad })), 'INVALID_ARGUMENT');
  assert.equal(code(() => roundDecimalSignificant(D('1'), { mode: 'half-down', digits: 3 })), 'INVALID_ARGUMENT');
  assert.equal(code(() => roundDecimalSignificant('1', { mode: 'half-even', digits: 3 })), 'INVALID_ARGUMENT');
});

test('E-0032 (3): divideDecimal returns an exact quotient with the exact flag set', () => {
  const rows = [['1', '4', '0.25'], ['6', '3', '2'], ['10', '4', '2.5'], ['0.3', '0.1', '3'], ['-7', '2', '-3.5'], ['1', '-4', '-0.25'], ['-1', '-8', '0.125'], ['0', '5', '0'],
    ['1', '1024', '0.0009765625'], ['1', '1', '1'], ['100', '1', '100'], ['0.5', '0.25', '2']];
  for (const [a, b, expected] of rows) {
    const result = divideDecimal(D(a), D(b), { precision: 28 });
    assert.equal(result.exact, true, `${a} / ${b}`);
    assert.ok(isDecimal(result.value));
    assert.equal(formatDecimal(result.value), expected, `${a} / ${b}`);
  }
});

test('E-0032 (3): the exact flag turns on the number of significant digits against precision (28 and 29 digits)', () => {
  const twoTo40 = D('1099511627776'); // 1 / 2^40 has 28 significant digits
  const twoTo41 = D('2199023255552'); // 1 / 2^41 has 29 significant digits
  assert.equal(divideDecimal(D('1'), twoTo40, { precision: 28 }).exact, true);
  assert.equal(formatDecimal(divideDecimal(D('1'), twoTo40, { precision: 28 }).value), '0.0000000000009094947017729282379150390625');
  assert.deepEqual(divideDecimal(D('1'), twoTo40, { precision: 27 }), { exact: false, value: null });
  assert.deepEqual(divideDecimal(D('1'), twoTo41, { precision: 28 }), { exact: false, value: null });
  assert.equal(divideDecimal(D('1'), twoTo41, { precision: 29 }).exact, true);
  assert.equal(formatDecimal(divideDecimal(D('1'), twoTo41, { precision: 29 }).value), '0.00000000000045474735088646411895751953125');
  assert.equal(divideDecimal(D('1'), D('8'), { precision: 3 }).exact, true);
  assert.equal(divideDecimal(D('1'), D('8'), { precision: 2 }).exact, false);
});

test('E-0036 (3): trailing zeros are not significant digits (10^32 / 1 is exact; 10^32 + 1 is not)', () => {
  const ten32 = `1${'0'.repeat(32)}`;
  const exact = divideDecimal(D(ten32), D('1'), { precision: 28 });
  assert.equal(exact.exact, true);
  assert.equal(formatDecimal(exact.value), ten32);
  assert.equal(divideDecimal(D(`${ten32.slice(0, -1)}1`), D('1'), { precision: 28 }).exact, false);
  assert.equal(divideDecimal(D('1200'), D('1'), { precision: 2 }).exact, true);
  assert.equal(divideDecimal(D('1201'), D('1'), { precision: 3 }).exact, false);
  assert.equal(formatDecimal(divideDecimal(D('10000000000000000000000000000000'), D('1'), { precision: 1 }).value), '10000000000000000000000000000000');
});

test('E-0032 (3): an inexact quotient is rounded to precision significant digits by the mode (signs, ties)', () => {
  const run = (a, b, precision, mode) => {
    const result = divideDecimal(D(a), D(b), { precision, mode });
    assert.equal(result.exact, false, `${a}/${b}`);
    return formatDecimal(result.value);
  };
  assert.equal(run('1', '3', 28, 'half-even'), '0.3333333333333333333333333333');
  assert.equal(run('2', '3', 28, 'half-even'), '0.6666666666666666666666666667');
  assert.equal(run('1', '3', 3, 'up'), '0.334');
  assert.equal(run('-1', '3', 3, 'down'), '-0.333');
  assert.equal(run('-1', '3', 3, 'up'), '-0.334');
  assert.equal(run('1', '8', 2, 'half-even'), '0.12');
  assert.equal(run('1', '8', 2, 'half-up'), '0.13');
  assert.equal(run('1', '8', 2, 'down'), '0.12');
  assert.equal(run('1', '8', 2, 'up'), '0.13');
  assert.equal(run('3', '8', 2, 'half-even'), '0.38');
  assert.equal(run('1', '2199023255552', 28, 'half-even'), '0.0000000000004547473508864641189575195312');
  assert.equal(run('1', '2199023255552', 28, 'half-up'), '0.0000000000004547473508864641189575195313');
  assert.equal(run('1', '2199023255552', 28, 'down'), '0.0000000000004547473508864641189575195312');
  assert.equal(run('1', '2199023255552', 28, 'up'), '0.0000000000004547473508864641189575195313');
  assert.equal(run('1000000', '3', 3, 'half-even'), '333000');
  assert.equal(run('9999', '10000', 3, 'half-up'), '1', 'a carry into a new digit');
  assert.equal(run('1', '30000', 2, 'up'), '0.000034');
  assert.equal(run('1', '8', 1, 'half-even'), '0.1');
});

test('E-0032 (3): divideDecimal agrees with a reference on every quotient a/b for small a, b, precision and mode', () => {
  const reference = (a, b, precision, mode) => {
    // find the exponent so that floor(|a/b| * 10^e) has exactly `precision` digits, by trial (independent of the implementation)
    let e = -30;
    for (; e < 60; e += 1) {
      const q = e >= 0 ? (a * 10n ** BigInt(e)) / b : a / (b * 10n ** BigInt(-e));
      if (q > 0n && q.toString().length >= precision) break;
    }
    const top = e >= 0 ? a * 10n ** BigInt(e) : a;
    const bottom = e >= 0 ? b : b * 10n ** BigInt(-e);
    const floor = top / bottom;
    const ceil = top % bottom === 0n ? floor : floor + 1n;
    const toFloor = top - floor * bottom;
    const toCeil = ceil * bottom - top;
    let pick;
    if (floor === ceil || mode === 'down') pick = floor;
    else if (mode === 'up') pick = ceil;
    else if (toFloor !== toCeil) pick = toFloor < toCeil ? floor : ceil;
    else if (mode === 'half-up') pick = ceil;
    else pick = floor % 2n === 0n ? floor : ceil;
    return e >= 0 ? `${pick}e-${e}` : `${pick * 10n ** BigInt(-e)}e-0`;
  };
  const render = (decimal) => (decimal.scale > 0 ? `${decimal.unscaled}e-${decimal.scale}` : `${decimal.unscaled}e-0`);
  let inexact = 0;
  for (let a = 1n; a <= 40n; a += 1n) {
    for (let b = 1n; b <= 40n; b += 1n) {
      for (const precision of [1, 2, 3, 5]) {
        const base = divideDecimal(D(a.toString()), D(b.toString()), { precision });
        if (base.exact) continue;
        for (const mode of MODES) {
          const result = divideDecimal(D(a.toString()), D(b.toString()), { precision, mode });
          assert.equal(result.exact, false);
          const got = result.value.scale > 0 ? `${result.value.unscaled}e-${result.value.scale}` : `${result.value.unscaled}e-0`;
          const expected = reference(a, b, precision, mode);
          // compare numerically: the same value may be written with a different scale
          const norm = (text) => {
            const [coefficient, exponent] = text.split('e-');
            return BigInt(coefficient) * 10n ** BigInt(30 - Number(exponent));
          };
          assert.equal(norm(got), norm(expected), `${a}/${b} p${precision} ${mode} (${render(result.value)})`);
          inexact += 1;
        }
      }
    }
  }
  assert.ok(inexact > 4000);
});

test('E-0032 (5): divideDecimal raises DIVISION_BY_ZERO for any zero divisor, even for a zero dividend', () => {
  for (const [a, b] of [['1', '0'], ['0', '0'], ['5', '-0'], ['5', '0.000'], ['-5', '0']]) assert.equal(code(() => divideDecimal(D(a), D(b), { precision: 28 })), 'DIVISION_BY_ZERO', `${a}/${b}`);
});

test('E-0017: divideDecimal validates precision, mode and operands (INVALID_ARGUMENT)', () => {
  const one = D('1');
  const three = D('3');
  for (const bad of [0, -1, 1.5, '28', Number.NaN, undefined, null, Number.POSITIVE_INFINITY, true]) assert.equal(code(() => divideDecimal(one, three, { precision: bad })), 'INVALID_ARGUMENT');
  for (const bad of [undefined, null, [], 'x']) assert.equal(code(() => divideDecimal(one, three, bad)), 'INVALID_ARGUMENT');
  assert.equal(code(() => divideDecimal(one, three)), 'INVALID_ARGUMENT');
  assert.equal(code(() => divideDecimal(one, three, { precision: 28, mode: 'half-down' })), 'INVALID_ARGUMENT');
  assert.equal(code(() => divideDecimal(one, three, { precision: 28, mode: null })), 'INVALID_ARGUMENT');
  assert.equal(code(() => divideDecimal('1', three, { precision: 28 })), 'INVALID_ARGUMENT');
  assert.equal(code(() => divideDecimal(one, 3, { precision: 28 })), 'INVALID_ARGUMENT');
  assert.equal(code(() => divideDecimal(one, D('0'), { precision: 0 })), 'INVALID_ARGUMENT', 'arguments are validated before the zero divisor');
});

test('§11.1 l.582: divideDecimal is exact for very long operands (no binary float)', () => {
  const a = '9'.repeat(400);
  const result = divideDecimal(D(a), D('1'), { precision: 1000 });
  assert.equal(result.exact, true);
  assert.equal(formatDecimal(result.value), a);
  const q = divideDecimal(D('1'), D('3'), { precision: 200, mode: 'half-even' });
  assert.equal(formatDecimal(q.value), `0.${'3'.repeat(200)}`);
});

test('E-0032 (2): formatDecimalFixed renders exactly scale fraction digits and never a negative zero', () => {
  const rows = [['4.20', '4.20'], ['-0.00', '0.00'], ['0', '0'], ['-1.5', '-1.5'], ['007', '7'], ['-0', '0'], ['0.005', '0.005'], ['-0.0001', '-0.0001'], ['100', '100']];
  for (const [input, expected] of rows) assert.equal(formatDecimalFixed(D(input)), expected, input);
  assert.equal(code(() => formatDecimalFixed('1.0')), 'INVALID_ARGUMENT');
  assert.equal(code(() => formatDecimalFixed(1.5)), 'INVALID_ARGUMENT');
});
