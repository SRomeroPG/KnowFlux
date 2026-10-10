// P012 conformance helper: loads the worked example of spec section 12.2 from the FROZEN spec file (PLAN F-W):
// l.640 is the opening fence, l.641-652 the YAML, l.653 the closing fence. The slice cannot drift from the spec text.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SPEC_PATH = path.resolve(HERE, '..', '..', '..', 'knowledge-framework-spec-v2.1.md');

export async function readSpecExample() {
  const text = await fs.readFile(SPEC_PATH, 'utf8');
  const lines = text.split(/\r?\n/);
  const open = lines[639];
  const close = lines[652];
  const block = lines.slice(640, 652).join('\n');
  return { open, close, block, parsed: YAML.parse(block) };
}

export async function loadSpecFormula() {
  const { open, close, parsed } = await readSpecExample();
  if (!open.startsWith('```') || close !== '```') throw new Error(`spec l.640/l.653 are not the fences of the example: ${JSON.stringify([open, close])}`);
  return parsed.logic;
}
