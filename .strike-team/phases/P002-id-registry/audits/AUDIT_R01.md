# P002 audit R01

- Audited commit: `6e5ac168c31a883e2c90832b61f75c9ea9f86a16` (product). Control-plane handoff: `530e98f`. Range: `8dee230..6e5ac16`, P002 files only.
- Auditors (fresh instances, blind pass confirmed by each): `spec-compliance-auditor` (sonnet), `algorithm-determinism-auditor` (sonnet), `test-conformance-auditor` (sonnet; 55 mutants, 23 survivors against all P002 tests). `architecture-auditor` and `integration-regression-auditor` are deferred to the re-audit round, since remediation changes the replay model and the git reader.
- Foreman commands at the audited SHA: `npm run build` (19 schemas), lint on `framework scripts test eslint.config.js` (clean; `npm run lint` was polluted by an agent worktree, since removed), `npm test` (413 tests, 265 pass, 0 fail, 148 todo belonging to P011), `git diff --check` (clean), `node --test --test-reporter=tap test/conformance-p002-id-registry.test.mjs` (64 ok / 0 not ok).
- Foreman reproductions (scratchpad): `repro-d01.mjs` (F01), `repro-p002.mjs` (F02, F03), `repro-d03.mjs` (F04); test-file inspection for F05 (`test/conformance-p002-id-registry.test.mjs:815-828`).
- Errata decided during this audit: E-0024 (amends E-0012 and E-0016; canonical ref resolution). It is binding for the remediation.

## Findings

### F-P002-R01-F01 — REQUIRED — MEDIUM — a routine union merge makes the registry invalid
- Clause: E-0007 (`merge=union`); E-0012, "Line-atomic events are the only form that survives a union merge intact"; E-0024 (1): "an event whose op and every field equal an earlier event's ... is a no-op repeat".
- Observed: `framework/engine/id-registry-codec.mjs:172` throws "promoted twice" for any second `promote`, even a byte-identical one. A repeated `move` fails at l.188.
- Reproduction (`repro-d01.mjs`):
  1. `main` holds BR-0001.
  2. Branch A runs `promoteIds` then `allocateId`; branch B runs `allocateId` then `promoteIds`.
  3. `git merge --no-ff A` then `git merge --no-ff B` on `main` both succeed ("Auto-merging .kf/id-registry.yaml").
  4. The merged registry has two identical `promote BR-0001` lines that are not adjacent.
  5. `readIdRegistry` throws `INVALID_REGISTRY event 4: BR-0001 is promoted twice`, so every operation fails.
- Expected: per E-0024 (1), exact duplicates of `promote`/`alias`/`move` are idempotent no-ops. Any non-identical conflicting event stays invalid.

### F-P002-R01-F02 — REQUIRED — MEDIUM — `id_alias` is erased from the renumbered entity after it moves
- Clause: l.319 "`id_alias` **SHALL** resolverse en todas las queries, indefinidamente."; E-0011 (projection converges, never lost); E-0024 (3).
- Observed: the anchor is never followed to the entity's current path.
  - `id-registry-codec.mjs:196-200` fixes the anchor `rpath` at the `allocate` path.
  - `aliasProjection` (l.225-235) keeps an alias only if `rpath === filePath`.
- Reproduction (`repro-p002.mjs`):
  1. The F-E1 state, with B renumbered to BR-0002, `id_alias: [BR-0001]`, and promoted.
  2. Move B to G and record `move BR-0002 B→G`.
  3. `promoteIds` rewrites G to `id: BR-0002 / id_status: permanent` with no `id_alias`.
  - The determinism auditor showed the same loss when a still-provisional renumbered entity is relocated without a record (its directory renamed to match the new ID) and then promoted.
- Expected: the E-0024 (3) derivation of the renumbered entity's current path, for both promoted and provisional `to` IDs. The exclusion of an unrelated holder (E-0016 2a, F-E4) must still hold.

### F-P002-R01-F03 — REQUIRED — LOW — the registry accepts an `alias` that renumbers a permanent holder
- Clause: l.318 "**Un ID `permanent` SHALL NOT ser renumerado jamás.**"; E-0024 (2).
- Observed: `buildModel` (`id-registry-codec.mjs:155-210`) never compares an alias's anchor with `alias.from`'s holder path.
- Reproduction: the registry is `allocate BR-0001 A`, `promote BR-0001 A`, `allocate BR-0002 A`, `alias BR-0001→BR-0002`. `readIdRegistry` accepts it (4 events).
- Expected: `INVALID_REGISTRY`.

### F-P002-R01-F04 — REQUIRED — LOW — canonical branch resolved as an arbitrary revision
- Clause: E-0001 ("canonical branch"); E-0009 ("first-parent history of the canonical branch"; "identical result on every clone"); E-0024 (4).
- Observed: `id-registry-git.mjs:44-47` passes the name to `git rev-parse --verify <name>^{commit}`.
- Reproduction (`repro-d03.mjs`):
  - With a tag `main` at `HEAD~2`, `firstParentCommits('main')` returns 2 commits, while `refs/heads/main` has 4.
  - `firstParentCommits('main~1')` is accepted.
  - Replace refs and grafts are not disabled.
- Expected: per E-0024 (4), resolve `refs/heads/<name>`, then `refs/remotes/origin/<name>`, else `CANONICAL_BRANCH_UNRESOLVED`. Names failing `check-ref-format --branch` are rejected, and git runs with replace objects disabled.

### F-P002-R01-F05 — REQUIRED — MEDIUM — persisted `alias.commit` not exercised when the loser is not at the tip (V-38, V-41)
- Clause: E-0015 D-02(a).
- Observed: mutant "alias commit = tip of canonical history" survives every P002 test.
- Cause: every real-Git renumber has the loser entering at the tip. The injected non-tip case (`test/conformance-p002-id-registry.test.mjs:815-828`) asserts only `result.renumbered`, never the persisted `alias` event.
- Expected case: the loser enters at a non-tip first-parent index, and the persisted `alias` event's `commit` equals that index's SHA.

### F-P002-R01-F06 — REQUIRED — MEDIUM — cross-ID event order not exercised (V-40; E-0015 D-02(c), E-0023 (1a))
- Observed: mutants that drop the ID sort, or sort losers by path, survive.
- Cause: the only multi-ID test has path order equal to ID order.
- Expected case: BR-0001 colliders at `knowledge/business-rules/b1,b2` and DE-0001 colliders at `knowledge/a-data/d1,d2`, all in one commit. Expected event order: `promote BR-0001, promote DE-0001, allocate BR-0002, alias BR-0001→BR-0002, allocate DE-0002, alias DE-0001→DE-0002`.

### F-P002-R01-F07 — REQUIRED — MEDIUM — the engine-written lock owner file is never checked (V-12, V-17; E-0013)
- Observed: three mutants survive. With `pid: 0` an engine-crashed lock could never be recovered. The other two set `acquired_at` to 1970 and `host: 'x'`.
- Cause: every stale-lock test plants `owner.json` by hand.
- Expected cases:
  - `owner.json` read during a held lock has exactly `{pid, host, acquired_at}`, with `process.pid`, `os.hostname()` and a current ISO time.
  - End to end: a child process takes the lock and is killed, and the parent recovers it with a small `staleAfterMs`.

### F-P002-R01-F08 — REQUIRED — LOW — `id_alias`-only drift is not converged by any test (V-46; E-0011)
- Observed: a mutant that ignores `id_alias` in the identity comparison survives.
- Expected case: the registry is `alloc BR-0001 A`, `alloc BR-0002 B`, `alias BR-0001→BR-0002`, and entity B has `id: BR-0002, id_status: provisional` without `id_alias`. `promoteIds` returns `entities_rewritten == [B]`, and B gains `id_alias: [BR-0001]`.

### F-P002-R01-F09 — REQUIRED — LOW — `unregistered` sort order not exercised (E-0015 D-03(a))
- Observed: mutants that do not sort, or sort by path only, survive.
- Expected case: `changes/CHG-0009.yaml` and `knowledge/business-rules/x/rule.yaml` carrying BR-0007 → `[BR-0007, CHG-0009]`.

### F-P002-R01-F10 — REQUIRED — LOW — no tests yet for the E-0024 behaviors
- Clause: E-0024 (1)-(4).
- Expected conformance cases:
  - the F01 union merge, plus an exact-duplicate `alias` and `move`, and a non-identical second `promote` that stays invalid;
  - the F02 recorded-move and provisional-relocation cases, keeping the F-E4 unrelated-holder exclusion;
  - the F03 invalid registry;
  - the F04 tag shadow, revision expression and remote-only branch (`refs/remotes/origin/<name>` when no local branch exists).

## ADVISORY (do not block)
- A-01 `divergence.schema.json` does not extend `entityBase` and rejects `id_alias`, although `DIV` is an allocatable prefix. Carried to P017 (DIV identity).
- A-02 Performance: one `git cat-file` per commit per unpromoted holder, all inside the lock. A 200-commit history took 12.7 s, so concurrent allocators may hit `LOCK_TIMEOUT`. Carry to P007 (CLI integration).
- A-03 `ID_PATTERN` accepts non-canonical padding (`BR-00012`). The engine never produces it, and it causes no reuse risk.
- A-04 The append-only prefix falls back to a whole-file canonical rewrite for non-canonical layouts (4-space indent, CRLF). Git normalizes line endings, so the committed diff stays an append.
- A-05 Untested items, each killed or harmless at this SHA:
  - readers taking no lock;
  - ordering of `diagnostics`, `provisional_collisions` and `shadowed_alias`;
  - path-rule checks on `promote`/`move` paths;
  - BigInt counter precision;
  - lone-surrogate and control-character paths in the conformance table;
  - `.tmp`/`.lock` naming hygiene;
  - the V-49 sweep beyond one scenario;
  - UTF-8 versus UTF-16 tie order. It is covered only by unit test `test/p002-id-registry.test.mjs:430`, so the fixture should add the U+FF5E / U+1F600 pair.
- A-06 TRACEABILITY.md:
  - it has no rows for E-0023 and E-0024;
  - row 57 and the "Pending decisions" paragraph are stale after E-0023;
  - the PASS rows for E-0015 D-02 / D-03(a), E-0011 `id_alias` convergence and E-0013 owner file overstate coverage (F05-F09).
- A-07 The stale-lock test uses `deadlineMs: 300` and could flake on slow CI. The test helpers do not clear inherited `GIT_DIR`/`GIT_INDEX_FILE`. The conformance test header still says the cases are todo.
- A-08 Infra: `npm run lint` scans `.claude/worktrees/`. Before the next worktree-based implementer runs, an authorized round should add `.claude/worktrees/` to the eslint ignores and to `.gitignore`.

## Remediation routing
1. A fresh `kf-conformance-engineer` adds the F05-F10 cases from the spec, the errata and this file, without reading the engine. It may also add the A-05 U+FF5E / U+1F600 pair.
2. A fresh `kf-implementer` (remediation mode) fixes F01-F04 under E-0024, makes every new case pass, updates TRACEABILITY.md (A-06), and writes `remediation/REMEDIATION_R01.md`.

VERDICT: CHANGES_REQUESTED
