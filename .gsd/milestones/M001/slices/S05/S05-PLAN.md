# S05: Zellij Floating Pane Integration For Best Ux

**Goal:** Update both existing test files so that they cover Phase 3.
**Demo:** Update both existing test files so that they cover Phase 3.

## Must-Haves


## Tasks

- [x] **T01: 03.2 01** `est:22min`
  - Update both existing test files so that they cover Phase 3.2 behaviors before the production files are modified. This is the Wave 1 foundation: the tests go RED first (or are neutral stubs) so that Wave 2 implementation has immediate automated feedback.

Purpose: Establish the test contracts for (a) FIFO-aware write in result-writer.ts, (b) $ZELLIJ detection and skip in run-foreground.ts, and (c) Zellij detection guard in the zsh widget. All tests must use the correct mock shape so existing passing tests remain green after this plan lands.

Output: Two modified test files. No production code changes in this plan.
- [x] **T02: 03.2 02** `est:7min`
  - Implement the two Node.js production file changes for Phase 3.2:

1. `result-writer.ts` — add FIFO-aware write: detect FIFO path via fsp.stat().isFIFO() and use direct fsp.writeFile() instead of the atomic-rename path. The atomic-rename path is preserved for regular files.

2. `run-foreground.ts` — add Zellij branch: when process.env['ZELLIJ'] is defined, skip fsp.open('/dev/tty'), skip ttyReadStream/ttyWriteStream construction, skip the blank-line scroll hack, and pass empty renderOptions to Ink render(). Remove MODAL_CHROME_LINES constant entirely.

Purpose: These two changes enable the Zellij floating pane IPC contract — the client writes the result JSON directly to the FIFO path, and Ink renders into the pane's own PTY without any /dev/tty gymnastics.

Output: Two modified TypeScript source files. Tests from Plan 01 must go green after this plan.
- [x] **T03: 03.2 03**
  - Rewrite the body of qq-question-widget in shell/zsh/qq.zsh to use the Zellij floating pane IPC pattern. This is the final production change for Phase 3.2.

The rewrite:
- Adds a [[ -z "$ZELLIJ" ]] guard that exits with zle -M message (D-01)
- Creates a FIFO via mkfifo before launching (D-03)
- Backgrounds the zellij run --floating --close-on-exit --width 80 --height 24 launch (D-06)
- Blocks on IFS= read -r -t 30 result < "$fifo_path" (D-05, Pitfall 3)
- Applies result inline via jq parse from $result variable (RESEARCH.md Finding 7, Option B)
- Cleans up both FIFO and req_file via a trap that resets itself after firing (Pitfall 5)
- Removes all /dev/tty redirections (D-02)

All other functions (_qq_log, _qq_prewarm_daemon, _qq_capture_buffers, _qq_apply_result, the register+bind block) are KEPT verbatim.

Purpose: Complete the Zellij floating pane integration. After this plan, the full round-trip (widget → FIFO → pane → Ink TUI → result → buffer) is operational.

Output: One modified shell file. All Phase 3.2 automated tests green. Manual verification checkpoint confirms real end-to-end behavior.

## Files Likely Touched

- `tests/client-result.test.ts`
- `tests/zsh-widget.test.ts`
- `src/client/result-writer.ts`
- `src/client/run-foreground.ts`
- `shell/zsh/qq.zsh`
