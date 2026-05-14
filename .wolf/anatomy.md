# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-05-14T19:00:23.187Z
> Files: 99 tracked | Anatomy hits: 0 | Misses: 0

## ./

- `CLAUDE.md` — OpenWolf (~57 tok)

## .claude/

- `settings.json` (~441 tok)

## .claude/rules/

- `openwolf.md` (~313 tok)

## .claude/worktrees/agent-a19c27e461de31bc0/

- `tsconfig.json` — TypeScript configuration (~163 tok)

## .claude/worktrees/agent-a19c27e461de31bc0/.planning/phases/03.1-update-interface-and-interactivity-to-match-that-of-this-git/

- `03.1-02-SUMMARY.md` — Phase 03.1 Plan 02: UI Support Components (Wave 1) Summary (~987 tok)

## .claude/worktrees/agent-a19c27e461de31bc0/.wolf/

- `anatomy.md` — anatomy.md (~1703 tok)
- `memory.md` — Memory (~2897 tok)

## .claude/worktrees/agent-a19c27e461de31bc0/src/ui/

- `ControlsLine.tsx` — ControlsLine (~235 tok)
- `LoadingSpinner.tsx` — FRAMES (~136 tok)
- `Modal.tsx` — Modal (~210 tok)
- `SearchInput.tsx` — SearchInput (~112 tok)

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

## .claude/worktrees/agent-aaaee833/src/contracts/

- `request.ts` — Broad intent categories classified before any context gathering. (~1028 tok)

## .claude/worktrees/agent-aaaee833/src/intent/

- `router.ts` — D-03: git prefix — query (after trim) begins with 'git ' (literal). (~1212 tok)

## .claude/worktrees/agent-aaaee833/tests/

- `intent-router.test.ts` — Helper: build a minimal NormalizedRequest for testing (~2179 tok)

## .claude/worktrees/agent-aac6444be33ddae2f/.planning/phases/03.2-zellij-floating-pane-integration-for-best-ux/

- `03.2-01-SUMMARY.md` — Phase 3.2 Plan 01: Wave 1 TDD Foundation — Test Contracts for FIFO and Zellij Integration Summary (~1811 tok)

## .claude/worktrees/agent-aac6444be33ddae2f/.wolf/

- `anatomy.md` — anatomy.md (~2238 tok)
- `cerebrum.md` — Cerebrum (~772 tok)

## .claude/worktrees/agent-aac6444be33ddae2f/tests/

- `client-result.test.ts` — --------------------------------------------------------------------------- (~4186 tok)
- `zsh-widget.test.ts` — Smoke tests for the zsh ZLE widget (`shell/zsh/qq.zsh`). (~3908 tok)

## .claude/worktrees/agent-ab9387af30d3d2b0f/.planning/phases/03.2-zellij-floating-pane-integration-for-best-ux/

- `03.2-02-SUMMARY.md` — Phase 3.2 Plan 02: Wave 2 — FIFO-Aware Write and Zellij Branch Implementation Summary (~1955 tok)

## .claude/worktrees/agent-ab9387af30d3d2b0f/src/client/

- `result-writer.ts` — Validates a ShellResult and writes newline-terminated JSON to `resultFile`. (~550 tok)
- `run-foreground.ts` — Selects the deterministic result mode for this Phase 1 seam: (~2282 tok)

## .claude/worktrees/agent-ab9387af30d3d2b0f/tests/

- `client-result.test.ts` — --------------------------------------------------------------------------- (~4358 tok)

## .claude/worktrees/agent-aca72d47efd9f909e/src/client/

- `run-foreground.ts` — Selects the deterministic result mode for this Phase 1 seam: (~2352 tok)

## .claude/worktrees/agent-aca72d47efd9f909e/src/ui/

- `CandidateSelect.tsx` — Props for CandidateSelect. (~1190 tok)

## .claude/worktrees/agent-aca72d47efd9f909e/tests/

- `candidate-select.test.tsx` — tests/candidate-select.test.tsx (~1908 tok)

## .claude/worktrees/agent-accab398/.planning/phases/01-shell-bridge-and-result-contract/

- `01-02-SUMMARY.md` — Phase 01 Plan 02: ZSH Bridge and Result Application Summary (~1437 tok)

## .claude/worktrees/agent-accab398/shell/zsh/

- `qq.zsh` — qq.zsh — Que-Que ZLE widget and shell-side result contract (~1407 tok)

## .claude/worktrees/agent-accab398/tests/

- `zsh-widget.test.ts` — Smoke tests for the zsh ZLE widget (`shell/zsh/qq.zsh`). (~2156 tok)

## .claude/worktrees/agent-adabf5a43d4a36218/.planning/phases/03.2-zellij-floating-pane-integration-for-best-ux/

- `03.2-03-SUMMARY.md` — Phase 03.2 Plan 03: qq-question-widget Zellij FIFO Rewrite Summary (~1486 tok)

## .claude/worktrees/agent-adabf5a43d4a36218/shell/zsh/

- `qq.zsh` — qq.zsh — Que-Que ZLE widget and shell-side result contract (~2159 tok)

## .planning/

- `.continue-here.md` — BLOCKING CONSTRAINTS — Read Before Anything Else (~1544 tok)
- `config.json` (~258 tok)
- `HANDOFF.json` — Declares bodies (~1014 tok)
- `PROJECT.md` — Que-Que (~1287 tok)
- `REQUIREMENTS.md` — Requirements: Que-Que (~1242 tok)
- `ROADMAP.md` — Roadmap: Que-Que (~2579 tok)
- `STATE.md` — Project State (~387 tok)

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

- `02-01-PLAN.md` — Broad intent categories classified before any context gathering. (~8477 tok)
- `02-02-PLAN.md` — and: classifyIntent, detectVcsContext, runForegroundClient, suggestShellResult, suggestShellResult (~13578 tok)
- `02-03-PLAN.md` — Declares for (~8405 tok)
- `02-CONTEXT.md` — Phase 2: Intent Router and Context Pipeline - Context (~1686 tok)
- `02-DISCUSSION-LOG.md` — Phase 2: Intent Router and Context Pipeline - Discussion Log (~840 tok)
- `02-PATTERNS.md` — Phase 2: Intent Router and Context Pipeline - Pattern Map (~5434 tok)
- `02-RESEARCH.md` — Phase 2: Intent Router and Context Pipeline - Research (~5890 tok)
- `02-REVIEWS.md` — Cross-AI Plan Review — Phase 2 (~2741 tok)

## .planning/phases/03.1-update-interface-and-interactivity-to-match-that-of-this-git/

- `03.1-03-SUMMARY.md` — Phase 03.1 Plan 03: Wave 2 Core Implementation Summary (~2166 tok)
- `03.1-REVIEW.md` — Phase 03.1: Code Review Report (~3497 tok)
- `03.1-VERIFICATION.md` — Phase 03.1: Monocle-style Interface and Interactivity — Verification Report (~4216 tok)

## .planning/phases/03.2-zellij-floating-pane-integration-for-best-ux/

- `03.2-01-PLAN.md` — returning: runZsh, runZshWithoutZellij (~4521 tok)
- `03.2-02-PLAN.md` — uses: writeShellResult (~3930 tok)
- `03.2-03-PLAN.md` — Trust Boundaries (~3914 tok)
- `03.2-CONTEXT.md` — Phase 3.2: Zellij floating pane integration for best UX - Context (~1961 tok)
- `03.2-DISCUSSION-LOG.md` — Phase 3.2: Zellij floating pane integration for best UX - Discussion Log (~1080 tok)
- `03.2-PATTERNS.md` — Phase 3.2: Zellij Floating Pane Integration - Pattern Map (~3828 tok)
- `03.2-RESEARCH.md` — Phase 3.2: Zellij Floating Pane Integration - Research (~8713 tok)
- `03.2-REVIEWS.md` — Cross-AI Plan Review — Phase 3.2 (~2218 tok)
- `03.2-VALIDATION.md` — Phase 3.2 — Validation Strategy (~848 tok)

## .planning/quick/260501-qt4-write-a-short-node-script-that-restart-t/

- `260501-qt4-PLAN.md` — Quick task plan for a minimal Node watcher that restarts `pnpm dev` and logs watch/restart events. (~520 tok)

## .planning/research/

- `ARCHITECTURE.md` — Architecture Research: Que-Que (~624 tok)
- `FEATURES.md` — Features Research: Que-Que (~558 tok)
- `PITFALLS.md` — Pitfalls Research: Que-Que (~736 tok)
- `STACK.md` — Stack Research: Que-Que (~670 tok)
- `SUMMARY.md` — Research Summary: Que-Que (~336 tok)

## docs/

- `SYSTEM_DESGN.md` — System Design (~3531 tok)

## scripts/

- `build-dashboard.mjs` — repoRoot: main, setupTerminal, teardownTerminal + 16 more (~4892 tok)

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

## src/ui/

- `CandidateSelect.tsx` — Props for CandidateSelect. (~1291 tok)

## tests/

- `daemon-bootstrap.test.ts` — vi.hoisted runs before vi.mock, giving us a stable reference to the mock fn (~1466 tok)
