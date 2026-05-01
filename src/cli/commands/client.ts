import { runForegroundClient } from '../../client/run-foreground.js';

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
export async function clientCommand(options: ClientCommandOptions): Promise<void> {
  const mode = options.resultMode;
  const resultMode: 'cancel' | 'replace-buffer-fixture' =
    mode === 'replace-buffer-fixture' ? 'replace-buffer-fixture' : 'cancel';

  await runForegroundClient({
    requestFile: options.requestFile,
    resultFile: options.resultFile,
    resultMode,
  });
}
