---
spike: 004
idea: multi-shell-trigger
name: bash-readline-trigger
type: standard
validates: "Given interactive bash ≥4 in a pty, when the user types `foo??` (emacs and vi-insert), then the first `?` appears instantly, the second fires with lbuffer `foo`, multibyte cursor maths is right, pasted `??` doesn't fire, and bash 3.2 is refused cleanly"
verdict: VALIDATED
related: [001]
tags: [bash, readline, bind-x, multibyte, bracketed-paste, trigger]
---

# Spike 004: bash readline `??` trigger

## What This Validates
Given interactive bash in a real pty, when the user types `foo??` in emacs or vi-insert mode,
then the first `?` is inserted by our function, the second fires with `lbuffer=foo` and the
right `rbuffer`, the write-back to `READLINE_LINE` is what bash then runs, multibyte text keeps
the cursor maths right, a pasted `??` does not fire, and bash 3.2 refuses cleanly.

## Research
- `bind -x '"keyseq": shell-command'` runs a shell function with `READLINE_LINE` and
  `READLINE_POINT` set; changes to both are reflected back into readline. Both variables were
  added in bash 4.0 — macOS `/bin/bash` 3.2 has neither.
- **bash 5.0 changed the unit of `READLINE_POINT` from bytes to characters.** Source:
  bash-5.3 `CHANGES`, bash-5.0-alpha section: "When running `bind -x' commands, bash now sets
  READLINE_POINT based on the number of characters in the readline line buffer, not the number
  of bytes." Earlier context: a 2018 bug-bash thread on 4.4 misplacing the cursor on multibyte
  lines.
- Bracketed paste is on by default from bash 5.1 (`enable-bracketed-paste`).
- Prior art: fzf's `key-bindings.bash` uses `bind -x` + `READLINE_LINE` on bash ≥4.

| Approach | Pros | Cons | Status |
|---|---|---|---|
| `bind -x '"?": fn'`, check char before cursor | Instant first `?`; same logic as zsh widget | Function runs on every `?` | **Chosen** |
| `bind -x '"??": fn'` (two-key sequence) | No per-`?` function call | Lone `?` becomes ambiguous → waits `keyseq-timeout` (500 ms) before inserting | Rejected |

## How to Run
```bash
./run-all.sh /bin/bash /path/to/bash-5.x
```
`run.exp` drives one case in a fresh `bash --noprofile --norc -i` under expect; the bound
function appends each event to a log, and the case presses Enter so the captured output is
what bash actually executed.

## What to Expect
On bash ≥5: every case prints `PICKED:<lbuffer>` except `single` (prints `x?`) and `paste_on`
(prints `pasted??`, trigger never fires). On 3.2: the refusal message on source, and `??`
stays literal.

## Investigation Trail
1. First run against 3.2 mis-captured output (synced on `$ ` which also appears in the refusal
   line). Switched to `__READY__` / `__END__` sentinels.
2. bash 5.3 then timed out on every case: 5.3 prints `\e[?2004l\r` before command output, so the
   end marker follows `\r`, not `\n`. Fixed the regex. Raw pty dump also showed readline does a
   full line redraw (`\r\e[K\r$ …`) after **every** `bind -x` call, including the plain first
   `?` — invisible in practice, but worth a human look in spike 005.
3. Emoji case first showed `ð` — Tcl 8.5 in macOS expect can't hold non-BMP characters. Sent the
   raw UTF-8 bytes on a binary channel instead; log then showed the real 🚀.
4. Found the bytes→characters change in bash's own CHANGES file (5.0-alpha).
5. Tried building bash 4.4.18 to test byte offsets; the build was blocked by the session's
   permission policy, so 4.x is **untested**.

## Results
**VALIDATED for bash ≥5.0.** Evidence (bash 5.3.0, built from source; macOS bash 3.2.57):

| Case | bash 5.3 | bash 3.2 |
|---|---|---|
| emacs `list files??` | fired `lbuffer=[list files]`, ran `PICKED:list files` | refused, literal |
| single `echo x?` | inserted, no fire, ran `x?` | literal |
| mid-line `echo ab⎀??cd` | `lbuffer=[echo ab] rbuffer=[cd]` | literal |
| `echo café??` | point=10 (chars; bytes would be 11) | literal |
| `echo 🚀x??` | point=8 (chars; bytes would be 11) | input mangled by 3.2 readline |
| `echo café⎀?? bar` | `lbuffer=[echo café] rbuffer=[ bar]` | literal |
| vi-insert, plain + café | same as emacs | literal |
| pasted `??`, bracketed paste on | **did not fire**, ran `pasted??` | n/a |
| pasted `??`, bracketed paste off | fired | literal |

- bash 3.2 guard (`BASH_VERSINFO[0] < 4`) prints one line and leaves `?` alone.
- bash 4.x: `READLINE_POINT` is in bytes while `${var:off:len}` slices characters. Untested
  hypothesis: slice under `local LC_ALL=C` on 4.x so both sides are bytes. Simplest product
  call: require bash ≥5.0 (Ubuntu 20.04+, Debian 11+, Fedora, Arch, Alpine, Homebrew all qualify;
  RHEL/CentOS 8 is the main 4.4 holdout).
- On bash 5.0 the paste protection depends on the user's `enable-bracketed-paste` setting
  (default off before 5.1).
