// P012 conformance helpers: expression builders, the nine inputs of the PLAN "Notation", expectation constructors.
// Pure data builders: this module imports NO engine code, so the case tables load even when the engine does not exist.
//
// Notation (PLAN "Fixture slice / Notation"):
//   unit shorthands pm = percent_mass, ppm = ppm_mass, pv = percent_volume (kg, ratio, pct_dimless unchanged)
//   inputs c h p v f g e s b  (order fixes the pointers /inputs/0 .. /inputs/8)
//   ref('f') = {ref: DE-0017.loss_factor};  K('1') = {const: '1'};  Ku('1','pm') = {const: '1', unit: percent_mass}
//   FX(expr, unit, extras) = {kind: formula, output: {ref: DE-0017.result, unit}, expression, ...extras}

export const UNIT = {
  pm: 'percent_mass',
  ppm: 'ppm_mass',
  pv: 'percent_volume',
  kg: 'kg',
  ratio: 'ratio',
  pct_dimless: 'pct_dimless',
};
export const u = (x) => (x === null || x === undefined ? null : (UNIT[x] ?? x));

export const NAME = {
  c: 'concentration',
  h: 'baseline',
  p: 'ppm',
  v: 'volume_fraction',
  f: 'loss_factor',
  g: 'gain',
  e: 'material_type',
  s: 'note',
  b: 'flag',
};
export const REF = Object.fromEntries(Object.entries(NAME).map(([k, n]) => [k, `DE-0017.${n}`]));

export const INPUT_DEFS = {
  c: { ref: REF.c, type: 'quantity', unit: 'percent_mass' },
  h: { ref: REF.h, type: 'quantity', unit: 'percent_mass' },
  p: { ref: REF.p, type: 'quantity', unit: 'ppm_mass' },
  v: { ref: REF.v, type: 'quantity', unit: 'percent_volume' },
  f: { ref: REF.f, type: 'decimal' },
  g: { ref: REF.g, type: 'decimal' },
  e: { ref: REF.e, type: 'enum', domain: ['X', 'Y', 'Z'] },
  s: { ref: REF.s, type: 'string' },
  b: { ref: REF.b, type: 'boolean' },
};
export const ALL_INPUTS = ['c', 'h', 'p', 'v', 'f', 'g', 'e', 's', 'b'].map((k) => ({ ...INPUT_DEFS[k], ...(INPUT_DEFS[k].domain ? { domain: [...INPUT_DEFS[k].domain] } : {}) }));
export const inputsOf = (...keys) => keys.map((k) => ({ ...INPUT_DEFS[k], ...(INPUT_DEFS[k].domain ? { domain: [...INPUT_DEFS[k].domain] } : {}) }));

// ---------------------------------------------------------------------------------------- expressions
export const ref = (k) => ({ ref: REF[k] ?? k });
export const K = (value) => ({ const: value });
export const Ku = (value, unit) => ({ const: value, unit: u(unit) });
export const op = (name, ...args) => ({ op: name, args });
export const add = (...a) => op('add', ...a);
export const subtract = (...a) => op('subtract', ...a);
export const multiply = (...a) => op('multiply', ...a);
export const divide = (...a) => op('divide', ...a);
export const min = (...a) => op('min', ...a);
export const max = (...a) => op('max', ...a);
export const abs = (...a) => op('abs', ...a);
export const round = (...a) => op('round', ...a);
export const clamp = (...a) => op('clamp', ...a);
export const iff = (cond, then, other) => ({ op: 'if', cond, then, else: other });

export const FX = (expression, unit = 'ratio', extras = {}) => ({
  kind: 'formula',
  output: { ref: 'DE-0017.result', unit: u(unit) },
  expression,
  ...extras,
});
export const rnd = (mode, decimals) => ({ rounding: { mode, decimals } });
export const guards = (...list) => ({ guards: list });
export const G = (when, raise = 'OUT-0001') => ({ when, raise });

// ---------------------------------------------------------------------------------------- values
export const Q = (value, unit) => ({ value, unit: u(unit) });
/** Supplied values keyed by the FULL ref. `vals({f: '0.1', c: Q('4.2', 'pm')})`. */
export const vals = (map) => {
  const out = {};
  for (const [k, value] of Object.entries(map)) out[REF[k] ?? k] = value;
  return out;
};
/** Supplied values keyed by the SUFFIX after the last `.` (E-0019 / PLAN B5). */
export const valsBySuffix = (map) => {
  const out = {};
  for (const [k, value] of Object.entries(map)) out[NAME[k] ?? k] = value;
  return out;
};

// ---------------------------------------------------------------------------------------- expectations
export const OK = (value, unit = 'ratio') => ({ kind: 'ok', value, unit: u(unit) });
export const NUL = { kind: 'null' };
export const RAISED = (outcome, index) => ({ kind: 'raised', outcome, index });
/** Static findings: checkFormula returns exactly specs AND evaluateFormula returns the same list as status error. */
export const ERR = (...specs) => ({ kind: 'err', specs });
/** Value-level findings (supplied values): checkFormula is clean, evaluateFormula returns status error with specs. */
export const VERR = (...specs) => ({ kind: 'verr', specs });
/** only: undefined = checkFormula and evaluateFormula both throw; 'evaluate' = evaluation-only (check is clean). */
export const THROWS = (code, only) => ({ kind: 'throws', code, only });
/** CHECK -> specs. A non-empty list is also evaluated (values irrelevant) and must come back as ERR with the same list. */
export const CHK = (...specs) => ({ kind: 'chk', specs });

const REMEDIATION_313 = 'añadir `guard`'; // spec l.1768
export const D310x = (pointer, expected, found, extra = {}) => ({ code: 'KF-E-310', source: 'expression', pointer, expected_unit: u(expected), found_unit: u(found), ...extra });
export const D310o = (expected, found) => ({ code: 'KF-E-310', source: 'output', pointer: '/output/unit', expected_unit: u(expected), found_unit: u(found) });
export const D310l = (pointer, input, expected, found) => ({ code: 'KF-E-310', source: 'literal', pointer, input, expected_unit: u(expected), found_unit: u(found) });
export const D310v = (pointer, input, expected, found) => ({ code: 'KF-E-310', source: 'value', pointer, input, expected_unit: u(expected), found_unit: u(found) });
export const D313 = (pointer, reason, input) => ({ code: 'KF-E-313', pointer, reason, input: input === null || input === undefined ? null : (REF[input] ?? input), remediation: REMEDIATION_313 });
export const D314 = (pointer, input, value, source = 'literal') => ({ code: 'KF-E-314', pointer, input: REF[input] ?? input, value, source });
export const D315 = (pointer, pattern) => ({ code: 'KF-E-315', pointer, pattern });
export const D316 = (pointer, operation, unit) => ({ code: 'KF-E-316', pointer, operation, unit });

/** One case record. `extra`: values, registry ('uf0'|'uf1'|'uf2'), inputs (array), precision. */
export const C = (name, logic, exp, extra = {}) => ({ name, logic, exp, ...extra });

// ---------------------------------------------------------------------------------------- generic utilities
export const clone = (value) => JSON.parse(JSON.stringify(value));
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}
/** Same value with the keys of EVERY mapping reordered (reversed, or rotated by `shift`). Arrays keep their order. */
export function permuteKeys(value, shift = 0) {
  if (Array.isArray(value)) return value.map((x) => permuteKeys(x, shift));
  if (value && typeof value === 'object') {
    let keys = Object.keys(value).reverse();
    if (shift > 0 && keys.length > 1) {
      const s = shift % keys.length;
      keys = [...keys.slice(s), ...keys.slice(0, s)];
    }
    const out = {};
    for (const key of keys) out[key] = permuteKeys(value[key], shift);
    return out;
  }
  return value;
}
