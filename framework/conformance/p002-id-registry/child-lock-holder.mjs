// Child process for F-B5: take the registry lock through the engine, then hang inside the registry rename
// so the lock stays held by a live process until the parent kills it.
// usage: node child-lock-holder.mjs <projectRoot>
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { setInterval } from 'node:timers';
import { ENGINE_URL } from './scratch.mjs';

const [, , projectRoot] = process.argv;
const engine = await import(ENGINE_URL);
setInterval(() => {}, 1000); // keep the event loop alive while the rename never settles
await engine.allocateId(projectRoot, 'BR', 'knowledge/business-rules/held/rule.yaml', {
  lock: { deadlineMs: 60000, pollMs: 5 },
  rename: async (from, to) => {
    if (path.basename(to) !== 'id-registry.yaml') return fs.rename(from, to);
    process.stdout.write('locked\n');
    await new Promise(() => {});
  },
});
