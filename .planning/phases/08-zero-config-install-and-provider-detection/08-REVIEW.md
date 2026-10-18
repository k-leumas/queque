---
phase: 08-zero-config-install-and-provider-detection
reviewed: 2026-10-17T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - src/providers/provider-pin.ts
  - src/providers/ollama.ts
  - src/providers/openai.ts
  - src/providers/claude-default.ts
  - src/providers/resolver.ts
  - src/registry/bootstrap.ts
  - src/daemon/server.ts
  - src/daemon/fetch-client.ts
  - src/daemon/bootstrap.ts
  - src/cli/commands/init-provider.ts
  - src/cli/main.ts
  - tests/provider-pin.test.ts
  - tests/ollama-provider.test.ts
  - tests/openai-provider.test.ts
  - tests/init-provider.test.ts
  - tests/daemon-fetch.test.ts
  - tests/daemon-bootstrap.test.ts
  - tests/registry-bootstrap.test.ts
  - tests/claude-cli-provider.test.ts
  - tests/provider-resolver.test.ts
  - docs/EXTENSIONS.md
  - README.md
findings:
  critical: 1
  warning: 8
  info: 8
  total: 17
status: issues_found
---

# Phase 8: Code Review Report (gap closure 08-03..08-06)

**Reviewed:** 2026-10-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

This report replaces the earlier 08-REVIEW.md for 08-01/08-02 (commit 35c18ef). That version
is still in git history.

## Summary

The review covered the provider.json pin (strict versioned union), the Ollama and OpenAI
adapters, the `qq init provider` picker on /dev/tty, the daemon restart, the Claude-default
failure copy, and the docs. I traced each piece into its callers and callees: `claude.ts`
finalCandidateList and the prose fallback, `env-file.ts`, `socket-path.ts`, `debug-log.ts`,
`cli/commands/daemon.ts`, `contracts/ipc.ts`, `contracts/candidates.ts`, `client/run-foreground.ts`
and the zsh widget's `error` branch.

These parts hold up:

- The schema keeps secrets out. Unknown keys fail closed.
- OpenAI has no `baseUrl`, so a pin cannot send the key to another host.
- The OpenAI error path never reads `error.message`.
- The 0600 `wx` temp file plus rename is sound.
- An invalid pin raises fetch-error on both the daemon and the in-process path.
- The picker writes nothing to stdout.

The main gap is upgrade compatibility. A daemon from v0.6.0 (or any other build from before
the pin) passes the current pong capability check. It is kept running and ignores provider.json,
so an Ollama-pinned user's prompts still go to Claude. That breaks the phase's central
privacy rule. Secondary issues:

- Generic `claude -p` failures are reported as "not authenticated".
- Re-running the picker silently drops a saved `baseUrl` or `model`.
- An empty or relative `QQ_PROVIDER_FILE` resolves to "absent", which means Claude.
- Text from a remote Ollama server reaches the terminal without its escape bytes removed.
- The prose fallback was designed for Claude. It now applies to local models that wrap
  their JSON in other text.
- The restart depends on `lsof`.
- The `.env.local` key source depends on the directory the picker ran in.

## Critical Issues

### CR-01: A daemon from before the pin passes the capability check, ignores provider.json and keeps sending prompts to Claude

**File:** `src/daemon/bootstrap.ts:98-102`, `src/daemon/server.ts:86-91`, `src/contracts/ipc.ts:38-43`

**Issue:** `pingDaemonFetchCap()` treats a daemon as current when its pong has
`fetchCandidates`, `installedTools` and `streamCandidates`. All three flags already shipped
in v0.6.0 (commit ef5a734). That daemon resolves the Claude default unconditionally and never
reads provider.json. Nothing restarts the daemon on upgrade: there is no brew hook, the
widget's `_qq_prewarm_daemon` runs `qq daemon --ensure`, and the client calls
`ensureDaemon()`. So after `brew upgrade` the detached old daemon keeps serving every `??`.

Any pin that does not go through the picker's `restartDaemon()` is ignored by that old
daemon. That includes:

- a provider.json edited by hand, which the README advertises: "plain JSON you can edit by
  hand, and QueQue reads it again on every `??`"
- an `ollama` pin from dotfiles
- an invalid pin, which must fail closed

The old daemon sends the user's query, cwd and git metadata to Anthropic. This is exactly
what D-01/D-02 and the `resolveProviderAdapter()` docstring promise never happens ("a
local-only user's prompt is not sent to a hosted provider"). The project's own rule
("only envelope SHAPE changes need a pong flag") does not cover this change, because the
daemon's routing semantics changed, not the envelope shape.

**Fix:** Advertise and require a new capability, so `ensureDaemon()` replaces any daemon
that cannot honor the pin:

```ts
// src/contracts/ipc.ts (pong)
// Daemon resolves the adapter from provider.json on every fetch (Phase 8, 08-03).
providerPin: z.literal(true).optional(),

// src/daemon/server.ts (ping reply)
writeJson({ kind: 'pong', fetchCandidates: true, installedTools: true,
            streamCandidates: true, providerPin: true });

// src/daemon/bootstrap.ts pingDaemonFetchCap
const current =
  response.data.fetchCandidates === true &&
  response.data.installedTools === true &&
  response.data.streamCandidates === true &&
  response.data.providerPin === true;
```

Add a daemon-bootstrap test where a pong with only the three v0.6.0 flags is replaced.

## Warnings

### WR-01: Every unclassified `claude -p` failure is reported as "not authenticated" and sends the user to `qq init provider`

**File:** `src/providers/claude-default.ts:71-86`

**Issue:** `hardError()` returns `D13_MESSAGE` in two cases: when `isAuthFailure()` matches,
and also in the unconditional fall-through on line 85. The `isAuthFailure` branch is
therefore dead code. `claude-process.ts` reports `is_error` results with the result text in
`stdout`, for example "API Error: 529 Overloaded", "usage limit reached", or a network error.
Those also reach this fall-through, as do `invalid-result` and `exit-without-result`. The
user is told "Claude is not authenticated … To use OpenAI or Ollama instead, run `qq init
provider`" for a transient outage or a quota problem. 08-06 added the switch-provider pointer
to this copy, so a misdiagnosis now pushes users to re-pin their provider.

**Fix:** Keep `D13_MESSAGE` for `isAuthFailure(error)` only. Give everything else a neutral
line that names the failure class (never the raw stdout):

```ts
if (isAuthFailure(error)) return new Error(D13_MESSAGE);
return new Error(
  'QueQue: Claude Code could not answer (claude -p failed). Try ?? again; run `claude -p "hi"` to see the error.',
);
```

### WR-02: Re-running the picker drops a saved `baseUrl` or OpenAI `model`, and only ever probes localhost

**File:** `src/cli/commands/init-provider.ts:206-229`, `:285`, `:297`

**Issue:** `pickOllamaModel()` always calls `listOllamaModels()` with the default
`http://localhost:11434`. `savePin()` then writes `{version, provider:'ollama', model}` with
no `baseUrl`. Some users follow the picker's own advice ("Using a remote Ollama? Add
\"baseUrl\" to provider.json") and later re-run the picker to change models. Their pin is
rewritten without `baseUrl`. The next `??` goes to localhost, which either fails or reaches
a different server. A remote-only user with no local Ollama gets "Ollama is not answering at
http://localhost:11434" and cannot use the picker at all. Choosing OpenAI behaves the same
way: line 285 overwrites a hand-set `"model"` with the default. `describeCurrent()` has
already read the current pin, but the picker discards those fields.

**Fix:** Load the current pin once. Pass `baseUrl` to `listOllamaModels(baseUrl)` and keep it
in the new Ollama pin. Keep `model` when the user re-picks OpenAI:

```ts
const current = loadProviderPin();
const prevOllamaUrl =
  current.kind === 'pinned' && current.pin.provider === 'ollama' ? current.pin.baseUrl : undefined;
// listOllamaModels: () => listOllamaModels(prevOllamaUrl ?? OLLAMA_DEFAULT_BASE_URL)
// savePin(prompter, { version: 1, provider: 'ollama', model, ...(prevOllamaUrl ? { baseUrl: prevOllamaUrl } : {}) })
```

Also print the URL that was probed in `explainOllamaDown()`.

### WR-03: An empty or relative `QQ_PROVIDER_FILE` resolves to "absent", so the prompt goes to Claude

**File:** `src/providers/provider-pin.ts:72-74`, `:99-104`

**Issue:** `providerPinPath()` uses `process.env.QQ_PROVIDER_FILE ?? default`, the same
mistake as the 2026-08-26 Do-Not-Repeat entry about `??` and `ANTHROPIC_API_KEY`.

- **Empty value.** An exported empty string is used as the path. `readFileSync('')` throws
  ENOENT, which counts as `absent`, which means the Claude default.
- **Relative value.** A relative path is resolved against each process's own cwd. The
  picker writes it relative to where it ran, and the daemon `restartDaemon()` spawns shares
  that cwd. But a daemon that `ensureDaemon()` spawns later from another terminal, or the
  client's in-process fallback from any other directory, sees ENOENT, then `absent`, then
  Claude.

In both cases a user who set up a local-only pin has their prompts sent to the hosted
default, with no error.

**Fix:** Use the override only when it is non-empty, and treat a non-absolute override as an
invalid pin instead of absent:

```ts
export function providerPinPath(): string {
  const override = process.env.QQ_PROVIDER_FILE?.trim();
  return override ? override : join(homedir(), '.config', 'qq', 'provider.json');
}
// in loadProviderPin, before reading:
if (!isAbsolute(path)) return { kind: 'invalid', path, message: 'QQ_PROVIDER_FILE must be an absolute path' };
```

### WR-04: Text from a remote Ollama server and model names from the pin reach the terminal with control bytes intact

**File:** `src/providers/ollama.ts:39-42`, `:79-89`, `:150-152`; `src/providers/provider-pin.ts:20`; `src/cli/commands/init-provider.ts:178-179`

**Issue:** `oneLine()` collapses only `\s`. It leaves ESC (0x1b), BEL and the C1 bytes in
place. `readErrorDetail()` embeds the server's `error` field in the fetch-error message.
That message goes through IPC to the FIFO, and the widget prints it with `print -r --`
(queque.zsh:288), so the bytes reach the terminal untouched. With `baseUrl` pointing at a
remote host over plain `http:`, which the schema allows for any host, a malicious server or
an on-path attacker can inject terminal escape sequences. Examples are OSC 52 clipboard
writes and screen or title rewriting.

`listOllamaModels()` already strips control bytes from model names "printed on the user's
tty", so the threat is known. It is just not applied here. The pin's `modelName` schema
also accepts control bytes. That name is echoed raw in the Ollama 404 message
(`ollama pull ${settings.model}`, line 151) and in the picker's `Current:` line.

Candidate `command`/`explanation` text has the same exposure: `commandCandidateSchema`
accepts control bytes. Claude was the only source of that text until this phase.

**Fix:** Strip `\p{Cc}` (and C1) in `oneLine()` before capping. Reject control bytes in the
pin schema's `modelName`, using the same rule as `listableModelName`. Consider applying the
same filter to candidates from non-Claude adapters.

```ts
function oneLine(text: string): string {
  const flat = text.replace(/[\p{Cc}]/gu, ' ').replace(/\s+/g, ' ').trim();
  return flat.length > MAX_ERROR_DETAIL ? `${flat.slice(0, MAX_ERROR_DETAIL)}…` : flat;
}
const modelName = z.string().trim().min(1).max(200).regex(/^[^\p{Cc}]+$/u);
```

### WR-05: The prose fallback can turn a local model's thinking text or prose into one "command"

**File:** `src/providers/ollama.ts:131-139`, `:177-180`; `src/providers/openai.ts:171-177`, `:222-227`; (callee) `src/providers/claude.ts:124-132`

**Issue:** Both adapters pass `finishedNormally = (done_reason|finish_reason === 'stop')`
into `finalCandidateList()`. When the strict parse fails after a normal stop,
`parseCandidates()` treats the entire text as a single command. Claude follows the "raw
JSON array only" instruction reliably. Many Ollama models do not. Common answers are:

- "Here are some commands:\n```json …```", which `stripCodeFence` rejects because the text
  is not fence-only
- a `<think>…</think>` block before the array
- a trailing comment after the array

Each becomes one multi-line candidate full of prose, which can be placed into the shell
buffer. Neither request asks the backend to constrain its output: Ollama's `format`
(JSON schema) is unused, and so are `think: false` and OpenAI's `response_format`.

**Fix:**

- Ollama: send `format` with the candidate-array JSON schema and `think: false`.
- OpenAI: send `response_format: {type:'json_schema', …}`. Its root must be an object, for
  example `{candidates:[…]}`, so unwrap it before validating.
- Alternatively, or in addition, give these adapters a variant of `finalCandidateList`
  without the prose fallback. Keep the closed candidates or throw "unexpected response",
  never the raw text.

### WR-06: Ollama `baseUrl` path prefixes are dropped, and a wrong URL is reported as "model not installed"

**File:** `src/providers/ollama.ts:114`, `:149-153`, `:244`

**Issue:** `new URL('/api/chat', settings.baseUrl)` resolves an absolute path, so the base's
path is discarded. For example, `https://gpu.lan/ollama/` becomes `https://gpu.lan/api/chat`.
A reverse-proxied Ollama, which is a common remote setup, gets requests for the wrong path.
The proxy's 404 then surfaces as "Ollama model 'x' is not installed. Run `ollama pull x`",
which is the wrong fix. The docs only say "http or https only", so nothing warns the user.

**Fix:** Join paths relative to the base:

```ts
const base = settings.baseUrl.endsWith('/') ? settings.baseUrl : `${settings.baseUrl}/`;
const url = new URL('api/chat', base);
```

Use the same join in `listOllamaModels`. Only claim "model not installed" when the 404 body's
`error` mentions the model; otherwise report "HTTP 404 from <origin>".

### WR-07: `restartDaemon` depends on `lsof`; without it the old daemon is orphaned, and the test does not notice

**File:** `src/daemon/bootstrap.ts:127-141`, `:151-184`, `:214-226`; `tests/daemon-bootstrap.test.ts:238-275`

**Issue:** `restartDaemon()` signals only the pids that `lsof -t <socket>` returns. If `lsof`
is missing, which is common on minimal Linux and the bash/Linux secondary target,
`listenerPids()` returns `[]`. The code then unlinks the socket path and spawns a new
daemon. The old daemon keeps running on an unlinked inode and can never be reached or
stopped. Each `qq init provider` leaks one daemon, along with its prewarm pool.

The test "restartDaemon replaces a current daemon" passes for the same reason: the "current"
server lives in the vitest pid, which is never signalled. The test proves only that the path
was unlinked, and asserts nothing about the old listener stopping. The restart also cuts
in-flight `??` fetches in other terminals. That is acceptable, but it is not documented.

**Fix:** Stop the daemon through IPC rather than through `lsof`. Add a `{kind:'shutdown'}`
request that runs `shutdownDaemon()`, or record the daemon pid in a 0600 pid file next to
the socket. Keep `lsof` only as a fallback. In the test, assert that the old server stopped
listening (`currentServer.listening === false` after a shutdown request), or name the test
for what it actually proves.

### WR-08: The OpenAI key check and the daemon's `.env.local` source depend on the directory the picker ran in

**File:** `src/cli/commands/init-provider.ts:185-191`, `:281-285`; `src/daemon/bootstrap.ts:196-199`; (callee) `src/shared/env-file.ts:73-89`; `README.md:65`, `:83`

**Issue:** `openAiKeyPresent()` searches upward for `.env.local` from the picker's
`process.cwd()`. `restartDaemon()` spawns the daemon in the same cwd, so this works at
first. That stops being true in three ways:

- The pin outlives the daemon. After a reboot or a crash, `ensureDaemon()` spawns from the
  current terminal's directory. That directory has no `.env.local`, so every `??` fails with
  "OPENAI_API_KEY is not set" even though the picker accepted the key.
- Running the picker inside a project whose `.env.local` holds that project's or employer's
  `OPENAI_API_KEY` quietly routes all of the user's shell queries, with their cwd and git
  metadata, to that organization's account.
- The README's "directory your first terminal opened in" (line 65) is no longer accurate.

**Fix:** For the picker, accept only an exported `OPENAI_API_KEY`. Or name the `.env.local`
file that was found and warn that it is tied to that directory. Spawn the restarted daemon
with a fixed `cwd` (for example `homedir()`) so the key source is the same however the
daemon started. Update README lines 65 and 83 to match.

## Info

### IN-01: The "Bound lazily" comment is wrong

**File:** `src/cli/commands/init-provider.ts:86-92` (imports at `:7-8`)

**Issue:** The comment says loading this module "must not touch the daemon or provider
imports until the picker uses them". But `restartDaemon` and `listOllamaModels` are static
top-level imports, so `main.ts` evaluates `daemon/bootstrap.ts` and `providers/ollama.ts`
on every `qq` run. The wrappers delay only the calls.

**Fix:** Correct the comment, or use `await import()` inside the wrappers if lazy loading is
actually needed.

### IN-02: `describeIssues` echoes key names from the file with no length cap or escaping

**File:** `src/providers/provider-pin.ts:79-81`

**Issue:** Key names are file content. A long key, or one with control bytes, flows into the
fetch-error message, the daemon debug log (server.ts:157) and the terminal. This contradicts
the "never from file values" comment.

**Fix:** Cap the joined reason (for example at 120 characters) and replace control
characters, or report `unknown key(s)` with only a count.

### IN-03: If `chmodSync` fails after the rename, the picker says "No changes made" although the new pin is live

**File:** `src/providers/provider-pin.ts:136-147`

**Issue:** The file is already created with mode 0600 (`wx`), and umask can only remove
bits, so the post-rename `chmodSync` is redundant. If it throws, the catch reports failure
after the target was already replaced.

**Fix:** Drop the `chmodSync`, or move it before the rename (use `fchmod` on the temp fd).

### IN-04: The log and error text contradict the "never the base URL" claim

**File:** `src/providers/ollama.ts:94-96`, `:70-76`; `src/daemon/server.ts:157`; `tests/provider-pin.test.ts:210-214`

**Issue:** The fetch-error message includes the `baseUrl` origin and the model, and the
daemon logs every fetch-error message. `ollama request` also logs `model`, while the
provider-pin test treats the model name as content that must stay out of logs. None of
this is a secret, but the docstrings overclaim.

**Fix:** Align the comments with what is actually logged, or drop `message` from
`replied fetch-error`.

### IN-05: An invalid header value for the OpenAI key is reported as "could not reach api.openai.com"

**File:** `src/providers/openai.ts:115-119`

**Issue:** A key with an embedded newline, or a non-Latin-1 character from a `.env.local`
quoting slip, makes undici reject with `TypeError` before any network I/O. The message
names a connectivity problem. No key leaks, because `error.message` is not used.

**Fix:** Check the key against `/^[\x21-\x7e]+$/` before the request and report "OPENAI_API_KEY
contains invalid characters".

### IN-06: The README still describes streaming and cancellation as Claude-only

**File:** `README.md:120-122`

**Issue:** "Rows stream in as Claude answers" and "It stops the request to Claude" no longer
hold for an OpenAI or Ollama pin. Those adapters send no rows before the final list.

**Fix:** Say "as the provider answers", and note that only Claude streams rows today.

### IN-07: Auth failures on the API-key path never get the `qq init provider` pointer

**File:** `src/providers/claude-default.ts:97-104`

**Issue:** The SDK branch rethrows raw SDK errors (for example `401 {…authentication_error…}`).
The 08-06 failure copy therefore covers only `/login` users, not users with a bad
`ANTHROPIC_API_KEY`.

**Fix:** Map SDK 401/403 (`APIError.status`) to a static line that names the key and `qq init
provider`. Pass AbortError through unchanged, as today.

### IN-08: A plain-`http` `baseUrl` is accepted for any host

**File:** `src/providers/provider-pin.ts:22-32`; `README.md:152`

**Issue:** For a non-loopback host, the context (query, cwd, git branch, changed file names)
crosses the network in cleartext. This is a defensible choice, but it is not documented.

**Fix:** Document it in the README privacy section, or require `https:` unless the host is
loopback.

---

_Reviewed: 2026-10-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
