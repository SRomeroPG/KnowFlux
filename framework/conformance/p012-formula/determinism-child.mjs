// P012 conformance helper (PLAN F-S2): run in a FRESH process; prints the JSON of a representative set of engine results
// (W2 values, W5 ties, G1 guard order, V4 rounding twice, Zn8 two divisions, S1 four codes). The conformance test runs it
// and compares the bytes with the in-process result (results and diagnostics are byte-identical on every run).
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { C, FX, OK, ref, rnd, vals } from './builders.mjs';
import { GROUPS } from './cases.mjs';
import { w5Cases, wGroups } from './cases-w.mjs';
import { execCase, plain } from './exec.mjs';
import { loadSpecFormula } from './spec-example.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_DIR = path.resolve(HERE, '..', '..', 'engine');
export const DETERMINISM_GROUPS = ['F-G1', 'F-V4', 'F-Zn8', 'F-S1', 'F-S1b', 'F-U6b', 'F-Zr'];
export const DETERMINISM_W = ['F-W2', 'F-W6'];

export async function loadRegistryData() {
  const out = {};
  for (const name of ['uf0', 'uf1', 'uf2']) out[name] = YAML.parse(await fs.readFile(path.join(HERE, `units-${name}.yaml`), 'utf8'));
  return out;
}

/** Cases of the representative set (ties of W5 are generated here from the same table the test uses). */
export async function representativeCases() {
  const W = await loadSpecFormula();
  const rounding = YAML.parse(await fs.readFile(path.join(HERE, 'rounding.yaml'), 'utf8'));
  const cases = [];
  for (const key of DETERMINISM_GROUPS) cases.push(...GROUPS.get(key).cases);
  for (const g of wGroups(W)) if (DETERMINISM_W.includes(g.key)) cases.push(...g.cases);
  cases.push(...w5Cases(W, rounding));
  cases.push(C('shape', FX(ref('f'), 'ratio', rnd('half-even', 2)), OK('1.00'), { values: vals({ f: '1' }) }));
  return cases;
}

export async function payload(F, UN) {
  const registryData = await loadRegistryData();
  const cases = await representativeCases();
  return JSON.stringify(cases.map((c) => plain(execCase(F, UN, registryData, c))));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const F = await import(pathToFileURL(path.join(ENGINE_DIR, 'formula.mjs')).href);
  const UN = await import(pathToFileURL(path.join(ENGINE_DIR, 'units.mjs')).href);
  process.stdout.write(await payload(F, UN));
}
