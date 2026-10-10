# P002 ID Registry - HANDOFF (round R01, `kf-implementer`)

> **Round R01 remediation (after audit R01):** this file describes the first implementation round; the counts and test totals below are those of that round. The remediation changes (F01-F10, E-0024, E-0028) and their verification are in `remediation/REMEDIATION_R01.md`. Current state: 85 conformance tests and 162 P002 tests pass, `npm test` 585/585. DN-1 and DN-2 below were decided by E-0023 (1a) and (2a); E-0013's break wording stays as described in "Deviations" item 1 (E-0023 (3b)).

Base commit when the work started: `5fce77d` (conformance slice committed). The implementer never edited `framework/conformance/**`, `test/conformance*`, the spec, the errata or any control-plane file other than this file and `TRACEABILITY.md`. The Foreman commits; the product SHA is to be recorded after the commit.

## Scope delivered

Everything the PLAN authorizes, as an engine API (no `bin/`, no `package.json` change, E-0014):

- `createGitHistoryReader`, `initializeIdRegistry`, `readIdRegistry`, `allocateId`, `promoteIds`, `checkIdCollisions`, `resolveId`, `IdRegistryError`, `CORE_ID_PREFIXES`, with the types of the PLAN API contract (E-0015 and E-0016 values applied: D-01 option 2, D-02(a)(b)(c), D-03(a)(b)(c), D-04, D-05, `candidates` as `{id, path}`, `id_alias` only on the renumbered entity).
- Registry format of E-0012 (one flow-mapping line per event, exact two-line header and bare `events:` for the empty list, append-only, full replay validation on every read and before every write), atomic write (temp file, flush, rename via `options.rename`), lock directory with owner file, stale recovery, bounded waiting, retry of `EPERM`/`EBUSY`/`EACCES`.
- Entity projection (`id`, `id_status`, `id_alias`) as a minimal textual diff that preserves comments, key order and formatting; structural fallback only for layouts the splice cannot handle (flow-style documents); LF output.
- `framework/schemas/common.schema.json`: `id_alias` (unique array of `entityId`) in `$defs.entityBase.properties` (E-0011). `npm run build` compiles all 19 schemas.
- `.gitignore`: one line added, `.kf/id-registry.yaml.*.tmp` (TRIAGE N-03).

## Files changed (12)

Modified: `framework/engine/id-registry.mjs` (rewritten), `framework/schemas/common.schema.json`, `.gitignore`, `test/p002-id-registry.test.mjs` (rewritten, see below).
New: `framework/engine/id-registry-codec.mjs`, `id-registry-entities.mjs`, `id-registry-errors.mjs`, `id-registry-git.mjs`, `id-registry-lock.mjs`, `test/p002-adversarial.test.mjs`, and this `HANDOFF.md`; `TRACEABILITY.md` filled.

`test/p002-id-registry.test.mjs`: the checkpoint tests encoded the superseded format (events without `path`, `UNRESOLVED_COLLISION`, allocation-time `KF-E-101` throw, allocation-time entity scan for collisions, `allocateId(dir, prefix)` without a path, and a read of the legacy `cases:` block of `p002-id-registry.yaml`). They were replaced by 42 clause-named tests (E-0012 allows replacing the format without migration). Their surviving intent is kept under new names: non-reuse, growth past 9999, concurrent allocation, provisional on a non-canonical branch, missing/corrupt registry, `KF-E-101` for permanent collisions, lock blocks allocation. No assertion was weakened.

## Verification output

- `npm run build`: `Compiled 19 JSON Schemas.` (ok)
- `npm run lint`: clean (ok)
- `npm test`: tests 264, pass 201, fail 0, todo 63 (the 63 conformance cases, all passing), skipped 0.
- Conformance file alone, TAP reporter: `ok` 64, `not ok` 0 (63 todo cases plus the index self-check). **Conformance todo cases passing: 63/63.** Repeated twice more with the P002 unit files: identical (119 tests, 56 pass, 63 todo, 0 fail).
- Baseline before the work: `npm test` green with the 63 cases failing as todo (one shown: F-S1, schema field missing).
- Red-before evidence for the lock race: against a mutant of `id-registry-lock.mjs` that skips the owner-identity check, `E-0013: a lock acquired after staleness was determined is never removed by the breaker` and `E-0013: many contenders on one stale lock` fail (mutation run in the scratchpad, not in the tree); both pass on the real code.
- `git diff --check`: no whitespace errors (only the usual CRLF notices of the Windows checkout). `git status`: only the paths listed above plus files owned by other agents (`.strike-team/STATE.yaml`, errata, `P011-*`, `framework/conformance/p011-*`, `test/conformance-p011-*`), none touched by this round.

## Design notes the auditors should know

- Entity files scanned: `knowledge/`, `changes/`, `divergences/`, recursively, `*.yaml`/`*.yml` (case-sensitive), regular files only (symlinks skipped). A record is a mapping with a top-level `id` that is a core ID. Unparsable files and non-core `id` values are not records (TRIAGE N-07, either choice allowed; skipping cannot cause reuse because the counter comes from the registry).
- Pending renumber (PLAN promoteIds item 4): a file that still carries the old ID while the registry holds `allocate Y@path` and `alias X->Y` is converged to `Y` and is not a promotion candidate in that call (F-E9 expects `promoted: []`); it is promoted by the next call once the rewritten file is in canonical history. The "renumbered entity" of an alias is anchored at the path of the nearest `allocate` of `to` that precedes the alias line (E-0028 (1); an alias with none preceding is invalid) and is followed to its current path (E-0024 (3), amending E-0016 (2a)); see `remediation/REMEDIATION_R01.md`.
- `KF-E-101` skip rule (E-0015 D-03(c)): an ID that already has a `promote` and whose holders include a file at another path is skipped in full (no event, no rewrite of any file carrying it, holder untouched). An ID promoted in the same call that is also carried by a non-canonical third file is promoted normally; that file is reported in `diagnostics` (post-state classification) and not rewritten.
- `diagnostics` of `promoteIds` is the post-state `KF-E-101` list, sorted by (id, path) in byte order.
- Quoting: a scalar is written plain only if it matches `^[A-Za-z][A-Za-z0-9_./-]*$` and is not a YAML reserved word; otherwise as a JSON string (U+0085, U+2028, U+2029 escaped). A SHA starting with a digit is therefore written quoted (`commit: "0a43..."`) so it cannot be read as a number; the E-0012 example shows it bare. The reader accepts both. The conformance helper `scalar()` applies the same rule.
- Append layout: new lines are appended to the existing bytes (CRLF in a hand-edited or autocrlf checkout is normalized to LF). If the appended text would not parse back to exactly the old events plus the new ones (hand-written block-style or oddly ordered registries), the whole file is re-rendered canonically; the events are preserved. A registry whose list is empty is rewritten as header plus lines (the only allowed header change).
- Windows: liveness probe is `process.kill(pid, 0)` (`EPERM` counts as alive).

## Deviations and PLAN/spec observations

1. **Lock break mechanism (E-0013)**. E-0013 and the PLAN say "rename the lock directory to a unique sibling". A bare rename after a separate "is it stale" read can remove a lock acquired in between, which the PLAN calls a defect. Implementation: (i) rename `owner.json` to a unique `.claim` name inside the lock directory (one winner; nobody can acquire while the directory exists); (ii) check the claimed bytes equal the owner bytes that were judged stale, otherwise restore the owner file and remove nothing; (iii) only then rename the lock directory to a unique `.kf/id-registry.broken-<uuid>.lock` sibling and remove it. Every observable of E-0013 holds (single winner, `.kf/*.lock` sibling, no leftover). If the breaking process dies between (i) and (iii) the lock is left owner-less and needs manual removal (D-04 behavior). The Foreman may prefer to amend the E-0013 text; no code depends on that wording.
2. `GIT_FAILED` is an internal error code not listed in the PLAN table: used for non-resolution `git` failures (git missing, not a repository, command failure) and for a history reader that returns malformed SHAs. Treat as class 4 (internal) unless P007 decides otherwise. `HISTORY_INCOMPLETE` is also used when a commit object listed by the reader is missing.
3. PLAN item 1 of `promoteIds` reads "each entity file whose ID is registered and not yet promoted"; implemented as "files whose own `id` has no `promote`", which excludes pending-renumber files (see design notes). This matches F-E9.
4. `UNREGISTERED_ID` is raised before the history reader is called, so a bad branch plus an unregistered entity reports `UNREGISTERED_ID`.
5. `common.schema.json` is the only schema changed (PLAN). **`divergence.schema.json` does not extend `entityBase` and has no `id_alias` property**; `DIV` is an allocatable prefix, so a renumbered `DIV` entity would receive `id_alias` and fail that schema if it forbids unknown keys. Not asserted by P002; carry to the phase that owns the divergence schema (P007/P019).

## `DECISION_NEEDED` (low severity; each was implemented as stated, awaiting confirmation)

- **DN-1: order of losers across several colliding IDs in one `promoteIds` call.** E-0015 D-02(b) orders losers of one ID; D-02(c) says "then for each loser in (D-02b) order an `allocate` followed by its `alias`", but does not order different IDs. Options: (a) ID ascending in byte order, then the total order inside an ID (implemented; test `E-0015: D-02(c) several colliding IDs in one call`); (b) one global total order over all losers by (first-parent index, path), regardless of ID. Persisted bytes depend on this. Reversibility MEDIUM (event order of future registries).
- **DN-2: shape of an `ambiguous` resolution beyond `status` and `candidates`.** E-0015/E-0016 fix `status` and `candidates`. Implemented: `id: null`, `path: null`, `via: []`, `warnings: []`, `registered` as usual. Alternative: `via: [input]`. Reversibility LOW.

## Disputed expectations

None. All 63 cases pass unmodified.

## Deferred

`kf create`/`kf validate` wiring (P007), `kf init` creating the registry (P028), `kf update`/`move` writer, `ids.padding` (P007), query-surface wiring and address grammar (P021/P022, E-0006), cross-file reference rewrite on renumbering, directory-name vs renumbered-ID question (TRIAGE N-04), performance of the linear first-parent scan (R-06; no target authorized).

## Suggested follow-ups for the Foreman

- Flip `PENDING = false` in `test/conformance-p002-id-registry.test.mjs` when accepting (conformance owner).
- The `yaml: p002-id-registry.yaml` still carries the legacy `cases:` block that no test reads any more; it can be removed by the conformance owner.
- Ratification candidates: item 1 above (E-0013 wording) and DN-1.
