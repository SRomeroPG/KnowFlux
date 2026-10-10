# KnowFlux scoreboard

The real progress metric. Phase status in `STATE.yaml` says what was audited; this file says what is observably runnable against the frozen spec. Conformance is defined in spec §55 (line 2075): "Una implementación es conforme si y solo si reproduce `conformance/expected/`".

## 1. Spec §55 conformance lines (`conformance/expected/`)

Reproducible: 0/14

Status values: `NOT_RUNNABLE` (command does not exist), `FAILING` (runs, output differs), `REPRODUCED` (exact expected output, with executable evidence).

| # | Expected command | Expected output (verbatim, spec lines 2084-2100) | Status |
|---|---|---|---|
| 1 | `kf validate` | exit 0, 0 errores, 4 warnings esperados | NOT_RUNNABLE |
| 2 | `kf validate --strict` | exit 2 | NOT_RUNNABLE |
| 3 | `kf check-rules` | exit 0, 24/24 consistentes contra su faceta | NOT_RUNNABLE |
| 4 | `kf verify` | 11 fresh, 1 stale, 1 broken, 1 unverifiable | NOT_RUNNABLE |
| 5 | `kf build` | deriva exactamente 2 DIV: DIV-0001 behavioral-divergence (scenario-differential); DIV-0002 structural-difference (path-diff) | NOT_RUNNABLE |
| 6 | `kf context BR-0002 --budget 4000` | KF-E-500, required_minimum_budget: 5200 | NOT_RUNNABLE |
| 7 | `kf context BR-0002 --budget 6000` | incluye DIV-0001, DSP-0001, UNK-0002 sin truncar | NOT_RUNNABLE |
| 8 | `kf impact BR-0002#specified` | 3 directos, 7 indirectos, 4 PROVEN_UNAFFECTED, 5 NO_IMPACT_PATH_FOUND | NOT_RUNNABLE |
| 9 | `kf diff BR-0002#specified@1 @2` | UNCHANGED ≥5 entradas, toda negativa etiquetada | NOT_RUNNABLE |
| 10 | `kf release --dry-run` | 2027.02.1 | NOT_RUNNABLE |
| 11 | `kf questions --top 3` | UNK-0002 primero (prioridad 9.6) | NOT_RUNNABLE |
| 12 | `kf questions --promotions` | 2 candidatos | NOT_RUNNABLE |
| 13 | `kf golden run` | 1 intentional-change, 0 regressions | NOT_RUNNABLE |
| 14 | `kf build --check` | exit 0 | NOT_RUNNABLE |

Note: the fixture at `framework/conformance/acme-formulation/` is partial (P001 slice). Lines are `REPRODUCED` only against the complete §55 fixture; `DIV` files are never hand-written.

## 2. Spec §56 Milestone 1 items

Status values: `NOT_STARTED`, `PARTIAL` (some slice accepted, item not demonstrable end to end), `DONE` (demonstrable by executable evidence).

| # | Item (verbatim, spec lines 2107-2122) | Status |
|---|---|---|
| 1 | Inicializar un Knowledge Project (greenfield sin facetas visibles) | NOT_STARTED (no `kf init` exists; planned in P028) |
| 2 | Crear entidades con IDs asignados por el engine y semántica provisional/permanent | NOT_STARTED |
| 3 | Validar schemas, referencias, relaciones tipadas y ownership de aristas | NOT_STARTED |
| 4 | Registrar evidencia con anclas verificables por resolver genérico y detectar drift | NOT_STARTED |
| 5 | Derivar confianza por faceta según clase de evidencia | NOT_STARTED |
| 6 | Crear unknowns y priorizar la cola de SMEs con sus cinco fuentes | NOT_STARTED |
| 7 | Expresar `logic` en las tres gramáticas evaluables y verificarlo contra escenarios facetados | NOT_STARTED |
| 8 | Derivar divergencias con clave estable y disposition preservada | NOT_STARTED |
| 9 | Generar `graph.json` con facetas | NOT_STARTED |
| 10 | Servir context packs con safe context garantizado | NOT_STARTED |
| 11 | Impact analysis con aserciones negativas etiquetadas | NOT_STARTED |
| 12 | Registrar CHG sobre facetas specified y derivar revisión y release CalVer | NOT_STARTED |
| 13 | Generar semantic diff con UNCHANGED | NOT_STARTED |
| 14 | Auditorías adversariales | NOT_STARTED |
| 15 | Operar vía agentes con permisos disjuntos por faceta y progressive disclosure | NOT_STARTED |
| 16 | Funcionar en workspace multi-repo con `pr-check` y artefacto de `ack` | NOT_STARTED |

## 3. Phases accepted

1/28 (P001).

## 4. How the Foreman updates this file

- Update only after a phase transitions to `ACCEPTED`, in the same commit as the `STATE.yaml` change.
- Change a row only with executable evidence: the exact command, its observed output, and the product commit it ran against, recorded in the accepted audit file. A passing unit test without the §55 command or §56 behavior it demonstrates is not evidence.
- Recompute the counts in Sections 1 and 3 from the table rows. Never raise a count by editing the header alone.
- A row moves backward (to `FAILING` or `PARTIAL`) as soon as a later phase breaks it; record the regression in the audit that found it.
- Never edit expected outputs to match implementation output. Section 1 text is copied from the frozen spec.
