---
status: resolved
trigger: "DATA_START Intermittent distro smoke failure (scripts/smoke-distro.exp via scripts/smoke-distro.sh in CI). main 2862cde run 43703675443: smoke (ubuntu:24.04) exit 17 \"timed out waiting for the consent question\" — the picker log shows the candidate `tldr z3` render, then a redraw to \"no matches — try a different query\" with the FILTER placeholder gone, so Enter selects nothing. Branch run 43698259095 at 0f048de: smoke (ubuntu:22.04) exit 12 \"timed out waiting for the prompt redraw with the accepted command\". Same code passed on 8a72425 and 565bd65; 69e3e81 green. Auto-revert PRs #18-#28 on renovate branches also say \"smoke failed\", so it likely predates phase 11. Related: buglog G-09-7 (list shows results then dwindles to zero). Goal: find the root cause (expect timing vs picker filter/streaming refresh) and fix it so smoke is deterministic. DATA_END"
created: 2026-11-15T10:40:00Z
updated: 2026-11-15T12:10:00Z
goal: find_and_fix
symptoms_prefilled: true
---

## Symptoms

- **Expected:** every distro smoke leg passes deterministically: `??` on `list files` shows the fixture candidate `tldr z3`, Enter accepts it, the consent question appears, and the prompt redraws with the accepted command.
- **Actual:** intermittently one ubuntu leg fails. Run 43703675443 (main, 2862cde, ubuntu:24.04): the picker renders `tldr z3`, then redraws to `no matches — try a different query` with the FILTER placeholder (`type to filter…`) gone, so Enter selects nothing; expect times out (exit 17, no consent question). Run 43698259095 (spike, 0f048de, ubuntu:22.04): exit 12, timed out waiting for the prompt redraw with the accepted command.
- **Errors:** `smoke-distro.exp: timed out waiting for the consent question (exit 17)`; `smoke-distro.exp: timed out waiting for the prompt redraw with the accepted command (exit 12)`.
- **Timeline:** 69e3e81 green; 0f048de failed (22.04); 8a72425 and 565bd65 passed; 2862cde failed (24.04). Auto-revert PRs #18-#28 on renovate dependency branches also report smoke failures, so the flake likely predates phase 11.
- **Reproduction:** CI distro smoke (`scripts/smoke-distro.sh <image>`, expect script `scripts/smoke-distro.exp`, runner `scripts/smoke-distro-runner.sh`); locally `CI=true pnpm smoke:distro ubuntu:24.04` with Docker. Not deterministic; failed artifacts: `gh run download 43703675443 -n smoke-ubuntu-24.04` (pty-default.log etc.).

## Leads

- .planning/debug/modal-filter-prefilled-with-query.md (diagnosed, no fix): CandidateSelect seeds `query` from `initialQuery` (lbuffer left of `??`); a transient render filters candidates by it ("no matches"), then a reset effect clears it. Keystrokes typed during `thinking…` append to it.
- .planning/debug/empty-modal-after-tool-awareness-reenable.md (diagnosed, G-09-7): transient render filtering by `initialQuery` gives 0 rows before the reset; race-dependent.
- The failing log shows the list first rendered with `tldr z3` and FILTER placeholder, then a redraw with an empty FILTER line (no placeholder) and "no matches". Check whether expect sends keys (Enter / text) before the list is stable, or whether a late streaming update / filter state change empties the list.

## Current Focus

bug_class: Mandelbug (timing-dependent, but deterministic once the trigger condition holds:
  a tty-holding node process exiting after Ink enables raw mode)
hypothesis: CONFIRMED (see Evidence 11:10) - zsh prewarm inherits the terminal as stdin; its
  Node ResetStdio restores ZLE termios at exit, undoing Ink's raw mode.
next_action: switch to branch spike/multi-shell-trigger, write the red regression test in
  tests/zsh-widget.test.ts (`daemon prewarm` describe), then add `</dev/null` to the zsh prewarm

reasoning_checkpoint:
  hypothesis: "The zsh `_qq_prewarm_daemon` background `qq daemon --ensure` inherits the
    terminal as fd 0. Node saves each tty stdio fd's termios at startup and restores it at exit
    (atexit ResetStdio, SIGTTOU blocked, so background jobs do it too). When `??` is typed
    while the prewarm still runs, it saved ZLE's termios (icrnl inlcr, -icanon -echo) and
    restores it after Ink set raw mode, so the pty turns Enter's CR into LF; Ink names LF
    'enter' (key.return false, input '\\n') and CandidateSelect appends it to the filter."
  confirming_evidence:
    - "Forced experiment v2: tty flags 50 ms after the prewarm exit are `inlcr icrnl isig
      -icanon -echo` while Ink is mounted; smoke exits 12 with frames identical to CI."
    - "CI debug logs: both failures have the prewarm `ensure command complete` after the client
      started and before the first candidate; passing passes have it before the client."
    - "Ink 7.1.1 parse-keypress: '\\n' -> name 'enter', not 'return'; the failing frame has an
      extra blank line after `FILTER: ` (query '\\n') and no echo (ECHO off = ZLE termios)."
    - "bash adapter already runs its prewarm with </dev/null and its smoke leg never failed so."
  falsification_test: "With `</dev/null` on the zsh prewarm, the same forced experiment (exit
    handler waits for raw mode, then exits) must pass every pass; if it still shows `no
    matches`, another process restores termios and H is wrong or incomplete."
  fix_rationale: "Redirecting the prewarm's stdin from /dev/null (stdout/stderr already
    /dev/null) leaves Node no tty fd to snapshot, so its exit can never write termios. This
    removes the cause (a stale termios writer), not the symptom (Enter handling)."
  blind_spots: "Other tty-holding node processes the user starts in the background are outside
    QueQue's control. Enter pressed before Ink enables raw mode (during the instant frame) is
    translated by ZLE's ICRNL as well - a separate, pre-existing input path not exercised by
    smoke. Not tested on alpine/debian with the forced experiment (same zsh/Node mechanism)."
  candidate_causes:
    - "code: zsh prewarm missing </dev/null (confirmed)"
    - "environment: Node ResetStdio restoring termios at exit of any tty-holding process
      (runtime behavior, the mechanism)"
    - "code: CandidateSelect appending non-printable LF to the query (amplifier, not cause)"
    - "data/test: expect sending Enter while listState is 'arriving' (eliminated: CR during
      arriving accepts normally when raw mode holds - every passing run does exactly that)"
  and_gate: "yes, three conditions together: (1) prewarm still alive when `??` fires (typing
    right after the prompt), (2) it exits after Ink's setRawMode and before Enter, (3) the
    prewarm holds a tty fd. The fix removes (3), which is the only one under our control
    and sufficient to break the AND."

## Evidence

- timestamp: 2026-11-15T10:50:00Z
  checked: failed artifacts (run 43703675443 pty-consent.log, run 43698259095 pty-default.log)
  found: both show the same sequence - `tldr z3` row drawn while `thinking…` (listState
    arriving), then a redraw with `FILTER: ` and no placeholder, TWO blank lines, then
    `no matches — try a different query`. The normal layout has ONE blank line between FILTER
    and the list. No echo of the Enter keystroke appears between frames.
  implication: the query is non-empty but invisible and adds a line: query === '\n'. No echo
    means ECHO was off when the key arrived.

- timestamp: 2026-11-15T10:52:00Z
  checked: node_modules/ink 7.1.1 build/parse-keypress.js + hooks/use-input.js
  found: `\r` -> name 'return' (key.return true); `\n` -> name 'enter' (key.return false,
    'enter' not in nonAlphanumericKeys, so input = '\n'). CandidateSelect's generic branch
    `if (input && !key.ctrl && !key.meta)` appends it to the query.
  implication: Enter only fails if the pty delivers LF instead of CR, i.e. ICRNL was set on the
    tty when expect wrote `\r` - Ink's raw mode (ICRNL off) had been undone.

- timestamp: 2026-11-15T10:55:00Z
  checked: qq-debug.log of both failures
  found: 22.04 - prewarm `[daemon] command start {"ensure":true}` .168, client foreground start
    .254, prewarm `ensure command complete` .395 (exits after the client's Ink mounted), first
    candidate .505. 24.04 consent pass (shellPid 2586) - client start .817, prewarm command start
    .831, prewarm complete .864, first candidate .937. Earlier passing passes in the same 24.04
    run: prewarm complete (.117) BEFORE the client started (.133).
  implication: failing runs are exactly those where the prewarm node process exits after Ink
    enabled raw mode and before expect sends Enter.

- timestamp: 2026-11-15T10:57:00Z
  checked: shell/zsh/queque.zsh `_qq_prewarm_daemon` vs shell/bash/queque.bash
  found: zsh runs `( qq daemon --ensure ) >/dev/null 2>&1 &!` - stdin NOT redirected, so fd 0 is
    the terminal (interactive zsh keeps tty stdin for background jobs). bash runs
    `{ ...; } </dev/null >/dev/null 2>&1 &`. Daemon bootstrap spawns the daemon with
    stdio 'ignore' (src/daemon/bootstrap.ts:316), so only the prewarm itself holds the tty.
  implication: differential - only the zsh path has a short-lived node process holding the tty;
    the bash smoke leg never showed this failure.

- timestamp: 2026-11-15T11:05:00Z
  checked: first forced experiment (scratchpad exp/, NODE_OPTIONS --require delay.cjs that waited
    for raw mode BEFORE the ensure ran; unfixed tarball, ubuntu:24.04)
  found: rc=0 - the ensure still needed ~200 ms to load the CLI after raw mode, so it exited after
    the client had already accepted (`wrote llm result` .918, prewarm exit .987).
  implication: the experiment did not force the interleaving (not evidence against H); moved the
    wait into the prewarm's 'exit' handler, which runs before Node's atexit ResetStdio.

- timestamp: 2026-11-15T11:10:00Z
  checked: forced experiment v2 (wait for `-icrnl` in the prewarm's 'exit' handler, then exit;
    unfixed tarball, ubuntu:24.04, otherwise the real runner/expect/product)
  found: rc=12 `timed out waiting for the prompt redraw with the accepted command`. Probe log:
    prewarm `isatty fd0=true fd1=false fd2=false`; raw observed .625; 50 ms after the prewarm exit
    the tty is `inlcr icrnl isig -icanon -echo` (ZLE's termios, while Ink is still mounted and
    expects raw `-icrnl -isig`); first candidate .747; pty-default.log frames identical to CI:
    `FILTER: ` without placeholder, two blank lines, `no matches — try a different query`.
  implication: CONFIRMED - the prewarm node process restores ZLE's termios at exit, undoing Ink's
    raw mode; Enter then arrives as LF and becomes the filter text.

- timestamp: 2026-11-15T11:12:00Z
  checked: zsh -fi with the adapter sourced, stdin a pipe holding `SHELL-STDIN-BYTES`, fake `qq`
    that copies its stdin to a file
  found: the prewarm's stdin file holds `SHELL-STDIN-BYTES` (args `daemon --ensure`).
  implication: a unit-level observable for the defect: the prewarm inherits the shell's stdin
    (the terminal in real use). Basis for the regression test.

## Eliminated

- hypothesis: expect sends Enter too early (list still 'arriving') and the picker drops it
  evidence: every passing run sends Enter at the same point (after `tldr z3`, with `thinking…`
    still shown) and accepts; the failing query is '\n' (LF), which only appears when the
    tty's ICRNL is on, i.e. raw mode was undone - not a CandidateSelect state race.
  timestamp: 2026-11-15T11:12:00Z

- hypothesis: transient `initialQuery` filter render (G-09-7 / modal-filter-prefilled leads)
  evidence: G-09.1-5 removed initialQuery from the filter (query state starts ''); the failing
    frames show the placeholder first and an invisible multi-line query afterwards, not the
    lbuffer `list files`.
  timestamp: 2026-11-15T11:12:00Z

## Resolution

root_cause: zsh `_qq_prewarm_daemon` ran `qq daemon --ensure` in the background with the terminal as stdin; Node restores the termios it saw at startup when it exits, so a prewarm exiting after Ink set raw mode put ZLE's icrnl back and Enter arrived as LF (Ink key 'enter', appended to FILTER).
fix: `shell/zsh/queque.zsh` prewarm subshell `) </dev/null >/dev/null 2>&1 &!` (matches bash); regression test `daemon prewarm > runs the background ensure with stdin from /dev/null, never the shell stdin` in tests/zsh-widget.test.ts; rule added to shell/README.md; bug-553.
verification:
  - regression test fails without the fix (prewarm read `SHELL-STDIN-BYTES`), passes with it
  - full suite on a pty 1875/1875; typecheck, biome, `zsh -n` clean
  - local Docker smoke: ubuntu:24.04 PASS x3, ubuntu:22.04 PASS x2
files_changed: [shell/zsh/queque.zsh, tests/zsh-widget.test.ts, shell/README.md]
