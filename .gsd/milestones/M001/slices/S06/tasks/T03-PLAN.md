# T03: 04 03

**Slice:** S06 — **Milestone:** M001

## Description

Add top-level uncaughtException and unhandledRejection handlers to main.ts so
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

## Must-Haves

- [ ] "main.ts registers process.on('uncaughtException') and process.on('unhandledRejection') handlers before calling main()"
- [ ] "Both handlers read the FIFO path from process.env.QQ_RESULT_FILE and write {kind:'cancel'} if the path is set and the process has not already written a result"
- [ ] "pnpm test:run exits 0 with all tests GREEN after the change"
- [ ] "The handler behavioral tests added in 04-01 Task 3 (uncaughtException and unhandledRejection writes cancel to QQ_RESULT_FILE) pass GREEN"

## Files

- `src/cli/main.ts`
- `shell/zsh/qq.zsh`
