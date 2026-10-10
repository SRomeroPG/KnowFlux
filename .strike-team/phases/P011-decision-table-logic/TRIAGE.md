# P011 - Spec triage and decisions

Base: `5fce77d5cac754b78737c1c1de591a470b8a43e2` (errata E-0017..E-0021 are committed at `451b25e`). Line numbers refer to `knowledge-framework-spec-v2.1.md` (2234 lines) and were checked with `sed -n`. P002 is active on disjoint paths and is ignored here.

## 1. Items decided by the Foreman (from `kf-spec-triage`)

| Item | Question | Decision | Settling clause / entry |
|---|---|---|---|
| T-01 | Decimal engine, precision, lexical form, unquoted YAML numbers | `DECIDED -> E-0017` | l.582 "Todo valor numérico de negocio **SHALL** evaluarse como **decimal de precisión arbitraria**" (exact `{unscaled: BigInt, scale}`; lexical form `^-?[0-9]+(\.[0-9]+)?$`; a non-string or malformed string is `INVALID_DECIMAL`; precision only for inexact operations, explicit parameter). |
| T-02 | Comparison semantics: equality of `"4.20"`/`"4.2"`, type rules per operator | `DECIDED -> E-0019` | l.620-629 grammar; `lt/lte/gt/gte/between` only on decimal and quantity (`TYPE_MISMATCH` otherwise); `between` with `min > max` is a typed error. |
| T-03 | `units.yaml` loading and unknown unit | `DECIDED -> E-0018` | l.593-598; engine takes an already-built registry; `UNKNOWN_UNIT` for an undeclared id; units compared by `id` only; discovery is P007. |
| T-04 | Scope of `KF-E-310` (static vs evaluation, quantity vs scalar) | `DECIDED -> E-0019` | l.589 "Unidad declarada distinta de unidad recibida es ERROR (`KF-E-310`)"; reported both by the table check (literal vs declared unit) and at evaluation (supplied vs declared unit); never coerced, never `false`. |
| T-05 | Binding of `when` keys to `inputs[]`; literal matcher meaning | `DECIDED -> E-0019` | l.621-623 grammar; key matches `ref` or the `ref` suffix after the last `.`; `UNBOUND_FIELD` / `AMBIGUOUS_FIELD` / `EMPTY_PREDICATE`; literal means `eq`. |
| T-06 | Hit-policy result shapes, meaning and position of `default`, overlap check without a solver | `DECIDED -> E-0020` | l.632-633; `default` matches iff no other row matches, never counts toward overlap; overlap proof by enumeration or per-field interval/set comparison, fail closed. |
| T-07 | `exhaustive: true` semantics and proof | `DECIDED -> E-0020` | l.634; `default` row, else enum-only inputs with product <= limit (inclusive) enumerated; everything else `KF-E-311`. |
| T-08 | RE2 in Node without a native dependency | `DECIDED -> E-0021` | l.612; whitelisted RE2 subset and an engine-owned linear-time matcher; everything else `KF-E-315`. |
| T-09 | `null` semantics and out-of-domain enums outside scenarios | `DECIDED -> E-0019` | l.606-608; binary logic, `is_null` the only test of absence, `not` negates the boolean; `KF-E-314` wherever it occurs. |
| T-10 | Typing of `then` | `DECIDED -> E-0021` | opaque mapping returned verbatim; quantity unit ids in `then` must be declared; `outcome` not cross-checked (P007). |
| T-11 | Failures with no catalog code | `DECIDED -> E-0021` | internal typed error codes, E-0014 precedent; P007/P014 map them. |
| T-12 | `KF-E-313` division by zero / `guard` in decision tables | `NOT_AN_ISSUE` for P011 | l.585 "División por cero → `KF-E-313` en validación, o el `guard` declarado en tiempo de evaluación." and l.1768 belong to formulas (the `guards` array exists only in the `formula` branch of `logic.schema.json`); a decision table has no division. The decimal module exposes division for P012 (E-0021). |

## 2. New ambiguities found while planning: `DECISION_NEEDED`

None is resolved by the planner. Each lists what stays specified and what is blocked. Blocked parts are narrow; the rest of P011 proceeds. Until decided, the conformance engineer marks the affected assertion `pending-decision` and the implementer follows only behavior that is identical under every option (noted per item).

### D-01 - `KF-E-010` and the boundary with JSON Schema validation

Context. `KF-E-010` "Violación de JSON Schema" (l.1740; "Valor fuera de enum → `KF-E-010`", l.1732) is the code for a table that violates `framework/schemas/logic.schema.json`. No E-entry says whether P011 functions validate their input against that schema. The schema is looser than the engine in places (it allows `when: {}`, an `enum` input without `domain` is only caught through an `if/then`, matchers are `oneOf`).

Options.
1. P011 assumes schema-valid input (schema validation is the `kf validate` layer, P007). Input the evaluator cannot interpret throws the typed error `INVALID_TABLE`. No `KF-E-010` is produced by P011.
2. `checkDecisionTable` first validates the logic against `logic.schema.json` with the existing Ajv setup and returns `KF-E-010` diagnostics (one per Ajv error, sorted), without further analysis when any exists.
3. As option 2, but evaluation also refuses schema-invalid tables.

Blocked until decided: every assertion that a structurally malformed matcher/table yields a specific outcome (planned rows Y11b in the fixture slice; the `KF-E-010` positive/near-miss pair of the code matrix). Unaffected: all semantics decided by E-0017..E-0021. Neutral behavior: `kind` other than `decision-table` or a non-object argument throws (`INVALID_TABLE` / `INVALID_ARGUMENT`) under every option.

### D-02 - How supplied values are keyed at evaluation, and extra keys

Context. E-0019 defines how `when` keys bind to `inputs[]` (ref or suffix) and says "An input absent from the supplied values is `null`" but not how the supplied-values mapping is keyed. The only consumer sketch (scenario `given`, l.1325-1328) uses suffix names (`material_type`, `concentration`) and also carries non-input keys (`business_unit`, l.1326).

Options.
1. Supplied keys bind exactly as `when` keys do (ref equal, or ref suffix; ambiguous suffix `AMBIGUOUS_FIELD`); keys that match no input are ignored.
2. Supplied keys must equal an input `ref` exactly; keys that match no input are ignored.
3. As option 1, but a key that matches no input is `UNBOUND_FIELD`.

Blocked until decided: fixture rows that supply a value by suffix name or with an extra key (F-B3b). Neutral behavior: a supplied key equal to the input's full `ref` binds under all three options; all other fixture cases use full-ref keys.

### D-03 - Empty `all: []` and `any: []`

Context. `logic.schema.json` allows empty arrays. E-0019 makes the empty predicate mapping `{}` a typed error (`EMPTY_PREDICATE`) but is silent on empty combinators. They change overlap and exhaustiveness proofs (an `all: []` row would match everything).

Options.
1. Both are `EMPTY_PREDICATE` (consistent with `{}`; fail closed).
2. Vacuous logic: `all: []` is true and `any: []` is false.

Blocked until decided: fixture rows Y3b. Neutral: non-empty combinators and `{}` nested inside a combinator (`EMPTY_PREDICATE`, E-0019) are asserted now.

### D-04 - Rule for an inexact quotient in `divideDecimal`

Context. E-0021: "the decimal module exposes division for P012"; E-0017: precision "is an explicit parameter of the inexact operations". l.584 says "Sin declaración, no hay redondeo" and rounding is P012's. Neither fixes what `divideDecimal("1", "3", {precision: 28})` returns (which digit rule produces the 28th digit).

Options.
1. Truncate toward zero to `precision` significant digits (documented as the division-precision rule, not a l.584 rounding mode).
2. Round half-even to `precision` significant digits.
3. Inexact quotient is the typed error `INEXACT_DIVISION`; P012 supplies a declared rounding to pass in.

Blocked until decided: the single fixture row for an inexact quotient (F-N5 "1/3"). Unaffected: exact quotients (for example `1/4 = 0.25`, `10/4 = 2.5`, `0.3/0.1 = 3`), `DIVISION_BY_ZERO`, `INVALID_PRECISION`.

### D-05 - Fine print of the RE2 subset

Context. E-0021 lists the accepted syntax and says everything else is `KF-E-315`, but several behaviors a fixture must pin are unlisted: (i) whether `.` matches a newline; (ii) whether `$` matches only at end of text or also before a final `\n`; (iii) whether `\d \w \s` are ASCII-only; (iv) whether `\n \t \r \f \xHH`, `\b`, POSIX classes `[[:alpha:]]` and the empty pattern are accepted; (v) whether stacked quantifiers such as `a**` are accepted; (vi) a size cap for the compiled program (nested counted repeats such as `(a{1000}){1000}` expand multiplicatively, so "linear time" needs a bounded construction cost; RE2 itself rejects over-large programs as non-compilable).

Options.
1. RE2 behavior for each: `.` excludes `\n`; `$` only at end of text; classes ASCII; escapes `\n \t \r \f` accepted, `\xHH`, `\b`, POSIX classes, `a**` and the empty pattern rejected unless E-0021 lists them; a program-size cap of 100000 instructions, over it `KF-E-315`.
2. Reject every unlisted construct (stricter): no `\n \t \r \f` escapes either; same semantics and cap as option 1 for what is accepted.
3. JavaScript-like semantics for (i)-(iii) with options 1's cap.

Blocked until decided: fixture rows R-fp (newline, `$`, ASCII class and unlisted escape rows, the empty pattern, `a**`, the cap value). Asserted now: every construct E-0021 lists, every construct E-0021 names as rejected, plain syntax errors (unbalanced groups/classes, bad ranges, nothing to repeat at start, trailing backslash), code-point semantics, unanchored search, and that compile plus match of nested counted repeats terminates within the time bound whether it is accepted or rejected.

### D-06 - Enumeration order of tuples (which input varies fastest)

Context. E-0020 fixes "enumeration order: inputs in `inputs[]` order, values in `domain` order" and reports the "first" uncovered/overlapping tuple. It does not say whether the first input is the outermost loop (last input varies fastest, odometer) or the innermost.

Options.
1. First input is the outermost loop: tuples ascend with the last input varying fastest.
2. First input varies fastest.

Blocked until decided: the single fixture row with two uncovered tuples (X5b). Neutral: all other enumeration cases have exactly one uncovered/overlapping tuple or share the first tuple under both options.

### D-07 - Which values inside `then` are checked as quantities

Context. E-0021: "quantity unit ids in `then` must be declared (`UNKNOWN_UNIT`, E-0018)" while `then` is "an opaque mapping returned verbatim". Detection is unstated. Examples at l.452 and l.455 show quantities as direct values of `then` keys.

Options.
1. A value of a top-level `then` key that is a mapping whose key set is exactly `{value, unit}` is a quantity.
2. As option 1, at any nesting depth (inside mappings and lists).

Blocked until decided: fixture row Q11d (a quantity nested below the top level). Asserted now: top-level quantity with an undeclared unit throws `UNKNOWN_UNIT`, declared unit passes, nothing else in `then` is inspected for typing.

### D-08 - `when: {}` in the accepted P001 fixture versus `EMPTY_PREDICATE`

Context. E-0019: an empty predicate mapping `{}` "is a typed error (`EMPTY_PREDICATE`); the only unconditional row is `when: default`". The accepted P001 fixture `framework/conformance/acme-formulation/knowledge/business-rules/BR-0001/observed/legacy-app.yaml` (l.12-15 of that file) has `rules: - {id: r1, when: {}, then: {...}}`, and `logic.schema.json` deliberately admits `{"type": "object", "maxProperties": 0}` for `when`. Evaluating that observed facet (P014 `kf check-rules` against the 6 observed scenarios) would throw `EMPTY_PREDICATE`.

Options.
1. Keep E-0019 literally. P011 throws for the observed BR-0001; the fixture is corrected to `when: default` by a later fixture amendment (outside P011) and the schema branch becomes vestigial.
2. Amend E-0019: a top-level `when: {}` means `default` (unconditional); `{}` nested inside `all/any/not` stays `EMPTY_PREDICATE`.
3. Amend E-0019: a top-level `when: {}` is accepted as an always-true row distinct from `default` (participates in overlap and ordering).

Blocked until decided: fixture rows A3 and Y3a (top-level `when: {}`). Asserted now: nested `{}` is `EMPTY_PREDICATE` under every option. Flagged also for P014, which owns the observed-facet evaluation.

## 3. Planner API choices (not ambiguities; listed so the Foreman can veto at plan review)

These shape the engine API where the errata decide semantics but not the interface. They are reversible API choices with no persisted format.

- P-01. One shared typed error class `LogicError` (`code`, `details`) in `framework/engine/logic-errors.mjs`, reused by P012/P013. Codes named by the errata: `INVALID_DECIMAL`, `UNKNOWN_UNIT`, `UNBOUND_FIELD`, `AMBIGUOUS_FIELD`, `EMPTY_PREDICATE`, `TYPE_MISMATCH`. Codes named by this plan (no errata name): `DIVISION_BY_ZERO`, `INVALID_PRECISION`, `INVALID_UNITS`, `INVALID_RANGE`, `DUPLICATE_DEFAULT`, `DUPLICATE_RULE_ID`, `UNSUPPORTED_INPUT_TYPE`, `INVALID_INPUT_DECLARATION`, `INVALID_TABLE`, `INVALID_ARGUMENT`. CLI exit-code class not set here (P007/P014 map them, as for `UNREGISTERED_ID` in P002).
- P-02. `KF-` codes are never thrown; typed errors are never returned inside `diagnostics`. A call either throws or returns.
- P-03. `evaluateDecisionTable` validates the whole table first (same typed errors as `checkDecisionTable`) and, if the table check finds `KF-E-310`, `KF-E-314` or `KF-E-315`, returns `status: 'error'` with those diagnostics without evaluating any row. `KF-E-311` and static `KF-E-312` do not block evaluation.
- P-04. Supplied values are validated eagerly against all input declarations (in `inputs[]` order) before any row is evaluated, because E-0019 compares "a supplied value versus the declared `unit`" and says `KF-E-314` applies to "a supplied value at evaluation" regardless of whether a row touches it.
- P-05. `unitRegistry` is a required option for check and evaluation and must come from `buildUnitRegistry` (E-0018: no unit set is built in); anything else is `INVALID_ARGUMENT`. A table with no units passes an empty registry.
- P-06. `units.yaml` file reading is out of P011 (E-0018 gives discovery to P007): `buildUnitRegistry` takes parsed data only. The evaluator and registry modules import nothing from `node:fs`.
- P-07. `formatDecimal` returns the canonical minimal form (no leading zeros except one, no trailing fractional zeros, never `-0`).
- P-08. Diagnostic shape, sort key and `reason` strings of `KF-E-311`/`KF-E-312` are defined in `PLAN.md` ("Public engine API contract"). Message text is free; fields are not.
- P-09. Diagnostics constants (`code`, `severity`, remediation) for the six codes are declared once in `framework/engine/logic-diagnostics.mjs` until the P028 catalog module exists; same treatment as `KF-E-101` in P002 (N-06 there).

## 4. Noted, not asserted

Deliberately outside every V-nn. No decision needed unless the Foreman wants one; the implementer chooses a fail-closed behavior and documents it in `HANDOFF.md`.

- N-01. Duplicate input `ref` values in one table.
- N-02. `matches` on an `enum` input; enum domains that are empty, contain duplicates or contain non-string values; `domain` on a non-enum input.
- N-03. `units` entries with extra keys; empty-string ids; a `units` object whose `conversions` key is absent (shape of l.596-599 always has it).
- N-04. Precedence among several simultaneous typed-error defects in one table (only single-defect tables are asserted).
- N-05. Tables with zero inputs.
- N-06. Rows whose own constraints are contradictory (for example `gt 5` and `lt 3` on one field) in the overlap proof.
- N-07. Treatment of `all` nesting inside the interval/set disjointness proof (the fixture uses flat mappings only).
- N-08. An input named `all`, `any` or `not`.
- N-09. Literal operand kinds E-0019 does not type (a number literal against a `string` input; `null` inside `in`/`not_in` lists).
- N-10. Key order of integer-like field names; lone surrogates in regex input.
- N-11. When a `ref` without a dot equals a key and another input's suffix equals it.
- N-12. Unreachable rows (shadowed by an earlier row): no diagnostic is defined.
- N-13. Performance targets: none authorized beyond the 5 s bound in V-12.
- N-14. `matches` on an input declared `decimal`, `quantity` or `boolean`: E-0021 says "on a non-string value it is `TYPE_MISMATCH`", which does not say whether the check is static (by declared input type) or at evaluation (by supplied value), nor whether a `decimal` input's string form is matchable. Not asserted; the implementer chooses a fail-closed behavior (a typed `TYPE_MISMATCH` at the earliest point) and documents it in `HANDOFF.md`.

## 5. Foreman decisions on D-01..D-08

Pending. The Foreman records each as an errata entry (or defers it to a named phase) before the blocked assertions are implemented; this section is then updated by the Foreman, not by the planner.

## Foreman decisions on D-01..D-08 (2026-10-10)

All decided by errata **E-0022** (amends E-0019 for top-level `when: {}`): D-01 opt 1; D-02 opt 3; D-03 opt 1; D-04 division removed from P011 (P012); D-05 opt 1 with the specifics in E-0022; D-06 opt 1; D-07 opt 2; D-08 top-level `{}` = unconditional non-default row. P-01..P-09 accepted.
