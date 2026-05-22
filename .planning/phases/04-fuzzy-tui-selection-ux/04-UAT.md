---
status: diagnosed
phase: 04-fuzzy-tui-selection-ux
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md
started: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running qq daemon. Start qq from scratch with: pnpm dev (or pnpm build && node dist/main.js daemon). The daemon boots without errors. Then trigger ?? in a live zsh session — qq launches, loads, and returns a command to the shell buffer without any startup error messages.
result: issue
reported: "it worked, but there were several issues: terminal that launched prompt appended with terminal_DD, when it fails it hangs the invoking terminal, selecting a candidate from the candidate selector using enter does not return you to the invoking commandline, you have to escape and loose everything"
severity: blocker
notes: "Three distinct bugs observed: (A) cosmetic terminal_DD suffix on prompt, (B) shell hangs on failure — pre-confirms Test 6 failed, (C) Enter key does not write selected command back to shell buffer — core flow broken, will affect Tests 2–5"

### 2. Down arrow wraps to first candidate
expected: Open qq (trigger ??). When multiple candidates are shown, press the down arrow key until you reach the last candidate. Press down one more time. The selection should wrap around to the first (topmost) candidate.
result: pass

### 3. Up arrow wraps to last candidate
expected: Open qq (trigger ??). When multiple candidates are shown, the first candidate is selected by default. Press the up arrow key once. The selection should wrap around to the last (bottommost) candidate.
result: pass

### 4. Search resets selection to first
expected: Open qq (trigger ??). Navigate down to select a non-first candidate (e.g., second or third). Then start typing characters in the search/filter input. As soon as you type, the selection should jump back to the first visible result — not stay on whatever was selected before.
result: pass

### 5. Zero-match filter shows no candidates
expected: Open qq (trigger ??). Type something in the search box that matches none of the candidates (e.g., "xyzxyzxyz"). The candidate list should be empty — no "invisible" selected item, no crash, no stale selection showing from before the filter was applied.
result: pass

### 6. FIFO crash safety — no 30-second shell hang
expected: Open qq (trigger ?? while typing a command). While qq is loading (before you pick a result), force-kill the qq Node process from another terminal: `pkill -f "node.*qq"` or `kill <PID>`. The shell should recover within ~1–2 seconds and return control (showing either an empty buffer or no change) — it must NOT hang for 30 seconds waiting for a result that will never come.
result: skipped
reason: "Not reproducible at testing speed. User reports no hang observed after session fixes. Pinned for future targeted test."

## Summary

total: 6
passed: 4
issues: 1
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "Selecting a candidate with Enter returns the command to the invoking shell buffer"
  status: failed
  reason: "User reported: Enter does not return to invoking command line, must escape and lose everything"
  severity: blocker
  test: 1
  root_cause: "Unconfirmed — observed before interactive:true fix was applied. May be resolved; needs targeted retest."
  artifacts:
    - path: "src/client/run-foreground.ts"
      issue: "onSelect writes to FIFO and unmounts — shell widget FIFO read may not complete before pane closes"
  missing:
    - "Verify shell widget receives replace-buffer result after Enter press with interactive:true fix in place"
  debug_session: ""

- truth: "Terminal prompt does not display spurious identifiers (e.g. terminal_DD) when qq launches"
  status: failed
  reason: "User reported: terminal that launched prompt appended with terminal_DD"
  severity: cosmetic
  test: 1
  root_cause: "Likely Zellij pane title leaking into the invoking terminal's prompt or title bar. terminal_DD may be the Zellij pane identifier."
  artifacts:
    - path: "shell/zsh/qq.zsh"
      issue: "Zellij pane launch may be setting terminal title or PS1 in the invoking shell"
  missing:
    - "Inspect what terminal_DD suffix comes from — Zellij pane title escape sequence bleeding into invoking terminal"
  debug_session: ""

- truth: "If qq crashes or is killed, shell widget recovers within ~1-2 seconds (no 30-second hang)"
  status: skipped
  reason: "Not observed during session — user reports no hang. Pinned for future targeted test."
  severity: blocker
  test: 6
  root_cause: "Previously failing before interactive:true fix; may have been incidentally resolved"
  artifacts: []
  missing: []
  debug_session: ""
