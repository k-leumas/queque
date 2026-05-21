# T03: 03 03

**Slice:** S03 — **Milestone:** M001

## Description

Add the `error)` case to both the `_qq_apply_result` helper function and the `qq-question-widget` inline case block in qq.zsh. Add a test to zsh-widget.test.ts verifying that _qq_apply_result no-ops buffer mutation on error kind.

Purpose: SAFE-01 — the shell buffer must never be mutated when the provider returns an error. The error ShellResult written by Plan 02 reaches the ZSH widget via FIFO; the widget must handle it by restoring original buffers and returning control to the user. Both case blocks must be updated because they serve different code paths (tests use _qq_apply_result; runtime uses qq-question-widget inline block).
Output: qq.zsh with explicit error handling, zsh-widget.test.ts with new test, full suite green.

## Must-Haves

- [ ] "_qq_apply_result handles error kind: restores QQ_ORIG_LBUFFER and QQ_ORIG_RBUFFER and returns 0"
- [ ] "qq-question-widget inline case block handles error kind: restores original buffers"
- [ ] "tests/zsh-widget.test.ts has a test for _qq_apply_result with error kind returning 0 and leaving buffers unchanged"
- [ ] "pnpm test:run passes green after all changes in this plan"

## Files

- `shell/zsh/qq.zsh`
- `tests/zsh-widget.test.ts`
