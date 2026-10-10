# P002 remediation R02 (`kf-implementer`, fresh instance)

Input: `audits/AUDIT_R02.md` (REQUIRED F01-F05), errata E-0029, E-0034, E-0035. Nothing outside those findings was changed except TRACEABILITY.md and a note in HANDOFF.md.

## Baseline (red)

`node --test test/conformance-p002-id-registry.test.mjs` before any change: 98 tests, 86 pass, 12 fail: F-M3, F-D4, F-D15 (a), (b), (d), F-D16, F-D19, F-D17 (a), (b), F-D18 (a), (b), (c). The 14 new unit tests of `test/p002-r02.test.mjs` were run against the engine files from `HEAD` (copied to the scratchpad, not the tree): 14 of 14 fail.

## Files changed

- `framework/engine/id-registry.mjs`: tip check, `entities_skipped`, guarded entity rewrite.
- `framework/engine/id-registry-git.mjs`: `readFile` fails closed, new `headCommit()`.
- `framework/engine/id-registry-lock.mjs`: `atomicWrite` option `expectedText`.
- `framework/engine/id-registry-codec.mjs`: positional permanent-renumber check.
- `test/p002-r02.test.mjs` (new, 14 tests).
- `TRACEABILITY.md`, `HANDOFF.md`, this file.

## F01 - promotion from a non-canonical checkout (E-0029, E-0035 (2))

- Root cause: `promoteIds` decided holders, losers and loser IDs from whatever checkout it ran on, so `promote`/`alias` events from a feature branch could contradict those made on the canonical branch, and the union merge produced an invalid registry.
- Fix: after `history.firstParentCommits(branch)`, if the reader has `headCommit()` the engine compares it with the last first-parent commit. A difference returns `{canonical_branch, promoted: [], renumbered: [], entities_rewritten: [], entities_skipped: [], diagnostics: [], skipped: 'not_canonical_tip'}` before any scan of history or any write. The default reader's `headCommit()` is `git rev-parse --verify --quiet HEAD^{commit}`. A reader without `headCommit` is treated as at the tip. A malformed `headCommit` value is `GIT_FAILED`. Registry validity and `UNREGISTERED_ID` are still checked first (fail closed), and `CANONICAL_BRANCH_UNRESOLVED` / `HISTORY_INCOMPLETE` still come from the branch read, so those errors are not masked by the skip.
- Red before: F-D4, F-D15 (a)(b)(d), F-D16, F-D19 failed (conformance); R2 `E-0029:` x3 and `E-0035 (2):` x2 failed against HEAD engine files.
- Green after: all of those pass.

## F02 - object-read failure read as "path absent" (E-0009, E-0024 (4))

- Root cause: `readFile` returned `null` whenever `cat-file blob` failed and the commit existed.
- Fix: on a failed `cat-file`, check the commit exists (unchanged: `HISTORY_INCOMPLETE` if not); then `git --literal-pathspecs ls-tree -z <commit> -- <path>`. `ls-tree` failure is `GIT_FAILED`; an entry listed as a `blob` that could not be read is `GIT_FAILED`; no entry (or a tree/commit entry) is `null`. `--literal-pathspecs` is needed because `ls-tree` rejects pathspec magic such as `:(glob)x` and a path with `[1]` or `*` must be matched literally. The extra process runs only on the failure path, so the hot path is unchanged.
- Red before: F-D17 (a)(b); R2 `E-0009:` x2.
- Green after: both pass; `readFile` of absent paths, directories, paths under a file, globs and `:(glob)` names still returns `null`.

## F03 - lost concurrent edits (E-0011, E-0035 (3))

- Root cause: entity text was read in `scanEntities` and written back after all Git work without re-checking.
- Fix: `atomicWrite(file, content, {expectedText})` re-reads the target immediately before the rename; if it differs (or the file is gone) it removes its temporary file and returns `false`, otherwise it renames and returns `true`. `promoteIds` passes the scanned text as `expectedText`, lists refused files in `entities_skipped` (ascending path order), and `entities_rewritten` only has files actually replaced. The registry was already appended when a file is skipped, so the next call converges the file (the E-0011 projection). The remaining window is the time between the re-read and the rename; no portable compare-and-swap exists for a rename, and every engine writer holds the lock.
- Red before: F-D18 (a)(b)(c); R2 `E-0011:` x3.
- Green after: all pass, including idempotence on the third call.

## F04 - permanent-renumber check at the replay position (E-0034, E-0035 (1))

- Root cause: `buildModel` compared the final holder path with the anchor.
- Fix: the model records the applied `move` events with their event index. For each alias, if `from` has a `promote` earlier than the alias, the holder at the alias is the promote path followed through moves with a smaller index, and it must not equal the anchor; if the (earliest) `promote` comes later than the alias, its path must not equal the anchor (E-0035 (1)). Later moves, including into the anchor, are accepted.
- Red before: F-M3; R2 `E-0034:` x2 and `E-0035 (1):`.
- Green after: pass. Existing `E-0024 (2)` unit rows (including the alias-before-promote row) still pass unchanged.

## F05 - "otherwise none" arm of E-0024 (3)

Unit test `E-0024 (3): two non-anchor files carrying the renumbered ID get no id_alias; the unique survivor converges to it`: two copies get nothing and nothing is written; after one is removed the survivor gets `id_alias: [BR-0001]`. The conformance case is F-E20. No engine change was needed (the test also asserts `entities_skipped: []`, so it failed against the HEAD engine only for that field).

## Verification

- `node --test test/conformance-p002-id-registry.test.mjs`: 98/98.
- `node --test test/p002-*.test.mjs test/conformance-p002-id-registry.test.mjs`: 189 pass / 0 fail (77 existing unit tests unchanged, 14 new, 98 conformance).
- `npm test`: 614 pass / 0 fail. `npm run build`: 19 schemas. `npm run lint`: clean. `git diff --check`: no whitespace errors (CRLF notices only).
- `git status`: only `framework/engine/id-registry*.mjs`, `test/p002-r02.test.mjs` and the P002 phase files named above are mine; the other modified/untracked paths (conformance files, P012) were not touched.

## Restated unit tests

None. No existing unit test promoted from a non-tip checkout (the one that checks out `feature` expects an empty result, which a skip also satisfies). Nothing was deleted or weakened.

## DECISION_NEEDED

None.

## Disputed expectations

None. All 98 conformance cases pass unmodified.

## Notes

- `id-registry-git.mjs` had CRLF line endings in the working copy (index is LF); it is now LF, which `git diff` does not show as a change.
- The ADVISORY items of AUDIT_R02 were not addressed (lock held across the Git scan, duplicated helpers, etc.).
