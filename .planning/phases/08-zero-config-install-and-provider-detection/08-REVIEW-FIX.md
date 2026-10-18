---
phase: 08-zero-config-install-and-provider-detection
fixed_at: 2026-10-18T02:28:03Z
review_path: .planning/phases/08-zero-config-install-and-provider-detection/08-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 8: Code Review Fix Report

**Fixed at:** 2026-10-18T02:28:03Z
**Source review:** .planning/phases/08-zero-config-install-and-provider-detection/08-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (CR-01, WR-01..WR-08; IN-* left alone per fix_scope critical_warning)
- Fixed: 9
- Skipped: 0

Every fix landed as its own `fix(08): … (<ID>)` commit on `main`, in the main checkout (no
worktree; `.wolf/` files left unstaged for the orchestrator). Each one has a regression test.
Before each commit, `pnpm exec biome check <changed files>` and `pnpm typecheck` passed and
the commit hooks ran (no `--no-verify`).

## Fixed Issues

### CR-01: A daemon from before the pin passes the capability check

**Files modified:** `src/contracts/ipc.ts`, `src/daemon/server.ts`, `src/daemon/bootstrap.ts`, `tests/daemon-bootstrap.test.ts`
**Commit:** 1321da8
**Applied fix:** The pong schema gains `providerPin: z.literal(true).optional()`. The daemon
now advertises it, and `pingDaemonFetchCap` requires it alongside the three v0.6.0 flags, so
`ensureDaemon` replaces any daemon that ignores provider.json. Docstrings now say that routing
changes, and not only envelope shape changes, need a pong flag. Regression test: a pong with
only `fetchCandidates`/`installedTools`/`streamCandidates` returns `no` and gets replaced. The
"keep" test and the server pong test now expect all four flags.

### WR-01: Every unclassified `claude -p` failure is reported as "not authenticated"

**Files modified:** `src/providers/claude-default.ts`, `tests/claude-cli-provider.test.ts`, `README.md`
**Commit:** b8ebddb
**Applied fix:** `D13_MESSAGE` is now returned only when `isAuthFailure` matches. Every other
failure gets the static `CLI_FAILED_MESSAGE`: "QueQue: Claude Code could not answer (claude -p
failed). Try ?? again; run `claude -p "hi"` to see the error." It never contains raw stdout
and never mentions `qq init provider`. Regression test: an is-error 529 overload and an
`exit-without-result` both get the neutral copy, without "not authenticated", the picker
hint, or the upstream text. The README now documents this message.

### WR-02: Re-running the picker drops a saved `baseUrl` or OpenAI `model`

**Files modified:** `src/cli/commands/init-provider.ts`, `tests/init-provider.test.ts`
**Commit:** b634962
**Applied fix:** `pickAndSave` loads the pin once and passes it to `describeCurrent`.
`keptPinFields()` reads a previous Ollama `baseUrl` or OpenAI `model`.
`PickerDeps.listOllamaModels` now takes `baseUrl`. The picker lists models from the saved
`baseUrl`, keeps it in the new Ollama pin, keeps the OpenAI `model` when OpenAI is picked
again, and names the probed URL in `explainOllamaDown`. Four regression tests: the remote
baseUrl is kept and probed, a down remote Ollama is named (not localhost) and the old pin
stays, the OpenAI model is kept, and an OpenAI model is not carried into an Ollama pin.

### WR-03: An empty or relative `QQ_PROVIDER_FILE` resolves to "absent"

**Files modified:** `src/providers/provider-pin.ts`, `tests/provider-pin.test.ts`, `README.md`, `docs/EXTENSIONS.md`
**Commit:** 2834ebb
**Applied fix:** `providerPinPath()` now uses the override only when it is non-empty after
`trim()`. `loadProviderPin()` returns `invalid` ("QQ_PROVIDER_FILE must be an absolute path")
for a non-absolute path, so `resolveProviderAdapter` throws and never falls back to Claude.
`writeProviderPin()` refuses to write a pin at a relative path. Regression tests: `''` and
`'   '` fall back to the default path; an empty override reads the default pin (HOME is
pointed at a temp dir, so the real file is never touched); a relative override is `invalid`
and throws instead of resolving Claude; the writer refuses a relative path and writes
nothing. The docs now say the path must be absolute.

### WR-04: Remote Ollama text and pin model names reach the terminal with control bytes

**Files modified:** `src/providers/provider.ts`, `src/providers/ollama.ts`, `src/providers/openai.ts`, `src/providers/provider-pin.ts`, `tests/provider-pin.test.ts`, `tests/ollama-provider.test.ts`, `tests/openai-provider.test.ts`
**Commit:** 4887a00
**Applied fix:** Ollama's `oneLine()` replaces `\p{Cc}` (C0, DEL, C1) with spaces before it
collapses whitespace and caps the length. The pin `modelName` schema rejects control
characters. The review's optional suggestion is also applied: a new
`stripTerminalControls()` in provider.ts removes control bytes other than tab and newline
from the `command` and `explanation` of OpenAI and Ollama candidates. A candidate left empty
is dropped, and if none remain the parseCandidates placeholder is returned. Claude adapters
are unchanged. Regression tests: an ESC/BEL/C1/CR error field leaves no `\p{Cc}` in the
message; pins with ESC or C1 in the model are invalid; candidates from Ollama and OpenAI are
stripped, and a multi-line command keeps its newline.

### WR-05: The prose fallback can turn a local model's thinking or prose into one "command"

**Files modified:** `src/providers/claude.ts`, `src/providers/ollama.ts`, `src/providers/openai.ts`, `tests/ollama-provider.test.ts`, `tests/openai-provider.test.ts`
**Commit:** 3cedfce
**Status:** fixed: requires human verification (this is logic and parsing behavior)
**Applied fix:** This uses the review's documented alternative. The new
`finalCandidateListWithoutProse(text, finishedNormally, logFields)` in claude.ts removes
`<think>…</think>` blocks, tries the strict parse (a code fence is allowed), then takes the
closed candidate objects of the first `[ {` array. If it finds none, a cut-off answer throws
`TRUNCATED_RESPONSE_MESSAGE` and a normal stop throws `UNPARSEABLE_RESPONSE_MESSAGE`; the
adapters map the latter to their existing "unexpected response" copy. Raw text never becomes
a candidate. Claude's `finalCandidateList` is unchanged. Regression tests: a prose-wrapped
json fence, a leading `<think>` block with brackets, a trailing comment, and brackets in the
prose before the array all yield the real candidate. Prose-only answers from Ollama and
OpenAI give "unexpected response" and no command.
**Not applied (deliberately):** the request-side constraints (Ollama `format` with a JSON
schema plus `think: false`, OpenAI `response_format: json_schema`). The context7 MCP tools
were not available in this session, so these parameters could not be checked against
current docs. They also carry compatibility risk that needs a design decision: `think` on
models without thinking support, gpt-oss needing level strings, `json_schema` on a hand-set
older OpenAI `model`, and OpenAI strict mode requiring an object root (`{candidates:[…]}`)
plus a prompt change. The parser change closes the safety hole on its own. Request-side
constraints are a follow-up to improve answer quality.

### WR-06: Ollama `baseUrl` path prefixes are dropped; a wrong URL looks like "model not installed"

**Files modified:** `src/providers/ollama.ts`, `tests/ollama-provider.test.ts`, `tests/init-provider.test.ts`, `docs/EXTENSIONS.md`
**Commit:** 2584448
**Applied fix:** The new exported `ollamaApiUrl(baseUrl, 'api/chat' | 'api/tags')` joins
paths relative to the base (adding a trailing `/` when missing), in both the chat request and
`listOllamaModels`. On a 404, the `ollama pull` copy appears only when the JSON `error` field
mentions `model`. Any other 404 reports "Ollama returned HTTP 404 from <origin>. Check
"baseUrl" in provider.json…". Regression tests: three baseUrl forms (prefix, prefix plus
slash, root plus slash) give the right `/api/chat` URL; an HTML proxy 404 and an unrelated
JSON 404 name the URL, not `ollama pull`; `listOllamaModels` keeps the prefix. The existing
model-not-found 404 test still passes.

### WR-07: `restartDaemon` depends on `lsof`; without it the old daemon is orphaned

**Files modified:** `src/contracts/ipc.ts`, `src/daemon/server.ts`, `src/daemon/bootstrap.ts`, `src/cli/commands/daemon.ts`, `tests/daemon-bootstrap.test.ts`
**Commit:** 789b50d
**Applied fix:** Adds the IPC request `{kind:'shutdown'}` and the response
`{kind:'shutdown-accepted'}`. `startDaemonServer(socketPath, { onShutdown })` acknowledges
the request and calls `onShutdown` after the ack is flushed. `daemonCommand` connects it to
the same `shutdownDaemon` path that SIGTERM uses (prewarm retired, in-flight connections
destroyed). A server with no handler ignores the request. The new
`requestDaemonShutdown()` (500 ms ack timeout) runs first in `replaceStaleListener`, which
then waits for the socket to stop accepting. The `lsof` SIGTERM/SIGKILL path stays as the
fallback for older daemons. The docstrings now say a restart cuts `??` fetches in flight in
other terminals. Tests: the new "restartDaemon stops a current daemon over IPC, without lsof"
uses a real `startDaemonServer` in the vitest pid, which lsof never signals, and asserts
`currentServer.listening === false` and that `exit` ran. `requestDaemonShutdown` is false for
a server without a handler. The old test was renamed to say what it proves ("unlinks a
daemon that ignores shutdown and spawns once"). No pong flag is needed: older daemons simply
fall back to lsof.

### WR-08: The OpenAI key check and the daemon's `.env.local` source depend on the picker's cwd

**Files modified:** `src/daemon/bootstrap.ts`, `src/cli/commands/init-provider.ts`, `tests/init-provider.test.ts`, `tests/daemon-bootstrap.test.ts`, `README.md`, `CONTRIBUTING.md`
**Commit:** cfe36ab
**Status:** fixed: requires human verification (behavior change, see note)
**Applied fix:** `spawnDaemon` now spawns with `cwd: homedir()`, so every daemon (ensure or
restart) finds `.env.local` from the home directory. `openAiKeyPresent()` looks up `.env.local`
from `homedir()` too, so the picker accepts only a key the daemon will also find. The key
missing copy says `~/.env.local`. README lines 65 and 83 and CONTRIBUTING's dev-variable
paragraph are updated. Regression tests: spawn options carry `cwd === homedir()`, and the
picker calls `readEnvValueFromDotEnvLocal('OPENAI_API_KEY', homedir())`.
**Note for the human:** a developer who kept `QQ_FORCE_SELECTOR`, `QQ_MODEL` or a key in the
repo's `.env.local` no longer has it reach the daemon; it must go in `~/.env.local` or the
environment. The client's in-process fallback (daemon down) still reads `.env.local` from the
shell's cwd, which is now the only remaining cwd-dependent key source. Changing the default
`startDir` of `readEnvValueFromDotEnvLocal` would close it, but it is a wider design change
and was not made.

## Verification

- Ran in the **main checkout** (`/Users/samuel/dev/tui-llm`, branch `main`), so results can
  be reproduced from this tree.
- After each fix: biome check on the changed files, `pnpm typecheck`, and the affected vitest
  files with `--maxWorkers=1`.
- Final combined pass of 12 suites (client-result, daemon-fetch, registry-bootstrap,
  provider-resolver, steering, daemon-bootstrap, init-provider, provider-pin, ollama-provider,
  openai-provider, claude-cli-provider, claude-provider): 355/355 passed.
- Full suite (`pnpm exec vitest run --maxWorkers=1`, main checkout, after all 9 commits):
  42 files, 962/962 tests passed, exit 0.

## OpenWolf entries (deferred)

For the orchestrator to apply (this fixer did not stage `.wolf/`):

**anatomy.md** (restore curated descriptions if the post-write hook rewrote them):
- `src/providers/provider.ts`: add `stripTerminalControls(list)` (WR-04: drops C0/DEL/C1
  except tab and newline from non-Claude candidates).
- `src/providers/claude.ts`: add `finalCandidateListWithoutProse`, `UNPARSEABLE_RESPONSE_MESSAGE`
  (WR-05 final-list rule for Ollama and OpenAI, with no prose fallback).
- `src/providers/ollama.ts`: add `ollamaApiUrl(baseUrl, path)` (relative join that keeps a
  proxy prefix), 404 model-vs-URL split, control-byte-safe `oneLine`.
- `src/daemon/bootstrap.ts`: add `requestDaemonShutdown()` (IPC shutdown before the lsof
  fallback). Pong now requires `providerPin`. Daemon spawned with `cwd: homedir()`.
- `src/daemon/server.ts`: `startDaemonServer(socketPath, { onShutdown })`, `shutdown` request,
  `providerPin` pong flag.
- `src/contracts/ipc.ts`: `shutdown` request, `shutdown-accepted` response, `providerPin` pong flag.
- `src/cli/commands/init-provider.ts`: `keptPinFields()`, and `listOllamaModels(baseUrl)` dep.

**cerebrum.md, Key Learnings:**
- [2026-10-17] Pong flags: `providerPin` is the fourth (after fetchCandidates, installedTools,
  streamCandidates). Daemon ROUTING changes need a pong flag too, not only envelope shape
  changes: a v0.6.0 daemon passed the 3-flag check and sent Ollama-pinned prompts to Claude
  (08 CR-01).
- [2026-10-17] `restartDaemon` / `replaceStaleListener` first send IPC `{kind:'shutdown'}`
  (ack `shutdown-accepted`, 500 ms). `lsof` is only the fallback for older daemons. Tests can
  prove a stop by running `startDaemonServer` in the vitest pid (lsof never signals it) and
  asserting `server.listening === false`.
- [2026-10-17] The daemon always spawns with `cwd: homedir()` (08 WR-08), so its `.env.local`
  is `~/.env.local` (or one above `~`). A repo `.env.local` reaches only the client's
  in-process fallback. The picker's OpenAI key check uses `readEnvValueFromDotEnvLocal(key,
  homedir())`.
- [2026-10-17] Ollama and OpenAI use `finalCandidateListWithoutProse` (no prose fallback;
  strips `<think>`, scans the first `[ {` array). Their candidates go through
  `stripTerminalControls`. Claude keeps `finalCandidateList`.
- [2026-10-17] `QQ_PROVIDER_FILE`: empty means unset, and a relative path is an invalid pin
  (fail closed); the writer refuses a relative path.
- [2026-10-17] The context7 MCP tools may not be exposed to subagents. When a fix needs
  verified request parameters (Ollama `format`/`think`, OpenAI `response_format`), defer it
  rather than guess.

**cerebrum.md, Do-Not-Repeat:**
- [2026-10-17] Do not end an error-mapping function with the most specific copy as the
  fall-through (claude-default `hardError` returned D13 "not authenticated" for every
  failure, which made the isAuthFailure branch dead code). The fall-through must be the
  neutral copy.
- [2026-10-17] Do not join API paths with `new URL('/api/x', base)`: the absolute path drops
  the base's path prefix (reverse proxies). Ensure a trailing `/` and join `api/x` relatively.

**buglog.json** (one entry per fix; drop any hook `auto-detected` entries):
- CR-01 `src/daemon/bootstrap.ts`: old daemon kept and ignored provider.json; added the `providerPin` pong flag. Tags: daemon, ipc, capability, privacy.
- WR-01 `src/providers/claude-default.ts`: every claude -p failure showed the D13 login copy; neutral `CLI_FAILED_MESSAGE` added. Tags: error-copy, claude-cli.
- WR-02 `src/cli/commands/init-provider.ts`: picker re-run dropped baseUrl/model; `keptPinFields`. Tags: picker, provider-pin.
- WR-03 `src/providers/provider-pin.ts`: `??` on `QQ_PROVIDER_FILE`, so empty/relative paths resolved to Claude; trim and isAbsolute check. Tags: env, fail-closed, privacy.
- WR-04 `src/providers/ollama.ts`: control bytes from a remote server reached the terminal; strip `\p{Cc}`. Tags: terminal-injection, security.
- WR-05 `src/providers/claude.ts`: prose fallback turned local-model prose into a command; `finalCandidateListWithoutProse`. Tags: parsing, ollama, openai.
- WR-06 `src/providers/ollama.ts`: baseUrl prefix dropped, and a proxy 404 reported as a missing model; `ollamaApiUrl`. Tags: url, ollama.
- WR-07 `src/daemon/bootstrap.ts`: restart orphaned the daemon without lsof; IPC shutdown. Tags: daemon, lsof, linux.
- WR-08 `src/daemon/bootstrap.ts`: key source depended on the spawn cwd; `cwd: homedir()`. Tags: env-file, daemon, privacy.

---

_Fixed: 2026-10-18T02:28:03Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
