// Child process for F-B2 / F-B3(vii): allocate <count> IDs of <prefix> against one project and print them.
// usage: node child-allocator.mjs <projectRoot> <count> <prefix> <tag>
import { ENGINE_URL } from './scratch.mjs';

const [, , projectRoot, countText, prefix, tag] = process.argv;
const engine = await import(ENGINE_URL);
const ids = [];
for (let i = 0; i < Number(countText); i += 1) {
  const allocation = await engine.allocateId(projectRoot, prefix, `knowledge/business-rules/${tag}-${i}/rule.yaml`, {
    lock: { deadlineMs: 60000, pollMs: 5 },
  });
  ids.push(allocation.id);
}
process.stdout.write(`${JSON.stringify(ids)}\n`);
