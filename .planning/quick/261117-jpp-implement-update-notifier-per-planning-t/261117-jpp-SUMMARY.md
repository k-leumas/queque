---
phase: quick-261117-jpp
plan: 01
subsystem: update-notifier
status: complete
tags: [update-check, daemon, ipc, doctor, homebrew, privacy, ci]
requires:
  - daemon Unix-socket IPC (requestDaemonOnce, startDaemonServer)
  - telemetry flagSet semantics
  - Ink CandidateSelect modal + modal-layout estimator
  - qq doctor DoctorDeps / doctorReportSchema
provides:
  - src/shared/update-check.ts (gate, registry fetch, semver + engines compare, 24 h cache with shownAt, formatUpdateHint, createUpdateChecker)
  - src/shared/install-detect.ts (detectInstall, installMarkerSchema, NPM_PACKAGE, USER_PREFIX_NOTE)
  - IPC kind update-hint (request + response)
  - dim once-a-day update line under ControlsLine in ??
  - qq doctor `update` row
  - Homebrew `.install-source` marker in both formula install blocks
affects:
  - src/daemon/server.ts, src/cli/commands/daemon.ts, src/client/run-foreground.ts
  - src/ui/CandidateSelect.tsx, src/ui/modal-layout.ts
  - src/cli/commands/doctor.ts, src/contracts/doctor.ts, src/contracts/ipc.ts
  - .github/workflows/release.yaml, .github/workflows/homebrew.yml
  - every distro / Homebrew Docker test and smoke script, vitest configs
tech-stack:
  added: []
  patterns:
    - daemon-side background fetch triggered only by a gated TTY client, never awaited by ??
    - cache file as source of truth with a synchronous read-decide-write for shownAt
    - install detection by who installed qq (marker, path, Linux owner queries), never by which package manager exists
key-files:
  created:
    - src/shared/update-check.ts
    - src/shared/install-detect.ts
    - tests/update-check.test.ts
    - tests/update-hint-ipc.test.ts
    - tests/install-detect.test.ts
    - tests/install-marker-formula.test.ts
  modified:
    - src/shared/telemetry-config.ts
    - src/contracts/ipc.ts
    - src/contracts/doctor.ts
    - src/daemon/server.ts
    - src/cli/commands/daemon.ts
    - src/cli/commands/doctor.ts
    - src/client/run-foreground.ts
    - src/ui/CandidateSelect.tsx
    - src/ui/modal-layout.ts
    - vitest.config.ts
    - vitest.live.config.ts
    - package.json
    - .github/workflows/release.yaml
    - .github/workflows/homebrew.yml
    - scripts/smoke-homebrew-docker.sh
    - scripts/docker-homebrew-smoke-runner.sh
    - scripts/ci/test-in-distro.sh
    - scripts/smoke-distro.sh
    - scripts/smoke-distro-runner.sh
    - README.md
    - docs/PRIVACY.md
    - tests/doctor.test.ts
    - tests/modal-layout.test.ts
    - tests/client-result.test.ts
    - .planning/todos/done/2026-11-15-update-notifier.md (moved from pending/)
    - .wolf/anatomy.md, .wolf/memory.md, .wolf/cerebrum.md, .wolf/buglog.json
decisions:
  - Cache at ${XDG_CACHE_HOME (absolute only) or ~/.cache}/queque/update-check.json on every platform incl. darwin (locked user decision 2026-11-17)
  - The daemon fetches only after a gated TTY client sends update-hint, never at daemon start
  - Once-a-day display uses shownAt in the cache file (shared by all terminals, survives daemon restarts)
  - A homebrew marker gets the plain wording; any other marker source counts as distro-packaged
  - qq doctor computes the update status in-process from the same cache file and never touches shownAt
  - USER_PREFIX_NOTE is exported from install-detect.ts so the doctor hint keys on the same constant
metrics:
  duration: "~80 min across three executor runs (Task 3: ~20 min)"
  completed: 2026-11-17
estimate:
  tokens: 145000
  tasks: 3
actuals:
  tokens: 46600
  tasks: 3
  commits: 5
plan_head_before: 908ec9f
plan_head_after: 8effde0
---

# Phase quick-261117-jpp Plan 01: Update Notifier Summary

The daemon checks the npm registry for a newer qq at most once every 24 h, in the background and only after a gated TTY `??` asks. `??` then shows one dim, truncated line under the controls at most once a day, with the upgrade command for how this qq was installed (marker, install path or Linux package-owner query) or the releases URL when that is unknown. `qq doctor` gets an `update` row, the Homebrew formula writes an `.install-source` marker, and README/PRIVACY document the `QQ_NO_UPDATE_CHECK` opt-out. vitest and every Docker test or smoke container run with the opt-out, so nothing in tests or CI reaches registry.npmjs.org.

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 | 301551a | feat(daemon): check npm for a newer qq once a day and show a dim hint in ?? |
| 2 | 30a744c | feat(update): name the upgrade command for each install method |
| 3a | 9b59057 | feat(doctor): add the update row before telemetry |
| 3b | 8effde0 | feat(update): write the homebrew install marker and document the opt-out |

`commits: 5` is `git rev-list --count 908ec9f..8effde0`. It includes 1a1ba1e (`docs(todo): add the update notifier spec`), which was committed on this base between Tasks 2 and 3 and is not plan work. The plan itself has four code commits. The Task 3 agent's own ledger (1a1ba1e..8effde0) counts 2.

## Task 1: tracer, from registry to cache to IPC to a dim modal line (301551a)

- `src/shared/update-check.ts`: gate (`QQ_NO_UPDATE_CHECK` > `CI` > not a terminal, using telemetry's `flagSet`), a hand-rolled semver compare with prerelease rules, `nodeFloor`/`nodeBelowFloor`, `fetchLatestRelease` (1.5 s AbortSignal, SEMVER_RE version, printable `engines.node` or null), a strict cache in a private 0700 dir with the file written 0600 via tmp + rename, `formatUpdateHint`, and `createUpdateChecker` (memoized detectInstall, deduped refresh, the file as source of truth).
- `src/shared/install-detect.ts`: marker, `/Cellar/queque/` and unknown rows.
- IPC `update-hint` request/response (hint capped at 200 chars, `.catch(null)`), a daemon case inside a Promise chain, and the daemon's checker wiring.
- The client sends the ask after `ensureDaemon` and never awaits it before render. It rerenders with the hint if the reply lands before the picker resolves.
- `CandidateSelect` renders `updateHint` as one dim `wrap="truncate"` row under ControlsLine, and the estimator counts exactly one row.
- `QQ_NO_UPDATE_CHECK=1` in both vitest configs.

## Task 2: every install row (30a744c)

detectInstall now covers WSL `/mnt/<drive>/` Node, volta, pnpm, nix, nvm, fnm, user and system npm (non-writable prefix: user-prefix note, never `sudo npm`), and the Linux-only `dpkg -S`, `rpm -qf` (suse: zypper; fedora/rhel/centos: dnf; else rpm with no command) and `pacman -Qoq` (+ `-Qm`: AUR) owner queries for unmatched `/usr` paths, first hit wins. formatUpdateHint has a pinned line per method.

## Task 3: doctor row, Homebrew marker, CI opt-out, engines, docs (9b59057, 8effde0)

- `qq doctor` `update` row, emitted between `node` and `telemetry` and started in the `Promise.all` with the daemon and provider probes. `update` is appended last to DOCTOR_CHECK_IDS. The row is warn when an update exists (install label + command or fallback copy) and ok for check off / unknown / current / failed. A non-writable npm prefix gets `npm config set prefix ~/.local, then npm i -g @k-leumas/queque-cli@latest (not sudo)`. Rows are now 13 for zsh and Linux bash, 14 for macOS bash.
- `defaultDoctorDeps().updateStatus` builds the checker lazily and calls `.status({ isTTY, refresh: true })`. Under vitest it returns `blocked: QQ_NO_UPDATE_CHECK`, which a test pins.
- Both formula install blocks write `.install-source` = `{"source":"homebrew","upgrade":"brew upgrade queque"}` right after the `std_npm_args` install, and the smoke emulation printf-writes the same bytes. `tests/install-marker-formula.test.ts` checks that all three copies are identical and valid, and that the npm `files` list never ships a marker.
- `QQ_NO_UPDATE_CHECK=1` is set in test-in-distro.sh, smoke-distro.sh, both rc writes in smoke-distro-runner.sh, smoke-homebrew-docker.sh `docker run` and docker-homebrew-smoke-runner.sh. The CI `bash-versions` container has no qq in it, so it needs no opt-out.
- package.json: `"engines": { "node": ">=24" }`.
- README `## More` has an Update check bullet. docs/PRIVACY.md has `## Update check`, covering what is sent, when, the cache location (`$XDG_CACHE_HOME/queque/` when absolute, else `~/.cache/queque/`, on macOS and Linux alike), how the command is chosen (marker, path, local owner queries), the once-a-day line and the opt-outs.
- The todo moved to `.planning/todos/done/` with `git mv`. Wolf records: anatomy entries for every touched file plus the new test, a cerebrum Key Learning, and memory lines.

## Verification

- Targeted Task 3 verify: `vitest run tests/doctor.test.ts tests/install-marker-formula.test.ts tests/readme-badges.test.ts tests/shell-names-invariant.test.ts tests/docs-links.test.ts`: 157/157.
- `actionlint` on release.yaml and homebrew.yml: clean. Both formula `install:` blocks pass `ruby -c` inside a `def install`.
- Edited shell scripts pass `sh -n` / `bash -n`. The plan's grep counts hold: QQ_NO_UPDATE_CHECK at least 1 per file and 3 in smoke-distro-runner.sh; `install-source` exactly once in each workflow.
- `pnpm typecheck` and `pnpm lint` (biome, 173 files): clean.
- Full suite, plain `pnpm test:run`: 70 files, 1988/1988 passed. On a pty (`script -q /dev/null pnpm test:run`): 70 files, 1988/1988 passed.
- Real-binary spot check (built dist, pty, a pre-filled fresh cache in the scratchpad via XDG_CACHE_HOME, so no fetch): `⚠ qq 99.0.0 available (installed via unknown) — fix: see https://github.com/k-leumas/queque/releases`. With QQ_NO_UPDATE_CHECK=1, `--json` gives `update check off (QQ_NO_UPDATE_CHECK is set)` just before telemetry.

## Deviations from Plan

### Tasks 1-2 (carried over from the earlier executor)

1. **[Rule 2 - Missing coverage] tests/client-result.test.ts 4-case block** (`runForegroundClient: update hint`, not in the plan's file list). It covers: nothing is sent under the vitest opt-out; nothing is sent when stdout is not a terminal; the client asks the daemon and adds the hint to the current view without changing it; and a daemon that never answers does not hold the result. Commit 301551a.
2. **[Rule 1 - Bug] readUpdateCache no longer creates the cache dir (bug-555).** A read with mkdir side effects created `~/.cache/queque` just from looking. Reads now only lstat-check the dir; only writes mkdir it. Logged as bug-555 in .wolf/buglog.json. Commit 30a744c.
3. **[Design detail] The first hint with no cache returns null.** It starts the background fetch, and the line appears on a later `??` (discretion 2 made explicit).
4. **[Rule 1 - Bug] hint() returns null when the shownAt write fails.** Otherwise an unwritable cache would show the line on every `??`.
5. **[Rule 1 - Bug] Future timestamps count as elapsed** (checkedAt/shownAt later than now, after a clock change), so a skewed clock cannot suppress checks forever.
6. **[Precision] The npm fallback applies only to `/usr/.../lib/node_modules/@k-leumas/queque-cli/`.** Other unmatched `/usr` paths stay unknown rather than getting a guessed npm command.
7. **[Ordering] windows-node is checked before nodeTooOld** in formatUpdateHint, so a WSL user on a Windows Node gets the WSL line rather than a Node-version line. Task 3's doctor row mirrors that order.

### Task 3

1. **[Rule 2 - Small export] USER_PREFIX_NOTE is exported from src/shared/install-detect.ts** (not in Task 3's file list). The doctor's spelled-out user-prefix hint keys on the same constant instead of a duplicated string that could drift. Commit 9b59057.
2. **[Test structure] PHASE10_IDS in tests/doctor.test.ts.** The plan's `DOCTOR_CHECK_IDS.slice(0, 12)` still equals ZSH_IDS no longer holds once `update` is a zsh row emitted before telemetry. The test keeps the original twelve ids as PHASE10_IDS (asserted against `slice(0, 12)`, so the add-never-rename guard is unchanged), and ZSH_IDS is the 13-row emitted order. Commit 9b59057.
3. **[Rule 2 - Defensive cap] The doctor update summary and hint are clipped to DOCTOR_TEXT_MAX.** A 64-char version plus a 120-char marker command stay under 200 today. The clip keeps doctorReportSchema.parse from ever throwing on a future copy change, and a test pins the worst case.
4. **[Extra test]** `defaultDoctorDeps().updateStatus()` is asserted to be `blocked: QQ_NO_UPDATE_CHECK` under vitest, proving the real-machine doctor block stays offline.
5. **[Split commit]** Task 3 landed as two atomic commits (doctor row; marker + CI + docs), as the orchestrator allowed.

## Deferred Issues / Open Questions

- **MODAL_VIEWPORT_LINES = 18 overflow (open, for the user; raised by the Tasks 1-2 executor):** the update row adds one line to the picker's estimated height (`estimateCandidateSelectLines` +1). On a full list, that can go one row past the 18-line modal viewport (MODAL_VIEWPORT_LINES = INSTANT_FRAME_VIEWPORT_LINES). How to absorb it is left to the user. The constant was not changed, as instructed.
- **smoke-homebrew-docker.sh uses `FROM node:22-bookworm`,** below the new `engines.node >=24` (and the tsup node24 target that was already there). npm only prints an EBADENGINE warning (`--loglevel=error` hides it), so the smoke keeps working. Moving the image to node:24 is out of scope here.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat register. The doctor row adds no path or env output (T-261117jpp-07 is mitigated by fixed copy plus validated values and the 200-char clip).

## TDD Gate Compliance

- Tasks 1-2: tests written first per the plan's behavior blocks (see the earlier executor's commits).
- Task 3: the doctor row tests failed first through `pnpm typecheck` (the `healthyDeps` fixture lacked `updateStatus`, and the row did not exist), then passed. The marker test cannot pass without the workflow edits. Both were committed with their code in the same commit, as the quick-task plan asks.

## Self-Check: PASSED

- FOUND: src/shared/update-check.ts, src/shared/install-detect.ts, tests/install-marker-formula.test.ts, .planning/todos/done/2026-11-15-update-notifier.md
- FOUND commits: 301551a, 30a744c, 9b59057, 8effde0 (all ancestors of HEAD)
