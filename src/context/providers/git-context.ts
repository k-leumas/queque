import { execFile } from 'node:child_process';
import { statSync } from 'node:fs';
import { promisify } from 'node:util';
import type { ContextChunk } from '../../contracts/request.js';
import { appendDebugLog } from '../../shared/debug-log.js';
import { detectVcsContext } from '../../shared/vcs-context.js';
import type { ContextProvider, GatherContextInput } from '../provider.js';

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 5000;

function assertSafeCwd(cwd: string): void {
  let st: ReturnType<typeof statSync>;
  try {
    st = statSync(cwd);
  } catch {
    throw new Error(`cwd not accessible: ${cwd}`);
  }
  if (!st.isDirectory()) throw new Error(`cwd is not a directory: ${cwd}`);
}

function unescapeGitPath(s: string): string {
  return s
    .replace(/\\([0-7]{3})/g, (_, oct) => String.fromCodePoint(parseInt(oct, 8)))
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\');
}

function stripQuotes(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    return unescapeGitPath(value.slice(1, -1));
  }

  return value;
}

/** @internal For direct unit coverage of porcelain edge cases. */
export function parsePorcelainLine(line: string): string | null {
  if (line.length < 4) {
    return null;
  }

  const rest = line.slice(3);
  const renameSeparator = ' -> ';
  const renameIndex = rest.indexOf(renameSeparator);

  if (renameIndex !== -1) {
    return stripQuotes(rest.slice(renameIndex + renameSeparator.length));
  }

  return stripQuotes(rest);
}

async function getChangedFiles(cwd: string): Promise<string[]> {
  assertSafeCwd(cwd);
  try {
    const { stdout } = await execFileAsync('git', ['-C', cwd, 'status', '--porcelain'], {
      encoding: 'utf8',
      timeout: GIT_TIMEOUT_MS,
    });

    return stdout
      .split('\n')
      .filter(Boolean)
      .map(parsePorcelainLine)
      .filter((path): path is string => path !== null);
  } catch {
    return [];
  }
}

export const gitContextProvider: ContextProvider = {
  id: 'git-context',
  intents: ['codebase', 'shell-command'],
  async gather(input: GatherContextInput): Promise<ContextChunk | null> {
    if (
      input.decision.intent === 'shell-command' &&
      !input.decision.signals.includes('git-prefix')
    ) {
      return null;
    }

    try {
      assertSafeCwd(input.base.cwd);
      const vcs = await detectVcsContext(input.base.cwd);
      if (vcs.kind === 'none') {
        return null;
      }

      const changedFiles = await getChangedFiles(input.base.cwd);

      void appendDebugLog('context', 'git provider gathered', {
        cwd: input.base.cwd,
        branch: vcs.branch,
        dirty: vcs.dirty,
        changedFiles: changedFiles.length,
      });

      return {
        kind: 'git',
        payload: {
          cwd: vcs.cwd,
          root: vcs.root,
          branch: vcs.branch,
          dirty: vcs.dirty,
          changedFiles,
        },
      };
    } catch (error) {
      void appendDebugLog('context', 'git provider failed', {
        cwd: input.base.cwd,
        message: error instanceof Error ? error.message : String(error),
      });

      return null;
    }
  },
};
