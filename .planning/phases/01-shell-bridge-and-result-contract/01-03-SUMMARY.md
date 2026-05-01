---
phase: 01-shell-bridge-and-result-contract
plan: "03"
subsystem: daemon-bootstrap-and-client-seam
tags: [daemon, bootstrap, unix-socket, ipc, foreground-client, shell-result, tdd]
dependency_graph:
  requires:
    - 01-01  # shell contract and IPC contract definitions
  provides:
    - daemon bootstrap (ensureDaemon) with stale-socket recovery
    - daemon Unix-socket server (startDaemonServer) handling ping/ensure-session/run-query
    - foreground client loop (runForegroundClient) with /dev/tty ownership
    - shell result writer (writeShellResult) with Zod validation
    - CLI wiring: qq client and qq daemon dispatch to real handlers
  affects:
    - src/cli/main.ts
tech_stack:
  added:
    - node:net (Unix socket server/client)
    - node:child_process (daemon spawn with detach)
    - node:fs/promises (TTY open, result file write)
  patterns:
    - TDD RED/GREEN with vitest mocking (vi.hoisted + vi.mock for spawn and fs/promises)
    - Deterministic fixture seam for Phase 1 (resultMode parameter)
    - Newline-delimited JSON over Unix socket
key_files:
  created:
    - src/daemon/bootstrap.ts
    - src/daemon/server.ts
    - src/cli/commands/daemon.ts
    - src/cli/commands/client.ts
    - src/client/result-writer.ts
    - src/client/run-foreground.ts
    - tests/daemon-bootstrap.test.ts
    - tests/client-result.test.ts
  modified:
    - src/cli/main.ts
decisions:
  - Static imports for both client and daemon commands in main.ts (cleaner than dynamic import for always-needed handlers)
  - Fixture result in replace-buffer-fixture mode derives lbuffer from request.lbuffer (deterministic, round-trips real request content)
  - Bootstrap uses fs.unlinkSync (sync unlink before spawn — avoids race between unlink and spawn)
  - TTY opened via fsp.open('/dev/tty', 'r+') — handle stored then closed in finally block
metrics:
  duration: "~15 minutes"
  completed: "2026-05-01T23:25:38Z"
  tasks_completed: 2
  files_created: 8
  files_modified: 1
---

# Phase 01 Plan 03: Daemon Bootstrap and Client Seam Summary

**One-liner:** Unix-socket daemon with stale-socket recovery, foreground client owning /dev/tty, and deterministic replace-buffer fixture seam for shell bridge round-trips.

## What Was Built

### Task 1: Daemon Bootstrap and Server (TDD)

**src/daemon/bootstrap.ts** — `ensureDaemon(socketPath)` connects to an existing daemon (fast path), unlinks stale socket files on connect failure, spawns `qq daemon --socket <path>` as a detached/unreferenced child, then polls until the socket is reachable. Free of Ink, React, and TTY assumptions.

**src/daemon/server.ts** — `startDaemonServer(socketPath)` creates a `node:net` Unix-socket server. Handles newline-delimited JSON IPC messages: `ping` → `pong`, `ensure-session` → `session-ready`, `run-query` → `query-accepted`. Unknown or malformed messages are silently dropped (connection stays alive).

**src/cli/commands/daemon.ts** — Real `daemonCommand` handler. `qq daemon --socket <path>` starts the server and blocks; `qq daemon --socket <path> --ensure` calls `ensureDaemon` and exits.

RED commit: f8ee27c  
GREEN commit: faa5af3

### Task 2: Foreground Client Loop and Result Writer (TDD)

**src/client/result-writer.ts** — `writeShellResult(resultFile, result)` validates the result against `shellResultSchema` (Zod) and writes newline-terminated JSON. Throws on schema violations.

**src/client/run-foreground.ts** — `runForegroundClient({requestFile, resultFile, resultMode})` opens `/dev/tty` explicitly (does not assume inherited stdio is interactive), reads and validates the shell request with `shellRequestSchema`, calls `ensureDaemon`, then emits a deterministic result:
- `cancel` mode → `{kind:'cancel'}`
- `replace-buffer-fixture` mode → `{kind:'replace-buffer', lbuffer: <from request>, rbuffer: <from request>}`

**src/cli/commands/client.ts** — Real `clientCommand` handler mapping `--result-mode` CLI flag to the `runForegroundClient` resultMode parameter.

**src/cli/main.ts** — Updated to use static imports for both `clientCommand` and `daemonCommand`. `qq client` and `qq daemon` subcommands now dispatch to the real handlers.

RED commit: 5f87008  
GREEN commit: 4ab40a1

## Test Results

```
tests/daemon-bootstrap.test.ts  4 tests  PASS
tests/client-result.test.ts     4 tests  PASS
Total: 8 tests, 0 failures
```

TypeScript typecheck: clean (tsc --noEmit exits 0).

## Acceptance Criteria Verification

- `ensureDaemon` exported from bootstrap.ts: PASS
- `createServer` in server.ts: PASS
- `unlink` call in bootstrap.ts: PASS
- `commands/daemon` import in main.ts: PASS
- `commands/client` import in main.ts: PASS
- `/dev/tty` in run-foreground.ts: PASS
- `writeShellResult` in run-foreground.ts: PASS
- `replace-buffer` in run-foreground.ts: PASS
- No Ink/React imports in daemon or client modules: PASS

## Deviations from Plan

None — plan executed exactly as written. Both TDD RED/GREEN cycles completed in sequence.

## Known Stubs

**runForegroundClient replace-buffer-fixture mode** — The fixture result uses `request.lbuffer` directly as the suggested command. This is intentional: Phase 4 replaces this seam with the Ink TUI that presents real provider suggestions. The stub is deterministic and testable, not a placeholder for missing data.

## Self-Check: PASSED

All created files verified on disk. All commits verified in git log:
- f8ee27c: test(01-03) RED daemon-bootstrap
- faa5af3: feat(01-03) GREEN daemon bootstrap + server
- 5f87008: test(01-03) RED client-result
- 4ab40a1: feat(01-03) GREEN foreground client + result writer
