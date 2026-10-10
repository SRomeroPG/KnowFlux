// Default GitHistoryReader (PLAN createGitHistoryReader): the real `git` executable, argument arrays only, no shell.
import { execFile } from 'node:child_process';
import path from 'node:path';
import { hasControlCharacter } from './id-registry-codec.mjs';
import { IdRegistryError } from './id-registry-errors.mjs';

const MAX_BUFFER = 512 * 1024 * 1024;
const ENVIRONMENT_DROP = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_COMMON_DIR', 'GIT_NAMESPACE'];

function git(cwd, args) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' };
  for (const name of ENVIRONMENT_DROP) delete env[name];
  return new Promise((resolve) => {
    execFile('git', args, { cwd, env, encoding: 'buffer', maxBuffer: MAX_BUFFER, windowsHide: true }, (error, stdout, stderr) => {
      resolve({
        status: error ? (typeof error.code === 'number' ? error.code : -1) : 0,
        errorCode: error && typeof error.code === 'string' ? error.code : null,
        stdout,
        stderr: stderr ? stderr.toString('utf8') : '',
      });
    });
  });
}

function failed(action, result) {
  const reason = result.errorCode === 'ENOENT' ? 'the git executable was not found' : result.stderr.trim() || `exit status ${result.status}`;
  return new IdRegistryError('GIT_FAILED', `git ${action} failed: ${reason}`, { status: result.status });
}


function unresolved(branch) {
  return new IdRegistryError('CANONICAL_BRANCH_UNRESOLVED', `canonical branch does not resolve to a commit: ${JSON.stringify(branch)}`, { branch });
}

/**
 * Reader backed by the git executable, rooted at `projectRoot` (paths are resolved relative to it).
 * firstParentCommits(branch): `git rev-list --first-parent --reverse` of the commit the branch resolves to.
 * readFile(commit, repoPath): UTF-8 text of the file at that commit, null if absent.
 */
export function createGitHistoryReader(projectRoot) {
  const cwd = path.resolve(projectRoot);
  return {
    async firstParentCommits(branch) {
      if (typeof branch !== 'string' || branch === '' || branch.startsWith('-') || hasControlCharacter(branch)) {
        throw unresolved(branch);
      }
      const verify = await git(cwd, ['rev-parse', '--verify', '--quiet', `${branch}^{commit}`]);
      if (verify.status !== 0) {
        if (verify.errorCode === 'ENOENT' || verify.status < 0 || verify.stderr.trim() !== '') throw failed('rev-parse', verify);
        throw unresolved(branch);
      }
      const tip = verify.stdout.toString('utf8').trim();
      const shallow = await git(cwd, ['rev-parse', '--is-shallow-repository']);
      if (shallow.status !== 0) throw failed('rev-parse --is-shallow-repository', shallow);
      if (shallow.stdout.toString('utf8').trim() === 'true') {
        throw new IdRegistryError('HISTORY_INCOMPLETE', 'the repository is shallow; first-parent history is truncated and clone-dependent');
      }
      const listing = await git(cwd, ['rev-list', '--first-parent', '--reverse', tip]);
      if (listing.status !== 0) throw failed('rev-list', listing);
      return listing.stdout.toString('utf8').split('\n').filter((line) => line !== '');
    },

    async readFile(commit, repoPath) {
      if (typeof commit !== 'string' || !/^[0-9a-f]{40,64}$/.test(commit)) {
        throw new IdRegistryError('GIT_FAILED', `not a full commit id: ${JSON.stringify(commit)}`);
      }
      const blob = await git(cwd, ['cat-file', 'blob', `${commit}:./${repoPath}`]);
      if (blob.status === 0) return blob.stdout.toString('utf8');
      const known = await git(cwd, ['rev-parse', '--verify', '--quiet', `${commit}^{commit}`]);
      if (known.status === 0) return null; // the commit exists: the path is absent there (or is not a file)
      if (known.status === 1 && known.stderr.trim() === '') {
        throw new IdRegistryError('HISTORY_INCOMPLETE', `commit ${commit} is not available in this repository`);
      }
      throw failed('cat-file', blob);
    },
  };
}
