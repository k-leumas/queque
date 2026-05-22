---
slug: tui-cleanup-on-close
date: 2026-05-22
status: complete
commit: 599bb99
---

# Summary: TUI Cleanup on Close

## What Changed

`src/client/run-foreground.ts` — added SIGHUP and SIGTERM handlers inside the
`new Promise<void>` block (the Ink TUI lifetime). When either signal arrives,
`app.unmount()` is called to emit the ANSI clear/cursor-restore sequences, then
`process.exit(0)` exits cleanly.

The normal `unmount` path (user selects a command or presses Esc) also removes
the signal handlers via `process.off()` so they cannot fire after the TUI is
already gone.

## Root Cause

Node.js default SIGHUP behavior exits the process immediately. Ink's cleanup
(clearing rendered output, restoring cursor position) only runs when `app.unmount()`
is called. Without a signal handler, terminal closure left the full candidate list
and search box rendered on screen.

## Result

132/132 tests pass. TUI artifacts are cleared on terminal/session close.
