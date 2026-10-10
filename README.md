# KnowFlux

The Knowledge Engineering Framework. Core Specification v2.1 is frozen in
`knowledge-framework-spec-v2.1.md`; semantic gaps are decided in
`knowledge-framework-spec-v2.1-errata.md`. The normative CLI name is `kf`.

Development is run by a Claude-only Strike Team (a Foreman session orchestrating
implementer and auditor agents). Start with `.strike-team/README.md`; track real
progress in `.strike-team/SCOREBOARD.md`.

Current state: P001 established the persistent JSON Schema contract in
`framework/schemas/` and a growing, human-readable conformance project in
`framework/conformance/acme-formulation/`. P002 (ID registry) has started
(`framework/engine/id-registry.mjs`). The `kf` CLI does not exist yet; it
arrives in P028.

For the local checks, run `npm ci`, then `npm run build`, `npm run typecheck`,
`npm run lint`, and `npm test`. The build and typecheck commands compile every
JSON Schema.
