---
phase: 11-multi-shell-trigger-support-bash-and-fish
plan: 06
subsystem: shell-integration
tags: [bash, zsh, instant-frame, parity-test, ink, vitest, shellcheck]

requires:
  - phase: 11-01
    provides: "shell/bash/queque.bash (_qq_question, QQ_ORIG_LBUFFER), tests/helpers/shells.ts (findShell, ciRequired), tests/bash-widget.test.ts b1-b7, the PTY harness"
provides:
  - "src/shared/instant-frame-spec.ts: INSTANT_FRAME_SPEC, INSTANT_FRAME_LOADING_TEXT, INSTANT_FRAME_VIEWPORT_LINES, MODAL_MAX_COLUMNS, the escape constants, inlineScrollReserve, and the oracle functions instantFrameRows / inlineInstantFrameBytes / paneInstantFrameBytes"
  - "tests/instant-frame-parity.test.ts: ADAPTERS (zsh, bash) x FIXTURES byte parity, oracle unit cases, a src/shared layering guard"
  - "shell/bash/queque.bash: fork-free _qq_instant_frame, _qq_inline_instant_frame_bytes, _qq_paint_inline_instant_frame, _qq_write_pane_instant_frame, _qq_clear_instant_frame; constants with the zsh names; QQ_INSTANT_FRAME=0 kill switch"
  - "tests/bash-widget.test.ts b8 (placement) and b9 (kill switch, no tty, pane file, clears)"
affects: [11-07, 11-10, 11-11, phase-12-fish]

actuals:
  tokens: 15200
  tasks: 2
  commits: 4
plan_head_before: b08c7618978639108ba32e175926cfbdcfcba528
plan_head_after: 109cbd2bfc5b09d1e6690cf1181eb4c0fd0ace31

tech-stack:
  added: []
  patterns:
    - "TS oracle + native fork-free painter per adapter + one parity test that runs every adapter against the oracle (D-04); a new shell adds a row to ADAPTERS"
    - "Parity harness writes each REPLY and the pane file into a temp dir and compares hex of the bytes; never stdout (interactive bash prints readline noise)"
    - "src/shared owns constants that client and ui re-export or read; a static test forbids src/shared importing client/ui/cli/daemon"
    - "bash: `local LC_ALL=C.UTF-8 2>/dev/null` (then en_US.UTF-8) for character counting; restored on return, silent when missing"

key-files:
  created:
    - src/shared/instant-frame-spec.ts
    - tests/instant-frame-parity.test.ts
    - .planning/phases/11-multi-shell-trigger-support-bash-and-fish/.red/11-06-task1-red.json
    - .planning/phases/11-multi-shell-trigger-support-bash-and-fish/.red/11-06-task2-red.json
  modified:
    - src/client/instant-frame.ts
    - src/ui/modal-layout.ts
    - src/ui/LoadingSpinner.tsx
    - src/ui/CandidateSelect.tsx
    - shell/bash/queque.bash
    - tests/bash-widget.test.ts

key-decisions:
  - "The escape constants, inlineScrollReserve and the viewport line count moved into src/shared/instant-frame-spec.ts; src/client/instant-frame.ts re-exports them, so run-foreground.ts and the tests import unchanged"
  - "bash clears a painted frame through one helper, _qq_clear_instant_frame, on three early stops: failed mktemp, failed request.json write (zsh has no such check) and a non-zero client exit"
  - "bash columns parse: ^0*([1-9][0-9]{0,2})$ then <= 80, so leading zeros match zsh's <1-> and a 20-digit value cannot overflow bash arithmetic"
  - "_qq_write_pane_instant_frame returns at once for an empty or missing dir, so an empty dir argument can never write /instant-frame.txt"

patterns-established:
  - "Instant frame changes go in three places at once (spec, zsh, bash); tests/instant-frame-parity.test.ts fails on any byte drift"
  - "tests/bash-widget.test.ts ids continue at b10 (plan 07)"

requirements-completed: [BASH-01]

coverage:
  - id: D1
    description: "One TS reference for the instant frame that the Ink UI reads (viewport lines, max width, first loading frame); no rendered byte changed"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/instant-frame-parity.test.ts#instant frame reference (8 cases) + layering guard"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run tests/zsh-widget.test.ts tests/candidate-select.test.tsx tests/candidate-select-layout.test.tsx tests/modal-layout.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "zsh and bash frame rows, inline bytes and pane file are byte-identical to the reference over 23 fixtures (C0, ESC/CSI/BEL, TAB/NL/DEL, C1, shell metacharacters, 200xa at 11 column values, 200xe-acute under LC_ALL=C, emoji), plus the adapter constants"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "CI=true QQ_TEST_BASH=/opt/local/bin/bash pnpm exec vitest run tests/instant-frame-parity.test.ts (57 passed, 0 skipped)"
        status: pass
    human_judgment: false
  - id: D3
    description: "bash paints before mktemp and Node (outside Zellij), clears after a failed mktemp, a failed request write or a non-zero client exit, paints nothing without a terminal or with QQ_INSTANT_FRAME=0"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/bash-widget.test.ts b8, b9 (7 cases)"
        status: pass
      - kind: e2e
        ref: "CI=true pnpm exec vitest run tests/shell-pty.test.ts (18 passed with the painter live in a real PTY)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The frame looks right on screen in a real bash terminal (header, blank rows, thinking..., then Ink takes over without leftovers)"
    verification: []
    human_judgment: true
    rationale: "Byte parity proves the bytes, not what a terminal draws; 11-11 UAT step 2 checks the frame on screen (macOS Homebrew bash, inline and Zellij)"

duration: 20min
completed: 2026-11-14
status: complete
---

# Phase 11 Plan 06: Instant frame spec and bash painter Summary

**A shared TypeScript reference for the `queque › <query>` / `thinking…` instant frame, read by the Ink UI and enforced on zsh and bash by a byte-parity test, plus bash's native fork-free painter placed before mktemp and Node**

## Performance

- **Duration:** 20 min
- **Started:** 2026-11-14T13:06:27Z
- **Completed:** 2026-11-14T13:26:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 10 (4 created, 6 modified)

## Accomplishments

- `src/shared/instant-frame-spec.ts` is the single TS reference. It owns `SAVE_CURSOR`, `RESTORE_CURSOR`, `ERASE_BELOW`, `CURSOR_HOME`, `inlineScrollReserve` and `INSTANT_FRAME_VIEWPORT_LINES` (moved from the client and the UI with their docs), adds `INSTANT_FRAME_SPEC`, `INSTANT_FRAME_LOADING_TEXT`, `MODAL_MAX_COLUMNS`, and the three oracle functions. It imports nothing.
- The UI reads it: `MODAL_VIEWPORT_LINES = INSTANT_FRAME_VIEWPORT_LINES`, `LoadingSpinner` `FRAMES[0] = INSTANT_FRAME_LOADING_TEXT`, `CandidateSelect` `MODAL_MAX_WIDTH = MODAL_MAX_COLUMNS`. `src/client/instant-frame.ts` re-exports the moved names. No exported value and no rendered byte changed (all UI tests pass unchanged).
- `tests/instant-frame-parity.test.ts` runs zsh 5.9 and bash 5.3 over 23 fixtures and compares the rows REPLY, the inline REPLY and `instant-frame.txt` with the oracle as hex. It also checks the adapters' constants against `INSTANT_FRAME_SPEC` and that no `src/shared/*.ts` imports client/ui/cli/daemon.
- `shell/bash/queque.bash` gained the constant block (zsh names) and native ports of the four frame functions plus `_qq_clear_instant_frame`. `_qq_question` paints `$QQ_ORIG_LBUFFER` after the qq lookup and before mktemp when `ZELLIJ` is empty.

## Task Commits

1. **Task 1: one TS reference, used by the UI, checked against zsh**: RED `b415fa5` (test), GREEN `5b8c4e1` (feat)
2. **Task 2: bash paints the same frame before Node starts**: RED `b916274` (test), GREEN `109cbd2` (feat)

**Plan metadata:** the SUMMARY commit (docs)

## Files Created/Modified

- `src/shared/instant-frame-spec.ts`: the reference (constants + oracle)
- `src/client/instant-frame.ts`: re-exports the moved names; the doc names the parity test as the drift guard
- `src/ui/modal-layout.ts`, `src/ui/LoadingSpinner.tsx`, `src/ui/CandidateSelect.tsx`: constants from the spec
- `tests/instant-frame-parity.test.ts`: oracle cases, layering guard, `ADAPTERS` x `FIXTURES`
- `shell/bash/queque.bash`: the instant frame section and its placement in `_qq_question`
- `tests/bash-widget.test.ts`: b8, b9
- `.red/11-06-task1-red.json`, `.red/11-06-task2-red.json`: RED evidence records

## Output Notes Requested by the Plan

- **Fixtures where zsh and bash differed before the fix:** none. Both adapters matched the oracle on every row on the first GREEN run, including the C1 row (`U+0085`, `U+009B`, `U+0080`, `U+009F`) and 200×`é` under `LC_ALL=C`. Two shell behaviours were checked by hand before writing the port: bash's `local LC_ALL=C.UTF-8 2>/dev/null` switches character counting inside the function, is restored on return, and prints nothing when the locale is missing; macOS bash's `[[:cntrl:]]` strips C0, DEL and C1 but not U+2028 (Pitfall 12: that is why the fixtures stay at C0, DEL, ESC and C1; glibc treats U+2028 as cntrl, the oracle's `\p{Cc}` does not).
- **Byte parity does not replace the visual check.** It proves both shells emit the reference bytes. It does not prove a terminal draws them well, or that Ink's takeover leaves no residue in bash. 11-11's UAT confirms the frame on screen (macOS bash, inline and Zellij).
- **Versions used:** bash 5.3 (`/opt/local/bin/bash`, MacPorts, via `QQ_TEST_BASH`), zsh 5.9, shellcheck clean.

## TDD Gate Compliance

- **Task 1 RED** `b415fa5`: target `tests/instant-frame-parity.test.ts > instant frame reference (src/shared/instant-frame-spec.ts) > matches the zsh z1 frame: header, two blank rows, loading row`, run with `pnpm --silent exec vitest run tests/instant-frame-parity.test.ts -t "matches the zsh z1 frame" --reporter=tap-flat` (exit 1). `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`).
  - **Semantic assessment:** the target executed and failed because the oracle function was a throw-on-call stub (cerebrum 2026-08-26, so tsc passes in pre-commit). That is a missing implementation, not a load, syntax or fixture fault. 30 of 33 cases failed this way. The 3 that passed in RED are the layering guard, the zsh constants check and the UI-constant equality, which were true before any change. They are guards, not new behaviour.
- **Task 1 GREEN** `5b8c4e1`: 33/33 parity cases plus zsh-widget and both candidate-select suites (183 tests) pass.
- **Task 2 RED** `b916274`: target `tests/instant-frame-parity.test.ts > 'bash' adapter matches the reference > shell/bash/queque.bash > 'ascii'` (exit 1, `RED_EVIDENCE_OK`).
  - **Semantic assessment:** bash 5.3 sourced the adapter, the script exited 0, and the planned byte comparison failed (`expected '' to be '201b5b…'`) because the bash frame functions did not exist yet. All 24 bash parity rows and 7 b8/b9 cases failed for that reason.
- **Task 2 GREEN** `109cbd2`: 77/77 across parity and bash-widget; the PTY harness 18/18.
- **REFACTOR:** none needed.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] A third clear path: request.json write failure**
- **Found during:** Task 2
- **Issue:** the plan mirrors zsh's two clears (mktemp failure, non-zero client exit). In bash, a failed `jq -n` request write after the paint also returns without starting the client, which would leave the frame on screen. zsh has no such check.
- **Fix:** one `_qq_clear_instant_frame` helper (prints `ESC 8 CSI J` only when `QQ_INSTANT_FRAME_PAINTED == 1`, then resets it), called on all three early stops. b8 was refined in GREEN to pin the helper and its three call sites instead of counting two inline `printf`s. The RED version of b8 asserted the two-printf shape.
- **Files modified:** `shell/bash/queque.bash`, `tests/bash-widget.test.ts`
- **Committed in:** `109cbd2`

**2. [Rule 2 - Missing critical] Pane writer guards an empty or missing dir**
- **Issue:** with an empty first argument, `"$dir/instant-frame.txt"` would be `/instant-frame.txt`.
- **Fix:** return 0 at once unless `$dir` is a directory. Same bytes for every valid call.
- **Committed in:** `109cbd2`

**3. [Rule 3 - Blocking] shellcheck SC2034 on constants that only plan 07 reads**
- **Issue:** `QQ_ZELLIJ_FRAME_COLUMNS` and `QQ_PANE_PAINT_SCRIPT` are unused until the Zellij path lands (plan 07), so shellcheck failed the verify.
- **Fix:** targeted `# shellcheck disable=SC2034` directives with the reason (the Zellij path and the parity test read them).
- **Committed in:** `109cbd2`

**4. [Rule 1 - Bug] The b9 trigger cases got a describe timeout**
- **Issue:** the first combined run of parity + bash-widget had one b9 failure (`a failed mktemp after a paint …`). It did not reproduce in 9 later runs. Each trigger case runs jq, mktemp and a fake client in `bash -i` (about 0.7 to 1.3 s), which is close to vitest's 5 s default under parallel load.
- **Fix:** `{ timeout: 20_000 }` on the b9 describe (passed through describe options, cerebrum 2026-11-14).
- **Committed in:** `109cbd2`

---

**Total deviations:** 4 auto-fixed (2 missing critical, 1 blocking, 1 bug). **Impact:** all keep the plan's contract; the frame bytes and the placement are unchanged.

## Issues Encountered

- **Pre-existing flake, out of scope:** in the full `pnpm test:run`, `tests/zsh-widget.test.ts > daemon prewarm > prewarms via qq on PATH when QQ_DEV_ROOT is unset` failed once (1 of 1605). It passed 3 of 3 runs alone. It polls 2.5 s for a backgrounded prewarm, so it is timing-bound under suite load. That file belongs to plan 11-02 this wave, and this plan does not touch zsh, so it was not changed. Recorded here rather than in `deferred-items.md`, to avoid a merge conflict with the parallel siblings.
- **Merge note for the orchestrator:** the layering guard scans every `src/shared/*.ts`. Plan 11-04 adds `src/shared/shell-registry.ts`. If that file imports from `../cli/` or `../client/`, this test fails after the merge, and that is the guard doing its job.

## Known Stubs

None. The RED stubs in `instant-frame-spec.ts` were replaced in `5b8c4e1`.

## Verification

- `CI=true QQ_TEST_BASH=/opt/local/bin/bash pnpm exec vitest run tests/instant-frame-parity.test.ts tests/bash-widget.test.ts tests/shell-pty.test.ts`: 95 passed, 0 skipped
- `pnpm typecheck`: clean. `pnpm lint`: 164 files, clean. `shellcheck -s bash shell/bash/queque.bash`: clean
- `pnpm test:run`: 1604 passed, 1 failed (the pre-existing zsh prewarm flake above)
- All Task 1 and Task 2 acceptance greps pass (`_qq_inline_instant_frame_bytes` ×3, `_qq_write_pane_instant_frame` ×3, `QQ_MODAL_VIEWPORT_LINES=18` ×1, `_qq_paint_inline_instant_frame "$QQ_ORIG_LBUFFER"` ×1, `patsub_replacement` ×1, `it('b8|9` ×7, `shell: 'bash'` ×1; the spec greps and the anchored upward-import grep = 0)

## User Setup Required

None.

## Next Phase Readiness

- Plan 07 can use `_qq_write_pane_instant_frame "$tmpdir" "$QQ_ORIG_LBUFFER" "$qq_frame_columns"` and `QQ_PANE_PAINT_SCRIPT` for the Zellij path (the constants are in place; drop the SC2034 disables once they are read). bash-widget ids continue at b10.
- Phase 12 adds a fish row to `ADAPTERS`.

## Wolf entries

Not committed from the worktree; for the orchestrator to apply.

**anatomy.md**
- `src/shared/instant-frame-spec.ts`: D-04 instant-frame reference. Escape constants, `inlineScrollReserve`, `INSTANT_FRAME_VIEWPORT_LINES` (18), `INSTANT_FRAME_LOADING_TEXT`, `MODAL_MAX_COLUMNS`, `INSTANT_FRAME_SPEC`, oracle `instantFrameRows` / `inlineInstantFrameBytes` / `paneInstantFrameBytes`. Imports nothing. (~1500 tok)
- `tests/instant-frame-parity.test.ts`: oracle cases, src/shared layering guard, `ADAPTERS` (zsh, bash) x 23 `FIXTURES` byte parity via temp files + hex. (~2800 tok)
- Update `src/client/instant-frame.ts`: escape constants and `inlineScrollReserve` are now re-exported from the spec.
- Update `src/ui/modal-layout.ts`, `LoadingSpinner.tsx`, `CandidateSelect.tsx`: viewport lines, FRAMES[0] and max width come from the spec.
- Update `shell/bash/queque.bash`: + instant frame section (constants, 4 frame functions, `_qq_clear_instant_frame`), paint before mktemp.
- Update `tests/bash-widget.test.ts`: + b8 placement, b9 frame cases.

**cerebrum.md, Key Learnings**
- [2026-11-14] Instant frame (D-04): change `src/shared/instant-frame-spec.ts`, `shell/zsh/queque.zsh` and `shell/bash/queque.bash` together. `tests/instant-frame-parity.test.ts` fails on any byte drift; fish adds an `ADAPTERS` row in Phase 12.
- [2026-11-14] bash: `local LC_ALL=C.UTF-8 2>/dev/null` inside a function switches `${#var}` and `${var:o:n}` to characters, is restored on return, and is silent when the locale is missing. A `$'\u0085'` literal parsed under LC_ALL=C stays as the literal text `\u0085` (pass test bytes through argv instead).
- [2026-11-14] macOS bash/zsh `[[:cntrl:]]` in UTF-8 strips C0, DEL and C1 but not U+2028; glibc also strips U+2028/2029. Keep cross-shell control-character fixtures to C0, DEL, ESC and C1.
- [2026-11-14] src/shared must not import from client/ui/cli/daemon (static guard in tests/instant-frame-parity.test.ts). Move shared constants down and re-export them from the upper module.

**cerebrum.md, Do-Not-Repeat**
- [2026-11-14] `bash -i -c` helper cases that run the whole `_qq_question` path (jq, mktemp, a fake client) take about 1 s each. Give their describe a timeout (`{ timeout: 20_000 }`), or they flake at vitest's 5 s default under parallel load.

**buglog.json**
- shellcheck SC2034 on `QQ_ZELLIJ_FRAME_COLUMNS` / `QQ_PANE_PAINT_SCRIPT` (read only by plan 07's Zellij path). Fix: targeted disable with a reason. Tags: shellcheck, bash, sc2034.
- One non-reproducible b9 failure (`a failed mktemp after a paint …`) in a combined parallel run. Likely the 5 s default timeout. Fix: a describe timeout. Tags: vitest, flaky, timeout, bash.
- `tests/zsh-widget.test.ts` "prewarms via qq on PATH when QQ_DEV_ROOT is unset" failed once in the full suite and passes alone (a 2.5 s poll for a background prewarm). Not fixed (plan 02 owns the file). Tags: flaky, zsh, prewarm, timing.

## Self-Check: PASSED

- FOUND: src/shared/instant-frame-spec.ts, tests/instant-frame-parity.test.ts, .red/11-06-task1-red.json, .red/11-06-task2-red.json
- FOUND commits: b415fa5, 5b8c4e1, b916274, 109cbd2 (all ancestors of HEAD, all subjects carry `(11-06)`)

---
*Phase: 11-multi-shell-trigger-support-bash-and-fish*
*Completed: 2026-11-14*
