---
status: diagnosed
phase: 09-installed-only-command-awareness
source: [09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md, 09-04-SUMMARY.md, 09-05-SUMMARY.md]
started: 2026-10-11T02:48:53Z
updated: 2026-10-11T08:41:28.124Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Stop the daemon with `pkill -f "daemon --socket /tmp/qq-"`, then open a new zsh tab (run `qq_dev` first if the Homebrew widget loads last in your ~/.zshrc). Type an intent such as `find large files??`. The daemon starts fresh with no errors, and the candidate list appears with real model suggestions.
result: pass

### 2. Missing-tool mark and legend
expected: Type an intent likely to suggest a tool you do NOT have installed (for example `benchmark this command??` if `hyperfine` is missing). That row's explanation starts with a cyan ⓘ. A legend `ⓘ not installed · tab prepends the install command` sits directly above the controls. Rows using installed tools have no mark, and the modal height does not jump when you move between rows with the arrow keys.
result: pass

### 3. Tab toggles the install form
expected: On a flagged row, press Tab. The row shows `brew install <pkg> && <original command>`. Press Tab again and it returns to the original command. Typing a search query while toggled keeps the row visible.
result: pass

### 4. Enter only inserts
expected: With the install form showing, press Enter. The full `brew install … && …` text is inserted into your shell line and nothing runs until you press Enter in the shell yourself.
result: pass

### 5. Same-session freshness
expected: In the SAME shell, `brew install` a tool that was just flagged, then run the same `??` intent again. Suggestions using that tool are no longer flagged, with no new shell or `rehash` needed.
result: pass

### 6. Shell functions count as installed
expected: If you use a function-only tool such as `nvm`, ask something like `switch node version??`. Suggestions using `nvm` are not flagged.
result: pass

### 7. Kill switch
expected: Run `QQ_TOOL_AWARENESS=0`, then use `??` on an intent that previously showed ⓘ. No ⓘ marks or legend appear. Repeat inside a Zellij pane and outside it; both show no marks.
result: issue
reported: "when i reenable tool awareness, and retrigger the qq ui, the list shows 3 results and then dwindles down to zero  so its just a modal with nothing in it"
severity: major

### 8. Model prefers installed tools
expected: Across a few everyday intents (search text, find files, view JSON), suggestions mostly use tools you have installed. A missing tool appears only occasionally, and flagged rather than dropped.
result: pass

### 9. ?? still opens quickly
expected: In your normal interactive shell, `??` opens about as fast as it did before Phase 9, with no noticeable extra delay from the tool handoff.
result: pass

### 10. 09-01 D1: Guarded zsh handoff: rehash every call, three names-only writes, kill switch, never trips the widget ERR trap, called after request.json and before both launches
expected: Guarded zsh handoff: rehash every call, three names-only writes, kill switch, never trips the widget ERR trap, called after request.json and before both launches
result: pass
source: automated
coverage_id: D1

### 11. 09-01 D2: Handoff timing guard: median of 5 under zsh -f below 25 ms (printed)
expected: Handoff timing guard: median of 5 under zsh -f below 25 ms (printed)
result: pass
source: automated
coverage_id: D2

### 12. 09-01 D3: Client reads the handoff eagerly, annotates candidates in model order, flagged candidate still inserts verbatim; missing files / QQ_TOOL_AWARENESS=0 give no flags; malformed model output never throws
expected: Client reads the handoff eagerly, annotates candidates in model order, flagged candidate still inserts verbatim; missing files / QQ_TOOL_AWARENESS=0 give no flags; malformed model output never throws
result: pass
source: automated
coverage_id: D3

### 13. 09-01 D4: Builtins, reserved words, placeholders, $VAR and path commands never flagged; function/alias names count as installed
expected: Builtins, reserved words, placeholders, $VAR and path commands never flagged; function/alias names count as installed
result: pass
source: automated
coverage_id: D4

### 14. 09-01 D5: ⊘ mark and shared footer render, layout estimate rows, inline reserve 17
expected: ⊘ mark and shared footer render, layout estimate rows, inline reserve 17
result: pass
source: automated
coverage_id: D5

### 15. 09-02 D1: All 40 spike 002 cases (37 core, 3 stretch, none optional) match the external words in order, with builtins from zsh -f ${(k)builtins}
expected: All 40 spike 002 cases (37 core, 3 stretch, none optional) match the external words in order, with builtins from zsh -f ${(k)builtins}
result: pass
source: automated
coverage_id: D1

### 16. 09-02 D2: Placeholder, dynamic, path, builtin and reserved-word kinds are never external; command -v is a lookup only; brew install fd && fd -e ts gives brew, fd (D-06)
expected: Placeholder, dynamic, path, builtin and reserved-word kinds are never external; command -v is a lookup only; brew install fd && fd -e ts gives brew, fd (D-06)
result: pass
source: automated
coverage_id: D2

### 17. 09-02 D3: Robustness: oversized input returns [], prototype-key words classify as external, trailing-backslash inputs yield rg / a, no word contains undefined
expected: Robustness: oversized input returns [], prototype-key words classify as external, trailing-backslash inputs yield rg / a, no word contains undefined
result: pass
source: automated
coverage_id: D3

### 18. 09-02 D4: Token contract for 09-04: one op & in nohup fd x 2>&1 &, redir << in a heredoc, one comment token in cd src; fd x # note, # c is a single comment token
expected: Token contract for 09-04: one op & in nohup fd x 2>&1 &, redir << in a heredoc, one comment token in cd src; fd x # note, # c is a single comment token
result: pass
source: automated
coverage_id: D4

### 19. 09-02 D5: 25k seeded random inputs (seed 1 x 20k under a 15 s kill, seed 7 x 5k under a 10 s kill), 33 crafted malformed inputs at a 1 s kill each, 2,000 nested $( under 100 ms, all in child processes
expected: 25k seeded random inputs (seed 1 x 20k under a 15 s kill, seed 7 x 5k under a 10 s kill), 33 crafted malformed inputs at a 1 s kill each, 2,000 nested $( under 100 ms, all in child processes
result: pass
source: automated
coverage_id: D5

### 20. 09-03 D1: Shipped catalog allow list with 196 unique plain tool names and a sorted catalog ∩ installed helper
expected: Shipped catalog allow list with 196 unique plain tool names and a sorted catalog ∩ installed helper
result: pass
source: automated
coverage_id: D1

### 21. 09-03 D2: Lenient daemon-side installed-tools schema filters unknown names and duplicates, rejects malformed names and >512 entries; strict client schema rejects non-catalog names with the D-04 message
expected: Lenient daemon-side installed-tools schema filters unknown names and duplicates, rejects malformed names and >512 entries; strict client schema rejects non-catalog names with the D-04 message
result: pass
source: automated
coverage_id: D2

### 22. 09-03 D3: buildSystemPrompt returns QUEQUE_SYSTEM byte-for-byte without the chunk and appends the D-15/D-16/D-17 steering with it
expected: buildSystemPrompt returns QUEQUE_SYSTEM byte-for-byte without the chunk and appends the D-15/D-16/D-17 steering with it
result: pass
source: automated
coverage_id: D3

### 23. 09-03 D4: SDK system field and claude -p --system-prompt both come from buildSystemPrompt(envelope); user prompt byte-identical with or without the chunk
expected: SDK system field and claude -p --system-prompt both come from buildSystemPrompt(envelope); user prompt byte-identical with or without the chunk
result: pass
source: automated
coverage_id: D4

### 24. 09-03 D5: adapters guard fails any provider file that bypasses buildSystemPrompt (mutation-checked with a temporary bypassing adapter)
expected: adapters guard fails any provider file that bypasses buildSystemPrompt (mutation-checked with a temporary bypassing adapter)
result: pass
source: automated
coverage_id: D5

### 25. 09-04 D1: Installer choice (brew on darwin; first of apt/dnf/pacman on linux; null otherwise), shipped package map, deduplicated packages, guarded install forms with exact-string wrap and block rules
expected: Installer choice (brew on darwin; first of apt/dnf/pacman on linux; null otherwise), shipped package map, deduplicated packages, guarded install forms with exact-string wrap and block rules
result: pass
source: automated
coverage_id: D1

### 26. 09-04 D2: annotateCandidates attaches an install plan to flagged candidates only, order unchanged; D-07 cases judged by the normal rule; buildShellBuffers cursor on an install form
expected: annotateCandidates attaches an install plan to flagged candidates only, order unchanged; D-07 cases judged by the normal rule; buildShellBuffers cursor on an install form
result: pass
source: automated
coverage_id: D2

### 27. 09-04 D3: Tab/Shift+Tab toggle, Enter inserts the shown text, Tab ignored on unflagged/blocked rows and never reaches search, footers per state, D-08 dual marks, toggle survives filtering, tabHint on the ControlsLine element
expected: Tab/Shift+Tab toggle, Enter inserts the shown text, Tab ignored on unflagged/blocked rows and never reaches search, footers per state, D-08 dual marks, toggle survives filtering, tabHint on the ControlsLine element
result: pass
source: automated
coverage_id: D3

### 28. 09-05 D1: Pong advertises installedTools; legacy pongs (with and without fetchCandidates) are replaced; catalog drift is filtered daemon-side and a malformed chunk is ignored without an ack timeout
expected: Pong advertises installedTools; legacy pongs (with and without fetchCandidates) are replaced; catalog drift is filtered daemon-side and a malformed chunk is ignored without an ack timeout
result: pass
source: automated
coverage_id: D1

### 29. 09-05 D2: Client envelope carries exactly one validated installed-tools chunk (sorted catalog ∩ installed, incl. function-only nvm); no handoff means no chunk and buildSystemPrompt === QUEQUE_SYSTEM
expected: Client envelope carries exactly one validated installed-tools chunk (sorted catalog ∩ installed, incl. function-only nvm); no handoff means no chunk and buildSystemPrompt === QUEQUE_SYSTEM
result: pass
source: automated
coverage_id: D2

### 30. 09-05 D3: ⓘ before the explanation, legend above the controls, height unchanged across selection, no tab chip
expected: ⓘ before the explanation, legend above the controls, height unchanged across selection, no tab chip
result: pass
source: automated
coverage_id: D3

## Summary

total: 30
passed: 29
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-09-7
  truth: "Run `QQ_TOOL_AWARENESS=0`, then use `??` on an intent that previously showed ⓘ. No ⓘ marks or legend appear. Repeat inside a Zellij pane and outside it; both show no marks. After re-enabling tool awareness, the next ?? shows its candidates and keeps them."
  status: failed
  reason: "User reported: when i reenable tool awareness, and retrigger the qq ui, the list shows 3 results and then dwindles down to zero  so its just a modal with nothing in it"
  severity: major
  test: 7
  root_cause: "Not caused by the kill switch (the same rate with no inventory; the code dates from 99adc79, before Phase 9). When candidates arrive, CandidateSelect's layout effect reports the size of the first render, which still filters by initialQuery = request.lbuffer (0 matches, 7 lines, pane height 9), before the reset effect clears the query (22 lines, height 24). syncZellijFloatingPaneHeight starts a detached `zellij action change-floating-pane-coordinates` for each height, and Zellij applies them in finish order, so when the height-9 call lands last the pane stays at 9 rows. 15 lines go into scrollback and the modal looks empty. Ink never redraws, because the /dev/tty tty.WriteStream never emits 'resize'. Reproduced in real Zellij 0.44.1 (5/18 runs with flags, 4/14 with no inventory); an empty initialQuery fixed it in 10/10 runs."
  artifacts:
    - path: "src/ui/CandidateSelect.tsx"
      issue: "Layout effect (L137-166) reports onLayoutLinesChange for the stale initialQuery render before the reset effect (L119-126) clears the query"
    - path: "src/client/zellij-pane-resize.ts"
      issue: "syncZellijFloatingPaneHeight (L53-76) starts detached zellij actions with no ordering; lastSyncedHeight only drops repeated heights, so a shrink then grow can land in reverse"
    - path: "src/client/run-foreground.ts"
      issue: "Ink's /dev/tty tty.WriteStream (L204-205, L290-295) never emits 'resize', so there is no redraw after the pane resize; initialQuery: request.lbuffer at L263"
  missing:
    - "Never report the transient initialQuery-filtered height to Zellij (for example, decide during render that a no-match initial query is cleared, not in an effect after it)"
    - "Serialize Zellij resizes: one zellij action at a time, and apply only the latest requested height"
    - "Optional: wire SIGWINCH to the custom /dev/tty write stream so it refreshes columns/rows and emits 'resize' for Ink"
    - "Regression tests: real-hooks render asserting onLayoutLinesChange never gets the no-match estimate when candidates arrive; the resize helper's final height equals the last height requested"
  debug_session: ".planning/debug/empty-modal-after-tool-awareness-reenable.md"
