# P012 remediation R01

Input: `audits/AUDIT_R01.md` (CHANGES_REQUESTED), errata E-0030..E-0033, E-0036..E-0038. Base: `0bed128` plus the conformance engineer's uncommitted R01 cases (`framework/conformance/p012-formula/cases-r01.mjs`, `units-ufz.yaml`, additions to `p012-formula.yaml` and `test/conformance-p012-formula.test.mjs`), which were not edited.

## Files changed (implementer)

- `framework/engine/decision-table.mjs`: inside the P012-appended block only (after `compileLogicInputs`' header): new `assertDensePredicate`, called first by `compileLogicPredicate`; `compileLogicInputs` iterates by index instead of `.map`. `git diff c10ae95 --numstat` = `109 0` (0 deletions).
- `framework/engine/formula.mjs`: the `guards` loop iterates by index instead of `forEach`.
- `test/p012-r01.test.mjs` (new): six clause-named tests.
- `.strike-team/phases/P012-formula-logic/TRACEABILITY.md`, this file.

## F-P012-R01-D01 (product defect)

- Root cause: `compilePredicate` (P011, frozen) builds the children of `all`/`any` with `list.map(...)`, which skips the holes of a sparse array. The compiled node then held `undefined` children, and the appended `predicateInputs` dereferenced `node.t` of `undefined`. The same `.map`/`forEach` hole-skipping pattern also existed in `compileLogicInputs` (`options.inputs`) and in the `guards` loop of `formula.mjs`, where a hole was silently skipped (a malformed guard accepted).
- Fix: `assertDensePredicate(predicate, pointer, depth)` walks the raw predicate (all/any/not, bounded by the P011 `MAX_DEPTH`; deeper input is left to `compilePredicate`) and throws `INVALID_EXPRESSION` (details `{at}`) for a missing index, before compilation. `compileLogicInputs` and the guards loop use index loops, so a hole reaches the existing "must be a mapping" check (`INVALID_ARGUMENT` for inputs, `INVALID_EXPRESSION` for guards). Sparse operator `args` were already `INVALID_EXPRESSION` (index loop in `compileExpression`).
- Red before: `node --test test/conformance-p012-formula.test.mjs` failed exactly F-RM-D01 (`{all: [hole, x]} in a guard via checkFormula: no raw TypeError (Cannot read properties of undefined (reading 't'))`). `test/p012-r01.test.mjs` run against `HEAD` engine copies in the scratchpad: 2 fail (both D01 tests), 4 pass.
- Green after: F-RM-D01, F-RM-D01b, F-RM-D01c and the two D01 unit tests pass.

## T01..T07 (test gaps; no product change needed, every new case passes)

- T01 nested exactness: covered by conformance F-RM-T01 and unit test `E-0032 (1): nested add, subtract, multiply, min, max, abs, clamp and exact divide ...` (added to `p012-r01.test.mjs`; passes on the unmodified engine, i.e. the product was already correct and the gap was only the missing evidence).
- T02 n-ary unit fold: F-RM-T02.
- T03 sort of supplied-value findings: F-RM-T03.
- T04 unit text byte order: F-RM-T04.
- T05 `if` with an unknown-unit branch (E-0037 (2)): F-RM-T05.
- T06 depth boundary (root = 1): F-RM-T06 and unit test `E-0032 (6) and E-0038 (2): ...`.
- T07 `raise` lower bound: F-RM-T07.
- E-0038 (1)/(3) behaviors: F-RM-E38a, F-RM-E38b and unit tests `E-0038 (1): ...`, `E-0038 (3): ...`. The product already implemented eager argument evaluation and the `clamp` range check with a null `x`.
- Advisory A1 (extra key in `output`): F-RM-A1 passes (already rejected by `hasKeys`).

## Verification

- `npm run build`: 19 schemas compiled. `npm run lint`: clean.
- `npm test`: 817 tests, 816 pass, 0 fail, 1 skipped (opt-in F-E1).
- `KF_P012_BOUNDARY=1 node --test test/conformance-p012-formula.test.mjs test/p012-*.test.mjs`: 203 pass, 0 fail, 0 skipped.
- `git diff --check`: clean. `git diff c10ae95 --numstat` on `decision-table.mjs`, `logic-diagnostics.mjs`, `logic-errors.mjs`: `109 0`, `24 0`, `11 0`; `decimal.mjs`, `units.mjs`, `regex-re2.mjs` show no diff.

## DECISION_NEEDED / disputed expectations

None.
