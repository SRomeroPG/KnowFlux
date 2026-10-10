# KnowFlux Operating Protocol v2 — Claude Strike Team

Status: ADOPTED 2026-10-09. Supersedes the v1 two-team protocol, which was removed on 2026-10-09 (see ADR-0001). Process rationale lives in `decisions/ADR-0001..0004.md`.

## 0. Mission

Build the Knowledge Framework Core v2.1 to full conformance with a single vendor: one root Claude session, the **Foreman**, orchestrates Claude **build agents** and Claude **audit agents** with enforced role separation. The Foreman runs autonomously for hours or days, phase after phase, until the project is done or a stop condition holds.

## 1. Normative sources, in precedence order

1. `knowledge-framework-spec-v2.1.md` — frozen. Every `SHALL` / `SHALL NOT` is a contract. Never edited.
2. `knowledge-framework-spec-v2.1-errata.md` — binding decisions on points the spec leaves open, plus corrections of record. Never overrides an explicit SHALL. Entries carry a status (`DECIDED_BY_FOREMAN`, `RATIFIED`, `REJECTED`, `OPEN`) and a reversibility class (LOW / MEDIUM / HIGH).
3. `.strike-team/phases/<phase>/PLAN.md` — the authorized scope of a phase.
4. `framework/conformance/expected/` — §55: "El fixture es la definición operativa de 'terminado'". Every feature ships with its fixture slice, never after (spec l.2103).

Principles carried over from v1: derive, don't duplicate; one writer per fact; never invent semantics silently; never accept because tests pass; report outcomes faithfully.

## 2. Roles

| Role | Where defined | Writes | Model |
|---|---|---|---|
| **Human** | — | Ratifies errata entries, authorizes scope changes, may interrupt | — |
| **Foreman** (root session) | `.claude/skills/knowflux-foreman/SKILL.md`, `CLAUDE.md` | `.strike-team/**` control plane, errata, commits; never product code directly | session model |
| `kf-spec-triage` | `.claude/agents/` | nothing (read-only) | sonnet / medium |
| `kf-phase-planner` | `.claude/agents/` | `phases/<phase>/PLAN.md`, `TRIAGE.md`, `TRACEABILITY.md` | sonnet / high |
| `kf-conformance-engineer` | `.claude/agents/` | `framework/conformance/**`, `test/conformance*` | sonnet / high |
| `kf-implementer` | `.claude/agents/` | product code, unit tests, `HANDOFF.md`, `TRACEABILITY.md`, `remediation/*` | sonnet / high |
| 6 auditors (`spec-compliance-auditor`, `architecture-auditor`, `test-conformance-auditor`, `algorithm-determinism-auditor`, `integration-regression-auditor`, `mechanical-audit-worker`) | `.claude/agents/` | nothing (read-only) | sonnet / high; haiku for mechanical; opus for CRITICAL adjudication |

Agents are one level deep: no agent spawns agents. Agents never commit. Agents never edit the spec, the errata, `STATE.yaml`, `PHASES.md`, `SCOREBOARD.md`, or `audits/**`.

### 2.1 Role separation inside one vendor

Independence is a property of information flow, not of the vendor. These rules are mandatory:

- **Blind audit pass.** Auditors receive the phase objective, the spec sections, the errata entries, the paths, and the commit range. They do not read `HANDOFF.md`, `TRACEABILITY.md`, or remediation reports until they have written their own candidate findings. The brief says so explicitly.
- **Fixture independence.** The conformance engineer writes `expected/` from the spec and the PLAN before reading any implementer code of the phase. The implementer never writes under `framework/conformance/**/expected/**`.
- **Fresh instances.** Every audit round uses newly spawned auditor agents. The implementer that wrote the code never audits it.
- **Executable arbiter.** `conformance/expected/` and the test suite decide disputes about behavior; prose decides nothing.
- **Escalated adjudication.** For CRITICAL phases (P007, P017, P027) the final acceptance pass uses `model: "opus"` on one auditor.

## 3. Phase lifecycle

```
PLANNED → IMPLEMENTING → READY_FOR_AUDIT → AUDITING ─┬→ ACCEPTED
                 ↑                                     └→ CHANGES_REQUESTED → REMEDIATING → REAUDITING ─┬→ ACCEPTED
                 │                                                                                         └→ CHANGES_REQUESTED (loop)
                 ├── BLOCKED_BY_DECISION  (Foreman writes an errata entry, then returns to IMPLEMENTING)
                 └── STALLED              (3 failed rounds or unrecoverable tooling; Foreman switches track and writes ESCALATION.md)
```

| Transition | Who | Required artifacts |
|---|---|---|
| open phase → `PLANNED` | Foreman | `phases/<phase>/TRIAGE.md` (spec pre-triage), `PLAN.md`, `TRACEABILITY.md` skeleton; errata entries for every triaged ambiguity the phase touches |
| `PLANNED` → `IMPLEMENTING` | Foreman | conformance engineer briefed first; implementer briefed after `expected/` slice exists |
| `IMPLEMENTING` → `READY_FOR_AUDIT` | Foreman after implementer returns | **implementation commit** (product + tests + fixture + PLAN/TRACEABILITY), then **handoff commit** (`HANDOFF.md`, `STATE.yaml`, `PHASES.md`). Foreman has independently run build, lint, tests, `git diff --check`, and checked write boundaries |
| `READY_FOR_AUDIT` → `AUDITING` → verdict | Foreman | `audits/AUDIT_Rnn.md` with `Audited commit: <sha>` and exactly one `VERDICT:` line; **audit commit** |
| `CHANGES_REQUESTED` → `REMEDIATING` → `REAUDITING` | Foreman | `remediation/REMEDIATION_Rnn.md` (one entry per REQUIRED finding: root cause, fix, red-before/green-after evidence); remediation commit + handoff commit |
| → `ACCEPTED` | Foreman | audit with `VERDICT: ACCEPTED`, zero REQUIRED findings, `TRACEABILITY.md` PASS rows all backed by executable evidence, `SCOREBOARD.md` updated, `STATE.yaml`/`PHASES.md` updated; **acceptance commit** |

Commit messages: `Pnnn <verb> <what>` (for example `P002 implement canonical promotion`, `P002 audit R01`, `P002 remediate R01 findings`, `P002 accepted R02`). Control-plane-only commits never touch product files, so the audited product SHA is always separable.

Audit staleness: the audit records the product SHA; if any product path changes after the audit started, the audit is void and restarts.

## 4. Decision policy (replaces v1 `SPEC_GAP` stop)

When implementation or audit meets a point the spec does not determine:

1. The agent that found it stops that workstream and reports it as `DECISION_NEEDED` with clauses, question, and at least two options. Agents never choose.
2. The Foreman sets the phase to `BLOCKED_BY_DECISION`, decides, and writes an errata entry `E-nnnn` (clauses verbatim, question, options, decision, rationale, reversibility, `Status: DECIDED_BY_FOREMAN`, `Ratified: pending`). The entry ID is appended to `STATE.yaml: pending_ratification`.
3. The Foreman returns the phase to `IMPLEMENTING` and continues. It never waits for the human.

Choice rules, in order: (a) the reading most consistent with the existing text (specific over general; catalog over prose); (b) the most reversible option; (c) the most conservative behavior (reject + manual resolution over silent auto-resolution; fail loudly over guessing). Any HIGH-reversibility decision (persistent identity or format) is additionally listed at the top of `FOREMAN_LOG.md` under "Needs human eyes".

Human ratification is asynchronous. A `REJECTED` entry becomes a remediation task for the phase that implemented it; the Foreman re-opens that phase as `CHANGES_REQUESTED` with the rejection as a REQUIRED finding.

## 5. Audit rubric

A finding is **REQUIRED** only if it cites one of:
- a `SHALL` / `SHALL NOT` quoted verbatim from the spec that the code or tests violate;
- a binding errata entry (`DECIDED_BY_FOREMAN` or `RATIFIED`) that is violated;
- a `conformance/expected/` line or PLAN verification target that fails or is not exercised.

Everything else is **ADVISORY** and never blocks acceptance. Design preferences, defensive extras, and "closing" structures the spec leaves open are ADVISORY. Severity (CRITICAL / HIGH / MEDIUM / LOW) applies to REQUIRED findings only and orders remediation; it does not change the rubric.

Finding format: `F-Pnnn-Rnn-Fxx` with: clause quoted, observed behavior with `path:line`, reproduction command or test, expected behavior, severity, class (REQUIRED / ADVISORY).

Re-audit (§17 of v1 carried over): every prior finding is independently re-verified with its original evidence; remediation reports are claims, not proof. If re-audit finds exactly one LOW regression confined to the remediation diff, the Foreman has the implementer fix it and re-verifies within the same round; no new full round.

Acceptance requires: zero REQUIRED findings; the Foreman itself re-ran build, lint, tests and the conformance runner at the accepted SHA.

## 6. Scheduling

- Roadmap is a DAG (`PHASES.md`, `STATE.yaml: phases.*.depends_on`). A phase is eligible when every dependency is `ACCEPTED`.
- One **primary** phase at a time (Track A preferred). A **secondary** phase from another track runs only when the primary is `BLOCKED_BY_DECISION` or `STALLED`, or when its implementer works in an isolated git worktree on disjoint paths. The Foreman merges worktree branches itself and re-runs the full suite after each merge.
- At most 3 concurrent agents. Auditors run in parallel with each other, never with an implementer on the same phase.

## 7. Budget and model routing

- Sonnet is the workhorse for build and audit. Haiku for exhaustive search, enumeration, output comparison. Opus only for CRITICAL-phase adjudication or when two Sonnet auditors contradict each other on a REQUIRED finding.
- Each agent brief is bounded: objective, exact §§, errata entries, paths, invariants, non-goals, return format. Briefs point to the templates in `.prompts/claude/foreman/`.
- Under quota pressure the Foreman reduces concurrency and skips ADVISORY hunting before it reduces verification. It never accepts an under-audited phase to save tokens; it writes `STALLED` instead.

## 8. Stall and escalation

- Three consecutive `CHANGES_REQUESTED` rounds on one phase, or three consecutive agent failures (tooling, timeouts), set `STALLED`. The Foreman writes `phases/<phase>/ESCALATION.md` (what was tried, the diverging interpretations, a recommended decision), moves to the next eligible phase on another track, and retries the stalled phase once after an unrelated phase is accepted.
- If no phase is eligible and all remaining phases are `STALLED`, the Foreman stops and reports.

## 9. Write boundaries (enforced by brief and checked by the Foreman before every commit)

| Path | Foreman | planner | conformance | implementer | auditors |
|---|---|---|---|---|---|
| spec | — | — | — | — | — |
| errata | write | — | — | — | — |
| `.strike-team/STATE.yaml`, `PHASES.md`, `SCOREBOARD.md`, `FOREMAN_LOG.md` | write | — | — | — | — |
| `phases/<p>/PLAN.md`, `TRIAGE.md` | write | write | — | — | — |
| `phases/<p>/TRACEABILITY.md` | write | skeleton | — | update | — |
| `phases/<p>/HANDOFF.md`, `remediation/*` | — | — | — | write | — |
| `phases/<p>/audits/*`, `ESCALATION.md` | write | — | — | — | — |
| `framework/conformance/**` (fixture + `expected/`) | — | — | write | — | — |
| `framework/engine/**`, `framework/schemas/**`, `bin/**`, `scripts/**`, `test/**` (except `test/conformance*`) | — | — | — | write | — |
| `.github/**`, `package.json`, lint config | — | — | — | write (only when the PLAN says so) | — |

A boundary violation found before commit is reverted by the Foreman and re-briefed; found after commit, it is a REQUIRED audit finding.

## 10. Progress reporting

- `SCOREBOARD.md`: §55 expected lines reproducible (n/14), §56 items (n/16), phases accepted (n/28). Updated only with executable evidence, at acceptance.
- `FOREMAN_LOG.md`: append-only; one entry per Foreman action (timestamp, phase, action, commit SHA, agents used, tokens note if known). "Needs human eyes" list at the top.
- `STATE.yaml`: the single resumable truth. Any Foreman run starts by reading it and ends by writing it.

## 11. Definition of project done

All of: every phase in `PHASES.md` is `ACCEPTED`; `SCOREBOARD.md` shows 14/14 §55 lines reproduced by the runner from a clean checkout and 16/16 §56 items with executable evidence; CI green on ubuntu and windows; `pending_ratification` is reported (it need not be empty; ratification is the human's asynchronous act). The Foreman then writes the final entry in `FOREMAN_LOG.md` and stops.
