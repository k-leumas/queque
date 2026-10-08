---
spike: 002
idea: installed-only-commands
name: candidate-binary-check
type: standard
validates: "Given a model-suggested command, when every program it would run is extracted (pipes, &&, sudo/env/xargs wrappers, assignments, $( ), <( ), builtins, placeholders), then each is correctly classified installed / builtin / missing against the zsh tables, fast and without ever hanging"
verdict: VALIDATED
related: [001]
tags: [shell-parsing, tokenizer, candidates, flagging, robustness]
---

# Spike 002: Candidate command-word check

## What This Validates
Given a model-suggested command, when every program it would run is extracted, then each one is
classified as `external` (checked against `$commands` → installed or missing), `builtin`,
`placeholder` (`<filename>`), `dynamic` (`$EDITOR`), or `path` (`./x.sh`). This is what lets the
picker flag suggestions that use a tool that isn't installed (user decision: flag, don't drop).

## Research

| Approach | Tool | Result |
|----------|------|--------|
| Hand lexer + shared parser | `extract.mjs` (~230 lines) | **40/40** cases, ~3.5 µs/command |
| shell-quote 1.12 tokens + same parser | npm | 37/40. Misses `"…$(date)…"` (substitution inside double quotes), `<(sort a)` process substitution, and backticks. These are common in real suggestions |
| sh-syntax 0.7 (WASM mvdan/sh) | npm | **Unusable.** The JS bridge exposes each command node only as `{Pos, End}`, so program names can't be read. It also costs ~50 ms for import plus the first parse, and the WASM file is 750 KB |
| bash-parser 0.5 | npm | Not tried. Unmaintained since 2022, POSIX only |

**Chosen:** the hand lexer. Builtins come from zsh (`${(k)builtins}`, 103 names), handed off the
same way as `$commands` in spike 001. Builtins vary with loaded zsh modules, so don't hardcode them.

## How to Run
```
npm i                 # spike-local deps only (shell-quote, sh-syntax)
node run.mjs          # accuracy, µs/command, live classification against your $commands
node fuzz-child.mjs fuzz            # 20k random junk inputs, must print "fuzz ok"
node fuzz-child.mjs deep 2000       # pathological $( nesting cost
node find-hang.mjs    # per-input 1 s timeout harness for crafted malformed inputs
```

## What to Expect
`== hand: core 37/37, stretch 3/3`, then each sample tagged, e.g.
`⚑ exa -la --git → exa:MISSING → flag: not installed — exa`.

## Investigation Trail
1. Built 40 cases: 37 core and 3 stretch (`bash -c "…"`, `find -exec`, backticks). Wrappers count
   as programs too (`sudo`, `xargs`, `env`, `timeout`, `nice`, `watch`, `nohup`…), each with the
   options that take an argument (`sudo -u postgres psql` → sudo, psql; `timeout 5s curl` skips
   the duration).
2. First run: hand 36/37. `FOO=bar BAZ="a b" node` failed because a partly quoted assignment
   counted as a quoted word, so it was never treated as an assignment. Fixed by checking
   assignments against the literal prefix before the first quote (`tok.lead`) → 37/37.
3. shell-quote missed substitution inside double quotes. `echo "today is $(date +%A)"` is a very
   typical model output, so this alone rules it out.
4. sh-syntax returned `Cmd: { Pos, End }` and nothing else (the Go interface type is dropped
   when crossing to JS). Dead end.
5. **Fuzzing found a real hang.** An unterminated backtick inside double quotes made `indexOf`
   return −1. That set the cursor back to 0, and with an earlier `"` in the string the lexer looped
   forever. Smallest repro: `"a" "\``. Model output can be truncated or malformed, so this would
   have frozen the `??` picker. Fixed by consuming to the end of input. 4×20k random inputs plus
   30 crafted malformed inputs now pass with no throws and no hangs.
6. Pathological nesting is quadratic but bounded: 2,000 nested `$(` = 46 ms. Real candidates
   are under 200 chars (< 10 µs).
7. Live classification on this machine: `fd`, `exa`, `htop` flagged missing; `rg`, `fzf`, `gdu`,
   `lsof`, `brew` installed; `kill` correctly a builtin; `<editor>` correctly a placeholder.

## Results
**VALIDATED.** About 3.5 µs per candidate. Parsing five candidates is free compared with the
LLM call, so it can run after the response arrives without adding noticeable latency.

Signals for the build:
- Put this in `src/` as a pure function with the 40 cases as vitest fixtures. Keep the fuzz
  test (with a hard per-input timeout) in the suite, because the hang bug is exactly what
  regresses silently.
- Any `indexOf`-style scan must clamp `-1` to `s.length`. Do-not-repeat material.
- Builtins come from the widget's handoff, not a hardcoded list.
- **Open question for the build:** `brew install fd && fd -e ts` flags `fd` as missing even though
  the same command installs it. Options: label it "installed by this command" when an earlier
  segment is `brew/apt/dnf/pacman install <name>` (package name ≠ binary name is common, e.g.
  ripgrep → rg), or just accept the flag. Not decided.
- Aliases and functions aren't checked. A model rarely suggests personal aliases, but if it
  does they'd be flagged missing. Handing off `${(k)aliases}` is cheap if that becomes an issue.
