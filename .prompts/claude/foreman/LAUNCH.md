# Launching and supervising the Foreman

Audience: the human operator. The Foreman is the root Claude session that runs the KnowFlux build-and-audit loop (`.strike-team/PROTOCOL_V2.md`, `.claude/skills/knowflux-foreman/SKILL.md`).

## Prerequisites

1. `CLAUDE.md` and `.claude/settings.json` are already the v2 versions (committed 2026-10-09). If a session ever reports it cannot modify them, copy the content from git history rather than editing by hand.
2. Run Claude Code from the repository root (`C:\Repos\KnowFlux`), so `CLAUDE.md`, `.claude/agents/` and `.claude/skills/` are discovered.
3. Start with the tree clean (`git status --porcelain` empty). The Foreman refuses to proceed on an unattributable dirty tree (SKILL.md §1, §8.3).
4. Recommended permission mode so the loop is not interrupted by prompts: `claude --permission-mode acceptEdits`, or auto mode. A mode that prompts on every edit or commit will stall a multi-hour run.
5. Do not grant add-on or credit-consuming capacity (for example Fable) unless you decide to; the Foreman will not use it without explicit approval.

## Launch

One line, in the session:

```
/knowflux-foreman
```

The Foreman reads `STATE.yaml`, verifies the baseline, picks the next eligible phase and runs plan, conformance, implement, audit, remediate, accept, repeat.

## Optional watchdog

```
/loop 45m /knowflux-foreman
```

This re-enters the loop if a turn ended early (for example after a context compaction or a model stop). Re-entry is safe: the Foreman always resumes from `STATE.yaml` (SKILL.md §1), and a finished project simply stops again.

## Expected session length

Each phase takes several agent rounds (plan, conformance, implement, audit, possibly remediation). The whole roadmap (28 phases) is hours to days of wall-clock time across many sessions. Plan for context resets and quota windows; the loop is designed to survive both.

## Resume after a context reset, crash or quota stop

Run `/knowflux-foreman` again from the repo root. State lives in `.strike-team/STATE.yaml` and `.strike-team/FOREMAN_LOG.md`, never in the conversation. If a crash left a half-finished agent round in the working tree, the Foreman matches it against `FOREMAN_LOG.md` and finishes or reverts it; if it cannot attribute the changes it stops and reports (SKILL.md §8.3).

## Stop

Interrupt the session (Esc / Ctrl+C). Nothing is lost beyond the in-flight agent round; uncommitted work from that round is handled on the next start as above.

## Where to look

| What | Where |
|---|---|
| Decisions that need your attention, current blockers | `.strike-team/FOREMAN_LOG.md`, section "Needs human eyes" (top of file) |
| Progress: §55 lines (n/14), §56 items (n/16), phases accepted (n/28) | `.strike-team/SCOREBOARD.md` |
| Errata entries the Foreman decided that you have not yet reviewed | `.strike-team/STATE.yaml`, key `pending_ratification` |
| Undecided points | `STATE.yaml` key `open_decisions`; the errata summary table |
| Stalled phases | `.strike-team/phases/<phase>/ESCALATION.md` |
| What the Foreman did, step by step | `FOREMAN_LOG.md`, section "Log" |

## Reviewing decisions

Ratification is asynchronous and never blocks the Foreman. To review, paste `.prompts/claude/foreman/RATIFY.md` into any Claude session.
