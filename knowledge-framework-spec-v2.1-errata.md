# Knowledge Framework Core Specification v2.1 — Errata and Binding Decisions

Purpose: record decisions on points the frozen specification (`knowledge-framework-spec-v2.1.md`) leaves underspecified, and corrections of record for its textual defects.
- The frozen spec remains normative and is never edited. This document is normative-additional.
- Where an entry decides an underspecified point, the decision is binding for implementation and audit until its status becomes `REJECTED`. An entry never overrides an explicit SHALL / SHALL NOT.
- Status: `DECIDED_BY_FOREMAN` (decided, awaiting human review) · `RATIFIED` (human confirmed) · `REJECTED` (human refused; becomes a remediation task) · `OPEN` (undecided; blocks the listed phases).
- Reversibility: LOW = no persistent-format effect · MEDIUM = affects persisted files but migratable · HIGH = changes persistent identity or format.
- Line numbers refer to `knowledge-framework-spec-v2.1.md` (2234 lines). Spec quotes are verbatim (Spanish); English is an aid.
- Lifecycle of a gap: `.strike-team/spec-gaps/SG-xxxx.md` (discovery) → entry here (decision) → implementation and audit cite the E-xxxx ID.

## Summary

| ID | Title | Status | Reversibility | Affects phases |
|---|---|---|---|---|
| E-0001 | Canonical branch of the Knowledge Repository (resolves SG-0005) | DECIDED_BY_FOREMAN | LOW | P002, P007, P016 |
| E-0002 | Tie-break for colliding provisional IDs entering canonical together (SG-0003 a) | DECIDED_BY_FOREMAN | LOW | P002, P007 |
| E-0003 | Alias resolution when the old ID stays live (SG-0003 b) | DECIDED_BY_FOREMAN | MEDIUM | P002, P007, P021, P022 |
| E-0004 | Identity continuity for permanent IDs (SG-0004) | DECIDED_BY_FOREMAN | MEDIUM | P002, P007 |
| E-0005 | Scenario minimum for narrative specified facets (SG-0001) | DECIDED_BY_FOREMAN | LOW | P007, P014 |
| E-0006 | Address grammar for observed targets and scope values (SG-0002) | OPEN | HIGH | P007, P014, P016, P017, P020–P022, P024 |
| E-0007 | `.kf/id-registry.yaml` versioning and merge policy | DECIDED_BY_FOREMAN | MEDIUM | P002, P028 |
| E-0008 | Corrections of record (spec text defects) | (a) record-only; (b)–(e) DECIDED_BY_FOREMAN | LOW | all |
| E-0009 | Derivation of `first_canonical_commit` and "later" ordering | DECIDED_BY_FOREMAN | MEDIUM | P002, P007, P016 |
| E-0010 | Provisional-vs-permanent collision outcome and diagnostic subject | DECIDED_BY_FOREMAN | LOW | P002, P007 |
| E-0011 | Entity identity fields after promotion and renumbering (`id_status`, `id_alias`) | DECIDED_BY_FOREMAN | MEDIUM | P002, P007 |
| E-0012 | Registry line format, event kinds, and replay after union merge (refines E-0007) | DECIDED_BY_FOREMAN | MEDIUM | P002, P007, P028 |
| E-0013 | Registry lock: stale detection and recovery | DECIDED_BY_FOREMAN | LOW | P002 |
| E-0014 | ID-registry failures without a §42.2 code; P002 surface is engine API only | DECIDED_BY_FOREMAN | LOW | P002, P007, P028 |
| E-0015 | ID-registry operational details (init on existing `.kf/`, renumber order, unregistered/ambiguous, owner-less lock, empty registry form) | DECIDED_BY_FOREMAN | MEDIUM | P002, P007, P028 |

---

## E-0001 — Canonical branch of the Knowledge Repository

**Clauses**
- l.316: "Al entrar al branch canónico, `kf validate` lo promueve a `permanent`."
- l.1112: "en el canonical_branch del Knowledge Repository"
- l.119: "knowledge: {path: ./formulation-knowledge}"; `canonical_branch: main` appears only under `repositories[]` (l.126, l.131, §3.2).

**Question.** Where is the Knowledge Repository's canonical branch configured or discovered? (SG-0005)

**Options considered**
1. `knowledge.canonical_branch` in `workspace.yaml`.
2. A setting in `kf.yaml` / `knowledge.config.yaml` (§50 has none; not co-located with the `repositories[]` branches).
3. Pure Git discovery with a failure rule.
4. Hardcode `main` (rejected: promotes on the wrong branch irreversibly).

**Decision.** `workspace.yaml` gains an optional `knowledge.canonical_branch` string, symmetric with `repositories[].canonical_branch` (§3.2). Resolution order, performed only by the CLI:
1. `knowledge.canonical_branch`, if present.
2. Otherwise the remote default branch from `git symbolic-ref refs/remotes/origin/HEAD`.
3. If still undeterminable, the command fails with a configuration error, exit code `3` ("error de uso", §36.1, l.1604), and never assumes `main`.

Engine APIs take the branch as an explicit parameter and never resolve it themselves.

**Rationale.** Option 1 mirrors an existing key and is explicit and reviewable; discovery is a fallback for projects that omit it; failing closed prevents premature, irreversible permanent promotion.

**Reversibility.** LOW — optional key, no persisted identity depends on it.
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-09 by Foreman (consulting session)
**Ratified**: pending
**Affects.** P002 (explicit engine parameter), P007 (`kf validate` resolution), P016 (transaction time, §19.1), P028 (CLI plumbing).

---

## E-0002 — Tie-break for colliding provisional IDs entering canonical in the same commit

**Clauses**
- l.317: "**Colisión al hacer merge:** solo es resoluble si **ambos** IDs en conflicto son `provisional`. El engine renumera el de `first_canonical_commit` posterior y registra `id_alias`."

**Question.** Two provisional records with one ID enter canonical in one (merge/squash) commit; both have the same `first_canonical_commit`. Which keeps the ID?

**Options considered**
1. Ascending byte order of repo-relative file paths.
2. Reject for manual resolution.
3. Pre-assign distinct IDs before canonical entry.

**Decision.** Option 1: order the colliding records by ascending byte order of their repo-relative file paths (UTF-8 bytes, no Unicode normalization, `/` separators). The first keeps the ID; the others are renumbered, as §8.2 already prescribes for a later `first_canonical_commit`, each recording an `id_alias`.

**Rationale.** Derivable from the commit alone: no clock, no randomness, identical result on every clone. Provisional IDs are unstable by definition, so an arbitrary winner costs nothing persistent.

**Reversibility.** LOW.
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-09 by Foreman (consulting session)
**Ratified**: pending
**Affects.** P002, P007.

---

## E-0003 — Alias resolution when the old ID stays live on a surviving entity

**Clauses**
- l.317: "El engine renumera el de `first_canonical_commit` posterior y registra `id_alias`."
- l.319: "`id_alias` **SHALL** resolverse en todas las queries, indefinidamente."
- l.554: "BR-0037                              la entidad" (§10.7 unqualified address).

**Question.** After renumbering, the old ID is still held by the survivor. An unqualified query of that ID cannot both return the survivor and follow the alias.

**Options considered**
1. Live holder wins; alias used only when the ID is unheld.
2. Source-qualified alias syntax (new address grammar).
3. Reject for manual resolution.

**Decision.** Option 1. An unqualified address always resolves to the entity that currently holds the ID. `id_alias` on the renumbered entity, plus an `alias` event in the registry recording `from`, `to` and the canonical commit, is used for resolution only when the aliased ID is held by no live entity. When both exist, queries return the live holder and emit a warning naming the alias target (diagnostic code OPEN until P007; message-only before that). No new address syntax is introduced. The alias is retained indefinitely, so l.319 holds wherever resolution is unambiguous.

**Rationale.** Preserves the meaning of existing IDs (no silent re-routing) and adds no grammar; the alias stays discoverable via warning and registry.

**Reversibility.** MEDIUM (alias events are persisted).
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-09 by Foreman (consulting session)
**Ratified**: pending
**Affects.** P002 (registry `alias` event), P007 (diagnostic code), P021/P022 (query behavior).

---

## E-0004 — Identity continuity for permanent IDs

**Clauses**
- l.300: "Únicos, no reutilizables, independientes del nombre."
- l.318: "**Un ID `permanent` SHALL NOT ser renumerado jamás.** Colisión con un `permanent` → `KF-E-101`, resolución manual obligatoria."
- l.1742: "| `KF-E-101` | E | Colisión de ID con un ID `permanent` | resolución manual |"
- l.371: "| Operacional | `.kf/` | Append-only, escrito solo por comandos |"

**Question.** How does the system prove a later entity carrying a permanent ID is the original entity rather than reuse after delete/recreate? (SG-0004)

**Options considered**
1. Immutable incarnation token in each entity (changes the core schemas and every entity file).
2. Git-history continuity.
3. Engine-managed ownership record plus manual review.

**Decision.** Option 3, with no incarnation token. The registry is the sole allocator and is append-only; it never reissues any recorded ID. A `promote` event records the repo-relative path of the entity file at promotion. A different file carrying a permanent ID recorded for another path is `KF-E-101` (permanent collision, manual resolution), checked by `kf validate` from P007 and by the P002 engine's promotion/collision check before that. A move or rename of an entity directory must be recorded by an engine command as a `move` event (command assigned in the phase that implements `kf update`); until then an unrecorded move is treated as a collision.

**Rationale.** Uses only what the spec already mandates (engine registry l.304, append-only `.kf/` l.371, `KF-E-101`); fails closed; avoids a schema change to every entity.

**Reversibility.** MEDIUM (registry event format persisted; a token can be added later).
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-09 by Foreman (consulting session)
**Ratified**: pending
**Affects.** P002, P007, and the phase implementing `kf update`.

---

## E-0005 — Scenario minimum for narrative specified facets

**Clauses**
- l.292: "- **R3.** Toda faceta specified en `status: active` **SHALL** tener ≥ `governance.min_scenarios_per_rule` escenarios con `asserts.facet: specified` que la ejerciten."
- l.1348: "- `governance.min_scenarios_per_rule` (default 2) aplica a **facetas specified evaluables**."
- l.1367: "`verification.mode` es obligatorio en reglas narrativas (`KF-E-330`)." (§26.3, heading l.1352)

**Question.** Must an active narrative specified facet meet the scenario count? (SG-0001)

**Options considered**
1. Count applies to every active specified facet.
2. Count applies only to evaluable ones; narrative facets follow §26.3.

**Decision.** Option 2. §26.2 restricts §7.3 R3: the `min_scenarios_per_rule` requirement applies only to evaluable specified facets; narrative facets follow §26.3 (mandatory `verification.mode`, no automatic confidence from scenarios). Specific-over-general reading; §26.3 states that demanding N scenarios of a rule the engine cannot evaluate is false rigor.

**Rationale.** The specific clause (§26.2/§26.3) is a deliberate v2.1 correction (§0.4 #18, l.64) that supersedes the earlier general R3.

**Reversibility.** LOW (a validation rule only).
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-09 by Foreman (consulting session)
**Ratified**: pending
**Affects.** P007, P014.

---

## E-0006 — Address grammar for observed targets and scope values

**Clauses**
- l.542: "**Faceta observed** — clave `target`, mapa abierto:" and l.549: "Dos facetas observed **SHALL NOT** tener el mismo `target` → `KF-E-212`."
- l.535–536: `specified_key = canonical(scope) ‖ "@" ‖ …`; "canonical(scope) = pares clave=valor ordenados lexicográficamente," (no escaping or character domain defined).
- l.1951: "observed_target_dimensions: [repository, environment]"
- l.558–561 (§10.7): `BR-0037#observed:legacy-app`, `BR-0037#observed:legacy-app/production`, `DE-0017#observed:legacy-app.concentration`.

**Question.** How are observed targets with extra or different dimensions, and scope values containing delimiters (`; = ] . /`, whitespace, non-ASCII), addressed unambiguously? Full analysis: `.strike-team/spec-gaps/SG-0002.md`.

**Options considered**
1. Restrict repo/environment ids and scope keys/values to a character class excluding the grammar delimiters; make `target.repository` mandatory in observed targets; additional dimensions non-addressable until a grammar extension.
2. Keep the open domain; define an escaping/quoting rule and a `[k=v;…]` selector after `observed`.
3. Keep the grammar; address non-expressible targets by a derived canonical key form (as `facets[].key`, §40).

**Foreman recommendation.** Option 1: most deterministic, closest to the frozen examples, and easiest to relax later (a restriction can be loosened without invalidating existing keys; the reverse cannot).

**Decision.** None yet. MUST be decided before the P007 PLAN is approved.

**Reversibility.** HIGH (defines persisted `specified_key` / `observed_key` / `div_key`).
**Status.** OPEN
**Decided**: —
**Ratified**: pending
**Affects.** P007, P014, P016, P017, P020, P021, P022, P024.

---

## E-0007 — `.kf/id-registry.yaml` versioning and merge policy

**Clauses**
- l.304: "El engine los asigna desde `.kf/id-registry.yaml` con lock transaccional."
- l.371: "| Operacional | `.kf/` | Append-only, escrito solo por comandos |"

**Question.** Is the registry committed to Git, and how does it merge across clones and branches?

**Options considered.** Gitignore the registry (loses non-reuse across clones; rejected); default text merge (conflict markers corrupt the log; rejected); union merge (chosen).

**Decision.** The registry is committed to Git: it is the cross-clone source of truth for IDs (§9.1 classifies `.kf/` as operational, command-written, append-only). `.gitattributes` assigns it `merge=union`; lock directories (`.kf/*.lock`) are gitignored. Because registry replay rejects duplicate allocations, a union merge surfaces collisions deterministically instead of hiding them. (The `.gitattributes` / `.gitignore` edits are made by another agent; this entry records the decision only.)

**Reversibility.** MEDIUM.
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-09 by Foreman (consulting session)
**Ratified**: pending
**Affects.** P002, P028.

---

## E-0008 — Corrections of record

No semantic decision is made except where stated. Each item records a defect in the frozen text and which reading is binding. All line numbers were verified against the 2234-line spec.

**(a) Cross-reference numbering drift — record-only.** Section references in the spec text are stale; the heading number is binding.

| Where | Says | Real section (heading line) |
|---|---|---|
| §0.4 #8 (l.54); §36 (l.1600) | "§44.2" (catalog) | §42.2 (l.1734) |
| §0.4 #3 (l.49) | "§14.3" | §17.3 Computed vs. override (l.966) |
| §0.4 #18 (l.64); §12.4 (l.698) | "§25.4" | §26.3 (l.1352) |
| §0.4 #10 (l.56); P14 (l.98) | "§22.2" | §25 (l.1297) |
| §23.1 (l.1201) | "§26.2" | §25 (l.1297) |
| §0.2 (l.29); §21 (l.1143); §0.4 #12 (l.58) | "§23" (releases) | §41 (l.1712) |
| §0.4 #7 (l.53); §10.8 (l.570) | "§17" (transaction time) | §19 / §19.1 (l.1100, l.1108) |
| §0.2 (l.32) | "§13.4" (`hint_lines`) | §16.3 / §16.5 (l.812, l.876) |
| §7.1 footnote (l.275) | "§10.4" (BP edges) | §10.5 (l.507) |
| §0.4 #16 (l.62) | "§28.2" (ack) | §29.2 (l.1443) |
| §9.1 (l.367) | "§19.3" (DIV ownership) | §23.3 (l.1217) |
| §0.4 #4 (l.50) | "§13.2, §14.2" | §16.1, §17.1 (l.792, l.921) |
| §0.4 #5 (l.51) | "§14.1" | §15 (l.772) |
| §0.4 #9 (l.55) | "§10.5–§10.8" (grammars) | §11–§12 (l.576, l.614) |
| §0.4 #14 (l.60) | "§13.5" | §16.4 (l.843) |
| §0.4 #17 (l.63) | "§41.2" | §38.2 (l.1647) |
| §0.4 #19 (l.65) | "§18.3" | §20 (l.1125) |

**(b) Katas count.** l.2032: "6. **Los 15 katas**, validando en CI." but Appendix G (l.2199: "Los 15 de v2.0, más tres obligatorios de faceting:") lists 18 items. **18 is binding.**

**(c) Core types with facets.** l.2025: "1. JSON Schemas de los 11 tipos core **con facetas**". Of the 11 core types (§4.1, table l.149–163) only `BP`, `BR`, `DE` are faceted. Binding reading: 11 core types, schemas for all 11, facet schemas for BP/BR/DE.

**(d) BR-0037 example.** The example (id at l.423) has `exhaustive: true` (l.445) with a `quantity` input (l.447) and no `when: default` row (rules l.449–455). It is illustrative only. Binding: l.634 "**`exhaustive: true` SHALL exigir una fila `when: default`**" and `KF-E-311` (l.1766).

**(e) KF-E-211.** l.413: "Un agente que intente escribir una faceta observed desde un workflow de cambio → `KF-E-210`. Y al revés → `KF-E-211`." defines 211 as the discovery/evidence side writing a specified facet; the catalog (l.1760) defines it as "`CHG` apuntando a faceta observed" (also l.1178). **The catalog is binding** for `KF-E-211`. The l.413 case has no code: **OPEN for P007** (a new code must be assigned by an errata decision before the P007 PLAN is approved).

**Reversibility.** LOW.
**Status.** (a) record-only; (b)–(d) DECIDED_BY_FOREMAN; (e) DECIDED_BY_FOREMAN for the catalog reading, new code OPEN.
**Decided**: 2026-10-09 by Foreman (consulting session)
**Ratified**: pending
**Affects.** All phases; (e) P007.

---

## E-0009 — Derivation of `first_canonical_commit` and "later" ordering

**Clauses**
- l.316: "Al entrar al branch canónico, `kf validate` lo promueve a `permanent`."
- l.317: "El engine renumera el de `first_canonical_commit` posterior y registra `id_alias`."
- l.1110-1111: "transaction_time(X) = timestamp del primer commit que contiene X / en el canonical_branch del Knowledge Repository"
- l.1117: "Esto **no** prohíbe squash merge: un feature branch puede entrar a `main` como un solo commit, y el transaction time empieza ahí."

**Question.** `first_canonical_commit` is named only at l.317. What commit is it, how is it found, and what makes one "posterior" to another? (P002 triage T-01)

**Options considered**
1. Earliest commit in the first-parent history of the canonical branch whose tree contains the entity file (at its repo-relative path) carrying that `id`; "posterior" = larger first-parent index.
2. Committer timestamp of that commit (literal reading of l.1111 for ordering).
3. The canonical HEAD at which `kf validate` first observes the entity.

**Decision.** Option 1. The engine receives the canonical branch name explicitly (E-0001) and an injected Git history reader. `first_canonical_commit(entity)` is the full SHA of the earliest commit in `git rev-list --first-parent --reverse <canonical_branch>` whose tree contains the entity's file with that `id`. Ordering between two entities is by first-parent index only, never by timestamp; equal index (same commit) falls to E-0002. The SHA is persisted only in registry events (E-0012), never in the entity file (l.570 forbids Git-derivable time fields in YAML; by the same reasoning the commit is not duplicated there). Option 2 is rejected (clock skew; non-deterministic for identity). Option 3 cannot order two entries that landed in different earlier commits.

**Rationale.** Deterministic on every clone; first-parent history is exactly "what entered the canonical branch, in order", including squash merges (l.1117); l.1115 forbids rewriting that history, so the index is stable. l.1111 still defines transaction *time* for P016; this entry fixes only the commit identity and order used for IDs.

**Reversibility.** MEDIUM (SHA persisted in registry events; recomputable from Git).
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P002 triage)
**Ratified**: pending
**Affects.** P002, P007, P016.

---

## E-0010 — Provisional-vs-permanent collision outcome and diagnostic subject

**Clauses**
- l.317: "**Colisión al hacer merge:** solo es resoluble si **ambos** IDs en conflicto son `provisional`."
- l.318: "**Un ID `permanent` SHALL NOT ser renumerado jamás.** Colisión con un `permanent` → `KF-E-101`, resolución manual obligatoria."
- l.1742: "| `KF-E-101` | E | Colisión de ID con un ID `permanent` | resolución manual |"

**Question.** When a provisional entity collides with an ID that is already permanent (for example, a branch merged after the other holder was promoted), what happens and which file is the diagnostic subject? (T-02)

**Options considered**
1. `KF-E-101` reported on each file that does not match the registry's `promote` record for that ID; the permanent holder is untouched; no automatic renumbering.
2. `KF-E-101` reported on both files.
3. Auto-renumber the provisional newcomer.

**Decision.** Option 1. Literal reading of l.317-318: automatic renumbering only when every holder is provisional; any collision involving a permanent ID is `KF-E-101` with manual resolution. Subject of the diagnostic: every file carrying the ID whose repo-relative path differs from the path in the `promote` event (E-0004). Two permanent claims on different paths follow the same rule. Option 3 is rejected: l.317 says "solo es resoluble si ambos ... son provisional".

**Rationale.** Most literal and most conservative (fail loudly over silent auto-resolution); the permanent holder is never disturbed.

**Reversibility.** LOW (diagnostic targeting only).
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P002 triage)
**Ratified**: pending
**Affects.** P002, P007.

---

## E-0011 — Entity identity fields after promotion and renumbering

**Clauses**
- l.310-312: "# en la entidad, hasta el merge / id_status: provisional | permanent"
- l.316: "Al entrar al branch canónico, `kf validate` lo promueve a `permanent`."
- l.317: "registra `id_alias`"; l.319: "`id_alias` **SHALL** resolverse en todas las queries, indefinidamente."
- l.371: "| Operacional | `.kf/` | Append-only, escrito solo por comandos |"

**Question.** After promotion, does `id_status` remain in the entity? What shape does `id_alias` have and where does it live? Who rewrites the entity? (T-03)

**Options considered**
1. `id_status` stays in the entity as `permanent`; the renumbered entity carries `id_alias: [<old-ID>, ...]` (list of entity-ID strings); the registry is authoritative and the entity fields are a projection rewritten by the promoting operation.
2. `id_alias` as objects `{from, commit}` in the entity.
3. Remove `id_status` from the entity after promotion (literal "hasta el merge").

**Decision.** Option 1. The promotion/renumbering engine operation (invoked by `kf validate` from P007) appends registry events first, then rewrites the affected entity files (`id`, `id_status`, `id_alias`) atomically per file. The registry is authoritative: if an entity's `id_status`/`id_alias` disagree with the registry, re-running the operation converges them idempotently; it never changes a permanent ID. `id_alias` is added to the common `entityBase` schema as an array of unique `entityId` strings. Commits are not stored in the entity (E-0009).

**Rationale.** l.316 says promotion sets `permanent`, which needs a persisted value; a plain string list is the minimum that satisfies l.317/l.319 and keeps entity churn low; the commit lives once, in the registry.

**Reversibility.** MEDIUM (schema field and persisted entity values; migratable).
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P002 triage)
**Ratified**: pending
**Affects.** P002 (schema + engine), P007 (`kf validate` invocation).

---

## E-0012 — Registry line format, event kinds, and replay after union merge

**Clauses**
- l.304: "El engine los asigna desde `.kf/id-registry.yaml` con lock transaccional."
- l.371: "| Operacional | `.kf/` | Append-only, escrito solo por comandos |"
- l.317 (provisional collisions are resolvable); E-0003, E-0004, E-0007, E-0009.

**Question.** The spec defines no registry format. Which events exist, how are they serialized so a Git union merge (E-0007) cannot split or silently merge them, and how does replay treat duplicates? (T-04)

**Options considered**
1. One event per physical line as a YAML flow mapping under `events:`; replay in file order; duplicate provisional allocations are a recorded collision, not corruption.
2. Block-style multi-line events (union merge can interleave lines of two events).
3. Per-event sequence numbers or hashes (sequence numbers collide under union merge).

**Decision.** Option 1.
- File: `schema_version: 2.1`, then `events:` with one `- {op: ..., ...}` flow mapping per line. No timestamps, no actor fields.
- Events: `allocate {id, id_status: provisional, path}` (`path` = repo-relative entity file path known at creation; it makes concurrent allocations of the same ID on different branches distinct lines so union merge keeps both); `promote {id, path, commit}`; `alias {from, to, commit}` (the renumbered entity's new ID `to` also has its own `allocate`); `move {id, from, to}` (E-0004; writer assigned with `kf update`). Unknown `op` → registry invalid (fail closed).
- Replay: the allocation counter per prefix is the maximum numeric suffix over all recorded IDs + 1, so no ID is ever reissued. Two or more `allocate` events for one ID with no `promote` are a provisional collision, resolved at promotion (§8.2, E-0002). A second `promote` for one ID, a `promote` for an unallocated ID, or any sequence that would move a permanent ID to another holder makes the registry invalid.
- Collision detection does not rely on registry lines alone: the promotion operation also scans entity files, because union merge collapses byte-identical lines.
- This refines E-0007's sentence "registry replay rejects duplicate allocations": duplicate *provisional* allocations are tolerated as collision records. E-0007's commit, merge=union and lock-ignore decisions stand. No permanent ID has been recorded by any released version, so the P002 checkpoint format may be replaced without migration.

**Rationale.** Line-atomic events are the only form that survives a union merge intact; tolerating duplicate provisional allocations is required by l.317, which makes provisional collisions resolvable rather than fatal.

**Reversibility.** MEDIUM (persisted format).
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P002 triage)
**Ratified**: pending
**Affects.** P002, P007, P028 (`kf init` creates the empty registry).

---

## E-0013 — Registry lock: stale detection and recovery

**Clauses**
- l.304: "con lock transaccional"; E-0007: lock directories `.kf/*.lock` are gitignored.
- l.1604: "`5` recurso no disponible".

**Question.** When is a held lock stale, and how is it broken safely? (T-05)

**Options considered**
1. The lock directory holds an owner file `{pid, host, acquired_at}`; stale iff older than an injectable threshold (default 60 s) AND same host AND pid not alive; break by renaming the lock directory to a unique name (single winner), then retry. A lock owned by another host is never auto-broken. Waiting is bounded by an injectable deadline; timeout → "resource unavailable" (exit 5 when surfaced by the CLI). Windows `EPERM`/`EBUSY`/`EACCES` on rename are retried within the deadline.
2. Threshold-only staleness (may break a live slow holder).

**Decision.** Option 1. `acquired_at` is wall-clock but operational only; it never influences an ID.

**Reversibility.** LOW (lock files are untracked).
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P002 triage)
**Ratified**: pending
**Affects.** P002.

---

## E-0014 — ID-registry failures without a §42.2 code; P002 surface is engine API only

**Clauses**
- l.1742: `KF-E-101` is the only identifier code in the catalog.
- l.1600: "Los diagnostics **SHALL** generarse desde el catálogo de §44.2, no escribirse a mano." (catalog is §42.2 per E-0008(a))
- l.315-316: "En un branch no canónico, `kf create` asigna un ID y lo marca `provisional`." / "Al entrar al branch canónico, `kf validate` lo promueve a `permanent`."
- l.1604: "`3` error de uso · `4` error interno · `5` recurso no disponible."

**Question.** Which diagnostics and exit codes do registry failures use when the catalog has no code (missing or corrupt registry, lock timeout, unresolvable canonical branch, shadowed alias), and does P002 ship CLI commands while the CLI backbone (P028) and full `kf validate` (P007) are separate phases? (T-06, T-07, T-08)

**Options considered**
1. No new `KF-` codes. The engine raises typed errors with internal codes (not `KF-`); the CLI layer maps them: missing registry or lock unavailable → exit 5; corrupt registry → exit 4; unresolvable canonical branch → exit 3 (E-0001). Shadowed alias (E-0003) is a message-only warning without a code. `KF-E-101` is used only for permanent collisions (E-0010). P002 delivers engine APIs only (allocate, promote/renumber, collision check, resolve); wiring `kf create` and promotion inside `kf validate` into `bin/kf.mjs` is assigned to P007, which depends on P002 and P028.
2. Assign new `KF-E-1xx` codes now.
3. P002 creates its own `bin/kf.mjs` (conflicts with P028 ownership).

**Decision.** Option 1. A missing registry is never auto-recreated from an entity scan (that would allow reuse).

**Rationale.** The catalog is frozen and closed; the existing engine already uses internal error codes; keeping CLI wiring in one phase avoids two owners of `bin/`.

**Reversibility.** LOW.
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P002 triage)
**Ratified**: pending
**Affects.** P002, P007, P028.

---

## E-0015 — ID-registry operational details left open by E-0002, E-0003, E-0012, E-0013

**Clauses**
- l.300: "Únicos, no reutilizables, independientes del nombre."
- l.304: "Los agentes **SHALL NOT** asignar IDs. El engine los asigna desde `.kf/id-registry.yaml` con lock transaccional."
- l.317: "El engine renumera el de `first_canonical_commit` posterior y registra `id_alias`."
- l.318: "Colisión con un `permanent` → `KF-E-101`, resolución manual obligatoria."

**Question.** Five details the P002 planner found undetermined (P002 `TRIAGE.md` D-01..D-05): registry initialization when `.kf/` already exists; persisted values and order of renumbering; behavior on unregistered IDs, ambiguous resolution, and `KF-E-101` during promotion; owner-less locks; the empty-registry byte form under union merge.

**Decision.**
- (D-01) `initializeIdRegistry` succeeds when `.kf/` exists but contains no registry file and no registry lock, and no entity file in the project carries an ID; otherwise it refuses. (`kf init`, P028, may create `.kf/` first.)
- (D-02a) `alias.commit` is the renumbered entity's own `first_canonical_commit` (E-0009). (D-02b) With two or more losers for one ID, fresh IDs are assigned in the E-0002/E-0009 total order (first-parent index ascending, then repo-relative path in ascending UTF-8 byte order), lowest new number first. (D-02c) Events appended by one promotion call: `promote` events first in ascending byte order of ID, then for each loser in (D-02b) order an `allocate` of the new ID followed by its `alias`.
- (D-03a) An entity file carrying an ID that appears in no registry event is unregistered (it violates l.304): `allocateId` and `promoteIds` fail closed with internal code `UNREGISTERED_ID` and mutate nothing; `checkIdCollisions` reports it in a separate `unregistered` list. Rationale: an unregistered ID can later be reissued by the counter, which l.300 forbids.
- (D-03b) When `resolveId` cannot name one answer (several live provisional holders of one ID, or an unheld ID aliased to several targets), it returns `status: 'ambiguous'` with the candidates sorted; it never picks one (E-0003 forbids silent re-routing).
- (D-03c) When `promoteIds` meets a `KF-E-101` collision, it writes nothing for that ID, rewrites no colliding file, leaves the permanent holder untouched, returns the `KF-E-101` diagnostics in its result, and processes every other ID normally. Collisions are local to one ID; blocking unrelated promotions adds no safety.
- (D-04) A lock directory without a readable owner file is never auto-broken; acquisition times out with `LOCK_TIMEOUT` naming the lock path for manual removal. The implementation should make the owner-less window as small as practicable.
- (D-05) The empty registry is written as `schema_version: 2.1` followed by a bare `events:` line (no `[]`); readers treat a null `events` as empty and also accept `events: []`. This makes "two branches each append their first event" a pure line-append on both sides, which a union merge (E-0007) combines without a duplicate key.

**Rationale.** Each choice is the most literal or most conservative available (fail closed on unregistered IDs and owner-less locks; no silent pick on ambiguity) and is fully determined by data present on every clone.

**Reversibility.** MEDIUM for D-02 and D-05 (persisted bytes and values); LOW for the rest.
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P002 planning)
**Ratified**: pending
**Affects.** P002, P007, P028.
