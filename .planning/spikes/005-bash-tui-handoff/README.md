---
spike: 005
idea: multi-shell-trigger
name: bash-tui-handoff
type: standard
validates: "Given the trigger fires inside `bind -x`, when the real `qq` Ink picker runs on the tty, then keys reach the picker, the chosen command lands in `READLINE_LINE`, Esc restores, the screen redraws cleanly, and the Zellij FIFO path works"
verdict: VALIDATED
related: [004, 001]
tags: [bash, bind-x, ink, tty, zellij, fifo, tool-handoff, prompt-redraw]
---

# Spike 005: bash ↔ Ink picker handoff

## What This Validates
Given the `??` trigger from spike 004 firing inside `bind -x`, when the unchanged `qq client`
runs (inline on the tty, or in a Zellij floating pane over a FIFO), then the picker gets the
keyboard, the chosen command is written to `READLINE_LINE`/`READLINE_POINT`, Esc restores the
original line, and the prompt redraws cleanly.

## Research
- `qq client` opens `/dev/tty` itself (`src/client/run-foreground.ts:154`), so it doesn't care
  what stdin the shell hands it. No client change needed.
- Prior art: fzf's bash key bindings run a full-screen TUI from `bind -x` and write back via
  `READLINE_LINE`.
- `${PS1@P}` (bash ≥4.4) expands the prompt string.

## How to Run
```bash
./drive.sh "/path/to/bash-5.x --noprofile --norc -i" fixture|llm-pick|llm-esc|prompt-multiline
```
Runs in a private tmux server (`tmux -L qqspike`) and prints `capture-pane` snapshots plus the
adapter's event log. By hand: start bash 5, `export QQ_DEV_ROOT=…`, `source queque.bash`.

## Investigation Trail
1. First fixture run printed `commands.txt: No such file`. `grep -v '^_'` and `compgen -a` both
   exit 1 on an empty list (no public functions/aliases under `--norc`), which failed the whole
   `&&` chain and deleted the handoff. Rewrote the handoff to never chain on compgen's status.
2. The client then seemed to hang. It wasn't: this session runs inside Zellij, so `ZELLIJ` was
   inherited and the adapter correctly took the Zellij path, opening floating panes in the
   user's real session. Harness now unsets `ZELLIJ*`. (Side effect: proved `zellij run` from
   `bind -x` launches the pane.)
3. Inline fixture round-trip then worked first time, including prompt redraw.
4. Two-line prompt (`\w\n\$ `): after the summary lines, readline repaints only the **last**
   prompt line. Added `_qq_reprint_prompt_head` (prints all but the last line of `${PS1@P}`).
5. Harness timing: waited on `Enter` (controls line says `enter`) → 30 s waits; then on
   `enter  accept` (visible while thinking) → keys sent before candidates. Settled on `┌>`.

## Results
**VALIDATED on bash 5.3.0** (automated) **and by hand in a real Zellij session** (user picked a
candidate from the floating pane; it landed in the buffer).

| Check | Result |
|---|---|
| Ink picker renders inline, ↑↓ reach it | ✓ (`capture-pane` shows selection moving) |
| Enter → buffer | ✓ `ls -lhSr`, cursor 8, summary lines printed above the prompt |
| Esc → original line | ✓ `echo keep this mid` restored, typing continues |
| Prompt redraw after picker | ✓ single-line; ✓ two-line after `${PS1@P}` fix |
| Zellij floating pane + FIFO | ✓ by hand |
| `??` → buffer, live LLM | 3.9 s (with model call) |
| `??` → buffer, fixture | 395 ms (handoff 95 + client 234) |

**Tool handoff is ~10× slower than zsh:** `compgen -c | sort -u` + builtins + functions took
80–88 ms over 5 runs (27 PATH dirs), vs 8.8 ms for zsh's `rehash; ${(k)commands}`. Options for
the build: run it in the background while Node starts, or let the client scan PATH itself.

By hand, the per-`?` line redraw (readline redraws after every `bind -x`) is not perceptible —
user: "the first ? feels instantaneous".
