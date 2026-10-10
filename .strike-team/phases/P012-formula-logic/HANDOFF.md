# P012 Formula Logic - HANDOFF (round R01)

Implementer: `kf-implementer`. Base commit when written: `3936f12` (conformance slice; the working tree carries uncommitted Foreman edits to `.strike-team/STATE.yaml` and the errata that are not part of this work). **Product commit: not yet made** (the Foreman commits; this file cannot name a SHA that does not exist). Binding inputs: PLAN "Foreman decisions after planning" (E-0036), E-0037, E-0030..E-0033.

## Scope delivered (against the PLAN)

| PLAN deliverable | Status |
|---|---|
| `framework/engine/decimal-ops.mjs`: `absDecimal`, `roundDecimal`, `roundDecimalSignificant`, `divideDecimal`, `formatDecimalFixed` | done |
| `framework/engine/formula.mjs`: `checkFormula`, `evaluateFormula`, `DEFAULT_PRECISION = 28`, `MAX_EXPRESSION_DEPTH = 1000` | done |
| Additive P011 edits: four appended exports in `decision-table.mjs`; `FORMULA_DIAGNOSTIC_CATALOG`, `makeFormulaDiagnostic` in `logic-diagnostics.mjs`; `FORMULA_ERROR_CODES` in `logic-errors.mjs` | done, `git diff --numstat` shows `84 0`, `24 0`, `11 0` (0 deletions) |
| `decimal.mjs`, `units.mjs`, `regex-re2.mjs`, every P011 test and fixture | untouched |
| Tests `test/p012-*.test.mjs` (clause-named, positive and negative) | done: 66 tests |
| `TRACEABILITY.md` | every row `PASS` with a test title or case id (D-01..D-03 rows are decided by E-0036/E-0037 and implemented) |

No `bin/`, `package.json`, schema, `eslint.config.js`, fixture or `expected/` path was touched. No dependency was added. Decisions D-01 (unknown unit after `KF-E-316`, no cascade, E-0037 (2) identity among known units), D-02 (semantic protection criterion, E-0037 (1) for nested `all`/`not` guards) and D-03 (normalized-coefficient significant digits) are implemented as the errata state them.

## Files changed

New: `framework/engine/formula.mjs`, `framework/engine/decimal-ops.mjs`, `test/p012-formula.test.mjs`, `test/p012-decimal-ops.test.mjs`.
Edited (append-only): `framework/engine/decision-table.mjs`, `framework/engine/logic-diagnostics.mjs`, `framework/engine/logic-errors.mjs`.
Phase files: `.strike-team/phases/P012-formula-logic/TRACEABILITY.md`, this file.

## Verification (run on the working tree, Windows, Node >= 24)

- `npm run build`: ok (`Compiled 19 JSON Schemas.`). `npm run lint`: ok (no output). `git diff --check`: clean.
- `npm test`: `tests 798, pass 682, fail 0, skipped 1, todo 115` (baseline before this work: `732 / 616 / 0 / 1 / 115`; the +66 passing tests are the two new files).
- Conformance (`node --test --test-reporter=tap test/conformance-p012-formula.test.mjs`): **115 / 115 todo cases pass** (`not ok ... # TODO` count 0, `ok ... # TODO` count 115). The `PENDING` marker was not edited (forbidden path). To prove the cases pass as real tests I ran a temporary copy with the marker removed (`todo: PENDING` deleted): `tests 118, pass 117, fail 0, skipped 1` (the skip is the opt-in F-E1), then deleted the copy. The Foreman/conformance engineer can flip `PENDING = false` in the real file.
- `KF_P012_BOUNDARY=1` F-E1: `ok` (no fixture, `expected/`, schema, `bin/`, `package.json`, `eslint.config.js` path changed).
- P011 suites unchanged and green (F-E2c counts 172 + 10 + 7 + 22 + 69 pass inside the conformance run; also in `npm test`).
- `git status` shows only: the four new files, the three additive engine edits, `TRACEABILITY.md`, `HANDOFF.md`, plus the Foreman's own pre-existing modifications of `STATE.yaml` and the errata.

## Behaviors chosen where the PLAN notes "not asserted" (documented as the PLAN asks)

- **N-03/P-11 evaluation order.** Arguments of an operator are all evaluated left to right before any null check, so a runtime defect (`INVALID_RANGE`, `INEXACT_DIVISION`) in a later argument surfaces even when an earlier argument is `null`. `clamp` raises `INVALID_RANGE` whenever `lo` and `hi` are non-null and `lo > hi`, even if `x` is `null`.
- **N-05.** Unknown extra keys in `logic`, `output`, `rounding`, a node, a guard are `INVALID_EXPRESSION` (the accepted `logic.schema.json` has `additionalProperties: false` everywhere). `const.unit` that is not a string is `INVALID_EXPRESSION`.
- **N-06.** A malformed entry of `options.inputs` (not a mapping, missing `ref`/`type`) is `INVALID_ARGUMENT` (it is a caller argument, not the formula); the P011 codes `UNSUPPORTED_INPUT_TYPE`, `INVALID_INPUT_DECLARATION`, `UNKNOWN_UNIT` are unchanged. `INVALID_TABLE` raised inside the predicate machinery is re-thrown as `INVALID_EXPRESSION` (E-0033).
- **N-08.** `decimals`, `digits`, `precision` must be safe integers; a `decimals` too large to represent is `INVALID_ARGUMENT` from `decimal-ops.mjs` (the `RangeError` of BigInt is mapped, never leaks). `checkFormula` does not evaluate, so a formula with such `decimals` checks clean and fails at evaluation.
- **`compileLogicPredicate` return.** The PLAN names `{ node, findings }`; it also returns `mentions` (ascending input indexes the predicate reads), which the `KF-E-313` proof needs ("mentions only R"). It is an added field, not a change.
- **Root depth.** The root expression counts as depth 1; depth 1000 is accepted, 1001 is `INVALID_EXPRESSION` (raised by the validation walk before any deeper recursion; tested up to 100,000 nested nodes).
- **`precision` option.** Must be a safe integer >= 1 (`2**60`, `NaN`, `Infinity`, strings, booleans, `null` are `INVALID_ARGUMENT`).

## DECISION_NEEDED

None.

## Disputed expectations

None. (E-0037 already superseded the PLAN rows F-Zn4 for `{all: [...]}` and `{not: ...}`; the slice and the implementation follow E-0037.)

## Deferred / downstream notes

- **No formula `BR` was added to `acme-formulation`** (PLAN "Fixture slice"): P014 (first consumer, `kf check-rules` against `asserts`) or P027 introduces a `formula`-facet `BR` with its `DE` fields, `OUT` target and `SC` cases, at the Foreman's choice. The P012 slice is data plus a test and is ported by the phase that builds the `expected/` runner (P028).
- P007 wires: `logic.decimal_precision` to the `precision` option, `units.yaml` discovery, error-code mapping, `OUT` existence of `raise`, `output.ref` resolution. P014 builds `inputs` from the entity model. P007/P014 must re-source `FORMULA_DIAGNOSTIC_CATALOG` from the catalog module when P028 creates it (PLAN R-10).
- `PENDING` in `test/conformance-p012-formula.test.mjs` is still the todo marker (forbidden path for the implementer).
