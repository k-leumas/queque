# T02: 03.2 02

**Slice:** S05 — **Milestone:** M001

## Description

Implement the two Node.js production file changes for Phase 3.2:

1. `result-writer.ts` — add FIFO-aware write: detect FIFO path via fsp.stat().isFIFO() and use direct fsp.writeFile() instead of the atomic-rename path. The atomic-rename path is preserved for regular files.

2. `run-foreground.ts` — add Zellij branch: when process.env['ZELLIJ'] is defined, skip fsp.open('/dev/tty'), skip ttyReadStream/ttyWriteStream construction, skip the blank-line scroll hack, and pass empty renderOptions to Ink render(). Remove MODAL_CHROME_LINES constant entirely.

Purpose: These two changes enable the Zellij floating pane IPC contract — the client writes the result JSON directly to the FIFO path, and Ink renders into the pane's own PTY without any /dev/tty gymnastics.

Output: Two modified TypeScript source files. Tests from Plan 01 must go green after this plan.

## Must-Haves

- [ ] "writeShellResult calls fsp.writeFile directly when stat().isFIFO() is true (no fsp.rename) — D-04"
- [ ] "writeShellResult uses atomic rename (tmp + fsp.rename) when stat().isFIFO() is false (existing behavior preserved)"
- [ ] "runForegroundClient does not open /dev/tty when process.env.ZELLIJ is defined — D-08"
- [ ] "runForegroundClient renders Ink with empty renderOptions ({}) when process.env.ZELLIJ is defined — D-09"
- [ ] "MODAL_CHROME_LINES constant and scroll hack (ttyWriteStream.write newlines) are removed — D-02"
- [ ] "pnpm test:run exits 0 after both file changes"

## Files

- `src/client/result-writer.ts`
- `src/client/run-foreground.ts`
