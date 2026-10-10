# Specification Gaps

An `SG-xxxx.md` records a point where the frozen spec (`knowledge-framework-spec-v2.1.md`) is silent, ambiguous, or self-contradictory and the choice affects behavior or persistent format. It is the discovery record; it does not decide anything.

## Lifecycle

1. **Discovered**: any implementer or auditor writes `SG-xxxx.md` (sections: Discovered in, Relevant spec sections, Missing semantic decision, Why implementation cannot proceed safely, Concrete alternatives, Affected workstreams, Unaffected work that may continue). Affected work stops at `BLOCKED_BY_DECISION`; unaffected work continues.
2. **Decided**: the Foreman writes an entry in `knowledge-framework-spec-v2.1-errata.md` (options, rationale, reversibility) and appends a `## Resolution` section here pointing to it (`RESOLVED → E-xxxx` or `OPEN → E-xxxx`). The original SG text is never rewritten.
3. **Ratified**: the human reviews asynchronously. The errata status moves `DECIDED_BY_FOREMAN` → `RATIFIED` or `REJECTED`. A rejection becomes a remediation task.

## Rules

- Resolutions live in the errata, never in this directory or in code comments.
- Create an SG only for a real gap, not for ordinary defects or to avoid reading the spec.
- Once a decision exists, implementation and audit cite `E-xxxx`, not `SG-xxxx`. An `OPEN` entry blocks its listed phases.
- An SG is never deleted; superseded or rejected decisions stay visible in the errata.
