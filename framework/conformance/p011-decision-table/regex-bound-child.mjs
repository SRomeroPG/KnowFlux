// P011 conformance helper (AUDIT_R01 F01/F02): run in a CHILD process under a hard timeout so that a regression
// (a compile that never returns) fails the suite instead of hanging it. Usage: node regex-bound-child.mjs <name> <via>
//   via = compile -> compileRe2 (+ one searchRe2 on a short text when it compiled)
//   via = check   -> checkDecisionTable and evaluateDecisionTable with the pattern in a `matches` matcher
// Prints one JSON line with the observed outcome and timings (ms measured inside the child).
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { BOUND_PATTERNS } from './regex-bound-patterns.mjs';
import { S1 } from './tables.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_DIR = path.resolve(HERE, '..', '..', 'engine');
const load = (file) => import(pathToFileURL(path.join(ENGINE_DIR, file)).href);

const [name, via] = process.argv.slice(2);
const pattern = BOUND_PATTERNS[name];
if (typeof pattern !== 'string' || !['compile', 'check'].includes(via)) {
  process.stderr.write(`usage: regex-bound-child.mjs <${Object.keys(BOUND_PATTERNS).join('|')}> <compile|check>\n`);
  process.exit(2);
}

const timed = (fn) => {
  const start = performance.now();
  const value = fn();
  return { value, ms: performance.now() - start };
};

if (via === 'compile') {
  const R = await load('regex-re2.mjs');
  const compiled = timed(() => R.compileRe2(pattern));
  const out = { ok: compiled.value.ok, compile_ms: compiled.ms };
  if (compiled.value.ok) {
    const searched = timed(() => R.searchRe2(compiled.value.program, 'abc'));
    out.search_ms = searched.ms;
    out.matched = searched.value;
  }
  process.stdout.write(`${JSON.stringify(out)}\n`);
} else {
  const DT = await load('decision-table.mjs');
  const UN = await load('units.mjs');
  const unitRegistry = UN.buildUnitRegistry(YAML.parse(await fs.readFile(path.join(HERE, 'units-u1.yaml'), 'utf8')));
  const t = S1(['s'], { note: { matches: pattern } });
  const checked = timed(() => DT.checkDecisionTable(JSON.parse(JSON.stringify(t)), { unitRegistry }));
  const evaluated = timed(() => DT.evaluateDecisionTable(JSON.parse(JSON.stringify(t)), { 'DE-0001.note': 'abc' }, { unitRegistry }));
  process.stdout.write(`${JSON.stringify({
    codes: checked.value.map((d) => d.code),
    check_ms: checked.ms,
    eval_status: evaluated.value.status,
    eval_codes: evaluated.value.diagnostics.map((d) => d.code),
    eval_ms: evaluated.ms,
  })}\n`);
}
