// Exact decimal arithmetic for rule evaluation (spec l.582; errata E-0017).
//
// A Decimal is { unscaled: bigint, scale: integer >= 0 } and denotes unscaled / 10^scale. No binary floating
// point is used anywhere in this module: parsing, comparison, addition, subtraction and multiplication are
// exact BigInt operations. Division, rounding and formulas belong to P012 (errata E-0022 D-04).
//
// Equality and ordering are by numeric value ("4.20" equals "4.2", "-0" equals "0").
import { LogicError } from './logic-errors.mjs';

const BRAND = new WeakSet();

const CHAR_0 = 48;
const CHAR_9 = 57;
const CHAR_MINUS = 45;
const CHAR_DOT = 46;

function isDigitCode(code) {
  return code >= CHAR_0 && code <= CHAR_9;
}

/**
 * Split a candidate string into its lexical parts, or return null when it is not
 * exactly `-?[0-9]+(\.[0-9]+)?` over ASCII digits (E-0017). No length limit.
 */
function lex(value) {
  if (typeof value !== 'string') return null;
  const length = value.length;
  let index = 0;
  let negative = false;
  if (length > 0 && value.charCodeAt(0) === CHAR_MINUS) {
    negative = true;
    index = 1;
  }
  const intStart = index;
  while (index < length && isDigitCode(value.charCodeAt(index))) index += 1;
  if (index === intStart) return null;
  const intEnd = index;
  if (index === length) return { negative, integer: value.slice(intStart, intEnd), fraction: '' };
  if (value.charCodeAt(index) !== CHAR_DOT) return null;
  index += 1;
  const fracStart = index;
  while (index < length && isDigitCode(value.charCodeAt(index))) index += 1;
  if (index === fracStart || index !== length) return null;
  return { negative, integer: value.slice(intStart, intEnd), fraction: value.slice(fracStart, index) };
}

function make(unscaled, scale) {
  const decimal = Object.freeze({ unscaled, scale });
  BRAND.add(decimal);
  return decimal;
}

function requireDecimal(value, name) {
  if (!BRAND.has(value)) {
    throw new LogicError('INVALID_ARGUMENT', `${name} is not a Decimal produced by decimal.mjs`, { argument: name });
  }
  return value;
}

/** True iff `value` is a string of the lexical form `-?[0-9]+(\.[0-9]+)?`. */
export function isDecimalString(value) {
  return lex(value) !== null;
}

/** Parse a decimal string. A non-string or an off-pattern string is INVALID_DECIMAL. */
export function parseDecimal(value) {
  const parts = lex(value);
  if (parts === null) {
    throw new LogicError('INVALID_DECIMAL', 'value is not a decimal string of the form -?[0-9]+(.[0-9]+)?', {
      value_type: value === null ? 'null' : typeof value,
      ...(typeof value === 'string' ? { value } : {}),
    });
  }
  const digits = BigInt(parts.integer + parts.fraction);
  return make(parts.negative ? -digits : digits, parts.fraction.length);
}

/** True iff `value` was produced by this module. */
export function isDecimal(value) {
  return typeof value === 'object' && value !== null && BRAND.has(value);
}

function pow10(exponent) {
  return 10n ** BigInt(exponent);
}

function align(a, b) {
  if (a.scale === b.scale) return { x: a.unscaled, y: b.unscaled, scale: a.scale };
  if (a.scale > b.scale) return { x: a.unscaled, y: b.unscaled * pow10(a.scale - b.scale), scale: a.scale };
  return { x: a.unscaled * pow10(b.scale - a.scale), y: b.unscaled, scale: b.scale };
}

/** Numeric comparison: -1, 0 or 1. */
export function compareDecimal(a, b) {
  requireDecimal(a, 'a');
  requireDecimal(b, 'b');
  const { x, y } = align(a, b);
  if (x < y) return -1;
  if (x > y) return 1;
  return 0;
}

export function equalsDecimal(a, b) {
  return compareDecimal(a, b) === 0;
}

export function addDecimal(a, b) {
  requireDecimal(a, 'a');
  requireDecimal(b, 'b');
  const { x, y, scale } = align(a, b);
  return make(x + y, scale);
}

export function subtractDecimal(a, b) {
  requireDecimal(a, 'a');
  requireDecimal(b, 'b');
  const { x, y, scale } = align(a, b);
  return make(x - y, scale);
}

export function multiplyDecimal(a, b) {
  requireDecimal(a, 'a');
  requireDecimal(b, 'b');
  return make(a.unscaled * b.unscaled, a.scale + b.scale);
}

/** Canonical minimal text: no leading zeros but one, no trailing fractional zeros, never "-0" (P-07). */
export function formatDecimal(a) {
  requireDecimal(a, 'a');
  const negative = a.unscaled < 0n;
  let digits = (negative ? -a.unscaled : a.unscaled).toString();
  if (a.scale > 0 && digits.length <= a.scale) digits = digits.padStart(a.scale + 1, '0');
  const split = digits.length - a.scale;
  const integer = digits.slice(0, split);
  let fraction = digits.slice(split);
  let end = fraction.length;
  while (end > 0 && fraction.charCodeAt(end - 1) === CHAR_0) end -= 1;
  fraction = fraction.slice(0, end);
  const body = fraction.length === 0 ? integer : `${integer}.${fraction}`;
  return negative ? `-${body}` : body;
}
