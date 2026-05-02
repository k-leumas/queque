# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-05-01T23:56:11.675Z
> Files: 48 tracked | Anatomy hits: 0 | Misses: 0

## ./

- `CLAUDE.md` — OpenWolf (~57 tok)

## .claude/

- `settings.json` (~441 tok)

## .claude/rules/

- `openwolf.md` (~313 tok)

## .claude/worktrees/agent-a4210920/.planning/phases/01-shell-bridge-and-result-contract/

- `01-01-SUMMARY.md` — Phase 01 Plan 01: Toolchain Baseline and Shell/IPC Contracts Summary (~1742 tok)

## .claude/worktrees/agent-a4210920/src/contracts/

- `ipc.ts` — IPC request — sent from the foreground client to the daemon over a Unix socket. (~279 tok)
- `shell.ts` — Shell request — sent from the zsh widget to the qq client. (~353 tok)

## .claude/worktrees/agent-a4210920/src/shared/

- `socket-path.ts` — Returns the Unix socket path for the qq daemon for a given UID. (~169 tok)

## .claude/worktrees/agent-a4210920/tests/

- `shell-contract.test.ts` — Declares validCancel (~648 tok)

## .claude/worktrees/agent-aa6153ab/.planning/phases/01-shell-bridge-and-result-contract/

- `01-03-SUMMARY.md` — Phase 01 Plan 03: Daemon Bootstrap and Client Seam Summary (~1393 tok)

## .claude/worktrees/agent-aa6153ab/src/cli/

- `main.ts` — Exports main (~532 tok)

## .claude/worktrees/agent-aa6153ab/src/cli/commands/

- `client.ts` — Real client command handler. (~304 tok)
- `daemon.ts` — Real daemon command handler. (~331 tok)

## .claude/worktrees/agent-aa6153ab/src/client/

- `result-writer.ts` — Validates a ShellResult and writes newline-terminated JSON to `resultFile`. (~218 tok)
- `run-foreground.ts` — Selects the deterministic result mode for this Phase 1 seam: (~776 tok)

## .claude/worktrees/agent-aa6153ab/src/daemon/

- `bootstrap.ts` — Attempts to connect to the daemon socket at `socketPath`. (~724 tok)
- `server.ts` — Starts the daemon Unix-socket server. (~648 tok)

## .claude/worktrees/agent-aa6153ab/tests/

- `client-result.test.ts` — --------------------------------------------------------------------------- (~1435 tok)
- `daemon-bootstrap.test.ts` — vi.hoisted runs before vi.mock, giving us a stable reference to the mock fn (~1285 tok)

## .claude/worktrees/agent-accab398/.planning/phases/01-shell-bridge-and-result-contract/

- `01-02-SUMMARY.md` — Phase 01 Plan 02: ZSH Bridge and Result Application Summary (~1437 tok)

## .claude/worktrees/agent-accab398/shell/zsh/

- `qq.zsh` — qq.zsh — Que-Que ZLE widget and shell-side result contract (~1407 tok)

## .claude/worktrees/agent-accab398/tests/

- `zsh-widget.test.ts` — Smoke tests for the zsh ZLE widget (`shell/zsh/qq.zsh`). (~2156 tok)

## .planning/

- `config.json` (~258 tok)
- `PROJECT.md` — Que-Que (~1287 tok)
- `REQUIREMENTS.md` — Requirements: Que-Que (~1242 tok)
- `ROADMAP.md` — Roadmap: Que-Que (~1916 tok)
- `STATE.md` — Project State (~387 tok)

## .planning/quick/260501-qt4-write-a-short-node-script-that-restart-t/

- `260501-qt4-PLAN.md` — Quick task plan for a minimal Node watcher that restarts `pnpm dev` and logs watch/restart events. (~520 tok)

## .planning/notes/

- `2026-05-01-shell-path-vcs-detection.md` — Declares we (~60 tok)

## .planning/phases/01-shell-bridge-and-result-contract/

- `01-01-PLAN.md` — Phase 1 plan for repo scaffold, CLI skeleton, and shared shell/IPC contracts (~4500 tok)
- `01-01-SUMMARY.md` — Phase 01 Plan 01: Toolchain Baseline and Shell/IPC Contracts Summary (~1631 tok)
- `01-02-PLAN.md` — Phase 1 plan for the zsh ZLE widget, request capture, and shell-side result application (~3600 tok)
- `01-03-PLAN.md` — Phase 1 plan for daemon bootstrap and foreground client seams (~3900 tok)
- `01-HUMAN-UAT.md` — Current Test (~188 tok)
- `01-RESEARCH.md` — Phase 1 implementation research for ZLE trigger, shell contract, and daemon bootstrap (~4300 tok)
- `01-REVIEW-FIX.md` — Phase 01: Code Review Fix Report (~1149 tok)
- `01-REVIEW.md` — Phase 01: Code Review Report (~3511 tok)
- `01-VERIFICATION.md` — Phase 1: Shell Bridge and Result Contract Verification Report (~4027 tok)

## .planning/phases/02-intent-router-and-context-pipeline/

- `02-RESEARCH.md` — Phase 2 research covering deterministic intent routing, context envelopes, and registry-backed extension seams (~5200 tok)

## .planning/research/

- `ARCHITECTURE.md` — Architecture Research: Que-Que (~624 tok)
- `FEATURES.md` — Features Research: Que-Que (~558 tok)
- `PITFALLS.md` — Pitfalls Research: Que-Que (~736 tok)
- `STACK.md` — Stack Research: Que-Que (~670 tok)
- `SUMMARY.md` — Research Summary: Que-Que (~336 tok)

## shell/zsh/

- `qq.zsh` — qq.zsh — Que-Que ZLE widget and shell-side result contract (~1483 tok)

## src/cli/commands/

- `client.ts` — Real client command handler. (~394 tok)

## src/client/

- `result-writer.ts` — Validates a ShellResult and writes newline-terminated JSON to `resultFile`. (~307 tok)
- `run-foreground.ts` — Selects the deterministic result mode for this Phase 1 seam: (~818 tok)

## src/daemon/

- `bootstrap.ts` — Attempts to connect to the daemon socket at `socketPath`. (~1134 tok)
- `server.ts` — Starts the daemon Unix-socket server. (~699 tok)

## tests/

- `daemon-bootstrap.test.ts` — vi.hoisted runs before vi.mock, giving us a stable reference to the mock fn (~1466 tok)
