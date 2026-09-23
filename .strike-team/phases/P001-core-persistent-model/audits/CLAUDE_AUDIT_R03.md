# Claude Re-Audit R03 — P001 Repository Foundation + Core Persistent Model

Audited commit: 48348f2d62a61055f5aa96287b4cce3409f9e8dc (handoff; remediation commit c738bd6675bb44c80ef890daf28b335718fbe9c5)
Previous audits: [R01](CLAUDE_AUDIT_R01.md) at 7a98c86; [R02](CLAUDE_AUDIT_R02.md) at 1004f24
Remediation report: [CODEX_REMEDIATION_R02.md](../remediation/CODEX_REMEDIATION_R02.md), treated as an untrusted claim
Working tree during re-audit: clean
Normative source: `knowledge-framework-spec-v2.1.md` (frozen)

## 1. Scope

This is a focused re-audit under bootstrap §17 of the single open finding, CLAUDE-P001-R02-F001, plus a regression check of every closed R01 finding and of the files changed since 1004f24.

`git diff --stat 1004f24 48348f2`:
- Product changes: `framework/schemas/divergence.schema.json` (1 line) and `test/p001-schema.test.mjs` (+13).
- Control-plane changes: TRACEABILITY row T29c, the remediation report, and state/registry.

`git diff 4c44968 HEAD` over `audits/`, `spec-gaps/` and the spec file is empty, so the Claude records and the frozen spec are untouched. The orchestrator worked alone and used no subagents.

## 2. Commands run

| Command | Result |
|---|---|
| `git diff 1004f24 48348f2 -- framework test` | The only schema change is `detected.comparison` `"additionalProperties": true` → `false`. There are 2 new tests. |
| `npm run build` / `npm run typecheck` | exit 0: "Compiled 19 JSON Schemas." |
| `npm run lint` | exit 0 |
| `npm test` | 145/145 pass |
| `scratchpad/orch/r2.mjs` (R01/R02 reproduction probe, spec examples read directly from the spec file) | All 21 expectations hold (see §3) |

## 3. Re-verification

### CLAUDE-P001-R02-F001 — CLOSED

- **Original reproduction.** A DIV with `detected.comparison.observed_backend` and `note` is now **INVALID**. Ajv reports `additionalProperty` for `observed_backend` and for `note` at `/detected/comparison`, the same behavior as at 7a98c86.
- **Change.** A one-line restoration. No other DIV rule changed: the recursive guard, the conditional on the behavioral proof, the closed `proof`, and the open `disposition` are unchanged.
- **Regression protection.** `test/p001-schema.test.mjs` adds two tests: one for an extra observed reference and one for a free-text key. Each asserts `/detected/comparison` and the offending property name, and repeats the validation to check determinism. The tests confirm the §23.3 base DIV is valid before mutating it, so the negatives cannot pass on an unrelated error.

### R01 findings F001–F006 — still CLOSED (no regression)

- The §10.3, §16.3 and §16.6 spec examples, read verbatim from the spec, are VALID.
- BP/DE `identity` edge and derived-field copies are INVALID; an empty `identity` is VALID.
- CAP/OUT derived and relationship keys are INVALID; all common entity fields are VALID.
- DIV `statement` is INVALID at depth.
- Behavioral-divergence without scenario proof is INVALID. Behavioral-divergence with ≥1 failing scenario and `undetermined` with `{}` are both VALID.
- Root-level DIV and BR closure still holds.

## 4. Findings — REQUIRED

None.

## 5. ADVISORY and SPEC_GAPs (non-blocking, carried forward)

- R02-A1: the DIV recursive guard also covers `difference` values, so a database column literally named `created_at` is rejected. P017 should emit leaf-level difference paths or revisit the guard.
- R01 advisories A1–A12 remain as recorded.
- SG-0001 (the scenario minimum for narrative rules) affects P007/P014.
- SG-0002 (the observed-target and scope address grammar) affects P007, P014, P016, P017, P020–P022 and P024 and **must be decided before P007 implements address resolution**.
- Neither gap affects P001 or P002.

## 6. Acceptance basis

- Zero open REQUIRED findings: R01-F001…F006 and R02-F001 are all closed and independently re-verified.
- No unresolved audit-discovered spec gap affects P001.
- P001 normative coverage is complete for §53 A1: the 11 core type schemas, the separate BP/BR/DE specified and observed facet schemas, `schema_version: 2.1`, facet and identity separation, canonical edge ownership, the authored/derived boundary where the schema can decide it, and the spec's own examples accepted.
- The P001 conformance slice is sound. It includes the verbatim spec examples, nested negatives tied to spec clauses, and no hand-populated DIV.
- The auditor requires no further implementation changes for P001.

This acceptance satisfies P002's dependency ("P001 accepted"). Starting P002 remains subject to the user's authorization, per `PHASES.md`. Claude has not begun P002.

VERDICT: ACCEPTED
