// Default GitHistoryReader (PLAN createGitHistoryReader): the real `git` executable, argument arrays only, no shell.
import { execFile } from 'node:child_process';
import path from 'node:path';
import { hasControlCharacter } from './id-registry-codec.mjs';
import { IdRegistryError } from './id-registry-errors.mjs';

const MAX_BUFFER = 512 * 1024 * 1024;
const ENVIRONMENT_DROP = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_COMMON_DIR', 'GIT_NAMESPACE', 'GIT_GRAFT_FILE', 'GIT_REPLACE_REF_BASE'];

function git(cwd, args) {
  // Replace refs and grafts must not alter the history the engine reads (E-0024 (4)): identical on every clone.
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C', GIT_NO_REPLACE_OBJECTS: '1' };
  for (const name of ENVIRONMENT_DROP) delete env[name];
  return new Promise((resolve) => {
    execFile('git', ['--no-replace-objects', ...args], { cwd, env, encoding: 'buffer', maxBuffer: MAX_BUFFER, windowsHide: true }, (error, stdout, stderr) => {
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
 * E-0024 (4): the canonical branch is resolved only as a branch, `refs/heads/<name>` first and then
 * `refs/remotes/origin/<name>`. Tags, revision expressions, reflog syntax and invalid ref names are unresolved.
 */
async function resolveBranch(cwd, branch) {
  if (typeof branch !== 'string' || branch === '' || branch.startsWith('-') || hasControlCharacter(branch) || branch.includes('@{')) {
    throw unresolved(branch);
  }
  const format = await git(cwd, ['check-ref-format', '--branch', branch]);
  if (format.errorCode === 'ENOENT' || format.status < 0) throw failed('check-ref-format', format);
  // --branch also expands `@{-N}`; only a name that comes back unchanged is a plain branch name
  if (format.status !== 0 || format.stdout.toString('utf8').trim() !== branch) throw unresolved(branch);
  for (const ref of [`refs/heads/${branch}`, `refs/remotes/origin/${branch}`]) {
    const verify = await git(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    if (verify.status === 0) return verify.stdout.toString('utf8').trim();
    if (verify.errorCode === 'ENOENT' || verify.status < 0 || verify.stderr.trim() !== '') throw failed('rev-parse', verify);
  }
  throw unresolved(branch);
}

/**
 * Reader backed by the git executable, rooted at `projectRoot` (paths are resolved relative to it).
 * firstParentCommits(branch): `git rev-list --first-parent --reverse` of the commit the branch resolves to.
 * readFile(commit, repoPath): UTF-8 text of the file at that commit; null only when the path is genuinely absent from the
 * commit's tree (or is not a file). A blob, tree or commit that cannot be read is GIT_FAILED / HISTORY_INCOMPLETE.
 * headCommit(): full SHA of the checkout's HEAD (E-0035 (2)); the E-0029 tip check compares it with the branch tip.
 */
export function createGitHistoryReader(projectRoot) {
  const cwd = path.resolve(projectRoot);
  return {
    async firstParentCommits(branch) {
      const tip = await resolveBranch(cwd, branch);
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
      if (known.status === 1 && known.stderr.trim() === '') {
        throw new IdRegistryError('HISTORY_INCOMPLETE', `commit ${commit} is not available in this repository`);
      }
      if (known.status !== 0) throw failed('cat-file', blob);
      // The commit exists. A failed read is "path absent" only if the tree says so (audit R02 F02); an entry that the
      // tree lists as a blob but whose object cannot be read is a failure, never null.
      // --literal-pathspecs: a repo path such as `:(glob)x` or `a[1].yaml` must be matched literally.
      const listing = await git(cwd, ['--literal-pathspecs', 'ls-tree', '-z', commit, '--', repoPath]);
      if (listing.status !== 0) throw failed('ls-tree', listing);
      for (const record of listing.stdout.toString('utf8').split('\u0000')) {
        if (/^[0-7]+ blob /.test(record)) throw failed('cat-file', blob);
      }
      return null;
    },

    async headCommit() {
      const head = await git(cwd, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']);
      const sha = head.stdout.toString('utf8').trim();
      if (head.status !== 0 || !/^[0-9a-f]{40,64}$/.test(sha)) throw failed('rev-parse HEAD', head);
      return sha;
    },
  };
}
