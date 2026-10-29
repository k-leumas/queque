---
phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
plan: 10
subsystem: telemetry
tags: [telemetry, client, ipc, zsh, allow-list, privacy, vitest]
requires:
  - phase: 10-04
    provides: telemetry contract (strict allow list), effectiveTelemetry, telemetry config state
  - phase: 10-06
    provides: daemon telemetry buffer, telemetry-event IPC kind, withErrorKind/errorKindOf, lookupApiKey export
  - phase: 10-02
    provides: widget mktemp guard (kept intact; the new export sits after it)
provides:
  - "src/shared/environment-shape.ts: collectEnvironmentShape(input?), EnvironmentShape, EnvironmentShapeInput"
  - "src/providers/provider-kind.ts: resolveProviderKind(deps?), ProviderKindDeps"
  - "src/client/telemetry-events.ts: TELEMETRY_CLIENT_SEND_MS = 250, QueryOutcomeRecord, buildQueryOutcomeEvent, buildErrorEvent, buildEnvironmentEvent, sendTelemetryEvents, reportClientTelemetry, ReportClientTelemetryInput"
  - "run-foreground.ts (llm mode) reports one outcome per ?? after the result is written"
  - "widget exports QQ_ZSH_VERSION before both client launches"
affects: [10-11 consent prompt, 10-11 openwolf records, 10-13 real key bake]
actuals:
  tokens: 18500
  tasks: 2
  commits: 4
plan_head_before: 4b290325567099b8edf04dc62c8c277b8abfaff3
plan_head_after: 82a324b
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget client IPC: net.createConnection, one JSON line per event, end(), resolve on close/error/timeout, destroy on timeout, never reject"
    - "Outcome recorded next to each writeShellResult; one try/finally around the llm branch reports after every path"
    - "Collectors (provider kind, environment shape) are injectable and run only after the client-side gate is on"
key-files:
  created:
    - src/shared/environment-shape.ts
    - src/providers/provider-kind.ts
    - src/client/telemetry-events.ts
    - tests/environment-shape.test.ts
    - tests/telemetry-events.test.ts
  modified:
    - src/client/run-foreground.ts
    - shell/zsh/queque.zsh
    - tests/client-result.test.ts
    - tests/zsh-widget.test.ts
key-decisions:
  - "Provider kind and environment shape are computed only after effectiveTelemetry() is on, so telemetry off costs exactly one config read (plus the env check)"
  - "zsh version regex takes the leading digits.digits (`5.9-dev-1` → `5.9`); anything else is `unknown`"
  - "A throwing pin loader maps to `unknown` (fail closed), like an invalid pin"
  - "Candidate count is clamped with NaN → 0 as well as the 0-5 bound"
  - "An outcome is recorded after its writeShellResult; if that write throws, the llm catch records errorKindOf(error) instead"
patterns-established:
  - "Plan 11 inserts the consent prompt immediately before `await reportClientTelemetry(...)` (src/client/run-foreground.ts line 472, inside the llm-branch finally that starts at line 468)"
requirements-completed: [P10-TEL]
coverage:
  - id: D1
    description: "Every LLM-mode ?? reports one qq_query_outcome (accepted/escaped/error with ErrorKind, rows on screen 0-5, provider kind) after the result is written"
    requirement: P10-TEL
    verification:
      - kind: unit
        ref: "tests/client-result.test.ts#runForegroundClient: telemetry outcome"
        status: pass
      - kind: unit
        ref: "tests/telemetry-events.test.ts#event builders"
        status: pass
    human_judgment: false
  - id: D2
    description: "Non-terminal failures (daemon could not start → socket_failed; provider failure after rows) become qq_error events; kinds come from errorKindOf"
    requirement: P10-TEL
    verification:
      - kind: unit
        ref: "tests/client-result.test.ts#a daemon that cannot start is a socket_failed error event"
        status: pass
      - kind: unit
        ref: "tests/client-result.test.ts#a provider failure after rows were shown is an error event; Enter still sets the outcome"
        status: pass
    human_judgment: false
  - id: D3
    description: "Environment shape: os, arch, distro enum from os-release ID, zsh major.minor from QQ_ZSH_VERSION, node major, Zellij flag"
    requirement: P10-TEL
    verification:
      - kind: unit
        ref: "tests/environment-shape.test.ts#collectEnvironmentShape"
        status: pass
      - kind: unit
        ref: "tests/zsh-widget.test.ts#QQ_ZSH_VERSION export"
        status: pass
    human_judgment: false
  - id: D4
    description: "Client-side gate: nothing is built, sent or connected unless effectiveTelemetry() is on in the client's own env (DO_NOT_TRACK, QQ_TELEMETRY=0, CI, disabled, no config)"
    requirement: P10-TEL
    verification:
      - kind: unit
        ref: "tests/telemetry-events.test.ts#reportClientTelemetry gate"
        status: pass
    human_judgment: false
  - id: D5
    description: "Sender never rejects, resolves fast with no listener and gives up at the timeout; delivers to a real daemon server and buffer"
    requirement: P10-TEL
    verification:
      - kind: integration
        ref: "tests/telemetry-events.test.ts#sendTelemetryEvents"
        status: pass
    human_judgment: false
  - id: D6
    description: "End-to-end leak test (Pitfall 9): lbuffer, cwd, kubectl candidate and a path-bearing error message never reach the flushed batch"
    requirement: P10-TEL
    verification:
      - kind: integration
        ref: "tests/telemetry-events.test.ts#leaks no prompt, path, command or message end to end"
        status: pass
    human_judgment: false
duration: 23min
completed: 2026-10-29
status: complete
---

# Phase 10 Plan 10: Client Telemetry Events Summary

**The client now produces every telemetry event. It records how each LLM-mode `??` ended (Enter, Esc or an ErrorKind) and the number of rows on screen, adds errors that did not end the query and an enum-only environment shape, and sends them to the daemon over the socket without waiting for a reply. This happens only after the shell result is written, and only when `effectiveTelemetry()` is on in the client's own environment.**

## Performance

- **Duration:** about 23 min (first commit 14:59, last 15:07, plus reading and RED evidence)
- **Tasks:** 2 of 2
- **Files:** 5 created, 4 modified

## Accomplishments

- `collectEnvironmentShape` maps platform, arch, the os-release `ID`, `QQ_ZSH_VERSION` and the node version onto the contract enums. Unknown IDs become `other`, never the raw value. It returns null rather than an invalid shape (for example node < 18).
- `resolveProviderKind` returns `openai` or `ollama` from the pin. For a Claude pin or no pin it applies the adapter's `lookupApiKey()` rule (`claude-sdk` with a key, `claude-cli` without). An invalid pin or a throw gives `unknown`. The key is only checked for presence.
- The builders accept only enums and counts and parse each event with `clientTelemetryEventSchema`. `sendTelemetryEvents` writes one `telemetry-event` line per event, ends the socket, never rejects and gives up after 250 ms. `reportClientTelemetry` gates first, then sends the environment event, the error events and the outcome event, in that order. It never throws and logs counts only.
- `run-foreground.ts`, llm mode only:
  - It sets the outcome next to each result write: onSelect, onCancel, the no-rows fetch error, both tty failure returns and the llm catch.
  - `socket_failed` is pushed when ensureDaemon fails. A partial-rows failure pushes its `errorKindOf(err)`. Abort errors are not recorded.
  - One `finally` around the llm branch reports after every path, before the outer `finally` closes the tty handle.
  - No existing write, unmount or clear call moved. `git diff -w` shows only additions, plus one line that biome re-wrapped.
- The widget exports `QQ_ZSH_VERSION="$ZSH_VERSION"` after the tool handoff and before the Zellij/inline branch. The 10-02 mktemp guard is unchanged.

## Plan 11 insertion point

Insert the consent prompt in `src/client/run-foreground.ts` immediately before line 472, `await reportClientTelemetry({ socketPath, record: outcome, errors: telemetryErrors });`. That line is inside the llm-branch `} finally {` at line 468, and the comment on lines 469-471 marks the spot. When the prompt runs there, the result is already written, Ink has unmounted, and the tty handle is still open.

## Task Commits

1. **Task 1: builders, environment shape, provider kind, sender, leak test.** RED `8840634` (test), GREEN `77d5e8f` (feat)
2. **Task 2: per-query report in run-foreground, widget export.** RED `99a9a8c` (test), GREEN `82a324b` (feat)

## TDD Gate Compliance

- **Task 1 RED** (`8840634`): the commit has the tests plus throw-on-call stubs that carry the public names, so `tsc --noEmit` passes in pre-commit (cerebrum 2026-08-26). Command: `pnpm exec vitest run tests/telemetry-events.test.ts tests/environment-shape.test.ts --reporter=tap-flat`, exit 1, 38/38 failing. Target: `tests/telemetry-events.test.ts > sendTelemetryEvents > leaks no prompt, path, command or message end to end`. `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`).
  - Semantic assessment: the target ran and failed because `reportClientTelemetry` was not implemented yet (the stub threw). This is the missing feature, not a load, syntax or fixture fault.
- **Task 1 GREEN** (`77d5e8f`): 38/38 pass.
- **Task 2 RED** (`99a9a8c`): the first attempt ran both files in one TAP run. The classifier returned `INVALID_RED` (`invalid_record`: "Non-TAP data in report"), because output from the zsh-widget run mixed into the stream. Rerun on the target alone: `pnpm exec vitest run tests/client-result.test.ts -t "Enter with 2 rows on screen reports accepted" --reporter=tap-flat`, exit 1, 1 failing and 36 skipped. Result: `RED_EVIDENCE_OK` (`target_test_failed`).
  - Semantic assessment: the target failed on its planned assertion, `expected "vi.fn()" to be called 1 times, but got 0 times`. The other new cases failed on their planned assertions too, including the widget export (`expected -1 to be greater than 0`). The two `never reports` mode cases passed in RED as intended: they are characterization guards.
- **Task 2 GREEN** (`82a324b`): 116/116 across client-result, zsh-widget and telemetry-events.
- No REFACTOR commit was needed.

## Plan-level verification

- `pnpm test:run`: 55 files, 1378 tests passed.
- `pnpm typecheck`: exit 0.
- `pnpm lint`: bare `biome check .` processes no files inside a `.claude/worktrees/` checkout (cerebrum 2026-10-12). `pnpm exec biome check src tests scripts shell docs *.json *.ts` checked 146 files with no fixes.
- `pnpm build`: success. `dist/cli/app.js` contains `eu.i.posthog.com` once. The only `phc_` text is the schema regex prefix, so no key is baked (D-22).
- `zsh -n shell/zsh/queque.zsh`: clean.
- Acceptance greps:
  - Task 1: `secret-token-xyz` 2, `/home/alice` 5, `TELEMETRY_CLIENT_SEND_MS = 250` 1, `effectiveTelemetry(` 2, `lookupApiKey` in provider-kind.ts 3.
  - Task 2: `reportClientTelemetry(` 1, `tty_unavailable` 2, `socket_failed` 1, `errorKindOf(` 3, and `grep -cF 'export QQ_ZSH_VERSION="$ZSH_VERSION"'` 1. Use `-F`: BSD grep treats a mid-pattern `$` as an anchor.

## Decisions Made

See `key-decisions` in the frontmatter. None of them changes an interface named in the plan's artifact table. The extra exported types (`EnvironmentShapeInput`, `ProviderKindDeps`, `ReportClientTelemetryInput`) are additive.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Environment] Worktree had no node_modules**
- **Fix:** `pnpm install --frozen-lockfile --offline`. No package was added, and package.json and pnpm-lock.yaml are unchanged.

**2. [Rule 3 - Environment] RED commit message clobbered through the shared scratchpad**
- **Found during:** Task 1 RED commit
- **Issue:** the session scratchpad is shared by the parallel wave-3 agents. 10-07 wrote its own message to the same `msg1.txt` between my write and my `git commit -F`, so my RED commit first landed as `29c4292 test(10-07): add failing tests for the smoke auto-revert script`. The file contents were all mine and correct.
- **Fix:** `git commit --amend -F` with a message file in a private subdirectory (`scratchpad/agent-10-10-a4306/`). The commit is now `8840634 test(10-10): ...`. The wrong-message commit was never pushed or merged. Every later message used the private subdirectory.
- **Files modified:** none (commit metadata only)

**3. [Rule 3 - Environment] Plan commit ledger**
- The ledger file under `.git/worktrees/<id>/` is not writable from the worktree sandbox (cerebrum 2026-10-12). `commits:` is measured against the dispatch base `4b29032`: `git rev-list --count 4b29032..HEAD` = 4 before this SUMMARY commit.

**Total deviations:** 3, all environmental. No product deviation, and no file outside `files_modified` was touched.

## Issues Encountered

None in the code.

## Known Stubs

None. The Task 1 RED stubs were replaced in its GREEN commit.

## OpenWolf entries

For plan 11 to apply (this plan commits no `.wolf/` file):

- **anatomy.md** (new) `src/shared/environment-shape.ts`: `collectEnvironmentShape(input?)` maps platform/arch/os-release ID/QQ_ZSH_VERSION/node major/ZELLIJ onto the telemetry enums. An unknown ID becomes `other`. Returns null if the shape would not validate. Injectable env, platform, arch, nodeVersion, readOsRelease. (~0.9k tok)
- **anatomy.md** (new) `src/providers/provider-kind.ts`: `resolveProviderKind(deps?)` returns openai/ollama from the pin. A claude pin or no pin is `claude-sdk` when `lookupApiKey()` finds a key, else `claude-cli`. An invalid pin or a throw is `unknown`. Injectable loadPin and hasApiKey. (~0.4k tok)
- **anatomy.md** (new) `src/client/telemetry-events.ts`: client telemetry. `TELEMETRY_CLIENT_SEND_MS=250`, `QueryOutcomeRecord`, the three builders (strict-schema parsed), `sendTelemetryEvents` (fire-and-forget socket lines, never rejects) and `reportClientTelemetry` (gates on effectiveTelemetry in the client env first; environment, errors, outcome; never throws). (~1.6k tok)
- **anatomy.md** (new) `tests/environment-shape.test.ts`: enum mapping, zsh/node parsing, null on an out-of-bound node, no env value leaks.
- **anatomy.md** (new) `tests/telemetry-events.test.ts`: provider kind, builders, client gate (no config, disabled, DO_NOT_TRACK, QQ_TELEMETRY=0, CI), sender timeout and real-server delivery, and the end-to-end leak test (`secret-token-xyz`, `/home/alice`, kubectl, ENOENT).
- **anatomy.md** (append) `src/client/run-foreground.ts`: `10-10: llm branch records outcome/shownCount next to each result write and telemetryErrors (socket_failed, partial-row errorKindOf); a try/finally reports via reportClientTelemetry before the tty handle closes (plan 11 consent prompt goes just before that call)`
- **anatomy.md** (append) `shell/zsh/queque.zsh`: `10-10: export QQ_ZSH_VERSION="$ZSH_VERSION" after the tool handoff, before the Zellij/inline launch`
- **anatomy.md** (append) `tests/client-result.test.ts`: `mocks ../src/client/telemetry-events.js (reportClientTelemetryMock); describe 'runForegroundClient: telemetry outcome' (10-10)`
- **anatomy.md** (append) `tests/zsh-widget.test.ts`: `QQ_ZSH_VERSION export (static placement check)`
- **cerebrum.md, Do-Not-Repeat** `[2026-10-29]`: the session scratchpad is shared by parallel GSD worktree agents. A generic name such as `msg1.txt` can be overwritten between Write and `git commit -F`, and 10-10's RED commit got 10-07's message that way. Always write commit-message files into an agent-unique subdirectory (for example `scratchpad/agent-<plan>-<id>/`) and check `git log -1` after each commit.
- **cerebrum.md, Key Learnings** `[2026-10-29]`: a TAP RED record that mixes tests/zsh-widget.test.ts with other files can fail the tdd-red-evidence classifier with `invalid_record` ("Non-TAP data in report"). Run the RED target alone with `-t "<name>" --reporter=tap-flat`.
- **cerebrum.md, Key Learnings** `[2026-10-29]`: client telemetry is reported from one `finally` around run-foreground's llm branch. Outcomes are set next to each `writeShellResult`. Any new exit path in that branch must set `outcome` or it reports no outcome. tests/client-result.test.ts mocks the whole telemetry-events module.
- **buglog.json** (new entry):
  ```json
  {
    "id": "bug-NNN",
    "timestamp": "2026-10-29T21:00:00Z",
    "error_message": "10-10 RED commit landed with 10-07's commit message (test(10-07): add failing tests for the smoke auto-revert script)",
    "file": "(git metadata) commit 29c4292, amended to 8840634",
    "root_cause": "parallel wave-3 agents share the session scratchpad; another agent overwrote scratchpad/msg1.txt between Write and git commit -F",
    "fix": "amend with a message file in an agent-unique scratchpad subdirectory; verify git log -1 after each commit",
    "tags": ["gsd", "worktree", "parallel", "scratchpad", "commit-message", "phase-10"],
    "related_bugs": [],
    "occurrences": 1,
    "last_seen": "2026-10-29T21:00:00Z"
  }
  ```
- **memory.md**: `| 15:08 | 10-10 client telemetry events: builders, env shape, provider kind, sender, run-foreground report, QQ_ZSH_VERSION export | src/client/telemetry-events.ts, src/shared/environment-shape.ts, src/providers/provider-kind.ts, src/client/run-foreground.ts, shell/zsh/queque.zsh | 1378 tests pass | ~18k |`

## Next Phase Readiness

- Plan 11 can add the consent prompt at the insertion point above and the `consent` smoke pass.
- Until plan 13 bakes a real key, the daemon endpoint resolves to null, so nothing is buffered or sent even with consent on (D-22).

## Self-Check: PASSED

- FOUND: src/shared/environment-shape.ts, src/providers/provider-kind.ts, src/client/telemetry-events.ts, tests/environment-shape.test.ts, tests/telemetry-events.test.ts
- FOUND commits: 8840634, 77d5e8f, 99a9a8c, 82a324b (all ancestors of HEAD)
