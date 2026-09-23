# Claude Re-Audit R02 — P001 Repository Foundation + Core Persistent Model

Audited commit: 1004f2450c28f715357f1818bd761ac79fa9e865 (handoff; remediation commit 67a7489c32f616840bac6f6170d56b90ce2783f2)
Previous audit: [CLAUDE_AUDIT_R01.md](CLAUDE_AUDIT_R01.md) at 7a98c86
Remediation report: [CODEX_REMEDIATION_R01.md](../remediation/CODEX_REMEDIATION_R01.md), treated as an untrusted claim
Working tree during re-audit: clean
Normative source: `knowledge-framework-spec-v2.1.md` (frozen)

## 1. Scope

This is a focused re-audit under bootstrap §17. It covers three things:
- Each R01 finding, re-verified from the original evidence against the actual change.
- The regression protection Codex added.
- A regression audit of every file the remediation touched: 7 schemas, `test/p001-schema.test.mjs`, `framework/conformance/spec-examples/**`, `PLAN.md` and `TRACEABILITY.md`.

Areas the remediation did not touch were not re-audited. Codex did not modify the R01 audit file, SG-0001 or SG-0002.

The orchestrator worked alone and used no subagents: the change set is small, and every check below is directly reproducible.

## 2. Commands run

| Command | Result |
|---|---|
| `git log --oneline 7a98c86..HEAD` | 6691cd6 (R01 record), 67a7489 (remediation), 1004f24 (handoff) |
| `git diff 6691cd6 1004f24 --stat` | 17 files; the schemas changed are BP, CAP, common, DE, DIV, EV and OUT |
| `npm run build` | exit 0: "Compiled 19 JSON Schemas." |
| `npm run lint` | exit 0 |
| `npm test` | 143/143 pass |
| Orchestrator probes (`scratchpad/orch/r2.mjs`) | Uses the R01 harness (`scripts/check-schemas.mjs#loadSchemas()` and `yaml` with `uniqueKeys`). Spec examples are read directly from the spec file by line range, not from Codex's copies. |

## 3. Re-verification of R01 findings

| Finding | Original evidence re-run at HEAD | Change inspected | Regression protection | Result |
|---|---|---|---|---|
| F001 (HIGH) dates | §10.3 (spec lines 422–462) read directly from the spec file: **VALID**. §16.6 (lines 899–906, with `schema_version` added): **VALID**. §16.3 (lines 817–838): **VALID**. | `last_verified_at` and `EV.observed.at` now use `anyOf` over `format: date` and `format: date-time`. No other date field was loosened. | The frozen examples are in `framework/conformance/spec-examples/`; I checked they match the spec byte-for-byte in substance, with only the disclosed `schema_version` header added to §16.6. There are also negatives for an invalid calendar date and a malformed timestamp. | **CLOSED** |
| F002 (HIGH) BP/DE identity | BP `identity.{executes, part_of}` and DE `identity.{contains, version}`: **INVALID**, with `additionalProperty` naming each key. `identity: {}`: VALID. | BP/DE `identity` is now `additionalProperties: false`. No identity fields or required keys were invented. | 17 BP and 9 DE nested negatives, each asserting `/identity` and the property name. | **CLOSED** |
| F003 (MEDIUM) CAP/OUT open | CAP `{epistemic, version, relationships.contains}` and OUT `{computed_confidence, verification}`: **INVALID**. CAP/OUT with every common field (`id_status`, `type`, `name`, `lifecycle`): VALID. | Roots closed with `unevaluatedProperties: false`; nothing new is required. | 22 negatives, including nested `relationships.contains`, `meta.created_at` and arbitrary keys. | **CLOSED** |
| F004 (MEDIUM) DIV `statement` and timestamps | `disposition.statement`: **INVALID**. `statement` nested inside an array inside `difference.observed`: **INVALID**. | A recursive `propertyNames` guard over objects and arrays; the root is closed with an explicit property list. | 10 nested negatives (`proof`, `disposition`, `owner`, `resolution`, `detected`). | **CLOSED**. See advisory A1. |
| F005 (LOW) classification/proof | `behavioral-divergence` with `path-diff`: **INVALID**. Behavioral with scenario-differential and ≥1 SC: VALID. `undetermined` with `{}`: VALID, which leaves the unconstrained classes unchanged as required. | Conditional `if/then` on `detected`. | 4 negatives: `{}`, `path-diff`, scenario proof without scenarios, and an empty list. | **CLOSED** |
| F006 (MEDIUM) test and traceability weakness | The new tests assert the specific instance location and offending property, not a prefix of `/specified`. Positives now include the verbatim spec examples. T04, T08–T10, T19, T22, T29 and T29b now cite the nested evidence that exists. | `expectInvalidAt`/`nestedNegative` helpers; spec-derived cases. | 143 tests. Codex reports a 139-test red baseline against the R01 schemas with 60 failures. That claim was not re-run; the per-finding reproductions above independently confirm that the protected cases were defects. | **CLOSED** |

## 4. Regression audit of modified areas

Findings that are not regressions:
- The DIV root changed from `unevaluatedProperties: false` to `additionalProperties: false`, now listing `schema_version`, `id`, `id_status`, `name`, `lifecycle`, `type`, `detected` and `disposition` explicitly. Root `executed_by` and `specified` are still rejected, and all the common fields are still accepted. No loss.
- `detected.proof` is now closed to `mechanism` and `failing_scenarios`, the only keys §23.3 shows. This is a tightening consistent with the spec.
- The BR, BP-facet, DE-facet, EV (apart from `observed.at`), SC, UNK, CHG and DSP schemas are unchanged. BR root closure was re-confirmed.

One regression was found (§5).

## 5. Findings — REQUIRED

## CLAUDE-P001-R02-F001

Severity: LOW
Disposition: REQUIRED
Status: OPEN

### Spec reference
§23.2, §23.3.

### Requirement
§23.2: "`div_key = sha256(entity ‖ specified_key ‖ observed_target ‖ difference_path)`". A DIV's identity is exactly one specified facet compared with one observed target. §23.3 shows the engine-owned `detected.comparison` as exactly `{specified: BR-0037#specified@v3, observed: BR-0037#observed:legacy-app}`, and adds: "El `DIV` **SHALL NOT** repetir las afirmaciones: referencia las facetas."

### Evidence
`git diff 6691cd6 1004f24 -- framework/schemas/divergence.schema.json`:
```
-        }, "additionalProperties": false },
+        }, "additionalProperties": true },
```
This is the `detected.comparison` object. At the audited R01 commit, `comparison` was closed. No R01 finding asked for this. `CODEX_REMEDIATION_R01.md` does not mention it, and no test exercises `comparison` beyond the two spec keys.

### Actual behavior
`detected.comparison: {specified: BR-0001#specified, observed: BR-0001#observed:a, observed_backend: BR-0001#observed:backend, note: "free text claim"}` → **VALID** at HEAD. It was **INVALID** at 7a98c86.

### Expected behavior
`detected.comparison` accepts only the specified-facet reference and the observed-facet reference that §23.2/§23.3 define. A DIV cannot reference additional compared facets or carry other content there.

### Why this matters
This remediation silently loosened an engine-owned persistent contract, in the same object family that F004 and F005 were tightening. A persisted DIV can now name a second observed target, which is an impossible combination for a key defined over exactly one `observed_target`. It can also carry arbitrary content inside the comparison, which §23.3 says must only reference facets. P017 derivation and KF-E-603 checks will rely on this contract.

### Reproduction
1. Take the R01 harness (audit R01 §3).
2. Build a valid DIV (for example the §23.3 structure in `test/p001-schema.test.mjs` `specDiv()`).
3. Add `detected.comparison.observed_backend = 'BR-0001#observed:backend'` and run `v('divergence', doc)`: `ok: true`.
4. Run the same step against `git show 7a98c86:framework/schemas/divergence.schema.json`: `ok: false` (`additionalProperty: observed_backend`).

### Remediation constraint
- Restore `detected.comparison` to reject properties other than `specified` and `observed`.
- If Codex opened it on purpose, record the spec basis in the remediation report; the frozen text shows none.
- Add a negative for an extra comparison key.
- Do not change the other DIV rules.

## 6. ADVISORY (non-blocking)

- **A1 (from F004).** The recursive guard also applies inside `detected.difference.specified` and `.observed`. These are engine-written copies of facet content, so a DE whose observed database schema has a business column named `created_at` (§10.5 shows observed DE as the real DB schema) is rejected if the difference is emitted at `fields` granularity: `difference.observed: {created_at: {...}}` → INVALID. This follows the literal §19.1/§23.3 wording and the R01 remediation constraint, so it is not required. P017 should emit differences at leaf paths (`fields.created_at`) or revisit this guard.
- **A2.** The R01 audit cited spec lines "421–462" for §10.3; the YAML body is 422–462 (line 421 is the code fence). This is an audit-text correction only and changes nothing in the finding.
- The R01 advisories A1–A12 remain as recorded. None became required.

## 7. SPEC_GAPs

SG-0001 and SG-0002 are unchanged. Neither blocks P001 (reasoning as in R01 §9).

## 8. Residual risk

Low. The persistent ownership leaks (F002, F003) and the spec-example rejections (F001) are closed, with location-specific regression tests.

The remaining gap is R02-F001: a one-object contract relaxation that has no test protection. Once it is fixed, the only residual risk that carries forward is SG-0002, which must be decided before P007 address resolution.

## 9. Verdict

- R01 findings: F001–F006 are all CLOSED.
- One REQUIRED finding is newly OPEN: CLAUDE-P001-R02-F001 (LOW, a regression introduced by the remediation).

VERDICT: CHANGES_REQUESTED
