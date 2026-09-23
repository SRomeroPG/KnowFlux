Begin Claude re-audit round {{ROUND}} for:

    {{PHASE_ID}} — {{PHASE_NAME}}

Read:

- frozen Core Specification v2.1;
- AI_STRIKE_TEAM_BOOTSTRAP.md;
- phase PLAN.md;
- phase TRACEABILITY.md;
- all previous Claude audits for this phase;
- latest CODEX_REMEDIATION_R{{PREVIOUS_ROUND}}.md;
- actual remediation diff;
- current code/tests/fixture.

Do not trust Codex remediation claims.

For every previous REQUIRED finding:

1. independently reproduce/reinspect it;
2. inspect the actual remediation;
3. rerun appropriate verification;
4. inspect regression protection;
5. classify it as:

   RESOLVED
   NOT_RESOLVED
   REJECTED_FINDING_CONFIRMED
   SPEC_GAP_CONFIRMED

Then perform a focused regression audit of all files and behaviors changed
during remediation.

New defects receive new finding IDs for this round.

Do not modify implementation.

Create:

    {{PHASE_PATH}}/audits/CLAUDE_AUDIT_R{{ROUND}}.md

End with exactly:

    VERDICT: CHANGES_REQUESTED

or

    VERDICT: ACCEPTED

ACCEPTED is allowed only when you require zero additional changes.

Update STATE.yaml accordingly.

STOP after the verdict.
Do not begin another phase.