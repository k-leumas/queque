---
spike: 007
idea: multi-shell-trigger
name: fish-tui-handoff
type: standard
validates: "Given the fish binding fires, when the Ink picker runs, then the tty handoff, write-back, Esc restore and repaint all work (inline and Zellij)"
verdict: VALIDATED
related: [006, 005]
tags: [fish, ink, tty, zellij, fifo, repaint, tool-handoff]
---

# Spike 007: fish ↔ Ink picker handoff

## What This Validates
Given the `??` binding from spike 006, when the unchanged `qq client` runs inline or in a Zellij
floating pane, then the picker gets the keyboard, `commandline -r/-C` receives the pick, Esc
restores, and fish repaints cleanly.

## Research
- Running an external TUI from a binding then `commandline -f repaint` is the documented
  pattern (`bind ctrl-g 'git diff' repaint`).
- **fish `read -t` is `--tokenize`, not a timeout, and `read` has no timeout option.**
- `path filter -fx` (fish ≥3.5) lists executables without a subprocess per file.

## How to Run
```bash
./drive.sh /path/to/fish fixture|llm-pick|llm-esc|prompt-multiline
```
By hand, inside fish: `set -gx QQ_DEV_ROOT …; source queque.fish`.

## Investigation Trail
1. Fixture round-trip worked, but the summary printed on the prompt line: readline moves to a
   fresh line before `bind -x`, fish doesn't. Print `\n` first.
2. Fresh `$HOME` triggered QueQue's first-run telemetry consent question after the pick — product
   behaviour, harness answers `n`.
3. Two-line `fish_prompt`: the repaint moves up (prompt lines − 1) from the cursor and overwrote
   the last summary line. Pad with that many newlines (`count (fish_prompt)`).
4. **User found the Zellij path restored the original line instead of the pick.** Ported
   `read -t 30` from zsh; in fish that tokenizes, so `result` came back empty → cancel. Repro
   with a plain FIFO confirmed (`result=` empty vs full JSON via `cat`). Fixed: `cat` the FIFO,
   plus a background guard that writes `cancel` after 30 s so a dead pane can't hang the shell.
   Verified with a fake `zellij` function (alive → applied; dead → cancel after timeout; no
   leftover guards), then by hand.
5. Harness mistake: an early fake-zellij run used PATH, which fish didn't honour, and inherited
   `ZELLIJ_SESSION_NAME` — it opened real panes in the user's session. Harness now unsets
   `ZELLIJ*`, overrides `zellij` with a fish function, and aborts unless `type -t zellij` is
   `function`.

## Results
**VALIDATED on fish 4.9.3** (automated) **and by hand in a real Zellij session** after the FIFO
fix (user: "picked candidate landed in buffer").

| Check | Result |
|---|---|
| Picker renders inline, ↑↓ reach it | ✓ |
| Enter → buffer | ✓ `ls -lhSr`, cursor 8, summary on its own lines |
| Esc → original line | ✓ restored, typing continues |
| Repaint, single + two-line prompt | ✓ after newline + padding fixes |
| Zellij floating pane + FIFO | ✓ by hand after `read -t` fix |
| Dead pane | ✓ cancel after guard timeout, no hang |
| Tool handoff | 58–90 ms (`path filter` over PATH, 2156 commands) |

fish needed three fish-specific fixes zsh and bash didn't (newline before output, prompt-height
padding, FIFO read) — all small, but it means fish can't share bash's adapter code, only the
contract. fish 3.x not tested. By hand, user: "the first ? feels instantaneous".
