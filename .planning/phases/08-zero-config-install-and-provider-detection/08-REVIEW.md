---
phase: 08-zero-config-install-and-provider-detection
reviewed: 2026-10-19T00:00:00Z
depth: standard
iteration: 3
diff_base: 3eb8bfb
files_reviewed: 27
files_reviewed_list:
  - CONTRIBUTING.md
  - README.md
  - docs/EXTENSIONS.md
  - src/cli/commands/init-provider.ts
  - src/client/run-foreground.ts
  - src/daemon/bootstrap.ts
  - src/providers/claude-cli.ts
  - src/providers/claude-default.ts
  - src/providers/claude.ts
  - src/providers/detect.ts
  - src/providers/ollama.ts
  - src/providers/openai.ts
  - src/providers/provider-pin.ts
  - src/providers/provider.ts
  - src/providers/structured-output.ts
  - src/shared/env-file.ts
  - src/shared/qq-config.ts
  - tests/claude-cli-provider.test.ts
  - tests/client-result.test.ts
  - tests/daemon-bootstrap.test.ts
  - tests/env-file.test.ts
  - tests/init-provider.test.ts
  - tests/ollama-provider.test.ts
  - tests/openai-provider.test.ts
  - tests/provider-pin.test.ts
  - tests/qq-config.test.ts
  - tests/structured-output.test.ts
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 8: Code Review Report (iteration 3, incremental diff 3eb8bfb..HEAD)

**Reviewed:** 2026-10-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

Iteration 2 of this report is in git history at 3eb8bfb. This iteration reviews quick task
261018-wax and the WR-09..WR-12 and IN-01..IN-14 fix commits.

## Narrative Findings (AI reviewer)

## Summary

I read every in-scope file in full. I traced the new retry path through its callers and
callees: `structured-output.ts`, `claude.ts` (`stripThinking`,
`strictCandidateListWithoutProse`, `finalCandidateListWithoutProse`), `provider.ts`
(`stripTerminalControls`), `fetch-client.ts` (the in-process fallback), and the bootstrap
spawn and replace path. I ran the 10 in-scope test files: 331 tests pass. I also ran a
scratch probe against the real modules to check the parsing edge cases (results are cited
below).

### Resolved since iteration 2

All 18 iteration-2 findings are fixed as described:

- **WR-09:** `stripThinking` keeps only the text after the last `</think>` and drops an
  unclosed `<think>`.
- **WR-10:** `readEnvValueFromDotEnvLocal` now starts at `homedir()` by default.
- **WR-11:** the error copy and the docs now say `~/.env.local`. A grep found no bare
  `.env.local` left in user-facing text.
- **WR-12:** `daemonCwd()` falls back to `/`, the child has an `'error'` listener, and
  `run-foreground` catches an `ensureDaemon` failure.
- **IN-01..IN-14** are fixed. IN-10 and IN-12 leave a small gap (IN-15).

I checked the new `ensureDaemon` catch for a vendor fallthrough. The only errors it now
swallows are "did not start" and the unsafe-path guard. The socket path always comes from
`socketPathForUid`, so the guard cannot fire here. After either error,
`fetchCandidatesForUi` runs `resolveProviderAdapter()`, which honors the pin. I found no
path that sends an Ollama or OpenAI pin's prompt to Claude.

The retry stays inside the 25 s budget. Every request shares one
`AbortSignal.timeout(...)` combined with the user signal. That holds for both Ollama
calls and for every step of the OpenAI effort ladder (at most 5 POSTs). A user abort
always wins. No error path reads `error.message` or the key, so I found no secret leakage.

Three problems need attention before release:

- The WR-09 fix breaks any answer that mentions a think tag (WR-13).
- The OpenAI request now hard-fails on models without strict structured output (WR-14).
- The fixed Ollama `num_ctx` changes memory use for every Ollama user (WR-15).

## Warnings

### WR-13: Any candidate that mentions `<think>` or `</think>` breaks the whole Ollama or OpenAI answer

**File:** `src/providers/claude.ts:205-209`, `:217-219`, `:254-260`

**Issue:** `stripThinking` runs on the raw text before any JSON parse. It does not check
whether the tag is inside a JSON string value:

- A `<think>` anywhere in the text, with no `</think>` after it, deletes everything from
  the tag to the end of the text.
- A `</think>` anywhere in the text throws away everything before it.

Both adapters now ask for grammar-constrained or strict-schema JSON. So a tag can only
appear inside a `command` or `explanation` string, and that is exactly where the strip
does damage. Checked against the real module:

```
finalCandidateListWithoutProse('{"candidates":[{"command":"sed -i \'s/<think>//g\' out.txt","explanation":"Remove think tags"}]}', true)
  -> THROW QueQue: response held no command candidates
finalCandidateListWithoutProse('[{"command":"grep -c \'</think>\' run.log","explanation":"count"},{"command":"ls","explanation":"x"}]', true)
  -> THROW QueQue: response held no command candidates
finalCandidateListWithoutProse('{"candidates":[{"command":"ls","explanation":"no <think> here"},{"command":"pwd","explanation":"ok"}]}', true)
  -> THROW QueQue: response held no command candidates
```

The user sees "Ollama/OpenAI returned an unexpected response" for a valid answer, every
time, for any query about think tags or LLM output cleanup. That is a likely query for
people who run local reasoning models. On the cut-off path, the same strip also discards
closed candidates that came before the tag.

**Fix:** Try the strict parse on the raw text first. A complete JSON document cannot hold
an unquoted think block. Strip only when that parse fails. For the closed-object scan, scan
the raw text when it already starts as JSON:

```ts
function strictListOrWrapped(text: string): CandidateList | undefined {
  const bare = parseStrictCandidateList(text);
  if (bare) return bare;
  let parsed: unknown;
  try { parsed = JSON.parse(stripCodeFence(text)); } catch { return undefined; }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
  const list = candidateListSchema.safeParse((parsed as { candidates?: unknown }).candidates);
  return list.success ? list.data : undefined;
}

export function strictCandidateListWithoutProse(text: string): CandidateList | undefined {
  return strictListOrWrapped(text) ?? strictListOrWrapped(stripThinking(text));
}

// finalCandidateListWithoutProse:
const fenced = stripCodeFence(text);
const answer = /^(\{\s*"candidates"\s*:\s*)?\[\s*\{/.test(fenced) ? fenced : stripThinking(text);
```

Add the three probe cases above as tests, plus a cut-off variant
(`{"candidates":[{"command":"echo <think>","explanation":"a"},{"comm`, which must return
the first row).

### WR-14: The strict `json_schema` request has no fallback, so a pinned OpenAI model without structured outputs fails on every `??`

**File:** `src/providers/openai.ts:227-241`, `:276-283`, `:142-145`

**Issue:** Every request now carries
`response_format: { type: 'json_schema', strict: true, ... }`. A rejected
`reasoning_effort` gets a graceful fallback. A rejected `response_format` does not. Models
that a user can pin through `"model"` in provider.json and that do not accept strict
`json_schema` worked before this change. They now get an HTTP 400 on every request.
Examples are `gpt-4-turbo`, `gpt-3.5-turbo`, the `o1-mini`/`o1-preview` family, and any
schema keyword the endpoint refuses.

That 400 reaches the `default` branch of `statusFailure`:
`QueQue: OpenAI request failed (HTTP 400, code ...).` The message names neither the model
nor the fix, and has no `qq init provider` hint. 08-UAT.md also marks the OpenAI pin as
blocked on a real key. The strict request body, including `minLength`, `minItems` and
`maxItems` under `strict: true`, has never been accepted by the live endpoint. If any part
of it is refused, OpenAI is broken for every user on release day, and the tests (all
mocked) cannot show it.

**Fix:** Handle `response_format` the same way as `reasoning_effort`. Read `error.param`.
On a 400 for `response_format`, resend without it. The no-prose final-list rule is already
the safety net. Remember the model for the life of the process:

```ts
rejectsResponseFormat: body?.error?.param === 'response_format',
// in postChat:
if (response.status === 400 && rejectsResponseFormat && useSchema) {
  modelsRejectingSchema.add(model);
  return undefined; // caller resends with useSchema = false
}
```

At minimum, map a 400 whose `param` is `response_format` to copy that names the model, for
example: "OpenAI model 'x' does not support structured output. Set "model" in
~/.config/qq/provider.json, or run `qq init provider`." Run one live smoke request with a
real key before tagging the release.

### WR-15: A fixed `num_ctx` of 20480 on every Ollama request changes memory use and forces model reloads for every Ollama user

**File:** `src/providers/ollama.ts:28-36`, `:186`

**Issue:** Before this change, QueQue sent no `options`, so the server's default context
applied (2048-4096, or the user's `OLLAMA_CONTEXT_LENGTH`). Now every request forces
`num_ctx: 20480`, sized for `num_predict: 16000` output tokens. This has two costs:

- **Memory.** On an 8B model, a 20k-token KV cache is about 2.5 GB more than the default.
  On the 8-16 GB machines common for local Ollama, the model can spill to CPU or swap. Then
  every `??` ends in "Ollama did not answer within 25s".
- **Reloads.** Ollama reloads a model whenever `num_ctx` differs from the loaded instance.
  The code comment says so, but it only considers QueQue's own requests. Every switch
  between `ollama run`, Open WebUI or another client and `??` now pays a full model load,
  and that load can use up the 25 s budget by itself.

The large ceiling also buys nothing. No local model can produce 16000 tokens inside a 25 s
budget, so `done_reason: "length"` at that cap is unreachable and the timeout always comes
first.

**Fix:** Size the options to what the budget can use. Example: `num_predict` 2048 (the
whole answer is a few hundred tokens with `think: false`), and `num_ctx` of about 8192,
enough for the ~4.5k-token prompt plus that output. Or omit `num_ctx` unless the user sets
it, for example through an optional pin field. Update EXTENSIONS.md:42 to match.

## Info

### IN-15: Remote Ollama error text and the pin `baseUrl` still allow bidi and format characters

**File:** `src/providers/ollama.ts:64-70`; `src/providers/provider-pin.ts:33-46`

**Issue:** IN-12 added `\p{Cf}` to `UNSAFE_TEXT_CHARS` for candidates. Two other places
still filter `\p{Cc}` only:

- Ollama's `oneLine`, which handles a remote server's `error` text that reaches the
  widget's `print -r`.
- The `httpUrl` regex, which checks the `baseUrl` that the picker prints verbatim.

A U+202E in either can still reorder what the terminal shows.

**Fix:** Export one character class from `provider.ts` and reuse it in both places:
replace with a space in `oneLine`, and reject in `httpUrl`.

### IN-16: `.env.local` is still searched above the home directory

**File:** `src/shared/env-file.ts:5-21`, `:79-85`; `README.md:65`

**Issue:** `findUp(homedir(), '.env.local')` also checks `/Users/.env.local` and
`/.env.local`. With `HOME` under `/tmp` (CI, sandboxes, some containers) it also checks a
world-writable `/tmp/.env.local`. A file there can supply `ANTHROPIC_API_KEY`,
`OPENAI_API_KEY` or `QQ_MODEL`, and the user's query and context would then go to another
person's account. No legitimate setup needs a key file above `~`.

**Fix:** For the default, read exactly `join(homedir(), '.env.local')` and keep `findUp`
only for an explicit `startDir`. Update README.md:65 ("and the directories above it").

### IN-17: A retry that runs out of time, or an OpenAI `content_filter` finish, shows the wrong message

**File:** `src/providers/structured-output.ts:92-99`; `src/providers/ollama.ts:90-94`;
`src/providers/openai.ts:308`

**Issue:** The two messages are wrong in different ways:

- **Timeout during the retry.** The retry runs on what is left of the shared signal. If
  the first turn was cut off late and nothing closed, the retry's `TimeoutError` comes up
  as "Ollama did not answer within 25s (the model may still be loading)" or "OpenAI did
  not answer within 25s". The real problem is a cut-off answer.
- **`content_filter`.** OpenAI's `finish_reason: 'content_filter'` counts as a cut-off. It
  is retried silently and then shown as "response was cut off", not as a declined query.

**Fix:** In `candidatesWithCutOffRetry`, when the retry fails with no closed candidates
and the error is not an abort, throw `TRUNCATED_RESPONSE_MESSAGE`. Map `content_filter`
to the existing "OpenAI declined this query" copy, with no retry.

### IN-18: The OpenAI retry ladder does not remember rejected low efforts

**File:** `src/providers/openai.ts:345-350`

**Issue:** Only a rejected `low` is cached (`modelsRejectingDefaultEffort`). A model that
accepts `low` but rejects `none` and `minimal` (the o-series) pays two extra 400 round
trips, out of the shared 25 s, on every cut-off.

**Fix:** Cache the first accepted retry effort per model, or the rejected ones.

### IN-19: A `~` in `QQ_CONFIG_FILE` silently drops the user's privacy patterns

**File:** `src/shared/qq-config.ts:100-106`

**Issue:** A quoted `QQ_CONFIG_FILE='~/qq.json'` is relative, so it resolves to
`$HOME/~/qq.json`. `readConfigFile` treats the missing file as `{}`, so the user's extra
`sensitivePathPatterns` are silently ignored. That is the failure IN-14 set out to close.
`QQ_PROVIDER_FILE`, by contrast, rejects a relative value loudly.

**Fix:** Expand a leading `~/` to `homedir()`, or reject non-absolute values the same way
as `providerPinPath()`. Then log a debug line when an explicit override names a missing
file.

---

_Reviewed: 2026-10-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
