// P011 Decision Table Logic - conformance slice (spec section 55; l.2103: the fixture is the operative
// definition of "done" and is written together with, never after, the feature).
//
// Written by the conformance engineer from PLAN.md (incl. "Foreman decisions after planning"), TRIAGE.md, the
// spec and errata E-0008, E-0014, E-0017..E-0022, BEFORE any implementer code was read. The case index (cites,
// targets, expected summary) is framework/conformance/p011-decision-table.yaml; vectors and builders live in
// framework/conformance/p011-decision-table/. Case ids (F-xx) and targets (V-nn) are those of the PLAN.
//
// P011 is an engine API phase: there is no `kf` command and no framework/conformance/expected/ runner yet
// (P028 ports this slice). The suite drives the public API contract of the PLAN only.
//
// Every engine case is marked todo while the engine is being built: it runs and reports but does not fail
// `npm test`. Removing the marker is the one-line change below (PENDING = false). Expectations are never
// weakened to pass; a missing engine module makes the case fail INSIDE its todo.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { payload } from '../framework/conformance/p011-decision-table/determinism-child.mjs';
import {
  DISJOINT_PAIRS, FAIL_CLOSED_PAIRS, NULL_WHENS, OPERATOR_CASES, OVERLAPPING_PAIRS, Q, REFS, S1, TH,
  allFiveCodes, input, inputs, multiKeyFindings, pair, permute, table, vals,
} from '../framework/conformance/p011-decision-table/tables.mjs';

const PENDING = 'P011 implementation pending'; // set to false to enforce the whole slice

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONF = path.join(REPO_ROOT, 'framework', 'conformance');
const DATA = path.join(CONF, 'p011-decision-table');
const ENGINE_DIR = path.join(REPO_ROOT, 'framework', 'engine');
const readYaml = async (...parts) => YAML.parse(await fs.readFile(path.join(...parts), 'utf8'));

const INDEX = await readYaml(CONF, 'p011-decision-table.yaml');
const UNITS_DATA = {
  u0: await readYaml(DATA, 'units-u0.yaml'),
  u1: await readYaml(DATA, 'units-u1.yaml'),
  u2: await readYaml(DATA, 'units-u2.yaml'),
};
const DECIMALS = await readYaml(DATA, 'decimals.yaml');
const REGEX = await readYaml(DATA, 'regex.yaml');

// ------------------------------------------------------------------ engine modules (public API only)
const FILES = {
  errors: 'logic-errors.mjs',
  dec: 'decimal.mjs',
  units: 'units.mjs',
  re2: 'regex-re2.mjs',
  diag: 'logic-diagnostics.mjs',
  dt: 'decision-table.mjs',
};
const M = {};
const M_ERR = {};
for (const [name, file] of Object.entries(FILES)) {
  try {
    M[name] = await import(pathToFileURL(path.join(ENGINE_DIR, file)).href);
  } catch (error) {
    M_ERR[name] = error;
  }
}
const mod = (name) => {
  if (!M[name]) throw new Error(`framework/engine/${FILES[name]} not importable: ${M_ERR[name]?.message}`);
  return M[name];
};

const covered = new Set();
function check(key, title, fn, timeout = 60000) {
  covered.add(key);
  test(`${key} ${title}`, { todo: PENDING, timeout }, () => fn());
}

// ------------------------------------------------------------------ generic helpers
const clone = (value) => JSON.parse(JSON.stringify(value));
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}
const expand = (x) => {
  if (typeof x === 'string') return x;
  if (x && x.repeat) return x.repeat[0].repeat(x.repeat[1]);
  if (x && x.cat) return x.cat.map(expand).join('');
  throw new Error(`bad vector ${JSON.stringify(x)}`);
};
const reg = (name = 'u1') => mod('units').buildUnitRegistry(clone(UNITS_DATA[name]));

const CODES = ['KF-E-310', 'KF-E-311', 'KF-E-312', 'KF-E-314', 'KF-E-315'];
const REMEDIATION_311 = 'añadir `when: default`'; // spec l.1766
const bytes = (s) => Buffer.from(String(s), 'utf8');
const cmpStr = (a, b) => Buffer.compare(bytes(a), bytes(b));
function cmpDiag(x, y) {
  let c = cmpStr(x.code, y.code);
  if (c) return c;
  c = Math.sign((x.rule_index ?? -1) - (y.rule_index ?? -1));
  if (c) return c;
  c = cmpStr(x.pointer, y.pointer);
  if (c) return c;
  const rx = x.rule_indexes ?? [];
  const ry = y.rule_indexes ?? [];
  for (let i = 0; i < Math.min(rx.length, ry.length); i += 1) {
    c = Math.sign(rx[i] - ry[i]);
    if (c) return c;
  }
  if (rx.length !== ry.length) return rx.length < ry.length ? -1 : 1;
  return cmpStr(x.message ?? '', y.message ?? '');
}

/** Universal diagnostic invariants (PLAN Diagnostic type, S4, sort key). */
function assertDiagnosticList(list, context) {
  assert.ok(Array.isArray(list), `${context}: diagnostics is an array`);
  for (const d of list) {
    assert.ok(CODES.includes(d.code), `${context}: only the five catalog codes are produced (got ${d.code})`);
    assert.equal(d.severity, 'E', `${context}: severity`);
    assert.equal(typeof d.message, 'string', `${context}: message`);
    assert.equal(typeof d.pointer, 'string', `${context}: pointer`);
    assert.ok(!('error' in d), `${context}: no key named error`);
    if (d.code === 'KF-E-311') assert.equal(d.remediation, REMEDIATION_311, `${context}: 311 remediation (l.1766, l.1600)`);
    else assert.ok(!('remediation' in d) || d.remediation === undefined, `${context}: remediation only on KF-E-311`);
  }
  for (let i = 1; i < list.length; i += 1) {
    assert.ok(cmpDiag(list[i - 1], list[i]) <= 0, `${context}: diagnostics sorted by the PLAN sort key (index ${i})`);
  }
}

function expectLogicError(fn, code) {
  let caught = null;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, `expected LogicError ${code}, nothing was thrown`);
  assert.ok(caught instanceof mod('errors').LogicError, `instance of LogicError (got ${caught?.name}: ${caught?.message})`);
  assert.equal(caught.name, 'LogicError');
  assert.equal(caught.code, code, `error code (message: ${caught.message})`);
  assert.equal(typeof caught.details, 'object');
  assert.ok(!String(caught.code).startsWith('KF-'), 'a KF- code is never thrown (P-02)');
  return caught;
}

/** checkDecisionTable on a deep-frozen copy, run twice (deterministic, fresh objects). */
function ck(t, { registry = reg('u1'), proofLimit } = {}) {
  const DT = mod('dt');
  const frozen = deepFreeze(clone(t));
  const options = { unitRegistry: registry };
  if (proofLimit !== undefined) options.proofLimit = proofLimit;
  const first = DT.checkDecisionTable(frozen, options);
  const second = DT.checkDecisionTable(frozen, options);
  assert.deepEqual(second, first, 'two calls give deep-equal diagnostics');
  assert.notEqual(second, first, 'results are fresh objects');
  assertDiagnosticList(first, 'check');
  return first;
}

/** evaluateDecisionTable on deep-frozen copies, run twice. */
function ev(t, values = {}, { registry = reg('u1') } = {}) {
  const DT = mod('dt');
  const frozen = deepFreeze(clone(t));
  const frozenValues = deepFreeze(clone(values));
  const options = { unitRegistry: registry };
  const first = DT.evaluateDecisionTable(frozen, frozenValues, options);
  const second = DT.evaluateDecisionTable(frozen, frozenValues, options);
  assert.deepEqual(second, first, 'two calls give deep-equal results');
  assert.equal(first.hit_policy, t.hit_policy);
  assertDiagnosticList(first.diagnostics, 'evaluate');
  return first;
}

/** Same typed error from the table check and from the evaluation. */
function bothThrow(t, code, { values = {}, registry = reg('u1') } = {}) {
  const DT = mod('dt');
  expectLogicError(() => DT.checkDecisionTable(clone(t), { unitRegistry: registry }), code);
  expectLogicError(() => DT.evaluateDecisionTable(clone(t), clone(values), { unitRegistry: registry }), code);
}

function expectDiags(list, specs, context = '') {
  assert.equal(list.length, specs.length, `${context} diagnostics count (got ${JSON.stringify(list.map((d) => [d.code, d.pointer]))})`);
  specs.forEach((spec, i) => {
    for (const [key, value] of Object.entries(spec)) {
      assert.deepEqual(list[i][key], value, `${context} diagnostic ${i} field ${key}`);
    }
  });
}

/** Evaluation outcome for first / unique: id of the matched row, or null for no match. */
function expectRow(res, t, id) {
  assert.equal(res.status, 'ok');
  assert.deepEqual(res.diagnostics, []);
  if (id === null) {
    assert.equal(res.result, null);
    assert.equal(res.via_default, false);
    return;
  }
  const index = t.rules.findIndex((r) => r.id === id);
  assert.ok(index >= 0, `table has row ${id}`);
  assert.ok(res.result && !Array.isArray(res.result), 'single row result');
  assert.equal(res.result.rule, id);
  assert.equal(res.result.rule_index, index);
  assert.deepEqual(res.result.then, t.rules[index].then);
  assert.equal(res.via_default, t.rules[index].when === 'default', 'via_default iff the default row');
}

function expectCollect(res, t, ids) {
  assert.equal(res.status, 'ok');
  assert.deepEqual(res.diagnostics, []);
  assert.ok(Array.isArray(res.result), 'collect result is an array');
  assert.deepEqual(res.result.map((r) => r.rule), ids);
  res.result.forEach((row) => {
    const index = t.rules.findIndex((r) => r.id === row.rule);
    assert.equal(row.rule_index, index);
    assert.deepEqual(row.then, t.rules[index].then);
  });
  const viaDefault = ids.length === 1 && t.rules.find((r) => r.id === ids[0]).when === 'default';
  assert.equal(res.via_default, viaDefault);
}

function expectError(res, specs) {
  assert.equal(res.status, 'error');
  assert.equal(res.result, null);
  assert.equal(res.via_default, false);
  expectDiags(res.diagnostics, specs, 'evaluation');
}

const timed = (fn) => {
  const start = performance.now();
  const value = fn();
  return { value, ms: performance.now() - start };
};

// ============================================================================================ logic-errors
check('F-E1', 'LogicError and LOGIC_ERROR_CODES (P-01, PLAN API contract)', () => {
  const E = mod('errors');
  assert.equal(typeof E.LogicError, 'function');
  assert.ok(E.LogicError.prototype instanceof Error);
  const codes = [...E.LOGIC_ERROR_CODES];
  assert.deepEqual(codes, [...codes].sort((a, b) => cmpStr(a, b)), 'ascending byte order');
  for (const code of [
    'INVALID_DECIMAL', 'UNKNOWN_UNIT', 'UNBOUND_FIELD', 'AMBIGUOUS_FIELD', 'EMPTY_PREDICATE', 'TYPE_MISMATCH',
    'INVALID_RANGE', 'DUPLICATE_DEFAULT', 'DUPLICATE_RULE_ID', 'UNSUPPORTED_INPUT_TYPE', 'INVALID_INPUT_DECLARATION',
    'INVALID_UNITS', 'INVALID_TABLE', 'INVALID_ARGUMENT',
  ]) assert.ok(codes.includes(code), `${code} is a LogicError code`);
  assert.ok(codes.every((c) => !c.startsWith('KF-')), 'no catalog code among the typed errors (E-0014 precedent)');
  assert.ok(!codes.includes('DIVISION_BY_ZERO') && !codes.includes('INVALID_PRECISION'), 'division removed from P011 (E-0022 D-04)');
});

// ============================================================================================ decimal (F-N)
check('F-N1', 'value equality and order by numeric value (l.582; E-0017)', () => {
  const D = mod('dec');
  for (const [a, b, expected] of DECIMALS.compare) {
    const x = D.parseDecimal(expand(a));
    const y = D.parseDecimal(expand(b));
    assert.equal(D.compareDecimal(x, y), expected, `compare(${String(expand(a)).slice(0, 40)}, ${String(expand(b)).slice(0, 40)})`);
    assert.equal(D.compareDecimal(y, x), expected === 0 ? 0 : -expected, 'antisymmetric');
    assert.equal(D.equalsDecimal(x, y), expected === 0);
  }
});

check('F-N2', 'exact add/subtract/multiply beyond binary float (l.582)', () => {
  const D = mod('dec');
  const ops = { add: D.addDecimal, subtract: D.subtractDecimal, multiply: D.multiplyDecimal };
  for (const [op, a, b, expected] of DECIMALS.arithmetic) {
    assert.equal(D.formatDecimal(ops[op](D.parseDecimal(a), D.parseDecimal(b))), expected, `${op}(${a}, ${b})`);
  }
});

check('F-N3', 'canonical minimal form from formatDecimal (P-07)', () => {
  const D = mod('dec');
  for (const [text, expected] of DECIMALS.canonical) assert.equal(D.formatDecimal(D.parseDecimal(text)), expected, text);
});

check('F-N4', 'only ^-?[0-9]+(\\.[0-9]+)?$ strings parse; all else INVALID_DECIMAL (E-0017)', () => {
  const D = mod('dec');
  const nonStrings = [4.2, 42, true, null, undefined, {}, [], 10n];
  for (const bad of [...DECIMALS.rejected_strings, ...nonStrings]) {
    expectLogicError(() => D.parseDecimal(bad), 'INVALID_DECIMAL');
    assert.equal(D.isDecimalString(bad), false, `isDecimalString(${String(bad)})`);
  }
  for (const good of DECIMALS.accepted_strings) {
    assert.equal(D.isDecimalString(good), true, good);
    assert.doesNotThrow(() => D.parseDecimal(good));
  }
});

check('F-N5', 'Decimal shape, isDecimal and non-Decimal arguments (E-0017; PLAN API contract)', () => {
  const D = mod('dec');
  const one = D.parseDecimal('1.50');
  assert.equal(typeof one.unscaled, 'bigint');
  assert.ok(Number.isInteger(one.scale) && one.scale >= 0);
  assert.equal(D.isDecimal(one), true);
  assert.equal(D.isDecimal({ unscaled: 15n, scale: 1 }), false, 'only values produced by the module');
  assert.equal(D.isDecimal('1.5'), false);
  assert.equal(D.isDecimal(null), false);
  const lookalike = { unscaled: 1n, scale: 0 };
  for (const bad of [lookalike, '1', 1, null, undefined]) {
    expectLogicError(() => D.compareDecimal(bad, one), 'INVALID_ARGUMENT');
    expectLogicError(() => D.compareDecimal(one, bad), 'INVALID_ARGUMENT');
    expectLogicError(() => D.equalsDecimal(bad, one), 'INVALID_ARGUMENT');
    expectLogicError(() => D.addDecimal(bad, one), 'INVALID_ARGUMENT');
    expectLogicError(() => D.subtractDecimal(one, bad), 'INVALID_ARGUMENT');
    expectLogicError(() => D.multiplyDecimal(bad, one), 'INVALID_ARGUMENT');
    expectLogicError(() => D.formatDecimal(bad), 'INVALID_ARGUMENT');
  }
  // arguments are never mutated
  const a = D.parseDecimal('2');
  const b = D.parseDecimal('3');
  const sum = D.addDecimal(a, b);
  assert.equal(D.formatDecimal(a), '2');
  assert.equal(D.formatDecimal(b), '3');
  assert.notEqual(sum, a);
});

// ============================================================================================ units (F-U)
check('F-U1', 'buildUnitRegistry: ids compared exactly, no built-in unit (l.591, l.596-599; E-0018)', () => {
  const U = mod('units');
  const r1 = U.buildUnitRegistry(deepFreeze(clone(UNITS_DATA.u1)));
  assert.equal(U.isUnitRegistry(r1), true);
  for (const id of ['percent_mass', 'ppm_mass', 'percent_volume', 'kg']) assert.equal(r1.has(id), true, id);
  for (const id of ['percent', 'ppm', 'PERCENT_MASS', '', '% m/m', 'mass_fraction']) assert.equal(r1.has(id), false, `has(${JSON.stringify(id)})`);
  assert.deepEqual(r1.units, UNITS_DATA.u1.units, 'units equals the input list in order');
  const r0 = U.buildUnitRegistry(clone(UNITS_DATA.u0));
  for (const id of ['percent_mass', 'percent', 'kg', '']) assert.equal(r0.has(id), false, `U0 has(${id})`);
  assert.equal(U.buildUnitRegistry(clone(UNITS_DATA.u2)).has('percent'), true, 'bare percent only when declared');
});

check('F-U2', 'invalid registries are INVALID_UNITS (E-0018)', () => {
  const U = mod('units');
  const mutate = (fn) => { const d = clone(UNITS_DATA.u1); fn(d); return d; };
  const bad = {
    duplicate_id: mutate((d) => d.units.push({ id: 'kg', dimension: 'mass', symbol: 'kg' })),
    conversions_not_empty: mutate((d) => { d.conversions = [{ from: 'percent_mass', to: 'ppm_mass' }]; }),
    units_is_mapping: mutate((d) => { d.units = { percent_mass: { dimension: 'mass_fraction', symbol: '%' } }; }),
    units_missing: mutate((d) => { delete d.units; }),
    entry_without_id: mutate((d) => { delete d.units[0].id; }),
    dimension_number: mutate((d) => { d.units[0].dimension = 1; }),
    symbol_null: mutate((d) => { d.units[0].symbol = null; }),
    top_level_null: null,
    top_level_list: [],
  };
  for (const [name, data] of Object.entries(bad)) expectLogicError(() => U.buildUnitRegistry(data), 'INVALID_UNITS', name);
  assert.doesNotThrow(() => U.buildUnitRegistry(clone(UNITS_DATA.u0)), 'near-miss: U0 is valid');
  assert.equal(U.isUnitRegistry(clone(UNITS_DATA.u1)), false, 'raw parsed data is not a registry');
  assert.equal(U.isUnitRegistry({ has: () => true, units: [] }), false, 'hand-made object is not a registry');
});

check('F-U3a', 'the registry is an explicit, built argument (E-0018; P-05)', () => {
  const DT = mod('dt');
  const t = S1(['e'], { material: 'X' });
  const variants = {
    no_options: undefined,
    empty_options: {},
    null_registry: { unitRegistry: null },
    raw_data: { unitRegistry: clone(UNITS_DATA.u1) },
    hand_made: { unitRegistry: { has: () => true, units: [] } },
  };
  for (const [name, options] of Object.entries(variants)) {
    expectLogicError(() => DT.checkDecisionTable(clone(t), options), 'INVALID_ARGUMENT', name);
    expectLogicError(() => DT.evaluateDecisionTable(clone(t), {}, options), 'INVALID_ARGUMENT', name);
  }
});

check('F-U3b', 'unit not declared by the registry in an input is UNKNOWN_UNIT (E-0018)', () => {
  const furlong = { ref: 'DE-0001.a', type: 'quantity', unit: 'furlong' };
  const t = S1([furlong], { a: { is_null: true } });
  bothThrow(t, 'UNKNOWN_UNIT');
  const U = mod('units');
  const withFurlong = U.buildUnitRegistry({ units: [...clone(UNITS_DATA.u1.units), { id: 'furlong', dimension: 'length', symbol: 'fur' }], conversions: [] });
  assert.deepEqual(ck(t, { registry: withFurlong }), [], 'near-miss: declared unit is accepted');
});

// ============================================================================================ RE2 (F-R)
check('F-R1', 'accepted syntax matches as tabulated: unanchored, case-sensitive, code points (E-0021, E-0022 D-05)', () => {
  const R = mod('re2');
  for (const [pattern, text, expected] of REGEX.match) {
    const compiled = R.compileRe2(pattern);
    assert.equal(compiled.ok, true, `compile ${JSON.stringify(pattern)}`);
    assert.equal(R.searchRe2(compiled.program, expand(text)), expected, `search ${JSON.stringify(pattern)} in ${JSON.stringify(String(expand(text)).slice(0, 30))}`);
  }
});

check('F-R1b', 'bounds and the empty pattern compile (E-0021: n, m <= 1000 inclusive; D-05)', () => {
  const R = mod('re2');
  assert.equal(R.RE2_MAX_REPEAT, 1000);
  for (const pattern of REGEX.compile_ok) assert.equal(R.compileRe2(pattern).ok, true, JSON.stringify(pattern));
});

check('F-R1c', 'compileRe2 on a non-string is INVALID_ARGUMENT (PLAN API contract)', () => {
  const R = mod('re2');
  for (const bad of [null, undefined, 5, {}, []]) expectLogicError(() => R.compileRe2(bad), 'INVALID_ARGUMENT');
});

check('F-R2', 'rejected syntax does not compile (l.612; E-0021; E-0022 D-05)', () => {
  const R = mod('re2');
  for (const pattern of REGEX.rejected) {
    const result = timedCompile(R, pattern);
    assert.equal(result.ok, false, `compile ${JSON.stringify(pattern)} must be rejected`);
    assert.equal(typeof result.reason, 'string');
  }
  for (const pattern of REGEX.accepted) assert.equal(R.compileRe2(pattern).ok, true, `near-miss ${JSON.stringify(pattern)} must compile`);
});

function timedCompile(R, pattern) {
  const { value, ms } = timed(() => R.compileRe2(pattern));
  assert.ok(ms < 5000, `compile ${JSON.stringify(pattern)} took ${ms} ms`);
  return value;
}

check('F-R2b', 'as a matches pattern every rejected construct is exactly one KF-E-315; near-misses are clean (l.612)', () => {
  const t = (pattern) => S1(['s'], { note: { matches: pattern } });
  for (const pattern of REGEX.rejected) {
    const diags = ck(t(pattern));
    expectDiags(diags, [{
      code: 'KF-E-315', pointer: '/rules/0/when/note/matches', rule: 'r1', rule_index: 0, pattern,
    }], JSON.stringify(pattern));
    assert.equal(typeof diags[0].reason, 'string');
  }
  for (const pattern of REGEX.accepted) assert.deepEqual(ck(t(pattern)), [], `near-miss ${JSON.stringify(pattern)}`);
});

check('F-R2c', 'a table with an uncompilable pattern is not evaluated: status error with KF-E-315 (P-03)', () => {
  const t = S1(['s'], { note: { matches: '(a)\\1' } });
  const res = ev(t, vals({ note: 'aa' }));
  expectError(res, [{ code: 'KF-E-315', pointer: '/rules/0/when/note/matches', pattern: '(a)\\1', rule: 'r1' }]);
});

const PATHOLOGICAL = [
  { pattern: '(a+)+$', text: `${'a'.repeat(50000)}b`, expected: false },
  { pattern: '(a+)+$', text: 'a'.repeat(50000), expected: true },
  { pattern: '(a|aa)+$', text: `${'a'.repeat(50000)}b`, expected: false },
  { pattern: '(a*)*b', text: 'a'.repeat(50000), expected: false },
  { pattern: '(x+x+)+y', text: 'x'.repeat(50000), expected: false },
  { pattern: '^(([a-z])+.)+[A-Z]([a-z])+$', text: `${'a'.repeat(30000)}!`, expected: false },
];

check('F-R3a', 'pathological patterns finish within 5 s through searchRe2 (l.612: no catastrophic backtracking)', () => {
  const R = mod('re2');
  for (const { pattern, text, expected } of PATHOLOGICAL) {
    const { value, ms } = timed(() => {
      const compiled = R.compileRe2(pattern);
      assert.equal(compiled.ok, true, `compile ${pattern}`);
      return R.searchRe2(compiled.program, text);
    });
    assert.equal(value, expected, `${pattern} on ${text.length} chars`);
    assert.ok(ms < 5000, `${pattern} took ${Math.round(ms)} ms (limit 5000)`);
  }
}, 120000);

check('F-R3b', 'pathological patterns finish within 5 s through evaluateDecisionTable (l.612)', () => {
  for (const { pattern, text, expected } of PATHOLOGICAL) {
    const t = S1(['s'], { note: { matches: pattern } });
    const { value, ms } = timed(() => mod('dt').evaluateDecisionTable(clone(t), vals({ note: text }), { unitRegistry: reg('u1') }));
    expectRow(value, t, expected ? 'r1' : 'r2');
    assert.ok(ms < 5000, `${pattern} took ${Math.round(ms)} ms (limit 5000)`);
  }
}, 120000);

check('F-R3c', 'nested counted repeats beyond the 100000-instruction cap are rejected quickly (E-0022 D-05)', () => {
  const R = mod('re2');
  for (const pattern of ['(a{1000}){1000}', '((a{1000}){1000}){1000}']) {
    const { value, ms } = timed(() => R.compileRe2(pattern));
    assert.equal(value.ok, false, pattern);
    assert.ok(ms < 5000, `compile ${pattern} took ${Math.round(ms)} ms`);
  }
  const near = R.compileRe2('(a{100}){100}');
  assert.equal(near.ok, true, 'near-miss: 10000 repetitions is under the cap');
  const { value, ms } = timed(() => R.searchRe2(near.program, 'a'.repeat(100)));
  assert.equal(value, false);
  assert.ok(ms < 5000);
});

// ============================================================================================ operators (F-O)
for (const c of OPERATOR_CASES) {
  check(c.key, `${c.title} (l.621-627; V-14/V-15)`, () => {
    const t = S1(c.ins, c.W);
    assert.deepEqual(ck(t), [], 'the table itself checks clean');
    for (const [supplied, expected] of c.cases) expectRow(ev(t, vals(supplied)), t, expected);
  });
}

check('F-O18', 'between with min > max is INVALID_RANGE from check and evaluate (E-0019)', () => {
  bothThrow(S1(['d'], { count: { between: ['5', '1'] } }), 'INVALID_RANGE');
  assert.deepEqual(ck(S1(['d'], { count: { between: ['1', '5'] } })), [], 'near-miss');
});

// ============================================================================================ binding (F-B)
check('F-B1', 'when key by full ref (E-0019)', () => {
  const t = S1(['e'], { [REFS.material]: 'X' });
  expectRow(ev(t, vals({ material: 'X' })), t, 'r1');
});

check('F-B2', 'when key by suffix after the last "." (E-0019)', () => {
  const t = S1(['e'], { material: 'X' });
  expectRow(ev(t, vals({ material: 'X' })), t, 'r1');
});

check('F-B3', 'UNBOUND_FIELD for a key that matches no input, at any nesting (E-0019)', () => {
  bothThrow(S1(['e'], { foo: 'X' }), 'UNBOUND_FIELD');
  bothThrow(S1(['e'], { not: { foo: 'X' } }), 'UNBOUND_FIELD');
  bothThrow(S1(['e'], { any: [{ material: 'X' }, { foo: 'X' }] }), 'UNBOUND_FIELD');
});

check('F-B4', 'AMBIGUOUS_FIELD for a shared suffix; a full ref disambiguates (E-0019)', () => {
  const ins = [{ ref: 'A.x', type: 'decimal' }, { ref: 'B.x', type: 'decimal' }];
  bothThrow(S1(ins, { x: '1' }), 'AMBIGUOUS_FIELD');
  const t = S1(ins, { 'A.x': '1' });
  assert.deepEqual(ck(t), []);
  expectRow(ev(t, { 'A.x': '1', 'B.x': '2' }), t, 'r1');
  expectRow(ev(t, { 'A.x': '2', 'B.x': '1' }), t, 'r2');
});

check('F-B5', 'a mapping with two keys is a conjunction (E-0019)', () => {
  const t = S1(['e', 'd'], { material: 'X', count: { gt: '0' } });
  expectRow(ev(t, vals({ material: 'X', count: '1' })), t, 'r1');
  expectRow(ev(t, vals({ material: 'X', count: '0' })), t, 'r2');
});

check('F-B3b1', 'supplied values bind by suffix like when keys (E-0022 D-02)', () => {
  const t = S1(['e'], { material: 'X' });
  expectRow(ev(t, { material: 'X' }), t, 'r1');
  expectRow(ev(t, { material: 'Y' }), t, 'r2');
});

check('F-B3b2', 'a supplied key that binds to no input is UNBOUND_FIELD (E-0022 D-02)', () => {
  const t = S1(['e'], { material: 'X' });
  expectLogicError(() => mod('dt').evaluateDecisionTable(clone(t), { foo: 'X' }, { unitRegistry: reg('u1') }), 'UNBOUND_FIELD');
  expectLogicError(() => mod('dt').evaluateDecisionTable(clone(t), { 'DE-0001.material': 'X', 'DE-0001.other': 'Y' }, { unitRegistry: reg('u1') }), 'UNBOUND_FIELD');
});

check('F-B3b3', 'two supplied keys for one input, or one key for two inputs, are AMBIGUOUS_FIELD (E-0022 D-02)', () => {
  const t = S1(['e'], { material: 'X' });
  expectLogicError(() => mod('dt').evaluateDecisionTable(clone(t), { 'DE-0001.material': 'X', material: 'X' }, { unitRegistry: reg('u1') }), 'AMBIGUOUS_FIELD');
  const ins = [{ ref: 'A.x', type: 'decimal' }, { ref: 'B.x', type: 'decimal' }];
  const two = S1(ins, { 'A.x': '1' });
  expectLogicError(() => mod('dt').evaluateDecisionTable(clone(two), { x: '1' }, { unitRegistry: reg('u1') }), 'AMBIGUOUS_FIELD');
});

check('F-B3b4', 'hostile supplied keys are plain unbound keys (E-0022 D-02; no prototype pollution)', () => {
  const t = S1(['e'], { material: 'X' });
  for (const key of ['__proto__', 'constructor', 'toString']) {
    const hostile = JSON.parse(`{"${key}": "X"}`);
    expectLogicError(() => mod('dt').evaluateDecisionTable(clone(t), hostile, { unitRegistry: reg('u1') }), 'UNBOUND_FIELD');
  }
  assert.equal({}.polluted, undefined);
  assert.equal(Object.getPrototypeOf({}), Object.prototype);
});

// ============================================================================================ null / absent (F-L)
const L_INS = ['e', 'd', 's'];
check('F-L1', 'every matcher is false on an absent input (l.607; E-0019)', () => {
  for (const W of NULL_WHENS) {
    const t = S1(L_INS, W);
    expectRow(ev(t, {}), t, 'r2');
  }
});

check('F-L2', 'explicit null is the same EvaluationResult as absent (l.606; E-0019)', () => {
  for (const W of NULL_WHENS) {
    const t = S1(L_INS, W);
    const absent = ev(t, {});
    const explicit = ev(t, vals({ material: null, count: null, note: null }));
    assert.deepEqual(explicit, absent, JSON.stringify(W));
    expectRow(explicit, t, 'r2');
  }
});

check('F-L3', 'eq: null is false (E-0019)', () => {
  const t = S1(['d'], { count: { eq: null } });
  expectRow(ev(t, {}), t, 'r2');
  expectRow(ev(t, vals({ count: null })), t, 'r2');
  expectRow(ev(t, vals({ count: '1' })), t, 'r2');
});

check('F-L4', 'is_null: true is the only test for absence (l.607)', () => {
  const t = S1(['d'], { count: { is_null: true } });
  expectRow(ev(t, {}), t, 'r1');
});

check('F-L5', 'not negates the boolean result, so not over a null comparison is true (E-0019)', () => {
  const cases = [
    [{ not: { count: { eq: '1' } } }, 'r1'],
    [{ not: { count: { ne: '1' } } }, 'r1'],
    [{ not: { count: { in: ['1'] } } }, 'r1'],
    [{ not: { count: { lt: '1' } } }, 'r1'],
    [{ not: { count: { is_null: true } } }, 'r2'],
    [{ count: { ne: '1' } }, 'r2'],
  ];
  for (const [W, expected] of cases) {
    const t = S1(['d'], W);
    expectRow(ev(t, {}), t, expected);
  }
});

check('F-L6', 'any / all over absent inputs (E-0019)', () => {
  const t1 = S1(['d', 's'], { any: [{ count: { eq: '1' } }, { note: { is_null: true } }] });
  expectRow(ev(t1, {}), t1, 'r1');
  const t2 = S1(['d', 's'], { all: [{ count: { is_null: true } }, { note: { eq: 'x' } }] });
  expectRow(ev(t2, {}), t2, 'r2');
});

check('F-L7', 'null is neither zero nor false (l.606)', () => {
  const tb = S1(['b'], { flag: false });
  expectRow(ev(tb, {}), tb, 'r2');
  const tz = S1(['d'], { count: '0' });
  expectRow(ev(tz, {}), tz, 'r2');
  const tl = S1(['d'], { count: { lte: '0' } });
  expectRow(ev(tl, {}), tl, 'r2');
  expectRow(ev(tl, vals({ count: '0' })), tl, 'r1');
});

// ============================================================================================ enum domains (F-D)
check('F-D1', 'supplied out-of-domain enum value is KF-E-314 even if no row reads it (l.608; E-0019)', () => {
  const t = S1(['e', 'd'], { count: { gt: '0' } });
  const bad = ev(t, vals({ material: 'W' }));
  expectError(bad, [{ code: 'KF-E-314', input: 'DE-0001.material', value: 'W', source: 'value', pointer: '/inputs/0', rule: null }]);
  expectError(ev(t, vals({ material: 'x' })), [{ code: 'KF-E-314', value: 'x' }]);
  expectRow(ev(t, vals({ material: null })), t, 'r2');
  expectRow(ev(t, {}), t, 'r2');
  expectRow(ev(t, vals({ material: 'X' })), t, 'r2');
  const two = S1(['A', 'B'], { a: 'X' });
  expectError(ev(two, vals({ a: 'Z', b: 'S' })), [
    { code: 'KF-E-314', input: REFS.a, value: 'Z', pointer: '/inputs/0' },
    { code: 'KF-E-314', input: REFS.b, value: 'S', pointer: '/inputs/1' },
  ]);
});

check('F-D2', 'literal out of the enum domain is a static KF-E-314 with exact pointers (E-0019)', () => {
  const cases = [
    [{ material: 'W' }, '/rules/0/when/material'],
    [{ material: { eq: 'W' } }, '/rules/0/when/material/eq'],
    [{ material: { ne: 'W' } }, '/rules/0/when/material/ne'],
    [{ material: { in: ['X', 'W'] } }, '/rules/0/when/material/in/1'],
    [{ material: { not_in: ['W'] } }, '/rules/0/when/material/not_in/0'],
    [{ not: { material: 'W' } }, '/rules/0/when/not/material'],
  ];
  for (const [W, pointer] of cases) {
    const diags = ck(S1(['e'], W));
    expectDiags(diags, [{
      code: 'KF-E-314', pointer, input: 'DE-0001.material', value: 'W', source: 'literal', rule: 'r1', rule_index: 0,
    }], JSON.stringify(W));
  }
  for (const W of [{ material: 'X' }, { material: { eq: 'Z' } }, { material: { in: ['X', 'Y'] } }, { material: { not_in: ['Z'] } }, { material: { eq: null } }]) {
    assert.deepEqual(ck(S1(['e'], W)), [], `near-miss ${JSON.stringify(W)}`);
  }
});

check('F-D3', 'a table with a static KF-E-314 is not evaluated, even with an in-domain value (P-03)', () => {
  const t = S1(['e'], { material: 'W' });
  expectError(ev(t, vals({ material: 'X' })), [{ code: 'KF-E-314', pointer: '/rules/0/when/material', source: 'literal', rule: 'r1', value: 'W' }]);
});

// ============================================================================================ units in tables (F-Q)
const QIN = ['q'];
const q310 = (pointer, found, extra = {}) => ({
  code: 'KF-E-310', pointer, input: REFS.concentration, expected_unit: 'percent_mass', found_unit: found, source: 'literal', rule: 'r1', rule_index: 0, ...extra,
});

check('F-Q1', 'static KF-E-310: literal in another unit; near-miss in the declared unit (l.589)', () => {
  expectDiags(ck(S1(QIN, { concentration: { lte: Q('4.2', 'ppm') } })), [q310('/rules/0/when/concentration/lte', 'ppm_mass')]);
  assert.deepEqual(ck(S1(QIN, { concentration: { lte: Q('4.2', 'pm') } })), []);
});

check('F-Q2', 'both units declared, same family: still KF-E-310 (l.591)', () => {
  expectDiags(ck(S1(QIN, { concentration: { lte: Q('4.2', 'pv') } })), [q310('/rules/0/when/concentration/lte', 'percent_volume')]);
});

check('F-Q3', 'bare decimal on a quantity input is KF-E-310 (E-0019)', () => {
  expectDiags(ck(S1(QIN, { concentration: { lte: '4.2' } })), [q310('/rules/0/when/concentration/lte', null)]);
});

check('F-Q4', 'quantity on a decimal input is KF-E-310 (E-0019)', () => {
  expectDiags(ck(S1(['d'], { count: { lte: Q('4', 'pm') } })), [{
    code: 'KF-E-310', pointer: '/rules/0/when/count/lte', input: REFS.count, expected_unit: null, found_unit: 'percent_mass', source: 'literal', rule: 'r1', rule_index: 0,
  }]);
});

check('F-Q5', 'KF-E-310 inside lists, ranges and the literal form, with element pointers (E-0019)', () => {
  expectDiags(ck(S1(QIN, { concentration: { in: [Q('1', 'pm'), Q('2', 'ppm')] } })), [q310('/rules/0/when/concentration/in/1', 'ppm_mass')]);
  expectDiags(ck(S1(QIN, { concentration: { between: [Q('1', 'pm'), Q('5', 'pv')] } })), [q310('/rules/0/when/concentration/between/1', 'percent_volume')]);
  expectDiags(ck(S1(QIN, { concentration: Q('4.2', 'ppm') })), [q310('/rules/0/when/concentration', 'ppm_mass')]);
});

check('F-Q6', 'unknown unit throws; a declared different unit is KF-E-310; ids, never dimensions (E-0018)', () => {
  const t = S1(QIN, { concentration: { lte: Q('4', 'percent') } });
  bothThrow(t, 'UNKNOWN_UNIT');
  expectDiags(ck(t, { registry: reg('u2') }), [q310('/rules/0/when/concentration/lte', 'percent')]);
});

check('F-Q7', 'runtime unit mismatch is KF-E-310, never false and no row evaluated (l.589; E-0019)', () => {
  const t = S1(QIN, { concentration: { lte: Q('4.2', 'pm') } });
  expectError(ev(t, vals({ concentration: Q('4.2', 'ppm') })), [{
    code: 'KF-E-310', source: 'value', input: REFS.concentration, expected_unit: 'percent_mass', found_unit: 'ppm_mass', pointer: '/inputs/0', rule: null, rule_index: null,
  }]);
});

check('F-Q8', 'supplied bare scalar for a quantity input and quantity for a decimal input are KF-E-310 (E-0019)', () => {
  const tq = S1(QIN, { concentration: { lte: Q('4.2', 'pm') } });
  expectError(ev(tq, vals({ concentration: '4.2' })), [{ code: 'KF-E-310', found_unit: null, expected_unit: 'percent_mass', source: 'value', pointer: '/inputs/0' }]);
  const td = S1(['d'], { count: { gt: '0' } });
  expectError(ev(td, vals({ count: Q('4.2', 'pm') })), [{ code: 'KF-E-310', expected_unit: null, found_unit: 'percent_mass', source: 'value', pointer: '/inputs/0' }]);
});

check('F-Q9', 'supplied quantity in the right unit evaluates (E-0019)', () => {
  const t = S1(QIN, { concentration: { lte: Q('4.2', 'pm') } });
  expectRow(ev(t, vals({ concentration: Q('4.2', 'pm') })), t, 'r1');
});

check('F-Q10', 'a convertible pair is still an error: 42000 ppm vs percent (l.591; E-0018)', () => {
  const t = S1(QIN, { concentration: { lte: Q('4.2', 'pm') } });
  for (const value of [Q('42000', 'ppm'), Q('4.2', 'ppm')]) {
    expectError(ev(t, vals({ concentration: value })), [{ code: 'KF-E-310', source: 'value', found_unit: 'ppm_mass' }]);
  }
});

check('F-Q11a', 'then quantities with declared units are accepted and returned verbatim; undeclared is UNKNOWN_UNIT (E-0021)', () => {
  const ok = table({ ins: inputs('e'), rows: [['r1', { material: 'X' }, { limit: Q('4.2', 'pm'), outcome: 'OUT-0001' }], ['r2', 'default']] });
  assert.deepEqual(ck(ok), []);
  expectRow(ev(ok, vals({ material: 'X' })), ok, 'r1');
  const bad = table({ ins: inputs('e'), rows: [['r1', { material: 'X' }, { limit: Q('4.2', 'furlong') }], ['r2', 'default']] });
  bothThrow(bad, 'UNKNOWN_UNIT');
});

check('F-Q11b', 'a {value, unit} mapping at any depth of then is a quantity: UNKNOWN_UNIT (E-0022 D-07)', () => {
  for (const then of [{ a: { b: Q('1', 'furlong') } }, { a: [Q('1', 'furlong')] }, { a: { b: [{ c: Q('1', 'furlong') }] } }]) {
    bothThrow(table({ ins: inputs('e'), rows: [['r1', { material: 'X' }, then], ['r2', 'default']] }), 'UNKNOWN_UNIT');
  }
});

check('F-Q11c', 'a nested then quantity needs a valid decimal string value (E-0022 D-07; E-0017)', () => {
  for (const value of ['4,2', 5, null]) {
    bothThrow(table({ ins: inputs('e'), rows: [['r1', { material: 'X' }, { a: { b: { value, unit: 'kg' } } }], ['r2', 'default']] }), 'INVALID_DECIMAL');
  }
});

check('F-Q11d', 'near-miss: a mapping whose key set is not exactly {value, unit} is opaque (E-0022 D-07)', () => {
  const then = { a: { value: '1', unit: 'furlong', extra: true }, b: { value: 'free text' }, c: { unit: 'furlong' }, d: 'furlong' };
  const t = table({ ins: inputs('e'), rows: [['r1', { material: 'X' }, then], ['r2', 'default']] });
  assert.deepEqual(ck(t), []);
  expectRow(ev(t, vals({ material: 'X' })), t, 'r1');
});

// ============================================================================================ typed errors (F-Y)
check('F-Y1', 'UNBOUND_FIELD (E-0019)', () => bothThrow(S1(['e'], { foo: 'X' }), 'UNBOUND_FIELD'));

check('F-Y2', 'AMBIGUOUS_FIELD (E-0019)', () => {
  bothThrow(S1([{ ref: 'A.x', type: 'decimal' }, { ref: 'B.x', type: 'decimal' }], { x: '1' }), 'AMBIGUOUS_FIELD');
});

check('F-Y3', '{} nested inside all / any / not is EMPTY_PREDICATE (E-0019 as amended by E-0022)', () => {
  bothThrow(S1(['e'], { all: [{}] }), 'EMPTY_PREDICATE');
  bothThrow(S1(['e'], { not: {} }), 'EMPTY_PREDICATE');
  bothThrow(S1(['e'], { any: [{ material: 'X' }, {}] }), 'EMPTY_PREDICATE');
});

check('F-Y3a', 'a top-level when: {} is an unconditional non-default row, not an error (E-0022 D-08)', () => {
  const t = S1(['q'], {});
  assert.deepEqual(ck(t), []);
  for (const values of [{}, vals({ concentration: null }), vals({ concentration: Q('100', 'pm') })]) expectRow(ev(t, values), t, 'r1');
  const collect = S1(['e'], {}, { policy: 'collect' });
  expectCollect(ev(collect, vals({ material: 'X' })), collect, ['r1']);
});

check('F-Y3b', 'all: [] and any: [] are EMPTY_PREDICATE (E-0022 D-03)', () => {
  bothThrow(S1(['e'], { all: [] }), 'EMPTY_PREDICATE');
  bothThrow(S1(['e'], { any: [] }), 'EMPTY_PREDICATE');
  bothThrow(S1(['e'], { not: { any: [] } }), 'EMPTY_PREDICATE');
});

check('F-Y4a', 'TYPE_MISMATCH: lt/lte/gt/gte/between on a non-decimal, non-quantity input (E-0019)', () => {
  bothThrow(S1(['e'], { material: { lt: 'X' } }), 'TYPE_MISMATCH');
  bothThrow(S1(['s'], { note: { gte: 'a' } }), 'TYPE_MISMATCH');
  bothThrow(S1(['b'], { flag: { gt: true } }), 'TYPE_MISMATCH');
  bothThrow(S1(['b'], { flag: { between: [false, true] } }), 'TYPE_MISMATCH');
  assert.deepEqual(ck(S1(['e'], { material: { ne: 'X' } })), [], 'near-miss: eq family on enum is fine');
});

check('F-Y4b', 'TYPE_MISMATCH at evaluation: wrong JS type for a string or boolean input (E-0021, PLAN P-04)', () => {
  const ts = S1(['s'], { note: { matches: 'a' } });
  assert.deepEqual(ck(ts), []);
  expectLogicError(() => mod('dt').evaluateDecisionTable(clone(ts), vals({ note: 5 }), { unitRegistry: reg('u1') }), 'TYPE_MISMATCH');
  const tb = S1(['b'], { flag: true });
  expectLogicError(() => mod('dt').evaluateDecisionTable(clone(tb), vals({ flag: 'yes' }), { unitRegistry: reg('u1') }), 'TYPE_MISMATCH');
  expectRow(ev(ts, vals({ note: 'a' })), ts, 'r1');
  expectRow(ev(tb, vals({ flag: true })), tb, 'r1');
});

check('F-Y5a', 'INVALID_DECIMAL in table literals (E-0017)', () => {
  bothThrow(S1(['d'], { count: { gt: 5 } }), 'INVALID_DECIMAL');
  bothThrow(S1(['d'], { count: '4,2' }), 'INVALID_DECIMAL');
  bothThrow(S1(['d'], { count: { in: ['1', 2] } }), 'INVALID_DECIMAL');
  bothThrow(S1(QIN, { concentration: { lte: { value: 4.2, unit: 'percent_mass' } } }), 'INVALID_DECIMAL');
  bothThrow(S1(QIN, { concentration: { lte: { value: '4,2', unit: 'percent_mass' } } }), 'INVALID_DECIMAL');
});

check('F-Y5b', 'INVALID_DECIMAL in supplied values (E-0017)', () => {
  const DT = mod('dt');
  const td = S1(['d'], { count: { gt: '0' } });
  expectLogicError(() => DT.evaluateDecisionTable(clone(td), vals({ count: 4.2 }), { unitRegistry: reg('u1') }), 'INVALID_DECIMAL');
  expectLogicError(() => DT.evaluateDecisionTable(clone(td), vals({ count: '1e3' }), { unitRegistry: reg('u1') }), 'INVALID_DECIMAL');
  const tq = S1(QIN, { concentration: { lte: Q('4.2', 'pm') } });
  expectLogicError(() => DT.evaluateDecisionTable(clone(tq), vals({ concentration: { value: 4.2, unit: 'percent_mass' } }), { unitRegistry: reg('u1') }), 'INVALID_DECIMAL');
});

check('F-Y6', 'INVALID_RANGE (E-0019)', () => bothThrow(S1(['d'], { count: { between: ['5', '1'] } }), 'INVALID_RANGE'));

check('F-Y7', 'DUPLICATE_DEFAULT: two rows with when: default (E-0020)', () => {
  bothThrow(table({ ins: inputs('e'), rows: [['r1', { material: 'X' }], ['r2', 'default'], ['r3', 'default']] }), 'DUPLICATE_DEFAULT');
});

check('F-Y8', 'DUPLICATE_RULE_ID: two rows with the same id (E-0021)', () => {
  bothThrow(table({ ins: inputs('e'), rows: [['r1', { material: 'X' }], ['r1', { material: 'Y' }]] }), 'DUPLICATE_RULE_ID');
});

check('F-Y9', 'UNSUPPORTED_INPUT_TYPE (E-0021)', () => {
  for (const type of ['date', 'integer', 'percent', 'Quantity']) {
    bothThrow(table({ ins: [{ ref: 'DE-0001.x', type }], rows: [['r1', 'default']] }), 'UNSUPPORTED_INPUT_TYPE');
  }
});

check('F-Y10', 'INVALID_INPUT_DECLARATION (E-0021)', () => {
  for (const decl of [
    { ref: 'DE-0001.x', type: 'quantity' },
    { ref: 'DE-0001.x', type: 'decimal', unit: 'percent_mass' },
    { ref: 'DE-0001.x', type: 'enum', domain: ['X'], unit: 'kg' },
  ]) bothThrow(table({ ins: [decl], rows: [['r1', 'default']] }), 'INVALID_INPUT_DECLARATION');
});

check('F-Y11', 'INVALID_TABLE: wrong kind, rules or inputs not lists (E-0022 D-01)', () => {
  bothThrow({ ...S1(['e'], { material: 'X' }), kind: 'formula' }, 'INVALID_TABLE');
  bothThrow({ ...S1(['e'], { material: 'X' }), rules: {} }, 'INVALID_TABLE');
  bothThrow({ ...S1(['e'], { material: 'X' }), inputs: {} }, 'INVALID_TABLE');
});

check('F-Y11b', 'INVALID_TABLE: malformed matchers (E-0022 D-01)', () => {
  bothThrow(S1(['d'], { count: { approx: '1' } }), 'INVALID_TABLE');
  bothThrow(S1(['d'], { count: { in: '1' } }), 'INVALID_TABLE');
  bothThrow(S1(['d'], { count: { between: ['1', '2', '3'] } }), 'INVALID_TABLE');
  bothThrow(S1(['d'], { count: { is_null: 'yes' } }), 'INVALID_TABLE');
});

check('F-Y12', 'INVALID_ARGUMENT: values and proofLimit (PLAN API contract)', () => {
  const DT = mod('dt');
  const t = S1(['e'], { material: 'X' });
  for (const values of [null, [], 'x', 5]) {
    expectLogicError(() => DT.evaluateDecisionTable(clone(t), values, { unitRegistry: reg('u1') }), 'INVALID_ARGUMENT');
  }
  for (const proofLimit of [-1, 1.5, '256', Number.NaN]) {
    expectLogicError(() => DT.checkDecisionTable(clone(t), { unitRegistry: reg('u1'), proofLimit }), 'INVALID_ARGUMENT');
  }
  assert.deepEqual(ck(t, { proofLimit: 0 }), [], 'near-miss: 0 is a valid limit');
});

// ============================================================================================ hit policies (F-H)
const TH_CASES = [
  [{ material: 'Y' }, 'r1'], [{ material: 'Z' }, 'r2'], [{ material: 'Z', count: '1' }, 'r2'],
  [{ count: '1' }, 'r3'], [{}, 'rd'],
];

check('F-H1', 'first: document order, default only when nothing else matches, position-independent (E-0020)', () => {
  for (const rd of ['last', 'first', 'middle']) {
    const t = TH({ rd });
    assert.deepEqual(ck(t), []);
    for (const [supplied, expected] of TH_CASES) expectRow(ev(t, vals(supplied)), t, expected);
  }
  const none = TH({ rd: 'none' });
  expectRow(ev(none, {}), none, null);
  expectRow(ev(none, vals({ material: 'Y' })), none, 'r1');
});

check('F-H2', 'collect: all non-default matches in order, [default], [] (E-0020)', () => {
  for (const rd of ['last', 'middle', 'first']) {
    const t = TH({ policy: 'collect', rd });
    expectCollect(ev(t, vals({ material: 'Y', count: '1' })), t, ['r1', 'r2', 'r3']);
    expectCollect(ev(t, vals({ material: 'Z' })), t, ['r2']);
    expectCollect(ev(t, vals({ material: 'X' })), t, ['r1']);
    expectCollect(ev(t, {}), t, ['rd']);
  }
  const none = TH({ policy: 'collect', rd: 'none' });
  expectCollect(ev(none, {}), none, []);
  assert.equal(ev(none, {}).via_default, false);
});

check('F-H3', 'unique with disjoint rows: single match, default fallback, no match (E-0020)', () => {
  const rows = [['r1', { material: 'X' }], ['r2', { material: 'Y' }], ['rd', 'default']];
  const t = table({ policy: 'unique', ins: inputs('e'), rows });
  assert.deepEqual(ck(t), []);
  expectRow(ev(t, vals({ material: 'Y' })), t, 'r2');
  expectRow(ev(t, vals({ material: 'Z' })), t, 'rd');
  assert.equal(ev(t, vals({ material: 'Z' })).via_default, true);
  const none = table({ policy: 'unique', ins: inputs('e'), rows: rows.slice(0, 2) });
  expectRow(ev(none, vals({ material: 'Z' })), none, null);
});

check('F-H4', 'unique at evaluation: two or more matching non-default rows is KF-E-312 proof evaluation (l.633; E-0020)', () => {
  const t = TH({ policy: 'unique' });
  expectError(ev(t, vals({ material: 'Y' })), [{ code: 'KF-E-312', proof: 'evaluation', rules: ['r1', 'r2'], pointer: '/rules/0' }]);
  expectRow(ev(t, vals({ material: 'X' })), t, 'r1');
  expectError(ev(t, vals({ material: 'Y', count: '1' })), [{ code: 'KF-E-312', proof: 'evaluation', rules: ['r1', 'r2', 'r3'], pointer: '/rules/0' }]);
});

check('F-H5', 'a default row never overlaps (E-0020)', () => {
  assert.deepEqual(ck(table({ policy: 'unique', ins: inputs('e'), rows: [['r1', { material: 'X' }], ['rd', 'default']] })), []);
  assert.deepEqual(ck(table({ policy: 'unique', ins: inputs('e'), rows: [['rd', 'default']] })), []);
});

check('F-H6', 'DUPLICATE_DEFAULT / DUPLICATE_RULE_ID under every hit policy (E-0020, E-0021)', () => {
  for (const policy of ['first', 'unique', 'collect']) {
    bothThrow(table({ policy, ins: inputs('e'), rows: [['r1', 'default'], ['r2', 'default']] }), 'DUPLICATE_DEFAULT');
    bothThrow(table({ policy, ins: inputs('e'), rows: [['r1', { material: 'X' }], ['r1', 'default']] }), 'DUPLICATE_RULE_ID');
  }
});

check('F-H7', 'then is returned verbatim as an isolated deep copy (E-0021; V-27)', () => {
  const DT = mod('dt');
  const then = { valid: true, outcome: 'OUT-0001', limit: Q('4.2', 'pm'), note: 'x', n: 5, nested: { a: [1, '2'] } };
  const t = table({ ins: inputs('e'), rows: [['r1', { material: 'X' }, then], ['r2', 'default']] });
  const frozen = deepFreeze(clone(t));
  const before = JSON.stringify(frozen);
  const options = { unitRegistry: reg('u1') };
  const first = DT.evaluateDecisionTable(frozen, { [REFS.material]: 'X' }, options);
  assert.deepEqual(first.result.then, then);
  assert.strictEqual(first.result.then.n, 5, 'the number is not turned into a string');
  assert.notStrictEqual(first.result.then, frozen.rules[0].then);
  assert.notStrictEqual(first.result.then.nested, frozen.rules[0].then.nested);
  assert.notStrictEqual(first.result.then.nested.a, frozen.rules[0].then.nested.a);
  first.result.then.nested.a.push('mutated');
  first.result.then.valid = false;
  const second = DT.evaluateDecisionTable(frozen, { [REFS.material]: 'X' }, options);
  assert.deepEqual(second.result.then, then, 'mutating a result does not alter another evaluation');
  assert.equal(JSON.stringify(frozen), before, 'the table is unchanged');
});

// ============================================================================================ exhaustiveness (F-X)
const exhaustive = (ins, rows, policy = 'first') => table({ policy, exhaustive: true, ins, rows });
const X311 = (extra) => ({ code: 'KF-E-311', pointer: '/exhaustive', rule: null, limit: 256, remediation: REMEDIATION_311, ...extra });

function enumTable(n) {
  const domain = Array.from({ length: n }, (_, i) => `v${String(i).padStart(3, '0')}`);
  const ins = [{ ref: 'DE-0001.v', type: 'enum', domain }];
  return exhaustive(ins, [['r1', { v: { in: domain.slice(0, n - 1) } }], ['r2', { v: domain[n - 1] }]]);
}

check('F-X1', 'a default row satisfies exhaustive: true (l.634)', () => {
  assert.deepEqual(ck(S1(QIN, { concentration: { lte: Q('4.2', 'pm') } }, { exhaustive: true })), []);
  assert.deepEqual(ck(exhaustive(inputs('e'), [['r1', { material: 'X' }], ['rd', 'default']])), [], 'default wins even with uncovered tuples');
  assert.deepEqual(ck({ ...enumTable(300), rules: [...enumTable(300).rules, { id: 'rd', when: 'default', then: {} }] }), [], 'default also avoids the limit');
});

check('F-X2', 'the BR-0037 shape (quantity input, no default) is KF-E-311 non_enum_input (l.445-455, l.634; E-0008(d))', () => {
  const t = exhaustive(inputs('q', 'e'), [['r1', { material: { not_in: ['X'] } }], ['r2', { material: 'X' }]]);
  expectDiags(ck(t), [X311({ reason: 'non_enum_input', input: REFS.concentration })]);
});

check('F-X3', 'enum-only inputs within the limit are proven covered by enumeration (l.634)', () => {
  assert.deepEqual(ck(exhaustive(inputs('e'), [['r1', { material: { not_in: ['X'] } }], ['r2', { material: 'X' }]])), []);
});

check('F-X4', 'an uncovered tuple is KF-E-311 with the witness (l.634; E-0020)', () => {
  expectDiags(ck(exhaustive(inputs('e'), [['r1', { material: { in: ['X', 'Y'] } }]])), [
    X311({ reason: 'uncovered_tuple', witness: { [REFS.material]: 'Z' } }),
  ]);
});

check('F-X5a', 'the only uncovered tuple of a two-enum product is reported as witness (l.634)', () => {
  const ins = [input('A'), input('B', ['P', 'Q', 'R'])];
  const diags = ck(exhaustive(ins, [['r1', { a: 'X' }], ['r2', { a: 'Y', b: { in: ['P', 'Q'] } }]]));
  expectDiags(diags, [X311({ reason: 'uncovered_tuple', witness: { [REFS.a]: 'Y', [REFS.b]: 'R' } })]);
  assert.deepEqual(Object.keys(diags[0].witness), [REFS.a, REFS.b], 'witness keys follow inputs[] order');
});

check('F-X5b', 'first uncovered tuple: first input outermost, last input varies fastest (E-0022 D-06)', () => {
  const ins = [input('A'), input('B', ['P', 'Q', 'R'])];
  expectDiags(ck(exhaustive(ins, [['r1', { a: 'X', b: 'P' }]])), [
    X311({ reason: 'uncovered_tuple', witness: { [REFS.a]: 'X', [REFS.b]: 'Q' } }),
  ]);
});

check('F-X6a', 'limit boundary is inclusive: product 256 is enumerated (l.634)', () => {
  assert.deepEqual(ck(enumTable(256)), []);
  const names = (p) => Array.from({ length: 16 }, (_, i) => `${p}${String(i).padStart(2, '0')}`);
  const A = { ref: REFS.a, type: 'enum', domain: names('a') };
  const B = { ref: REFS.b, type: 'enum', domain: names('b') };
  const full = names('a').map((a, i) => [`r${i}`, { a, b: { in: names('b') } }]);
  assert.deepEqual(ck(exhaustive([A, B], full)), [], '16 x 16 fully covered');
  const holey = full.map(([id, when], i) => (i === 15 ? [id, { a: when.a, b: { in: names('b').slice(0, 15) } }] : [id, when]));
  expectDiags(ck(exhaustive([A, B], holey)), [X311({ reason: 'uncovered_tuple', witness: { [REFS.a]: 'a15', [REFS.b]: 'b15' } })]);
});

check('F-X6b', 'product over the limit is KF-E-311 over_limit; proofLimit is an explicit parameter (l.634; E-0020)', () => {
  expectDiags(ck(enumTable(257)), [X311({ reason: 'over_limit', product: 257 })]);
  assert.deepEqual(ck(enumTable(257), { proofLimit: 257 }), []);
  expectDiags(ck(enumTable(256), { proofLimit: 255 }), [X311({ reason: 'over_limit', product: 256, limit: 255 })]);
  expectDiags(ck(exhaustive(inputs('e'), [['r1', { material: 'X' }]]), { proofLimit: 0 }), [X311({ reason: 'over_limit', product: 3, limit: 0 })]);
});

check('F-X7', 'non-enum input types are never enumerated: boolean, decimal, string, quantity (E-0020)', () => {
  const cases = [
    ['b', [['r1', { flag: true }], ['r2', { flag: false }]], REFS.flag],
    ['d', [['r1', { count: { gt: '0' } }], ['r2', { count: { lte: '0' } }]], REFS.count],
    ['s', [['r1', { note: 'a' }], ['r2', { note: { ne: 'a' } }]], REFS.note],
    ['q', [['r1', { concentration: { gt: Q('0', 'pm') } }], ['r2', { concentration: { lte: Q('0', 'pm') } }]], REFS.concentration],
  ];
  for (const [name, rows, ref] of cases) {
    expectDiags(ck(exhaustive(inputs(name), rows)), [X311({ reason: 'non_enum_input', input: ref })], name);
  }
});

check('F-X8', 'an enum input without domain is KF-E-311 missing_domain (l.608, l.634)', () => {
  const noDomain = { ref: REFS.material, type: 'enum' };
  const diags = ck(exhaustive([noDomain], [['r1', { material: { is_null: false } }]])).filter((d) => d.code === 'KF-E-311');
  expectDiags(diags, [X311({ reason: 'missing_domain', input: REFS.material })]);
});

check('F-X8b', 'reason precedence: first offending input in inputs[] order, then the product (PLAN KF-E-311 row)', () => {
  const noDomain = { ref: REFS.material, type: 'enum' };
  const rows = [['r1', { concentration: { is_null: true } }]];
  const pick = (ins) => ck(exhaustive(ins, rows)).filter((d) => d.code === 'KF-E-311');
  expectDiags(pick([noDomain, input('q')]), [X311({ reason: 'missing_domain', input: REFS.material })]);
  expectDiags(pick([input('q'), noDomain]), [X311({ reason: 'non_enum_input', input: REFS.concentration })]);
  const big = { ref: REFS.a, type: 'enum', domain: Array.from({ length: 300 }, (_, i) => `v${i}`) };
  expectDiags(pick([big, input('q')]), [X311({ reason: 'non_enum_input', input: REFS.concentration })]);
});

check('F-X9', 'exhaustive: false or absent is not checked (l.634)', () => {
  assert.deepEqual(ck(table({ ins: inputs('e'), rows: [['r1', { material: 'X' }]] })), []);
  assert.deepEqual(ck(table({ ins: inputs('q'), rows: [['r1', { concentration: { lte: Q('1', 'pm') } }]] })), []);
  const absent = table({ ins: inputs('e'), rows: [['r1', { material: 'X' }]] });
  delete absent.exhaustive;
  assert.deepEqual(ck(absent), []);
});

check('F-X10', 'a KF-E-311 finding does not block evaluation (P-03)', () => {
  const t = exhaustive(inputs('q', 'e'), [['r1', { material: { not_in: ['X'] } }], ['r2', { material: 'X' }]]);
  expectRow(ev(t, vals({ material: 'Y' })), t, 'r1');
});

check('F-X11', 'invalid proofLimit is INVALID_ARGUMENT (PLAN API contract)', () => {
  for (const proofLimit of [-1, 1.5, '256', Number.NaN]) {
    expectLogicError(() => mod('dt').checkDecisionTable(clone(enumTable(3)), { unitRegistry: reg('u1'), proofLimit }), 'INVALID_ARGUMENT');
  }
});

check('F-X12', 'a top-level when: {} does not satisfy the default requirement but covers every tuple (E-0022 D-08)', () => {
  assert.deepEqual(ck(exhaustive(inputs('e'), [['r1', {}]])), [], 'enumeration finds every tuple covered');
  expectDiags(ck(exhaustive(inputs('q'), [['r1', {}]])), [X311({ reason: 'non_enum_input', input: REFS.concentration })]);
});

// ============================================================================================ overlap for unique (F-V)
const V312 = (extra) => ({ code: 'KF-E-312', pointer: '/rules/0', rule: 'r1', rule_index: 0, ...extra });

check('F-V1', 'enumeration: first overlapping tuple with witness and the first two rows (l.633; E-0020)', () => {
  const t = pair([input('A'), input('B')], { a: 'X' }, { a: { in: ['X', 'Y'] }, b: 'P' });
  expectDiags(ck(t), [V312({ proof: 'enumeration', rules: ['r1', 'r2'], rule_indexes: [0, 1], witness: { [REFS.a]: 'X', [REFS.b]: 'P' } })]);
});

check('F-V2', 'enumeration near-miss: disjoint rows are clean', () => {
  assert.deepEqual(ck(pair([input('A'), input('B')], { a: 'X', b: 'P' }, { a: 'Y' })), []);
});

check('F-V3', 'enumeration is exact where set reasoning is not: ne (E-0020)', () => {
  assert.deepEqual(ck(pair([input('A')], { a: { ne: 'X' } }, { a: 'X' })), []);
  expectDiags(ck(pair([input('A')], { a: { ne: 'X' } }, { a: 'Y' })), [V312({ proof: 'enumeration', rules: ['r1', 'r2'], witness: { [REFS.a]: 'Y' } })]);
});

check('F-V4', 'limit boundary: product 2 is enumerated with proofLimit 2; with 1 the proof falls back and fails closed (E-0020)', () => {
  const t = pair([input('A')], { a: { ne: 'X' } }, { a: 'X' });
  assert.deepEqual(ck(t, { proofLimit: 2 }), []);
  expectDiags(ck(t, { proofLimit: 1 }), [V312({ proof: 'not_proven_disjoint', rules: ['r1', 'r2'], rule_indexes: [0, 1] })]);
  assert.deepEqual(ck(pair([input('A')], { a: 'X' }, { a: 'Y' }), { proofLimit: 1 }), [], 'near-miss: set reasoning proves disjointness without enumeration');
});

check('F-V5', 'a default row alone never overlaps (E-0020)', () => {
  assert.deepEqual(ck(table({ policy: 'unique', ins: inputs('e'), rows: [['rd', 'default']] })), []);
  assert.deepEqual(ck(table({ policy: 'unique', ins: inputs('q', 'd'), rows: [['r1', { count: { gt: '0' } }], ['rd', 'default']] })), []);
});

const NON_ENUM = ['q', 'd', 's', 'b'];
check('F-V6', 'interval/set reasoning proves disjointness (E-0020)', () => {
  DISJOINT_PAIRS.forEach(([w1, w2], i) => {
    assert.deepEqual(ck(pair(NON_ENUM, w1, w2)), [], `pair ${i} ${JSON.stringify([w1, w2])}`);
    assert.deepEqual(ck(pair(NON_ENUM, w2, w1)), [], `pair ${i} swapped`);
  });
});

check('F-V6b', 'overlapping pairs are KF-E-312 not_proven_disjoint (E-0020)', () => {
  OVERLAPPING_PAIRS.forEach(([w1, w2], i) => {
    expectDiags(ck(pair(NON_ENUM, w1, w2)), [V312({ proof: 'not_proven_disjoint', rules: ['r1', 'r2'], rule_indexes: [0, 1] })], `pair ${i} ${JSON.stringify([w1, w2])}`);
  });
});

check('F-V6c', 'three mutually overlapping rows give one diagnostic per pair in pair order (E-0020; PLAN KF-E-312 row)', () => {
  const t = table({ policy: 'unique', ins: inputs(...NON_ENUM), rows: [['r1', { count: { gte: '0' } }], ['r2', { count: { gte: '0' } }], ['r3', { count: { gte: '0' } }]] });
  expectDiags(ck(t), [
    { code: 'KF-E-312', proof: 'not_proven_disjoint', rules: ['r1', 'r2'], rule_indexes: [0, 1], pointer: '/rules/0' },
    { code: 'KF-E-312', proof: 'not_proven_disjoint', rules: ['r1', 'r3'], rule_indexes: [0, 2], pointer: '/rules/0' },
    { code: 'KF-E-312', proof: 'not_proven_disjoint', rules: ['r2', 'r3'], rule_indexes: [1, 2], pointer: '/rules/1' },
  ]);
});

check('F-V7', 'fail closed: not provable by interval/set reasoning is KF-E-312 even if actually disjoint (E-0020)', () => {
  FAIL_CLOSED_PAIRS.forEach(([w1, w2], i) => {
    expectDiags(ck(pair(NON_ENUM, w1, w2)), [V312({ proof: 'not_proven_disjoint', rules: ['r1', 'r2'], rule_indexes: [0, 1] })], `pair ${i} ${JSON.stringify([w1, w2])}`);
  });
});

check('F-V8', 'overlap witness order: first input outermost, last input fastest (E-0022 D-06)', () => {
  const both = (a, b) => ({ all: [{ a }, { b }] });
  const w = { any: [both('X', 'Q'), both('Y', 'P')] };
  const t = pair([input('A'), input('B')], w, clone(w));
  expectDiags(ck(t), [V312({ proof: 'enumeration', rules: ['r1', 'r2'], witness: { [REFS.a]: 'X', [REFS.b]: 'Q' } })]);
});

check('F-V9', 'a top-level when: {} overlaps every other non-default row (E-0022 D-08)', () => {
  expectDiags(ck(pair([input('e')], {}, { material: 'X' })), [V312({ proof: 'enumeration', rules: ['r1', 'r2'], witness: { [REFS.material]: 'X' } })]);
  expectDiags(ck(pair(NON_ENUM, {}, { count: { gt: '0' } })), [V312({ proof: 'not_proven_disjoint', rules: ['r1', 'r2'] })]);
  assert.deepEqual(ck(table({ policy: 'unique', ins: inputs('e'), rows: [['r1', {}], ['rd', 'default']] })), [], 'near-miss: the unconditional row beside a default row');
  const t = table({ policy: 'unique', ins: inputs('e'), rows: [['r1', {}], ['r2', { material: 'X' }]] });
  expectError(ev(t, vals({ material: 'X' })), [{ code: 'KF-E-312', proof: 'evaluation', rules: ['r1', 'r2'] }]);
  expectRow(ev(t, vals({ material: 'Y' })), t, 'r1');
});

// ============================================================================================ code matrix (F-K) and diagnostics (F-S)
check('F-K', 'each in-scope KF- code has a positive and a near-miss case (V-34)', () => {
  const pairs = [
    ['KF-E-310', S1(QIN, { concentration: { lte: Q('4.2', 'ppm') } }), S1(QIN, { concentration: { lte: Q('4.2', 'pm') } })],
    ['KF-E-311', exhaustive(inputs('q', 'e'), [['r1', { material: 'X' }]]), exhaustive(inputs('e'), [['r1', { material: { in: ['X', 'Y', 'Z'] } }]])],
    ['KF-E-312', pair([input('A')], { a: 'X' }, { a: { in: ['X', 'Y'] } }), pair([input('A')], { a: 'X' }, { a: 'Y' })],
    ['KF-E-314', S1(['e'], { material: 'W' }), S1(['e'], { material: 'X' })],
    ['KF-E-315', S1(['s'], { note: { matches: '(?=a)' } }), S1(['s'], { note: { matches: '(?:a)' } })],
  ];
  for (const [code, positive, nearMiss] of pairs) {
    const diags = ck(positive);
    assert.ok(diags.length >= 1 && diags.every((d) => d.code === code), `${code} positive`);
    assert.deepEqual(ck(nearMiss), [], `${code} near-miss`);
  }
});

check('F-S1', 'all five codes in one table, in sort order (V-35)', () => {
  const diags = ck(allFiveCodes());
  assert.deepEqual(diags.map((d) => [d.code, d.pointer]), [
    ['KF-E-310', '/rules/0/when/concentration/lte'],
    ['KF-E-311', '/exhaustive'],
    ['KF-E-312', '/rules/0'],
    ['KF-E-312', '/rules/0'],
    ['KF-E-312', '/rules/1'],
    ['KF-E-314', '/rules/1/when/material'],
    ['KF-E-315', '/rules/2/when/note/matches'],
  ]);
  assert.deepEqual(diags[2].rules, ['r1', 'r2']);
  assert.deepEqual(diags[3].rules, ['r1', 'r3']);
  assert.deepEqual(diags[4].rules, ['r2', 'r3']);
});

check('F-S2a', 'key-order permutations of the table give the identical list (determinism)', () => {
  for (const build of [allFiveCodes, multiKeyFindings]) {
    const original = ck(build());
    assert.ok(original.length > 0);
    assert.deepEqual(ck(permute(build())), original);
  }
});

check('F-S2b', 'a fresh process produces byte-identical results (determinism)', () => {
  const inProcess = payload(mod('dt'), mod('units'), UNITS_DATA.u1);
  const child = spawnSync(process.execPath, [path.join(DATA, 'determinism-child.mjs')], { encoding: 'utf8', timeout: 60000 });
  assert.equal(child.status, 0, `child failed: ${child.stderr}`);
  assert.equal(child.stdout, inProcess);
});

check('F-S3', 'inputs are never mutated; outputs are fresh (V-37)', () => {
  const DT = mod('dt');
  const t = deepFreeze(clone(allFiveCodes()));
  const options = deepFreeze({ unitRegistry: reg('u1'), proofLimit: 256 });
  const snapshot = JSON.stringify(t);
  const a = DT.checkDecisionTable(t, options);
  const b = DT.checkDecisionTable(t, options);
  assert.notStrictEqual(a, b);
  assert.deepEqual(a, b);
  const ok = deepFreeze(clone(TH({ policy: 'collect' })));
  const values = deepFreeze(vals({ material: 'Y', count: '1' }));
  const r1 = DT.evaluateDecisionTable(ok, values, options);
  const r2 = DT.evaluateDecisionTable(ok, values, options);
  assert.notStrictEqual(r1, r2);
  assert.notStrictEqual(r1.result, r2.result);
  assert.deepEqual(r1, r2);
  assert.equal(JSON.stringify(t), snapshot);
});

check('F-S4', 'diagnostic shape: severity E, remediation only on KF-E-311, no error key (V-35; l.1600)', () => {
  const diags = ck(allFiveCodes());
  assert.equal(new Set(diags.map((d) => d.code)).size, 5);
  for (const d of diags) {
    assert.equal(d.severity, 'E');
    assert.equal(typeof d.message, 'string');
    assert.ok(!('error' in d));
    if (d.code === 'KF-E-311') assert.equal(d.remediation, REMEDIATION_311);
    else assert.equal(d.remediation, undefined);
  }
});

check('F-S5a', 'LOGIC_DIAGNOSTIC_CATALOG equals l.1765-1770 (V-38)', () => {
  const catalog = mod('diag').LOGIC_DIAGNOSTIC_CATALOG;
  assert.deepEqual(Object.keys(catalog).sort(), CODES);
  for (const code of CODES) {
    assert.equal(catalog[code].code, code);
    assert.equal(catalog[code].severity, 'E');
    if (code === 'KF-E-311') assert.equal(catalog[code].remediation, REMEDIATION_311);
    else assert.equal(catalog[code].remediation, undefined);
  }
});

check('F-S5b', 'sortDiagnostics orders by (code, rule_index, pointer, rule_indexes, message) in UTF-8 byte order (PLAN sort key)', () => {
  const D = mod('diag');
  const mk = (code, rule_index, pointer, extra = {}) => ({ code, severity: 'E', message: 'm', rule_index, pointer, ...extra });
  const d = {
    nullIdx: mk('KF-E-310', null, '/z'),
    zeroIdx: mk('KF-E-310', 0, '/a'),
    noIdxA: mk('KF-E-312', 0, '/rules/0', { message: 'a' }),
    noIdxB: mk('KF-E-312', 0, '/rules/0', { message: 'b' }),
    r01: mk('KF-E-312', 0, '/rules/0', { rule_indexes: [0, 1] }),
    r02: mk('KF-E-312', 0, '/rules/0', { rule_indexes: [0, 2] }),
    upper: mk('KF-E-314', 1, '/rules/1/when/B'),
    lower: mk('KF-E-314', 1, '/rules/1/when/b'),
    fffd: mk('KF-E-315', 0, '/�'),
    emoji: mk('KF-E-315', 0, '/\u{1F600}'),
  };
  const expected = [d.nullIdx, d.zeroIdx, d.noIdxA, d.noIdxB, d.r01, d.r02, d.upper, d.lower, d.fffd, d.emoji];
  const shuffled = [d.emoji, d.r02, d.lower, d.noIdxB, d.fffd, d.zeroIdx, d.upper, d.r01, d.nullIdx, d.noIdxA];
  const snapshot = [...shuffled];
  const out = D.sortDiagnostics(shuffled);
  assert.deepEqual(out, expected);
  assert.notStrictEqual(out, shuffled, 'returns a new array');
  assert.deepEqual(shuffled, snapshot, 'does not reorder its argument');
});

// ============================================================================================ existing fixture (F-A)
const ACME = path.join(CONF, 'acme-formulation', 'knowledge', 'business-rules', 'BR-0001');
const SPEC_EXAMPLE = path.join(CONF, 'spec-examples', '10.3-greenfield-rule.yaml');

check('F-A1', 'acme BR-0001 specified v1 checks clean and evaluates (l.2077; V-36)', async () => {
  const rule = await readYaml(ACME, 'rule.yaml');
  const t = rule.specified[0].logic;
  assert.deepEqual(ck(t), []);
  const r1 = ev(t, vals({ concentration: Q('4.2', 'pm') }));
  expectRow(r1, t, 'r1');
  assert.deepEqual(r1.result.then, { valid: true, outcome: 'OUT-0001' });
  const r2 = ev(t, vals({ concentration: Q('4.21', 'pm') }));
  expectRow(r2, t, 'r2');
  assert.deepEqual(r2.result.then, { valid: false });
  assert.equal(r2.via_default, true);
  expectRow(ev(t, {}), t, 'r2');
  expectError(ev(t, vals({ concentration: Q('4.2', 'ppm') })), [{ code: 'KF-E-310', source: 'value', expected_unit: 'percent_mass', found_unit: 'ppm_mass' }]);
});

check('F-A2', 'acme BR-0001 specified v2 (lte 4.0) (V-36)', async () => {
  const rule = await readYaml(ACME, 'rule.yaml');
  const t = rule.specified[1].logic;
  assert.deepEqual(ck(t), []);
  expectRow(ev(t, vals({ concentration: Q('4.0', 'pm') })), t, 'r1');
  expectRow(ev(t, vals({ concentration: Q('4.1', 'pm') })), t, 'r2');
});

check('F-A3', 'acme BR-0001 observed facet (when: {}) checks clean and evaluates (E-0022 D-08)', async () => {
  const observed = await readYaml(ACME, 'observed', 'legacy-app.yaml');
  const t = observed.logic;
  assert.deepEqual(ck(t), []);
  for (const values of [{}, vals({ concentration: Q('100', 'pm') }), vals({ concentration: Q('0.1', 'pm') })]) {
    const res = ev(t, values);
    expectRow(res, t, 'r1');
    assert.deepEqual(res.result.then, { max_concentration: { value: '4.5', unit: 'percent_mass' } });
  }
});

check('F-A4', 'spec example 10.3 (BR-0037): check yields exactly KF-E-311; evaluation as stated (l.445-455; E-0008(d); V-36)', async () => {
  const example = await readYaml(SPEC_EXAMPLE);
  const t = example.specified.logic;
  expectDiags(ck(t), [X311({ reason: 'non_enum_input', input: 'DE-0017.concentration' })]);
  const at = (material, extra = {}) => ev(t, { 'DE-0017.concentration': Q('1', 'pm'), ...(material === undefined ? {} : { 'DE-0017.material_type': material }), ...extra });
  const y = at('Y');
  expectRow(y, t, 'r1');
  assert.deepEqual(y.result.then, { max_concentration: Q('4.2', 'pm'), outcome: 'OUT-0004' });
  const x = at('X');
  expectRow(x, t, 'r2');
  assert.deepEqual(x.result.then, { exempt: true, outcome: 'OUT-0009' });
  expectRow(at(undefined), t, null);
  expectError(at('W'), [{ code: 'KF-E-314', input: 'DE-0017.material_type', value: 'W', source: 'value', pointer: '/inputs/1' }]);
});

check('F-A5', 'no expected/ line, acme-formulation or bin/ content is added or changed by P011 (V-40)', () => {
  const status = spawnSync('git', ['status', '--porcelain', '--', 'framework/conformance/acme-formulation', 'framework/conformance/spec-examples', 'framework/conformance/expected', 'bin', 'package.json', 'eslint.config.js'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(status.status, 0, status.stderr);
  assert.equal(status.stdout.trim(), '', 'P011 changes none of these paths');
});

// ============================================================================================ static scans (F-P)
const SIX = ['logic-errors.mjs', 'decimal.mjs', 'units.mjs', 'regex-re2.mjs', 'logic-diagnostics.mjs', 'decision-table.mjs'];
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const sourceOf = async (file) => stripComments(await fs.readFile(path.join(ENGINE_DIR, file), 'utf8'));

check('F-P1', 'the six modules import only siblings of framework/engine (PLAN deliverables; V-06)', async () => {
  for (const file of SIX) {
    const source = await sourceOf(file);
    const specs = [...source.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const spec of specs) assert.match(spec, /^\.\/[A-Za-z0-9._-]+\.mjs$/, `${file} imports ${spec}`);
  }
});

check('F-P2', 'no binary float, clock, randomness, I/O or host RegExp in the modules (l.582, l.612; V-06, V-13)', async () => {
  const banned = [/\bparseFloat\b/, /\btoFixed\b/, /\btoPrecision\b/, /Math\.random/, /\bDate\b/, /\bperformance\b/, /process\.env/, /\bcrypto\b/, /\breadFile\b/, /\bsetTimeout\b/];
  for (const file of SIX) {
    const source = await sourceOf(file);
    for (const pattern of banned) assert.doesNotMatch(source, pattern, `${file} contains ${pattern}`);
  }
  const decimal = await sourceOf('decimal.mjs');
  for (const pattern of [/\bNumber\(/, /\bparseInt\b/, /\bMath\./]) assert.doesNotMatch(decimal, pattern, `decimal.mjs contains ${pattern}`);
  for (const file of ['regex-re2.mjs', 'decision-table.mjs']) {
    const source = await sourceOf(file);
    for (const pattern of [/new\s+RegExp/, /\bRegExp\(/, /\.match\(/, /\.exec\(/, /\.test\(/]) assert.doesNotMatch(source, pattern, `${file} contains ${pattern}`);
  }
});

// ============================================================================================ index coverage (runs now)
test('F-M every key of the case index has at least one test, and every test key is indexed', () => {
  const indexed = new Set(Object.keys(INDEX.case_index));
  const missing = [...indexed].filter((k) => !covered.has(k));
  const unindexed = [...covered].filter((k) => !indexed.has(k));
  assert.deepEqual(missing, [], 'indexed keys without a test');
  assert.deepEqual(unindexed, [], 'tests without an index entry');
  assert.equal(INDEX.phase, 'P011');
  for (const [key, entry] of Object.entries(INDEX.case_index)) {
    assert.ok(Array.isArray(entry.cites) && entry.cites.length > 0, `${key} cites a clause, errata entry or PLAN target`);
    assert.ok(Array.isArray(entry.targets), `${key} targets`);
  }
});
