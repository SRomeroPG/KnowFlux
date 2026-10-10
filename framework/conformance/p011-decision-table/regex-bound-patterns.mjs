// P011 audit R01 remediation cases F01/F02 (AUDIT_R01.md): patterns whose compile work must stay bounded.
// Spec l.612 ("una regex patologica es un fallo de disponibilidad"), PLAN V-12 (finish within 5 s),
// E-0021 (linear time), E-0022 D-05 (100000-instruction cap). Each pattern must be answered (ok, or KF-E-315)
// within RE2_BOUND_MS; both outcomes are acceptable, hanging or exceeding the bound is not.
export const RE2_BOUND_MS = 5000;

// 1200 distinct, pairwise non-adjacent code points (U+4E00, U+4E02, ...): the class cannot collapse to a few ranges,
// and none is a surrogate or a regex metacharacter.
const classOf1200 = () => {
  let body = '';
  for (let i = 0; i < 1200; i += 1) body += String.fromCodePoint(0x4e00 + 2 * i);
  return `[${body}]`;
};

export const BOUND_PATTERNS = {
  // F01: zero-width item under nested counted repeats (AUDIT_R01 F-P011-R01-F01)
  'empty-3': '(?:(?:(){1000}){1000}){1000}',
  'empty-4': '(?:(?:(?:(){1000}){1000}){1000}){1000}',
  'zero-3': '(?:(?:(?:a{0}){1000}){1000}){1000}',
  // F02: large class copied by a counted repeat (AUDIT_R01 F-P011-R01-F02); program of 99 * 1000 + 1 instructions
  'class-1200': `(?:${classOf1200()}{1000}){99}`,
};
