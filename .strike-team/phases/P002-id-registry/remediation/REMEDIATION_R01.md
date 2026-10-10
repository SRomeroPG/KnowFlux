# P002 remediation R01 (`kf-implementer`, fresh instance)

Input: `audits/AUDIT_R01.md` (REQUIRED F01-F10), errata E-0024 and E-0028. Nothing outside the REQUIRED findings was changed except TRACEABILITY.md (A-06) and a note in HANDOFF.md.

## Baseline (red)

`node --test test/conformance-p002-id-registry.test.mjs`: 85 tests, 74 pass, 11 fail: F-M1 (a), F-M1 (b), F-M2 (idempotent), F-M2 (conflicting), F-D14 (a)-(d), F-E14 (a), F-E14 (b), F-E15.

## Files changed by this round

- `framework/engine/id-registry-codec.mjs`: replay model rewritten (`buildModel`), alias projection (`aliasCurrentPath`, `aliasProjection`).
- `framework/engine/id-registry-git.mjs`: branch resolution (`resolveBranch`), replace objects disabled.
- `framework/engine/id-registry.mjs`: passes the entity file list to `aliasProjection` (3 lines).
- `test/p002-remediation.test.mjs` (new, 22 tests).
- `.strike-team/phases/P002-id-registry/TRACEABILITY.md`, `HANDOFF.md`, this file.

## Per finding

### F01 (REQUIRED) union merge made the registry invalid
- Root cause: `buildModel` threw on any second `promote` and on any `move` whose `from` was no longer the current path, even for byte-identical lines.
- Fix: a second `promote` is accepted only when path and commit equal the first; a `move` is applied when its `from` is the current holder path, and otherwise accepted only as an exact repeat of an earlier move (so back-and-forth moves still replay in order); an `alias` repeated with the same `from`, `to` and `commit` is skipped. Conflicts stay `INVALID_REGISTRY`: a different second `promote`, a non-repeat move with a stale `from`, the same `from`/`to` with another commit (E-0028 (2)), and the same `from` renumbered twice at one anchor to different targets (E-0024 (1)). The returned `events` list is the registry as written (E-0028 (5)).
- Red before: F-M1 (a), F-M1 (b), F-M2 idempotent fail ("promoted twice"). Green after: F-M1, F-M2 pass; `R: E-0024 (1)` tests (5) and `R: E-0028 (2)` fail on the HEAD engine copy (scratch run) and pass now.

### F02 (REQUIRED) `id_alias` erased after the renumbered entity moves
- Root cause: the projection compared the anchor path with the file path only.
- Fix: `aliasCurrentPath` derives the renumbered entity's current path per E-0024 (3): with a `promote` for the target, the holder path (promote path followed through moves) when the promote path equals the anchor or no path of an `allocate` of the target, otherwise none; without a `promote`, the anchor if a file there carries the target or a connected ID of aliases anchored at that path, else the unique file carrying the target (or a later renumbering of it) at a path that is no `allocate` path of the target. `aliasProjection` recurses to earlier aliases of the same entity (same anchor or same current path), so a second renumbering still yields `[BR-0001, BR-0002]` (F-E4). The entity file list (with planned IDs) is passed from `promoteIds`. The anchor is the nearest preceding `allocate` (E-0028 (1)); none preceding is invalid.
- Red before: F-E14 (a), F-E14 (b). Green after: F-E14 (a)(b)(c), F-E4 pass; `R: E-0024 (3)` tests (5) and `R: E-0028 (1)` fail on the HEAD engine and pass now.

### F03 (REQUIRED) alias renumbering a permanent holder was accepted
- Root cause: no comparison of the alias anchor with the holder path of `alias.from`.
- Fix: after replay, `alias.from` with a `promote` whose final holder path (through moves) equals the anchor is `INVALID_REGISTRY` (order-independent, so the union-merge ordering variant is also invalid).
- Red before: F-E15. Green after: F-E15 passes (three invalid rows, three valid near-misses); `R: E-0024 (2)` fails on the HEAD engine and passes now.

### F04 (REQUIRED) canonical branch resolved as an arbitrary revision
- Root cause: `git rev-parse --verify <name>^{commit}`.
- Fix: names that are empty, dash-leading, contain control characters or `@{`, or that `git check-ref-format --branch` rejects or expands (output differs from the input) are `CANONICAL_BRANCH_UNRESOLVED`; then only `refs/heads/<name>` and `refs/remotes/origin/<name>` are tried, in that order. Every git call runs with `--no-replace-objects`, `GIT_NO_REPLACE_OBJECTS=1`, and `GIT_GRAFT_FILE`/`GIT_REPLACE_REF_BASE` dropped. `origin/main` as a name is unresolved (E-0028 (4)).
- Red before: F-D14 (a)-(d). Green after: all four pass; `R: E-0024 (4)` (3 tests) fail on the HEAD engine and pass now.

### F05-F09 (coverage gaps; already covered by conformance F-E16, F-E17, F-B5, F-E18, F-E19)
Unit tests added in `test/p002-remediation.test.mjs`; they pass on the HEAD engine as well (they were test gaps, not engine defects) and are the mutation killers the audit asked for:
- F05: `R: E-0015 D-02(a)` (non-tip loser, persisted `alias.commit` equals the loser's entering index, not the tip or the winner).
- F06: `R: E-0015 D-02(c), E-0023 (1a)` (BR at `b1,b2`, DE at `a-data/d1,d2`; order promote BR, promote DE, allocate/alias BR, allocate/alias DE).
- F07: `R: E-0028 (3)` (exact `{pid, host, acquired_at}`, injected and real values) and `R: E-0013 ... killed engine process` (child holds the lock, is killed with SIGKILL, the parent recovers with `staleAfterMs: 150`; the owner file names the child pid). E-0028 (3) already held: the lock writes the settings' `now()`/`hostname`.
- F08: `R: E-0011: drift in id_alias alone is converged`.
- F09: `R: E-0015 D-03(a): unregistered is sorted by ID first, then by path`.

### F10 (REQUIRED) tests for E-0024
Covered by the conformance cases F-M1, F-M2, F-E14, F-E15, F-D14 (all green) and the `R:` unit tests above.

## Verification

- `node --test test/conformance-p002-id-registry.test.mjs`: 85/85.
- `node --test test/p002-*.test.mjs test/conformance-p002-id-registry.test.mjs`: 162 pass, 0 fail.
- `npm run build`: 19 schemas; `npm run lint`: clean; `npm test`: 585 pass, 0 fail, 0 todo; `git diff --check`: no errors (CRLF notices only).
- Red evidence: the 22 remediation tests run against a scratch copy of the HEAD engine (`git show HEAD:...`): 12 fail, 10 pass (the 10 are the F05-F09 gap tests and regression guards).

## DECISION_NEEDED

None.

## Disputed expectations

None. All 85 conformance tests pass unmodified.

## Notes

- Interpretation inside E-0024 (3), applied where the errata wording does not fix an algorithm: "carrying Y" in the no-promote case includes the IDs connected to Y through aliases anchored at the same path (so an entity renumbered twice in place is still found at its anchor), and the relocated-file search uses the IDs reachable forward from Y, never X, so the permanent holder of X cannot be mistaken for the renumbered entity. A move that is a valid next step is applied even if it equals an earlier move (a path round trip).
- Carry-over (ADVISORY, untouched): A-01, A-02 (performance, P007), A-03, A-04, A-07, A-08.
