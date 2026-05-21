---
id: T01
parent: S01
milestone: M001
provides: []
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 
verification_result: passed
completed_at: 
blocker_discovered: false
---
# T01: 01-shell-bridge-and-result-contract 01

**# Phase 01 Plan 01: Toolchain Baseline and Shell/IPC Contracts Summary**

## What Happened

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
