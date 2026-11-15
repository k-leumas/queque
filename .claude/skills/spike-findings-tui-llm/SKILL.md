---
name: spike-findings-tui-llm
description: Implementation blueprint from spike experiments. Requirements, proven patterns, and verified knowledge for building tui-llm (QueQue), covering installed-tool awareness via the zsh $commands handoff, flagging candidates that use missing tools, steering the prompt with an installed-tools list, and porting the literal `??` trigger and picker handoff to bash (≥5.0) and fish (4.x). Auto-loaded during implementation work.
---

<context>
## Project: tui-llm (QueQue)

**installed-only-commands:** only suggest commands for applications actually installed on the
user's machine. Collection must be fast (very little added startup time on `??`) and always
up to date, including tools installed earlier in the same shell session.

**multi-shell-trigger:** bring the literal `??` trigger to bash and fish with the same feel as
zsh: the first `?` inserts instantly, the second opens the picker with the text before the cursor
as context, and the chosen command lands back in the live buffer (Esc restores). The spike
decides whether bash ships next and whether fish comes back onto the roadmap.

Spike sessions wrapped: 2026-10-07, 2026-11-13
</context>

<requirements>
## Requirements

### installed-only-commands
- zsh's `$commands` table is the source of truth for what is installed. No separate PATH scan
  or daemon-side index.
- Suggestions that use a tool that isn't installed are shown, flagged "not installed" — not dropped.
- The handoff must be fresh: `rehash` before reading `$commands`, because a bare read misses
  binaries installed this session.
- Builtins come from zsh's `${(k)builtins}` in the same handoff; they are never flagged.
- Extracting command words from a candidate must never hang or throw on malformed model output.
- Don't send the full `$commands` list to the model.

### multi-shell-trigger
- Same single-key approach as zsh: bind `?` and inspect the character before the cursor. No
  two-key `??` sequence binding (it delays every lone `?` by `keyseq-timeout`).
- bash 3.2 (macOS `/bin/bash`) must be refused with one clear line, leaving `?` untouched.
- A pasted `??` must not open the picker.
- bash support targets 5.0+ (`READLINE_POINT` counts characters from 5.0; bytes in 4.x).
- The unchanged `qq client` is the picker for every shell; only the buffer read/write and the
  result read differ per shell. A result read must time out (30 s) so a dead pane can't hang
  the shell. In fish that needs a guard, because `read -t` there means `--tokenize`.
- After the picker, every line of a multi-line prompt must be redrawn (bash: `${PS1@P}` head;
  fish: pad by prompt height).
</requirements>

<findings_index>
## Feature Areas

| Area | Reference | Key Finding |
|------|-----------|-------------|
| Installed-command handoff | references/installed-command-handoff.md | `rehash` + `print -rl -- ${(k)commands}` into the session tmpdir costs ~7 ms and is always fresh; never loop or sort in zsh |
| Candidate command check | references/candidate-command-check.md | Hand lexer: 40/40 cases, ~3.5 µs/candidate; shell-quote and sh-syntax are dead ends; clamp `indexOf` −1 (a fuzz-found infinite loop) |
| bash integration | references/bash-integration.md | `bind -x '"?": fn'` + READLINE_LINE/POINT works on bash ≥5.0 with the unchanged client (inline + Zellij); 4.x counts bytes; handoff ~85 ms via compgen |
| fish integration | references/fish-integration.md | `bind '?'` + `bind -M insert` + `commandline` works on fish 4.x; `read -t` is --tokenize, so read the FIFO with `cat` plus a timeout guard; three fish-only repaint/output fixes |
| Prompt steering | references/prompt-steering.md | PARTIAL. `catalog ∩ installed` (~55 names, +225 tokens) steers toward installed tools; the full list costs 33× and still leaks missing tools |

## Source Files

Original spike source files are preserved in `sources/` for complete reference.
</findings_index>

<metadata>
## Processed Spikes

- 001-zsh-commands-handoff
- 002-candidate-binary-check
- 003-prompt-steering
- 004-bash-readline-trigger
- 005-bash-tui-handoff
- 006-fish-commandline-trigger
- 007-fish-tui-handoff
</metadata>
