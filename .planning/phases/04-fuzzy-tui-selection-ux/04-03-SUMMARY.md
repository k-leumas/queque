---
phase: 04
plan: 03
subsystem: cli
tags: [error-handling, process-handlers, fifo, shell-integration, tests]
dependency_graph:
  requires: [04-01-test-contracts]
  provides: [04-03-main-handlers]
  affects: [shell/zsh/qq.zsh, src/cli/main.ts, tests/client-result.test.ts]
tech_stack:
  added: []
  patterns:
    - process.on('uncaughtException') and process.on('unhandledRejection') registered before main() for FIFO safety net
    - fs.writeFileSync (node:fs sync) used in error handlers — async-unsafe context requires synchronous I/O
    - export QQ_RESULT_FILE in zsh widget before zellij run so Node process can read the FIFO path from env
key_files:
  created: []
  modified:
    - src/cli/main.ts
    - shell/zsh/qq.zsh
    - tests/client-result.test.ts
decisions:
  - Use process.env.QQ_RESULT_FILE (set by zsh widget) rather than a module-level variable, avoiding changes to run-foreground.ts interface
  - Use synchronous fs.writeFileSync not async writeShellResult — uncaughtException handler cannot safely await
  - Both handlers wrap writeFileSync in try/catch to prevent infinite error loops (T-04-03-02 mitigation)
  - Commit test activation separately from implementation so each commit has a focused scope
metrics:
  duration: 420s
  completed: "2026-05-21"
  tasks: 2
  files: 3
---

# Phase 04 Plan 03: Main.ts FIFO Safety Handlers Summary

Top-level uncaughtException and unhandledRejection handlers in main.ts plus QQ_RESULT_FILE env export in qq.zsh — closes RUN-02 Pitfall 3.

## What Was Built

Added two process-level error handlers to `src/cli/main.ts` that fire when a fatal error escapes the async `main()` chain. Both handlers read `process.env.QQ_RESULT_FILE` (the FIFO path exported by the zsh widget before launching the Node client) and write `{"kind":"cancel"}\n` synchronously before calling `process.exit(1)`. Without these handlers, a crash before or after the Promise block would leave the zsh widget blocking on the FIFO read for up to 30 seconds.

Also added `export QQ_RESULT_FILE="$fifo_path"` to `shell/zsh/qq.zsh` before the `zellij run` invocation so the env var is available in the Node process.

Activated the two `it.todo` test scaffolds from Plan 04-01 Task 3 by adding `vi.mock('node:fs', () => ({ writeFileSync: vi.fn() }))` and replacing both `.todo` calls with real `it()` bodies.

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Audit qq.zsh and add QQ_RESULT_FILE export | 5f26278 | shell/zsh/qq.zsh |
| 2 (impl) | Add uncaughtException and unhandledRejection handlers to main.ts | 5f26278 | src/cli/main.ts |
| 2 (tests) | Activate it.todo handler tests in client-result.test.ts | ad7cb9e | tests/client-result.test.ts |
| 2 (lint) | Fix biome useLiteralKeys — use dot notation for process.env | df355a7 | src/cli/main.ts |

## Final Test State

| File | Tests | Pass | Todo |
|------|-------|------|------|
| tests/candidate-select.test.tsx | 9 | 8 | 1 |
| tests/client-result.test.ts | 12 | 12 | 0 |
| All other files | 100 | 100 | 0 |
| **Total** | **121** | **120** | **1** |

The 1 remaining todo is the `selectedIndex reset on query change` test from Plan 04-01 Task 1 — pending in Plan 04-02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Test file required vi.mock('node:fs') and it.todo activation**
- **Found during:** Task 2 (test activation per critical_context in prompt)
- **Issue:** Plan 04-01 scaffolded the handler tests as `it.todo` with the bodies in comments. Plan 04-03 `files_modified` listed only `[src/cli/main.ts, shell/zsh/qq.zsh]` but the plan's success criteria require the tests to pass GREEN. Activating the tests requires modifying `tests/client-result.test.ts`.
- **Fix:** Added `vi.mock('node:fs', () => ({ writeFileSync: vi.fn() }))` at module level and replaced both `it.todo` calls with real `it()` bodies matching the scaffolded bodies in the comments.
- **Files modified:** tests/client-result.test.ts
- **Commit:** ad7cb9e

**2. [Rule 1 - Bug] Biome useLiteralKeys lint rule required dot notation**
- **Found during:** Post-commit `pnpm lint` verification
- **Issue:** `process.env['QQ_RESULT_FILE']` triggered biome's `lint/complexity/useLiteralKeys` rule. The pre-commit hook ran `biome check --write` which only applies safe fixes; this was an "unsafe" fix so it was skipped during pre-commit but still reported by `pnpm lint`.
- **Fix:** Changed `process.env['QQ_RESULT_FILE']` to `process.env.QQ_RESULT_FILE` (both occurrences in main.ts handlers). Tests continue to pass — the env access behavior is identical.
- **Files modified:** src/cli/main.ts
- **Commit:** df355a7

**3. [Rule 3 - Blocking] node_modules missing in worktree**
- **Found during:** First test run attempt
- **Issue:** The worktree had no `node_modules` directory so `pnpm test:run` failed with "vitest: command not found".
- **Fix:** Created a symlink `node_modules -> /Users/samuel/dev/tui-llm/node_modules` in the worktree root. This is a standard pattern for git worktrees that share the parent repo's installed dependencies.
- **Files modified:** node_modules (symlink, untracked)

## Known Stubs

None — all writes go to the real FIFO path via writeFileSync.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: path-traversal-via-env | src/cli/main.ts | QQ_RESULT_FILE read from env without assertSafeSocketPath validation in emergency handler — documented as known limitation per T-04-03-01 in plan threat model |

## Self-Check: PASSED

Files exist:
- [x] src/cli/main.ts — modified with handlers and node:fs import
- [x] shell/zsh/qq.zsh — modified with QQ_RESULT_FILE export
- [x] tests/client-result.test.ts — modified with vi.mock('node:fs') and activated it() bodies

Commits exist:
- [x] 5f26278 — feat(04-03): add uncaughtException and unhandledRejection handlers to main.ts
- [x] ad7cb9e — test(04-03): activate uncaughtException and unhandledRejection handler tests
- [x] df355a7 — fix(04-03): use dot notation for process.env.QQ_RESULT_FILE per biome lint

Handler structure verified:
- [x] grep finds process.on('uncaughtException') at line 47 of src/cli/main.ts
- [x] grep finds process.on('unhandledRejection') at line 60 of src/cli/main.ts
- [x] grep finds process.env.QQ_RESULT_FILE at lines 49 and 63

Test suite: 120 pass, 1 todo, 0 fail across 12 test files.
pnpm lint: main.ts clean; 3 pre-existing formatter errors in unrelated files (bootstrap.ts, debug-log.ts, tsconfig.json) are out of scope.
