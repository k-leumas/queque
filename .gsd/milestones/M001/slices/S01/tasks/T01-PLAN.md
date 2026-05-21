# T01: 01-shell-bridge-and-result-contract 01

**Slice:** S01 — **Milestone:** M001

## Description

Establish the repo baseline and the shared contracts that every later Phase 1 plan depends on.

Purpose: Lock the Node/pnpm toolchain, CLI surface, and UI-neutral payload schemas before shell or daemon work starts.
Output: Installable project scaffold, `qq` CLI skeleton, shell/IPC zod schemas, and contract tests.

## Must-Haves

- [ ] "A new checkout can install, build, and typecheck on the pinned toolchain."
- [ ] "Later Phase 1 work can exchange validated shell and IPC payloads without redefining the contract."
- [ ] "Later Phase 1 work can implement the real `qq client` and `qq daemon` flows without changing the public CLI surface."

## Files

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
