# P011 traceability (skeleton)

Written at planning time by `kf-phase-planner`. Every status is `TODO`. The implementer fills the Verification column with a test name (`file :: test title`) or a `framework/conformance/p011-decision-table*` case path, and may change a row to `PASS` only with executable evidence that was run. `BLOCKED_BY_DECISION` rows keep `TODO` and name the pending item from `TRIAGE.md`. Line numbers refer to `knowledge-framework-spec-v2.1.md`; "V-nn" and "F-xx" are targets and cases of `PLAN.md`; "E-nnnn" are errata entries.

## Spec clauses

| Clause (line) | Contract | Verification | Status |
|---|---|---|---|
| §11.1 l.582 "decimal de precisión arbitraria" | Business numbers are exact decimals: value equality/order, exact add/subtract/multiply, very long digit strings (V-01, V-02, V-03; F-N1, F-N2, F-N3; E-0017) | | TODO |
| §11.1 l.582 "Coma flotante binaria **SHALL NOT** usarse en la evaluación de reglas" | No binary float anywhere in rule evaluation: doubles-colliding values differ; static scan of the modules (V-02, V-06; F-N1, F-P2) | | TODO |
| §11.1 l.583 "los decimales **SHALL** escribirse como string entrecomillado" | Only quoted strings of the lexical form are decimals; YAML numbers and malformed strings are `INVALID_DECIMAL` (V-04; F-N4, F-Y5; E-0017) | | TODO |
| §11.1 l.583 `KF-W-124` | Not P011 (lint, P007); numbers are rejected as `INVALID_DECIMAL` (V-04; non-goal) | | TODO |
| §11.1 l.584 "Sin declaración, no hay redondeo" | No rounding in P011; division exposes exact quotients only until D-04 (V-05; F-N5; E-0017; BLOCKED_BY_DECISION D-04 for inexact quotients) | | TODO |
| §11.1 l.585 "División por cero → `KF-E-313`" | Not a decision-table matter (T-12); `divideDecimal` throws `DIVISION_BY_ZERO` for P012 (V-05; F-N5; E-0021) | | TODO |
| §11.2 l.589 "Unidad declarada distinta de unidad recibida es ERROR (`KF-E-310`)" | Static `KF-E-310` (literal vs declared unit, bare vs quantity both ways, in lists and ranges) and `KF-E-310` at evaluation (supplied vs declared); never coerced, never `false` (V-20, V-21; F-Q1..F-Q10; E-0019) | | TODO |
| §11.2 l.591 "Esto incluye pares matemáticamente convertibles" | Convertible pairs (`percent_mass`/`ppm_mass`, `percent_mass`/`percent_volume`) are `KF-E-310` (V-20, V-21; F-Q2, F-Q10) | | TODO |
| §11.2 l.591 "`percent` a secas **SHALL NOT** ser una unidad válida ... **SHALL NOT** tratarlas como intercambiables" | No built-in unit; bare `percent` is valid only if a registry declares it; units compare by `id`, never by `dimension`/`symbol` (V-07, V-20; F-U1, F-Q6; E-0018) | | TODO |
| §11.2 l.593-599 `units.yaml` shape | `buildUnitRegistry` accepts exactly `units[]` of `{id, dimension, symbol}` with unique `id` and `conversions: []`; rejects the rest as `INVALID_UNITS` (V-07, V-08; F-U1, F-U2; E-0018) | | TODO |
| §11.2 l.593 "Las unidades se declaran en `extensions/<domain>/units.yaml`" | Discovery and loading of the file is P007; the registry is an explicit, built argument (V-09; F-U3; E-0018, P-05, P-06) | | TODO |
| §11.2 l.602 "**SHALL NOT** añadir nunca conversión inferida" | No conversion function exists; non-empty `conversions` is `INVALID_UNITS` (V-08, V-21; F-U2, F-Q10) | | TODO |
| §11.3 l.606 "`null` **SHALL** significar "ausente", nunca "cero" ni "falso"" | Absent and `null` inputs are identical; null is not zero or false (V-18; F-L2, F-L7) | | TODO |
| §11.3 l.607 "Toda comparación con un operando `null` evalúa a `false`, salvo `is_null`" | Every matcher but `is_null` is `false` on null, including `ne`, `not_in`, `eq: null`; `not` negates the boolean (V-18; F-L1..F-L7; E-0019) | | TODO |
| §11.3 l.608 "Todo `enum` **SHALL** declarar su `domain`" | An enum input without `domain` under `exhaustive: true` is `KF-E-311` `missing_domain`; a missing domain elsewhere is not asserted (V-30; F-X8; E-0020; N-02) | | TODO |
| §11.3 l.608 "Un valor fuera del dominio en un escenario → `KF-E-314`" | `KF-E-314` for a supplied value (even if no row reads it) and for a literal in `when`, wherever it occurs (V-19; F-D1..F-D3; E-0019) | | TODO |
| §11.4 l.612 "Dialecto **RE2** (sin backreferences ni lookaround ...)" | Accepted subset compiles and matches (unanchored, case-sensitive, code points); backreferences, lookaround, named groups, inline flags, Unicode properties, possessive/atomic forms, large counts are rejected (V-10, V-11; F-R1, F-R2; E-0021; D-05 for the fine print) | | TODO |
| §11.4 l.612 "sin backtracking catastrófico ... una regex patológica es un fallo de disponibilidad" | Linear-time matcher; `(a+)+$`-class patterns finish within 5 s; no host `RegExp` on user patterns (V-12, V-13; F-R3, F-P2; E-0021) | | TODO |
| §11.4 l.612 "Patrón no compilable en RE2 → `KF-E-315`" | The table check returns `KF-E-315` with `pointer` and `pattern` for each non-compilable `matches` pattern; near-miss accepted patterns return none (V-11, V-34; F-R2, F-K; E-0021) | | TODO |
| §12 l.616 `logic.kind` closed set | Only `decision-table` is handled; any other kind is `INVALID_TABLE` (V-22; F-Y11) | | TODO |
| §12.1 l.621 predicate grammar | `field: matcher` (several keys = conjunction), `all`, `any`, `not`; key binding by `ref` or suffix; `UNBOUND_FIELD`, `AMBIGUOUS_FIELD`, nested `EMPTY_PREDICATE` (V-15, V-16, V-17; F-O22..F-O26, F-B, F-Y3; E-0019; D-02, D-03, D-08) | | TODO |
| §12.1 l.622 `matcher := literal` | A literal matcher means `eq` (V-14; F-O1..F-O4; E-0019) | | TODO |
| §12.1 l.623 `eq\|ne\|lt\|lte\|gt\|gte` | Comparison semantics by value; range operators only on decimal and quantity inputs (`TYPE_MISMATCH` otherwise) (V-14, V-22; F-O5..F-O11, F-Y4; E-0019) | | TODO |
| §12.1 l.624 `in\|not_in` | Set membership by value/identity; `not_in` is `false` on null (V-14, V-18; F-O12..F-O15, F-L1; E-0019) | | TODO |
| §12.1 l.625 `between` "inclusivo en ambos extremos" | Inclusive at both ends; degenerate range works; `min > max` is `INVALID_RANGE` (V-14, V-22; F-O16..F-O18; E-0019) | | TODO |
| §12.1 l.626 `matches` | RE2 unanchored search; `null` is `false`; non-compilable pattern `KF-E-315` (V-10, V-14, V-18; F-O19, F-O20, F-L1, F-R1; E-0019, E-0021) | | TODO |
| §12.1 l.627 `is_null` | The only test of absence, `true` and `false` (V-14, V-18; F-O21, F-L4; E-0019) | | TODO |
| §12.1 l.628-629 `value := scalar \| quantity`; `quantity := { value: "decimal-string", unit: unit-id }` | Quantity operands compare by value and identical unit; the `value` string is a decimal; undeclared unit `UNKNOWN_UNIT` (V-04, V-09, V-20; F-O11, F-O15, F-O17, F-Q6, F-Y5; E-0017, E-0018) | | TODO |
| §12.1 l.632 `hit_policy: first \| unique \| collect` | Result shapes and document-order semantics per policy; no match is `∅`/`[]` (V-23, V-24, V-25; F-H1..F-H4; E-0020) | | TODO |
| §12.1 l.632 `default` row (E-0020; spec l.634 "fila `when: default`") | At most one; position-independent; matches iff no other row matches; never counts toward overlap (V-26; F-H1..F-H3, F-H5, F-H6, F-Y7; E-0020) | | TODO |
| §12.1 l.633 "`unique` **SHALL** verificar ausencia de solapamiento → `KF-E-312`" | Static overlap check by enumeration (exact) or per-field interval/set reasoning; at evaluation 2+ matching rows is `KF-E-312` (V-24, V-31, V-32, V-33; F-H4, F-V1..F-V7; E-0020; D-06) | | TODO |
| §12.1 l.633 fail closed (E-0020: "any pair not proven disjoint is reported") | Pairs not provably disjoint are reported, including actually-disjoint rows using `any`, `not`, `matches`, `ne`, `not_in` (V-33; F-V7; E-0020) | | TODO |
| §12.1 l.634 "`exhaustive: true` **SHALL** exigir una fila `when: default`" | A `default` row satisfies the clause; `exhaustive: false` is not checked (V-28; F-X1, F-X9) | | TODO |
| §12.1 l.634 "producto cartesiano ... ≤ `logic.exhaustiveness_proof_limit` (default `256`) ... enumera y prueba cobertura total" | Enumeration proves coverage of enum-only inputs, limit inclusive, witness of the first uncovered tuple (V-29; F-X3..F-X6; E-0020; D-06 for order) | | TODO |
| §12.1 l.634 "Fuera de eso → `KF-E-311`" | Non-enum inputs (incl. boolean, quantity), missing domain, product over the limit are `KF-E-311` with `reason`, remediation "añadir `when: default`" (V-30, V-34; F-X2, F-X6, F-X7, F-X8; E-0020) | | TODO |
| §12.1 l.634 "Nada de SAT solver disfrazado de Knowledge Framework" | Only enumeration and per-field interval/set comparison; no solver (V-31, V-32, V-33; design constraint) | | TODO |
| §10.3 l.445-455 BR-0037 example (E-0008(d)) | The example's `logic` yields exactly one `KF-E-311` (`non_enum_input`) and evaluates per E-0019 (V-36; F-A4) | | TODO |
| §26.1 l.1342 `kf check-rules` evaluates `logic` against `given` | Evaluator exists and is usable by P014; no command here (V-36, V-40; F-A1, F-A2; P014 non-goal; D-02 for suffix-keyed `given`) | | TODO |
| §36 l.1600 "Todo diagnostic **SHALL** incluir `remediation` cuando el catálogo defina una" | `KF-E-311` carries the catalog remediation; no other in-scope code has one (V-35, V-38; F-S4, F-S5) | | TODO |
| §42 l.1732 / §42.2 l.1740 `KF-E-010` | Held by D-01 (V-22, V-34; BLOCKED_BY_DECISION D-01) | | TODO |
| §42.2 l.1765 `KF-E-310` | See §11.2 rows (V-20, V-21, V-34) | | TODO |
| §42.2 l.1766 `KF-E-311` | See §12.1 l.634 rows (V-28..V-30, V-34) | | TODO |
| §42.2 l.1767 `KF-E-312` | See §12.1 l.633 rows (V-24, V-31..V-34) | | TODO |
| §42.2 l.1769 `KF-E-314` | See §11.3 rows (V-19, V-34) | | TODO |
| §42.2 l.1770 `KF-E-315` | See §11.4 rows (V-11, V-34) | | TODO |
| §42.2 l.1768 `KF-E-313`, l.1771 `KF-E-316` | Not produced by P011 (formula, P012) (V-05, T-12; non-goal) | | TODO |
| §50 l.1954-1956 `logic:` config | `proofLimit` (default 256) and `precision` are explicit parameters; configuration is read by callers, not P011 (V-05, V-29; F-X6, F-N5; E-0017, E-0020) | | TODO |
| §53 l.2037 item 9 (decimal, unidades sin conversión, RE2) | P011 delivers the decimal/units/RE2 foundation and the decision-table part of `logic`; formula and state machine are P012/P013 (V-01..V-40) | | TODO |
| §55 l.2077 `BR` "uno de cada `rule_kind`" | The existing `acme-formulation` `BR-0001` decision-table facets check clean and evaluate; the observed facet awaits D-08 (V-36; F-A1..F-A3; BLOCKED_BY_DECISION D-08 for A3) | | TODO |
| §55 l.2103 "Cada feature **SHALL** implementarse junto con su porción del fixture, nunca después" | The conformance slice is written by the conformance engineer before the implementation; `expected/` does not exist yet and P011 adds no line to it (V-40; F-A5; Exit criterion 2) | | TODO |

## Errata-only contracts

| Entry | Contract | Verification | Status |
|---|---|---|---|
| E-0017 | `{unscaled: BigInt, scale}`; lexical pattern `^-?[0-9]+(\.[0-9]+)?$`; `INVALID_DECIMAL`; equality by value; explicit `precision` for inexact operations (V-01..V-05) | | TODO |
| E-0018 | Explicit built registry; `UNKNOWN_UNIT`; unit identity by `id`; `conversions` must be `[]` (V-07, V-08, V-09) | | TODO |
| E-0019 | Key binding by `ref`/suffix; literal means `eq`; operator typing (`TYPE_MISMATCH`, `INVALID_RANGE`); quantity vs scalar `KF-E-310` both statically and at evaluation; binary null logic; enum domain `KF-E-314` everywhere (V-14..V-22) | | TODO |
| E-0020 | `default` semantics and result shapes per policy; overlap proof; exhaustiveness proof; `proofLimit` 256 inclusive (V-23..V-33) | | TODO |
| E-0021 | RE2 whitelist and linear matcher; `then` opaque and verbatim, top-level quantity units declared; input types; typed internal codes for uncatalogued failures (V-09..V-13, V-22, V-27) | | TODO |
| E-0008(d) | BR-0037 example is illustrative; its `exhaustive: true` without default yields `KF-E-311` (V-36; F-A4) | | TODO |
| E-0014 (precedent) | Internal typed codes (not `KF-`); engine API only, no `bin/` (V-22, V-40) | | TODO |

## Planner API choices (P-01..P-09 in `TRIAGE.md`)

| Choice | Contract | Verification | Status |
|---|---|---|---|
| P-01, P-02 | Single `LogicError`; `KF-` never thrown, typed errors never in `diagnostics` (V-22, V-35) | | TODO |
| P-03 | Evaluation of a table with static `KF-E-310`/`314`/`315` returns `status: 'error'` (V-19, V-21, F-D3) | | TODO |
| P-04 | Eager validation of supplied values in `inputs[]` order (V-19, V-21; F-D1) | | TODO |
| P-05, P-06 | Explicit built `unitRegistry`; no file reading in P011 (V-09; F-U3) | | TODO |
| P-07 | Canonical `formatDecimal` (V-03; F-N3) | | TODO |
| P-08 | Diagnostic fields, sort key and `reason` strings (V-35; F-S1, F-S2) | | TODO |
| P-09 | Local diagnostic constants until P028 (V-38; F-S5) | | TODO |

## Phase-level targets

| Target | Contract | Verification | Status |
|---|---|---|---|
| V-37 | Inputs never mutated; outputs fresh; repeated calls deep-equal (F-S3) | | TODO |
| V-39 | `npm run build`, `npm run lint`, `npm test`, `git diff --check`; write boundaries; `id-registry.mjs` unchanged; no new dependency | | TODO |
| V-40 | No `bin/`, `package.json`, schema or `expected/` change | | TODO |
