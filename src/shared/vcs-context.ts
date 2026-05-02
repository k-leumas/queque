import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type VcsContext =
  | {
      kind: 'none';
      cwd: string;
    }
  | {
      kind: 'git';
      cwd: string;
      root: string;
      branch: string | null;
      dirty: boolean;
    };

async function runGit(cwd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function detectVcsContext(cwd: string): Promise<VcsContext> {
  const insideWorkTree = await runGit(cwd, ['rev-parse', '--is-inside-work-tree']);

  if (insideWorkTree !== 'true') {
    return { kind: 'none', cwd };
  }

  const root = (await runGit(cwd, ['rev-parse', '--show-toplevel'])) ?? cwd;
  const branch = (await runGit(cwd, ['branch', '--show-current'])) || null;
  const dirty = Boolean((await runGit(cwd, ['status', '--porcelain=v1']))?.length);

  return {
    kind: 'git',
    cwd,
    root,
    branch,
    dirty,
  };
}
