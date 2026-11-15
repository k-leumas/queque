# Spike Conventions

Patterns and stack choices established across spike sessions. New spikes follow these unless the
question requires otherwise.

## Stack
- Node ESM scripts (`.mjs`) for pure-logic spikes. zsh scripts for anything about the live shell
  (`zmodload zsh/datetime` + `$EPOCHREALTIME` for timing).
- Spikes that need real QueQue code (prompt builder, env loading) import from `src/` as `.ts`
  and are bundled with the project's tsup into the spike's `out/` (no tsx in the repo).

- Shell-integration spikes drive a real interactive shell in a **private tmux server**
  (`tmux -L qqspike -f /dev/null`) and assert on `capture-pane` snapshots plus an event log the
  adapter appends to (`QQ_SPIKE_LOG`). `expect` is fine for buffer-only checks; tmux is needed
  once a TUI draws.
- Shells under test are built or unpacked into the session scratchpad, never installed, and run
  with no user config (`bash --noprofile --norc -i`, `fish --no-config -i`, throwaway `$HOME`).

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

- **Harnesses must unset `ZELLIJ ZELLIJ_PANE_ID ZELLIJ_SESSION_NAME`** before starting the shell
  under test: Claude Code often runs inside the user's Zellij session, and an inherited `ZELLIJ`
  makes the adapter open real floating panes there. Fake `zellij` with a shell function (checked
  with `type -t`), not PATH.
- Wait on the picker's selection marker `┌>`, not on the controls line (it shows while thinking).

## Tools & Libraries
- Shell tokenizing: the hand lexer in `002-candidate-binary-check/extract.mjs`. Avoid
  shell-quote (misses `"$(…)"` and `<(…)`) and sh-syntax 0.7 (exposes no command nodes).
