import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as tty from 'node:tty';
import { render } from 'ink';
import React from 'react';
import { gatherContext } from '../context/pipeline.js';
import type { CommandCandidate } from '../contracts/candidates.js';
import {
  type ContextEnvelope,
  type NormalizedRequest,
  strictInstalledToolsChunkSchema,
} from '../contracts/request.js';
import { shellRequestSchema } from '../contracts/shell.js';
import { ensureDaemon } from '../daemon/bootstrap.js';
import { fetchCandidatesForUi } from '../daemon/fetch-client.js';
import { classifyIntent } from '../intent/router.js';
import { isAbortError } from '../providers/provider.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { socketPathForUid } from '../shared/socket-path.js';
import { annotateCandidates, isInstalled, type ToolInventory } from '../shared/tool-awareness.js';
import { installedCatalogTools } from '../shared/tool-catalog.js';
import { CandidateSelect } from '../ui/CandidateSelect.js';
import { type CandidateListState, MODAL_VIEWPORT_LINES } from '../ui/modal-layout.js';
import {
  armInstantFrameTakeover,
  INLINE_SURFACE_CLEAR,
  type InstantFrameTakeover,
  inlineScrollReserve,
  PANE_SURFACE_CLEAR,
} from './instant-frame.js';
import { writeShellResult } from './result-writer.js';
import { readToolHandoff } from './tool-handoff.js';
import { syncZellijFloatingPaneHeight } from './zellij-pane-resize.js';

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

/**
 * Appends the `installed-tools` steering chunk (Phase 9 D-04) to the envelope.
 *
 * Only `catalog ∩ installed` is sent, never the full inventory. The chunk is
 * validated with the strict client-side schema first; a chunk that fails is
 * dropped and logged by issue count only — never tool names, the payload or
 * zod's issue messages, which can echo values. No inventory (old widget,
 * QQ_TOOL_AWARENESS=0) leaves the envelope untouched, so prompts stay
 * byte-identical to pre-phase behaviour.
 */
function withInstalledToolsChunk(
  envelope: ContextEnvelope,
  inventory: ToolInventory | null,
): ContextEnvelope {
  if (inventory === null) {
    return envelope;
  }
  const parsed = strictInstalledToolsChunkSchema.safeParse({
    kind: 'installed-tools',
    payload: { tools: installedCatalogTools((name) => isInstalled(inventory, name)) },
  });
  if (!parsed.success) {
    void appendDebugLog('client', 'installed-tools chunk rejected', {
      issues: parsed.error.issues.length,
    });
    return envelope;
  }
  void appendDebugLog('client', 'installed-tools chunk', {
    steered: parsed.data.payload.tools.length,
  });
  return { ...envelope, extras: [...envelope.extras, parsed.data] };
}

/** Prefixes FIFO error copy once so adapter `QueQue:` messages are not doubled. */
function formatFifoError(message: string): string {
  return message.startsWith('QueQue:') ? message : `QueQue: ${message}`;
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

    void appendDebugLog('client', 'request parsed', {
      lbufferLength: request.lbuffer.length,
      rbufferLength: request.rbuffer.length,
      cwd: request.cwd,
      shellPid: request.shellPid,
    });

    // Installed-tool handoff from the widget (D-01). Read eagerly alongside request.json, not
    // when candidates arrive: the session dir only lives until the widget's cleanup (Zellij
    // pane timing). The inventory stays in this process — never sent over IPC (D-04).
    const toolInventory =
      resultMode === 'llm' ? await readToolHandoff(path.dirname(requestFile)) : null;

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
        lbufferLength: fixtureLbuffer.length,
        rbufferLength: request.rbuffer.length,
      });
    } else if (resultMode === 'llm') {
      // Declared here so the catch block can also write errors to the TTY.
      let ttyReadStream: tty.ReadStream | undefined;
      let ttyWriteStream: tty.WriteStream | undefined;
      // Instant-frame takeover (quick 261011-jbh, LD-1), reachable from the catch paths.
      let takeover: InstantFrameTakeover | undefined;
      try {
        // D-07: Open modal before fetchCandidates resolves — spinner shows immediately.
        // D-03: No single-candidate fast-accept bypass — all paths go through the modal.
        // D-05: The Ink spinner lives inside the component. The zsh widget's instant frame
        // (header + loading row, painted before Node starts) only covers the time before this
        // process runs (LD-1 amends D-05 for that interval); the takeover below hands the
        // surface to Ink's first frame.

        // Try to create TTY streams from /dev/tty for Ink.
        // This works in all contexts (ZSH widget, zellij run pane, plain terminal).
        // Falls back to process.stdin/stdout if /dev/tty was unavailable (e.g. tests).
        if (ttyHandle) {
          try {
            ttyReadStream = new tty.ReadStream(ttyHandle.fd);
            ttyWriteStream = new tty.WriteStream(ttyHandle.fd);
          } catch {
            // Synthetic fd (e.g. tests) — Ink will use process.stdin/stdout
          }
        }

        // If TTY streams couldn't be created, or raw mode isn't supported,
        // the TUI can't accept input. Write a visible error and exit early —
        // avoids the silent cancel from the isRawModeSupported guard.
        if (!ttyReadStream || !ttyWriteStream) {
          const msg = '\r\nqueque: could not open terminal for interactive input\r\n';
          if (ttyHandle) {
            try {
              await ttyHandle.write(msg);
            } catch {}
          }
          await writeShellResult(resultFile, { kind: 'error', message: msg.trim() });
          return;
        }

        // Take the instant frame's surface over in Ink's first visible write. Inline: write the
        // scroll reserve first. It is byte-identical to the widget's (so it moves nothing after
        // the widget's paint) and ends with this process's own cursor save on the reserve top,
        // which every inline clear restores — never a stale save. Zellij: the floating pane
        // starts clean, so the clear is absolute (home + erase below).
        if (inZellij) {
          takeover = armInstantFrameTakeover(ttyWriteStream, PANE_SURFACE_CLEAR);
        } else {
          ttyWriteStream.write(inlineScrollReserve(MODAL_VIEWPORT_LINES));
          takeover = armInstantFrameTakeover(ttyWriteStream, INLINE_SURFACE_CLEAR);
        }

        try {
          ttyReadStream.setRawMode(true);
          ttyReadStream.setRawMode(false);
        } catch {
          const msg =
            '\r\nqueque: terminal does not support interactive mode\r\nRun ?? from an interactive ZSH session.\r\n';
          ttyWriteStream.write(msg);
          await writeShellResult(resultFile, {
            kind: 'error',
            message:
              'queque: terminal does not support interactive mode — run ?? from an interactive shell',
          });
          return;
        }

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
        const envelope = withInstalledToolsChunk(await gatherContext(normalized), toolInventory);
        void appendDebugLog('client', 'context gathered', {
          extraCount: envelope.extras.length,
        });

        // The inline reserve (MODAL_VIEWPORT_LINES, see modal-layout.ts) was written above, with
        // the takeover: only that many lines of previous terminal content scroll up and the rest
        // stays visible above the TUI. Its cursor save is restored in clearScrollReserve, so
        // cleanup always erases from the right position regardless of where Ink leaves the
        // cursor after unmount. Skipped in Zellij: the floating pane starts with a clean screen.

        await new Promise<void>((resolve) => {
          let unmount: ((skipClear?: boolean) => void) | undefined;
          let resolved = false;
          // D-07/D-13/D-15: Esc, Enter and signals abort the in-flight fetch. That destroys
          // the daemon socket, and the daemon aborts the provider call on `close`.
          const fetchAbort = new AbortController();

          // Rows streamed so far (09.1 D-05), in the order the provider reported them.
          const streamed: CommandCandidate[] = [];

          // Build initial element with null candidates (D-06 loading state)
          const buildCandidateElement = (
            candidates: Parameters<typeof CandidateSelect>[0]['candidates'],
            errorState?: boolean,
            listState: CandidateListState = 'complete',
          ) =>
            React.createElement(CandidateSelect, {
              candidates,
              initialQuery: request.lbuffer,
              error: errorState,
              listState,
              onSelect: async (command: string, explanation: string) => {
                if (resolved) return;
                resolved = true;
                fetchAbort.abort();
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
                fetchAbort.abort();
                await writeShellResult(resultFile, { kind: 'cancel' });
                unmount?.();
              },
              onLayoutLinesChange: inZellij ? syncZellijFloatingPaneHeight : undefined,
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
                ttyWriteStream.write(INLINE_SURFACE_CLEAR);
              } catch {
                // TTY may already be gone (e.g. SIGHUP fired because terminal closed)
              }
            }
          };

          const cleanupOnSignal = () => {
            fetchAbort.abort();
            app.unmount();
            clearScrollReserve();
            process.exit(0);
          };
          process.once('SIGHUP', cleanupOnSignal);
          process.once('SIGTERM', cleanupOnSignal);

          unmount = (skipClear = false) => {
            process.off('SIGHUP', cleanupOnSignal);
            process.off('SIGTERM', cleanupOnSignal);
            app.unmount();
            if (!skipClear) clearScrollReserve();
            resolve();
          };

          // D-05 (client half): each streamed row is shown as soon as it arrives, below the
          // rows before it, with the spinner under them ('arriving'). annotateCandidates stays
          // synchronous on the Ink thread: at most MAX_STREAMED_CANDIDATES rows against the
          // inventory already in memory, never re-read per arrival.
          const onCandidate = (candidate: CommandCandidate) => {
            // D-14: a row that arrives after Esc or Enter is neither rendered nor kept.
            if (resolved) return;
            streamed.push(candidate);
            if (streamed.length === 1) {
              void appendDebugLog('client', 'first candidate received');
            }
            app.rerender(
              buildCandidateElement(
                annotateCandidates([...streamed], toolInventory),
                undefined,
                'arriving',
              ),
            );
          };

          // D-07: fetch candidates concurrently — rerender() pushes them into the live modal.
          fetchCandidatesForUi(socketPath, envelope, { signal: fetchAbort.signal, onCandidate })
            .then((candidates) => {
              // D-14: once a result is written, nothing the provider produced is shown.
              if (resolved) return;
              const displayCandidates = annotateCandidates(candidates, toolInventory);
              void appendDebugLog('client', 'candidates received', {
                count: candidates.length,
                streamed: streamed.length,
                flagged: displayCandidates.filter((c) => c.missingTools !== undefined).length,
              });
              app.rerender(buildCandidateElement(displayCandidates, undefined, 'complete'));
            })
            .catch(async (err) => {
              if (isAbortError(err)) {
                void appendDebugLog('client', 'fetch aborted');
                return;
              }
              const message = err instanceof Error ? err.message : String(err);
              void appendDebugLog('client', 'llm request failed', { message });
              if (resolved) return;
              // D-16: rows already on screen stay selectable under a dim "list may be
              // incomplete" note; the user picks one or presses Esc through the normal
              // onSelect/onCancel path. The error view shows only when no row arrived.
              if (streamed.length > 0) {
                void appendDebugLog('client', 'llm request failed after rows', {
                  count: streamed.length,
                });
                app.rerender(
                  buildCandidateElement(
                    annotateCandidates([...streamed], toolInventory),
                    undefined,
                    'partial',
                  ),
                );
                return;
              }
              resolved = true;
              // Clears the instant frame only if Ink never drew (a no-op after its first frame,
              // so the skipClear behaviour below is unchanged).
              takeover?.clearNow();
              const errorMsg = formatFifoError(message);
              await writeShellResult(resultFile, { kind: 'error', message: errorMsg });
              // skipClear=true: don't restore cursor to ZLE's saved start position —
              // doing so would cause zle reset-prompt to draw the next prompt right
              // over the error line that ZSH is about to print.
              unmount?.(true);
            });
        });

        void appendDebugLog('client', 'wrote llm result', { resultFile });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void appendDebugLog('client', 'llm request failed', { message });
        // A failure before Ink's first frame leaves the instant frame on screen: clear it.
        takeover?.clearNow();
        const errorMsg = formatFifoError(message);
        await writeShellResult(resultFile, { kind: 'error', message: errorMsg });
      }
    } else {
      await writeShellResult(resultFile, { kind: 'cancel' });
      void appendDebugLog('client', 'wrote cancel result', { resultFile });
    }
  } finally {
    await ttyHandle?.close();
  }
}
