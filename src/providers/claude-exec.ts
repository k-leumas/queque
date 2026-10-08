import { spawn } from 'node:child_process';

/**
 * Options for `execFileAsync`. Built on `spawn` so `stdio` is actually applied —
 * Node's `execFile` silently ignores `stdio` and always opens a stdin pipe.
 */
export interface ExecFileAsyncOptions {
  encoding?: BufferEncoding;
  timeout?: number;
  killSignal?: NodeJS.Signals;
  maxBuffer?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  windowsHide?: boolean;
  shell?: boolean;
  stdio?: Array<'ignore' | 'pipe' | 'inherit'>;
}

interface SpawnFailure extends Error {
  code?: string | number | null;
  killed?: boolean;
  signal?: NodeJS.Signals | string | null;
  stdout?: string;
  stderr?: string;
}

/**
 * Spawns `file` with `args` and resolves `{ stdout, stderr }`.
 *
 * Uses `spawn` (not `execFile`) so `stdio: ['ignore','pipe','pipe']` disconnects
 * child stdin. That prevents `claude -p` from hanging on an open pipe.
 */
export async function execFileAsync(
  file: string,
  args: readonly string[],
  options: ExecFileAsyncOptions = {},
): Promise<{ stdout: string; stderr: string }> {
  const encoding = options.encoding ?? 'utf8';
  const maxBuffer = options.maxBuffer ?? 1024 * 1024;
  const killSignal = options.killSignal ?? 'SIGTERM';
  const stdio = options.stdio ?? ['ignore', 'pipe', 'pipe'];
  const timeoutMs = options.timeout;

  if (typeof timeoutMs === 'number' && timeoutMs <= 0) {
    const error: SpawnFailure = Object.assign(new Error(`Command timed out: ${file}`), {
      killed: true,
      signal: killSignal,
      code: null,
      stdout: '',
      stderr: '',
    });
    throw error;
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      callback();
    };

    const child = spawn(file, [...args], {
      cwd: options.cwd,
      env: options.env,
      stdio,
      windowsHide: options.windowsHide ?? true,
      shell: options.shell ?? false,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let exceededBuffer = false;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function combined(chunks: Buffer[]): string {
      return Buffer.concat(chunks).toString(encoding);
    }

    function pushChunk(chunks: Buffer[], chunk: Buffer | string): void {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      if (Buffer.concat(chunks).length > maxBuffer) {
        exceededBuffer = true;
        child.kill(killSignal);
      }
    }

    if (typeof timeoutMs === 'number') {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill(killSignal);
      }, timeoutMs);
    }

    child.stdout?.on('data', (chunk: Buffer | string) => {
      pushChunk(stdoutChunks, chunk);
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      pushChunk(stderrChunks, chunk);
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      if (timer) {
        clearTimeout(timer);
      }
      finish(() => {
        reject(error);
      });
    });

    child.on('close', (code, signal) => {
      if (timer) {
        clearTimeout(timer);
      }
      const stdout = combined(stdoutChunks);
      const stderr = combined(stderrChunks);

      if (exceededBuffer || timedOut) {
        const error: SpawnFailure = Object.assign(new Error(`Command timed out: ${file}`), {
          killed: true,
          signal: signal ?? killSignal,
          code: null,
          stdout,
          stderr,
        });
        finish(() => {
          reject(error);
        });
        return;
      }

      if (code !== 0 && code !== null) {
        const error: SpawnFailure = Object.assign(new Error(`Command failed: ${file}`), {
          code,
          killed: false,
          signal,
          stdout,
          stderr,
        });
        finish(() => {
          reject(error);
        });
        return;
      }

      if (signal) {
        const error: SpawnFailure = Object.assign(new Error(`Command killed: ${file}`), {
          killed: true,
          signal,
          code: null,
          stdout,
          stderr,
        });
        finish(() => {
          reject(error);
        });
        return;
      }

      finish(() => {
        resolve({ stdout, stderr });
      });
    });
  });
}
