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
