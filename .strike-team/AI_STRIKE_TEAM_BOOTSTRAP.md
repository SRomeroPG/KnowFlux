# AI Strike Team Bootstrap & Operating Protocol

**Purpose:** Development-only strike team for building the Knowledge Framework defined by **Core Specification v2.1**.

**Status:** Operational bootstrap document.

**Important:** This strike team is **NOT part of the Knowledge Framework product**. It exists only to help build the framework. Files under `.strike-team/` are development-control artifacts and must not become runtime/product requirements or be shipped in the eventual NPM package.

---

## 0. Mission

Create two independent AI engineering teams that work **sequentially**, never as a cross-vendor live swarm:

1. **Codex Implementation Team** — owns implementation and remediation.
2. **Claude Audit Team** — owns independent adversarial audit and final acceptance.

The teams alternate until Claude concludes that the phase implementation requires **no further changes**.

The desired loop is:

```text
Frozen Spec v2.1
      ↓
Codex implements an entire phase
      ↓
Codex produces implementation handoff
      ↓
Human switches to Claude Code
      ↓
Claude audits with adversarial scrutiny
      ↓
┌───────────────────────────────┐
│ Findings requiring changes?   │
└──────────────┬────────────────┘
               │
        YES    │    NO
         ↓     │     ↓
Human switches│   PHASE ACCEPTED
back to Codex │
         ↓
Codex remediates every accepted finding
         ↓
Codex produces remediation handoff
         ↓
Human switches to Claude Code
         ↓
Claude independently re-audits
         ↓
repeat until ACCEPTED
```

There is **no requirement and no expectation** that Codex can invoke Claude agents or that Claude can invoke Codex agents.

Cross-vendor coordination occurs entirely through committed repository artifacts.

---

# 1. Non-negotiable constraints

## 1.1 Frozen specification

The Knowledge Framework Core Specification v2.1 is normative and frozen.

The teams SHALL treat every `SHALL` and `SHALL NOT` as an implementation contract.

The teams SHALL NOT silently invent missing product semantics.

If implementation cannot proceed without inventing semantics not present in the specification, create a `SPEC_GAP` artifact and stop only the affected workstream.

Do not modify the frozen specification as part of normal implementation or audit.

New product ideas that do not block implementation belong in a future-version backlog, not in the current phase.

---

## 1.2 Quality before token optimization

Priority order:

1. Correctness against the frozen specification.
2. Conformance and regression safety.
3. Maintainability and architectural coherence.
4. Efficient context use.
5. Token/model-cost optimization.

Token optimization SHALL NEVER justify:

- skipping a normative requirement;
- weakening tests;
- ignoring an audit finding;
- hiding uncertainty;
- inventing behavior;
- reducing an audit from adversarial to superficial;
- declaring a phase accepted without evidence.

When budget pressure exists, reduce unnecessary delegation, context duplication, concurrency, and model tier for mechanical tasks before reducing quality.

---

## 1.3 Included-plan constraint

The user operates Codex and Claude Code primarily through approximately **$20/month plans**.

Therefore:

- Do not assume unlimited model usage.
- Do not automatically use credit-based/pay-as-you-go/add-on capacity.
- Do not select a model that incurs additional paid credits unless the user explicitly authorizes it.
- Astra or any equivalent premium/add-on model is **disabled by default** for this strike team.
- Prefer the strongest model included in the currently available plan for genuinely difficult work, and cheaper included models for bounded/mechanical work.
- If an ideal model is unavailable under the active plan, use the strongest included fallback and compensate with narrower tasks, stronger verification, or an independent second pass.
- Never relax acceptance criteria because a premium model is unavailable.

---

# 2. Runtime capability discovery

This document may be given to either Codex or Claude Code.

Before creating provider-native agents, the receiving orchestrator SHALL inspect what the **current installed extension/runtime actually supports**.

Determine:

- current vendor: `codex` or `claude`;
- supported project-scoped agent/subagent mechanism;
- whether subagents can be created dynamically;
- whether per-subagent model selection is supported;
- available included models;
- available reasoning/effort controls;
- whether concurrent subagents share a mutable workspace;
- whether project-scoped skills/instructions are supported.

Do not invent unsupported configuration files or capabilities.

If the runtime supports heterogeneous models per specialist, use the routing policy in this document.

If the runtime forces all subagents to use the same model:

1. keep the runtime-supported model;
2. vary reasoning/effort if supported;
3. narrow task scope aggressively;
4. use subagents only where isolated context or parallelism materially helps;
5. record the limitation in `.strike-team/ENVIRONMENT.md`.

The strike team protocol must work even when heterogeneous model routing is unavailable.

---

# 3. Shared development control plane

Create this development-only structure in the repository:

```text
.strike-team/
├── README.md
├── ENVIRONMENT.md
├── STATE.yaml
├── PHASES.md
│
├── phases/
│   └── P001-<phase-name>/
│       ├── PLAN.md
│       ├── TRACEABILITY.md
│       ├── CODEX_HANDOFF.md
│       ├── audits/
│       │   ├── CLAUDE_AUDIT_R01.md
│       │   ├── CLAUDE_AUDIT_R02.md
│       │   └── ...
│       ├── remediation/
│       │   ├── CODEX_REMEDIATION_R01.md
│       │   ├── CODEX_REMEDIATION_R02.md
│       │   └── ...
│       └── evidence/
│
├── spec-gaps/
│   └── SG-0001.md
│
├── future-backlog/
│   └── README.md
│
└── decisions/
    └── README.md
```

These files are the communication layer between Codex and Claude.

They SHOULD be committed so the next tool/session receives exact state.

They SHALL be excluded from the eventual distributed Knowledge Framework package.

Do not use `.strike-team/` as a substitute for product documentation or source code documentation.

---

# 4. Shared state machine

`.strike-team/STATE.yaml` SHALL track at minimum:

```yaml
schema_version: 1

project: knowledge-framework
normative_spec: knowledge-framework-spec-v2.1
spec_status: frozen

current_phase:
  id: P001
  name: ""
  status: PLANNED
  audit_round: 0

status_values:
  - PLANNED
  - CODEX_IMPLEMENTING
  - CODEX_READY_FOR_AUDIT
  - CLAUDE_AUDITING
  - CHANGES_REQUESTED
  - CODEX_REMEDIATING
  - CLAUDE_REAUDITING
  - ACCEPTED
  - BLOCKED_BY_SPEC_GAP

last_codex_commit: null
last_claude_audit: null
open_required_findings: 0
open_spec_gaps: []
```

Allowed progression:

```text
PLANNED
  ↓
CODEX_IMPLEMENTING
  ↓
CODEX_READY_FOR_AUDIT
  ↓
CLAUDE_AUDITING
  ├─→ ACCEPTED
  └─→ CHANGES_REQUESTED
          ↓
     CODEX_REMEDIATING
          ↓
     CLAUDE_REAUDITING
          ├─→ ACCEPTED
          └─→ CHANGES_REQUESTED
```

No team may skip the independent audit gate.

---

# 5. Phase contract

Development proceeds in explicit phases derived from the frozen specification.

Every phase SHALL have a `PLAN.md` before implementation begins.

Minimum template:

```markdown
# Pxxx — Phase Name

## Objective

## Normative specification coverage
- §...
- SHALL ...
- SHALL NOT ...

## Deliverables

## In scope

## Out of scope

## Dependencies

## Risk classification
LOW | MEDIUM | HIGH | CRITICAL

## Planned agent delegation

## Verification plan

## Conformance fixture changes required

## Entry criteria

## Exit criteria

## Known spec gaps
None / list
```

---

# 6. Traceability is mandatory

`TRACEABILITY.md` maps implementation to normative requirements.

Minimum structure:

```markdown
| Spec reference | Requirement | Implementation | Verification | Status |
|---|---|---|---|---|
| §x.y | SHALL ... | path/file | test/fixture | PASS |
```

The Codex team SHALL update this during implementation.

The Claude team SHALL use it as an index, but SHALL NOT trust it blindly.

Claude must independently inspect the implementation and source specification.

A missing traceability row for an implemented normative requirement is itself an audit finding.

---

# 7. Codex Implementation Team

## 7.1 Mission

The Codex team owns the complete implementation of each phase from planning through a handoff that is ready for independent audit.

It also owns remediation after Claude findings.

It SHALL NOT declare final phase acceptance.

---

## 7.2 Codex Orchestrator / Implementation Lead

Create one root implementation orchestrator.

Responsibilities:

- read and preserve the frozen spec;
- decompose the phase;
- determine risk and model tier per task;
- create/manage Codex subagents;
- prevent conflicting simultaneous edits;
- integrate subagent work;
- maintain `TRACEABILITY.md`;
- ensure conformance fixture evolves with the implementation;
- run all required tests/checks;
- inspect subagent output instead of trusting summaries;
- create the final Codex handoff;
- remediate Claude findings;
- escalate real specification gaps instead of inventing behavior.

The orchestrator SHALL remain responsible for the complete phase even when most implementation is delegated.

---

## 7.3 Codex specialist roles

Create native Codex specialists equivalent to these roles.

### A. Spec Analyst

Purpose:

- extract exact normative requirements for the current bounded task;
- identify dependencies and forbidden interpretations;
- produce a concise requirement pack for implementers.

Mostly read-only.

Use before implementing high-risk or cross-cutting spec sections.

---

### B. Core Implementer

Purpose:

- implement bounded production-code changes;
- preserve architecture and public contracts;
- write meaningful tests where required;
- report all deviations and uncertainties.

May edit source.

---

### C. Schema / Data Contract Engineer

Purpose:

- JSON Schemas;
- canonical structures;
- validation contracts;
- ID and relation semantics;
- deterministic serialization/normalization.

Use especially in format/metamodel phases.

---

### D. Conformance & Test Engineer

Purpose:

- implement tests from normative SHALL/SHALL NOT rules;
- evolve the conformance fixture in parallel with features;
- prevent implementation-shaped fixtures;
- add negative tests for diagnostics and invalid states;
- verify deterministic output.

This role SHOULD be independent from the agent that wrote the production implementation when practical.

---

### E. Integration / Regression Engineer

Purpose:

- inspect interactions across modules;
- run broader tests;
- look for cross-cutting regressions;
- validate CLI/API behavior and filesystem effects;
- verify clean-checkout reproducibility.

---

### F. Mechanical Worker

Purpose:

- repetitive schema cases;
- fixtures already precisely specified;
- formatting;
- test-data population;
- documentation synchronization;
- simple search/refactor tasks with exact acceptance criteria.

This agent SHALL NOT make architecture or product-semantics decisions.

---

## 7.4 Codex self-review

Codex SHALL perform internal review before handing work to Claude.

This internal review improves quality but does not replace the Claude audit.

The Codex team should catch obvious issues itself so Claude spends its expensive audit budget on subtle problems.

---

# 8. Claude Audit Team

## 8.1 Mission

The Claude team acts as an independent adversarial audit organization.

Its job is not to continue Codex's implementation approach.

Its job is to determine whether the implementation actually conforms to the frozen specification and whether it is robust.

The Claude team SHALL assume:

- the implementation may be wrong;
- the tests may be incomplete;
- the conformance fixture may accidentally mirror the implementation;
- Codex summaries may be incomplete;
- previous remediation claims require independent verification.

---

## 8.2 Audit-only boundary

Claude SHALL NOT modify product/framework implementation files during normal audit.

Claude MAY create/update only:

```text
.strike-team/phases/<phase>/audits/**
.strike-team/spec-gaps/**     # only when a real spec gap is discovered
```

Claude MAY run read-only analysis, builds, tests, linters, and verification commands.

If an audit requires destructive mutation to reproduce an issue, use an isolated temporary copy/worktree if available.

Preserving auditor independence is more important than convenience.

---

## 8.3 Claude Audit Orchestrator

Create one root Claude audit orchestrator.

Responsibilities:

- determine audit strategy;
- assign specialist auditors;
- control token/model use;
- deduplicate findings;
- verify every important finding;
- distinguish implementation defect from spec gap;
- ensure the audit covers both positive and negative behavior;
- issue the final audit verdict.

The orchestrator SHALL NOT accept the phase because tests pass.

It must examine the actual implementation.

---

## 8.4 Claude specialist roles

### A. Specification Compliance Auditor

Purpose:

- trace every relevant SHALL/SHALL NOT into code and tests;
- find unimplemented clauses;
- find semantics that code invented;
- identify mismatches in state, data models, algorithms, diagnostics, or behavior.

This is the primary auditor.

---

### B. Adversarial Architecture Auditor

Purpose:

- look for architectural shortcuts that violate spec invariants;
- hidden duplication;
- wrong ownership;
- nondeterminism;
- accidental coupling;
- leaky abstractions;
- state or lifecycle inconsistencies;
- fragile branch/workspace behavior.

Use strongest available audit tier for high-risk phases.

---

### C. Test & Conformance Auditor

Purpose:

- inspect whether tests prove the normative behavior;
- identify tests that simply mirror implementation;
- attack the conformance fixture;
- design missing negative/boundary cases;
- rerun relevant checks independently.

---

### D. Algorithm / Determinism Auditor

Purpose:

- normalization;
- hashing/signatures;
- ordering;
- graph traversal;
- confidence derivation;
- evidence verification;
- context budgets;
- DIV derivation;
- temporal/version logic;
- stable IDs;
- deterministic diagnostics.

Use when the phase contains algorithms where tiny semantic errors have broad consequences.

---

### E. Integration / Regression Auditor

Purpose:

- verify effects outside the directly modified files;
- check CLI surfaces;
- clean checkout behavior;
- filesystem/state transitions;
- backward/forward interactions;
- phase-to-phase assumptions.

---

### F. Mechanical Audit Worker

Purpose:

- exhaustive search for forbidden fields/patterns;
- compare generated outputs;
- enumerate schema cases;
- run test matrices;
- inspect repetitive artifacts.

Use low-cost models where possible.

---

# 9. Model routing policy

Model names evolve. The strike team SHALL route by **capability tier**, then map to currently available included models.

## 9.1 Capability tiers

### TIER A — Lead / critical reasoning

Use for:

- phase decomposition;
- frozen-spec interpretation;
- metamodel changes;
- cross-cutting algorithms;
- difficult debugging;
- finding adjudication;
- final integration review;
- final audit verdict for high-risk phases.

Use sparingly.

---

### TIER B — Senior specialist

Use for:

- normal production implementation;
- bounded architecture work;
- test design;
- schema implementation;
- spec compliance audit;
- nontrivial debugging.

This should carry most serious work.

---

### TIER C — Mechanical / bounded

Use for:

- repetitive fixtures;
- formatting;
- simple tests with exact expected outputs;
- searches;
- enumerations;
- documentation synchronization;
- straightforward refactors.

Never assign unresolved architecture or semantics to Tier C.

---

## 9.2 Codex default mapping

Under the user's included-plan constraint:

```text
TIER A:
  Preferred: strongest INCLUDED Codex/OpenAI reasoning/coding model.
  Current default target: GPT-5.6 Sol with high reasoning, if available in-plan.
  Astra: DO NOT USE by default. Requires explicit user opt-in.

TIER B:
  GPT-5.6 Sol at medium/high reasoning
  OR the strongest included balanced coding model offered by the current Codex runtime.

TIER C:
  GPT-5.6 Terra or the current included fast/efficient coding model,
  low/medium reasoning as appropriate.
```

If the installed Codex extension cannot choose a different model per subagent, use the strongest sustainable included model and control cost through:

- smaller contexts;
- lower reasoning for mechanical work;
- fewer subagents;
- sequential delegation;
- bounded tasks.

Do not fabricate per-agent model configuration if the runtime does not support it.

---

## 9.3 Claude default mapping

Under the user's included-plan constraint:

```text
Audit Orchestrator:
  Default: Claude Sonnet 5, high/adaptive reasoning where available.

TIER A audit escalation:
  Claude Opus 5 only when:
    - available under the current included allowance,
    - the task is HIGH/CRITICAL,
    - or performing final acceptance of a high-risk phase.
  If quota pressure is high, use Sonnet 5 high plus a second independent audit pass.

TIER B:
  Claude Sonnet 5, medium/high effort.

TIER C:
  Claude Haiku 4.5 when available and adequate,
  otherwise Sonnet at lower effort.
```

Do not spend Opus quota on:

- grep/search;
- formatting;
- enumerating files;
- mechanical test execution;
- obvious low-risk checks.

---

# 10. Complexity and risk routing

Before delegation, classify the task.

## LOW

Examples:

- formatting;
- exact fixture population;
- deterministic boilerplate;
- simple isolated test data.

Route to Tier C.

---

## MEDIUM

Examples:

- isolated schema;
- bounded CLI command;
- local validator;
- unit tests for an already-specified algorithm.

Route to Tier B, or Tier C with Tier B review.

---

## HIGH

Examples:

- cross-module behavior;
- persistence/state transitions;
- graph traversal;
- evidence resolver;
- context pack;
- DIV derivation;
- temporal behavior;
- ID lifecycle;
- concurrent/branch semantics.

Route implementation/audit to Tier A or strong Tier B with Tier A review.

---

## CRITICAL

Examples:

- ambiguity in frozen normative semantics;
- change that would reshape persistent formats;
- change to core metamodel;
- security or destructive behavior;
- conformance definition;
- evidence/confidence logic capable of producing false certainty.

Root orchestrator must directly own the task.

Do not delegate final interpretation.

---

# 11. Subagent spawning policy

Subagents cost context and quota.

Use them when they materially improve quality or isolation.

Spawn a subagent when one or more are true:

- independent workstreams exist;
- specialist expertise is useful;
- isolated context reduces confusion;
- an independent second opinion materially improves confidence;
- a task can proceed on disjoint files safely;
- audit coverage benefits from independent hypotheses.

Do not spawn for:

- a trivial search;
- a one-file obvious edit;
- a short sequential operation;
- work whose next step depends tightly on the previous result;
- multiple agents that would edit the same mutable files;
- delegation merely to "look busy."

Default maximum concurrent subagents for this project: **2**.

May increase to **3** only when:

- tasks are genuinely independent;
- file ownership is disjoint or read-only;
- the orchestrator expects a net quality/time benefit.

Avoid deeper-than-one-level subagent trees unless the orchestrator explicitly determines that nested specialization materially improves the result.

---

# 12. Shared-file safety

Parallel writing is allowed only when file sets are disjoint.

If two agents may edit the same file or tightly coupled generated state:

- run sequentially; or
- use isolated worktrees/branches if the runtime supports them safely.

The orchestrator owns final integration.

Subagents SHALL NOT independently merge competing edits without orchestrator review.

Claude auditors are normally read-only and therefore may parallelize more aggressively.

---

# 13. Context discipline

The frozen specification is large.

Do not paste the entire specification into every subagent.

The orchestrator SHALL build a bounded task context containing:

1. phase objective;
2. exact relevant spec sections;
3. directly related schemas/code;
4. required invariants;
5. acceptance tests;
6. known dependencies;
7. explicit non-goals.

Include the entire spec only when the task genuinely requires global interpretation.

Subagents may request additional sections if necessary.

No subagent may assume unread portions of the spec.

---

# 14. Codex phase workflow

## Step 1 — Read state

Read:

```text
.strike-team/STATE.yaml
.strike-team/PHASES.md
current phase PLAN.md
current TRACEABILITY.md
frozen spec
```

---

## Step 2 — Plan

The Codex Orchestrator:

- enumerates normative requirements;
- classifies risk;
- assigns agent/model tiers;
- identifies conformance fixture work;
- identifies likely integration points;
- updates `PLAN.md`.

---

## Step 3 — Implement

Delegate bounded work.

Each implementation subagent returns:

```text
Task
Files changed
Spec clauses implemented
Tests added/updated
Commands run
Remaining uncertainty
Potential spec gap
```

The orchestrator inspects actual diffs.

---

## Step 4 — Verify

At minimum:

- targeted tests;
- required broader tests;
- conformance fixture portion;
- lint/typecheck/build where applicable;
- clean-generation checks;
- deterministic/repeat run where required.

Never stop merely because newly added tests pass.

---

## Step 5 — Internal adversarial review

Have a Codex reviewer/test agent challenge the implementation.

Resolve issues before Claude handoff.

---

## Step 6 — Produce handoff

`CODEX_HANDOFF.md` SHALL contain:

```markdown
# Codex Implementation Handoff

## Phase

## Commit / working tree state

## What was implemented

## Normative clauses covered

## Files changed

## Tests and commands run
- command
- result

## Conformance fixture status

## Deliberate design choices permitted by spec

## Known limitations
None / list

## SPEC_GAPs
None / list

## Areas that deserve aggressive audit

## Traceability status
Complete / incomplete
```

Set state to:

```text
CODEX_READY_FOR_AUDIT
```

Then stop.

The human will switch to Claude Code.

---

# 15. Claude audit workflow

## Step 1 — Establish independence

Read:

- frozen spec;
- phase `PLAN.md`;
- `TRACEABILITY.md`;
- Codex handoff;
- actual diff/code;
- tests;
- fixture.

Treat the handoff as orientation, not evidence.

---

## Step 2 — Build audit plan

The Claude Audit Orchestrator assigns auditors based on risk.

For high-risk phases, use multiple independent audit angles.

Example:

```text
Compliance Auditor
Algorithm Auditor
Test/Conformance Auditor
Integration Auditor
```

---

## Step 3 — Audit adversarially

At minimum inspect:

- all normative phase requirements;
- forbidden behavior;
- failure modes;
- boundary conditions;
- deterministic behavior;
- tests and fixture independence;
- generated/stateful effects;
- integration effects;
- unimplemented SHALLs;
- accidental semantics not in spec.

---

## Step 4 — Findings

Every actionable finding gets a stable ID:

```text
CLAUDE-P001-R01-F001
```

Required finding format:

```markdown
## CLAUDE-P001-R01-F001

Severity: CRITICAL | HIGH | MEDIUM | LOW
Disposition: REQUIRED
Status: OPEN

### Spec reference
§...

### Requirement
Exact normative requirement in concise form.

### Evidence
file:line / command / output

### Actual behavior

### Expected behavior

### Why this matters

### Reproduction
1.
2.
3.

### Remediation constraint
Describe what must become true.
Do not invent new product semantics.
```

If no code correction can be prescribed without inventing semantics:

```text
Classification: SPEC_GAP
```

and create `.strike-team/spec-gaps/SG-xxxx.md`.

---

## Step 5 — Severity semantics

### CRITICAL

Fundamental violation capable of invalidating correctness, data integrity, security, determinism, or core model semantics.

### HIGH

Direct violation of an important `SHALL`/`SHALL NOT`, conformance failure, or broad behavioral defect.

### MEDIUM

Material correctness/maintainability/test weakness that requires remediation before acceptance.

### LOW

Real defect or required cleanup with limited impact.

### ADVISORY

Optional idea. No change required for acceptance.

**ADVISORY is not an actionable finding.**

Do not disguise required work as advisory, and do not block acceptance on purely optional taste.

---

## Step 6 — Audit verdict

End each audit with exactly one:

```text
VERDICT: CHANGES_REQUESTED
```

or

```text
VERDICT: ACCEPTED
```

`ACCEPTED` means:

- zero open REQUIRED findings;
- no unresolved audit-discovered spec gap affecting this phase;
- conformance requirements pass;
- the auditor has no further change it requires.

Optional advisories may remain, explicitly marked non-required.

If changes are requested, set state accordingly and stop.

The human will switch back to Codex.

---

# 16. Codex remediation workflow

On receiving a Claude audit:

1. Read every finding.
2. Independently verify it.
3. Classify each:

```text
ACCEPTED
REJECTED_WITH_EVIDENCE
SPEC_GAP
```

4. Never dismiss a finding because "tests pass."
5. Fix every accepted finding.
6. Add regression tests where appropriate.
7. Run relevant full checks.
8. Update traceability when required.
9. Produce `CODEX_REMEDIATION_Rxx.md`.

Template:

```markdown
# Codex Remediation Rxx

## Finding: CLAUDE-P001-R01-F001
Decision: ACCEPTED

### Root cause

### Changes

### Files

### Verification

### Regression protection

---

## Finding: ...
Decision: REJECTED_WITH_EVIDENCE

### Reason

### Evidence

---
```

A rejected finding is not considered closed until Claude independently agrees on re-audit.

Set state:

```text
CLAUDE_REAUDITING
```

and stop for human handoff.

---

# 17. Claude re-audit workflow

Claude SHALL NOT merely read the remediation report and mark items done.

For every prior finding:

- reopen original evidence;
- inspect actual change;
- rerun reproduction/test when feasible;
- verify regression protection;
- check whether the fix introduced new issues.

Then perform a focused regression audit around modified areas.

If any required issue remains or a new required issue appears:

```text
VERDICT: CHANGES_REQUESTED
```

Otherwise:

```text
VERDICT: ACCEPTED
```

Only Claude's accepted verdict closes the phase.

---

# 18. Specification gaps

When a real gap is found, create:

```text
.strike-team/spec-gaps/SG-0001.md
```

Template:

```markdown
# SG-0001 — Short title

## Discovered in
Phase:
Team:
Agent:

## Relevant spec sections

## Missing semantic decision

## Why implementation cannot proceed safely

## Concrete alternatives discovered
Only list alternatives; do not choose one unless the existing spec logically determines it.

## Affected workstreams

## Unaffected work that may continue

## Required decision authority
User / future spec revision
```

The affected workstream stops.

Unrelated phase work may continue if safe.

A coding agent SHALL NOT silently resolve a `SPEC_GAP`.

---

# 19. Future ideas

Good ideas that are not required by v2.1 go into:

```text
.strike-team/future-backlog/
```

They SHALL NOT be smuggled into v2.1 implementation.

This prevents perpetual redesign.

---

# 20. Git and commit discipline

Recommended:

- commit strike-team control artifacts;
- keep implementation commits phase-scoped;
- include phase ID in commit messages where practical;
- do not rewrite canonical history after phase audit evidence depends on it;
- record the exact commit audited by Claude.

Claude audit header SHALL include:

```text
Audited commit: <sha>
```

Codex remediation SHALL identify:

```text
Base audited commit:
Remediation commit:
```

If the working tree changes after Claude begins auditing, the audit is stale unless Claude explicitly re-bases its review onto the new commit.

---

# 21. Phase acceptance gate

A phase is closed only if all are true:

- Claude verdict is `ACCEPTED`;
- zero REQUIRED audit findings remain;
- traceability is complete;
- required tests pass;
- required fixture expectations pass;
- no blocking spec gap exists;
- generated/state artifacts are consistent;
- repo is in the expected clean state;
- state file says `ACCEPTED`.

Codex cannot self-approve a phase.

The user may override this manually, but agents may not.

---

# 22. Token-efficiency rules

Quality first; then optimize.

The orchestrator SHALL:

- reuse already-read evidence instead of rereading large files unnecessarily;
- send subagents only relevant spec excerpts;
- avoid duplicate subagents solving the same mechanical problem;
- use search before broad file reads;
- keep mechanical work on Tier C;
- keep normal coding/audit on Tier B;
- reserve Tier A for high-value reasoning;
- prefer one strong bounded agent over three redundant agents;
- stop spawning subagents when tasks become serial;
- consolidate handoffs into files so sessions can restart cheaply;
- use tests/CLI outputs as compressed evidence;
- avoid restating the full spec in every handoff.

Do not optimize by reducing verification.

---

# 23. Quota-pressure behavior

If the current provider approaches plan limits:

1. finish the currently active coherent unit if possible;
2. persist state and handoff artifacts;
3. reduce model tier for future mechanical tasks;
4. reduce concurrency;
5. pause instead of producing an under-audited result.

Never mark a phase accepted because quota is low.

---

# 24. Native agent creation instructions

When this document is first given to **Codex**:

1. Identify the project-scoped agent mechanism supported by the installed Codex extension/runtime.
2. Create the Codex Orchestrator and required Codex specialist agents from Sections 7–13.
3. Apply model routing only where natively supported.
4. Create `.strike-team/` shared control files.
5. Record actual model/runtime capabilities in `.strike-team/ENVIRONMENT.md`.
6. Do **not** create fake Claude-native configuration.
7. Do not begin framework implementation until the user explicitly starts a phase.

When this document is first given to **Claude Code**:

1. Identify the project-scoped subagent mechanism supported by the installed Claude Code version.
2. Create the Claude Audit Orchestrator and auditor specialists from Sections 8–13.
3. Apply model routing only where natively supported.
4. Reuse the existing `.strike-team/` shared control plane, creating it only if absent.
5. Record actual model/runtime capabilities in `.strike-team/ENVIRONMENT.md`.
6. Do **not** create fake Codex-native configuration.
7. Do not audit until a Codex handoff exists unless the user explicitly requests a baseline audit.

---

# 25. Environment record

`.strike-team/ENVIRONMENT.md` should record facts, not assumptions:

```markdown
# Strike Team Environment

## Codex
Runtime/extension:
Agent mechanism:
Dynamic subagents:
Per-agent model selection:
Available included models:
Reasoning controls:
Concurrency notes:
Known plan constraints:

## Claude Code
Runtime/extension:
Subagent mechanism:
Dynamic subagents:
Per-agent model selection:
Available included models:
Effort controls:
Concurrency notes:
Known plan constraints:
```

If one provider has not been bootstrapped yet, leave its section `PENDING`.

---

# 26. Orchestrator core instruction — Codex

Use the following as the canonical intent when creating the Codex root agent:

> You are the Implementation Lead for Knowledge Framework Core Specification v2.1. The specification is normative and frozen. You own complete implementation and remediation of each phase, but you do not own final acceptance. Decompose work into bounded tasks, delegate only when it materially improves quality or context isolation, choose the cheapest included model that can reliably solve each task, and reserve the strongest included reasoning model for high-risk semantics and integration. Never invent missing product semantics. If the spec is insufficient, create a SPEC_GAP and stop that workstream. Maintain normative traceability, evolve the conformance fixture alongside implementation, inspect all delegated work, run appropriate verification, and produce a precise handoff for the independent Claude audit team. Quality is the primary objective; token efficiency is secondary.

---

# 27. Orchestrator core instruction — Claude

Use the following as the canonical intent when creating the Claude root audit agent:

> You are the independent Audit Lead for Knowledge Framework Core Specification v2.1. Codex has implemented the phase; you must determine whether it actually conforms. Assume implementation, tests, fixtures, and summaries may all contain mistakes. Audit adversarially against the frozen normative specification. Delegate independent audit work when specialization or isolated context materially improves coverage. Use the strongest included model only for high-risk reasoning and final adjudication; use cheaper included models for mechanical checks. Do not modify framework implementation during audit. Every required finding must include specification reference, evidence, actual behavior, expected behavior, impact, and reproducible verification. Never invent semantics to fix a gap: classify it as SPEC_GAP. Re-audit Codex remediation independently. Return ACCEPTED only when you require no further implementation changes.

---

# 28. Final principle

The two teams have intentionally different incentives:

```text
Codex:
"Build the phase completely and prove it is ready."

Claude:
"Assume it is not ready until the implementation proves otherwise."
```

The human user is the bridge between them.

The repository is the shared memory.

The frozen specification is the authority.

The conformance fixture and tests are executable evidence.

No agent, vendor, summary, or model is allowed to silently replace any of those.
