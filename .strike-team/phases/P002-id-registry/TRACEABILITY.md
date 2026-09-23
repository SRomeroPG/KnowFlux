# P002 normative traceability

`PARTIAL` means the cited code and tests prove only the listed subset; P002 is not complete. `BLOCKED` identifies a genuine missing semantic decision. No row is presented as Claude-accepted.

| ID / spec | Requirement | Implementation artifact | Executable evidence | Status |
|---|---|---|---|---|
| I01 §8 | IDs use a known prefix, at least four decimal digits, grow without renumbering, are unique and never reused. | `framework/engine/id-registry.mjs` uses a monotone per-prefix event log; SG-0004 limits identity-continuity proof | `test/p002-id-registry.test.mjs` concurrent allocation, 9999 boundary, missing/corrupt registry | PARTIAL |
| I02 §8.1 | Only the engine allocates from `.kf/id-registry.yaml` under a transactional lock. | `initializeIdRegistry` and `allocateId`; no `kf create` integration yet | lock timeout and concurrent allocation tests | PARTIAL |
| I03 §8.2 | Branch-created IDs are provisional; canonical-entry validation promotes to permanent. | allocation returns provisional; promotion stopped by [SG-0004](../../spec-gaps/SG-0004.md) and [SG-0005](../../spec-gaps/SG-0005.md) | feature-branch provisional test; no promotion assertion | BLOCKED |
| I04 §8.2 | Only two provisional colliders may be automatically resolved; later `first_canonical_commit` is renumbered with `id_alias`. | [SG-0003](../../spec-gaps/SG-0003.md) | Simultaneous canonical-entry and shared-old-ID alias counterexamples | BLOCKED |
| I05 §§8.2, 42.2 | Permanent IDs never renumber; collision with permanent yields `KF-E-101` and manual resolution. | conservative pre-allocation collision guard; no renumber API | permanent record and interrupted-write-state negatives | PARTIAL |
| I06 §8.2 | `id_alias` resolves in all queries indefinitely. | [SG-0003](../../spec-gaps/SG-0003.md) | Shared-old-ID alias counterexample | BLOCKED |
| I07 §§9, 9.1 | Registry is project-local operational data under `.kf/`, command-written and append-only. | `.kf/id-registry.yaml` event log written by engine API | fixture-created registry and repeat allocation; no mutation of prior events by API | PARTIAL |
| I08 §10 | Entity `id_status` is provisional or permanent. | P001 common schema; allocation returns provisional | P001 schema tests and P002 feature-branch test; no automatic entity writing | PARTIAL |
| I09 §19.1 | Canonical first appearance, rather than feature-branch history, determines canonical entry. | [SG-0004](../../spec-gaps/SG-0004.md), [SG-0005](../../spec-gaps/SG-0005.md) | no canonical promotion test | BLOCKED |
| I10 §55 | Implement feature with its conformance fixture portion. | `framework/conformance/p002-id-registry.yaml` covers safe allocation subset | P002 fixture test | PARTIAL |

## Explicit deferrals

- Full `kf validate` catalog and cross-document reference integrity: P007.
- Generic `kf create` for complete entity construction and `kf-normalize-v1`: later phases P009/P027, except any narrow P002 ID allocation surface.
- Address grammar and scope/target canonicalization: SG-0002 and later phases.
- Git transaction-time and bitemporal revision derivation beyond canonical-entry evidence: P016.
