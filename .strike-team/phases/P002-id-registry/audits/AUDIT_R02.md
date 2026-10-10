# P002 audit R02 (re-audit)

- Audited commit: `08b3910297e910fe64c1a15b01ff48c2fbe514e6` (product: remediation). Control-plane handoff: `6a78240`. Range: full phase `8dee230..08b3910`; remediation diff `6e5ac16..08b3910`.
- Auditors, all fresh instances; each confirmed the blind pass:
  - `spec-compliance-auditor` (sonnet). It re-verified F01-F10, ran 41 mutants and fuzzed the registry.
  - `architecture-auditor` (sonnet), deferred from R01.
- Foreman commands at `08b3910`:
  - P002 tests and conformance: 162/162.
  - Lint on P002 paths: clean.
  - R01 reproductions rerun: `repro-d01` shows "D01 registry valid". `repro-p002` shows G keeps `id_alias: [BR-0001]`, and F03 gives `INVALID_REGISTRY`. `repro-d03` shows the tag no longer shadows (4 commits) and `main~1` is `CANONICAL_BRANCH_UNRESOLVED`.
  - The auditor's probe scripts were rerun from the scratchpad: `p1.mjs` (A01: "INVALID_REGISTRY event 7: BR-0001 is promoted twice with different content"), `p2b.mjs` (A02: `readFile(c1) => null` for an unreadable blob), `p6.mjs` (A03: a line appended during promotion is missing from the final file).
- Errata decided during this audit: E-0029 (promotion only at the canonical tip), E-0034 (E-0024 (2) judged at the alias's replay position).

## Re-verification of R01 findings

| R01 | Status | Evidence |
|---|---|---|
| F01 union-merge duplicates | FIXED | Foreman `repro-d01` gives a valid registry. Auditor probes and mutants C1-C5 and X1 are killed by F-M1, F-M2 and the `R: E-0024` tests. |
| F02 `id_alias` after move | FIXED | Foreman `repro-p002`. The relocation-without-record case is probed. The F-E4 exclusion holds. Mutants C7b-C13 are killed. |
| F03 permanent renumber | FIXED | `INVALID_REGISTRY` (Foreman). Mutants C6 and C6b are killed. See E-0034 for the replay-position refinement. |
| F04 canonical ref | FIXED | Foreman `repro-d03`. About 25 non-branch names are rejected. The remote fallback works. Replace objects are disabled. |
| F05 `alias.commit` non-tip | FIXED | Mutant M1 is killed (F-E16). |
| F06 cross-ID order | FIXED | Mutants M2, M3, M3b and M3c are killed (F-E17). |
| F07 owner file | FIXED | Mutants L1-L5 are killed (F-B5, E-0028 (3)). |
| F08 `id_alias` drift | FIXED | Mutant M5 is killed (F-E18). |
| F09 `unregistered` order | FIXED | Mutants M6a and M6b are killed (F-E19). |
| F10 E-0024 cases | FIXED except one branch | See F05 below. |

## Findings

### F-P002-R02-F01 — REQUIRED — MEDIUM — promotion from a non-canonical checkout writes branch-dependent facts that brick the merged registry (E-0029)
- Clause: E-0029, "`promoteIds` writes registry events or rewrites entities only when the commit of the checkout's `HEAD` equals the commit the canonical branch name resolves to ... Otherwise it writes nothing and returns ... `skipped: 'not_canonical_tip'`". E-0002 says "identical result on every clone". l.318.
- Observed: `framework/engine/id-registry.mjs:257-296` decides holders from the working tree of any checkout and takes loser IDs from that branch's registry tail.
- Reproduction (`p1.mjs`): `promoteIds` on feature `f2`, which holds only B, records `promote BR-0001 B`. On `main` it records `promote BR-0001 A`. After `git merge f2` into `main`, `readIdRegistry` reports `INVALID_REGISTRY event 7: BR-0001 is promoted twice with different content`.
  - Auditor `p7.mjs` shows the same shape for loser renumbering: "BR-0001 is renumbered twice".
- Expected: implement E-0029. The existing F-D4 case ("promotion uses `main`'s history while `feature` is checked out") must be restated under E-0029: a non-tip checkout returns the skip and writes nothing.

### F-P002-R02-F02 — REQUIRED — MEDIUM — the default Git reader turns an object-read failure into "path absent"
- Clause: E-0009 (the earliest commit "whose tree contains the entity's file"); E-0002/E-0024 ("identical result on every clone"); PLAN `readFile` contract ("`null` if absent").
- Observed: `framework/engine/id-registry-git.mjs:80-87` returns `null` whenever `git cat-file blob <c>:./<path>` fails and the commit exists.
- Reproduction (`p2b.mjs`): after deleting a loose blob in a non-shallow repo, `readFile(c1, 'a.yaml')` returns `null`, while Git reports `fatal: ... bad file` (exit 128).
  - `firstCanonicalCommit` would then skip that commit and persist a later SHA.
- Expected: `null` only when the path is not in the commit's tree. Any other read failure is `GIT_FAILED` or `HISTORY_INCOMPLETE`, and nothing is mutated.

### F-P002-R02-F03 — REQUIRED — LOW — concurrent edits to an entity file are lost during `promoteIds`
- Clause: PLAN `promoteIds` item 6, "Rewriting an entity changes only the three identity keys; every other key, value, comment ... preserved"; E-0011, "atomically per file".
- Observed: entity text is read in `scanEntities` (`id-registry-entities.mjs:48`) and written back after all Git work (`id-registry.mjs:326-328`) without re-checking.
- Reproduction (`p6.mjs`): a line appended to the entity file during promotion is absent from the final file.
- Expected: the rewrite never discards bytes that changed after the scan. For example, re-read just before the atomic rename. If the content changed, skip that file and report it in the result, so it converges on the next run.

### F-P002-R02-F04 — REQUIRED — LOW — permanent-renumber check uses the final holder path (E-0034)
- Clause: E-0034, which judges the E-0024 (2) check at the alias's replay position.
- Observed: `buildModel` (`id-registry-codec.mjs:237-242`) compares the final holder path with the anchor.
- Reproduction (auditor `r2p1.mjs`): the registry `allocate X A`, `allocate X B`, `promote X A`, `allocate Y B`, `alias X→Y`, `move X A→B` is `INVALID_REGISTRY`. Under E-0034 it is valid.
- Expected: E-0034 semantics, with conformance cases for both orders.

### F-P002-R02-F05 — REQUIRED — LOW — the "otherwise none" arm of E-0024 (3) is not exercised
- Clause: E-0024 (3), "otherwise the unique file carrying Y whose path equals no path of any `allocate Y` event; otherwise none".
- Observed: mutant `relocated.length >= 1` at `id-registry-codec.mjs:294` survives all 162 P002 tests.
- Expected case: two non-anchor files carry the renumbered ID. Neither gets `id_alias`, and nothing is written. After one copy is removed, the unique survivor converges to `id_alias: [X]`.

## ADVISORY (do not block)
- The lock is held for the whole Git scan, at about 112 ms per commit per unpromoted holder. Concurrent `allocateId` calls may hit `LOCK_TIMEOUT`. Carry to P007 (same as R01 A-02).
- Duplicated logic that can drift, to consolidate when P028 introduces the catalog module:
  - `parseMapping` is duplicated in `id-registry.mjs` and `id-registry-entities.mjs`.
  - The commit-SHA pattern differs between the codec (40|64) and the git module ({40,64}).
  - `KF_E_101` is a local catalog copy.
  - "Who holds X" is computed in four places.
- The `viaDocument` rewrite fallback is not re-verified like the splice path, and it can reformat a whole file for unusual layouts.
- Entity temp files (`*.yaml.<uuid>.tmp`) are not gitignored.
- A failing lock `release()` after a committed write turns success into an error and leaves the lock held by a live pid.
- Helper modules are importable by path. `initializeIdRegistry` does not ensure `.gitattributes` `merge=union`; that belongs to P028 `kf init`.
- Unlocked readers can observe a transient `unregistered` entry during a concurrent `promoteIds`.
- A clone whose local `main` diverged from `origin/main` reads the local branch first (per E-0024 (4)).

## Remediation routing
1. A fresh `kf-conformance-engineer` restates F-D4 under E-0029 and adds cases for:
   - F01, the skip on non-tip checkouts, including a detached HEAD equal to the tip, which promotes;
   - F02, an unreadable blob (fail closed);
   - F03, a concurrent edit preserved or skipped;
   - F04, the E-0034 orderings;
   - F05, two relocated copies.
2. A fresh `kf-implementer` (remediation mode) fixes F01-F04 and writes `remediation/REMEDIATION_R02.md`.

VERDICT: CHANGES_REQUESTED
