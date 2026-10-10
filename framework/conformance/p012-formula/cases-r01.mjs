// P012 conformance, audit R01 remediation cases (data only; no engine import). Derived ONLY from the spec, the errata
// (E-0030..E-0033, E-0036..E-0038), the PLAN (incl. "Foreman decisions after planning") and
// .strike-team/phases/P012-formula-logic/audits/AUDIT_R01.md (findings D01, T01-T07, advisory). Written before any
// remediation code, without reading formula.mjs, decimal-ops.mjs or test/p012-*.
// Case format and expectation constructors are those of cases.mjs; the runner is test/conformance-p012-formula.test.mjs.
import {
  C, CHK, D310o, D310v, D314, D316, FX, G, K, Ku, NUL, OK, Q, RAISED, THROWS, VERR,
  abs, add, clamp, divide, iff, max, min, multiply, ref, rnd, subtract, vals,
} from './builders.mjs';

export const R01_GROUPS = new Map();
const group = (key, title, cases) => {
  if (R01_GROUPS.has(key)) throw new Error(`duplicate group ${key}`);
  R01_GROUPS.set(key, { title, cases });
};
const E = 'INVALID_EXPRESSION';
const FLAG = { flag: true };
const rf = ref('f');
const rg = ref('g');
const rc = ref('c');
const rh = ref('h');
const rp = ref('p');
const rv = ref('v');
const T = 'DE-0017.third';
const rt = ref(T);
const IN_FGT = [
  { ref: 'DE-0017.loss_factor', type: 'decimal' },
  { ref: 'DE-0017.gain', type: 'decimal' },
  { ref: T, type: 'decimal' },
];
const F3 = (f, g, t) => vals({ f, g, [T]: t });
const HU0 = rnd('half-up', 0);

// ===================================================================================== T01 nested exactness (E-0032 (1))
// Each case fails if ANY nested add/subtract/multiply/min/max/abs/clamp/exact-divide result is rounded before the final rounding.
// The numbers are chosen so that rounding the nested result changes the final value.
const nest = (name, expr, values, expected, mode = HU0) => C(name, FX(expr, 'ratio', mode), OK(expected), { inputs: IN_FGT, values });
group('F-RM-T01', 'nested intermediates are exact; the logic-level rounding is applied exactly once, at the end (E-0032 (1); AUDIT_R01 T01)', [
  nest('add(multiply(f,g), t) 0.4/1/0.4 half-up 0 -> 1 (0.8)', add(multiply(rf, rg), rt), F3('0.4', '1', '0.4'), '1'),
  nest('add(t, multiply(f,g)): nested multiply in the second position', add(rt, multiply(rf, rg)), F3('0.4', '1', '0.4'), '1'),
  nest('add(min(f,g), t) 0.4/1/0.4 -> 1', add(min(rf, rg), rt), F3('0.4', '1', '0.4'), '1'),
  nest('add(max(f,g), t) with f 0.4, g -1 -> 1', add(max(rf, rg), rt), F3('0.4', '-1', '0.4'), '1'),
  nest('add(abs(f), t) with f -0.4 -> 1', add(abs(rf), rt), F3('-0.4', '1', '0.4'), '1'),
  nest('add(clamp(f, 0, 1), t) with f 0.4 -> 1 (x passes through)', add(clamp(rf, K('0'), K('1')), rt), F3('0.4', '1', '0.4'), '1'),
  nest('add(clamp(f, 0.4, 1), t) with f 0 -> 1 (the lower bound is returned unrounded)', add(clamp(rf, K('0.4'), K('1')), rt), F3('0', '1', '0.4'), '1'),
  nest('add(clamp(f, 0, 0.4), t) with f 3 -> 1 (the upper bound is returned unrounded)', add(clamp(rf, K('0'), K('0.4')), rt), F3('3', '1', '0.4'), '1'),
  nest('add(divide(f, 2), t) with f 0.8: exact nested divide 0.4 -> 1', add(divide(rf, K('2')), rt), F3('0.8', '1', '0.4'), '1'),
  nest('add(subtract(f,g), t) with 0.6/0.2/0.4 -> 1', add(subtract(rf, rg), rt), F3('0.6', '0.2', '0.4'), '1'),
  nest('add(add(f,g), t) with 0.2/0.2/0.4 -> 1', add(add(rf, rg), rt), F3('0.2', '0.2', '0.4'), '1'),
  nest('multiply(add(f,g), 2) with 0.2/0.2 -> 1 (0.8)', multiply(add(rf, rg), K('2')), F3('0.2', '0.2', '0'), '1'),
  nest('subtract(multiply(f,g), -0.4) with 0.4/1 -> 1', subtract(multiply(rf, rg), K('-0.4')), F3('0.4', '1', '0'), '1'),
  nest('three levels: add(add(multiply(f,g), t), 0.2) with 0.4/1/0.4 -> 1 (1.0)', add(add(multiply(rf, rg), rt), K('0.2')), F3('0.4', '1', '0.4'), '1'),
  nest('up 0: add(multiply(f,g), t) 0.4/1/0.4 -> 1 (exact 0.8 up; a rounded 0.4 -> 1 would give 1.4 -> 2)', add(multiply(rf, rg), rt), F3('0.4', '1', '0.4'), '1', rnd('up', 0)),
  nest('half-even 1: add(multiply(f,g), t) 0.04/1/0.04 -> 0.1 (a rounded 0.04 -> 0.0 would give 0.0)', add(multiply(rf, rg), rt), F3('0.04', '1', '0.04'), '0.1', rnd('half-even', 1)),
  nest('down 0: multiply(min(f,g), 5) 0.9/3 -> 4 (4.5; a rounded 0.9 -> 0 would give 0)', multiply(min(rf, rg), K('5')), F3('0.9', '3', '0'), '4', rnd('down', 0)),
  C('quantity: add(multiply(c, g), 0.4 pm) with c 0.4 pm, g 1 -> 1 pm', FX(add(multiply(rc, rg), Ku('0.4', 'pm')), 'pm', HU0), OK('1', 'pm'), { values: vals({ c: Q('0.4', 'pm'), g: '1' }) }),
  C('quantity: add(min(c, h), 0.4 pm) with c 0.4 pm, h 1 pm -> 1 pm', FX(add(min(rc, rh), Ku('0.4', 'pm')), 'pm', HU0), OK('1', 'pm'), { values: vals({ c: Q('0.4', 'pm'), h: Q('1', 'pm') }) }),
  C('quantity: add(abs(c), 0.4 pm) with c -0.4 pm -> 1 pm', FX(add(abs(rc), Ku('0.4', 'pm')), 'pm', HU0), OK('1', 'pm'), { values: vals({ c: Q('-0.4', 'pm') }) }),
  // exact nested divide followed by an inverse multiply: rounding the quotient (down 0) would lose the value.
  ...['2', '4', '5', '8', '16'].map((k) => C(`multiply(divide(f, ${k}), ${k}) with {down, 0} and f=1 -> 1 (the exact quotient is not rounded)`,
    FX(multiply(divide(rf, K(k)), K(k)), 'ratio', rnd('down', 0)), OK('1'), { values: vals({ f: '1' }) })),
  C('multiply(4, divide(f, 4)) with {down, 0} and f=1: nested divide in the second position -> 1', FX(multiply(K('4'), divide(rf, K('4'))), 'ratio', rnd('down', 0)), OK('1'), { values: vals({ f: '1' }) }),
  C('divide(divide(f, 4), 0.25) with {down, 0} and f=1 -> 1 (nested divide as numerator)', FX(divide(divide(rf, K('4')), K('0.25')), 'ratio', rnd('down', 0)), OK('1'), { values: vals({ f: '1' }) }),
]);

// ===================================================================================== T02 n-ary multiply unit fold (E-0030 (3))
const MC = (name, expr, unit, exp) => C(name, FX(expr, unit), exp);
group('F-RM-T02', 'n-ary multiply folds the unit monomial over every argument, not only the first two (E-0030 (3); E-0033 left fold; AUDIT_R01 T02)', [
  MC('multiply(c, f, p) output ratio: percent_mass * ppm_mass is no unit -> KF-E-316 at /expression', multiply(rc, rf, rp), 'ratio', CHK(D316('/expression', 'multiply', 'percent_mass*ppm_mass'))),
  MC('multiply(f, g, c) output percent_mass -> []', multiply(rf, rg, rc), 'pm', CHK()),
  MC('multiply(f, g, c) output ppm: the third argument carries percent_mass -> KF-E-310 at the output', multiply(rf, rg, rc), 'ppm', CHK(D310o('ppm', 'pm'))),
  MC('multiply(f, g, c) output ratio -> KF-E-310 at the output (found percent_mass)', multiply(rf, rg, rc), 'ratio', CHK(D310o('ratio', 'pm'))),
  MC('multiply(c, f, c) -> KF-E-316 percent_mass^2 (third argument squares the unit)', multiply(rc, rf, rc), 'pm', CHK(D316('/expression', 'multiply', 'percent_mass^2'))),
  MC('multiply(f, g, c, c) -> KF-E-316 percent_mass^2 (fourth argument)', multiply(rf, rg, rc, rc), 'pm', CHK(D316('/expression', 'multiply', 'percent_mass^2'))),
  MC('multiply(c, f, g, p) -> KF-E-316 percent_mass*ppm_mass (fourth argument)', multiply(rc, rf, rg, rp), 'ratio', CHK(D316('/expression', 'multiply', 'percent_mass*ppm_mass'))),
  MC('multiply(c, f, v) -> KF-E-316 percent_mass*percent_volume', multiply(rc, rf, rv), 'ratio', CHK(D316('/expression', 'multiply', 'percent_mass*percent_volume'))),
  MC('multiply(f, 2 pm, g) output percent_mass -> []: a unit constant in the middle', multiply(rf, Ku('2', 'pm'), rg), 'pm', CHK()),
  MC('near-miss: multiply(c, f, g) output percent_mass -> []', multiply(rc, rf, rg), 'pm', CHK()),
  MC('near-miss: multiply(c, f, 2) output percent_mass -> []', multiply(rc, rf, K('2')), 'pm', CHK()),
  MC('near-miss: multiply(f, g, 2, 3) output ratio -> []', multiply(rf, rg, K('2'), K('3')), 'ratio', CHK()),
]);

// ===================================================================================== T03 sort of supplied-value findings
const sq = (i) => ({ ref: `DE-0017.q${i}`, type: 'quantity', unit: 'percent_mass' });
const se = (i) => ({ ref: `DE-0017.e${i}`, type: 'enum', domain: ['X'] });
const twelve = (make) => Array.from({ length: 12 }, (_, i) => make(i));
const qv = (indexes) => Object.fromEntries(indexes.map((i) => [`DE-0017.q${i}`, Q('1', 'ppm')]));
const ev = (indexes) => Object.fromEntries(indexes.map((i) => [`DE-0017.e${i}`, 'W']));
const qd = (i) => D310v(`/inputs/${i}`, `DE-0017.q${i}`, 'pm', 'ppm');
const ed = (i) => D314(`/inputs/${i}`, `DE-0017.e${i}`, 'W', 'value');
const ENUM_IN = { ref: 'DE-0017.material_type', type: 'enum', domain: ['X', 'Y', 'Z'] };
const QTY_IN = { ref: 'DE-0017.concentration', type: 'quantity', unit: 'percent_mass' };
const EQ_VALUES = { 'DE-0017.material_type': 'W', 'DE-0017.concentration': Q('1', 'ppm') };
group('F-RM-T03', 'supplied-value findings are sorted by (code, pointer, message) in UTF-8 byte order, not by inputs[] order (PLAN "Diagnostic sort key ... applied to every returned list"; V-30; AUDIT_R01 T03)', [
  C('inputs [enum e, quantity q], e out of domain, q wrong unit -> [KF-E-310 /inputs/1, KF-E-314 /inputs/0]', FX(K('1')),
    VERR(D310v('/inputs/1', 'DE-0017.concentration', 'pm', 'ppm'), D314('/inputs/0', 'DE-0017.material_type', 'W', 'value')),
    { inputs: [ENUM_IN, QTY_IN], values: EQ_VALUES }),
  C('near-miss: inputs [quantity q, enum e] -> [KF-E-310 /inputs/0, KF-E-314 /inputs/1] (code order and input order agree)', FX(K('1')),
    VERR(D310v('/inputs/0', 'DE-0017.concentration', 'pm', 'ppm'), D314('/inputs/1', 'DE-0017.material_type', 'W', 'value')),
    { inputs: [QTY_IN, ENUM_IN], values: EQ_VALUES }),
  C('12 quantity inputs, wrong units at 2 and 10: /inputs/10 sorts before /inputs/2 (byte order)', FX(K('1')), VERR(qd(10), qd(2)), { inputs: twelve(sq), values: qv([2, 10]) }),
  C('12 quantity inputs, wrong units at 1, 2, 10, 11: [/inputs/1, /inputs/10, /inputs/11, /inputs/2]', FX(K('1')), VERR(qd(1), qd(10), qd(11), qd(2)), { inputs: twelve(sq), values: qv([2, 11, 1, 10]) }),
  C('12 enum inputs, out of domain at 2 and 10 -> [KF-E-314 /inputs/10, KF-E-314 /inputs/2]', FX(K('1')), VERR(ed(10), ed(2)), { inputs: twelve(se), values: ev([2, 10]) }),
  C('12 mixed inputs: 310 at 9 and 10, 314 at 2 -> [310 /inputs/10, 310 /inputs/9, 314 /inputs/2] (code first, then pointer bytes)', FX(K('1')),
    VERR(qd(10), qd(9), D314('/inputs/2', 'DE-0017.e2', 'W', 'value')),
    { inputs: twelve((i) => (i === 2 ? se(i) : sq(i))), values: { ...qv([9, 10]), ...ev([2]) } }),
]);

// ===================================================================================== T04 unit text byte order
const ZIN = { ref: 'DE-0017.zz', type: 'quantity', unit: 'Zeta' };
const AIN = { ref: 'DE-0017.aa', type: 'quantity', unit: 'alpha' };
const BIN = { ref: 'DE-0017.bb', type: 'quantity', unit: 'beta' };
const rz = ref('DE-0017.zz');
const ra = ref('DE-0017.aa');
const rb = ref('DE-0017.bb');
const ZC = (name, expr, exp, unit = 'Zeta') => C(name, FX(expr, unit), exp, { registry: 'ufz', inputs: [ZIN, AIN, BIN] });
group('F-RM-T04', 'unit text sorts factors by unit id in UTF-8 byte order ("Zeta" < "alpha" < "beta"), not by locale (PLAN "Unit text"; determinism constraint; AUDIT_R01 T04)', [
  ZC('multiply(Zeta, alpha) -> unit text Zeta*alpha', multiply(rz, ra), CHK(D316('/expression', 'multiply', 'Zeta*alpha'))),
  ZC('multiply(alpha, Zeta) -> Zeta*alpha (argument order is irrelevant)', multiply(ra, rz), CHK(D316('/expression', 'multiply', 'Zeta*alpha'))),
  ZC('divide(Zeta, 2 alpha) -> Zeta*alpha^-1 (constant divisor: protected, E-0032 (4a))', divide(rz, Ku('2', 'alpha')), CHK(D316('/expression', 'divide', 'Zeta*alpha^-1'))),
  ZC('divide(alpha, 2 Zeta) -> Zeta^-1*alpha (constant divisor)', divide(ra, Ku('2', 'Zeta')), CHK(D316('/expression', 'divide', 'Zeta^-1*alpha'))),
  ZC('multiply(Zeta, alpha, beta) -> Zeta*alpha*beta', multiply(rz, ra, rb), CHK(D316('/expression', 'multiply', 'Zeta*alpha*beta'))),
  ZC('multiply(beta, alpha, Zeta) -> Zeta*alpha*beta', multiply(rb, ra, rz), CHK(D316('/expression', 'multiply', 'Zeta*alpha*beta'))),
  ZC('near-miss: divide(Zeta, 2 Zeta) is dimensionless, output ratio -> []', divide(rz, Ku('2', 'Zeta')), CHK(), 'ratio'),
  ZC('near-miss: multiply(Zeta, 2) output Zeta -> []', multiply(rz, K('2')), CHK()),
]);

// ===================================================================================== T05 if with an unknown-unit branch (E-0037 (2))
const U316 = (pointer) => D316(pointer, 'multiply', 'percent_mass^2');
group('F-RM-T05', 'if with an unknown-unit branch: the unknown branch is ignored by the identity check, the known branch is the result, the output check still runs (E-0036 (1); E-0037 (2); AUDIT_R01 T05)', [
  // Sorted by (code, pointer): KF-E-310 precedes KF-E-316 (the audit text lists them in the other order; the PLAN sort key governs).
  C('if(C; multiply(c,c); c) output ratio -> KF-E-310 @/output/unit (found percent_mass) and KF-E-316 @/expression/then', FX(iff(FLAG, multiply(rc, rc), rc), 'ratio'), CHK(D310o('ratio', 'pm'), U316('/expression/then'))),
  C('if(C; c; multiply(c,c)) output ratio -> KF-E-310 @/output/unit and KF-E-316 @/expression/else', FX(iff(FLAG, rc, multiply(rc, rc)), 'ratio'), CHK(D310o('ratio', 'pm'), U316('/expression/else'))),
  C('if(C; multiply(c,c); c) output percent_mass -> only KF-E-316 @/expression/then (no KF-E-310 at else)', FX(iff(FLAG, multiply(rc, rc), rc), 'pm'), CHK(U316('/expression/then'))),
  C('if(C; multiply(c,c); p) output ppm_mass -> only KF-E-316 (the known branch is the reference)', FX(iff(FLAG, multiply(rc, rc), rp), 'ppm'), CHK(U316('/expression/then'))),
  C('if(C; multiply(c,c); p) output percent_mass -> KF-E-310 @/output/unit (expected percent_mass, found ppm_mass) and KF-E-316', FX(iff(FLAG, multiply(rc, rc), rp), 'pm'), CHK(D310o('pm', 'ppm'), U316('/expression/then'))),
  C('if(C; multiply(c,c); multiply(c,c)) output ratio: both unknown -> two KF-E-316, output check skipped', FX(iff(FLAG, multiply(rc, rc), multiply(rc, rc)), 'ratio'), CHK(U316('/expression/else'), U316('/expression/then'))),
  C('nested: if(C; if(C; multiply(c,c); c); c) output ratio -> KF-E-310 output and KF-E-316 @/expression/then/then', FX(iff(FLAG, iff(FLAG, multiply(rc, rc), rc), rc), 'ratio'), CHK(D310o('ratio', 'pm'), U316('/expression/then/then'))),
  C('near-miss: if(C; multiply(c,f); c) output percent_mass -> []', FX(iff(FLAG, multiply(rc, rf), rc), 'pm'), CHK()),
]);

// ===================================================================================== T06 depth boundary (E-0032 (6); E-0038 (2))
// "The root expression node has depth 1. A tree of depth 1000 is accepted; depth 1001 is INVALID_EXPRESSION." Leaves are nodes:
// a chain of n operator nodes above one leaf has depth n + 1.
const chain = (operators, wrap, leaf = rf) => {
  let node = leaf;
  for (let i = 0; i < operators; i += 1) node = wrap(node);
  return node;
};
const addFirst = (node) => add(node, K('1'));
const addSecond = (node) => add(K('1'), node);
const ifThen = (node) => iff(FLAG, node, K('0'));
const ifElse = (node) => iff(FLAG, K('0'), node);
const absChain = (node) => abs(node);
group('F-RM-T06', 'expression depth: the root is depth 1, depth 1000 is accepted, depth 1001 is INVALID_EXPRESSION from check and evaluate (E-0032 (6); E-0038 (2); AUDIT_R01 T06)', [
  C('depth 1000: add chain, deep argument first (999 add nodes + 1 leaf)', FX(chain(999, addFirst)), OK('999'), { values: vals({ f: '0' }) }),
  C('depth 1000: add chain, deep argument second', FX(chain(999, addSecond)), OK('999'), { values: vals({ f: '0' }) }),
  C('depth 1000: if chain in then', FX(chain(999, ifThen)), OK('7'), { values: vals({ f: '7', b: true }) }),
  C('depth 1000: if chain in else', FX(chain(999, ifElse)), OK('7'), { values: vals({ f: '7', b: false }) }),
  C('depth 1000: abs chain', FX(chain(999, absChain)), OK('7'), { values: vals({ f: '-7' }) }),
  C('depth 1000: a constant leaf', FX(chain(999, addFirst, K('0'))), OK('999')),
  C('depth 1001: add chain, deep argument first -> INVALID_EXPRESSION', FX(chain(1000, addFirst)), THROWS(E), { values: vals({ f: '0' }) }),
  C('depth 1001: add chain, deep argument second -> INVALID_EXPRESSION', FX(chain(1000, addSecond)), THROWS(E), { values: vals({ f: '0' }) }),
  C('depth 1001: if chain in then -> INVALID_EXPRESSION', FX(chain(1000, ifThen)), THROWS(E), { values: vals({ f: '7', b: true }) }),
  C('depth 1001: if chain in else -> INVALID_EXPRESSION', FX(chain(1000, ifElse)), THROWS(E), { values: vals({ f: '7', b: false }) }),
  C('depth 1001: abs chain -> INVALID_EXPRESSION', FX(chain(1000, absChain)), THROWS(E), { values: vals({ f: '-7' }) }),
  C('depth 1001: a constant leaf -> INVALID_EXPRESSION', FX(chain(1000, addFirst, K('0'))), THROWS(E)),
  C('depth 1001 in a side branch of a shallow root: add(f, chain) -> INVALID_EXPRESSION', FX(add(rf, chain(999, addFirst))), THROWS(E), { values: vals({ f: '0' }) }),
  C('depth 1000 in a side branch of a shallow root: add(f, chain) -> accepted', FX(add(rf, chain(998, addFirst))), OK('998'), { values: vals({ f: '0' }) }),
  C('near-miss: depth 2 (root add with two leaves)', FX(add(rf, K('1'))), OK('1'), { values: vals({ f: '0' }) }),
]);

// ===================================================================================== T07 raise lower bound (PLAN P-10)
const withRaise = (raise) => ({ ...FX(rf), guards: [{ when: { loss_factor: { gte: '1' } }, raise }] });
group('F-RM-T07', 'raise matches ^OUT-[0-9]{4,}$: three digits and "OUT-0" are INVALID_EXPRESSION, four digits are accepted (PLAN P-10; schema pattern; AUDIT_R01 T07)', [
  ...['OUT-123', 'OUT-0', 'OUT-1', 'OUT-12', 'OUT-000', 'OUT-', 'OUT'].map((raise) => C(`raise ${JSON.stringify(raise)} -> INVALID_EXPRESSION`, withRaise(raise), THROWS(E))),
  ...['OUT-1234', 'OUT-0000', 'OUT-00001', 'OUT-12345678901234567890'].map((raise) => C(`near-miss: raise ${JSON.stringify(raise)} accepted`, withRaise(raise), CHK())),
  C('raise OUT-1234 is raised by a true guard', FX(rf, 'ratio', { guards: [G({ loss_factor: { gte: '1' } }, 'OUT-1234')] }), RAISED('OUT-1234', 0), { values: vals({ f: '1' }) }),
]);

// ===================================================================================== D01 JSON-expressible malformed predicate arrays
// Sparse arrays (holes) cannot be expressed in JSON data; they are tested by F-RM-D01 / F-RM-D01b in the runner.
// Here: the JSON-expressible neighbours (a null element) -> INVALID_EXPRESSION (E-0033 "malformed node").
const X1 = { loss_factor: { eq: '1' } };
const guarded = (when) => ({ ...FX(rf), guards: [{ when, raise: 'OUT-0001' }] });
group('F-RM-D01c', 'null elements in predicate arrays are a malformed node -> INVALID_EXPRESSION, never a raw TypeError (E-0033; AUDIT_R01 D01)', [
  C('guard {all: [null, x]}', guarded({ all: [null, X1] }), THROWS(E)),
  C('guard {all: [x, null]}', guarded({ all: [X1, null] }), THROWS(E)),
  C('guard {any: [null, null]}', guarded({ any: [null, null] }), THROWS(E)),
  C('guard {all: [{any: [null]}]}', guarded({ all: [{ any: [null] }] }), THROWS(E)),
  C('if cond {all: [null, x]}', FX(iff({ all: [null, X1] }, rf, rg)), THROWS(E)),
  C('if cond {any: [x, null]}', FX(iff({ any: [X1, null] }, rf, rg)), THROWS(E)),
  C('near-miss: guard {all: [x, x]}', guarded({ all: [X1, X1] }), CHK()),
  C('near-miss: if cond {any: [x, x]}', FX(iff({ any: [X1, X1] }, rf, rg)), CHK()),
]);

// ===================================================================================== E-0038 (1), (3)
const CL = (lo, hi) => clamp(rf, K(lo), K(hi));
group('F-RM-E38a', 'clamp with a null x still raises INVALID_RANGE when lo > hi (E-0038 (1), (3)); null otherwise', [
  C('clamp(f, 2, 1) with f absent -> INVALID_RANGE (evaluation only; check is clean)', FX(CL('2', '1')), THROWS('INVALID_RANGE', 'evaluate')),
  C('clamp(f, 2, 1) with f null -> INVALID_RANGE', FX(CL('2', '1')), THROWS('INVALID_RANGE', 'evaluate'), { values: { 'DE-0017.loss_factor': null } }),
  C('clamp(f, 2, 1) with a rounding block and f absent -> INVALID_RANGE', FX(CL('2', '1'), 'ratio', rnd('half-up', 2)), THROWS('INVALID_RANGE', 'evaluate')),
  C('add(clamp(f, 2, 1), 1) with f absent: the defect inside a nested operand is raised', FX(add(CL('2', '1'), K('1'))), THROWS('INVALID_RANGE', 'evaluate')),
  C('add(g, clamp(f, 2, 1)) with g and f absent', FX(add(rg, CL('2', '1'))), THROWS('INVALID_RANGE', 'evaluate')),
  C('quantity: clamp(c, 2 pm, 1 pm) with c absent -> INVALID_RANGE', FX(clamp(rc, Ku('2', 'pm'), Ku('1', 'pm')), 'pm'), THROWS('INVALID_RANGE', 'evaluate')),
  C('non-null x: clamp(f, 2, 1) with f 5 -> INVALID_RANGE', FX(CL('2', '1')), THROWS('INVALID_RANGE', 'evaluate'), { values: vals({ f: '5' }) }),
  C('near-miss: clamp(f, 1, 2) with f absent -> null', FX(CL('1', '2')), NUL),
  C('near-miss: clamp(f, 1, 1) with f absent -> null (lo = hi)', FX(CL('1', '1')), NUL),
  C('near-miss: clamp(1, g, 0) with g absent: lo is null, no range to compare -> null', FX(clamp(K('1'), rg, K('0'))), NUL),
  C('near-miss: clamp(1, 2, g) with g absent: hi is null -> null', FX(clamp(K('1'), K('2'), rg)), NUL),
]);

const D13 = () => divide(K('1'), K('3'));
group('F-RM-E38b', 'operands are evaluated eagerly, left to right, before null propagation: an inexact division beside a null raises INEXACT_DIVISION without a rounding block; with one the result is null (E-0038 (1); E-0032 (3))', [
  C('add(g, divide(1,3)) with g absent, no rounding -> INEXACT_DIVISION (evaluation only)', FX(add(rg, D13())), THROWS('INEXACT_DIVISION', 'evaluate')),
  C('add(g, divide(1,3)) with g null -> INEXACT_DIVISION', FX(add(rg, D13())), THROWS('INEXACT_DIVISION', 'evaluate'), { values: { 'DE-0017.gain': null } }),
  C('add(divide(1,3), g): the null is the second operand', FX(add(D13(), rg)), THROWS('INEXACT_DIVISION', 'evaluate')),
  C('subtract(g, divide(1,3))', FX(subtract(rg, D13())), THROWS('INEXACT_DIVISION', 'evaluate')),
  C('multiply(g, divide(1,3))', FX(multiply(rg, D13())), THROWS('INEXACT_DIVISION', 'evaluate')),
  C('min(g, divide(1,3))', FX(min(rg, D13())), THROWS('INEXACT_DIVISION', 'evaluate')),
  C('max(divide(1,3), g)', FX(max(D13(), rg)), THROWS('INEXACT_DIVISION', 'evaluate')),
  C('quantity: multiply(c, divide(1,3)) with c absent, output percent_mass', FX(multiply(rc, D13()), 'pm'), THROWS('INEXACT_DIVISION', 'evaluate')),
  C('nested deeper: add(1, add(g, divide(1,3))) with g absent', FX(add(K('1'), add(rg, D13()))), THROWS('INEXACT_DIVISION', 'evaluate')),
  C('with a rounding block: add(g, divide(1,3)) with g absent -> ok null', FX(add(rg, D13()), 'ratio', rnd('half-up', 2)), NUL),
  C('with a rounding block: add(divide(1,3), g) with g null -> ok null', FX(add(D13(), rg), 'ratio', rnd('half-up', 2)), NUL, { values: { 'DE-0017.gain': null } }),
  C('with a rounding block: multiply(g, divide(1,3)) with g absent -> ok null', FX(multiply(rg, D13()), 'ratio', rnd('down', 0)), NUL),
  C('near-miss: add(g, divide(1,4)) is exact: ok null without a rounding block', FX(add(rg, divide(K('1'), K('4')))), NUL),
  C('near-miss: divide(g, 3) with g absent computes no quotient: ok null without a rounding block', FX(divide(rg, K('3'))), NUL),
  C('near-miss: add(g, divide(1,3)) with g present and no rounding block still raises', FX(add(rg, D13())), THROWS('INEXACT_DIVISION', 'evaluate'), { values: vals({ g: '1' }) }),
  C('if stays lazy: if(flag; g; add(g, divide(1,3))) selects then -> ok null', FX(iff(FLAG, rg, add(rg, D13()))), NUL, { values: vals({ b: true }) }),
  C('if stays lazy: if(flag; add(g, divide(1,3)); g) selects else -> ok null', FX(iff(FLAG, add(rg, D13()), rg)), NUL, { values: vals({ b: false }) }),
]);

// ===================================================================================== Advisory: extra key in output
const withOutput = (output) => ({ ...FX(rf), output });
const OUT0 = { ref: 'DE-0017.result', unit: 'ratio' };
group('F-RM-A1', 'output has exactly ref and unit: an extra key is INVALID_EXPRESSION (PLAN "Structure"; E-0033 malformed node; AUDIT_R01 advisory)', [
  C('output with an extra key "note"', withOutput({ ...OUT0, note: 'x' }), THROWS(E)),
  C('output with an extra key "symbol"', withOutput({ ...OUT0, symbol: '1' }), THROWS(E)),
  C('output with an extra key "rounding"', withOutput({ ...OUT0, rounding: { mode: 'down', decimals: 0 } }), THROWS(E)),
  C('output with an extra key set to null', withOutput({ ...OUT0, extra: null }), THROWS(E)),
  C('near-miss: output with exactly ref and unit', withOutput({ ...OUT0 }), CHK()),
]);
