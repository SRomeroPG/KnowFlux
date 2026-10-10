# P012 - Spec triage and decisions

Base: `46295d172d10de87c99ca9d3f3b3a26375118e04` (errata E-0030..E-0033 are committed in it). Line numbers refer to `knowledge-framework-spec-v2.1.md` (2234 lines) and were checked with `sed -n`/`grep -n`. P002 is active on disjoint paths and is ignored here.

## 1. Items decided by the Foreman (from `kf-spec-triage`)

| Item | Question | Decision | Settling clause / entry |
|---|---|---|---|
| T-01 | What "combine dimensions" means for `multiply`/`divide` when `units.yaml` gives each unit an opaque `dimension` | `DECIDED -> E-0030` | l.661 "`multiply`, `divide`: el resultado combina dimensiones. Si la dimensión resultante no existe en `units.yaml` → `KF-E-316`." Every value carries a unit monomial (unit id -> non-zero integer exponent); the result of `multiply`/`divide` is admissible only if the monomial is empty or exactly one registered unit id with exponent 1; anything else is `KF-E-316` on that node (E-0030 (1), (3)). |
| T-02 | Typing of `ref` operands when a formula declares no inputs | `DECIDED -> E-0031 (1)` | l.641-652 example has refs without type. Check and evaluate take a caller-supplied `inputs` list (same shape as decision-table `inputs[]`); refs and guard keys bind by the E-0019 rule; only `quantity` and `decimal` inputs may be expression operands (`TYPE_MISMATCH`). |
| T-03 | What proves a division protected (`KF-E-313`) without a solver | `DECIDED -> E-0032 (4)` | l.585 "División por cero → `KF-E-313` en validación, o el `guard` declarado en tiempo de evaluación."; l.634 "Nada de SAT solver disfrazado de Knowledge Framework." Syntactic, per-field proof (a) nonzero constant divisor, (b) guard on a bare-ref divisor, (c) `if` condition; constant zero never protected; everything else `KF-E-313`. Two sub-points are open: D-02 (closed list or semantic criterion) and the cascade of D-01 (not 313). |
| T-04 | Where `rounding` applies and what `round` takes | `DECIDED -> E-0032 (1)` | l.584 "Sin declaración, no hay redondeo." Logic-level `rounding` is applied once to the final non-null result; `round` takes exactly one argument and applies the logic-level `rounding` there; `round` without a `rounding` block is `INVALID_EXPRESSION`. |
| T-05 | Inexact quotients | `DECIDED -> E-0032 (3)` | l.584 + l.1955 `decimal_precision: 28`. Exact quotient (terminating decimal of at most `precision` significant digits) is exact; inexact: rounded to `precision` significant digits with the declared mode when a `rounding` block exists (then rounded again at the end), else typed error `INEXACT_DIVISION`. `precision` is an explicit option, default 28. Open sub-point: D-03 (trailing zeros of integer quotients). |
| T-06 | Guard order and result | `DECIDED -> E-0031 (2)` | l.650-652 `guards: - when: ... raise: OUT-0011`. Document order, before the expression, first true guard ends evaluation with `{status: 'raised', outcome, value: null}`; `raise` checked only against its pattern. |
| T-07 | Is "unidad idéntica" by id or by dimension | `DECIDED -> E-0030 (2)` | l.660 "todos los operandos **SHALL** tener unidad idéntica" read with l.591 "Esto incluye pares matemáticamente convertibles": identity is by unit id, never by dimension; mismatch is `KF-E-310`. |
| T-08 | Operator arities | `DECIDED -> E-0033` | l.655 lists operators without arities. `subtract`/`divide` 2; `add`/`multiply`/`min`/`max` one or more (left fold); `abs`/`round` 1; `clamp` 3 `(x, lo, hi)`; anything else `INVALID_EXPRESSION`. |
| T-09 | Dimensionless values and `output.unit` | `DECIDED -> E-0030 (1), (4)` | l.662 "`const` sin unidad es adimensional."; l.663 "La unidad calculada **SHALL** coincidir con `output.unit` → `KF-E-310`." Dimensionless = empty monomial; a dimensionless result needs `output.unit` naming a registered unit whose `dimension` is the literal `dimensionless`. |
| T-10 | `null` operands in arithmetic | `DECIDED -> E-0031 (4)` | l.606 "`null` **SHALL** significar "ausente", nunca "cero" ni "falso"." An absent/`null` operand makes the arithmetic result `null` (`{status: 'ok', value: null}`); a `null` divisor gives `null`, not `KF-E-313`. |
| T-11 | Rounding modes and rendering | `DECIDED -> E-0032 (2)` | l.584 `rounding: {mode: half-even \| half-up \| down \| up, decimals: N}`. Modes defined; `decimals` non-negative integer, no cap; exactly `decimals` fraction digits, trailing zeros kept, negative zero renders non-negative. |
| T-12 | Size limits | `DECIDED -> E-0032 (6)` | No digit cap; expression nesting depth limit 1000 (`INVALID_EXPRESSION` beyond), same limit as P011 predicates. |
| T-13 | `if` laziness and static coverage | `DECIDED -> E-0031 (3)` | l.656 "`if` toma `{cond: predicate, then: expr, else: expr}`." Lazy evaluation of the selected branch; a `cond` comparing `null` is false (l.607) so `else` runs; static checks cover both branches. |
| T-14 | Which failures are `KF-` diagnostics and which are typed errors | `DECIDED -> E-0033` | l.1765-1771 catalog; E-0014/E-0022 D-01 for uncatalogued failures. Returned: `KF-E-310`, `313`, `314`, `315`, `316`. Thrown: `INVALID_EXPRESSION`, `INEXACT_DIVISION`, `DIVISION_BY_ZERO`, `INVALID_RANGE` and the P011 codes. `KF-E-311`/`312` never apply; `KF-E-010` never emitted. `logic-diagnostics.mjs` gains the `313` (remediation "añadir `guard`") and `316` rows (see P-02 for how). |
| T-15 | Whether the `OUT` entity named by `raise` exists | `DEFERRED -> phase P007` | Cross-entity reference integrity; E-0031 (2) "`raise` is checked only against its pattern; whether the `OUT` entity exists is P007." |
| T-16 | Static `KF-E-316` | `DECIDED -> E-0030 (3), (5)` | l.661 + l.1771 "Dimensión resultante inexistente en `units.yaml`"; every unit check is static, a function of the expression tree, the declared refs and the registry, and covers both branches of every `if`. |

Record-only discrepancies in the errata citations (no effect on the decisions): E-0030 cites "l.658-663" and "l.590"; the algebra bullets are at l.660-663 and "Esto incluye pares matemáticamente convertibles" is on l.591 (l.590 is blank). E-0031 cites "l.644-652" for the example; the fenced block is l.640-653 and the `logic:` mapping is l.641-652. The heading numbers and quoted text are binding (E-0008 (a) precedent). This plan uses the verified numbers.

## 2. New items found while planning

### NOT_AN_ISSUE (settled by a clause; recorded so the conformance engineer asserts them)

- **N-A. `cond: {}` of an `if`, and guard `when: {}`.** Both are `EMPTY_PREDICATE`. Guard: E-0031 (2) "an empty mapping is `EMPTY_PREDICATE`". `if.cond`: E-0019 "An empty predicate mapping `{}` is a typed error (`EMPTY_PREDICATE`)"; the E-0022 D-08 amendment is limited to "A rule whose top-level `when`" of a decision table, and a formula has no rule rows. `all: []`/`any: []` inside either: E-0022 D-03. Nested `{}` anywhere: E-0019.
- **N-B. Where `KF-E-314`/`KF-E-315` come from in a formula.** From predicates only (guards and `if.cond`): E-0033 "`KF-E-314` and `KF-E-315` (from predicates)", with the P011 semantics (E-0031 (1)).
- **N-C. Reuse of the unit rule for supplied values.** A supplied value is compared with the declared input type exactly as in P011 (E-0019, E-0025 (3), E-0027 (3)); `KF-E-310`/`KF-E-314` at evaluation (E-0031 (1) "including `KF-E-310/314/315`").
- **N-D. Unit of `abs` and `round`.** Keep the monomial: E-0030 (5).

### DECISION_NEEDED

None is resolved by the planner. Each lists what stays specified and what is blocked. Blocked parts are narrow; the rest of P012 proceeds. Until decided, the conformance engineer marks the affected assertion `pending-decision` (skipped with a named `test.todo`) and the implementer follows only behavior that is identical under every option.

#### D-01 - A node reported `KF-E-316`: what unit flows out of it, and does the output check still run

Context. E-0030 (3): the result of `multiply`/`divide` "is admissible only when its monomial is empty (dimensionless) or exactly one registered unit id with exponent 1. Any other result, such as `percent_mass²` or `ppm_mass/percent_mass`, has no unit in `units.yaml` and is `KF-E-316`, reported statically on that node." E-0030 (4): "If the computed monomial is `{u: 1}`, `output.unit` must equal `u`. If it is dimensionless, `output.unit` must name a registered unit whose `dimension` is the literal string `dimensionless`. Otherwise the result is `KF-E-310`." For `multiply(c, c)` at the root (monomial `{percent_mass: 2}`), (3) gives `KF-E-316` on the root and a literal reading of "Otherwise" in (4) also gives `KF-E-310` on `/output/unit`. The same question arises for the parents of a flagged node (an `add` with a flagged operand, a `multiply` that would cancel the exponent again).

Options.
1. A flagged node has no unit ("unknown"). A parent check that involves an unknown operand reports nothing further and the node above is unknown too; the output check is skipped when the root is unknown. One finding per defect, no cascade.
2. The inadmissible monomial keeps flowing. Parents compute with it (identity checks compare it, `multiply`/`divide` add exponents and report `KF-E-316` again on their own node if the result is still inadmissible), and the output check applies (4) literally, so a root `multiply(c, c)` reports `KF-E-316` at `/expression` and `KF-E-310` at `/output/unit`.
3. As option 2 for parents, but the output check is skipped when any `KF-E-316` was reported in the formula.

Blocked until decided: the complete diagnostic list of every case that contains a `KF-E-316` (F-U3, the `KF-E-316` row of F-K, S1b). The `KF-E-316` finding itself (code, pointer, fields) is asserted now and is the same under every option. Neutral: every formula with no `KF-E-316`.

#### D-02 - Which divisor guards and `if` conditions prove a division protected: the listed forms only, or the semantic criterion

Context. E-0032 (4): "(b) its divisor is a bare `ref` R, and some guard's `when` is a single matcher on R that is true whenever R equals zero: `eq`/literal `"0"` (or the zero quantity in R's unit), `in` containing it, `lte`/`gte`/`between` whose range contains 0, or `is_null` combined in an `any` with one of those; (c) the node lies in the `then` branch of an `if` whose `cond` is a single matcher on R that is false whenever R equals zero (`ne "0"`, `gt "0"`, `lt "0"`, `not_in` containing `"0"`), or in the `else` branch of an `if` whose `cond` is true whenever R equals zero. ... Every other divisor ... is unprotected, which is `KF-E-313` (fail closed, no solver)." The headline phrase ("true/false whenever R equals zero") is a semantic criterion; the colon lists specific forms. Sound forms that are not in the list exist: `lt "1"` or `ne "5"` or `is_null: false` as a guard (true at zero), `gt "1"` or `gte "1"` or `lte "-1"` as a then-branch `cond` (false at zero).

Options.
1. Closed list. Only the forms enumerated are protective (operands compared with zero by numeric value; for the else-branch of (c) the family of (b) applies, including the `any` with `is_null`). Every other single matcher, however sound, is unprotected (`KF-E-313`).
2. Semantic criterion. A single matcher on R (and the `any` of (b) built from such matchers and `is_null: true`) is protective when evaluating it at R = zero (the zero decimal, or the zero quantity in R's unit, non-null) gives `true` for a guard / else-branch condition or `false` for a then-branch condition. This accepts every listed form and the sound extras above.

Blocked until decided: the rows marked "pending (D-02)" in F-Z (the sound extras). Asserted now under both options: every listed accepted form, and every near-miss that is unsound or not a single matcher (`gt "0"` as a guard, `ne "0"` as a guard, `lte "-1"`, `between ["1","5"]`, `in` without zero, two-key conjunctions, compound divisors, constant zero, wrong `if` branch, a guard on another field).

#### D-03 - "At most `precision` significant digits": are the trailing zeros of an integer quotient significant

Context. E-0032 (3): "An exact quotient (a terminating decimal of at most `precision` significant digits) is returned exactly." For `10^32 / 1` with `precision` 28: the coefficient with trailing zeros removed is `1` (1 digit) but the integer has 33 digits.

Options.
1. Significant digits are counted on the coefficient with trailing zeros removed (so `10^32` has 1 and is exact).
2. Significant digits are counted on the digits of the number as written (all integer digits, fraction digits without trailing zeros), so an integer quotient with more than `precision` digits is inexact even if it ends in zeros.

Blocked until decided: the single case F-V9 (`divide(10^32, 1)` with no `rounding` block: option 1 returns the value, option 2 is `INEXACT_DIVISION`). With a `rounding` block both options give the same value. Everything else, including the 28/29-digit boundary of F-V6, is neutral.

## 3. Planner API choices (not ambiguities; listed so the Foreman can veto at plan review)

Reversible choices with no persisted format. They shape the interface where the errata decide semantics but not the shape.

- **P-01. Module layout.** New: `framework/engine/formula.mjs` (`checkFormula`, `evaluateFormula`) and `framework/engine/decimal-ops.mjs` (`absDecimal`, `roundDecimal`, `roundDecimalSignificant`, `divideDecimal`, `formatDecimalFixed`). `decimal.mjs`, `units.mjs` and `regex-re2.mjs` are **not modified**: `test/p011-decimal.test.mjs:97-103` asserts the exact export list of `decimal.mjs`, and a new module can build branded Decimals through the public `parseDecimal` (a Decimal's `unscaled`/`scale` are public, E-0017). Additive-only edits (no deleted or changed line, `git diff --numstat` shows `0` deletions) are authorized in `decision-table.mjs` (four appended exports, see "Public engine API contract"), `logic-diagnostics.mjs` and `logic-errors.mjs` (P-02).
- **P-02. How `logic-diagnostics.mjs` "gains the catalog rows" (E-0033) without changing a P011 test.** `LOGIC_DIAGNOSTIC_CATALOG` stays exactly the five P011 rows, because four P011 assertions pin it: `test/p011-decision-table.test.mjs:852-861` (keys exactly `310, 311, 312, 314, 315`; `'KF-E-313' in` and `'KF-E-316' in` are `false`), `test/conformance-p011-decision-table.test.mjs:1550-1559` (F-S5a, same keys). Likewise `LOGIC_ERROR_CODES` stays the 14 P011 codes because `test/p011-decision-table.test.mjs:867-868` and `test/conformance-p011-decision-table.test.mjs:244-258` (F-E1) assert `DIVISION_BY_ZERO` absent. So the module gains **appended** exports: `FORMULA_DIAGNOSTIC_CATALOG` (`KF-E-313` with remediation `añadir \`guard\``, `KF-E-316` without) and `makeFormulaDiagnostic` in `logic-diagnostics.mjs`; `FORMULA_ERROR_CODES` (`DIVISION_BY_ZERO`, `INEXACT_DIVISION`, `INVALID_EXPRESSION`, ascending) in `logic-errors.mjs`. `LogicError` does not validate its code, so nothing else changes. Alternative if the Foreman prefers a single catalog: extend the two existing constants in place and amend the assertions named above (a P011 test change under a P012 brief; P007 re-sources the catalog anyway, P-09 of P011). The plan assumes the appended exports.
- **P-03. Result shape of `evaluateFormula`.** `{status: 'ok' | 'raised' | 'error', value, outcome, guard_index, diagnostics}`. `ok`: `value` is `{value: <decimal string>, unit: <output.unit>}` or `null`; `outcome` and `guard_index` `null`; `diagnostics` `[]`. `raised` (E-0031 (2)): `value: null`, `outcome` the `OUT` id, `guard_index` the index of the first true guard, `diagnostics: []`. `error`: `value: null`, `outcome: null`, `guard_index: null`, `diagnostics` non-empty and sorted. `checkFormula` returns the sorted `Diagnostic[]` (`[]` when clean).
- **P-04. A formula value is a quantity-shaped mapping** `{value, unit}` (the `quantity` of l.629), not a bare string, because `output.unit` is required by the accepted schema and E-0030 (4) ties the result to it.
- **P-05. Rendering without a `rounding` block** is `formatDecimal` (canonical minimal form, P-07 of P011). With a `rounding` block the final value is rendered by `formatDecimalFixed` (exactly `decimals` fraction digits, E-0032 (2)).
- **P-06. Diagnostic fields of the formula findings** (message text is free and never asserted; the fields below are). All carry `severity: 'E'`, `rule: null`, `rule_index: null`. `KF-E-310` adds `source` ∈ `expression` (operand identity), `output` (output check), `literal`, `value` (P011 sources), `expected_unit`, `found_unit` (unit text below). `KF-E-313` adds `reason` ∈ `zero_constant` \| `unprotected`, `input` (ref of a bare-ref divisor, else `null`), `remediation`. `KF-E-316` adds `unit` (the inadmissible monomial as unit text) and `operation` (`multiply` \| `divide`). `KF-E-314`/`KF-E-315` carry the P011 fields. **Unit text** of a monomial: factors sorted by unit id in UTF-8 byte order, each `<id>` for exponent 1 or `<id>^<exponent>` otherwise (negative exponents with `-`), joined by `*`; the empty monomial is `null`. Pointers are RFC 6901 into `logic` (expression `/expression`, `/expression/args/<i>`, `/expression/cond|then|else`; guards `/guards/<i>/when/...`; output `/output/unit`), except supplied-value findings, which point to `/inputs/<i>` of `options.inputs` as in P011.
- **P-07. Order of work in `evaluateFormula`** mirrors P011 (P-03, P-04): option and structure validation (typed errors, same as `checkFormula`); static findings (`KF-E-310/313/314/315/316`) -> `status: 'error'`, nothing evaluated; supplied keys bound and every supplied value typed in `inputs[]` order (`KF-E-310`/`KF-E-314` at evaluation -> `status: 'error'`); guards; expression; final rounding.
- **P-08. Options.** `unitRegistry` must be a registry built by `buildUnitRegistry`, `inputs` must be an array, `precision` (optional) an integer `>= 1`, `values` a mapping; otherwise `INVALID_ARGUMENT` (P-05 of P011). `precision` is validated by `checkFormula` too although it cannot change static diagnostics. Default `DEFAULT_PRECISION = 28`.
- **P-09. Reuse of the P011 predicate machinery** through four appended exports of `decision-table.mjs`: `compileLogicInputs`, `compileLogicPredicate`, `typeLogicValues`, `evaluateLogicPredicate`. They wrap the existing private functions without editing them; `INVALID_TABLE` raised inside them is re-thrown as `INVALID_EXPRESSION` (E-0033); predicate findings carry `rule: null`, `rule_index: null`. Internal shapes are opaque to callers.
- **P-10. `raise` pattern** is the one of the accepted schema (`framework/schemas/logic.schema.json` l.70): `^OUT-[0-9]{4,}$`, ASCII digits, whole string. Checked by hand-written code (no host `RegExp`), like the decimal lexer.
- **P-11. `evaluateFormula` evaluates operands left to right** and folds `add`, `multiply`, `min`, `max` left; the observable consequence is only which runtime defect surfaces first when several exist, which is not asserted (N-03).

## 4. Noted, not asserted

Deliberately outside every V-nn. No decision needed unless the Foreman wants one; the implementer chooses a fail-closed behavior and documents it in `HANDOFF.md`.

- N-01. Cascades after a unit mismatch that is not `KF-E-316`: the result unit of an `add`-family node with a mismatch is the first operand's (reference) monomial; further consequences of a mismatch are not asserted beyond "independent defects at independent nodes are all reported".
- N-02. Several simultaneous typed-error defects: only single-defect formulas are asserted (P011 N-04).
- N-03. Which runtime defect surfaces first when several occur (for example `clamp` with `lo > hi` while another operand is `null`).
- N-04. Static detection of a constant `clamp` with `lo > hi` or of a constant divisor expression that is inexact: only runtime (`INVALID_RANGE`, `INEXACT_DIVISION`) is asserted.
- N-05. Unknown extra keys in `logic`, in `output`, in `rounding`, in a `const`/`ref` node, in a guard: fail closed with `INVALID_EXPRESSION` is recommended, but only the cases listed in F-X are asserted.
- N-06. Defects inside the entries of `options.inputs` other than `UNSUPPORTED_INPUT_TYPE`, `INVALID_INPUT_DECLARATION`, `UNKNOWN_UNIT` (P011 asserts these three); the malformed-entry code (`INVALID_TABLE` in P011, `INVALID_EXPRESSION` after the P-09 translation, or `INVALID_ARGUMENT`) is not asserted.
- N-07. The exact depth boundary (1000 versus 1001 nested nodes): asserted at 500 (accepted) and 1100 (`INVALID_EXPRESSION`), no stack overflow in either; P011 allows depth 1000 for predicates (`depth > 1000` fails).
- N-08. A `decimals` or `precision` so large that the result cannot be allocated: the implementer must not crash the process with an untyped error; the code used is documented.
- N-09. `output.ref` content (only "non-empty string" is asserted); `OUT` entity existence (P007); whether `output.ref` names a real `DE` field (P007).
- N-10. Equal-valued results of `min`/`max` that differ in scale: indistinguishable after P-05 rendering.
- N-11. Performance: no target beyond completing the depth and large-decimal cases in the 5 s bound used by P011.

## 5. Foreman decisions on D-01..D-03

Pending. The Foreman records each as an errata entry (or defers it to a named phase) before the blocked assertions are implemented; this section is then updated by the Foreman, not by the planner. P-01..P-11 are accepted unless vetoed at plan review (P-02 is the one that may deserve a look).

## Foreman decisions on D-01..D-03 (2026-10-10)

Decided by errata **E-0036**: D-01 option 1; D-02 option 2 (semantic criterion); D-03 option 1. P-01..P-11 accepted, including P-02 (additive-only extension of P011 modules). Errata citation slips noted in this file were corrected in E-0030/E-0031.
