# Claude prompts

| Path | Status | Purpose |
|---|---|---|
| `000.md`, `001.md`, `002.md`, `003-Reusable.md` | History | v1 audit-era prompts (Codex implements, Claude audits; `AI_STRIKE_TEAM_BOOTSTRAP.md`). Kept for the record; superseded by Protocol v2. |
| `foreman/` | Current | Protocol v2 (`.strike-team/PROTOCOL_V2.md`): launch guide, agent brief templates, ratification prompt. |

Current files in `foreman/`:

- `LAUNCH.md`: how the human starts, supervises, resumes and stops the Foreman (`/knowflux-foreman`).
- `TRIAGE_BRIEF.md`, `PLANNER_BRIEF.md`, `CONFORMANCE_BRIEF.md`, `IMPLEMENTER_BRIEF.md`, `AUDITOR_BRIEF.md`: fill-in templates the Foreman pastes into Agent calls.
- `RATIFY.md`: prompt for the human to review `pending_ratification` in any Claude session.
