// Typed errors of the logic engine (P011; PLAN P-01, P-02; errata E-0014 precedent, E-0017..E-0022).
//
// A `LogicError` is THROWN for defects that have no entry in the section 42.2 catalog. Catalog diagnostics
// (`KF-E-310`, ...) are never thrown and a LogicError is never returned inside a diagnostics list.
// Codes are internal (not `KF-`); the CLI phases (P007, P014) map them to exit codes.

/** All typed error codes, ascending byte order. */
export const LOGIC_ERROR_CODES = Object.freeze([
  'AMBIGUOUS_FIELD',
  'DUPLICATE_DEFAULT',
  'DUPLICATE_RULE_ID',
  'EMPTY_PREDICATE',
  'INVALID_ARGUMENT',
  'INVALID_DECIMAL',
  'INVALID_INPUT_DECLARATION',
  'INVALID_RANGE',
  'INVALID_TABLE',
  'INVALID_UNITS',
  'TYPE_MISMATCH',
  'UNBOUND_FIELD',
  'UNKNOWN_UNIT',
  'UNSUPPORTED_INPUT_TYPE',
]);

export class LogicError extends Error {
  /**
   * @param {string} code one of LOGIC_ERROR_CODES
   * @param {string} message human readable text (never asserted by callers)
   * @param {object} [details] structured, JSON-friendly context
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'LogicError';
    this.code = code;
    this.details = details;
  }
}

/** Convenience: build a LogicError. */
export function logicError(code, message, details = {}) {
  return new LogicError(code, message, details);
}
