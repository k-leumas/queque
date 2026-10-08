---
name: spike-findings-tui-llm
description: Implementation blueprint from spike experiments. Requirements, proven patterns, and verified knowledge for building tui-llm (QueQue), covering installed-tool awareness via the zsh $commands handoff, flagging candidates that use missing tools, and steering the prompt with an installed-tools list. Auto-loaded during implementation work.
---

<context>
## Project: tui-llm (QueQue)

**installed-only-commands:** only suggest commands for applications actually installed on the
user's machine. Collection must be fast (very little added startup time on `??`) and always
up to date, including tools installed earlier in the same shell session.

Spike sessions wrapped: 2026-10-07
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
</requirements>

<findings_index>
## Feature Areas

| Area | Reference | Key Finding |
|------|-----------|-------------|
| Installed-command handoff | references/installed-command-handoff.md | `rehash` + `print -rl -- ${(k)commands}` into the session tmpdir costs ~7 ms and is always fresh; never loop or sort in zsh |
| Candidate command check | references/candidate-command-check.md | Hand lexer: 40/40 cases, ~3.5 µs/candidate; shell-quote and sh-syntax are dead ends; clamp `indexOf` −1 (a fuzz-found infinite loop) |
| Prompt steering | references/prompt-steering.md | PARTIAL. `catalog ∩ installed` (~55 names, +225 tokens) steers toward installed tools; the full list costs 33× and still leaks missing tools |

## Source Files

Original spike source files are preserved in `sources/` for complete reference.
</findings_index>

<metadata>
## Processed Spikes

- 001-zsh-commands-handoff
- 002-candidate-binary-check
- 003-prompt-steering
</metadata>
