#!/usr/bin/env zsh
# qq.zsh — Que-Que ZLE widget and shell-side result contract
#
# Source this file from .zshrc to enable the ?? trigger:
#   source /path/to/shell/zsh/qq.zsh
#
# How it works:
#   1. Binds `?` to a custom widget in both emacs and viins keymaps.
#   2. On the first `?`, calls `.self-insert` so the key feels instant.
#   3. On the second `?` (detected by inspecting LBUFFER for a trailing `?`),
#      consumes the trigger, captures split buffers, and launches the client.
#   4. The client subprocess is reattached to /dev/tty so Ink receives keyboard
#      input (ZLE redirects widget stdin from /dev/null).
#   5. The result is read from a temp file and applied via _qq_apply_result.

# ---------------------------------------------------------------------------
# Buffer capture helper
# ---------------------------------------------------------------------------
# Strips the trailing `?` (trigger) from LBUFFER and exports:
#   QQ_ORIG_LBUFFER  — the exact LBUFFER at trigger time (including the `?`)
#   QQ_ORIG_RBUFFER  — the exact RBUFFER at trigger time
#   QQ_LBUFFER       — LBUFFER minus the trailing `?` (pre-trigger context)
#   QQ_RBUFFER       — RBUFFER unchanged

_qq_capture_buffers() {
  QQ_ORIG_LBUFFER="$LBUFFER"
  QQ_ORIG_RBUFFER="$RBUFFER"
  # Strip the trailing `?` that made up the second half of the `??` trigger
  QQ_LBUFFER="${LBUFFER%?}"
  QQ_RBUFFER="$RBUFFER"
}

# ---------------------------------------------------------------------------
# Result application helper
# ---------------------------------------------------------------------------
# Reads a JSON result file and applies it to LBUFFER/RBUFFER.
# Returns 0 on success (cancel or replace-buffer), nonzero on error.
#
# Expected shapes:
#   {"kind":"cancel"}
#   {"kind":"replace-buffer","lbuffer":"...","rbuffer":"..."}
#
# On malformed JSON or unrecognised `kind`, original buffers are left intact
# and the function returns 1 so callers can detect failure.

_qq_apply_result() {
  local result_file="$1"

  # Parse the kind field from the JSON result file
  local kind
  kind=$(jq -r '.kind // empty' "$result_file" 2>/dev/null)

  if [[ $? -ne 0 ]] || [[ -z "$kind" ]]; then
    # Malformed JSON — leave buffers as-is and return failure
    return 1
  fi

  case "$kind" in
    cancel)
      # Restore to the exact pre-trigger state
      LBUFFER="$QQ_ORIG_LBUFFER"
      RBUFFER="$QQ_ORIG_RBUFFER"
      return 0
      ;;
    replace-buffer)
      local new_lbuffer new_rbuffer
      new_lbuffer=$(jq -r '.lbuffer // empty' "$result_file" 2>/dev/null)
      new_rbuffer=$(jq -r '.rbuffer // ""' "$result_file" 2>/dev/null)
      if [[ $? -ne 0 ]]; then
        LBUFFER="$QQ_ORIG_LBUFFER"
        RBUFFER="$QQ_ORIG_RBUFFER"
        return 1
      fi
      LBUFFER="$new_lbuffer"
      RBUFFER="$new_rbuffer"
      return 0
      ;;
    *)
      # Unknown kind — leave buffers untouched and signal failure
      LBUFFER="$QQ_ORIG_LBUFFER"
      RBUFFER="$QQ_ORIG_RBUFFER"
      return 1
      ;;
  esac
}

# ---------------------------------------------------------------------------
# ZLE widget
# ---------------------------------------------------------------------------
# Registered as the `?` key binding. On the first `?` it simply inserts the
# character. On the second `?` (trailing `?` already in LBUFFER) it triggers
# Que-Que without any KEYTIMEOUT dependency.

qq-question-widget() {
  if [[ "$LBUFFER" == *\? ]]; then
    # Second `?` detected — consume the trigger and launch Que-Que
    _qq_capture_buffers

    # Update the visible line to strip the trigger `?` immediately
    LBUFFER="$QQ_LBUFFER"
    RBUFFER="$QQ_RBUFFER"

    # Create temp files for the request/result exchange
    local req_file result_file
    req_file=$(mktemp /tmp/qq-req-XXXXXX.json)
    result_file=$(mktemp /tmp/qq-res-XXXXXX.json)

    # Build the shell request JSON
    # shellPid is the current shell PID; ttyPath is the controlling TTY
    local tty_path
    tty_path=$(tty 2>/dev/null || echo '/dev/tty')

    cat > "$req_file" <<JSON
{
  "version": 1,
  "ttyPath": "$tty_path",
  "cwd": "$PWD",
  "shellPid": $$,
  "lbuffer": $(printf '%s' "$QQ_LBUFFER" | jq -Rs .),
  "rbuffer": $(printf '%s' "$QQ_RBUFFER" | jq -Rs .)
}
JSON

    # Launch the foreground client reattached to the live TTY.
    # ZLE redirects widget stdin from /dev/null; the explicit redirection
    # ensures the client (and Ink) receive keyboard input.
    qq client --request-file "$req_file" --result-file "$result_file" \
      </dev/tty >/dev/tty 2>&1

    local launch_status=$?

    # Apply the result if the client wrote one; fall back to cancel on error
    if [[ -f "$result_file" ]] && [[ -s "$result_file" ]]; then
      _qq_apply_result "$result_file"
    else
      # No result file or empty — treat as cancel
      LBUFFER="$QQ_ORIG_LBUFFER"
      RBUFFER="$QQ_ORIG_RBUFFER"
    fi

    # Clean up temp files
    rm -f "$req_file" "$result_file"

    # Redraw the line so zsh picks up the mutated LBUFFER/RBUFFER
    zle -R
    return 0
  fi

  # First `?` — insert normally, no delay
  zle .self-insert
}

# Register the widget and bind it in both common keymaps
zle -N qq-question-widget
bindkey -M emacs '?' qq-question-widget
bindkey -M viins '?' qq-question-widget
