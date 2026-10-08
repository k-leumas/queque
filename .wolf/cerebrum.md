# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-08-26

## User Preferences

- **Commit planning/context with code:** Treat `.wolf/`, `.planning/`, and `.gsd/` as first-class project artifacts — commit them alongside the code they affect, not as optional or local-only files.
- **?? latency is the product constraint:** Prefer the smallest change that cuts time-to-candidates. Reject LaunchAgent/login-daemon work — uninstall/plist/Homebrew path is too much surface for a ~2s cold `ensureDaemon` that does not warm Anthropic or skip Node+Ink boot. SDK-first stays; real next win is a warm HTTP client in a long-lived process.
- **Phase 7 scope — empty-lbuffer only:** User deprioritized event logging, SQLite pattern cache, and precmd proactive suggestions as nice-to-have with uncertain value. Phase 7 should focus on empty-lbuffer ambient `??` (full TUI, Claude with ambient context). Signal priority: failed last command → dirty git → new cwd → nothing obvious.

## Key Learnings

- **Phase 8 selector:** Runtime uses `provider.json` pin or Claude default. `detectProvider()` waterfall is not the long-term adapter selector.
- **`claude -p` flags for QueQue:** Use `--safe-mode --tools "" --no-session-persistence --output-format text` and argv prompt. Never `--bare` (skips Keychain/OAuth). Never `--output-format json` into `parseCandidates` (wrapper envelope). Stdin must be `ignore` or Ink/Zellij hangs. Shared 25s CLI+SDK budget under FIFO 30s.
- **SDK-first when a key exists:** `claudeDefaultAdapter` calls the Anthropic SDK when `usableSecret()` finds `ANTHROPIC_API_KEY` in env or `.env.local`. Spawn `claude -p` only for `/login`-only users. CLI-first (old D-08) made `??` ~6s because every query paid Claude Code process boot.
- **Warm client is the daemon, not launchd:** Foreground Ink still starts per `??`. `fetch-candidates` IPC runs `fetchCandidates` in the daemon so `getAnthropicClient()` reuses one SDK instance (TLS/keep-alive). LaunchAgent was reverted — uninstall/plist cost with no hot-path win. Shell prewarm (`qq daemon --ensure`) runs for `QQ_DEV_ROOT` or `qq` on PATH.
- **Stale daemons ignore new IPC:** `ensureDaemon` connect-success is not enough. Pre-fetch daemons pong but swallow `fetch-candidates`; the client then waits 26s. Ping must advertise `fetchCandidates: true`, fetch must ack immediately, and `ensureDaemon` replaces a live pong without the flag. Unanswered ping stays so dumb test sockets are not killed.
- **Empty `ANTHROPIC_API_KEY=""` is not missing:** `??` does not fall through. Use `usableSecret()` (trim, reject empty) before `.env.local`.
- **Node `execFile` ignores `stdio`:** `child_process.execFile` / `promisify(execFile)` always spawn with piped stdin. Passing `stdio: ['ignore','pipe','pipe']` is a no-op — `child.stdin` stays writable. Use `spawn` when stdin must be `/dev/null`. Phase 08 CR-01: this can hang `claude -p` for 25s and skip SDK rescue.
- **Project:** tui-llm
- Claude Code `/login` stores OAuth in macOS Keychain (not `~/.claude/.credentials.json`). Prototype `detectProvider()` Step 2 only stats the credentials file, so darwin logged-in users miss `claude-cli`. Phase 8 / 08-01 must use platform-aware presence (`claude` on PATH on darwin; file/env elsewhere) — no Keychain read, no `claude -p` probe (200 ms budget).
- ZLE user-defined widgets run with stdin redirected from `/dev/null`; any foreground TUI client launched from the widget must be reattached to `/dev/tty` explicitly.
- For shell-return contracts between `zsh` and Node, split-buffer payloads (`lbuffer`/`rbuffer`) are safer than numeric cursor offsets because they avoid cross-runtime Unicode indexing mismatches.
- Phase 2 should treat context gathering as a pre-provider concern; `src/providers/claude.ts` owning git detection is acceptable as a Phase 1 seam but the planner should remove that coupling before more intents are added.

## Do-Not-Repeat
- [2026-10-07] `packageManager` must pin a pnpm that ships a darwin-x64 binary (11.8.0 did not; pnpm then refused every command incl. lefthook hooks). Now pinned to 12.6.0 to match the global install. If pnpm errors with ERR_PNPM_PNPM_ENGINE_NO_NATIVE_BINARY, repin rather than using `pnpm_config_pm_on_fail=ignore`.
- [2026-10-07] commitlint subject-case rejects subjects starting with an acronym (e.g. "SDK-first ..."). Start the subject with a lowercase word.

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->
- [2026-05-01] When planning shell-bridge phases, do not stop at cancel-only seams or placeholder CLI stubs; Phase 1 plans must include a deterministic accepted `replace-buffer` round trip and real `main.ts` handler wiring, plus executable install/build verification for toolchain claims.
- [2026-05-14] In ES modules, `const` declarations at module level are in the temporal dead zone until their line executes. If the file has a top-level `await` call (e.g. `await main()`), any `const` placed after that line will throw a TDZ ReferenceError at runtime. Always place module-level constants before the first top-level `await`. Biome and vitest will not catch this — only manual inspection or running the script will.
- [2026-06-08] Never stub or fake a dependency (e.g. injecting a fake `git` binary) in a smoke/integration test just to make the build succeed. Stubbing hides the exact failure mode real users will hit. If a dependency is unavailable in the test environment, the test must either (a) remove/skip it so the code path exercises the real fallback, or (b) fail loudly so the underlying code is fixed. A test that passes by construction rather than by correctness is worse than no test.
- [2026-07-30] Do not pass `temperature`, `top_p`, or `top_k` to the Anthropic Messages API. The default model `claude-sonnet-5` (and the Opus 4.7/4.8 family) removed these sampling parameters — any non-default value returns a `400 invalid_request_error` ("`temperature` is deprecated for this model"). This is a runtime-only failure; TypeScript, biome, and vitest will not catch it — only a live request (e.g. scripts/smoke-homebrew-docker.sh) surfaces it. Steer output via the system prompt instead.
- [2026-08-25] Do not invoke `claude -p --bare` for QueQue `/login` users. Bare mode skips Keychain and OAuth. Use `--safe-mode --tools ""` instead. Do not pass `--output-format json` into `parseCandidates` (wrapper envelope, not candidate array).
- [2026-08-26] Do not copy `tests/context-pipeline.test.ts` raw `execFile` + `promisify` for CLI spawn tests. A `vi.fn()` mock of `execFile` has no `[util.promisify.custom]`, so promisify resolves to an **array**; `const { stdout } = await execFileAsync(...)` is `undefined`. Mock a thin `execFileAsync` that resolves `{ stdout, stderr }`. Register `claudeDefaultAdapter` as `claude-cli`, not raw `claudeCliAdapter`.
- [2026-08-26] TDD RED tests that import new modules fail `tsc --noEmit` in pre-commit. Add throw-on-call stubs with the public exports so typecheck can commit; keep fetch behavior unimplemented until GREEN.
- [2026-08-26] Do not implement `execFileAsync` with `promisify(execFile)` when the call site needs `stdio: ['ignore','pipe','pipe']`. Node `execFile` does not take `stdio`; mocks that only assert `options.stdio[0]==='ignore'` will pass while production hangs. Use `spawn` and add an unmocked stdin-EOF child test.
- [2026-08-26] Do not use `??` to resolve `ANTHROPIC_API_KEY`. An exported empty string is a present value and blocks `.env.local`. Use `usableSecret()` first.
- [2026-08-26] Do not spawn `claude -p` when a usable API key exists. CLI-first made `??` ~6s (Claude Code boot). SDK-first for keys; CLI only for `/login`-only users.
- [2026-08-26] Do not treat a connectable socket as a current daemon. Pre-fetch listeners ignore `fetch-candidates` and stall the client for the full IPC timeout. Require `fetch-accepted` within ~800ms and replace pongs that lack `fetchCandidates: true`. Keep unanswered ping so test dummy servers are not restarted.

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->
- [2026-07-31] Phase 8 docs-only expansion: document macOS Keychain detection gap in ROADMAP + 08-RESEARCH + 08-01-PLAN before code. Detection strategy for darwin: PATH-only presence; validate auth at 08-02 subprocess call time. Prefer false-positive (installed but logged out) over missing logged-in Keychain users.
- [2026-08-25] Phase 8 provider selection: pin, not waterfall. Claude is the silent default (`claude -p` then env-key SDK rescue). OpenAI/Ollama are an explicit `~/.config/qq/provider.json` pin from a first-run/`qq init provider` quiz — never probed on every `??`, never a silent Claude→OpenAI→Ollama fallthrough. Do not attach the quiz to `qq init zsh`. 08-01 `claudeAuthPresent()` is leftover preflight, not the 08-02 fetch gate.
- [2026-08-25] 08-02 CLI: `--bare` is incompatible with `/login` (no Keychain/OAuth). `--max-turns` is in official docs but missing from Claude Code 2.1.206 `--help` — omit unknown flags. Bypass `detectProvider()` as selector; do not delete.
- [2026-08-25] 08-02 reviews: register `claudeDefaultAdapter` (CLI+SDK) as `claude-cli`, not the raw CLI adapter. Mock `execFileAsync` resolving `{stdout,stderr}` — do not copy git-context `promisify(execFile)`. Prompt stays on argv; `ps` disclosure is accepted risk T-08-02-07 (stdin+`-p` not proven).
- [2026-08-26] 08-02 spawn privacy: keep prompt as last argv (`stdio: ['ignore','pipe','pipe']`). RESEARCH does not prove stdin write+close is safe with `claude -p` (print mode reads stdin; open pipe hangs Ink). Process-list (`ps`) disclosure of the filtered prompt is an accepted risk (T-08-02-07) until a later verified stdin contract.
- [2026-08-26] Flip D-08: SDK-first when `usableSecret()` finds `ANTHROPIC_API_KEY` in env or `.env.local`; `claude -p` only when no usable key (`/login`). Restores ~1–2s latency for API-key users. `/login`-only stays on CLI spawn.
- [2026-08-26] Warmup option (b) LaunchAgent reverted. Speed path is `fetch-candidates` in the existing daemon plus a cached Anthropic client. Shell `qq daemon --ensure` prewarm is enough to have that process up. Do not add login plists for this.
