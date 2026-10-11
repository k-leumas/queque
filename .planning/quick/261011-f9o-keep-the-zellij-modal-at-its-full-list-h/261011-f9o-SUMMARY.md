---
phase: quick-261011-f9o
plan: 01
subsystem: ui
status: complete
tags: [zellij, ink, pane-resize, filter, layout, candidate-select]
requires:
  - quick-261011-e43 (INK_TRAILING_CURSOR_ROWS pane headroom)
  - 09-06 (render-phase arrival reset, serialized latest-wins resize queue)
provides:
  - heldPaneLines(previousHeld, input) in src/ui/modal-layout.ts
  - per-candidates-array Zellij pane hold in CandidateSelect (useRef)
  - replayScreen / mountArrival / spawnedHeights test helpers
affects:
  - src/ui/CandidateSelect.tsx onLayoutLinesChange semantics (held pane content rows, not drawn rows)
tech-stack:
  added: []
  patterns:
    - per-list high-water mark in a useRef keyed by prop identity (no state set in effects)
    - screen replay of Ink's raw writes to check header row, stale rows and scroll
key-files:
  created: []
  modified:
    - src/ui/modal-layout.ts
    - src/ui/CandidateSelect.tsx
    - tests/candidate-select-layout.test.tsx
    - tests/candidate-select.test.tsx
    - tests/modal-layout.test.ts
    - .wolf/anatomy.md
    - .wolf/cerebrum.md
    - .wolf/buglog.json
    - .wolf/memory.md
decisions:
  - Zellij pane path only; inline path, run-foreground.ts, zellij-pane-resize.ts and MODAL_VIEWPORT_LINES untouched
  - Arrival sizes the pane for the unfiltered list (query '', row 0, current toggles), even under an lbuffer pre-filter
  - The hold is a per-list high-water mark (never shrinks for one candidates array; still grows for a taller frame)
  - A new candidates array resets the hold and may resize up or down
metrics:
  duration: ~19 min (17:21Z to 17:40Z) + live human check
  completed: 2026-10-11
estimate:
  tokens: 45000
  tasks: 3
actuals:
  tokens: 11200    # chars/4 over the realized diff 69411c1..HEAD (44779 chars)
  tasks: 3
  commits: 3
plan_head_before: 69411c10bbe0e66dac1295dba8dfcfac86eb62d2
plan_head_after: 75655cc368d6f1053a51e10bcbca3a92fba2766e
---

# Phase quick-261011-f9o Plan 01: Keep the Zellij modal at its full-list height while filtering Summary

The Zellij floating pane is now sized for the unfiltered list when candidates arrive and keeps that height while the user filters. `heldPaneLines` returns max(held, drawn estimate, unfiltered estimate), a per-candidates-array `useRef` hold in CandidateSelect feeds it, and `onLayoutLinesChange` reports the result. Typing `smt` and backspacing spawns no `zellij action`. Before the fix it spawned 18,11,18.

**Status: complete.** Tasks 1 and 2 are done and committed. Task 3 (live Zellij human check) was approved by the user on 2026-10-11. Automated tmux+Zellij evidence is below.

## Completed Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 (RED) | Failing filter-hold regression (f) + helpers, (d)/(e) changed on purpose | cbedf96 | tests/candidate-select-layout.test.tsx, .wolf/anatomy.md, .wolf/memory.md |
| 1 (GREEN) | heldPaneLines + per-list pane hold | bd0c426 | src/ui/modal-layout.ts, src/ui/CandidateSelect.tsx, tests/candidate-select.test.tsx, .wolf/anatomy.md, .wolf/memory.md |
| 2 | heldPaneLines unit tests, (g) per-list reset, OpenWolf records | 75655cc | tests/modal-layout.test.ts, tests/candidate-select-layout.test.tsx, .wolf/anatomy.md, .wolf/cerebrum.md, .wolf/buglog.json, .wolf/memory.md |
| 3 | Live Zellij check | — | approved by user (2026-10-11) |

## TDD Gate Compliance

- **RED (cbedf96):** `pnpm exec vitest run tests/candidate-select-layout.test.tsx -t "keeps the pane" --reporter=tap-flat` exited 1. Both (f) targets failed on the first assertion: plain `expected '18,11' to be '18'`, flagged `expected '20,13' to be '20'`. The classifier `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`). The record is in `261011-f9o-RED-evidence.json` in this directory.
  - **semanticAssessment:** both targets ran and failed on the planned heights assertion for the intended reason. Before the fix the layout effect reports the filtered frame, so the sync spawns a shrink. The run had no load, syntax or fixture fault, and `-t` skipped the other 8 tests. A full-file run also showed (d) failing on its deliberately changed expectation (reports 8, expected the unfiltered 15), and (e) passing.
- **GREEN (bd0c426):** both layout files pass (10 + 43 tests) and typecheck exits 0.
- **Tracer feedback gate:** this was not auto mode, and `human_verify_mode` is end-of-phase with an automated-only `<verify>`. The verify was re-run end to end: 53/53 passed. It then expanded to Task 2.
- **REFACTOR:** none needed.

## Gate Results

- `pnpm exec vitest run tests/modal-layout.test.ts tests/candidate-select-layout.test.tsx tests/candidate-select.test.tsx tests/zellij-pane-resize.test.ts`: 4 files, 105/105 passed.
- `pnpm typecheck`: exit 0.
- `pnpm lint`: exit 0. It shows 2 warnings, both pre-existing: the unused vitest imports in tests/modal-layout.test.ts, and the unused biome-ignore suppression on the CandidateSelect layout effect.
- `pnpm build`: exit 0.
- `pnpm test:run`: 555/556 passed. The only failure was the known load-sensitive bug-206 guard `tests/command-words-fuzz.test.ts > crafted malformed input "echo $(date" finishes within 1 s`, which took 1039 ms. Load averages were 153/305/302 at the start and 112/281/293 at the end. The file re-run alone passed 36/36 (`echo $(date` took 441 ms) at load 98/273/291. The bound was not loosened.
- `git diff --quiet 69411c1 -- src/client/run-foreground.ts src/client/zellij-pane-resize.ts tests/zellij-pane-resize.test.ts`: unchanged. `MODAL_VIEWPORT_LINES = 18` is still present. `heldPaneLines` appears 3 times in CandidateSelect.tsx.

## Automated Live Evidence (tmux-hosted Zellij 0.44.1, not a substitute for Task 3)

The harness is in the scratchpad, not the repo. It is esbuild-bundled from `git archive` copies of `src` at 69411c1 (pre-fix) and at HEAD. It renders the real CandidateSelect with the real `syncZellijFloatingPaneHeight` in an 80x24 floating pane, uses the z3 fixtures and lbuffer `show me how to use z3`, then types `smt` and three Backspaces. QQ_DEV_ROOT was set, so the dev footer row is included (reports are 16, not 15).

- **Pre-fix:** reports were `16 16 9 9 9 16 16`. The capture 150 ms after `m` showed the shrunk pane with only the controls and dev-footer rows visible and the title `SCROLL:  0/7`. That is the user's "empty square". After settling on `smt` the title still showed `SCROLL:  0/7`.
- **HEAD:** reports were `16` all seven times. The pane frame stayed in exactly the same place (outer rows 15 to 33) in every capture, including the fast ones. The first row was always `queque › show me how to use z3` and no title showed `SCROLL:`. Under `FILTER: smt`, only `z3 -smt2 problem.smt2` was drawn, with plain blank pane rows below it and no leftover full-list lines. After three Backspaces the full list was back with no resize.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed the now-unused `estimateCandidateSelectLines` import from CandidateSelect.tsx**
- **Found during:** Task 1 GREEN
- **Issue:** the layout effect now calls `heldPaneLines`, which calls the estimator itself, so the direct import became unused and biome would flag it.
- **Fix:** dropped that one import specifier. No logic was removed.
- **Commit:** bd0c426

**2. [Process] The OpenWolf post-Edit hook rewrote curated anatomy lines and added auto buglog entries (same as 09-06 deviation 2 and 261011-e43 deviation 2)**
- The hook replaced the anatomy lines for candidate-select-layout.test.tsx, candidate-select.test.tsx and modal-layout.ts with first-doc-comment text. It also appended auto-detected bug-221/222/223 entries twice: "Null/undefined access", "Missing error handling", "Significant refactor", "Missing await".
- **Fix:** before each commit, restored the curated lines with `git checkout -- .wolf/buglog.json` (single file), dropped the auto entries, and added exactly one real buglog entry (bug-221, the user report).

**3. [Process] Committed on `main`**
- The executor's protected-branch assertion reports `main` as protected. The orchestrator explicitly scheduled this sequential run on the main working tree (worktree base-check auto-degraded), the same as the prior quick tasks, so the commits went to `main` as instructed.

**4. [Observation] Vitest printed `no tests` twice under extreme load**
- This happened twice when load averages were 335 to 405 and the output was piped through grep. An immediate re-run passed each time. No code change was made.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file access or schema change. The spawn argv in zellij-pane-resize.ts is byte-identical to 69411c1 (T-261011f9o-01). The hold is a max of finite estimates that resets per list, and the pane height is still capped at QQ_PANE_HEIGHT (T-261011f9o-02). There is no setState in an effect, and the effect count stays at 3 (T-261011f9o-03).

## Human Check (Task 3) — approved 2026-10-11

Run `pnpm build`. In a real Zellij session, use the dev widget (`qq_dev` if the Homebrew widget loads last):
1. Type `show me how to use z3??`. The list appears and stays. The first row is `queque › show me how to use z3`, the title has no `SCROLL:`, and the pane fits the full list.
2. Type `smt`. The pane does not shrink. The header stays on the first row and the filtered row sits under `FILTER: smt`. The rows below are plain blank pane rows: no empty square and no leftover full-list lines.
3. Backspace quickly to an empty filter. The full list returns with no resize, flicker or grow. The header is still on the first row and there is no `SCROLL:`.
4. Esc, then type `smt2??`. The filtered list shows in a pane sized for the full list. Backspace `smt2` out of the filter and the full list fills the pane with no grow.
5. If a candidate shows ⚠, arrow onto it. The pane may grow by 2 rows. Arrowing away does not shrink it.
6. Outside Zellij, in a plain terminal tab, type `show me how to use z3??` and filter `smt`. The inline modal behaves as before: it shrinks in place with no leftover lines.

## Self-Check: PASSED

- FOUND: src/ui/modal-layout.ts (`heldPaneLines`), src/ui/CandidateSelect.tsx, tests/candidate-select-layout.test.tsx (`replayScreen`), tests/modal-layout.test.ts (`heldPaneLines`), tests/candidate-select.test.tsx (`useRef`)
- FOUND commits: cbedf96, bd0c426, 75655cc (ancestors of HEAD)
