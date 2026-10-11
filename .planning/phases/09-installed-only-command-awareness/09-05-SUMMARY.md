---
phase: 09-installed-only-command-awareness
plan: 05
subsystem: daemon, client, ui
tags: [tool-awareness, ipc, steering, daemon-capability, ink, uat]

requires:
  - phase: 09-01
    provides: zsh handoff, ToolInventory, annotateCandidates, missing-tool mark
  - phase: 09-02
    provides: installed-tools envelope chunk schema
  - phase: 09-03
    provides: buildSteeringText / buildSystemPrompt, daemon-side catalog filter
  - phase: 09-04
    provides: install plans, Tab toggle
provides:
  - "src/contracts/ipc.ts, src/daemon/server.ts: pong carries installedTools: true"
  - "src/daemon/bootstrap.ts: pingDaemonFetchCap needs both capability flags, so a pre-Phase-9 daemon is replaced"
  - "src/client/run-foreground.ts: withInstalledToolsChunk sends catalog ∩ installed, validated by strictInstalledToolsChunkSchema"
  - "src/ui/modal-layout.ts: MISSING_TOOL_MARK = 'ⓘ', explanationText, missingToolsLegend (missingToolsFooterText removed)"
  - "src/ui/ControlsLine.tsx: no props (tab chip removed)"
affects: [phase verification]

actuals:
  tasks: 3
  commits: 7
plan_head_before: 098f5f3b71b5e9156d669404b9d98a3e1e08012d
plan_head_after: 88b08dc1fc80f5256d6a1ab2541d6dc888f1438d

tech-stack:
  added: []
  patterns:
    - "Daemon capability flags on pong: a newer client replaces a daemon whose pong lacks a flag it needs"
    - "Modal height depends only on the visible list, never on the selection"

key-files:
  created: []
  modified:
    - src/contracts/ipc.ts
    - src/daemon/server.ts
    - src/daemon/bootstrap.ts
    - src/client/run-foreground.ts
    - src/ui/modal-layout.ts
    - src/ui/CandidateSelect.tsx
    - src/ui/ControlsLine.tsx
    - tests/daemon-bootstrap.test.ts
    - tests/daemon-fetch.test.ts
    - tests/client-result.test.ts
    - tests/candidate-select.test.tsx
    - tests/modal-layout.test.ts
    - tests/controls-line.test.tsx

key-decisions:
  - "Missing-tool mark is ⓘ (U+24D8), cyan, at the start of the row's explanation (user decision at the checkpoint; replaces ⊘ after the command)"
  - "No selection-dependent missing-tool footer: it made the modal jump on arrow keys. A legend `ⓘ not installed · tab prepends the install command` sits directly above the controls whenever any visible row is flagged; it names no tools, and the Tab clause appears only when a visible flagged row has an install form"
  - "The controls bar has no tab chip; the legend is the one place Tab is explained"

requirements-completed: [SC-1, SC-2, SC-6]

coverage:
  - id: D1
    description: "Pong advertises installedTools; legacy pongs (with and without fetchCandidates) are replaced; catalog drift is filtered daemon-side and a malformed chunk is ignored without an ack timeout"
    requirement: SC-6
    verification:
      - kind: unit
        ref: "tests/daemon-bootstrap.test.ts"
        status: pass
      - kind: unit
        ref: "tests/daemon-fetch.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Client envelope carries exactly one validated installed-tools chunk (sorted catalog ∩ installed, incl. function-only nvm); no handoff means no chunk and buildSystemPrompt === QUEQUE_SYSTEM"
    requirement: SC-6
    verification:
      - kind: unit
        ref: "tests/client-result.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "ⓘ before the explanation, legend above the controls, height unchanged across selection, no tab chip"
    requirement: SC-1
    verification:
      - kind: unit
        ref: "tests/candidate-select.test.tsx, tests/modal-layout.test.ts, tests/controls-line.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live ?? check: flag, Tab install form and back, insertion-only Enter, same-session freshness, nvm function, real-shell timing, kill switch inside and outside Zellij"
    requirement: SC-1, SC-2
    verification:
      - kind: manual_procedural
        ref: "Task 3 checkpoint — user replied \"approved\" on 2026-10-10"
        status: pass
    human_judgment: true
    rationale: "Needs a real interactive shell, a live package manager and a Zellij pane; tests mock Ink's input and run zsh -f, so glyph rendering, Tab feel, freshness after a real install and real-shell timing can only be judged by hand"

duration: 2 sessions (Tasks 1–2 on 2026-10-08; checkpoint and UI fixes on 2026-10-10)
completed: 2026-10-10
status: complete
---

# Phase 9 Plan 05: Installed-Tools Chunk, Daemon Capability and Live Check Summary

**The client now sends the installed catalog tools inside the envelope, so every adapter gets the same steering. A pre-Phase-9 daemon is replaced automatically. The live check passed after three rounds of UI feedback. A missing tool is now shown as a cyan ⓘ at the start of the row's explanation, and one legend above the controls explains the mark and what Tab does.**

## Accomplishments

- **Task 1 (`f225215`):** pong carries `installedTools: true`. `pingDaemonFetchCap` requires both capability flags, so `ensureDaemon` replaces a stale listener before fetching (T-09-14). Daemon tests prove that an unknown catalog name is filtered and the request still resolves (T-09-22), and that a malformed chunk is ignored. The deferred OpenWolf entries from 09-02, 09-03 and 09-04 were applied.
- **Task 2 (`c105e57`):** `withInstalledToolsChunk` appends catalog ∩ installed after `strictInstalledToolsChunkSchema`. On rejection it logs only an issue count, never tool names (T-09-15, T-09-16). Without handoff files, no chunk is sent and the prompt is byte-identical to the pre-phase prompt.
- **Task 3 (human checkpoint):** approved after the UI fixes below.

## Human Checkpoint Evidence

- **Handoff timing (SC-2, D-19):**
  - `zsh -f` guard (`tests/zsh-widget.test.ts -t "handoff timing"`): median **10.10 ms**. A second run under load gave 13.95 ms, still under the 25 ms guard.
  - Real interactive shell (`zsh -i` with the user's `~/.zshrc`; 2,175 commands, 494 functions and aliases, 104 builtins): median **12.37 ms** over 7 runs (9.93, 10.34, 11.52, 12.37, 13.01, 13.50, 17.59). The user replied "approved" without a number, so the orchestrator measured this in the same shell setup.
  - Both are close to the ~10 ms target.
- **SC-1:** the user approved the flag, the Tab install form and toggle, insertion-only Enter, same-session freshness, the nvm function and the kill switch.

## Checkpoint Feedback and Fixes

1. **`3209e9b`:** the user disliked ⊘, and the footer note made the modal jump as the selection moved. The mark became ⓘ and the selection-dependent footer was removed.
2. **`866956d`:** at the user's request, ⓘ moved to the start of the explanation. A selection-independent legend was added directly above the controls.
3. **`05c3534`:** at the user's request, the legend now says that Tab prepends the install command, but only when a visible flagged row has an install form.
4. **`612fa07`:** at the user's request, the legend names no tools. It reads `ⓘ not installed[ · tab prepends the install command]`.
5. **`88b08dc`:** at the user's request, the tab chip was removed from the controls, so `ControlsLine` takes no props.

## Issues Encountered

- **No indicators in the first live run.** `~/.zshrc` sourced the Homebrew widget (`/usr/local/share/queque/queque.zsh`) after the dev widget. The Homebrew widget predates Phase 9 and writes no handoff, so the debug log showed `tool handoff unavailable ENOENT` and `flagged: 0`. This was fixed in the user's `~/.zshrc`, not in the repo: the Homebrew widget now loads only when `QQ_DEV_ROOT` is unset, and `qq_prod` re-sources it. Logged as bug-205.
- **`tests/command-words-fuzz.test.ts` is flaky.** The child process hits its 1 s timeout before it reads any input, and it fails at HEAD without these changes too. It is unrelated to this plan and logged as bug-206 (open).

## Deviations from Plan

- **UI changes during the checkpoint.** The UI changes in `src/ui/*` and their tests came from the user's checkpoint feedback. They are not in the plan's `files_modified`.
- **No commit trailer.** Following the user's standing rule, no Co-Authored-By trailer was added.

## Verification

- `pnpm typecheck`: passes.
- `pnpm lint`: exits 0. Its 2 warnings were already there (an unused suppression in CandidateSelect.tsx, unused vitest imports in modal-layout.test.ts).
- `pnpm build`: succeeds.
- UI suites (candidate-select, modal-layout, controls-line): 69/69 pass.
- Full suite: 481 tests pass. The only failures are the bug-206 fuzz flake and, once under full-suite load, the timing guard, which passes alone.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. T-09-14, T-09-15, T-09-16 and T-09-22 are mitigated and tested. T-09-SC: no package installs were performed by QueQue.
