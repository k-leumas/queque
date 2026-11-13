# Spike Wrap-Up Summary

**Date:** 2026-10-07
**Spikes processed:** 3
**Feature areas:** installed-command handoff, candidate command check, prompt steering
**Skill output:** `./.claude/skills/spike-findings-tui-llm/`

## Processed Spikes
| # | Name | Type | Verdict | Feature Area |
|---|------|------|---------|--------------|
| 001 | zsh-commands-handoff | standard | VALIDATED | installed-command handoff |
| 002 | candidate-binary-check | standard | VALIDATED | candidate command check |
| 003 | prompt-steering | comparison | PARTIAL | prompt steering |

## Key Findings
- **Handoff:** the `??` widget runs `rehash`, then writes `${(k)commands}` and `${(k)builtins}`
  to the private session tmpdir. This costs ~7 ms and is always fresh. Without `rehash`,
  tools installed this session are invisible and removed ones linger. Never loop over or sort
  `$commands` in zsh (136–167 ms).
- **Candidate check:** a hand-written zsh-aware lexer extracts every program a suggestion runs
  (pipes, wrappers, `$(…)`, `<(…)`, assignments, placeholders) in ~3.5 µs, 40/40 cases.
  shell-quote misses substitution inside double quotes; sh-syntax exposes no command nodes.
  Fuzzing found and fixed an infinite loop (an unclamped `indexOf` −1).
- **Prompt steering (partial, 6/15 queries before API credits ran out):** a short
  installed ∩ curated-catalog list (~55 names, +225 tokens) steered toward installed tools with
  zero missing-tool leaks. The full 2,175-name list cost ~33× the tokens and still leaked
  `htop`/`eza`. Keep the post-response flag in all cases.
- **Open decisions:** label for "installed by this command" (`brew install fd && fd`); where the
  curated catalog lives; finish spike 003 with `QUERY_START=6` once credits are topped up.

---

# Spike Wrap-Up Summary (2026-11-13)

**Date:** 2026-11-13
**Spikes processed:** 4
**Feature areas:** bash integration, fish integration
**Skill output:** `./.claude/skills/spike-findings-tui-llm/` (appended)

## Processed Spikes
| # | Name | Type | Verdict | Feature Area |
|---|------|------|---------|--------------|
| 004 | bash-readline-trigger | standard | VALIDATED (bash ≥5.0; 4.x untested) | bash integration |
| 005 | bash-tui-handoff | standard | VALIDATED (Zellij by hand) | bash integration |
| 006 | fish-commandline-trigger | standard | VALIDATED (fish 4.9; 3.x untested) | fish integration |
| 007 | fish-tui-handoff | standard | VALIDATED (Zellij by hand after FIFO fix) | fish integration |

## Key Findings
- **bash ≥5.0:** `bind -x '"?": fn'` with READLINE_LINE/POINT reproduces the zsh widget exactly,
  in emacs and vi-insert, including multibyte, mid-line and pasted input. bash 5.0 switched
  READLINE_POINT from bytes to characters, so 4.x would break on multibyte text. macOS 3.2 is
  refused cleanly. The unchanged `qq client` works inline and in Zellij. The only fix needed was
  reprinting the head of a multi-line PS1.
- **fish 4.x:** `bind '?'` + `bind -M insert` + `commandline` works the same way, with characters
  for cursor positions and paste never reaching the binding. It needed three fish-only fixes: a
  newline before output, padding for the multi-line prompt repaint, and the Zellij FIFO read
  (`read -t` is --tokenize in fish; read with `cat` plus a 30 s cancel guard).
- **Cost:** tool handoff takes ~85 ms in bash and 58–90 ms in fish, vs 8.8 ms in zsh. Overlap it
  with Node startup or move the PATH scan into the client.
- **Feel:** user confirmed the first `?` is instant and both Zellij paths land the pick in the buffer.
- **Open decisions:** whether fish returns to the roadmap; whether to support bash 4.x (needs a
  4.4 build to test); where the bash/fish tool scan lives.
