---
phase: 08-zero-config-install-and-provider-detection
verified: 2026-10-19T07:55:00Z
status: human_needed
score: 28/28 must-haves verified
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
  - src/client/run-foreground.ts
  - src/contracts/ipc.ts
  - src/daemon/bootstrap.ts
  - src/daemon/fetch-client.ts
  - src/daemon/server.ts
  - src/providers/claude-cli.ts
  - src/providers/claude-default.ts
  - src/providers/claude-exec.ts
  - src/providers/claude.ts
  - src/providers/detect.ts
  - src/providers/ollama.ts
  - src/providers/openai.ts
  - src/providers/provider-pin.ts
  - src/providers/provider.ts
  - src/providers/resolver.ts
  - src/providers/structured-output.ts
  - src/registry/bootstrap.ts
  - src/shared/env-file.ts
  - src/shared/qq-config.ts
covered_digest: "v3:sha256:5f2b093f119af626944a59117e01a46520d4bcc09f8e47a2dd06540fbac8f4a8"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 24/26
  gaps_closed:
    - "ROADMAP SC #2 (Ollama): roadmap amended 2026-10-19 (e120905) to 'working qq after one `qq init provider` step'; the code meets the amended wording"
    - "ROADMAP SC #3 (OPENAI_API_KEY half): roadmap amended to 'one `qq init provider` step'; the code meets the amended wording"
    - "Prior advisory #1 (daemon-down fallback read .env.local from the client cwd): closed by WR-10 (d6c876e); readEnvValueFromDotEnvLocal now defaults startDir to homedir()"
    - "Prior advisory #3 (review info items IN-01..IN-08 open): fixed in review iteration 2 (8e05356..ccddce5, plus IN-09..IN-14)"
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "08-02 PLAN must_have artifact patterns are stale: src/providers/claude-default.ts no longer contains `sdk-rescue` or exports MIN_SDK_RESCUE_MS (gsd verify.artifacts 6/7 for 08-02)"
    category: other
    reason: "Carried from the prior report. Commit 07738ca made the composite SDK-first when a key exists, as locked D-08 says. The behavior is tested (claude-cli-provider 'uses the SDK and does not spawn when ANTHROPIC_API_KEY is set (D-08)'). Only the 08-02 plan text is stale. Resolve by noting the supersession in 08-02-SUMMARY, or leave it as history."
    evidence_status: "none provided"
  - finding: "The OpenAI request shape changed after the last live check (quick task 261018-wax: strict json_schema response_format with a { candidates } root, max_completion_tokens 16000, reasoning_effort low with a none/minimal/omit fallback ladder). Every test uses a fetch double, so real API acceptance of this body is unproven"
    category: other
    reason: "Covered by the one open human item (live OpenAI pin, UAT test 4). Not a code gap: the 400-for-reasoning_effort fallback and the static 400 copy for response_format are tested."
    evidence_status: "none provided"
human_verification:
  - test: "Live OpenAI pin (UAT test 4, blocked on a third-party key): export a real OPENAI_API_KEY in ~/.zshrc before the queque source line, open a new terminal, run `qq init provider`, pick 2 (OpenAI (beta)), then trigger ?? in zsh. Repeat once with a deliberately wrong key"
    expected: "Candidates come from api.openai.com. The debug log shows `provider selected {provider: openai, source: pin}` and `openai request` lines with model/status/durationMs only. With the current request shape (strict json_schema `{ candidates }`, max_completion_tokens, reasoning_effort low) the first request returns HTTP 200, or at most one logged `openai reasoning_effort rejected` resend, not a 400 for response_format. A bad key gives the static HTTP 401 copy with no key fragment"
    why_human: "Needs a real OPENAI_API_KEY and network access. Every automated test replaces fetch, so whether the real Chat Completions endpoint accepts the post-261018-wax body for the default model gpt-5.5 cannot be observed here"
---

# Phase 08: Zero-Config Install and Provider Detection Verification Report

**Phase Goal (amended 2026-10-19, e120905):** Make `qq` work on first run without any manual configuration for Claude users. Claude (Claude Code `/login` or `ANTHROPIC_API_KEY`) is the zero-step default. Ollama and OpenAI take one explicit `qq init provider` pin and are never auto-detected (locked D-01, D-04, D-14). When nothing is detected, guide the user to a working setup in under 60 seconds. The subprocess adapter is the right first implementation.
**Verified:** 2026-10-19T07:55:00Z
**Status:** human_needed
**Re-verification:** Yes. The previous report (human_needed, 24/26, 2026-10-18T02:45Z) was stale. Since its base commit e60c878, 16 source/doc files changed (+1661/-277 lines). Those changes come from review iteration 2 (WR-09..WR-12, IN-01..IN-14) and quick task 261018-wax (strict schema plus one cut-off retry for Ollama and OpenAI, beta labels). Every changed file was re-read and its tests re-run.

## Goal Achievement

The ROADMAP goal and SC #2/#3 now match locked decisions D-01/D-04/D-14, so the scope divergence the previous report flagged is gone and needs no override. The code still does what the amended contract says:

- With no pin, a Claude user gets `??` with no setup.
- Ollama and OpenAI each take one `qq init provider` pin, re-read on every fetch, and an invalid pin fails closed.
- No backend is ever probed or sniffed on the `??` path.
- With no usable backend, `??` prints short copy that points at the picker.

UAT already passed the live Claude `/login`, live Ollama, logged-out hint, real daemon restart, under-60s end-to-end, and the judgment-tier docs prohibition. The one open item is the live OpenAI pin, which is blocked on a real key.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | ROADMAP SC #1 / D-03: Claude Code installed and authenticated gives a working `qq` with zero extra steps | ✓ VERIFIED | `resolveProviderAdapter()` with an absent pin logs `{provider:'claude',source:'default'}` and returns `resolveClaudeDefaultAdapter()` (provider-pin.ts:201-207). Unchanged since the last report. claude-cli-provider (48 tests) passes. Live run passed in UAT test 2 |
| 2 | ROADMAP SC #2 (amended): Ollama running locally gives a working `qq` after one `qq init provider` step | ✓ VERIFIED | Picker item 3 "Ollama (beta)" lists models from `/api/tags` and writes the pin (init-provider.ts). `ollamaAdapter` registered as `ollama` (registry/bootstrap.ts). Named test passes: daemon-fetch "pinned ollama answers fetch-candidates through the daemon". Live pin passed in UAT test 3 |
| 3 | ROADMAP SC #3 (amended): ANTHROPIC_API_KEY gives zero extra steps. OPENAI_API_KEY gives a working `qq` after one `qq init provider` step | ✓ VERIFIED | ANTHROPIC half: claude-default.ts SDK-first branch, test "uses the SDK and does not spawn when ANTHROPIC_API_KEY is set (D-08)". OPENAI half: picker item 2 pins OpenAI only when a key is usable from env or `~/.env.local`, and "pinned openai answers fetch-candidates through the daemon" passes. The live OpenAI call is the one open human item |
| 4 | ROADMAP SC #4 / D-02 step 3: nothing usable gives a clear, short prompt, not a cryptic error | ✓ VERIFIED | `ENOENT_MESSAGE` / `D13_MESSAGE` name `claude /login`, ANTHROPIC_API_KEY (now `~/.env.local`), and `qq init provider` (claude-default.ts:16-20). The logged-out hint passed in UAT test 5 |
| 5 | ROADMAP SC #5: detection under 200 ms, with no blocking network call | ✓ VERIFIED | The selector is one sync `readFileSync` of the pin. `grep -rn detectProvider src` finds only the `src/providers/index.ts` re-export. Nothing probes on `??` |
| 6 | ROADMAP SC #6: the selected provider is logged | ✓ VERIFIED | `appendDebugLog('provider','provider selected',{provider,source})` for pin, default and invalid (provider-pin.ts:204-212). Confirmed in UAT tests 2 and 3 |
| 7 | ROADMAP SC #7: macOS `/login` is detected as `claude-cli` without ANTHROPIC_API_KEY | ✓ VERIFIED | detect.ts darwin branch (only comment text changed). provider-detect tests pass |
| 8 | CR-01 stdin: `claude -p` cannot hang on an open stdin, and `--bare` is never passed | ✓ VERIFIED | tests/claude-exec.test.ts (2 tests, unmocked EOF case) passes |
| 9 | An Ollama pin with a running Ollama returns candidates from POST `{baseUrl}/api/chat` through the daemon, with no Claude call and no probe per `??` | ✓ VERIFIED | ollama.ts:166-275. daemon-fetch named test passes |
| 10 | An OpenAI pin with a usable OPENAI_API_KEY returns candidates from api.openai.com through the daemon | ✓ VERIFIED | openai.ts:194-367. daemon-fetch "pinned openai answers…" passes (fetch double). The live endpoint is in Human Verification |
| 11 | `qq init provider` lists Claude, OpenAI, Ollama in that order. Enter picks Claude. At most two answers write the pin | ✓ VERIFIED | `PROVIDER_MENU` order is unchanged. Labels are now "OpenAI (beta)" and "Ollama (beta)", padded to `MENU_LABEL_WIDTH`. init-provider tests (45) pass, incl. "menu labels OpenAI and Ollama as beta with the hints in one column" |
| 12 | D-02 order: an ollama/openai pin resolves only that backend. A claude pin or no pin resolves the claude-cli composite | ✓ VERIFIED | provider-pin.ts resolver is unchanged. provider-pin tests (46) pass |
| 13 | An empty, malformed, schema-invalid, unreadable or relative-path pin is a hard error naming the file and `qq init provider`, and never resolves to Claude | ✓ VERIFIED | Unchanged path. Hardened: IN-02 caps and sanitizes unknown key names (`MAX_ISSUE_REASON` 120). IN-10 rejects control bytes and credentials in `baseUrl`. Tests pass |
| 14 | D-15: the pin is re-read on every fetch with no restart. An invalid pin in the daemon becomes a fetch-error and the daemon stays up | ✓ VERIFIED | server.ts:159 (unchanged). Named tests "pin change applies on the next fetch without restart" and "invalid pin is a fetch-error and the daemon stays up" pass |
| 15 | The daemon-down fallback resolves the same pinned adapter | ✓ VERIFIED | fetch-client.ts:201 (unchanged). "daemon-down fallback calls OpenAI, not the Claude default" passes, and so does the Ollama twin |
| 16 | Ollama request: no Authorization header, privacy-filtered prompts. Failures map to one QueQue line naming `ollama serve` / `ollama pull` / `qq init provider`. The baseUrl path is kept | ✓ VERIFIED | ollama.ts:181-191, 206-235. Tests "sends no authorization header", "maps a refused connection to the ollama serve hint", "maps HTTP 404 to the ollama pull hint", and the WR-06 404 cases pass. IN-11: `ollamaApiUrl` builds the URL from its parts and drops any query or fragment |
| 17 | OpenAI: the Bearer key goes only to the constant `api.openai.com` URL. A missing key fails before any network call. Error copy is static and never echoes `error.message` | ✓ VERIFIED | `OPENAI_CHAT_COMPLETIONS_URL` constant (openai.ts:30). `readSafeErrorFields` reads only `code`/`param`. IN-05 rejects a header-unsafe key with its own copy. Tests: 401/403/404/429 static copy, "never leaks the upstream message of a rejected effort into an error" |
| 18 | EXT-01: the registry holds claude, claude-cli, ollama, openai, each with `fetchCandidates` | ✓ VERIFIED | Four `registerProviderBackend` calls (registry/bootstrap.ts:47-65). registry-bootstrap tests pass |
| 19 | Picker safety: atomic 0600 write in a 0700 dir. No stdout. No /dev/tty gives exit 1. OpenAI is pinned only with a key. The browser opens only on an explicit y. Nothing is written on a dead end | ✓ VERIFIED | IN-03: `chmodSync(temp)` now runs before `renameSync` (provider-pin.ts:183-184). IN-09: a saved remote `baseUrl` that is down gets remote advice, not the download URL. init-provider tests pass. A real 0600 file was confirmed in UAT test 6 |
| 20 | After a saved pin the picker restarts the daemon. A failed restart keeps the pin and exits 0. A re-run keeps baseUrl and model | ✓ VERIFIED | Tests pass. The real restart (new pid, cwd `$HOME`) passed in UAT test 6. WR-12: `daemonCwd()` falls back to `/` when HOME is missing, and a spawn `error` listener keeps a failed spawn from cancelling `??` (daemon-bootstrap tests pass) |
| 21 | Only the literal `qq init provider` reaches the picker. The picker is never on the `??`/client/daemon path | ✓ VERIFIED | `grep -rln init-provider src` finds only src/cli/main.ts |
| 22 | 08-06 / D-13 / WR-01: the copy keeps `claude /login` first and appends `qq init provider`. Timeout copy stays a retry. A non-auth `claude -p` failure gets neutral copy | ✓ VERIFIED | claude-default.ts:16-38. New IN-07 behavior: an SDK 401/403 maps to static key copy with the picker hint, and an AbortError passes through unmapped (`sdkError`, claude-default.ts:107-119) |
| 23 | EXTENSIONS.md and README document pin-or-Claude-default, provider.json, `qq init provider`, QQ_PROVIDER_FILE, OPENAI_API_KEY, Ollama, and what leaves the machine per provider | ✓ VERIFIED | The docs diff adds beta labels, `~/.env.local` wording, the structured-output/retry paragraph (EXTENSIONS.md:42), a remote `http://` baseUrl warning (README.md:152) and per-provider streaming notes. "No fallthrough" is kept (EXTENSIONS.md:23) |
| 24 | CR-01: a pre-pin daemon (pong without `providerPin`) is replaced | ✓ VERIFIED | Named test "replaces a live daemon whose pong lacks providerPin (v0.6.0 flags only)" passes (daemon-bootstrap.test.ts:180) |
| 25 | WR-04/05/08 hardening: control bytes are stripped. Ollama/OpenAI prose never becomes a command. The daemon runs with cwd = home | ✓ VERIFIED | `stripTerminalControls` + `ensureSelectableCandidates` in both adapters. WR-05 tests pass. IN-12/IN-13: Claude rows are sanitized too, and an answer that is all control bytes becomes "unexpected response" |
| 26 | Phase gate: the full suite and typecheck exit 0 | ✓ VERIFIED | Regression gate (caller-run): 43 files / 1039 tests passed. This verifier ran the 13 Phase 8 test files (346 tests passed) and `pnpm typecheck` (exit 0) |
| 27 | Quick task 261018-wax: a cut-off Ollama/OpenAI reply is retried once, silently, on the same signal (one 25s budget). A second cut-off shows the "cut off" line. A fragment never becomes a command. A user abort always wins | ✓ VERIFIED | `candidatesWithCutOffRetry` (structured-output.ts:78-101) is wired into ollama.ts:257-263 and openai.ts:341-355. Behavioral tests pass: structured-output (a)-(h), incl. "(c) retries a cut-off turn exactly once", "(f) rethrows a user abort during the retry", "(h) treats an array inside unclosed thinking as cut off, never the draft"; openai "retries a cut-off answer once at the lowest effort on the same signal", "shows cut off when the retry is cut off too, never a fragment"; ollama "never turns a cut-off answer into a prose command (done_reason length)" |
| 28 | Quick task 261018-wax: the structured request matches the candidate contract and the token ceiling is shared | ✓ VERIFIED | `CANDIDATE_LIST_JSON_SCHEMA` (1-5 items, `command` minLength 1, `additionalProperties:false`) has a parity test against the zod contract. `MAX_OUTPUT_TOKENS = SDK_MAX_TOKENS` (16_000, claude.ts:37). Ollama sends `think:false`, `format`, `num_predict`/`num_ctx`. OpenAI sends a strict `json_schema` with a `{candidates}` root, `max_completion_tokens`, and `reasoning_effort` low with the fallback ladder ("resends without reasoning_effort when the model rejects it, and remembers", "walks none, minimal, then no effort…") |

**Score:** 28/28 truths verified (0 present but behavior-unverified)

### Prohibitions (ADR-550)

| Plan | Prohibition | Tier | Disposition | Enforcement evidence |
| --- | --- | --- | --- | --- |
| 08-03 | No runtime probing. No pinned-Ollama to Claude fallthrough, or the reverse | test | ✓ verified | No `detectProvider` call site on the hot path. The fallback tests pass. The new cut-off retry re-posts to the **same** adapter only (`postChat` closure) |
| 08-03 | An invalid or unreadable pin never sends the prompt to a hosted provider | test | ✓ verified | provider-pin fail-closed tests |
| 08-03 | No credential-file contents or Keychain reads | test | ✓ verified | detect.ts uses `stat`/`which` only (unchanged) |
| 08-03 | No auto-execute | test | ✓ verified | Candidates still go only to the FIFO `writeShellResult` |
| 08-04 | OPENAI_API_KEY goes only to api.openai.com, never into a pin, log or error | test | ✓ verified | Constant URL. The strict pin schema has no baseUrl. The log carries model/status/durationMs/effort only. IN-05 copy never echoes the value |
| 08-04 | No fallback from a failed OpenAI pin | test | ✓ verified | "daemon-down fallback calls OpenAI, not the Claude default" |
| 08-05 | The picker is never attached to `qq init zsh`, `??`, the client or the daemon | test | ✓ verified | truth 21 |
| 08-05 | Never prompt for, store, print or log a key | test | ✓ verified | `openAiKeyPresent()` checks presence only |
| 08-05 | No browser or spawn without an explicit y, fixed URL only | test | ✓ verified | `OLLAMA_DOWNLOAD_URL` guard. With a saved remote baseUrl, IN-09 offers no download at all |
| 08-06 | No picker or provider question for a Claude user whose `??` succeeds | test | ✓ verified | The hint exists only in failure copy |
| 08-06 | Docs must not describe auto-detection as the selector or a vendor fallthrough | judgment | ✓ resolved by human (UAT test 8, pass) | UAT ran after the 261018-wax docs commit. I re-checked: the new EXTENSIONS.md:42 paragraph describes a same-provider retry only. EXTENSIONS.md:23 "No fallthrough" and README "never switches to a different provider on its own" are kept |

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
| --- | --- | --- | --- |
| 1 | 08-02 PLAN artifact patterns (`sdk-rescue`, `MIN_SDK_RESCUE_MS`) are stale after SDK-first commit 07738ca (matches D-08) | other | Plan text only. The behavior is tested |
| 2 | The OpenAI request body changed (strict json_schema, reasoning_effort ladder) after any possible live check. Real-endpoint acceptance is unproven | other | Folded into the one human item. No deterministic failure evidence |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/providers/provider-pin.ts` | schema, path, loader, writer, `resolveProviderAdapter` | ✓ VERIFIED | Imported by server.ts, fetch-client.ts, ollama.ts, openai.ts, init-provider.ts |
| `src/providers/ollama.ts` | `/api/chat` adapter + `listOllamaModels` | ✓ VERIFIED | Registered. Uses structured-output |
| `src/providers/openai.ts` | Chat Completions adapter | ✓ VERIFIED | Registered as `openai`. Uses structured-output |
| `src/providers/structured-output.ts` (new, 261018-wax) | shared schema, token cap, cut-off retry | ✓ VERIFIED | 101 lines. Imported by both non-Claude adapters |
| `src/cli/commands/init-provider.ts` | picker + `dispatchInit` | ✓ VERIFIED | Wired from main.ts |
| `src/daemon/bootstrap.ts` | `restartDaemon`, providerPin check, `daemonCwd` | ✓ VERIFIED | |
| `src/registry/bootstrap.ts` | four provider registrations | ✓ VERIFIED | |
| `src/providers/claude-default.ts` | failure copy with `qq init provider`, SDK 401/403 mapping | ✓ VERIFIED | |
| `src/shared/env-file.ts` | home-rooted `.env.local` lookup | ✓ VERIFIED | `startDir = homedir()` (WR-10) |
| `docs/EXTENSIONS.md`, `README.md` | shipped pin docs, beta labels | ✓ VERIFIED | |

gsd `verify.artifacts`: 08-01 2/2, 08-02 6/7 (stale pattern, advisory #1), 08-03 5/5, 08-04 3/3, 08-05 5/5, 08-06 3/3.

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `src/daemon/server.ts` | `provider-pin.ts` | `resolveProviderAdapter()` at server.ts:159 | WIRED |
| `src/daemon/fetch-client.ts` | `provider-pin.ts` | daemon-down fallback at fetch-client.ts:201 | WIRED |
| `provider-pin.ts` | `registry/provider-backends.ts` / `resolver.ts` | pin to backend id, absent pin to Claude default | WIRED |
| `registry/bootstrap.ts` | `ollama.ts` / `openai.ts` | `registerProviderBackend` | WIRED |
| `ollama.ts` / `openai.ts` | `structured-output.ts` | `candidatesWithCutOffRetry`, `MAX_OUTPUT_TOKENS`, schemas | WIRED |
| `structured-output.ts` | `claude.ts` | `finalCandidateListWithoutProse`, `strictCandidateListWithoutProse`, `SDK_MAX_TOKENS` | WIRED |
| `cli/main.ts` | `init-provider.ts` | `dispatchInit(shell)` | WIRED |
| `init-provider.ts` | `provider-pin.ts`, `ollama.ts`, `daemon/bootstrap.ts` | pin read/write, `listOllamaModels`, `restartDaemon` | WIRED |
| `claude-default.ts` | `daemon/server.ts` → `run-foreground.ts` | thrown copy becomes fetch-error, then `formatFifoError` | WIRED |

gsd `verify.key-links`: 08-01 1/1, 08-02 6/6, 08-03 6/6, 08-04 4/4, 08-05 4/4, 08-06 2/2.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `ollamaAdapter` | `CandidateList` | `fetch(POST {baseUrl}/api/chat)` `message.content`, then the strict parse, then the retry rule | Yes (pin read per call) | ✓ FLOWING |
| `openaiAdapter` | `CandidateList` | `fetch(POST api.openai.com…)` `choices[0].message.content`, then `{candidates}` or a bare array | Yes | ✓ FLOWING |
| `resolveProviderAdapter` | adapter | `readFileSync(providerPinPath())`, then zod | Yes, not cached | ✓ FLOWING |
| picker Ollama menu | `models` | `GET {baseUrl}/api/tags` | Yes, in server order | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase 8 provider/picker/daemon suites | `vitest run` provider-pin, ollama-provider, openai-provider, structured-output, init-provider, daemon-fetch, claude-cli-provider, claude-exec | 8 files, 293 passed | ✓ PASS |
| Resolver/detect/registry/bootstrap/env | `vitest run` provider-resolver, provider-detect, registry-bootstrap, daemon-bootstrap, env-file | 5 files, 53 passed | ✓ PASS |
| Cut-off retry and safety cases by name | `vitest run … -t "cut off\|retry\|never becomes\|authorization\|fallback\|prose"` | all listed cases pass (truths 27-28) | ✓ PASS |
| Typecheck | `pnpm typecheck` | exit 0 | ✓ PASS |
| Full suite | regression gate (caller, `CI=true npm test`) | 43 files, 1039 passed | ✓ PASS (not re-run, per the once-per-verification rule) |
| No detection on the hot path | `grep -rn detectProvider src` | only the index.ts re-export | ✓ PASS |
| Picker isolation | `grep -rln init-provider src` | only src/cli/main.ts | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED. The phase declares no `scripts/*/tests/probe-*.sh` probes.

### Requirements Coverage

All six plans declare **RUN-01** and **EXT-01**. REQUIREMENTS.md maps both to earlier phases (RUN-01: Phase 1, EXT-01: Phase 2, both Complete), and no REQUIREMENTS.md ID maps to Phase 8, so no requirement is orphaned.

| Requirement | Source Plans | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| RUN-01 | 08-01..08-06 | A background daemon keeps repeat invocations fast | ✓ SATISFIED | Every provider is served by the warm daemon. The pin is a sync read with no probing. The CR-01 capability check replaces stale daemons. WR-12 keeps `??` working (in-process fallback) when the daemon cannot spawn. The cut-off retry stays within the single 25s budget, under the 30s FIFO |
| EXT-01 | 08-01..08-06 | Internal registries incl. provider backends | ✓ SATISFIED | `registerProviderBackend` for `claude`, `claude-cli`, `ollama`, `openai`. Pin to registry ids through `PIN_BACKEND_IDS` |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (none) | | | | `grep TBD\|FIXME\|XXX` and `TODO\|HACK\|PLACEHOLDER\|not yet implemented` over the 12 changed source files and both docs found nothing. The `XXXXXX` mktemp comment in main.ts and the pre-existing `TODO(CR-005)` in server.ts were noted before and are unchanged |

### Human Verification Required

#### 1. Live OpenAI pin (UAT test 4, blocked on a third-party key)

**Test:** Export a real `OPENAI_API_KEY` in `~/.zshrc` above the queque source line, open a new terminal, run `qq init provider`, pick 2 (OpenAI (beta)), then trigger `??`. Repeat once with a deliberately wrong key.
**Expected:** Candidates from api.openai.com. The debug log shows `provider selected {provider: openai, source: pin}` and `openai request` lines with model/status/durationMs only. The post-261018-wax body (strict `json_schema` with a `{ candidates }` root, `max_completion_tokens`, `reasoning_effort` low) gets HTTP 200 for `gpt-5.5`, or at most one logged `openai reasoning_effort rejected` resend, never a 400 for `response_format`. A bad key gives the static HTTP 401 copy with no key fragment.
**Why human:** Needs a real key and network access. All tests replace fetch.

UAT already passed items 2, 3, 5, 6, 7 and 8 from the previous list, and the scope decision (item 1) was resolved by the roadmap amendment, so none of them is repeated here.

### Gaps Summary

There are no code gaps and no blockers.

- The scope divergence from the previous report is resolved. ROADMAP.md was amended on 2026-10-19 (e120905), and SC #2/#3 now say "one `qq init provider` step". The code meets that wording, so no override is needed.
- Every file changed since the last report was re-read. That covers review iteration 2 (WR-09..WR-12, IN-01..IN-14) and quick task 261018-wax. The earlier invariants still hold:
  - constant OpenAI host
  - no `error.message` echo
  - no vendor fallthrough (the new retry is same-adapter)
  - fail-closed pin
  - the picker stays off the `??` path
- The two new behaviors (cut-off retry, structured request) each have passing behavioral tests.
- Two of the three prior advisories are closed (WR-10 and the IN items). One stale plan-text advisory remains.

Status is `human_needed` only because the live OpenAI pin (UAT test 4) cannot run without a real key. This check also matters more now, because quick task 261018-wax changed the OpenAI request body after any earlier live check.

---

_Verified: 2026-10-19T07:55:00Z_
_Verifier: Claude (gsd-verifier)_
