# P002 blocked handoff

## Status

`BLOCKED_BY_SPEC_GAP`. This is a partial implementation checkpoint, not a `CODEX_HANDOFF.md`, and P002 is not ready for Claude acceptance. No subsequent phase is authorized.

## Safe completed subset

- `framework/engine/id-registry.mjs` initializes a fresh project's `.kf/id-registry.yaml` and allocates provisional IDs through an exclusive directory lock and atomic file replacement.
- Allocation uses the 11 core prefixes, starts with four digits, grows past 9999, and never reissues an ID present in the retained registry. It refuses missing/corrupt registries and existing unregistered entities.
- Duplicate provisional records stop allocation without mutating the registry. A duplicate containing a permanent record or permanent registry state reports `KF-E-101`.
- `framework/conformance/p002-id-registry.yaml` states the independently expected allocation slice; `test/p002-id-registry.test.mjs` exercises it and negative/race cases.

## Blocked contracts requiring a binding semantic decision

1. [SG-0003](../../spec-gaps/SG-0003.md): simultaneous canonical-entry tie and ambiguous alias from an ID that remains live on the surviving entity.
2. [SG-0004](../../spec-gaps/SG-0004.md): no general proof that a later entity with the same ID is the original entity rather than illicit reuse after delete/recreate. An unsafe promotion implementation was removed after independent review reproduced permanent-ID reuse.
3. [SG-0005](../../spec-gaps/SG-0005.md): no authoritative source for the Knowledge Repository canonical branch that `kf validate` must use to promote IDs.

The partial engine has no promotion, collision renumbering, alias query, or `kf create`/`kf validate` CLI integration. The event-log format is a provisional implementation artifact; the semantic decisions may require changes to it before any permanent ID is recorded.

## Verification and internal review

- `node --test test/p002-id-registry.test.mjs`: 7/7 passed after unsafe promotion removal.
- `npm run lint`: passed after unsafe promotion removal.
- `npm test`: 152/152 passed. `npm run build` and `npm run typecheck`: compiled 19 schemas. `npm run lint`: passed. `git diff --check`: passed.
- Independent integration review found permanent-ID reuse, a wrong permanent-collision outcome after interrupted promotion, and leakage of a control-plane gap ID into runtime diagnostics. The unsafe promotion path was removed; collision detection now consults registry permanence; the runtime uses an internal `UNRESOLVED_COLLISION` code rather than a spec-gap ID.

## Remaining work after a decision

Revise the persistent registry contract as needed; implement and test canonical promotion, both collision paths, alias resolution and lifetime non-reuse, `kf create`/`kf validate` integration, the complete P002 fixture slice, and a full adversarial rerun. Update traceability to PASS only with executable evidence. Then follow the normal two-commit audit handoff process.
