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
# This file mirrors shell/zsh/queque.zsh (the reference adapter). Later sections (the instant
# frame, the tool handoff, the Zellij floating pane and the daemon prewarm) are added in the
# same order as there.

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

_qq_cleanup() {
  [[ -n ${1:-} && -d $1 ]] || return 0
  command rm -rf -- "$1" 2>/dev/null
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

  # A private session dir. Phase 10 Defect 3: an empty mktemp result (full or unwritable /tmp)
  # must stop before any write, or every path below would land at the filesystem root.
  local tmpdir
  tmpdir=$(command mktemp -d /tmp/qq-sess.XXXXXX 2>/dev/null) || tmpdir=''
  if [[ -z $tmpdir || ! -d $tmpdir ]]; then
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
    _qq_log "request.json could not be written"
    _qq_cleanup "$tmpdir"
    return 0
  fi

  # Inline path: the client runs as a foreground child and writes a regular result file.
  local result_file=$tmpdir/result.json
  export QQ_RESULT_FILE=$result_file
  local qq_client_status=0
  command "${qq_cmd[@]}" client --request-file "$req_file" --result-file "$result_file" \
    2>>"${QQ_DEBUG_LOG_FILE:-/tmp/qq-${UID}-debug.log}" || qq_client_status=$?
  _qq_log "client status=${qq_client_status}"

  # A missing or malformed result keeps the original line and cursor.
  _qq_apply_result "$result_file" || _qq_log "result not applied; line restored"
  _qq_cleanup "$tmpdir"
  return 0
}

# Never `vi-command` (`?` searches history there) and never the two-key `??` sequence (a lone
# `?` would then wait for keyseq-timeout before it appears).
bind -m emacs -x '"?": _qq_question'
bind -m vi-insert -x '"?": _qq_question'
