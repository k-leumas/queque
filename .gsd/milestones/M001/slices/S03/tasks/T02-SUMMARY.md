---
id: T02
parent: S03
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
# T02: 03 02

**# Phase 03 Plan 02: Confidence Propagation, Error ShellResult, and Claude Backend Registration Summary**

## What Happened

# Phase 03 Plan 02: Confidence Propagation, Error ShellResult, and Claude Backend Registration Summary

JWT-style confidence field wired from classifyIntent into NormalizedRequest; typed error ShellResult replaces cancel on failure; Claude provider backend descriptor registered in bootstrapBuiltins.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add failing test for error ShellResult (RED) | 80919e1 | tests/client-result.test.ts |
| 2 | Add confidence field, error ShellResult, bootstrap registration (GREEN) | 7e82d68 | src/contracts/request.ts, src/client/run-foreground.ts, src/registry/bootstrap.ts, tests/client-result.test.ts, tests/registry-bootstrap.test.ts |

## What Was Built

**src/contracts/request.ts**
- Extended `normalizedRequestSchema` with `confidence: z.number().min(0).max(1)` field
- `NormalizedRequest` type auto-infers the new field (no manual type change needed)

**src/client/run-foreground.ts**
- Line ~96: NormalizedRequest construction updated to `{ ...request, intent: decision.intent, confidence: decision.confidence }`
- Inner `.catch()` for `fetchCandidates`: writes `{ kind: 'error', message: 'QueQue: ... — press any key' }` to resultFile and unmounts the Ink UI; `resolved` guard prevents double-write
- Outer `catch`: changed from `{ kind: 'cancel' }` to `{ kind: 'error', message: 'QueQue: ... — press any key' }` for broader failure cases

**src/registry/bootstrap.ts**
- Added import: `import { registerProviderBackend } from './provider-backends.js'`
- Registers `{ id: 'claude', name: 'Claude (Anthropic)', description: 'Anthropic Claude adapter — default LLM backend' }` in `bootstrapBuiltins()`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] fetchCandidates rejection cannot reach outer catch without modification**
- **Found during:** Task 2 GREEN implementation
- **Issue:** The plan spec says "outer catch writes error ShellResult" AND "test proves fetchCandidates rejection leads to error kind". These are contradictory: the inner `.catch()` handles `fetchCandidates` rejection without propagating to the outer catch; and the ink mock fires `onSelect` as a microtask before any rejection propagates, so the outer promise resolves via `onSelect` with `replace-buffer`.
- **Fix:** Changed the inner `.catch()` to write the error ShellResult and call `unmount()` directly (in addition to the outer catch). Added `if (resolved) return` guard to prevent double-write. Updated the ink render mock to only fire `onSelect` when candidates is non-null (consistent with the rerender mock behavior), preventing the race condition.
- **Files modified:** src/client/run-foreground.ts, tests/client-result.test.ts
- **Commit:** 7e82d68

**2. [Rule 1 - Bug] registry-bootstrap tests fail after adding registerProviderBackend to bootstrapBuiltins**
- **Found during:** Task 2 GREEN implementation
- **Issue:** `bootstrapBuiltins()` now calls `registerProviderBackend({ id: 'claude', ... })`, but `tests/registry-bootstrap.test.ts` beforeEach only cleared context providers, shell adapters, and storage hooks — not provider backends. The second call in the idempotency test threw "Provider backend already registered: 'claude'".
- **Fix:** Added `import { clearProviderBackends } from '../src/registry/provider-backends.js'` and `clearProviderBackends()` to the test's `beforeEach`.
- **Files modified:** tests/registry-bootstrap.test.ts
- **Commit:** 7e82d68

## Verification

- `pnpm test:run` (from worktree): 113 tests pass, 12 test files pass
- `pnpm build` (via npx tsup): ESM build success, DTS build success
- `grep -c "confidence: decision.confidence" src/client/run-foreground.ts` → 1
- `grep -c "kind: 'error'" src/client/run-foreground.ts` → 2 (inner catch + outer catch)
- `grep -c "QueQue:" src/client/run-foreground.ts` → 2
- `grep -c "registerProviderBackend" src/registry/bootstrap.ts` → 2 (import + call)
- `grep -c "confidence: z.number" src/contracts/request.ts` → 2 (schema + IntentDecision)

## TDD Gate Compliance

- RED gate: `test(03-02): add failing test for error ShellResult on fetchCandidates rejection` (commit 80919e1) — confirmed fail with `expected 'replace-buffer' to be 'error'`
- GREEN gate: `feat(03-02): add confidence to NormalizedRequest, error ShellResult on failure, register Claude backend` (commit 7e82d68) — all 113 tests pass

## Known Stubs

None.

## Threat Flags

None beyond the threat model in the plan (T-03-04, T-03-05, T-03-06 — all addressed or accepted as per plan).

## Self-Check: PASSED

All files created/modified:
- FOUND: src/contracts/request.ts
- FOUND: src/client/run-foreground.ts
- FOUND: src/registry/bootstrap.ts
- FOUND: tests/client-result.test.ts
- FOUND: tests/registry-bootstrap.test.ts
- FOUND: 03-02-SUMMARY.md

All commits:
- FOUND: 80919e1 (Task 1 - RED)
- FOUND: 7e82d68 (Task 2 - GREEN)
