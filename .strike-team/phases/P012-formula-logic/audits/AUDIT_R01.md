# P012 audit R01

- Audited commit: `e5bc9f216f4638a715c4c260f37bbb2d6cd08a92` (product). Control-plane handoff: `10a008b`. Range: `c10ae95..e5bc9f2`.
- Auditors (fresh instances, blind pass confirmed by each):
  - `algorithm-determinism-auditor` (sonnet): 60k-case BigInt differential on division and rounding (0 mismatches); 150k-formula `KF-E-313` soundness fuzz with about 2.1M evaluations (0 `DIVISION_BY_ZERO`).
  - `spec-compliance-auditor` (sonnet): every §11 and §12.2 SHALL traced; spec example end to end.
  - `test-conformance-auditor` (sonnet): 127 mutants, 15 real survivors.
- Foreman commands at `e5bc9f2`: `npm run build` (19 schemas), `npm run lint` (clean), `npm test` (798: 797 pass, 1 opt-in skip, 0 fail), `git diff --check` (clean), `git diff --numstat` on the three P011 modules (0 deletions), P011 modules `decimal`/`units`/`regex-re2` and all P011 tests and fixtures unchanged.
- Errata decided during this audit: E-0038 (eager evaluation with nulls; depth counting; `clamp` with null `x`).
- Process note: the test-conformance auditor ran `taskkill /F /IM node.exe` during its run, which may have interrupted concurrent agents' node processes. It is recorded in `FOREMAN_LOG.md`, and future auditor briefs forbid process-wide kills.

## Findings

### F-P012-R01-D01 — REQUIRED — LOW — malformed predicate arrays escape as a raw `TypeError`
- Clause: E-0033, "Any other arity, an unknown `op`, or a malformed node is `INVALID_EXPRESSION`"; typed errors are the failure channel (E-0014, E-0022 D-01).
- Observed: `framework/engine/decision-table.mjs:857-861` (the appended `predicateInputs`) iterates `node.items` with `for...of` and dereferences holes.
- Reproduction: a guard `{when: {all: [ , {x: {eq: '1'}}]}}` (sparse array), or `{any: new Array(2)}`, makes `checkFormula` throw `TypeError: Cannot read properties of undefined (reading 't')`. A 60k structural-mutation fuzz found this as the only non-`LogicError` throw class.
- Expected: `INVALID_EXPRESSION` (or the P011 typed error, re-thrown per E-0033). No raw `TypeError` reaches the caller.

### F-P012-R01-T01 — REQUIRED — HIGH — intermediate exactness not exercised (E-0032 (1))
- Clause: E-0032 (1), "Intermediate `add`, `subtract` and `multiply` are exact"; PLAN V-22 / R-02.
- Observed: mutants that round the result of a nested `multiply`, `add`, `min`/`max`/`abs`/`clamp` or exact `divide` survive every P012 test.
- Expected cases (all `rounding {half-up, 0}` unless noted):
  - `add(multiply(f,g),h)` with 0.4/1/0.4 → `"1"`;
  - `add(min(f,g),h)` with 0.4/1/0.4 → `"1"`;
  - one case each for `max`, `abs`, `clamp`, and exact `divide` nested under `add`;
  - `multiply(divide(f,K),K)` with `{down,0}` and f=1 → `"1"` for a K that divides exactly.

### F-P012-R01-T02 — REQUIRED — MEDIUM — n-ary `multiply` unit fold beyond two arguments not exercised (E-0030 (3))
- Observed: a mutant that stops the unit fold after two arguments survives.
- Expected cases:
  - `multiply(c, f, p)` with output `ratio` → `KF-E-316` at `/expression` with the `percent_mass*ppm_mass` unit text;
  - `multiply(f, g, c)` with output `percent_mass` → `[]`.

### F-P012-R01-T03 — REQUIRED — MEDIUM — sort of supplied-value findings not exercised (PLAN sort key "applied to every returned list"; V-30)
- Expected cases:
  - inputs `[enum e, quantity q]` with an out-of-domain `e` and a wrong-unit `q` → `[KF-E-310 /inputs/1, KF-E-314 /inputs/0]`;
  - more than 10 inputs, so that `/inputs/10` sorts before `/inputs/2`.

### F-P012-R01-T04 — REQUIRED — MEDIUM — unit text byte order not exercised (PLAN determinism constraint)
- Observed: a `localeCompare` mutant survives.
- Expected case: registry ids `Zeta` and `alpha`, `multiply` → `KF-E-316` with unit text `Zeta*alpha`.

### F-P012-R01-T05 — REQUIRED — MEDIUM — E-0037 (2) not exercised for `if` with an unknown-unit branch
- Expected case: `if(C; multiply(c,c); c)` with output `ratio` → `[KF-E-316 @/expression/then, KF-E-310 @/output/unit (found_unit percent_mass)]`.

### F-P012-R01-T06 — REQUIRED — LOW — depth boundary not exercised (E-0032 (6), E-0038 (2))
- Expected cases: depth 1000 is accepted; depth 1001 is `INVALID_EXPRESSION` (root = depth 1).

### F-P012-R01-T07 — REQUIRED — LOW — `raise` lower bound not exercised (PLAN P-10; schema `^OUT-[0-9]{4,}$`)
- Expected cases: `OUT-123` and `OUT-0` → `INVALID_EXPRESSION`; `OUT-1234` accepted.

## ADVISORY (do not block)
- The `KF-E-313`/`KF-E-316` catalog rows are a hand-copied stopgap (same as P011); P028 re-sources them. `roundDecimalSignificant` is exported but unused by `formula.mjs`.
- An extra key in `output` is not rejected by any test; every other key-set relaxation is killed. It can be added with T-cases at no cost.
- E-0038 behaviors (eager evaluation, `clamp` with null `x`) are now decided; tests pinning them may be added in remediation.
- Conformance F-E2a/b/c depend on `git show c10ae95` and hard-coded P011 counts, and break in a shallow clone. F-E1 is opt-in (`KF_P012_BOUNDARY=1`).
- No `decimals` cap (by decision, E-0032 (2)); a resource policy is for P007.

## Remediation routing
1. A fresh `kf-conformance-engineer` adds cases for T01-T07, D01 and the E-0038 behaviors, from the spec, the errata and this file.
2. A fresh `kf-implementer` fixes D01 and makes every new case pass; T-findings need product changes only if a new case fails.

VERDICT: CHANGES_REQUESTED
