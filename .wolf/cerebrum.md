# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-11-17

## User Preferences

- 2026-11-17: The update line is read from the cache before the first frame (never pops in mid-picker) and stays on EVERY `??` until the user upgrades (no once-a-day limit).
- 2026-11-17: The qq TUI update line does ONE thing: `qq update available · <how to install>`. Environment problems (Windows Node under WSL, Node too old) and qualifiers (package lag, npm prefix, nvm scope) never go in the picker; boot/run failures belong on the command line (`qq doctor`), not in the TUI.
- 2026-11-17: In short UI hints (e.g. the update notifier row) the user cares that the message says what to do with the exact command, not about details like the version number. Cut detail before the actionable part, and make sure the command fits the 80-col picker row.
- [2026-11-17] README: the pronunciation lives in the H1 (`# QueQue *(kew-kew)*[^name]`) and the name origin in a GFM footnote at the end; no name paragraph in the intro (user: it was wordy and mixed in info that is not useful). GitHub repo About: "Natural language in, shell command out. You press Enter." (no shell names, not tied to English).

- [2026-11-14] Run the full test suite after every update, not only the files you touched.
- [2026-10-18] Give a time estimate for every task, subagent, test run or review you start, plus the total remaining. Typical times: executor 20–55 min under load, reviewer ~10 min, fixer ~27 min, verifier ~8 min, full suite 2–10 min.
- Commit `.wolf/`, `.planning/` and `.gsd/` with the code they belong to.
- `??` latency is the main product constraint. Pick the smallest change that gets candidates on screen sooner. No LaunchAgent or login daemon: the existing daemon is the warm client.
- [2026-10-07] Treat zsh `$commands` as the source of truth for installed tools. Show candidates that use a missing tool with a flag; never drop them. Install commands never appear as candidates, only through Tab on a flagged row. Keep the model's order. Don't design for edge cases the prompt already prevents.
- [2026-10-10] The missing-tool mark is a cyan ⓘ at the start of the explanation (never ⊘). Show the legend `ⓘ not installed · tab prepends the install command` above the controls when any visible row is flagged. It depends on the visible list, never on the selection. Never add footer lines that change with the selection.
- [2026-10-10] Search matches the command OR its install form, so Tab never hides a row.
- [2026-10-12] FILTER starts empty. The lbuffer shows only in the `queque ›` header. Text typed during `thinking…` becomes the whole filter.
- [2026-10-12] The changelog is written for scanning: Features / Bug Fixes / Deprecations, with commit lists inside `<details>`. A missing ANTHROPIC_API_KEY must not fail a release.
- [2026-10-10] Mark load-flaky timing tests as flaky and rerun them on an idle machine. Don't loosen their guards.
- [2026-11-15] The README shows supported shells and OSes at a glance with badges only: a shell badge row and a "Tested on:" distro + macOS row (under Install since the 2026-11-17 rebrand) (macOS tested by hand, badge links docs/INSTALL.md). No CI/Nightly/Release status badges and no support table (user: "they take up space but aren't actually useful"); Install shows only the brew block; npm and the macOS bash 3.2 note live in docs/INSTALL.md behind one See-Install sentence (user: condense Install, hide npm details). tests/readme-badges.test.ts guards both rows against ci.yml and SHELL_SPECS and fails if either removed item comes back; update the fish badge in the same commit when Phase 12 ships fish.
- Prefer simple solutions: on an unsupported environment, do nothing and print one clear line (final D-12: old bash gets no bindings).

## Key Learnings
- **homebrew-releaser `formula_includes` needs v2+** (2026-11-16): v1 warns "Unexpected input(s) 'formula_includes'" and drops the brew caveats silently. release.yaml now pins `@v4`. A 401 on `api.github.com/repos/k-leumas/queque` from that step means `HOMEBREW_TAP_TOKEN` expired; the token needs Contents on both queque and homebrew-tap.
- **Immutable releases block post-publish assets** (2026-11-17): the repo has immutable releases on, so homebrew-releaser v4's `checksum.txt` upload got 422 after the formula was already pushed. release.yaml sets `skip_checksum: true`; any future step that adds release assets must run before semantic-release publishes.

- **Update notifier** (2026-11-17, quick 261117-jpp): the npm check runs in the daemon, only after a client that passed the env + TTY gate sends `update-hint` (never at daemon start), so CI and non-TTY runs never fetch. Cache and the shared once-a-day `shownAt` live in `${XDG_CACHE_HOME abs or ~/.cache}/queque/update-check.json` on every platform. `detectInstall()` answers who installed qq, never which package manager exists (no pickInstaller). The Homebrew `.install-source` marker is written in BOTH workflow install blocks and the smoke-homebrew-docker emulation (tests/install-marker-formula.test.ts). Every Docker smoke and test container, and vitest, needs QQ_NO_UPDATE_CHECK=1. `qq doctor` has an `update` row (13 rows zsh, 14 macOS bash).
- **Shells:** ZLE widgets run with stdin from /dev/null, so reattach the client to /dev/tty. Pass the buffer as `lbuffer`/`rbuffer` strings, not cursor offsets. zsh needs `rehash` before reading `${(k)commands}` (~10 ms). bash ≥5.0 uses `bind -x` with READLINE_LINE/POINT. fish 4 uses `bind` plus `commandline`. In bash, run background work only as `( cmd & )` (no job notice). Scope per-call env with `local -x`. Reprint the head of a multi-line PS1 after the picker. Every helper the zsh widget calls must exit 0, because the ERR trap deletes the session dir. jq is a hard runtime dependency.
- **Adding a shell:** follow shell/README.md, gated by tests/shell-names-invariant.test.ts. Add the adapter to both Homebrew install blocks (release.yaml, homebrew.yml) and to the smoke script. The instant frame must stay byte-identical across instant-frame-spec.ts and every adapter. Shell-specific prompt cues go in `buildPrompt`, never in `buildSystemPrompt`, because the prewarm cache is keyed on the system-prompt argv.
- **Daemon/IPC:** ensureDaemon replaces a daemon that lacks any pong flag (fetchCandidates, installedTools, streamCandidates, providerPin) or whose `build` id differs. A change to envelope SHAPE or routing needs a new flag. IPC schemas filter unknown VALUES and reject unknown SHAPES. The daemon spawns with cwd home and takes its env from the shell that started it. Dotenv lookup is home-based. After an env change: `pkill -f 'daemon --socket /tmp/qq-'` then `qq daemon --ensure`. Keep socket handlers inside a Promise chain.
- **Providers:** take the SDK path when `usableSecret()` finds a key (an empty key counts as missing); otherwise run `claude -p`. There is no cross-fallback. `claude -p` contract: stream-json in and out, `--effort` from config (default low), `--safe-mode --tools ''`, never `--bare`. Gate on `is_error` and allow-list stop reasons. Never send temperature/top_p. Every adapter uses `buildSystemPrompt`. OpenAI and Ollama are beta: no prose fallback, one silent retry.
- **Ink 7:** one stdin read becomes several key events that all see the same render's state, so key handlers use the `pendingInput` snapshot. `<Text>` takes no layout props (wrap it in `<Box flexShrink={0}>`). An N-line frame takes N+1 rows. `\x7f` is backspace. Only CR is Enter (`key.return`); LF is key `enter` and reaches the handler as text. Real-hooks tests live in tests/candidate-select-layout.test.tsx.
- **Tests:** run one file with `pnpm exec vitest run <file>` (`pnpm test:run -- f` runs everything). `-t` is a regex. Never import main.ts. Modules main.ts loads must read bootstrap bindings lazily. Give each test temp `QQ_CONFIG_FILE`/`QQ_PROVIDER_FILE` and inject `restartDaemon`. Timing tests flake under load (`uptime`; rerun alone or with `--maxWorkers=1`). Also verify on a pty, because pre-push runs with a tty. Run bash tests with `QQ_TEST_BASH=/opt/local/bin/bash`. tap-flat needs single-line, quote-free assertions. Tests that spawn git rely on scrub-git-env.ts.
- **GSD plan checker:** R1 fails a `grep -c` line containing ` = N`, so use `grep -cE` or a separate criterion. R6 rejects `HEAD~N` and bare `git diff`. Cite earlier decisions as "Phase N decision M", never a bare `D-NN`. Keep the `tracer` task type. Fresh worktrees need `pnpm install --frozen-lockfile --offline`. The worktree Bash guard rejects compound git commands, so run them one by one.
- **Docs:** write `qq init zsh && source ~/.zshrc`, never `>> ~/.zshrc`. Keep the README short and point it at docs/*.md with absolute GitHub URLs. Badges and the support table are guarded by tests/readme-badges.test.ts and follow the CI matrix and SHELL_SPECS. Lint workflows with actionlint, because Biome skips .yml.

## Do-Not-Repeat

- [2026-11-15] Never start a background Node job from a shell adapter with the terminal on stdin, stdout or stderr. Node writes back the terminal settings it saw at startup when it exits, even in the background. That undoes Ink's raw mode: Enter arrives as LF (Ink key `enter`, not `return`) and lands in FILTER. Use `</dev/null >/dev/null 2>&1` (smoke-picker-race, zsh prewarm).
- [2026-11-15] commitlint: subjects start lower-case and never with an acronym, review ID or verdict (put IDs in the body). Body lines are 100 chars max.
- [2026-11-15] The OpenWolf post-write hook rewrites anatomy.md descriptions and adds `auto-detected` entries to buglog.json. Before every commit, restore the curated lines from HEAD and drop the noise. buglog.json uses ASCII escapes (ensure_ascii=True), so keep diffs append-only.
- [2026-11-15] bash: `VAR=x 2>/dev/null` ignores the redirect. Use `{ VAR=x; } 2>/dev/null`.
- [2026-11-14] Use `if (row.name === 'bash')` in shared `describe.each` blocks, not `it.skipIf`.
- [2026-11-14] Adding a required zod or telemetry field breaks hand-built fixtures. Grep the tests for them.
- [2026-11-13] Unset ZELLIJ* in any harness that starts a shell with the adapter, or real panes open in the user's session.
- [2026-11-13] fish `read -t` means tokenize, not timeout.
- [2026-11-13] /gsd-review: run Codex with `--model gpt-5.6-terra`. Check reviewer HIGH findings against the source.
- [2026-10-30] Any new prompt in the `??` flow must be checked against EVERY expect smoke (grep scripts/ for `expect`).
- [2026-10-30] After `pull --rebase`, run `git diff --stat ORIG_HEAD HEAD` and restore any wolf file that lost lines.
- [2026-10-30] In the Bash tool, `rm`/`cp` are interactive aliases and `git` is a shell function, and the tool runs zsh (no word-splitting). Use `/bin/rm -f`, `/bin/cp -f`, `whence -p git` and `${=LIST}`.
- [2026-10-29] macOS grep treats a `$` mid-pattern as an anchor. Use `grep -F` for literal shell text.
- [2026-10-29] Parallel executors share the scratchpad, so use commit-message files named after the plan.
- [2026-10-29] biome excludes must be root-anchored (`!!.claude`).
- [2026-10-18] The secret-file guard blocks any command that contains the dotenv filename. Use `git commit -F`.
- [2026-10-12] Fail closed with an allow list of good values, not by blocking one bad value.
- [2026-10-12] Don't seed an editable input with text a header already shows.
- [2026-10-11] Adjust state on prop changes during render (`prevX`), not in an effect.
- [2026-10-07] `packageManager` must pin a pnpm version that ships a darwin-x64 binary (12.6.0).
- [2026-08-26] `execFile` ignores `stdio`. Use `spawn` when stdin must be /dev/null.
- [2026-08-26] Treat a connectable socket as a current daemon only if it answers the capability ping.
- [2026-07-30] Never send temperature/top_p/top_k to Anthropic: the API returns 400, and only a live request shows it.
- [2026-06-08] Never stub dependencies in smoke/integration tests.

## Decision Log

- [2026-11-14] D-12 final: bash <5.0 prints one startup line and binds nothing. `qq init` refuses it and doctor fails it. Don't bring back old-bash `??` bindings.
- [2026-10-30] The pong carries a `build` id, and a rebuilt CLI replaces the running daemon.
- [2026-10-30] Telemetry key left empty for now (backend still open). A consent "yes" carries over to a keyed build.
- [2026-10-29] CI: `ci-ok` is the only required check. No Docker smoke in pre-push. A failed smoke opens an auto-revert PR, where "green" means the whole run passed.
- [2026-10-18] Ollama/OpenAI cut-offs: structured schema, 16k ceiling, thinking off, one silent retry.
- [2026-10-17] provider.json is a versioned strict union with no secrets. The provider is pinned, never chosen by a waterfall.
- [2026-10-12] Phase 09.1: `claude -p` over stream-json, rows streamed over IPC, one prewarmed child keyed on cwd + argv, abort chain socket → AbortController → SIGTERM/SIGKILL, effort low. CR-02 paste limitation accepted.
- [2026-10-11] Zellij: serialized resize queue, pane headroom of 1 cursor row, per-list high-water hold (pane path only).
- [2026-08-26] SDK-first when a key exists. The warm path is the existing daemon, not launchd.