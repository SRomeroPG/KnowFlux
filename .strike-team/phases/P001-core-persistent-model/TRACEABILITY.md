# P001 normative traceability

`PASS` means a P001 schema check and its fixture/test evidence passed. `DEFERRED` identifies a semantic check whose persistent representation is modeled here but whose enforcement belongs to a later §53 item. Every row's schema artifacts are in `framework/schemas/`; the executable evidence is [test/p001-schema.test.mjs](../../../test/p001-schema.test.mjs), the [P001 conformance corpus](../../../framework/conformance/), and the [frozen-spec example corpus](../../../framework/conformance/spec-examples/). Entity and facet names in the implementation column are the corresponding `<name>.schema.json` files. This matrix indexes individual requirements, not just sections.

| ID / spec | Requirement | Implementation artifact | Verification / conformance evidence | Status |
|---|---|---|---|---|
| T01 §0.1 | Identifiers, field names, states, codes and commands SHALL use English. | `framework/schemas/*.json`; fixture YAML | schema compile; corpus inspection | PASS |
| T02 §§4.1, 42.1, 53 A1 | All 11 core types SHALL have JSON Schema in `framework/schemas/`, schema version 2.1. | one schema per core type | schema inventory test; positive YAML for every type | PASS |
| T03 §4.3 | DEC and CON SHALL NOT be types; they are BR `rule_kind` values. | BR and schema inventory | invalid type fixtures; BR kind positives | PASS |
| T04 §§4.1, 10.5 | BP, BR and DE are faceted; CAP, OUT, SC, EV, UNK, CHG, DIV and DSP SHALL NOT be faceted. | entity and facet schemas | positive and negative facet fixtures; CAP/OUT unknown-field and nested relationship negatives | PASS |
| T05 §5.1 | BR SHALL NOT have more than one `determination`. | BR identity schema | negative multiplicity case | PASS |
| T06 §§6.1, 10.1 | BR identity and signature field are entity-level, not facet-level. | BR entity/facet schemas | same identity with multiple facets; identity-in-facet negative | PASS |
| T06a §6.1 | Signature value is calculated from identity, never from a facet. | BR signature shape; P009 normalizer | identity-based hash test in P009 | DEFERRED |
| T07 §7.3 R2 | BR SHALL declare at least one identity `governs`. | BR identity schema | missing/empty governs negatives | PASS |
| T08 §§7.1–7.2 | Every authored edge has one owner; inverse edges SHALL NOT appear in authored YAML, including BR `evidence` and `executed_by`. | relationship definitions in entity/facet schemas | inverse matrix negatives; endpoint-shaped positives; BP/DE `identity` nested ownership negatives | PASS |
| T09 §7.1 | BP execution edges are authored within the corresponding BP facet; `part_of` points BP→CAP. | BP entity/facet schemas | BP facet positives; root edge and missing `part_of` negatives; nested `identity.executes`, `reads`, `writes`, and duplicate `part_of` negatives | PASS |
| T10 §7.1 | DE `contains`, SC `exercises`/`covers`, EV `supports`, UNK `blocks`, CHG `affects`, DSP `disputes` retain canonical owners. | respective core schemas | relationship owner cases; nested `identity.contains` negative | PASS |
| T11 §10.3 | Engine SHALL accept `specified` as mapping or list. | BP/BR/DE entity schemas | both representation positives | PASS |
| T12 §§10.1, 10.4, 10.6 | Specified uses scope/validity; observed is separate file, keyed by target, snapshot without version. | specified/observed facet schemas | observed file positives; version and inline-observed negatives | PASS |
| T12a §§31, 40 | Discovery can create observed facets before a corresponding specified facet exists. | BP/BR/DE root schemas | observed-only identity fixture | PASS |
| T13 §10.6 R7 | Specified scopes and validity windows SHALL be disjoint; observed target SHALL be unique. | schema defines key fields; later validator P007 | cross-file overlap/duplicate cases in P007 | DEFERRED |
| T14 §10.5 | BP facets SHALL NOT carry `logic`; they carry steps and execution edges. | BP facet schemas | BP logic negative; steps positives | PASS |
| T15 §10.5 | DE facets carry fields and persistence, optional per-field derivation logic. | DE facet schemas | DE specified/observed positives | PASS |
| T16 §§12, 26.3 | BR logic kinds are closed; narrative requires `unstructured_reason` and `verification.mode`. | BR logic/facet schemas | four-kind positives; missing mode/reason negatives | PASS |
| T17 §10.7 | Facet references use specified/observed addressing in EV, SC, CHG and DSP. | reference definitions in schemas | facet-addressed positives; wrong-class negatives where schema-expressible | PASS |
| T18 §10.8 | Derived version, confidence, signature value, verification fields, hint lines and inverse edges SHALL NOT be edited manually. | schema recognizes persisted shape; P007 provenance validation | schema shape tests now; KF-E-050 provenance cases in P007 | DEFERRED |
| T19 §§10.8, 19.1 | `created_at` and `updated_at` SHALL NOT exist in YAML metadata. | common schema exclusions; DIV recursive property-name guard; CAP/OUT closed roots | root and facet negatives; nested DIV `detected`/`proof`/`disposition`/`owner`/`resolution` negatives; CAP/OUT metadata wrapper negatives | PASS |
| T20 §§14–15 | Lifecycle enum is entity-level; confidence belongs to facets and uses five levels; `disputed`/`deprecated` SHALL NOT be confidence levels. | shared lifecycle/epistemic definitions | enum and wrong-level negatives | PASS |
| T21 §16.1 | Observational evidence SHALL elevate only observed, specifying only specified; golden master SHALL NOT elevate specified. | EV type and support reference shape; P006 confidence engine | structural support cases now; class cross cases in P006 | DEFERRED |
| T22 §§16.2–16.3 | EV SHALL declare `assertion_kind: fact | interpretation`; supports SHALL address a facet for a faceted entity. | EV schema and reference definitions | §16.3 and §16.6 frozen-spec EV positives; missing/invalid kind and bare faceted support negatives | PASS |
| T22a §16.3 | Anchor `hint_lines` SHALL NOT be authoritative. | EV hint shape; P003–P004 resolver behavior | resolver relocate/moved-symbol tests in P004 | DEFERRED |
| T23 §16.7 | Bulky binary evidence SHALL NOT live in Git; reference external artifact with hash. | EV artifact shape; fixture uses external URI/hash | EV-0002 positive fixture; conformance file inventory | PASS |
| T24 §§17.3, 18.2 | Override is human-authored; contested is derived from DSP; agents SHALL NOT author override. | epistemic schema; P006/P007 authority check | structural shape now; writer-provenance negative later | DEFERRED |
| T25 §20 | `approved` SHALL NOT be a truth state; future approved behavior remains a specified facet. | facet schemas | future specified positive; legacy truth-state negatives | PASS |
| T26 §§21–22 | Observed facets SHALL NOT be versioned; past specified versions SHALL NOT be separate authored files; CHG includes authored `decided_at`. | facet/CHG schemas; P016 history check | observed version negative now; append/history checks P016 | DEFERRED |
| T27 §22 | CHG `affects` SHALL target specified facets, never observed. | CHG affects schema | observed-affects negative | PASS |
| T28 §22.1 | CLARIFY SHALL NOT produce a logic diff. | CHG type enum; P016 change validator | enum test now; logic-diff case P016 | DEFERRED |
| T29 §23.3 | DIV SHALL NOT duplicate claims via `statement`; its persistent `detected` and `disposition` sections are distinct. | DIV schema | §23.3 in-memory DIV positive; root and nested `statement` negatives in `proof`, `disposition`, `owner`, and `resolution` | PASS |
| T29a §23.3 | Engine SHALL rewrite only `detected` and preserve human `disposition`. | DIV section shape; P017 derivation | preservation/rebuild tests in P017 | DEFERRED |
| T29b §23.1 | `behavioral-divergence` SHALL require scenario-differential proof and at least one failing scenario. | DIV `detected` conditional schema | §23.3 in-memory positive; missing/wrong mechanism and empty scenario negatives | PASS |
| T29c §§23.2–23.3 | A DIV comparison identifies one specified facet and one observed target, with no additional comparison content. | DIV `detected.comparison` schema | §23.3 in-memory positive; nested extra observed-reference and free-text-key negatives with property-specific diagnostics | PASS |
| T30 §26 | Observed `SC.asserts` SHALL have target; scenario addresses correct facet class. | SC schema | observed-target negative; both-class positives | PASS |
| T31 §§54–55 | KB SHALL remain readable as text; no database/server/cloud required; fixture SHALL evolve with each feature; DIV SHALL NOT be manually populated. | YAML conformance slice; local test scripts | clean checkout tests; fixture inspection; no DIV file | PASS |

The scenario-count contradiction between §7.3 R3 and §26.2 is tracked as [SG-0001](../../spec-gaps/SG-0001.md), affecting P007/P014 and not resolved by P001. Observed-target and scope-address grammar is tracked as [SG-0002](../../spec-gaps/SG-0002.md), affecting P007 and later phases; the P001 schema preserves open maps without resolving that decision.
