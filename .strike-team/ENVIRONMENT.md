# Strike Team Environment

Recorded 2026-09-22. This record contains only capabilities observed in the active Codex runtime or constraints supplied by the user.

## Codex

Runtime/extension: Codex CLI v0.155.0-alpha.16, Windows x86_64; Desktop app build 26.917.6896.0 is installed.

Agent mechanism: Built-in collaboration agents, created dynamically with bounded tasks. Project-scoped native custom-agent definitions are supported in `.codex/agents/*.toml`, with global defaults in `.codex/config.toml`.

Dynamic subagents: Supported.

Per-agent model selection: Supported by custom-agent `model` and `model_reasoning_effort` settings, subject to runtime availability and the user's included-plan constraint.

Available included models: Not discoverable from this runtime. The interface exposes GPT-6 Astra, GPT-6 Sol, GPT-6 Luna, GPT-5.6 Sol, and GPT-5.6 Terra; exposure does not establish included-plan eligibility. Astra is not selected without explicit user authorization.

Reasoning controls: Supported (`low` through `ultra`, by model).

Concurrency notes: Four total active-agent slots are available, including the lead. Project config sets `agents.max_concurrent_threads_per_session = 2`. Agents share the mutable workspace; read-only specialist profiles are used where independence does not require edits.

Project-scoped skills/instructions: Root `AGENTS.md` defines the Implementation Lead. Native custom agents are configured in `.codex/agents/`: `spec-analyst`, `core-implementer`, `schema-engineer`, `conformance-engineer`, `integration-engineer`, and `mechanical-worker`.

Configuration validation: `codex --strict-config --help` exited successfully, and `codex doctor --summary` reported `config loaded` with zero failed/degraded checks. Codex does not expose a non-interactive custom-agent inventory command in this installed CLI, so successful role launches are the runtime recognition evidence.

Smoke test: Successfully recognized and spawned the read-only `spec-analyst` role (runtime task `/root/spec_analyst`) and read-only `integration-engineer` role (runtime task `/root/integration_engineer`). Both inspected repository structure only, returned one-paragraph reports, and made no product changes. The remaining configured roles have not been spawned because no implementation phase is authorized.

Team roles: The active root Codex agent is the Implementation Lead. Specialists remain bounded subagents, not independent project leads.

Known plan constraints: The user specified approximately $20/month Codex and Claude plans. Do not assume paid add-on or credit-based capacity.

## Claude Code

Recorded 2026-09-23 by the Claude bootstrap session. This section separates facts observed in this session from items still pending verification.

Runtime/extension: Claude Code VS Code extension `anthropic.claude-code` 2.1.280 (win32-x64), Windows 11. The `claude` CLI is not on PATH. The root session model was `claude-opus-5-5`.

Subagent mechanism: Project-scoped Markdown agent definitions in `.claude/agents/*.md` (YAML frontmatter: `name`, `description`, `tools`, `disallowedTools`, `model`, `effort`), invoked through the Agent tool's `subagent_type`. Root-session role instructions are in the repo-root `CLAUDE.md`. `AGENTS.md` belongs to Codex, and `CLAUDE.md` tells Claude sessions not to act on it.

Agents created (persisted in the repository): `spec-compliance-auditor`, `architecture-auditor`, `test-conformance-auditor`, `algorithm-determinism-auditor`, `integration-regression-auditor`, `mechanical-audit-worker`. The root session is the Claude Audit Orchestrator. Specialists are one level deep, read-only, and return candidate findings. Only the orchestrator writes audit artifacts.

Native recognition: **PENDING.** Agent definitions are loaded at session start. The files were created mid-session, and invoking them by `subagent_type` failed with "Agent type not found". Available types were still only the built-ins (`claude`, `claude-code-guide`, `Explore`, `general-purpose`, `Plan`, `statusline-setup`). The frontmatter was validated as well-formed. The first new Claude session must confirm recognition by invoking one custom agent before any audit relies on them.

Dynamic subagents: Supported. The Agent tool spawns subagents at runtime, and background execution is the default.

Per-agent model selection: Supported through frontmatter `model` and a per-call `model` override (`sonnet`, `opus`, `haiku`, `fable`). Effort is set through frontmatter `effort`.

Available models (observed): `claude-sonnet-5` (subagent spawned with `model: sonnet`, and the model self-reported). `claude-haiku-4-5-20251001` (spawned with `model: haiku`, self-reported). `claude-opus-5-5` (the root session). Fable 5.1 is exposed by the runtime, but this session did not verify whether the plan includes it, and it must not be used without explicit user approval. Actual remaining quota is not observable from inside the runtime.

Effort controls: User settings set `effortLevel: high` globally, with per-model `high` for `claude-sonnet-5` and `claude-opus-5-5`. Agent definitions set `effort: high`, or `medium` for the integration auditor. The Haiku worker has no effort setting.

Model routing: Sonnet is the default for the five reasoning auditors and Haiku for the mechanical worker. The orchestrator escalates to Opus through a per-call override only for HIGH/CRITICAL reasoning or final adjudication. The protocol recommends Sonnet 5 for the orchestrator. The session model is chosen by the user, and this bootstrap session ran on Opus 5.5.

Concurrency notes: Concurrent subagents are supported. Three ran in parallel in the smoke test. Subagents share the main working tree, and there is no automatic write isolation. The Agent tool's `isolation: "worktree"` option is available for reproductions that need mutation. The project policy is at most 3 concurrent read-only auditors.

Audit write restrictions:
- Natively enforced: specialists have `tools: Read, Grep, Glob, Bash` and `disallowedTools: Edit, Write, NotebookEdit, Agent`. Enforcement becomes observable once the definitions load. `.claude/settings.json` denies Edit/Write on `knowledge-framework-spec-v2.1.md`, `.codex/**`, `AGENTS.md`, and `.strike-team/AI_STRIKE_TEAM_BOOTSTRAP.md` for every Claude session in this repo.
- Instruction-enforced only: Bash is not sandboxed against writes, so the no-mutation rule for Bash is behavioral. The orchestrator's restriction to writing only `.strike-team/phases/*/audits/**` and `.strike-team/spec-gaps/**` (plus audit-state fields in `STATE.yaml`/`PHASES.md`) is also instruction-only. Auditors check `git status --short` before and after.

Smoke test (2026-09-23): Because custom types were not yet loaded, the smoke test used `general-purpose` subagents. Each read its role file and had the role's model tier applied through a per-call override. The spec-compliance role (sonnet), the test-conformance role (sonnet), and the mechanical worker role (haiku) all spawned, quoted their role instructions, and inspected the repository and spec. Their results matched independent ground truth: 66 `##` sections, 125 SHALL lines, 61 SHALL NOT lines, and conformance defined in §55 (lines 2075–2081). `git status --short` was unchanged before and after each run, and no product files were modified. This fallback did not test native tool restriction, because `general-purpose` has all tools.

Known plan constraints: The user specified an approximately $20/month plan, and no paid add-on capacity is assumed. Opus is reserved for HIGH/CRITICAL work, and search, enumeration, and formatting go to Haiku.
