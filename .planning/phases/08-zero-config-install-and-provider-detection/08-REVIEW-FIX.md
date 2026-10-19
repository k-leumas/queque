---
phase: 08-zero-config-install-and-provider-detection
fixed_at: 2026-10-19T08:53:42Z
review_path: .planning/phases/08-zero-config-install-and-provider-detection/08-REVIEW.md
iteration: 3
fix_scope: all
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 8: Code Review Fix Report

**Fixed at:** 2026-10-19T08:53:42Z
**Source review:** .planning/phases/08-zero-config-install-and-provider-detection/08-REVIEW.md
**Iteration:** 3 (the iteration-2 report is in git history)

**Summary:**
- Findings in scope: 8 (WR-13, WR-14, WR-15, IN-15 to IN-19; fix_scope `all`)
- Fixed: 8. IN-19 is a partial fix: the optional debug line was left out (see IN-19).
- Skipped: 0

Each fix has its own commit on `main`. All commits were made in the main checkout, not a
worktree. Two reasons: the commit rules require lint, typecheck and vitest before each commit,
and a fresh worktree has no `node_modules`. Also, `.wolf/` files must be staged with each fix,
and they already had uncommitted changes in the main tree, which would block the cleanup
`--ff-only` merge. Each commit stages the `.wolf/` files (`anatomy.md`, `memory.md`, and
`buglog.json` with a bug entry). It does not stage `.wolf/hooks/_session.json`. Before each
commit I ran:
- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm exec vitest run` on the affected test files

I also checked that every new test fails when the source change is reverted to HEAD. No commit
has a Co-Authored-By trailer.

## Verification

- **Where it ran:** the main checkout `/Users/samuel/dev/tui-llm` (branch `main`), so you can
  reproduce these numbers from this tree.
- **Full suite:** `pnpm exec vitest run --maxWorkers=1`: **43 files, 1071 tests, all passed**
  (load average 4.7 at the start).
- **Lint and types:** `pnpm run lint` (`biome check .`, 125 files) and `pnpm run typecheck` are
  clean.
- **These invariants still hold:**
  - the shared 25 s budget: every new re-send uses the same combined signal;
  - no `error.message` or key in copy or logs: the WR-14 tests plant both and check;
  - no fallthrough to another vendor: the tests call `expectNoFallback` / `expectNoClaudeCall`;
  - the OpenAI key goes only to the constant `api.openai.com` URL.

## Fixed Issues

### WR-13: Any candidate that mentions `<think>` or `</think>` breaks the whole Ollama or OpenAI answer

**Files modified:** `src/providers/claude.ts`, `tests/ollama-provider.test.ts`
**Commit:** afd9920
**Applied fix:**
- `strictCandidateListWithoutProse` now tries the raw text first, then the text after
  `stripThinking`. This uses the new private `strictListOrWrapped`, as the review suggested.
- I changed the review's suggestion for the closed-object scan. The review proposed a
  `^[{[` regex alone. Instead, the new `answerForScan` scans the raw JSON only when the reply
  starts as JSON (after an optional json fence, closed or only opened) and has no think tag
  outside a JSON string. The new `hasThinkTagOutsideStrings` checks this with the same
  string and escape tracking as the candidate scanner. Any other reply still goes through
  `stripThinking`.
- So a draft array followed by an orphan `</think>` is still dropped (WR-09 kept).

**Tests:**
- the three review probes, plus a fenced variant: each parses at a normal stop through both
  functions;
- the review's cut-off variant (`echo <think>` row, then `{"comm`) returns the first row;
- the same check with `</think>` in a bare array;
- a regression guard: a draft array, then a bare `</think>`, then a cut-off final answer still
  throws TRUNCATED.

**Status:** fixed: requires human verification (this changes the answer-selection rule).

### WR-14: The strict `json_schema` request has no fallback, so a pinned OpenAI model without structured outputs fails on every `??`

**Files modified:** `src/providers/openai.ts`, `tests/openai-provider.test.ts`
**Commit:** 3e994b4
**Applied fix:**
- `readSafeErrorFields` now also reports `rejectsResponseFormat` when `error.param` is
  `response_format` or `response_format.*`. It still reads only `param` and `code`.
- On a 400 for that param, `postChat` re-sends the same request (same effort, same signal)
  without `response_format`. It adds the model to `modelsRejectingSchema` for the life of the
  process; `resetOpenAiEffortCache` clears that set too.
- Recursion is bounded: `useSchema` is false after the first rejection.
- A later rejection of `reasoning_effort` still walks the existing effort ladder.
- `finalCandidateListWithoutProse` is still the safety net for an unconstrained reply.

**Tests:**
- fallback for `response_format` and for `response_format.json_schema.schema`: 2 calls, the
  second body has no `response_format`, the same signal, and the model is remembered (the next
  call makes 1 request without it);
- the response format and then the effort are both rejected: 3 calls, efforts
  `['low','low',undefined]`;
- the schema-less request also fails: static `HTTP 400, code invalid_value` copy, and neither
  the planted key nor `sk-proj-SECRET` appears in the error or the debug log;
- a fenced `{ candidates }` reply from the schema-less request still parses.

The old `it.each` row "400 for response_format → static failure after 1 call" was replaced. The
"another param" row stays, and I added a "no param" row.

**Status:** fixed: requires human verification. This reverses the quick-task 261018-wax test spec,
which said a 400 for `response_format` gets no fallback. That spec gave no reason and is not a
locked D-xx decision. The review and the user's instructions both prefer the fallback. Two
follow-ups:
- The review's advice still stands: run one live smoke request with a real `OPENAI_API_KEY`
  before tagging the release (UAT test 4).
- `docs/EXTENSIONS.md` does not yet mention the response-format fallback.

### WR-15: A fixed `num_ctx` of 20480 on every Ollama request changes memory use and forces model reloads for every Ollama user

**Files modified:** `src/providers/ollama.ts`, `src/providers/structured-output.ts`,
`docs/EXTENSIONS.md`, `tests/ollama-provider.test.ts`
**Commit:** a888b67
**Applied fix:**
- `OLLAMA_NUM_PREDICT` is now 2048, a standalone constant (it was MAX_OUTPUT_TOKENS, 16000).
- `OLLAMA_NUM_CTX` is now 8192 (it was 20480).
- The doc comments explain the KV-cache cost and the reload cost.
- `MAX_OUTPUT_TOKENS` is now documented as the OpenAI cap only.
- EXTENSIONS.md:42 is updated.

**Tests:**
- the request-shape test asserts `{ num_predict: 2048, num_ctx: 8192 }`;
- a new test asserts both constants, and checks that a typical prompt (about 3 chars per token,
  a conservative estimate) plus `num_predict` fits in `num_ctx`;
- a new test asserts the cut-off retry sends the same options, so QueQue never forces its own
  reload.

**Status:** fixed

### IN-15: Remote Ollama error text and the pin `baseUrl` still allow bidi and format characters

**Files modified:** `src/providers/provider.ts`, `src/providers/ollama.ts`,
`src/providers/provider-pin.ts`, `tests/provider-pin.test.ts`, `tests/ollama-provider.test.ts`
**Commit:** f113535
**Applied fix:**
- `provider.ts` exports `UNSAFE_LINE_CHARS` (`/[\p{Cc}\p{Cf}]/u`, not global, so `.test()`
  keeps no state) and `replaceUnsafeLineChars`.
- Ollama's `oneLine` replaces those characters with spaces.
- `httpUrl` rejects them through `.refine` and keeps `.min(1)`, so an empty string is still
  rejected.

**Tests:** a pin `baseUrl` with U+202E is invalid, and so is one with U+200B. A remote `error`
with U+202E/U+202C/U+2066/U+2069/U+200B/U+FEFF reaches the copy with no `\p{Cc}` or `\p{Cf}`
character.

**Status:** fixed. A follow-up outside this finding's scope: the pin `model` regex,
`listOllamaModels`' `CONTROL_BYTES` and OpenAI's `oneLine(model)` still filter `\p{Cc}` only.

### IN-16: `.env.local` is still searched above the home directory

**Files modified:** `src/shared/env-file.ts`, `tests/env-file.test.ts`, `README.md`
**Commit:** 221b6ea
**Applied fix:**
- The new `envFileFor(startDir)` reads exactly `join(homedir(), '.env.local')` when `startDir`
  resolves to the home directory. That covers the default and also `init-provider`'s explicit
  `homedir()` argument, so that caller and its test did not need to change.
- `findUp` is kept only for an explicit start directory other than home.
- README.md:65 no longer says "and the directories above it".

**Tests:**
- with HOME nested under a directory that holds a planted key file, the default call returns
  null;
- so does an explicit `home` start directory, with or without a trailing slash;
- `~/.env.local` itself is still read.

**Status:** fixed

### IN-17: A retry that runs out of time, or an OpenAI `content_filter` finish, shows the wrong message

**Files modified:** `src/providers/structured-output.ts`, `src/providers/ollama.ts`,
`src/providers/openai.ts`, `tests/structured-output.test.ts`, `tests/openai-provider.test.ts`,
`tests/ollama-provider.test.ts`
**Commit:** 61fc5e6
**Applied fix:**
- `candidatesWithCutOffRetry` takes an optional `budget` signal. Both adapters pass their
  `AbortSignal.timeout`, not the user signal.
- When the retry fails, nothing closed, and the budget has fired, it logs `response truncated`
  and throws TRUNCATED_RESPONSE_MESSAGE.
- I narrowed the review's version on purpose. The review proposed mapping any non-abort retry
  failure. With this version, a declined answer or an HTTP error on the retry keeps its own
  copy, and a user abort still wins.
- In OpenAI, `finish_reason: 'content_filter'` now throws the existing "declined this query"
  copy (now the `declinedQuery()` helper). It is not retried, and any partial text is dropped.

**Tests:**
- structured-output (i), (j), (k): a budget timeout becomes TRUNCATED, an HTTP 500 is kept,
  and a user abort still wins;
- OpenAI `content_filter`, with text and with null content: declined after 1 call;
- OpenAI and Ollama end-to-end with a 200 ms budget and a retry that hangs: "response was cut
  off", not "did not answer".

**Status:** fixed: requires human verification (this changes which error copy the user sees).

### IN-18: The OpenAI retry ladder does not remember rejected low efforts

**Files modified:** `src/providers/openai.ts`, `tests/openai-provider.test.ts`
**Commit:** 5bf7513
**Applied fix:**
- The new `rejectedEffortsByModel` map records every `reasoning_effort` that a model rejected,
  through `rememberRejectedEffort` in `postChat`. `resetOpenAiEffortCache` clears it.
- The retry ladder filters out those rungs.
- `modelsRejectingDefaultEffort` and the first-turn logic are unchanged.

**Tests:**
- after `none` and `minimal` are rejected once, the next cut-off sends `['low','low']` (2
  calls, not 4);
- the memory is per model (a different pinned model still tries `none`).

**Status:** fixed

### IN-19: A `~` in `QQ_CONFIG_FILE` silently drops the user's privacy patterns

**Files modified:** `src/shared/qq-config.ts`, `tests/qq-config.test.ts`
**Commit:** 8d49761
**Applied fix:** `defaultConfigPath()` expands a leading `~/` to `homedir()` before the existing
rule (an absolute path is used as is; a relative one resolves against home).
**Tests:**
- `'  ~/qq/config.json '` resolves to `$HOME/qq/config.json`;
- a `~/qq.json` override under a stubbed HOME loads its `sensitivePathPatterns`;
- `~qq.json` (no slash) stays a plain relative name.

**Status:** partial. The expansion is fixed; the optional debug line was left out. The review
also suggested logging a debug line when an explicit override names a missing file. I did not
add it, for two reasons:
- `debug-log.ts` imports `privacy-filter.ts`, which imports `qq-config.ts`. Calling
  `appendDebugLog` from `readConfigFile` would close that import cycle and could re-enter
  `loadQqConfig` before its cache is set.
- A `console.warn`, which is what the invalid-config path uses, would print to stderr in every
  test and setup that points `QQ_CONFIG_FILE` at a file that does not exist.

That needs a design choice, such as a deferred log or a log at the daemon start, so I left it
for a human.

---

_Fixed: 2026-10-19T08:53:42Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
