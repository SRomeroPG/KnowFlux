# P002 — ID Registry

## Objective and authorization

Implement §53 A2 after the independently accepted P001. The user invoked `NEXT_PHASE.md` for Phase 2. The frozen v2.1 specification is normative. P002 owns engine allocation from `.kf/id-registry.yaml`, provisional and permanent state, canonical promotion, merge collision behavior, and indefinite alias resolution. It does not implement the full P007 validator or other §53 items.

## Entry gate

- P001 R03 audit says `VERDICT: ACCEPTED`, zero required findings, audited handoff commit `48348f2d62a61055f5aa96287b4cce3409f9e8dc` and product remediation commit `c738bd6675bb44c80ef890daf28b335718fbe9c5`.
- `STATE.yaml` and `PHASES.md` agree that P001 is accepted. Working tree is clean at `6077003` before phase work.
- SG-0001 and SG-0002 do not affect P002. P001 R03 advisories do not require P002 changes.

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
3. Collision and alias behavior to the extent the frozen spec defines it. Any irreducible ambiguity becomes a numbered `SPEC_GAP`; stop that workstream rather than choose a persistent contract.
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
5. If complete, commit product and plan/traceability, write `CODEX_HANDOFF.md`, transition to `CODEX_READY_FOR_AUDIT`, commit control-plane handoff, and stop for Claude. If a gap blocks P002 completion, record the gap and set `BLOCKED_BY_SPEC_GAP` without claiming audit readiness.

## Verification targets

- Allocation starts at the minimum four-digit sequence per prefix and crosses 9999 without disturbing old IDs; allocation never reuses consumed IDs, including failed or renamed entities.
- Noncanonical allocation yields provisional; canonical creation and canonical entry yield permanent only when justified by Git canonical history.
- Simultaneous attempts cannot return the same ID; a stale lock and interrupted write cannot silently corrupt the registry.
- Two provisional colliders and a permanent collision have distinct outcomes. A permanent collision leaves persisted identity intact and reports `KF-E-101`.
- Aliases persist and resolve in every P002 query surface; cycles and ambiguity are rejected deterministically.

## Risk and ownership

HIGH: this phase establishes permanent identifiers and branch merge semantics. The lead owns interpretation, production code, integration, and handoff. A read-only spec analyst may challenge interpretation; independent conformance or integration review may be used when it improves coverage. No simultaneous overlapping edits.

## Exit criteria

All P002 contracts are implemented or a blocking spec gap is recorded. A completed phase requires the conformance slice, traceability, checks, adversarial review, exact product commit, and Codex handoff. Claude alone decides acceptance.

## Current result

P002 is `BLOCKED_BY_SPEC_GAP`. [SG-0003](../../spec-gaps/SG-0003.md) blocks collision renumbering and aliases. [SG-0004](../../spec-gaps/SG-0004.md) blocks safe permanent promotion and lifetime non-reuse across deletion/recreation. [SG-0005](../../spec-gaps/SG-0005.md) blocks automatic identification of the Knowledge Repository's canonical branch. The tested engine module and fixture cover only fresh-project provisional allocation and conservative collision detection. No completed-phase `CODEX_HANDOFF.md` or `CODEX_READY_FOR_AUDIT` claim is warranted.
