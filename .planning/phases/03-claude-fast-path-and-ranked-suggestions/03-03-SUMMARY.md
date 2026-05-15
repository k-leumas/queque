---
phase: 03
plan: 03
subsystem: shell-integration
tags: [zsh, widget, error-handling, safe-01, tdd]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [error-kind-handling-in-zsh-widget]
  affects: [shell/zsh/qq.zsh, tests/zsh-widget.test.ts]
tech_stack:
  added: []
  patterns: [tdd-red-green, zsh-case-block-extension]
key_files:
  created: []
  modified:
    - shell/zsh/qq.zsh
    - tests/zsh-widget.test.ts
decisions:
  - error kind returns 0 in _qq_apply_result (expected/known kind, not wildcard failure)
  - both case blocks updated in parallel to prevent test-pass/runtime-fail divergence (Pitfall 4)
  - message field intentionally NOT applied to LBUFFER/RBUFFER (T-03-07/T-03-08 mitigation)
metrics:
  duration: ~4 minutes
  completed_date: "2026-05-15T11:45:40Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 03 Plan 03: Error Kind Handling in ZSH Widget Summary

Adds explicit `error)` case handling to both the `_qq_apply_result` helper and the `qq-question-widget` inline case block in `shell/zsh/qq.zsh`. Completes SAFE-01: the shell buffer is never mutated when the provider returns an error.

## What Was Built

Added `error)` case to two locations in `qq.zsh`:

1. `_qq_apply_result` function (lines ~126–132): restores `QQ_ORIG_LBUFFER`/`QQ_ORIG_RBUFFER` and returns 0 — error is a known, expected kind distinct from the wildcard unknown-kind path.

2. `qq-question-widget` inline case block (lines ~228–232): restores original buffers without a return statement (widget block does not return meaningful exit codes to ZLE).

Added test to `tests/zsh-widget.test.ts`: verifies `_qq_apply_result` exits 0 and restores original buffers when given `{"kind":"error","message":"..."}`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add failing test for error kind (TDD RED) | 14f278b | tests/zsh-widget.test.ts |
| 2 | Add error) case to qq.zsh (TDD GREEN) | 5a0add7 | shell/zsh/qq.zsh |

## Verification

- `grep -c 'error)' shell/zsh/qq.zsh` outputs 2 (one per case block)
- `_qq_apply_result` exits 0 and restores buffers for error kind (manual spot check passed)
- Full suite: 113/113 tests pass

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The `error)` case explicitly does NOT apply the `message` field to the shell buffer, mitigating T-03-07 and T-03-08 (shell metacharacter injection via provider error messages).

## TDD Gate Compliance

- RED gate: commit `14f278b` — test(03-03): add failing test for _qq_apply_result error kind (RED)
- GREEN gate: commit `5a0add7` — feat(03-03): add error) case to both case blocks in qq.zsh (GREEN)

## Self-Check: PASSED

- [x] `tests/zsh-widget.test.ts` modified in worktree at correct path
- [x] `shell/zsh/qq.zsh` modified in worktree at correct path
- [x] Commit 14f278b exists (test RED)
- [x] Commit 5a0add7 exists (feat GREEN)
- [x] 113 tests pass in full suite
- [x] `grep -c 'error)' shell/zsh/qq.zsh` = 2
