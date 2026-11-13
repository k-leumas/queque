# Spike 007: full fish adapter — ports qq-question-widget (shell/zsh/queque.zsh:334). fish ≥4.

function _qq_log
    set -q QQ_SPIKE_LOG; and printf '%s %s\n' (date +%s) "$argv" >>$QQ_SPIKE_LOG
end

# fish equivalent of _qq_write_tool_handoff: `complete -C ''` would be slow; use builtin lists.
function _qq_write_tool_handoff -a dir
    test "$QQ_TOOL_AWARENESS" = 0; and return 0
    builtin -n >$dir/builtins.txt
    # every executable on PATH, deduped
    for d in $PATH
        test -d $d; and path filter -fx -- $d/* | path basename
    end | sort -u >$dir/commands.txt
    begin; functions -n | string split ', ' | string match -v -- '_*'; abbr --list; end >$dir/functions.txt
    test -s $dir/commands.txt; or rm -f $dir/commands.txt $dir/builtins.txt $dir/functions.txt
end

function _qq_restore
    commandline -r -- "$QQ_ORIG_LBUFFER$QQ_ORIG_RBUFFER"
    commandline -C (string length -- "$QQ_ORIG_LBUFFER")
end

function _qq_apply_result_str -a json
    set -l kind (printf '%s' $json | jq -r '.kind // empty' 2>/dev/null)
    switch "$kind"
        case replace-buffer
            set -l new_l (printf '%s' $json | jq -r '.lbuffer // empty' | string collect)
            set -l new_r (printf '%s' $json | jq -r '.rbuffer // ""' | string collect)
            if test -z "$new_l"
                _qq_restore; return 1
            end
            # A binding leaves the cursor at the end of the input line (readline moves to a fresh
            # line before bind -x; fish does not), so start the summary on its own line.
            printf '\n'
            test -n "$QQ_ORIG_LBUFFER"; and printf '\e[38;5;240mqueque › %s\e[0m\n' "$QQ_ORIG_LBUFFER"
            printf '%s\n' "$new_l$new_r"
            # fish repaints a multi-line prompt by moving up (prompt lines - 1) from the cursor,
            # which would overwrite the summary. Pad so the repaint lands on blank lines.
            for i in (seq 2 (count (fish_prompt)))
                printf '\n'
            end
            # fish has no `history -s`; `history append` (fish ≥3.?) — check below
            test -n "$QQ_ORIG_LBUFFER"; and builtin history append -- "$QQ_ORIG_LBUFFER" 2>/dev/null
            commandline -r -- "$new_l$new_r"
            commandline -C (string length -- "$new_l")
        case error
            set -l msg (printf '%s' $json | jq -r '.message // empty')
            test -n "$msg"; and printf '\n%s\n' $msg
            _qq_restore
        case '*'
            _qq_restore
    end
end

function _qq_question
    set -l line (commandline -b | string collect)
    set -l pos (commandline -C)
    set -l lbuf (string sub -l $pos -- "$line" | string collect)
    set -l rbuf (string sub -s (math $pos + 1) -- "$line" | string collect)
    if test "$(string sub -s -1 -- "$lbuf")" != '?'
        commandline -i '?'
        return
    end
    set -g QQ_ORIG_LBUFFER (string sub -e -1 -- "$lbuf" | string collect)
    set -g QQ_ORIG_RBUFFER "$rbuf"
    _qq_log "fire lbuffer=[$QQ_ORIG_LBUFFER] rbuffer=[$QQ_ORIG_RBUFFER]"

    set -l qq_cmd
    if set -q QQ_DEV_ROOT; and test -f $QQ_DEV_ROOT/dist/cli/main.js
        set qq_cmd node $QQ_DEV_ROOT/dist/cli/main.js
    else if command -q qq
        set qq_cmd (command -s qq)
    else
        echo 'queque: qq not found'; _qq_restore; commandline -f repaint; return
    end

    set -l tmpdir (mktemp -d /tmp/qq-sess.XXXXXX); or begin; _qq_restore; return; end
    chmod 700 $tmpdir
    set -l req $tmpdir/request.json
    jq -n --arg tty (tty) --arg cwd $PWD --argjson pid $fish_pid \
        --arg l "$QQ_ORIG_LBUFFER" --arg r "$QQ_ORIG_RBUFFER" \
        '{version:1, ttyPath:$tty, cwd:$cwd, shellPid:$pid, lbuffer:$l, rbuffer:$r}' >$req
    set -l t0 (perl -MTime::HiRes=time -e 'printf "%d", time*1000')
    _qq_write_tool_handoff $tmpdir
    _qq_log "handoff cmds="(count < $tmpdir/commands.txt)" ms="(math (perl -MTime::HiRes=time -e 'printf "%d", time*1000') - $t0)

    set -l result '{"kind":"cancel"}'
    if set -q ZELLIJ
        set -l fifo $tmpdir/result.fifo; mkfifo $fifo
        set -gx QQ_RESULT_FILE $fifo
        set -q QQ_PANE_WIDTH; or set -gx QQ_PANE_WIDTH 80
        set -q QQ_PANE_HEIGHT; or set -gx QQ_PANE_HEIGHT 24
        zellij run --floating --close-on-exit --width $QQ_PANE_WIDTH --height $QQ_PANE_HEIGHT --name qq -- \
            $qq_cmd client --request-file $req --result-file $fifo 2>>/tmp/qq-(id -u)-debug.log &
        disown 2>/dev/null
        # fish's `read -t` means --tokenize, not timeout, and read has no timeout at all. Read with
        # cat; a guard writes a cancel after the timeout so a client that never opens the FIFO
        # can't hang the shell. The guard is killed as soon as the real result arrives.
        set -l timeout 30
        set -q QQ_FIFO_TIMEOUT; and set timeout $QQ_FIFO_TIMEOUT
        command sh -c 'sleep "$1"; [ -p "$2" ] && printf %s "{\"kind\":\"cancel\"}" > "$2"' qq-guard $timeout $fifo &
        set -l guard $last_pid
        disown $guard 2>/dev/null
        set -l r (command cat $fifo | string collect)
        command kill $guard 2>/dev/null
        test -n "$r"; and set result $r
    else
        set -gx QQ_RESULT_FILE $tmpdir/result.json
        set -l mode
        set -q QQ_SPIKE_RESULT_MODE; and set mode --result-mode $QQ_SPIKE_RESULT_MODE
        $qq_cmd client --request-file $req --result-file $QQ_RESULT_FILE $mode 2>>/tmp/qq-(id -u)-debug.log
        _qq_log "client status=$status"
        test -s $QQ_RESULT_FILE; and set result (cat $QQ_RESULT_FILE | string collect)
    end
    _qq_log "result=$result"
    _qq_apply_result_str $result
    _qq_log "applied line=["(commandline -b | string collect)"] pos="(commandline -C)
    rm -rf -- $tmpdir
    commandline -f repaint
end

bind '?' _qq_question
bind -M insert '?' _qq_question
