# P011 remediation R01 (kf-implementer, fresh instance)

Input: `audits/AUDIT_R01.md` (F01-F11 REQUIRED, A-01..A-07 ADVISORY), errata E-0025, E-0026, E-0027, and the conformance cases added by the conformance engineer (uncommitted at the start of the round). Scope: only the REQUIRED findings plus A-06 (stale HANDOFF/TRACEABILITY text).

## Result

| Check | Output |
|---|---|
| `npm run build` | `Compiled 19 JSON Schemas.` |
| `npm run lint` | clean |
| `node --test test/conformance-p011-decision-table.test.mjs` | red before: 157 of 170 passed, 13 failed (F-R2d, F-R3d, F-R3e, F-B6, F-B6b, F-L8, F-Q12, F-Q13, F-Q14, F-V4, F-V4b, F-V10, F-V10b); green after: 170 of 170 |
| `node --test test/p011-*.test.mjs test/conformance-p011-decision-table.test.mjs` | 278 of 278 (108 unit + 170 conformance), 1.6 s |
| `npm test` | 585 of 585, todo 0 |
| `git diff --check` | clean (only the usual LF-to-CRLF notices) |

Files changed by this round (all inside the allowed list): `framework/engine/regex-re2.mjs`, `framework/engine/decision-table.mjs`, `test/p011-regex.test.mjs`, `test/p011-decision-table.test.mjs`, and under the phase directory `TRACEABILITY.md`, `HANDOFF.md`, `remediation/REMEDIATION_R01.md`. Nothing else was touched (P002 files, conformance data and `test/conformance*` visible in `git status` belong to other agents or to the conformance engineer).

## Per finding

### F01 — zero-width nested counted repeats hang `compileRe2` (REQUIRED, HIGH)
- Root cause: `sizeOf` returned 0 for a repeat of a node that emits no instruction, so the 100000-instruction cap never tripped, while `emitRepeat` still looped `count` times per nesting level (1000^3 or 1000^4 iterations of no-ops).
- Fix (`regex-re2.mjs`): a single `shape()` pass before emission memoizes `node.size` per node, replaces every node that would emit nothing (empty group, repeat of such a node, `{0}`/max 0) by one shared frozen `EMPTY` node, and drops empty items from concatenations. After the pass, every remaining node emits at least one instruction and a concatenation holds only non-empty items, so emission work is proportional to the instructions emitted, which the cap bounds (E-0027 (1): other constructs' counts are implementation-defined, provided the cap bounds compile time and memory). Matching semantics are unchanged (a repeat or group of the empty string matches the empty string).
- Red before (same machine, old engine from `HEAD`, `compileRe2` only): `(?:(?:(){1000}){1000}){1000}` 3596 ms (audit: 6588 ms); `(?:(?:(?:a{0}){1000}){1000}){1000}` 8899 ms; `(?:(?:(?:(){1000}){1000}){1000}){1000}` did not return (killed, as in the audit). Conformance `F-R3d` 23.4 s and `F-R3e` 28.0 s, both failing. Unit tests run against the old engine: `test/p011-regex.test.mjs` did not finish within 100 s.
- Green after: `empty-3` 1 ms, `empty-4` 0 ms, `zero-3` 0 ms (compile, same script). `F-R3d`, `F-R3e` pass; unit `§11.4 l.612 (AUDIT R01 F01)` and `dropping zero-width items does not change what matches` pass.

### F02 — class tables copied per instruction copy (REQUIRED, MEDIUM)
- Root cause: the emitter built a fresh `Int32Array` of the class ranges for every emitted class instruction (program size x class ranges; auditor measured ~1.09 GB).
- Fix: the table is built once per class AST node in `shape()` (`node.table`); the emitter registers it once per node in `classes` (a `Map` from node to index) and each copy only emits `OP_CLASS index`. Total table memory is bounded by the pattern text. Class membership at match time now uses binary search over the flat sorted range table (the table is sorted and merged), so match cost no longer grows linearly with the number of ranges either (not required by the finding; a side benefit, covered by `class membership at range boundaries`).
- Red before: `(?:[1200 distinct code points]{1000}){99}` compiled in 3933 ms here (audit 8544 ms, ~1.09 GB RSS); conformance `F-R3d` and `F-R3e` fail.
- Green after: 5 ms, `program.size` 99001, `program.classes.length` 1 (asserted by unit `§11.4 l.612 (AUDIT R01 F02)`).

Before/after compile timings (`compileRe2`, ms, this machine; script in the scratchpad runs the four patterns of `framework/conformance/p011-decision-table/regex-bound-patterns.mjs`):

| pattern | before | after |
|---|---|---|
| `empty-3` `(?:(?:(){1000}){1000}){1000}` | 3596 | 1 |
| `empty-4` four levels | not finished (killed) | 0 |
| `zero-3` `(?:(?:(?:a{0}){1000}){1000}){1000}` | 8899 | 0 |
| `class-1200` `(?:[1200 cps]{1000}){99}` | 3933 | 5 |

### F03 — `unique` overlap enumeration ignores absent inputs (REQUIRED, MEDIUM; E-0025 (1))
- Root cause: `checkOverlap` enumerated domain values only.
- Fix (`decision-table.mjs`): enumeration applies when the product of the domain sizes and the product of (size + 1) are both within the limit; `forEachTuple(..., withAbsent=true)` appends `null` (last) to every input's values; the witness reports `null` for the absent value. Otherwise the existing interval/set reasoning applies (it already fails closed for `not`/`is_null`). The exhaustiveness proof is unchanged (domains only, E-0025 (2)).
- Red before: audit reproduction (enum `[X, Y]`, `not X` versus `is_null`) gave `[]` from the check and `KF-E-312` from `evaluate({})`; conformance `F-V4`, `F-V4b`, `F-V10`, `F-V10b` failed; unit `§12.1 l.633 (E-0025 (1))` x2 failed against the old engine.
- Green after: all pass. E-0025 (2) (exhaustive enum table, absent input -> `status: ok`, `result: null`) is asserted in unit `§12.1 l.634 (E-0025 (2))` and conformance `F-X13` (behavior unchanged; green before and after, as the audit says).
- Assertion restated (the one unit assertion E-0025 explicitly changes, authorized by the task): `test/p011-decision-table.test.mjs` `§12.1 l.633 (E-0020): all-enum tables within the limit ...` used to expect `[]` for domain `[X, Y]` with `proofLimit: 2`; it now expects `[]` for `proofLimit: 3` (products 2 and 3) and `not_proven_disjoint` for `proofLimit: 2` (3 > 2). Nothing else of that test changed.

### F04 — quantity versus non-decimal scalar is not `KF-E-310` (REQUIRED, LOW; E-0025 (3), E-0027 (3))
- Root cause: `readOperand` and `typeSupplied` handled quantity-against-bare-scalar only for decimal inputs; other types hit `TYPE_MISMATCH` / `INVALID_DECIMAL`.
- Fix: statically, a quantity-shaped literal on any non-quantity input is one `KF-E-310` (`expected_unit: null`, `found_unit` = its unit), after the existing `UNKNOWN_UNIT` / `INVALID_DECIMAL` validation, with no `KF-E-314` for enums; a string or boolean literal on a quantity input is `KF-E-310` with `found_unit: null` (number literals remain `INVALID_DECIMAL`). At evaluation, a supplied quantity for a decimal/enum/string/boolean input is `KF-E-310` (`expected_unit: null`), and a supplied string/boolean for a quantity input is `KF-E-310` (`found_unit: null`).
- Red before: conformance `F-Q12`, `F-Q13`, `F-Q14` failed (`TYPE_MISMATCH` thrown).
- Green after: all pass; unit `§11.2 l.589 (E-0019, E-0025 (3), E-0027 (3), AUDIT R01 F04)`.
- Existing unit assertions changed because E-0025 (3) overrides the earlier typed error (each is a behavior E-0025 (3) states explicitly: bare scalar against a quantity is `KF-E-310`): `§12.1 l.628 ...` (literal `'abc'` on a quantity input moved from `INVALID_DECIMAL` to a `KF-E-310` assertion), `§11.1 l.583 ...` (supplied `true` for a quantity input: `TYPE_MISMATCH` -> `KF-E-310`; a supplied list stays `TYPE_MISMATCH`), `§12.1 l.623 ...` (`Q('1')` on a string input: `TYPE_MISMATCH` -> `KF-E-310`). Reported here so the Foreman can veto; the instruction named only the `proofLimit` assertion, but these three are the same E-0025 effect and are required by `F-Q12`/`F-Q13`.

### F05 — a key that is one input's full ref and another's suffix binds silently (REQUIRED, LOW; E-0019, E-0027 (2))
- Root cause: `makeBinder` preferred an exact `ref` match before looking at suffixes.
- Fix: candidates for a key are all inputs whose full `ref` equals it or whose last-`.` suffix equals it (one `Map`, deduplicated); zero is `UNBOUND_FIELD`, two or more `AMBIGUOUS_FIELD`. Inputs `x` and `A.x`: key `x` is ambiguous, key `A.x` binds by full ref; the same binder serves supplied values (E-0022 D-02).
- Red before: conformance `F-B6`, `F-B6b` failed. Green after: pass; unit `§12.1 l.620 (E-0019, E-0022 D-02, E-0027 (2), AUDIT R01 F05)`.

### F06 — escape whitelist wider than E-0022 D-05 (REQUIRED, LOW)
- Root cause: `isAsciiPunctuationEscape` accepted any escaped ASCII punctuation.
- Fix: `isMetacharacterEscape` accepts only `\ ^ $ . | ? * + ( ) [ ] { }` and `-` (plus the existing `\n \t \r \f \v` and `\d \w \s \D \W \S`); every other escape (`\<`, `\=`, `\ `, `\/`, `\_`, ...) is `{ok: false}` and therefore `KF-E-315`, inside and outside classes.
- Red before: conformance `F-R2d` failed. Green after: pass; unit `§11.4 l.612 (E-0022 D-05, AUDIT R01 F06)`.
- Existing unit assertion changed: `§11.4 l.612 (E-0022 D-05): unlisted constructs ...` asserted that `\/` is accepted; the pattern is now `...\$\-\\` (no `\/`), and `\/` is asserted as rejected in the new F06 test. This follows the finding verbatim.

### F07 — value set versus closed bound not exercised (REQUIRED, MEDIUM; test gap)
- Product code was already correct. Conformance `F-V6d`/`F-V6e` (already green before and after) cover it; unit `§12.1 l.633 (E-0020 (b), AUDIT R01 F07)` repeats the six pairs in both orders. Red-before for a test gap means a mutant: not executed here (mutation runs are the auditors' job); the assertions pin the closed/open boundary values the audit lists.

### F08 — evaluation diagnostics sort order not exercised (REQUIRED, LOW; test gap)
- Conformance `F-S6`, `F-S7` and unit `§36 l.1600 (PLAN sort key, AUDIT R01 F08)` assert `[KF-E-310, KF-E-314]` order and `/inputs/10` before `/inputs/2`. Green before and after (the product code sorts); the tests fail if `sortDiagnostics` is removed from `failure()` because the input order differs from the sorted order in both cases.

### F09 — `^`/`$` on `\n`-only text not exercised (REQUIRED, LOW; test gap)
- Conformance `F-R1d` and unit `§11.4 l.612 (E-0022 D-05, AUDIT R01 F09)`: `^$` on `"\n"` and `"a\n"` false, `$` on `"\n"` true, plus `^a$`/`^a`/`a$`/`^b` around newlines. Green before and after.

### F10 — program-size cap boundary on the accept side (REQUIRED, LOW; test gap)
- Conformance `F-R2e` and unit `§11.4 l.612 (... E-0026 (2), E-0027 (1), AUDIT R01 F10)`: `(?:a{1000}){99}a{999}` compiles with `program.size === 100000` (the final match counts); `(?:a{1000}){99}a{1000}` and three more over-cap patterns are rejected. Green before and after. (The unit test does not search a 100000-instruction program over 99999 characters: that costs minutes at the current per-character constant, audit A-01; a 9999-character search on a program near the cap stands in for it.)

### F11 — code-point equality and literal `null` operands (REQUIRED, LOW)
- E-0026 (1) product change: `not_in` is now true only if every element is non-null (and not a finding) and differs from the input; a `null` element makes it false. `ne: null` was already false and `in` ignores `null` elements (unchanged, now asserted). Code-point equality was already exact (no normalization anywhere).
- Red before: conformance `F-L8` failed (`not_in: ['y', null]` with `'x'`). `F-O27` (already green) pins the NFC/NFD pair. Green after: pass; unit `§12.1 l.623 (E-0019, AUDIT R01 F11)` and `§11.3 l.607 (E-0026 (1), AUDIT R01 F11)`.

### A-06 (stale text)
- `HANDOFF.md`: status line, superseded markers on the first hand-off verification and the disputed-expectation section (both rows were fixed in `5712486`), updated N-09 / escapes / supplied-quantity notes, A-01 carried to P014. `TRACEABILITY.md`: header no longer says 145 of 148; R01 rows updated with the new test titles and conformance keys; E-0025, E-0026, E-0027 rows added; stale "disputed" notes removed.

## Red-before / green-after of the unit tests against the pre-fix engine

The new unit files were run against an export of `HEAD:framework/engine` (scratchpad, not the repository): `test/p011-decision-table.test.mjs` 12 failed of 69 (the new F03 x2, F04, F05, F11 tests and the restated `proofLimit` assertion plus the three changed-by-E-0025 assertions; the three fixture-reading tests also fail there only because the export has no `framework/conformance` tree); `test/p011-regex.test.mjs` did not complete within 100 s (F01 hang). After the fix: 69 of 69 and 22 of 22.

## DECISION_NEEDED

None.

## Disputed expectations

None. All 170 conformance cases pass with the expectations as written.

## Deferred

- ADVISORY A-01 (linear match cost with a large constant; no input-length bound in spec or PLAN) is carried to P014. The binary-search class lookup reduces the per-class cost but the per-character cost is still O(program size).
- ADVISORY A-02..A-05, A-07: not in scope.
