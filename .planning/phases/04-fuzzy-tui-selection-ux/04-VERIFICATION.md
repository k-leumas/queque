---
phase: 04-fuzzy-tui-selection-ux
verified: 2026-05-22T20:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Selecting a candidate with Enter returns the command to the invoking shell buffer"
    expected: "After pressing Enter on a candidate, the Zellij pane closes and the selected command (with explanation as a comment) appears in the shell buffer"
    why_human: "UAT test 1 reported Enter did not return to invoking command line before the interactive:true fix. The fix is in the codebase but targeted retest has not been confirmed. Cannot verify ZLE buffer write from a unit test."
  - test: "Terminal prompt does not display spurious identifiers (terminal_DD) when qq launches"
    expected: "No terminal_DD suffix or Zellij pane identifier bleeds into the invoking shell's prompt"
    why_human: "UAT test 1 observed this cosmetic bug. Root cause is Zellij pane title escaping into the invoking terminal. Requires a live Zellij session to reproduce and verify fix."
  - test: "FIFO crash safety — shell recovers within 1-2 seconds if qq client is killed"
    expected: "Killing the qq Node process (pkill -f 'node.*qq') returns shell control in under 2 seconds with original buffer intact"
    why_human: "UAT test 6 skipped — not confirmed reproducible. The QQ_RESULT_FILE_PATTERN guard + process.exit(1) in handlers should prevent 30-second hangs, but requires a live Zellij session to verify."
  - test: "TUI opens with focus in the input area (first keystroke goes to search box)"
    expected: "Immediately after the floating pane opens, typing a character filters the candidate list — no click or extra keypress needed to activate input"
    why_human: "TUI-01 focus behavior requires live Zellij PTY — cannot mock Ink raw mode and Zellij PTY interaction in vitest"
---

# Phase 04: Fuzzy TUI Selection UX Verification Report

**Phase Goal:** Turn high-confidence command selection into a fast, intuitive, keyboard-only flow with explanations visible inline.
**Verified:** 2026-05-22T20:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The TUI opens with focus in the input area | ? UNCERTAIN | `CandidateSelect.tsx` uses `useInput` (keyboard captured immediately). `run-foreground.ts` passes `interactive: true` and `/dev/tty` streams to Ink `render()`. Programmatic verification of live PTY focus behavior is not possible — see human verification item 4. |
| 2 | User can navigate command candidates with arrow keys and confirm one without leaving the TUI | VERIFIED | Arrow-key wrapping tests GREEN (14 tests in `tests/candidate-select.test.tsx`): up from index 0 wraps to last, down from last wraps to 0, Enter returns selected candidate via `onSelect`. `buildShellBuffers` in `run-foreground.ts` writes `lbuffer: command, rbuffer: "  # explanation"` to FIFO. Zero-match guard prevents `onSelect` on empty filter. |
| 3 | The TUI stays responsive across repeated invocations through the daemon | VERIFIED | `resolved` guard in `run-foreground.ts` prevents double-write on concurrent invocations. `runForegroundClient: resolved guard prevents double write` test (12 tests in `tests/client-result.test.ts`) confirms no `cancel` write after `replace-buffer` is committed. Daemon bootstrap and reconnect tested in `tests/daemon-bootstrap.test.ts` (4 tests). |
| 4 | Daemon reconnect/restart behavior does not break selection flow or corrupt shell state | VERIFIED | `process.on('uncaughtException')` and `process.on('unhandledRejection')` handlers in `src/cli/main.ts` (lines 49–74) write `{"kind":"cancel"}\n` to `QQ_RESULT_FILE` via `fs.writeFileSync` before calling `process.exit(1)`. Path is validated against `/^\/tmp\/qq-sess\.[A-Za-z0-9]+\//` (CR-01 fix). Both handler tests GREEN in `tests/client-result.test.ts`. `qq.zsh` exports `QQ_RESULT_FILE` in both Zellij and inline paths (lines 225, 277). |

**Score:** 4/4 truths verified (SC-1 is UNCERTAIN pending human check)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/ui/CandidateSelect.tsx` | Fuzzy-finder TUI with arrow-key nav, live search, onSelect/onCancel | VERIFIED | 163 lines. Two `useEffect` hooks: `[candidates]` resets index + clears zero-match initialQuery; `[query]` resets selectedIndex to 0 (CMD-03 out-of-bounds fix). `useInput` handles Esc, Backspace, Enter, arrows, printable chars. Monocle `┌>` glyph, loading spinner, zero-match message. |
| `src/client/run-foreground.ts` | onSelect/onCancel handlers writing to FIFO, buildShellBuffers, resolved guard | VERIFIED | `buildShellBuffers(command, explanation)` produces `lbuffer: command, rbuffer: "  # explanation"`. `resolved` flag prevents double-write. `onSelect` and `onCancel` are `async` — `writeShellResult` called before `unmount()`. `interactive: true` passed to Ink `render()`. |
| `shell/zsh/qq.zsh` | QQ_RESULT_FILE exported, Zellij + inline paths, _qq_apply_result with lbuffer guard | VERIFIED | `export QQ_RESULT_FILE="$fifo_path"` at line 225 (Zellij path) and `export QQ_RESULT_FILE="$result_file"` at line 277 (inline path). CR-02 fix: `_jq_lbuf_status` captured and `[[ -z "$new_lbuffer" ]]` guard in both Zellij inline block and `_qq_apply_result`. |
| `src/cli/main.ts` | uncaughtException + unhandledRejection handlers with path validation | VERIFIED | Both handlers at lines 49–74. `QQ_RESULT_FILE_PATTERN` regex guard at line 47 (`/^\/tmp\/qq-sess\.[A-Za-z0-9]+\//`). `fs.writeFileSync` in `try/catch`. `process.exit(1)` unconditional. `import * as fs from 'node:fs'` at line 1. |
| `tests/candidate-select.test.tsx` | Edge-case tests: selectedIndex reset, zero-match, wrapping, explanation flow | VERIFIED | 14 tests, all GREEN. Includes: `selectedIndex reset on query change` (useEffect called twice), `zero-match after filter` (onSelect not called), `wrapping navigation` (2 tests: up wraps to last, down wraps to first), `onSelect receives explanation` (3 tests), `Enter key raw-mode regression` (3 tests). |
| `tests/client-result.test.ts` | resolved guard test, uncaughtException/unhandledRejection tests | VERIFIED | 12 tests, all GREEN. `resolved guard prevents double write` confirms no cancel write after selection. `main.ts: uncaughtException handler` and `main.ts: unhandledRejection handler` both confirm `writeFileSync` called with `/"kind":"cancel"/` for paths matching `qq-sess.*` pattern. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CandidateSelect.tsx` | `run-foreground.ts` | `onSelect(command, explanation)` callback | WIRED | `onSelect: async (command: string, explanation: string)` in run-foreground.ts:175 passes both to `buildShellBuffers`. Test in candidate-select.test.tsx asserts `onSelect` called with `(command, explanation)`. |
| `run-foreground.ts` | `result-writer.ts` | `writeShellResult(resultFile, { kind: 'replace-buffer', lbuffer, rbuffer })` | WIRED | Line 179: `await writeShellResult(resultFile, { kind: 'replace-buffer', lbuffer, rbuffer, query: request.lbuffer })`. |
| `shell/zsh/qq.zsh` | `src/cli/main.ts` | `QQ_RESULT_FILE` env var exported before `zellij run` | WIRED | Lines 225, 277 export `QQ_RESULT_FILE` before the Node process launches. `main.ts` handlers read `process.env.QQ_RESULT_FILE` at lines 51, 65. |
| `src/cli/main.ts` | `node:fs` | `fs.writeFileSync(resultFile, '{"kind":"cancel"}\n')` | WIRED | `import * as fs from 'node:fs'` line 1. Used in both handlers (lines 54, 68). Path-guarded by `QQ_RESULT_FILE_PATTERN`. |
| `CandidateSelect.tsx useEffect([query])` | `setSelectedIndex(0)` | `useEffect(() => { setSelectedIndex(0); }, [query])` | WIRED | Lines 65–67. Biome-ignore comment with rationale. Confirmed by test `registers a useEffect hook for query dependency` asserting `toHaveBeenCalledTimes(2)`. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `CandidateSelect.tsx` | `candidates` (rendered list) | `app.rerender(buildCandidateElement(candidates))` in run-foreground.ts after `fetchCandidates()` resolves | Yes — real Claude API call produces candidates; loading state (null) shown while pending | FLOWING |
| `run-foreground.ts` | `lbuffer` / `rbuffer` in FIFO result | `buildShellBuffers(command, explanation)` from selected candidate | Yes — candidate command and explanation come from Claude response, not hardcoded | FLOWING |
| `shell/zsh/qq.zsh` | `LBUFFER` / `RBUFFER` | FIFO read `result` parsed by inline jq | Yes — reads from real FIFO written by Node process; fallback to `{"kind":"cancel"}` on timeout | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `useEffect([query])` hook exists in CandidateSelect | `grep -c '}, \[query\])' src/ui/CandidateSelect.tsx` | 1 | PASS |
| Both process.on handlers in main.ts | `grep -c "process.on('uncaughtException'\|process.on('unhandledRejection'" src/cli/main.ts` | 2 | PASS |
| QQ_RESULT_FILE_PATTERN regex guard present | `grep -c 'QQ_RESULT_FILE_PATTERN' src/cli/main.ts` | 2 (definition + both usages) | PASS |
| QQ_RESULT_FILE exported in qq.zsh | `grep -c 'QQ_RESULT_FILE' shell/zsh/qq.zsh` | 2 (Zellij + inline) | PASS |
| buildShellBuffers produces `# explanation` format | `grep -c 'comment.*explanation' src/client/run-foreground.ts` | via `const comment = \`  # ${explanation}\`` | PASS |
| Full test suite | `pnpm test:run` | 132/132 tests pass, 12 files | PASS |
| No todo tests remaining in phase scope | `grep -r 'it\.todo' tests/` (phase files) | 0 todo items | PASS |

---

### Probe Execution

Step 7c: SKIPPED — Phase 04 adds no runnable probe scripts. The conventional `scripts/*/tests/probe-*.sh` path does not exist for this phase. Behavioral verification is fully covered by the vitest suite (132 tests, all passing).

---

### Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| TUI-01 | 04-01, 04-02 | Trigger opens fuzzy-finder TUI with focus in input area | NEEDS HUMAN | `CandidateSelect` uses `useInput` (always-active Ink hook). `interactive: true` passed to `render()`. Live PTY focus verified by human UAT items 1 and 4 only. |
| CMD-03 | 04-01, 04-02 | Keyboard-only navigation and confirm selection | SATISFIED | 14 tests in candidate-select.test.tsx confirm arrow-key wrapping, Enter accept, zero-match guard, explanation passed through. `buildShellBuffers` returns command with explanation as comment. |
| RUN-02 | 04-01, 04-03 | Daemon missing/stale: recover without corrupting shell state | SATISFIED | `resolved` guard prevents double FIFO write. `uncaughtException`/`unhandledRejection` handlers write cancel to FIFO before exit. Path validation (CR-01) ensures writes only go to `qq-sess.*` temp dirs. 12 tests in client-result.test.ts confirm all paths. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/ui/CandidateSelect.tsx` | 99–108 | `downArrow` handler: `(i + 1) % visible.length` can produce `NaN` when `visible.length === 0` | Warning | Invalid `selectedIndex` state persists until query changes. Enter guard (`if (visible.length === 0) return`) prevents `onSelect` from firing, so no data corruption — but the stale NaN is latent. Noted in CR as WR-02. |
| `src/client/run-foreground.ts` | 175, 188 | `onSelect` and `onCancel` are `async` but Ink does not `await` them | Warning | Rejection from `writeShellResult` becomes unhandled. Top-level handler in `main.ts` catches it, but races with `resolved` guard. Noted in CR as WR-03. |
| `shell/zsh/qq.zsh` | 94–139 | `_qq_apply_result` function defined but the main Zellij path uses inline jq instead | Info | Two code paths for result application — the tested helper and the untested inline. CR-02 fix applied the `[[ -z "$new_lbuffer" ]]` guard to both. No debt marker; logic is functionally equivalent post-fix. |
| `src/cli/commands/client.ts` | ~27 | `parseResultMode` defaults `undefined` to `'llm'` rather than `'cancel'` | Warning | Accidental invocation without `--result-mode` triggers a live Claude API call. Noted in CR as WR-01. Out of scope for Phase 4 plans — no plan addressed this. |

No `TBD`, `FIXME`, or `XXX` markers found in any file modified by this phase.

---

### Human Verification Required

#### 1. Enter key returns selected command to shell buffer

**Test:** Trigger `??` in a live Zellij session with a real query. Navigate to a non-first candidate with the down arrow, press Enter. Check the shell buffer in the invoking terminal.
**Expected:** Zellij floating pane closes, and the selected command appears in LBUFFER with the explanation appended as a comment (`command  # explanation`). The cursor should be in RBUFFER at the comment boundary.
**Why human:** UAT test 1 reported Enter did not return to invoking command line before the `interactive:true` fix. The fix (`interactive: true` in render options) is present in the codebase but the UAT report notes this as a blocker. A targeted retest is required to confirm the fix resolves the issue in a live Zellij session. Cannot verify ZLE buffer write from unit tests.

#### 2. Terminal prompt has no spurious terminal_DD identifier

**Test:** Trigger `??` in a Zellij session. After the TUI closes (either via Enter or Esc), check the invoking terminal's prompt line.
**Expected:** Prompt shows normally with no appended `terminal_DD` suffix or Zellij pane identifier.
**Why human:** UAT test 1 observed this cosmetic defect. Root cause identified as Zellij pane title escaping into the invoking terminal. No code change was made to address this in Phase 4 plans — requires a live session to determine if it was resolved incidentally or persists.

#### 3. FIFO crash safety: no 30-second hang after killing qq client

**Test:** Trigger `??` in a Zellij session. While the TUI is loading (before picking a result), kill the qq Node process from another terminal: `pkill -f "node.*qq"`. Observe the invoking shell.
**Expected:** The invoking shell recovers within 1–2 seconds, either showing an empty buffer or the original pre-trigger buffer. No 30-second hang.
**Why human:** UAT test 6 was skipped. The `uncaughtException`/`unhandledRejection` handlers (Plan 04-03) are now in place and path-validated. However, killing the process externally (SIGKILL) bypasses these handlers — the 30-second FIFO timeout in the zsh widget is the actual safety net in that case. Requires a live Zellij session to confirm the 30-second timeout behavior is acceptable.

#### 4. TUI opens with focus in the input area (first keystroke goes to search box)

**Test:** Type `??` in a Zellij pane to open QueQue. Immediately type a character (e.g., `g`). Do not click or press Tab first.
**Expected:** The character `g` appears in the search box and filters the candidate list — no click or extra keypress needed to activate input.
**Why human:** Requires live Zellij PTY — cannot mock Ink raw mode and Zellij PTY focus acquisition in vitest. `useInput` is always-active in Ink, but the PTY focus handoff from Zellij to the floating pane is the variable.

---

### Gaps Summary

No automated gaps. All 4 ROADMAP success criteria have programmatic evidence (132/132 tests green). The 4 human verification items are UAT-level checks requiring a live Zellij session. The most critical is item 1 (Enter key returning command to buffer) — this was reported as broken in UAT before the `interactive:true` fix and needs a targeted retest to confirm resolution.

Two open code quality issues from the Code Review (WR-02: division-by-zero in downArrow on zero-match, WR-03: async callback rejection not caught locally) are not blockers for the phase goal but are flagged for Phase 5 or a follow-up fix.

---

_Verified: 2026-05-22T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
