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

## 2026-10-10 P002 conformance decisions; P011 triage (secondary, Track B)

- kf-conformance-engineer (sonnet) raised 2 DECISION_NEEDED on P002 resolveId/id_alias; decided as E-0016 (LOW). Engineer re-briefed (same instance) to tighten F-R4/F-E4.
- kf-spec-triage (sonnet) on P011: 12 items. T-01..T-11 decided as E-0017..E-0021; T-12 record-only (KF-E-313 belongs to P012). P011 opened as secondary on Track B (disjoint paths; implementer will run in a worktree).

## 2026-10-10 P002 conformance slice; P002 implementer R01 started; P011 plan

- P002: conformance slice committed 5fce77d (63 todo cases, written at 8d73627 before implementer code). kf-implementer R01 briefed (running).
- P011: kf-phase-planner (sonnet) wrote PLAN (40 targets), TRIAGE, TRACEABILITY. Planner raised D-01..D-08; decided as E-0022, which amends E-0019: top-level `when: {}` is an unconditional non-default row (the accepted P001 schema and fixture use it). P011 PLANNED -> IMPLEMENTING as secondary; its implementer will run in a worktree.

## 2026-10-10 P002 implement R01 -> READY_FOR_AUDIT

- kf-implementer (sonnet) R01: engine rewritten (id-registry.mjs + 5 helpers), `id_alias` schema field, 55 unit tests. DECISION_NEEDED DN-1/DN-2 and the stale-lock break mechanism decided as E-0023.
- Conformance engineer flipped PENDING; slice enforced: 64/64.
- Foreman verification at 6e5ac16: build ok (19 schemas), lint ok on framework/scripts/test (see incident below), npm test 413 tests, 265 pass, 0 fail, 148 todo (P011), git diff --check clean, boundaries ok.
- Product commit 6e5ac16 `P002 implement ID registry engine`.
- Incident (infra, ADVISORY): `npm run lint` (`eslint .`) scans agent worktrees under `.claude/worktrees/`, where the globals block does not apply, giving 24 spurious errors while a worktree exists; `.claude/worktrees/` is also untracked-but-not-ignored. Fix through an implementer round that is authorized to touch eslint config and `.gitignore` (add ignores for `.claude/worktrees/`). Until then the Foreman lints `framework scripts test eslint.config.js` explicitly.

## 2026-10-10 P011 implement R01 -> READY_FOR_AUDIT; P002 audit R01 in progress

- P011 kf-implementer (sonnet, worktree) R01: 6 engine modules, 92 unit tests; 145/148 conformance at first, 3 failures traced to 2 mis-encoded rows in `regex.yaml` (single-quoted YAML backslashes). Foreman adjudicated for the PLAN text; conformance engineer fixed the rows (5712486), then enforced the slice (149/149).
- Implementer's fail-closed choices on TRIAGE N-xx items accepted as within the PLAN's latitude (listed in P011 HANDOFF).
- Foreman verification at dad4d5a on main: build ok, lint ok, npm test 505/505, git diff --check clean. Product commit dad4d5a. Worktree removed after confirming byte-identical copies; `npm run lint` clean again.
- P002 audit R01: spec-compliance and algorithm-determinism auditors returned; Foreman reproduced F01/D02 (id_alias erased after move), F02 (alias renumbering a permanent holder accepted) and D01 (union merge of two idempotent promotions -> duplicate promote -> INVALID_REGISTRY). D01 is a defect in E-0012 itself; decided E-0024 (amends E-0012/E-0016; canonical ref resolution). test-conformance auditor still running.

## 2026-10-10 P011 audit R01 -> CHANGES_REQUESTED

- Auditors: spec-compliance, algorithm-determinism, test-conformance (sonnet, fresh, blind pass confirmed).
- 11 REQUIRED findings: F01 HIGH regex compile hang on zero-width nested repeats; F02 MEDIUM class-copy compile cost; F03 MEDIUM overlap proof ignores absent inputs (E-0025); F04-F06 LOW (E-0019/E-0025 unit rule, binding ambiguity, escape whitelist); F07-F11 test gaps proven by surviving mutants. Foreman reproduced F01, F02, F03 and confirmed F07/F09 fixture gaps.
- Errata decided: E-0025 (amends E-0020, clarifies E-0019), E-0026.
- Remediation: fresh conformance engineer first (new cases), then fresh implementer.
- `consecutive_failed_rounds` is now tracked per phase in STATE.yaml.

## 2026-10-10 P002 audit R01 -> CHANGES_REQUESTED

- Auditors: spec-compliance, algorithm-determinism, test-conformance (sonnet, fresh, blind pass confirmed). Architecture and integration-regression auditors deferred to R02.
- 10 REQUIRED findings: F01 MEDIUM union merge of idempotent promotions invalidates the registry (defect in E-0012; fixed by E-0024); F02 MEDIUM id_alias erased after move; F03/F04 LOW (permanent renumber accepted; canonical ref = any revision, tag shadows branch); F05-F10 test gaps (surviving mutants) and E-0024 cases. Foreman reproduced F01-F04.
- Remediation: fresh conformance engineer first, then fresh implementer.

## 2026-10-10 P002 remediate R01 -> hand off R02

- Fresh kf-conformance-engineer: 21 tests / 10 case keys for F01-F10 (bb0e79e), 11 red before the fix. Six residual readings decided as E-0028.
- Fresh kf-implementer (remediation): F01-F04 fixed under E-0024/E-0028; 22 unit tests in test/p002-remediation.test.mjs (12 red on the old engine). Product commit 08b3910.
- Foreman verification: P002 test files + conformance 162/162; lint clean on P002 paths; the four R01 reproductions (repro-d01, repro-p002 F01/F02, repro-d03) now show the corrected behavior.
- Errata E-0027 (P011 remediation readings) and E-0028 committed with this handoff.
