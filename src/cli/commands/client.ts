import { runForegroundClient } from '../../client/run-foreground.js';
import { appendDebugLog } from '../../shared/debug-log.js';

export interface ClientCommandOptions {
  requestFile: string;
  resultFile: string;
  resultMode?: string;
}

/**
 * Real client command handler.
 *
 * `qq client --request-file <path> --result-file <path> [--result-mode <mode>]`
 *
 * Dispatches to the foreground client loop. The `--result-mode` flag selects
 * the deterministic Phase 1 seam:
 *   cancel                 — emit a cancel result (default)
 *   replace-buffer-fixture — emit a deterministic replace-buffer result
 *
 * Free of Ink and React imports — Phase 4 will wire the TUI inside
 * runForegroundClient without changing this handler.
 */
const VALID_MODES = ['cancel', 'replace-buffer-fixture', 'llm'] as const;
type ResultMode = (typeof VALID_MODES)[number];

function parseResultMode(mode: string | undefined): ResultMode {
  if (mode === undefined || mode === 'llm') return 'llm';
  if (mode === 'cancel') return 'cancel';
  if (mode === 'replace-buffer-fixture') return 'replace-buffer-fixture';
  void appendDebugLog('client', `unknown --result-mode "${mode}", defaulting to cancel`);
  return 'cancel';
}

export async function clientCommand(options: ClientCommandOptions): Promise<void> {
  const resultMode = parseResultMode(options.resultMode);

  void appendDebugLog('client', 'command start', {
    requestFile: options.requestFile,
    resultFile: options.resultFile,
    resultMode,
  });

  await runForegroundClient({
    requestFile: options.requestFile,
    resultFile: options.resultFile,
    resultMode,
  });
}
