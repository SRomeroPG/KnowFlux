# Acme formulation — P001 conformance slice

This is the text-authored portion of the §55 fixture. P001 covers the eleven
core persistent shapes and the separate BP, BR and DE facet classes. Counts,
resolver results, rule outputs, derived divergences and `expected/` output
snapshots are added with their respective later phases.

The `knowledge/` and `changes/` records are intentional source documents.
There is no authored `divergences/` record: `DIV` is derived by the engine.
The schema test checks a synthetic derived `DIV` in memory.

The observed-only `DE-0002` represents discovery before a specified facet
exists. The future specified `BR-0002` illustrates §20 without an `approved`
truth state. No runtime claims are made by these examples.
