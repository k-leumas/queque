# fish integration (`??` in fish 4.x)

## Requirements

From idea `multi-shell-trigger`:
- Same single-key approach as zsh: bind `?` and inspect the character before the cursor. No
  two-key `??` sequence binding.
- A pasted `??` must not open the picker.
- The unchanged `qq client` is the picker; only the buffer read/write and the result read differ
  per shell. A result read must time out (30 s) so a dead pane can't hang the shell. In fish
  that needs a guard, because `read -t` there means `--tokenize`.
- After the picker, every line of a multi-line prompt must be redrawn.

## How to Build It

Working adapter: `sources/007-fish-tui-handoff/queque.fish`. Shape:

1. **Bind in both modes.** Plain `bind` targets the default (vi normal) mode:
   ```fish
   bind '?' _qq_question
   bind -M insert '?' _qq_question
   ```
2. **Trigger logic.** Pipe every substitution through `string collect` so newlines survive:
   ```fish
   set -l line (commandline -b | string collect)
   set -l pos (commandline -C)
   set -l lbuf (string sub -l $pos -- "$line" | string collect)
   set -l rbuf (string sub -s (math $pos + 1) -- "$line" | string collect)
   if test "$(string sub -s -1 -- "$lbuf")" != '?'
       commandline -i '?'
       return
   end
   set -g QQ_ORIG_LBUFFER (string sub -e -1 -- "$lbuf" | string collect)
   ```
3. **Request JSON** with `jq -n --arg …`, using `--argjson pid $fish_pid`.
4. **Tool handoff:** `builtin -n` for builtins; executables via
   `for d in $PATH; test -d $d; and path filter -fx -- $d/* | path basename; end | sort -u`;
   functions via `functions -n` (drop `_*`) plus `abbr --list`.
5. **Zellij result read with a timeout guard:**
   ```fish
   zellij run --floating --close-on-exit … -- $qq_cmd client --request-file $req --result-file $fifo &
   disown 2>/dev/null
   command sh -c 'sleep "$1"; [ -p "$2" ] && printf %s "{\"kind\":\"cancel\"}" > "$2"' qq-guard 30 $fifo &
   set -l guard $last_pid
   disown $guard 2>/dev/null
   set -l r (command cat $fifo | string collect)
   command kill $guard 2>/dev/null
   test -n "$r"; and set result $r
   ```
6. **Apply the result.** Print `\n` first (fish leaves the cursor at the end of the input line),
   then the summary lines. Pad for multi-line prompts:
   ```fish
   for i in (seq 2 (count (fish_prompt)))
       printf '\n'
   end
   ```
   Then `commandline -r -- "$new_l$new_r"; commandline -C (string length -- "$new_l")`, add
   history with `builtin history append -- "$QQ_ORIG_LBUFFER"`, and finish with
   `commandline -f repaint`.

Testing: `fish --no-config -i` with a throwaway `$HOME`/`XDG_CONFIG_HOME` in a private tmux server
(`sources/007-fish-tui-handoff/drive.sh`). A fresh `$HOME` triggers QueQue's first-run telemetry
consent question after a pick; answer `n` in the harness. To fake Zellij, define a fish
**function** `zellij` and assert `type -t zellij` prints `function`. fish ignored a PATH fake.

## What to Avoid

- `read -t 30 var` copied from zsh/bash: in fish it tokenizes, the result comes back empty, and
  the pick is silently discarded (the user hit this). fish `read` has no timeout at all.
- `string match '*\?'` for "ends with `?`": single quotes keep the backslash, so it never
  matches. Compare the last character with `string sub -s -1`.
- Unquoted or uncollected `(string sub …)`: multi-line buffers collapse to spaces.
- Running the `.app` launcher `fish-X.app/Contents/MacOS/fish`: it opens a new Terminal window.
  The real shell is `Contents/Resources/base/usr/local/bin/fish`.
- Sourcing `queque.fish` from zsh: it fails with `:4: number expected`. It must be sourced inside fish.

## Constraints

- Validated on fish 4.9.3 only. fish 3.x untested: there `?` is still a glob unless
  `qmark-noglob` is set, and its key notation differs (a literal `?` binds the same way).
- `commandline -C` counts characters, so multibyte text needs no handling.
- fish handles bracketed paste internally, so pasted text never calls the binding.
- No default fish binding on `?` in either mode to collide with.
- Tool handoff takes 58–90 ms (2,156 commands) vs 8.8 ms in zsh. Same trade-off as bash.
- fish needed three fixes of its own (newline before output, prompt padding, FIFO read), so it
  shares the client contract with bash/zsh but not adapter code.
- Measured: about 5 s from trigger to buffer with a live model call. Confirmed by hand in real Zellij, and
  the first `?` feels instant.

## Origin

Synthesized from spikes: 006, 007
Source files available in: sources/006-fish-commandline-trigger/, sources/007-fish-tui-handoff/
