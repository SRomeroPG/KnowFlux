# P011 audit R01

- Audited commit: `dad4d5a3867166eba19108771c8846ae6a50f05d` (product). Control-plane handoff: `099b6bc`. Range audited: `4e4e60d..dad4d5a`, P011 files only.
- Auditors (fresh instances, blind pass confirmed by each): `spec-compliance-auditor` (sonnet), `algorithm-determinism-auditor` (sonnet), `test-conformance-auditor` (sonnet; 184 mutants, 13 real survivors).
- Foreman commands at the audited SHA: `npm run build` (19 schemas), `npm run lint` (clean), `npm test` (505/505), `git diff --check` (clean), `node --test test/conformance-p011-decision-table.test.mjs` (149/149).
- Foreman reproductions (scratchpad `repro-p011.mjs`): F-01 (`compileRe2('(?:(?:(){1000}){1000}){1000}')` 6588 ms; four-level form > 15 s, killed); F-02 (1200-range class under `{1000}){99}` compiles `ok:true` in 8544 ms); F-03 (static check `[]`, evaluation of absent input `KF-E-312`); fixture inspection for F-07 and F-09 (`tables.mjs` l.203-223, `regex.yaml` l.50-51).
- Errata decided during this audit: E-0025 (null in overlap enumeration; "bare scalar" = any non-quantity), E-0026 (literal `null` operands; program-size cap counts the final match).

## Findings

### F-P011-R01-F01 — REQUIRED — HIGH — zero-width nested counted repeats hang `compileRe2`
- Clause: l.612 "Dialecto **RE2** (sin backreferences ni lookaround, sin backtracking catastrófico). Las reglas se evalúan en CI; una regex patológica es un fallo de disponibilidad."; E-0021 (linear time, engine-owned automaton); PLAN V-12 "Pathological patterns and nested counted repeats finish within 5 s".
- Observed: `framework/engine/regex-re2.mjs:279-300` (`sizeOf`) returns 0 for a repeat whose item emits no instruction, so the 100000-instruction cap never trips, while `emitRepeat` (l.370-385) still loops once per count at every nesting level.
- Reproduction: `compileRe2('(?:(?:(){1000}){1000}){1000}')` → `ok:true` after 6588 ms; `(?:(?:(?:(){1000}){1000}){1000}){1000}` does not return within 15 s. Reachable from `checkDecisionTable` / `evaluateDecisionTable` via any `matches` pattern.
- Expected: compile work bounded by a constant multiple of the instruction cap for every pattern (reject as `KF-E-315` or finish well inside 5 s).

### F-P011-R01-F02 — REQUIRED — MEDIUM — class tables copied per instruction copy (compile time and memory)
- Clause: l.612; PLAN V-12; E-0022 D-05 (cap 100000 instructions).
- Observed: `regex-re2.mjs:333-337` pushes a fresh `Int32Array` of the class ranges for every emitted class instruction; cost is program size × class ranges.
- Reproduction: `(?:[1200 distinct code points]{1000}){99}` (program 99001 instructions) → `ok:true` after 8544 ms (auditor: ~1.09 GB RSS).
- Expected: compile time and memory bounded independently of (copies × class size), within the V-12 bound.

### F-P011-R01-F03 — REQUIRED — MEDIUM — `unique` overlap enumeration ignores absent inputs (E-0025 (1))
- Clause: l.633 "`unique` **SHALL** verificar ausencia de solapamiento → `KF-E-312`."; E-0025 (1).
- Observed: `decision-table.mjs:565-598` enumerates only domain values.
- Reproduction: enum `m` domain `[X,Y]`, `unique`, `r1 {not:{m:X}}`, `r2 {m:{is_null:true}}`: `checkDecisionTable` → `[]`; `evaluateDecisionTable(t, {})` → `status:error`, `KF-E-312`.
- Expected: per E-0025 (1): enumeration over domain + `null` (null last) when both products are within the limit, else interval/set reasoning; here `KF-E-312` with a witness containing `null`. Existing assertions at `test/conformance-p011-decision-table.test.mjs` ~l.1070 and `test/p011-decision-table.test.mjs` ~l.735 (`proofLimit: 2`, domain `[X,Y]`, expecting `[]`) must be restated under E-0025.
- Also assert E-0025 (2): an exhaustive enum table without default evaluated with an absent input → `status:ok`, `result:null` (behavior unchanged, currently untested).

### F-P011-R01-F04 — REQUIRED — LOW — quantity versus non-decimal scalar is not `KF-E-310` (E-0019, E-0025 (3))
- Clause: E-0019 "a quantity against a bare scalar (either direction), is `KF-E-310`"; E-0025 (3).
- Observed: a quantity literal against an `enum`/`string`/`boolean` input, or a supplied string/boolean/enum value for a `quantity` input, throws `TYPE_MISMATCH` / `INVALID_DECIMAL` instead of producing `KF-E-310`.
- Expected: `KF-E-310` statically (literal vs declared input type) and at evaluation (supplied value vs declared type), with `found_unit: null` for the non-quantity side.

### F-P011-R01-F05 — REQUIRED — LOW — a key that is one input's full ref and another's suffix binds silently
- Clause: E-0019 "A key matching no input, or a suffix shared by two inputs, is a typed error (`UNBOUND_FIELD` / `AMBIGUOUS_FIELD`)."
- Observed: `decision-table.mjs:142-143` prefers an exact `ref` match. Inputs `x` and `A.x` share the suffix `x`; `when: {x: '1'}` binds to `x` with no error.
- Expected (Foreman reading of E-0019): key `x` is `AMBIGUOUS_FIELD` (both refs have suffix `x`); key `A.x` binds by full ref. Same rule for supplied values (E-0022 D-02).

### F-P011-R01-F06 — REQUIRED — LOW — escape whitelist wider than E-0022 D-05
- Clause: E-0022 D-05 "accepted escapes are escaped metacharacters and `\n \t \r \f \v` ... Anything not listed in E-0021 or here ... is `KF-E-315`."
- Observed: `regex-re2.mjs:88` (`isAsciiPunctuationEscape`) accepts any escaped ASCII punctuation (`\<`, `\=`, `\ `, `\/`, ...).
- Expected: escaped characters accepted only for the metacharacters of the accepted syntax — `\ ^ $ . | ? * + ( ) [ ] { }` and `-` — plus `\n \t \r \f \v` and the class escapes `\d \w \s \D \W \S`; every other escape is `KF-E-315`.

### F-P011-R01-F07 — REQUIRED — MEDIUM — overlap proof: value set versus closed bound not exercised (V-32)
- Clause: l.633; E-0020 (b); PLAN V-32.
- Observed: mutants that treat a closed bound as open in `withinBounds` (`decision-table.mjs:659` / `:663`) survive all tests; `framework/conformance/p011-decision-table/tables.mjs:203-223` pairs a value set with a bound only in the exclusive case. Product code is currently correct.
- Expected cases: `eq "5"` vs `gte "5"`, `eq "5"` vs `lte "5"`, `in ["1","5"]` vs `between ["5","9"]`, `in ["1","2"]` vs `gte "2.0"` → `KF-E-312`; `in ["1","5"]` vs `gt "5"`, `in ["1","5"]` vs `lt "1"` → `[]`.

### F-P011-R01-F08 — REQUIRED — LOW — evaluation diagnostics sort order not exercised (V-35)
- Clause: PLAN "Diagnostic sort key (applied to every returned list, including evaluation diagnostics)"; V-35.
- Observed: removing `sortDiagnostics` from `failure()` in `decision-table.mjs` survives all tests.
- Expected cases: supplied `{e:'W', q: Q(1,ppm)}` on inputs enum `[X]` / quantity `pm` → codes `[KF-E-310, KF-E-314]`; two same-code evaluation diagnostics at `/inputs/2` and `/inputs/10` → `/inputs/10` first (byte order).

### F-P011-R01-F09 — REQUIRED — LOW — `^`/`$` at the start of a `\n`-only text not exercised (V-10)
- Clause: E-0022 D-05 "`^`/`$` match only at the start/end of the whole text".
- Observed: mutant treating "before a final `\n`" as end-of-text at the initial thread survives.
- Expected cases: `^$` on `"\n"` → false; `^$` on `"a\n"` → false; `$` on `"\n"` → true.

### F-P011-R01-F10 — REQUIRED — LOW — program-size cap boundary not exercised on the accept side (V-10, E-0026 (2))
- Clause: E-0022 D-05; E-0026 (2) (the final match counts; exactly 100000 compiles, 100001 is `KF-E-315`).
- Observed: mutant `total > MAX` → `total >= MAX` survives.
- Expected cases: a pattern compiling to exactly 100000 instructions → `ok:true`; one more → `ok:false` / `KF-E-315`.

### F-P011-R01-F11 — REQUIRED — LOW — code-point equality and literal `null` operands not exercised (V-14, V-18; E-0019, E-0026 (1))
- Clause: E-0019 "compare strings, booleans and enum values exactly (case-sensitive, code-point equality)"; E-0026 (1).
- Observed: mutant comparing via `normalize('NFC')` survives; mutant making `ne: null` true for non-null input survives.
- Expected cases: `string` literal U+00E9 vs supplied `e`+U+0301 → not equal (default row); `ne: null` with `"x"` → false; `in: ["x", null]` with `"x"` → true, with `"y"` → false; `not_in: ["y", null]` with `"x"` → false; `not_in: ["y"]` with `"x"` → true. Implement E-0026 (1) where the engine differs.

## ADVISORY (do not block)
- A-01 Match cost is linear with a large constant (48002-instruction program on 20000 chars: 13.6 s); no input-length bound exists in spec or PLAN. Carry to P014 (scenario evaluation budget).
- A-02 `KF-E-311` `product` is a Number or a string depending on magnitude (deterministic).
- A-03 Conservative rejections beyond RE2 (`^*`, literal `{` not a quantifier) and implementer fail-closed choices N-01/N-02/N-03/N-09 and nesting > 1000: accepted as within PLAN latitude.
- A-04 Conformance case F-A5 shells out to `git status` on `bin/`, `package.json` etc.; it fails outside a git checkout or with uncommitted edits to those paths, which will disturb later phases (P028). Recommend the conformance engineer replace it with a committed-content check in a later round.
- A-05 Untested but conservative-only survivors: `sortDiagnostics` prefix rule, empty alternation branches `(a|)`, `fieldDisjoint` with three constraints, duplicated equal bounds, empty unit `dimension`.
- A-06 `HANDOFF.md` and `TRACEABILITY.md` rows 25/27/53 still describe the 3 disputed conformance failures fixed in `5712486`; TRACEABILITY PASS rows for V-10, V-14, V-18, V-32, V-35 overstate coverage (see F07-F11). Update in remediation.
- A-07 Boundary note: the `PENDING` flip and `status: enforced` in `dad4d5a` were authored by the conformance engineer at the Foreman's request, not by the implementer; no boundary violation.

## Remediation routing
1. Fresh `kf-conformance-engineer`: add the cases of F03 (incl. restating the `proofLimit: 2` assertion under E-0025), F04, F05, F06, F07, F08, F09, F10, F11, plus regression cases for F01/F02 (the patterns above must finish within the V-12 bound), from spec + errata + this file only, before reading the remediation diff.
2. Fresh `kf-implementer` (remediation mode): fix F01-F06 and F11's E-0026 behavior; update unit tests, TRACEABILITY, HANDOFF; `remediation/REMEDIATION_R01.md`.

VERDICT: CHANGES_REQUESTED
