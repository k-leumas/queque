# T01: 04 01

**Slice:** S06 — **Milestone:** M001

## Description

Add failing test cases to the two existing test files before any implementation
changes. These tests go RED now; Plans 02 and 03 make them GREEN.

Purpose: Validate that the implementation fixes in Wave 1 are complete and
verifiably correct. Tests act as acceptance contracts for each behaviour change.

Output: Extended tests/candidate-select.test.tsx (3 new describe blocks, 4 new
tests) and extended tests/client-result.test.ts (1 new describe block, 1 new
test). All new tests should fail. All 9 existing tests must remain green.

## Must-Haves

- [ ] "tests/candidate-select.test.tsx contains a describe block named 'CandidateSelect — selectedIndex reset on query change' with one failing test"
- [ ] "tests/candidate-select.test.tsx contains a describe block named 'CandidateSelect — zero-match after filter' with one failing test"
- [ ] "tests/candidate-select.test.tsx contains a describe block named 'CandidateSelect — wrapping navigation' with two failing tests"
- [ ] "tests/client-result.test.ts contains a describe block named 'runForegroundClient: resolved guard prevents double write' with one failing test"
- [ ] "pnpm test:run exits non-zero (new tests are RED) while all prior tests remain GREEN"

## Files

- `tests/candidate-select.test.tsx`
- `tests/client-result.test.ts`
