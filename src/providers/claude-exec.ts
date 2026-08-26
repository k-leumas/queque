import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const promisifiedExecFile = promisify(execFile);

/**
 * Thin execFile wrapper that always resolves `{ stdout, stderr }` so tests can
 * mock this module instead of raw `execFile` + `promisify`.
 */
export async function execFileAsync(
  file: string,
  args: readonly string[],
  options?: Parameters<typeof promisifiedExecFile>[2],
): Promise<{ stdout: string; stderr: string }> {
  const result = await promisifiedExecFile(file, [...args], options);
  if (typeof result === 'string') {
    return { stdout: result, stderr: '' };
  }

  return {
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? ''),
  };
}
