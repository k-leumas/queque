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
