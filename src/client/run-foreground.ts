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
import { detectProvider } from '../providers/detect.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { socketPathForUid } from '../shared/socket-path.js';
import { CandidateSelect } from '../ui/CandidateSelect.js';
import { writeShellResult } from './result-writer.js';

/**
 * Splits a command + explanation into shell buffer halves.
 *
 * Cursor lands before the first placeholder (text wrapped in `<...>`), so the
 * user can immediately type the first required value. Angle brackets are
 * stripped from all placeholders so the shell buffer looks natural.
 * If no placeholders are present, cursor lands after the command, before the
 * `  # explanation` comment.
 */
export function buildShellBuffers(
  command: string,
  explanation: string,
): { lbuffer: string; rbuffer: string } {
  const comment = `  # ${explanation}`;
  const stripped = command.replace(/<([^>]+)>/g, '$1');
  const firstAngle = command.indexOf('<');
  if (firstAngle >= 0) {
    return {
      lbuffer: stripped.slice(0, firstAngle),
      rbuffer: stripped.slice(firstAngle) + comment,
    };
  }
  return { lbuffer: command, rbuffer: comment };
}

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

  const inZellij = process.env.ZELLIJ !== undefined;

  void appendDebugLog('client', 'foreground start', {
    requestFile,
    resultFile,
    resultMode,
    socketPath,
    inZellij,
  });

  // Always open /dev/tty for interactive stdio.
  // Outside Zellij: ZLE redirects process.stdin from /dev/null, so /dev/tty is required.
  // Inside Zellij (zellij run): process.stdin is not wired to the pane PTY by zellij run,
  // but /dev/tty always refers to the controlling terminal which IS the pane PTY.
  const ttyHandle = await fsp.open('/dev/tty', 'r+').catch(() => null);

  try {
    // Read and validate the shell request
    const raw = await fsp.readFile(requestFile, 'utf-8');
    const request = shellRequestSchema.parse(JSON.parse(raw.trim()));

    void appendDebugLog('client', 'request parsed', request);

    const detectedProvider = await detectProvider();
    void appendDebugLog('client', 'provider detected', { kind: detectedProvider.kind });

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

        // Try to create TTY streams from /dev/tty for Ink.
        // This works in all contexts (ZSH widget, zellij run pane, plain terminal).
        // Falls back to process.stdin/stdout if /dev/tty was unavailable (e.g. tests).
        let ttyReadStream: tty.ReadStream | undefined;
        let ttyWriteStream: tty.WriteStream | undefined;
        if (ttyHandle) {
          try {
            ttyReadStream = new tty.ReadStream(ttyHandle.fd);
            ttyWriteStream = new tty.WriteStream(ttyHandle.fd);
          } catch {
            // Synthetic fd (e.g. tests) — Ink will use process.stdin/stdout
          }
        }

        // Reserve exactly as many lines as the TUI needs (header + filter + up to 3
        // candidates × 3 rows + controls + 2 buffer = 16). This scrolls previous
        // terminal content up by only 16 lines so it stays visible above the TUI,
        // rather than filling the whole screen.
        // Skipped in Zellij: the floating pane starts with a clean screen.
        const MODAL_VIEWPORT_LINES = 16;
        if (ttyWriteStream && !inZellij) {
          ttyWriteStream.write('\n'.repeat(MODAL_VIEWPORT_LINES));
          ttyWriteStream.write(`\x1b[${MODAL_VIEWPORT_LINES}A`);
          // Save cursor at the top of the reserved area. Restored in clearScrollReserve
          // so cleanup always erases from the right position regardless of where Ink
          // leaves the cursor after unmount.
          ttyWriteStream.write('\x1b7');
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
              onSelect: async (command: string, explanation: string) => {
                if (resolved) return;
                resolved = true;
                const { lbuffer, rbuffer } = buildShellBuffers(command, explanation);
                await writeShellResult(resultFile, {
                  kind: 'replace-buffer',
                  lbuffer,
                  rbuffer,
                  query: request.lbuffer,
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

          // Force interactive:true so Ink uses cursor-repositioning mode regardless of
          // CI env vars (is-in-ci checks process.env.CI which many devtools set) and
          // regardless of whether isTTY is correctly reported on a manually-constructed
          // tty.WriteStream. We already confirmed /dev/tty opens, so it is a real terminal.
          const renderOptions =
            ttyReadStream && ttyWriteStream
              ? { stdin: ttyReadStream, stdout: ttyWriteStream, interactive: true }
              : { interactive: true };

          const app = render(buildCandidateElement(null), renderOptions);

          // Restore cursor to the saved position (top of reserved area) then clear
          // to end of screen. This works regardless of where Ink left the cursor.
          const clearScrollReserve = () => {
            if (ttyWriteStream && !inZellij) {
              try {
                ttyWriteStream.write('\x1b8\x1b[J');
              } catch {
                // TTY may already be gone (e.g. SIGHUP fired because terminal closed)
              }
            }
          };

          const cleanupOnSignal = () => {
            app.unmount();
            clearScrollReserve();
            process.exit(0);
          };
          process.once('SIGHUP', cleanupOnSignal);
          process.once('SIGTERM', cleanupOnSignal);

          unmount = () => {
            process.off('SIGHUP', cleanupOnSignal);
            process.off('SIGTERM', cleanupOnSignal);
            app.unmount();
            clearScrollReserve();
            resolve();
          };

          // D-07: fetch candidates concurrently — rerender() pushes them into the live modal.
          fetchCandidates(envelope, request.rbuffer)
            .then((candidates) => {
              void appendDebugLog('client', 'candidates received', { count: candidates.length });
              app.rerender(buildCandidateElement(candidates));
            })
            .catch(async (err) => {
              const message = err instanceof Error ? err.message : String(err);
              void appendDebugLog('client', 'llm request failed', { message });
              if (resolved) return;
              resolved = true;
              try {
                await writeShellResult(resultFile, {
                  kind: 'error',
                  message: `Que-Que: ${message} — press any key`,
                });
              } finally {
                unmount?.();
              }
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
