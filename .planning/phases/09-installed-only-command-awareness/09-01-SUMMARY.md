---
phase: 09-installed-only-command-awareness
plan: 01
subsystem: shell-integration, client, ui
tags: [zsh, zle, rehash, lexer, ink, candidate-select, tool-awareness]

requires:
  - phase: 03 (inline/Zellij client and CandidateSelect modal)
    provides: session tmpdir + request.json handoff, CandidateSelect, estimateCandidateSelectLines
provides:
  - "_qq_write_tool_handoff: guarded, rehashed, names-only zsh handoff (commands.txt, builtins.txt, functions.txt) with QQ_TOOL_AWARENESS=0 kill switch"
  - "readToolHandoff(sessionDir) -> ToolInventory | null, TOOL_HANDOFF_FILES"
  - "src/shared/command-words.ts: hardened hand-lexer port (lexHand, commandWords, extractCommandWords, MAX_COMMAND_LENGTH, MAX_RECURSION_DEPTH, comment tokens)"
  - "src/shared/tool-awareness.ts: ToolInventory, DisplayCandidate, isInstalled, missingTools, annotateCandidates"
  - "CandidateSelect cyan ⊘ mark + one shared footer block; flag-aware layout estimate; inline reserve 17"
affects: [09-02 lexer fuzz/case proof, 09-03 steering, 09-04 Tab install form, 09-05 installed-tools chunk + real-shell checks]

actuals:
  tokens: 18170
  tasks: 3
  commits: 5
plan_head_before: 342ae8ce325529e26f1e0e840960d957c68a74e8
plan_head_after: ba5c0e25a9703073664c0c81d907721378d9b81b

tech-stack:
  added: []
  patterns:
    - "zsh helpers called by the ?? widget guard every list (|| return 0 / || true) because the widget ERR trap deletes the session dir"
    - "Session-dir sibling files as a widget->client contract (fixed names, no paths in JSON)"
    - "UI-local DisplayCandidate flags; the IPC candidate contract is untouched"
    - "Ink layout via <Box flexShrink={0}> wrappers (Text takes no layout props)"

key-files:
  created:
    - src/shared/command-words.ts
    - src/shared/tool-awareness.ts
    - src/client/tool-handoff.ts
    - tests/tool-handoff.test.ts
    - tests/tool-awareness.test.ts
    - .planning/phases/09-installed-only-command-awareness/.tdd/09-01-red-evidence.json
  modified:
    - shell/zsh/queque.zsh
    - src/client/run-foreground.ts
    - src/ui/CandidateSelect.tsx
    - src/ui/modal-layout.ts
    - tests/client-result.test.ts
    - tests/candidate-select.test.tsx
    - tests/zsh-widget.test.ts
    - tests/modal-layout.test.ts

key-decisions:
  - "Gutter and marks use <Box flexShrink={0}> wrappers: Ink 7 Text accepts no layout props (hardcoded flexShrink 1)"
  - "Comment tokens carry the text including the leading # up to (not including) the newline"
  - "Commits landed on main as dispatched (branching_strategy none, sequential executor on main) despite the protected-branch default"

patterns-established:
  - "isInstalled(inventory, name) is the single installed predicate (commands OR functions+aliases)"
  - "Debug logs for the inventory carry counts or an error code only, never names"

requirements-completed: [SC-1, SC-2, SC-3, SC-4]

coverage:
  - id: D1
    description: "Guarded zsh handoff: rehash every call, three names-only writes, kill switch, never trips the widget ERR trap, called after request.json and before both launches"
    requirement: SC-1
    verification:
      - kind: integration
        ref: "tests/zsh-widget.test.ts#tool handoff"
        status: pass
    human_judgment: false
  - id: D2
    description: "Handoff timing guard: median of 5 under zsh -f below 25 ms (printed)"
    requirement: SC-2
    verification:
      - kind: integration
        ref: "tests/zsh-widget.test.ts#handoff timing"
        status: pass
    human_judgment: false
  - id: D3
    description: "Client reads the handoff eagerly, annotates candidates in model order, flagged candidate still inserts verbatim; missing files / QQ_TOOL_AWARENESS=0 give no flags; malformed model output never throws"
    requirement: SC-3
    verification:
      - kind: integration
        ref: "tests/client-result.test.ts#runForegroundClient: installed-tool awareness"
        status: pass
      - kind: unit
        ref: "tests/tool-handoff.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Builtins, reserved words, placeholders, $VAR and path commands never flagged; function/alias names count as installed"
    requirement: SC-4
    verification:
      - kind: unit
        ref: "tests/tool-awareness.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "⊘ mark and shared footer render, layout estimate rows, inline reserve 17"
    requirement: SC-3
    verification:
      - kind: unit
        ref: "tests/candidate-select.test.tsx#CandidateSelect — missing-tool flag"
        status: pass
      - kind: unit
        ref: "tests/modal-layout.test.ts#estimateCandidateSelectLines — missing-tool flag rows"
        status: pass
    human_judgment: false
  - id: D6
    description: "Real-terminal look of the cyan ⊘ and footer, and the real interactive-shell handoff cost"
    verification: []
    human_judgment: true
    rationale: "Glyph rendering and real-shell timing are checked by the 09-05 human step; tests mock Ink and run zsh -f"

duration: 11min
completed: 2026-10-08
status: complete
---

# Phase 9 Plan 01: Installed-Tool Awareness Tracer Summary

**zsh's freshly rehashed `$commands`/builtins/functions+aliases reach the client through session-dir files, a hardened TypeScript port of the spike 002 lexer finds each candidate's command words, and the picker shows a cyan ⊘ plus `⊘ not installed: <tools>` on candidates that use a missing tool. Flagged candidates keep their order and still insert verbatim.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-08T08:04:33Z
- **Completed:** 2026-10-08T08:15:28Z
- **Tasks:** 3 (5 commits, TDD in Task 3)
- **Files modified:** 13 source/test files (+1 RED evidence record)

## Accomplishments

- `_qq_write_tool_handoff` in `shell/zsh/queque.zsh` does a kill-switch check, `zmodload`, an unconditional `rehash`, and three chained `print -rl --` writes. A failed write removes all three files. Every list ends with status 0, so the widget's ERR trap can't delete request.json, and no error text reaches the ZLE line. The widget calls it right after the request.json heredoc, before both the Zellij and inline launches.
- `readToolHandoff` reads the three files in parallel with `node:fs/promises`. It returns null without throwing when the files are missing or unreadable, when commands.txt is empty, or when `QQ_TOOL_AWARENESS=0`. Logs carry counts or error codes only.
- `command-words.ts` ports the spike lexer and matches the spike on all 40 fixture cases. It differs only in the two intended fixes: `"rg\` gives `rg`, and `constructor --x | toString` no longer throws. It uses Map/Set tables, empty-string escape fallbacks, a recursion depth cap of 32, an 8192-char input cap, a try/catch entry point and comment tokens. It has zero imports, and Node 24 imports it from a `.mjs` file directly. `'$('.repeat(2000)` finishes in about 2 ms.
- `annotateCandidates` runs in the `fetchCandidatesForUi` callback. The `candidates received` log now carries a `flagged` count. The inventory is never added to IPC.
- `CandidateSelect` shows a cyan ` ⊘` after the last command line. The destructive and missing-tool footers share one footer block with one margin. The gutter and both marks don't shrink.
- `estimateCandidateSelectLines` counts the shared footer block, a wrapped flag footer, and an extra row when the marks no longer fit. `MODAL_VIEWPORT_LINES` goes from 16 to 17.

## Handoff timing (D-19, `zsh -f` guard number)

`handoff median ms: 6.43` (first Task 2 run). Later runs printed 7.41, 8.49 and 8.40. All are under the 25 ms guard. This is the `zsh -f` number with the inherited PATH (~2.2k commands) and almost no functions or aliases, so it understates a real interactive shell. 09-05 records the real-shell number.

## Task Commits

1. **Task 1: Tracer — zsh handoff to flagged candidate in the picker** - `086ba1f` (feat)
2. **Task 2: Prove the handoff** - `b900476` (test)
3. **Task 3: Flag rows in the layout estimate and viewport reserve (TDD)**
   - RED - `b57694d` (test)
   - GREEN - `4fdd6f8` (feat)
   - Characterization - `ba5c0e2` (test)

Tracer feedback gate: the `<verify>` (vitest client-result + candidate-select, typecheck) re-ran green, so expansion went ahead (end-of-phase human verify, automated-only verify).

## TDD Gate Compliance (Task 3)

- **RED** (`b57694d`): `pnpm exec vitest run tests/modal-layout.test.ts --reporter=tap-flat` exited 1 with 15 tests (10 pass, 5 fail). The classifier returned `RED_EVIDENCE_OK` (reason `target_test_failed`). The record is in `.tdd/09-01-red-evidence.json`. Failing targets:
  - `adds 2 rows (marginTop + footer line) when the selected candidate is flagged` (expected 9, got 7)
  - `adds 3 rows over the plain baseline when the selected candidate is destructive and flagged` (expected 10, got 9)
  - `adds 1 row when the mark no longer fits on the last command line` (expected 11, got 10)
  - `adds 1 row when both marks no longer fit (length + 4 > contentWidth)` (expected 11, got 10)
  - `counts the wrapped rows of a flag footer longer than contentWidth` (expected 11, got 7)
  - Semantic assessment: each target ran and failed on its planned `toBe` assertion because the estimate ignored `missingTools`. There were no load, syntax or fixture faults. Two guard cases passed by design because there is nothing to count before the feature exists: "no footer rows for a flagged candidate that is not selected" and "adds nothing when the last command line has room". So did `filterCandidates` keeping `missingTools`, which Task 1 had already made generic.
- **GREEN** (`4fdd6f8`): 15/15 modal-layout tests pass.
- **REFACTOR:** none needed.
- **Characterization** (`ba5c0e2`): the tool-awareness semantics and the CandidateSelect dual-mark render passed on their first run, so no Task 1 defects were found.

## Files Created/Modified

- `shell/zsh/queque.zsh`: guarded `_qq_write_tool_handoff` helper, called inside `qq-question-widget`.
- `src/client/tool-handoff.ts`: handoff reader and `TOOL_HANDOFF_FILES`.
- `src/shared/command-words.ts`: hardened lexer port.
- `src/shared/tool-awareness.ts`: inventory type, `isInstalled`, `missingTools`, `annotateCandidates`.
- `src/client/run-foreground.ts`: eager handoff read, annotation before rerender, reserve of 17.
- `src/ui/modal-layout.ts`: generic `filterCandidates`, `MISSING_TOOL_MARK`, `missingToolsFooterText`, flag-aware estimate.
- `src/ui/CandidateSelect.tsx`: ⊘ mark, shared footer block, `flexShrink={0}` wrappers.
- Tests: `tests/client-result.test.ts` (cases A-D), `tests/zsh-widget.test.ts` (tool handoff, handoff timing), `tests/tool-handoff.test.ts`, `tests/tool-awareness.test.ts`, `tests/modal-layout.test.ts`, `tests/candidate-select.test.tsx`.

## Decisions Made

- The gutter and marks are wrapped in `<Box flexShrink={0}>` because Ink 7 `<Text>` takes no layout props (see Deviations).
- A `comment` token's `v` is the comment text including the leading `#`, up to but not including the newline.
- The freshness test primes the hash table and was first checked to be sensitive: without `rehash` the new tool is absent (0), and with it the tool is present (1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `flexShrink={0}` cannot go on Ink `<Text>`**
- **Found during:** Task 1, step 7
- **Issue:** `pnpm typecheck` failed with TS2322 because `flexShrink` is not a `Text` prop. Ink's Text hardcodes `flexShrink: 1`, which the Context7 Ink docs confirm.
- **Fix:** Wrapped the gutter prefix Text and each mark Text in `<Box flexShrink={0}>`. The layout behavior is the one the plan intended, and it stays an Ink prop. `grep -c "flexShrink={0}"` = 4, which meets the >= 3 criterion. The Task 3 render test walks the tree for `flexShrink: 0` elements that contain the gutter, ⚠ and ⊘.
- **Files modified:** src/ui/CandidateSelect.tsx
- **Commit:** 086ba1f (logged as bug-198 in .wolf/buglog.json, plus a cerebrum learning)

**2. [Rule 3 - Blocking] Placement test anchor**
- **Found during:** Task 2
- **Issue:** The first `zellij run --floating` in the widget source is in a header comment (line 203), above the handoff call. A plain `indexOf` would have made the placement assertion compare against that comment.
- **Fix:** The test matches the launch line itself with `/^\s+zellij run --floating/m`, and the inline launch with its specific `--result-file "$result_file"` text.
- **Files modified:** tests/zsh-widget.test.ts
- **Commit:** b900476

### Execution notes

- **Commits on `main`:** The orchestrator dispatched a sequential executor on `main` with normal commits, and `branching_strategy` is `none`, so commits landed on `main` even though `git.base-branch --is-protected main` reports true. This is the project's established flow; all prior phase commits are on `main`.
- **No Co-Authored-By trailer:** this follows the user's memory rule, which overrides the harness attribution reminder.

**Total deviations:** 2 auto-fixed (both Rule 3). **Impact:** none on scope; both keep the planned behavior.

## Issues Encountered

None. The full suite passes (26 files, 293 tests), and `pnpm typecheck` and `pnpm lint` are clean. The 2 lint warnings were already there: unused vitest imports in `tests/modal-layout.test.ts` line 1, and an unused biome suppression in `CandidateSelect.tsx`.

## Plan Verification

- `pnpm exec vitest run tests/client-result.test.ts tests/candidate-select.test.tsx tests/zsh-widget.test.ts tests/tool-handoff.test.ts tests/tool-awareness.test.ts tests/modal-layout.test.ts`: 6 files, 126 tests passed.
- `pnpm typecheck`: exit 0. `pnpm lint`: exit 0 (2 pre-existing warnings).
- Every Task 1, 2 and 3 acceptance criterion was re-run and passes (grep counts and test cases).

## Next Phase Readiness

Ready for wave 2 (09-02, 09-03, 09-04). The interfaces they build on are in place: `lexHand` with comment tokens, `extractCommandWords`, `isInstalled`, `DisplayCandidate`, `TOOL_HANDOFF_FILES`, and the shared footer block.

## Self-Check: PASSED

- FOUND: src/shared/command-words.ts, src/shared/tool-awareness.ts, src/client/tool-handoff.ts, tests/tool-handoff.test.ts, tests/tool-awareness.test.ts, .tdd/09-01-red-evidence.json
- FOUND commits: 086ba1f, b900476, b57694d, 4fdd6f8, ba5c0e2
