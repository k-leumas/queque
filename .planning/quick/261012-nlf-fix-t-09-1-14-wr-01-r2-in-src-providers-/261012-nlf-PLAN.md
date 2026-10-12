---
phase: quick-261012-nlf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/providers/provider.ts
  - src/providers/claude.ts
  - tests/claude-provider.test.ts
  - src/providers/stream-json.ts
  - src/providers/claude-process.ts
  - tests/fixtures/fake-claude-stream.mjs
  - tests/claude-process.test.ts
  - src/providers/claude-cli.ts
  - src/providers/claude-default.ts
  - tests/claude-cli-provider.test.ts
  - tests/claude-cli-prewarm.test.ts
  - .planning/phases/09.1-provider-latency-and-cancellation/09.1-REVIEW-DISPOSITION.md
  - .wolf/anatomy.md
  - .wolf/memory.md
  - .wolf/buglog.json
  - .wolf/cerebrum.md
autonomous: true
requirements: [quick-261012-nlf, WR-01-r2, T-09.1-14]

estimate:
  tokens: 90000
  raw_tokens: 90000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "SDK path (T-09.1-14, WR-01-r2): if the streamed answer stops for any reason other than end_turn or stop_sequence (refusal, pause_turn, tool_use, model_context_window_exceeded, max_tokens, null, or an unknown future value), and there is no strict list and no streamed row, the text never reaches the parseCandidates prose fallback. Only the candidate objects that closed are kept, and with none the fetch rejects with TRUNCATED_RESPONSE_MESSAGE. The review's case, stopReason 'refusal' with the fragment `[{\"command\": \"find . -name`, rejects and onCandidate is never called"
    - "claude -p path (WR-01-r2): if a `result` event has a stop_reason key whose value is not end_turn or stop_sequence (including null), runClaudeTurn rejects with reason 'truncated'. The failure carries the result text as stdout and the value as stopReason. The adapter then keeps the strict list, the streamed rows, or the closed objects in the result text, and otherwise throws TRUNCATED_RESPONSE_MESSAGE. It never uses the prose fallback"
    - "Explicit compatibility decision: if a claude -p `result` has no stop_reason key at all (older Claude Code builds, and the Probe 3 auth result), it is treated as end_turn and resolves as before. A null stop_reason fails closed. Both are covered by fixture-backed runner tests"
    - "A /login user whose claude -p turn is cut off sees `QueQue: Claude response was truncated`, the same copy as the SDK path, and never the 'Claude is not authenticated' D13 copy. A truncated warm (prewarmed) turn is never retried cold"
    - "Normal answers are unchanged: end_turn and stop_sequence keep the order strict parse, then streamed rows, then the prose fallback. The WR-07 max_tokens tests and every existing provider test stay green, and no test is deleted"
    - "WR-01-r2 is `fixed` in 09.1-REVIEW-DISPOSITION.md (open 6 → 5), and bug-331 is logged in .wolf/buglog.json. 09.1-SECURITY.md is not edited by this plan: T-09.1-14 is closed by the orchestrator re-running /gsd-secure-phase 09.1"
  artifacts:
    - path: "src/providers/provider.ts"
      provides: "isNormalStopReason(stopReason): true only for end_turn and stop_sequence, shared by the SDK and claude -p paths"
      contains: "export function isNormalStopReason"
    - path: "src/providers/claude.ts"
      provides: "finalCandidateList(text, streamed, finishedNormally, logFields), the one final-list rule for both paths. fetchCandidates calls it with isNormalStopReason(message.stop_reason)"
      contains: "export function finalCandidateList"
    - path: "src/providers/stream-json.ts"
      provides: "streamJsonResultSchema with an optional, nullable stop_reason"
      contains: "stop_reason: z.string().nullable().optional()"
    - path: "src/providers/claude-process.ts"
      provides: "ClaudeTurnFailureReason 'truncated' and ClaudeTurnFailure.stopReason. runClaudeTurn rejects a non-error result whose stop_reason is present and not normal"
      contains: "'truncated'"
    - path: "src/providers/claude-cli.ts"
      provides: "A truncated failure from the warm or cold attempt goes to finalCandidateList(..., false, ...), and it is never retried cold"
      contains: "finalCandidateList("
    - path: "src/providers/claude-default.ts"
      provides: "hardError passes TRUNCATED_RESPONSE_MESSAGE through unchanged"
      contains: "TRUNCATED_RESPONSE_MESSAGE"
    - path: "tests/fixtures/fake-claude-stream.mjs"
      provides: "Scenarios refusal, null-stop-reason, stop-sequence, no-stop-reason"
      contains: "no-stop-reason"
  key_links:
    - from: "src/providers/claude.ts fetchCandidates"
      to: "finalCandidateList"
      via: "isNormalStopReason(message.stop_reason) decides whether the prose fallback is reachable"
      pattern: "isNormalStopReason\\(message\\.stop_reason\\)"
    - from: "src/providers/claude-process.ts handleEvent"
      to: "src/providers/claude-cli.ts fetchClaudeCliCandidates"
      via: "a 'truncated' ClaudeTurnFailure (stdout = result text, stopReason) caught around both attempts, then finalCandidateList with finishedNormally false"
      pattern: "reason === 'truncated'"
    - from: "src/providers/claude-default.ts hardError"
      to: "the client's error copy"
      via: "TRUNCATED_RESPONSE_MESSAGE is returned unchanged before the D13 mapping"
      pattern: "TRUNCATED_RESPONSE_MESSAGE"
---

<objective>
Close security threat T-09.1-14 and review finding WR-01-r2. Today the SDK path fails closed only for `max_tokens`. A streamed `refusal` (or `pause_turn`, a null stop, or any new stop reason) that leaves partial text such as `[{"command": "find . -name` still reaches `parseCandidates`. Its prose fallback then offers the fragment for insertion into the shell buffer. The `claude -p` path does not check the `result` event's `stop_reason` at all.

The fix is an allow list. Only `end_turn` and `stop_sequence` count as a finished answer. On every other stop, both paths keep only rows that closed (the strict list, streamed rows, or closed objects in the text) or throw `TRUNCATED_RESPONSE_MESSAGE`. They never use the prose fallback.

Purpose: model output must never become a shell-buffer command because a stop reason other than `max_tokens` cut it off. Normal answers must not change.
Output: a shared `isNormalStopReason` predicate and `finalCandidateList` rule; a `truncated` runner failure for `claude -p`; correct error copy for `/login` users; tests for refusal, null, stop_sequence and absent stop reasons; WR-01-r2 recorded as fixed.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-SECURITY.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-REVIEW.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-REVIEW-DISPOSITION.md
@src/providers/claude.ts
@src/providers/provider.ts
@src/providers/claude-process.ts
@src/providers/stream-json.ts
@src/providers/claude-cli.ts
@src/providers/claude-default.ts

Live observations at planning time (verified by reading the code, 2026-10-12):
- src/providers/claude.ts:260-280. After `stream.finalMessage()` the final list is the strict parse, then the streamed rows, then a branch that checks only for the max_tokens stop reason (WR-07: completeCandidates or throw TRUNCATED_RESPONSE_MESSAGE), then `parseCandidates(text)`, whose catch at :119-123 turns any non-JSON text into a command. `completeCandidates` (:99-105) and `TRUNCATED_RESPONSE_MESSAGE` (:31) already exist.
- In the SDK 0.92.0 types (node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts:874), `StopReason` is 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | 'pause_turn' | 'refusal', and `Message.stop_reason` is `StopReason | null`.
- src/providers/stream-json.ts:19-25. `streamJsonResultSchema` (non-strict zod) has no `stop_reason`. In src/providers/claude-process.ts:338-371, `handleEvent` arms the backstop, safeParses the result, rejects `is-error` when `is_error` is set, and otherwise resolves `parsed.data.result ?? ''`.
- 09.1-RESEARCH.md Probe 2 (Claude Code 2.1.285) records the `result` keys, which include `stop_reason`, for example `"stop_reason":"end_turn"`. The Probe 3 auth result shows no `stop_reason`. In tests/fixtures/fake-claude-stream.mjs, the `success` result carries `stop_reason: 'end_turn'` (:149). The `auth` (:172-181) and `sigterm-slow` (:200) results have no stop_reason key.
- src/providers/claude-cli.ts:142-168. The warm attempt is retried cold only for `exit-without-result` or `stale-prewarm` (isStalePrewarmFailure, :180-186). Then `parseStrictCandidateList(text) ?? (streamed.length > 0 ? streamed : parseCandidates(text))`.
- src/providers/claude-default.ts. `hardError` maps every CLI error that is not ENOENT and not a timeout to D13_MESSAGE ("Claude is not authenticated"). If nothing changes, a CLI truncation error would show the login copy. The SDK branch is a direct return and already shows TRUNCATED_RESPONSE_MESSAGE.
- Tests: tests/claude-provider.test.ts:73-150. FakeStreamScript.stopReason is `string` and is applied with `??`, so null cannot be scripted yet. The WR-07 tests are at :517-549. tests/claude-cli-provider.test.ts mocks runClaudeTurn: loggedOutError/killedError shapes at :133-157, playDeltas at :752-766. In tests/claude-cli-prewarm.test.ts, `never retries a warm %s failure` is an it.each at :324-337. tests/claude-process.test.ts runs the real fixture through `startTurn(scenario)` (:58-84).
- No other code switches exhaustively on ClaudeTurnFailureReason or StreamJsonResult, so adding a union member is type-safe.
- Baseline: `pnpm exec vitest run tests/claude-provider.test.ts tests/claude-process.test.ts tests/claude-cli-provider.test.ts tests/claude-cli-prewarm.test.ts` passed, 102 tests, 9.4 s.

Rules for every task:
- OpenWolf: check .wolf/anatomy.md before you read a file. Respect the .wolf/cerebrum.md Do-Not-Repeat list. Read .wolf/buglog.json before you log a bug.
- Concurrency: another session has uncommitted changes. Commit by explicit path only, with `git commit -m "<header>" -m "<body>" -- <paths>`. Never use `git add -A`, `git add .` or `git commit -a`. This plan creates no new files. Never stage or touch CHANGELOG.md, scripts/semantic-release-user-notes.mjs, tests/semantic-release-user-notes.test.ts, pnpm-lock.yaml, .pnpm-store/, .planning/quick/261012-kp1-*, .planning/milestone.lock, screen-cap-filename.mov or .wolf/hooks/_session.json.
- Before staging, run `pnpm exec biome check --write <the task's code files>`, then review its changes.
- commitlint: the header and every body line must be 100 characters or less. The subject starts with a lowercase word. Put the review ID at the end of the subject, like the precedent `fix(09.1): fail closed on a truncated sdk answer and raise max_tokens (WR-07)`. Add NO Co-Authored-By trailer (user rule).
- Stage the .wolf/ files that the task edited in the same commit as its code. Never make a wolf-only commit.
- Rewrite tests to fit the new contracts. Never delete one. `rm` and `cp` are interactive aliases, so use /bin/rm -f and /bin/cp -f. Use `/usr/local/bin/git` whenever an exit status decides something.
- Do NOT edit .planning/phases/09.1-provider-latency-and-cancellation/09.1-SECURITY.md.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: tracer, a refusal stop fails closed end to end on the SDK path (claudeAdapter)</name>
  <files>src/providers/provider.ts, src/providers/claude.ts, tests/claude-provider.test.ts, .wolf/anatomy.md, .wolf/memory.md</files>
  <behavior>
    - claudeAdapter.fetchCandidates with pieces ['[{"command": "find . -name'], stopReason 'refusal' and an onCandidate spy rejects with an Error whose message is exactly TRUNCATED_RESPONSE_MESSAGE. onCandidate is never called. The 'response truncated' provider debug log is written, and its detail includes stopReason 'refusal' (the review WR-01 test).
    - it.each over the stop reasons 'refusal', 'pause_turn', 'tool_use', 'model_context_window_exceeded' and null, with prose pieces ['not ', 'json'] and nothing streamed: every one rejects with TRUNCATED_RESPONSE_MESSAGE. The prose fallback is closed for any stop that is not normal, not only for JSON fragments.
    - stopReason 'refusal' with the text `${TWO_CANDIDATES.slice(0, -1)},{"command":"git di` and no onCandidate resolves to the two closed rows (completeCandidates kept).
    - stopReason 'refusal' with the same text split into pieces and an onCandidate spy resolves to the streamed rows. onCandidate is called once per streamed row.
    - stopReason 'stop_sequence' with prose pieces ['not ', 'json'] still resolves to [{ command: 'not json', explanation: '' }]. A normal stop keeps the fallback.
    - isNormalStopReason returns true for 'end_turn' and 'stop_sequence'. It returns false for 'max_tokens', 'refusal', 'pause_turn', 'tool_use', null, undefined and ''.
    - The three WR-07 max_tokens tests and the existing 'keeps the parseCandidates prose fallback when nothing streamed' test (end_turn) pass unchanged.
  </behavior>
  <action>
This is the thinnest end-to-end path: one SDK stream with a refusal, through claudeAdapter, to a rejected fetch. It implements the WR-01-r2 fix direction from 09.1-REVIEW.md and the T-09.1-14 fix direction from 09.1-SECURITY.md.

RED first. In tests/claude-provider.test.ts, change FakeStreamScript.stopReason to the type `string | null`. In createFakeStream, apply it as "the scripted value when the key is not undefined, otherwise 'end_turn'", not with `??`, so a scripted null reaches the code. Add the tests from the behavior block. Name them with a "(WR-01-r2)" suffix and put them right after the WR-07 tests. Import isNormalStopReason from '../src/providers/provider.js'. To read the log detail, find the appendDebugLogMock call whose second argument is 'response truncated' and check its third argument. Run `pnpm exec vitest run tests/claude-provider.test.ts`. Confirm that the refusal and pause_turn cases fail against the current code: the fragment resolves as a command. Do not commit RED on its own. The missing export would fail the pre-commit tsc (see the cerebrum note of 2026-08-26). Commit once, after GREEN.

GREEN, in src/providers/provider.ts. Export `isNormalStopReason(stopReason: string | null | undefined): boolean`. It returns true only for 'end_turn' and 'stop_sequence'. Write the JSDoc in plain wording. These are the only two stop reasons after which a provider's final text is a whole answer. Every other value means the text may be a fragment and must never reach parseCandidates' prose fallback: max_tokens, refusal, pause_turn, tool_use, model_context_window_exceeded, null, or a value a later SDK adds. Cite WR-01-r2 and T-09.1-14. The check is an allow list of the good values, so a stop reason added later fails closed.

GREEN, in src/providers/claude.ts:
(1) Export `finalCandidateList(text: string, streamed: CommandCandidate[], finishedNormally: boolean, logFields: Record<string, unknown> = {}): CandidateList`. It is the one final-list rule for the SDK and claude -p paths:
  - If parseStrictCandidateList(text) gives a list, return it.
  - Otherwise, if streamed is non-empty, return streamed.
  - Otherwise, if finishedNormally is false, scan with completeCandidates(text). Return those rows when there are any. When there are none, call appendDebugLog('provider', 'response truncated', logFields) and throw new Error(TRUNCATED_RESPONSE_MESSAGE).
  - Otherwise return parseCandidates(text).
(2) In fetchCandidates, replace the whole strict/streamed/WR-07/parseCandidates if-else chain (the `strict` local, the `finalList` declaration and the branch that tests only for the max_tokens stop reason) with one call: `finalCandidateList(text, streamed, isNormalStopReason(message.stop_reason), { model, stopReason: message.stop_reason })`. Pass the result to ensureSelectableCandidates as before. Import isNormalStopReason from './provider.js', where abortError and isAbortError already come from.
(3) Update the JSDoc on TRUNCATED_RESPONSE_MESSAGE. It is the error for a response that stopped for any reason other than end_turn or stop_sequence with no complete candidate in it. Update the final-list sentence of the fetchCandidates JSDoc to say that the prose fallback is reached only after a normal stop.
Keep the debug-log detail to the model and the stop reason: never the text.

Then run biome on the three files, typecheck, and run the test file. Add one line to .wolf/memory.md. Update the provider.ts and claude.ts entries under `## src/providers/` in .wolf/anatomy.md: add isNormalStopReason and finalCandidateList, and reword the WR-07 max_tokens-only text to describe the allow-list gate. Commit only the five paths src/providers/provider.ts, src/providers/claude.ts, tests/claude-provider.test.ts, .wolf/anatomy.md and .wolf/memory.md. Suggested header: `fix(09.1): fail closed on every non-normal sdk stop reason (WR-01-r2)`, with a short wrapped body that names T-09.1-14.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/claude-provider.test.ts && pnpm exec tsc --noEmit && grep -qF "isNormalStopReason(message.stop_reason)" src/providers/claude.ts && test "$(grep -v -e '^[[:space:]]*\*' -e '^[[:space:]]*//' src/providers/claude.ts | grep -c "=== 'max_tokens'")" -eq 0</automated>
    <fails_when>A claude-provider test fails, for example the refusal fragment resolves to a `[{"command": "find . -name` candidate, a null stop resolves through the prose fallback, or a WR-07 max_tokens test regresses. Also fails if tsc reports an error, if fetchCandidates does not call isNormalStopReason(message.stop_reason), or if a code line in claude.ts still compares the stop reason to 'max_tokens'.</fails_when>
  </verify>
  <done>An SDK answer whose stop is not end_turn or stop_sequence keeps only closed rows or rejects with TRUNCATED_RESPONSE_MESSAGE. It never becomes a prose-fallback command. end_turn and stop_sequence answers behave exactly as before. The commit contains only the five listed paths and has no Co-Authored-By trailer.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: the claude -p runner rejects a result with a stop_reason that is not normal as 'truncated'</name>
  <files>src/providers/stream-json.ts, src/providers/claude-process.ts, tests/fixtures/fake-claude-stream.mjs, tests/claude-process.test.ts, .wolf/anatomy.md, .wolf/memory.md</files>
  <behavior>
    - The fixture scenario 'refusal' (one delta with the fragment `[{"command": "find . -name`, then a result with is_error false, stop_reason 'refusal' and result set to the fragment) rejects. The rejection has reason 'truncated', stopReason 'refusal', stdout equal to the fragment and killed false. The stages contain no 'result'. The child is still reaped: an 'exit' stage arrives within the waitFor timeout.
    - Scenario 'null-stop-reason' (the same fragment with stop_reason null) rejects with reason 'truncated' and stopReason null.
    - Scenario 'stop-sequence' (the SUCCESS_ANSWER turn with stop_reason 'stop_sequence') resolves to SUCCESS_ANSWER with a 'result' stage.
    - Scenario 'no-stop-reason' (the SUCCESS_ANSWER turn whose result has no stop_reason key) resolves to SUCCESS_ANSWER. This is the compatibility decision for older Claude Code builds.
    - The existing 'success' (end_turn), 'auth' (is_error, no stop_reason) and 'sigterm-slow' tests pass unchanged.
  </behavior>
  <action>
This applies the same allow-list gate to the claude -p `result` event (WR-01-r2, last clause of the T-09.1-14 fix direction).

RED first. In tests/fixtures/fake-claude-stream.mjs, add a helper that writes one turn ending with a chosen stop reason. It takes the text and a stopReason. It writes initEvent, one textDelta(text), assistantMessage(text), a message_delta stream event carrying the stop_reason (only when stopReason is not undefined), message_stop, and then a result line: type 'result', subtype 'success', is_error false, result set to the text, session_id, and the stop_reason key only when stopReason is not undefined (null is written as JSON null). It then sleeps 300 ms and exits 0, like `success`. Add four scenarios to SCENARIOS without changing the existing ones: 'refusal' (the fragment `[{"command": "find . -name`, 'refusal'), 'null-stop-reason' (the same fragment, null), 'stop-sequence' (SUCCESS_ANSWER, 'stop_sequence') and 'no-stop-reason' (SUCCESS_ANSWER, undefined). Extend the header comment's scenario list with "(review WR-01-r2: result stop_reason)". In tests/claude-process.test.ts, add a describe 'runClaudeTurn result stop_reason (WR-01-r2)' with the cases from the behavior block, using startTurn(scenario) and the existing SUCCESS_ANSWER constant. Run it and confirm that 'refusal' and 'null-stop-reason' resolve today (RED). Do not commit RED on its own.

GREEN, in src/providers/stream-json.ts. Add `stop_reason: z.string().nullable().optional()` to streamJsonResultSchema. Its comment says that Claude Code 2.1.285 records it on `result` (Probe 2, 'end_turn'), and that older builds and the Probe 3 auth result leave it out.

GREEN, in src/providers/claude-process.ts:
(1) Add 'truncated' to ClaudeTurnFailureReason.
(2) Add an optional `stopReason?: string | null` to ClaudeTurnFailure, documented as the result's stop_reason and set on 'truncated'. FailureFields picks it up through its Omit.
(3) In handleEvent, after the is_error branch and before `onStage?.('result')`, make the decision explicit in a comment: a result with no stop_reason key counts as end_turn, for compatibility with Claude Code builds that predate the key, while null and every value isNormalStopReason rejects fail closed. When parsed.data.stop_reason is not undefined and isNormalStopReason(parsed.data.stop_reason) is false, call finish with a reject of turnFailure('Command failed: claude', 'truncated', sawInit, { code: null, killed: false, signal: null, stdout: parsed.data.result ?? '', stderr, stopReason: parsed.data.stop_reason }), then return. Emit no 'result' stage, the same as is-error. The backstop is already armed above, so the child is still reaped. Import isNormalStopReason from './provider.js' next to abortError.
(4) Add the 'truncated' rejection to the runClaudeTurn JSDoc rejects list: the result text as stdout, so it never reaches parseCandidates on its own.
The runner still forwards text deltas as before. Deciding which rows to keep is the adapter's job (Task 3). Until Task 3 lands, claude-default maps this failure to the D13 copy. That still fails closed and never produces a command.

Then run biome on the four files, typecheck, and run the tests. Add a line to .wolf/memory.md. In .wolf/anatomy.md, update the stream-json.ts and claude-process.ts entries under `## src/providers/`, and the fake-claude-stream.mjs entry under `## tests/fixtures/`. Commit only the four code paths plus .wolf/anatomy.md and .wolf/memory.md. Suggested header: `fix(09.1): reject a claude -p result with a non-normal stop reason (WR-01-r2)`.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/claude-process.test.ts tests/claude-stream-json.test.ts && pnpm exec tsc --noEmit && grep -qF "stop_reason: z.string().nullable().optional()" src/providers/stream-json.ts && grep -qF "isNormalStopReason(parsed.data.stop_reason)" src/providers/claude-process.ts</automated>
    <fails_when>The 'refusal' or 'null-stop-reason' fixture turn resolves instead of rejecting with reason 'truncated'. Also fails if 'stop-sequence' or 'no-stop-reason' rejects (the compatibility decision broke), if an existing runner test (success, auth, sigterm-slow, backstop, prewarmed child) regresses, if tsc reports an error, or if the schema or runner gate is missing.</fails_when>
  </verify>
  <done>runClaudeTurn rejects a non-error result as 'truncated' when stop_reason is present and not end_turn or stop_sequence, null included. The rejection carries the result text as stdout and the stop reason. A result with no stop_reason key still resolves, and fixture tests cover all four cases. The commit contains only the six listed paths.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: the claude -p adapter keeps closed rows or throws the truncation copy; record WR-01-r2 as fixed</name>
  <files>src/providers/claude-cli.ts, src/providers/claude-default.ts, tests/claude-cli-provider.test.ts, tests/claude-cli-prewarm.test.ts, .planning/phases/09.1-provider-latency-and-cancellation/09.1-REVIEW-DISPOSITION.md, .wolf/buglog.json, .wolf/cerebrum.md, .wolf/anatomy.md, .wolf/memory.md</files>
  <behavior>
    - Through claudeDefaultAdapter with no API key, the runner mock rejects with a truncated failure (stdout `[{"command": "find . -name`, stopReason 'refusal'). The fetch rejects with message exactly TRUNCATED_RESPONSE_MESSAGE, not matching /not authenticated/ and not the timeout copy. The SDK mock is never called. A 'response truncated' provider log with stopReason 'refusal' is written.
    - it.each over stopReason 'refusal' and null, with the prose stdout 'git status --short' and nothing streamed: each rejects with TRUNCATED_RESPONSE_MESSAGE. The prose fallback is closed on the CLI path.
    - A truncated failure whose stdout holds two closed rows and then a fragment, with nothing streamed, resolves to those rows.
    - The runner mock feeds STREAMED_ANSWER deltas through onTextDelta and then rejects truncated. The fetch resolves to STREAMED_CANDIDATES, and onCandidate is called twice.
    - The existing resolved-turn tests (strict parse, streamed fallback, 'keeps the parseCandidates prose fallback when nothing streamed', and the is_error, timeout, ENOENT and abort copy) pass unchanged.
    - claude-cli-prewarm: the 'never retries a warm %s failure' table gains a 'truncated' row. runClaudeTurn is called once, and the order is ['take', 'run warm', 'schedule'].
  </behavior>
  <action>
This completes the claude -p half of the WR-01-r2 fix and records it.

RED first. In tests/claude-cli-provider.test.ts, add a `truncatedFailure(stdout, stopReason = 'refusal')` helper next to loggedOutError, with the runner's shape: Error 'Command failed: claude', code null, killed false, signal null, stdout, stderr '', reason 'truncated', sawInit true, stopReason. Add the cases from the behavior block to the 'claude -p effort and streamed candidates' describe, named with "(WR-01-r2)". For the streamed case, use a runner mock in the style of playDeltas that calls options.onTextDelta for each piece and then throws the failure. Import TRUNCATED_RESPONSE_MESSAGE from '../src/providers/claude.js'. In tests/claude-cli-prewarm.test.ts, add a truncatedFailure helper next to isErrorFailure and add `['truncated', truncatedFailure]` to the existing it.each. Run both files and confirm that the new claude-cli-provider cases fail today: they show the D13 copy. Do not commit RED on its own.

GREEN, in src/providers/claude-cli.ts:
(1) Add `isTruncatedFailure(error)` next to isStalePrewarmFailure, in the same style: true when reason === 'truncated'. Leave isStalePrewarmFailure unchanged, so a truncated warm turn is never retried cold.
(2) Around the whole existing warm/cold attempt block (the code that sets `text`), catch only a truncated failure. Set text to its stdout (an empty string when stdout is not a string), set finishedNormally to false, and keep its stopReason. Re-throw every other rejection unchanged: abort, timeout, is-error, spawn-error, invalid-result, exit-without-result after the retry logic, and stale-prewarm. A resolved turn has finishedNormally true.
(3) Replace the final strict/streamed/parseCandidates expression with `ensureSelectableCandidates(finalCandidateList(text, streamed, finishedNormally, { stopReason }))`. For a resolved turn this gives exactly today's order. Remove imports that are no longer used (biome flags them). Keep schedulePrewarm in finally.
(4) Update the fetchClaudeCliCandidates JSDoc. A result whose stop_reason is not end_turn or stop_sequence keeps only closed rows or throws TRUNCATED_RESPONSE_MESSAGE. It never reaches the prose fallback and is never retried cold.
Keep the log detail to the stop reason only: never stdout, the prompt or argv (T-09.1-06).

GREEN, in src/providers/claude-default.ts. Import TRUNCATED_RESPONSE_MESSAGE from './claude.js', which is already imported there. As the first check in hardError, return the error unchanged when it is an Error whose message equals TRUNCATED_RESPONSE_MESSAGE. A /login user then sees the same truncation copy as the SDK path, not the D13 "not authenticated" copy. Leave the ENOENT, timeout and auth mappings as they are.

Bookkeeping, in the same commit:
- In .planning/phases/09.1-provider-latency-and-cancellation/09.1-REVIEW-DISPOSITION.md, change WR-01-r2 from `disposition: open` to `disposition: fixed` in the frontmatter, change frontmatter `open: 6` to `open: 5`, and set the table row's Disposition cell to fixed. Its Source cell says: "quick 261012-nlf: SDK and claude -p fail closed on every stop reason except end_turn/stop_sequence". Keep the existing note that it is the same ID as the first review's WR-01, and that T-09.1-14 closes when /gsd-secure-phase 09.1 re-runs. Change nothing else, and leave 09.1-SECURITY.md alone.
- In .wolf/buglog.json, append bug-331. error_message: the WR-01-r2/T-09.1-14 refusal-fragment description. file: src/providers/claude.ts. root_cause: the WR-07 guard checked one bad stop reason (max_tokens) instead of allowing only the good ones, and the claude -p result stop_reason was never read. fix: the isNormalStopReason allow list, finalCandidateList shared by both paths, the 'truncated' runner failure, and the claude-default copy pass-through. tags: 09.1, review-fix, WR-01-r2, T-09.1-14, stop_reason, refusal, fail-closed, provider. related_bugs ['bug-328']. occurrences 1, plus ISO timestamps. Edit the file in place. If you rewrite it from Python, use ensure_ascii=False and the file's existing indentation (cerebrum Do-Not-Repeat). `git diff --stat` must show added lines only.
- In .wolf/cerebrum.md, add to Key Learnings: the Claude Code stream-json `result` carries stop_reason (2.1.285); SDK finalMessage().stop_reason is StopReason or null; finalCandidateList in claude.ts is the one final-list rule; a CLI result with no stop_reason counts as end_turn, and null fails closed. Add to Do-Not-Repeat, dated 2026-10-12: do not fail closed on one bad enum value (the WR-07 check for max_tokens only). Allow only the known-good values (end_turn, stop_sequence) so that refusal, pause_turn and future values fail closed. Use the term "allow list".
- Add one line to .wolf/memory.md. Update the claude-cli.ts and claude-default.ts entries under `## src/providers/` in .wolf/anatomy.md.

Run biome on the four code files, tsc, and the tests. Commit only the four code paths plus the disposition file, .wolf/buglog.json, .wolf/cerebrum.md, .wolf/anatomy.md and .wolf/memory.md. Suggested header: `fix(09.1): keep closed rows or throw the truncation copy on claude -p (WR-01-r2)`. Wrap the body at 100 characters or less, and add no Co-Authored-By trailer.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/claude-cli-provider.test.ts tests/claude-cli-prewarm.test.ts tests/claude-provider.test.ts tests/claude-process.test.ts && pnpm exec tsc --noEmit && grep -qF "finalCandidateList(" src/providers/claude-cli.ts && grep -qF "TRUNCATED_RESPONSE_MESSAGE" src/providers/claude-default.ts && grep -A2 "id: WR-01-r2" .planning/phases/09.1-provider-latency-and-cancellation/09.1-REVIEW-DISPOSITION.md | grep -q "disposition: fixed" && grep -q "^open: 5$" .planning/phases/09.1-provider-latency-and-cancellation/09.1-REVIEW-DISPOSITION.md && python3 -c "import json;b=json.load(open('.wolf/buglog.json'))['bugs'];assert any(x['id']=='bug-331' and 'bug-328' in x['related_bugs'] for x in b)" && /usr/local/bin/git diff --quiet HEAD -- .planning/phases/09.1-provider-latency-and-cancellation/09.1-SECURITY.md</automated>
    <fails_when>A truncated CLI turn shows the D13 'not authenticated' copy or returns a prose-fallback command. Also fails if a streamed or closed row is dropped on a refusal, if a truncated warm turn is retried cold, if an existing provider test regresses, or if tsc fails. The bookkeeping checks fail if WR-01-r2 is not `fixed`, if open is not 5, if bug-331 is missing or lacks related bug-328, or if 09.1-SECURITY.md was modified.</fails_when>
  </verify>
  <done>On the claude -p path, a stop that is not normal keeps the strict list, the streamed rows or the closed rows, or throws TRUNCATED_RESPONSE_MESSAGE, which /login users see verbatim. It is never retried cold and never uses the prose fallback. WR-01-r2 is fixed in the disposition ledger (open 5), and bug-331 and the cerebrum entries are recorded. The commit contains only the listed paths.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Anthropic SDK stream → daemon | Streamed model text and finalMessage().stop_reason (untrusted model output) |
| claude -p child → daemon | stream-json stdout: text deltas and the zod-validated `result` event, including stop_reason (untrusted) |
| model output → shell buffer | Candidate rows are inserted into the live ZLE buffer and never executed |

## STRIDE Threat Register

Threat IDs are new for this quick task. T-261012-nlf-01 and -02 implement the mitigation of phase threat T-09.1-14.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261012-nlf-01 | Tampering | claude.ts fetchCandidates → parseCandidates prose fallback → buffer | high | mitigate | isNormalStopReason allow list (end_turn, stop_sequence) feeds finalCandidateList. Every other stop, null included, keeps only zod-validated closed rows or throws TRUNCATED_RESPONSE_MESSAGE. Task 1 tests cover refusal, pause_turn, tool_use, model_context_window_exceeded and null (closes T-09.1-14 for the SDK path) |
| T-261012-nlf-02 | Tampering | claude-process.ts result → claude-cli.ts → parseCandidates → buffer | high | mitigate | A result whose stop_reason is not normal rejects as 'truncated'. claude-cli routes it through finalCandidateList(…, false, …) and never the prose fallback. Fixture-backed runner tests and mocked adapter tests (Tasks 2-3) |
| T-261012-nlf-03 | Tampering | claude -p result with no stop_reason key (older Claude Code) | low | accept | Explicit compatibility decision: an absent key counts as end_turn. 2.1.285 records the key (Probe 2), a null value fails closed, rows are never executed, and the user still confirms insertion. Tested in Task 2 |
| T-261012-nlf-04 | Information disclosure | 'response truncated' debug log | low | mitigate | logFields carry only the model (SDK) and stopReason (an enum string), never text, prompt, argv or stdout (keeps T-09.1-06) |
| T-261012-nlf-05 | Denial of service / cost | warm prewarm turn ending truncated | low | mitigate | isStalePrewarmFailure is unchanged and excludes 'truncated', so there is no cold retry or second paid turn. Locked by the claude-cli-prewarm it.each row (Task 3) |
| T-261012-nlf-06 | Denial of service | false truncation of a normal answer | low | mitigate | end_turn and stop_sequence keep strict, then streamed, then the prose fallback, and the strict list and streamed rows still win on any stop. The existing fallback, WR-07 and runner success tests stay green |
| T-261012-nlf-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs: package.json, pnpm-lock.yaml and .pnpm-store/ are untouched and outside every commit |
</threat_model>

<verification>
- `pnpm exec vitest run` passes for the full suite. If a failure is confined to tests/semantic-release-user-notes.test.ts, it belongs to the concurrent session: record it in the SUMMARY, do not fix it.
- `pnpm exec tsc --noEmit` is clean, and `pnpm exec biome check src/providers tests/claude-provider.test.ts tests/claude-process.test.ts tests/claude-cli-provider.test.ts tests/claude-cli-prewarm.test.ts tests/fixtures/fake-claude-stream.mjs` reports no errors.
- `/usr/local/bin/git log --format='%s%n%b' -3` shows three fix(09.1) commits ending in (WR-01-r2), with no Co-Authored-By line, and the subject and every body line are 100 characters or less.
- `/usr/local/bin/git status --short` still shows the other session's files (pnpm-lock.yaml, .pnpm-store/, CHANGELOG.md if changed) unstaged and uncommitted by this plan.
</verification>

<success_criteria>
- No stop reason except end_turn or stop_sequence can turn partial model text into a shell-buffer command, on the SDK path or the claude -p path (T-09.1-14 mitigated, ready for /gsd-secure-phase 09.1 to close).
- The review's requested test exists: stopReason 'refusal' with the fragment `[{"command": "find . -name` rejects with TRUNCATED_RESPONSE_MESSAGE.
- Normal answers, the WR-07 behaviour and every existing test are unchanged. No test is deleted.
- WR-01-r2 is fixed in the disposition ledger (open 6 → 5). bug-331 and the cerebrum learnings are recorded.
</success_criteria>

<output>
Create `.planning/quick/261012-nlf-fix-t-09-1-14-wr-01-r2-in-src-providers-/261012-nlf-SUMMARY.md` when done. Include the three commit SHAs, and remind the orchestrator to re-run /gsd-secure-phase 09.1 to close T-09.1-14.
</output>
