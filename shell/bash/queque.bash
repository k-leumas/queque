# shellcheck shell=bash
# QueQue bash adapter: the literal `??` trigger for bash 5.0 or newer (readline `bind -x`).
#
# `qq init bash` adds a line to ~/.bashrc that sources this file. It binds `?` in the emacs and
# vi-insert keymaps. The first `?` inserts a literal `?` at the cursor at once; a second `?`
# right after it consumes the trigger, writes the line state to request.json in a private
# session dir and runs the unchanged `qq client`, which opens /dev/tty itself:
#
#   reads   READLINE_LINE / READLINE_POINT (split at the cursor into lbuffer / rbuffer)
#   writes  <session>/request.json  {version, ttyPath, cwd, shellPid, lbuffer, rbuffer,
#                                    shell:"bash", shellVersion}
#   reads   <session>/result.json   cancel | replace-buffer | error
#   writes  READLINE_LINE / READLINE_POINT only; nothing runs until the user presses Enter.
#
# This file mirrors shell/zsh/queque.zsh (the reference adapter): the instant frame (plan
# 11-06), then the installed-tool handoff, the daemon prewarm and the Zellij floating pane
# (plan 11-07). Where bash differs (a detached tool scan with a `tools.pending` marker), the
# section comment says why.

# Non-interactive shells (scp, rsync, `bash -c`) read ~/.bashrc too: print nothing, change nothing.
[[ $- == *i* ]] || return 0 2>/dev/null || exit 0

# Only bash 3.2-parseable syntax above this point: macOS /bin/bash must reach the refusal.
if (( BASH_VERSINFO[0] < 5 )); then
  printf 'queque: the ?? trigger needs bash 5.0+ (found %s)\n' "$BASH_VERSION" >&2
  # shellcheck disable=SC2317 # reached when the file is run instead of sourced
  return 0 2>/dev/null || exit 0
fi

# The accepted line is `cmd  # explanation`: without this the `#` part becomes arguments
# (mirrors zsh `setopt interactivecomments`). The only option this file changes at source time.
shopt -s interactive_comments

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
# Every external tool is called through `command`: bash expands aliases when a function is
# defined, and the source line sits after the user's aliases (`alias rm='rm -i'`).

_qq_log() {
  [[ -n ${QQ_DEBUG_LOG_FILE:-} ]] || return 0
  printf '%s [bash] %s\n' "$(command date '+%Y-%m-%dT%H:%M:%S%z')" "$1" \
    >>"$QQ_DEBUG_LOG_FILE" 2>/dev/null
  return 0
}

# _qq_cleanup dir  the adapter's half of the two-flag cleanup (D-05). The detached tool writer
# may still be scanning, so the adapter writes `closed` and removes the dir only once the
# writer's `tools.pending` marker is gone; otherwise the writer removes it when it sees
# `closed`. Each side sets its own flag before it checks the other's, so whichever finishes
# last removes the dir, and a second `rm -rf` is harmless. Every exit of `_qq_question` after
# the session dir exists goes through here.
_qq_cleanup() {
  local dir=${1:-}
  [[ -n $dir && -d $dir ]] || return 0
  { : >"$dir/closed"; } 2>/dev/null
  if [[ ! -e $dir/tools.pending ]]; then
    command rm -rf -- "$dir" 2>/dev/null
  fi
  return 0
}

# Readline repaints only the last line of a multi-line prompt after a `bind -x` function
# printed something, so the leading lines would vanish under the summary. Print them here.
_qq_reprint_prompt_head() {
  local p=${PS1@P}
  # Drop the \[ \] markers (\001 \002) that only readline understands.
  p=${p//$'\001'/}
  p=${p//$'\002'/}
  if [[ $p == *$'\n'* ]]; then
    printf '%s\n' "${p%$'\n'*}"
  fi
  return 0
}

# Restore the line exactly as it was before the trigger, cursor included. zsh gets the cursor
# back by restoring LBUFFER and RBUFFER separately; bash needs the explicit point.
_qq_restore_line() {
  READLINE_LINE="${QQ_ORIG_LBUFFER:-}${QQ_ORIG_RBUFFER:-}"
  READLINE_POINT=${QQ_ORIG_POINT:-0}
}

# ---------------------------------------------------------------------------
# Instant first frame (D-04; quick 261011-jbh, LD-1)
# ---------------------------------------------------------------------------
# The moment `??` fires, the adapter paints the `queque › <lbuffer>` header and a `thinking…`
# row into the modal surface, before Node starts:
#   inline  `_qq_paint_inline_instant_frame` prints the scroll reserve, a fresh cursor save, an
#           erase, the frame and a restore, so the cursor ends on the reserve top. The reserve is
#           byte-identical to the client's inlineScrollReserve, so the client's own reserve
#           moves nothing; the client clears the frame in its first visible write.
#   Zellij  `_qq_write_pane_instant_frame` writes the frame to `instant-frame.txt` in the 0700
#           session dir, and the pane wrapper (`QQ_PANE_PAINT_SCRIPT`) cats it before it execs
#           the unchanged client argv. The lbuffer never reaches the zellij or sh argv.
# The rows mirror Ink's loading frame: the header (only for a non-empty lbuffer), the FILTER
# row and the content margin (blank here), then the loading text. Control characters are
# stripped from the lbuffer before it reaches the terminal.
#
# The reference is src/shared/instant-frame-spec.ts. tests/instant-frame-parity.test.ts runs
# these functions and shell/zsh/queque.zsh against it byte for byte over a fixture table, so a
# change here needs the same change there. Builtins and parameter expansion only (no fork),
# every function returns 0, and QQ_INSTANT_FRAME=0 paints nothing.
# Plain globals, not readonly: the file is re-sourced in dev.
QQ_MODAL_VIEWPORT_LINES=18                 # mirrors INSTANT_FRAME_VIEWPORT_LINES (spec)
QQ_MODAL_MAX_COLUMNS=80                    # mirrors MODAL_MAX_COLUMNS (spec, CandidateSelect)
QQ_MODAL_PADDING_COLUMNS=1                 # mirrors the Modal paddingX on each side
QQ_ZELLIJ_FRAME_COLUMNS=2                  # mirrors the floating pane border columns
QQ_INSTANT_FRAME_ROWS_ABOVE_LOADING=2      # mirrors the FILTER row + the content marginTop
QQ_INSTANT_FRAME_LOADING_TEXT='thinking…'  # mirrors INSTANT_FRAME_LOADING_TEXT (spec)
QQ_INSTANT_FRAME_FILE='instant-frame.txt'  # mirrors INSTANT_FRAME_SPEC.frameFile
# shellcheck disable=SC2016 # the Zellij pane wrapper; /bin/sh expands it there
QQ_PANE_PAINT_SCRIPT='cat "$1" 2>/dev/null; shift; exec "$@"'
QQ_INSTANT_FRAME_PAINTED=${QQ_INSTANT_FRAME_PAINTED:-0}

# _qq_instant_frame lbuffer columns  sets REPLY to the frame rows joined by CR LF (empty with
# QQ_INSTANT_FRAME=0). Columns that are not all digits, 0 or above the max mean the max.
_qq_instant_frame() {
  REPLY=''
  if [[ ${QQ_INSTANT_FRAME:-} == 0 ]]; then
    return 0
  fi
  # Outside a UTF-8 locale (glibc images default to C) bash counts and slices bytes: the header
  # would come out short (› and … are 3 bytes) and a typed multibyte character could be cut in
  # half. Count characters in a UTF-8 locale for this function only (`local` restores it on
  # return). If none exists the assignment changes nothing; its warning goes to /dev/null.
  # `local` is a builtin, so its redirect covers it. A bare assignment ignores its own
  # redirect, so the second one sits in a `{ }` group (WR-01).
  local probe='›'
  if (( ${#probe} != 1 )); then
    local LC_ALL=C.UTF-8 2>/dev/null
    if (( ${#probe} != 1 )); then
      { LC_ALL=en_US.UTF-8; } 2>/dev/null
    fi
  fi
  local lbuffer=${1//[[:cntrl:]]/}
  local columns=${2:-}
  if [[ $columns =~ ^0*([1-9][0-9]{0,2})$ ]] && (( BASH_REMATCH[1] <= QQ_MODAL_MAX_COLUMNS )); then
    columns=${BASH_REMATCH[1]}
  else
    columns=$QQ_MODAL_MAX_COLUMNS
  fi
  local width=$(( columns - 2 * QQ_MODAL_PADDING_COLUMNS ))
  if (( width < 1 )); then
    width=1
  fi
  local pad dim=$'\e[2m' undim=$'\e[22m' crlf=$'\r\n' frame='' text i
  printf -v pad '%*s' "$QQ_MODAL_PADDING_COLUMNS" ''
  if [[ -n ${1:-} ]]; then
    text="queque › ${lbuffer}"
    if (( ${#text} > width )); then
      text="${text:0:width-1}…"
    fi
    frame="${pad}${dim}${text}${undim}${crlf}"
  fi
  for (( i = 0; i < QQ_INSTANT_FRAME_ROWS_ABOVE_LOADING; i++ )); do
    frame+=$crlf
  done
  REPLY="${frame}${pad}${dim}${QQ_INSTANT_FRAME_LOADING_TEXT}${undim}"
  return 0
}

# _qq_inline_instant_frame_bytes lbuffer columns  sets REPLY to the inline paint: the reserve
# (newlines, CSI <n> A, CR, ESC 7) + CSI J + the frame + ESC 8. Empty when the frame is empty.
_qq_inline_instant_frame_bytes() {
  _qq_instant_frame "${1:-}" "${2:-}"
  if [[ -z $REPLY ]]; then
    return 0
  fi
  local frame=$REPLY newlines
  printf -v newlines '%*s' "$QQ_MODAL_VIEWPORT_LINES" ''
  # bash 5.2 turns `patsub_replacement` on by default: an unquoted `&` in the replacement part
  # of ${var//pattern/replacement} stands for the matched text. Keep this replacement free of
  # `&`, or the reserve stops being QQ_MODAL_VIEWPORT_LINES newlines.
  newlines=${newlines// /$'\n'}
  REPLY="${newlines}"$'\e['"${QQ_MODAL_VIEWPORT_LINES}A"$'\r\e7\e[J'"${frame}"$'\e8'
  return 0
}

# _qq_paint_inline_instant_frame lbuffer  prints the inline paint in one write when stdout is a
# terminal. QQ_INSTANT_FRAME_PAINTED=1 only when that write succeeded.
_qq_paint_inline_instant_frame() {
  QQ_INSTANT_FRAME_PAINTED=0
  if [[ ! -t 1 ]]; then
    return 0
  fi
  _qq_inline_instant_frame_bytes "${1:-}" "${COLUMNS:-}"
  if [[ -z $REPLY ]]; then
    return 0
  fi
  if printf '%s' "$REPLY" 2>/dev/null; then
    QQ_INSTANT_FRAME_PAINTED=1
  fi
  return 0
}

# _qq_clear_instant_frame  erases a frame this adapter painted when the client will not (it
# was never started, or it exited non-zero): back to the paint's own save, erase below.
_qq_clear_instant_frame() {
  if [[ $QQ_INSTANT_FRAME_PAINTED == 1 ]]; then
    printf '\e8\e[J' 2>/dev/null
    _qq_log "instant frame cleared"
  fi
  QQ_INSTANT_FRAME_PAINTED=0
  return 0
}

# _qq_write_pane_instant_frame dir lbuffer pane_columns  writes the frame + CSI H to
# dir/instant-frame.txt for the Zellij pane wrapper. A failed write removes the file, so a
# failure means "no file" and the pane launches as before.
_qq_write_pane_instant_frame() {
  local dir=${1:-}
  if [[ -z $dir || ! -d $dir ]]; then
    return 0
  fi
  _qq_instant_frame "${2:-}" "${3:-}"
  if [[ -z $REPLY ]]; then
    return 0
  fi
  if ! { printf '%s' "${REPLY}"$'\e[H' >"$dir/$QQ_INSTANT_FRAME_FILE"; } 2>/dev/null; then
    command rm -f -- "$dir/$QQ_INSTANT_FRAME_FILE" 2>/dev/null
  fi
  return 0
}

# ---------------------------------------------------------------------------
# Installed-tool handoff (D-05; zsh `_qq_write_tool_handoff`, spike 005)
# ---------------------------------------------------------------------------
# Writes the names bash can resolve into the session dir, next to request.json, so the client
# can flag candidates that use missing tools and steer the prompt to installed ones:
#   commands.txt   `compgen -c` (every command name bash resolves, PATH included)
#   builtins.txt   `compgen -b` (never flagged)
#   functions.txt  functions without a leading `_`, plus alias names (one file, 09 D-01)
# The scan costs about 85 ms in bash (8.8 ms in zsh), so it runs in a detached writer
# alongside client startup. `tools.pending` is the contract with src/client/tool-handoff.ts:
# the adapter creates it before the writer starts, the writer removes it last, and the client
# waits up to 500 ms while it exists. The names stay unordered: the client puts them in a Set.
# Never chain on compgen's exit status: `compgen -a` with no aliases and the public-function
# filter with only `_` functions both exit 1. Only an empty commands.txt removes the three files
# (failure means "no files", so the client shows no flags). Kill switch: QQ_TOOL_AWARENESS=0.

# _qq_write_tool_handoff dir  the scan itself (synchronous; tests call it directly).
_qq_write_tool_handoff() {
  local dir=${1:-}
  if [[ ${QQ_TOOL_AWARENESS:-} == 0 || -z $dir || ! -d $dir ]]; then
    return 0
  fi
  # Kept per D-05. It runs in the detached writer, where it only resets that subshell's
  # table; compgen scans PATH itself, which is what lists a tool installed after the shell
  # started (bash-widget b12 proves that, not this line).
  hash -r 2>/dev/null
  { compgen -c >"$dir/commands.txt"; } 2>/dev/null
  { compgen -b >"$dir/builtins.txt"; } 2>/dev/null
  { compgen -A function | command grep -v '^_'; compgen -a; } >"$dir/functions.txt" 2>/dev/null
  if [[ ! -s $dir/commands.txt ]]; then
    command rm -f -- "$dir/commands.txt" "$dir/builtins.txt" "$dir/functions.txt" 2>/dev/null
  fi
  return 0
}

# _qq_start_tool_handoff dir  creates tools.pending, then starts the writer detached and
# returns at once. Only the `( … & )` subshell form is silent inside a `bind -x` function: a
# bare `&`, `& disown`, `set +m` or `wait` print `[1] PID` / `Done` into the user's terminal.
# The writer's own half of the two-flag cleanup: remove the marker, then remove the dir if the
# adapter already wrote `closed`.
_qq_start_tool_handoff() {
  local dir=${1:-}
  if [[ ${QQ_TOOL_AWARENESS:-} == 0 || -z $dir || ! -d $dir ]]; then
    return 0
  fi
  if ! { : >"$dir/tools.pending"; } 2>/dev/null; then
    return 0
  fi
  ( {
      _qq_write_tool_handoff "$dir"
      command rm -f -- "$dir/tools.pending"
      if [[ -e $dir/closed ]]; then
        command rm -rf -- "$dir"
      fi
    } </dev/null >/dev/null 2>&1 & )
  return 0
}

# ---------------------------------------------------------------------------
# Daemon prewarm (zsh `_qq_prewarm_daemon`)
# ---------------------------------------------------------------------------
# Sourcing the adapter starts `qq daemon --ensure` once per shell in the background, so the
# first `??` pays less startup cost. QQ_DAEMON_PREWARMED=1 (set here, or by a harness before
# sourcing) skips it; a second source in the same shell keeps the 1.
QQ_DAEMON_PREWARMED=${QQ_DAEMON_PREWARMED:-0}

_qq_prewarm_daemon() {
  if [[ $QQ_DAEMON_PREWARMED == 1 ]]; then
    return 0
  fi
  QQ_DAEMON_PREWARMED=1
  ( {
      local qq_bin
      if [[ -n ${QQ_DEV_ROOT:-} && -f ${QQ_DEV_ROOT}/dist/cli/main.js ]] \
        && type -P node >/dev/null 2>&1; then
        command node "${QQ_DEV_ROOT}/dist/cli/main.js" daemon --ensure
      elif qq_bin=$(type -P qq 2>/dev/null) && [[ -n $qq_bin ]]; then
        command "$qq_bin" daemon --ensure
      fi
    } </dev/null >/dev/null 2>&1 & )
  return 0
}

# ---------------------------------------------------------------------------
# Zellij floating pane (D-07)
# ---------------------------------------------------------------------------
# With $ZELLIJ set, `_qq_question` runs the unchanged client in a floating pane and reads its
# one newline-terminated result line from a FIFO in the session dir. The FIFO read gives up
# after QQ_RESULT_READ_TIMEOUT_S (zsh reads for 30 s too; the client's IPC wait is 26 s), so a
# dead pane can never hang the shell. A launcher that exits non-zero writes the sentinel line
# into the FIFO, which wakes the read at once. `zellij` is called without `command` (as in zsh)
# so tests can fake it with a shell function.
QQ_RESULT_READ_TIMEOUT_S=30
QQ_ZELLIJ_LAUNCH_SENTINEL='QQ_LAUNCH_FAILED'

# ---------------------------------------------------------------------------
# Result application
# ---------------------------------------------------------------------------
# _qq_apply_result_str JSON  applies a result to READLINE_LINE / READLINE_POINT.
# _qq_apply_result FILE      reads a result file and delegates to the above.
#
#   {"kind":"cancel"}                                   restore, return 0
#   {"kind":"replace-buffer","lbuffer":…,"rbuffer":…}   summary, history, new line, return 0
#   {"kind":"error","message":…}                        print message, restore, return 0
#   anything else, unparsable JSON, empty lbuffer       restore, return 1

_qq_apply_result_str() {
  local json=${1:-} kind new_l new_r message
  kind=$(printf '%s' "$json" | command jq -r '.kind // empty' 2>/dev/null) || kind=''

  case $kind in
    cancel)
      _qq_restore_line
      return 0
      ;;
    replace-buffer)
      if ! new_l=$(printf '%s' "$json" | command jq -r '.lbuffer // empty' 2>/dev/null) \
        || ! new_r=$(printf '%s' "$json" | command jq -r '.rbuffer // ""' 2>/dev/null) \
        || [[ -z $new_l ]]; then
        _qq_restore_line
        return 1
      fi
      # Two summary lines above the prompt: the query (dim) and the command. Both go through
      # %s, never into the format string.
      if [[ -n ${QQ_ORIG_LBUFFER:-} ]]; then
        printf '\e[38;5;240mqueque › %s\e[39m\n' "$QQ_ORIG_LBUFFER"
      fi
      printf '%s\n' "${new_l}${new_r}"
      # D-13: the natural-language query goes into history; the command only once it is run.
      if [[ -n ${QQ_ORIG_LBUFFER:-} ]]; then
        history -s -- "$QQ_ORIG_LBUFFER"
      fi
      _qq_reprint_prompt_head
      # Insertion only: the command is placed in the line, the user decides to press Enter.
      READLINE_LINE="${new_l}${new_r}"
      READLINE_POINT=${#new_l}
      return 0
      ;;
    error)
      message=$(printf '%s' "$json" | command jq -r '.message // empty' 2>/dev/null) || message=''
      if [[ -n $message ]]; then
        printf '%s\n' "$message"
      fi
      _qq_restore_line
      return 0
      ;;
    *)
      _qq_restore_line
      return 1
      ;;
  esac
}

_qq_apply_result() {
  local file=${1:-} json
  if [[ -z $file || ! -r $file ]]; then
    _qq_restore_line
    return 1
  fi
  json=$(<"$file") || json=''
  _qq_apply_result_str "$json"
}

# ---------------------------------------------------------------------------
# The `?` binding
# ---------------------------------------------------------------------------

_qq_question() {
  # A user's `set -e` (or -u, -E, pipefail) must not kill the shell or leak out of here:
  # `local -` restores the options when the function returns.
  local -
  set +euE +o pipefail

  local lbuf=${READLINE_LINE:0:READLINE_POINT} rbuf=${READLINE_LINE:READLINE_POINT}

  # First `?`: insert it at the cursor, no delay. READLINE_POINT counts characters (5.0+).
  if [[ $lbuf != *\? ]]; then
    READLINE_LINE="${lbuf}?${rbuf}"
    READLINE_POINT=$(( READLINE_POINT + 1 ))
    return 0
  fi

  # Second `?`: consume the trigger and remember the line and the cursor before the first `?`.
  QQ_ORIG_LBUFFER=${lbuf%\?}
  QQ_ORIG_RBUFFER=$rbuf
  QQ_ORIG_POINT=$(( READLINE_POINT - 1 ))
  READLINE_LINE="${QQ_ORIG_LBUFFER}${QQ_ORIG_RBUFFER}"
  READLINE_POINT=$QQ_ORIG_POINT
  QQ_INSTANT_FRAME_PAINTED=0
  _qq_log "trigger fired lbuffer=${QQ_ORIG_LBUFFER} rbuffer=${QQ_ORIG_RBUFFER}"

  # The client: the dev bundle when QQ_DEV_ROOT points at a built checkout, else qq on PATH
  # (type -P searches PATH only, so a dev `qq` function cannot shadow the installed binary).
  local -a qq_cmd
  if [[ -n ${QQ_DEV_ROOT:-} && -f ${QQ_DEV_ROOT}/dist/cli/main.js ]]; then
    qq_cmd=(node "${QQ_DEV_ROOT}/dist/cli/main.js")
  else
    local qq_bin
    qq_bin=$(type -P qq 2>/dev/null) || qq_bin=''
    if [[ -z $qq_bin ]]; then
      _qq_log "qq not found"
      printf '%s\n' 'queque: qq not found — run: qq init bash && source ~/.bashrc' >&2
      return 0
    fi
    qq_cmd=("$qq_bin")
  fi
  _qq_log "qq_cmd=${qq_cmd[*]}"

  # jq writes request.json and reads the result. Without it the request write fails after the
  # paint, so check first and say why (WR-02). type -P, like `command jq`, ignores functions.
  if ! type -P jq >/dev/null 2>&1; then
    _qq_log "jq not found"
    printf '%s\n' 'queque: jq not found — install jq (see: qq doctor)' >&2
    return 0
  fi

  # Instant first frame (D-04): paint the header and the loading row now, before mktemp, jq
  # and Node, so the modal shows something at once (zsh paints at the same point). The Zellij
  # pane gets its frame through a file instead. QQ_ORIG_LBUFFER is this adapter's name for the
  # value zsh paints as QQ_LBUFFER.
  if [[ -z ${ZELLIJ:-} ]]; then
    _qq_paint_inline_instant_frame "$QQ_ORIG_LBUFFER"
    _qq_log "instant frame painted=${QQ_INSTANT_FRAME_PAINTED}"
  fi

  # A private session dir. Phase 10 Defect 3: an empty mktemp result (full or unwritable /tmp)
  # must stop before any write, or every path below would land at the filesystem root.
  local tmpdir
  tmpdir=$(command mktemp -d /tmp/qq-sess.XXXXXX 2>/dev/null) || tmpdir=''
  if [[ -z $tmpdir || ! -d $tmpdir ]]; then
    _qq_clear_instant_frame
    _qq_log "mktemp -d failed; session dir not created"
    printf '%s\n' 'queque: cannot create a temp dir in /tmp' >&2
    return 0
  fi
  command chmod 700 "$tmpdir"
  _qq_log "tmpdir=${tmpdir}"

  # request.json through jq --arg only, never string-built JSON. ttyPath is /dev/tty (no
  # `tty` fork): the client opens the controlling terminal itself.
  local req_file=$tmpdir/request.json
  if ! command jq -n \
    --arg tty /dev/tty --arg cwd "$PWD" --argjson pid "$$" \
    --arg l "$QQ_ORIG_LBUFFER" --arg r "$QQ_ORIG_RBUFFER" --arg v "$BASH_VERSION" \
    '{version:1, ttyPath:$tty, cwd:$cwd, shellPid:$pid, lbuffer:$l, rbuffer:$r, shell:"bash", shellVersion:$v}' \
    >"$req_file" 2>/dev/null; then
    _qq_clear_instant_frame
    _qq_log "request.json could not be written"
    _qq_cleanup "$tmpdir"
    return 0
  fi

  # The tool scan runs alongside client startup (D-05); the client waits on tools.pending.
  _qq_start_tool_handoff "$tmpdir"
  _qq_log "tool handoff started"

  local qq_log_file=${QQ_DEBUG_LOG_FILE:-/tmp/qq-${UID}-debug.log}

  if [[ -n ${ZELLIJ:-} ]]; then
    # ---- Zellij path (D-07): the client in a floating pane, the result through a FIFO ----
    # No inline frame was painted on this path, so the setup failures below have nothing to
    # clear; the pane frame file goes with the session dir.
    local fifo=$tmpdir/result.fifo
    if ! command mkfifo "$fifo" 2>/dev/null; then
      _qq_log 'mkfifo failed'
      _qq_restore_line
      _qq_cleanup "$tmpdir"
      return 0
    fi
    _qq_log "fifo=${fifo}"

    # Read-write, opened before the pane starts: a plain `<"$fifo"` blocks in open() until a
    # writer appears, so a pane that never starts would never let the read timeout begin.
    # Holding the read end before the launch also keeps the sentinel from a launcher that
    # fails at once (FIFO data is dropped when no end is open). The client writes one
    # newline-terminated line, so `read` returns as soon as it lands.
    local qq_fifo_fd
    if ! { exec {qq_fifo_fd}<>"$fifo"; } 2>/dev/null; then
      _qq_log 'fifo open failed'
      _qq_restore_line
      _qq_cleanup "$tmpdir"
      return 0
    fi

    # The uncaughtException/unhandledRejection handlers in main.ts write a cancel result to
    # QQ_RESULT_FILE even when an error escapes the client.
    export QQ_RESULT_FILE=$fifo

    # Pane size: QQ_PANE_WIDTH / QQ_PANE_HEIGHT, default 80x24 (exported for the client).
    local qq_pane_width=${QQ_PANE_WIDTH:-80} qq_pane_height=${QQ_PANE_HEIGHT:-24}
    export QQ_PANE_WIDTH=$qq_pane_width QQ_PANE_HEIGHT=$qq_pane_height

    # Instant first frame (D-04): written to a file in the 0700 session dir; the pane wrapper
    # cats it, then execs the unchanged client argv. A width that is not all digits (e.g. a
    # percentage) falls back to the modal width.
    local qq_frame_columns=0
    if [[ $qq_pane_width =~ ^[0-9]+$ ]]; then
      qq_frame_columns=$(( 10#$qq_pane_width - QQ_ZELLIJ_FRAME_COLUMNS ))
    fi
    _qq_write_pane_instant_frame "$tmpdir" "$QQ_ORIG_LBUFFER" "$qq_frame_columns"
    local -a pane_cmd
    if [[ -s $tmpdir/$QQ_INSTANT_FRAME_FILE ]]; then
      pane_cmd=(/bin/sh -c "$QQ_PANE_PAINT_SCRIPT" queque-instant-frame
        "$tmpdir/$QQ_INSTANT_FRAME_FILE" "${qq_cmd[@]}")
    else
      pane_cmd=("${qq_cmd[@]}")
    fi
    _qq_log "pane instant frame=${#pane_cmd[@]}"

    # Launch detached and silent (the `( … & )` form). The launcher's copy of the read end is
    # closed; `1<>` opens the FIFO without blocking, so the sentinel write never hangs.
    ( {
        exec {qq_fifo_fd}<&-
        if ! zellij run --floating --close-on-exit --width "$qq_pane_width" --height "$qq_pane_height" \
          --name qq -- "${pane_cmd[@]}" client --request-file "$req_file" --result-file "$fifo" \
          2>>"$qq_log_file"; then
          { printf '%s\n' "$QQ_ZELLIJ_LAUNCH_SENTINEL" 1<>"$fifo"; } 2>/dev/null
        fi
      } </dev/null >/dev/null 2>&1 & )

    local result=''
    if ! IFS= read -r -t "$QQ_RESULT_READ_TIMEOUT_S" -u "$qq_fifo_fd" result; then
      _qq_log "fifo read timed out"
      result='{"kind":"cancel"}'
    fi
    exec {qq_fifo_fd}<&-
    _qq_log "fifo read complete"

    if [[ $result == "$QQ_ZELLIJ_LAUNCH_SENTINEL" ]]; then
      _qq_log 'zellij run failed'
      _qq_restore_line
      _qq_cleanup "$tmpdir"
      return 0
    fi
    _qq_apply_result_str "$result" || _qq_log "result not applied; line restored"
  else
    # ---- Inline path: the client runs as a foreground child and writes a result file ----
    local result_file=$tmpdir/result.json
    export QQ_RESULT_FILE=$result_file
    local qq_client_status=0
    command "${qq_cmd[@]}" client --request-file "$req_file" --result-file "$result_file" \
      2>>"$qq_log_file" || qq_client_status=$?
    _qq_log "client status=${qq_client_status}"

    # A client that crashed (before or after Ink) cannot clear the instant frame. One that
    # exited 0 already cleared it in its first visible write.
    if (( qq_client_status != 0 )); then
      _qq_clear_instant_frame
    fi

    # A missing or malformed result keeps the original line and cursor.
    _qq_apply_result "$result_file" || _qq_log "result not applied; line restored"
  fi

  _qq_cleanup "$tmpdir"
  return 0
}

# Never `vi-command` (`?` searches history there) and never the two-key `??` sequence (a lone
# `?` would then wait for keyseq-timeout before it appears).
bind -m emacs -x '"?": _qq_question'
bind -m vi-insert -x '"?": _qq_question'

# Warm the daemon once per interactive shell (non-interactive shells returned at the top).
_qq_prewarm_daemon
