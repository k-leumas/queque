import * as fsp from 'node:fs/promises';
import React from 'react';
import { render } from 'ink';
import { type NormalizedRequest } from '../contracts/request.js';
import { shellRequestSchema } from '../contracts/shell.js';
import { gatherContext } from '../context/pipeline.js';
import { ensureDaemon } from '../daemon/bootstrap.js';
import { classifyIntent } from '../intent/router.js';
import { fetchCandidates } from '../providers/claude.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { socketPathForUid } from '../shared/socket-path.js';
import { CandidateSelect } from '../ui/CandidateSelect.js';
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
   *   llm                    — call Claude and map its JSON response to shell output
   */
  resultMode: 'cancel' | 'replace-buffer-fixture' | 'llm';
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
  const uid = typeof process.getuid === 'function' ? process.getuid() : 0;
  const socketPath = socketPathForUid(uid);

  void appendDebugLog('client', 'foreground start', {
    requestFile,
    resultFile,
    resultMode,
    socketPath,
  });

  // Phase 1: open /dev/tty to verify it is accessible before proceeding.
  // This is a pre-flight check only — no reads or writes are performed on this
  // handle here. Phase 4 will pass this handle to the Ink TUI for interactive
  // I/O; until then the handle is closed in the finally block below.
  const ttyHandle = await fsp.open('/dev/tty', 'r+');

  try {
    // Read and validate the shell request
    const raw = await fsp.readFile(requestFile, 'utf-8');
    const request = shellRequestSchema.parse(JSON.parse(raw.trim()));

    void appendDebugLog('client', 'request parsed', request);

    // Ensure the daemon is reachable before we do anything interactive
    await ensureDaemon(socketPath);
    void appendDebugLog('client', 'daemon ensured', { socketPath });

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
      void appendDebugLog('client', 'wrote replace-buffer result', {
        resultFile,
        lbuffer: fixtureLbuffer,
        rbuffer: request.rbuffer,
      });
    } else if (resultMode === 'llm') {
      try {
        const decision = classifyIntent({ ...request, intent: 'unknown' as const });
        void appendDebugLog('client', 'intent classified', {
          intent: decision.intent,
          signals: decision.signals,
        });

        const normalized: NormalizedRequest = { ...request, intent: decision.intent };
        const envelope = await gatherContext(normalized);
        void appendDebugLog('client', 'context gathered', {
          extraCount: envelope.extras.length,
        });

        const candidates = await fetchCandidates(envelope, request.rbuffer);
        void appendDebugLog('client', 'candidates received', { count: candidates.length });

        if (candidates.length === 1) {
          await writeShellResult(resultFile, {
            kind: 'replace-buffer',
            lbuffer: candidates[0].command,
            rbuffer: request.rbuffer,
          });
        } else {
          await new Promise<void>((resolve) => {
            const app = render(
              React.createElement(CandidateSelect, {
                candidates,
                onSelect: async (command: string) => {
                  app.unmount();
                  await writeShellResult(resultFile, {
                    kind: 'replace-buffer',
                    lbuffer: command,
                    rbuffer: request.rbuffer,
                  });
                  resolve();
                },
                onCancel: async () => {
                  app.unmount();
                  await writeShellResult(resultFile, { kind: 'cancel' });
                  resolve();
                },
              }),
            );
          });
        }

        void appendDebugLog('client', 'wrote llm result', { resultFile });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void appendDebugLog('client', 'llm request failed; falling back to cancel', {
          message,
        });
        await writeShellResult(resultFile, { kind: 'cancel' });
      }
    } else {
      await writeShellResult(resultFile, { kind: 'cancel' });
      void appendDebugLog('client', 'wrote cancel result', { resultFile });
    }
  } finally {
    await ttyHandle.close();
  }
}
