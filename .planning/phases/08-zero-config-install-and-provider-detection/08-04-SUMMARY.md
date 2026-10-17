---
phase: 08-zero-config-install-and-provider-detection
plan: 04
subsystem: providers
tags: [openai, provider-pin, daemon, fail-closed, privacy]

requires:
  - phase: 08-zero-config-install-and-provider-detection
    provides: "08-03 provider.json pin (versioned strict union, openai has no baseUrl), resolveProviderAdapter, PIN_BACKEND_IDS.openai = 'openai', ollama.ts reference adapter"
  - phase: 09-installed-tool-awareness
    provides: "buildSystemPrompt(envelope) steering contract (tests/steering.test.ts adapters check)"
  - phase: 09.1-provider-latency-and-cancellation
    provides: "FetchOptions { signal, onCandidate } and the abort chain"
provides:
  - "src/providers/openai.ts: OpenAI Chat Completions adapter selected only by a provider.json pin"
  - "registry backend id `openai` (EXT-01)"
  - "OPENAI_API_KEY consumed from env, then .env.local (empty string = missing)"
affects: [08-05 qq init provider picker (can now pin openai end to end), 08-06 failure hint + docs]

actuals:
  tokens: 8400
  tasks: 2
  commits: 3
plan_head_before: 99433e35b2b1e7985647ccfe5d07bfbb63e7c3f5
plan_head_after: 537a0423d660b07e7625d0216cbf3ef5cc649435

tech-stack:
  added: []
  patterns:
    - "Hosted pinned backend: request URL is a module constant, never derived from the pin or env, so a pin cannot redirect the key"
    - "Upstream error bodies are reduced to status + a regex-allow-listed error.code; error.message is never read"

key-files:
  created:
    - src/providers/openai.ts
    - tests/openai-provider.test.ts
  modified:
    - src/registry/bootstrap.ts
    - tests/daemon-fetch.test.ts
    - tests/registry-bootstrap.test.ts

key-decisions:
  - "OPENAI_DEFAULT_MODEL = 'gpt-5.5', confirmed against Context7 /websites/developers_openai_api on 2026-10-17: listed as a current (non-deprecated) Chat Completions model, used by the official TypeScript reference example, and the changelog recommends it for production API usage. Newer ids (gpt-6-astra, gpt-5.6-terra) exist; users can override with \"model\" in provider.json"
  - "OpenAI final list goes through finalCandidateList with finish_reason === 'stop' as the only normal stop (allow list, mirrors 08-03), so a length/content_filter cut-off never reaches the prose fallback"
  - "The developer message is buildSystemPrompt(envelope), not raw QUEQUE_SYSTEM (Phase 9 cross-phase note, D-18)"

patterns-established:
  - "Pinned hosted adapter = constant endpoint + usableSecret key lookup + static per-status copy + safe-code allow list"

requirements-completed: [EXT-01, RUN-01]

coverage:
  - id: D1
    description: "Pinned OpenAI answers fetch-candidates through the real daemon socket (POST api.openai.com/v1/chat/completions, Bearer key, developer+user messages, no temperature, Claude not called)"
    requirement: RUN-01
    verification:
      - kind: integration
        ref: "tests/daemon-fetch.test.ts#pinned openai answers fetch-candidates through the daemon"
        status: pass
      - kind: integration
        ref: "tests/daemon-fetch.test.ts#pinned openai model overrides the default"
        status: pass
    human_judgment: false
  - id: D2
    description: "`openai` registered beside claude, claude-cli and ollama, each with fetchCandidates"
    requirement: EXT-01
    verification:
      - kind: unit
        ref: "tests/registry-bootstrap.test.ts#registers the ollama and openai provider backends with adapter instances"
        status: pass
    human_judgment: false
  - id: D3
    description: "Key handling: whitespace-only env falls through to .env.local; missing everywhere fails before fetch naming OPENAI_API_KEY and qq init provider"
    requirement: RUN-01
    verification:
      - kind: unit
        ref: "tests/openai-provider.test.ts#OpenAI key handling"
        status: pass
    human_judgment: false
  - id: D4
    description: "Request carries exactly model + messages; buildSystemPrompt/buildPrompt content; .env changed file filtered"
    requirement: RUN-01
    verification:
      - kind: unit
        ref: "tests/openai-provider.test.ts#OpenAI request shape and privacy"
        status: pass
    human_judgment: false
  - id: D5
    description: "401/403/404/429/other, unsafe code, non-JSON error, timeout (25s and a real hung request), network, refusal, malformed 2xx, cut-off and user abort each map to static copy; no Claude SDK, execFileAsync, runClaudeTurn or localhost:11434 call"
    requirement: RUN-01
    verification:
      - kind: unit
        ref: "tests/openai-provider.test.ts#OpenAI failure mapping (no Claude or Ollama fallback)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Debug log carries model/status/durationMs only; no key, Bearer, authorization, prompt, response or upstream error text"
    requirement: RUN-01
    verification:
      - kind: unit
        ref: "tests/openai-provider.test.ts#OpenAI debug log"
        status: pass
    human_judgment: false
  - id: D7
    description: "Daemon-down in-process fallback resolves the OpenAI pin (never the Claude default)"
    requirement: RUN-01
    verification:
      - kind: unit
        ref: "tests/openai-provider.test.ts#daemon-down fallback calls OpenAI, not the Claude default"
        status: pass
    human_judgment: false
  - id: D8
    description: "Live OpenAI end-to-end: real key + openai pin, ?? in zsh shows candidates; unset key + daemon restart prints the OPENAI_API_KEY line with the buffer unchanged"
    verification: []
    human_judgment: true
    rationale: "Needs a real OPENAI_API_KEY and an interactive zsh; the plan marks it end-of-phase UAT (tracer human-check), not blocking"

duration: 35min
completed: 2026-10-17
status: complete
---

# Phase 8 Plan 04: OpenAI Adapter Summary

**When provider.json pins OpenAI, `??` gets its candidates from POST https://api.openai.com/v1/chat/completions through the warm daemon, using `OPENAI_API_KEY` from the environment or `.env.local`. Every failure prints one fixed QueQue line. The key and the upstream error text never appear in errors or logs, and QueQue never falls back to Claude or Ollama.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-10-17T18:10:00Z
- **Completed:** 2026-10-17T18:46:00Z
- **Tasks:** 2 (Task 1 tracer, Task 2 TDD)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- `fetchOpenAiCandidates(envelope, { model }, timeoutMs = 25_000, options)` sends `{ model, messages: [developer: buildSystemPrompt(envelope), user: buildPrompt(envelope)] }` with `authorization: Bearer <key>`. The request has no temperature, top_p, max_tokens, max_completion_tokens, stream, tools or response_format field. The caller's abort signal is combined with `AbortSignal.timeout`.
- `openaiAdapter` reads the pin on every call. Only an OpenAI pin runs it; any other pin gets "OpenAI is not the pinned provider". The adapter imports no Claude or Ollama adapter.
- Failure copy (static; it uses only the status, the pinned model name and an `error.code` matching `/^[a-z0-9_]{1,64}$/`):
  - 401: "rejected OPENAI_API_KEY (HTTP 401)"
  - 403: "refused the request (HTTP 403) … project access"
  - 404: "model '<m>' is not available to this key (HTTP 404). Set "model" in ~/.config/qq/provider.json"
  - 429: "rate limit or quota reached (HTTP 429)"
  - other statuses: "request failed (HTTP n[, code c])"
  - timeout: "did not answer within 25s"
  - network: "could not reach api.openai.com"
  - refusal: "declined this query"
  - malformed body: "unexpected response"
  - cut-off answer: "cut off before a full command"
- If the key is missing, the adapter throws before any fetch. The message names `OPENAI_API_KEY` and `qq init provider` (the picker restarts the daemon, which is the only way the daemon sees a newly exported key).
- Debug log: `openai request` with `{ model, status, durationMs }` only.

## Task Commits

1. **Task 1: Tracer, pinned OpenAI answers ?? through the warm daemon:** `dfdf79b` (feat)
2. **Task 2: Key handling, failure copy, no-fallback, log hygiene (TDD)**
   - RED: `5ddc0b6` (test)
   - GREEN: `537a042` (feat)
   - REFACTOR: none needed

## Files Created/Modified

- `src/providers/openai.ts` (new): constants `OPENAI_CHAT_COMPLETIONS_URL`, `OPENAI_DEFAULT_MODEL`, `OPENAI_TIMEOUT_MS`; `fetchOpenAiCandidates`; `openaiAdapter`; status and rejection mapping
- `src/registry/bootstrap.ts`: registers backend `openai` ("OpenAI")
- `tests/openai-provider.test.ts` (new, 29 tests): key handling, request shape and privacy, failure mapping with no fallback, debug-log hygiene, pin resolution, daemon-down fallback
- `tests/daemon-fetch.test.ts`: `provider pin: openai (08-04)` block with the two e2e tests
- `tests/registry-bootstrap.test.ts`: ollama and openai backend registration test

## Decisions Made

- **OPENAI_DEFAULT_MODEL = `gpt-5.5`.** This is the flagged-assumption check. Context7 `/websites/developers_openai_api` (queried 2026-10-17) lists `gpt-5.5` and `gpt-5.5-2026-04-23` as current model ids, not deprecated. The official TypeScript Chat Completions example uses `gpt-5.5`, and the 2026-05-05 changelog says "We recommend leveraging GPT-5.5 for production API usage". Newer ids also appear in the docs: `gpt-6-astra`, and `gpt-5.6-terra` as a lower-cost option. If command-suggestion latency or cost matters, a future plan could switch the default to `gpt-5.6-terra`; for now users set `"model"` in provider.json.
- `finish_reason === 'stop'` is the only normal stop. `length`, `content_filter`, `null` and any future value fail closed through `finalCandidateList`, which follows cerebrum Do-Not-Repeat WR-01-r2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] OpenAI final list uses finalCandidateList, not bare parseCandidates**
- **Found during:** Task 1
- **Issue:** The plan named `ensureSelectableCandidates(parseCandidates(content))`. With that, an answer cut off by `max_output`/`length` or `content_filter` would reach the prose fallback in parseCandidates and could become a command in the shell buffer (WR-01-r2 / T-09.1-14).
- **Fix:** `finalCandidateList(content, [], finish_reason === 'stop', { model })`. If the answer is cut off and has no complete candidate, the error is "QueQue: OpenAI response was cut off before a full command…". This matches 08-03's Ollama adapter.
- **Files modified:** src/providers/openai.ts, tests/openai-provider.test.ts
- **Commit:** dfdf79b, 5ddc0b6

**2. [Rule 3 - Blocking] Phase 9 / 09.1 drift from the plan text**
- **Found during:** Task 1
- **Issue:** The plan's body text names `QUEQUE_SYSTEM` as the developer content and predates `FetchOptions`.
- **Fix:** The developer content is `buildSystemPrompt(envelope)`, as the plan's cross-phase note requires and `tests/steering.test.ts` enforces. The adapter forwards `options` and combines `signal` with the timeout. A user abort is rethrown as QueQue's AbortError, not mapped to the timeout message. `onCandidate` is never called because the response is not streamed.
- **Commit:** dfdf79b, 537a042

**3. [Rule 2 - Robustness] Model name is flattened to one line in the 404 copy**
- **Found during:** Task 2
- **Issue:** The pin schema trims `model` but allows inner whitespace, and the FIFO error is a single shell line.
- **Fix:** `oneLine(model)` collapses whitespace in the 404 message.
- **Commit:** 537a042

**Process note:** The plan said to commit Task 2's tests and implementation together. Task 1 had already created `openai.ts` with every export, so a RED commit passes typecheck. Task 2 therefore followed the RED → GREEN TDD contract as 08-03 did (5ddc0b6 → 537a042).

**Total deviations:** 3 auto-fixed (2 Rule 2, 1 Rule 3). No scope creep. The public exports match the plan's artifact list; `OpenAiSettings` is an extra type export.

## TDD Gate Compliance (Task 2)

- **RED** `5ddc0b6`. Target: `tests/openai-provider.test.ts > OpenAI failure mapping (no Claude or Ollama fallback) > maps HTTP 429 to the rate limit or quota message`, run with `--reporter=tap-flat -t`, exit 1. Classifier verdict: `RED_EVIDENCE_OK` (target_test_failed). Semantic assessment: the target ran and failed on the planned assertion (`expected 'QueQue: OpenAI request failed.' to match /HTTP 429/`) because the tracer's generic error had no status mapping. There was no load, import or fixture fault. In the full RED run, 17 planned-behavior tests failed. Key handling, request shape, cut-off, abort and log tests passed in RED because they were tracer (Task 1) scope.
- **GREEN** `537a042`: `tests/openai-provider.test.ts`, `daemon-fetch`, `registry-bootstrap`, `provider-pin`, `steering` and `ollama-provider` all pass: 6 files, 151 tests.
- **REFACTOR:** not needed.

## Issues Encountered

- A fresh worktree has no `node_modules`, so I ran `pnpm install --frozen-lockfile --prefer-offline`. It changed no tracked file.
- The machine load average was about 312. The first multi-file vitest run hit `[vitest-pool]: Timeout starting forks runner` before any test ran. With `--maxWorkers=1` all 151 tests pass.
- Full suite (`vitest run --maxWorkers=2`): 873/883 pass. The 10 failures are timing budgets: `command-words-fuzz` (1s child-process spawn budget; still fails alone at this load), `zsh-widget` handoff median (passes alone, 56/56) and `client-result` llm-mode (passes alone, 26/26). None of them import provider code from this plan. 08-03 recorded the same load flakes before its changes. Out of scope.

## Verification

- `pnpm exec vitest run tests/openai-provider.test.ts tests/daemon-fetch.test.ts tests/registry-bootstrap.test.ts tests/provider-pin.test.ts tests/steering.test.ts tests/ollama-provider.test.ts --maxWorkers=1`: 6 files, 151 tests passed
- `pnpm typecheck`: 0 errors
- `pnpm exec biome check` on all changed files: clean
- Acceptance greps: `api.openai.com/v1/chat/completions`, `usableSecret`, `rate limit or quota` and `declined this query` in openai.ts; `adapter: openaiAdapter` in bootstrap.ts; the test titles are present. All pass.

## Deferred Human Check (end-of-phase UAT, not blocking)

Task 1's tracer `<human-check>`. Tracer gate: the automated verify passed again before Task 2, and human_verify_mode is end-of-phase.
1. Export `OPENAI_API_KEY` in `~/.zshrc` before the queque source line and open a new terminal. Write `{"version":1,"provider":"openai"}` to `~/.config/qq/provider.json`, restart the daemon (`qq init provider` from 08-05, or stop it and run `qq daemon --ensure`), then trigger `??`. Candidates should appear, and the debug log should show `provider selected {"provider":"openai","source":"pin"}` and an `openai request` line.
2. Unset the key, restart the daemon and trigger `??` again. It should print the OPENAI_API_KEY line, and the buffer should stay unchanged.

## Threat Flags

None. The new surface (the outbound HTTPS call to api.openai.com carrying the key) is covered by T-08-13..T-08-17, and each high-severity mitigation (T-08-13, T-08-14, T-08-17) has an automated test.

## OpenWolf entries (deferred)

The orchestrator applies these; nothing under `.wolf/` was committed from the worktree.

**anatomy.md**
- `## src/providers/`: `openai.ts`: OpenAI POST https://api.openai.com/v1/chat/completions adapter (constant URL; Bearer OPENAI_API_KEY from usableSecret(env) then .env.local; body is only model + developer buildSystemPrompt + user buildPrompt). 25s timeout combined with the abort signal. Static per-status copy (401/403/404/429/other plus a safe error.code), timeout/network/refusal/unexpected/cut-off. finalCandidateList with finish_reason 'stop'. OPENAI_DEFAULT_MODEL gpt-5.5. Registered as backend `openai`. (~2300 tok)
- `## tests/`: `openai-provider.test.ts`: OpenAI key handling (partial env-file mock), request shape and privacy, failure mapping with no Claude/Ollama fallback (SDK, execFileAsync, runClaudeTurn, localhost:11434), upstream message and masked-key non-echo, debug-log hygiene, daemon-down fallback. Stubs global fetch. (~4700 tok)
- Update `tests/daemon-fetch.test.ts`: adds the `provider pin: openai (08-04)` e2e tests (default model, model override).
- Update `tests/registry-bootstrap.test.ts`: asserts the ollama and openai backends.
- Update `src/registry/bootstrap.ts`: also registers `openai`.

**cerebrum.md, Key Learnings**
- [2026-10-17] 08-04: OpenAI Chat Completions: send `developer` role + `user`, and never temperature/top_p/max_tokens (reasoning models reject them; max_tokens is deprecated). Success is `choices[0].message.content` (null plus a `refusal` string on a refusal). The 401 `error.message` echoes a masked key fragment, so never surface upstream error text; keep only `error.code` matching `/^[a-z0-9_]{1,64}$/`.
- [2026-10-17] Under heavy machine load (load avg 300+), multi-file vitest runs fail with `[vitest-pool]: Timeout starting forks runner` before any test runs. Rerun with `--maxWorkers=1`; that is not a test failure.
- [2026-10-17] The worktree Bash guard refuses compound commands that mix `git` with heredocs or `cd`. Run each git command alone, and use Edit/Write (or a scratchpad script) for multi-line file edits.

**buglog.json**
- None. No bug was hit during this plan; the RED failures were intentional.

## Self-Check: PASSED

- FOUND: src/providers/openai.ts, tests/openai-provider.test.ts, src/registry/bootstrap.ts, tests/daemon-fetch.test.ts, tests/registry-bootstrap.test.ts
- FOUND commits: dfdf79b, 5ddc0b6, 537a042 (all ancestors of HEAD)
