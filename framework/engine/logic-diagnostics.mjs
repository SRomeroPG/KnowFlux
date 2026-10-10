// Diagnostic constants and ordering for the decision-table checker (P011; PLAN P-08, P-09).
//
// The constants are copied once from the section 42.2 catalog (l.1765-1770) until the catalog module of P028
// exists; P007/P014 must re-source them from it. Only these five codes are produced by P011 (E-0021).

const REMEDIATION_311 = 'añadir `when: default`'; // l.1766

export const LOGIC_DIAGNOSTIC_CATALOG = Object.freeze({
  'KF-E-310': Object.freeze({ code: 'KF-E-310', severity: 'E' }), // Unidades incompatibles (l.1765)
  'KF-E-311': Object.freeze({ code: 'KF-E-311', severity: 'E', remediation: REMEDIATION_311 }), // l.1766
  'KF-E-312': Object.freeze({ code: 'KF-E-312', severity: 'E' }), // Solapamiento con hit_policy: unique (l.1767)
  'KF-E-314': Object.freeze({ code: 'KF-E-314', severity: 'E' }), // Valor fuera del dominio del enum (l.1769)
  'KF-E-315': Object.freeze({ code: 'KF-E-315', severity: 'E' }), // Regex no compilable en RE2 (l.1770)
});

/**
 * Build a diagnostic from the catalog entry of `code`. `fields` are the code-specific fields; `undefined`
 * values are dropped. The catalog `remediation` is attached when the catalog defines one (l.1600).
 */
export function makeDiagnostic(code, message, fields) {
  const entry = LOGIC_DIAGNOSTIC_CATALOG[code];
  const diagnostic = { code: entry.code, severity: entry.severity, message };
  if (entry.remediation !== undefined) diagnostic.remediation = entry.remediation;
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) diagnostic[key] = value;
  }
  return diagnostic;
}

/** Compare two strings by Unicode code point, which is the same order as UTF-8 byte order. */
export function compareStrings(a, b) {
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const x = a.codePointAt(i);
    const y = b.codePointAt(j);
    if (x !== y) return x < y ? -1 : 1;
    i += x > 0xffff ? 2 : 1;
    j += y > 0xffff ? 2 : 1;
  }
  if (i < a.length) return 1;
  if (j < b.length) return -1;
  return 0;
}

function compareDiagnostics(x, y) {
  let order = compareStrings(String(x.code), String(y.code));
  if (order !== 0) return order;
  const xi = x.rule_index ?? -1;
  const yi = y.rule_index ?? -1;
  if (xi !== yi) return xi < yi ? -1 : 1;
  order = compareStrings(String(x.pointer ?? ''), String(y.pointer ?? ''));
  if (order !== 0) return order;
  const xr = Array.isArray(x.rule_indexes) ? x.rule_indexes : [];
  const yr = Array.isArray(y.rule_indexes) ? y.rule_indexes : [];
  const shared = xr.length < yr.length ? xr.length : yr.length;
  for (let k = 0; k < shared; k += 1) {
    if (xr[k] !== yr[k]) return xr[k] < yr[k] ? -1 : 1;
  }
  if (xr.length !== yr.length) return xr.length < yr.length ? -1 : 1;
  return compareStrings(String(x.message ?? ''), String(y.message ?? ''));
}

/** New array sorted by (code, rule_index ?? -1, pointer, rule_indexes element-wise, message); stable. */
export function sortDiagnostics(diagnostics) {
  return [...diagnostics].sort(compareDiagnostics);
}

// Formula catalog rows (P012; errata E-0033, E-0036), copied once from section 42.2 (l.1768, l.1771) until the
// catalog module of P028 exists. Kept apart from LOGIC_DIAGNOSTIC_CATALOG, whose five P011 rows are pinned by P011.
const REMEDIATION_313 = 'añadir `guard`'; // l.1768

export const FORMULA_DIAGNOSTIC_CATALOG = Object.freeze({
  'KF-E-313': Object.freeze({ code: 'KF-E-313', severity: 'E', remediation: REMEDIATION_313 }), // División por cero no protegida (l.1768)
  'KF-E-316': Object.freeze({ code: 'KF-E-316', severity: 'E' }), // Dimensión resultante inexistente en `units.yaml` (l.1771)
});

/**
 * Build a formula diagnostic: `KF-E-313` and `KF-E-316` come from FORMULA_DIAGNOSTIC_CATALOG, any other code is
 * delegated to makeDiagnostic (the P011 catalog). The catalog `remediation` is attached when one is defined (l.1600).
 */
export function makeFormulaDiagnostic(code, message, fields) {
  if (!Object.hasOwn(FORMULA_DIAGNOSTIC_CATALOG, code)) return makeDiagnostic(code, message, fields);
  const entry = FORMULA_DIAGNOSTIC_CATALOG[code];
  const diagnostic = { code: entry.code, severity: entry.severity, message };
  if (entry.remediation !== undefined) diagnostic.remediation = entry.remediation;
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) diagnostic[key] = value;
  }
  return diagnostic;
}
