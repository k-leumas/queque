---
phase: 04-fuzzy-tui-selection-ux
reviewed: 2026-05-21T13:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - shell/zsh/qq.zsh
  - src/cli/main.ts
  - src/ui/CandidateSelect.tsx
  - tests/candidate-select.test.tsx
  - tests/client-result.test.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-21T13:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the Phase 04 fuzzy TUI selection UX implementation: the zsh ZLE widget, the CLI entry point with top-level error handlers, the `CandidateSelect` Ink component, and both test files. The shell integration and result-writer code are well-structured with explicit FIFO vs. regular-file detection. The TUI component implements the monocle contract correctly for most paths. Two critical bugs were found — one is a data-loss risk in the shell widget (inline result parsing duplicates `_qq_apply_result` but diverges from it) and one is a security issue in the top-level error handlers (unvalidated environment variable used as a filesystem write path). Four warnings and three info items cover edge cases in navigation, test reliability, and a defaulting behaviour that contradicts documentation.

---

## Critical Issues

### CR-01: `QQ_RESULT_FILE` used as filesystem path without validation in top-level error handlers

**File:** `src/cli/main.ts:51-57` and `src/cli/main.ts:64-70`

**Issue:** Both `uncaughtException` and `unhandledRejection` handlers read `process.env.QQ_RESULT_FILE` and pass it directly to `fs.writeFileSync` with no path validation whatsoever. The comment in the source acknowledges this is a "known limitation" but characterises it as minor. It is not minor: any process that can set `QQ_RESULT_FILE` before `qq client` starts can redirect this write to an arbitrary path. In the current deployment model the env var is exported by the trusted zsh widget, but if `qq` is ever invoked directly (e.g., from a shell script, CI, or a compromised `.zshrc` shim), an attacker-controlled value causes the error handler to overwrite arbitrary files with `{"kind":"cancel"}\n` at whatever privilege level `qq` runs. The risk is file corruption / truncation of any world-writable file the user owns.

**Fix:** Add the same `assertSafeSocketPath`-style prefix check used elsewhere in the codebase, or at minimum verify the path starts with the expected tmpdir prefix and is an absolute path:

```typescript
process.on('uncaughtException', (err: Error) => {
  console.error('Que-Que: uncaught exception:', err.message);
  const resultFile = process.env.QQ_RESULT_FILE;
  // Guard: only write to paths that look like our session tmpdirs
  if (resultFile && /^\/tmp\/qq-sess\.[A-Za-z0-9]+\//.test(resultFile)) {
    try {
      fs.writeFileSync(resultFile, '{"kind":"cancel"}\n');
    } catch {
      // Ignore write failures
    }
  }
  process.exit(1);
});
```

Apply the same guard to the `unhandledRejection` handler.

---

### CR-02: Inline result parsing in the widget diverges silently from `_qq_apply_result` — `replace-buffer` with empty `lbuffer` is accepted

**File:** `shell/zsh/qq.zsh:246-256`

**Issue:** The ZLE widget contains a second, inline copy of the result-parsing logic (lines 239-267) that runs after the FIFO read. This copy and `_qq_apply_result` (lines 94-139) are intended to be equivalent, but they diverge in one important way: `_qq_apply_result` checks `$?` after extracting `lbuffer` and restores the original buffer on failure (line 117-120). The inline copy instead checks `$_jq_lbuf_status` and `$_jq_rbuf_status` (lines 250-256) — correct in principle — **but it does not check whether `new_lbuffer` is empty**. The `jq -r '.lbuffer // empty'` expression returns an empty string (exit 0) when `.lbuffer` is the JSON empty string `""`. The inline copy therefore sets `LBUFFER=""` silently, erasing the user's shell line. `_qq_apply_result` has the same gap.

This is a data-loss risk: a provider returning `{"kind":"replace-buffer","lbuffer":"","rbuffer":""}` will clear the user's shell buffer with no warning.

**Fix:** After extracting `new_lbuffer` in both the inline block and in `_qq_apply_result`, add an emptiness guard:

```zsh
# In the inline block (qq.zsh ~line 253):
if [[ $_jq_lbuf_status -ne 0 ]] || [[ -z "$new_lbuffer" && $? -eq 0 ]]; then
  # lbuffer legitimately empty is unusual; treat as cancel
  LBUFFER="$QQ_ORIG_LBUFFER"
  RBUFFER="$QQ_ORIG_RBUFFER"
else
  LBUFFER="$new_lbuffer"
  RBUFFER="$new_rbuffer"
fi
```

Alternatively, validate in `writeShellResult` / the Zod schema that `lbuffer` has `min(1)` for `replace-buffer` results.

---

## Warnings

### WR-01: `parseResultMode` defaults missing `--result-mode` to `llm`, contradicting documentation

**File:** `src/cli/commands/client.ts:27`

**Issue:** When `--result-mode` is not passed at all (`mode === undefined`), `parseResultMode` returns `'llm'`, meaning a bare `qq client --request-file X --result-file Y` invocation immediately hits the live Claude API. The function comment and the `clientCommand` JSDoc both say the default is `cancel`. The discrepancy is a real-world footgun: any accidental invocation without `--result-mode` (e.g., from a script, from a test that forgets to pass the flag, or from a user experimenting on the command line) makes a live API call and blocks waiting for TTY input.

**Fix:**
```typescript
function parseResultMode(mode: string | undefined): ResultMode {
  if (mode === undefined) return 'cancel'; // documented default
  if (mode === 'llm') return 'llm';
  if (mode === 'cancel') return 'cancel';
  if (mode === 'replace-buffer-fixture') return 'replace-buffer-fixture';
  void appendDebugLog('client', `unknown --result-mode "${mode}", defaulting to cancel`);
  return 'cancel';
}
```

---

### WR-02: `downArrow` handler modulo-wraps on a stale `visible.length` of 0 — division by zero

**File:** `src/ui/CandidateSelect.tsx:94-96`

**Issue:** When `candidates` is non-null but the current `query` produces zero matches, `visible.length === 0`. The `downArrow` branch reaches `setSelectedIndex((i) => (i + 1) % visible.length)` which computes `N % 0 = NaN`. React will store `NaN` as the `selectedIndex`, and the subsequent `Enter` branch's guard (`if (visible.length === 0) return`) does protect against `onSelect` being called, but the stale `NaN` index persists until the query changes again. The `upArrow` branch (`i === 0 ? visible.length - 1 : i - 1`) also computes `visible.length - 1 = -1` when `visible.length === 0`, setting `selectedIndex` to `-1`.

These are not crashes but they leave persistent invalid state that could cause subtle rendering or selection bugs.

**Fix:** Guard both navigation branches when `visible.length === 0`:

```typescript
if (key.upArrow && candidates) {
  const visible = filterCandidates(candidates, query);
  if (visible.length === 0) return;
  setSelectedIndex((i) => (i === 0 ? visible.length - 1 : i - 1));
  return;
}

if (key.downArrow && candidates) {
  const visible = filterCandidates(candidates, query);
  if (visible.length === 0) return;
  setSelectedIndex((i) => (i + 1) % visible.length);
  return;
}
```

---

### WR-03: `onSelect` and `onCancel` callbacks in `run-foreground.ts` are declared `async` but Ink does not await them — unhandled rejection possible

**File:** `src/client/run-foreground.ts:147-162`

**Issue:** The `onSelect` and `onCancel` callbacks passed to `CandidateSelect` are `async` functions (they call `await writeShellResult`). Ink's `useInput` handler invokes them synchronously and does not await the returned Promise. If `writeShellResult` rejects (e.g., FIFO gone, disk full), the rejection becomes unhandled. The top-level `unhandledRejection` handler in `main.ts` will catch it and call `process.exit(1)`, which is safe but races with the `resolved` guard — if the rejection fires after `unmount()` returns but before the outer `Promise<void>` resolves, the process may exit before the shell widget reads from the FIFO.

**Fix:** Wrap the async bodies in `.catch()` inside the callbacks so errors are handled locally rather than leaking as unhandled rejections:

```typescript
onSelect: (command: string) => {
  if (resolved) return;
  resolved = true;
  writeShellResult(resultFile, {
    kind: 'replace-buffer',
    lbuffer: command,
    rbuffer: request.rbuffer,
  })
    .catch((err) => {
      void appendDebugLog('client', 'writeShellResult failed in onSelect', { err });
    })
    .finally(() => unmount?.());
},
```

---

### WR-04: `useEffect` query-reset clears `initialQuery` on first candidate arrival even when matches exist

**File:** `src/ui/CandidateSelect.tsx:57-62`

**Issue:** The `useEffect` that fires when `candidates` arrives (dependency: `[candidates]`) contains this logic:

```typescript
if (candidates && candidates.length > 0 && filterCandidates(candidates, query).length === 0) {
  setQuery('');
}
```

The intent is to clear `initialQuery` when it produces no matches in the candidate list. However, this effect also fires on the initial render if `candidates` is immediately non-null (e.g., in tests or future fast paths). On that first fire, `query` is already set to `initialQuery` from `useState`. If `initialQuery` happens to match zero candidates, `setQuery('')` is called. This is correct behaviour per the comment — but the condition reads `candidates.length > 0` without `candidates !== null`, which is redundant since the `&&` short-circuits, but more importantly the condition silently fires a second state update on every candidate array identity change (e.g., rerender with same logical content but new array reference). Since `useEffect` compares by reference, a parent that reconstructs the array on each render will trigger spurious query resets. This is low probability in the current code (candidates come from a single `fetchCandidates` call) but is a latent bug if the parent is ever refactored.

**Fix:** Use `useMemo` or stable references from the parent, or add an explicit "already-cleared" ref to prevent re-firing. At minimum, document the array-identity requirement as a constraint on the parent.

---

## Info

### IN-01: `_qq_apply_result` is defined but never called in the main widget flow

**File:** `shell/zsh/qq.zsh:94-139`

**Issue:** `_qq_apply_result` is a fully-implemented helper that reads a JSON result *file* and applies it. The widget (`qq-question-widget`, lines 239-267) does not call it — it instead re-implements the same logic inline against the `$result` string variable read from the FIFO. `_qq_apply_result` is only exercised via the integration test in `client-result.test.ts` (line 381). This means the tested code path (`_qq_apply_result`) and the production code path (inline in the widget) can diverge silently, as CR-02 demonstrates. Dead helper code also makes the file harder to reason about.

**Fix:** Either consolidate so the widget calls `_qq_apply_result`, or remove `_qq_apply_result` and inline its logic exclusively. Given the function is tested directly by integration tests, the cleaner fix is to make the widget write the FIFO result to a temp file and call `_qq_apply_result`:

```zsh
# After reading from FIFO:
printf '%s\n' "$result" > "$tmpdir/result.json"
_qq_apply_result "$tmpdir/result.json"
```

---

### IN-02: `vi.resetModules()` in handler tests does not isolate module-level side effects reliably across the two `describe` blocks

**File:** `tests/client-result.test.ts:567` and `tests/client-result.test.ts:596`

**Issue:** Both `uncaughtException` and `unhandledRejection` handler tests call `vi.resetModules()` then `await import('../src/cli/main.js')`. Because these two describes share the same test file and run sequentially, the second `import` after `vi.resetModules()` re-registers handlers on the same `process` object. Node does not deduplicate `process.on` listeners — it appends. After both tests run there are at least 4 listeners (`uncaughtException` × 2, `unhandledRejection` × 2) on the global `process`, plus however many prior runs registered. This does not cause test failures in isolation but can cause interference if the test suite is run with `--pool=forks` or if a future test triggers an uncaught exception — multiple handlers fire and `process.exit(1)` may be called more than once.

**Fix:** Use `process.removeAllListeners('uncaughtException')` and `process.removeAllListeners('unhandledRejection')` in `afterEach` within those describe blocks, or use `vi.isolateModules` instead of `resetModules + import`.

---

### IN-03: `key.delete` is absent from the `useInput` handler — only `key.backspace` is handled

**File:** `src/ui/CandidateSelect.tsx:76-79`

**Issue:** The search query editing only responds to `key.backspace`. On many terminals (and all macOS terminals in the default configuration), the `Delete` key (`key.delete` in Ink) generates a distinct sequence. Users pressing Delete to edit their search query will instead trigger the printable-char branch (`input && !key.ctrl && !key.meta`) and append the Delete character's escape sequence to the query string rather than deleting the last character. This is minor UX but will manifest for any macOS user who reaches for the Delete key.

**Fix:**
```typescript
if (key.backspace || key.delete) {
  setQuery((q) => q.slice(0, -1));
  return;
}
```

---

_Reviewed: 2026-05-21T13:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
