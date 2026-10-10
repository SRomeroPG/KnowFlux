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
