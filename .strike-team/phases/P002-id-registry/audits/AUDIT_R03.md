# P002 audit R03 (re-audit)

- Audited commit: `424a2bf8b13b9e79ed6c57c4dbff47b48f0f3b42` (product, R02 remediation). Control-plane handoff: `3a10c96`. Range: full phase `8dee230..424a2bf`; remediation diff `08b3910..424a2bf`.
- Auditors (fresh instances; each confirmed the blind pass):
  - `spec-compliance-auditor` (sonnet): re-verified all R01 and R02 findings; 28 mutants.
  - `integration-regression-auditor` (sonnet): clean clone, 614/614 on Windows; four end-to-end scenarios. Linux was not run because a Docker command was denied by the permission system; CI covers ubuntu and windows.
  - `test-conformance-auditor` (sonnet): 52 mutants; 9 survivors.
- Foreman commands at `424a2bf`: P002 tests plus conformance 189/189; lint clean on P002 paths. R01 and R02 reproductions rerun:
  - `repro-d01`: valid registry.
  - `repro-p002`: `id_alias` kept after move; F03 `INVALID_REGISTRY`.
  - `repro-d03`: tag no longer shadows the branch; `main~1` rejected.
  - `p1.mjs`: `skipped: not_canonical_tip`.
  - `p2b.mjs`: `GIT_FAILED`.
  - `p6.mjs`: concurrent edit preserved.

## Re-verification of prior findings

All 15 are FIXED; mutants were killed for each.

| Finding | Status | Evidence |
|---|---|---|
| R01 F01 union-merge duplicates | FIXED | Foreman `repro-d01`; mutants killed (F-M1, F-M2) |
| R01 F02 `id_alias` lost after move | FIXED | Foreman `repro-p002`; mutants killed (F-E14) |
| R01 F03 permanent renumber | FIXED | Foreman repro; mutant killed (F-E15) |
| R01 F04 canonical ref | FIXED | Foreman `repro-d03`; extra names rejected by auditor probe |
| R01 F05-F10 | FIXED | Mutants killed (F-E16..F-E20, F-B5) |
| R02 F01 non-tip promotion (E-0029) | FIXED | Foreman `p1.mjs`; detached-tip and remote-only cases verified |
| R02 F02 unreadable blob | FIXED | Foreman `p2b.mjs` gives `GIT_FAILED` |
| R02 F03 concurrent edit | FIXED | Foreman `p6.mjs` |
| R02 F04 E-0034 positional rule | FIXED | Auditor `b1.mjs` matrix |
| R02 F05 "otherwise none" arm | FIXED | Mutant killed (F-E20) |

The integration auditor found no REQUIRED issue: clean-clone reproducibility, realistic two-branch, crash and remote-only scenarios, and CRLF working copies all behave as specified.

## Findings (all test gaps; the engine behaves correctly in each)

Each finding below is a surviving mutant that changes behavior a binding errata decision governs and that a named case claims to cover. In every case the auditor confirmed that the real engine produces the expected result.

### F-P002-R03-T01 — REQUIRED — MEDIUM — E-0034 replay position not exercised with two or more moves before the alias
- Mutant: log only the first `move` per ID. It survives all 189 tests.
- Expected cases:
  - `allocate X A; promote X A; move A→G; move G→B; allocate Y B; alias X→Y` → `INVALID_REGISTRY`.
  - The mirror case with anchor G → valid.

### F-P002-R03-T02 — REQUIRED — MEDIUM — the missing-tree-object path of the reader is not exercised (R02 F02 / E-0009)
- Mutant: drop the `ls-tree` failure check. It survives.
- Real engine: a deleted subtree object gives `GIT_FAILED`; the mutant returns `null`.
- Expected case: the same as F-D17, but with the subtree object of `knowledge/a` deleted. Both `readFile` and `promoteIds` must fail closed and mutate nothing.

### F-P002-R03-T03 — REQUIRED — LOW — exact-repeat `move` must not shift the replay position (E-0024 (1), E-0034)
- Mutant: log repeated no-op moves. It survives.
- Expected cases:
  - `promote A; move A→B; move B→G; move A→B (repeat); allocate Y B; alias X→Y` → valid.
  - The same with `allocate Y G` → `INVALID_REGISTRY`.

### F-P002-R03-T04 — REQUIRED — LOW — `entities_skipped` ascending byte order not exercised (E-0035 (3))
- Reported independently by the spec and test auditors.
- Mutant: reverse the list. It survives.
- Expected case: two or more files edited during `promoteIds`, whose paths' byte order differs from their creation order, with one non-ASCII path. `entities_skipped` must list them in ascending UTF-8 byte order.

### F-P002-R03-T05 — REQUIRED — LOW — CRLF entity convergence not exercised (E-0011)
- Mutant: compare against the LF-normalized expected text. It survives.
- Real engine: a CRLF provisional entity is rewritten in run 1, and run 2 is a no-op.
- Expected case: that scenario, with `entities_skipped: []`.

### F-P002-R03-T06 — REQUIRED — LOW — tip check not exercised for a non-`main` canonical branch (E-0001, E-0029)
- Mutant: apply the tip check only when the branch is `main`. It survives.
- Expected case: `canonicalBranch: 'trunk'` with a feature checkout → `skipped: 'not_canonical_tip'`; at the trunk tip → promotes.

## ADVISORY (do not block)
- A crash can leave entity temp files (`*.yaml.<uuid>.tmp`) under `knowledge/`; they are not gitignored.
- CRLF working copies are rewritten whole-file as LF; git normalizes this under `text=auto`.
- A narrow window remains between the compare and the rename, because there is no portable compare-and-swap.
- `forwardIds` relocation with a further-renumbered ID is untested.
- Submodule entries are unspecified.
- TRACEABILITY does not cite conformance cases F-A5, F-D11, F-D12, F-E10, F-E13; the HANDOFF body is the R01 text with an R02 banner.
- The R01 and R02 advisories carry over: lock held across the Git scan (P007), duplicated helpers (P028), `viaDocument` fallback, lock-release failure, unlocked-reader transient.
- Process: a concurrent P012 auditor ran a process-wide node kill. This audit's runs were repeated where affected, and briefs now forbid process-wide kills.

## Outcome

Six REQUIRED findings remain. All are test gaps; the product is correct in each reproduction. This is the third consecutive `CHANGES_REQUESTED` round for P002, so PROTOCOL_V2 §8 sets the phase to `STALLED`. See `ESCALATION.md`. The protocol's single retry happens after the next acceptance of an unrelated phase.

VERDICT: CHANGES_REQUESTED
