# Quick Task 260502-cf6: fix the ci so the tests pass

**Status:** complete

## Summary

The shell widget file now registers ZLE bindings only in interactive shells. That keeps the file safe to source in noninteractive CI `zsh` invocations while preserving the interactive widget behavior.

## Verification

- `zsh -c 'source shell/zsh/qq.zsh; echo ok'`
- `pnpm test:run tests/zsh-widget.test.ts`

Both commands passed locally after the change.
