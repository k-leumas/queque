# S06: Fuzzy Tui Selection Ux

**Goal:** Add failing test cases to the two existing test files before any implementation
changes.
**Demo:** Add failing test cases to the two existing test files before any implementation
changes.

## Must-Haves


## Tasks

- [x] **T01: 04 01**
  - Add failing test cases to the two existing test files before any implementation
changes. These tests go RED now; Plans 02 and 03 make them GREEN.

Purpose: Validate that the implementation fixes in Wave 1 are complete and
verifiably correct. Tests act as acceptance contracts for each behaviour change.

Output: Extended tests/candidate-select.test.tsx (3 new describe blocks, 4 new
tests) and extended tests/client-result.test.ts (1 new describe block, 1 new
test). All new tests should fail. All 9 existing tests must remain green.
- [x] **T02: 04 02** `est:8min`
  - Add the missing useEffect([query]) hook to CandidateSelect.tsx so that
selectedIndex resets to 0 whenever the search query changes. This prevents
out-of-bounds array access when a filter narrows the visible candidate list
while the selection index points beyond the new list end.

Purpose: Closes the CMD-03 edge case identified in Phase 4 research (Pitfall 1).
Makes the previously-RED test from Plan 01 GREEN.

Output: One new useEffect call in src/ui/CandidateSelect.tsx. All 8 tests in
tests/candidate-select.test.tsx GREEN. No other files changed.
- [x] **T03: 04 03**
  - Add top-level uncaughtException and unhandledRejection handlers to main.ts so
that any fatal error that escapes the run-foreground.ts try/catch still writes
{kind:'cancel'} to the FIFO before the process exits. Without this, a crash
before or after the Promise block would leave the zsh widget blocking on the
FIFO read for up to 30 seconds.

Purpose: Closes RUN-02 Pitfall 3 from the Phase 4 research. The resolved flag
in run-foreground.ts handles races within the Promise block; the handlers in
main.ts cover crashes that escape the Promise block entirely.

Output: src/cli/main.ts with process.on('uncaughtException') and
process.on('unhandledRejection') registered before the isDirectRun guard. The
handlers read QQ_RESULT_FILE from the environment, write cancel if set, then
re-exit. No other files changed.

## Files Likely Touched

- `tests/candidate-select.test.tsx`
- `tests/client-result.test.ts`
- `src/ui/CandidateSelect.tsx`
- `src/cli/main.ts`
- `shell/zsh/qq.zsh`
