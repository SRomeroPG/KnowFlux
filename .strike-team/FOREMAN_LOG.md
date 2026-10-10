# Foreman Log

Append-only. One entry per Foreman action (timestamp, phase, action, commit SHA, agents used). "Needs human eyes" is kept current at the top. Protocol: `.strike-team/PROTOCOL_V2.md` §10; format: `.claude/skills/knowflux-foreman/SKILL.md` §7.

## Needs human eyes

- E-0003 (alias resolution when the old ID stays live): DECIDED_BY_FOREMAN, MEDIUM reversibility, persistent-format effect (aliases). Affects P002, P007, P021, P022.
- E-0004 (identity continuity for permanent IDs): DECIDED_BY_FOREMAN, MEDIUM reversibility, persistent-format effect (`promote` path record, `move` event). Affects P002, P007.
- E-0007 (`.kf/id-registry.yaml` versioning and merge policy): DECIDED_BY_FOREMAN, MEDIUM reversibility, persistent-format effect (registry file). Affects P002, P028.
- E-0009 (`first_canonical_commit` = earliest first-parent commit containing the entity; ordering by first-parent index), MEDIUM, persisted in registry. Affects P002, P007, P016.
- E-0011 (`id_status` kept in entity; `id_alias` string list added to `entityBase` schema), MEDIUM, schema change. Affects P002, P007.
- E-0012 (registry: one flow-mapping event per line; duplicate provisional allocations tolerated; refines E-0007), MEDIUM, persistent format. Affects P002, P007, P028.
- E-0015 (renumber order and `alias.commit`; empty registry written as bare `events:`), MEDIUM, persisted bytes. Affects P002, P007, P028.
- E-0006 (address grammar for observed targets and scope values): OPEN, HIGH reversibility. Decide before P007. Affects P007, P014, P016, P017, P020-P022, P024.

## Log

## 2026-10-09 protocol v2 adoption

Protocol v2 adopted; P002 unblocked; P028 planned; SG-0001..0005 resolved via errata; infra: CI, Node pin, registry merge policy.

## 2026-10-10T00:00Z run start — primary P002, secondary none

Baseline at 8dee230: build ok, lint ok, test 152/152.

## 2026-10-10 P002 triage and plan

- kf-spec-triage (sonnet): 11 items. Decided T-01..T-08 as E-0009..E-0014; T-09 deferred to P007 (`ids.padding`); T-10 deferred to P021/P022; T-11 record-only (E-0008(a)).
- kf-phase-planner (sonnet): PLAN rewritten to v2 (55 verification targets, engine API contract), TRIAGE.md, TRACEABILITY skeleton. Planner raised D-01..D-05; decided as E-0015.
- Foreman spot-checked PLAN quotes at l.300, l.304, l.371, l.1742 against the spec: verbatim.
- Status P002: PLANNED -> IMPLEMENTING.
