---
gsd_state_version: "1.0"
milestone: v1.0
current_phase: "09.1"
current_phase_name: provider-latency-and-cancellation
status: executing
stopped_at: Completed 09.1-09-PLAN.md
last_updated: "2026-10-12T20:46:46.417Z"
last_activity: 2026-10-12
last_activity_desc: Completed 09.1-09 (G-09.1-5 gap closure)
state_head: f80fca902cdb9805c7b5a26b9b38b53a4d5826df
progress:
  total_phases: 12
  completed_phases: 8
  total_plans: 42
  completed_plans: 38
milestone_name: milestone
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-11)

**Core value:** Turn natural-language intent into a shell command that feels native to the terminal workflow, not bolted on top of it.
**Current focus:** Phase 09.1 — provider-latency-and-cancellation

## Current Position

Phase: 09.1 (provider-latency-and-cancellation) — EXECUTING
Plan: 9 of 9
Next: /gsd-verify-work 09.1 — re-test UAT test 5 (G-09.1-5: FILTER opens empty, typed text is the whole filter)
Status: All 9 plans complete — gap closure 09.1-09 done, UAT test 5 re-test pending
Last activity: 2026-10-12 — Completed 09.1-09 (G-09.1-5: FILTER opens empty, lbuffer header-only)

Progress: [███████░░░] 73%

## Performance Metrics

**Velocity:**

- Total plans completed: 9
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 03 | 3 | - | - |
| 9 | 6 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: Stable

| Phase 02-intent-router-and-context-pipeline P01 | 7 | 2 tasks | 3 files |
| Phase 02-intent-router-and-context-pipeline P02 | 26 | 3 tasks | 13 files |
| Phase 02-intent-router-and-context-pipeline P03 | 11 | 2 tasks | 8 files |
| Phase 06-hardening-privacy-defaults-and-extension-seams P02 | 20min | 3 tasks | 7 files |
| Phase 08 P01 | 2min | 1 tasks | 2 files |
| Phase 08 P02 | 12min | 3 tasks | 13 files |
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 09 P01 | 11min | 3 tasks | 13 files |
| Phase 09 P02 | 6min | 2 tasks | 4 files |
| Phase 09 P03 | 5min | 3 tasks | 11 files |
| Phase 09 P04 | 7min | 2 tasks | 9 files |
| Phase 09 P06 | 17 min | 2 tasks | 11 files |
| Phase 09.1 P08 | 11min | 2 tasks | 4 files |
| Phase 09.1 P09 | 8 min | 3 tasks | 12 files |

## Accumulated Context

### Roadmap Evolution

- Phase 3.1 inserted after Phase 3: update interface and interactivity to match that of this github project: https://github.com/imsnif/monocle (URGENT)
- Phase 3.2 inserted after Phase 3.1: Reduce scope to Zellij floating panes for best UX (URGENT)
- Phase 5 deferred (2026-06-17): In-TUI clarification chat is nice-to-have; users can Esc, edit query, and re-trigger `??`. Phase 6 proceeds without Phase 5. Revisit after Phase 8 zero-config.
- Phase 9 added (2026-10-07): Installed-Only Command Awareness — zsh $commands handoff, installed∩catalog prompt steering, flag candidates using missing tools (from spikes 001–003).
- Phase 8 scope expanded (2026-07-31): 08-01 must fix macOS Keychain detection gap — prototype `detectProvider()` only checks credentials file, missing `/login` sessions on darwin.
- Phase 09.1 inserted after Phase 9: Provider Latency and Cancellation: effort low, stream-json, early first candidate, prewarmed claude -p, Esc aborts the model call (from debug llm-response-latency-profile) (URGENT)

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Initialization: `zsh` on macOS is the v1 shell target.
- Initialization: Claude is the first provider behind an abstraction layer.
- Initialization: Plugin/extension seams must be preserved during MVP work.
- [Phase 02-intent-router-and-context-pipeline]: Intent classification remains fully synchronous and local, with no I/O or provider calls.
- [Phase 02-intent-router-and-context-pipeline]: unknown intent is reserved for empty or whitespace-only queries; all other unmatched queries fall back to general.
- [Phase 02-intent-router-and-context-pipeline]: Filesystem-keyword prompts route before generic file-path detection so rename/find requests with filenames stay out of codebase intent.
- [Phase 02-intent-router-and-context-pipeline]: Context providers now gather extras only for matching intents, preventing filesystem requests from inheriting git state.
- [Phase 02-intent-router-and-context-pipeline]: Claude prompt assembly now depends on ContextEnvelope instead of direct VCS detection in the provider.
- [Phase 02-intent-router-and-context-pipeline]: Built-in context providers now register through explicit registries and bootstrap instead of a hardcoded array.
- [Phase 06]: buildPrompt calls filterContextEnvelope before chunk extraction (defense-in-depth)
- [Phase 06]: resolveAdapter missing-adapter error references bootstrapBuiltins() for clarity
- [Phase 08]: darwin treats claude on PATH as auth-present (Keychain); false positives fail at 08-02 request time
- [Phase 08]: CLAUDE_CODE_OAUTH_TOKEN and ANTHROPIC_AUTH_TOKEN count as Claude auth without reading values
- [Phase 08]: Provider selection is pin-not-waterfall; Claude silent default; SDK-first when a usable API key exists, `claude -p` only for `/login`-only users
- [Phase 08]: Register the CLI+SDK composite as claude-cli, not raw claudeCliAdapter
- [Phase 08]: Keep the prompt as last argv with stdin ignore (accepted ps disclosure T-08-02-07)
- [Phase 08]: none/ollama/openai-key resolve to Claude default as an 08-02 bridge until 08-03 pinning
- Warm client: daemon `fetch-candidates` IPC + cached Anthropic SDK; Ink stays in the foreground client; no LaunchAgent
- [Phase 09]: 09-01: Ink Text takes no layout props; gutter and ⊘/⚠ marks use <Box flexShrink={0}> wrappers
- [Phase 09]: 09-01: handoff files commands/builtins/functions.txt are a fixed widget-client contract; zsh -f handoff median ~6-8 ms
- [Phase 09]: 09-02: lexer needed no fix; 40/40 spike cases, 25k fuzz, crafted and deep runs pass; lexHand op/redir/comment token contract locked by tests for 09-04
- [Phase 09]: 09-02: fuzz child imports src/shared/command-words.ts via Node 24 type stripping; crafted inputs keep a hard 1 s kill per child (about 180 ms typical, flake risk under heavy load)
- [Phase 09]: 09-03: steering lives only in the system prompt via buildSystemPrompt(envelope) in src/providers/steering.ts; adapters guard enforces it for every provider (D-18)
- [Phase 09]: 09-03: installed-tools chunk filters unknown catalog names daemon-side (zod transform) and is strict client-side; catalog edits need no capability bump, shape changes do
- [Phase 09]: 09-04: brace-wrap terminator check uses the last lexHand token, not string endsWith, so an escaped \; still gets its own ;
- [Phase 09]: 09-04: displayedCommand/isInstallToggled live in modal-layout.ts so the render and layout estimate share one displayed-text rule
- [Phase 09]: G-09-7 fix (09-06): render-phase candidate-arrival reset in CandidateSelect (prevCandidates) plus a serialized latest-wins Zellij resize queue; SIGWINCH /dev/tty resize wiring deliberately not done
- [Phase 09]: RESIZE_SETTLE_TIMEOUT_MS = 2000 (about 5x the slowest measured zellij action); timer unref'd, a hung action is killed and the newest waiting height spawned
- [Phase 09.1]: 09.1-08: phase OpenWolf records committed once by the gate plan; superseded claude -p advice kept as marked history; bug-270 is the live copy of the bug-206 flake
- [Phase 09.1]: G-09.1-5: CandidateSelect FILTER query starts empty; the lbuffer is header-only (supersedes 03.1 D-01/D-02); both arrival-time zero-match clears removed
- [Phase 09.1]: 09.1-09 kept the initialQuery prop name (header and layout estimator only); no run-foreground or zsh widget change

### Pending Todos

None yet.

### Blockers/Concerns

- TUI library choice must not compromise raw keyboard handling or shell-return behavior.
- Confidence routing quality will determine whether the product feels magical or annoying. (Deferred with Phase 5 — manual re-query is acceptable for now.)
- [Phase 9] Zellij resize queue: WR-06 (timed-out resize can still land after its successor) and WR-07 (failed resize counted as applied, later equal heights skipped) are open advisory review findings in 09-REVIEW-DISPOSITION.md.
- [Phase 9] nyquist_compliant stays false until /gsd-validate-phase 9 runs on an idle machine (bug-206 timing guards flake under load).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260501-qt4 | write a short node script that restart the dev server when a file changes i dont care what lib is used to watch and reload the dev server, it just needs to do it and inform me that it is doing it in a log message | 2026-05-02 | dd774e7 | [260501-qt4-write-a-short-node-script-that-restart-t](./quick/260501-qt4-write-a-short-node-script-that-restart-t/) |
| 260502-cf6 | fix the ci so the tests pass | 2026-05-02 | 0194dcc | [260502-cf6-fix-the-ci-so-the-tests-pass](./quick/260502-cf6-fix-the-ci-so-the-tests-pass/) |
| 260502-qt-modal | update UI to modal display above ?? — Modal.tsx + CandidateSelect.tsx redesign | 2026-05-02 | — | [260502-qt-modal-candidate-ui](./quick/260502-qt-modal-candidate-ui/) |
| 260506-pja | make qq initialization feel visually faster; investigate starting work on first question mark and reduce perceived latency | 2026-05-06 | — | [260506-pja-make-qq-initialization-feel-visually-fas](./quick/260506-pja-make-qq-initialization-feel-visually-fas/) |
| 260522-uat-fixes | phase-04 UAT fixes — two-row layout, FILTER label, zellij --name qq, query context header, setopt interactivecomments | 2026-05-22 | ac90c65 | — |
| 260522-tui-cleanup | unmount Ink TUI on SIGHUP/SIGTERM to clear terminal artifacts on close | 2026-05-22 | 599bb99 | [260522-tui-cleanup-on-close](./quick/260522-tui-cleanup-on-close/) |
| 260522-selection-summary | on selection: print summary above PS1, add query to history, restore query to LBUFFER | 2026-05-22 | 563b8a9 | [20260522-selection-summary-and-history](./quick/20260522-selection-summary-and-history/) |
| 260522-vfd | prototype provider detection: detectProvider() waterfall — ANTHROPIC_API_KEY → claude CLI → ollama → OPENAI_API_KEY → none | 2026-05-23 | a86159d | [260522-vfd-prototype-provider-detection](./quick/260522-vfd-prototype-provider-detection/) |
| 260528-mk1 | rename project from que-que to queque in all prose, package.json, shell/TUI display labels, and test assertions | 2026-05-28 | 492f2f6 | [260528-mk1-rename-que-que-to-queque-in-prose-write-](./quick/260528-mk1-rename-que-que-to-queque-in-prose-write-/) |
| 260529-ney | research beta release requirements: Homebrew tap formula, awesome-zsh-plugins, Zellij community (Integrations not plugin) | 2026-05-29 | f608787 | [260529-ney-explore-beta-release-requirements-for-ho](./quick/260529-ney-explore-beta-release-requirements-for-ho/) |
| 260529-ntf | implement release automation: release.yaml (beta branch + pnpm/action-setup@v4), homebrew.yml, .releaserc.json beta prerelease | 2026-05-30 | 1c0e36d | [260529-ntf-implement-release-automation-workflows-a](./quick/260529-ntf-implement-release-automation-workflows-a/) |
| 20260604-isdr | regression tests for isDirectRun symlink mismatch (bug-159): process.argv[1] realpathSync fix prevents main() being skipped on Homebrew installs | 2026-06-04 | ba24b04 | [20260604-isDirectRun-symlink-regression](./quick/20260604-isDirectRun-symlink-regression/) |
| 20260608-zellij-title-repeat | fix repeating queque title in zellij modal: add flexGrow={0} to title Box in CandidateSelect.tsx | 2026-06-08 | — | [20260608-zellij-title-repeat](./quick/20260608-zellij-title-repeat/) |
| 20260617-privacy-config | user privacy config at ~/.config/qq/config.json — merge patterns onto built-in defaults | 2026-06-17 | 7bf0799 | [20260617-privacy-config-file](./quick/20260617-privacy-config-file/) |
| 20260618-trim | remove extra whitespace at start of the command in the candidate list | 2026-06-18 | — | [20260618-candidate-command-trim](./quick/20260618-candidate-command-trim/) |
| 20260618-tail | extend selection arrow tail through wrapped command and explanation lines | 2026-06-18 | — | [20260618-selection-arrow-tail](./quick/20260618-selection-arrow-tail/) |
| 20260618-destructive-mark | yellow ⚠ footnote on destructive candidate commands and footer warning | 2026-06-18 | 0219fee | [20260618-destructive-warning-mark](./quick/20260618-destructive-warning-mark/) |
| 20260618-zellij-height | Zellij floating pane resizes to modal content, capped at QQ_PANE_HEIGHT | 2026-06-18 | — | [20260618-zellij-responsive-height](./quick/20260618-zellij-responsive-height/) |
| 20260619-nvmrc | GitHub Actions workflows use node-version-file from .nvmrc | 2026-06-19 | — | [20260619-workflows-nvmrc](./quick/20260619-workflows-nvmrc/) |
| 20260619-pnpm-builds | commit pnpm-workspace.yaml allowBuilds for esbuild/lefthook CI install | 2026-06-19 | — | [20260619-pnpm-allow-builds](./quick/20260619-pnpm-allow-builds/) |
| 261011-e43 | fix top queque › line is clipped when modal is resized in zellij | 2026-10-11 | dbcbdd7 | [261011-e43-fix-top-queque-line-is-clipped-when-moda](./quick/261011-e43-fix-top-queque-line-is-clipped-when-moda/) |
| 261011-f9o | keep the zellij modal at its full-list height while filtering instead of shrinking | 2026-10-11 | 75655cc | [261011-f9o-keep-the-zellij-modal-at-its-full-list-h](./quick/261011-f9o-keep-the-zellij-modal-at-its-full-list-h/) |
| 261011-jbh | instant first frame from the zsh widget + bundled, compile-cached client (modal no longer blank before loading) | 2026-10-11 | e8e3127 | [261011-jbh-instant-first-frame-from-the-zsh-widget-](./quick/261011-jbh-instant-first-frame-from-the-zsh-widget-/) |

## Session Continuity

Last activity: 2026-10-11 - Completed quick task 261011-jbh: instant first frame from the zsh widget + bundled client

Last session: 2026-10-12T20:46:46.006Z
Stopped at: Completed 09.1-09-PLAN.md
Resume file: None
