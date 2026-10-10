# P002 — ID Registry

## Objective and authorization

Implement §53 A2 after the independently accepted P001. The user invoked `NEXT_PHASE.md` for Phase 2. The frozen v2.1 specification is normative. P002 owns engine allocation from `.kf/id-registry.yaml`, provisional and permanent state, canonical promotion, merge collision behavior, and indefinite alias resolution. It does not implement the full P007 validator or other §53 items.

## Entry gate

- P001 R03 audit says `VERDICT: ACCEPTED`, zero required findings, audited handoff commit `48348f2d62a61055f5aa96287b4cce3409f9e8dc` and product remediation commit `c738bd6675bb44c80ef890daf28b335718fbe9c5`.
- `STATE.yaml` and `PHASES.md` agree that P001 is accepted. Working tree is clean at `6077003` before phase work.
- SG-0001..SG-0005 are resolved or mapped by errata E-0001..E-0005 and E-0007; E-0006 (address grammar) does not affect P002. P001 R03 advisories do not require P002 changes.

## Normative coverage

| Source | Contract |
|---|---|
| §8 | `<PREFIX>-<NNNN>` with four-digit minimum, expandable without changing old IDs; unique, non-reusable, name-independent. |
| §8.1 | Agents do not assign IDs. Engine allocates from `.kf/id-registry.yaml` under a transactional lock. |
| §8.2 | Noncanonical `kf create` allocates provisional; `kf validate` promotes on canonical entry. Only two provisional colliders may be resolved automatically; later `first_canonical_commit` is renumbered and `id_alias` recorded. Permanent IDs are immutable; a permanent collision yields `KF-E-101` and manual resolution. Aliases resolve in all queries indefinitely. |
| §§9, 9.1 | Registry lives under project `.kf/`; operational material is command-written and append-only. |
| §10 entity shapes | `id_status` is `provisional` or `permanent`; P001 schemas accept the field. |
| §19.1 | Canonical branch first appearance defines transaction time; branch history before canonical entry does not. |
| §42.2 | `KF-E-101` is the permanent ID collision diagnostic. |
| §55 | Add the P002 feature slice to the growing conformance fixture with independently stated expectations. |

## Deliverables and boundary

1. A project-local, text-readable registry format and engine allocation/promotion API with deterministic behavior and transactional filesystem locking.
2. A narrow `kf` CLI surface for P002 allocation and promotion, keeping the normative command name. Only ID semantics are handled; full entity creation and full semantic validation remain later phases.
3. Collision and alias behavior to the extent the frozen spec defines it. Any irreducible ambiguity is reported as `DECISION_NEEDED`; the Foreman decides it in the errata.
4. Positive, negative, branch, collision, concurrency, non-reuse, and repeat-run tests plus the P002 conformance slice. Maintain `TRACEABILITY.md` as executable evidence develops.

## Design constraints

- Never change a permanent ID or reissue any reserved ID. Registry operations must be atomic against simultaneous allocators and interrupted writes.
- Promotion must use the configured canonical branch, not a hardcoded `main`. Do not infer canonical entry from local wall-clock time.
- A rename of the entity name must not affect its ID.
- Registry and fixture remain human-readable YAML. `.strike-team/` is excluded from product/package content.
- No address grammar, cross-file reference rewrite, or general query parser is invented; SG-0002 remains for later phases.
- No broad `kf validate`, evidence, confidence, graph, CHG, or release work is pulled forward.

## Implementation sequence

1. Independently inspect §8 edge cases and decide whether the existing text determines a safe registry and alias contract. File a gap if not.
2. Implement unaffected allocation and canonical-state behavior behind bounded interfaces; add P002 fixture records and tests together.
3. Implement only collision/alias behavior determined by the spec or a binding user/spec decision. Keep affected behavior stopped for any open gap.
4. Run targeted tests, all tests, build/typecheck/lint, deterministic repeat checks, and adversarial review of filesystem races and immutable IDs. Inspect actual diff and working tree.
5. If complete, commit product and plan/traceability, write `HANDOFF.md`, transition to `READY_FOR_AUDIT`, commit control-plane handoff, and the Foreman audits. If a decision blocks P002 completion, record it and set `BLOCKED_BY_DECISION` without claiming audit readiness.

## Verification targets

- Allocation starts at the minimum four-digit sequence per prefix and crosses 9999 without disturbing old IDs; allocation never reuses consumed IDs, including failed or renamed entities.
- Noncanonical allocation yields provisional; canonical creation and canonical entry yield permanent only when justified by Git canonical history.
- Simultaneous attempts cannot return the same ID; a stale lock and interrupted write cannot silently corrupt the registry.
- Two provisional colliders and a permanent collision have distinct outcomes. A permanent collision leaves persisted identity intact and reports `KF-E-101`.
- Aliases persist and resolve in every P002 query surface; cycles and ambiguity are rejected deterministically.

## Risk and ownership

HIGH: this phase establishes permanent identifiers and branch merge semantics. The lead owns interpretation, production code, integration, and handoff. A read-only spec analyst may challenge interpretation; independent conformance or integration review may be used when it improves coverage. No simultaneous overlapping edits.

## Exit criteria

All P002 contracts are implemented or a blocking spec gap is recorded. A completed phase requires the conformance slice, traceability, checks, adversarial review, exact product commit, and `HANDOFF.md`. The Foreman decides acceptance after an independent audit round.

## Current result (updated 2026-10-09)

P002 is `PLANNED` again. The contracts that blocked it are now decided in `knowledge-framework-spec-v2.1-errata.md`:

- E-0001 (resolves SG-0005): the canonical branch.
- E-0002 and E-0003 (resolve SG-0003): provisional collision tie-break and alias.
- E-0004 (resolves SG-0004): continuity; `promote` records the path; `move` event.
- E-0007: `.kf/id-registry.yaml` is committed with merge=union; the lock file is ignored.

The tested engine module and fixture (`framework/engine/id-registry.mjs`) cover only fresh-project provisional allocation and conservative collision detection. Remaining work:

- Revise the persistent registry contract as needed; implement and test canonical promotion, both collision paths, alias resolution and lifetime non-reuse, `kf create`/`kf validate` integration, the complete P002 fixture slice, and a full adversarial rerun.
- Stale-lock recovery: lock owner file with pid, host and timestamp, and a stale threshold.
- `EPERM`/`EBUSY` rename retry on Windows.
- One cross-process allocation test.
- Injectable lock deadline.
- Update traceability to PASS only with executable evidence. Then follow the normal handoff: write `HANDOFF.md`, set `READY_FOR_AUDIT`, and stop for the independent audit. No `HANDOFF.md` or `READY_FOR_AUDIT` claim is warranted yet.
