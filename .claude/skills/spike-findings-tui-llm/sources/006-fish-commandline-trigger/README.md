---
spike: 006
idea: multi-shell-trigger
name: fish-commandline-trigger
type: standard
validates: "Given interactive fish 4.x, when the user types `foo??` (default and vi insert mode), then the same trigger behaviour works via `bind` + `commandline -C/-r`"
verdict: VALIDATED
related: [004]
tags: [fish, commandline, bind, multibyte, paste, trigger]
---

# Spike 006: fish `??` trigger via `bind` + `commandline`

## What This Validates
Given interactive fish 4.9.3 in a real pty, when the user types `foo??` in the default or vi
insert mode, then the first `?` is inserted by our function, the second fires with the right
lbuffer/rbuffer, `commandline -r`/`-C` writes back what fish then runs, multibyte and multi-line
buffers stay correct, and a pasted `??` does not fire.

## Research
- `bind KEYS COMMAND` (fish 4 key-name syntax); `bind -M insert` for vi insert mode, because
  plain `bind` targets the default (vi normal) mode. A script that changes the commandline
  should end with `commandline -f repaint`.
- `commandline -b` gets the buffer, `-C` gets/sets the cursor, `-i` inserts at the cursor,
  `-r` replaces. `--column` is documented in Unicode code points.
- fish 4.9.3 ships no default binding on `?` in either mode (checked with `bind`), and since
  fish 4.0 `?` is no longer a glob character, so `ls ??` has no glob meaning to protect.

| Approach | Pros | Cons | Status |
|---|---|---|---|
| `bind '?' fn`, check char before cursor | Same logic as zsh/bash; instant first `?` | function runs on every `?` | **Chosen** |
| `bind '?,?' fn` (two-key sequence) | No per-`?` function | lone `?` waits for `fish_sequence_key_delay_ms` | Not tried — same flaw as bash |
| abbreviation with `--regex '.*\?\?'` | No key binding | Only expands on space/enter; can't open a TUI mid-typing | Rejected |

## How to Run
```bash
QQ_FISH=/path/to/fish ./drive.sh basic        # or single|midline|cafe|emoji|mb_mid|paste|multiline
QQ_FISH=/path/to/fish ./drive.sh basic vi
```
Each case runs `fish --no-config -i` in a private tmux server with a throwaway `$HOME`.

## Investigation Trail
1. First run: the binding ran (first `?` logged) but the second never fired. In fish's single
   quotes `\?` stays a literal backslash, so `string match '*\?'` never matched. Replaced with a
   direct last-character comparison.
2. Multi-line buffer (`echo one`⏎`two??`) came back as `echo one two`: fish command
   substitution splits on newlines and `"$var"` rejoins with spaces. Every `(string sub …)` needs
   `| string collect`. Fixed; newline now preserved.
3. Paste (tmux `paste-buffer -p`, bracketed) inserted `echo pasted??` without calling the
   binding at all — fish handles bracketed paste internally.

## Results
**VALIDATED on fish 4.9.3** (official prebuilt macOS app).

| Case | Result |
|---|---|
| `list files??` (default + vi insert) | fired `lbuffer=[list files]`, ran `PICKED:list files` |
| `echo x?` | inserted, no fire |
| mid-line `echo ab⎀??cd` | `lbuffer=[echo ab] rbuffer=[cd]` |
| `echo café??` | pos=10 — characters |
| `echo 🚀x??` | pos=8 — characters |
| `echo café⎀?? bar` | `lbuffer=[echo café] rbuffer=[ bar]` |
| multi-line buffer | newline preserved after `string collect` fix |
| pasted `??` | binding never called |

- Cursor positions are characters, so no byte/char handling is needed (unlike bash 4.x).
- fish 3.x not tested. Known differences from docs: fish 3 uses `\e`-style key notation (the
  literal `?` binding is the same), and `?` is still a glob unless `qmark-noglob` is set.
