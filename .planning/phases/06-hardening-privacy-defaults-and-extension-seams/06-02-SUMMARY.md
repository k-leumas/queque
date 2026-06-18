---
phase: 06-hardening-privacy-defaults-and-extension-seams
plan: 02
subsystem: testing
tags: [registry, resolver, privacy, provider, extension-seams]

requires:
  - phase: 06-hardening-privacy-defaults-and-extension-seams
    plan: 01
    provides: filterContextEnvelope pipeline integration and privacy regression tests
provides:
  - buildPrompt defense-in-depth via filterContextEnvelope before chunk extraction
  - resolveAdapter pre-bootstrap guard with user-facing error message
  - client-result tests for resolveAdapter throw → error ShellResult
  - claude-provider tests for filesystem metadata and .env path stripping in prompts
  - init.ts defensive bootstrap comment aligned with shell-adapters registry
affects:
  - 06-03-PLAN.md

tech-stack:
  added: []
  patterns:
    - "Verify-and-extend: registry/resolver wiring already existed; closed test and privacy gaps"
    - "buildPrompt filters envelope even when pipeline already filtered (defense-in-depth)"
    - "client-result tests reset resolver/detect mocks in beforeEach to prevent leak"

key-files:
  created: []
  modified:
    - src/providers/claude.ts
    - src/providers/resolver.ts
    - src/registry/bootstrap.ts
    - src/cli/commands/init.ts
    - tests/provider-resolver.test.ts
    - tests/client-result.test.ts
    - tests/claude-provider.test.ts

key-decisions:
  - "buildPrompt calls filterContextEnvelope before git/filesystem chunk extraction"
  - "Missing claude adapter error references bootstrapBuiltins() for developer clarity"

patterns-established:
  - "runForegroundClient path: detectProvider → resolveAdapter → adapter.fetchCandidates (no direct claude import)"
  - "client-result beforeEach restores resolveAdapter/detectProvider mocks after override tests"

requirements-completed: [CMD-04, EXT-01]

duration: 20min
completed: 2026-06-18
---

# Phase 06 Plan 02: Registry Provider Resolution Summary

**Registry-backed provider resolution verified with defense-in-depth privacy in buildPrompt, pre-bootstrap resolver guards, and six new integration tests — run-foreground already used resolveAdapter.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3 (verify + extend)
- **Files modified:** 7
- **Tests:** 194 passing (was 188; +6 new tests)

## Accomplishments

- Verified `run-foreground.ts` resolves via `resolveAdapter(detectProvider())` with no direct `claude.ts` import
- Added `filterContextEnvelope` to `buildPrompt` before git/filesystem chunk extraction (defense-in-depth)
- Updated `resolveAdapter` missing-adapter error to reference `bootstrapBuiltins()`
- Extended resolver tests: pre-bootstrap throw, `none` kind message propagation
- Extended client-result tests: `resolveAdapter` throw and ollama-not-wired → error ShellResult
- Extended claude-provider tests: filesystem `apparentFilename` in prompt; `.env` stripped from git paths

## Task Commits

Per user instruction: **no commits made** — all tasks verified passing before commit gate.

## Files Created/Modified

- `src/providers/claude.ts` — `buildPrompt` filters envelope via `filterContextEnvelope` before JSON assembly
- `src/providers/resolver.ts` — user-facing bootstrap guard message
- `src/registry/bootstrap.ts` — comment documenting main.ts + init.ts defensive bootstrap
- `src/cli/commands/init.ts` — defensive bootstrap comment
- `tests/provider-resolver.test.ts` — pre-bootstrap and none-kind tests
- `tests/client-result.test.ts` — resolveAdapter error paths; mock reset in beforeEach
- `tests/claude-provider.test.ts` — filesystem metadata and .env stripping assertions

## Verification Performed

| Criterion | Status |
|-----------|--------|
| `run-foreground.ts` imports `resolveAdapter` not `fetchCandidates` from claude | Verified |
| `bootstrapBuiltins()` idempotent (twice, no throw) | Verified (existing test) |
| `resolveAdapter` pre-bootstrap throws clear message | Verified (+ test) |
| `resolveAdapter` throw → error ShellResult | Verified (+ test) |
| `buildPrompt` calls `filterContextEnvelope` | Implemented + tested |
| `.env` path stripped from prompt JSON | Verified (+ test) |
| `init.ts` calls `bootstrapBuiltins()` before `listShellAdapters()` | Verified |
| No stale `vi.mock.*claude` on client path | Verified (grep clean) |
| `pnpm test:run` exits 0 | **194/194 pass** |
| `pnpm tsc --noEmit` | Pass |

## Decisions Made

- Kept bootstrap idempotency via existing `bootstrapped` flag (registry-bootstrap test already covered)
- Resolver error message uses `bootstrapBuiltins()` wording per plan (replacing daemon-restart hint)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mock leak in client-result tests after resolveAdapter override tests**
- **Found during:** Task 2 (resolveAdapter throw tests)
- **Issue:** Overridden `resolveAdapter`/`detectProvider` mocks leaked into subsequent tests causing false failures
- **Fix:** Added beforeEach mock restoration in `runForegroundClient` and resolved-guard describe blocks
- **Files modified:** `tests/client-result.test.ts`

---

**Total deviations:** 1 auto-fixed (Rule 1 test isolation)
**Impact on plan:** Test infrastructure only; no production behavior change beyond planned gaps.

## Issues Encountered

Daemon socket tests require full permissions in sandbox (EPERM on listen) — resolved by running `pnpm test:run` outside sandbox.

## User Setup Required

None.

## Next Phase Readiness

- Extension seams verified: single resolution path through registry
- Ready for 06-03 (remaining hardening items)

## Self-Check: PASSED

- `src/providers/claude.ts` — FOUND (filterContextEnvelope in buildPrompt)
- `tests/provider-resolver.test.ts` — FOUND (pre-bootstrap test)
- `tests/client-result.test.ts` — FOUND (resolveAdapter throw tests)
- `tests/claude-provider.test.ts` — FOUND (.env stripping test)
- All 194 tests — PASS

---
*Phase: 06-hardening-privacy-defaults-and-extension-seams*
*Completed: 2026-06-18*
