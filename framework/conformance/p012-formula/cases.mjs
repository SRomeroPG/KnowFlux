// P012 conformance case tables (data only; no engine import). Every group key is a case id of the PLAN "Fixture slice"
// (F-O1 ... F-Z*, F-T, F-S ...) and is indexed in framework/conformance/p012-formula.yaml with its clause citations.
// A case = {name, logic, exp, values?, registry?, inputs?, precision?}; the runner is in
// test/conformance-p012-formula.test.mjs. Defaults: registry uf1, inputs = the nine inputs of the PLAN notation, values {}.
// Expected values are the PLAN's numbers (cross-checked with an independent BigInt oracle outside the repository).
import {
  ALL_INPUTS, C, CHK, D310l, D310o, D310v, D310x, D313, D314, D315, D316, ERR, FX, G, K, Ku, NUL, OK, Q, RAISED, THROWS, VERR,
  abs, add, clamp, divide, guards, iff, max, min, multiply, op, ref, round, rnd, subtract, vals,
} from './builders.mjs';

export const GROUPS = new Map();
const group = (key, title, cases) => {
  if (GROUPS.has(key)) throw new Error(`duplicate group ${key}`);
  GROUPS.set(key, { title, cases });
};
const FLAG = { flag: true };
const rf = ref('f');
const rg = ref('g');
const rc = ref('c');
const FV = (f, g) => vals({ f, g });
const E = 'INVALID_EXPRESSION';

// =============================================================================================== F-O operators and arity
group('F-O1', 'add: exact, left fold, one argument, quantities (l.582, l.656; E-0033; E-0017)', [
  C('0.1 + 0.2 is exactly 0.3', FX(add(rf, rg)), OK('0.3'), { values: FV('0.1', '0.2') }),
  C('2^53 + 1', FX(add(rf, rg)), OK('9007199254740993'), { values: FV('9007199254740992', '1') }),
  C('0.1 + -0.1 is "0", never "-0"', FX(add(rf, rg)), OK('0'), { values: FV('0.1', '-0.1') }),
  C('left fold of three', FX(add(rf, rg, K('0.3'))), OK('0.6'), { values: FV('0.1', '0.2') }),
  C('one argument returns it canonically', FX(add(rf)), OK('0.1'), { values: vals({ f: '0.10' }) }),
  C('quantity + unit constant keeps the unit', FX(add(rc, Ku('1', 'pm')), 'pm'), OK('5.2', 'pm'), { values: vals({ c: Q('4.2', 'pm') }) }),
]);

group('F-O2', 'subtract: exact, arity exactly 2 (E-0033)', [
  C('1 - 0.25', FX(subtract(K('1'), rf)), OK('0.75'), { values: vals({ f: '0.25' }) }),
  C('0.3 - 0.1', FX(subtract(rf, rg)), OK('0.2'), { values: FV('0.3', '0.1') }),
  C('1 - 1.000 is 0', FX(subtract(rf, rg)), OK('0'), { values: FV('1', '1.000') }),
  C('quantity - unit constant', FX(subtract(rc, Ku('1', 'pm')), 'pm'), OK('3.2', 'pm'), { values: vals({ c: Q('4.2', 'pm') }) }),
  C('arity 1', FX(subtract(rf)), THROWS(E)),
  C('arity 3', FX(subtract(rf, rg, K('1'))), THROWS(E)),
  C('arity 0', FX({ op: 'subtract', args: [] }), THROWS(E)),
]);

group('F-O3', 'multiply: exact, left fold, one argument, quantity times dimensionless (l.582; E-0033)', [
  C('1.5 * -2.5', FX(multiply(rf, rg)), OK('-3.75'), { values: FV('1.5', '-2.5') }),
  C('-0 * 5 is "0"', FX(multiply(rf, rg)), OK('0'), { values: FV('-0', '5') }),
  C('1e-6 * 1e-6', FX(multiply(rf, rg)), OK('0.000000000001'), { values: FV('0.000001', '0.000001') }),
  C('30-digit product', FX(multiply(rf, rg)), OK('121932631137021795226185032733622923332237463801111263526900'), { values: FV('123456789012345678901234567890', '987654321098765432109876543210') }),
  C('left fold of three', FX(multiply(rf, rg, K('2'))), OK('-7.5'), { values: FV('1.5', '-2.5') }),
  C('one argument canonical', FX(multiply(rf)), OK('0.5'), { values: vals({ f: '0.50' }) }),
  C('quantity * decimal', FX(multiply(rc, rf), 'pm'), OK('2.1', 'pm'), { values: vals({ c: Q('4.2', 'pm'), f: '0.5' }) }),
  C('decimal * quantity', FX(multiply(rf, rc), 'pm'), OK('2.1', 'pm'), { values: vals({ c: Q('4.2', 'pm'), f: '0.5' }) }),
]);

const EXACT_DIVISIONS = [
  ['1 / 4', divide(rf, K('4')), '1', '0.25'],
  ['10 / 4 (constants)', divide(K('10'), K('4')), null, '2.5'],
  ['6 / 3', divide(rf, K('3')), '6', '2'],
  ['0.3 / 0.1', divide(rf, K('0.1')), '0.3', '3'],
  ['-7 / 2', divide(rf, K('2')), '-7', '-3.5'],
  ['1 / -4', divide(rf, K('-4')), '1', '-0.25'],
  ['0 / 5', divide(rf, K('5')), '0', '0'],
  ['1 / 8', divide(rf, K('8')), '1', '0.125'],
  ['1 / 1024', divide(rf, K('1024')), '1', '0.0009765625'],
  ['1 / 2^40 (28 significant digits: exact at the default precision)', divide(rf, K('1099511627776')), '1', '0.0000000000009094947017729282379150390625'],
  ['28-digit integer / 10', divide(rf, K('10')), '1234567890123456789012345678', '123456789012345678901234567.8'],
];
group('F-O4', 'divide: exact quotients at the default precision 28, arity exactly 2 (E-0032 (3); E-0033)', [
  ...EXACT_DIVISIONS.map(([name, expr, f, expected]) => C(name, FX(expr), OK(expected), { values: f === null ? {} : vals({ f }) })),
  C('quantity / constant keeps the unit', FX(divide(rc, K('4')), 'pm'), OK('0.5', 'pm'), { values: vals({ c: Q('2', 'pm') }) }),
  C('quantity / same-unit constant is dimensionless', FX(divide(rc, Ku('2', 'pm'))), OK('2.5'), { values: vals({ c: Q('5', 'pm') }) }),
  C('arity 1', FX(divide(rf)), THROWS(E)),
  C('arity 3', FX(divide(rf, rg, K('1'))), THROWS(E)),
]);

group('F-O5', 'min and max: numeric order, fold, one argument, quantities (E-0033)', [
  C('min(0.5,-0.5)', FX(min(rf, rg)), OK('-0.5'), { values: FV('0.5', '-0.5') }),
  C('max(0.5,-0.5)', FX(max(rf, rg)), OK('0.5'), { values: FV('0.5', '-0.5') }),
  C('max(10, 9) is numeric, not lexical', FX(max(rf, rg)), OK('10'), { values: FV('10', '9') }),
  C('min(1.0, 1) canonical', FX(min(rf, rg)), OK('1'), { values: FV('1.0', '1') }),
  C('min of three', FX(min(rf, rg, K('-2'))), OK('-2'), { values: FV('0.5', '1') }),
  C('max of three', FX(max(rf, rg, K('2'))), OK('2'), { values: FV('0.5', '1') }),
  C('min one argument canonical', FX(min(rf)), OK('3.1'), { values: vals({ f: '3.10' }) }),
  C('min quantity', FX(min(rc, Ku('5', 'pm')), 'pm'), OK('4.2', 'pm'), { values: vals({ c: Q('4.2', 'pm') }) }),
  C('max quantity', FX(max(rc, Ku('5', 'pm')), 'pm'), OK('5', 'pm'), { values: vals({ c: Q('4.2', 'pm') }) }),
  C('min arity 0', FX({ op: 'min', args: [] }), THROWS(E)),
  C('max arity 0', FX({ op: 'max', args: [] }), THROWS(E)),
]);

group('F-O6', 'abs: one argument, keeps the unit (E-0030 (5); E-0033)', [
  C('abs(-3.50)', FX(abs(rf)), OK('3.5'), { values: vals({ f: '-3.50' }) }),
  C('abs(3.5)', FX(abs(rf)), OK('3.5'), { values: vals({ f: '3.5' }) }),
  C('abs(-0)', FX(abs(rf)), OK('0'), { values: vals({ f: '-0' }) }),
  C('abs(quantity)', FX(abs(rc), 'pm'), OK('4.2', 'pm'), { values: vals({ c: Q('-4.2', 'pm') }) }),
  C('arity 0', FX({ op: 'abs', args: [] }), THROWS(E)),
  C('arity 2', FX(abs(rf, rg)), THROWS(E)),
]);

group('F-O7', 'clamp(x, lo, hi): inclusive bounds, lo > hi is INVALID_RANGE at evaluation only (E-0033)', [
  ...[['1.5', '1'], ['-0.2', '0'], ['0.5', '0.5'], ['1', '1'], ['0', '0']].map(([f, r]) => C(`clamp(${f}, 0, 1)`, FX(clamp(rf, K('0'), K('1'))), OK(r), { values: vals({ f }) })),
  C('clamp quantity', FX(clamp(rc, Ku('0', 'pm'), Ku('5', 'pm')), 'pm'), OK('5', 'pm'), { values: vals({ c: Q('7', 'pm') }) }),
  C('clamp with lo = hi', FX(clamp(rf, K('1'), K('1'))), OK('1'), { values: vals({ f: '3' }) }),
  C('lo > hi: check is clean, evaluation throws', FX(clamp(rf, K('1'), K('0'))), THROWS('INVALID_RANGE', 'evaluate'), { values: vals({ f: '0.5' }) }),
  C('arity 2', FX(clamp(rf, K('0'))), THROWS(E)),
  C('arity 4', FX(clamp(rf, K('0'), K('1'), K('2'))), THROWS(E)),
]);

group('F-O8', 'leaves at the root: ref and const (l.662; E-0017)', [
  C('ref at the root canonical', FX(rf), OK('4.2'), { values: vals({ f: '4.20' }) }),
  C('const -0 at the root', FX(K('-0')), OK('0')),
  C('const 007.500 at the root', FX(K('007.500')), OK('7.5')),
  C('unit const at the root', FX(Ku('4.2', 'pm'), 'pm'), OK('4.2', 'pm')),
]);

// =============================================================================================== F-X structure and typed errors
const XB = () => FX(add(rf, rg));
const mutated = (fn) => {
  const logic = XB();
  fn(logic);
  return logic;
};
const withGuard = (guard) => ({ ...FX(rf), guards: [guard] });
const OKW = { when: { loss_factor: { gte: '1' } }, raise: 'OUT-0011' };
const x1 = [
  ['kind decision-table', mutated((l) => { l.kind = 'decision-table'; })],
  ['kind state-machine', mutated((l) => { l.kind = 'state-machine'; })],
  ['kind missing', mutated((l) => { delete l.kind; })],
  ['kind Formula (case)', mutated((l) => { l.kind = 'Formula'; })],
  ['logic null', null],
  ['logic list', [XB()]],
  ['logic string', 'formula'],
  ['expression missing', mutated((l) => { delete l.expression; })],
  ['expression is a string (l.638: no parser)', mutated((l) => { l.expression = 'DE-0017.a + DE-0017.b'; })],
  ['unknown op pow', FX(op('pow', rf, rg))],
  ['unknown op sum', FX(op('sum', rf, rg))],
  ['unknown op ADD', FX(op('ADD', rf, rg))],
  ['empty op', FX(op('', rf, rg))],
  ['empty node', FX({})],
  ['op without args', FX({ op: 'add' })],
  ['args is a string', FX({ op: 'add', args: 'x' })],
  ['args empty', FX({ op: 'add', args: [] })],
  ['args contains a number', FX({ op: 'add', args: [rf, 1] })],
  ['args contains null', FX({ op: 'add', args: [rf, null] })],
  ['args contains a string', FX({ op: 'add', args: [rf, 'x'] })],
  ['args contains a list', FX({ op: 'add', args: [rf, []] })],
  ['ref and const together', FX({ ref: 'DE-0017.loss_factor', const: '1' })],
  ['empty ref', FX({ ref: '' })],
  ['ref is a number', FX({ ref: 5 })],
  ['const with op and args', FX({ const: '1', op: 'add', args: [rf] })],
  ['if with args', FX({ op: 'if', cond: { flag: true }, then: rf, else: rg, args: [rf] })],
  ['if without else', FX({ op: 'if', cond: { flag: true }, then: rf })],
  ['if without then', FX({ op: 'if', cond: { flag: true }, else: rf })],
  ['if without cond', FX({ op: 'if', then: rf, else: rg })],
  ['if cond is a string', FX({ op: 'if', cond: 'flag', then: rf, else: rg })],
  ['output missing', mutated((l) => { delete l.output; })],
  ['output.unit missing', mutated((l) => { delete l.output.unit; })],
  ['output.unit a number', mutated((l) => { l.output.unit = 5; })],
  ['output.ref empty', mutated((l) => { l.output.ref = ''; })],
  ['guards not a list (string)', { ...FX(rf), guards: 'x' }],
  ['guards not a list (mapping)', { ...FX(rf), guards: {} }],
  ['guard without raise', withGuard({ when: { loss_factor: { gte: '1' } } })],
  ['guard without when', withGuard({ raise: 'OUT-0011' })],
  ['guard with a third key', withGuard({ ...OKW, extra: 1 })],
  ...['OUT-11', 'out-0011', 'OUT-0011 ', 'OUT-0011\n', 'OUT-00a1', 'OUT-٣٣٣٣', 5, null, '', 'OUT-', ' OUT-0011'].map((raise) => [`raise ${JSON.stringify(raise)}`, withGuard({ when: OKW.when, raise })]),
];
group('F-X1', 'INVALID_EXPRESSION: malformed logic, node, arity-adjacent shapes, output, guards, raise (l.616, l.638; E-0033; PLAN P-10)',
  x1.map(([name, logic]) => C(name, logic, THROWS(E))));
group('F-X1b', 'near-misses of F-X1: raise OUT-0011, OUT-123456, OUT-9999 are accepted (existence of the OUT entity is P007; E-0031 (2))',
  ['OUT-0011', 'OUT-123456', 'OUT-9999'].map((raise) => C(raise, withGuard({ when: OKW.when, raise }), CHK())));

group('F-X2', 'INVALID_DECIMAL: const and supplied values are decimal strings only (l.583; E-0017)', [
  ...[1, 1.5, '1,5', '1e3', '.5', '+1', null, true, '', '1.', '1 ', '١'].map((value) => C(`const ${JSON.stringify(value)}`, FX({ const: value }), THROWS('INVALID_DECIMAL'))),
  C('supplied number 0.1', FX(rf), THROWS('INVALID_DECIMAL', 'evaluate'), { values: { 'DE-0017.loss_factor': 0.1 } }),
  C('supplied "1e3"', FX(rf), THROWS('INVALID_DECIMAL', 'evaluate'), { values: vals({ f: '1e3' }) }),
  C('supplied "0,1"', FX(rf), THROWS('INVALID_DECIMAL', 'evaluate'), { values: vals({ f: '0,1' }) }),
  C('supplied quantity with a numeric value', FX(rc, 'pm'), THROWS('INVALID_DECIMAL', 'evaluate'), { values: { 'DE-0017.concentration': { value: 4.2, unit: 'percent_mass' } } }),
  C('near-miss: "-0", "007", "0.10" are valid decimal strings', FX(add(K('-0'), K('007'), K('0.10'))), OK('7.1')),
]);

group('F-X3', 'UNKNOWN_UNIT: const unit, output unit, input unit, guard literal unit (l.589-591; E-0018)', [
  C('const unit furlong', FX(Ku('1', 'furlong')), THROWS('UNKNOWN_UNIT')),
  C('output.unit furlong', FX(rf, 'furlong'), THROWS('UNKNOWN_UNIT')),
  C('output.unit bare percent has no built-in validity (l.591)', FX(rf, 'percent'), THROWS('UNKNOWN_UNIT')),
  C('options.inputs entry with unit furlong', FX(K('1')), THROWS('UNKNOWN_UNIT'), { inputs: [...ALL_INPUTS, { ref: 'DE-0017.z', type: 'quantity', unit: 'furlong' }] }),
  C('guard literal Q(1,furlong)', { ...FX(rf), guards: [G({ concentration: { gt: { value: '1', unit: 'furlong' } } })] }, THROWS('UNKNOWN_UNIT')),
  C('near-miss: declared units are accepted', { ...FX(Ku('1', 'ppm'), 'ppm'), guards: [G({ concentration: { gt: Q('1', 'pm') } })] }, CHK()),
]);

const AX = [{ ref: 'A.x', type: 'decimal' }, { ref: 'B.x', type: 'decimal' }];
group('F-X4', 'binding by full ref or suffix: UNBOUND_FIELD, AMBIGUOUS_FIELD (E-0019; E-0027 (2); E-0031 (1))', [
  C('unbound expression ref', FX({ ref: 'DE-0017.nope' }), THROWS('UNBOUND_FIELD')),
  C('unbound guard key', { ...FX(rf), guards: [G({ nope: { eq: '1' } })] }, THROWS('UNBOUND_FIELD')),
  C('unbound if condition key', FX(iff({ nope: { eq: '1' } }, rf, rg)), THROWS('UNBOUND_FIELD')),
  C('unbound supplied key', FX(rf), THROWS('UNBOUND_FIELD', 'evaluate'), { values: { nope: '1', 'DE-0017.loss_factor': '1' } }),
  C('suffix shared by two inputs is ambiguous (expression)', FX({ ref: 'x' }), THROWS('AMBIGUOUS_FIELD'), { inputs: AX }),
  C('full ref binds and evaluates', FX({ ref: 'A.x' }), OK('1'), { inputs: AX, values: { 'A.x': '1', 'B.x': '2' } }),
  C('suffix supplied key is ambiguous', FX({ ref: 'A.x' }), THROWS('AMBIGUOUS_FIELD', 'evaluate'), { inputs: AX, values: { x: '1' } }),
  C('inputs x and A.x: key x is still ambiguous (E-0027 (2))', FX({ ref: 'x' }), THROWS('AMBIGUOUS_FIELD'), { inputs: [{ ref: 'x', type: 'decimal' }, { ref: 'A.x', type: 'decimal' }] }),
  C('inputs x and A.x: A.x binds by full ref', FX({ ref: 'A.x' }), OK('3'), { inputs: [{ ref: 'x', type: 'decimal' }, { ref: 'A.x', type: 'decimal' }], values: { 'A.x': '3' } }),
  C('two supplied keys for one input', FX(rf), THROWS('AMBIGUOUS_FIELD', 'evaluate'), { values: { loss_factor: '1', 'DE-0017.loss_factor': '1' } }),
]);

group('F-X5', 'TYPE_MISMATCH: only quantity and decimal inputs are operands (E-0031 (1)); predicates accept every input type',
  [
    ...['e', 's', 'b'].flatMap((k) => [
      C(`ref(${k}) at the root`, FX(ref(k)), THROWS('TYPE_MISMATCH')),
      C(`ref(${k}) as an argument`, FX(add(rf, ref(k))), THROWS('TYPE_MISMATCH')),
      C(`ref(${k}) in an if branch`, FX(iff(FLAG, rf, ref(k))), THROWS('TYPE_MISMATCH')),
    ]),
    C('near-miss: enum, string and boolean as guard keys', { ...FX(rf), guards: [G({ material_type: 'X' }), G({ note: { matches: '^a' } }), G({ flag: true })] }, CHK()),
    C('predicate misuse: lt on an enum', { ...FX(rf), guards: [G({ material_type: { lt: 'X' } })] }, THROWS('TYPE_MISMATCH')),
    C('predicate misuse: gte on a string', { ...FX(rf), guards: [G({ note: { gte: 'a' } })] }, THROWS('TYPE_MISMATCH')),
    C('predicate misuse: gt on a boolean', { ...FX(rf), guards: [G({ flag: { gt: true } })] }, THROWS('TYPE_MISMATCH')),
    C('supplied number for a string input', FX(rf), THROWS('TYPE_MISMATCH', 'evaluate'), { values: vals({ f: '1', s: 5 }) }),
    C('supplied string for a boolean input', FX(rf), THROWS('TYPE_MISMATCH', 'evaluate'), { values: vals({ f: '1', b: 'yes' }) }),
  ]);

group('F-X6', 'EMPTY_PREDICATE in guards and if conditions (E-0019; E-0022 D-03; E-0031 (2); PLAN N-A)', [
  ...[['{}', {}], ['all: []', { all: [] }], ['any: []', { any: [] }], ['not: {}', { not: {} }], ['all: [{}]', { all: [{}] }]]
    .map(([name, when]) => C(`guard when ${name}`, { ...FX(rf), guards: [G(when)] }, THROWS('EMPTY_PREDICATE'))),
  ...[['{}', {}], ['all: []', { all: [] }]].map(([name, cond]) => C(`if cond ${name}`, FX(iff(cond, rf, rg)), THROWS('EMPTY_PREDICATE'))),
]);

group('F-X7', 'INVALID_RANGE (predicate): between with min > max (E-0019)', [
  C('guard between ["5","1"]', { ...FX(rf), guards: [G({ loss_factor: { between: ['5', '1'] } })] }, THROWS('INVALID_RANGE')),
  C('near-miss: between ["1","5"] and ["1","1"]', { ...FX(rf), guards: [G({ loss_factor: { between: ['1', '5'] } }), G({ loss_factor: { between: ['1', '1'] } })] }, CHK()),
]);

group('F-X8', 'options.inputs declarations: UNSUPPORTED_INPUT_TYPE, INVALID_INPUT_DECLARATION (E-0021; E-0031 (1))', [
  C('type date', FX(K('1')), THROWS('UNSUPPORTED_INPUT_TYPE'), { inputs: [{ ref: 'DE-0017.x', type: 'date' }] }),
  C('quantity without unit', FX(K('1')), THROWS('INVALID_INPUT_DECLARATION'), { inputs: [{ ref: 'DE-0017.x', type: 'quantity' }] }),
  C('decimal with a unit', FX(K('1')), THROWS('INVALID_INPUT_DECLARATION'), { inputs: [{ ref: 'DE-0017.x', type: 'decimal', unit: 'percent_mass' }] }),
]);

// =============================================================================================== F-U unit algebra
const OPS4 = ['add', 'subtract', 'min', 'max'];
const o4 = (name, ...args) => op(name, ...args);
group('F-U1', 'identity of add, subtract, min, max is by unit id: KF-E-310 at the offending operand (l.591, l.660; E-0030 (2))',
  OPS4.flatMap((name) => [
    C(`${name}(c, p): convertible pair is still an error`, FX(o4(name, rc, ref('p')), 'pm'), CHK(D310x('/expression/args/1', 'pm', 'ppm'))),
    C(`${name}(c, v)`, FX(o4(name, rc, ref('v')), 'pm'), CHK(D310x('/expression/args/1', 'pm', 'pv'))),
    C(`${name}(c, f): quantity with decimal`, FX(o4(name, rc, rf), 'pm'), CHK(D310x('/expression/args/1', 'pm', null))),
    C(`${name}(c, K): quantity with unitless const`, FX(o4(name, rc, K('1')), 'pm'), CHK(D310x('/expression/args/1', 'pm', null))),
    C(`${name}(c, Ku ppm)`, FX(o4(name, rc, Ku('1', 'ppm')), 'pm'), CHK(D310x('/expression/args/1', 'pm', 'ppm'))),
    C(`${name}(f, c) with output ratio`, FX(o4(name, rf, rc), 'ratio'), CHK(D310x('/expression/args/1', null, 'pm'))),
    C(`near-miss ${name}(c, h): two inputs, identical unit id`, FX(o4(name, rc, ref('h')), 'pm'), CHK()),
    C(`near-miss ${name}(c, c)`, FX(o4(name, rc, rc), 'pm'), CHK()),
    C(`near-miss ${name}(c, Ku pm)`, FX(o4(name, rc, Ku('1', 'pm')), 'pm'), CHK()),
    C(`near-miss ${name}(f, g) output ratio`, FX(o4(name, rf, rg), 'ratio'), CHK()),
    C(`near-miss ${name}(f, K) output ratio`, FX(o4(name, rf, K('1')), 'ratio'), CHK()),
  ]).concat([
    C('add(c, p, v): one finding per offender, in operand order', FX(add(rc, ref('p'), ref('v')), 'pm'), CHK(D310x('/expression/args/1', 'pm', 'ppm'), D310x('/expression/args/2', 'pm', 'pv'))),
  ]));

group('F-U2', 'identity of clamp: all three operands (l.660)', [
  C('clamp(c, h, h)', FX(clamp(rc, ref('h'), ref('h')), 'pm'), CHK()),
  C('clamp(c, h, p)', FX(clamp(rc, ref('h'), ref('p')), 'pm'), CHK(D310x('/expression/args/2', 'pm', 'ppm'))),
  C('clamp(c, p, v)', FX(clamp(rc, ref('p'), ref('v')), 'pm'), CHK(D310x('/expression/args/1', 'pm', 'ppm'), D310x('/expression/args/2', 'pm', 'pv'))),
  C('clamp(f, c, g) output ratio', FX(clamp(rf, rc, rg), 'ratio'), CHK(D310x('/expression/args/1', null, 'pm'))),
]);

group('F-U3', 'identity of the two if branches: the else branch is the offender (l.660; E-0030 (2))', [
  C('if(flag; c; h)', FX(iff(FLAG, rc, ref('h')), 'pm'), CHK()),
  C('if(flag; c; p)', FX(iff(FLAG, rc, ref('p')), 'pm'), CHK(D310x('/expression/else', 'pm', 'ppm'))),
  C('if(flag; c; f)', FX(iff(FLAG, rc, rf), 'pm'), CHK(D310x('/expression/else', 'pm', null))),
  C('nested else', FX(iff(FLAG, rc, iff(FLAG, rc, ref('p'))), 'pm'), CHK(D310x('/expression/else/else', 'pm', 'ppm'))),
]);

group('F-U4', 'admissible multiply and divide: no KF-E-316 (l.661-662; E-0030 (3))', [
  C('multiply(c, f)', FX(multiply(rc, rf), 'pm'), CHK()),
  C('multiply(f, c)', FX(multiply(rf, rc), 'pm'), CHK()),
  C('multiply(f, g)', FX(multiply(rf, rg), 'ratio'), CHK()),
  C('multiply(c, K 2)', FX(multiply(rc, K('2')), 'pm'), CHK()),
  C('multiply(multiply(c, f), g)', FX(multiply(multiply(rc, rf), rg), 'pm'), CHK()),
  C('divide(c, K 2)', FX(divide(rc, K('2')), 'pm'), CHK()),
  C('divide(f, K 2)', FX(divide(rf, K('2')), 'ratio'), CHK()),
  C('divide(c, Ku 2 pm): units cancel', FX(divide(rc, Ku('2', 'pm')), 'ratio'), CHK()),
  C('divide(Ku 1 ppm, Ku 2 ppm)', FX(divide(Ku('1', 'ppm'), Ku('2', 'ppm')), 'ratio'), CHK()),
  C('divide(divide(c, K 2), K 4)', FX(divide(divide(rc, K('2')), K('4')), 'pm'), CHK()),
  C('multiply(divide(c, Ku 2 pm), c): an intermediate dimensionless value', FX(multiply(divide(rc, Ku('2', 'pm')), rc), 'pm'), CHK()),
  C('multiply(Ku 2 ratio, f): the monomial {ratio:1} is one registered unit with exponent 1', FX(multiply(Ku('2', 'ratio'), rf), 'ratio'), CHK()),
  C('if(flag; multiply(c, f); c)', FX(iff(FLAG, multiply(rc, rf), rc), 'pm'), CHK()),
]);

group('F-U5', 'const units: a unitless const is dimensionless (l.662; E-0030 (1))', [
  C('add(c, K 1)', FX(add(rc, K('1')), 'pm'), CHK(D310x('/expression/args/1', 'pm', null))),
  C('add(f, Ku 1 pm) output ratio', FX(add(rf, Ku('1', 'pm')), 'ratio'), CHK(D310x('/expression/args/1', null, 'pm'))),
  C('add(Ku 1 ratio, f): {ratio:1} differs from {} (E-0030 (1)-(2))', FX(add(Ku('1', 'ratio'), rf), 'ratio'), CHK(D310x('/expression/args/1', 'ratio', null))),
  C('near-miss subtract(K 1, f)', FX(subtract(K('1'), rf), 'ratio'), CHK()),
]);

const U6 = (pointer, operation, unit) => D316(pointer, operation, unit);
group('F-U6', 'KF-E-316: inadmissible multiply/divide monomial, reported on that node; the engine never invents or looks up a unit (l.661, l.1771; E-0030 (3); E-0036 (1))', [
  C('multiply(c, c)', FX(multiply(rc, rc), 'pm'), CHK(U6('/expression', 'multiply', 'percent_mass^2'))),
  C('multiply(c, p): same dimension, still no unit', FX(multiply(rc, ref('p')), 'pm'), CHK(U6('/expression', 'multiply', 'percent_mass*ppm_mass'))),
  C('divide(c, Ku 2 ppm)', FX(divide(rc, Ku('2', 'ppm')), 'pm'), CHK(U6('/expression', 'divide', 'percent_mass*ppm_mass^-1'))),
  C('divide(K 1, Ku 2 pm)', FX(divide(K('1'), Ku('2', 'pm')), 'pm'), CHK(U6('/expression', 'divide', 'percent_mass^-1'))),
  C('multiply(multiply(c, f), c): the inner node is admissible', FX(multiply(multiply(rc, rf), rc), 'pm'), CHK(U6('/expression', 'multiply', 'percent_mass^2'))),
  C('add(multiply(c,c), multiply(c,c)): one finding per node, nothing from add (E-0036 (1))', FX(add(multiply(rc, rc), multiply(rc, rc)), 'pm'), CHK(U6('/expression/args/0', 'multiply', 'percent_mass^2'), U6('/expression/args/1', 'multiply', 'percent_mass^2'))),
  C('UF2 declares percent_mass_squared: multiply(c, c) is still KF-E-316', FX(multiply(rc, rc), 'pm'), CHK(U6('/expression', 'multiply', 'percent_mass^2')), { registry: 'uf2' }),
  C('UF2: dimension mass_fraction_squared is not looked up either', FX(multiply(rc, rc), 'percent_mass_squared'), CHK(U6('/expression', 'multiply', 'percent_mass^2')), { registry: 'uf2' }),
]);

group('F-U6b', 'KF-E-316 without cascade: an unknown unit reports nothing further in parents and skips the output check (E-0036 (1); PLAN D-01 option 1)', [
  C('output check skipped: output ratio', FX(multiply(rc, rc), 'ratio'), CHK(U6('/expression', 'multiply', 'percent_mass^2'))),
  C('output check skipped: output kg', FX(multiply(rc, rc), 'kg'), CHK(U6('/expression', 'multiply', 'percent_mass^2'))),
  C('parent multiply would be percent_mass^3: no second finding', FX(multiply(multiply(rc, rc), rc), 'pm'), CHK(U6('/expression/args/0', 'multiply', 'percent_mass^2'))),
  C('parent divide would cancel back to percent_mass: the node above is unknown, output ratio is not checked', FX(divide(multiply(rc, rc), Ku('2', 'pm')), 'ratio'), CHK(U6('/expression/args/0', 'multiply', 'percent_mass^2'))),
  C('add(c, multiply(c,c)): no KF-E-310 from add', FX(add(rc, multiply(rc, rc)), 'pm'), CHK(U6('/expression/args/1', 'multiply', 'percent_mass^2'))),
  C('abs(multiply(c,c))', FX(abs(multiply(rc, rc)), 'pm'), CHK(U6('/expression/args/0', 'multiply', 'percent_mass^2'))),
  C('first operand unknown: it is ignored, the first KNOWN operand is the reference (E-0037 (2)): add(multiply(c,c), p, c)', FX(add(multiply(rc, rc), ref('p'), rc), 'ppm'), CHK(D310x('/expression/args/2', 'ppm', 'pm'), U6('/expression/args/0', 'multiply', 'percent_mass^2'))),
  C('all operands unknown: two findings, unknown result, output check skipped (E-0037 (2))', FX(add(multiply(rc, rc), multiply(rc, rc)), 'ratio'), CHK(U6('/expression/args/0', 'multiply', 'percent_mass^2'), U6('/expression/args/1', 'multiply', 'percent_mass^2'))),
  C('independent defect at an independent node is still reported: add(c, multiply(c,c), p)', FX(add(rc, multiply(rc, rc), ref('p')), 'pm'), CHK(D310x('/expression/args/2', 'pm', 'ppm'), U6('/expression/args/1', 'multiply', 'percent_mass^2'))),
  C('if(flag; multiply(c,c); c)', FX(iff(FLAG, multiply(rc, rc), rc), 'pm'), CHK(U6('/expression/then', 'multiply', 'percent_mass^2'))),
  C('if(flag; c; multiply(c,c))', FX(iff(FLAG, rc, multiply(rc, rc)), 'pm'), CHK(U6('/expression/else', 'multiply', 'percent_mass^2'))),
  C('near-miss: an admissible product above the same shape reports nothing', FX(add(rc, multiply(rc, rf)), 'pm'), CHK()),
]);

const outputCases = [];
for (const [unit, spec] of [['pm', null], ['ppm', ['ppm_mass', 'percent_mass']], ['pv', ['percent_volume', 'percent_mass']], ['ratio', ['ratio', 'percent_mass']], ['kg', ['kg', 'percent_mass']]]) {
  outputCases.push(C(`computed percent_mass, output ${unit}`, FX(rc, unit), spec === null ? CHK() : CHK(D310o(spec[0], spec[1]))));
}
group('F-U7', 'output check: the computed unit must equal output.unit by id; a dimensionless value needs a registered unit with dimension dimensionless (l.663; E-0030 (4))', [
  ...outputCases,
  C('dimensionless, output ratio', FX(multiply(rf, rg), 'ratio'), CHK()),
  C('UF2 dimensionless, output pct_dimless', FX(multiply(rf, rg), 'pct_dimless'), CHK(), { registry: 'uf2' }),
  C('UF2 dimensionless, output ratio', FX(multiply(rf, rg), 'ratio'), CHK(), { registry: 'uf2' }),
  C('dimensionless, output percent_mass', FX(multiply(rf, rg), 'pm'), CHK(D310o('pm', null))),
  C('dimensionless, output kg (dimension mass)', FX(multiply(rf, rg), 'kg'), CHK(D310o('kg', null))),
  C('UF0 has no dimensionless unit: output percent_mass', FX(multiply(rf, rg), 'pm'), CHK(D310o('pm', null)), { registry: 'uf0' }),
  C('UF0: output ratio is not declared', FX(multiply(rf, rg), 'ratio'), THROWS('UNKNOWN_UNIT'), { registry: 'uf0' }),
  C('computed {ratio:1}, output ratio', FX(multiply(Ku('2', 'ratio'), rf), 'ratio'), CHK()),
  C('computed {ratio:1}, output pct_dimless (UF2)', FX(multiply(Ku('2', 'ratio'), rf), 'pct_dimless'), CHK(D310o('pct_dimless', 'ratio')), { registry: 'uf2' }),
  C('output furlong', FX(rf, 'furlong'), THROWS('UNKNOWN_UNIT')),
  C('output bare percent', FX(rf, 'percent'), THROWS('UNKNOWN_UNIT')),
]);

group('F-U8', 'abs, round, min, max, clamp keep the unit (E-0030 (5))', [
  C('abs(c), output pm', FX(abs(rc), 'pm'), CHK()),
  C('abs(c), output ppm', FX(abs(rc), 'ppm'), CHK(D310o('ppm', 'pm'))),
  C('round(c) with a rounding block', FX(round(rc), 'pm', rnd('half-even', 2)), CHK()),
  C('round(c), output ppm', FX(round(rc), 'ppm', rnd('half-even', 2)), CHK(D310o('ppm', 'pm'))),
  C('min(c, h), output ppm', FX(min(rc, ref('h')), 'ppm'), CHK(D310o('ppm', 'pm'))),
  C('max(c, h), output pm', FX(max(rc, ref('h')), 'pm'), CHK()),
  C('clamp(c, h, h), output ppm', FX(clamp(rc, ref('h'), ref('h')), 'ppm'), CHK(D310o('ppm', 'pm'))),
]);

group('F-U9', 'the unit check is static: the unselected if branch is still wrong (E-0030 (5), l.657)', [
  C('if(flag; c; f) evaluated with flag true', FX(iff(FLAG, rc, rf), 'pm'), ERR(D310x('/expression/else', 'pm', null)), { values: vals({ b: true, c: Q('1', 'pm') }) }),
]);

// =============================================================================================== F-G guards
const GR = [G({ loss_factor: { gte: '1' } }, 'OUT-0011'), G({ loss_factor: { gte: '2' } }, 'OUT-0012')];
group('F-G1', 'guards in document order, first true guard wins (E-0031 (2); l.650-652)', [
  C('f=3 raises guard 0', FX(rf, 'ratio', guards(...GR)), RAISED('OUT-0011', 0), { values: vals({ f: '3' }) }),
  C('f=1.5 raises guard 0', FX(rf, 'ratio', guards(...GR)), RAISED('OUT-0011', 0), { values: vals({ f: '1.5' }) }),
  C('f=0 evaluates the expression', FX(rf, 'ratio', guards(...GR)), OK('0'), { values: vals({ f: '0' }) }),
  C('reversed order f=3 raises guard 0 (OUT-0012)', FX(rf, 'ratio', guards(GR[1], GR[0])), RAISED('OUT-0012', 0), { values: vals({ f: '3' }) }),
  C('reversed order f=1.5 raises guard 1 (OUT-0011)', FX(rf, 'ratio', guards(GR[1], GR[0])), RAISED('OUT-0011', 1), { values: vals({ f: '1.5' }) }),
  C('reversed order f=0.5 evaluates the expression', FX(rf, 'ratio', guards(GR[1], GR[0])), OK('0.5'), { values: vals({ f: '0.5' }) }),
]);

group('F-G2', 'guards precede the expression (E-0031 (2))', [
  C('clamp lo > hi is not evaluated when a guard raises', FX(clamp(rf, K('1'), K('0')), 'ratio', guards(G({ loss_factor: { gte: '0' } }, 'OUT-0001'))), RAISED('OUT-0001', 0), { values: vals({ f: '0.5' }) }),
  C('guard false: the expression runs and throws INVALID_RANGE', FX(clamp(rf, K('1'), K('0')), 'ratio', guards(G({ loss_factor: { gte: '0' } }, 'OUT-0001'))), THROWS('INVALID_RANGE', 'evaluate'), { values: vals({ f: '-1' }) }),
]);

group('F-G3', 'raised result shape: exactly status, value null, outcome, guard_index, diagnostics [] (PLAN P-03)', [
  C('null expression with a true guard on f is still raised', FX(add(rf, rg), 'ratio', guards(G({ loss_factor: { gte: '1' } }, 'OUT-0007'))), RAISED('OUT-0007', 0), { values: vals({ f: '1' }) }),
  C('shape of a raised result', FX(rf, 'ratio', guards(G({ loss_factor: { gte: '1' } }, 'OUT-0007'))), RAISED('OUT-0007', 0), { values: vals({ f: '2' }) }),
]);

const g4 = (name, when, values, raised) => C(name, FX(K('1'), 'ratio', guards(G(when))), raised ? RAISED('OUT-0001', 0) : OK('1'), { values });
group('F-G4', 'guard predicate types and P011 semantics: enum, string, boolean, quantity, decimal, combinators, binary null logic (E-0019; E-0031 (1); l.606-607)', [
  g4('enum eq: X', { material_type: 'X' }, vals({ e: 'X' }), true),
  g4('enum eq: Y', { material_type: 'X' }, vals({ e: 'Y' }), false),
  g4('enum eq: absent', { material_type: 'X' }, {}, false),
  g4('enum in: Y', { material_type: { in: ['X', 'Y'] } }, vals({ e: 'Y' }), true),
  g4('enum in: Z', { material_type: { in: ['X', 'Y'] } }, vals({ e: 'Z' }), false),
  g4('string matches: AB12', { note: { matches: '^AB[0-9]+$' } }, vals({ s: 'AB12' }), true),
  g4('string matches: xAB12', { note: { matches: '^AB[0-9]+$' } }, vals({ s: 'xAB12' }), false),
  g4('boolean true', { flag: true }, vals({ b: true }), true),
  g4('boolean false', { flag: true }, vals({ b: false }), false),
  g4('boolean absent', { flag: true }, {}, false),
  g4('quantity gt: 5.1', { concentration: { gt: Q('5', 'pm') } }, vals({ c: Q('5.1', 'pm') }), true),
  g4('quantity gt: 5', { concentration: { gt: Q('5', 'pm') } }, vals({ c: Q('5', 'pm') }), false),
  g4('quantity gt: absent', { concentration: { gt: Q('5', 'pm') } }, {}, false),
  g4('quantity between inclusive upper bound', { concentration: { between: [Q('1', 'pm'), Q('2', 'pm')] } }, vals({ c: Q('2', 'pm') }), true),
  g4('quantity between lower bound', { concentration: { between: [Q('1', 'pm'), Q('2', 'pm')] } }, vals({ c: Q('1', 'pm') }), true),
  g4('quantity between outside', { concentration: { between: [Q('1', 'pm'), Q('2', 'pm')] } }, vals({ c: Q('2.01', 'pm') }), false),
  g4('decimal eq "0": 0.00', { loss_factor: { eq: '0' } }, vals({ f: '0.00' }), true),
  g4('decimal eq "0": -0', { loss_factor: { eq: '0' } }, vals({ f: '-0' }), true),
  g4('decimal in ["1","2.0"]: 2', { loss_factor: { in: ['1', '2.0'] } }, vals({ f: '2' }), true),
  g4('decimal in ["1","2.0"]: 3', { loss_factor: { in: ['1', '2.0'] } }, vals({ f: '3' }), false),
  g4('all: X and f>0, X and 1', { all: [{ material_type: 'X' }, { loss_factor: { gt: '0' } }] }, vals({ e: 'X', f: '1' }), true),
  g4('all: X and f>0, X and 0', { all: [{ material_type: 'X' }, { loss_factor: { gt: '0' } }] }, vals({ e: 'X', f: '0' }), false),
  g4('any: Y and f=1', { any: [{ material_type: 'X' }, { loss_factor: { gt: '0' } }] }, vals({ e: 'Y', f: '1' }), true),
  g4('any: Y and f=0', { any: [{ material_type: 'X' }, { loss_factor: { gt: '0' } }] }, vals({ e: 'Y', f: '0' }), false),
  g4('not flag with flag absent (binary logic)', { not: { flag: true } }, {}, true),
  g4('not (f eq 1) with f absent (binary logic)', { not: { loss_factor: { eq: '1' } } }, {}, true),
  g4('two keys in one mapping are a conjunction: both true', { material_type: 'X', loss_factor: { gt: '0' } }, vals({ e: 'X', f: '1' }), true),
  g4('two keys in one mapping: second false', { material_type: 'X', loss_factor: { gt: '0' } }, vals({ e: 'X', f: '0' }), false),
  g4('two keys in one mapping: first false', { material_type: 'X', loss_factor: { gt: '0' } }, vals({ e: 'Y', f: '1' }), false),
  g4('null is never matched: ne', { loss_factor: { ne: '1' } }, {}, false),
  g4('null is never matched: lt', { loss_factor: { lt: '5' } }, {}, false),
  g4('null is never matched: not_in', { loss_factor: { not_in: ['1'] } }, {}, false),
  g4('is_null true: absent', { loss_factor: { is_null: true } }, {}, true),
  g4('is_null true: explicit null', { loss_factor: { is_null: true } }, vals({ f: null }), true),
  g4('is_null true: present', { loss_factor: { is_null: true } }, vals({ f: '1' }), false),
  g4('is_null false: present', { loss_factor: { is_null: false } }, vals({ f: '1' }), true),
  g4('is_null false: absent', { loss_factor: { is_null: false } }, {}, false),
]);

const gdef = (when, exp) => C(JSON.stringify(when), { ...FX(rf), guards: [G(when)] }, exp);
const FC = 'DE-0017.concentration';
group('F-G5', 'static predicate findings in guards: KF-E-310 / 314 / 315 with exact pointers; evaluation is blocked (l.589, l.608, l.612, l.1765-1770; E-0031 (1); E-0033)', [
  gdef({ concentration: { gt: Q('5', 'ppm') } }, CHK(D310l('/guards/0/when/concentration/gt', FC, 'pm', 'ppm'))),
  gdef({ loss_factor: { gt: Q('5', 'pm') } }, CHK(D310l('/guards/0/when/loss_factor/gt', 'DE-0017.loss_factor', null, 'pm'))),
  gdef({ concentration: { gt: '5' } }, CHK(D310l('/guards/0/when/concentration/gt', FC, 'pm', null))),
  gdef({ material_type: 'W' }, CHK(D314('/guards/0/when/material_type', 'e', 'W'))),
  gdef({ material_type: { in: ['X', 'W'] } }, CHK(D314('/guards/0/when/material_type/in/1', 'e', 'W'))),
  gdef({ note: { matches: '(a)\\1' } }, CHK(D315('/guards/0/when/note/matches', '(a)\\1'))),
  C('defect in the second guard: pointer /guards/1/...', { ...FX(rf), guards: [G({ loss_factor: { eq: '0' } }), G({ material_type: 'W' })] }, CHK(D314('/guards/1/when/material_type', 'e', 'W'))),
  C('defects in both guards, sorted by pointer', { ...FX(rf), guards: [G({ note: { matches: '(a)\\1' } }), G({ concentration: { gt: Q('5', 'ppm') } })] }, CHK(D310l('/guards/1/when/concentration/gt', FC, 'pm', 'ppm'), D315('/guards/0/when/note/matches', '(a)\\1'))),
  gdef({ material_type: 'X' }, CHK()),
  gdef({ note: { matches: '^a' } }, CHK()),
  gdef({ concentration: { gt: Q('5', 'pm') } }, CHK()),
  gdef({ material_type: { eq: null } }, CHK()),
]);

group('F-G6', 'no guards: absent and [] are the same; a raise target that exists nowhere is accepted (E-0031 (2))', [
  C('guards absent', FX(add(rf, rg)), OK('3'), { values: FV('1', '2') }),
  C('guards []', { ...FX(add(rf, rg)), guards: [] }, OK('3'), { values: FV('1', '2') }),
  C('raise OUT-9999 is accepted and raised', FX(rf, 'ratio', guards(G({ loss_factor: { gte: '1' } }, 'OUT-9999'))), RAISED('OUT-9999', 0), { values: vals({ f: '1' }) }),
]);

// =============================================================================================== F-I if
const IFE = FX(iff({ material_type: 'X' }, rf, rg));
group('F-I1', 'if selection: a null condition is false, so else runs (l.606-607, l.656; E-0031 (3))', [
  C('X selects then', IFE, OK('1'), { values: vals({ e: 'X', f: '1', g: '2' }) }),
  C('Y selects else', IFE, OK('2'), { values: vals({ e: 'Y', f: '1', g: '2' }) }),
  C('absent enum selects else', IFE, OK('2'), { values: vals({ f: '1', g: '2' }) }),
  C('quantity cond: c = 4 selects then', FX(iff({ concentration: { gte: Q('4', 'pm') } }, rf, rg)), OK('1'), { values: vals({ c: Q('4', 'pm'), f: '1', g: '2' }) }),
  C('quantity cond: c = 3.9 selects else', FX(iff({ concentration: { gte: Q('4', 'pm') } }, rf, rg)), OK('2'), { values: vals({ c: Q('3.9', 'pm'), f: '1', g: '2' }) }),
  C('quantity cond: absent selects else', FX(iff({ concentration: { gte: Q('4', 'pm') } }, rf, rg)), OK('2'), { values: vals({ f: '1', g: '2' }) }),
]);

const LAZY_ELSE = FX(iff(FLAG, rf, clamp(rf, K('1'), K('0'))));
const LAZY_THEN = FX(iff(FLAG, clamp(rf, K('1'), K('0')), rf));
group('F-I2', 'if is lazy: only the selected branch is evaluated (E-0031 (3))', [
  C('then selected: the else clamp lo > hi is never evaluated', LAZY_ELSE, OK('0.5'), { values: vals({ b: true, f: '0.5' }) }),
  C('else selected: INVALID_RANGE', LAZY_ELSE, THROWS('INVALID_RANGE', 'evaluate'), { values: vals({ b: false, f: '0.5' }) }),
  C('cond null selects else: INVALID_RANGE', LAZY_ELSE, THROWS('INVALID_RANGE', 'evaluate'), { values: vals({ f: '0.5' }) }),
  C('mirror: then selected throws', LAZY_THEN, THROWS('INVALID_RANGE', 'evaluate'), { values: vals({ b: true, f: '0.5' }) }),
  C('mirror: else selected is fine', LAZY_THEN, OK('0.5'), { values: vals({ b: false, f: '0.5' }) }),
]);

group('F-I3', 'if with null: null condition is false, null is not zero, a selected null branch is null (l.606-607; E-0031 (3)-(4))', [
  C('f absent -> else', FX(iff({ loss_factor: { gt: '0' } }, K('1'), K('2'))), OK('2')),
  C('f = 0 -> else', FX(iff({ loss_factor: { gt: '0' } }, K('1'), K('2'))), OK('2'), { values: vals({ f: '0' }) }),
  C('f = 1 -> then', FX(iff({ loss_factor: { gt: '0' } }, K('1'), K('2'))), OK('1'), { values: vals({ f: '1' }) }),
  C('null is not zero: eq "0" with f absent -> else', FX(iff({ loss_factor: { eq: '0' } }, K('1'), K('2'))), OK('2')),
  C('selected branch is null', FX(iff(FLAG, rf, rg)), NUL, { values: vals({ b: true }) }),
]);

group('F-I4', 'both if branches are checked statically; condition findings (E-0030 (5); E-0031 (3); E-0032 (5))', [
  C('else unit mismatch', FX(iff(FLAG, rc, rf), 'pm'), CHK(D310x('/expression/else', 'pm', null))),
  C('else unit mismatch, evaluated with the other branch selected', FX(iff(FLAG, rc, rf), 'pm'), ERR(D310x('/expression/else', 'pm', null)), { values: vals({ b: true, c: Q('1', 'pm') }) }),
  C('unprotected division in the else branch', FX(iff(FLAG, rf, divide(rf, rg))), CHK(D313('/expression/else', 'unprotected', 'g'))),
  C('unprotected division in the unselected else, evaluated', FX(iff(FLAG, rf, divide(rf, rg))), ERR(D313('/expression/else', 'unprotected', 'g')), { values: vals({ b: true, g: '2' }) }),
  C('KF-E-316 in the then branch', FX(iff(FLAG, multiply(rc, rc), rc), 'pm'), CHK(D316('/expression/then', 'multiply', 'percent_mass^2'))),
  C('cond KF-E-314', FX(iff({ material_type: 'W' }, rf, rg)), CHK(D314('/expression/cond/material_type', 'e', 'W'))),
  C('cond KF-E-315', FX(iff({ note: { matches: '(' } }, rf, rg)), CHK(D315('/expression/cond/note/matches', '('))),
  C('cond KF-E-310', FX(iff({ concentration: { gt: Q('5', 'ppm') } }, rf, rg)), CHK(D310l('/expression/cond/concentration/gt', FC, 'pm', 'ppm'))),
  C('near-miss: in-domain cond and compilable pattern', FX(iff({ all: [{ material_type: 'X' }, { note: { matches: '^(a|b)+$' } }] }, rf, rg)), CHK()),
]);

group('F-I5', 'if structure: empty conditions, unbound key (E-0019; E-0033)', [
  C('cond {}', FX(iff({}, rf, rg)), THROWS('EMPTY_PREDICATE')),
  C('cond all: []', FX(iff({ all: [] }, rf, rg)), THROWS('EMPTY_PREDICATE')),
  C('cond key nope', FX(iff({ nope: 'X' }, rf, rg)), THROWS('UNBOUND_FIELD')),
  C('if without else', FX({ op: 'if', cond: FLAG, then: rf }), THROWS(E)),
]);

const C1 = { material_type: 'X' };
const C2 = FLAG;
const NEST = FX(iff(C1, iff(C2, rf, rg), K('0')));
group('F-I6', 'nested if: both conditions select; unit identity applies to the inner and outer if separately (E-0030 (2))', [
  C('X and flag -> inner then', NEST, OK('1'), { values: vals({ e: 'X', b: true, f: '1', g: '2' }) }),
  C('X and not flag -> inner else', NEST, OK('2'), { values: vals({ e: 'X', b: false, f: '1', g: '2' }) }),
  C('Y -> outer else', NEST, OK('0'), { values: vals({ e: 'Y', b: true, f: '1', g: '2' }) }),
  C('inner mismatch only', FX(iff(C1, iff(C2, rc, ref('p')), rc), 'pm'), CHK(D310x('/expression/then/else', 'pm', 'ppm'))),
  C('outer mismatch only', FX(iff(C1, iff(C2, rc, ref('h')), ref('p')), 'pm'), CHK(D310x('/expression/else', 'pm', 'ppm'))),
  C('inner and outer mismatch, two findings', FX(iff(C1, iff(C2, rc, ref('p')), ref('v')), 'pm'), CHK(D310x('/expression/else', 'pm', 'pv'), D310x('/expression/then/else', 'pm', 'ppm'))),
]);

// =============================================================================================== F-L null propagation
const L1_CASES = [
  ['add(f, g), g absent', FX(add(rf, rg)), vals({ f: '1' }), ['g']],
  ['add(f, g, K 1), g absent', FX(add(rf, rg, K('1'))), vals({ f: '1' }), ['g']],
  ['subtract(f, g), g absent', FX(subtract(rf, rg)), vals({ f: '1' }), ['g']],
  ['multiply(f, g), g absent', FX(multiply(rf, rg)), vals({ f: '1' }), ['g']],
  ['divide(f, K 2), f absent', FX(divide(rf, K('2'))), {}, ['f']],
  ['divide(K 1, g) with guard gain "0", g absent: null, not KF-E-313, not a raise', FX(divide(K('1'), rg), 'ratio', guards(G({ gain: '0' }))), {}, ['g']],
  ['min(f, g), g absent', FX(min(rf, rg)), vals({ f: '1' }), ['g']],
  ['max(f, g), g absent', FX(max(rf, rg)), vals({ f: '1' }), ['g']],
  ['abs(f), f absent', FX(abs(rf)), {}, ['f']],
  ['clamp(f, 0, 1), f absent', FX(clamp(rf, K('0'), K('1'))), {}, ['f']],
  ['clamp(K 0.5, f, K 1), lo absent', FX(clamp(K('0.5'), rf, K('1'))), {}, ['f']],
  ['round(f) with rounding, f absent', FX(round(rf), 'ratio', rnd('half-even', 2)), {}, ['f']],
  ['multiply(c, f), c absent (quantity)', FX(multiply(rc, rf), 'pm'), vals({ f: '0.5' }), ['c']],
];
group('F-L1', 'null propagation through every operation (l.606; E-0031 (4))', L1_CASES.map(([name, logic, values]) => C(name, logic, NUL, { values })));
export const L1_NULL_VARIANTS = L1_CASES.map(([name, logic, values, absent]) => ({ name, logic, values, absent: absent.map((k) => ({ f: 'DE-0017.loss_factor', g: 'DE-0017.gain', c: 'DE-0017.concentration' })[k]) }));
group('F-L2', 'null is not zero and not the other operand (l.606)', [
  C('add(f, g) with g absent is null, not f', FX(add(rf, rg)), NUL, { values: vals({ f: '5' }) }),
  C('multiply(f, g) with g absent is null, not 0', FX(multiply(rf, rg)), NUL, { values: vals({ f: '5' }) }),
  C('min(f, g) with g absent is null, not f', FX(min(rf, rg)), NUL, { values: vals({ f: '5' }) }),
  C('near-miss: explicit zero is a value', FX(multiply(rf, rg)), OK('0'), { values: FV('5', '0') }),
]);
group('F-L4', 'result shape of a null value; final rounding of null is null (E-0031 (4))', [
  C('ok null shape', FX(rf), NUL),
  C('rounding of null', FX(rf, 'ratio', rnd('half-even', 2)), NUL),
]);
group('F-L5', 'guards on null are false (l.607)', [
  C('eq "0" with f absent does not raise', FX(K('1'), 'ratio', guards(G({ loss_factor: { eq: '0' } }))), OK('1')),
  C('lte "0" with f absent does not raise', FX(K('1'), 'ratio', guards(G({ loss_factor: { lte: '0' } }))), OK('1')),
]);

// =============================================================================================== F-R rounding
group('F-R5', 'intermediates are exact, one final rounding (E-0032 (1))', [
  C('half-up 0: 0.4 + 0.4 = 0.8 -> 1 (not 0 + 0)', FX(add(rf, rg), 'ratio', rnd('half-up', 0)), OK('1'), { values: FV('0.4', '0.4') }),
  C('half-up 0: 1.5 * 1.5 = 2.25 -> 2', FX(multiply(rf, rg), 'ratio', rnd('half-up', 0)), OK('2'), { values: FV('1.5', '1.5') }),
  C('half-even 1: 0.04 + 0.04 = 0.08 -> 0.1', FX(add(rf, rg), 'ratio', rnd('half-even', 1)), OK('0.1'), { values: FV('0.04', '0.04') }),
]);

group('F-R6', 'round operator applies the logic-level rounding at that point, the final rounding still applies (E-0032 (1))', [
  C('round(0.25) = 0.2 (half-even), times 3 = 0.6', FX(multiply(round(rf), rg), 'ratio', rnd('half-even', 1)), OK('0.6'), { values: FV('0.25', '3') }),
  C('without round: 0.75 -> 0.8', FX(multiply(rf, rg), 'ratio', rnd('half-even', 1)), OK('0.8'), { values: FV('0.25', '3') }),
  C('half-up 0: round(0.4) + round(0.4) = 0', FX(add(round(rf), round(rg)), 'ratio', rnd('half-up', 0)), OK('0'), { values: FV('0.4', '0.4') }),
  C('half-up 0 without round: 1', FX(add(rf, rg), 'ratio', rnd('half-up', 0)), OK('1'), { values: FV('0.4', '0.4') }),
  C('half-up 1: round(2.25) = 2.3', FX(round(rf), 'ratio', rnd('half-up', 1)), OK('2.3'), { values: vals({ f: '2.25' }) }),
  C('round(round(f)) equals round(f)', FX(round(round(rf)), 'ratio', rnd('half-up', 1)), OK('2.3'), { values: vals({ f: '2.25' }) }),
  C('round of null is null', FX(round(rf), 'ratio', rnd('half-up', 1)), NUL),
  C('round keeps the unit', FX(round(rc), 'pm', rnd('half-even', 2)), OK('4.26', 'pm'), { values: vals({ c: Q('4.256', 'pm') }) }),
  C('round without a rounding block', FX(round(rf)), THROWS(E), { values: vals({ f: '1' }) }),
  C('round without a rounding block in a branch that is never selected', FX(iff(FLAG, rf, round(rf))), THROWS(E), { values: vals({ b: true, f: '1' }) }),
  C('round arity 0', FX({ op: 'round', args: [] }, 'ratio', rnd('half-even', 2)), THROWS(E)),
  C('round arity 2', FX(round(rf, rg), 'ratio', rnd('half-even', 2)), THROWS(E)),
]);

const badRounding = [
  ['mode half-down', { mode: 'half-down', decimals: 2 }], ['mode HALF-EVEN', { mode: 'HALF-EVEN', decimals: 2 }], ['mode half_even', { mode: 'half_even', decimals: 2 }],
  ['mode empty', { mode: '', decimals: 2 }], ['mode 5', { mode: 5, decimals: 2 }], ['mode missing', { decimals: 2 }],
  ['decimals -1', { mode: 'half-even', decimals: -1 }], ['decimals 1.5', { mode: 'half-even', decimals: 1.5 }], ['decimals "4"', { mode: 'half-even', decimals: '4' }],
  ['decimals null', { mode: 'half-even', decimals: null }], ['decimals true', { mode: 'half-even', decimals: true }], ['decimals missing', { mode: 'half-even' }],
  ['rounding null', null], ['rounding list', []], ['rounding string', 'half-even'],
];
group('F-R7', 'rounding block validation: four modes, decimals a non-negative integer (l.584; E-0032 (2); E-0033)', [
  ...badRounding.map(([name, rounding]) => C(name, { ...FX(rf), rounding }, THROWS(E))),
  ...[0, 30, 100].map((decimals) => C(`near-miss: decimals ${decimals} accepted`, FX(rf, 'ratio', rnd('half-even', decimals)), CHK())),
  ...['half-even', 'half-up', 'down', 'up'].map((mode) => C(`near-miss: mode ${mode} accepted`, FX(rf, 'ratio', rnd(mode, 2)), CHK())),
]);

// =============================================================================================== F-V division values
const D3 = (f, mode, decimals, expected, extra = {}) => C(`1/3-family f=${f} ${mode} ${decimals}`, FX(divide(rf, K('3')), 'ratio', rnd(mode, decimals)), OK(expected), { values: vals({ f }), ...extra });
group('F-V2', 'inexact quotient with no rounding block: check is clean, evaluation throws INEXACT_DIVISION; the 28/29-digit boundary (E-0032 (3); l.584)', [
  C('1 / 3', FX(divide(rf, K('3'))), THROWS('INEXACT_DIVISION', 'evaluate'), { values: vals({ f: '1' }) }),
  C('2 / 3', FX(divide(rf, K('3'))), THROWS('INEXACT_DIVISION', 'evaluate'), { values: vals({ f: '2' }) }),
  C('1 / 7 constants', FX(divide(K('1'), K('7'))), THROWS('INEXACT_DIVISION', 'evaluate')),
  C('1 / 2^41: 29 significant digits at precision 28', FX(divide(rf, K('2199023255552'))), THROWS('INEXACT_DIVISION', 'evaluate'), { values: vals({ f: '1' }) }),
  C('1 / 2^40: 28 digits with precision 27', FX(divide(rf, K('1099511627776'))), THROWS('INEXACT_DIVISION', 'evaluate'), { values: vals({ f: '1' }), precision: 27 }),
  C('near-miss: 1 / 2^41 is exact at precision 29', FX(divide(rf, K('2199023255552'))), OK('0.00000000000045474735088646411895751953125'), { values: vals({ f: '1' }), precision: 29 }),
  C('near-miss: 1 / 2^40 is exact at precision 28', FX(divide(rf, K('1099511627776'))), OK('0.0000000000009094947017729282379150390625'), { values: vals({ f: '1' }), precision: 28 }),
]);

group('F-V3', 'inexact quotient with a rounding block: rounded to precision significant digits by the declared mode, then rounded at the end (E-0032 (3))', [
  D3('1', 'half-even', 4, '0.3333'), D3('2', 'half-even', 4, '0.6667'), D3('-1', 'half-even', 4, '-0.3333'), D3('-2', 'half-even', 4, '-0.6667'),
  C('quantity / K 3', FX(divide(rc, K('3')), 'pm', rnd('half-even', 4)), OK('0.3333', 'pm'), { values: vals({ c: Q('1', 'pm') }) }),
  D3('2', 'down', 4, '0.6666'), D3('1', 'up', 4, '0.3334'), D3('2', 'half-up', 0, '1'),
]);

group('F-V4', 'rounding twice is observable through the precision option (E-0032 (3))', [
  D3('1', 'half-even', 6, '0.333000', { precision: 3 }), D3('2', 'half-even', 6, '0.667000', { precision: 3 }), D3('2', 'down', 6, '0.666000', { precision: 3 }),
  D3('1', 'half-even', 2, '0.33', { precision: 3 }), D3('2', 'half-even', 2, '0.67', { precision: 3 }),
  D3('1', 'half-even', 30, '0.333333333333333333333333333300'), D3('2', 'half-even', 30, '0.666666666666666666666666666700'),
  D3('2', 'down', 30, '0.666666666666666666666666666600'), D3('1', 'up', 30, '0.333333333333333333333333333400'),
]);

group('F-V5', 'double rounding differs from single rounding (E-0032 (3))', [
  C('1250001/10^7 at precision 3, half-even 2: 0.125 then 0.12 (single rounding would give 0.13)', FX(divide(rf, K('10000000')), 'ratio', rnd('half-even', 2)), OK('0.12'), { values: vals({ f: '1250001' }), precision: 3 }),
]);

const D2_41 = (mode) => C(`1/2^41 ${mode} 40 at precision 28`, FX(divide(rf, K('2199023255552')), 'ratio', rnd(mode, 40)), OK(mode === 'half-even' || mode === 'down' ? '0.0000000000004547473508864641189575195312' : '0.0000000000004547473508864641189575195313'), { values: vals({ f: '1' }) });
group('F-V6', 'the 28/29-digit boundary and an exact tie in the precision rounding (E-0032 (2)-(3))', ['half-even', 'half-up', 'down', 'up'].map(D2_41));

group('F-V7', 'signs of the significant-digit rounding: up is away from zero, down toward zero (E-0032 (2))', [
  D3('-1', 'up', 4, '-0.3334'), D3('-1', 'down', 4, '-0.3333'), D3('-1', 'half-even', 4, '-0.3333'),
]);

group('F-V8', 'precision 1 (E-0032 (3))', [
  C('1/8 at precision 1, half-even 3: 0.1 -> 0.100', FX(divide(rf, K('8')), 'ratio', rnd('half-even', 3)), OK('0.100'), { values: vals({ f: '1' }), precision: 1 }),
  C('near-miss: 1/8 is exact at precision 3', FX(divide(rf, K('8'))), OK('0.125'), { values: vals({ f: '1' }), precision: 3 }),
]);

const TEN32 = `1${'0'.repeat(32)}`;
group('F-V9', 'trailing zeros of an integer quotient are not significant: 10^32 / 1 is exact (E-0036 (3))', [
  C('10^32 / 1, no rounding block', FX(divide(K(TEN32), K('1'))), OK(TEN32)),
  C('10^32 / 1, rounding half-even 0', FX(divide(K(TEN32), K('1')), 'ratio', rnd('half-even', 0)), OK(TEN32)),
  C('near-miss: 10^32 + 1 has 33 significant digits, inexact at precision 28', FX(divide(K(`${TEN32.slice(0, -1)}1`), K('1'))), THROWS('INEXACT_DIVISION', 'evaluate')),
]);

// V10 long exact digits are built in the test with BigInt (reference computed there).

// =============================================================================================== F-Z KF-E-313 protection proof
const ZD = divide(rf, rg);
const Z = (gs, expr = ZD, unit = 'ratio') => FX(expr, unit, gs === null ? {} : { guards: gs.map((w) => (w && w.when !== undefined && w.raise !== undefined ? w : G(w))) });
const U313 = (input = 'g', pointer = '/expression') => D313(pointer, 'unprotected', input);

group('F-Za', 'protected: a nonzero constant divisor (E-0032 (4a))', [
  ...['2', '-3', '0.5', '0.001'].map((k) => C(`divide(f, K ${k})`, FX(divide(rf, K(k))), CHK())),
  C('divide(c, Ku 2 pm)', FX(divide(rc, Ku('2', 'pm'))), CHK()),
  C('divide(c, K 2), output pm', FX(divide(rc, K('2')), 'pm'), CHK()),
]);

const ZB_ACCEPT = [
  ['literal "0" (suffix)', { gain: '0' }], ['literal "0" (full ref)', { 'DE-0017.gain': '0' }], ['eq "0"', { gain: { eq: '0' } }], ['eq "0.00"', { gain: { eq: '0.00' } }],
  ['eq "-0"', { gain: { eq: '-0' } }], ['in ["1","0"]', { gain: { in: ['1', '0'] } }], ['in ["0.0"]', { gain: { in: ['0.0'] } }], ['lte "0"', { gain: { lte: '0' } }],
  ['lte "5"', { gain: { lte: '5' } }], ['gte "0"', { gain: { gte: '0' } }], ['gte "-1"', { gain: { gte: '-1' } }], ['between ["-1","1"]', { gain: { between: ['-1', '1'] } }],
  ['between ["0","0"]', { gain: { between: ['0', '0'] } }], ['between ["-5","0"]', { gain: { between: ['-5', '0'] } }],
  ['any is_null, eq 0', { any: [{ gain: { is_null: true } }, { gain: { eq: '0' } }] }], ['any eq 0, is_null', { any: [{ gain: { eq: '0' } }, { gain: { is_null: true } }] }],
  ['any is_null, lte 0', { any: [{ gain: { is_null: true } }, { gain: { lte: '0' } }] }],
];
group('F-Zb', 'protected: a guard on the bare-ref divisor that is true whenever it is zero (E-0032 (4b); E-0036 (2))', [
  ...ZB_ACCEPT.map(([name, when]) => C(name, Z([when]), CHK())),
  C('protective guard at index 1 behind an unrelated first guard', Z([{ material_type: 'X' }, { gain: '0' }]), CHK()),
  C('quantity divisor, eq zero quantity', Z([{ baseline: { eq: Q('0', 'pm') } }], divide(rc, ref('h'))), CHK()),
  C('quantity divisor, lte zero quantity', Z([{ baseline: { lte: Q('0', 'pm') } }], divide(rc, ref('h'))), CHK()),
  C('quantity divisor, between [-1,1] quantities', Z([{ baseline: { between: [Q('-1', 'pm'), Q('1', 'pm')] } }], divide(rc, ref('h'))), CHK()),
]);

const ZC_THEN = [
  ['ne "0"', { gain: { ne: '0' } }], ['ne "0.00"', { gain: { ne: '0.00' } }], ['gt "0"', { gain: { gt: '0' } }], ['lt "0"', { gain: { lt: '0' } }], ['not_in ["0","1"]', { gain: { not_in: ['0', '1'] } }],
];
const ZC_ELSE = [
  ['eq "0"', { gain: { eq: '0' } }], ['lte "0"', { gain: { lte: '0' } }], ['gte "0"', { gain: { gte: '0' } }], ['in ["0"]', { gain: { in: ['0'] } }],
  ['between ["-1","1"]', { gain: { between: ['-1', '1'] } }], ['any is_null, eq 0', { any: [{ gain: { is_null: true } }, { gain: { eq: '0' } }] }],
];
group('F-Zc', 'protected: if conditions around the division, then and else (E-0032 (4c); E-0036 (2))', [
  ...ZC_THEN.map(([name, cond]) => C(`then-branch, cond ${name}`, Z(null, iff(cond, ZD, K('0'))), CHK())),
  ...ZC_ELSE.map(([name, cond]) => C(`else-branch, cond ${name}`, Z(null, iff(cond, K('0'), ZD)), CHK())),
  C('deeper inside the protected branch (arithmetic)', Z(null, iff({ gain: { ne: '0' } }, add(K('1'), multiply(rf, divide(rf, rg))), K('0'))), CHK()),
  C('deeper inside the protected branch (nested if)', Z(null, iff({ gain: { ne: '0' } }, iff(FLAG, ZD, K('1')), K('0'))), CHK()),
  C('quantity divisor, then-branch ne zero quantity', Z(null, iff({ baseline: { ne: Q('0', 'pm') } }, divide(rc, ref('h')), K('0'))), CHK()),
]);

const ZN3 = [
  ['literal "1"', { gain: '1' }], ['eq "1"', { gain: { eq: '1' } }], ['in ["1","2"]', { gain: { in: ['1', '2'] } }], ['gt "0"', { gain: { gt: '0' } }], ['lt "0"', { gain: { lt: '0' } }],
  ['ne "0"', { gain: { ne: '0' } }], ['lte "-1"', { gain: { lte: '-1' } }], ['gte "1"', { gain: { gte: '1' } }], ['between ["1","5"]', { gain: { between: ['1', '5'] } }],
  ['between ["-5","-1"]', { gain: { between: ['-5', '-1'] } }], ['not_in ["0"]', { gain: { not_in: ['0'] } }], ['is_null alone', { gain: { is_null: true } }],
  ['any is_null, ne 0', { any: [{ gain: { is_null: true } }, { gain: { ne: '0' } }] }], ['any is_null, gt 0', { any: [{ gain: { is_null: true } }, { gain: { gt: '0' } }] }],
  ['quantity: gt zero quantity', null],
];
group('F-Zn1', 'KF-E-313 near-miss: no guard, guards []', [
  C('no guards key', Z(null), CHK(U313())),
  C('guards []', Z([]), CHK(U313())),
]);
group('F-Zn2', 'KF-E-313 near-miss: a guard on another field', [
  C('loss_factor eq 0', Z([{ loss_factor: { eq: '0' } }]), CHK(U313())),
]);
group('F-Zn3', 'KF-E-313 near-miss: guards that are not true at zero (E-0032 (4b), E-0036 (2))', [
  ...ZN3.filter(([, w]) => w !== null).map(([name, when]) => C(name, Z([when]), CHK(U313()))),
  C('quantity: gt zero quantity', Z([{ baseline: { gt: Q('0', 'pm') } }], divide(rc, ref('h'))), CHK(U313('h'))),
]);
group('F-Zn4', 'KF-E-313 near-miss: the guard mentions another field and so never protects (E-0036 (2))', [
  C('two keys, one on another field', Z([{ gain: { eq: '0' }, loss_factor: { gt: '0' } }]), CHK(U313())),
  C('any with a matcher on another field', Z([{ any: [{ gain: { eq: '0' } }, { loss_factor: { gt: '0' } }] }]), CHK(U313())),
]);
const ZN5 = [
  ['subtract(1, g) with gte 1', divide(rf, subtract(K('1'), rg)), { gain: { gte: '1' } }],
  ['abs(g) with literal 0', divide(rf, abs(rg)), { gain: '0' }],
  ['max(g, 1) with literal 0', divide(rf, max(rg, K('1'))), { gain: '0' }],
  ['multiply(g, 2) with literal 0', divide(rf, multiply(rg, K('2'))), { gain: '0' }],
  ['add(g, 1) with eq -1', divide(rf, add(rg, K('1'))), { gain: { eq: '-1' } }],
  ['if(flag; g; 1) with literal 0', divide(rf, iff(FLAG, rg, K('1'))), { gain: '0' }],
];
group('F-Zn5', 'KF-E-313 near-miss: compound divisors are never protected, input null (E-0032 (4))',
  ZN5.map(([name, expr, when]) => C(name, Z([when], expr), CHK(U313(null)))));
const ZZ = (reason = 'zero_constant') => D313('/expression', reason, null);
group('F-Zn6', 'KF-E-313: a constant zero divisor is never protected (E-0032 (4))', [
  ...['0', '0.00', '-0', '0.0000'].map((k) => C(`divide(f, K ${k})`, FX(divide(rf, K(k))), CHK(ZZ()))),
  ...['0', '0.00', '-0'].map((k) => C(`divide(f, K ${k}) with guards present`, Z([{ gain: '0' }], divide(rf, K(k))), CHK(ZZ()))),
  C('inside a would-be protective if', Z(null, iff({ gain: { ne: '0' } }, divide(rf, K('0')), K('0'))), CHK(D313('/expression/then', 'zero_constant', null))),
  C('divide(c, Ku 0 pm), output ratio', FX(divide(rc, Ku('0', 'pm'))), CHK(ZZ())),
]);
group('F-Zn7', 'KF-E-313: wrong branch or wrong condition (E-0032 (4c); E-0036 (2))', [
  C('else of a condition that is false at zero', Z(null, iff({ gain: { ne: '0' } }, K('0'), ZD)), CHK(U313('g', '/expression/else'))),
  C('then of a condition that is true at zero', Z(null, iff({ gain: { eq: '0' } }, ZD, K('0'))), CHK(U313('g', '/expression/then'))),
  C('condition on another field', Z(null, iff({ loss_factor: { ne: '0' } }, ZD, K('0'))), CHK(U313('g', '/expression/then'))),
  C('gt "-1" in then (true at zero)', Z(null, iff({ gain: { gt: '-1' } }, ZD, K('0'))), CHK(U313('g', '/expression/then'))),
  C('two keys, one on another field', Z(null, iff({ gain: { ne: '0' }, flag: true }, ZD, K('0'))), CHK(U313('g', '/expression/then'))),
]);
const TWO = add(divide(rf, rg), divide(rg, rf));
group('F-Zn8', 'KF-E-313: two divisions are judged independently (E-0032 (4))', [
  C('only gain is guarded', Z([{ gain: '0' }], TWO), CHK(U313('f', '/expression/args/1'))),
  C('no guard: two findings in pointer order', Z(null, TWO), CHK(U313('g', '/expression/args/0'), U313('f', '/expression/args/1'))),
  C('guards on both', Z([{ gain: '0' }, { loss_factor: '0' }], TWO), CHK()),
]);

group('F-Zx', 'KF-E-313: sound forms beyond the enumerated list protect under the semantic criterion (E-0036 (2), D-02 option 2)', [
  ...[['lt "1"', { gain: { lt: '1' } }], ['gt "-1"', { gain: { gt: '-1' } }], ['ne "5"', { gain: { ne: '5' } }], ['not_in ["5"]', { gain: { not_in: ['5'] } }],
    ['is_null false', { gain: { is_null: false } }], ['any eq 0, eq 1', { any: [{ gain: { eq: '0' } }, { gain: { eq: '1' } }] }]]
    .map(([name, when]) => C(`guard ${name}`, Z([when]), CHK())),
  ...[['gt "1"', { gain: { gt: '1' } }], ['gte "1"', { gain: { gte: '1' } }], ['lt "-1"', { gain: { lt: '-1' } }], ['lte "-1"', { gain: { lte: '-1' } }], ['eq "1"', { gain: { eq: '1' } }], ['in ["1"]', { gain: { in: ['1'] } }]]
    .map(([name, cond]) => C(`then-branch cond ${name}`, Z(null, iff(cond, ZD, K('0'))), CHK())),
  ...[['lt "1"', { gain: { lt: '1' } }], ['gt "-1"', { gain: { gt: '-1' } }], ['ne "5"', { gain: { ne: '5' } }]]
    .map(([name, cond]) => C(`else-branch cond ${name}`, Z(null, iff(cond, K('0'), ZD)), CHK())),
]);

group('F-Zp1', 'KF-E-313: guard {all: [{gain: {eq: "0"}}]} mentions only the divisor and is true at zero, so it protects (E-0037 (1); E-0036 (2); supersedes PLAN F-Zn4 for this form)', [
  C('all of one matcher: check clean', Z([{ all: [{ gain: { eq: '0' } }] }]), CHK()),
  C('all of one matcher: g = 0 raises', Z([{ all: [{ gain: { eq: '0' } }] }]), RAISED('OUT-0001', 0), { values: FV('2', '0') }),
  C('all of one matcher: f=2, g=4 -> 0.5', Z([{ all: [{ gain: { eq: '0' } }] }]), OK('0.5'), { values: FV('2', '4') }),
  C('all of one matcher: g absent -> null', Z([{ all: [{ gain: { eq: '0' } }] }]), NUL, { values: vals({ f: '2' }) }),
]);
group('F-Zp2', 'KF-E-313: guard {not: {gain: {ne: "0"}}} mentions only the divisor and is true at zero, so it protects (E-0037 (1); E-0036 (2); supersedes PLAN F-Zn4 for this form)', [
  C('not ne: check clean', Z([{ not: { gain: { ne: '0' } } }]), CHK()),
  C('not ne: g = 0 raises', Z([{ not: { gain: { ne: '0' } } }]), RAISED('OUT-0001', 0), { values: FV('2', '0') }),
  C('not ne: f=2, g=4 -> 0.5', Z([{ not: { gain: { ne: '0' } } }]), OK('0.5'), { values: FV('2', '4') }),
  C('not ne: g absent -> null (not of a false matcher is true, so the guard raises: binary logic)', Z([{ not: { gain: { ne: '0' } } }]), RAISED('OUT-0001', 0), { values: vals({ f: '2' }) }),
]);

group('F-Zr', 'runtime of protected divisions (E-0031 (2), (4); E-0032 (4))', [
  C('guard gain "0": g = 0 raises', Z([{ gain: '0' }]), RAISED('OUT-0001', 0), { values: FV('2', '0') }),
  C('guard gain "0": g = 0.000 raises', Z([{ gain: '0' }]), RAISED('OUT-0001', 0), { values: FV('2', '0.000') }),
  C('f=2, g=4 -> 0.5', Z([{ gain: '0' }]), OK('0.5'), { values: FV('2', '4') }),
  C('g absent -> null', Z([{ gain: '0' }]), NUL, { values: vals({ f: '2' }) }),
  C('f absent, g=4 -> null', Z([{ gain: '0' }]), NUL, { values: vals({ g: '4' }) }),
  C('if ne 0: g = 0 -> 0', Z(null, iff({ gain: { ne: '0' } }, ZD, K('0'))), OK('0'), { values: FV('2', '0') }),
  C('if ne 0: f=2, g=4 -> 0.5', Z(null, iff({ gain: { ne: '0' } }, ZD, K('0'))), OK('0.5'), { values: FV('2', '4') }),
  C('if ne 0: g absent -> 0 (null cond is false)', Z(null, iff({ gain: { ne: '0' } }, ZD, K('0'))), OK('0'), { values: vals({ f: '2' }) }),
  C('quantity: 5 / 2 -> 2.5', Z([{ baseline: { eq: Q('0', 'pm') } }], divide(rc, ref('h'))), OK('2.5'), { values: vals({ c: Q('5', 'pm'), h: Q('2', 'pm') }) }),
  C('quantity: h = 0 pm raises', Z([{ baseline: { eq: Q('0', 'pm') } }], divide(rc, ref('h'))), RAISED('OUT-0001', 0), { values: vals({ c: Q('5', 'pm'), h: Q('0', 'pm') }) }),
  C('quantity: h = 0.0 pm raises', Z([{ baseline: { eq: Q('0', 'pm') } }], divide(rc, ref('h'))), RAISED('OUT-0001', 0), { values: vals({ c: Q('5', 'pm'), h: Q('0.0', 'pm') }) }),
]);

group('F-Zs', 'static findings block evaluation: a zero divisor is never reached (E-0032 (5))', [
  C('unprotected, g = 2', Z(null), ERR(U313()), { values: FV('1', '2') }),
  C('unprotected, g = 0: ERR, never DIVISION_BY_ZERO', Z(null), ERR(U313()), { values: FV('1', '0') }),
  C('constant zero evaluated', FX(divide(rf, K('0'))), ERR(ZZ()), { values: vals({ f: '1' }) }),
]);

// =============================================================================================== F-T / F-S ordering and shape
const BAD_NUM = { 'DE-0017.loss_factor': 0.1 };
const T1_FORMULAS = [
  ['KF-E-310 of the expression', FX(add(rc, ref('p')), 'pm'), D310x('/expression/args/1', 'pm', 'ppm')],
  ['KF-E-310 of the output', FX(rc, 'ppm'), D310o('ppm', 'pm')],
  ['KF-E-313', FX(divide(rf, rg)), U313()],
  ['KF-E-314 from a guard', { ...FX(rf), guards: [G({ material_type: 'W' })] }, D314('/guards/0/when/material_type', 'e', 'W')],
  ['KF-E-315 from a guard', { ...FX(rf), guards: [G({ note: { matches: '(a)\\1' } })] }, D315('/guards/0/when/note/matches', '(a)\\1')],
  ['KF-E-316', FX(multiply(rc, rc), 'pm'), D316('/expression', 'multiply', 'percent_mass^2')],
];
group('F-T1', 'static findings block evaluation and precede the binding of values: a bad supplied value alongside a finding yields ERR, not INVALID_DECIMAL (E-0032 (5); PLAN P-07)',
  T1_FORMULAS.map(([name, logic, spec]) => C(name, logic, ERR(spec), { values: BAD_NUM })));

const NO_STATIC = FX(rf);
group('F-T2', 'supplied-value findings give status error, validated in inputs[] order (E-0031 (1); E-0025 (3); E-0027 (3); PLAN N-C)', [
  C('enum out of domain, even though nothing reads it', NO_STATIC, VERR(D314('/inputs/6', 'e', 'W', 'value')), { values: vals({ f: '1', e: 'W' }) }),
  C('near-miss: enum null', NO_STATIC, OK('1'), { values: vals({ f: '1', e: null }) }),
  C('near-miss: enum absent', NO_STATIC, OK('1'), { values: vals({ f: '1' }) }),
  C('near-miss: enum in domain', NO_STATIC, OK('1'), { values: vals({ f: '1', e: 'X' }) }),
  C('two bad values: KF-E-310 then KF-E-314 (sorted by code)', NO_STATIC, VERR(D310v('/inputs/0', 'DE-0017.concentration', 'pm', 'ppm'), D314('/inputs/6', 'e', 'W', 'value')), { values: vals({ f: '1', e: 'W', c: Q('1', 'ppm') }) }),
  C('wrong unit on a quantity', NO_STATIC, VERR(D310v('/inputs/0', 'DE-0017.concentration', 'pm', 'ppm')), { values: vals({ f: '1', c: Q('1', 'ppm') }) }),
]);

const S1_GUARDS = [G({ material_type: 'W' }, 'OUT-0001'), G({ note: { matches: '(a)\\1' } }, 'OUT-0002')];
const S1_EXPR = add(rc, ref('p'), multiply(rc, divide(rf, rg)));
group('F-S1', 'four codes in one formula: exact ordered list of (code, pointer) (PLAN F-S1; Diagnostic sort key)', [
  C('S1', FX(S1_EXPR, 'ratio', { guards: S1_GUARDS }), CHK(
    D310x('/expression/args/1', 'pm', 'ppm'), D310o('ratio', 'pm'), U313('g', '/expression/args/2/args/1'),
    D314('/guards/0/when/material_type', 'e', 'W'), D315('/guards/1/when/note/matches', '(a)\\1'))),
]);
group('F-S1b', 'S1 plus a KF-E-316 and its (non-)consequences (E-0036 (1))', [
  C('S1b: KF-E-316 sorts last; the add keeps its first operand unit so the output check still runs',
    FX(add(rc, ref('p'), multiply(rc, rc), multiply(rc, divide(rf, rg))), 'ratio', { guards: S1_GUARDS }),
    CHK(D310x('/expression/args/1', 'pm', 'ppm'), D310o('ratio', 'pm'), U313('g', '/expression/args/3/args/1'),
      D314('/guards/0/when/material_type', 'e', 'W'), D315('/guards/1/when/note/matches', '(a)\\1'),
      D316('/expression/args/2', 'multiply', 'percent_mass^2'))),
]);

export const K1_PAIRS = [
  { code: 'KF-E-310', positive: C('operand mismatch', FX(add(rc, ref('p')), 'pm'), CHK(D310x('/expression/args/1', 'pm', 'ppm'))), nearMiss: C('same unit id', FX(add(rc, ref('h')), 'pm'), CHK()) },
  { code: 'KF-E-310', positive: C('output mismatch', FX(rc, 'ppm'), CHK(D310o('ppm', 'pm'))), nearMiss: C('output equals computed', FX(rc, 'pm'), CHK()) },
  { code: 'KF-E-313', positive: C('unprotected divisor', Z(null), CHK(U313())), nearMiss: C('protected by a guard', Z([{ gain: '0' }]), CHK()) },
  { code: 'KF-E-314', positive: C('out-of-domain literal', { ...FX(rf), guards: [G({ material_type: 'W' })] }, CHK(D314('/guards/0/when/material_type', 'e', 'W'))), nearMiss: C('in-domain literal', { ...FX(rf), guards: [G({ material_type: 'X' })] }, CHK()) },
  { code: 'KF-E-315', positive: C('backreference', { ...FX(rf), guards: [G({ note: { matches: '(a)\\1' } })] }, CHK(D315('/guards/0/when/note/matches', '(a)\\1'))), nearMiss: C('compilable pattern', { ...FX(rf), guards: [G({ note: { matches: '^(a)b' } })] }, CHK()) },
  { code: 'KF-E-316', positive: C('squared unit', FX(multiply(rc, rc), 'pm'), CHK(D316('/expression', 'multiply', 'percent_mass^2'))), nearMiss: C('admissible product', FX(multiply(rc, rf), 'pm'), CHK()) },
];
