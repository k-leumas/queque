---
phase: "03"
phase_name: "claude-fast-path-and-ranked-suggestions"
review_date: "2026-05-14"
depth: standard
status: fixed
fix_date: "2026-05-14"
files_reviewed: 57
files_reviewed_list:
  - .claude/settings.json
  - .github/workflows/release.yaml
  - .gitignore
  - .releaserc.json
  - .wolf/hooks/_session.json
  - .wolf/hooks/package.json
  - .wolf/hooks/post-read.js
  - .wolf/hooks/post-write.js
  - .wolf/hooks/pre-read.js
  - .wolf/hooks/pre-write.js
  - .wolf/hooks/session-start.js
  - .wolf/hooks/shared.js
  - .wolf/hooks/stop.js
  - package.json
  - scripts/build-dashboard.mjs
  - scripts/esbuild-build.mjs
  - scripts/restart-dev-server.mjs
  - shell/zsh/qq.zsh
  - src/cli/commands/client.ts
  - src/cli/commands/daemon.ts
  - src/cli/main.ts
  - src/client/result-writer.ts
  - src/client/run-foreground.ts
  - src/context/base-context.ts
  - src/context/pipeline.ts
  - src/context/provider.ts
  - src/context/providers/filesystem-context.ts
  - src/context/providers/git-context.ts
  - src/contracts/candidates.ts
  - src/contracts/ipc.ts
  - src/contracts/request.ts
  - src/contracts/shell.ts
  - src/daemon/bootstrap.ts
  - src/daemon/server.ts
  - src/intent/router.ts
  - src/providers/claude.ts
  - src/registry/bootstrap.ts
  - src/registry/context-providers.ts
  - src/registry/provider-backends.ts
  - src/registry/shell-adapters.ts
  - src/registry/storage-hooks.ts
  - src/shared/debug-log.ts
  - src/shared/env-file.ts
  - src/shared/socket-path.ts
  - src/shared/vcs-context.ts
  - src/ui/CandidateSelect.tsx
  - src/ui/ControlsLine.tsx
  - src/ui/LoadingSpinner.tsx
  - src/ui/Modal.tsx
  - src/ui/SearchInput.tsx
  - tests/candidate-select.test.tsx
  - tests/claude-provider.test.ts
  - tests/client-result.test.ts
  - tests/context-pipeline.test.ts
  - tests/daemon-bootstrap.test.ts
  - tests/env-file.test.ts
  - tests/intent-router.test.ts
  - tests/porcelain-parser.test.ts
  - tests/registry-bootstrap.test.ts
  - tests/registry.test.ts
  - tests/zsh-widget.test.ts
  - tsconfig.json
  - vitest.config.ts
findings:
  critical: 7
  warning: 8
  info: 4
  total: 19
---

# Phase 03: Code Review Report — Claude Fast Path and Ranked Suggestions

**Reviewed:** 2026-05-14
**Depth:** standard
**Files Reviewed:** 57
**Status:** issues_found

## Summary

This phase implements the Claude provider adapter, confidence-ranked candidate list, context pipeline, TUI selector (CandidateSelect), and the Zellij FIFO IPC pattern for the zsh widget. The architecture is generally sound, with good separation between the shell transport layer, context gathering, and the provider. The Zod schema contracts are well-defined and provide solid type-safety at boundaries.

The most serious issues are a **stale DEFAULT_MODEL constant** that names a non-existent model ID (causing hard failures when no models are returned from the API), an **unguarded `onSelect` call with a potentially `undefined` command** when the selected index is out of bounds after live filtering, and a **request-file path traversal** vulnerability in the zsh widget where attacker-controlled `req_file` values are passed unquoted to `qq client --request-file`. A denial-of-service gap exists in the daemon server due to the buffer size check position (the buffer can grow past 64 KB before the check fires when a single chunk is abnormally large). The `cwd` field from the shell request is passed directly to `git -C` without path sanitisation. There are also several missing error-handling paths and a systemic absence of timeouts on the Claude API call.

---

## Critical Issues

### CR-001 — Stale DEFAULT_MODEL constant references a non-existent model ID [Critical]

**File:** `src/providers/claude.ts:8`

**Issue:** `DEFAULT_MODEL = 'claude-sonnet-4-0'` is not a valid Anthropic model ID. The correct identifiers use a date suffix (e.g. `claude-sonnet-4-20250514`). When `listAvailableModelIds` returns an empty array (network error, permission error, or test environment), `chooseCheapestAvailableModel` falls through to `availableModelIds[0] ?? DEFAULT_MODEL` and uses this invalid string. The subsequent `client.messages.create({ model: 'claude-sonnet-4-0' })` call will receive a 400/404 error from the API.

**Impact:** Every invocation in a network-degraded environment or from an account without model-list access silently escalates to a guaranteed hard API failure rather than a recoverable fallback.

**Fix:**
```typescript
// Use a valid date-suffixed model ID as the last-resort fallback.
const DEFAULT_MODEL = 'claude-3-haiku-20240307'; // cheapest stable model as safety net
```

---

### CR-002 — Undefined command passed to `onSelect` when selected index is out of bounds [Critical]

**File:** `src/ui/CandidateSelect.tsx:96`

**Issue:** After live filtering changes the visible candidate list, `selectedIndex` may refer to a position beyond the end of `visible`. The expression `visible[selectedIndex]?.command ?? visible[0]?.command` resolves to `undefined` when both `visible[selectedIndex]` and `visible[0]` are absent (i.e. the filtered list is empty). `onSelect(undefined)` is then called, which propagates to `writeShellResult` with `lbuffer: undefined`, failing Zod validation and writing nothing to the FIFO — leaving the zsh widget blocked on the 30-second read timeout.

```typescript
// Line 96 — inside the key.return handler:
onSelect(visible[selectedIndex]?.command ?? visible[0]?.command);
//                                                             ^ undefined when visible is empty
```

**Impact:** If the user types a search query that filters out all candidates and presses Enter, the session hangs for 30 seconds then falls back to cancel. The empty-list guard at line 116 renders a "no matches" message but does NOT prevent the `useInput` handler from firing (both are active simultaneously).

**Fix:** Guard the Enter handler against an empty visible list:
```typescript
if (key.return && candidates) {
  const visible = filterCandidates(candidates, query);
  if (visible.length === 0) return;   // no match — ignore Enter
  onSelect(visible[selectedIndex]?.command ?? visible[0]!.command);
  return;
}
```

---

### CR-003 — `cwd` from shell request passed directly to `git -C` without sanitisation [Critical]

**File:** `src/context/providers/git-context.ts:38`, `src/shared/vcs-context.ts:21`

**Issue:** `input.base.cwd` originates from the shell request JSON file written by the zsh widget using `$PWD`. `$PWD` is normally safe, but the request file path itself (`$req_file`) is created by `mktemp` and is world-writable in `/tmp`. A local attacker who can replace the file before `qq client` reads it can inject an arbitrary `cwd` value. The value is passed to `execFile('git', ['-C', cwd, ...])` — `execFile` (not `exec`) prevents shell injection, but an attacker-controlled `cwd` can point `git` at a malicious `.git/config` containing `core.fsmonitor` or `core.hooksPath` hooks that execute arbitrary code when `git status` or `git rev-parse` runs.

**Impact:** Local privilege escalation or arbitrary code execution if an attacker can race-write to `/tmp/qq-req.*` before the client reads it.

**Fix:** Validate `cwd` in the shell request schema and in `getChangedFiles`/`detectVcsContext` before passing it to git:
```typescript
// In shell.ts schema — add a path constraint:
cwd: z.string().regex(/^\/[^\0]*$/, 'cwd must be an absolute POSIX path'),

// In git-context.ts — additionally verify the path exists and is a directory
// before passing to git -C:
import { statSync } from 'node:fs';
function assertSafeCwd(cwd: string): void {
  let st: ReturnType<typeof statSync>;
  try { st = statSync(cwd); } catch { throw new Error(`cwd not accessible: ${cwd}`); }
  if (!st.isDirectory()) throw new Error(`cwd is not a directory: ${cwd}`);
}
```

---

### CR-004 — Daemon buffer overflow check fires after the oversized chunk is already appended [Critical]

**File:** `src/daemon/server.ts:27-29`

**Issue:** The 64 KB guard check runs **after** `buf += chunk.toString()`. A single TCP chunk that exceeds 64 KB will push `buf` past the limit before the check can fire and destroy the socket. Node.js TCP chunks can be up to ~1 MB.

```typescript
socket.on('data', (chunk) => {
  buf += chunk.toString();        // <-- buf can grow past MAX_BUF_BYTES here
  if (buf.length > MAX_BUF_BYTES) {
    socket.destroy(new Error('IPC message too large'));
    return;
  }
  // ...
});
```

**Impact:** A local client sending a single oversized chunk bypasses the guard. The daemon process allocates unbounded memory for that connection, enabling denial-of-service from any local process that can reach the Unix socket.

**Fix:** Check before appending:
```typescript
socket.on('data', (chunk) => {
  if (buf.length + chunk.length > MAX_BUF_BYTES) {
    socket.destroy(new Error('IPC message too large'));
    return;
  }
  buf += chunk.toString();
  // ...
});
```

---

### CR-005 — No authentication on the Unix socket daemon [Critical]

**File:** `src/daemon/server.ts:20`

**Issue:** The daemon listens on `/tmp/qq-<uid>.sock` with no connection authentication. Any process running as the same user (or root) can connect and send `run-query` messages. While the current `run-query` handler only returns a `query-accepted` response (Phase 3 stub), the architectural comment in `server.ts` implies Phase 4 will execute real LLM calls from this handler. Without a shared secret or credential check, any co-tenant process can trigger LLM API calls charged to the user's Anthropic account.

**Impact:** Unauthorized API consumption. If future `run-query` handling returns command suggestions, a malicious co-tenant process can also inject harmful shell commands into the response stream.

**Fix:** Generate a random session token in `ensureDaemon`, write it to a chmod-600 file in the same `/tmp/qq-<uid>/` directory, and require clients to send it as the first field of every IPC message. Reject connections that do not supply the correct token within the first frame.

---

### CR-006 — `req_file` path injected unquoted into zsh heredoc, enabling JSON field injection [Critical]

**File:** `shell/zsh/qq.zsh:180-189`

**Issue:** The shell request JSON is constructed using a heredoc where `QQ_LBUFFER` and `QQ_RBUFFER` are piped through `jq -Rs .` for safe escaping. However, `$req_file` is derived from `mktemp /tmp/qq-req.XXXXXX` and written to via `cat > "$req_file"` — this is safe. **BUT** the line:

```zsh
zellij run ... -- qq client --request-file "$req_file" --result-file "$fifo_path" &!
```

passes `$req_file` inside double-quotes (`"$req_file"`), which is correct. However, `$fifo_path` is derived from `mktemp -u` — **only the name** is generated, not the actual file. Between `mktemp -u` and `mkfifo`, a symlink attack can redirect `$fifo_path` to an arbitrary path. The client then calls `fsp.stat(resultFile)` (checking `isFIFO()`) and writes to it directly — potentially writing to an attacker-chosen path.

**Impact:** An attacker who can pre-create a symlink at the predicted mktemp path can redirect the result JSON write to an arbitrary file they control (e.g. `~/.zshrc`, authorized_keys), causing a privilege escalation when the shell result is written.

**Fix:** Use `mktemp` for the FIFO path instead of `mktemp -u`, and use O_NOFOLLOW when writing:
```zsh
# Replace mktemp -u with a directory-scoped mktemp inside a mode-700 dir:
local tmpdir
tmpdir=$(mktemp -d /tmp/qq-sess.XXXXXX)
chmod 700 "$tmpdir"
req_file="$tmpdir/request.json"
fifo_path="$tmpdir/result.fifo"
mkfifo "$fifo_path"
```
On the Node side, open the FIFO with `O_NOFOLLOW` or verify `lstat` rather than `stat` returns `isFIFO`.

---

### CR-007 — No timeout on the Claude API call — widget can hang indefinitely [Critical]

**File:** `src/providers/claude.ts:154`

**Issue:** `client.messages.create(...)` has no timeout configured. The Anthropic SDK default timeout is 10 minutes (600 seconds). The zsh widget blocks on `IFS= read -r -t 30 result < "$fifo_path"` with a 30-second timeout — meaning the FIFO read will cancel after 30 seconds and the widget will unblock, but the `fetchCandidates` call and the `qq client` process will continue running for up to 10 minutes, holding the FIFO open. On macOS/Linux, holding a FIFO open after the reader exits causes the writer's next `writeFile` to block indefinitely (broken pipe only fires when all readers close). This means the Node process does NOT clean up after the widget times out.

**Impact:** Zombie `qq client` processes accumulate after every API timeout. Each holds file descriptors and consumes Anthropic API credit.

**Fix:**
```typescript
const response = await client.messages.create({
  model,
  max_tokens: 256,
  temperature: 0,
  system: '...',
  messages: [{ role: 'user', content: prompt }],
}, {
  timeout: 25_000,  // 25s — slightly under the zsh 30s FIFO timeout
});
```
Also add a `SIGTERM` handler in `runForegroundClient` to abort the fetch and write a cancel result if the process is killed.

---

## Warnings

### WR-001 — `readEnvValueFromDotEnvLocal` is synchronous and called on every request [Warning]

**File:** `src/providers/claude.ts:67`, `src/providers/claude.ts:116`, `src/shared/env-file.ts:53`

**Issue:** `readEnvValueFromDotEnvLocal` performs synchronous filesystem traversal (`existsSync`, `readFileSync`) inside `shouldForceSelector()`, `getCandidateModels()`, and `fetchCandidates()`. These are called on every query. On a cold filesystem, this can add tens of milliseconds and block the event loop.

**Fix:** Cache the result per process lifetime since `.env.local` does not change during a session:
```typescript
let envCache: Map<string, string | null> | undefined;
export function readEnvValueFromDotEnvLocal(key: string, startDir?: string): string | null {
  if (!envCache) {
    envCache = new Map();
    // ... perform filesystem read once ...
  }
  return envCache.get(key) ?? null;
}
```

---

### WR-002 — `bootstrapBuiltins()` is called inside `gatherContext()` on every request [Warning]

**File:** `src/context/pipeline.ts:9`

**Issue:** `bootstrapBuiltins()` is called at the top of `gatherContext()` on every invocation. While the `bootstrapped` flag makes repeated calls no-ops, the function still executes the guard check and function call overhead every time. More seriously, if `resetBootstrap()` is called in tests without a corresponding `clearContextProviders()`, the second `bootstrapBuiltins()` call in the same process will throw "Context provider already registered" — this is caught in tests but would be fatal in production if `resetBootstrap` were ever called outside tests.

**Fix:** Move `bootstrapBuiltins()` to the application entry point (`src/cli/main.ts`) and remove it from `gatherContext()`. This also makes the dependency explicit rather than hidden inside a pipeline function.

---

### WR-003 — TOCTOU race in `ensureDaemon` unlinking the socket not documented as a known limitation [Warning]

**File:** `src/daemon/bootstrap.ts:96-107`

**Issue:** The code correctly documents the TOCTOU window between `tryConnect` failure and `unlinkSync`. However, the comment says "acceptable for MVP (single active session assumed)" while the CI workflow runs tests in parallel via vitest. Two test workers that both call `ensureDaemon` with the same socket path will race: one may unlink the other's live socket. The test suite also creates sockets in `/tmp/qq-test-*` directories but the socket path validation in `assertSafeSocketPath` requires the path to match `/tmp/qq-*.sock` — test paths like `/tmp/qq-test-abc123/qq-test.sock` pass the prefix check but would be rejected by the `.startsWith('qq-')` check on the basename.

**Impact:** Tests that call `ensureDaemon` with a path like `/tmp/qq-server-test-abc/qq-server.sock` (seen in `daemon-bootstrap.test.ts`) will fail the `assertSafeSocketPath` validation because `basename` is `qq-server.sock` — this starts with `qq-` and ends with `.sock`, so it actually passes. However, the containing directory is not checked, meaning the guard is weaker than it appears (it only checks the filename, not the full path uniqueness).

**Fix:** Also validate that the path's parent directory is `/tmp` or `/private/tmp` exactly (no nested paths):
```typescript
const dir = path.dirname(resolved);
if (!tmpRoots.includes(dir)) {
  throw new Error(`unsafe socket path rejected: ${socketPath}`);
}
```

---

### WR-004 — `parsePorcelainLine` does not handle git's NUL-terminated `-z` format [Warning]

**File:** `src/context/providers/git-context.ts:38`

**Issue:** `getChangedFiles` calls `git status --porcelain` (without `-z`). When filenames contain newlines (valid on Linux), `--porcelain` output becomes ambiguous. Additionally, git encloses filenames containing special characters in double-quotes and uses C-style escape sequences (e.g. `\303\251` for é). The `stripQuotes` helper only strips the outer `"` characters but does NOT unescape the interior — so files with non-ASCII names will be stored with C-escape sequences instead of the actual filename.

**Impact:** `changedFiles` in the context payload will contain garbled filenames for any files with non-ASCII characters in their names. The prompt sent to Claude will include incorrect filenames.

**Fix:** Use `git status --porcelain=v1 -z` and split on NUL, OR implement proper C-string unescaping:
```typescript
function unescapeGitPath(s: string): string {
  return s.replace(/\\([0-7]{3})/g, (_, oct) =>
    String.fromCodePoint(parseInt(oct, 8))
  ).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
}
```

---

### WR-005 — `onSelect` and `onCancel` callbacks in CandidateSelect are not guarded against double-invocation [Warning]

**File:** `src/client/run-foreground.ts:139-150`, `src/ui/CandidateSelect.tsx:65-99`

**Issue:** The `onSelect` and `onCancel` callbacks call `unmount?.()` after writing the shell result. Between the `writeShellResult` await completing and `unmount()` being called, the user can press another key (Escape, Enter) that triggers the handler again. Because `unmount` is set from the `app` returned by `render()`, and `rerender()` keeps the component mounted, a second keypress fires `onSelect` or `onCancel` a second time — calling `writeShellResult` again on the already-written FIFO. The second write to a FIFO whose reader has exited produces a SIGPIPE/EPIPE error that is currently unhandled.

**Fix:** Track whether a selection has been made and short-circuit:
```typescript
let resolved = false;
const safeSelect = async (command: string) => {
  if (resolved) return;
  resolved = true;
  await writeShellResult(resultFile, { kind: 'replace-buffer', lbuffer: command, rbuffer: request.rbuffer });
  unmount?.();
};
```

---

### WR-006 — Debug log path defaults to world-writable `/tmp/qq-debug.log` [Warning]

**File:** `src/shared/debug-log.ts:3`

**Issue:** When `QQ_DEBUG_LOG_FILE` is not set, logs are written to `/tmp/qq-debug.log`. This is world-readable and world-writable. Debug logs include `requestFile`, `resultFile`, `socketPath`, `lbuffer` content, and `rbuffer` content. While `ANTHROPIC_API_KEY` itself is not logged, the `lbuffer` may contain sensitive command text (passwords in arguments, tokens, etc.).

**Fix:** Default to a user-private path:
```typescript
export const debugLogPath =
  process.env.QQ_DEBUG_LOG_FILE ??
  `/tmp/qq-${process.getuid?.() ?? 'unknown'}-debug.log`;
```
And create the log file with mode 0600:
```typescript
await fsp.appendFile(debugLogPath, line, { encoding: 'utf-8', mode: 0o600 });
```

---

### WR-007 — `suggestShellResult` uses only the first candidate, making the ranked list vestigial [Warning]

**File:** `src/providers/claude.ts:185-197`

**Issue:** `suggestShellResult` is exported but takes only `candidates[0]?.command`. It bypasses the entire ranked candidate list. This function is not called by the current `run-foreground.ts` (which correctly uses `fetchCandidates` and shows the TUI), but it remains exported and could be called by future code, silently discarding the ranking work. The `command` field can also be `undefined` if Claude returns an empty candidate list that passes schema validation (minimum 1 candidate is enforced by Zod, but `candidates[0]` can still be undefined if the array is mutated after parse).

**Fix:** Either remove `suggestShellResult` (it is not used in Phase 3), or guard against an empty list:
```typescript
const command = candidates[0]?.command;
if (!command) throw new Error('No candidate returned by provider');
```

---

### WR-008 — `scripts/esbuild-build.mjs` references paths for a different project [Warning]

**File:** `scripts/esbuild-build.mjs:13-33`

**Issue:** This script references `project-files/`, `manifest.json`, `domains.json`, icon paths, `src/options.html`, `sync-provider-icons.mjs`, and `dotenv` — none of which exist in this repository. It also imports `dotenv` which is not in `package.json`. This appears to be a stale file copied from a browser extension project.

**Impact:** Running `node scripts/esbuild-build.mjs` will crash immediately. The script being present in the repo creates confusion and will fail if any automation accidentally invokes it.

**Fix:** Remove `scripts/esbuild-build.mjs` from the repository, or replace it with the correct tsup-based build wrapper if a custom build script is needed.

---

## Info

### IN-001 — `DEFAULT_MODEL` in `CHEAPEST_FIRST_MODEL_IDS` list inconsistency [Info]

**File:** `src/providers/claude.ts:10-17`

**Issue:** `CHEAPEST_FIRST_MODEL_IDS` contains `'claude-sonnet-4-20250514'` and `'claude-opus-4-20250514'` but the `DEFAULT_MODEL` fallback (line 8) is `'claude-sonnet-4-0'` — a non-date-suffixed alias that is distinct from any model in the ranked list. The intended fallback appears to be the cheapest entry in `CHEAPEST_FIRST_MODEL_IDS` (`claude-3-haiku-20240307`), but the code uses a separate constant that was never updated.

**Fix:** Remove `DEFAULT_MODEL` and use `CHEAPEST_FIRST_MODEL_IDS.at(-1) ?? 'claude-3-haiku-20240307'` as the fallback in `chooseCheapestAvailableModel`.

---

### IN-002 — `qq-question-widget` defines `_qq_cleanup` as a nested function on every trigger [Info]

**File:** `shell/zsh/qq.zsh:167`

**Issue:** `_qq_cleanup` is re-defined as a local-scope function body inside `qq-question-widget` on every `??` trigger. In zsh, nested function definitions inside other functions are not lexically scoped — they pollute the global function namespace. If the user triggers `??` twice before the first FIFO read resolves (unlikely but possible with fast keystrokes before the Zellij pane opens), the second trigger redefines `_qq_cleanup` over the first, changing what the first trigger's EXIT trap will remove.

**Fix:** Define `_qq_cleanup` as a top-level function with parameters:
```zsh
_qq_cleanup() {
  local req="$1" fifo="$2"
  rm -f "$req" "$fifo"
  trap - EXIT ERR INT
}
trap "_qq_cleanup '$req_file' '$fifo_path'" EXIT ERR INT
```

---

### IN-003 — Ink `render` mock in `client-result.test.ts` does not exercise `rerender` path [Info]

**File:** `tests/client-result.test.ts:83-103`

**Issue:** The ink `render` mock immediately invokes `onSelect` via `Promise.resolve().then(...)` in the initial render. This bypasses the `rerender` call that happens when `fetchCandidates` resolves (line 166 of `run-foreground.ts`). The mock's `rerender` is a `vi.fn()` that does nothing, so the test never exercises the real candidate-arrival render path. A bug in the `rerender` invocation (wrong element shape, missing prop) would not be caught.

**Fix:** Update the mock so `rerender` captures the new element and invokes `onSelect` from the updated candidates:
```typescript
render: vi.fn().mockImplementation((element) => {
  let currentElement = element;
  return {
    unmount: vi.fn(),
    rerender: vi.fn().mockImplementation((newEl) => {
      currentElement = newEl;
      const { onSelect, candidates } = currentElement.props;
      if (onSelect && candidates) {
        Promise.resolve().then(() => onSelect(candidates[0]?.command ?? 'git status'));
      }
    }),
  };
}),
```

---

### IN-004 — `src/cli/commands/client.ts:27` defaults unknown `--result-mode` to `cancel` but logs to `console.error` [Info]

**File:** `src/cli/commands/client.ts:27-31`

**Issue:** Unknown `--result-mode` values fall through to `cancel` with a `console.error` warning. This is the correct safe default, but `console.error` output goes to the TTY and may corrupt the Zellij pane's visual state before Ink renders. The warning should go to the debug log instead.

**Fix:**
```typescript
void appendDebugLog('client', `unknown --result-mode "${mode}", defaulting to cancel`);
return 'cancel';
```

---

_Reviewed: 2026-05-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
