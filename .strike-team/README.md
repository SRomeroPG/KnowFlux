# Knowledge Framework Strike Team

This directory is the development-only coordination layer for the Codex implementation team and the independent Claude audit team. It is not product source, runtime configuration, or a distributed-package requirement.

## Operating rules

- `AI_STRIKE_TEAM_BOOTSTRAP.md` is the adopted operating protocol.
- The Knowledge Framework Core Specification v2.1 is frozen and normative.
- Codex implements and remediates; Claude independently audits and alone may accept a phase.
- A phase begins only after the user explicitly authorizes it and its `PLAN.md` exists.
- Keep these artifacts committed with the phase work; exclude them from eventual package contents.

## Current position

The control plane is bootstrapped. No product phase has been authorized, planned, or implemented.

## Directory map

- `STATE.yaml` — authoritative phase-state record.
- `PHASES.md` — phase registry and handoff index.
- `phases/` — one directory per authorized phase.
- `spec-gaps/` — unresolved frozen-spec decisions that block affected work.
- `future-backlog/` — non-v2.1 ideas only.
- `decisions/` — durable development-process decisions that do not alter the frozen spec.
