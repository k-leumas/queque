---
phase: 01-shell-bridge-and-result-contract
plan: 01
subsystem: contracts
tags: [scaffold, zod, contracts, ipc, shell, tdd]
dependency_graph:
  requires: []
  provides:
    - shellRequestSchema (src/contracts/shell.ts)
    - shellResultSchema (src/contracts/shell.ts)
    - ipcRequestSchema (src/contracts/ipc.ts)
    - ipcResponseSchema (src/contracts/ipc.ts)
    - socketPathForUid (src/shared/socket-path.ts)
  affects:
    - all Phase 1 plans that exchange shell or IPC payloads
tech_stack:
  added:
    - zod 4.1.5 (runtime schema validation for shell and IPC contracts)
    - typescript 6.0.3 (with NodeNext module resolution)
    - tsup 8.5.1 (ESM build with DTS generation)
    - vitest 4.0.4 (unit tests for contract schemas)
    - cac 7.0.0 (CLI subcommands)
    - ink 7.0.1 + react 19.2.0 (TUI layer, not yet wired)
    - @anthropic-ai/sdk 0.92.0 (provider scaffolded, not yet wired)
  patterns:
    - Zod discriminated unions with .strict() for exhaustive validation
    - Split-buffer (lbuffer/rbuffer) shell result contract to avoid Unicode index mismatch
    - Fixed /tmp/qq-{uid}.sock path to stay within macOS 103-byte Unix socket limit
    - TDD: RED commit of failing tests before GREEN implementation commit
key_files:
  created:
    - src/contracts/shell.ts (shellRequestSchema, shellResultSchema with strict cancel)
    - src/contracts/ipc.ts (ipcRequestSchema, ipcResponseSchema)
    - src/shared/socket-path.ts (socketPathForUid, socketPath helpers)
    - tests/shell-contract.test.ts (5 tests covering both schemas and socket path)
  modified: []
  already_existed:
    - .nvmrc (24.14.1)
    - package.json (qq bin, all baseline deps and scripts)
    - pnpm-lock.yaml (locked dependency graph)
    - tsconfig.json (NodeNext, strict, ES2024)
    - tsup.config.ts (entry: src/cli/main.ts, outDir: dist/cli, ESM)
    - vitest.config.ts (node env, tests/**/*.test.ts)
    - src/cli/main.ts (qq client and qq daemon subcommands with --ensure flag)
decisions:
  - "Used z.object({kind: 'cancel'}).strict() so cancel rejects extra buffer fields — discriminatedUnion alone strips but does not reject unknown keys"
  - "socketPathForUid uses /tmp/qq-{uid}.sock exclusively; avoids macOS TMPDIR path exceeding 103-byte Unix socket limit"
  - "IPC schemas import shellRequestSchema from shell.ts to avoid type drift between the two contracts"
metrics:
  duration: ~20 minutes
  completed: 2026-05-01
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 01 Plan 01: Toolchain Baseline and Shell/IPC Contracts Summary

**One-liner:** Zod-validated split-buffer shell contract and daemon IPC schemas locked behind 5 passing tests on a pinned Node 24.14.1 / pnpm / tsup baseline.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Toolchain baseline and CLI entry skeleton | 77b4ea0 (bootstrap) | .nvmrc, package.json, pnpm-lock.yaml, tsconfig.json, tsup.config.ts, vitest.config.ts, src/cli/main.ts |
| 2 RED | Shell contract failing tests | a983bca | tests/shell-contract.test.ts |
| 2 GREEN | Shell/IPC contracts implementation | 8ba3e29 | src/contracts/shell.ts, src/contracts/ipc.ts, src/shared/socket-path.ts |

## What Was Built

### Task 1: Toolchain Baseline (already in bootstrap commit)

The repo already contained a complete single-package `pnpm` TypeScript baseline pinned to Node `24.14.1`:

- `.nvmrc` pinned to `24.14.1`
- `package.json` with `qq` bin pointing to `dist/cli/main.js`, scripts `build / dev / test / test:run / typecheck`, and all MVP runtime deps (`cac`, `zod`, `react`, `ink`, `@anthropic-ai/sdk`)
- `tsconfig.json` with NodeNext module resolution, strict mode, ES2024 target
- `tsup.config.ts` bundling `src/cli/main.ts` to `dist/cli` as ESM
- `vitest.config.ts` targeting `tests/**/*.test.ts` in Node environment
- `src/cli/main.ts` exporting `main` with stable `client` and `daemon` subcommands (including `--ensure` flag), throwing explicit `not implemented` errors

### Task 2: Shell and IPC Contracts (TDD)

**RED:** Wrote 5 failing tests in `tests/shell-contract.test.ts` before any implementation existed.

**GREEN:** Implemented:

- `src/contracts/shell.ts` — `shellRequestSchema` (version, ttyPath, cwd, shellPid, lbuffer, rbuffer) and `shellResultSchema` (discriminated union: strict `cancel` | `replace-buffer` with lbuffer/rbuffer). The cancel variant uses `.strict()` to reject extra buffer fields. The deprecated `{buffer, cursor}` shape is excluded by design.

- `src/contracts/ipc.ts` — `ipcRequestSchema` (ping | ensure-session | run-query) and `ipcResponseSchema` (pong | session-ready | query-accepted). Imports `shellRequestSchema` from shell.ts so run-query reuses the same validated payload type.

- `src/shared/socket-path.ts` — `socketPathForUid(uid)` always returns `/tmp/qq-{uid}.sock`, never reads macOS `TMPDIR`. This keeps paths within the documented 103-byte macOS Unix socket limit.

## Verification Results

```
pnpm install && pnpm build && pnpm typecheck  → EXIT 0
pnpm vitest run tests/shell-contract.test.ts  → 5/5 PASS
```

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED — failing tests | a983bca | PASS |
| GREEN — implementation | 8ba3e29 | PASS |
| REFACTOR | not needed | — |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod discriminatedUnion does not reject extra fields on cancel variant**
- **Found during:** Task 2 GREEN — test 1 expected `success: false` when passing `{kind: 'cancel', lbuffer: ..., rbuffer: ...}`
- **Issue:** Zod's `discriminatedUnion` strips unknown keys by default (passthrough-like behavior for the matched branch), so cancel with extra buffer fields was incorrectly accepted
- **Fix:** Added `.strict()` to the cancel branch object so any extra keys cause a validation error
- **Files modified:** `src/contracts/shell.ts`
- **Commit:** 8ba3e29

### Plan Note

Task 1 files were already present and committed in the bootstrap commit `77b4ea0`. No re-implementation was needed. All acceptance criteria passed immediately on first verification run.

## Known Stubs

None — contracts export complete Zod schemas and TypeScript types. The `src/cli/main.ts` `client` and `daemon` handlers throw explicit `not implemented` errors as intended — these are tracked stubs awaiting Phase 1 plans 02 and 03.

## Threat Flags

None — no network endpoints, auth paths, or file access patterns introduced in this plan. The socket path helper is a pure string formatter with no I/O.

## Self-Check: PASSED

All created files confirmed present:
- FOUND: src/contracts/shell.ts
- FOUND: src/contracts/ipc.ts
- FOUND: src/shared/socket-path.ts
- FOUND: tests/shell-contract.test.ts
- FOUND: .planning/phases/01-shell-bridge-and-result-contract/01-01-SUMMARY.md

All commits confirmed:
- FOUND: a983bca (test RED — failing shell contract tests)
- FOUND: 8ba3e29 (feat GREEN — shell/IPC contracts implementation)
- FOUND: b95aaa2 (docs — SUMMARY.md)
