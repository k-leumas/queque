# Spike 004: bash adapter for the literal `??` trigger.
# Mirrors shell/zsh/queque.zsh:336 — first `?` inserts, second fires.
# QQ_SPIKE_LOG receives one JSON-ish line per event so expect can assert on it.

if (( BASH_VERSINFO[0] < 4 )); then
  printf 'queque: bash %s is too old for the ?? trigger (needs 4.0+ for READLINE_LINE)\n' "$BASH_VERSION" >&2
  return 0 2>/dev/null || exit 0
fi

_qq_log() { [[ -n $QQ_SPIKE_LOG ]] && printf '%s\n' "$*" >>"$QQ_SPIKE_LOG"; }

_qq_question() {
  local lbuf=${READLINE_LINE:0:READLINE_POINT}
  local rbuf=${READLINE_LINE:READLINE_POINT}
  if [[ $lbuf != *\? ]]; then
    READLINE_LINE="${lbuf}?${rbuf}"
    READLINE_POINT=$(( READLINE_POINT + 1 ))
    _qq_log "insert point=$READLINE_POINT line=[$READLINE_LINE]"
    return 0
  fi
  QQ_LBUFFER=${lbuf%\?}
  QQ_RBUFFER=$rbuf
  _qq_log "fire lbuffer=[$QQ_LBUFFER] rbuffer=[$QQ_RBUFFER] point=$READLINE_POINT len=${#READLINE_LINE}"
  # Stub result: replace the buffer with a marker command, cursor at end of lbuffer.
  local new_l="echo PICKED:${QQ_LBUFFER}"
  READLINE_LINE="${new_l}${QQ_RBUFFER}"
  READLINE_POINT=${#new_l}
  _qq_log "applied line=[$READLINE_LINE] point=$READLINE_POINT"
}

bind -m emacs     -x '"?": _qq_question'
bind -m vi-insert -x '"?": _qq_question'
