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
| E-0016 | Shape of ambiguous `resolveId` results; scope of the `id_alias` projection | DECIDED_BY_FOREMAN | LOW | P002, P021, P022 |
| E-0017 | Decimal representation and lexical form | DECIDED_BY_FOREMAN | MEDIUM | P011, P012, P014 |
| E-0018 | Unit registry input and unknown units | DECIDED_BY_FOREMAN | LOW | P011, P012, P007 |
| E-0019 | Decision-table matching semantics: binding, types, units, nulls, enums | DECIDED_BY_FOREMAN | MEDIUM | P011, P012, P014 |
| E-0020 | Hit policies, `default`, overlap proof, exhaustiveness proof | DECIDED_BY_FOREMAN | LOW | P011, P014 |
| E-0021 | RE2 dialect in a Node engine; outputs and uncatalogued failures | DECIDED_BY_FOREMAN | LOW | P011, P012, P013, P014 |
| E-0022 | Decision-table details from P011 planning (amends E-0019 on `when: {}`) | DECIDED_BY_FOREMAN | LOW | P011, P012, P014 |
| E-0023 | P002 implementation details: cross-ID renumber order, ambiguous result fields, stale-lock break | DECIDED_BY_FOREMAN | MEDIUM | P002 |
| E-0024 | Registry replay after real merges; alias projection across moves; canonical ref resolution (amends E-0012, E-0016) | DECIDED_BY_FOREMAN | MEDIUM | P002, P007 |
| E-0025 | Absent inputs in the static proofs; "bare scalar" in the unit rule (amends E-0020, clarifies E-0019) | DECIDED_BY_FOREMAN | LOW | P011, P014 |
| E-0026 | Literal `null` operands in `ne`, `in`, `not_in`; regex program size counts the final match | DECIDED_BY_FOREMAN | LOW | P011, P014 |
| E-0027 | P011 remediation readings: instruction counting, exact-ref ambiguity, single `KF-E-310` | DECIDED_BY_FOREMAN | LOW | P011 |
| E-0028 | P002 remediation readings: alias anchor, conflicting alias repeats, lock owner fields, PLAN wording | DECIDED_BY_FOREMAN | LOW | P002 |
| E-0029 | Promotion runs only at the canonical tip | DECIDED_BY_FOREMAN | LOW | P002, P007 |
| E-0030 | Formula unit algebra and dimensionless values | DECIDED_BY_FOREMAN | MEDIUM | P012, P014 |
| E-0031 | Formula refs, guards, `if`, and nulls | DECIDED_BY_FOREMAN | LOW | P012, P014, P007 |
| E-0032 | Division, rounding, and the `KF-E-313` protection proof | DECIDED_BY_FOREMAN | LOW | P012, P014 |
| E-0033 | Formula operator arity and diagnostics inventory | DECIDED_BY_FOREMAN | LOW | P012 |
| E-0034 | Permanent-renumber invalidity is judged at the alias's replay position (amends E-0024 (2)) | DECIDED_BY_FOREMAN | LOW | P002 |
| E-0035 | P002 R02 remediation readings: later promote at the anchor, tip check with injected readers, skipped entities | DECIDED_BY_FOREMAN | LOW | P002, P007 |
| E-0036 | P012 planning details: `KF-E-316` cascade, protection criterion, significant digits | DECIDED_BY_FOREMAN | LOW | P012, P014 |
| E-0037 | P012 conformance readings: nested protecting guards; identity among known units | DECIDED_BY_FOREMAN | LOW | P012 |
| E-0038 | Formula evaluation order with nulls; depth counting | DECIDED_BY_FOREMAN | LOW | P012 |
| E-0039 | State-machine checks and evaluation | DECIDED_BY_FOREMAN | MEDIUM | P013, P014, P007 |
| E-0040 | Narrative logic checks and notice | DECIDED_BY_FOREMAN | LOW | P013, P014, P021, P007 |

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

---

## E-0016 — Shape of ambiguous `resolveId` results; scope of the `id_alias` projection

**Clauses**
- l.317: "El engine renumera el de `first_canonical_commit` posterior y registra `id_alias`."
- l.319: "`id_alias` **SHALL** resolverse en todas las queries, indefinidamente."
- E-0003 (live holder wins; no silent re-routing); E-0011 (`id_alias` on the renumbered entity); E-0015 D-03(b).

**Question.** (1) What is the shape of `candidates` when `resolveId` returns `status: 'ambiguous'`? (2) When an entity other than the renumbered one later holds the alias target ID, does it also receive `id_alias`? (P002 conformance DECISION_NEEDED 1 and 2)

**Options considered**
1. (1a) strings (IDs or paths depending on the case); (1b) objects `{id, path}` in both cases.
2. (2a) project `id_alias` only onto the entity that the alias renumbered (the file at the path of the `allocate` event of the alias's `to` ID written by the same renumbering); (2b) onto any holder of the target ID.

**Decision.** (1b): `candidates` is a list of `{id, path}` objects, sorted by `id` then `path` in ascending UTF-8 byte order. (2a): `id_alias` is projected only onto the renumbered entity; any other holder of the target ID gets no `id_alias` from that alias. E-0011 places `id_alias` "on the renumbered entity"; projecting it elsewhere would attach an alias to an entity that never carried the old ID.

**Reversibility.** LOW (API shape; entity projection is re-derivable from the registry).
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P002 conformance)
**Ratified**: pending
**Affects.** P002, P021, P022.

---

## E-0017 — Decimal representation and lexical form

**Clauses**
- l.582: "Todo valor numérico de negocio **SHALL** evaluarse como **decimal de precisión arbitraria**. Coma flotante binaria **SHALL NOT** usarse en la evaluación de reglas."
- l.583: "En YAML, los decimales **SHALL** escribirse como string entrecomillado (`"4.2"`) para evitar que el parser los convierta a float."
- l.1955: "decimal_precision: 28"

**Question.** Arbitrary precision (l.582) versus a configured `decimal_precision: 28` (l.1955); value equality of `"4.20"` and `"4.2"`; accepted lexical form; treatment of unquoted YAML numbers. (P011 triage T-01)

**Options considered**
1. Exact decimal `{unscaled: BigInt, scale}`; exact comparison, addition, subtraction, multiplication; `decimal_precision` applies only to operations that cannot be exact (division, P012); equality and ordering by numeric value; lexical form exactly `^-?[0-9]+(\.[0-9]+)?$` (the P001 `quantity.value` pattern); a YAML number where a decimal is required is rejected.
2. Round every value to 28 significant digits on load.

**Decision.** Option 1. `"4.20"` equals `"4.2"`; `"-0"` equals `"0"`. A non-string (YAML number) supplied where a decimal operand is required is a typed engine error `INVALID_DECIMAL` (internal code, E-0014 precedent), as is any string outside the pattern (`"4,2"`, `".5"`, `"1e3"`, `"+1"`). The precision is an explicit parameter of the inexact operations, never global state.

**Rationale.** Literal reading of l.582 for every exact operation; l.583 makes quoted strings the only valid encoding, so rejecting numbers fails loudly instead of silently trusting a float parse; l.1955 keeps a meaning where precision is genuinely needed.

**Reversibility.** MEDIUM (module API is the base of P012; no persisted format).
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P011 triage)
**Ratified**: pending
**Affects.** P011, P012, P014.

---

## E-0018 — Unit registry input and unknown units

**Clauses**
- l.589: "Unidad declarada distinta de unidad recibida es ERROR (`KF-E-310`)."
- l.591: "`percent` a secas **SHALL NOT** ser una unidad válida en un dominio donde exista ambigüedad masa/volumen: el framework distribuye `percent_mass`, `percent_volume`, `percent_mass_per_volume` y **SHALL NOT** tratarlas como intercambiables."
- l.593-598: "Las unidades se declaran en `extensions/<domain>/units.yaml`:" with `units: - {id, dimension, symbol}` and "conversions: []     # vacío en v1".

**Question.** Who discovers and loads `units.yaml`, what shape is validated, and what happens to a unit id that no registry declares? (T-03)

**Options considered**
1. P011 engine functions take an already-built unit registry; P011 ships a validator/loader for exactly the l.596-597 shape (`units[]` of `{id, dimension, symbol}` strings, unique `id`; `conversions` must be an empty list); discovery and merging of `extensions/*/units.yaml` belongs to the phase that wires `kf validate` (P007), where a unit id declared twice is an error.
2. P011 also owns file discovery.

**Decision.** Option 1. A unit id used in a table input, literal or output that the registry does not declare is a typed engine error `UNKNOWN_UNIT` (internal code; no catalog code fits). No unit set is assumed to be built in; bare `percent` is valid only if a registry declares it, and units are compared by `id` only (never by `dimension` or `symbol`), so the `percent_*` variants are never interchangeable.

**Rationale.** Keeps the persisted format exactly as quoted; keeps file-system policy out of a pure-logic phase; unit identity by `id` is the direct reading of l.589/l.591.

**Reversibility.** LOW.
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P011 triage)
**Ratified**: pending
**Affects.** P011, P012, P007.

---

## E-0019 — Decision-table matching semantics: binding, types, units, nulls, enums

**Clauses**
- l.620-629 (§12.1 grammar): "predicate := { field: matcher } | { all: [predicate] } | { any: [predicate] } | { not: predicate }"; "matcher   := literal"; "{ between: [min, max] }        # inclusivo en ambos extremos"; "value     := scalar | quantity".
- l.589 (`KF-E-310`); l.606: "`null` **SHALL** significar "ausente", nunca "cero" ni "falso"."; l.607: "Toda comparación con un operando `null` evalúa a `false`, salvo `is_null`."; l.608: "Todo `enum` **SHALL** declarar su `domain`. Un valor fuera del dominio en un escenario → `KF-E-314`."
- l.448-451 (BR-0037 example): input `{ref: DE-0017.material_type, type: enum, domain: [X, Y, Z]}` with `when: {material_type: {not_in: [X]}}`.
- l.1769: "| `KF-E-314` | E | Valor fuera del dominio del enum | — |"

**Question.** How `when` keys bind to `inputs[]`; operator/type rules; unit mismatches; null and absent inputs; out-of-domain enum values outside scenarios. (T-02, T-04, T-05, T-09)

**Decision.**
- Binding: a `when` field key matches an input whose `ref` equals the key, or whose `ref` suffix after the last `.` equals the key. A key matching no input, or a suffix shared by two inputs, is a typed error (`UNBOUND_FIELD` / `AMBIGUOUS_FIELD`). Several keys in one predicate mapping are a conjunction. An empty predicate mapping `{}` is a typed error (`EMPTY_PREDICATE`); the only unconditional row is `when: default` (E-0020). *(Amended by E-0022 (D-08): a top-level `when: {}` is an unconditional non-default row; `{}` nested inside `all`/`any`/`not` stays `EMPTY_PREDICATE`.)*
- Literal matcher means `eq`. `eq`, `ne`, `in`, `not_in` compare strings, booleans and enum values exactly (case-sensitive, code-point equality) and decimals/quantities by value (E-0017). `lt`, `lte`, `gt`, `gte`, `between` apply only to decimal and quantity inputs; any other operand type is a typed error `TYPE_MISMATCH`. `between` with `min > max` is a typed error.
- Units: a quantity is comparable only with a quantity of the identical unit id. A different unit id, or a quantity against a bare scalar (either direction), is `KF-E-310` — both statically (a literal in `when` versus the input's declared `unit`, reported by the table check) and at evaluation (a supplied value versus the declared `unit`). Never coerced, never `false`.
- Null: binary logic. An input absent from the supplied values is `null`. Every matcher except `is_null` evaluates to `false` on a `null` operand, including `ne` and `not_in`; `eq: null` is `false`; `is_null: true` is the only test for absence. `not` negates the boolean result of its predicate (so `not: {x: {eq: 1}}` is `true` when `x` is null).
- Enums: a value outside the input's `domain` is `KF-E-314` wherever it occurs — a supplied value at evaluation (whoever calls) and a literal in `when` at table check. The catalog condition (l.1769) is not restricted to scenarios; l.608 names the scenario case as one instance.

**Rationale.** Literal reading of the grammar and of l.607; fail loudly on type and unit misuse (rules are regulated content); binding by suffix is what the only spec example does.

**Reversibility.** MEDIUM (affects how fixtures and rules are authored).
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P011 triage)
**Ratified**: pending
**Affects.** P011, P012, P014.

---

## E-0020 — Hit policies, `default`, overlap proof, exhaustiveness proof

**Clauses**
- l.632: "`hit_policy: first | unique | collect`."
- l.633: "`unique` **SHALL** verificar ausencia de solapamiento → `KF-E-312`."
- l.634: "**`exhaustive: true` SHALL exigir una fila `when: default`**, salvo que todos los inputs sean enums de dominio finito y el producto cartesiano de sus dominios sea ≤ `logic.exhaustiveness_proof_limit` (default `256`), en cuyo caso el engine enumera y prueba cobertura total. Fuera de eso → `KF-E-311`. Nada de SAT solver disfrazado de Knowledge Framework."
- l.1766-1767: `KF-E-311` "`exhaustive: true` sin default ni dominio probable"; `KF-E-312` "Solapamiento con `hit_policy: unique`".

**Question.** Result shape per hit policy; meaning and position of `default`; how "ausencia de solapamiento" is verified deterministically without a solver; exhaustiveness details. (T-06, T-07)

**Decision.**
- `default`: at most one row may have `when: default` (a second is a typed error). It matches if and only if no other row matches, regardless of its position, under every hit policy. It never counts toward overlap.
- `first`: the result is the first matching non-default row in document order, else the default row, else no match. `collect`: all matching non-default rows in document order, else `[default]`, else `[]`. `unique`: the single matching non-default row, else the default row, else no match; if two or more non-default rows match a supplied input, evaluation reports `KF-E-312`. No match is a normal result (`null` / `[]`), not an error.
- Static overlap check for `unique`: (a) if every input is an enum with a declared domain and the product of domain sizes is ≤ the proof limit, enumerate every tuple and report `KF-E-312` for the first tuple (enumeration order: inputs in `inputs[]` order, values in `domain` order) matched by two or more non-default rows, naming the first two such rows in document order and the witness tuple; (b) otherwise two rows are proven disjoint only if both are conjunctions of field matchers (no `any`, `not`, `matches`, `ne`, `not_in`) and some shared field has non-intersecting constraints (value sets for `eq`/`in`; closed/open decimal intervals for `lt`/`lte`/`gt`/`gte`/`between`/`eq`); any pair not proven disjoint is reported `KF-E-312` (overlap not excluded). This is a per-field interval/set comparison, not a solver.
- Exhaustiveness (`exhaustive: true`): satisfied by a `default` row. Otherwise every input must be `type: enum` with a declared `domain` and the product of domain sizes must be ≤ the limit (inclusive); the engine enumerates every tuple (same order as above) and reports `KF-E-311` with the first uncovered tuple. Any other input type (including boolean and quantity), a missing domain, or a product over the limit is `KF-E-311`. `exhaustive: false` or absent: no check. The limit is an explicit parameter (default 256, l.1954).

**Rationale.** Fail closed where absence of overlap or full coverage is not proven (l.633 and l.634 both demand proof); the only proof techniques used are enumeration (named by l.634) and per-field interval/set comparison.

**Reversibility.** LOW (diagnostics and evaluation results; no persisted format).
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P011 triage)
**Ratified**: pending
**Affects.** P011, P014.

---

## E-0021 — RE2 dialect in a Node engine; outputs and uncatalogued failures

**Clauses**
- l.612: "Dialecto **RE2** (sin backreferences ni lookaround, sin backtracking catastrófico). Las reglas se evalúan en CI; una regex patológica es un fallo de disponibilidad. Patrón no compilable en RE2 → `KF-E-315`."
- l.1956: "regex_dialect: re2"
- l.452, l.455: `then: {max_concentration: {value: "4.2", unit: percent_mass}, outcome: OUT-0004}` and `then: {exempt: true, outcome: OUT-0009}`.

**Question.** How to honor RE2 (no catastrophic backtracking) with no native dependency; `matches` semantics; `then` typing; failures with no catalog code. (T-08, T-10, T-11, T-12)

**Options considered (regex)**
1. Blacklist backreferences/lookaround, then match with JS `RegExp` (no linear-time guarantee).
2. Add the native `re2` package (new dependency; native builds on the CI matrix; needs human approval).
3. Parse a whitelisted RE2 subset and match with an engine-owned linear-time automaton.

**Decision.**
- Regex: option 3. Accepted syntax: literals and escaped metacharacters, `.`, character classes with ranges and negation, `\d \w \s \D \W \S`, anchors `^ $`, groups `( )` and `(?: )`, alternation `|`, quantifiers `* + ? {n} {n,} {n,m}` with n, m ≤ 1000, and their lazy forms (which do not change match/no-match). Anything else (backreferences, lookaround, named groups, inline flags, Unicode property escapes, possessive/atomic forms, larger repeat counts) is `KF-E-315`, reported by the table check. Matching is unanchored search (RE2 partial match), case-sensitive, over code points, in time linear in input length for a fixed pattern. `matches` on `null` is `false` (E-0019); on a non-string value it is `TYPE_MISMATCH`.
- Outputs: `then` is an opaque mapping returned verbatim (decimal strings and quantities unchanged); quantity unit ids in `then` must be declared (`UNKNOWN_UNIT`, E-0018). `outcome` is not cross-checked against other entities in P011 (P007).
- Input types supported: `enum`, `quantity` (requires `unit`), `decimal`, `string`, `boolean`. Any other `type`, `unit` on a non-quantity input, duplicate rule `id` in one table: typed errors.
- Uncatalogued failures use internal typed codes (not `KF-`), following the E-0014 precedent; P007/P014 map them when wiring the CLI. `KF-E-313` (division by zero) does not apply to decision tables; the decimal module exposes division for P012.

**Rationale.** Option 3 is the only one that satisfies l.612's availability concern without a new native dependency; the subset covers what business rules need and rejects the rest loudly.

**Reversibility.** LOW (behavioral; no persisted format beyond what rules already contain).
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P011 triage)
**Ratified**: pending
**Affects.** P011, P012, P013, P014.

---

## E-0022 — Decision-table details from P011 planning (amends E-0019 on `when: {}`)

**Clauses**
- l.620: "predicate := { field: matcher } | { all: [predicate] } | { any: [predicate] } | { not: predicate }"
- l.584: "El redondeo **SHALL** declararse explícitamente donde se aplique ... Sin declaración, no hay redondeo."
- l.612: "Dialecto **RE2** (sin backreferences ni lookaround, sin backtracking catastrófico)."
- l.634: "... en cuyo caso el engine enumera y prueba cobertura total."
- Accepted P001 format: `framework/schemas/logic.schema.json` l.56 admits a rule `when` that is `"default"`, an object with `maxProperties: 0`, or a predicate; the accepted fixture `acme-formulation/knowledge/business-rules/BR-0001/observed/legacy-app.yaml` l.14 uses `when: {}`.

**Question.** Eight details the P011 planner found undetermined (P011 `TRIAGE.md` D-01..D-08), one of which (D-08) shows that E-0019's "`{}` is `EMPTY_PREDICATE`" contradicts the accepted P001 format.

**Decision.**
- (D-08, amends E-0019) A rule whose top-level `when` is the empty mapping `{}` is an **unconditional row**: a conjunction of zero field conditions, which matches every input. It is not a `default` row: it takes part in hit policies like any other non-default row, it overlaps every other non-default row under `unique` (`KF-E-312`), and it does not satisfy the "fila `when: default`" requirement of l.634 (it covers every tuple when enumeration applies). An empty mapping anywhere *inside* `all`/`any`/`not` remains `EMPTY_PREDICATE`. The rest of E-0019 stands.
- (D-01) P011 functions assume input that is valid against the P001 schemas; they do not run JSON Schema validation and never emit `KF-E-010`. Structurally invalid input that reaches them is a typed error `INVALID_TABLE`. Schema validation belongs to `kf validate` (P028/P007).
- (D-02) Supplied evaluation values bind to inputs by the same rule as `when` keys (full `ref` or suffix after the last `.`). A supplied key that binds to no input is `UNBOUND_FIELD`; two supplied keys binding to the same input, or one key binding to two inputs, are `AMBIGUOUS_FIELD`.
- (D-03) `all: []` and `any: []` are `EMPTY_PREDICATE`.
- (D-04) Division is removed from P011 scope; P012 (formula) decides inexact quotients together with `rounding`. P011's decimal module exposes only exact operations.
- (D-05) RE2 fine print, following RE2 defaults for every construct E-0021 lists: `.` does not match `\n`; `^`/`$` match only at the start/end of the whole text; `\d \w \s` (and negations) are ASCII classes; accepted escapes are escaped metacharacters and `\n \t \r \f \v`; the empty pattern is valid and matches every string. Anything not listed in E-0021 or here (including `\b`, POSIX `[[:alpha:]]` classes, nested quantifiers such as `a**`) is `KF-E-315`. A pattern whose compiled program exceeds 100000 instructions is `KF-E-315`.
- (D-06) Enumeration order for overlap witnesses and uncovered tuples: inputs in `inputs[]` order with the **last input varying fastest** (lexicographic, first input outermost), each input's values in `domain` order.
- (D-07) In `then`, any mapping at any depth whose key set is exactly `{value, unit}` is a quantity; its `unit` must be declared (`UNKNOWN_UNIT`) and its `value` must be a valid decimal string (`INVALID_DECIMAL`).

**Rationale.** D-08 follows the accepted persistent format (an explicit schema alternative distinct from `default`) and the plain logic of an empty conjunction; the others choose the fail-loud or more literal option.

**Reversibility.** LOW.
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P011 planning)
**Ratified**: pending
**Affects.** P011, P012, P014.

---

## E-0023 — P002 implementation details: cross-ID renumber order, ambiguous result fields, stale-lock break

**Clauses**
- l.317: "El engine renumera el de `first_canonical_commit` posterior y registra `id_alias`."
- l.304: "con lock transaccional"; E-0013, E-0015 D-02(c), E-0016.

**Question.** Points the P002 implementer met that E-0013/E-0015/E-0016 leave open: (1) order of fresh-ID assignment when losers of *different* colliding IDs are renumbered in one promotion call; (2) the remaining fields of an `ambiguous` `resolveId` result; (3) how to break a stale lock without removing a lock acquired after staleness was judged.

**Options considered.** (1a) by colliding ID ascending in byte order, then the E-0002/E-0009 order within each ID; (1b) one global order by (first-parent index, path). (2a) `id: null, path: null, via: [], warnings: []`; (2b) `via: [input]`. (3a) rename the lock directory directly; (3b) first claim the owner file by an in-directory rename, verify its bytes equal the owner judged stale (restore and abort otherwise), then rename the directory away and remove it.

**Decision.** (1a), consistent with D-02(c), which already orders `promote` events by ID. (2a). (3b): it satisfies E-0013's single-winner requirement without the race in (3a); a breaker that dies mid-way leaves an owner-less lock, handled by E-0015 D-04 (manual removal).

**Reversibility.** LOW for (2) and (3); MEDIUM for (1) (persisted event order).
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P002 R01)
**Ratified**: pending
**Affects.** P002.

---

## E-0024 — Registry replay after real merges; alias projection across moves; canonical ref resolution (amends E-0012, E-0016)

**Clauses**
- l.300: "Únicos, no reutilizables, independientes del nombre."
- l.318: "**Un ID `permanent` SHALL NOT ser renumerado jamás.**"
- l.319: "`id_alias` **SHALL** resolverse en todas las queries, indefinidamente."
- l.1115: "**«Once published on the canonical branch, history SHALL NOT be rewritten.»**"
- E-0007 (`merge=union`), E-0009 (first-parent history of the canonical branch), E-0011 (projection converges idempotently), E-0012 ("A second `promote` for one ID ... makes the registry invalid"), E-0016 (2a).

**Question.** P002 R01 audit (findings F01/D02, D01, F02, D03) showed: (1) two branches that each ran an idempotent promotion and are then union-merged leave two byte-identical `promote` lines at non-adjacent positions, which E-0012 declares invalid, so a routine merge disables the registry; (2) E-0016 (2a) anchors the `id_alias` projection to the path of the `allocate`, so the projection is erased after the renumbered entity moves (recorded `move` after promotion, or an unrecorded relocation while still provisional, e.g. renaming its directory to match the new ID); (3) the reader accepts an `alias` that renumbers the file holding a promoted ID; (4) the canonical branch is resolved with `git rev-parse <name>`, which prefers a same-named tag and accepts revision expressions such as `main~1` or `main@{yesterday}`.

**Decision.**
1. **Exact duplicates are idempotent.** During replay, an event whose op and every field equal an earlier event's (`promote`, `alias`, `move`; `allocate` duplicates were already tolerated) is a no-op repeat. A `promote` for an already-promoted ID with a different `path` or `commit`, an `alias` with the same `from` and `path`-anchor but a different `to`, or a `move` that is not an exact repeat and whose `from` is not the current path remain invalid (fail closed). This refines E-0012's "second `promote`" to "second, *different* `promote`".
2. **Renumbering a permanent ID is invalid.** An `alias` whose renumbered entity (point 3) is the current holder of `alias.from` — i.e. `alias.from` has a `promote` whose path, followed through recorded moves, equals the alias's anchor path — makes the registry invalid (l.318).
3. **Alias projection follows the renumbered entity.** For an alias X→Y, the anchor path is the `path` of the `allocate Y` written by that renumbering (E-0015 D-02c / E-0016). The renumbered entity's *current* path is derived as follows:
   - If Y has a `promote` event: when the promote's path equals the anchor, or equals no path of any other `allocate Y` event, the current path is Y's holder path (the promote path followed through recorded `move` events of Y). Otherwise (Y was promoted for a different entity that had its own `allocate Y`), the alias projects onto no file.
   - If Y has no `promote` event: the current path is the anchor if a file carrying Y (or carrying X as the pending half of an interrupted renumber) exists there; otherwise the unique file carrying Y whose path equals no path of any `allocate Y` event; otherwise none.
   - `id_alias` of a file is the chain of aliases (oldest first) whose renumbered entity's current path is that file's path, recursing through earlier aliases of the same entity. E-0016 (2a) is amended accordingly; its exclusion of an unrelated holder of Y still holds.
4. **Canonical branch ref.** The engine resolves the canonical branch name only as a branch: `refs/heads/<name>` if it exists, otherwise `refs/remotes/origin/<name>`, otherwise `CANONICAL_BRANCH_UNRESOLVED`. Tags, revision expressions and reflog syntax are never accepted (names that fail `git check-ref-format --branch` are `CANONICAL_BRANCH_UNRESOLVED`). Git is invoked so that replace refs and grafts cannot alter history (`--no-replace-objects` / `GIT_NO_REPLACE_OBJECTS=1`).

**Rationale.** (1) restores the merge-safety E-0007/E-0012 intended while keeping every genuine conflict fail-closed; (2) is the direct reading of l.318; (3) keeps the projection attached to the entity rather than to a path that legitimately changes, without inventing a provisional `move` writer; (4) makes "the canonical branch" mean a branch, identically on every clone.

**Reversibility.** MEDIUM (replay validity and entity projections; no new event kinds or fields).
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P002 audit R01)
**Ratified**: pending
**Affects.** P002, P007.

---

## E-0025 — Absent inputs in the static proofs; "bare scalar" in the unit rule (amends E-0020, clarifies E-0019)

**Clauses**
- l.607: "Toda comparación con un operando `null` evalúa a `false`, salvo `is_null`."
- l.633: "`unique` **SHALL** verificar ausencia de solapamiento → `KF-E-312`."
- l.634: "... salvo que todos los inputs sean enums de dominio finito y el producto cartesiano de sus dominios sea ≤ `logic.exhaustiveness_proof_limit` (default `256`), en cuyo caso el engine enumera y prueba cobertura total."
- l.628: "value     := scalar | quantity"; E-0019: "a quantity against a bare scalar (either direction), is `KF-E-310`".

**Question.** (1) P011 audit R01 (F02): E-0020's enumeration ranges over declared domain values only, so a `unique` table whose rows can both match an absent input (via `not` or `is_null`) passes the static check and then fails at evaluation with `KF-E-312`; likewise an "exhaustive" enum table returns no match for an absent input. (2) Does "bare scalar" in E-0019 include enum, string and boolean values, or only decimals?

**Decision.**
1. **Overlap proof includes absence.** For the `unique` overlap proof by enumeration (E-0020 (a)), each input ranges over its domain values plus `null` (absent), in that order (`null` last), with the D-06 order otherwise unchanged. Enumeration applies when the product of the domain sizes is ≤ the limit (l.634 wording, unchanged) **and** the product of (domain size + 1) is ≤ the limit; otherwise the interval/set reasoning of E-0020 (b) applies, which already fails closed for rows containing `not` or `is_null` (the only matchers that can match `null`, l.607). A witness tuple may contain `null`.
2. **Coverage proof stays over domains.** The exhaustiveness proof (l.634) enumerates domain values only, as written ("producto cartesiano de sus dominios"); an absent input is outside the coverage guarantee and may evaluate to no match. This is recorded, not changed.
3. **"Bare scalar" means any non-quantity value.** A quantity compared with any non-quantity value — decimal, string, boolean or enum value — in either direction (literal versus declared input type, or supplied value versus declared input type) is `KF-E-310`, statically and at evaluation, as E-0019 states. `TYPE_MISMATCH` remains for the other type misuses E-0019 lists (ordering operators on non-numeric inputs, `matches` on non-strings).

**Rationale.** (1) makes the static verification demanded by l.633 sound with respect to evaluation, at no cost for tables without `not`/`is_null`; (2) keeps l.634's literal domain product; (3) is the literal reading of E-0019 and of l.628.

**Reversibility.** LOW.
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P011 audit R01)
**Ratified**: pending
**Affects.** P011, P014.

---

## E-0026 — Literal `null` operands in `ne`, `in`, `not_in`; regex program size counts the final match

**Clauses**
- l.607: "Toda comparación con un operando `null` evalúa a `false`, salvo `is_null`."
- l.624: "| { in|not_in: [value] }"; E-0019 (null semantics); E-0022 D-05 ("compiled program exceeds 100000 instructions").

**Question.** (1) For a non-null input, what do `ne: null`, `in: [..., null, ...]` and `not_in: [..., null, ...]` evaluate to? (2) Does the final match instruction count toward the 100000-instruction cap? (P011 audit R01, T04/T05)

**Decision.**
1. `ne: null` is `false` (a comparison with a `null` operand, l.607). `in` is true iff the input is non-null and equals some non-null list element (a `null` element never matches). `not_in` is true iff the input is non-null and every list element is non-null and differs from the input; a `null` element therefore makes `not_in` false. These are the element-wise readings of l.607 with `in` as a disjunction of `eq` and `not_in` as a conjunction of `ne`.
2. The cap counts every instruction of the compiled program, including the final match: a program of exactly 100000 instructions compiles; 100001 is `KF-E-315`.

**Reversibility.** LOW.
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P011 audit R01)
**Ratified**: pending
**Affects.** P011, P014.

---

## E-0027 — P011 remediation readings: instruction counting, exact-ref ambiguity, single `KF-E-310`

**Clauses**
- E-0019 ("a suffix shared by two inputs" → `AMBIGUOUS_FIELD`; quantity vs bare scalar → `KF-E-310`), E-0022 D-05 / E-0026 (2) (program-size cap), E-0025 (3).

**Question.** Three readings the P011 R01 remediation cases rely on: (1) how instructions are counted at the 100000 boundary; (2) whether a key equal to one input's full ref is still ambiguous when another input shares it as suffix; (3) whether a quantity literal on an `enum` input yields `KF-E-310` alone or also `KF-E-314`, and whether a supplied quantity on a non-quantity input is `KF-E-310`.

**Decision.**
1. For the boundary cases: each literal/class/`.` atom copy is one instruction, a non-capturing group adds none, and the final match is one (so `(?:a{1000}){99}a{999}` is exactly 100000). Other constructs' counts are implementation-defined, provided the cap bounds compile time and memory (P011 R01 F01/F02).
2. Yes: with inputs `x` and `A.x`, the key `x` is `AMBIGUOUS_FIELD`; `A.x` binds by full ref.
3. A quantity literal on an `enum`/`string`/`boolean` input yields exactly one `KF-E-310` (no `KF-E-314`: domain membership applies to scalar values). A supplied quantity for an `enum`/`string`/`boolean` input is `KF-E-310` with `expected_unit: null` ("either direction", E-0025 (3)).

**Reversibility.** LOW.
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P011 R01 remediation)
**Ratified**: pending
**Affects.** P011.

---

## E-0028 — P002 remediation readings: alias anchor, conflicting alias repeats, lock owner fields, PLAN wording

**Clauses**
- E-0015 D-02(c) ("for each loser ... an `allocate` of the new ID followed by its `alias`"); E-0013 (owner file `{pid, host, acquired_at}`); E-0024 (1), (3), (4).

**Question.** Residual points from the P002 R01 remediation cases: (1) which `allocate Y` anchors an alias X→Y when Y has several; (2) two `alias` lines with the same `from` and `to` but different `commit`; (3) whether the owner file uses injected `now`/`hostname`; (4) the PLAN's stale "accepts `origin/main`" wording; (5) whether `readIdRegistry` deduplicates exact repeats.

**Decision.**
1. The anchor is the nearest `allocate Y` that precedes the `alias` line in file order (the renumbering writes them adjacently, D-02(c), and a union merge preserves each side's relative order). An `alias` with no preceding `allocate Y` makes the registry invalid. This replaces any "else the nearest one after" fallback.
2. Same `from` and `to` with a different `commit` is a conflicting event: `INVALID_REGISTRY` (only exact repeats are idempotent, E-0024 (1)).
3. When `now` / `hostname` are injected, the engine writes those values into `owner.json` (so the staleness test compares like with like); otherwise the real clock (ISO-8601 UTC) and `os.hostname()`.
4. E-0024 (4) supersedes the PLAN text: `origin/main` given as a name is `CANONICAL_BRANCH_UNRESOLVED`; the remote-tracking branch is reached only through the fallback `refs/remotes/origin/<name>` for a plain branch name.
5. Implementation-defined; callers must not depend on whether exact repeats appear in the returned list.

**Reversibility.** LOW.
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P002 R01 remediation)
**Ratified**: pending
**Affects.** P002.

---

## E-0029 — Promotion runs only at the canonical tip

**Clauses**
- l.308: "> **«An ID is permanent only after its first appearance on the canonical branch.»**"
- l.316: "Al entrar al branch canónico, `kf validate` lo promueve a `permanent`."
- l.318: "**Un ID `permanent` SHALL NOT ser renumerado jamás.**"
- E-0001 (explicit canonical branch), E-0002 ("identical result on every clone"), E-0009, E-0024 (1), (4).

**Question.** P002 audit R02 (A01): `promoteIds` run on a non-canonical checkout decides winners, losers and loser IDs from that branch's working tree and registry tail. Its `promote`/`alias` events can then contradict those computed on the canonical branch, and a union merge makes the registry invalid. Where may promotion run?

**Options considered**
1. Only when the checkout is the canonical tip; elsewhere promotion is an explicit no-op.
2. Compute holders from the canonical tip tree regardless of checkout (still needs a rule for branch-local loser counters).
3. Allow branch-local promotion and tolerate conflicting facts in replay (weakens fail-closed).

**Decision.** Option 1. `promoteIds` writes registry events or rewrites entities only when the commit of the checkout's `HEAD` equals the commit the canonical branch name resolves to (E-0024 (4)). Otherwise it writes nothing and returns empty `promoted`, `renumbered` and `entities_rewritten` lists, with `skipped: 'not_canonical_tip'`. That is a normal result, not an error. `allocateId`, `checkIdCollisions` and `resolveId` are unaffected. P007 decides how `kf validate` reports the skip. This supersedes the PLAN statement (F-D4, V-34/V-35) that promotion from a feature-branch checkout reads `main`'s history and promotes.

Residual risk: an uncommitted local allocation on a canonical-tip checkout can still make loser numbering differ from CI's. Such a divergence surfaces as `INVALID_REGISTRY` after merge (fail closed). It is recorded here, not prevented.

**Rationale.** l.316 ties promotion to entry into the canonical branch. At the tip, every input to the decision is canonical history plus the committed registry, which is identical on every clone, so repeated runs produce byte-identical events that E-0024 (1) deduplicates.

**Reversibility.** LOW (no format change; narrows when events are written).
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P002 audit R02)
**Ratified**: pending
**Affects.** P002, P007.

---

## E-0030 — Formula unit algebra and dimensionless values

**Clauses**
- l.589: "Unidad declarada distinta de unidad recibida es ERROR (`KF-E-310`)." l.591: "Esto incluye pares matemáticamente convertibles."
- l.660-663: "`add`, `subtract`, `min`, `max`, `clamp`: todos los operandos **SHALL** tener unidad idéntica; el resultado la conserva." / "`multiply`, `divide`: el resultado combina dimensiones. Si la dimensión resultante no existe en `units.yaml` → `KF-E-316`." / "`const` sin unidad es adimensional." / "La unidad calculada **SHALL** coincidir con `output.unit` → `KF-E-310`."
- l.596-597: `units: - {id, dimension, symbol}` (a dimension is an opaque name).

**Question.** `units.yaml` gives each unit only an opaque `dimension` name. What does "combine dimensions" mean, which unit does a product or quotient have, is "unidad idéntica" by id or by dimension, and how is a dimensionless value represented and matched against `output.unit`? (P012 triage T-01, T-07, T-09, T-16)

**Decision.**
1. Every formula value carries a **unit monomial**: a map from unit id to a non-zero integer exponent. The empty monomial is dimensionless. A `const` without `unit`, and a ref declared `type: decimal`, are dimensionless. A `const` with `unit` (it must be registered, `UNKNOWN_UNIT`) and a ref declared `type: quantity, unit: u` carry `{u: 1}`.
2. `add`, `subtract`, `min`, `max`, `clamp`, and the two branches of `if`, require identical monomials. Identity is by unit id, never by dimension (l.591). A mismatch is `KF-E-310`. The result keeps the monomial.
3. `multiply` and `divide` add or subtract exponents. The result is admissible only when its monomial is empty (dimensionless) or exactly one registered unit id with exponent 1. Any other result, such as `percent_mass²` or `ppm_mass/percent_mass`, has no unit in `units.yaml` and is `KF-E-316`, reported statically on that node. The engine never invents or converts a unit.
4. Output check (l.663). If the computed monomial is `{u: 1}`, `output.unit` must equal `u`. If it is dimensionless, `output.unit` must name a registered unit whose `dimension` is the literal string `dimensionless`. Otherwise the result is `KF-E-310`.
5. `abs` and `round` keep the monomial. Every unit check in this entry (`KF-E-310`, `KF-E-316`) is static, a function of the expression tree, the declared refs and the registry, and covers both branches of every `if`.

**Rationale.** This is the only reading that needs no new `units.yaml` fields and allows no implicit conversion. The spec example checks: `percent_mass × (1 − dimensionless)` gives `percent_mass`.

**Reversibility.** MEDIUM (fixes the meaning of `dimension: dimensionless` for dimensionless outputs).
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P012 triage)
**Ratified**: pending
**Affects.** P012, P014.

---

## E-0031 — Formula refs, guards, `if`, and nulls

**Clauses**
- l.641-652 (example: refs without type; `guards: - when: {DE-0017.loss_factor: {gte: "1"}}  raise: OUT-0011`).
- l.657: "`if` toma `{cond: predicate, then: expr, else: expr}`."
- l.606-607: "`null` **SHALL** significar "ausente", nunca "cero" ni "falso"." / "Toda comparación con un operando `null` evalúa a `false`, salvo `is_null`."
- E-0019 (binding, predicate semantics), E-0022 D-01/D-02.

**Question.** How do refs get a type and unit when a formula declares no inputs? What are guard order and result? How do `if` and `null` operands behave? (T-02, T-06, T-10, T-13, T-15)

**Decision.**
1. **Refs.** Check and evaluate take a caller-supplied `inputs` list with the same shape as decision-table `inputs[]` (`{ref, type, unit?, domain?}`; the types of E-0021). The persisted formula format is unchanged; P007/P014 build the list from the entity model. Expression refs, guard keys, `if` conditions and supplied values bind by the E-0019 rule (full ref or last-`.` suffix; `UNBOUND_FIELD` / `AMBIGUOUS_FIELD`). Only `quantity` and `decimal` inputs may appear as expression operands (`TYPE_MISMATCH` otherwise). Predicates may use every input type, with the P011 semantics, including `KF-E-310/314/315`.
2. **Guards.** They are evaluated in document order, before the expression. The first guard whose `when` is true ends evaluation with `{status: 'raised', outcome: <OUT-id>, value: null}`. No later guard and no part of the expression is evaluated. `when` follows P011 predicate semantics; an empty mapping is `EMPTY_PREDICATE`. `raise` is checked only against its pattern; whether the `OUT` entity exists is P007.
3. **`if`.** Evaluation is lazy: only the selected branch is evaluated. A `cond` that compares against `null` is false (l.607), so the `else` branch runs. Static checks (units, `KF-E-313`, `KF-E-316`) cover both branches.
4. **Null.** An absent or `null` operand makes the result of the arithmetic operation that uses it `null`. This propagates to the formula value: `{status: 'ok', value: null}`. A null is never treated as zero (l.606). A `null` divisor gives `null`, not `KF-E-313`. Final rounding of `null` is `null`.

**Reversibility.** LOW (API shape and evaluation rules; no persisted format).
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P012 triage)
**Ratified**: pending
**Affects.** P012, P014, P007.

---

## E-0032 — Division, rounding, and the `KF-E-313` protection proof

**Clauses**
- l.584: "El redondeo **SHALL** declararse explícitamente donde se aplique: `rounding: {mode: half-even | half-up | down | up, decimals: N}`. Sin declaración, no hay redondeo."
- l.585: "División por cero → `KF-E-313` en validación, o el `guard` declarado en tiempo de evaluación."
- l.634: "Nada de SAT solver disfrazado de Knowledge Framework." l.1768: "| `KF-E-313` | E | División por cero no protegida | añadir `guard` |"
- l.1955: "decimal_precision: 28"; E-0017; E-0022 D-04.

**Question.** Where does rounding apply, and what does the `round` operator take? How are inexact quotients computed? When is a division "protected", without a solver? (T-03, T-04, T-05, T-11, T-12)

**Decision.**
1. **Rounding placement.** The logic-level `rounding` is applied exactly once, to the final non-null result. Intermediate `add`, `subtract` and `multiply` are exact. The `round` operator takes exactly one argument and applies the logic-level `rounding` at that point. If a formula uses `round` without a `rounding` block, that is the typed error `INVALID_EXPRESSION`.
2. **Modes.** `half-even`: ties to even. `half-up`: ties away from zero. `down`: toward zero. `up`: away from zero. `decimals` is a non-negative integer with no cap. A rounded result is rendered with exactly `decimals` fraction digits, trailing zeros kept, and a negative zero renders as non-negative.
3. **Division.** An exact quotient (a terminating decimal of at most `precision` significant digits) is returned exactly. For an inexact quotient:
   - with a `rounding` block, it is rounded to `precision` significant digits using the declared `mode`, then rounded again at the end per (1);
   - without a `rounding` block, it is the typed error `INEXACT_DIVISION` (l.584).
   `precision` is an explicit option with default 28 (l.1955); P007 wires the configuration value.
4. **Protection proof (static).** A `divide` node is protected when one of these holds:
   - (a) its divisor is a constant that is not zero;
   - (b) its divisor is a bare `ref` R, and some guard's `when` is a single matcher on R that is true whenever R equals zero: `eq`/literal `"0"` (or the zero quantity in R's unit), `in` containing it, `lte`/`gte`/`between` whose range contains 0, or `is_null` combined in an `any` with one of those;
   - (c) the node lies in the `then` branch of an `if` whose `cond` is a single matcher on R that is false whenever R equals zero (`ne "0"`, `gt "0"`, `lt "0"`, `not_in` containing `"0"`), or in the `else` branch of an `if` whose `cond` is true whenever R equals zero.
   A constant zero divisor is never protected. Every other divisor (compound expressions, refs without such a guard or condition) is unprotected, which is `KF-E-313` (fail closed, no solver). This proof is only syntactic and per-field, in the style of E-0020 (b).
5. **Static findings block evaluation.** If a formula has static findings (`KF-E-310`, `KF-E-313`, `KF-E-316`, or predicate findings), evaluation returns `status: 'error'` with those findings and evaluates nothing. A runtime zero divisor is then unreachable. If it happens anyway, it is the typed error `DIVISION_BY_ZERO` (defensive).
6. **Size limits.** There is no digit cap. Expression nesting depth is limited to 1000 (`INVALID_EXPRESSION` beyond that), the same limit as P011 predicates.

**Reversibility.** LOW.
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P012 triage)
**Ratified**: pending
**Affects.** P012, P014.

---

## E-0033 — Formula operator arity and diagnostics inventory

**Clauses**
- l.656: "Operadores: `add · subtract · multiply · divide · min · max · abs · round · clamp · if`." (no arities)
- §42.2 l.1765-1771; E-0014 / E-0022 D-01 (typed internal codes for failures without a catalog code).

**Question.** Operator arities, and which failures are `KF-` diagnostics versus typed errors. (T-08, T-14)

**Decision.**
- **Arity.**
  - `subtract` and `divide`: exactly 2 arguments.
  - `add`, `multiply`, `min`, `max`: one or more; one argument returns it unchanged, and longer lists fold left.
  - `abs` and `round`: exactly 1.
  - `clamp`: exactly 3, `(x, lo, hi)`. A runtime `lo > hi` is `INVALID_RANGE`.
  - Any other arity, an unknown `op`, or a malformed node is `INVALID_EXPRESSION`.
- **Diagnostics.**
  - Returned `KF-` diagnostics (sorted with the P011 key and located by JSON pointer):
    - `KF-E-310` (units, the output check, predicate literals);
    - `KF-E-313`;
    - `KF-E-316`;
    - `KF-E-314` and `KF-E-315` (from predicates);
    - `KF-E-312`/`KF-E-311` never apply.
    `logic-diagnostics.mjs` gains the catalog rows for `KF-E-313` (remediation "añadir `guard`") and `KF-E-316`.
  - Thrown typed errors: `INVALID_EXPRESSION`, `INEXACT_DIVISION`, `DIVISION_BY_ZERO`, `INVALID_RANGE`, plus the P011 codes (`UNKNOWN_UNIT`, `UNBOUND_FIELD`, `AMBIGUOUS_FIELD`, `TYPE_MISMATCH`, `INVALID_DECIMAL`, `EMPTY_PREDICATE`, `INVALID_TABLE`→ for formulas `INVALID_EXPRESSION`).
  - `KF-E-010` is never emitted (E-0022 D-01).

**Reversibility.** LOW.
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P012 triage)
**Ratified**: pending
**Affects.** P012.

---

## E-0034 — Permanent-renumber invalidity is judged at the alias's replay position (amends E-0024 (2))

**Clauses**
- l.318: "**Un ID `permanent` SHALL NOT ser renumerado jamás.**"
- E-0024 (2); E-0004 (a recorded `move` is legitimate continuity); E-0029 (promotion only at the canonical tip).

**Question.** P002 audit R02 (D01) found two orderings of the same events treated differently. As E-0024 (2) is written, the comparison uses the *final* holder path of `alias.from`. Take a registry where X is promoted at A, the loser at B is renumbered X→Y, the loser later leaves B, and X is then moved to B with a recorded `move`. That registry becomes permanently invalid, even though the move is legitimate path reuse and the registry is append-only.

**Decision.** The E-0024 (2) check is made at the `alias` event's position in replay order. The alias is invalid iff, at that position, `alias.from` already has a `promote` and its holder path (the promote path followed through the `move` events replayed so far) equals the alias's anchor path. Later `move` events of `alias.from`, including a move into the former anchor path, do not retroactively invalidate the alias. The anchor itself stays as E-0028 (1) defines it.

**Rationale.** It distinguishes "renumbered a permanent holder", which is invalid, from "a permanent entity later reused a path", which is legitimate. Under E-0029, promotion and renumbering are computed only from canonical state, so the engine cannot produce a union-merge reordering that would hide a real conflict.

**Reversibility.** LOW.
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P002 audit R02)
**Ratified**: pending
**Affects.** P002.

---

## E-0035 — P002 R02 remediation readings: later promote at the anchor, tip check with injected readers, skipped entities

**Clauses**
- l.318; E-0029; E-0034; E-0011 ("atomically per file").

**Question.** Points raised while writing the P002 R02 remediation cases:
1. Under E-0034's positional rule, a registry `allocate X A, allocate Y A, alias X→Y, promote X A` (the alias line precedes the promote) would become valid.
2. E-0029's tip check is defined by Git `HEAD`, which does not exist when a caller injects a history reader without a repository.
3. The name of the result field for files skipped because of a concurrent edit.

**Decision.**
1. E-0034 is narrowed. An `alias` X→Y is also invalid when a `promote` of X whose path equals the alias's anchor appears **later** in replay. A promotion is an engine-written identity fact for that path, so it contradicts the renumbering. Only later `move` events into the anchor are legitimate path reuse (E-0034's case).
2. The history reader interface gains an optional `headCommit(): Promise<string>` (full SHA of the checkout's `HEAD`). The default reader always provides it, and the E-0029 check is `headCommit() === last(firstParentCommits(canonicalBranch))`. An injected reader without `headCommit` is treated as positioned at the canonical tip. This is an integration seam for tests and later phases; the CLI (P007) always uses the default reader.
3. A file not rewritten because its bytes changed after the scan is listed in `entities_skipped: string[]` (repo-relative paths, ascending UTF-8 byte order). It converges on the next run.

**Reversibility.** LOW.
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P002 R02 remediation)
**Ratified**: pending
**Affects.** P002, P007.

---

## E-0036 — P012 planning details: `KF-E-316` cascade, protection criterion, significant digits

**Clauses**
- l.661: "Si la dimensión resultante no existe en `units.yaml` → `KF-E-316`." l.663 (output unit → `KF-E-310`).
- l.585; E-0032 (3), (4).

**Question.** Three points left open by E-0030 and E-0032 (P012 `TRIAGE.md` D-01..D-03): (1) what a `KF-E-316` node contributes to its parents and to the output check; (2) whether E-0032 (4)'s list of protecting forms is closed or illustrative; (3) how significant digits are counted for "exact quotient".

**Decision.**
1. A node that reports `KF-E-316` has an **unknown** unit. Parents that combine with an unknown unit report nothing further about it, and the output check is skipped when the computed unit is unknown. Each defect yields exactly one finding.
2. The protection criterion of E-0032 (4) is **semantic**, and the listed forms are examples.
   - A guard protects a division by a bare ref R when its `when` predicate mentions only R and evaluates to true at R = zero (the decimal `"0"`, or the zero quantity in R's unit).
   - An `if` protects its `then` branch when `cond` mentions only R and evaluates to false at R = zero, and its `else` branch when `cond` evaluates to true at R = zero.
   - The evaluation uses the formula's own predicate semantics (E-0031). Predicates that mention other fields never protect.
3. Significant digits are counted on the normalized coefficient, with trailing zeros stripped: `10^32 / 1` is exact (1 significant digit).
- Additionally: P012 extends P011 modules only additively (new exports appended; P011 constants, behavior and tests unchanged). E-0033's "gains the catalog rows" is satisfied by an appended formula catalog.

**Reversibility.** LOW.
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P012 planning)
**Ratified**: pending
**Affects.** P012, P014.

---

## E-0037 — P012 conformance readings: nested protecting guards; identity among known units

**Clauses**
- E-0036 (1) (unknown unit after `KF-E-316`, no cascade) and E-0036 (2) (semantic protection criterion); l.660 ("todos los operandos **SHALL** tener unidad idéntica").

**Question.** The P012 conformance slice raised two points: (1) the P012 PLAN lists `{all: [{gain: {eq: "0"}}]}` and `{not: {gain: {ne: "0"}}}` as unprotecting guards, but both mention only `gain` and are true at zero; (2) how does the identity check treat an `add`/`subtract`/`min`/`max`/`clamp`/`if` whose operands include an unknown-unit operand (a `KF-E-316` subtree) in the first position?

**Decision.**
1. E-0036 (2) governs, so both guards protect. The PLAN row F-Zn4 is superseded for those two forms. Any predicate that mentions only R and evaluates true at R = zero protects, whatever its nesting (`all`, `any`, `not`).
2. Operands of unknown unit are ignored by the identity check. The remaining known-unit operands must be identical to each other: the first known operand is the reference, and every other known operand that differs is one `KF-E-310`. If no operand has a known unit, the result is unknown.

**Reversibility.** LOW.
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P012 conformance)
**Ratified**: pending
**Affects.** P012.

---

## E-0038 — Formula evaluation order with nulls; depth counting

**Clauses**
- l.606: "`null` **SHALL** significar "ausente", nunca "cero" ni "falso"."; E-0031 (4) (null propagation); E-0032 (3), (6); E-0033 (`clamp` `lo > hi` → `INVALID_RANGE`).

**Question.** P012 audit R01 raised three points: (1) are operands evaluated before null propagation applies, so that `clamp(null, 2, 1)` is `INVALID_RANGE` and `add(null, divide(1, 3))` without rounding is `INEXACT_DIVISION`, or does null short-circuit? (2) How is expression depth counted for the limit of 1000? (3) What is `clamp` with a null `x` and `lo > hi`?

**Decision.**
1. **Eager evaluation.** All arguments of an operator are evaluated first, left to right, and only then does null propagation (E-0031 (4)) apply to the operator's result. A defect inside a sibling argument (`INEXACT_DIVISION`, `INVALID_RANGE`) is therefore raised even when another argument is null. `if` stays lazy (E-0031 (3)).
   - Rationale: a defect in the formula is reported regardless of which data happen to be absent, which is deterministic and fails loudly.
2. **Depth.** The root expression node has depth 1. A tree of depth 1000 is accepted; depth 1001 is `INVALID_EXPRESSION`.
3. **`clamp` with null `x`.** It raises `INVALID_RANGE` when `lo` and `hi` are non-null and `lo > hi`, consistent with (1).

**Reversibility.** LOW.
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P012 audit R01)
**Ratified**: pending
**Affects.** P012.

---

## E-0039 — State-machine checks and evaluation

**Clauses**
- l.667-683 (grammar example); l.688: "Estado inalcanzable desde `initial` → `KF-W-317`."; l.689: "Estado no terminal sin camino a ningún terminal → `KF-E-318`."; l.690: "Dos transiciones con el mismo `from` y guards solapados sin `priority` → `KF-E-319`."; l.691: "`completeness: total` **SHALL** exigir que todo par (estado no terminal, trigger declarado) tenga transición o rechazo explícito."
- P001 schema `stateMachine.transitions[]`: required `id, from, to, trigger`; optional `guard` (object), `produces`, `performed_by`, `priority` (integer); `additionalProperties: true`.
- E-0019, E-0020, E-0022 D-08, E-0025, E-0031 (1), E-0014.

**Question.** Several state-machine points are left to invention (P013 triage T-01 to T-09, T-13):
- how reachability and terminal paths treat guards;
- what "solapados" means and which pairs are compared;
- the direction of `priority`;
- where triggers are "declared" and how an explicit rejection is written;
- what `partial` means, and which code a `total` gap uses;
- the evaluation API;
- binding;
- structural errors.

**Decision.**

1. **Reachability (`KF-W-317`).** Structural and guard-blind. A transition's `to` is reachable when its `from` is reachable, from `initial`. One warning per unreachable state, in `states[]` order.

2. **Terminal paths (`KF-E-318`).** Structural and guard-blind backward reachability from every `terminal` state over the `from → to` edges. Every non-terminal state in `states[]` outside that set gets one `KF-E-318`, whether or not it is reachable. A state that is both unreachable and dead gets both diagnostics. Cycles with an exit are fine. With `terminal: []`, every state is `KF-E-318`.

3. **Overlap (`KF-E-319`).**
   - Only pairs with the same `from` **and** the same `trigger` are compared. Transitions on different triggers never compete for one event, so the literal "mismo `from`" is read within one event.
   - An absent guard is `true`.
   - "Solapados" means not proven disjoint under E-0020 / E-0025. Enumeration including `null` applies when every input the two guards mention is an enum within the limits. Otherwise the per-field interval/set comparison applies, fail closed.
   - A pair is exempt iff both transitions carry `priority` and the two values differ.

4. **`priority`.** An integer where the **higher value wins**. Equal priorities on an overlapping pair are still `KF-E-319`. A pair where only one transition carries `priority` is still `KF-E-319`.

5. **Declared triggers and explicit rejection (`total`).**
   - The declared triggers are the union of `trigger` values of this machine's transitions. A caller may pass `triggers: [EVT-id]`, which replaces the union (P007 builds it from the process model).
   - An **explicit rejection** is a transition with `rejected: true` whose `to` equals its `from`. The schema allows the extra key. `rejected: true` with `to ≠ from` is `INVALID_EXPRESSION`.
   - Under `total`, every pair (non-terminal state, declared trigger) needs at least one transition or rejection with that `from` and `trigger`. Guards are not considered.

6. **`partial` and the `total` gap code.**
   - `partial` means no completeness check.
   - A `total` gap is reported as a returned diagnostic with the internal code `INCOMPLETE_TOTAL`, severity `E`, and the fields `state` and `trigger`. It is sorted with the P011 key. It is not a `KF-` code, because §42.2 has none for this SHALL. Adding a catalog code is a human decision; until then P007 maps the internal code.

7. **Evaluation.** `evaluateStateMachine(logic, {state, trigger, values}, options)`.
   - Candidates are the transitions with `from == state` and `trigger == trigger` whose guard is true (P011 predicate semantics).
   - The highest `priority` is selected first, then document order among equal or absent priorities. A runtime tie among overlapping candidates without distinct priorities is the typed error `AMBIGUOUS_TRANSITION`.
   - The result is one of:
     - `{status: 'transition', transition, from, to, produces, performed_by}`;
     - `{status: 'rejected', transition}` for a selected rejection;
     - `{status: 'no_transition'}`.
   - `produces` and `performed_by` are pass-through. A `state` not in `states` is `UNKNOWN_STATE`.
   - Static findings block evaluation, as in P011.

8. **Binding.**
   - Guard predicates bind through the caller-supplied `inputs` (E-0031 (1), E-0019).
   - `guard` must be exactly `{when: predicate}`, otherwise `INVALID_EXPRESSION`. `guard: {when: {}}` is unconditional (E-0022 D-08).
   - `entity` and `state_field` are checked for presence and pattern only; the current state is an explicit argument.
   - `trigger`, `produces` and `performed_by` are checked against their patterns only. Their existence is checked in P007.

9. **Structural errors.** These are thrown as typed errors before diagnostics:
   - `initial` not in `states`, a `terminal` or `from`/`to` not in `states`: `UNKNOWN_STATE`;
   - a duplicate transition `id`: `DUPLICATE_ID`;
   - malformed shapes: `INVALID_EXPRESSION`.

**Rationale.** Structural graph checks need no solver. Restricting overlap to one event avoids false positives on every multi-event state. The rejection key is the minimal persistent addition that makes the SHALL at l.691 satisfiable, and it fits the open transition schema.

**Reversibility.** MEDIUM: the `rejected` key and the `priority` direction persist in rule files. The rest is LOW.
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P013 triage)
**Ratified**: pending
**Affects.** P013, P014, P007.

---

## E-0040 — Narrative logic checks and notice

**Clauses**
- l.695-699: "`logic.unstructured_reason` es obligatorio." / "**`verification.mode` es obligatorio** (§25.4). Sin él → `KF-E-330`." / "El engine **SHALL** emitir en toda salida que incluya la faceta: *"Narrative rule — automated rule evaluation unavailable."*"
- l.1352-1368 (§26.3: `verification: {mode: attested | external-test, ...}`, at facet level).
- E-0005, E-0008 (a).

**Question.** The narrative rules leave open when `KF-E-330` fires, the exact notice text and its engine form, and what the checker receives, since `verification` is a facet sibling of `logic` (P013 triage T-10 to T-12, T-14).

**Decision.**
- `checkNarrative(logic, verification)` returns `KF-E-330` iff `verification` is absent, has no `mode`, or has a `mode` outside `attested | external-test`.
- A missing or empty `unstructured_reason` is the typed error `INVALID_EXPRESSION`; the P001 schema also enforces it.
- The `attested_by` / `external_test` payloads are not checked.
- The engine exports `NARRATIVE_NOTICE = "Narrative rule — automated rule evaluation unavailable."`, with U+2014 and a trailing period, exactly as at l.698.
- `evaluateNarrative(logic)` returns `{status: 'unavailable', notice: NARRATIVE_NOTICE}`.
- Emitting the notice in every output that includes the facet is an obligation on the later phases that produce outputs (CLI, context, check-rules), recorded here.

**Reversibility.** LOW.
**Status.** DECIDED_BY_FOREMAN
**Decided**: 2026-10-10 by Foreman (P013 triage)
**Ratified**: pending
**Affects.** P013, P014, P021, P007.
