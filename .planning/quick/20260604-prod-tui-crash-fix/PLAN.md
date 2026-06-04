---
slug: prod-tui-crash-fix
created: 2026-06-04
status: in-progress
---

# Quick Task: Fix production TUI crash on Homebrew binary

## Root causes

### Bug A — Ink raw mode uncaughtException
`useInput` in `CandidateSelect.tsx` calls `setRawMode(true)` via effect.
Ink checks `stdin.isTTY`:
- Custom ttyReadStream: only set if `/dev/tty` opens successfully
- If `/dev/tty` fails (ENXIO, no controlling terminal), ttyReadStream is undefined
- renderOptions falls back to `{ interactive: true }` → Ink uses process.stdin
- In ZLE context, process.stdin = /dev/null, isTTY = undefined
- Ink throws "Raw mode is not supported on current process.stdin" as uncaughtException
- uncaughtException handler writes cancel + exits
- User sees: TUI flashes (1 React render frame) then crashes

### Bug B — env-file.ts startDir resolves to Homebrew Cellar (not user CWD)
`dirname(fileURLToPath(import.meta.url))` in the tsup bundle resolves to
`dist/cli/` inside the Homebrew Cellar, not the user's project directory.
`.env.local` search starts in the wrong location — users relying on `.env.local`
for ANTHROPIC_API_KEY never get it resolved in production.

## Fixes

1. `src/client/run-foreground.ts` — guard before render: if effective stdin is
   not a TTY, write cancel and return instead of letting Ink throw
2. `src/ui/CandidateSelect.tsx` — `useInput` with `isActive: isRawModeSupported`
   + auto-cancel effect when raw mode is unavailable
3. `src/shared/env-file.ts` — change default startDir from
   `dirname(fileURLToPath(import.meta.url))` to `process.cwd()`

## Tests
- `tests/run-foreground-tty-guard.test.ts`: early-exit guard when isTTY = false
- `tests/env-file.test.ts`: extend with CWD-based startDir behavior
