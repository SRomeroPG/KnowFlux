# P012 - Formula Logic


## Foreman decisions after planning (binding; supersedes every "Pending (D-nn)" below)

D-01..D-03 are decided by errata **E-0036** (2026-10-10). Every assertion marked pending is now asserted in full:

- D-01: option 1. A `KF-E-316` node has an unknown unit; parents report nothing further about it; the output check is skipped when the computed unit is unknown. One finding per defect.
- D-02: option 2 (semantic). A guard protects a division by bare ref R when its `when` mentions only R and is true at R = zero (the zero quantity in R's unit for quantities). An `if` protects `then` when `cond` mentions only R and is false at R = zero, and protects `else` when it is true at R = zero. The rows marked "Pending (D-02)" (e.g. `lt "1"`, `ne "5"`, `is_null: false`, `gt "1"` as a then-condition) are asserted per this criterion.
- D-03: option 1. Significant digits count the normalized coefficient (trailing zeros stripped); `10^32 / 1` is exact.
- P-02 accepted: P011 modules are extended additively only (appended exports); `decimal.mjs`, `units.mjs`, `regex-re2.mjs`, all P011 constants, tests and fixtures stay byte-identical.
Planned at base `46295d172d10de87c99ca9d3f3b3a26375118e04`. Spec triage, the Foreman's decisions (E-0030..E-0033), the planner API choices (P-01..P-11) and the three planning-time `DECISION_NEEDED` items (D-01..D-03) are in `TRIAGE.md`. Every assertion held by an open D-nn is marked "pending (D-nn)" below and in `TRACEABILITY.md`; nothing is implemented by guess.

## Objective and authorization

Implement §53 item 9, second part (C9b): the executable `formula` grammar of §12.2 on top of the P011 foundation.

- A static checker for formulas: unit algebra (`KF-E-310`, `KF-E-316`), the output-unit check (`KF-E-310`), the division-by-zero protection proof (`KF-E-313`), and the predicate findings of guards and `if` conditions (`KF-E-310`, `KF-E-314`, `KF-E-315`, reusing the P011 predicate machinery).
- A pure evaluator: guards in document order (first true guard raises an `OUT` id), a lazy `if`, exact decimal arithmetic, null propagation, explicit rounding, and division with an explicit `precision` (E-0030..E-0033).
- A small exact-decimal operations module (absolute value, division, rounding, fixed-scale rendering) that P011 deliberately left out (E-0022 D-04).

Authorization: the `PHASES.md` row `| P012 Formula Logic; C9b | §§11, 12.2 | P011 | B | Expression evaluator and unit algebra; rounding/guard cases | HIGH | PLANNED |`, opened by the Foreman under `PROTOCOL_V2.md`. P012 is an **engine API phase** like P011: no `bin/`, no `kf` command, no `package.json` change, no new dependency, no schema change (P007 wires `kf validate`, P014 wires `kf check-rules`).

Size: two new modules (about 900-1,300 lines expected for `formula.mjs`, about 250 for `decimal-ops.mjs`), three small additive edits to P011 modules, three test files. One audit round is feasible; no split is proposed. State machines and narrative stay in P013.

## Entry gate

- P011 is `ACCEPTED`: `.strike-team/phases/P011-decision-table-logic/audits/AUDIT_R02.md` carries `VERDICT: ACCEPTED` (line 50); product SHA `0e8f741ac3aecf410f45cfd73e4609372c46c8ec`, acceptance commit `1737891`. The engine modules P012 builds on are unchanged since that product SHA (`git log` of `framework/engine/{logic-errors,decimal,units,regex-re2,logic-diagnostics,decision-table}.mjs` ends at `0e8f741`).
- `STATE.yaml` and `PHASES.md` show P011 `ACCEPTED` and P012 `PLANNED`/`READY` as set by the Foreman.
- Errata E-0030..E-0033 are committed (`46295d1`). Read in full before work: E-0008 (a) and (d), E-0014 (precedent), E-0017, E-0018, E-0019, E-0020 (context only), E-0021, E-0022, E-0025, E-0026, E-0027, E-0030, E-0031, E-0032, E-0033.
- Base commit when this plan was written: `46295d172d10de87c99ca9d3f3b3a26375118e04`. **Gate: `TRIAGE.md`, this plan and `TRACEABILITY.md` are committed, and `git status` shows no uncommitted change under `.strike-team/phases/P012-formula-logic/`, `framework/engine/`, `framework/conformance/p012-*` or `test/`, before the conformance engineer is briefed.** The Foreman records the resulting SHA in the briefs (`ENTRY_SHA = <fill>`). P002 (round R02 remediation) may run concurrently on disjoint paths (`framework/engine/id-registry*.mjs`, `framework/conformance/p002-*`, `test/*p002*`); P012 never touches them. At the time of planning the working tree has an uncommitted P002 edit to `framework/conformance/p002-id-registry/scenarios.mjs`, which is outside every P012 path.
- Open decisions D-01..D-03 do not gate the conformance engineer or the start of implementation; they gate only the assertions listed under "Blocked until decided".
- Tooling facts (inherited from P011): Node `>=24`; `eslint.config.js` declares only the globals `process console URL Buffer setTimeout clearTimeout` plus the ES builtins. `structuredClone`, `performance`, `TextEncoder` are **not** declared: import them (`node:perf_hooks`) or avoid them. Nobody in this phase edits `eslint.config.js`.

## Normative coverage

Line numbers are those of `knowledge-framework-spec-v2.1.md` and were verified with `sed -n`/`grep -n`. Quotes are verbatim (Spanish prose, English keywords). "E-" entries are binding decisions that refine or fill a clause; they never override a SHALL.

| § | Contract | Verbatim clause fragments (line) | Errata |
|---|---|---|---|
| §11.1 | Business numbers are exact arbitrary-precision decimals; no binary float in any formula operation. | l.582 "Todo valor numérico de negocio **SHALL** evaluarse como **decimal de precisión arbitraria**. Coma flotante binaria **SHALL NOT** usarse en la evaluación de reglas." | E-0017 |
| §11.1 | Quoted-string decimals only; a `const` that is a YAML number or off-pattern is `INVALID_DECIMAL`. `KF-W-124` is not P012's. | l.583 "En YAML, los decimales **SHALL** escribirse como string entrecomillado (`"4.2"`) para evitar que el parser los convierta a float." | E-0017 |
| §11.1 | Rounding exists only where declared, with the four modes and `decimals`; none otherwise. | l.584 "El redondeo **SHALL** declararse explícitamente donde se aplique: `rounding: {mode: half-even \| half-up \| down \| up, decimals: N}`. Sin declaración, no hay redondeo." | E-0032 (1), (2), (3) |
| §11.1 | Division by zero is `KF-E-313` at validation, or the declared `guard` at evaluation. | l.585 "División por cero → `KF-E-313` en validación, o el `guard` declarado en tiempo de evaluación." | E-0032 (4), (5) |
| §11.2 | No automatic unit conversion; a declared unit different from the received unit is `KF-E-310`. | l.589 "**En v1 NO existe conversión automática de unidades. Unidad declarada distinta de unidad recibida es ERROR (`KF-E-310`).**" | E-0018, E-0030 (2) |
| §11.2 | Convertible pairs are still errors; the `percent_*` units are never interchangeable; no built-in unit. | l.591 "Esto incluye pares matemáticamente convertibles. `percent` frente a `ppm` es error. Y `percent` a secas **SHALL NOT** ser una unidad válida en un dominio donde exista ambigüedad masa/volumen: el framework distribuye `percent_mass`, `percent_volume`, `percent_mass_per_volume` y **SHALL NOT** tratarlas como intercambiables." | E-0018, E-0030 (2) |
| §11.2 | Units come from the `units.yaml` shape; `conversions` empty; no inferred conversion, ever. | l.593 "Las unidades se declaran en `extensions/<domain>/units.yaml`:"; l.597-599 `- {id: percent_mass, dimension: mass_fraction, symbol: "% m/m"}` / `- {id: ppm_mass, dimension: mass_fraction, symbol: "ppm"}` / `conversions: []     # vacío en v1; futuras conversiones serán explícitas y nombradas`; l.602 "**SHALL NOT** añadir nunca conversión inferida." | E-0018, E-0030 (3) |
| §11.3 | `null` means absent, never zero or false; every comparison with a `null` operand is `false` except `is_null`. | l.606 "`null` **SHALL** significar "ausente", nunca "cero" ni "falso"."; l.607 "Toda comparación con un operando `null` evalúa a `false`, salvo `is_null`." | E-0019, E-0031 (3), (4) |
| §11.3 | Out-of-domain enum literal or value is `KF-E-314` (in guard and `if` predicates). | l.608 "Todo `enum` **SHALL** declarar su `domain`. Un valor fuera del dominio en un escenario → `KF-E-314`." | E-0019, E-0033 |
| §11.4 | `matches` patterns in guards and conditions follow the RE2 subset; uncompilable is `KF-E-315`. | l.612 "Dialecto **RE2** (sin backreferences ni lookaround, sin backtracking catastrófico). ... Patrón no compilable en RE2 → `KF-E-315`." | E-0021, E-0022 D-05, E-0033 |
| §12 | `formula` is one of the four closed kinds. | l.616 "`logic.kind` ∈ `decision-table \| formula \| state-machine \| narrative`. Las cuatro quedan cerradas en v2.1." | E-0033 (`INVALID_EXPRESSION`) |
| §12.1 | Guards and `if.cond` are the `predicate` of the decision-table grammar. | l.621 "predicate := { field: matcher } \| { all: [predicate] } \| { any: [predicate] } \| { not: predicate }"; l.623-627 matchers `{ eq\|ne\|lt\|lte\|gt\|gte: value }`, `{ in\|not_in: [value] }`, `{ between: [min, max] }`, `{ matches: re2-pattern }`, `{ is_null: bool }`; l.628-629 `value := scalar \| quantity`, `quantity := { value: "decimal-string", unit: unit-id }` | E-0019, E-0022, E-0031 (1) |
| §12.2 | A formula is a structured expression, not a string: no parser, no code execution. | l.638 "Expresión estructurada, no string: sin parser, sin ejecución de código arbitrario." | E-0033 |
| §12.2 | The worked example is the end-to-end case. | l.641-652 `logic:` / `kind: formula` / `output: {ref: DE-0017.adjusted_concentration, unit: percent_mass}` / `expression:` / `op: multiply` / `args:` / `- {ref: DE-0017.concentration}` / `- {op: subtract, args: [{const: "1"}, {ref: DE-0017.loss_factor}]}` / `rounding: {mode: half-even, decimals: 4}` / `guards:` / `- when: {DE-0017.loss_factor: {gte: "1"}}` / `raise: OUT-0011` (fenced block l.640-653) | E-0030 rationale, E-0031 (2) |
| §12.2 | Operators; `if` form. | l.655 "Operadores: `add · subtract · multiply · divide · min · max · abs · round · clamp · if`."; l.656 "`if` toma `{cond: predicate, then: expr, else: expr}`." | E-0033 (arity), E-0031 (3) |
| §12.2 | Unit algebra, mandatory. | l.658 "**Álgebra de unidades, obligatoria:**"; l.660 "`add`, `subtract`, `min`, `max`, `clamp`: todos los operandos **SHALL** tener unidad idéntica; el resultado la conserva."; l.661 "`multiply`, `divide`: el resultado combina dimensiones. Si la dimensión resultante no existe en `units.yaml` → `KF-E-316`."; l.662 "`const` sin unidad es adimensional."; l.663 "La unidad calculada **SHALL** coincidir con `output.unit` → `KF-E-310`." | E-0030 (1)-(5); D-01 |
| §36 | Diagnostics carry the catalog `remediation` when the catalog defines one (catalog is §42.2, E-0008 (a)). | l.1600 "Todo diagnostic **SHALL** incluir `remediation` cuando el catálogo defina una. Los diagnostics **SHALL** generarse desde el catálogo de §44.2, no escribirse a mano." | E-0008 (a) |
| §42.2 | Catalog rows in scope. | l.1765 "\| `KF-E-310` \| E \| Unidades incompatibles \| — \|"; l.1768 "\| `KF-E-313` \| E \| División por cero no protegida \| añadir `guard` \|"; l.1769 "\| `KF-E-314` \| E \| Valor fuera del dominio del enum \| — \|"; l.1770 "\| `KF-E-315` \| E \| Regex no compilable en RE2 \| — \|"; l.1771 "\| `KF-E-316` \| E \| Dimensión resultante inexistente en `units.yaml` \| — \|" (`KF-E-311`/`312` l.1766-1767 never apply to formulas) | E-0033 |
| §50 | Configuration names for the explicit parameter; P012 reads no configuration. | l.1953 "logic:"; l.1955 "  decimal_precision: 28" | E-0017, E-0032 (3) |
| §53 | Build order: item 9. | l.2037 "9. `logic`: decision-table, formula, state-machine; decimal, unidades sin conversión, RE2." | — |
| §55 | The fixture is the operative definition of "done"; see "Fixture slice" for why P012 adds no `acme-formulation` entity. | l.2077 "8 `BR` (uno de cada `rule_kind`"; l.2103 "**El fixture es la definición operativa de "terminado".** Cada feature **SHALL** implementarse junto con su porción del fixture, nunca después" | — |
| §4 | `rule_kind` is `invariant \| decision \| derivation \| eligibility \| authorization`, a different axis from `logic.kind`. | l.171 "`DEC` y `CON` **SHALL NOT** ser tipos: son `rule_kind` de `BR` (`invariant \| decision \| derivation \| eligibility \| authorization`)." | — |

Errata-only contracts (no spec sentence, binding through the entry): E-0030 unit monomials (unit id -> non-zero exponent), `multiply`/`divide` admissibility, output check with `dimension: dimensionless`; E-0031 caller-supplied `inputs`, operand types, guard order and result, lazy `if`, null propagation; E-0032 rounding placement and modes, `round` operator, division precision, `INEXACT_DIVISION`, protection proof, static findings block evaluation, depth limit; E-0033 arities and the diagnostics/typed-error inventory.

## Deliverables and boundary

1. New engine modules (all ES modules, no side effects on import, imports only `./` siblings of `framework/engine/`):
   - `framework/engine/formula.mjs`
   - `framework/engine/decimal-ops.mjs`
   (Private helper modules under `framework/engine/` with a `formula-` prefix are allowed.)
2. **Additive-only edits to three P011 modules** (the only authorized change to P011 code; the diff of each must contain no deleted and no changed line, `git diff --numstat ENTRY_SHA -- <file>` shows `0` in the deletions column):
   - `framework/engine/decision-table.mjs`: four appended exports (below).
   - `framework/engine/logic-diagnostics.mjs`: appended `FORMULA_DIAGNOSTIC_CATALOG`, `makeFormulaDiagnostic`.
   - `framework/engine/logic-errors.mjs`: appended `FORMULA_ERROR_CODES`.
   `decimal.mjs`, `units.mjs`, `regex-re2.mjs` and every P011 test and conformance file are **not modified** (TRIAGE P-01, P-02). P011 behavior and every existing test (587 in the whole suite at the P011 audit) are unchanged.
3. Implementer tests and adversarial tests: `test/p012-*.test.mjs`.
4. Conformance slice (conformance engineer, written first): `framework/conformance/p012-formula.yaml` (case index and data), `framework/conformance/p012-formula/` (case data files: unit registries, formulas, supplied values, expected results/diagnostics; helper code and child scripts if any), `test/conformance-p012-formula.test.mjs`.
5. `HANDOFF.md` and the filled `TRACEABILITY.md` (implementer).

Writable paths. Implementer: `framework/engine/formula*.mjs`, `framework/engine/decimal-ops.mjs`, the three additive edits above, and `test/p012-*.test.mjs`. Conformance engineer: `framework/conformance/p012-formula*` and `test/conformance-p012-*.test.mjs`. Nobody in this phase touches `bin/`, `package.json`, `package-lock.json`, `scripts/`, `eslint.config.js`, `.gitattributes`, `.gitignore`, `framework/schemas/**`, `framework/conformance/acme-formulation/**`, `framework/conformance/spec-examples/**`, `framework/conformance/p002-*`, `framework/conformance/p011-*`, `test/p011-*`, `test/conformance-p011-*`, `framework/engine/id-registry*.mjs`, `framework/engine/decimal.mjs`, `framework/engine/units.mjs`, `framework/engine/regex-re2.mjs`, the spec, the errata, `.strike-team/**` (except the implementer's own `HANDOFF.md` and `TRACEABILITY.md` in the phase directory). **No new npm dependency.**

### Public engine API contract

All functions are synchronous and pure: no filesystem, clock, randomness, environment or global state; arguments are never mutated; returned objects are fresh. "Typed error" = `LogicError` **thrown**. "Diagnostic" = a `KF-` entry **returned**. Routing rule (P011 P-02, unchanged): **a `KF-` code is never thrown, and a typed error is never returned inside `diagnostics`.**

```
// framework/engine/formula.mjs                                   (NEW)
export const DEFAULT_PRECISION: 28                                // l.1955
export const MAX_EXPRESSION_DEPTH: 1000                           // E-0032 (6)
export function checkFormula(logic: object,
    options: { unitRegistry: UnitRegistry, inputs: Input[], precision?: number }): Diagnostic[]
export function evaluateFormula(logic: object, values: object,
    options: { unitRegistry: UnitRegistry, inputs: Input[], precision?: number }): FormulaResult

// framework/engine/decimal-ops.mjs                               (NEW)
export type RoundingMode = 'half-even' | 'half-up' | 'down' | 'up'
export function absDecimal(a: Decimal): Decimal
export function roundDecimal(a: Decimal, options: { mode: RoundingMode, decimals: number }): Decimal
        // result.scale === decimals (trailing zeros kept)
export function roundDecimalSignificant(a: Decimal, options: { mode: RoundingMode, digits: number }): Decimal
export function divideDecimal(a: Decimal, b: Decimal, options: { precision: number, mode?: RoundingMode }):
        { exact: true, value: Decimal } | { exact: false, value: Decimal | null }
export function formatDecimalFixed(a: Decimal): string            // exactly a.scale fraction digits, never "-0..."

// framework/engine/decision-table.mjs                            (ADDITIVE: four appended exports)
export function compileLogicInputs(rawInputs: unknown, registry: UnitRegistry): { inputs: object[], bind: Function }
export function compileLogicPredicate(predicate: unknown, context: { inputs, bind, registry }, pointer: string):
        { node: object, findings: Diagnostic[] }
export function typeLogicValues(inputs: object[], bind: Function, values: object): { typed: Array<object | null>, diagnostics: Diagnostic[] }
export function evaluateLogicPredicate(node: object, typed: Array<object | null>): boolean

// framework/engine/logic-diagnostics.mjs                         (ADDITIVE)
export const FORMULA_DIAGNOSTIC_CATALOG: Readonly<{ 'KF-E-313': {code, severity: 'E', remediation: 'añadir `guard`'},
                                                    'KF-E-316': {code, severity: 'E'} }>      // copied from l.1768, l.1771
export function makeFormulaDiagnostic(code: string, message: string, fields: object): Diagnostic
        // 313/316 from FORMULA_DIAGNOSTIC_CATALOG; any other code delegates to makeDiagnostic

// framework/engine/logic-errors.mjs                              (ADDITIVE)
export const FORMULA_ERROR_CODES: readonly ['DIVISION_BY_ZERO', 'INEXACT_DIVISION', 'INVALID_EXPRESSION']   // ascending
```

**Reused unchanged from P011** (imported, not copied): `LogicError`, `parseDecimal`, `isDecimal`, `compareDecimal`, `equalsDecimal`, `addDecimal`, `subtractDecimal`, `multiplyDecimal`, `formatDecimal` (`decimal.mjs`); `isUnitRegistry` (`units.mjs`; `buildUnitRegistry` in tests); `makeDiagnostic`, `sortDiagnostics`, `compareStrings` (`logic-diagnostics.mjs`); the predicate machinery (binding by full ref or suffix, matcher compilation, `KF-E-310/314/315` literal findings, supplied-value typing, binary null logic, RE2 matching through `regex-re2.mjs`) through the four appended `decision-table.mjs` exports. The four wrappers call the existing private functions (`declareInput` + `makeBinder`, `compilePredicate`, `bindSupplied` + `typeSupplied`, `evaluateNode`) and edit none of them; the formula context sets `ctx.rule = { id: null, index: null }`, so predicate findings carry `rule: null`, `rule_index: null`; `compilePredicate` is called with `top = false` (an empty `{}` is `EMPTY_PREDICATE`, N-A); any `INVALID_TABLE` raised inside is re-thrown as `INVALID_EXPRESSION` with the same `details`; `rawInputs` that is not an array is `INVALID_ARGUMENT`.

**Types**

```
Input = { ref: string, type: 'enum' | 'quantity' | 'decimal' | 'string' | 'boolean', unit?: string, domain?: string[] }   // E-0031 (1), E-0021
Diagnostic = { code: 'KF-E-310'|'KF-E-313'|'KF-E-314'|'KF-E-315'|'KF-E-316', severity: 'E', message: string,
               remediation?: string,         // present only on KF-E-313 (l.1768, l.1600)
               pointer: string,              // RFC 6901 into `logic` (supplied-value findings: into options.inputs, as in P011)
               rule: null, rule_index: null,
               ...code-specific fields }
FormulaResult = {
  status: 'ok' | 'raised' | 'error',
  value: null | { value: string, unit: string },      // ok: value canonical or fixed-scale (below), unit = output.unit
  outcome: string | null,                              // raised: the OUT id of the first true guard
  guard_index: number | null,                          // raised: index of that guard
  diagnostics: Diagnostic[]                            // [] unless status is 'error'
}
```

Code-specific diagnostic fields (message text is free and never asserted; the fields below are; TRIAGE P-06):

| Code | Fields asserted |
|---|---|
| `KF-E-310` | `pointer`, `expected_unit`, `found_unit`, `source`. `source: 'expression'`: an operand of `add`/`subtract`/`min`/`max`/`clamp` or the `else` branch of an `if` whose monomial differs from the reference one (the first operand; for `if`, the `then` branch). `pointer` = that operand (`/expression/args/<i>`, `.../else`); `expected_unit` = unit text of the reference, `found_unit` = unit text of the offender. One diagnostic per offending operand. `source: 'output'`: `pointer: '/output/unit'`, `expected_unit` = `output.unit`, `found_unit` = unit text of the computed monomial (`null` when dimensionless). `source: 'literal'` / `'value'`: the P011 fields (`input`, `expected_unit`, `found_unit`), with `rule: null`. |
| `KF-E-313` | `pointer` = the `divide` node, `reason` ∈ `zero_constant` \| `unprotected`, `input` = ref of a bare-ref divisor (`null` otherwise), `remediation: "añadir `guard`"`. |
| `KF-E-314` | the P011 fields: `pointer`, `input`, `value`, `source` (`'literal'` for guards/conditions, `'value'` for a supplied value). |
| `KF-E-315` | the P011 fields: `pointer` (the pattern node), `pattern`, `reason`. |
| `KF-E-316` | `pointer` = the `multiply`/`divide` node, `operation` ∈ `multiply` \| `divide`, `unit` = unit text of the inadmissible monomial. |

**Unit text** of a monomial: factors sorted by unit id in UTF-8 byte order, each `<id>` for exponent 1 and `<id>^<exponent>` otherwise (negative exponents written with `-`), joined by `*`; the empty monomial is `null`. Examples: `{percent_mass: 2}` -> `percent_mass^2`; `{percent_mass: 1, ppm_mass: -1}` -> `percent_mass*ppm_mass^-1`; `{percent_mass: -1}` -> `percent_mass^-1`.

**Diagnostic sort key** (applied to every returned list): the P011 key `(code, rule_index ?? -1, pointer, rule_indexes element-wise, message)` through `sortDiagnostics`; for formulas `rule_index` is always `null`, so the effective order is `(code, pointer, message)` in UTF-8 byte order. No two diagnostics share `(code, pointer)`.

### Semantics fixed by the errata (the implementer's reading list)

- **Structure (E-0033).** `logic.kind` must be `formula`, `logic` a mapping, `output` a mapping with non-empty string `ref` and string `unit`, `expression` a mapping. Expression nodes: `{ref: <non-empty string>}`; `{const: <decimal string>}` or `{const: <decimal string>, unit: <unit id>}`; `{op: <op>, args: [expr, ...]}` for the nine ops other than `if`; `{op: 'if', cond: predicate, then: expr, else: expr}` with no other key. Anything else (unknown `op`, wrong key set, `args` not a list, a string where an expression is required, wrong arity) is `INVALID_EXPRESSION`. `rounding`, if present, is a mapping with `mode` in the four modes and `decimals` an integer `>= 0`, else `INVALID_EXPRESSION`. `guards`, if present, is a list of mappings with exactly `when` (non-empty predicate) and `raise` (`^OUT-[0-9]{4,}$`, P-10), else `INVALID_EXPRESSION` / `EMPTY_PREDICATE` / the predicate's own typed error.
- **Arity (E-0033).** `subtract`, `divide`: 2. `add`, `multiply`, `min`, `max`: `>= 1`, one argument returns it unchanged, longer lists fold left. `abs`, `round`: 1. `clamp`: 3, `(x, lo, hi)`, runtime `lo > hi` is `INVALID_RANGE`. `round` requires a `rounding` block (E-0032 (1)).
- **Refs and operands (E-0031 (1)).** Bound by full ref or suffix after the last `.` (`UNBOUND_FIELD` / `AMBIGUOUS_FIELD`); only `quantity` and `decimal` inputs are operands (`TYPE_MISMATCH` otherwise); predicates (guards, `cond`) use every input type with P011 semantics.
- **Unit monomials (E-0030).** `ref` of a `quantity` input with unit `u`: `{u: 1}`; of a `decimal` input: `{}`; `const` without `unit`: `{}`; `const` with `unit` `u` (registered, else `UNKNOWN_UNIT`): `{u: 1}`; `add`/`subtract`/`min`/`max`/`clamp` and `if`: all operands (branches) identical by unit id, result keeps it, mismatch is `KF-E-310`; `multiply` adds and `divide` subtracts exponents (zero exponents dropped); the node is admissible only if the result is `{}` or exactly one registered id with exponent 1, otherwise `KF-E-316` on that node; `abs`, `round` keep. Output: computed `{u: 1}` requires `output.unit === u`; computed `{}` requires `output.unit` to name a registered unit whose `dimension` is exactly `dimensionless`; otherwise `KF-E-310`. `output.unit` not in the registry is `UNKNOWN_UNIT`. After a `KF-E-316` the behavior of the parents and of the output check is **pending (D-01)**.
- **Evaluation (E-0031, E-0032).** Order: P-07. Null: an absent or `null` operand makes the arithmetic result `null`; `min`/`max`/`clamp`/`abs`/`round` of `null` are `null`; a `null` divisor is `null`; `if` evaluates only the selected branch and a `cond` on `null` is false. Rounding: applied once to the final non-null value when a `rounding` block exists; intermediates are exact; `round(x)` applies the logic-level rounding to `x` at that point. Modes: `half-even` ties to even, `half-up` ties away from zero, `down` toward zero, `up` away from zero; the rounded Decimal has `scale === decimals` and renders with exactly `decimals` fraction digits, trailing zeros kept, never `-0`. Without a `rounding` block the value renders with `formatDecimal`. Division: `precision` defaults to 28 (`options.precision` overrides); a quotient that is a terminating decimal of at most `precision` significant digits is exact (D-03 for trailing zeros of integers); otherwise with a `rounding` block the quotient is rounded to `precision` significant digits by the declared mode and then continues (so it is rounded again at the end), without a block `INEXACT_DIVISION`. A zero divisor reaching evaluation is `DIVISION_BY_ZERO` (defensive; unreachable through `evaluateFormula` because static findings and guards precede it).
- **`KF-E-313` protection proof (E-0032 (4)).** A `divide` node is protected if (a) its divisor is a `const` that is not zero by value; (b) its divisor is a bare `ref` R and some guard's `when` is a single matcher on R true whenever R is zero, in the forms the entry lists (D-02); (c) it lies (at any depth) in the `then` branch of an `if` whose `cond` is a single matcher on R false whenever R is zero, or in the `else` branch of an `if` whose `cond` is true whenever R is zero (D-02). A constant zero divisor (any `const` equal to zero by value, with or without a unit) is never protected. Everything else, including every compound divisor, is `KF-E-313`. The proof is syntactic and per field; no solver.
- **Static findings block evaluation (E-0032 (5)).** If the check yields any diagnostic, `evaluateFormula` returns `status: 'error'` with exactly that list and evaluates nothing (the supplied values are not even bound, P-07).

**Typed errors** (all thrown as `LogicError`; `checkFormula` and `evaluateFormula` raise the same code for the same structural defect):

| Code | Raised when | Origin |
|---|---|---|
| `INVALID_EXPRESSION` | `logic.kind` not `formula`; malformed node, unknown `op`, wrong arity, `round` without `rounding`, malformed `rounding`/`guards`/`raise`/`output`; nesting deeper than `MAX_EXPRESSION_DEPTH`; any `INVALID_TABLE` raised by the predicate machinery | E-0032, E-0033 |
| `INEXACT_DIVISION` | evaluation: an inexact quotient and no `rounding` block | E-0032 (3) |
| `DIVISION_BY_ZERO` | `divideDecimal` with a zero divisor; defensive in evaluation | E-0032 (5), E-0033 |
| `INVALID_RANGE` | `clamp` with `lo > hi` at evaluation; `between` with `min > max` in a predicate | E-0033, E-0019 |
| `INVALID_DECIMAL`, `UNKNOWN_UNIT`, `UNBOUND_FIELD`, `AMBIGUOUS_FIELD`, `EMPTY_PREDICATE`, `TYPE_MISMATCH`, `UNSUPPORTED_INPUT_TYPE`, `INVALID_INPUT_DECLARATION` | as in P011, for `const`, `output.unit`, `const.unit`, `options.inputs`, refs, guards, conditions and supplied values | E-0017..E-0022, E-0031 |
| `INVALID_ARGUMENT` | missing/unbuilt `unitRegistry`; `inputs` not an array; `precision` not an integer `>= 1`; non-mapping `values`; non-Decimal or bad mode/decimals/digits/precision arguments of `decimal-ops.mjs` | P-08 |

`INVALID_TABLE` is never thrown by P012 entry points. CLI exit-code classes are not set here (P007/P014). `KF-E-010`, `KF-E-311`, `KF-E-312` are never produced.

## Design constraints

- No binary floating point anywhere in formula evaluation (l.582): decimals are `bigint` pairs; no `parseFloat`, `toFixed`, `toPrecision`, `Math.*`, `Number(` on a decimal in `decimal-ops.mjs` or `formula.mjs`. Counts, indexes and the validated `decimals`/`digits`/`precision` integers may be plain numbers (`Number.isInteger` is allowed).
- Determinism: no clock, randomness, locale, environment or iteration-order dependence. Results and diagnostics are byte-identical on every run and platform; all sorts are explicit (byte order). A mapping's keys are read, never relied on for order except where the plan says so.
- No implicit unit conversion (l.589, l.602): units compare by `id` only; `dimension` is read only for the single test "is `dimensionless`" in the output check (E-0030 (4)). No conversion function exists.
- Pure functions: no I/O, no global mutable state, arguments never mutated, outputs fresh.
- Structured expressions only (l.638): the evaluator never parses a string expression and never uses `eval`, `new Function` or dynamic `import`.
- Fail closed: an unprotected divisor, an unknown operator, an unknown unit, a malformed node and any nesting beyond the limit are errors, never silently accepted.
- Only the five catalog codes `KF-E-310/313/314/315/316` are produced; no `KF-` code is invented (E-0033).
- Recursion: the compile and evaluate walks of an expression accept depth up to `MAX_EXPRESSION_DEPTH`; deeper input is `INVALID_EXPRESSION` raised before any deep recursion, never a `RangeError`. Wide expressions (thousands of arguments) are folded iteratively.
- No new dependency; no change to `package.json`, schemas, `bin/` or `eslint.config.js`. P011 behavior is unchanged (V-33).

## Fixture slice

**§55 entities added: none.** §55 (l.2075-2103) lists no `expected/` command line that P012 can satisfy alone: `kf check-rules` (l.2086) is P014 and `framework/conformance/expected/` does not exist until P028. P012 changes neither `acme-formulation` nor the spec examples.

**Why no formula `BR` is added to `acme-formulation` now.** l.2077 asks for "8 `BR` (uno de cada `rule_kind`, ...". `rule_kind` (`invariant | decision | derivation | eligibility | authorization`, l.171) is a different axis from `logic.kind`, so "one of each `rule_kind`" does not by itself require a `formula` rule; a `derivation` BR with a formula facet is the natural candidate. But a BR in the fixture drags in entities and counts that other phases own: the `DE` fields the formula refers to (`DE-0001` declares only `concentration`), an `OUT` entity for each `raise` target (only `OUT-0001` exists), `SC` scenarios that assert it (P014 and the 24-case progression: 18 specified, 6 observed), `EV`/`CHG` links, and the aggregate counts and derived `DIV`/impact/context numbers that the `expected/` lines of l.2086-2100 pin (P027). Adding one BR piecemeal would fix part of that composition before the phases that must justify it exist, and `acme-formulation/README.md` already states that counts and outputs "are added with their respective later phases". The P011 precedent is the same (the existing `BR-0001` is read as data, nothing added). The observable equivalent in P012 is the spec's own worked example (l.640-653), which the conformance test **loads from `knowledge-framework-spec-v2.1.md`** (the lines between the fences), so the slice cannot drift from the frozen text. P012 records in `HANDOFF.md` the requirement for downstream: a `formula`-facet `BR` (with its `DE` fields, `OUT` target, `SC` cases) is introduced by P014 (first consumer, `kf check-rules` against `asserts`) or by P027 at the Foreman's choice. The slice lives as data plus a test and is ported by the phase that builds the `expected/` runner.

Layout, written by the conformance engineer before any implementer code is read: `framework/conformance/p012-formula.yaml` (case index, `cites`, `targets`, status `pending-implementation`; each key of the index has at least one test whose title starts with it, and every test key is indexed), `framework/conformance/p012-formula/` (YAML case data; unit registries `units-uf0.yaml`, `units-uf1.yaml`, `units-uf2.yaml`; formulas; supplied values; expected outputs; a child script for the fresh-process determinism check), `test/conformance-p012-formula.test.mjs` (loads the data and calls the public API only: `checkFormula`, `evaluateFormula` and the exports of `decimal-ops.mjs` and the catalog/error constants). Cases marked "pending (D-nn)" are present in the data with `status: pending-decision` and are skipped with a named `test.todo`; nothing is guessed.

### Notation

- Registry **UF0** = P011's U1: `units: [{id: percent_mass, dimension: mass_fraction, symbol: "% m/m"}, {id: ppm_mass, dimension: mass_fraction, symbol: "ppm"}, {id: percent_volume, dimension: volume_fraction, symbol: "% v/v"}, {id: kg, dimension: mass, symbol: "kg"}]`, `conversions: []`. **UF1** = UF0 plus `{id: ratio, dimension: dimensionless, symbol: "1"}`. **UF2** = UF1 plus `{id: pct_dimless, dimension: dimensionless, symbol: "%"}` and `{id: percent_mass_squared, dimension: mass_fraction_squared, symbol: "(% m/m)^2"}`. Unit shorthands: `pm` = `percent_mass`, `ppm` = `ppm_mass`, `pv` = `percent_volume`. `Q(4.2,pm)` = `{value: "4.2", unit: percent_mass}`. UF1 unless stated.
- Inputs (all nine are passed as `options.inputs` unless stated): `c` = `{ref: DE-0017.concentration, type: quantity, unit: percent_mass}`; `h` = `{ref: DE-0017.baseline, type: quantity, unit: percent_mass}`; `p` = `{ref: DE-0017.ppm, type: quantity, unit: ppm_mass}`; `v` = `{ref: DE-0017.volume_fraction, type: quantity, unit: percent_volume}`; `f` = `{ref: DE-0017.loss_factor, type: decimal}`; `g` = `{ref: DE-0017.gain, type: decimal}`; `e` = `{ref: DE-0017.material_type, type: enum, domain: [X, Y, Z]}`; `s` = `{ref: DE-0017.note, type: string}`; `b` = `{ref: DE-0017.flag, type: boolean}`. In expressions `ref(x)` abbreviates `{ref: DE-0017.<x>}`; in guards and conditions fields are written by suffix (`loss_factor`, `gain`, `concentration`, `baseline`, `material_type`, `note`, `flag`). **Supplied values are keyed by the full ref** unless stated: "supplied `f="0.1"`" means `{"DE-0017.loss_factor": "0.1"}`; "absent" = key missing; `null` = key present with `null`.
- Expression shorthand: `K("1")` = `{const: "1"}`; `Ku("1",pm)` = `{const: "1", unit: percent_mass}`; `add(a, b)` = `{op: add, args: [a, b]}` and so on; `if(C; T; E)` = `{op: if, cond: C, then: T, else: E}`.
- Skeleton **FX(expr; unit; extras)** = `{kind: formula, output: {ref: DE-0017.result, unit: <unit>}, expression: <expr>, ...extras}`; `unit` is `ratio` for dimensionless results and `percent_mass` (`pm`) for quantities unless stated; `extras` are `rounding` and `guards`.
- Outcomes: `-> "x"` = `status: ok`, `value == {value: "x", unit: ratio}`, `outcome` and `guard_index` `null`, `diagnostics: []`; `-> "x" pm` the same with unit `percent_mass`; `-> OK null` = `status: ok`, `value: null`; `-> RAISED OUT-n @i` = `status: raised`, `outcome`, `guard_index: i`, `value: null`, `diagnostics: []`; `-> ERR [codes]` = `status: error`, `value: null`, `diagnostics` codes exactly the list in sorted order; `-> THROWS CODE` = throws `LogicError` with that `code` (both `checkFormula` and `evaluateFormula` unless stated); `CHECK -> []` = `checkFormula` returns the empty list; `CHECK -> [KF-E-310 @ptr]` = exactly that list of codes with those pointers.
- Every case is run through the public API only, twice, and the two results must be deep-equal. A case named with `CHECK` also runs `evaluateFormula` with values that would not matter: the result is `ERR` with the same diagnostics (static findings block evaluation, E-0032 (5)) unless the case says otherwise.

### Operators and arity (F-O) - no `rounding`, no `guards`; one case line per formula, supplied value -> outcome

- **O1 `add`**: `add(ref(f), ref(g))`: f=`"0.1"`, g=`"0.2"` -> `"0.3"` (exact); f=`"9007199254740992"`, g=`"1"` -> `"9007199254740993"`; f=`"0.1"`, g=`"-0.1"` -> `"0"` (never `"-0"`). `add(f, g, K("0.3"))` with `"0.1"`, `"0.2"` -> `"0.6"` (left fold). `add(f)` with f=`"0.10"` -> `"0.1"` (one argument returns it, canonical form). `add(ref(c), Ku("1",pm))`, c=`Q(4.2,pm)` -> `"5.2"` pm.
- **O2 `subtract`**: `subtract(K("1"), ref(f))`, f=`"0.25"` -> `"0.75"`; `subtract(f, g)`, `"0.3"`, `"0.1"` -> `"0.2"`; `"1"`, `"1.000"` -> `"0"`; `subtract(ref(c), Ku("1",pm))`, c=`Q(4.2,pm)` -> `"3.2"` pm. Arity: `subtract(f)`, `subtract(f, g, K("1"))`, `{op: subtract, args: []}` -> `THROWS INVALID_EXPRESSION`.
- **O3 `multiply`**: `multiply(f, g)`: `"1.5"`, `"-2.5"` -> `"-3.75"`; `"-0"`, `"5"` -> `"0"`; `"0.000001"`, `"0.000001"` -> `"0.000000000001"`; `"123456789012345678901234567890"`, `"987654321098765432109876543210"` -> `"121932631137021795226185032733622923332237463801111263526900"`. `multiply(f, g, K("2"))`, `"1.5"`, `"-2.5"` -> `"-7.5"`. `multiply(f)`, `"0.50"` -> `"0.5"`. `multiply(ref(c), ref(f))`, c=`Q(4.2,pm)`, f=`"0.5"` -> `"2.1"` pm; `multiply(ref(f), ref(c))` the same.
- **O4 `divide`** (constant nonzero divisors, so no `KF-E-313`; exact quotients; default precision 28): `divide(f, K("4"))`, f=`"1"` -> `"0.25"`; `divide(K("10"), K("4"))` -> `"2.5"`; `divide(f, K("3"))`, f=`"6"` -> `"2"`; `divide(f, K("0.1"))`, f=`"0.3"` -> `"3"`; `divide(f, K("2"))`, f=`"-7"` -> `"-3.5"`; `divide(f, K("-4"))`, f=`"1"` -> `"-0.25"`; `divide(f, K("5"))`, f=`"0"` -> `"0"`; `divide(f, K("8"))`, f=`"1"` -> `"0.125"`; `divide(f, K("1024"))`, f=`"1"` -> `"0.0009765625"`; `divide(f, K("1099511627776"))` (2^40), f=`"1"` -> `"0.0000000000009094947017729282379150390625"` (exactly 28 significant digits: exact at the default precision); `divide(f, K("10"))`, f=`"1234567890123456789012345678"` (28 digits) -> `"123456789012345678901234567.8"` (28 significant digits, exact); `divide(ref(c), K("4"))`, c=`Q(2,pm)` -> `"0.5"` pm; `divide(ref(c), Ku("2",pm))` with output `ratio`, c=`Q(5,pm)` -> `"2.5"`. Arity: `divide(f)`, `divide(f, g, K("1"))` -> `THROWS INVALID_EXPRESSION`.
- **O5 `min`/`max`**: `min(f, g)`: `"0.5"`, `"-0.5"` -> `"-0.5"`; `max(f, g)` -> `"0.5"`; `max(f, g)`, `"10"`, `"9"` -> `"10"` (numeric, not lexical); `min(f, g)`, `"1.0"`, `"1"` -> `"1"`; `min(f, g, K("-2"))`, `"0.5"`, `"1"` -> `"-2"`; `max(f, g, K("2"))` -> `"2"`; `min(f)`, `"3.10"` -> `"3.1"`; `min(ref(c), Ku("5",pm))`, c=`Q(4.2,pm)` -> `"4.2"` pm; `max(ref(c), Ku("5",pm))` -> `"5"` pm. `{op: min, args: []}`, `{op: max, args: []}` -> `THROWS INVALID_EXPRESSION`.
- **O6 `abs`**: `abs(f)`: `"-3.50"` -> `"3.5"`; `"3.5"` -> `"3.5"`; `"-0"` -> `"0"`; `abs(ref(c))`, c=`Q(-4.2,pm)` -> `"4.2"` pm. Arity `{op: abs, args: []}`, `abs(f, g)` -> `THROWS INVALID_EXPRESSION`.
- **O7 `clamp(x, lo, hi)`**: `clamp(f, K("0"), K("1"))`: f=`"1.5"` -> `"1"`; `"-0.2"` -> `"0"`; `"0.5"` -> `"0.5"`; `"1"` -> `"1"`; `"0"` -> `"0"`. `clamp(ref(c), Ku("0",pm), Ku("5",pm))`, c=`Q(7,pm)` -> `"5"` pm. `clamp(f, K("1"), K("1"))`, f=`"3"` -> `"1"`. `clamp(f, K("1"), K("0"))`, f=`"0.5"`: `CHECK -> []` and evaluation `THROWS INVALID_RANGE`. Arity `clamp(f, K("0"))`, `clamp(f, K("0"), K("1"), K("2"))` -> `THROWS INVALID_EXPRESSION`.
- **O8 leaves at the root**: `FX(ref(f); ratio)`, f=`"4.20"` -> `"4.2"`; `FX(K("-0"); ratio)` -> `"0"`; `FX(K("007.500"); ratio)` -> `"7.5"`; `FX(Ku("4.2",pm); pm)` -> `"4.2"` pm.

[V-01 O1-O3; V-02 O4; V-03 O5-O8]

### Structure and typed errors (F-X) - single defect per case; check and evaluate throw the same code

- **X1 `INVALID_EXPRESSION`**: `logic.kind` = `decision-table`; `logic` = `null`, a list, a string; `expression` missing; `expression` a string (`"DE-0017.a + DE-0017.b"`; l.638); unknown `op` (`pow`, `sum`, `ADD`, empty string); node `{}`; `{op: add}` (no `args`); `{op: add, args: "x"}`; `{op: add, args: []}`; `args` containing `1`, `null`, `"x"`, `[]`; `{ref: "DE-0017.loss_factor", const: "1"}`; `{ref: ""}`; `{ref: 5}`; `{const: "1", op: add, args: [...]}`; `{op: if, cond: {...}, then: ..., args: [...]}`; `if` without `else`, without `then`, without `cond`, with `cond` a string; `output` missing; `output.unit` missing or a number; `output.ref` empty; `guards` not a list; a guard without `raise`; a guard without `when`; a guard with a third key; `raise` in `OUT-11`, `out-0011`, `OUT-0011 ` (trailing space), `OUT-0011\n`, `OUT-00a1`, `OUT-٣٣٣٣` (Arabic-Indic digits), `5`, `null`; near-misses accepted: `OUT-0011`, `OUT-123456`, `OUT-9999` (the entity need not exist: P007).
- **X2 `INVALID_DECIMAL`**: `{const: 1}`, `{const: 1.5}`, `{const: "1,5"}`, `{const: "1e3"}`, `{const: ".5"}`, `{const: "+1"}`, `{const: null}`, `{const: true}`; supplied f=`0.1` (a number), f=`"1e3"`, f=`"0,1"`; supplied c=`{value: 4.2, unit: percent_mass}`.
- **X3 `UNKNOWN_UNIT`**: `{const: "1", unit: furlong}`; `output.unit: furlong`; `output.unit: percent` (not declared by UF1, bare `percent` has no built-in validity, l.591); `options.inputs` entry `{ref: DE-0017.z, type: quantity, unit: furlong}`; a guard literal `Q(1,furlong)`.
- **X4 binding**: `{ref: "DE-0017.nope"}` -> `UNBOUND_FIELD`; guard key `nope`; `if` condition key `nope`; supplied key `{"nope": "1"}` -> `UNBOUND_FIELD` (evaluate). Inputs `[{ref: A.x, type: decimal}, {ref: B.x, type: decimal}]`: `{ref: "x"}` -> `AMBIGUOUS_FIELD`; `{ref: "A.x"}` binds and `FX(ref("A.x"); ratio)` evaluates with `{"A.x": "1", "B.x": "2"}` to `"1"`; supplied `{"x": "1"}` -> `AMBIGUOUS_FIELD`. Inputs `x` and `A.x` with `{ref: "x"}` -> `AMBIGUOUS_FIELD` (E-0027 (2)). Two supplied keys for one input (`loss_factor` and `DE-0017.loss_factor`) -> `AMBIGUOUS_FIELD`.
- **X5 `TYPE_MISMATCH`**: `ref(e)` (enum), `ref(s)` (string), `ref(b)` (boolean) as an operand anywhere (root, argument, `if` branch). Near-miss: the same three inputs as guard/condition keys are accepted. Predicate misuse: guard `{material_type: {lt: "X"}}`, `{note: {gte: "a"}}`, `{flag: {gt: true}}`. Supplied s=`5`, b=`"yes"` (evaluate) -> `TYPE_MISMATCH`.
- **X6 `EMPTY_PREDICATE`**: guard `when: {}`; `{all: []}`; `{any: []}`; `{not: {}}`; `{all: [{}]}`; `if` with `cond: {}`.
- **X7 `INVALID_RANGE` (predicate)**: guard `{loss_factor: {between: ["5","1"]}}`.
- **X8 `UNSUPPORTED_INPUT_TYPE` / `INVALID_INPUT_DECLARATION`** in `options.inputs`: `type: date`; `{ref: DE-0017.x, type: quantity}` (no unit); `{ref: DE-0017.x, type: decimal, unit: percent_mass}` (the P011 codes, same expectations).

[V-04 X1; V-05 X2, X3; V-06 X4, X5; V-16 X6, X7, X8]

### Options and entry points (F-B)

- **B1** `unitRegistry` missing, `null`, raw parsed data (not built) or a hand-made `{has: () => true, units: []}` -> `THROWS INVALID_ARGUMENT` from both functions. `options` missing or `null` -> `INVALID_ARGUMENT`.
- **B2** `inputs` missing, `null`, a mapping, a string -> `INVALID_ARGUMENT`. `inputs: []` with a formula that has a `ref` -> `UNBOUND_FIELD`; `inputs: []` with a formula without refs (`FX(K("1"); ratio)`) -> `CHECK -> []` and `-> "1"`.
- **B3** `precision` of `0`, `-1`, `1.5`, `"28"`, `NaN`, `null`, `Infinity` -> `INVALID_ARGUMENT` from both functions (check validates it although it cannot change a diagnostic); `precision` absent or `undefined` -> accepted (default 28); `precision: 1` and `precision: 100` accepted.
- **B4** `values` of `evaluateFormula` is `null`, a list, a string -> `INVALID_ARGUMENT`.
- **B5** Binding by suffix: expression `{ref: "loss_factor"}` and supplied `{"loss_factor": "0.1"}` give the same outcome as the full-ref forms (E-0019, E-0022 D-02).

[V-07 B1-B4; V-06 B5]

### Unit algebra (F-U) - `CHECK`, output unit chosen so that only the named finding can arise unless stated

- **U1 identity of `add`, `subtract`, `min`, `max`** (output `pm`): for each op, `op(ref(c), ref(p))` -> exactly one `KF-E-310` at `/expression/args/1` with `expected_unit: percent_mass`, `found_unit: ppm_mass`, `source: expression` (a convertible pair, same `mass_fraction` dimension: l.591); `op(ref(c), ref(v))` -> one, `found_unit: percent_volume`; `op(ref(c), ref(f))` -> one, `found_unit: null`; `op(ref(c), K("1"))` -> one, `found_unit: null`; `op(ref(c), Ku("1",ppm))` -> one, `found_unit: ppm_mass`; with output `ratio`: `op(ref(f), ref(c))` -> one at `/expression/args/1` with `expected_unit: null`, `found_unit: percent_mass`. Near-misses `CHECK -> []`: `op(ref(c), ref(h))` (two inputs, identical unit id), `op(ref(c), ref(c))`, `op(ref(c), Ku("1",pm))`; output `ratio`: `op(ref(f), ref(g))`, `op(ref(f), K("1"))`. `add(ref(c), ref(p), ref(v))` -> two `KF-E-310`, at `/expression/args/1` then `/expression/args/2` (found `ppm_mass`, `percent_volume`).
- **U2 identity of `clamp`**: `clamp(ref(c), ref(h), ref(h))` -> `[]`; `clamp(ref(c), ref(h), ref(p))` -> one at `/expression/args/2`; `clamp(ref(c), ref(p), ref(v))` -> two (`/expression/args/1`, `/expression/args/2`); `clamp(ref(f), ref(c), ref(g))` with output `ratio` -> one at `/expression/args/1` (`expected_unit: null`, `found_unit: percent_mass`).
- **U3 identity of `if` branches**: `if({flag: true}; ref(c); ref(h))` -> `[]`; `if({flag: true}; ref(c); ref(p))` -> one at `/expression/else`, `expected_unit: percent_mass`, `found_unit: ppm_mass`; `if({flag: true}; ref(c); ref(f))` -> one at `/expression/else`, `found_unit: null`; nested `if({flag: true}; ref(c); if({flag: true}; ref(c); ref(p)))` -> one at `/expression/else/else`.
- **U4 `multiply`/`divide` that are admissible** (`CHECK -> []`): `multiply(c, f)` pm; `multiply(f, c)` pm; `multiply(f, g)` ratio; `multiply(c, K("2"))` pm; `multiply(multiply(c, f), g)` pm; `divide(c, K("2"))` pm; `divide(f, K("2"))` ratio; `divide(c, Ku("2",pm))` ratio (units cancel); `divide(Ku("1",ppm), Ku("2",ppm))` ratio; `divide(divide(c, K("2")), K("4"))` pm; `multiply(divide(c, Ku("2",pm)), c)` pm (an intermediate dimensionless value); `multiply(Ku("2",ratio), f)` ratio (the monomial `{ratio: 1}` is a single registered unit with exponent 1 and equals `output.unit`); `if({flag: true}; multiply(c, f); c)` pm.
- **U5 const units**: `add(ref(c), K("1"))` -> one `KF-E-310` at `/expression/args/1` (`found_unit: null`); `add(ref(f), Ku("1",pm))` (output `ratio`) -> one at `/expression/args/1` (`expected_unit: null`, `found_unit: percent_mass`); `add(Ku("1",ratio), ref(f))` -> one at `/expression/args/1` (the monomials `{ratio: 1}` and `{}` differ; consequence of E-0030 (1)); `subtract(K("1"), ref(f))` -> `[]`.
- **U6 `KF-E-316`** (the finding itself; the complete list is pending (D-01)): `multiply(ref(c), ref(c))` -> a `KF-E-316` at `/expression`, `operation: multiply`, `unit: percent_mass^2`; `multiply(ref(c), ref(p))` -> `/expression`, `unit: percent_mass*ppm_mass` (same dimension, still no unit: identity is by id and the engine never invents a unit); `divide(ref(c), Ku("2",ppm))` -> `/expression`, `operation: divide`, `unit: percent_mass*ppm_mass^-1`; `divide(K("1"), Ku("2",pm))` -> `/expression`, `unit: percent_mass^-1`; `multiply(multiply(ref(c), ref(f)), ref(c))` -> exactly one `KF-E-316` at `/expression` (the inner node is admissible); `add(multiply(ref(c), ref(c)), multiply(ref(c), ref(c)))` -> `KF-E-316` at `/expression/args/0` and at `/expression/args/1`; under **UF2** (which declares `percent_mass_squared`), `multiply(ref(c), ref(c))` still gives `KF-E-316` at `/expression` (no unit is looked up by name or dimension). Near-misses are the U4 list.
- **U7 output check** (`CHECK`): computed `pm` (`FX(ref(c); pm)`): output `pm` -> `[]`; output `ppm` -> one `KF-E-310` at `/output/unit` with `expected_unit: ppm_mass`, `found_unit: percent_mass`, `source: output` (same dimension, still an error); output `pv` -> one; output `ratio` -> one; output `kg` -> one. Computed dimensionless (`FX(multiply(ref(f), ref(g)); <u>)`): output `ratio` -> `[]`; under UF2 output `pct_dimless` -> `[]` and output `ratio` -> `[]`; output `pm` -> one at `/output/unit` with `expected_unit: percent_mass`, `found_unit: null`; output `kg` (dimension `mass`) -> one. Under **UF0** (no dimensionless unit) the computed-dimensionless formula with output `percent_mass` -> one `KF-E-310`; with output `ratio` -> `THROWS UNKNOWN_UNIT`. Computed `{ratio: 1}` (`multiply(Ku("2",ratio), ref(f))`): output `ratio` -> `[]`; output `pct_dimless` (UF2) -> one `KF-E-310` (`found_unit: ratio`). Output `furlong` or bare `percent` -> `THROWS UNKNOWN_UNIT`.
- **U8 `abs`, `round`, `min`, `max`, `clamp` keep the unit**: `abs(ref(c))` output `pm` -> `[]`, output `ppm` -> one at `/output/unit`; `FX(round(ref(c)); pm; rounding {half-even, 2})` -> `[]`.
- **U9 the check is static** (values never consulted): `if({flag: true}; ref(c); ref(f))` evaluated with `flag = true` and `c = Q(1,pm)` -> `ERR [KF-E-310]` (the unselected branch is still wrong).

[V-08 U1, U2, U3, U5; V-09 U3; V-10 U4; V-11 U6 (partial D-01); V-12 U7; V-13 U8, U9]

### The spec example, end to end (F-W) - loaded from `knowledge-framework-spec-v2.1.md` l.641-652

The test extracts the lines between the fences (l.640 is the opening fence, l.653 the closing one), parses the YAML and uses its `logic` mapping as the formula **W**; it asserts that l.640 and l.653 are the fences. Inputs `c` and `f`, UF1 with `percent_mass` and `ratio`. Rounding is `half-even`, 4 decimals; the guard is `{DE-0017.loss_factor: {gte: "1"}} -> OUT-0011`.

- **W1** `CHECK -> []` (`percent_mass x (1 - dimensionless)` is `percent_mass`; the guard is a single matcher, no division).
- **W2 values**: c=`Q(4.2,pm)` with f=`"0.1"` -> `"3.7800"` pm (4.2 x 0.9 = 3.78, rendered with exactly 4 decimals); f=`"0.05"` -> `"3.9900"` pm; f=`"0.5"` -> `"2.1000"` pm; f=`"0"` -> `"4.2000"` pm; f=`"-1"` -> `"8.4000"` pm (the guard `gte "1"` is false); f=`"0.999999"` -> `"0.0000"` pm; f=`"0.99995"` -> `"0.0002"` pm; f=`"0.9999999999999999999999999999999"` -> `"0.0000"` pm (no digit cap).
- **W3 raised**: f=`"1"` -> `RAISED OUT-0011 @0`; f=`"1.0"`, `"1.5"`, `"1000000"` the same; with c absent and f=`"1"` -> `RAISED` (the guard precedes the expression and does not need c).
- **W4 null**: f absent, f=`null`, c absent with f=`"0.1"`, both absent -> `OK null` (the guard compares `null`: false; the product is `null`; rounding of `null` is `null`).
- **W5 ties and signs**, spec rounding replaced by the mode shown, f=`"0"` so that the value is c itself: c=`Q(0.00005,pm)` -> half-even `"0.0000"`, half-up `"0.0001"`, down `"0.0000"`, up `"0.0001"`; c=`Q(0.00015,pm)` -> `"0.0002"`, `"0.0002"`, `"0.0001"`, `"0.0002"`; c=`Q(0.00025,pm)` -> `"0.0002"`, `"0.0003"`, `"0.0002"`, `"0.0003"`; c=`Q(0.00035,pm)` -> `"0.0004"`, `"0.0004"`, `"0.0003"`, `"0.0004"`; c=`Q(-0.00015,pm)` -> `"-0.0002"`, `"-0.0002"`, `"-0.0001"`, `"-0.0002"`; c=`Q(-0.00005,pm)` -> `"0.0000"` (never `"-0.0000"`), `"-0.0001"`, `"0.0000"`, `"-0.0001"`.
- **W6 supplied-value findings**: c=`Q(4.2,ppm)` -> `ERR [KF-E-310]` with `source: value`, `expected_unit: percent_mass`, `found_unit: ppm_mass`, `pointer: /inputs/0`; c bare `"4.2"` -> `ERR [KF-E-310]` (`found_unit: null`); f=`Q(0.1,pm)` -> `ERR [KF-E-310]` (`expected_unit: null`); c wrong unit **and** f=`"2"` -> `ERR [KF-E-310]` (supplied values are validated before the guards: no `RAISED`); c=`{value: 4.2, unit: percent_mass}` -> `THROWS INVALID_DECIMAL`; f=`0.1` (number) -> `THROWS INVALID_DECIMAL`.
- **W7 binding by suffix**: supplied `{concentration: Q(4.2,pm), loss_factor: "0.1"}` -> `"3.7800"` pm.
- **W8 mutations of the example**: outer `multiply` replaced by `add` -> `CHECK -> [KF-E-310 @/expression/args/1]` (`expected_unit: percent_mass`, `found_unit: null`); `output.unit: ppm_mass` -> `[KF-E-310 @/output/unit]`; `output.unit: furlong` -> `THROWS UNKNOWN_UNIT`; `output.unit: percent` -> `THROWS UNKNOWN_UNIT`; `raise: OUT-11` -> `THROWS INVALID_EXPRESSION`; the inner `subtract` replaced by `divide(K("1"), ref(f))` (guard unchanged) -> `[KF-E-313 @/expression/args/1]` (`reason: unprotected`, `input: DE-0017.loss_factor`: a guard `gte "1"` does not contain zero); the same with the guard changed to `{DE-0017.loss_factor: {lte: "0"}}` -> `[]`; the `rounding` block removed -> `CHECK -> []` and f=`"0.1"` -> `"3.78"` pm (canonical form, no rounding without a declaration, l.584).

[V-14 W1-W8; V-18 W5; V-19 W2; V-24 W6]

### Guards (F-G)

- **G1 order, first wins** (expression `ref(f)`, output `ratio`): guards `[{when: {loss_factor: {gte: "1"}}, raise: OUT-0011}, {when: {loss_factor: {gte: "2"}}, raise: OUT-0012}]`: f=`"3"` -> `RAISED OUT-0011 @0`; f=`"1.5"` -> `RAISED OUT-0011 @0`; f=`"0"` -> `"0"`. Reversed order `[gte "2" -> OUT-0012, gte "1" -> OUT-0011]`: f=`"3"` -> `RAISED OUT-0012 @0`; f=`"1.5"` -> `RAISED OUT-0011 @1`; f=`"0.5"` -> `"0.5"`.
- **G2 guards precede the expression**: expression `clamp(ref(f), K("1"), K("0"))` (a runtime `INVALID_RANGE`) with guard `{loss_factor: {gte: "0"}} -> OUT-0001`: f=`"0.5"` -> `RAISED OUT-0001 @0` (the expression is not evaluated); f=`"-1"` -> `THROWS INVALID_RANGE`.
- **G3 result shape**: a `RAISED` result has exactly `status`, `value: null`, `outcome`, `guard_index`, `diagnostics: []`; an expression that would be `null` (g absent in `add(f, g)`) with a true guard on f is still `RAISED`.
- **G4 predicate types and semantics** (each raises `OUT-0001`; "-> RAISED" / "-> OK" refer to expression `K("1")` unless stated): enum `{material_type: X}`: e=`X` -> RAISED, `Y` -> OK, absent -> OK; `{material_type: {in: [X, Y]}}`; string `{note: {matches: "^AB[0-9]+$"}}`: s=`"AB12"` -> RAISED, `"xAB12"` -> OK; boolean `{flag: true}`: b=`true` -> RAISED, `false` -> OK, absent -> OK; quantity `{concentration: {gt: Q(5,pm)}}`: c=`Q(5.1,pm)` -> RAISED, `Q(5,pm)` -> OK, absent -> OK; `{concentration: {between: [Q(1,pm), Q(2,pm)]}}`: `Q(2,pm)` -> RAISED; decimal `{loss_factor: {eq: "0"}}`: f=`"0.00"` -> RAISED, `"-0"` -> RAISED; `{loss_factor: {in: ["1","2.0"]}}`: `"2"` -> RAISED; combinators `{all: [{material_type: X}, {loss_factor: {gt: "0"}}]}` (X,`"1"` -> RAISED; X,`"0"` -> OK), `{any: [...]}`, `{not: {flag: true}}` with b absent -> RAISED (binary logic), `{not: {loss_factor: {eq: "1"}}}` with f absent -> RAISED; two keys in one mapping `{material_type: X, loss_factor: {gt: "0"}}` are a conjunction; null is never matched: `{loss_factor: {ne: "1"}}`, `{loss_factor: {lt: "5"}}`, `{loss_factor: {not_in: ["1"]}}` with f absent -> OK; `{loss_factor: {is_null: true}}` with f absent or `null` -> RAISED; `{loss_factor: {is_null: false}}` with f=`"1"` -> RAISED.
- **G5 static predicate findings** (guard at index 0 unless stated; the same findings arise in `if` conditions at `/expression/cond/...`): `{concentration: {gt: Q(5,ppm)}}` -> `CHECK [KF-E-310 @/guards/0/when/concentration/gt]` with `expected_unit: percent_mass`, `found_unit: ppm_mass`, `source: literal`, `input: DE-0017.concentration`; `{loss_factor: {gt: Q(5,pm)}}` -> one at `.../loss_factor/gt` (`expected_unit: null`); `{concentration: {gt: "5"}}` -> one (`found_unit: null`); `{material_type: "W"}` -> `[KF-E-314 @/guards/0/when/material_type]` (`value: W`, `source: literal`); `{material_type: {in: [X, W]}}` -> one at `.../in/1`; `{note: {matches: "(a)\\1"}}` -> `[KF-E-315 @/guards/0/when/note/matches]` with `pattern` and `reason`; a second guard with the defect -> pointer `/guards/1/...`. Each of these evaluated with values that would not raise -> `ERR [that code]`, `value: null`. Near-misses `CHECK -> []`: in-domain literals, `{note: {matches: "^a"}}`, `{concentration: {gt: Q(5,pm)}}`, `{material_type: {eq: null}}`.
- **G6 no guards**: `guards` absent and `guards: []` give the same outcome (the expression is evaluated); a guard whose `raise` names an `OUT` that does not exist in any fixture (`OUT-9999`) is accepted.

[V-15 G1-G3; V-16 G4, G5, G6]

### `if` (F-I)

- **I1 selection** (`FX(if({material_type: X}; ref(f); ref(g)); ratio)`): e=`X`, f=`"1"`, g=`"2"` -> `"1"`; e=`Y` -> `"2"`; e absent -> `"2"` (a `null` condition is false, so `else` runs; l.607); `cond` on a quantity `{concentration: {gte: Q(4,pm)}}`: c=`Q(4,pm)` -> then, `Q(3.9,pm)` -> else, absent -> else.
- **I2 laziness** (`if({flag: true}; ref(f); clamp(ref(f), K("1"), K("0")))`): b=`true`, f=`"0.5"` -> `"0.5"` (the `else` branch, a runtime `INVALID_RANGE`, is never evaluated); b=`false` -> `THROWS INVALID_RANGE`; b absent -> `THROWS INVALID_RANGE`. Mirror `if({flag: true}; clamp(ref(f), K("1"), K("0")); ref(f))`: b=`true` -> `THROWS INVALID_RANGE`; b=`false` -> `"0.5"`.
- **I3 null**: `if({loss_factor: {gt: "0"}}; K("1"); K("2"))`: f absent -> `"2"`; f=`"0"` -> `"2"`; f=`"1"` -> `"1"`; `if({loss_factor: {eq: "0"}}; K("1"); K("2"))` with f absent -> `"2"` (null is not zero); a selected branch that is `null`: `if({flag: true}; ref(f); ref(g))`, b=`true`, f absent -> `OK null`.
- **I4 static coverage of both branches** (`CHECK`, and evaluation with the values selecting the other branch -> `ERR`): `if({flag: true}; ref(c); ref(f))` (output `pm`) -> `[KF-E-310 @/expression/else]`, evaluated with `flag = true` -> `ERR [KF-E-310]`; `if({flag: true}; ref(f); divide(ref(f), ref(g)))` -> `[KF-E-313 @/expression/else]`, evaluated with `flag = true`, g=`"2"` -> `ERR [KF-E-313]`; `if({flag: true}; multiply(ref(c), ref(c)); ref(c))` -> a `KF-E-316` at `/expression/then` (complete list pending (D-01)); condition findings: `if({material_type: "W"}; ...)` -> `[KF-E-314 @/expression/cond/material_type]`; `{note: {matches: "("}}` -> `[KF-E-315 @/expression/cond/note/matches]`.
- **I5 structure**: `cond: {}`, `{all: []}` -> `THROWS EMPTY_PREDICATE`; `cond` key `nope` -> `UNBOUND_FIELD`; `if` without `else` -> `INVALID_EXPRESSION` (X1).
- **I6 nested**: `if(C1; if(C2; ref(f); ref(g)); K("0"))` selects by both conditions; unit identity applies to the inner `if` and the outer one separately.

[V-17 I1-I6]

### Null propagation (F-L)

- **L1 every operation** (output `ratio`; the named operand absent; expected `OK null`): `add(f, g)` with g absent; `add(f, g, K("1"))` with g absent; `subtract(f, g)`; `multiply(f, g)`; `divide(f, K("2"))` with f absent; `divide(K("1"), ref(g))` with guard `{gain: "0"} -> OUT-0001` and g absent (the guard compares `null`: false; a `null` divisor is `null`, not `KF-E-313`, not a raise); `min(f, g)`; `max(f, g)`; `abs(f)`; `clamp(f, K("0"), K("1"))` and `clamp(K("0.5"), ref(f), K("1"))` with f absent; `round(f)` with `rounding {half-even, 2}`; with a quantity: `multiply(ref(c), ref(f))` with c absent (output `pm`).
- **L2 null is not zero or the other operand**: `add(f, g)` with g absent is `null`, not the value of f; `multiply(f, g)` with g absent is `null`, not `"0"`; `min(f, g)` with g absent is `null`.
- **L3 explicit `null` equals absent**: for each L1 case the result with the key present and `null` is deep-equal to the result with the key missing.
- **L4 result shape**: `{status: 'ok', value: null, outcome: null, guard_index: null, diagnostics: []}`; final rounding of `null` is `null` (`FX(ref(f); ratio; rounding {half-even, 2})`, f absent).
- **L5 guards on null**: `{loss_factor: {eq: "0"}}` and `{loss_factor: {lte: "0"}}` with f absent are false (not raised).

[V-20 L1-L5]

### Rounding (F-R) - `FX(ref(f); ratio; rounding {mode, decimals})`, supplied f -> rendered value

- **R1 decimals 0** (half-even / half-up / down / up): f=`"2.5"` -> `"2"` / `"3"` / `"2"` / `"3"`; `"3.5"` -> `"4"` / `"4"` / `"3"` / `"4"`; `"-2.5"` -> `"-2"` / `"-3"` / `"-2"` / `"-3"`; `"-3.5"` -> `"-4"` / `"-4"` / `"-3"` / `"-4"`; `"2.4"` -> `"2"` / `"2"` / `"2"` / `"3"`; `"2.6"` -> `"3"` / `"3"` / `"2"` / `"3"`; `"-2.4"` -> `"-2"` / `"-2"` / `"-2"` / `"-3"`; `"-2.6"` -> `"-3"` / `"-3"` / `"-2"` / `"-3"`; `"2"` -> `"2"` in all four; `"-2"` -> `"-2"` in all four; `"0.4"` -> `"0"` / `"0"` / `"0"` / `"1"`; `"0.5"` -> `"0"` / `"1"` / `"0"` / `"1"`; `"-0.4"` -> `"0"` / `"0"` / `"0"` / `"-1"`; `"-0.5"` -> `"0"` / `"-1"` / `"0"` / `"-1"` (a negative zero renders `"0"`).
- **R2 decimals 2** (same mode order): `"1.005"` -> `"1.00"` / `"1.01"` / `"1.00"` / `"1.01"`; `"1.015"` -> `"1.02"` / `"1.02"` / `"1.01"` / `"1.02"`; `"1.025"` -> `"1.02"` / `"1.03"` / `"1.02"` / `"1.03"`; `"-1.005"` -> `"-1.00"` / `"-1.01"` / `"-1.00"` / `"-1.01"`; `"-1.015"` -> `"-1.02"` / `"-1.02"` / `"-1.01"` / `"-1.02"`; `"1.001"` -> `"1.00"` / `"1.00"` / `"1.00"` / `"1.01"`; `"1.999"` -> `"2.00"` / `"2.00"` / `"1.99"` / `"2.00"`; `"-0.001"` -> `"0.00"` / `"0.00"` / `"0.00"` / `"-0.01"`; `"0.005"` -> `"0.00"` / `"0.01"` / `"0.00"` / `"0.01"`; `"1.00"` -> `"1.00"` in all four.
- **R3 rendering with exactly `decimals` digits**: `"3.78"`, decimals 4 -> `"3.7800"`; `"5"`, 2 -> `"5.00"`; `"5"`, 0 -> `"5"`; `"0"`, 3 -> `"0.000"`; `"-0"`, 2 -> `"0.00"`; `"0.5"`, 1 -> `"0.5"`; `"1"`, 30 -> `"1."` followed by 30 zeros; `"1"`, 100 -> `"1."` followed by 100 zeros (no cap on `decimals`); `"123456789012345678901234567890.5"`, 0 -> half-even `"123456789012345678901234567890"`, half-up `"123456789012345678901234567891"`; the same negated -> `"-123456789012345678901234567890"`, `"-123456789012345678901234567891"`.
- **R4 no `rounding` block -> no rounding and canonical form**: `FX(ref(f); ratio)`, f=`"4.20"` -> `"4.2"`; f=`"1000.000"` -> `"1000"`; f=`"0.123456789012345678901234567890123"` -> `"0.123456789012345678901234567890123"` (nothing is rounded).
- **R5 intermediates exact, one final rounding** (`rounding {half-up, 0}`, `add(f, g)`): f=`"0.4"`, g=`"0.4"` -> `"1"` (not 0 + 0); `multiply(f, g)`, `"1.5"`, `"1.5"` -> 2.25 -> `"2"`; (`rounding {half-even, 1}`, `add(f, g)`) `"0.04"`, `"0.04"` -> `"0.1"`.
- **R6 `round` operator** (it applies the logic-level `rounding` at that point, and the final rounding still applies): `rounding {half-even, 1}`, `multiply(round(ref(f)), ref(g))`: f=`"0.25"`, g=`"3"` -> round(0.25) = 0.2, times 3 = 0.6 -> `"0.6"`, while `multiply(ref(f), ref(g))` gives 0.75 -> `"0.8"`; `rounding {half-up, 0}`, `add(round(ref(f)), round(ref(g)))`: `"0.4"`, `"0.4"` -> `"0"` (versus `"1"` without `round`); `rounding {half-up, 1}`, `round(ref(f))`, f=`"2.25"` -> `"2.3"`; `round(round(ref(f)))` equals `round(ref(f))`; `round` of `null` is `null`; `round(ref(c))` with output `pm` keeps the unit. `round` without a `rounding` block -> `THROWS INVALID_EXPRESSION` (also when the `round` node is in a branch that is never selected); `{op: round, args: []}` and `round(f, g)` -> `THROWS INVALID_EXPRESSION`.
- **R7 `rounding` validation** -> `THROWS INVALID_EXPRESSION`: `mode` of `half-down`, `HALF-EVEN`, `half_even`, empty string, `5`, missing; `decimals` of `-1`, `1.5`, `"4"`, `null`, `true`, missing; `rounding: null`, `[]`, `"half-even"`. Accepted: `decimals` 0, 30, 100.

[V-21 R1, R2; V-22 R3, R4, R5, R6, R7]

### Division values (F-V) - divisors are nonzero constants (or protected refs) so that no `KF-E-313` arises

- **V1 exact quotients**: O4 (above) is the exact set.
- **V2 inexact, no `rounding` block** -> `CHECK -> []` and evaluation `THROWS INEXACT_DIVISION`: `divide(ref(f), K("3"))`, f=`"1"`; f=`"2"`; `divide(K("1"), K("7"))`; `divide(ref(f), K("2199023255552"))` (2^41, whose quotient has 29 significant digits), f=`"1"`, at the default precision 28; `divide(ref(f), K("1099511627776"))` (28 significant digits) with `precision: 27`, f=`"1"`. The same `divide(ref(f), K("2199023255552"))`, f=`"1"`, with **`precision: 29`** is exact: `"0.00000000000045474735088646411895751953125"`.
- **V3 inexact with a `rounding` block** (the quotient is first rounded to `precision` significant digits, then the final rounding applies): `rounding {half-even, 4}`, `divide(ref(f), K("3"))`: f=`"1"` -> `"0.3333"`; `"2"` -> `"0.6667"`; `"-1"` -> `"-0.3333"`; `"-2"` -> `"-0.6667"`; `divide(ref(c), K("3"))`, c=`Q(1,pm)` (output `pm`) -> `"0.3333"` pm; `rounding {down, 4}`, f=`"2"` -> `"0.6666"`; `rounding {up, 4}`, f=`"1"` -> `"0.3334"`; `rounding {half-up, 0}`, f=`"2"` -> `"1"`.
- **V4 rounding twice is observable** (`precision` option): `precision: 3`, `rounding {half-even, 6}`, `divide(ref(f), K("3"))`: f=`"1"` -> `"0.333000"`; f=`"2"` -> `"0.667000"`; `rounding {down, 6}`, f=`"2"` -> `"0.666000"`; `rounding {half-even, 2}`: f=`"1"` -> `"0.33"`, f=`"2"` -> `"0.67"`. Default precision 28, `rounding {half-even, 30}`: f=`"1"` -> `"0.333333333333333333333333333300"`; f=`"2"` -> `"0.666666666666666666666666666700"`; `rounding {down, 30}`, f=`"2"` -> `"0.666666666666666666666666666600"`; `rounding {up, 30}`, f=`"1"` -> `"0.333333333333333333333333333400"`.
- **V5 double rounding differs from single rounding**: `precision: 3`, `rounding {half-even, 2}`, `divide(ref(f), K("10000000"))`, f=`"1250001"` (quotient 0.1250001, 7 significant digits, inexact at precision 3): rounded to 3 digits -> 0.125, then half-even to 2 decimals -> `"0.12"` (a single rounding of 0.1250001 would give 0.13).
- **V6 the 28/29-digit boundary and a tie in the precision rounding**: `divide(ref(f), K("2199023255552"))`, f=`"1"` (exact value 0.00000000000045474735088646411895751953125, 29 significant digits ending in `...1953125`): precision 28 with `rounding {half-even, 40}` -> `"0.0000000000004547473508864641189575195312"` (an exact tie, even digit kept); `{half-up, 40}` -> `"0.0000000000004547473508864641189575195313"`; `{down, 40}` -> `"0.0000000000004547473508864641189575195312"`; `{up, 40}` -> `"0.0000000000004547473508864641189575195313"`.
- **V7 signs of the significant-digit rounding**: `rounding {up, 4}`, `divide(ref(f), K("3"))`, f=`"-1"` -> `"-0.3334"`; `rounding {down, 4}` -> `"-0.3333"`; `rounding {half-even, 4}` -> `"-0.3333"`.
- **V8 precision 1**: `precision: 1`, `rounding {half-even, 3}`, `divide(ref(f), K("8"))`, f=`"1"` (0.125 has 3 significant digits, inexact at precision 1) -> 0.1 -> `"0.100"`.
- **V9 pending (D-03)**: `divide(K("100000000000000000000000000000000"), K("1"))` (10^32) at precision 28 with no `rounding` block: `"100000000000000000000000000000000"` under option 1, `INEXACT_DIVISION` under option 2; with `rounding {half-even, 0}` the value is `"100000000000000000000000000000000"` under both.
- **V10 long exact digits**: `multiply` and `add` of two constants of 300 digits each are exact and equal the `BigInt` reference computed in the test.

[V-23 V1-V10 (V9 partial D-03)]

### `KF-E-313` protection proof (F-Z) - `CHECK`; template `Z(G; E)` = `FX(E; ratio; guards G)` where `E` defaults to `divide(ref(f), ref(g))`; each guard `raises OUT-0001`; a bare-ref divisor is `g` (decimal) unless stated

**Accepted (`CHECK -> []`).**
- **Za constant nonzero divisors**: `divide(f, K("2"))`, `K("-3")`, `K("0.5")`, `K("0.001")`; `divide(ref(c), Ku("2",pm))`; `divide(ref(c), K("2"))` (output `pm`).
- **Zb guards on the bare-ref divisor `g`** (single guard; by suffix unless stated): `{gain: "0"}`; `{DE-0017.gain: "0"}` (full ref); `{gain: {eq: "0"}}`; `{gain: {eq: "0.00"}}`; `{gain: {eq: "-0"}}`; `{gain: {in: ["1","0"]}}`; `{gain: {in: ["0.0"]}}`; `{gain: {lte: "0"}}`; `{gain: {lte: "5"}}`; `{gain: {gte: "0"}}`; `{gain: {gte: "-1"}}`; `{gain: {between: ["-1","1"]}}`; `{gain: {between: ["0","0"]}}`; `{gain: {between: ["-5","0"]}}`; `{any: [{gain: {is_null: true}}, {gain: {eq: "0"}}]}`; `{any: [{gain: {eq: "0"}}, {gain: {is_null: true}}]}`; `{any: [{gain: {is_null: true}}, {gain: {lte: "0"}}]}`; the protective guard at index 1 behind an unrelated first guard `{material_type: X}`; a quantity divisor `divide(ref(c), ref(h))` with `{baseline: {eq: Q(0,pm)}}`, `{baseline: {lte: Q(0,pm)}}`, `{baseline: {between: [Q(-1,pm), Q(1,pm)]}}`.
- **Zc `if` conditions around the division**: then-branch (`if(C; divide(f, g); K("0"))`) with `C` = `{gain: {ne: "0"}}`, `{gain: {ne: "0.00"}}`, `{gain: {gt: "0"}}`, `{gain: {lt: "0"}}`, `{gain: {not_in: ["0","1"]}}`; else-branch (`if(C; K("0"); divide(f, g))`) with `C` = `{gain: {eq: "0"}}`, `{gain: {lte: "0"}}`, `{gain: {gte: "0"}}`, `{gain: {in: ["0"]}}`, `{gain: {between: ["-1","1"]}}`, `{any: [{gain: {is_null: true}}, {gain: {eq: "0"}}]}`; deeper inside the protected branch: `if({gain: {ne: "0"}}; add(K("1"), multiply(ref(f), divide(ref(f), ref(g)))); K("0"))` and `if({gain: {ne: "0"}}; if({flag: true}; divide(ref(f), ref(g)); K("1")); K("0"))`; quantity: `if({baseline: {ne: Q(0,pm)}}; divide(ref(c), ref(h)); K("0"))`.

**Near-misses (`CHECK ->` exactly the listed `KF-E-313` at the division node, `reason: unprotected` unless stated, `input` the divisor ref).** Pointer `/expression` for the template.
- **Zn1** no guard; `guards: []`.
- **Zn2** a guard on another field: `{loss_factor: {eq: "0"}}`.
- **Zn3** guards that do not contain zero or are not true at zero: `{gain: "1"}`; `{gain: {eq: "1"}}`; `{gain: {in: ["1","2"]}}`; `{gain: {gt: "0"}}`; `{gain: {lt: "0"}}`; `{gain: {ne: "0"}}`; `{gain: {lte: "-1"}}`; `{gain: {gte: "1"}}`; `{gain: {between: ["1","5"]}}`; `{gain: {between: ["-5","-1"]}}`; `{gain: {not_in: ["0"]}}`; `{gain: {is_null: true}}` (alone); `{any: [{gain: {is_null: true}}, {gain: {ne: "0"}}]}`; `{any: [{gain: {is_null: true}}, {gain: {gt: "0"}}]}`.
- **Zn4** not a single matcher on the divisor: `{gain: {eq: "0"}, loss_factor: {gt: "0"}}`; `{all: [{gain: {eq: "0"}}]}`; `{any: [{gain: {eq: "0"}}, {loss_factor: {gt: "0"}}]}`; `{not: {gain: {ne: "0"}}}`.
- **Zn5 compound divisors, even with a covering guard**: `divide(f, subtract(K("1"), ref(g)))` with `{gain: {gte: "1"}}`; `divide(f, abs(ref(g)))` with `{gain: "0"}`; `divide(f, max(ref(g), K("1")))` with `{gain: "0"}`; `divide(f, multiply(ref(g), K("2")))` with `{gain: "0"}`; `divide(f, add(ref(g), K("1")))` with `{gain: {eq: "-1"}}`; `divide(f, if({flag: true}; ref(g); K("1")))` with `{gain: "0"}`; each gives one `KF-E-313` with `input: null`.
- **Zn6 constant zero is never protected** (`reason: zero_constant`, `input: null`): `divide(f, K("0"))`, `K("0.00")`, `K("-0")`, `K("0.0000")`; the same with guards present; inside a would-be protective `if`: `if({gain: {ne: "0"}}; divide(ref(f), K("0")); K("0"))`; `divide(ref(c), Ku("0",pm))` (output `ratio`).
- **Zn7 wrong branch or wrong condition**: `if({gain: {ne: "0"}}; K("0"); divide(f, g))` (the `else` of a condition that is false at zero); `if({gain: {eq: "0"}}; divide(f, g); K("0"))` (the `then` of a condition that is true at zero); condition on another field `{loss_factor: {ne: "0"}}`; `if({gain: {gt: "-1"}}; divide(f, g); K("0"))` (true at zero in the `then`); two keys `{gain: {ne: "0"}, flag: true}`.
- **Zn8 two divisions**: `add(divide(ref(f), ref(g)), divide(ref(g), ref(f)))` with only `{gain: "0"}` -> one `KF-E-313` at `/expression/args/1` (`input: DE-0017.loss_factor`); with no guard -> two, at `/expression/args/0` (`input: DE-0017.gain`) and `/expression/args/1`; with guards on both -> `[]`.

**Pending (D-02)**: under option 1 each of these is one `KF-E-313`, under option 2 each is `[]`. Guards: `{gain: {lt: "1"}}`, `{gain: {gt: "-1"}}`, `{gain: {ne: "5"}}`, `{gain: {not_in: ["5"]}}`, `{gain: {is_null: false}}`, `{any: [{gain: {eq: "0"}}, {gain: {eq: "1"}}]}`. Then-branch conditions: `{gain: {gt: "1"}}`, `{gain: {gte: "1"}}`, `{gain: {lt: "-1"}}`, `{gain: {lte: "-1"}}`, `{gain: {eq: "1"}}`, `{gain: {in: ["1"]}}`. Else-branch conditions: `{gain: {lt: "1"}}`, `{gain: {gt: "-1"}}`, `{gain: {ne: "5"}}`.

- **Zr runtime of protected divisions**: guard `{gain: "0"}`: g=`"0"` -> `RAISED OUT-0001 @0`; g=`"0.000"` -> `RAISED`; f=`"2"`, g=`"4"` -> `"0.5"`; g absent -> `OK null`; f absent, g=`"4"` -> `OK null`. `if({gain: {ne: "0"}}; divide(f, g); K("0"))`: g=`"0"` -> `"0"`; f=`"2"`, g=`"4"` -> `"0.5"`; g absent -> `"0"`. Quantity: `divide(ref(c), ref(h))` (output `ratio`) with guard `{baseline: {eq: Q(0,pm)}}`: c=`Q(5,pm)`, h=`Q(2,pm)` -> `"2.5"`; h=`Q(0,pm)` -> `RAISED`; h=`Q(0.0,pm)` -> `RAISED`.
- **Zs static findings block evaluation**: the unprotected template evaluated with f=`"1"`, g=`"2"` -> `ERR [KF-E-313]`; with g=`"0"` -> `ERR [KF-E-313]` (never `DIVISION_BY_ZERO`, nothing is divided); `divide(f, K("0"))` evaluated -> `ERR [KF-E-313]`.
- **Zd 313 shape**: `pointer` is the division node (`/expression`, `/expression/args/1`, `/expression/else`), `remediation` equals `añadir `guard``, `rule` and `rule_index` are `null`, only `KF-E-313` carries `remediation`.

[V-25 Za, Zb, Zc, Zr; V-26 Zn1-Zn8 (D-02 rows held); V-27 Zs, Zd]

### Static findings, supplied values, ordering (F-T, F-K, F-S)

- **T1 static findings block evaluation, before the values**: for one formula per code (`KF-E-310` of `expression` and of `output`, `KF-E-313`, `KF-E-314` and `KF-E-315` from a guard, `KF-E-316`'s finding), `evaluateFormula` returns `status: 'error'` with exactly the `checkFormula` list, `value: null`, `outcome: null`, `guard_index: null`; supplying an invalid value (`f = 0.1`, a number) together with a static finding yields the `ERR`, not a thrown `INVALID_DECIMAL` (P-07).
- **T2 supplied-value findings** (formula without static findings, `inputs` all nine): e=`"W"` -> `ERR [KF-E-314]` with `input: DE-0017.material_type`, `value: W`, `source: value`, `pointer: /inputs/6`, even though no expression or guard reads `material_type`; e=`null` or absent, e=`"X"` -> ok; two bad supplied values (e=`"W"` and c=`Q(1,ppm)`) -> two diagnostics, `KF-E-310` then `KF-E-314` (sorted); c=`Q(1,ppm)` -> `ERR [KF-E-310]` `source: value`, `pointer: /inputs/0`.
- **K1 code matrix**: each in-scope code has a positive and a near-miss, all cited above: `KF-E-310` (U1 / U1 near-miss; U7 / U7 near-miss); `KF-E-313` (Zn1 / Za, Zb); `KF-E-314` (G5 / G5 near-miss); `KF-E-315` (G5 / G5 near-miss); `KF-E-316` (U6 / U4). No case anywhere yields `KF-E-010`, `KF-E-311` or `KF-E-312`, nor any code outside the five of this phase.
- **S1 four codes in one formula** (UF1; inputs all nine; output `ratio`; expression `add(ref(c), ref(p), multiply(ref(c), divide(ref(f), ref(g))))`; guards `[{when: {material_type: "W"}, raise: OUT-0001}, {when: {note: {matches: "(a)\\1"}}, raise: OUT-0002}]`) -> exactly this ordered list of `(code, pointer)`: (`KF-E-310`, `/expression/args/1`) [`ppm_mass` against reference `percent_mass`], (`KF-E-310`, `/output/unit`) [computed `percent_mass`, output `ratio`], (`KF-E-313`, `/expression/args/2/args/1`), (`KF-E-314`, `/guards/0/when/material_type`), (`KF-E-315`, `/guards/1/when/note/matches`). **S1b (pending D-01)**: the same plus a `KF-E-316` and its consequences.
- **S2 determinism**: every formula of the slice with the keys of every mapping (nodes, `output`, `rounding`, guards, `when` mappings) permuted returns the identical result; a fresh child process returns byte-identical JSON for a representative set (W2, W5, G1, V4, Zn8, S1); every returned list is sorted by the key in "Diagnostic sort key".
- **S3 purity**: `logic`, `values` and `options` (including `inputs`) deep-frozen before the call: no throw; results are not the same object across calls; the formula is unchanged afterwards.
- **S4 shape**: every diagnostic has `severity: 'E'`, `rule: null`, `rule_index: null`; only `KF-E-313` carries `remediation`, equal to the catalog text; no diagnostic carries a key named `error`; a `KF-` code is never thrown and a `LogicError` code never appears in `diagnostics`.
- **S5 constants**: `FORMULA_DIAGNOSTIC_CATALOG` keys are exactly `KF-E-313` and `KF-E-316`; their `severity` and `remediation` equal l.1768 and l.1771 (`KF-E-313`: `añadir `guard``; `KF-E-316`: none); `LOGIC_DIAGNOSTIC_CATALOG` is unchanged (the five P011 rows); `FORMULA_ERROR_CODES` is `['DIVISION_BY_ZERO', 'INEXACT_DIVISION', 'INVALID_EXPRESSION']`; `LOGIC_ERROR_CODES` is unchanged (14 codes).

[V-28 T1, T2; V-29 K1, S1, S4; V-30 S2; V-31 S3; V-32 S5]

### Decimal operations, direct (F-M)

- **M1 `absDecimal`**: `"-3.50"` -> `"3.5"` (via `formatDecimal`); `"-0"` -> `"0"`; `"4"` -> `"4"`; a non-Decimal argument -> `THROWS INVALID_ARGUMENT`.
- **M2 `roundDecimal`**: the R1 and R2 tables (rendered with `formatDecimalFixed`); `result.scale` equals `decimals`; padding (`"3.78"`, 4 -> `"3.7800"`); bad `mode` (`"half-down"`), `decimals` of `-1`, `1.5`, `"2"`, `undefined` -> `INVALID_ARGUMENT`.
- **M3 `roundDecimalSignificant`** (`digits`): `("123456", 3, half-even)` -> `"123000"`; `("123500", 3, half-even)` -> `"124000"`; `("123500", 3, down)` -> `"123000"`; `("123500", 3, up)` -> `"124000"`; `("0.0012345", 3, half-even)` -> `"0.00123"`; `("0.0012355", 3, half-up)` -> `"0.00124"`; `("-0.0012355", 3, half-up)` -> `"-0.00124"`; `("0", 5, half-even)` -> `"0"`; `digits` of `0`, `-1`, `1.5` -> `INVALID_ARGUMENT`.
- **M4 `divideDecimal`**: `("1","4",{precision:28})` -> `{exact: true}` value `"0.25"`; `("6","3",...)` -> `"2"`; `("1","3",{precision:28})` -> `{exact: false, value: null}`; with `mode: 'half-even'` -> `{exact: false}` value `"0.3333333333333333333333333333"`; `("1","3",{precision:3,mode:'up'})` -> `"0.334"`; `("-1","3",{precision:3,mode:'down'})` -> `"-0.333"`; `("1","8",{precision:2,mode:'half-even'})` -> `"0.12"`; `("1","8",{precision:3})` -> exact `"0.125"`; `("1","1099511627776",{precision:28})` exact, `precision:27` inexact; `("0","5",...)` -> exact `"0"`. `DIVISION_BY_ZERO` for `("1","0")`, `("0","0")`, `("5","-0")`. `INVALID_ARGUMENT` for `precision` of `0`, `-1`, `1.5`, `"28"`, `NaN`, `undefined`, a missing options object, a bad `mode`, and a non-Decimal operand.
- **M5 `formatDecimalFixed`**: `parseDecimal("4.20")` -> `"4.20"`; `"-0.00"` -> `"0.00"`; `"0"` -> `"0"`; `"-1.5"` -> `"-1.5"`; `"007"` -> `"7"`.

[V-33 M1-M5]

### Depth and size (F-N)

- **N1 depth**: a chain of 500 nested `add(<inner>, K("1"))` over `ref(f)` evaluates (f=`"0"` -> `"500"`) and checks clean; a chain of 1,100 -> `THROWS INVALID_EXPRESSION` from both functions and never a `RangeError`; the same for 600 nested `if` nodes (accepted) and 1,100 (rejected). The exact boundary is not asserted (N-07).
- **N2 width**: `add` with 5,000 `K("1")` arguments -> `"5000"`; `min` and `max` with 5,000 arguments.
- **N3 digits**: constants of 2,000 digits multiplied exactly (compared with `BigInt` in the test); a constant of 5,000 digits round-trips through the root-leaf formula; all within 5 s.

[V-34 N1-N3]

### §55 and P011 non-regression (F-E)

- **E1** No `expected/` line, `acme-formulation` entity, `spec-examples` file, `bin/`, `package.json`, `eslint.config.js` or `framework/schemas/**` file is added or changed by P012 (`git status --porcelain` over those paths is empty; same shape as P011 F-A5).
- **E2** `framework/engine/decimal.mjs`, `units.mjs`, `regex-re2.mjs` and every file under `test/p011-*`, `test/conformance-p011-*`, `framework/conformance/p011-*` are byte-identical to `ENTRY_SHA`; `decision-table.mjs`, `logic-diagnostics.mjs`, `logic-errors.mjs` differ from it only by added lines (`git diff --numstat ENTRY_SHA -- <file>` reports `0` deletions) and still export everything they exported (export list is a superset); `node --test test/p011-*.test.mjs test/conformance-p011-decision-table.test.mjs` passes with the same counts as at `ENTRY_SHA`.

[V-35 E1, E2]

### Static source scans (F-P) - run by the implementer's test, re-run by the Foreman

- **P1** `formula.mjs`, `decimal-ops.mjs` and the three edited modules import only from `framework/engine/` siblings (no `node:` module, no package, no dynamic `import(`).
- **P2** none of `parseFloat`, `toFixed`, `toPrecision`, `Math.random`, `Date`, `performance`, `process.env`, `crypto`, `readFile`, `setTimeout`, `setInterval`, `require(`, `eval(`, `new Function` appears in `formula.mjs`, `decimal-ops.mjs`, `decision-table.mjs`, `logic-diagnostics.mjs`, `logic-errors.mjs`; none of `Number(`, `parseInt`, `Math.` appears in `decimal-ops.mjs` or `formula.mjs`; none of `new RegExp`, `RegExp(`, `.match(`, `.exec(`, `.test(` appears in `formula.mjs`, `decimal-ops.mjs` or `decision-table.mjs` (the P011 scans over the six P011 modules keep passing). Any necessary exception is listed in `HANDOFF.md` and justified. [V-36]

## Implementation sequence

1. **Conformance engineer first** (`kf-conformance-engineer`): write `framework/conformance/p012-formula.yaml`, the data directory and `test/conformance-p012-formula.test.mjs` from this plan, the spec and errata only, before opening `framework/engine/formula*.mjs`, `decimal-ops.mjs` or any implementer diff. The suite is red (or skipped with named `test.todo`) at that point. Every assertion held by a D-nn is `pending-decision`; the report states the commit it was written at and that no implementer code was read. Reading the P011 engine and tests is allowed for the public API only.
2. **Foreman verifies** the slice (observable behavior only; each case cites a clause or E-id), decides D-01..D-03 into errata or defers them, then briefs the implementer. Unresolved items block only the assertions named under "Blocked until decided".
3. **Implementer** (`kf-implementer`), each step with tests failing first:
   1. Additive constants: `FORMULA_ERROR_CODES`, `FORMULA_DIAGNOSTIC_CATALOG`, `makeFormulaDiagnostic` (F-K S5).
   2. `decimal-ops.mjs` (F-M, V-33).
   3. The four appended exports of `decision-table.mjs`; run the P011 suites immediately (F-E E2).
   4. `formula.mjs`, validation pass first: structure, arity, refs and binding, operand types, `const` and unit lookups, `rounding`, `guards` (F-X, F-B).
   5. Unit algebra and the output check (F-U), then the `KF-E-313` protection proof (F-Z).
   6. Evaluation: guards, lazy `if`, arithmetic and null propagation, division and rounding, rendering (F-O, F-G, F-I, F-L, F-R, F-V, F-W).
   7. Static blocking and supplied-value findings (F-T), ordering and determinism (F-K, F-S).
   8. Adversarial pass: depth and width (F-N), very long digit strings, hostile ref and key names (`__proto__`, `constructor`), property-order permutations, frozen inputs, the P-07 order.
4. Run `npm run build`, `npm run lint`, `npm test`, `git diff --check`, the P012 conformance test, the targeted P012 tests twice (deterministic repeat), and the P011 suites. Inspect `git status` against the write boundaries (including that `decimal.mjs`, `units.mjs`, `regex-re2.mjs`, `id-registry.mjs` are unchanged and the three edited modules are additive).
5. Fill `TRACEABILITY.md` (PASS only with executable evidence), write `HANDOFF.md` naming the exact product commit and the downstream note on the formula `BR` (see "Fixture slice"). The Foreman commits product then control plane, sets `READY_FOR_AUDIT`, and audits with fresh instances (blind pass first).

## Verification targets

Each target maps to fixture cases and to a test in `test/conformance-p012-formula.test.mjs` (conformance) or `test/p012-*.test.mjs` (implementer's tests). "Partial" targets have a part held by an open D-nn.

| V | Observable target | Case | Status of decision |
|---|---|---|---|
| V-01 | `add`, `subtract`, `multiply` are exact (no float), fold left, one-argument form returns the argument canonically, arities enforced | F-O1..O3 | - |
| V-02 | `divide`: exact quotients (incl. 28 significant digits), arity 2, negative and quantity divisors | F-O4 | - |
| V-03 | `min`, `max`, `abs`, `clamp` (inclusive bounds, numeric order, `INVALID_RANGE` at evaluation), leaves at the root | F-O5..O8 | - |
| V-04 | Every malformed expression, `output`, `guards`, `raise`, `kind`, string expression, unknown `op` and arity violation is `INVALID_EXPRESSION` (check and evaluate alike) | F-X1 | - |
| V-05 | `const` operands and supplied values must be decimal strings (`INVALID_DECIMAL`); undeclared `const.unit`, `output.unit` or input unit is `UNKNOWN_UNIT` | F-X2, F-X3 | - |
| V-06 | Refs bind by full ref or suffix; `UNBOUND_FIELD`, `AMBIGUOUS_FIELD`; only `quantity`/`decimal` inputs are operands (`TYPE_MISMATCH`) | F-X4, F-X5, F-B5 | - |
| V-07 | `unitRegistry`, `inputs`, `precision`, `values` are validated (`INVALID_ARGUMENT`) by both functions | F-B1..B4 | - |
| V-08 | Unit identity (by id, never by dimension) for `add`, `subtract`, `min`, `max`, `clamp`: `KF-E-310` with the offending operand pointer, one per offender, near-misses clean | F-U1, F-U2, F-U5 | - |
| V-09 | `if` branches must have identical units; the pointer is the offending branch | F-U3 | - |
| V-10 | `multiply`/`divide` result units: dimensionless, single registered unit, cancellation, `{ratio: 1}`; no `KF-E-316` for admissible results | F-U4 | - |
| V-11 | `KF-E-316` on the node whose monomial is inadmissible (squares, products, quotients, negative exponents, no lookup by name or dimension) | F-U6 | partial (D-01: complete lists) |
| V-12 | Output check: computed unit must equal `output.unit` by id; dimensionless output needs a registered unit with `dimension: dimensionless`; unknown output unit is `UNKNOWN_UNIT` | F-U7 | - |
| V-13 | `abs`/`round`/`min`/`max`/`clamp` keep units; the unit check is static and independent of values | F-U8, F-U9 | - |
| V-14 | The spec example l.641-652 checks clean and evaluates end to end (values, raised, null, rounding, supplied-value findings, suffix binding, mutations) | F-W1..W8 | - |
| V-15 | Guards: document order, first true guard wins, evaluated before the expression, `raised` result shape | F-G1..G3 | - |
| V-16 | Guard predicate types and P011 semantics; static predicate findings `KF-E-310/314/315` with exact pointers; `EMPTY_PREDICATE`, `INVALID_RANGE`, `raise` pattern (existence of `OUT` not checked) | F-G4..G6, F-X6, F-X7, F-X8 | - |
| V-17 | `if` selects lazily, a `null` condition is false, both branches are checked statically, nested `if` | F-I1..I6 | - |
| V-18 | Rounding of the spec example: ties, signs and no negative zero for all four modes | F-W5 | - |
| V-19 | The spec example's guard, `gte` and null handling at the boundary values | F-W2, F-W3, F-W4 | - |
| V-20 | Null propagation through every operation; null is not zero; explicit `null` equals absent; rounding of `null` | F-L1..L5 | - |
| V-21 | Rounding modes over positive, negative, tie and zero values at `decimals` 0 and 2 | F-R1, F-R2 | - |
| V-22 | `decimals` rendering (exact digits, no cap), no rounding without a block, one final rounding, the `round` operator, `rounding` validation | F-R3..R7 | - |
| V-23 | Division values: exact set, `INEXACT_DIVISION` without a block, rounding to `precision` significant digits with the declared mode, double rounding observable, `precision` option, 28/29-digit boundary and tie, signs | F-V1..V10 | partial (D-03: F-V9) |
| V-24 | Supplied-value findings and typed errors at evaluation: wrong unit, bare scalar, quantity for decimal, validated before guards | F-W6, F-T2 | - |
| V-25 | `KF-E-313` accepted protections: nonzero constant, guard on the bare-ref divisor (all listed forms), `if` condition (then and else); runtime behavior of protected divisions | F-Za, F-Zb, F-Zc, F-Zr | - |
| V-26 | `KF-E-313` near-misses: no guard, other field, non-covering guards, non-single matchers, compound divisors, constant zero (never protected), wrong branch, two divisions | F-Zn1..Zn8 | partial (D-02: extra sound forms) |
| V-27 | Static findings block evaluation (a zero divisor is never reached); `KF-E-313` field shape and remediation | F-Zs, F-Zd, F-T1 | - |
| V-28 | Static findings precede value binding; supplied-value findings yield `status: 'error'` | F-T1, F-T2 | - |
| V-29 | Each in-scope code has a positive and a near-miss; four codes in one formula in the specified order; diagnostic shape; no foreign `KF-` code | F-K1, F-S1, F-S4 | partial (D-01: S1b) |
| V-30 | Determinism: key-order permutations, fresh process, repeated calls; sorted lists | F-S2 | - |
| V-31 | Purity: frozen inputs accepted, fresh outputs, inputs never mutated | F-S3 | - |
| V-32 | Constants: `FORMULA_DIAGNOSTIC_CATALOG` equals l.1768 and l.1771; P011 catalog and error list unchanged; `FORMULA_ERROR_CODES` | F-S5 | - |
| V-33 | `decimal-ops.mjs`: `absDecimal`, `roundDecimal`, `roundDecimalSignificant`, `divideDecimal` (`DIVISION_BY_ZERO`, exact flag), `formatDecimalFixed`, argument validation | F-M1..M5 | - |
| V-34 | Depth limit (`INVALID_EXPRESSION`, no `RangeError`), wide expressions, very long digit strings | F-N1..N3 | - |
| V-35 | No `expected/`, `acme-formulation`, `bin/`, `package.json`, schema change; P011 files byte-identical or additive; P011 suites unchanged and green | F-E1, F-E2 | - |
| V-36 | Static scans: sibling imports only; no float, clock, randomness, I/O, host `RegExp`, `eval` in the new and edited modules | F-P1, F-P2 | - |
| V-37 | `npm run build`, `npm run lint`, `npm test`, `git diff --check` pass; no file outside the write boundaries changed; no new dependency | - | - |
| V-38 | Routing: `KF-` codes are never thrown, `LogicError` codes never appear in `diagnostics`; `checkFormula` and `evaluateFormula` raise the same code for the same structural defect | F-S4, F-X, F-B | - |

38 verification targets; 4 are partial (V-11 and V-29 on D-01, V-26 on D-02, V-23 on D-03).

## Blocked until decided

| Item | Held assertions / deliverables |
|---|---|
| D-01 | The complete diagnostic list of every case that contains a `KF-E-316` (the `KF-E-316` finding itself is asserted): F-U6 lists, the `KF-E-316` case of F-I4, F-S1b. The shape of the unit-flow code in `formula.mjs` (an "unknown" marker versus a flowing monomial) is held; the implementer builds everything else and reports. |
| D-02 | The rows listed "Pending (D-02)" in F-Z. The accepted and near-miss forms listed under Za-Zn8 are asserted now (identical under both options). |
| D-03 | F-V9 (`10^32 / 1` with no `rounding` block). |

## Risk and ownership

HIGH: executable regulatory computations; a wrong decimal, rounding, unit or null rule silently validates or rejects real rules, and P013/P014 build on these modules. Owners: Foreman (scope, errata, decisions, commits); `kf-conformance-engineer` (fixture and conformance test, first); `kf-implementer` (engine modules, unit tests, handoff); auditors read-only. Never an implementer and an auditor on the phase at the same time.

- R-01 Hidden binary floats: `Number`, JSON round trips, `Math` helpers, YAML numbers entering as values or constants. Covered by V-01, V-05, V-33, V-36. Auditors should try `0.1 + 0.2`, 2^53 pairs and exponent forms.
- R-02 Rounding off-by-one: ties, negative values, negative zero, rounding applied to intermediates or twice by mistake, mode confusion between `down`/`up` (toward/away from zero) and floor/ceiling. Covered by V-18, V-21, V-22, V-23, V-33. Auditors should enumerate tie patterns over several scales and signs.
- R-03 Unit algebra fail-open: identity by dimension instead of id; a product silently given a unit; the dimensionless rule matching a non-`dimensionless` unit; the check running only on the selected `if` branch. Covered by V-08..V-13. Auditors should try same-dimension pairs and registries declaring look-alike units.
- R-04 `KF-E-313` proof unsound or over-eager: a guard that does not cover zero accepted; a compound divisor accepted; a constant zero accepted inside a protective `if`; the wrong `if` branch. Covered by V-25, V-26. Auditors should search for single matchers whose truth at zero is mishandled (open/closed bounds, `-0`, `0.00`, quantities).
- R-05 Laziness and ordering: guards after the expression, both `if` branches evaluated, a runtime error surfacing from an unselected branch. Covered by V-15, V-17.
- R-06 Null treated as zero or false in arithmetic, `if`, guards or rounding. Covered by V-20, V-19.
- R-07 Extending P011 modules changes P011 behavior or its tests. Covered by V-35 (additive-only diff, P011 suites). P-02 is the plan's way to keep two P011 test pins intact.
- R-08 Stack overflow or quadratic blowup on deep or wide expressions and long digit strings. Covered by V-34. Auditors should try 100,000-argument lists and 10,000-level nesting.
- R-09 The pending decisions (D-01..D-03) shape diagnostics consumed by P014; the cascade of D-01 is the one with visible API impact.
- R-10 Local diagnostic constants duplicate the catalog until P028 (P011 R-06); P007/P014 must re-source `FORMULA_DIAGNOSTIC_CATALOG` too.
- R-11 eslint globals: `structuredClone`, `performance` are undeclared; using them fails `npm run lint`.
- Dependencies downstream: P013 (shares `LogicError`, predicates), P014 (`check-rules` runs `evaluateFormula` against `given`, builds `inputs` from the entity model, needs a formula-facet `BR`), P007 (validate wiring, `logic.decimal_precision` to `precision`, `units.yaml` discovery, error-code mapping, `OUT` existence of `raise`, `output.ref` resolution).

## Exit criteria

1. Every V-nn above is backed by a passing, named test, except assertions explicitly held by a still-open D-nn, which are listed in `HANDOFF.md` with the decision they wait for; none of those may be implemented by guess.
2. The conformance slice was written before the implementer read it, and the conformance engineer's report states the commit it was written at and that no implementer code had been read.
3. `framework/engine/decimal.mjs`, `units.mjs`, `regex-re2.mjs`, `id-registry.mjs`, `framework/schemas/**`, `package.json` and `eslint.config.js` are unchanged; `decision-table.mjs`, `logic-diagnostics.mjs`, `logic-errors.mjs` changed by additions only; no P011 test or conformance file changed; the P011 suites pass with the counts of `ENTRY_SHA`; no new dependency; no `bin/` content.
4. `TRACEABILITY.md` rows are `PASS` only with executable evidence (test name or case path); remaining rows state their blocking decision.
5. `npm run build`, `npm run lint`, `npm test`, `git diff --check` pass; `git status` shows only paths inside the write boundaries.
6. `HANDOFF.md` names the exact product commit. The Foreman decides acceptance after an independent audit (blind pass first); implementer and conformance engineer instances never audit.

## Non-goals

- State machines and narrative rules (P013); scenario checking, `kf check-rules`, `KF-E-320`, `given` mapping (P014).
- CLI, `kf validate`, `kf lint`, `KF-W-124`, `units.yaml` discovery and reading, merging of registries, mapping of typed errors to exit codes, reading `logic.*` configuration (`decimal_precision` reaches the engine only as the explicit `precision` option) (P007).
- Cross-entity checks: `OUT` entity existence for `raise`, `output.ref` resolving to a real `DE` field, input `type`/`unit` against the `DE` field declaration, building `inputs` from the entity model (P007/P014).
- JSON Schema validation of `logic` and `KF-E-010` (E-0022 D-01).
- Changing `logic.schema.json`, `common.schema.json`, `acme-formulation/**`, `spec-examples/**`; adding `framework/conformance/expected/`; adding a formula `BR` to the fixture (see "Fixture slice").
- Unit conversion of any kind, unit names for derived dimensions, dimension analysis beyond the monomial rule.
- Static detection of a constant `clamp` with `lo > hi`, of statically known inexact divisions, of dead branches or unreachable guards, SAT or SMT reasoning of any kind (l.634).
- Performance targets beyond the 5 s bound of F-N; caching.
