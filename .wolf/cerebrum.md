# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-08-26

## User Preferences

- **Commit planning/context with code:** Treat `.wolf/`, `.planning/`, and `.gsd/` as first-class project artifacts — commit them alongside the code they affect, not as optional or local-only files.
- **Phase 7 scope — empty-lbuffer only:** User deprioritized event logging, SQLite pattern cache, and precmd proactive suggestions as nice-to-have with uncertain value. Phase 7 should focus on empty-lbuffer ambient `??` (full TUI, Claude with ambient context). Signal priority: failed last command → dirty git → new cwd → nothing obvious.

## Key Learnings

- **Phase 8 selector:** Runtime uses `provider.json` pin or Claude default. `detectProvider()` waterfall is not the long-term adapter selector.
- **`claude -p` flags for QueQue:** Use `--safe-mode --tools "" --no-session-persistence --output-format text` and argv prompt. Never `--bare` (skips Keychain/OAuth). Never `--output-format json` into `parseCandidates` (wrapper envelope). Stdin must be `ignore` or Ink/Zellij hangs. Shared 25s CLI+SDK budget under FIFO 30s.
- **Project:** tui-llm
- Claude Code `/login` stores OAuth in macOS Keychain (not `~/.claude/.credentials.json`). Prototype `detectProvider()` Step 2 only stats the credentials file, so darwin logged-in users miss `claude-cli`. Phase 8 / 08-01 must use platform-aware presence (`claude` on PATH on darwin; file/env elsewhere) — no Keychain read, no `claude -p` probe (200 ms budget).
- ZLE user-defined widgets run with stdin redirected from `/dev/null`; any foreground TUI client launched from the widget must be reattached to `/dev/tty` explicitly.
- For shell-return contracts between `zsh` and Node, split-buffer payloads (`lbuffer`/`rbuffer`) are safer than numeric cursor offsets because they avoid cross-runtime Unicode indexing mismatches.
- Phase 2 should treat context gathering as a pre-provider concern; `src/providers/claude.ts` owning git detection is acceptable as a Phase 1 seam but the planner should remove that coupling before more intents are added.

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->
- [2026-05-01] When planning shell-bridge phases, do not stop at cancel-only seams or placeholder CLI stubs; Phase 1 plans must include a deterministic accepted `replace-buffer` round trip and real `main.ts` handler wiring, plus executable install/build verification for toolchain claims.
- [2026-05-14] In ES modules, `const` declarations at module level are in the temporal dead zone until their line executes. If the file has a top-level `await` call (e.g. `await main()`), any `const` placed after that line will throw a TDZ ReferenceError at runtime. Always place module-level constants before the first top-level `await`. Biome and vitest will not catch this — only manual inspection or running the script will.
- [2026-06-08] Never stub or fake a dependency (e.g. injecting a fake `git` binary) in a smoke/integration test just to make the build succeed. Stubbing hides the exact failure mode real users will hit. If a dependency is unavailable in the test environment, the test must either (a) remove/skip it so the code path exercises the real fallback, or (b) fail loudly so the underlying code is fixed. A test that passes by construction rather than by correctness is worse than no test.
- [2026-07-30] Do not pass `temperature`, `top_p`, or `top_k` to the Anthropic Messages API. The default model `claude-sonnet-5` (and the Opus 4.7/4.8 family) removed these sampling parameters — any non-default value returns a `400 invalid_request_error` ("`temperature` is deprecated for this model"). This is a runtime-only failure; TypeScript, biome, and vitest will not catch it — only a live request (e.g. scripts/smoke-homebrew-docker.sh) surfaces it. Steer output via the system prompt instead.
- [2026-08-25] Do not invoke `claude -p --bare` for QueQue `/login` users. Bare mode skips Keychain and OAuth. Use `--safe-mode --tools ""` instead. Do not pass `--output-format json` into `parseCandidates` (wrapper envelope, not candidate array).
- [2026-08-26] Do not copy `tests/context-pipeline.test.ts` raw `execFile` + `promisify` for CLI spawn tests. A `vi.fn()` mock of `execFile` has no `[util.promisify.custom]`, so promisify resolves to an **array**; `const { stdout } = await execFileAsync(...)` is `undefined`. Mock a thin `execFileAsync` that resolves `{ stdout, stderr }`. Register `claudeDefaultAdapter` as `claude-cli`, not raw `claudeCliAdapter`.
- [2026-08-26] TDD RED tests that import new modules fail `tsc --noEmit` in pre-commit. Add throw-on-call stubs with the public exports so typecheck can commit; keep fetch behavior unimplemented until GREEN.

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->
- [2026-07-31] Phase 8 docs-only expansion: document macOS Keychain detection gap in ROADMAP + 08-RESEARCH + 08-01-PLAN before code. Detection strategy for darwin: PATH-only presence; validate auth at 08-02 subprocess call time. Prefer false-positive (installed but logged out) over missing logged-in Keychain users.
- [2026-08-25] Phase 8 provider selection: pin, not waterfall. Claude is the silent default (`claude -p` then env-key SDK rescue). OpenAI/Ollama are an explicit `~/.config/qq/provider.json` pin from a first-run/`qq init provider` quiz — never probed on every `??`, never a silent Claude→OpenAI→Ollama fallthrough. Do not attach the quiz to `qq init zsh`. 08-01 `claudeAuthPresent()` is leftover preflight, not the 08-02 fetch gate.
- [2026-08-25] 08-02 CLI: `--bare` is incompatible with `/login` (no Keychain/OAuth). `--max-turns` is in official docs but missing from Claude Code 2.1.206 `--help` — omit unknown flags. Bypass `detectProvider()` as selector; do not delete.
- [2026-08-25] 08-02 reviews: register `claudeDefaultAdapter` (CLI+SDK) as `claude-cli`, not the raw CLI adapter. Mock `execFileAsync` resolving `{stdout,stderr}` — do not copy git-context `promisify(execFile)`. Prompt stays on argv; `ps` disclosure is accepted risk T-08-02-07 (stdin+`-p` not proven).
- [2026-08-26] 08-02 spawn privacy: keep prompt as last argv (`stdio: ['ignore','pipe','pipe']`). RESEARCH does not prove stdin write+close is safe with `claude -p` (print mode reads stdin; open pipe hangs Ink). Process-list (`ps`) disclosure of the filtered prompt is an accepted risk (T-08-02-07) until a later verified stdin contract.
