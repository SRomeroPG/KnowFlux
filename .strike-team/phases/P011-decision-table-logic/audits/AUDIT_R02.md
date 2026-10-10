# P011 audit R02 (re-audit)

- Audited commit: `0e8f741ac3aecf410f45cfd73e4609372c46c8ec` (product: remediation). In-round test addition: `023daae` (conformance only; no product path changed). Control-plane handoff: `0ad205b`.
- Auditors (fresh instances, blind pass confirmed by each):
  - `algorithm-determinism-auditor` (sonnet). It re-verified F01-F11 and ran a regex differential, old engine against new, on 30000 + 3000 patterns with 0 differences.
  - `test-conformance-auditor` (sonnet). It applied about 95 mutants, including every R01 surviving mutant and the re-introduction mutants, all of which were killed; 14 survived, and 5 of those are informative.
- Foreman commands at `023daae`:
  - `npm run build`: 19 schemas.
  - `npm run lint`: clean.
  - `npm test`: 587/587.
  - `git diff --check`: clean.
  - TRACEABILITY check: 102 `FILE :: title` references, all present; every 4 group references resolve to existing title families; all 128 case ids exist.
- Foreman reproductions, re-run at `0e8f741` with scratchpad `repro-p011.mjs`:
  - `(?:(?:(?:(){1000}){1000}){1000}){1000}` compiles in 1 ms.
  - The 1200-range class pattern compiles in 4 ms.
  - The null-absent overlap gives `KF-E-312` with `proof: enumeration`, `witness: {DE-0001.m: null}`.
  - The exhaustive absent case is unchanged, `result: null`, as E-0025 (2) records.

## Re-verification of R01 findings

| R01 finding | Status | Evidence |
|---|---|---|
| F01 zero-width nested repeats | FIXED | Foreman: the four-level form compiles in 1 ms. The auditor probed every amplification shape and all finish in under 20 ms. Conformance F-R3d/F-R3e use child processes with a hard timeout. |
| F02 per-copy class tables | FIXED | Foreman: 4 ms. Auditor: 11 ms with flat RSS. The per-copy mutant is killed by F-R3d/F-R3e. |
| F03 overlap ignores absent inputs | FIXED | Foreman repro gives `KF-E-312` with a null witness. F-V10/F-V10b/F-V4/F-V4b kill the mutant that enumerates without null. |
| F04 `KF-E-310` vs non-decimal scalars | FIXED | Every type combination was probed. F-Q12..F-Q15 apply. |
| F05 ref/suffix ambiguity | FIXED | F-B6/F-B6b. The exact-ref-priority mutant is killed. |
| F06 escape whitelist | FIXED | All 128 ASCII escapes were enumerated, and the accepted set is exactly the E-0022 D-05 list. F-R2d. |
| F07 set vs closed bound | FIXED | F-V6d/F-V6e. The closed-to-open mutants are killed. |
| F08 evaluation sort order | FIXED | F-S6/F-S7. The unsorted mutant is killed. |
| F09 anchors on `\n` | FIXED | F-R1d. The mutant is killed. |
| F10 cap boundary | FIXED | F-R2e: exactly 100000 compiles, 100001 is `KF-E-315`. The `>=` mutant is killed. |
| F11 code points, null literals | FIXED | F-O27, F-L8. The NFC, `ne: null` and `not_in` null mutants are killed. |

## New findings this round

### F-P011-R02-T02 — REQUIRED — LOW — boolean or scalar literal on a quantity input not exercised (E-0025 (3)) — FIXED IN ROUND
- Observed at `0e8f741`: a mutant that skips `KF-E-310` for a boolean literal on a quantity input survived. The product code was correct, as the auditor's probe showed.
- Fix: the conformance engineer added F-Q15 in `023daae`. It covers `true`, `eq: false`, `lt: true`, `in: ['X', true]` (one diagnostic per element) and `between: [true, '1']`, plus near-misses. It passes against the unchanged engine.
- Handled per PROTOCOL_V2 §5: a single LOW item confined to the remediation area, fixed and re-verified within the round. It is a test gap, so the fix went to the owner of `expected/`.

## ADVISORY (do not block)
- A-01 (carried from R01): match cost is linear with a large constant. It is deferred to P014, the scenario evaluation budget.
- T01: `tighten()` handling of equal values with mixed inclusivity. A mutant there only makes the proof more conservative. Cases were added anyway (F-V6f in `023daae`).
- AD-1: when several defects exist, the code in a thrown typed error depends on key insertion order. The PLAN states this precedence is not asserted, and returned diagnostics do not depend on order.
- The following are unspecified or implementation-defined and have no tests: a non-string `unit` in a quantity-shaped value on a non-quantity input, the `rule_indexes` length tiebreak, and the exact boundary of regex nesting at 1000.
- The F02 unit test asserts an internal field (`program.classes.length`). Timing assertions of 2 s and 5 s may flake under heavy CI load.
- R01 A-04 is still open: conformance F-A5 shells out to `git status`. Fix it before P028 edits `bin/` or `package.json`.

VERDICT: ACCEPTED
