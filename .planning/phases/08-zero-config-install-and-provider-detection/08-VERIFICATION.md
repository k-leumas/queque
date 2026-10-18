---
phase: 08-zero-config-install-and-provider-detection
verified: 2026-10-18T02:45:00Z
status: human_needed
score: 24/26 must-haves verified
covered_files:
  - .planning/phases/08-zero-config-install-and-provider-detection/08-01-PLAN.md
  - .planning/phases/08-zero-config-install-and-provider-detection/08-01-SUMMARY.md
  - .planning/phases/08-zero-config-install-and-provider-detection/08-02-PLAN.md
  - .planning/phases/08-zero-config-install-and-provider-detection/08-02-SUMMARY.md
  - .planning/phases/08-zero-config-install-and-provider-detection/08-03-PLAN.md
  - .planning/phases/08-zero-config-install-and-provider-detection/08-03-SUMMARY.md
  - .planning/phases/08-zero-config-install-and-provider-detection/08-04-PLAN.md
  - .planning/phases/08-zero-config-install-and-provider-detection/08-04-SUMMARY.md
  - .planning/phases/08-zero-config-install-and-provider-detection/08-05-PLAN.md
  - .planning/phases/08-zero-config-install-and-provider-detection/08-05-SUMMARY.md
  - .planning/phases/08-zero-config-install-and-provider-detection/08-06-PLAN.md
  - .planning/phases/08-zero-config-install-and-provider-detection/08-06-SUMMARY.md
  - README.md
  - docs/EXTENSIONS.md
  - src/cli/commands/init-provider.ts
  - src/cli/main.ts
  - src/contracts/ipc.ts
  - src/daemon/bootstrap.ts
  - src/daemon/fetch-client.ts
  - src/daemon/server.ts
  - src/providers/claude-default.ts
  - src/providers/claude-exec.ts
  - src/providers/detect.ts
  - src/providers/ollama.ts
  - src/providers/openai.ts
  - src/providers/provider-pin.ts
  - src/providers/provider.ts
  - src/providers/resolver.ts
  - src/registry/bootstrap.ts
covered_digest: "v3:sha256:f2dbaa04e028d02685c78b1825a12ffa349e65798753bceb8d31ab7979481dcf"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 10/15
  gaps_closed:
    - "D-07/D-03: Claude /login (claude -p) and ANTHROPIC_API_KEY both produce candidates (CR-01 stdin hang)"
    - "Spawn argv never includes --bare; child stdin cannot hold claude -p open"
    - "Truth #13 (as amended by D-04/D-14): an Ollama pin answers ?? through the daemon"
    - "Truth #14 (as amended by D-04/D-14): an OpenAI pin with OPENAI_API_KEY answers ?? through the daemon"
    - "Truth #15 (as amended by D-04/D-14): nothing works -> clear copy plus `qq init provider`, at most two answers"
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "Daemon-down in-process fallback reads ANTHROPIC_API_KEY / OPENAI_API_KEY from .env.local relative to the client's cwd, while the daemon (WR-08) and the picker read from the home directory"
    category: other
    reason: "A key that exists only in a project .env.local works when the daemon is down but not when it is up. WR-08 aligned the picker and the daemon only. Resolve by passing homedir() as startDir in lookupApiKey (claude-default.ts) and lookupOpenAiKey (openai.ts), or document the difference."
    evidence_status: "none provided"
  - finding: "08-02 PLAN must_have artifact patterns are stale: src/providers/claude-default.ts no longer contains `sdk-rescue` or exports MIN_SDK_RESCUE_MS (gsd verify.artifacts 6/7 for 08-02)"
    category: other
    reason: "Commit 07738ca changed the composite to SDK-first when a key exists, which is what locked D-08 says. The behavior is covered by tests (claude-cli-provider: 'uses the SDK and does not spawn when ANTHROPIC_API_KEY is set (D-08)'). Only the 08-02 plan text is stale. Resolve by noting the supersession in 08-02-SUMMARY or leaving it as history."
    evidence_status: "none provided"
  - finding: "Review info items IN-01..IN-08 are still open (e.g. IN-07: auth failures on the API-key SDK path never get the `qq init provider` pointer; IN-05: an invalid header value for the OpenAI key is reported as 'could not reach api.openai.com'; IN-03: a chmod failure after rename prints 'No changes made' although the pin is live)"
    category: other
    reason: "Out of the fix scope (critical+warning) by design per 08-REVIEW-DISPOSITION.md. None blocks a must-have."
    evidence_status: "none provided"
human_verification:
  - test: "DECISION: accept or reject the roadmap/locked-decision divergence for ROADMAP SC #2 ('Ollama running locally gets a working qq with zero extra steps') and the OPENAI_API_KEY half of SC #3"
    expected: "Either add the suggested overrides (or amend ROADMAP.md SC #2/#3 and the Phase 8 goal line) to record that Ollama/OpenAI are one explicit `qq init provider` step by design (D-01, D-04, D-14), or reopen auto-detection as a gap"
    why_human: "The code deliberately does not meet the literal roadmap wording. The locked decisions in 08-CONTEXT.md say they supersede it, but no override or roadmap amendment records that acceptance. A verifier cannot accept a scope change on the developer's behalf."
  - test: "Live Claude /login: on macOS, with claude on PATH, logged in via `claude /login`, no ANTHROPIC_API_KEY, no provider.json, trigger ?? in zsh"
    expected: "Ranked candidates within 25s, no provider question, and the debug log shows `provider selected {provider: claude, source: default}`"
    why_human: "Needs the real Claude Code binary and Keychain auth. Tests replace the claude -p runner."
  - test: "Live Ollama pin (08-03 human-check): with `ollama list` showing a model, run `qq init provider`, press 3 then Enter, then trigger ?? in zsh"
    expected: "Candidates appear. The debug log shows `provider selected {provider: ollama, source: pin}` and an `ollama request` line with model/status/durationMs only."
    why_human: "Needs a running Ollama server and an interactive terminal"
  - test: "Live OpenAI pin (08-04 human-check): export OPENAI_API_KEY in ~/.zshrc before the queque source line, open a new terminal, run `qq init provider`, pick 2, then trigger ??"
    expected: "Candidates come from api.openai.com, and the debug log shows provider openai source pin. A bad key gives the static HTTP 401 copy with no key fragment."
    why_human: "Needs a real OPENAI_API_KEY and network access"
  - test: "Logged-out Claude hint (08-06 human-check): `claude /logout`, no ANTHROPIC_API_KEY, no provider.json, trigger ?? in zsh"
    expected: "One QueQue line above the prompt naming `claude /login`, ANTHROPIC_API_KEY, and `qq init provider`. The typed query is restored in the buffer. If the real logged-out stdout does not match AUTH_FAILURE_RE, the neutral WR-01 copy appears instead, without the picker hint."
    why_human: "The real `claude -p` logged-out output text is the input to AUTH_FAILURE_RE. Tests use fixture text."
  - test: "Picker restarts the real daemon (08-05 human-check): with a daemon running, run `pnpm build && node dist/cli/main.js init provider` with QQ_PROVIDER_FILE set to a scratch absolute path, press Enter"
    expected: "The Claude menu item is first, the pin file is -rw------- inside a 0700 directory, 'Restarted the QueQue daemon' is printed, and `lsof`/`ps` shows a new daemon pid with cwd = $HOME"
    why_human: "Unit tests use injected restartDaemon fakes and test sockets. The real IPC shutdown, spawn, and 2s poll need a live daemon."
  - test: "Under-60s end-to-end (08-05 human-check): claude logged out, no keys, Ollama running with one model. Trigger ?? (fails with the hint), run `qq init provider`, press 3, Enter, trigger ?? again"
    expected: "Wall time from the failed ?? to candidates on screen is under 60 seconds"
    why_human: "A wall-clock UX measurement across shell, picker, daemon restart, and model load"
  - test: "unverified-prohibition, human review recommended (08-06, judgment tier): 'MUST NOT document runtime auto-detection as the provider selector or describe a Claude to OpenAI to Ollama fallthrough'"
    expected: "Read docs/EXTENSIONS.md lines 16-45 and README.md lines 40-100 and confirm no auto-detection selector or vendor fallthrough is described"
    why_human: "Judgment-tier prohibition. The verifier's LLM judgment (non-authoritative) is that it holds: EXTENSIONS.md:23 says 'No fallthrough', EXTENSIONS.md:44 calls detectProvider() leftover preflight, and README.md:86 says 'QueQue never switches to a different provider on its own'."
---

# Phase 08: Zero-Config Install and Provider Detection Verification Report

**Phase Goal:** Make `qq` work on first run without any manual configuration. Detect Claude Code, Ollama, and OpenAI CLI auth in priority order and use the first available backend. When nothing is detected, guide the user to a working setup in under 60 seconds. The subprocess adapter is the right first implementation — token reuse and native API integration are later optimizations.
**Verified:** 2026-10-18T02:45:00Z
**Status:** human_needed
**Re-verification:** Yes. This follows gap-closure plans 08-03..08-06 and the post-review fixes (commits 1321da8..cfe36ab). The previous report (gaps_found, 10/15) is in git history.

## Roadmap Wording vs Locked Decisions (read first)

The ROADMAP goal and two of its success criteria still describe the original design: auto-detect in priority order and use the first backend found. The phase's locked decisions in 08-CONTEXT.md (D-01..D-15) replaced that on purpose:

| Roadmap text | Locked decision | What the code does | How this report scores it |
| --- | --- | --- | --- |
| Goal: "Detect Claude Code, Ollama, and OpenAI CLI auth in priority order and use the first available backend" | D-01/D-02: no runtime auto-selection. Use the pin, otherwise the Claude default. D-12: no cross-vendor fallthrough | `resolveProviderAdapter()` reads `provider.json` on every fetch. If there is no pin it uses Claude. Nothing probes Ollama or sniffs OPENAI_API_KEY on the `??` path | The amended truths are scored. The literal wording is **not met** and is flagged below |
| SC #2: "Ollama running locally gets a working `qq` with zero extra steps" | D-04/D-14: Ollama is opt-in. Ask once with `qq init provider`, then persist the pin | An Ollama user with no pin is sent to Claude. They need **one** `qq init provider` step | **? UNCERTAIN: human decision.** Literally FAILED, intentionally |
| SC #3: "`OPENAI_API_KEY` ... set gets the same" | D-04/D-14: OpenAI is opt-in through the pin | OPENAI_API_KEY alone does nothing. It needs one `qq init provider` step. (The ANTHROPIC_API_KEY half works with zero steps) | **? UNCERTAIN: human decision.** The OpenAI half is literally FAILED, intentionally |
| SC #5: "Detection runs in under 200 ms ... Ollama health check with a 300 ms timeout" | D-01/D-10: no detection on the fetch path | The selector is one sync `readFileSync` of the pin with no network call. `detectProvider()` is only re-exported from `src/providers/index.ts` and never called | ✓ VERIFIED. Holds trivially: the timed detection step no longer exists |
| Goal: "OpenAI CLI auth" | D-14: OpenAI adapter keyed by OPENAI_API_KEY | No OpenAI CLI support. Key only (env or `.env.local`) | Noted. Covered by the SC #3 decision item |
| ROADMAP line 25: "no manual setup required" for Claude Code, Ollama, or an OpenAI key | D-03: zero setup for **Claude** only | As above | Noted. Covered by the SC #2/#3 decision item |

08-CONTEXT.md `canonical_refs` states: "D-01–D-05 supersede 'detect every backend in priority order and use the first available' as the *selector*." That is a recorded developer decision. However, ROADMAP.md was never amended and this report has no `overrides:` entry, so the verifier does not quietly score SC #2/#3 as passed. If the developer **rejects** the deviation, both items become FAILED (BLOCKER) and the status is `gaps_found`.

**This looks intentional.** To accept the deviation, add this to the frontmatter of this file (or amend ROADMAP.md SC #2/#3 and the goal line):

```yaml
overrides:
  - must_have: "A developer with Ollama running locally gets a working qq with zero extra steps"
    reason: "Locked D-01/D-04/D-14: Ollama is an explicit provider.json pin chosen once via `qq init provider`; runtime auto-detection was rejected because it can steal requests (e.g. Ollama up while Claude is logged out)"
    accepted_by: "{name}"
    accepted_at: "{ISO timestamp}"
  - must_have: "A developer with OPENAI_API_KEY or ANTHROPIC_API_KEY set gets the same"
    reason: "Locked D-04/D-14: ANTHROPIC_API_KEY works with zero steps (Claude default, SDK-first per D-08); OPENAI_API_KEY is opt-in via one `qq init provider` pin, no key sniffing on the ?? path"
    accepted_by: "{name}"
    accepted_at: "{ISO timestamp}"
```

## Goal Achievement

Scored against the locked decisions: a Claude user gets zero-config `??`. Ollama and OpenAI work through one `qq init provider` pin, which is re-read on every fetch and fails closed when invalid. With no usable backend, `??` shows short, actionable copy that points at the picker. All of this exists, is wired through the daemon and the daemon-down fallback, and is exercised by passing tests (42 files, 962 tests, `--maxWorkers=1`; typecheck exit 0). What remains: one scope decision and live-environment checks.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | ROADMAP SC #1 / D-03: Claude Code installed and authenticated gives a working `qq` with zero extra steps | ✓ VERIFIED | `resolveProviderAdapter()` with an absent pin calls `resolveClaudeDefaultAdapter()` (provider-pin.ts:185-188). The composite is SDK-first when a key exists, otherwise `claude -p` (claude-default.ts:102-131). Tests: provider-pin "resolves the claude-cli composite when no pin exists (D-03)"; claude-cli-provider "returns the result text via parseCandidates without calling the SDK". Live run is in Human Verification |
| 2 | ROADMAP SC #2 (literal): Ollama running locally, zero extra steps | ? UNCERTAIN (scope decision) | Not met as worded: no pin means Claude. Met as amended (truth 9). See the divergence section |
| 3 | ROADMAP SC #3: OPENAI_API_KEY **or** ANTHROPIC_API_KEY gets the same | ? UNCERTAIN (scope decision) | ANTHROPIC half ✓: claude-cli-provider "uses the SDK and does not spawn when ANTHROPIC_API_KEY is set (D-08)" plus the `.env.local` cases. OPENAI half needs a pin (truth 10) |
| 4 | ROADMAP SC #4 / D-02 step 3: nothing usable gives a clear, short prompt, not a cryptic error | ✓ VERIFIED | `ENOENT_MESSAGE` / `D13_MESSAGE` name `claude /login`, ANTHROPIC_API_KEY, and `qq init provider` (claude-default.ts:16-20). daemon server.ts:180 forwards `error.message` verbatim as fetch-error. run-foreground `formatFifoError` writes `{kind:'error'}` |
| 5 | ROADMAP SC #5: detection < 200 ms, no blocking network | ✓ VERIFIED (divergent wording) | The runtime selector is a single sync file read. `grep detectProvider src` finds only the `index.ts` re-export. No Ollama probe on `??` |
| 6 | ROADMAP SC #6: the selected provider is logged | ✓ VERIFIED | `appendDebugLog('provider','provider selected',{provider,source})` for pin, default, and invalid (provider-pin.ts:186-198). Test: "logs provider and source only — never the pin file contents" |
| 7 | ROADMAP SC #7: macOS `/login` is detected as `claude-cli` without ANTHROPIC_API_KEY | ✓ VERIFIED | `detect.ts` darwin branch; provider-detect.test.ts (12 pass). The runtime does not depend on detection: it always validates `/login` at call time with `claude -p` (D-10) |
| 8 | Previous gaps #7/#12 (CR-01 stdin): `claude -p` cannot hang on an open stdin, and `--bare` is never passed | ✓ VERIFIED | `claude-exec.ts` is now `spawn`-based with `stdio: ['ignore','pipe','pipe']`. Unmocked test "ignores stdin so a child waiting for EOF exits without hanging" passes (604 ms). Since 09.1, the `claude -p` path (claude-process.ts:467-468) writes one stream-json line and then calls `stdin.end()`, so the child always sees EOF. claude-cli.ts:48 says never `--bare` |
| 9 | Previous gap #13 (amended): an Ollama pin plus a running Ollama returns candidates from POST `{baseUrl}/api/chat` through the daemon, with no Claude call and no per-`??` probing | ✓ VERIFIED | `ollamaAdapter` registered as `ollama` (registry/bootstrap.ts). Named test passes: daemon-fetch "pinned ollama answers fetch-candidates through the daemon" |
| 10 | Previous gap #14 (amended): an OpenAI pin plus a usable OPENAI_API_KEY returns candidates from api.openai.com through the daemon | ✓ VERIFIED | `openaiAdapter` registered as `openai`. Named tests pass: daemon-fetch "pinned openai answers fetch-candidates through the daemon" and "pinned openai model overrides the default" |
| 11 | Previous gap #15 (amended): `qq init provider` lists Claude, OpenAI, Ollama in that order on /dev/tty. Enter picks Claude. At most two answers write the pin | ✓ VERIFIED | `PROVIDER_MENU` order (init-provider.ts:29-41). Tests: "menu lists Claude, OpenAI, Ollama in that order", "Enter selects Claude and writes a 0600 pin", "Ollama lists models in /api/tags order and Enter picks the first" |
| 12 | D-02 order: pinned ollama/openai resolves only that backend. A claude pin or no pin resolves the claude-cli composite | ✓ VERIFIED | provider-pin.ts:182-209. Tests: "resolves only the ollama backend for an ollama pin", "resolves claude-cli for a claude pin" |
| 13 | An empty, malformed, schema-invalid, unreadable, or relative-path (WR-03) pin is a hard error naming the file and `qq init provider`, and never resolves to Claude | ✓ VERIFIED | `loadProviderPin()` returns `absent` only for ENOENT at an absolute path. Tests: "throws for an invalid pin and never touches the Claude default (fail closed)", "throws for an unreadable pin…", "a relative override throws instead of resolving the Claude default", "treats an empty QQ_PROVIDER_FILE as unset (WR-03)" |
| 14 | D-15: the pin is re-read on every fetch with no restart. An invalid pin inside the daemon becomes fetch-error and the daemon keeps answering | ✓ VERIFIED | server.ts:156-160 resolves inside the promise chain. Named tests pass: "pin change applies on the next fetch without restart", "invalid pin is a fetch-error and the daemon stays up", "re-reads the file on every call (D-15)" |
| 15 | Daemon-down fallback resolves the same pinned adapter (an Ollama or OpenAI pin is never sent to Claude in-process) | ✓ VERIFIED | fetch-client.ts:201 `resolveProviderAdapter()`. Named tests pass: "daemon-down fallback calls Ollama, not the Claude default" and the same for OpenAI |
| 16 | Ollama request is model + `stream:false` + system/user messages with filterContextEnvelope applied and no Authorization header. Failures map to one QueQue line naming `ollama serve` / `ollama pull` / `qq init provider`. WR-06 keeps the baseUrl path, and a URL 404 is reported as a URL 404 | ✓ VERIFIED | ollama.ts:142-257. Tests: "posts model, stream false…", "sends no authorization header", "keeps a .env changed file out of the request body", "maps a refused connection to the ollama serve hint", "maps HTTP 404 to the ollama pull hint", "keeps the path prefix of a proxied baseUrl (WR-06)" |
| 17 | OpenAI: Bearer key only to the constant `api.openai.com` URL (the strict pin schema has no baseUrl). Missing key fails before any network call. 401/403/404/429/other/timeout/network/refusal map to static copy with no upstream `error.message` | ✓ VERIFIED | openai.ts:25, 151-156, 85-110. 32 tests incl. "fails before any network call when no key is set anywhere", "maps HTTP 401 to a static key message without echoing the upstream text", "logs no key, prompt or upstream error text on a failure" |
| 18 | EXT-01: after `bootstrapBuiltins()` the provider backend ids include claude, claude-cli, ollama, openai, each with `fetchCandidates` | ✓ VERIFIED | registry/bootstrap.ts:48-71. Test: "registers the ollama and openai provider backends with adapter instances" |
| 19 | Picker safety: atomic `wx`-temp then rename at mode 0600 in a 0700 dir. Nothing goes to process.stdout. No /dev/tty gives exit 1 with one stderr line. OpenAI is pinned only when a key is present. An unreachable Ollama gives download/`ollama serve` guidance and the browser opens only on an explicit y. Zero models gives `ollama pull` guidance. Nothing is written on any dead end | ✓ VERIFIED | provider-pin.ts:153-175, init-provider.ts. Tests: "picker writes nothing to process.stdout", "without /dev/tty exits 1…", "OpenAI without a usable key exits 1 with export guidance", "Ollama unreachable … Enter does not open it", "with %s opens only the download URL", "Ollama with zero models prints ollama pull guidance" |
| 20 | After a saved pin the picker restarts the daemon (IPC shutdown first, lsof as backstop, WR-07). A failed restart keeps the pin, warns, and exits 0. D-15: a re-run shows the current pin and replaces it, keeping baseUrl and model (WR-02) | ✓ VERIFIED | init-provider.ts:270-283; daemon/bootstrap.ts:290. Tests: "restartDaemon is called once with socketPath()", "a failed restart keeps the pin, warns, and still exits 0", "restartDaemon stops a current daemon over IPC, without lsof (WR-07)", "keeps a saved Ollama baseUrl… (WR-02)". The real daemon restart is in Human Verification |
| 21 | D-05/D-03: only the literal `qq init provider` reaches the picker. `qq init zsh` is unchanged. The picker is never on the `??` widget, client, or daemon path | ✓ VERIFIED | `dispatchInit` (init-provider.ts:428-438). `grep init-provider src` finds only main.ts. Tests: "dispatchInit sends provider to the picker and zsh to initCommand", "Claude default source never references the picker", "does not probe any backend before the user answers (D-04)" |
| 22 | 08-06 / D-13 / WR-01: copy keeps `claude /login` first and appends `qq init provider`. Timeout copy stays a plain retry. A non-auth `claude -p` failure gets neutral copy, never "not authenticated" | ✓ VERIFIED | claude-default.ts:16-30, 78-93. Tests: "timeout copy stays a retry message", "does not call a non-auth claude -p failure 'not authenticated' (WR-01)" |
| 23 | Docs: EXTENSIONS.md and README document pin-or-Claude-default, provider.json examples, `qq init provider`, QQ_PROVIDER_FILE, OPENAI_API_KEY, Ollama, and what leaves the machine per provider | ✓ VERIFIED | EXTENSIONS.md:20-44, 71-74, 113-114; README.md:42, 78-100, 144-152 |
| 24 | Review CR-01: a pre-pin daemon (pong without `providerPin`) is replaced so provider.json is honored | ✓ VERIFIED | ipc.ts:52, server.ts:102, bootstrap.ts:107. Named test passes: "replaces a live daemon whose pong lacks providerPin (v0.6.0 flags only)" |
| 25 | Review WR-04/05/08 hardening: control bytes are stripped from non-Claude text and pin model names. Ollama/OpenAI prose never becomes a command. The daemon spawns with cwd = home | ✓ VERIFIED | `stripTerminalControls` + `finalCandidateListWithoutProse` in both adapters; `cwd: homedir()` (daemon/bootstrap.ts:271). Tests: "strips terminal control bytes … (WR-04)", "maps a normal-stop prose answer to unexpected response, not a command (WR-05)", "spawns the daemon in the home directory, whatever the caller cwd (WR-08)" |
| 26 | Phase gate: the full suite, typecheck, and `tests/claude-exec.test.ts` exit 0 | ✓ VERIFIED | `vitest run --maxWorkers=1`: 42 files / 962 tests passed, exit 0 (one run, no flakes). `pnpm typecheck` exit 0 |

**Score:** 24/26 truths verified (0 present-but-behavior-unverified; 2 pending a scope decision)

### Prohibitions (ADR-550)

| Plan | Prohibition | Tier | Disposition | Enforcement evidence |
| --- | --- | --- | --- | --- |
| 08-03 | No runtime probing; no pinned-Ollama to Claude fallthrough or the reverse | test | ✓ verified | claude-cli-provider "does not import detect.ts…(D-10)", "never spawns openai or fetches localhost:11434 (D-12)"; provider-resolver "resolveAdapter ignores a provider.json pin"; fallback tests; server/fetch-client have no cross-adapter path |
| 08-03 | An invalid or unreadable pin never sends the prompt to a hosted provider | test | ✓ verified | provider-pin fail-closed tests (truth 13) |
| 08-03 | No credential-file contents or Keychain reads | test | ✓ verified | detect.ts uses `stat`/`which` only; no readFile/security in pin, adapter, or picker modules |
| 08-03 | No auto-execute | test | ✓ verified | Candidates still reach the shell only through the FIFO `writeShellResult` (shell-contract, client-result suites pass) |
| 08-04 | OPENAI_API_KEY only to api.openai.com; never in pin, log, or error | test | ✓ verified | Constant URL; strict schema; openai log and 401 tests |
| 08-04 | No fallback from a failed OpenAI pin | test | ✓ verified | "daemon-down fallback calls OpenAI, not the Claude default"; no fallback code |
| 08-05 | Picker never attached to `qq init zsh`, `??`, client, or daemon | test | ✓ verified | truth 21 |
| 08-05 | Never prompt for, store, print, or log a key | test | ✓ verified | "OpenAI with a usable key writes an openai pin and never prints the key"; strict schema |
| 08-05 | No browser or spawn without an explicit y, fixed URL only | test | ✓ verified | "Enter does not open it", "opens only the download URL"; `openDownloadUrl` guard |
| 08-06 | No picker or provider question for a Claude user whose `??` succeeds | test | ✓ verified | "Claude default source never references the picker"; the hint exists only in failure copy |
| 08-06 | Docs must not describe auto-detection as the selector or a vendor fallthrough | judgment | ⚠️ flagged: unverified-prohibition, human review recommended | Non-authoritative LLM judgment: holds (EXTENSIONS.md:23, :44; README.md:86) |

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
| --- | --- | --- | --- |
| 1 | Daemon-down fallback reads `.env.local` keys from the client cwd; the daemon and picker read from home (WR-08 covered only those two) | other | new scope, no deterministic evidence |
| 2 | 08-02 PLAN artifact patterns (`sdk-rescue`, `MIN_SDK_RESCUE_MS`) are stale after SDK-first commit 07738ca (matches D-08) | other | plan text only; behavior tested |
| 3 | Review info items IN-01..IN-08 remain open by disposition | other | out of fix scope by design |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/providers/provider-pin.ts` | schema, path, loader, writer, `resolveProviderAdapter` | ✓ VERIFIED | Substantive (209 lines). Imported by server.ts, fetch-client.ts, ollama.ts, openai.ts, init-provider.ts |
| `src/providers/ollama.ts` | `/api/chat` adapter + `listOllamaModels` | ✓ VERIFIED | Registered; used by picker |
| `src/providers/openai.ts` | Chat Completions adapter | ✓ VERIFIED | Registered as `openai` |
| `src/cli/commands/init-provider.ts` | picker + `dispatchInit` | ✓ VERIFIED | Wired from main.ts `init <shell>` |
| `src/daemon/bootstrap.ts` | `restartDaemon`, providerPin capability check | ✓ VERIFIED | Used by picker and `ensureDaemon` |
| `src/registry/bootstrap.ts` | claude, claude-cli, ollama, openai registrations | ✓ VERIFIED | |
| `src/providers/claude-default.ts` | failure copy with `qq init provider` | ✓ VERIFIED | Message reaches the FIFO via server fetch-error, then `formatFifoError` |
| `src/providers/claude-exec.ts` | spawn-based exec honoring stdio | ✓ VERIFIED | Unmocked EOF test |
| `docs/EXTENSIONS.md`, `README.md` | shipped pin docs | ✓ VERIFIED | |
| tests: provider-pin / ollama-provider / openai-provider / init-provider | coverage | ✓ VERIFIED | 40 / 36 / 32 / 44 tests pass |

gsd `verify.artifacts`: 08-01 2/2, 08-03 5/5, 08-04 3/3, 08-05 5/5, 08-06 3/3, 08-02 6/7 (stale pattern, advisory #2).

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `src/daemon/server.ts` | `provider-pin.ts` | `resolveProviderAdapter()` inside the fetch promise chain | WIRED |
| `src/daemon/fetch-client.ts` | `provider-pin.ts` | transport-failure fallback | WIRED |
| `provider-pin.ts` | `registry/provider-backends.ts` | `getProviderAdapter(PIN_BACKEND_IDS[...])` | WIRED |
| `provider-pin.ts` | `resolver.ts` | absent or claude pin goes to `resolveClaudeDefaultAdapter` | WIRED |
| `registry/bootstrap.ts` | `ollama.ts` / `openai.ts` | `registerProviderBackend` | WIRED |
| `ollama.ts` / `openai.ts` | `claude.ts` | `buildPrompt`, `finalCandidateListWithoutProse`, `ensureSelectableCandidates` (+ `buildSystemPrompt` from steering, which supersedes the raw QUEQUE_SYSTEM since 09) | WIRED |
| `cli/main.ts` | `init-provider.ts` | `dispatchInit(shell)` | WIRED |
| `init-provider.ts` | `provider-pin.ts`, `ollama.ts`, `daemon/bootstrap.ts` | `writeProviderPin`/`loadProviderPin`, `listOllamaModels`, `restartDaemon` | WIRED |
| `claude-default.ts` | `daemon/server.ts` | thrown message becomes `fetch-error` verbatim (server.ts:180) | WIRED (confirmed by reading, beyond the pattern match) |
| `fetch-client.ts` | `run-foreground.ts` | rejection, then `formatFifoError`, then `writeShellResult({kind:'error'})` | WIRED |
| `daemon/bootstrap.ts` `ensureDaemon` | `server.ts` pong | `providerPin: true` required (CR-01) | WIRED |

gsd `verify.key-links`: 08-01 1/1, 08-02 6/6, 08-03 6/6, 08-04 4/4, 08-05 4/4, 08-06 2/2.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `ollamaAdapter` | `CandidateList` | `fetch(POST {baseUrl}/api/chat)` body `message.content`, then parse | Yes (pin model/baseUrl read from disk per call) | ✓ FLOWING |
| `openaiAdapter` | `CandidateList` | `fetch(POST api.openai.com…)` `choices[0].message.content` | Yes | ✓ FLOWING |
| `resolveProviderAdapter` | adapter | `readFileSync(providerPinPath())`, then zod | Yes, no cache | ✓ FLOWING |
| picker Ollama menu | `models` | `GET {baseUrl}/api/tags` | Yes, server order | ✓ FLOWING |
| FIFO error | `message` | adapter throw, then IPC fetch-error, then `formatFifoError` | Static actionable copy | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full suite (single run) | `pnpm exec vitest run --maxWorkers=1` | 42 files, 962 passed, exit 0 | ✓ PASS |
| Typecheck | `pnpm typecheck` | exit 0 | ✓ PASS |
| Key invariants by name | `vitest run … -t "invalid pin is a fetch-error\|pin change applies…\|lacks providerPin\|daemon-down fallback calls\|pinned ollama answers\|pinned openai answers\|throws for an invalid pin\|picker writes nothing…\|dispatchInit…\|does not probe…\|a failed restart keeps…\|Enter selects Claude…"` | 14 passed, 0 failed | ✓ PASS |
| CR-01 stdin isolation (unmocked) | `tests/claude-exec.test.ts` | "ignores stdin so a child waiting for EOF exits without hanging" passed | ✓ PASS |
| No detection on the hot path | `grep -rn detectProvider src` | only the `src/providers/index.ts` re-export | ✓ PASS |
| No "not wired yet" | `grep -rn "not wired yet" src` | no matches | ✓ PASS |
| Picker isolation | `grep -rn init-provider src` | only `src/cli/main.ts` | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED. The phase declares no `scripts/*/tests/probe-*.sh` probes.

### Requirements Coverage

Every plan (08-01..08-06) declares **RUN-01** and **EXT-01**. In REQUIREMENTS.md both are mapped to earlier phases (RUN-01: Phase 1, EXT-01: Phase 2, both Complete). No REQUIREMENTS.md ID maps to Phase 8, so there are no orphaned requirements.

| Requirement | Source Plans | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| RUN-01 | 08-01..08-06 | Background daemon keeps repeat invocations fast | ✓ SATISFIED | Every provider is served by the warm daemon (server.ts fetch-candidates). The pin is a sync read with no probing. CR-01 capability check replaces stale daemons. Daemon cwd is pinned to home (WR-08). The picker restarts the daemon so it inherits fresh env. 25s provider budgets stay under the 30s FIFO |
| EXT-01 | 08-01..08-06 | Internal registries incl. provider backends | ✓ SATISFIED | `registerProviderBackend` for `claude`, `claude-cli`, `ollama`, `openai`. The pin maps to registry ids through `PIN_BACKEND_IDS` |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `src/cli/main.ts` | 43, 47 | `XXXXXX` | ℹ️ Info | `mktemp` template in a comment, not a debt marker |
| `src/daemon/server.ts` | 44 | `TODO(CR-005)` | ℹ️ Info | Pre-existing (2026-05-15, a3b09a3), not added in Phase 8; references a tracked item |

No TBD/FIXME debt markers, stubs, empty handlers, or hardcoded-empty data in the Phase 8 files.

### Human Verification Required

#### 1. Scope decision: roadmap SC #2 and the OPENAI half of SC #3

**Test:** Decide whether "one explicit `qq init provider` step for Ollama/OpenAI" (D-01/D-04/D-14) replaces "zero extra steps".
**Expected:** Add the overrides above or amend ROADMAP.md, or reopen auto-detection as a gap.
**Why human:** A scope change cannot be accepted by the verifier.

#### 2. Live Claude `/login`

**Test:** macOS, `claude /login`, no key, no pin, trigger `??`.
**Expected:** Candidates within 25s, no provider question, and the debug log shows provider claude source default.
**Why human:** Needs the real Claude Code binary and Keychain auth.

#### 3. Live Ollama pin

**Test:** `qq init provider`, then 3, Enter, then `??`.
**Expected:** Candidates. The debug log shows provider ollama source pin.
**Why human:** Needs a running Ollama.

#### 4. Live OpenAI pin

**Test:** Export the key, open a new terminal, `qq init provider`, then 2, then `??`.
**Expected:** Candidates from OpenAI. A bad key gives the static 401 copy.
**Why human:** Needs a real key and network access.

#### 5. Logged-out Claude hint

**Test:** `claude /logout`, no key, no pin, trigger `??`.
**Expected:** One QueQue line naming `claude /login`, ANTHROPIC_API_KEY, and `qq init provider`. The buffer is restored.
**Why human:** Real logged-out output must match AUTH_FAILURE_RE, otherwise the neutral WR-01 copy shows instead.

#### 6. Picker restarts the real daemon

**Test:** Built CLI, scratch absolute QQ_PROVIDER_FILE, press Enter.
**Expected:** Pin file is 0600, restart message printed, new daemon pid with cwd `$HOME`.
**Why human:** Unit tests use injected fakes.

#### 7. Under-60s end-to-end

**Test:** Failed `??`, then `qq init provider` (Ollama), then `??`.
**Expected:** Under 60 seconds wall time.
**Why human:** A wall-clock UX measurement.

#### 8. Judgment-tier prohibition (08-06 docs)

**Test:** Read EXTENSIONS.md and README provider sections.
**Expected:** No auto-detection selector and no vendor fallthrough described.
**Why human:** Judgment tier. The verifier's verdict (holds) is non-authoritative.

### Gaps Summary

There are no code gaps. All five gaps from the previous report are closed in the codebase:

- CR-01 stdin: spawn-based exec, plus a stream-json prompt followed by `stdin.end()`.
- Ollama pin: works through the daemon.
- OpenAI pin: works through the daemon.
- Picker and failure copy: `qq init provider` exists and the failure copy points at it.

The post-review fixes CR-01 (providerPin pong flag) and WR-01..WR-08 are each present with regression tests. Full suite: 962/962. Typecheck: clean.

The phase is **not** marked `passed` for two reasons:
1. **Roadmap/decision divergence.** The ROADMAP goal ("detect … in priority order and use the first available backend") and SC #2/#3 ("zero extra steps" for Ollama and OPENAI_API_KEY) are deliberately not implemented as worded. Locked D-01/D-04/D-14 replaced them with a Claude silent default plus a one-time `qq init provider` pin, with no cross-vendor fallback. The code faithfully implements the locked decisions. The roadmap was never amended and there is no override, so the developer must record the acceptance (or reject it, in which case SC #2/#3 become BLOCKERS).
2. **Live-environment checks** (real Claude `/login`, Ollama, OpenAI, logged-out hint, real daemon restart, under-60s end-to-end) cannot be automated here.

---

_Verified: 2026-10-18T02:45:00Z_
_Verifier: Claude (gsd-verifier)_
