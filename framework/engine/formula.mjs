// Formula checker and evaluator (spec section 12.2 l.636-664, section 11; errata E-0017..E-0022, E-0030..E-0033,
// E-0036, E-0037).
//
// Two pure, synchronous functions over the parsed `logic` object of a `formula` facet:
//   checkFormula(logic, { unitRegistry, inputs, precision? })            -> Diagnostic[] (sorted; [] when clean)
//   evaluateFormula(logic, values, { unitRegistry, inputs, precision? }) -> FormulaResult
//
// Contract highlights (see .strike-team/phases/P012-formula-logic/PLAN.md):
//   * Catalog diagnostics (KF-E-310, 313, 314, 315, 316) are RETURNED; every other defect is a THROWN LogicError with
//     an internal code. A KF- code is never thrown and INVALID_TABLE is never thrown (E-0033).
//   * Every value carries a unit monomial (unit id -> non-zero exponent). Identity is by unit id, never by
//     dimension; the engine never converts, looks up or invents a unit (l.589-602; E-0030). A KF-E-316 node has an
//     UNKNOWN unit: parents report nothing about it and the output check is skipped (E-0036 (1), E-0037 (2)).
//   * Static findings block evaluation (E-0032 (5)). Evaluation: supplied values are typed, guards run in order
//     before the expression, `if` is lazy, a null operand makes the arithmetic result null, rounding is applied
//     once to the final value (E-0031, E-0032).
//   * No binary floating point: values are exact BigInt decimals (decimal.mjs, decimal-ops.mjs).
//   * No parser and no code execution: the expression is a structured tree, walked by plain functions (l.638).
import { addDecimal, compareDecimal, formatDecimal, multiplyDecimal, parseDecimal, subtractDecimal } from './decimal.mjs';
import { absDecimal, divideDecimal, formatDecimalFixed, roundDecimal } from './decimal-ops.mjs';
import { compareStrings, makeFormulaDiagnostic, sortDiagnostics } from './logic-diagnostics.mjs';
import { LogicError } from './logic-errors.mjs';
import { compileLogicInputs, compileLogicPredicate, evaluateLogicPredicate, typeLogicValues } from './decision-table.mjs';
import { isUnitRegistry } from './units.mjs';

export const DEFAULT_PRECISION = 28; // l.1955 `decimal_precision: 28`
export const MAX_EXPRESSION_DEPTH = 1000; // E-0032 (6)

const ROUNDING_MODES = ['half-even', 'half-up', 'down', 'up'];
const ARITY = {
  add: [1, Infinity],
  subtract: [2, 2],
  multiply: [1, Infinity],
  divide: [2, 2],
  min: [1, Infinity],
  max: [1, Infinity],
  abs: [1, 1],
  round: [1, 1],
  clamp: [3, 3],
};
const CHAR_0 = 48;
const CHAR_9 = 57;
const ZERO = parseDecimal('0');

// ------------------------------------------------------------------------------------------------ utils
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

function typeName(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function ptr(base, token) {
  return `${base}/${String(token).replaceAll('~', '~0').replaceAll('/', '~1')}`;
}

function invalid(message, at) {
  return new LogicError('INVALID_EXPRESSION', message, { at });
}

function hasKeys(record, expected) {
  const keys = Object.keys(record);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(record, key));
}

/** `^OUT-[0-9]{4,}$` over ASCII digits, whole string (PLAN P-10; no host RegExp). */
function isOutcomeId(value) {
  if (typeof value !== 'string' || value.length < 8 || !value.startsWith('OUT-')) return false;
  for (let i = 4; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < CHAR_0 || code > CHAR_9) return false;
  }
  return true;
}

// ----------------------------------------------------------------------------------------------- monomials
// A monomial is an array of [unitId, exponent] pairs sorted by unit id (UTF-8 byte order), exponents non-zero.
// `null` stands for an UNKNOWN unit (the node above a KF-E-316 finding).
function monoCombine(a, b, sign) {
  const merged = new Map(a);
  for (const [id, exponent] of b) {
    const next = (merged.get(id) ?? 0) + sign * exponent;
    if (next === 0) merged.delete(id);
    else merged.set(id, next);
  }
  return [...merged].sort((x, y) => compareStrings(x[0], y[0]));
}

function monoEqual(a, b) {
  return a.length === b.length && a.every(([id, exponent], i) => id === b[i][0] && exponent === b[i][1]);
}

/** Unit text of a monomial: `id`, `id^n`, joined by `*`; the empty monomial is `null`. */
function monoText(mono) {
  if (mono.length === 0) return null;
  return mono.map(([id, exponent]) => (exponent === 1 ? id : `${id}^${exponent}`)).join('*');
}

/** A result is admissible iff it is dimensionless or exactly one registered unit id with exponent 1 (E-0030 (3)). */
const isAdmissible = (mono) => mono.length === 0 || (mono.length === 1 && mono[0][1] === 1);

// ------------------------------------------------------------------------------------------------ options
function readOptions(options) {
  if (!isRecord(options) || !isUnitRegistry(options.unitRegistry)) {
    throw new LogicError('INVALID_ARGUMENT', 'options.unitRegistry must be a registry built by buildUnitRegistry', {});
  }
  if (!Array.isArray(options.inputs)) {
    throw new LogicError('INVALID_ARGUMENT', 'options.inputs must be a list of input declarations', { found: typeName(options.inputs) });
  }
  let precision = DEFAULT_PRECISION;
  if (options.precision !== undefined) {
    if (!Number.isSafeInteger(options.precision) || options.precision < 1) {
      throw new LogicError('INVALID_ARGUMENT', 'options.precision must be an integer >= 1', {});
    }
    precision = options.precision;
  }
  return { registry: options.unitRegistry, rawInputs: options.inputs, precision };
}

// ------------------------------------------------------------------------------------------- compilation
function compilePredicateOf(st, predicate, pointer) {
  const compiled = compileLogicPredicate(predicate, st, pointer);
  for (const finding of compiled.findings) st.findings.push(finding);
  return { node: compiled.node, mentions: compiled.mentions };
}

/**
 * Validate one expression node and compile it. Node kinds: ref, const, op (the nine operators) and if.
 * Anything off-shape is INVALID_EXPRESSION; refs bind by full ref or suffix (E-0031 (1)).
 */
function compileExpression(raw, pointer, depth, st) {
  if (depth > MAX_EXPRESSION_DEPTH) throw invalid('the expression is nested deeper than the supported depth', pointer);
  if (!isRecord(raw)) throw invalid('an expression node must be a mapping', pointer);
  const hasRef = Object.hasOwn(raw, 'ref');
  const hasConst = Object.hasOwn(raw, 'const');
  const hasOp = Object.hasOwn(raw, 'op');
  if ((hasRef ? 1 : 0) + (hasConst ? 1 : 0) + (hasOp ? 1 : 0) !== 1) {
    throw invalid('an expression node is exactly one of {ref}, {const[, unit]} or {op, ...}', pointer);
  }
  if (hasRef) {
    if (!hasKeys(raw, ['ref']) || typeof raw.ref !== 'string' || raw.ref.length === 0) throw invalid('a ref node is {ref: <non-empty string>}', pointer);
    const index = st.bind(raw.ref, ptr(pointer, 'ref'));
    const input = st.inputs[index];
    if (input.type !== 'quantity' && input.type !== 'decimal') {
      throw new LogicError('TYPE_MISMATCH', `input ${input.ref} is ${input.type}: only quantity and decimal inputs are operands`, { at: pointer, input: input.ref, type: input.type });
    }
    return { t: 'ref', pointer, input: index, mono: input.type === 'quantity' ? [[input.unit, 1]] : [] };
  }
  if (hasConst) {
    const withUnit = Object.hasOwn(raw, 'unit');
    if (!(withUnit ? hasKeys(raw, ['const', 'unit']) : hasKeys(raw, ['const']))) throw invalid('a const node is {const: <decimal string>[, unit: <unit id>]}', pointer);
    const dec = parseDecimal(raw.const);
    if (!withUnit) return { t: 'const', pointer, dec, mono: [] };
    if (typeof raw.unit !== 'string') throw invalid('const.unit must be a unit id', ptr(pointer, 'unit'));
    if (!st.registry.has(raw.unit)) {
      throw new LogicError('UNKNOWN_UNIT', `unit "${raw.unit}" is not declared by the registry`, { at: ptr(pointer, 'unit'), unit: raw.unit });
    }
    return { t: 'const', pointer, dec, mono: [[raw.unit, 1]] };
  }
  if (raw.op === 'if') {
    if (!hasKeys(raw, ['op', 'cond', 'then', 'else'])) throw invalid('an if node is exactly {op: if, cond, then, else}', pointer);
    const cond = compilePredicateOf(st, raw.cond, ptr(pointer, 'cond'));
    const then = compileExpression(raw.then, ptr(pointer, 'then'), depth + 1, st);
    const other = compileExpression(raw.else, ptr(pointer, 'else'), depth + 1, st);
    return { t: 'if', pointer, cond, then, else: other };
  }
  if (typeof raw.op !== 'string' || !Object.hasOwn(ARITY, raw.op)) throw invalid('unknown operator', ptr(pointer, 'op'));
  if (!hasKeys(raw, ['op', 'args']) || !Array.isArray(raw.args)) throw invalid('an operator node is exactly {op, args: [expression, ...]}', pointer);
  const [least, most] = ARITY[raw.op];
  if (raw.args.length < least || raw.args.length > most) throw invalid(`${raw.op} takes ${least === most ? least : `at least ${least}`} argument(s)`, ptr(pointer, 'args'));
  if (raw.op === 'round' && st.rounding === null) throw invalid('round needs the logic-level `rounding` block (E-0032 (1))', pointer);
  const argsPointer = ptr(pointer, 'args');
  const args = [];
  for (let i = 0; i < raw.args.length; i += 1) args.push(compileExpression(raw.args[i], ptr(argsPointer, i), depth + 1, st));
  return { t: 'op', pointer, op: raw.op, args };
}

function compileRounding(raw) {
  if (!isRecord(raw) || !hasKeys(raw, ['mode', 'decimals'])) throw invalid('rounding is exactly {mode, decimals}', '/rounding');
  if (typeof raw.mode !== 'string' || !ROUNDING_MODES.includes(raw.mode)) throw invalid('rounding.mode must be half-even, half-up, down or up', '/rounding/mode');
  if (!Number.isSafeInteger(raw.decimals) || raw.decimals < 0) throw invalid('rounding.decimals must be an integer >= 0', '/rounding/decimals');
  return { mode: raw.mode, decimals: raw.decimals };
}

/** Validate and compile the whole formula (everything that is not a function of the supplied values). */
function prepare(logic, options) {
  const { registry, rawInputs, precision } = readOptions(options);
  const { inputs, bind } = compileLogicInputs(rawInputs, registry);
  if (!isRecord(logic)) throw invalid('logic must be a mapping', '');
  for (const key of Object.keys(logic)) {
    if (key !== 'kind' && key !== 'output' && key !== 'expression' && key !== 'rounding' && key !== 'guards') throw invalid(`unexpected key "${key}" in a formula`, ptr('', key));
  }
  if (logic.kind !== 'formula') throw invalid('logic.kind must be formula', '/kind');
  const output = logic.output;
  if (!isRecord(output) || !hasKeys(output, ['ref', 'unit']) || typeof output.ref !== 'string' || output.ref.length === 0 || typeof output.unit !== 'string') {
    throw invalid('output is exactly {ref: <non-empty string>, unit: <unit id>}', '/output');
  }
  if (!registry.has(output.unit)) {
    throw new LogicError('UNKNOWN_UNIT', `output unit "${output.unit}" is not declared by the registry`, { at: '/output/unit', unit: output.unit });
  }
  const rounding = Object.hasOwn(logic, 'rounding') ? compileRounding(logic.rounding) : null;
  const st = { inputs, bind, registry, findings: [], rounding };
  if (!Object.hasOwn(logic, 'expression')) throw invalid('a formula needs an `expression`', '/expression');
  const root = compileExpression(logic.expression, '/expression', 1, st);
  const guards = [];
  if (Object.hasOwn(logic, 'guards')) {
    if (!Array.isArray(logic.guards)) throw invalid('guards must be a list', '/guards');
    for (let index = 0; index < logic.guards.length; index += 1) {
      const guard = logic.guards[index];
      const at = ptr('/guards', index);
      if (!isRecord(guard) || !hasKeys(guard, ['when', 'raise'])) throw invalid('a guard is exactly {when, raise}', at);
      if (!isOutcomeId(guard.raise)) throw invalid('raise must match ^OUT-[0-9]{4,}$', ptr(at, 'raise'));
      const when = compilePredicateOf(st, guard.when, ptr(at, 'when'));
      guards.push({ node: when.node, mentions: when.mentions, raise: guard.raise });
    }
  }
  const outputUnit = registry.units.find((unit) => unit.id === output.unit);
  return { registry, inputs, bind, precision, output: { ref: output.ref, unit: output.unit, dimension: outputUnit.dimension }, rounding, root, guards, findings: st.findings };
}

// ------------------------------------------------------------------------------------- static analysis
const diag310 = (pointer, expected, found, source, message) => makeFormulaDiagnostic('KF-E-310', message, {
  pointer,
  rule: null,
  rule_index: null,
  expected_unit: expected,
  found_unit: found,
  source,
});

/**
 * Unit algebra over the tree (E-0030, E-0036 (1), E-0037 (2)). Returns the monomial of `node`, or null when it is
 * unknown. Findings are appended to `out`.
 */
function unitsOf(node, out) {
  if (node.t === 'ref' || node.t === 'const') return node.mono;
  if (node.t === 'if') {
    const then = unitsOf(node.then, out);
    const other = unitsOf(node.else, out);
    if (then === null) return other;
    if (other !== null && !monoEqual(then, other)) {
      out.push(diag310(node.else.pointer, monoText(then), monoText(other), 'expression', `the else branch has unit ${monoText(other) ?? 'none'}, the then branch ${monoText(then) ?? 'none'}`));
    }
    return then;
  }
  const monos = node.args.map((arg) => unitsOf(arg, out));
  switch (node.op) {
    case 'multiply':
    case 'divide': {
      if (monos.some((mono) => mono === null)) return null;
      let result = monos[0];
      for (let i = 1; i < monos.length; i += 1) result = monoCombine(result, monos[i], node.op === 'multiply' ? 1 : -1);
      if (isAdmissible(result)) return result;
      out.push(makeFormulaDiagnostic('KF-E-316', `the unit ${monoText(result)} of this ${node.op} does not exist in units.yaml`, {
        pointer: node.pointer,
        rule: null,
        rule_index: null,
        operation: node.op,
        unit: monoText(result),
      }));
      return null;
    }
    case 'abs':
    case 'round':
      return monos[0];
    default: { // add, subtract, min, max, clamp: identical monomials; the first KNOWN operand is the reference
      let reference = null;
      for (let i = 0; i < monos.length; i += 1) {
        if (monos[i] === null) continue;
        if (reference === null) {
          reference = monos[i];
        } else if (!monoEqual(reference, monos[i])) {
          out.push(diag310(node.args[i].pointer, monoText(reference), monoText(monos[i]), 'expression', `operand ${i} of ${node.op} has unit ${monoText(monos[i]) ?? 'none'}, expected ${monoText(reference) ?? 'none'}`));
        }
      }
      return reference;
    }
  }
}

/** Output check (l.663; E-0030 (4)); skipped when the computed unit is unknown (E-0036 (1)). */
function checkOutput(mono, output, out) {
  if (mono === null) return;
  const found = monoText(mono);
  if (mono.length === 0) {
    if (output.dimension === 'dimensionless') return;
  } else if (mono[0][0] === output.unit) {
    return;
  }
  out.push(diag310('/output/unit', output.unit, found, 'output', `the computed unit ${found ?? 'none'} does not match output.unit ${output.unit}`));
}

/** Truth of a single-input numeric predicate at R = zero, as `{ input, value }`, or null when it does not apply. */
function holdsAtZero(predicate, inputs) {
  if (predicate.mentions.length !== 1) return null;
  const index = predicate.mentions[0];
  const input = inputs[index];
  if (input.type !== 'quantity' && input.type !== 'decimal') return null;
  const typed = inputs.map(() => null);
  typed[index] = { kind: input.type === 'quantity' ? 'qty' : 'dec', dec: ZERO };
  return { input: index, value: evaluateLogicPredicate(predicate.node, typed) };
}

/** KF-E-313: every divide node needs a nonzero constant divisor or a protected bare-ref divisor (E-0032 (4), E-0036 (2)). */
function checkDivisions(node, protectedInputs, prepared, out) {
  if (node.t === 'ref' || node.t === 'const') return;
  if (node.t === 'if') {
    const zero = holdsAtZero(node.cond, prepared.inputs);
    const extend = (wanted) => {
      if (zero === null || zero.value !== wanted) return protectedInputs;
      return new Set([...protectedInputs, zero.input]);
    };
    checkDivisions(node.then, extend(false), prepared, out);
    checkDivisions(node.else, extend(true), prepared, out);
    return;
  }
  if (node.op === 'divide') {
    const divisor = node.args[1];
    let reason = null;
    let input = null;
    if (divisor.t === 'const') {
      if (compareDecimal(divisor.dec, ZERO) === 0) reason = 'zero_constant';
    } else if (divisor.t === 'ref') {
      if (!protectedInputs.has(divisor.input)) {
        reason = 'unprotected';
        input = prepared.inputs[divisor.input].ref;
      }
    } else {
      reason = 'unprotected';
    }
    if (reason !== null) {
      out.push(makeFormulaDiagnostic('KF-E-313', reason === 'zero_constant' ? 'division by a constant zero' : 'the divisor is not protected by a guard or an if condition', {
        pointer: node.pointer,
        rule: null,
        rule_index: null,
        reason,
        input,
      }));
    }
  }
  for (const arg of node.args) checkDivisions(arg, protectedInputs, prepared, out);
}

function staticDiagnostics(prepared) {
  const out = [...prepared.findings];
  checkOutput(unitsOf(prepared.root, out), prepared.output, out);
  const guarded = new Set();
  for (const guard of prepared.guards) {
    const zero = holdsAtZero(guard, prepared.inputs);
    if (zero !== null && zero.value) guarded.add(zero.input);
  }
  checkDivisions(prepared.root, guarded, prepared, out);
  return sortDiagnostics(out);
}

// ----------------------------------------------------------------------------------------------- evaluation
function evaluateOperator(node, rt) {
  const values = [];
  for (const arg of node.args) values.push(evalNode(arg, rt));
  if (node.op === 'clamp') {
    const [x, lo, hi] = values;
    if (lo !== null && hi !== null && compareDecimal(lo, hi) > 0) {
      throw new LogicError('INVALID_RANGE', 'clamp has lo greater than hi', { at: node.pointer });
    }
    if (x === null || lo === null || hi === null) return null;
    if (compareDecimal(x, lo) < 0) return lo;
    return compareDecimal(x, hi) > 0 ? hi : x;
  }
  if (values.some((value) => value === null)) return null; // l.606: null is absent, never zero
  switch (node.op) {
    case 'add': return values.reduce((acc, value) => addDecimal(acc, value));
    case 'subtract': return subtractDecimal(values[0], values[1]);
    case 'multiply': return values.reduce((acc, value) => multiplyDecimal(acc, value));
    case 'min': return values.reduce((acc, value) => (compareDecimal(value, acc) < 0 ? value : acc));
    case 'max': return values.reduce((acc, value) => (compareDecimal(value, acc) > 0 ? value : acc));
    case 'abs': return absDecimal(values[0]);
    case 'round': return roundDecimal(values[0], rt.rounding);
    default: { // divide
      const options = rt.rounding === null ? { precision: rt.precision } : { precision: rt.precision, mode: rt.rounding.mode };
      const quotient = divideDecimal(values[0], values[1], options);
      if (quotient.value === null) {
        throw new LogicError('INEXACT_DIVISION', `the quotient has more than ${rt.precision} significant digits and no rounding is declared`, { at: node.pointer });
      }
      return quotient.value;
    }
  }
}

function evalNode(node, rt) {
  switch (node.t) {
    case 'ref': {
      const value = rt.typed[node.input];
      return value === null ? null : value.dec;
    }
    case 'const': return node.dec;
    case 'if': return evaluateLogicPredicate(node.cond.node, rt.typed) ? evalNode(node.then, rt) : evalNode(node.else, rt);
    default: return evaluateOperator(node, rt);
  }
}

// ----------------------------------------------------------------------------------------------- public
/**
 * Static check of a formula: unit algebra (KF-E-310, KF-E-316), the output unit (KF-E-310), the division-by-zero
 * protection proof (KF-E-313) and the predicate findings of guards and `if` conditions (KF-E-310/314/315).
 * Returns the sorted diagnostics (`[]` when clean); throws LogicError for structural, binding and typing defects.
 * Never evaluates a value.
 */
export function checkFormula(logic, options) {
  return staticDiagnostics(prepare(logic, options));
}

/**
 * Evaluate a formula against supplied values (keyed by full ref or ref suffix). Order of work: arguments and
 * structure (typed errors), static findings (status 'error', nothing evaluated), supplied values bound and typed
 * (findings give status 'error'), guards in document order (the first true one ends with status 'raised'), the
 * expression, then the single final rounding.
 */
export function evaluateFormula(logic, values, options) {
  readOptions(options);
  if (!isRecord(values)) throw new LogicError('INVALID_ARGUMENT', 'values must be a mapping', { found: typeName(values) });
  const prepared = prepare(logic, options);
  const failure = (diagnostics) => ({ status: 'error', value: null, outcome: null, guard_index: null, diagnostics });
  const findings = staticDiagnostics(prepared);
  if (findings.length > 0) return failure(findings);
  const { typed, diagnostics } = typeLogicValues(prepared.inputs, prepared.bind, values);
  if (diagnostics.length > 0) return failure(sortDiagnostics(diagnostics));
  for (let index = 0; index < prepared.guards.length; index += 1) {
    const guard = prepared.guards[index];
    if (evaluateLogicPredicate(guard.node, typed)) {
      return { status: 'raised', value: null, outcome: guard.raise, guard_index: index, diagnostics: [] };
    }
  }
  const result = evalNode(prepared.root, { typed, rounding: prepared.rounding, precision: prepared.precision });
  if (result === null) return { status: 'ok', value: null, outcome: null, guard_index: null, diagnostics: [] };
  const text = prepared.rounding === null ? formatDecimal(result) : formatDecimalFixed(roundDecimal(result, prepared.rounding));
  return { status: 'ok', value: { value: text, unit: prepared.output.unit }, outcome: null, guard_index: null, diagnostics: [] };
}
