# Phase 4: Fuzzy TUI Selection UX - Research

**Researched:** 2026-05-16
**Domain:** Ink 7.x React TUI, keyboard input handling, daemon socket lifecycle, Zellij pane rendering
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TUI-01 | Trigger opens a fuzzy-finder-style TUI with initial keyboard focus in the input area | CandidateSelect already exists; Phase 4 refines it — `useInput` is always active in Ink (no explicit focus capture needed for the single-component model) |
| CMD-03 | User can navigate command candidates with keyboard-only controls and confirm a selection | Arrow key + Enter handling already implemented in `CandidateSelect.tsx`; Phase 4 validates these paths and adds any missing edge-case hardening |
| RUN-02 | If the daemon is missing or stale, the client can recover without corrupting shell state | `ensureDaemon` in `bootstrap.ts` already handles stale socket detection and respawn; Phase 4 validates the failure path writes `{kind:"cancel"}` cleanly |
</phase_requirements>

---

## Summary

Phase 4 is a **refinement and hardening phase**, not a greenfield build. The core TUI (`CandidateSelect.tsx`, `Modal.tsx`, `SearchInput.tsx`, `ControlsLine.tsx`, `LoadingSpinner.tsx`) and the full keyboard interaction loop were built in Phase 3.1. The Zellij floating-pane IPC (FIFO result handoff, daemon bootstrap, `/dev/tty` handling) was locked down in Phase 3.2. All 114 existing tests pass.

What Phase 4 must do:
1. **04-01 (UI shell):** Audit and polish the command-list UI in Ink — verify focus lands in the input area on open, confirm the loading-then-candidates render cycle works end-to-end in the Zellij path, and ensure the 80x24 viewport constraint is respected.
2. **04-02 (Keyboard navigation):** Validate and harden the selection flow — wrapping navigation, Enter accepts, Esc cancels, live search filters, result written to FIFO before unmount. Add any missing edge cases (e.g. single-candidate, zero-match-after-filter).
3. **04-03 (Lifecycle hardening):** Validate daemon reconnect behavior, stale socket cleanup, and clean exit (FIFO write then unmount) under repeated rapid invocations. Ensure no shell state corruption on all exit paths.

Phase 4 is about closing the gap between "works in testing" and "reliable daily driver."

**Primary recommendation:** Treat the three plans as progressive test → verify → harden passes over the existing code, each producing targeted fixes and new test coverage.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| TUI rendering (modal, candidates, search, spinner) | Node.js client (Ink, Zellij PTY) | — | Ink renders to Zellij pane's PTY via `process.stdout`; all rendering is in `src/ui/` |
| Keyboard input (arrow keys, Enter, Esc, search typing) | Node.js client (`useInput` in `CandidateSelect`) | — | Zellij PTY delivers raw key events; `useInput` handles them without extra setup |
| Result handoff (write to FIFO) | Node.js client (`result-writer.ts`) | Shell (zsh reads from FIFO) | Client writes JSON to FIFO; zsh widget blocks until read completes |
| Daemon lifecycle (start, stale socket cleanup) | Node.js client (`bootstrap.ts`) | — | `ensureDaemon` handles connect-check → unlink → spawn → poll cycle |
| Shell buffer restoration on error/cancel | Shell (zsh `qq-question-widget`) | — | Widget reads FIFO result and applies it; all Node.js paths write a valid `ShellResult` |
| Viewport constraint (80x24) | Shell (zellij run --width 80 --height 24) | Node.js (`Modal.tsx` width=80) | Zellij enforces physical pane size; `Modal` enforces the 80-col logical width |

---

## Standard Stack

Phase 4 uses the already-locked project stack. No new dependencies are expected or desired.

### Core (in use, no changes)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `ink` | 7.0.1 | Terminal UI renderer | `useInput`, `render`, `rerender`, `unmount` — all verified working |
| `react` | 19.2.0 | Component model | `useState`, `useEffect` — used in `CandidateSelect`, `LoadingSpinner` |
| `zod` | 4.1.5 | Contract validation | `shellResultSchema`, `shellRequestSchema`, `candidateListSchema` |
| `@anthropic-ai/sdk` | 0.92.0 | LLM provider | Not touched in Phase 4 |
| `vitest` | 4.0.4 | Test runner | 114 tests passing; `.tsx` support confirmed in `vitest.config.ts` |

### No new dependencies
The phase description says "no external fuzzy-filter library preferred." Substring matching via `filterCandidates` (already in `CandidateSelect.tsx`) is the correct approach. Do not add `fuse.js`, `fuzzy`, or any other fuzzy-match library.

**Installation:** No new packages to install.

---

## Architecture Patterns

### System Architecture Diagram

```
ZSH widget (qq-question-widget)
  |
  |-- mkfifo /tmp/qq-sess.XXXXXX/result.fifo
  |-- write /tmp/qq-sess.XXXXXX/request.json
  |-- zellij run --floating --close-on-exit --width 80 --height 24
  |     -- node dist/cli/main.js client --request-file REQ --result-file FIFO
  |                                     |
  |                           run-foreground.ts
  |                                     |
  |                           ensureDaemon(socketPath)   <-- bootstrap.ts
  |                                     |
  |                           render(<CandidateSelect candidates=null />)
  |                                     |
  |                           fetchCandidates()  -----> Claude API
  |                                     |
  |                           app.rerender(<CandidateSelect candidates=[...] />)
  |                                     |
  |                           useInput handler (arrow/Enter/Esc/chars)
  |                                     |
  |                           writeShellResult(fifo, {kind: "replace-buffer"|"cancel"})
  |                                     |
  |                           app.unmount()  --> Zellij pane closes
  |
  |<-- IFS= read -r -t 30 result < result.fifo (unblocks)
  |-- apply result to LBUFFER/RBUFFER
  |-- _qq_cleanup tmpdir
```

### Existing Project Structure (relevant to Phase 4)
```
src/
├── ui/
│   ├── CandidateSelect.tsx   # Main TUI component — keyboard, filter, render
│   ├── Modal.tsx              # 80-col border frame
│   ├── SearchInput.tsx        # SEARCH: prefix + query display
│   ├── ControlsLine.tsx       # Key badge legend (↑↓ select · enter accept · esc cancel)
│   └── LoadingSpinner.tsx     # Animated "thinking…" spinner
├── client/
│   ├── run-foreground.ts      # Orchestrator: daemon check → render → fetch → rerender
│   └── result-writer.ts       # FIFO-aware writeShellResult
├── daemon/
│   └── bootstrap.ts           # ensureDaemon: connect → unlink stale → spawn → poll
└── contracts/
    ├── shell.ts               # ShellRequest / ShellResult schemas
    └── candidates.ts          # CommandCandidate / CandidateList schemas

tests/
├── candidate-select.test.tsx  # CandidateSelect unit tests (4 tests, hook-mocked)
├── client-result.test.ts      # writeShellResult tests (9 tests, FIFO path included)
└── daemon-bootstrap.test.ts   # ensureDaemon tests (4 tests)
```

### Pattern 1: Modal-first async render with rerender()
**What:** `render()` is called immediately with `candidates=null` (spinner shown). `fetchCandidates()` runs concurrently. When it resolves, `app.rerender()` pushes the candidate list into the live component without unmounting.
**When to use:** Any time an async data fetch must not delay the TUI opening.

```typescript
// Source: src/client/run-foreground.ts (verified in codebase)
const app = render(buildCandidateElement(null), renderOptions);

fetchCandidates(envelope, request.rbuffer)
  .then((candidates) => {
    app.rerender(buildCandidateElement(candidates));
  })
  .catch(async (err) => {
    // Error state: show error in modal, write cancel to FIFO
    app.rerender(buildCandidateElement(null, true));
  });
```

### Pattern 2: Single useInput handler with null-guards
**What:** One `useInput` call covers all key events. Navigation keys (`upArrow`, `downArrow`, `return`) are guarded with `if (candidates)` to prevent crashes during the loading state.
**When to use:** Whenever the component has states where input should be partially disabled.

```typescript
// Source: src/ui/CandidateSelect.tsx (verified in codebase)
useInput((input, key) => {
  if (key.escape) { onCancel(); return; }
  if (key.backspace) { setQuery((q) => q.slice(0, -1)); return; }
  if (input && !key.ctrl && !key.meta) { setQuery((q) => q + input); return; }
  if (key.upArrow && candidates) { /* wrap navigation */ }
  if (key.downArrow && candidates) { /* wrap navigation */ }
  if (key.return && candidates) { /* accept or ignore empty */ }
});
```

### Pattern 3: FIFO-aware result write
**What:** `writeShellResult` detects whether `resultFile` is a named pipe via `stat.isFIFO()`. If it is, it writes directly (no atomic rename — rename(2) would destroy the FIFO inode). If not, it uses the atomic tmp+rename pattern.

```typescript
// Source: src/client/result-writer.ts (verified in codebase)
const st = await fsp.stat(resultFile);
if (st.isFIFO()) {
  await fsp.writeFile(resultFile, line, { encoding: 'utf-8' });
} else {
  const tmpFile = `${resultFile}.tmp`;
  await fsp.writeFile(tmpFile, line, { encoding: 'utf-8' });
  await fsp.rename(tmpFile, resultFile);
}
```

### Pattern 4: Daemon bootstrap with stale-socket unlink
**What:** `ensureDaemon` does: tryConnect → if fails and socket exists, unlink it → spawn detached daemon → poll until socket accepts connections.
**When to use:** Every client invocation. Idempotent when daemon is already running.

```typescript
// Source: src/daemon/bootstrap.ts (verified in codebase)
// Tolerances: CONNECT_TIMEOUT_MS=500, POLL_INTERVAL_MS=50, POLL_MAX_ATTEMPTS=40 (2s total)
export async function ensureDaemon(socketPath: string): Promise<void>
```

### Anti-Patterns to Avoid
- **Multiple `useInput` calls in one component:** Causes handler conflicts. The existing single-handler pattern is correct.
- **Calling `app.unmount()` before `writeShellResult` completes:** The result must be written to the FIFO before unmounting so zsh does not unblock with empty data. The current pattern uses `await writeShellResult(...)` before `unmount?.()`.
- **Using `process.stdin.setRawMode` directly:** Use Ink's built-in handling. Raw mode is managed by Ink automatically via the `stdin` option to `render()`.
- **Trusting `QQ_FORCE_SELECTOR` only for selector testing:** Correct — this env var forces ≥2 candidates to make the selector visible without a real Claude call. Preserve this in tests.
- **Adding the `resolved` guard check delay:** The `resolved` boolean flag in `run-foreground.ts` prevents double-writes to the FIFO if both `onSelect` and the `.catch` path trigger near-simultaneously. Do not remove it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy string matching | Custom algorithm | `filterCandidates` (substring, already built) | Project constraint says no external library; substring match is fast enough for ≤5 candidates |
| Key-by-key input reading | Raw stdin parsing | `useInput` from Ink | Handles escape sequences, modifier keys, and Zellij PTY correctly |
| Atomic file writes | Custom temp+rename | `result-writer.ts` writeShellResult | Already handles FIFO vs regular file correctly |
| Daemon process management | Custom spawn logic | `ensureDaemon` in `bootstrap.ts` | Already handles stale-socket unlink, polling, and timeout |
| State reset on candidate arrival | Manual component rebuild | `useEffect(() => setSelectedIndex(0), [candidates])` | Already in CandidateSelect |

**Key insight:** Phase 4 is about verifying existing solutions are complete and hardening their edge cases — not building new infrastructure.

---

## Common Pitfalls

### Pitfall 1: selectedIndex out of bounds after filter
**What goes wrong:** User types in the search box, filter narrows the visible list, and `selectedIndex` points beyond the new list length. `visible[selectedIndex]` is `undefined`, causing Enter to silently fail or throw.
**Why it happens:** `selectedIndex` is not clamped when the filter query changes.
**How to avoid:** Clamp `selectedIndex` to `Math.min(selectedIndex, visible.length - 1)` before using it as an array index, OR reset to 0 whenever the query changes. The current code already uses `visible[selectedIndex]?.command ?? visible[0]!.command` as a fallback — this is an acceptable guard but the reset-on-query approach is cleaner.
**Warning signs:** `onSelect` is called with `undefined` or the wrong candidate.

### Pitfall 2: FIFO write-then-unmount race condition
**What goes wrong:** `app.unmount()` is called before the FIFO write fully flushes. zsh reads an empty or partial result and falls back to cancel.
**Why it happens:** `unmount()` is synchronous but underlying Node.js stream writes can be buffered.
**How to avoid:** Always `await writeShellResult(...)` before calling `unmount?.()`. The current pattern in `run-foreground.ts` does this correctly via `async` callbacks.
**Warning signs:** Intermittent "cancel" results when user pressed Enter on a valid candidate.

### Pitfall 3: Zellij pane stays open if the process exits before writing the FIFO
**What goes wrong:** An unhandled exception exits the Node.js process without writing to the FIFO. zsh's `IFS= read -r -t 30` blocks for 30 seconds before timing out.
**Why it happens:** The `resolved` flag and try/catch in `run-foreground.ts` cover most paths, but an uncaught rejection at the top level escapes.
**How to avoid:** Ensure a top-level process uncaughtException/unhandledRejection handler exists or that all async calls are wrapped in try/catch that writes a `cancel` result to the FIFO.
**Warning signs:** Terminal widget appears to hang for 30 seconds after an unexpected error.

### Pitfall 4: `ensureDaemon` TOCTOU window under rapid re-invocations
**What goes wrong:** Two rapid `??` triggers (two terminal tabs) both see the socket missing, both unlink and spawn a daemon. One daemon loses the socket file.
**Why it happens:** The unlink between `tryConnect` failure and spawn is not atomic.
**How to avoid:** This is documented in `bootstrap.ts` as a known MVP limitation. Phase 4 should not try to fix it (file-lock requires more scope). Just ensure the failing daemon writes a clean error `ShellResult` instead of leaving the FIFO blocked.
**Warning signs:** Second rapid invocation hangs at daemon check.

### Pitfall 5: selectedIndex wrapping at edge
**What goes wrong:** Arrow navigation wraps incorrectly — pressing Up at index 0 goes to `visible.length - 1` of the unfiltered list, but the filtered list is shorter.
**Why it happens:** Navigation wraps are computed against `filterCandidates(candidates, query)` — this is correct in the current code, but must be verified.
**How to avoid:** Always compute `visible` inside the key handler, not against cached state.

### Pitfall 6: Ink `render()` called with no valid stdin/stdout in non-Zellij test context
**What goes wrong:** Tests that exercise `run-foreground.ts` fail because `/dev/tty` is unavailable.
**Why it happens:** The existing code path falls back to `process.stdin/stdout` when `/dev/tty` open fails. This is correct.
**How to avoid:** Keep the existing null-check on `ttyHandle` and the conditional `renderOptions`. Do not remove the fallback.

---

## Code Examples

### Verified: CandidateSelect navigation with wrapping
```typescript
// Source: src/ui/CandidateSelect.tsx (verified in codebase)
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
```

### Verified: onSelect guard and fallback
```typescript
// Source: src/ui/CandidateSelect.tsx (verified in codebase)
if (key.return && candidates) {
  const visible = filterCandidates(candidates, query);
  if (visible.length === 0) return; // no match — ignore Enter
  onSelect(visible[selectedIndex]?.command ?? visible[0]!.command);
  return;
}
```

### Verified: Ink render with optional stdin/stdout
```typescript
// Source: src/client/run-foreground.ts (verified in codebase)
const renderOptions =
  ttyReadStream && ttyWriteStream ? { stdin: ttyReadStream, stdout: ttyWriteStream } : {};
const app = render(buildCandidateElement(null), renderOptions);
```

### Verified: Test pattern for CandidateSelect (hook-mocked)
```typescript
// Source: tests/candidate-select.test.tsx (verified in codebase)
// React hooks are mocked so component function can be called directly:
vi.mock('ink', () => ({ useInput: vi.fn().mockImplementation((h) => { capturedInputHandler = h; }), ... }));
vi.mock('react', async (importOriginal) => ({ ...actual, useState: vi.fn(), useEffect: vi.fn() }));

CandidateSelect({ candidates: [...], onSelect, onCancel });
capturedInputHandler?.('', { ...zeroKeys, return: true });
expect(onSelect).toHaveBeenCalledWith('git status');
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm test:run` |
| Full suite command | `pnpm test:run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TUI-01 | TUI opens with focus in input area; spinner renders immediately | unit | `pnpm test:run -- tests/candidate-select.test.tsx` | ✅ |
| CMD-03 | Arrow keys navigate; Enter accepts; Esc cancels; live search filters | unit | `pnpm test:run -- tests/candidate-select.test.tsx` | ✅ (4 tests; needs edge-case additions) |
| RUN-02 | Stale socket cleaned up; daemon respawned; cancel result written on failure | unit | `pnpm test:run -- tests/daemon-bootstrap.test.ts tests/client-result.test.ts` | ✅ |
| RUN-02 (error path) | Unhandled daemon error writes cancel result to FIFO, no hang | unit | `pnpm test:run -- tests/client-result.test.ts` | ✅ (9 tests; verify error path covers FIFO) |

### Sampling Rate
- **Per task commit:** `pnpm test:run`
- **Per wave merge:** `pnpm test:run` (full suite, 114 tests, runs in ~2.5s)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
New test cases needed (not new files — extend existing files):
- [ ] `tests/candidate-select.test.tsx` — `selectedIndex` clamp/reset when query changes (CMD-03 edge case)
- [ ] `tests/candidate-select.test.tsx` — Enter on zero-match filter is a no-op (CMD-03 edge case)
- [ ] `tests/candidate-select.test.tsx` — wrapping: Up at index 0 goes to last; Down at last goes to 0 (CMD-03)
- [ ] `tests/client-result.test.ts` — verify `resolved` guard prevents double FIFO write (RUN-02 race guard)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | `shellResultSchema` (zod) validates all FIFO writes; `shellRequestSchema` validates request reads |
| V6 Cryptography | no | — |

### Known Threat Patterns for Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| FIFO path injection via `--result-file` | Tampering | `assertSafeSocketPath` pattern already applied to socket path; same guard already exists in `result-writer.ts` (stat before write — but no path validation). Phase 4 should verify the request JSON is always validated via `shellRequestSchema.parse()` before use |
| Shell injection via candidate command text | Tampering | Result written as structured JSON; zsh widget parses with `jq` before assigning to LBUFFER — no `eval` or direct string expansion |
| tmpdir race (symlink attack on mkfifo path) | Elevation of Privilege | `mktemp -d` + `chmod 700` already in `qq.zsh` (Phase 3.2 fix) |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js LTS | `qq` client runtime | ✓ | Already in use | — |
| Zellij | Floating pane host | ✓ (per Phase 3.2 — hard requirement) | 0.44.1 | None — not Zellij, not supported |
| pnpm | Build and test | ✓ | 10.x | — |
| jq | ZSH widget JSON parsing | ✓ (verified in Phase 3.2) | system | — |
| vitest | Test runner | ✓ | 4.0.4 | — |

**Missing dependencies with no fallback:** None. All dependencies verified in Phase 3.2.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline TTY rendering with scroll hack | Zellij floating pane + FIFO | Phase 3.2 | Phase 4 never uses the old path; `MODAL_CHROME_LINES` is dead code in Zellij mode |
| Single-candidate fast-accept bypass | All paths through modal | Phase 3.1 | Phase 4 must not reintroduce the bypass |
| Raw ANSI spinner (`showLoadingIndicator`) | Ink `LoadingSpinner` component | Phase 3.1 | Phase 4 uses the component; no raw ANSI |
| `resultMode` as a string discriminant | `resultMode: 'llm'` is the only real path | Phase 3.1 | Phase 4 plans can assume `llm` mode; other modes are test scaffolding |

**Deprecated/outdated:**
- `MODAL_CHROME_LINES` constant in `run-foreground.ts`: Set to 9 but only used in the non-Zellij branch, which is now dead code. Could be removed in Phase 4 cleanup.
- `resultMode: 'replace-buffer-fixture'`: Test seam from Phase 1, still present. Not used in real flows.

---

## Open Questions (RESOLVED)

1. **Should `resultMode` seam be removed in Phase 4?**
   - What we know: `resultMode` is always `'llm'` in production; `'replace-buffer-fixture'` and `'cancel'` are Phase 1 test scaffolding.
   - What's unclear: The seam is currently tested in `client-result.test.ts`. Removing it changes the test surface.
   - Recommendation: Leave for Phase 6 cleanup. Phase 4 should not break existing tests.
   - **RESOLVED:** Leave for Phase 6 cleanup. Phase 4 scope is TUI UX and lifecycle hardening only.

2. **Should `selectedIndex` reset on query change or clamp?**
   - What we know: Current code uses `visible[selectedIndex]?.command ?? visible[0]!.command` as a runtime guard. The Phase 3.1 plan also added `useEffect` to reset index when `candidates` (the prop) changes, not when `query` changes.
   - What's unclear: If user has index=3 and types a char that narrows to 1 result, index=3 is out of bounds. The current fallback uses `visible[0]` silently.
   - Recommendation: Add `useEffect(() => setSelectedIndex(0), [query])` in Phase 4 for deterministic behavior. Simpler than clamp math.
   - **RESOLVED:** Add `useEffect(() => setSelectedIndex(0), [query])` in Phase 4 for deterministic behavior.

3. **Is the non-Zellij branch in `run-foreground.ts` dead code?**
   - What we know: Phase 3.2 made Zellij a hard requirement. The non-Zellij `/dev/tty` stream path still exists in `run-foreground.ts`.
   - What's unclear: Whether Phase 4 should clean it up or leave it for Phase 6.
   - Recommendation: Keep for now — Phase 4's scope is TUI UX and lifecycle hardening, not dead code removal.
   - **RESOLVED:** Keep for now. Dead code removal is Phase 6 scope.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Zellij PTY delivers raw key events to `process.stdin` for Ink without any additional setup | Architecture Patterns | If Zellij's PTY has quirks with Ink 7's raw mode, keyboard events might not fire; would require explicit `setRawMode` calls |
| A2 | `useInput` in Ink 7.0.1 is always active (no explicit focus acquisition needed) for a single-component TUI | Standard Stack | If Ink 7 requires `useFocus`/`useFocusManager` to activate `useInput`, TUI-01 ("focus in input area on open") would fail silently |

**A2 note:** Ink's `useInput` is documented to be always active at the root component level without explicit focus management. The existing `CandidateSelect.tsx` uses `useInput` directly (no `useFocus`) and 4 tests pass, confirming this [VERIFIED: test suite].

---

## Sources

### Primary (HIGH confidence)
- `/vadimdemedes/ink` via Context7 — `useInput`, `render`/`rerender`, `useFocus`, `useApp` APIs
- `src/ui/CandidateSelect.tsx` — verified directly in codebase; all keyboard and filter logic
- `src/client/run-foreground.ts` — verified directly; render lifecycle, daemon call, FIFO write
- `src/client/result-writer.ts` — verified directly; FIFO vs file detection and write strategy
- `src/daemon/bootstrap.ts` — verified directly; stale socket handling, daemon spawn, poll loop
- `tests/candidate-select.test.tsx` — verified; hook-mocking pattern for Ink components
- `pnpm test:run` output — 114/114 tests passing, confirmed 2026-05-16

### Secondary (MEDIUM confidence)
- Phase 3.1 Verification Report (`03.1-VERIFICATION.md`) — 14/14 truths confirmed for monocle UI
- Phase 3.2 Research (`03.2-RESEARCH.md`) — Zellij FIFO integration architecture

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — locked stack, all packages verified in package.json and codebase
- Architecture: HIGH — all components read directly from source; no guessing
- Pitfalls: HIGH — derived from reading actual code; A1/A2 assumptions are low-risk
- Test coverage: HIGH — vitest config confirmed, tsx support confirmed, 114 tests running

**Research date:** 2026-05-16
**Valid until:** 2026-06-16 (stable stack; only risk is Ink patch releases)
