---
phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
verified: 2026-10-30T17:30:00Z
status: gaps_found
score: 92/93 must-haves verified
covered_files: [".github/workflows/ci.yml",".github/workflows/distro.yml",".github/workflows/nightly.yml",".github/workflows/release.yaml",".planning/REQUIREMENTS.md",".planning/ROADMAP.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-01-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-01-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-02-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-02-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-03-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-03-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-04-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-04-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-05-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-05-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-06-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-06-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-07-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-07-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-08-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-08-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-09-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-09-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-10-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-10-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-11-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-11-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-12-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-12-SUMMARY.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-13-PLAN.md",".planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-13-SUMMARY.md","biome.json","package.json","scripts/ci/auto-revert.sh","scripts/ci/code-changed.mjs","scripts/ci/install-distro-deps.sh","scripts/ci/test-in-distro.sh","scripts/docker-homebrew-smoke-runner.sh","scripts/smoke-distro-runner.sh","scripts/smoke-distro.exp","scripts/smoke-distro.sh","scripts/smoke-homebrew-docker.sh","shell/zsh/queque.zsh","src/cli/commands/daemon.ts","src/cli/commands/doctor.ts","src/cli/commands/telemetry.ts","src/cli/main.ts","src/client/run-foreground.ts","src/client/telemetry-consent.ts","src/client/telemetry-events.ts","src/contracts/doctor.ts","src/contracts/ipc.ts","src/contracts/telemetry.ts","src/daemon/bootstrap.ts","src/daemon/fetch-client.ts","src/daemon/server.ts","src/daemon/telemetry-buffer.ts","src/env.d.ts","src/providers/claude-default.ts","src/providers/error-kind.ts","src/providers/provider-kind.ts","src/shared/environment-shape.ts","src/shared/qq-config.ts","src/shared/telemetry-config.ts","src/shared/telemetry-endpoint.ts","tests/auto-revert.test.ts","tests/client-result.test.ts","tests/code-changed.test.ts","tests/daemon-bootstrap.test.ts","tests/doctor.test.ts","tests/environment-shape.test.ts","tests/error-kind.test.ts","tests/fixtures/auto-revert/gh","tests/git-env-isolation.test.ts","tests/live/sdk-contract.live.ts","tests/lsof-busybox.test.ts","tests/prewarm-sleep.test.ts","tests/setup/scrub-git-env.ts","tests/telemetry-buffer.test.ts","tests/telemetry-cli.test.ts","tests/telemetry-config.test.ts","tests/telemetry-consent.test.ts","tests/telemetry-contract.test.ts","tests/telemetry-endpoint.test.ts","tests/telemetry-events.test.ts","tests/telemetry-ipc.test.ts","tests/zsh-widget.test.ts","tsconfig.json","tsup.config.ts","vitest.config.ts","vitest.live.config.ts"]
covered_digest: "v3:sha256:ba61b26247025a3783b42119ec9143f061c3ecaef0a700d5bae3fdcb0e30543f"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Phase 10 does not break the existing release path: the Release workflow's Homebrew install smoke still passes on main (derived from the goal clause 'catch environment breakage before it reaches main')"
    status: failed
    reason: "The 10-11 consent prompt ('QueQue: send anonymous usage and error counts ...? [y/N]') is printed after the accepted command in the Homebrew smoke container. scripts/docker-homebrew-smoke-runner.sh treats any 'QueQue:' output after Enter as an error (expect -re {QueQue:} -> exit 13). Release run 41072733118 on origin/main a5bc52e failed at 'Homebrew install smoke' with exit 13 on both attempts (14:34 and 16:18), so tag-and-changelog, publish-npm and publish-homebrew were skipped. The previous Release run (40578760934 on 489a67a) passed the same step. smoke-distro-runner.sh already sets QQ_TELEMETRY=0 for this exact reason (research Pitfall 10); the Homebrew runner was never updated. ci.yml does not exercise the Homebrew smoke, so this breakage reached main uncaught."
    artifacts:
      - path: "scripts/docker-homebrew-smoke-runner.sh"
        issue: "The ~/.zshrc block (lines 21-26) does not set QQ_TELEMETRY=0, and the post-accept expect (lines 58-69) fails on the consent prompt's 'QueQue:' prefix"
      - path: "scripts/smoke-homebrew-docker.sh"
        issue: "docker run passes only ANTHROPIC_API_KEY and QQ_SMOKE_QUERY (lines 115-117), so the CI kill switch does not reach the container"
    missing:
      - "Add `export QQ_TELEMETRY=0` to the zshrc block that docker-homebrew-smoke-runner.sh appends (this mirrors smoke-distro-runner.sh:102-105), or answer the prompt with `n` in the expect script"
      - "Re-run the Release workflow on main and confirm the 'Homebrew install smoke' step passes and the publish jobs run"
      - "Optional hardening: have the Homebrew smoke's error regex match real error prefixes rather than the bare product name, so a future informational 'QueQue:' line does not block releases"
---

# Phase 10: Linux distro CI harness and anonymous telemetry Verification Report

**Phase Goal:** Catch environment breakage before it reaches main, make zsh support stable across the major Linux distros, and add opt-in, privacy-safe error/usage reporting.
**Verified:** 2026-10-30T17:30:00Z
**Status:** gaps_found
**Re-verification:** No. The previous report had no `gaps:` section, so this is a fresh initial verification. It was regenerated because the code review fix run changed covered source files. The five truths that were open before (two behavior-unverified, three uncertain) were re-checked against code, GitHub and 10-UAT.md.

## Goal Achievement

The planned work is all present, wired and tested. The four human items from the previous report are resolved: 10-UAT.md shows 4/4 pass, and I checked each one against GitHub or the code (see below).

One goal-level regression is new. I found it on GitHub rather than in the plans. The consent prompt added in 10-11 breaks the **Release** workflow's Homebrew install smoke on main, and it does so deterministically: both attempts fail with exit 13 on the prompt text. As a result, no tag or npm/Homebrew publish can run from main. This is breakage that reached main, which is exactly what the first goal clause targets, so I count it as a BLOCKER.

Separately, the push CI on main (run 41072732766, a5bc52e) is red because of one `smoke (debian:13)` leg. That leg opened auto-revert PR #17, which is still OPEN. The evidence points to a flake: the same leg passed on renovate branch 56b34f1, which contains the fix commits, and `debian:latest` passed on the Nightly run of the same SHA. It is therefore a WARNING, not a gap.

### Observable Truths: roadmap level

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| R1 | `ci.yml` has a `checks` job and a six-distro vitest matrix, plus a nightly against `:latest` | ✓ VERIFIED | ci.yml/distro.yml unchanged in structure. The Nightly run 41073946911 (workflow_dispatch on a5bc52e) succeeded: `live`, five `test-distro (*:latest)` and five `smoke (*:latest)` legs are all success |
| R2 | `scripts/smoke-distro.sh` drives a real zsh PTY from `pnpm pack` with only `claude` faked, as a `smoke` matrix job | ✓ VERIFIED | Runner and exp are unchanged apart from WR-06 (stale doctor files cleared). 6/6 smoke legs green on 56b34f1 (run 41072982303) and 5/6 on main (see the debian warning) |
| R3 | Roadmap item 3 is amended by D-13 to D-16: no lefthook Docker smoke; remote smoke on every push and an auto-revert PR on failure | ✓ VERIFIED | The mechanism fired for real on main: run 41072732766 had `smoke (debian:13)` failure, `auto-revert` success, and PR #17 `auto-revert/main-88d050b1` was opened (the WR-05 hash-suffixed name) |
| R4 | `qq doctor` covers zsh, TERM, locale, socket path, conflicting widgets and provider, and the smoke asserts exit 0 | ✓ VERIFIED | WR-03 added `socketConnectable` (doctor.ts:74,249,388-401); tests/doctor.test.ts passed |
| R5 | Telemetry is opt-in and off under DO_NOT_TRACK/QQ_TELEMETRY=0/CI, with a strict allow list, daemon batching, `qq telemetry status\|on\|off\|show`, and a vitest that fails on unknown fields | ✓ VERIFIED | telemetry-contract and telemetry-events passed. UAT 2 shows a real event stored in PostHog EU |
| R6 | Privacy-safe: no prompt, buffer, command, path or env value is sent | ✓ VERIFIED | Leak test in tests/telemetry-events.test.ts passed. UAT 2: the stored event has no `$ip`, no `$geoip_*` and no person profile |
| R7 (derived) | Phase 10 does not break the existing release path (Release Homebrew smoke passes on main) | ✗ FAILED | Release run 41072733118 failed at "Homebrew install smoke" with exit 13, on attempts 1 and 2. The log shows `QueQue: send anonymous usage and error counts ... [y/N]`, which the runner's `-re {QueQue:}` treats as an error. `git log -S` traces the prompt string to 28d9099 (10-11) |

### Observable Truths: plan must_haves (86 truths across 13 plans)

| Plan | Truths | Verified | Change since the last report |
|------|--------|----------|------------------------------|
| 10-01 tracer smoke + busybox lsof | 8 | 8 | none |
| 10-02 prewarm simulation + mktemp guard | 5 | 5 | none |
| 10-03 qq doctor | 7 | 7 | WR-03 hung-socket warning added; doctor tests green |
| 10-04 telemetry contract/config/endpoint | 8 | 8 | tsup key still `JSON.stringify('')` and host EU; vitest keeps an empty key |
| 10-05 ci.yml/distro.yml | 7 | 7 | WR-04: `QQ_CHANGES_BASE` is `''` on push (ci.yml:45). code-changed tests green |
| 10-06 daemon buffer/IPC/error kinds | 8 | 8 | none |
| 10-07 auto-revert | 8 | 8 | WR-05: `git hash-object` suffix (auto-revert.sh:219) and `--base` filter (:349); tests green; the live firing produced PR #17 |
| 10-08 nightly + live | 5 | 5 | **was 3/5.** D-02 live contract and the `:latest` matrices are now VERIFIED by Nightly run 41073946911 (all 11 jobs success) and UAT 1 |
| 10-09 qq telemetry CLI + doctor row | 6 | 6 | none |
| 10-10 client events | 7 | 7 | none |
| 10-11 consent prompt + phase gate | 7 | 7 | **was 6/7.** The "asked once ever" truth is now VERIFIED. CR-01 was fixed by `telemetryStateWritable()` (telemetry-config.ts:205), which gates the ask at run-foreground.ts:488-495. tests/client-result (two accepted queries with an unwritable config, never asked) and telemetry-config passed. The ENOSPC-at-write case remains, as documented |
| 10-12 human CI gates | 5 | 5 | none |
| 10-13 telemetry key decision | 5 | 5 | **was 3/5.** UAT 2: PostHog EU project "queque - telemetry" exists with anonymize_ips on; one `qq_environment` event returned HTTP 200 and was stored with no `$ip`, no `$geoip_*` and 0 persons. The key was supplied as a runtime `QQ_TELEMETRY_KEY` override. The build key stays empty by the user's keep-empty decision (D-08), so that is recorded, not a gap |

**Score:** 92/93 truths verified (7 roadmap level including one derived, plus 86 plan truths). 1 FAILED (R7). 0 behavior-unverified.

### Required Artifacts

| Check | Result |
|-------|--------|
| `verify.artifacts` across plans 01-11 and 13 | 40/40 passed |
| Plan 12 | no artifacts declared (human gates); verified through `gh` |
| Code review fix symbols | All present: `telemetryStateWritable`, `writeTarget`/`realpathSync`, `!inZellij` ask guard, `socketConnectable`, `QQ_CHANGES_BASE` push `''`, `BRANCH_HASH` with `--base`, and stale `doctor.json`/`doctor.txt` removal |

### Key Link Verification

| Result | Detail |
|--------|--------|
| `verify.key-links` for plans 01-11 and 13 | 36/36 WIRED |
| 10-12 drill event -> auto-revert.sh | The tool cannot resolve an event source. Verified live twice: drill PR #16, and on main PR #17 |
| Release workflow -> consent prompt | **Broken interaction.** release.yaml:45-48 runs `scripts/smoke-homebrew-docker.sh`. The container gets no QQ_TELEMETRY/CI kill switch, so the consent prompt appears after accept and the runner's expect treats it as an error |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| telemetry-buffer -> `/batch/` | serialized batch | client IPC, then strict re-validation | yes. UAT 2 shows a stored event in PostHog EU when given a runtime key | ✓ FLOWING (needs a runtime key; the shipped build sends nothing by user decision) |
| doctor.json in revert PR body | `qq doctor --json` | smoke artifacts | yes (PR #16, PR #17) | ✓ FLOWING |

### Behavioral Spot-Checks (run by this verifier)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CR-01/WR-01..05 fixes, consent, doctor, path filter, auto-revert, contract, leak test | `pnpm exec vitest run tests/telemetry-config tests/client-result tests/telemetry-consent tests/doctor tests/code-changed tests/auto-revert tests/telemetry-contract tests/telemetry-events` | 8 files, 313 tests passed | ✓ PASS |
| Nightly live + `:latest` legs | `gh run view 41073946911` | success; live plus 10 distro legs all success | ✓ PASS |
| Push CI on main a5bc52e | `gh run view 41072732766` | `smoke (debian:13)` failure (exp exit 12, prompt redraw timeout), all others success, `ci-ok` failure, PR #17 opened | ⚠️ WARNING (flake by evidence) |
| Same fix commits on renovate/actions-checkout-7.x 56b34f1 | `gh run view 41072982303` | 6/6 smoke success | ✓ PASS |
| Release Homebrew smoke on main | `gh run view 41072733118` (attempts 1 and 2) | exit 13 on the consent prompt, both attempts | ✗ FAIL |

### Probe Execution

Step 7c: not applicable. There are no `scripts/*/tests/probe-*.sh`. The smoke matrices are the runnable checks, and their GitHub results are cited above.

### Requirements Coverage

All nine IDs now resolve from `.planning/REQUIREMENTS.md`, at lines 52-59, 66 and 115-123. The ROADMAP Phase 10 `**Requirements**:` line lists all nine. No ID is orphaned.

| Requirement | Source Plans | Status | Evidence |
|-------------|--------------|--------|----------|
| P10-CI | 05, 08, 12 | ✓ SATISFIED | ci.yml/distro.yml; Nightly 41073946911 green; `ci-ok` required |
| P10-SMOKE | 01, 05, 11, 12 | ✓ SATISFIED | 6/6 smoke on 56b34f1; 5/5 `:latest` on Nightly |
| P10-REVERT | 07, 12 | ✓ SATISFIED | tests green; fired live (PR #16 drill, PR #17 on main) |
| P10-DOCTOR | 03, 05, 09 | ✓ SATISFIED | doctor tests; smoke exit-34/35 gates |
| P10-TEL | 04, 06, 09, 10, 11, 13 | ✓ SATISFIED (code and privacy); but see the gap: the consent prompt broke the release smoke | contract, buffer, consent and leak tests; UAT 2 |
| P10-LIVE | 08 | ✓ SATISFIED | Nightly `live` job success |
| P10-PREWARM | 02, 11 | ✓ SATISFIED | prewarm-sleep tests (prior run); unchanged code |
| P10-FIX | 01, 02, 03, 11 | ✓ SATISFIED | lsof-busybox, mktemp guard, jq check |
| ZSHX-01 | phase-level (marked done in REQUIREMENTS.md) | ✓ SATISFIED | six Linux distros green on PR pins and `:latest` |

### Anti-Patterns Found

The debt-marker scan (TBD/FIXME/XXX) over the 14 files the fix run changed found nothing. The rest of the phase was scanned clean in the previous run and is unchanged.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| scripts/docker-homebrew-smoke-runner.sh | 21-26, 58-69 | the PTY smoke was not updated for the new post-accept consent prompt | 🛑 Blocker | Release pipeline red on main; nothing publishes |
| (GitHub) PR #17 | - | an open auto-revert PR against main, from a likely-flaky debian leg | ⚠️ Warning | Merging it would restore the last green tree and undo the code review fixes. It needs a human close plus a CI rerun on main |
| src/shared/telemetry-config.ts:234-247 | - | re-review WR-01: `qq telemetry on\|off` on a config.json linked into a read-only store prints a raw errno | ⚠️ Warning (advisory, review disposition open) | Opt-out UX on home-manager setups |
| .github/workflows/ci.yml:45 | - | re-review IN-11: every push to main now runs the full matrix and can auto-revert. This just happened, in PR #17 | ℹ️ Info (advisory) | Flakes on main produce revert PRs |
| IN-01..IN-10, IN-12 (10-REVIEW.md) | - | carried-forward info items | ℹ️ Info | not goal blockers |

### Human Verification Required

Status is gaps_found, so these are follow-ups to do alongside the gap closure, not the gating items:

1. **PR #17 and red `ci-ok` on main.** Close PR #17 (`auto-revert/main-88d050b1`) without merging. Re-run the failed `smoke (debian:13)` job of run 41072732766, or push the gap fix, and confirm `ci-ok` is green on main. Why human: whether to treat the debian exit 12 (prompt redraw timeout after accept) as a flake is a judgment call. If it recurs, it is a real Debian stability issue for the "zsh stable across distros" clause.

### Gaps Summary

There is one blocking gap. Phase 10 added a one-time consent prompt that prints after an accepted `??`. The new distro smoke was adapted to it (QQ_TELEMETRY=0 plus a dedicated consent pass), but the pre-existing Release workflow's Homebrew smoke was not. That smoke fails on any `QueQue:` output after accept, so the Release `test` job now fails on main every time, and tag/changelog/npm/Homebrew publishing is blocked. The fix is one line in `scripts/docker-homebrew-smoke-runner.sh` (`export QQ_TELEMETRY=0` in the appended zshrc block), followed by a Release re-run.

Every other must-have is verified. That includes the five truths left open last time: nightly live and `:latest` (run 41073946911), CR-01 (fixed and tested), and the PostHog privacy check (UAT 2, runtime key, with the build key kept empty by user decision). Requirements traceability is complete.

No later milestone phase exists in ROADMAP.md, so nothing was deferred.

---

_Verified: 2026-10-30T17:30:00Z_
_Verifier: Claude (gsd-verifier)_
