# Spike Conventions

Patterns and stack choices established across spike sessions. New spikes follow these unless the
question requires otherwise.

## Stack
- Node ESM scripts (`.mjs`) for pure-logic spikes. zsh scripts for anything about the live shell
  (`zmodload zsh/datetime` + `$EPOCHREALTIME` for timing).
- Spikes that need real QueQue code (prompt builder, env loading) import from `src/` as `.ts`
  and are bundled with the project's tsup into the spike's `out/` (no tsx in the repo).

## Structure
- `.planning/spikes/NNN-name/` with `README.md` (frontmatter + Investigation Trail + Results).
- Third-party deps go in a spike-local `package.json` with `node_modules/` gitignored, so project
  dependencies stay untouched.
- Bundled scripts write output relative to `process.cwd()` (run from the repo root), never
  `import.meta.url`, which points into `out/`.

## Patterns
- Get installed commands and builtins from zsh exactly as the widget would:
  `zsh -c 'zmodload zsh/parameter; rehash; print -rl -- ${(k)commands}'`.
- Benchmarks repeat 5× and report each run. Robustness checks run every input in a child
  process with a hard timeout, because a hang is a real finding.
- Live API spikes write results after every call and support resuming (`QUERY_START`).

## Tools & Libraries
- Shell tokenizing: the hand lexer in `002-candidate-binary-check/extract.mjs`. Avoid
  shell-quote (misses `"$(…)"` and `<(…)`) and sh-syntax 0.7 (exposes no command nodes).
