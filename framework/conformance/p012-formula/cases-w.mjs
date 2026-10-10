// P012 conformance: the spec example (spec l.640-653) end to end, groups F-W1 ... F-W8.
// The formula W is NOT written here: the test extracts the lines between the fences of the frozen spec and passes the parsed
// `logic` mapping in (PLAN "F-W"). Inputs c and f, registry UF1 with percent_mass and ratio.
// W is: multiply(DE-0017.concentration, subtract("1", DE-0017.loss_factor)), rounding half-even 4,
//       guard {DE-0017.loss_factor: {gte: "1"}} -> OUT-0011, output percent_mass.
import { C, CHK, D310v, D310x, D313, NUL, OK, Q, RAISED, THROWS, VERR, clone, divide, inputsOf, ref, vals, valsBySuffix } from './builders.mjs';

export function wGroups(W) {
  const inputs = inputsOf('c', 'f');
  const mk = (name, logic, exp, extra = {}) => C(name, logic, exp, { inputs, ...extra });
  const w = () => clone(W);
  const at = (c, f) => vals({ c: Q(c, 'pm'), f });
  const out = [];
  const add = (key, title, cases) => out.push({ key, title, cases });

  add('F-W1', 'W checks clean: percent_mass x (1 - dimensionless) is percent_mass; the guard is a single matcher, no division (l.660-663; E-0030)', [
    mk('W check', w(), CHK()),
  ]);

  add('F-W2', 'W values, rendered with exactly 4 decimals (l.584; E-0032 (2))', [
    ['0.1', '3.7800'], ['0.05', '3.9900'], ['0.5', '2.1000'], ['0', '4.2000'], ['-1', '8.4000'], ['0.999999', '0.0000'], ['0.99995', '0.0002'],
    ['0.9999999999999999999999999999999', '0.0000'],
  ].map(([f, expected]) => mk(`c=4.2 pm, f=${f}`, w(), OK(expected, 'pm'), { values: at('4.2', f) })));

  add('F-W3', 'W raised: the guard gte "1" is evaluated before the expression and does not need c (l.650-652; E-0031 (2))', [
    ...['1', '1.0', '1.5', '1000000'].map((f) => mk(`f=${f}`, w(), RAISED('OUT-0011', 0), { values: at('4.2', f) })),
    mk('c absent, f=1', w(), RAISED('OUT-0011', 0), { values: vals({ f: '1' }) }),
  ]);

  add('F-W4', 'W null: guard compares null (false), the product is null, rounding of null is null (l.606-607; E-0031 (4))', [
    mk('f absent', w(), NUL, { values: vals({ c: Q('4.2', 'pm') }) }),
    mk('f null', w(), NUL, { values: vals({ c: Q('4.2', 'pm'), f: null }) }),
    mk('c absent', w(), NUL, { values: vals({ f: '0.1' }) }),
    mk('both absent', w(), NUL),
  ]);

  add('F-W6', 'W supplied-value findings are validated before the guards and give status error (E-0025 (3); E-0027 (3); E-0031 (1))', [
    mk('c in ppm', w(), VERR(D310v('/inputs/0', 'DE-0017.concentration', 'pm', 'ppm')), { values: vals({ c: Q('4.2', 'ppm'), f: '0.1' }) }),
    mk('c bare scalar', w(), VERR(D310v('/inputs/0', 'DE-0017.concentration', 'pm', null)), { values: vals({ c: '4.2', f: '0.1' }) }),
    mk('f as a quantity', w(), VERR(D310v('/inputs/1', 'DE-0017.loss_factor', null, 'pm')), { values: vals({ c: Q('4.2', 'pm'), f: Q('0.1', 'pm') }) }),
    mk('wrong unit and a raising f: ERR, not RAISED', w(), VERR(D310v('/inputs/0', 'DE-0017.concentration', 'pm', 'ppm')), { values: vals({ c: Q('4.2', 'ppm'), f: '2' }) }),
    mk('c value is a YAML number', w(), THROWS('INVALID_DECIMAL', 'evaluate'), { values: { 'DE-0017.concentration': { value: 4.2, unit: 'percent_mass' }, 'DE-0017.loss_factor': '0.1' } }),
    mk('f is a number', w(), THROWS('INVALID_DECIMAL', 'evaluate'), { values: { 'DE-0017.concentration': Q('4.2', 'pm'), 'DE-0017.loss_factor': 0.1 } }),
  ]);

  add('F-W7', 'W binds supplied values by suffix as well as by full ref (E-0019; E-0022 D-02)', [
    mk('suffix keys', w(), OK('3.7800', 'pm'), { values: valsBySuffix({ c: Q('4.2', 'pm'), f: '0.1' }) }),
  ]);

  const mut = (fn) => {
    const logic = w();
    fn(logic);
    return logic;
  };
  const noRounding = mut((l) => { delete l.rounding; });
  add('F-W8', 'W mutations: each isolated defect yields exactly its code (l.584, l.585, l.660-663; E-0030; E-0032 (4))', [
    mk('outer multiply replaced by add', mut((l) => { l.expression.op = 'add'; }), CHK(D310x('/expression/args/1', 'pm', null))),
    mk('output.unit ppm_mass', mut((l) => { l.output.unit = 'ppm_mass'; }), CHK({ code: 'KF-E-310', source: 'output', pointer: '/output/unit', expected_unit: 'ppm_mass', found_unit: 'percent_mass' })),
    mk('output.unit furlong', mut((l) => { l.output.unit = 'furlong'; }), THROWS('UNKNOWN_UNIT')),
    mk('output.unit bare percent', mut((l) => { l.output.unit = 'percent'; }), THROWS('UNKNOWN_UNIT')),
    mk('raise OUT-11', mut((l) => { l.guards[0].raise = 'OUT-11'; }), THROWS('INVALID_EXPRESSION')),
    mk('inner subtract replaced by divide(1, f), guard gte "1" does not contain zero', mut((l) => { l.expression.args[1] = divide({ const: '1' }, ref('f')); }), CHK(D313('/expression/args/1', 'unprotected', 'f'))),
    mk('same with the guard changed to lte "0"', mut((l) => {
      l.expression.args[1] = divide({ const: '1' }, ref('f'));
      l.guards[0].when = { 'DE-0017.loss_factor': { lte: '0' } };
    }), CHK()),
    mk('rounding block removed: no rounding without a declaration (l.584)', noRounding, CHK()),
    mk('rounding block removed: canonical form', noRounding, OK('3.78', 'pm'), { values: at('4.2', '0.1') }),
  ]);

  return out;
}

/** F-W5: ties and signs. The spec example with f = "0" so that the value is c itself, rounding mode replaced, decimals 4. */
export function w5Cases(W, rounding) {
  const inputs = inputsOf('c', 'f');
  const cases = [];
  for (const row of rounding.w5) {
    rounding.modes.forEach((mode, i) => {
      const logic = clone(W);
      logic.rounding = { mode, decimals: 4 };
      cases.push(C(`c=${row[0]} ${mode}`, logic, OK(row[i + 1], 'pm'), { inputs, values: vals({ c: Q(row[0], 'pm'), f: '0' }) }));
    });
  }
  return cases;
}
