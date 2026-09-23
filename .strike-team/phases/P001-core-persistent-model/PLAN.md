# P001 — Repository Foundation + Core Persistent Model

## Objective
Establish the human-readable persistent contract before any engine behavior: JSON Schemas for all 11 Core types, separate specified and observed facet schemas for BP, BR and DE, and an executable P001 conformance slice. This is §53 Phase A item 1 only.

## Normative specification coverage
- §0.1: machine identifiers, field names, states, codes and commands use English.
- §§4.1–4.3, 10.5: exactly 11 core entity types; only BP, BR and DE are faceted; DEC/CON are BR kinds, not types.
- §§5.1, 6.1, 7.1–7.2: BR identity and cardinality; single owner for authored edges; inverse relationships SHALL NOT be authored.
- §§9–10: text layout, greenfield specified mapping or list, observed separate files, no observed version, distinct facet payloads and reference shapes, no legacy truth states.
- §§10.8, 14–16.3, 17.3, 18.1–18.2: field ownership, lifecycle/confidence enums, evidence class direction, fact/interpretation and dispute addresses.
- §§19–23, 26: authorable valid/decision time, CHG targets specified facets, DIV split ownership and no duplicated statement, SC observed target requirement.
- §§11–12: structural grammar of logic and numeric representations where determinable in JSON Schema. Evaluation semantics belong to later phases.
- §§42.1, 53–55: schemas in `framework/schemas/`, schema version 2.1, text-readable KB, partial conformance fixture evolved with features.

## Deliverables
1. `framework/schemas/` JSON Schema Draft 2020-12 documents for each core type and separate facet classes, with reusable definitions where safe.
2. Minimal single-project tooling for schema compilation/validation and deterministic fixture tests; no cloud or service dependency.
3. Representative authored YAML in `framework/conformance/acme-formulation/` with all 11 types and faceted examples, plus independent invalid cases and test expectations.
4. Normative traceability matrix and explicit deferrals for cross-document/engine checks.

## In scope
- Syntax, required structural fields stated by the spec, fixed enums, typed references where syntax is determinate, edge ownership, faceted versus non-faceted shapes, and authored/derived field locations.
- Both greenfield inline `specified` mapping and specified list; observed facets as separate YAML documents.
- Observed-only identities during discovery (§§31, 40), even though §10.1 sketches the common specified-first multiplicity.
- Structural schema validation and tests. A schema may recognize engine-owned persisted fields without claiming to prove author provenance.

## Out of scope
- §53 A2–A5 and B–G implementations: ID allocation, EvidenceResolver, confidence computation, full `kf validate`, logic evaluation, graph, CHG workflow, DIV derivation, portal, chatbot and provider integrations.
- Cross-file overlap/uniqueness, reference existence, evidence freshness/class matching, generated-field provenance and append-only Git history. These need later engine checks.
- Final §55 counts and generated outputs. No `DIV` is manually populated in the fixture.

## Dependencies
Bootstrap completed; frozen Core Specification v2.1; authorized P001. No product package or stack exists yet.

## Risk classification
HIGH. Persistent schema and facet errors cause expensive migrations and false truth claims.

## Planned agent delegation
- Spec analyst: independent read-only normative extraction and gap identification.
- Schema engineer: design then bounded ownership of `framework/schemas/`.
- Conformance engineer: independent ownership of `framework/conformance/` and schema fixture tests.
- Integration engineer: read-only adversarial review after implementation if needed.
The lead owns roadmap, planning, scaffolding, integration, verification, traceability, and handoff. No overlapping file edits.

## Engineering choices before implementation
- Use one repository and one schema tree. Draft 2020-12 `$ref` composition; avoid premature package splits.
- Use local Node tooling (available in the environment) for offline schema tests and YAML parsing; no runtime cloud requirement. Exact package choices and commands are recorded in the handoff after implementation.
- Keep source YAML hand-readable. `framework/conformance/acme-formulation/` is a growing project fixture, not a generated snapshot.
- Where the frozen spec leaves a payload open, validate only normative facts and document the unconstrained portion. Do not declare an unstated field or value mandatory.

## Verification plan
- Compile every schema and validate a representative positive corpus for each type and both facet classes.
- Negative cases: inverse edges, wrong facet fields, nonfaceted entity with facets, invalid lifecycle/confidence/kind, observed version, obsolete truth state, wrong SC target, wrong CHG facet, bare EV support of a faceted entity, and duplicate authored/derived truth where JSON Schema can detect it.
- Repeat validation for deterministic result ordering. Run build, typecheck and lint or equivalent project checks from a clean state.
- Independent adversarial review against §§4, 7, 10, 16, 22, 23, 26 and 42, then fix findings and rerun.

## Conformance fixture changes required
Create only the §55 skeleton and P001 representative records for 11 core entities and BP/BR/DE facet shapes. Later phases add the required final counts, evidence states, evaluator outputs and derived artifacts. Expected validity is specified independently from implementation behavior.

## Entry criteria
P001 explicitly authorized; `STATE.yaml` is `PLANNED`; working tree baseline recorded; frozen spec and protocol read; specialist roles configured.

## Exit criteria
All P001 schemas and fixture tests pass; traceability is current; internal review issues resolved; `CODEX_HANDOFF.md` records exact scope, checks, SHA and working tree; `STATE.yaml` is `CODEX_READY_FOR_AUDIT`. Claude alone may accept the phase.

## Known spec gaps
- [SG-0001](../../spec-gaps/SG-0001.md) concerns a later scenario-count validator, so does not block P001.
- [SG-0002](../../spec-gaps/SG-0002.md) was discovered in Claude audit R01 and concerns later observed-target and scope-address parsing. P001's open target/scope maps leave the decision unresolved without blocking this phase.
- DE field/persistence payload grammar is not fully prescribed. P001 leaves those payload details open rather than introducing an unstated product contract. CAP/OUT roots are closed to common entity fields because the specification places their descriptive prose in Markdown and defines no additional YAML payload.
