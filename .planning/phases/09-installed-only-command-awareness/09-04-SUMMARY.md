---
phase: 09-installed-only-command-awareness
plan: 04
subsystem: client, ui
tags: [tool-awareness, install-form, ink, candidate-select, controls-line, tdd]

requires:
  - phase: 09-01
    provides: ToolInventory, isInstalled, missingTools, annotateCandidates, DisplayCandidate, lexHand op/redir/comment tokens, ⊘ mark and shared footer block
provides:
  - "src/shared/tool-awareness.ts: InstallerId, INSTALL_COMMANDS, LINUX_INSTALLER_ORDER, PACKAGE_ALIASES, SAFE_PACKAGE_NAME_RE, InstallBlockReason, InstallPlan, pickInstaller, packageFor, buildInstallForm, planInstall; DisplayCandidate.install; annotateCandidates(candidates, inventory, platform = process.platform)"
  - "src/ui/modal-layout.ts: candidateKey, displayedCommand, isInstallToggled, CandidateSelectLayoutInput.installToggled, missingToolsFooterText(candidate, toggled)"
  - "src/ui/ControlsLine.tsx: ControlsLineProps { tabHint?: 'install' | 'undo install' }"
  - "src/ui/CandidateSelect.tsx: Tab/Shift+Tab install toggle (third useState), displayed-text insertion, install footers, tabHint wiring"
affects: [09-05 wave-2 merge gate (pnpm test:run) and OpenWolf entries]

actuals:
  tokens: 16648
  tasks: 2
  commits: 4
plan_head_before: 1ace24a523541a21c087c3bd1f0e488dbae4ab50
plan_head_after: 22553c52802a3e8984298f68ab2578c26bb69061

tech-stack:
  added: []
  patterns:
    - "Install plan is UI-local on DisplayCandidate, computed once in annotateCandidates; run-foreground.ts is unchanged (defaulted platform param)"
    - "Brace-wrap decision is token-based (lexHand op/redir/comment), never string matching"
    - "Toggle state keyed by candidateKey identity, not visible index"

key-files:
  created:
    - tests/controls-line.test.tsx
    - .planning/phases/09-installed-only-command-awareness/.tdd/09-04-task1-red-evidence.json
    - .planning/phases/09-installed-only-command-awareness/.tdd/09-04-task2-red-evidence.json
  modified:
    - src/shared/tool-awareness.ts
    - src/ui/CandidateSelect.tsx
    - src/ui/ControlsLine.tsx
    - src/ui/modal-layout.ts
    - tests/tool-awareness.test.ts
    - tests/client-result.test.ts
    - tests/candidate-select.test.tsx
    - tests/modal-layout.test.ts

key-decisions:
  - "The trailing-terminator check for the brace wrap uses the last lexHand token (op ; ;; &), not string endsWith, so an escaped `\\;` (find -exec) still gets its own `;`"
  - "displayedCommand and isInstallToggled live in modal-layout.ts and are shared by CandidateSelect and the layout estimate, so the render and the estimate cannot disagree on the displayed text"
  - "Tab is consumed (returns) in every case, including while loading and on unflagged/blocked rows"

patterns-established:
  - "missingToolsFooterText(candidate, toggled) is the single source of footer copy for render and estimate"

requirements-completed: [SC-3]

coverage:
  - id: D1
    description: "Installer choice (brew on darwin; first of apt/dnf/pacman on linux; null otherwise), shipped package map, deduplicated packages, guarded install forms with exact-string wrap and block rules"
    requirement: SC-3
    verification:
      - kind: unit
        ref: "tests/tool-awareness.test.ts#pickInstaller (D-11)"
        status: pass
      - kind: unit
        ref: "tests/tool-awareness.test.ts#planInstall — list wrapping (T-09-11)"
        status: pass
      - kind: unit
        ref: "tests/tool-awareness.test.ts#planInstall — blocked plans (T-09-10, T-09-20)"
        status: pass
    human_judgment: false
  - id: D2
    description: "annotateCandidates attaches an install plan to flagged candidates only, order unchanged; D-07 cases judged by the normal rule; buildShellBuffers cursor on an install form"
    requirement: SC-3
    verification:
      - kind: unit
        ref: "tests/tool-awareness.test.ts#annotateCandidates — install plans"
        status: pass
      - kind: unit
        ref: "tests/client-result.test.ts#buildShellBuffers — install form (09-04, Pitfall 6)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tab/Shift+Tab toggle, Enter inserts the shown text, Tab ignored on unflagged/blocked rows and never reaches search, footers per state, D-08 dual marks, toggle survives filtering, tabHint on the ControlsLine element"
    requirement: SC-3
    verification:
      - kind: unit
        ref: "tests/candidate-select.test.tsx#CandidateSelect — Tab install form"
        status: pass
      - kind: unit
        ref: "tests/controls-line.test.tsx#ControlsLine — tab hint (D-14)"
        status: pass
      - kind: unit
        ref: "tests/modal-layout.test.ts#estimateCandidateSelectLines — install toggle"
        status: pass
    human_judgment: false
  - id: D4
    description: "Real-terminal feel of Tab in Ink (Tab and Shift+Tab key events, chip look) and a real brew/apt install form run by hand"
    verification: []
    human_judgment: true
    rationale: "Tests mock Ink's useInput and never run an installer; the real Linux apt/dnf/pacman path is only exercised with injected inventories (manual-only per plan verification)"

duration: 7min
completed: 2026-10-08
status: complete
---

# Phase 9 Plan 04: Tab Install Form Summary

**A flagged candidate now carries a guarded install plan (`brew install ripgrep && rg …`, `sudo apt install fd-find && …`, or a brace-wrapped `{ cmd; }` for list commands). Tab switches the row to that form and back, the footer and controls bar say what will happen, and Enter inserts exactly what the row shows. Nothing runs automatically.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-08T08:35:35Z
- **Completed:** 2026-10-08T08:42:44Z
- **Tasks:** 2 (4 commits, TDD RED/GREEN in each)
- **Files modified:** 9 source/test files (+2 RED evidence records)

## Accomplishments

- `pickInstaller` chooses brew on darwin (also when brew is only a function), the first of apt, dnf, pacman on linux, and null otherwise. `INSTALL_COMMANDS` uses `brew install`, `sudo apt install`, `sudo dnf install` and `sudo pacman -S`, with no `-y` or `--noconfirm`.
- `PACKAGE_ALIASES` is a shipped `Map` with 32 entries, including coreutils for `timeout`, `gtimeout`, `gdate`, `nproc` and `sha256sum`, plus `gsed` to `gnu-sed`, and `fdfind`/`batcat` to `fd-find`/`bat`. It uses a Map, so prototype keys like `constructor` install under their own name. Every value matches `SAFE_PACKAGE_NAME_RE`.
- `buildInstallForm` lexes the command once. It wraps the command in a brace group when there is a `;`, `||`, `&`, `;;` or newline op. It does not add a second `;` after an existing `;` or `&`. It returns null when a wrap is needed and there is a comment or heredoc. `planInstall` checks in this order: no manager, then an unsafe word, then an unwrappable command. Each blocked plan has `form: null` and `packages: []`.
- `annotateCandidates` gains a defaulted `platform` parameter and picks the installer once per call, so `run-foreground.ts` is untouched.
- The third `useState` in CandidateSelect holds the toggled `candidateKey`s. It is reset when new candidates arrive. Tab and Shift+Tab toggle the selected row only when it has a form, and they always return before the search handler.
- The rows, the ⚠ check, Enter and the layout estimate all use the displayed text. The `see man` fallback uses the original command. The footer reads `⊘ will install: …`, `⊘ not installed: … — no package manager found` or `— no safe install command`. `ControlsLine` shows `tab` `install` / `undo install` chips only while Tab would act.

## Task Commits

1. **Task 1: Installer choice, package map, and the guarded install-form builder**
   - RED - `2887940` (test)
   - GREEN - `b9fa02d` (feat)
2. **Task 2: Tab toggle, install footers, controls hint, and toggle-aware layout**
   - RED - `5ce5dd3` (test)
   - GREEN - `22553c5` (feat)

## TDD Gate Compliance

- **Task 1 RED** (`2887940`): `pnpm exec vitest run tests/tool-awareness.test.ts -t marks flagged candidates blocked --reporter=tap-flat` exited 1. The classifier returned `RED_EVIDENCE_OK` (`target_test_failed`); the record is in `.tdd/09-04-task1-red-evidence.json`. The target `annotateCandidates — install plans > marks flagged candidates blocked when no manager exists` failed with `expected undefined to be 'no-package-manager'`. Semantic assessment: the target ran and failed on its planned assertion because the stub took `platform` but attached no plan. In the unfiltered run, 27 other new tests failed on the throw-on-call stubs. The 09-01 characterization tests, the D-07 tests and the `buildShellBuffers` case passed, because that behavior already existed.
  - Note: the first capture of the whole file was rejected as `invalid_record` (Non-TAP data). Vitest's tap-flat reporter writes a multi-line object diff for `toEqual` on objects, which breaks TAP. The capture was re-run with a `-t` filter on a scalar-assertion target. The test code was not changed.
- **Task 1 GREEN** (`b9fa02d`): 60/60 tests pass in tool-awareness + client-result.
- **Task 2 RED** (`5ce5dd3`): `pnpm exec vitest run tests/candidate-select.test.tsx -t passes the matching tabHint --reporter=tap-flat` exited 1 with `RED_EVIDENCE_OK`; the record is in `.tdd/09-04-task2-red-evidence.json`. The target failed with `expected undefined to be 'install'`: the tree walker found the ControlsLine element, but no `tabHint` was passed. Twenty Task 2 tests failed in total. They failed on the missing Tab branch and third useState (`stateSetters[2]` undefined), the footer copy, the ControlsLine chips and the `candidateKey` stub. The guard `ignores a toggled key whose plan has no form` passed by design.
- **Task 2 GREEN** (`22553c5`): 67/67 tests pass in candidate-select + controls-line + modal-layout.
- **REFACTOR:** none needed.

## Verification

- `pnpm exec vitest run tests/tool-awareness.test.ts tests/candidate-select.test.tsx tests/controls-line.test.tsx tests/modal-layout.test.ts tests/client-result.test.ts`: 5 files, 127 tests pass.
- `pnpm exec vitest run tests/candidate-select.test.tsx -t "install"`: 13 pass.
- `pnpm typecheck`: 0 errors. `pnpm lint`: exits 0 with 2 warnings that were already there (an unused suppression in CandidateSelect.tsx L124, and unused vitest imports in modal-layout.test.ts L1). Both are out of scope.
- `pnpm test:run` (full suite on main after 09-02/09-03): 30 files, 476 tests pass. This is a pre-check for the wave-2 merge gate, which 09-05 Task 1 still owns.
- `test -z "$(git log --name-only --format= --grep='(09-04)' -- .wolf)"`: passes. No 09-04 commit touches `.wolf/`.
- All acceptance-criteria greps for Task 1 and Task 2 pass, with each count at or above its threshold.

## Files Created/Modified

- `src/shared/tool-awareness.ts`: installer, package map, safe-name regex, install-form builder, `planInstall`, `DisplayCandidate.install`, platform-aware `annotateCandidates`.
- `src/ui/modal-layout.ts`: `candidateKey`, `displayedCommand`, `isInstallToggled`, state-aware `missingToolsFooterText(candidate, toggled)`, `installToggled` layout input.
- `src/ui/ControlsLine.tsx`: `ControlsLineProps` and the optional tab chips.
- `src/ui/CandidateSelect.tsx`: Tab toggle, displayed-text rows and insertion, install footers, `tabHint` wiring.
- Tests: `tests/tool-awareness.test.ts`, `tests/client-result.test.ts`, `tests/candidate-select.test.tsx`, `tests/modal-layout.test.ts`, new `tests/controls-line.test.tsx`.

## Decisions Made

- The brace wrap checks the last lexHand token for an existing terminator, not the string. An escaped `\;` (for example `find -exec … \;`) is a word, so it still gets its own `;` when a wrap is needed.
- `displayedCommand` and `isInstallToggled` are exported from `modal-layout.ts` instead of being a CandidateSelect-local helper, so the render and the estimate share one definition.

## Deviations from Plan

### Auto-fixed Issues

None. There were no bugs or blockers.

### Minor structural choices

- **`displayedCommand` is shared, not local.** The plan described a local `displayedCommand(candidate)` in CandidateSelect. It lives in `modal-layout.ts` with `isInstallToggled`, because the estimate needs the same rule. Behavior is the same as planned.
- **Existing call site updated for the new footer signature.** `tests/modal-layout.test.ts` called `missingToolsFooterText(missing)`. The plan changes that signature to `(candidate, toggled)`, so the call now passes a candidate object. The assertion is unchanged.
- **Commit trailer.** Following the user's standing rule, no Co-Authored-By trailer was added, although the runtime attribution reminder asked for one.

**Total deviations:** 0 auto-fixed. **Impact:** none on scope.

## Issues Encountered

- The first Task 1 RED capture was rejected as `invalid_record` because a multi-line `toEqual` diff breaks Vitest's tap-flat output. It was re-captured with a scalar-assertion target (see TDD Gate Compliance).

## Known Stubs

None. The throw-on-call stubs from both RED commits are fully replaced.

## Threat Flags

None. No new surface beyond the plan's threat model. T-09-10, T-09-11, T-09-12, T-09-13 and T-09-20 are each mitigated and tested.

## Deferred OpenWolf updates

09-05 Task 1 applies these. This plan commits no `.wolf/` file.

- **anatomy.md, new entry:** `tests/controls-line.test.tsx`: calls `ControlsLine(props)` directly and flattens its element tree. Asserts there is no tab chip without a hint, the exact chip order with `tabHint: 'install'`, and the `undo install` chip. (~0.5k tokens)
- **anatomy.md, updated descriptions:**
  - `src/shared/tool-awareness.ts`: adds the installer choice (`pickInstaller`, `INSTALL_COMMANDS`, `LINUX_INSTALLER_ORDER`), the shipped `PACKAGE_ALIASES` map with `packageFor`, `SAFE_PACKAGE_NAME_RE`, and `buildInstallForm`/`planInstall`. The form brace-wraps list commands and blocks unsafe words, comments and heredocs. `annotateCandidates(…, platform)` attaches `install` to flagged candidates.
  - `src/ui/CandidateSelect.tsx`: Tab/Shift+Tab toggles a flagged row to its install form. The toggle state is the third useState, a Set of `candidateKey`s. Enter inserts the displayed text, the footer shows install state, and `tabHint` is passed to ControlsLine.
  - `src/ui/ControlsLine.tsx`: optional `tabHint` (`install` | `undo install`) chips between accept and cancel.
  - `src/ui/modal-layout.ts`: adds `candidateKey`, `displayedCommand`, `isInstallToggled`, state-aware `missingToolsFooterText(candidate, toggled)`, and the `installToggled` layout input.
- **cerebrum.md, Key Learnings:**
  - [2026-10-08] CandidateSelect's third `useState` is the install toggle (`stateValues[2]` / `stateSetters[2]` in tests), after selectedIndex (0) and query (1). New state goes after it.
  - [2026-10-08] Vitest's `--reporter=tap-flat` breaks TAP when a failing `toEqual` prints a multi-line object diff. The RED-evidence classifier then reports `invalid_record` / "Non-TAP data". Capture RED with `-t` on a scalar-assertion target.
- **buglog.json:** no entry needed. No production bug was found or fixed. The RED-capture issue above is tooling behavior, recorded as a learning.

## Next Phase Readiness

Ready for 09-05. Wave-2 work (09-02, 09-03, 09-04) is all on main, and the full suite passes. 09-05 should apply the deferred OpenWolf entries above.

## Self-Check: PASSED

- FOUND: tests/controls-line.test.tsx, src/shared/tool-awareness.ts, src/ui/CandidateSelect.tsx, src/ui/ControlsLine.tsx, src/ui/modal-layout.ts, both `.tdd/09-04-task*-red-evidence.json`
- FOUND commits: 2887940, b9fa02d, 5ce5dd3, 22553c5 (all ancestors of HEAD)
