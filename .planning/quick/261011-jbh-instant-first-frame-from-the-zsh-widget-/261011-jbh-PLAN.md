---
phase: quick-261011-jbh
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - shell/zsh/queque.zsh
  - src/client/instant-frame.ts
  - src/client/run-foreground.ts
  - tests/zsh-widget.test.ts
  - tests/candidate-select-layout.test.tsx
  - tsup.config.ts
  - src/cli/launcher.ts
  - src/shims/react-devtools-core.ts
  - src/providers/claude.ts
  - tests/bundle-startup.test.ts
  - .planning/debug/modal-blank-before-loading.md
  - .wolf/anatomy.md
  - .wolf/cerebrum.md
  - .wolf/buglog.json
  - .wolf/memory.md
autonomous: false
requirements: [quick-261011-jbh]

estimate:
  tokens: 80000
  raw_tokens: 80000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Plain terminal (LD-1): the moment `??` fires, the widget itself paints the instant frame (` queque › <lbuffer>` with control characters stripped and truncated to the modal content width, plus ` thinking…` on the row Ink's LoadingSpinner uses) into the inline modal area before Node starts. The paint runs right after the qq lookup, before mktemp, jq and the tool handoff. It reserves the same MODAL_VIEWPORT_LINES rows the client reserves, so the client's own reserve moves nothing"
    - "Zellij (LD-1): the floating pane shows the same instant frame as soon as it opens. The pane command is `/bin/sh -c` that cats `<session dir>/instant-frame.txt` and then execs the unchanged qq client argv. The lbuffer never appears in the zellij or sh argv, only the path of a file in the 0700 session dir"
    - "Takeover (LD-1): before render(), the client arms a one-shot takeover on its /dev/tty write stream. Ink's first write that carries visible text gets the surface clear inserted (after a leading synchronized-update begin, if there is one): inline restores the client's own just-saved reserve top and erases below; Zellij homes the cursor and erases below. Replaying the real widget bytes, the real client reserve and the real Ink writes shows the header exactly once, on the instant frame's header row, the loading text on the same row as before, no surviving instant-frame row, rows above the modal untouched, and no scroll beyond the reserve"
    - "Exit paths stay clean (LD-1): accept and cancel are unchanged (clearScrollReserve). Client paths that end before Ink's first frame clear the instant frame with clearNow(). The widget clears it only when it painted it and the client exited non-zero. No restore-cursor sequence ever targets a cursor save that the widget or the client did not just make"
    - "Contracts kept (LD-1): both paths still apply the shell result through _qq_apply_result_str, and it stays insertion-only. Every new zsh helper returns 0 and writes nothing to stderr (the ERR-trap guard). QQ_TOOL_AWARENESS=0 is unchanged. _qq_write_tool_handoff is untouched and its < 25 ms median guard stays green. The widget still has zero tty-device redirects. QQ_INSTANT_FRAME=0 makes the widget paint nothing and launch exactly the previous commands"
    - "Bundle (LD-2): dist/cli/main.js is a launcher that imports only Node built-ins. It enables Node's module compile cache in a per-user directory (`${XDG_CACHE_HOME:-~/.cache}/queque/node-compile-cache`, mode 0700, owner and permission checked, silent on any failure), then dynamically loads dist/cli/app.js, one bundle with every dependency inlined. Every emitted .js statically imports only Node built-ins. Both files run `--help` with no node_modules. The cache dir has content after a run, and an unwritable or world-writable cache location changes nothing visible"
    - "Deferred SDK (LD-2): @anthropic-ai/sdk is loaded lazily inside getAnthropicClient, with a type-only static import, so the client's path to its first frame never evaluates the SDK. The daemon still keeps one cached SDK client"
    - "No regression: the G-09-7, 261011-e43 and 261011-f9o real-Ink tests, zellij-pane-resize, client-result and the full suite stay green. package.json bin, the widget's dist/cli/main.js path and the Homebrew symlink target are unchanged"
  artifacts:
    - path: "shell/zsh/queque.zsh"
      provides: "_qq_instant_frame, _qq_inline_instant_frame_bytes, _qq_paint_inline_instant_frame, _qq_write_pane_instant_frame, QQ_PANE_PAINT_SCRIPT, the QQ_INSTANT_FRAME=0 switch, the qq lookup moved before mktemp, the inline paint before mktemp, the Zellij pane_cmd wrapper, and the inline non-zero-exit clear"
      contains: "_qq_inline_instant_frame_bytes"
    - path: "src/client/instant-frame.ts"
      provides: "INLINE_SURFACE_CLEAR, PANE_SURFACE_CLEAR, SYNC_UPDATE_BEGIN, inlineScrollReserve(lines), armInstantFrameTakeover(stream, clear) -> { clearNow }"
      contains: "armInstantFrameTakeover"
    - path: "src/client/run-foreground.ts"
      provides: "TTY streams, reserve and takeover armed at the start of the llm branch; clearNow() in the pre-frame failure paths; clearScrollReserve uses INLINE_SURFACE_CLEAR"
      contains: "armInstantFrameTakeover"
    - path: "tests/candidate-select-layout.test.tsx"
      provides: "replayScreen with ESC 7 / ESC 8, and the 'instant frame takeover' cases (inline full screen, inline cleared screen, Zellij pane, long lbuffer, no instant frame, takeover unit cases)"
      contains: "armInstantFrameTakeover"
    - path: "tests/zsh-widget.test.ts"
      provides: "'instant frame' cases: rows, sanitising, truncation, inline bytes == inlineScrollReserve prefix, kill switch, ERR-trap safety, pane file and wrapper, static placement"
      contains: "_qq_instant_frame"
    - path: "tsup.config.ts"
      provides: "entry { main: launcher, app: main.ts }, noExternal all, react-devtools-core alias to the shim, createRequire banner"
      contains: "noExternal"
    - path: "src/cli/launcher.ts"
      provides: "per-user compile cache (fail safe), then a dynamic import of ./app.js and main()"
      contains: "enableCompileCache"
    - path: "src/shims/react-devtools-core.ts"
      provides: "No-op default export for ink's optional devtools import"
    - path: "src/providers/claude.ts"
      provides: "Lazy SDK import inside getAnthropicClient (async), cache re-checked after the await"
      contains: "import('@anthropic-ai/sdk')"
    - path: "tests/bundle-startup.test.ts"
      provides: "Built-in-only static imports for every emitted file; --help of main.js and app.js with no node_modules; compile cache populated, unwritable and world-writable cache locations fail safe"
      contains: "node-compile-cache"
  key_links:
    - from: "shell/zsh/queque.zsh _qq_inline_instant_frame_bytes"
      to: "src/client/instant-frame.ts inlineScrollReserve(MODAL_VIEWPORT_LINES)"
      via: "byte-identical reserve prefix, so the client's reserve is a no-op after the widget's; tests/zsh-widget.test.ts asserts the prefix"
      pattern: "inlineScrollReserve\\(MODAL_VIEWPORT_LINES\\)"
    - from: "src/client/run-foreground.ts"
      to: "Ink render() stdout"
      via: "armInstantFrameTakeover(ttyWriteStream, inZellij ? PANE_SURFACE_CLEAR : INLINE_SURFACE_CLEAR) before render()"
      pattern: "armInstantFrameTakeover\\("
    - from: "shell/zsh/queque.zsh Zellij branch"
      to: "zellij run floating pane"
      via: "pane_cmd = /bin/sh -c QQ_PANE_PAINT_SCRIPT <frame file> qq_cmd..., then client --request-file ... --result-file ..."
      pattern: "pane_cmd"
    - from: "src/cli/launcher.ts (dist/cli/main.js)"
      to: "src/cli/main.ts (dist/cli/app.js)"
      via: "enableCompileCache before a dynamic import of new URL('./app.js', import.meta.url), then main()"
      pattern: "app\\.js"
    - from: "src/daemon/bootstrap.ts spawnDaemon (unchanged)"
      to: "dist/cli/app.js"
      via: "fileURLToPath(import.meta.url) now names app.js; its isDirectRun check runs main() (bundle test runs app.js --help)"
      pattern: "import\\.meta\\.url"
---

<objective>
The `??` modal shows something the moment it opens, and the Node client reaches its real first frame sooner.

**Locked user decisions (implement both, no substitutions):**
- **LD-1 Instant first frame from zsh.** As soon as `??` fires, the ZLE widget paints the `queque › <lbuffer>` header and a loading line into the modal surface before Node starts. That surface is the inline area in a plain terminal and the floating pane in Zellij. The Node/Ink client then takes over the same surface cleanly: no duplicated header, no stale instant-frame lines, no flicker beyond the handoff, and no shell prompt corruption on Esc or accept. The shell-result contract, the kill switches, the widget's ERR-trap guards and the handoff timing guard (median < 25 ms under `zsh -f`) must hold. Ink's first frame must clear the instant frame's rows.
- **LD-2 Faster Node start.** Bundle every dependency into the client (tsup noExternal, so only Node built-ins are statically imported). Enable Node's module compile cache in a per-user directory, failing safe when it can't be written. Defer heavy modules that the first frame does not need (@anthropic-ai/sdk). This is cheap here: getAnthropicClient has one caller, in the same file.

**Prior evidence** (.planning/debug/modal-blank-before-loading.md): 85–90 % of time-to-first-frame is Node boot plus loading the static module graph. Bundling cut `--help` CPU from 3.0 s to 1.3 s and the real client's first frame from 3.6–5.2 s to 1.45–2.5 s. Bundling gotchas: `react-devtools-core` needs an alias to a shim, and CJS deps inside an ESM bundle need a createRequire banner. A compile cache does nothing for the unbundled dist.

**Design decisions made in this plan (Claude's discretion, documented):**
1. **Inline surface anchor = a fresh cursor save, never a stale one.** The widget paints with: the reserve (`\n` × 18, `CSI 18 A`, `\r`), `ESC 7`, `CSI J`, the frame rows, then `ESC 8`. The cursor ends at the reserve top. The client now writes the same reserve as the first thing in its llm branch (`inlineScrollReserve`, byte-identical, so it moves nothing) and saves the cursor again on the same cell. Every clear the client emits (`ESC 8` + `CSI J`) therefore targets the client's own save, so even with an older widget or `QQ_INSTANT_FRAME=0` it can never restore a stale saved position and erase the user's screen. The widget's own clear is used only when the widget painted the frame and the client exited non-zero (a crash before or after Ink).
2. **Clear in the same write as Ink's first frame.** Ink's log-update erases only the rows of its own previous frame. Ink hides the cursor in a separate, control-only write before the first frame, and draws frames inside a `CSI ?2026 h/l` pair. So the takeover waits for the first chunk that has visible text and inserts the clear right after a leading `CSI ?2026 h` (or prepends it). The clear and the frame land as one atomic update. The instant frame's text does not need to match Ink's pixel for pixel, because any residue is erased.
3. **Zellij paint via a session-dir file, not argv.** The widget can't write into the floating pane, so the pane command is a tiny `/bin/sh` wrapper that cats the frame file and then execs the client. The lbuffer stays out of process listings and out of Zellij's session serialisation. The frame ends with `CSI H` and the client's pane clear is `CSI H` + `CSI J`, both absolute and safe on a fresh pane.
4. **Instant frame layout mirrors Ink's loading frame rows.** Row 0 is the header (only when lbuffer is non-empty, as in CandidateSelect). The loading text sits two rows lower (the FILTER row plus the content marginTop). One-column padding, SGR 2/22 dim. The takeover then only adds rows (FILTER, controls). The header and loading text don't move.
5. **Compile cache needs a launcher.** The cache only covers modules compiled after it is enabled, and a single-file bundle is compiled before any of its code runs. So `dist/cli/main.js` becomes a tiny launcher: tsup entry `main: src/cli/launcher.ts`. It enables the cache and then imports `dist/cli/app.js` (entry `app: src/cli/main.ts`) through a runtime-computed URL, which esbuild leaves alone. bin, the widget path and the Homebrew symlink keep pointing at main.js.
6. **Amends D-05 for the pre-Node interval only.** D-05 says the spinner lives in the Ink component. It still does inside the client. The widget's instant frame covers the time before Node runs, per LD-1.
7. **Kill switch.** `QQ_INSTANT_FRAME=0` (a shell parameter) turns off the widget paint and the pane wrapper. The client takeover stays armed because it is anchored on its own save and is harmless without an instant frame. `NODE_DISABLE_COMPILE_CACHE=1` (Node's own switch) turns off the cache. Runtime `NODE_ENV` is not defined at build time, so React's runtime behaviour does not change (the debug evidence showed no CPU gain from defining it).

Purpose: the blank-modal gap goes away visually (LD-1) and gets about 2.5x shorter in fact (LD-2).
Output: the zsh instant frame plus the client takeover with real-Ink replay regressions, the launcher plus a bundled app with a compile cache, a lazy SDK, a live check in both surfaces, and the debug session resolved.

**Source coverage audit.** Every item is covered:

| Source | Item | Plan |
|---|---|---|
| GOAL | instant first frame from the zsh widget | Task 1 |
| GOAL | bundled, compile-cached node client | Task 2 |
| CONTEXT LD-1 | inline paint before Node / Zellij pane paint before node | Task 1 |
| CONTEXT LD-1 | clean takeover (no dup header, no stale rows, no flicker, prompt clean on Esc/accept) | Task 1 (replay) + Task 3 (live) |
| CONTEXT LD-1 | shell result, kill switch, ERR-trap guards, handoff timing guard | Task 1 |
| CONTEXT LD-2 | noExternal bundle, only Node built-in static imports | Task 2 |
| CONTEXT LD-2 | compile cache, per-user dir, fail safe | Task 2 |
| CONTEXT LD-2 | defer @anthropic-ai/sdk | Task 2 |
| RESEARCH (debug) | react-devtools-core alias, createRequire banner, reuse the RED test | Task 2 |
| RESEARCH (debug) | Resolution filled, session moved to resolved | Task 2 + after Task 3 |
| Constraints | no wall-clock assertions, named presentational constants, regression set | Tasks 1-2 |
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/debug/modal-blank-before-loading.md

Interfaces the executor needs (already in the codebase; do not re-derive):
- shell/zsh/queque.zsh, `qq-question-widget`: on the first `?` it calls self-insert. On the second it runs `_qq_capture_buffers`, then mktemp -d plus chmod 700 (CR-006), `trap "_qq_cleanup '$tmpdir'" EXIT ERR INT`, request.json via jq, `_qq_write_tool_handoff "$tmpdir"`, the qq_cmd lookup (QQ_DEV_ROOT dist path, else `whence -p qq`, else `zle -M` and return), then the Zellij branch (mkfifo, `zellij run --floating --close-on-exit --width --height --name qq -- …`, FIFO read with `-t 30`) or the inline branch (foreground client with stderr appended to the debug log, then `_qq_apply_result`), and finally `_qq_cleanup`, `zle reset-prompt`, `zle -R`. ZLE runs widgets with stdin from /dev/null. Plain `print` from a widget reaches the terminal.
- tests/zsh-widget.test.ts: `runZsh(script)` runs `zsh -f -c "source <widget>\n<script>"` with a 5 s timeout. It has the placement test (handoff after the request heredoc and before both launch lines; the inline launch string is `client --request-file "$req_file" --result-file "$result_file"`; the zellij launch is matched by `^\s+zellij run --floating`), a test that the widget source contains zero tty-device redirects, the shape guard on `_qq_write_tool_handoff`, and the `handoff timing` median-of-5 < 25 ms test.
- src/client/run-foreground.ts: the llm branch currently goes classifyIntent → gatherContext → tty.ReadStream/WriteStream on the /dev/tty fd → a "could not open terminal" early return → a raw-mode probe early return → the inline reserve (`\n` × MODAL_VIEWPORT_LINES, `CSI <n> A`, `ESC 7`) → `render(…, { stdin, stdout, interactive: true })` → `clearScrollReserve` (`ESC 8` + `CSI J`, skipped in Zellij) → fetchCandidatesForUi, whose `.catch` calls `unmount(true)` (skipClear, so zsh prints the error under the frame). The inner `catch (error)` writes an error result.
- Ink 7 (node_modules/ink/build/log-update.js): cli-cursor hide is a separate write before the first frame. Each frame is `eraseLines(previousLineCount)` plus the output, inside `CSI ?2026 h` … `CSI ?2026 l`. The loading frame of CandidateSelect is: header row (only when initialQuery is non-empty; ` queque › <q>`, dim, wrap=truncate), `FILTER: type to filter…`, a blank row (content marginTop), ` thinking…` (LoadingSpinner FRAMES[0]), a blank row, then the controls row. Modal width is min(80, columns) with paddingX 1 (CandidateSelect MODAL_MAX_WIDTH = 80).
- tests/candidate-select-layout.test.tsx: FakeStdout (Writable, 78x22, isTTY, records `writes` in `_write`), FakeStdin, `settle()`, `mountArrival`, HEADER_MARKER `'queque ›'`, SCREEN_COLUMNS 78, and `replayScreen(writes, rows, columns)` → `{ lines, scrolled }` (handles printable text, `\n` as onlcr, `\r`, CSI A–H/J/K; ignores private modes; currently also ignores ESC 7 / ESC 8). node:child_process is mocked only for `spawn`, so `spawnSync` is real.
- src/daemon/bootstrap.ts spawnDaemon runs `process.execPath` with `fileURLToPath(import.meta.url)`, i.e. the bundle file that contains it. src/cli/main.ts runs `main()` only when `import.meta.url` equals the realpath of `process.argv[1]` (bug-159).
- Gotchas from .wolf/cerebrum.md: the git used by the Bash tool is a shell function, so use `/usr/local/bin/git` when an exit status matters. `cp` is interactive, so use `/bin/cp -f`. A TDD RED test that imports a new module needs the module's public exports to exist (throwing on call) so the pre-commit `tsc --noEmit` passes. Keep RED targets as a single-line `toBe` on a scalar, run with `-t`. commitlint wants a lowercase subject, header ≤ 100 chars and no leading acronym. User rules: no Co-Authored-By trailers, run biome on changed files before staging, stage `.wolf/` with the code, stage files by explicit path, and never stage `screen-cap-filename.mov`.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Tracer: `??` paints the instant frame from zsh, and the Ink client takes the surface over cleanly (inline and Zellij)</name>
  <files>shell/zsh/queque.zsh, src/client/instant-frame.ts, src/client/run-foreground.ts, tests/zsh-widget.test.ts, tests/candidate-select-layout.test.tsx</files>
  <read_first>
    - shell/zsh/queque.zsh (the whole widget; note the helper guard style of `_qq_write_tool_handoff`)
    - src/client/run-foreground.ts (llm branch, clearScrollReserve, the two catch paths)
    - tests/candidate-select-layout.test.tsx (FakeStdout, settle, mountArrival, replayScreen, HEADER_MARKER)
    - tests/zsh-widget.test.ts (runZsh, the placement test, the tty-redirect zero-count test, handoff timing)
    - src/ui/CandidateSelect.tsx render block and src/ui/LoadingSpinner.tsx (loading frame rows and text)
    - node_modules/ink/build/log-update.js (separate cursor-hide write, 2026 pair, eraseLines)
  </read_first>
  <behavior>
    - zsh z1: `_qq_instant_frame 'show me how to use z3' 78` sets REPLY. Its rows (split on CR LF, SGR removed) are exactly ` queque › show me how to use z3`, blank, blank, ` thinking…`
    - zsh z2: with an empty lbuffer, REPLY rows are blank, blank, ` thinking…` (no header, as in CandidateSelect)
    - zsh z3: an lbuffer holding `ESC[31m`, a newline and a tab yields a single header row with those control characters removed. The only ESC bytes in REPLY are the frame's own four SGR sequences
    - zsh z4: a 200-character lbuffer at columns 78 gives a header row of 1 + 76 visible characters ending in `…`. At columns 40 it is 1 + 38. Non-numeric or zero columns fall back to 80
    - zsh z5: `_qq_inline_instant_frame_bytes` REPLY starts with exactly `inlineScrollReserve(MODAL_VIEWPORT_LINES)` (imported from src/client/instant-frame.ts), then `CSI J`, then the z1 frame, and ends with `ESC 8`. This is the drift guard for the reserve size and bytes
    - zsh z6: with `QQ_INSTANT_FRAME=0` the frame and the bytes are empty, the painter prints nothing, the pane writer creates no file, and every status is 0
    - zsh z7: the painter with stdout piped prints nothing, returns 0 and leaves QQ_INSTANT_FRAME_PAINTED at 0. With stdout closed it returns 0 with empty stderr
    - zsh z8: `_qq_write_pane_instant_frame <dir> <lbuffer> 78` writes `<dir>/instant-frame.txt` as the z1 frame plus `CSI H`. With a missing dir: status 0, empty stderr, no file
    - zsh z9: `/bin/sh -c "$QQ_PANE_PAINT_SCRIPT" x <file> printf %s EXEC-OK` prints the file bytes followed by `EXEC-OK`. With a missing file it prints only `EXEC-OK`, with empty stderr
    - zsh z10 (static, inside the qq-question-widget body): the qq lookup and its not-found return come before the inline paint call; the inline paint call comes before `mktemp -d`; the pane frame write comes after `mkfifo` and before the zellij launch line; the zellij launch line passes `"${pane_cmd[@]}"` and carries no lbuffer variable; the inline launch keeps its exact string and captures the client status with `||`. The existing placement, tty-redirect zero-count, shape-guard and handoff-timing tests stay green unchanged
    - replay t1, inline, prompt on the last row of a full 22-row screen: prior rows plus the real widget bytes (from z5, produced by spawnSync zsh) give screen A. Then `inlineScrollReserve(MODAL_VIEWPORT_LINES)` plus the real Ink loading frame of CandidateSelect, mounted on a FakeStdout armed with `armInstantFrameTakeover(stdout, INLINE_SURFACE_CLEAR)`, give screen B. In A, the header is on row h and ` thinking…` on row h+3. In B, exactly one row contains HEADER_MARKER, and it is row h; row h+1 starts with `FILTER:`; row h+3 has the same text as in A; rows 0..h-1 are identical in A and B; and B.scrolled === A.scrolled
    - replay t2, inline on a cleared screen (prompt on row 0): the same assertions with h = 0 and scrolled 0
    - replay t3, Zellij, 22-row pane: the real pane frame file bytes give A (header on row 0, loading on row 3). Ink through `PANE_SURFACE_CLEAR` gives B: one header, on row 0; row 3 text unchanged; scrolled 0; every row below Ink's frame blank
    - replay t4, inline with a 200-character lbuffer: B has exactly one header row and no non-blank row outside Ink's frame (no instant-frame residue)
    - replay t5, no instant frame (older widget or kill switch): the reserve plus an armed Ink gives one header, on the reserve top row, and scrolling only from the reserve itself
    - takeover t6, with a recording Writable: control-only chunks (cursor hide, newlines, CSI moves) pass through unchanged; the first visible chunk that starts with SYNC_UPDATE_BEGIN gets the clear right after it; a visible chunk without it gets the clear prepended; later chunks are unchanged; `clearNow()` writes the clear once and disarms; `clearNow()` after the injection writes nothing; a fake whose `write` is an own property keeps working after the takeover fires
  </behavior>
  <action>
RED first, per TDD. Add the behavior cases above to tests/zsh-widget.test.ts (a new `instant frame` describe; import MODAL_VIEWPORT_LINES from src/ui/modal-layout.ts and inlineScrollReserve from src/client/instant-frame.ts) and to tests/candidate-select-layout.test.tsx (a new `instant frame takeover` describe). Extend replayScreen there so `ESC 7` saves and `ESC 8` restores row and column, and update its doc comment, which currently says they are ignored. Existing cases never emit them, so their results do not change. Get the zsh bytes in the replay test by calling spawnSync on `zsh -f -c` that sources shell/zsh/queque.zsh, calls the helper with the lbuffer and columns passed as positional parameters (never interpolated into the script), and prints REPLY with `print -rn --`. Create src/client/instant-frame.ts with its public exports throwing on call, so the RED commit passes `tsc --noEmit` (cerebrum, 2026-08-26). Capture RED evidence on a single-line scalar assertion with `-t`, for example t1's `toBe(1)` header-row count. Commit: `test(quick-261011-jbh): add failing instant-frame takeover regressions`.

GREEN, client module (per LD-1, design decisions 1-2). src/client/instant-frame.ts exports named constants for every sequence: SAVE_CURSOR (`ESC 7`), RESTORE_CURSOR (`ESC 8`), ERASE_BELOW (`CSI J`), CURSOR_HOME (`CSI H`) and SYNC_UPDATE_BEGIN (`CSI ?2026 h`). It also exports `INLINE_SURFACE_CLEAR` = RESTORE_CURSOR + ERASE_BELOW, `PANE_SURFACE_CLEAR` = CURSOR_HOME + ERASE_BELOW, `inlineScrollReserve(lines)` = `lines` newlines + `CSI <lines> A` + `\r` + SAVE_CURSOR, and `armInstantFrameTakeover(stream, clear)`, which returns `{ clearNow(): void }`. Inside the takeover, wrap `stream.write` once, forwarding every argument. A chunk counts as visible when `stripVTControlCharacters` (node:util) leaves something that `trim()` does not empty. On the first visible chunk, insert `clear` right after a leading SYNC_UPDATE_BEGIN if the chunk starts with one, otherwise prepend it. Then restore the captured original `write` by reassigning it (do not delete the property: test fakes define `write` as an own property). `clearNow()` writes `clear` through the original write only while the takeover is still armed, then disarms. Document in the module header why this is safe: inline clears target the client's own fresh save, and the pane clear is absolute.

GREEN, client wiring (src/client/run-foreground.ts). At the start of the llm branch's try, before classifyIntent, move the tty.ReadStream/WriteStream creation, the "could not open terminal" return and the raw-mode probe. Between stream creation and the raw-mode probe: inline (not inZellij), write `inlineScrollReserve(MODAL_VIEWPORT_LINES)` (this replaces the three reserve writes that sat before render) and arm with INLINE_SURFACE_CLEAR; in Zellij, arm with PANE_SURFACE_CLEAR. Keep the takeover handle in a variable the catch blocks can reach. Call `clearNow()` in the inner catch before it writes the error result, and in the fetchCandidatesForUi `.catch` before `unmount(true)` (a no-op once Ink has drawn, so skipClear behaviour is unchanged). The raw-mode failure message is visible text, so the armed takeover clears the instant frame before it automatically. clearScrollReserve writes INLINE_SURFACE_CLEAR (the same bytes as today). Update the D-05/D-07 comment: the Ink spinner still lives in the component, and the widget's instant frame covers only the time before Node (decision 6). Do not touch src/ui/*, src/client/zellij-pane-resize.ts or MODAL_VIEWPORT_LINES.

GREEN, zsh widget (shell/zsh/queque.zsh, per LD-1, design decisions 1, 3, 4, 7). Add named presentational constants with `typeset -g`, not `-r`: the widget is re-sourced in dev, and a read-only parameter errors on the second source. The constants are QQ_MODAL_VIEWPORT_LINES=18 (mirrors MODAL_VIEWPORT_LINES; z5 guards drift), QQ_MODAL_MAX_COLUMNS=80, QQ_MODAL_PADDING_COLUMNS=1, QQ_ZELLIJ_FRAME_COLUMNS=2, QQ_INSTANT_FRAME_ROWS_ABOVE_LOADING=2 (the FILTER row plus the content marginTop), QQ_INSTANT_FRAME_LOADING_TEXT=`thinking…`, QQ_INSTANT_FRAME_FILE=`instant-frame.txt`, and QQ_PANE_PAINT_SCRIPT (single-quoted POSIX sh: cat the file named by $1 with stderr discarded, shift, exec "$@"). Add four top-level helpers next to `_qq_write_tool_handoff`, guarded the same way (every list ends in status 0, stderr discarded, no loops beyond a fixed newline run, no subprocesses):
- `_qq_instant_frame lbuffer columns` sets REPLY to the frame rows joined by `\r\n`. The header row is padding space + SGR 2 + `queque › ` + the lbuffer with `[[:cntrl:]]` removed, truncated by character count to min(columns, 80) − 2 with a trailing `…`, + SGR 22. It is present only when the lbuffer is non-empty. Then come QQ_INSTANT_FRAME_ROWS_ABOVE_LOADING blank rows and the dim loading row. With QQ_INSTANT_FRAME=0, REPLY is empty.
- `_qq_inline_instant_frame_bytes lbuffer columns` sets REPLY to the reserve (QQ_MODAL_VIEWPORT_LINES newlines, `CSI <n> A`, `\r`, `ESC 7`) + `CSI J` + the frame + `ESC 8`, or empty when the frame is empty.
- `_qq_paint_inline_instant_frame lbuffer` sets QQ_INSTANT_FRAME_PAINTED=0. When stdout is a terminal and the bytes are non-empty, it writes them in one `print -rn --` to stdout. Use plain stdout only: the existing test forbids tty-device redirects, and ZLE tracks plain output. It sets QQ_INSTANT_FRAME_PAINTED=1 only when that print succeeded.
- `_qq_write_pane_instant_frame dir lbuffer pane_columns` writes the frame + `CSI H` to `dir/instant-frame.txt` and removes the file on failure.
In qq-question-widget: reset QQ_INSTANT_FRAME_PAINTED=0 when the trigger fires. Move the whole qq_cmd lookup block, including the not-found `zle -M` return and its `_qq_log`, up to just after the LBUFFER/RBUFFER assignment. Directly after it, when ZELLIJ is empty, call `_qq_paint_inline_instant_frame "$QQ_LBUFFER"` and log it with `_qq_log`. That puts the paint before mktemp, jq and the handoff. The request.json, the handoff and its placement are unchanged. Zellij branch: after the pane width and height are set, call `_qq_write_pane_instant_frame "$tmpdir" "$QQ_LBUFFER" $(( qq_pane_width - QQ_ZELLIJ_FRAME_COLUMNS ))`. Build a local array `pane_cmd`: when the frame file is non-empty it is (/bin/sh -c "$QQ_PANE_PAINT_SCRIPT" queque-instant-frame "$tmpdir/$QQ_INSTANT_FRAME_FILE" "${qq_cmd[@]}"), otherwise ("${qq_cmd[@]}"). The zellij run line keeps every flag and launches `"${pane_cmd[@]}" client --request-file "$req_file" --result-file "$fifo_path"`. Inline branch: keep the launch string and stderr redirect, and add `|| qq_client_status=$?` (a local initialised to 0). When QQ_INSTANT_FRAME_PAINTED is 1 and the status is non-zero, print `ESC 8` + `CSI J` to stdout (guarded) before `_qq_apply_result`. Document the new helpers in the header comment style used for the handoff helper.

Run the Task 1 suites. The handoff timing test is a known load flake (bug-206): if it fails, check `uptime` and re-run `pnpm exec vitest run tests/zsh-widget.test.ts -t "handoff timing"` alone; never loosen it. Run biome on the changed files. Update .wolf/anatomy.md (new src/client/instant-frame.ts, and new descriptions for queque.zsh, run-foreground.ts and both test files) and append a .wolf/memory.md line. Commit: `feat(quick-261011-jbh): paint an instant frame from the zsh widget`. Stage by explicit path, including the .wolf files.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/zsh-widget.test.ts tests/candidate-select-layout.test.tsx tests/client-result.test.ts tests/zellij-pane-resize.test.ts && pnpm typecheck && pnpm lint && grep -q 'export const MODAL_VIEWPORT_LINES = 18;' src/ui/modal-layout.ts && /usr/local/bin/git diff --quiet de3783c -- src/client/zellij-pane-resize.ts src/ui/CandidateSelect.tsx src/ui/modal-layout.ts && grep -q '_qq_paint_inline_instant_frame "$QQ_LBUFFER"' shell/zsh/queque.zsh && grep -q 'armInstantFrameTakeover(' src/client/run-foreground.ts</automated>
  </verify>
  <done>In a plain terminal and in a Zellij pane, the widget paints the header and loading line before Node starts. The real-Ink replays show Ink's first frame replacing it in place: one header, no residue, no extra scroll, rows above untouched. Pre-frame failures and crashes leave no instant-frame rows. The kill switch restores the previous launch. All Task 1 suites, typecheck and lint pass, and the guarded files are unchanged since de3783c. Both commits are made.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Bundle every dependency behind a compile-cache launcher, and load the Anthropic SDK lazily</name>
  <files>tests/bundle-startup.test.ts, tsup.config.ts, src/cli/launcher.ts, src/shims/react-devtools-core.ts, src/providers/claude.ts</files>
  <read_first>
    - tests/bundle-startup.test.ts (the debugger's uncommitted RED test, to be reviewed and kept)
    - tsup.config.ts and package.json (bin, files, dependencies)
    - src/cli/main.ts (isDirectRun, main(), the top-level FIFO safety handlers)
    - src/providers/claude.ts lines 1-40 and 140-170 (getAnthropicClient and its single caller)
    - node_modules/ink/build/devtools.js and node_modules/ink/build/reconciler.js (what the devtools import is used for)
    - .planning/debug/modal-blank-before-loading.md (Evidence 19:41Z/19:50Z: alias and banner gotchas)
  </read_first>
  <behavior>
    - b1 (RED target): every .js file the real tsup config emits (exactly main.js and app.js) statically imports only Node built-ins. Literal dynamic import() specifiers and esbuild `__require("…")` specifiers are built-ins only. Single-line `expect(external.join(', ')).toBe('')`
    - b2: `node main.js --help` with cwd = outDir (no node_modules), NODE_COMPILE_CACHE and NODE_DISABLE_COMPILE_CACHE removed from env, and XDG_CACHE_HOME set to a temp cache home exits 0 and prints `$ qq <command> [options]`. Its stderr equals the stderr of a baseline run with NODE_DISABLE_COMPILE_CACHE=1, so the cache adds no output
    - b3: after b2, `<cache home>/queque/node-compile-cache` is a directory with mode 0700 that contains at least one file, found recursively. That proves the cache covers app.js
    - b4 (skipped when running as root): with the cache home at chmod 0500, `--help` still exits 0 with the same stdout and baseline stderr, and no queque dir is created
    - b5: with a pre-created `<cache home>/queque/node-compile-cache` at chmod 0777, `--help` exits 0 and the dir stays empty (not used)
    - b6: `node app.js --help` exits 0 with usage. app.js is what spawnDaemon re-execs
    - provider tests keep passing with the SDK imported lazily (vi.mock of '@anthropic-ai/sdk' resolves for dynamic imports)
  </behavior>
  <action>
RED first. Keep the debugger's test (its header comment, the no-timing rule, and building with the real config into a temp dir with dts/sourcemap off). Adjust it for two output files and add b2-b6 as described in the behavior list. Use `it.skipIf` for b4 under uid 0, read modes with `statSync(...).mode & 0o777`, and set b5's mode with chmodSync after mkdir so the umask cannot interfere. Run RED on b1 with `-t "statically imports only Node built-ins"`; it fails today because ink, react, zod, cac and the SDK are external. Commit the test, which is currently untracked: `test(quick-261011-jbh): add failing bundle startup regression`.

GREEN (per LD-2, design decisions 5 and 7):
1. src/shims/react-devtools-core.ts: a no-op default export with the members ink's devtools.js calls (read it). ink only loads devtools when DEV=true and the package resolves, but esbuild hoists the static import, so the alias target must exist. Keeping it external crashed the bundle with ERR_MODULE_NOT_FOUND (debug evidence).
2. src/cli/launcher.ts, built as dist/cli/main.js, imports Node built-ins only. First it enables the compile cache safely. If NODE_COMPILE_CACHE or NODE_DISABLE_COMPILE_CACHE is set, do nothing: Node already honours them. Otherwise, the cache root is XDG_CACHE_HOME when that is an absolute path, else `~/.cache`. The dir is `<root>/queque/node-compile-cache`, created with `mkdirSync({ recursive: true, mode: 0o700 })`. Then lstat both the `queque` parent and the leaf: each must be a real directory (not a symlink), owned by `process.getuid()`, with no group or world write bit. If all of that holds and `enableCompileCache` is a function, call it with the dir as a string, which works on Node 22.1+ and 24. Wrap everything in try/catch and stay silent: no stdout or stderr, so the daemon, `--help` and the client's debug-log stderr stay clean. Then import the app through `new URL('./app.js', import.meta.url).href`. That runtime-computed specifier is on purpose, so esbuild neither inlines app.js nor demands it at build time. Type the result as `typeof import('./main.js')` and await `main()`. On a rejection, print the message to stderr and set process.exitCode = 1, matching main.ts's direct-run block. main.ts itself is unchanged: when the launcher imports it, its isDirectRun check is false, so it does not run twice. Its own check still makes app.js directly runnable for spawnDaemon.
3. tsup.config.ts: set `entry: { main: 'src/cli/launcher.ts', app: 'src/cli/main.ts' }`, with a comment explaining that bin, the widget and Homebrew point at main.js. Add `noExternal: [/.*/]`. Add `esbuildOptions` that adds an alias from `react-devtools-core` to `./src/shims/react-devtools-core.ts` (esbuild resolves alias substitutions against the working directory, which is the repo root for pnpm build, vitest and the Docker smoke build). Extend the banner after the shebang with a createRequire import aliased under a private name from `node:module`, plus a top-level `const require` created from `import.meta.url`, for the CJS deps (react, signal-exit, ws). Keep `splitting: false`, `sourcemap: true`, the `define`s and `dts: true`. If the dts step fails or tries to inline dependency types under noExternal, set `dts: false` with a comment saying package.json declares no types or exports, and record that in the SUMMARY. Do not define process.env.NODE_ENV (decision 7). Do not set `legalComments: 'none'`: keep esbuild's default, so bundled licence notices survive.
4. src/providers/claude.ts (LD-2 defer): the static SDK import becomes `import type` (types only). getAnthropicClient becomes async: it returns the cached client on a key match; otherwise it awaits `import('@anthropic-ai/sdk')`, re-checks the cache after the await so concurrent first calls share one client, constructs, caches and returns. Its only caller, fetchCandidates in the same file, awaits it. resetAnthropicClientCache is unchanged.
5. Run `pnpm build` and confirm dist/cli/main.js and dist/cli/app.js exist and `node dist/cli/main.js --help` prints usage (no timing judgement; the machine is heavily loaded).
6. In .planning/debug/modal-blank-before-loading.md, fill Resolution: root_cause (the static module graph loaded file by file before the first frame, amplified by CPU contention), fix (LD-1 instant frame + LD-2 launcher, bundle, compile cache and lazy SDK), and files_changed. Set the status to `awaiting_human_verify`.
7. OpenWolf. anatomy: add the launcher, the shim and the bundle test entry, and update tsup.config.ts and claude.ts. cerebrum Key Learnings: the compile cache needs a launcher plus a dynamic import, because a single-file bundle is compiled before its code runs; the esbuild devtools alias and createRequire banner; Ink's control-only cursor-hide write before the first frame; the stale-save hazard behind design decision 1. cerebrum Decision Log: LD-1 amends D-05 for the pre-Node interval; no NODE_ENV define. buglog: a `modal blank before loading frame` entry (root cause, fix, tags bundle/startup/zsh/ink). memory: append a line.
8. Run biome on the changed files, then commit: `perf(quick-261011-jbh): bundle the client behind a compile-cache launcher`, staging by explicit path (code, the debug file, the .wolf files).
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/bundle-startup.test.ts tests/claude-provider.test.ts tests/claude-cli-provider.test.ts tests/daemon-fetch.test.ts tests/main-direct-run.test.ts && pnpm typecheck && pnpm lint && pnpm build && test -f dist/cli/app.js && node dist/cli/main.js --help | grep -q 'qq <command>' && grep -q "import('@anthropic-ai/sdk')" src/providers/claude.ts && grep -q "^import type Anthropic from '@anthropic-ai/sdk'" src/providers/claude.ts && grep -q 'noExternal' tsup.config.ts && pnpm test:run</automated>
  </verify>
  <done>b1-b6 pass. dist/cli/main.js is a built-in-only launcher that enables the per-user 0700 compile cache (silent on failure) and loads dist/cli/app.js, which inlines every dependency and also runs on its own. The SDK loads lazily. Typecheck, lint, build and the full suite pass. Known load flakes (bug-206 fuzz, handoff timing, claude-exec) are re-run in isolation, never loosened. The debug session is awaiting human verification, OpenWolf records are updated, and both commits are made.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Live check in a plain terminal and in Zellij</name>
  <what-built>The widget paints the queque header and a loading line the moment `??` fires (inline area, or the Zellij floating pane via a session-dir frame file), and the Ink client takes that surface over in its first frame. The client is now a built-in-only launcher (dist/cli/main.js) with a per-user compile cache, loading one bundled app (dist/cli/app.js), and the Anthropic SDK loads lazily.</what-built>
  <how-to-verify>
    Setup (dev widget, since ~/.zshrc sources the Homebrew widget last): run `pnpm build`, open a new terminal, `cd` to the repo, then `export QQ_DEV_ROOT=$PWD QQ_DEBUG_LOG_FILE=/tmp/qq-debug.log` and `source shell/zsh/queque.zsh`.
    1. Plain terminal (ZELLIJ unset), screen full of history: type `show me how to use z3??`. The `queque › show me how to use z3` header and `thinking…` should appear at once, in place of the prompt line. When the client starts, the FILTER and controls rows join them. The header is never doubled, nothing jumps or scrolls again, and no rows are left over. Candidates replace `thinking…`.
    2. Press Esc: the prompt comes back with the original buffer and no stray rows. Run `??` again and press Enter: the command lands in the buffer, the two summary lines print above the prompt, and no instant-frame rows are left.
    3. Run `clear`, then repeat step 1 at the top of the screen: the same clean handoff.
    4. Zellij: run the same query. The floating pane should show the header and `thinking…` as soon as it opens, before the client runs. The handoff is clean, the list appears and stays (G-09-7), the header row stays visible after the pane shrinks (261011-e43), typing `smt` and backspacing keeps the pane height (261011-f9o), and Esc/Enter return to the shell buffer.
    5. Kill switch: `QQ_INSTANT_FRAME=0`, then `??` behaves as before (blank until Ink), with no errors. Then `unset QQ_INSTANT_FRAME`.
    6. Compile cache: `ls -la ~/.cache/queque/node-compile-cache` (or under $XDG_CACHE_HOME) shows a `drwx------` dir with content after a `??`.
    7. Optional: in /tmp/qq-debug.log, the `instant frame` log line comes right after `trigger fired`, and `command start` follows the `qq_cmd=` line sooner than in the debug session's evidence. This is observation only; there is no timing gate.
  </how-to-verify>
  <resume-signal>Type "approved", or describe what you saw (step number + symptom)</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| command-line buffer → terminal | The lbuffer (typed or pasted, possibly with terminal escape sequences) is painted by the widget before Node runs |
| widget → session dir → Zellij pane wrapper | The frame file is written to the mktemp 0700 session dir and read by `/bin/sh` in the pane |
| zsh/Node → /dev/tty | Cursor save/restore and erase sequences can rewrite the visible terminal |
| Node process → compile cache dir | V8 code cache files are executable code artefacts that are read back on later starts |
| build → dist | Third-party dependency code is inlined into dist/cli/app.js at build time (a new supply-chain shape) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261011jbh-01 | Tampering / Elevation | src/cli/launcher.ts compile cache dir | high | mitigate | Never use Node's default `os.tmpdir()/node-compile-cache`, which is shared /tmp on Linux and could be poisoned by another local user. Use a per-user dir under XDG_CACHE_HOME (absolute only) or ~/.cache, created 0700. Before enabling, lstat the leaf and the `queque` parent: a real directory, not a symlink, owned by getuid, no group or world write bit. Otherwise the cache is not enabled. Covered by b3 (0700), b5 (a world-writable dir is ignored). |
| T-261011jbh-02 | Tampering | shell/zsh/queque.zsh `_qq_instant_frame` | medium | mitigate | `[[:cntrl:]]` is stripped from the lbuffer before it reaches the terminal, so a pasted ESC/CSI/OSC sequence or newline cannot run as a terminal command or break the row layout. The frame is built only from named constants plus the sanitised text. Covered by z3. |
| T-261011jbh-03 | Information Disclosure | Zellij pane command | medium | mitigate | The frame, which contains the user's query, reaches the pane as a file in the 0700 session dir (CR-006 mktemp -d). The argv carries only the file path, so the query stays out of `ps` and out of Zellij's session serialisation. The file is removed with the session dir by `_qq_cleanup`. Covered by z8, and z10 (no lbuffer variable on the zellij launch line). |
| T-261011jbh-04 | Tampering / Denial of Service | `ESC 8` + `CSI J` clears (widget and client) | medium | mitigate | A restore to a stale saved cursor would erase the user's screen from the wrong row. The client's clears target only the save it wrote itself at the start of the llm branch (design decision 1). The widget clears only when it painted (and saved) and the client exited non-zero. The Zellij clear is absolute (`CSI H`) on a fresh pane. Covered by t5 (no instant frame) and t1/t2. |
| T-261011jbh-05 | Denial of Service | launcher startup | medium | mitigate | The cache setup never throws and never prints. enableCompileCache returns a status instead of throwing, and FAILED/DISABLED are ignored. A failed app import prints one stderr line and exits 1, the same as main.ts today (the widget then clears the inline instant frame). Covered by b4 (read-only cache home) and b2 (stderr equals baseline). |
| T-261011jbh-06 | Tampering | build → dist supply chain | medium | mitigate | No package is added, upgraded or installed. Versions stay pinned exactly in package.json, the lockfile is unchanged, and esbuild bundles the lockfile-installed tree. The shipped bundle no longer resolves anything from node_modules at runtime (b1, b2 run with no node_modules), so a writable install-location node_modules can't redirect code. react-devtools-core is replaced by a local no-op shim rather than installed. esbuild's default legal comments keep the licence notices. Accepted residual: a dependency fix needs a rebuild and release, which the pinned versions already required. |
| T-261011jbh-07 | Spoofing | launcher → app.js | low | accept | app.js is resolved only relative to the launcher's own `import.meta.url`. No PATH, cwd or env input is involved, and an attacker who can write dist/ already controls main.js. |
| T-261011jbh-08 | Elevation | `/bin/sh -c` pane wrapper | low | mitigate | The script is a fixed constant (QQ_PANE_PAINT_SCRIPT). User-derived data reaches it only as a quoted positional file path, and the client argv is passed through `exec "$@"` unchanged, so there is no word splitting, eval or glob of user text. Covered by z9. |
| T-261011jbh-SC | Tampering | npm/pip/cargo installs | high | accept | No package is installed or upgraded (no package.json dependency or lockfile change), so the package-legitimacy gate does not apply. The only new module is a repo-local shim. |
</threat_model>

<verification>
- `pnpm test:run`, `pnpm typecheck`, `pnpm lint` and `pnpm build` all pass. Known load flakes (bug-206 fuzz 1 s bound, zsh-widget handoff timing, claude-exec) are re-run in isolation after checking `uptime`, never loosened. No new test asserts wall-clock time.
- Real-Ink replays (t1-t5) prove one header, no residue, header and loading rows unchanged, and no extra scroll, for inline (full and cleared screen) and Zellij.
- The zsh cases (z1-z10) prove the frame contents, sanitising, reserve drift (byte-identical to inlineScrollReserve), the kill switch, ERR-trap safety, the pane file and wrapper, and placement. The existing placement, tty-redirect, shape-guard and handoff-timing tests are unchanged and green.
- The bundle cases (b1-b6) prove built-in-only imports, startup with no node_modules for both files, a populated per-user 0700 cache, and fail-safe behaviour for unwritable and world-writable cache locations.
- Regression set green: tests/candidate-select-layout.test.tsx (d)-(g), tests/zellij-pane-resize.test.ts, tests/client-result.test.ts, tests/daemon-bootstrap.test.ts, tests/main-direct-run.test.ts.
- Task 3 live approval in a plain terminal and in Zellij.
</verification>

<success_criteria>
- `??` shows the queque header and loading line immediately in both surfaces, and the Ink client replaces them in place with no duplicate header, no stale rows and no prompt corruption on Esc, Enter or errors (LD-1).
- dist/cli/main.js starts through a built-in-only launcher with a per-user compile cache, and dist/cli/app.js carries every dependency (LD-2). The SDK is not evaluated before the first frame.
- Shell-return contract, kill switches, ERR-trap guards and the < 25 ms handoff guard hold. G-09-7, 261011-e43 and 261011-f9o do not regress.
- After the Task 3 approval: the debug session's Verification is filled, its status is set to resolved, it moves to `.planning/debug/resolved/modal-blank-before-loading.md` (create the dir; the file was untracked, so use a plain `mv`, then stage it), and the SUMMARY records the live results.
</success_criteria>

<output>
After Task 3 is approved: finish the debug session file (Verification, status resolved, moved to .planning/debug/resolved/), then create `.planning/quick/261011-jbh-instant-first-frame-from-the-zsh-widget-/261011-jbh-SUMMARY.md`.
</output>
