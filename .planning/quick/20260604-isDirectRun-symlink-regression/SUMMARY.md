---
slug: isDirectRun-symlink-regression
status: complete
completed: 2026-06-04
---

# Summary: isDirectRun Symlink Regression Tests

Added `tests/main-direct-run.test.ts` with 5 regression tests for bug-159.

Tests cover:
- Real path match (dev/npm global) → `isDirectRun = true`
- Bare symlink without realpathSync (pre-fix) → `isDirectRun = false` (documents bug)
- Symlink resolved via realpathSync (post-fix) → `isDirectRun = true`
- `undefined` argv guard
- URL construction round-trip for both Homebrew and opt/homebrew paths

Commit: `ba24b04`
