---
phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
plan: 08
subsystem: infra
tags: [ci, github-actions, nightly, live-test, vitest, anthropic-sdk, distro]

requires:
  - phase: 10-05
    provides: ".github/workflows/distro.yml (workflow_call, input images; jobs test-distro, smoke)"
  - phase: 10-06
    provides: "fetch-error.errorKind, telemetry buffer (QQ_TELEMETRY=0 gate keeps the live daemon silent)"
provides:
  - "vitest.live.config.ts: separate config, include tests/live/**/*.live.ts only, base define reused"
  - "tests/live/sdk-contract.live.ts: LIVE_FIRST_CANDIDATE_MS = 15000, LIVE_FINAL_MS = 25000"
  - "npm script test:live"
  - ".github/workflows/nightly.yml: jobs distro (:latest images) and live"
affects: [10-11 OpenWolf entries, 10-12 first CI run, phase 10 UAT]

actuals:
  tokens: 3400
  tasks: 2
  commits: 2
plan_head_before: 4b290325567099b8edf04dc62c8c277b8abfaff3
plan_head_after: c2ba1f59fb1c69287977464d74ce742d24d104c4

tech-stack:
  added: []
  patterns:
    - "Real-model checks live in tests/live/*.live.ts behind their own vitest config; the default include never matches them"
    - "Live test fails in beforeAll (never skips) when its secret is missing"
    - "Debug-log assertions use booleans with a message, so the log text never lands in job output"

key-files:
  created:
    - vitest.live.config.ts
    - tests/live/sdk-contract.live.ts
    - .github/workflows/nightly.yml
  modified:
    - package.json
    - tsconfig.json

key-decisions:
  - "The live test also asserts the daemon debug log has the `sdk path` line, so a run that fell back to `claude -p` cannot pass as an SDK contract check"
  - "The daemon gets a temp HOME plus absent QQ_CONFIG_FILE/QQ_PROVIDER_FILE, so the developer's config, provider pin and home env file never affect the run; QQ_TELEMETRY=0 keeps telemetry off"
  - "Reply wait is LIVE_FINAL_MS + 10 s, so a hung daemon fails with a message instead of the 60 s vitest timeout"
  - "Nightly comments avoid the literal trigger names so the plan's grep counts (workflow_dispatch = 1) and the no-PR-trigger node check stay exact"

patterns-established:
  - "Nightly reuses distro.yml with a :latest image list; PR CI keeps the pinned list"

requirements-completed: [P10-LIVE, P10-CI]

coverage:
  - id: D1
    description: "Live contract test is listed only by the live config and never by the default suite"
    requirement: P10-LIVE
    verification:
      - kind: other
        ref: "pnpm exec vitest list --config vitest.live.config.ts | grep -c sdk-contract.live (1); pnpm exec vitest list | grep -q sdk-contract.live (no match)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Without ANTHROPIC_API_KEY the live run fails loudly (exit 1) with `ANTHROPIC_API_KEY is required for the live contract job`"
    requirement: P10-LIVE
    verification:
      - kind: other
        ref: "pnpm build && env -u ANTHROPIC_API_KEY pnpm test:live (exit 1, message count 1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "nightly.yml: schedule and workflow_dispatch only, read-only token, repository guard, key only in two step envs, :latest distro matrices"
    requirement: P10-CI
    verification:
      - kind: other
        ref: "actionlint .github/workflows/*.yml (clean) + plan node check (exit 0) + acceptance greps"
        status: pass
    human_judgment: false
  - id: D4
    description: "First real nightly dispatch: live job green within the ceilings, five :latest smoke and test-distro legs report"
    requirement: P10-LIVE
    verification: []
    human_judgment: true
    rationale: "Needs the workflow on main and the repository secret; nothing is pushed or dispatched from a worktree, and no real API call is made locally"

duration: 7min
completed: 2026-10-29
status: complete
---

# Phase 10 Plan 08: Nightly :latest Matrices and the Live SDK Contract Job Summary

**`nightly.yml` runs the distro vitest and smoke matrices on five `:latest` images and the phase's only real-model job. That job runs `pnpm test:live`, which spawns the built daemon, sends one streamed `fetch-candidates` on the SDK path and asserts only the contract: schemas, a 15 s first-candidate ceiling, a 25 s final-list ceiling, and no `request failed` or `response truncated` in the debug log.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-10-29T20:53:52Z
- **Completed:** 2026-10-29T21:00:34Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- `vitest.live.config.ts`: a fresh `defineConfig` (no `mergeConfig`, which would concatenate `include`), `include: ['tests/live/**/*.live.ts']`, `testTimeout` 60 s, `hookTimeout` 30 s, and `define: baseConfig.define` imported from `vitest.config.ts`. It is in tsconfig `include`, and `"test:live": "vitest run --config vitest.live.config.ts"` is in package.json.
- `tests/live/sdk-contract.live.ts`:
  - `beforeAll` throws `ANTHROPIC_API_KEY is required for the live contract job` on an empty trimmed key, then `run pnpm build first` when `dist/cli/main.js` is missing.
  - It then creates a temp HOME with absolute `QQ_CONFIG_FILE`, `QQ_PROVIDER_FILE` (both absent) and `QQ_DEBUG_LOG_FILE`, spawns `process.execPath dist/cli/main.js daemon --socket /tmp/qq-live-PID.sock` with `QQ_TELEMETRY=0`, and polls the socket for up to 5 s. It fails early with stderr if the daemon exits.
  - The test validates the envelope (`list files by size`, cwd = temp HOME) with `contextEnvelopeSchema.parse` and writes one `fetch-candidates` with `stream: true`. Every reply line is parsed with `ipcResponseSchema`, and a bad line fails the test.
  - Assertions: no `fetch-error`; every `candidate` row passes `commandCandidateSchema`; the final list passes `candidateListSchema` with at least one row; first ≤ `LIVE_FIRST_CANDIDATE_MS`; final ≤ `LIVE_FINAL_MS`; the debug log has `sdk path` and neither failure line. No command text is compared.
  - `afterAll` sends `{kind:'shutdown'}`, sends SIGKILL if the daemon is still alive after 2 s, and removes the socket and the temp HOME.
- `.github/workflows/nightly.yml`:
  - Name `Nightly`; triggers are only `schedule` (`23 3 * * *`) and `workflow_dispatch`. It has `permissions: contents: read`, concurrency group `nightly` with cancel-in-progress, and no auto-revert or issue step.
  - The `distro` job uses `./.github/workflows/distro.yml` with `["ubuntu:latest","debian:latest","fedora:latest","archlinux:latest","alpine:latest"]`.
  - The `live` job has `if: github.repository == 'k-leumas/queque'`, runs on ubuntu-24.04 with a 10 min timeout and `LEFTHOOK: '0'`. Its steps are checkout@v6, pnpm/action-setup@v6, setup-node@v6 (`.nvmrc`, pnpm cache), install, build, a `::error::ANTHROPIC_API_KEY secret is missing` guard, then `pnpm test:live`. Only the guard and the test step receive `ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}`, in the same form release.yaml uses.

## Check names as GitHub will show them

Workflow `Nightly`: `live`, `distro / test-distro (ubuntu:latest)` … `distro / test-distro (alpine:latest)`, `distro / smoke (ubuntu:latest)` … `distro / smoke (alpine:latest)`. Smoke artifacts: `smoke-ubuntu-latest`, `smoke-debian-latest`, `smoke-fedora-latest`, `smoke-archlinux-latest`, `smoke-alpine-latest`. None of these are required checks.

## Task Commits

1. **Task 1: live SDK contract test behind `pnpm test:live`** - `9e82b5b` (test)
2. **Task 2: nightly workflow with :latest matrices and the live job** - `c2ba1f5` (ci)

## Files Created/Modified

- `vitest.live.config.ts` - live-only vitest config
- `tests/live/sdk-contract.live.ts` - contract test against the real built daemon
- `.github/workflows/nightly.yml` - nightly `distro` and `live` jobs
- `package.json` - `test:live` script
- `tsconfig.json` - `vitest.live.config.ts` in `include`

## Verification

| Check | Result |
|---|---|
| `pnpm exec vitest list --config vitest.live.config.ts \| grep -c "sdk-contract.live"` | 1 |
| `test -f vitest.live.config.ts && ! pnpm exec vitest list \| grep -q "sdk-contract.live"` | exit 0 |
| `pnpm build && env -u ANTHROPIC_API_KEY pnpm test:live \| grep -c "...is required for the live contract job"` | 1 (test:live exit 1) |
| `pnpm typecheck` | exit 0 |
| `actionlint .github/workflows/nightly.yml` and `actionlint .github/workflows/*.yml` | clean |
| Plan node check (no PR/push trigger, no issue write, no `gh issue`) | exit 0 |
| Task 1 and Task 2 acceptance greps | all as specified (`workflow_dispatch` = 1 after a comment rewording) |
| `pnpm lint` | clean (145 files) |
| `pnpm test:run` | 1324/1329 under load average ~104. The 5 failures were the known load flakes: `command-words-fuzz` x2, `zsh-widget` prewarm and handoff timing (bug-206/270/429), plus `claude-process` "times out with QueQue flags" |
| Re-run alone | `claude-process`, `command-words-fuzz` and the zsh-widget prewarm test pass. The handoff-timing test passes when run alone with `-t`. This plan touches no `src/` file. |

**Local harness dry run (no real API call):** `ANTHROPIC_API_KEY=dry-run-not-a-key ANTHROPIC_BASE_URL=http://127.0.0.1:9 pnpm test:live`. The daemon spawned and the socket came up. The reply parsed as a `fetch-error`, and the test failed as expected on `expected [ { kind: 'fetch-error', … } ] to deeply equal []`. Afterwards no `/tmp/qq-live-*` socket and no daemon process were left behind. This exercised spawn, readiness, IPC parsing, shutdown and cleanup without contacting Anthropic. It is not committed and does not stub anything in the test.

## Decisions Made

See `key-decisions` in the frontmatter. In short: the extra `sdk path` assertion proves the SDK path was taken, the temp HOME isolates the run, the reply wait gives a bounded failure message, and the debug log is asserted with booleans so its text never reaches job output (T-10-29).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Assert the run took the SDK path**
- **Found during:** Task 1
- **Issue:** The planned assertions would also pass if the default adapter fell back to `claude -p`. D-01 requires the SDK path.
- **Fix:** After the reply, the test waits up to 1 s for the debug log to contain `sdk path` (the line `claudeDefaultAdapter` writes when it picks the SDK) and asserts it is there.
- **Files modified:** tests/live/sdk-contract.live.ts
- **Committed in:** 9e82b5b

**2. [Rule 2 - Security] Debug-log assertions never echo the log**
- **Found during:** Task 1
- **Issue:** On failure, `expect(log).not.toContain(...)` prints the whole debug log into the job output.
- **Fix:** Assert with `expect(log.includes(line), message).toBe(false)` (and `toBe(true)` for `sdk path`). The plan's grep strings are still present.
- **Files modified:** tests/live/sdk-contract.live.ts
- **Committed in:** 9e82b5b

---

**Total deviations:** 2 auto-fixed (2 missing critical). **Impact:** both make the D-01/D-02 check stricter and leak less; no scope change.

## Issues Encountered

- The first nightly.yml draft mentioned `workflow_dispatch` in a header comment, which made the acceptance grep count 2. I reworded the comment to "manual dispatch" before committing.
- The scratchpad directory is shared with the parallel wave-3 agents. Another agent overwrote my first commit-message file after I had used it. That commit was not affected; later files used unique names.

## Human checks for end-of-phase UAT

After phase 10 is on main (the workflow must exist on the default branch to be dispatched), run `gh workflow run nightly.yml` and then `gh run watch` on that run: the `live` job is green within the ceilings and the five `:latest` smoke and test-distro legs report. Not a merge gate (D-03); record the result in UAT.

## User Setup Required

None. The `ANTHROPIC_API_KEY` repository secret already exists (release.yaml uses it).

## OpenWolf entries

For plan 11 to apply (this plan commits no `.wolf/` file):

- **anatomy.md**
  - `vitest.live.config.ts`: live-only vitest config (`tests/live/**/*.live.ts`, 60 s test / 30 s hook timeouts, base `define` reused). Run with `pnpm test:live`. ~150 tokens.
  - `tests/live/sdk-contract.live.ts`: nightly live SDK contract test. Spawns the built daemon on `/tmp/qq-live-PID.sock` with a temp HOME and sends one streamed `fetch-candidates`. Asserts schemas, `LIVE_FIRST_CANDIDATE_MS` 15000 / `LIVE_FINAL_MS` 25000, `sdk path` and no `request failed`/`response truncated`. Fails in beforeAll without the key. ~2900 tokens.
  - `.github/workflows/nightly.yml`: `Nightly`, schedule `23 3 * * *` plus workflow_dispatch only. Job `distro` reuses distro.yml with ubuntu/debian/fedora/archlinux/alpine `:latest`. Job `live` (repo guard `k-leumas/queque`) runs `pnpm test:live` with the secret in step env. Read-only token, not a required check. ~600 tokens.
- **cerebrum.md, Key Learnings**
  - [2026-10-29] Real-model tests live in `tests/live/*.live.ts` and run only through `pnpm test:live` (vitest.live.config.ts, a fresh config, not `mergeConfig`, which concatenates `include`). `pnpm test:run` never lists them. Their real run is the nightly `live` job or a manual dispatch, never local.
  - [2026-10-29] To exercise the live harness locally without an API call, use `ANTHROPIC_API_KEY=dry-run-not-a-key ANTHROPIC_BASE_URL=http://127.0.0.1:9 pnpm test:live`. The SDK honours `ANTHROPIC_BASE_URL`, so the daemon replies `fetch-error` and the test fails on the no-error assertion. That proves spawn, IPC parsing and cleanup.
- **cerebrum.md, Do-Not-Repeat**
  - [2026-10-29] Parallel wave agents share one scratchpad directory. Use unique file names (for example `msg-10-08-task1.txt`) for commit-message files, or another agent may overwrite them between Write and `git commit -F`.
- **buglog.json:** none (no bug fixed; the full-suite failures were known load flakes bug-206/270/429 and passed when re-run alone).

## Next Phase Readiness

- Plan 12 (first CI run, branch protection) should leave `Nightly` out of required checks; only `ci-ok` is required.
- The first live run needs the workflow on main, so it is dispatched after the merge (human check above).

## Self-Check: PASSED

- FOUND: vitest.live.config.ts, tests/live/sdk-contract.live.ts, .github/workflows/nightly.yml
- FOUND: 9e82b5b, c2ba1f5 (ancestors of HEAD)

---
*Phase: 10-linux-distro-ci-harness-and-anonymous-telemetry*
*Completed: 2026-10-29*
