# Claude Audit R01 — P001 Repository Foundation + Core Persistent Model

Audited commit: 7a98c86a715e98fa171eb42c20fcf25bbd1e67fa (handoff commit; implementation commit 3ef4d86c5e37623e4e22bcadf8550d0ca66d6fc9)
Branch: `main`
Working tree during audit: clean except the Claude-owned `.strike-team/STATE.yaml` transition to `CLAUDE_AUDITING`. No product, schema, test or fixture file changed during the audit.
Normative source: `knowledge-framework-spec-v2.1.md` (frozen)
Audit round: R01 (first audit; there are no prior findings to re-verify)
Auditor: Claude Audit Orchestrator

## 1. Audit scope

P001 is §53 Phase A item 1: "JSON Schemas de los 11 tipos core **con facetas**, `schema_version: 2.1`". It also includes the minimal local scaffolding and the P001 slice of the §55 fixture.

In scope:
- The 19 schemas in `framework/schemas/`.
- `scripts/check-schemas.mjs`.
- `test/p001-schema.test.mjs`.
- `framework/conformance/acme-formulation/**` and `framework/conformance/invalid/p001/**`.
- `package.json`.
- The P001 `PLAN.md`, `TRACEABILITY.md` and `CODEX_HANDOFF.md`, treated as untrusted claims.

Out of scope, and not demanded: the engine behavior of §53 A2–A5 and B–G. That covers ID allocation, EvidenceResolver, confidence computation, full `kf validate`, logic evaluation, DIV derivation, the graph, context/impact/diff, and cross-file integrity. Those areas were checked only for whether the P001 persistent shape would conflict with them.

Method: spec → implementation → observed behavior. Every finding below was reproduced by the orchestrator with the project's own loader. A finding reported only by a subagent was not accepted without that reproduction.

## 2. Auditors and subagents used

At most three ran concurrently. All were read-only and used the default model (Sonnet). The orchestrator reproduced and adjudicated every candidate.

| Auditor | Angle | Candidates | Adjudication |
|---|---|---|---|
| `spec-compliance-auditor` | SHALL tracing; the spec's own examples validated verbatim; edge ownership; addressing | 9 | 4 merged into REQUIRED findings; 1 turned into SG-0002; 2 advisory; 2 rejected (see §7) |
| `test-conformance-auditor` | Negatives failing for the intended reason; mirrored tests; fixture blind spots; reruns | 8 | 5 merged into REQUIRED findings; 1 turned into SG-0002; 1 advisory; 1 rejected |
| `architecture-auditor` | Complexity budget; composition ambiguity; determinism; conflicts with future phases | 7 | 2 merged into REQUIRED findings; 1 turned into SG-0002; 3 advisory; 1 rejected |

No Opus escalation and no add-on capacity were used. The `mechanical-audit-worker` was not needed.

## 3. Commands and tests run

| Command | Result |
|---|---|
| `git rev-parse HEAD` | `7a98c86a715e98fa171eb42c20fcf25bbd1e67fa` |
| `git status --short` | clean at start; later only `M .strike-team/STATE.yaml` (Claude transition) |
| `node --version` / `npm --version` | v26.0.0 / 11.12.1 |
| `npm run build` | exit 0: "Compiled 19 JSON Schemas." |
| `npm run typecheck` | exit 0 (the same script as build) |
| `npm run lint` | exit 0 |
| `npm test` (run twice, by the orchestrator and by test-conformance-auditor) | 74/74 pass. Test order and results are identical across runs. |
| Orchestrator Ajv probes (`scratchpad/orch/t1–t3.mjs`) | See the findings. These use `scripts/check-schemas.mjs#loadSchemas()` and `yaml` with `uniqueKeys: true`, the same configuration as the test suite. |
| Subagent probes (`scratchpad/spec/*`, `scratchpad/tests/probe1–12.mjs`, `scratchpad/arch/*`) | Candidate evidence, re-verified by the orchestrator |

Reproduction harness used for every finding. Save it outside the repo and run it with Node from any directory:

```js
// repro.mjs
import { pathToFileURL } from 'node:url';
const repo = 'C:/Repos/KnowFlux';
const { loadSchemas } = await import(pathToFileURL(repo + '/scripts/check-schemas.mjs'));
const { default: YAML } = await import(pathToFileURL(repo + '/node_modules/yaml/dist/index.js'));
const { ajv } = await loadSchemas();
export function v(schema, doc) {
  const f = ajv.getSchema(`https://knowflux.dev/schemas/${schema}.schema.json`);
  if (typeof doc === 'string') doc = YAML.parse(doc, { uniqueKeys: true });
  return { ok: f(doc), errors: f.errors };
}
```

## 4. Normative coverage assessment

| Area | Spec | Assessment |
|---|---|---|
| 11 core types, 6 separate facet-class schemas, `framework/schemas/` | §§4.1, 42.1, 53 A1 | Present; all compile under Ajv strict. |
| DEC/CON not types | §4.3 | Conformant. |
| Faceted BP/BR/DE; CAP, OUT, SC, EV, UNK, CHG, DIV, DSP not faceted | §10.5 | `specified`/`observed`/`facet` are rejected on non-faceted roots. However, CAP/OUT accept facet-scoped and derived content through open roots (F003). |
| `schema_version: 2.1` | §53 A1 | Enforced as the number 2.1. |
| Identity separate from facets | §§0.3, 6.1, 10.1 | BR is conformant. **BP/DE are not**: open `identity` accepts facet payload, canonical edges and derived facet fields (F002). |
| `specified` as mapping or list | §10.3 | Conformant. |
| Greenfield without facet ceremony | P6, §10.3 | **Not conformant**: the spec's own §10.3 example is rejected (F001). |
| Observed facets in separate files, keyed by `target`, not versioned | §§10.4, 10.6, 21 | Conformant structurally. The shape of `target` versus addressing is recorded as SG-0002. |
| Observed-only discovery (zero specified) | §§10.1, 31, 40 | Accepted as a justified reading: §10.1's "[1..n]" is overridden by §31 ("el discovery produce **exclusivamente facetas observed**") and by §40 `observed_without_specified`. |
| BP facets have steps and no logic; DE facets have fields and persistence | §10.5 | Conformant. |
| Canonical edge ownership; no authored inverses | §§7.1, 7.2 | Inverses are rejected at roots, BP steps and DE fields. **Canonical ‡ edges and `contains`/`part_of` can be authored a second time in BP/DE `identity`** (F002). |
| Facet references: EV.supports, SC.asserts, CHG.affects, DSP.disputes | §§10.7, 16.3, 22, 26, 18.2 | Directions are correct: bare faceted support is rejected, CHG accepts only `#specified`, SC observed requires a target, and DSP requires a faceted entity when `facet` is given. Grammar edge cases are recorded as SG-0002. |
| EV class → facet class | §16.1 | Enforced structurally, for both directions, with ambivalent types unrestricted. |
| Derived fields versus authored truth | §§0.2, 10.8, 17.3, 19.1 | Persisted derived fields are accepted in the locations the spec's examples use (`version`, `epistemic.*`, `verification.*`, `hint_lines`, `signature.value`), which §10.8 allows ("`kf validate` los recalcula"). They are also accepted where the spec defines no engine writer (CAP/OUT roots, BP/DE identity: F002, F003). `created_at`/`updated_at` are blocked at roots and facets, but accepted inside open objects (F003, F004). |
| DIV split ownership; no `statement` | §§23.1, 23.3 | `statement` is blocked only at the root (F004). The classification/proof contradiction is accepted (F005). |
| Logic grammar shapes | §§11.1, 12 | Four closed kinds; the §12.2/§12.3 examples validate. Minor ambiguities are advisory (A2). |
| Complexity budget; offline; text-readable KB | §54 | Conformant: 3 runtime dependencies, no DB/server/cloud, `$id` URLs are not fetched. |
| §55 fixture slice; no hand-made DIV | §55 | Sound for the P001 slice, with blind spots (F006, §6). |

## 5. Findings — REQUIRED

## CLAUDE-P001-R01-F001

Severity: HIGH
Disposition: REQUIRED
Status: OPEN

### Spec reference
§10.3 (P6), §16.6; also §16.3 for the date-time form of the same field.

### Requirement
§10.3: "Un proyecto greenfield **SHALL** poder operar sin escribir la palabra "faceta". `rule.yaml` con una única faceta specified inline tiene exactamente la forma que tenía en v2.0:" The normative example contains:
```yaml
  verification:
    last_verified_at: 2026-10-14
```
§16.6 (the EV example for non-auto-verifiable evidence) contains `observed: {at: 2026-10-14}`. §16.3 uses `at: 2026-10-14T09:12:00Z` for the same field. The spec therefore uses both a date and a date-time for `EV.observed.at`.

### Evidence
- `framework/schemas/common.schema.json:75` — `"last_verified_at": { "type": "string", "format": "date-time" }`
- `framework/schemas/evidence.schema.json:30` — `observed.at`: `{ "type": "string", "format": "date-time" }`
- No fixture file uses either field, so the positive corpus never exercises this path.

### Actual behavior
The §10.3 greenfield `rule.yaml`, validated verbatim against `business-rule`, is INVALID:
`/specified/verification/last_verified_at format {"format":"date-time"}`. The error then cascades to the `/specified` `oneOf`.
The §16.6 EV-0141 example (with `schema_version: 2.1` added), validated against `evidence`, is INVALID: `/observed/at format {"format":"date-time"}`.
Replacing only `last_verified_at` with `2026-10-14T00:00:00Z` makes the §10.3 document VALID, which isolates the cause.

### Expected behavior
The spec's own normative examples validate. In particular, the P6 greenfield form that §10.3 says "tiene exactamente la forma" validates unchanged.

### Why this matters
§10.3 is the normative P6 contract, and §53 Phase A is where format mistakes are "irreversible si se hace mal". Every greenfield project that copies the specification's reference `rule.yaml` would get a `KF-E-010` for a document the spec defines as correct.

### Reproduction
1. Build the harness in §3.
2. Run `v('business-rule', <§10.3 example, spec lines 421–462, verbatim>)`. Result: `ok: false`, error at `/specified/verification/last_verified_at`.
3. Run `v('evidence', <§16.6 example, spec lines 899–906, with schema_version: 2.1 added>)`. Result: `ok: false`, error at `/observed/at`.

### Remediation constraint
- `verification.last_verified_at` must accept the date form used in §10.3.
- `EV.observed.at` must accept both forms the spec uses: the date in §16.6 and the date-time in §16.3.
- Do not loosen other date fields beyond what the spec's examples show.
- Add positive fixture coverage for both fields: the verbatim §10.3 greenfield rule, and an EV with a date-only `observed.at`.

---

## CLAUDE-P001-R01-F002

Severity: HIGH
Disposition: REQUIRED
Status: OPEN

### Spec reference
§7.1 (‡ footnote), §7.2, §0.2, §0.3, §10.1, §10.5, §15.

### Requirement
§7.1: "‡ Autorada **dentro de la faceta de BP correspondiente**" (applies to `executes`, `reads`, `writes`, `produces` [BP], `calls`, `triggered_by`, `performed_by`, `transitions`).
§7.2: "**Cada arista tiene exactamente un owner.**"
§10.5: "Que las aristas de ejecución vivan dentro de la faceta es lo que permite representar que legacy ejecuta la regla en un paso distinto que el backend nuevo."
§0.3: "La identidad es la cosa; las facetas son lo que se sabe o se quiere de ella."
§15: "**La confianza pertenece a la faceta, no a la entidad.**"
§0.2: "Si un dato aparece escrito a mano en dos sitios, es un bug".

### Evidence
- `framework/schemas/business-process.schema.json:14` — `"identity": { "type": "object", "allOf": [ { "$ref": "common.schema.json#/$defs/authoredRootNames" } ], "additionalProperties": true }`
- `framework/schemas/data-entity.schema.json:13` has the same open `identity`.
- `authoredRootNames` (`common.schema.json`) blocks only inverse and legacy names. It does not block forward canonical edges, facet payload or facet-scoped derived fields.
- `test/p001-schema.test.mjs:185` tests `executes` only at the BP root. `TRACEABILITY.md:16` (T09) reports PASS without identity-level evidence.

### Actual behavior
All of the following are VALID (orchestrator probes t2/t3; independently reproduced by spec-compliance-auditor and test-conformance-auditor):
- BP `identity: {executes: [BR-0001], reads: [DE-0001], writes: [DE-0001]}`: canonical ‡ edges outside any facet.
- BP `identity: {part_of: CAP-0002}` next to root `part_of: CAP-0001`: two owners of a 1..1 edge, with different values.
- BP `identity: {steps: [{id: s9, name: y, executes: [BR-0009]}]}`: facet payload at identity level.
- DE `identity: {contains: [DE-0021]}` next to root `contains: [DE-0020]`: two owners of `contains`, with different values.
- DE `identity: {fields: {...}}` and `identity: {version: 3, epistemic: {computed_confidence: confirmed}}`; BP `identity: {version: 3, epistemic: {...}}`: facet payload and facet-scoped derived fields at entity level.

The same `executes` at the BP root is correctly rejected, which shows the check is enforced only at the root and not structurally.

### Expected behavior
Each §7.1 authored edge has exactly one accepted location per type: ‡ edges only inside a BP facet (or its steps); `part_of` only in its single BP location; `contains` only in its single DE location. Facet payload (`steps`, `fields`, `persistence`, `logic`) and facet-scoped fields (`version`, `epistemic`, `verification`, `scope`, `validity`, `authority`) are not accepted on the entity-level `identity` object.

### Why this matters
It breaks exactly the property §10.5 cites as the reason BP is faceted: execution edges authored per facet. It allows contradictory duplicated edges (two `part_of` values, two `contains` lists) that no later phase can reconcile without choosing a winner, which §0.2 treats as a spec bug. It also allows entity-level confidence and version that §15 and §21 say do not exist. Because this is a persistent-shape defect, fixing it after a corpus exists means a migration.

### Reproduction
1. `v('business-process', {schema_version: 2.1, id: 'BP-0001', type: 'business-process', part_of: 'CAP-0001', identity: {executes: ['BR-0001'], part_of: 'CAP-0002'}})` returns `ok: true`.
2. `v('data-entity', {schema_version: 2.1, id: 'DE-0001', type: 'data-entity', contains: ['DE-0020'], identity: {contains: ['DE-0021'], version: 3, epistemic: {computed_confidence: 'confirmed'}}})` returns `ok: true`.
3. Control: `v('business-process', {... same BP ..., executes: ['BR-0001']})` at the root returns `ok: false` (`unevaluatedProperty: executes`).

### Remediation constraint
- BP and DE `identity` must not accept any §7.1 authored edge, any facet payload, or any facet-scoped or derived facet field.
- The spec does not define BP/DE identity content. Codex may close `identity` or constrain it, but must not invent required BP/DE identity fields or signature semantics; §6.1/§6.2 define the signature only for BR.
- Add negatives for each of the cases above.
- Correct TRACEABILITY T09 so it cites identity-level evidence.

---

## CLAUDE-P001-R01-F003

Severity: MEDIUM
Disposition: REQUIRED
Status: OPEN

### Spec reference
§10.5, §10.8, §15, §19.1, §21, §7.2, §13 (preamble).

### Requirement
§10.5: "`CAP`, `OUT`, `SC`, `EV`, `UNK`, `CHG`, `DIV`, `DSP` **SHALL NOT** facetarse."
§10.8: "`version` (specified), `computed_confidence`, `effective_confidence`, `signature.value`, `verification.*`, `hint_lines` de evidencia y toda inversa de arista **SHALL NOT** editarse a mano." These fields have an engine writer only on facets and evidence (§0.2 table).
§15: "La confianza pertenece a la faceta, no a la entidad."
§21: "Revisión de entidad: entero, propiedad de la faceta specified".
§19.1: "`created_at` y `updated_at` **SHALL NOT** existir en YAML."
§7.2: "Una inversa derivada SHALL NOT aparecer nunca en YAML autorado."
§13: "Lo que una máquina pueda verificar vive en YAML. El Markdown contiene únicamente lo que ninguna máquina puede verificar".

### Evidence
- `framework/schemas/capability.schema.json` and `framework/schemas/outcome.schema.json` declare only `id` and `type` plus a root `propertyNames` blocklist (line 14). They have neither `unevaluatedProperties: false` nor `additionalProperties: false`. The other nine entity schemas close their roots.
- The blocklist lacks `computed_confidence`, `effective_confidence`, `epistemic`, `verification`, `version`, `contested`, `steps`, `fields`, `identity`, and the names of relationship containers.

### Actual behavior
All of the following are VALID:
- CAP `{epistemic: {computed_confidence: confirmed}, version: 4}`.
- OUT `{computed_confidence: confirmed, effective_confidence: confirmed, verification: {state: fresh}, version: 2}`.
- CAP `{steps: [{id: s1, executes: [BR-0001]}], identity: {executes: [BR-0001]}}`.
- CAP `{relationships: {contains: [BP-0001]}}`: `contains` on CAP is explicitly forbidden by §7.2 and is re-expressed one level down.
- CAP `{meta: {created_at: ..., updated_at: ...}}`.
- Any unrelated key (for example `totally_bogus_field`).

Root-level `contains`, `specified`, `created_at` and the other blocklisted names are rejected.

### Expected behavior
CAP and OUT documents cannot carry facet-scoped or engine-derived fields for which the spec defines no writer on a non-faceted entity (confidence, entity revision, verification state). They cannot carry facet payload, cannot carry authored relationships or inverses in any location, and cannot carry `created_at`/`updated_at`. A violation is `KF-E-010`, as for the other nine types.

### Why this matters
Non-faceted types are the ones where a hand-written `computed_confidence` or `version` can never be engine-derived, so accepting them turns derived values into independent authored truth, which is the P11/§0.2 failure mode. The blocklist approach already failed once in P001: the handoff records that `covered_by` was accidentally allowed on CAP. Relying on an enumerated blocklist over an open object guarantees that any synonym or nesting passes.

### Reproduction
1. `v('capability', {schema_version: 2.1, id: 'CAP-0001', epistemic: {computed_confidence: 'confirmed'}, version: 4, relationships: {contains: ['BP-0001']}})` returns `ok: true`.
2. `v('outcome', {schema_version: 2.1, id: 'OUT-0001', type: 'outcome', computed_confidence: 'confirmed', verification: {state: 'fresh'}})` returns `ok: true`.
3. Control: `v('capability', {schema_version: 2.1, id: 'CAP-0001', contains: ['BP-0001']})` returns `ok: false`.

### Remediation constraint
- CAP and OUT must reject the content listed under "Expected behavior".
- Closing the roots to the common entity fields, as the other nine schemas do, satisfies this without inventing semantics, because §13 places descriptive prose in `.md`. Codex may choose another mechanism if it achieves the same rejections.
- Do not add unstated required fields to CAP or OUT.
- Add negatives for each reproduced case.

---

## CLAUDE-P001-R01-F004

Severity: MEDIUM
Disposition: REQUIRED
Status: OPEN

### Spec reference
§23.3, §19.1 / §10.8.

### Requirement
§23.3: "El `DIV` **SHALL NOT** repetir las afirmaciones: referencia las facetas. Escribir `statement:` en un `DIV` es la duplicación exacta que v2.1 elimina." The prohibition covers the whole DIV, not only its root.
§19.1: "`created_at` y `updated_at` **SHALL NOT** existir en YAML."

### Evidence
- `framework/schemas/divergence.schema.json:45`: `propertyNames` bans `statement` only on the DIV root.
- `divergence.schema.json:34`: `disposition` is `additionalProperties: true` with no name restriction. The same applies to `disposition.resolution` and `detected.proof` (lines 24–27).
- The only test (`test/p001-schema.test.mjs:143-158`) adds `statement` at the root only. `TRACEABILITY.md:38` (T29) reports PASS.

### Actual behavior
VALID:
- `disposition: {status: open, statement: 'legacy is wrong', updated_at: '2026-01-01'}`
- `disposition: {status: open, resolution: {kind: change, statement: 'dup'}}`
- `detected: {..., proof: {mechanism: path-diff, statement: 'dup'}}`

### Expected behavior
A DIV document is rejected if it carries a `statement` at any location, or a `created_at`/`updated_at` metadata key in its human-owned `disposition` or engine-owned `detected` sections.

### Why this matters
`disposition` is the human-owned section (§23.3 "HUMAN-OWNED"), so it is exactly where a curator would restate the claim. The single prohibition §23.3 names explicitly is currently one nesting level away from being bypassed, and the traceability row claims otherwise.

### Reproduction
1. Build a valid DIV (for example, the §23.3 DIV-0007 example, which validates).
2. Set `disposition.statement = 'x'`, then validate with `v('divergence', doc)`: `ok: true`.
3. Move the same key to the root: `ok: false` (`propertyName: statement`).

### Remediation constraint
- `statement` must be rejected everywhere in a DIV.
- `created_at`/`updated_at` must not be accepted in `disposition` or `detected`.
- Keep the keys the spec shows for `disposition` (`status`, `reason`, `owner`, `expires`, `resolution{kind, ref}`); do not add new required keys.
- Add nested negatives and correct T29.

---

## CLAUDE-P001-R01-F005

Severity: LOW
Disposition: REQUIRED
Status: OPEN

### Spec reference
§23.1, §55.

### Requirement
§23.1: "Un diff estructural sin discrepancia de escenarios **SHALL** etiquetarse `structural-difference`, **nunca** `behavioral-divergence`." Its table ties "Diferencial por escenarios … La *prueba* conductual" to `behavioral-divergence`. §55 lists the expected pairs: "DIV-0001 behavioral-divergence (scenario-differential) · DIV-0002 structural-difference (path-diff)".

### Evidence
`framework/schemas/divergence.schema.json:23-27`: `classification` and `proof.mechanism`/`failing_scenarios` are validated independently, and `proof` may be `{}`.

### Actual behavior
VALID:
- `classification: behavioral-divergence, proof: {mechanism: path-diff}`
- `classification: behavioral-divergence, proof: {}`

In both, a DIV claims a proven behavioral divergence with no scenario discrepancy.

### Expected behavior
A persisted DIV whose `classification` is `behavioral-divergence` is rejected unless its `proof` is the scenario-differential mechanism with at least one failing scenario.

### Why this matters
This is the one case where the spec forbids a DIV from claiming more certainty than it holds (P14). The DIV schema is the persistent contract that later hand-edit and derivation checks (KF-E-603, P017) will rely on, and JSON Schema can reject this contradiction deterministically. The impact is limited because `detected` is engine-owned, hence LOW.

### Reproduction
1. Take the §23.3 DIV-0007 example (valid).
2. Set `detected.proof = {mechanism: 'path-diff'}` and keep `classification: behavioral-divergence`, then run `v('divergence', doc)`: `ok: true`.

### Remediation constraint
- Reject `behavioral-divergence` without scenario-differential proof with ≥1 `failing_scenarios`.
- Do not constrain `undetermined` or `structural-difference` beyond what §23.1/§55 state.

---

## CLAUDE-P001-R01-F006

Severity: MEDIUM
Disposition: REQUIRED
Status: OPEN

### Spec reference
§55 ("un fixture escrito después del engine se convierte en una justificación del engine"); bootstrap §6 (traceability is mandatory).

### Requirement
The P001 conformance evidence must demonstrate the normative behavior it claims. A test or traceability row marked PASS must exercise the requirement, not only the location where the implementation already blocks it.

### Evidence
- `test/p001-schema.test.mjs:220-235`: the "every derived inverse is rejected" matrix injects names copied from the schema's own blocklist, and only at document roots. On the nine closed schemas, `unevaluatedProperties` alone rejects any root key, so the matrix proves nothing specific. It never probes `identity`, facets, steps, DE fields or nested open objects.
- The negatives for ‡ edges (`:185`), DIV `statement` (`:155`) and `created_at`/`updated_at` (`:204-205`) are all root-only. That is why F002, F003 and F004 pass the suite.
- The positive corpus contains no `verification.last_verified_at`, no `EV.observed.at` in date form, and no verbatim spec example. That is why F001 passes the suite.
- TRACEABILITY rows T09 (§7.1), T19 (§§10.8, 19.1) and T29 (§23.3) are marked PASS on this root-only evidence.

The test-conformance-auditor sampled the negatives that do exist, including all 5 invalid YAML files, and each fails for its intended reason. That part is sound.

### Actual behavior
74/74 tests pass while F001–F005 are present.

### Expected behavior
The tests would fail on each defect in F001–F005. The traceability rows reflect the locations actually verified.

### Why this matters
Traceability PASS rows are what later phases and re-audits trust. Root-only negatives on closed schemas certify the closure mechanism, not the normative ownership rule, so regressions in nested locations will go undetected.

### Reproduction
1. `npm test`: 74/74 pass.
2. Run the reproductions of F001–F005: each defect is present.

### Remediation constraint
- Add spec-derived positives: the verbatim §10.3 greenfield rule; the §16.6 EV and §23.3 DIV shapes as fixtures or test documents.
- Add negatives at nested locations for §7.1/§7.2 ownership, §10.8/§19.1 timestamps and §23.3 `statement`, covering the cases reproduced in F002–F005.
- Update TRACEABILITY T09, T19 and T29 (and any other row whose evidence changes) to cite the actual evidence.
- Expectations must come from the spec text, not be generated from the schema's own lists.

## 6. Fixture assessment

The P001 slice of `framework/conformance/acme-formulation/` is readable as plain YAML. It covers all 11 types except DIV. DIV is correctly never hand-populated: there is no `divergences/` directory, and DIV is tested only as an in-memory synthetic object, which is permitted.

Coverage that is present:
- BR `specified` as a list (BR-0001: two window-disjoint facets, v1 current and v2 future) and as a mapping (BR-0002: narrative with `verification.mode`).
- Observed facets for BP, BR and DE, and an observed-only DE-0002 (discovery before specification).
- EV of both the observational and specifying classes, each routed to the correct facet class.
- SC asserting both specified and observed-with-target.
- DSP on a facet.
- CHG targeting `#specified@v2` with `decided_at`.

No fixture claims engine output as authored fact. No `computed_confidence`, `effective_confidence`, `contested`, `hint_lines` or `signature.value` is hand-written. The only derived field present is specified `version`, which the spec's own §10.3 example also persists.

All five invalid YAML files fail for their intended reason.

Blind spots, addressed by F006: no verbatim spec example; no `verification.last_verified_at`; no date-only `EV.observed.at`; no ambivalent-class EV; no nested-location negatives.

These are not defects: the §55 final counts, resolver states, `expected/` outputs and the toy code repository are correctly deferred to later phases.

## 7. Candidates rejected or downgraded (with reasons)

- **Unquoted YAML numbers accepted in matchers and `then` (architecture auditor, proposed HIGH/CRITICAL): rejected as a required finding.** §11.1 routes enforcement of unquoted decimals to lint: "`kf lint` **SHALL** advertir sobre decimales sin comillas (`KF-W-124`)". Making them a schema error (`KF-E-010`) would change the spec's own severity. The `quantity.value` string pattern is conformant. Tracked as advisory A1.
- **`type` not required on CAP/OUT/SC/UNK/DIV/DSP (test auditor, proposed MEDIUM): rejected.** The spec's own §18.1 UNK, §18.2 DSP, §23.3 DIV and §26 SC examples omit `type` and validate. Requiring it would reject spec-valid documents.
- **`path-diff` is an invented literal (spec auditor): rejected.** §55 uses it verbatim: "DIV-0002 structural-difference (path-diff)".
- **Observed `target` must require `repository` (all three auditors, proposed MEDIUM): reclassified as SPEC_GAP SG-0002.** §10.6 calls the target a "mapa abierto" and §50 makes its dimensions configurable, so the frozen text does not determine the rule. The current open shape does not foreclose any alternative, so it does not block P001.
- **`observed.at` granularity is a spec gap (spec auditor): rejected.** The spec shows both forms, so accepting both invents nothing. This is covered by F001.

## 8. ADVISORY observations (not required; do not block acceptance)

- **A1.** Unquoted numeric business values in `logic` (matchers, `then`) are schema-valid; `KF-W-124` in P010 must catch them. P010 should remember that the schema will not.
- **A2.** `logic.schema.json` predicate `oneOf`: `{not: {eq: 5}}` matches both the `not` branch and the field-map branch (a field literally named `not`), so Ajv rejects it. The §12.1 grammar itself is ambiguous for fields named after combinators or operators. The trigger is narrow. P011 should settle this when implementing the evaluator.
- **A3.** The BP facet schema accepts the same edge kinds both at facet level and inside `steps`, so contradictory lists validate. The spec (§10.5 example) does not fix the level for each edge, so constraining it would invent semantics. P007/P020 must define how the two are combined, or consult the user.
- **A4.** The blocklists `authoredRootNames` and `facetNames` are identical copies, and CAP/OUT maintain a third, divergent list. After F003, consider a single source.
- **A5.** DE per-field `logic` of kind `narrative` has no `verification.mode` gate. §12.4 and §26.3 place `verification` on rules or facets and give no location for a DE field, so this is not required. It is a candidate for a future spec clarification.
- **A6.** `approved` and `disputed` are banned as key names at roots and facets. The spec bans them as a truth state or confidence value. This is harmless defense in depth, but traceability should not cite it as the direct implementation of those SHALL NOTs.
- **A7.** `build` and `typecheck` are the same script. This is acceptable in P001 (there is no TypeScript) and should be revisited when a CLI exists.
- **A8.** §10.7 says the address syntax "SHALL ser aceptada por … `SC.asserts` … y `DSP.disputes`", while §26 and §18.2 show structured objects. The schemas follow §26 and §18.2 and accept every facet-address component (including `@vN`, `[scope]` and `observed:repo/env`) inside those objects. P007 should confirm this reading.
- **A9.** `pending/v4.yaml` (§9, §20) has no dedicated fixture. The spec does not define a header for it. `business-rule-specified.schema.json` can validate a bare specified facet, and the inline list form covers §20. Revisit in P016.
- **A10.** EV resolver metadata (`anchor`, `observed`, `source`, `artifact`) is open and accepts inverse-shaped keys. §16.4 makes resolver anchors kind-specific, so this is not required.
- **A11.** `scope` accepts empty-list values (`business_unit: []`) and empty `scope: {}`. Their meaning in `specified_key` (§10.6) is undefined. This is related to SG-0002.
- **A12.** No second JSON Schema validator was available offline to cross-check Ajv's `unevaluatedProperties` handling. P007 may add one.

## 9. SPEC_GAPs

- **SG-0001** (Codex, pre-existing): the §7.3 R3 versus §26.2 narrative scenario minimum. Independently confirmed as a real contradiction. It affects P007/P014, not P001. It does not block.
- **SG-0002** (new, audit-discovered): `.strike-team/spec-gaps/SG-0002.md`. It covers the address grammar for observed targets (configurable dimensions, required `repository`), the field-suffix/dot ambiguity, and escaping of scope values in `canonical(scope)` and `[k=v]`. It affects P007, P014, P016, P017, P020–P022 and P024. **It does not block P001:** the persisted open maps foreclose none of the alternatives.

Neither gap blocks this phase. The verdict rests on F001–F006.

## 10. Residual-risk assessment

- **Persistent-format risk (highest):**
  - F002 and F003 are ownership leaks in the persistent shape. If they are left in place, corpora written in P002–P006 can contain duplicated edges and entity-level derived values that P007 would have to migrate.
  - SG-0002 is a latent format decision that should be taken before P007 implements reference resolution.
- **Spec-example fidelity:** F001 shows the schemas were not validated against the spec's own examples. After remediation, the verbatim spec examples should become a permanent positive corpus.
- **Test reliability:** until F006 is addressed, a green `npm test` gives no assurance about nested-location rules.
- **Accepted with low residual risk:**
  - Complexity budget: no DB, server or cloud; offline schema loading.
  - YAML 1.2 core parsing with `uniqueKeys`: deterministic.
  - EV class routing.
  - CHG, SC and DSP reference direction.
  - Observed-only discovery.
  - The closed `logic` kinds.
- **Deferred correctly** (not risks for P001): cross-file integrity (R1, R3–R7), KF-E-050 provenance, signature computation, ID registry, resolver behavior, confidence, and DIV derivation.

## 11. Verdict

Six REQUIRED findings remain OPEN:
- F001 (HIGH)
- F002 (HIGH)
- F003 (MEDIUM)
- F004 (MEDIUM)
- F005 (LOW)
- F006 (MEDIUM)

P001 normative coverage is not complete (P6 greenfield form, §7.1/§7.2 ownership, §23.3), and the conformance slice does not detect these defects.

VERDICT: CHANGES_REQUESTED
