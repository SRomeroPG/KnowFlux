// Engine-owned linear-time matcher for a whitelisted RE2 subset (spec l.612; errata E-0021, E-0022 D-05).
//
// The host regular expression engine is NEVER used on a user pattern: the pattern is parsed here, compiled to
// a small instruction program and run by a Pike-style NFA simulation. Matching time is O(|text| * |program|)
// with no backtracking; the program is capped at 100000 instructions and nesting at 1000 levels, so both
// compile and match are bounded for any input. No recursion depth depends on the length of the text.
//
// Accepted syntax (everything else, and every syntax error, is `{ ok: false }`):
//   literals; escaped ASCII punctuation (\. \( \\ ...); \n \t \r \f \v; `.` (any code point except \n);
//   classes [...] with ranges and negation, containing literals, escaped punctuation, \n \t \r \f \v and
//   \d \w \s \D \W \S; \d \w \s \D \W \S outside classes (ASCII definitions);
//   anchors ^ and $ (start and end of the WHOLE text only); groups ( ) and (?: ); alternation |;
//   quantifiers * + ? {n} {n,} {n,m} with n, m <= 1000, each optionally followed by one lazy `?`.
// Rejected by design: backreferences, lookaround, named groups, inline flags, Unicode property escapes,
// possessive and atomic forms, \b \B \A \z \x, POSIX classes, nested quantifiers (a**), a quantifier on an
// anchor, an unescaped `{` that is not a quantifier, counts above 1000, programs above 100000 instructions.
// The empty pattern is valid and matches every string. Matching is an unanchored search, case sensitive,
// over code points.
import { LogicError } from './logic-errors.mjs';

export const RE2_MAX_REPEAT = 1000;
const MAX_PROGRAM_SIZE = 100000;
const MAX_NESTING = 1000;
const MAX_CODE_POINT = 0x10ffff;

const BRAND = new WeakSet();

class Re2SyntaxError extends Error {}

function fail(reason) {
  return new Re2SyntaxError(reason);
}

// ------------------------------------------------------------------------------------------ char classes
const DIGIT = [[48, 57]];
const WORD = [[48, 57], [65, 90], [95, 95], [97, 122]];
const SPACE = [[9, 10], [12, 13], [32, 32]];

function normalizeRanges(ranges) {
  const sorted = ranges.map(([lo, hi]) => [lo, hi]).sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  const merged = [];
  for (const [lo, hi] of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && lo <= last[1] + 1) {
      if (hi > last[1]) last[1] = hi;
    } else {
      merged.push([lo, hi]);
    }
  }
  return merged;
}

function complementRanges(ranges) {
  const merged = normalizeRanges(ranges);
  const out = [];
  let next = 0;
  for (const [lo, hi] of merged) {
    if (lo > next) out.push([next, lo - 1]);
    next = hi + 1;
  }
  if (next <= MAX_CODE_POINT) out.push([next, MAX_CODE_POINT]);
  return out;
}

function classEscape(letter) {
  switch (letter) {
    case 100: return DIGIT; // d
    case 68: return complementRanges(DIGIT); // D
    case 119: return WORD; // w
    case 87: return complementRanges(WORD); // W
    case 115: return SPACE; // s
    case 83: return complementRanges(SPACE); // S
    default: return null;
  }
}

function controlEscape(letter) {
  switch (letter) {
    case 110: return 10; // n
    case 116: return 9; // t
    case 114: return 13; // r
    case 102: return 12; // f
    case 118: return 11; // v
    default: return null;
  }
}

function isAsciiPunctuationEscape(code) {
  if (code >= 0x80) return false;
  if (code >= 48 && code <= 57) return false;
  if (code >= 65 && code <= 90) return false;
  if (code >= 97 && code <= 122) return false;
  return code !== 95;
}

// ------------------------------------------------------------------------------------------------ parser
const C = {
  BACKSLASH: 92, LPAREN: 40, RPAREN: 41, LBRACKET: 91, RBRACKET: 93, LBRACE: 123, RBRACE: 125,
  PIPE: 124, STAR: 42, PLUS: 43, QUESTION: 63, DOT: 46, CARET: 94, DOLLAR: 36, COLON: 58, MINUS: 45, COMMA: 44,
};

function parsePattern(cps) {
  let pos = 0;
  const length = cps.length;

  function parseAlt(depth) {
    if (depth > MAX_NESTING) throw fail(`nesting deeper than ${MAX_NESTING} levels`);
    const branches = [parseConcat(depth)];
    while (pos < length && cps[pos] === C.PIPE) {
      pos += 1;
      branches.push(parseConcat(depth));
    }
    return branches.length === 1 ? branches[0] : { t: 'alt', items: branches };
  }

  function parseConcat(depth) {
    const items = [];
    while (pos < length && cps[pos] !== C.PIPE && cps[pos] !== C.RPAREN) items.push(parseRepeat(depth));
    if (items.length === 0) return { t: 'empty' };
    return items.length === 1 ? items[0] : { t: 'cat', items };
  }

  function isQuantifierStart(code) {
    return code === C.STAR || code === C.PLUS || code === C.QUESTION || code === C.LBRACE;
  }

  function readCount() {
    const start = pos;
    let value = 0;
    while (pos < length && cps[pos] >= 48 && cps[pos] <= 57) {
      value = value * 10 + (cps[pos] - 48);
      if (value > 100000) value = 100000;
      pos += 1;
    }
    return pos === start ? -1 : value;
  }

  function parseBraces() {
    pos += 1; // {
    const min = readCount();
    if (min < 0) throw fail('an unescaped { must start a counted repetition {n}, {n,} or {n,m}');
    let max = min;
    if (pos < length && cps[pos] === C.COMMA) {
      pos += 1;
      if (pos < length && cps[pos] === C.RBRACE) {
        max = -1;
      } else {
        max = readCount();
        if (max < 0) throw fail('malformed counted repetition');
      }
    }
    if (pos >= length || cps[pos] !== C.RBRACE) throw fail('malformed counted repetition');
    pos += 1;
    if (min > RE2_MAX_REPEAT || max > RE2_MAX_REPEAT) throw fail(`repeat count above ${RE2_MAX_REPEAT}`);
    if (max !== -1 && max < min) throw fail('repeat range with max below min');
    return { min, max };
  }

  function parseRepeat(depth) {
    const atom = parseAtom(depth);
    if (pos >= length || !isQuantifierStart(cps[pos])) return atom;
    if (atom.t === 'bol' || atom.t === 'eol') throw fail('a quantifier on an anchor is not supported');
    let min;
    let max;
    const code = cps[pos];
    if (code === C.STAR) { min = 0; max = -1; pos += 1; }
    else if (code === C.PLUS) { min = 1; max = -1; pos += 1; }
    else if (code === C.QUESTION) { min = 0; max = 1; pos += 1; }
    else ({ min, max } = parseBraces());
    if (pos < length && cps[pos] === C.QUESTION) pos += 1; // lazy form: same match / no-match
    if (pos < length && isQuantifierStart(cps[pos])) throw fail('nested or possessive repetition operator');
    return { t: 'rep', min, max, item: atom };
  }

  function parseEscape(inClass) {
    // cps[pos] is the backslash
    if (pos + 1 >= length) throw fail('trailing backslash');
    const letter = cps[pos + 1];
    pos += 2;
    const set = classEscape(letter);
    if (set !== null) return { ranges: set };
    const control = controlEscape(letter);
    if (control !== null) return { cp: control };
    if (isAsciiPunctuationEscape(letter)) return { cp: letter };
    throw fail(inClass ? 'unsupported escape inside a character class' : 'unsupported escape sequence');
  }

  function parseClass() {
    pos += 1; // [
    let negate = false;
    if (pos < length && cps[pos] === C.CARET) { negate = true; pos += 1; }
    const ranges = [];
    let first = true;
    for (;;) {
      if (pos >= length) throw fail('missing closing ]');
      const code = cps[pos];
      if (code === C.RBRACKET && !first) { pos += 1; break; }
      if (code === C.LBRACKET && pos + 1 < length && cps[pos + 1] === C.COLON) throw fail('POSIX character classes are not supported');
      first = false;
      let lo;
      if (code === C.BACKSLASH) {
        const escaped = parseEscape(true);
        if (escaped.ranges !== undefined) {
          ranges.push(...escaped.ranges);
          if (pos < length && cps[pos] === C.MINUS && pos + 1 < length && cps[pos + 1] !== C.RBRACKET) throw fail('invalid range with a class escape');
          continue;
        }
        lo = escaped.cp;
      } else {
        lo = code;
        pos += 1;
      }
      if (pos + 1 < length && cps[pos] === C.MINUS && cps[pos + 1] !== C.RBRACKET) {
        pos += 1;
        let hi;
        if (cps[pos] === C.BACKSLASH) {
          const escaped = parseEscape(true);
          if (escaped.ranges !== undefined) throw fail('invalid range with a class escape');
          hi = escaped.cp;
        } else {
          hi = cps[pos];
          pos += 1;
        }
        if (hi < lo) throw fail('invalid character class range');
        ranges.push([lo, hi]);
      } else {
        ranges.push([lo, lo]);
      }
    }
    const merged = normalizeRanges(ranges);
    return { t: 'class', ranges: negate ? complementRanges(merged) : merged };
  }

  function parseAtom(depth) {
    const code = cps[pos];
    switch (code) {
      case C.LPAREN: {
        pos += 1;
        if (pos < length && cps[pos] === C.QUESTION) {
          if (pos + 1 < length && cps[pos + 1] === C.COLON) pos += 2;
          else throw fail('only (?: ) is supported; lookaround, named groups, inline flags and atomic groups are not');
        }
        const inner = parseAlt(depth + 1);
        if (pos >= length || cps[pos] !== C.RPAREN) throw fail('missing closing )');
        pos += 1;
        return inner;
      }
      case C.LBRACKET: return parseClass();
      case C.DOT: pos += 1; return { t: 'any' };
      case C.CARET: pos += 1; return { t: 'bol' };
      case C.DOLLAR: pos += 1; return { t: 'eol' };
      case C.STAR:
      case C.PLUS:
      case C.QUESTION:
        throw fail('nothing to repeat');
      case C.LBRACE:
        throw fail('an unescaped { must follow something to repeat');
      case C.BACKSLASH: {
        const escaped = parseEscape(false);
        if (escaped.ranges !== undefined) return { t: 'class', ranges: normalizeRanges(escaped.ranges) };
        return { t: 'char', cp: escaped.cp };
      }
      default:
        pos += 1;
        return { t: 'char', cp: code };
    }
  }

  const root = parseAlt(0);
  if (pos < length) throw fail('unmatched )');
  return root;
}

// ----------------------------------------------------------------------------------------- program size
function clamp(value) {
  return value > MAX_PROGRAM_SIZE + 1 ? MAX_PROGRAM_SIZE + 1 : value;
}

function sizeOf(node) {
  switch (node.t) {
    case 'empty': return 0;
    case 'cat': {
      let total = 0;
      for (const item of node.items) total = clamp(total + sizeOf(item));
      return total;
    }
    case 'alt': {
      let total = 2 * (node.items.length - 1);
      for (const item of node.items) total = clamp(total + sizeOf(item));
      return total;
    }
    case 'rep': {
      const s = sizeOf(node.item);
      const { min, max } = node;
      if (max === -1) return min === 0 ? clamp(s + 2) : clamp(min * s + 1);
      if (max === 0) return 0;
      return clamp(min * s + (max - min) * (s + 1));
    }
    default: return 1;
  }
}

// -------------------------------------------------------------------------------------------- emitter
const OP_CHAR = 0;
const OP_ANY = 1;
const OP_CLASS = 2;
const OP_SPLIT = 3;
const OP_JMP = 4;
const OP_BOL = 5;
const OP_EOL = 6;
const OP_MATCH = 7;

function emitProgram(root, total) {
  const ops = new Uint8Array(total);
  const xs = new Int32Array(total);
  const ys = new Int32Array(total);
  const classes = [];
  let pc = 0;

  function push(op, x = 0, y = 0) {
    ops[pc] = op;
    xs[pc] = x;
    ys[pc] = y;
    pc += 1;
    return pc - 1;
  }

  function emit(node) {
    switch (node.t) {
      case 'empty': return;
      case 'char': push(OP_CHAR, node.cp); return;
      case 'any': push(OP_ANY); return;
      case 'class': {
        classes.push(Int32Array.from(node.ranges.flat()));
        push(OP_CLASS, classes.length - 1);
        return;
      }
      case 'bol': push(OP_BOL); return;
      case 'eol': push(OP_EOL); return;
      case 'cat': for (const item of node.items) emit(item); return;
      case 'alt': {
        const jumps = [];
        for (let i = 0; i < node.items.length - 1; i += 1) {
          const split = push(OP_SPLIT, pc + 1, 0);
          emit(node.items[i]);
          jumps.push(push(OP_JMP, 0));
          ys[split] = pc;
        }
        emit(node.items[node.items.length - 1]);
        for (const jump of jumps) xs[jump] = pc;
        return;
      }
      default: emitRepeat(node);
    }
  }

  function emitStar(item) {
    const split = push(OP_SPLIT, pc + 1, 0);
    emit(item);
    push(OP_JMP, split);
    ys[split] = pc;
  }

  function emitPlus(item) {
    const start = pc;
    emit(item);
    push(OP_SPLIT, start, pc + 1);
  }

  function emitRepeat(node) {
    const { min, max, item } = node;
    if (max === -1) {
      if (min === 0) { emitStar(item); return; }
      for (let i = 0; i < min - 1; i += 1) emit(item);
      emitPlus(item);
      return;
    }
    for (let i = 0; i < min; i += 1) emit(item);
    const splits = [];
    for (let i = 0; i < max - min; i += 1) {
      splits.push(push(OP_SPLIT, pc + 1, 0));
      emit(item);
    }
    for (const split of splits) ys[split] = pc;
  }

  emit(root);
  push(OP_MATCH);
  return Object.freeze({ ops, xs, ys, classes: Object.freeze(classes), size: total });
}

// ----------------------------------------------------------------------------------------------- API
/**
 * Compile `pattern`. Returns `{ ok: true, program }` or `{ ok: false, reason }`. Never throws for a string.
 * A non-string argument is INVALID_ARGUMENT.
 */
export function compileRe2(pattern) {
  if (typeof pattern !== 'string') {
    throw new LogicError('INVALID_ARGUMENT', 'a regular expression pattern must be a string', { value_type: pattern === null ? 'null' : typeof pattern });
  }
  const cps = [];
  for (const ch of pattern) cps.push(ch.codePointAt(0));
  try {
    const root = parsePattern(cps);
    const total = sizeOf(root) + 1;
    if (total > MAX_PROGRAM_SIZE) throw fail(`compiled program exceeds ${MAX_PROGRAM_SIZE} instructions`);
    const program = emitProgram(root, total);
    BRAND.add(program);
    return { ok: true, program };
  } catch (error) {
    if (error instanceof Re2SyntaxError) return { ok: false, reason: error.message };
    throw error;
  }
}

class SparseSet {
  constructor(size) {
    this.dense = new Int32Array(size);
    this.sparse = new Int32Array(size);
    this.count = 0;
  }

  has(value) {
    const index = this.sparse[value];
    return index < this.count && this.dense[index] === value;
  }

  add(value) {
    this.sparse[value] = this.count;
    this.dense[this.count] = value;
    this.count += 1;
  }

  clear() {
    this.count = 0;
  }
}

function inClass(ranges, code) {
  for (let i = 0; i < ranges.length; i += 2) {
    if (code < ranges[i]) return false;
    if (code <= ranges[i + 1]) return true;
  }
  return false;
}

/** Unanchored, case-sensitive search over code points, in time linear in the length of `text`. */
export function searchRe2(program, text) {
  if (typeof program !== 'object' || program === null || !BRAND.has(program)) {
    throw new LogicError('INVALID_ARGUMENT', 'program was not produced by compileRe2', {});
  }
  if (typeof text !== 'string') throw new LogicError('INVALID_ARGUMENT', 'text must be a string', { value_type: text === null ? 'null' : typeof text });
  const cps = [];
  for (const ch of text) cps.push(ch.codePointAt(0));
  const length = cps.length;
  const { ops, xs, ys, classes, size } = program;
  const matchPc = size - 1;
  let current = new SparseSet(size);
  let upcoming = new SparseSet(size);
  const stack = [];

  function addThread(list, start, atBegin, atEnd) {
    stack.push(start);
    while (stack.length > 0) {
      const pc = stack.pop();
      if (list.has(pc)) continue;
      list.add(pc);
      switch (ops[pc]) {
        case OP_JMP: stack.push(xs[pc]); break;
        case OP_SPLIT: stack.push(ys[pc]); stack.push(xs[pc]); break;
        case OP_BOL: if (atBegin) stack.push(pc + 1); break;
        case OP_EOL: if (atEnd) stack.push(pc + 1); break;
        default: break;
      }
    }
  }

  for (let pos = 0; ; pos += 1) {
    addThread(current, 0, pos === 0, pos === length);
    if (current.has(matchPc)) return true;
    if (pos === length) return false;
    const code = cps[pos];
    upcoming.clear();
    const atEnd = pos + 1 === length;
    for (let i = 0; i < current.count; i += 1) {
      const pc = current.dense[i];
      const op = ops[pc];
      let advance = false;
      if (op === OP_CHAR) advance = xs[pc] === code;
      else if (op === OP_ANY) advance = code !== 10;
      else if (op === OP_CLASS) advance = inClass(classes[xs[pc]], code);
      if (advance) addThread(upcoming, pc + 1, false, atEnd);
    }
    const swap = current;
    current = upcoming;
    upcoming = swap;
  }
}
