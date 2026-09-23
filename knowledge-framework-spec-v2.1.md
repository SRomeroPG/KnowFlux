# Knowledge Framework — Core Specification v2.1

> **Estado:** CONGELADA — primera especificación implementable
> **Reemplaza:** v2.0 (draft normativo) y v0.1 (obsoleta)
> **Naturaleza de este documento:** consistency pass. No introduce visión nueva; elimina contradicciones internas hasta que cada `SHALL` pueda convertirse en un test.

---

## 0. Cómo leer esta especificación

### 0.1 Lenguaje normativo

RFC 2119 en inglés, embebido en prosa española: **SHALL / SHALL NOT** (obligatorio; violarlo es no conformidad), **SHOULD / SHOULD NOT** (recomendado; desviarse requiere justificación registrada), **MAY** (opcional).

Identificadores, nombres de campo, estados, códigos y comandos **SHALL** escribirse en inglés. El texto libre puede estar en cualquier idioma.

### 0.2 Principio rector

> **Deriva, no dupliques. Cada hecho tiene exactamente un escritor; todo lo demás se calcula.**

| Hecho | Único escritor | Derivado por |
|---|---|---|
| Faceta `specified` (contenido) | Registro `CHG` | — (autorado vía workflow de cambio) |
| Faceta `observed` (contenido) | Evidencia / discovery | — (autorado por Archaeologist) |
| `version` de una faceta specified | Ledger de `CHG` | Engine |
| `computed_confidence` | Evidencia de la faceta + política | Engine (§14) |
| Sección `detected` de un `DIV` | Comparación de facetas | Engine (§19) |
| Aristas inversas (`executed_by`, …) | La arista autorada opuesta | Engine (§7.2) |
| Knowledge release | Ledger de `CHG` + fecha | Engine (§23) |
| Transaction time | Primera aparición en branch canónico | Git |
| Prosa de comportamiento y ejemplos | `logic` + escenarios | Renderizador (§11.2) |
| `hint_lines` de una evidencia | Resolver de anclas | Engine (§13.4) |
| `graph.json`, índices, lineage, coverage, portal | Artefactos autorados | `kf build` |

Si un dato aparece escrito a mano en dos sitios, es un bug de esta spec y **SHALL** reportarse como tal.

### 0.3 Principio estructural de v2.1

> **Una entidad de conocimiento es una identidad que porta facetas. La identidad es la cosa; las facetas son lo que se sabe o se quiere de ella.**

Este cambio resuelve la contradicción central de v2.0, que obligaba a elegir entre representar lo que un sistema hace y lo que debería hacer, pero no ambas cosas simultáneamente con estructura evaluable.

### 0.4 Cambios respecto de v2.0

| # | Contradicción o hueco en v2.0 | Resolución en v2.1 | § |
|---|---|---|---|
| 1 | `truth_state` como campo escalar vs. `DIV` con observed/specified como texto libre | Modelo de facetas; `DIV` derivado-gestionado | §10, §19 |
| 2 | Inversas derivadas apareciendo en YAML autorado | Ownership canónico de aristas + `KF-E-105` | §7.2 |
| 3 | `confidence` "nunca escrito" pero con `pinned` editable | `computed_confidence` + `override`; `effective_confidence` derivado | §14.3 |
| 4 | Golden master elevando confianza de lo especificado | Clases de evidencia: observacional vs. especificadora; política por clase de faceta | §13.2, §14.2 |
| 5 | Nivel de confianza `observed` colisionando con faceta `observed` | Escalera renombrada: `unknown / inferred / supported / corroborated / confirmed` | §14.1 |
| 6 | Normalización y dedup dependientes de herramientas disponibles | `kf-normalize-v1` 100 % determinista; embeddings solo advisory | §6.2 |
| 7 | `recorded_at` duplicando transaction time | `decided_at` (hecho de negocio) + transaction time = primer commit canónico; no-rewrite | §17 |
| 8 | Catálogo de errores sin columna de remediación | Columna `remediation` obligatoria; los diagnostics se generan del catálogo | §44.2 |
| 9 | `logic.kind` con cuatro valores y gramática solo para uno | Gramáticas cerradas de `formula` y `state-machine`; semántica numérica y de unidades fijada | §10.5–§10.8 |
| 10 | "UNCHANGED" y "unaffected" usados como sinónimos | Tres niveles de aserción negativa, etiquetados en toda salida | §22.2 |
| 11 | IDs "permanentes" renumerables al hacer merge | Un ID es permanente solo tras su primera aparición canónica; `provisional` antes | §8.2 |
| 12 | SemVer del KB produciendo MAJOR constante sin significado operativo | CalVer por defecto para knowledge release; SemVer para el framework; revisión entera para entidades | §23 |
| 13 | Todo `generated/` versionado obligatoriamente | Política configurable: `commit` / `cache` / `artifact` | §9.2 |
| 14 | `kf verify` especificado solo para `source-code` | Contrato genérico `EvidenceResolver` + tabla de normalización por tipo | §13.5 |
| 15 | Dedup solo en `kf create` | Dedup en `create`, `change`, `update` y `validate` | §6.2 |
| 16 | `kf ack` sin artefacto definido | Artefacto operacional append-only en `.kf/acknowledgements/` | §28.2 |
| 17 | Context pack: invariante de no-truncado sin rama de fallo | `KF-E-500` con `required_minimum_budget` | §41.2 |
| 18 | `min_scenarios_narrative_rule` como falso rigor | `verification.mode` obligatorio en reglas narrativas; escenarios no elevan confianza automáticamente | §25.4 |
| 19 | `approved` como tercer estado de verdad | Eliminado; es una faceta specified futura aprobada vía CHG | §18.3 |

---

# PARTE I — FUNDAMENTOS

## 1. Propósito

El Knowledge Framework es una infraestructura de ingeniería de conocimiento que representa de forma explícita, versionada, verificable y machine-readable el conocimiento de negocio de un producto o sistema, y lo conecta con su evidencia, su implementación, sus pruebas y su historia de cambios.

**SHALL** ser reutilizable entre proyectos y **SHALL NOT** acoplarse a un lenguaje, framework técnico, empresa, dominio, arquitectura o sistema legacy concreto.

**No es:** generador de documentación, wiki, chatbot RAG, herramienta de análisis de código, reemplazo de Jira/ADO, reemplazo de BMAD.

**Es:**

> Un framework reusable y agent-first de ingeniería de conocimiento que formaliza el conocimiento de negocio y de sistema, conecta evidencia, requisitos, implementación y pruebas, gestiona el cambio en el tiempo, y provee a los agentes de IA contexto fiable y direccionable durante todo el ciclo de vida del software.

## 2. Principios fundacionales

**P1. Knowledge is the product.**
**P2. Evidence over inference.** Toda afirmación relevante **SHALL** poder explicar origen, evidencia, confianza, momento de observación y revisión observada.
**P3. Structure without sacrificing meaning.** YAML para estructura, Markdown para el porqué, con el contrato de corte de §11.
**P4. Agents operate knowledge; they do not own it.**
**P5. Agents reason; deterministic systems enforce.**
**P6. Powerful by design, incremental by adoption.** Un proyecto greenfield **SHALL** poder operar sin escribir nunca la palabra "faceta" (§10.3).
**P7. Human-compatible workflow.**
**P8. Knowledge does not bend to tickets.**
**P9. Knowledge boundaries follow business domains.**
**P10. Access is not context.**
**P11. Derive, don't duplicate.** (§0.2)
**P12. Degradation is explicit.** Ninguna pérdida de vigencia **SHALL** ocurrir en silencio.
**P13. The cheapest correct path wins.** Toda detección de drift **SHALL** ir acompañada de una remediación de un solo comando.
**P14 (nuevo). Never claim more certainty than you hold.** Toda aserción negativa **SHALL** declarar su nivel de prueba (§22.2). Toda salida **SHALL** llevar cabecera epistémica.

## 3. Framework, Knowledge Project, Workspace

**Framework** — reusable, sin conocimiento de dominio: metamodel, schemas, agents, workflows, templates, CLI, validation, generators, adapters, katas, conformance fixture.

**Knowledge Project** — instancia aplicada a un dominio.

**Workspace** — agrupa el Knowledge Project y los repositorios técnicos. Los agentes multi-repo **SHALL** iniciarse a nivel de workspace.

### 3.1 Principios formales

> «Knowledge SHALL remain logically independent from implementation. Implementations MAY embed knowledge for small projects. Enterprise systems SHOULD use a dedicated Knowledge Repository colocated with implementation repositories inside a shared agent workspace. Agents SHOULD operate from workspace scope when a task spans multiple repositories.»

> «Source repositories SHALL NOT be copied into the Knowledge Repository for analysis. They SHALL be registered as workspace sources and referenced through repository identity, path and revision.»

### 3.2 `workspace.yaml`

```yaml
schema_version: 2.1
workspace: {name: formulation-platform}
knowledge: {path: ./formulation-knowledge}

repositories:
  - id: legacy-app
    path: ./legacy-app
    role: existing-system
    vcs: git
    canonical_branch: main
    languages: [java]
  - id: backend
    path: ./formulation-backend
    role: implementation
    canonical_branch: main
    languages: [java]

environments:
  - id: production
    describes: {repository: legacy-app, region: eu-west}
```

`role` ∈ `existing-system | implementation | frontend | backend | integration | data | reference | test | infrastructure`, extensible vía config.

`repositories[].id` y `environments[].id` **SHALL** ser estables y permanentes: son claves de anclaje de evidencia y de `target` de facetas observadas.

---

# PARTE II — METAMODELO

## 4. Catálogo de tipos

### 4.1 Core

| Prefijo | Tipo | Facetado | Definición |
|---|---|---|---|
| `CAP` | Capability | no | Algo que el negocio es capaz de hacer; agrupa procesos. |
| `BP` | BusinessProcess | **sí** | Secuencia con disparador que produce un resultado. |
| `BR` | BusinessRule | **sí** | Afirmación evaluable sobre entradas que produce una determinación. |
| `DE` | DataEntity | **sí** | Sustantivo del negocio con atributos que persisten o viajan. |
| `OUT` | Outcome | no | Resultado observable y nombrado. |
| `SC` | Scenario | no | Caso concreto con valores concretos y resultado esperado. |
| `EV` | Evidence | no | Observación respaldatoria anclada a fuente y revisión. |
| `UNK` | Unknown | no | Hueco de conocimiento declarado. |
| `CHG` | Change | no | Registro de evolución de una faceta specified. |
| `DIV` | Divergence | no | Discrepancia entre facetas. **Derivado-gestionado.** |
| `DSP` | Dispute | no | Desacuerdo abierto sobre una entidad o faceta. |

### 4.2 Extendido (opt-in por módulo)

`ACT` Actor · `INT` Integration · `ST` State · `EVT` Event · `POL` Policy.

### 4.3 Tipos que NO existen

`DEC` y `CON` **SHALL NOT** ser tipos: son `rule_kind` de `BR` (`invariant | decision | derivation | eligibility | authorization`).

Criterio normativo de promoción a tipo: solo **SHALL** promoverse aquello que tenga ciclo de vida propio, propietario propio y conjunto de relaciones propio. `POL` lo cumple; `DEC` y `CON` no.

## 5. Procedimiento de decisión de clasificación

Obligatorio para todo agente y curador. Detenerse en la primera coincidencia.

```
1. ¿Secuencia temporal, disparador, produce un resultado?            → BP
2. ¿Afirmación evaluable sobre entradas que produce una
   determinación, sin mencionar pantallas, pasos ni orden?           → BR (elegir rule_kind)
3. ¿Sustantivo del negocio con atributos que persisten o viajan?     → DE
4. ¿Elección configurable que negocio puede cambiar sin que
   cambie la regla que la consume?                                   → POL
5. ¿Caso concreto, con valores concretos y resultado esperado?       → SC
6. ¿Agrupador de procesos que el negocio nombraría como
   "algo que sabemos hacer"?                                         → CAP
7. ¿Dudas entre dos tipos? NO falta un tipo: estás mezclando
   dos cosas. Sepáralas y repite.
```

### 5.1 Granularidad

> **Una `BR` por razón de cambio.**

Test: *¿podrían estas dos partes cambiar por separado, por motivos de negocio distintos?* Sí → dos reglas.

- Una `BR` **SHALL NOT** tener más de una `determination`.
- Una faceta cuyo `logic` requiera más de una tabla de decisión **SHOULD** dividirse.
- Dos `BR` que siempre cambian juntas y por el mismo motivo **SHOULD** fusionarse (`CHG type: MERGE`).

## 6. Identidad y deduplicación

### 6.1 La identidad es lo que no depende de faceta

```yaml
identity:
  rule_kind: invariant
  subject: formulation concentration
  determination: whether a formulation is within the permitted concentration limit
  governs: [DE-0017.concentration]
  produces: [OUT-0004, OUT-0009]
```

La firma canónica se calcula **sobre la identidad, nunca sobre una faceta**. Consecuencia deliberada: si legacy y el backend nuevo calculan umbrales distintos, siguen siendo *la misma regla*, observada de forma distinta. Dedup y faceting no interactúan.

### 6.2 `kf-normalize-v1` — determinismo total

```
signature = sha256(
    normalize(subject) ‖ "|" ‖
    normalize(determination) ‖ "|" ‖
    sorted(governs) ‖ "|" ‖
    rule_kind
)
```

`kf-normalize-v1` **SHALL** consistir exclusivamente en, y en este orden:

1. Normalización Unicode NFKC.
2. Minúsculas (`toLowerCase` invariante de locale).
3. Sustitución de sinónimos por el término canónico de `glossary.yaml` (tabla explícita, versionada en el repo).
4. Eliminación de stopwords de la lista **distribuida con el framework** para el idioma declarado en `project.language`. La lista **SHALL** versionarse con el algoritmo; nunca provenir de una librería instalada.
5. Colapso de whitespace a un espacio simple; trim.
6. Eliminación de puntuación ASCII salvo `-` interno.

**SHALL NOT** incluir lematización, stemming, ni ninguna operación que dependa de una herramienta instalada en la máquina. Cualquier evolución **SHALL** publicarse como `kf-normalize-v2` y coexistir; la firma persistida declara su algoritmo:

```yaml
signature: {algorithm: kf-normalize-v1, value: 9f3a1c...}
```

**Gate obligatorio (determinista):** colisión exacta de firma → `KF-E-201`, creación rechazada. Similitud trigram sobre la cadena normalizada ≥ `dedup.trigram_threshold` (default `0.82`) → exige `distinct_because:` antes de permitir la creación.

**Advisory (no determinista):** si hay embeddings disponibles, la similitud semántica **MAY** reportarse como `KF-W-202`. **SHALL NOT** bloquear nunca una creación. Una operación válida en una máquina **SHALL** ser válida en todas.

**Momento de ejecución:** el gate **SHALL** correr en `kf create`, `kf change`, `kf update` y `kf validate`. Editar `subject` o `determination` recalcula la firma y puede colisionar; detectarlo solo en `create` fue un hueco de v2.0.

## 7. Relaciones

### 7.1 Catálogo

| Arista autorada | Origen | Destino | Card. | Inversa derivada |
|---|---|---|---|---|
| `part_of` | BP | CAP | 1..1 | `contains` |
| `executes` | BP‡ | BR | 0..n | `executed_by` |
| `reads` | BP‡ | DE | 0..n | `read_by` |
| `writes` | BP‡ | DE | 0..n | `written_by` |
| `produces` | BP‡, BR | OUT | 0..n | `produced_by` |
| `calls` | BP‡ | INT | 0..n | `called_by` |
| `triggered_by` | BP‡ | EVT | 0..n | `triggers` |
| `performed_by` | BP‡ | ACT | 0..n | `performs` |
| `transitions` | BP‡ | ST | 0..n | `transitioned_by` |
| `governs` | BR | DE, DE.field | 1..n | `governed_by` |
| `overrides` | POL | BR | 1..n | `overridden_by` |
| `contains` | DE | DE | 0..n | `part_of_entity` |
| `exercises` | SC | BR | 0..n | `exercised_by` |
| `covers` | SC | BP | 0..n | `covered_by` |
| `supports` | EV | faceta | 1..n | `supported_by` |
| `blocks` | UNK | * | 0..n | `blocked_by` |
| `affects` | CHG | faceta specified | 1..n | `affected_by` |
| `disputes` | DSP | entidad o faceta | 1..1 | `is_disputed` |

‡ Autorada **dentro de la faceta de BP correspondiente** (§10.4).

### 7.2 Ownership canónico (corrección de v2.1)

> **Cada arista tiene exactamente un owner. Una inversa derivada SHALL NOT aparecer nunca en YAML autorado.**

- **Autorable:** la columna izquierda de la tabla.
- **Prohibido en YAML:** `executed_by`, `supported_by`, `exercised_by`, `governed_by`, `produced_by`, `read_by`, `written_by`, `called_by`, `contains` (en CAP), `overridden_by`, `blocked_by`, `affected_by`, `is_disputed`.

Encontrar cualquiera de ellas en un archivo autorado → **`KF-E-105`**. Se resuelven en `graph.json`, en `kf context` y en el portal, donde son de solo lectura.

Corolario práctico: una `BR` **SHALL NOT** declarar `evidence:` ni `executed_by:`. La evidencia apunta a la faceta desde el `EV`; la ejecución la declara el `BP`.

### 7.3 Reglas de integridad

- **R1.** Toda faceta con `computed_confidence != unknown` **SHALL** tener ≥1 `supported_by`.
- **R2.** Toda `BR` **SHALL** declarar ≥1 `governs` en su identidad.
- **R3.** Toda faceta specified en `status: active` **SHALL** tener ≥ `governance.min_scenarios_per_rule` escenarios con `asserts.facet: specified` que la ejerciten.
- **R4.** `contains` sobre `DE` **SHALL NOT** formar ciclos.
- **R5.** Entidad sin aristas entrantes ni salientes → `KF-W-110`.
- **R6.** `overrides` **SHALL** declarar `scope`; dos `POL` **SHALL NOT** solaparse en scope sobre la misma `BR` sin `priority` explícita.
- **R7.** Dos facetas specified de la misma entidad **SHALL** tener claves disjuntas (§10.6).

## 8. Identificadores

Formato `<PREFIX>-<NNNN>`, zero-padded a 4, expandible sin romper IDs existentes. Únicos, no reutilizables, independientes del nombre.

### 8.1 Asignación

Los agentes **SHALL NOT** asignar IDs. El engine los asigna desde `.kf/id-registry.yaml` con lock transaccional.

### 8.2 Semántica en branches (corrección de v2.1)

> **«An ID is permanent only after its first appearance on the canonical branch.»**

```yaml
# en la entidad, hasta el merge
id_status: provisional | permanent
```

- En un branch no canónico, `kf create` asigna un ID y lo marca `provisional`.
- Al entrar al branch canónico, `kf validate` lo promueve a `permanent`.
- **Colisión al hacer merge:** solo es resoluble si **ambos** IDs en conflicto son `provisional`. El engine renumera el de `first_canonical_commit` posterior y registra `id_alias`.
- **Un ID `permanent` SHALL NOT ser renumerado jamás.** Colisión con un `permanent` → `KF-E-101`, resolución manual obligatoria.
- `id_alias` **SHALL** resolverse en todas las queries, indefinidamente.

---

# PARTE III — EL MODELO DE FACETAS

## 9. Layout de repositorio

```
knowledge-project/
├── knowledge.config.yaml
├── glossary.yaml
├── AGENTS.md                        # generado
│
├── knowledge/
│   ├── capabilities/CAP-0001/
│   ├── processes/BP-0012/
│   │   ├── process.yaml             # identidad + faceta specified
│   │   ├── description.md
│   │   └── observed/
│   │       └── legacy-app.yaml
│   ├── business-rules/BR-0037/
│   │   ├── rule.yaml                # identidad + faceta(s) specified
│   │   ├── description.md
│   │   ├── pending/v4.yaml          # faceta specified futura aprobada
│   │   └── observed/
│   │       ├── legacy-app.yaml
│   │       └── backend.yaml
│   ├── data/DE-0017/
│   ├── outcomes/ · scenarios/ · evidence/ · unknowns/ · disputes/
│
├── divergences/                     # DERIVADO-GESTIONADO
│   └── DIV-0007.yaml
├── changes/                         # AUTORADO, append-only
├── mappings/
├── golden-master/
├── work/
├── extensions/
├── generated/                       # GENERADO
└── .kf/
    ├── id-registry.yaml
    └── acknowledgements/
        └── backend/PR-4431.yaml
```

### 9.1 Autorado vs. generado vs. gestionado

| Clase | Ubicación | Regla |
|---|---|---|
| Autorado | `knowledge/`, `changes/`, `mappings/`, `work/`, `golden-master/cases/` | Editable por humanos y agentes |
| Derivado-gestionado | `divergences/` | El engine posee unas secciones, el humano otras (§19.3) |
| Generado | `generated/` | **SHALL NOT** editarse nunca a mano |
| Operacional | `.kf/` | Append-only, escrito solo por comandos |

### 9.2 Política de artefactos generados (corrección de v2.1)

v2.0 obligaba a versionar todo `generated/`, lo que a escala produce diffs enormes y conflictos de merge. v2.1 lo hace configurable:

```yaml
generated:
  commit:   [changelog, summaries]          # en Git; CI falla si desactualizado
  cache:    [graph, indexes, lineage, coverage]  # gitignored; se reconstruyen
  artifact: [portal]                         # publicado por CI, nunca en Git
```

`kf build --check` **SHALL** verificar únicamente el conjunto `commit` (`KF-E-601`). Los artefactos `cache` **SHALL** poder reconstruirse desde cero con `kf build` en un checkout limpio; si no, es un bug del engine.

Default del framework: el de arriba. Un proyecto pequeño **MAY** mover `graph` a `commit` para poder leer el KB sin ejecutar nada.

## 10. Anatomía de una entidad facetada

### 10.1 Estructura general

```
BR-0037  "Maximum Concentration Validation"
│
├── identity            subject, determination, governs, produces, rule_kind, signature
├── lifecycle           status
│
├── specified [1..n]    lo que el negocio quiere       ← escrito por CHG
│     clave: (scope, validity_window)
│     contiene: version, authority, logic, epistemic, verification
│
└── observed  [0..n]    lo que los sistemas hacen      ← escrito por evidencia/discovery
      clave: target
      contiene: as_of, observed_against, logic, epistemic
```

### 10.2 Reglas de escritura (corrección central)

> **`CHG` escribe `specified`. Evidencia y discovery escriben `observed`. Nunca al revés.**

- Un commit en legacy **SHALL NOT** producir un `CHG` de negocio. Produce una faceta observed nueva y, si discrepa, un `DIV`.
- Un cambio regulatorio **SHALL NOT** modificar una faceta observed. Produce un `CHG` sobre specified y, si el sistema aún no lo implementa, un `DIV`.
- Un agente que intente escribir una faceta observed desde un workflow de cambio → `KF-E-210`. Y al revés → `KF-E-211`.

Esta separación es lo que impide que el KB se doblegue ante los tickets (P8) y lo que hace que la modernización de legacy sea representable sin trampas.

### 10.3 Invisibilidad en el caso simple (requisito normativo de P6)

Un proyecto greenfield **SHALL** poder operar sin escribir la palabra "faceta". `rule.yaml` con una única faceta specified inline tiene exactamente la forma que tenía en v2.0:

```yaml
schema_version: 2.1
id: BR-0037
type: business-rule
name: Maximum Concentration Validation

identity:
  rule_kind: invariant
  subject: formulation concentration
  determination: whether a formulation is within the permitted limit
  governs: [DE-0017.concentration]
  produces: [OUT-0004, OUT-0009]
  signature: {algorithm: kf-normalize-v1, value: 9f3a1c...}

lifecycle: {status: active}

specified:                          # mapping = azúcar para lista de un elemento
  version: 3
  scope: {business_unit: [A, B], jurisdiction: [EU]}
  validity: {effective_from: 2026-10-01, effective_until: null}
  authority: {type: human, role: regulatory-officer, ref: "acta RC-2027-02"}
  logic:
    kind: decision-table
    hit_policy: first
    exhaustive: true
    inputs:
      - {ref: DE-0017.concentration, type: quantity, unit: percent_mass}
      - {ref: DE-0017.material_type, type: enum, domain: [X, Y, Z]}
    rules:
      - id: r1
        when: {material_type: {not_in: [X]}}
        then: {max_concentration: {value: "4.2", unit: percent_mass}, outcome: OUT-0004}
      - id: r2
        when: {material_type: X}
        then: {exempt: true, outcome: OUT-0009}
  epistemic:
    computed_confidence: confirmed
    override: null
    contested: false
  verification:
    last_verified_at: 2026-10-14
    verified_against: {knowledge: 2027.02.1}
```

El engine **SHALL** aceptar `specified` como mapping (un elemento) o como lista. Las facetas observed viven en archivos separados y **SHALL NOT** ser creadas hasta que exista discovery. `kf init --greenfield` **SHALL NOT** crear el directorio `observed/`.

### 10.4 Faceta observed

```yaml
# knowledge/business-rules/BR-0037/observed/legacy-app.yaml
schema_version: 2.1
entity: BR-0037
facet: observed

target:
  repository: legacy-app
  environment: production        # opcional
  scope: {business_unit: [B]}    # opcional: observación acotada

as_of: 2026-11-02
observed_against:
  repository: legacy-app
  commit: abc123def

logic:
  kind: decision-table
  hit_policy: first
  exhaustive: false
  inputs:
    - {ref: DE-0017.concentration, type: quantity, unit: percent_mass}
  rules:
    - id: r1
      when: {}
      then: {max_concentration: {value: "4.5", unit: percent_mass}}

epistemic:
  computed_confidence: supported
  override: null

discovery:
  method: static-analysis
  agent: archaeologist
```

Las facetas observed **SHALL NOT** versionarse. Son snapshots: su historia la da Git, y `kf build` emite `generated/changelog/observed.md`. No hay contador paralelo al de specified.

### 10.5 Facetas de `BP` y `DE`

Las facetas de `BP` **SHALL NOT** llevar `logic`. Llevan `steps` y las aristas de ejecución:

```yaml
specified:
  version: 2
  steps:
    - {id: s1, name: "Validate input", executes: [BR-0014, BR-0037]}
    - {id: s2, name: "Persist formulation", writes: [DE-0017]}
    - {id: s3, name: "Notify ERP", calls: [INT-0006]}
  produces: [OUT-0004]
  triggered_by: [EVT-0003]
```

Que las aristas de ejecución vivan dentro de la faceta es lo que permite representar que legacy ejecuta la regla en un paso distinto que el backend nuevo.

Las facetas de `DE` llevan `fields` (con `logic` opcional por campo para derivaciones) y `persistence`. La faceta observed de una `DE` es, en el caso típico, literalmente el esquema real de la base de datos extraído por el resolver de `database-schema`: el caso más barato y más rentable de todo el faceting.

`CAP`, `OUT`, `SC`, `EV`, `UNK`, `CHG`, `DIV`, `DSP` **SHALL NOT** facetarse.

### 10.6 Claves de multiplicidad

Son dos esquemas distintos y ambos entran en el direccionamiento.

**Faceta specified** — clave `(scope, validity_window)`:

```
specified_key = canonical(scope) ‖ "@" ‖ effective_from ‖ ".." ‖ (effective_until | "∞")
canonical(scope) = pares clave=valor ordenados lexicográficamente,
                   valores de lista ordenados, separados por ";"
```

Dos facetas specified **SHALL** tener claves disjuntas: o sus scopes no se intersectan, o sus ventanas de validez no se solapan. Solapamiento → `KF-E-411`.

**Faceta observed** — clave `target`, mapa abierto:

```
observed_key = pares clave=valor de target ordenados lexicográficamente
               ej.: "environment=production;repository=legacy-app"
```

Dos facetas observed **SHALL NOT** tener el mismo `target` → `KF-E-212`.

### 10.7 Direccionamiento

```
BR-0037                              la entidad
BR-0037#specified                    la faceta specified vigente hoy (única o error KF-E-413)
BR-0037#specified@v3                 por revisión
BR-0037#specified[business_unit=A]   por scope
BR-0037#observed:legacy-app          por repositorio
BR-0037#observed:legacy-app/production   con entorno
DE-0017.concentration                campo
DE-0017#observed:legacy-app.concentration   campo en una faceta
```

Esta sintaxis **SHALL** ser aceptada por `kf show`, `kf context`, `kf impact`, `kf diff`, y por `EV.supports`, `SC.asserts`, `CHG.affects` y `DSP.disputes`.

### 10.8 Campos derivados

`version` (specified), `computed_confidence`, `effective_confidence`, `signature.value`, `verification.*`, `hint_lines` de evidencia y toda inversa de arista **SHALL NOT** editarse a mano. `kf validate` los recalcula y falla con `KF-E-050`; `kf build --fix-derived` los reescribe.

`created_at` y `updated_at` **SHALL NOT** existir en YAML: los deriva Git (§17).

---

# PARTE IV — LÓGICA

## 11. Semántica numérica y de unidades

Fijada en v2.1 porque en un dominio regulado no es un detalle secundario.

### 11.1 Números

- Todo valor numérico de negocio **SHALL** evaluarse como **decimal de precisión arbitraria**. Coma flotante binaria **SHALL NOT** usarse en la evaluación de reglas.
- En YAML, los decimales **SHALL** escribirse como string entrecomillado (`"4.2"`) para evitar que el parser los convierta a float. `kf lint` **SHALL** advertir sobre decimales sin comillas (`KF-W-124`).
- El redondeo **SHALL** declararse explícitamente donde se aplique: `rounding: {mode: half-even | half-up | down | up, decimals: N}`. Sin declaración, no hay redondeo.
- División por cero → `KF-E-313` en validación, o el `guard` declarado en tiempo de evaluación.

### 11.2 Unidades — sin conversión implícita

> **En v1 NO existe conversión automática de unidades. Unidad declarada distinta de unidad recibida es ERROR (`KF-E-310`).**

Esto incluye pares matemáticamente convertibles. `percent` frente a `ppm` es error. Y `percent` a secas **SHALL NOT** ser una unidad válida en un dominio donde exista ambigüedad masa/volumen: el framework distribuye `percent_mass`, `percent_volume`, `percent_mass_per_volume` y **SHALL NOT** tratarlas como intercambiables.

Las unidades se declaran en `extensions/<domain>/units.yaml`:

```yaml
units:
  - {id: percent_mass, dimension: mass_fraction, symbol: "% m/m"}
  - {id: ppm_mass, dimension: mass_fraction, symbol: "ppm"}
conversions: []     # vacío en v1; futuras conversiones serán explícitas y nombradas
```

Una futura versión **MAY** añadir funciones de conversión explícitas e invocadas por nombre. **SHALL NOT** añadir nunca conversión inferida.

### 11.3 Nulos y enums

- `null` **SHALL** significar "ausente", nunca "cero" ni "falso".
- Toda comparación con un operando `null` evalúa a `false`, salvo `is_null`.
- Todo `enum` **SHALL** declarar su `domain`. Un valor fuera del dominio en un escenario → `KF-E-314`.

### 11.4 Expresiones regulares

Dialecto **RE2** (sin backreferences ni lookaround, sin backtracking catastrófico). Las reglas se evalúan en CI; una regex patológica es un fallo de disponibilidad. Patrón no compilable en RE2 → `KF-E-315`.

## 12. Gramáticas de `logic`

`logic.kind` ∈ `decision-table | formula | state-machine | narrative`. Las cuatro quedan cerradas en v2.1.

### 12.1 `decision-table`

```
predicate := { field: matcher } | { all: [predicate] } | { any: [predicate] } | { not: predicate }
matcher   := literal
           | { eq|ne|lt|lte|gt|gte: value }
           | { in|not_in: [value] }
           | { between: [min, max] }        # inclusivo en ambos extremos
           | { matches: re2-pattern }
           | { is_null: bool }
value     := scalar | quantity
quantity  := { value: "decimal-string", unit: unit-id }
```

- `hit_policy: first | unique | collect`.
- `unique` **SHALL** verificar ausencia de solapamiento → `KF-E-312`.
- **`exhaustive: true` SHALL exigir una fila `when: default`**, salvo que todos los inputs sean enums de dominio finito y el producto cartesiano de sus dominios sea ≤ `logic.exhaustiveness_proof_limit` (default `256`), en cuyo caso el engine enumera y prueba cobertura total. Fuera de eso → `KF-E-311`. Nada de SAT solver disfrazado de Knowledge Framework.

### 12.2 `formula`

Expresión estructurada, no string: sin parser, sin ejecución de código arbitrario.

```yaml
logic:
  kind: formula
  output: {ref: DE-0017.adjusted_concentration, unit: percent_mass}
  expression:
    op: multiply
    args:
      - {ref: DE-0017.concentration}
      - {op: subtract, args: [{const: "1"}, {ref: DE-0017.loss_factor}]}
  rounding: {mode: half-even, decimals: 4}
  guards:
    - when: {DE-0017.loss_factor: {gte: "1"}}
      raise: OUT-0011
```

Operadores: `add · subtract · multiply · divide · min · max · abs · round · clamp · if`.
`if` toma `{cond: predicate, then: expr, else: expr}`.

**Álgebra de unidades, obligatoria:**

- `add`, `subtract`, `min`, `max`, `clamp`: todos los operandos **SHALL** tener unidad idéntica; el resultado la conserva.
- `multiply`, `divide`: el resultado combina dimensiones. Si la dimensión resultante no existe en `units.yaml` → `KF-E-316`.
- `const` sin unidad es adimensional.
- La unidad calculada **SHALL** coincidir con `output.unit` → `KF-E-310`.

### 12.3 `state-machine`

```yaml
logic:
  kind: state-machine
  entity: DE-0017
  state_field: status
  states: [draft, submitted, under_review, approved, rejected]
  initial: draft
  terminal: [approved, rejected]
  completeness: total | partial
  transitions:
    - id: t1
      from: draft
      to: submitted
      trigger: EVT-0003
      guard: {when: {DE-0017.concentration: {is_null: false}}}
      produces: OUT-0004
      performed_by: ACT-0002
```

Validaciones obligatorias:

- Estado inalcanzable desde `initial` → `KF-W-317`.
- Estado no terminal sin camino a ningún terminal → `KF-E-318`.
- Dos transiciones con el mismo `from` y guards solapados sin `priority` → `KF-E-319`.
- `completeness: total` **SHALL** exigir que todo par (estado no terminal, trigger declarado) tenga transición o rechazo explícito.

### 12.4 `narrative` — último recurso

Cuando la lógica no es expresable, `kind: narrative` **MAY** usarse, pero entonces:

- `logic.unstructured_reason` es obligatorio.
- **`verification.mode` es obligatorio** (§25.4). Sin él → `KF-E-330`.
- El engine **SHALL** emitir en toda salida que incluya la faceta: *"Narrative rule — automated rule evaluation unavailable."*

## 13. Contrato YAML / Markdown

> **Lo que una máquina pueda verificar vive en YAML. El Markdown contiene únicamente lo que ninguna máquina puede verificar: el porqué.**

### 13.1 Encabezados permitidos

| Tipo | Encabezados en `.md` |
|---|---|
| `BR` | `Business purpose`, `Rationale`, `History & context`, `Notes`, `Open questions` |
| `BP` | `Business purpose`, `Narrative`, `Actors & context`, `Notes`, `Open questions` |
| `DE` | `Business meaning`, `Ownership & stewardship`, `Notes`, `Open questions` |
| `CAP` | `Business purpose`, `Boundaries`, `Notes` |
| `UNK` | `What we don't know`, `Why it matters`, `What we tried` |

Prohibidos como prosa: `Behavior`, `Conditions`, `Examples`, `Fields`, `Allowed values`. Se generan.

### 13.2 Bloques generados

El render **SHALL** incluir todas las facetas cuando exista más de una:

```markdown
## Business purpose
La restricción existe por requisito regulatorio EU 2026/114.

<!-- kf:generated:start id=behavior -->
### Specified behavior (v3, BU A·B / EU, desde 2026-10-01)
Máximo 4.2 % m/m, salvo material tipo X (exento).

### Observed behavior
| Target | Comportamiento | Confianza | as_of |
|---|---|---|---|
| legacy-app / production | máximo 4.5 % m/m, sin exención | supported | 2026-11-02 |
| backend | máximo 4.2 % m/m, exención tipo X | corroborated | 2026-11-02 |

⚠ DIV-0007 (behavioral-divergence, accepted)

### Examples
| Escenario | asserts | material_type | concentration | Resultado |
|---|---|---|---|---|
| SC-0041 | specified | Y | 4.2 % m/m | VALID (OUT-0004) |
| SC-0078 | specified | Y | 4.3 % m/m | INVALID (OUT-0004) |
| SC-0112 | observed:legacy-app | Y | 4.4 % m/m | VALID |
<!-- kf:generated:end -->
```

Diferencia entre el contenido del bloque y el render de `kf build` → `KF-E-602`.

### 13.3 Lint de coherencia prosa↔estructura

Sin LLM, determinista:

1. Toda magnitud con unidad en prosa **SHALL** existir en algún `logic` de la entidad o en un escenario ligado → `KF-W-120`.
2. Todo `XXX-NNNN` citado **SHALL** existir y **SHOULD** estar entre las relaciones → `KF-W-121`.
3. Sustantivos recurrentes en mayúscula fuera de `glossary.yaml` → `KF-W-122`.
4. Modales (`must`, `cannot`, `debe`, `no puede`) fuera de `Business purpose`/`Rationale` → `KF-W-123` (sugieren lógica escondida en prosa).
5. Decimales sin comillas → `KF-W-124`.

---

# PARTE V — MODELO EPISTÉMICO

## 14. Tres ejes ortogonales

| Eje | Campo | Ámbito | Valores |
|---|---|---|---|
| **Lifecycle** | `lifecycle.status` | entidad | `draft`, `active`, `deprecated`, `retired` |
| **Epistemia** | `epistemic.*` | **faceta** | ver §15 |
| **Verificación** | `verification.*` | faceta / evidencia | `fresh`, `stale`, `broken`, `unverifiable`, `needs-revalidation` |

`disputed` y `deprecated` **SHALL NOT** ser valores de confianza: el primero es `contested: true` + `DSP`, el segundo es lifecycle.

## 15. Escalera de confianza

Renombrada en v2.1 para eliminar la colisión entre el nivel `observed` y la faceta `observed`:

```
unknown  →  inferred  →  supported  →  corroborated  →  confirmed
```

| Nivel | Significado |
|---|---|
| `unknown` | Sin evidencia. |
| `inferred` | Evidencia indirecta o interpretativa. |
| `supported` | ≥1 evidencia directa de la clase apropiada para esta faceta. |
| `corroborated` | ≥2 evidencias directas de tipos distintos, todas vigentes. |
| `confirmed` | Evidencia de máxima autoridad para esta clase de faceta, vigente, sin disputas abiertas. |

**La confianza pertenece a la faceta, no a la entidad.** No existe `BR-0037.confidence`. Existen `BR-0037#specified.confidence` y `BR-0037#observed:legacy-app.confidence`, y pueden ser muy distintas: es perfectamente coherente saber con certeza qué hace legacy (`confirmed`) y no saber si eso es lo que el negocio quiere (`inferred`).

## 16. Evidencia

### 16.1 Clases (corrección central de v2.1)

> **La evidencia observacional SHALL elevar únicamente facetas observed. La evidencia especificadora SHALL elevar únicamente facetas specified.**

Un golden master demuestra *que el sistema hace esto*. **SHALL NOT** demostrar nunca *que el negocio quiere que lo haga*.

| Clase | Tipos | Eleva |
|---|---|---|
| **Observacional** | `source-code`, `database-schema`, `stored-procedure`, `configuration`, `api-contract`, `runtime-observation`, `log`, `golden-master`, `experiment` | facetas `observed` |
| **Especificadora** | `sme-validation`, `policy-document`, `regulatory-document`, `business-decision`, `approved-change` | facetas `specified` |
| **Ambivalente** | `documentation`, `ticket`, `manual-process` | ambas, pero techo `inferred` |

`policy-document`, `regulatory-document` y `business-decision` son **nuevos en v2.1**: sin ellos no había forma de elevar una faceta specified salvo con un SME.

Una evidencia aplicada a la clase de faceta equivocada → `KF-E-213`.

### 16.2 Fact vs. interpretation

Todo `EV` **SHALL** declarar `assertion_kind: fact | interpretation`. Una `interpretation` **SHALL NOT** por sí sola elevar por encima de `inferred`.

### 16.3 Anclaje

Los números de línea **SHALL NOT** ser autoritativos.

```yaml
schema_version: 2.1
id: EV-0038
type: source-code
assertion_kind: fact

anchor:
  resolver: source-code
  repository: legacy-app
  path: src/main/java/com/acme/CalculationService.java
  symbol: "CalculationService#calculate(FormulationInput)"
  symbol_kind: method
  content_sha: 9f3a1c4e...
  hint_lines: {start: 430, end: 478}       # DERIVADO

observed:
  commit: abc123def
  branch: main
  at: 2026-10-14T09:12:00Z

supports: [BR-0037#observed:legacy-app]     # faceta, no entidad
excerpt: |
  if (input.getConcentration() > MAX_CONCENTRATION) { ... }
```

`supports` **SHALL** apuntar a una faceta cuando la entidad esté facetada. Apuntar a la entidad desnuda → `KF-E-214`.

### 16.4 Contrato genérico de resolver (corrección de v2.1)

v2.0 especificaba `kf verify` solo para `source-code`. v2.1 define la interfaz que todo tipo auto-verificable **SHALL** implementar:

```
interface EvidenceResolver:
  kind: string
  supports_rename_tracking: bool

  resolve(anchor, workspace) -> Resolution
      Resolution = {
        state: fresh | stale | broken | unverifiable,
        content_sha: string,
        located_at: {path, hint_lines?},
        drifted_sha: string?,
        diagnostics: [Diagnostic]
      }

  fingerprint(target) -> sha256      # normalización propia del kind
```

**Normalización por tipo (obligatoria, define qué cuenta como "cambio"):**

| Resolver | Normalización antes del hash |
|---|---|
| `source-code`, `stored-procedure` | Eliminar comentarios; normalizar whitespace y saltos de línea |
| `database-schema` | Orden de columnas canónico; case-fold de identificadores; representación canónica de defaults, nullability y tipos |
| `api-contract` | Serialización canónica JSON/YAML del schema; claves ordenadas; ejemplos y descripciones excluidos |
| `configuration` | Claves ordenadas; comentarios eliminados; valores como string |
| `golden-master` | Hash de (inputs canónicos ‖ outputs registrados) |

Consecuencia deliberada: reformatear código o reordenar columnas no produce `stale`; cambiar lógica o tipos sí.

### 16.5 Algoritmo de `kf verify`

```
Para cada EV con resolver auto-verificable:
  1. Resolver repositorio. No montado → unverifiable (KF-W-140).
  2. Localizar path en el canonical_branch.
     No existe → si supports_rename_tracking, seguir renames (git log --follow).
                 Encontrado → actualizar path. No → BROKEN (KF-E-141).
  3. Localizar el símbolo con el adaptador del resolver.
     No existe → buscar en todo el repo (movimiento).
                 Encontrado → actualizar path, marcar moved. No → BROKEN (KF-E-141).
  4. fingerprint del símbolo.
     Igual → FRESH; actualizar hint_lines y last_verified_at.
     Distinto → STALE (KF-W-142); conservar content_sha y registrar drifted_sha.
  5. Sin adaptador disponible → fallback: búsqueda exacta del excerpt normalizado.
     Encontrado → FRESH con resolution: fallback-excerpt. No → STALE.
```

Adaptadores de lenguaje: interfaz mínima de tres funciones (`list_symbols`, `get_symbol_body`, `find_symbol`); con tree-sitter cada uno cabe en ~100 líneas.

### 16.6 TTL para evidencia no auto-verificable

```yaml
id: EV-0141
type: sme-validation
assertion_kind: fact
source: {role: formulation-scientist}
observed: {at: 2026-10-14}
revalidate_after: P6M
supports: [BR-0037#specified]
statement: "Máximo 4.2 % m/m en BU-A; materiales tipo X exentos."
```

Al vencer → `needs-revalidation`, y la faceta soportada entra en la cola de SMEs (§18). **SHALL NOT** degradarse en silencio.

### 16.7 Evidencia voluminosa

Logs, dumps, vídeos y datasets binarios **SHALL NOT** ir en Git. Referencia externa con hash:

```yaml
artifact: {uri: corporate-storage://..., sha256: d41d8c..., size_bytes: 412334221}
```

## 17. Cómputo de confianza

### 17.1 Política por clase de faceta

```yaml
confidence_policy:
  observed:
    confirmed:
      requires_any_of:
        - {types: [golden-master], min: 1, passing: true}
        - {types: [runtime-observation, log], min: 2, distinct_types: true}
      and: {no_open_disputes: true, no_broken_evidence: true, all_fresh: true}
    corroborated: {min_sources: 2, distinct_types: true, none_broken: true}
    supported:    {types: [runtime-observation, database-schema, log, golden-master, api-contract], min: 1}
    inferred:     {default_for: [source-code, configuration, documentation, stored-procedure]}
    unknown:      {when: {evidence_count: 0}}

  specified:
    confirmed:
      requires_any_of:
        - {types: [regulatory-document], min: 1}
        - {types: [business-decision], min: 1, with_authority: true}
        - {types: [sme-validation], min: 1, not_expired: true}
        - {types: [approved-change], min: 1}
      and: {no_open_disputes: true}
    corroborated: {min_sources: 2, distinct_types: true, class: specifying}
    supported:    {types: [sme-validation, policy-document], min: 1}
    inferred:     {default_for: [documentation, ticket]}
    unknown:      {when: {evidence_count: 0}}
```

### 17.2 Algoritmo

```
Evaluar en orden descendente confirmed → corroborated → supported → inferred → unknown.
La primera política satisfecha determina computed_confidence.

Degradaciones, aplicadas DESPUÉS:
  alguna evidencia BROKEN                → bajar un nivel, techo inferred
  toda la evidencia STALE                → bajar un nivel
  alguna evidencia needs-revalidation    → bajar un nivel
  DSP abierto sobre esta faceta          → contested: true, techo supported
  assertion_kind = interpretation solo   → techo inferred
```

Los `DIV` **SHALL NOT** degradar confianza: una divergencia bien evidenciada significa que sabemos *ambas cosas con certeza*, no que sepamos menos. Esto corrige una degradación mal fundada de v2.0.

### 17.3 Computed vs. override

```yaml
epistemic:
  computed_confidence: supported        # DERIVADO — el engine lo escribe
  override:                              # AUTORADO — solo humanos
    value: confirmed
    authority: {type: human, role: product-owner}
    at: 2026-11-02
    reason: "Validado en comité regulatorio; acta RC-2026-11."
    expires: 2027-11-02
  contested: false                       # DERIVADO
```

```
effective_confidence = override.value (si existe y no ha expirado)
                       else computed_confidence
```

Un agente **SHALL NOT** escribir ninguno de los dos campos: `computed_confidence` es del engine y `override` requiere autoridad humana. Agente escribiendo `override` → `KF-E-215`.

`kf audit` **SHALL** reportar todo override que difiera en más de un nivel del cómputo (`KF-W-701`) y todo override expirado.

## 18. Unknowns, Disputes y la cola de SMEs

### 18.1 Unknowns

```yaml
id: UNK-0018
question: "¿Qué significan FLAG1 y FLAG2 en LEGACY_XYZ?"
why_it_matters: "CalculationService las lee para decidir la rama de cálculo."
blocks: [BR-0078#specified, CAP-0012]
evidence: [EV-0442]
required_source: {kind: sme, role: formulation-scientist}
attempts:
  - {method: golden-master, at: 2026-10-09, result: "3 casos; no discrimina"}
  - {method: code-search, at: 2026-10-10, result: "sin uso fuera de CalculationService"}
  - {method: log-mining, at: 2026-10-11, result: "valores observados: 0,1,2"}
status: open | answered | obsolete
```

> **SHALL NOT inventar conocimiento para rellenar huecos.** Un agente que no pueda respaldar una afirmación **SHALL** crear un `UNK`.

### 18.2 Disputes

```yaml
id: DSP-0012
disputes:
  entity: BR-0037
  facet: specified              # o observed:legacy-app, o ninguno (toda la entidad)
raised_by: {type: human, role: qa}
claim: "No creo que 4.2 % sea realmente la regla de negocio en BU-B."
counter_evidence: [EV-0501]
status: open | resolved
resolution: {kind: knowledge-changed | evidence-rejected | scope-clarified, change: CHG-0192}
```

Poder disputar una faceta concreta importa: QA puede dudar de lo especificado sin dudar de lo observado, y viceversa.

Mientras `open`, la faceta **SHALL** mostrar `contested: true` en `kf context`, `kf impact`, el portal y todo render.

### 18.3 Cola de SMEs — cinco fuentes

La cola **SHALL NOT** reducirse a promoción observed→specified. Esa es una de cinco fuentes:

```
SME Queue
├── promotion candidates       facetas observed sin faceta specified correspondiente
├── unresolved UNK             huecos declarados que agotaron alternativas automáticas
├── open DSP                   desacuerdos que requieren autoridad
├── stale specifying evidence  sme-validation vencida, override expirado
└── other validations          scope indefinido, terminología ambigua, ownership de POL
```

La consulta `kf questions --promotions` (observed sin specified) es una de las salidas más útiles del framework en ingeniería inversa: es literalmente el backlog de *"sabemos qué hace; ¿es lo que queremos?"*.

### 18.4 Agotamiento obligatorio de alternativas

Un `UNK` **SHALL NOT** encolarse a un humano hasta haber intentado y registrado, en este orden:

1. **Golden master / characterization test** — ¿puede responderse ejecutando el sistema? Eleva facetas observed sin intervención humana. Es la herramienta más infrautilizada del framework.
2. **Minería de tickets e incidentes históricos.**
3. **Análisis de logs y datos reales.**
4. **Documentación existente y contratos de API.**
5. **Solo entonces:** cola de SMEs.

`kf questions` **SHALL** rechazar un `UNK` con menos de `governance.min_attempts_before_sme` intentos (default 2), salvo `--force`.

### 18.5 Prioridad

```
priority = impact_radius × certainty_gap × change_pressure × risk_class

impact_radius   = log2(1 + |transitive_dependents(entity, max_depth=3)|)
certainty_gap   = {unknown: 1.0, inferred: 0.7, supported: 0.4, corroborated: 0.15, confirmed: 0}
change_pressure = 1 + 2·(work items abiertos que la referencian)
                    + 3·(CHG bloqueados) + 2·(DIV abiertos sin disposition)
risk_class      = max(tags): regulatory|financial|safety = 3,
                             customer-facing = 2, internal = 1
```

Todos los términos son calculables desde `graph.json`.

### 18.6 Formato: pedir corrección, no autoría

Toda pregunta **SHALL** presentarse como hipótesis falsable respondible en menos de dos minutos:

```
[UNK-0018 · prioridad 8.4 · bloquea CAP-0012]

Creemos que:
  La concentración máxima es 4.2 % m/m para BU-A; los materiales tipo X están exentos.

Base:
  CalculationService#calculate (EV-0038, inferred, observed:legacy-app)
  47 formulaciones en producción, ninguna > 4.2 % (EV-0121, supported)

¿Es correcto?   [ ] Sí   [ ] No   [ ] Parcialmente: ____________
```

`kf interview-pack --role <rol> --duration 45m` genera un cuadernillo agrupado temáticamente (estimación 90 s/pregunta). `kf interview-import` genera un único `EV` de tipo `sme-validation` que soporta todas las facetas validadas en esa sesión.

### 18.7 Deuda epistémica visible

- `governance.max_open_unknowns_per_capability` (default: warning 10, error 25).
- Toda salida de `kf context`, `kf impact` y `kf diff` **SHALL** llevar cabecera epistémica:
  `"Este análisis se apoya en 4 afirmaciones inferred, 1 contested y 2 con evidencia stale."`

El conocimiento inferido se usa; **SHALL NOT** disfrazarse.

---

# PARTE VI — TIEMPO, CAMBIO Y DIVERGENCIA

## 19. Modelo bitemporal

| Eje | Significado | Fuente |
|---|---|---|
| **Valid time** | Cuándo aplica en el negocio | `validity.effective_from` / `effective_until` (autorado) |
| **Transaction time** | Cuándo entró al KB canónico | Git (derivado) |
| **Decision time** | Cuándo el negocio tomó la decisión | `CHG.decided_at` (autorado) |

### 19.1 Transaction time, formalizado (corrección de v2.1)

```
transaction_time(X) = timestamp del primer commit que contiene X
                      en el canonical_branch del Knowledge Repository
```

> **«Once published on the canonical branch, history SHALL NOT be rewritten.»**

Esto **no** prohíbe squash merge: un feature branch puede entrar a `main` como un solo commit, y el transaction time empieza ahí. Lo que prohíbe es force-push que reescriba historia ya publicada. CI **SHALL** verificarlo (`KF-E-702`).

Con esa garantía, `created_at` y `updated_at` **SHALL NOT** existir en YAML.

### 19.2 `decided_at` no es transaction time

`CHG.decided_at` responde *"¿cuándo tomó negocio esta decisión?"*; el transaction time responde *"¿cuándo entró al KB?"*. Son hechos distintos, con escritores distintos. No hay duplicación. `recorded_at` de v2.0 queda eliminado.

## 20. Facetas specified futuras (lo que v2.0 llamaba `approved`)

`approved` **SHALL NOT** ser un estado de verdad. Una especificación futura aprobada es simplemente una faceta specified con `effective_from` posterior a hoy, creada por un `CHG` con autoridad:

```
knowledge/business-rules/BR-0037/
├── rule.yaml              specified v3, effective_from 2026-10-01   (vigente)
└── pending/v4.yaml        specified v4, effective_from 2027-03-01   (aprobada, futura)
```

`kf promote` la activa al llegar la fecha (manual o por job). `BR-0037#specified` resuelve a la faceta vigente **hoy**; si hay ambigüedad sin resolver → `KF-E-413`.

Consulta derivada gratuita: *"¿qué está aprobado pero aún no implementado?"* = facetas specified futuras sin faceta observed que las iguale.

## 21. Versionado

- **Revisión de entidad:** entero, propiedad de la faceta specified, derivado del ledger de `CHG`. `BR-0037#specified@v3`.
- **Facetas observed:** no versionadas. Snapshots con `as_of` + `observed_against`.
- **Knowledge release:** CalVer (§23).
- **Framework:** SemVer.

Versiones pasadas **SHALL NOT** almacenarse como archivos: `kf show BR-0037 --as-of 2026-12-15` las reconstruye replayando Git + ledger.

## 22. Business Change Ledger

`changes/` es **append-only**. Un `CHG` nunca se edita; se supersede.

```yaml
schema_version: 2.1
id: CHG-0192
decided_at: 2027-02-11
effective_from: 2027-03-01
type: MODIFY
impact_classes: [behavioral, data-contract]

affects:
  - facet: BR-0037#specified[business_unit=A;business_unit=B]
    previous_version: 2
    new_version: 3

reason: "Actualización de límites regulatorios de concentración (EU 2026/114)."
authority: {type: human, role: regulatory-officer, ref: "acta RC-2027-02"}
evidence: [EV-0603]                     # tipo regulatory-document

changed_fields:
  - path: logic.rules[r1].then.max_concentration
    from: {value: "4.5", unit: percent_mass}
    to:   {value: "4.2", unit: percent_mass}

requires_revalidation: [SC-0009, SC-0041]
resolves: [DSP-0012]
```

`affects` **SHALL** apuntar a facetas specified. Un `CHG` que apunte a una faceta observed → `KF-E-211`.

### 22.1 Tipos

`ADD · MODIFY · CLARIFY · DEPRECATE · REMOVE · RENAME · SPLIT · MERGE`

`CLARIFY` **SHALL NOT** producir diff en `logic`. Si lo produce → `KF-E-420`, y se exige `MODIFY`. Validación determinista que elimina la ambigüedad de v0.1.

### 22.2 Clases de impacto

`none · documentation · behavioral · data-contract · integration · presentation · security · architecture`. El engine deriva un conjunto sugerido desde `changed_fields` y advierte si el autor declara menos (`KF-W-421`).

## 23. Divergencias — artefacto derivado-gestionado

### 23.1 Derivación

El engine compara facetas y emite `DIV`. Dos mecanismos, ambos obligatorios, con conclusiones distintas:

| Mecanismo | Qué da | Etiqueta resultante |
|---|---|---|
| **Diff estructural por path** | La *ubicación* de la diferencia | `structural-difference` |
| **Diferencial por escenarios** | La *prueba* conductual: ejecuta todo `SC` ligado contra ambas facetas | `behavioral-divergence` |

Un diff estructural sin discrepancia de escenarios **SHALL** etiquetarse `structural-difference`, **nunca** `behavioral-divergence`. Misma disciplina que §26.2: no afirmar más certeza de la que se tiene.

Si ninguna de las dos facetas es evaluable (alguna es `narrative`), el `DIV` se etiqueta `undetermined` y entra en la cola de SMEs.

### 23.2 Identidad estable

```
div_key = sha256(entity ‖ specified_key ‖ observed_target ‖ difference_path)
```

- Si el **valor** cambia (4.5 → 4.4), el `DIV` persiste, actualiza el valor y **conserva su disposition**.
- Si el **path** cambia, el `DIV` anterior se cierra como `superseded` y nace uno nuevo. **La disposition NO se hereda** — deliberado: una discrepancia en otro campo es otra decisión de negocio.
- El `id` se asigna en la primera detección y persiste mientras persista la `div_key`.

Sin esto, `kf build` haría churn de IDs y destruiría el trabajo humano de disposition en cada ejecución.

### 23.3 Ownership dividido

```yaml
# divergences/DIV-0007.yaml
schema_version: 2.1
id: DIV-0007

# ─── ENGINE-OWNED — SHALL NOT editarse a mano (KF-E-603) ───
detected:
  key: 7f21a9...
  entity: BR-0037
  comparison:
    specified: BR-0037#specified@v3
    observed: BR-0037#observed:legacy-app
  difference:
    path: logic.rules[r1].then.max_concentration
    specified: {value: "4.2", unit: percent_mass}
    observed: {value: "4.5", unit: percent_mass}
  classification: behavioral-divergence
  proof: {mechanism: scenario-differential, failing_scenarios: [SC-0041, SC-0078]}
  first_detected: 2026-11-02
  last_confirmed: 2027-01-15
  state: present | absent | superseded

# ─── HUMAN-OWNED ───
disposition:
  status: open | accepted | resolving | resolved
  reason: "Legacy no se migrará hasta Q3 2027; divergencia conocida y aceptada."
  owner: {type: human, role: product-owner}
  expires: 2027-09-30
  resolution: {kind: change | work-item | evidence-correction, ref: BUG-9182}
```

El `DIV` **SHALL NOT** repetir las afirmaciones: referencia las facetas. Escribir `statement:` en un `DIV` es la duplicación exacta que v2.1 elimina.

`kf build` reescribe `detected` y **SHALL** preservar `disposition` intacto. Disposition `accepted` con `expires` vencido → `KF-W-703`.

## 24. Semantic diff

`kf diff BR-0037#specified@2 BR-0037#specified@3`:

```
BR-0037 — Maximum Concentration Validation
specified v2 → v3 · CHG-0192 · decided 2027-02-11 · effective 2027-03-01

CHANGED
  Concentration threshold           4.5 % m/m → 4.2 % m/m

UNCHANGED                                        [structural comparison]
  Applicability scope               BU [A, B] · EU
  Exemption for material type X     r2 sin cambios
  Input model                       DE-0017 {concentration, material_type}
  Output contract                   OUT-0004, OUT-0009

PROVEN UNAFFECTED                                [scenario differential, 18 SC]
  Exemption behaviour               SC-0091, SC-0112 pasan idénticos en v2 y v3

NO IMPACT PATH FOUND                             [graph traversal, depth 3]
  INT-0006, CAP-0003                sin camino dentro del límite de análisis

INDIRECTLY AFFECTED
  BP-0014, BP-0021                  ejecutan esta faceta
  SC-0041, SC-0078                  requieren revalidación
  backend/MaximumConcentrationPolicy.java        mapping fresh

FACET STATE
  observed:legacy-app  4.5 % m/m    DIV-0007 accepted hasta 2027-09-30
  observed:backend     4.2 % m/m    alineado tras este cambio

EPISTEMIC
  specified: confirmed (EV-0603 regulatory-document)
  observed:legacy-app: supported (EV-0038 source-code, stale desde 2027-01-10)
```

La sección UNCHANGED es obligatoria (`KF-E-430`). Se produce enumerando los campos del schema no tocados por `changed_fields`, nunca por omisión.

---

# PARTE VII — ASERCIONES NEGATIVAS

## 25. Tres niveles (corrección de v2.1)

v2.0 usaba "unchanged" y "unaffected" como sinónimos. Son afirmaciones de fuerza muy distinta, y un framework cuyo propósito es no expresar más certeza de la que posee **SHALL** distinguirlas.

| Nivel | Significa | Producido por | Fuerza |
|---|---|---|---|
| `UNCHANGED` | No se detectó cambio estructural en este campo o contrato entre las dos versiones comparadas. | Diff estructural | Débil: solo dice que el texto no cambió |
| `NO_IMPACT_PATH_FOUND` | El recorrido del grafo no encontró camino dentro de los límites de análisis declarados. | Traversal | Media: depende del límite, y **SHALL** declararlo |
| `PROVEN_UNAFFECTED` | Una comprobación determinista se ejecutó y pasó. | Escenarios, golden master, type check | Fuerte |

Toda salida de `kf diff` e `kf impact` **SHALL** etiquetar cada aserción negativa con su nivel y, en `NO_IMPACT_PATH_FOUND`, con el límite usado (profundidad y tipos de arista). Emitir una aserción negativa sin etiqueta → `KF-E-431`.

---

# PARTE VIII — ESCENARIOS Y GOLDEN MASTER

## 26. Escenarios

```yaml
schema_version: 2.1
id: SC-0041
name: Standard formulation creation within limit
scenario_kind: happy-path | edge | exception | regression | characterization

asserts:
  facet: specified            # o: observed
  target: null                # OBLIGATORIO si facet = observed

given:
  business_unit: A
  material_type: Y
  concentration: {value: "4.2", unit: percent_mass}
when: "Formulation is submitted"
then:
  exercises: [BR-0014, BR-0021, BR-0037]
  outcome: OUT-0004
  expected: {valid: true}

covers: [BP-0014]
```

`asserts.facet: observed` sin `target` → `KF-E-322`. Un escenario de caracterización grabado de producción se verifica contra la faceta observada; uno escrito por el PO, contra la especificada. Mezclarlos fue una ambigüedad real de v2.0.

### 26.1 `kf check-rules`

Para cada `SC`, evaluar el `logic` de la faceta indicada por `asserts` contra `given` y comparar con `then.expected`. Discrepancia → **`KF-E-320`**.

Determinista, barato, y es el mecanismo que mantiene honesto al YAML. Sin él, `logic` es solo otra forma de prosa.

### 26.2 Cobertura

- `governance.min_scenarios_per_rule` (default 2) aplica a **facetas specified evaluables**.
- Toda rama de una `decision-table` **SHOULD** tener ≥1 escenario → `KF-W-321`.
- `kf coverage` reporta: facetas sin escenarios, ramas descubiertas, escenarios que no ejercitan nada, y facetas observed sin escenarios de caracterización.

### 26.3 Reglas narrativas — sin falso rigor

Exigir *N* escenarios a una regla que el engine no sabe evaluar produce una falsa sensación de rigor: puede haber 400 escenarios y ninguno prueba nada automáticamente. v2.1 sustituye esa exigencia:

```yaml
logic:
  kind: narrative
  unstructured_reason: "Depende de juicio del revisor químico."
verification:
  mode: attested | external-test
  attested_by: {type: human, role: formulation-scientist, at: 2026-11-02}
  # o:
  external_test: {repository: backend, symbol: "ViscosityJudgementTest"}
```

`verification.mode` es obligatorio en reglas narrativas (`KF-E-330`). Los escenarios **MAY** existir como ejemplos, pero **SHALL NOT** elevar confianza automáticamente. Toda salida que incluya la faceta declara: *"Narrative rule — automated rule evaluation unavailable."*

## 27. Golden master

```yaml
# golden-master/cases/CASE-0187.yaml
id: CASE-0187
target: {repository: legacy-app, entry_point: "CalculationService#calculate"}
input:
  business_unit: X
  concentration: {value: "3.41", unit: percent_mass}
  temperature: {value: "25", unit: celsius}
recorded_output: {result_a: "12.84", result_b: "ADJUSTED", status: "OK"}
recorded_at: 2026-10-14
recorded_against: {commit: abc123}
derives: [BR-0078#observed:legacy-app]
```

`kf golden run --against backend` clasifica cada diferencia:

- **`regression`** — sin `CHG` que lo justifique → error.
- **`intentional-change`** — hay `CHG` efectivo que lo explica → informativo.
- **`unexplained`** — diferencia sin `CHG` y sin regla ligada → crea un `UNK` automáticamente.

Un golden master pasando eleva la faceta **observed** a `confirmed` sin intervención humana. **SHALL NOT** elevar nunca una faceta specified. Es la palanca más potente para resolver unknowns sin gastar tiempo de SME.

---

# PARTE IX — TRAZABILIDAD

## 28. Mappings

```yaml
# mappings/backend.yaml
schema_version: 2.1
repository: backend
baseline: {release: 2027.02.1, commit: 82ab92d}

mappings:
  BR-0037#specified:
    implementation:
      - {symbol: "MaximumConcentrationPolicy", path: src/domain/.../MaximumConcentrationPolicy.java, content_sha: 771ab2...}
    tests:
      - {symbol: "MaximumConcentrationPolicyTest", path: src/test/...}
    coverage: full | partial | planned
  SC-0088:
    tests: [{symbol: "CreateFormulationAcceptanceTest#reusesExistingCalculation"}]
```

Los mappings usan el mismo mecanismo de anclaje que la evidencia, y heredan gratis la detección de drift.

## 29. El bucle de incentivos

Detectar drift es fácil; conseguir que alguien lo arregle es el problema real. La pieza decisiva **SHALL** vivir en los repositorios de código.

### 29.1 `kf pr-check`

1. Obtener archivos y símbolos tocados por el diff.
2. Resolverlos contra `mappings/` → facetas afectadas.
3. Comentar en el PR con la regla renderizada, su estado epistémico y **exactamente dos caminos de un comando**:

```
⚠ Este PR toca código mapeado a BR-0037#specified (Maximum Concentration Validation).

   Especificado: máximo 4.2 % m/m, salvo material tipo X (exento).
   Confianza: confirmed · verificado 2026-10-14

   Si el comportamiento de negocio NO cambia:
     kf ack BR-0037 --pr 4431 --unchanged

   Si SÍ cambia:
     kf change BR-0037 --from-pr 4431
```

4. Fallar el check si no hay `ack` ni `CHG` cuando la evidencia pasó a `stale` **y** `risk_class ≥ drift.fail_on_stale_risk_class_gte`.

### 29.2 Artefacto de acknowledgement (nuevo en v2.1)

`ack` no describe business truth, así que **SHALL NOT** ser una entidad core. Es un artefacto operacional append-only:

```yaml
# .kf/acknowledgements/backend/PR-4431.yaml
schema_version: 2.1
repository: backend
pull_request: 4431
facet: BR-0037#specified
assertion: {behavior_changed: false}
mapping:
  previous_sha: 771ab2...
  acknowledged_sha: 9c14fe...
acknowledged_by: {type: human, user: "..."}
acknowledged_at: 2027-02-14T11:02:00Z
reason: "Refactor interno; extracción de método sin cambio de lógica."
```

`kf ack` **SHALL**: (1) generar el acknowledgement; (2) actualizar el `content_sha` del mapping; (3) re-verificar el símbolo; (4) dejar audit trail. Sin este artefacto, el mecanismo de incentivos de §29.1 no es implementable — hueco real de v2.0.

## 30. Baseline y sincronización

```yaml
# .kf-baseline.yaml en cada repo de implementación
knowledge_baseline:
  project: formulation-knowledge
  release: 2027.02.1
  commit: 82ab92d
  acknowledged_divergences: [DIV-0007]
```

`kf sync-status`:

```
Knowledge release: 2027.03.1

backend           2027.03.1  ✓
frontend          2027.03.1  ✓
sap-integration   2027.02.1  ⚠  pending CHG-0214 (behavioral)
legacy-app        2027.01.2  ✓  DIV-0007 accepted hasta 2027-09-30
```

## 31. Reverse engineering

Orden obligatorio: **WHAT EXISTS → WHY → HOW IT BEHAVES → WHAT DATA → WHAT RULE**. Solo después: *what should exist*. Los agentes de arquitectura **SHALL NOT** rediseñar durante el discovery inicial.

En el modelo de facetas, el discovery produce **exclusivamente facetas observed**. La promoción a specified es un acto posterior, deliberado y con autoridad (§18.3).

**Fuentes:** código · esquema de BD · stored procedures · configuración · datos maestros · logs · documentación · UI · contratos de API · batch jobs · tareas programadas · incidentes · tickets · datasets reales · entrevistas SME · procedimientos manuales.

**Cobertura** — "terminado" **SHALL NOT** definirse como *"tenemos bastante documentación"*:

```
public entry points catalogued        100%
DB writes catalogued                  100%
external interfaces catalogued        100%
scheduled processes catalogued        100%
observed facets with evidence         100%
observed facets promoted to specified  62%    ← el backlog real
undocumented persistent writes           0
undocumented external dependencies       0
```

---

# PARTE X — WORK ITEMS

## 32. Cuatro categorías

| Categoría | Prefijos | Describe |
|---|---|---|
| Knowledge | `CAP BP BR DE OUT SC EV UNK DIV DSP` | Business truth |
| Change | `CHG` | Evolución de facetas specified |
| Work | `US BUG TASK EPIC INCIDENT SPIKE` | Trabajo |
| Implementation | `ART` | Cómo se planea implementar |

`CHG-0217 → US-4431 → ART-4431 → PRs`. El framework **SHALL NOT** reemplazar Jira/ADO/Linear/GitHub Issues.

## 33. Ingestión

```yaml
id: BUG-9182
type: bug
external: {system: azure-devops, id: 9182, url: "...", fetched_at: "..."}
original:
  title: "Final Review debería permitir concentración > 4.2 %"
  body: |
    ...texto original íntegro, nunca modificado...
```

> **`original` SHALL ser inmutable.** La IA **MAY** añadir comentarios, enlaces, análisis, preguntas y propuestas de redacción; los cambios sustanciales al intent **SHALL** requerir aprobación humana y **SHALL NOT** perder el texto original.

## 34. Clasificación

| Clasificación | Acción — ahora explícita en términos de facetas |
|---|---|
| `NEW_BUSINESS_BEHAVIOR` | Proponer `CHG type: ADD` sobre specified |
| `EXISTING_BEHAVIOR_EXPOSED_DIFFERENTLY` | Reutilizar; no duplicar lógica |
| `IMPLEMENTATION_ONLY` | Generar contexto técnico; ninguna faceta cambia |
| `BUSINESS_RULE_CHANGE` | `CHG type: MODIFY` sobre specified |
| `IMPLEMENTATION_DEFECT` | Observed ≠ specified con specified `confirmed` → el `DIV` ya existe; ligar el work item a su `disposition.resolution` |
| `KNOWLEDGE_GAP` | Crear `UNK`; nunca inventar |
| `KNOWLEDGE_CONFLICT` | Crear `DSP` sobre la faceta disputada; preguntar |

Estados: `UNASSESSED · NEEDS_CLARIFICATION · KNOWLEDGE_GAP · KNOWLEDGE_CONFLICT · KNOWLEDGE_CHANGE_REQUIRED · IMPLEMENTATION_DEFECT · IMPLEMENTATION_ONLY · READY_FOR_IMPLEMENTATION · BLOCKED`.

### 34.1 Los tres casos canónicos

**Bug que contradice el KB.** «Debería permitir > 4.2 %» vs `BR-0037#specified = 4.2 %` → **SHALL NOT** modificar la faceta. Emite `KNOWLEDGE_CONFLICT`, crea `DSP` sobre `#specified`, pregunta: *¿cambió el negocio, o falta una excepción?*

**Defecto de implementación.** Observado 6.0 %, specified 4.2 % `confirmed` → `IMPLEMENTATION_DEFECT`. En v2.1 el `DIV` **ya fue derivado** por el engine; el work item se liga a su resolución. No se toca specified.

**Hueco de conocimiento.** Afirma algo no documentado → `KNOWLEDGE_GAP`, crea `UNK`, entra en la cola priorizada.

## 35. Implementation Artifact y Definition of Ready

```yaml
id: ART-4431
story: US-4431
knowledge_baseline: {release: 2027.02.1, commit: 82ab92d}
repositories: [backend, frontend]
implementation_targets:
  backend: {components: [FormulaCalculationUseCase, FinalReviewQuery]}
knowledge_coverage: [BR-0109#specified, BR-0113#specified, SC-0088]
```

`kf ready US-4431` verifica: intent entendido · conocimiento resuelto · sin `DSP` abiertos sobre las facetas referenciadas · clasificación conocida · cambios aprobados · escenarios identificados · unknowns críticos resueltos · scope implementable.

`kf stale-refinements` detecta refinamientos hechos contra una release anterior cuyas facetas cambiaron.

> «Human artifacts should remain concise; machine context should remain rich and addressable.»

---

# PARTE XI — ENGINE Y CLI

## 36. Contrato general

Binario: `kf`. Todo comando acepta `--format text|json` y `--workspace <path>`.

```json
{
  "kf_version": "2.1.0",
  "knowledge_release": "2027.02.1",
  "command": "impact",
  "ok": true,
  "data": {},
  "diagnostics": [
    {"code": "KF-W-142", "severity": "warning",
     "subject": "EV-0038", "message": "...",
     "remediation": "kf verify --update EV-0038"}
  ],
  "epistemic_header": {"inferred": 4, "contested": 1, "stale_evidence": 2, "open_divergences": 1}
}
```

Todo diagnostic **SHALL** incluir `remediation` cuando el catálogo defina una. Los diagnostics **SHALL** generarse desde el catálogo de §44.2, no escribirse a mano.

### 36.1 Códigos de salida

`0` OK · `1` errores de validación · `2` solo warnings con `--strict` · `3` error de uso · `4` error interno · `5` recurso no disponible.

## 37. Superficie de comandos

**Ciclo de vida:** `init · create · update · promote · deprecate · retire`
**Consulta:** `query · show [--as-of] [--facet] · context · graph · trace · lineage`
**Análisis:** `impact · diff · coverage · questions [--promotions] · sync-status · stale-refinements · divergences`
**Cambio:** `change · ack · release`
**Verificación:** `validate · lint · verify · check-rules · audit · golden run · pr-check`
**Generación:** `build · render · portal`
**Work items:** `ingest · refine · ready`
**SME:** `interview-pack · interview-import`
**Adapters:** `adapters install · agents export`

## 38. `kf context` — el comando central

```
kf context BR-0037 --budget 8000 --task change
```

### 38.1 Algoritmo

```
1. Cargar identidad + la faceta indicada (default: specified vigente).
2. Cargar SIEMPRE, sin truncar (safe context):
     a. DIV abiertos o accepted que involucren esta entidad
     b. DSP abiertos sobre la entidad o cualquiera de sus facetas
     c. UNK que la bloqueen
     d. resumen de una línea por cada faceta existente
3. Cargar vecindario por prioridad decreciente:
     e. reglas que comparten DE gobernada       (riesgo de conflicto)
     f. procesos que la ejecutan
     g. escenarios que la ejercitan, agrupados por asserts.facet
     h. campos de DE gobernados (no la DE completa)
     i. POL que la sobreescriben
     j. evidencia (resumen; excerpt completo solo para las 3 más recientes)
     k. últimos 3 CHG
     l. mappings de implementación y tests
     m. work items abiertos
4. Ajustar al presupuesto truncando desde el final de (e..m).
5. Adjuntar cabecera epistémica y lista de lo truncado.
```

### 38.2 Invariante y su rama de fallo (corrección de v2.1)

> **El safe context (paso 2) SHALL NOT truncarse jamás.**

Un agente que opera sin saber que la faceta está en disputa produce trabajo incorrecto con alta confianza.

Si el safe context por sí solo excede el presupuesto, **SHALL** fallar explícitamente:

```
KF-E-500: Minimum safe context requires 5,200 tokens; requested budget is 4,000.
required_minimum_budget: 5200
remediation: kf context BR-0037 --budget 5200
```

**SHALL NOT** truncar silenciosamente. v2.0 dejaba esta rama indefinida.

La salida termina con:

```
TRUNCATED BY BUDGET: 4 evidence excerpts, 2 work items.
Recuperar con: kf context BR-0037 --section evidence --budget 4000
```

## 39. `kf impact`

Recorrido dirigido sobre `graph.json`, profundidad default 3. La salida **SHALL** separar **directamente afectado**, **indirectamente afectado** y aserciones negativas etiquetadas según §25.

Un cambio sobre una faceta specified **SHALL** incluir en el impacto las facetas observed de la misma entidad, porque cambiar lo especificado puede crear o resolver divergencias.

## 40. `graph.json`

```json
{
  "kf_version": "2.1.0",
  "knowledge_release": "2027.02.1",
  "generated_at": "2027-02-14T10:00:00Z",
  "source_commit": "82ab92d",
  "nodes": [
    {"id": "BR-0037", "type": "business-rule", "name": "...",
     "status": "active", "risk_class": 3,
     "signature": {"algorithm": "kf-normalize-v1", "value": "9f3a1c..."},
     "facets": [
       {"ref": "BR-0037#specified@v3", "class": "specified", "version": 3,
        "key": "business_unit=A;business_unit=B;jurisdiction=EU@2026-10-01..∞",
        "effective_confidence": "confirmed", "contested": false},
       {"ref": "BR-0037#observed:legacy-app", "class": "observed",
        "key": "repository=legacy-app", "effective_confidence": "supported",
        "as_of": "2026-11-02"}
     ]}
  ],
  "edges": [{"from": "BP-0014#specified", "to": "BR-0037", "type": "executes"}],
  "divergences": [{"id": "DIV-0007", "entity": "BR-0037",
                   "classification": "behavioral-divergence", "disposition": "accepted"}],
  "indexes": {
    "by_data_field": {"DE-0017.concentration": ["BR-0037", "BR-0078"]},
    "by_repository": {"legacy-app": ["BR-0037#observed:legacy-app"]},
    "observed_without_specified": ["BR-0091", "BR-0094"]
  }
}
```

`observed_without_specified` alimenta directamente `kf questions --promotions`.

Una Graph DB **MAY** existir como proyección posterior; **SHALL NOT** ser fuente primaria. No se requiere en V1.

## 41. Releases

```yaml
versioning:
  strategy: calver        # calver (default) | semver
  calver_format: "YYYY.MM.N"
```

**Knowledge release: CalVer por defecto.** `2027.02.1` dice inmediatamente cuándo se publicó. La compatibilidad real no se adivina de un número: sale de `kf sync-status`, los `CHG`, los `DIV` y los baselines. Bajo SemVer estricto, cualquier cambio de umbral es MAJOR y se llega a v47 rápidamente — válido, pero sin significado operativo añadido.

**Framework: SemVer** (`2.1.0`), porque ahí sí se publica software y API.

**Entidad: revisión entera** derivada del ledger.

`kf release` crea el tag Git y regenera `generated/changelog/`.

## 42. Validación

### 42.1 Schemas

Cada tipo **SHALL** tener JSON Schema en `framework/schemas/`, con schemas separados por clase de faceta. Valor fuera de enum → `KF-E-010`.

### 42.2 Catálogo de códigos

Con columna de remediación, para que los tests de diagnostics se generen desde la tabla.

| Código | Sev | Condición | Remediación por defecto |
|---|---|---|---|
| `KF-E-010` | E | Violación de JSON Schema | — |
| `KF-E-050` | E | Campo derivado editado a mano | `kf build --fix-derived` |
| `KF-E-101` | E | Colisión de ID con un ID `permanent` | resolución manual |
| `KF-E-102` | E | Referencia rota | — |
| `KF-E-103` | E | Relación inválida entre esos extremos | — |
| `KF-E-104` | E | Ciclo prohibido (`contains` en DE) | — |
| `KF-E-105` | E | Inversa derivada en YAML autorado | `kf build --fix-derived` |
| `KF-W-110` | W | Entidad huérfana | — |
| `KF-W-120` | W | Magnitud en prosa ausente del `logic` | — |
| `KF-W-121` | W | ID citado en prosa fuera de relaciones | — |
| `KF-W-122` | W | Término fuera del glosario | `kf glossary add <term>` |
| `KF-W-123` | W | Modal en prosa fuera de secciones permitidas | — |
| `KF-W-124` | W | Decimal sin comillas | `kf lint --fix` |
| `KF-W-140` | W | Evidencia no verificable (repo no montado) | montar el repositorio |
| `KF-E-141` | E | Ancla rota | `kf verify --relocate {id}` |
| `KF-W-142` | W | Ancla stale | `kf verify --update {id}` |
| `KF-E-150` | E | Faceta con confianza sin evidencia (R1) | — |
| `KF-E-201` | E | Colisión de firma canónica | — |
| `KF-W-202` | W | Duplicado probable (advisory, embeddings) | — |
| `KF-E-210` | E | Workflow de cambio escribiendo faceta observed | `kf change --facet specified` |
| `KF-E-211` | E | `CHG` apuntando a faceta observed | — |
| `KF-E-212` | E | Dos facetas observed con el mismo `target` | — |
| `KF-E-213` | E | Clase de evidencia incompatible con clase de faceta | — |
| `KF-E-214` | E | `EV.supports` apunta a entidad facetada sin faceta | — |
| `KF-E-215` | E | Agente escribiendo `override` de confianza | — |
| `KF-E-310` | E | Unidades incompatibles | — |
| `KF-E-311` | E | `exhaustive: true` sin default ni dominio probable | añadir `when: default` |
| `KF-E-312` | E | Solapamiento con `hit_policy: unique` | — |
| `KF-E-313` | E | División por cero no protegida | añadir `guard` |
| `KF-E-314` | E | Valor fuera del dominio del enum | — |
| `KF-E-315` | E | Regex no compilable en RE2 | — |
| `KF-E-316` | E | Dimensión resultante inexistente en `units.yaml` | — |
| `KF-W-317` | W | Estado inalcanzable | — |
| `KF-E-318` | E | Estado sin camino a terminal | — |
| `KF-E-319` | E | Transiciones solapadas sin `priority` | — |
| `KF-E-320` | E | Escenario contradice el `logic` de su faceta | `kf show {sc} --explain` |
| `KF-W-321` | W | Rama de decisión sin escenario | `kf create scenario --from-branch` |
| `KF-E-322` | E | `asserts.facet: observed` sin `target` | — |
| `KF-E-330` | E | Regla narrativa sin `verification.mode` | — |
| `KF-E-411` | E | Facetas specified con claves solapadas | — |
| `KF-E-413` | E | `#specified` ambiguo hoy | direccionar por scope |
| `KF-E-420` | E | `CLARIFY` con diff funcional | `kf change --type MODIFY` |
| `KF-W-421` | W | Clases de impacto subdeclaradas | — |
| `KF-E-430` | E | Semantic diff sin sección UNCHANGED | — |
| `KF-E-431` | E | Aserción negativa sin nivel de prueba | — |
| `KF-E-500` | E | Safe context excede el presupuesto | `kf context {id} --budget {min}` |
| `KF-E-601` | E | Conjunto `generated.commit` desincronizado | `kf build` |
| `KF-E-602` | E | Bloque `kf:generated` editado a mano | `kf build` |
| `KF-E-603` | E | Sección `detected` de un `DIV` editada | `kf build` |
| `KF-W-700` | W | Unknowns abiertos sobre el umbral | `kf questions --top 10` |
| `KF-W-701` | W | Override difiere >1 nivel del cómputo | — |
| `KF-E-702` | E | Historia canónica reescrita | — |
| `KF-W-703` | W | Disposition `accepted` con `expires` vencido | `kf divergences --review` |

## 43. CI

```yaml
- run: kf validate --strict
- run: kf lint
- run: kf verify
- run: kf check-rules
- run: kf coverage --fail-under governance.thresholds
- run: kf audit
- run: kf build --check          # solo el conjunto generated.commit
```

Cada PR **SHALL** producir un **Knowledge Change Summary**: CHG, tipo, si cambia comportamiento, afectados, aserciones negativas etiquetadas, deltas epistémicos, divergencias creadas o resueltas, y resultado de validación.

## 44. Gobernanza

```yaml
governance:
  approvals:
    behavioral:    [product-owner, business-sme]
    data-contract: [architect, product-owner]
    documentation: [any]
```

Git aporta PRs, reviews, historia, blame, tags, CODEOWNERS y CI.

---

# PARTE XII — AGENTES

## 45. Definiciones canónicas

Viven en `framework/agents/<name>/` (`agent.yaml` + `instructions.md`). `.claude/`, `.codex/`, `.github/` se **generan** con `kf agents export`. Nunca al revés.

```yaml
name: curator
role: "Convierte findings en conocimiento formal."
allowed_writes: ["knowledge/**/*.yaml", "knowledge/**/*.md", glossary.yaml]
forbidden_writes: ["generated/**", "changes/**", "divergences/**", "knowledge/**/observed/**"]
forbidden_actions:
  - assign IDs manually
  - write computed_confidence or override
  - write derived inverse edges
  - write observed facets
  - modify a specified facet to match a work item
required_context: [core-instructions, entity-schema, modeling-katas, target-entity, neighborhood]
required_commands_before_commit: [kf validate, kf lint, kf check-rules]
```

## 46. Agentes core

| Agente | Responsabilidad | Restricción de facetas |
|---|---|---|
| **Navigator** | Entender intención, elegir workflow, enrutar | No autora conocimiento |
| **Archaeologist** | Extraer evidencia y candidatos | Escribe **solo** facetas observed. *Discovery ≠ Truth* |
| **Curator** | Normalizar, deduplicar, formalizar, glosario | Escribe **solo** facetas specified |
| **Auditor** | Adversarial: contradicciones, evidencia ausente, refs rotas, huérfanos, duplicados, claims sin soporte, stale, ambigüedad | Solo lectura. *"Assume the KB may be wrong. Prove it."* |
| **Change Agent** | ADD/MODIFY/CLARIFY/DEPRECATE/REMOVE/SPLIT/MERGE | Escribe **solo** facetas specified vía `CHG` |
| **Impact Agent** | *"¿Qué se ve afectado si cambio X?"* | Solo lectura |
| **Librarian** | Índices, naming, taxonomía, salud del grafo | No decide business truth |

Que Archaeologist y Curator tengan permisos de escritura disjuntos por clase de faceta es lo que hace ejecutable la regla §10.2.

## 47. Workflows

`discover-existing-system · document-new-knowledge · modify-business-rule · clarify-knowledge · deprecate-entity · impact-analysis · audit-knowledge · resolve-unknown · promote-observed-to-specified · review-divergences · bootstrap-new-project · refine-work-item · verify-drift · run-golden-master · sme-interview`

`promote-observed-to-specified` es **nuevo en v2.1** y es el workflow central de la ingeniería inversa: toma una faceta observed, presenta la hipótesis a una autoridad, y si se confirma crea la faceta specified con evidencia especificadora.

### 47.1 Discovery

```
1. Definir scope
2. Identificar fuentes
3. Recolectar evidencia con anclas verificables
4. Extraer entidades candidatas (§5)
5. Crear/actualizar FACETAS OBSERVED con target explícito
6. Generar unknowns para todo hueco
7. Curator: dedup por firma canónica sobre identidad
8. Auditor
9. Persistir; el engine deriva confianza y DIV
```

### 47.2 Cambio

```
1. kf context <id>#specified --task change
2. Entender y clasificar (tipo + impact_classes)
3. Crear CHG (append-only) con decided_at y authority
4. Modificar la faceta specified (o crear pending/vN si effective_from es futuro)
5. kf impact — incluye facetas observed de la misma entidad
6. Marcar escenarios para revalidación
7. kf validate && kf check-rules
8. kf build — re-deriva DIV
9. kf audit
10. kf diff — UNCHANGED obligatorio, aserciones negativas etiquetadas
```

## 48. Progressive disclosure

Para modificar `BR-0042`, el contexto es exactamente:

```
core-instructions (≤ 500 tokens)
+ schema de faceta specified de business-rule
+ katas relevantes al rule_kind
+ change workflow
+ kf context BR-0042#specified --task change
```

Nada más. Access ≠ context.

## 49. `AGENTS.md` (generado)

```markdown
Este proyecto usa Knowledge Framework 2.1.

Una entidad es una identidad con facetas.
  specified = lo que el negocio quiere. Solo cambia vía CHG.
  observed  = lo que un sistema hace. Solo cambia vía evidencia/discovery.
Nunca escribas una para que coincida con la otra: eso es un DIV, y lo deriva el engine.

No edites nada bajo generated/ ni la sección `detected` de un DIV.
No inventes business truth: crea un UNK.
No asignes IDs: usa `kf create`.
No escribas confianza: se deriva de la evidencia de cada faceta.
No escribas aristas inversas: se derivan.
Ejecuta `kf validate && kf check-rules` antes de completar cualquier cambio.
```

---

# PARTE XIII — CONFIGURACIÓN

## 50. `knowledge.config.yaml`

```yaml
schema_version: 2.1

project: {name: Bookora, domain: appointment-management, language: es}
framework: {version: 2.1.0}
modules: [core, business-analysis, work-items]
extensions: [formulation]

ids: {padding: 4}

versioning:
  strategy: calver
  calver_format: "YYYY.MM.N"

dedup:
  algorithm: kf-normalize-v1
  trigram_threshold: 0.82
  embeddings: advisory            # advisory | disabled — nunca bloqueante

facets:
  faceted_types: [business-rule, business-process, data-entity]
  observed_target_dimensions: [repository, environment]

logic:
  exhaustiveness_proof_limit: 256
  decimal_precision: 28
  regex_dialect: re2

evidence:
  ttl_defaults:
    sme-validation: P6M
    runtime-observation: P3M
    policy-document: P12M
    regulatory-document: P24M
    documentation: P12M
  require_excerpt: true

confidence_policy: {}             # ver §17.1; default del framework si se omite

governance:
  require_evidence: true
  require_change_record: true
  min_scenarios_per_rule: 2
  min_attempts_before_sme: 2
  max_open_unknowns_per_capability: {warn: 10, error: 25}
  approvals: {behavioral: [product-owner, business-sme]}

validation:
  orphan_entities: warning
  broken_references: error
  unsupported_claims: error
  stale_evidence: warning
  prose_magnitude_mismatch: warning

drift:
  pr_check: enabled
  fail_on_stale_risk_class_gte: 2

generated:
  commit:   [changelog, summaries]
  cache:    [graph, indexes, lineage, coverage]
  artifact: [portal]

repositories:
  language_adapters: {java: tree-sitter-java, typescript: tree-sitter-typescript}
```

## 51. Extensiones y módulos

Los conceptos particulares de una empresa **SHALL NOT** contaminar Core: viven en `extensions/<domain>/` con sus `schemas/`, `terminology.yaml`, `units.yaml` y `relationships.yaml`. Una extensión **MAY** añadir tipos y aristas; **SHALL NOT** redefinir semántica de tipos core.

Módulos opcionales: Software Reverse Engineering · Business Analysis · Product Requirements · Data Governance · Architecture · Regulatory · API Contracts · Modernization · Implementation Traceability · Work Items.

---

# PARTE XIV — IMPLEMENTACIÓN

## 52. Niveles de capacidad

| Level | Contenido |
|---|---|
| **0** | Markdown · YAML · IDs · Schemas · facetas |
| **1** | Validación · integridad referencial · **verificación de anclas · drift · `pr-check`** |
| **2** | Agent workflows: discovery, curator, audit, change, impact |
| **3** | Graph intelligence: traversal, context packs, impact |
| **4** | Temporal: revisiones, bitemporalidad, semantic diff, CHG, DIV derivados |
| **5** | Trazabilidad: mappings, golden master, sync-status |
| **6** | Experiencias generadas: portal, chatbot, API, grafo visual |
| **7** | Avanzado: detección de contradicciones, predicción, generación automática de preguntas SME |

## 53. Orden de construcción

Criterio: *primero lo que cambia el formato de los datos; después lo que no obliga a remodelar.*

**Fase A — formato (irreversible si se hace mal)**
1. JSON Schemas de los 11 tipos core **con facetas**, `schema_version: 2.1`.
2. Registro de IDs con semántica `provisional`/`permanent`.
3. Contrato `EvidenceResolver` + resolver de `source-code` (tree-sitter, un lenguaje) + resolver de `database-schema`.
4. Clases de evidencia y cómputo de confianza por clase de faceta; `computed_confidence` / `override`.
5. `kf validate` con el catálogo completo, incluido `KF-E-105` (inversas) y `KF-E-210/211` (escritura cruzada de facetas).

**Fase B — ontología (evita remodelar el corpus)**
6. **Los 15 katas**, validando en CI. Incluyendo los tres nuevos de faceting.
7. `kf-normalize-v1` + dedup en `create`/`change`/`update`/`validate`.
8. `kf lint` con contrato prosa/YAML y bloques generados.

**Fase C — verdad ejecutable**
9. `logic`: decision-table, formula, state-machine; decimal, unidades sin conversión, RE2.
10. `kf check-rules` con `asserts`.
11. Golden master.

**Fase D — tiempo y divergencia**
12. Ledger de `CHG` con `decided_at`; revisión derivada.
13. **Derivación de `DIV`** (diff estructural + diferencial por escenarios) con clave estable y ownership dividido.
14. `kf diff` con UNCHANGED y los tres niveles de aserción negativa.
15. CalVer, `kf release`, baselines, `kf sync-status`.

**Fase E — grafo y agentes**
16. `kf build` → `graph.json` con facetas y `observed_without_specified`.
17. `kf context` con safe context y `KF-E-500`.
18. `kf impact`.
19. Definiciones canónicas de agentes con permisos disjuntos por faceta + export.

**Fase F — bucle de incentivos**
20. `mappings/` + `kf verify` sobre ellos.
21. `kf pr-check` + artefacto de `ack` + adapter GitHub/ADO.
22. `kf questions` (cinco fuentes) + `interview-pack`.

**Fase G — todo lo demás**
Work items, refinamiento, portal, chatbot, Graph DB, webhooks.

## 54. Presupuesto de complejidad

V1 **SHALL** ser: 1 repositorio Git · 1 CLI · 1 sistema de schemas · 1 workflow de CI · **0 bases de datos · 0 servidores · 0 servicios cloud obligatorios.**

> **Ante cualquier complejidad nueva:** *«¿Esto añade capacidad al modelo de conocimiento, o estamos construyendo infraestructura por la infraestructura misma?»*
>
> Preferir **modelo persistente simple + capacidades generadas potentes** sobre **infraestructura persistente compleja**.
>
> **El Knowledge Base SHALL seguir siendo comprensible abriendo el repositorio en un editor de texto.**

### 54.1 Nota honesta sobre el coste del faceting

Facetar tres tipos es el cambio más caro que se ha hecho al metamodelo, y encarece los katas y el fixture más que el engine. Si en algún momento hace falta recortar, el corte natural es **dejar `BP` sin facetar en v1**: se pierde poder representar que legacy y el backend nuevo tienen flujos distintos — probablemente justo lo que hará falta en el primer caso real. Queda dicho para que sea una decisión y no una sorpresa.

## 55. Fixture de conformidad

`framework/conformance/acme-formulation/`: 2 `CAP`, 4 `BP` (uno con dos facetas), 8 `BR` (uno de cada `rule_kind`, uno `narrative` con `verification.mode`, uno con `POL` que lo sobreescribe, **dos con facetas observed divergentes**), 6 `DE` (uno con faceta observed extraída de esquema de BD), 24 `SC` (18 `asserts: specified`, 6 `asserts: observed`), 14 `EV` (de cada clase y tipo, uno broken, uno stale, uno expirado), 3 `UNK`, 2 `DSP`, 5 `CHG`, y un repositorio de código de juguete para anclar.

Los `DIV` **SHALL NOT** poblarse a mano: el fixture es correcto solo si el engine los deriva.

Una implementación es conforme si y solo si reproduce `conformance/expected/`:

```
kf validate                          → exit 0, 0 errores, 4 warnings esperados
kf validate --strict                 → exit 2
kf check-rules                       → exit 0, 24/24 consistentes contra su faceta
kf verify                            → 11 fresh, 1 stale, 1 broken, 1 unverifiable
kf build                             → deriva exactamente 2 DIV
                                       DIV-0001 behavioral-divergence (scenario-differential)
                                       DIV-0002 structural-difference (path-diff)
kf context BR-0002 --budget 4000     → KF-E-500, required_minimum_budget: 5200
kf context BR-0002 --budget 6000     → incluye DIV-0001, DSP-0001, UNK-0002 sin truncar
kf impact BR-0002#specified          → 3 directos, 7 indirectos,
                                       4 PROVEN_UNAFFECTED, 5 NO_IMPACT_PATH_FOUND
kf diff BR-0002#specified@1 @2       → UNCHANGED ≥5 entradas, toda negativa etiquetada
kf release --dry-run                 → 2027.02.1
kf questions --top 3                 → UNK-0002 primero (prioridad 9.6)
kf questions --promotions            → 2 candidatos
kf golden run                        → 1 intentional-change, 0 regressions
kf build --check                     → exit 0
```

**El fixture es la definición operativa de "terminado".** Cada feature **SHALL** implementarse junto con su porción del fixture, nunca después: un fixture escrito después del engine se convierte en una justificación del engine.

## 56. Milestone 1

1. Inicializar un Knowledge Project (greenfield sin facetas visibles)
2. Crear entidades con IDs asignados por el engine y semántica provisional/permanent
3. Validar schemas, referencias, relaciones tipadas y ownership de aristas
4. Registrar evidencia con anclas verificables por resolver genérico y detectar drift
5. Derivar confianza por faceta según clase de evidencia
6. Crear unknowns y priorizar la cola de SMEs con sus cinco fuentes
7. Expresar `logic` en las tres gramáticas evaluables y verificarlo contra escenarios facetados
8. Derivar divergencias con clave estable y disposition preservada
9. Generar `graph.json` con facetas
10. Servir context packs con safe context garantizado
11. Impact analysis con aserciones negativas etiquetadas
12. Registrar CHG sobre facetas specified y derivar revisión y release CalVer
13. Generar semantic diff con UNCHANGED
14. Auditorías adversariales
15. Operar vía agentes con permisos disjuntos por faceta y progressive disclosure
16. Funcionar en workspace multi-repo con `pr-check` y artefacto de `ack`

---

# APÉNDICES

## A. Los tres productos

**System Digital Twin.** Modelo navegable. Responde *¿cómo funciona X hoy? ¿qué debería hacer? ¿en qué difieren? ¿qué pasa si cambio BR-0037?*

**Business Specification.** Las facetas specified, separadas de toda implementación.

**Modernization Blueprint.** `facetas observed + nuevos requisitos → facetas specified TO-BE → arquitectura → plan`. El faceting es precisamente lo que hace este producto expresable sin trampas.

## B. Query ideal

> *Explica exactamente cómo funciona el ajuste de viscosidad.*

```
Participa en: BP-0012, BP-0018, BP-0027

SPECIFIED (v4, todas las BU, desde 2026-06-01, confirmed vía EV-0118 regulatory-document)
  Inputs: A (origen SAP), B (formulation DB), C (calculado por BR-0078)
  BR-0078 tiene tres ramas; BU-A la sobreescribe vía POL-0103 (scope: business_unit=A)
  Outputs: OUT-0019, OUT-0022

OBSERVED
  legacy-app/production  coincide con specified salvo rama 3 (DIV-0003, accepted hasta Q3)
                         confirmed vía EV-0201 (golden-master, passing)
  backend                coincide con specified — corroborated

Persistencia: FORMULATION.VISCOSITY, ADJUSTMENT_LOG
Integración: INT-0006
Escenarios: SC-0044, SC-0051 (specified) · SC-0119 (observed:legacy-app) — todos pasando
Implementación: backend/ViscosityAdjustmentPolicy (mapping fresh)
Tests: ViscosityCalculationTest

⚠ Se apoya en 1 afirmación inferred: rama 3 de BR-0078#specified (UNK-0022 abierto,
  prioridad 7.1, candidata a promoción desde observed:legacy-app).
```

## C. Consultas que el framework debe poder responder

**Cobertura:** ¿qué facetas specified no están implementadas? ¿cuáles no tienen tests? ¿qué historias cambiaron comportamiento sin referencias? ¿qué CHG aprobados no tienen Story? ¿qué ramas no están cubiertas? ¿qué evidencia está stale? ¿qué unknowns bloquean una capability? **¿qué facetas observed no tienen specified?**

**Linaje:** ¿de dónde viene `concentration`? ¿qué procesos consumen `DE-0018`? ¿qué reglas modifican este campo? ¿qué integración recibe este outcome? ¿qué tablas lo persisten?

**Temporales:** ¿cómo funcionaba `BR-0037#specified` el 15/12/2026? ¿qué cambió entre releases? ¿qué está aprobado pero no implementado? ¿qué repos están atrasados?

**Divergencia:** ¿qué sistemas divergen de lo especificado? ¿qué divergencias aceptadas expiran este trimestre? ¿qué divergencias son estructurales y cuáles conductuales probadas?

## D. Neutralidad y seguridad

**Sin vendor lock-in.** El valor vive en Markdown, YAML, Schemas, Git, IDs, evidencia e historia. **SHALL NOT** vivir en formatos propietarios de vector DB, memoria de un proveedor de LLM, ni agent stores cloud-específicos.

**Neutralidad de herramienta.** `Core → Adapter → Provider`. El Core **SHALL NOT** conocer detalles internos de proveedores. Debe funcionar con Codex, Claude Code, Copilot, BMAD y frameworks futuros.

**BMAD y similares:** no reemplazar, potenciar. Kit: `kb-context`, `kb-refine-story`, `kb-refine-bug`, `kb-create-story`, `kb-impact`, `kb-build-context`, `kb-review`, `kb-sync`.

**Seguridad.** Código, bases de datos, logs, documentación de negocio, tickets y datos sensibles **SHALL** entrar solo en herramientas y modelos aprobados por la organización. El framework **SHALL** poder operar completamente local o dentro de infraestructura corporativa.

## E. Distribución

Opción abierta de paquete NPM (`npx kf init`). Pero:

> «La implementación como paquete NPM SHALL NOT condicionar prematuramente la arquitectura Core.»

Primero protocolo y comportamiento. Después distribución.

## F. Alcance de la documentación

**Documentar:** business rules · inputs · outputs · transformaciones · significado de los datos · flujos · excepciones · dependencias · estados · actores · efectos externos.

**No documentar:** variables locales · posiciones de píxeles · internals de helpers privados · detalle incidental — salvo relevancia de negocio demostrable.

## G. Katas requeridos

Los 15 de v2.0, más tres obligatorios de faceting:

1. Umbral con exención
2. Regla usada por dos procesos
3. Política configurable por business unit
4. Derivación en cadena
5. Regla con efecto temporal futuro (faceta specified pendiente)
6. Proceso con ramas de excepción
7. Entidad de datos con linaje cross-sistema
8. Comportamiento observado sin regla especificada → candidato a promoción
9. Conocimiento contradicho por un bug → `DSP` sobre faceta
10. Regla aparentemente duplicada que no lo es
11. Regla partida en exceso
12. Autorización vs. elegibilidad
13. Invariante vs. validación de UI
14. Evento vs. outcome
15. Actor humano fuera del código
16. **(nuevo)** Dos sistemas implementando la misma regla de forma distinta durante una migración
17. **(nuevo)** Diferencia estructural que NO es divergencia conductual
18. **(nuevo)** Promoción de observed a specified con evidencia especificadora

## H. Filosofía

Pasar de:

> *"Aquí tienes código y tickets. Arréglatelas."*

a:

> *"Aquí tienes un modelo explícito, estructurado, versionado y respaldado por evidencia de qué significa el negocio, qué hace hoy cada sistema, en qué difieren, y cómo cada artefacto de implementación se relaciona con esa verdad."*

> «Crear una representación digital duradera, versionada y respaldada por evidencia de lo que un producto de software sabe, lo que debería hacer, lo que hace hoy, cómo cambia, y cómo cada artefacto de implementación se relaciona con esa verdad.»

---

*Fin de Core Specification v2.1 — CONGELADA*
