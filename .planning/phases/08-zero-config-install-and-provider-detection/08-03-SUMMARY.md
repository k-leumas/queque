---
phase: 08-zero-config-install-and-provider-detection
plan: 03
subsystem: providers
tags: [provider-pin, ollama, zod, daemon, ipc, fail-closed]

requires:
  - phase: 08-zero-config-install-and-provider-detection
    provides: "08-02 claude-cli composite (resolveClaudeDefaultAdapter) as the Claude silent default"
  - phase: 09-installed-tool-awareness
    provides: "buildSystemPrompt(envelope) steering contract enforced by tests/steering.test.ts"
  - phase: 09.1-provider-latency-and-cancellation
    provides: "FetchOptions { signal, onCandidate } and the abort chain"
provides:
  - "~/.config/qq/provider.json pin: versioned strict union, no secrets, QQ_PROVIDER_FILE override"
  - "src/providers/provider-pin.ts: providerPinSchema, loadProviderPin (per-call read), resolveProviderAdapter (D-02 selector), PIN_BACKEND_IDS, OLLAMA_DEFAULT_BASE_URL"
  - "src/providers/ollama.ts: /api/chat adapter with mapped failure copy, OLLAMA_TIMEOUT_MS=25s"
  - "registry backend id `ollama` (EXT-01)"
  - "daemon fetch-candidates and the daemon-down in-process fallback both resolve through the pin"
affects: [08-04 openai adapter (registers `openai`, PIN_BACKEND_IDS already maps it), 08-05 qq init provider picker (writes providerPinSchema), 08-06 failure hint + docs]

actuals:
  tokens: 13300
  tasks: 3
  commits: 3
plan_head_before: 2777470de5b7410f155c5c8d59134de79bedae6e
plan_head_after: 315327f30a989897560c0718b2d3c02689dafa3d

tech-stack:
  added: []
  patterns:
    - "Runtime provider selection = pin read on every fetch; invalid pin throws inside the daemon promise chain (fetch-error), never defaults to Claude"
    - "Pinned backends map every failure to one QueQue line naming the fix; no cross-provider fallthrough"
    - "Unit tests stub global fetch with vi.stubGlobal + new Response(...) (no fake HTTP server or binary)"

key-files:
  created:
    - src/providers/provider-pin.ts
    - src/providers/ollama.ts
    - tests/provider-pin.test.ts
    - tests/ollama-provider.test.ts
  modified:
    - src/registry/bootstrap.ts
    - src/daemon/server.ts
    - src/daemon/fetch-client.ts
    - tests/daemon-fetch.test.ts
    - tests/client-result.test.ts

key-decisions:
  - "provider.json shape: versioned-union (user-selected at dispatch) — versioned discriminated union, strict, no secrets"
  - "A claude pin resolves through resolveClaudeDefaultAdapter() (same claude-cli object as PIN_BACKEND_IDS.claude) so tests that mock the resolver cover both absent and claude-pinned paths"
  - "Ollama final list goes through finalCandidateList with done_reason === 'stop' as the only normal stop (allow list), so a cut-off fragment never reaches the prose fallback"

patterns-established:
  - "Provider pin as the only selector: resolveProviderAdapter() is called per fetch in server.ts and fetch-client.ts"

requirements-completed: [RUN-01, EXT-01]

coverage:
  - id: D1
    description: "Pinned Ollama answers fetch-candidates through the real daemon socket (POST {baseUrl}/api/chat, stream false, no auth header, Claude not called)"
    requirement: RUN-01
    verification:
      - kind: integration
        ref: "tests/daemon-fetch.test.ts#pinned ollama answers fetch-candidates through the daemon"
        status: pass
    human_judgment: false
  - id: D2
    description: "Invalid provider.json is a fetch-error naming the file and qq init provider; the daemon keeps answering ping"
    requirement: RUN-01
    verification:
      - kind: integration
        ref: "tests/daemon-fetch.test.ts#invalid pin is a fetch-error and the daemon stays up"
        status: pass
      - kind: unit
        ref: "tests/provider-pin.test.ts#throws for an invalid pin and never touches the Claude default (fail closed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Pin edits apply on the next fetch without a daemon restart (D-15)"
    requirement: RUN-01
    verification:
      - kind: integration
        ref: "tests/daemon-fetch.test.ts#pin change applies on the next fetch without restart"
        status: pass
      - kind: unit
        ref: "tests/provider-pin.test.ts#re-reads the file on every call, so a pin edit applies at once (D-15)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Schema: absent/valid/invalid/unreadable cases; extra apiKey key is invalid; non-http(s) baseUrl is invalid"
    requirement: EXT-01
    verification:
      - kind: unit
        ref: "tests/provider-pin.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Ollama failure mapping (unreachable, 404, timeout, HTTP 5xx, unexpected body, cut-off) with no Claude SDK, execFileAsync or runClaudeTurn call"
    requirement: RUN-01
    verification:
      - kind: unit
        ref: "tests/ollama-provider.test.ts#Ollama failure mapping (no Claude fallback)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Daemon-down fallback resolves the pinned adapter (Ollama pin never sent to Claude in-process)"
    requirement: RUN-01
    verification:
      - kind: unit
        ref: "tests/ollama-provider.test.ts#daemon-down fallback calls Ollama, not the Claude default"
        status: pass
    human_judgment: false
  - id: D7
    description: "`ollama` registered as a provider backend in bootstrapBuiltins()"
    requirement: EXT-01
    verification:
      - kind: unit
        ref: "tests/provider-pin.test.ts#resolves only the ollama backend for an ollama pin"
        status: pass
    human_judgment: false
  - id: D8
    description: "Live Ollama end-to-end: real pin + pulled model, ?? in zsh shows candidates; stopping Ollama prints the ollama serve line with the buffer unchanged"
    verification: []
    human_judgment: true
    rationale: "Needs a running Ollama server and an interactive zsh; plan marks it end-of-phase UAT, not blocking"

duration: 22min
completed: 2026-10-17
status: complete
---

# Phase 8 Plan 03: Provider Pin and Ollama Adapter Summary

**`~/.config/qq/provider.json` (versioned, strict, no secrets) is now read on every `??` fetch. A pinned Ollama answers through the warm daemon via POST /api/chat. With no pin, Claude stays the silent default. A broken pin fails closed and never reaches Claude.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-10-17T17:40:00Z
- **Completed:** 2026-10-17T18:02:10Z
- **Tasks:** 3 (Task 1 decided by the user at dispatch, Tasks 2 and 3 executed)
- **Files modified:** 9 (4 created, 5 modified)

## Accomplishments

- `resolveProviderAdapter()` is the only runtime selector (D-02). Without a pin it returns the Claude default. A claude pin resolves to `claude-cli`, an ollama pin resolves to `ollama`, and an invalid or unreadable pin throws `QueQue: <path> is not a valid provider pin (<reason>). Fix the file or run \`qq init provider\`.` It does no probing and has no fallthrough (D-01, D-12).
- The daemon `fetch-candidates` handler and the `fetchCandidatesForUi` IPC-transport fallback both resolve through the pin. An invalid pin becomes a `fetch-error` reply, and the daemon keeps running.
- The Ollama adapter sends the model, `stream: false`, `buildSystemPrompt(envelope)` and `buildPrompt(envelope)`. The `.env` filter applies and no Authorization header is sent. Failures map to single lines: "not reachable … `ollama serve`", "model 'm' is not installed … `ollama pull m`", "did not answer within 25s … Try ?? again", "HTTP 500: boom", and "unexpected response". A user abort is rethrown unmapped.
- Debug log: `provider selected` logs `{provider, source}` only, and `ollama request` logs `{model, status, durationMs}` only (ROADMAP SC #6).

## Task Commits

1. **Task 1: provider.json shape decision**: resolved by the user before dispatch (versioned-union). No commit.
2. **Task 2: Tracer — pinned Ollama answers ?? through the warm daemon**: `cd220e9` (feat)
3. **Task 3: Ollama failure UX, pin-honoring fallback, unit coverage (TDD)**
   - RED: `837a4dd` (test)
   - GREEN: `315327f` (feat)
   - REFACTOR: none needed

## Files Created/Modified

- `src/providers/provider-pin.ts`: pin schema, path, loader that reads the file on every call, backend-id map, and the D-02 resolver
- `src/providers/ollama.ts`: `/api/chat` adapter, failure mapping, 25s timeout combined with the caller's abort signal
- `src/registry/bootstrap.ts`: registers the `ollama` backend ("Ollama (local)")
- `src/daemon/server.ts`: `fetch-candidates` resolves `resolveProviderAdapter()` inside the existing `Promise.resolve().then` chain
- `src/daemon/fetch-client.ts`: the daemon-down fallback resolves `resolveProviderAdapter()`; doc comment updated
- `tests/provider-pin.test.ts` (new, 32 tests): schema, loader, resolver, fail-closed, D-15 re-read, log content
- `tests/ollama-provider.test.ts` (new, 24 tests): request shape, privacy, failure mapping, no Claude fallback, debug-log payloads, daemon-down fallback
- `tests/daemon-fetch.test.ts`: per-test temp `QQ_PROVIDER_FILE`, plus 3 e2e pin tests
- `tests/client-result.test.ts`: mocks `provider-pin.js` (its `node:fs` mock has no `readFileSync`), adds an invalid-pin error-result test, and the "adapter cannot be resolved" test now makes both resolvers throw

## Decisions Made

- **Task 1 provider.json schema: versioned-union (user-selected at dispatch).** The pin is a versioned discriminated union of strict objects with no secrets. `{"version":1,"provider":"claude"}`, `{"version":1,"provider":"openai","model"?}`, `{"version":1,"provider":"ollama","model","baseUrl"?(http/https)}`. An extra key such as `apiKey` makes the pin invalid. OpenAI has no `baseUrl` field, so an OpenAI key cannot be redirected to another host. 08-04 and 08-05 proceed as planned; no replanning is needed.
- A claude pin resolves through `resolveClaudeDefaultAdapter()`. That is the same registry object as `getProviderAdapter(PIN_BACKEND_IDS.claude)`, and it lets resolver-mocking tests cover both the absent and the claude-pinned paths.
- The invalid-pin message lists only zod issue paths and unknown key names (for example `unknown key apiKey`). File values never appear in it, and tests check this.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Ollama final list uses finalCandidateList, not bare parseCandidates**
- **Found during:** Task 3
- **Issue:** The plan named `ensureSelectableCandidates(parseCandidates(content))`. With that, a response cut off by Ollama (`done_reason: "length"`) would reach parseCandidates' prose fallback and become a command in the shell buffer. This is exactly the failure that cerebrum Do-Not-Repeat WR-01-r2 / T-09.1-14 forbids.
- **Fix:** `finalCandidateList(content, [], done_reason === 'stop', {model})`. `stop` is the only value treated as a normal stop. If the answer is cut off, the candidates that are already complete are kept. If none are complete, the error is `QueQue: Ollama response was cut off before a full command. Try ?? again, or run \`qq init provider\` to pick another model.`
- **Files modified:** src/providers/ollama.ts, tests/ollama-provider.test.ts
- **Committed in:** 837a4dd (RED), 315327f (GREEN)

**2. [Rule 3 - Blocking] Phase 9 / 09.1 drift from the plan text**
- **Found during:** Task 2
- **Issue:** The plan predates 09.1. `LLMAdapter.fetchCandidates` now takes `FetchOptions {signal, onCandidate}`, and server.ts already used a `Promise.resolve()` chain. The plan's cross-phase note requires `buildSystemPrompt(envelope)`, not the raw system constant (enforced by the steering.test.ts `adapters` checks).
- **Fix:** The Ollama adapter combines the caller's `signal` with `AbortSignal.timeout(25s)` through `AbortSignal.any`, rethrows a user abort as QueQue's AbortError (it is not mapped to the timeout message), and never calls `onCandidate` because the response is not streamed. server.ts only swapped the resolver call inside the existing chain.
- **Files modified:** src/providers/ollama.ts, src/daemon/server.ts
- **Committed in:** cd220e9, 315327f

**3. [Rule 3 - Blocking] "No Claude fallback" assertions target the current Claude entry points**
- **Found during:** Task 3
- **Issue:** The claude-cli adapter no longer uses `execFileAsync`. Since 09.1 it runs `runClaudeTurn` from claude-process.ts, so asserting only on `execFileAsync` would prove nothing.
- **Fix:** tests/ollama-provider.test.ts mocks and asserts not-called on the Anthropic SDK (create and stream), `claude-exec.js` `execFileAsync` (as the plan asked), and `claude-process.js` `runClaudeTurn`. `ANTHROPIC_API_KEY` is stubbed so that any silent Claude fallback would hit the SDK mock.
- **Committed in:** 837a4dd

**4. [Rule 1 - Test isolation] Tests pin QQ_CONFIG_FILE and QQ_FORCE_SELECTOR**
- **Found during:** Task 2
- **Issue:** The real Ollama adapter runs `buildPrompt` (which reads `~/.config/qq/config.json`) and `ensureSelectableCandidates`. The latter reads `QQ_FORCE_SELECTOR` from `.env.local`, which is looked up from the directory upward, so a worktree run would pick up the main checkout's `.env.local`.
- **Fix:** The daemon-fetch and ollama tests stub `QQ_CONFIG_FILE` to a temp path and set `QQ_FORCE_SELECTOR=0`.
- **Committed in:** cd220e9, 837a4dd

**Process note:** The plan said to commit Task 3's tests and implementation together. Because Task 2 already created the modules, a RED commit type-checks, so Task 3 followed the RED → GREEN TDD contract instead (837a4dd → 315327f). The plan's concern (a test-only commit failing `tsc`) did not apply.

---

**Total deviations:** 4 auto-fixed (1 Rule 1, 1 Rule 2, 2 Rule 3)
**Impact on plan:** All were needed for correctness or for compatibility with code that changed after the plan was written. No scope creep, and the public exports match the plan's artifact list.

## TDD Gate Compliance (Task 3)

- **RED** `837a4dd`: target `tests/ollama-provider.test.ts > Ollama failure mapping (no Claude fallback) > maps a refused connection to the ollama serve hint`, run with `--reporter=tap-flat -t`, exit 1. Classifier verdict: `RED_EVIDENCE_OK` (target_test_failed). Semantic assessment: the target ran and failed on the planned assertion (`expected 'QueQue: Ollama request failed' to contain 'not reachable'`), because the tracer's generic error had no mapping. It was not a load, import or fixture fault. 15 planned-behavior tests failed in RED. The provider-pin tests passed in RED because the loader and resolver were tracer (Task 2) scope.
- **GREEN** `315327f`: all 139 tests in the verify set plus steering pass.
- **REFACTOR:** not needed.

## Issues Encountered

- `node_modules` was missing in the fresh worktree. I ran `pnpm install --frozen-lockfile --prefer-offline` (lockfile only, no new packages, no tracked-file changes).
- Full suite: 848/851 pass. The 3 failures are in `tests/command-words-fuzz.test.ts`, which has 1-second child-process timing budgets. They come from load and existed before this plan: the baseline run before any change had 39 failures in command-words-fuzz and zsh-widget. Both files pass 92/92 when run alone. This is out of scope and not caused by this plan.

## Verification

- `pnpm exec vitest run tests/provider-pin.test.ts tests/ollama-provider.test.ts tests/daemon-fetch.test.ts tests/client-result.test.ts tests/claude-exec.test.ts tests/steering.test.ts`: 6 files, 139 tests passed
- `pnpm typecheck`: 0 errors
- `pnpm exec biome check` on all changed files: clean
- Acceptance greps (resolveProviderAdapter in server.ts and fetch-client.ts, QQ_PROVIDER_FILE, /api/chat, `adapter: ollamaAdapter`, ollama serve / ollama pull, provider-pin.js in client-result): all pass
- CR-01 remains closed: `tests/claude-exec.test.ts` passes

## Deferred Human Check (end-of-phase UAT, not blocking)

Task 2's `<human-check>` and the plan's manual verification need a live Ollama:
1. With `ollama list` showing a model, write `{"version":1,"provider":"ollama","model":"<model>"}` to `~/.config/qq/provider.json`, run `pnpm build`, and trigger `??` in zsh. Candidates should appear, and `/tmp/qq-$UID-debug.log` should have `provider selected {"provider":"ollama","source":"pin"}`.
2. Stop Ollama and trigger `??` again. It should print the `ollama serve` line, and the buffer should stay unchanged.

## Threat Flags

None. The new surface (the provider.json read and the outbound HTTP call to the user-chosen Ollama baseUrl) is covered by T-08-08..T-08-12 in the plan's threat model, and every mitigation has a test.

## OpenWolf entries (deferred)

The orchestrator applies these; nothing under `.wolf/` was committed from the worktree.

**anatomy.md**
- `## src/providers/`: `provider-pin.ts`: provider.json pin. `providerPinSchema` (versioned strict union: claude, openai{model?}, ollama{model, baseUrl? http/https}; extra keys such as apiKey are invalid). `providerPinPath()` (QQ_PROVIDER_FILE override). `loadProviderPin()` reads the file on every call (absent/pinned/invalid). `resolveProviderAdapter()` is the D-02 runtime selector (no pin → Claude default; invalid → throws naming `qq init provider`). `PIN_BACKEND_IDS`, `OLLAMA_DEFAULT_BASE_URL`. (~1300 tok)
- `## src/providers/`: `ollama.ts`: Ollama POST /api/chat adapter (stream false, buildSystemPrompt + buildPrompt, no auth header). 25s timeout combined with the abort signal. Failures map to one QueQue line (ollama serve / ollama pull / HTTP status / unexpected / cut-off). finalCandidateList with done_reason 'stop'. Registered as backend `ollama`. (~1800 tok)
- `## tests/`: `provider-pin.test.ts`: schema/loader/resolver coverage including the apiKey-extra invalid case, EISDIR unreadable, fail-closed invalid pin, and the D-15 per-call re-read. (~2000 tok)
- `## tests/`: `ollama-provider.test.ts`: Ollama request shape, privacy (.env filtered, no auth), failure mapping, no Claude fallback (SDK, execFileAsync and runClaudeTurn not called), debug-log payloads, daemon-down fallback through fetchCandidatesForUi. Stubs global fetch. (~4300 tok)
- Update `tests/daemon-fetch.test.ts`: now also has the provider pin (08-03) e2e tests (pinned ollama through the daemon, invalid pin keeps the daemon up, pin edits apply live), with a temp QQ_PROVIDER_FILE per test.
- Update `src/daemon/server.ts` / `src/daemon/fetch-client.ts`: both resolve `resolveProviderAdapter()` (pin) instead of `resolveClaudeDefaultAdapter()`.

**cerebrum.md, Key Learnings**
- [2026-10-17] 08-03: `resolveProviderAdapter()` (provider-pin.ts) is the runtime selector in both server.ts and fetch-client.ts. Tests that mock `providers/resolver.js` still cover the absent and claude-pinned paths, because a claude pin resolves through `resolveClaudeDefaultAdapter()`. Daemon or adapter tests need a temp `QQ_PROVIDER_FILE` so the developer's real `~/.config/qq/provider.json` cannot leak in.
- [2026-10-17] Tests that run a real adapter's `ensureSelectableCandidates` must stub `QQ_FORCE_SELECTOR=0`. Otherwise `.env.local` is looked up from the directory upward, and a worktree under `.claude/worktrees/` picks up the main checkout's `.env.local`.
- [2026-10-17] Since 09.1 the claude-cli path runs `runClaudeTurn` (claude-process.ts), not `execFileAsync`. "No Claude fallback" tests must assert on the SDK mock and on `runClaudeTurn`.
- [2026-10-17] A fresh GSD worktree has no `node_modules`. Run `pnpm install --frozen-lockfile --prefer-offline` before verifying; it changes no tracked file.

**buglog.json**
- bug: `tests/ollama-provider.test.ts` TS2339 `Property 'message' does not exist on type 'Error | CandidateList'`. Root cause: `.catch((caught) => caught as Error)` on a `Promise<CandidateList>` produces a union type. Fix: catch as `unknown`, assert `toBeInstanceOf(Error)`, then cast at the use site. Tags: typescript, vitest, test.

## Self-Check: PASSED

- FOUND: src/providers/provider-pin.ts, src/providers/ollama.ts, tests/provider-pin.test.ts, tests/ollama-provider.test.ts
- FOUND commits: cd220e9, 837a4dd, 315327f (all ancestors of HEAD)
