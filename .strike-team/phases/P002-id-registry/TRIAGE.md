# P002 — Spec triage and decisions

Base: `8dee230381e50b4798ef7db3df8dbd8f6c011076` (errata E-0009..E-0014 were uncommitted in the working tree when this file was written; the Entry gate in `PLAN.md` requires them committed). Line numbers refer to `knowledge-framework-spec-v2.1.md` (2234 lines) and were checked with `sed -n`.

## 1. Items decided by the Foreman

| Item | Question | Decision | Settling clause / entry |
|---|---|---|---|
| T-01 | How is canonical entry detected; what is `first_canonical_commit`; what is "posterior"? | `DECIDED → E-0009` | l.317 "El engine renumera el de `first_canonical_commit` posterior"; first-parent index of the earliest canonical commit whose tree has the entity file carrying that `id`; never timestamps. |
| T-02 | Provisional newcomer vs an already-permanent ID | `DECIDED → E-0010` | l.318 "Colisión con un `permanent` → `KF-E-101`, resolución manual obligatoria."; diagnostic subject = every file whose path differs from the `promote` path. |
| T-03 | Entity fields `id_status` / `id_alias`; who rewrites entities | `DECIDED → E-0011` | l.312, l.316, l.319. Includes a schema change: `id_alias` added to `entityBase` in `framework/schemas/common.schema.json` (authorized for the implementer in `PLAN.md`). |
| T-04 | Registry format, event kinds, union-merge replay | `DECIDED → E-0012` (refines E-0007) | l.304, l.371. |
| T-05 | Lock staleness and recovery | `DECIDED → E-0013` | l.304 "con lock transaccional"; l.1604 exit code `5`. |
| T-06 | Missing / corrupt registry | `DECIDED → E-0014` | Missing: resource unavailable (class 5); corrupt: internal (class 4); never auto-recreated. |
| T-07 | CLI surface vs P028 / P007 | `DECIDED → E-0014` | P002 is engine API only; no `bin/`; `kf create` and promotion inside `kf validate` are wired by P007. |
| T-08 | Diagnostics without a catalog code | `DECIDED → E-0014` | l.1742 is the only identifier code; no new `KF-` codes; typed internal error codes; shadowed alias is message-only (E-0003). |
| T-09 | `ids.padding` config (l.1938) | `DEFERRED → phase P007` | P002 hardcodes the 4-digit minimum of l.300 and reads no configuration. |
| T-10 | Alias resolution in query surfaces | `DEFERRED → phases P021/P022` for query surfaces | P002 provides `resolveId` per E-0003. Alias cycles cannot arise from E-0012 (alias `to` is always freshly allocated); a registry that encodes one is invalid. |
| T-11 | Stale cross-reference "§28.2" | `NOT_AN_ISSUE` | E-0008(a): heading number binds; §0.4 #16 (l.62) means §29.2, irrelevant to P002. |

## 2. New ambiguities found while planning: `DECISION_NEEDED`

None of these is resolved by the planner. Each lists what stays specified and what is blocked. The blocked part of every item is narrow; the rest of P002 is not held up. Until the Foreman decides, the conformance engineer marks the affected assertion `pending-decision` and the implementer follows the "Neutral behavior" noted in each item only where it is the same under every option.

### D-01 — `initializeIdRegistry` when `.kf/` already exists but holds no registry file

Context. E-0012 says P028 (`kf init`) "creates the empty registry". The checkpoint engine refuses to initialize when `.kf/` exists at all (REGISTRY_EXISTS), which makes it impossible for a scaffold step to create `.kf/` first and then call the engine. The checkpoint test that deletes the registry and expects re-initialization to be refused relies on the same rule.

Options.
1. Refuse whenever `.kf/` exists (checkpoint behavior); P028 must call `initializeIdRegistry` before creating anything else under `.kf/`.
2. Accept an existing `.kf/` only if it contains no registry file, no lock directory, and the project holds no entity file carrying an ID (the `EXISTING_ENTITIES` guard stays); refuse otherwise.
3. Accept an existing `.kf/` only if it is completely empty.

Blocked until decided: the "`.kf/` pre-exists" row of V-23 and the matching conformance case. Unaffected: fresh-directory initialization, refusal when the registry file exists (REGISTRY_EXISTS), refusal over existing entities (EXISTING_ENTITIES).

### D-02 — Persisted details of renumbering that E-0002/E-0003/E-0012 leave open

Context. E-0003: the `alias` event records "`from`, `to` and the canonical commit". E-0002: "the others are renumbered" (no order for more than one loser). E-0012 gives no append order for the events written by one operation. All three are persisted or byte-observable and must be identical on every clone.

Sub-items and options.
- (a) `alias.commit` value. Option 1: the renumbered entity's own `first_canonical_commit` (E-0009 definition applied to the loser). Option 2: the surviving entity's `first_canonical_commit`.
- (b) Order in which two or more losers of one ID receive fresh IDs. Option 1: the E-0002/E-0009 total order (first-parent index ascending, then repo-relative path in ascending byte order), so the earliest loser gets the lowest new number. Option 2: reverse of that order.
- (c) Event append order within one `promoteIds` call. Option 1: `promote` events first in ascending byte order of ID, then for each loser in the order of (b): `allocate` (new ID) followed by `alias`; the loser's own later promotion happens in a later call (see `PLAN.md`, Design constraints). Option 2: events grouped per ID in ID byte order.

Planner proposal for the Foreman (not applied): Option 1 for all three. Blocked until decided: the assertions of V-38/V-39/V-40/V-41 on `alias.commit`, on the numeric value assigned to each loser when there are two or more, and on the exact line order. Unaffected: that a loser gets a fresh ID, that the `alias` and `allocate` events exist, replay validity, entity rewrite content.

### D-03 — Operation behavior in states the errata do not enumerate

- (a) An entity file carries an ID that appears in no registry event ("unregistered"; l.304 forbids agents assigning IDs). Options: 1. `allocateId` and `promoteIds` fail closed with typed error `UNREGISTERED_ID` and mutate nothing; `checkIdCollisions` reports it in a separate `unregistered` list. 2. Report-only everywhere; no operation fails. 3. Treat as an implicit allocation (rejected by the planner as contradicting l.304, listed for completeness).
- (b) `resolveId` cannot name one answer: two or more live files carry the same unresolved provisional ID, or an unheld ID has alias events to two or more targets. Options: 1. Typed error `AMBIGUOUS_ID` carrying the sorted candidates. 2. Return `status: 'ambiguous'` with sorted candidates. (A deterministic pick is not offered: E-0003 forbids silent re-routing.)
- (c) `promoteIds` meets one or more `KF-E-101` collisions. Options: 1. Abort the whole call with `IdRegistryError` code `KF-E-101` (checkpoint behavior), mutating nothing. 2. Skip the affected IDs, promote and renumber every other ID, and return the `KF-E-101` diagnostics in the result.

Blocked until decided: V-42's `promoteIds` outcome (throw versus returned diagnostics), V-53's ambiguity rows, and the `unregistered` field of `CollisionReport` together with the behavior of `allocateId` and `promoteIds` when an entity carries an unregistered ID (V-08 is asserted only for trees without such an entity). Under every option of (c) the following hold and are asserted: no registry event is written for the colliding ID, no colliding file is rewritten, the permanent holder is untouched. `checkIdCollisions` always returns `KF-E-101` diagnostics and never throws for them.

### D-04 — Lock directory without a readable owner file

Context. E-0013 defines staleness from `{pid, host, acquired_at}`. A process killed between `mkdir` of the lock and the write of the owner file leaves an owner-less lock that cannot meet the E-0013 test.

Options. 1. Never auto-break an owner-less lock (permanent manual cleanup). 2. Break it by the same atomic rename once the lock directory's own modification time is older than the stale threshold. 3. Break it immediately (rejected by the planner: races with a live acquirer between `mkdir` and owner write).

Blocked until decided: recovery of an owner-less lock older than the threshold. Under every option a fresh owner-less lock (younger than the threshold) blocks until the deadline and yields `LOCK_TIMEOUT` (V-16 asserts only this).

### D-05 — Representation of an empty `events:` list

Context. E-0012 fixes the file as `schema_version: 2.1` then `events:` with one `- {...}` flow mapping per line, but not the empty form. The checkpoint writes `events: []`. With `merge=union` (E-0007), two branches that both append their first event to a base containing the line `events: []` each replace that line; the union result contains both replacement texts, including two `events:` keys, which is invalid YAML. A base of `events:` (no value) followed by appended lines does not have this problem: both branches only insert lines after an unchanged line.

Options. 1. Empty registry is written as `events:` with no items (the reader must read a null `events` as empty). 2. Keep `events: []` (the reader accepts it; the first-events union-merge case stays a manual-resolution hazard).

Blocked until decided: the exact bytes `initializeIdRegistry` writes, and the "two branches both append their first event" union-merge case of V-27. Neutral behavior under both options: the reader accepts both forms as an empty registry; every other V-27 case starts from a non-empty base and is unaffected.

## 3. Noted, not asserted

These are deliberately not covered by any V-nn, so no decision is needed unless the Foreman wants one.

- N-01. A `move` event for an ID that has no `promote` event. E-0004 defines `move` only for permanent IDs. The implementer may reject it as `INVALID_REGISTRY` (fail closed); no conformance case asserts either behavior.
- N-02. An entity file with no `id_status` key at all (for example the existing P001 `acme-formulation` entities, which omit it), and an entity that claims `id_status: permanent` for an ID with no `promote` event. Fixtures in this phase always carry a truthful `id_status`.
- N-03. `.gitignore` ignores `.kf/*.lock/` (E-0007) but not the atomic-write temporary files `.kf/id-registry.yaml.*.tmp`. The engine removes its temporary files on success and on failure; a crash can leave one. Foreman may add an ignore pattern; the engine does not depend on it.
- N-04. §9 (l.333-343) names entity directories after their ID (for example `BR-0037/`). Renumbering rewrites file contents only (E-0011 lists `id`, `id_status`, `id_alias`) and never moves a file, so a renumbered entity's directory name can differ from its new ID. The engine treats `path` as an opaque string. Whether `kf create` names directories by ID, and whether P007 expects directory name = ID, is a P007/`kf create` question; if it is ever required, renumbering would need a recorded `move` (E-0004).
- N-05. A Knowledge Project whose root is a subdirectory of a larger Git repository. The default history reader resolves paths relative to `projectRoot`; no fixture case covers a nested root.
- N-06. `KF-E-101` is hand-declared as one constant (code, severity, remediation text copied from l.1742) because the diagnostics catalog module (l.1600) belongs to P028. P007 re-sources it from the catalog.
- N-07. Anomalous inputs outside the decided model: an unparsable entity YAML file in an entity root (the engine may fail closed or skip it); a facet file that carries a top-level `id`; `resolveId` queried inside the window of an interrupted entity rewrite. Not asserted.

## 4. Follow-ups for the Foreman (outside this phase's write set)

- `PHASES.md` P002 row lists "E-0001..E-0004, E-0007"; this phase also depends on E-0008(a), E-0009..E-0014.
- E-0012 and D-05 together suggest re-reading the E-0012 text before ratification: its union-merge rationale does not cover the empty-base case.

## 5. Foreman decisions on D-01..D-05 (2026-10-10)

All five decided by errata **E-0015**: D-01 option 2; D-02 option 1 for (a), (b), (c); D-03 (a) option 1, (b) option 2, (c) option 2; D-04 option 1; D-05 option 1. N-03: the implementer may add `.kf/id-registry.yaml.*.tmp` to `.gitignore`. N-01, N-02, N-04..N-07: noted, not asserted; N-04 (directory name vs renumbered ID) and N-02 (P001 fixture entities without `id_status` or registry) are carried to P007.
