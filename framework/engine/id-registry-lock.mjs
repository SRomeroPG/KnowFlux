// Registry lock and atomic file replacement (E-0013). Wall-clock values here (acquired_at, deadlines) are
// operational only: they never influence an ID, an event or an event order.
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename as fsRename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { IdRegistryError } from './id-registry-errors.mjs';
import { REGISTRY_DIR } from './id-registry-codec.mjs';

export const LOCK_NAME = 'id-registry.lock';
export const OWNER_NAME = 'owner.json';
const RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES']);

function defaultIsProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function nonNegative(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function lockSettings(options) {
  const o = options && typeof options === 'object' ? options : {};
  return {
    deadlineMs: nonNegative(o.deadlineMs, 5000),
    staleAfterMs: nonNegative(o.staleAfterMs, 60000),
    pollMs: Math.max(1, nonNegative(o.pollMs, 20)),
    hostname: typeof o.hostname === 'string' ? o.hostname : os.hostname(),
    isProcessAlive: typeof o.isProcessAlive === 'function' ? o.isProcessAlive : defaultIsProcessAlive,
    now: typeof o.now === 'function' ? o.now : () => new Date(),
  };
}

/** rename that retries EPERM/EBUSY/EACCES every pollMs until the deadline (then LOCK_TIMEOUT); others propagate. */
export async function renameWithRetry(rename, from, to, { pollMs, deadlineMs }, what = 'rename') {
  const until = performance.now() + deadlineMs;
  for (;;) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      if (!RETRYABLE.has(error?.code)) throw error;
      if (performance.now() >= until) {
        throw new IdRegistryError('LOCK_TIMEOUT', `${what} stayed blocked (${error.code}) past the deadline: ${to}`, { cause: error.code });
      }
      await sleep(pollMs);
    }
  }
}

/**
 * Write `content` to `file` atomically: temporary file in the same directory, flush, rename over the target.
 * With `expectedText` (audit R02 F03) the target is re-read immediately before the rename; if it no longer holds exactly
 * that text (changed or removed by someone else) nothing is replaced and the result is false. Otherwise true.
 */
export async function atomicWrite(file, content, { rename = fsRename, pollMs = 20, deadlineMs = 5000, expectedText } = {}) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  let handle = null;
  try {
    handle = await open(temporary, 'wx');
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    if (expectedText !== undefined) {
      const current = await readFile(file, 'utf8').catch(() => null);
      if (current !== expectedText) {
        await rm(temporary, { force: true });
        return false;
      }
    }
    await renameWithRetry(rename, temporary, file, { pollMs, deadlineMs }, 'registry rename');
    return true;
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

function parseOwner(text) {
  let owner;
  try {
    owner = JSON.parse(text);
  } catch {
    return null;
  }
  if (!owner || typeof owner !== 'object') return null;
  if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) return null;
  if (typeof owner.host !== 'string' || typeof owner.acquired_at !== 'string') return null;
  const acquired = Date.parse(owner.acquired_at);
  if (Number.isNaN(acquired)) return null;
  return { pid: owner.pid, host: owner.host, acquired };
}

function isStale(owner, s) {
  return owner.host === s.hostname
    && s.now().getTime() - owner.acquired > s.staleAfterMs
    && !s.isProcessAlive(owner.pid);
}

/**
 * Break a stale lock without ever removing a lock acquired after staleness was determined.
 * 1. Claim the exact owner file that was judged stale by renaming it inside the lock directory. Only one
 *    contender wins that rename, and while the directory exists nobody else can acquire.
 * 2. The claimed file must still be byte-identical to the stale owner that was observed; otherwise a newer
 *    acquirer owns the lock: the owner file is put back and nothing is removed.
 * 3. Only then is the lock directory renamed to a unique `.kf/*.lock` sibling and removed.
 */
async function breakStale(dir, lock, observedText, s) {
  const ownerFile = path.join(lock, OWNER_NAME);
  const claim = path.join(lock, `${OWNER_NAME}.${randomUUID()}.claim`);
  const retry = { pollMs: s.pollMs, deadlineMs: s.deadlineMs };
  try {
    await renameWithRetry(fsRename, ownerFile, claim, retry, 'lock claim');
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  let claimedText = null;
  try {
    claimedText = await readFile(claim, 'utf8');
  } catch {
    claimedText = null;
  }
  const restore = () => fsRename(claim, ownerFile).catch(() => {});
  if (claimedText !== observedText) {
    await restore();
    return;
  }
  const sibling = path.join(dir, `id-registry.broken-${randomUUID()}.lock`);
  try {
    await renameWithRetry(fsRename, lock, sibling, retry, 'lock break');
  } catch (error) {
    await restore();
    throw error;
  }
  await rm(sibling, { recursive: true, force: true, maxRetries: 20, retryDelay: s.pollMs }).catch(() => {});
}

async function acquire(root, s) {
  const dir = path.join(root, REGISTRY_DIR);
  const lock = path.join(dir, LOCK_NAME);
  const ownerFile = path.join(lock, OWNER_NAME);
  const started = performance.now();
  const remaining = () => s.deadlineMs - (performance.now() - started);
  const timeout = () => new IdRegistryError('LOCK_TIMEOUT', `ID registry is locked; remove the lock directory manually if no process holds it: ${lock}`, { lock });
  for (;;) {
    let created = false;
    try {
      await mkdir(lock);
      created = true;
    } catch (error) {
      if (error?.code === 'ENOENT') throw new IdRegistryError('REGISTRY_MISSING', 'ID registry directory .kf/ is missing; refusing to recreate it');
      if (error?.code !== 'EEXIST' && !RETRYABLE.has(error?.code)) throw error;
    }
    if (created) {
      try {
        const owner = { pid: process.pid, host: s.hostname, acquired_at: s.now().toISOString() };
        await writeFile(ownerFile, JSON.stringify(owner), 'utf8');
      } catch (error) {
        await rm(lock, { recursive: true, force: true }).catch(() => {});
        throw error;
      }
      return async () => { await rm(lock, { recursive: true, force: true, maxRetries: 50, retryDelay: s.pollMs }); };
    }
    let observedText = null;
    try {
      observedText = await readFile(ownerFile, 'utf8');
    } catch {
      observedText = null;
    }
    const owner = observedText === null ? null : parseOwner(observedText);
    if (owner && isStale(owner, s)) {
      await breakStale(dir, lock, observedText, s);
      if (remaining() <= 0) throw timeout();
      continue;
    }
    if (remaining() <= 0) throw timeout();
    await sleep(Math.max(1, Math.min(s.pollMs, remaining())));
  }
}

/** Run `operation` while holding the registry lock; the lock is released on success and on every failure. */
export async function withRegistryLock(root, lockOptions, operation) {
  const settings = lockSettings(lockOptions);
  const release = await acquire(root, settings);
  const context = { pollMs: settings.pollMs, deadlineMs: settings.deadlineMs };
  let result;
  try {
    result = await operation(context);
  } catch (error) {
    await release().catch(() => {});
    throw error;
  }
  await release();
  return result;
}
