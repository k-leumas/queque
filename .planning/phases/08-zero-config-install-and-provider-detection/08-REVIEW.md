---
phase: 08-zero-config-install-and-provider-detection
reviewed: 2026-08-26T04:20:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/providers/detect.ts
  - src/providers/claude-exec.ts
  - src/providers/claude-cli.ts
  - src/providers/claude-default.ts
  - src/providers/claude.ts
  - src/providers/resolver.ts
  - src/providers/index.ts
  - src/registry/bootstrap.ts
  - src/client/run-foreground.ts
  - tests/provider-detect.test.ts
  - tests/claude-cli-provider.test.ts
  - tests/registry-bootstrap.test.ts
  - tests/provider-resolver.test.ts
  - tests/client-result.test.ts
  - tests/claude-provider.test.ts
  - docs/EXTENSIONS.md
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-08-26T04:20:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed the Phase 08 source surface: leftover `detectProvider()` preflight, the new CLI-first composite (`claude -p` then SDK rescue), registry/resolver wiring, foreground FIFO errors, and Wave 0 tests.

Composite registration, detect-selector bypass, D-13 copy, single `QueQue:` FIFO prefix, and debug `path: 'claude-cli' | 'sdk-rescue'` look correct. The blocking defect is that the documented stdin-isolation control is a no-op: `execFile` does not honor `stdio: ['ignore','pipe','pipe']`, so `claude -p` is spawned with an open stdin pipe. Tests mock `execFileAsync` and only assert the options object, so they cannot catch this. Two 08-01 detection warnings are still open. Empty `ANTHROPIC_API_KEY` in the environment blocks `.env.local` rescue.

Locked 08-02 choices (detect leftover, argv prompt / T-08-02-07, none/ollama/openai-key Claude bridge, no `--bare`, composite registered as `claude-cli`) are not filed as bugs.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `execFile` ignores `stdio`; stdin stays an open pipe

**File:** `src/providers/claude-exec.ts:10-24` (call site `src/providers/claude-cli.ts:44-56`)
**Issue:** T-08-02-03 / Pitfall 2 mitigation is `stdio: ['ignore','pipe','pipe']` so print-mode `claude -p` does not wait on stdin or inherit the Ink/Zellij TTY. That option is passed into a thin `promisify(execFile)` wrapper. Node's `execFile` does not take `stdio` (`ExecFileOptions` has timeout/killSignal/cwd/env/maxBuffer only) and always spawns with default `stdio: 'pipe'`. Empirically on Node 26:

- `execFile(..., { stdio: ['ignore','pipe','pipe'] })` still has `child.stdin` as an open pipe
- a child that reads stdin until EOF never sees EOF and times out
- `spawn(..., { stdio: ['ignore','pipe','pipe'] })` sets `child.stdin` to `null` and delivers EOF immediately

Research states print mode reads stdin (10MB cap) and an open pipe without EOF hangs until the Node timeout. After a 25s hang, `remainingMs` is below `MIN_SDK_RESCUE_MS`, so SDK rescue is skipped even when a key exists. `/login` users with `claude` on PATH then get a timeout instead of candidates (breaks D-03/D-07/D-09). Tests at `tests/claude-cli-provider.test.ts:227-238` only check `options.stdio[0] === 'ignore'` on the mocked wrapper — they never exercise real `execFile`.
**Fix:** Implement `execFileAsync` with `spawn` so `stdio` is actually applied. Collect stdout/stderr, honor `timeout` / `killSignal` / `cwd` / `env` / `maxBuffer`, reject with the same `code` / `killed` / `signal` / `stdout` / `stderr` shape the composite already reads. Do not call `promisify(execFile)` and expect extra `stdio` keys to work. Keep the mock surface as `execFileAsync` resolving `{ stdout, stderr }`.

```typescript
import { spawn } from 'node:child_process';

export function execFileAsync(
  file: string,
  args: readonly string[],
  options?: {
    encoding?: BufferEncoding;
    timeout?: number;
    killSignal?: NodeJS.Signals;
    maxBuffer?: number;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    windowsHide?: boolean;
    shell?: boolean;
    stdio?: Array<'ignore' | 'pipe' | 'inherit'>;
  },
): Promise<{ stdout: string; stderr: string }> {
  const stdio = options?.stdio ?? ['ignore', 'pipe', 'pipe'];
  const encoding = options?.encoding ?? 'utf8';
  const timeout = options?.timeout;
  const killSignal = options?.killSignal ?? 'SIGTERM';

  return new Promise((resolve, reject) => {
    const child = spawn(file, [...args], {
      cwd: options?.cwd,
      env: options?.env,
      shell: options?.shell ?? false,
      windowsHide: options?.windowsHide,
      stdio,
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.setEncoding(encoding);
    child.stderr?.setEncoding(encoding);
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
    });

    let timedOut = false;
    const timer =
      timeout && timeout > 0
        ? setTimeout(() => {
            timedOut = true;
            child.kill(killSignal);
          }, timeout)
        : undefined;

    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      if (code === 0 && !timedOut) {
        resolve({ stdout, stderr });
        return;
      }
      const error = Object.assign(new Error(`Command failed: ${file}`), {
        code: timedOut ? null : (code ?? 'ENOENT'),
        killed: timedOut,
        signal,
        stdout,
        stderr,
      });
      reject(error);
    });
  });
}
```

Add one unmocked unit test that `spawn`s `process.execPath` with a stdin-until-EOF script and `stdio: ['ignore','pipe','pipe']`, and asserts the child exits with empty stdin rather than hanging until timeout.

## Warnings

### WR-01: Host Claude auth env can mask credentials-file regressions

**File:** `tests/provider-detect.test.ts:133-143`
**Issue:** Still open from 08-01. Branch 2 stubs `ANTHROPIC_API_KEY` but not `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_AUTH_TOKEN`. If those vars are set on the host, `claudeAuthPresent()` returns true before `claudeAuthFileExists()`, so a broken credentials-file path still yields `{ kind: 'claude-cli' }`. Newer platform-split cases stub these vars; Branch 2 does not.
**Fix:** Clear Claude auth env in `beforeEach` (or every case that asserts file-based auth):

```typescript
beforeEach(() => {
  execSyncMock.mockReset();
  statMock.mockReset();
  fetchMock.mockReset();
  readEnvValueFromDotEnvLocalMock.mockReset();
  readEnvValueFromDotEnvLocalMock.mockReturnValue(null);
  vi.stubEnv('CLAUDE_CODE_OAUTH_TOKEN', '');
  vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
});
```

Also stub `platform` to `'linux'` in Branch 2 if the intent is specifically “auth file exists ⇒ claude-cli”.

### WR-02: `claudeOnPath()` uses Unix `which` — Windows never reaches auth checks

**File:** `src/providers/detect.ts:13-19`
**Issue:** Still open from 08-01. Leftover preflight (not the 08-02 selector) still gates Step 2 on `execSync('which claude')`. Native Windows shells typically lack `which`, so `claudeOnPath()` returns false and `claudeAuthPresent()` / credentials `stat` never run. Debug/preflight callers on Windows mis-report Claude as absent.
**Fix:** Use a cross-platform PATH probe (e.g. `process.platform === 'win32' ? 'where claude' : 'which claude'`, or search `process.env.PATH`), still without spawning `claude -p`.

### WR-03: Empty `ANTHROPIC_API_KEY` blocks `.env.local` SDK rescue

**File:** `src/providers/claude-default.ts:65-68` and `src/providers/claude.ts:126-129`
**Issue:** D-09 requires rescue when a key exists in the environment **or** `.env.local`. Both lookups use `??`, which does not treat `""` as missing:

```typescript
process.env.ANTHROPIC_API_KEY ?? readEnvValueFromDotEnvLocal('ANTHROPIC_API_KEY')
```

An exported empty `ANTHROPIC_API_KEY=` (common in stubbed/CI shells; detect tests already use `vi.stubEnv('ANTHROPIC_API_KEY', '')`) makes `lookupApiKey()` return `""`, skips rescue, and never reads `.env.local`. Even if the composite used `||`, `fetchCandidates` in `claude.ts` would still refuse the empty env value and throw before opening `.env.local`. Detect’s own check correctly uses `||`.
**Fix:** Treat empty/whitespace env values as unset in both places:

```typescript
function envOrDotEnvLocal(name: string): string | undefined {
  const fromEnv = process.env[name]?.trim();
  if (fromEnv) return fromEnv;
  return readEnvValueFromDotEnvLocal(name)?.trim() || undefined;
}
```

Use that helper in `lookupApiKey()` and in `fetchCandidates`.

## Info

### IN-01: `none` message omits setup-token env vars

**File:** `src/providers/detect.ts:87-94`
**Issue:** Copy mentions credentials file / macOS Keychain but not `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_AUTH_TOKEN`. Users relying only on setup-token env vars get less actionable leftover-preflight guidance when `claude` is missing from PATH.
**Fix:** Optionally mention setup-token / auth-token env vars in line 2 of the message.

### IN-02: Darwin test does not assert credentials file is untouched

**File:** `tests/provider-detect.test.ts:210-224`
**Issue:** Darwin + PATH + no auth file expects `claude-cli`, but does not assert `statMock` was never called. That would lock the “no credential file touch on darwin” / latency contract.
**Fix:** Add `expect(statMock).not.toHaveBeenCalled()` after the darwin case.

### IN-03: Missing negative coverage for env token without PATH

**File:** `tests/provider-detect.test.ts:242-272`
**Issue:** Env-token cases always set `claudeOnPath()`. There is no case proving `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_AUTH_TOKEN` alone (binary missing) does not select `claude-cli`.
**Fix:** Add a case with token set + `claudeNotOnPath()` expecting fallthrough to Ollama/`none`.

---

### Notes (not findings)

| Check | Result |
|-------|--------|
| Composite registered as `claude-cli`, raw `claudeCliAdapter` unregistered | Pass — `bootstrap.ts:51-56` |
| Hot path does not call `detectProvider()` | Pass — `run-foreground.ts` uses `resolveClaudeDefaultAdapter()` |
| none/ollama/openai-key → Claude default with 08-02 bridge comment | Pass — `resolver.ts:22-36` (locked) |
| Prompt last argv, no `--bare`, stdin option set to ignore (intent) | Pass at call site; **runtime ignore is CR-01** |
| FIFO single `QueQue:` prefix | Pass — `formatFifoError` |
| Debug logs `path` only, no argv/env/streams | Pass on the composite path |
| Shared 25s deadline + `MIN_SDK_RESCUE_MS` | Pass |
| Argv prompt `ps` disclosure | Accepted T-08-02-07 — not filed |

---

_Reviewed: 2026-08-26T04:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
