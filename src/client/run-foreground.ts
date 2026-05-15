import * as fsp from 'node:fs/promises';
import * as tty from 'node:tty';
import { render } from 'ink';
import React from 'react';
import { gatherContext } from '../context/pipeline.js';
import type { NormalizedRequest } from '../contracts/request.js';
import { shellRequestSchema } from '../contracts/shell.js';
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

  const inZellij = process.env['ZELLIJ'] !== undefined;

  void appendDebugLog('client', 'foreground start', {
    requestFile,
    resultFile,
    resultMode,
    socketPath,
    inZellij,
  });

  // In Zellij: process.stdin/stdout ARE the pane's PTY — no /dev/tty needed.
  // Outside Zellij: open /dev/tty for interactive stdio (ZLE redirects stdin from /dev/null).
  const ttyHandle = inZellij ? null : await fsp.open('/dev/tty', 'r+');

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
        const decision = classifyIntent({ ...request, intent: 'unknown' as const, confidence: 0 });
        void appendDebugLog('client', 'intent classified', {
          intent: decision.intent,
          signals: decision.signals,
        });

        const normalized: NormalizedRequest = {
          ...request,
          intent: decision.intent,
          confidence: decision.confidence,
        };
        const envelope = await gatherContext(normalized);
        void appendDebugLog('client', 'context gathered', {
          extraCount: envelope.extras.length,
        });

        // D-07: Open modal before fetchCandidates resolves — spinner shows immediately.
        // D-03: No single-candidate fast-accept bypass — all paths go through the modal.
        // D-05: No raw ANSI loading indicator — spinner is inside the Ink component.

        // In Zellij: process.stdin/stdout are the pane's PTY — no tty streams needed.
        // Outside Zellij: try to create TTY streams for Ink; fall back to process stdio if unavailable.
        // (In test environments, ttyHandle.fd may be a synthetic fd that is not a real TTY.)
        let ttyReadStream: tty.ReadStream | undefined;
        let ttyWriteStream: tty.WriteStream | undefined;
        if (!inZellij) {
          try {
            ttyReadStream = new tty.ReadStream(ttyHandle!.fd);
            ttyWriteStream = new tty.WriteStream(ttyHandle!.fd);
          } catch {
            // Non-TTY environment (e.g. tests) — Ink will use process.stdin/stdout
          }

          if (ttyWriteStream) {
            // Blank out the modal viewport so the render doesn't overwrite prior output.
            const modalHeight = 14;
            ttyWriteStream.write('\n'.repeat(modalHeight));
            ttyWriteStream.write(`\x1b[${modalHeight}A`);
          }
        }

        await new Promise<void>((resolve) => {
          let unmount: (() => void) | undefined;
          let resolved = false;

          // Build initial element with null candidates (D-06 loading state)
          const buildCandidateElement = (
            candidates: Parameters<typeof CandidateSelect>[0]['candidates'],
            errorState?: boolean,
          ) =>
            React.createElement(CandidateSelect, {
              candidates,
              initialQuery: request.lbuffer,
              error: errorState,
              onSelect: async (command: string) => {
                if (resolved) return;
                resolved = true;
                await writeShellResult(resultFile, {
                  kind: 'replace-buffer',
                  lbuffer: command,
                  rbuffer: request.rbuffer,
                });
                unmount?.();
              },
              onCancel: async () => {
                if (resolved) return;
                resolved = true;
                await writeShellResult(resultFile, { kind: 'cancel' });
                unmount?.();
              },
            });

          const renderOptions = inZellij
            ? {}
            : ttyReadStream && ttyWriteStream
              ? { stdin: ttyReadStream, stdout: ttyWriteStream }
              : {};

          const app = render(buildCandidateElement(null), renderOptions);

          unmount = () => {
            app.unmount();
            resolve();
          };

          // D-07: fetch candidates concurrently — rerender() pushes them into the live modal.
          fetchCandidates(envelope, request.rbuffer)
            .then((candidates) => {
              void appendDebugLog('client', 'candidates received', { count: candidates.length });
              app.rerender(buildCandidateElement(candidates));
            })
            .catch((err) => {
              const message = err instanceof Error ? err.message : String(err);
              void appendDebugLog('client', 'llm request failed', { message });
              if (resolved) return;
              resolved = true;
              void writeShellResult(resultFile, {
                kind: 'error',
                message: `Que-Que: ${message} — press any key`,
              }).then(() => unmount?.());
            });
        });

        void appendDebugLog('client', 'wrote llm result', { resultFile });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void appendDebugLog('client', 'llm request failed', {
          message,
        });
        await writeShellResult(resultFile, {
          kind: 'error',
          message: `Que-Que: ${message} — press any key`,
        });
      }
    } else {
      await writeShellResult(resultFile, { kind: 'cancel' });
      void appendDebugLog('client', 'wrote cancel result', { resultFile });
    }
  } finally {
    await ttyHandle?.close();
  }
}
