---
status: diagnosed
trigger: "UAT G-09-7: when i reenable tool awareness, and retrigger the qq ui, the list shows 3 results and then dwindles down to zero  so its just a modal with nothing in it"
created: 2026-10-11T09:00:00Z
updated: 2026-10-11T10:10:00Z
---

## Current Focus

bug_class: Mandelbug (timing-dependent race between two detached `zellij action` child processes; reproduces in ~25-50% of runs, independent of tool awareness)
hypothesis: CONFIRMED (H1). When candidates arrive, CandidateSelect's layout effect reports the height of a transient render that still filters by `initialQuery` (0 visible rows -> "no matches" estimate, 7 lines -> pane height 9). The reset effect then clears the query and the layout effect reports the full list (22 lines -> height 24). `syncZellijFloatingPaneHeight` spawns one detached, unordered `zellij action change-floating-pane-coordinates` per call. When the stale shrink-to-9 action finishes last, the pane stays 9 rows tall, 15 of 22 content lines go into pane scrollback, and Ink never repaints (its /dev/tty WriteStream never emits 'resize').
test: done — faithful tmux+Zellij repro, exit-order instrumentation, falsification run with empty initialQuery.
expecting: n/a
next_action: Return ROOT CAUSE FOUND (goal: find_root_cause_only). Fix belongs to plan-phase --gaps.

reasoning_checkpoint:
  hypothesis: "The empty modal is caused by the stale 'no matches' layout estimate (computed while query still equals initialQuery) being sent to Zellij as a pane shrink (height 9) right before the real full-list height (24); the two detached zellij action processes race and when the shrink lands last the pane is left too short, with the list scrolled into pane scrollback and no Ink repaint."
  confirming_evidence:
    - "Real-Ink run: onLayoutLinesChange called with 7 lines (height 9) then 22 lines (height 24), ~20-45ms apart, on every candidate arrival with a non-matching initialQuery."
    - "Zellij repro (36 instrumented runs): every time the pane ended empty (h=9, SCROLL 0/15, only explanation tail + legend + controls visible), the height-9 zellij action exited after the height-24 one; every time it ended correct, the height-24 action exited last. 0 exceptions."
    - "Falsification: with initialQuery='' (no stale 'no matches' render -> one deduped resize call) 10/10 runs kept the list visible."
    - "User log: all test-7 runs used lbuffer 'show me how to use z3', which never substring-matches a command, so every run took the stale-shrink path."
  falsification_test: "If removing the stale first estimate still produced empty modals, or if final pane height did not track the last-finishing zellij action, the hypothesis would be wrong. Neither happened."
  fix_rationale: "Not applied (diagnose-only). A fix must stop the transient initialQuery render from reaching Zellij and/or serialize resize actions so the latest height always wins."
  blind_spots: "Did not drive the real `qq client` through the user's daemon/LLM (harness reuses CandidateSelect + syncZellijFloatingPaneHeight from src with fixed z3-style candidates). Did not test outside Zellij (inline path does not resize, and every logged UAT run was inZellij=true). Race rate differs between runs/machine load."
  candidate_causes:
    - "code: CandidateSelect layout effect fires for the pre-reset render (query === initialQuery, 0 visible)"
    - "code/environment: fire-and-forget `zellij action` spawns with no ordering guarantee; Zellij server applies them in completion order"
    - "environment: Node tty.WriteStream over the /dev/tty fd never emits 'resize' (no SIGWINCH hookup), so Ink cannot repaint/recover after the pane changes size"
    - "data/config (eliminated): tool-awareness kill switch / handoff files / brew widget shadowing"
  and_gate: "yes — the visible failure needs (1) the spurious shrink request AND (2) the shrink finishing after the grow (race). (3) the missing Ink resize repaint makes it permanent instead of a flicker. Removing (1) alone eliminated it in 10/10 runs."

## Symptoms

expected: After running `QQ_TOOL_AWARENESS=0` and using `??` (no ⓘ marks), re-enabling tool awareness and triggering `??` again shows the candidate list and keeps it.
actual: "when i reenable tool awareness, and retrigger the qq ui, the list shows 3 results and then dwindles down to zero  so its just a modal with nothing in it"
errors: None reported
reproduction: Test 7 in .planning/phases/09-installed-only-command-awareness/09-UAT.md. QQ_TOOL_AWARENESS=0 as shell parameter, use ??, re-enable (method unknown), retrigger ??. Possibly inside/outside Zellij.
started: Discovered during UAT 2026-10-11 after phase 09 execution.

## Eliminated

- hypothesis: Tool-awareness kill switch / handoff state after re-enable (missing or stale commands/builtins/functions.txt) empties the list.
  evidence: Every re-enabled run logged "tool handoff read {commands:2183,...}", "installed-tools chunk {steered:58}", "candidates received {count:3, flagged:1|2}". Zellij repro with NO inventory (FLAGGED=0, the kill-switch shape) produced the same empty modal in 4/14 runs; with inventory 5/18 runs. Rates not meaningfully different.
  timestamp: 2026-10-11T10:00Z

- hypothesis: Stale Homebrew widget shadowing the dev widget (bug-205).
  evidence: zsh log shows "tool handoff written" (only the dev widget has _qq_write_tool_handoff) and qq_cmd=node /Users/samuel/dev/tui-llm/dist/cli/main.js for every UAT run.
  timestamp: 2026-10-11T09:06Z

- hypothesis: H2 — characters leaking into the FILTER query progressively narrow filterCandidates to zero.
  evidence: In the reproduced empty state the FILTER line is not even on screen (scrolled into pane scrollback, SCROLL 0/15) and the visible tail still shows candidate text; harness had no stdin input yet reproduced. The list is not filtered away — it is clipped by a 9-row pane.
  timestamp: 2026-10-11T09:40Z

- hypothesis: H3 — the layout estimator underestimates rows for flagged candidates (legend / ⓘ width), sizing the pane too small.
  evidence: Real Ink output for 3 flagged z3 candidates was exactly 22 lines and the estimate was 22 (height 24). Correct runs show the whole modal fitting the pane with no clipping.
  timestamp: 2026-10-11T09:22Z

- hypothesis: Daemon/fetch path or a second candidate update replaces the list.
  evidence: One "replied candidates {count:3}" and one "candidates received" per session in the log; run-foreground calls app.rerender once. Harness with no daemon reproduces.
  timestamp: 2026-10-11T09:40Z

## Evidence

- timestamp: 2026-10-11T09:05Z
  checked: /tmp/qq-debug.log UAT sessions 08:15Z-08:41Z (all inZellij=true, dev widget node dist/cli/main.js, daemon from 02:51Z)
  found: 08:32:51 kill-switch run -> "tool handoff unavailable ENOENT", candidates count 3 flagged 0, cancel after 8s. Re-enabled runs 08:33:26 (flagged 1, cancel after 23s), 08:34:02 (flagged 1, cancel 2s), 08:39:23 (flagged 2, cancel 63s), 08:40:51 (flagged 2, cancel 18s). Query in all: "show me how to use z3". Daemon always replied candidates count 3. No error lines.
  implication: Data path (handoff read, daemon fetch, annotate) completed normally with 3 candidates; the "dwindle to zero" happens in the UI after candidates are rendered, not in fetch/handoff. Kill switch itself behaved (ENOENT -> no flags).

- timestamp: 2026-10-11T09:06Z
  checked: buglog bug-205 (brew widget shadowing) and current widget logs
  found: zsh log lines "tool handoff written" + client "tool handoff read" prove the dev widget (with _qq_write_tool_handoff) ran for these sessions, not the stale brew widget.
  implication: Widget shadowing (bug-205) is not involved in this reproduction.

- timestamp: 2026-10-11T09:20Z
  checked: Real-Ink repro (scratchpad/repro-layout.tsx bundled with esbuild from src, fake TTY 78x22, QQ_DEV_ROOT set, initialQuery "show me how to use z3", 3 z3-style candidates, 2 flagged)
  found: onLayoutLinesChange fired twice on candidate arrival: {lines:7,height:9} at t=299ms, then {lines:22,height:24} at t=321ms. The first call is computed with query === initialQuery (filter yields 0 rows -> "no matches" estimate) before the reset effect's setQuery('') re-renders.
  implication: Every candidate arrival in Zellij spawns two `zellij action change-floating-pane-coordinates` processes ~20ms apart: shrink to 9 rows, then grow to 24 (the cap). Full list estimate = 22 lines = exactly the PTY rows at QQ_PANE_HEIGHT=24, so Ink is in its fullscreen (outputHeight >= rows) path.

- timestamp: 2026-10-11T09:35Z
  checked: Faithful Zellij repro — tmux 160x50 hosting `zellij -s qqdbg-zj` (user config, zellij 0.44.1); `zellij run --floating --width 80 --height 24 --name qq -- node harness` where harness mirrors run-foreground's UI path (/dev/tty tty.ReadStream/WriteStream, Ink render null -> rerender with annotated z3 candidates, onLayoutLinesChange = real syncZellijFloatingPaneHeight). tmux capture-pane every 25ms.
  found: Run r1: harness log "layout lines=7 height=9" then "layout lines=22 height=24" (41ms apart). Captures 027-028: pane rows 13-36 (height 24), full 3-candidate list visible. Captures 029-050: pane shrank to height 9 (rows 20-28), frame title shows "SCROLL: 0/15", visible content only "install z3-solver)" tail, legend, controls, dev footer — the candidate list is gone and never comes back. The grow-to-24 never took effect.
  implication: REPRODUCED the user symptom ("shows 3 results then ... just a modal with nothing in it"). Mechanism: the stale "no matches" layout estimate (height 9) is applied to the pane after the full-list estimate (height 24) — the two fire-and-forget `zellij action` child processes race, and the shrink lands last. 15 of 22 content lines are pushed into the pane's scrollback.

- timestamp: 2026-10-11T09:36Z
  checked: harness log for 'resize' events on the tty.WriteStream built over the /dev/tty fd
  found: No resize event is ever emitted even though the pane changed size. Node only refreshes size/emits 'resize' on SIGWINCH for process.stdout/stderr, not for a manually-constructed tty.WriteStream (which is what run-foreground.ts passes to Ink).
  implication: Ink never learns the pane shrank and never repaints, so nothing recovers the list once the shrink lands; stdout.rows stays at the launch value (22) for the whole session.

- timestamp: 2026-10-11T09:50Z
  checked: Instrumented child_process.spawn in the harness (syncBuiltinESMExports) to log spawn/exit time per zellij action; clean runs u1-u8 (no inventory) and k1-k8 + g1/g3/g4/g7 (with inventory)
  found: Each `zellij action` takes ~100-420ms to exit. Height-24 is spawned 27-45ms after height-9 but sometimes exits first (g1: spawn 9 @769, spawn 24 @814, exit 24 @168, exit 9 @190 -> final h=9 empty). In all 20 clean runs the final pane height equals the height of the action that exited last (u1,u2,u8,g1 -> 9/empty; others -> full/visible). Isolated test from an idle shell (two actions 30ms apart, no Ink output) kept order 10/10.
  implication: The race is real and load-dependent: the Zellij server applies resize actions in completion order, and the concurrent PTY output from Ink makes reordering likely. Probability per `??` was ~25-50% in these trials, with or without tool awareness.

- timestamp: 2026-10-11T10:00Z
  checked: Falsification — same harness with INITIAL_QUERY='' (first render already has query '' so no "no matches" estimate)
  found: Layout calls height=23, height=23 (second deduped by lastSyncedHeight -> one zellij action). 10/10 runs kept all 3 candidates visible.
  implication: Removing the stale first estimate removes the empty-modal failure. Confirms the trigger.

- timestamp: 2026-10-11T10:02Z
  checked: In-order run f0-2 (no inventory: 24 -> 9 -> 22)
  found: Even when the grow lands last, the pane shows "SCROLL: 0/1": the "queque › …" header stays in pane scrollback and a blank line sits at the bottom. Ink still believes rows=22 (no resize event), appends a trailing newline to a 20-line frame in a 20-row pane, so one line scrolls off.
  implication: Secondary symptom of the same two defects (stale shrink + Ink unaware of pane size): header can disappear even on "good" runs whenever the final height is below the cap.

- timestamp: 2026-10-11T10:05Z
  checked: git history
  found: syncZellijFloatingPaneHeight and the CandidateSelect layout effect date from 99adc79 (2026-06-18, "resize floating pane to fit modal content"); the initialQuery pre-filter reset dates from May. Phase 9 did not touch them.
  implication: Pre-existing latent race, surfaced during Phase 9 UAT test 7 by chance. Not caused by the kill switch or the tool handoff.

## Resolution

root_cause: "CandidateSelect reports a stale layout height to Zellij when candidates arrive: the first render after app.rerender still filters by initialQuery (the lbuffer, which never matches a command), so the layout effect computes the 'no matches' estimate (7 lines -> pane height 9) before the reset effect clears the query and the next render reports the full list (22 lines -> 24). syncZellijFloatingPaneHeight fires a detached `zellij action change-floating-pane-coordinates` per call with no ordering, so the two actions race; when the stale shrink-to-9 completes last (about 25-50% of runs), the floating pane is left 9 rows tall, the list scrolls into pane scrollback (SCROLL 0/15) and only the last explanation tail, legend and controls stay visible. Ink never repaints because the tty.WriteStream built on the /dev/tty fd never emits 'resize'. Independent of QQ_TOOL_AWARENESS; the kill-switch/re-enable sequence was coincidental."
fix: ""
verification: ""
files_changed: []
