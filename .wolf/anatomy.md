# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-11-15T10:02:39.618Z
> Files: 769 tracked | Anatomy hits: 0 | Misses: 0

## ./

- `.gitignore` — Git ignore rules (~54 tok)
- `.releaserc.json` (~363 tok)
- `biome.json` (~213 tok)
- `CHANGELOG.md` — User-facing release notes: Features / Bug Fixes / Deprecations highlights with conventional-commit lists under `<details>` (LLM-written from the changeset at release). Unreleased = v0.5.0..HEAD. (~2200 tok)
- `CLAUDE.md` — OpenWolf (~1668 tok)
- `CONTRIBUTING.md` — Contributing: dev setup, live debug log (always-on `/tmp/qq-<uid>-debug.log`), Claude Provider env table (key optional, `claude -p` login route, QQ_MODEL `claude-sonnet-5` SDK route only) Client raw stderr reaches QQ_DEBUG_LOG_FILE only when set (else session-dir client.err). QQ_TEST_RESULT_MODE: only the two fixture names count. (~1450 tok)
- `lefthook.yml` (~320 tok)
- `marketing-post.md` — QueQue — LinkedIn Launch Post (~617 tok)
- `package.json` — Node.js package manifest Phase 10 scripts: smoke:distro, test:distro, test:live. (~499 tok)
- `README.md` — Project documentation: H1 `# QueQue *(kew-kew)*[^name]` (GFM footnote at the end explains *question question*: `??` and `qq`), bold tagline (Type what you want. Hit `??`. Pick a command.) and "Nothing runs until you press Enter", a one-line example block, demo gif, then the shell badge row (zsh/bash `${failBelow}+` from SHELL_SPECS, fish coming soon) linking docs/INSTALL.md anchors. Install (brew block only, then one See-Install sentence for npm, requirements, macOS bash notes and undo), then a `Tested on:\` line over six static distro badges (alt = ci.yml image ref, CI runs link) plus a macOS badge (tested by hand, links docs/INSTALL.md); no workflow-status badges, no support table. Then Choose a provider and Usage; absolute `https://github.com/k-leumas/queque/blob/main/` doc links (npm ships README alone) (quick 261030-fdr, 261115-3qz, 261115-4um; rebrand 2026-11-17) (~1150 tok)
- `tsconfig.json` — TypeScript configuration (~180 tok)
- `tsup.config.ts` — Build: entry { main: src/cli/launcher.ts, app: src/cli/main.ts } → dist/cli; `noExternal: [/.*/]` (every dependency inlined into app.js); esbuild aliases react-devtools-core / bufferutil / utf-8-validate to src/shims; banner = shebang + createRequire `require` for CJS deps; defines __QUEQUE_COMMIT__/__QUEQUE_VERSION__; dts + sourcemaps kept. Phase 10: `define` also bakes __QUEQUE_TELEMETRY_KEY__ (empty until plan 13, D-22) and __QUEQUE_TELEMETRY_HOST__ (`https://eu.i.posthog.com`, D-05). Quick 261030-tq3: __QUEQUE_BUILD_ID__ = `<version>+<commit>.<Date.now base36>`, computed once per tsup config load (watch rebuilds share one id). (~680 tok)
- `vitest.config.ts` — Vitest base config: tests/**/*.test.ts(x), setupFiles scrub-git-env; defines __QUEQUE_COMMIT__, __QUEQUE_VERSION__, __QUEQUE_BUILD_ID__ ('0.0.0-test+test-build', quick 261030-tq3) and an inert telemetry key/host. vitest.live inherits `define`. Quick 261117-jpp: `test.env` QQ_NO_UPDATE_CHECK=1 so no test reaches the npm registry. (~230 tok)
- `vitest.live.config.ts` — /*.test.ts`) never Quick 261117-jpp: repeats `test.env` QQ_NO_UPDATE_CHECK=1 (fresh config, no merge). (~198 tok)

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

- `bash-integration.md` — blueprint: bash ≥5.0 ?? adapter (bind -x, READLINE_*, compgen handoff, Zellij FIFO, PS1 head) (~1300 tok)
- `bash-integration.md` — bash integration (`??` in bash ≥5.0) (~1173 tok)
- `candidate-command-check.md` — Candidate Command Check (flag suggestions that use missing tools) (~1016 tok)
- `fish-integration.md` — blueprint: fish 4.x ?? adapter (bind/commandline, string collect, cat+guard FIFO read, repaint padding) (~1300 tok)
- `fish-integration.md` — fish integration (`??` in fish 4.x) (~1142 tok)
- `installed-command-handoff.md` — Installed-Command Handoff (zsh → qq client) (~841 tok)
- `prompt-steering.md` — Prompt Steering With the Installed List (~828 tok)

## .claude/worktrees/agent-a0683766a13a0d567/.github/workflows/

- `ci.yml` — Push and PR CI (D-14). Runs on every branch push, every pull_request and on demand. (~1850 tok)

## .claude/worktrees/agent-a0683766a13a0d567/.planning/phases/11-multi-shell-trigger-support-bash-and-fish/

- `11-09-SUMMARY.md` — Phase 11 Plan 09: Distro bash smoke, bash-versions CI and Homebrew bash adapter Summary (~3486 tok)

## .claude/worktrees/agent-a0683766a13a0d567/scripts/

- `smoke-distro-runner.sh` — In-container half of scripts/smoke-distro.sh. POSIX sh, runs as root in a fresh (~2199 tok)
- `smoke-distro.sh` (~980 tok)

## .claude/worktrees/agent-a0683766a13a0d567/scripts/ci/

- `bash-version-check.sh` — Usage: bash-version-check.sh refuse|accept (~990 tok)

## .claude/worktrees/agent-a0f685ede72cc35a6/.planning/phases/11-multi-shell-trigger-support-bash-and-fish/

- `11-08-SUMMARY.md` — Phase 11 Plan 08: bash diagnostics in `qq doctor` Summary (~4292 tok)

## .claude/worktrees/agent-a0f685ede72cc35a6/src/cli/

- `main.ts` — Exports main (~1576 tok)

## .claude/worktrees/agent-a0f685ede72cc35a6/src/cli/commands/

- `doctor.ts` — Unix socket path limits from the Node docs (107 bytes on Linux, 103 on macOS). (~8634 tok)

## .claude/worktrees/agent-a0f685ede72cc35a6/tests/

- `doctor.test.ts` — The zsh target's twelve rows, in order (Phase 10; unchanged by Phase 11). (~12044 tok)

## .claude/worktrees/agent-a12c46af7c526c5d0/.planning/phases/11-multi-shell-trigger-support-bash-and-fish/

- `11-06-SUMMARY.md` — Phase 11 Plan 06: Instant frame spec and bash painter Summary (~4569 tok)

## .claude/worktrees/agent-a12c46af7c526c5d0/shell/bash/

- `queque.bash` — shellcheck shell=bash (~4365 tok)

## .claude/worktrees/agent-a12c46af7c526c5d0/src/client/

- `instant-frame.ts` — Instant first frame takeover (quick 261011-jbh, LD-1). (~1324 tok)

## .claude/worktrees/agent-a12c46af7c526c5d0/src/shared/

- `instant-frame-spec.ts` — The instant first frame, as one TypeScript reference (Phase 11 D-04; quick 261011-jbh, LD-1). (~1792 tok)

## .claude/worktrees/agent-a12c46af7c526c5d0/src/ui/

- `CandidateSelect.tsx` — Fixed left gutter width — active glyph and inactive spaces both occupy this width so command text ne (~5817 tok)
- `LoadingSpinner.tsx` — FRAMES[0] is the loading text the shell adapters paint in the instant frame (Phase 11 D-04). (~188 tok)
- `modal-layout.ts` — Mark that starts the explanation of a candidate using a tool zsh cannot resolve (D-08). (~2962 tok)

## .claude/worktrees/agent-a12c46af7c526c5d0/tests/

- `bash-widget.test.ts` — Helper tests for the bash readline adapter (`shell/bash/queque.bash`, Phase 11 BASH-01). (~5244 tok)
- `instant-frame-parity.test.ts` — Cross-shell byte parity for the instant frame (Phase 11 D-04, quick 261011-jbh LD-1). (~3392 tok)

## .claude/worktrees/agent-a1536771d36d290f8/.planning/phases/11-multi-shell-trigger-support-bash-and-fish/

- `11-03-SUMMARY.md` — Phase 11 Plan 03: Shell-aware tool handoff and command-word lexer Summary (~4510 tok)

## .claude/worktrees/agent-a1536771d36d290f8/src/client/

- `tool-handoff.ts` — Fixed sibling filenames a shell adapter's `??` widget writes next to request.json (~1371 tok)

## .claude/worktrees/agent-a1b3b715f798c3738/shell/bash/

- `queque.bash` — shellcheck shell=bash (~7482 tok)

## .claude/worktrees/agent-a337e7a5046250a2b/.planning/phases/11-multi-shell-trigger-support-bash-and-fish/

- `11-07-SUMMARY.md` — Phase 11 Plan 07: bash tool handoff, prewarm and Zellij pane Summary (~4802 tok)

## .claude/worktrees/agent-a337e7a5046250a2b/shell/bash/

- `queque.bash` — shellcheck shell=bash (~6770 tok)

## .claude/worktrees/agent-a337e7a5046250a2b/tests/

- `bash-widget.test.ts` — Helper tests for the bash readline adapter (`shell/bash/queque.bash`, Phase 11 BASH-01). (~11317 tok)
- `shell-pty.test.ts` — Multi-line diagnostics (screens, logs) as one quote-free line joined by ` | `: a multi-line (~4650 tok)

## .claude/worktrees/agent-a3f8055ae191c3229/

- `CONTRIBUTING.md` — Contributing (~1764 tok)

## .claude/worktrees/agent-a3f8055ae191c3229/.planning/phases/11-multi-shell-trigger-support-bash-and-fish/

- `11-01-SUMMARY.md` — Phase 11 Plan 01: bash `??` tracer and PTY harness Summary (~5170 tok)

## .claude/worktrees/agent-a3f8055ae191c3229/scripts/ci/

- `install-distro-deps.sh` — Installs what QueQue needs on a fresh Linux distro image: git, zsh, bash, jq, expect, (~1339 tok)

## .claude/worktrees/agent-a3f8055ae191c3229/shell/bash/

- `queque.bash` — bash 5.0+ readline adapter: bind -x on ? (emacs+vi-insert), interactive guard, 'needs bash 5.0+' refusal, jq request.json shell:bash, inline qq client, READLINE_LINE/POINT apply with QQ_ORIG_POINT restore (~2434 tok)

## .claude/worktrees/agent-a3f8055ae191c3229/src/cli/commands/

- `client.ts` — Real client command handler. (~517 tok)

## .claude/worktrees/agent-a3f8055ae191c3229/src/client/

- `run-foreground.ts` — Splits a command + explanation into shell buffer halves. (~7035 tok)

## .claude/worktrees/agent-a3f8055ae191c3229/src/contracts/

- `shell.ts` — Every shell QueQue knows (Phase 11 D-02). A shell adapter lives at (~703 tok)

## .claude/worktrees/agent-a3f8055ae191c3229/tests/

- `bash-widget.test.ts` — Helper tests for the bash readline adapter (`shell/bash/queque.bash`, Phase 11 BASH-01). (~2980 tok)
- `context-pipeline.test.ts` — Declares buildRequest (~1555 tok)
- `intent-router.test.ts` — Declares makeRequest (~2127 tok)
- `shell-pty.test.ts` — Multi-line diagnostics (screens, logs) as one quote-free line joined by ` | `: a multi-line (~4074 tok)

## .claude/worktrees/agent-a3f8055ae191c3229/tests/helpers/

- `shells.ts` — Searched after PATH: Homebrew (Apple silicon, Intel), MacPorts, then the system dirs. (~1140 tok)

## .claude/worktrees/agent-a3f8055ae191c3229/tests/pty/

- `drive.sh` — tests/pty/drive.sh: drive an interactive zsh or bash in a private tmux server (Phase 11 D-10). (~794 tok)

## .claude/worktrees/agent-a42288e8a0c40af47/.github/workflows/

- `ci.yml` — Push and PR CI (D-14). Runs on every branch push, every pull_request and on demand. (~1870 tok)

## .claude/worktrees/agent-a42288e8a0c40af47/scripts/ci/

- `bash-version-check.sh` — Usage: bash-version-check.sh refuse|accept (~1427 tok)

## .claude/worktrees/agent-a42288e8a0c40af47/shell/bash/

- `queque.bash` — shellcheck shell=bash (~7181 tok)

## .claude/worktrees/agent-a42288e8a0c40af47/tests/

- `bash-widget.test.ts` — Helper tests for the bash readline adapter (`shell/bash/queque.bash`, Phase 11 BASH-01). (~11679 tok)
- `shell-pty.test.ts` — Multi-line diagnostics (screens, logs) as one quote-free line joined by ` | `: a multi-line (~5384 tok)

## .claude/worktrees/agent-a69c0cacb81a465ce/.planning/phases/11-multi-shell-trigger-support-bash-and-fish/

- `11-05-SUMMARY.md` — Phase 11 Plan 05: Shell-aware telemetry environment Summary (~3753 tok)

## .claude/worktrees/agent-a6b88ee339a5f6c80/.planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/

- `10-12-SUMMARY.md` — Phase 10 Plan 12: GitHub CI Proof and Revert Drill Summary (~4329 tok)

## .claude/worktrees/agent-abef3015cfebacee8/.planning/phases/11-multi-shell-trigger-support-bash-and-fish/

- `11-02-SUMMARY.md` — Phase 11 Plan 02: shell identity in the context and prompt Summary (~3343 tok)

## .claude/worktrees/agent-abef3015cfebacee8/src/providers/

- `claude.ts` — Moved to steering.ts in Phase 9; re-exported so existing importers keep compiling. (~5578 tok)

## .claude/worktrees/agent-abef3015cfebacee8/tests/

- `claude-provider.test.ts` — Text pieces emitted as `text` events, in order, before finalMessage settles. (~8603 tok)
- `shell-contract.test.ts` — A request.json as a pre-Phase-11 zsh widget writes it: no `shell`, no `shellVersion`. (~1664 tok)
- `zsh-widget.test.ts` — Smoke tests for the zsh ZLE widget (`shell/zsh/queque.zsh`). (~14461 tok)

## .claude/worktrees/agent-acce3f5bef6c7f99f/.planning/phases/11-multi-shell-trigger-support-bash-and-fish/

- `11-04-SUMMARY.md` — Phase 11 Plan 04: Shell registry and `qq init [shell]` Summary (~3268 tok)

## .claude/worktrees/agent-acce3f5bef6c7f99f/src/cli/commands/

- `init.ts` — `qq init [shell]` (Phase 11 D-08, D-09, D-12, D-14): detect the login shell, gate bash below (~2620 tok)

## .claude/worktrees/agent-acce3f5bef6c7f99f/src/registry/

- `bootstrap.ts` — Registers all Phase 2 built-ins into their respective registries. (~806 tok)

## .claude/worktrees/agent-acce3f5bef6c7f99f/src/shared/

- `shell-registry.ts` — One per-shell registry (Phase 11 D-02, D-08): every fact `qq init` and `qq doctor` need about (~2170 tok)

## .claude/worktrees/agent-acce3f5bef6c7f99f/tests/

- `init-command.test.ts` — InitDeps: fakeInit (~4275 tok)
- `registry-bootstrap.test.ts` — Declares adapters (~890 tok)
- `shell-registry.test.ts` — Declares zsh (~2078 tok)

## .claude/worktrees/agent-ae0e9549a31c00864/

- `README.md` — Project documentation (~1187 tok)

## .claude/worktrees/agent-ae0e9549a31c00864/.planning/phases/11-multi-shell-trigger-support-bash-and-fish/

- `11-10-SUMMARY.md` — Phase 11 Plan 10: Shell-neutral docs, the adapter contract and the SHELL_NAMES invariant Summary (~3304 tok)

## .claude/worktrees/agent-ae0e9549a31c00864/docs/

- `INSTALL.md` — Install (~668 tok)

## .claude/worktrees/agent-ae0e9549a31c00864/shell/

- `README.md` — Project documentation (~2654 tok)

## .claude/worktrees/agent-ae0e9549a31c00864/tests/

- `shell-names-invariant.test.ts` — SHELL_NAMES invariant (Phase 11 D-02, the "promote" decision): every shell QueQue knows must (~688 tok)

## .claude/worktrees/agent-aedd4b806c24b1e4a/.planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/

- `10-12-SUMMARY.md` — Phase 10 Plan 12: GitHub CI Proof and Revert Drill Summary (~6996 tok)

## .github/workflows/

- `ci.yml` — Push and PR CI (D-14): push `**`, pull_request, workflow_dispatch; per-event concurrency that never cancels main. Jobs changes (code-changed.mjs), checks (lint/typecheck/test:run/build), distro (distro.yml with 6 pinned images), ci-ok (always(), the only required check) and auto-revert (push only, distro failed, not auto-revert/*, contents/pull-requests write + actions read, download-artifact@v8 into runner.temp). Heavy jobs run unless `code == 'false'` (10-05, 10-07). (~1215 tok)
- `distro.yml` — Reusable distro matrices (workflow_call, input `images` JSON): test-distro runs scripts/ci/test-in-distro.sh, smoke runs scripts/smoke-distro.sh; fail-fast off; `smoke-<slug>` artifacts uploaded always, 14 days (10-05). (~547 tok)
- `homebrew.yml` — CI: Update Homebrew Tap (~957 tok)
- `nightly.yml` — `Nightly`: schedule `23 3 * * *` plus workflow_dispatch. Job distro reuses distro.yml with ubuntu/debian/fedora/archlinux/alpine `:latest`; job live (repo guard `k-leumas/queque`) runs `pnpm test:live` with the secret in step env. Read-only token, not a required check (10-08). (~498 tok)
- `release.yaml` — CI: Release (~1842 tok)
- `tap-clone-stats.yml` — `Tap clone stats`: schedule `17 6 * * 1` (Mondays 06:17 UTC) plus workflow_dispatch. Reads k-leumas/homebrew-tap per-day clone traffic and subtracts per UTC day the "Release to Homebrew tap" steps (release.yaml, homebrew.yml; success or failure, all attempts) as release_clones, clamped adjusted_count/adjusted_uniques; merges into stats/tap-clones.json on the orphan `stats` branch (ls-remote exit 2 then `git switch --orphan`; `git push origin stats`, never main). TRAFFIC_TOKEN (fine-grained PAT) as GH_TOKEN in the fetch step only; contents: write; summary rows Raw and Adjusted. Offline harness: .planning/quick/261105-ix8-*/verify-tap-clone-stats.sh (quick 261105-ix8). (~1630 tok)

## .gsd/

- `PROJECT.md` — QueQue (~1526 tok)
- `REQUIREMENTS.md` — Requirements (~1662 tok)

## .planning/

- `.continue-here.md` — Session Handoff — Homebrew Binary Fix + Tooling Cleanup (~1144 tok)
- `config.json` (~258 tok)
- `HANDOFF.json` — Declares correctly (~1406 tok)
- `PROJECT.md` — QueQue (~1525 tok)
- `REQUIREMENTS.md` — Requirements: QueQue (~1313 tok)
- `ROADMAP.md` — Roadmap: QueQue (~7983 tok)
- `STATE.md` — Project State (~3580 tok)

## .planning/debug/

- `empty-modal-after-tool-awareness-reenable.md` — Current Focus (~3416 tok)
- `llm-response-latency-profile.md` — Symptoms (~6991 tok)
- `modal-blank-before-loading.md` — Symptoms (~493 tok)
- `modal-filter-prefilled-with-query.md` — Current Focus (~3427 tok)

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
- `08-REVIEW-FIX.md` — Phase 8: Code Review Fix Report (~3034 tok)
- `08-REVIEW.md` — Phase 8: Code Review Report (iteration 3, incremental diff 3eb8bfb..HEAD) (~3419 tok)
- `08-REVIEWS.md` — Cross-AI Plan Review — Phase 8 (~2352 tok)
- `08-SECURITY.md` — threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking g (~2301 tok)
- `08-VALIDATION.md` — Phase 8 — Validation Strategy (~990 tok)
- `08-VERIFICATION.md` — Phase 08: Zero-Config Install and Provider Detection Verification Report (~6737 tok)
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
- `09.1-08-SUMMARY.md` — Phase 09.1 Plan 08: Phase Gate, OpenWolf Records and Latency UAT Prep Summary (~5691 tok)
- `09.1-09-PLAN.md` — Gap closure G-09.1-5 (UAT test 5): FILTER opens empty, lbuffer header-only, typed text is the whole filter; tracer real-Ink regression + CandidateSelect seed fix, pre-fill tests rewritten (none deleted), 03.1 D-01/D-02 superseded, OpenWolf/debug records (~9359 tok)
- `09.1-09-SUMMARY.md` — Phase 09.1 Plan 09: Empty FILTER on Open (G-09.1-5) Summary (~4197 tok)
- `09.1-10-PLAN.md` — Gap closure CR-01 (verification P9-6): Backspace dropped when it shares a stdin read with typed keys; tracer real-Ink one-chunk regression + per-render `pendingInput` snapshot read by every CandidateSelect key handler (Backspace, typing, Tab, Enter, arrows), invariance it.each (arrow/DEL-separated chunks; Ink keeps CR/Tab inside text runs), CR-01 disposition fixed, OpenWolf records (~11136 tok)
- `09.1-10-SUMMARY.md` — Phase 09.1 Plan 10: Coalesced stdin read (CR-01) Summary (~3051 tok)
- `09.1-CONTEXT.md` — Phase 09.1: Provider Latency and Cancellation - Context (~2714 tok)
- `09.1-DISCUSSION-LOG.md` — Phase 09.1: Provider Latency and Cancellation - Discussion Log (~847 tok)
- `09.1-PATTERNS.md` — Phase 09.1: Provider Latency and Cancellation - Pattern Map (~3593 tok)
- `09.1-RESEARCH.md` — Phase 09.1: Provider Latency and Cancellation - Research (~17961 tok)
- `09.1-REVIEW-FIX.md` — Phase 09.1: Code Review Fix Report (~2739 tok)
- `09.1-REVIEW.md` — Phase 09.1: Code Review Report (~3339 tok)
- `09.1-VALIDATION.md` — status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6) (~2166 tok)
- `09.1-VERIFICATION.md` — Phase 09.1: Provider Latency and Cancellation Verification Report (~6435 tok)
- `COVERAGE.md` — API Coverage — Anthropic Messages API (TS SDK 0.92.0) and Claude Code print mode (2.1.285) (~681 tok)

## .planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/

- `10-01-PLAN.md` — Artifacts this phase produces (~8944 tok)
- `10-02-PLAN.md` — Artifacts this phase produces (~3548 tok)
- `10-03-PLAN.md` — Artifacts this phase produces (~5803 tok)
- `10-04-PLAN.md` — Artifacts this phase produces (~7397 tok)
- `10-05-PLAN.md` — Artifacts this phase produces (~6769 tok)
- `10-06-PLAN.md` — Artifacts this phase produces (~8032 tok)
- `10-07-PLAN.md` — Artifacts this phase produces (~4522 tok)
- `10-08-PLAN.md` — Artifacts this phase produces (~3645 tok)
- `10-09-PLAN.md` — Artifacts this phase produces (~3273 tok)
- `10-10-PLAN.md` — Artifacts this phase produces (~4637 tok)
- `10-11-PLAN.md` — Artifacts this phase produces (~6980 tok)
- `10-12-PLAN.md` — Artifacts this phase produces (~5039 tok)
- `10-13-PLAN.md` — Artifacts this phase produces (~5222 tok)
- `10-CONTEXT.md` — Phase 10: Linux distro CI harness and anonymous telemetry - Context (~2801 tok)
- `10-DISCUSS-CHECKPOINT.json` (~360 tok)
- `10-DISCUSSION-LOG.md` — Phase 10: Linux distro CI harness and anonymous telemetry - Discussion Log (~825 tok)
- `10-PATTERNS.md` — Phase 10: Linux distro CI harness and anonymous telemetry - Pattern Map (~3292 tok)
- `10-RESEARCH.md` — Phase 10: Linux distro CI harness and anonymous telemetry - Research (~22000 tok)
- `10-REVIEW-FIX.md` — Phase 10: Code Review Fix Report (~1991 tok)
- `10-REVIEW.md` — Phase 10: Code Review Report (re-review after the fix run) (~3189 tok)
- `10-VERIFICATION.md` — Phase 10: Linux distro CI harness and anonymous telemetry Verification Report (~3689 tok)
- `COVERAGE.md` — API Coverage — PostHog Cloud EU public capture API, and the GitHub REST API (via `gh` in CI) (~735 tok)

## .planning/phases/11-multi-shell-trigger-support-bash-and-fish/

- `11-01-PLAN.md` — Artifacts this phase produces (~12224 tok)
- `11-02-PLAN.md` — Artifacts this phase produces (~5990 tok)
- `11-03-PLAN.md` — Artifacts this phase produces (~7369 tok)
- `11-04-PLAN.md` — Artifacts this phase produces (~8936 tok)
- `11-05-PLAN.md` — Artifacts this phase produces (~6270 tok)
- `11-06-PLAN.md` — Artifacts this phase produces (~7870 tok)
- `11-07-PLAN.md` — Artifacts this phase produces (~8332 tok)
- `11-08-PLAN.md` — Artifacts this phase produces (~7187 tok)
- `11-09-PLAN.md` — Artifacts this phase produces (~7340 tok)
- `11-10-PLAN.md` — Artifacts this phase produces (~6192 tok)
- `11-11-PLAN.md` — Declared files are the .wolf/ records. If a Task 1 gate fails, the fix lands in the owning (~5913 tok)
- `11-CONTEXT.md` — Phase 11: Multi-shell trigger support (bash, fish-ready) - Context (~2667 tok)
- `11-DISCUSS-CHECKPOINT.json` (~443 tok)
- `11-DISCUSSION-LOG.md` — Phase 11: Multi-shell trigger support (bash, fish-ready) - Discussion Log (~844 tok)
- `11-PATTERNS.md` — Phase 11: Multi-shell trigger support (bash, fish-ready) - Pattern Map (~4891 tok)
- `11-RESEARCH.md` — Phase 11: Multi-shell trigger support (bash, fish-ready) - Research (~17835 tok)
- `11-REVIEW-FIX.md` — Phase 11: Code Review Fix Report (~2388 tok)
- `11-REVIEW.md` — Phase 11: Code Review Report (~3548 tok)
- `11-SECURITY.md` — threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking g (~2154 tok)
- `11-VALIDATION.md` — status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6) (~1816 tok)
- `11-VERIFICATION.md` — Phase 11: Multi-shell trigger support (bash, fish-ready): Verification Report (~5486 tok)

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

## .planning/quick/261012-kp1-rewrite-changelog-md-to-user-facing-feat/

- `261012-kp1-PLAN.md` (~912 tok)
- `261012-kp1-SUMMARY.md` — Summary: User-facing changelog (~182 tok)

## .planning/quick/261017-4kt-update-the-readme-to-match-the-current-f/

- `261017-4kt-PLAN.md` — Code-grounded facts (observed by the planner on 2026-10-17; re-check each one against the cited code (~5812 tok)
- `COVERAGE.md` (~46 tok)

## .planning/quick/261017-5q6-fix-the-stale-init-command-in-homebrew-y/

- `261017-5q6-PLAN.md` — Quick plan: replace the stale `>>` init redirect with `qq init zsh && source ~/.zshrc` in src/cli/main.ts help, shell/zsh/queque.zsh qq-not-found zle message, release.yaml + homebrew.yml caveats (tracer); caveats auth-first with `claude /login`; CONTRIBUTING.md key optional / QQ_MODEL `claude-sonnet-5` / debug log default; python yaml + ruby caveats render gate (~6700 tok)
- `COVERAGE.md` — api-coverage gate declaration: no external API integration (docs/help wording only) (~64 tok)

## .planning/quick/261021-sya-fix-changelog-links-leaking-x-access-tok/

- `261021-sya-PLAN.md` — Declares normalizeRepositoryUrl (~3906 tok)
- `261021-sya-SUMMARY.md` — Quick 261021-sya Plan 01: Fix Changelog Links Leaking x-access-token Summary (~928 tok)

## .planning/quick/261030-en8-add-badges-to-the-readme-for-all-the-pas/

- `261030-en8-PLAN.md` — /*.test.ts`. tsconfig includes tests. There is no YAML parser dependency, so extract `images:` with (~4947 tok)

## .planning/quick/261030-fdr-reformat-the-readme-minimal-move-the-res/

- `261030-fdr-PLAN.md` — Quick plan: minimal README (H1, badges, pitch, gif, Install, Choose a provider, Usage, More) with detail moved verbatim to docs/INSTALL, PROVIDERS, USAGE, PRIVACY (+ telemetry), CONFIGURATION; README links docs via absolute GitHub blob URLs (npm ships README alone); tests/docs-links.test.ts guards links/anchors; check-readme-moved.mjs proves no old line lost vs b45f6db (~8700 tok)
- `check-readme-moved.mjs` — One-off preservation check: every line of `git show b45f6db:README.md` (normalized: link targets, `> `, heading markers, whitespace) must appear in README.md + docs/INSTALL, PROVIDERS, USAGE, PRIVACY, CONFIGURATION.md; only six decorative ALLOWED_DROPS; exit 1 lists missing lines (~650 tok)

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

## .planning/spikes/004-bash-readline-trigger/

- `README.md` — spike 004: bash `bind -x` ?? trigger, VALIDATED on 5.0+ (~1100 tok)
- `README.md` — Project documentation (~1191 tok)
- `spike.bash` — stub bash adapter: `?` binding, READLINE_LINE/POINT, 3.2 guard (~350 tok)

## .planning/spikes/005-bash-tui-handoff/

- `drive.sh` — private-tmux driver: fixture / llm-pick / llm-esc / prompt-multiline (~550 tok)
- `queque.bash` — full bash adapter port of qq-question-widget (handoff, FIFO, prompt-head reprint) (~1200 tok)
- `README.md` — spike 005: bash → Ink picker handoff, inline + Zellij, VALIDATED (~900 tok)
- `README.md` — Project documentation (~911 tok)

## .planning/spikes/006-fish-commandline-trigger/

- `drive.sh` — private-tmux driver for fish trigger cases (~450 tok)
- `README.md` — spike 006: fish bind + commandline ?? trigger, VALIDATED on 4.x (~900 tok)
- `README.md` — Project documentation (~881 tok)
- `spike.fish` — stub fish adapter (~300 tok)

## .planning/spikes/007-fish-tui-handoff/

- `drive.sh` — private-tmux driver for fish picker scenarios (~600 tok)
- `queque.fish` — full fish adapter (PATH handoff, FIFO cat + timeout guard, repaint padding) (~1400 tok)
- `queque.fish` — Spike 007: full fish adapter — ports qq-question-widget (shell/zsh/queque.zsh:334). fish ≥4. (~1538 tok)
- `README.md` — spike 007: fish → Ink picker handoff, inline + Zellij, VALIDATED (~950 tok)
- `README.md` — Project documentation (~820 tok)

## docs/

- `config.example.json` — Example `~/.config/qq/config.json` incl. `"effort": "low"` (09.1-02). (~61 tok)
- `CONFIGURATION.md` — Configuration reference, moved verbatim from the README (quick 261030-fdr): the `config.json` field table (`effort`, `privacy.*`, `safety.destructiveCommandPatterns`), links config.example.json, PROVIDERS.md#after-changing-your-key-or-settings and SYSTEM_DESIGN.md. (~700 tok)
- `EXTENSIONS.md` — QueQue Extension Seams (~2376 tok)
- `INSTALL.md` — Install (quick 261030-fdr; Phase 11 11-10): Homebrew, npm, `qq init` for zsh and bash, the bash 5.0 floor and Homebrew bash, optional chsh, the `~/.bash_profile` line, `qq doctor`, undoing `qq init` (remove the two QueQue lines). (~800 tok)
- `PRIVACY.md` — Privacy defaults, moved verbatim from the README (quick 261030-fdr): insertion-only, what leaves the machine per provider, what is never sent, debug logging, user config; plus a source-checked Anonymous telemetry section (consent prompt text, env overrides, the three allow-listed events, install id, PostHog Cloud EU batches dropped on failure, `qq telemetry status|on|off|show`). (~1700 tok)
- `PROVIDERS.md` — Choose a provider, moved verbatim from the README (quick 261030-fdr): Claude (default) with Claude Code login vs `ANTHROPIC_API_KEY` and which route wins, OpenAI or Ollama (beta) via `qq init provider` and `provider.json`, After changing your key or settings (daemon restart). Anchors `#claude-default`, `#openai-or-ollama-beta`, `#after-changing-your-key-or-settings` are linked from CONTRIBUTING.md and README.md. (~1900 tok)
- `RELEASING.md` — Release Process (~1426 tok)
- `SYSTEM_DESGN.md` — System Design (~3530 tok)
- `SYSTEM_DESIGN.md` — System Design; the IPC paragraph covers the streaming reply sequence (`candidate` rows, `candidates` done signal), the three pong flags, abort on socket close and D-16 (09.1-03). Source links are `../`-relative (quick 261030-fdr). (~2900 tok)
- `USAGE.md` — Usage, moved verbatim from the README (quick 261030-fdr): the `??` examples, picker (streaming rows, FILTER box, Enter, Esc), destructive-command mark, Installed-tool awareness (`#installed-tool-awareness`, `QQ_TOOL_AWARENESS=0`), Inside Zellij (`QQ_PANE_WIDTH`/`QQ_PANE_HEIGHT`). (~1000 tok)

## scripts/

- `build-dashboard.mjs` — `, 'wholename']], (~7492 tok)
- `docker-homebrew-smoke-runner.sh` (~567 tok)
- `semantic-release-user-notes.ts` — semantic-release plugin that writes user-facing changelog notes. (~4122 tok)
- `smoke-distro-runner.sh` — In-container half of scripts/smoke-distro.sh. POSIX sh, runs as root in a fresh (~1494 tok)
- `smoke-distro.exp` — Expect PTY driver, `smoke-distro.exp PASS`: passes default (XDG_RUNTIME_DIR unset), c-locale (LANG=C) and consent (QQ_SMOKE_CONSENT=1: first accept shows `[y/N]`, `n`, buffer executes, second accept never asks). Accept (`command not found: tldr`) and Esc (`restored-42`) anchored on the `QQSMOKE%` prompt redraw; idle-prompt regex allows zsh trailing escapes. Exits 10-16, 17 no consent question, 18 asked twice, 19 unknown pass (10-01, 10-11). (~1705 tok)
- `smoke-distro.sh` — `smoke-distro.sh IMAGE [--out DIR]` (env QQ_SMOKE_OUT): host entry with the D-16 Docker check, `pnpm build`, `pnpm pack`, and `docker run` of smoke-distro-runner.sh with the tarball, the fake-claude fixture, scripts/ (ro) and the out dir mounted; prints `smoke-distro: PASS|FAIL IMAGE` and on failure the tails of pty-default/c-locale/consent logs (10-01, 10-11). (~773 tok)
- `smoke-homebrew-docker.sh` (~953 tok)
- `strip-cursor-coauthor-from-msg.sh` — Removes Cursor co-author trailer lines from a git commit message file or stdin. (~114 tok)

## scripts/ci/

- `auto-revert.sh` — D-15 smoke auto-revert (bash, env-only inputs REPO, BRANCH, HEAD_SHA, BEFORE_SHA, RUN_ID, RUN_URL, ARTIFACTS_DIR, GH_TOKEN). Last green = branch push run with smoke passed, then first-parent ancestor by head_sha, then the before SHA, then the merge base with main; else ::warning::. Restores the tree on `auto-revert/<branch, / to ->` with workflow files kept at HEAD (GITHUB_TOKEN cannot push them), force-pushes, then gh pr edit+comment if open else create. Body: failing jobs, run URL, doctor.json and log tails, sanitized, 60000-char cap (10-07). (~3562 tok)
- `bash-version-check.sh` — `bash-version-check.sh refuse|accept`, the Phase 11 D-12 check inside one official `bash:<tag>` image (repo at /w, read-only): a non-interactive source is silent; refuse = one `needs bash 5.0+` line and no `_qq_question`; accept = function defined and `?` in `bind -m emacs -X`. POSIX sh (busybox); run by the ci.yml `bash-versions` job on bash:3.2, 4.4 (refuse) and 5.0 (accept) (11-09). (~930 tok)
- `code-changed.mjs` — CI doc-only path filter: `isDocOnlyPath` (`*.md`, LICENSE, .planning/, .wolf/, docs/, .github/ISSUE_TEMPLATE/), `codeChanged(paths)`. Base is QQ_CHANGES_BASE (non-zero, present), else resolveBaseRef().mergeBase. Writes `code=true|false` to $GITHUB_OUTPUT and fails open to true; exits 1 only if $GITHUB_OUTPUT is unwritable (10-05). (~790 tok)
- `install-distro-deps.sh` — POSIX sh, run as root: installs git, zsh, jq, expect, procps and Node 24 per /etc/os-release ID (apk on alpine; nodejs.org tarball checked against SHASUMS256.txt on ubuntu/debian; dnf nodejs24 on fedora; pacman nodejs-lts-krypton on arch), plus pnpm from packageManager unless --no-pnpm. Exits 2 unsupported distro, 3 install failure, 64 usage (10-01). (~1156 tok)
- `test-in-distro.sh` — `test-in-distro.sh IMAGE [vitest args]`: pipes `git archive HEAD` into `docker run`, then install-distro-deps, `pnpm install --frozen-lockfile`, and `pnpm test:run` or `vitest run ARGS`. D-16: without Docker it warns and exits 0 locally, exits 1 with CI set (10-01). (~450 tok)

## shell/

- `README.md` — Shell adapter contract for authors (Phase 11 D-01/D-02, 11-10): trigger rules, session dir, request.json fields (`shell`, `shellVersion`), result kinds, cursor restore, history, the Zellij timeout and setup failures, the tool handoff (`tools.pending`, two-flag `closed` cleanup), instant-frame parity, and the new-shell checklist gated by tests/shell-names-invariant.test.ts. Adapters scope the QQ_RESULT_FILE export to the trigger call. (~2670 tok)

## shell/bash/

- `queque.bash` — bash 5.0+ readline adapter (Phase 11 BASH-01; `shell/bash/queque.bash`): `bind -x` on `?` in emacs and vi-insert, interactive guard, then the one-line `queque: the ?? trigger needs bash 5.0+ (found X)` refusal below 5.0; request.json via `jq --arg` with `shell:"bash"` and `shellVersion`; instant frame (`_qq_instant_frame`, inline and pane bytes, kill switch QQ_INSTANT_FRAME=0) painted before mktemp; installed-tool handoff (`_qq_write_tool_handoff`/`_qq_start_tool_handoff`, `tools.pending` marker, `compgen -c`), `_qq_prewarm_daemon`, two-flag `_qq_cleanup`; inline `qq client` or the Zellij floating pane via a read-write FIFO (`QQ_RESULT_READ_TIMEOUT_S=30`); result applied to READLINE_LINE/READLINE_POINT with QQ_ORIG_POINT restore and `${PS1@P}` prompt-head reprint. Client = `node $QQ_DEV_ROOT/dist/cli/main.js` when built, else `qq` on PATH (11-01, 11-06, 11-07). en_US.UTF-8 locale fallback is `{ LC_ALL=…; } 2>/dev/null`, so no setlocale warning leaks (WR-01). A missing jq (type -P) prints `queque: jq not found` before the paint (WR-02). QQ_RESULT_FILE and the pane size are `local -x` (not left in the shell, WR-03). Client stderr goes to $tmpdir/client.err unless QQ_DEBUG_LOG_FILE is set (WR-04). (~6400 tok)

## shell/zsh/

- `qq.zsh` — qq.zsh — QueQue ZLE widget and shell-side result contract (~2727 tok)
- `queque.zsh` — qq.zsh — QueQue ZLE widget and shell-side result contract; request.json carries `"shell": "zsh"` and `shellVersion` (11-02). QQ_RESULT_FILE and the pane size are `local -x`, scoped to the widget call (WR-03). Client stderr (inline and pane) goes to $tmpdir/client.err unless QQ_DEBUG_LOG_FILE is set (WR-04).; the daemon prewarm runs fully detached from the terminal (`</dev/null >/dev/null 2>&1 &!`, bug-553) (~5619 tok)

## src/

- `env.d.ts` — Declares the build defines __QUEQUE_COMMIT__, __QUEQUE_VERSION__, __QUEQUE_TELEMETRY_KEY__ and __QUEQUE_TELEMETRY_HOST__ (10-04), plus __QUEQUE_BUILD_ID__ (quick 261030-tq3). (~55 tok)

## src/cli/

- `launcher.ts` — CLI launcher built as dist/cli/main.js (quick 261011-jbh, LD-2): Node built-ins only; enables the module compile cache in `${XDG_CACHE_HOME:-~/.cache}/queque/node-compile-cache` (0700; queque parent + leaf lstat-checked: real dir, owned by getuid, no group/world write; skipped when NODE_COMPILE_CACHE / NODE_DISABLE_COMPILE_CACHE is set; silent on failure), then imports `new URL('./app.js', import.meta.url)` and awaits `main()`. (~955 tok)
- `main.ts` — Exports main; the `client` action calls `process.exit(process.exitCode ?? 0)` after clientCommand (D-15, 09.1-01). The `init <shell>` help names `qq init zsh && source ~/.zshrc` (261017-5q6). Phase 10: registers `qq doctor [--json]` (10-03) and `qq telemetry [action]` after it (10-09). Quick 261030-tq3: `qq daemon --restart` option. (~1320 tok)

## src/cli/commands/

- `client.ts` — Real client command handler. resolveResultMode: the flag wins; QQ_TEST_RESULT_MODE counts only for cancel / replace-buffer-fixture, anything else is ignored (WR-05). (~394 tok)
- `daemon.ts` — Daemon command handler: `--ensure` path or `startDaemonServer`; `enablePrewarm()` after the server starts (daemon-only, never at module top level or in `--ensure`); exported `trackConnections(server)` (Set of open sockets via `connection`) and `shutdownDaemon(server, connections, {exit, graceMs})` (WR-03: `disablePrewarm()` so an in-flight refill spawns nothing, destroys open sockets so their turns abort, then exits after `SIGKILL_GRACE_MS`+100 when any were in flight); SIGTERM/SIGINT call it (09.1-05). Phase 10: creates and starts the telemetry buffer; shutdownDaemon flushes it synchronously with a 1 s bound (10-06). Quick 261030-tq3: `--restart` (wins over --ensure) calls restartDaemon at call time, prints `daemon restarted`; errors reach main.ts's catch. Quick 261117-jpp: builds createUpdateChecker (cache in updateCacheDir, fetch, detectInstall) and passes it as `updates`; nothing fetched at start. (~600 tok)
- `doctor.ts` — `qq doctor [--json] [--shell <name>]` (Phase 11 11-08: one target shell per report, registry-driven; 12 rows for zsh and Linux bash, 13 with `bash_profile` on macOS bash; DoctorDeps.shellVersion/shellBindings/readRc/userShell, `BASH_BINDINGS_SCRIPT`, `parseBashBindings`, `resolveDoctorShell`, `runDoctorChecks(deps?, {shell?})`). Pre-phase-11 notes: injectable DoctorDeps (defaultDoctorDeps spawns zsh -fc / zsh -ic with stdin ignored, resolving on exit + grace; PATH scan; /tmp mkdtemp probe; lstat owner; pingDaemonFetchCap; loadProviderPin; detectProvider; telemetryStatus), runDoctorChecks (12 checks, D-17/D-19/D-20: jq and zsh < 5.0 fail, zsh 5.0-5.7 warn; `telemetry` last, always ok), parseZshBindings, formatDoctorReport (✓/⚠/✗ + ` — fix:`), doctorCommand (sets process.exitCode). Output is fixed copy only: it goes into public revert PR bodies (10-03, 10-09). Quick 261117-jpp: `update` row (checkUpdate) between node and telemetry, started in the Promise.all with daemon/provider; DoctorDeps.updateStatus (default: createUpdateChecker(...).status({isTTY, refresh:true}), same cache file as the daemon, never touches shownAt); warn when an update exists, ok otherwise (check off/unknown/current/failed); non-writable npm prefix → `npm config set prefix ~/.local, then npm i -g …@latest (not sudo)`; rows now 13 zsh/Linux bash, 14 macOS bash. (~5600 tok)
- `init-provider.ts` — `qq init provider` picker on /dev/tty (Claude, OpenAI, Ollama; Enter = 1). writeProviderPin then restartDaemon; dead ends print next step and exit 1. Exports PROVIDER_MENU, OLLAMA_DOWNLOAD_URL, runProviderPicker(io, deps), providerInitCommand, dispatchInit. (~2900 tok)
- `init.ts` — `qq init [shell]` (Phase 11 11-04): auto-detects the shell (arg, $SHELL, user shell) via src/shared/shell-registry.ts; bash gate probes the $SHELL bash first, else the PATH bash, refusing below 5.0 (`bash 5+ needed: brew install bash` on darwin); appends the marker + `source <adapter>` to ~/.zshrc or ~/.bashrc only (never ~/.bash_profile); macOS login-shell hint when ~/.bash_profile does not source ~/.bashrc. Exports InitDeps, defaultInitDeps, runInit(shellArg, deps), initCommand, hasShellIntegration. hasShellIntegration needs an active (uncommented) source line; the marker alone no longer counts (WR-06). (~2300 tok)
- `telemetry.ts` — `qq telemetry [status|on|off|show]` (D-06, D-09, D-12, D-22): injectable TelemetryCliDeps, requestDaemonOnce(socketPath, request, timeoutMs=500) (one-shot, schema-validated, null on error/close/timeout), telemetryCommand(action, deps). Prints state, variable names and the endpoint host only; show prints the daemon bodies byte for byte; off also sends telemetry-reset (10-09). Quick 261030-tq3: `socketConnectable` dep (tryConnect, read at call time) is probed only after a null reply; a connectable socket prints `the daemon did not answer (it may be outdated)` + `restart it: qq daemon --restart` (show and off); a wrong-kind reply also gets the restart hint. (~2400 tok)

## src/client/

- `instant-frame.ts` — Instant first frame takeover (quick 261011-jbh, LD-1): SAVE_CURSOR/RESTORE_CURSOR/ERASE_BELOW/CURSOR_HOME/SYNC_UPDATE_BEGIN, INLINE_SURFACE_CLEAR (ESC 8 + CSI J on the client's own save), PANE_SURFACE_CLEAR (CSI H + CSI J), `inlineScrollReserve(lines)` (byte-identical to the widget's reserve), `armInstantFrameTakeover(stream, clear)` → `{ clearNow }` (inserts the clear into the first visible write, after a leading `CSI ?2026 h`). (~1291 tok)
- `result-writer.ts` — Validates a ShellResult and writes newline-terminated JSON to `resultFile`. (~307 tok)
- `run-foreground.ts` — Splits a command + explanation into shell buffer halves. Quick 261117-jpp: llm branch asks `update-hint` via requestDaemonOnce (500 ms) after ensureDaemon when updateCheckBlockedBy(env, stdout TTY) is null; never awaited; on arrival (not resolved) rerenders `lastView` with the `updateHint` prop. (~6967 tok)
- `telemetry-consent.ts` — D-09 one-time consent ask: CONSENT_PROMPT (`... [y/N] `), CONSENT_TIMEOUT_MS = 30_000, shouldAskTelemetryConsent({outcome, state, blockedBy, hasTty}) (accepted, never asked, no env gate, tty), askTelemetryConsent({input, output}, timeoutMs) on the tty streams: raw mode, first character of the first chunk, only y/Y is yes, settles once, then raw off, pause, listener removed, timer cleared, every wrapped row erased. Never stdout, never rejects (10-11). (~1135 tok)
- `telemetry-events.ts` — Client telemetry: TELEMETRY_CLIENT_SEND_MS = 250, QueryOutcomeRecord, buildQueryOutcomeEvent/buildErrorEvent/buildEnvironmentEvent (strict-schema parsed, enums and counts only), sendTelemetryEvents (fire-and-forget socket lines, never rejects), reportClientTelemetry (gates on effectiveTelemetry in the client env first; environment, errors, outcome; never throws) (10-10). (~1482 tok)
- `tool-handoff.ts` — readToolHandoff(sessionDir, { shell, pendingBudgetMs }) waits while `tools.pending` exists (TOOL_HANDOFF_PENDING_POLL_MS 10, TOOL_HANDOFF_PENDING_BUDGET_MS 500, then null with reason `pending-timeout`) and tags the inventory with `shell` (11-03). Earlier: reads commands/builtins/functions.txt into a ToolInventory or null (QQ_TOOL_AWARENESS=0, missing, empty); counts-only logs; TOOL_HANDOFF_FILES (~735 tok)
- `zellij-pane-resize.ts` — Zellij floating-pane sizing: `readMaxZellijPaneHeight` (QQ_PANE_HEIGHT, default 24), `resolveZellijPaneHeight` (content + 2 frame rows `ZELLIJ_FLOATING_FRAME_LINES` + 1 Ink cursor row `INK_TRAILING_CURSOR_ROWS`, min 6, capped), `formatZellijPaneId`; `syncZellijFloatingPaneHeight` runs a serialized latest-wins queue: one `zellij action change-floating-pane-coordinates` at a time, heights requested meanwhile collapse to the newest, slot released on exit, on child error (no crash when zellij is missing) or after `RESIZE_SETTLE_TIMEOUT_MS` (2000, kills the hung action; timer unref'd); `resetZellijPaneHeightCache` (tests only). (~1900 tok)

## src/context/

- `pipeline.ts` — Exports gatherContext (~524 tok)

## src/contracts/

- `candidates.ts` — Zod schemas: commandCandidateSchema, candidateListSchema (~104 tok)
- `doctor.ts` — `qq doctor --json` contract (D-18; Phase 11 11-08 adds ids `bash`, `fish` (reserved, not emitted until Phase 12) and `bash_profile`): DOCTOR_CHECK_IDS (12, stable: add, never rename; `telemetry` last), DOCTOR_STATUSES ok/warn/fail, strict doctorReportSchema `{version:1, ok, qqVersion, platform, checks}`, doctorExitCode (1 iff a check failed) (10-03, 10-09). Quick 261117-jpp appends id `update` (last in DOCTOR_CHECK_IDS; emitted before `telemetry`); the update row may carry versions, a fixed command or the validated marker upgrade text. (~560 tok)
- `ipc.ts` — IPC request/response zod schemas: `fetch-candidates` with optional `stream: true`, streamed `{kind:'candidate'}` row kind, `{kind:'candidates'}` done signal; pong capability flags `fetchCandidates`, `installedTools`, `streamCandidates` (09.1-03). Phase 10: telemetry-event/telemetry-show/telemetry-reset requests, the telemetry-buffer response, the informational pong `telemetry` flag, fetch-error `errorKind` (10-06). Quick 261030-tq3: pong `build` = z.string().max(128).optional().catch(undefined) (malformed reads as another build, never a rejected pong). Quick 261117-jpp: `update-hint` request; `update-hint` response with hint z.string().max(200).nullable().catch(null). (~650 tok)
- `request.ts` — Intent/base-context/envelope schemas; `contextChunkSchema` incl. the lenient `installed-tools` variant (filters non-catalog names, rejects non-name strings and > 512 entries) and the client-side `strictInstalledToolsChunkSchema`. (~1500 tok)
- `shell.ts` — Shell request — sent from the shell adapter (zsh, bash) to the qq client. Phase 11 11-01: `SHELL_NAMES = ['zsh','bash','fish']`, `ShellName`, `isShellName`; `shellRequestSchema.shell` (default zsh) and `shellVersion` (max 40); `version: 1` unchanged. (~600 tok)
- `telemetry.ts` — Telemetry allow list (D-10, D-11): strict zod schemas for qq_query_outcome / qq_error / qq_environment (client, wire, batch) and the enums ERROR_KINDS, PROVIDER_KINDS, QUERY_OUTCOMES, OS_KINDS, ARCH_KINDS, DISTRO_IDS, TELEMETRY_EVENTS, TELEMETRY_LIB, TELEMETRY_BATCH_MAX. No latency, no free-form strings (10-04). (~1638 tok)

## src/daemon/

- `bootstrap.ts` — Ensures a current daemon: ping must advertise `fetchCandidates`, `installedTools` AND `streamCandidates` (else replace the stale listener; no reply = keep), spawn if needed (09.1-03). Phase 10 Defect 1: exports `parseLsofPidList` (strict: every line `^\d+$`, else [] and debug `lsof output ignored`), `listenerPids` and `replaceStaleListener`; never replaces a daemon for lacking the pong `telemetry` flag (10-01, 10-06). Quick 261030-tq3: pingDaemonFetchCap is 'yes' only when the four flags pass AND pong `build` === __QUEQUE_BUILD_ID__; an absent/other build logs `daemon build differs` and returns 'no', so ensureDaemon replaces it via replaceStaleListener (bug-473). (~2250 tok)
- `fetch-client.ts` — Asks the daemon for candidates; fails in 800ms without `fetch-accepted`; `requestDaemonFetch(…, timeoutMs?, options?)` sends `stream: true`, utf8-decodes, forwards `candidate` rows to `onCandidate`, treats socket `close` as IpcTransportError, rejects with abortError() on signal abort and destroys the socket; `fetchCandidatesForUi(…, options?)` never falls back in-process after an abort or after a row arrived (D-16) (09.1-01/03). Phase 10: re-tags fetch-error errorKind onto the thrown error; the in-process fallback tags pin_invalid (10-06). (~1590 tok)
- `server.ts` — Daemon Unix-socket server; pong `{fetchCandidates, installedTools, streamCandidates: true}`; socket `setEncoding('utf8')` so split multi-byte chars survive, 256 KB request cap measured in bytes (WR-01); drops lines failing ipcRequestSchema; runs `fetch-candidates` on the warm adapter inside a Promise chain with a per-connection AbortController (socket `close` aborts it; aborted fetches log `fetch aborted` and write nothing); streams `candidate` rows only for `stream: true` (`replied candidate`; rows after the client left are `candidate dropped`); final `candidates` is the done signal (09.1-01/03). Phase 10: telemetry-event/show/reset cases; fetch-error carries errorKind (pin_invalid for resolution throws) (10-06). Quick 261030-tq3: pong also carries `build: __QUEQUE_BUILD_ID__`. Quick 261117-jpp: `options.updates.hint()`; `update-hint` case replies inside a Promise chain (throw/reject → null), logs `shown` only. (~1840 tok)
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
- `install-detect.ts` — Quick 261117-jpp: detectInstall(deps) answers who installed qq (never pickInstaller). Order: WSL /mnt/<drive>/ execPath → windows-node; `.install-source` marker next to dist/ (installMarkerSchema strictObject: source /^[a-z0-9][a-z0-9._-]{0,31}$/, upgrade printable ASCII ≤120; homebrew source = not packaged); /Cellar/queque/ brew; volta (VOLTA_HOME or ~/.volta); pnpm (PNPM_HOME or /pnpm/global/); /nix/store/ nix (no command); nvm/fnm (npm command + 'this Node version only'); npm global (non-/usr); Linux-only dpkg -S → rpm -qf (os-release ID/ID_LIKE: suse → zypper, fedora/rhel/centos → dnf, else rpm null) → pacman -Qoq (+ -Qm → aur note) for unmatched /usr paths, first hit wins, owner not exactly `queque` → null command; npm fallback only for /usr node_modules paths; else unknown. Non-writable global node_modules adds 'set a user npm prefix first, not sudo' (joined with '; '); InstallMethod/InstallInfo/InstallDetectDeps, defaultInstallDetectDeps (realpath, readFile, isWritable, spawn owner query with LC_ALL=C, 2 s kill, 4 KB cap, never rejects; /etc/os-release), NPM_PACKAGE, USER_PREFIX_NOTE (exported for the doctor hint, task 3). No top-level side effects. (~1900 tok)
- `telemetry-config.ts` — Anonymous telemetry consent state (phase 10, D-06, D-09). `flagSet` exported (quick 261117-jpp reuses it for QQ_NO_UPDATE_CHECK/CI). (~2510 tok)
- `telemetry-endpoint.ts` — resolveTelemetryEndpoint(env): baked host/key with usableSecret QQ_TELEMETRY_HOST/QQ_TELEMETRY_KEY overrides; null for an empty or non-phc_ key, a non-http(s) host, or a host with credentials (10-04). (~407 tok)
- `tool-awareness.ts` — ToolInventory, isInstalled (commands|functions+aliases), missingTools, installer choice (`pickInstaller`, `INSTALL_COMMANDS`, `LINUX_INSTALLER_ORDER`), per-installer `PACKAGE_ALIASES` (brew/apt/dnf/pacman maps; null = no package installs that binary) + `packageFor(tool, installer)` (Homebrew-aliased tools with no Linux entry are null, never guessed), `SAFE_PACKAGE_NAME_RE`, `buildInstallForm`/`planInstall` (brace-wraps lists, blocks unsafe words/unknown packages/comments/heredocs); `annotateCandidates(…, platform)` attaches `install` to flagged candidates. (~2000 tok)
- `update-check.ts` — Quick 261117-jpp update notifier: constants (registry URL, 24 h check/hint intervals, 1.5 s fetch, 500 ms client ask, 200-char hint, RELEASES_URL, update-check.json); updateCheckBlockedBy(env, isTTY) (QQ_NO_UPDATE_CHECK > CI > not a terminal, telemetry flagSet); hand-rolled compareVersions/isNewerVersion (semver, prerelease rules), nodeFloor/nodeBelowFloor; fetchLatestRelease (AbortSignal.timeout, SEMVER_RE version, printable engines.node else null, null on any failure); updateCacheSchema strictObject + read/write (private 0700 dir owned by uid, reads never mkdir, 0600 tmp + rename); updateCacheDir = ${XDG_CACHE_HOME abs or ~/.cache}/queque on every platform; formatUpdateHint (nix → null, windows-node → install Node inside WSL, nodeTooOld, packaged → upstream wording + command | note | 'update it with your package manager', command (+ note), else RELEASES_URL); createUpdateChecker {hint(), status()} (memoized detectInstall, deduped refresh, file is the source of truth, first hint with no cache returns null, shownAt read-decide-write synchronous). (~3600 tok)
- `tool-catalog.ts` — Shipped 196-name allow list of notable CLI tools (spike 003 seed, frozen), `CATALOG_SET`, `installedCatalogTools(isInstalled)` (sorted in Node), shape constants `TOOL_NAME_RE` / `TOOL_NAME_MAX_LENGTH` (64) / `INSTALLED_TOOLS_MAX` (512). Zero imports. (~1000 tok)

## src/shims/

- `optional-native-module.ts` — Throws on load; tsup aliases ws's optional native add-ons (`bufferutil`, `utf-8-validate`) to it so ws keeps its not-installed fallback and the bundle resolves nothing from node_modules at runtime. (~203 tok)
- `react-devtools-core.ts` — No-op `{ initialize, connectToDevTools }` default export; tsup alias target for ink's hoisted devtools import (keeping it external crashed the bundle with ERR_MODULE_NOT_FOUND). (~163 tok)

## src/ui/

- `CandidateSelect.tsx` — Candidate list; Tab/Shift+Tab toggles a flagged row to its install form (third useState: Set of `candidateKey`s). The query state starts empty (G-09.1-5): `initialQuery` (the lbuffer) is header-only (`queque ›` row + layout estimator) and arrival never writes the query. Candidate-arrival reset (selection, toggles) runs during render via `prevCandidates` (fourth useState), so no effect sees a stale render (G-09-7). Enter inserts the displayed text; the search filter matches the displayed text (install form when toggled) and hidden rows keep their toggle; flagged rows start their explanation with cyan ⓘ; selection-independent legend (`ⓘ not installed[ · tab prepends …]`) directly above ControlsLine; ControlsLine takes no props (tab chip removed). Zellij pane hold: a `paneHold` useRef `{ candidates, lines }` (not a fifth state) feeds `heldPaneLines` in the layout effect, so `onLayoutLinesChange` reports the held pane content rows (unfiltered size on arrival, never shrinks for the same candidates array, a new array resets) — filtering spawns no resize (quick-261011-f9o); 09.1-07: `listState` prop (default `'complete'`): reset only on the first arrival, later arrays keep the highlight by candidateKey and the toggles; spinner (`thinking…`) or `list may be incomplete` status row; no layout report while `'arriving'`; review WR-04 / G-09.1-5: no zero-match query clear on arrival, so text typed during `thinking…` is the whole filter and keeps filtering later rows; review WR-05: no `[query]` effect — typing and Backspace (non-empty query) reset the selection to 0 in the key handler, so the arrival branch keeps the index it chose; review WR-06: arrows are no-ops on an empty visible list and the later-arrival index is clamped to >= 0 (never NaN/-1); All key handlers (Backspace, typing, Tab, Enter, arrows) read one live `PendingInput` snapshot (query, selectedIndex, installToggled) tagged with a per-render `renderToken` and write it back through `applyInput` (value setters, each only on change), so keys in one stdin read compose (CR-01). Quick 261117-jpp: optional `updateHint` prop rendered as one dim `wrap="truncate"` row right under ControlsLine; in the layout object and effect deps. (~4100 tok)
- `ControlsLine.tsx` — Keyboard hints below the candidate list; optional `tabHint` (`install` | `undo install`) chips between accept and cancel. (~300 tok)
- `LoadingSpinner.tsx` — FRAMES (~134 tok)
- `modal-layout.ts` — Wrapping/row layout; ⓘ `MISSING_TOOL_MARK`, `explanationText` (mark-prefixed explanation), `missingToolsLegend(visible)`, `candidateKey`, `displayedCommand`, `isInstallToggled`; `filterCandidates(list, query)` matches the command or the install form, regardless of the Tab toggle; `MODAL_VIEWPORT_LINES` (18: inline scroll reserve, row count documented); estimator counts the ⚠ footer and legend as separate margin+line blocks; `heldPaneLines(previousHeld, input)` = max(held, current estimate, unfiltered estimate with query '' + row 0 + current toggles): the Zellij pane's per-list high-water content height (quick-261011-f9o); 09.1-07: `CandidateListState` (`'arriving' | 'complete' | 'partial'`), `LIST_STATUS_ROW_LINES = 1`, `INCOMPLETE_LIST_NOTE`; `CandidateSelectLayoutInput.listState`; the estimator adds the status row for arriving and partial lists Quick 261117-jpp: `CandidateSelectLayoutInput.updateHint`; the estimator adds 1 row (no margin) when set. (~2660 tok)
- `Modal.tsx` — Modal (~223 tok)
- `SearchInput.tsx` — Live filter input for narrowing the candidate list. (~108 tok)

## tests/

- `auto-revert.test.ts` — 13 tests for scripts/ci/auto-revert.sh against temp repos (bare remote, merge commit) with the gh double on PATH; skips without bash (10-07). (~4620 tok)
- `bash-widget.test.ts` — Helper tests for the bash readline adapter (`shell/bash/queque.bash`, Phase 11 BASH-01). (~11378 tok)
- `bundle-startup.test.ts` — Builds the real tsup config into a temp dir (no node_modules): every emitted .js (main.js launcher + app.js bundle) loads only Node built-ins (static, literal dynamic import, __require); `--help` of both files works; per-user 0700 compile cache populated under XDG_CACHE_HOME; unwritable / world-writable cache locations fail safe (stderr equals the NODE_DISABLE_COMPILE_CACHE baseline). No timing assertions. (~2000 tok)
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
- `client-result.test.ts` — runForegroundClient result/FIFO/Zellij paths; Esc during loading (onCancel from the ink render mock) writes cancel, aborts the adapter signal, never rerenders; installed-tool awareness via the real `_qq_write_tool_handoff` (flags A-D, envelope carries sorted catalog ∩ installed incl. function `nvm`, no chunk ⇒ prompt === QUEQUE_SYSTEM); `inkMock.autoSelect` switch; streaming, partial-list and AbortError-after-Esc client tests (09.1-07) Phase 10: mocks ../src/client/telemetry-events.js (reportClientTelemetryMock); describe `runForegroundClient: telemetry outcome` (10-10); mocks telemetry-consent/telemetry-config with importOriginal spreads (real gates, fake prompt and config IO, default asked true) and describe `runForegroundClient: telemetry consent (D-09)` (call order unmount < ask < mark < report, env gates, write failure) (10-11). resolveResultMode (WR-05) cases. Quick 261117-jpp: mocks cli/commands/telemetry.js requestDaemonOnce (importOriginal spread); describe `runForegroundClient: update hint` (opt-out and non-TTY send nothing, hint rerenders the loading view, an unanswered ask never holds the result). (~11100 tok)
- `code-changed.test.ts` — 8 tests spawning scripts/ci/code-changed.mjs in temp git repos (branch `topic`, no main): doc-only, src, workflow, deletion, zero base, unknown base, merge-base fallback, no git repo (10-05). (~1272 tok)
- `command-words-fuzz.test.ts` — spawnSync fuzz of the shipped lexer in child processes: 20k seed 1 (15 s kill), 5k seed 7 (10 s kill), 33 crafted malformed inputs (1 s kill each), deep 2000 < 100 ms (best of up to 3 runs, logged); 16 MiB maxBuffer; reports the last stderr input on failure. (~900 tok)
- `command-words.test.ts` — Spike 002 40-case table + 09-REVIEW regression table (zsh -f `${(k)builtins}` builtins), kind classification, D-06 install words, robustness (8193 chars, prototype keys, `"rg\`), frozen lexHand op/redir/comment token contract incl. heredoc-body and continuation tokens. (~1700 tok)
- `context-pipeline.test.ts` — Declares buildRequest (~1550 tok)
- `controls-line.test.tsx` — Calls `ControlsLine(props)` directly and flattens its element tree; asserts no tab chip without a hint, the exact chip order with `tabHint: 'install'`, and the `undo install` chip. (~500 tok)
- `daemon-bootstrap.test.ts` — ensureDaemon keep/replace/spawn cases incl. pongs lacking `fetchCandidates`, `installedTools` or `streamCandidates` (replace), all three (keep); server pong advertises three flags (09.1-03). (~2330 tok)
- `daemon-fetch.test.ts` — Real `startDaemonServer` fetch IPC: candidates, adapter errors, in-process fallback, installed-tools chunk accepted, catalog drift filtered (`qqfuturetool` dropped), malformed chunk ignored (not accepted < 2 s), abort after fetch-accepted reaches the adapter signal via socket close, no fallback after abort; request decoding (WR-01: request split inside a 3-byte char decodes intact; 270 KB/90k-unit request is refused); raw-socket and scripted-listener helpers; streaming (D-05/D-14: `candidate` rows only for `stream: true`, `candidate dropped` after close) and no-re-query-after-rows (D-16) cases (09.1-03); daemon shutdown (WR-03: in-flight fetch aborted and its refill spawns nothing; idle child retired, pool off, immediate exit) (~6504 tok)
- `debug-log.test.ts` — Declares appendFileMock (~484 tok)
- `docs-links.test.ts` — Offline link guard over README.md, CONTRIBUTING.md and docs/*.md: relative links and `#anchors` (GitHub slugs, code fences and spans skipped) must resolve; `https://github.com/k-leumas/queque/blob/main/` links map back to local files; README links must be absolute (except `assets/`) and must link every REQUIRED_DOCS page (INSTALL, PROVIDERS, USAGE, PRIVACY, CONFIGURATION.md) (quick 261030-fdr). (~1780 tok)
- `doctor.test.ts` — Doctor status/exit/JSON/formatter/command tests with a healthy-baseline fake DoctorDeps (one dependency overridden per case), telemetry row cases, canary and install-id no-leak tests, real read-only defaultDoctorDeps probes (10-03, 10-09). Quick 261117-jpp: PHASE10_IDS (first 12 DOCTOR_CHECK_IDS) vs ZSH_IDS (13 rows, `update` before `telemetry`), healthyDeps.updateStatus current, update row cases for every UpdateStatus (blocked ×3, unknown, current, brew, homebrew marker, npm non-writable, nvm, unknown, nix, apt, aur, rpm, nodeTooOld, 200-char cap, throw), defaultDoctorDeps().updateStatus() is blocked under vitest. (~14500 tok)
- `env-file.test.ts` — root: projectWithEnvLocal, homeUnderPlantedFile (~1365 tok)
- `environment-shape.test.ts` — Enum mapping, zsh/node parsing, null on an out-of-bound node, no env value leaks (10-10). (~946 tok)
- `error-kind.test.ts` — withErrorKind/errorKindOf units; claude-default CLI/SDK mapping via importOriginal-spread mocks of claude.js and claude-cli.js; daemon fetch-error errorKind and pin_invalid; fetch-client re-tagging; the in-process fallback (10-06). (~2776 tok)
- `git-env-isolation.test.ts` — Phase 10 (10-12 drill): git exports GIT_DIR (and friends) into hook processes run from a (~730 tok)
- `init-command.test.ts` — Declares stub (~350 tok)
- `init-provider.test.ts` — 38 picker tests; restartDaemon/openUrl mocked, /dev/tty open throws, D-03/D-05 source guards. (~4600 tok)
- `instant-frame-parity.test.ts` — Cross-shell byte parity for the instant frame (Phase 11 D-04, quick 261011-jbh LD-1). (~3424 tok)
- `intent-router.test.ts` — Declares makeRequest (~2122 tok)
- `lsof-busybox.test.ts` — Defect 1 regression: parseLsofPidList cases, plus a fake busybox `lsof` on PATH (written and warmed once in beforeAll, sacrificial pid via QQ_FAKE_LSOF_PID) naming a `sleep 30` child that must survive replaceStaleListener; both replace tests assert the `lsof output ignored` log (10-01, bug-428). (~1170 tok)
- `main-direct-run.test.ts` — --------------------------------------------------------------------------- (~710 tok)
- `modal-layout.test.ts` — wrapText, filterCandidates, estimateCandidateSelectLines (flag rows, legend, install toggle), explanationText, missingToolsLegend, candidateKey; MODAL_VIEWPORT_LINES fits 3 two-line candidates + header + ⚠ footer + ⓘ legend (18); heldPaneLines (narrowing, a typed filter under the query header (G-09.1-5), ⚠ row then filter keeps height, grows past held, hidden toggled row counts, loading/error); streamed list status-row estimator tests (09.1-07) Quick 261117-jpp: update hint adds exactly 1 estimated row (short and 300-char). (~5030 tok)
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
- `install-detect.test.ts` — Quick 261117-jpp task 2: detectInstall matrix with fake deps (realpath identity, owner-query spy keyed by argv): brew mac/linux, volta, pnpm, nvm, fnm, user/system npm, darwin /usr/local, nix, WSL, unknown; dpkg, rpm suse/fedora/rocky/mageia, pacman repo/AUR, owner not named queque, unowned /usr. (~2900 tok)
- `update-check.test.ts` — Quick 261117-jpp: gate, compareVersions/nodeFloor, fetchLatestRelease (status, malformed, control chars, abort timeout), cache modes/unsafe dir/updateCacheDir, checker (one deduped fetch, 24 h cache, offline keeps latest, opt-out, once per 24 h, engines mismatch, status), formatUpdateHint rows (one per install method incl. windows-node, packaged null-command fallbacks, ≤200 chars, no control chars), detectInstall marker/brew/unknown. Fake fetch + temp cache only. (~4200 tok)
- `update-hint-ipc.test.ts` — Quick 261117-jpp: `update-hint` against a real temp socket (hint, no checker → null, reject/sync throw → null and the daemon keeps serving, hint text never logged) and the request/response schemas (non-string or >200 → null). (~900 tok)
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

- `sdk-contract.live.ts` — Nightly live SDK contract test, the only test that calls a real model: spawns the built daemon on `/tmp/qq-live-PID.sock` with a temp HOME and sends one streamed fetch-candidates; asserts schemas, LIVE_FIRST_CANDIDATE_MS 15000 / LIVE_FINAL_MS 25000, `sdk path` and no `request failed`/`response truncated`; fails in beforeAll without the key (10-08). (~2722 tok)

## tests/pty/

- `drive.sh` — `tests/pty/drive.sh start|type|key|paste|wait|capture|stop SERVER …`: drives an interactive zsh or bash (`QQ_PTY_SHELL_BIN`) in a private tmux server (`-L`, `-f /dev/null`); bash 3.2-safe; strips ZELLIJ* and TMUX so it never opens a pane in the user's session (Phase 11 D-10, 11-01). (~750 tok)

## tests/setup/

- `scrub-git-env.ts` — git exports these into hook processes (lefthook's pre-push runs this suite), most visibly (~292 tok)
