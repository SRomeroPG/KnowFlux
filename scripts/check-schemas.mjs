import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaRoot = path.join(root, 'framework', 'schemas');

async function jsonFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? jsonFiles(target) : entry.name.endsWith('.json') ? [target] : [];
  }));
  return nested.flat().sort();
}

export async function loadSchemas() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: true });
  addFormats(ajv);
  const files = await jsonFiles(schemaRoot);
  if (files.length === 0) throw new Error('No JSON Schemas found');
  for (const file of files) {
    const schema = JSON.parse(await readFile(file, 'utf8'));
    if (!schema.$id) throw new Error(`Schema has no $id: ${path.relative(root, file)}`);
    ajv.addSchema(schema);
  }
  for (const file of files) {
    const schema = JSON.parse(await readFile(file, 'utf8'));
    ajv.getSchema(schema.$id);
  }
  return { ajv, files };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { files } = await loadSchemas();
  process.stdout.write(`Compiled ${files.length} JSON Schemas.\n`);
}
