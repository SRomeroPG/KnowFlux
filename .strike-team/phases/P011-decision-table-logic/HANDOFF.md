# P011 HANDOFF (round R01, kf-implementer)

Base: product work was done on top of `ceb8bfc` (`P011 add conformance slice`). The worktree branch started at `d06ca4e`; it was brought to `ceb8bfc` with `git merge --ff-only ceb8bfc` (fast-forward only, no history rewrite). Nothing is committed: all changes are uncommitted in the worktree for the Foreman to commit. Product commit SHA: to be filled by the Foreman at commit time.

## Scope delivered (PLAN "Deliverables", with the Foreman decisions and E-0022 applied)

New engine modules (all ES modules, no side effects on import, imports only `./` siblings, no `node:` import, no dependency):

| File | Content |
|---|---|
| `framework/engine/logic-errors.mjs` | `LogicError` (`name`, `code`, `details`), `LOGIC_ERROR_CODES` (14 codes, ascending; no division codes, E-0022 D-04) |
| `framework/engine/decimal.mjs` | BigInt `{unscaled, scale}` decimals: `isDecimalString`, `parseDecimal`, `isDecimal` (branded), `compareDecimal`, `equalsDecimal`, `addDecimal`, `subtractDecimal`, `multiplyDecimal`, `formatDecimal`. No division, no rounding |
| `framework/engine/units.mjs` | `buildUnitRegistry`, `isUnitRegistry` (branded); no built-in unit, ids compared exactly, `conversions` must be `[]` |
| `framework/engine/regex-re2.mjs` | Own parser for the E-0021/E-0022 D-05 subset, program size cap 100000, nesting cap 1000, Pike NFA simulation over code points (`compileRe2`, `searchRe2`, `RE2_MAX_REPEAT`) |
| `framework/engine/logic-diagnostics.mjs` | `LOGIC_DIAGNOSTIC_CATALOG` (310, 311, 312, 314, 315; remediation only on 311), `makeDiagnostic`, `compareStrings` (code point = UTF-8 byte order), `sortDiagnostics` |
| `framework/engine/decision-table.mjs` | `checkDecisionTable`, `evaluateDecisionTable`, `DEFAULT_PROOF_LIMIT` |

Tests (new): `test/p011-decimal.test.mjs`, `test/p011-units.test.mjs`, `test/p011-regex.test.mjs`, `test/p011-decision-table.test.mjs` (92 tests; names start with the clause, e.g. `§12.1 l.633 (E-0020): ...`). `TRACEABILITY.md` filled (every row `PASS` with a test title or conformance case id). `framework/engine/id-registry*.mjs`, `package.json`, `package-lock.json`, `eslint.config.js`, schemas, conformance data, spec, errata untouched.

## Verification output

- Baseline (before my changes, at `ceb8bfc`): `npm run build`, `npm run lint`, `npm test` green with the 148 P011 engine cases `todo`.
- Final: `npm run build` -> `Compiled 19 JSON Schemas.`; `npm run lint` clean; `npm test` -> tests 457, pass 246, fail 0, todo 211 (the 148 P011 conformance cases plus P002's todo cases); `git diff --check` clean; `git status` shows only the new files above and `TRACEABILITY.md`/`HANDOFF.md`.
- Targeted run twice (deterministic repeat): `node --test test/conformance-p011-decision-table.test.mjs test/p011-*.test.mjs` -> tests 241, pass 93, fail 0, todo 148 both times.
- Conformance, per case (`node --test test/conformance-p011-decision-table.test.mjs`): **145 of the 148 todo cases pass**; the 3 failures (F-R1, F-R2, F-R2b) are all caused by two defective data rows, listed below. A scripted run of every row of `regex.yaml` (`match`, `compile_ok`, `rejected`, `accepted`) against the engine reports exactly those two rows and nothing else.

## Disputed expectations (not edited; supporting clauses)

Both are in `framework/conformance/p011-decision-table/regex.yaml`, which says "Patterns are single-quoted (backslashes literal)". YAML single quotes do not unescape, so a single `\` in the file is ONE backslash.

1. **F-R1**, `match` row `['\', 'a\b', true]` (compile must succeed, search must be true). The PLAN (F-R1) writes the pattern as `\\` (an escaped backslash matching a literal `\`), so the YAML needs `'\\'`. As written the pattern is a lone trailing backslash, which the SAME file lists in `rejected` (`'\'`, "trailing `\`", PLAN F-R2). The row contradicts F-R2 and F-R2b for the identical string: `compileRe2('\\')` (one backslash) cannot be both `ok: true` and `ok: false`. The engine rejects it (E-0021 "Anything else ... any syntax error"). Proved with the corrected pattern `\\` in `test/p011-regex.test.mjs :: §11.4 l.612: accepted syntax matches as an unanchored, case-sensitive search`.
2. **F-R2** and **F-R2b**, `accepted` (near-miss) row `'\1'`. PLAN F-R2 lists the near-miss as `\\1` (escaped backslash, then the digit 1). `'\1'` in the file is the backreference `\1`, which E-0021 names as rejected ("backreferences ... is `KF-E-315`") and which the file's own `rejected` list covers via `(a)\1`; E-0022 D-05 rejects every unlisted escape. The engine rejects `\1`. Proved with `\\1` / `(?:a)\\\\1` in `test/p011-regex.test.mjs` (`§11.4 l.612 (E-0022 D-05): accepted escapes ...`) and `test/p011-decision-table.test.mjs :: §12.1 l.626: matches is an unanchored RE2 search ...`.

Fix for the conformance engineer: change `['\', 'a\b', true]` to `['\\', 'a\b', true]` and `'\1'` to `'\\1'` in `regex.yaml`. With those two data fixes all 148 cases pass.

## DECISION_NEEDED

None blocking. Items below were not determined by spec + errata + PLAN; I chose the fail-closed option (TRIAGE section 4 allows it for N-xx) and list them so the Foreman can veto. All are reversible API/behavior choices with no persisted format.

- N-14 (`matches` typing): allowed on `string` and `enum` inputs; `decimal`, `quantity`, `boolean` -> `TYPE_MISMATCH` at check time. Options: also allow `decimal` (matching its string form); never allow `enum`.
- N-03 (`units`): strict shape. Top-level keys other than `units`/`conversions` are `INVALID_UNITS`; `conversions` must be present and `[]`; entries carry exactly `id`, `dimension`, `symbol` (`id`, `dimension` non-empty). Options: tolerate extra keys; allow absent `conversions`.
- N-02 (enum `domain`): `domain` present must be a non-empty list of distinct strings (else `INVALID_INPUT_DECLARATION`); `domain` on a non-enum input is `INVALID_INPUT_DECLARATION`; an enum without `domain` is accepted unless `exhaustive: true` (`missing_domain`). Options: allow empty or non-string domains.
- N-01: two inputs with the same `ref` -> `INVALID_INPUT_DECLARATION`.
- N-09: `null` is accepted as an operand of `eq`/`ne`/`in`/`not_in` (never matches, `eq: null` is false per E-0019); `null` for `lt`/`lte`/`gt`/`gte`/`between` is `INVALID_DECIMAL`. A number/boolean literal against `enum`/`string`/`boolean` inputs is `TYPE_MISMATCH`.
- N-07: `all` nested inside a row is flattened as a conjunction for the overlap proof (sound); a row containing `any`, `not`, `ne`, `not_in`, `matches`, `is_null`, or a null/bad operand is never proven disjoint.
- Matcher mapping with more than one operator key (`{gt: 1, lt: 5}`), an empty matcher mapping, or an operand mapping without exactly `{value, unit}` on a quantity input -> `INVALID_TABLE`.
- Regex corner cases not covered by E-0021/E-0022: an unescaped `{` that is not `{n}`, `{n,}`, `{n,m}` is rejected (RE2 would treat it as a literal); `}` and `]` outside a class are literals; a quantifier directly on `^`/`$` is rejected; `\` + ASCII punctuation (not `_`) is a literal; `[]a]` and `[^]a]` take a leading `]` as literal; a class range ending in a class escape is rejected; a counted repeat count is clamped while reading so huge digit strings are rejected, not overflowed.
- Supplied quantity with an undeclared unit id is `KF-E-310` (a different unit), not `UNKNOWN_UNIT` (that code is for table-side units). A bare YAML number for a quantity input is `INVALID_DECIMAL`; a boolean or non-quantity mapping is `TYPE_MISMATCH`.
- `evaluateDecisionTable` with a table that has a static 310/314/315 finding returns `status: error` before looking at the supplied keys (so an unbound supplied key is not reported in that case).
- `product` of `KF-E-311 over_limit` is a number, or a decimal string if it exceeds `Number.MAX_SAFE_INTEGER` (counts only; computed in BigInt).
- Depth guards: predicates and `then` nested deeper than 1000 levels, and regex groups nested deeper than 1000, are rejected (`INVALID_TABLE` / `{ok: false}`) so hostile input cannot overflow the stack. An empty `rules` list is accepted although the schema has `minItems: 1` (D-01: no schema validation here).

## Deferred / not done

- No wall-clock bound beyond the tested 5 s cases. Per-character matching cost is O(program size) with program size capped at 100000 instructions, so a 100000-instruction program on a very long text is slow but bounded (linear in the text for a fixed program).
- `KF-W-124`, `units.yaml` discovery, JSON Schema validation, `kf check-rules`, division/rounding/formulas, state machines: other phases (PLAN non-goals).
- Known fail-closed over-reporting (E-0020 by design): `KF-E-312 not_proven_disjoint` on actually disjoint rows that use `any`, `not`, `ne`, `not_in`, `matches`, `is_null` when the enumeration proof is not available.

## Notes for auditors

- Static scan evidence: `test/p011-decision-table.test.mjs :: §53 l.2037 item 9 (V-39)` and the conformance cases F-P1/F-P2 (both pass): no `Date`, `performance`, `Math.random`, `process.env`, `crypto`, `readFile`, `setTimeout`, `parseFloat`, `toFixed`, `toPrecision`; in `decimal.mjs` no `Number(`, `parseInt`, `Math.`; in `regex-re2.mjs` and `decision-table.mjs` no `new RegExp`, `RegExp(`, `.match(`, `.exec(`, `.test(`. The only `Number` uses are `Number.isInteger`/`Number.MAX_SAFE_INTEGER`/`Number(big)` for counts in `decision-table.mjs` (the product of enum domain sizes), never for decimals.
- `Decimal` and `UnitRegistry` identity is a module-private `WeakSet` brand (does not affect results).
