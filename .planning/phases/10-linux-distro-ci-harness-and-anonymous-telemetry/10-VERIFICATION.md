---
phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
verified: 2026-10-30T00:10:00Z
status: human_needed
score: 87/92 must-haves verified
covered_files: [".github/workflows/ci.yml",".github/workflows/distro.yml",".github/workflows/nightly.yml",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-01-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-01-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-02-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-02-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-03-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-03-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-04-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-04-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-05-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-05-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-06-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-06-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-07-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-07-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-08-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-08-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-09-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-09-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-10-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-10-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-11-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-11-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-12-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-12-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-13-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-13-SUMMARY.md","biome.json","package.json","scripts/ci/auto-revert.sh","scripts/ci/code-changed.mjs","scripts/ci/install-distro-deps.sh","scripts/ci/test-in-distro.sh","scripts/smoke-distro-runner.sh","scripts/smoke-distro.exp","scripts/smoke-distro.sh","shell/zsh/queque.zsh","src/cli/commands/daemon.ts","src/cli/commands/doctor.ts","src/cli/commands/telemetry.ts","src/cli/main.ts","src/client/run-foreground.ts","src/client/telemetry-consent.ts","src/client/telemetry-events.ts","src/contracts/doctor.ts","src/contracts/ipc.ts","src/contracts/telemetry.ts","src/daemon/bootstrap.ts","src/daemon/fetch-client.ts","src/daemon/server.ts","src/daemon/telemetry-buffer.ts","src/env.d.ts","src/providers/claude-default.ts","src/providers/error-kind.ts","src/providers/provider-kind.ts","src/shared/environment-shape.ts","src/shared/qq-config.ts","src/shared/telemetry-config.ts","src/shared/telemetry-endpoint.ts","tests/auto-revert.test.ts","tests/client-result.test.ts","tests/code-changed.test.ts","tests/daemon-bootstrap.test.ts","tests/doctor.test.ts","tests/environment-shape.test.ts","tests/error-kind.test.ts","tests/fixtures/auto-revert/gh","tests/git-env-isolation.test.ts","tests/live/sdk-contract.live.ts","tests/lsof-busybox.test.ts","tests/prewarm-sleep.test.ts","tests/setup/scrub-git-env.ts","tests/telemetry-buffer.test.ts","tests/telemetry-cli.test.ts","tests/telemetry-config.test.ts","tests/telemetry-consent.test.ts","tests/telemetry-contract.test.ts","tests/telemetry-endpoint.test.ts","tests/telemetry-events.test.ts","tests/telemetry-ipc.test.ts","tests/zsh-widget.test.ts","tsconfig.json","tsup.config.ts","vitest.config.ts","vitest.live.config.ts"]
covered_digest: "v3:sha256:9765360c6f65e641fac78660e4c5f759beaebbf64fb70d9e2309895eeafa9719"
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:
  - truth: "10-08 D-02: the live test asserts the contract (>=1 candidate, every row passes commandCandidateSchema, final list passes candidateListSchema, first candidate <= 15 000 ms, final list <= 25 000 ms, no `request failed` / `response truncated`)"
    test: "Push main so nightly.yml is on the default branch, then `gh workflow run nightly.yml` and `gh run watch`"
    expected: "The `live` job builds, spawns the real daemon on /tmp/qq-live-PID.sock, gets candidates from the real SDK path and passes within the ceilings"
    why_human: "The assertions are present in tests/live/sdk-contract.live.ts but the test has never run against the real model; it needs the ANTHROPIC_API_KEY repo secret and nightly.yml on main"
  - truth: "10-08: nightly also runs the distro vitest and smoke matrices against :latest images (ubuntu, debian, fedora, archlinux, alpine)"
    test: "Same nightly dispatch as above; read the five `distro / test-distro (*:latest)` and `distro / smoke (*:latest)` legs"
    expected: "All ten legs report; a red leg is visible but blocks nothing (not a required check)"
    why_human: "nightly.yml has never run (not on the default branch); the PR pins are green but :latest images (e.g. ubuntu:latest) have not been exercised"
human_verification:
  - test: "Nightly live SDK run: push main, then `gh workflow run nightly.yml` and `gh run watch` (planner-deferred human-check from 10-08 Task 2)"
    expected: "`live` green within 15 s / 25 s ceilings; five :latest smoke and test-distro legs report; a red result opens no issue and is not a required check"
    why_human: "Needs the ANTHROPIC_API_KEY secret and nightly.yml on the default branch; local main is 101 commits ahead of origin and unpushed"
  - test: "Telemetry backend and key (deferred by the user's keep-empty decision, todo .planning/todos/pending/2026-10-30-10-bake-telemetry-key.md): choose the backend, bake the key, send one opted-in event through the daemon shutdown flush"
    expected: "The event view shows no `$ip`, no GeoIP properties and no person profile"
    why_human: "External service plus a one-way decision (D-08); the user chose keep-empty, so 10-13 truths D-22 (project created, key supplied) and D-22 (event reaches PostHog without $ip/GeoIP) are open by decision, not by missing code"
  - test: "Decide on review CR-01: put an invalid-JSON ~/.config/qq/config.json in place, accept two `??` queries"
    expected: "Either fix (gate the ask on a writability probe so the question is asked at most once) or explicitly accept the edge case"
    why_human: "Confirmed in code: readTelemetryState() reads invalid JSON as asked:false and markTelemetryAsked() throws on the same file; run-foreground.ts only logs the throw, so the 30 s [y/N] question repeats on every accepted ?? and a `y` is discarded. This breaks D-09 'asked once ever' on that path; the review disposition is still `open`"
  - test: "Requirements traceability: decide whether to add P10-SMOKE, P10-FIX, P10-PREWARM, P10-DOCTOR, P10-TEL, P10-CI, P10-REVERT, P10-LIVE to .planning/REQUIREMENTS.md (and set ROADMAP Phase 10 `Requirements:` from TBD), or accept 10-RESEARCH.md §Phase Requirements as their source"
    expected: "Every phase requirement ID resolves from REQUIREMENTS.md, or the exception is recorded"
    why_human: "Documentation decision; all eight IDs are defined in 10-RESEARCH.md and claimed by plans, but none appear in REQUIREMENTS.md. ZSHX-01 (v2, non-macOS zsh) is now effectively delivered and may be marked"
---

# Phase 10: Linux distro CI harness and anonymous telemetry Verification Report

**Phase Goal:** Catch environment breakage before it reaches main, make zsh support stable across the major Linux distros, and add opt-in, privacy-safe error/usage reporting.
**Verified:** 2026-10-30
**Status:** human_needed
**Re-verification:** No (initial verification)

## Goal Achievement

The three goal clauses hold in the codebase and on GitHub:

- **Catch breakage before main:** `ci.yml` runs on every push and PR. `ci-ok` is the only required check on main. I confirmed this with `gh api .../branches/main/protection/required_status_checks`, which returns `contexts: ["ci-ok"]`, app 15368, strict false. On a push, a failed smoke leg opens one revert PR. The drill opened PR #16 (closed); its only changed file is `shell/zsh/queque.zsh`.
- **zsh stable across Linux distros:** run 40980760144 on e9e3f48 is a success, with 6/6 `test-distro`, 6/6 `smoke`, `checks` and `ci-ok` all green (`gh run view`). There is no code diff between e9e3f48 and HEAD outside `.planning/` and `.wolf/`, so that run covers the current code.
- **Opt-in, privacy-safe reporting:** the strict allow-list contract, consent prompt, daemon buffer and sender, and `qq telemetry` are all present, wired and tested. The user chose to keep the key empty, so no release sends anything yet. Sending to a real backend is deferred to a todo by that decision.

### Observable Truths: roadmap level (scope items, with the amendments recorded in 10-CONTEXT.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| R1 | `ci.yml` has a `checks` job (lint, typecheck, test:run, build) and a vitest-in-containers matrix (ubuntu 22.04/24.04, debian, fedora, arch, alpine with Node from apk), plus a nightly against `:latest` | ✓ VERIFIED | ci.yml `checks` steps; distro.yml `test-distro` runs `scripts/ci/test-in-distro.sh`; install-distro-deps.sh:96 `apk add ... nodejs npm`; nightly.yml calls distro.yml with `:latest` images; CI run 40980760144 green |
| R2 | `scripts/smoke-distro.sh <image>` installs from `pnpm pack` and drives a real zsh PTY with only `claude` faked. It asserts that `??` opens the TUI, Enter fills the buffer, Esc restores the line, unset XDG_RUNTIME_DIR works and the C locale works. It runs as the `smoke` matrix job | ✓ VERIFIED | runner: `npm install -g /pkg/*.tgz`, claude shim execs fake-claude-stream.mjs; exp: `env -u XDG_RUNTIME_DIR` (default), `LANG=C LC_ALL=C` (c-locale), `command not found: tldr`, `restored-42`; 6/6 smoke green on GitHub |
| R3 | Roadmap item 3 was amended by D-13 to D-16: no lefthook Docker smoke; remote smoke on every push, with an auto-revert PR on failure | ✓ VERIFIED | `git diff 489a67a..HEAD -- lefthook.yml` is empty; ci.yml `auto-revert` job; drill PR #16 (auto-revert/ci-phase-10-revert-drill-2, CLOSED, files: shell/zsh/queque.zsh) |
| R4 | `qq doctor` covers zsh version, TERM, locale, socket path length, conflicting widgets (`binding`) and the provider, and every smoke run asserts exit 0 | ✓ VERIFIED | DOCTOR_CHECK_IDS has 12 ids; runner fails with exit 34 when `qq doctor --json` is non-zero and exit 35 when the shape is wrong; tests/doctor.test.ts passes |
| R5 | Telemetry is opt-in (D-09 moved the ask from `qq init` to the first accepted `??`). It is always off under DO_NOT_TRACK, QQ_TELEMETRY=0 or CI. A strict zod allow list lives in src/contracts/telemetry.ts. The daemon batches events and sends them fire-and-forget. `qq telemetry status\|on\|off\|show` exists, and a vitest fails on any field outside the allow list | ✓ VERIFIED | every schema is `z.strictObject`; telemetry-contract.test.ts (87 tests) pins keys and rejects timing fields; telemetry-buffer.ts posts `HOST/batch/`; main.ts registers `telemetry [action]`. The real send is deferred (see human items) |
| R6 | Privacy-safe: no prompt, buffer, command, path or env value ever reaches a sent batch | ✓ VERIFIED | the tests/telemetry-events.test.ts end-to-end leak test (`secret-token-xyz`, `/home/alice/proj`, kubectl candidate) passed in this verification run |

### Observable Truths: plan must_haves (86 truths across 13 plans)

| Plan | Truths | Verified | Not verified | Evidence highlights |
|------|--------|----------|--------------|---------------------|
| 10-01 tracer smoke + busybox lsof | 8 | 8 | 0 | `parseLsofPidList` accepts output only when every line is a bare pid and logs `lsof output ignored` otherwise (bootstrap.ts:197-207). tests/lsof-busybox.test.ts passed (7). D-16 skip: `docker info` check with exit 1 under CI in both scripts. SHASUMS256.txt check (install-distro-deps.sh:77-80). In-Alpine behaviour comes from the 6/6 GitHub legs |
| 10-02 prewarm simulation + mktemp guard | 5 | 5 | 0 | tests/prewarm-sleep.test.ts passed all 3 named transitions (stop/cont hit, frozen to stale to cold to refill, killed to dead to refill). queque.zsh:381-394 guard; zsh-widget `-t mktemp` passed (2) |
| 10-03 qq doctor | 7 | 7 | 0 | doctorReportSchema is strict with an enum of ids; `doctorExitCode` returns 1 only on `fail`; ZSH_FAIL_BELOW 5.0, ZSH_WARN_BELOW 5.8; a missing jq is a hard fail; tests/doctor.test.ts passed |
| 10-04 telemetry contract/config/endpoint | 8 | 8 | 0 | strict schemas; `.optional().catch(undefined)` at qq-config.ts:88; tsup bakes host `https://eu.i.posthog.com` and an empty key; `usableSecret` overrides; tests/telemetry-config and tests/telemetry-endpoint passed |
| 10-05 ci.yml/distro.yml | 7 | 7 | 0 | push `**`, pull_request, workflow_dispatch; `changes` job fails open; `ci-ok` uses `if: always()` and its case on failure/cancelled; no `secrets.` and no pull_request_target in ci/distro; doctor artifacts uploaded `if: always()`; lefthook unchanged |
| 10-06 daemon buffer/IPC/error kinds | 8 | 8 | 0 | cap 100, threshold 20, 60 s timer with `unref`, 3 s send timeout, TELEMETRY_SHUTDOWN_WAIT_MS 1000; server.ts telemetry-event/show/reset; telemetry-buffer (19 tests), telemetry-ipc and error-kind tests passed |
| 10-07 auto-revert | 8 | 8 | 0 | reverts only on smoke failure (auto-revert.sh:124-127); `git restore --source="$GOOD" ... -- .`; `gh pr edit`/`comment` on a repeat; loop guard for `auto-revert/*`; inputs only from env; tests/auto-revert.test.ts passed; live drill PR #16 |
| 10-08 nightly + live | 5 | 3 | 2 (⚠️ PRESENT_BEHAVIOR_UNVERIFIED) | Static, verified: schedule plus dispatch only, a repository guard, `contents: read` with no issue step, a throw (never a skip) when the key is missing, and live tests excluded from test:run. Unexercised: D-02 contract run against the real SDK, and the `:latest` matrices (nightly.yml has never run) |
| 10-09 qq telemetry CLI + doctor row | 6 | 6 | 0 | `telemetry [action]` is registered; tests/telemetry-cli.test.ts passed (status/on/off/show, `daemon not running: nothing buffered`, invalid JSON never overwritten); the `telemetry` doctor id exists |
| 10-10 client events | 7 | 7 | 0 | outcomes accepted/escaped/error set at run-foreground.ts:327/341/451/472; `reportClientTelemetry` after the result is written; QQ_ZSH_VERSION export (queque.zsh:425); leak test passed |
| 10-11 consent prompt + phase gate | 7 | 6 | 1 (? UNCERTAIN, WARNING) | The prompt copy, the 30 s timeout and the `y`/`Y`-only answer are in place. The PTY `consent` pass (exit 17/18 guards, plus runner exit 36 on config state) is green on 6 distros. The 09.1 todo is in todos/done, and buglog has the defects. **UNCERTAIN:** "asked once ever" does not hold when config.json cannot be written (CR-01, confirmed in code) |
| 10-12 human CI gates | 5 | 5 | 0 | `gh api .../actions/permissions/workflow` returns `{"default_workflow_permissions":"read","can_approve_pull_request_reviews":true}`; run 40980760144 shows all jobs success; drill PR #16 closed; `ci-ok` is the only required check |
| 10-13 telemetry key decision | 5 | 3 | 2 (? UNCERTAIN, deferred by user) | Verified: the keep-empty decision is recorded and both configs keep `JSON.stringify('')`; the host stays EU; "carry-over ok" is recorded. Open by decision: the PostHog project/key is not created, and the event without $ip/GeoIP has not been checked |

**Score:** 87/92 truths verified (6 roadmap + 86 plan). Two are present but behavior-unverified, and three are uncertain and routed to a human (two deferred by user decision, one review defect that needs a decision). No truth FAILED.

### Required Artifacts

| Check | Result |
|-------|--------|
| `verify.artifacts` across plans 01-11 and 13 | 40/40 passed (exists, substantive, contains pattern) |
| Plan 12 | declares no artifacts (human gates); verified directly through `gh` |

The main artifacts are all wired: `scripts/smoke-distro*.sh`/`.exp`, `scripts/ci/*`, the three workflows, `src/contracts/{doctor,telemetry}.ts`, `src/cli/commands/{doctor,telemetry}.ts`, `src/daemon/telemetry-buffer.ts`, `src/shared/telemetry-{config,endpoint}.ts`, `src/client/telemetry-{consent,events}.ts`, `src/shared/environment-shape.ts`, `src/providers/{error-kind,provider-kind}.ts` and `tests/live/sdk-contract.live.ts`.

### Key Link Verification

| Result | Detail |
|--------|--------|
| `verify.key-links` for plans 01-11 and 13 | 36/36 WIRED |
| 10-12 "ci/phase-10-revert-drill push -> scripts/ci/auto-revert.sh" | The tool cannot check it (the source is an event, not a file). Verified directly: the drill run opened PR #16 from `auto-revert/ci-phase-10-revert-drill-2` |
| Manual spot checks | main.ts to doctorCommand/telemetryCommand; server.ts `options.telemetry?.enqueue`; daemon.ts uses TELEMETRY_SHUTDOWN_WAIT_MS; run-foreground.ts calls shouldAskTelemetryConsent, askTelemetryConsent, markTelemetryAsked and reportClientTelemetry; ci.yml `auto-revert` runs `bash scripts/ci/auto-revert.sh` with `GH_TOKEN: github.token` |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| telemetry-buffer `pending`/`lastSent` | serialized batch | client `telemetry-event` IPC, then strict re-validation, then `telemetryBatchSchema` | yes (tests use a real daemon server) | ✓ FLOWING |
| Outbound `/batch/` POST | batch body | `resolveTelemetryEndpoint()` | null with the shipped empty key, so nothing is sent by design (D-22) | ⚠️ STATIC by user decision (human item 2) |
| doctor.json in revert PR body | `qq doctor --json` from the smoke container | artifacts `smoke-<slug>/doctor.json` | yes (drill PR body) | ✓ FLOWING |

### Behavioral Spot-Checks (run by this verifier)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Contract allow list, consent gate, buffer, leak test, busybox lsof, prewarm transitions | `pnpm exec vitest run tests/telemetry-contract tests/telemetry-events tests/lsof-busybox tests/telemetry-consent tests/prewarm-sleep tests/telemetry-buffer` | 6 files, 160 tests passed | ✓ PASS |
| Doctor, telemetry CLI/IPC/config/endpoint, auto-revert, path filter, error kind, env shape | `pnpm exec vitest run tests/doctor ... tests/environment-shape` (9 files) | 9 files, 192 tests passed | ✓ PASS |
| mktemp guard | `pnpm exec vitest run tests/zsh-widget.test.ts -t mktemp` | 2 passed | ✓ PASS |
| Six-distro CI on the verified SHA | `gh run view 40980760144` | success; all 16 jobs success (auto-revert skipped) | ✓ PASS |
| Live SDK nightly | not runnable (secret, nightly not on main) | n/a | ? SKIP to human |

### Probe Execution

Step 7c: not applicable. The phase declares no `scripts/*/tests/probe-*.sh`. The smoke itself is the runnable check, and the orchestrator ran it on GitHub (6/6 green).

### Requirements Coverage

| Requirement | Source Plans | Description (from 10-RESEARCH.md §Phase Requirements) | Status | Evidence |
|-------------|--------------|------------------------------------------------------|--------|----------|
| P10-SMOKE | 01, 05, 11, 12 | real zsh PTY smoke from `pnpm pack` with only claude faked; `smoke` matrix | ✓ SATISFIED | 6/6 smoke legs green, 3 passes each |
| P10-FIX | 01, 02, 03, 11 | Linux portability defects (busybox lsof, unguarded mktemp, jq hard blocker) | ✓ SATISFIED | lsof-busybox, the zsh-widget mktemp case and the doctor jq check; buglog entries |
| P10-PREWARM | 02, 11 | D-04 stale-prewarm simulation | ✓ SATISFIED | prewarm-sleep 3/3; 09.1 todo closed |
| P10-DOCTOR | 03, 05, 09 | `qq doctor [--json]` | ✓ SATISFIED | doctor tests; smoke exit-34/35 gates |
| P10-TEL | 04, 06, 09, 10, 11, 13 | opt-in telemetry stack | ✓ SATISFIED (code); real backend send deferred by user | contract, buffer, consent, CLI and leak tests |
| P10-CI | 05, 08, 12 | ci.yml, distro matrix, nightly | ✓ SATISFIED (PR side); nightly ? NEEDS HUMAN | run 40980760144; `ci-ok` required |
| P10-REVERT | 07, 12 | auto-revert PR on smoke failure | ✓ SATISFIED | auto-revert tests; drill PR #16 |
| P10-LIVE | 08 | nightly live SDK contract job | ? NEEDS HUMAN | code present; never run |

**Traceability warning:** none of the eight P10-* IDs appear in `.planning/REQUIREMENTS.md`, and ROADMAP lists Phase 10 `Requirements: TBD`. All are defined in 10-RESEARCH.md, and every one is claimed by at least one plan. No orphaned IDs. Routed to the human as a documentation decision.

### Anti-Patterns Found

The debt-marker scan (TBD/FIXME/XXX, plus TODO/HACK/PLACEHOLDER) over all 61 implementation files changed in the phase found nothing (`mktemp` `XXXXXX` templates excluded). There are no stubs.

The open findings from the code review (10-REVIEW.md, disposition `open`) are advisory, as the orchestrator directed. Each one is confirmed or plausible from the code:

| File | Finding | Severity | Impact |
|------|---------|----------|--------|
| src/client/run-foreground.ts:481-503, src/shared/telemetry-config.ts:86-135 | CR-01: the consent question repeats on every accepted `??` when config.json is invalid or unwritable, and the answer is discarded | ⚠️ Warning (human decision) | Breaks D-09 "asked once ever" on that path, with up to a 30 s stall per `??` |
| src/client/run-foreground.ts:481 | WR-01: in Zellij, the consent prompt can take the next keystroke | ⚠️ Warning | The accepted command still lands; the next key may become a permanent "no" |
| src/shared/telemetry-config.ts | WR-02: the atomic rename replaces a symlinked config.json | ⚠️ Warning | Detaches dotfile-managed configs |
| src/cli/commands/doctor.ts:367-385 | WR-03: a hung daemon is reported as "not running" (ok) | ⚠️ Warning | Misleading diagnostics, including in revert PR bodies |
| .github/workflows/ci.yml:41 | WR-04: push runs diff against `event.before`, so a doc-only push after a cancelled or red code push gives a green `ci-ok` | ⚠️ Warning | Weakens "catch breakage before main" in that sequence |
| scripts/ci/auto-revert.sh:216 | WR-05: `feat/x` and `feat-x` map to the same revert branch | ⚠️ Warning | Rare collision between revert PRs |
| scripts/smoke-distro.sh:82 | WR-06: a stale local doctor.json survives a rerun | ℹ️ Info (local only; CI uses a fresh dir) | Local debugging only |
| scripts/ci/auto-revert.sh:328-330 | Deviation: `.github/workflows` stays at HEAD in the tree restore (the workflow token cannot push workflow files); the PR body says so | ℹ️ Info | Intentional, documented |

### Human Verification Required

### 1. Nightly live SDK run
**Test:** Push main, then run `gh workflow run nightly.yml` and `gh run watch`.
**Expected:** The `live` job is green within the 15 s / 25 s ceilings. The five `:latest` smoke and test-distro legs report. Nothing is required and no issue is opened.
**Why human:** It needs the ANTHROPIC_API_KEY secret, and nightly.yml must be on the default branch (local main is 101 commits ahead of origin).

### 2. Telemetry backend, key and $ip/GeoIP check (deferred by keep-empty)
**Test:** Follow `.planning/todos/pending/2026-10-30-10-bake-telemetry-key.md`.
**Expected:** One opted-in event arrives with no `$ip`, no GeoIP and no person profile.
**Why human:** It involves an external service and a one-way key decision (D-08).

### 3. Review CR-01 decision
**Test:** Create an invalid-JSON `~/.config/qq/config.json`, then accept two `??` queries.
**Expected:** The question is asked at most once (fix), or the edge case is explicitly accepted.
**Why human:** The defect is confirmed in code; the choice between fixing it now and accepting it belongs to the developer.

### 4. Requirements traceability
**Test:** Add P10-* rows to REQUIREMENTS.md and the ROADMAP `Requirements:` line, or record that 10-RESEARCH.md is their source.
**Expected:** Phase IDs resolve from REQUIREMENTS.md.
**Why human:** This is a documentation-ownership decision.

### Gaps Summary

There are no blocking gaps. All 12 artifact sets and 36 checkable key links pass. Every behavior-dependent truth that CI or a local test can exercise was exercised: prewarm transitions, the consent PTY pass, the leak test, busybox lsof, and six-distro smoke and vitest on GitHub. The remaining five items are of three kinds:

- the nightly live and `:latest` runs, which are blocked on pushing main and the secret;
- the PostHog send and privacy check, deferred by the user's keep-empty decision;
- the CR-01 consent-repeat defect, a real but edge-path violation of D-09 that needs a fix-or-accept decision.

The six review warnings stay advisory and open in 10-REVIEW-DISPOSITION.md. WR-04 is the one most directly relevant to the "before main" clause and is worth scheduling.

---

_Verified: 2026-10-30_
_Verifier: Claude (gsd-verifier)_
