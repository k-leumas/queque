# T02: 01-shell-bridge-and-result-contract 02

**Slice:** S01 — **Milestone:** M001

## Description

Implement the real `zsh` bridge: intercept `??` through a `?` widget, preserve shell state on cancel, and apply split-buffer results on accept.

Purpose: This is the user-visible shell seam that makes QueQue feel native instead of acting like a separate prompt-taking CLI.
Output: A sourceable `zsh` integration script and a smoke test that locks the trigger/cancel/apply behavior.

## Must-Haves

- [ ] "Typing a single `?` still inserts immediately without a visible KEYTIMEOUT pause."
- [ ] "Typing `??` captures the pre-trigger shell buffers and invokes QueQue."
- [ ] "Cancel restores the original shell buffers exactly."
- [ ] "Accepted results write `lbuffer` and `rbuffer` back into the live shell line."

## Files

- `shell/zsh/qq.zsh`
- `tests/zsh-widget.test.ts`
