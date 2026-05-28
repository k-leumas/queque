# Phase 4: Fuzzy TUI Selection UX - Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 5 (3 modify, 1 audit/minor, 1 audit-only)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/ui/CandidateSelect.tsx` | component | event-driven | `src/ui/CandidateSelect.tsx` (self — targeted additions) | exact |
| `tests/candidate-select.test.tsx` | test | event-driven | `tests/candidate-select.test.tsx` (self — extend) | exact |
| `tests/client-result.test.ts` | test | request-response | `tests/client-result.test.ts` (self — extend) | exact |
| `src/client/run-foreground.ts` | service | request-response | `src/client/run-foreground.ts` (self — audit/verify) | exact |
| `src/daemon/bootstrap.ts` | service | request-response | `src/daemon/bootstrap.ts` (self — audit-only) | exact |

---

## Pattern Assignments

### `src/ui/CandidateSelect.tsx` (component, event-driven)

**Analog:** itself — Phase 4 adds targeted fixes to the existing file.

**Imports pattern** (lines 1–7):
```typescript
import { Box, Text, useInput } from 'ink';
import React, { type ReactElement, useEffect, useState } from 'react';
import type { CandidateList } from '../contracts/candidates.js';
import { ControlsLine } from './ControlsLine.js';
import { LoadingSpinner } from './LoadingSpinner.js';
import { Modal } from './Modal.js';
import { SearchInput } from './SearchInput.js';
```

**Existing useEffect for selectedIndex reset on candidates arrival** (lines 56–62):
```typescript
// biome-ignore lint/correctness/useExhaustiveDependencies: candidates is a prop; reset on arrival is intentional
useEffect(() => {
  setSelectedIndex(0);
  if (candidates && candidates.length > 0 && filterCandidates(candidates, query).length === 0) {
    setQuery('');
  }
}, [candidates]);
```
**Phase 4 addition:** Add a second `useEffect` to reset `selectedIndex` to 0 whenever `query` changes. This prevents `selectedIndex` from being out-of-bounds after a filter narrows the visible list. Place it immediately after the existing `useEffect`:
```typescript
// Reset selectedIndex when the search query changes so it never points beyond
// the end of the newly-filtered visible list. useEffect with [query] dependency.
useEffect(() => {
  setSelectedIndex(0);
}, [query]);
```

**Single useInput handler with null-guards — core navigation** (lines 65–100):
```typescript
useInput((input, key) => {
  if (key.escape) { onCancel(); return; }
  if (key.backspace) { setQuery((q) => q.slice(0, -1)); return; }
  if (input && !key.ctrl && !key.meta) { setQuery((q) => q + input); return; }

  if (key.upArrow && candidates) {
    const visible = filterCandidates(candidates, query);
    setSelectedIndex((i) => (i === 0 ? visible.length - 1 : i - 1));
    return;
  }
  if (key.downArrow && candidates) {
    const visible = filterCandidates(candidates, query);
    setSelectedIndex((i) => (i + 1) % visible.length);
    return;
  }
  if (key.return && candidates) {
    const visible = filterCandidates(candidates, query);
    if (visible.length === 0) return; // zero-match guard — ignore Enter
    onSelect(visible[selectedIndex]?.command ?? visible[0]!.command);
    return;
  }
});
```
**Phase 4 verification:** The `visible.length - 1` wrap on upArrow and `% visible.length` wrap on downArrow are already computed against `filterCandidates(candidates, query)` inside the handler — this is correct. No change needed here; the new `useEffect([query])` above handles the stale-index scenario before the handler fires.

**Zero-match guard — already present** (line 96):
```typescript
if (visible.length === 0) return; // no match — ignore Enter
```
No change needed.

---

### `tests/candidate-select.test.tsx` (test, event-driven)

**Analog:** itself — Phase 4 appends new `describe` blocks at the bottom.

**Hook-mock infrastructure — copy verbatim for each new describe** (lines 13–106):
The mock infrastructure (Ink, React, sub-components, `zeroKeys`, `resetState`) is already defined at module scope. New test cases use the same `beforeEach(resetState)` pattern and call `await import('../src/ui/CandidateSelect.js')` inside each test.

**Existing test pattern to copy** (lines 154–176 — keyboard navigation describe):
```typescript
describe('CandidateSelect — keyboard navigation', () => {
  beforeEach(resetState);

  it('calls onCancel when Escape is pressed', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    CandidateSelect({
      candidates: [
        { command: 'git status', explanation: '' },
        { command: 'ls -la', explanation: '' },
      ],
      onSelect,
      onCancel,
    });

    capturedInputHandler?.('', { ...zeroKeys, escape: true });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

**New test cases to add — selectedIndex reset on query change:**
```typescript
describe('CandidateSelect — selectedIndex reset on query change', () => {
  beforeEach(resetState);

  it('resets selectedIndex to 0 when query changes (calls useEffect setter)', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const { useEffect } = await import('react');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    CandidateSelect({
      candidates: [
        { command: 'git status', explanation: '' },
        { command: 'ls -la', explanation: '' },
      ],
      onSelect,
      onCancel,
    });

    // useEffect([query]) should have been called and its callback registered
    expect(useEffect).toHaveBeenCalled();
  });
});
```

**New test cases to add — zero-match Enter is a no-op:**
```typescript
describe('CandidateSelect — zero-match after filter', () => {
  beforeEach(resetState);

  it('does not call onSelect when Enter is pressed with zero visible candidates', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    // initialQuery 'zzz' matches neither candidate → visible = []
    CandidateSelect({
      candidates: [
        { command: 'git status', explanation: '' },
        { command: 'ls -la', explanation: '' },
      ],
      onSelect,
      onCancel,
      initialQuery: 'zzz',
    });

    capturedInputHandler?.('', { ...zeroKeys, return: true });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
```

**New test cases to add — wrapping navigation:**
```typescript
describe('CandidateSelect — wrapping navigation', () => {
  beforeEach(resetState);

  it('wraps from index 0 to last candidate on upArrow', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    CandidateSelect({
      candidates: [
        { command: 'git status', explanation: '' },
        { command: 'ls -la', explanation: '' },
        { command: 'pwd', explanation: '' },
      ],
      onSelect,
      onCancel,
    });

    // selectedIndex starts at 0 — upArrow should wrap to last (index 2 → 'pwd')
    capturedInputHandler?.('', { ...zeroKeys, upArrow: true });
    capturedInputHandler?.('', { ...zeroKeys, return: true });

    expect(onSelect).toHaveBeenCalledWith('pwd');
  });

  it('wraps from last candidate to index 0 on downArrow', async () => {
    const { CandidateSelect } = await import('../src/ui/CandidateSelect.js');
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    CandidateSelect({
      candidates: [
        { command: 'git status', explanation: '' },
        { command: 'ls -la', explanation: '' },
      ],
      onSelect,
      onCancel,
    });

    // Move to last then wrap: downArrow from 0→1, downArrow from 1→0 (wrap), Enter
    capturedInputHandler?.('', { ...zeroKeys, downArrow: true }); // → index 1
    capturedInputHandler?.('', { ...zeroKeys, downArrow: true }); // → index 0 (wrap)
    capturedInputHandler?.('', { ...zeroKeys, return: true });

    expect(onSelect).toHaveBeenCalledWith('git status');
  });
});
```

**State slot tracking rule** (lines 54–76 — critical for test correctness):
`useState` calls are tracked by order of invocation in the component. Slot 0 = `selectedIndex`, Slot 1 = `query`. When adding the `useEffect([query])` hook, the slot numbering does not change because `useEffect` does not consume a slot. `stateSetters[0]` remains the `selectedIndex` setter.

---

### `tests/client-result.test.ts` (test, request-response)

**Analog:** itself — Phase 4 appends one new `describe` block.

**Existing mock structure to rely on** (lines 13–126):
All mocks (`ensureDaemon`, `socket-path`, `claude.js`, `node:fs/promises`, `ink`) are defined at module scope and remain active for new describe blocks. New tests must use `vi.clearAllMocks()` in `beforeEach` just like the Zellij describe block does (line 415).

**`resolved` guard in run-foreground.ts — the pattern to test** (lines 147–163 of run-foreground.ts):
```typescript
let resolved = false;

onSelect: async (command: string) => {
  if (resolved) return;       // guard: prevent double-write
  resolved = true;
  await writeShellResult(resultFile, { kind: 'replace-buffer', ... });
  unmount?.();
},
onCancel: async () => {
  if (resolved) return;       // guard: prevent double-write
  resolved = true;
  await writeShellResult(resultFile, { kind: 'cancel' });
  unmount?.();
},
```

**New test case to add — resolved guard prevents double FIFO write:**
```typescript
describe('runForegroundClient: resolved guard prevents double write', () => {
  let tmpDir: string;
  let requestFile: string;
  let resultFile: string;

  const sampleRequest = {
    version: 1 as const,
    ttyPath: '/dev/tty',
    cwd: '/home/user',
    shellPid: 1234,
    lbuffer: 'list files',
    rbuffer: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qq-resolved-test-'));
    requestFile = path.join(tmpDir, 'request.json');
    resultFile = path.join(tmpDir, 'result.json');
    fs.writeFileSync(requestFile, JSON.stringify(sampleRequest) + '\n');
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('writes result only once even when both onSelect and error path fire', async () => {
    // Ink mock calls onSelect immediately after rerender; the .catch path should
    // hit `if (resolved) return` and not overwrite the already-written result.
    const { fetchCandidates } = await import('../src/providers/claude.js');
    vi.mocked(fetchCandidates).mockResolvedValue([{ command: 'git status', explanation: '' }]);

    const fspMock = await import('node:fs/promises');
    const writeFileSpy = vi.spyOn(fspMock, 'writeFile');

    const { runForegroundClient } = await import('../src/client/run-foreground.js');
    await runForegroundClient({ requestFile, resultFile, resultMode: 'llm' });

    const resultContent = fs.readFileSync(resultFile, 'utf-8');
    const parsed = JSON.parse(resultContent.trim());
    // Result must be the replace-buffer from onSelect, not overwritten by cancel
    expect(parsed.kind).toBe('replace-buffer');
    expect(parsed.lbuffer).toBe('git status');

    // writeFile (or rename) must not have been called a second time with cancel
    const cancelWrites = writeFileSpy.mock.calls.filter((args) =>
      typeof args[1] === 'string' && args[1].includes('"cancel"')
    );
    expect(cancelWrites).toHaveLength(0);
  });
});
```

**Pattern for imports in the new describe block** — reuse the module-scoped `fs`, `fsp`, `os`, `path` imports already at the top of the file (lines 1–7). No additional imports required.

---

### `src/client/run-foreground.ts` (service, request-response — audit/minor)

**Analog:** itself — Phase 4 audits and confirms these paths without new structure.

**`resolved` guard structure to verify** (lines 147–195):
Both `onSelect` and `onCancel` callbacks check `if (resolved) return` before writing. The `.catch` on `fetchCandidates` also checks `if (resolved) return` at line 184. All three paths must check the guard before any `writeShellResult` call. Verify:
1. `onSelect` — lines 147–155: guard present ✓
2. `onCancel` — lines 157–162: guard present ✓
3. `.catch` path — lines 181–192: guard present ✓

**Error path writes cancel to FIFO — outer try/catch** (lines 198–207):
```typescript
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  void appendDebugLog('client', 'llm request failed', { message });
  await writeShellResult(resultFile, {
    kind: 'error',
    message: `QueQue: ${message} — press any key`,
  });
}
```
This outer catch (wrapping the entire `llm` branch) ensures any synchronous throw before the `Promise` block still writes a result. Verify this path covers: (a) `classifyIntent` throw, (b) `gatherContext` throw, (c) `new tty.ReadStream` throw outside the inner catch.

**TTY stream creation fallback** (lines 115–124):
```typescript
let ttyReadStream: tty.ReadStream | undefined;
let ttyWriteStream: tty.WriteStream | undefined;
if (ttyHandle) {
  try {
    ttyReadStream = new tty.ReadStream(ttyHandle.fd);
    ttyWriteStream = new tty.WriteStream(ttyHandle.fd);
  } catch {
    // Synthetic fd (e.g. tests) — Ink will use process.stdin/stdout
  }
}
```
Phase 4 verification: the `catch {}` silently swallows the exception and falls back to undefined streams. The `renderOptions` then becomes `{}` (line 166), which means Ink uses `process.stdin/stdout`. This is correct and must not be changed.

**`MODAL_CHROME_LINES` dead constant** (not currently visible in the read — RESEARCH.md notes it is set to 9 but only used in the non-Zellij branch, now dead code): Phase 4 scope says leave it for Phase 6. Do not remove.

---

### `src/daemon/bootstrap.ts` (service, request-response — audit-only)

**Analog:** itself — Phase 4 audits only; no modifications expected.

**`assertSafeSocketPath` guard** (lines 60–72):
```typescript
function assertSafeSocketPath(socketPath: string): void {
  const resolved = path.resolve(socketPath);
  const base = path.basename(resolved);
  const dir = path.dirname(resolved);
  const tmpRoots = ['/tmp', '/private/tmp'];
  if (!tmpRoots.includes(dir) || !base.startsWith('qq-') || !base.endsWith('.sock')) {
    throw new Error(`unsafe socket path rejected: ${socketPath}`);
  }
}
```
Phase 4 verification: this guard fires before any socket I/O. Confirm it is the first call in `ensureDaemon` (line 87). Stale-socket unlink TOCTOU note is documented as an MVP limitation (lines 99–106); Phase 4 must not attempt to fix it.

**Stale socket unlink → spawn → poll pattern** (lines 104–130):
```typescript
try { fs.unlinkSync(socketPath); } catch { /* not present — fine */ }

const child = spawn(qqBin, [qqScript, 'daemon', '--socket', socketPath], {
  detached: true, stdio: 'ignore',
});
child.unref();

const started = await waitForSocket(socketPath);
if (!started) {
  throw new Error(`qq daemon did not start within the expected window (${socketPath})`);
}
```
Phase 4 verification: the `throw` on startup timeout bubbles up through `runForegroundClient`'s outer try/catch (run-foreground.ts line 198), which writes an `error` ShellResult. Confirm this path does not leave the FIFO unwritten.

---

## Shared Patterns

### Hook-mocking pattern for Ink components
**Source:** `tests/candidate-select.test.tsx` lines 20–106
**Apply to:** All new test cases in `tests/candidate-select.test.tsx`

The module-level mocks for `ink`, `react`, and the UI sub-components are shared across all `describe` blocks in the file. Every new `describe` block must call `beforeEach(resetState)` to clear `capturedInputHandler`, `stateValues`, `stateSetters`, `stateCallCount`, and all `vi.fn()` call histories. The `resetState` function at lines 100–106 is the canonical reset implementation.

```typescript
function resetState() {
  capturedInputHandler = undefined;
  stateValues = [];
  stateSetters = [];
  stateCallCount = 0;
  vi.clearAllMocks();
}
```

### `resolved` double-write guard
**Source:** `src/client/run-foreground.ts` lines 147–162
**Apply to:** Any new callback registered on `CandidateSelect` props in `run-foreground.ts`

Every callback that calls `writeShellResult` must: (1) check `if (resolved) return` first, (2) set `resolved = true` before the await, (3) `await writeShellResult(...)` before calling `unmount?.()`.

### FIFO-aware write pattern
**Source:** `src/client/result-writer.ts` lines 22–47
**Apply to:** Any new code path that writes to `resultFile`

Never call `fsp.rename()` on a path that may be a named pipe. Always call `writeShellResult()` rather than writing directly — it handles the FIFO vs regular file branching internally and validates the schema.

### `vi.clearAllMocks()` in beforeEach
**Source:** `tests/client-result.test.ts` line 415; `tests/daemon-bootstrap.test.ts` line 47
**Apply to:** All new `describe` blocks in `tests/client-result.test.ts`

Any describe block that spies on or overrides mock implementations must call `vi.clearAllMocks()` in `beforeEach` so call counts and mock implementations do not bleed between tests.

### Dynamic import inside each `it()` block
**Source:** `tests/candidate-select.test.tsx` lines 116, 132, 159, 184
**Apply to:** All new test cases in `tests/candidate-select.test.tsx` and `tests/client-result.test.ts`

Because the module mocks are set up at the top of the file, modules under test must be imported inside each `it()` using `await import(...)` rather than a top-level static import. This ensures the mocked versions are picked up.

---

## No Analog Found

None — all five files have direct exact analogs (themselves) as the primary reference.

---

## Metadata

**Analog search scope:** `src/ui/`, `src/client/`, `src/daemon/`, `tests/`
**Files scanned:** 7 (5 primary + result-writer.ts + daemon-bootstrap.test.ts)
**Pattern extraction date:** 2026-05-16
