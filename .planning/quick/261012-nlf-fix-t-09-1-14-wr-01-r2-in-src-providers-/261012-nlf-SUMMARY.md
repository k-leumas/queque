---
phase: quick-261012-nlf
plan: 01
subsystem: providers
status: complete
tags: [09.1, review-fix, WR-01-r2, T-09.1-14, stop_reason, fail-closed, provider]
requires: [09.1-10]
provides:
  - isNormalStopReason allow list (end_turn, stop_sequence) in src/providers/provider.ts
  - finalCandidateList, the one final-list rule for the SDK and claude -p paths
  - 'truncated' ClaudeTurnFailure with stopReason for claude -p results
affects: [src/providers/claude.ts, src/providers/claude-process.ts, src/providers/claude-cli.ts, src/providers/claude-default.ts]
tech-stack:
  added: []
  patterns: [allow-list gate over provider stop reasons]
key-files:
  created: []
  modified:
    - src/providers/provider.ts
    - src/providers/claude.ts
    - src/providers/stream-json.ts
    - src/providers/claude-process.ts
    - src/providers/claude-cli.ts
    - src/providers/claude-default.ts
    - tests/claude-provider.test.ts
    - tests/claude-process.test.ts
    - tests/fixtures/fake-claude-stream.mjs
    - tests/claude-cli-provider.test.ts
    - tests/claude-cli-prewarm.test.ts
    - .planning/phases/09.1-provider-latency-and-cancellation/09.1-REVIEW-DISPOSITION.md
key-decisions:
  - "Only end_turn and stop_sequence count as a finished answer; every other stop reason (null and future values included) fails closed"
  - "A claude -p result with no stop_reason key counts as end_turn (older Claude Code builds); a null value fails closed"
  - "A truncated warm claude -p turn is never retried cold (no second paid turn)"
requirements: [quick-261012-nlf, WR-01-r2, T-09.1-14]
duration: ~35 min
completed: 2026-10-12
estimate:
  tokens: 90000
  tasks: 3
actuals:
  tokens: 14600
  tasks: 3
  commits: 3
plan_head_before: 213428eafff2a706c3200c3ab43724151b9ca23e
plan_head_after: 6c5b261776595ab66a4f0441a63855cca592383a
---

# Phase quick-261012-nlf Plan 01: Fail closed on every non-normal stop reason Summary

The SDK and `claude -p` paths now use the same allow list (`isNormalStopReason`: `end_turn`, `stop_sequence`) and the same final-list rule (`finalCandidateList`). On any other stop reason they keep only the strict list, the streamed rows or the candidate objects that closed. If none closed, they throw `TRUNCATED_RESPONSE_MESSAGE`. A `refusal` fragment such as `[{"command": "find . -name` can no longer reach the prose fallback and the shell buffer.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 (tracer) | 3541ffb | fix(09.1): fail closed on every non-normal sdk stop reason (WR-01-r2) |
| 2 | cc0e989 | fix(09.1): reject a claude -p result with a non-normal stop reason (WR-01-r2) |
| 3 | 6c5b261 | fix(09.1): keep closed rows or throw the truncation copy on claude -p (WR-01-r2) |

## What changed

- **Task 1 (SDK path):** `provider.ts` exports `isNormalStopReason`. `claude.ts` exports `finalCandidateList(text, streamed, finishedNormally, logFields)`. It replaces the strict/streamed/max_tokens/parseCandidates chain in `fetchCandidates`, which now passes `isNormalStopReason(message.stop_reason)`. The `response truncated` log holds only `{ model, stopReason }`. No code line compares the stop reason to `'max_tokens'` any more.
- **Task 2 (claude -p runner):** `streamJsonResultSchema` gains `stop_reason: z.string().nullable().optional()`. `runClaudeTurn` rejects a non-error result whose stop_reason is present and not normal. The failure has reason `'truncated'`, the result text as `stdout` and the value as `stopReason`, and no `result` stage is emitted. The backstop is still armed. The fixture gains `writeStopReasonTurn` and four scenarios: `refusal`, `null-stop-reason`, `stop-sequence` and `no-stop-reason`.
- **Task 3 (claude -p adapter):** `claude-cli.ts` catches only a `truncated` failure around both the warm and the cold attempt and routes it through `finalCandidateList(..., false, { stopReason })`. `isStalePrewarmFailure` is unchanged, so a truncated warm turn is never retried cold. In `claude-default.ts`, `hardError` returns a `TRUNCATED_RESPONSE_MESSAGE` error unchanged before the ENOENT, timeout and D13 mappings. The ledger now has WR-01-r2 as `fixed` (open 6 → 5), and bug-331 plus the cerebrum entries are recorded.

## Verification

- `pnpm exec vitest run` (full suite): 38 files, 791 tests passed.
- Target files (`claude-provider`, `claude-process`, `claude-cli-provider`, `claude-cli-prewarm`): 122 passed. Before the change the baseline was 102, so this plan adds 20 tests and deletes none.
- `pnpm exec tsc --noEmit` is clean. `pnpm exec biome check src/providers <test files> tests/fixtures/fake-claude-stream.mjs` reports no fixes.
- RED was observed before each GREEN. Task 1 had 8 failing cases, Task 2 had 2 (refusal and null resolved) and Task 3 had 5 (D13 copy shown). The prewarm `truncated` row passed already, because `isStalePrewarmFailure` never matched `truncated`. It now locks that behaviour.
- After Task 1 the tracer gate re-ran the `<verify>` block end to end: it passed, so expansion went ahead.
- All three commit subjects end in `(WR-01-r2)`. Every line is 100 characters or less, and none has a Co-Authored-By trailer.
- `09.1-SECURITY.md` is unmodified (`git diff --quiet HEAD` passes).

## Deviations from Plan

**1. [Rule 3 - Blocking] The runner gate is written as `isNormalStopReason(parsed.data.stop_reason)`**
- **Found during:** Task 2
- **Issue:** The first version tested a local `stopReason` variable. The plan's automated verify greps for the literal `isNormalStopReason(parsed.data.stop_reason)`.
- **Fix:** The call now takes the property access directly. A local variable still carries the value into the failure fields. Behaviour is unchanged.
- **Files modified:** src/providers/claude-process.ts
- **Commit:** cc0e989

No other deviations. The plan was otherwise executed as written.

## Known Stubs

None.

## Threat Flags

None. No new surface: the log detail is still only the model and the stop reason, never the text, stdout, prompt or argv (T-261012-nlf-04).

## Follow-up for the orchestrator

Re-run `/gsd-secure-phase 09.1` to close T-09.1-14. This plan did not edit 09.1-SECURITY.md.

## Self-Check: PASSED

- Every modified file exists, and the working tree was clean after the Task 3 commit.
- Commits 3541ffb, cc0e989 and 6c5b261 are ancestors of HEAD. `git rev-list --count 213428e..HEAD` = 3.
