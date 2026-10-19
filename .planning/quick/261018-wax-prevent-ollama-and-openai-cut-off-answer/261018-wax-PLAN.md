---
phase: quick-261018-wax
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/providers/structured-output.ts
  - src/providers/claude.ts
  - src/providers/ollama.ts
  - src/providers/openai.ts
  - src/cli/commands/init-provider.ts
  - tests/structured-output.test.ts
  - tests/ollama-provider.test.ts
  - tests/openai-provider.test.ts
  - tests/init-provider.test.ts
  - README.md
  - docs/EXTENSIONS.md
autonomous: true
requirements: [quick-261018-wax]

estimate:
  tokens: 85000
  raw_tokens: 85000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Every Ollama POST to the chat endpoint carries `think: false`, `format` = the candidate-list JSON schema (array root, 1-5 objects with exactly `command` and `explanation`, both required strings, `additionalProperties: false`) and `options: { num_predict: 16000, num_ctx: 20480 }`, next to the unchanged model, `stream: false` and system + user messages (user decision 1)"
    - "Every OpenAI Chat Completions request carries `max_completion_tokens: 16000`, `reasoning_effort: \"low\"` and `response_format: { type: \"json_schema\", json_schema: { name: \"command_candidates\", strict: true, schema } }` whose schema is the object `{ candidates: <candidate-list schema> }`; the developer + user messages are unchanged and no temperature, top_p or max_tokens field is ever sent (user decision 1)"
    - "When a reply ends with a non-stop finish (Ollama `done_reason` other than `stop`, OpenAI `finish_reason` other than `stop`) and its text is not already a complete candidate list, the adapter retries exactly once, silently, on the same AbortSignal (one shared 25 s budget). A successful retry returns its candidates. When the retry is cut off too, the user sees the provider's existing `cut off before a full command` line (the TRUNCATED_RESPONSE_MESSAGE mapping), and a cut-off fragment never becomes a command. A user abort during the retry rejects with QueQue's AbortError"
    - "An OpenAI HTTP 400 whose `error.param` is `reasoning_effort` never fails the query: a rejected `low` is resent without `reasoning_effort` (remembered per model for the life of the process), and the cut-off retry walks `none`, `minimal`, `low`, then no `reasoning_effort` past such rejections. `error.message` is never read, logged or shown"
    - "finalCandidateListWithoutProse returns the candidates of a `{ \"candidates\": [...] }` answer and still returns a bare-array answer. Claude's own path is unchanged: finalCandidateList, parseCandidates, parseStrictCandidateList, fetchCandidates, SDK_MAX_TOKENS, claude-cli.ts, claude-process.ts and claude-default.ts are untouched and every Claude test passes unmodified (user decision 2)"
    - "`qq init provider` lists `1. Claude`, `2. OpenAI (beta)`, `3. Ollama (beta)` with the three hints starting in the same column, and README.md plus docs/EXTENSIONS.md label OpenAI and Ollama as beta (user decision 3)"
  artifacts:
    - path: "src/providers/structured-output.ts"
      provides: "MAX_OUTPUT_TOKENS (= SDK_MAX_TOKENS), CANDIDATE_LIST_JSON_SCHEMA, WRAPPED_CANDIDATE_LIST_JSON_SCHEMA, ModelTurn and candidatesWithCutOffRetry, shared by the Ollama and OpenAI adapters"
      exports: ["MAX_OUTPUT_TOKENS", "CANDIDATE_LIST_JSON_SCHEMA", "WRAPPED_CANDIDATE_LIST_JSON_SCHEMA", "ModelTurn", "candidatesWithCutOffRetry"]
    - path: "src/providers/claude.ts"
      provides: "strictCandidateListWithoutProse (bare or `{ candidates }` strict parse after stripThinking), used by finalCandidateListWithoutProse"
      contains: "export function strictCandidateListWithoutProse"
    - path: "src/providers/ollama.ts"
      provides: "Structured Ollama request (think, format, options) plus one cut-off retry"
      contains: "think: false"
    - path: "src/providers/openai.ts"
      provides: "Structured OpenAI request plus reasoning_effort fallback and one cut-off retry"
      contains: "max_completion_tokens"
    - path: "src/cli/commands/init-provider.ts"
      provides: "PROVIDER_MENU labels with (beta) for OpenAI and Ollama, aligned hint column"
      contains: "OpenAI (beta)"
    - path: "tests/structured-output.test.ts"
      provides: "Schema-vs-contract parity and candidatesWithCutOffRetry decision table"
  key_links:
    - from: "src/providers/ollama.ts and src/providers/openai.ts"
      to: "src/providers/structured-output.ts candidatesWithCutOffRetry"
      via: "each adapter passes its first ModelTurn and a retry closure that re-posts on the same requestSignal"
      pattern: "candidatesWithCutOffRetry\\("
    - from: "src/providers/structured-output.ts"
      to: "src/providers/claude.ts finalCandidateListWithoutProse / strictCandidateListWithoutProse"
      via: "the retry helper parses every turn with the existing no-prose rule, so the truncation check stays the safety net"
      pattern: "finalCandidateListWithoutProse\\("
    - from: "CANDIDATE_LIST_JSON_SCHEMA"
      to: "src/contracts/candidates.ts commandCandidateSchema / candidateListSchema"
      via: "tests/structured-output.test.ts asserts the property names, required list and 1-5 bounds match the zod contract"
      pattern: "commandCandidateSchema"
---

<objective>
Stop the Ollama and OpenAI adapters from returning cut-off answers (follow-up to phase 08
review WR-09), and label both providers as beta.

User decisions (LOCKED, from the quick-task brief; cited below as UD-1, UD-2, UD-3):
- UD-1 Prevent + auto-retry. Ollama request adds `think: false`, `format` (candidate-list JSON
  schema) and `options: { num_predict: 16000, num_ctx: 20480 }`. OpenAI request adds
  `max_completion_tokens: 16000`, `reasoning_effort: "low"` and a strict `json_schema`
  `response_format` with an object root `{ candidates: [...] }`; the parser accepts that shape
  and a bare array. On a non-stop finish: one silent retry with thinking fully off (Ollama: the
  same body; OpenAI: the lowest `reasoning_effort` the model accepts, falling back when the API
  rejects a value) inside the existing 25 s budget and abort signal. Only when the retry fails
  too does TRUNCATED_RESPONSE_MESSAGE surface. The truncation check stays as a hidden safety
  net: a cut-off fragment never becomes a command.
- UD-2 Claude is out of scope: claude.ts SDK path, claude-cli.ts, claude-process.ts and
  claude-default.ts do not change. Shared parse helpers in claude.ts may only be extended in a
  backward-compatible way (Claude tests untouched and passing). SDK_MAX_TOKENS = 16_000 is the
  parity reference.
- UD-3 Mark Ollama and OpenAI "beta" in README.md, docs/EXTENSIONS.md and the
  `qq init provider` menu labels (PROVIDER_MENU); update tests that assert the menu text.

Interpretation recorded for the checker (Claude's discretion inside UD-1): a non-stop reply
whose text already parses as a complete, schema-valid candidate list (bare or wrapped) is not a
cut-off, so it is returned without a retry. Everything else with a non-stop finish is retried
once. If the retry itself fails for a non-abort reason (HTTP error, timeout of the shared
budget, nothing usable) and the first reply had candidate objects that closed, those closed
candidates are returned (today's behaviour for a cut-off reply), otherwise the retry's error
surfaces. A user abort always wins.

Purpose: a local or OpenAI reasoning model that spends its output on thinking or stops early
should still give the user whole commands, not a "cut off" error or (worse) a draft.
Output: src/providers/structured-output.ts plus changes to the two adapters, the shared
no-prose parser, the provider picker labels, docs and regression tests.

Time estimate (user preference): Task 1 ~25-40 min, Task 2 ~20-35 min, Task 3 ~10 min,
final serial suite ~2-10 min. Total ~60-95 min under load.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.wolf/cerebrum.md
@.planning/quick/261018-wax-prevent-ollama-and-openai-cut-off-answer/COVERAGE.md

Interfaces the executor needs (verified at planning time; do not re-explore):

- src/contracts/candidates.ts: `commandCandidateSchema = z.object({ command: z.string().trim().min(1), explanation: z.string() })`; `candidateListSchema = z.array(commandCandidateSchema).min(1).max(5)`. No optional fields, so the strict OpenAI schema needs no nullable types.
- src/providers/candidate-stream.ts: `parseStrictCandidateList(text)` (fenced or bare array of 1-5, else undefined) and `createCandidateScanner` (objects closing at depth 2, max 5). Used by Claude: DO NOT CHANGE this file.
- src/providers/claude.ts: `SDK_MAX_TOKENS = 16_000` (line 37); `TRUNCATED_RESPONSE_MESSAGE` (line 43); private `stripCodeFence` (line 119); `finalCandidateList` (line 159, Claude only, do not touch); `stripThinking` (line 205); `finalCandidateListWithoutProse(text, finishedNormally, logFields)` (line 223, used ONLY by ollama.ts and openai.ts): strict parse of stripThinking(text), else closed objects after the first `[ {`, else TRUNCATED (non-stop) / UNPARSEABLE (stop). `ensureSelectableCandidates`, `buildPrompt` exported. claude.ts re-exports UNPARSEABLE_RESPONSE_MESSAGE from provider.ts.
- src/providers/provider.ts: `abortError()`, `isAbortError(error)`, `stripTerminalControls(list)` (throws UNPARSEABLE when nothing is left), `FetchOptions { signal?, onCandidate? }`.
- src/providers/ollama.ts `fetchOllamaCandidates(envelope, settings, timeoutMs = OLLAMA_TIMEOUT_MS, options = {})`: one `AbortSignal.timeout(timeoutMs)` combined with `options.signal` into `requestSignal`; `logRequest` debug line `ollama request` with exactly `{ model, status, durationMs }`; 404 / non-ok mapping; `done_reason === 'stop'`; TRUNCATED maps to "QueQue: Ollama response was cut off before a full command. ..." and UNPARSEABLE to `unexpectedResponse()`.
- src/providers/openai.ts `fetchOpenAiCandidates(...)`: same signal pattern; `readSafeErrorCode` keeps only `error.code` matching `SAFE_ERROR_CODE`, never `error.message` (a 401 message can echo a masked key fragment); `statusFailure(status, model, code)`; refusal copy; `finish_reason === 'stop'`; same TRUNCATED / UNPARSEABLE mapping.
- tests/steering.test.ts "adapters (b)/(d)": any file under src/providers/ that contains a model-call marker (the SDK messages calls, the system-prompt CLI flag, either provider endpoint path) or calls `buildPrompt(` must also contain `buildSystemPrompt(`. The new module therefore must not mention the endpoint paths or those markers, not even in comments.
- API facts (verified against current docs, 2026-10-18): Ollama `think` false = no thinking output if the model permits it (no error otherwise); `format` takes a JSON schema object; `options.num_predict` default -1 (infinite); `options.num_ctx` default 2048-4096. OpenAI strict json_schema needs an object root, every property in `required`, `additionalProperties: false`; `minLength`, `minItems`, `maxItems` are supported; error objects carry `code`, `message`, `param`, `type`; `max_completion_tokens` includes reasoning tokens; not every model accepts every `reasoning_effort` value.

Project rules for the executor (from the brief and cerebrum):
- Tests use a temp QQ_PROVIDER_FILE and stub QQ_FORCE_SELECTOR=0 (both provider test files already do this in beforeEach; keep it).
- Run vitest as `pnpm exec vitest run <files> --maxWorkers=1` (`pnpm test:run -- file` ignores the filter). Vitest `-t` is a regex: escape parentheses.
- Timing-budget suites (command-words-fuzz, zsh-widget, claude-prewarm, claude-process, claude-exec) flake under load: rerun the file alone and check `uptime` before treating a failure as real.
- A `Response` body can be read once. A test that expects a retry must give each fetch call a fresh Response (`mockResolvedValueOnce` per call, or `mockImplementation(() => chatResponse(...))`); `mockResolvedValue(oneResponse)` makes the retry read a used body.
- RED commits must pass `tsc --noEmit` (pre-commit): when a test imports a new export, add a throw-on-call stub with the public signature first.
- Before each commit: `pnpm exec biome check <changed files>` and `pnpm typecheck`. Never `--no-verify`.
- Commits: conventional, `fix(quick-261018-wax): ...`, `feat(quick-261018-wax): ...` or `test(quick-261018-wax): ...`; subject starts with a lowercase word; every line (subject and body) at most 100 characters; no Co-Authored-By trailer. Write the message to a file in the session scratchpad and run `git commit -F <file>` (a Bash command containing the literal dotenv file name trips the harness secret guard). Run git commands on their own, not chained with `cd` or heredocs.
- Never stage `.wolf/` files. OpenWolf bookkeeping (anatomy.md for the new files, memory.md, buglog.json) may be updated per .wolf/OPENWOLF.md but stays unstaged. The OpenWolf post-Edit hook rewrites anatomy descriptions and appends `auto-detected` buglog entries; that is expected noise.
- Plan base: `be9bb14f69b22e72bd17127d0bc27f6961b37d4e` (HEAD at planning time; src/, tests/, README.md and docs/ were clean). Verify commands use this SHA directly because shell variables do not persist between Bash calls; record it in the SUMMARY.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1 (tracer): Ollama structured request and one silent cut-off retry, end to end through the shared no-prose parser</name>
  <files>src/providers/structured-output.ts, src/providers/claude.ts, src/providers/ollama.ts, tests/structured-output.test.ts, tests/ollama-provider.test.ts</files>
  <read_first>
    - src/providers/ollama.ts (whole file, 329 lines)
    - src/providers/claude.ts lines 100-245 (parse helpers) and lines 28-43 (SDK_MAX_TOKENS, TRUNCATED_RESPONSE_MESSAGE)
    - src/providers/candidate-stream.ts (read only, do not edit)
    - src/providers/provider.ts
    - src/contracts/candidates.ts
    - tests/ollama-provider.test.ts lines 1-221 (mocks, chatResponse, sentBody, beforeEach) and 440-690 (cut-off, WR-09 and parser tests)
    - tests/steering.test.ts lines 216-273 (adapter scan rules)
  </read_first>
  <behavior>
    tests/structured-output.test.ts (new):
    - CANDIDATE_LIST_JSON_SCHEMA is `type: 'array'`, `minItems: 1`, `maxItems: 5`; its `items` is `type: 'object'`, `additionalProperties: false`, property names equal `Object.keys(commandCandidateSchema.shape)` (sorted), `required` holds the same names, every property is `type: 'string'`, and `command` has `minLength: 1` (mirrors `.min(1)`). This is the guard that the schema matches the candidate contract exactly (UD-1).
    - WRAPPED_CANDIDATE_LIST_JSON_SCHEMA is `type: 'object'`, `required: ['candidates']`, `additionalProperties: false`, and `properties.candidates` deep-equals CANDIDATE_LIST_JSON_SCHEMA.
    - MAX_OUTPUT_TOKENS equals SDK_MAX_TOKENS (16000) (UD-2 parity).
    - candidatesWithCutOffRetry: (a) first turn finished normally: returns its list, the retry callback is never called; (b) first turn not finished but its text is a complete bare array, and separately a complete `{"candidates":[...]}` object: returned, no retry; (c) first turn cut off mid-object: the retry is called exactly once and a normal retry's list is returned; (d) first and retry both cut off with no closed object: rejects with TRUNCATED_RESPONSE_MESSAGE; (e) first turn cut off with one closed object, retry rejects with a plain Error: resolves to that closed object; (f) same, but the retry rejects with `abortError()`: rejects with the AbortError (isAbortError true); (g) first turn cut off with one closed object, retry finishes normally with prose only: resolves to the first turn's closed object; (h) a first turn whose only array sits inside unclosed `<think>` is treated as cut off (retry called) and never returns the draft.
    tests/ollama-provider.test.ts, parser block (`stripThinking and finalCandidateListWithoutProse`):
    - `{"candidates":[{"command":"ls -la","explanation":"List files"}]}` parses at a normal stop, also inside a json code fence and after `</think>`; a bare array still parses; `{"candidates":[]}` at a normal stop throws UNPARSEABLE_RESPONSE_MESSAGE; strictCandidateListWithoutProse returns undefined for a cut-off wrapper and for prose.
    tests/ollama-provider.test.ts, adapter:
    - The request-shape test now expects body keys `['format','messages','model','options','stream','think']`, `think === false`, `format` deep-equal to CANDIDATE_LIST_JSON_SCHEMA, `options` deep-equal to `{ num_predict: 16000, num_ctx: 20480 }`; model, stream and messages assertions unchanged.
    - `done_reason: 'length'` with a fragment on both calls: exactly 2 fetch calls with byte-identical bodies, error matches /cut off/, nothing returned.
    - `done_reason: 'length'` fragment, then a normal answer: returns the retry's candidates after exactly 2 calls.
    - Both fetch calls receive the same `signal` object (one shared 25 s budget).
    - A user abort fired while the retry is in flight rejects with isAbortError true and no Claude call.
    - A `done_reason: 'length'` reply that is already a complete array is returned after 1 call.
    - The existing cut-off tests ("never turns a cut-off answer into a prose command", "never returns a draft from unclosed thinking in a cut-off answer", "keeps the closed candidates of a cut-off answer") give each call a fresh Response and assert the call count; their user-visible outcome is unchanged (the last one: a cut-off retry with nothing closed still yields the first reply's closed candidates).
  </behavior>
  <action>
    RED first: write the tests above. Create src/providers/structured-output.ts with the real schema constants and MAX_OUTPUT_TOKENS, and a throw-on-call stub for candidatesWithCutOffRetry; add a throw-on-call stub for strictCandidateListWithoutProse in claude.ts, so `pnpm typecheck` passes. Run the new and changed tests, confirm the behaviour tests fail, commit `test(quick-261018-wax): ...`.

    GREEN, src/providers/structured-output.ts (new module, the shared non-Claude structured-output seam; per UD-1, UD-2):
    - `MAX_OUTPUT_TOKENS` = SDK_MAX_TOKENS imported from claude.ts (parity by construction, not a second literal).
    - `CANDIDATE_LIST_JSON_SCHEMA`: plain JSON Schema object (declared `as const`), array root, `minItems` 1, `maxItems` 5, items object with properties `command` (type string, minLength 1) and `explanation` (type string), `required` both, `additionalProperties` false. Hand-written, not generated: zod's JSON Schema output adds a `$schema` key that a strict endpoint may reject.
    - `WRAPPED_CANDIDATE_LIST_JSON_SCHEMA`: object root with the single property `candidates` set to CANDIDATE_LIST_JSON_SCHEMA, `required` ['candidates'], `additionalProperties` false (strict mode needs an object root).
    - `export interface ModelTurn { content: string; finishedNormally: boolean }`.
    - `candidatesWithCutOffRetry(first: ModelTurn, retry: () => Promise<ModelTurn>, logFields: Record<string, unknown> = {}): Promise<CandidateList>` implementing the rule in the objective: finished normally, return finalCandidateListWithoutProse(first.content, true, logFields); not finished but strictCandidateListWithoutProse(first.content) returns a list, return it; otherwise keep the first turn's closed candidates (finalCandidateListWithoutProse(first.content, false, logFields), catching only TRUNCATED_RESPONSE_MESSAGE as "none"), write one debug line via appendDebugLog('provider', 'response cut off, retrying once', logFields), await retry(), and return finalCandidateListWithoutProse(second.content, second.finishedNormally, logFields). Any rejection from retry() or from parsing the second turn: rethrow when isAbortError(error) or when the first turn had no closed candidates, else return the first turn's closed candidates. Exactly one retry, never a loop.
    - Keep the provider endpoint paths and the model-call markers that tests/steering.test.ts scans for out of this module (comments included); it builds no prompt.
    - Module-load reads stay limited to unmocked modules (claude.ts, this module). Never read a provider-pin.js binding at module load: tests/client-result.test.ts mocks provider-pin.js strictly (cerebrum: main.ts import graph rule).

    GREEN, src/providers/claude.ts (backward-compatible extension only, UD-2):
    - Add exported `strictCandidateListWithoutProse(text): CandidateList | undefined`: answer = stripThinking(text); return parseStrictCandidateList(answer), else, when JSON.parse(stripCodeFence(answer)) is a non-null, non-array object, candidateListSchema.safeParse of its `candidates` value (data on success), else undefined.
    - In finalCandidateListWithoutProse replace only the `parseStrictCandidateList(answer)` call with strictCandidateListWithoutProse(text); the scanner fallback, the TRUNCATED / UNPARSEABLE branches and the log lines stay as they are. Update its doc comment to say a `{ candidates: [...] }` object is accepted.
    - Do not touch finalCandidateList, parseCandidates, completeCandidates, sanitizedOrPlaceholder, fetchCandidates, claudeAdapter, SDK_MAX_TOKENS, or candidate-stream.ts.

    GREEN, src/providers/ollama.ts (UD-1):
    - Export `OLLAMA_NUM_PREDICT = MAX_OUTPUT_TOKENS` and `OLLAMA_NUM_CTX = 20_480` with a comment: 16000 output plus ~4.5k prompt headroom; a fixed value because Ollama reloads the model when num_ctx changes between requests, so it must not be sized per prompt.
    - Build the request body string once: model, `stream: false`, `think: false`, `format: CANDIDATE_LIST_JSON_SCHEMA` (array root, matching the system prompt's "JSON array" instruction), `options: { num_predict: OLLAMA_NUM_PREDICT, num_ctx: OLLAMA_NUM_CTX }`, messages unchanged (buildSystemPrompt(envelope) and buildPrompt(envelope) stay in this file).
    - Move the fetch, logRequest, 404 / non-ok mapping, body read, JSON parse and content check into one inner `postChat(): Promise<ModelTurn>` that posts the same body string on the same `requestSignal`, with its own start time so each `ollama request` line keeps exactly `{ model, status, durationMs }`. It returns `{ content, finishedNormally: body.done_reason === 'stop' }`. The retry re-posts as-is (think is already false, per UD-1).
    - Call `candidatesWithCutOffRetry(await postChat(), postChat, { model: settings.model })`, then stripTerminalControls and ensureSelectableCandidates. The existing try/catch maps TRUNCATED to the Ollama "cut off before a full command" line and UNPARSEABLE to unexpectedResponse(); errors already mapped by postChat pass through unchanged.
    - Update the function doc comment (body fields, one retry on a cut-off inside the same budget, truncation check as the safety net).

    Then run the verify command, fix until green, biome + typecheck, commit `fix(quick-261018-wax): stop cut-off Ollama answers with a schema and one retry` (or similar, at most 100 chars).
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/structured-output.test.ts tests/ollama-provider.test.ts tests/steering.test.ts tests/candidate-stream.test.ts tests/claude-provider.test.ts tests/claude-cli-provider.test.ts --maxWorkers=1 && pnpm typecheck && pnpm exec biome check src/providers/structured-output.ts src/providers/claude.ts src/providers/ollama.ts tests/structured-output.test.ts tests/ollama-provider.test.ts && git diff --quiet be9bb14f69b22e72bd17127d0bc27f6961b37d4e -- src/providers/candidate-stream.ts src/providers/claude-cli.ts src/providers/claude-process.ts src/providers/claude-default.ts src/providers/steering.ts tests/claude-provider.test.ts tests/claude-cli-provider.test.ts tests/candidate-stream.test.ts</automated>
  </verify>
  <done>Ollama requests carry think/format/options; a cut-off reply is retried exactly once on the shared signal; a second cut-off shows the Ollama "cut off" line; `{ candidates }` and bare arrays both parse; the new and updated tests pass; Claude files and Claude tests are unchanged and green; RED and GREEN commits exist.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: OpenAI structured request, reasoning_effort fallback and one silent cut-off retry</name>
  <files>src/providers/openai.ts, tests/openai-provider.test.ts</files>
  <read_first>
    - src/providers/openai.ts (whole file, 280 lines)
    - src/providers/structured-output.ts (written in Task 1)
    - tests/openai-provider.test.ts lines 1-224 (mocks, chatResponse, contentResponse, errorResponse, sentBody, beforeEach) and 280-305, 536-606
  </read_first>
  <behavior>
    - The request-shape test (rename it from "posts only model and messages") expects body keys `['max_completion_tokens','messages','model','reasoning_effort','response_format']`, `max_completion_tokens === 16000`, `reasoning_effort === 'low'`, `response_format` deep-equal to `{ type: 'json_schema', json_schema: { name: 'command_candidates', strict: true, schema: WRAPPED_CANDIDATE_LIST_JSON_SCHEMA } }`, and no `temperature`, `top_p` or `max_tokens` key; developer + user messages unchanged.
    - Content `{"candidates":[{"command":"ls -la","explanation":"List files"}]}` returns that candidate; a bare-array answer still returns it.
    - `finish_reason: 'length'` with a fragment (`{"candidates":[{"command":"rm -rf`), then a normal wrapped answer: returns the retry's candidates after exactly 2 calls; the bodies' `reasoning_effort` values are `['low', 'none']`; both calls get the same `signal` object.
    - `finish_reason: 'length'` fragment on both calls: exactly 2 calls, error matches /cut off/, no candidate is returned.
    - First call answers HTTP 400 `{ error: { message: 'Unsupported value ... sk-proj-SECRET', type: 'invalid_request_error', param: 'reasoning_effort', code: 'unsupported_value' } }`, second call succeeds: candidates returned, the second body has no `reasoning_effort` key, and `sk-proj-SECRET` appears in no thrown error and in no appendDebugLog argument. A second fetchCandidates for the same model then makes 1 call with no `reasoning_effort` key (per-model memory); beforeEach calls resetOpenAiEffortCache().
    - Retry ladder: first call `low` cut off; `none` answers 400 with `param: 'reasoning_effort'`; `minimal` succeeds: candidates returned and the bodies' efforts are `['low', 'none', 'minimal']`.
    - HTTP 400 with `param: 'response_format'` (or any other param) maps to the existing static `OpenAI request failed (HTTP 400, code ...)` line after 1 call (no fallback).
    - A user abort fired while the retry is in flight rejects with isAbortError true and no Claude or Ollama call.
    - `finish_reason: 'length'` with `content: null` and no refusal is treated as an empty cut-off (retried), not as an unexpected response.
    - The existing cut-off test (finish_reason length) gives each call a fresh Response and asserts 2 calls; the debug-log key test (`model`, `status`, `durationMs`) still passes.
  </behavior>
  <action>
    RED first: write the tests above (add a throw-on-call `resetOpenAiEffortCache` stub so typecheck passes), confirm they fail, commit `test(quick-261018-wax): ...`.

    GREEN, src/providers/openai.ts (UD-1):
    - Exported constants: `OPENAI_REASONING_EFFORT = 'low'`, `OPENAI_RETRY_REASONING_EFFORTS = ['none', 'minimal', 'low'] as const` (lowest first), `OPENAI_RESPONSE_FORMAT_NAME = 'command_candidates'`; a local `ReasoningEffort` union of those three.
    - Per-model memory: a module-level Set of model names whose `low` was rejected, plus exported `resetOpenAiEffortCache()` that clears it (for tests). It only skips a known-failing first request in the long-lived daemon; it never stores keys or prompts.
    - Request body builder taking the effort (or undefined): model, the unchanged developer + user messages (buildSystemPrompt(envelope), buildPrompt(envelope), built once), `max_completion_tokens: MAX_OUTPUT_TOKENS`, `response_format` json_schema with name OPENAI_RESPONSE_FORMAT_NAME, `strict: true`, schema WRAPPED_CANDIDATE_LIST_JSON_SCHEMA, and `reasoning_effort` only when the effort is defined. Still no temperature, top_p or max_tokens (cerebrum 08-04 rule).
    - Replace readSafeErrorCode with a reader that returns `{ code, rejectsReasoningEffort }`: `code` exactly as before (SAFE_ERROR_CODE), `rejectsReasoningEffort` = `error.param === 'reasoning_effort'`. It never reads `error.message`.
    - Inner `postChat(effort)` on the shared `requestSignal` (one `openai request` debug line per call with exactly `{ model, status, durationMs }`): on a non-ok status read the safe fields; HTTP 400 with rejectsReasoningEffort and a defined effort returns an "effort rejected" result (one debug line `openai reasoning_effort rejected` with `{ model, effort }` only); any other non-ok status throws statusFailure as today. On 2xx parse as today: refusal copy when content is not a string and refusal is non-empty; content not a string with a non-stop finish becomes '' (an empty cut-off); content not a string at a normal stop is unexpectedResponse(). A turn result carries `{ content, finishedNormally: finish_reason === 'stop' }`.
    - A small loop over an effort list returns the first turn and the effort it used; the list always ends with undefined, and postChat(undefined) never returns "effort rejected", so the loop ends with a turn or a thrown error.
    - First request: efforts ['low', undefined], or [undefined] when the model is in the Set; when `low` was rejected, add the model to the Set.
    - Retry closure for candidatesWithCutOffRetry: [...OPENAI_RETRY_REASONING_EFFORTS, undefined] when the first request used `low`, else [undefined] (a model that rejects `low` is not expected to accept a lower value). This is the "lowest effort the model supports, falling back gracefully" from UD-1.
    - Call `candidatesWithCutOffRetry(firstTurn, retry, { model: settings.model })`, then stripTerminalControls and ensureSelectableCandidates inside the existing try/catch (TRUNCATED to the OpenAI "cut off before a full command" line, UNPARSEABLE to unexpectedResponse()).
    - Update the function doc comment (it currently says the body has no token-limit fields).

    Run verify, biome + typecheck, commit `fix(quick-261018-wax): stop cut-off OpenAI answers with a strict schema and one retry` (at most 100 chars).
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/openai-provider.test.ts tests/structured-output.test.ts tests/steering.test.ts --maxWorkers=1 && pnpm typecheck && pnpm exec biome check src/providers/openai.ts tests/openai-provider.test.ts</automated>
  </verify>
  <done>OpenAI requests carry max_completion_tokens, reasoning_effort and the strict wrapped schema; a rejected effort falls back instead of failing; a cut-off reply is retried once with the lowest accepted effort; a second cut-off shows the OpenAI "cut off" line; upstream error text never leaks; tests pass; RED and GREEN commits exist.</done>
</task>

<task type="auto">
  <name>Task 3: Label OpenAI and Ollama as beta in the picker, README and EXTENSIONS</name>
  <files>src/cli/commands/init-provider.ts, tests/init-provider.test.ts, README.md, docs/EXTENSIONS.md</files>
  <read_first>
    - src/cli/commands/init-provider.ts lines 25-45 and 305-320 (PROVIDER_MENU and the menu print loop)
    - tests/init-provider.test.ts lines 1-150 (runPicker helper and the menu test)
    - README.md lines 25-100
    - docs/EXTENSIONS.md lines 1-75
  </read_first>
  <action>
    Per UD-3:
    - src/cli/commands/init-provider.ts: PROVIDER_MENU labels become `OpenAI (beta)` and `Ollama (beta)`; Claude stays `Claude`; ids and hints unchanged. The print loop pads each label to the longest PROVIDER_MENU label (computed from the array, replacing the fixed padEnd(7)) so the hints still line up.
    - tests/init-provider.test.ts: the "menu lists Claude, OpenAI, Ollama in that order" test also asserts the output contains `2. OpenAI (beta)` and `3. Ollama (beta)`, the Claude row has no `(beta)`, and the three hint texts start at the same column. Any other assertion on the menu text that breaks gets the new label.
    - README.md (stays trim, user-facing; no new env-var table, per cerebrum): heading `### OpenAI or Ollama` becomes `### OpenAI or Ollama (beta)` (no link targets its anchor, checked); the line-42 sentence names them as beta (for example "To use OpenAI or a local Ollama model instead (both in beta), run `qq init provider` once."); the two bullets start `**OpenAI (beta)**` and `**Ollama (beta)**`.
    - docs/EXTENSIONS.md: in the registry table write `ollama` (beta), `openai` (beta); the provider-resolution bullet says the `openai` or `ollama` pin is beta; after the pin-format paragraph add one short paragraph describing the beta request contract: Ollama gets `think: false`, a `format` JSON schema for the candidate array and `options` num_predict 16000 / num_ctx 20480; OpenAI gets a strict `json_schema` response format whose root is `{ "candidates": [...] }`, `max_completion_tokens` 16000 and `reasoning_effort` low (sent without it when the model rejects it); a cut-off reply is retried once, silently, inside the same 25 s budget, and only a second cut-off shows the "cut off" error; a cut-off fragment never becomes a command. Keep "QueQue never retries with another vendor" (the retry goes to the same provider).
    - Biome + typecheck, commit `feat(quick-261018-wax): label OpenAI and Ollama as beta` (at most 100 chars).
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/init-provider.test.ts --maxWorkers=1 && pnpm typecheck && pnpm exec biome check src/cli/commands/init-provider.ts tests/init-provider.test.ts && grep -q 'OpenAI or Ollama (beta)' README.md && grep -q 'num_ctx' docs/EXTENSIONS.md && test "$(grep -c '(beta)' docs/EXTENSIONS.md)" -ge 2</automated>
  </verify>
  <done>`qq init provider` shows OpenAI (beta) and Ollama (beta) with aligned hints; README and EXTENSIONS mark both as beta and EXTENSIONS documents the request contract and the single retry; tests pass; one feat commit exists.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| QueQue to Ollama server (localhost or a `baseUrl`, possibly plain http) | Model text from a possibly remote server becomes candidate rows shown on the terminal and inserted into the shell buffer |
| QueQue to api.openai.com | The bearer key and the privacy-filtered prompt cross here; HTTP error bodies come back and may echo key fragments |
| Adapter to shell buffer | A candidate's command lands in the live zsh buffer (never executed automatically) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261018-wax-01 | Tampering | candidatesWithCutOffRetry / finalCandidateListWithoutProse | high | mitigate | Every turn (first and retry) goes through finalCandidateListWithoutProse: no prose fallback, stripThinking drops unclosed thinking, a non-stop reply returns only closed schema-valid objects or throws TRUNCATED. Tests (h), the Ollama/OpenAI "fragment twice" tests and the WR-09 tests prove a cut-off fragment or draft never becomes a command |
| T-261018-wax-02 | Information disclosure | openai.ts error-body reader | high | mitigate | The 400 fallback reads only `error.param` (compared to `reasoning_effort`) and `error.code` (SAFE_ERROR_CODE); `error.message` is never read. The fallback test plants `sk-proj-SECRET` in the message and asserts it is absent from errors and debug-log arguments |
| T-261018-wax-03 | Denial of service | retry and effort ladder | medium | mitigate | One retry at most; the ladder is bounded (none, minimal, low, omitted) and rejected values return fast 400s; every request shares the one `AbortSignal.timeout(OLLAMA_TIMEOUT_MS / OPENAI_TIMEOUT_MS)` combined with the user signal, asserted by the same-signal tests, so the overall 25 s budget never grows |
| T-261018-wax-04 | Tampering | Ollama/OpenAI candidate text | medium | mitigate | stripTerminalControls (sanitizeCandidate: C0/C1/DEL and bidi/zero-width removed) still runs on the chosen list after the retry helper; the existing WR-04 / IN-12 / IN-13 tests stay green |
| T-261018-wax-05 | Information disclosure | retry re-sends the prompt | low | accept | The retry goes to the same pinned provider with the same privacy-filtered prompt; no new recipient and no new data. QueQue never falls through to another vendor |
| T-261018-wax-06 | Information disclosure | per-model effort memory | low | accept | The in-process Set holds only model names from provider.json, never keys or prompts, and lives only as long as the process |
| T-261018-wax-SC | Tampering | npm/pip/cargo installs | low | accept | No package is added or upgraded in this task (fetch + existing zod only), so the package-legitimacy gate has nothing to check |
</threat_model>

<verification>
After all three tasks (cwd = repo root):
- `pnpm exec vitest run --maxWorkers=1` passes. If a timing-budget suite (command-words-fuzz, zsh-widget, claude-prewarm, claude-process, claude-exec) fails, check `uptime` and rerun that file alone before treating it as real.
- `pnpm typecheck` and `pnpm lint` pass.
- `git diff --quiet be9bb14f69b22e72bd17127d0bc27f6961b37d4e -- src/providers/candidate-stream.ts src/providers/claude-cli.ts src/providers/claude-process.ts src/providers/claude-default.ts src/providers/steering.ts tests/claude-provider.test.ts tests/claude-cli-provider.test.ts tests/candidate-stream.test.ts` exits 0 (Claude path untouched, UD-2).
- `git log --oneline be9bb14f69b22e72bd17127d0bc27f6961b37d4e..HEAD` shows the RED/GREEN commits for Tasks 1-2 and the Task 3 commit, all `quick-261018-wax` scoped, no Co-Authored-By trailer, no `.wolf/` file in any commit (`git show --stat --format= be9bb14f69b22e72bd17127d0bc27f6961b37d4e..HEAD` lists none).
</verification>

<success_criteria>
- Both adapters ask for a structured, capped, low-thinking answer (UD-1 request fields, exact values as above).
- A cut-off reply is retried once, silently, within the shared 25 s budget; only a second cut-off reaches the user as the provider's "cut off" line; no fragment ever becomes a command.
- OpenAI never fails a query because a model rejects a `reasoning_effort` value.
- Claude behaviour and Claude tests are unchanged (UD-2).
- The picker, README and EXTENSIONS label OpenAI and Ollama as beta (UD-3).
</success_criteria>

<output>
Create `.planning/quick/261018-wax-prevent-ollama-and-openai-cut-off-answer/261018-wax-SUMMARY.md` when done (record the plan base SHA, commits, test counts and any flaky reruns).
</output>
