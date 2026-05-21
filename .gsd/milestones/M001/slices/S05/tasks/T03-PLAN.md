# T03: 03.2 03

**Slice:** S05 — **Milestone:** M001

## Description

Rewrite the body of qq-question-widget in shell/zsh/qq.zsh to use the Zellij floating pane IPC pattern. This is the final production change for Phase 3.2.

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

## Must-Haves

- [ ] "User types ?? inside a Zellij session and a floating pane opens at 80×24 — D-10"
- [ ] "User selects a candidate and the command lands in the live shell buffer"
- [ ] "User cancels (Esc) and the original buffer is restored with no leftover ? characters"
- [ ] "User types ?? outside Zellij and sees a message containing 'Zellij' then returns to the shell"
- [ ] "No /tmp/qq-fifo.* files remain after a completed or cancelled invocation"
- [ ] "pnpm test:run exits 0 after the widget rewrite"
- [ ] "Widget backgrounds zellij run --floating --close-on-exit --width 80 --height 24 with &! — D-06"
- [ ] "Widget blocks on FIFO read until client writes result, then applies result inline — D-05"
- [ ] "Request passed via --request-file temp JSON; only result moves to FIFO channel — D-07"

## Files

- `shell/zsh/qq.zsh`
