# P002 — ID Registry

Supersedes the v1 plan (written around the blocked checkpoint `0dddf47`). `BLOCKED_HANDOFF.md` is kept unchanged as history. Spec triage and the Foreman's decisions are in `TRIAGE.md`; the five planning-time `DECISION_NEEDED` items (D-01..D-05) are decided by E-0015, see "Foreman decisions after planning".

## Foreman decisions after planning (binding; supersedes every "pending D-nn" below)

D-01..D-05 are decided by errata **E-0015** (2026-10-10). Every V-nn marked "partial (D-nn)" in this plan is now asserted in full with these values:

- D-01: `initializeIdRegistry` succeeds when `.kf/` exists with no registry file, no registry lock, and no entity file carrying an ID; otherwise it refuses (`REGISTRY_EXISTS` / `EXISTING_ENTITIES`; a held lock behaves as for any locked operation).
- D-02: (a) `alias.commit` = the renumbered (losing) entity's own `first_canonical_commit`. (b) Several losers of one ID get fresh IDs in the E-0002/E-0009 total order (first-parent index ascending, then path in ascending UTF-8 byte order), lowest new number first. (c) Events appended by one `promoteIds` call: all `promote` events first in ascending byte order of ID, then for each loser in (b) order `allocate` (new ID) followed by `alias`.
- D-03: (a) an entity carrying an ID present in no registry event makes `allocateId` and `promoteIds` fail closed with `UNREGISTERED_ID`, mutating nothing; `checkIdCollisions` reports it in `unregistered: [{id, path}]` (sorted by id, then path) and does not throw. `allocateId` therefore scans entity files for this check (V-08 still holds: allocation needs no Git). (b) `resolveId` returns `status: 'ambiguous'` with `candidates` sorted (no `AMBIGUOUS_ID` error). (c) `promoteIds` never throws for `KF-E-101`: it skips the colliding ID (no event, no rewrite, holder untouched), processes every other ID, and returns the `KF-E-101` entries in `diagnostics`.
- D-04: an owner-less lock directory is never auto-broken; acquisition ends in `LOCK_TIMEOUT` naming the lock path.
- D-05: the empty registry is exactly the two lines `schema_version: 2.1` and `events:` (LF-terminated); readers accept null `events` and `events: []` as empty. The both-branches-append-first-event union-merge case of V-27 is asserted (parseable, both events present).

Exit-code class of `UNREGISTERED_ID`: not set by E-0014; P007 maps it when wiring the CLI. Additional allowed implementer path: `.gitignore`, only to add the pattern `.kf/id-registry.yaml.*.tmp` (TRIAGE N-03).

## Objective and authorization

Implement §53 A2: the engine-side ID registry for the Knowledge Project: allocation, the `provisional` to `permanent` lifecycle, canonical promotion, collision handling (renumbering of provisional colliders with `id_alias`; `KF-E-101` for permanent collisions), alias resolution, non-reuse, an atomic and lock-protected `.kf/id-registry.yaml`, and stale-lock recovery. Authorization: the `PHASES.md` row for P002 (HIGH risk), opened by the Foreman under `PROTOCOL_V2.md`; the earlier user authorization of this phase is recorded in the retired v1 plan.

P002 is an **engine API phase**. It ships no `bin/`, no `kf` command and no `package.json` `bin` entry (E-0014). Wiring `kf create` and promotion inside `kf validate` belongs to P007 (depends on P002 and P028).

The §53 item is small enough for one audit round; no split is proposed.

## Entry gate

- P001 is `ACCEPTED`: `.strike-team/phases/P001-core-persistent-model/audits/CLAUDE_AUDIT_R03.md` carries `VERDICT: ACCEPTED` (line 68); product SHA `c738bd6675bb44c80ef890daf28b335718fbe9c5`.
- `STATE.yaml` and `PHASES.md` show P001 `ACCEPTED` and P002 `PLANNED`.
- Base commit when this plan was written: `8dee230381e50b4798ef7db3df8dbd8f6c011076`. Errata E-0009..E-0015 were uncommitted in the working tree at that time. **Gate: those entries, `TRIAGE.md`, this plan and `TRACEABILITY.md` are committed, and `git status` is clean, before the conformance engineer is briefed.** The Foreman records the resulting SHA in the briefs (`ENTRY_SHA = <fill>`).
- Errata read in full before work: E-0001, E-0002, E-0003, E-0004, E-0007, E-0008(a), E-0009, E-0010, E-0011, E-0012, E-0013, E-0014, E-0015. E-0006 (address grammar, `OPEN`) does not affect P002 and stays out of scope.
- `.gitattributes` already assigns `.kf/id-registry.yaml merge=union` and `.gitignore` already ignores `.kf/*.lock/` (E-0007); verified present at the base commit.
- Starting point only, not a contract: `framework/engine/id-registry.mjs`, `test/p002-id-registry.test.mjs`, `framework/conformance/p002-id-registry.yaml` from checkpoint `0dddf47`. Its persistent format is replaceable without migration (E-0012). Node `>=24` (`package.json`), `git` on the PATH.

## Normative coverage

Line numbers are those of `knowledge-framework-spec-v2.1.md` and were verified with `sed -n`. Quotes are verbatim (Spanish prose, English keywords). "E-" entries are binding decisions that refine or fill a clause; they never override a SHALL.

| § | Contract | Verbatim clause fragments (line) | Errata |
|---|---|---|---|
| §4.1 | The eleven core prefixes `CAP BP BR DE OUT SC EV UNK CHG DIV DSP` are the ones the engine allocates (they match `entityId` in the accepted P001 `common.schema.json`). Extended prefixes (§4.2) are not allocated by P002. | l.153-163 table rows `CAP` .. `DSP`; l.165 "### 4.2 Extendido (opt-in por módulo)" | — |
| §8 | `<PREFIX>-<NNNN>`, at least four digits, growth beyond 9999 does not change existing IDs; unique; never reused; independent of the entity name. | l.300 "Formato `<PREFIX>-<NNNN>`, zero-padded a 4, expandible sin romper IDs existentes. Únicos, no reutilizables, independientes del nombre." | E-0004, E-0012 |
| §8.1 | Agents never assign IDs; only the engine allocates, from `.kf/id-registry.yaml`, under a transactional lock. | l.304 "Los agentes **SHALL NOT** asignar IDs. El engine los asigna desde `.kf/id-registry.yaml` con lock transaccional." | E-0007, E-0012, E-0013, E-0014 |
| §8.2 | An ID is permanent only after its first appearance on the canonical branch; the entity carries `id_status`. | l.308 "**«An ID is permanent only after its first appearance on the canonical branch.»**"; l.311 "# en la entidad, hasta el merge"; l.312 "id_status: provisional \| permanent" | E-0001, E-0009, E-0011 |
| §8.2 | Allocation on a non-canonical branch is provisional; canonical entry promotes. | l.315 "En un branch no canónico, `kf create` asigna un ID y lo marca `provisional`."; l.316 "Al entrar al branch canónico, `kf validate` lo promueve a `permanent`." | E-0001, E-0009, E-0011, E-0012, E-0014 |
| §8.2 | Provisional collisions are resolvable and only those; the later `first_canonical_commit` is renumbered and `id_alias` recorded. | l.317 "**Colisión al hacer merge:** solo es resoluble si **ambos** IDs en conflicto son `provisional`. El engine renumera el de `first_canonical_commit` posterior y registra `id_alias`." | E-0002, E-0003, E-0009, E-0010, E-0011, E-0012 |
| §8.2 | A permanent ID is never renumbered; collision with a permanent ID is `KF-E-101`, manual resolution. | l.318 "**Un ID `permanent` SHALL NOT ser renumerado jamás.** Colisión con un `permanent` → `KF-E-101`, resolución manual obligatoria." | E-0004, E-0010 |
| §8.2 | Aliases resolve in all queries, indefinitely. | l.319 "`id_alias` **SHALL** resolverse en todas las queries, indefinidamente." | E-0003, E-0011 |
| §9 | The registry lives at `.kf/id-registry.yaml` in the Knowledge Project. | l.358 "└── .kf/"; l.359 "    ├── id-registry.yaml" | E-0007 |
| §9.1 | `.kf/` is operational: append-only, written only by commands. | l.371 "\| Operacional \| `.kf/` \| Append-only, escrito solo por comandos \|" | E-0007, E-0012 |
| §10.1 | The entity's name is a label of an identity; the ID, not the name, identifies it (context for name independence). | l.393 "BR-0037  "Maximum Concentration Validation"" | — |
| §10.7 | The bare entity address `BR-0037` ("la entidad") is the only address form P002 resolves; fragment forms (`#specified`, `#observed:...`) need the E-0006 grammar. | l.554 "BR-0037                              la entidad"; l.564 "Esta sintaxis **SHALL** ser aceptada por `kf show`, `kf context`, `kf impact`, `kf diff`, y por `EV.supports`, `SC.asserts`, `CHG.affects` y `DSP.disputes`." (surface wiring deferred to P021/P022) | E-0003, E-0006 (OPEN, out of scope) |
| §10.8 | Git-derivable time fields never appear in YAML; by the same reasoning the canonical commit is not copied into the entity. | l.570 "`created_at` y `updated_at` **SHALL NOT** existir en YAML: los deriva Git (§17)." | E-0009 |
| §19.1 | Canonical-branch first appearance defines the commit used for IDs; squash merge is allowed; published canonical history is never rewritten. | l.1111 "transaction_time(X) = timestamp del primer commit que contiene X"; l.1112 "en el canonical_branch del Knowledge Repository"; l.1115 "**«Once published on the canonical branch, history SHALL NOT be rewritten.»**"; l.1117 "Esto **no** prohíbe squash merge: un feature branch puede entrar a `main` como un solo commit, y el transaction time empieza ahí." | E-0001, E-0009 |
| §3.2 | The Knowledge Repository's canonical branch is a name given to the engine; the engine never resolves it. | l.119 "knowledge: {path: ./formulation-knowledge}"; l.126 "canonical_branch: main" (repositories[] only) | E-0001 |
| §36 / §36.1 | Exit-code classes the CLI will map engine errors to (the engine itself exits nothing). | l.1600 "Los diagnostics **SHALL** generarse desde el catálogo de §44.2, no escribirse a mano." (§42.2 per E-0008(a)); l.1604 "`3` error de uso · `4` error interno · `5` recurso no disponible." | E-0001, E-0008(a), E-0014 |
| §42.2 | `KF-E-101` is the only identifier diagnostic. | l.1742 "\| `KF-E-101` \| E \| Colisión de ID con un ID `permanent` \| resolución manual \|" | E-0010, E-0014 |
| §55 | The feature ships with its fixture slice, independently stated, never after. | l.2103 "**El fixture es la definición operativa de "terminado".** Cada feature **SHALL** implementarse junto con su porción del fixture, nunca después" | — |

Errata-only contracts (no spec sentence, binding through the entry): E-0002 tie-break by path byte order; E-0003 live holder wins plus shadowed-alias warning; E-0004 `promote` records path and `move` event; E-0009 `first_canonical_commit` by first-parent index; E-0010 outcome and subject of the provisional-vs-permanent collision; E-0011 entity projection and `id_alias` schema field; E-0012 line format, events, replay; E-0013 lock staleness; E-0014 engine API only and error mapping.

## Deliverables and boundary

1. `framework/engine/id-registry.mjs` implementing the **public engine API** below (it may import private helper modules under `framework/engine/`).
2. `framework/schemas/common.schema.json`: add `id_alias` to `$defs.entityBase.properties` as an array of unique `entityId` strings (E-0011). No other schema change.
3. Unit/adversarial tests in `test/p002-*.test.mjs` (the implementer owns them) and the conformance slice in `framework/conformance/` plus `test/conformance*.test.mjs` (the conformance engineer owns them).
4. `HANDOFF.md` and the filled `TRACEABILITY.md` (implementer).

Writable paths. Implementer: `framework/engine/**`, `framework/schemas/common.schema.json`, `test/**` except `test/conformance*`. Conformance engineer: `framework/conformance/**` and `test/conformance*`. Nobody in this phase touches `bin/`, `package.json`, `scripts/`, `eslint.config.js`, `.gitattributes`, `.gitignore`, the spec, the errata, `.strike-team/**` (except the implementer's own `HANDOFF.md` and `TRACEABILITY.md` in the phase directory).

### Public engine API contract

Module: `framework/engine/id-registry.mjs`, ES module. All functions are `async`. `projectRoot` is a path string to the Knowledge Project root (which is also the Git work-tree root; see N-05 in `TRIAGE.md`). All repo-relative paths are POSIX paths relative to `projectRoot` (no leading `/`, `/` separators, no `.` or `..` segment, no empty segment, no backslash, no drive prefix, no control character U+0000..U+001F or U+007F). Branch names, commit SHAs and entity paths are compared as exact byte strings.

```
export class IdRegistryError extends Error { code: string; details?: object }   // name 'IdRegistryError'
export const CORE_ID_PREFIXES: readonly string[]       // CAP BP BR DE OUT SC EV UNK CHG DIV DSP (§4.1 order)

export function createGitHistoryReader(projectRoot): GitHistoryReader
export async function initializeIdRegistry(projectRoot, options?): Promise<Registry>
export async function readIdRegistry(projectRoot): Promise<Registry>
export async function allocateId(projectRoot, prefix, entityPath, options?): Promise<Allocation>
export async function promoteIds(projectRoot, options): Promise<PromotionResult>
export async function checkIdCollisions(projectRoot): Promise<CollisionReport>
export async function resolveId(projectRoot, address): Promise<Resolution>
```

**Types**

```
Registry   = { schema_version: 2.1, events: Event[] }            // events in file order
Event      = { op: 'allocate', id, id_status: 'provisional', path }
           | { op: 'promote',  id, path, commit }
           | { op: 'alias',    from, to, commit }
           | { op: 'move',     id, from, to }
Allocation = { id, id_status: 'provisional', path }
GitHistoryReader = {                                                        // injected; every method async
  firstParentCommits(branch: string): Promise<string[]>   // `git rev-list --first-parent --reverse <branch>`: full SHAs, oldest first
  readFile(commit: string, repoPath: string): Promise<string | null>   // UTF-8 text of the file at that commit, null if absent
}
Lock options  = { deadlineMs = 5000, staleAfterMs = 60000, pollMs = 20,
                  hostname = os.hostname(), isProcessAlive = (pid) => boolean, now = () => Date }
PromotionResult = {
  canonical_branch: string,
  promoted:   [{ id, path, commit }],          // in event order
  renumbered: [{ from, to, path, commit }],    // in event order
  entities_rewritten: string[],                // repo paths, ascending byte order; includes convergence rewrites
  diagnostics: Diagnostic[]                    // KF-E-101 entries; shape and presence under D-03(c) pending
}
CollisionReport = {
  diagnostics: Diagnostic[],                   // KF-E-101 only, ascending (id, path) byte order
  provisional_collisions: [{ id, paths: string[] }],   // unpromoted ID held by 2+ files; paths ascending byte order; ids ascending
  unregistered: [{ id, path }]                 // present only per D-03(a); shape pending
}
Diagnostic = { code: 'KF-E-101', severity: 'E', message: string, remediation: 'resolución manual',
               id, path, permanent_path }      // `path` = offending file; `permanent_path` = path in the promote record (after moves)
Resolution = {
  input: string, status: 'live' | 'alias' | 'unresolved', registered: boolean,
  id: string | null,        // the ID that names the answer (input if live; alias target if alias; null if unresolved)
  path: string | null,      // repo path of the live holder of `id`
  via: string[],            // [input] if live; [input, ..., id] alias chain if alias; [] if unresolved
  warnings: [{ kind: 'shadowed_alias', alias_from, alias_to, message }]   // no `code` field (E-0003)
}
```

`status: 'ambiguous'` and `AMBIGUOUS_ID` are pending D-03(b).

**Function contracts**

- `createGitHistoryReader(projectRoot)`: returns a reader backed by the `git` executable (no shell; arguments passed as an array). `firstParentCommits(branch)` rejects with `IdRegistryError` code `CANONICAL_BRANCH_UNRESOLVED` if `branch` (any revision that `git rev-parse --verify --quiet <branch>^{commit}` resolves, including `origin/main`) does not resolve to a commit, and with code `HISTORY_INCOMPLETE` if the repository is shallow (a truncated first-parent list would give clone-dependent results). `readFile` resolves the path relative to `projectRoot`. A branch string starting with `-` is rejected as `CANONICAL_BRANCH_UNRESOLVED` without invoking Git on it.
- `initializeIdRegistry(projectRoot, options?)`: creates `.kf/id-registry.yaml` with `schema_version: 2.1` and no events and returns the registry. Rejects `REGISTRY_EXISTS` if the registry file exists, and `EXISTING_ENTITIES` if any entity file (see "Entity files") carries an ID. Behavior when `.kf/` pre-exists without a registry file: pending D-01. Empty-list bytes: pending D-05. Takes the lock (options.lock).
- `readIdRegistry(projectRoot)`: reads, parses and fully replay-validates the registry; no lock; returns events as plain objects with exactly the key set of their `op`. Rejects `REGISTRY_MISSING`, `INVALID_YAML`, `INVALID_REGISTRY`.
- `allocateId(projectRoot, prefix, entityPath, options?)`: under the lock, replays the registry, assigns `<prefix>-<N>` where `N` = (maximum numeric suffix over every ID that appears in any event for that prefix, in `id`, `from` or `to`) + 1, rendered with at least four digits (zero padding to 4; no padding added beyond 4), appends one `allocate {id, id_status: provisional, path}` event and returns `{id, id_status: 'provisional', path}`. The status is always `provisional`: the spec makes an ID permanent only after canonical appearance (l.308), and E-0012's `allocate` event admits only `provisional`. It reads only the registry: no Git, no entity scan (D-03(a) pending for the unregistered-ID case). Rejects `INVALID_PREFIX` (not one of the 11 core prefixes), `INVALID_PATH`, plus the registry and lock errors. `options` = `{ lock, rename }`.
- `promoteIds(projectRoot, { canonicalBranch, history?, lock?, rename? })`: the promotion/renumbering operation (what `kf validate` will call). `canonicalBranch` is required (`CANONICAL_BRANCH_REQUIRED` if missing, not a string or empty); the engine never reads `workspace.yaml`, never calls `git symbolic-ref`, never assumes `main`, and does not consult the checked-out branch (E-0001). `history` defaults to `createGitHistoryReader(projectRoot)`. Behavior, all inside one lock and with the registry validated first (any error before the registry write leaves registry and entities unchanged):
  1. For each entity file whose ID is registered and not yet promoted, compute `first_canonical_commit` per E-0009: the first SHA in `history.firstParentCommits(canonicalBranch)` at which `history.readFile(sha, path)` parses to a YAML mapping whose `id` equals the file's ID. No such commit: the entity stays as it is (still provisional).
  2. Group the unpromoted IDs: one canonical holder: append `promote {id, path, commit}` (path = the file's path now) and rewrite the file to `id_status: permanent`. Two or more canonical holders: order them by (first-parent index ascending, then repo-relative path ascending in UTF-8 byte order, E-0002/E-0009); the first is promoted as above; every other is renumbered: a fresh ID for the prefix is allocated (same counter rule as `allocateId`), events `allocate {id: <new>, id_status: provisional, path}` and `alias {from: <old>, to: <new>, commit}` are appended, and the file is rewritten to `id: <new>`, `id_status: provisional`, `id_alias` extended with `<old>`. The new ID is not permanent: it has not yet appeared on the canonical branch (l.308) and is promoted by a later call, once the rewritten file is in canonical history. Value of `commit`, order of several losers and event order: pending D-02.
  3. An ID that already has a `promote` event is never promoted again, never renumbered and never changes holder (l.318). Another file carrying it at a different path (after `move` events) is a `KF-E-101` collision (E-0010): no event is written for it and the file is not rewritten. Whether the call then aborts or continues for other IDs: pending D-03(c).
  4. Convergence (E-0011, registry authoritative): every holder file whose `id`, `id_status` or `id_alias` differs from the registry's projection is rewritten to it. Projection of a promoted holder: `id_status: permanent`; of a lone unpromoted holder: `provisional`; `id_alias` = the `from` IDs of the alias chain that ends at its ID, oldest first (key omitted when empty). A file at path `P` that carries an old ID `X` while the registry holds `allocate {id: Y, path: P}` and `alias {from: X, to: Y}` is a pending renumber (an interrupted earlier call), is rewritten to `Y`, and is not a collision.
  5. All events of one call are appended in a single atomic registry write, before any entity file is rewritten; entity files are then rewritten one at a time, each atomically (temporary file in the same directory, flush, rename), in ascending path byte order. A repeated call with no change in canonical history writes nothing: registry bytes and entity bytes are identical, and `promoted`, `renumbered`, `entities_rewritten` are empty (idempotent).
  6. Rewriting an entity changes only the three identity keys; every other key, value, comment and the key order is preserved, new keys are inserted directly after `id_status` (`id_status` after `id` if absent), output uses LF.
- `checkIdCollisions(projectRoot)`: read-only, no lock, no Git. Classification over the registry and the entity files: for an ID with a `promote` event the holder is the file at the promoted path, followed through `move` events in file order; every other file carrying that ID (other than a pending renumber, item 4 above) yields one `KF-E-101` diagnostic with `path` = that file and `permanent_path` = the holder path, whether or not the offender is itself marked `permanent` (E-0010). An ID without `promote` held by two or more files is reported in `provisional_collisions` and is not an error here (it is resolved at promotion). Never throws for a collision; throws only for registry errors.
- `resolveId(projectRoot, address)`: `address` is a bare entity ID (`^(CAP|BP|BR|DE|OUT|SC|EV|UNK|CHG|DIV|DSP)-[0-9]{4,}$`); anything else rejects `INVALID_ID` (fragment addresses are E-0006). Reads the registry and the entity files; no lock. If a live holder (as in `checkIdCollisions`) exists for `address`: `status: 'live'`, that holder, and one `shadowed_alias` warning per `alias` event whose `from` is `address` (sorted by `alias_to`), naming the alias target. If no live holder: follow `alias` events from `address` (each `to` may itself have a live holder or a further alias) until an ID with a live holder is reached: `status: 'alias'`, `id` = that ID, `via` = the chain, no warning. Otherwise `status: 'unresolved'` (`registered` tells whether the ID occurs in any event). Pure function of registry plus tree: no clock, no randomness. Multi-candidate cases: pending D-03(b).

**Lock and atomic write (E-0013)**

- Lock = directory `.kf/id-registry.lock/`, created with `mkdir` (atomic); then the owner file `.kf/id-registry.lock/owner.json` is written: `{"pid": <int>, "host": <string>, "acquired_at": <ISO-8601 UTC string>}` (file name and format defined by this plan; LOW reversibility, untracked). `acquired_at` is wall-clock, operational only, and never influences an ID.
- Stale iff `now() - acquired_at > staleAfterMs` AND `owner.host === hostname` AND `isProcessAlive(owner.pid)` is false. Breaking: rename the lock directory to a unique sibling whose name matches `.kf/*.lock` (so `.gitignore` covers it), then remove it, then retry acquisition; of several contenders exactly one wins the rename. A procedure that can remove a lock acquired after staleness was determined is a defect. A lock whose owner host differs, whose owner process is alive, or that is younger than the threshold is never broken. Owner-less lock directories: D-04.
- Waiting is bounded by `deadlineMs`; expiry rejects `LOCK_TIMEOUT`. `EPERM`, `EBUSY` and `EACCES` from a rename (registry write or lock break) are retried every `pollMs` until the deadline; expiry also rejects `LOCK_TIMEOUT`; any other rename error propagates unchanged. The lock is released on success and on every failure path.
- Registry write: serialize the whole registry, write to a temporary file in `.kf/`, flush, rename over the registry (via `options.rename`, default `fs.promises.rename`, so tests can inject failures). On any failure the registry file is byte-identical to before and the temporary file is removed.

**Registry file (E-0012)**

```
schema_version: 2.1
events:
  - {op: allocate, id: BR-0001, id_status: provisional, path: knowledge/business-rules/alpha/rule.yaml}
  - {op: promote, id: BR-0001, path: knowledge/business-rules/alpha/rule.yaml, commit: <40-hex SHA>}
  - {op: alias, from: BR-0001, to: BR-0002, commit: <40-hex SHA>}
  - {op: move, id: BR-0001, from: <path>, to: <path>}
```

Exactly one physical line per event, starting with `- {` after indentation and ending with `}`, never folded, however long, LF-terminated; keys in the order shown; strings that need quoting (for example `, : # { } [ ] "` or leading/trailing space) are quoted so the line still parses to the same value. No timestamps, no actor fields. Header lines are exactly `schema_version: 2.1` and `events:`. Reader validity (every violation is `INVALID_REGISTRY`; unparsable YAML is `INVALID_YAML`): `schema_version` equals 2.1; `events` is a list (empty form: D-05); every event is a mapping with exactly the keys of its `op` and string values; `op` is one of the four (unknown `op` fails closed); every ID matches the core pattern; `allocate.id_status` is `provisional`; `commit` is a full lowercase hex SHA (40 or 64 characters); paths follow the path rule; for each ID at most one `promote`, and a `promote` requires an `allocate` for that ID somewhere in the registry; `alias.from` differs from `alias.to`, both have an `allocate` somewhere, and the alias graph has no cycle; a `move` for a promoted ID must have `from` equal to the ID's current path. Duplicate `allocate` events for one ID (with no `promote`) are valid: they are the recorded provisional collision (E-0012). An `allocate` for an already-promoted ID (as a union merge can order lines) is also valid and is not a holder change.

**Entity files.** Entity roots scanned: `knowledge/`, `changes/`, `divergences/` (§9, l.333-352), recursively, files ending `.yaml` or `.yml`, read as UTF-8; a file is an entity record iff it parses as a YAML mapping with a top-level `id` key (the observed facet files of the P001 fixture use `entity:` and are therefore not records; a facet file carrying a top-level `id` would be treated as a record and is not asserted). Scan order never affects results (paths are sorted in byte order).

**Error codes** (`IdRegistryError.code`; internal, never `KF-` except the diagnostic code; E-0014 class = what the CLI layer will map to)

| Code | Raised when | E-0014 class (CLI-owned) |
|---|---|---|
| `REGISTRY_MISSING` | registry file or `.kf/` absent; never auto-recreated | resource unavailable (5) |
| `LOCK_TIMEOUT` | deadline expired waiting for the lock or retrying a blocked rename | resource unavailable (5) |
| `INVALID_YAML` | registry is not parseable YAML | internal (4) |
| `INVALID_REGISTRY` | registry fails any reader-validity rule | internal (4) |
| `CANONICAL_BRANCH_REQUIRED` | `canonicalBranch` missing or empty | usage (3) |
| `CANONICAL_BRANCH_UNRESOLVED` | the reader cannot resolve the branch | usage (3) |
| `HISTORY_INCOMPLETE` | default reader on a shallow repository | not listed in E-0014 |
| `REGISTRY_EXISTS`, `EXISTING_ENTITIES` | `initializeIdRegistry` refusals | not listed in E-0014 |
| `INVALID_PREFIX`, `INVALID_PATH`, `INVALID_ID` | argument validation | not listed in E-0014 |
| `UNREGISTERED_ID`, `AMBIGUOUS_ID`, `KF-E-101` as an error code | pending D-03(a), (b), (c) | pending |

`UNRESOLVED_COLLISION` (checkpoint) is retired: provisional collisions are resolved at promotion, not by refusing allocation. `KF-E-101` is the only code taken from §42.2.

## Design constraints

- A permanent ID never changes holder and is never renumbered; no ID is ever reissued, including IDs of deleted, failed or renamed entities (l.300, l.318). The counter is derived from the registry alone.
- No wall-clock and no randomness influence any ID, event content or event order. Temporary file names and lock owner timestamps are operational only. Results are identical on every clone and on every operating system (sorted byte-order traversal, LF, forward-slash paths).
- Registry writes are atomic and under the lock; events are only appended (the byte prefix of an existing registry is never rewritten by `allocateId` or `promoteIds`, except the list header when it goes from empty to non-empty, D-05).
- The engine never resolves the canonical branch (E-0001) and never reads configuration. `ids.padding` is not read (T-09 deferred to P007): the 4-digit minimum is a constant.
- Commits are persisted only in registry events, never in entity files (E-0009, l.570). Entity files are a projection of the registry (E-0011).
- A missing registry is never recreated from an entity scan (E-0014). `initializeIdRegistry` refuses over existing entities.
- Registry events are fully validated on every read, including before a write; a failed validation mutates nothing.
- Only `KF-E-101` is taken from the diagnostics catalog; no `KF-` code is invented (E-0014). Message text is free; fields are not.
- Git is touched only through the injected `GitHistoryReader`; the default reader uses `execFile` with an argument array.
- `allocateId` does not scan entity files or Git; collision handling is promotion's job (l.317).
- No address grammar, no cross-file reference rewrite on renumbering, no `kf` command, no `bin/`.
- No performance target is authorized; an optimization of `first_canonical_commit` (for example bisection) is allowed only if it returns the same SHA as the linear definition on every fixture case, including path reuse with a different earlier ID.

## Fixture slice

**§55 entities added: none.** §55 (l.2075-2103) lists no ID command line and P002 has no CLI, so there is no `expected/` command line to add; the `acme-formulation` fixture is not changed (its entities omit `id_status` and are not registered). `framework/conformance/expected/` does not exist until P028; this slice therefore lives as data plus a test and is ported by the phase that builds the runner. Layout, written by the conformance engineer before any implementer code is read: `framework/conformance/p002-id-registry.yaml` (cases; replaces the checkpoint content), `framework/conformance/p002-id-registry/` (helper scripts, for example the child-process allocator, and schema cases), `test/conformance-p002-id-registry.test.mjs`.

Conventions common to the cases. Every scenario runs in a fresh temporary directory outside the repository. Git scratch repositories are made with `git init -b main`, a fixed identity, and fixed `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` so that commit SHAs are reproducible; the test reads actual SHAs with `git rev-parse` / `git rev-list --first-parent --reverse` and compares against them (never against hard-coded SHAs). Base commit `B0` holds `.gitattributes` (`.kf/id-registry.yaml merge=union`), `.gitignore` (`.kf/*.lock/`), and the registry created by `initializeIdRegistry` plus one seed `allocateId('CAP', 'knowledge/capabilities/seed/capability.yaml')` so that the registry list is non-empty (D-05) and the seed entity file. Entity paths: `A` = `knowledge/business-rules/alpha/rule.yaml`, `B` = `knowledge/business-rules/beta/rule.yaml`, `G` = `knowledge/business-rules/gamma/rule.yaml`. Entity file template: a leading comment line `# keep me`, then `schema_version: 2.1`, `id: <id>`, `id_status: <status>`, `type: business-rule`, `name: <label>`. "Registry events" means the parsed event list; "line" means one physical line.

Cases (Given / When / Then). IDs in square brackets map to Verification targets.

**Allocation and format**
- F-A1 Fresh project, no Git. `initializeIdRegistry`; `allocateId` for `BR`, `BR`, `DE`, `BR`, `CAP` with paths p1..p5. Then: `BR-0001`, `BR-0002`, `DE-0001`, `BR-0003`, `CAP-0001`, each `{id_status: 'provisional', path: <given>}`; `readIdRegistry` returns five `allocate` events in that order; the registry file has one event per physical line, header lines exact. [V-01, V-07, V-08]
- F-A2 Growth. Seed a registry (hand-written in the E-0012 format) containing `allocate BR-9999`; `allocateId('BR')` twice, `allocateId('DE')` once. Then `BR-10000`, `BR-10001`, `DE-0001`; the seeded bytes are an exact prefix of the file after each call; a second seed with `BR-12345` yields `BR-12346`. [V-02]
- F-A3 Non-reuse. Allocate `BR` three times, create entity files for the first and third only, delete the third file, `git mv` the first to a new directory, change its `name`. `allocateId('BR')` returns `BR-0004`. A registry seeded with only `BR-0007` yields `BR-0008` (gaps are not filled). [V-03]
- F-A4 Prefix validation. `allocateId` with `XYZ`, `br`, `POL`, `ACT`, `''`, `BR-` rejects `INVALID_PREFIX`, registry bytes unchanged; each of the 11 core prefixes is accepted. [V-05]
- F-A5 Path validation. `''`, `/abs/x.yaml`, `../x.yaml`, `a/../b.yaml`, `./a.yaml`, `a//b.yaml`, `a\b.yaml`, `C:/x.yaml`, a path with an embedded newline or tab reject `INVALID_PATH`; registry bytes unchanged. [V-06]
- F-A6 Line integrity. Paths containing `, : # { } [ ] "`, spaces, `é`, `日本`, and a 300-character path are allocated; the registry has exactly one physical line per event; `readIdRegistry` returns the identical `path` strings; the YAML of each event line parses stand-alone to the same mapping. [V-07]
- F-A7 No Git, no entities. Allocation in a plain temporary directory that is not a Git repository and contains no entity files succeeds. [V-08]

**Locking and atomicity**
- F-B1 24 concurrent in-process `allocateId('BR', p_i)` calls return 24 distinct IDs `BR-0001..BR-0024` and the registry has exactly 24 `allocate` lines. [V-10]
- F-B2 Cross-process: 6 child `node` processes, each running `allocateId` 5 times against one project: 30 distinct IDs, no gap in `BR-0001..BR-0030`, registry parses, 30 lines. [V-11]
- F-B3 Lock table, each with a hand-made `.kf/id-registry.lock/owner.json` and the registry captured byte-for-byte, `deadlineMs` 300, `staleAfterMs` 1000, `hostname` injected:
  - (i) host equals injected hostname, pid of a process that has exited (spawn and wait), `acquired_at` 10 minutes ago: `allocateId` succeeds, the lock directory is gone afterwards and no `.kf/*.lock` remains. [V-12]
  - (ii) same host, `pid = process.pid` (alive), `acquired_at` 10 minutes ago: `LOCK_TIMEOUT`, lock directory and registry bytes unchanged. [V-13]
  - (iii) same host, exited pid, `acquired_at` 1 second ago with `staleAfterMs` 60000: `LOCK_TIMEOUT`, unchanged. [V-14]
  - (iv) different host, exited pid, `acquired_at` 10 minutes ago: `LOCK_TIMEOUT`, lock directory untouched. [V-15]
  - (v) lock directory with no owner file, created just now: `LOCK_TIMEOUT` after about `deadlineMs`, unchanged (older owner-less lock: D-04). [V-16]
  - (vi) `deadlineMs: 50` on a held lock rejects `LOCK_TIMEOUT` in well under 2 seconds. [V-22]
  - (vii) case (i) with 8 concurrent `allocateId` contenders (and a second variant with 3 child processes): all succeed, 8 distinct IDs, contiguous, no leftover `.kf/*.lock`, one line per ID. [V-17]
- F-B4 Release and atomic write. After a thrown `allocateId` (invalid prefix) and after a successful one, `.kf/` holds no lock directory and a following call works. With `options.rename` throwing `EIO` once the temporary file exists: rejects with that error, registry byte-identical, no temporary file left, lock released. With `options.rename` throwing `EPERM`, then `EBUSY`, then `EACCES`, then succeeding: one `allocate` event, success. A stray `id-registry.yaml.leftover.tmp` in `.kf/` changes no result. [V-18, V-19, V-20, V-21]

**Registry read and validity**
- F-C1 Missing registry. No `.kf/` at all, and `.kf/` present without the registry file: `readIdRegistry`, `allocateId`, `promoteIds`, `checkIdCollisions`, `resolveId` reject `REGISTRY_MISSING`; no `.kf/id-registry.yaml` appears; this holds with entity files present. `initializeIdRegistry` over a tree with an entity carrying an ID rejects `EXISTING_ENTITIES`; over an existing registry rejects `REGISTRY_EXISTS` (the `.kf/`-exists-without-registry row: D-01). A fresh `initializeIdRegistry` yields a registry that `readIdRegistry` reads as `{schema_version: 2.1, events: []}` (bytes: D-05). [V-23]
- F-C2 Corrupt registry. Each input makes `readIdRegistry` and `allocateId` reject without changing the file: `events: [invalid` → `INVALID_YAML`; empty file, `schema_version: 2.0`, `events` a mapping, an event that is not a mapping → `INVALID_REGISTRY` (table in V-25). [V-24]
- F-C3 Invalid events, each in an otherwise valid registry, all `INVALID_REGISTRY`: unknown `op` (`delete`); `allocate` with `id_status: permanent`; missing key; extra key; id `br-0001`, `XX-0001`, `BR-1`; `promote` with commit `abc`; two `promote` lines for one ID; `promote` for an ID with no `allocate`; `alias` with `from == to`; `alias` whose `to` has no `allocate`; alias cycle `BR-0001→BR-0002`, `BR-0002→BR-0001`; three-step cycle; `move` (for a promoted ID) whose `from` is not the ID's current path. [V-25]
- F-C4 Duplicate provisional allocations. Hand-written registry with `allocate BR-0005` at two different paths and no `promote`: reads fine; `allocateId('BR')` gives `BR-0006`. [V-26]
- F-C5 Real Git union merge. From `B0`, branch `f1` and branch `f2` each call `allocateId('BR', ...)` (both obtain `BR-0001`, paths `A` and `B`) and commit; `git merge --no-ff` of both into `main`: no conflict, the merged registry contains both `allocate` lines and the seed, no conflict markers, `readIdRegistry` succeeds, the next `allocateId('BR')` is `BR-0002`. (Both-sides-first-event variant from an empty base: D-05.) [V-27]
- F-C6 Ordering tolerance. A registry in which the `allocate BR-0001` line for path `B` comes after the `promote BR-0001` line for path `A`, and the same registry with the order reversed, both read successfully. [V-28]

**Branches and promotion**
- F-D1 Non-canonical. `B0` on `main`; branch `feature`; `allocateId('BR', A)`; entity file `A` written (`BR-0001`, provisional) and committed on `feature` only. `promoteIds({canonicalBranch: 'main'})` while checked out on `feature`: no change; `promoted`, `renumbered`, `entities_rewritten` empty; registry and entity bytes unchanged. [V-29]
- F-D2 Canonical entry, three ways, each from F-D1 followed by a different integration into `main`: (a) `git merge --no-ff feature` (merge commit `M`); (b) fast-forward merge; (c) `git merge --squash feature` and commit `S`. `promoteIds({canonicalBranch: 'main'})` then yields: a `promote {id: BR-0001, path: A, commit: <SHA>}` event where `<SHA>` is the first element of `git rev-list --first-parent --reverse main` at whose tree `A` exists with `id: BR-0001` (that is `M` in (a), the feature commit that introduced `A` in (b), `S` in (c)); `promoted` lists that triple; entity `A` now has `id_status: permanent` and the comment `# keep me`, same other keys, no `id_alias`; no other event added. [V-30, V-31, V-37]
- F-D3 Branch parameter. Same history with the canonical branch named `trunk` and no `main`: `promoteIds({canonicalBranch: 'trunk'})` promotes; `promoteIds({canonicalBranch: 'main'})` rejects `CANONICAL_BRANCH_UNRESOLVED`; missing option, `''`, `42` reject `CANONICAL_BRANCH_REQUIRED`; `'-x'` rejects `CANONICAL_BRANCH_UNRESOLVED`; each leaves registry and entities byte-identical. [V-32]
- F-D4 Independence from the checked-out branch. Entity `A` in canonical history; working copy checked out on `feature` (which contains `A`): `promoteIds({canonicalBranch: 'main'})` promotes using `main`'s first-parent history, not `feature`'s. [V-33]
- F-D5 First-parent semantics. `feature` has commits `c1` (adds `A` with another ID `BR-0009`), `c2` (changes `A` to `BR-0001`), `c3`; merged `--no-ff` into `main` as `M`. The recorded commit is `M`, not `c2`, even though `c2` is reachable from `main`; a path first carrying a different ID in an earlier canonical commit does not count. A second case: canonical history contains `A` with `BR-0009` at `X1`, then with `BR-0001` at `X2`; recorded commit `X2`. [V-34]
- F-D6 Shallow clone. `git clone --depth 1 file://<path>` of a repository with several canonical commits; the default reader rejects `HISTORY_INCOMPLETE` and nothing changes. [V-34]
- F-D7 Idempotence. After F-D2(a), run `promoteIds` again, then add a new commit on `main` touching another file and run it again: results empty, registry bytes and entity bytes identical, recorded commit still `M`. [V-35]
- F-D8 Path at promotion. `allocateId('BR', A)`, then the entity file is created at `G` instead (renamed before canonical entry) and merged: `promote.path` is `G`. [V-36]
- F-D9 Convergence after an interrupted rewrite. After F-D2(a), restore entity `A` to its pre-promotion bytes (`id_status: provisional`), run `promoteIds`: file is `permanent` again, `entities_rewritten == [A]`, no new registry event. [V-46]
- F-D10 Atomic event write. Inject `options.rename` failing on the registry rename during a `promoteIds` call that would promote: registry byte-identical (no partial set of events), entity files unchanged. [V-47]

**Collisions and renumbering**
- F-E1 Two provisional colliders, different commits. `B0`; `f1` allocates `BR-0001` for `A`, `f2` (from `B0`) allocates `BR-0001` for `B`; both entity files carry `BR-0001`, provisional; `git merge --no-ff f1` (`M1`), then `git merge --no-ff f2` (`M2`) into `main`. `promoteIds({canonicalBranch: 'main'})`: `promote {BR-0001, A, M1}`; `B` is renumbered to `BR-0002`: events `allocate {BR-0002, provisional, B}` and `alias {from: BR-0001, to: BR-0002, commit: ...}` (value D-02(a)); entity `A`: `id: BR-0001`, `id_status: permanent`, no `id_alias`; entity `B`: `id: BR-0002`, `id_status: provisional`, `id_alias: [BR-0001]`; `renumbered` lists `{from: BR-0001, to: BR-0002, path: B, commit}`. `BR-0001` has exactly one `promote`. [V-38]
- F-E2 Same-commit tie (E-0002). One feature branch adds two entity files carrying `BR-0001` in one commit (registry has `allocate BR-0001` for the file that will lose), merged `--no-ff`; files are created in the reverse of the sorted order. The file whose repo-relative path is smaller in UTF-8 byte order keeps `BR-0001`. Three pairs: (a) `.../Z/rule.yaml` and `.../a/rule.yaml`: `Z` wins; (b) `.../é/rule.yaml` and `.../z/rule.yaml`: `z` wins; (c) `.../a-b/rule.yaml` and `.../a/rule.yaml`: `a-b` wins (`-` is 0x2D, `/` is 0x2F). Winner promoted, loser renumbered with alias, as in F-E1. [V-39]
- F-E3 Three colliders in one commit (paths `.../c3/`, `.../b2/`, `.../a1/`). `a1` keeps the ID; `b2` and `c3` are renumbered, each with its own `allocate` and `alias`, new IDs distinct and larger than every existing `BR` ID; each loser's `id_alias` is `[BR-0001]`. (Which new number each loser gets: D-02(b).) [V-40]
- F-E4 New ID promoted later. Continue F-E1: commit the rewritten `B` on `main` (`M3`), `promoteIds`: `promote {BR-0002, B, M3}`; `B` becomes `permanent` with `id_alias: [BR-0001]` kept; the `alias` event is still present; running again changes nothing. Chain: a second renumber of `BR-0002` yields `id_alias: [BR-0001, BR-0002]` oldest first (seed the colliding state by hand). [V-41]
- F-E5 Provisional vs permanent (E-0010). `f2` (allocating `BR-0001` for `B`) is created from `B0`; `f1` (`BR-0001` for `A`) is merged and promoted first (`promote BR-0001` for `A`); then `f2` is merged into `main`. `checkIdCollisions` returns exactly one diagnostic `{code: 'KF-E-101', severity: 'E', remediation: 'resolución manual', id: 'BR-0001', path: B, permanent_path: A}` and `provisional_collisions: []`. `promoteIds`: the outcome (throw or return) is D-03(c); under both, no new `BR-0001` event is written, `B` is not rewritten, `A` is untouched. No automatic renumbering. [V-42, V-45]
- F-E6 Two permanent claims. Registry has `promote BR-0001` for `A`; entity `B` carries `BR-0001` with `id_status: permanent`: one `KF-E-101`, `path: B`, none for `A`. [V-43]
- F-E7 Continuity (E-0004). After promotion of `A`: (a) directory moved by `git mv` to `G` with no registry change: `KF-E-101` with `path: G`, `permanent_path: A`; (b) same state with `move {op: move, id: BR-0001, from: A, to: G}` appended to the registry: no diagnostic, and `resolveId('BR-0001')` reports `path: G`; (c) only the `name` value in `A` changed: no diagnostic; (d) entity deleted and a different file recreated at `A` with the same ID and content: no diagnostic (same path). [V-44]
- F-E8 Near-miss. Two provisional files with the same ID and no `promote`: `checkIdCollisions` returns `diagnostics: []` and one `provisional_collisions` entry with sorted paths. [V-45]
- F-E9 Convergence of a pending renumber. After F-E1, restore entity `B` to `id: BR-0001` (provisional, no `id_alias`) as if the process died after the registry write: `checkIdCollisions` returns no `KF-E-101`; `promoteIds` rewrites `B` back to `BR-0002` / `id_alias: [BR-0001]` and adds no event. [V-46]
- F-E10 Determinism. Run F-E1 and F-E2 in two independent scratch repositories built with the same fixed dates and identity, and in a `git clone` of the pre-promotion repository: registry bytes and entity bytes are identical across all three; creating the entity files in a different order does not change them; running with a different injected `now` and hostname does not change them. [V-48]
- F-E11 Invariant sweep. After every case above, for each ID that has a `promote` event, that event line is unchanged from the first time it was written, and the ID's holder path (after moves) never changed. [V-49]

**Resolution**
- F-R1 Live holder wins. State of F-E1: `resolveId('BR-0001')` → `status: 'live'`, `id: 'BR-0001'`, `path: A`, `via: ['BR-0001']`, one warning `{kind: 'shadowed_alias', alias_from: 'BR-0001', alias_to: 'BR-0002'}` with no `code` key; `resolveId('BR-0002')` → live, `path: B`, no warning. [V-50]
- F-R2 Alias-only. From F-R1, delete entity `A` from the working tree: `resolveId('BR-0001')` → `status: 'alias'`, `id: 'BR-0002'`, `path: B`, `via: ['BR-0001', 'BR-0002']`, `warnings: []`. After later canonical commits and further `promoteIds` calls the alias event is still in the registry and the result is the same. [V-51]
- F-R3 Chain. Hand-seeded registry and entities: `BR-0001→BR-0002`, `BR-0002→BR-0003` with only `BR-0003` live: `resolveId('BR-0001')` → alias, `id: 'BR-0003'`, `via: ['BR-0001','BR-0002','BR-0003']`. If `BR-0002` is live: `id: 'BR-0002'`, `via: ['BR-0001','BR-0002']`. [V-52]
- F-R4 Unresolved and invalid. An allocated ID with no entity file and no alias: `status: 'unresolved'`, `registered: true`, `id: null`. `BR-9999` never allocated: `unresolved`, `registered: false`. `resolveId('br-1')`, `'BR-0001#specified'`, `''` reject `INVALID_ID`. [V-53]
- F-R5 Alias cycle in the registry is rejected on read (F-C3); `resolveId` then rejects `INVALID_REGISTRY` and cannot loop. [V-25, V-53]

**Schema**
- F-S1 `framework/schemas/common.schema.json` accepts an entity (validated through each of `business-rule`, `capability`, `change`, `data-entity`, `evidence`, `scenario` schemas, built from the existing P001 fixture entities) with `id_alias: ["BR-0001"]` and `id_status: permanent`; rejects `id_alias: ["BR-0001","BR-0001"]` (duplicate), `["br-1"]`, `"BR-0001"` (not an array), `[1]`; the existing P001 corpus keeps passing. [V-55]

## Implementation sequence

1. **Conformance engineer first** (`kf-conformance-engineer`): write `framework/conformance/p002-id-registry.yaml`, helper scripts and `test/conformance-p002-id-registry.test.mjs` from this plan, the spec and errata only, before opening `framework/engine/**` or any implementer diff. The suite is red (or skipped with named `test.todo`) at that point. Each D-nn-dependent assertion is marked `pending-decision`; nothing is guessed.
2. **Foreman verifies** the slice (it states observable behavior only, cites clause or E-id per case), resolves `DECISION_NEEDED` items D-01..D-05 into errata or defers them, then briefs the implementer. Unresolved items block only the assertions named in `TRIAGE.md`.
3. **Implementer** (`kf-implementer`), in this order, each step with tests failing first:
   1. `common.schema.json` `id_alias` field and a P001-style positive/negative test.
   2. Registry codec: serializer (one line per event) and reader/validator with replay (counters, duplicates, promote/alias/move rules); table-driven tests for every F-C3 row.
   3. Lock and atomic write with the E-0013 options (`deadlineMs`, `staleAfterMs`, `pollMs`, `hostname`, `isProcessAlive`, `now`) and `options.rename`; the stale-break race (a lock acquired after staleness was determined must not be removed) gets its own adversarial test.
   4. `initializeIdRegistry`, `readIdRegistry`, `allocateId` with the new signature; delete the retired checkpoint behavior (`UNRESOLVED_COLLISION`, allocation-time entity scan). Update or retire `test/p002-id-registry.test.mjs` so it no longer depends on the old fixture shape (the implementer may not edit `framework/conformance/**`).
   5. `createGitHistoryReader`, then `checkIdCollisions` and `resolveId` (read-only).
   6. `promoteIds`: E-0009 commit derivation, E-0002 order, renumbering, projection and convergence, atomic event write followed by atomic entity rewrites.
   7. Adversarial pass: permanent ID reuse after delete/recreate, interrupted write at each point, two processes promoting simultaneously, Windows rename retry, hostile paths, shallow clone, `git` failure.
4. Run `npm run build`, `npm run lint`, `npm test`, `git diff --check`, the conformance test, and the targeted P002 tests twice (deterministic repeat). Inspect `git status` against the write boundaries.
5. Fill `TRACEABILITY.md` (PASS only with executable evidence), write `HANDOFF.md` naming the exact product commit, return to the Foreman. The Foreman commits product then control plane, sets `READY_FOR_AUDIT`, and audits with fresh instances (blind pass first).

## Verification targets

Each target maps to a fixture case (F-) and to a test in `test/conformance-p002-id-registry.test.mjs` (conformance) or `test/p002-*.test.mjs` (implementer's adversarial tests). Targets marked "partial" have a part held by a `DECISION_NEEDED` item.

| V | Observable target | Case | Status of decision |
|---|---|---|---|
| V-01 | `allocateId` allocates per-prefix sequences from 0001 and returns `{id, id_status: 'provisional', path}` | F-A1 | — |
| V-02 | Allocation crosses 9999 (`BR-10000`, `BR-10001`) without touching earlier IDs; earlier bytes are an exact prefix | F-A2 | — |
| V-03 | No ID is reused: deleted, renamed, failed-to-create entities, gaps and alias-only highest numbers | F-A3 | — |
| V-04 | Next number = maximum numeric suffix over all recorded IDs of the prefix + 1 (E-0012), whatever event they occur in | F-A3 | — |
| V-05 | Only the 11 core prefixes are accepted; `INVALID_PREFIX` leaves the registry unchanged | F-A4 | — |
| V-06 | `INVALID_PATH` for each non-conforming path; registry unchanged | F-A5 | — |
| V-07 | One physical line per event for hostile and 300-character paths; exact header; values round-trip; key order per `op` | F-A1, F-A6 | — |
| V-08 | Allocation needs neither Git nor entity files | F-A7 | partial (D-03(a)) |
| V-10 | 24 concurrent in-process allocations are distinct and complete | F-B1 | — |
| V-11 | 30 allocations from 6 processes are distinct and contiguous | F-B2 | — |
| V-12 | Stale lock (same host, dead pid, older than threshold) is recovered and removed | F-B3(i) | — |
| V-13 | Lock held by a live pid on this host is not broken | F-B3(ii) | — |
| V-14 | Lock younger than the threshold is not broken even if the pid is dead | F-B3(iii) | — |
| V-15 | Lock owned by another host is never broken | F-B3(iv) | — |
| V-16 | A fresh owner-less lock blocks to `LOCK_TIMEOUT` | F-B3(v) | partial (D-04) |
| V-17 | Concurrent contenders on one stale lock: single winner, distinct IDs, no leftover lock | F-B3(vii) | — |
| V-18 | Lock released on success and on every failure | F-B4 | — |
| V-19 | Injected failure at the registry rename leaves the registry byte-identical and removes the temporary file | F-B4 | — |
| V-20 | `EPERM`/`EBUSY`/`EACCES` renames are retried within the deadline; other errors propagate | F-B4 | — |
| V-21 | A stray temporary file in `.kf/` has no effect | F-B4 | — |
| V-22 | `deadlineMs` is honored (`LOCK_TIMEOUT`, bounded time) | F-B3(vi) | — |
| V-23 | Missing registry is never recreated; `initializeIdRegistry` refusals; fresh registry reads empty | F-C1 | partial (D-01, D-05) |
| V-24 | Unparsable and structurally wrong registries are rejected (`INVALID_YAML` / `INVALID_REGISTRY`), unchanged | F-C2 | — |
| V-25 | Every invalid-event row of F-C3 is `INVALID_REGISTRY` (unknown op, double promote, promote of unallocated, alias self/cycle/dangling, move mismatch, bad id/status/commit/keys) | F-C3, F-R5 | — |
| V-26 | Duplicate provisional allocations replay as a valid collision record; the next ID skips them | F-C4 | — |
| V-27 | Real Git union merge of two appended allocations yields a parseable registry containing both lines | F-C5 | partial (D-05, empty base) |
| V-28 | `allocate` after `promote` (either line order) replays | F-C6 | — |
| V-29 | Non-canonical entities stay provisional; no mutation | F-D1 | — |
| V-30 | Canonical entry via merge commit records `promote {id, path, commit}` and sets `id_status: permanent` | F-D2(a) | — |
| V-31 | The recorded commit is the first first-parent commit carrying the file with that ID, for merge, fast-forward and squash | F-D2 | — |
| V-32 | `canonicalBranch` is explicit: custom name works; missing, empty, non-string, unknown, dash-leading rejected; `main` is never assumed | F-D3 | — |
| V-33 | Promotion is independent of the checked-out branch | F-D4 | — |
| V-34 | First-parent semantics: side-branch commits are not used; earlier commits carrying another ID at the path are ignored; shallow history is refused | F-D5, F-D6 | — |
| V-35 | Repeat promotion is idempotent and the recorded commit is stable as canonical advances | F-D7 | — |
| V-36 | `promote.path` is the entity's path at promotion | F-D8 | — |
| V-37 | Entity rewrite changes only `id`, `id_status`, `id_alias`; other keys, comment, key order and LF preserved; permanent ID never altered | F-D2, F-E1 | — |
| V-38 | Provisional colliders in different canonical commits: later first-parent index renumbered, `alias` event, entity rewritten with `id_alias` | F-E1 | partial (D-02) |
| V-39 | Same-commit tie resolved by ascending UTF-8 byte order of paths, independent of creation order and locale | F-E2 | partial (D-02) |
| V-40 | Three colliders: one survivor, two aliases, distinct fresh IDs | F-E3 | partial (D-02) |
| V-41 | The renumbered entity's new ID is promoted by a later call; alias retained; alias chain recorded oldest first | F-E4 | partial (D-02) |
| V-42 | Provisional vs permanent: `KF-E-101` on the non-matching path only; no renumbering; no event; holder untouched | F-E5 | partial (D-03(c)) |
| V-43 | Two permanent claims on different paths: `KF-E-101` on the non-matching path | F-E6 | — |
| V-44 | Unrecorded move is `KF-E-101`; recorded `move` is clean; a name change is not a collision | F-E7 | — |
| V-45 | `KF-E-101` diagnostic fields exact; near-miss provisional collision is not `KF-E-101`; clean tree gives no diagnostics | F-E5, F-E8 | — |
| V-46 | Interrupted rewrites converge idempotently (entity status and pending renumber), without new events | F-D9, F-E9 | — |
| V-47 | All events of one call land in one atomic registry write | F-D10 | — |
| V-48 | Identical bytes across independent builds, a clone, creation order, injected clock and hostname | F-E10 | — |
| V-49 | A `promote` line and holder path never change once written (invariant sweep over all cases) | F-E11 | — |
| V-50 | Live holder wins; shadowed-alias warning names the alias target and has no code | F-R1 | — |
| V-51 | Alias-only resolution; alias persists across later activity | F-R2 | — |
| V-52 | Alias chain resolution stops at the first live holder | F-R3 | — |
| V-53 | Unresolved/unregistered results; `INVALID_ID` for non-bare addresses | F-R4, F-R5 | partial (D-03(b)) |
| V-55 | `id_alias` accepted as unique `entityId` array in `entityBase`; duplicates, bad IDs, non-arrays rejected; P001 corpus unchanged | F-S1 | — |
| V-56 | `npm run build`, `npm run lint`, `npm test`, `git diff --check` pass; no file outside the write boundaries changed | — | — |
| V-57 | No `bin/`, no `package.json` `bin`, no CLI wiring added | — | — |

(V-09 and V-54 are intentionally unused; numbering is stable for traceability.)

## Risk and ownership

HIGH: permanent identifiers and merge semantics are persisted and cannot be revised without migration. Owners: Foreman (scope, errata, decisions, commits); `kf-conformance-engineer` (fixture and conformance test, first); `kf-implementer` (engine, schema field, unit tests, handoff); auditors read-only. Never an implementer and an auditor on the phase at the same time.

- R-01 Silent permanent-ID reuse after delete/recreate (the failure that blocked the checkpoint): covered by E-0004 plus V-03, V-43, V-44, V-49. Auditors should try to defeat it with moves, case-only renames, and re-creation at the same path.
- R-02 Union merge hazards: duplicated `events:` keys (D-05), byte-identical lines collapsing, line interleaving. Event lines must be self-contained and one per physical line.
- R-03 The stale-lock break can race with a new acquirer (a contender removes a lock another process just acquired). Treated as a defect; needs an explicit test.
- R-04 Directory-named-by-ID layout versus renumbering (N-04 in `TRIAGE.md`). Not a P002 decision; flagged for P007 and `kf create`.
- R-05 Dependence on the real `git` executable (version differences, locale, `core.quotepath`, CRLF conversion via `* text=auto`). The default reader must be insensitive to them; entity rewrites are LF; blobs are compared after YAML parsing.
- R-06 Linear scans of first-parent history per entity are slow on large repositories; no target is authorized, equality with the definition is mandatory (Design constraints).
- R-07 `KF-E-101` is declared once as a local constant until P028 provides the catalog module (N-06).
- Dependencies downstream: P007 (invokes `promoteIds`/`checkIdCollisions`, maps errors to exit codes), P028 (`kf init` calls `initializeIdRegistry`, depends on D-01), P021/P022 (call `resolveId`).

## Exit criteria

1. Every V-nn above is backed by a passing, named test, except assertions explicitly held by a still-open D-nn, which are listed in `HANDOFF.md` with the decision they wait for; none of those may be implemented by guess.
2. The conformance slice was written before the implementer read it, and the conformance engineer's report states the commit it was written at and that no implementer code had been read.
3. `framework/schemas/common.schema.json` has `id_alias` in `entityBase` and the P001 suite still passes unchanged.
4. `TRACEABILITY.md` rows are `PASS` only with executable evidence (test name or case path); remaining rows state their blocking decision.
5. `npm run build`, `npm run lint`, `npm test`, `git diff --check` pass; `git status` shows only paths inside the write boundaries; no `bin/` content.
6. `HANDOFF.md` names the exact product commit. The Foreman decides acceptance after an independent audit (blind pass first); implementer and conformance engineer instances never audit.

## Non-goals

- Address grammar and fragment addresses (E-0006 `OPEN`); query-surface wiring of aliases (`kf show`, `kf context`, `kf impact`, `kf diff`: P021/P022).
- The full `kf validate` catalog and any other diagnostic code; `bin/kf.mjs`, `kf init`, `kf create`, promotion wiring in `kf validate` (P028, P007).
- The `kf update` / `move` writer (a later phase); P002 only replays `move` events if present.
- Cross-file reference rewrite when an entity is renumbered; moving entity files or directories.
- `ids.padding` configuration (l.1938; P007); extended-type prefixes (§4.2).
- Resolution of the canonical branch from `workspace.yaml` or Git (CLI, E-0001).
- Changes to the `acme-formulation` fixture or the `expected/` runner (P028 / P027).
- Entity files whose YAML is unparsable, entities claiming `permanent` without a `promote` event, entities lacking `id_status`, and transient states inside an interrupted rewrite window (not asserted; see `TRIAGE.md` section 3).
