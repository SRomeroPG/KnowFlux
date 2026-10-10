# Knowledge Framework Strike Team

Development-only coordination layer for the single-vendor Claude Strike Team v2. It is not product source, runtime configuration, or a distributed-package requirement.

## Operating rules

- `PROTOCOL_V2.md` is the operating protocol. `AI_STRIKE_TEAM_BOOTSTRAP.md` is the historical v1 protocol (Codex implements, Claude audits) and is superseded. Codex is retired.
- The Knowledge Framework Core Specification v2.1 is frozen and normative. Semantic gaps are decided by the Foreman in `knowledge-framework-spec-v2.1-errata.md` (repo root); the spec itself is never edited.
- A root Claude session, the Foreman (skill `/knowflux-foreman`), orchestrates Claude implementer agents and independent Claude auditor agents. Only an audit may accept a phase.
- Phase lifecycle: PLANNED, IMPLEMENTING, READY_FOR_AUDIT, AUDITING, CHANGES_REQUESTED, REMEDIATING, REAUDITING, ACCEPTED, BLOCKED_BY_DECISION, STALLED.
- Phase dependencies are a DAG of "needs the artifact of" (see `PHASES.md`). One primary phase at a time; a secondary only from another track and only under the conditions in `PHASES.md`.
- Progress is measured by `SCOREBOARD.md` (executable evidence against spec §55 and §56), not by phase count.
- Process decisions live in `decisions/` (ADR-0001..0004). Keep these artifacts committed with phase work; exclude them from eventual package contents.

## Current position

- P001 is ACCEPTED (audit R03).
- P002 is unblocked and PLANNED. Its blockers are decided by E-0001..E-0004 and E-0007.
- P028 (CLI Backbone and Conformance Runner) is PLANNED.
- Seven errata entries await ratification: E-0001, E-0002, E-0003, E-0004, E-0005, E-0007, E-0008.
- E-0006 (SG-0002) is OPEN and must be decided before P007.
- No `SG-*` file remains an open spec gap; each is resolved or mapped to an errata entry.

## Directory map

- `PROTOCOL_V2.md` — operating protocol (v2).
- `STATE.yaml` — authoritative phase-state record (`schema_version: 2`).
- `PHASES.md` — roadmap DAG, tracks and phase registry.
- `SCOREBOARD.md` — conformance and Milestone 1 progress with executable evidence.
- `ENVIRONMENT.md` — recorded runtime capabilities (Codex section retired).
- `phases/` — one directory per opened phase (PLAN, TRACEABILITY, HANDOFF, audits).
- `spec-gaps/` — SG records; each now resolved by or mapped to an errata entry.
- `decisions/` — ADRs for development-process decisions.
- `future-backlog/` — non-v2.1 ideas only.
- `AI_STRIKE_TEAM_BOOTSTRAP.md` — historical v1 protocol, superseded.
- Repo root: `knowledge-framework-spec-v2.1.md` (frozen), `knowledge-framework-spec-v2.1-errata.md` (Foreman decisions).
