// Typed internal errors of the ID registry (PLAN "Error codes"; E-0014: no new KF- codes, KF-E-101 is the only
// code taken from the diagnostics catalog and it is a diagnostic, not an error code of this class in P002).
export class IdRegistryError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'IdRegistryError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
