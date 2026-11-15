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

/** The QQ_TEST_RESULT_MODE values that may change the result: the fixture modes. */
const TEST_ENV_MODES: ReadonlySet<string> = new Set(['cancel', 'replace-buffer-fixture']);

/**
 * The flag wins and keeps parseResultMode's rules. QQ_TEST_RESULT_MODE is a dev/test-only
 * fallback (see CONTRIBUTING.md), read here so no shell adapter carries test code. Only a
 * fixture name counts: an empty or stale value leaked into a real shell must not turn every
 * `??` into a silent cancel (11-REVIEW WR-05).
 */
export function resolveResultMode(
  flag: string | undefined,
  envMode: string | undefined,
): ResultMode {
  if (flag !== undefined) return parseResultMode(flag);
  if (envMode === undefined || TEST_ENV_MODES.has(envMode)) return parseResultMode(envMode);
  void appendDebugLog('client', `ignored QQ_TEST_RESULT_MODE "${envMode}" (not a fixture mode)`);
  return 'llm';
}

export async function clientCommand(options: ClientCommandOptions): Promise<void> {
  const resultMode = resolveResultMode(options.resultMode, process.env.QQ_TEST_RESULT_MODE);

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
