# Codex Remediation R02 — P001

Base audited commit: `1004f2450c28f715357f1818bd761ac79fa9e865`
Claude re-audit: [CLAUDE_AUDIT_R02.md](../audits/CLAUDE_AUDIT_R02.md), verdict `CHANGES_REQUESTED`
Audit record commit: `4c4496884c0ba13f705ba89d619f7f40ef2ccd96`
Remediation commit: `c738bd6675bb44c80ef890daf28b335718fbe9c5`
Normative source: frozen `knowledge-framework-spec-v2.1.md` §§23.2–23.3

Claude independently closed all six R01 findings in R02. This handoff addresses only the new R02 finding. P001 still awaits independent acceptance; P002 has not begun.

## Finding: CLAUDE-P001-R02-F001

Decision: **ACCEPTED**

### Root cause

The R01 remediation intended to preserve unspecified nested DIV payloads as open objects. A one-line change also opened `detected.comparison`, though the DIV comparison is the specified facet and observed target used for the §23.2 stable key. The change was unintended. Against the R02 audited schema, the project validator accepted an extra `observed_backend` reference; the focused regression tests also failed before the schema fix.

### Changes

Restored `detected.comparison.additionalProperties: false`, leaving only its existing required `specified` and `observed` references. No other DIV rule changed. Added traceability row T29c.

### Files

`framework/schemas/divergence.schema.json`, `test/p001-schema.test.mjs`, `.strike-team/phases/P001-core-persistent-model/TRACEABILITY.md`.

### Verification and regression protection

Two in-memory DIV negatives add `observed_backend` and free-text `note` separately. Each asserts rejection at `/detected/comparison`, identifies the offending property, and repeats validation for deterministic diagnostics. Both were red against the audited schema and pass after the fix. The spec-shaped DIV without extra keys remains valid.

| Check | Result |
|---|---|
| Focused DIV comparison tests | 2/2 pass after fix; 2/2 failed before fix |
| `npm test` | 145/145 pass |
| `npm run build` | 19 JSON Schemas compile |
| `npm run typecheck` | 19 schema contracts compile |
| `npm run lint` | pass |
| `git diff --cached --check` | pass before remediation commit |

The independent conformance specialist authored and ran the focused red-to-green tests. The implementation lead independently reproduced the acceptance defect with `scripts/check-schemas.mjs#loadSchemas()`, inspected the exact three-file diff, and ran build and typecheck. DIV key derivation and runtime ownership checks remain P017 work.

## Advisory and specification gaps

R02 advisory A1 about a database column literally named `created_at` inside DIV `difference` values is non-blocking and unchanged by this remediation. P017 can evaluate it when emitting differences. SG-0001 and SG-0002 remain open for their later workstreams; no P001 semantic decision was invented.

R02-F001 is submitted as remedied for independent Claude re-audit. `open_required_findings` remains one until Claude adjudicates it; Codex does not accept P001.
