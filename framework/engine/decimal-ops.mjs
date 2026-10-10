// Exact decimal operations that P011 deliberately left out (errata E-0022 D-04; P012, errata E-0032, E-0036).
//
// absolute value, rounding to a number of decimals, rounding to a number of significant digits, division with an
// explicit precision, and fixed-scale rendering. A Decimal is the branded { unscaled: bigint, scale } of
// decimal.mjs; results are built through its public `parseDecimal`. Everything is BigInt arithmetic: no binary
// floating point, no locale, no clock. Counts (`decimals`, `digits`, `precision`) are validated plain integers.
import { isDecimal, parseDecimal } from './decimal.mjs';
import { LogicError } from './logic-errors.mjs';

const MODES = ['half-even', 'half-up', 'down', 'up'];
const CHAR_0 = 48;

function bad(message, argument) {
  return new LogicError('INVALID_ARGUMENT', message, { argument });
}

function requireDecimal(value, name) {
  if (!isDecimal(value)) throw bad(`${name} is not a Decimal produced by decimal.mjs`, name);
  return value;
}

function requireMode(mode) {
  if (typeof mode !== 'string' || !MODES.includes(mode)) throw bad('mode must be half-even, half-up, down or up', 'mode');
  return mode;
}

function requireCount(value, name, minimum) {
  if (!Number.isSafeInteger(value) || value < minimum) throw bad(`${name} must be an integer >= ${minimum}`, name);
  return value;
}

function requireOptions(options) {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) throw bad('options must be a mapping', 'options');
  return options;
}

function pow10(exponent) {
  try {
    return 10n ** BigInt(exponent);
  } catch (error) {
    if (error instanceof RangeError) throw bad('the requested number of digits is too large to represent', 'digits');
    throw error;
  }
}

/** Build a Decimal from an unscaled BigInt and a scale >= 0 (through the public parser; a zero is never "-0"). */
function fromParts(unscaled, scale) {
  const negative = unscaled < 0n;
  let digits = (negative ? -unscaled : unscaled).toString();
  if (scale > 0 && digits.length <= scale) digits = digits.padStart(scale + 1, '0');
  const split = digits.length - scale;
  const body = scale === 0 ? digits : `${digits.slice(0, split)}.${digits.slice(split)}`;
  return parseDecimal(negative ? `-${body}` : body);
}

function absBig(value) {
  return value < 0n ? -value : value;
}

/**
 * Round the magnitude `q + r / unit` to an integer by `mode` and return it (the sign is applied by the caller).
 * `r` is the remainder of the division by `unit`, 0 <= r < unit; ties are compared with `2 * r` against `unit`.
 */
function roundMagnitude(q, r, unit, mode) {
  if (r === 0n) return q;
  if (mode === 'down') return q;
  if (mode === 'up') return q + 1n;
  const twice = 2n * r;
  if (twice > unit) return q + 1n;
  if (twice < unit) return q;
  if (mode === 'half-up') return q + 1n;
  return q % 2n === 0n ? q : q + 1n; // half-even: a tie goes to the even neighbour
}

function numberOfDigits(magnitude) {
  return magnitude.toString().length;
}

/** Absolute value (exact; the scale is kept). */
export function absDecimal(a) {
  requireDecimal(a, 'a');
  return fromParts(absBig(a.unscaled), a.scale);
}

/**
 * Round to exactly `decimals` fraction digits by `mode`: half-even and half-up resolve ties to the even / away from
 * zero neighbour, down is toward zero, up is away from zero (E-0032 (2)). The result has `scale === decimals`
 * (a shorter operand is padded with zeros) and is never a negative zero.
 */
export function roundDecimal(a, options) {
  requireDecimal(a, 'a');
  requireOptions(options);
  const mode = requireMode(options.mode);
  const decimals = requireCount(options.decimals, 'decimals', 0);
  if (a.scale <= decimals) return fromParts(a.unscaled * pow10(decimals - a.scale), decimals);
  const unit = pow10(a.scale - decimals);
  const magnitude = absBig(a.unscaled);
  const rounded = roundMagnitude(magnitude / unit, magnitude % unit, unit, mode);
  return fromParts(a.unscaled < 0n ? -rounded : rounded, decimals);
}

/**
 * Round to `digits` significant digits by `mode`. A zero, and a value that already has at most `digits`
 * significant digits as written, are returned unchanged in value. Digits dropped to the left of the decimal point
 * become zeros (123456 to 3 digits is 123000).
 */
export function roundDecimalSignificant(a, options) {
  requireDecimal(a, 'a');
  requireOptions(options);
  const mode = requireMode(options.mode);
  const digits = requireCount(options.digits, 'digits', 1);
  const magnitude = absBig(a.unscaled);
  if (magnitude === 0n) return a;
  const drop = numberOfDigits(magnitude) - digits;
  if (drop <= 0) return a;
  const unit = pow10(drop);
  const rounded = roundMagnitude(magnitude / unit, magnitude % unit, unit, mode);
  const signed = a.unscaled < 0n ? -rounded : rounded;
  const scale = a.scale - drop;
  return scale >= 0 ? fromParts(signed, scale) : fromParts(signed * pow10(-scale), 0);
}

function gcd(x, y) {
  let a = x;
  let b = y;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

/** Count and strip the factors `factor` of `value`. Returns [exponent, remainder]. */
function stripFactor(value, factor) {
  let count = 0;
  let rest = value;
  while (rest % factor === 0n) {
    rest /= factor;
    count += 1;
  }
  return [count, rest];
}

function significantDigits(unscaled, scale) {
  const text = absBig(unscaled).toString();
  if (scale > 0) return text.length;
  let end = text.length;
  while (end > 1 && text.charCodeAt(end - 1) === CHAR_0) end -= 1;
  return end; // trailing zeros of an integer are not significant (E-0036 (3))
}

/**
 * Divide `a` by `b` with an explicit `precision` (significant digits, integer >= 1; E-0017, E-0032 (3)).
 * A quotient that is a terminating decimal of at most `precision` significant digits (trailing zeros of the
 * normalized coefficient are not counted, E-0036 (3)) is exact: `{ exact: true, value }`. Otherwise
 * `{ exact: false, value }` where `value` is the quotient rounded to `precision` significant digits by `options.mode`,
 * or `null` when no mode is given. A zero divisor is DIVISION_BY_ZERO.
 */
export function divideDecimal(a, b, options) {
  requireDecimal(a, 'a');
  requireDecimal(b, 'b');
  requireOptions(options);
  const precision = requireCount(options.precision, 'precision', 1);
  const mode = options.mode === undefined ? null : requireMode(options.mode);
  if (b.unscaled === 0n) throw new LogicError('DIVISION_BY_ZERO', 'the divisor is zero', {});
  if (a.unscaled === 0n) return { exact: true, value: parseDecimal('0') };
  const negative = (a.unscaled < 0n) !== (b.unscaled < 0n);
  // |a / b| = (|ua| * 10^sb) / (|ub| * 10^sa), reduced to lowest terms.
  let numerator = absBig(a.unscaled) * pow10(b.scale);
  let denominator = absBig(b.unscaled) * pow10(a.scale);
  const common = gcd(numerator, denominator);
  numerator /= common;
  denominator /= common;
  // A fraction in lowest terms terminates in base 10 iff the denominator has no prime factor but 2 and 5.
  const [twos, afterTwos] = stripFactor(denominator, 2n);
  const [fives, rest] = stripFactor(afterTwos, 5n);
  if (rest === 1n) {
    const scale = twos > fives ? twos : fives;
    const unscaled = numerator * (pow10(scale) / denominator);
    if (significantDigits(unscaled, scale) <= precision) return { exact: true, value: fromParts(negative ? -unscaled : unscaled, scale) };
  }
  if (mode === null) return { exact: false, value: null };
  // |a / b| lies in (10^(nn-nd-1), 10^(nn-nd+1)): scaling by 10^s gives precision or precision + 1 digits.
  let shift = precision - (numberOfDigits(numerator) - numberOfDigits(denominator));
  const quotientAt = (exponent) => {
    const top = exponent >= 0 ? numerator * pow10(exponent) : numerator;
    const bottom = exponent >= 0 ? denominator : denominator * pow10(-exponent);
    return { q: top / bottom, r: top % bottom, bottom };
  };
  let step = quotientAt(shift);
  if (numberOfDigits(step.q) > precision) {
    shift -= 1;
    step = quotientAt(shift);
  }
  const rounded = roundMagnitude(step.q, step.r, step.bottom, mode);
  const signed = negative ? -rounded : rounded;
  return { exact: false, value: shift >= 0 ? fromParts(signed, shift) : fromParts(signed * pow10(-shift), 0) };
}

/** Render with exactly `scale` fraction digits (trailing zeros kept); a zero never carries a minus sign. */
export function formatDecimalFixed(a) {
  requireDecimal(a, 'a');
  const negative = a.unscaled < 0n;
  let digits = absBig(a.unscaled).toString();
  if (a.scale > 0 && digits.length <= a.scale) digits = digits.padStart(a.scale + 1, '0');
  const split = digits.length - a.scale;
  const body = a.scale === 0 ? digits : `${digits.slice(0, split)}.${digits.slice(split)}`;
  return negative ? `-${body}` : body;
}
