# Foreman Log

Append-only. One entry per Foreman action (timestamp, phase, action, commit SHA, agents used). "Needs human eyes" is kept current at the top. Protocol: `.strike-team/PROTOCOL_V2.md` §10; format: `.claude/skills/knowflux-foreman/SKILL.md` §7.

## Needs human eyes

- E-0003 (alias resolution when the old ID stays live): DECIDED_BY_FOREMAN, MEDIUM reversibility, persistent-format effect (aliases). Affects P002, P007, P021, P022.
- E-0004 (identity continuity for permanent IDs): DECIDED_BY_FOREMAN, MEDIUM reversibility, persistent-format effect (`promote` path record, `move` event). Affects P002, P007.
- E-0007 (`.kf/id-registry.yaml` versioning and merge policy): DECIDED_BY_FOREMAN, MEDIUM reversibility, persistent-format effect (registry file). Affects P002, P028.
- E-0006 (address grammar for observed targets and scope values): OPEN, HIGH reversibility. Decide before P007. Affects P007, P014, P016, P017, P020-P022, P024.

## Log

## 2026-10-09 protocol v2 adoption

Protocol v2 adopted; P002 unblocked; P028 planned; SG-0001..0005 resolved via errata; infra: CI, Node pin, registry merge policy.
