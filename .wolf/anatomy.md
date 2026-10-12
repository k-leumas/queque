# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-10-12T06:51:48.630Z
> Files: 463 tracked | Anatomy hits: 0 | Misses: 0

## ../../

- `.zshrc` — Declares d (~4862 tok)

## ../../../../private/tmp/claude-501/-Users-samuel-dev-tui-llm/1dec13a7-8fe5-4a46-95ee-c3eab55e9197/scratchpad/

- `wolf.py` — Small helpers for .wolf bookkeeping: anatomy descriptions, memory lines, buglog entries. (~676 tok)

## ../../../../private/tmp/claude-501/-Users-samuel-dev-tui-llm/53463c49-1a58-49e3-96b6-bef08880d887/scratchpad/

- `build-envelope.mjs` — Builds the same ContextEnvelope a real `??` sends for `show me how to use z3` (~400 tok)
- `cli-probe.mjs` — Spawns `claude -p` with QueQue's exact argv (src/providers/claude-cli.ts) except the output (~987 tok)
- `e2e-tmux.py` — End-to-end `??` timing through the REAL zsh widget + client + live daemon (claude -p path). (~692 tok)
- `ipc-fetch.mjs` — Sends the real `fetch-candidates` IPC (same frame as src/daemon/fetch-client.ts) to a daemon (~726 tok)
- `p91-raw.mjs` — Phase 09.1 research probe: spawn /usr/local/bin/claude with arbitrary args, optionally write a (~747 tok)
- `p91-sum.mjs` — Summarize p91-raw dumps: stage times relative to spawn (cold) or stdin write (warm). (~640 tok)
- `prespawn-probe.mjs` — Measures a PRE-SPAWNED `claude -p` (what a daemon-side warm process would look like): (~907 tok)

## ../../../../private/tmp/claude-501/-Users-samuel-dev-tui-llm/6df9b051-6b36-4cc3-b54a-ab10fd3c4c5d/scratchpad/

- `gap-section.md` — Gap-Closure Review: Plan 09-06 (~2914 tok)

## ../../../../tmp/gsd-0911-rev.YNlKgV/

- `artifacts-table.md` (~1498 tok)
- `crosscheck.py` — ancestors (~1039 tok)
- `plan03-task2.md` (~791 tok)
- `splice_tasks.py` — Replace the task blocks of a plan from the <task ...> whose <name> starts with a (~161 tok)
- `splice.py` — Replace the "## Artifacts this phase produces" section (heading up to <tasks>) (~228 tok)

## ../../../../tmp/sv-03-reviewfix-9wn1wS/.planning/phases/03-claude-fast-path-and-ranked-suggestions/

- `03-REVIEW-FIX.md` — Phase 03: Code Review Fix Report (~799 tok)
- `03-REVIEW.md` — Phase 03: Code Review Report — Claude Fast Path and Ranked Suggestions (~2886 tok)

## ../../../../tmp/sv-03-reviewfix-9wn1wS/shell/zsh/

- `qq.zsh` — qq.zsh — QueQue ZLE widget and shell-side result contract (~2448 tok)

## ../../../../tmp/sv-03-reviewfix-9wn1wS/src/client/

- `run-foreground.ts` — Selects the deterministic result mode for this Phase 1 seam: (~2457 tok)

## ../../../../tmp/sv-03-reviewfix-9wn1wS/src/providers/

- `claude.ts` — Calls Claude with the assembled context envelope and returns ranked command candidates. (~1390 tok)

## ../../../../tmp/sv-03-reviewfix-9wn1wS/tests/

- `zsh-widget.test.ts` — Smoke tests for the zsh ZLE widget (`shell/zsh/qq.zsh`). (~4246 tok)

## ../../../../tmp/sv-03-reviewfix-B78We4/shell/zsh/

- `qq.zsh` — qq.zsh — QueQue ZLE widget and shell-side result contract (~2291 tok)

## ../../../../tmp/sv-03-reviewfix-B78We4/src/cli/

- `main.ts` — Exports main (~548 tok)

## ../../../../tmp/sv-03-reviewfix-B78We4/src/cli/commands/

- `client.ts` — Real client command handler. (~467 tok)

## ../../../../tmp/sv-03-reviewfix-B78We4/src/client/

- `run-foreground.ts` — Selects the deterministic result mode for this Phase 1 seam: (~2332 tok)

## ../../../../tmp/sv-03-reviewfix-B78We4/src/context/

- `pipeline.ts` — Exports gatherContext (~494 tok)

## ../../../../tmp/sv-03-reviewfix-B78We4/src/context/providers/

- `git-context.ts` — Exports parsePorcelainLine, gitContextProvider (~903 tok)

## ../../../../tmp/sv-03-reviewfix-B78We4/src/contracts/

- `shell.ts` — Shell request — sent from the zsh widget to the qq client. (~370 tok)

## ../../../../tmp/sv-03-reviewfix-B78We4/src/daemon/

- `bootstrap.ts` — Attempts to connect to the daemon socket at `socketPath`. (~1309 tok)
- `server.ts` — Starts the daemon Unix-socket server. (~943 tok)

## ../../../../tmp/sv-03-reviewfix-B78We4/src/providers/

- `claude.ts` — Calls Claude with the assembled context envelope and returns ranked command candidates. (~1764 tok)

## ../../../../tmp/sv-03-reviewfix-B78We4/src/shared/

- `debug-log.ts` — Exports debugLogPath, appendDebugLog (~210 tok)
- `env-file.ts` — Exports readEnvValueFromDotEnvLocal (~566 tok)

## ../../../../tmp/sv-03-reviewfix-B78We4/src/ui/

- `CandidateSelect.tsx` — Props for CandidateSelect. (~1310 tok)

## ../../../../tmp/sv-03-reviewfix-B78We4/tests/

- `client-result.test.ts` — --------------------------------------------------------------------------- (~4543 tok)
- `context-pipeline.test.ts` — NormalizedRequest: buildRequest (~1220 tok)
- `daemon-bootstrap.test.ts` — vi.hoisted runs before vi.mock, giving us a stable reference to the mock fn (~1464 tok)

## ../../.claude/projects/-Users-samuel-dev-tui-llm/memory/

- `feedback_lint_before_commit.md` (~216 tok)
- `feedback_no_autocommit.md` (~146 tok)
- `feedback_no_coauthored.md` (~148 tok)
- `feedback_no_stub_in_smoke_tests.md` (~267 tok)
- `feedback_terminology.md` (~163 tok)
- `feedback_wolf_commit.md` (~221 tok)
- `MEMORY.md` — Memory Index (~247 tok)
- `project_target_audience.md` (~202 tok)

## ../../.cursor/plans/

- `phase_8_macos_gap_6db8d319.plan.md` — Add macOS Claude Auth Gap to Phase 8 (Planning Only) (~1836 tok)

## ../../.cursor/projects/Users-samuel-dev-tui-llm/agent-tools/

- `2101a60a-5383-4516-9005-e358d5918c89.txt` — Declares errors (~9899 tok)
- `42f233de-2af8-4fa8-abdb-7567371c317e.txt` — [BUG] OAuth refresh returns 400 after early 401 before local expiresAt; concurrent sessions forced t (~10929 tok)
- `538a3a7b-eaec-43b9-a58f-ce1ff7a518d0.txt` (~60186 tok)
- `55d1b009-26e8-4256-9cf0-568c32416191.txt` — Declares definitions (~20328 tok)
- `6303af03-5778-4afa-a9ca-d7ff395eceed.txt` — Declares errors (~9899 tok)
- `6905a00b-1807-4faa-bcf1-55816a173fce.txt` — ls: lsExample, lsExample (~18678 tok)
- `9967328d-9cb0-497e-bb82-1653c0bd8045.txt` (~60186 tok)
- `a0c7f713-e5ba-4432-9036-d28b9afc3d41.txt` (~8668 tok)
- `a9bbd6ca-7ace-44fb-838e-59e081d48030.txt` (~5745 tok)
- `e42b4f5f-0ac6-4103-b772-a2c6dcc56bf5.txt` — Declares names (~6528 tok)
- `f0005c5f-1174-4259-a9b2-6b1ba941a3f9.txt` — Declares definitions (~20328 tok)
- `f43e11ed-66f9-41f2-9a7d-df1ee64cd15c.txt` (~5970 tok)

## ../SpreadPaper-intel/

- `index.html` — SpreadPaper — Seamless Multi-Monitor Wallpapers for macOS (~7281 tok)
- `README.md` — Project documentation (~1260 tok)

## ../SpreadPaper-intel/.github/workflows/

- `release.yml` — CI: Release (~1156 tok)

## ./

- `.gitignore` — Git ignore rules (~54 tok)
- `.releaserc.json` (~343 tok)
- `biome.json` (~213 tok)
- `CLAUDE.md` — OpenWolf (~1668 tok)
- `CONTRIBUTING.md` — Contributing (~1150 tok)
- `lefthook.yml` (~320 tok)
- `marketing-post.md` — QueQue — LinkedIn Launch Post (~617 tok)
- `package.json` — Node.js package manifest (~499 tok)
- `README.md` — Project documentation (~1079 tok)
- `tsconfig.json` — TypeScript configuration (~172 tok)
- `tsup.config.ts` — Build: entry { main: src/cli/launcher.ts, app: src/cli/main.ts } → dist/cli; `noExternal: [/.*/]` (every dependency inlined into app.js); esbuild aliases react-devtools-core / bufferutil / utf-8-validate to src/shims; banner = shebang + createRequire `require` for CJS deps; defines __QUEQUE_COMMIT__/__QUEQUE_VERSION__; dts + sourcemaps kept. (~600 tok)
- `vitest.config.ts` — /*.test.ts', 'tests/**/*.test.tsx'], (~88 tok)

## .claude/

- `settings.json` (~441 tok)

## .claude/rules/

- `openwolf.md` (~313 tok)

## .claude/skills/spike-findings-tui-llm/

- `references/candidate-command-check.md` — hand lexer to flag candidates using missing tools (~1100 tok)
- `references/installed-command-handoff.md` — zsh rehash + $commands handoff recipe, ~7 ms (~900 tok)
- `references/prompt-steering.md` — installed∩catalog prompt list vs full list (PARTIAL) (~1000 tok)
- `SKILL.md` — Project: tui-llm (QueQue) (~585 tok)
- `SKILL.md` — Spike findings blueprint index: installed-only-commands requirements + feature areas (~600 tok)

## .claude/skills/spike-findings-tui-llm/references/

- `candidate-command-check.md` — Candidate Command Check (flag suggestions that use missing tools) (~1016 tok)
- `installed-command-handoff.md` — Installed-Command Handoff (zsh → qq client) (~841 tok)
- `prompt-steering.md` — Prompt Steering With the Installed List (~828 tok)

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

## .claude/worktrees/agent-a1a70f3e84a5ede72/.planning/phases/03-claude-fast-path-and-ranked-suggestions/

- `03-03-SUMMARY.md` — Phase 03 Plan 03: Error Kind Handling in ZSH Widget Summary (~770 tok)

## .claude/worktrees/agent-a1a70f3e84a5ede72/shell/zsh/

- `qq.zsh` — qq.zsh — QueQue ZLE widget and shell-side result contract (~2387 tok)

## .claude/worktrees/agent-a1a70f3e84a5ede72/tests/

- `zsh-widget.test.ts` — Smoke tests for the zsh ZLE widget (`shell/zsh/qq.zsh`). (~4179 tok)

## .claude/worktrees/agent-a2f4022ef0830f01e/.planning/phases/04-fuzzy-tui-selection-ux/

- `04-02-SUMMARY.md` — Phase 04 Plan 02: useEffect([query]) Reset Hook Summary (~1331 tok)

## .claude/worktrees/agent-a2f4022ef0830f01e/src/ui/

- `CandidateSelect.tsx` — Props for CandidateSelect. (~1376 tok)

## .claude/worktrees/agent-a2f4022ef0830f01e/tests/

- `candidate-select.test.tsx` — tests/candidate-select.test.tsx (~3290 tok)

## .claude/worktrees/agent-a4210920/.planning/phases/01-shell-bridge-and-result-contract/

- `01-01-SUMMARY.md` — Phase 01 Plan 01: Toolchain Baseline and Shell/IPC Contracts Summary (~1742 tok)

## .claude/worktrees/agent-a4210920/src/contracts/

- `ipc.ts` — IPC request — sent from the foreground client to the daemon over a Unix socket. (~279 tok)
- `shell.ts` — Shell request — sent from the zsh widget to the qq client. (~353 tok)

## .claude/worktrees/agent-a4210920/src/shared/

- `socket-path.ts` — Returns the Unix socket path for the qq daemon for a given UID. (~169 tok)

## .claude/worktrees/agent-a4210920/tests/

- `shell-contract.test.ts` — Declares validCancel (~648 tok)

## .claude/worktrees/agent-a5c7276f6fe389a4e/.planning/phases/03-claude-fast-path-and-ranked-suggestions/

- `03-01-SUMMARY.md` — Dependency graph (~1389 tok)

## .claude/worktrees/agent-a5c7276f6fe389a4e/src/contracts/

- `shell.ts` — Shell request — sent from the zsh widget to the qq client. (~417 tok)

## .claude/worktrees/agent-a5c7276f6fe389a4e/src/providers/

- `claude.ts` — Calls Claude with the assembled context envelope and returns ranked command candidates. (~1301 tok)
- `provider.ts` — Exports LLMAdapter (~67 tok)

## .claude/worktrees/agent-a5c7276f6fe389a4e/tests/

- `claude-provider.test.ts` — ContextEnvelope: buildEnvelope (~1262 tok)
- `shell-contract.test.ts` — Declares validCancel (~804 tok)

## .claude/worktrees/agent-a78bb2a4d3d56c042/.planning/phases/03-claude-fast-path-and-ranked-suggestions/

- `03-02-SUMMARY.md` — Phase 03 Plan 02: Confidence Propagation, Error ShellResult, and Claude Backend Registration Summary (~1577 tok)

## .claude/worktrees/agent-a78bb2a4d3d56c042/src/client/

- `run-foreground.ts` — Selects the deterministic result mode for this Phase 1 seam: (~2389 tok)

## .claude/worktrees/agent-a78bb2a4d3d56c042/src/contracts/

- `request.ts` — Broad intent categories classified before any context gathering. (~1039 tok)

## .claude/worktrees/agent-a78bb2a4d3d56c042/src/registry/

- `bootstrap.ts` — Registers all Phase 2 built-ins into their respective registries. (~439 tok)

## .claude/worktrees/agent-a78bb2a4d3d56c042/tests/

- `client-result.test.ts` — --------------------------------------------------------------------------- (~4737 tok)
- `registry-bootstrap.test.ts` — Declares hookIds (~518 tok)

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

## .claude/worktrees/agent-aac9f5d671b3b40db/tests/

- `candidate-select.test.tsx` — tests/candidate-select.test.tsx (~3380 tok)
- `client-result.test.ts` — --------------------------------------------------------------------------- (~6022 tok)

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

- `qq.zsh` — qq.zsh — QueQue ZLE widget and shell-side result contract (~1407 tok)

## .claude/worktrees/agent-accab398/tests/

- `zsh-widget.test.ts` — Smoke tests for the zsh ZLE widget (`shell/zsh/qq.zsh`). (~2156 tok)

## .claude/worktrees/agent-ad6a431a4e19000a0/.planning/phases/09.1-provider-latency-and-cancellation/

- `09.1-01-SUMMARY.md` — Phase 09.1 Plan 01: Cancellable stream-json claude -p turn Summary (~4826 tok)

## .claude/worktrees/agent-ad6a431a4e19000a0/.wolf/

- `anatomy.md` — anatomy.md (~15102 tok)
- `cerebrum.md` — Cerebrum (~9939 tok)

## .claude/worktrees/agent-ad6a431a4e19000a0/src/cli/

- `main.ts` — Exports main (~1322 tok)

## .claude/worktrees/agent-ad6a431a4e19000a0/src/client/

- `run-foreground.ts` — Splits a command + explanation into shell buffer halves. (~5020 tok)

## .claude/worktrees/agent-ad6a431a4e19000a0/src/daemon/

- `fetch-client.ts` — How long to wait for `{kind:'fetch-accepted'}` before treating the daemon as stale. (~1455 tok)
- `server.ts` — Starts the daemon Unix-socket server. (~1614 tok)

## .claude/worktrees/agent-ad6a431a4e19000a0/src/providers/

- `claude-cli.ts` — The Claude Code binary, resolved on PATH. (~918 tok)
- `claude-default.ts` — Returns milliseconds left before `deadline`, floored at zero. (~1131 tok)
- `claude-process.ts` — One `claude -p` stream-json turn on a child process (Phase 09.1, D-04, D-13). (~2440 tok)
- `claude.ts` — Moved to steering.ts in Phase 9; re-exported so existing importers keep compiling. (~2046 tok)
- `provider.ts` — Per-call options shared by every adapter (Phase 09.1). (~341 tok)
- `stream-json.ts` — Pure helpers for `claude -p --input-format stream-json --output-format stream-json (~846 tok)

## .claude/worktrees/agent-ad6a431a4e19000a0/tests/

- `claude-cli-provider.test.ts` — The runner's is-error shape for the recorded auth failure (Probe 3). (~6155 tok)
- `claude-process.test.ts` — ClaudeTurnFailure: scratchDir, startTurn, stageNames (~1636 tok)
- `client-result.test.ts` — --------------------------------------------------------------------------- (~10922 tok)
- `daemon-fetch.test.ts` — FetchOptions: buildEnvelope (~2064 tok)

## .claude/worktrees/agent-ad6a431a4e19000a0/tests/fixtures/

- `fake-claude-stream.mjs` — Writes one event line with its bytes split inside `splitChar`, `gapMs` apart. (~1827 tok)

## .claude/worktrees/agent-adabf5a43d4a36218/.planning/phases/03.2-zellij-floating-pane-integration-for-best-ux/

- `03.2-03-SUMMARY.md` — Phase 03.2 Plan 03: qq-question-widget Zellij FIFO Rewrite Summary (~1486 tok)

## .claude/worktrees/agent-adabf5a43d4a36218/shell/zsh/

- `qq.zsh` — qq.zsh — QueQue ZLE widget and shell-side result contract (~2159 tok)

## .claude/worktrees/agent-ae3ff4eb91307526b/.planning/phases/04-fuzzy-tui-selection-ux/

- `04-03-SUMMARY.md` — Phase 04 Plan 03: Main.ts FIFO Safety Handlers Summary (~1632 tok)

## .claude/worktrees/agent-ae3ff4eb91307526b/.wolf/

- `anatomy.md` — anatomy.md (~2675 tok)
- `memory.md` — Memory (~12152 tok)

## .claude/worktrees/agent-ae3ff4eb91307526b/shell/zsh/

- `qq.zsh` — qq.zsh — QueQue ZLE widget and shell-side result contract (~2709 tok)

## .claude/worktrees/agent-ae3ff4eb91307526b/src/cli/

- `main.ts` — Exports main (~1134 tok)

## .claude/worktrees/agent-ae3ff4eb91307526b/tests/

- `client-result.test.ts` — --------------------------------------------------------------------------- (~6651 tok)

## .claude/worktrees/agent-af8d008deef4b25ca/.wolf/

- `anatomy.md` — anatomy.md (~4895 tok)

## .claude/worktrees/agent-af8d008deef4b25ca/src/client/

- `run-foreground.ts` — Splits a command + explanation into shell buffer halves. (~3336 tok)

## .claude/worktrees/agent-af8d008deef4b25ca/src/providers/

- `detect.ts` — Exports DetectedProvider, detectProvider (~480 tok)
- `index.ts` (~43 tok)

## .claude/worktrees/agent-af8d008deef4b25ca/tests/

- `provider-detect.test.ts` — --------------------------------------------------------------------------- (~1962 tok)

## .github/workflows/

- `homebrew.yml` — CI: Update Homebrew Tap (~957 tok)
- `release.yaml` — CI: Release (~1824 tok)

## .gsd/

- `PROJECT.md` — QueQue (~1526 tok)
- `REQUIREMENTS.md` — Requirements (~1662 tok)

## .planning/

- `.continue-here.md` — Session Handoff — Homebrew Binary Fix + Tooling Cleanup (~1144 tok)
- `config.json` (~258 tok)
- `HANDOFF.json` — Declares correctly (~1406 tok)
- `PROJECT.md` — QueQue (~1525 tok)
- `REQUIREMENTS.md` — Requirements: QueQue (~1313 tok)
- `ROADMAP.md` — Roadmap: QueQue (~5961 tok)
- `STATE.md` — Project State (~2442 tok)

## .planning/debug/

- `empty-modal-after-tool-awareness-reenable.md` — Current Focus (~3416 tok)
- `llm-response-latency-profile.md` — Symptoms (~6991 tok)
- `modal-blank-before-loading.md` — Symptoms (~493 tok)

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

## .planning/phases/03-claude-fast-path-and-ranked-suggestions/

- `03-01-PLAN.md` — with: readEnvValueFromDotEnvLocal, appendDebugLog, resolveModel (~3933 tok)
- `03-01-SUMMARY.md` — Dependency graph (~1318 tok)
- `03-02-PLAN.md` — Trust Boundaries (~3133 tok)
- `03-03-PLAN.md` — Trust Boundaries (~2481 tok)
- `03-CONTEXT.md` — Phase 3: Claude Fast Path and Ranked Suggestions - Context (~1774 tok)
- `03-PATTERNS.md` — Phase 3: Claude Fast Path and Ranked Suggestions - Pattern Map (~5239 tok)
- `03-RESEARCH.md` — Phase 3: Claude Fast Path and Ranked Suggestions - Research (~8019 tok)
- `03-REVIEW-FIX.md` — Phase 03: Code Review Fix Report (~1902 tok)
- `03-REVIEW.md` — Phase 03: Code Review Report — Claude Fast Path and Ranked Suggestions (~2880 tok)
- `03-VALIDATION.md` — Phase 3 — Validation Strategy (~945 tok)
- `03-VERIFICATION.md` — Phase 03: Claude Fast Path and Ranked Suggestions Verification Report (~2457 tok)

## .planning/phases/03.1-update-interface-and-interactivity-to-match-that-of-this-git/

- `03.1-03-SUMMARY.md` — Phase 03.1 Plan 03: Wave 2 Core Implementation Summary (~2166 tok)
- `03.1-PATTERNS.md` — Phase 03.1: Monocle-style Interface and Interactivity — Pattern Map (~5392 tok)
- `03.1-REVIEW.md` — Phase 03.1: Code Review Report (~3497 tok)
- `03.1-UI-SPEC.md` — Phase 03.1 — UI Design Contract: Monocle-style Interface and Interactivity (~3007 tok)
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

## .planning/phases/04-fuzzy-tui-selection-ux/

- `.continue-here.md` — Session Checkpoint — Phase 04 UAT Fixes Pending (~1112 tok)
- `04-01-PLAN.md` — Trust Boundaries (~3163 tok)
- `04-01-SUMMARY.md` — Phase 04 Plan 01: TDD Test Scaffolding Summary (~1281 tok)
- `04-02-PLAN.md` — Trust Boundaries (~1718 tok)
- `04-02-SUMMARY.md` — Phase 04 Plan 02: useEffect([query]) Reset Hook Summary (~1190 tok)
- `04-03-PLAN.md` — Trust Boundaries (~2757 tok)
- `04-PATTERNS.md` — Phase 4: Fuzzy TUI Selection UX - Pattern Map (~4526 tok)
- `04-RESEARCH.md` — Phase 4: Fuzzy TUI Selection UX - Research (~6409 tok)
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

- `08-01-PLAN.md` — Execute plan: platform-aware Claude CLI detection (macOS Keychain `/login` gap, OAuth env tokens, tests). (~1700 tok)
- `08-01-SUMMARY.md` — Phase 08 Plan 01: Platform-Aware Claude Auth Detection Summary (~918 tok)
- `08-02-PLAN.md` (~10802 tok)
- `08-02-SUMMARY.md` — Phase 08 Plan 02: Claude CLI-First Fetch with SDK Rescue Summary (~1774 tok)
- `08-03-PLAN.md` — Gap closure: provider.json schema checkpoint, pin loader + resolveProviderAdapter, Ollama adapter through the daemon (~9558 tok)
- `08-04-PLAN.md` — Gap closure: OpenAI Chat Completions adapter behind the pin, OPENAI_API_KEY handling (~5566 tok)
- `08-05-PLAN.md` — Gap closure: `qq init provider` picker on /dev/tty, atomic 0600 pin write, daemon restart (~6701 tok)
- `08-06-PLAN.md` — Gap closure: first failed ?? hint to `qq init provider`, detection-never-selects comment, docs (~4152 tok)
- `08-CONTEXT.md` — Phase 8: Zero-Config Install and Provider Detection - Context (~2262 tok)
- `08-DISCUSSION-LOG.md` — Phase 8: Zero-Config Install and Provider Detection - Discussion Log (~954 tok)
- `08-PATTERNS.md` — Phase 8: Zero-Config Install and Provider Detection - Pattern Map (~6670 tok)
- `08-RESEARCH.md` — Phase 8: Zero-Config Install and Provider Detection - Research (~8967 tok)
- `08-REVIEW.md` — Phase 08: Code Review Report (~2665 tok)
- `08-REVIEWS.md` — Cross-AI Plan Review — Phase 8 (~2352 tok)
- `08-VALIDATION.md` — Phase 8 — Validation Strategy (~990 tok)
- `08-VERIFICATION.md` — Phase 08 goal-backward verification: 08-01/08-02 vs CR-01 stdin gap and 08-03 remaining. (~3200 tok)
- `08-VERIFICATION.md` — Phase 08: Zero-Config Install and Provider Detection Verification Report (~4525 tok)
- `COVERAGE.md` — API coverage matrix (Ollama, OpenAI, Anthropic Messages, Claude Code CLI) for the seal-time gate (~1900 tok)
- `COVERAGE.md` — API Coverage — Phase 08 (Ollama, OpenAI, Anthropic Messages, Claude Code CLI) (~1524 tok)

## .planning/phases/09-installed-only-command-awareness/

- `09-01-PLAN.md` — Wave 1 tracer: ERR-trap-safe zsh handoff (kill switch) → tool-handoff reader → hardened command-words lexer → ⊘ flag; handoff safety/timing tests; TDD layout rows + reserve 17; review ledger (~14923 tok)
- `09-01-SUMMARY.md` — Phase 9 Plan 01: Installed-Tool Awareness Tracer Summary (~3567 tok)
- `09-02-PLAN.md` — Wave 2: 40 spike-002 lexer cases, robustness + token-contract cases, child-process fuzz (maxBuffer, per-case timeouts); no .wolf commits (~5997 tok)
- `09-03-PLAN.md` — Wave 2: tool catalog, lenient daemon-side / strict client-side installed-tools schemas, steering.ts buildSystemPrompt, adapters guard, 08-03/08-04 notes (~9570 tok)
- `09-03-SUMMARY.md` — Phase 9 Plan 03: Installed-Tools Prompt Steering Summary (~3699 tok)
- `09-04-PLAN.md` — Wave 2: installer/package map/install form (comment/heredoc block), Tab toggle, ControlsLine tabHint via element tree (~9205 tok)
- `09-04-SUMMARY.md` — Phase 9 Plan 04: Tab Install Form Summary (~3886 tok)
- `09-05-PLAN.md` — Wave 3: apply wave-2 .wolf entries, pong installedTools, catalog-drift test, client sends strict chunk, human check (real-shell timing, Zellij kill switch) (~8056 tok)
- `09-05-SUMMARY.md` — Phase 9 Plan 05: Installed-Tools Chunk, Daemon Capability and Live Check Summary (~2198 tok)
- `09-06-PLAN.md` — Gap closure G-09-7 (empty Zellij modal): tracer = render-phase candidate-arrival reset in CandidateSelect (prevCandidates, 4th useState) + real-hooks Ink test; Task 2 = serialized latest-wins zellij resize queue (error/2 s settle release) + completion-order race test; SIGWINCH not wired (reasons in objective) (~9100 tok)
- `09-06-SUMMARY.md` — Phase 9 Plan 06: Empty Zellij Modal (G-09-7) Summary (~4285 tok)
- `09-CONTEXT.md` — Phase 9: Installed-Only Command Awareness - Context (~2940 tok)
- `09-DISCUSS-CHECKPOINT.json` (~587 tok)
- `09-DISCUSSION-LOG.md` — Phase 9: Installed-Only Command Awareness - Discussion Log (~1131 tok)
- `09-PATTERNS.md` — Phase 9: Installed-Only Command Awareness - Pattern Map (~3875 tok)
- `09-RESEARCH.md` — Phase 9: Installed-Only Command Awareness - Research (~13208 tok)
- `09-REVIEW-FIX.md` — Phase 9: Code Review Fix Report (~2744 tok)
- `09-REVIEW.md` — Phase 9: Code Review Report (~3864 tok)
- `09-SECURITY.md` — threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking g (~1967 tok)
- `09-SECURITY.md` — Phase 9 threat register (23 threats, all closed, ASVS L1), accepted risks AR-09-01/02, audit trail (~2100 tok)
- `09-VALIDATION.md` — status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6) (~1584 tok)
- `09-VERIFICATION.md` — Phase 9: Installed-Only Command Awareness Verification Report (~6301 tok)
- `COVERAGE.md` — No external API integration declaration for Phase 9 (~44 tok)
- `deferred-items.md` — Phase 09 — Deferred Items (~280 tok)

## .planning/phases/09.1-provider-latency-and-cancellation/

- `09.1-01-PLAN.md` — Artifacts this phase produces (~12953 tok)
- `09.1-02-PLAN.md` — Artifacts this phase produces (~6994 tok)
- `09.1-03-PLAN.md` — Artifacts this phase produces (~6865 tok)
- `09.1-04-PLAN.md` — Artifacts this phase produces (~7405 tok)
- `09.1-05-PLAN.md` — Artifacts this phase produces (~8364 tok)
- `09.1-06-PLAN.md` — Artifacts this phase produces (~6783 tok)
- `09.1-07-PLAN.md` — Artifacts this phase produces (~8155 tok)
- `09.1-08-PLAN.md` — Artifacts this phase produces (~6502 tok)
- `09.1-CONTEXT.md` — Phase 09.1: Provider Latency and Cancellation - Context (~2714 tok)
- `09.1-DISCUSSION-LOG.md` — Phase 09.1: Provider Latency and Cancellation - Discussion Log (~847 tok)
- `09.1-PATTERNS.md` — Phase 09.1: Provider Latency and Cancellation - Pattern Map (~3593 tok)
- `09.1-RESEARCH.md` — Phase 09.1: Provider Latency and Cancellation - Research (~17961 tok)
- `09.1-VALIDATION.md` — status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6) (~2166 tok)
- `COVERAGE.md` — API Coverage — Anthropic Messages API (TS SDK 0.92.0) and Claude Code print mode (2.1.285) (~681 tok)

## .planning/quick/20260522-selection-summary-and-history/

- `PLAN.md` — Quick Task: Selection Summary and History (~824 tok)
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

- `SUMMARY.md` — Quick Task: Workflows use .nvmrc for Node version (~85 tok)

## .planning/quick/260501-qt4-write-a-short-node-script-that-restart-t/

- `260501-qt4-PLAN.md` — Quick task plan for a minimal Node watcher that restarts `pnpm dev` and logs watch/restart events. (~520 tok)

## .planning/quick/260522-tui-cleanup-on-close/

- `PLAN.md` — Quick Task: TUI Cleanup on Close (~300 tok)
- `SUMMARY.md` — Summary: TUI Cleanup on Close (~240 tok)

## .planning/quick/260522-vfd-prototype-provider-detection/

- `260522-vfd-PLAN.md` — Trust Boundaries (~2693 tok)
- `260522-vfd-PLAN.md` — Quick plan: prototype provider detection waterfall (5-step, detect.ts, tests, run-foreground wiring) (~1800 tok)
- `260522-vfd-SUMMARY.md` — Phase quick Plan 260522-vfd: Prototype Provider Detection Summary (~881 tok)

## .planning/quick/260528-mk1-rename-que-que-to-queque-in-prose-write-/

- `260528-mk1-SUMMARY.md` — Phase quick Plan 260528-mk1: Rename que-que to queque Summary (~1192 tok)

## .planning/quick/260528-mk1-rename-queque-to-queque-in-prose-write-/

- `260528-mk1-PLAN.md` — Declares names (~2959 tok)

## .planning/quick/260529-ney-explore-beta-release-requirements-for-ho/

- `260529-ney-PLAN.md` (~2158 tok)
- `260529-ney-SUMMARY.md` — Phase quick Plan 260529-ney: Beta Release Requirements Research Summary (~814 tok)
- `BETA-RELEASE-REQUIREMENTS.md` — QueQue Beta Release Requirements (~6318 tok)

## .planning/quick/260529-ntf-implement-release-automation-workflows-a/

- `260529-ntf-PLAN.md` — Trust Boundaries (~2719 tok)
- `260529-ntf-SUMMARY.md` — Phase quick-260529-ntf Plan 01: Release Automation Workflows Summary (~821 tok)

## .planning/quick/261011-e43-fix-top-queque-line-is-clipped-when-moda/

- `261011-e43-PLAN.md` — Quick plan: Zellij header clip fix. Tracer TDD = real-Ink "header row" test (pane PTY rows >= rows Ink frame occupies; plain/flagged/smt2) + `INK_TRAILING_CURSOR_ROWS = 1` in resolveZellijPaneHeight (content + 2 frame + 1 cursor row, capped); queue-test height literals +1 (exitAfterMs key 9→10); resize-signal wiring rejected (reasons in objective); Task 2 live Zellij human-verify. (~6200 tok)
- `261011-e43-SUMMARY.md` — Phase quick-261011-e43 Plan 01: Zellij header clip fix Summary (~2790 tok)

## .planning/quick/261011-f9o-keep-the-zellij-modal-at-its-full-list-h/

- `261011-f9o-PLAN.md` — Quick plan: hold the Zellij pane height while filtering. Tracer TDD = real-Ink (f) `smt` + Backspace spawns no resize (pre-fix probe 18,11,18) with a `replayScreen` check (header row 0, no stale rows, no scroll) + `heldPaneLines(previousHeld, input)` in modal-layout (max of held, current, unfiltered estimate) fed by a per-candidates-array useRef hold in CandidateSelect; (d)/(e) expectations changed on purpose; Task 2 unit tests + (g) per-list reset + wolf records; Task 3 live Zellij human-verify. Zellij path only; run-foreground/zellij-pane-resize untouched. (~8000 tok)
- `261011-f9o-SUMMARY.md` — Phase quick-261011-f9o Plan 01: Keep the Zellij modal at its full-list height while filtering Summar (~2607 tok)

## .planning/quick/261011-jbh-instant-first-frame-from-the-zsh-widget-/

- `261011-jbh-PLAN.md` — Quick plan: instant first frame + faster Node start. Tracer TDD (Task 1, LD-1): zsh widget paints `queque › <lbuffer>` + `thinking…` before Node (inline: reserve + ESC 7 + CSI J + frame + ESC 8 via plain print; Zellij: session-dir `instant-frame.txt` cat by a `/bin/sh` pane wrapper, lbuffer never in argv); client `src/client/instant-frame.ts` `armInstantFrameTakeover` injects the surface clear into Ink's first visible write (inline ESC 8 + CSI J on the client's own fresh save, Zellij CSI H + CSI J); real-Ink `replayScreen` cases t1-t6 + zsh z1-z10; `QQ_INSTANT_FRAME=0` kill switch. Task 2 (LD-2): RED tests/bundle-startup.test.ts, tsup entry {main: src/cli/launcher.ts, app: src/cli/main.ts}, noExternal, react-devtools-core shim alias, createRequire banner, per-user 0700 compile cache (fail safe), lazy `import('@anthropic-ai/sdk')`. Task 3 live check inline + Zellij; then debug session → resolved/. (~12400 tok)
- `261011-jbh-SUMMARY.md` — Phase quick-261011-jbh Plan 01: Instant first frame from the zsh widget + bundled, compile-cached cl (~3712 tok)
- `COVERAGE.md` — api-coverage gate declaration: no external API integration (SDK import only made lazy). (~68 tok)
- `deferred-items.md` — Deferred items: quick 261011-jbh (~332 tok)

## .planning/research/

- `ARCHITECTURE.md` — Architecture Research: QueQue (~667 tok)
- `FEATURES.md` — Features Research: QueQue (~558 tok)
- `PITFALLS.md` — Pitfalls Research: QueQue (~736 tok)
- `STACK.md` — Stack Research: QueQue (~870 tok)
- `SUMMARY.md` — Research Summary: QueQue (~335 tok)

## .planning/spikes/

- `CONVENTIONS.md` — how we spike: zsh timing, spike-local deps, tsup bundling (~400 tok)
- `MANIFEST.md` — Spike Manifest (~258 tok)
- `MANIFEST.md` — spike index + installed-only-commands requirements (~500 tok)
- `WRAP-UP-SUMMARY.md` — Spike Wrap-Up Summary (~438 tok)
- `WRAP-UP-SUMMARY.md` — wrap-up summary of spikes 001–003 (~500 tok)

## .planning/spikes/001-zsh-commands-handoff/

- `bench.zsh` — Spike 001 — cost and freshness of handing zsh's $commands table to the qq client. (~652 tok)
- `README.md` — Project documentation (~1071 tok)
- `rehash-cost.zsh` — Spike 001b — what does "rehash then hand off" cost on every ?? (widget-side work). (~484 tok)

## .planning/spikes/002-candidate-binary-check/

- `cases.mjs` — Expected = every program the shell would look up, in order. Wrappers (sudo, xargs…) count too. (~988 tok)
- `extract.mjs` — Index just past the `close` that balances the `open` at s[i]. Respects quotes and escapes. (~2563 tok)
- `README.md` — Project documentation (~1281 tok)
- `run.mjs` — Spike 002 runner: accuracy of hand lexer vs shell-quote, plus per-candidate cost and (~730 tok)

## .planning/spikes/003-prompt-steering/

- `catalog.ts` — Curated catalog of notable CLI tools that have common alternatives. Variant B sends only (~440 tok)
- `compare.ts` — Spike 003 — does telling the model which tools are installed help, and what does it cost? (~1696 tok)
- `README.md` — Project documentation (~1195 tok)

## docs/

- `config.example.json` (~65 tok)
- `EXTENSIONS.md` — QueQue Extension Seams (~1397 tok)
- `RELEASING.md` — Release Process (~1183 tok)
- `SYSTEM_DESGN.md` — System Design (~3530 tok)
- `SYSTEM_DESIGN.md` — System Design (~2615 tok)

## scripts/

- `build-dashboard.mjs` — `, 'wholename']], (~7492 tok)
- `docker-homebrew-smoke-runner.sh` (~491 tok)
- `smoke-homebrew-docker.sh` (~953 tok)
- `strip-cursor-coauthor-from-msg.sh` — Removes Cursor co-author trailer lines from a git commit message file or stdin. (~114 tok)

## shell/zsh/

- `qq.zsh` — qq.zsh — QueQue ZLE widget and shell-side result contract (~2727 tok)
- `queque.zsh` — QueQue ZLE widget + shell result contract: `??` trigger, qq lookup, instant first frame (quick 261011-jbh: `_qq_instant_frame`, `_qq_inline_instant_frame_bytes`, `_qq_paint_inline_instant_frame` before mktemp, `_qq_write_pane_instant_frame` + `QQ_PANE_PAINT_SCRIPT` `/bin/sh` pane wrapper, `QQ_INSTANT_FRAME=0` kill switch, inline clear on non-zero client exit), session dir, request.json, `_qq_write_tool_handoff`, Zellij FIFO pane / inline foreground client, `_qq_apply_result_str`. (~4840 tok)

## src/

- `env.d.ts` — Declares __QUEQUE_COMMIT__ (~24 tok)

## src/cli/

- `launcher.ts` — CLI launcher built as dist/cli/main.js (quick 261011-jbh, LD-2): Node built-ins only; enables the module compile cache in `${XDG_CACHE_HOME:-~/.cache}/queque/node-compile-cache` (0700; queque parent + leaf lstat-checked: real dir, owned by getuid, no group/world write; skipped when NODE_COMPILE_CACHE / NODE_DISABLE_COMPILE_CACHE is set; silent on failure), then imports `new URL('./app.js', import.meta.url)` and awaits `main()`. (~955 tok)
- `main.ts` — Exports main; the `client` action calls `process.exit(process.exitCode ?? 0)` after clientCommand (D-15, 09.1-01). (~1300 tok)

## src/cli/commands/

- `client.ts` — Real client command handler. (~394 tok)
- `daemon.ts` — Real daemon command handler. (~436 tok)
- `init.ts` — Returns true when .zshrc already sources the queque shell script or contains (~732 tok)

## src/client/

- `instant-frame.ts` — Instant first frame takeover (quick 261011-jbh, LD-1): SAVE_CURSOR/RESTORE_CURSOR/ERASE_BELOW/CURSOR_HOME/SYNC_UPDATE_BEGIN, INLINE_SURFACE_CLEAR (ESC 8 + CSI J on the client's own save), PANE_SURFACE_CLEAR (CSI H + CSI J), `inlineScrollReserve(lines)` (byte-identical to the widget's reserve), `armInstantFrameTakeover(stream, clear)` → `{ clearNow }` (inserts the clear into the first visible write, after a leading `CSI ?2026 h`). (~1291 tok)
- `result-writer.ts` — Validates a ShellResult and writes newline-terminated JSON to `resultFile`. (~307 tok)
- `run-foreground.ts` — Foreground client: request parse, tool handoff read, llm branch opens /dev/tty streams first, writes `inlineScrollReserve(MODAL_VIEWPORT_LINES)` and arms `armInstantFrameTakeover` (inline / Zellij clear) before classify/context/render; `clearNow()` in pre-frame failure paths; `withInstalledToolsChunk` (strict-validated catalog ∩ installed chunk), Ink modal, clearScrollReserve = INLINE_SURFACE_CLEAR, ⓘ annotation, buildShellBuffers; `fetchAbort` AbortController aborted by onSelect/onCancel/cleanupOnSignal, no rerender once resolved, AbortError → `fetch aborted` log only (09.1-01). (~4700 tok)
- `tool-handoff.ts` — readToolHandoff(sessionDir) reads commands/builtins/functions.txt into a ToolInventory or null (QQ_TOOL_AWARENESS=0, missing, empty); counts-only logs; TOOL_HANDOFF_FILES (~735 tok)
- `zellij-pane-resize.ts` — Zellij floating-pane sizing: `readMaxZellijPaneHeight` (QQ_PANE_HEIGHT, default 24), `resolveZellijPaneHeight` (content + 2 frame rows `ZELLIJ_FLOATING_FRAME_LINES` + 1 Ink cursor row `INK_TRAILING_CURSOR_ROWS`, min 6, capped), `formatZellijPaneId`; `syncZellijFloatingPaneHeight` runs a serialized latest-wins queue: one `zellij action change-floating-pane-coordinates` at a time, heights requested meanwhile collapse to the newest, slot released on exit, on child error (no crash when zellij is missing) or after `RESIZE_SETTLE_TIMEOUT_MS` (2000, kills the hung action; timer unref'd); `resetZellijPaneHeightCache` (tests only). (~1900 tok)

## src/context/

- `pipeline.ts` — Exports gatherContext (~524 tok)

## src/contracts/

- `candidates.ts` — Zod schemas: commandCandidateSchema, candidateListSchema (~104 tok)
- `ipc.ts` — IPC request/response schemas; pong capability flags `fetchCandidates` and `installedTools` (Phase 9). (~450 tok)
- `request.ts` — Intent/base-context/envelope schemas; `contextChunkSchema` incl. the lenient `installed-tools` variant (filters non-catalog names, rejects non-name strings and > 512 entries) and the client-side `strictInstalledToolsChunkSchema`. (~1500 tok)
- `shell.ts` — Shell request — sent from the zsh widget to the qq client. (~426 tok)

## src/daemon/

- `bootstrap.ts` — Ensures a current daemon: ping must advertise `fetchCandidates` AND `installedTools` (else replace the stale listener; no reply = keep), spawn if needed. (~2200 tok)
- `fetch-client.ts` — Asks the daemon for candidates; fails in 800ms without `fetch-accepted`; `requestDaemonFetch(…, timeoutMs?, options?)` rejects with abortError() on signal abort and destroys the socket; `fetchCandidatesForUi(…, options?)` never falls back in-process after an abort (09.1-01). (~1300 tok)
- `server.ts` — Daemon Unix-socket server; pong `{fetchCandidates: true, installedTools: true}`; drops lines failing ipcRequestSchema; runs `fetch-candidates` on the warm adapter inside a Promise chain with a per-connection AbortController (socket `close` aborts it; aborted fetches log `fetch aborted` and write nothing) (09.1-01). (~1450 tok)

## src/providers/

- `claude-cli.ts` — `CLAUDE_COMMAND`, `buildClaudeCliArgv(envelope)` (`-p --input-format stream-json --output-format stream-json --verbose --include-partial-messages --safe-mode --tools '' --no-session-persistence --system-prompt buildSystemPrompt(envelope)`, no prompt, no model, never bare); `fetchClaudeCliCandidates(envelope, budget, options)` runs `runClaudeTurn` with the prompt on stdin, forwards `signal`, logs `cli spawned|init|first delta|result|exit|aborted|timed out` with `ms` (exit adds code/signal) (09.1-01). (~900 tok)
- `claude-default.ts` — SDK-first when a usable API key exists, otherwise `claude -p` for `/login`; forwards FetchOptions to the CLI path; an AbortError is logged `claude-cli aborted` and re-thrown unmapped (09.1-01). (~950 tok)
- `claude-exec.ts` — Old argv `execFileAsync` runner on `spawn`. Unused by src/ since 09.1-01 (kept with its test; removal deferred). (~1256 tok)
- `claude-process.ts` — One `claude -p` stream-json turn on a child (09.1-01): `runClaudeTurn` (stdin user line + `stdin.end()`, settle on zod-validated `result`, is_error gate → `is-error` with result text as stdout, budget timer rejects at kill time with killed/SIGTERM, abort → abortError(), spawn-error, exit-without-result, invalid-result; stages spawned/init/first-delta/result/exit/aborted/timed-out), `spawnClaudeChild`, `terminateChild` (SIGTERM then SIGKILL after `SIGKILL_GRACE_MS` 1500); declares `POST_RESULT_BACKSTOP_MS`, `STDERR_CAP_BYTES` for plan 06. argv stays opaque here. (~2000 tok)
- `claude.ts` — Reused Anthropic SDK client (async `getAnthropicClient`: lazy `import('@anthropic-ai/sdk')`, type-only static import, cache re-checked after the await); re-exports `QUEQUE_SYSTEM`; SDK `system` comes from `buildSystemPrompt(envelope)`; `claudeAdapter` wraps the SDK fetch and drops FetchOptions until plan 04 (never lands in `rbuffer`). (~2080 tok)
- `detect.ts` — Returns whether Claude CLI auth appears present without reading secrets. (~811 tok)
- `index.ts` (~86 tok)
- `provider.ts` — `LLMAdapter.fetchCandidates(envelope, options?)`, `FetchOptions { signal?, onCandidate? }`, `abortError()` (name AbortError, 'QueQue: request aborted'), `isAbortError` (AbortError or the SDK's APIUserAbortError) (09.1-01). (~350 tok)
- `resolver.ts` — Returns the Claude-default composite registered as `claude-cli`. (~352 tok)
- `stream-json.ts` — Pure stream-json helpers (09.1-01): `streamJsonResultSchema` (non-strict; is_error gate, subtype not a success signal), `createLineParser` (carry + newline split, non-JSON lines skipped), `textDeltaOf`, `isInitEvent`, `buildStreamJsonUserLine`, `STREAM_JSON_CARRY_CAP_BYTES` (enforced in plan 06). (~700 tok)
- `steering.ts` — `QUEQUE_SYSTEM` (moved from claude.ts), `buildSteeringText(tools)` (catalog re-filter, dedupe, sort, 4 lines D-15/16/17), `buildSystemPrompt(envelope)` (filterContextEnvelope first; byte-identical without the chunk). (~700 tok)

## src/registry/

- `bootstrap.ts` — Registers all Phase 2 built-ins into their respective registries. (~571 tok)
- `provider-backends.ts` — Registers a provider backend descriptor and its LLMAdapter instance. (~357 tok)

## src/shared/

- `command-words.ts` — Hand lexer (`lexHand`: quotes, escapes, `\`-newline continuations removed, heredoc bodies skipped up to the delimiter line, substitutions, redirs, placeholders, comments) + `commandWords` classifier (WRAPPERS with short+long value options, PRECOMMAND_OPTIONS for `exec`/`command`, quoted wrapper operands with whitespace recursed as command strings, explicit lookup-only mode for `command -v|-V` and LOOKUP_BUILTINS type/which/whence/where, reserved words, builtins) + safe `extractCommandWords` (Phase 9, D-03). (~4666 tok)
- `debug-log.ts` — Exports debugLogPath, appendDebugLog (~229 tok)
- `env-file.ts` — Returns a usable secret string, or undefined when the value is missing, empty, (~668 tok)
- `privacy-filter.ts` — Returns true when a file path segment should not be sent to providers or logs. (~717 tok)
- `qq-config.ts` — Built-in sensitive path patterns — always applied; user config adds more. (~1276 tok)
- `socket-path.ts` — Returns the Unix socket path for the qq daemon for a given UID. (~352 tok)
- `tool-awareness.ts` — ToolInventory, isInstalled (commands|functions+aliases), missingTools, installer choice (`pickInstaller`, `INSTALL_COMMANDS`, `LINUX_INSTALLER_ORDER`), per-installer `PACKAGE_ALIASES` (brew/apt/dnf/pacman maps; null = no package installs that binary) + `packageFor(tool, installer)` (Homebrew-aliased tools with no Linux entry are null, never guessed), `SAFE_PACKAGE_NAME_RE`, `buildInstallForm`/`planInstall` (brace-wraps lists, blocks unsafe words/unknown packages/comments/heredocs); `annotateCandidates(…, platform)` attaches `install` to flagged candidates. (~2000 tok)
- `tool-catalog.ts` — Shipped 196-name allow list of notable CLI tools (spike 003 seed, frozen), `CATALOG_SET`, `installedCatalogTools(isInstalled)` (sorted in Node), shape constants `TOOL_NAME_RE` / `TOOL_NAME_MAX_LENGTH` (64) / `INSTALLED_TOOLS_MAX` (512). Zero imports. (~1000 tok)

## src/shims/

- `optional-native-module.ts` — Throws on load; tsup aliases ws's optional native add-ons (`bufferutil`, `utf-8-validate`) to it so ws keeps its not-installed fallback and the bundle resolves nothing from node_modules at runtime. (~203 tok)
- `react-devtools-core.ts` — No-op `{ initialize, connectToDevTools }` default export; tsup alias target for ink's hoisted devtools import (keeping it external crashed the bundle with ERR_MODULE_NOT_FOUND). (~163 tok)

## src/ui/

- `CandidateSelect.tsx` — Candidate list; Tab/Shift+Tab toggles a flagged row to its install form (third useState: Set of `candidateKey`s). Candidate-arrival reset (selection, toggles, non-matching lbuffer query) runs during render via `prevCandidates` (fourth useState), so no effect sees the stale initialQuery render (G-09-7). Enter inserts the displayed text; the search filter matches the displayed text (install form when toggled) and hidden rows keep their toggle; flagged rows start their explanation with cyan ⓘ; selection-independent legend (`ⓘ not installed[ · tab prepends …]`) directly above ControlsLine; ControlsLine takes no props (tab chip removed). Zellij pane hold: a `paneHold` useRef `{ candidates, lines }` (not a fifth state) feeds `heldPaneLines` in the layout effect, so `onLayoutLinesChange` reports the held pane content rows (unfiltered size on arrival, never shrinks for the same candidates array, a new array resets) — filtering spawns no resize (quick-261011-f9o). (~3300 tok)
- `ControlsLine.tsx` — Keyboard hints below the candidate list; optional `tabHint` (`install` | `undo install`) chips between accept and cancel. (~300 tok)
- `LoadingSpinner.tsx` — FRAMES (~134 tok)
- `modal-layout.ts` — Wrapping/row layout; ⓘ `MISSING_TOOL_MARK`, `explanationText` (mark-prefixed explanation), `missingToolsLegend(visible)`, `candidateKey`, `displayedCommand`, `isInstallToggled`; `filterCandidates(list, query)` matches the command or the install form, regardless of the Tab toggle; `MODAL_VIEWPORT_LINES` (18: inline scroll reserve, row count documented); estimator counts the ⚠ footer and legend as separate margin+line blocks; `heldPaneLines(previousHeld, input)` = max(held, current estimate, unfiltered estimate with query '' + row 0 + current toggles): the Zellij pane's per-list high-water content height (quick-261011-f9o). (~2750 tok)
- `Modal.tsx` — Modal (~223 tok)
- `SearchInput.tsx` — Live filter input for narrowing the candidate list. (~108 tok)

## tests/

- `bundle-startup.test.ts` — Builds the real tsup config into a temp dir (no node_modules): every emitted .js (main.js launcher + app.js bundle) loads only Node built-ins (static, literal dynamic import, __require); `--help` of both files works; per-user 0700 compile cache populated under XDG_CACHE_HOME; unwritable / world-writable cache locations fail safe (stderr equals the NODE_DISABLE_COMPILE_CACHE baseline). No timing assertions. (~2000 tok)
- `candidate-select-layout.test.tsx` — Real-hooks Ink render (no react/ink mocks; Writable/Readable 78x22 TTY fakes) checking CandidateSelect's layout reports and the Zellij resize spawn on candidate arrival; `mountArrival` (press/rerender/close helpers), `spawnedHeights`, `lastFrame`, and `replayScreen` (tiny terminal model of Ink's writes incl. ESC 7 / ESC 8 save/restore: header row, stale rows, scroll). (d) smt2 pre-filter draws filtered but reports the unfiltered height; (e) "header row": pane PTY rows (height − 2 chrome) fit the drawn frame; (f) typing `smt` + 3 Backspaces keeps the pane at the arrival height; (g) a new candidates array resets the hold. `instant frame takeover` (quick 261011-jbh): t1-t5 replay the real widget bytes (spawnSync zsh) + reserve + armed real-Ink loading frame (inline full/cleared screen, Zellij pane file, 200-char lbuffer, no instant frame); t6 takeover unit cases. (~9500 tok)
- `candidate-select.test.tsx` — Mocked-hooks CandidateSelect tests (useState by call order, useEffect stubbed, useRef a plain `{ current }` function for the pane hold): live search, Tab install toggle, Enter/Esc, effect count (3). Cannot see effect ordering — use candidate-select-layout.test.tsx for that. (~6500 tok)
- `claude-cli-provider.test.ts` — claudeDefaultAdapter with `runClaudeTurn` mocked (importOriginal spread): stream-json argv, prompt on stdin not argv, cwd/budget, signal forwarded, abort re-thrown unmapped, SDK-path cases, D13/ENOENT/timeout copy; `claude -p turn stage logs` describe (cli stage order filtered to `cli ` lines, FORBIDDEN_DEBUG). (~5200 tok)
- `claude-process.test.ts` — runClaudeTurn against real `fake-claude-stream.mjs` children: settles on result before exit, one stdin user line and no prompt in argv, SIGTERM abort drops later deltas and exit 143, is_error auth rejection; afterEach SIGKILLs recorded pids. Plans 05/06 extend it. (~1500 tok)
- `claude-exec.test.ts` — Unmocked stdin-EOF child plus execFile stdio-ignore documentation (~386 tok)
- `claude-provider.test.ts` — createMock: buildEnvelope (~2261 tok)
- `client-result.test.ts` — runForegroundClient result/FIFO/Zellij paths; Esc during loading (onCancel from the ink render mock) writes cancel, aborts the adapter signal, never rerenders; installed-tool awareness via the real `_qq_write_tool_handoff` (flags A-D, envelope carries sorted catalog ∩ installed incl. function `nvm`, no chunk ⇒ prompt === QUEQUE_SYSTEM). (~8300 tok)
- `command-words-fuzz.test.ts` — spawnSync fuzz of the shipped lexer in child processes: 20k seed 1 (15 s kill), 5k seed 7 (10 s kill), 33 crafted malformed inputs (1 s kill each), deep 2000 < 100 ms (best of up to 3 runs, logged); 16 MiB maxBuffer; reports the last stderr input on failure. (~900 tok)
- `command-words.test.ts` — Spike 002 40-case table + 09-REVIEW regression table (zsh -f `${(k)builtins}` builtins), kind classification, D-06 install words, robustness (8193 chars, prototype keys, `"rg\`), frozen lexHand op/redir/comment token contract incl. heredoc-body and continuation tokens. (~1700 tok)
- `context-pipeline.test.ts` — Declares buildRequest (~1550 tok)
- `controls-line.test.tsx` — Calls `ControlsLine(props)` directly and flattens its element tree; asserts no tab chip without a hint, the exact chip order with `tabHint: 'install'`, and the `undo install` chip. (~500 tok)
- `daemon-bootstrap.test.ts` — ensureDaemon keep/replace/spawn cases incl. pongs lacking `fetchCandidates` or `installedTools`; server pong advertises both flags. (~2300 tok)
- `daemon-fetch.test.ts` — Real `startDaemonServer` fetch IPC: candidates, adapter errors, in-process fallback, installed-tools chunk accepted, catalog drift filtered (`qqfuturetool` dropped), malformed chunk ignored (not accepted < 2 s), abort after fetch-accepted reaches the adapter signal via socket close, no fallback after abort. (~2000 tok)
- `debug-log.test.ts` — Declares appendFileMock (~484 tok)
- `env-file.test.ts` — Declares root (~862 tok)
- `init-command.test.ts` — Declares stub (~350 tok)
- `intent-router.test.ts` — Declares makeRequest (~2122 tok)
- `main-direct-run.test.ts` — --------------------------------------------------------------------------- (~710 tok)
- `modal-layout.test.ts` — wrapText, filterCandidates, estimateCandidateSelectLines (flag rows, legend, install toggle), explanationText, missingToolsLegend, candidateKey; MODAL_VIEWPORT_LINES fits 3 two-line candidates + header + ⚠ footer + ⓘ legend (18); heldPaneLines (narrowing, pre-filter, ⚠ row then filter keeps height, grows past held, hidden toggled row counts, loading/error). (~1500 tok)
- `privacy-filter.test.ts` — Returns the test config file path set in beforeEach. (~2471 tok)
- `provider-detect.test.ts` — --------------------------------------------------------------------------- (~3034 tok)
- `provider-resolver.test.ts` — Declares resetRegistries (~774 tok)
- `qq-config.test.ts` — Declares parsed (~189 tok)
- `registry-bootstrap.test.ts` — Declares hookIds (~689 tok)
- `registry.test.ts` — Declares makeContextProvider (~1515 tok)
- `shell-contract.test.ts` — Declares validCancel (~804 tok)
- `steering.test.ts` — Catalog, lenient/strict `installed-tools` schemas (incl. catalog drift), builder wording and byte-stability, `adapters` source guard over src/providers/ (rules a-d). (~2300 tok)
- `tool-awareness.test.ts` — Characterization tests for missing-tool semantics, installer choice, package aliases, install forms/wrapping/blocked plans and annotateCandidates (incl. CR-02: no install form for a wrapper option value such as `sudo --user root`). (~3573 tok)
- `tool-handoff.test.ts` — readToolHandoff — reads the zsh-written session-dir handoff into a ToolInventory. (~1431 tok)
- `zellij-pane-resize.test.ts` — argv, height cap, trailing cursor row mapping (QQ_PANE_HEIGHT=24: 15→18, 21→24, 22→24, min 6), pane-id format, dedupe, outside-Zellij no-op; fake Zellij applies heights in completion order: slower stale action lands last, coalescing to the newest, equal-height drop, ENOENT error release, RESIZE_SETTLE_TIMEOUT_MS kill release, every child unref'd. (~1900 tok)
- `zsh-widget.test.ts` — Smoke tests for the zsh ZLE widget (`shell/zsh/queque.zsh`): trigger capture, result application, tool handoff (ERR-trap safety, placement, shape guard, 25 ms timing), and `instant frame` z1-z10 (rows, sanitising, truncation, reserve drift guard vs inlineScrollReserve, kill switch, pane file + `/bin/sh` wrapper, placement; `runZshArgs` passes user text as positional params). (~7917 tok)

## tests/fixtures/

- `command-words-cases.ts` — `COMMAND_WORD_CASES` / `CommandWordCase`: the 40 spike 002 cases verbatim (`stretch` is a label, not an opt-out); `REVIEW_CASES`: 09-REVIEW regression commands (heredocs, continuations, wrapper options) with their expected externals. (~900 tok)
- `fake-claude-stream.mjs` — Real-child fake of `claude -p` stream-json (Claude Code 2.1.285 shapes, Probes 2/3/5/8); scenario = argv[2]: `success` (deltas 20 ms apart, ⓘ bytes split across two writes, result then exit 0 after 300 ms), `auth` (is_error result, subtype success, exit 1), `sigterm-slow` (deltas every 100 ms, on SIGTERM keeps writing 300 ms then exit 143); silent until the first stdin line, EOF with no line = exit 0; `FAKE_CLAUDE_STDIN_FILE`, `FAKE_CLAUDE_ARGV_FILE`. Plans 05/06 add scenarios to `SCENARIOS`. (~1800 tok)
- `command-words-fuzz-child.mjs` — Fuzz child that imports `src/shared/command-words.ts` via Node 24 type stripping; modes `fuzz <count> [seed]` (mulberry32), `one <input>`, `deep <n>`; exit 0 ok / 2 slow / 3 undefined leak / 64 unknown mode. (~800 tok)
