import * as fsp from 'node:fs/promises';
import { redactForLog } from './privacy-filter.js';

export const debugLogPath =
  process.env.QQ_DEBUG_LOG_FILE ?? `/tmp/qq-${process.getuid?.() ?? 'unknown'}-debug.log`;

function formatDetails(details: unknown): string {
  if (details === undefined) return '';
  try {
    return ` ${JSON.stringify(details)}`;
  } catch {
    return ' [unserializable-details]';
  }
}

export async function appendDebugLog(
  scope: string,
  message: string,
  details?: unknown,
): Promise<void> {
  const line = `${new Date().toISOString()} [${scope}] ${message}${formatDetails(redactForLog(details))}\n`;

  try {
    await fsp.appendFile(debugLogPath, line, { encoding: 'utf-8', mode: 0o600 });
  } catch {
    // Debug logging must never break the user flow.
  }
}
