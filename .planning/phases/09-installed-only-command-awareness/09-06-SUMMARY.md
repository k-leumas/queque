---
phase: 09-installed-only-command-awareness
plan: 06
subsystem: ui
tags: [ink, react, zellij, pane-resize, race, child_process, vitest, gap-closure]

requires:
  - phase: 09-installed-only-command-awareness
    provides: "CandidateSelect with tool-awareness flags and Tab install toggles (09-02..09-05); UAT gap G-09-7 diagnosis (.planning/debug/empty-modal-after-tool-awareness-reenable.md)"
provides:
  - "CandidateSelect resets on candidate arrival during render (prevCandidates), so the only layout height reported on arrival is the full-list estimate"
  - "syncZellijFloatingPaneHeight runs a serialized latest-wins queue, with release on child error and on a settle timeout"
  - "RESIZE_SETTLE_TIMEOUT_MS export (2000)"
  - "Real-hooks Ink regression test harness: tests/candidate-select-layout.test.tsx"
affects: [zellij, candidate-select, run-foreground, uat-test-7]

actuals:
  tokens: 12673
  tasks: 2
  commits: 4
plan_head_before: 9da51d90add9eaeb39d85d4456787989a2a61094
plan_head_after: 37edd9a

tech-stack:
  added: []
  patterns:
    - "Render-phase 'adjust state when a prop changes' (prevX useState) whenever another effect reports layout to an outside process"
    - "One-slot serialized latest-wins queue for detached CLI side effects whose completion order decides the outcome"
    - "Real-hooks Ink render in vitest with Writable/Readable TTY fakes plus waitUntilRenderFlush"

key-files:
  created:
    - tests/candidate-select-layout.test.tsx
    - .planning/phases/09-installed-only-command-awareness/deferred-items.md
  modified:
    - src/ui/CandidateSelect.tsx
    - src/client/zellij-pane-resize.ts
    - tests/candidate-select.test.tsx
    - tests/zellij-pane-resize.test.ts
    - .planning/debug/empty-modal-after-tool-awareness-reenable.md
    - .wolf/anatomy.md
    - .wolf/cerebrum.md
    - .wolf/memory.md
    - .wolf/buglog.json

key-decisions:
  - "G-09-7 fixed by two mechanisms: a render-phase candidate-arrival reset in CandidateSelect (prevCandidates) and a serialized latest-wins Zellij resize queue. Each removes one of the two race conditions at its source."
  - "SIGWINCH 'resize' wiring for the /dev/tty stream was not done. With both conditions removed it isn't needed, it can't restore pane scrollback, and it would change Ink's behaviour in the inline path."
  - "RESIZE_SETTLE_TIMEOUT_MS = 2000, about five times the slowest zellij action measured (about 420 ms). The timer is unref'd and kills a hung action."
  - "The RED commit for Task 2 also adds the RESIZE_SETTLE_TIMEOUT_MS export (constant only), because the pre-commit typecheck hook cannot be bypassed"

patterns-established:
  - "prevX render-phase reset: if (prop !== prevProp) { setPrevProp(prop); only call each setter whose value changes }"
  - "Fake Zellij in tests applies a height when its child exits (completion order), to model the real server"

requirements-completed: [SC-3]

coverage:
  - id: D1
    description: "When candidates arrive while the query still holds a non-matching lbuffer, CandidateSelect reports exactly one layout height (the full-list estimate) and never draws the 'no matches' frame, with or without tool awareness"
    requirement: SC-3
    verification:
      - kind: integration
        ref: "tests/candidate-select-layout.test.tsx#(a) a non-matching lbuffer reports only the full-list height and never draws no-matches"
        status: pass
      - kind: integration
        ref: "tests/candidate-select-layout.test.tsx#(b) flagged candidates (tool awareness on) report only the full-list height"
        status: pass
    human_judgment: false
  - id: D2
    description: "Inside Zellij, candidate arrival spawns exactly one change-floating-pane-coordinates action, at resolveZellijPaneHeight(full-list estimate)"
    requirement: SC-3
    verification:
      - kind: integration
        ref: "tests/candidate-select-layout.test.tsx#(c) inside Zellij the arrival spawns exactly one resize, to the full-list height"
        status: pass
    human_judgment: false
  - id: D3
    description: "A matching lbuffer still pre-filters on arrival (Phase 4 kept); arrival still resets selection and clears Tab toggles (D-09 kept)"
    verification:
      - kind: integration
        ref: "tests/candidate-select-layout.test.tsx#(d) an lbuffer that matches a command still pre-filters the list on arrival"
        status: pass
      - kind: unit
        ref: "tests/candidate-select.test.tsx (43 mocked-hook tests, incl. Tab toggle and query setter assertions)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Zellij resizes run one at a time and the newest requested height is the last one applied, even when the earlier action is slower; requests coalesce; an equal waiting height is dropped"
    verification:
      - kind: unit
        ref: "tests/zellij-pane-resize.test.ts#final applied height equals the last requested height when the earlier action is slower"
        status: pass
      - kind: unit
        ref: "tests/zellij-pane-resize.test.ts#requests made while an action runs collapse to the newest"
        status: pass
      - kind: unit
        ref: "tests/zellij-pane-resize.test.ts#a waiting height equal to the running height is dropped"
        status: pass
    human_judgment: false
  - id: D5
    description: "A resize action that fails to start (ENOENT) or hangs past RESIZE_SETTLE_TIMEOUT_MS never crashes the client and never blocks later resizes; every child is unref'd"
    verification:
      - kind: unit
        ref: "tests/zellij-pane-resize.test.ts#a spawn error releases the queue without throwing"
        status: pass
      - kind: unit
        ref: "tests/zellij-pane-resize.test.ts#a hung action is killed after RESIZE_SETTLE_TIMEOUT_MS"
        status: pass
      - kind: unit
        ref: "tests/zellij-pane-resize.test.ts#unrefs every spawned child so the client never waits for zellij"
        status: pass
    human_judgment: false
  - id: D6
    description: "Live Zellij: repeated `show me how to use z3??` runs, the UAT test 7 QQ_TOOL_AWARENESS=0 then re-enabled sequence, and fast filter/Backspace keep the candidate list visible"
    requirement: SC-3
    verification: []
    human_judgment: true
    rationale: "Needs a real Zellij floating pane and server-side resize ordering under live PTY output; the plan defers this to end-of-phase UAT (Task 2 human-check steps 1-3)"

duration: 17min
completed: 2026-10-11
status: complete
---

# Phase 9 Plan 06: Empty Zellij Modal (G-09-7) Summary

**The candidate-arrival reset now runs during render (prevCandidates), so the stale "no matches" height is never reported, and a serialized latest-wins Zellij resize queue makes the last height requested the last one applied**

## Performance

- **Duration:** 17 min
- **Started:** 2026-10-11T09:58:23Z
- **Completed:** 2026-10-11T10:15:49Z
- **Tasks:** 2
- **Files modified:** 11 (5 source/test, 6 records)

## Accomplishments

- On candidate arrival, CandidateSelect commits the full list on its first frame. It reports one layout height and draws no "no matches" frame, because the arrival reset runs during render and React retries before commit.
- Inside Zellij, that arrival spawns exactly one `zellij action change-floating-pane-coordinates`, to the full-list height. Before the fix it spawned two (heights 8 and 17 in the test, 9 and 24 in the live repro).
- `syncZellijFloatingPaneHeight` runs at most one action at a time, and the newest waiting height wins. This covers every source of rapid height changes, including typing, Backspace and arrows across the ⚠ footer.
- The resize path can no longer crash the client: a missing `zellij` used to raise an unhandled `'error'` event. It also can no longer stall, because a hung action is killed after 2 s.
- Added a real-hooks Ink regression harness (no react/ink mocks) that can see effect ordering. The mocked candidate-select.test.tsx never could.

## Task Commits

1. **Task 1: Tracer — non-matching lbuffer reports one layout height and spawns one Zellij resize**
   - RED `8b4c1c9` (test): failing real-hooks test
   - GREEN `9a7d4cf` (fix): render-phase prevCandidates reset, plus wolf records
2. **Task 2: Zellij resizes run one at a time and the newest height always wins**
   - RED `7e649e5` (test): failing ordering tests, plus the RESIZE_SETTLE_TIMEOUT_MS constant only
   - GREEN `37edd9a` (fix): serialized queue, plus buglog, debug session and wolf records

**Plan metadata:** recorded in the docs(09-06) commit that adds this SUMMARY

## RED Evidence

**Task 1:** `pnpm exec vitest run tests/candidate-select-layout.test.tsx` against the unchanged component. (a) to (c) failed and (d) passed:
- (a) plain candidates: `expected [ 6, 15 ] to not include 6`. The reports were [noMatch=6, full=15].
- (b) flagged via annotateCandidates: `expected [ 6, 17 ] to not include 6`. The reports were [noMatch=6, full=17].
- (c) Zellij, real syncZellijFloatingPaneHeight: spawned heights `[ '8', '17' ]`, expected `[ '17' ]`.
- (d) `smt2` pre-filter: passed (behaviour kept).
- Classifier: `gsd-tools check tdd-red-evidence` on the tap-flat run of target (a) returned `RED_EVIDENCE_OK` (target_test_failed, exit 1). Semantic assessment: the target ran and failed on the planned `not.toContain(noMatch)` assertion, and the stale no-match report is the G-09-7 mechanism. It was not a load, syntax or fixture failure.

**Task 2:** `pnpm exec vitest run tests/zellij-pane-resize.test.ts` against the fire-and-forget helper. New tests 1 to 5 failed, and the 5 original tests plus the unref test passed:
1. Completion-order race: `expected 9 to be 24`. Applied ended at 9, because the slower stale shrink exited last.
2. Coalescing: `expected [...] to have a length of 1 but got 4`.
3. Equal-height drop: `to have a length of 1 but got 3`.
4. Spawn error: `expected [Function] to not throw an error but 'Error: spawn zellij ENOENT' was thrown`. This was the latent unhandled-'error' crash.
5. Hung action: `to have a length of 1 but got 2`. The waiting height spawned immediately instead of after the settle timeout.
- Classifier: target 1 returned `RED_EVIDENCE_OK` (target_test_failed). Semantic assessment: it failed on the planned `applied.at(-1)` assertion, which is the G-09-7 completion-order race.

## GREEN

- Task 1: with the render-phase reset, all 4 layout tests pass. Each case reports only the full or filtered estimate, and (c) records one spawn. The mocked suite passes 43/43, and the only edit there is the effect count changing from 4 to 3.
- Task 2: the queue passes all 11 resize tests. The layout harness's fake child (which exits on setImmediate) works unchanged with the queue.

## TDD Gate Compliance

RED commits come before their implementation commits (`test(09-06)` 8b4c1c9 → 9a7d4cf, and 7e649e5 → 37edd9a). The GREEN commits use the `fix(09-06)` type rather than `feat(09-06)`, because the plan asks for `fix(09-06)` subjects for this gap-closure bug fix. There was no REFACTOR commit because none was needed.

## Files Created/Modified

- `tests/candidate-select-layout.test.tsx`: new. Real Ink render with 78x22 TTY fakes, covering cases (a) to (d). Spies on `node:child_process` spawn through an importOriginal spread.
- `src/ui/CandidateSelect.tsx`: fourth useState `prevCandidates` plus a render-phase arrival reset; the effect keyed on candidates is removed.
- `tests/candidate-select.test.tsx`: the effect-count test now expects 3 effects (raw-mode guard, query reset, layout report).
- `src/client/zellij-pane-resize.ts`: serialized latest-wins queue (`spawnedHeight`, `waiting`, `current`, `settleTimer`), `'exit'`/`'error'`/timer settle, `RESIZE_SETTLE_TIMEOUT_MS`, and an extended test-only reset.
- `tests/zellij-pane-resize.test.ts`: fake-child factory, a fake Zellij that applies heights on exit, and 6 new queue tests. The 5 original tests are kept.
- `.planning/debug/empty-modal-after-tool-awareness-reenable.md`: Resolution fields fix, verification and files_changed filled in.
- `.planning/phases/09-installed-only-command-awareness/deferred-items.md`: new. Two older lint warnings and the bug-206 flake.
- `.wolf/anatomy.md`, `.wolf/cerebrum.md`, `.wolf/memory.md`, `.wolf/buglog.json` (bug-219 updated in place).

## Decisions Made

- Both race conditions are removed at their source, and SIGWINCH wiring is deliberately skipped (reasons in the plan objective, now also in the cerebrum Decision Log).
- In the queue, a waiting height equal to the in-flight height is dropped. A request made while idle that matches the last spawned height is deduplicated, as before.
- The `'error'` listener uses `on`, not `once`, so a second error event can never go unhandled. If `spawn` throws synchronously, the slot settles immediately.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The Task 2 RED commit includes the RESIZE_SETTLE_TIMEOUT_MS export**
- **Found during:** Task 2, RED commit
- **Issue:** The lefthook pre-commit `typecheck` rejected the test-only commit (TS2339: the `RESIZE_SETTLE_TIMEOUT_MS` export didn't exist yet), and hooks may not be bypassed.
- **Fix:** Added only the exported constant and its doc comment to `src/client/zellij-pane-resize.ts` in the RED commit, with no behaviour change. All 5 new tests still failed on their planned assertions before committing.
- **Files modified:** src/client/zellij-pane-resize.ts
- **Verification:** RED re-run showed 5 failed and 6 passed; typecheck exited 0.
- **Committed in:** 7e649e5

**2. [Rule 3 - Blocking] Undid the OpenWolf hook's rewrites of curated records**
- **Found during:** Task 1
- **Issue:** The post-Edit/Write hook replaced the curated anatomy.md descriptions for CandidateSelect.tsx and the test files with their first doc comment. It also appended an `auto-detected` refactor entry (bug-220) to buglog.json, which goes against the plan's "update bug-219 in place, no new entry".
- **Fix:** Restored the curated lines with the new facts added and dropped the auto entry before each commit. Recorded this as a cerebrum Key Learning.
- **Files modified:** .wolf/anatomy.md, .wolf/buglog.json, .wolf/cerebrum.md
- **Committed in:** 9a7d4cf, 37edd9a

---

**Total deviations:** 2 auto-fixed (both Rule 3, blocking)
**Impact on plan:** No change in scope. Production behaviour matches the plan exactly.

## Issues Encountered

- **`pnpm test:run` did not exit 0 because of the bug-206 timing guards under external load.** Load averages ran from 23 to 138, driven by Docker hyperkit, WindowServer and browsers, not by this suite. Following the plan's Step 3 rule, guards were not loosened, and each file was re-run on its own:
  - All other suites pass: `vitest run --exclude command-words-fuzz --exclude zsh-widget` gave 29 files and 457/457 tests.
  - `tests/zsh-widget.test.ts` passed 46/46 three times in a row, including handoff timing and daemon prewarm. Those had failed only in the parallel full run.
  - `tests/command-words-fuzz.test.ts` fails a different random 1–6 of the 33 crafted-input 1 s bounds on every run, each at 1004–1050 ms (spawn overhead). The lexer was not touched by 09-06. The user already accepted this as a tracked warning for phase 9 closure (bug-206, open; candidate fix: time the lexer inside the child).
- `pnpm typecheck` exited 0. `pnpm lint` exited 0, with 2 warnings that existed before this plan, logged in deferred-items.md. One is the unused `biome-ignore` on CandidateSelect's layout effect, reproduced on base 9da51d9; the plan said to leave that effect unchanged. `pnpm build` exited 0 (fresh dist/cli/main.js for the human check).

## Known Stubs

None.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- G-09-7's automated evidence is complete. The live Zellij re-test is queued for end-of-phase UAT using the fresh build. Run `qq_dev` first if the Homebrew widget loads last; `/tmp/qq-debug.log` should show `tool handoff written`.
  1. Type `show me how to use z3??` six times, pressing Esc between runs. The list should stay every time.
  2. Run the UAT test 7 sequence: `QQ_TOOL_AWARENESS=0`, then `??`, Esc, `unset QQ_TOOL_AWARENESS`, then `??` twice.
  3. Type a fast filter such as `smt`, then Backspace it away quickly. The pane should end at full-list size.
  4. Note, without failing the check, whether the top `queque › …` line is clipped. That would be the separate trailing-cursor-line issue that predates this plan.
- Phase 9 has no other open gap plans.

## Self-Check: PASSED

- FOUND: tests/candidate-select-layout.test.tsx, src/ui/CandidateSelect.tsx, src/client/zellij-pane-resize.ts, tests/zellij-pane-resize.test.ts, tests/candidate-select.test.tsx, deferred-items.md
- FOUND commits: 8b4c1c9, 9a7d4cf, 7e649e5, 37edd9a (`git rev-list --count 9da51d9..HEAD` = 4)
- Acceptance greps: no `vi.mock('react'|'ink')` (0), `setPrevCandidates` 2, `toHaveBeenCalledTimes(3)` 1, `RESIZE_SETTLE_TIMEOUT_MS` src 4 / tests 3, `'error'` 2; biome check on changed files exited 0; bug-219 fix and the debug files_changed name both source files

---
*Phase: 09-installed-only-command-awareness*
*Completed: 2026-10-11*
