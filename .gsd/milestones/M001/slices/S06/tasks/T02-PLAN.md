# T02: 04 02

**Slice:** S06 — **Milestone:** M001

## Description

Add the missing useEffect([query]) hook to CandidateSelect.tsx so that
selectedIndex resets to 0 whenever the search query changes. This prevents
out-of-bounds array access when a filter narrows the visible candidate list
while the selection index points beyond the new list end.

Purpose: Closes the CMD-03 edge case identified in Phase 4 research (Pitfall 1).
Makes the previously-RED test from Plan 01 GREEN.

Output: One new useEffect call in src/ui/CandidateSelect.tsx. All 8 tests in
tests/candidate-select.test.tsx GREEN. No other files changed.

## Must-Haves

- [ ] "CandidateSelect.tsx has a useEffect with [query] in its dependency array that calls setSelectedIndex(0)"
- [ ] "The useEffect([query]) is placed immediately after the existing useEffect([candidates]) block"
- [ ] "pnpm test:run exits 0 with all tests GREEN (the previously-RED 'selectedIndex reset on query change' test is now GREEN)"
- [ ] "Arrow-key wrapping, zero-match guard, and Enter accept all confirmed working by passing tests"

## Files

- `src/ui/CandidateSelect.tsx`
