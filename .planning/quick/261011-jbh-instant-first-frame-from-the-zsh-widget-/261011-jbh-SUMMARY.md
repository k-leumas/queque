---
phase: quick-261011-jbh
plan: 01
subsystem: shell-integration, client startup, build
tags: [zsh, zle, ink, zellij, bundle, compile-cache, startup, latency]
status: complete
requires: []
provides:
  - zsh instant first frame (inline paint before Node, Zellij pane wrapper + session-dir frame file)
  - client takeover of the instant frame in Ink's first visible write (src/client/instant-frame.ts)
  - built-in-only launcher dist/cli/main.js with a per-user compile cache, plus one bundled dist/cli/app.js
  - lazy @anthropic-ai/sdk import
affects:
  - shell/zsh/queque.zsh
  - src/client/run-foreground.ts
  - tsup.config.ts
  - src/providers/claude.ts
tech-stack:
  added: []
  patterns:
    - one-shot write-stream takeover anchored on the client's own cursor save
    - launcher that enables the compile cache, then imports the bundle (runtime-computed URL)
    - esbuild aliases to local shims for optional or DEV-only imports
key-files:
  created:
    - src/client/instant-frame.ts
    - src/cli/launcher.ts
    - src/shims/react-devtools-core.ts
    - src/shims/optional-native-module.ts
    - tests/bundle-startup.test.ts
  modified:
    - shell/zsh/queque.zsh
    - src/client/run-foreground.ts
    - src/providers/claude.ts
    - tsup.config.ts
    - tests/zsh-widget.test.ts
    - tests/candidate-select-layout.test.tsx
decisions:
  - LD-1 amends D-05 only for the time before Node runs. The widget paints the instant frame; inside the client the spinner still lives in the Ink component.
  - The client takeover stays armed under QQ_INSTANT_FRAME=0. It is anchored on the client's own fresh ESC 7, so it can never restore a stale save.
  - No build-time NODE_ENV define. esbuild's default legal comments are kept, and dts stays on (the dts step works under noExternal).
  - ws's optional native add-ons (bufferutil, utf-8-validate) are aliased to a shim that throws on load. ws keeps its not-installed fallback, and the bundle resolves nothing from node_modules at runtime.
  - The bundle test reads esbuild's metafile for runtime loads. A source regex for import()/__require matched text inside a React string literal.
metrics:
  duration: ~37 min
  completed: 2026-10-11
actuals:
  tokens: 16800
  tasks: 2
  commits: 4
plan_head_before: de3783c483b9ff17e7643940533f24b0abe0b323
plan_head_after: e8e3127f80ef0668e5e6990929cd8c94f2d6008a
---

# Phase quick-261011-jbh Plan 01: Instant first frame from the zsh widget + bundled, compile-cached client Summary

The `??` modal now shows its `queque › <lbuffer>` header and `thinking…` row about 30-60 ms after the trigger in a plain terminal, and as soon as the floating pane opens in Zellij (about 0.23 s). The widget paints that frame before Node starts, and Ink's first frame replaces it in place. Node start is cheaper as well: `dist/cli/main.js` is now a launcher that imports only Node built-ins. It turns on a per-user compile cache and then loads one fully bundled `dist/cli/app.js`, and the Anthropic SDK loads lazily.

**Status: complete.** All three tasks are done. Task 3, the live check, was approved by the user on 2026-10-11: "queque shows up quickly". The remaining wait is the LLM response itself, which this task did not target.

## Tasks

| Task | Name | Commits | Status |
|------|------|---------|--------|
| 1 | Tracer: instant frame from zsh + clean Ink takeover (inline and Zellij) | 7b9284f (RED), f16212f (GREEN) | done |
| 2 | Bundle every dependency behind a compile-cache launcher, lazy SDK | 4d1a09b (RED), e8e3127 (GREEN) | done |
| 3 | Live check in a plain terminal and in Zellij | — | done (user approved 2026-10-11) |

## What was built

- **zsh widget** (shell/zsh/queque.zsh):
  - Named `typeset -g` constants (QQ_MODAL_VIEWPORT_LINES=18, QQ_MODAL_MAX_COLUMNS, QQ_MODAL_PADDING_COLUMNS, QQ_ZELLIJ_FRAME_COLUMNS, QQ_INSTANT_FRAME_ROWS_ABOVE_LOADING, QQ_INSTANT_FRAME_LOADING_TEXT, QQ_INSTANT_FRAME_FILE, QQ_PANE_PAINT_SCRIPT).
  - Four helpers, guarded like the handoff helper: `_qq_instant_frame`, `_qq_inline_instant_frame_bytes`, `_qq_paint_inline_instant_frame` and `_qq_write_pane_instant_frame`.
  - The qq lookup moved up to just after the buffer capture. The inline paint follows it, before mktemp, jq and the handoff.
  - The Zellij pane command is `/bin/sh -c "$QQ_PANE_PAINT_SCRIPT" queque-instant-frame <frame file> <qq_cmd...>`. The lbuffer never appears in argv.
  - The inline launch captures the client status. The widget clears the frame (`ESC 8` + `CSI J`) only when it painted the frame and the client exited non-zero.
  - Kill switch: `QQ_INSTANT_FRAME=0`.
- **Client takeover** (src/client/instant-frame.ts):
  - Named sequences, `INLINE_SURFACE_CLEAR` (`ESC 8` + `CSI J`) and `PANE_SURFACE_CLEAR` (`CSI H` + `CSI J`).
  - `inlineScrollReserve(lines)` is byte-identical to the widget's reserve.
  - `armInstantFrameTakeover(stream, clear)` returns `{ clearNow }`. It waits for the first write with visible text and inserts the clear after a leading `CSI ?2026 h`, or prepends it. It then reassigns the original `write`.
- **run-foreground.ts**:
  - The llm branch opens the /dev/tty streams first.
  - Inline: it writes the reserve itself and arms the takeover. Zellij: it arms the pane clear. Both happen before classify, context and render.
  - `clearNow()` runs in the inner catch and in the fetch `.catch` before `unmount(true)`.
  - clearScrollReserve writes INLINE_SURFACE_CLEAR (same bytes as before).
- **Build** (tsup.config.ts):
  - `entry: { main: src/cli/launcher.ts, app: src/cli/main.ts }` and `noExternal: [/.*/]`.
  - esbuild aliases point `react-devtools-core`, `bufferutil` and `utf-8-validate` at `src/shims/*`.
  - The banner adds a createRequire `require` for CJS deps.
  - bin, the widget path and the Homebrew symlink still point at main.js. spawnDaemon re-execs app.js.
- **Launcher** (src/cli/launcher.ts):
  - Cache dir: `${XDG_CACHE_HOME (absolute only) or ~/.cache}/queque/node-compile-cache`, created 0700.
  - The cache is enabled only when both the `queque` parent and the leaf pass an lstat check (real dir, owned by getuid, no group or world write bit). It is skipped when NODE_COMPILE_CACHE or NODE_DISABLE_COMPILE_CACHE is set.
  - Silent on any failure. It then imports `new URL('./app.js', import.meta.url).href` and awaits `main()`.
- **Lazy SDK** (src/providers/claude.ts): `import type Anthropic`. `getAnthropicClient` is async and does `await import('@anthropic-ai/sdk')`, re-checking the cache after the await. In the bundle the SDK is a lazy `init_sdk()` reached only from that call.

## Gate results

- Task 1 verify:
  - `pnpm exec vitest run tests/zsh-widget.test.ts tests/candidate-select-layout.test.tsx tests/client-result.test.ts tests/zellij-pane-resize.test.ts`: 111/111 pass. The handoff timing median was 11.48 ms with load avg about 9.
  - `pnpm typecheck` and `pnpm lint` (rc 0) pass.
  - MODAL_VIEWPORT_LINES is still 18.
  - zellij-pane-resize.ts, CandidateSelect.tsx and modal-layout.ts are unchanged since de3783c.
  - Both source greps pass. See deviation 3 about the grep form.
- Task 2 verify: the bundle, provider, daemon-fetch and direct-run tests pass (44/44). Typecheck, lint and `pnpm build` pass. `node dist/cli/main.js --help` prints the usage. The SDK, `import type` and `noExternal` greps pass.
- `pnpm test:run`: 32 files, 580/580 pass. The handoff median was 7.71 ms. No load flakes this run (load avg about 8-13).
- Tracer feedback gate (interactive mode, automated-only `<verify>`): re-run and passed, so expansion went ahead with no checkpoint.
- The final `pnpm build` ran at HEAD e8e3127, so dist/ is fresh for the live check (the dev footer reads `e8e3127`).

## TDD gate compliance

- **Task 1 RED** (commit 7b9284f):
  - Target: `tests/zsh-widget.test.ts > instant frame > z1: the frame is the header, two blank rows, then the loading row`.
  - Result: `expected 1 to be 4` (`_qq_instant_frame` did not exist yet), RED_EVIDENCE_OK.
  - Semantic check: the target ran and failed on its planned scalar assertion, with no load or fixture fault.
  - Record: `red/task1-red.json`. t1 was not used as the RED target because the throw-on-call stub makes it error rather than fail an assertion, which would be INVALID_RED.
- **Task 1 GREEN** (commit f16212f): all z1-z10 and t1-t6 pass.
- **Task 2 RED** (commit 4d1a09b):
  - Target: `statically imports only Node built-ins`.
  - Result: actual `cac, zod, @anthropic-ai/sdk, ink, react, react/jsx-runtime`, RED_EVIDENCE_OK.
  - Record: `red/task2-red.json`.
- **Task 2 GREEN** (commit e8e3127): b1-b6 pass.
- REFACTOR: none needed.

## Automated live evidence (optional; not the human check)

Scratchpad tmux harness, real `??` keystrokes, real daemon, load avg 7-13. The baseline is de3783c built in the scratchpad. All times are seconds from the trigger.

| Surface | First visible frame, de3783c | New: instant frame | New: Ink first frame |
|---|---|---|---|
| Plain terminal 100x30, full screen | 0.805 / 0.893 / 1.446 / 1.558 | 0.031 / 0.035 / 0.032 / 0.064 / 0.051 / 0.064 | 0.63 / 0.47 / 0.76 / 1.80 / 1.79 / 1.88 |
| Plain terminal, `QQ_INSTANT_FRAME=0` | — | none (no paint, as designed) | 0.795 |
| Zellij 0.44 floating pane (tmux-hosted) | 0.768 | 0.234 (pane open) | 0.671 |

- **Inline:**
  - The instant frame replaces the prompt row with ` queque › show me how to use z3`, two blank rows and ` thinking…`.
  - Ink's first frame lands on the same rows. FILTER and the controls join, the header stays on its row, there is exactly one header, and nothing scrolls again.
  - Esc after the candidates arrive brings back `% show me how to use z3` in about 0.2 s with no stray rows.
  - Enter prints the two summary lines and the command lands in the buffer.
- **Zellij:**
  - The pane opens showing the header and `thinking…`. Ink replaces them in place, with the header on row 0.
  - The list arrives and stays. Esc returns the buffer to the shell.
- **Compile cache:** `~/.cache/queque/node-compile-cache` is `drwx------` and holds a `v24.14.1-x64-…-501` dir after a run.

Two problems already exist on de3783c and were seen again here, so they are not regressions. They are logged in `deferred-items.md`:

1. Esc during `thinking…` leaves the client running, so the prompt never comes back.
2. When the candidate frame is taller than the 18-row reserve, Ink scrolls the screen and the stale save leaves the `queque ›` and `FILTER:` rows above the summary lines after Enter.

In Zellij the main pane also shows the pre-trigger line `% show me how to use z3?` above the redrawn prompt. That happens on de3783c as well.

## Deviations from plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] ws's optional native add-ons left runtime `require`s of non-built-ins in the bundle**
- **Found during:** Task 2 GREEN (b1 listed `bufferutil, utf-8-validate`).
- **Issue:** ws requires `bufferutil` and `utf-8-validate` inside try/catch. They are not installed, so esbuild left them as runtime `__require` calls that would search node_modules near the installed bundle.
- **Fix:** added `src/shims/optional-native-module.ts`, which throws on load, and aliased both names to it in tsup.config.ts. ws behaves exactly as when they are not installed, and the bundle resolves nothing from node_modules at runtime. This strengthens T-261011jbh-06.
- **Files:** src/shims/optional-native-module.ts, tsup.config.ts. **Commit:** e8e3127

**2. [Rule 1 - Bug in test] The b1 dynamic-import regex matched a string literal**
- **Found during:** Task 2 GREEN.
- **Issue:** the plan's literal `import("…")` / `__require("…")` source scan flagged `./MyComponent`. That text is inside React's lazy() error message.
- **Fix:** b1 now reads esbuild's metafile (`metafile: true` → `metafile-esm.json`), which lists every external import, dynamic import and require esbuild left. The static-import regex over each emitted file is kept as well. The single-line `toBe('')` RED assertion is unchanged.
- **Files:** tests/bundle-startup.test.ts. **Commit:** e8e3127

**3. [Rule 1 - Verify command] The plan's grep form does not work with macOS BSD grep**
- **Found during:** Task 1 verify.
- **Issue:** `grep -q '_qq_paint_inline_instant_frame "$QQ_LBUFFER"'` never matches on BSD grep, which treats the mid-pattern `$` as an anchor.
- **Fix:** checked with `grep -qF` instead, which passes. No code change.

**4. [Rule 2 - Robustness] A non-numeric Zellij pane width**
- **Found during:** Task 1 GREEN.
- **Issue:** the plan's `$(( qq_pane_width - QQ_ZELLIJ_FRAME_COLUMNS ))` would raise a zsh math error, and so fire the widget's ERR trap, if QQ_PANE_WIDTH were a percentage such as `80%`.
- **Fix:** the subtraction runs only for a positive integer width. Otherwise 0 is passed and the helper falls back to the 80-column modal width.
- **Files:** shell/zsh/queque.zsh. **Commit:** f16212f

**5. [Orchestrator constraint] Debug session file not committed**
- **Issue:** the plan's Task 2 step 8 stages `.planning/debug/modal-blank-before-loading.md` with the code.
- **Fix:** per the orchestrator, it is left for the docs commit. Its Resolution is filled in and its status is `awaiting_human_verify`.

**6. [Note] Commits on main**
- `git.base-branch --is-protected main` returns true. The orchestrator explicitly ran this plan sequentially on the main working tree, and recent quick tasks all commit on main, so the commits were made there.

### Not done (by design)
- Task 3 (human-verify) was approved on 2026-10-11. The debug session is resolved and moved to `.planning/debug/resolved/`.
- After approval:
  - fill in the debug session's Verification and set it to resolved;
  - move it to `.planning/debug/resolved/` (plain `mv`, then stage);
  - record the live results here.
- STATE.md and ROADMAP.md were not touched. The orchestrator handles the docs commit.

## Known Stubs

None. `src/shims/react-devtools-core.ts` and `src/shims/optional-native-module.ts` are deliberate build shims, documented in their headers.

## Threat Flags

None beyond the plan's threat model. The cache dir checks (T-01), the sanitising (T-02), the argv-free pane frame (T-03), the own-save clears (T-04), the silent launcher (T-05) and the shim aliases (T-06, now also covering ws's optional add-ons) are all implemented as planned.

## Uncommitted artifacts for the orchestrator's docs commit

- `.planning/debug/modal-blank-before-loading.md` (Resolution filled, status `awaiting_human_verify`)
- `.planning/quick/261011-jbh-instant-first-frame-from-the-zsh-widget-/` (PLAN.md, COVERAGE.md, this SUMMARY.md, deferred-items.md, `red/task1-red.json`, `red/task2-red.json`)
- `.wolf/anatomy.md`, `.wolf/cerebrum.md`, `.wolf/memory.md` (live-evidence learnings added after the last code commit)

## Self-Check: PASSED

- FOUND: src/client/instant-frame.ts, src/cli/launcher.ts, src/shims/react-devtools-core.ts, src/shims/optional-native-module.ts, tests/bundle-startup.test.ts, dist/cli/main.js, dist/cli/app.js
- FOUND commits: 7b9284f, f16212f, 4d1a09b, e8e3127
