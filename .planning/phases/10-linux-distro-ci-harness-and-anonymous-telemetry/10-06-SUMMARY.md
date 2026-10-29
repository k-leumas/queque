---
phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
plan: 06
subsystem: telemetry
tags: [telemetry, daemon, ipc, zod, posthog, errors]
status: complete

requires:
  - "10-04: telemetry contract, consent state, endpoint and build defines"
provides:
  - "src/daemon/telemetry-buffer.ts: createTelemetryBuffer, TelemetryBuffer, sendBatch and the five TELEMETRY_* constants"
  - "IPC requests telemetry-event (no reply), telemetry-show, telemetry-reset; response telemetry-buffer"
  - "fetch-error.errorKind (optional, unknown values filtered); informational pong flag telemetry: true"
  - "DaemonServerOptions.telemetry, DaemonShutdownOptions.telemetry; bounded shutdown flush"
  - "src/providers/error-kind.ts: withErrorKind, errorKindOf"
  - "lookupApiKey exported from src/providers/claude-default.ts"
affects: [10-09, 10-10, 10-11, 10-13]

estimate:
  tokens: 95000
  tasks: 3
actuals:
  tokens: 16300
  tasks: 3
  commits: 6
plan_head_before: dfd5ac84182c66c5a587f21571ad9cf2a72e0c17
plan_head_after: f070978e9568df6bebe722f70e28bf428752ac82

tech-stack:
  added: []
  patterns:
    - "One serializer feeds both snapshot().pending and flush(), so qq telemetry show is byte-exact"
    - "Telemetry gate (env, consent, install id, endpoint) re-read at enqueue, snapshot and flush"
    - "One POST in flight at a time; the threshold trigger is skipped while sending"
    - "Error kinds tagged on the Error object (non-enumerable errorKind) where it is created"

key-files:
  created:
    - src/daemon/telemetry-buffer.ts
    - src/providers/error-kind.ts
    - tests/telemetry-buffer.test.ts
    - tests/telemetry-ipc.test.ts
    - tests/error-kind.test.ts
  modified:
    - src/contracts/ipc.ts
    - src/daemon/server.ts
    - src/cli/commands/daemon.ts
    - src/providers/claude-default.ts
    - src/daemon/fetch-client.ts
    - tests/daemon-bootstrap.test.ts

key-decisions:
  - "At most one /batch POST in flight: while a send is pending, new events wait in the buffer (cap 100) and the threshold trigger is skipped; when the send settles, a buffer at or above the threshold flushes again; an explicit flush waits for the in-flight send and then sends the rest"
  - "At flush and snapshot, events recorded under a different install id than the current one are dropped (off then on before a flush can never send pre-off events under the old id)"
  - "reset() also clears the environment dedupe key, so a fresh install after qq telemetry off/on sends its environment event again; the dedupe key includes the install id"
  - "fetch-error.errorKind is z.enum(ERROR_KINDS).optional().catch(undefined): an unknown kind from a newer daemon is filtered, not a rejected reply (cerebrum rule: reject unknown shapes, filter unknown values)"
  - "The in-process fallback tags a resolveProviderAdapter throw as pin_invalid, matching the daemon"
  - "errorKind is a non-enumerable property, so JSON.stringify of an Error (debug logs) never carries it by accident"

requirements-completed: [P10-TEL]

duration: 15min
completed: 2026-10-29
---

# Phase 10 Plan 06: Daemon telemetry buffer, IPC kinds and error kinds Summary

**The daemon's in-memory telemetry buffer sends to PostHog `/batch/` with one raw `fetch`. Every batch is gated and passes the strict schema first, failed sends are dropped and never retried, and `show` returns the exact bytes. Three new IPC kinds feed it, shutdown waits at most 1 s for the final flush, and every provider failure now carries an `ErrorKind` enum on `fetch-error`.**

## Performance

- **Duration:** about 15 min
- **Started:** about 2026-10-29T20:26Z
- **Completed:** 2026-10-29T20:41Z
- **Tasks:** 3 (all TDD, RED then GREEN)
- **Files modified:** 11

## Accomplishments

- `createTelemetryBuffer(deps?)` checks a gate first: no `DO_NOT_TRACK`/`QQ_TELEMETRY`/`CI` in the daemon env, consent enabled with an install id, and a non-null `resolveTelemetryEndpoint()`. A keyless build therefore buffers nothing and never calls `fetch` (D-22). An event that passes is re-validated with `clientTelemetryEventSchema` and wrapped with `distinct_id`, `$process_person_profile: false`, `$geoip_disable: true`, `$lib: 'queque'`, `$lib_version` and an ISO timestamp. It is then validated as a wire event and buffered. The buffer holds at most 100 events and rejects new ones when full. It flushes at 20 events, every 60 s on an unref'd interval, and on shutdown. Each batch is checked against `telemetryBatchSchema` before `sendBatch`, which POSTs to `host + '/batch/'` with `AbortSignal.timeout(3000)` and swallows every failure.
- A single `serialize()` builds both `snapshot().pending` and the flushed body, so they are byte-identical. `lastSent` is the last body sent, kept in memory only.
- IPC: `telemetry-event` is fire-and-forget and goes to `enqueue`. `telemetry-show` replies `telemetry-buffer`, and `telemetry-reset` resets the buffer and then gives the same reply. A server started without a buffer answers both with nulls. The pong adds `telemetry: true`, which `bootstrap.ts` never reads.
- `shutdownDaemon` stops the timer and calls `flush()` synchronously before `server.close()`. Its close callback waits for the flush, or for `TELEMETRY_SHUTDOWN_WAIT_MS` (1000 ms) if the flush takes longer, then applies the existing `inFlight === 0 ? exit() : setTimeout(exit, graceMs)` rule. `daemonCommand` creates and starts the buffer and passes it to both.
- `withErrorKind` / `errorKindOf`: claude-default tags seven mapped errors. They are ENOENT → `provider_missing`, timeout → `provider_timeout`, D13 → `auth_missing`, other CLI → `provider_failed`, truncated → `response_truncated`, 401 → `key_rejected` and 403 → `key_refused`. Aborts stay untagged and every message is unchanged. The daemon's `fetch-error` carries `errorKindOf(error)`, or `pin_invalid` when resolution threw. `requestDaemonFetch` re-tags the Error it rejects with. The in-process fallback yields the same kinds.

## Task Commits

1. **Task 1: buffer.** RED `cea3f3a` (test), GREEN `e9e7361` (feat)
2. **Task 2: IPC kinds and shutdown flush.** RED `65e4bcf` (test), GREEN `f96415d` (feat)
3. **Task 3: error kinds.** RED `8a9da85` (test), GREEN `f070978` (feat)

No REFACTOR commits were needed.

## TDD Gate Compliance

Each RED commit contains the tests plus only the public names, so `tsc --noEmit` passes in pre-commit (cerebrum 2026-08-26). Task 1 has a throw-on-call stub module. Task 2 adds only the two option types. Task 3 has a stub module and the `lookupApiKey` export. Each RED record was checked with `gsd-tools check tdd-red-evidence` (vitest `tap-flat`, one target via `-t`) and returned `RED_EVIDENCE_OK`:

- Task 1: the target was `tests/telemetry-buffer.test.ts > createTelemetryBuffer > rejects an event with an extra property`. It failed inside the function under test with the stub's `not implemented`. Semantic assessment: this is the planned missing-behaviour failure, not a load or fixture fault.
- Task 2: the target was `tests/telemetry-ipc.test.ts > fetch-error errorKind > parses with an errorKind from ERROR_KINDS`. It failed with `expected undefined to be 'provider_timeout'` because the schema stripped the field. Semantic assessment: the planned assertion.
- Task 3: the target was `tests/error-kind.test.ts > fetch-error errorKind over IPC > an untagged adapter error is unknown`. It ran against a real daemon socket and failed with `expected undefined to be 'unknown'`. Semantic assessment: the planned assertion.

GREEN: each task's verify command exits 0.

## Verification

- `pnpm exec vitest run tests/telemetry-buffer.test.ts`: 19 passed
- `pnpm exec vitest run tests/telemetry-ipc.test.ts tests/daemon-fetch.test.ts tests/daemon-bootstrap.test.ts`: 61 passed
- `pnpm exec vitest run tests/error-kind.test.ts tests/claude-cli-provider.test.ts tests/daemon-fetch.test.ts tests/telemetry-ipc.test.ts`: 109 passed
- `pnpm test:run`: 52 files, 1321 tests passed. `pnpm typecheck`, `pnpm lint` (141 files) and `pnpm build` all exit 0.
- Acceptance greps:
  - Task 1: `AbortSignal.timeout(TELEMETRY_SEND_TIMEOUT_MS)` 1, `/batch/` 3, `unref()` 1, `writeFile|appendFile|posthog-node` 0, `posthog` in package.json 0.
  - Task 2: each of the four `kind: z.literal(...)` greps 1, `errorKind: z.enum(ERROR_KINDS).optional()` 1, `telemetry: true` in server.ts 1, `telemetry` in bootstrap.ts 0, `TELEMETRY_SHUTDOWN_WAIT_MS` in daemon.ts 5.
  - Task 3: `withErrorKind(` in claude-default.ts 7, `export function lookupApiKey` 1, `pin_invalid` in server.ts 1, `eu.i.posthog.com` in dist/cli/app.js 1.
- No commit in this plan touches `pnpm-lock.yaml` or `package.json`. No test reaches the network: every buffer test injects `fetch`, and the vitest defines bake an empty key and `http://127.0.0.1:9`.

## Decisions Made

See `key-decisions` in the frontmatter. Every decision either fills a gap the plan left open (concurrency of sends) or is stricter than the plan (install-id filter, unknown-kind filter, fallback `pin_invalid`). None of them changes an interface named in the plan's artifact table.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing exact pong expectation**
- **Found during:** Task 2
- **Issue:** `tests/daemon-bootstrap.test.ts` ("responds to {kind: "ping"} with {kind: "pong"}") asserts the pong with an exact `toEqual`. Adding `telemetry: true` (required by the plan) failed it. That file is listed in Task 2's verify command but not in `files_modified`.
- **Fix:** added `telemetry: true` to that one expectation. No other line changed.
- **Files modified:** tests/daemon-bootstrap.test.ts
- **Commit:** `f96415d`

**2. [Rule 2 - Correctness] One send in flight, and the threshold trigger skipped while sending**
- **Found during:** Task 1
- **Issue:** the plan's behaviour list asks for both "the 20th event triggers one flush" and "the 101st buffered event is rejected". Because flush empties the buffer, the buffer can only reach 100 while a send is pending. Without a concurrency rule, a slow network would also start a new POST every 20 events (T-10-20).
- **Fix:** at most one POST in flight. See key-decisions; covered by the cap test.
- **Commit:** `e9e7361`

**3. [Rule 2 - Security] Events under a previous install id are never sent**
- **Found during:** Task 1
- **Issue:** consent can go off and then on again (new install id, D-06) before a flush. The events buffered before "off" would then have been sent under the old id.
- **Fix:** snapshot and flush keep only events whose `distinct_id` matches the current install id. A test covers it.
- **Commit:** `e9e7361`

**4. [Rule 2 - Correctness] Unknown errorKind values filtered, fallback tags an invalid pin**
- **Found during:** Tasks 2 and 3
- **Issue:** a plain `z.enum(...).optional()` makes an older client reject a whole `fetch-error` that carries a kind a newer daemon added. Separately, the in-process fallback would have reported an invalid pin as `unknown`, while the daemon reports `pin_invalid`.
- **Fix:** `.catch(undefined)` on the field (the acceptance grep still matches). `fetchCandidatesForUi` tags a `resolveProviderAdapter` throw `pin_invalid`. Both have tests.
- **Commits:** `f96415d`, `f070978`

**5. [Rule 3 - Environment] Plan ledger file**
- **Issue:** the worktree sandbox refused writes to `.git/worktrees/<id>/gsd-plan-head-before-10-06`.
- **Fix:** `plan_head_before` is the spawn base `dfd5ac8` checked at startup, and `commits` is measured with `git rev-list --count dfd5ac8..HEAD` = 6.

**Total deviations:** 5 auto-fixed (1 blocking test expectation, 3 correctness/security, 1 environment). **Impact:** no interface in the artifact table changed; the plan's scope is unchanged.

## Issues Encountered

None in the code. `pnpm lint` now works inside the worktree (the 18de580 fix is on this base).

## Threat Flags

None. The new surface (the `telemetry-event` IPC input and the `/batch/` egress) is what the plan's threat register already covers, T-10-18 to T-10-22. All mitigations in that register are implemented and tested: strict re-validation, gate at enqueue and flush, cap, timeout, unref'd timer, 1 s shutdown bound, count-only debug lines, and an enum-only `errorKind`.

## OpenWolf entries

Plan 11 applies these; this plan committed no `.wolf/` file.

**anatomy.md**
- `src/daemon/telemetry-buffer.ts`: daemon telemetry buffer (D-07, D-12, D-22).
  - Exports: createTelemetryBuffer(deps) → { enqueue, flush, snapshot, reset, start, stop }, sendBatch(host, body, fetchImpl), TELEMETRY_FLUSH_INTERVAL_MS 60000, TELEMETRY_FLUSH_THRESHOLD 20, TELEMETRY_BUFFER_CAP 100, TELEMETRY_SEND_TIMEOUT_MS 3000, TELEMETRY_SHUTDOWN_WAIT_MS 1000.
  - Behaviour: gate re-read at enqueue, snapshot and flush; one shared serializer; one POST in flight; memory only. (~2.6k tok)
- `src/providers/error-kind.ts`: withErrorKind(error, kind) sets a non-enumerable errorKind. errorKindOf(error) returns the tag, else TRUNCATED → response_truncated, UNPARSEABLE → parse_failed, else unknown. (~0.4k tok)
- `tests/telemetry-buffer.test.ts`: gating (CI, DO_NOT_TRACK, disabled, no id, null endpoint), byte-exact pending, fixed properties, environment dedupe, threshold, cap with an in-flight send, fake-timer interval with hasRef false, drop on failure, install-id filter, reset, count-only debug log. (~3.2k tok)
- `tests/telemetry-ipc.test.ts`: telemetry IPC kinds against a real socket server, the telemetry pong flag, fetch-error errorKind parsing, and the shutdownDaemon flush order and 1 s bound (fake setTimeout). (~3k tok)
- `tests/error-kind.test.ts`: helper units; claude-default CLI/SDK mapping via importOriginal-spread mocks of claude.js and claude-cli.js; daemon fetch-error errorKind and pin_invalid; fetch-client re-tagging; the in-process fallback. (~3k tok)
- Update the descriptions of:
  - `src/contracts/ipc.ts`: telemetry-event/show/reset requests, the telemetry-buffer response, the pong `telemetry` flag, fetch-error `errorKind`.
  - `src/daemon/server.ts`: the telemetry cases; errorKind with pin_invalid for resolution throws.
  - `src/cli/commands/daemon.ts`: creates and starts the buffer; the bounded final flush in shutdownDaemon.
  - `src/daemon/fetch-client.ts`: re-tags fetch-error; the fallback tags pin_invalid.
  - `src/providers/claude-default.ts`: lookupApiKey exported; mapped errors are tagged.

**cerebrum.md**
- Key Learnings: `qq telemetry show` is byte-exact by construction. `snapshot().pending` and `flush()` call the same `serialize(key, batch)` over the same filtered events. Never build the show output separately; a second serializer can drift (key order, filtering).
- Key Learnings: the pong `telemetry: true` flag is informational only. `ensureDaemon` must never replace a daemon for lacking it, and `src/daemon/bootstrap.ts` contains no `telemetry`. Telemetry is optional, and replacement goes through `replaceStaleListener` (Defect 1's blast radius).
- Key Learnings: error kinds are classified where the Error is created (claude-default `hardError`/`sdkError`, server resolution vs adapter) and travel as a non-enumerable `errorKind` property. The client never maps message text. `errorKindOf` falls back only to the two shared response constants.
- Key Learnings: one telemetry POST in flight at a time. The 20-event trigger is skipped while sending, and the buffer can only reach the 100 cap during an in-flight send.
- Do-Not-Repeat [2026-10-29]: an acceptance grep such as `grep -c "telemetry: true" server.ts` = 1 also counts comment lines. Phrase header-comment tables without the literal the grep pins (the server.ts kinds table says "plus the `telemetry` flag").
- Do-Not-Repeat [2026-10-29]: in `shutdownDaemon`, call `telemetry.flush()` synchronously (try/catch for a sync throw). Wrapping it in `Promise.resolve().then(...)` starts it after `server.close()`.
- Do-Not-Repeat [2026-10-29]: to bound a test on `server.close` callback timing, use `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })` and wait on `server.once('close')`. Do not use `vi.waitFor`, which advances fake timers by itself.

**buglog.json**
- No user-facing bug. One test-authoring slip for the log, if wanted: in `it.each` titles, `%s → %s` formats the second column (an Error object), not the intended kind. Fixed by using a single `%s` label column.

## Next Phase Readiness

- Plan 09 (`qq telemetry show|off`) can send `telemetry-show` / `telemetry-reset` and parse `telemetry-buffer`.
- Plan 10 (client events) can send `telemetry-event` and read `errorKindOf` on the errors from `fetchCandidatesForUi`. It can also use the exported `lookupApiKey` for the provider kind.
- Nothing can be sent until plan 13 bakes a real `phc_` key.

## Self-Check: PASSED

- FOUND: src/daemon/telemetry-buffer.ts, src/providers/error-kind.ts, tests/telemetry-buffer.test.ts, tests/telemetry-ipc.test.ts, tests/error-kind.test.ts
- FOUND commits: cea3f3a, e9e7361, 65e4bcf, f96415d, 8a9da85, f070978
