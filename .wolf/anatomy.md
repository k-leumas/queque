# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-11-18T01:06:52.195Z
> Files: 522 tracked | Anatomy hits: 0 | Misses: 0

## ./

- `.DS_Store` (~2186 tok)
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
- `README.md` — Project documentation (~1207 tok)
- `renovate.json` (~31 tok)
- `tsconfig.json` — TypeScript configuration (~187 tok)
- `tsup.config.ts` — Declares version (~904 tok)
- `vitest.config.ts` — Vitest test configuration (~299 tok)
- `vitest.live.config.ts` — /*.test.ts`) never (~260 tok)

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

## .github/workflows/

- `ci.yml` — Push and PR CI (D-14). Runs on every branch push, every pull_request and on demand. (~1850 tok)
- `distro.yml` — Reusable distro matrices (D-14, D-16). Called by ci.yml with the PR image pins and by (~626 tok)
- `homebrew.yml` — CI: Update Homebrew Tap (~1144 tok)
- `nightly.yml` — Nightly safety net (phase 10, D-01 to D-03). Provider or distro drift shows up within a day (~570 tok)
- `release.yaml` — CI: Release (~2090 tok)
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
- `STATE.md` — Project State (~5040 tok)

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

## src/shared/

- `instant-frame-spec.ts` — The instant first frame, as one TypeScript reference (Phase 11 D-04; quick 261011-jbh, LD-1). (~1808 tok)
