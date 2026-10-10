// P011 implementer tests: decision-table checker and evaluator (spec sections 11.2, 11.3, 12, 12.1; errata E-0008(d),
// E-0017..E-0022). Observable behavior only, through the public API.
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { checkDecisionTable, DEFAULT_PROOF_LIMIT, evaluateDecisionTable } from '../framework/engine/decision-table.mjs';
import { LOGIC_DIAGNOSTIC_CATALOG, sortDiagnostics } from '../framework/engine/logic-diagnostics.mjs';
import { LogicError, LOGIC_ERROR_CODES } from '../framework/engine/logic-errors.mjs';
import { buildUnitRegistry } from '../framework/engine/units.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const unit = (id, dimension) => ({ id, dimension, symbol: id });
const REGISTRY = buildUnitRegistry({
  units: [unit('percent_mass', 'mass_fraction'), unit('ppm_mass', 'mass_fraction'), unit('percent_volume', 'volume_fraction'), unit('kg', 'mass')],
  conversions: [],
});
const WITH_PERCENT = buildUnitRegistry({ units: [unit('percent', 'mass_fraction'), unit('percent_mass', 'mass_fraction')], conversions: [] });
const OPTS = { unitRegistry: REGISTRY };

const Q = (value, unitId = 'percent_mass') => ({ value, unit: unitId });
const IN = {
  q: { ref: 'DE-1.concentration', type: 'quantity', unit: 'percent_mass' },
  d: { ref: 'DE-1.count', type: 'decimal' },
  e: { ref: 'DE-1.material', type: 'enum', domain: ['X', 'Y', 'Z'] },
  s: { ref: 'DE-1.note', type: 'string' },
  b: { ref: 'DE-1.flag', type: 'boolean' },
};
const ins = (...names) => names.map((n) => ({ ...IN[n] }));
const TQ = 'DE-1.concentration';

/** rows: [id, when, then?]; when === 'default' marks the default row. */
function table(rows, { inputs = ins('e', 'd'), policy = 'first', exhaustive = false } = {}) {
  return {
    kind: 'decision-table',
    hit_policy: policy,
    exhaustive,
    inputs,
    rules: rows.map(([id, when, then]) => ({ id, when, then: then ?? { hit: id } })),
  };
}
const S1 = (when, inputs, policy) => table([['r1', when], ['r2', 'default']], { inputs, policy });

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

const check = (t, options = OPTS) => checkDecisionTable(clone(t), options);
const run = (t, values = {}, options = OPTS) => evaluateDecisionTable(clone(t), clone(values), options);

function codeOf(fn) {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof LogicError, `expected a LogicError, got ${error?.stack ?? error}`);
    assert.ok(LOGIC_ERROR_CODES.includes(error.code), `unknown error code ${error.code}`);
    return error.code;
  }
  return 'NO_THROW';
}

const checkCode = (t, options = OPTS) => codeOf(() => checkDecisionTable(clone(t), options));
const runCode = (t, values = {}, options = OPTS) => codeOf(() => evaluateDecisionTable(clone(t), clone(values), options));

/** The same typed error from the table check and from the evaluation. */
function both(t, code, values = {}) {
  assert.equal(checkCode(t), code, 'checkDecisionTable');
  assert.equal(runCode(t, values), code, 'evaluateDecisionTable');
}

const ruleOf = (res) => (res.result === null ? null : res.result.rule);
const pairs = (diags) => diags.map((d) => [d.code, d.pointer]);

// ============================================================================================ section 12
test('§12 l.616: only kind decision-table is handled; any other kind is INVALID_TABLE', () => {
  for (const kind of ['formula', 'state-machine', 'narrative', 'Decision-Table', undefined, 5]) {
    both({ ...S1({ material: 'X' }, ins('e')), kind }, 'INVALID_TABLE');
  }
  for (const bad of [null, undefined, 'x', 5, [], true]) {
    assert.equal(checkCode(bad), 'INVALID_TABLE');
    assert.equal(runCode(bad), 'INVALID_TABLE');
  }
  assert.deepEqual(check(S1({ material: 'X' }, ins('e'))), []);
});

test('§12 l.616 (E-0022 D-01): structurally invalid tables are INVALID_TABLE and never KF-E-010', () => {
  const base = () => S1({ material: 'X' }, ins('e'));
  const variants = [
    { ...base(), hit_policy: 'last' }, { ...base(), hit_policy: undefined }, { ...base(), exhaustive: 'yes' }, { ...base(), inputs: {} },
    { ...base(), inputs: 'x' }, { ...base(), rules: {} }, { ...base(), rules: null },
    { ...base(), rules: [null] }, { ...base(), rules: [{ when: 'default', then: {} }] }, { ...base(), rules: [{ id: '', when: 'default', then: {} }] },
    { ...base(), rules: [{ id: 'r', when: 'always', then: {} }] }, { ...base(), rules: [{ id: 'r', when: null, then: {} }] },
    { ...base(), rules: [{ id: 'r', when: [], then: {} }] }, { ...base(), rules: [{ id: 'r', when: 'default' }] },
    { ...base(), rules: [{ id: 'r', when: 'default', then: [] }] }, { ...base(), rules: [{ id: 'r', then: {} }] },
    { ...base(), inputs: [null] }, { ...base(), inputs: [{ type: 'enum' }] }, { ...base(), inputs: [{ ref: 'DE-1.x' }] },
  ];
  variants.forEach((t, i) => {
    assert.equal(checkCode(t), 'INVALID_TABLE', `variant ${i} check`);
    assert.equal(runCode(t), 'INVALID_TABLE', `variant ${i} run`);
  });
});

// ======================================================================================== section 12.1
test('§12.1 l.622: a literal matcher means eq', () => {
  const t = S1({ material: 'X' }, ins('e'));
  assert.equal(ruleOf(run(t, { 'DE-1.material': 'X' })), 'r1');
  assert.equal(ruleOf(run(t, { 'DE-1.material': 'Y' })), 'r2');
  const td = S1({ count: '4.2' }, ins('d'));
  assert.equal(ruleOf(run(td, { 'DE-1.count': '4.20' })), 'r1');
  assert.equal(ruleOf(run(td, { 'DE-1.count': '4.21' })), 'r2');
  const tb = S1({ flag: false }, ins('b'));
  assert.equal(ruleOf(run(tb, { 'DE-1.flag': false })), 'r1');
  assert.equal(ruleOf(run(tb, { 'DE-1.flag': true })), 'r2');
  const tq = S1({ concentration: Q('4.2') }, ins('q'));
  assert.equal(ruleOf(run(tq, { [TQ]: Q('4.20') })), 'r1');
  assert.equal(ruleOf(run(tq, { [TQ]: Q('4.3') })), 'r2');
});

test('§12.1 l.623: eq ne lt lte gt gte compare decimals and quantities by value, strings exactly', () => {
  const dec = (matcher, value) => ruleOf(run(S1({ count: matcher }, ins('d')), { 'DE-1.count': value }));
  assert.equal(dec({ eq: '0' }, '-0.00'), 'r1');
  assert.equal(dec({ ne: '0' }, '0.0'), 'r2');
  assert.equal(dec({ ne: '0' }, '0.1'), 'r1');
  assert.equal(dec({ lt: '5' }, '4.999999999999999999999999999999'), 'r1');
  assert.equal(dec({ lt: '5' }, '5.0'), 'r2');
  assert.equal(dec({ lte: '5' }, '5.00'), 'r1');
  assert.equal(dec({ gt: '9' }, '10'), 'r1');
  assert.equal(dec({ gt: '9' }, '9.0'), 'r2');
  assert.equal(dec({ gte: '5' }, '5'), 'r1');
  assert.equal(dec({ gte: '5' }, '4.9'), 'r2');
  assert.equal(dec({ gt: '9007199254740992' }, '9007199254740993'), 'r1', 'doubles-colliding values differ');
  const qty = (matcher, value) => ruleOf(run(S1({ concentration: matcher }, ins('q')), { [TQ]: Q(value) }));
  assert.equal(qty({ lte: Q('4.2') }, '4.2'), 'r1');
  assert.equal(qty({ lte: Q('4.2') }, '4.21'), 'r2');
  assert.equal(qty({ lt: Q('4.2') }, '4.2'), 'r2');
  assert.equal(qty({ gt: Q('4.2') }, '4.20001'), 'r1');
  const str = (matcher, value) => ruleOf(run(S1({ note: matcher }, ins('s')), { 'DE-1.note': value }));
  assert.equal(str({ eq: 'abc' }, 'abc'), 'r1');
  assert.equal(str({ eq: 'abc' }, 'ABC'), 'r2', 'case sensitive');
  assert.equal(str({ eq: 'é' }, 'é'), 'r1');
  assert.equal(str({ ne: 'abc' }, 'abd'), 'r1');
});

test('§12.1 l.624: in and not_in test membership by value and identity', () => {
  const dec = (matcher, value) => ruleOf(run(S1({ count: matcher }, ins('d')), { 'DE-1.count': value }));
  assert.equal(dec({ in: ['1', '2.0'] }, '2'), 'r1');
  assert.equal(dec({ in: ['1', '2.0'] }, '3'), 'r2');
  assert.equal(dec({ in: [] }, '3'), 'r2');
  assert.equal(dec({ not_in: ['1', '2.0'] }, '2.00'), 'r2');
  assert.equal(dec({ not_in: ['1', '2.0'] }, '3'), 'r1');
  assert.equal(dec({ not_in: [] }, '3'), 'r1');
  const qty = ruleOf(run(S1({ concentration: { in: [Q('1'), Q('2')] } }, ins('q')), { [TQ]: Q('2.0') }));
  assert.equal(qty, 'r1');
});

test('§12.1 l.625: between is inclusive at both ends; min greater than max is INVALID_RANGE', () => {
  const run1 = (value) => ruleOf(run(S1({ count: { between: ['1', '5'] } }, ins('d')), { 'DE-1.count': value }));
  assert.equal(run1('1'), 'r1');
  assert.equal(run1('5'), 'r1');
  assert.equal(run1('5.000'), 'r1');
  assert.equal(run1('0.9999999999999999999'), 'r2');
  assert.equal(run1('5.0000000000000000001'), 'r2');
  const degenerate = S1({ count: { between: ['2', '2.0'] } }, ins('d'));
  assert.equal(ruleOf(run(degenerate, { 'DE-1.count': '2.00' })), 'r1');
  assert.equal(ruleOf(run(degenerate, { 'DE-1.count': '2.01' })), 'r2');
  both(S1({ count: { between: ['5', '1'] } }, ins('d')), 'INVALID_RANGE');
  both(S1({ concentration: { between: [Q('5'), Q('1')] } }, ins('q')), 'INVALID_RANGE');
  const qty = S1({ concentration: { between: [Q('1'), Q('5')] } }, ins('q'));
  assert.equal(ruleOf(run(qty, { [TQ]: Q('5') })), 'r1');
  assert.equal(ruleOf(run(qty, { [TQ]: Q('5.1') })), 'r2');
});

test('§12.1 l.626: matches is an unanchored RE2 search; a non-compilable pattern is KF-E-315 with pointer and pattern', () => {
  const t = S1({ note: { matches: 'B[0-9]' } }, ins('s'));
  assert.equal(ruleOf(run(t, { 'DE-1.note': 'AB12' })), 'r1');
  assert.equal(ruleOf(run(t, { 'DE-1.note': 'AC12' })), 'r2');
  const bad = S1({ note: { matches: '(a)\\1' } }, ins('s'));
  const diags = check(bad);
  assert.equal(diags.length, 1);
  assert.equal(diags[0].code, 'KF-E-315');
  assert.equal(diags[0].pointer, '/rules/0/when/note/matches');
  assert.equal(diags[0].pattern, '(a)\\1');
  assert.equal(diags[0].rule, 'r1');
  assert.equal(diags[0].rule_index, 0);
  assert.equal(typeof diags[0].reason, 'string');
  assert.deepEqual(check(S1({ note: { matches: '(?:a)\\\\1' } }, ins('s'))), [], 'near-miss: an escaped backslash then 1 is plain syntax');
  assert.equal(checkCode(S1({ note: { matches: 5 } }, ins('s'))), 'INVALID_TABLE');
});

test('§12.1 l.626: matches on a decimal, quantity or boolean input is TYPE_MISMATCH (documented fail-closed choice, TRIAGE N-14)', () => {
  both(S1({ count: { matches: '1' } }, ins('d')), 'TYPE_MISMATCH');
  both(S1({ concentration: { matches: '1' } }, ins('q')), 'TYPE_MISMATCH');
  both(S1({ flag: { matches: 't' } }, ins('b')), 'TYPE_MISMATCH');
  assert.deepEqual(check(S1({ material: { matches: '^X' } }, ins('e'))), [], 'enum values are strings');
});

test('§12.1 l.627: is_null is the only test of absence and takes true or false', () => {
  const yes = S1({ note: { is_null: true } }, ins('s'));
  assert.equal(ruleOf(run(yes, {})), 'r1');
  assert.equal(ruleOf(run(yes, { 'DE-1.note': null })), 'r1');
  assert.equal(ruleOf(run(yes, { 'DE-1.note': '' })), 'r2', 'the empty string is not absent');
  const no = S1({ note: { is_null: false } }, ins('s'));
  assert.equal(ruleOf(run(no, { 'DE-1.note': 'x' })), 'r1');
  assert.equal(ruleOf(run(no, {})), 'r2');
  const flag = S1({ flag: { is_null: true } }, ins('b'));
  assert.equal(ruleOf(run(flag, { 'DE-1.flag': false })), 'r2', 'false is not null');
  both(S1({ note: { is_null: 'yes' } }, ins('s')), 'INVALID_TABLE');
  both(S1({ note: { is_null: 1 } }, ins('s')), 'INVALID_TABLE');
});

test('§12.1 l.621: all, any, not and multi-key mappings combine predicates; nesting works', () => {
  const inputs = ins('e', 'd');
  const out = (when, material, count) => ruleOf(run(S1(when, inputs), { 'DE-1.material': material, 'DE-1.count': count }));
  const conj = { all: [{ material: 'X' }, { count: { gt: '0' } }] };
  assert.equal(out(conj, 'X', '1'), 'r1');
  assert.equal(out(conj, 'X', '0'), 'r2');
  assert.equal(out(conj, 'Y', '1'), 'r2');
  const disj = { any: [{ material: 'X' }, { count: { gt: '0' } }] };
  assert.equal(out(disj, 'Y', '1'), 'r1');
  assert.equal(out(disj, 'X', '-1'), 'r1');
  assert.equal(out(disj, 'Y', '-1'), 'r2');
  assert.equal(out({ not: { material: 'X' } }, 'Y', '0'), 'r1');
  assert.equal(out({ not: { material: 'X' } }, 'X', '0'), 'r2');
  assert.equal(out({ material: 'X', count: { gt: '0' } }, 'X', '1'), 'r1');
  assert.equal(out({ material: 'X', count: { gt: '0' } }, 'X', '0'), 'r2');
  const nested = { all: [{ any: [{ material: 'X' }, { material: 'Y' }] }, { not: { count: { lt: '0' } } }] };
  assert.equal(out(nested, 'Y', '0'), 'r1');
  assert.equal(out(nested, 'Y', '-1'), 'r2');
  assert.equal(out(nested, 'Z', '0'), 'r2');
  assert.equal(out({ not: { not: { material: 'X' } } }, 'X', '0'), 'r1');
});

test('§12.1 l.621: the grammar is closed; malformed matchers are INVALID_TABLE', () => {
  const d = ins('d');
  for (const matcher of [{ approx: '1' }, { gt: '1', lt: '5' }, {}, [], { eq: '1', extra: 1 }, { in: '1' }, { in: { a: 1 } }, { not_in: 5 }, { between: ['1'] },
    { between: ['1', '2', '3'] }, { between: '12' }, { matches: null }]) {
    both(S1({ count: matcher }, d), 'INVALID_TABLE');
  }
  both(S1({ all: { a: 1 } }, d), 'INVALID_TABLE');
  both(S1({ any: 'x' }, d), 'INVALID_TABLE');
  both(S1({ not: [] }, d), 'INVALID_TABLE');
  both(S1({ not: 'x' }, d), 'INVALID_TABLE');
  both(S1({ all: ['x'] }, d), 'INVALID_TABLE');
  both(S1('always', d), 'INVALID_TABLE');
});

test('§12.1 l.621 (E-0019): when keys bind by full ref or by suffix; unbound and ambiguous keys are typed errors', () => {
  const full = S1({ 'DE-1.material': 'X' }, ins('e'));
  const suffix = S1({ material: 'X' }, ins('e'));
  for (const t of [full, suffix]) {
    assert.equal(ruleOf(run(t, { 'DE-1.material': 'X' })), 'r1');
    assert.equal(ruleOf(run(t, { 'DE-1.material': 'Y' })), 'r2');
  }
  both(S1({ foo: 'X' }, ins('e')), 'UNBOUND_FIELD');
  both(S1({ not: { foo: 'X' } }, ins('e')), 'UNBOUND_FIELD');
  both(S1({ any: [{ material: 'X' }, { foo: 'X' }] }, ins('e')), 'UNBOUND_FIELD');
  both(S1({ 'DE-1.mater': 'X' }, ins('e')), 'UNBOUND_FIELD', {});
  both(S1({ 'material.X': 'X' }, ins('e')), 'UNBOUND_FIELD');
  const shared = [{ ref: 'A.x', type: 'decimal' }, { ref: 'B.x', type: 'decimal' }];
  both(S1({ x: '1' }, shared), 'AMBIGUOUS_FIELD');
  const byRef = S1({ 'A.x': '1' }, shared);
  assert.deepEqual(check(byRef), []);
  assert.equal(ruleOf(run(byRef, { 'A.x': '1', 'B.x': '2' })), 'r1');
  assert.equal(ruleOf(run(byRef, { 'A.x': '2', 'B.x': '1' })), 'r2');
  const noDot = [{ ref: 'plain', type: 'decimal' }];
  assert.equal(ruleOf(run(S1({ plain: '1' }, noDot), { plain: '1' })), 'r1');
  const dotted = [{ ref: 'a.b.c', type: 'decimal' }];
  assert.equal(ruleOf(run(S1({ c: '1' }, dotted), { c: '1' })), 'r1', 'suffix is after the LAST dot');
  both(S1({ b: '1' }, dotted), 'UNBOUND_FIELD');
});

test('§12.1 l.621 (E-0022 D-02): supplied values bind by the same rule; unbound or doubled supplied keys are typed errors', () => {
  const t = S1({ material: 'X' }, ins('e'));
  assert.equal(ruleOf(run(t, { material: 'X' })), 'r1');
  assert.equal(ruleOf(run(t, { 'DE-1.material': 'X' })), 'r1');
  assert.equal(runCode(t, { foo: 'X' }), 'UNBOUND_FIELD');
  assert.equal(runCode(t, { 'DE-1.material': 'X', 'DE-1.other': 'Y' }), 'UNBOUND_FIELD');
  assert.equal(runCode(t, { 'DE-1.material': 'X', material: 'X' }), 'AMBIGUOUS_FIELD');
  const shared = [{ ref: 'A.x', type: 'decimal' }, { ref: 'B.x', type: 'decimal' }];
  assert.equal(runCode(S1({ 'A.x': '1' }, shared), { x: '1' }), 'AMBIGUOUS_FIELD');
  for (const key of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    const values = JSON.parse(`{"${key}": "X"}`);
    assert.equal(codeOf(() => evaluateDecisionTable(clone(t), values, OPTS)), 'UNBOUND_FIELD', key);
  }
  assert.equal({}.polluted, undefined);
  assert.equal(Object.getPrototypeOf({}), Object.prototype);
});

test('§12.1 l.621 (E-0019 as amended by E-0022): {} nested in all/any/not and empty all/any are EMPTY_PREDICATE', () => {
  both(S1({ all: [{}] }, ins('e')), 'EMPTY_PREDICATE');
  both(S1({ any: [{ material: 'X' }, {}] }, ins('e')), 'EMPTY_PREDICATE');
  both(S1({ not: {} }, ins('e')), 'EMPTY_PREDICATE');
  both(S1({ all: [] }, ins('e')), 'EMPTY_PREDICATE');
  both(S1({ any: [] }, ins('e')), 'EMPTY_PREDICATE');
  both(S1({ not: { any: [] } }, ins('e')), 'EMPTY_PREDICATE');
  both(S1({ material: 'X', all: [{ any: [] }] }, ins('e')), 'EMPTY_PREDICATE');
});

test('§12.1 l.621 (E-0022 D-08): a top-level when {} is an unconditional non-default row', () => {
  const t = table([['r1', {}], ['r2', { material: 'X' }]], { inputs: ins('e'), policy: 'first' });
  assert.equal(ruleOf(run(t, { 'DE-1.material': 'X' })), 'r1');
  assert.equal(ruleOf(run(t, {})), 'r1');
  const coll = table([['r1', {}], ['r2', { material: 'X' }]], { inputs: ins('e'), policy: 'collect' });
  assert.deepEqual(run(coll, { 'DE-1.material': 'X' }).result.map((r) => r.rule), ['r1', 'r2']);
  const dflt = table([['r1', {}], ['rd', 'default']], { inputs: ins('e'), policy: 'collect' });
  const res = run(dflt, {});
  assert.deepEqual(res.result.map((r) => r.rule), ['r1']);
  assert.equal(res.via_default, false, 'the {} row is not the default row');
});

test('§12.1 l.628 (E-0017, E-0019): decimal operands must be quoted decimal strings; numbers are INVALID_DECIMAL', () => {
  const d = ins('d');
  const q = ins('q');
  for (const when of [{ count: { gt: 5 } }, { count: '4,2' }, { count: { in: ['1', 2] } }, { count: { lt: true } }, { count: { gt: null } },
    { count: { between: ['1', 2] } }, { count: { eq: '1e3' } }, { count: 4.2 }]) {
    both(S1(when, d), 'INVALID_DECIMAL');
  }
  for (const when of [{ concentration: { lte: { value: 4.2, unit: 'percent_mass' } } }, { concentration: { lte: { value: '4,2', unit: 'percent_mass' } } },
    { concentration: { lte: { value: null, unit: 'percent_mass' } } }, { concentration: { lte: 4.2 } }]) {
    both(S1(when, q), 'INVALID_DECIMAL');
  }
  // E-0025 (3), E-0027 (3): a string is a bare scalar against a quantity input: KF-E-310, not INVALID_DECIMAL
  assert.deepEqual(pairs(check(S1({ concentration: { lte: 'abc' } }, q))), [['KF-E-310', '/rules/0/when/concentration/lte']]);
  assert.equal(checkCode(S1({ concentration: { lte: { value: '4.2' } } }, q)), 'INVALID_TABLE', 'a mapping without unit is not a quantity');
});

test('§11.3 l.607: every matcher except is_null is false on null and on absent (binary logic)', () => {
  const inputs = ins('e', 'd', 's');
  const whens = [
    { count: { eq: '1' } }, { count: { ne: '1' } }, { count: { in: ['1'] } }, { count: { not_in: ['1'] } }, { count: { lt: '1' } },
    { count: { lte: '1' } }, { count: { gt: '1' } }, { count: { gte: '1' } }, { count: { between: ['0', '2'] } }, { count: '1' },
    { note: { matches: '.*' } }, { material: 'X' }, { material: { ne: 'X' } }, { material: { not_in: ['X'] } }, { note: { eq: '' } },
  ];
  for (const when of whens) {
    const t = S1(when, inputs);
    assert.equal(ruleOf(run(t, {})), 'r2', JSON.stringify(when));
    assert.deepEqual(run(t, { 'DE-1.material': null, 'DE-1.count': null, 'DE-1.note': null }), run(t, {}), `${JSON.stringify(when)}: null equals absent`);
    assert.deepEqual(run(t, { 'DE-1.count': undefined }), run(t, {}), 'undefined is absent');
  }
});

test('§11.3 l.607 (E-0019): eq null is false; not negates the boolean result; any/all stay boolean', () => {
  const d = ins('d');
  const eqNull = S1({ count: { eq: null } }, d);
  for (const values of [{}, { 'DE-1.count': null }, { 'DE-1.count': '1' }]) assert.equal(ruleOf(run(eqNull, values)), 'r2');
  assert.equal(ruleOf(run(S1({ count: null }, d), {})), 'r2');
  for (const inner of [{ eq: '1' }, { ne: '1' }, { in: ['1'] }, { not_in: ['1'] }, { lt: '1' }, { between: ['0', '2'] }]) {
    assert.equal(ruleOf(run(S1({ not: { count: inner } }, d), {})), 'r1', `not ${JSON.stringify(inner)} over null`);
  }
  assert.equal(ruleOf(run(S1({ not: { count: { is_null: true } } }, d), {})), 'r2');
  assert.equal(ruleOf(run(S1({ count: { is_null: true } }, d), {})), 'r1');
  const mixed = ins('d', 's');
  assert.equal(ruleOf(run(S1({ any: [{ count: { eq: '1' } }, { note: { is_null: true } }] }, mixed), {})), 'r1');
  assert.equal(ruleOf(run(S1({ all: [{ count: { is_null: true } }, { note: { eq: 'x' } }] }, mixed), {})), 'r2');
});

test('§11.3 l.606: null is neither zero nor false', () => {
  assert.equal(ruleOf(run(S1({ flag: false }, ins('b')), {})), 'r2');
  assert.equal(ruleOf(run(S1({ count: '0' }, ins('d')), {})), 'r2');
  assert.equal(ruleOf(run(S1({ count: { lte: '0' } }, ins('d')), {})), 'r2');
  assert.equal(ruleOf(run(S1({ count: { lte: '0' } }, ins('d')), { 'DE-1.count': '0' })), 'r1');
  assert.equal(ruleOf(run(S1({ flag: { eq: false } }, ins('b')), { 'DE-1.flag': false })), 'r1');
});

test('§11.3 l.608 (E-0019): a supplied value outside the enum domain is KF-E-314 even when no row reads the input', () => {
  const t = S1({ count: { gt: '0' } }, ins('e', 'd'));
  const res = run(t, { 'DE-1.material': 'W' });
  assert.equal(res.status, 'error');
  assert.equal(res.result, null);
  assert.equal(res.via_default, false);
  assert.equal(res.diagnostics.length, 1);
  const d = res.diagnostics[0];
  assert.equal(d.code, 'KF-E-314');
  assert.equal(d.input, 'DE-1.material');
  assert.equal(d.value, 'W');
  assert.equal(d.source, 'value');
  assert.equal(d.pointer, '/inputs/0');
  assert.equal(d.rule, null);
  assert.equal(run(t, { 'DE-1.material': 'x' }).status, 'error', 'case sensitive');
  assert.equal(run(t, { 'DE-1.material': '' }).status, 'error');
  for (const ok of [{ 'DE-1.material': 'X' }, { 'DE-1.material': null }, {}]) assert.equal(run(t, ok).status, 'ok');
  const two = S1({ a: 'X' }, [{ ref: 'DE-1.a', type: 'enum', domain: ['X'] }, { ref: 'DE-1.b', type: 'enum', domain: ['P'] }]);
  const both2 = run(two, { 'DE-1.a': 'Z', 'DE-1.b': 'S' });
  assert.deepEqual(both2.diagnostics.map((x) => [x.input, x.pointer]), [['DE-1.a', '/inputs/0'], ['DE-1.b', '/inputs/1']]);
});

test('§11.3 l.608 (E-0019): a literal outside the enum domain is a static KF-E-314 wherever it occurs', () => {
  const cases = [
    [{ material: 'W' }, '/rules/0/when/material'], [{ material: { eq: 'W' } }, '/rules/0/when/material/eq'],
    [{ material: { ne: 'W' } }, '/rules/0/when/material/ne'], [{ material: { in: ['X', 'W'] } }, '/rules/0/when/material/in/1'],
    [{ material: { not_in: ['W'] } }, '/rules/0/when/material/not_in/0'], [{ not: { material: 'W' } }, '/rules/0/when/not/material'],
    [{ all: [{ any: [{ material: 'W' }] }] }, '/rules/0/when/all/0/any/0/material'],
  ];
  for (const [when, pointer] of cases) {
    const diags = check(S1(when, ins('e')));
    assert.equal(diags.length, 1, JSON.stringify(when));
    assert.deepEqual(
      [diags[0].code, diags[0].pointer, diags[0].input, diags[0].value, diags[0].source, diags[0].rule, diags[0].rule_index],
      ['KF-E-314', pointer, 'DE-1.material', 'W', 'literal', 'r1', 0],
    );
  }
  for (const when of [{ material: 'X' }, { material: { eq: 'Z' } }, { material: { in: ['X', 'Y'] } }, { material: { eq: null } }]) {
    assert.deepEqual(check(S1(when, ins('e'))), [], JSON.stringify(when));
  }
  const noDomain = [{ ref: 'DE-1.material', type: 'enum' }];
  assert.deepEqual(check(S1({ material: 'anything' }, noDomain)), [], 'no domain, no domain check');
  assert.equal(run(S1({ material: 'W' }, ins('e')), { 'DE-1.material': 'X' }).status, 'error', 'a table with a static finding is not evaluated');
});

test('§11.2 l.589: a literal in another unit, bare or in a list or range is a static KF-E-310 at the exact node', () => {
  const diag = (when) => check(S1(when, ins('q')));
  let diags = diag({ concentration: { lte: Q('4.2', 'ppm_mass') } });
  assert.equal(diags.length, 1);
  assert.deepEqual(
    [diags[0].code, diags[0].pointer, diags[0].input, diags[0].expected_unit, diags[0].found_unit, diags[0].source, diags[0].rule],
    ['KF-E-310', '/rules/0/when/concentration/lte', TQ, 'percent_mass', 'ppm_mass', 'literal', 'r1'],
  );
  assert.deepEqual(diag({ concentration: { lte: Q('4.2') } }), []);
  diags = diag({ concentration: { lte: '4.2' } });
  assert.deepEqual([diags[0].found_unit, diags[0].expected_unit], [null, 'percent_mass']);
  diags = check(S1({ count: { lte: Q('4') } }, ins('d')));
  assert.deepEqual([diags[0].code, diags[0].found_unit, diags[0].expected_unit], ['KF-E-310', 'percent_mass', null]);
  assert.deepEqual(pairs(diag({ concentration: { in: [Q('1'), Q('2', 'ppm_mass')] } })), [['KF-E-310', '/rules/0/when/concentration/in/1']]);
  assert.deepEqual(pairs(diag({ concentration: { between: [Q('1'), Q('5', 'percent_volume')] } })), [['KF-E-310', '/rules/0/when/concentration/between/1']]);
  assert.deepEqual(pairs(diag({ concentration: Q('4.2', 'ppm_mass') })), [['KF-E-310', '/rules/0/when/concentration']]);
  assert.equal(diag({ concentration: { in: [Q('1', 'kg'), Q('2', 'ppm_mass')] } }).length, 2);
  assert.equal(run(S1({ concentration: { lte: Q('4', 'ppm_mass') } }, ins('q')), { [TQ]: Q('4') }).status, 'error', 'a static finding blocks evaluation');
});

test('§11.2 l.591 (E-0018): convertible and same-family units are different units; bare percent is a unit only if declared', () => {
  const t = S1({ concentration: { lte: Q('4.2') } }, ins('q'));
  for (const supplied of [Q('42000', 'ppm_mass'), Q('4.2', 'ppm_mass'), Q('4.2', 'percent_volume'), Q('4.2', 'kg'), Q('4.2', 'percent'), Q('4.2', 'PERCENT_MASS')]) {
    const res = run(t, { [TQ]: supplied });
    assert.equal(res.status, 'error', JSON.stringify(supplied));
    assert.equal(res.result, null);
    assert.deepEqual(res.diagnostics.map((d) => d.code), ['KF-E-310']);
    assert.equal(res.diagnostics[0].found_unit, supplied.unit);
  }
  const literal = S1({ concentration: { lte: Q('4', 'percent') } }, ins('q'));
  both(literal, 'UNKNOWN_UNIT');
  assert.equal(check(literal, { unitRegistry: WITH_PERCENT }).map((d) => d.code).join(), 'KF-E-310', 'declared but different from percent_mass: units compare by id');
  both(S1({ a: 'X' }, [{ ref: 'DE-1.a', type: 'quantity', unit: 'percent' }]), 'UNKNOWN_UNIT');
  assert.deepEqual(check(S1({ a: { is_null: true } }, [{ ref: 'DE-1.a', type: 'quantity', unit: 'percent' }]), { unitRegistry: WITH_PERCENT }), []);
});

test('§11.2 l.589 (E-0019): runtime unit mismatch is KF-E-310 with source value, never false and never coerced', () => {
  const t = S1({ concentration: { lte: Q('4.2') } }, ins('q'));
  let res = run(t, { [TQ]: Q('4.2', 'ppm_mass') });
  assert.equal(res.status, 'error');
  assert.equal(res.diagnostics.length, 1);
  const d = res.diagnostics[0];
  assert.deepEqual(
    [d.code, d.source, d.input, d.expected_unit, d.found_unit, d.pointer, d.rule, d.rule_index],
    ['KF-E-310', 'value', TQ, 'percent_mass', 'ppm_mass', '/inputs/0', null, null],
  );
  res = run(t, { [TQ]: '4.2' });
  assert.deepEqual([res.status, res.diagnostics[0].code, res.diagnostics[0].found_unit], ['error', 'KF-E-310', null]);
  res = run(S1({ count: { gt: '0' } }, ins('d')), { 'DE-1.count': Q('4.2') });
  assert.deepEqual([res.status, res.diagnostics[0].code, res.diagnostics[0].expected_unit, res.diagnostics[0].found_unit], ['error', 'KF-E-310', null, 'percent_mass']);
  res = run(t, { [TQ]: Q('4.2') });
  assert.equal(res.status, 'ok');
  assert.equal(res.result.rule, 'r1');
  assert.equal(res.diagnostics.length, 0);
});

test('§11.1 l.583 (E-0017): supplied values must be decimal strings and well-typed; wrong types are typed errors', () => {
  const td = S1({ count: { gt: '0' } }, ins('d'));
  assert.equal(runCode(td, { 'DE-1.count': 4.2 }), 'INVALID_DECIMAL');
  assert.equal(runCode(td, { 'DE-1.count': '1e3' }), 'INVALID_DECIMAL');
  assert.equal(runCode(td, { 'DE-1.count': true }), 'INVALID_DECIMAL');
  assert.equal(runCode(td, { 'DE-1.count': {} }), 'INVALID_DECIMAL');
  assert.equal(runCode(td, { 'DE-1.count': { value: 1, unit: 'kg' } }), 'INVALID_DECIMAL');
  const tq = S1({ concentration: { lte: Q('4.2') } }, ins('q'));
  assert.equal(runCode(tq, { [TQ]: { value: 4.2, unit: 'percent_mass' } }), 'INVALID_DECIMAL');
  assert.equal(runCode(tq, { [TQ]: { value: '4,2', unit: 'percent_mass' } }), 'INVALID_DECIMAL');
  assert.equal(runCode(tq, { [TQ]: 4.2 }), 'INVALID_DECIMAL');
  // E-0025 (3): a boolean supplied for a quantity input is a bare scalar: KF-E-310 (was TYPE_MISMATCH before R01)
  const asBool = run(tq, { [TQ]: true });
  assert.deepEqual([asBool.status, asBool.diagnostics.map((d) => [d.code, d.expected_unit, d.found_unit])], ['error', [['KF-E-310', 'percent_mass', null]]]);
  assert.equal(runCode(tq, { [TQ]: [] }), 'TYPE_MISMATCH');
  assert.equal(runCode(tq, { [TQ]: { value: '1' } }), 'TYPE_MISMATCH');
  const ts = S1({ note: { matches: 'a' } }, ins('s'));
  assert.equal(runCode(ts, { 'DE-1.note': 5 }), 'TYPE_MISMATCH');
  assert.equal(runCode(ts, { 'DE-1.note': ['a'] }), 'TYPE_MISMATCH');
  const tb = S1({ flag: true }, ins('b'));
  assert.equal(runCode(tb, { 'DE-1.flag': 'yes' }), 'TYPE_MISMATCH');
  assert.equal(runCode(tb, { 'DE-1.flag': 1 }), 'TYPE_MISMATCH');
  assert.equal(runCode(S1({ material: 'X' }, ins('e')), { 'DE-1.material': 5 }), 'TYPE_MISMATCH');
});

test('§12.1 l.623 (E-0019): lt lte gt gte between apply only to decimal and quantity inputs', () => {
  both(S1({ material: { lt: 'X' } }, ins('e')), 'TYPE_MISMATCH');
  both(S1({ note: { gte: 'a' } }, ins('s')), 'TYPE_MISMATCH');
  both(S1({ flag: { gt: true } }, ins('b')), 'TYPE_MISMATCH');
  both(S1({ flag: { between: [false, true] } }, ins('b')), 'TYPE_MISMATCH');
  assert.deepEqual(check(S1({ material: { ne: 'X' } }, ins('e'))), []);
  both(S1({ note: 5 }, ins('s')), 'TYPE_MISMATCH');
  both(S1({ flag: 'true' }, ins('b')), 'TYPE_MISMATCH');
  both(S1({ material: 5 }, ins('e')), 'TYPE_MISMATCH');
  // E-0025 (3): a quantity literal on a string input is KF-E-310 (was TYPE_MISMATCH before R01)
  assert.deepEqual(pairs(check(S1({ note: Q('1') }, ins('s')))), [['KF-E-310', '/rules/0/when/note']]);
});

test('§12.1 l.632 (E-0021): input declarations are validated (types, units, duplicates, domains)', () => {
  const one = (decl) => S1({ x: { is_null: true } }, [decl]);
  for (const type of ['date', 'integer', 'percent', 'Quantity', 'number', 'ENUM']) both(one({ ref: 'DE-1.x', type }), 'UNSUPPORTED_INPUT_TYPE');
  for (const decl of [
    { ref: 'DE-1.x', type: 'quantity' }, { ref: 'DE-1.x', type: 'quantity', unit: '' }, { ref: 'DE-1.x', type: 'decimal', unit: 'percent_mass' },
    { ref: 'DE-1.x', type: 'enum', domain: ['X'], unit: 'kg' }, { ref: 'DE-1.x', type: 'string', domain: ['X'] }, { ref: 'DE-1.x', type: 'enum', domain: 'XYZ' },
    { ref: 'DE-1.x', type: 'enum', domain: [] }, { ref: 'DE-1.x', type: 'enum', domain: ['X', 'X'] }, { ref: 'DE-1.x', type: 'enum', domain: ['X', 1] },
    { ref: 'DE-1.x', type: 'enum', domain: null }, { ref: 'DE-1.x', type: 'decimal', unit: null },
  ]) both(one(decl), 'INVALID_INPUT_DECLARATION');
  both(S1({ x: { is_null: true } }, [{ ref: 'DE-1.x', type: 'decimal' }, { ref: 'DE-1.x', type: 'string' }]), 'INVALID_INPUT_DECLARATION');
  both(one({ ref: 'DE-1.x', type: 'quantity', unit: 'furlong' }), 'UNKNOWN_UNIT');
  assert.deepEqual(check(one({ ref: 'DE-1.x', type: 'enum' })), [], 'an enum without domain is only a finding under exhaustive: true');
});

test('§12.1 l.632 (E-0020, E-0021): duplicate default rows and duplicate rule ids are typed errors under every policy', () => {
  for (const policy of ['first', 'unique', 'collect']) {
    both(table([['r1', 'default'], ['r2', 'default']], { policy }), 'DUPLICATE_DEFAULT');
    both(table([['r1', { material: 'X' }], ['r1', 'default']], { policy }), 'DUPLICATE_RULE_ID');
    both(table([['r1', { material: 'X' }], ['r1', { material: 'Y' }]], { policy }), 'DUPLICATE_RULE_ID');
  }
});

// ===================================================================================== hit policies
const TH = ({ policy = 'first', rd = 'last' } = {}) => {
  const rows = [['r1', { material: { in: ['X', 'Y'] } }], ['r2', { material: { in: ['Y', 'Z'] } }], ['r3', { count: { gt: '0' } }]];
  if (rd === 'first') rows.unshift(['rd', 'default']);
  else if (rd === 'middle') rows.splice(1, 0, ['rd', 'default']);
  else if (rd === 'last') rows.push(['rd', 'default']);
  return table(rows, { inputs: ins('e', 'd'), policy });
};
const MAT = 'DE-1.material';
const CNT = 'DE-1.count';

test('§12.1 l.632 (E-0020): first returns the first matching non-default row in document order, the default only as fallback', () => {
  for (const rd of ['last', 'first', 'middle']) {
    const t = TH({ rd });
    const hit = (values) => run(t, values);
    assert.equal(ruleOf(hit({ [MAT]: 'Y' })), 'r1', rd);
    assert.equal(ruleOf(hit({ [MAT]: 'Z' })), 'r2');
    assert.equal(ruleOf(hit({ [MAT]: 'Z', [CNT]: '1' })), 'r2', 'document order, although r3 also matches');
    assert.equal(ruleOf(hit({ [CNT]: '1' })), 'r3');
    const none = hit({});
    assert.equal(ruleOf(none), 'rd');
    assert.equal(none.via_default, true);
    assert.equal(hit({ [MAT]: 'Y' }).via_default, false);
    assert.equal(none.result.rule_index, t.rules.findIndex((r) => r.id === 'rd'));
  }
  const noDefault = run(TH({ rd: 'none' }), {});
  assert.deepEqual([noDefault.status, noDefault.result, noDefault.via_default, noDefault.diagnostics], ['ok', null, false, []]);
});

test('§12.1 l.632 (E-0020): collect returns every matching non-default row in document order, else [default], else []', () => {
  for (const rd of ['last', 'first', 'middle']) {
    const t = TH({ policy: 'collect', rd });
    assert.deepEqual(run(t, { [MAT]: 'Y', [CNT]: '1' }).result.map((r) => r.rule), ['r1', 'r2', 'r3']);
    assert.deepEqual(run(t, { [MAT]: 'X' }).result.map((r) => r.rule), ['r1']);
    const dflt = run(t, {});
    assert.deepEqual(dflt.result.map((r) => r.rule), ['rd']);
    assert.equal(dflt.via_default, true);
  }
  const none = run(TH({ policy: 'collect', rd: 'none' }), {});
  assert.deepEqual([none.status, none.result, none.via_default], ['ok', [], false]);
  const all = run(TH({ policy: 'collect' }), { [MAT]: 'Y', [CNT]: '1' });
  assert.deepEqual(all.result.map((r) => r.rule_index), [0, 1, 2]);
  assert.equal(all.via_default, false);
});

test('§12.1 l.633 (E-0020): unique returns the single match, falls back to the default, and reports 2+ matches as KF-E-312', () => {
  const t = table([['r1', { material: 'X' }], ['r2', { material: 'Y' }], ['rd', 'default']], { inputs: ins('e'), policy: 'unique' });
  assert.equal(ruleOf(run(t, { [MAT]: 'Y' })), 'r2');
  const fallback = run(t, { [MAT]: 'Z' });
  assert.deepEqual([fallback.result.rule, fallback.via_default], ['rd', true]);
  assert.equal(run(table(t.rules.slice(0, 2).map((r) => [r.id, r.when]), { inputs: ins('e'), policy: 'unique' }), { [MAT]: 'Z' }).result, null);
  const overlap = TH({ policy: 'unique' });
  const bad = run(overlap, { [MAT]: 'Y' });
  assert.deepEqual([bad.status, bad.result, bad.via_default], ['error', null, false]);
  assert.equal(bad.diagnostics.length, 1);
  const d = bad.diagnostics[0];
  assert.deepEqual([d.code, d.proof, d.rules, d.rule_indexes, d.pointer, d.rule, d.rule_index], ['KF-E-312', 'evaluation', ['r1', 'r2'], [0, 1], '/rules/0', 'r1', 0]);
  assert.equal(ruleOf(run(overlap, { [MAT]: 'X' })), 'r1');
  assert.deepEqual(run(overlap, { [MAT]: 'Y', [CNT]: '1' }).diagnostics[0].rules, ['r1', 'r2', 'r3']);
});

test('§12.1 l.632 (E-0021): then is returned verbatim as an isolated deep copy; hostile keys stay data', () => {
  const then = { valid: true, outcome: 'OUT-0001', limit: Q('4.2'), note: 'x', n: 5, nested: { a: [1, '2', null, { b: false }] } };
  const hostile = JSON.parse('{"__proto__": {"polluted": true}, "constructor": 1}');
  const t = deepFreeze(table([['r1', { material: 'X' }, then], ['r2', 'default', hostile]], { inputs: ins('e') }));
  const first = evaluateDecisionTable(t, deepFreeze({ [MAT]: 'X' }), deepFreeze({ unitRegistry: REGISTRY }));
  assert.deepEqual(first.result.then, then);
  assert.strictEqual(first.result.then.n, 5);
  assert.notStrictEqual(first.result.then, t.rules[0].then);
  assert.notStrictEqual(first.result.then.nested.a, t.rules[0].then.nested.a);
  first.result.then.nested.a.push('mutated');
  const second = evaluateDecisionTable(t, { [MAT]: 'X' }, OPTS);
  assert.deepEqual(second.result.then, then);
  const def = evaluateDecisionTable(t, { [MAT]: 'Y' }, OPTS);
  assert.equal(Object.hasOwn(def.result.then, '__proto__'), true);
  assert.equal(Object.getPrototypeOf(def.result.then), Object.prototype);
  assert.equal({}.polluted, undefined);
  assert.equal(def.result.then.constructor, 1);
});

test('E-0021: quantities in then (any depth, E-0022 D-07) need a declared unit and a decimal string value', () => {
  const withThen = (then) => table([['r1', { material: 'X' }, then], ['r2', 'default']], { inputs: ins('e') });
  assert.deepEqual(check(withThen({ limit: Q('4.2'), outcome: 'OUT-0001' })), []);
  for (const then of [{ limit: Q('4.2', 'furlong') }, { a: { b: Q('1', 'furlong') } }, { a: [Q('1', 'furlong')] }, { a: { b: [{ c: Q('1', 'furlong') }] } },
    { a: { value: '1', unit: 5 } }]) {
    both(withThen(then), 'UNKNOWN_UNIT');
  }
  for (const value of ['4,2', 5, null, '']) both(withThen({ a: { b: { value, unit: 'kg' } } }), 'INVALID_DECIMAL');
  const opaque = { a: { value: '1', unit: 'furlong', extra: true }, b: { value: 'free text' }, c: { unit: 'furlong' }, d: 'furlong', e: [{ value: 'x' }] };
  const t = withThen(opaque);
  assert.deepEqual(check(t), []);
  assert.deepEqual(run(t, { [MAT]: 'X' }).result.then, opaque);
  assert.deepEqual(check(withThen({ n: 5, ok: Q('1') })), []);
});

// ============================================================================================ exhaustive
const exhaustiveTable = (rows, inputs, policy = 'first') => table(rows, { inputs, policy, exhaustive: true });
const enumInput = (ref, size, prefix = 'v') => ({ ref, type: 'enum', domain: Array.from({ length: size }, (_, i) => `${prefix}${String(i).padStart(3, '0')}`) });
const only311 = (diags) => diags.filter((d) => d.code === 'KF-E-311');

test('§12.1 l.634: exhaustive true is satisfied by a default row, with or without uncovered tuples', () => {
  assert.deepEqual(check(exhaustiveTable([['r1', { concentration: { lte: Q('4.2') } }], ['rd', 'default']], ins('q'))), []);
  assert.deepEqual(check(exhaustiveTable([['r1', { material: 'X' }], ['rd', 'default']], ins('e'))), []);
  const big = enumInput('DE-1.v', 300);
  assert.deepEqual(check(exhaustiveTable([['r1', { v: big.domain[0] }], ['rd', 'default']], [big])), []);
  assert.deepEqual(check(exhaustiveTable([['rd', 'default']], ins('q', 'b', 's'))), []);
});

test('§12.1 l.634: exhaustive false or absent is not checked', () => {
  assert.deepEqual(check(table([['r1', { material: 'X' }]], { inputs: ins('e') })), []);
  assert.deepEqual(check(table([['r1', { concentration: { lte: Q('1') } }]], { inputs: ins('q') })), []);
  const t = table([['r1', { material: 'X' }]], { inputs: ins('e') });
  delete t.exhaustive;
  assert.deepEqual(check(t), []);
});

test('§12.1 l.634: enum-only inputs within the limit are proven by enumeration, with the witness of the first uncovered tuple', () => {
  assert.deepEqual(check(exhaustiveTable([['r1', { material: { not_in: ['X'] } }], ['r2', { material: 'X' }]], ins('e'))), []);
  let diags = check(exhaustiveTable([['r1', { material: { in: ['X', 'Y'] } }]], ins('e')));
  assert.equal(diags.length, 1);
  const d = diags[0];
  assert.deepEqual([d.code, d.reason, d.pointer, d.rule, d.rule_index, d.limit, d.remediation], ['KF-E-311', 'uncovered_tuple', '/exhaustive', null, null, 256, 'añadir `when: default`']);
  assert.deepEqual(d.witness, { [MAT]: 'Z' });
  const two = [{ ref: 'DE-1.a', type: 'enum', domain: ['X', 'Y'] }, { ref: 'DE-1.b', type: 'enum', domain: ['P', 'Q', 'R'] }];
  diags = check(exhaustiveTable([['r1', { a: 'X' }], ['r2', { a: 'Y', b: { in: ['P', 'Q'] } }]], two));
  assert.deepEqual(diags[0].witness, { 'DE-1.a': 'Y', 'DE-1.b': 'R' });
  assert.deepEqual(Object.keys(diags[0].witness), ['DE-1.a', 'DE-1.b'], 'witness keys follow inputs[] order');
  diags = check(exhaustiveTable([['r1', { a: 'X', b: 'P' }]], two));
  assert.deepEqual(diags[0].witness, { 'DE-1.a': 'X', 'DE-1.b': 'Q' }, 'first input outermost, last input varies fastest (E-0022 D-06)');
  diags = check(exhaustiveTable([['r1', { b: 'P' }]], two));
  assert.deepEqual(diags[0].witness, { 'DE-1.a': 'X', 'DE-1.b': 'Q' });
});

test('§12.1 l.634 (E-0020): the proof limit is inclusive and explicit; default 256', () => {
  assert.equal(DEFAULT_PROOF_LIMIT, 256);
  const covered = (n) => { const e = enumInput('DE-1.v', n); return exhaustiveTable([['r1', { v: { in: e.domain.slice(0, n - 1) } }], ['r2', { v: e.domain[n - 1] }]], [e]); };
  assert.deepEqual(check(covered(256)), []);
  let diags = check(covered(257));
  assert.deepEqual([diags[0].reason, diags[0].product, diags[0].limit], ['over_limit', 257, 256]);
  assert.deepEqual(check(covered(257), { ...OPTS, proofLimit: 257 }), []);
  diags = check(covered(256), { ...OPTS, proofLimit: 255 });
  assert.deepEqual([diags[0].reason, diags[0].product, diags[0].limit], ['over_limit', 256, 255]);
  diags = check(exhaustiveTable([['r1', { material: 'X' }]], ins('e')), { ...OPTS, proofLimit: 0 });
  assert.deepEqual([diags[0].reason, diags[0].product, diags[0].limit], ['over_limit', 3, 0]);
  const names = (p) => Array.from({ length: 16 }, (_, i) => `${p}${i}`);
  const pair = [{ ref: 'DE-1.a', type: 'enum', domain: names('a') }, { ref: 'DE-1.b', type: 'enum', domain: names('b') }];
  assert.deepEqual(check(exhaustiveTable(names('a').map((a, i) => [`r${i}`, { a, b: { in: names('b') } }]), pair)), [], '16 x 16 = 256');
  for (const bad of [-1, 1.5, '256', Number.NaN, null, Number.POSITIVE_INFINITY]) {
    assert.equal(checkCode(covered(3), { ...OPTS, proofLimit: bad }), 'INVALID_ARGUMENT', String(bad));
  }
  assert.deepEqual(check(covered(3), { ...OPTS, proofLimit: undefined }), []);
});

test('§12.1 l.634: non-enum inputs, a missing domain and an over-limit product are KF-E-311 with the reason and the first offending input', () => {
  const rows = (when) => [['r1', when]];
  const cases = [
    ['b', { flag: true }, 'DE-1.flag'], ['d', { count: { gt: '0' } }, 'DE-1.count'], ['s', { note: 'a' }, 'DE-1.note'],
    ['q', { concentration: { gt: Q('0') } }, TQ],
  ];
  for (const [name, when, ref] of cases) {
    const diags = check(exhaustiveTable(rows(when), ins(name)));
    assert.deepEqual([diags.length, diags[0].reason, diags[0].input, diags[0].remediation], [1, 'non_enum_input', ref, 'añadir `when: default`'], name);
  }
  const noDomain = { ref: MAT, type: 'enum' };
  let diags = only311(check(exhaustiveTable(rows({ material: { is_null: false } }), [noDomain])));
  assert.deepEqual([diags[0].reason, diags[0].input], ['missing_domain', MAT]);
  diags = only311(check(exhaustiveTable(rows({ concentration: { is_null: true } }), [noDomain, IN.q])));
  assert.deepEqual([diags[0].reason, diags[0].input], ['missing_domain', MAT]);
  diags = only311(check(exhaustiveTable(rows({ concentration: { is_null: true } }), [IN.q, noDomain])));
  assert.deepEqual([diags[0].reason, diags[0].input], ['non_enum_input', TQ]);
  diags = only311(check(exhaustiveTable(rows({ concentration: { is_null: true } }), [enumInput('DE-1.big', 300), IN.q])));
  assert.deepEqual([diags[0].reason, diags[0].input], ['non_enum_input', TQ], 'a per-input defect precedes the product');
  const huge = Array.from({ length: 12 }, (_, i) => enumInput(`DE-1.f${i}`, 200));
  diags = check(exhaustiveTable([['r1', { f0: 'v000' }]], huge));
  assert.equal(diags.length, 1);
  assert.deepEqual([diags[0].reason, diags[0].product, typeof diags[0].product], ['over_limit', (200n ** 12n).toString(), 'string']);
});

test('§12.1 l.634 (E-0008(d)): a KF-E-311 finding does not block evaluation; the BR-0037 shape yields exactly one non_enum_input', () => {
  const t = exhaustiveTable([['r1', { material: { not_in: ['X'] } }], ['r2', { material: 'X' }]], ins('q', 'e'));
  const diags = check(t);
  assert.deepEqual(diags.map((d) => [d.code, d.reason, d.input]), [['KF-E-311', 'non_enum_input', TQ]]);
  assert.equal(ruleOf(run(t, { [MAT]: 'Y' })), 'r1');
  assert.equal(run(t, { [MAT]: 'Y' }).status, 'ok');
  assert.deepEqual(check(exhaustiveTable([['r1', {}]], ins('e'))), [], 'a top-level {} row covers every enumerated tuple');
  assert.equal(check(exhaustiveTable([['r1', {}]], ins('q')))[0].reason, 'non_enum_input', '{} does not satisfy the default requirement');
});

// ================================================================================================ unique
const NON_ENUM = ins('q', 'd', 's', 'b');
const pairTable = (inputs, w1, w2) => table([['r1', w1], ['r2', w2]], { inputs, policy: 'unique' });
const o312 = (diags) => diags.map((d) => [d.code, d.proof, d.rules.join('+')]);

test('§12.1 l.633 (E-0020): all-enum tables within the limit are checked by exact enumeration with a witness', () => {
  const AB = [{ ref: 'DE-1.a', type: 'enum', domain: ['X', 'Y'] }, { ref: 'DE-1.b', type: 'enum', domain: ['P', 'Q'] }];
  let diags = check(pairTable(AB, { a: 'X' }, { a: { in: ['X', 'Y'] }, b: 'P' }));
  assert.equal(diags.length, 1);
  assert.deepEqual([diags[0].proof, diags[0].rules, diags[0].rule_indexes, diags[0].pointer, diags[0].rule, diags[0].rule_index], ['enumeration', ['r1', 'r2'], [0, 1], '/rules/0', 'r1', 0]);
  assert.deepEqual(diags[0].witness, { 'DE-1.a': 'X', 'DE-1.b': 'P' });
  assert.deepEqual(check(pairTable(AB, { a: 'X', b: 'P' }, { a: 'Y' })), []);
  const A = [AB[0]];
  assert.deepEqual(check(pairTable(A, { a: { ne: 'X' } }, { a: 'X' })), [], 'enumeration is exact where set reasoning is not');
  diags = check(pairTable(A, { a: { ne: 'X' } }, { a: 'Y' }));
  assert.deepEqual([diags[0].proof, diags[0].witness], ['enumeration', { 'DE-1.a': 'Y' }]);
  // E-0025 (1): enumeration needs the product of the sizes (2) and of the sizes plus one (3) within the limit.
  // Restated: before R01 this asserted [] for proofLimit 2.
  assert.deepEqual(check(pairTable(A, { a: { ne: 'X' } }, { a: 'X' }), { ...OPTS, proofLimit: 3 }), [], 'products 2 and 3 <= limit 3');
  diags = check(pairTable(A, { a: { ne: 'X' } }, { a: 'X' }), { ...OPTS, proofLimit: 2 });
  assert.deepEqual(o312(diags), [['KF-E-312', 'not_proven_disjoint', 'r1+r2']], 'product 2 <= 2 but 3 > 2: falls back, ne is not provable');
  diags = check(pairTable(A, { a: { ne: 'X' } }, { a: 'X' }), { ...OPTS, proofLimit: 1 });
  assert.deepEqual(o312(diags), [['KF-E-312', 'not_proven_disjoint', 'r1+r2']], 'over the limit: ne cannot be proven disjoint');
  assert.deepEqual(check(pairTable(A, { a: 'X' }, { a: 'Y' }), { ...OPTS, proofLimit: 1 }), []);
  const first = check(pairTable(AB, { any: [{ all: [{ a: 'X' }, { b: 'Q' }] }, { all: [{ a: 'Y' }, { b: 'P' }] }] }, { any: [{ all: [{ a: 'X' }, { b: 'Q' }] }, { all: [{ a: 'Y' }, { b: 'P' }] }] }));
  assert.deepEqual(first[0].witness, { 'DE-1.a': 'X', 'DE-1.b': 'Q' }, 'first input outermost, last input fastest');
  const three = table([['r1', { a: 'X' }], ['r2', { a: 'Y' }], ['r3', { a: { in: ['X', 'Y'] } }]], { inputs: [AB[0]], policy: 'unique' });
  const out = check(three);
  assert.equal(out.length, 1, 'one diagnostic for the first overlapping tuple');
  assert.deepEqual(out[0].rules, ['r1', 'r3'], 'the first two matching rows in document order');
});

test('§12.1 l.633 (E-0020): interval and set reasoning proves disjointness; equal-by-value and touching bounds overlap', () => {
  const disjoint = [
    [{ count: { lt: '5' } }, { count: { gte: '5' } }], [{ count: { lt: '5' } }, { count: { gt: '5' } }], [{ count: '5' }, { count: { gt: '5' } }],
    [{ concentration: { lte: Q('4.2') } }, { concentration: { gt: Q('4.2') } }], [{ count: { between: ['1', '5'] } }, { count: { between: ['5.01', '9'] } }],
    [{ count: { between: ['1', '5'] } }, { count: { gt: '5' } }], [{ count: '1' }, { count: '2' }], [{ count: { in: ['1', '2'] } }, { count: { in: ['3'] } }],
    [{ note: { in: ['a', 'b'] } }, { note: { in: ['c'] } }], [{ note: 'a' }, { note: 'b' }], [{ flag: true }, { flag: false }],
    [{ count: { lt: '5' }, note: 'a' }, { count: { gt: '7' }, flag: true }], [{ count: { in: ['1', '9'] } }, { count: { between: ['2', '8'] } }],
    [{ count: { gt: '1' }, all: [{ count: { lt: '3' } }] }, { count: '3.0' }], [{ count: { lte: '4.20' } }, { count: { gt: '4.2' } }],
  ];
  disjoint.forEach(([w1, w2], i) => {
    assert.deepEqual(check(pairTable(NON_ENUM, w1, w2)), [], `pair ${i}`);
    assert.deepEqual(check(pairTable(NON_ENUM, w2, w1)), [], `pair ${i} swapped`);
  });
  const overlapping = [
    [{ count: { lte: '5' } }, { count: { gte: '5' } }], [{ count: { lt: '5' } }, { count: { gt: '4' } }], [{ count: { between: ['1', '5'] } }, { count: { between: ['5', '9'] } }],
    [{ count: '5' }, { count: '5.0' }], [{ count: '1' }, { count: { in: ['1', '2'] } }], [{ note: { in: ['a', 'b'] } }, { note: { in: ['b', 'c'] } }],
    [{ count: { gt: '0' } }, { count: { gt: '10' } }], [{ count: { gt: '1' } }, { count: { lt: '5' } }], [{ flag: true }, { flag: true }],
    [{ concentration: { lte: Q('4.2') } }, { concentration: { gte: Q('4.2') } }],
  ];
  overlapping.forEach(([w1, w2], i) => {
    assert.deepEqual(o312(check(pairTable(NON_ENUM, w1, w2))), [['KF-E-312', 'not_proven_disjoint', 'r1+r2']], `overlap ${i} ${JSON.stringify([w1, w2])}`);
  });
});

test('§12.1 l.633 (E-0020): fail closed; any pair not proven disjoint is reported, in pair order', () => {
  const failClosed = [
    [{ any: [{ note: 'a' }, { note: 'b' }] }, { note: 'c' }], [{ note: { not_in: ['a'] } }, { note: 'a' }], [{ note: { ne: 'a' } }, { note: 'a' }],
    [{ note: { matches: '^a' } }, { note: { matches: '^b' } }], [{ not: { note: 'a' } }, { note: 'a' }], [{ count: { lt: '5' } }, { note: 'a' }],
    [{ note: { matches: '^a' }, count: '1' }, { count: '2' }], [{ count: { is_null: true } }, { count: { gt: '1' } }], [{ count: null }, { count: '1' }],
    [{ concentration: { lte: Q('4.2') } }, { concentration: Q('5', 'ppm_mass') }],
  ];
  failClosed.forEach(([w1, w2], i) => {
    assert.equal(check(pairTable(NON_ENUM, w1, w2)).filter((d) => d.code === 'KF-E-312').length, 1, `pair ${i} ${JSON.stringify([w1, w2])}`);
  });
  const t = table([['r1', { count: { gte: '0' } }], ['r2', { count: { gte: '0' } }], ['r3', { count: { gte: '0' } }]], { inputs: NON_ENUM, policy: 'unique' });
  const diags = check(t);
  assert.deepEqual(diags.map((d) => d.rule_indexes), [[0, 1], [0, 2], [1, 2]]);
  assert.deepEqual(diags.map((d) => d.pointer), ['/rules/0', '/rules/0', '/rules/1']);
  const top = pairTable(NON_ENUM, {}, { count: { gt: '0' } });
  assert.deepEqual(o312(check(top)), [['KF-E-312', 'not_proven_disjoint', 'r1+r2']], 'a {} row overlaps everything');
  assert.deepEqual(o312(check(pairTable(ins('e'), {}, { material: 'X' }))), [['KF-E-312', 'enumeration', 'r1+r2']]);
});

test('§12.1 l.633 (E-0020): a default row never overlaps; only unique tables are checked for overlap', () => {
  assert.deepEqual(check(table([['rd', 'default']], { inputs: ins('e'), policy: 'unique' })), []);
  assert.deepEqual(check(table([['r1', { material: 'X' }], ['rd', 'default']], { inputs: ins('e'), policy: 'unique' })), []);
  assert.deepEqual(check(table([['r1', {}], ['rd', 'default']], { inputs: ins('e'), policy: 'unique' })), []);
  for (const policy of ['first', 'collect']) {
    assert.deepEqual(check(table([['r1', { material: 'X' }], ['r2', { material: 'X' }]], { inputs: ins('e'), policy })), [], policy);
  }
  assert.deepEqual(check(table([['r1', { material: 'X' }]], { inputs: ins('e'), policy: 'unique' })), []);
});

// ===================================================================================== diagnostics
const allFive = () => table([
  ['r1', { concentration: { lte: Q('4', 'ppm_mass') } }], ['r2', { material: 'W' }], ['r3', { note: { matches: '(a)\\1' } }],
], { inputs: [IN.q, { ...IN.e, domain: ['X', 'Y'] }, IN.s], policy: 'unique', exhaustive: true });

test('§42.2 l.1765-1770: each in-scope code has a positive and a near-miss case', () => {
  const positives = [
    ['KF-E-310', S1({ concentration: { lte: Q('4.2', 'ppm_mass') } }, ins('q'))],
    ['KF-E-311', exhaustiveTable([['r1', { material: 'X' }]], ins('q', 'e'))],
    ['KF-E-312', pairTable(ins('d'), { count: { lte: '5' } }, { count: { gte: '5' } })],
    ['KF-E-314', S1({ material: 'W' }, ins('e'))],
    ['KF-E-315', S1({ note: { matches: '(?=a)' } }, ins('s'))],
  ];
  const nearMisses = [
    S1({ concentration: { lte: Q('4.2') } }, ins('q')), exhaustiveTable([['r1', { material: { in: ['X', 'Y', 'Z'] } }]], ins('e')),
    pairTable(ins('d'), { count: { lt: '5' } }, { count: { gte: '5' } }), S1({ material: 'X' }, ins('e')), S1({ note: { matches: '(?:a)' } }, ins('s')),
  ];
  positives.forEach(([code, t], i) => {
    const diags = check(t);
    assert.ok(diags.length >= 1 && diags.every((d) => d.code === code), code);
    assert.deepEqual(check(nearMisses[i]), [], `near-miss of ${code}`);
  });
});

test('§42.2 / §36 l.1600: diagnostics are structured; KF-E-311 alone carries the catalog remediation; the order is the PLAN sort key', () => {
  const diags = check(allFive());
  assert.deepEqual(pairs(diags), [
    ['KF-E-310', '/rules/0/when/concentration/lte'], ['KF-E-311', '/exhaustive'], ['KF-E-312', '/rules/0'], ['KF-E-312', '/rules/0'],
    ['KF-E-312', '/rules/1'], ['KF-E-314', '/rules/1/when/material'], ['KF-E-315', '/rules/2/when/note/matches'],
  ]);
  assert.deepEqual(diags.slice(2, 5).map((d) => d.rules), [['r1', 'r2'], ['r1', 'r3'], ['r2', 'r3']]);
  for (const d of diags) {
    assert.equal(d.severity, 'E');
    assert.equal(typeof d.message, 'string');
    assert.equal(Object.hasOwn(d, 'error'), false);
    assert.equal(d.remediation, d.code === 'KF-E-311' ? 'añadir `when: default`' : undefined);
    assert.equal(Object.hasOwn(d, 'remediation'), d.code === 'KF-E-311');
  }
  assert.deepEqual(sortDiagnostics(diags), diags);
  assert.deepEqual(sortDiagnostics([...diags].reverse()), diags);
});

test('§42.2 l.1765-1770: the local catalog constants equal the spec rows (P-09)', () => {
  assert.deepEqual(Object.keys(LOGIC_DIAGNOSTIC_CATALOG).sort(), ['KF-E-310', 'KF-E-311', 'KF-E-312', 'KF-E-314', 'KF-E-315']);
  for (const [code, entry] of Object.entries(LOGIC_DIAGNOSTIC_CATALOG)) {
    assert.equal(entry.code, code);
    assert.equal(entry.severity, 'E');
    assert.equal(entry.remediation, code === 'KF-E-311' ? 'añadir `when: default`' : undefined);
  }
  assert.equal(Object.isFrozen(LOGIC_DIAGNOSTIC_CATALOG), true);
  assert.equal('KF-E-313' in LOGIC_DIAGNOSTIC_CATALOG, false, 'KF-E-313 and KF-E-316 are P012');
  assert.equal('KF-E-316' in LOGIC_DIAGNOSTIC_CATALOG, false);
});

test('§42.2 l.1740 (E-0022 D-01, E-0014): a KF- code is never thrown and a typed error is never a diagnostic', () => {
  for (const code of LOGIC_ERROR_CODES) assert.equal(code.startsWith('KF-'), false);
  assert.deepEqual(LOGIC_ERROR_CODES, [...LOGIC_ERROR_CODES].sort());
  assert.equal(LOGIC_ERROR_CODES.includes('DIVISION_BY_ZERO'), false);
  assert.equal(LOGIC_ERROR_CODES.includes('INVALID_PRECISION'), false);
  const error = new LogicError('INVALID_TABLE', 'x', { a: 1 });
  assert.ok(error instanceof Error);
  assert.deepEqual([error.name, error.code, error.details], ['LogicError', 'INVALID_TABLE', { a: 1 }]);
  for (const t of [allFive(), S1({ material: 'W' }, ins('e'))]) {
    const res = run(t, {});
    for (const d of [...check(t), ...res.diagnostics]) assert.match(d.code, /^KF-E-3\d\d$/);
  }
});

test('§42.2 / E-0021: INVALID_ARGUMENT for a missing or foreign registry, bad values, bad proofLimit', () => {
  const t = S1({ material: 'X' }, ins('e'));
  for (const options of [undefined, null, {}, { unitRegistry: null }, { unitRegistry: { units: [], conversions: [] } }, { unitRegistry: { has: () => true, units: [] } }, 'x']) {
    assert.equal(codeOf(() => checkDecisionTable(clone(t), options)), 'INVALID_ARGUMENT');
    assert.equal(codeOf(() => evaluateDecisionTable(clone(t), {}, options)), 'INVALID_ARGUMENT');
  }
  for (const values of [null, undefined, [], 'x', 5, true]) {
    assert.equal(codeOf(() => evaluateDecisionTable(clone(t), values, OPTS)), 'INVALID_ARGUMENT', String(values));
  }
  assert.deepEqual(run(t, {}).status, 'ok');
  assert.equal(codeOf(() => evaluateDecisionTable(clone(t), Object.create(null), OPTS)), 'NO_THROW', 'a prototype-less mapping is a valid values argument');
});

test('E-0019: static findings 310/314/315 stop the evaluation; the findings are returned, nothing is evaluated', () => {
  const t = allFive();
  const res = run(t, {});
  assert.equal(res.status, 'error');
  assert.equal(res.result, null);
  assert.equal(res.via_default, false);
  assert.deepEqual(res.diagnostics.map((d) => d.code), ['KF-E-310', 'KF-E-314', 'KF-E-315']);
  assert.equal(res.hit_policy, 'unique');
  const clean = run(S1({ material: 'X' }, ins('e')), { [MAT]: 'X' });
  assert.deepEqual([clean.status, clean.diagnostics], ['ok', []]);
});

// ===================================================================== determinism, purity, adversarial
test('§12.1 (determinism): permuting the key order of every mapping gives identical diagnostics and results', () => {
  const permute = (v) => {
    if (Array.isArray(v)) return v.map(permute);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).reverse().map((k) => [k, permute(v[k])]));
    return v;
  };
  const multi = table([
    ['r1', { concentration: { lte: Q('4', 'ppm_mass') }, material: 'W' }],
    ['r2', { note: { matches: '(a)\\1' }, concentration: { gt: Q('1', 'percent_volume') } }],
    ['r3', { material: { in: ['X', 'Q'] }, note: { matches: '(?=b)' } }],
  ], { inputs: [IN.q, { ...IN.e, domain: ['X', 'Y'] }, IN.s], policy: 'unique', exhaustive: true });
  for (const t of [allFive(), multi, TH({ policy: 'unique' })]) {
    assert.deepEqual(check(permute(t)), check(t));
    assert.equal(JSON.stringify(check(permute(t))), JSON.stringify(check(t)), 'byte identical');
  }
  const th = TH({ policy: 'collect' });
  assert.deepEqual(run(permute(th), permute({ [MAT]: 'Y', [CNT]: '1' })), run(th, { [MAT]: 'Y', [CNT]: '1' }));
});

test('§12.1 (purity): frozen tables, values and options are accepted; results are fresh and the inputs are unchanged', () => {
  const t = deepFreeze(clone(allFive()));
  const options = deepFreeze({ unitRegistry: REGISTRY, proofLimit: 256 });
  const snapshot = JSON.stringify(t);
  const a = checkDecisionTable(t, options);
  const b = checkDecisionTable(t, options);
  assert.notStrictEqual(a, b);
  assert.deepEqual(a, b);
  const ok = deepFreeze(TH({ policy: 'collect' }));
  const values = deepFreeze({ [MAT]: 'Y', [CNT]: '1' });
  const r1 = evaluateDecisionTable(ok, values, options);
  const r2 = evaluateDecisionTable(ok, values, options);
  assert.notStrictEqual(r1.result, r2.result);
  assert.notStrictEqual(r1.result[0], r2.result[0]);
  assert.deepEqual(r1, r2);
  assert.equal(JSON.stringify(t), snapshot);
});

test('§12.1 (adversarial): hostile nesting depth, large tables and long inputs fail cleanly or finish quickly', () => {
  let deep = { material: 'X' };
  for (let i = 0; i < 5000; i += 1) deep = { not: deep };
  const deepTable = S1(deep, ins('e'));
  assert.equal(codeOf(() => checkDecisionTable(deepTable, OPTS)), 'INVALID_TABLE');
  assert.equal(codeOf(() => evaluateDecisionTable(deepTable, {}, OPTS)), 'INVALID_TABLE');
  let ok = { material: 'X' };
  for (let i = 0; i < 300; i += 1) ok = { not: ok };
  assert.deepEqual(check(S1(ok, ins('e'))), []);
  assert.equal(ruleOf(run(S1(ok, ins('e')), { [MAT]: 'X' })), 'r1', 'an even number of nots');
  let deepThen = { v: 1 };
  for (let i = 0; i < 5000; i += 1) deepThen = { n: deepThen };
  const deepThenTable = table([['r1', { material: 'X' }, deepThen]], { inputs: ins('e') });
  assert.equal(codeOf(() => checkDecisionTable(deepThenTable, OPTS)), 'INVALID_TABLE');
  assert.equal(codeOf(() => evaluateDecisionTable(deepThenTable, {}, OPTS)), 'INVALID_TABLE');
  const start = performance.now();
  const rows = Array.from({ length: 2000 }, (_, i) => [`r${i}`, { count: { between: [String(i * 10), String(i * 10 + 9)] } }]);
  const wide = table(rows, { inputs: ins('d'), policy: 'unique' });
  assert.deepEqual(check(wide), [], 'disjoint intervals');
  assert.equal(ruleOf(run(wide, { [CNT]: '12345.5' })), 'r1234');
  assert.ok(performance.now() - start < 8000, 'a 2000-row unique table checks in reasonable time');
  const longText = 'a'.repeat(200000);
  assert.equal(ruleOf(run(S1({ note: { matches: '^(a+)+$' } }, ins('s')), { 'DE-1.note': longText })), 'r1');
});

test('§12.1 (adversarial): property names such as __proto__ in refs, rule ids and witnesses stay plain data', () => {
  const parsed = JSON.parse('{"kind":"decision-table","hit_policy":"first","exhaustive":true,"inputs":[{"ref":"__proto__","type":"enum","domain":["X","Y"]}],"rules":[{"id":"r1","when":{"__proto__":"X"},"then":{}}]}');
  const diags = checkDecisionTable(parsed, OPTS);
  assert.equal(diags.length, 1);
  assert.equal(diags[0].reason, 'uncovered_tuple');
  assert.equal(Object.hasOwn(diags[0].witness, '__proto__'), true);
  assert.equal(diags[0].witness.__proto__, 'Y');
  assert.equal(Object.getPrototypeOf(diags[0].witness), Object.prototype);
  assert.equal(JSON.parse('{"__proto__":"X"}').polluted, undefined);
});

test('§12.1 l.632 (adversarial): rule and pointer escaping follows RFC 6901 for odd field names', () => {
  const inputs = [{ ref: 'a/b~c.d/e', type: 'enum', domain: ['X'] }];
  const t = S1({ 'd/e': 'W' }, inputs);
  const diags = check(t);
  assert.equal(diags[0].pointer, '/rules/0/when/d~1e');
  assert.equal(diags[0].code, 'KF-E-314');
});

// ===================================================================================== existing data
const CONF = path.join(ROOT, 'framework', 'conformance');
const readYaml = async (...parts) => YAML.parse(await fs.readFile(path.join(CONF, ...parts), 'utf8'));

test('§55 l.2077: the acme BR-0001 decision-table facets check clean and evaluate', async () => {
  const rule = await readYaml('acme-formulation', 'knowledge', 'business-rules', 'BR-0001', 'rule.yaml');
  const v1 = rule.specified[0].logic;
  assert.deepEqual(check(v1), []);
  const r1 = run(v1, { 'DE-0001.concentration': Q('4.2') });
  assert.deepEqual([r1.result.rule, r1.result.then, r1.via_default], ['r1', { valid: true, outcome: 'OUT-0001' }, false]);
  const r2 = run(v1, { 'DE-0001.concentration': Q('4.21') });
  assert.deepEqual([r2.result.rule, r2.result.then, r2.via_default], ['r2', { valid: false }, true]);
  assert.equal(ruleOf(run(v1, {})), 'r2');
  assert.equal(run(v1, { 'DE-0001.concentration': Q('4.2', 'ppm_mass') }).diagnostics[0].code, 'KF-E-310');
  const v2 = rule.specified[1].logic;
  assert.deepEqual(check(v2), []);
  assert.equal(ruleOf(run(v2, { 'DE-0001.concentration': Q('4.0') })), 'r1');
  assert.equal(ruleOf(run(v2, { 'DE-0001.concentration': Q('4.1') })), 'r2');
});

test('§55 l.2077 (E-0022 D-08): the observed BR-0001 facet with when {} checks clean and always matches', async () => {
  const observed = await readYaml('acme-formulation', 'knowledge', 'business-rules', 'BR-0001', 'observed', 'legacy-app.yaml');
  assert.deepEqual(check(observed.logic), []);
  for (const values of [{}, { 'DE-0001.concentration': Q('100') }]) {
    const res = run(observed.logic, values);
    assert.deepEqual([res.status, res.result.rule, res.result.then], ['ok', 'r1', { max_concentration: { value: '4.5', unit: 'percent_mass' } }]);
  }
});

test('§10.3 l.445-455 (E-0008(d)): the BR-0037 example yields exactly one KF-E-311 and evaluates per E-0019', async () => {
  const example = await readYaml('spec-examples', '10.3-greenfield-rule.yaml');
  const logic = example.specified.logic;
  const diags = check(logic);
  assert.deepEqual(diags.map((d) => [d.code, d.reason, d.input]), [['KF-E-311', 'non_enum_input', 'DE-0017.concentration']]);
  const at = (material) => run(logic, { 'DE-0017.concentration': Q('1'), ...(material === undefined ? {} : { 'DE-0017.material_type': material }) });
  assert.deepEqual([at('Y').result.rule, at('Y').result.then], ['r1', { max_concentration: Q('4.2'), outcome: 'OUT-0004' }]);
  assert.deepEqual([at('X').result.rule, at('X').result.then], ['r2', { exempt: true, outcome: 'OUT-0009' }]);
  const absent = at(undefined);
  assert.deepEqual([absent.status, absent.result, absent.via_default], ['ok', null, false]);
  const outside = at('W');
  assert.deepEqual([outside.status, outside.diagnostics[0].code, outside.diagnostics[0].pointer], ['error', 'KF-E-314', '/inputs/1']);
});

test('§26.1 l.1342: the evaluator is usable by check-rules callers (given values keyed by suffix or full ref)', () => {
  const t = S1({ concentration: { lte: Q('4.2') } }, ins('q'));
  assert.equal(ruleOf(run(t, { concentration: Q('4.2') })), 'r1');
  assert.equal(ruleOf(run(t, { [TQ]: Q('9') })), 'r2');
});

test('§50 l.1953-1956: proofLimit is an explicit parameter and the configuration is not read by P011', () => {
  const t = exhaustiveTable([['r1', { material: 'X' }]], ins('e'));
  assert.equal(check(t)[0].limit, 256);
  assert.equal(check(t, { ...OPTS, proofLimit: 1000 })[0].limit, 1000);
  assert.equal(check(t, { ...OPTS, proofLimit: 1000 })[0].reason, 'uncovered_tuple');
});

test('§53 l.2037 item 9 (V-39): the engine modules import only engine siblings and contain no float, clock, randomness or I/O', async () => {
  const dir = path.join(ROOT, 'framework', 'engine');
  const files = ['logic-errors.mjs', 'decimal.mjs', 'units.mjs', 'regex-re2.mjs', 'logic-diagnostics.mjs', 'decision-table.mjs'];
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const file of files) {
    const source = strip(await fs.readFile(path.join(dir, file), 'utf8'));
    for (const m of source.matchAll(/from\s+'([^']+)'/g)) assert.match(m[1], /^\.\/[a-z0-9-]+\.mjs$/, `${file} imports ${m[1]}`);
    assert.doesNotMatch(source, /\bimport\s*\(/, `${file} has a dynamic import`);
    for (const word of ['parseFloat', 'toFixed', 'toPrecision', 'Math.random', 'Date', 'performance', 'process.env', 'crypto', 'readFile', 'setTimeout', 'setInterval', 'require(']) {
      assert.equal(source.includes(word), false, `${file} contains ${word}`);
    }
  }
  const decimal = strip(await fs.readFile(path.join(dir, 'decimal.mjs'), 'utf8'));
  for (const word of ['Number(', 'parseInt', 'Math.']) assert.equal(decimal.includes(word), false, `decimal.mjs contains ${word}`);
  const dt = strip(await fs.readFile(path.join(dir, 'decision-table.mjs'), 'utf8'));
  assert.equal(/Math\./.test(dt), false, 'no Math in the evaluator');
});

// ================================================================================================ R01 remediation
const AXY = { ref: 'DE-1.a', type: 'enum', domain: ['X', 'Y'] };
const BPQ = { ref: 'DE-1.b', type: 'enum', domain: ['P', 'Q'] };

test('§12.1 l.633 (E-0025 (1), AUDIT R01 F03): unique enumerates every domain value and then null; the witness may contain null', () => {
  const t = pairTable([AXY], { not: { a: 'X' } }, { a: { is_null: true } });
  const diags = check(t);
  assert.deepEqual(o312(diags), [['KF-E-312', 'enumeration', 'r1+r2']]);
  assert.deepEqual(diags[0].witness, { 'DE-1.a': null });
  // the evaluation of the same table with the input absent reports the overlap the check announced
  const res = run(t, {});
  assert.equal(res.status, 'error');
  assert.deepEqual(res.diagnostics.map((d) => [d.code, d.proof, d.rules]), [['KF-E-312', 'evaluation', ['r1', 'r2']]]);
  assert.equal(run(t, { 'DE-1.a': 'Y' }).result.rule, 'r1');
  // D-06 order with null last: first input outermost, last input fastest
  const AB = [AXY, BPQ];
  let out = check(pairTable(AB, { not: { a: 'X' } }, { all: [{ a: { is_null: true } }, { b: 'P' }] }));
  assert.deepEqual(out[0].witness, { 'DE-1.a': null, 'DE-1.b': 'P' });
  out = check(pairTable(AB, { not: { b: 'P' } }, { all: [{ a: 'X' }, { b: { is_null: true } }] }));
  assert.deepEqual(out[0].witness, { 'DE-1.a': 'X', 'DE-1.b': null });
  out = check(pairTable(AB, { not: { a: 'X' } }, { b: { is_null: true } }));
  assert.deepEqual(out[0].witness, { 'DE-1.a': 'Y', 'DE-1.b': null });
  assert.deepEqual(Object.keys(out[0].witness), ['DE-1.a', 'DE-1.b']);
});

test('§12.1 l.633 (E-0025 (1), l.607): near-misses with an absent input stay clean; beyond the limit the proof fails closed', () => {
  for (const [w1, w2] of [
    [{ a: 'Y' }, { a: { is_null: true } }], [{ a: { ne: 'X' } }, { a: { is_null: true } }], [{ not: { a: 'X' } }, { a: 'X' }],
    [{ not: { a: { is_null: true } } }, { a: { is_null: true } }], [{ a: { is_null: false } }, { a: { is_null: true } }],
  ]) {
    assert.deepEqual(check(pairTable([AXY], w1, w2)), [], JSON.stringify([w1, w2]));
  }
  const names = (n) => Array.from({ length: n }, (_, i) => `v${String(i).padStart(3, '0')}`);
  const big = (n) => pairTable([{ ref: 'DE-1.a', type: 'enum', domain: names(n) }], { not: { a: 'v000' } }, { a: { is_null: true } });
  const at255 = check(big(255));
  assert.deepEqual([o312(at255), at255[0].witness], [[['KF-E-312', 'enumeration', 'r1+r2']], { 'DE-1.a': null }], '256 <= 256');
  assert.deepEqual(o312(check(big(256))), [['KF-E-312', 'not_proven_disjoint', 'r1+r2']], '257 > 256: falls back and fails closed');
  // two inputs: both products must be within the limit
  const two = (n, m) => pairTable([{ ref: 'DE-1.a', type: 'enum', domain: names(n) }, { ref: 'DE-1.b', type: 'enum', domain: names(m) }], { a: { ne: 'v000' } }, { a: 'v000' });
  assert.deepEqual(check(two(15, 15)), [], '225 and 16 x 16 = 256');
  assert.deepEqual(o312(check(two(15, 16))), [['KF-E-312', 'not_proven_disjoint', 'r1+r2']], '240 <= 256 but 16 x 17 = 272');
});

test('§12.1 l.634 (E-0025 (2), AUDIT R01 F03): coverage is proven over the domains only; an exhaustive enum table evaluates an absent input to no match', () => {
  const rows = [['r1', { material: { not_in: ['X'] } }], ['r2', { material: 'X' }]];
  const t = exhaustiveTable(rows, ins('e'));
  assert.deepEqual(check(t), []);
  for (const values of [{}, { 'DE-1.material': null }]) {
    const res = run(t, values);
    assert.deepEqual([res.status, res.result, res.via_default, res.diagnostics], ['ok', null, false, []]);
  }
  assert.equal(run(t, { 'DE-1.material': 'Y' }).result.rule, 'r1');
  const collect = run({ ...t, hit_policy: 'collect' }, {});
  assert.deepEqual([collect.status, collect.result], ['ok', []]);
});

test('§11.2 l.589 (E-0019, E-0025 (3), E-0027 (3), AUDIT R01 F04): a quantity against a non-quantity is KF-E-310 in both directions', () => {
  const detail = (diags) => diags.map((d) => [d.code, d.pointer, d.input, d.expected_unit, d.found_unit, d.source]);
  const quantity = Q('1');
  for (const [name, when, pointer] of [
    ['e', { material: quantity }, '/rules/0/when/material'], ['e', { material: { eq: quantity } }, '/rules/0/when/material/eq'],
    ['e', { material: { in: ['X', quantity] } }, '/rules/0/when/material/in/1'], ['s', { note: quantity }, '/rules/0/when/note'],
    ['s', { note: { ne: quantity } }, '/rules/0/when/note/ne'], ['s', { note: { not_in: ['a', quantity] } }, '/rules/0/when/note/not_in/1'],
    ['b', { flag: quantity }, '/rules/0/when/flag'], ['b', { flag: { eq: quantity } }, '/rules/0/when/flag/eq'],
  ]) {
    const input = ins(name);
    const diags = check(S1(when, input));
    assert.deepEqual(detail(diags), [['KF-E-310', pointer, input[0].ref, null, 'percent_mass', 'literal']], JSON.stringify(when));
    const res = run(S1(when, input), {});
    assert.deepEqual([res.status, res.result, res.diagnostics.map((d) => d.code)], ['error', null, ['KF-E-310']], 'a table with a static finding is not evaluated');
  }
  assert.equal(checkCode(S1({ material: Q('1', 'furlong') }, ins('e'))), 'UNKNOWN_UNIT', 'the literal unit must be declared');
  assert.equal(checkCode(S1({ material: Q('x') }, ins('e'))), 'INVALID_DECIMAL');
  // supplied: a bare scalar for a quantity input
  const tq = S1({ concentration: { lte: Q('4.2') } }, ins('q'));
  for (const supplied of ['abc', 'X', 'true', true, false, '4.2']) {
    const res = run(tq, { [TQ]: supplied });
    assert.deepEqual([res.status, res.result, detail(res.diagnostics)], ['error', null, [['KF-E-310', '/inputs/0', TQ, 'percent_mass', null, 'value']]], String(supplied));
  }
  assert.equal(run(tq, { [TQ]: Q('4.2') }).result.rule, 'r1');
  assert.equal(run(tq, { [TQ]: null }).result.rule, 'r2');
  assert.equal(run(tq, {}).result.rule, 'r2');
  assert.equal(runCode(tq, { [TQ]: 4.2 }), 'INVALID_DECIMAL', 'a JS number is not a decimal string');
  // supplied: a quantity for an enum, string, boolean (and decimal) input
  for (const [name, when, good] of [['e', { material: 'X' }, 'X'], ['s', { note: 'a' }, 'a'], ['b', { flag: true }, true], ['d', { count: '1' }, '1']]) {
    const input = ins(name);
    const t = S1(when, input);
    const res = run(t, { [input[0].ref]: Q('1', 'ppm_mass') });
    assert.deepEqual([res.status, res.result, detail(res.diagnostics)], ['error', null, [['KF-E-310', '/inputs/0', input[0].ref, null, 'ppm_mass', 'value']]], name);
    assert.equal(run(t, { [input[0].ref]: good }).result.rule, 'r1', name);
  }
  // near-misses on the static side
  assert.deepEqual(check(S1({ concentration: Q('1') }, ins('q'))), []);
  assert.deepEqual(check(S1({ material: { in: ['X', 'Y'] } }, ins('e'))), []);
});

test('§12.1 l.620 (E-0019, E-0022 D-02, E-0027 (2), AUDIT R01 F05): a key that is one ref and another suffix is AMBIGUOUS_FIELD', () => {
  const xs = () => [{ ref: 'x', type: 'decimal' }, { ref: 'A.x', type: 'decimal' }];
  both(S1({ x: '1' }, xs()), 'AMBIGUOUS_FIELD');
  both(S1({ not: { x: '1' } }, xs()), 'AMBIGUOUS_FIELD');
  both(S1({ any: [{ 'A.x': '1' }, { x: '1' }] }, xs()), 'AMBIGUOUS_FIELD');
  const t = S1({ 'A.x': '1' }, xs());
  assert.deepEqual(check(t), []);
  assert.equal(run(t, { 'A.x': '1' }).result.rule, 'r1');
  assert.equal(run(t, { 'A.x': '2' }).result.rule, 'r2');
  // supplied keys bind by the same rule
  assert.equal(runCode(t, { x: '1' }), 'AMBIGUOUS_FIELD');
  assert.equal(runCode(t, { 'A.x': '1', x: '1' }), 'AMBIGUOUS_FIELD');
  // near-miss: the key is the full ref of one input and the suffix of no other
  const solo = S1({ x: '1' }, [{ ref: 'x', type: 'decimal' }, { ref: 'B.y', type: 'decimal' }]);
  assert.equal(run(solo, { x: '1', y: '5' }).result.rule, 'r1');
  assert.equal(run(solo, { x: '2' }).result.rule, 'r2');
  assert.equal(checkCode(S1({ nothing: '1' }, xs())), 'UNBOUND_FIELD');
});

test('§12.1 l.633 (E-0020 (b), AUDIT R01 F07): a value set against a closed or open bound, in both orders', () => {
  const overlapping = [
    [{ count: '5' }, { count: { gte: '5' } }], [{ count: '5' }, { count: { lte: '5' } }],
    [{ count: { in: ['1', '5'] } }, { count: { between: ['5', '9'] } }], [{ count: { in: ['1', '2'] } }, { count: { gte: '2.0' } }],
  ];
  const disjoint = [[{ count: { in: ['1', '5'] } }, { count: { gt: '5' } }], [{ count: { in: ['1', '5'] } }, { count: { lt: '1' } }]];
  for (const [w1, w2] of overlapping) {
    for (const [a, b] of [[w1, w2], [w2, w1]]) assert.deepEqual(o312(check(pairTable(NON_ENUM, a, b))), [['KF-E-312', 'not_proven_disjoint', 'r1+r2']], JSON.stringify([a, b]));
  }
  for (const [w1, w2] of disjoint) {
    for (const [a, b] of [[w1, w2], [w2, w1]]) assert.deepEqual(check(pairTable(NON_ENUM, a, b)), [], JSON.stringify([a, b]));
  }
});

test('§36 l.1600 (PLAN sort key, AUDIT R01 F08): evaluation diagnostics are sorted by code and then by pointer in byte order', () => {
  const t = S1({ material: 'X' }, [{ ref: 'DE-1.material', type: 'enum', domain: ['X'] }, { ...IN.q }]);
  const mixed = run(t, { 'DE-1.material': 'W', [TQ]: Q('1', 'ppm_mass') });
  assert.deepEqual(mixed.diagnostics.map((d) => [d.code, d.pointer]), [['KF-E-310', '/inputs/1'], ['KF-E-314', '/inputs/0']]);
  const many = Array.from({ length: 11 }, (_, i) => ({ ref: `DE-1.i${i}`, type: 'enum', domain: ['X'] }));
  const wide = S1({ i0: 'X' }, many);
  assert.deepEqual(run(wide, { 'DE-1.i2': 'W', 'DE-1.i10': 'W' }).diagnostics.map((d) => d.pointer), ['/inputs/10', '/inputs/2']);
  assert.deepEqual(run(wide, { 'DE-1.i9': 'W', 'DE-1.i1': 'W', 'DE-1.i10': 'W' }).diagnostics.map((d) => d.pointer), ['/inputs/1', '/inputs/10', '/inputs/9']);
});

test('§12.1 l.623 (E-0019, AUDIT R01 F11): strings and enum values compare by code point, without Unicode normalization', () => {
  const composed = 'é';
  const decomposed = 'é';
  const row = (when, supplied) => run(S1(when, ins('s')), { 'DE-1.note': supplied }).result.rule;
  assert.equal(row({ note: composed }, decomposed), 'r2');
  assert.equal(row({ note: composed }, composed), 'r1');
  assert.equal(row({ note: decomposed }, composed), 'r2');
  assert.equal(row({ note: { ne: composed } }, decomposed), 'r1');
  assert.equal(row({ note: { in: [composed] } }, decomposed), 'r2');
  assert.equal(row({ note: { not_in: [composed] } }, decomposed), 'r1');
  assert.equal(row({ note: 'abc' }, 'ABC'), 'r2');
});

test('§11.3 l.607 (E-0026 (1), AUDIT R01 F11): literal null operands in ne, in and not_in', () => {
  const rowOf = (name, when, supplied) => {
    const input = ins(name);
    const t = S1(when, input);
    assert.deepEqual(check(t), []);
    return run(t, supplied === undefined ? {} : { [input[0].ref]: supplied }).result.rule;
  };
  assert.equal(rowOf('s', { note: { ne: null } }, 'x'), 'r2', 'ne null is false for a non-null input');
  assert.equal(rowOf('s', { not: { note: { ne: null } } }, 'x'), 'r1');
  assert.equal(rowOf('s', { note: { in: ['x', null] } }, 'x'), 'r1');
  assert.equal(rowOf('s', { note: { in: ['x', null] } }, 'y'), 'r2');
  assert.equal(rowOf('s', { note: { in: ['x', null] } }, undefined), 'r2', 'a null element never matches an absent input');
  assert.equal(rowOf('s', { note: { in: [null] } }, 'x'), 'r2');
  assert.equal(rowOf('s', { note: { not_in: ['y', null] } }, 'x'), 'r2', 'a null element makes not_in false');
  assert.equal(rowOf('s', { note: { not_in: ['y', null] } }, 'y'), 'r2');
  assert.equal(rowOf('s', { note: { not_in: [null] } }, 'x'), 'r2');
  assert.equal(rowOf('s', { note: { not_in: ['y'] } }, 'x'), 'r1', 'near-miss: no null element');
  assert.equal(rowOf('s', { note: { not_in: ['y'] } }, 'y'), 'r2');
  assert.equal(rowOf('s', { note: { not_in: ['y'] } }, undefined), 'r2');
  assert.equal(rowOf('d', { count: { not_in: ['2', null] } }, '1'), 'r2');
  assert.equal(rowOf('d', { count: { in: ['1', null] } }, '1.0'), 'r1');
  assert.equal(rowOf('e', { material: { not_in: ['Y', null] } }, 'X'), 'r2');
  assert.equal(rowOf('e', { material: { in: ['X', null] } }, 'X'), 'r1');
});
