// Git scenario builders for the P002 conformance slice (PLAN "Fixture slice" conventions).
// Base commit B0: .gitattributes (union merge for the registry), .gitignore (lock dirs), a hand-written
// registry holding exactly one seed `allocate CAP-0001` (non-empty list, E-0015 D-05), no entity of the
// scenarios. The engine is only used for what the scenario is about (allocation, promotion).
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  A, B, G, GITATTRIBUTES, GITIGNORE, REGISTRY_REL, Repo, SEED_PATH,
  alloc, br, entityText, eventLine, registryText, writeRegistry,
} from './scratch.mjs';

export async function makeBase(label, { seedEntity = false } = {}) {
  const repo = await Repo.create(label);
  await repo.write('.gitattributes', GITATTRIBUTES);
  await repo.write('.gitignore', GITIGNORE);
  await writeRegistry(repo.dir, registryText([alloc('CAP-0001', SEED_PATH)]));
  if (seedEntity) await repo.write(SEED_PATH, entityText({ id: 'CAP-0001', name: 'Seed', type: 'capability' }));
  repo.b0 = await repo.commit('B0');
  return repo;
}

/** engine allocation + entity file in the provisional state (what `kf create` will do). */
export async function allocWrite(E, repo, prefix, repoPath, name) {
  const allocation = await E.allocateId(repo.dir, prefix, repoPath);
  await repo.write(repoPath, entityText({ id: allocation.id, name }));
  return allocation;
}

export async function appendRegistryLine(dir, event) {
  await fs.appendFile(path.join(dir, ...REGISTRY_REL.split('/')), `${eventLine(event)}\n`);
}

export const promote = (E, dir, extra = {}) => E.promoteIds(dir, { canonicalBranch: 'main', ...extra });

/** F-D1 shape: feature branch holding A = BR-0001 provisional (not yet on main). */
export async function buildFeature(E, label, { seedEntity = false } = {}) {
  const repo = await makeBase(label, { seedEntity });
  await repo.checkout('feature', { create: true });
  const allocation = await allocWrite(E, repo, 'BR', A, 'Alpha');
  const origA = await repo.read(A);
  const featureCommit = await repo.commit('feature adds A');
  return { repo, dir: repo.dir, allocation, origA, featureCommit };
}

/** F-E1: f1 allocates BR-0001 for A, f2 (from B0) allocates BR-0001 for B; merged f1 then f2. */
export async function buildE1(E, label) {
  const repo = await makeBase(label);
  await repo.checkout('f1', { create: true });
  const a1 = await allocWrite(E, repo, 'BR', A, 'Alpha');
  await repo.commit('f1');
  await repo.checkout('main');
  await repo.checkout('f2', { create: true });
  const a2 = await allocWrite(E, repo, 'BR', B, 'Beta');
  await repo.commit('f2');
  await repo.checkout('main');
  const M1 = await repo.mergeNoFf('f1', 'M1');
  const M2 = await repo.mergeNoFf('f2', 'M2');
  return {
    repo, dir: repo.dir, a1, a2, M1, M2, origA: await repo.read(A), origB: await repo.read(B),
  };
}

/** F-E1 followed by the promotion call, committed on main (P1). */
export async function buildE1Promoted(E, label) {
  const ctx = await buildE1(E, label);
  ctx.first = await promote(E, ctx.dir);
  ctx.P1 = await ctx.repo.commit('promotion result');
  return ctx;
}

/** F-E2: one feature commit adds two files carrying BR-0001; the winner is the smaller byte-order path. */
export async function buildE2(E, label, { winner, loser, creation = 'reverse', registered = 'both' }) {
  const repo = await makeBase(label);
  await repo.checkout('feat', { create: true });
  const winnerPath = br(winner);
  const loserPath = br(loser);
  const allocation = await E.allocateId(repo.dir, 'BR', loserPath);
  if (registered === 'both') {
    await fs.appendFile(path.join(repo.dir, ...REGISTRY_REL.split('/')), `${eventLine(alloc(allocation.id, winnerPath))}\n`);
  }
  const files = creation === 'reverse'
    ? [[loserPath, 'Loser'], [winnerPath, 'Winner']]
    : [[winnerPath, 'Winner'], [loserPath, 'Loser']];
  for (const [p, name] of files) await repo.write(p, entityText({ id: allocation.id, name }));
  await repo.commit('feat');
  await repo.checkout('main');
  const M = await repo.mergeNoFf('feat', 'M');
  return {
    repo, dir: repo.dir, M, allocation, winnerPath, loserPath,
    origWinner: await repo.read(winnerPath), origLoser: await repo.read(loserPath),
  };
}

/** F-E3: three BR-0001 colliders in one commit plus an unrelated BR-0004 (so fresh IDs start at BR-0005). */
export async function buildE3(label) {
  const repo = await makeBase(label);
  await repo.checkout('feat', { create: true });
  const paths = { c3: br('c3'), b2: br('b2'), a1: br('a1') };
  await writeRegistry(repo.dir, registryText([
    alloc('CAP-0001', SEED_PATH),
    alloc('BR-0001', paths.c3), alloc('BR-0001', paths.b2), alloc('BR-0001', paths.a1),
    alloc('BR-0004', br('x4')),
  ]));
  for (const key of ['c3', 'b2', 'a1']) await repo.write(paths[key], entityText({ id: 'BR-0001', name: key }));
  await repo.commit('feat');
  await repo.checkout('main');
  const M = await repo.mergeNoFf('feat', 'M');
  const orig = {};
  for (const key of ['c3', 'b2', 'a1']) orig[key] = await repo.read(paths[key]);
  return { repo, dir: repo.dir, M, paths, orig };
}

/**
 * F-E5: f2 (from B0) allocates BR-0001 for B and BR-0002 for G; f1 (BR-0001 for A) is merged and promoted first;
 * f2 is merged afterwards.
 */
export async function buildE5(E, label) {
  const repo = await makeBase(label);
  await repo.checkout('f1', { create: true });
  await allocWrite(E, repo, 'BR', A, 'Alpha');
  await repo.commit('f1');
  await repo.checkout('main');
  await repo.checkout('f2', { create: true });
  const b = await allocWrite(E, repo, 'BR', B, 'Beta');
  const g = await allocWrite(E, repo, 'BR', G, 'Gamma');
  await repo.commit('f2');
  await repo.checkout('main');
  const M1 = await repo.mergeNoFf('f1', 'M1');
  const first = await promote(E, repo.dir);
  await repo.commit('promote f1');
  const M2 = await repo.mergeNoFf('f2', 'M2');
  return {
    repo, dir: repo.dir, b, g, M1, M2, first, origB: await repo.read(B), origG: await repo.read(G),
  };
}

export { A, B, G };
export const noopHistory = { firstParentCommits: async () => [], readFile: async () => null };
