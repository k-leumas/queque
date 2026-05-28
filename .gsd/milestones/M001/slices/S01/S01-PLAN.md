# S01: Shell Bridge And Result Contract

**Goal:** Establish the repo baseline and the shared contracts that every later Phase 1 plan depends on.
**Demo:** Establish the repo baseline and the shared contracts that every later Phase 1 plan depends on.

## Must-Haves


## Tasks

- [x] **T01: 01-shell-bridge-and-result-contract 01**
  - Establish the repo baseline and the shared contracts that every later Phase 1 plan depends on.

Purpose: Lock the Node/pnpm toolchain, CLI surface, and UI-neutral payload schemas before shell or daemon work starts.
Output: Installable project scaffold, `qq` CLI skeleton, shell/IPC zod schemas, and contract tests.
- [x] **T02: 01-shell-bridge-and-result-contract 02**
  - Implement the real `zsh` bridge: intercept `??` through a `?` widget, preserve shell state on cancel, and apply split-buffer results on accept.

Purpose: This is the user-visible shell seam that makes QueQue feel native instead of acting like a separate prompt-taking CLI.
Output: A sourceable `zsh` integration script and a smoke test that locks the trigger/cancel/apply behavior.
- [x] **T03: 01-shell-bridge-and-result-contract 03**
  - Stand up the daemon bootstrap path and a minimal foreground client loop behind the CLI surface defined in Plan 01.

Purpose: Repeat invocations need a warm background process, but the live TTY must remain owned by the foreground client so `Esc` and later TUI input work correctly.
Output: Daemon bootstrap/server modules, foreground client/result writer modules, and focused tests for bootstrap and shell-result emission.

## Files Likely Touched

- `.nvmrc`
- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `tsup.config.ts`
- `vitest.config.ts`
- `src/cli/main.ts`
- `src/contracts/ipc.ts`
- `src/contracts/shell.ts`
- `src/shared/socket-path.ts`
- `tests/shell-contract.test.ts`
- `shell/zsh/qq.zsh`
- `tests/zsh-widget.test.ts`
- `src/cli/main.ts`
- `src/cli/commands/client.ts`
- `src/cli/commands/daemon.ts`
- `src/client/result-writer.ts`
- `src/client/run-foreground.ts`
- `src/daemon/bootstrap.ts`
- `src/daemon/server.ts`
- `tests/client-result.test.ts`
- `tests/daemon-bootstrap.test.ts`
