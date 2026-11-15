---
title: Widen the command-words fuzz single-input timeout
created: 2026-11-14
area: tests
---

`tests/command-words-fuzz.test.ts` crafted-input cases kill the child at 1 s, which includes Node
startup and type stripping. The child takes 0.10-0.12 s idle, but in the full suite (1832 tests,
bash PTY legs since phase 11) it hit 1.02-1.07 s in every phase 11 wave gate and in three executor
runs, even at load ~7. It passes alone 36/36. Raise the budget (e.g. 3 s) or measure lexer time
inside the child, keeping the hang guard. See .wolf/buglog.json (fuzz flake entry).

## 2026-11-15 update

Same pattern under full-suite contention (load 19→67 during `pnpm test:run`): 22 fuzz single-input cases,
zsh-widget "prewarms via qq on PATH", and bash-widget b22 (`expected 3024 to be less than 2000`, its 2 s
bound) failed in one run; all 144 tests in those three files pass when run alone. b12 failed once the same
way (empty stdout). Consider widening b22's bound or running these timing tests in a serial project.
