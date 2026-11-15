# Spike 005: full bash adapter — ports qq-question-widget (shell/zsh/queque.zsh:334) to readline.
# Source from an interactive bash ≥5.0 with QQ_DEV_ROOT pointing at the repo.

if (( BASH_VERSINFO[0] < 5 )); then
  printf 'queque: bash %s is too old for the ?? trigger (needs 5.0+)\n' "$BASH_VERSION" >&2
  return 0 2>/dev/null || exit 0
fi

_qq_log() { [[ -n $QQ_SPIKE_LOG ]] && printf '%s %s\n' "$EPOCHREALTIME" "$*" >>"$QQ_SPIKE_LOG"; }

# bash equivalent of _qq_write_tool_handoff: compgen instead of zsh's parameter tables.
_qq_write_tool_handoff() {
  local dir=$1
  [[ ${QQ_TOOL_AWARENESS:-} == 0 ]] && return 0
  hash -r
  # compgen exits 1 on an empty list (no aliases, no public functions), so never chain on it.
  compgen -c | sort -u >"$dir/commands.txt" 2>/dev/null
  compgen -b >"$dir/builtins.txt" 2>/dev/null
  { compgen -A function | grep -v '^_'; compgen -a; } >"$dir/functions.txt" 2>/dev/null
  [[ -s $dir/commands.txt ]] || rm -f -- "$dir/commands.txt" "$dir/builtins.txt" "$dir/functions.txt"
  return 0
}

_qq_apply_result_str() {
  local json=$1 kind new_l new_r msg
  kind=$(jq -r '.kind // empty' <<<"$json" 2>/dev/null) || return 1
  case $kind in
    replace-buffer)
      new_l=$(jq -r '.lbuffer // empty' <<<"$json") new_r=$(jq -r '.rbuffer // ""' <<<"$json")
      if [[ -z $new_l ]]; then _qq_restore; return 1; fi
      [[ -n $QQ_ORIG_LBUFFER ]] && printf '\e[38;5;240mqueque › %s\e[0m\n' "$QQ_ORIG_LBUFFER"
      printf '%s\n' "$new_l$new_r"
      _qq_reprint_prompt_head
      [[ -n $QQ_ORIG_LBUFFER ]] && history -s -- "$QQ_ORIG_LBUFFER"
      READLINE_LINE=$new_l$new_r
      READLINE_POINT=${#new_l}
      ;;
    error)
      msg=$(jq -r '.message // empty' <<<"$json"); [[ -n $msg ]] && printf '%s\n' "$msg"
      _qq_restore ;;
    *) _qq_restore; [[ $kind == cancel ]] ;;
  esac
}

# readline repaints only the last line of a multi-line prompt after bind -x output, so the
# leading lines would be lost under the summary. Print them ourselves (${PS1@P}, bash ≥4.4).
_qq_reprint_prompt_head() {
  local p=${PS1@P}
  [[ $p == *$'\n'* ]] && printf '%s\n' "${p%$'\n'*}"
}

_qq_restore() {
  READLINE_LINE=$QQ_ORIG_LBUFFER$QQ_ORIG_RBUFFER
  READLINE_POINT=${#QQ_ORIG_LBUFFER}
}

_qq_question() {
  local lbuf=${READLINE_LINE:0:READLINE_POINT} rbuf=${READLINE_LINE:READLINE_POINT}
  if [[ $lbuf != *\? ]]; then
    READLINE_LINE=$lbuf?$rbuf
    (( READLINE_POINT++ ))
    return 0
  fi

  QQ_ORIG_LBUFFER=${lbuf%\?} QQ_ORIG_RBUFFER=$rbuf
  _qq_log "fire lbuffer=[$QQ_ORIG_LBUFFER] rbuffer=[$QQ_ORIG_RBUFFER]"

  local -a qq_cmd
  if [[ -n ${QQ_DEV_ROOT:-} && -f $QQ_DEV_ROOT/dist/cli/main.js ]]; then
    qq_cmd=(node "$QQ_DEV_ROOT/dist/cli/main.js")
  else
    local bin; bin=$(type -P qq) || { printf 'queque: qq not found\n'; _qq_restore; return 0; }
    qq_cmd=("$bin")
  fi

  local tmpdir; tmpdir=$(mktemp -d /tmp/qq-sess.XXXXXX) || { _qq_restore; return 0; }
  chmod 700 "$tmpdir"
  local req=$tmpdir/request.json
  jq -n --arg tty "$(tty)" --arg cwd "$PWD" --argjson pid $$ \
        --arg l "$QQ_ORIG_LBUFFER" --arg r "$QQ_ORIG_RBUFFER" \
        '{version:1, ttyPath:$tty, cwd:$cwd, shellPid:$pid, lbuffer:$l, rbuffer:$r}' >"$req"
  local t0=$EPOCHREALTIME
  _qq_write_tool_handoff "$tmpdir"
  _qq_log "handoff ms=$(( (${EPOCHREALTIME/./} - ${t0/./}) / 1000 )) commands=$(wc -l <"$tmpdir/commands.txt" 2>/dev/null)"

  local result='{"kind":"cancel"}'
  if [[ -n ${ZELLIJ:-} ]]; then
    local fifo=$tmpdir/result.fifo; mkfifo "$fifo"
    export QQ_RESULT_FILE=$fifo QQ_PANE_WIDTH=${QQ_PANE_WIDTH:-80} QQ_PANE_HEIGHT=${QQ_PANE_HEIGHT:-24}
    ( zellij run --floating --close-on-exit --width "$QQ_PANE_WIDTH" --height "$QQ_PANE_HEIGHT" --name qq -- \
        "${qq_cmd[@]}" client --request-file "$req" --result-file "$fifo" \
        2>>"${QQ_DEBUG_LOG_FILE:-/tmp/qq-$UID-debug.log}" & disown ) >/dev/null 2>&1
    IFS= read -r -t 30 result <"$fifo" || true
  else
    export QQ_RESULT_FILE=$tmpdir/result.json
    "${qq_cmd[@]}" client --request-file "$req" --result-file "$QQ_RESULT_FILE" ${QQ_SPIKE_RESULT_MODE:+--result-mode "$QQ_SPIKE_RESULT_MODE"} \
      2>>"${QQ_DEBUG_LOG_FILE:-/tmp/qq-$UID-debug.log}"
    _qq_log "client status=$?"
    result=$(<"$QQ_RESULT_FILE") 2>/dev/null || result='{"kind":"cancel"}'
  fi
  _qq_log "result=$result"
  _qq_apply_result_str "$result"
  _qq_log "applied line=[$READLINE_LINE] point=$READLINE_POINT"
  rm -rf -- "$tmpdir"
}

bind -m emacs     -x '"?": _qq_question'
bind -m vi-insert -x '"?": _qq_question'
