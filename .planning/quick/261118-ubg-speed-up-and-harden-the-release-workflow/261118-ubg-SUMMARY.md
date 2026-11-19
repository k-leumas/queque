---
phase: quick-261118-ubg
plan: 01
subsystem: ci
status: complete
tags: [ci, release, docker, buildx, homebrew, smoke, apt-cache]
requires:
  - tests/fixtures/fake-claude-stream.mjs (distro smoke's fake model)
provides:
  - Key-free Homebrew install smoke that never skips
  - Cached smoke image (deps-first, version-stripped manifest, CI-only gha cache)
  - Parallel release `test` and `brew-smoke` jobs with an apt cache in `test`
affects:
  - .github/workflows/release.yaml
  - scripts/smoke-homebrew-docker.sh
  - scripts/docker-homebrew-smoke-runner.sh
tech-stack:
  added:
    - awalsh128/cache-apt-pkgs-action@v1
    - docker/setup-buildx-action@v4
    - crazy-max/ghaction-github-runtime@v4
  patterns:
    - Multi-stage manifest stage that strips package.json `version` so BuildKit's content-keyed COPY --from reuses the npm layer across releases
    - Allow-list .dockerignore guarded against the Dockerfile's COPY sources by a vitest
    - Fail-closed env gate (unset or gha) checked before any docker command
key-files:
  created:
    - .dockerignore
    - tests/homebrew-smoke-docker.test.ts
  modified:
    - scripts/smoke-homebrew-docker.sh
    - scripts/docker-homebrew-smoke-runner.sh
    - .github/workflows/release.yaml
    - .wolf/anatomy.md
    - .wolf/memory.md
    - .wolf/cerebrum.md
    - .wolf/buglog.json
decisions:
  - The Homebrew smoke runs on the fake claude with no key and no skip path; the live API stays on the nightly live job
  - The smoke image's npm layer is keyed on package.json minus version plus pnpm-lock.yaml; local runs stay on plain docker build, CI uses buildx + type=gha only when QQ_SMOKE_DOCKER_CACHE=gha
  - The runner's teardown waits for the empty prompt after Ctrl-C before sending exit (zsh flushes typeahead on SIGINT)
metrics:
  duration: ~20 min
  completed: 2026-11-18
estimate:
  tokens: 75000
  tasks: 3
actuals:
  tokens: 7183
  tasks: 3
  commits: 3
plan_head_before: 549b2eb3ea9c146453e81517fac78d436670a39b
plan_head_after: d63cebe3c5f5f9078347b32d0ab4caf56946dcdd
---

# Phase quick-261118-ubg Plan 01: Speed up and harden the release workflow Summary

The Homebrew install smoke now runs on the fake claude, so it needs no key and has no skip
path. It runs in its own `brew-smoke` job in parallel with `test`, on an image that keeps its
npm layer across source edits and release version bumps (buildx + gha cache in CI). The `test`
job now restores its apt shell deps from a cache.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Homebrew smoke on the fake claude, no key (tracer) | bc717a8 | scripts/smoke-homebrew-docker.sh, scripts/docker-homebrew-smoke-runner.sh |
| 2 | Cached smoke image: deps-first, version-stripped manifest, .dockerignore, CI-only gha | 01d1d68 | scripts/smoke-homebrew-docker.sh, scripts/docker-homebrew-smoke-runner.sh, .dockerignore, tests/homebrew-smoke-docker.test.ts |
| 3 | Release workflow: parallel test and brew-smoke, apt cache, gha wiring | d63cebe | .github/workflows/release.yaml, tests/homebrew-smoke-docker.test.ts |

Each commit also carries its .wolf/ changes.

## Local timings

Measured on this Mac (Docker Desktop 20.10.12, BuildKit, load average 4-8). No Anthropic key
was in the environment for any run. "npm" is the `npm install --ignore-scripts` step's status
in the BuildKit plain log. The Node base image and the apt layer were already in the local
cache for every row, including the `--no-cache` row for the base image. Every run exited 0
and printed "smoke passed".

| Scenario | Layout | Wall (s) | Image build (s) | npm install step |
| -------- | ------ | -------- | --------------- | ---------------- |
| First key-free run (Task 1) | old (npm + tsup in one RUN, after COPY src) | 96 | not timed (old script had no timer) | DONE (apt CACHED) |
| Before: src change (Task 1) | old | 73 | not timed (old script had no timer) | DONE 55.9 s (npm + tsup in one RUN) |
| A: cold, `--no-cache` | new | 81 | 78 | DONE 47.6 s |
| B: warm, no change | new | 4 | 2 | CACHED |
| C: src change (comment in src/cli/main.ts) | new | 12 | 9 | CACHED (tsup 5.9 s, emulation 1.0 s re-ran) |
| D: version bump to a never-built 9.9.10 | new | 21 | 16 | CACHED (manifest stage re-ran 0.6 s, its COPY --from CACHED; tsup 8.7 s, emulation 3.5 s) |
| Runner-only edit (bug-558 fix) | new | 5 | 2 | CACHED (only the last COPY + chmod re-ran) |

A src change went from 73 s to 12 s and a release version bump to 21 s, because the npm layer
is reused. The first D attempt (9.9.9) also showed npm CACHED with a 9 s build, but its wall
time was 53 s: that run exposed the teardown race below.

Build context listing (busybox `COPY . /ctx` + `find`, same .dockerignore): 106 entries.
The top level holds only package.json, pnpm-lock.yaml, tsconfig.json, tsup.config.ts, src/,
shell/ and scripts/docker-homebrew-smoke-runner.sh. Nothing falls outside the allow list:
no node_modules, no .git, no dotenv files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teardown race left the smoke shell open until the expect timeout**
- **Found during:** Task 2, scenario D
- **Issue:** The runner sent Ctrl-C and then `exit` right away. zsh flushes typeahead on
  SIGINT, so the `e` was dropped, `xit` ran ("zsh: command not found: xit"), and
  `expect eof` waited out `set timeout` (40 s). The smoke still passed, but each hit added
  ~40 s to the run (75 s with the old timeout).
- **Fix:** After Ctrl-C, wait for the empty prompt zsh draws after the interrupt
  (`QQSMOKE[%#] \x1b\[K`: prompt, then clear-to-end-of-line, which never follows a redraw
  that holds `tldr z3`) before sending `exit`. The Ctrl-C, exit, eof tail is kept. Three
  more runs in a row took 3-4 s each.
- **Files modified:** scripts/docker-homebrew-smoke-runner.sh (logged as bug-558 in .wolf/buglog.json)
- **Commit:** 01d1d68

**2. [Rule 3 - Blocking] Scenario D re-measured on a never-built version**
- Changing the version back to 0.11.0 hit layers that were still in the local cache from B/C,
  so it measured nothing. D was rerun with 9.9.10, a version never built here (row above).
  package.json and src/cli/main.ts were restored with `git checkout` after each probe;
  `git status` is clean.

Note on the plan's runner text: the plan said to match the post-Enter redraw with
`QQSMOKE[%#] tldr z3  # `. That pattern was used as written and matched on every run.

## Verification

- `bash -n` and `shellcheck` are clean on both smoke scripts. `actionlint .github/workflows/release.yaml` is clean.
- `pnpm exec vitest run tests/homebrew-smoke-docker.test.ts tests/homebrew-node-pin.test.ts tests/install-marker-formula.test.ts`: 21/21.
- `QQ_SMOKE_DOCKER_CACHE=bogus ./scripts/smoke-homebrew-docker.sh` exits 2 with the usage error. An unknown flag also exits 2.
- `pnpm lint`, `pnpm typecheck` pass. `pnpm test:run`: 72 files, 2017/2017, both plain and under `script -q /dev/null` (pty).
- The key-free local smoke passes end to end on plain `docker build`.

## Confirm after merge (first release runs)

The gha branch cannot run locally (local buildx 0.7.1, no Actions runtime). On the first
release runs after merge, check:
- First run: the `brew-smoke` log prints "building with docker buildx + gha cache" and
  exports the cache (`exporting to GitHub Actions Cache`). A cache error there must only warn
  (`ignore-error=true`).
- Second run (the next release, a version bump): `RUN npm install --ignore-scripts` shows
  CACHED and "image built in Ns" is far below the first run's.
- `test`: the apt cache step restores on the second run, and "Check shell test dependencies"
  prints the zsh, tmux, jq and bash versions.
- Release wall time compared with the ~4 min baseline. `test` no longer contains the 76 s
  smoke or the 24 s apt install, and `brew-smoke` runs alongside it.

## Threat Flags

None. The only new surface is the three GitHub Actions already in the plan's threat model
(T-261118-ubg-03). Both jobs have `contents: read` and no secrets.

## Known Stubs

None.

## Self-Check: PASSED

All five key files exist; commits bc717a8, 01d1d68, d63cebe are in HEAD history (3 = measured rev-list count from plan_head_before).
