---
phase: 08-zero-config-install-and-provider-detection
reviewed: 2026-10-17T00:00:00Z
depth: standard
iteration: 2
diff_base: 29d34f5
files_reviewed: 20
files_reviewed_list:
  - src/cli/commands/daemon.ts
  - src/cli/commands/init-provider.ts
  - src/contracts/ipc.ts
  - src/daemon/bootstrap.ts
  - src/daemon/server.ts
  - src/providers/claude-default.ts
  - src/providers/claude.ts
  - src/providers/ollama.ts
  - src/providers/openai.ts
  - src/providers/provider-pin.ts
  - src/providers/provider.ts
  - tests/claude-cli-provider.test.ts
  - tests/daemon-bootstrap.test.ts
  - tests/init-provider.test.ts
  - tests/ollama-provider.test.ts
  - tests/openai-provider.test.ts
  - tests/provider-pin.test.ts
  - docs/EXTENSIONS.md
  - README.md
  - CONTRIBUTING.md
findings:
  critical: 0
  warning: 4
  info: 14
  total: 18
status: issues_found
---

# Phase 8: Code Review Report (iteration 2, re-review of fixes 1321da8..cfe36ab)

**Reviewed:** 2026-10-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

Iteration 1 of this report is in git history at 29d34f5. This iteration re-reviews the nine
fix commits (CR-01, WR-01..WR-08) and re-checks IN-01..IN-08 against the current code.

## Narrative Findings (AI reviewer)

## Summary

I traced each fix into its callers and callees: `candidate-stream.ts` (scanner and strict
parse), `env-file.ts` (`findUp`, the per-process cache), `fetch-client.ts` (the in-process
fallback), `run-foreground.ts` and `main.ts` (the global `uncaughtException` handler),
`socket-path.ts`, and `qq-config.ts`. I checked two edge cases with a scratch script against
the real modules: `finalCandidateListWithoutProse` with an orphan `</think>` and with a cut-off
`<think>`, and `ollamaApiUrl` with a query string. I also checked Node's `spawn` with a cwd
that does not exist.

### Resolved since iteration 1

All nine in-scope findings are fixed as described in 08-REVIEW-FIX.md:

- **CR-01:** the pong now carries `providerPin`, and `pingDaemonFetchCap` requires it, so a
  v0.6.0 daemon is replaced.
- **WR-01:** `D13_MESSAGE` now appears only when `isAuthFailure` matches; every other failure
  gets the neutral copy.
- **WR-02:** a re-run keeps the saved `baseUrl` and OpenAI `model`, and the picker probes the
  saved URL.
- **WR-03:** an empty `QQ_PROVIDER_FILE` counts as unset, and a relative one is an invalid pin.
- **WR-04:** control bytes are removed from Ollama error text and from non-Claude candidates,
  and the pin `model` rejects them.
- **WR-05:** the prose fallback no longer runs for Ollama or OpenAI.
- **WR-06:** the path prefix in `baseUrl` is kept, and a 404 that is not about the model names
  the URL.
- **WR-07:** an IPC `shutdown` runs first, and `lsof` is only the fallback.
- **WR-08:** the daemon is spawned with `cwd: homedir()`.

I found no race in the new `shutdown` wiring. The `await startDaemonServer` continuation runs
as a microtask before any socket `data` event, so `onShutdownRequest` is set before a request
can arrive.

None of IN-01..IN-08 was in the fix scope, and all eight still apply. They are carried forward
below with their original IDs and updated line numbers.

Several fixes leave gaps or add new ones:

- **WR-05:** a draft array from an unfinished `<think>` block can still become a command
  (WR-09).
- **WR-08:** the daemon is fixed, but three gaps remain:
  - The in-process fallback still prefers a project's `.env.local` (WR-10).
  - Every runtime error message still points users at a bare `.env.local`, which the daemon
    now ignores (WR-11).
  - The fixed cwd turns a missing home directory into a crash on every `??` (WR-12).

## Warnings

### WR-09: A draft candidate from an unclosed `<think>` block or an orphan `</think>` becomes the command

**File:** `src/providers/claude.ts:532`, `:551-560`

**Issue:** `THINK_BLOCK_RE = /<think>[\s\S]*?<\/think>/gi` removes only complete pairs. Then
`finalCandidateListWithoutProse` returns the closed objects of the first `[ {` array in what
is left. Two common shapes from local reasoning models leave thinking text in place:

- **Cut-off thinking** (`done_reason` / `finish_reason` other than `stop`). There is no
  `</think>`, so the whole thinking text survives. Any draft array in it is returned as the
  answer. Before this fix that case threw `TRUNCATED_RESPONSE_MESSAGE` only when no object had
  closed. Now a closed draft object wins.
- **Orphan `</think>`.** Some chat templates put `<think>` in the prompt, so the model's output
  starts inside the thinking and has only the closing tag. The regex removes nothing, and the
  first array is the draft, not the final answer after `</think>`.

Checked against the real module:

```
finalCandidateListWithoutProse('Draft: [{"command":"rm -rf ~/build",...}] no wait, safer.\n</think>\n[{"command":"ls build",...}]', true)
  -> [{"command":"rm -rf ~/build","explanation":"draft"}]
finalCandidateListWithoutProse('<think>Maybe [{"command":"git reset --hard",...}] hmm, but that loses', false)
  -> [{"command":"git reset --hard","explanation":"draft"}]
```

The user is shown a command the model had already rejected, sometimes a destructive one.
WR-05 was meant to stop exactly this kind of non-answer text from becoming a command. The only
think-block test (`tests/ollama-provider.test.ts:455`) uses a complete pair.

**Fix:** Keep only the text after the last `</think>`, and drop an unclosed `<think>` through
to the end of the text:

```ts
function stripThinking(text: string): string {
  const close = text.toLowerCase().lastIndexOf('</think>');
  const afterClose = close === -1 ? text : text.slice(close + '</think>'.length);
  return afterClose.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, ' ');
}
// const answer = stripThinking(text);
```

Add tests for the orphan-close case and the truncated-open case. The truncated one must
throw `TRUNCATED_RESPONSE_MESSAGE`.

### WR-10: The in-process fallback still reads keys from the shell's directory, so a project's `.env.local` key is used whenever the daemon is down

**File:** `src/providers/openai.ts:38-43`, `src/providers/claude-default.ts:71-76`,
`src/providers/claude.ts:96`, `:218`, `:301`, `src/daemon/fetch-client.ts:201`

**Issue:** WR-08 fixed the key source for the daemon only. `fetchCandidatesForUi` falls back to
`resolveProviderAdapter().fetchCandidates()` inside the foreground client. Its cwd is the
shell's cwd. Every adapter there calls `readEnvValueFromDotEnvLocal(key)` with the default
`startDir = process.cwd()`. `findUp` returns the nearest `.env.local`, so a project's file
takes precedence over `~/.env.local`. The fallback runs after a daemon crash, after a
`restartDaemon` timeout, or while a replacement daemon is still starting. On that path the
privacy problem WR-08 described still happens: a project or employer `OPENAI_API_KEY` or
`ANTHROPIC_API_KEY` is used silently. The user's query, cwd and git metadata then go to that
account. `QQ_MODEL` and `QQ_FORCE_SELECTOR` also differ between the two paths, so one `??`
can behave differently from the next.

The docs disagree with each other. CONTRIBUTING.md:118 says a repo `.env.local` "reaches only
the in-process fallback". README.md:65 says only "a `.env.local` inside a project directory is
not used by the daemon" and does not mention that the fallback uses it.

**Fix:** Give the shared helper the same fixed start directory the daemon uses, so the daemon
and the fallback read the same file:

```ts
// src/shared/env-file.ts
export function readEnvValueFromDotEnvLocal(key: string, startDir = homedir()): string | null
```

Then drop the explicit `homedir()` in `init-provider.ts:192`. Also update `detect.ts:64`,
which assumes `process.cwd()`. Tests that rely on a cwd `.env.local` must pass `startDir`.

### WR-11: Runtime error copy and docs still say `.env.local`, which the daemon no longer reads from the project directory

**File:** `src/providers/claude-default.ts:17`, `:20`, `:30`; `src/providers/openai.ts:155`;
`src/providers/claude.ts:303`; `README.md:57`, `:69`, `:98`; `docs/EXTENSIONS.md:20`, `:114`

**Issue:** WR-08 changed only `OPENAI_KEY_MISSING` in the picker to say `~/.env.local`. These
`??` errors still say "set ANTHROPIC_API_KEY in the environment or .env.local" or "Export it
(or add it to .env.local)":

- the D13 message
- the ENOENT message
- the timeout message
- the OpenAI missing-key message

A user who follows that advice in a project directory creates `./.env.local`. The daemon
(cwd `~`) never sees it, so every `??` keeps failing with the same message. Because of WR-10,
it can also work once while the daemon is down and then fail again. README lines 57, 69 and
98 and EXTENSIONS lines 20 and 114 also say a bare `.env.local`.

**Fix:** Change every message and doc mention to `~/.env.local`, for example:

```ts
const D13_MESSAGE =
  'QueQue: Claude is not authenticated. Run `claude /login`, or set ANTHROPIC_API_KEY in the environment or ~/.env.local. To use OpenAI or Ollama instead, run `qq init provider`.';
```

Update the README sample at line 57 to match the new copy. Add a test that no copy in
`claude-default.ts` or `openai.ts` contains ` .env.local` without the `~/`.

### WR-12: `cwd: homedir()` crashes the client on every `??` when the home directory does not exist

**File:** `src/daemon/bootstrap.ts:270-276`

**Issue:** `spawnDaemon` now passes `cwd: homedir()` and attaches no `'error'` listener to the
child. When `$HOME` names a directory that does not exist, `spawn` does not throw. It emits
`'error'` asynchronously with the misleading message `spawn /path/to/node ENOENT`. This happens
for some service accounts, containers with `HOME=/nonexistent`, and sandboxes. The
`try`/`catch` around `ensureDaemon` cannot catch that event, so it reaches `main.ts:50`
(`uncaughtException`). That handler writes `{"kind":"cancel"}` and exits 1. Before WR-08 the
cwd was inherited and always existed, so this setup worked, through the daemon or the
in-process fallback. Now every `??` and every `qq daemon --ensure` prewarm dies, and the
in-process fallback never runs. I confirmed this with Node 24: a spawn with
`cwd: '/nonexistent-dir-xyz'` gives `Unhandled 'error' event ... spawn .../node ENOENT`.

**Fix:** Fall back to a directory that exists, and never leave the child without an error
listener:

```ts
const home = homedir();
const cwd = home && fs.existsSync(home) ? home : '/';
const child = spawn(qqBin, [qqScript, 'daemon', '--socket', socketPath], {
  cwd,
  detached: true,
  stdio: 'ignore',
});
child.on('error', (error) => {
  void appendDebugLog('daemon', 'spawn failed', { code: (error as NodeJS.ErrnoException).code });
});
child.unref();
```

`waitForSocket` then times out and `ensureDaemon` throws a normal error, which the client
handles with the in-process fallback.

## Info

### IN-01: The "Bound lazily" comment is wrong (carried forward)

**File:** `src/cli/commands/init-provider.ts:88-94` (imports at `:8-9`)

**Issue:** This is unchanged. `restartDaemon` and `listOllamaModels` are static top-level
imports, so `daemon/bootstrap.ts` and `providers/ollama.ts` are evaluated on every `qq` run.
The wrappers delay only the calls.

**Fix:** Correct the comment, or use `await import()` inside the wrappers.

### IN-02: `describeIssues` echoes key names from the file with no length cap or escaping (carried forward)

**File:** `src/providers/provider-pin.ts:95-103`

**Issue:** This is unchanged. Unknown key names come from the file and flow into the
fetch-error message, the daemon debug log (`server.ts:182`) and the terminal, with no cap and
no control-character filtering.

**Fix:** Cap the joined reason, for example at 120 characters, and replace `\p{Cc}`. Or report
`unknown key(s)` with only a count.

### IN-03: If `chmodSync` fails after the rename, the picker says "No changes made" although the new pin is live (carried forward)

**File:** `src/providers/provider-pin.ts:163-172`

**Issue:** This is unchanged. The `chmodSync(target, 0o600)` on line 165 is redundant, because
the temp file is created with `mode: 0o600, flag: 'wx'`. If it throws after the rename, the
caller reports failure even though the new pin is already in place.

**Fix:** Drop the `chmodSync`, or move it before the rename.

### IN-04: The log and error text contradict the "never the base URL" claim (carried forward)

**File:** `src/providers/ollama.ts:126-128` (docstring), `:84`, `:88`, `:191`;
`src/daemon/server.ts:182`

**Issue:** This is unchanged, and WR-06 added another case. The new HTTP 404 message on line
191 includes `origin`, and the daemon logs every fetch-error `message`. The docstring still
says debug lines never carry the base URL.

**Fix:** Make the docstring match what is actually logged, or drop `message` from
`replied fetch-error`.

### IN-05: An invalid header value for the OpenAI key is reported as "could not reach api.openai.com" (carried forward)

**File:** `src/providers/openai.ts:120-124`

**Issue:** This is unchanged. A key with an embedded newline or a non-Latin-1 character makes
undici throw `TypeError` before any I/O. That error is mapped to a connectivity message.

**Fix:** Check the key against `/^[\x21-\x7e]+$/` before the request and report
"OPENAI_API_KEY contains invalid characters".

### IN-06: The README still describes streaming and cancellation as Claude-only (carried forward)

**File:** `README.md:120`, `:122`

**Issue:** This is unchanged. "Rows stream in as Claude answers" and "It stops the request to
Claude" are wrong for an OpenAI or Ollama pin.

**Fix:** Say "as the provider answers", and note that only Claude streams rows today.

### IN-07: Auth failures on the API-key path never get the `qq init provider` pointer (carried forward)

**File:** `src/providers/claude-default.ts:107-113`

**Issue:** This is unchanged. The SDK branch returns `fetchSdkCandidates(...)` directly, so a
401 or 403 for a bad `ANTHROPIC_API_KEY` reaches the user as the raw SDK error.

**Fix:** Map SDK `APIError.status` 401/403 to a static line that names the key and `qq init
provider`. Pass AbortError through unchanged.

### IN-08: A plain-`http` `baseUrl` is accepted for any host (carried forward)

**File:** `src/providers/provider-pin.ts:29-39`; `README.md:152`

**Issue:** This is unchanged. For a non-loopback host, the context crosses the network in
cleartext, and the README privacy section does not say so.

**Fix:** Document it, or require `https:` unless the host is loopback.

### IN-09: The picker gives no way back from a saved remote `baseUrl`, and gives local-install advice when that remote is down

**File:** `src/cli/commands/init-provider.ts:226-229`, `:337-338`

**Issue:** WR-02 keeps `ollamaBaseUrl` on every Ollama re-pick, so the picker can no longer
pin the default localhost server. The user has to edit provider.json by hand. If the remote
server is down, `explainOllamaDown` says "Install it from https://ollama.com/download, start it
with `ollama serve`" and offers to open the download page. Neither step helps with a remote
host. The README (line 84) still describes only the local case.

**Fix:** When `baseUrl` is set and unreachable, say "Check that the Ollama server at <url> is
running, or remove "baseUrl" from provider.json to use this machine", and skip the
download-page prompt.

### IN-10: The picker prints the raw `baseUrl`, which the schema does not check for control characters or credentials

**File:** `src/cli/commands/init-provider.ts:226`, `:353`; `src/providers/provider-pin.ts:29-39`

**Issue:** WR-02 added two places that print the stored `baseUrl` string verbatim to /dev/tty.
`httpUrl` only checks that `new URL(value)` parses. The WHATWG parser percent-encodes an ESC in
the path, but the stored raw string keeps it. WR-04 applied the no-`\p{Cc}` rule to `model` but
not to `baseUrl`. A `http://user:pass@host` URL is also accepted and then printed in full,
although `fetch` rejects URLs with credentials. That URL can never work, and the picker
reports it as "not answering".

**Fix:** In `httpUrl`, reject `\p{Cc}`, `username` and `password`. Or print
`new URL(baseUrl).origin + pathname` instead of the raw string.

### IN-11: `ollamaApiUrl` drops the path prefix when `baseUrl` has a query string or fragment

**File:** `src/providers/ollama.ts:97-100`

**Issue:** The trailing `/` is appended to the whole string, so it ends up inside the query or
fragment. The relative join then resolves against the parent of the last path segment.
Checked: `ollamaApiUrl('http://h/ollama?x=1', 'api/chat')` and
`ollamaApiUrl('http://h/ollama#f', 'api/chat')` both give `http://h/api/chat`. The WR-06 bug
is back for those inputs, and the schema allows them.

**Fix:** Build the URL from parts:

```ts
const url = new URL(baseUrl);
url.pathname = `${url.pathname.replace(/\/+$/, '')}/${path}`;
url.search = '';
url.hash = '';
return url;
```

Or reject `search` and `hash` in `httpUrl`.

### IN-12: `stripTerminalControls` leaves bidi and format characters, and the Claude paths are not sanitized at all

**File:** `src/providers/provider.ts:41`, `:51-61`; `src/providers/claude.ts:154-172`

**Issue:** The filter removes only `\p{Cc}`. Format characters (`\p{Cf}`) are kept: U+202E
RIGHT-TO-LEFT OVERRIDE, U+2066..U+2069 isolates, and zero-width characters. They can make a
command look different from what will run, both in the Ink list and in the zsh buffer. The
threat model is the same as WR-04: a remote or plain-http Ollama. Claude candidates go through
no filter at all, and a JSON `\u001b` from prompt-injected context (file or branch names)
would reach Ink as a raw ESC.

**Fix:** Remove `[\p{Cc}\p{Cf}]` except tab and newline, and apply `stripTerminalControls` in
the Claude final-list and streamed-row paths too.

### IN-13: When every command is empty after the filter, `stripTerminalControls` returns an `echo ""` placeholder row instead of the adapters' "unexpected response" error

**File:** `src/providers/provider.ts:59-61`

**Issue:** WR-05 changed Ollama and OpenAI so that an unusable answer raises "returned an
unexpected response" and never shows as a candidate. An answer whose commands contain only
control bytes now shows a selectable `echo ""` row labelled "unexpected response format".
That is the old parseCandidates behavior.

**Fix:** Throw `UNPARSEABLE_RESPONSE_MESSAGE` when `cleaned` is empty. The adapters already map
it to their own error copy.

### IN-14: `QQ_CONFIG_FILE` still has the WR-03 bug, and WR-08 made a relative value resolve differently in the daemon

**File:** `src/shared/qq-config.ts:95`

**Issue:** `process.env.QQ_CONFIG_FILE ?? join(...)` has the same `??` problem WR-03 fixed for
`QQ_PROVIDER_FILE`. An exported empty value reads `''` and silently falls back to the
defaults, which can drop a user's extra privacy redaction patterns. The daemon now always runs
in `~`. A relative value therefore resolves to different files in the daemon and in the
foreground client.

**Fix:** Apply the same rule as `providerPinPath()`: trim, treat empty as unset, and reject or
resolve a non-absolute path explicitly.

---

_Reviewed: 2026-10-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
