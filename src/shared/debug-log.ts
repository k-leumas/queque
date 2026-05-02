import * as fsp from 'node:fs/promises';

export const debugLogPath = process.env.QQ_DEBUG_LOG_FILE ?? '/tmp/qq-debug.log';

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
  const line = `${new Date().toISOString()} [${scope}] ${message}${formatDetails(details)}\n`;

  try {
    await fsp.appendFile(debugLogPath, line, { encoding: 'utf-8' });
  } catch {
    // Debug logging must never break the user flow.
  }
}
