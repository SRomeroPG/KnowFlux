# P012 audit R02 (re-audit)

- Audited commit: `23889a5ea04494ec6884d90e01c0f3d8b7d1a848` (product, remediation). The in-round test addition `f037d41` changes conformance only; no product path changed. Control-plane handoff: `83f6be9`.
- Auditor: `test-conformance-auditor` (sonnet, fresh instance, blind pass confirmed). It applied 44 mutants: every surviving R01 mutant, its variants, and 21 aimed at the remediation diff. It also ran a structural fuzz with 58 holes.
- Foreman commands at `f037d41`:
  - `npm run build`: 19 schemas.
  - `npm run lint`: clean.
  - `KF_P012_BOUNDARY=1 npm test`: 817/817, with 0 skipped and 0 todo.
  - `git diff --check`: clean.
  - `git diff c10ae95 --numstat` on `decision-table.mjs` (109/0), `logic-diagnostics.mjs` (24/0) and `logic-errors.mjs` (11/0): no deletions.
  - `decimal.mjs`, `units.mjs` and `regex-re2.mjs` are unchanged.
  - Every case id cited in TRACEABILITY resolves.
- Foreman reproductions:
  - `repro-p012-d01.mjs` gives `LogicError INVALID_EXPRESSION`.
  - `repro-p012-r02.mjs` covers a hole under 8 nested `not`, and a multi-key mapping with a hole in its second key. Both give `LogicError INVALID_EXPRESSION`.

## Re-verification of R01 findings

| R01 | Status | Evidence |
|---|---|---|
| D01 sparse arrays | FIXED | Foreman repro. The auditor covered nested, multi-key, depth-900, `args`, `guards` and `options.inputs` holes, and the fuzz produced no raw `TypeError`. |
| T01 nested exactness | FIXED | Mutants P01b, P01d, P01e, P01f and N07b, plus a variant per operator, are killed by F-RM-T01 and `test/p012-r01.test.mjs`. |
| T02 n-ary unit fold | FIXED | P37 is killed by F-RM-T02. |
| T03 value-finding sort | FIXED | N21b is killed by F-RM-T03. |
| T04 unit-text byte order | FIXED | O15 is killed by F-RM-T04. |
| T05 `if` with an unknown branch | FIXED | The mutant is killed by F-RM-T05. |
| T06 depth boundary | FIXED | N19a, N19b and two depth-counting variants are killed by F-RM-T06. |
| T07 `raise` lower bound | FIXED | O29 and O29b are killed. |

## New findings this round

### F-P012-R02-T01 — REQUIRED — LOW — D01 coverage did not reach deep or multi-key shapes (E-0033) — FIXED IN ROUND
- Observed at `23889a5`: two mutants of the new `assertDensePredicate` survived. One cut recursion off at depth 5 (M05); the other examined only the first key of a mapping (M07). The product was correct, as the Foreman's repro shows.
- Fix: in `f037d41` the conformance engineer extended F-RM-D01 with 9 more shapes: 8- and 900-level `not` and `all` nesting, and multi-key mappings in both key orders. Each runs through both check and evaluate, in a guard and in an `if` cond. They pass against the unchanged engine.
- Handling under PROTOCOL_V2 §5: a single LOW item, confined to the remediation diff's tests, fixed and re-verified within the round. The two surviving mutants are one finding, because they are two shapes of the same remediated behavior.

## ADVISORY (do not block)
- Holes in operand lists inside P011 matchers (`in`, `not_in`) and in an enum `domain` are accepted silently. This behavior is inherited from accepted P011 code, which P012 may extend only additively. YAML and JSON parsers cannot produce holes, so only programmatic callers are affected. Carried to P014 (scenario evaluation hardening).
- The error pointer (`at`) for a hole is not asserted (M23).
- Advisory items carried from R01: the hand-copied 313 and 316 catalog rows (P028 to re-source them); no cap on `decimals` (resource policy is P007's); F-E2a/b/c need git history; F-E1 is opt-in.

VERDICT: ACCEPTED
