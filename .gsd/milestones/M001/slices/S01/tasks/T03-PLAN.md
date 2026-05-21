# T03: 01-shell-bridge-and-result-contract 03

**Slice:** S01 — **Milestone:** M001

## Description

Stand up the daemon bootstrap path and a minimal foreground client loop behind the CLI surface defined in Plan 01.

Purpose: Repeat invocations need a warm background process, but the live TTY must remain owned by the foreground client so `Esc` and later TUI input work correctly.
Output: Daemon bootstrap/server modules, foreground client/result writer modules, and focused tests for bootstrap and shell-result emission.

## Must-Haves

- [ ] "A foreground client can ensure the daemon is available without owning the TTY."
- [ ] "The daemon listens on a short per-user Unix socket path and recovers from stale sockets."
- [ ] "The foreground client can deterministically emit either cancel or replace-buffer results for the shell bridge to apply."
- [ ] "The top-level CLI entrypoint dispatches `qq client` and `qq daemon` to the real command handlers instead of placeholder bodies."

## Files

- `src/cli/main.ts`
- `src/cli/commands/client.ts`
- `src/cli/commands/daemon.ts`
- `src/client/result-writer.ts`
- `src/client/run-foreground.ts`
- `src/daemon/bootstrap.ts`
- `src/daemon/server.ts`
- `tests/client-result.test.ts`
- `tests/daemon-bootstrap.test.ts`
