# P028 — CLI Backbone and Conformance Runner

## Objective
Give the project its first runnable `kf` command and the §55 scoreboard harness, so every later phase ships a command plus its conformance slice together. Adds the `bin/kf.mjs` entry point, `kf --version`, greenfield `kf init`, a schema-level `kf validate`, and a data-driven runner over `framework/conformance/expected/` that replaces the hand manifest in `test/p001-schema.test.mjs`. Supports §53 A5 (P007 builds on it) and §56 item 1. Risk MEDIUM.

## Entry gate
- P001 ACCEPTED (schemas in `framework/schemas/` and the partial `acme-formulation` fixture exist). No dependency on P002.
- `STATE.yaml` shows P028 `PLANNED`. Errata E-0005 (resolves SG-0001) is read before the exit-code and envelope behavior is finalized, if it touches either.

## Normative coverage

| Source (spec line) | Contract |
|---|---|
| §9 (325) | Project layout: `knowledge.config.yaml`, `glossary.yaml`, `knowledge/`, `divergences/`, `changes/`, `mappings/`, `golden-master/`, `work/`, `extensions/`, `generated/`, `.kf/`. `kf init` scaffolds this tree. |
| §9.1 (354) | Authored/derived/generated/operational classes; `.kf/` is operational and command-written only. |
| §10.3 (90, 465) | "`kf init --greenfield` **SHALL NOT** crear el directorio `observed/`"; a greenfield project **SHALL** operate without the word "faceta". |
| §36 (1580) | Binary `kf`; every command accepts `--format text\|json` and `--workspace <path>`; JSON envelope (`kf_version`, `knowledge_release`, `command`, `ok`, `data`, `diagnostics`, `epistemic_header`). Diagnostics **SHALL** carry `remediation` when the catalog defines one and be generated from the catalog, not hand-written. |
| §36.1 (1602) | Exit codes: `0` OK, `1` validation errors, `2` warnings only with `--strict`, `3` usage error, `4` internal error, `5` resource unavailable. |
| §37 (1606) | Command surface names (`init`, `validate` in scope here); the binary name `kf` never changes. |
| §42.1 (1730) | Each type has a JSON Schema in `framework/schemas/`; value outside enum yields `KF-E-010`. Schema-level `kf validate` uses the existing P001 schemas. |
| §55 (2075) | Conformance equals reproducing `conformance/expected/`; "Cada feature **SHALL** implementarse junto con su porción del fixture, nunca después". |
| §56 item 1 (2107) | Initialize a Knowledge Project (greenfield, no visible facets). |

Re-verify every line number above with `sed -n` against the frozen spec before relying on it. Note: §36 cites the catalog as §44.2, while the catalog heading is §42.2 (line 1734). Do not act on the discrepancy; record it in the traceability file.

## Deliverables and boundary
1. `bin/kf.mjs` and a `bin` entry in `package.json`; `kf --version` prints the engine version; global `--format` and `--workspace` parsing; usage errors exit `3`, internal errors `4`.
2. `kf init [--greenfield]`: scaffolds the §9 tree into `--workspace` (default cwd), writes `knowledge.config.yaml`, `glossary.yaml`, `.kf/`; no `observed/` directories; refuses to overwrite an existing project (exit `3`); a failed run leaves no partial tree.
3. `kf validate`: schema-level only, using the P001 schemas; emits the §36 envelope in `json` format and the §36.1 exit codes (`--strict` turns warnings into exit `2`). Diagnostics come from a catalog module, not inline strings.
4. A data-driven runner that reads `framework/conformance/expected/` (command, args, workspace fixture, expected exit code, expected envelope subset) and executes each case; replaces the hand manifest in `test/p001-schema.test.mjs` with no loss of existing positive/negative coverage. The runner reports the §55 scoreboard (`REPRODUCED` / `NOT_RUNNABLE` / `FAILING` per line) and feeds `.strike-team/SCOREBOARD.md`.
5. CI workflow running build, typecheck, lint and test on ubuntu and windows.

Non-goals: semantic rules, reference integrity, catalog completeness, `kf build`, `kf context`, `kf create` and ID allocation (P002), any command beyond `init` and `validate`.

## Design constraints
- Fixture independence: `framework/conformance/expected/` is written by the conformance engineer before reading implementer code. Expected values come from the spec text, never from observed CLI output.
- The CLI is a thin layer: parsing, envelope assembly, exit-code mapping. Validation logic lives in `framework/engine/` modules callable without the CLI.
- Deterministic output: sorted diagnostics, stable key order, no timestamps in envelopes unless the spec defines them, LF line endings on all platforms.
- Output is byte-identical on ubuntu and windows (paths normalized to forward slashes in diagnostics).
- Do not invent diagnostic codes; use only codes defined in §42.2. A needed code the catalog lacks is a gap for the Foreman, not an implementer choice.
- `knowledge_release` and `epistemic_header` are populated only as far as the frozen spec defines; unknown values are explicit and documented in traceability.

## Implementation sequence
1. Conformance engineer writes `expected/` cases for `--version`, `init` (tree contents, no `observed/`, refusal on rerun) and `validate` (clean fixture exit 0; schema violation exit 1 with `KF-E-010`; `--strict`; usage error exit 3), from the spec only.
2. Implementer adds `bin/kf.mjs`, argument parsing, envelope and exit-code mapping, with tests failing first against `expected/`.
3. Implement `kf init`, then schema-level `kf validate` over the P001 schemas.
4. Build the data-driven runner; port every case from the hand manifest in `test/p001-schema.test.mjs`; delete the manifest only after parity is demonstrated.
5. Add the CI workflow; run the full suite on both operating systems.
6. Write traceability with executable evidence and hand off for audit.

## Verification targets
- `kf --version` exits 0; `kf bogus` exits 3; a forced internal fault exits 4; a missing workspace path exits 5.
- `kf init` on an empty directory yields exactly the §9 greenfield tree, no `observed/`; a second run exits 3 and changes nothing.
- `kf validate --format json` output validates against an envelope schema; two runs are byte-identical; `--strict` on warnings-only input exits 2.
- Runner parity: the count and identity of P001 positive/negative cases is unchanged after replacing the manifest (set-equality check).
- A deliberately broken `expected/` case makes the runner fail (the runner is itself tested).
- Clean checkout: `npm ci` then build, typecheck, lint and test pass on ubuntu and windows CI.

## Risk and ownership
MEDIUM: low semantic risk, but the envelope, exit codes and runner shape become the contract every later phase builds on. The Foreman owns scope; the implementer owns `bin/` and `framework/engine/`; the conformance engineer owns `framework/conformance/expected/` and the runner tests. No overlapping edits.

## Exit criteria
All deliverables implemented with executable evidence; runner parity with the old manifest proven; CI green on both operating systems; traceability maps every clause above to code and tests; HANDOFF.md names the exact product commit. An independent audit alone decides acceptance, after which SCOREBOARD.md is updated.
