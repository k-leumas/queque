---
phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
fixed_at: 2026-10-30T14:21:00Z
review_path: .planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-10-30T14:21:00Z
**Source review:** .planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (CR-01, WR-01..WR-06; IN-* left alone per fix_scope `critical_warning`)
- Fixed: 7
- Skipped: 0

**Where verification ran:** the main checkout at /Users/samuel/dev/tui-llm on `main`. The
orchestrator asked for direct commits to main, and a hand-rolled worktree would have had no
node_modules for biome, tsc and vitest. Each commit went through the lefthook pre-commit gates
(tsc --noEmit, biome check) and commitlint. Nothing was pushed.

## Fixed Issues

### CR-01: Consent question is asked again after every accepted `??` when the config file cannot be updated

**Files modified:** `src/shared/telemetry-config.ts`, `src/client/run-foreground.ts`, `tests/telemetry-config.test.ts`, `tests/client-result.test.ts`
**Commit:** f4daecd
**Applied fix:** Added `telemetryStateWritable(path)`. It runs `readRawConfig` (which throws for invalid JSON, a non-object or an unreadable file) and then checks W_OK|X_OK on the nearest existing directory that the write would use. It never throws. `run-foreground.ts` now asks only when `shouldAskTelemetryConsent(...) && telemetryStateWritable()`. The unit tests cover a missing file, an object file, a missing nested dir, invalid JSON, a non-object, a directory at the config path, read-only dirs (skipped when run as root) and the QQ_CONFIG_FILE default. A client test runs two accepted queries with an unwritable config and checks that the question is never asked. A transient ENOSPC at write time cannot be probed in advance and still leads to a repeat ask.
**Status:** fixed: requires human verification (logic change to the consent gate)

### WR-01: In Zellij, the consent question appears after the widget has returned and can take the next keystroke

**Files modified:** `src/client/run-foreground.ts`, `tests/client-result.test.ts`
**Commit:** 89f32d2
**Applied fix:** Took the review's first option: the ask condition now includes `!inZellij`. A regression test sets ZELLIJ and checks that the result is written, no question is asked and the telemetry report still runs. The consent tests now clear ZELLIJ by default, so they also pass when the suite runs inside Zellij. Product effect: Zellij users never see the one-time question and can opt in only with `qq telemetry on`. That holds until the Zellij path gets its own ask design (for example, asking before the FIFO write).
**Status:** fixed: requires human verification (UX choice: skip, not reorder)

### WR-02: The consent write replaces a symlinked `config.json` with a regular file

**Files modified:** `src/shared/telemetry-config.ts`, `tests/telemetry-config.test.ts`
**Commit:** b3430ac
**Applied fix:** Added `writeTarget(path)`. It returns `realpathSync(path)`. For a dangling link it follows one readlink hop and resolves it against the link's directory. Otherwise it returns the path unchanged. `writeTelemetryState` now runs mkdir, creates the temp file and renames in the target's directory. `telemetryStateWritable` checks the target's directory too, so a link into a read-only store (such as home-manager's /nix/store) means "do not ask". Tests cover absolute links, relative links, dangling links (the link survives, the target is created, other keys are kept, no temp file is left behind) and a read-only target dir.

### WR-03: `qq doctor` reports a stuck daemon as "not running" with an ok status

**Files modified:** `src/daemon/bootstrap.ts`, `src/cli/commands/doctor.ts`, `tests/doctor.test.ts`
**Commit:** 3e2be88
**Applied fix:** Exported `tryConnect` from bootstrap and added `DoctorDeps.socketConnectable`, with `tryConnect` as the default. When the ping returns `unknown` and the socket accepts connections, doctor now warns: "a process accepts connections on <socket> but does not answer the daemon ping". The hint is: "stop the process holding <socket> (lsof -t <socket>); the next ?? starts a fresh daemon". The review's suggested hint, `qq daemon --ensure`, was not used: `ensureDaemon` keeps a listener that does not answer, so that command would not replace it. Tests cover the injected cases, a connect probe that throws, no probe when the ping answers, and a real `net.Server` that accepts connections and never replies.

### WR-04: Push runs diff against `github.event.before`, so a doc-only push after an untested code push reports a green `ci-ok`

**Files modified:** `.github/workflows/ci.yml`, `scripts/ci/code-changed.mjs`, `tests/code-changed.test.ts`
**Commit:** 5bcda88
**Applied fix:** `QQ_CHANGES_BASE` is now `pull_request.base.sha` for PRs and `''` for pushes, so the script diffs against the merge base with main. The script now returns `code=true` when the base resolves to HEAD itself. Without that, an empty base on a push to main would compare HEAD...HEAD and skip every check. Tests cover the cancelled-code-push-then-docs-push sequence (the old `before` base gives `code=false`, the empty base gives `code=true`), a push to main itself, and an explicit base equal to HEAD. actionlint is clean. Trade-off: on a feature branch whose diff against main contains code, a docs-only push now runs the full checks.
**Status:** fixed: requires human verification (CI gating logic; confirm on the next real push)

### WR-05: Different branches can map to the same auto-revert branch and overwrite each other's revert PR

**Files modified:** `scripts/ci/auto-revert.sh`, `tests/auto-revert.test.ts`
**Commit:** 2533e34
**Applied fix:** `HEAD_BRANCH` is now `auto-revert/<branch with / replaced by ->-<first 8 hex of git hash-object of the exact branch name>`. This uses `git hash-object --stdin` instead of `sha256sum`, which is missing on macOS, while git is always present. `gh pr list` now also filters `--base "$BRANCH"`. The tests compute the expected name independently (sha1 of the git blob). A new test runs `feat/x` and then `feat-x` and checks that they get two separate head branches, that both `pr list` calls carry the right `--head`/`--base`, and that two PRs are created. shellcheck is clean. The ci.yml `auto-revert/` prefix guard still applies.

### WR-06: Stale `doctor.json`/`doctor.txt` from an earlier local run survive and are reported as current

**Files modified:** `scripts/smoke-distro.sh`, `scripts/smoke-distro-runner.sh`
**Commit:** a1eba67
**Applied fix:** `smoke-distro.sh` now also removes `doctor.json` and `doctor.txt` from the reused output dir. The runner also clears `/out/doctor.json` and `/out/doctor.txt` at start, as defense in depth; there is one runner per `/out`, so no report from the same run is lost. Verified with `bash -n` and shellcheck. No vitest test was added and no Docker run was made: the scripts need Docker, and Docker was off-limits for this run.

## Verification

All commands ran in the main checkout:
- `pnpm exec vitest run tests/client-result.test.ts tests/telemetry-config.test.ts tests/telemetry-consent.test.ts tests/telemetry-cli.test.ts tests/doctor.test.ts tests/code-changed.test.ts tests/auto-revert.test.ts tests/daemon-bootstrap.test.ts`: 8 files, 247 tests, all passed (after the last commit).
- `pnpm exec tsc --noEmit` and `pnpm exec biome check --write <files>` before every commit, plus the lefthook pre-commit typecheck and lint gates. All clean.
- `actionlint` clean. `shellcheck` clean on `scripts/ci/auto-revert.sh`, `scripts/smoke-distro.sh` and `scripts/smoke-distro-runner.sh`.
- Not run: the full suite, the Docker distro smoke, and any GitHub workflow.

---

_Fixed: 2026-10-30T14:21:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
