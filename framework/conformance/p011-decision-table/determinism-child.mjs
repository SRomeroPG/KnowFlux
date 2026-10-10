// P011 conformance helper (PLAN F-S2): run in a FRESH process; prints the JSON of a fixed set of engine
// results. The conformance test runs it and compares the bytes with the in-process result
// (E-0019/PLAN design constraints: results and diagnostics are byte-identical on every run).
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { TH, allFiveCodes, multiKeyFindings, vals } from './tables.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_DIR = path.resolve(HERE, '..', '..', 'engine');

export function payload(DT, UN, unitsData) {
  const unitRegistry = UN.buildUnitRegistry(JSON.parse(JSON.stringify(unitsData)));
  return JSON.stringify({
    check_all_codes: DT.checkDecisionTable(allFiveCodes(), { unitRegistry }),
    check_multi_key: DT.checkDecisionTable(multiKeyFindings(), { unitRegistry }),
    eval_collect: DT.evaluateDecisionTable(TH({ policy: 'collect' }), vals({ material: 'Y', count: '1' }), { unitRegistry }),
    eval_unique: DT.evaluateDecisionTable(TH({ policy: 'unique' }), vals({ material: 'Y', count: '1' }), { unitRegistry }),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const DT = await import(pathToFileURL(path.join(ENGINE_DIR, 'decision-table.mjs')).href);
  const UN = await import(pathToFileURL(path.join(ENGINE_DIR, 'units.mjs')).href);
  const unitsData = YAML.parse(await fs.readFile(path.join(HERE, 'units-u1.yaml'), 'utf8'));
  process.stdout.write(payload(DT, UN, unitsData));
}
