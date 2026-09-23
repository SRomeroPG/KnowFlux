# KnowFlux

The Knowledge Engineering Framework. Core Specification v2.1 is frozen in
`knowledge-framework-spec-v2.1.md`.

P001 establishes the persistent JSON Schema contract in `framework/schemas/`
and a growing, human-readable conformance project in
`framework/conformance/acme-formulation/`. The normative CLI name remains `kf`.

For the local P001 checks, run `npm ci`, then `npm run build`,
`npm run typecheck`, `npm run lint`, and `npm test`. The build and typecheck
commands compile every JSON Schema; there is no TypeScript application in P001.
