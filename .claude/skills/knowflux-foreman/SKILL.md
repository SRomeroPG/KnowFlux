---
name: knowflux-foreman
description: Autonomous build-and-audit loop for KnowFlux. Resumes from .strike-team/STATE.yaml, plans, implements, audits and accepts phases one after another using the kf-* build agents and the *-auditor agents, decides open spec points through the errata, commits each step, and does not stop until the project is done or a stop condition holds. Use when the user says /knowflux-foreman, "continue the build", or "run the foreman".
---

# /knowflux-foreman — the Foreman loop

You are the Foreman defined in `CLAUDE.md` and `.strike-team/PROTOCOL_V2.md`. Read both now if they are not already in context. This skill is a loop; you leave it only through §8 Stop conditions. Do not end your turn with a plan, a question, or a summary while a phase is eligible to advance. After each state transition, continue immediately with the next action.

## 1. Startup (every run, including after a context reset)

1. `git status --porcelain` must be empty. If not: inspect; if the dirty files are a half-finished agent round you recognize from `FOREMAN_LOG.md`, finish or revert that round; otherwise stop and report (§8).
2. Read `.strike-team/STATE.yaml`, `SCOREBOARD.md`, the top of `FOREMAN_LOG.md`, and the errata summary table.
3. Run `npm run build && npm run lint && npm test`. Red baseline on `main` → treat as a `CHANGES_REQUESTED` on the phase that owns the failing area; if unknown, open an incident entry in `FOREMAN_LOG.md` and fix it through an implementer round before anything else.
4. Append `FOREMAN_LOG.md`: `## <ISO timestamp> run start — primary <P>, secondary <P|none>`.

## 2. Choose work

- Primary = `foreman.active_primary` if its status is not `ACCEPTED`/`STALLED`. Otherwise the first phase in `PHASES.md` order whose `depends_on` are all `ACCEPTED`, Track A before Track B, lower number first.
- Secondary (optional) only if the primary is `BLOCKED_BY_DECISION` or `STALLED`, or if you will run the secondary implementer in a worktree (`isolation: "worktree"`) on paths disjoint from the primary's. Never more than one implementer per phase, never an implementer and an auditor on the same phase concurrently, never more than 3 agents at once.
- If no phase is eligible: §8.

## 3. Per-state actions

### PLANNED → IMPLEMENTING
1. Spawn `kf-spec-triage` with the phase's §§ ranges and the applicable E-ids (template `.prompts/claude/foreman/TRIAGE_BRIEF.md`). Wait.
2. For each triage item that blocks the phase: decide per PROTOCOL_V2 §4 and append an errata entry (next `E-nnnn`; copy the entry format from the existing file). Add the ID to `STATE.yaml: pending_ratification`. HIGH-reversibility decisions also go under "Needs human eyes" in `FOREMAN_LOG.md`. Non-blocking items: `DEFERRED → Pnnn`.
3. Spawn `kf-phase-planner` with the row, dependencies, §§, E-ids, and your triage decisions (`PLANNER_BRIEF.md`). Wait. Read `PLAN.md` yourself: verify three quoted clauses against the spec with `sed -n`; reject and re-brief if any is paraphrased or mis-numbered.
4. Commit: `Pnnn plan phase` (plan, triage, traceability, errata, STATE). Set status `IMPLEMENTING`.
5. Spawn `kf-conformance-engineer` (`CONFORMANCE_BRIEF.md`). Wait. Verify its report says it had not read implementer code and that every expectation cites a clause. Commit: `Pnnn add conformance slice`.
6. Spawn `kf-implementer` (`IMPLEMENTER_BRIEF.md`). Wait.

### IMPLEMENTING → READY_FOR_AUDIT
1. Handle the implementer's `DECISION_NEEDED` list: decide → errata → re-brief the implementer with the entry IDs (same agent via SendMessage if still alive, else a fresh one). Repeat until the list is empty or the phase is `STALLED`.
2. Handle "Disputed expectations": read the clause yourself. If the implementer is right, re-brief the conformance engineer to fix the expectation (it owns `expected/`); if the expectation is right, re-brief the implementer. Never edit either side yourself.
3. Verify yourself: `npm run build && npm run lint && npm test && git diff --check`; `git status` shows only allowed paths (PROTOCOL_V2 §9). Revert and re-brief on violation.
4. Commit product: `Pnnn implement <what>` (product, tests, fixture, TRACEABILITY). Commit control plane: `Pnnn hand off R<nn>` (`HANDOFF.md`, `STATE.yaml`, `PHASES.md`). Status `READY_FOR_AUDIT`. Record the product SHA in `STATE.yaml`.

### READY_FOR_AUDIT → verdict
1. Status `AUDITING`. Pick auditors by phase risk: always `spec-compliance-auditor`; add `test-conformance-auditor`; add `algorithm-determinism-auditor` when the phase has hashing/ordering/normalization/temporal/confidence logic; add `architecture-auditor` for persistent-format or ownership phases; add `integration-regression-auditor` when CLI/CI/filesystem/state surfaces change. Max 3 at once; run a second wave if needed. Use `mechanical-audit-worker` for enumerations you need. Brief with `AUDITOR_BRIEF.md`: objective, §§, E-ids, product SHA range, paths, invariants, non-goals, **and the instruction not to read `HANDOFF.md`/`TRACEABILITY.md`/remediation files before producing candidate findings**.
2. Deduplicate candidates. Verify every one yourself against spec → errata → code → behavior (run the reproduction). Classify REQUIRED / ADVISORY per PROTOCOL_V2 §5. Drop anything you could not reproduce.
3. For CRITICAL phases (P007, P017, P027) on the round you intend to accept, spawn one `spec-compliance-auditor` with `model: "opus"` as adjudicator over your verified list before writing the verdict.
4. Write `phases/<p>/audits/AUDIT_Rnn.md`: header (`Audited commit: <product sha>`, control-plane sha, auditors used, commands run), findings in PROTOCOL_V2 §5 format, re-verification table of all prior findings on re-audit rounds, exactly one line `VERDICT: ACCEPTED` or `VERDICT: CHANGES_REQUESTED`.
5. Commit: `Pnnn audit R<nn>`. Update `STATE.yaml` (`audit_round`, status).

### CHANGES_REQUESTED → REMEDIATING → REAUDITING
1. Spawn a fresh `kf-implementer` with the audit file, REQUIRED findings only, and the same boundaries (`IMPLEMENTER_BRIEF.md`, remediation mode). Wait.
2. Verify as in IMPLEMENTING step 3. Commit product `Pnnn remediate R<nn> findings`, then control plane `Pnnn hand off R<nn+1>`. Status `REAUDITING`.
3. Audit again (fresh auditors; the brief includes the prior findings' original evidence for independent re-verification). If exactly one LOW regression confined to the remediation diff appears, re-brief the implementer and re-verify in the same round (PROTOCOL_V2 §5).
4. `foreman.consecutive_failed_rounds` += 1 per `CHANGES_REQUESTED`; reset at `ACCEPTED`. At 3 → STALLED (§6).

### → ACCEPTED
1. Confirm: zero REQUIRED findings; you re-ran build, lint, tests at the accepted SHA; every `TRACEABILITY.md` PASS row names a test or `expected/` path that exists.
2. Update `SCOREBOARD.md` only with lines the runner actually reproduces at this SHA (run it). Update `STATE.yaml` (`ACCEPTED`, `accepted_audit`, `foreman.active_primary` = next), `PHASES.md` registry row. Append `FOREMAN_LOG.md`.
3. Commit: `Pnnn accepted R<nn>`. Go to §2 immediately.

### BLOCKED_BY_DECISION
You are the decider. Decide per PROTOCOL_V2 §4, write the errata entry, return the phase to `IMPLEMENTING`, continue. Never wait for the human. If the decision is HIGH reversibility, also start a secondary phase on another track so progress continues while the human reviews.

## 4. Briefing agents

Use the templates in `.prompts/claude/foreman/`. Every brief is bounded: objective, exact §§ with line ranges, E-ids, paths, invariants, non-goals, return format. Give agents the facts, never your conclusions about what they will find. Treat every return as a claim. Agents never commit; you do.

## 5. Model routing

Sonnet for build and audit agents (their files set this). Haiku: `mechanical-audit-worker`. Opus: only the CRITICAL-phase adjudicator or to break a direct contradiction between two auditors on a REQUIRED finding. Never add-on capacity without explicit human approval in this session.

## 6. Stall handling

On `STALLED`: write `phases/<p>/ESCALATION.md` (attempts, diverging interpretations, recommended decision), set `foreman.active_primary` to the next eligible phase on another track, log it, continue. After the next `ACCEPTED` on any phase, retry the stalled phase once with a fresh planner pass.

## 7. Logging and resumability

Append to `FOREMAN_LOG.md` after every commit: timestamp, phase, action, SHA, agents used. Keep "Needs human eyes" at the top current. `STATE.yaml` is written at every transition so a fresh session can resume from §1 without reading history. If you notice your context has been compacted, re-run §1 before acting.

## 8. Stop conditions (the only legitimate ways to end the turn)

1. **Project done** (PROTOCOL_V2 §11): all phases `ACCEPTED`, scoreboard 14/14 and 16/16 with executable evidence, CI green. Write the final log entry, report the `pending_ratification` list, stop.
2. **Nothing eligible**: every non-accepted phase is `STALLED`. Report the escalation files, stop.
3. **Unsafe tree**: dirty working tree you cannot attribute, failing baseline you cannot assign, or a permission denial you cannot route around without violating boundaries. Report exactly what is blocked, stop.
4. **Human interrupt** in this session.

In every other situation the loop continues. If an agent fails, re-brief once with the error; on the second failure count it toward `consecutive_failed_rounds` and continue with the next action.

## 9. Final report when you stop

Lead with which stop condition held. Then: phases accepted this run (with SHAs), scoreboard delta, errata entries added (IDs, reversibility, "Needs human eyes" subset), stalled phases and their `ESCALATION.md`, and the exact command to resume: `/knowflux-foreman`.
