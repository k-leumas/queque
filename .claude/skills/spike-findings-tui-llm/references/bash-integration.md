# bash integration (`??` in bash ≥5.0)

## Requirements

From idea `multi-shell-trigger`:
- Same single-key approach as zsh: bind `?` and inspect the character before the cursor. No
  two-key `??` sequence binding.
- bash 3.2 (macOS `/bin/bash`) must be refused with one clear line, leaving `?` untouched.
- A pasted `??` must not open the picker.
- bash support targets 5.0+.
- The unchanged `qq client` is the picker; only the buffer read/write and the result read differ
  per shell. A result read must time out (30 s) so a dead pane can't hang the shell.
- After the picker, every line of a multi-line prompt must be redrawn.

## How to Build It

Working adapter: `sources/005-bash-tui-handoff/queque.bash` (a port of
`shell/zsh/queque.zsh:334`). Shape:

1. **Version guard** at the top of the file:
   ```bash
   if (( BASH_VERSINFO[0] < 5 )); then
     printf 'queque: bash %s is too old for the ?? trigger (needs 5.0+)\n' "$BASH_VERSION" >&2
     return 0 2>/dev/null || exit 0
   fi
   ```
2. **Bind `?` in both keymaps:**
   ```bash
   bind -m emacs     -x '"?": _qq_question'
   bind -m vi-insert -x '"?": _qq_question'
   ```
3. **Trigger logic.** `READLINE_LINE`/`READLINE_POINT` replace `LBUFFER`/`RBUFFER`:
   ```bash
   local lbuf=${READLINE_LINE:0:READLINE_POINT} rbuf=${READLINE_LINE:READLINE_POINT}
   if [[ $lbuf != *\? ]]; then
     READLINE_LINE=$lbuf?$rbuf; (( READLINE_POINT++ )); return 0
   fi
   QQ_ORIG_LBUFFER=${lbuf%\?} QQ_ORIG_RBUFFER=$rbuf
   ```
4. **Request JSON with `jq -n --arg`** (no hand-built JSON): `ttyPath` from `$(tty)`,
   `shellPid` `$$`, `cwd` `$PWD`, `lbuffer`, `rbuffer`.
5. **Tool handoff** into the 0700 session dir. Never chain on compgen's exit status:
   ```bash
   hash -r
   compgen -c | sort -u >"$dir/commands.txt" 2>/dev/null
   compgen -b >"$dir/builtins.txt" 2>/dev/null
   { compgen -A function | grep -v '^_'; compgen -a; } >"$dir/functions.txt" 2>/dev/null
   [[ -s $dir/commands.txt ]] || rm -f -- "$dir"/{commands,builtins,functions}.txt
   ```
6. **Run the client.** Inline: run it as a foreground child with a result file (it opens
   `/dev/tty` itself). Zellij: `mkfifo`, `zellij run --floating --close-on-exit … &` +
   `disown`, then `IFS= read -r -t 30 result <"$fifo"` (bash's `read -t` *is* a timeout).
7. **Apply the result.** On `replace-buffer`, print `queque › <query>` and the command,
   `history -s -- "$QQ_ORIG_LBUFFER"`, reprint the prompt head, then set
   `READLINE_LINE=$new_l$new_r; READLINE_POINT=${#new_l}`. On cancel/error, restore the
   originals. Readline redraws the last prompt line by itself after `bind -x` returns, so no
   `reset-prompt` is needed.
8. **Multi-line prompt head:**
   ```bash
   _qq_reprint_prompt_head() {
     local p=${PS1@P}
     [[ $p == *$'\n'* ]] && printf '%s\n' "${p%$'\n'*}"
   }
   ```

Testing: drive a real `bash --noprofile --norc -i` in a private tmux server
(`sources/005-bash-tui-handoff/drive.sh`). Use `--result-mode replace-buffer-fixture` for a
deterministic round-trip with no LLM call, and wait for `┌>` before sending keys to the picker.

## What to Avoid

- `bind -x '"??": fn'`: a lone `?` then waits `keyseq-timeout` (500 ms) before it appears.
- `{ compgen …; } && …` chains: `compgen -a` with no aliases, and `grep -v '^_'` when every
  function is `_`-prefixed, both exit 1 and silently delete the handoff.
- Letting a test harness inherit `ZELLIJ*` from a Claude Code session running inside Zellij: the
  adapter correctly takes the Zellij path and opens real floating panes in the user's session.
- Expecting the full prompt to repaint: only its last line does.

## Constraints

- `READLINE_LINE`/`READLINE_POINT` need bash ≥4.0. `READLINE_POINT` counts **characters** from
  bash 5.0 (CHANGES, 5.0-alpha) and **bytes** in 4.x, while `${var:off:len}` slices characters,
  so 4.x breaks on multibyte text before the cursor. 4.x is untested (only an unverified
  `local LC_ALL=C` slicing idea). Main holdout: RHEL/CentOS 8.
- Bracketed paste (the default from 5.1) is what stops a pasted `??` firing. On 5.0 it depends
  on the user's `enable-bracketed-paste` setting.
- Tool handoff costs 80–88 ms (27 PATH dirs) vs 8.8 ms in zsh. Overlap it with Node startup or
  move the PATH scan into the client. This relates to idea `installed-only-commands`, whose
  zsh-only `$commands` rule has no bash equivalent; the shell stays the source of truth via
  `compgen`.
- Measured: fixture round-trip 395 ms (handoff 95 + client 234); live pick 3.9 s including the
  model call. By hand, the first `?` feels instant.

## Origin

Synthesized from spikes: 004, 005
Source files available in: sources/004-bash-readline-trigger/, sources/005-bash-tui-handoff/
