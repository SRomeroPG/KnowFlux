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

Runtime/extension: PENDING — Claude Code is not active in this session.

Subagent mechanism: PENDING.

Dynamic subagents: PENDING.

Per-agent model selection: PENDING.

Available included models: PENDING.

Effort controls: PENDING.

Concurrency notes: PENDING.

Known plan constraints: Approximately $20/month plan constraint supplied by the user; no paid add-on capacity is assumed.
