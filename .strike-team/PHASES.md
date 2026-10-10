# KnowFlux roadmap through Milestone 1 (v2)

Core Specification v2.1 §53 fixes the format-first criterion: the persistent format and its validation come before behavior built on them. Roadmap v2 expresses dependencies as a DAG of "needs the artifact of", not "previous phase accepted" (ADR-0003). Operating protocol: [PROTOCOL_V2.md](PROTOCOL_V2.md). Real progress metric: [SCOREBOARD.md](SCOREBOARD.md). `Pxxx accepted` means the independent audit gate has passed. Authoritative state is `STATE.yaml`.

Status values: PLANNED, IMPLEMENTING, READY_FOR_AUDIT, AUDITING, CHANGES_REQUESTED, REMEDIATING, REAUDITING, ACCEPTED, BLOCKED_BY_DECISION, STALLED.

Tracks: Track A is format/backbone (P002, P028, P003 onward). Track B is pure logic (P011, P012, P013). Track "integration" is P027. The Foreman runs one primary phase and may run a secondary from another track only when the primary is BLOCKED_BY_DECISION or STALLED, or when implementers work in isolated worktrees on disjoint paths.

| Phase and §53 item | Primary clauses | Depends on | Track | Deliverable; verification | Risk | Status |
|---|---|---|---|---|---|---|
| [P001 Repository Foundation + Core Persistent Model](phases/P001-core-persistent-model/PLAN.md); A1 | §§4, 6.1, 7, 9–10, 14–16.3, 18.1–18.2, 20–23, 26, 42.1, 54–55 | — | A | 11 schemas, separate facet classes, partial text fixture, positive/negative schema tests | HIGH | ACCEPTED |
| [P002 ID Registry](phases/P002-id-registry/PLAN.md); A2 | §§8, 10.7; E-0001..E-0004, E-0007, E-0008(a), E-0009..E-0015 | P001 | A | Engine API only (E-0014): allocation, provisional/permanent states, canonical promotion, renumbering with aliases, stale-lock recovery; branch/collision/cross-process cases | HIGH | CHANGES_REQUESTED |
| P003 Evidence Resolver Contract; A3a | §§3.2, 16.3–16.4 | P001 | A | Generic interface and fingerprint harness; resolver contract tests | HIGH | PLANNED |
| P004 Source Code Resolver; A3b | §§16.3–16.5 | P003 | A | One language adapter; rename, move, stale/broken fixture | HIGH | PLANNED |
| P005 Database Schema Resolver; A3c | §§10.5, 16.4–16.5 | P003 | A | Canonical database fingerprint and observed DE extraction; order/type drift tests | HIGH | PLANNED |
| P006 Evidence Classes and Confidence; A4 | §§14–17 | P004, P005 | A | Facet confidence policy and human override contract; class-crossing tests | HIGH | PLANNED |
| P007 Full `kf validate`; A5 | §§6–10, 16, 26, 36, 42 | P002, P006, P028 | A | Semantic checks, reference integrity, ownership and catalog diagnostics; complete negative suite | CRITICAL | PLANNED |
| P008 Modeling Katas; B6 | §§4–5, 7, 10, App. G | P007 | A | All 18 listed katas in CI; classification fixtures | MEDIUM | PLANNED |
| P009 Normalization and Dedup; B7 | §6.2 | P007 | A | `kf-normalize-v1` and four command gates; locale/collision tests | HIGH | PLANNED |
| P010 Prose Contract and Lint; B8 | §§13, 42 | P009 | A | Markdown/YAML lint and generated block checks; prose fixtures | MEDIUM | PLANNED |
| [P011 Decision Table Logic](phases/P011-decision-table-logic/PLAN.md); C9a | §§11, 12.1; E-0017..E-0022 | P001 | B | Decimal/unit foundation and table evaluator; exhaustiveness cases | HIGH | ACCEPTED |
| [P012 Formula Logic](phases/P012-formula-logic/PLAN.md); C9b | §§11, 12.2; E-0030..E-0033, E-0036 | P011 | B | Expression evaluator and unit algebra; rounding/guard cases | HIGH | IMPLEMENTING |
| P013 State Machine and Narrative Logic; C9c | §§12.3–12.4, 26.3 | P012 | B | Transition checks and narrative verification; negative cases | HIGH | PLANNED |
| P014 Scenario Checking; C10 | §§7.3, 26 | P007, P013 | A | Facet-aware `kf check-rules`; 24-case fixture progression | HIGH | PLANNED |
| P015 Golden Master; C11 | §§16.1, 16.4, 27 | P014 | A | Recording, comparison and observed-only evidence effect; characterized cases | HIGH | PLANNED |
| P016 Change Ledger and Revisions; D12 | §§10.2, 19–22 | P007 | A | Append-only CHG, bitemporal fields and derived revisions; history tests | HIGH | PLANNED |
| P017 Derived Divergences; D13 | §23 | P015, P016 | A | Structural/scenario derivation, stable IDs and preserved disposition; repeat-build tests | CRITICAL | PLANNED |
| P018 Semantic Diff; D14 | §§24–25 | P017 | A | `kf diff` with UNCHANGED and proof labels; negative assertion tests | HIGH | PLANNED |
| P019 Releases and Baselines; D15 | §§19, 21, 30, 41 | P016 | A | CalVer, baselines and sync-status; clean-history cases | HIGH | PLANNED |
| P020 Faceted Graph Build; E16 | §§7, 9.2, 40 | P007 | A | Derived graph and indexes; clean rebuild tests | HIGH | PLANNED |
| P021 Safe Context Packs; E17 | §§18.7, 38 | P020, P006 | A | `kf context` and minimum-budget failure; safe-context cases | HIGH | PLANNED |
| P022 Impact Analysis; E18 | §§25, 39 | P020, P018 | A | Directed impact and labeled negatives; bounded graph cases | HIGH | PLANNED |
| P023 Canonical Agents and Export; E19 | §§45–49 | P021 | A | Provider-neutral definitions, facet permissions and export; permission tests | HIGH | PLANNED |
| P024 Mappings and Verification; F20 | §§16, 28 | P003, P007 | A | Implementation/test mapping anchors and drift verification; mapping cases | HIGH | PLANNED |
| P025 PR Check and Ack; F21 | §29 | P024, P019 | A | `kf pr-check`, append-only ack and GitHub/ADO adapters; PR diff cases | HIGH | PLANNED |
| P026 SME Questions and Interviews; F22 | §§18, 40 | P018, P021 | A | Five-source queue, priorities and interview pack/import; queue cases | HIGH | PLANNED |
| P027 Milestone 1 Integration; G portion required by §56 | §§33–35, 43, 50, 52, 55–56 | P001, P002, P028, P003, P004, P005, P006, P007, P008, P009, P010, P011, P012, P013, P014, P015, P016, P017, P018, P019, P020, P021, P022, P023, P024, P025, P026 | integration | Work item ingestion/refinement, complete §55 fixture and end-to-end CI | CRITICAL | PLANNED |
| [P028 CLI Backbone and Conformance Runner](phases/P028-cli-backbone/PLAN.md); new, supports A5 and §55/§56 item 1 | §§9, 36, 36.1, 37, 42.1, 55, 56 item 1 | P001 | A | `bin/kf.mjs` and `bin` entry; `kf --version`; `kf init` greenfield scaffold; schema-level `kf validate` emitting the §36 envelope and §36.1 exit codes; data-driven `framework/conformance/expected/` runner replacing the hand manifest in `test/p001-schema.test.mjs`; CI on ubuntu and windows. First runnable command and §55 scoreboard harness. Non-goals: semantic rules, catalog completeness, `kf build`, `kf context` | MEDIUM | PLANNED |

Portal, chatbot, Graph DB and webhooks from §53 G require separate future authorization. The P001 fixture is intentionally partial; derived `DIV` files are never populated manually. This roadmap never changes the normative CLI name `kf`.

## Phase registry

| Phase | Status | Plan | Traceability | Handoff | Audit verdict |
|---|---|---|---|---|---|
| P001 | ACCEPTED | [PLAN](phases/P001-core-persistent-model/PLAN.md) | [TRACEABILITY](phases/P001-core-persistent-model/TRACEABILITY.md) | [HANDOFF](phases/P001-core-persistent-model/HANDOFF.md); [REMEDIATION_R01](phases/P001-core-persistent-model/remediation/REMEDIATION_R01.md); [REMEDIATION_R02](phases/P001-core-persistent-model/remediation/REMEDIATION_R02.md) | [R01: CHANGES_REQUESTED](phases/P001-core-persistent-model/audits/CLAUDE_AUDIT_R01.md); [R02: CHANGES_REQUESTED](phases/P001-core-persistent-model/audits/CLAUDE_AUDIT_R02.md); **[R03: ACCEPTED](phases/P001-core-persistent-model/audits/CLAUDE_AUDIT_R03.md)** |
| P002 | CHANGES_REQUESTED | [PLAN](phases/P002-id-registry/PLAN.md); [TRIAGE](phases/P002-id-registry/TRIAGE.md) | [TRACEABILITY](phases/P002-id-registry/TRACEABILITY.md) | [HANDOFF](phases/P002-id-registry/HANDOFF.md); [REMEDIATION_R01](phases/P002-id-registry/remediation/REMEDIATION_R01.md); [BLOCKED_HANDOFF](phases/P002-id-registry/BLOCKED_HANDOFF.md) (history) | [R01: CHANGES_REQUESTED](phases/P002-id-registry/audits/AUDIT_R01.md); [R02: CHANGES_REQUESTED](phases/P002-id-registry/audits/AUDIT_R02.md) |
| P003–P010, P013–P027 | PLANNED | Created when the Foreman opens the phase | — | — | — |
| P011 | ACCEPTED | [PLAN](phases/P011-decision-table-logic/PLAN.md); [TRIAGE](phases/P011-decision-table-logic/TRIAGE.md) | [TRACEABILITY](phases/P011-decision-table-logic/TRACEABILITY.md) | [HANDOFF](phases/P011-decision-table-logic/HANDOFF.md); [REMEDIATION_R01](phases/P011-decision-table-logic/remediation/REMEDIATION_R01.md) | [R01: CHANGES_REQUESTED](phases/P011-decision-table-logic/audits/AUDIT_R01.md); **[R02: ACCEPTED](phases/P011-decision-table-logic/audits/AUDIT_R02.md)** |
| P012 | IMPLEMENTING | [PLAN](phases/P012-formula-logic/PLAN.md); [TRIAGE](phases/P012-formula-logic/TRIAGE.md) | [TRACEABILITY](phases/P012-formula-logic/TRACEABILITY.md) | — | — |
| P028 | PLANNED | [PLAN](phases/P028-cli-backbone/PLAN.md) | Created when the Foreman opens the phase | — | — |
