---
phase: 08-zero-config-install-and-provider-detection
verified: 2026-08-26T04:15:00Z
status: gaps_found
score: 10/15 must-haves verified
gaps:
  - truth: "D-07/D-03: Claude /login (claude -p) and ANTHROPIC_API_KEY both produce candidates"
    status: failed
    reason: "CR-01: execFileAsync is promisify(execFile), which ignores stdio. child.stdin stays an open pipe. Research Pitfall 2 says claude -p reads stdin; an open pipe can hang until the 25s budget, then remainingMs < MIN_SDK_RESCUE_MS skips SDK rescue even when a key exists. Tests mock execFileAsync and only assert options.stdio[0]==='ignore', so they cannot catch this. Same root cause also falsifies the spawn stdin-ignore clause."
    artifacts:
      - path: "src/providers/claude-exec.ts"
        issue: "promisify(execFile) discards stdio; empirically child.stdin remains writable under { stdio: ['ignore','pipe','pipe'] }"
      - path: "src/providers/claude-cli.ts"
        issue: "Passes stdio ignore into execFileAsync, but the option is a no-op at runtime"
    missing:
      - "Implement execFileAsync with spawn so stdio ignore is actually applied"
      - "Unmocked unit test that a stdin-until-EOF child exits instead of hanging"
  - truth: "Spawn argv never includes --bare; stdin is ignore; prompt stays last argv"
    status: partial
    reason: "No --bare and prompt-last-argv are wired. stdin ignore is set on the options object but not honored by execFile (CR-01). Grouped with D-07."
    artifacts:
      - path: "src/providers/claude-exec.ts"
        issue: "stdio ignore not applied"
    missing:
      - "Same spawn-based execFileAsync fix as D-07"
  - truth: "A developer with Ollama running locally gets a working qq with zero extra steps"
    status: failed
    reason: "08-03 not planned or executed. Locked D-01–D-15: OpenAI/Ollama are pin-not-waterfall, not 08-02 bugs. No Ollama adapter exists; resolver maps ollama → Claude default."
    artifacts:
      - path: "src/providers/resolver.ts"
        issue: "ollama kind returns Claude default as an 08-02 bridge, not an Ollama adapter"
    missing:
      - "08-03 Ollama adapter registered in provider-backends"
      - "provider.json pin so runtime honors ollama without probing every ?? "
  - truth: "A developer with OPENAI_API_KEY gets a working qq with zero extra steps"
    status: failed
    reason: "08-03 not planned or executed. ANTHROPIC_API_KEY works via Claude SDK rescue; OPENAI_API_KEY is detected by leftover detectProvider but never used as a backend."
    artifacts: []
    missing:
      - "08-03 OpenAI adapter"
      - "provider.json pin for openai"
  - truth: "When nothing is detected, guide the user to a working setup in under 60 seconds"
    status: failed
    reason: "08-03 wizard not implemented. None-path today tries Claude default then FIFO D-13 /login copy — actionable for Claude, not a picker, not <60s install guidance for Ollama/OpenAI."
    artifacts: []
    missing:
      - "08-03 first-failed-?? or qq init provider quiz on /dev/tty"
      - "Persist ~/.config/qq/provider.json"
      - "Do not attach the quiz to qq init zsh (D-05)"
---

# Phase 08: Zero-Config Install and Provider Detection Verification Report

**Phase Goal:** Make `qq` work on first run without any manual configuration. Detect Claude Code, Ollama, and OpenAI CLI auth in priority order and use the first available backend. When nothing is detected, guide the user to a working setup in under 60 seconds. The subprocess adapter is the right first implementation — token reuse and native API integration are later optimizations.
**Verified:** 2026-08-26T04:15:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

Locked D-01–D-15 supersede ROADMAP’s “detect every backend and use the first” as the *selector*. Claude is the silent default; OpenAI/Ollama are an explicit `provider.json` pin in 08-03. This report scores 08-01/08-02 must-haves against the codebase and treats 08-03 success criteria as phase gaps, not 08-02 implementation bugs.

**Executed this run:** 08-01 (platform-aware Claude auth detection) and 08-02 (Claude CLI-first + SDK rescue). **Not executed:** 08-03 (pin + OpenAI/Ollama adapters + wizard). ROADMAP shows 2/3 plans complete.

## Goal Achievement

08-01 detection and 08-02 Claude-default wiring exist and are connected. The phase goal is not achieved: (1) live `claude -p` stdin isolation is a no-op (CR-01), so `/login` zero-config is not proven and can hang the 25s budget; (2) Ollama, OpenAI, and the setup wizard are still 08-03.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | darwin + `claude` on PATH + no credentials file → `detectProvider` returns `claude-cli` | ✓ VERIFIED | `claudeAuthPresent()` returns true on darwin after PATH gate; `tests/provider-detect.test.ts` darwin case |
| 2 | linux/win + `claude` on PATH + no credentials file → falls through | ✓ VERIFIED | Non-darwin uses `claudeAuthFileExists()`; linux test expects Ollama fallthrough |
| 3 | `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_AUTH_TOKEN` + `claude` on PATH → `claude-cli` | ✓ VERIFIED | Truthiness-only env check; two dedicated tests |
| 4 | Credentials file still detects `claude-cli` on non-darwin | ✓ VERIFIED | `fsp.stat` only; linux + auth file test |
| 5 | `none` message mentions credentials file or macOS Keychain login | ✓ VERIFIED | `detect.ts` Step 5 copy; test assertion |
| 6 | Detection never reads credential contents or Keychain secrets | ✓ VERIFIED | `stat` only; no `readFile`, no `security`/`keychain`, no `claude -p` in `detect.ts` |
| 7 | D-07/D-03: `/login` via `claude -p` and `ANTHROPIC_API_KEY` both produce candidates | ✗ FAILED | SDK rescue + CLI-success paths are coded and unit-tested; **runtime stdin ignore is a no-op (CR-01)**. `execFile` leaves `child.stdin` writable. If `claude -p` reads stdin, the CLI hangs ~25s and SDK rescue is skipped |
| 8 | D-08/D-09/D-10: CLI-first, SDK rescue when key exists, no `detectProvider` fetch gate | ✓ VERIFIED | Composite tries CLI first; ENOENT/auth-fail + key calls SDK; `run-foreground.ts` has no `detectProvider`. CR-01 can starve rescue after a hang — tracked under truth 7 |
| 9 | D-11/D-12/D-13: no “not wired yet”; no OpenAI/Ollama fallthrough; FIFO `/login` error, buffer unchanged | ✓ VERIFIED | Resolver maps every kind to Claude default; D-13 copy; `formatFifoError` single `QueQue:` prefix; `writeShellResult({ kind: 'error' })` |
| 10 | D-01–D-06/D-14/D-15: 08-02 ships Claude only — no OpenAI/Ollama adapters, no `provider.json` | ✓ VERIFIED | No openai/ollama modules under `src/`; `provider.json` only in comments/docs as upcoming 08-03; `init.ts` has no provider quiz |
| 11 | Combined CLI+SDK budget 25s (RUN-01); `claude-cli` registry id is `claudeDefaultAdapter` (EXT-01) | ✓ VERIFIED | `TOTAL_BUDGET_MS = 25_000`, `remainingMs` + `MIN_SDK_RESCUE_MS = 1000`; zsh `read -r -t 30`; bootstrap registers composite, not `claudeCliAdapter` |
| 12 | Spawn argv never `--bare`; stdin ignore; prompt last argv; child env is `process.env` | ✗ FAILED | `--bare` absent; prompt is last argv; env not injected. **`stdio: ['ignore',…]` is set but discarded by `execFile`** |
| 13 | Ollama running locally → working `qq` with zero extra steps (ROADMAP #2) | ✗ FAILED | 08-03 not started; no Ollama adapter |
| 14 | `OPENAI_API_KEY` → working `qq` with zero extra steps (ROADMAP #3) | ✗ FAILED | 08-03 not started. Anthropic key works via Claude default; OpenAI key is unused on the hot path |
| 15 | Nothing detected → setup wizard under 60 seconds (ROADMAP #4) | ✗ FAILED | 08-03 not started. None-path is Claude attempt then D-13 FIFO copy |

**Score:** 10/15 truths verified

ROADMAP #5 (detection &lt; 200 ms) holds for leftover `detectProvider` (PATH + optional stat/env; Ollama fetch 300 ms timeout) but that function is not the hot-path selector. ROADMAP #6 (detected provider logged) is met by `appendDebugLog` `path: 'claude-cli' | 'sdk-rescue'` as the 08-02 stand-in. ROADMAP #7 (macOS `/login` detected as `claude-cli`) is true for leftover detect; runtime `/login` does not use detect — it always tries `claude -p` (truth 7).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/providers/detect.ts` | Platform-aware `claudeAuthPresent` | ✓ VERIFIED | Exists, substantive, leftover preflight only (D-10) |
| `tests/provider-detect.test.ts` | Platform-split + env-token coverage | ✓ VERIFIED | 12/12 pass. WR-01: Branch 2 does not stub OAuth env vars |
| `src/providers/claude-exec.ts` | Mockable `{ stdout, stderr }` spawn | ⚠️ DEFECTIVE | Exists, exported, wired; **uses `promisify(execFile)` so stdio ignore is a no-op** |
| `src/providers/claude-cli.ts` | `claude -p` + `parseCandidates` | ✓ VERIFIED | Locked argv, `--safe-mode`, `--tools ""`, no `--bare`; calls `execFileAsync` |
| `src/providers/claude-default.ts` | CLI-first composite + `remainingMs` | ✓ VERIFIED | `sdk-rescue` path; no `detect.ts` import |
| `src/providers/claude.ts` | Shared prompt/parse/`QUEQUE_SYSTEM` | ✓ VERIFIED | Exports required; optional `timeoutMs`; no temperature/top_p/top_k |
| `src/registry/bootstrap.ts` | Register `claudeDefaultAdapter` as `claude-cli` | ✓ VERIFIED | `claudeCliAdapter` not registered |
| `src/providers/resolver.ts` | Claude-default resolution, 08-02 bridge comment | ✓ VERIFIED | All kinds → `resolveClaudeDefaultAdapter()` |
| `tests/claude-cli-provider.test.ts` | Wave 0 object-shaped mocks | ✓ VERIFIED | `execFileAsync` `{ stdout }` mocks; `/claude \/login/` regex (gsd-tools `contains: "claude /login"` is a false negative) |
| `src/client/run-foreground.ts` | Resolve composite, FIFO errors | ✓ VERIFIED | `resolveClaudeDefaultAdapter()`; no `detectProvider` |

gsd-tools artifacts: 08-01 2/2 passed; 08-02 6/7 passed (false fail on test `contains`).

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `src/client/run-foreground.ts` | `src/providers/resolver.ts` | `resolveClaudeDefaultAdapter` | WIRED | llm path line 147; no `detectProvider` |
| `src/providers/claude-default.ts` | `src/providers/claude-cli.ts` | `fetchClaudeCliCandidates` | WIRED | then SDK `fetchCandidates` with remaining ms |
| `src/providers/claude-cli.ts` | `src/providers/claude-exec.ts` | `execFileAsync` | PARTIAL | Call is real; **stdio option not applied** |
| `src/providers/claude-cli.ts` | `src/providers/claude.ts` | `buildPrompt` / `QUEQUE_SYSTEM` | WIRED | Prompt last argv |
| `src/registry/bootstrap.ts` | `src/providers/claude-default.ts` | `adapter: claudeDefaultAdapter` | WIRED | id `claude-cli` |
| `src/client/run-foreground.ts` | `src/client/result-writer.ts` | `kind: 'error'` | WIRED | `formatFifoError` prevents `QueQue: QueQue:` |
| `src/providers/detect.ts` | `src/providers/resolver.ts` | kind `claude-cli` | LEFTOVER | Pattern exists; **hot path does not call `detectProvider`** (D-10, by design) |

gsd-tools key-links: 08-01 1/1, 08-02 6/6 pattern-found (does not catch CR-01).

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `claudeDefaultAdapter` | `CandidateList` | `claude -p` stdout → `parseCandidates` | Yes when spawn succeeds; **hang risk if CLI reads stdin** | ⚠️ AT RISK |
| `claudeDefaultAdapter` SDK rescue | `CandidateList` | Anthropic `messages.create` | Yes when key present and remaining ≥ 1000 ms | ✓ FLOWING |
| `runForegroundClient` llm | candidates → Ink modal | `adapter.fetchCandidates(envelope)` | Wired; not hardcoded empty | ✓ FLOWING |
| FIFO error | `message` | adapter throw → `formatFifoError` | D-13 copy, not empty | ✓ FLOWING |

No hollow empty-array props. Candidate data is not stubbed in production; tests mock spawn/SDK.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 08-01/08-02 unit tests | `pnpm vitest run tests/provider-detect.test.ts tests/claude-cli-provider.test.ts tests/provider-resolver.test.ts tests/registry-bootstrap.test.ts tests/client-result.test.ts tests/claude-provider.test.ts` | 6 files, **62 passed** | ✓ PASS |
| `execFile` honors stdio ignore | Node script: `execFile(node, stdin-EOF-script, { stdio: ['ignore','pipe','pipe'] })` vs `spawn` | `execFile` `child.stdin` is writable (`typeof write === 'function'`); `spawn` `child.stdin === null` | ✗ FAIL (CR-01) |
| No `--bare` in providers | `rg --bare src/providers` | no matches | ✓ PASS |
| No detect selector on hot path | `rg detectProvider src/client/run-foreground.ts` | no matches | ✓ PASS |
| No “not wired yet” in resolver/client | `rg "not wired yet" src/providers/resolver.ts src/client` | no matches | ✓ PASS |
| Composite registered | `bootstrap.ts` `adapter: claudeDefaultAdapter` | present; `claudeCliAdapter` absent from registry | ✓ PASS |
| Full suite | `pnpm test:run` in sandbox | 232 passed / 4 daemon EPERM (Unix sockets) | ? SKIP in sandbox; orchestrator reported **236 passed** unsandboxed |

### Requirements Coverage

Plan frontmatter IDs: **RUN-01**, **EXT-01** (both 08-01 and 08-02). `REQUIREMENTS.md` maps those IDs to Phase 1 / Phase 2 Complete — no additional Phase 8 IDs. No orphaned REQUIREMENTS.md IDs for Phase 8.

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| RUN-01 | 08-01, 08-02 | Daemon keeps repeat invocations fast; 08-02 adds 25s CLI+SDK budget under zsh `read -t 30` | ✓ SATISFIED | `ensureDaemon` still on foreground path; `TOTAL_BUDGET_MS = 25_000`; `remainingMs` / `MIN_SDK_RESCUE_MS`. CR-01 can consume the full 25s on a stdin hang |
| EXT-01 | 08-01, 08-02 | Internal registries including provider backends | ✓ SATISFIED | `registerProviderBackend({ id: 'claude-cli', adapter: claudeDefaultAdapter })` beside existing `claude`; four registries unchanged |

`REQUIREMENTS.md` checkboxes were already `[x]` from earlier phases. Phase 8 extends them; it does not introduce new IDs.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/providers/claude-exec.ts` | 10–24 | `promisify(execFile)` with unused `stdio` | 🛑 Blocker | CR-01 — stdin isolation no-op; can hang `/login` and skip SDK rescue |
| `tests/provider-detect.test.ts` | 133–143 | Branch 2 does not stub `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_AUTH_TOKEN` | ⚠️ Warning | WR-01 — leftover detect test can false-pass if host env is set |
| `src/providers/detect.ts` | 13–19 | `execSync('which claude')` | ⚠️ Warning | WR-02 — Windows leftover preflight never reaches auth checks; not the 08-02 selector |
| `src/providers/claude-default.ts` | 65–68 | `process.env.ANTHROPIC_API_KEY ?? .env.local` | ⚠️ Warning | WR-03 — empty `ANTHROPIC_API_KEY=` blocks `.env.local` rescue (`??` not `\|\|`) |
| `src/providers/claude.ts` | 15 | angle-bracket `<placeholder>` in `QUEQUE_SYSTEM` | ℹ️ Info | Prompt contract, not a stub |

No TODO/FIXME/not-implemented in 08-02 production modules. `detectProvider()` waterfall remains as leftover preflight (locked, not a bug).

### Human Verification Required

### 1. Live Claude `/login` (Keychain, no API key)

**Test:** On macOS, with `claude` on PATH, authenticated via `claude /login`, no `ANTHROPIC_API_KEY`, trigger `??`.
**Expected:** Ranked candidates from `claude -p` within 25s; no provider quiz.
**Why human:** Needs real Claude Code + Keychain. CR-01 predicts a hang/timeout instead.

### 2. Confirm stdin hang with real `claude -p`

**Test:** Spawn `claude -p ...` the same way production does (`execFile` vs `spawn` with stdin ignore) and watch whether print mode waits on stdin.
**Expected:** After a spawn-based fix, the child should see EOF and return candidates; today `execFile` should leave stdin open.
**Why human:** Must not stub a fake `claude` binary (cerebrum Do-Not-Repeat).

### 3. SDK rescue with `.env.local` only

**Test:** Logged-out or missing CLI, key only in `.env.local`, trigger `??`.
**Expected:** Candidates via SDK; child env has no injected `.env.local` key.
**Why human:** Live Anthropic API.

### 4. Zellij pane isolation

**Test:** Trigger `??` inside Zellij.
**Expected:** No Claude TUI chrome stealing the pane (`--safe-mode`, `--tools ""`, stdin not inherited).
**Why human:** Interactive TTY / pane behavior.

### 5. 08-03 wizard and non-Claude backends

**Test:** Not available yet.
**Expected:** After 08-03: Ollama pin, OpenAI pin, first-failed-`??` / `qq init provider` under 60s.
**Why human:** Feature not implemented.

### Gaps Summary

Two independent gap groups:

**A. 08-02 runtime defect (CR-01)** — blocks Claude `/login` zero-config (success criteria 1 and 7 as a *working* `??`, not merely leftover detect). `claude-cli.ts` correctly *requests* `stdio: ['ignore','pipe','pipe']`, but `claude-exec.ts` uses `promisify(execFile)`, which does not accept `stdio`. Empirical check on Node 26: `execFile(..., { stdio: ['ignore',…] })` still exposes a writable `child.stdin`; `spawn` sets `child.stdin` to `null`. Wave 0 tests mock `execFileAsync` and cannot see this. If `claude -p` reads stdin (RESEARCH Pitfall 2), `/login` users hang until timeout and key-holders with `claude` on PATH also miss SDK rescue.

**B. 08-03 not started** — ROADMAP criteria 2–4 (Ollama, OpenAI, wizard) and D-14/D-15. Missing adapters are **not** 08-02 bugs. 08-02 correctly maps `ollama` / `openai-key` / `none` to Claude default and documents the pin as upcoming.

WR-01/WR-02/WR-03 are advisory and do not by themselves fail the 08-01/08-02 must-haves, except WR-03 is an edge-case hole in D-09 when `ANTHROPIC_API_KEY` is exported empty.

08-01 platform-aware detection is complete as leftover preflight. 08-02 wiring (composite registry, detect bypass, D-13 FIFO, 25s budget, argv contract minus live stdin) is in place. Phase 8 goal is not achieved until CR-01 is fixed and 08-03 lands.

---

_Verified: 2026-08-26T04:15:00Z_
_Verifier: Claude (gsd-verifier)_
