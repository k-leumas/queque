#!/usr/bin/env zsh
# qq.zsh — Que-Que ZLE widget and shell-side result contract
#
# Source this file from .zshrc to enable the ?? trigger:
#   source /path/to/shell/zsh/qq.zsh

: "${QQ_DEBUG_LOG_FILE:=}"

# ---------------------------------------------------------------------------
# Cleanup helper — defined at top level so it is not re-defined on each
# trigger and does not clobber global function namespace (IN-002 fix).
# Accepts the session tmpdir as $1 and removes the whole directory.
# ---------------------------------------------------------------------------
_qq_cleanup() {
  local tmpdir="$1"
  rm -rf "$tmpdir"
  trap - EXIT ERR INT
}

typeset -g QQ_DAEMON_PREWARMED="${QQ_DAEMON_PREWARMED:-0}"

_qq_log() {
  if [[ -z "$QQ_DEBUG_LOG_FILE" ]]; then
    return 0
  fi
  local message="$1"
  print -r -- "$(date '+%Y-%m-%dT%H:%M:%S%z') [zsh] $message" >> "$QQ_DEBUG_LOG_FILE" 2>/dev/null
}

_qq_prewarm_daemon() {
  if [[ "$QQ_DAEMON_PREWARMED" == 1 ]]; then
    return 0
  fi

  if [[ -z "$QQ_DEV_ROOT" ]]; then
    return 0
  fi

  local cli_path="$QQ_DEV_ROOT/dist/cli/main.js"
  if [[ ! -f "$cli_path" ]]; then
    return 0
  fi

  if ! command -v node >/dev/null 2>&1; then
    return 0
  fi

  QQ_DAEMON_PREWARMED=1
  (
    command node "$cli_path" daemon --ensure >/dev/null 2>&1
  ) >/dev/null 2>&1 &!
}
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
# Strips the trigger `?` from the buffer state when the second keypress
# arrives, and exports:
#   QQ_ORIG_LBUFFER  — LBUFFER without the trigger `?`
#   QQ_ORIG_RBUFFER  — the exact RBUFFER at trigger time
#   QQ_LBUFFER       — LBUFFER without the trigger `?` (pre-trigger context)
#   QQ_RBUFFER       — RBUFFER unchanged

_qq_capture_buffers() {
  QQ_ORIG_LBUFFER="${LBUFFER%?}"
  QQ_ORIG_RBUFFER="$RBUFFER"
  # Strip the trailing `?` that was inserted by the first keypress.
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
      LBUFFER="$new_lbuffer"
      RBUFFER="$new_rbuffer"
      local query
      query=$(jq -r '.query // empty' "$result_file" 2>/dev/null)
      if [[ -n "$query" ]]; then
        print -P "%F{240}que-que: ${query}%f"
      fi
      return 0
      ;;
    error)
      # Error kind — provider failure; restore original buffers without mutating the shell line (D-11)
      LBUFFER="$QQ_ORIG_LBUFFER"
      RBUFFER="$QQ_ORIG_RBUFFER"
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
# Que-Que using the Zellij floating pane IPC pattern:
#   1. Guard: exits with message if not inside a Zellij session (D-01).
#   2. Creates a named FIFO via mkfifo (D-03) and a request JSON temp file (D-07).
#   3. Backgrounds zellij run --floating --close-on-exit with &! (D-06).
#   4. Blocks on IFS= read -r -t 30 from the FIFO until the client writes (D-05).
#   5. Applies result inline via jq parse from the $result variable (Option B).
#   6. Cleans up both temp files via a self-resetting EXIT/ERR/INT trap (Pitfall 5).

qq-question-widget() {
  # First `?` — insert normally, no delay
  if [[ "$LBUFFER" != *\? ]]; then
    _qq_log "first ? inserted"
    zle .self-insert
    return 0
  fi

  # Second `?` detected — consume trigger and capture buffers
  _qq_log "trigger fired lbuffer=${LBUFFER} rbuffer=${RBUFFER}"
  _qq_capture_buffers
  LBUFFER="$QQ_LBUFFER"
  RBUFFER="$QQ_RBUFFER"

  # Create a private session directory (CR-006 fix).
  # Using mktemp -d + chmod 700 prevents symlink-redirect attacks on temp paths.
  local tmpdir req_file
  tmpdir=$(mktemp -d /tmp/qq-sess.XXXXXX)
  chmod 700 "$tmpdir"
  req_file="$tmpdir/request.json"
  _qq_log "tmpdir=${tmpdir}"

  # Cleanup trap: removes the whole session directory (IN-002 / CR-006 fix).
  trap "_qq_cleanup '$tmpdir'" EXIT ERR INT

  # Build the shell request JSON.
  # Escape every scalar through jq -Rs . to prevent JSON injection from
  # paths or buffer content that contains double-quotes, backslashes, or newlines.
  local tty_json cwd_json
  tty_json=$(printf '%s' "${TTY:-/dev/tty}" | jq -Rs .)
  cwd_json=$(printf '%s' "$PWD"             | jq -Rs .)

  cat > "$req_file" <<JSON
{
  "version": 1,
  "ttyPath": $tty_json,
  "cwd": $cwd_json,
  "shellPid": $$,
  "lbuffer": $(printf '%s' "$QQ_LBUFFER" | jq -Rs .),
  "rbuffer": $(printf '%s' "$QQ_RBUFFER"  | jq -Rs .)
}
JSON

  # Build the qq invocation.
  # qq may be a shell function (dev mode) or an installed binary. zellij run
  # uses exec — it does not start a shell, so shell functions are invisible.
  # Use node + the script path directly when QQ_DEV_ROOT is set; otherwise
  # fall back to a bare qq (assumes a globally-installed binary).
  local -a qq_cmd
  if [[ -n "${QQ_DEV_ROOT:-}" && -f "${QQ_DEV_ROOT}/dist/cli/main.js" ]]; then
    qq_cmd=("node" "${QQ_DEV_ROOT}/dist/cli/main.js")
  else
    qq_cmd=("qq")
  fi
  _qq_log "qq_cmd=${qq_cmd[*]}"

  if [[ -n "$ZELLIJ" ]]; then
    # ---- Zellij path: FIFO + floating pane ----
    local fifo_path="$tmpdir/result.fifo"
    mkfifo "$fifo_path"
    _qq_log "fifo=${fifo_path}"

    # Export FIFO path so uncaughtException/unhandledRejection handlers in main.ts
    # can write a cancel result even if the error escapes the Promise block.
    export QQ_RESULT_FILE="$fifo_path"

    # Launch the floating pane backgrounded+disowned (D-06).
    zellij run --floating --close-on-exit --width 80 --height 24 -- \
      "${qq_cmd[@]}" client --request-file "$req_file" --result-file "$fifo_path" \
      2>>"${QQ_DEBUG_LOG_FILE:-/tmp/qq-${UID}-debug.log}" &!

    # Block on FIFO read with a 30 s timeout (D-05).
    local result='{"kind":"cancel"}'
    IFS= read -r -t 30 result < "$fifo_path" || true
    _qq_log "fifo read complete result=${result}"

  # Apply result inline via jq (RESEARCH.md §Finding 7, Option B).
  local kind new_lbuffer new_rbuffer
    local kind new_lbuffer new_rbuffer
    kind=$(printf '%s' "$result" | jq -r '.kind // empty' 2>/dev/null)
    case "$kind" in
      cancel)
        LBUFFER="$QQ_ORIG_LBUFFER"
        RBUFFER="$QQ_ORIG_RBUFFER"
        ;;
      replace-buffer)
        new_lbuffer=$(printf '%s' "$result" | jq -r '.lbuffer // empty' 2>/dev/null)
        local _jq_lbuf_status=$?
        new_rbuffer=$(printf '%s' "$result" | jq -r '.rbuffer // ""' 2>/dev/null)
        local _jq_rbuf_status=$?
        if [[ $_jq_lbuf_status -ne 0 ]] || [[ $_jq_rbuf_status -ne 0 ]] || [[ -z "$new_lbuffer" ]]; then
          LBUFFER="$QQ_ORIG_LBUFFER"
          RBUFFER="$QQ_ORIG_RBUFFER"
        else
          LBUFFER="$new_lbuffer"
          RBUFFER="$new_rbuffer"
          local inline_query
          inline_query=$(printf '%s' "$result" | jq -r '.query // empty' 2>/dev/null)
          if [[ -n "$inline_query" ]]; then
            print -P "%F{240}que-que: ${inline_query}%f"
          fi
        fi
        ;;
      error)
        LBUFFER="$QQ_ORIG_LBUFFER"
        RBUFFER="$QQ_ORIG_RBUFFER"
        ;;
      *)
        LBUFFER="$QQ_ORIG_LBUFFER"
        RBUFFER="$QQ_ORIG_RBUFFER"
        ;;
    esac

  else
    # ---- Inline path: foreground child writes to a regular temp file ----
    local result_file="$tmpdir/result.json"
    export QQ_RESULT_FILE="$result_file"
    _qq_log "inline mode result_file=${result_file}"

    # Run the client as a foreground child. ZLE yields the terminal so Ink
    # can open /dev/tty and render the selection UI inline.
    "${qq_cmd[@]}" client --request-file "$req_file" --result-file "$result_file" \
      2>>"${QQ_DEBUG_LOG_FILE:-/tmp/qq-${UID}-debug.log}"

    _qq_apply_result "$result_file" || true
  fi

  _qq_cleanup "$tmpdir"
  zle reset-prompt
  zle -R
  return 0
}

# Register the widget and bind it in both common keymaps only in interactive
# shells. Some noninteractive zsh invocations return nonzero for ZLE binding
# commands even though the file is otherwise safe to source.
if [[ -o interactive ]]; then
  zle -N qq-question-widget
  bindkey -M emacs '?' qq-question-widget
  bindkey -M viins '?' qq-question-widget

  # Warm the daemon once per interactive shell so the first `??` pays less
  # startup cost.
  _qq_prewarm_daemon
else
  # When sourced from noninteractive test shells, make the file load path
  # explicitly succeed so helper tests don't inherit ZLE registration status.
  :
fi
