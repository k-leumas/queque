# Phase 8: Zero-Config Install and Provider Detection - Research

**Researched:** 2026-07-31
**Domain:** Provider detection, Claude Code auth reuse, subprocess adapters
**Confidence:** HIGH

---

## Summary

Phase 8 makes QueQue work without a manual `ANTHROPIC_API_KEY` when the user already has Claude Code, Ollama, or an OpenAI key. Prototype detection (quick plan 260522-vfd) already implements the waterfall shape in `src/providers/detect.ts`, and Phase 6 wires `detectProvider → resolveAdapter → adapter.fetchCandidates`. What remains is platform-correct Claude auth detection, subprocess adapters, and a none-path setup wizard.

**Critical gap:** Step 2 of `detectProvider()` only stat-checks `~/.claude/.credentials.json` (and `credentials.json`). On macOS, `claude /login` stores OAuth credentials in the **Keychain**, not a credentials file. A logged-in macOS user therefore fails Step 2 and falls through to Ollama/`none`, breaking success criteria #1 and #7.

---

## Claude Code auth storage (platform table)

| Platform | Where `/login` stores credentials | Detectable via file stat? |
|----------|-----------------------------------|---------------------------|
| macOS | Encrypted macOS Keychain | No |
| Linux | `~/.claude/.credentials.json` (mode `0600`) | Yes |
| Windows | `%USERPROFILE%\.claude\.credentials.json` | Yes |

Source: [Claude Code authentication docs](https://code.claude.com/docs/en/authentication).

Additional env-based auth (any platform):

| Variable | Origin | Notes |
|----------|--------|-------|
| `CLAUDE_CODE_OAUTH_TOKEN` | `claude setup-token` | Long-lived OAuth; subscription-backed |
| `ANTHROPIC_AUTH_TOKEN` | Gateway / bearer setups | Sent as `Authorization: Bearer` |
| `ANTHROPIC_API_KEY` | Claude Console | Already handled as Step 1 (`anthropic-key`) |

---

## Gap analysis

### Current code (`src/providers/detect.ts`)

```typescript
async function claudeAuthFileExists(): Promise<boolean> {
  const home = os.homedir();
  const candidates = [`${home}/.claude/.credentials.json`, `${home}/.claude/credentials.json`];
  // stat each — return true if any exists
}

// Step 2
if (claudeOnPath() && (await claudeAuthFileExists())) {
  return { kind: 'claude-cli' };
}
```

### Failure mode on macOS

1. User runs `claude /login` successfully (Keychain populated).
2. No `~/.claude/.credentials.json` exists (expected on darwin).
3. `detectProvider()` returns `ollama` or `none` instead of `claude-cli`.
4. Even after 08-02 wires the subprocess adapter, macOS `/login` users never reach it.

### Related test debt

`tests/provider-detect.test.ts` includes:

> claude on PATH but no auth file → falls through to Ollama check

That behavior is correct on Linux/Windows but wrong on darwin. Split into platform-specific cases in 08-01.

---

## Recommended detection fix

| Topic | Detail |
|-------|--------|
| **Gap** | macOS Keychain vs file-based credentials |
| **Why not read Keychain directly** | Undocumented service name, fragile across Claude Code versions, competes with Claude CLI refresh logic |
| **Why not `claude -p` probe** | Violates Phase 8 success criterion #5 (&lt; 200 ms detection budget) |
| **Recommended fix** | Platform-aware `claudeAuthPresent()` — presence only, never parse credential contents |
| **macOS strategy** | If `claude` on PATH → treat auth as present; 08-02 subprocess validates at call time |
| **Linux/Windows strategy** | Keep credentials-file stat (current behavior) |
| **Env token strategy** | `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_AUTH_TOKEN` → auth present on any platform |
| **Performance** | Detection stays `which` + optional `stat` / env reads; no network, no CLI probe |
| **Privacy** | Preserve prototype threat T-vfd-01 — never log or read credential contents |

### Sketch

```typescript
async function claudeAuthPresent(): Promise<boolean> {
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_AUTH_TOKEN) {
    return true;
  }
  if (process.platform === 'darwin') {
    return true; // Keychain auth; validated by subprocess adapter at call time
  }
  return claudeAuthFileExists();
}
```

Call site: `if (claudeOnPath() && (await claudeAuthPresent()))`.

False-positive cost on macOS (claude installed but logged out): deferred to 08-02 request time with a clear auth error, which is preferable to never detecting a logged-in Keychain user.

---

## Phase 8 plan order

```
08-01 Platform-aware detection  →  08-02 Subprocess adapters  →  08-03 Setup wizard
```

08-01 must land before 08-02: `resolveAdapter({ kind: 'claude-cli' })` is only selected when detection returns `claude-cli`.

---

## Out of scope for 08-01

- Reading/parsing Keychain or `credentials.json` token contents
- SDK `authToken` path in `claude.ts` (roadmap: later optimization after subprocess path)
- Implementing 08-02 / 08-03
- Changing Anthropic SDK adapter credential resolution beyond what detection already covers
