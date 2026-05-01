import * as fsp from 'node:fs/promises';
import { shellRequestSchema } from '../contracts/shell.js';
import { ensureDaemon } from '../daemon/bootstrap.js';
import { socketPathForUid } from '../shared/socket-path.js';
import { writeShellResult } from './result-writer.js';

export interface ForegroundClientArgs {
  requestFile: string;
  resultFile: string;
  /**
   * Selects the deterministic result mode for this Phase 1 seam:
   *
   *   cancel                 — write {kind:'cancel'} immediately (Esc simulation)
   *   replace-buffer-fixture — write a deterministic {kind:'replace-buffer'} result
   *                            derived from the shell request so the zsh bridge can
   *                            round-trip an accepted selection end-to-end without
   *                            the Phase 4 TUI being built yet.
   */
  resultMode: 'cancel' | 'replace-buffer-fixture';
}

/**
 * Runs the foreground client loop.
 *
 * 1. Opens /dev/tty for interactive stdio (does not assume inherited stdio is a TTY).
 * 2. Reads and validates the shell request file.
 * 3. Ensures the background daemon is running.
 * 4. Emits a deterministic shell result based on `resultMode`.
 *
 * Phase 4 will replace step 4 with a real Ink TUI loop — the shell contract
 * and daemon bootstrap seam are established here without any UI framework imports.
 */
export async function runForegroundClient(args: ForegroundClientArgs): Promise<void> {
  const { requestFile, resultFile, resultMode } = args;

  // Phase 1: open /dev/tty to verify it is accessible before proceeding.
  // This is a pre-flight check only — no reads or writes are performed on this
  // handle here. Phase 4 will pass this handle to the Ink TUI for interactive
  // I/O; until then the handle is closed in the finally block below.
  const ttyHandle = await fsp.open('/dev/tty', 'r+');

  try {
    // Read and validate the shell request
    const raw = await fsp.readFile(requestFile, 'utf-8');
    const request = shellRequestSchema.parse(JSON.parse(raw.trim()));

    // Ensure the daemon is reachable before we do anything interactive
    const uid = typeof process.getuid === 'function' ? process.getuid() : 0;
    await ensureDaemon(socketPathForUid(uid));

    // Deterministic result seam — Phase 4 replaces this with the Ink TUI
    if (resultMode === 'replace-buffer-fixture') {
      // Derive a fixture from the request so the result is deterministic and
      // exercise the full zsh bridge round-trip without needing user input.
      const fixtureLbuffer = request.lbuffer || 'echo hello';
      await writeShellResult(resultFile, {
        kind: 'replace-buffer',
        lbuffer: fixtureLbuffer,
        rbuffer: request.rbuffer,
      });
    } else {
      await writeShellResult(resultFile, { kind: 'cancel' });
    }
  } finally {
    await ttyHandle.close();
  }
}
