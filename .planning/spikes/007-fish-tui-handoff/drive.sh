#!/usr/bin/env bash
# drive.sh <fish-binary> <scenario> — runs a scenario in a private tmux server and prints screen
# snapshots. Scenarios: fixture | llm-pick | llm-esc | prompt-multiline
set -u
here=$(cd "$(dirname "$0")" && pwd); root=$(cd "$here/../../.." && pwd)
sh=$1 scen=$2; T="tmux -L qqspike"
log=$(mktemp); export QQ_SPIKE_LOG=$log
$T kill-server 2>/dev/null
# The harness may itself run inside Zellij; the inline path must not inherit it.
unset ZELLIJ ZELLIJ_PANE_ID ZELLIJ_SESSION_NAME
home=$(mktemp -d)
$T -f /dev/null new-session -d -x 100 -y 30 -e HOME="$home" -e XDG_CONFIG_HOME="$home/.config" -e QQ_SPIKE_LOG="$log" -e QQ_DEV_ROOT="$root" -e LANG=en_US.UTF-8 "$sh --no-config -i"
snap() { echo "----- [$1]"; $T capture-pane -p -t 0 | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}'; }
keys() { $T send-keys -t 0 "$@"; }
type_slow() { local s=$1 i; for ((i=0;i<${#s};i++)); do $T send-keys -t 0 -l -- "${s:i:1}"; sleep 0.03; done; }
wait_for() { local pat=$1 n=${2:-60}; while ((n--)); do $T capture-pane -p -t 0 | grep -q -- "$pat" && return 0; sleep 0.25; done; return 1; }
sleep 1
keys "set -g fish_greeting" Enter
case $scen in
  prompt-multiline) keys "function fish_prompt; echo (prompt_pwd); echo -n '> '; end" Enter ;;
  *) keys "function fish_prompt; echo -n 'spike> '; end" Enter ;;
esac
sleep 0.3; keys "source $here/queque.fish; clear" Enter; sleep 0.6
case $scen in
  fixture)
    keys "set -gx QQ_SPIKE_RESULT_MODE replace-buffer-fixture" Enter; keys clear Enter; sleep 0.3
    type_slow "echo fixture-roundtrip??"; sleep 8; snap after-trigger
    keys Enter; sleep 0.5; snap after-enter ;;
  llm-pick|prompt-multiline)
    type_slow "list files by size??"; wait_for "›" 4; snap picker-open
    wait_for "┌>" 120 && sleep 1; snap candidates
    keys Down; sleep 0.3; snap after-down; keys Enter; sleep 1.5
    if $T capture-pane -p -t 0 | grep -q 'usage and error counts'; then keys n Enter; sleep 1; fi
    snap after-pick ;;
  llm-esc)
    type_slow "echo keep this mid??"; sleep 0.3; wait_for "┌>" 120; sleep 1; snap candidates
    keys Escape; sleep 1.5; snap after-esc
    keys End; type_slow " tail"; sleep 0.3; snap after-typing ;;
esac
echo "----- [log]"; cat "$log"; rm -rf "$log" "$home"
$T kill-server
