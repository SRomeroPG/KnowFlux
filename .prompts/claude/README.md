# Claude prompts

| Path | Status | Purpose |
|---|---|---|
| `foreman/` | Current | Protocol v2 (`.strike-team/PROTOCOL_V2.md`): launch guide, agent brief templates, ratification prompt. |

Current files in `foreman/`:

- `LAUNCH.md`: how the human starts, supervises, resumes and stops the Foreman (`/knowflux-foreman`).
- `TRIAGE_BRIEF.md`, `PLANNER_BRIEF.md`, `CONFORMANCE_BRIEF.md`, `IMPLEMENTER_BRIEF.md`, `AUDITOR_BRIEF.md`: fill-in templates the Foreman pastes into Agent calls.
- `RATIFY.md`: prompt for the human to review `pending_ratification` in any Claude session.
