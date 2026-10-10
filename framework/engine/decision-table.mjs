// Decision-table checker and evaluator (spec section 12.1 l.614-635, section 11; errata E-0017..E-0022).
//
// Two pure, synchronous functions over the parsed `logic` object of a decision-table facet:
//   checkDecisionTable(logic, { unitRegistry, proofLimit? })        -> Diagnostic[] (sorted; [] when clean)
//   evaluateDecisionTable(logic, values, { unitRegistry })           -> EvaluationResult
//
// Contract highlights (see .strike-team/phases/P011-decision-table-logic/PLAN.md):
//   * Catalog diagnostics (KF-E-310, 311, 312, 314, 315) are RETURNED; every other defect is a THROWN
//     LogicError with an internal code (P-02). A KF- code is never thrown.
//   * Structurally invalid input is INVALID_TABLE (E-0022 D-01); no JSON Schema validation happens here.
//   * Null logic is binary (E-0019): every matcher except `is_null` is false on a null/absent operand.
//   * No arithmetic other than exact decimal comparison; no binary floating point; no implicit unit conversion.
//   * Overlap and exhaustiveness proofs are enumeration or per-field interval/set comparison, never a solver,
//     and fail closed (E-0020).
import { compareDecimal, parseDecimal } from './decimal.mjs';
import { makeDiagnostic, sortDiagnostics } from './logic-diagnostics.mjs';
import { LogicError } from './logic-errors.mjs';
import { compileRe2, searchRe2 } from './regex-re2.mjs';
import { isUnitRegistry } from './units.mjs';

export const DEFAULT_PROOF_LIMIT = 256;

const MAX_DEPTH = 1000;
const INPUT_TYPES = ['enum', 'quantity', 'decimal', 'string', 'boolean'];
const HIT_POLICIES = ['first', 'unique', 'collect'];
const OPERATORS = ['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in', 'not_in', 'between', 'matches', 'is_null'];
const NOT_PROVABLE_OPS = ['ne', 'not_in', 'matches', 'is_null'];

// ------------------------------------------------------------------------------------------------ utils
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

function typeName(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function isQuantityShape(value) {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return keys.length === 2 && Object.hasOwn(value, 'value') && Object.hasOwn(value, 'unit');
}

function escapePointerToken(token) {
  return String(token).replaceAll('~', '~0').replaceAll('/', '~1');
}

function ptr(base, token) {
  return `${base}/${escapePointerToken(token)}`;
}

/** Own-property record builder (safe for keys such as "__proto__"). */
function record(entries) {
  const out = {};
  for (const [key, value] of entries) {
    Object.defineProperty(out, key, { value, enumerable: true, writable: true, configurable: true });
  }
  return out;
}

function countValue(big) {
  return big <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(big) : big.toString();
}

function err(code, message, details = {}) {
  return new LogicError(code, message, details);
}

function cloneData(value, depth = 0) {
  if (depth > MAX_DEPTH) throw err('INVALID_TABLE', 'then is nested deeper than the supported depth', {});
  if (Array.isArray(value)) return value.map((item) => cloneData(item, depth + 1));
  if (typeof value === 'object' && value !== null) {
    return record(Object.keys(value).map((key) => [key, cloneData(value[key], depth + 1)]));
  }
  return value;
}

// ------------------------------------------------------------------------------------------ options
function readOptions(options) {
  if (!isRecord(options) || !isUnitRegistry(options.unitRegistry)) {
    throw err('INVALID_ARGUMENT', 'options.unitRegistry must be a registry built by buildUnitRegistry', {});
  }
  let proofLimit = DEFAULT_PROOF_LIMIT;
  if (options.proofLimit !== undefined) {
    if (!Number.isInteger(options.proofLimit) || options.proofLimit < 0) {
      throw err('INVALID_ARGUMENT', 'options.proofLimit must be an integer >= 0', {});
    }
    proofLimit = options.proofLimit;
  }
  return { registry: options.unitRegistry, proofLimit };
}

// ------------------------------------------------------------------------------------------- inputs
function declareInput(raw, index, registry, seen) {
  const at = `/inputs/${index}`;
  if (!isRecord(raw)) throw err('INVALID_TABLE', 'an input declaration must be a mapping', { at });
  if (typeof raw.ref !== 'string' || raw.ref.length === 0) throw err('INVALID_TABLE', 'an input needs a non-empty string `ref`', { at });
  if (typeof raw.type !== 'string') throw err('INVALID_TABLE', 'an input needs a string `type`', { at });
  if (!INPUT_TYPES.includes(raw.type)) {
    throw err('UNSUPPORTED_INPUT_TYPE', `input type "${raw.type}" is not supported`, { at, type: raw.type });
  }
  if (seen.has(raw.ref)) throw err('INVALID_INPUT_DECLARATION', `input ref "${raw.ref}" is declared twice`, { at });
  seen.add(raw.ref);
  const input = { index, ref: raw.ref, type: raw.type, unit: null, domain: null, domainSet: null };
  const dot = raw.ref.lastIndexOf('.');
  input.suffix = dot < 0 ? raw.ref : raw.ref.slice(dot + 1);
  if (raw.type === 'quantity') {
    if (typeof raw.unit !== 'string' || raw.unit.length === 0) {
      throw err('INVALID_INPUT_DECLARATION', 'a quantity input needs a `unit`', { at: `${at}/unit` });
    }
    if (!registry.has(raw.unit)) throw err('UNKNOWN_UNIT', `unit "${raw.unit}" is not declared by the registry`, { at: `${at}/unit`, unit: raw.unit });
    input.unit = raw.unit;
  } else if (raw.unit !== undefined) {
    throw err('INVALID_INPUT_DECLARATION', '`unit` is only valid on a quantity input', { at: `${at}/unit` });
  }
  if (raw.type === 'enum') {
    if (raw.domain !== undefined) {
      const domain = raw.domain;
      if (!Array.isArray(domain) || domain.length === 0 || domain.some((item) => typeof item !== 'string')) {
        throw err('INVALID_INPUT_DECLARATION', 'an enum `domain` must be a non-empty list of strings', { at: `${at}/domain` });
      }
      const set = new Set(domain);
      if (set.size !== domain.length) throw err('INVALID_INPUT_DECLARATION', 'an enum `domain` must not repeat a value', { at: `${at}/domain` });
      input.domain = [...domain];
      input.domainSet = set;
    }
  } else if (raw.domain !== undefined) {
    throw err('INVALID_INPUT_DECLARATION', '`domain` is only valid on an enum input', { at: `${at}/domain` });
  }
  return input;
}

/**
 * Bind a `when` key or a supplied key to an input index (E-0019, E-0022 D-02, E-0027 (2)). An input is a candidate
 * when its full `ref` equals the key or the part of its `ref` after the last dot equals the key. No candidate is
 * UNBOUND_FIELD; two candidates are AMBIGUOUS_FIELD, even when the key is the full ref of one of them (inputs `x`
 * and `A.x`: the key `x` is ambiguous, the key `A.x` binds by full ref).
 */
function makeBinder(inputs) {
  const byKey = new Map();
  const add = (key, index) => {
    if (!byKey.has(key)) byKey.set(key, []);
    const list = byKey.get(key);
    if (!list.includes(index)) list.push(index);
  };
  for (const input of inputs) {
    add(input.ref, input.index);
    add(input.suffix, input.index);
  }
  return (key, pointer) => {
    const candidates = byKey.get(key) ?? [];
    if (candidates.length === 0) throw err('UNBOUND_FIELD', `"${key}" matches no input`, { key, at: pointer });
    if (candidates.length > 1) {
      throw err('AMBIGUOUS_FIELD', `"${key}" matches several inputs; use the full ref`, { key, at: pointer, inputs: candidates.map((i) => inputs[i].ref) });
    }
    return candidates[0];
  };
}

// ------------------------------------------------------------------------------------ rules and when
function validateQuantityLiteral(ctx, value, pointer) {
  if (typeof value.unit !== 'string' || !ctx.registry.has(value.unit)) {
    throw err('UNKNOWN_UNIT', `unit "${String(value.unit)}" is not declared by the registry`, { at: pointer, unit: value.unit });
  }
  return parseDecimal(value.value);
}

function finding310(ctx, input, pointer, foundUnit) {
  ctx.findings.push(makeDiagnostic(
    'KF-E-310',
    `unit mismatch for input ${input.ref}: declared ${input.unit ?? 'none'}, literal ${foundUnit ?? 'none'}`,
    {
      pointer,
      rule: ctx.rule.id,
      rule_index: ctx.rule.index,
      input: input.ref,
      expected_unit: input.unit,
      found_unit: foundUnit,
      source: 'literal',
    },
  ));
}

/**
 * Check one literal operand against the input's declared type. Returns an operand:
 *   { kind: 'null' } | { kind: 'dec', dec } | { kind: 'qty', dec } | { kind: 'str', value } |
 *   { kind: 'bool', value } | { kind: 'bad' }   ('bad' = a KF-E-310 finding was recorded)
 */
function readOperand(ctx, input, value, pointer, { allowNull }) {
  if (value === null) {
    if (allowNull) return { kind: 'null' };
    throw err('INVALID_DECIMAL', 'null is not a valid operand here', { at: pointer });
  }
  // E-0025 (3), E-0027 (3): a quantity literal against any input that is not a quantity is exactly one KF-E-310
  // (the non-quantity side has no unit); domain membership (KF-E-314) applies to scalar values only.
  if (input.type !== 'quantity' && isQuantityShape(value)) {
    validateQuantityLiteral(ctx, value, pointer);
    finding310(ctx, input, pointer, value.unit);
    return { kind: 'bad' };
  }
  switch (input.type) {
    case 'decimal': return { kind: 'dec', dec: parseDecimal(value) };
    case 'quantity': {
      if (isQuantityShape(value)) {
        const dec = validateQuantityLiteral(ctx, value, pointer);
        if (value.unit !== input.unit) {
          finding310(ctx, input, pointer, value.unit);
          return { kind: 'bad' };
        }
        return { kind: 'qty', dec };
      }
      if (isRecord(value) || Array.isArray(value)) throw err('INVALID_TABLE', 'a quantity operand needs exactly `value` and `unit`', { at: pointer });
      // E-0025 (3): a string or boolean literal is a bare scalar against a quantity input; other types are not decimals.
      if (typeof value !== 'string' && typeof value !== 'boolean') parseDecimal(value);
      finding310(ctx, input, pointer, null);
      return { kind: 'bad' };
    }
    case 'enum': {
      if (typeof value !== 'string') throw err('TYPE_MISMATCH', 'an enum operand must be a string', { at: pointer, input: input.ref });
      if (input.domainSet !== null && !input.domainSet.has(value)) {
        ctx.findings.push(makeDiagnostic('KF-E-314', `value "${value}" is outside the domain of ${input.ref}`, {
          pointer,
          rule: ctx.rule.id,
          rule_index: ctx.rule.index,
          input: input.ref,
          value,
          source: 'literal',
        }));
      }
      return { kind: 'str', value };
    }
    case 'string': {
      if (typeof value !== 'string') throw err('TYPE_MISMATCH', 'a string operand must be a string', { at: pointer, input: input.ref });
      return { kind: 'str', value };
    }
    default: {
      if (typeof value !== 'boolean') throw err('TYPE_MISMATCH', 'a boolean operand must be true or false', { at: pointer, input: input.ref });
      return { kind: 'bool', value };
    }
  }
}

function readOperandList(ctx, input, list, pointer) {
  if (!Array.isArray(list)) throw err('INVALID_TABLE', 'the operand must be a list', { at: pointer });
  return list.map((item, i) => readOperand(ctx, input, item, ptr(pointer, String(i)), { allowNull: true }));
}

function compileMatcher(ctx, input, matcher, pointer) {
  let op = 'eq';
  let arg = matcher;
  let argPointer = pointer;
  if (isRecord(matcher) && !isQuantityShape(matcher)) {
    const keys = Object.keys(matcher);
    if (keys.length !== 1 || !OPERATORS.includes(keys[0])) {
      throw err('INVALID_TABLE', 'a matcher mapping must have exactly one known operator', { at: pointer, keys });
    }
    op = keys[0];
    arg = matcher[op];
    argPointer = ptr(pointer, op);
  } else if (Array.isArray(matcher)) {
    throw err('INVALID_TABLE', 'a matcher cannot be a list', { at: pointer });
  }
  const node = { t: 'cmp', op, input: input.index };
  switch (op) {
    case 'eq':
    case 'ne':
      node.operand = readOperand(ctx, input, arg, argPointer, { allowNull: true });
      return node;
    case 'in':
    case 'not_in':
      node.operands = readOperandList(ctx, input, arg, argPointer);
      return node;
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte':
      if (input.type !== 'decimal' && input.type !== 'quantity') {
        throw err('TYPE_MISMATCH', `${op} applies only to decimal and quantity inputs`, { at: pointer, input: input.ref, type: input.type });
      }
      node.operand = readOperand(ctx, input, arg, argPointer, { allowNull: false });
      return node;
    case 'between': {
      if (input.type !== 'decimal' && input.type !== 'quantity') {
        throw err('TYPE_MISMATCH', 'between applies only to decimal and quantity inputs', { at: pointer, input: input.ref, type: input.type });
      }
      if (!Array.isArray(arg) || arg.length !== 2) throw err('INVALID_TABLE', 'between needs a list of exactly [min, max]', { at: argPointer });
      const min = readOperand(ctx, input, arg[0], ptr(argPointer, '0'), { allowNull: false });
      const max = readOperand(ctx, input, arg[1], ptr(argPointer, '1'), { allowNull: false });
      if (min.kind !== 'bad' && max.kind !== 'bad' && compareDecimal(min.dec, max.dec) > 0) {
        throw err('INVALID_RANGE', 'between has min greater than max', { at: argPointer });
      }
      node.operands = [min, max];
      return node;
    }
    case 'matches': {
      if (typeof arg !== 'string') throw err('INVALID_TABLE', 'matches needs a pattern string', { at: argPointer });
      if (input.type !== 'string' && input.type !== 'enum') {
        throw err('TYPE_MISMATCH', 'matches applies only to string and enum inputs', { at: pointer, input: input.ref, type: input.type });
      }
      const compiled = compileRe2(arg);
      if (compiled.ok) {
        node.program = compiled.program;
      } else {
        node.program = null;
        ctx.findings.push(makeDiagnostic('KF-E-315', `pattern is not compilable in RE2: ${compiled.reason}`, {
          pointer: argPointer,
          rule: ctx.rule.id,
          rule_index: ctx.rule.index,
          pattern: arg,
          reason: compiled.reason,
        }));
      }
      return node;
    }
    default: // is_null
      if (typeof arg !== 'boolean') throw err('INVALID_TABLE', 'is_null needs true or false', { at: argPointer });
      node.flag = arg;
      return node;
  }
}

function compilePredicate(ctx, node, pointer, top, depth) {
  if (depth > MAX_DEPTH) throw err('INVALID_TABLE', 'predicate nested deeper than the supported depth', { at: pointer });
  if (!isRecord(node)) throw err('INVALID_TABLE', 'a predicate must be a mapping', { at: pointer });
  const keys = Object.keys(node);
  if (keys.length === 0) {
    if (top) return { t: 'true' };
    throw err('EMPTY_PREDICATE', 'an empty predicate is not allowed inside all/any/not', { at: pointer });
  }
  const items = [];
  for (const key of keys) {
    const here = ptr(pointer, key);
    if (key === 'all' || key === 'any') {
      const list = node[key];
      if (!Array.isArray(list)) throw err('INVALID_TABLE', `${key} needs a list of predicates`, { at: here });
      if (list.length === 0) throw err('EMPTY_PREDICATE', `${key} must not be an empty list`, { at: here });
      const children = list.map((child, i) => compilePredicate(ctx, child, ptr(here, String(i)), false, depth + 1));
      items.push({ t: key === 'all' ? 'and' : 'or', items: children });
    } else if (key === 'not') {
      items.push({ t: 'not', item: compilePredicate(ctx, node[key], here, false, depth + 1) });
    } else {
      const index = ctx.bind(key, here);
      items.push(compileMatcher(ctx, ctx.inputs[index], node[key], here));
    }
  }
  return items.length === 1 ? items[0] : { t: 'and', items };
}

/** D-07: a mapping with exactly the keys {value, unit}, at any depth of `then`, is a quantity. */
function scanThen(ctx, value, pointer, depth) {
  if (depth > MAX_DEPTH) throw err('INVALID_TABLE', 'then is nested deeper than the supported depth', { at: pointer });
  if (Array.isArray(value)) {
    value.forEach((item, i) => scanThen(ctx, item, ptr(pointer, String(i)), depth + 1));
  } else if (isRecord(value)) {
    if (isQuantityShape(value)) {
      validateQuantityLiteral(ctx, value, pointer);
      return;
    }
    for (const key of Object.keys(value)) scanThen(ctx, value[key], ptr(pointer, key), depth + 1);
  }
}

function prepare(logic, registry) {
  if (!isRecord(logic)) throw err('INVALID_TABLE', 'logic must be a mapping', { at: '' });
  if (logic.kind !== 'decision-table') throw err('INVALID_TABLE', 'logic.kind must be decision-table', { at: '/kind', kind: typeName(logic.kind) === 'string' ? logic.kind : typeName(logic.kind) });
  if (!HIT_POLICIES.includes(logic.hit_policy)) throw err('INVALID_TABLE', 'hit_policy must be first, unique or collect', { at: '/hit_policy' });
  if (logic.exhaustive !== undefined && typeof logic.exhaustive !== 'boolean') throw err('INVALID_TABLE', 'exhaustive must be a boolean', { at: '/exhaustive' });
  if (!Array.isArray(logic.inputs)) throw err('INVALID_TABLE', 'inputs must be a list', { at: '/inputs' });
  if (!Array.isArray(logic.rules)) throw err('INVALID_TABLE', 'rules must be a list', { at: '/rules' });

  const seenRefs = new Set();
  const inputs = logic.inputs.map((raw, index) => declareInput(raw, index, registry, seenRefs));
  const bind = makeBinder(inputs);
  const findings = [];
  const ids = new Set();
  const rules = [];
  let defaults = 0;

  logic.rules.forEach((raw, index) => {
    const at = `/rules/${index}`;
    if (!isRecord(raw)) throw err('INVALID_TABLE', 'a rule must be a mapping', { at });
    if (typeof raw.id !== 'string' || raw.id.length === 0) throw err('INVALID_TABLE', 'a rule needs a non-empty string `id`', { at: `${at}/id` });
    if (ids.has(raw.id)) throw err('DUPLICATE_RULE_ID', `rule id "${raw.id}" is used twice`, { at: `${at}/id`, id: raw.id });
    ids.add(raw.id);
    if (!isRecord(raw.then)) throw err('INVALID_TABLE', 'a rule needs a `then` mapping', { at: `${at}/then` });
    const ctx = { inputs, bind, registry, findings, rule: { id: raw.id, index } };
    let node = null;
    const isDefault = raw.when === 'default';
    if (isDefault) {
      defaults += 1;
      if (defaults > 1) throw err('DUPLICATE_DEFAULT', 'more than one rule has `when: default`', { at: `${at}/when` });
    } else {
      if (raw.when === undefined) throw err('INVALID_TABLE', 'a rule needs `when`', { at: `${at}/when` });
      node = compilePredicate(ctx, raw.when, `${at}/when`, true, 0);
    }
    scanThen(ctx, raw.then, `${at}/then`, 0);
    rules.push({ id: raw.id, index, isDefault, node, then: raw.then });
  });

  return {
    hitPolicy: logic.hit_policy,
    exhaustive: logic.exhaustive === true,
    inputs,
    bind,
    rules,
    findings,
  };
}

// -------------------------------------------------------------------------------------- evaluation
function equalsOperand(value, operand) {
  if (operand.kind === 'null' || operand.kind === 'bad' || value.kind !== operand.kind) return false;
  if (operand.kind === 'dec' || operand.kind === 'qty') return compareDecimal(value.dec, operand.dec) === 0;
  return value.value === operand.value;
}

function orderable(operand) {
  return operand.kind === 'dec' || operand.kind === 'qty';
}

function evaluateNode(node, values) {
  switch (node.t) {
    case 'true': return true;
    case 'and': return node.items.every((item) => evaluateNode(item, values));
    case 'or': return node.items.some((item) => evaluateNode(item, values));
    case 'not': return !evaluateNode(node.item, values);
    default: return evaluateComparison(node, values);
  }
}

function evaluateComparison(node, values) {
  const value = values[node.input];
  if (node.op === 'is_null') return (value === null) === node.flag;
  if (value === null) return false;
  switch (node.op) {
    case 'eq': return equalsOperand(value, node.operand);
    case 'ne': return node.operand.kind !== 'null' && node.operand.kind !== 'bad' && !equalsOperand(value, node.operand);
    case 'in': return node.operands.some((operand) => equalsOperand(value, operand));
    // E-0026 (1): a null element never matches `in`, and makes `not_in` false (element-wise `ne` is false on null)
    case 'not_in': return node.operands.every((operand) => operand.kind !== 'null' && operand.kind !== 'bad' && !equalsOperand(value, operand));
    case 'lt': return orderable(node.operand) && compareDecimal(value.dec, node.operand.dec) < 0;
    case 'lte': return orderable(node.operand) && compareDecimal(value.dec, node.operand.dec) <= 0;
    case 'gt': return orderable(node.operand) && compareDecimal(value.dec, node.operand.dec) > 0;
    case 'gte': return orderable(node.operand) && compareDecimal(value.dec, node.operand.dec) >= 0;
    case 'between': {
      const [min, max] = node.operands;
      return orderable(min) && orderable(max) && compareDecimal(value.dec, min.dec) >= 0 && compareDecimal(value.dec, max.dec) <= 0;
    }
    default: // matches
      return node.program !== null && searchRe2(node.program, value.value);
  }
}

/** Convert one supplied value to a typed value, or record KF-E-310 / KF-E-314. Typed errors are thrown. */
function typeSupplied(input, raw, diagnostics) {
  if (raw === undefined || raw === null) return null;
  const at = `/inputs/${input.index}`;
  const unitFinding = (foundUnit) => diagnostics.push(makeDiagnostic(
    'KF-E-310',
    `unit mismatch for supplied input ${input.ref}: declared ${input.unit ?? 'none'}, received ${foundUnit ?? 'none'}`,
    {
      pointer: at,
      rule: null,
      rule_index: null,
      input: input.ref,
      expected_unit: input.unit,
      found_unit: foundUnit,
      source: 'value',
    },
  ));
  if (input.type !== 'quantity' && isQuantityShape(raw)) {
    // E-0025 (3): a quantity supplied for a decimal, enum, string or boolean input; the declared side has no unit.
    parseDecimal(raw.value);
    unitFinding(typeof raw.unit === 'string' ? raw.unit : null);
    return null;
  }
  switch (input.type) {
    case 'quantity': {
      if (isQuantityShape(raw)) {
        const dec = parseDecimal(raw.value);
        if (typeof raw.unit !== 'string') throw err('TYPE_MISMATCH', 'a quantity unit must be a string', { at, input: input.ref });
        if (raw.unit !== input.unit) {
          unitFinding(raw.unit);
          return null;
        }
        return { kind: 'qty', dec };
      }
      // E-0025 (3): any non-quantity scalar (decimal string, string, enum value, boolean) is a bare scalar.
      if (typeof raw === 'string' || typeof raw === 'boolean') {
        unitFinding(null);
        return null;
      }
      if (typeof raw === 'number' || typeof raw === 'bigint') parseDecimal(raw);
      throw err('TYPE_MISMATCH', 'a quantity input needs a quantity {value, unit}', { at, input: input.ref, found: typeName(raw) });
    }
    case 'decimal': return { kind: 'dec', dec: parseDecimal(raw) };
    case 'enum': {
      if (typeof raw !== 'string') throw err('TYPE_MISMATCH', 'an enum input needs a string', { at, input: input.ref, found: typeName(raw) });
      if (input.domainSet !== null && !input.domainSet.has(raw)) {
        diagnostics.push(makeDiagnostic('KF-E-314', `value "${raw}" is outside the domain of ${input.ref}`, {
          pointer: at,
          rule: null,
          rule_index: null,
          input: input.ref,
          value: raw,
          source: 'value',
        }));
        return null;
      }
      return { kind: 'str', value: raw };
    }
    case 'string': {
      if (typeof raw !== 'string') throw err('TYPE_MISMATCH', 'a string input needs a string', { at, input: input.ref, found: typeName(raw) });
      return { kind: 'str', value: raw };
    }
    default: {
      if (typeof raw !== 'boolean') throw err('TYPE_MISMATCH', 'a boolean input needs true or false', { at, input: input.ref, found: typeName(raw) });
      return { kind: 'bool', value: raw };
    }
  }
}

function bindSupplied(table, values) {
  const supplied = new Array(table.inputs.length).fill(undefined);
  const bound = new Array(table.inputs.length).fill(false);
  for (const key of Object.keys(values)) {
    const index = table.bind(key, ptr('/values', key));
    if (bound[index]) {
      throw err('AMBIGUOUS_FIELD', `two supplied keys bind to input ${table.inputs[index].ref}`, { key, input: table.inputs[index].ref });
    }
    bound[index] = true;
    supplied[index] = values[key];
  }
  return supplied;
}

function rowResult(rule) {
  return { rule: rule.id, rule_index: rule.index, then: cloneData(rule.then) };
}

function evaluateRows(table, typed) {
  const matching = table.rules.filter((rule) => !rule.isDefault && evaluateNode(rule.node, typed));
  const fallback = table.rules.find((rule) => rule.isDefault) ?? null;
  const base = { status: 'ok', hit_policy: table.hitPolicy, diagnostics: [] };
  if (table.hitPolicy === 'collect') {
    if (matching.length > 0) return { ...base, result: matching.map(rowResult), via_default: false };
    if (fallback !== null) return { ...base, result: [rowResult(fallback)], via_default: true };
    return { ...base, result: [], via_default: false };
  }
  if (table.hitPolicy === 'unique' && matching.length > 1) {
    const first = matching[0];
    return {
      status: 'error',
      hit_policy: table.hitPolicy,
      result: null,
      via_default: false,
      diagnostics: [makeDiagnostic('KF-E-312', `rules ${matching.map((rule) => rule.id).join(', ')} all match under hit_policy unique`, {
        pointer: `/rules/${first.index}`,
        rule: first.id,
        rule_index: first.index,
        rules: matching.map((rule) => rule.id),
        rule_indexes: matching.map((rule) => rule.index),
        proof: 'evaluation',
      })],
    };
  }
  if (matching.length > 0) return { ...base, result: rowResult(matching[0]), via_default: false };
  if (fallback !== null) return { ...base, result: rowResult(fallback), via_default: true };
  return { ...base, result: null, via_default: false };
}

// ------------------------------------------------------------------------------------- enumeration
function enumerableDomains(table) {
  const domains = [];
  for (const input of table.inputs) {
    if (input.type !== 'enum' || input.domain === null) return null;
    domains.push(input.domain);
  }
  return domains;
}

/** Product of the domain sizes, each plus `extra` (1 = the absent value, E-0025 (1)). */
function productOf(domains, extra = 0) {
  let product = 1n;
  for (const domain of domains) product *= BigInt(domain.length + extra);
  return product;
}

/**
 * First input outermost, last input fastest, values in domain order (E-0022 D-06). With `withAbsent`, each input
 * ranges over its domain values and then `null` (absent, last; E-0025 (1)).
 */
function forEachTuple(domains, visit, withAbsent = false) {
  const typed = domains.map((domain) => {
    const values = domain.map((value) => ({ kind: 'str', value }));
    if (withAbsent) values.push(null);
    return values;
  });
  const count = domains.length;
  const index = new Array(count).fill(0);
  const tuple = new Array(count);
  for (;;) {
    for (let k = 0; k < count; k += 1) tuple[k] = typed[k][index[k]];
    if (visit(tuple, index) === true) return;
    let k = count - 1;
    while (k >= 0) {
      index[k] += 1;
      if (index[k] < typed[k].length) break;
      index[k] = 0;
      k -= 1;
    }
    if (k < 0) return;
  }
}

function witnessOf(table, index) {
  return record(table.inputs.map((input, k) => [input.ref, index[k] < input.domain.length ? input.domain[index[k]] : null]));
}

function checkExhaustive(table, limit) {
  if (!table.exhaustive || table.rules.some((rule) => rule.isDefault)) return null;
  const base = { pointer: '/exhaustive', rule: null, rule_index: null, limit };
  for (const input of table.inputs) {
    if (input.type !== 'enum') {
      return makeDiagnostic('KF-E-311', `exhaustive: true needs a default row or enum-only inputs; ${input.ref} is ${input.type}`, { ...base, reason: 'non_enum_input', input: input.ref });
    }
    if (input.domain === null) {
      return makeDiagnostic('KF-E-311', `enum input ${input.ref} declares no domain`, { ...base, reason: 'missing_domain', input: input.ref });
    }
  }
  const domains = table.inputs.map((input) => input.domain);
  const product = productOf(domains);
  if (product > BigInt(limit)) {
    return makeDiagnostic('KF-E-311', `the product of the enum domains (${product}) exceeds the proof limit ${limit}`, { ...base, reason: 'over_limit', product: countValue(product) });
  }
  const rows = table.rules.filter((rule) => !rule.isDefault);
  let uncovered = null;
  forEachTuple(domains, (tuple, index) => {
    if (rows.some((rule) => evaluateNode(rule.node, tuple))) return false;
    uncovered = witnessOf(table, index);
    return true;
  });
  if (uncovered === null) return null;
  return makeDiagnostic('KF-E-311', 'a combination of enum values is covered by no row', { ...base, reason: 'uncovered_tuple', witness: uncovered });
}

// ----------------------------------------------------------------------------------------- overlap
function sameValue(a, b) {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'dec' || a.kind === 'qty') return compareDecimal(a.dec, b.dec) === 0;
  return a.value === b.value;
}

/** Tighten a bound: pick the stricter; at equal values exclusive wins. */
function tighten(a, b, lower) {
  if (a === null) return b;
  if (b === null) return a;
  const order = compareDecimal(a.dec, b.dec);
  if (order === 0) return { dec: a.dec, inclusive: a.inclusive && b.inclusive };
  if (lower) return order > 0 ? a : b;
  return order < 0 ? a : b;
}

function boundsEmpty(lo, hi) {
  if (lo === null || hi === null) return false;
  const order = compareDecimal(lo.dec, hi.dec);
  return order > 0 || (order === 0 && !(lo.inclusive && hi.inclusive));
}

function withinBounds(value, lo, hi) {
  if (lo === null && hi === null) return true;
  if (value.kind !== 'dec' && value.kind !== 'qty') return false;
  if (lo !== null) {
    const order = compareDecimal(value.dec, lo.dec);
    if (order < 0 || (order === 0 && !lo.inclusive)) return false;
  }
  if (hi !== null) {
    const order = compareDecimal(value.dec, hi.dec);
    if (order > 0 || (order === 0 && !hi.inclusive)) return false;
  }
  return true;
}

function fieldDisjoint(a, b) {
  const lo = tighten(a.lo, b.lo, true);
  const hi = tighten(a.hi, b.hi, false);
  if (boundsEmpty(lo, hi)) return true;
  const sets = [...a.sets, ...b.sets];
  if (sets.length === 0) return false;
  const [head, ...rest] = sets;
  return !head.some((value) => rest.every((set) => set.some((other) => sameValue(value, other))) && withinBounds(value, lo, hi));
}

/** Flatten a conjunction of field matchers into per-input constraints, or report it as not analyzable. */
function analyzeRow(node) {
  const comparisons = [];
  const walk = (current) => {
    if (current.t === 'true') return true;
    if (current.t === 'and') return current.items.every(walk);
    if (current.t === 'cmp' && !NOT_PROVABLE_OPS.includes(current.op)) {
      comparisons.push(current);
      return true;
    }
    return false;
  };
  if (!walk(node)) return null;
  const constraints = new Map();
  const slot = (input) => {
    if (!constraints.has(input)) constraints.set(input, { lo: null, hi: null, sets: [] });
    return constraints.get(input);
  };
  for (const cmp of comparisons) {
    const operands = cmp.operands ?? [cmp.operand];
    if (operands.some((operand) => operand.kind === 'bad' || operand.kind === 'null')) return null;
    const field = slot(cmp.input);
    if (cmp.op === 'eq') field.sets.push([cmp.operand]);
    else if (cmp.op === 'in') field.sets.push(cmp.operands);
    else if (cmp.op === 'lt') field.hi = tighten(field.hi, { dec: cmp.operand.dec, inclusive: false }, false);
    else if (cmp.op === 'lte') field.hi = tighten(field.hi, { dec: cmp.operand.dec, inclusive: true }, false);
    else if (cmp.op === 'gt') field.lo = tighten(field.lo, { dec: cmp.operand.dec, inclusive: false }, true);
    else if (cmp.op === 'gte') field.lo = tighten(field.lo, { dec: cmp.operand.dec, inclusive: true }, true);
    else {
      field.lo = tighten(field.lo, { dec: cmp.operands[0].dec, inclusive: true }, true);
      field.hi = tighten(field.hi, { dec: cmp.operands[1].dec, inclusive: true }, false);
    }
  }
  return constraints;
}

function provenDisjoint(a, b) {
  if (a === null || b === null) return false;
  for (const [input, constraint] of a) {
    if (b.has(input) && fieldDisjoint(constraint, b.get(input))) return true;
  }
  return false;
}

function checkOverlap(table, limit) {
  if (table.hitPolicy !== 'unique') return [];
  const rows = table.rules.filter((rule) => !rule.isDefault);
  if (rows.length < 2) return [];
  const domains = enumerableDomains(table);
  // E-0025 (1): enumerate (domain values plus null) only when both products are within the limit.
  if (domains !== null && productOf(domains) <= BigInt(limit) && productOf(domains, 1) <= BigInt(limit)) {
    let found = null;
    forEachTuple(domains, (tuple, index) => {
      const hits = [];
      for (const rule of rows) {
        if (evaluateNode(rule.node, tuple)) {
          hits.push(rule);
          if (hits.length === 2) break;
        }
      }
      if (hits.length < 2) return false;
      found = { hits, witness: witnessOf(table, index) };
      return true;
    }, true);
    if (found === null) return [];
    const [first, second] = found.hits;
    return [makeDiagnostic('KF-E-312', `rules ${first.id} and ${second.id} both match the same input combination`, {
      pointer: `/rules/${first.index}`,
      rule: first.id,
      rule_index: first.index,
      rules: [first.id, second.id],
      rule_indexes: [first.index, second.index],
      proof: 'enumeration',
      witness: found.witness,
    })];
  }
  const analyses = rows.map((rule) => analyzeRow(rule.node));
  const diagnostics = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      if (provenDisjoint(analyses[i], analyses[j])) continue;
      diagnostics.push(makeDiagnostic('KF-E-312', `rules ${rows[i].id} and ${rows[j].id} are not proven disjoint`, {
        pointer: `/rules/${rows[i].index}`,
        rule: rows[i].id,
        rule_index: rows[i].index,
        rules: [rows[i].id, rows[j].id],
        rule_indexes: [rows[i].index, rows[j].index],
        proof: 'not_proven_disjoint',
      }));
    }
  }
  return diagnostics;
}

// ------------------------------------------------------------------------------------------ public
/**
 * Static check of a decision table. Returns the sorted diagnostics (`[]` when clean); throws LogicError for
 * structural, binding and typing defects. Never evaluates a value.
 */
export function checkDecisionTable(logic, options) {
  const { registry, proofLimit } = readOptions(options);
  const table = prepare(logic, registry);
  const diagnostics = [...table.findings];
  const exhaustive = checkExhaustive(table, proofLimit);
  if (exhaustive !== null) diagnostics.push(exhaustive);
  diagnostics.push(...checkOverlap(table, proofLimit));
  return sortDiagnostics(diagnostics);
}

/**
 * Evaluate a decision table against supplied values (keyed by full ref or ref suffix). A table with a static
 * KF-E-310 / KF-E-314 / KF-E-315 finding is not evaluated (status 'error'); supplied values are validated
 * against every input declaration before any row is read.
 */
export function evaluateDecisionTable(logic, values, options) {
  const { registry } = readOptions(options);
  if (!isRecord(values)) throw err('INVALID_ARGUMENT', 'values must be a mapping', { found: typeName(values) });
  const table = prepare(logic, registry);
  const failure = (diagnostics) => ({
    status: 'error',
    hit_policy: table.hitPolicy,
    result: null,
    via_default: false,
    diagnostics: sortDiagnostics(diagnostics),
  });
  if (table.findings.length > 0) return failure(table.findings);
  const supplied = bindSupplied(table, values);
  const diagnostics = [];
  const typed = table.inputs.map((input) => typeSupplied(input, supplied[input.index], diagnostics));
  if (diagnostics.length > 0) return failure(diagnostics);
  const result = evaluateRows(table, typed);
  return { ...result, diagnostics: sortDiagnostics(result.diagnostics) };
}

// ------------------------------------------------------------------------- formula support (P012; PLAN P-09)
// Four appended exports that let the formula engine reuse the predicate machinery above without copying it. They
// wrap the private functions and edit none of them. Inside a formula there are no rules, so predicate findings
// carry `rule: null`, `rule_index: null`; an INVALID_TABLE raised by the machinery is re-thrown as
// INVALID_EXPRESSION (`INVALID_ARGUMENT` for the caller-supplied input declarations), because P012 entry points
// never throw INVALID_TABLE (errata E-0033). The shapes of `inputs` and `node` are opaque to callers.
function retarget(error, code) {
  if (error instanceof LogicError && error.code === 'INVALID_TABLE') return err(code, error.message, error.details);
  return error;
}

/**
 * Declare the caller-supplied inputs of a formula (errata E-0031 (1)): same shape and checks as a decision-table
 * `inputs[]`. Returns the declared inputs and the binder of full refs and ref suffixes (E-0019, E-0027 (2)).
 */
export function compileLogicInputs(rawInputs, registry) {
  if (!Array.isArray(rawInputs)) throw err('INVALID_ARGUMENT', 'inputs must be a list of input declarations', { found: typeName(rawInputs) });
  if (!isUnitRegistry(registry)) throw err('INVALID_ARGUMENT', 'registry must be a registry built by buildUnitRegistry', {});
  const seen = new Set();
  let inputs;
  try {
    inputs = rawInputs.map((raw, index) => declareInput(raw, index, registry, seen));
  } catch (error) {
    throw retarget(error, 'INVALID_ARGUMENT');
  }
  return { inputs, bind: makeBinder(inputs) };
}

function predicateInputs(node, found) {
  switch (node.t) {
    case 'true': return;
    case 'and':
    case 'or':
      for (const item of node.items) predicateInputs(item, found);
      return;
    case 'not':
      predicateInputs(node.item, found);
      return;
    default:
      found.add(node.input);
  }
}

/**
 * Compile one predicate of a formula (a guard `when`, an `if` `cond`) at JSON pointer `pointer`. An empty mapping
 * is EMPTY_PREDICATE. Returns the opaque node, the sorted-by-the-caller findings (`KF-E-310/314/315`, literal
 * source) and `mentions`: the ascending input indexes the predicate reads.
 */
export function compileLogicPredicate(predicate, context, pointer) {
  const findings = [];
  const ctx = { inputs: context.inputs, bind: context.bind, registry: context.registry, findings, rule: { id: null, index: null } };
  let node;
  try {
    node = compilePredicate(ctx, predicate, pointer, false, 0);
  } catch (error) {
    throw retarget(error, 'INVALID_EXPRESSION');
  }
  const found = new Set();
  predicateInputs(node, found);
  return { node, findings, mentions: [...found].sort((a, b) => a - b) };
}

/**
 * Bind the supplied values (keyed by full ref or suffix) and type them against the declarations, in `inputs[]`
 * order. `typed[i]` is the typed value of input i or null (absent, null, or a value that produced a finding);
 * `diagnostics` holds `KF-E-310` / `KF-E-314` findings of source `value`.
 */
export function typeLogicValues(inputs, bind, values) {
  if (!isRecord(values)) throw err('INVALID_ARGUMENT', 'values must be a mapping', { found: typeName(values) });
  const diagnostics = [];
  try {
    const supplied = bindSupplied({ inputs, bind }, values);
    const typed = inputs.map((input) => typeSupplied(input, supplied[input.index], diagnostics));
    return { typed, diagnostics };
  } catch (error) {
    throw retarget(error, 'INVALID_EXPRESSION');
  }
}

/** Evaluate a compiled predicate against the typed values of `typeLogicValues` (binary logic, E-0019). */
export function evaluateLogicPredicate(node, typed) {
  return evaluateNode(node, typed);
}
