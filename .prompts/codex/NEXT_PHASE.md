# KnowFlux — start one new Strike Team phase

Execute this prompt as the Codex Implementation Lead under the repository's
Strike Team protocol. This invocation authorizes **one** new phase: the first
proposed P-number immediately after the last independently accepted phase in
`.strike-team/PHASES.md`. If the user supplies an explicit phase ID with this
prompt, it must be that next phase. Reading or discussing this file without an
instruction to execute it is not phase authorization.

The frozen `knowledge-framework-spec-v2.1.md` is normative. Preserve its
`SHALL`/`SHALL NOT` requirements and construction order in §53. The product is
KnowFlux, but the normative CLI remains `kf`. Do not modify the frozen spec or
invent missing product semantics.

## Verify the gate before any phase work

1. Read `AGENTS.md`, `.strike-team/AI_STRIKE_TEAM_BOOTSTRAP.md`,
   `.strike-team/STATE.yaml`, `.strike-team/PHASES.md`, and
   `.strike-team/ENVIRONMENT.md`. Inspect the available native Codex
   specialists and the actual repository state and diff.
2. Read the predecessor's latest Claude audit and confirm `ACCEPTED`, zero
   required findings, and the exact audited commit. Confirm the state and
   registry agree. If the acceptance files are uncommitted, preserve and
   commit only those existing Claude/control-plane changes before beginning
   the next phase. Do not alter Claude's verdict or audit text.
3. Select the single next phase from the roadmap. If its predecessor is not
   accepted, the requested ID skips a phase, the gate is inconsistent, or the
   user has not instructed you to execute this prompt, do not implement it.
4. Review all open `SPEC_GAP` artifacts and the predecessor's advisories for
   dependencies on the selected phase. A genuine missing semantic decision
   goes into a `SPEC_GAP`; stop only the affected workstream. Do not silently
   choose an address grammar, data contract, or other product behavior.

## Plan and implement only the selected phase

1. Read the selected §53 item, all relevant frozen-spec clauses, its
   dependencies, and the directly related code, schemas, fixtures, tests, and
   prior traceability. Refine the phase boundary in `PHASES.md` only if it
   preserves §53 dependency order and auditability.
2. Create a complete `.strike-team/phases/Pxxx-<slug>/PLAN.md` **before**
   product implementation. Create and maintain `TRACEABILITY.md` mapping
   individual normative requirements to implementation and executable
   evidence. Record explicit deferrals to later phases.
3. Transition `STATE.yaml` to the selected phase through `PLANNED` and
   `CODEX_IMPLEMENTING`. Use the configured Codex specialists for bounded
   independent work where they improve quality. Give them exact ownership,
   relevant clauses, invariants, checks, and non-goals. Avoid overlapping
   edits, inspect their diffs, and retain integration responsibility.
4. Implement the entire authorized phase and its portion of the §55
   conformance fixture together. Add meaningful positives, negatives, and
   deterministic-output checks from the spec. Do not pull forward substantive
   work from another phase or hand-author artifacts that the engine must
   derive.
5. Run targeted and appropriate broader tests, build/typecheck/lint, fixture
   checks, and internal adversarial review. Fix your own findings and rerun
   affected checks. Verify the actual staged diff and working-tree state.

## Handoff and stop

Commit the implementation, tests, fixture, plan, and traceability so the audit
has an exact product commit. Write the selected phase's `CODEX_HANDOFF.md`
with scope, clauses, files, verification commands and results, fixture status,
remaining limitations and `SPEC_GAP`s, aggressive audit targets, and the exact
commit SHA. Update the phase registry and set `STATE.yaml` to
`CODEX_READY_FOR_AUDIT`; commit the handoff/control-plane changes. Stop for the
independent Claude audit. Do not self-accept the phase or start the following
phase.

If Claude later requests changes, follow the existing remediation workflow
for **that same phase** and hand off at `CLAUDE_REAUDITING`. A new phase starts
only after Claude accepts its predecessor and the user invokes this prompt
again.
