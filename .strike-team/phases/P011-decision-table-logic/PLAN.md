# P011 - Decision Table Logic

Planned at base `5fce77d5cac754b78737c1c1de591a470b8a43e2`. Spec triage, the Foreman's decisions (E-0017..E-0021) and the eight planning-time `DECISION_NEEDED` items (D-01..D-08) are in `TRIAGE.md`. Every assertion held by an open D-nn is marked "pending (D-nn)" below and in `TRACEABILITY.md`; nothing is implemented by guess.

## Foreman decisions after planning (binding; supersedes every "pending (D-nn)" below)

D-01..D-08 are decided by errata **E-0022** (2026-10-10), which also amends E-0019 on `when: {}`. Every assertion marked "pending (D-nn)" is now asserted in full with these values:

- D-01: option 1. No JSON Schema validation and no `KF-E-010` in P011; structurally invalid input is `INVALID_TABLE`.
- D-02: option 3. Supplied values bind by the `when` rule (full `ref` or last-`.` suffix); unbound supplied key `UNBOUND_FIELD`; two keys for one input, or one key for two inputs, `AMBIGUOUS_FIELD`.
- D-03: option 1. `all: []` / `any: []` are `EMPTY_PREDICATE`.
- D-04: division is removed from P011 (P012 owns it with `rounding`); drop `divideDecimal`, `DIVISION_BY_ZERO`, `INVALID_PRECISION` and their cases from this phase.
- D-05: option 1 with specifics: RE2 defaults (`.` excludes `\n`; `^`/`$` whole-text only; ASCII `\d \w \s`); accepted escapes = escaped metacharacters + `\n \t \r \f \v`; empty pattern valid (matches all); `\b`, POSIX classes, nested quantifiers (`a**`) and anything unlisted are `KF-E-315`; compiled program > 100000 instructions is `KF-E-315`.
- D-06: option 1. First input outermost, last input varies fastest; values in `domain` order.
- D-07: option 2. Any mapping at any depth in `then` whose key set is exactly `{value, unit}` is a quantity (`UNKNOWN_UNIT`, `INVALID_DECIMAL` apply).
- D-08: a top-level `when: {}` is an **unconditional non-default row** (matches every input; overlaps every other non-default row under `unique` → `KF-E-312`; does not satisfy the `when: default` requirement of l.634, though it covers every tuple under enumeration). `{}` nested inside `all`/`any`/`not` stays `EMPTY_PREDICATE`. The acme `BR-0001` observed facet therefore checks clean and evaluates.

Planner API choices P-01..P-09 in `TRIAGE.md` are accepted as written, including P-06 (no `units.yaml` file reading in P011).

## Objective and authorization

Implement §53 item 9, first part (C9a): the pure-logic foundation of executable rules and the `decision-table` grammar of §12.1.

- An exact decimal module (no binary floating point; E-0017).
- A unit-registry builder with no implicit conversion (E-0018).
- An engine-owned, linear-time evaluator for a whitelisted RE2 subset (E-0021).
- The decision-table checker (static diagnostics `KF-E-310`, `KF-E-311`, `KF-E-312`, `KF-E-314`, `KF-E-315`) and evaluator (`first | unique | collect`, `default`, null semantics), per E-0019, E-0020, E-0021.

Authorization: the `PHASES.md` row for P011 (HIGH risk), opened by the Foreman under `PROTOCOL_V2.md`. P011 is an **engine API phase**: no `bin/`, no `kf` command, no `package.json` change, no new dependency, no schema change (E-0014 precedent; P007 wires `kf validate`, P014 wires `kf check-rules`).

The §53 item 9 is split by the roadmap into P011 (decision tables, decimal, units, RE2), P012 (formulas) and P013 (state machines, narrative). P011 itself is small enough for one audit round (five new engine modules plus one diagnostics-constants module, roughly 1,200 lines expected); no further split is proposed.

## Entry gate

- P001 is `ACCEPTED`: `.strike-team/phases/P001-core-persistent-model/audits/CLAUDE_AUDIT_R03.md` carries `VERDICT: ACCEPTED` (line 68); product SHA `c738bd6675bb44c80ef890daf28b335718fbe9c5`. P001 fixed `framework/schemas/logic.schema.json` and the `quantity` shape (`framework/schemas/common.schema.json` `$defs.quantity`, `value` pattern `^-?(?:[0-9]+)(?:\.[0-9]+)?$`, `unit` non-empty string).
- `STATE.yaml` and `PHASES.md` show P001 `ACCEPTED` and P011 `PLANNED`.
- Errata E-0017..E-0021 are committed (`451b25e`). Errata read in full before work: E-0008 (a) and (d), E-0014 (precedent only), E-0017, E-0018, E-0019, E-0020, E-0021.
- Base commit when this plan was written: `5fce77d5cac754b78737c1c1de591a470b8a43e2`. **Gate: `TRIAGE.md`, this plan and `TRACEABILITY.md` are committed, and `git status` is clean, before the conformance engineer is briefed.** The Foreman records the resulting SHA in the briefs (`ENTRY_SHA = <fill>`). P002 runs concurrently on disjoint paths; P011 never touches `framework/engine/id-registry.mjs`, `framework/schemas/**`, `.kf/**`, or P002 files.
- Open decisions D-01..D-08 do not gate the conformance engineer or the start of implementation; they gate only the assertions listed under "Blocked until decided".
- Tooling facts: Node `>=24`; `eslint.config.js` declares only the globals `process console URL Buffer setTimeout clearTimeout` (plus the ES builtins). `structuredClone`, `performance`, `TextEncoder` are **not** declared: import them (`node:perf_hooks`) or avoid them. Nobody in this phase edits `eslint.config.js`.

## Normative coverage

Line numbers are those of `knowledge-framework-spec-v2.1.md` and were verified with `sed -n`/`awk`. Quotes are verbatim (Spanish prose, English keywords). "E-" entries are binding decisions that refine or fill a clause; they never override a SHALL.

| § | Contract | Verbatim clause fragments (line) | Errata |
|---|---|---|---|
| §11.1 | Business numbers are exact arbitrary-precision decimals; binary float is never used in rule evaluation. | l.582 "Todo valor numérico de negocio **SHALL** evaluarse como **decimal de precisión arbitraria**. Coma flotante binaria **SHALL NOT** usarse en la evaluación de reglas." | E-0017 |
| §11.1 | Quoted-string decimals are the only encoding; the lint warning `KF-W-124` is not P011's. | l.583 "En YAML, los decimales **SHALL** escribirse como string entrecomillado (`"4.2"`) para evitar que el parser los convierta a float. `kf lint` **SHALL** advertir sobre decimales sin comillas (`KF-W-124`)." | E-0017 |
| §11.1 | No rounding unless declared (P012); P011 performs none. | l.584 "El redondeo **SHALL** declararse explícitamente donde se aplique: `rounding: {mode: half-even \| half-up \| down \| up, decimals: N}`. Sin declaración, no hay redondeo." | E-0017, D-04 |
| §11.1 | Division by zero is a formula matter (`KF-E-313`, `guard`); the decimal module only refuses it with a typed error. | l.585 "División por cero → `KF-E-313` en validación, o el `guard` declarado en tiempo de evaluación." | E-0021, T-12 |
| §11.2 | Declared unit different from received unit is `KF-E-310`; no automatic conversion. | l.589 "**En v1 NO existe conversión automática de unidades. Unidad declarada distinta de unidad recibida es ERROR (`KF-E-310`).**" | E-0018, E-0019 |
| §11.2 | Convertible pairs are still errors; `percent_*` units are never interchangeable; bare `percent` has no built-in validity. | l.591 "Esto incluye pares matemáticamente convertibles. `percent` frente a `ppm` es error. Y `percent` a secas **SHALL NOT** ser una unidad válida en un dominio donde exista ambigüedad masa/volumen: el framework distribuye `percent_mass`, `percent_volume`, `percent_mass_per_volume` y **SHALL NOT** tratarlas como intercambiables." | E-0018 |
| §11.2 | Units come from `units.yaml` of this exact shape; `conversions` empty in v1; no inferred conversion, ever. | l.593 "Las unidades se declaran en `extensions/<domain>/units.yaml`:"; l.596-599 `units:` / `- {id: percent_mass, dimension: mass_fraction, symbol: "% m/m"}` / `- {id: ppm_mass, dimension: mass_fraction, symbol: "ppm"}` / `conversions: []     # vacío en v1; futuras conversiones serán explícitas y nombradas`; l.602 "**SHALL NOT** añadir nunca conversión inferida." | E-0018 |
| §11.3 | `null` means absent; any comparison with a `null` operand is `false` except `is_null`. | l.606 "`null` **SHALL** significar "ausente", nunca "cero" ni "falso"."; l.607 "Toda comparación con un operando `null` evalúa a `false`, salvo `is_null`." | E-0019 |
| §11.3 | Enums declare their domain; out-of-domain is `KF-E-314`. | l.608 "Todo `enum` **SHALL** declarar su `domain`. Un valor fuera del dominio en un escenario → `KF-E-314`." | E-0019 |
| §11.4 | RE2 dialect, no catastrophic backtracking, uncompilable pattern `KF-E-315`. | l.612 "Dialecto **RE2** (sin backreferences ni lookaround, sin backtracking catastrófico). Las reglas se evalúan en CI; una regex patológica es un fallo de disponibilidad. Patrón no compilable en RE2 → `KF-E-315`." | E-0021, D-05 |
| §12 | Only `decision-table` is in P011; the other kinds are P012/P013. | l.616 "`logic.kind` ∈ `decision-table \| formula \| state-machine \| narrative`. Las cuatro quedan cerradas en v2.1." | — |
| §12.1 | Predicate grammar: field matchers combined by `all`, `any`, `not`. | l.621 "predicate := { field: matcher } \| { all: [predicate] } \| { any: [predicate] } \| { not: predicate }" | E-0019, D-03 |
| §12.1 | Matcher grammar: literal, comparison, set membership, inclusive range, RE2, null test. | l.622 "matcher   := literal"; l.623 "\| { eq\|ne\|lt\|lte\|gt\|gte: value }"; l.624 "\| { in\|not_in: [value] }"; l.625 "\| { between: [min, max] }        # inclusivo en ambos extremos"; l.626 "\| { matches: re2-pattern }"; l.627 "\| { is_null: bool }" | E-0019, E-0021 |
| §12.1 | Operand kinds: scalar or quantity with a decimal string and a unit id. | l.628 "value     := scalar \| quantity"; l.629 "quantity  := { value: "decimal-string", unit: unit-id }" | E-0017, E-0018, E-0019 |
| §12.1 | Hit policies. | l.632 "`hit_policy: first \| unique \| collect`." | E-0020 |
| §12.1 | `unique` verifies absence of overlap. | l.633 "`unique` **SHALL** verificar ausencia de solapamiento → `KF-E-312`." | E-0020, D-06 |
| §12.1 | `exhaustive: true` needs `default` or an enumerable enum-only proof; otherwise `KF-E-311`; no solver. | l.634 "**`exhaustive: true` SHALL exigir una fila `when: default`**, salvo que todos los inputs sean enums de dominio finito y el producto cartesiano de sus dominios sea ≤ `logic.exhaustiveness_proof_limit` (default `256`), en cuyo caso el engine enumera y prueba cobertura total. Fuera de eso → `KF-E-311`. Nada de SAT solver disfrazado de Knowledge Framework." | E-0020, E-0008(d), D-06 |
| §10.3 | The BR-0037 example (`exhaustive: true`, a `quantity` input, no `when: default`) is illustrative only; the check on it must yield `KF-E-311`. | l.445 "exhaustive: true"; l.447 "- {ref: DE-0017.concentration, type: quantity, unit: percent_mass}"; l.449-455 rules `r1`, `r2` without a default row | E-0008(d) |
| §26.1 | Context: `kf check-rules` (P014) evaluates the facet `logic` against `given`; P011 supplies the evaluator, not the command. | l.1342 "Para cada `SC`, evaluar el `logic` de la faceta indicada por `asserts` contra `given` y comparar con `then.expected`. Discrepancia → **`KF-E-320`**." | D-02 |
| §36 / §42.2 | Diagnostics carry the catalog `remediation` when the catalog defines one. Catalog is §42.2 (E-0008(a)). | l.1600 "Todo diagnostic **SHALL** incluir `remediation` cuando el catálogo defina una. Los diagnostics **SHALL** generarse desde el catálogo de §44.2, no escribirse a mano." | E-0008(a) |
| §42.2 | Catalog rows in scope. | l.1740 "\| `KF-E-010` \| E \| Violación de JSON Schema \| — \|" (D-01); l.1765 "\| `KF-E-310` \| E \| Unidades incompatibles \| — \|"; l.1766 "\| `KF-E-311` \| E \| `exhaustive: true` sin default ni dominio probable \| añadir `when: default` \|"; l.1767 "\| `KF-E-312` \| E \| Solapamiento con `hit_policy: unique` \| — \|"; l.1769 "\| `KF-E-314` \| E \| Valor fuera del dominio del enum \| — \|"; l.1770 "\| `KF-E-315` \| E \| Regex no compilable en RE2 \| — \|" | E-0014 (precedent) |
| §42.2 | `KF-E-313` is formula territory (P012); `KF-E-316` is out of scope. | l.1768 "\| `KF-E-313` \| E \| División por cero no protegida \| añadir `guard` \|"; l.1771 "\| `KF-E-316` \| E \| Dimensión resultante inexistente en `units.yaml` \| — \|" | E-0021 |
| §42 | Enum violations of schema are `KF-E-010` (D-01). | l.1732 "Cada tipo **SHALL** tener JSON Schema en `framework/schemas/`, con schemas separados por clase de faceta. Valor fuera de enum → `KF-E-010`." | D-01 |
| §50 | Configuration names for the explicit parameters; P011 reads no configuration. | l.1953 "logic:"; l.1954 "  exhaustiveness_proof_limit: 256"; l.1955 "  decimal_precision: 28"; l.1956 "  regex_dialect: re2" | E-0017, E-0020 |
| §53 | Build order: item 9. | l.2037 "9. `logic`: decision-table, formula, state-machine; decimal, unidades sin conversión, RE2." | — |
| §55 | The fixture is the operative definition of "done"; the existing `acme-formulation` BR-0001 is the §55 decision-table rule used here. | l.2077 "8 `BR` (uno de cada `rule_kind`"; l.2103 "**El fixture es la definición operativa de "terminado".** Cada feature **SHALL** implementarse junto con su porción del fixture, nunca después" | — |

Errata-only contracts (no spec sentence, binding through the entry): E-0017 `{unscaled: BigInt, scale}`, lexical pattern `^-?[0-9]+(\.[0-9]+)?$`, `INVALID_DECIMAL`, explicit precision parameter; E-0018 explicit registry, `UNKNOWN_UNIT`, unit identity by `id`; E-0019 key binding, literal means `eq`, operator typing, `KF-E-310` both statically and at evaluation, binary null logic, enum domain checks everywhere; E-0020 `default` position-independence, result shapes, overlap and exhaustiveness proofs, `proofLimit` default 256; E-0021 RE2 whitelist, `then` opaque, input types, uncatalogued failures are internal typed codes.

## Deliverables and boundary

1. Engine modules (new files only), all ES modules with no side effects on import:
   - `framework/engine/logic-errors.mjs`
   - `framework/engine/decimal.mjs`
   - `framework/engine/units.mjs`
   - `framework/engine/regex-re2.mjs`
   - `framework/engine/logic-diagnostics.mjs`
   - `framework/engine/decision-table.mjs`
   (Private helper modules under `framework/engine/` with a `logic-` prefix are allowed.)
2. Implementer tests and adversarial tests: `test/p011-*.test.mjs`.
3. Conformance slice (conformance engineer, written first): `framework/conformance/p011-decision-table.yaml` (case index and data), `framework/conformance/p011-decision-table/` (case data files: unit registries, tables, supplied values, expected results/diagnostics; helper code if any), `test/conformance-p011-decision-table.test.mjs`.
4. `HANDOFF.md` and the filled `TRACEABILITY.md` (implementer).

Writable paths. Implementer: `framework/engine/**` (new modules only; **do not modify `framework/engine/id-registry.mjs`**) and `test/**` except `test/conformance*`. Conformance engineer: `framework/conformance/p011-decision-table*` and `test/conformance-p011-*.test.mjs`. Nobody in this phase touches `bin/`, `package.json`, `package-lock.json`, `scripts/`, `eslint.config.js`, `.gitattributes`, `.gitignore`, `framework/schemas/**`, `framework/conformance/acme-formulation/**`, `framework/conformance/spec-examples/**`, `framework/conformance/p002-*`, the spec, the errata, `.strike-team/**` (except the implementer's own `HANDOFF.md` and `TRACEABILITY.md` in the phase directory). **No new npm dependency.** The decision-table, decimal, units, regex and diagnostics modules import nothing outside `framework/engine/` (no `yaml`, no `ajv`, no `node:fs`).

### Public engine API contract

All functions are synchronous and pure: no filesystem, clock, randomness, environment or global state; arguments are never mutated; returned objects are fresh. "Typed error" = `LogicError` (below) **thrown**. "Diagnostic" = a `KF-` entry **returned** in a list. Deterministic routing rule (P-02): **a `KF-` code is never thrown, and a typed error is never returned inside `diagnostics`.** A call either throws (nothing is returned) or returns.

```
// framework/engine/logic-errors.mjs
export class LogicError extends Error { code: string; details: object }      // name 'LogicError'
export const LOGIC_ERROR_CODES: readonly string[]                            // ascending byte order

// framework/engine/decimal.mjs
export type Decimal = Readonly<{ unscaled: bigint, scale: number }>          // scale: integer >= 0; E-0017
export function isDecimalString(value: unknown): boolean                     // true iff typeof string and /^-?[0-9]+(\.[0-9]+)?$/
export function parseDecimal(value: unknown): Decimal                        // INVALID_DECIMAL for non-string or off-pattern
export function isDecimal(value: unknown): boolean                           // a value produced by this module
export function compareDecimal(a: Decimal, b: Decimal): -1 | 0 | 1           // by numeric value
export function equalsDecimal(a: Decimal, b: Decimal): boolean
export function addDecimal(a, b): Decimal                                    // exact
export function subtractDecimal(a, b): Decimal                               // exact
export function multiplyDecimal(a, b): Decimal                               // exact
export function divideDecimal(a, b, options: { precision: number }): Decimal // DIVISION_BY_ZERO; INVALID_PRECISION; exact if representable in `precision` significant digits; otherwise rule pending (D-04)
export function formatDecimal(a: Decimal): string                            // canonical minimal form (P-07), never "-0"
//   Non-Decimal arguments to compare/equals/add/subtract/multiply/divide/format: INVALID_ARGUMENT.

// framework/engine/units.mjs
export type UnitRegistry = Readonly<{ units: readonly Readonly<{ id: string, dimension: string, symbol: string }>[],   // input order
                                      has(id: string): boolean }>             // exact, case-sensitive id match
export function buildUnitRegistry(data: unknown): UnitRegistry               // INVALID_UNITS; parsed units.yaml content (E-0018)
export function isUnitRegistry(value: unknown): boolean                      // true only for values built by buildUnitRegistry

// framework/engine/regex-re2.mjs
export const RE2_MAX_REPEAT: 1000
export type Re2Result = { ok: true, program: Re2Program } | { ok: false, reason: string }
export function compileRe2(pattern: string): Re2Result                       // never throws for a string; non-string: INVALID_ARGUMENT
export function searchRe2(program: Re2Program, text: string): boolean        // unanchored, case-sensitive, over code points, time linear in text length

// framework/engine/logic-diagnostics.mjs
export const LOGIC_DIAGNOSTIC_CATALOG: Readonly<Record<'KF-E-310' | 'KF-E-311' | 'KF-E-312' | 'KF-E-314' | 'KF-E-315',
                                               { code: string, severity: 'E', remediation?: string }>>   // copied from l.1765-1770 (P-09)
export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[]     // new array, sort key below

// framework/engine/decision-table.mjs
export const DEFAULT_PROOF_LIMIT: 256
export function checkDecisionTable(logic: object, options: { unitRegistry: UnitRegistry, proofLimit?: number }): Diagnostic[]
export function evaluateDecisionTable(logic: object, values: object, options: { unitRegistry: UnitRegistry }): EvaluationResult
```

**Types**

```
Diagnostic = { code: 'KF-E-310'|'KF-E-311'|'KF-E-312'|'KF-E-314'|'KF-E-315', severity: 'E', message: string,
               remediation?: string,          // present only on KF-E-311: "añadir `when: default`" (l.1766, l.1600)
               pointer: string,               // RFC 6901 JSON Pointer into the `logic` object ('' never used)
               rule: string | null, rule_index: number | null,
               ...code-specific fields }
EvaluationResult = {
  status: 'ok' | 'error',
  hit_policy: 'first' | 'unique' | 'collect',
  result: null | { rule: string, rule_index: number, then: object }            // first, unique: matched row or null
        | Array<{ rule: string, rule_index: number, then: object }>,           // collect: rows in document order, [] if none
  via_default: boolean,        // true iff `result` is the default row (or [default row] for collect)
  diagnostics: Diagnostic[]    // [] when status is 'ok'; status 'error' => result null, via_default false
}
```

Code-specific diagnostic fields (message text is free and never asserted; the fields below are):

| Code | Fields asserted |
|---|---|
| `KF-E-310` | `pointer`, `input` (bound input `ref`), `expected_unit` (the input's declared unit id, or `null` for a non-quantity input), `found_unit` (id of the other operand, or `null` for a bare operand), `source` (`'literal'` for the table check, `'value'` at evaluation). Table check: `pointer` = the offending literal node (the quantity mapping, or the bare literal) and `rule`/`rule_index` set. Evaluation: `pointer` = `/inputs/<i>`, `rule` and `rule_index` null. |
| `KF-E-311` | `pointer: '/exhaustive'`, `rule: null`, `reason` ∈ `non_enum_input` \| `missing_domain` \| `over_limit` \| `uncovered_tuple`, `limit`; `input` for the first two reasons (first offending input in `inputs[]` order); `product` for `over_limit`; `witness` (mapping input `ref` to value, in `inputs[]` order) for `uncovered_tuple`; `remediation`. At most one per table. Reason precedence: first offending input in `inputs[]` order (non-enum type, then enum without domain), then product over the limit, then enumeration. |
| `KF-E-312` | `pointer: '/rules/<i>'` of the first named row, `rule`/`rule_index` of that row, `rules` (ids) and `rule_indexes` of the rows named, `proof` ∈ `enumeration` \| `not_proven_disjoint` \| `evaluation`. `enumeration`: one diagnostic for the first tuple, `rules` = first two rows (document order) matching it, `witness`. `not_proven_disjoint`: one diagnostic per unordered pair `i < j` of non-default rows not proven disjoint. `evaluation`: `rules` = all matching non-default rows in document order, `pointer: '/rules/<first>'`. |
| `KF-E-314` | `pointer`, `input`, `value` (the offending value), `source` (`'literal'` \| `'value'`). Table check: `rule`/`rule_index` set. Evaluation: `pointer = /inputs/<i>`, `rule` null. |
| `KF-E-315` | `pointer` (the pattern string node), `rule`, `rule_index`, `pattern`, `reason`. |

**Diagnostic sort key** (applied to every returned list, including evaluation diagnostics): `(code, rule_index ?? -1, pointer, rule_indexes element-wise (absent = empty), message)`, strings in UTF-8 byte order, numbers numerically. Evaluation diagnostics for supplied values arise in `inputs[]` order and are then sorted by this key.

**Function contracts**

- `parseDecimal`, `isDecimalString`: lexical form exactly `^-?[0-9]+(\.[0-9]+)?$` over ASCII digits (a trailing `\n`, surrounding spaces, `+`, exponents, `.5`, `5.`, commas and non-ASCII digits are rejected). `"-0"`, `"007"`, `"0.10"` are accepted. No length limit. `"4.20"` and `"4.2"` are equal by value (E-0017). A JS number, boolean, `null`, `undefined`, bigint, object or array is `INVALID_DECIMAL`.
- `divideDecimal(a, b, { precision })`: `precision` must be an integer `>= 1`, else `INVALID_PRECISION` (there is no default and no global; the config value 28 is passed by callers). Divisor equal to zero (including `-0`) is `DIVISION_BY_ZERO`, also when the dividend is zero. A quotient exactly representable in `precision` significant digits is returned exactly. The rule for any other quotient is pending (D-04). No rounding mode is taken (rounding is P012).
- `buildUnitRegistry(data)`: `data` is the parsed content of the l.596-599 shape: a mapping with `units` (list of mappings, each with string `id`, `dimension`, `symbol`; `id` unique) and `conversions` (must be an empty list). Anything else is `INVALID_UNITS` (details name the offending entry). The registry contains no built-in unit; `has` compares `id` exactly (never `dimension` or `symbol`).
- `compileRe2(pattern)`: accepts exactly the E-0021 syntax: literals and escaped metacharacters, `.`, character classes with ranges and negation, `\d \w \s \D \W \S`, anchors `^ $`, groups `( )` and `(?: )`, alternation `|`, quantifiers `* + ? {n} {n,} {n,m}` with n, m <= `RE2_MAX_REPEAT`, and their lazy forms. Anything else (backreferences, lookaround, named groups, inline flags, Unicode property escapes, possessive/atomic forms, larger counts) and any syntax error returns `{ok: false}`. Fine print (newline, `$`, class alphabet, unlisted escapes, program-size cap): pending (D-05). `searchRe2` finds a match anywhere in `text` (RE2 partial match), compares code points (a non-BMP character is one code point), and uses no backtracking: time is linear in `text.length` for a fixed program. The engine never constructs a host `RegExp` from a user pattern.
- `checkDecisionTable(logic, options)`: 1. validates `options` (`unitRegistry` must satisfy `isUnitRegistry` else `INVALID_ARGUMENT`; `proofLimit`, if present, must be an integer `>= 0` else `INVALID_ARGUMENT`; default `DEFAULT_PROOF_LIMIT`). 2. Validation pass (typed errors, below): `logic.kind` must be `decision-table`; inputs in order; rules in document order, each `when` traversed depth-first; `then` units. The first defect found throws; precedence among several defects is not asserted (TRIAGE N-04). 3. Collects diagnostics: `KF-E-310` and `KF-E-314` for literals, `KF-E-315` for patterns, `KF-E-311` if `exhaustive: true`, `KF-E-312` if `hit_policy: unique`. 4. Returns the sorted list (`[]` when clean). It never evaluates a value.
- `evaluateDecisionTable(logic, values, options)`: runs the same option validation and validation pass; then the table check's `KF-E-310`/`KF-E-314`/`KF-E-315` findings; if any exist, returns `status: 'error'` with exactly those diagnostics and `result: null` (P-03). Otherwise validates all supplied values against the declarations in `inputs[]` order (P-04): `quantity` input needs a quantity with the identical unit id (a different unit, a bare scalar or a decimal string: `KF-E-310`; a non-string `value` or an off-pattern `value`: `INVALID_DECIMAL`); `decimal` input needs a decimal string (a quantity: `KF-E-310`; a number or off-pattern string: `INVALID_DECIMAL`); `enum` input needs a member of `domain` (otherwise `KF-E-314`; checked even when no row reads the input); `string` and `boolean` inputs need that JS type (otherwise `TYPE_MISMATCH`). `null` or absent is always accepted. Diagnostics from this step also yield `status: 'error'`, nothing is evaluated. Then rows are evaluated per hit policy:
  - `first`: first matching non-default row in document order, else the default row, else `null`.
  - `collect`: all matching non-default rows in document order, else `[default]`, else `[]`.
  - `unique`: the single matching non-default row, else the default row, else `null`; two or more matching non-default rows: `status: 'error'`, one `KF-E-312` (`proof: 'evaluation'`).
  - `then` is returned as a deep copy, verbatim (decimal strings, quantities, numbers, nesting unchanged).
  - No match is `status: 'ok'` with `result: null` (or `[]` for `collect`).
- Keys of `values` bind to inputs by exact `ref` until D-02 is decided; extra keys are ignored under every D-02 option except option 3 (pending).
- Predicate evaluation is binary logic (E-0019): every matcher except `is_null` is `false` on a `null` operand, including `ne` and `not_in`; `eq: null` is `false`; `not` negates the boolean; `all`/`any` are boolean AND/OR. Several keys in one mapping are a conjunction. `between` is inclusive at both ends. `eq`, `ne`, `in`, `not_in` compare strings, booleans and enum values by code-point equality and decimals/quantities by value; quantities compare only with the identical unit id.

**Typed errors (all thrown as `LogicError`; the check and the evaluation raise the same code for the same defect)**

| Code | Raised when | Origin |
|---|---|---|
| `INVALID_DECIMAL` | a decimal operand (literal, supplied value, quantity `value`, `parseDecimal` argument) is not a string matching the lexical form | E-0017 |
| `UNKNOWN_UNIT` | a unit id used in an input declaration, a `when` literal or a top-level `then` quantity (D-07 for deeper levels) is not declared by the registry | E-0018 |
| `UNBOUND_FIELD` | a `when` key matches no input | E-0019 |
| `AMBIGUOUS_FIELD` | a `when` key suffix is shared by two inputs and equals neither `ref` | E-0019 |
| `EMPTY_PREDICATE` | `{}` nested inside `all`/`any`/`not` (top-level `when: {}`: D-08; empty `all`/`any` arrays: D-03) | E-0019 |
| `TYPE_MISMATCH` | `lt/lte/gt/gte/between` on a non-decimal, non-quantity input; a supplied value of the wrong JS type for a `string` or `boolean` input (so `matches` is never applied to a non-string value); `matches` on a non-string-typed input is left to the implementer (TRIAGE N-14) | E-0019, E-0021 |
| `INVALID_RANGE` | `between` with `min > max` | E-0019 |
| `DUPLICATE_DEFAULT` | more than one row has `when: default` | E-0020 |
| `DUPLICATE_RULE_ID` | two rows share an `id` | E-0021 |
| `UNSUPPORTED_INPUT_TYPE` | an input `type` outside `enum, quantity, decimal, string, boolean` | E-0021 |
| `INVALID_INPUT_DECLARATION` | `quantity` input without `unit`; `unit` on a non-quantity input | E-0021 |
| `INVALID_UNITS` | `buildUnitRegistry` shape violations (duplicate `id`, non-empty `conversions`, wrong types, `units` not a list) | E-0018 |
| `DIVISION_BY_ZERO`, `INVALID_PRECISION` | `divideDecimal` | E-0021, T-12 |
| `INVALID_TABLE` | `logic.kind` is not `decision-table`; `rules` or `inputs` not arrays; a malformed matcher (D-01) | D-01 |
| `INVALID_ARGUMENT` | missing/unbuilt `unitRegistry`, bad `proofLimit`, non-object `values`, non-Decimal arguments | P-01 |

CLI exit-code classes for these codes are not set here (P007/P014 map them). `KF-E-313`, `KF-E-316` are not produced.

## Design constraints

- No binary floating point anywhere in rule evaluation (l.582): decimals are `bigint` pairs; no `Number`, `parseFloat`, `Math.*`, `toFixed`, `toPrecision` on a decimal. Counts and indexes may be plain integers.
- Determinism: no clock, randomness, locale, environment or iteration-order dependence. Results and diagnostics are byte-identical on every run and platform; all sorts are explicit (byte order).
- No implicit unit conversion (l.589, l.602): units compare by `id` only; a conversion function does not exist in this phase.
- Pure functions: no I/O, no global mutable state (no module-level caches whose content changes results), arguments never mutated, outputs fresh.
- Linear-time matching (l.612): the user regex is parsed by the engine's own parser and run by an NFA/DFA simulation; no host `RegExp` is built from, or applied with, a user pattern; no recursion depth proportional to input length.
- Fail closed: proofs of exhaustiveness and disjointness are reported as failed unless shown (E-0020); unknown syntax is `KF-E-315`; unknown units are `UNKNOWN_UNIT`.
- Only the five catalog codes of `LOGIC_DIAGNOSTIC_CATALOG` are produced; no `KF-` code is invented (E-0021). `KF-E-010` is held by D-01.
- No rounding (l.584) and no cross-entity check (`outcome` against `produces`: P007).
- `proofLimit` and `precision` are explicit parameters; configuration (`logic.exhaustiveness_proof_limit`, `logic.decimal_precision`, l.1954-1955) is read by P007/P012 callers.
- No new dependency; no change to `package.json`, schemas, `bin/` or `eslint.config.js`.

## Fixture slice

**§55 entities added: none.** §55 (l.2075-2103) lists no `expected/` command line that P011 can satisfy alone: `kf check-rules` (l.2086) is P014 and `framework/conformance/expected/` does not exist until P028. P011 changes neither `acme-formulation` nor the spec examples. The §55 "uno de cada `rule_kind`" decision-table BR already exists: **`BR-0001`** (`knowledge/business-rules/BR-0001/rule.yaml`, two `specified` facets of `kind: decision-table`) is read by the conformance test as data (F-A1, F-A2); the observed facet `BR-0001/observed/legacy-app.yaml` is F-A3 (pending D-08). The slice lives as data plus a test and is ported by the phase that builds the `expected/` runner.

Layout, written by the conformance engineer before any implementer code is read: `framework/conformance/p011-decision-table.yaml` (case index, `cites`, `targets`, status `pending-implementation`; each key of the index has at least one test whose title starts with it), `framework/conformance/p011-decision-table/` (YAML case data; unit registries `units-u1.yaml`, `units-u2.yaml`; tables; supplied values; expected outputs), `test/conformance-p011-decision-table.test.mjs` (loads the data and calls the public API only). Cases marked "pending (D-nn)" are present in the data with `status: pending-decision` and are skipped with a named `test.todo`; nothing is guessed.

### Notation

- Registry **U1** = `units: [{id: percent_mass, dimension: mass_fraction, symbol: "% m/m"}, {id: ppm_mass, dimension: mass_fraction, symbol: "ppm"}, {id: percent_volume, dimension: volume_fraction, symbol: "% v/v"}, {id: kg, dimension: mass, symbol: "kg"}]`, `conversions: []`. Bare `percent` is **not** declared. **U2** = U1 plus `{id: percent, dimension: mass_fraction, symbol: "%"}`. **U0** = `units: []`, `conversions: []`.
- Unit shorthands: `pm` = `percent_mass`, `ppm` = `ppm_mass`, `pv` = `percent_volume`. `Q(4.2,pm)` = `{value: "4.2", unit: percent_mass}`.
- Inputs: `q` = `{ref: DE-0001.concentration, type: quantity, unit: percent_mass}`; `d` = `{ref: DE-0001.count, type: decimal}`; `e` = `{ref: DE-0001.material, type: enum, domain: [X, Y, Z]}`; `s` = `{ref: DE-0001.note, type: string}`; `b` = `{ref: DE-0001.flag, type: boolean}`; `A` = `{ref: DE-0001.a, type: enum, domain: [X, Y]}`; `B` = `{ref: DE-0001.b, type: enum, domain: [P, Q]}` (domains restated where they differ). In `when`, fields are written by suffix (`concentration`, `count`, `material`, `note`, `flag`; binding by suffix is decided, E-0019). **Supplied values are always keyed by the full `ref`** (until D-02): "supplied `count="4.20"`" means the values mapping `{"DE-0001.count": "4.20"}`; "absent" = key missing; `null` = key present with `null`.
- Skeleton **S1(inputs; W)**: `{kind: decision-table, hit_policy: first, exhaustive: false, inputs: <inputs>, rules: [{id: r1, when: W, then: {hit: r1}}, {id: r2, when: default, then: {hit: r2}}]}`.
- Outcomes: `-> r1` = `status: ok`, `result.rule == r1`, `via_default: false`; `-> r2` = `status: ok`, default row, `via_default: true`; `-> ∅` = `status: ok`, `result: null`; `-> ERR 310` = `status: error`, `result: null`, `diagnostics` codes exactly `[KF-E-310]`; `-> THROWS CODE` = throws `LogicError` with that `code`; `CHECK -> []` = `checkDecisionTable` returns the empty list.
- Every case is run through the public API only, with U1 unless stated, twice, and the two results must be deep-equal.

### Decimal (F-N)

- **F-N1 Value equality and order.** `compareDecimal(parse(a), parse(b))`: (`"4.20"`,`"4.2"`) 0; (`"-0"`,`"0"`) 0; (`"-0.00"`,`"0"`) 0; (`"007"`,`"7"`) 0; (`"1"`,`"1.0000"`) 0; (`"-4.2"`,`"4.2"`) -1; (`"10"`,`"9"`) 1 (numeric, not lexical); (`"-10"`,`"-9"`) -1; (`"0.3"`,`"0.30000000000000004"`) -1; (`"9007199254740993"`,`"9007199254740992"`) 1 (equal as binary doubles); (`"1"` followed by 400 `"0"`, 400 `"9"`) 1; (`"0."` + 500 `"0"` + `"1"`, `"0"`) 1; (`"-0.0000000000000000000000000001"`,`"0"`) -1. `equalsDecimal` agrees on each pair. [V-01, V-02]
- **F-N2 Exact arithmetic.** `formatDecimal` of: add(`"0.1"`,`"0.2"`) = `"0.3"`; add(`"9007199254740992"`,`"1"`) = `"9007199254740993"`; subtract(`"0.3"`,`"0.1"`) = `"0.2"`; subtract(`"1"`,`"1.000"`) = `"0"`; multiply(`"1.5"`,`"-2.5"`) = `"-3.75"`; multiply(`"123456789012345678901234567890"`,`"987654321098765432109876543210"`) = `"121932631137021795226185032733622923332237463801111263526900"`; multiply(`"0.000001"`,`"0.000001"`) = `"0.000000000001"`; add(`"-0"`,`"-0"`) = `"0"`; multiply(`"-0"`,`"5"`) = `"0"`. [V-02, V-03]
- **F-N3 Canonical form.** `formatDecimal(parseDecimal(t))`: `"4.20"`->`"4.2"`; `"-0"`->`"0"`; `"007.500"`->`"7.5"`; `"0.0"`->`"0"`; `"-0.50"`->`"-0.5"`; `"100"`->`"100"`; `"0.001"`->`"0.001"`; `"1000.000"`->`"1000"`. [V-03]
- **F-N4 Rejected forms (`INVALID_DECIMAL`).** Strings: `"4,2"`, `".5"`, `"5."`, `"1e3"`, `"1E3"`, `"+1"`, `""`, `" 4.2"`, `"4.2 "`, `"4.2\n"`, `"--1"`, `"-"`, `"0x10"`, `"NaN"`, `"Infinity"`, `"1_000"`, `"٣"` (Arabic-Indic digit), `"4.2.1"`. Non-strings: `4.2`, `42`, `true`, `null`, `undefined`, `{}`, `[]`, `10n`. `isDecimalString` is `false` for each and `true` for `"4.2"`, `"-0"`, `"007"`, `"0.10"`. [V-04]
- **F-N5 Division.** With `{precision: 28}`: `"1"/"4"` = `"0.25"`; `"6"/"3"` = `"2"`; `"10"/"4"` = `"2.5"`; `"-7"/"2"` = `"-3.5"`; `"0.3"/"0.1"` = `"3"`; `"-6"/"-3"` = `"2"`; `"0"/"5"` = `"0"`; with `{precision: 3}`: `"1"/"8"` = `"0.125"`. Throws `DIVISION_BY_ZERO`: `"1"/"0"`, `"0"/"0"`, `"5"/"-0"`. Throws `INVALID_PRECISION` for `precision` of `0`, `-1`, `1.5`, `"28"`, `NaN`, `undefined`, and for a missing options object. **Pending (D-04):** `"1"/"3"` with `{precision: 28}`. [V-05]

### Units (F-U)

- **F-U1 Registry.** `buildUnitRegistry(U1)`: `has('percent_mass')`, `has('ppm_mass')` true; `has('percent')` false; `has('ppm')` false; `has('PERCENT_MASS')` false; `has('')` false; `units` equals the input list in order. `buildUnitRegistry(U0)` valid and `has` false for every id. `buildUnitRegistry(U2).has('percent')` true. [V-07]
- **F-U2 Invalid registries (`INVALID_UNITS`).** Duplicate `id`; `conversions: [{from: percent_mass, to: ppm_mass}]`; `units` a mapping; `units` missing; an entry missing `id`; an entry with `dimension: 1`; an entry with `symbol: null`; top-level `null`; top-level list. [V-08]
- **F-U3 Registry as an explicit argument.** For any table: `unitRegistry` missing, `null`, raw parsed data (not built), or a hand-made `{has: () => true, units: []}` -> `THROWS INVALID_ARGUMENT` from both `checkDecisionTable` and `evaluateDecisionTable`. An input `{ref: DE-0001.a, type: quantity, unit: furlong}` -> `THROWS UNKNOWN_UNIT`; the same table with a registry declaring `furlong` is accepted. [V-09]

### RE2 subset (F-R)

- **F-R1 Accepted syntax and matching** (`compileRe2(p).ok` true; `searchRe2` result). Pattern / text -> match: `abc` / `xxabcxx` true, `ab` false; `^abc$` / `abc` true, `abcd` false, `xabc` false; `a` / `A` false (case-sensitive); `\d{3}-\d{2}` / `ab123-45x` true, `12-345` false; `\D` / `123` false, `a1` true; `\w+` / `---` false, `_` true; `\W` / `abc_9` false; `\s` / `a b` true, `ab` false; `\S` / `   ` false; `[A-Z]{3}[0-9]{2,4}` / `XYZ123` true, `XY123` false, `XYZ1` false; `[^0-9]` / `123` false, `12a` true; `[a-c]` / `d` false; `a|b` / `xbx` true, `xcx` false; `^(a|b)*c?$` / `abab` true, `abc` true, `abcc` false; `(?:ab)+$` / `xabab` true, `ababx` false; `a{2,3}` / `a` false, `aa` true; `^a{2}$` / `aaa` false; `^a{2,}$` / `aaaa` true, `a` false; `x*` / `` (empty text) true; `a+?` / `baab` true; `^a+?$` / `aaa` true (lazy forms do not change match/no-match); `\.` / `a.b` true, `ab` false; `\(\)` / `f()` true; `\\` / `a\b` true; `^$` / `` true, `a` false; `a.c` / `abc` true, `ac` false; `é` / `café` true; `^caf.$` / `café` true (precomposed U+00E9 in pattern and text); `^.$` / `😀` true and `^..$` / `😀` false (a code point is one unit); `a{1000}` / 1000 `a` true, 999 `a` false; `a{1000,}`, `a{0,1000}` compile. **Pending (D-05):** `a.c` / `a\nc`; `^abc$` / `abc\n`; `^\w$` / `é`; escapes `\n \t`; the empty pattern. [V-10]
- **F-R2 Rejected syntax (`compileRe2(p).ok` false, and as a `matches` pattern the table check returns `KF-E-315` with `pointer` at the pattern and `pattern`).** Named by E-0021: `(a)\1` (backreference), `(?=a)`, `(?!a)`, `(?<=a)`, `(?<!a)` (lookaround), `(?P<n>a)`, `(?<n>a)` (named groups), `(?i)a`, `(?s:a)` (inline flags), `\p{L}` (Unicode property), `(?>a)` (atomic), `a++`, `a*+` (possessive), `a{1001}`, `a{1,1001}`, `a{0,1001}`. Plain syntax errors: `(`, `)`, `(a`, `[a`, `[z-a]`, `a{3,2}`, `*a`, `+`, `a|*`, trailing `\`. Near-miss pairs that **are** accepted: `(a)1`, `(?:a)`, `a{1000}`, `[a-z]+?`, `\\1`. [V-11, V-34]
- **F-R3 Pathological patterns are linear.** Each must return within 5 s (expected well under 1 s), called both through `searchRe2` and through `evaluateDecisionTable` with a `string` input and `{note: {matches: p}}`: `(a+)+$` on 50,000 `a` followed by `b` -> false, and on 50,000 `a` -> true; `(a|aa)+$` on 50,000 `a` + `b` -> false; `(a*)*b` on 50,000 `a` -> false; `(x+x+)+y` on 50,000 `x` -> false; `^(([a-z])+.)+[A-Z]([a-z])+$` on 30,000 `a` + `!` -> false. Nested counted repeats `(a{1000}){1000}` and `((a{1000}){1000}){1000}`: compile and one search on 1,000 `a` must terminate within 5 s with either `ok: true` or `ok: false` (cap pending D-05); a wall-clock bound is the only assertion. [V-12]

### Operators (F-O) - S1 with input and `when` shown; supplied value -> outcome

- **O1 literal on enum** `e`, `{material: X}`: `X` -> r1; `Y` -> r2; `Z` -> r2.
- **O2 literal on quantity** `q`, `{concentration: Q(4.2,pm)}`: `Q(4.20,pm)` -> r1; `Q(4.3,pm)` -> r2.
- **O3 literal on boolean** `b`, `{flag: true}`: `true` -> r1; `false` -> r2.
- **O4 literal on decimal** `d`, `{count: "4.2"}`: `"4.20"` -> r1; `"4.3"` -> r2.
- **O5 `eq`** `d`, `{count: {eq: "0"}}`: `"-0"` -> r1; `"0.00"` -> r1; `"1"` -> r2.
- **O6 `ne`** `e`, `{material: {ne: X}}`: `Y` -> r1; `Z` -> r1; `X` -> r2.
- **O7 `lt`** `d`, `{count: {lt: "5"}}`: `"4.999"` -> r1; `"5"` -> r2; `"5.0"` -> r2; `"-100"` -> r1.
- **O8 `lte`** `d`, `{count: {lte: "5"}}`: `"5.00"` -> r1; `"5.001"` -> r2.
- **O9 `gt`** `d`, `{count: {gt: "9"}}`: `"10"` -> r1 (numeric, not lexical); `"9"` -> r2; `"9.001"` -> r1; `"-6"` -> r2.
- **O10 `gte`** `d`, `{count: {gte: "5"}}`: `"5"` -> r1; `"4.999"` -> r2.
- **O11 comparisons on quantity** `q`, `{concentration: {lte: Q(4.2,pm)}}`: `Q(4.2,pm)` -> r1; `Q(4.21,pm)` -> r2; `Q(-1,pm)` -> r1. The same with `lt`, `gt`, `gte` at the boundary value (`lt`: 4.2 -> r2; `gt`: 4.2 -> r2; `gte`: 4.2 -> r1).
- **O12 `in`** `e`, `{material: {in: [X, Y]}}`: `X` -> r1; `Y` -> r1; `Z` -> r2.
- **O13 `in` on decimal** `d`, `{count: {in: ["1", "2.0"]}}`: `"2"` -> r1; `"1.00"` -> r1; `"3"` -> r2.
- **O14 `not_in`** `e`, `{material: {not_in: [X]}}`: `Y` -> r1; `Z` -> r1; `X` -> r2.
- **O15 `in` on quantity** `q`, `{concentration: {in: [Q(1,pm), Q(2,pm)]}}`: `Q(2.0,pm)` -> r1; `Q(3,pm)` -> r2.
- **O16 `between` (inclusive)** `d`, `{count: {between: ["1", "5"]}}`: `"1"` -> r1; `"5"` -> r1; `"3"` -> r1; `"0.999"` -> r2; `"5.001"` -> r2. Degenerate `["2","2"]`: `"2"` -> r1, `"2.1"` -> r2.
- **O17 `between` on quantity** `q`, `{concentration: {between: [Q(1,pm), Q(5,pm)]}}`: `Q(5,pm)` -> r1; `Q(5.1,pm)` -> r2.
- **O18 `between` with `min > max`**, `{count: {between: ["5", "1"]}}` -> `THROWS INVALID_RANGE` (check and evaluate).
- **O19 `matches` anchored** `s`, `{note: {matches: "^AB[0-9]+$"}}`: `AB12` -> r1; `xAB12` -> r2; `AB` -> r2; `ab12` -> r2.
- **O20 `matches` unanchored** `s`, `{note: {matches: "B1"}}`: `AB12` -> r1; `AC12` -> r2.
- **O21 `is_null`** `s`: `{note: {is_null: true}}`: absent -> r1; `null` -> r1; `"x"` -> r2. `{note: {is_null: false}}`: `"x"` -> r1; `null` -> r2; absent -> r2.
- **O22 `all`** inputs `e, d`, `{all: [{material: X}, {count: {gt: "0"}}]}`: (`X`,`"1"`) -> r1; (`X`,`"0"`) -> r2; (`Y`,`"1"`) -> r2.
- **O23 `any`** same inputs, `{any: [{material: X}, {count: {gt: "0"}}]}`: (`Y`,`"1"`) -> r1; (`X`,`"-1"`) -> r1; (`Y`,`"-1"`) -> r2.
- **O24 `not`** `e`, `{not: {material: X}}`: `Y` -> r1; `X` -> r2.
- **O25 implicit conjunction** inputs `e, d`, `{material: X, count: {gt: "0"}}`: same outcomes as O22.
- **O26 nesting** inputs `e, d`, `{all: [{any: [{material: X}, {material: Y}]}, {not: {count: {lt: "0"}}}]}`: (`Y`,`"0"`) -> r1; (`Y`,`"-1"`) -> r2; (`Z`,`"0"`) -> r2.

[V-14 for O1-O21; V-15 for O22-O26]

### Binding (F-B)

- **B1** key by full ref: `e`, `{DE-0001.material: X}`; `X` -> r1. **B2** key by suffix `{material: X}`; `X` -> r1.
- **B3** `{foo: X}` -> `THROWS UNBOUND_FIELD`; also inside `{not: {foo: X}}` and `{any: [{material: X}, {foo: X}]}`.
- **B4** inputs `[{ref: A.x, type: decimal}, {ref: B.x, type: decimal}]`: `{x: "1"}` -> `THROWS AMBIGUOUS_FIELD`; `{A.x: "1"}` with supplied `{"A.x": "1", "B.x": "2"}` -> r1.
- **B5** a mapping with two keys is a conjunction (O25).
- **B3b (pending D-02)** supplied values keyed by suffix (`{material: "X"}`), and supplied extra keys that match no input.

### Null and absent (F-L) - S1, supplied `values` empty (absent) unless stated

- **L1** every matcher is `false` on absent: tables `{count: {eq: "1"}}`, `{count: {ne: "1"}}`, `{count: {in: ["1"]}}`, `{count: {not_in: ["1"]}}`, `{count: {lt: "1"}}`, `{count: {lte: "1"}}`, `{count: {gt: "1"}}`, `{count: {gte: "1"}}`, `{count: {between: ["0","2"]}}`, `{count: "1"}`, `{note: {matches: ".*"}}`, `{material: X}`, `{material: {ne: X}}`, `{material: {not_in: [X]}}` -> r2 each.
- **L2** explicit `null` gives the same `EvaluationResult` as absent (deep-equal), for each table of L1.
- **L3** `{count: {eq: null}}`: absent -> r2; `null` -> r2; `"1"` -> r2.
- **L4** `{count: {is_null: true}}`: absent -> r1.
- **L5 `not` over a null comparison** (count absent): `{not: {count: {eq: "1"}}}` -> r1; `{not: {count: {ne: "1"}}}` -> r1; `{not: {count: {in: ["1"]}}}` -> r1; `{not: {count: {lt: "1"}}}` -> r1; `{not: {count: {is_null: true}}}` -> r2. Contrast: `{count: {ne: "1"}}` -> r2.
- **L6** `{any: [{count: {eq: "1"}}, {note: {is_null: true}}]}`, count and note absent -> r1; `{all: [{count: {is_null: true}}, {note: {eq: "x"}}]}` both absent -> r2.
- **L7 null is neither zero nor false:** `{flag: false}` with absent -> r2; `{count: "0"}` with absent -> r2; `{count: {lte: "0"}}` with absent -> r2; `{count: {lte: "0"}}` with `"0"` -> r1.

[V-18]

### Enum domains (F-D)

- **D1 runtime** (table: `e` and `d`, `{count: {gt: "0"}}`, so no row reads `material`): supplied `material="W"` -> `status: error`, diagnostics exactly one `KF-E-314` with `input: DE-0001.material`, `value: "W"`, `source: value`, `pointer: /inputs/0`; `"x"` -> error; `null` and absent -> ok; `"X"` -> ok. Two bad supplied inputs (two enums `A`, `B`) -> two `KF-E-314` diagnostics in `inputs[]` order.
- **D2 static** (`CHECK`): `{material: "W"}` -> one `KF-E-314` at `/rules/0/when/material`, `rule: r1`, `value: "W"`, `source: literal`; `{material: {eq: "W"}}` at `.../eq`; `{material: {ne: "W"}}` at `.../ne`; `{material: {in: [X, W]}}` -> one at `.../in/1`; `{material: {not_in: [W]}}` at `.../not_in/0`; `{not: {material: "W"}}` at `/rules/0/when/not/material`. Near-miss: every literal inside the domain, `{material: {eq: null}}` -> `CHECK -> []`.
- **D3** a table with a static `KF-E-314` literal evaluated with an in-domain value -> `status: error` with that diagnostic (P-03).

[V-19]

### Units inside tables (F-Q)

- **Q1 static `KF-E-310`** (U1, input `q`): `{concentration: {lte: Q(4.2,ppm)}}` -> exactly one `KF-E-310` at `/rules/0/when/concentration/lte`, `expected_unit: percent_mass`, `found_unit: ppm_mass`, `source: literal`, `input: DE-0001.concentration`. Near-miss `{concentration: {lte: Q(4.2,pm)}}` -> `[]`.
- **Q2** `{concentration: {lte: Q(4.2,pv)}}` (both declared, same family) -> one `KF-E-310` (`found_unit: percent_volume`).
- **Q3** `{concentration: {lte: "4.2"}}` (bare decimal on a quantity input) -> one `KF-E-310`, `found_unit: null`.
- **Q4** input `d`, `{count: {lte: Q(4,pm)}}` (quantity on a decimal input) -> one `KF-E-310`, `expected_unit: null`, `found_unit: percent_mass`.
- **Q5** list and range: `{concentration: {in: [Q(1,pm), Q(2,ppm)]}}` -> one at `.../in/1`; `{concentration: {between: [Q(1,pm), Q(5,pv)]}}` -> one at `.../between/1`; literal form `{concentration: Q(4.2,ppm)}` -> one at `/rules/0/when/concentration`.
- **Q6 unknown versus mismatch:** `{concentration: {lte: Q(4,percent)}}` with U1 -> `THROWS UNKNOWN_UNIT`; with U2 (declares `percent`) -> `CHECK` returns one `KF-E-310` (`percent` is not `percent_mass`; units compare by `id`, never by `dimension`).
- **Q7 runtime mismatch:** table `{concentration: {lte: Q(4.2,pm)}}`, supplied `concentration=Q(4.2,ppm)` -> `ERR 310` with `source: value`, `input: DE-0001.concentration`, `expected_unit: percent_mass`, `found_unit: ppm_mass`, `pointer: /inputs/0`; never `false`, no row evaluated.
- **Q8** supplied bare `"4.2"` for `q` -> `ERR 310` (`found_unit: null`); supplied `Q(4.2,pm)` for `d` -> `ERR 310` (`expected_unit: null`).
- **Q9** supplied `Q(4.2,pm)` -> r1 (right unit passes).
- **Q10 convertible pair is still an error (l.591):** supplied `Q("42000", ppm)` for `q` -> `ERR 310`; supplied `Q("4.2", ppm)` -> `ERR 310`.
- **Q11 `then` units:** `then: {limit: Q(4.2,pm), outcome: OUT-0001}` -> accepted and returned verbatim; `then: {limit: Q(4.2,furlong)}` -> `THROWS UNKNOWN_UNIT`. **Pending (D-07):** a quantity nested below the top level of `then` (`then: {a: {b: Q(1,furlong)}}`, `then: {a: [Q(1,furlong)]}`).

[V-20 for Q1-Q6; V-21 for Q7-Q10; V-09 for Q6, Q11]

### Typed errors (F-Y) - each row has a single defect; unless stated, both `checkDecisionTable` and `evaluateDecisionTable` throw the same `code`

- **Y1** `UNBOUND_FIELD` (B3). **Y2** `AMBIGUOUS_FIELD` (B4).
- **Y3 `EMPTY_PREDICATE`:** nested only: `{all: [{}]}`, `{not: {}}`, `{any: [{material: X}, {}]}`. **Y3a (pending D-08):** top-level `when: {}`. **Y3b (pending D-03):** `{all: []}`, `{any: []}`.
- **Y4 `TYPE_MISMATCH`:** `{material: {lt: "X"}}` (enum); `{note: {gte: "a"}}` (string); `{flag: {gt: true}}` and `{flag: {between: [false, true]}}` (boolean) - all thrown by check and evaluate; at evaluation only: supplied `note=5` (number for a string input, so `matches` never sees a non-string), supplied `flag="yes"` (string for a boolean input). `matches` on a `decimal`, `quantity` or `boolean` input is not asserted (TRIAGE N-14).
- **Y5 `INVALID_DECIMAL`:** literal `{count: {gt: 5}}` (YAML number); `{count: "4,2"}`; `{count: {in: ["1", 2]}}`; `{concentration: {lte: {value: 4.2, unit: percent_mass}}}`; `{concentration: {lte: {value: "4,2", unit: percent_mass}}}`; supplied `count=4.2` (number); supplied `count="1e3"`; supplied `concentration={value: 4.2, unit: percent_mass}`.
- **Y6** `INVALID_RANGE` (O18). **Y7** `DUPLICATE_DEFAULT`: two rows with `when: default`. **Y8** `DUPLICATE_RULE_ID`: two rows with `id: r1`.
- **Y9** `UNSUPPORTED_INPUT_TYPE`: `type: date`, `type: integer`, `type: percent`, `type: Quantity`.
- **Y10** `INVALID_INPUT_DECLARATION`: `{ref: DE-0001.x, type: quantity}` (no unit); `{ref: DE-0001.x, type: decimal, unit: percent_mass}`; `{ref: DE-0001.x, type: enum, domain: [X], unit: kg}`.
- **Y11** `INVALID_TABLE`: `kind: formula`; `rules` not a list; `inputs` not a list. **Y11b (pending D-01):** a matcher with an unknown operator (`{count: {approx: "1"}}`), `in` with a non-list, `between` with three elements, `is_null: "yes"`.
- **Y12** `INVALID_ARGUMENT`: `values` is `null`, a list or a string; `proofLimit` is `-1`, `1.5`, `"256"`, `NaN`.

[V-22; V-17 for Y3]

### Hit policies and `default` (F-H)

Table **T-H** (inputs `e, d`): rows in document order `r1 {material: {in: [X, Y]}}`, `r2 {material: {in: [Y, Z]}}`, `r3 {count: {gt: "0"}}`, `rd default`; each row's `then` is `{hit: <id>}`.

- **H1 `first`:** (`Y`, absent) -> r1; (`Z`, absent) -> r2; (`Z`,`"1"`) -> r2 (document order, though r3 also matches); (absent,`"1"`) -> r3; (absent, absent) -> `rd` with `via_default: true`. With `rd` moved **first**, then **middle**, in the document: every outcome above is unchanged (position-independent). With `rd` removed: (absent, absent) -> `∅`, `status: ok`, `via_default: false`.
- **H2 `collect`:** (`Y`,`"1"`) -> `[r1, r2, r3]` in document order; (`Z`, absent) -> `[r2]`; (`X`, absent) -> `[r1]` (default excluded when another row matches); (absent, absent) -> `[rd]` with `via_default: true`; with `rd` removed -> `[]`, `status: ok`.
- **H3 `unique`, disjoint rows** (input `e`, rows `r1 {material: X}`, `r2 {material: Y}`, `rd default`): `Y` -> r2; `Z` -> `rd` (`via_default: true`); with `rd` removed `Z` -> `∅`.
- **H4 `unique` at evaluation:** T-H with `hit_policy: unique`: (`Y`, absent) -> `status: error`, one `KF-E-312` with `proof: evaluation`, `rules: [r1, r2]`, `pointer: /rules/0`; (`X`, absent) -> r1 (only one non-default row matches); (`Y`,`"1"`) -> `status: error`, `rules: [r1, r2, r3]`.
- **H5 default never overlaps:** `unique` table over `e` with `r1 {material: X}`, `rd default` and `exhaustive: false` -> `CHECK -> []`; `unique` with only a `default` row -> `CHECK -> []`.
- **H6 `DUPLICATE_DEFAULT`/`DUPLICATE_RULE_ID`** (Y7, Y8) under each hit policy.
- **H7 `then` verbatim and isolated:** `then: {valid: true, outcome: OUT-0001, limit: Q(4.2,pm), note: "x", n: 5, nested: {a: [1, "2"]}}` -> `result.then` deep-equals that mapping (the number `5` and the strings unchanged), is not the same object as the table's `then`, and mutating the result does not alter a second evaluation or the input table (which is deep-frozen in the test).

[V-23 H1; V-25 H2; V-24 H3, H4; V-26 H1 default placement, H2, H3, H5, H6; V-27 H7]

### Exhaustiveness (F-X) - `CHECK`, `exhaustive: true`, `hit_policy: first` unless stated

- **X1** `q` with `r1 {concentration: {lte: Q(4.2,pm)}}` and `rd default` -> `[]` (the `BR-0001` shape). With `rd` and uncovered enum tuples also present -> `[]` (a default row satisfies the clause).
- **X2** the BR-0037 shape: inputs `q, e`; `r1 {material: {not_in: [X]}}`, `r2 {material: X}`; no default -> exactly one `KF-E-311`: `reason: non_enum_input`, `input: DE-0001.concentration`, `pointer: /exhaustive`, `rule: null`, `limit: 256`, `remediation: "añadir `when: default`"`.
- **X3** input `e` only; `r1 {material: {not_in: [X]}}`, `r2 {material: X}`; no default -> `[]` (enumeration proves coverage).
- **X4** input `e`; `r1 {material: {in: [X, Y]}}`; no default -> one `KF-E-311`: `reason: uncovered_tuple`, `witness: {DE-0001.material: "Z"}`.
- **X5a** inputs `A = {ref: DE-0001.a, type: enum, domain: [X, Y]}`, `B = {ref: DE-0001.b, type: enum, domain: [P, Q, R]}`; `r1 {a: X}`, `r2 {a: Y, b: {in: [P, Q]}}`; no default -> one `KF-E-311`, `witness: {DE-0001.a: "Y", DE-0001.b: "R"}` (the only uncovered tuple). **X5b (pending D-06):** `r1 {a: X, b: P}` only: the first uncovered tuple.
- **X6 limit boundary:** a single enum input with 256 values `v000..v255`; `r1 {v: {in: [v000..v254]}}`, `r2 {v: v255}` -> `[]` (product equals the limit; inclusive). Two enums of 16 values each fully covered -> `[]`. The same table with 257 values -> one `KF-E-311` `reason: over_limit`, `product: 257`, `limit: 256`; with `proofLimit: 257` -> `[]`; the 256-value table with `proofLimit: 255` -> one `over_limit` (`product: 256`, `limit: 255`); with `proofLimit: 0` any enum-only table with a non-empty domain and no default -> `over_limit`.
- **X7 non-enum inputs:** `exhaustive: true`, no default, one input of type `boolean` (rows `{flag: true}`, `{flag: false}`) -> `reason: non_enum_input` (E-0020: boolean is not enumerated); likewise `decimal`, `string`, `quantity`.
- **X8** enum input without `domain`, no default -> `reason: missing_domain`, `input` = that ref.
- **X9** `exhaustive: false` with uncovered tuples, or with a `quantity` input and no default -> `[]`.
- **X10** the X2 table evaluated with `material=Y` -> `status: ok`, r1 (a `KF-E-311` finding does not block evaluation).
- **X11** `proofLimit` invalid -> `THROWS INVALID_ARGUMENT` (Y12).

[V-28 X1, X9; V-29 X3-X6; V-30 X2, X6 (over limit), X7, X8, X10, X11]

### Overlap for `unique` (F-V) - `CHECK`, `hit_policy: unique`, `exhaustive: false`

Enumeration (all inputs are enums, product within `proofLimit`):
- **V1** inputs `A` (domain `[X, Y]`), `B` (domain `[P, Q]`); `r1 {a: X}`, `r2 {a: {in: [X, Y]}, b: P}` -> one `KF-E-312`: `proof: enumeration`, `rules: [r1, r2]`, `witness: {DE-0001.a: "X", DE-0001.b: "P"}`, `pointer: /rules/0`.
- **V2** near-miss: `r1 {a: X, b: P}`, `r2 {a: Y}` -> `[]`.
- **V3** enumeration is exact where set reasoning is not: input `A` (domain `[X, Y]`) only; `r1 {a: {ne: X}}`, `r2 {a: X}` -> `[]` (disjoint by enumeration); and `r1 {a: {ne: X}}`, `r2 {a: Y}` -> one `KF-E-312`, `witness: {DE-0001.a: "Y"}`.
- **V4** limit boundary: the first table of V3 with `proofLimit: 2` -> `[]` (product 2 enumerated, inclusive); with `proofLimit: 1` -> one `KF-E-312` with `proof: not_proven_disjoint`, `rules: [r1, r2]` (the interval/set reasoning cannot use `ne`).
- **V5** a `default` row alone never overlaps (H5).

Interval and set reasoning (not all inputs are enums; inputs `d`, `s`, `b`, `q`):
- **V6 proven disjoint (`CHECK -> []`):** `{count: {lt: "5"}}` | `{count: {gte: "5"}}`; `{count: {lt: "5"}}` | `{count: {gt: "5"}}`; `{count: "5"}` | `{count: {gt: "5"}}`; `{concentration: {lte: Q(4.2,pm)}}` | `{concentration: {gt: Q(4.2,pm)}}`; `{count: {between: ["1","5"]}}` | `{count: {between: ["5.01","9"]}}`; `{count: {between: ["1","5"]}}` | `{count: {gt: "5"}}`; `{count: "1"}` | `{count: "2"}`; `{count: {in: ["1","2"]}}` | `{count: {in: ["3"]}}`; `{note: {in: ["a","b"]}}` | `{note: {in: ["c"]}}`; `{note: "a"}` | `{note: "b"}`; two fields: `{count: {lt: "5"}, note: "a"}` | `{count: {gt: "7"}, flag: true}` (the shared field `count` proves it).
- **V6b overlapping (one `KF-E-312` each, `proof: not_proven_disjoint`):** `{count: {lte: "5"}}` | `{count: {gte: "5"}}`; `{count: {lt: "5"}}` | `{count: {gt: "4"}}`; `{count: {between: ["1","5"]}}` | `{count: {between: ["5","9"]}}`; `{count: "5"}` | `{count: "5.0"}` (equal by value); `{count: "1"}` | `{count: {in: ["1","2"]}}`; `{note: {in: ["a","b"]}}` | `{note: {in: ["b","c"]}}`; `{count: {gt: "0"}}` | `{count: {gt: "10"}}`.
- **V6c three mutually overlapping rows** `{count: {gte: "0"}}` x3 (`r1`,`r2`,`r3`) -> three `KF-E-312`, in the order pairs (r1,r2), (r1,r3), (r2,r3) (`rule_indexes` [0,1], [0,2], [1,2]).
- **V7 fail closed (actually disjoint, not provable by interval/set reasoning -> `KF-E-312`, `proof: not_proven_disjoint`):** `{any: [{note: "a"}, {note: "b"}]}` | `{note: "c"}`; `{note: {not_in: ["a"]}}` | `{note: "a"}`; `{note: {ne: "a"}}` | `{note: "a"}`; `{note: {matches: "^a"}}` | `{note: {matches: "^b"}}`; `{not: {note: "a"}}` | `{note: "a"}`; no shared field: `{count: {lt: "5"}}` | `{note: "a"}`; literal reading of "no `matches`": `{note: {matches: "^a"}, count: "1"}` | `{count: "2"}`.

[V-31 V1-V5; V-32 V6, V6b, V6c; V-33 V7]

### Code matrix, diagnostics shape, determinism (F-K, F-S)

- **F-K** each in-scope code has one positive and one near-miss, all cited above: `KF-E-310` (Q1 / Q1 near-miss); `KF-E-311` (X2 / X3); `KF-E-312` (V1 / V2, V6b / V6); `KF-E-314` (D2 / D2 near-miss); `KF-E-315` (R2 / R2 accepted pairs). `KF-E-010`: positive and near-miss **pending (D-01)**. [V-34]
- **S1 all five codes in one table** (U1; inputs `q`, `e` with domain `[X, Y]`, `s`; `hit_policy: unique`, `exhaustive: true`, no default; `r1 {concentration: {lte: Q(4,ppm)}}`, `r2 {material: "W"}`, `r3 {note: {matches: "(a)\\1"}}`) -> exactly this ordered list of `(code, pointer)`: (`KF-E-310`, `/rules/0/when/concentration/lte`), (`KF-E-311`, `/exhaustive`), (`KF-E-312`, `/rules/0`) with `rules [r1,r2]`, (`KF-E-312`, `/rules/0`) with `rules [r1,r3]`, (`KF-E-312`, `/rules/1`) with `rules [r2,r3]`, (`KF-E-314`, `/rules/1/when/material`), (`KF-E-315`, `/rules/2/when/note/matches`).
- **S2 determinism:** the same table with the keys of every `when` mapping permuted, and the `rules` evaluated in a fresh process, returns the identical list; every returned list is sorted by the key in "Diagnostic sort key".
- **S3 purity:** `logic`, `values` and `options` are deep-frozen before the call and the call does not throw; results are not the same object across calls; the table is unchanged afterwards.
- **S4 shape:** every diagnostic has `severity: 'E'`; only `KF-E-311` carries `remediation`, equal to the catalog text; no diagnostic carries a key named `error`. [V-35]
- **S5 catalog constants:** `LOGIC_DIAGNOSTIC_CATALOG` keys and `severity`/`remediation` equal l.1765-1770 (`KF-E-311` remediation "añadir `when: default`", others none). [V-38]

### Existing fixture and spec example (F-A)

- **A1** `framework/conformance/acme-formulation/knowledge/business-rules/BR-0001/rule.yaml`, `specified[0]` (v1) with U1: `CHECK -> []`; supplied `concentration=Q(4.2,pm)` -> `r1`, `then == {valid: true, outcome: OUT-0001}`; `Q(4.21,pm)` -> default row `r2`, `then == {valid: false}`, `via_default: true`; absent -> `r2`; `Q(4.2,ppm)` -> `ERR 310`.
- **A2** `specified[1]` (v2, `lte 4.0`) with U1: `Q(4.0,pm)` -> `r1`; `Q(4.1,pm)` -> `r2`.
- **A3 (pending D-08)** `BR-0001/observed/legacy-app.yaml` (`when: {}`): the outcome of check and evaluation.
- **A4** `framework/conformance/spec-examples/10.3-greenfield-rule.yaml` (`specified.logic`, the BR-0037 example, E-0008(d)) with U1: `CHECK` returns exactly one `KF-E-311` (`reason: non_enum_input`, `input: DE-0017.concentration`). Evaluation (values keyed by full ref): `material_type=Y`, `concentration=Q(1,pm)` -> `r1`, `then == {max_concentration: Q(4.2,pm), outcome: OUT-0004}`; `X` -> `r2`, `then == {exempt: true, outcome: OUT-0009}`; `material_type` absent -> `∅` (`not_in` and `eq` are both `false` on `null`, E-0019); `material_type=W` -> `ERR 314`.
- **A5** no `expected/` line and no `acme-formulation` entity is added or changed by P011.

[V-36]

### Static source scans (F-P) - run by the implementer's test, re-run by the Foreman

- **P1** the six modules import only from `framework/engine/` siblings (no `node:` module, no package).
- **P2** none of `parseFloat`, `toFixed`, `toPrecision`, `Math.random`, `Date`, `performance`, `process.env`, `crypto`, `readFile`, `setTimeout` appears in any of the six modules; none of `Number(`, `parseInt`, `Math.` appears in `decimal.mjs`; none of `new RegExp`, `RegExp(`, `.match(`, `.exec(`, `.test(` appears in `regex-re2.mjs` or `decision-table.mjs` (any necessary exception is listed in `HANDOFF.md` and justified). [V-06, V-13]

## Implementation sequence

1. **Conformance engineer first** (`kf-conformance-engineer`): write `framework/conformance/p011-decision-table.yaml`, the data directory and `test/conformance-p011-decision-table.test.mjs` from this plan, the spec and errata only, before opening `framework/engine/**` or any implementer diff. The suite is red (or skipped with named `test.todo`) at that point. Every assertion held by a D-nn is `pending-decision`; the report states the commit it was written at and that no implementer code was read.
2. **Foreman verifies** the slice (observable behavior only; each case cites a clause or E-id), decides D-01..D-08 into errata or defers them, then briefs the implementer. Unresolved items block only the assertions named under "Blocked until decided".
3. **Implementer** (`kf-implementer`), each step with tests failing first:
   1. `logic-errors.mjs` and `decimal.mjs` (F-N, V-01..V-06 scan).
   2. `units.mjs` (F-U1, F-U2).
   3. `regex-re2.mjs`: parser for the whitelist, linear-time matcher over code points, the repeat bound; the adversarial pass of F-R3 including large counted repeats.
   4. `logic-diagnostics.mjs` (catalog constants, sort).
   5. `decision-table.mjs`: validation pass and binding (F-B, F-Y), then operators and null logic (F-O, F-L), enum domains and units at evaluation (F-D, F-Q), hit policies and `default` (F-H).
   6. Static diagnostics: `KF-E-310`/`314`/`315` literals, `KF-E-311` exhaustiveness (F-X), `KF-E-312` overlap by enumeration then by interval/set reasoning (F-V), then S1..S5.
   7. Adversarial pass: very long digit strings, decimals in `then`, deeply nested predicates (recursion depth), hostile regexes, frozen inputs, hostile `values` keys (`__proto__`, `constructor`), property-order permutations.
4. Run `npm run build`, `npm run lint`, `npm test`, `git diff --check`, the conformance test, and the targeted P011 tests twice (deterministic repeat). Inspect `git status` against the write boundaries (including that `framework/engine/id-registry.mjs` is unchanged).
5. Fill `TRACEABILITY.md` (PASS only with executable evidence), write `HANDOFF.md` naming the exact product commit, return to the Foreman. The Foreman commits product then control plane, sets `READY_FOR_AUDIT`, and audits with fresh instances (blind pass first).

## Verification targets

Each target maps to fixture cases and to a test in `test/conformance-p011-decision-table.test.mjs` (conformance) or `test/p011-*.test.mjs` (implementer's adversarial tests). "Partial" targets have a part held by an open D-nn.

| V | Observable target | Case | Status of decision |
|---|---|---|---|
| V-01 | Decimal equality and order are by numeric value, not text: `"4.20"` = `"4.2"`, `"-0"` = `"0"`, leading zeros, `"10"` > `"9"` | F-N1 | - |
| V-02 | Exactness beyond binary float and for very long digit strings (doubles-colliding values differ; 400-digit values; 60-digit products) | F-N1, F-N2 | - |
| V-03 | Exact `add/subtract/multiply`; canonical `formatDecimal` | F-N2, F-N3 | - |
| V-04 | Only `^-?[0-9]+(\.[0-9]+)?$` strings parse; every other string and every non-string is `INVALID_DECIMAL` | F-N4 | - |
| V-05 | `divideDecimal`: exact quotients, `DIVISION_BY_ZERO`, `INVALID_PRECISION` (inexact quotient held) | F-N5 | partial (D-04) |
| V-06 | No binary float, clock, randomness, I/O or host regex in the modules (static scan) | F-P1, F-P2 | - |
| V-07 | `buildUnitRegistry` accepts the l.596-599 shape; ids compared exactly; no built-in unit; bare `percent` only if declared | F-U1 | - |
| V-08 | Invalid registries are `INVALID_UNITS` | F-U2 | - |
| V-09 | `unitRegistry` is explicit and built; undeclared unit in an input, literal or top-level `then` is `UNKNOWN_UNIT` | F-U3, F-Q6, F-Q11 | partial (D-07) |
| V-10 | The accepted RE2 subset compiles and matches as tabulated (unanchored, case-sensitive, code points, lazy forms) | F-R1 | partial (D-05) |
| V-11 | Every construct E-0021 rejects, and plain syntax errors, fail compile; as `matches` patterns they are `KF-E-315` | F-R2 | partial (D-05) |
| V-12 | Pathological patterns and nested counted repeats finish within 5 s | F-R3 | partial (D-05, cap) |
| V-13 | No `RegExp` is built from or applied with a user pattern (static scan) | F-P2 | - |
| V-14 | Each matcher (`literal`, `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `in`, `not_in`, `between` inclusive, `matches`, `is_null`) behaves as tabulated, incl. `between` degenerate and min>max | F-O1..O21 | - |
| V-15 | `all`, `any`, `not`, multi-key conjunction and nesting | F-O22..O26 | - |
| V-16 | `when` keys bind by `ref` or suffix; `UNBOUND_FIELD`, `AMBIGUOUS_FIELD` | F-B1..B5 | partial (D-02) |
| V-17 | `{}` nested in a combinator is `EMPTY_PREDICATE` | F-Y3 | partial (D-03, D-08) |
| V-18 | `null`/absent: every matcher but `is_null` is `false`; `not` over null is `true`; null is not zero or false | F-L1..L7 | - |
| V-19 | `KF-E-314` for a supplied out-of-domain value (even if unread) and for out-of-domain literals, with exact pointers | F-D1..D3 | - |
| V-20 | Static `KF-E-310`: other unit, bare vs quantity both ways, in lists and ranges; unknown vs mismatch | F-Q1..Q6 | - |
| V-21 | Evaluation `KF-E-310`: never coerced, never `false`; convertible pairs are errors | F-Q7..Q10 | - |
| V-22 | Typed errors for operand/type misuse and bad declarations, identical from check and evaluate | F-Y1..Y12 | partial (D-01) |
| V-23 | `first`: document order; default only when nothing else matches; no match is `∅` | F-H1 | - |
| V-24 | `unique`: single match; default fallback; runtime `KF-E-312` for 2+ matches | F-H3, F-H4 | - |
| V-25 | `collect`: all non-default matches in order, `[default]`, `[]` | F-H2 | - |
| V-26 | `default` is position-independent, never counts toward overlap, at most one | F-H1, F-H2, F-H3, F-H5, F-H6 | - |
| V-27 | `then` returned verbatim as an isolated deep copy | F-H7 | - |
| V-28 | `exhaustive: true` is satisfied by a `default` row; `exhaustive: false` is not checked | F-X1, F-X9 | - |
| V-29 | Exhaustiveness by enumeration within the limit (inclusive), witness of the uncovered tuple | F-X3..X6 | partial (D-06) |
| V-30 | `KF-E-311` for non-enum inputs (incl. boolean, quantity), missing domain, product over the limit; evaluation not blocked | F-X2, F-X6, F-X7, F-X8, F-X10, F-X11 | - |
| V-31 | Overlap proof by enumeration (exact, inclusive limit) with the witness tuple | F-V1..V5 | - |
| V-32 | Overlap proof by per-field interval/set comparison (open/closed bounds, `eq`/`in`/`between`) | F-V6, F-V6b, F-V6c | - |
| V-33 | Fail closed: pairs not provably disjoint are `KF-E-312` | F-V7 | - |
| V-34 | Each in-scope `KF-` code has a positive and a near-miss case | F-K | partial (D-01 for `KF-E-010`) |
| V-35 | Diagnostic fields, remediation only on `KF-E-311`, sort order, determinism, all five codes in one table | F-S1, F-S2, F-S4 | - |
| V-36 | The real `BR-0001` specified facets check clean and evaluate as stated; the BR-0037 example yields exactly `KF-E-311` | F-A1, F-A2, F-A4 | partial (D-08 for A3) |
| V-37 | Inputs are never mutated; outputs are fresh; repeated calls are deep-equal | F-S3 | - |
| V-38 | Catalog constants equal l.1765-1770 | F-S5 | - |
| V-39 | `npm run build`, `npm run lint`, `npm test`, `git diff --check` pass; no file outside the write boundaries changed; `framework/engine/id-registry.mjs` unchanged; no new dependency | - | - |
| V-40 | No `bin/`, no `package.json` change, no schema change, no `expected/` line added | F-A5 | - |

## Blocked until decided

| Item | Held assertions / deliverables |
|---|---|
| D-01 | Y11b; the `KF-E-010` pair of F-K; any statement that malformed matchers produce a specific outcome. |
| D-02 | F-B3b; evaluation callers keying `values` by suffix (P014). All other cases use full-ref keys. |
| D-03 | Y3b (empty `all`/`any`). |
| D-04 | F-N5 inexact quotient (`"1"/"3"`). |
| D-05 | F-R1 pending rows (newline, `$`, ASCII classes, unlisted escapes, empty pattern), F-R2 `a**`/unlisted escapes, the program-size cap value. |
| D-06 | X5b (two uncovered tuples). |
| D-07 | F-Q11 nested quantity in `then`. |
| D-08 | Y3a (top-level `when: {}`), F-A3 (observed `BR-0001`); also affects P014. |

## Risk and ownership

HIGH: executable regulatory rules; a wrong decimal, unit or null semantics silently validates or rejects real rules, and P012/P013/P014 build on these modules. Owners: Foreman (scope, errata, decisions, commits); `kf-conformance-engineer` (fixture and conformance test, first); `kf-implementer` (engine modules, unit tests, handoff); auditors read-only. Never an implementer and an auditor on the phase at the same time.

- R-01 Hidden binary floats: `Number`, JSON round trips, `Math` helpers, YAML numbers entering as values. Covered by V-02, V-04, V-06. Auditors should try `0.1 + 0.2`-style and 2^53 pairs.
- R-02 A user regex run by the host engine (catastrophic backtracking is an availability failure, l.612). Covered by V-12, V-13; auditors should try nested quantifiers, huge counted repeats and long inputs, and check recursion depth in the parser and matcher.
- R-03 Silent coercion of units or types (a decimal string compared with a quantity). Covered by V-20, V-21, V-22.
- R-04 Fail-open proofs: an overlap or exhaustiveness proof that says "fine" when it is not. Covered by V-29..V-33 near-misses; auditors should search for rows the interval reasoning mishandles (open/closed bounds, equal-by-value decimals).
- R-05 The pending decisions (D-01..D-08) shape persisted-adjacent behavior used by P014; D-08 conflicts with the accepted P001 fixture.
- R-06 Local diagnostic constants duplicate the catalog until P028 (P-09); P007/P014 must re-source them from the catalog module.
- R-07 eslint globals: `structuredClone`, `performance` are undeclared; using them fails `npm run lint`.
- R-08 Object key order of YAML mappings: traversal order is the insertion order of string keys; integer-like field names are reordered by JS (TRIAGE N-10, not asserted).
- Dependencies downstream: P012 (decimal, units, regex, diagnostics, `LogicError`), P013, P014 (`check-rules`, observed-facet evaluation), P007 (validate wiring, config to `proofLimit`/`precision`, `units.yaml` discovery, error-code mapping).

## Exit criteria

1. Every V-nn above is backed by a passing, named test, except assertions explicitly held by a still-open D-nn, which are listed in `HANDOFF.md` with the decision they wait for; none of those may be implemented by guess.
2. The conformance slice was written before the implementer read it, and the conformance engineer's report states the commit it was written at and that no implementer code had been read.
3. `framework/engine/id-registry.mjs`, `framework/schemas/**`, `package.json` and `eslint.config.js` are unchanged; no new dependency; no `bin/` content.
4. `TRACEABILITY.md` rows are `PASS` only with executable evidence (test name or case path); remaining rows state their blocking decision.
5. `npm run build`, `npm run lint`, `npm test`, `git diff --check` pass; `git status` shows only paths inside the write boundaries.
6. `HANDOFF.md` names the exact product commit. The Foreman decides acceptance after an independent audit (blind pass first); implementer and conformance engineer instances never audit.

## Non-goals

- Formula evaluator, unit algebra, rounding (`rounding:` declarations), `KF-E-313`, `guard`, `KF-E-316` (P012). Decimal division is exposed only as the primitive in E-0021.
- State machines and narrative rules (P013).
- Scenario checking, `kf check-rules`, `KF-E-320`, `KF-W-321`, `given` mapping (P014).
- CLI, `kf validate`, `kf lint`, `KF-W-124`, `units.yaml` discovery, reading of `extensions/*/units.yaml`, merging of several registries and duplicate-unit-across-files errors, mapping of typed errors to exit codes, reading `logic.*` configuration (P007).
- Cross-entity checks: `outcome` against `produces`, `ref` resolving to a real `DE` field, `DE` field type against input `type` (P007).
- JSON Schema validation of `logic` and `KF-E-010` (D-01; P007 `kf validate`).
- Changing `logic.schema.json`, `common.schema.json`, `acme-formulation/**` or `spec-examples/**`; adding `framework/conformance/expected/`.
- Unreachable-row, redundancy and dimension-analysis diagnostics; SAT or SMT reasoning of any kind (l.634).
- Performance targets beyond the 5 s bound of V-12; caching.
