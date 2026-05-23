---
slug: selection-summary-and-history
date: 2026-05-22
status: in_progress
---

# Quick Task: Selection Summary and History

## Goal

On successful candidate selection, three things must happen:

1. **History**: ZSH history gains the original query (lbuffer before `??`) via `print -s`
2. **Summary lines above PS1**: Two lines printed before `zle reset-prompt`:
   - `que-que › <original-query>` (dim gray)
   - `<selected-command>  # <explanation>` (default color)
3. **LBUFFER set to original query**: LBUFFER is left with the query text (not the command) so the user can refine and re-trigger with `??`

## Files

- `shell/zsh/qq.zsh` — both the `_qq_apply_result` function (inline/non-Zellij path) and the Zellij inline-JSON path's `replace-buffer` handler
- `tests/zsh-widget.test.ts` — update the `replace-buffer sets LBUFFER and RBUFFER to new values` test (LBUFFER now becomes QQ_ORIG_LBUFFER, not the command)

## Key insight

The result file's `lbuffer` and `rbuffer` still carry the selected command and `  # explanation`. ZSH reads them for display (prints them above PS1) but sets `LBUFFER = QQ_ORIG_LBUFFER` and `RBUFFER = ""` instead. No Node or schema changes needed.

## Tasks

### Task 1: Update `_qq_apply_result` (inline/non-Zellij path)

In the `replace-buffer` case of `_qq_apply_result`:

```zsh
replace-buffer)
  local new_lbuffer new_rbuffer _jq_lbuf_status _jq_rbuf_status
  new_lbuffer=$(jq -r '.lbuffer // empty' "$result_file" 2>/dev/null)
  _jq_lbuf_status=$?
  new_rbuffer=$(jq -r '.rbuffer // ""' "$result_file" 2>/dev/null)
  _jq_rbuf_status=$?
  if [[ $_jq_lbuf_status -ne 0 ]] || [[ $_jq_rbuf_status -ne 0 ]] || [[ -z "$new_lbuffer" ]]; then
    LBUFFER="$QQ_ORIG_LBUFFER"
    RBUFFER="$QQ_ORIG_RBUFFER"
    return 1
  fi
  # Print summary above PS1
  local escaped_query="${QQ_ORIG_LBUFFER//\%/%%}"
  [[ -n "$QQ_ORIG_LBUFFER" ]] && print -P "%F{240}que-que › ${escaped_query}%f"
  print -r -- "${new_lbuffer}${new_rbuffer}"
  # Add original query to history
  [[ -n "$QQ_ORIG_LBUFFER" ]] && print -s -- "$QQ_ORIG_LBUFFER"
  # Restore original query to LBUFFER for refinement
  LBUFFER="$QQ_ORIG_LBUFFER"
  RBUFFER=""
  return 0
  ;;
```

Remove the old `query` print block entirely.

### Task 2: Update Zellij inline-JSON path

Same logic in the `replace-buffer` case inside the `if [[ -n "$ZELLIJ" ]]` block:

```zsh
replace-buffer)
  ...
  if [[ ... ]] || [[ -z "$new_lbuffer" ]]; then
    LBUFFER="$QQ_ORIG_LBUFFER"; RBUFFER="$QQ_ORIG_RBUFFER"
  else
    local escaped_query="${QQ_ORIG_LBUFFER//\%/%%}"
    [[ -n "$QQ_ORIG_LBUFFER" ]] && print -P "%F{240}que-que › ${escaped_query}%f"
    print -r -- "${new_lbuffer}${new_rbuffer}"
    [[ -n "$QQ_ORIG_LBUFFER" ]] && print -s -- "$QQ_ORIG_LBUFFER"
    LBUFFER="$QQ_ORIG_LBUFFER"
    RBUFFER=""
  fi
```

Remove the old `inline_query` print block.

### Task 3: Update test

In `tests/zsh-widget.test.ts`, update the `replace-buffer sets LBUFFER and RBUFFER to new values` test:
- `QQ_ORIG_LBUFFER` is set to `"orig left"` in the test
- After the call, `LBUFFER` should be `"orig left"` (QQ_ORIG_LBUFFER), not `"git status"`
- `RBUFFER` should be `""` (empty)
- The summary lines (`que-que › orig left` and `git status`) should appear in stdout

### Task 4: Commit

One atomic commit covering all changes.
