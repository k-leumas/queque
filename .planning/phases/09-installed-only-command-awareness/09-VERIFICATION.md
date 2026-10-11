---
phase: 09-installed-only-command-awareness
verified: 2026-10-11T10:57:00Z
status: passed
score: 12/13 must-haves verified (6/6 roadmap SCs, 4 on evidence + 2 by carried-forward user override; 6/7 plan 09-06 truths; 1 live-Zellij truth awaits human UAT)
covered_files: [".planning/phases/09-installed-only-command-awareness/09-01-PLAN.md", ".planning/phases/09-installed-only-command-awareness/09-01-SUMMARY.md", ".planning/phases/09-installed-only-command-awareness/09-02-PLAN.md", ".planning/phases/09-installed-only-command-awareness/09-02-SUMMARY.md", ".planning/phases/09-installed-only-command-awareness/09-03-PLAN.md", ".planning/phases/09-installed-only-command-awareness/09-03-SUMMARY.md", ".planning/phases/09-installed-only-command-awareness/09-04-PLAN.md", ".planning/phases/09-installed-only-command-awareness/09-04-SUMMARY.md", ".planning/phases/09-installed-only-command-awareness/09-05-PLAN.md", ".planning/phases/09-installed-only-command-awareness/09-05-SUMMARY.md", ".planning/phases/09-installed-only-command-awareness/09-06-PLAN.md", ".planning/phases/09-installed-only-command-awareness/09-06-SUMMARY.md", "docs/EXTENSIONS.md", "shell/zsh/queque.zsh", "src/client/run-foreground.ts", "src/client/tool-handoff.ts", "src/client/zellij-pane-resize.ts", "src/contracts/ipc.ts", "src/contracts/request.ts", "src/daemon/bootstrap.ts", "src/daemon/server.ts", "src/providers/claude-cli.ts", "src/providers/claude.ts", "src/providers/steering.ts", "src/shared/command-words.ts", "src/shared/tool-awareness.ts", "src/shared/tool-catalog.ts", "src/ui/CandidateSelect.tsx", "src/ui/ControlsLine.tsx", "src/ui/modal-layout.ts", "tests/candidate-select-layout.test.tsx", "tests/candidate-select.test.tsx", "tests/claude-cli-provider.test.ts", "tests/claude-provider.test.ts", "tests/client-result.test.ts", "tests/command-words-fuzz.test.ts", "tests/command-words.test.ts", "tests/controls-line.test.tsx", "tests/daemon-bootstrap.test.ts", "tests/daemon-fetch.test.ts", "tests/fixtures/command-words-cases.ts", "tests/fixtures/command-words-fuzz-child.mjs", "tests/modal-layout.test.ts", "tests/steering.test.ts", "tests/tool-awareness.test.ts", "tests/tool-handoff.test.ts", "tests/zellij-pane-resize.test.ts", "tests/zsh-widget.test.ts"]
covered_digest: "v3:sha256:5463336805244729d0161e6ee5f74fa01dc5fa8e30c11bf36212fbca2ec1142b"
behavior_unverified: 0
overrides_applied: 2 # SC-2 and SC-3 (naming) count in the score; the other 3 carried-forward overrides cover 09-01..09-05 plan must-haves
overrides:
  - must_have: "A candidate that uses a tool not in $commands is shown with a 'not installed' flag naming the tool"
    reason: "Accepted as designed. Checkpoint decision 2026-10-10 (612fa07): the row shows a cyan ⓘ before its explanation, and a selection-independent legend reads `ⓘ not installed[ · tab prepends the install command]`. At the user's request the legend names no tools, so the modal never changes height with the selection. The candidate's own command text shows the tool, and Tab shows the install packages. The flag, selectability and insertion-only parts of SC-3 are verified on evidence; only the 'naming the tool' clause is overridden."
    accepted_by: "user (Samuel Kimama)"
    accepted_at: "2026-10-10T21:00:37Z"
  - must_have: "D-08/D-14: ⊘ mark after the command, selection-dependent not-installed / will-install footers, tab install chip in ControlsLine"
    reason: "Superseded at the 2026-10-10 checkpoint by ⓘ before the explanation, a legend above the controls and a prop-less ControlsLine (3209e9b, 866956d, 05c3534, 612fa07, 88b08dc). The user accepted it as designed on 2026-10-10. The same applies to the D-11 copy `⊘ not installed: fd — no package manager found`: the legend drops the Tab clause when no visible row has an install form."
    accepted_by: "user (Samuel Kimama)"
    accepted_at: "2026-10-10T21:00:37Z"
  - must_have: "The widget handoff adds no more than ~10 ms to ?? startup on a machine with ~2k PATH commands"
    reason: "User: 'accept 12.37 ms'. The real interactive shell median is 12.37 ms (7 runs: 9.93, 10.34, 11.52, 12.37, 13.01, 13.50, 17.59) and the zsh -f median is 10.10 ms, both with 2,175 PATH commands and all measured at load average 20–40. 12.37 ms is accepted as meeting 'about 10 ms'. The automated 25 ms guard (median of 5 under zsh -f) still passes."
    accepted_by: "user (Samuel Kimama)"
    accepted_at: "2026-10-10T21:00:37Z"
  - must_have: "09-02: every crafted malformed input finishes in its own child process within a hard 1 s timeout"
    reason: "User decision 2026-10-10: bug-206 (Node child spawn time exceeds the 1 s per-input timeout under machine load) stays a tracked warning, not a phase gap. The lexer itself takes 0.003–0.025 ms per crafted input in process (0.0168 ms worst case in this run). The 20k and 5k child-process fuzz cases pass."
    accepted_by: "user (Samuel Kimama)"
    accepted_at: "2026-10-11T02:25:34Z"
  - must_have: "09-05: pnpm test:run exits 0"
    reason: "Environment-dependent for the same reason as bug-206 (accepted as a tracked warning by the user on 2026-10-10). Every phase test file passes. The only failures are the fuzz file's 1 s spawn-bound crafted cases, and only at load average 20–40. claude-exec.test.ts passes when run alone (2/2)."
    accepted_by: "user (Samuel Kimama)"
    accepted_at: "2026-10-11T02:25:34Z"
re_verification:
  previous_status: passed
  previous_score: 6/6 roadmap success criteria (4 on evidence, 2 by override)
  previous_verified: 2026-10-10T21:00:37Z (re-checked 2026-10-11T02:25:34Z)
  trigger: "UAT test 7 found G-09-7 (major) after the previous report; gap-closure plan 09-06 executed (8b4c1c9..e8677f3) plus post-execute commits 7351fa8 (review), 6b8a607 (security), a03cc38/77e1d3a (Nyquist tests). Covered files changed."
  gaps_closed:
    - "G-09-7 (code): candidate arrival no longer reports the stale 'no matches' height, and Zellij resizes are serialized latest-wins. Proven by real-hooks Ink tests and queue-ordering tests that fail against the pre-09-06 source (re-run independently in this verification). The live Zellij re-test remains a human UAT item."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "G-09-7 live re-test in Zellij (09-06 Task 2 human-check, UAT test 7 re-run). Open a zsh pane inside Zellij with the dev widget (run qq_dev first if the Homebrew widget loads last; /tmp/qq-debug.log should show 'tool handoff written'; dist/cli/main.js was rebuilt 2026-10-11 04:51 local, after the last src commit). (1) Type `show me how to use z3??` six times, Esc between runs. (2) `QQ_TOOL_AWARENESS=0`, then `show me how to use z3??` (no ⓘ), Esc, `unset QQ_TOOL_AWARENESS`, then `show me how to use z3??` twice. (3) With a list open, type `smt` quickly, then Backspace it away quickly."
    expected: "Steps 1–3 show the candidate list every time and keep it; the pane never shrinks to just the legend and controls, and after step 3 it ends sized to the full list. (Note but do not fail on: a one-row clip of the top `queque › …` line, a separate pre-existing Ink trailing-cursor issue.)"
    why_human: "Needs a real Zellij floating pane and real server-side ordering of `zellij action change-floating-pane-coordinates` under live PTY output. The tests mock spawn and model Zellij as applying heights in exit order; the real failure rate was 25–50% of runs before the fix, so only a live repeat run can confirm it is gone."
---

# Phase 9: Installed-Only Command Awareness Verification Report

**Phase Goal:** Suggestions favour tools that are actually installed, and any suggestion that uses a tool the user does not have is visibly flagged "not installed" (never silently dropped). The `??` widget hands zsh's freshly rehashed `$commands` and `$builtins` to the client (~7 ms, always current, including tools installed earlier in the same session); the prompt carries the installed ∩ curated-catalog tool list; each returned candidate's command words are checked against the installed set.
**Verified:** 2026-10-11T10:57:00Z
**Status:** human_needed
**Re-verification:** Yes. The previous report (passed, 2026-10-10) predates UAT gap G-09-7 and gap-closure plan 09-06. This round fully verifies 09-06 and regression-checks plans 09-01 to 09-05.

## Goal Achievement

Since the previous report, only five files changed (`git diff --stat 8f8bd78..HEAD -- src shell tests docs`), all from 09-06 and its Nyquist follow-up:

- `src/ui/CandidateSelect.tsx`
- `src/client/zellij-pane-resize.ts`
- `tests/candidate-select-layout.test.tsx` (new)
- `tests/candidate-select.test.tsx`
- `tests/zellij-pane-resize.test.ts`

The phase-9 mechanism (handoff, lexer, flagging, catalog steering, daemon capability) is unchanged, and its test files all pass in this run's full suite.

G-09-7 (an empty modal in Zellij) is closed in code, and both of its causes were removed at the source:

1. **No stale height on arrival.** `CandidateSelect.tsx:118-130` resets during render when `candidates !== prevCandidates`. It clears the selection, clears the Tab toggles, and clears a non-matching lbuffer query. The old effect keyed on candidates is gone. The layout effect (`CandidateSelect.tsx:149-178`) therefore never sees the stale `initialQuery` render.
2. **Ordered resizes.** `zellij-pane-resize.ts:81-185` runs one action at a time; the newest waiting height wins.
   - The slot is released on `exit`, on `error` (a missing zellij no longer crashes the client), on a synchronous spawn throw, or after a 2 s settle timeout that kills the action. The settle timer is unref'd.
   - The resize helper is still wired: `run-foreground.ts:283` passes `onLayoutLinesChange: inZellij ? syncZellijFloatingPaneHeight : undefined`, and `initialQuery: request.lbuffer` is at line 263.

**Independent RED reproduction.** HEAD was exported to the scratchpad and the two 09-06 source files were swapped back to `9da51d9`; nothing in the working tree changed. The new tests then fail with the same values the SUMMARY claims:

- (a) `expected [ 6, 15 ] to not include 6`
- (b) `[ 6, 17 ]`
- (c) spawned heights `[ '8', '17' ]`, expected `[ '17' ]`
- queue test 1: `expected 9 to be 24`
- the other queue tests: 7 more failures

With the 09-06 source in place, all of them pass.

**Mutation check of the D-09 test** (the Nyquist test "a new candidates array resets selection to row 0 and clears every Tab install toggle"). Removing `setInstallToggled(new Set())` makes it fail: the frame still contains `brew install z3 && …`. Removing `setSelectedIndex(0)` also makes it fail: Enter selects the wrong row. So 09-06 truth 3 is proven by behaviour, not just by the code being present.

### Observable Truths

#### Roadmap success criteria (the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC-1: A tool installed earlier in the same session is treated as installed on the next `??` | ✓ VERIFIED | Unchanged since the previous report: `queque.zsh` runs `rehash` on every call. `tests/zsh-widget.test.ts` ("SC-1: lists a tool created after the hash table was primed") passed in this run's full suite. UAT test 5 passed live. |
| 2 | SC-2: Handoff ≤ ~10 ms with ~2k PATH commands | ✓ PASSED (override) | The user accepted 12.37 ms (real shell) / 10.10 ms (`zsh -f`) on 2026-10-10. The automated 25 ms median guard passed in this run (zsh-widget file green). UAT test 9 passed live. |
| 3 | SC-3: A missing-tool candidate is shown with a "not installed" flag naming the tool; it remains selectable and insertion-only | ✓ PASSED (override, naming clause only) | The ⓘ flag, the legend, selectability and insert-only Enter are unchanged and tested; UAT tests 2–4 passed live. **"Shown … remains" inside Zellij (G-09-7):** fixed in code by 09-06 truths 1–5 below. The live re-test is the one human item. Naming clause: carried-forward user override. |
| 4 | SC-4: Builtins, reserved words, placeholders, `$VAR` and path commands are never flagged | ✓ VERIFIED | Lexer unchanged. command-words tests passed in this run. UAT test 6 passed live. |
| 5 | SC-5: Malformed output never hangs or crashes extraction (fuzz, hard per-input timeout) | ✓ VERIFIED | `tests/command-words-fuzz.test.ts` passed 36/36 when run alone (load 14). In the full parallel run (load ~19–70), one crafted case hit the 1 s spawn bound at 1015 ms. That is bug-206, a tracked warning the user accepted; lexer time per input is under 0.02 ms. |
| 6 | SC-6: The prompt carries only installed ∩ catalog, across every adapter | ✓ VERIFIED | Unchanged. steering, client-result and daemon-fetch tests passed in this run. |

#### Plan 09-06 must-haves (gap closure G-09-7)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 7 | Non-matching lbuffer on arrival: exactly one layout report (the full-list estimate), never the no-match estimate, and the no-match frame is never drawn. Real React effects and a real Ink render | ✓ VERIFIED | `tests/candidate-select-layout.test.tsx` cases (a) and (b) pass. The file has no `vi.mock('react'|'ink')`; it mocks only `node:child_process` spawn, through an importOriginal spread. Both cases fail against the pre-09-06 component (re-run here). |
| 8 | In Zellij, that arrival spawns exactly one `change-floating-pane-coordinates`, at `resolveZellijPaneHeight(full)` | ✓ VERIFIED | Case (c) passes with the real `syncZellijFloatingPaneHeight`. It fails against the old source (`['8','17']`). |
| 9 | A matching lbuffer still pre-filters; arrival resets the selection and clears every Tab toggle (D-09) | ✓ VERIFIED | Case (d) passes (`smt2` pre-filter). The Nyquist D-09 test passes and is mutation-sensitive for both setters (see above). The mocked suite passes 43/43. |
| 10 | At most one resize action runs at a time; requests collapse to the newest; the last applied height equals the last requested, even when the earlier action is slower | ✓ VERIFIED | Queue tests "final applied height equals the last requested height when the earlier action is slower" (asserts alive ≤ 1 and applied `[9, 24]`), "collapse to the newest" and "equal height dropped" all pass, and all fail on the old helper. Caveat: on the timeout path, WR-06 shows a narrow window where a killed child may overlap the next one. See Anti-Patterns (warning). |
| 11 | A resize that fails to start or hangs past `RESIZE_SETTLE_TIMEOUT_MS` never crashes the client or blocks later resizes | ✓ VERIFIED | Tests pass for: ENOENT `error` releases the queue; a synchronous spawn throw (Nyquist); a hung child killed at the 2 s timeout, with nothing spawned before it; child unref; settle-timer unref (Nyquist). All fail on the old helper. |
| 12 | `pnpm test:run`, `pnpm typecheck`, `pnpm lint` and `pnpm build` exit 0 | ✓ VERIFIED (bug-206 caveat) | Results by command: <ul><li>`pnpm typecheck` exit 0.</li><li>`pnpm lint` exit 0, with 2 older warnings logged in deferred-items.md.</li><li>`pnpm test:run` (run once): 30/31 files and 541/542 tests. The only failure is bug-206, in the fuzz file, which 09-06 did not touch. That file then passed 36/36 alone. The orchestrator reports 31/31 at low load.</li><li>`pnpm build`: not re-run, because it writes `dist/`. `dist/cli/main.js` is dated 04:51 local, newer than the last src commit at 04:15, which is consistent with the orchestrator's build pass.</li></ul> |
| 13 | Human end-of-phase UAT: repeated `show me how to use z3??` in a Zellij pane, including UAT test 7's disable/re-enable sequence, shows and keeps the list | ? UNCERTAIN (human) | Harvested from the 09-06 Task 2 `<human-check>`. Spawn is mocked in every test; only a live Zellij run can confirm it. |

**Score:** 12/13 truths verified (2 of them by carried-forward override); 0 present but behaviour-unverified; 1 awaiting human UAT; 0 failed.

#### Plans 09-01 to 09-05 must-haves (regression check)

None of their source files changed after the previous report, which verified them in detail. The previous report's override set (D-08/D-14 UI wording, 09-02's 1 s per-input bound, 09-05's test:run exit) is carried forward in the frontmatter unchanged.

This run re-ran every test file for those plans. All passed in the full suite: tool-awareness, tool-handoff, command-words, steering, modal-layout, controls-line, client-result, daemon-bootstrap, daemon-fetch, claude-provider, claude-cli-provider and zsh-widget. The fuzz file was the only exception: it passed when run alone, as described above.

All prohibitions from the previous report still hold. The 09-06 diff adds no Node-side tool discovery, no shell parser dependency, no auto-run, and no sampling parameters. The resize spawn stays argv-only with `stdio: 'ignore'`.

### Required Artifacts (09-06)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/ui/CandidateSelect.tsx` | Render-phase arrival reset using `prevCandidates` | ✓ VERIFIED | Lines 107 and 118-130. `setPrevCandidates` is called. Each setter runs only when its value changes. The old effect is removed. |
| `tests/candidate-select-layout.test.tsx` | Real-hooks Ink regression tests that call `rerender` | ✓ VERIFIED | 5 tests: cases (a) to (d) plus the D-09 test. No react/ink mocks. |
| `src/client/zellij-pane-resize.ts` | Serialized latest-wins queue with `RESIZE_SETTLE_TIMEOUT_MS` | ✓ VERIFIED | Lines 20 and 81-185. Listens for `'error'` with `on`. Settle timer is unref'd. |
| `tests/zellij-pane-resize.test.ts` | Ordering tests that use `RESIZE_SETTLE_TIMEOUT_MS` | ✓ VERIFIED | 13 tests pass: the 5 original, the 6 queue tests and the 2 Nyquist tests. |

### Key Link Verification (09-06)

| From | To | Via | Status |
|------|----|-----|--------|
| CandidateSelect.tsx | modal-layout.ts | The layout effect calls `onLayoutLinesChange(estimateCandidateSelectLines(...))` | ✓ WIRED |
| run-foreground.ts | zellij-pane-resize.ts | `onLayoutLinesChange: inZellij ? syncZellijFloatingPaneHeight : undefined` (line 283) | ✓ WIRED |
| zellij-pane-resize.ts | zellij CLI | `spawn('zellij', ['action','change-floating-pane-coordinates','--pane-id',…,'--height',…], {stdio:'ignore'})`, one action at a time | ✓ WIRED |

The phase-wide key links from the previous report are unchanged (no diff in those files).

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| Zellij pane height | `contentLines`, then `resolveZellijPaneHeight` | `estimateCandidateSelectLines` over the committed render state (candidates, query after reset, selection, toggles) | Yes. Case (c) asserts the spawned height equals `resolveZellijPaneHeight(full)` from the real estimator. | ✓ FLOWING |
| ⓘ mark, install form, steering list | As in the previous report | zsh handoff, then annotate/plan, then envelope | Yes (unchanged) | ✓ FLOWING |

### Behavioral Spot-Checks (this run, load average 14–88)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 09-06 test files | `pnpm exec vitest run tests/candidate-select-layout.test.tsx tests/candidate-select.test.tsx tests/zellij-pane-resize.test.ts` | 61/61 | ✓ PASS |
| RED reproduction against pre-09-06 source (scratchpad export) | same layout and resize files, with `9da51d9` versions of the two sources | 10 failed (a, b, c and the queue tests); (d), the D-09 test, the original resize tests and the unref test passed | ✓ PASS (tests catch G-09-7) |
| D-09 test mutation | delete `setInstallToggled(new Set())`, and separately `setSelectedIndex(0)` | Each makes the test fail | ✓ PASS |
| Full suite (run once) | `pnpm test:run` | 30/31 files, 541/542 tests. One bug-206 spawn-bound case (1015 ms) failed. | ⚠ known flake |
| Fuzz file alone | `pnpm exec vitest run tests/command-words-fuzz.test.ts` | 36/36 | ✓ PASS |
| Typecheck | `pnpm typecheck` | exit 0 | ✓ PASS |
| Lint | `pnpm lint` | exit 0 (2 older warnings) | ✓ PASS |
| Build | not re-run (it writes `dist/`) | `dist/cli/main.js` mtime 04:51 is later than the last src commit at 04:15 | ? SKIP (orchestrator reports pass) |

### Probe Execution

Not applicable. No phase plan declares a probe, and the repo has no `scripts/*/tests/probe-*.sh`.

### Requirements Coverage

The PLAN frontmatter declares SC-1 to SC-6, which are the ROADMAP success criteria. ROADMAP Phase 9 lists "**Requirements**: TBD", and `.planning/REQUIREMENTS.md` has no Phase 9 or SC rows. Every declared ID is accounted for, and none is orphaned.

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| SC-1 | 09-01, 09-05 | Same-session install seen | ✓ SATISFIED | Truth 1 |
| SC-2 | 09-01, 09-05 | Handoff ~10 ms | ✓ SATISFIED (override) | Truth 2 |
| SC-3 | 09-01, 09-04, 09-06 | Flag; selectable; insertion-only; shown (incl. Zellij) | ✓ SATISFIED in code (override on the naming clause); live Zellij confirmation pending | Truths 3, 7–11, 13 |
| SC-4 | 09-01, 09-02 | Never flag builtins, placeholders, etc. | ✓ SATISFIED | Truth 4 |
| SC-5 | 09-02 | No hang or crash on malformed input | ✓ SATISFIED | Truth 5 |
| SC-6 | 09-03, 09-05 | Only installed ∩ catalog in the prompt | ✓ SATISFIED | Truth 6 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| 09-06 changed files | — | TBD, FIXME or XXX | — | None (grep exit 1). No TODO, HACK or placeholder either. |
| src/client/zellij-pane-resize.ts | 141-148 | WR-06: on timeout the code kills the child and settles at once. A killed or slow client whose request the server already received could still land after the next action. | ⚠️ Warning (open in 09-REVIEW-DISPOSITION) | Only reachable when one action hangs longer than 2 s; observed actions take 100–420 ms. It does not affect the G-09-7 arrival path, which the tests prove. Fix: settle when the killed child exits (with a SIGKILL deadline) and re-assert the newest height. |
| src/client/zellij-pane-resize.ts | 103, 178, 181-183 | WR-07: the dedupe key is the spawned height, not the applied one. A non-zero exit, error or kill for height H leaves the pane stale, and later requests for H are skipped. | ⚠️ Warning (open) | Needs a failed resize action, which was not seen in the repro. If the human UAT still shows a stuck size, look here first. Fix: track `appliedHeight` on exit code 0. |
| tests/candidate-select.test.tsx | 239-259 | WR-08: the mocked useState never replays render-phase updates, so the zero-match Enter test now checks a state production cannot reach that way. | ⚠️ Warning (open) | Test quality only. The real behaviour (a non-matching lbuffer is cleared) is covered by the real-hooks cases (a) to (c). |
| tests/command-words-fuzz.test.ts | 105 | 1 s bound includes Node spawn time (bug-206) | ⚠️ Warning (tracked; user-accepted) | Hit 1 of 33 crafted cases in this run's parallel full suite. |
| (review) | — | IN-01 to IN-05, IN-07 to IN-09 open | ℹ️ Info | None affects a success criterion. IN-06 (no D-09 arrival test) and IN-07 (spawn-throw and timer-unref untested) are in fact covered by the Nyquist tests in a03cc38, though their disposition rows still read `open`. |
| tests/modal-layout.test.ts, src/ui/CandidateSelect.tsx | 1 / layout-effect `biome-ignore` | Biome warnings | ℹ️ Info | Pre-existing; logged in deferred-items.md. |

### Human Verification Required

#### 1. G-09-7 live re-test in Zellij (UAT test 7 re-run)

**Test:** Open a zsh pane inside Zellij with the dev widget. Run `qq_dev` first if needed; `/tmp/qq-debug.log` should show `tool handoff written`.

1. Type `show me how to use z3??` six times, pressing Esc between runs.
2. Run `QQ_TOOL_AWARENESS=0`, then `show me how to use z3??` (no ⓘ should appear), then Esc. Run `unset QQ_TOOL_AWARENESS`, then `show me how to use z3??` twice.
3. With a list open, type `smt` quickly, then Backspace it away quickly.

**Expected:** Every run in steps 1–3 shows the candidate list and keeps it. The pane never shrinks to only the legend and controls, and after step 3 it ends sized to the full list. A one-row clip of the top `queque › …` line can be noted but is not a failure; it is a separate, pre-existing issue.

**Why human:** Zellij's server-side ordering of resize actions under live PTY output cannot be automated here, because every test mocks spawn. Before the fix the failure hit 25–50% of runs, so the check needs repeated live runs.

If this passes, mark UAT test 7 resolved in `09-UAT.md` (its gap G-09-7 still reads `status: failed` / `diagnosed`). The phase can then be treated as passed.

### Gaps Summary

There are no automated gaps.

- **G-09-7 code fix:** substantive and wired. Both of its causes are removed at the source. Regression tests that genuinely fail on the old code back this up; this verification re-ran them independently against the old source.
- **Earlier plans:** none of their source changed, and all their tests pass.
- **What remains:** the live Zellij confirmation of G-09-7, routed to human UAT.
- **Open warnings (WR-06, WR-07, WR-08):** robustness and test-quality items in edge paths that the G-09-7 repro did not exercise. They are recorded for triage, not as blockers. If the live UAT still shows a stale pane height, investigate WR-07 first, then WR-06.

---

_Verified: 2026-10-11T10:57:00Z_
_Verifier: Claude (gsd-verifier)_
