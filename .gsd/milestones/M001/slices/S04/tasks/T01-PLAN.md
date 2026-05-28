# T01: 03.1 01

**Slice:** S04 — **Milestone:** M001

## Description

Wave 0: Establish test infrastructure for Phase 03.1.

Three gaps block the phase from being verifiable:
1. vitest.config.ts only matches `.test.ts` — a new `.test.tsx` file won't be discovered.
2. `tests/client-result.test.ts` line 299 asserts `"QueQue is thinking..."` which D-05 removes.
3. `tests/client-result.test.ts` has a single-candidate test that assumes the fast-accept bypass (D-03 removes it).

This plan closes all three gaps before any implementation work begins, so subsequent waves have green baselines.

Purpose: Ensure pnpm test:run is green before Wave 1 touches any source files. Prevents "is this my change or a pre-existing failure?" ambiguity during execution.
Output: vitest.config.ts (updated), tests/client-result.test.ts (updated), tests/candidate-select.test.tsx (new scaffold with failing tests for Wave 2 to make green).

## Must-Haves

- [ ] "pnpm test:run exits 0 after Wave 0 changes (no failing pre-existing assertions)"
- [ ] "tests/candidate-select.test.tsx is discovered by vitest and runs"
- [ ] "The raw ANSI assertion 'QueQue is thinking...' is gone from client-result.test.ts"
- [ ] "The single-candidate fast-accept test is updated to reflect modal-always behavior"

## Files

- `vitest.config.ts`
- `tests/client-result.test.ts`
- `tests/candidate-select.test.tsx`
