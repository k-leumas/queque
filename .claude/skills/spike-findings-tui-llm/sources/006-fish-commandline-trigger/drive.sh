#!/usr/bin/env bash
# drive.sh <case> [vi] — runs one trigger case in fish 4 inside a private tmux server.
set -u
here=$(cd "$(dirname "$0")" && pwd)
F=${QQ_FISH:?set QQ_FISH to the fish binary}
case=$1 mode=${2:-emacs}; T=(tmux -L qqspike)
log=$(mktemp); home=$(mktemp -d)
"${T[@]}" kill-server 2>/dev/null
unset ZELLIJ ZELLIJ_PANE_ID ZELLIJ_SESSION_NAME
"${T[@]}" -f /dev/null new-session -d -x 100 -y 20 -e HOME="$home" -e XDG_CONFIG_HOME="$home/.config" \
  -e QQ_SPIKE_LOG="$log" -e LANG=en_US.UTF-8 "$F --no-config -i"
k() { "${T[@]}" send-keys -t 0 "$@"; }
ty() { local s=$1 i; for ((i=0;i<${#s};i++)); do "${T[@]}" send-keys -t 0 -l -- "${s:i:1}"; sleep 0.04; done; }
sleep 1
k "function fish_prompt; echo -n 'spike> '; end; set -g fish_greeting" Enter; sleep 0.3
[[ $mode == vi ]] && { k "fish_vi_key_bindings" Enter; sleep 0.5; }
k "source $here/spike.fish; clear" Enter; sleep 0.6
case $case in
  basic)   ty "list files??" ;;
  single)  ty "echo x?" ;;
  midline) ty "echo abcd"; k Left Left; sleep 0.1; ty "??" ;;
  cafe)    ty "echo café??" ;;
  emoji)   ty "echo 🚀x??" ;;
  mb_mid)  ty "echo café bar"; k Left Left Left Left; sleep 0.1; ty "??" ;;
  paste)   "${T[@]}" set-buffer "echo pasted??"; "${T[@]}" paste-buffer -p -t 0 ;;
  multiline) ty "echo one"; k M-Enter; sleep 0.1; ty "two??" ;;
esac
sleep 0.5; k Enter; sleep 0.6
"${T[@]}" capture-pane -p -t 0 | grep -v '^$' | sed 's/^/    screen: /'
sed 's/^/    log: /' "$log"
"${T[@]}" kill-server; rm -rf "$log" "$home"
