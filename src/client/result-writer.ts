import * as fsp from 'node:fs/promises';
import { type ShellResult, shellResultSchema } from '../contracts/shell.js';

/**
 * Validates a ShellResult and writes newline-terminated JSON to `resultFile`.
 *
 * Write strategy depends on the type of `resultFile`:
 *
 * - Named pipe (FIFO): writes directly via fsp.writeFile() because rename(2)
 *   would replace the FIFO inode and break the waiting reader. Direct write
 *   delivers data to the open reader immediately.
 *
 * - Regular file: atomic rename — the JSON is first written to a sibling
 *   `.tmp` file and then renamed into place. On the same filesystem,
 *   rename(2) is atomic, so the zsh bridge will never observe a partial write.
 *   If the process is killed after the tmp write but before the rename, the
 *   result file simply does not appear and the zsh bridge falls back to
 *   cancel — no data corruption.
 *
 * Throws if the result does not conform to the ShellResult schema.
 */
export async function writeShellResult(resultFile: string, result: ShellResult): Promise<void> {
  // Validate the result shape — catch programming errors early
  const parsed = shellResultSchema.parse(result);

  const line = `${JSON.stringify(parsed)}\n`;

  // Detect named pipe: rename(2) would replace the FIFO inode and break
  // the waiting zsh reader. Direct writeFile delivers data to the open reader.
  let isFifo = false;
  try {
    const st = await fsp.stat(resultFile);
    isFifo = st.isFIFO();
  } catch {
    // Path does not exist yet (regular file not created yet) — not a FIFO
  }

  if (isFifo) {
    // Named pipe: direct write — no atomic rename
    await fsp.writeFile(resultFile, line, { encoding: 'utf-8' });
  } else {
    // Regular file: atomic rename for zero-partial-write guarantee
    const tmpFile = `${resultFile}.tmp`;
    await fsp.writeFile(tmpFile, line, { encoding: 'utf-8' });
    await fsp.rename(tmpFile, resultFile);
  }
}
