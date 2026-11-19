# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-11-19T04:44:56.384Z
> Files: 673 tracked | Anatomy hits: 0 | Misses: 0

## ../../../../private/tmp/claude-501/-Users-samuel-dev-tui-llm/75fe2513-e126-4e3f-9b57-d35ff605c71e/scratchpad/

- `261118-v58-commit1.txt` (~181 tok)
- `261118-v58-commit2.txt` (~144 tok)
- `v58-full-suite.sh` — Full default suite with MacPorts bash 5.3 available (memory: run full suite). (~63 tok)
- `v58-noclaude.sh` — Runs the CLI live file with a dummy key and no `claude` on PATH; expects the install hint. (~138 tok)
> Auto-maintained by OpenWolf. Last scanned: 2026-11-19T04:23:42.346Z
> Files: 678 tracked | Anatomy hits: 0 | Misses: 0

## ../../../../private/tmp/claude-501/-Users-samuel-dev-tui-llm/75fe2513-e126-4e3f-9b57-d35ff605c71e/scratchpad/

- `ubg-commit-1.txt` (~137 tok)
- `ubg-commit-2.txt` (~242 tok)
- `ubg-commit-3.txt` (~178 tok)
- `ubg-context.sh` — Lists what the repo-root Docker build context contains under .dockerignore. (~282 tok)
- `ubg-steps.sh` — Usage: ubg-steps.sh <logname> — prints each BuildKit step header with its DONE/CACHED status. (~129 tok)
- `ubg-timed-smoke.sh` — Usage: ubg-timed-smoke.sh <logname> [smoke args...] (~206 tok)

## ./

- `.DS_Store` (~2186 tok)
- `.dockerignore` — Allow-list build context for scripts/smoke-homebrew-docker.sh: `*`, then one `!` line per COPY source (guarded by tests/homebrew-smoke-docker.test.ts); keeps node_modules, .git and dotenv files off the daemon. (~120 tok)
- `.gitignore` — Git ignore rules (~65 tok)
- `.nvmrc` (~3 tok)
- `.releaserc.json` (~363 tok)
- `biome.json` — Biome linter/formatter configuration (~210 tok)
- `CHANGELOG.md` — Change log (~16975 tok)
- `CLAUDE.md` — OpenWolf (~1668 tok)
- `commitlint.config.js` (~20 tok)
- `CONTRIBUTING.md` — Contributing (~1845 tok)
- `lefthook.yml` (~293 tok)
- `package.json` — Node.js package manifest (~566 tok)
- `pnpm-lock.yaml` — pnpm lock file (~43535 tok)
- `pnpm-workspace.yaml` (~14 tok)
- `README.md` — Project documentation (~1217 tok)
- `renovate.json` (~31 tok)
- `tsconfig.json` — TypeScript configuration (~187 tok)
- `tsup.config.ts` — Declares version (~904 tok)
- `vitest.config.ts` — Vitest test configuration (~299 tok)
- `vitest.live.config.ts` — Fresh vitest config for the nightly live jobs only: include `tests/live/**/*.live.ts` (never the default suite, never live-daemon.ts), testTimeout 60 s, hookTimeout 30 s, QQ_NO_UPDATE_CHECK; `live` and `live-cli` each pass one file to `pnpm test:live <file>` (no `--`) (~330 tok)

## .claude/

- `settings.json` (~441 tok)
- `settings.local.json` (~433 tok)

## .claude/rules/

- `openwolf.md` (~313 tok)

## .claude/skills/spike-findings-tui-llm/

- `SKILL.md` — Project: tui-llm (QueQue) (~1039 tok)

## .claude/skills/spike-findings-tui-llm/references/

- `bash-integration.md` — bash integration (`??` in bash ≥5.0) (~1173 tok)
- `candidate-command-check.md` — Candidate Command Check (flag suggestions that use missing tools) (~1016 tok)
- `fish-integration.md` — fish integration (`??` in fish 4.x) (~1142 tok)
- `installed-command-handoff.md` — Installed-Command Handoff (zsh → qq client) (~841 tok)
- `prompt-steering.md` — Prompt Steering With the Installed List (~828 tok)

## .claude/skills/spike-findings-tui-llm/sources/001-zsh-commands-handoff/

- `bench.zsh` — Spike 001 — cost and freshness of handing zsh's $commands table to the qq client. (~652 tok)
- `README.md` — Project documentation (~1071 tok)
- `rehash-cost.zsh` — Spike 001b — what does "rehash then hand off" cost on every ?? (widget-side work). (~484 tok)

## .claude/skills/spike-findings-tui-llm/sources/002-candidate-binary-check/

- `cases.mjs` — Expected = every program the shell would look up, in order. Wrappers (sudo, xargs…) count too. (~988 tok)
- `extract.mjs` — Index just past the `close` that balances the `open` at s[i]. Respects quotes and escapes. (~2664 tok)
- `find-hang.mjs` — Spike 002 — isolate inputs that hang lexHand: each runs in a child with a 1 s timeout. (~252 tok)
- `fuzz-child.mjs` — Declares alphabet (~188 tok)
- `package.json` — Node.js package manifest (~33 tok)
- `README.md` — Project documentation (~1281 tok)
- `run.mjs` — Spike 002 runner: accuracy of hand lexer vs shell-quote, plus per-candidate cost and (~730 tok)

## .claude/skills/spike-findings-tui-llm/sources/003-prompt-steering/

- `catalog.ts` — Curated catalog of notable CLI tools that have common alternatives. Variant B sends only (~440 tok)
- `compare.ts` — Spike 003 — does telling the model which tools are installed help, and what does it cost? (~1778 tok)
- `README.md` — Project documentation (~1195 tok)

## .claude/skills/spike-findings-tui-llm/sources/003-prompt-steering/results/

- `run-1-partial.log` — Declares f (~4424 tok)

## .claude/skills/spike-findings-tui-llm/sources/004-bash-readline-trigger/

- `README.md` — Project documentation (~1191 tok)
- `run-all.sh` — Runs every case against each bash given as an argument; prints log + what bash executed. (~136 tok)
- `run.exp` — Usage: run.exp <bash-binary> <case> <logfile> (~489 tok)
- `spike.bash` — Spike 004: bash adapter for the literal `??` trigger. (~337 tok)

## .claude/skills/spike-findings-tui-llm/sources/005-bash-tui-handoff/

- `drive.sh` — drive.sh <shell-cmd> <scenario> — runs a scenario in a private tmux server and prints screen (~553 tok)
- `queque.bash` — Spike 005: full bash adapter — ports qq-question-widget (shell/zsh/queque.zsh:334) to readline. (~1200 tok)
- `README.md` — Project documentation (~911 tok)

## .claude/skills/spike-findings-tui-llm/sources/006-fish-commandline-trigger/

- `drive.sh` — drive.sh <case> [vi] — runs one trigger case in fish 4 inside a private tmux server. (~426 tok)
- `README.md` — Project documentation (~881 tok)
- `spike.fish` — Spike 006: fish adapter stub for the literal `??` trigger (fish ≥4). (~308 tok)

## .claude/skills/spike-findings-tui-llm/sources/007-fish-tui-handoff/

- `drive.sh` — drive.sh <fish-binary> <scenario> — runs a scenario in a private tmux server and prints screen (~639 tok)
- `queque.fish` — Spike 007: full fish adapter — ports qq-question-widget (shell/zsh/queque.zsh:334). fish ≥4. (~1541 tok)
- `README.md` — Project documentation (~820 tok)

## .claude/worktrees/agent-a6dd9a29f1cc04dd6/

- `vitest.live.config.ts` — /*.test.ts`) never (~328 tok)

## .claude/worktrees/agent-a6dd9a29f1cc04dd6/.planning/quick/261118-v58-nightly-live-cli-job-real-claude-code-cl/

- `261118-v58-SUMMARY.md` — Quick 261118-v58: Nightly live-cli job against the real Claude Code CLI Summary (~1810 tok)

## .claude/worktrees/agent-a6dd9a29f1cc04dd6/tests/live/

- `cli-contract.live.ts` — Live Claude Code CLI contract check (quick 261118-v58). Runs in the nightly `live-cli` job (~1834 tok)
- `live-daemon.ts` — Shared harness for the nightly live contract tests (phase 10 D-01 to D-03, quick 261118-v58). (~3196 tok)
- `sdk-contract.live.ts` — Live SDK contract check (phase 10, D-01 to D-03). (~771 tok)
## .claude/worktrees/agent-acc1b575e55c47c56/

- `.dockerignore` — Scopes the Docker build context of scripts/smoke-homebrew-docker.sh, the only Docker build (~136 tok)
- `package.json` — Node.js package manifest (~566 tok)

## .claude/worktrees/agent-acc1b575e55c47c56/.github/workflows/

- `release.yaml` — CI: Release (~2482 tok)

## .claude/worktrees/agent-acc1b575e55c47c56/.planning/quick/261118-ubg-speed-up-and-harden-the-release-workflow/

- `261118-ubg-SUMMARY.md` — Phase quick-261118-ubg Plan 01: Speed up and harden the release workflow Summary (~2003 tok)

## .claude/worktrees/agent-acc1b575e55c47c56/.wolf/

- `anatomy.md` — anatomy.md (~23294 tok)

## .claude/worktrees/agent-acc1b575e55c47c56/scripts/

- `docker-homebrew-smoke-runner.sh` (~911 tok)
- `smoke-homebrew-docker.sh` — Declares p (~1521 tok)

## .claude/worktrees/agent-acc1b575e55c47c56/tests/

- `homebrew-smoke-docker.test.ts` — The Homebrew install smoke (scripts/smoke-homebrew-docker.sh) gates every release. Only the (~1571 tok)

## .github/workflows/

- `ci.yml` — Push and PR CI (D-14). Runs on every branch push, every pull_request and on demand. (~1850 tok)
- `distro.yml` — Reusable distro matrices (D-14, D-16). Called by ci.yml with the PR image pins and by (~626 tok)
- `homebrew.yml` — CI: Update Homebrew Tap (~1144 tok)
- `nightly.yml` — Nightly safety net (phase 10, D-01 to D-03; schedule + workflow_dispatch only, contents: read): `distro` on :latest images; `live` runs only tests/live/sdk-contract.live.ts; `live-cli` (quick 261118-v58) installs the latest @anthropic-ai/claude-code unpinned, prints `claude --version`, requires the secret and runs only tests/live/cli-contract.live.ts; both live jobs guarded to k-leumas/queque (~1100 tok)
- `release.yaml` — CI: Release (~2090 tok)
- `nightly.yml` — Nightly safety net (phase 10, D-01 to D-03). Provider or distro drift shows up within a day (~570 tok)
- `release.yaml` — CI: Release. `test` (lint/typecheck/test/build, apt deps from awalsh128/cache-apt-pkgs-action + check step) and `brew-smoke` (buildx + gha cache, key-free Homebrew smoke) run in parallel; tag-and-changelog needs both, then publish-npm and publish-homebrew. (~2400 tok)
- `tap-clone-stats.yml` — Weekly snapshot of Homebrew tap clone traffic, with the clones made by our own publishing runs (~1865 tok)

## .gsd/

- `.gitignore` — Git ignore rules (~1 tok)
- `CODEBASE.md` — Codebase Map (~723 tok)
- `DECISIONS.md` — Declares implementing (~707 tok)
- `dispatch-isolation-sentinel.json` (~36 tok)
- `notifications.jsonl` (~173 tok)
- `PROJECT.md` — QueQue (~1526 tok)
- `REQUIREMENTS.md` — Requirements (~1662 tok)
- `STATE.md` — GSD State (~25 tok)

## .gsd/milestones/M001/

- `M001-CONTEXT.md` — M001 Context (~16 tok)
- `M001-RESEARCH.md` — Research Summary: QueQue (~3165 tok)
- `M001-ROADMAP.md` — M001: Migration (~398 tok)

## .gsd/milestones/M001/slices/S01/

- `S01-PLAN.md` — S01: Shell Bridge And Result Contract (~539 tok)
- `S01-RESEARCH.md` — Phase 1: Shell Bridge and Result Contract - Research (~4836 tok)
- `S01-SUMMARY.md` — S01: Shell Bridge And Result Contract (~3067 tok)

## .gsd/milestones/M001/slices/S01/tasks/

- `T01-PLAN.md` — T01: 01-shell-bridge-and-result-contract 01 (~249 tok)
- `T01-SUMMARY.md` — T01: 01-shell-bridge-and-result-contract 01 (~1224 tok)
- `T02-PLAN.md` — T02: 01-shell-bridge-and-result-contract 02 (~219 tok)
- `T02-SUMMARY.md` — T02: 01-shell-bridge-and-result-contract 02 (~1047 tok)
- `T03-PLAN.md` — T03: 01-shell-bridge-and-result-contract 03 (~317 tok)
- `T03-SUMMARY.md` — T03: 01-shell-bridge-and-result-contract 03 (~997 tok)

## .gsd/milestones/M001/slices/S02/

- `S02-PLAN.md` — S02: Intent Router And Context Pipeline (~1629 tok)
- `S02-RESEARCH.md` — Phase 2: Intent Router and Context Pipeline - Research (~5890 tok)
- `S02-SUMMARY.md` — S02: Intent Router And Context Pipeline (~2951 tok)

## .gsd/milestones/M001/slices/S02/tasks/

- `T01-PLAN.md` — T01: 02-intent-router-and-context-pipeline 01 (~610 tok)
- `T01-SUMMARY.md` — T01: 02-intent-router-and-context-pipeline 01 (~1000 tok)
- `T02-PLAN.md` — T02: 02-intent-router-and-context-pipeline 02 (~935 tok)
- `T02-SUMMARY.md` — T02: 02-intent-router-and-context-pipeline 02 (~1074 tok)
- `T03-PLAN.md` — T03: 02-intent-router-and-context-pipeline 03 (~741 tok)
- `T03-SUMMARY.md` — T03: 02-intent-router-and-context-pipeline 03 (~670 tok)

## .gsd/milestones/M001/slices/S03/

- `S03-PLAN.md` — S03: Claude Fast Path And Ranked Suggestions (~697 tok)
- `S03-RESEARCH.md` — Phase 3: Claude Fast Path and Ranked Suggestions - Research (~8018 tok)

## .gsd/milestones/M001/slices/S03/tasks/

- `T01-PLAN.md` — T01: 03 01 (~399 tok)
- `T01-SUMMARY.md` — T01: 03 01 (~1055 tok)
- `T02-PLAN.md` — T02: 03 02 (~364 tok)
- `T02-SUMMARY.md` — T02: 03 02 (~1318 tok)
- `T03-PLAN.md` — T03: 03 03 (~317 tok)
- `T03-SUMMARY.md` — T03: 03 03 (~654 tok)

## .gsd/milestones/M001/slices/S04/

- `S04-PLAN.md` — S04: Update Interface And Interactivity To Match That Of This Git (~747 tok)
- `S04-RESEARCH.md` — Phase 03.1: Monocle-style Interface and Interactivity — Research (~6849 tok)
- `S04-SUMMARY.md` — S04: Update Interface And Interactivity To Match That Of This Git (~3403 tok)

## .gsd/milestones/M001/slices/S04/tasks/

- `T01-PLAN.md` — T01: 03.1 01 (~345 tok)
- `T01-SUMMARY.md` — T01: 03.1 01 (~882 tok)
- `T02-PLAN.md` — T02: 03.1 02 (~290 tok)
- `T02-SUMMARY.md` — T02: 03.1 02 (~815 tok)
- `T03-PLAN.md` — T03: 03.1 03 (~593 tok)
- `T03-SUMMARY.md` — T03: 03.1 03 (~1874 tok)

## .gsd/milestones/M001/slices/S05/

- `S05-PLAN.md` — S05: Zellij Floating Pane Integration For Best Ux (~774 tok)
- `S05-RESEARCH.md` — Phase 3.2: Zellij Floating Pane Integration - Research (~8712 tok)
- `S05-SUMMARY.md` — S05: Zellij Floating Pane Integration For Best Ux (~4438 tok)

## .gsd/milestones/M001/slices/S05/tasks/

- `T01-PLAN.md` — T01: 03.2 01 (~351 tok)
- `T01-SUMMARY.md` — T01: 03.2 01 (~1392 tok)
- `T02-PLAN.md` — T02: 03.2 02 (~404 tok)
- `T02-SUMMARY.md` — T02: 03.2 02 (~1616 tok)
- `T03-PLAN.md` — T03: 03.2 03 (~507 tok)
- `T03-SUMMARY.md` — T03: 03.2 03 (~1272 tok)

## .gsd/milestones/M001/slices/S06/

- `S06-PLAN.md` — S06: Fuzzy Tui Selection Ux (~603 tok)
- `S06-RESEARCH.md` — Phase 4: Fuzzy TUI Selection UX - Research (~6481 tok)

## .gsd/milestones/M001/slices/S06/tasks/

- `T01-PLAN.md` — T01: 04 01 (~341 tok)
- `T01-SUMMARY.md` — T01: 04 01 (~1201 tok)
- `T02-PLAN.md` — T02: 04 02 (~281 tok)
- `T02-SUMMARY.md` — T02: 04 02 (~1062 tok)
- `T03-PLAN.md` — T03: 04 03 (~364 tok)
- `T03-SUMMARY.md` — T03: 04 03 (~1397 tok)

## .gsd/milestones/M001/slices/S07/

- `S07-PLAN.md` — S07: Clarification Chat in the Same TUI (~58 tok)

## .gsd/milestones/M001/slices/S08/

- `S08-PLAN.md` — S08: Hardening, Privacy Defaults, and Extension Seams (~69 tok)

## .gsd/runtime/

- `write-gate-state.json` (~35 tok)

## .planning/

- `.continue-here.md` — Session Handoff — Homebrew Binary Fix + Tooling Cleanup (~1144 tok)
- `config.json` (~268 tok)
- `HANDOFF.json` — Declares correctly (~1406 tok)
- `PROJECT.md` — QueQue (~2352 tok)
- `REQUIREMENTS.md` — Requirements: QueQue (~1781 tok)
- `ROADMAP.md` — Roadmap: QueQue (~7986 tok)
- `state.json` (~451 tok)
- `STATE.md` — Project State (~5111 tok)

## .planning/debug/

- `empty-modal-after-tool-awareness-reenable.md` — Current Focus (~3914 tok)
- `llm-response-latency-profile.md` — Symptoms (~6991 tok)
- `modal-filter-prefilled-with-query.md` — Current Focus (~3813 tok)

## .planning/debug/resolved/

- `modal-blank-before-loading.md` — Symptoms (~3787 tok)
- `smoke-picker-race.md` — Symptoms (~3154 tok)

## .planning/notes/

- `2026-05-01-figure-out-directory-version-control-and-passing-that.md` (~38 tok)
- `2026-05-01-shell-path-vcs-detection.md` — Declares we (~60 tok)

## .planning/phases/01-shell-bridge-and-result-contract/

- `01-01-PLAN.md` — /*.test.ts`. In `src/cli/main.ts`, export `main` and register the stable `client` and `daemon` commands, including the `daemon --ensure` flow, even... (~2157 tok)
- `01-01-SUMMARY.md` — Phase 01 Plan 01: Toolchain Baseline and Shell/IPC Contracts Summary (~1742 tok)
- `01-02-PLAN.md` — Declares ShellRequest (~1812 tok)
- `01-02-SUMMARY.md` — Phase 01 Plan 02: ZSH Bridge and Result Application Summary (~1437 tok)
- `01-03-PLAN.md` — ShellResult: ensureDaemon, startDaemonServer, runForegroundClient, writeShellResult (~2735 tok)
- `01-03-SUMMARY.md` — Phase 01 Plan 03: Daemon Bootstrap and Client Seam Summary (~1393 tok)
- `01-HUMAN-UAT.md` — Current Test (~504 tok)
- `01-RESEARCH.md` — Phase 1: Shell Bridge and Result Contract - Research (~4836 tok)
- `01-REVIEW-FIX.md` — Phase 01: Code Review Fix Report (~1149 tok)
- `01-REVIEW.md` — Phase 01: Code Review Report (~3511 tok)
- `01-VALIDATION.md` — Phase 1 — Validation Strategy (~918 tok)
- `01-VERIFICATION.md` — Phase 1: Shell Bridge and Result Contract Verification Report (~4026 tok)

## .planning/phases/02-intent-router-and-context-pipeline/

- `02-01-PLAN.md` — Broad intent categories classified before any context gathering. (~8477 tok)
- `02-01-SUMMARY.md` — Phase 02 Plan 01: Intent contracts and deterministic routing Summary (~1222 tok)
- `02-02-PLAN.md` — Exports RequestIntent (~13578 tok)
- `02-02-SUMMARY.md` — Phase 02 Plan 02: Context pipeline and candidate selection Summary (~1430 tok)
- `02-03-PLAN.md` — Exports GatherContextInput (~8405 tok)
- `02-03-SUMMARY.md` — Phase 02 Plan 03: Registry bootstrap Summary (~947 tok)
- `02-CONTEXT.md` — Phase 2: Intent Router and Context Pipeline - Context (~1686 tok)
- `02-DISCUSSION-LOG.md` — Phase 2: Intent Router and Context Pipeline - Discussion Log (~840 tok)
- `02-PATTERNS.md` — Phase 2: Intent Router and Context Pipeline - Pattern Map (~5434 tok)
- `02-RESEARCH.md` — Phase 2: Intent Router and Context Pipeline - Research (~5890 tok)
- `02-REVIEWS.md` — Cross-AI Plan Review — Phase 2 (~2741 tok)
- `02-VALIDATION.md` — Phase 2 — Validation Strategy (~857 tok)

## .planning/phases/03-claude-fast-path-and-ranked-suggestions/

- `03-01-PLAN.md` — Exports ContextEnvelope (~3933 tok)
- `03-01-SUMMARY.md` — Dependency graph (~1389 tok)
- `03-02-PLAN.md` — Trust Boundaries (~3131 tok)
- `03-02-SUMMARY.md` — Phase 03 Plan 02: Confidence Propagation, Error ShellResult, and Claude Backend Registration Summary (~1576 tok)
- `03-03-PLAN.md` — Trust Boundaries (~2481 tok)
- `03-03-SUMMARY.md` — Phase 03 Plan 03: Error Kind Handling in ZSH Widget Summary (~770 tok)
- `03-CONTEXT.md` — Phase 3: Claude Fast Path and Ranked Suggestions - Context (~1774 tok)
- `03-PATTERNS.md` — Phase 3: Claude Fast Path and Ranked Suggestions - Pattern Map (~5237 tok)
- `03-RESEARCH.md` — Phase 3: Claude Fast Path and Ranked Suggestions - Research (~8018 tok)
- `03-REVIEW-FIX.md` — Phase 03: Code Review Fix Report (~1902 tok)
- `03-REVIEW.md` — Phase 03: Code Review Report — Claude Fast Path and Ranked Suggestions (~2885 tok)
- `03-VALIDATION.md` — Phase 3 — Validation Strategy (~944 tok)
- `03-VERIFICATION.md` — Phase 03: Claude Fast Path and Ranked Suggestions Verification Report (~2456 tok)

## .planning/phases/03.1-update-interface-and-interactivity-to-match-that-of-this-git/

- `03.1-01-PLAN.md` — Trust Boundaries (~3397 tok)
- `03.1-01-SUMMARY.md` — Phase 03.1 Plan 01: Wave 0 Test Infrastructure Summary (~1008 tok)
- `03.1-02-PLAN.md` — Trust Boundaries (~2868 tok)
- `03.1-02-SUMMARY.md` — Phase 03.1 Plan 02: UI Support Components (Wave 1) Summary (~987 tok)
- `03.1-03-PLAN.md` — Exports CandidateSelect (~5763 tok)
- `03.1-03-SUMMARY.md` — Phase 03.1 Plan 03: Wave 2 Core Implementation Summary (~2166 tok)
- `03.1-CONTEXT.md` — Phase 3.1: Monocle-style Interface and Interactivity - Context (~1626 tok)
- `03.1-DISCUSSION-LOG.md` — Phase 3.1: Monocle-style Interface and Interactivity - Discussion Log (~788 tok)
- `03.1-HUMAN-UAT.md` — Current Test (~359 tok)
- `03.1-PATTERNS.md` — Phase 03.1: Monocle-style Interface and Interactivity — Pattern Map (~5392 tok)
- `03.1-RESEARCH.md` — Phase 03.1: Monocle-style Interface and Interactivity — Research (~6849 tok)
- `03.1-REVIEW.md` — Phase 03.1: Code Review Report (~3497 tok)
- `03.1-UI-SPEC.md` — Phase 03.1 — UI Design Contract: Monocle-style Interface and Interactivity (~3007 tok)
- `03.1-VALIDATION.md` — Phase 03.1 — Validation Strategy (~910 tok)
- `03.1-VERIFICATION.md` — Phase 03.1: Monocle-style Interface and Interactivity — Verification Report (~4215 tok)

## .planning/phases/03.2-zellij-floating-pane-integration-for-best-ux/

- `.gitkeep` (~0 tok)
- `03.2-01-PLAN.md` — returning: runZsh, runZshWithoutZellij (~4521 tok)
- `03.2-01-SUMMARY.md` — Phase 3.2 Plan 01: Wave 1 TDD Foundation — Test Contracts for FIFO and Zellij Integration Summary (~1811 tok)
- `03.2-02-PLAN.md` — Exports ForegroundClientArgs (~3930 tok)
- `03.2-02-SUMMARY.md` — Phase 3.2 Plan 02: Wave 2 — FIFO-Aware Write and Zellij Branch Implementation Summary (~1955 tok)
- `03.2-03-PLAN.md` — Trust Boundaries (~3914 tok)
- `03.2-03-SUMMARY.md` — Phase 03.2 Plan 03: qq-question-widget Zellij FIFO Rewrite Summary (~1485 tok)
- `03.2-CONTEXT.md` — Phase 3.2: Zellij floating pane integration for best UX - Context (~1960 tok)
- `03.2-DISCUSSION-LOG.md` — Phase 3.2: Zellij floating pane integration for best UX - Discussion Log (~1080 tok)
- `03.2-PATTERNS.md` — Phase 3.2: Zellij Floating Pane Integration - Pattern Map (~3828 tok)
- `03.2-RESEARCH.md` — Phase 3.2: Zellij Floating Pane Integration - Research (~8712 tok)
- `03.2-REVIEWS.md` — Cross-AI Plan Review — Phase 3.2 (~2218 tok)
- `03.2-VALIDATION.md` — Phase 3.2 — Validation Strategy (~848 tok)

## .planning/phases/04-fuzzy-tui-selection-ux/

- `.continue-here.md` — Session Checkpoint — Phase 04 UAT Fixes Pending (~1112 tok)
- `04-01-PLAN.md` — Declares with (~4172 tok)
- `04-01-SUMMARY.md` — Phase 04 Plan 01: TDD Test Scaffolding Summary (~1281 tok)
- `04-02-PLAN.md` — Trust Boundaries (~1718 tok)
- `04-02-SUMMARY.md` — Phase 04 Plan 02: useEffect([query]) Reset Hook Summary (~1331 tok)
- `04-03-PLAN.md` — Trust Boundaries (~2875 tok)
- `04-03-SUMMARY.md` — Phase 04 Plan 03: Main.ts FIFO Safety Handlers Summary (~1632 tok)
- `04-PATTERNS.md` — Phase 4: Fuzzy TUI Selection UX - Pattern Map (~4525 tok)
- `04-RESEARCH.md` — Phase 4: Fuzzy TUI Selection UX - Research (~6482 tok)
- `04-REVIEW.md` — Phase 04: Code Review Report (~3376 tok)
- `04-UAT.md` — Current Test (~1187 tok)
- `04-VALIDATION.md` — Phase 04 — Validation Strategy (~955 tok)
- `04-VERIFICATION.md` — Phase 04: Fuzzy TUI Selection UX Verification Report (~4052 tok)

## .planning/phases/06-hardening-privacy-defaults-and-extension-seams/

- `06-01-PLAN.md` (~3012 tok)
- `06-01-SUMMARY.md` — Phase 06 Plan 01: Privacy Defaults and CMD-04 Safety Summary (~1440 tok)
- `06-02-PLAN.md` — Declares after (~3038 tok)
- `06-02-SUMMARY.md` — Phase 06 Plan 02: Registry Provider Resolution Summary (~1477 tok)
- `06-03-PLAN.md` (~2772 tok)
- `06-03-SUMMARY.md` — Phase 06 Plan 03: Daily-Driver Documentation Summary (~1237 tok)
- `06-PATTERNS.md` — Phase 6: Hardening, Privacy Defaults, and Extension Seams - Pattern Map (~6426 tok)
- `06-RESEARCH.md` — Phase 6: Hardening, Privacy Defaults, and Extension Seams - Research (~6651 tok)
- `06-REVIEWS.md` — Cross-AI Plan Review — Phase 06 (~6403 tok)
- `06-VALIDATION.md` — Phase 06 — Validation Strategy (~894 tok)
- `06-VERIFICATION.md` — Phase 6: Hardening, Privacy Defaults, and Extension Seams Verification Report (~2598 tok)

## .planning/phases/07-context-aware-learning-and-ambient-suggestions/

- `07-CONTEXT.md` — Phase 7: Context-Aware Learning and Ambient Suggestions - Context (~2244 tok)
- `07-DISCUSSION-LOG.md` — Phase 7: Context-Aware Learning and Ambient Suggestions - Discussion Log (~764 tok)

## .planning/phases/08-zero-config-install-and-provider-detection/

- `08-01-PLAN.md` — Trust Boundaries (~1599 tok)
- `08-01-SUMMARY.md` — Phase 08 Plan 01: Platform-Aware Claude Auth Detection Summary (~918 tok)
- `08-02-PLAN.md` (~10802 tok)
- `08-02-SUMMARY.md` — Phase 08 Plan 02: Claude CLI-First Fetch with SDK Rescue Summary (~1774 tok)
- `08-03-PLAN.md` — Declares ProviderPin (~9758 tok)
- `08-03-SUMMARY.md` — Phase 8 Plan 03: Provider Pin and Ollama Adapter Summary (~4977 tok)
- `08-04-PLAN.md` — Cross-phase note from Phase 9 (09-03) (~5769 tok)
- `08-04-SUMMARY.md` — Phase 8 Plan 04: OpenAI Adapter Summary (~4352 tok)
- `08-05-PLAN.md` — Declares ProviderPin (~6701 tok)
- `08-05-SUMMARY.md` — Phase 8 Plan 05: `qq init provider` Picker Summary (~6349 tok)
- `08-06-PLAN.md` (~4152 tok)
- `08-06-SUMMARY.md` — Phase 8 Plan 06: Failure Hint and Shipped-Behavior Docs Summary (~3359 tok)
- `08-CONTEXT.md` — Phase 8: Zero-Config Install and Provider Detection - Context (~2262 tok)
- `08-DISCUSSION-LOG.md` — Phase 8: Zero-Config Install and Provider Detection - Discussion Log (~954 tok)
- `08-PATTERNS.md` — Phase 8: Zero-Config Install and Provider Detection - Pattern Map (~6670 tok)
- `08-RESEARCH.md` — Phase 8: Zero-Config Install and Provider Detection - Research (~8967 tok)
- `08-REVIEW-DISPOSITION.md` — Phase 08: Code Review Disposition (~1617 tok)
- `08-REVIEW-FIX.md` — Phase 8: Code Review Fix Report (~3034 tok)
- `08-REVIEW.md` — Phase 8: Code Review Report (iteration 3, incremental diff 3eb8bfb..HEAD) (~3419 tok)
- `08-REVIEWS.md` — Cross-AI Plan Review — Phase 8 (~2352 tok)
- `08-SECURITY.md` — threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate) (~2301 tok)
- `08-UAT.md` — Current Test (~940 tok)
- `08-VALIDATION.md` — Phase 8 — Validation Strategy (~990 tok)
- `08-VERIFICATION.md` — Phase 08: Zero-Config Install and Provider Detection Verification Report (~6737 tok)
- `COVERAGE.md` — API Coverage — Phase 08 (Ollama, OpenAI, Anthropic Messages, Claude Code CLI) (~1524 tok)

## .planning/phases/09-installed-only-command-awareness/

- `.gitkeep` (~1 tok)
- `09-01-PLAN.md` — Declares names (~14923 tok)
- `09-01-SUMMARY.md` — Phase 9 Plan 01: Installed-Tool Awareness Tracer Summary (~3567 tok)
- `09-02-PLAN.md` — Declares stripping (~6006 tok)
- `09-02-SUMMARY.md` — Phase 9 Plan 02: Lexer Proof Summary (~3125 tok)
- `09-03-PLAN.md` — Exports QUEQUE_SYSTEM (~9570 tok)
- `09-03-SUMMARY.md` — Phase 9 Plan 03: Installed-Tools Prompt Steering Summary (~3780 tok)
- `09-04-PLAN.md` — Declares components (~9205 tok)
- `09-04-SUMMARY.md` — Phase 9 Plan 04: Tab Install Form Summary (~3886 tok)
- `09-05-PLAN.md` (~8065 tok)
- `09-05-SUMMARY.md` — Phase 9 Plan 05: Installed-Tools Chunk, Daemon Capability and Live Check Summary (~2198 tok)
- `09-06-PLAN.md` — Declares with (~9089 tok)
- `09-06-SUMMARY.md` — Phase 9 Plan 06: Empty Zellij Modal (G-09-7) Summary (~4285 tok)
- `09-CONTEXT.md` — Phase 9: Installed-Only Command Awareness - Context (~2940 tok)
- `09-DISCUSSION-LOG.md` — Phase 9: Installed-Only Command Awareness - Discussion Log (~1131 tok)
- `09-PATTERNS.md` — Phase 9: Installed-Only Command Awareness - Pattern Map (~3875 tok)
- `09-RESEARCH.md` — Phase 9: Installed-Only Command Awareness - Research (~13327 tok)
- `09-REVIEW-DISPOSITION.md` — Phase 09: Code Review Disposition (~1230 tok)
- `09-REVIEW-FIX.md` — Phase 9: Code Review Fix Report (~2744 tok)
- `09-REVIEW.md` — Phase 9: Code Review Report (~6807 tok)
- `09-REVIEWS.md` — Cross-AI Plan Review — Phase 9 (~9364 tok)
- `09-SECURITY.md` — threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate) (~2499 tok)
- `09-UAT.md` — Current Test (~3540 tok)
- `09-VALIDATION.md` — status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6) (~2358 tok)
- `09-VERIFICATION.md` — Phase 9: Installed-Only Command Awareness Verification Report (~6329 tok)
- `COVERAGE.md` (~44 tok)
- `deferred-items.md` — Phase 09 — Deferred Items (~280 tok)

## .planning/phases/09-installed-only-command-awareness/.review-diagnostics/20261008T065606Z-gsd-review-zh3vw6/

- `gsd-review-claude.md` — Phase 9 plan review: installed-only command awareness (~4563 tok)
- `gsd-review-codex.err` — Declares so (~54449 tok)
- `gsd-review-codex.md` — Cross-AI Plan Review Request (~51075 tok)
- `gsd-review-cursor.md` — Cross-AI Plan Review — Phase 9 (Installed-Only Command Awareness) (~3415 tok)

## .planning/phases/09-installed-only-command-awareness/.tdd/

- `09-01-red-evidence.json` (~1228 tok)
- `09-04-task1-red-evidence.json` — Declares on (~1889 tok)
- `09-04-task2-red-evidence.json` (~2093 tok)

## .planning/phases/09.1-provider-latency-and-cancellation/

- `.gitkeep` (~1 tok)
- `09.1-01-PLAN.md` — Artifacts this phase produces (~12953 tok)
- `09.1-01-SUMMARY.md` — Phase 09.1 Plan 01: Cancellable stream-json claude -p turn Summary (~4826 tok)
- `09.1-02-PLAN.md` — Artifacts this phase produces (~6996 tok)
- `09.1-02-SUMMARY.md` — Phase 09.1 Plan 02: claude -p effort and streamed candidates Summary (~5315 tok)
- `09.1-03-PLAN.md` — Artifacts this phase produces (~6865 tok)
- `09.1-03-SUMMARY.md` — Phase 09.1 Plan 03: Streamed candidate IPC Summary (~4943 tok)
- `09.1-04-PLAN.md` — Artifacts this phase produces (~7405 tok)
- `09.1-04-SUMMARY.md` — Phase 09.1 Plan 04: Streamed, abortable SDK request with effort Summary (~4810 tok)
- `09.1-05-PLAN.md` — Artifacts this phase produces (~8364 tok)
- `09.1-05-SUMMARY.md` — Phase 09.1 Plan 05: Prewarmed claude -p Process Summary (~4766 tok)
- `09.1-06-PLAN.md` — Artifacts this phase produces (~6783 tok)
- `09.1-06-SUMMARY.md` — Phase 09.1 Plan 06: Bounded, backstopped claude -p runner Summary (~4845 tok)
- `09.1-07-PLAN.md` — Artifacts this phase produces (~8174 tok)
- `09.1-07-SUMMARY.md` — Phase 09.1 Plan 07: Streamed candidate list in the modal Summary (~4532 tok)
- `09.1-08-PLAN.md` — Artifacts this phase produces (~6502 tok)
- `09.1-08-SUMMARY.md` — Phase 09.1 Plan 08: Phase Gate, OpenWolf Records and Latency UAT Prep Summary (~5691 tok)
- `09.1-09-PLAN.md` — Declares to (~9359 tok)
- `09.1-09-SUMMARY.md` — Phase 09.1 Plan 09: Empty FILTER on Open (G-09.1-5) Summary (~4197 tok)
- `09.1-10-PLAN.md` — Artifacts this phase produces (~11136 tok)
- `09.1-10-SUMMARY.md` — Phase 09.1 Plan 10: Coalesced stdin read (CR-01) Summary (~3051 tok)
- `09.1-CONTEXT.md` — Phase 09.1: Provider Latency and Cancellation - Context (~2938 tok)
- `09.1-DISCUSSION-LOG.md` — Phase 09.1: Provider Latency and Cancellation - Discussion Log (~847 tok)
- `09.1-PATTERNS.md` — Phase 09.1: Provider Latency and Cancellation - Pattern Map (~3593 tok)
- `09.1-RESEARCH.md` — Phase 09.1: Provider Latency and Cancellation - Research (~18055 tok)
- `09.1-REVIEW-DISPOSITION.md` — Phase 09.1: Code Review Disposition (~1352 tok)
- `09.1-REVIEW-FIX.md` — Phase 09.1: Code Review Fix Report (~2739 tok)
- `09.1-REVIEW.md` — Phase 09.1: Code Review Report (~3339 tok)
- `09.1-REVIEWS.md` — Cross-AI Plan Review — Phase 09.1 (~5368 tok)
- `09.1-SECURITY.md` — threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate) (~2225 tok)
- `09.1-UAT.md` — Setup (before any test) (~2358 tok)
- `09.1-VALIDATION.md` — status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6) (~2824 tok)
- `09.1-VERIFICATION.md` — Phase 09.1: Provider Latency and Cancellation Verification Report (~6434 tok)
- `COVERAGE.md` — API Coverage — Anthropic Messages API (TS SDK 0.92.0) and Claude Code print mode (2.1.285) (~681 tok)

## .planning/phases/09.1-provider-latency-and-cancellation/.review-diagnostics/20261012T055939Z-gsd-review-muEyHJ/

- `gsd-review-codex.err` — Declares so (~85400 tok)
- `gsd-review-codex.md` — Cross-AI Plan Review Request (~80092 tok)
- `gsd-review-cursor.md` — Phase 09.1 Plan Review (~4498 tok)
- `gsd-review-ollama.md` (~48 tok)

## .planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/

- `.gitkeep` (~1 tok)
- `10-01-PLAN.md` — Artifacts this phase produces (~8944 tok)
- `10-01-SUMMARY.md` — Phase 10 Plan 01: Distro Smoke Harness and Busybox lsof Fix Summary (~4888 tok)
- `10-02-PLAN.md` — Artifacts this phase produces (~5342 tok)
- `10-02-SUMMARY.md` — Phase 10 Plan 02: Stale Prewarm Simulation and mktemp Guard Summary (~2662 tok)
- `10-03-PLAN.md` — Artifacts this phase produces (~5801 tok)
- `10-03-SUMMARY.md` — Phase 10 Plan 03: qq doctor Summary (~2970 tok)
- `10-04-PLAN.md` — Artifacts this phase produces (~7397 tok)
- `10-04-SUMMARY.md` — Phase 10 Plan 04: Telemetry foundation Summary (~3116 tok)
- `10-05-PLAN.md` — Artifacts this phase produces (~6769 tok)
- `10-05-SUMMARY.md` — Phase 10 Plan 05: Push/PR CI, Six-Distro Matrices and the ci-ok Gate Summary (~3921 tok)
- `10-06-PLAN.md` — Artifacts this phase produces (~8032 tok)
- `10-06-SUMMARY.md` — Phase 10 Plan 06: Daemon telemetry buffer, IPC kinds and error kinds Summary (~4228 tok)
- `10-07-PLAN.md` — Artifacts this phase produces (~6315 tok)
- `10-07-SUMMARY.md` — Phase 10 Plan 07: Smoke Auto-Revert PR Summary (~4141 tok)
- `10-08-PLAN.md` — Artifacts this phase produces (~5438 tok)
- `10-08-SUMMARY.md` — Phase 10 Plan 08: Nightly :latest Matrices and the Live SDK Contract Job Summary (~3594 tok)
- `10-09-PLAN.md` — Artifacts this phase produces (~5108 tok)
- `10-09-SUMMARY.md` — Phase 10 Plan 09: qq telemetry and the doctor telemetry row Summary (~3348 tok)
- `10-10-PLAN.md` — Artifacts this phase produces (~6434 tok)
- `10-10-SUMMARY.md` — Phase 10 Plan 10: Client Telemetry Events Summary (~4444 tok)
- `10-11-PLAN.md` — Artifacts this phase produces (~6980 tok)
- `10-11-SUMMARY.md` — Phase 10 Plan 11: Telemetry Consent Ask and Phase Gate Summary (~4417 tok)
- `10-12-PLAN.md` — Artifacts this phase produces (~5039 tok)
- `10-12-SUMMARY.md` — Phase 10 Plan 12: GitHub CI Proof and Revert Drill Summary (~7514 tok)
- `10-13-PLAN.md` — Artifacts this phase produces (~5222 tok)
- `10-13-SUMMARY.md` — Phase 10 Plan 13: Telemetry Key Decision Summary (~1124 tok)
- `10-CONTEXT.md` — Phase 10: Linux distro CI harness and anonymous telemetry - Context (~2801 tok)
- `10-DISCUSSION-LOG.md` — Phase 10: Linux distro CI harness and anonymous telemetry - Discussion Log (~825 tok)
- `10-PATTERNS.md` — Phase 10: Linux distro CI harness and anonymous telemetry - Pattern Map (~3292 tok)
- `10-RESEARCH.md` — Phase 10: Linux distro CI harness and anonymous telemetry - Research (~22000 tok)
- `10-REVIEW-DISPOSITION.md` — Phase 10: Code Review Disposition (~1207 tok)
- `10-REVIEW-FIX.md` — Phase 10: Code Review Fix Report (~1991 tok)
- `10-REVIEW.md` — Phase 10: Code Review Report (re-review after the fix run) (~3189 tok)
- `10-SECURITY.md` — threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate) (~2513 tok)
- `10-UAT.md` — Current Test (~442 tok)
- `10-VALIDATION.md` — status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6) (~2054 tok)
- `10-VERIFICATION.md` — Phase 10: Linux distro CI harness and anonymous telemetry Verification Report (~3689 tok)
- `COVERAGE.md` — API Coverage — PostHog Cloud EU public capture API, and the GitHub REST API (via `gh` in CI) (~735 tok)

## .planning/phases/11-multi-shell-trigger-support-bash-and-fish/

- `.gitkeep` (~1 tok)
- `11-01-PLAN.md` — Artifacts this phase produces (~12224 tok)
- `11-01-SUMMARY.md` — Phase 11 Plan 01: bash `??` tracer and PTY harness Summary (~5170 tok)
- `11-02-PLAN.md` — Artifacts this phase produces (~5990 tok)
- `11-02-SUMMARY.md` — Phase 11 Plan 02: shell identity in the context and prompt Summary (~3343 tok)
- `11-03-PLAN.md` — Artifacts this phase produces (~7369 tok)
- `11-03-SUMMARY.md` — Phase 11 Plan 03: Shell-aware tool handoff and command-word lexer Summary (~4510 tok)
- `11-04-PLAN.md` — Artifacts this phase produces (~8936 tok)
- `11-04-SUMMARY.md` — Phase 11 Plan 04: Shell registry and `qq init [shell]` Summary (~3268 tok)
- `11-05-PLAN.md` — Artifacts this phase produces (~6270 tok)
- `11-05-SUMMARY.md` — Phase 11 Plan 05: Shell-aware telemetry environment Summary (~3753 tok)
- `11-06-PLAN.md` — Artifacts this phase produces (~7870 tok)
- `11-06-SUMMARY.md` — Phase 11 Plan 06: Instant frame spec and bash painter Summary (~4569 tok)
- `11-07-PLAN.md` — Artifacts this phase produces (~8330 tok)
- `11-07-SUMMARY.md` — Phase 11 Plan 07: bash tool handoff, prewarm and Zellij pane Summary (~4802 tok)
- `11-08-PLAN.md` — Artifacts this phase produces (~7187 tok)
- `11-08-SUMMARY.md` — Phase 11 Plan 08: bash diagnostics in `qq doctor` Summary (~4292 tok)
- `11-09-PLAN.md` — Artifacts this phase produces (~7340 tok)
- `11-09-SUMMARY.md` — Phase 11 Plan 09: Distro bash smoke, bash-versions CI and Homebrew bash adapter Summary (~3486 tok)
- `11-10-PLAN.md` — Artifacts this phase produces (~6192 tok)
- `11-10-SUMMARY.md` — Phase 11 Plan 10: Shell-neutral docs, the adapter contract and the SHELL_NAMES invariant Summary (~3304 tok)
- `11-11-PLAN.md` — Declared files are the .wolf/ records. If a Task 1 gate fails, the fix lands in the owning (~5913 tok)
- `11-11-SUMMARY.md` — Phase 11 Plan 11: Final gate, macOS bash UAT and CI Summary (~3000 tok)
- `11-CONTEXT.md` — Phase 11: Multi-shell trigger support (bash, fish-ready) - Context (~2667 tok)
- `11-DISCUSSION-LOG.md` — Phase 11: Multi-shell trigger support (bash, fish-ready) - Discussion Log (~844 tok)
- `11-PATTERNS.md` — Phase 11: Multi-shell trigger support (bash, fish-ready) - Pattern Map (~4891 tok)
- `11-RESEARCH.md` — Phase 11: Multi-shell trigger support (bash, fish-ready) - Research (~17835 tok)
- `11-REVIEW-DISPOSITION.md` — Phase 11: Code Review Disposition (~813 tok)
- `11-REVIEW-FIX.md` — Phase 11: Code Review Fix Report (~2388 tok)
- `11-REVIEW.md` — Phase 11: Code Review Report (~3548 tok)
- `11-REVIEWS.md` — Cross-AI Plan Review — Phase 11 (~11156 tok)
- `11-SECURITY.md` — threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate) (~2154 tok)
- `11-VALIDATION.md` — status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6) (~2226 tok)
- `11-VERIFICATION.md` — Phase 11: Multi-shell trigger support (bash, fish-ready): Verification Report (~5325 tok)

## .planning/phases/11-multi-shell-trigger-support-bash-and-fish/.red/

- `11-01-red.json` (~1306 tok)
- `11-02-task1-red.json` (~1012 tok)
- `11-02-task2-red.json` (~2756 tok)
- `11-03-task1-red.json` (~835 tok)
- `11-03-task2-red.json` — Declares fd (~4502 tok)
- `11-06-task1-red.json` — Declares is (~1614 tok)
- `11-06-task2-red.json` (~2593 tok)
- `11-07-task1-red.json` — Declares corrupt (~1788 tok)
- `11-07-task2-red.json` — Declares corrupt (~2149 tok)

## .planning/phases/12-fish-trigger-support/

- `.gitkeep` (~1 tok)

## .planning/phases/999.1-model-supplied-install-package-names/

- `.gitkeep` (~0 tok)

## .planning/quick/20260522-selection-summary-and-history/

- `PLAN.md` — Quick Task: Selection Summary and History (~823 tok)
- `SUMMARY.md` — Summary: Selection Summary and History (~274 tok)

## .planning/quick/20260604-isDirectRun-symlink-regression/

- `PLAN.md` — Quick Task: isDirectRun Symlink Regression Tests (~256 tok)
- `SUMMARY.md` — Summary: isDirectRun Symlink Regression Tests (~138 tok)

## .planning/quick/20260604-prod-tui-crash-fix/

- `PLAN.md` — Quick Task: Fix production TUI crash on Homebrew binary (~429 tok)

## .planning/quick/20260608-zellij-title-repeat/

- `PLAN.md` — Quick Task: Fix repeating title in Zellij modal (~376 tok)
- `SUMMARY.md` — Summary: Fix repeating title in Zellij modal (~124 tok)

## .planning/quick/20260617-privacy-config-file/

- `PLAN.md` — Quick Task: User privacy config file (~170 tok)
- `REVIEW.md` — Phase 20260617-privacy-config-file: Code Review Report (~2143 tok)
- `SUMMARY.md` — Quick Task: User privacy config file (~319 tok)

## .planning/quick/20260618-candidate-command-trim/

- `SUMMARY.md` — Quick Task: Trim candidate command whitespace (~111 tok)

## .planning/quick/20260618-destructive-warning-mark/

- `PLAN.md` — Quick Task: Destructive command warning mark (~141 tok)
- `SUMMARY.md` — Quick Task: Destructive command warning mark (~116 tok)

## .planning/quick/20260618-selection-arrow-tail/

- `SUMMARY.md` — Quick Task: Selection arrow vertical tail (~115 tok)

## .planning/quick/20260618-zellij-responsive-height/

- `PLAN.md` — Quick Task: Zellij responsive modal height (~151 tok)
- `SUMMARY.md` — Quick Task: Zellij responsive modal height (~192 tok)

## .planning/quick/20260619-pnpm-allow-builds/

- `PLAN.md` — Quick Task: Fix CI pnpm install ERR_PNPM_IGNORED_BUILDS (~54 tok)
- `SUMMARY.md` — Quick Task: Fix CI pnpm install ERR_PNPM_IGNORED_BUILDS (~70 tok)

## .planning/quick/20260619-workflows-nvmrc/

- `PLAN.md` — Quick Task: Workflows use .nvmrc for Node version (~81 tok)
- `SUMMARY.md` — Quick Task: Workflows use .nvmrc for Node version (~85 tok)

## .planning/quick/260501-qt4-write-a-short-node-script-that-restart-t/

- `260501-qt4-PLAN.md` — Quick Task Plan (~611 tok)
- `260501-qt4-SUMMARY.md` — Quick Summary 260501-qt4 (~157 tok)

## .planning/quick/260502-cf6-fix-the-ci-so-the-tests-pass/

- `260502-cf6-PLAN.md` — Quick Task 260502-cf6: fix the ci so the tests pass (~222 tok)
- `260502-cf6-SUMMARY.md` — Quick Task 260502-cf6: fix the ci so the tests pass (~112 tok)

## .planning/quick/260522-tui-cleanup-on-close/

- `PLAN.md` — Quick Task: TUI Cleanup on Close (~300 tok)
- `SUMMARY.md` — Summary: TUI Cleanup on Close (~240 tok)

## .planning/quick/260522-vfd-prototype-provider-detection/

- `260522-vfd-PLAN.md` — Trust Boundaries (~2693 tok)
- `260522-vfd-SUMMARY.md` — Phase quick Plan 260522-vfd: Prototype Provider Detection Summary (~881 tok)

## .planning/quick/260528-mk1-rename-que-que-to-queque-in-prose-write-/

- `260528-mk1-PLAN.md` — Declares names (~2959 tok)
- `260528-mk1-SUMMARY.md` — Phase quick Plan 260528-mk1: Rename que-que to queque Summary (~1192 tok)

## .planning/quick/260529-ney-explore-beta-release-requirements-for-ho/

- `260529-ney-PLAN.md` (~2158 tok)
- `260529-ney-SUMMARY.md` — Phase quick Plan 260529-ney: Beta Release Requirements Research Summary (~814 tok)
- `BETA-RELEASE-REQUIREMENTS.md` — QueQue Beta Release Requirements (~6318 tok)

## .planning/quick/260529-ntf-implement-release-automation-workflows-a/

- `260529-ntf-PLAN.md` — Trust Boundaries (~2719 tok)
- `260529-ntf-SUMMARY.md` — Phase quick-260529-ntf Plan 01: Release Automation Workflows Summary (~821 tok)

## .planning/quick/261011-e43-fix-top-queque-line-is-clipped-when-moda/

- `261011-e43-PLAN.md` (~6165 tok)
- `261011-e43-RED-evidence.json` (~858 tok)
- `261011-e43-SUMMARY.md` — Phase quick-261011-e43 Plan 01: Zellij header clip fix Summary (~2858 tok)

## .planning/quick/261011-f9o-keep-the-zellij-modal-at-its-full-list-h/

- `261011-f9o-PLAN.md` — Declares CandidateSelect (~8008 tok)
- `261011-f9o-RED-evidence.json` (~1150 tok)
- `261011-f9o-SUMMARY.md` — Phase quick-261011-f9o Plan 01: Keep the Zellij modal at its full-list height while filtering Summary (~2594 tok)

## .planning/quick/261011-jbh-instant-first-frame-from-the-zsh-widget-/

- `261011-jbh-PLAN.md` (~12421 tok)
- `261011-jbh-SUMMARY.md` — Phase quick-261011-jbh Plan 01: Instant first frame from the zsh widget + bundled, compile-cached client Summary (~3744 tok)
- `COVERAGE.md` (~68 tok)
- `deferred-items.md` — Deferred items: quick 261011-jbh (~332 tok)

## .planning/quick/261011-jbh-instant-first-frame-from-the-zsh-widget-/red/

- `task1-red.json` — Declares and (~2677 tok)
- `task2-red.json` (~580 tok)

## .planning/quick/261012-kp1-rewrite-changelog-md-to-user-facing-feat/

- `261012-kp1-PLAN.md` (~912 tok)
- `261012-kp1-SUMMARY.md` — Summary: User-facing changelog (~182 tok)

## .planning/quick/261012-nlf-fix-t-09-1-14-wr-01-r2-in-src-providers-/

- `261012-nlf-PLAN.md` — Exports isNormalStopReason (~9338 tok)
- `261012-nlf-SUMMARY.md` — Phase quick-261012-nlf Plan 01: Fail closed on every non-normal stop reason Summary (~1583 tok)
- `COVERAGE.md` (~101 tok)

## .planning/quick/261017-4kt-update-the-readme-to-match-the-current-f/

- `261017-4kt-PLAN.md` — Code-grounded facts (observed by the planner on 2026-10-17; re-check each one against the cited code before writing it into the README) (~5812 tok)
- `261017-4kt-SUMMARY.md` — Phase quick-261017-4kt Plan 01: README refresh Summary (~1956 tok)
- `COVERAGE.md` (~46 tok)

## .planning/quick/261017-5q6-fix-the-stale-init-command-in-homebrew-y/

- `261017-5q6-PLAN.md` — Exports DEFAULT_MODEL (~6672 tok)
- `261017-5q6-SUMMARY.md` — Phase quick-261017-5q6 Plan 01: Fix the stale init command Summary (~1373 tok)
- `COVERAGE.md` (~64 tok)

## .planning/quick/261018-wax-prevent-ollama-and-openai-cut-off-answer/

- `261018-wax-PLAN.md` — Exports strictCandidateListWithoutProse (~9667 tok)
- `261018-wax-SUMMARY.md` — Phase quick-261018-wax Plan 01: Prevent Ollama and OpenAI cut-off answers Summary (~1859 tok)
- `COVERAGE.md` — API Coverage — Ollama /api/chat and OpenAI Chat Completions (quick 261018-wax) (~648 tok)

## .planning/quick/261021-sya-fix-changelog-links-leaking-x-access-tok/

- `261021-sya-PLAN.md` — Exports normalizeRepositoryUrl (~3906 tok)
- `261021-sya-SUMMARY.md` — Quick 261021-sya Plan 01: Fix Changelog Links Leaking x-access-token Summary (~928 tok)

## .planning/quick/261030-en8-add-badges-to-the-readme-for-all-the-pas/

- `261030-en8-PLAN.md` — /*.test.ts`. tsconfig includes tests. There is no YAML parser dependency, so extract `images:` with a regex. The distro CI legs test `git archive H... (~4947 tok)
- `261030-en8-SUMMARY.md` — Quick 261030-en8 Plan 01: README Badges Summary (~1201 tok)

## .planning/quick/261030-fdr-reformat-the-readme-minimal-move-the-res/

- `261030-fdr-PLAN.md` — Now:** pitch, the demo gif, `## Install`, `## Choose a provider`, `## Usage`, `## More`. (~8699 tok)
- `261030-fdr-SUMMARY.md` — Quick 261030-fdr Plan 01: Minimal README with docs split Summary (~1193 tok)
- `check-readme-moved.mjs` — One-off preservation check for quick task 261030-fdr: every line of the README at b45f6db (~598 tok)

## .planning/quick/261030-tq3-restart-outdated-daemon-and-report-a-dae/

- `261030-tq3-PLAN.md` — Declares DaemonOptions (~9128 tok)
- `261030-tq3-SUMMARY.md` — Quick 261030-tq3 Plan 01: Restart an outdated daemon and report a daemon that does not answer — Summary (~1830 tok)

## .planning/quick/261105-ix8-add-a-weekly-homebrew-tap-clone-stats-wo/

- `261105-ix8-PLAN.md` — Declares and (~8387 tok)
- `261105-ix8-SUMMARY.md` — Quick 261105-ix8: Weekly Homebrew tap clone stats Summary (~2094 tok)
- `verify-tap-clone-stats.sh` — Offline harness for .github/workflows/tap-clone-stats.yml (quick 261105-ix8). (~4470 tok)

## .planning/quick/261115-3qz-readme-support-matrix-shell-and-os-badge/

- `261115-3qz-PLAN.md` (~5467 tok)
- `261115-3qz-SUMMARY.md` — Phase quick-261115-3qz Plan 01: README support matrix Summary (~1145 tok)

## .planning/quick/261115-4um-readme-remove-workflow-badges-and-suppor/

- `261115-4um-PLAN.md` — Declares body (~4309 tok)
- `261115-4um-SUMMARY.md` — Phase quick-261115-4um Plan 01: Remove README workflow badges and support table Summary (~1173 tok)

## .planning/quick/261117-jpp-implement-update-notifier-per-planning-t/

- `261117-jpp-PLAN.md` (~13982 tok)
- `261117-jpp-SUMMARY.md` — Phase quick-261117-jpp Plan 01: Update Notifier Summary (~3509 tok)

## .planning/quick/261118-v58-nightly-live-cli-job-real-claude-code-cl/

- `261118-v58-PLAN.md` — Declares ContextEnvelope (~7345 tok)
## .planning/quick/261118-ubg-speed-up-and-harden-the-release-workflow/

- `261118-ubg-PLAN.md` — Declares there (~8174 tok)

## .planning/research/

- `ARCHITECTURE.md` — Architecture Research: QueQue (~667 tok)
- `FEATURES.md` — Features Research: QueQue (~558 tok)
- `PITFALLS.md` — Pitfalls Research: QueQue (~736 tok)
- `STACK.md` — Stack Research: QueQue (~870 tok)
- `SUMMARY.md` — Research Summary: QueQue (~335 tok)

## .planning/spikes/

- `CONVENTIONS.md` — Spike Conventions (~596 tok)
- `MANIFEST.md` — Spike Manifest (~1106 tok)
- `WRAP-UP-SUMMARY.md` — Spike Wrap-Up Summary (~922 tok)

## .planning/spikes/001-zsh-commands-handoff/

- `bench.zsh` — Spike 001 — cost and freshness of handing zsh's $commands table to the qq client. (~652 tok)
- `README.md` — Project documentation (~1071 tok)
- `rehash-cost.zsh` — Spike 001b — what does "rehash then hand off" cost on every ?? (widget-side work). (~484 tok)

## .planning/spikes/002-candidate-binary-check/

- `.gitignore` — Git ignore rules (~4 tok)
- `cases.mjs` — Expected = every program the shell would look up, in order. Wrappers (sudo, xargs…) count too. (~988 tok)
- `extract.mjs` — Index just past the `close` that balances the `open` at s[i]. Respects quotes and escapes. (~2664 tok)
- `find-hang.mjs` — Spike 002 — isolate inputs that hang lexHand: each runs in a child with a 1 s timeout. (~252 tok)
- `fuzz-child.mjs` — Declares alphabet (~188 tok)
- `package-lock.json` — npm lock file (~309 tok)
- `package.json` — Node.js package manifest (~33 tok)
- `README.md` — Project documentation (~1281 tok)
- `run.mjs` — Spike 002 runner: accuracy of hand lexer vs shell-quote, plus per-candidate cost and (~730 tok)

## .planning/spikes/003-prompt-steering/

- `.gitignore` — Git ignore rules (~11 tok)
- `catalog.ts` — Curated catalog of notable CLI tools that have common alternatives. Variant B sends only (~440 tok)
- `compare.ts` — Spike 003 — does telling the model which tools are installed help, and what does it cost? (~1778 tok)
- `README.md` — Project documentation (~1195 tok)

## .planning/spikes/003-prompt-steering/out/

- `compare.js` — .planning/spikes/003-prompt-steering/compare.ts (~6622 tok)
- `compare.js.map` — \n * Returns a reused Anthropic SDK client for this process.\n *\n * The constructor is the keep-alive / TLS boundary. Creating a new client on\n *... (~14046 tok)

## .planning/spikes/003-prompt-steering/results/

- `run-1-partial.log` — Declares f (~4424 tok)
- `run-from-6.raw.json` (~4090 tok)

## scripts/

- `docker-homebrew-smoke-runner.sh` — In-container half of the Homebrew smoke: writes the fake `claude` shim (exit 21 when the fixture is not mounted), `qq init zsh`, expect waits for `tldr z3` then the `QQSMOKE# tldr z3  # ` buffer redraw (exits 10-14, 20). (~1000 tok)
- `smoke-homebrew-docker.sh` — Key-free Homebrew-shaped install smoke: heredoc Dockerfile on the .nvmrc Node major (version-stripped manifest stage, npm install before src/shell, runner copied last), formula-emulation RUN, fake claude mounted read-only at /opt/fake; `--no-cache`, QQ_SMOKE_DOCKER_CACHE=gha selects buildx + gha cache. (~1700 tok)

## src/

- `env.d.ts` — Declares the build defines __QUEQUE_COMMIT__, __QUEQUE_VERSION__, __QUEQUE_TELEMETRY_KEY__ and __QUEQUE_TELEMETRY_HOST__ (10-04), plus __QUEQUE_BUILD_ID__ (quick 261030-tq3). (~55 tok)

## src/cli/

- `launcher.ts` — CLI launcher built as dist/cli/main.js (quick 261011-jbh, LD-2): Node built-ins only; enables the module compile cache in `${XDG_CACHE_HOME:-~/.cache}/queque/node-compile-cache` (0700; queque parent + leaf lstat-checked: real dir, owned by getuid, no group/world write; skipped when NODE_COMPILE_CACHE / NODE_DISABLE_COMPILE_CACHE is set; silent on failure), then imports `new URL('./app.js', import.meta.url)` and awaits `main()`. (~955 tok)
- `main.ts` — Exports main (~1586 tok)

## src/cli/commands/

- `client.ts` — Real client command handler. resolveResultMode: the flag wins; QQ_TEST_RESULT_MODE counts only for cancel / replace-buffer-fixture, anything else is ignored (WR-05). (~394 tok)
- `daemon.ts` — Daemon command handler: `--ensure` path or `startDaemonServer`; `enablePrewarm()` after the server starts (daemon-only, never at module top level or in `--ensure`); exported `trackConnections(server)` (Set of open sockets via `connection`) and `shutdownDaemon(server, connections, {exit, graceMs})` (WR-03: `disablePrewarm()` so an in-flight refill spawns nothing, destroys open sockets so their turns abort, then exits after `SIGKILL_GRACE_MS`+100 when any were in flight); SIGTERM/SIGINT call it (09.1-05). Phase 10: creates and starts the telemetry buffer; shutdownDaemon flushes it synchronously with a 1 s bound (10-06). Quick 261030-tq3: `--restart` (wins over --ensure) calls restartDaemon at call time, prints `daemon restarted`; errors reach main.ts's catch. (~600 tok)
- `doctor.ts` — `qq doctor [--json] [--shell <name>]` (Phase 11 11-08: one target shell per report, registry-driven; 12 rows for zsh and Linux bash, 13 with `bash_profile` on macOS bash; DoctorDeps.shellVersion/shellBindings/readRc/userShell, `BASH_BINDINGS_SCRIPT`, `parseBashBindings`, `resolveDoctorShell`, `runDoctorChecks(deps?, {shell?})`). Pre-phase-11 notes: injectable DoctorDeps (defaultDoctorDeps spawns zsh -fc / zsh -ic with stdin ignored, resolving on exit + grace; PATH scan; /tmp mkdtemp probe; lstat owner; pingDaemonFetchCap; loadProviderPin; detectProvider; telemetryStatus), runDoctorChecks (12 checks, D-17/D-19/D-20: jq and zsh < 5.0 fail, zsh 5.0-5.7 warn; `telemetry` last, always ok), parseZshBindings, formatDoctorReport (✓/⚠/✗ + ` — fix:`), doctorCommand (sets process.exitCode). Output is fixed copy only: it goes into public revert PR bodies (10-03, 10-09). (~4749 tok)
- `init-provider.ts` — `qq init provider` picker on /dev/tty (Claude, OpenAI, Ollama; Enter = 1). writeProviderPin then restartDaemon; dead ends print next step and exit 1. Exports PROVIDER_MENU, OLLAMA_DOWNLOAD_URL, runProviderPicker(io, deps), providerInitCommand, dispatchInit. (~2900 tok)
- `init.ts` — `qq init [shell]` (Phase 11 11-04): auto-detects the shell (arg, $SHELL, user shell) via src/shared/shell-registry.ts; bash gate probes the $SHELL bash first, else the PATH bash, refusing below 5.0 (`bash 5+ needed: brew install bash` on darwin); appends the marker + `source <adapter>` to ~/.zshrc or ~/.bashrc only (never ~/.bash_profile); macOS login-shell hint when ~/.bash_profile does not source ~/.bashrc. Exports InitDeps, defaultInitDeps, runInit(shellArg, deps), initCommand, hasShellIntegration. hasShellIntegration needs an active (uncommented) source line; the marker alone no longer counts (WR-06). (~2300 tok)
- `telemetry.ts` — `qq telemetry [status|on|off|show]` (D-06, D-09, D-12, D-22): injectable TelemetryCliDeps, requestDaemonOnce(socketPath, request, timeoutMs=500) (one-shot, schema-validated, null on error/close/timeout), telemetryCommand(action, deps). Prints state, variable names and the endpoint host only; show prints the daemon bodies byte for byte; off also sends telemetry-reset (10-09). Quick 261030-tq3: `socketConnectable` dep (tryConnect, read at call time) is probed only after a null reply; a connectable socket prints `the daemon did not answer (it may be outdated)` + `restart it: qq daemon --restart` (show and off); a wrong-kind reply also gets the restart hint. (~2400 tok)

## src/client/

- `instant-frame.ts` — Instant first frame takeover (quick 261011-jbh, LD-1): SAVE_CURSOR/RESTORE_CURSOR/ERASE_BELOW/CURSOR_HOME/SYNC_UPDATE_BEGIN, INLINE_SURFACE_CLEAR (ESC 8 + CSI J on the client's own save), PANE_SURFACE_CLEAR (CSI H + CSI J), `inlineScrollReserve(lines)` (byte-identical to the widget's reserve), `armInstantFrameTakeover(stream, clear)` → `{ clearNow }` (inserts the clear into the first visible write, after a leading `CSI ?2026 h`). (~1291 tok)
- `result-writer.ts` — Validates a ShellResult and writes newline-terminated JSON to `resultFile`. (~307 tok)
- `run-foreground.ts` — Splits a command + explanation into shell buffer halves. (~6967 tok)
- `telemetry-consent.ts` — D-09 one-time consent ask: CONSENT_PROMPT (`... [y/N] `), CONSENT_TIMEOUT_MS = 30_000, shouldAskTelemetryConsent({outcome, state, blockedBy, hasTty}) (accepted, never asked, no env gate, tty), askTelemetryConsent({input, output}, timeoutMs) on the tty streams: raw mode, first character of the first chunk, only y/Y is yes, settles once, then raw off, pause, listener removed, timer cleared, every wrapped row erased. Never stdout, never rejects (10-11). (~1135 tok)
- `telemetry-events.ts` — Client telemetry: TELEMETRY_CLIENT_SEND_MS = 250, QueryOutcomeRecord, buildQueryOutcomeEvent/buildErrorEvent/buildEnvironmentEvent (strict-schema parsed, enums and counts only), sendTelemetryEvents (fire-and-forget socket lines, never rejects), reportClientTelemetry (gates on effectiveTelemetry in the client env first; environment, errors, outcome; never throws) (10-10). (~1482 tok)
- `tool-handoff.ts` — readToolHandoff(sessionDir, { shell, pendingBudgetMs }) waits while `tools.pending` exists (TOOL_HANDOFF_PENDING_POLL_MS 10, TOOL_HANDOFF_PENDING_BUDGET_MS 500, then null with reason `pending-timeout`) and tags the inventory with `shell` (11-03). Earlier: reads commands/builtins/functions.txt into a ToolInventory or null (QQ_TOOL_AWARENESS=0, missing, empty); counts-only logs; TOOL_HANDOFF_FILES (~735 tok)
- `zellij-pane-resize.ts` — Zellij floating-pane sizing: `readMaxZellijPaneHeight` (QQ_PANE_HEIGHT, default 24), `resolveZellijPaneHeight` (content + 2 frame rows `ZELLIJ_FLOATING_FRAME_LINES` + 1 Ink cursor row `INK_TRAILING_CURSOR_ROWS`, min 6, capped), `formatZellijPaneId`; `syncZellijFloatingPaneHeight` runs a serialized latest-wins queue: one `zellij action change-floating-pane-coordinates` at a time, heights requested meanwhile collapse to the newest, slot released on exit, on child error (no crash when zellij is missing) or after `RESIZE_SETTLE_TIMEOUT_MS` (2000, kills the hung action; timer unref'd); `resetZellijPaneHeightCache` (tests only). (~1900 tok)

## src/context/

- `pipeline.ts` — Exports gatherContext (~524 tok)

## src/contracts/

- `candidates.ts` — Zod schemas: commandCandidateSchema, candidateListSchema (~104 tok)
- `doctor.ts` — `qq doctor --json` contract (D-18; Phase 11 11-08 adds ids `bash`, `fish` (reserved, not emitted until Phase 12) and `bash_profile`): DOCTOR_CHECK_IDS (12, stable: add, never rename; `telemetry` last), DOCTOR_STATUSES ok/warn/fail, strict doctorReportSchema `{version:1, ok, qqVersion, platform, checks}`, doctorExitCode (1 iff a check failed) (10-03, 10-09). (~501 tok)
- `ipc.ts` — IPC request/response zod schemas: `fetch-candidates` with optional `stream: true`, streamed `{kind:'candidate'}` row kind, `{kind:'candidates'}` done signal; pong capability flags `fetchCandidates`, `installedTools`, `streamCandidates` (09.1-03). Phase 10: telemetry-event/telemetry-show/telemetry-reset requests, the telemetry-buffer response, the informational pong `telemetry` flag, fetch-error `errorKind` (10-06). Quick 261030-tq3: pong `build` = z.string().max(128).optional().catch(undefined) (malformed reads as another build, never a rejected pong). (~650 tok)
- `request.ts` — Intent/base-context/envelope schemas; `contextChunkSchema` incl. the lenient `installed-tools` variant (filters non-catalog names, rejects non-name strings and > 512 entries) and the client-side `strictInstalledToolsChunkSchema`. (~1500 tok)
- `shell.ts` — Shell request — sent from the shell adapter (zsh, bash) to the qq client. Phase 11 11-01: `SHELL_NAMES = ['zsh','bash','fish']`, `ShellName`, `isShellName`; `shellRequestSchema.shell` (default zsh) and `shellVersion` (max 40); `version: 1` unchanged. (~600 tok)
- `telemetry.ts` — Telemetry allow list (D-10, D-11): strict zod schemas for qq_query_outcome / qq_error / qq_environment (client, wire, batch) and the enums ERROR_KINDS, PROVIDER_KINDS, QUERY_OUTCOMES, OS_KINDS, ARCH_KINDS, DISTRO_IDS, TELEMETRY_EVENTS, TELEMETRY_LIB, TELEMETRY_BATCH_MAX. No latency, no free-form strings (10-04). (~1638 tok)

## src/daemon/

- `bootstrap.ts` — Ensures a current daemon: ping must advertise `fetchCandidates`, `installedTools` AND `streamCandidates` (else replace the stale listener; no reply = keep), spawn if needed (09.1-03). Phase 10 Defect 1: exports `parseLsofPidList` (strict: every line `^\d+$`, else [] and debug `lsof output ignored`), `listenerPids` and `replaceStaleListener`; never replaces a daemon for lacking the pong `telemetry` flag (10-01, 10-06). Quick 261030-tq3: pingDaemonFetchCap is 'yes' only when the four flags pass AND pong `build` === __QUEQUE_BUILD_ID__; an absent/other build logs `daemon build differs` and returns 'no', so ensureDaemon replaces it via replaceStaleListener (bug-473). (~2250 tok)
- `fetch-client.ts` — Asks the daemon for candidates; fails in 800ms without `fetch-accepted`; `requestDaemonFetch(…, timeoutMs?, options?)` sends `stream: true`, utf8-decodes, forwards `candidate` rows to `onCandidate`, treats socket `close` as IpcTransportError, rejects with abortError() on signal abort and destroys the socket; `fetchCandidatesForUi(…, options?)` never falls back in-process after an abort or after a row arrived (D-16) (09.1-01/03). Phase 10: re-tags fetch-error errorKind onto the thrown error; the in-process fallback tags pin_invalid (10-06). (~1590 tok)
- `server.ts` — Daemon Unix-socket server; pong `{fetchCandidates, installedTools, streamCandidates: true}`; socket `setEncoding('utf8')` so split multi-byte chars survive, 256 KB request cap measured in bytes (WR-01); drops lines failing ipcRequestSchema; runs `fetch-candidates` on the warm adapter inside a Promise chain with a per-connection AbortController (socket `close` aborts it; aborted fetches log `fetch aborted` and write nothing); streams `candidate` rows only for `stream: true` (`replied candidate`; rows after the client left are `candidate dropped`); final `candidates` is the done signal (09.1-01/03). Phase 10: telemetry-event/show/reset cases; fetch-error carries errorKind (pin_invalid for resolution throws) (10-06). Quick 261030-tq3: pong also carries `build: __QUEQUE_BUILD_ID__`. (~1840 tok)
- `telemetry-buffer.ts` — Daemon telemetry buffer (D-07, D-12, D-22): createTelemetryBuffer(deps) → { enqueue, flush, snapshot, reset, start, stop }, sendBatch(host, body, fetchImpl); TELEMETRY_FLUSH_INTERVAL_MS 60000, _THRESHOLD 20, _BUFFER_CAP 100, _SEND_TIMEOUT_MS 3000, _SHUTDOWN_WAIT_MS 1000. Gate re-read at enqueue/snapshot/flush, one shared serializer (show is byte-exact), one POST in flight, memory only, drop on failure (10-06). (~2448 tok)

## src/providers/

- `candidate-stream.ts` — Incremental JSON-array candidate scanner for streamed text deltas (09.1-02): `createCandidateScanner(onCandidate)` changes no state before the first `[`, tracks depth, strings and escapes, emits only commandCandidateSchema-valid objects that close at depth 2, stops at the array close or after `MAX_STREAMED_CANDIDATES` (5); `parseStrictCandidateList(text)` accepts a fenced or bare array of 1-5 candidates, else undefined. Used by the CLI and SDK paths. (~900 tok)
- `claude-cli.ts` — `CLAUDE_COMMAND`, `buildClaudeCliArgv(envelope)` (`-p --input-format stream-json --output-format stream-json --verbose --include-partial-messages --effort <resolveEffort()> --safe-mode --tools '' --no-session-persistence --system-prompt buildSystemPrompt(envelope)`; no prompt, no `--model`, never bare); `fetchClaudeCliCandidates(envelope, budget, options)` builds a per-query `PrewarmSpec`, `takePrewarmed` before the turn (`prewarm hit` / `prewarm miss {reason}`) and `schedulePrewarm` in `finally`; one cold retry (`prewarm retry cold`) only for a warm `exit-without-result` with no streamed rows; runs `runClaudeTurn` with the prompt on stdin and `signal`; with `onCandidate`, text deltas feed `createCandidateScanner` and rows pass on only while the signal is live (`cli first candidate` once); final list = strict parse, then streamed rows, then `parseCandidates`; logs `cli spawned|init|first delta|first candidate|result|exit|aborted|timed out` with `ms` and `warm` (09.1-01/02/05). WR-02: warm turns get `warmInitDeadlineMs(spawnedAt)` (`WARM_INIT_DEADLINE_MS` 1500 + rest of `PREWARM_BOOT_ALLOWANCE_MS` 3000 for a young child) and `stale-prewarm` is retried cold too; a stall after `init` is still a timeout. WR-01-r2: the final list is `finalCandidateList(text, streamed, finishedNormally, { stopReason })`; a `truncated` runner failure (`isTruncatedFailure`, caught around both attempts, never retried cold) feeds its stdout with finishedNormally false, so only strict/streamed/closed rows or TRUNCATED_RESPONSE_MESSAGE, never the prose fallback (~2050 tok)
- `claude-default.ts` — SDK-first when a usable API key exists, otherwise `claude -p` for `/login`; forwards FetchOptions to the CLI path; an AbortError is logged `claude-cli aborted` and re-thrown unmapped (09.1-01); the SDK branch passes `options` (`remainingMs(deadline), options`) as a direct return outside the CLI try/catch, so an SDK AbortError is never mapped by hardError (09.1-04); WR-01-r2: hardError returns a TRUNCATED_RESPONSE_MESSAGE error unchanged before the ENOENT/timeout/D13 mapping, so `/login` users see the same truncation copy as the SDK path Phase 10: `lookupApiKey` exported; mapped errors are tagged with withErrorKind (10-06). (~1100 tok)
- `claude-exec.ts` — Old argv `execFileAsync` runner on `spawn`. Unused by src/ since 09.1-01 (kept with its test; removal deferred). (~1256 tok)
- `claude-prewarm.ts` — One-slot `claude -p` prewarm pool (09.1-05, D-11/D-12), disabled by default: `prewarmKey` (sha256 of `{command, cwd, argv}`), `enablePrewarm`, `disablePrewarm`, `schedulePrewarm(spec)` (refill after every settle; never at daemon start or take time), `takePrewarmed(spec)` (`{child}` or `{miss: disabled|empty|dead|cwd|prompt}`; one-shot `diedIdle` flag gives `dead`), `retirePrewarmed(graceMs?)`, `prewarmSnapshot`; exit/error handlers only clear the slot, never respawn; logs `prewarm spawned|retired|exit`. a hit is `{child, spawnedAt}` (WR-02); daemon shutdown uses `disablePrewarm` (WR-03) (~1760 tok)
- `claude-process.ts` — One `claude -p` stream-json turn on a child (09.1-01): `runClaudeTurn` (stdin user line + `stdin.end()`, settle on zod-validated `result`, is_error gate → `is-error` with result text as stdout, budget timer rejects at kill time with killed/SIGTERM, abort → abortError(), spawn-error, exit-without-result, invalid-result; stages spawned/init/first-delta/result/exit/aborted/timed-out), `spawnClaudeChild`, `terminateChild` (SIGTERM then SIGKILL after `SIGKILL_GRACE_MS` 1500); declares `POST_RESULT_BACKSTOP_MS`, `STDERR_CAP_BYTES` for plan 06. argv stays opaque here; 09.1-06: `ClaudeTurnOptions.backstopMs` (2000) and `killGraceMs` (1500); stdout carry overflow (1 MiB) kills the child and rejects `invalid-result`; stderr capped at `STDERR_CAP_BYTES` (64 KiB); every `result` event (incl. is_error/invalid) arms an unref'd backstop `terminateChild`, cleared on exit. 09.1-05: `ClaudeTurnOptions.child` runs a turn on a prewarmed child (no spawn, no `spawned` stage); exported `isRunning(child)`; review WR-02: `initDeadlineMs` option fails a turn with no `init` in time as `stale-prewarm` (stage `init-timed-out`, terminates the child, `killed: false`). Review WR-01-r2: a non-error `result` whose stop_reason is present and fails `isNormalStopReason` (null included) rejects as `truncated` (stdout = result text, `ClaudeTurnFailure.stopReason`, no `result` stage, backstop still armed); an absent key counts as end_turn (~3400 tok)
- `claude.ts` — Moved to steering.ts in Phase 9; re-exported so existing importers keep compiling. (~5476 tok)
- `detect.ts` — Returns whether Claude CLI auth appears present without reading secrets. (~811 tok)
- `error-kind.ts` — withErrorKind(error, kind) sets a non-enumerable errorKind; errorKindOf(error) returns the tag, else TRUNCATED → response_truncated, UNPARSEABLE → parse_failed, else unknown. Never maps message text (10-06). (~410 tok)
- `index.ts` (~86 tok)
- `ollama.ts` — Same budget as Claude: zsh reads the FIFO for 30s and the IPC client waits 26s. (~3793 tok)
- `openai.ts` — The only host an OpenAI key is ever sent to. A constant: never derived from the pin or (~4975 tok)
- `provider-kind.ts` — resolveProviderKind(deps?): openai/ollama from the pin; a claude pin or no pin is claude-sdk when lookupApiKey() finds a key, else claude-cli; an invalid pin or a throw is unknown. Injectable loadPin and hasApiKey (10-10). (~307 tok)
- `provider-pin.ts` — On-disk pin format version; bump it (with a reader migration) to reshape the file. (~2612 tok)
- `provider.ts` — Per-call options shared by every adapter (Phase 09.1). (~1416 tok)
- `resolver.ts` — Returns the Claude-default composite registered as `claude-cli`. (~352 tok)
- `steering.ts` — `QUEQUE_SYSTEM` (moved from claude.ts), `buildSteeringText(tools)` (catalog re-filter, dedupe, sort, 4 lines D-15/16/17), `buildSystemPrompt(envelope)` (filterContextEnvelope first; byte-identical without the chunk). (~700 tok)
- `stream-json.ts` — Pure stream-json helpers (09.1-01): `streamJsonResultSchema` (non-strict; is_error gate, subtype not a success signal), `createLineParser` (carry + newline split, non-JSON lines skipped), `textDeltaOf`, `isInitEvent`, `buildStreamJsonUserLine`, `STREAM_JSON_CARRY_CAP_BYTES` (enforced in plan 06); 09.1-06: `createLineParser(onEvent, { maxCarryBytes, onOverflow })` keeps a running UTF-8 byte count of the unfinished tail; past the cap (default 1 MiB) it calls onOverflow once, drops the tail and ignores later input; exports `LineParserOptions`. Review WR-01-r2: `streamJsonResultSchema.stop_reason` is `z.string().nullable().optional()` (2.1.285 records it; older builds and the auth result omit it) (~1100 tok)
- `structured-output.ts` — Output ceiling for the OpenAI request (`max_completion_tokens`, reasoning included): the (~1225 tok)

## src/registry/

- `bootstrap.ts` — Registers all Phase 2 built-ins into their respective registries. (~571 tok)
- `provider-backends.ts` — Registers a provider backend descriptor and its LLMAdapter instance. (~357 tok)

## src/shared/

- `command-words.ts` — Hand lexer (`lexHand`: quotes, escapes, `\`-newline continuations removed, heredoc bodies skipped up to the delimiter line, substitutions, redirs, placeholders, comments) + `commandWords` classifier (WRAPPERS with short+long value options, PRECOMMAND_OPTIONS for `exec`/`command`, quoted wrapper operands with whitespace recursed as command strings, explicit lookup-only mode for `command -v|-V` and LOOKUP_BUILTINS type/which/whence/where, reserved words, builtins) + safe `extractCommandWords` (Phase 9, D-03). (~4666 tok)
- `debug-log.ts` — Exports debugLogPath, appendDebugLog (~229 tok)
- `env-file.ts` — Returns a usable secret string, or undefined when the value is missing, empty, (~1050 tok)
- `environment-shape.ts` — collectEnvironmentShape(input?) maps platform/arch/os-release ID/QQ_ZSH_VERSION/node major/ZELLIJ onto the telemetry enums; an unknown ID becomes `other`; returns null if the shape would not validate. Injectable env, platform, arch, nodeVersion, readOsRelease (10-10). (~868 tok)
- `instant-frame-spec.ts` — D-04 instant-frame reference shared by every adapter (11-06): escape constants, `inlineScrollReserve`, `INSTANT_FRAME_VIEWPORT_LINES` (18), `INSTANT_FRAME_LOADING_TEXT`, `MODAL_MAX_COLUMNS`, `INSTANT_FRAME_SPEC`, and the oracle `instantFrameRows` / `inlineInstantFrameBytes` / `paneInstantFrameBytes`. Imports nothing from client or ui; src/client/instant-frame.ts re-exports from it. Change it together with both adapters (tests/instant-frame-parity.test.ts). (~1570 tok)
- `privacy-filter.ts` — Returns true when a file path segment should not be sent to providers or logs. (~717 tok)
- `qq-config.ts` — Built-in sensitive path patterns — always applied; user config adds more. Phase 10: also exports telemetryConfigSchema (`telemetry: { enabled, asked, installId? }`) (10-04). (~1899 tok)
- `shell-registry.ts` — One per-shell registry (Phase 11 D-02/D-08, 11-04; `src/shared/shell-registry.ts`): `ShellSpec`, `SHELL_SPECS` (zsh, bash; fish not shipped), `getShellSpec`, `shippedShellNames()`, `detectShell(input)`, `resolveAdapterPath(spec)` (Homebrew `share/queque/<adapter>` first, else the package `shell/` dir next to dist), `HOMEBREW_PREFIXES`, the zsh/bash floors (`BASH_FAIL_BELOW = '5.0'`, `BASH_WARN_BELOW = '5.1'`), `parseShellVersion`/`versionBelow`, `BASH_LOGIN_FILES`, `BASHRC_SOURCE_RE`, `loginFileSourcesBashrc`. Every fact `qq init` and `qq doctor` need about a shell. stripShellComments() (per-line, quote-aware); loginFileSourcesBashrc ignores commented lines (WR-06). (~1900 tok)
- `socket-path.ts` — Returns the Unix socket path for the qq daemon for a given UID. (~352 tok)
- `telemetry-config.ts` — Anonymous telemetry consent state (phase 10, D-06, D-09). (~2510 tok)
- `telemetry-endpoint.ts` — resolveTelemetryEndpoint(env): baked host/key with usableSecret QQ_TELEMETRY_HOST/QQ_TELEMETRY_KEY overrides; null for an empty or non-phc_ key, a non-http(s) host, or a host with credentials (10-04). (~407 tok)
- `tool-awareness.ts` — ToolInventory, isInstalled (commands|functions+aliases), missingTools, installer choice (`pickInstaller`, `INSTALL_COMMANDS`, `LINUX_INSTALLER_ORDER`), per-installer `PACKAGE_ALIASES` (brew/apt/dnf/pacman maps; null = no package installs that binary) + `packageFor(tool, installer)` (Homebrew-aliased tools with no Linux entry are null, never guessed), `SAFE_PACKAGE_NAME_RE`, `buildInstallForm`/`planInstall` (brace-wraps lists, blocks unsafe words/unknown packages/comments/heredocs); `annotateCandidates(…, platform)` attaches `install` to flagged candidates. (~2000 tok)
- `tool-catalog.ts` — Shipped 196-name allow list of notable CLI tools (spike 003 seed, frozen), `CATALOG_SET`, `installedCatalogTools(isInstalled)` (sorted in Node), shape constants `TOOL_NAME_RE` / `TOOL_NAME_MAX_LENGTH` (64) / `INSTALLED_TOOLS_MAX` (512). Zero imports. (~1000 tok)

## src/shims/

- `optional-native-module.ts` — Throws on load; tsup aliases ws's optional native add-ons (`bufferutil`, `utf-8-validate`) to it so ws keeps its not-installed fallback and the bundle resolves nothing from node_modules at runtime. (~203 tok)
- `react-devtools-core.ts` — No-op `{ initialize, connectToDevTools }` default export; tsup alias target for ink's hoisted devtools import (keeping it external crashed the bundle with ERR_MODULE_NOT_FOUND). (~163 tok)

## src/ui/

- `CandidateSelect.tsx` — Candidate list; Tab/Shift+Tab toggles a flagged row to its install form (third useState: Set of `candidateKey`s). The query state starts empty (G-09.1-5): `initialQuery` (the lbuffer) is header-only (`queque ›` row + layout estimator) and arrival never writes the query. Candidate-arrival reset (selection, toggles) runs during render via `prevCandidates` (fourth useState), so no effect sees a stale render (G-09-7). Enter inserts the displayed text; the search filter matches the displayed text (install form when toggled) and hidden rows keep their toggle; flagged rows start their explanation with cyan ⓘ; selection-independent legend (`ⓘ not installed[ · tab prepends …]`) directly above ControlsLine; ControlsLine takes no props (tab chip removed). Zellij pane hold: a `paneHold` useRef `{ candidates, lines }` (not a fifth state) feeds `heldPaneLines` in the layout effect, so `onLayoutLinesChange` reports the held pane content rows (unfiltered size on arrival, never shrinks for the same candidates array, a new array resets) — filtering spawns no resize (quick-261011-f9o); 09.1-07: `listState` prop (default `'complete'`): reset only on the first arrival, later arrays keep the highlight by candidateKey and the toggles; spinner (`thinking…`) or `list may be incomplete` status row; no layout report while `'arriving'`; review WR-04 / G-09.1-5: no zero-match query clear on arrival, so text typed during `thinking…` is the whole filter and keeps filtering later rows; review WR-05: no `[query]` effect — typing and Backspace (non-empty query) reset the selection to 0 in the key handler, so the arrival branch keeps the index it chose; review WR-06: arrows are no-ops on an empty visible list and the later-arrival index is clamped to >= 0 (never NaN/-1); All key handlers (Backspace, typing, Tab, Enter, arrows) read one live `PendingInput` snapshot (query, selectedIndex, installToggled) tagged with a per-render `renderToken` and write it back through `applyInput` (value setters, each only on change), so keys in one stdin read compose (CR-01). (~4100 tok)
- `ControlsLine.tsx` — Keyboard hints below the candidate list; optional `tabHint` (`install` | `undo install`) chips between accept and cancel. (~300 tok)
- `LoadingSpinner.tsx` — FRAMES (~134 tok)
- `modal-layout.ts` — Wrapping/row layout; ⓘ `MISSING_TOOL_MARK`, `explanationText` (mark-prefixed explanation), `missingToolsLegend(visible)`, `candidateKey`, `displayedCommand`, `isInstallToggled`; `filterCandidates(list, query)` matches the command or the install form, regardless of the Tab toggle; `MODAL_VIEWPORT_LINES` (18: inline scroll reserve, row count documented); estimator counts the ⚠ footer and legend as separate margin+line blocks; `heldPaneLines(previousHeld, input)` = max(held, current estimate, unfiltered estimate with query '' + row 0 + current toggles): the Zellij pane's per-list high-water content height (quick-261011-f9o); 09.1-07: `CandidateListState` (`'arriving' | 'complete' | 'partial'`), `LIST_STATUS_ROW_LINES = 1`, `INCOMPLETE_LIST_NOTE`; `CandidateSelectLayoutInput.listState`; the estimator adds the status row for arriving and partial lists (~2660 tok)
- `Modal.tsx` — Modal (~223 tok)
- `SearchInput.tsx` — Live filter input for narrowing the candidate list. (~108 tok)

## tests/

- `auto-revert.test.ts` — 13 tests for scripts/ci/auto-revert.sh against temp repos (bare remote, merge commit) with the gh double on PATH; skips without bash (10-07). (~4620 tok)
- `bash-widget.test.ts` — Helper tests for the bash readline adapter (`shell/bash/queque.bash`, Phase 11 BASH-01). (~11378 tok)
- `bundle-startup.test.ts` — The usage line `qq --help` prints. (~2847 tok)
- `candidate-select-layout.test.tsx` — Real-hooks Ink render (no react/ink mocks; Writable/Readable 78x22 TTY fakes) checking CandidateSelect's layout reports and the Zellij resize spawn on candidate arrival; `mountArrival` (press/rerender/close helpers), `spawnedHeights`, `lastFrame`, and `replayScreen` (tiny terminal model of Ink's writes incl. ESC 7 / ESC 8 save/restore: header row, stale rows, scroll). (a) the lbuffer never filters (G-09.1-5: `noMatch` is the regression oracle); (d) a matching lbuffer `smt2` draws and reports the full list (G-09.1-5); (e) "header row" (plain, flagged, matching lbuffer; all draw query ''): pane PTY rows (height − 2 chrome) fit the drawn frame; (f) typing `smt` + 3 Backspaces keeps the pane at the arrival height; (g) a new candidates array resets the hold. `instant frame takeover` (quick 261011-jbh): t1-t5 replay the real widget bytes (spawnSync zsh) + reserve + armed real-Ink loading frame (inline full/cleared screen, Zellij pane file, 200-char lbuffer, no instant frame); t6 takeover unit cases; `mountStream` helper and the 09.1-07 streamed-rows describe (D-06 to D-10, D-16, D-17); G-09.1-5 Pitfall 9 rewrite (the lbuffer never filters streamed rows, FILTER shows the placeholder); WR-04 (lbuffer `gr`, typed `grep` survives a non-matching first row, never `grgrep`); WR-05 (a later list without the highlighted row keeps the highlight position; typing/Backspace move it to row 0); WR-06 (typed `grep`, up/down on an empty filtered list, then a matching row arrives highlighted); `filterLine` helper + the `G-09.1-5: FILTER opens empty` describe (UAT case `show me how to use z3` + typed `smt`, empty lbuffer, typed text equal to the lbuffer); CR-01 one-chunk Backspace describe (`ab`+2 DEL, `a`+DEL, mid-stream `smtx`+DEL / `q`+DEL, each ONE stdin push); CR-01 invariance `it.each` (Down+Enter, corrected filter+Enter, moved highlight+typed key, filtered Down+Enter, empty-filter Backspace, Down+Tab+DEL+Enter on a flagged row: one key per read vs one read insert the same row) (~13900 tok)
- `candidate-select.test.tsx` — Mocked-hooks CandidateSelect tests (useState by call order, useEffect stubbed, useRef a plain `{ current }` function for the pane hold): live search (initialQuery never filters, a typed query does), `G-09.1-5 FILTER opens empty` describe (query state '' whatever initialQuery is; supersedes 03.1 D-01/D-02), zero-match Enter guard via typed `zzz`, Tab install toggle, Enter/Esc, effect count (2; WR-05 moved the query reset into the key handlers). Cannot see effect ordering — use candidate-select-layout.test.tsx for that.; CR-01 same-closure case (typed text + Backspace on one handler closure); CR-01 same-closure Down+Enter (wrapping navigation) and Tab+Enter (Tab install form) cases (~6650 tok)
- `candidate-stream.test.ts` — Scanner tests at every split point of a recorded answer (with ⓘ), string-aware braces and escapes, json fence, wrapper prose before `[`, invalid-object skipping, the 5-row cap, strict-parse cases (09.1-02). (~1210 tok)
- `claude-cli-prewarm.test.ts` — Call-order tests for claude-cli warm/cold selection, refill in `finally` and the single cold retry, with the runner and pool mocked (09.1-05). WR-02: warm turn gets the init deadline, cold none; stale-prewarm retried cold; `warmInitDeadlineMs` boot allowance (~2640 tok)
- `claude-cli-provider.test.ts` — claudeDefaultAdapter with `runClaudeTurn` mocked (importOriginal spread): stream-json argv, prompt on stdin not argv, cwd/budget, signal forwarded, abort re-thrown unmapped, SDK-path cases, D13/ENOENT/timeout copy; `claude -p turn stage logs` describe (cli stage order filtered to `cli ` lines, FORBIDDEN_DEBUG); 09.1-02: file-level QQ_CONFIG_FILE mkdtemp isolation and `claude -p effort and streamed candidates` describe (effort argv, no `--model`, onCandidate order and abort, final-list precedence, first-candidate log); 09.1-04: AnthropicMock `stream` also records on `createMock`, SDK cases use `streamMock`, `SDK path streaming and abort` describe (~8750 tok)
- `claude-exec.test.ts` — Unmocked stdin-EOF child plus execFile stdio-ignore documentation (~386 tok)
- `claude-prewarm.test.ts` — Prewarm pool tests against real fixture children; a pass-through spy on `spawnClaudeChild` counts spawn attempts; `prewarm exit` debug lines give exit code and signal (hit, miss reasons, refill, retire, ignore-eof SIGKILL) (09.1-05). hit carries `spawnedAt` (WR-02) (~1870 tok)
- `claude-process.test.ts` — runClaudeTurn against real `fake-claude-stream.mjs` children: settles on result before exit, one stdin user line and no prompt in argv, SIGTERM abort drops later deltas and exit 143, is_error auth rejection; afterEach SIGKILLs recorded pids. Plans 05/06 extend it; 09.1-06 `runClaudeTurn failure paths` (timeout 143 with a 1000 ms budget, backstop SIGKILL, double settle, stdout-flood, exit-no-result, die-before-init, ENOENT, zero budget, pre-aborted signal, stderr cap); 09.1-05 prewarmed-child turns; WR-02 init deadline (hang-before-init → stale-prewarm + SIGTERM; never fires after init on sigterm-slow) (~3830 tok)
- `claude-provider.test.ts` — SDK adapter tests with a fake MessageStream (`text` listeners, `finalMessage`, APIUserAbortError on abort; `create` throws), debug-log mock, per-test QQ_CONFIG_FILE: `{ timeout, signal }`, onCandidate order, final-list precedence, abort, no thinking/sampling keys, effort/`output_config` and the `sdkOutputConfig` table (09.1-04). fake stream `stopReason`; WR-07 truncation cases (fail closed on fragment / empty text, keep closed rows) (~5500 tok)
- `claude-stream-json.test.ts` — Parser tests: chunk splits, split ⓘ through one StringDecoder, blank/non-JSON lines, maxCarryBytes/onOverflow (byte-counted, once, later input ignored), default 1 MiB cap, textDeltaOf, isInitEvent (09.1-06). (~1390 tok)
- `client-result.test.ts` — runForegroundClient result/FIFO/Zellij paths; Esc during loading (onCancel from the ink render mock) writes cancel, aborts the adapter signal, never rerenders; installed-tool awareness via the real `_qq_write_tool_handoff` (flags A-D, envelope carries sorted catalog ∩ installed incl. function `nvm`, no chunk ⇒ prompt === QUEQUE_SYSTEM); `inkMock.autoSelect` switch; streaming, partial-list and AbortError-after-Esc client tests (09.1-07) Phase 10: mocks ../src/client/telemetry-events.js (reportClientTelemetryMock); describe `runForegroundClient: telemetry outcome` (10-10); mocks telemetry-consent/telemetry-config with importOriginal spreads (real gates, fake prompt and config IO, default asked true) and describe `runForegroundClient: telemetry consent (D-09)` (call order unmount < ask < mark < report, env gates, write failure) (10-11). resolveResultMode (WR-05) cases. (~11100 tok)
- `code-changed.test.ts` — 8 tests spawning scripts/ci/code-changed.mjs in temp git repos (branch `topic`, no main): doc-only, src, workflow, deletion, zero base, unknown base, merge-base fallback, no git repo (10-05). (~1272 tok)
- `command-words-fuzz.test.ts` — spawnSync fuzz of the shipped lexer in child processes: 20k seed 1 (15 s kill), 5k seed 7 (10 s kill), 33 crafted malformed inputs (1 s kill each), deep 2000 < 100 ms (best of up to 3 runs, logged); 16 MiB maxBuffer; reports the last stderr input on failure. (~900 tok)
- `command-words.test.ts` — Spike 002 40-case table + 09-REVIEW regression table (zsh -f `${(k)builtins}` builtins), kind classification, D-06 install words, robustness (8193 chars, prototype keys, `"rg\`), frozen lexHand op/redir/comment token contract incl. heredoc-body and continuation tokens. (~1700 tok)
- `context-pipeline.test.ts` — Declares buildRequest (~1550 tok)
- `controls-line.test.tsx` — Calls `ControlsLine(props)` directly and flattens its element tree; asserts no tab chip without a hint, the exact chip order with `tabHint: 'install'`, and the `undo install` chip. (~500 tok)
- `daemon-bootstrap.test.ts` — ensureDaemon keep/replace/spawn cases incl. pongs lacking `fetchCandidates`, `installedTools` or `streamCandidates` (replace), all three (keep); server pong advertises three flags (09.1-03). (~2330 tok)
- `daemon-fetch.test.ts` — Real `startDaemonServer` fetch IPC: candidates, adapter errors, in-process fallback, installed-tools chunk accepted, catalog drift filtered (`qqfuturetool` dropped), malformed chunk ignored (not accepted < 2 s), abort after fetch-accepted reaches the adapter signal via socket close, no fallback after abort; request decoding (WR-01: request split inside a 3-byte char decodes intact; 270 KB/90k-unit request is refused); raw-socket and scripted-listener helpers; streaming (D-05/D-14: `candidate` rows only for `stream: true`, `candidate dropped` after close) and no-re-query-after-rows (D-16) cases (09.1-03); daemon shutdown (WR-03: in-flight fetch aborted and its refill spawns nothing; idle child retired, pool off, immediate exit) (~6504 tok)
- `debug-log.test.ts` — Declares appendFileMock (~484 tok)
- `docs-links.test.ts` — Offline link guard over README.md, CONTRIBUTING.md and docs/*.md: relative links and `#anchors` (GitHub slugs, code fences and spans skipped) must resolve; `https://github.com/k-leumas/queque/blob/main/` links map back to local files; README links must be absolute (except `assets/`) and must link every REQUIRED_DOCS page (INSTALL, PROVIDERS, USAGE, PRIVACY, CONFIGURATION.md) (quick 261030-fdr). (~1780 tok)
- `doctor.test.ts` — Doctor status/exit/JSON/formatter/command tests with a healthy-baseline fake DoctorDeps (one dependency overridden per case), telemetry row cases, canary and install-id no-leak tests, real read-only defaultDoctorDeps probes (10-03, 10-09). (~5601 tok)
- `env-file.test.ts` — root: projectWithEnvLocal, homeUnderPlantedFile (~1365 tok)
- `environment-shape.test.ts` — Enum mapping, zsh/node parsing, null on an out-of-bound node, no env value leaks (10-10). (~946 tok)
- `error-kind.test.ts` — withErrorKind/errorKindOf units; claude-default CLI/SDK mapping via importOriginal-spread mocks of claude.js and claude-cli.js; daemon fetch-error errorKind and pin_invalid; fetch-client re-tagging; the in-process fallback (10-06). (~2776 tok)
- `git-env-isolation.test.ts` — Phase 10 (10-12 drill): git exports GIT_DIR (and friends) into hook processes run from a (~730 tok)
- `homebrew-smoke-docker.test.ts` — Guards the Homebrew Docker smoke (no Anthropic key, fake claude wired, .dockerignore tracks every COPY source, buildx + gha cache gate, deps-first layer order) and release.yaml's job shape via jobBlock(): brew-smoke never skips, test has the apt cache, tag-and-changelog needs both. (~1400 tok)
- `init-command.test.ts` — Declares stub (~350 tok)
- `init-provider.test.ts` — 38 picker tests; restartDaemon/openUrl mocked, /dev/tty open throws, D-03/D-05 source guards. (~4600 tok)
- `instant-frame-parity.test.ts` — Cross-shell byte parity for the instant frame (Phase 11 D-04, quick 261011-jbh LD-1). (~3424 tok)
- `intent-router.test.ts` — Declares makeRequest (~2122 tok)
- `lsof-busybox.test.ts` — Defect 1 regression: parseLsofPidList cases, plus a fake busybox `lsof` on PATH (written and warmed once in beforeAll, sacrificial pid via QQ_FAKE_LSOF_PID) naming a `sleep 30` child that must survive replaceStaleListener; both replace tests assert the `lsof output ignored` log (10-01, bug-428). (~1170 tok)
- `main-direct-run.test.ts` — --------------------------------------------------------------------------- (~710 tok)
- `modal-layout.test.ts` — wrapText, filterCandidates, estimateCandidateSelectLines (flag rows, legend, install toggle), explanationText, missingToolsLegend, candidateKey; MODAL_VIEWPORT_LINES fits 3 two-line candidates + header + ⚠ footer + ⓘ legend (18); heldPaneLines (narrowing, a typed filter under the query header (G-09.1-5), ⚠ row then filter keeps height, grows past held, hidden toggled row counts, loading/error); streamed list status-row estimator tests (09.1-07) (~5030 tok)
- `ollama-provider.test.ts` — API routes: GET (1 endpoints) (~9463 tok)
- `openai-provider.test.ts` — The `reasoning_effort` of every request, in order (undefined when the key is absent). (~9647 tok)
- `prewarm-sleep.test.ts` — D-04 stale-prewarm simulation (folded 09.1 IN-03): real pool + real runner via a `claude` PATH shim that execs fake-claude-stream.mjs; wake (SIGSTOP+SIGCONT → hit), frozen + Date aged 60 s (hit → cli init timed out → prewarm retry cold, pid gone, new idle pid), SIGKILLed idle (miss dead); only Date faked (10-02). (~1903 tok)
- `privacy-filter.test.ts` — Returns the test config file path set in beforeEach. (~2471 tok)
- `provider-detect.test.ts` — --------------------------------------------------------------------------- (~3034 tok)
- `provider-pin.test.ts` — original: resetRegistries, writePin (~3837 tok)
- `provider-resolver.test.ts` — Declares resetRegistries (~774 tok)
- `qq-config.test.ts` — parsed: writeConfig (~1793 tok)
- `readme-badges.test.ts` — Offline drift guard for the README badge block (6 cases): distro badge alts equal the ci.yml `images:` array in order; distro badge shape (no label segment, LOGO_SLUGS logo, CI link); the `Tested on:\` line; exactly one macOS badge linking docs/INSTALL.md with a tested-by-hand alt while no workflow runs-on macOS; shell badges match SHELL_SPECS; absence guard for workflow-status badges and a `### Supported platforms` table (quick 261030-en8, 261115-3qz, 261115-4um). (~2300 tok)
- `registry-bootstrap.test.ts` — Declares hookIds (~689 tok)
- `registry.test.ts` — Declares makeContextProvider (~1515 tok)
- `semantic-release-user-notes.test.ts` — Declares repo; covers commit parsing, notes formatting, generateNotes (incl. CI credential URL) and normalizeRepositoryUrl cases (userinfo, git+, ssh, scp, trailing slash). (~3500 tok)
- `shell-contract.test.ts` — Declares validCancel (~804 tok)
- `shell-names-invariant.test.ts` — Every `SHELL_NAMES` entry appears in `shellRequestSchema`, `SHELL_SPECS`, `SHELL_KINDS` and `DOCTOR_CHECK_IDS`; shipped shells are exactly zsh and bash and their adapter files exist (Phase 11 D-02, 11-10). Phase 12 flips fish here. (~600 tok)
- `shell-pty.test.ts` — Real-PTY scenarios for zsh and bash (`PTY_SHELLS`) through tests/pty/drive.sh and a private tmux server: round-trip, cancel, empty, multibyte, vi-insert, paste, prompt-multiline, errexit (11-01), handoff-quiet, hostile-env (11-07). Builds the real bundle into a temp QQ_DEV_ROOT and uses QQ_TEST_RESULT_MODE fixture mode; diagnostics are single-line. (~4080 tok)
- `shell-registry.test.ts` — Unit tests for `src/shared/shell-registry.ts` (11-04): specs, detection, version parsing and floors, login-file sourcing, adapter path resolution. stripShellComments + commented login file cases (WR-06). (~1820 tok)
- `steering.test.ts` — Catalog, lenient/strict `installed-tools` schemas (incl. catalog drift), builder wording and byte-stability, `adapters` source guard over src/providers/ (rules a-d); adapters (b) model-call markers include `'messages.stream('` (09.1-04) (~2580 tok)
- `structured-output.test.ts` — ModelTurn: turn, timeout, fired (~1991 tok)
- `telemetry-buffer.test.ts` — Gating (CI, DO_NOT_TRACK, disabled, no id, null endpoint), byte-exact pending, fixed properties, environment dedupe, threshold, cap with an in-flight send, fake-timer interval with hasRef false, drop on failure, install-id filter, reset, count-only debug log (10-06). (~2913 tok)
- `telemetry-cli.test.ts` — qq telemetry status/on/off/show with a temp config and an injected daemon; invalid-JSON refusal keeps the bytes; unknown action; canary no-leak; requestDaemonOnce against real `/tmp/qq-tel-cli-*.sock` servers (10-09). (~3252 tok)
- `telemetry-config.test.ts` — Env gates, uncached read, atomic write modes, install id lifecycle (UUID v4, deleted on off), invalid-JSON refusal, qq-config leniency; temp QQ_CONFIG_FILE per test (10-04). (~2618 tok)
- `telemetry-consent.test.ts` — D-09 gate truth table (accepted/escaped/error/undefined, asked, each env gate, no tty) and the one-key prompt with an EventEmitter tty fake: y/Y yes; n, Enter, Esc, Ctrl-C, other keys no; first character only; settles once; 30 s fake-timer timeout; raw mode off, paused, no listener, timer cleared; wrapped-row erase; raw-mode refusal is a silent no (10-11). (~1534 tok)
- `telemetry-contract.test.ts` — Allow-list, forbidden-field, free-form-value, pinned-keys and no-timing (recursive schema walk) tests (10-04). (~3626 tok)
- `telemetry-endpoint.test.ts` — Endpoint resolution under the vitest defines (empty key, `http://127.0.0.1:9`): overrides, trimming, trailing slashes, rejected keys and hosts (10-04). (~642 tok)
- `telemetry-events.test.ts` — Provider kind, builders, client gate (no config, disabled, DO_NOT_TRACK, QQ_TELEMETRY=0, CI), sender timeout and real-server delivery, and the end-to-end leak test (`secret-token-xyz`, `/home/alice`, kubectl, ENOENT) (10-10). (~3877 tok)
- `telemetry-ipc.test.ts` — Telemetry IPC kinds against a real socket server, the telemetry pong flag, fetch-error errorKind parsing, and the shutdownDaemon flush order and 1 s bound (fake setTimeout) (10-06). (~2611 tok)
- `tool-awareness.test.ts` — Characterization tests for missing-tool semantics, installer choice, package aliases, install forms/wrapping/blocked plans and annotateCandidates (incl. CR-02: no install form for a wrapper option value such as `sudo --user root`). (~3573 tok)
- `tool-handoff.test.ts` — readToolHandoff — reads the zsh-written session-dir handoff into a ToolInventory. (~1431 tok)
- `zellij-pane-resize.test.ts` — argv, height cap, trailing cursor row mapping (QQ_PANE_HEIGHT=24: 15→18, 21→24, 22→24, min 6), pane-id format, dedupe, outside-Zellij no-op; fake Zellij applies heights in completion order: slower stale action lands last, coalescing to the newest, equal-height drop, ENOENT error release, RESIZE_SETTLE_TIMEOUT_MS kill release, every child unref'd. (~1900 tok)
- `zsh-widget.test.ts` — Smoke tests for the zsh ZLE widget (`shell/zsh/queque.zsh`). (~14186 tok)

## tests/fixtures/

- `command-words-cases.ts` — `COMMAND_WORD_CASES` / `CommandWordCase`: the 40 spike 002 cases verbatim (`stretch` is a label, not an opt-out); `REVIEW_CASES`: 09-REVIEW regression commands (heredocs, continuations, wrapper options) with their expected externals. (~900 tok)
- `command-words-fuzz-child.mjs` — Fuzz child that imports `src/shared/command-words.ts` via Node 24 type stripping; modes `fuzz <count> [seed]` (mulberry32), `one <input>`, `deep <n>`; exit 0 ok / 2 slow / 3 undefined leak / 64 unknown mode. (~800 tok)
- `fake-claude-stream.mjs` — Real-child fake of `claude -p` stream-json (Claude Code 2.1.285 shapes, Probes 2/3/5/8); scenario = argv[2]: `success` (deltas 20 ms apart, ⓘ bytes split across two writes, result then exit 0 after 300 ms), `auth` (is_error result, subtype success, exit 1), `sigterm-slow` (deltas every 100 ms, on SIGTERM keeps writing 300 ms then exit 143); silent until the first stdin line, EOF with no line = exit 0; `FAKE_CLAUDE_STDIN_FILE`, `FAKE_CLAUDE_ARGV_FILE`. Plans 05/06 add scenarios to `SCENARIOS`; 09.1-06 adds `hang-after-result` (ignores SIGTERM, never exits), `exit-no-result`, `die-before-init`, `stderr-flood` (200 KB), `stdout-flood` (1.2 MiB, no newline) and `writeSuccessTurn`/`writeFlushed`/`waitForSignal`; 09.1-05 adds `ignore-eof` (ignores EOF and SIGTERM, only SIGKILL ends it); review WR-02 adds `hang-before-init` (reads the line, never writes init, default SIGTERM); review WR-01-r2 adds `writeStopReasonTurn(text, stopReason)` and `refusal`, `null-stop-reason` (fragment `[{"command": "find . -name`), `stop-sequence`, `no-stop-reason` (SUCCESS_ANSWER) (~2700 tok)

## tests/fixtures/auto-revert/

- `gh` — gh CLI test double for tests/auto-revert.test.ts: logs argv as JSON lines to $GH_LOG (per-argument `jq -Rs .`), serves jobs-ID.json, sha-runs-SHA.json, branch-runs.json and pr-list.txt from $GH_FIXTURES, copies --body-file to $GH_LOG.body (10-07). (~617 tok)

## tests/helpers/

- `shells.ts` — `findShell(name, { min })` (QQ_TEST_BASH / QQ_TEST_ZSH, then PATH, Homebrew (Apple silicon, Intel), MacPorts, system dirs), `findBinary(name)`, `ciRequired(value, label)` (warns locally, throws `is required when CI is set` under CI), `shellVersionOf` (11-01), `NO_TTY` spawnSync spread (detached: no controlling tty for `bash -i`). (~1150 tok)

## tests/live/

- `cli-contract.live.ts` — Nightly `live-cli` contract test against the real `claude` (quick 261118-v58): socket `/tmp/qq-live-cli-PID.sock`; beforeAll throws (never skips) without ANTHROPIC_API_KEY, without `claude --version` on PATH (hint `npm i -g @anthropic-ai/claude-code`) or without dist; daemon env drops ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / CLAUDE_CODE_OAUTH_TOKEN so qq takes `claude -p`, and claude authenticates through a temp-HOME `.claude/settings.json` apiKeyHelper `printenv LIVE_CLAUDE_CLI_API_KEY` (key never on disk); cold turn (`cli result`, no `sdk path`) then prewarmed turn (`prewarm hit`); CLI_FAILURE_LINES include `claude-cli path`, `cli timed out`, `cli init timed out`, `prewarm retry cold`, `prewarm spawn failed`, `prewarm error`, `response truncated` (~1500 tok)
- `live-daemon.ts` — Shared live harness (not collected by either config): startLiveDaemon({ socketPath, env overrides where undefined deletes, prepareHome }) under a temp HOME with cleanup on failure, stopLiveDaemon, fetchLive, buildEnvelope, readDebugLog, settledDebugLog(file, marker, fromOffset), expectLiveContract (schemas + ceilings), LIVE_FIRST_CANDIDATE_MS 15000 / LIVE_FINAL_MS 25000, mainJs (~2700 tok)
- `sdk-contract.live.ts` — Nightly live SDK contract test, built on live-daemon.ts; the `live` job runs only this file: built daemon on `/tmp/qq-live-PID.sock` with a temp HOME, one streamed fetch-candidates; expectLiveContract, then `sdk path` and no `request failed`/`response truncated`; fails in beforeAll without the key (10-08, quick 261118-v58). (~700 tok)

## tests/pty/

- `drive.sh` — `tests/pty/drive.sh start|type|key|paste|wait|capture|stop SERVER …`: drives an interactive zsh or bash (`QQ_PTY_SHELL_BIN`) in a private tmux server (`-L`, `-f /dev/null`); bash 3.2-safe; strips ZELLIJ* and TMUX so it never opens a pane in the user's session (Phase 11 D-10, 11-01). (~750 tok)

## tests/setup/

- `scrub-git-env.ts` — git exports these into hook processes (lefthook's pre-push runs this suite), most visibly (~292 tok)
