# P002 traceability (skeleton)

Written at planning time by `kf-phase-planner`. Every status is `TODO`. The implementer fills the Verification column with a test name (`file :: test title`) or a `framework/conformance/` case path, and may change a row to `PASS` only with executable evidence that was run. `BLOCKED_BY_DECISION` rows keep `TODO` and name the pending item from `TRIAGE.md`. Line numbers refer to `knowledge-framework-spec-v2.1.md`; "V-nn" and "F-xx" are targets and cases of `PLAN.md`. The previous v1 traceability (rows I01..I10, all PARTIAL/BLOCKED) is superseded.

## Spec clauses

| Clause (line) | Contract | Verification | Status |
|---|---|---|---|
| §4.1 l.153-163 (prefix table) | Only the 11 core prefixes are allocated; others rejected `INVALID_PREFIX` (V-05, F-A4) | | TODO |
| §8 l.300 "zero-padded a 4, expandible sin romper IDs existentes" | At least 4 digits; `BR-9999` then `BR-10000`; earlier IDs and bytes untouched (V-02, F-A2) | | TODO |
| §8 l.300 "Únicos, no reutilizables" | No ID is ever reissued: deleted, failed, renamed entities, gaps, aliased IDs (V-03, V-04, V-49; F-A3, F-E11) | | TODO |
| §8 l.300 "independientes del nombre" | Renaming or changing `name` never changes an ID nor creates a collision (V-03, V-44; F-A3, F-E7(c)) | | TODO |
| §8.1 l.304 "Los agentes **SHALL NOT** asignar IDs" | Only `allocateId` assigns; IDs in entities unknown to the registry are not accepted silently (V-08; behavior of unregistered IDs: D-03(a)) | | TODO |
| §8.1 l.304 "El engine los asigna desde `.kf/id-registry.yaml`" | Allocation reads and appends only `.kf/id-registry.yaml` (V-01, V-08; F-A1, F-A7) | | TODO |
| §8.1 l.304 "con lock transaccional" | Concurrent in-process and cross-process allocators get distinct IDs; registry atomically replaced (V-10, V-11, V-18, V-19; F-B1, F-B2, F-B4) | | TODO |
| §8.2 l.308 "An ID is permanent only after its first appearance on the canonical branch" | Allocation is always `provisional`; promotion only when canonical first-parent history contains the entity file with that ID; renumbered new ID stays provisional until it appears (V-29, V-30, V-38; F-D1, F-D2, F-E1) | | TODO |
| §8.2 l.311-312 "id_status: provisional \| permanent" | Entity carries the status; rewritten by promotion and convergence (V-30, V-37, V-46; F-D2, F-D9) | | TODO |
| §8.2 l.315 "En un branch no canónico, `kf create` asigna un ID y lo marca `provisional`" | Engine side: `allocateId` returns `provisional`; engine API only, `kf create` wiring is P007 (V-01, V-29, V-57; F-A1, F-D1) | | TODO |
| §8.2 l.316 "Al entrar al branch canónico, `kf validate` lo promueve a `permanent`" | Engine side: `promoteIds` records `promote {id, path, commit}` and sets `id_status: permanent`; for merge, fast-forward and squash entry; `kf validate` wiring is P007 (V-30, V-31, V-32, V-33, V-34, V-35, V-36; F-D2..F-D8) | | TODO |
| §8.2 l.317 "solo es resoluble si **ambos** IDs en conflicto son `provisional`" | Automatic resolution only when no `promote` exists for the ID (V-38, V-42; F-E1, F-E5) | | TODO |
| §8.2 l.317 "renumera el de `first_canonical_commit` posterior" | Later first-parent index loses; fresh ID allocated; `allocate` + `alias` events; entity rewritten (V-38, V-40; F-E1, F-E3; value details D-02) | | TODO |
| §8.2 l.317 "registra `id_alias`" | `alias {from, to, commit}` event and `id_alias` list in the entity (V-38, V-41; F-E1, F-E4; commit value D-02(a)) | | TODO |
| §8.2 l.318 "**Un ID `permanent` SHALL NOT ser renumerado jamás**" | A promoted ID keeps its single `promote` line and holder path forever; no operation renumbers it (V-42, V-49; F-E5, F-E11) | | TODO |
| §8.2 l.318 "Colisión con un `permanent` → `KF-E-101`, resolución manual obligatoria" | `KF-E-101` diagnostic on the non-matching path, no automatic change (V-42, V-43, V-44, V-45; F-E5, F-E6, F-E7, F-E8; throw-vs-return D-03(c)) | | TODO |
| §8.2 l.319 "`id_alias` **SHALL** resolverse en todas las queries, indefinidamente" | `resolveId` resolves live holder and alias-only; alias is never removed (V-50, V-51, V-52, V-53; F-R1..F-R5). Query-surface wiring deferred to P021/P022 | | TODO |
| §9 l.358-359 `.kf/id-registry.yaml` | Registry is `.kf/id-registry.yaml`; missing is `REGISTRY_MISSING`, never recreated (V-23; F-C1) | | TODO |
| §9.1 l.371 "Append-only, escrito solo por comandos" | Events only appended; earlier bytes unchanged; written only through the engine under lock (V-02, V-19, V-47; F-A2, F-B4, F-D10) | | TODO |
| §10.7 l.554 `BR-0037` "la entidad" | `resolveId` accepts the bare entity ID; fragment addresses are rejected `INVALID_ID` here (V-53; F-R4). The SHALL at l.564 is not satisfied by P002 and stays with P021/P022 and E-0006 | | TODO |
| §10.8 l.570 `created_at`/`updated_at` **SHALL NOT** existir en YAML | The engine writes no time or commit fields into entity files (V-37; F-D2, F-E1) | | TODO |
| §19.1 l.1111-1112 "primer commit que contiene X en el canonical_branch" | `first_canonical_commit` = first commit in canonical first-parent history carrying the file with that ID (V-31, V-34; F-D2, F-D5) | | TODO |
| §19.1 l.1115 "history SHALL NOT be rewritten" | Recorded commits are stable as canonical advances; shallow history refused (V-34, V-35; F-D6, F-D7) | | TODO |
| §19.1 l.1117 "Esto **no** prohíbe squash merge" | Squash entry yields the squash commit as `first_canonical_commit` (V-31; F-D2(c)) | | TODO |
| §36 l.1600 "generarse desde el catálogo" | `KF-E-101` is the only code used, declared once from l.1742 until the P028 catalog; no invented `KF-` code (V-45; N-06) | | TODO |
| §36.1 l.1604 exit codes `3`/`4`/`5` | Engine errors carry the codes of the E-0014 class table; the CLI maps them (V-23, V-24, V-32; F-C1, F-C2, F-D3) | | TODO |
| §42.2 l.1742 `KF-E-101` | Diagnostic fields `code`, `severity: E`, `remediation: resolución manual`, `id`, `path`, `permanent_path` (V-45; F-E5, F-E8) | | TODO |
| §55 l.2103 fixture with the feature | Conformance slice exists and was written before the implementer read it (V-56; Exit criterion 2) | | TODO |

## Errata decisions

| Entry | Contract | Verification | Status |
|---|---|---|---|
| E-0001 | `canonicalBranch` is an explicit parameter; required; never assumed `main`; engine reads no config and ignores the checked-out branch (V-32, V-33; F-D3, F-D4) | | TODO |
| E-0002 | Same-commit ties: ascending UTF-8 byte order of repo-relative paths; first keeps the ID (V-39; F-E2(a)-(c); numeric assignment D-02(b)) | | TODO |
| E-0003 | Live holder wins; `shadowed_alias` warning names the alias target and has no code; alias used only when the ID is unheld (V-50, V-51; F-R1, F-R2) | | TODO |
| E-0004 | `promote` records path; unrecorded move is `KF-E-101`; recorded `move` event is honored; no incarnation token (V-36, V-43, V-44; F-D8, F-E7) | | TODO |
| E-0007 | Registry committed, `merge=union`; locks ignored; union-merged registry replays (V-27, V-28; F-C5, F-C6; empty-base case D-05) | | TODO |
| E-0008(a) | §44.2 means §42.2; the catalog row used is l.1742 (V-45) | | TODO |
| E-0009 | `first_canonical_commit` by first-parent index via injected reader; ordering never by timestamp; SHA only in registry events (V-31, V-34, V-38; F-D2, F-D5, F-E1) | | TODO |
| E-0010 | Provisional vs permanent and two permanent claims: `KF-E-101` on every file whose path differs from the `promote` path; holder untouched; no renumbering (V-42, V-43; F-E5, F-E6; call behavior D-03(c)) | | TODO |
| E-0011 | `id_status` stays in the entity; `id_alias` is a list of entity IDs; registry authoritative; engine rewrites entities atomically and idempotently; `id_alias` in `entityBase` schema (V-37, V-41, V-46, V-55; F-D9, F-E4, F-E9, F-S1) | | TODO |
| E-0012 file format | Header exact; one flow-mapping event per physical line; key order; no timestamps/actors; hostile and long paths survive (V-07; F-A1, F-A6) | | TODO |
| E-0012 events and validity | `allocate`, `promote`, `alias`, `move` only; unknown `op`, double `promote`, `promote` of unallocated, alias cycle/dangling, bad `move` rejected `INVALID_REGISTRY` (V-25; F-C3) | | TODO |
| E-0012 counter | Next number = max suffix over all recorded IDs + 1 per prefix (V-02, V-03, V-04; F-A2, F-A3) | | TODO |
| E-0012 duplicates | Duplicate provisional allocations are a recorded collision, not corruption; entity scan used because union collapses identical lines (V-26, V-28, V-39; F-C4, F-C6, F-E2) | | TODO |
| E-0013 staleness | Stale iff older than threshold AND same host AND pid not alive (V-12, V-13, V-14; F-B3(i)-(iii)) | | TODO |
| E-0013 foreign host | A lock owned by another host is never auto-broken (V-15; F-B3(iv)) | | TODO |
| E-0013 break | Break by atomic rename to a unique `.kf/*.lock` name; single winner; no removal of a newer lock (V-17; F-B3(vii)) | | TODO |
| E-0013 deadline and retry | Injectable deadline; `LOCK_TIMEOUT`; `EPERM`/`EBUSY`/`EACCES` rename retries (V-20, V-22; F-B3(vi), F-B4). Owner-less lock recovery: D-04 | | TODO |
| E-0014 surface | Engine API only: no `bin/`, no `kf` command, no `package.json` `bin` (V-57) | | TODO |
| E-0014 missing/corrupt registry | Missing never auto-recreated from an entity scan (class 5); corrupt `INVALID_YAML`/`INVALID_REGISTRY` (class 4) (V-23, V-24; F-C1, F-C2) | | TODO |
| E-0014 codes | No new `KF-` codes; typed internal error codes per the API table; shadowed alias is message-only (V-45, V-50) | | TODO |

## Pending decisions affecting rows (see `TRIAGE.md`)

| Item | Rows held |
|---|---|
| D-01 | V-23 (`.kf/` pre-exists without registry) |
| D-02 | V-38, V-39, V-40, V-41 (alias commit value, numeric order of several losers, event order) |
| D-03 | V-08 and V-42 in part (a), (c); V-53 in part (b) |
| D-04 | V-16 (owner-less lock older than the threshold) |
| D-05 | V-23 (empty-list bytes), V-27 (both branches append their first event) |

## Deferrals (not P002 rows)

- T-09 `ids.padding` (l.1938): P007. T-10 alias handling in query surfaces (`kf show`, `kf context`, `kf impact`, `kf diff`): P021/P022. E-0006 address grammar: OPEN, outside P002. `kf create` and promotion in `kf validate`: P007. `kf init` creating the registry: P028. `kf update`/`move` writer: later phase.
