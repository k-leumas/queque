---
slug: selection-summary-and-history
date: 2026-05-22
status: complete
commit: 563b8a9
---

# Summary: Selection Summary and History

## What Changed

`shell/zsh/qq.zsh` — both `_qq_apply_result` (non-Zellij inline path) and the Zellij inline-JSON path's `replace-buffer` handler:

1. **Summary lines above PS1**: On acceptance, two lines are printed before `zle reset-prompt`:
   - `queque › <original-query>` (dim color 240 — escaped to protect `%` chars)
   - `<selected-command>  # <explanation>` (raw print, no color escape)
2. **History**: `print -s -- "$QQ_ORIG_LBUFFER"` adds the original query to ZSH history so the user can recall it with ↑.
3. **LBUFFER set to original query**: `LBUFFER = QQ_ORIG_LBUFFER` (not the command). `RBUFFER = ""`. This leaves the user's natural-language query in the shell line as an affordance for refinement + re-triggering with `??`.

`tests/zsh-widget.test.ts` and `tests/client-result.test.ts` — updated to reflect the new LBUFFER contract (LBUFFER = original query, not command) and to assert summary line output.

## Result

132/132 tests pass.
