# P002 escalation (STALLED after R03)

Written by the Foreman on 2026-10-10 under PROTOCOL_V2 §8 (three consecutive `CHANGES_REQUESTED` rounds).

## Attempts
| Round | Product SHA | REQUIRED findings | What happened |
|---|---|---|---|
| R01 | `6e5ac16` | 10 | A union merge of two promotions made the registry invalid. This was a defect in errata E-0012 itself, now amended by E-0024. Also found: `id_alias` lost after a move, a permanent renumber accepted, any revision accepted as the canonical branch, and test gaps. |
| R02 | `08b3910` | 5 | Promotion from a non-canonical checkout produced branch-dependent facts (E-0029). Also: an object-read failure was read as "absent", a concurrent edit was lost, the permanent-renumber check was order-blind (E-0034), and one test gap. |
| R03 | `424a2bf` | 6 | All prior findings were fixed. Six new test gaps were found (mutants survive), each confirmed against a correct engine. No product defect was found. |

## Diverging interpretations
None remain open. Every decision is recorded in the errata: E-0009..E-0016, E-0023, E-0024, E-0028, E-0029, E-0034, E-0035. The rounds did not converge because each fresh audit angle exposed a deeper layer:
- R01: errata defects and core semantics;
- R02: the checkout model and I/O failure modes;
- R03: test completeness only.

The engine has converged; the remaining gaps are test cases.

## Recommended decision
Retry once, as the protocol allows after the next unrelated acceptance:
1. A fresh `kf-conformance-engineer` adds the six cases listed in `audits/AUDIT_R03.md` (T01-T06). No product change is expected. If a case fails, a fresh implementer fixes the root cause.
2. One fresh `test-conformance-auditor` re-applies the R03 surviving mutants, and one fresh `spec-compliance-auditor` re-checks the full trace.

If that round still finds REQUIRED items, a human should decide whether to accept P002 with an explicit test-coverage waiver or to narrow its scope.

## Dependency impact
P007 (full `kf validate`) depends on P002, so P007 and everything downstream of it on Track A wait. P003, P028 (Track A) and P013 (Track B) do not depend on P002 and continue.
