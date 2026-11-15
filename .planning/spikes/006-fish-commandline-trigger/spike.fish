# Spike 006: fish adapter stub for the literal `??` trigger (fish ≥4).
# Mirrors shell/zsh/queque.zsh:336 with commandline instead of LBUFFER/RBUFFER.

function _qq_log
    set -q QQ_SPIKE_LOG; and printf '%s\n' "$argv" >>$QQ_SPIKE_LOG
end

function _qq_question
    set -l line (commandline -b | string collect)
    set -l pos (commandline -C)
    set -l lbuf (string sub -l $pos -- "$line" | string collect)
    set -l rbuf (string sub -s (math $pos + 1) -- "$line" | string collect)
    if test "$(string sub -s -1 -- "$lbuf")" != '?'
        commandline -i '?'
        _qq_log "insert pos="(commandline -C)" line=["(commandline -b | string collect)"]"
        return
    end
    set -g QQ_LBUFFER (string sub -e -1 -- "$lbuf" | string collect)
    set -g QQ_RBUFFER "$rbuf"
    _qq_log "fire lbuffer=[$QQ_LBUFFER] rbuffer=[$QQ_RBUFFER] pos=$pos"
    set -l new_l "echo PICKED:$QQ_LBUFFER"
    commandline -r -- "$new_l$QQ_RBUFFER"
    commandline -C (string length -- "$new_l")
    _qq_log "applied line=["(commandline -b | string collect)"] pos="(commandline -C)
    commandline -f repaint
end

bind '?' _qq_question
bind -M insert '?' _qq_question
