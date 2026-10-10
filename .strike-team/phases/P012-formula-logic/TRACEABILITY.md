# P012 traceability

Skeleton written at planning time by `kf-phase-planner` at base `46295d172d10de87c99ca9d3f3b3a26375118e04`. One row per normative clause in scope. The **Contract** column names the plan cases (`F-xx`) and verification targets (`V-nn`) that the row is held to; the **Verification** column is filled by `kf-implementer` with a test name (`FILE :: title`) or a case path (`framework/conformance/p012-formula.yaml#F-xx`); the **Status** column is `TODO` until executable evidence exists, then `PASS`, `FAIL`, or `BLOCKED_BY_DECISION D-nn`. Nothing is `PASS` at planning time. Legend for the implementer: `DO` = `test/p012-decimal-ops.test.mjs`, `FM` = `test/p012-formula.test.mjs`, `CF` = `test/conformance-p012-formula.test.mjs` (names are suggestions; the implementer may use others).

## Spec clauses

| Clause (line) | Contract | Verification | Status |
|---|---|---|---|
| §11.1 l.582 "decimal de precisión arbitraria" | Formula values are exact decimals: add/subtract/multiply/divide/min/max/abs/clamp exact, 30-digit products, 2^53 pairs, 2,000-digit constants (V-01, V-02, V-03, V-34; F-O1..O8, F-N3, F-V10) | | TODO |
| §11.1 l.582 "Coma flotante binaria **SHALL NOT** usarse en la evaluación de reglas" | No binary float in `formula.mjs` or `decimal-ops.mjs`: doubles-colliding values differ; static scan (V-01, V-36; F-O1, F-P2) | | TODO |
| §11.1 l.583 "los decimales **SHALL** escribirse como string entrecomillado" | A `const`, supplied value or quantity `value` that is a number or off-pattern string is `INVALID_DECIMAL` (V-05; F-X2) | | TODO |
| §11.1 l.584 "El redondeo **SHALL** declararse explícitamente" | `rounding {mode, decimals}` is the only rounding: four modes, positives, negatives, ties, zero sign, `decimals` rendering with no cap; malformed `rounding` is `INVALID_EXPRESSION` (V-18, V-21, V-22; F-R1..R7, F-W5, F-M2) | | TODO |
| §11.1 l.584 "Sin declaración, no hay redondeo" | Without a `rounding` block nothing is rounded and the value is canonical; `round` without a block is `INVALID_EXPRESSION`; an inexact quotient without a block is `INEXACT_DIVISION` (V-22, V-23; F-R4, F-R6, F-V2) | | TODO |
| §11.1 l.585 "División por cero → `KF-E-313` en validación" | Static `KF-E-313` for unprotected and constant-zero divisors; static findings block evaluation (V-25, V-26, V-27; F-Z, F-Zs; D-02 holds the extra sound forms) | | TODO |
| §11.1 l.585 "o el `guard` declarado en tiempo de evaluación" | A guard on the bare-ref divisor protects the division and raises at evaluation; protected runtime cases (V-25; F-Zb, F-Zr) | | TODO |
| §11.2 l.589 "Unidad declarada distinta de unidad recibida es ERROR (`KF-E-310`)" | `KF-E-310` for operand mismatch, output mismatch, predicate literals and supplied values; never coerced (V-08, V-09, V-12, V-24; F-U1..U3, F-U7, F-G5, F-W6) | | TODO |
| §11.2 l.591 "Esto incluye pares matemáticamente convertibles" | `percent_mass` vs `ppm_mass` (same dimension) is `KF-E-310` in operands and in the output check (V-08, V-12; F-U1, F-U7) | | TODO |
| §11.2 l.591 "`percent` a secas **SHALL NOT** ser una unidad válida ... **SHALL NOT** tratarlas como intercambiables" | No built-in unit: bare `percent` as `output.unit` or `const.unit` is `UNKNOWN_UNIT` under a registry that does not declare it; `percent_*` variants never interchangeable (V-05, V-12; F-X3, F-U7, F-W8) | | TODO |
| §11.2 l.593 "Las unidades se declaran en `extensions/<domain>/units.yaml`" | The registry is an explicit, built argument; discovery is P007 (V-07; F-B1) | | TODO |
| §11.2 l.597-599 `units.yaml` shape | Formula tests build registries from the l.596-599 shape through `buildUnitRegistry` (UF0, UF1, UF2) (V-07, V-12; F-B1, F-U7) | | TODO |
| §11.2 l.602 "**SHALL NOT** añadir nunca conversión inferida" | No conversion function exists; `multiply`/`divide` never look up a unit by name or dimension (V-11; F-U6 under UF2) | | TODO |
| §11.3 l.606 "`null` **SHALL** significar "ausente", nunca "cero" ni "falso"" | Null propagates through arithmetic and is not zero (V-20; F-L1..L5) | | TODO |
| §11.3 l.607 "Toda comparación con un operando `null` evalúa a `false`, salvo `is_null`" | Guards and `if` conditions on `null` are false except `is_null`; `not` over null is true (V-16, V-17, V-20; F-G4, F-I1, F-I3) | | TODO |
| §11.3 l.608 "Todo `enum` **SHALL** declarar su `domain`. Un valor fuera del dominio ... `KF-E-314`" | `KF-E-314` for out-of-domain literals in guards and conditions and for supplied values (V-16, V-24; F-G5, F-I4, F-T2) | | TODO |
| §11.4 l.612 "Patrón no compilable en RE2 → `KF-E-315`" | `matches` patterns in guards/conditions: `KF-E-315` with the pattern pointer; accepted patterns clean (V-16, V-29; F-G5, F-I4, F-K1) | | TODO |
| §12 l.616 `logic.kind` closed set | `kind` other than `formula` is `INVALID_EXPRESSION` (V-04; F-X1) | | TODO |
| §12.1 l.621-629 predicate grammar | Guards and `if.cond` accept every matcher and combinator with P011 semantics; `{}` and empty combinators are `EMPTY_PREDICATE` (V-16, V-17; F-G4, F-X6, F-I5) | | TODO |
| §12.2 l.638 "Expresión estructurada, no string: sin parser, sin ejecución de código arbitrario" | A string expression is `INVALID_EXPRESSION`; no `eval`/`new Function` in the module (V-04, V-36; F-X1, F-P2) | | TODO |
| §12.2 l.641-652 worked example | The example loaded from the spec file checks clean and evaluates end to end; mutations (V-14, V-18, V-19, V-24; F-W1..W8) | | TODO |
| §12.2 l.655 "Operadores: `add · subtract · multiply · divide · min · max · abs · round · clamp · if`" | All ten operators implemented; unknown `op` is `INVALID_EXPRESSION` (V-01..V-04, V-17, V-22; F-O1..O8, F-I, F-R6, F-X1) | | TODO |
| §12.2 l.656 "`if` toma `{cond: predicate, then: expr, else: expr}`" | Exactly that key set; lazy selection; `null` condition is false (V-17; F-I1..I6, F-X1) | | TODO |
| §12.2 l.660 "todos los operandos **SHALL** tener unidad idéntica; el resultado la conserva" | Identity by unit id for `add`, `subtract`, `min`, `max`, `clamp` and the `if` branches; result keeps the unit (V-08, V-09, V-13; F-U1..U3, F-U8) | | TODO |
| §12.2 l.661 "Si la dimensión resultante no existe en `units.yaml` → `KF-E-316`" | Inadmissible `multiply`/`divide` monomials are `KF-E-316` on the node; admissible results are clean (V-10, V-11; F-U4, F-U6; D-01 holds the complete lists) | | TODO |
| §12.2 l.662 "`const` sin unidad es adimensional" | Unit-less `const` has the empty monomial; `const` with a registered unit carries it (V-10; F-U4, F-U5) | | TODO |
| §12.2 l.663 "La unidad calculada **SHALL** coincidir con `output.unit` → `KF-E-310`" | Output check by id; dimensionless output needs a registered `dimensionless` unit; unknown output unit is `UNKNOWN_UNIT` (V-12; F-U7) | | TODO |
| §36 l.1600 "Todo diagnostic **SHALL** incluir `remediation` cuando el catálogo defina una" | `KF-E-313` carries "añadir `guard`"; no other formula diagnostic carries `remediation` (V-27, V-29, V-32; F-Zd, F-S4, F-S5) | | TODO |
| §42.2 l.1765 `KF-E-310` | Unit diagnostics shape and pointers (V-08, V-12, V-24; F-U, F-W6) | | TODO |
| §42.2 l.1768 `KF-E-313` | Row copied into `FORMULA_DIAGNOSTIC_CATALOG` (V-32; F-S5) and produced by the protection proof (V-25, V-26) | | TODO |
| §42.2 l.1769 `KF-E-314` | Predicate and supplied-value findings (V-16, V-24; F-G5, F-T2) | | TODO |
| §42.2 l.1770 `KF-E-315` | Predicate pattern findings (V-16; F-G5, F-I4) | | TODO |
| §42.2 l.1771 `KF-E-316` | Row copied into `FORMULA_DIAGNOSTIC_CATALOG` (V-32; F-S5) and produced by the unit algebra (V-11) | | TODO |
| §50 l.1953-1956 `logic: decimal_precision: 28` | `DEFAULT_PRECISION = 28`; `precision` is an explicit option; configuration is read by P007 (V-23, V-07; F-V, F-B3) | | TODO |
| §53 l.2037 item 9 | Formula part of build item 9 delivered with its fixture slice (V-14, V-35; F-W, F-E1) | | TODO |
| §55 l.2077 "8 `BR` (uno de cada `rule_kind`" | No formula `BR` added in P012; the reason and the downstream owner are in PLAN "Fixture slice" and `HANDOFF.md` (V-35; F-E1) | | TODO |
| §55 l.2103 "El fixture es la definición operativa de "terminado"" | The slice (`framework/conformance/p012-formula.yaml` + data + test) was written before the implementer read it (Exit criterion 2) | | TODO |

## Errata decisions

| Clause | Contract | Verification | Status |
|---|---|---|---|
| E-0017 explicit precision | `precision` is an explicit option of `divideDecimal`/formulas; `INVALID_DECIMAL` for non-strings (V-05, V-23, V-33; F-X2, F-V8, F-M4) | | TODO |
| E-0018 registry, `UNKNOWN_UNIT`, identity by id | Unknown `const.unit`, `output.unit`, input unit; identity by id only (V-05, V-08, V-12; F-X3, F-U1, F-U7) | | TODO |
| E-0019 binding, types, null, enums | Predicate reuse; `ref` binding; binary null logic (V-06, V-16, V-20; F-X4, F-G4, F-L) | | TODO |
| E-0022 D-01, D-03 | No JSON Schema validation, no `KF-E-010`; `all: []`/`any: []` are `EMPTY_PREDICATE` (V-16, V-38; F-X6, F-K1) | | TODO |
| E-0025 (3), E-0027 (3) | Quantity vs any non-quantity value is `KF-E-310` in predicates and supplied values (V-24; F-G5, F-W6) | | TODO |
| E-0030 (1) | Unit monomials: quantity ref `{u:1}`, decimal ref `{}`, `const` `{}` / `{u:1}` (V-10; F-U4, F-U5) | | TODO |
| E-0030 (2) | Identity by unit id for the add family, `clamp`, `if` (V-08, V-09; F-U1..U3) | | TODO |
| E-0030 (3) | `multiply`/`divide` add/subtract exponents; admissible only `{}` or one registered id exponent 1; else `KF-E-316` on the node (V-10, V-11; F-U4, F-U6; D-01 for cascades) | | TODO |
| E-0030 (4) | Output check, including `dimension: dimensionless` (V-12; F-U7; D-01 for the interaction with `KF-E-316`) | | TODO |
| E-0030 (5) | `abs`/`round` keep the monomial; all unit checks static and cover both `if` branches (V-09, V-13; F-U3, F-U8, F-U9, F-I4) | | TODO |
| E-0031 (1) | Caller-supplied `inputs`; binding; operands only `quantity`/`decimal`; predicates over every type (V-06, V-07, V-16; F-X4, F-X5, F-B2, F-G4) | | TODO |
| E-0031 (2) | Guards in document order before the expression; first true raises `{status: 'raised', outcome, value: null}`; `raise` pattern only; empty `when` is `EMPTY_PREDICATE` (V-15, V-16; F-G1..G3, F-X1, F-X6) | | TODO |
| E-0031 (3) | Lazy `if`; null condition false; both branches checked statically (V-17; F-I1..I4) | | TODO |
| E-0031 (4) | Null propagation; null divisor is `null`; rounding of `null` is `null` (V-20; F-L1..L5) | | TODO |
| E-0032 (1) | `rounding` applied once to the final non-null result; `round(x)` takes one argument and applies it there; `round` without a block is `INVALID_EXPRESSION` (V-22; F-R5, F-R6) | | TODO |
| E-0032 (2) | Modes `half-even`, `half-up`, `down`, `up`; `decimals` a non-negative integer, no cap; exact digits, negative zero renders non-negative (V-18, V-21, V-22; F-R1..R3, F-W5, F-M2) | | TODO |
| E-0032 (3) | Exact quotients; inexact with a block rounds to `precision` significant digits then again; without a block `INEXACT_DIVISION`; `precision` default 28 (V-23; F-V1..V8, F-M4; D-03 for F-V9) | | TODO |
| E-0032 (4) | Protection proof (a) constant nonzero, (b) guard on bare-ref divisor, (c) `if` condition then/else; constant zero never protected; the rest `KF-E-313` (V-25, V-26; F-Za, F-Zb, F-Zc, F-Zn1..Zn8; D-02 for extra sound forms) | | TODO |
| E-0032 (5) | Static findings block evaluation; `DIVISION_BY_ZERO` only defensive (V-27, V-33; F-Zs, F-T1, F-M4) | | TODO |
| E-0032 (6) | No digit cap; nesting depth limit 1000 (`INVALID_EXPRESSION`) (V-34; F-N1..N3) | | TODO |
| E-0033 arity | `subtract`/`divide` 2; `add`/`multiply`/`min`/`max` `>= 1` left fold; `abs`/`round` 1; `clamp` 3 with runtime `INVALID_RANGE`; else `INVALID_EXPRESSION` (V-01..V-04; F-O1..O8, F-X1) | | TODO |
| E-0033 diagnostics inventory | Returned `KF-E-310/313/314/315/316`; thrown `INVALID_EXPRESSION`, `INEXACT_DIVISION`, `DIVISION_BY_ZERO`, `INVALID_RANGE` + P011 codes; `KF-E-311/312/010` never; `INVALID_TABLE` never thrown by P012 (V-29, V-32, V-38; F-K1, F-S4, F-S5) | | TODO |

## Plan-level contracts (planner API choices, TRIAGE P-01..P-11)

| Clause | Contract | Verification | Status |
|---|---|---|---|
| P-01, P-02 module layout and additive edits | `decimal.mjs`, `units.mjs`, `regex-re2.mjs` unchanged; three P011 modules extended by added lines only; P011 constants and tests unchanged (V-32, V-35; F-S5, F-E2) | | TODO |
| P-03, P-04, P-05 result shape, quantity value, rendering | `FormulaResult` shape; `{value, unit}`; canonical form without a block, fixed scale with one (V-14, V-22; F-W, F-R3, F-R4) | | TODO |
| P-06 diagnostic fields | Fields, pointers and unit text of `KF-E-310/313/316` (V-08, V-11, V-26, V-29; F-U, F-Zd, F-S1) | | TODO |
| P-07 order of work | Static findings before value binding; supplied-value findings before guards (V-24, V-28; F-T1, F-T2, F-W6) | | TODO |
| P-08 options | `INVALID_ARGUMENT` for registry, `inputs`, `precision`, `values` (V-07; F-B1..B4) | | TODO |
| P-09 predicate wrappers | `INVALID_TABLE` re-thrown as `INVALID_EXPRESSION`; findings with `rule: null` (V-16, V-38; F-X6, F-S4) | | TODO |
| P-10 `raise` pattern | `^OUT-[0-9]{4,}$` by hand-written check (V-04; F-X1) | | TODO |
| P-11 left-to-right evaluation | Left fold of `add`/`multiply`/`min`/`max` (V-01, V-03; F-O1..O5) | | TODO |

## Held by open decisions

| Item | Held assertions | Verification | Status |
|---|---|---|---|
| D-01 | Complete diagnostic lists with `KF-E-316` (F-U6, F-I4 `KF-E-316` case, F-S1b); the unit-flow design in `formula.mjs` | | TODO (BLOCKED_BY_DECISION D-01 for the held part) |
| D-02 | F-Z "Pending (D-02)" rows | | TODO (BLOCKED_BY_DECISION D-02) |
| D-03 | F-V9 | | TODO (BLOCKED_BY_DECISION D-03) |
