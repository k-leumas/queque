---
id: S04
parent: M001
milestone: M001
provides: []
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 
verification_result: passed
completed_at: 
blocker_discovered: false
---
# S04: Update Interface And Interactivity To Match That Of This Git

**# Phase 03.1 Plan 01: Wave 0 Test Infrastructure Summary**

## What Happened

# Phase 03.1 Plan 01: Wave 0 Test Infrastructure Summary

**One-liner:** Vitest TSX discovery enabled, ink mocked for modal-always path, and CandidateSelect Wave 2 test contracts scaffolded with it.skip.

## What Was Built

Wave 0 establishes the test infrastructure for Phase 03.1 before any source changes begin.

### Task 1: vitest.config.ts — TSX test discovery

Added `tests/**/*.test.tsx` to the `test.include` array. The new `candidate-select.test.tsx` file is now discovered and run by vitest.

### Task 2: client-result.test.ts — ink mock for modal-always path

Added `vi.mock('ink', ...)` that immediately invokes `onSelect` with the first candidate's command via `Promise.resolve().then()`. This prevents the "emits a replace-buffer result in llm mode" test from hanging when Wave 2 removes the single-candidate fast-accept bypass (D-03). The "QueQue is thinking..." assertion was already absent from the HEAD version.

### Task 3: tests/candidate-select.test.tsx — Wave 2 contract scaffold

Created the test file with 4 test cases (1 active smoke test, 3 skipped contracts):
- **Loading state smoke test** (active, passes): creates element with `candidates=null`, must not throw
- **filterCandidates logic** (skipped): Wave 2 must only accept "git status" when `initialQuery='git'`
- **Keyboard navigation** (skipped): Wave 2 must call `onCancel` when Escape is pressed via `useInput`
- **D-01 pre-filter** (skipped): Wave 2 must filter by `initialQuery` prop; only matching candidate selected on Enter

The 3 skipped tests use `it.skip` rather than being active RED tests, so the pre-commit hook (`pnpm test:run`) continues to exit 0 at Wave 0. Wave 2 changes `.skip` to regular `it` as it implements each feature.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Constraint] Used it.skip instead of active RED tests**

- **Found during:** Task 3 commit attempt
- **Issue:** The pre-commit hook runs `pnpm test:run` (full suite). Active failing tests would block all subsequent commits in this wave. The plan's `must_haves` says `pnpm test:run exits 0` which conflicts with keeping tests actively RED.
- **Fix:** Changed the 3 Wave 2 contract tests to `it.skip`. They are documented test contracts (not deleted), the file exists as required, and `pnpm test:run` exits 0. Wave 2 will remove `.skip` when implementing.
- **Files modified:** `tests/candidate-select.test.tsx`
- **Commit:** 048cd76

## Test Results

```
Test Files  12 passed (12)
Tests       98 passed | 3 skipped (101)
```

All existing tests continue to pass. The 3 skipped tests are Wave 2 contracts.

## Known Stubs

None — this plan only modifies test infrastructure, not production code.

## Self-Check

Files exist:
- [x] `tests/candidate-select.test.tsx` — FOUND
- [x] `vitest.config.ts` — FOUND (modified)
- [x] `tests/client-result.test.ts` — FOUND (modified)

Commits exist:
- [x] 8d826c4 — chore(03.1-01): extend vitest include to discover .test.tsx files
- [x] 59c43e7 — test(03.1-01): add ink mock to client-result tests for modal-always behavior
- [x] 048cd76 — test(03.1-01): scaffold candidate-select tests targeting Wave 2 behavior

## Self-Check: PASSED

# Phase 03.1 Plan 02: UI Support Components (Wave 1) Summary

Monocle-style dependency primitives: Modal at 80 cols, SearchInput with cyan SEARCH label, ControlsLine with ANSI 256 key badges, LoadingSpinner with dot-cycle frames and clearInterval cleanup.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create Modal.tsx with width=80, no footer prop | 3e86b9b | src/ui/Modal.tsx, tsconfig.json |
| 2 | Create SearchInput, ControlsLine, LoadingSpinner | d12001d | src/ui/SearchInput.tsx, src/ui/ControlsLine.tsx, src/ui/LoadingSpinner.tsx |

## Verification

- `ls src/ui/SearchInput.tsx src/ui/ControlsLine.tsx src/ui/LoadingSpinner.tsx` exits 0: PASS
- `grep -c 'width = 80' src/ui/Modal.tsx` returns 1: PASS
- `grep -c 'footer' src/ui/Modal.tsx` returns 0: PASS
- `grep -c 'clearInterval' src/ui/LoadingSpinner.tsx` returns 1: PASS
- `pnpm test:run` exits 0 (12 files, 98 tests passed, 3 skipped): PASS

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added jsx and tsx support to tsconfig.json**
- **Found during:** Task 1
- **Issue:** tsconfig.json had no `"jsx": "react"` setting and did not include `src/**/*.tsx` or `tests/**/*.tsx` in the `include` array. New `.tsx` component files would not be processed by TypeScript tooling.
- **Fix:** Added `"jsx": "react"` to compilerOptions and added `"src/**/*.tsx"` and `"tests/**/*.tsx"` to the include array.
- **Files modified:** tsconfig.json
- **Commit:** 3e86b9b

**2. [Deviation] Modal.tsx created from scratch rather than modified**
- **Found during:** Task 1 pre-flight
- **Issue:** The plan says to "modify" Modal.tsx but the file did not exist in the repository. The quick task (260502-qt-modal-candidate-ui) that was supposed to have created it was never committed to the repo.
- **Fix:** Created Modal.tsx fresh using the complete spec from PATTERNS.md and UI-SPEC.md. Final state matches the plan's intent exactly (width=80, no footer prop, innerWidth = width-4).
- **Files modified:** src/ui/Modal.tsx (new file)
- **Commit:** 3e86b9b

## Known Stubs

None. All components render their full intended content:
- SearchInput renders SEARCH: label + query or placeholder
- ControlsLine renders all key badges with correct ANSI 256 colors
- LoadingSpinner renders FRAMES[frame] with dot-cycle animation
- Modal renders title, separator, and children slot

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. LoadingSpinner's setInterval timer leak is mitigated by the `() => clearInterval(id)` cleanup return (T-032-01 per threat model). No new surface outside the plan's threat model.

## Self-Check: PASSED

- src/ui/Modal.tsx: FOUND
- src/ui/SearchInput.tsx: FOUND
- src/ui/ControlsLine.tsx: FOUND
- src/ui/LoadingSpinner.tsx: FOUND
- commit 3e86b9b: FOUND
- commit d12001d: FOUND

# Phase 03.1 Plan 03: Wave 2 Core Implementation Summary

Full monocle-style CandidateSelect with nullable candidates prop, live search, ┌> glyph, LoadingSpinner/SearchInput/ControlsLine composition, and modal-first async render pattern in run-foreground.ts with MODAL_CHROME_LINES=9 and rerender() push.

## What Was Built

### Task 1: CandidateSelect.tsx — monocle contract

Completely rewrote `src/ui/CandidateSelect.tsx` (replacing the old `CandidateSelect.ts`):

- **Nullable candidates prop (D-06)**: `candidates: CandidateList | null` — null triggers spinner, CandidateList triggers the candidate list
- **Live search (D-01/D-02)**: `initialQuery` prop pre-populates query state from `request.lbuffer`; printable chars append to query; Backspace removes last char
- **filterCandidates helper**: module-level function, case-insensitive substring match; returns full list when query is empty
- **Selection glyph**: `┌>` in `ansi256(166)` orange (monocle spec); 3-space indent for inactive rows
- **Component composition**: `SearchInput` → conditional content block → `ControlsLine` inside `Modal`
- **Error state**: `error?: boolean` prop renders "provider error — press esc to return" copy
- **Pitfall 2 fix**: `useEffect(() => setSelectedIndex(0), [candidates])` resets selection when candidates arrive
- **Pitfall 3 fix**: null-guard on navigation handlers so arrow/Enter don't fire when `candidates === null`

Wave 0 contract tests (3 previously skipped) were unskipped. The test strategy changed from `React.createElement` (which doesn't execute hooks) to calling the component function directly with mocked React hooks (`useState`, `useEffect`) — eliminating the need for a real React renderer while validating the useInput handler.

### Task 2: run-foreground.ts — modal-first async

Refactored the `llm` branch in `src/client/run-foreground.ts`:

- **MODAL_CHROME_LINES = 9** (was 7): border-top + title + separator + body-marginTop + search + gap + gap + controls + border-bottom
- **D-03: fast-accept bypass removed**: `if (candidates.length === 1)` block deleted; all candidate counts go through modal
- **D-05: showLoadingIndicator removed**: was absent; confirmed 0 occurrences
- **D-07: modal-first async pattern (Approach A)**: modal opens with `candidates: null` before `fetchCandidates` resolves; `app.rerender()` pushes resolved `CandidateList` into the live modal
- **Error state via rerender**: `.catch` handler calls `app.rerender(buildCandidateElement(null, true))` to show error copy inside the modal
- **TTY streams**: created from `ttyHandle.fd` with graceful fallback when fd is synthetic (test environments)
- **Viewport scroll zone**: `const modalHeight = MODAL_CHROME_LINES + 5`; blank zone written before render when ttyWriteStream is available

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Rewrite CandidateSelect with monocle contract | 7187358 | src/ui/CandidateSelect.tsx, tests/candidate-select.test.tsx |
| 2 | Modal-first async with rerender, MODAL_CHROME_LINES=9 | 2e5d257 | src/client/run-foreground.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] biome `useExhaustiveDependencies` false positive on candidates dep**

- **Found during:** Task 1 pre-commit hook
- **Issue:** biome flagged `[candidates]` in `useEffect` as "more dependencies than necessary". This is a false positive — `candidates` is a component prop and the dep is correct (we want to reset `selectedIndex` when candidates transition from null to list).
- **Fix:** Added `biome-ignore lint/correctness/useExhaustiveDependencies` comment with explanation.
- **Files modified:** `src/ui/CandidateSelect.tsx`
- **Commit:** 7187358

**2. [Rule 1 - Bug] biome `noArrayIndexKey` on candidate list map**

- **Found during:** Task 1 pre-commit hook
- **Issue:** biome flagged `key={candidate.command + '-' + index}` as using array index as key.
- **Fix:** Changed to `key={candidate.command}` (commands are unique within a CandidateList).
- **Files modified:** `src/ui/CandidateSelect.tsx`
- **Commit:** 7187358

**3. [Rule 3 - Blocking] TTY stream creation needed fallback for test environments**

- **Found during:** Task 2 testing
- **Issue:** `new tty.ReadStream(999)` (mock fd) threw EBADF in test environment, causing the outer catch to write `kind: 'cancel'` instead of letting the ink mock call `onSelect`.
- **Fix:** Wrapped TTY stream creation in try-catch; falls back to not passing stdin/stdout to `render()` when creation fails.
- **Files modified:** `src/client/run-foreground.ts`
- **Commit:** 2e5d257

**4. [Deviation] Wave 0 test strategy changed from `React.createElement` to direct component call**

- **Found during:** Task 1 — unskipping test cases
- **Issue:** The Wave 0 skipped tests used `React.createElement(CandidateSelect, ...)` which doesn't execute React hooks (no render tree). `capturedInputHandler` was never set, so assertions on `onSelect`/`onCancel` silently passed with optional chaining.
- **Fix:** Updated tests to call `CandidateSelect(props)` directly (treating it as a plain function) with mocked `useState`, `useEffect`, and all sub-components. This lets `useInput`'s mock capture the handler, enabling real keyboard simulation.
- **Files modified:** `tests/candidate-select.test.tsx`
- **Commit:** 7187358

## Verification

```
pnpm test:run: 12 test files, 101 tests — all PASS (0 skipped)
grep -c '❯' src/ui/CandidateSelect.tsx: 0 — PASS
grep -c '┌>' src/ui/CandidateSelect.tsx: 1 — PASS
grep -c 'showLoadingIndicator' src/client/run-foreground.ts: 0 — PASS
grep -c 'MODAL_CHROME_LINES = 9' src/client/run-foreground.ts: 1 — PASS
grep -c 'candidates.length === 1' src/client/run-foreground.ts: 0 — PASS
grep -v '^//' tests/client-result.test.ts | grep -c 'QueQue is thinking': 0 — PASS
```

## Known Stubs

None — all monocle contract behaviors ship in this plan:
- Spinner renders when `candidates === null` (wired to LoadingSpinner component)
- Live search filters candidates in real-time (filterCandidates implemented)
- `┌>` glyph renders in orange on active row
- Modal opens before fetchCandidates resolves (modal-first async)
- rerender() pushes resolved CandidateList into live modal

Deferred per plan scope:
- `Ctrl+F` toggle floating/tiled mode — deferred to future phase
- `Ctrl+R` toggle filter type — deferred to future phase
- Fuzzy matching (currently substring) — Phase 4 scope per REQUIREMENTS TUI-01

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundary crossings introduced.

T-033-05 (DoS: rerender after unmount) is mitigated as specified: React silently no-ops state updates on unmounted components; Ink's unmount is safe to call before rerender.

The `error` prop added to CandidateSelect accepts only a boolean — no user-supplied string flows into the error display (the copy is hardcoded).

## Self-Check: PASSED

Files exist:
- [x] `src/ui/CandidateSelect.tsx` — FOUND
- [x] `src/client/run-foreground.ts` — FOUND
- [x] `tests/candidate-select.test.tsx` — FOUND

Commits exist:
- [x] 7187358 — FOUND
- [x] 2e5d257 — FOUND

Tests: 101/101 passing
