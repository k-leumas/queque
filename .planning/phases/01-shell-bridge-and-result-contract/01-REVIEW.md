---
phase: 01-shell-bridge-and-result-contract
reviewed: 2026-05-01T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - shell/zsh/qq.zsh
  - src/cli/commands/client.ts
  - src/cli/commands/daemon.ts
  - src/cli/main.ts
  - src/client/result-writer.ts
  - src/client/run-foreground.ts
  - src/contracts/ipc.ts
  - src/contracts/shell.ts
  - src/daemon/bootstrap.ts
  - src/daemon/server.ts
  - src/shared/socket-path.ts
  - tests/client-result.test.ts
  - tests/daemon-bootstrap.test.ts
  - tests/shell-contract.test.ts
  - tests/zsh-widget.test.ts
  - package.json
  - tsconfig.json
  - tsup.config.ts
  - vitest.config.ts
findings:
  critical: 3
  warning: 5
  info: 4
  total: 12
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

The Phase 1 shell bridge and result contract is well-structured. The split-buffer design (`lbuffer`/`rbuffer`) correctly sidesteps the Node/zsh UTF-16 vs character-oriented cursor mismatch. The Zod schemas enforce the contract at runtime on both sides, and the temp-file exchange pattern between zsh and the Node process is sound.

Three critical issues were found: shell injection in the zsh JSON construction block, a path traversal opening in the daemon spawning path, and an unbounded buffer accumulation in the daemon's per-socket data handler. Five warnings cover race conditions, error-handling gaps, and type-safety loose ends. Four info items note minor quality concerns.

---

## Critical Issues

### CR-01: Shell injection in zsh JSON construction via unquoted `$PWD` and `$tty_path`

**File:** `shell/zsh/qq.zsh:113-122`

**Issue:** The heredoc block directly interpolates `$tty_path` and `$PWD` into a JSON string without any escaping. If either value contains a double-quote, backslash, newline, or JSON-special character (e.g. a directory named `foo"bar` or a TTY path returned by a misbehaving `tty` command), the produced JSON will be malformed or, worse, allow the injected bytes to reinterpret adjacent JSON structure. `lbuffer` and `rbuffer` are correctly routed through `jq -Rs .`, but the two unescaped fields undercut the otherwise-safe pattern.

```zsh
# Vulnerable — $tty_path and $PWD are interpolated raw:
cat > "$req_file" <<JSON
{
  "ttyPath": "$tty_path",
  "cwd": "$PWD",
  ...
}
JSON

# Fix — pipe every scalar through jq -Rs . (or printf '%s' | jq -Rs .):
local tty_json cwd_json
tty_json=$(printf '%s' "$tty_path" | jq -Rs .)
cwd_json=$(printf '%s' "$PWD"      | jq -Rs .)

cat > "$req_file" <<JSON
{
  "version": 1,
  "ttyPath": $tty_json,
  "cwd": $cwd_json,
  "shellPid": $$,
  "lbuffer": $(printf '%s' "$QQ_LBUFFER" | jq -Rs .),
  "rbuffer": $(printf '%s' "$QQ_RBUFFER"  | jq -Rs .)
}
JSON
```

---

### CR-02: Path traversal / arbitrary script execution in daemon bootstrap

**File:** `src/daemon/bootstrap.ts:72-76`

**Issue:** `ensureDaemon` constructs `qqScript` using `import.meta.url` resolved through `new URL('../../cli/main.js', import.meta.url).pathname`. The `socketPath` argument, however, is passed directly as a CLI argument without validation. While `socketPath` comes from `socketPathForUid` in the normal flow, `ensureDaemon` is a public export that accepts any string. A caller-supplied path containing shell metacharacters would be passed verbatim to `spawn` as the `--socket` argument value — `spawn` uses an array so shell interpretation does not apply there — but the socket path itself lands in `/tmp` only by convention. A path like `../../../../etc/qq.sock` would be accepted and the daemon would start listening on an arbitrary filesystem location, including directories writable by other users.

The issue is that `ensureDaemon` performs no path validation on `socketPath` before passing it to `spawn` and before calling `fs.unlinkSync` on it. `fs.unlinkSync` on an attacker-controlled path is a denial-of-service / file deletion primitive.

```typescript
// Fix: validate socketPath is within /tmp and matches the expected pattern
// before using it in unlinkSync or passing to spawn.
import * as path from 'node:path';

function assertSafeSocketPath(socketPath: string): void {
  const resolved = path.resolve(socketPath);
  if (!resolved.startsWith('/tmp/qq-') || !resolved.endsWith('.sock')) {
    throw new Error(`Unsafe socket path rejected: ${socketPath}`);
  }
}

export async function ensureDaemon(socketPath: string): Promise<void> {
  assertSafeSocketPath(socketPath);
  // ... rest of function unchanged
}
```

---

### CR-03: Unbounded buffer growth in daemon socket data handler

**File:** `src/daemon/server.ts:20-22`

**Issue:** The per-connection `buf` string is appended from every `data` event with no size cap. A client (or a rogue process that has write access to the socket) can stream data without ever sending a newline, causing `buf` to grow without bound until Node's heap is exhausted. The daemon is a long-lived background process, making this a memory exhaustion / denial-of-service risk.

```typescript
// Fix: enforce a maximum per-connection buffer size and destroy the socket if exceeded.
const MAX_BUF_BYTES = 64 * 1024; // 64 KB is generous for any realistic IPC message

socket.on('data', (chunk) => {
  buf += chunk.toString();

  if (buf.length > MAX_BUF_BYTES) {
    socket.destroy(new Error('IPC message too large'));
    return;
  }

  // ... existing newline parsing loop
});
```

---

## Warnings

### WR-01: Race condition in daemon bootstrap — TOCTOU between tryConnect and unlinkSync

**File:** `src/daemon/bootstrap.ts:61-69`

**Issue:** After the initial `tryConnect` fails, the code calls `fs.unlinkSync(socketPath)` synchronously. Between the failed connect and the unlink there is a window in which another process (a concurrent `ensureDaemon` call from a second terminal tab, for example) may have already started a new daemon and be listening on the socket. The unlink would then destroy the live socket of the newly-started daemon. This is unlikely during the MVP but the window is real for multi-tab terminal workflows.

**Fix:** Use `fs.rmSync` inside the spawn's `mockImplementation` path only after confirming the second connect attempt also fails, or use a file-based lock (e.g. a `.lock` file with O_EXCL) before the unlink/spawn sequence. For the MVP, at minimum add a comment documenting the TOCTOU and that a lock will be needed before multi-window use.

---

### WR-02: Daemon bootstrap `qqScript` path is resolved at module-load time, not at call time — breaks when dist layout differs

**File:** `src/daemon/bootstrap.ts:73`

**Issue:** `new URL('../../cli/main.js', import.meta.url).pathname` resolves relative to the location of `bootstrap.ts` (or its compiled output). The tsup config outputs to `dist/cli/` with a flat entry, but all other source files retain their `src/` subdirectory structure inside `dist/`. If `bootstrap.js` compiles to `dist/client/bootstrap.js` and `main.js` to `dist/cli/main.js`, the relative `../../cli/main.js` path produces `dist/cli/main.js` only if the relative depth is correct. The outDir in tsup is `dist/cli` for the entry but source modules are bundled in place — the actual emitted path needs to be verified. If the path resolves incorrectly, `spawn` silently starts node with a non-existent script path and the daemon never comes up; `waitForSocket` then times out with a misleading error.

**Fix:** Add an existence check on `qqScript` before spawning:

```typescript
import * as fs from 'node:fs';

const qqScript = new URL('../../cli/main.js', import.meta.url).pathname;

if (!fs.existsSync(qqScript)) {
  throw new Error(`qq daemon script not found at: ${qqScript}. Run 'pnpm build' first.`);
}
```

---

### WR-03: `run-foreground.ts` opens `/dev/tty` but never uses the file descriptor

**File:** `src/client/run-foreground.ts:38-64`

**Issue:** `fsp.open('/dev/tty', 'r+')` returns a file handle that is stored in `ttyHandle`, closed in `finally`, but never actually used — no read or write is performed on it, and nothing is passed to the TUI layer. The comment says the client "owns the TTY", but opening and immediately closing a file descriptor without doing anything with it does not establish TTY ownership. If the intent is to ensure the TTY is accessible before proceeding (a liveness check), this approach works, but the variable name and comment imply it will be used for I/O. In Phase 4 when Ink is wired in, the intent will need to be clarified; if the fd is silently ignored it will cause confusion.

**Fix:** Either add a comment clarifying this is a pre-check only, or pass `ttyHandle.fd` to the TTY-interaction layer. At minimum, remove the misleading "owns the TTY" framing until the handle is actually used:

```typescript
// Phase 1: open /dev/tty to verify it is accessible before proceeding.
// Phase 4 will pass this handle to the Ink TUI for interactive I/O.
const ttyHandle = await fsp.open('/dev/tty', 'r+');
```

---

### WR-04: `resultMode` in `client.ts` silently defaults to `cancel` for any unknown value

**File:** `src/cli/commands/client.ts:23-25`

**Issue:** Any unrecognised `--result-mode` value (e.g. a typo like `replace-buffer-fixtuer`) silently falls through to `cancel` with no warning to the user. This is a debugging trap: a user who misspells the flag will see the widget cancel without any indication that their flag value was ignored.

```typescript
// Current (silent fallback):
const resultMode: 'cancel' | 'replace-buffer-fixture' =
  mode === 'replace-buffer-fixture' ? 'replace-buffer-fixture' : 'cancel';

// Fix: warn on unrecognised values
const VALID_MODES = ['cancel', 'replace-buffer-fixture'] as const;
type ResultMode = (typeof VALID_MODES)[number];

function parseResultMode(mode: string | undefined): ResultMode {
  if (mode === undefined || mode === 'cancel') return 'cancel';
  if (mode === 'replace-buffer-fixture') return 'replace-buffer-fixture';
  console.error(`Warning: unknown --result-mode "${mode}", defaulting to cancel`);
  return 'cancel';
}

const resultMode = parseResultMode(options.resultMode);
```

---

### WR-05: `writeShellResult` performs a non-atomic write — partial result visible to zsh reader

**File:** `src/client/result-writer.ts:20`

**Issue:** `fsp.writeFile(resultFile, ...)` writes directly to the result file path. The zsh widget polls for the file with `-f "$result_file"` and `-s "$result_file"` (non-empty). If the Node process is interrupted (OOM kill, SIGKILL) after `open()` but before the full `write()` completes, zsh will read a partial JSON line, `jq` will fail to parse it, and `_qq_apply_result` will fall back to the original buffers. This is handled gracefully by the zsh side, so it does not cause data loss — but the result is a silent cancel rather than an error message.

A more robust approach is to write to a temp file alongside `resultFile` and then `rename()` it atomically:

```typescript
import * as path from 'node:path';

export async function writeShellResult(resultFile: string, result: ShellResult): Promise<void> {
  const parsed = shellResultSchema.parse(result);
  const line = JSON.stringify(parsed) + '\n';

  const tmpFile = `${resultFile}.tmp`;
  await fsp.writeFile(tmpFile, line, { encoding: 'utf-8' });
  await fsp.rename(tmpFile, resultFile); // atomic on same filesystem
}
```

---

## Info

### IN-01: `socketPath()` fallback to UID 0 is silently incorrect on Windows/non-POSIX

**File:** `src/shared/socket-path.ts:18`

**Issue:** `process.getuid?.() ?? 0` uses UID 0 (root) when `getuid` is unavailable (Windows). Since this is a zsh-only product, Windows is not a target, but the fallback produces `/tmp/qq-0.sock` which would be owned by root on any POSIX system where the process lacks `getuid`. A comment should document the assumption, or the fallback should throw on unsupported platforms.

---

### IN-02: `ensure-session` IPC response echoes back the server's `socketPath`, not the session's

**File:** `src/daemon/server.ts:52-55`

**Issue:** The `ensure-session` handler responds with `{ kind: 'session-ready', socketPath }` where `socketPath` is the daemon's own listening path — the same one the client already connected on. This is circular and not a useful response value. The field name implies a per-session sub-socket or a derived path. If this is intentional stub behaviour for Phase 1, add a comment; otherwise it is likely a placeholder that will silently carry wrong semantics into later phases.

---

### IN-03: `run-query` uses `Math.random()` for `requestId` — not cryptographically unique

**File:** `src/daemon/server.ts:58`

**Issue:** `Math.random().toString(36).slice(2)` produces a ~10-character base-36 string with ~52 bits of `Math.random` entropy. For a single-user background daemon this is unlikely to collide, but if `requestId` is ever used to correlate async results or to guard against replay, `crypto.randomUUID()` (available in Node 15+) is the correct primitive.

```typescript
// Replace:
const requestId = Math.random().toString(36).slice(2);
// With:
import { randomUUID } from 'node:crypto';
const requestId = randomUUID();
```

---

### IN-04: `zsh-widget.test.ts` passes `widgetPath` unquoted in the `source` command

**File:** `tests/zsh-widget.test.ts:37`

**Issue:** The `runZsh` helper builds the zsh script as `` `source ${widgetPath}\n${script}` `` with the path unquoted. If the project is checked out under a path containing spaces (e.g. `/Users/john doe/dev/tui-llm`), the `source` command will split on the space and fail. The path should be single-quoted:

```typescript
// Replace:
const result = spawnSync('zsh', ['-c', `source ${widgetPath}\n${script}`], ...);
// With:
const result = spawnSync('zsh', ['-c', `source '${widgetPath}'\n${script}`], ...);
// (This is safe only if widgetPath itself contains no single quotes, which is
// virtually guaranteed for a build artifact path.)
```

---

_Reviewed: 2026-05-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
