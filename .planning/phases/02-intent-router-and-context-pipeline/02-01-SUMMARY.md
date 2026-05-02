---
phase: 02-intent-router-and-context-pipeline
plan: 01
subsystem: api
tags: [typescript, zod, vitest, intent-routing, context-contracts]
requires:
  - phase: 01-shell-bridge-and-result-contract
    provides: shell request transport and split-buffer shell contract
provides:
  - typed phase 2 request and context schemas
  - deterministic classifyIntent router with signal metadata
  - edge-case coverage for git, shell, filesystem, and file-path routing
affects: [phase-02, context-pipeline, claude-provider, foreground-client]
tech-stack:
  added: []
  patterns: [zod schema plus inferred type exports, synchronous rule-based intent routing, table-driven vitest coverage]
key-files:
  created:
    - src/contracts/request.ts
    - src/intent/router.ts
    - tests/intent-router.test.ts
  modified: []
key-decisions:
  - "Intent classification remains fully synchronous and local, with no I/O or provider calls."
  - "unknown intent is reserved for empty or whitespace-only queries; all other unmatched queries fall back to general."
  - "Filesystem keywords route before generic file-path detection so rename/find prompts stay out of codebase intent."
patterns-established:
  - "Phase 2 contracts export Zod schemas and inferred types only, with no runtime logic in contract modules."
  - "Intent routing records signal strings alongside intent and confidence for downstream debug and provider gating."
requirements-completed: [INT-01, INT-02]
duration: 7min
completed: 2026-05-02
---

# Phase 02 Plan 01: Intent contracts and deterministic routing Summary

**Zod-backed request/context contracts with a pure classifyIntent router covering git, package-manager, filesystem, shell, and fallback request classes**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-02T16:54:30Z
- **Completed:** 2026-05-02T17:00:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added the full Phase 2 request contract surface in `src/contracts/request.ts`, including base context, intent decisions, and privacy-safe context chunks.
- Implemented `classifyIntent` as a deterministic synchronous router with explicit signal metadata and empty-query handling.
- Locked the routing behavior down with 28 Vitest cases covering D-01, D-02, D-03, file-path edge cases, and fallback semantics.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define request contracts** - `9b96f9b` (feat)
2. **Task 2 RED: Add failing router tests** - `3f28d1e` (test)
3. **Task 2 GREEN: Implement classifyIntent router** - `3e0b195` (feat)

## Files Created/Modified
- `src/contracts/request.ts` - Exports the typed request, context, and intent decision schemas for Phase 2.
- `src/intent/router.ts` - Implements the pure intent classifier and its signal-detection rules.
- `tests/intent-router.test.ts` - Verifies routing behavior across core rules and edge cases.

## Decisions Made
- Routed filesystem-keyword prompts before generic file-path detection so rename/find requests with filenames classify as `filesystem`, matching the explicit tests and user-facing intent.
- Used `requestIntentSchema.enum` inside the router to keep runtime values anchored to the Zod enum contract.
- Kept shell-command detection ahead of generic file-path detection so literal commands like `ls ./foo.txt` and `cat package.json` stay in `shell-command`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Bypassed broken Homebrew Node/pnpm shims during verification**
- **Found during:** Task 1 verification and Task 2 verification
- **Issue:** `pnpm` resolved through `/usr/local/opt/node/bin/node`, which crashed with `Library not loaded: /usr/local/opt/llhttp/lib/libllhttp.9.3.dylib`.
- **Fix:** Ran `vitest` and `tsc` through the NVM-backed Node binary and Corepack `pnpm.js` entrypoint instead of the broken Homebrew shim.
- **Files modified:** None
- **Verification:** `vitest run tests/intent-router.test.ts` and `tsc --noEmit` both completed successfully through the NVM-backed command path.
- **Committed in:** None (environment-only workaround)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope creep. The workaround only affected local verification commands.

## Issues Encountered
- Running `pnpm` directly mutated `pnpm-lock.yaml` via a different resolver path. That generated diff was removed so the plan stayed scoped to the owned files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 2 now has stable request and routing contracts for the base-context builder and context pipeline work in `02-02`.
- The environment still has a broken Homebrew Node/pnpm shim, so future verification should keep using the NVM/Corepack path until that local install is repaired.

## Self-Check: PENDING

---
*Phase: 02-intent-router-and-context-pipeline*
*Completed: 2026-05-02*
