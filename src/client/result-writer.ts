import * as fsp from 'node:fs/promises';
import { shellResultSchema, type ShellResult } from '../contracts/shell.js';

/**
 * Validates a ShellResult and writes newline-terminated JSON to `resultFile`.
 *
 * The file is written atomically (create or overwrite) and the result is
 * exactly one JSON line so the zsh bridge can read it with a simple `cat`.
 *
 * Throws if the result does not conform to the ShellResult schema.
 */
export async function writeShellResult(
  resultFile: string,
  result: ShellResult,
): Promise<void> {
  // Validate the result shape — catch programming errors early
  const parsed = shellResultSchema.parse(result);

  const line = JSON.stringify(parsed) + '\n';
  await fsp.writeFile(resultFile, line, { encoding: 'utf-8' });
}
