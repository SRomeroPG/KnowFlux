# Codex Implementation Handoff — P001

## Phase and audit target

P001, Repository Foundation + Core Persistent Model, implements Core Specification v2.1 §53 Phase A item 1 only. It is ready for an **independent Claude audit**, not accepted.

Implementation commit: `3ef4d86c5e37623e4e22bcadf8550d0ca66d6fc9` on `main`. This commit contains every product/schema/test change, the roadmap, plan, traceability, and SG-0001. The subsequent handoff commit changes only `.strike-team/STATE.yaml`, `.strike-team/PHASES.md`, and this file; audit the implementation commit for code and use the handoff commit for current control-plane state. Working tree was clean immediately after the implementation commit and is expected to be clean after committing this handoff.

## Exact implementation scope

- 11 Draft 2020-12 core entity JSON Schemas in `framework/schemas/` for CAP, BP, BR, DE, OUT, SC, EV, UNK, CHG, DIV, and DSP; six separate BP/BR/DE specified and observed facet schemas; `common.schema.json` and `logic.schema.json` composition.
- Structural enforcement of `schema_version: 2.1`, faceted versus nonfaceted types, specified mapping/list, observed files, BR identity/governs, BP parent/execution-edge ownership, DE fields/persistence, no observed version, inverse-edge exclusion, EV class/support direction, CHG specified targets, SC observed target, DSP facet address, DIV split sections and no `statement`, fixed enums and logic shapes.
- Minimal local Node scaffold: schema compilation, YAML fixture tests, lint, lockfile and ignored local dependencies. There is no CLI or engine behavior in P001; the normative future binary remains `kf`.
- Partial §55 Acme conformance project with 18 authored YAML records and five invalid YAML records. `DIV` is tested as a synthetic derived object in memory; the project contains no hand-authored divergence file.

## Normative clauses covered

The individual SHALL/SHALL NOT mapping and evidence are in [TRACEABILITY.md](TRACEABILITY.md). Primary P001 clauses: §§0.1, 4.1–4.3, 5.1, 6.1 (identity location), 7.1–7.2, 7.3 R2, 9–10, 11–12 (structural shapes only), 14–16.3 (persistent shapes and facet routing), 18.1–18.2, 19–23 (persistent shapes), 26 (asserts shape), 42.1, 53 A1, 54–55. Rows marked `DEFERRED` identify cross-file or engine behavior assigned to a later §53 phase.

## Architecture and scaffolding choices

- One repository, one schema system, `private` npm project; no early package split or required database/server/cloud service.
- Ajv Draft 2020-12 validates JSON Schema; `yaml` parses the human-readable fixture; Node's built-in test runner provides conformance tests. `npm run typecheck` compiles the schema contracts because P001 has no TypeScript application.
- Persisted derived fields are accepted in their documented locations and types. JSON Schema alone cannot distinguish engine-written values from a human edit; `KF-E-050` provenance checks belong to P007. Root/facet authored inverse fields and legacy truth states are rejected where schema structure can determine them.
- Underdefined CAP/OUT descriptive payloads and DE field/persistence internals remain open except for normative boundaries. The schemas do not add unapproved business semantics. Observed-only identities are allowed to support discovery and `observed_without_specified` (§§31, 40).

## Files created or changed

- Control plane: `.strike-team/PHASES.md`, `.strike-team/STATE.yaml`, `phases/P001-core-persistent-model/{PLAN,TRACEABILITY,CODEX_HANDOFF}.md`, `spec-gaps/SG-0001.md`.
- Schemas: `framework/schemas/{capability,business-process,business-rule,data-entity,outcome,scenario,evidence,unknown,change,divergence,dispute}.schema.json`; `{business-process,business-rule,data-entity}-{specified,observed}.schema.json`; `common.schema.json`; `logic.schema.json`.
- Fixtures: `framework/conformance/acme-formulation/README.md`, its `knowledge/**/*.yaml` and `changes/CHG-0001.yaml`; `framework/conformance/invalid/p001/*.yaml`.
- Tooling/tests/docs: `package.json`, `package-lock.json`, `eslint.config.js`, `scripts/check-schemas.mjs`, `test/p001-schema.test.mjs`, `.gitignore`, `README.md`.

## Tests and commands run

| Command | Result |
|---|---|
| `npm ci` | Exit 0; local install from lockfile; 0 reported vulnerabilities. |
| `npm run build` | Exit 0; all 19 JSON Schemas compiled under Ajv strict mode. |
| `npm run typecheck` | Exit 0; all 19 schema contracts compiled. |
| `npm run lint` | Exit 0; ESLint clean. |
| `npm test` | Exit 0; 74/74 tests pass, including positive corpus, negative YAML, 16-name inverse matrix across authored roots, and repeated diagnostic determinism. |
| `git diff --cached --check` | Exit 0 before the implementation commit. |

The independent conformance specialist authored the fixture/tests. A separate read-only integration specialist found that `covered_by` was accidentally allowed on CAP, reproduced it, and confirmed the schema and inverse-matrix regression fix. The lead also reviewed all schema files, the fixture, test code, staged diff, and clean-install output.

## Conformance fixture status

P001 slice: 1 CAP, 1 BP with specified and observed, 2 BR (one mapping, one list/future/narrative), 2 DE (one observed-only discovery identity), 1 OUT, 2 SC, 2 EV, 1 UNK, 1 DSP, 1 CHG; synthetic in-memory DIV shape. Final §55 counts, resolver states, rule evaluation, generated DIVs, graph, context, impact, diff, release and expected output snapshots are owned by later phases. The source remains readable as YAML in a text editor.

## Known limitations and SPEC_GAPs

- P001 has only structural schema validation. Cross-file reference existence, specified scope/validity overlap, duplicate observed targets, DE containment cycles, authored-versus-engine provenance, Git history, confidence calculation and runtime diagnostics require later §53 phases. See `DEFERRED` traceability rows.
- Some payload grammar is not specified in v2.1 (notably CAP/OUT descriptions and DE field/persistence internals). The schema leaves those parts open and enforces the stated facets, owners and prohibited fields. Claude should judge whether any restriction or openness here invents or loses a normative contract.
- [SG-0001](../../spec-gaps/SG-0001.md) records a contradiction between §7.3 R3 and §26.2 about scenario minimums for narrative rules. It blocks the affected P007/P014 check, not P001.

## Areas for aggressive Claude scrutiny

1. Faceted roots plus observed-only discovery against §§10.1, 10.3 and 31/40.
2. Every §7 inverse and canonical edge owner, including open CAP/OUT/DE payloads and nested objects.
3. EV type-to-facet routing; SC, CHG and DSP facet references; whether documented address forms are too narrow or too broad.
4. Schema composition with `allOf`/`unevaluatedProperties` under a second Draft 2020-12 validator.
5. Derived-but-persisted fields and whether P001 fixtures accidentally claim future engine output.
6. Validity of the partial §55 fixture and whether negative cases fail for their intended reason.

## Traceability and verdict boundary

P001 schema-level rows are marked `PASS`; later semantic checks are explicitly `DEFERRED` to their §53 owner. Codex has not accepted P001. Only the independent Claude audit may set an accepted verdict. Do not begin P002 before that gate.
