---
phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
verified: 2026-10-30T18:30:00Z
status: passed
score: 93/93 must-haves verified
covered_files: [".github/workflows/ci.yml",".github/workflows/distro.yml",".github/workflows/nightly.yml",".github/workflows/release.yaml",".planning/REQUIREMENTS.md",".planning/ROADMAP.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-01-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-01-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-02-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-02-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-03-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-03-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-04-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-04-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-05-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-05-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-06-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-06-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-07-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-07-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-08-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-08-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-09-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-09-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-10-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-10-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-11-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-11-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-12-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-12-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-13-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-13-SUMMARY.md","biome.json","package.json","scripts/ci/auto-revert.sh","scripts/ci/code-changed.mjs","scripts/ci/install-distro-deps.sh","scripts/ci/test-in-distro.sh","scripts/docker-homebrew-smoke-runner.sh","scripts/smoke-distro-runner.sh","scripts/smoke-distro.exp","scripts/smoke-distro.sh","scripts/smoke-homebrew-docker.sh","shell/zsh/queque.zsh","src/cli/commands/daemon.ts","src/cli/commands/doctor.ts","src/cli/commands/telemetry.ts","src/cli/main.ts","src/client/run-foreground.ts","src/client/telemetry-consent.ts","src/client/telemetry-events.ts","src/contracts/doctor.ts","src/contracts/ipc.ts","src/contracts/telemetry.ts","src/daemon/bootstrap.ts","src/daemon/fetch-client.ts","src/daemon/server.ts","src/daemon/telemetry-buffer.ts","src/env.d.ts","src/providers/claude-default.ts","src/providers/error-kind.ts","src/providers/provider-kind.ts","src/shared/environment-shape.ts","src/shared/qq-config.ts","src/shared/telemetry-config.ts","src/shared/telemetry-endpoint.ts","tests/auto-revert.test.ts","tests/client-result.test.ts","tests/code-changed.test.ts","tests/daemon-bootstrap.test.ts","tests/doctor.test.ts","tests/environment-shape.test.ts","tests/error-kind.test.ts","tests/fixtures/auto-revert/gh","tests/git-env-isolation.test.ts","tests/live/sdk-contract.live.ts","tests/lsof-busybox.test.ts","tests/prewarm-sleep.test.ts","tests/setup/scrub-git-env.ts","tests/telemetry-buffer.test.ts","tests/telemetry-cli.test.ts","tests/telemetry-config.test.ts","tests/telemetry-consent.test.ts","tests/telemetry-contract.test.ts","tests/telemetry-endpoint.test.ts","tests/telemetry-events.test.ts","tests/telemetry-ipc.test.ts","tests/zsh-widget.test.ts","tsconfig.json","tsup.config.ts","vitest.config.ts","vitest.live.config.ts"]
covered_digest: "v3:sha256:63043ce866262c66a33b992a0e72d88c8b7a67b4ce9b9c9f563452c9e27b3965"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 92/93
  gaps_closed:
    - "Phase 10 does not break the existing release path: the Release workflow's Homebrew install smoke still passes on main (derived from the goal clause 'catch environment breakage before it reaches main')"
  gaps_remaining: []
  regressions: []
---

# Phase 10: Linux distro CI harness and anonymous telemetry Verification Report

**Phase Goal:** Catch environment breakage before it reaches main, make zsh support stable across the major Linux distros, and add opt-in, privacy-safe error/usage reporting.
**Verified:** 2026-10-30T18:30:00Z
**Status:** passed
**Re-verification:** Yes, after gap closure. The previous report (gaps_found, 92/93) had one failed truth, R7. I re-checked R7 in full and regression-checked the other 92.

## Goal Achievement

The one blocking gap is closed. Commit 80bb9d4 adds `export QQ_TELEMETRY=0` to the zshrc block that `scripts/docker-homebrew-smoke-runner.sh` appends (line 25, with an explanatory comment at lines 21-23). This mirrors the opt-out that `smoke-distro-runner.sh` already uses. On 80bb9d4, the Release workflow's Homebrew install smoke passed and every publish job ran. Push CI on the same SHA was fully green, including the `smoke (debian:13)` leg that had failed on a5bc52e.

Since a5bc52e, the only non-planning changes are this runner (+4 lines) and the release bump of `package.json` (0.7.1 to 0.8.0). No covered source or test file changed, so the 92 truths verified last time still hold.

### Observable Truths: roadmap level

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| R1 | `ci.yml` has a `checks` job and a six-distro vitest matrix, plus a nightly against `:latest` | ✓ VERIFIED | Regression: unchanged. CI run 41089922163 (push, 80bb9d4) shows `checks` and 6/6 `test-distro` legs success. Nightly 41073946911 was green |
| R2 | `scripts/smoke-distro.sh` drives a real zsh PTY from `pnpm pack` with only `claude` faked, as a `smoke` matrix job | ✓ VERIFIED | Regression: unchanged. CI run 41089922163 has 6/6 `smoke` legs success, including `debian:13` |
| R3 | Roadmap item 3 is amended by D-13 to D-16: no lefthook Docker smoke; remote smoke on every push and an auto-revert PR on failure | ✓ VERIFIED | Regression: unchanged. It fired live on a5bc52e (PR #17). On 80bb9d4, `auto-revert` was correctly `skipped` because no leg failed |
| R4 | `qq doctor` covers zsh, TERM, locale, socket path, conflicting widgets and provider, and the smoke asserts exit 0 | ✓ VERIFIED | Regression: doctor.ts is unchanged, and the smoke legs that gate on doctor are green |
| R5 | Telemetry is opt-in and off under DO_NOT_TRACK/QQ_TELEMETRY=0/CI, with a strict allow list, daemon batching, `qq telemetry status\|on\|off\|show`, and a vitest that fails on unknown fields | ✓ VERIFIED | Regression: unchanged. The Homebrew smoke now also exercises the `QQ_TELEMETRY=0` kill switch: no consent prompt appeared after accept |
| R6 | Privacy-safe: no prompt, buffer, command, path or env value is sent | ✓ VERIFIED | Regression: unchanged (leak test; UAT 2) |
| R7 (derived) | Phase 10 does not break the existing release path (Release Homebrew smoke passes on main) | ✓ VERIFIED | **was FAILED.** Release run 41089922151 on 80bb9d4: step "Homebrew install smoke" success, and its log ends `smoke passed: Homebrew-shaped local install handled the ?? trigger and accepted an LLM response`. `tag-and-changelog`, `publish-npm` and `publish-homebrew` (including "Release to Homebrew tap") all succeeded. Tag `v0.8.0` points at the release commit 3f7c1ff, both locally and on origin |

### Observable Truths: plan must_haves (86 truths across 13 plans)

All 86 remain VERIFIED. That is the same as the previous report: 8, 5, 7, 8, 7, 8, 8, 5, 6, 7, 7, 5 and 5 for plans 10-01 to 10-13. The regression basis is `git diff --stat a5bc52e HEAD`: it shows no change to any covered `src/`, `tests/`, workflow or CI script file, apart from the runner fix and the version bump.

**Score:** 93/93 truths verified (7 roadmap level including one derived, plus 86 plan truths). 0 behavior-unverified.

### Required Artifacts

| Check | Result |
|-------|--------|
| `verify.artifacts` for plans 01-11 and 13 | 40/40 passed in the previous run. None of these files changed since then |
| `scripts/docker-homebrew-smoke-runner.sh` (gap artifact) | ✓ VERIFIED: `export QQ_TELEMETRY=0` is at line 25 inside the `cat >> "$HOME/.zshrc"` heredoc, and `bash -n` passes |
| `scripts/smoke-homebrew-docker.sh` (gap artifact 2) | Not changed, and it does not need to be. The opt-out is set inside the container's zshrc, so it does not have to pass through `docker run -e` |

### Key Link Verification

| From | To | Status | Details |
|------|----|--------|---------|
| release.yaml `test` job | smoke-homebrew-docker.sh, then docker-homebrew-smoke-runner.sh | ✓ WIRED | Run 41089922151: the "Homebrew install smoke" step ran (the "Skip Homebrew install smoke" step was skipped) and succeeded |
| smoke zshrc `QQ_TELEMETRY=0` | consent gate in run-foreground.ts | ✓ WIRED (proven at runtime) | The release log shows the accept path completing with no `QueQue:` consent line, which would have triggered exit 13 |
| `ci-ok` on main | distro matrices | ✓ WIRED | CI run 41089922163: `ci-ok` success, `auto-revert` skipped |
| Plan key links 01-11 and 13 | (various) | ✓ WIRED | 36/36 in the previous run, none changed |

### Data-Flow Trace (Level 4)

These are unchanged from the previous report. The telemetry buffer flows to `/batch/` (✓ FLOWING when a runtime key is given; the shipped build key is empty by user decision D-08). doctor.json flows into the revert PR body (✓ FLOWING, as seen in PR #16 and PR #17).

### Behavioral Spot-Checks (run by this verifier)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Release on the gap-fix SHA | `gh run view 41089922151 --json headSha,conclusion,jobs` | headSha 80bb9d4, success; test, tag-and-changelog, publish-npm and publish-homebrew all success | ✓ PASS |
| Homebrew smoke actually ran and passed | `gh run view 41089922151 --log \| grep "Homebrew install smoke"` | `smoke passed: Homebrew-shaped local install handled the ?? trigger and accepted an LLM response` | ✓ PASS |
| Push CI on the gap-fix SHA | `gh run view 41089922163 --json jobs` | 6/6 smoke, 6/6 test-distro, checks and ci-ok all success; auto-revert skipped | ✓ PASS |
| Release tag published | `git ls-remote --tags origin v0.8.0` | 3f7c1ff refs/tags/v0.8.0 | ✓ PASS |
| Runner syntax | `bash -n scripts/docker-homebrew-smoke-runner.sh` | OK | ✓ PASS |

I did not re-run vitest. No covered test or source file changed since the previous run, where 8 files and 313 tests passed.

### Probe Execution

Step 7c: not applicable. There are no `scripts/*/tests/probe-*.sh`. The smoke matrices and the Release smoke are the runnable checks, and their GitHub results are cited above.

### Requirements Coverage

All nine IDs resolve in `.planning/REQUIREMENTS.md` and appear on the ROADMAP Phase 10 `**Requirements**:` line. No ID is orphaned.

| Requirement | Source Plans | Status | Evidence |
|-------------|--------------|--------|----------|
| P10-CI | 05, 08, 12 | ✓ SATISFIED | CI 41089922163 green; Nightly 41073946911 green; `ci-ok` required |
| P10-SMOKE | 01, 05, 11, 12 | ✓ SATISFIED | 6/6 smoke on 80bb9d4; 5/5 `:latest` on Nightly; Release Homebrew smoke green |
| P10-REVERT | 07, 12 | ✓ SATISFIED | tests green; fired live (PR #16 drill, PR #17 on main); skipped correctly when green |
| P10-DOCTOR | 03, 05, 09 | ✓ SATISFIED | doctor tests; smoke exit-34/35 gates green |
| P10-TEL | 04, 06, 09, 10, 11, 13 | ✓ SATISFIED | contract, buffer, consent and leak tests; UAT 2. The consent prompt no longer breaks the release smoke |
| P10-LIVE | 08 | ✓ SATISFIED | Nightly `live` job success |
| P10-PREWARM | 02, 11 | ✓ SATISFIED | prewarm-sleep tests; code unchanged |
| P10-FIX | 01, 02, 03, 11 | ✓ SATISFIED | lsof-busybox, mktemp guard, jq check |
| ZSHX-01 | phase-level | ✓ SATISFIED | six Linux distros green on the PR pins (80bb9d4) and on `:latest` (Nightly) |

### Anti-Patterns Found

The debt-marker scan (TBD/FIXME/XXX) on `scripts/docker-homebrew-smoke-runner.sh` found nothing.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| scripts/docker-homebrew-smoke-runner.sh | 51, 66 | the error regex still matches the bare `QueQue:` prefix (optional hardening from the previous report, not done) | ℹ️ Info | A future informational `QueQue:` line printed after accept would block releases again. Not a goal gap: the regex is now consistent with the opt-out |
| src/shared/telemetry-config.ts:234-247 | - | re-review WR-01: raw errno on a read-only, linked config.json (review disposition open) | ⚠️ Warning (advisory) | Opt-out UX on home-manager setups; carried forward unchanged |
| IN-01..IN-12 (10-REVIEW.md) | - | carried-forward info items | ℹ️ Info | not goal blockers |

### Operational Notes (not goal gaps)

- **Auto-revert PR #17 (`auto-revert/main-88d050b1`, "revert: smoke failed on main at a5bc52e") is still OPEN.** It came from the `smoke (debian:13)` failure on a5bc52e. That leg passed on 80bb9d4 (run 41089922163), which supports the earlier flake reading. Main CI is green again, so this is not a goal gap. Closing the PR is the user's decision. Merging it would revert the code review fixes, so it should be closed without merging. If the debian exit 12 (prompt redraw timeout after accept) recurs, treat it as a real Debian stability issue rather than a flake.

### Human Verification Required

None. The UAT items were resolved earlier (10-UAT.md, 4/4 pass). The PR #17 disposition above is an operational housekeeping decision, not a verification item.

### Gaps Summary

There are no gaps. The single blocking gap from the previous report (R7: the Release Homebrew smoke broken by the 10-11 consent prompt) is closed by 80bb9d4. GitHub shows the result end to end: the Release smoke passed, 0.8.0 was tagged and published to npm and the Homebrew tap, and push CI on main is fully green with auto-revert skipped. No regressions. No later milestone phase exists, so nothing was deferred.

---

_Verified: 2026-10-30T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
