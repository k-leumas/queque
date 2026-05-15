---
phase: 03-claude-fast-path-and-ranked-suggestions
reviewed: 2026-05-15T12:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/providers/provider.ts
  - src/providers/claude.ts
  - src/contracts/shell.ts
  - src/contracts/request.ts
  - src/client/run-foreground.ts
  - src/registry/bootstrap.ts
  - tests/claude-provider.test.ts
  - tests/shell-contract.test.ts
  - tests/client-result.test.ts
  - tests/registry-bootstrap.test.ts
  - shell/zsh/qq.zsh
  - tests/zsh-widget.test.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: fixed
fixed_at: 2026-05-15T08:10:00Z
---

# Phase 03: Code Review Report — Claude Fast Path and Ranked Suggestions

**Reviewed:** 2026-05-15T12:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the Claude provider, shell contracts, foreground client, registry bootstrap, ZSH widget, and their test suites. The overall architecture is sound — contracts are schema-validated with Zod, the FIFO/regular-file write split in `result-writer.ts` is correct, and the Zellij detection guard and session-directory isolation (`chmod 700`) are in place. Two blockers were found: a confirmed TypeScript type error that fails the build, and a `max_tokens` budget that is structurally too small for the expected 3-candidate JSON response format. Four warnings cover an unhandled rejection path in the LLM error handler, a silent schema-fallback mismatch for array-shaped malformed responses, a missing exit-code check in the ZSH widget's inline jq parsing, and temp-dir leaks in the test suite.

---

## Critical Issues

### CR-01: Missing `confidence` field causes TypeScript compile error in `run-foreground.ts`

**File:** `src/client/run-foreground.ts:90`
**Issue:** `classifyIntent` requires a full `NormalizedRequest`, which includes a required `confidence: number` field. The call site spreads a `ShellRequest` (which has no `confidence` field) and only adds `intent`:

```ts
const decision = classifyIntent({ ...request, intent: 'unknown' as const });
```

`NormalizedRequest` requires `confidence`, so TypeScript rejects this call:

```
error TS2345: Property 'confidence' is missing in type '{ intent: "unknown"; version: 1; … }'
but required in type '{ … confidence: number; }'.
```

This is confirmed by `npx tsc --noEmit`. The code does not compile as-is, so `resultMode: 'llm'` is currently broken at the type level.

**Fix:**
```ts
const decision = classifyIntent({
  ...request,
  intent: 'unknown' as const,
  confidence: 0,  // placeholder — classifyIntent overwrites this
});
```

---

### CR-02: `max_tokens: 256` too small for 3-candidate JSON response — causes silent truncation

**File:** `src/providers/claude.ts:112`
**Issue:** The API call sets `max_tokens: 256`. The prompt asks for 1–3 candidates each with a `command` and `explanation` field. A single realistic candidate with a long command and a non-trivial explanation can approach or exceed 100 tokens. A 3-candidate response with meaningful explanations routinely exceeds 256 tokens. When Claude's response is truncated mid-JSON, `JSON.parse` throws, triggering the `parseCandidates` catch-branch which returns the raw truncated text as the command string — a broken fragment is silently inserted into the user's shell buffer.

**Fix:** Increase the budget to accommodate 3 full candidates:
```ts
max_tokens: 1024,
```

---

## Warnings

### WR-01: `void writeShellResult(…).then(…)` in fetch error handler — unhandled rejection and premature cleanup race

**File:** `src/client/run-foreground.ts:180`
**Issue:** Inside the `fetchCandidates` `.catch()` handler, the error result is written with `void`:

```ts
void writeShellResult(resultFile, { kind: 'error', message: … }).then(() => unmount?.());
```

Two problems occur together:
1. If `writeShellResult` rejects (e.g. FIFO closed or disk full), the rejection becomes an unhandled promise rejection — nothing surfaces to the outer `try/catch` at line 185.
2. The outer `Promise<void>` can resolve before the write completes, allowing `ttyHandle?.close()` in the `finally` block at line 197 to close the TTY before the error result is flushed.

The outer `catch` block at line 190 correctly `await`s the same call, making the inconsistency between the two error paths visible.

**Fix:**
```ts
.catch(async (err) => {
  const message = err instanceof Error ? err.message : String(err);
  void appendDebugLog('client', 'llm request failed', { message });
  if (resolved) return;
  resolved = true;
  try {
    await writeShellResult(resultFile, {
      kind: 'error',
      message: `Que-Que: ${message} — press any key`,
    });
  } finally {
    unmount?.();
  }
});
```

---

### WR-02: `parseCandidates` fallback uses raw JSON text as command when schema validation fails

**File:** `src/providers/claude.ts:22-28`
**Issue:** When `candidateListSchema.parse(JSON.parse(text))` throws because the parsed JSON is valid but the wrong shape (e.g. Claude returns `[]` which fails `.min(1)`, or `{}`, or `42`), the `catch` branch uses `trimmed || 'echo ""'` where `trimmed` is the original raw text string. For the `[]` case, `trimmed` is `"[]"` (truthy), so the fallback command returned is the literal string `[]` — a meaningless shell command silently placed in the user's buffer with no warning.

The intent of the fallback is to handle cases where the LLM returns plain-text prose instead of JSON. It should not apply to valid-JSON-but-invalid-schema responses.

**Fix:** Separate the two failure modes:
```ts
function parseCandidates(text: string): CandidateList {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Not JSON at all — treat entire text as a plain command (prose fallback)
    const trimmed = text.trim();
    return [{ command: trimmed || 'echo ""', explanation: '' }];
  }
  // Valid JSON but wrong schema — do not use raw JSON text as a command
  try {
    return candidateListSchema.parse(parsed);
  } catch {
    return [{ command: 'echo ""', explanation: 'Que-Que: unexpected response format' }];
  }
}
```

---

### WR-03: ZSH widget inline jq parsing has no error check for `new_lbuffer` extraction

**File:** `shell/zsh/qq.zsh:226-229`
**Issue:** In the `replace-buffer` branch of the inline result parser inside `qq-question-widget`, the jq calls for `new_lbuffer` and `new_rbuffer` have no exit-code guard:

```sh
new_lbuffer=$(printf '%s' "$result" | jq -r '.lbuffer // empty' 2>/dev/null)
new_rbuffer=$(printf '%s' "$result" | jq -r '.rbuffer // ""'    2>/dev/null)
LBUFFER="$new_lbuffer"
RBUFFER="$new_rbuffer"
```

If either jq call fails (jq not found, malformed internal state), `LBUFFER` or `RBUFFER` is silently set to an empty string rather than falling back to `QQ_ORIG_LBUFFER`/`QQ_ORIG_RBUFFER`. This would corrupt the user's command line without any indication.

By contrast, `_qq_apply_result` (the helper function used in tests) checks `$?` after the jq calls at lines 117-121, though only for the last assignment.

**Fix:**
```sh
replace-buffer)
  new_lbuffer=$(printf '%s' "$result" | jq -r '.lbuffer // empty' 2>/dev/null) || {
    LBUFFER="$QQ_ORIG_LBUFFER"; RBUFFER="$QQ_ORIG_RBUFFER"
    ;;
  }
  new_rbuffer=$(printf '%s' "$result" | jq -r '.rbuffer // ""' 2>/dev/null) || {
    LBUFFER="$QQ_ORIG_LBUFFER"; RBUFFER="$QQ_ORIG_RBUFFER"
    ;;
  }
  LBUFFER="$new_lbuffer"
  RBUFFER="$new_rbuffer"
  ;;
```

---

### WR-04: Temp directories created in `zsh-widget.test.ts` are never removed — test dir leaks

**File:** `tests/zsh-widget.test.ts:104,169,192,231,253,278,305,327`
**Issue:** Every test that calls `mkdtempSync` creates a temp directory but only removes the individual result file with `unlinkSync`. The parent temp directory is never deleted. Eight tests are affected (the `_qq_log` test at line 104, six `_qq_apply_result` tests, and the daemon prewarm test at line 192). On a long-running test suite or CI environment this accumulates `/tmp/qq-*` directories across runs.

**Fix:** Replace `unlinkSync(resultFile)` with `rmSync(dir, { recursive: true, force: true })` in each affected test, or introduce an `afterEach` block per describe that tracks and removes `dir`:
```ts
import { rmSync } from 'node:fs';
// ...
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});
```

---

## Info

### IN-01: `rbuffer` parameter of `fetchCandidates` is accepted but only logged — diverges from `LLMAdapter` interface

**File:** `src/providers/claude.ts:90`
**Issue:** The exported `fetchCandidates(envelope, rbuffer)` accepts `rbuffer` as an optional parameter with a default of `''` and logs its length, but never includes it in the API prompt. The comment at lines 84–87 explains this is intentional ("shell transport state, not context"). However, the `LLMAdapter` interface at `src/providers/provider.ts:5` declares `fetchCandidates(envelope: ContextEnvelope): Promise<CandidateList>` with no `rbuffer` parameter. The `claudeAdapter` object at line 142 assigns the function directly to the interface — TypeScript allows this because the extra parameter is optional, but the signature divergence is a maintenance trap: callers using the interface will never pass `rbuffer`, so the debug log entry for `rbufferLength` will always be `0` through the adapter path.

**Fix:** Either remove `rbuffer` from the `fetchCandidates` export signature (it is unused in the prompt), or add it to the `LLMAdapter` interface if Phase 4 will need it:
```ts
// Option A — remove it:
export async function fetchCandidates(envelope: ContextEnvelope): Promise<CandidateList> {
```

---

### IN-02: Test mock for `fsp.stat` uses incorrect type cast in `client-result.test.ts`

**File:** `tests/client-result.test.ts:225-227`
**Issue:** The FIFO-path test mocks `fsp.stat` with:

```ts
vi.mocked(fspMock.stat).mockResolvedValueOnce(
  { isFIFO: () => true } as ReturnType<typeof fspMock.stat>,
);
```

`ReturnType<typeof fspMock.stat>` resolves to `Promise<Stats | BigIntStats>`, not the awaited value. TypeScript confirms this:

```
error TS2345: Conversion of type '{ isFIFO: () => boolean; }' to type
'Promise<Stats | BigIntStats>' may be a mistake
```

The test passes at runtime because vitest ignores the type mismatch, but the cast is incorrect and masks the proper type.

**Fix:**
```ts
vi.mocked(fspMock.stat).mockResolvedValueOnce(
  { isFIFO: () => true } as unknown as Awaited<ReturnType<typeof fspMock.stat>>,
);
```

---

### IN-03: `shouldForceSelector()` called twice per `fetchCandidates` invocation

**File:** `src/providers/claude.ts:38,129`
**Issue:** `shouldForceSelector()` is called once inside `ensureSelectableCandidates` (line 38) and a second time in the debug log at line 129. Each call reads `process.env.QQ_FORCE_SELECTOR` and falls back to `readEnvValueFromDotEnvLocal`. The env-file reader has a module-level cache so correctness is not affected, but the redundant call is unnecessary and makes the log's `forceSelector` value a re-read rather than a record of the value that was actually used in the decision.

**Fix:** Compute the value once and thread it through:
```ts
// In fetchCandidates:
const parsedCandidates = parseCandidates(text);
const forceSelector = shouldForceSelector();
const candidates = ensureSelectableCandidates(parsedCandidates, forceSelector);
void appendDebugLog('provider', 'response parsed', {
  model,
  candidateCount: candidates.length,
  forceSelector,
});
```

---

_Reviewed: 2026-05-15T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
