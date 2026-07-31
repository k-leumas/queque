---
phase: 08-zero-config-install-and-provider-detection
reviewed: 2026-07-31T23:45:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/providers/detect.ts
  - tests/provider-detect.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-07-31T23:45:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed 08-01 scope (`claudeAuthPresent()`, Step 2 wiring, platform-split tests). Secret handling matches the threat model: env tokens are truthiness-only, credentials use `stat` only on non-darwin, no Keychain/`claude -p` probes, and `detect.ts` never logs token values. Platform-aware detection matches the plan. Two warnings remain around Windows PATH detection and test isolation that can mask auth-file regressions on developer machines.

## Warnings

### WR-01: Host Claude auth env can mask credentials-file regressions

**File:** `tests/provider-detect.test.ts:133-143`
**Issue:** Several cases (notably Branch 2) stub `ANTHROPIC_API_KEY` but not `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_AUTH_TOKEN`. If those vars are set in the host environment, `claudeAuthPresent()` short-circuits to `true` before `claudeAuthFileExists()`, so a broken credentials-file path can still produce `{ kind: 'claude-cli' }` and the test passes for the wrong reason. Newer platform-split cases do stub these vars; Branch 2 does not.
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
**Issue:** Research/plan treat Windows as file-based Claude auth (`%USERPROFILE%\.claude\.credentials.json`), but Step 2 gates on `execSync('which claude')`. Native Windows shells typically lack `which`, so `claudeOnPath()` returns `false` and `claudeAuthPresent()` / credentials `stat` never run. Pre-existing helper, but it sits on the 08-01 detection path the plan claims covers win.
**Fix:** Use a cross-platform PATH probe (e.g. `process.platform === 'win32' ? 'where claude' : 'which claude'`, or Node’s `path`/`fs` search over `process.env.PATH`), still without spawning `claude -p`.

## Info

### IN-01: `none` message omits setup-token env vars

**File:** `src/providers/detect.ts:91`
**Issue:** Copy mentions credentials file / macOS Keychain (required) but not `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_AUTH_TOKEN` (optional in the plan). Users relying only on setup-token env vars get less actionable guidance when `claude` is missing from PATH.
**Fix:** Optionally extend line 2 of the message to mention setup-token / auth-token env vars.

### IN-02: Darwin test does not assert credentials file is untouched

**File:** `tests/provider-detect.test.ts:210-224`
**Issue:** Darwin + PATH + no auth file expects `claude-cli`, but does not assert `statMock` was never called. That would lock the “no credential file touch on darwin” / latency contract.
**Fix:** Add `expect(statMock).not.toHaveBeenCalled()` after the darwin case (and optionally spy that `fs.readFile` / Keychain helpers are never imported/used).

### IN-03: Missing negative coverage for env token without PATH

**File:** `tests/provider-detect.test.ts:242-272`
**Issue:** Env-token cases always set `claudeOnPath()`. There is no case proving `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_AUTH_TOKEN` alone (binary missing) does not select `claude-cli`.
**Fix:** Add a case with token set + `claudeNotOnPath()` expecting fallthrough to Ollama/`none`.

---

### Secret-handling notes (no findings)

| Check | Result |
|-------|--------|
| Env tokens truthiness only | Pass — `detect.ts:42` |
| No Keychain query | Pass — darwin returns presence without `security`/Keychain APIs |
| Credentials file contents unread | Pass — `fsp.stat` only (`detect.ts:27`) |
| No `claude -p` probe | Pass |
| Token values not logged in detect | Pass — no logging in `detect.ts`; caller logs `{ kind }` only |

Darwin PATH-only false positives (installed but logged out) remain an accepted threat (T-08-01-02), deferred to 08-02 request-time validation.

---

_Reviewed: 2026-07-31T23:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
