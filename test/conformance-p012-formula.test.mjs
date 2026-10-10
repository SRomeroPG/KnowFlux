// P012 Formula Logic - conformance slice (spec section 55; l.2103: the fixture is the operative definition of "done" and is
// written together with, never after, the feature).
//
// Written by the conformance engineer from PLAN.md (incl. "Foreman decisions after planning", errata E-0036), TRIAGE.md, the
// spec and errata E-0008, E-0017..E-0022, E-0025..E-0027, E-0030..E-0033, E-0036, BEFORE any P012 implementer code was read
// (framework/engine/formula.mjs and decimal-ops.mjs did not exist). The case index (cites, targets, expected summary) is
// framework/conformance/p012-formula.yaml; vectors and builders live in framework/conformance/p012-formula/. Case ids (F-xx)
// and targets (V-nn) are those of the PLAN.
//
// P012 is an engine API phase: there is no `kf` command and no framework/conformance/expected/ runner yet (P028 ports this
// slice). The suite drives the public API contract of the PLAN only: checkFormula, evaluateFormula, the decimal-ops exports,
// and the appended constants of logic-errors.mjs / logic-diagnostics.mjs.
//
// Every engine case is marked todo while the engine is being built: it runs and reports but does not fail `npm test`.
// Removing the marker is the one-line change below (PENDING = false). Expectations are never weakened to pass; a missing
// engine module makes the case fail INSIDE its todo. Cases that wait for a decision are `test.todo` with the name of the
// DECISION_NEEDED item (none at present: E-0037 settled F-Zp1, F-Zp2).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';
import {
  ALL_INPUTS, C, FX, K, NUL, OK, Q, add, clone, deepFreeze, divide, iff, multiply, permuteKeys, ref, rnd, vals, valsBySuffix,
} from '../framework/conformance/p012-formula/builders.mjs';
import { GROUPS, K1_PAIRS, L1_NULL_VARIANTS } from '../framework/conformance/p012-formula/cases.mjs';
import { R01_GROUPS } from '../framework/conformance/p012-formula/cases-r01.mjs';
import { w5Cases, wGroups } from '../framework/conformance/p012-formula/cases-w.mjs';
import { payload } from '../framework/conformance/p012-formula/determinism-child.mjs';
import { buildOptions, execCase, plain } from '../framework/conformance/p012-formula/exec.mjs';
import { readSpecExample } from '../framework/conformance/p012-formula/spec-example.mjs';

const PENDING = false; // enforced: was 'P012 implementation pending' while the engine was being built

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONF = path.join(REPO_ROOT, 'framework', 'conformance');
const DATA = path.join(CONF, 'p012-formula');
const ENGINE_DIR = path.join(REPO_ROOT, 'framework', 'engine');
const readYaml = async (...parts) => YAML.parse(await fs.readFile(path.join(...parts), 'utf8'));
const ENTRY_SHA = 'c10ae95d828847c79589535b1bb31c0fd7153242'; // the commit the P011 surface is pinned to (PLAN F-E2)

const INDEX = await readYaml(CONF, 'p012-formula.yaml');
const REGS = { uf0: await readYaml(DATA, 'units-uf0.yaml'), uf1: await readYaml(DATA, 'units-uf1.yaml'), uf2: await readYaml(DATA, 'units-uf2.yaml'), ufz: await readYaml(DATA, 'units-ufz.yaml') };
const ROUNDING = await readYaml(DATA, 'rounding.yaml');
const DEC_OPS = await readYaml(DATA, 'decimal-ops.yaml');

// ------------------------------------------------------------------ engine modules (public API only)
const FILES = {
  errors: 'logic-errors.mjs',
  dec: 'decimal.mjs',
  units: 'units.mjs',
  re2: 'regex-re2.mjs',
  diag: 'logic-diagnostics.mjs',
  dt: 'decision-table.mjs',
  ops: 'decimal-ops.mjs',
  formula: 'formula.mjs',
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
  test(`${key} ${title}`, { todo: PENDING, timeout }, (t) => fn(t));
}

// ------------------------------------------------------------------ generic helpers
const CODES = ['KF-E-310', 'KF-E-313', 'KF-E-314', 'KF-E-315', 'KF-E-316'];
const REMEDIATION_313 = 'añadir `guard`'; // spec l.1768
const bytes = (s) => Buffer.from(String(s), 'utf8');
const cmpStr = (a, b) => Buffer.compare(bytes(a), bytes(b));
function cmpDiag(x, y) {
  let c = cmpStr(x.code, y.code);
  if (c) return c;
  c = Math.sign((x.rule_index ?? -1) - (y.rule_index ?? -1));
  if (c) return c;
  c = cmpStr(x.pointer, y.pointer);
  if (c) return c;
  return cmpStr(x.message ?? '', y.message ?? '');
}

/** Universal diagnostic invariants (PLAN Diagnostic type, F-S4, Diagnostic sort key). */
function assertDiagnosticList(list, context) {
  assert.ok(Array.isArray(list), `${context}: diagnostics is an array`);
  for (const d of list) {
    assert.ok(CODES.includes(d.code), `${context}: only the five catalog codes of the phase are produced (got ${d.code})`);
    assert.equal(d.severity, 'E', `${context}: severity`);
    assert.equal(typeof d.message, 'string', `${context}: message`);
    assert.equal(typeof d.pointer, 'string', `${context}: pointer`);
    assert.equal(d.rule, null, `${context}: rule is null`);
    assert.equal(d.rule_index, null, `${context}: rule_index is null`);
    assert.ok(!('error' in d), `${context}: no key named error`);
    if (d.code === 'KF-E-313') assert.equal(d.remediation, REMEDIATION_313, `${context}: 313 remediation (l.1768, l.1600)`);
    else assert.ok(!('remediation' in d) || d.remediation === undefined, `${context}: remediation only on KF-E-313`);
  }
  for (let i = 1; i < list.length; i += 1) {
    assert.ok(cmpDiag(list[i - 1], list[i]) <= 0, `${context}: diagnostics sorted by (code, pointer, message) (index ${i})`);
    assert.ok(!(list[i - 1].code === list[i].code && list[i - 1].pointer === list[i].pointer), `${context}: no two diagnostics share (code, pointer)`);
  }
}

function assertLogicError(error, code) {
  assert.ok(error, `expected LogicError ${code}, nothing was thrown`);
  assert.ok(error instanceof mod('errors').LogicError, `instance of LogicError (got ${error?.name}: ${error?.message})`);
  assert.equal(error.name, 'LogicError');
  assert.equal(error.code, code, `error code (message: ${error.message})`);
  assert.equal(typeof error.details, 'object');
  assert.ok(!String(error.code).startsWith('KF-'), 'a KF- code is never thrown (PLAN routing rule)');
}
function expectLogicError(fn, code) {
  let caught = null;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assertLogicError(caught, code);
  return caught;
}

function expectDiags(list, specs, context = '') {
  assert.equal(list.length, specs.length, `${context} diagnostics count (got ${JSON.stringify(list.map((d) => [d.code, d.pointer]))})`);
  specs.forEach((spec, i) => {
    for (const [key, value] of Object.entries(spec)) {
      assert.deepEqual(list[i][key], value, `${context} diagnostic ${i} (${list[i].code} ${list[i].pointer}) field ${key}`);
    }
  });
}

const RESULT_KEYS = ['diagnostics', 'guard_index', 'outcome', 'status', 'value'];
function assertResultShape(res, context) {
  assert.deepEqual(Object.keys(res).sort(), RESULT_KEYS, `${context}: FormulaResult has exactly status, value, outcome, guard_index, diagnostics`);
}

/** One case through the public API, twice (deterministic, fresh objects), on deep-frozen inputs. */
function runCase(c) {
  const F = mod('formula');
  const UN = mod('units');
  const r1 = execCase(F, UN, REGS, c);
  const r2 = execCase(F, UN, REGS, c);
  assert.deepEqual(plain(r2), plain(r1), 'two calls give deep-equal results');
  for (const side of ['check', 'evaluate']) {
    if (r1[side].value !== undefined && typeof r1[side].value === 'object') assert.notEqual(r2[side].value, r1[side].value, `${side}: results are fresh objects`);
  }
  const must = (r, what) => {
    if (r.thrown !== undefined) assert.fail(`${what} threw ${r.thrown}${r.instance?.message ? `: ${r.instance.message}` : ''}`);
    return r.value;
  };
  const exp = c.exp;
  const checked = () => {
    const list = must(r1.check, 'checkFormula');
    assertDiagnosticList(list, 'check');
    return list;
  };
  const evaluated = () => {
    const res = must(r1.evaluate, 'evaluateFormula');
    assertResultShape(res, 'evaluate');
    assertDiagnosticList(res.diagnostics, 'evaluate');
    return res;
  };
  switch (exp.kind) {
    case 'ok':
    case 'null':
    case 'raised': {
      assert.deepEqual(checked(), [], 'a formula with a defined outcome checks clean');
      const res = evaluated();
      if (exp.kind === 'ok') assert.deepEqual(res, { status: 'ok', value: { value: exp.value, unit: exp.unit }, outcome: null, guard_index: null, diagnostics: [] });
      else if (exp.kind === 'null') assert.deepEqual(res, { status: 'ok', value: null, outcome: null, guard_index: null, diagnostics: [] });
      else assert.deepEqual(res, { status: 'raised', value: null, outcome: exp.outcome, guard_index: exp.index, diagnostics: [] });
      break;
    }
    case 'chk':
    case 'err': {
      const list = checked();
      expectDiags(list, exp.specs, 'check');
      if (exp.specs.length > 0) {
        const res = evaluated();
        assert.equal(res.status, 'error', 'static findings block evaluation (E-0032 (5))');
        assert.equal(res.value, null);
        assert.equal(res.outcome, null);
        assert.equal(res.guard_index, null);
        assert.deepEqual(res.diagnostics, list, 'evaluate returns exactly the checkFormula list');
      }
      break;
    }
    case 'verr': {
      assert.deepEqual(checked(), [], 'supplied-value findings are not static: check is clean');
      const res = evaluated();
      assert.equal(res.status, 'error');
      assert.equal(res.value, null);
      assert.equal(res.outcome, null);
      assert.equal(res.guard_index, null);
      expectDiags(res.diagnostics, exp.specs, 'evaluate');
      break;
    }
    case 'throws': {
      if (exp.only === 'evaluate') {
        assert.deepEqual(checked(), [], 'check is clean when only evaluation throws');
        assert.equal(r1.evaluate.thrown, exp.code, `evaluateFormula error code (got ${r1.evaluate.thrown ?? 'a value'})`);
        assertLogicError(r1.evaluate.instance, exp.code);
      } else {
        assert.equal(r1.check.thrown, exp.code, `checkFormula error code (got ${r1.check.thrown ?? 'a value'})`);
        assertLogicError(r1.check.instance, exp.code);
        assert.equal(r1.evaluate.thrown, exp.code, `evaluateFormula error code (got ${r1.evaluate.thrown ?? 'a value'})`);
        assertLogicError(r1.evaluate.instance, exp.code);
      }
      break;
    }
    default:
      assert.fail(`unknown expectation kind ${exp.kind}`);
  }
}

function runAll(key, cases) {
  assert.ok(cases.length > 0, `${key} has cases`);
  for (const c of cases) {
    try {
      runCase(c);
    } catch (error) {
      error.message = `[${key} :: ${c.name}] ${error.message}`;
      throw error;
    }
  }
}

// ------------------------------------------------------------------ the spec example, loaded from the frozen spec
const SPEC = await readSpecExample().catch((error) => ({ error }));
const W = SPEC.error ? null : SPEC.parsed?.logic;
const W_GROUPS = W ? wGroups(W) : [];
const W5_CASES = W ? w5Cases(W, ROUNDING) : [];
const DYNAMIC = []; // groups built from the YAML tables: {key, title, cases}

// R1/R1b/R2: rounding tables through the whole formula (value rendered with exactly `decimals` digits)
const rf = ref('f');
const tableCases = (rows, decimals) => rows.flatMap((row) => ROUNDING.modes.map((mode, i) => C(`${row[0]} ${mode} decimals ${decimals}`, FX(rf, 'ratio', rnd(mode, decimals)), OK(row[i + 1]), { values: vals({ f: row[0] }) })));
DYNAMIC.push({ key: 'F-R1', title: 'rounding decimals 0: four modes over positive, negative, tie and zero values (l.584; E-0032 (2))', cases: tableCases(ROUNDING.r1, 0) });
DYNAMIC.push({ key: 'F-R1b', title: 'rounding decimals 1 (E-0032 (2))', cases: tableCases(ROUNDING.r1b, 1) });
DYNAMIC.push({ key: 'F-R2', title: 'rounding decimals 2 (E-0032 (2))', cases: tableCases(ROUNDING.r2, 2) });
DYNAMIC.push({
  key: 'F-R3',
  title: 'rendering with exactly `decimals` fraction digits, no cap; a negative zero renders non-negative (E-0032 (2))',
  cases: [
    ...ROUNDING.r3.map(([value, decimals, expected]) => C(`${value} / ${decimals}`, FX(rf, 'ratio', rnd('half-even', decimals)), OK(typeof expected === 'string' ? expected : expected.prefix + '0'.repeat(expected.zeros)), { values: vals({ f: value }) })),
    C('30-digit integer part, tie half-even', FX(rf, 'ratio', rnd('half-even', 0)), OK('123456789012345678901234567890'), { values: vals({ f: '123456789012345678901234567890.5' }) }),
    C('30-digit integer part, tie half-up', FX(rf, 'ratio', rnd('half-up', 0)), OK('123456789012345678901234567891'), { values: vals({ f: '123456789012345678901234567890.5' }) }),
    C('negated, half-even', FX(rf, 'ratio', rnd('half-even', 0)), OK('-123456789012345678901234567890'), { values: vals({ f: '-123456789012345678901234567890.5' }) }),
    C('negated, half-up', FX(rf, 'ratio', rnd('half-up', 0)), OK('-123456789012345678901234567891'), { values: vals({ f: '-123456789012345678901234567890.5' }) }),
  ],
});
DYNAMIC.push({
  key: 'F-R4',
  title: 'no rounding block: nothing is rounded and the value is canonical (l.584 "Sin declaración, no hay redondeo")',
  cases: [
    C('4.20', FX(rf), OK('4.2'), { values: vals({ f: '4.20' }) }),
    C('1000.000', FX(rf), OK('1000'), { values: vals({ f: '1000.000' }) }),
    C('33 decimals are kept', FX(rf), OK('0.123456789012345678901234567890123'), { values: vals({ f: '0.123456789012345678901234567890123' }) }),
  ],
});
DYNAMIC.push({ key: 'F-W5', title: 'spec example ties and signs for all four modes; never a negative zero (l.584; E-0032 (2))', cases: W5_CASES });

// V10 long exact digits: exact against a BigInt reference
const digits = (n, seed) => {
  let s = String(1 + (seed % 9));
  for (let i = 1; i < n; i += 1) s += String((i * 7 + seed * 3 + 1) % 10);
  return s;
};
const A300 = digits(300, 2);
const B300 = digits(300, 5);
DYNAMIC.push({
  key: 'F-V10',
  title: 'long exact digits: multiply and add of 300-digit constants equal the BigInt reference (l.582)',
  cases: [
    C('300-digit product', FX(multiply(K(A300), K(B300))), OK((BigInt(A300) * BigInt(B300)).toString())),
    C('300-digit sum', FX(add(K(A300), K(B300))), OK((BigInt(A300) + BigInt(B300)).toString())),
    C('300-digit difference', FX({ op: 'subtract', args: [K(A300), K(B300)] }), OK((BigInt(A300) - BigInt(B300)).toString())),
  ],
});

for (const { key, title, cases } of [...GROUPS.entries(), ...R01_GROUPS.entries()].map(([k, g]) => ({ key: k, ...g })).concat(W_GROUPS, DYNAMIC)) {
  check(key, title, () => runAll(key, cases));
}

// ============================================================================================ spec example fixture integrity
check('F-W0', 'the example is loaded from the frozen spec: l.640 and l.653 are the fences, l.641-652 hold the logic mapping (l.640-653)', () => {
  assert.ok(!SPEC.error, `spec readable: ${SPEC.error?.message}`);
  assert.match(SPEC.open, /^```/, 'l.640 is the opening fence');
  assert.equal(SPEC.close, '```', 'l.653 is the closing fence');
  assert.equal(W.kind, 'formula');
  assert.deepEqual(W.output, { ref: 'DE-0017.adjusted_concentration', unit: 'percent_mass' });
  assert.deepEqual(W.expression, { op: 'multiply', args: [{ ref: 'DE-0017.concentration' }, { op: 'subtract', args: [{ const: '1' }, { ref: 'DE-0017.loss_factor' }] }] });
  assert.deepEqual(W.rounding, { mode: 'half-even', decimals: 4 });
  assert.deepEqual(W.guards, [{ when: { 'DE-0017.loss_factor': { gte: '1' } }, raise: 'OUT-0011' }]);
});

// ============================================================================================ F-B options and entry points
const baseOptions = (extra = {}) => ({ unitRegistry: mod('units').buildUnitRegistry(clone(REGS.uf1)), inputs: clone(ALL_INPUTS), ...extra });
const both = (fn) => {
  const F = mod('formula');
  fn((logic, options) => F.checkFormula(logic, options), 'checkFormula');
  fn((logic, options) => F.evaluateFormula(logic, {}, options), 'evaluateFormula');
};
const ONE = FX(K('1'));

check('F-B1', 'unitRegistry must be a registry built by buildUnitRegistry; options must be a mapping (INVALID_ARGUMENT) (PLAN P-08; E-0018)', () => {
  both((call) => {
    const { inputs } = baseOptions();
    for (const bad of [undefined, null, clone(REGS.uf1), { has: () => true, units: [] }, 'uf1', 5, []]) {
      expectLogicError(() => call(clone(ONE), { unitRegistry: bad, inputs }), 'INVALID_ARGUMENT');
    }
    expectLogicError(() => call(clone(ONE), { inputs }), 'INVALID_ARGUMENT');
    expectLogicError(() => call(clone(ONE), undefined), 'INVALID_ARGUMENT');
    expectLogicError(() => call(clone(ONE), null), 'INVALID_ARGUMENT');
  });
});

check('F-B2', 'inputs must be an array; [] is valid when the formula has no refs (PLAN P-08; E-0031 (1))', () => {
  both((call) => {
    const { unitRegistry } = baseOptions();
    for (const bad of [undefined, null, {}, { ref: 'x' }, 'inputs', 5]) expectLogicError(() => call(clone(ONE), { unitRegistry, inputs: bad }), 'INVALID_ARGUMENT');
    expectLogicError(() => call(FX(rf), { unitRegistry, inputs: [] }), 'UNBOUND_FIELD');
  });
  runCase(C('empty inputs, formula without refs', ONE, OK('1'), { inputs: [] }));
});

check('F-B3', 'precision: integer >= 1, else INVALID_ARGUMENT from both functions; absent/undefined accepted; 1 and 100 accepted (PLAN P-08)', () => {
  both((call) => {
    for (const bad of [0, -1, 1.5, '28', Number.NaN, null, Number.POSITIVE_INFINITY, true, {}]) {
      expectLogicError(() => call(clone(ONE), baseOptions({ precision: bad })), 'INVALID_ARGUMENT');
    }
    for (const good of [undefined, 1, 28, 100]) assert.doesNotThrow(() => call(clone(ONE), baseOptions(good === undefined ? { precision: undefined } : { precision: good })));
  });
  const F = mod('formula');
  assert.equal(F.DEFAULT_PRECISION, 28, 'DEFAULT_PRECISION (l.1955)');
  assert.equal(F.MAX_EXPRESSION_DEPTH, 1000, 'MAX_EXPRESSION_DEPTH (E-0032 (6))');
  assert.deepEqual(F.evaluateFormula(clone(ONE), {}, baseOptions({ precision: 1 })).value, { value: '1', unit: 'ratio' });
});

check('F-B4', 'values must be a mapping (INVALID_ARGUMENT) (PLAN P-08)', () => {
  const F = mod('formula');
  for (const bad of [null, undefined, [], ['x'], 'values', 5]) expectLogicError(() => F.evaluateFormula(clone(ONE), bad, baseOptions()), 'INVALID_ARGUMENT');
  assert.doesNotThrow(() => F.evaluateFormula(clone(ONE), {}, baseOptions()));
});

check('F-B5', 'binding by suffix gives the same outcome as the full-ref forms (E-0019; E-0022 D-02)', () => {
  const full = FX(rf);
  const suffix = FX({ ref: 'loss_factor' });
  const a = execCase(mod('formula'), mod('units'), REGS, C('full', full, OK('0.1'), { values: vals({ f: '0.1' }) }));
  const b = execCase(mod('formula'), mod('units'), REGS, C('suffix expr, suffix value', suffix, OK('0.1'), { values: valsBySuffix({ f: '0.1' }) }));
  const c2 = execCase(mod('formula'), mod('units'), REGS, C('suffix expr, full value', suffix, OK('0.1'), { values: vals({ f: '0.1' }) }));
  assert.deepEqual(plain(b), plain(a));
  assert.deepEqual(plain(c2), plain(a));
  assert.deepEqual(a.evaluate.value, { status: 'ok', value: { value: '0.1', unit: 'ratio' }, outcome: null, guard_index: null, diagnostics: [] });
});

// ============================================================================================ F-L3 null equals absent
check('F-L3', 'an explicit null equals an absent key for every F-L1 case (l.606; E-0031 (4))', () => {
  for (const variant of L1_NULL_VARIANTS) {
    const absentCase = C(variant.name, variant.logic, NUL, { values: variant.values });
    const withNull = { ...variant.values };
    for (const key of variant.absent) withNull[key] = null;
    const nullCase = C(variant.name, variant.logic, NUL, { values: withNull });
    const a = plain(execCase(mod('formula'), mod('units'), REGS, absentCase));
    const b = plain(execCase(mod('formula'), mod('units'), REGS, nullCase));
    assert.deepEqual(b, a, `${variant.name}: explicit null equals absent`);
    assert.deepEqual(b.evaluate.value, { status: 'ok', value: null, outcome: null, guard_index: null, diagnostics: [] });
  }
});

// ============================================================================================ F-Z extras
check('F-Zd', 'KF-E-313 diagnostic shape: pointer is the division node, remediation "añadir `guard`", rule and rule_index null, only 313 carries remediation (l.1600, l.1768)', () => {
  const F = mod('formula');
  const unit = baseOptions();
  const shape = [
    [FX(divide(rf, ref('g'))), '/expression', 'g'],
    [FX(add(rf, divide(rf, ref('g')))), '/expression/args/1', 'g'],
    [FX(iff({ flag: true }, rf, divide(rf, ref('g')))), '/expression/else', 'g'],
  ];
  for (const [logic, pointer, input] of shape) {
    const list = F.checkFormula(clone(logic), unit);
    assert.equal(list.length, 1);
    const d = list[0];
    assert.equal(d.code, 'KF-E-313');
    assert.equal(d.severity, 'E');
    assert.equal(d.pointer, pointer);
    assert.equal(d.reason, 'unprotected');
    assert.equal(d.input, `DE-0017.${input === 'g' ? 'gain' : input}`);
    assert.equal(d.remediation, REMEDIATION_313);
    assert.equal(d.rule, null);
    assert.equal(d.rule_index, null);
  }
  const zero = F.checkFormula(clone(FX(divide(rf, K('0')))), unit);
  assert.equal(zero[0].reason, 'zero_constant');
  assert.equal(zero[0].input, null);
});


// ============================================================================================ F-K1 code matrix
check('F-K1', 'each in-scope code has a positive input and a near-miss; no case yields KF-E-010/311/312 or a foreign code (l.1765-1771; E-0033)', () => {
  const F = mod('formula');
  const seen = new Set();
  for (const { code, positive, nearMiss } of K1_PAIRS) {
    runAll(`F-K1 ${code} positive`, [positive]);
    runAll(`F-K1 ${code} near-miss`, [nearMiss]);
    const pos = execCase(F, mod('units'), REGS, positive).check.value;
    const miss = execCase(F, mod('units'), REGS, nearMiss).check.value;
    assert.ok(pos.some((d) => d.code === code), `${code}: positive produces it`);
    assert.ok(!miss.some((d) => d.code === code), `${code}: near-miss does not`);
    seen.add(code);
  }
  assert.deepEqual([...seen].sort(), CODES);
  for (const never of ['KF-E-010', 'KF-E-311', 'KF-E-312']) assert.ok(!seen.has(never));
});

// ============================================================================================ F-S determinism, purity, shape, constants
const ALL_CASES = [...GROUPS.values(), ...R01_GROUPS.values()].flatMap((g) => g.cases).concat(W_GROUPS.flatMap((g) => g.cases), W5_CASES);
check('F-S2a', 'key order of every mapping (nodes, output, rounding, guards, when, inputs, values) does not change any result (PLAN F-S2; design: no iteration-order dependence)', () => {
  assert.ok(ALL_CASES.length > 300, 'the slice has hundreds of cases');
  const F = mod('formula');
  const UN = mod('units');
  for (const c of ALL_CASES) {
    const base = plain(execCase(F, UN, REGS, c));
    for (const shift of [0, 1, 2]) {
      const permuted = { ...c, logic: permuteKeys(c.logic, shift), values: permuteKeys(c.values ?? {}, shift), inputs: c.inputs ? permuteKeys(c.inputs, shift) : permuteKeys(ALL_INPUTS, shift) };
      assert.deepEqual(plain(execCase(F, UN, REGS, permuted)), base, `[${c.name}] key permutation ${shift}`);
    }
  }
});

check('F-S2b', 'a fresh child process returns byte-identical JSON for a representative set (W2, W5, G1, V4, Zn8, S1) (PLAN F-S2)', async () => {
  const inProcess = await payload(mod('formula'), mod('units'));
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const child = spawnSync(process.execPath, [path.join(DATA, 'determinism-child.mjs')], { cwd: REPO_ROOT, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, inProcess, 'byte-identical across processes');
  assert.ok(inProcess.length > 1000);
});

check('F-S3', 'purity: frozen logic, values and options are accepted and never mutated; outputs are fresh (PLAN F-S3)', () => {
  const F = mod('formula');
  const UN = mod('units');
  const logic = clone(W);
  const values = vals({ c: Q('4.2', 'pm'), f: '0.1' });
  const options = buildOptions(UN, REGS, { inputs: [ALL_INPUTS[0], ALL_INPUTS[4]] });
  const before = JSON.stringify([logic, values, options.inputs]);
  deepFreeze(logic);
  deepFreeze(values);
  const first = F.evaluateFormula(logic, values, options);
  const second = F.evaluateFormula(logic, values, options);
  assert.notEqual(first, second);
  assert.notEqual(first.value, second.value);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify([logic, values, options.inputs]), before, 'arguments unchanged');
  // unfrozen copies are also left untouched
  const live = { logic: clone(W), values: clone(values), inputs: clone(options.inputs) };
  F.evaluateFormula(live.logic, live.values, { unitRegistry: options.unitRegistry, inputs: live.inputs });
  F.checkFormula(live.logic, { unitRegistry: options.unitRegistry, inputs: live.inputs });
  assert.equal(JSON.stringify([live.logic, live.values, live.inputs]), before, 'unfrozen arguments unchanged');
});

check('F-S4', 'routing and shape: a KF- code is never thrown; a typed error code never appears in diagnostics; diagnostics carry severity E, rule null, rule_index null (PLAN routing rule; l.1600)', () => {
  const LOGIC_CODES = mod('errors').LOGIC_ERROR_CODES;
  for (const c of ALL_CASES) {
    const r = execCase(mod('formula'), mod('units'), REGS, c);
    for (const side of ['check', 'evaluate']) {
      if (r[side].thrown !== undefined) assert.ok(!r[side].thrown.startsWith('KF-'), `[${c.name}] ${side} threw a KF- code`);
    }
    const lists = [r.check.value ?? [], r.evaluate.value?.diagnostics ?? []];
    for (const list of lists) for (const d of list) assert.ok(!LOGIC_CODES.includes(d.code) && /^KF-E-3(10|13|14|15|16)$/.test(d.code), `[${c.name}] ${d.code}`);
  }
});

check('F-S5', 'constants: FORMULA_DIAGNOSTIC_CATALOG equals l.1768 and l.1771; the P011 catalog and error list are unchanged; FORMULA_ERROR_CODES (l.1765-1771; PLAN P-02; E-0036)', () => {
  const { FORMULA_DIAGNOSTIC_CATALOG, LOGIC_DIAGNOSTIC_CATALOG, makeFormulaDiagnostic, makeDiagnostic } = mod('diag');
  const { FORMULA_ERROR_CODES, LOGIC_ERROR_CODES } = mod('errors');
  assert.deepEqual(Object.keys(FORMULA_DIAGNOSTIC_CATALOG).sort(), ['KF-E-313', 'KF-E-316']);
  assert.deepEqual({ ...FORMULA_DIAGNOSTIC_CATALOG['KF-E-313'] }, { code: 'KF-E-313', severity: 'E', remediation: REMEDIATION_313 });
  assert.deepEqual({ ...FORMULA_DIAGNOSTIC_CATALOG['KF-E-316'] }, { code: 'KF-E-316', severity: 'E' });
  assert.ok(Object.isFrozen(FORMULA_DIAGNOSTIC_CATALOG));
  assert.deepEqual(Object.keys(LOGIC_DIAGNOSTIC_CATALOG).sort(), ['KF-E-310', 'KF-E-311', 'KF-E-312', 'KF-E-314', 'KF-E-315']);
  assert.deepEqual([...FORMULA_ERROR_CODES], ['DIVISION_BY_ZERO', 'INEXACT_DIVISION', 'INVALID_EXPRESSION']);
  assert.deepEqual([...LOGIC_ERROR_CODES], ['AMBIGUOUS_FIELD', 'DUPLICATE_DEFAULT', 'DUPLICATE_RULE_ID', 'EMPTY_PREDICATE', 'INVALID_ARGUMENT', 'INVALID_DECIMAL', 'INVALID_INPUT_DECLARATION', 'INVALID_RANGE', 'INVALID_TABLE', 'INVALID_UNITS', 'TYPE_MISMATCH', 'UNBOUND_FIELD', 'UNKNOWN_UNIT', 'UNSUPPORTED_INPUT_TYPE']);
  const d313 = makeFormulaDiagnostic('KF-E-313', 'm', { pointer: '/expression', reason: 'unprotected', input: null });
  assert.equal(d313.code, 'KF-E-313');
  assert.equal(d313.severity, 'E');
  assert.equal(d313.remediation, REMEDIATION_313);
  assert.equal(d313.reason, 'unprotected');
  const d316 = makeFormulaDiagnostic('KF-E-316', 'm', { pointer: '/expression', operation: 'multiply', unit: 'percent_mass^2' });
  assert.equal(d316.code, 'KF-E-316');
  assert.ok(!('remediation' in d316), 'KF-E-316 has no remediation (l.1771)');
  assert.deepEqual(makeFormulaDiagnostic('KF-E-310', 'm', { pointer: '/x' }), makeDiagnostic('KF-E-310', 'm', { pointer: '/x' }), 'other codes delegate to makeDiagnostic');
});

// ============================================================================================ F-M decimal-ops, direct
const DEC = () => mod('dec');
const D = (s) => DEC().parseDecimal(s);
const OPS = () => mod('ops');

check('F-M1', 'absDecimal (PLAN F-M1)', () => {
  for (const [input, expected] of DEC_OPS.abs) {
    const result = OPS().absDecimal(D(input));
    assert.ok(DEC().isDecimal(result), 'a branded Decimal');
    assert.equal(DEC().formatDecimal(result), expected);
  }
  for (const bad of ['1', 1, null, undefined, { unscaled: 1n, scale: 0 }]) expectLogicError(() => OPS().absDecimal(bad), 'INVALID_ARGUMENT');
});

check('F-M2', 'roundDecimal: the R1/R2 tables via formatDecimalFixed, scale === decimals, padding, argument validation (l.584; E-0032 (2))', () => {
  const { roundDecimal, formatDecimalFixed } = OPS();
  for (const [name, decimals] of [['r1', 0], ['r1b', 1], ['r2', 2]]) {
    for (const row of ROUNDING[name]) {
      ROUNDING.modes.forEach((mode, i) => {
        const result = roundDecimal(D(row[0]), { mode, decimals });
        assert.ok(DEC().isDecimal(result));
        assert.equal(result.scale, decimals, `${row[0]} ${mode}: scale`);
        assert.equal(formatDecimalFixed(result), row[i + 1], `${row[0]} ${mode} ${decimals}`);
      });
    }
  }
  for (const [value, decimals, expected] of ROUNDING.r3) {
    const result = roundDecimal(D(value), { mode: 'half-even', decimals });
    assert.equal(formatDecimalFixed(result), typeof expected === 'string' ? expected : expected.prefix + '0'.repeat(expected.zeros));
  }
  const ok = { mode: 'half-even', decimals: 2 };
  for (const bad of [{ ...ok, mode: 'half-down' }, { ...ok, decimals: -1 }, { ...ok, decimals: 1.5 }, { ...ok, decimals: '2' }, { mode: 'half-even' }, { decimals: 2 }, {}, undefined, null]) {
    expectLogicError(() => roundDecimal(D('1.005'), bad), 'INVALID_ARGUMENT');
  }
  expectLogicError(() => roundDecimal('1.005', ok), 'INVALID_ARGUMENT');
  expectLogicError(() => roundDecimal(null, ok), 'INVALID_ARGUMENT');
});

check('F-M3', 'roundDecimalSignificant (PLAN F-M3; E-0032 (3))', () => {
  const { roundDecimalSignificant } = OPS();
  for (const [input, digitCount, mode, expected] of DEC_OPS.significant) {
    const result = roundDecimalSignificant(D(input), { mode, digits: digitCount });
    assert.ok(DEC().isDecimal(result));
    assert.equal(DEC().formatDecimal(result), expected, `${input} ${digitCount} ${mode}`);
  }
  for (const bad of [0, -1, 1.5, '3', undefined, null]) expectLogicError(() => roundDecimalSignificant(D('123456'), { mode: 'half-even', digits: bad }), 'INVALID_ARGUMENT');
  expectLogicError(() => roundDecimalSignificant(D('123456'), { mode: 'half-down', digits: 3 }), 'INVALID_ARGUMENT');
  expectLogicError(() => roundDecimalSignificant('123456', { mode: 'half-even', digits: 3 }), 'INVALID_ARGUMENT');
});

check('F-M4', 'divideDecimal: exact flag, significant-digit rounding by mode, DIVISION_BY_ZERO, argument validation (E-0032 (3), (5); E-0036 (3))', () => {
  const { divideDecimal } = OPS();
  for (const [a, b, precision, mode, exact, expected] of DEC_OPS.divide) {
    const options = mode === null ? { precision } : { precision, mode };
    const result = divideDecimal(D(a), D(b), options);
    assert.equal(result.exact, exact, `${a}/${b} p${precision} ${mode}: exact`);
    if (expected === null) assert.equal(result.value, null, `${a}/${b} p${precision}: value null`);
    else {
      assert.ok(DEC().isDecimal(result.value));
      assert.equal(DEC().formatDecimal(result.value), expected, `${a}/${b} p${precision} ${mode}`);
    }
  }
  const one = D('1');
  for (const [a, b] of [['1', '0'], ['0', '0'], ['5', '-0'], ['5', '0.000']]) expectLogicError(() => divideDecimal(D(a), D(b), { precision: 28 }), 'DIVISION_BY_ZERO');
  for (const bad of [0, -1, 1.5, '28', Number.NaN, undefined]) expectLogicError(() => divideDecimal(one, D('3'), { precision: bad }), 'INVALID_ARGUMENT');
  expectLogicError(() => divideDecimal(one, D('3'), undefined), 'INVALID_ARGUMENT');
  expectLogicError(() => divideDecimal(one, D('3')), 'INVALID_ARGUMENT');
  expectLogicError(() => divideDecimal(one, D('3'), { precision: 28, mode: 'half-down' }), 'INVALID_ARGUMENT');
  expectLogicError(() => divideDecimal('1', D('3'), { precision: 28 }), 'INVALID_ARGUMENT');
  expectLogicError(() => divideDecimal(one, 3, { precision: 28 }), 'INVALID_ARGUMENT');
  assert.equal(OPS().divideDecimal(D('10000000000000000000000000000000'), D('1'), { precision: 28 }).exact, true, '10^31 / 1 is exact: trailing zeros are not significant (E-0036 (3))');
});

check('F-M5', 'formatDecimalFixed: exactly scale fraction digits, never a negative zero (PLAN F-M5)', () => {
  for (const [input, expected] of DEC_OPS.fixed) assert.equal(OPS().formatDecimalFixed(D(input)), expected);
  expectLogicError(() => OPS().formatDecimalFixed('1.0'), 'INVALID_ARGUMENT');
});

// ============================================================================================ F-N depth and size
check('F-N1', 'depth: 500 nested nodes evaluate and check clean; 1100 are INVALID_EXPRESSION from both functions, never a RangeError (E-0032 (6); PLAN N-07)', () => {
  const F = mod('formula');
  const options = baseOptions();
  const addChain = (depth) => {
    let node = rf;
    for (let i = 0; i < depth; i += 1) node = { op: 'add', args: [node, { const: '1' }] };
    return FX(node);
  };
  const ifChain = (depth) => {
    let node = rf;
    for (let i = 0; i < depth; i += 1) node = { op: 'if', cond: { flag: true }, then: node, else: { const: '0' } };
    return FX(node);
  };
  assert.deepEqual(F.checkFormula(addChain(500), options), []);
  assert.deepEqual(F.evaluateFormula(addChain(500), vals({ f: '0' }), options).value, { value: '500', unit: 'ratio' });
  assert.deepEqual(F.checkFormula(ifChain(600), options), []);
  assert.deepEqual(F.evaluateFormula(ifChain(600), vals({ f: '7', b: true }), options).value, { value: '7', unit: 'ratio' });
  for (const [name, logic] of [['add chain 1100', addChain(1100)], ['if chain 1100', ifChain(1100)]]) {
    for (const call of [() => F.checkFormula(logic, options), () => F.evaluateFormula(logic, vals({ f: '0', b: true }), options)]) {
      let caught = null;
      try {
        call();
      } catch (error) {
        caught = error;
      }
      assert.ok(caught && !(caught instanceof RangeError), `${name}: no RangeError (${caught?.name})`);
      assertLogicError(caught, 'INVALID_EXPRESSION');
    }
  }
});

check('F-N2', 'width: add, min and max with 5,000 arguments are folded without blowup (E-0033; PLAN N2)', () => {
  const F = mod('formula');
  const options = baseOptions();
  const ones = Array.from({ length: 5000 }, () => K('1'));
  const t0 = performance.now();
  assert.deepEqual(F.evaluateFormula(FX({ op: 'add', args: ones }), {}, options).value, { value: '5000', unit: 'ratio' });
  assert.deepEqual(F.evaluateFormula(FX({ op: 'add', args: [rf, ...ones] }), vals({ f: '0' }), options).value, { value: '5000', unit: 'ratio' });
  assert.deepEqual(F.evaluateFormula(FX({ op: 'min', args: ones }), {}, options).value, { value: '1', unit: 'ratio' });
  assert.deepEqual(F.evaluateFormula(FX({ op: 'max', args: ones }), {}, options).value, { value: '1', unit: 'ratio' });
  assert.deepEqual(F.checkFormula(FX({ op: 'multiply', args: ones }), options), []);
  assert.ok(performance.now() - t0 < 5000, 'within 5 s');
});

check('F-N3', 'digits: 2,000-digit constants multiply exactly; a 5,000-digit constant round-trips (l.582; PLAN N3)', () => {
  const F = mod('formula');
  const options = baseOptions();
  const a = digits(2000, 4);
  const b = digits(2000, 7);
  const t0 = performance.now();
  assert.deepEqual(F.evaluateFormula(FX(multiply(K(a), K(b))), {}, options).value, { value: (BigInt(a) * BigInt(b)).toString(), unit: 'ratio' });
  const long = digits(5000, 3);
  assert.deepEqual(F.evaluateFormula(FX(K(long)), {}, options).value, { value: long, unit: 'ratio' });
  assert.ok(performance.now() - t0 < 5000, 'within 5 s');
});

// ============================================================================================ F-E P011 non-regression (PLAN F-E2)
const gitShow = (relative) => {
  const r = spawnSync('git', ['show', `${ENTRY_SHA}:${relative}`], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, `git show ${ENTRY_SHA}:${relative}: ${r.stderr}`);
  return r.stdout.replace(/\r\n/g, '\n');
};
const workTree = async (relative) => (await fs.readFile(path.join(REPO_ROOT, relative), 'utf8')).replace(/\r\n/g, '\n');
const gitFiles = (relative) => {
  const r = spawnSync('git', ['ls-tree', '-r', '--name-only', ENTRY_SHA, '--', relative], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.split('\n').filter(Boolean);
};
const exportNames = (source) => [...source.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z0-9_$]+)/gm)].map((m) => m[1]);

check('F-E2a', 'decimal.mjs, units.mjs, regex-re2.mjs and every P011 test/conformance file are byte-identical to the accepted P011 commit (PLAN F-E2; PLAN P-01, P-02)', async () => {
  const files = [
    'framework/engine/decimal.mjs', 'framework/engine/units.mjs', 'framework/engine/regex-re2.mjs',
    'test/p011-decimal.test.mjs', 'test/p011-units.test.mjs', 'test/p011-regex.test.mjs', 'test/p011-decision-table.test.mjs', 'test/conformance-p011-decision-table.test.mjs',
    'framework/conformance/p011-decision-table.yaml', ...gitFiles('framework/conformance/p011-decision-table'),
  ];
  assert.ok(files.length >= 18);
  for (const file of files) assert.equal(await workTree(file), gitShow(file), `${file} is byte-identical to ${ENTRY_SHA.slice(0, 7)}`);
});

check('F-E2b', 'decision-table.mjs, logic-diagnostics.mjs, logic-errors.mjs differ from the accepted P011 commit only by added lines and still export everything they exported (PLAN F-E2; PLAN P-02)', async () => {
  for (const [key, file] of [['dt', 'decision-table.mjs'], ['diag', 'logic-diagnostics.mjs'], ['errors', 'logic-errors.mjs']]) {
    const relative = `framework/engine/${file}`;
    const old = gitShow(relative).split('\n');
    const now = (await workTree(relative)).split('\n');
    let j = 0;
    for (const line of old) {
      while (j < now.length && now[j] !== line) j += 1;
      assert.ok(j < now.length, `${file}: an original line was deleted or changed: ${JSON.stringify(line.slice(0, 100))}`);
      j += 1;
    }
    const names = exportNames(gitShow(relative));
    assert.ok(names.length > 0);
    for (const name of names) assert.ok(name in mod(key), `${file} still exports ${name}`);
  }
  const extra = { dt: ['compileLogicInputs', 'compileLogicPredicate', 'typeLogicValues', 'evaluateLogicPredicate'], diag: ['FORMULA_DIAGNOSTIC_CATALOG', 'makeFormulaDiagnostic'], errors: ['FORMULA_ERROR_CODES'] };
  for (const [key, names] of Object.entries(extra)) for (const name of names) assert.ok(name in mod(key), `${name} is appended (PLAN API contract)`);
});

check('F-E2c', 'the P011 suites (conformance and unit tests) still pass with the counts of the accepted commit: 172 + 10 + 7 + 22 + 69 (PLAN F-E2)', () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const suites = [['test/conformance-p011-decision-table.test.mjs', 172], ['test/p011-decimal.test.mjs', 10], ['test/p011-units.test.mjs', 7], ['test/p011-regex.test.mjs', 22], ['test/p011-decision-table.test.mjs', 69]];
  for (const [file, expected] of suites) {
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], { cwd: REPO_ROOT, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 });
    const field = (name) => Number((r.stdout.match(new RegExp(`^# ${name} (\\d+)`, 'm')) ?? [])[1]);
    assert.equal(r.status, 0, `${file} exits 0\n${r.stdout.slice(-2000)}`);
    assert.equal(field('tests'), expected, `${file}: test count`);
    assert.equal(field('pass'), expected, `${file}: pass count`);
    assert.equal(field('fail'), 0, `${file}: no failures`);
    assert.equal(field('todo'), 0, `${file}: no todo`);
    assert.equal(field('skipped'), 0, `${file}: no skipped`);
  }
}, 180000);

check('F-E1', 'no expected/ line, acme-formulation entity, spec-examples file, bin/, package.json, eslint.config.js or schema is added or changed by P012 (PLAN F-E1). Opt-in gate: set KF_P012_BOUNDARY=1 (a git-status check depends on the working tree of paths other phases may legitimately change, P011 F-A5 lesson); the Foreman runs it at audit time', (t) => {
  if (!process.env.KF_P012_BOUNDARY) {
    t.skip('opt-in boundary gate: run with KF_P012_BOUNDARY=1');
    return;
  }
  const status = spawnSync('git', ['status', '--porcelain', '--', 'framework/conformance/acme-formulation', 'framework/conformance/spec-examples', 'framework/conformance/expected', 'framework/schemas', 'bin', 'package.json', 'package-lock.json', 'eslint.config.js'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(status.status, 0, status.stderr);
  assert.equal(status.stdout.trim(), '', 'P012 changes none of these paths');
});

// ============================================================================================ static scans (F-P)
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const sourceOf = async (file) => stripComments(await fs.readFile(path.join(ENGINE_DIR, file), 'utf8'));
const SCANNED = ['formula.mjs', 'decimal-ops.mjs', 'decision-table.mjs', 'logic-diagnostics.mjs', 'logic-errors.mjs'];

check('F-P1', 'formula.mjs, decimal-ops.mjs and the three edited modules import only siblings of framework/engine; no dynamic import (PLAN F-P1; V-36)', async () => {
  for (const file of SCANNED) {
    const source = await sourceOf(file);
    const specs = [...source.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const spec of specs) assert.match(spec, /^\.\/[A-Za-z0-9._-]+\.mjs$/, `${file} imports ${spec}`);
    assert.doesNotMatch(source, /\bimport\s*\(/, `${file} has no dynamic import`);
  }
});

check('F-P2', 'no binary float, clock, randomness, I/O, eval or host RegExp in the new and edited modules (l.582, l.612, l.638; PLAN F-P2; V-36)', async () => {
  const banned = [/\bparseFloat\b/, /\btoFixed\b/, /\btoPrecision\b/, /Math\.random/, /\bDate\b/, /\bperformance\b/, /process\.env/, /\bcrypto\b/, /\breadFile\b/, /\bsetTimeout\b/, /\bsetInterval\b/, /\brequire\(/, /\beval\(/, /new\s+Function/];
  for (const file of SCANNED) {
    const source = await sourceOf(file);
    for (const pattern of banned) assert.doesNotMatch(source, pattern, `${file} contains ${pattern}`);
  }
  for (const file of ['decimal-ops.mjs', 'formula.mjs']) {
    const source = await sourceOf(file);
    for (const pattern of [/\bNumber\(/, /\bparseInt\b/, /\bMath\./]) assert.doesNotMatch(source, pattern, `${file} contains ${pattern}`);
  }
  for (const file of ['formula.mjs', 'decimal-ops.mjs', 'decision-table.mjs']) {
    const source = await sourceOf(file);
    for (const pattern of [/new\s+RegExp/, /\bRegExp\(/, /\.match\(/, /\.exec\(/, /\.test\(/]) assert.doesNotMatch(source, pattern, `${file} contains ${pattern}`);
  }
});

// ============================================================================================ audit R01 remediation: D01 sparse arrays
// Holes cannot be written in JSON/YAML data and `clone` would turn them into null, so these arrays are built here and passed
// to the public API as they are. Expected (AUDIT_R01 D01; E-0033 "a malformed node is INVALID_EXPRESSION"; typed errors are the
// failure channel, E-0014 / E-0022 D-01): LogicError INVALID_EXPRESSION from checkFormula AND evaluateFormula, never a TypeError.
const holes = (length, fill = {}) => {
  const list = new Array(length);
  for (const [index, value] of Object.entries(fill)) list[Number(index)] = value;
  return list;
};
const SPARSE_X = { loss_factor: { eq: '1' } };
const sparseGuard = (when) => ({ ...FX(rf), guards: [{ when, raise: 'OUT-0001' }] });
const sparseCond = (cond) => FX(iff(cond, rf, ref('g')));
const SPARSE_SHAPES = [
  ['{all: [hole, x]}', () => ({ all: holes(2, { 1: SPARSE_X }) })],
  ['{all: [x, hole]}', () => ({ all: holes(2, { 0: SPARSE_X }) })],
  ['{any: new Array(2)}', () => ({ any: holes(2) })],
  ['{all: new Array(1)}', () => ({ all: holes(1) })],
  ['{any: [x, hole, x]}', () => ({ any: holes(3, { 0: SPARSE_X, 2: SPARSE_X }) })],
  ['{all: [{any: new Array(2)}]}', () => ({ all: [{ any: holes(2) }] })],
  ['{not: {all: [hole, x]}}', () => ({ not: { all: holes(2, { 1: SPARSE_X }) } })],
];
check('F-RM-D01', 'sparse predicate arrays ({all: [ , x]}, {any: new Array(2)}, also inside an if cond) are LogicError INVALID_EXPRESSION from check and evaluate, never a raw TypeError (E-0033; E-0014; AUDIT_R01 D01)', () => {
  const F = mod('formula');
  const options = baseOptions();
  for (const [name, make] of SPARSE_SHAPES) {
    for (const [where, build] of [['guard', () => sparseGuard(make())], ['if cond', () => sparseCond(make())]]) {
      for (const [fn, call] of [['checkFormula', (logic) => F.checkFormula(logic, options)], ['evaluateFormula', (logic) => F.evaluateFormula(logic, vals({ f: '1', g: '2', b: true }), options)]]) {
        let caught = null;
        try {
          call(build());
        } catch (error) {
          caught = error;
        }
        assert.ok(!(caught instanceof TypeError), `${name} in a ${where} via ${fn}: no raw TypeError (${caught?.message})`);
        try {
          assertLogicError(caught, 'INVALID_EXPRESSION');
        } catch (error) {
          error.message = `[${name} in a ${where} via ${fn}] ${error.message}`;
          throw error;
        }
      }
    }
  }
  // near-miss: the same shapes without holes are accepted
  assert.deepEqual(F.checkFormula(sparseGuard({ all: [SPARSE_X, SPARSE_X] }), options), []);
  assert.deepEqual(F.checkFormula(sparseCond({ any: [SPARSE_X, SPARSE_X] }), options), []);
});

check('F-RM-D01b', 'a sparse args list of an operator is a malformed node: INVALID_EXPRESSION from check and evaluate, never a raw TypeError (E-0033 "args containing 1, null, ..."; AUDIT_R01 D01 neighbour)', () => {
  const F = mod('formula');
  const options = baseOptions();
  const shapes = [
    ['{op: add, args: new Array(2)}', () => ({ op: 'add', args: holes(2) })],
    ['{op: add, args: [hole, 1]}', () => ({ op: 'add', args: holes(2, { 1: { const: '1' } }) })],
    ['{op: add, args: [f, hole]}', () => ({ op: 'add', args: holes(2, { 0: rf }) })],
    ['{op: abs, args: new Array(1)}', () => ({ op: 'abs', args: holes(1) })],
  ];
  for (const [name, make] of shapes) {
    for (const [fn, call] of [['checkFormula', (logic) => F.checkFormula(logic, options)], ['evaluateFormula', (logic) => F.evaluateFormula(logic, vals({ f: '1' }), options)]]) {
      let caught = null;
      try {
        call(FX(make()));
      } catch (error) {
        caught = error;
      }
      assert.ok(!(caught instanceof TypeError), `${name} via ${fn}: no raw TypeError (${caught?.message})`);
      try {
        assertLogicError(caught, 'INVALID_EXPRESSION');
      } catch (error) {
        error.message = `[${name} via ${fn}] ${error.message}`;
        throw error;
      }
    }
  }
});

// ============================================================================================ index coverage (runs now)
test('F-INDEX every key of the case index has at least one test, and every test key is indexed', () => {
  const indexed = new Set(Object.keys(INDEX.case_index));
  const pendingDecision = new Set(Object.entries(INDEX.case_index).filter(([, v]) => v.status === 'pending-decision').map(([k]) => k));
  const missing = [...indexed].filter((k) => !covered.has(k) && !pendingDecision.has(k));
  const unindexed = [...covered].filter((k) => !indexed.has(k));
  assert.deepEqual(missing, [], 'indexed keys without a test');
  assert.deepEqual(unindexed, [], 'tests without an index entry');
  assert.deepEqual([...pendingDecision], [], 'no assertion waits for a decision (E-0037)');
  assert.equal(INDEX.phase, 'P012');
  for (const [key, entry] of Object.entries(INDEX.case_index)) {
    assert.ok(Array.isArray(entry.cites) && entry.cites.length > 0, `${key} cites a clause, errata entry or PLAN target`);
    assert.ok(Array.isArray(entry.targets), `${key} targets`);
  }
  const targets = new Set(Object.values(INDEX.case_index).flatMap((e) => e.targets));
  for (const i of [...Array.from({ length: 36 }, (_, n) => n + 1), 38]) assert.ok(targets.has(`V-${String(i).padStart(2, '0')}`), `V-${String(i).padStart(2, '0')} is targeted by a case`);
});

test('F-INDEX-DATA the slice data loads without the engine: registries, tables, spec example (runs now)', () => {
  assert.ok(!SPEC.error, `spec example readable: ${SPEC.error?.message}`);
  assert.match(SPEC.open, /^```/);
  assert.equal(SPEC.close, '```');
  assert.equal(W.kind, 'formula');
  assert.equal(REGS.uf0.conversions.length, 0);
  assert.equal(REGS.uf1.units.length, REGS.uf0.units.length + 1);
  assert.equal(REGS.uf2.units.length, REGS.uf1.units.length + 2);
  assert.equal(ROUNDING.modes.length, 4);
  assert.ok(ALL_CASES.length > 300);
  // every group key is unique and every case has an expectation of a known kind
  for (const c of ALL_CASES) assert.ok(['ok', 'null', 'raised', 'chk', 'err', 'verr', 'throws'].includes(c.exp.kind), c.name);
});
