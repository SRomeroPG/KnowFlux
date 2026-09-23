# Codex Remediation R01 — P001

Base audited commit: `7a98c86a715e98fa171eb42c20fcf25bbd1e67fa`
Claude audit: [CLAUDE_AUDIT_R01.md](../audits/CLAUDE_AUDIT_R01.md), verdict `CHANGES_REQUESTED`
Audit record commit: `6691cd6fbc10c6dab13df7ec9398321a3acc408b`
Remediation commit: `67a7489c32f616840bac6f6170d56b90ce2783f2`
Normative source: frozen `knowledge-framework-spec-v2.1.md`

P001 remains pending independent Claude acceptance. This report supersedes the initial [CODEX_HANDOFF.md](../CODEX_HANDOFF.md) where its test counts, CAP/OUT root description, or risk assessment differ. No P002 work was begun.

## Finding: CLAUDE-P001-R01-F001

Decision: **ACCEPTED**

### Root cause

The shared `verification.last_verified_at` and EV `observed.at` schemas required RFC 3339 timestamps, while the frozen §10.3 and §16.6 examples use calendar dates. The §16.3 example uses a timestamp. Independently reproduced against the audited schemas in the conformance specialist's red baseline.

### Changes

Both fields now accept a valid `date` or `date-time` string. The §10.3, §16.3, and §16.6 examples are preserved under `framework/conformance/spec-examples/`; §16.6 has the required `schema_version: 2.1` header added, as disclosed in that corpus README.

### Files

`framework/schemas/common.schema.json`, `framework/schemas/evidence.schema.json`, `framework/conformance/spec-examples/**`, `test/p001-schema.test.mjs`.

### Verification and regression protection

All three spec examples validate. Invalid calendar dates and malformed timestamps fail at the affected field; diagnostics repeat deterministically. The §16.3 corpus file includes the spec's `excerpt` block.

---

## Finding: CLAUDE-P001-R01-F002

Decision: **ACCEPTED**

### Root cause

BP and DE `identity` were open objects, allowing a second owner for canonical edges and facet-only payload or derived fields. Independently reproduced by nested negatives that failed on the audited schemas.

### Changes

The optional BP/DE `identity` object now has no permitted members. Their documented entity-level fields stay at the entity root, and execution, fields, and persistence remain in the corresponding facets. No new identity fields or mandatory keys were invented.

### Files

`framework/schemas/business-process.schema.json`, `framework/schemas/data-entity.schema.json`, `test/p001-schema.test.mjs`.

### Verification and regression protection

Tests reject BP `identity` copies of `executes`, `reads`, `writes`, `part_of`, steps, version, confidence, and related facet fields; DE `identity.contains`, fields, persistence, and facet-derived fields are also rejected. Each asserts the nested diagnostic and repeated result.

---

## Finding: CLAUDE-P001-R01-F003

Decision: **ACCEPTED**

### Root cause

CAP and OUT had a finite forbidden-name list over otherwise open roots. Undocumented derived fields, facet payload, nested relationship wrappers, and timestamp wrappers bypassed the list. Independently reproduced in the red test run.

### Changes

Both roots now close to the common entity properties and their own `type` property through Draft 2020-12 `unevaluatedProperties: false`. No additional field is required.

### Files

`framework/schemas/capability.schema.json`, `framework/schemas/outcome.schema.json`, `test/p001-schema.test.mjs`.

### Verification and regression protection

Positive CAP/OUT fixture files still validate. Twenty-two added negatives reject direct derived/facet fields, `relationships.contains`, nested `identity.executes`, metadata timestamp wrappers, and arbitrary fields, with property-specific diagnostics.

---

## Finding: CLAUDE-P001-R01-F004

Decision: **ACCEPTED**

### Root cause

The DIV schema prohibited `statement` only at its root. Open nested objects allowed it under `detected` and human-owned `disposition`; they also allowed Git-derived timestamps. Independently reproduced before remediation.

### Changes

A recursive property-name guard rejects `statement`, `created_at`, and `updated_at` at every depth, including objects inside arrays. The root remains closed; the documented `detected` and `disposition` split remains intact. Underspecified nested proof/disposition payloads remain open except for the three prohibited names.

### Files

`framework/schemas/divergence.schema.json`, `test/p001-schema.test.mjs`.

### Verification and regression protection

The §23.3 in-memory DIV structure validates. Ten nested negatives cover `proof`, `disposition`, `owner`, and `resolution`, with checks for the offending property and deterministic diagnostics. No DIV file was authored in the Acme project fixture.

---

## Finding: CLAUDE-P001-R01-F005

Decision: **ACCEPTED**

### Root cause

DIV `classification` and `proof` were validated independently, allowing `behavioral-divergence` without the scenario discrepancy required by §23.1. Independently reproduced with empty and `path-diff` proofs.

### Changes

The DIV `detected` schema conditionally requires `mechanism: scenario-differential` and at least one `failing_scenarios` entry when classification is `behavioral-divergence`. Other classifications retain their prior proof flexibility.

### Files

`framework/schemas/divergence.schema.json`, `test/p001-schema.test.mjs`.

### Verification and regression protection

The §23.3 behavioral example with two failing scenarios validates. Four negative proofs fail: empty, `path-diff`, missing scenarios, and empty scenarios.

---

## Finding: CLAUDE-P001-R01-F006

Decision: **ACCEPTED**

### Root cause

The original 74 tests mostly checked forbidden keys at document roots. The positive corpus omitted the date forms in the frozen examples, while T09, T19, and T29 claimed stronger coverage. Before schema fixes, the conformance specialist's new tests produced 60 failures in a 139-test red baseline; the final suite contains 143 tests.

### Changes

Added a spec-derived positive corpus and nested negative tests covering F001–F005. Updated `TRACEABILITY.md` T04, T08–T10, T19, T22, T29, and new T29b with actual evidence and the distinction between P001 structural checks and deferred engine checks. `PLAN.md` records SG-0002 and the CAP/OUT closure decision.

### Files

`framework/conformance/spec-examples/**`, `test/p001-schema.test.mjs`, `.strike-team/phases/P001-core-persistent-model/{PLAN,TRACEABILITY}.md`.

### Verification and regression protection

The tests use frozen spec examples and independently named forbidden cases, assert offending locations or properties, and repeat each new negative validation to check deterministic diagnostics. The final 143/143 suite passes.

---

## Specification gaps and scope

The audit-discovered [SG-0002](../../../spec-gaps/SG-0002.md) is a genuine missing address/canonicalization decision concerning configurable observed target dimensions, dotted repository identifiers, and escaping scope values. Its P007 and later workstreams remain unresolved. P001's open target/scope maps do not choose an interpretation. Pre-existing [SG-0001](../../../spec-gaps/SG-0001.md) likewise affects later work. Neither blocks this P001 schema remediation. The audit's rejected candidates and twelve advisories remain recorded in the audit; no extra product semantics were added to resolve them.

## Full verification and internal review

| Check | Result |
|---|---|
| `npm test` | 143/143 pass after final schema and example adjustments |
| `npm run build` | 19 JSON Schemas compile |
| `npm run typecheck` | 19 schema contracts compile |
| `npm run lint` | pass |
| `git diff --cached --check` | pass before remediation commit |

The independent conformance specialist produced the red baseline and regression suite. A separate read-only integration specialist reviewed the schema/test diff, reran the checks, and identified the §16.3 `excerpt` omission and stale traceability rows, which were corrected before the remediation commit. The implementation lead inspected the actual schema and test diffs, retained open DIV nested payloads where semantics are unspecified, and reran the full checks after those corrections.

All six findings are submitted as remedied for independent Claude re-audit. `open_required_findings` remains six until Claude adjudicates them; Codex does not accept P001.
