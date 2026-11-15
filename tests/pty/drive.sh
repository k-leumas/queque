#!/usr/bin/env bash
# tests/pty/drive.sh: drive an interactive zsh or bash in a private tmux server (Phase 11 D-10).
# Generalized from spike 005's drive.sh. bash 3.2-compatible so the macOS host can run it.
#
#   drive.sh start   SERVER SHELL RCDIR   start SHELL (zsh | bash) from $QQ_PTY_SHELL_BIN
#   drive.sh type    SERVER TEXT          type TEXT one character at a time (literal keys)
#   drive.sh key     SERVER KEY...        send tmux key names (Enter, Escape, Left, C-u)
#   drive.sh paste   SERVER TEXT          paste TEXT (bracketed when the shell asked for it)
#   drive.sh wait    SERVER FIXED [SECS]  wait until the screen shows FIXED (default 20 s)
#   drive.sh capture SERVER               print the screen, wrapped lines joined
#   drive.sh stop    SERVER               kill the server (never fails)
#
# The tmux server is private (`-L SERVER -f /dev/null`) and starts without ZELLIJ*, so the
# adapter never opens a floating pane in the developer's Zellij session (cerebrum 2026-11-13),
# and without TMUX. It inherits every other variable of the caller (HOME, QQ_*, LANG, PATH).
# Synchronization is by polling the screen, never by fixed sleeps.
set -u

SESSION=qq

usage() {
  echo "usage: drive.sh start|type|key|paste|wait|capture|stop SERVER ..." >&2
  exit 2
}

[ $# -ge 2 ] || usage
cmd=$1
server=$2
shift 2

t() {
  tmux -u -L "$server" "$@"
}

case $cmd in
  start)
    [ $# -eq 2 ] || usage
    shell=$1
    rcdir=$2
    bin=${QQ_PTY_SHELL_BIN:-}
    if [ -z "$bin" ]; then
      echo "drive.sh: QQ_PTY_SHELL_BIN is not set" >&2
      exit 2
    fi
    case $shell in
      zsh) set -- env "ZDOTDIR=$rcdir" "$bin" -d -i ;;
      bash) set -- "$bin" --noprofile --rcfile "$rcdir/bashrc" -i ;;
      *)
        echo "drive.sh: unknown shell '$shell' (zsh | bash)" >&2
        exit 2
        ;;
    esac
    env -u ZELLIJ -u ZELLIJ_PANE_ID -u ZELLIJ_SESSION_NAME -u TMUX \
      tmux -u -L "$server" -f /dev/null new-session -d -s "$SESSION" -x 100 -y 30 "$@"
    ;;
  type)
    [ $# -eq 1 ] || usage
    text=$1
    i=0
    while [ "$i" -lt "${#text}" ]; do
      t send-keys -t "$SESSION" -l -- "${text:$i:1}" || exit 1
      i=$((i + 1))
    done
    ;;
  key)
    [ $# -ge 1 ] || usage
    t send-keys -t "$SESSION" "$@"
    ;;
  paste)
    [ $# -eq 1 ] || usage
    t set-buffer -- "$1" && t paste-buffer -p -t "$SESSION"
    ;;
  wait)
    [ $# -ge 1 ] || usage
    fixed=$1
    seconds=${2:-20}
    tries=$((seconds * 20))
    while [ "$tries" -gt 0 ]; do
      if t capture-pane -p -J -t "$SESSION" 2>/dev/null | grep -F -q -- "$fixed"; then
        exit 0
      fi
      sleep 0.05
      tries=$((tries - 1))
    done
    echo "drive.sh: timed out after ${seconds} s waiting for: $fixed" >&2
    echo "----- last screen" >&2
    t capture-pane -p -J -t "$SESSION" >&2 2>/dev/null
    exit 1
    ;;
  capture)
    t capture-pane -p -J -t "$SESSION"
    ;;
  stop)
    t kill-server >/dev/null 2>&1
    exit 0
    ;;
  *)
    usage
    ;;
esac
