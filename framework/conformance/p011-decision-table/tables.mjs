// P011 conformance helpers: builders for the tables of the PLAN "Fixture slice" notation.
// Pure data builders: nothing here imports the engine, and nothing here computes an expected value.
// Every builder returns FRESH objects so a case can never share state with another case.

export const UNITS = { pm: 'percent_mass', ppm: 'ppm_mass', pv: 'percent_volume', kg: 'kg' };

/** Q('4.2','pm') = {value: "4.2", unit: percent_mass}; the value is always passed as a string. */
export const Q = (value, unit) => ({ value, unit: UNITS[unit] ?? unit });

export const REFS = {
  concentration: 'DE-0001.concentration',
  count: 'DE-0001.count',
  material: 'DE-0001.material',
  note: 'DE-0001.note',
  flag: 'DE-0001.flag',
  a: 'DE-0001.a',
  b: 'DE-0001.b',
};

/** Input declarations of the PLAN notation (q d e s b A B). */
export function input(name, domain) {
  switch (name) {
    case 'q': return { ref: REFS.concentration, type: 'quantity', unit: 'percent_mass' };
    case 'd': return { ref: REFS.count, type: 'decimal' };
    case 'e': return { ref: REFS.material, type: 'enum', domain: domain ?? ['X', 'Y', 'Z'] };
    case 's': return { ref: REFS.note, type: 'string' };
    case 'b': return { ref: REFS.flag, type: 'boolean' };
    case 'A': return { ref: REFS.a, type: 'enum', domain: domain ?? ['X', 'Y'] };
    case 'B': return { ref: REFS.b, type: 'enum', domain: domain ?? ['P', 'Q'] };
    default: throw new Error(`unknown input shorthand ${name}`);
  }
}

export const inputs = (...names) => names.map((name) => input(name));

/** A decision table. rows = [[id, when, then?], ...]; `then` defaults to {hit: id}. */
export function table({ policy = 'first', exhaustive = false, ins, rows }) {
  return {
    kind: 'decision-table',
    hit_policy: policy,
    exhaustive,
    inputs: ins,
    rules: rows.map(([id, when, then]) => ({ id, when, then: then ?? { hit: id } })),
  };
}

/** Skeleton S1(inputs; W): r1 = W, r2 = default. */
export function S1(ins, W, { policy = 'first', exhaustive = false } = {}) {
  const resolved = ins.map((i) => (typeof i === 'string' ? input(i) : i));
  return table({ policy, exhaustive, ins: resolved, rows: [['r1', W], ['r2', 'default']] });
}

/** Two non-default rows, no default, for the overlap proofs (hit_policy unique, exhaustive false). */
export function pair(ins, W1, W2) {
  const resolved = ins.map((i) => (typeof i === 'string' ? input(i) : i));
  return table({ policy: 'unique', ins: resolved, rows: [['r1', W1], ['r2', W2]] });
}

/** Table T-H (PLAN F-H): inputs e, d; rows r1, r2, r3 and a default row `rd` at the given position. */
export function TH({ policy = 'first', rd = 'last' } = {}) {
  const rows = [
    ['r1', { material: { in: ['X', 'Y'] } }],
    ['r2', { material: { in: ['Y', 'Z'] } }],
    ['r3', { count: { gt: '0' } }],
  ];
  const def = ['rd', 'default'];
  if (rd === 'first') rows.unshift(def);
  else if (rd === 'middle') rows.splice(1, 0, def);
  else if (rd === 'last') rows.push(def);
  return table({ policy, ins: inputs('e', 'd'), rows });
}

/** Supplied values keyed by the FULL ref from shorthand names. undefined = absent; null stays null. */
export function vals(shorthand) {
  const out = {};
  for (const [name, value] of Object.entries(shorthand)) {
    if (value === undefined) continue;
    out[REFS[name] ?? name] = value;
  }
  return out;
}

/** Recursively reverse the key order of every plain object (property-order permutation, S2). */
export function permute(value) {
  if (Array.isArray(value)) return value.map(permute);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).reverse()) out[key] = permute(value[key]);
    return out;
  }
  return value;
}

/** Table with all five KF- codes (PLAN F-S1). */
export function allFiveCodes() {
  return table({
    policy: 'unique',
    exhaustive: true,
    ins: [input('q'), input('e', ['X', 'Y']), input('s')],
    rows: [
      ['r1', { concentration: { lte: Q('4', 'ppm') } }],
      ['r2', { material: 'W' }],
      ['r3', { note: { matches: '(a)\\1' } }],
    ],
  });
}

/** A table with several keys per `when` mapping and several findings (used for S2 permutation). */
export function multiKeyFindings() {
  return table({
    policy: 'unique',
    exhaustive: true,
    ins: [input('q'), input('e', ['X', 'Y']), input('s')],
    rows: [
      ['r1', { concentration: { lte: Q('4', 'ppm') }, material: 'W' }],
      ['r2', { note: { matches: '(a)\\1' }, concentration: { gt: Q('1', 'pv') } }],
      ['r3', { material: { in: ['X', 'Q'] }, note: { matches: '(?=b)' } }],
    ],
  });
}

// ---------------------------------------------------------------------------------------------
// Operator cases (PLAN F-O). Each: key, title, ins (shorthand names), W (the `when`), cases:
// [suppliedShorthandValues, expectedRow] with expectedRow 'r1' | 'r2' (r2 is the default row of S1).
// ---------------------------------------------------------------------------------------------
export const OPERATOR_CASES = [
  { key: 'F-O1', title: 'literal on enum', ins: ['e'], W: { material: 'X' },
    cases: [[{ material: 'X' }, 'r1'], [{ material: 'Y' }, 'r2'], [{ material: 'Z' }, 'r2']] },
  { key: 'F-O2', title: 'literal on quantity', ins: ['q'], W: { concentration: Q('4.2', 'pm') },
    cases: [[{ concentration: Q('4.20', 'pm') }, 'r1'], [{ concentration: Q('4.3', 'pm') }, 'r2']] },
  { key: 'F-O3', title: 'literal on boolean', ins: ['b'], W: { flag: true },
    cases: [[{ flag: true }, 'r1'], [{ flag: false }, 'r2']] },
  { key: 'F-O4', title: 'literal on decimal', ins: ['d'], W: { count: '4.2' },
    cases: [[{ count: '4.20' }, 'r1'], [{ count: '4.3' }, 'r2']] },
  { key: 'F-O5', title: 'eq', ins: ['d'], W: { count: { eq: '0' } },
    cases: [[{ count: '-0' }, 'r1'], [{ count: '0.00' }, 'r1'], [{ count: '1' }, 'r2']] },
  { key: 'F-O6', title: 'ne', ins: ['e'], W: { material: { ne: 'X' } },
    cases: [[{ material: 'Y' }, 'r1'], [{ material: 'Z' }, 'r1'], [{ material: 'X' }, 'r2']] },
  { key: 'F-O7', title: 'lt', ins: ['d'], W: { count: { lt: '5' } },
    cases: [[{ count: '4.999' }, 'r1'], [{ count: '5' }, 'r2'], [{ count: '5.0' }, 'r2'], [{ count: '-100' }, 'r1']] },
  { key: 'F-O8', title: 'lte', ins: ['d'], W: { count: { lte: '5' } },
    cases: [[{ count: '5.00' }, 'r1'], [{ count: '5.001' }, 'r2']] },
  { key: 'F-O9', title: 'gt (numeric, not lexical)', ins: ['d'], W: { count: { gt: '9' } },
    cases: [[{ count: '10' }, 'r1'], [{ count: '9' }, 'r2'], [{ count: '9.001' }, 'r1'], [{ count: '-6' }, 'r2']] },
  { key: 'F-O10', title: 'gte', ins: ['d'], W: { count: { gte: '5' } },
    cases: [[{ count: '5' }, 'r1'], [{ count: '4.999' }, 'r2']] },
  { key: 'F-O11a', title: 'lte on quantity', ins: ['q'], W: { concentration: { lte: Q('4.2', 'pm') } },
    cases: [[{ concentration: Q('4.2', 'pm') }, 'r1'], [{ concentration: Q('4.21', 'pm') }, 'r2'], [{ concentration: Q('-1', 'pm') }, 'r1']] },
  { key: 'F-O11b', title: 'lt on quantity at the boundary', ins: ['q'], W: { concentration: { lt: Q('4.2', 'pm') } },
    cases: [[{ concentration: Q('4.2', 'pm') }, 'r2'], [{ concentration: Q('4.19', 'pm') }, 'r1']] },
  { key: 'F-O11c', title: 'gt on quantity at the boundary', ins: ['q'], W: { concentration: { gt: Q('4.2', 'pm') } },
    cases: [[{ concentration: Q('4.2', 'pm') }, 'r2'], [{ concentration: Q('4.21', 'pm') }, 'r1']] },
  { key: 'F-O11d', title: 'gte on quantity at the boundary', ins: ['q'], W: { concentration: { gte: Q('4.2', 'pm') } },
    cases: [[{ concentration: Q('4.2', 'pm') }, 'r1'], [{ concentration: Q('4.19', 'pm') }, 'r2']] },
  { key: 'F-O12', title: 'in on enum', ins: ['e'], W: { material: { in: ['X', 'Y'] } },
    cases: [[{ material: 'X' }, 'r1'], [{ material: 'Y' }, 'r1'], [{ material: 'Z' }, 'r2']] },
  { key: 'F-O13', title: 'in on decimal', ins: ['d'], W: { count: { in: ['1', '2.0'] } },
    cases: [[{ count: '2' }, 'r1'], [{ count: '1.00' }, 'r1'], [{ count: '3' }, 'r2']] },
  { key: 'F-O14', title: 'not_in', ins: ['e'], W: { material: { not_in: ['X'] } },
    cases: [[{ material: 'Y' }, 'r1'], [{ material: 'Z' }, 'r1'], [{ material: 'X' }, 'r2']] },
  { key: 'F-O15', title: 'in on quantity', ins: ['q'], W: { concentration: { in: [Q('1', 'pm'), Q('2', 'pm')] } },
    cases: [[{ concentration: Q('2.0', 'pm') }, 'r1'], [{ concentration: Q('3', 'pm') }, 'r2']] },
  { key: 'F-O16a', title: 'between is inclusive at both ends', ins: ['d'], W: { count: { between: ['1', '5'] } },
    cases: [[{ count: '1' }, 'r1'], [{ count: '5' }, 'r1'], [{ count: '3' }, 'r1'], [{ count: '0.999' }, 'r2'], [{ count: '5.001' }, 'r2']] },
  { key: 'F-O16b', title: 'between degenerate range', ins: ['d'], W: { count: { between: ['2', '2'] } },
    cases: [[{ count: '2' }, 'r1'], [{ count: '2.1' }, 'r2']] },
  { key: 'F-O17', title: 'between on quantity', ins: ['q'], W: { concentration: { between: [Q('1', 'pm'), Q('5', 'pm')] } },
    cases: [[{ concentration: Q('5', 'pm') }, 'r1'], [{ concentration: Q('5.1', 'pm') }, 'r2']] },
  { key: 'F-O19', title: 'matches anchored', ins: ['s'], W: { note: { matches: '^AB[0-9]+$' } },
    cases: [[{ note: 'AB12' }, 'r1'], [{ note: 'xAB12' }, 'r2'], [{ note: 'AB' }, 'r2'], [{ note: 'ab12' }, 'r2']] },
  { key: 'F-O20', title: 'matches unanchored', ins: ['s'], W: { note: { matches: 'B1' } },
    cases: [[{ note: 'AB12' }, 'r1'], [{ note: 'AC12' }, 'r2']] },
  { key: 'F-O21a', title: 'is_null true', ins: ['s'], W: { note: { is_null: true } },
    cases: [[{}, 'r1'], [{ note: null }, 'r1'], [{ note: 'x' }, 'r2']] },
  { key: 'F-O21b', title: 'is_null false', ins: ['s'], W: { note: { is_null: false } },
    cases: [[{ note: 'x' }, 'r1'], [{ note: null }, 'r2'], [{}, 'r2']] },
  { key: 'F-O22', title: 'all', ins: ['e', 'd'], W: { all: [{ material: 'X' }, { count: { gt: '0' } }] },
    cases: [[{ material: 'X', count: '1' }, 'r1'], [{ material: 'X', count: '0' }, 'r2'], [{ material: 'Y', count: '1' }, 'r2']] },
  { key: 'F-O23', title: 'any', ins: ['e', 'd'], W: { any: [{ material: 'X' }, { count: { gt: '0' } }] },
    cases: [[{ material: 'Y', count: '1' }, 'r1'], [{ material: 'X', count: '-1' }, 'r1'], [{ material: 'Y', count: '-1' }, 'r2']] },
  { key: 'F-O24', title: 'not', ins: ['e'], W: { not: { material: 'X' } },
    cases: [[{ material: 'Y' }, 'r1'], [{ material: 'X' }, 'r2']] },
  { key: 'F-O25', title: 'implicit conjunction of several keys', ins: ['e', 'd'], W: { material: 'X', count: { gt: '0' } },
    cases: [[{ material: 'X', count: '1' }, 'r1'], [{ material: 'X', count: '0' }, 'r2'], [{ material: 'Y', count: '1' }, 'r2']] },
  { key: 'F-O26', title: 'nesting', ins: ['e', 'd'],
    W: { all: [{ any: [{ material: 'X' }, { material: 'Y' }] }, { not: { count: { lt: '0' } } }] },
    cases: [[{ material: 'Y', count: '0' }, 'r1'], [{ material: 'Y', count: '-1' }, 'r2'], [{ material: 'Z', count: '0' }, 'r2']] },
];

// ---------------------------------------------------------------------------------------------
// Null / absent cases (PLAN F-L1, F-L2): every matcher but is_null is false on null (spec l.607).
// ---------------------------------------------------------------------------------------------
export const NULL_WHENS = [
  { count: { eq: '1' } }, { count: { ne: '1' } }, { count: { in: ['1'] } }, { count: { not_in: ['1'] } },
  { count: { lt: '1' } }, { count: { lte: '1' } }, { count: { gt: '1' } }, { count: { gte: '1' } },
  { count: { between: ['0', '2'] } }, { count: '1' }, { note: { matches: '.*' } },
  { material: 'X' }, { material: { ne: 'X' } }, { material: { not_in: ['X'] } },
];

// ---------------------------------------------------------------------------------------------
// Overlap proofs for unique (PLAN F-V6, F-V6b, F-V7); inputs [q, d, s, b] (none is an enum).
// ---------------------------------------------------------------------------------------------
export const DISJOINT_PAIRS = [
  [{ count: { lt: '5' } }, { count: { gte: '5' } }],
  [{ count: { lt: '5' } }, { count: { gt: '5' } }],
  [{ count: '5' }, { count: { gt: '5' } }],
  [{ concentration: { lte: Q('4.2', 'pm') } }, { concentration: { gt: Q('4.2', 'pm') } }],
  [{ count: { between: ['1', '5'] } }, { count: { between: ['5.01', '9'] } }],
  [{ count: { between: ['1', '5'] } }, { count: { gt: '5' } }],
  [{ count: '1' }, { count: '2' }],
  [{ count: { in: ['1', '2'] } }, { count: { in: ['3'] } }],
  [{ note: { in: ['a', 'b'] } }, { note: { in: ['c'] } }],
  [{ note: 'a' }, { note: 'b' }],
  [{ count: { lt: '5' }, note: 'a' }, { count: { gt: '7' }, flag: true }],
];

export const OVERLAPPING_PAIRS = [
  [{ count: { lte: '5' } }, { count: { gte: '5' } }],
  [{ count: { lt: '5' } }, { count: { gt: '4' } }],
  [{ count: { between: ['1', '5'] } }, { count: { between: ['5', '9'] } }],
  [{ count: '5' }, { count: '5.0' }],
  [{ count: '1' }, { count: { in: ['1', '2'] } }],
  [{ note: { in: ['a', 'b'] } }, { note: { in: ['b', 'c'] } }],
  [{ count: { gt: '0' } }, { count: { gt: '10' } }],
];

export const FAIL_CLOSED_PAIRS = [
  [{ any: [{ note: 'a' }, { note: 'b' }] }, { note: 'c' }],
  [{ note: { not_in: ['a'] } }, { note: 'a' }],
  [{ note: { ne: 'a' } }, { note: 'a' }],
  [{ note: { matches: '^a' } }, { note: { matches: '^b' } }],
  [{ not: { note: 'a' } }, { note: 'a' }],
  [{ count: { lt: '5' } }, { note: 'a' }],
  [{ note: { matches: '^a' }, count: '1' }, { count: '2' }],
];

// ---------------------------------------------------------------------------------------------
// P011 audit R01 F07 (AUDIT_R01.md; spec l.633; E-0020 (b); PLAN V-32): a value set (eq / in) against a closed or
// open bound. Same inputs as above (none is an enum). Every pair is checked in both orders.
// ---------------------------------------------------------------------------------------------
export const VALUESET_BOUND_OVERLAPPING = [
  [{ count: '5' }, { count: { gte: '5' } }],                      // 5 satisfies both: the closed bound includes it
  [{ count: '5' }, { count: { lte: '5' } }],
  [{ count: { in: ['1', '5'] } }, { count: { between: ['5', '9'] } }], // between is inclusive (l.625)
  [{ count: { in: ['1', '2'] } }, { count: { gte: '2.0' } }],     // 2 = 2.0 by value (E-0017)
];

export const VALUESET_BOUND_DISJOINT = [
  [{ count: { in: ['1', '5'] } }, { count: { gt: '5' } }],        // the open bound excludes 5
  [{ count: { in: ['1', '5'] } }, { count: { lt: '1' } }],        // the open bound excludes 1
];
