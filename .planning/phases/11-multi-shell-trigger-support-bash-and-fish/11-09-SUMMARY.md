---
phase: 11-multi-shell-trigger-support-bash-and-fish
plan: 09
subsystem: infra
tags: [ci, smoke, docker, expect, bash, homebrew, github-actions]

requires:
  - phase: 11-04
    provides: "qq init bash, shell registry, resolveAdapterPath (share/queque first)"
  - phase: 11-07
    provides: "bash adapter handoff/prewarm (QQ_DAEMON_PREWARMED=1 skip)"
  - phase: 11-08
    provides: "qq doctor --shell bash with the bind -X binding probe"
provides:
  - "smoke-distro.exp PASS [SHELL] (zsh default, bash), bash log pty-bash-PASS.log"
  - "runner bash pass: qq init bash (37), bash doctor exit (38), ok binding row (39), expect default bash"
  - "scripts/ci/bash-version-check.sh refuse|accept and the ci.yml bash-versions job in ci-ok needs"
  - "Homebrew formula installs shell/bash/queque.bash into share/queque; caveats say qq init"
affects: [11-10, 11-11, release, homebrew-tap, distro-ci]

actuals:
  tokens: 7100
  tasks: 3
  commits: 3

plan_head_before: 0045aff825ca9c61e8f1317a002fd08f195f8caf
plan_head_after: d6764e2

tech-stack:
  added: []
  patterns:
    - "One expect driver for both shells: shell-neutral prompt class QQSMOKE[%#$] and an Esc line (echo restored-$((6*7))??) valid in zsh and bash"
    - "Version-policy checks run inside the official bash:TAG images with the repo mounted read-only"

key-files:
  created:
    - scripts/ci/bash-version-check.sh
  modified:
    - scripts/smoke-distro.exp
    - scripts/smoke-distro-runner.sh
    - scripts/smoke-distro.sh
    - .github/workflows/ci.yml
    - .github/workflows/homebrew.yml
    - .github/workflows/release.yaml
    - scripts/smoke-homebrew-docker.sh

key-decisions:
  - "The bash doctor in the distro smoke runs with TERM=xterm-256color (as the expect passes do): with TERM unset readline treats the terminal as dumb, turns enable-bracketed-paste off and the binding row warns although ? is bound"
  - "bash-version-check.sh only runs bind -m emacs -X in accept mode: bash 3.2 has no -X and exits 2 with usage"
  - "Caveats Step 2 is `qq init` (detects the shell) with zsh and bash 5+ source follow-ups and a brew install bash line for macOS /bin/bash 3.2"

patterns-established:
  - "Distro smoke artifacts per shell: doctor-bash.json/txt, bashrc.txt, pty-bash-default.log, all cleared by the host before the run (WR-06)"

requirements-completed: [BASH-01]

coverage:
  - id: D1
    description: "Six-distro smoke drives a real installed bash ?? (accept runs, Esc restores) after qq init bash and an ok bash doctor binding row"
    requirement: BASH-01
    verification:
      - kind: e2e
        ref: "CI=true pnpm smoke:distro debian:13"
        status: pass
      - kind: e2e
        ref: "CI=true pnpm smoke:distro alpine:3.24"
        status: pass
    human_judgment: false
  - id: D2
    description: "bash-versions CI job: bash 3.2 and 4.4 refuse with one needs bash 5.0+ line, bash 5.0 binds ? to _qq_question, non-interactive source silent"
    requirement: BASH-01
    verification:
      - kind: integration
        ref: "docker run bash:3.2|4.4 refuse, bash:5.0 accept (scripts/ci/bash-version-check.sh)"
        status: pass
      - kind: other
        ref: "offline run of ci.yml bash-versions run: body per matrix row (PyYAML) + actionlint"
        status: pass
    human_judgment: false
  - id: D3
    description: "Homebrew formula installs the bash adapter into share/queque and caveats say qq init"
    requirement: BASH-01
    verification:
      - kind: other
        ref: "actionlint homebrew.yml release.yaml; formula text identical; caveats rendered with ruby"
        status: pass
      - kind: integration
        ref: "docker build of the smoke-homebrew-docker.sh image (test -f both adapters)"
        status: pass
    human_judgment: true
    rationale: "No tap publish was run (forbidden here); the real brew install of a released formula is only proven by the next release"

duration: 35min
completed: 2026-11-14
status: complete
---

# Phase 11 Plan 09: Distro bash smoke, bash-versions CI and Homebrew bash adapter Summary

**The six-distro PTY smoke now drives a real installed bash `??` (qq init bash, ok doctor binding row, accept runs, Esc restores `restored-42`), a `bash-versions` CI job proves 3.2/4.4 refuse and 5.0 accepts on the official bash images, and the Homebrew formula ships `queque.bash` into `share/queque` with `qq init` caveats.**

## Performance

- **Duration:** about 35 min
- **Started:** 2026-11-14T13:33Z
- **Completed:** 2026-11-14T14:09Z
- **Tasks:** 3
- **Files modified:** 8 (1 created)

## Accomplishments

- `scripts/smoke-distro.exp PASS [SHELL]`: one driver for zsh and bash. Prompt class `QQSMOKE[%#$] `, a not-found anchor that accepts both `command not found: tldr` and `tldr: command not found`, and an Esc line `echo restored-$((6*7))??` that works in both shells, with the send and the redraw match changed together. An unknown shell exits 19.
- `scripts/smoke-distro-runner.sh`: the zsh doctor is pinned to `--shell zsh`. A bash pass after the consent check writes `~/.bashrc` (exports above the source line), runs `qq init bash` (exit 37), then the bash doctor (exit 38 on a non-zero exit, exit 39 unless the report is version 1 with at least 11 checks and an ok `binding` row), then `expect smoke-distro.exp default bash`. On failure `~/.bashrc` is copied to `/out/bashrc.txt`.
- `scripts/smoke-distro.sh`: the WR-06 clear now covers `bashrc.txt`, `doctor-bash.json` and `doctor-bash.txt`. A failure prints the tail of `pty-bash-default.log`, then `doctor-bash.txt` and `bashrc.txt`.
- `scripts/ci/bash-version-check.sh` and the `bash-versions` job: a matrix of 3.2 and 4.4 (refuse) and 5.0 (accept), `fail-fast: false`, gated like `checks`, listed in `ci-ok`'s `needs`.
- Homebrew: both formula blocks install `shell/bash/queque.bash` and stay identical. The caveats say `qq init`, followed by the source line for zsh or for bash 5+, plus a `brew install bash` note for macOS. The Docker Homebrew smoke mirrors the install and runs `test -f` on both adapters.

## Local verification results

| Check | Result |
|---|---|
| `CI=true pnpm smoke:distro debian:13` | PASS (bash 5.2.37; binding row `? is bound to _qq_question in emacs and vi-insert`). Artifacts: `/var/folders/tk/mgym91f555d45tx9fnsg33680000gn/T/qq-smoke-debian-13` (pty-bash-default.log, doctor-bash.json present) |
| `CI=true pnpm smoke:distro alpine:3.24` | PASS (bash 5.3.9; binding ok). Artifacts: `/var/folders/tk/mgym91f555d45tx9fnsg33680000gn/T/qq-smoke-alpine-3.24` |
| `bash:3.2` refuse | PASS: `queque: the ?? trigger needs bash 5.0+ (found 3.2.57(1)-release)` |
| `bash:4.4` refuse | PASS: `... (found 4.4.23(1)-release)` |
| `bash:5.0` accept | PASS: bash 5.0.18(1)-release, `?` bound to `_qq_question` |
| Negative controls | `bash:3.2 accept` and `bash:5.0 refuse` both exit 1 with a named mismatch |
| ci.yml offline | each matrix row of the job's own `run:` body (extracted with PyYAML) exits 0; `ci-ok` needs `bash-versions` |
| shellcheck | clean on smoke-distro-runner.sh (`-s sh`), smoke-distro.sh, bash-version-check.sh (`-s sh`), smoke-homebrew-docker.sh |
| actionlint | clean on ci.yml, homebrew.yml, release.yaml |
| Homebrew image build | the image half of smoke-homebrew-docker.sh built (no API key, no live request); `share/queque` holds `queque.bash` and `queque.zsh` |

Bash versions seen per image: debian:13 is 5.2.37, alpine:3.24 is 5.3.9, and the bash:3.2, bash:4.4 and bash:5.0 images are 3.2.57, 4.4.23 and 5.0.18.

## Task Commits

1. **Task 1: six-distro smoke drives a real bash `??`** - `53880fa` (test)
2. **Task 2: CI proves the bash version policy** - `e8576c1` (ci)
3. **Task 3: Homebrew installs the bash adapter** - `d6764e2` (build)

## Files Created/Modified

- `scripts/smoke-distro.exp` - takes PASS [SHELL] for zsh and bash, with prompts, not-found anchors and the Esc line that work in both
- `scripts/smoke-distro-runner.sh` - zsh doctor pinned to zsh; the bash pass (init, doctor, binding row, expect); exit codes 37-39; bashrc.txt saved on failure
- `scripts/smoke-distro.sh` - clears the bash artifacts (WR-06) and prints them on failure
- `scripts/ci/bash-version-check.sh` (new) - refuse/accept checks run inside one `bash:<tag>` image
- `.github/workflows/ci.yml` - new `bash-versions` job, added to `ci-ok` needs
- `.github/workflows/homebrew.yml`, `.github/workflows/release.yaml` - install the bash adapter; `qq init` caveats
- `scripts/smoke-homebrew-docker.sh` - mirrors the bash install, with `test -f` on both adapters

## Decisions Made

See key-decisions in the frontmatter. The TERM decision is the only one that changes runtime behaviour, and it changes only the smoke. The doctor's warning without TERM is correct: in a terminal-less environment readline really does turn bracketed paste off.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The bash doctor's binding row warned in the container: bracketed paste was off without TERM**
- **Found during:** Task 1 (first debian:13 run exited 39)
- **Issue:** `su -c` gives the doctor no TERM. The probe's `bash -ic` then treats the terminal as dumb and readline reports `enable-bracketed-paste off`, so `binding` is `warn` even though `?` is bound. A probe in debian:13 showed `off` with TERM unset or `dumb` and `on` with `xterm-256color`.
- **Fix:** both bash doctor calls in the runner run with `TERM=xterm-256color`, the same TERM the expect passes use. The strict assertion (an ok binding row) stays.
- **Files modified:** scripts/smoke-distro-runner.sh
- **Verification:** debian:13 and alpine:3.24 PASS; doctor-bash.json binding status `ok`
- **Committed in:** 53880fa

**2. [Rule 1 - Bug] bash-version-check.sh exited 2 on bash 3.2 in refuse mode**
- **Found during:** Task 2 (first container run)
- **Issue:** the interactive probe ran `bind -m emacs -X` in every mode. bash 3.2 has no `-X`, so the shell exited 2.
- **Fix:** the bindings are listed only in accept mode.
- **Files modified:** scripts/ci/bash-version-check.sh
- **Verification:** all three containers pass, and both negative controls fail as they should
- **Committed in:** e8576c1 (fixed before the commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1)
**Impact on plan:** both were needed for the legs to pass for the right reason. No scope creep, and no file outside files_modified was touched.

## Issues Encountered

None beyond the deviations. The full `scripts/smoke-homebrew-docker.sh` run makes a live request and needs a real API key, so it was not run. Only its image build was, which covers the `test -f` lines.

## Known Stubs

None.

## User Setup Required

None. Docker Desktop was already running for the local legs.

## Next Phase Readiness

- Plan 11-10 runs in parallel and its files do not overlap with these. The README/docs/doctor copy still says `qq init zsh && source ~/.zshrc` in places (README.md, docs/INSTALL.md, the doctor hint). That is outside this plan; the docs plan can align it.
- CI will run all six distro legs with the bash pass, plus the three bash-versions legs, on the next push.

## Wolf entries

For plan 11-11 to apply (this worktree commits no `.wolf/` file).

**anatomy.md**
- `## scripts/ci/`: `bash-version-check.sh` - Phase 11 D-12 refuse|accept check inside one official `bash:<tag>` image (repo at /w, read-only): non-interactive source silent; refuse = one `needs bash 5.0+` line and no `_qq_question`; accept = function defined and `?` in `bind -m emacs -X`. POSIX sh (busybox). ~1.1k tok
- Update `scripts/smoke-distro.exp`: PASS [SHELL] (zsh default, bash); prompt class `QQSMOKE[%#$]`; bash log `pty-bash-PASS.log`; exit 19 also covers an unknown shell
- Update `scripts/smoke-distro-runner.sh`: zsh doctor `--shell zsh`; bash pass (qq init bash 37, bash doctor 38, ok binding row 39, `expect ... default bash`); artifacts doctor-bash.json/txt, bashrc.txt, pty-bash-default.log

**cerebrum.md Key Learnings**
- [2026-11-14] readline turns `enable-bracketed-paste` off when TERM is unset or `dumb` (bash 5.2, debian:13), so `qq doctor --shell bash` run via `su -c` or CI without TERM shows a ⚠ binding row although `?` is bound. Smokes run the bash doctor with `TERM=xterm-256color`.
- [2026-11-14] The distro smoke runs one expect driver for both shells: `expect smoke-distro.exp PASS [SHELL]`, prompt `QQSMOKE[%#$]` (bash PS1 `QQSMOKE\$ `), Esc line `echo restored-$((6*7))??` (works in zsh and bash), and bash prints `bash: tldr: command not found`. Cached timings: debian:13 about 60 s, alpine:3.24 about 45 s for zsh plus bash.
- [2026-11-14] The official `bash:<tag>` images are alpine and busybox, with bash at /usr/local/bin/bash. bash 3.2 there has no `bind -X` (exit 2 with usage), so any `bind -X` probe must be gated on version.

**buglog.json**
- `smoke-distro-runner exit 39: bash doctor binding row warn in the container` / file scripts/smoke-distro-runner.sh / root cause: `su -c` leaves TERM unset and readline disables bracketed paste for a dumb terminal / fix: run the bash doctor with TERM=xterm-256color / tags [smoke, bash, doctor, readline, bracketed-paste, TERM]
- `bash-version-check.sh refuse exited 2 on bash:3.2` / file scripts/ci/bash-version-check.sh / root cause: `bind -m emacs -X` does not exist in bash 3.2 / fix: list bindings only in accept mode / tags [ci, bash, version, bind]

**memory.md**
- `| 14:09 | 11-09: bash distro smoke pass, bash-versions CI job, Homebrew bash adapter | scripts/smoke-distro*, scripts/ci/bash-version-check.sh, ci.yml, homebrew.yml, release.yaml, smoke-homebrew-docker.sh | debian:13 + alpine:3.24 PASS, bash 3.2/4.4 refuse, 5.0 accept | ~7k |`

## Self-Check: PASSED

- FOUND: scripts/ci/bash-version-check.sh, scripts/smoke-distro.exp, scripts/smoke-distro-runner.sh, scripts/smoke-distro.sh
- FOUND commits: 53880fa, e8576c1, d6764e2 (all ancestors of HEAD, all subjects carry `(11-09)`)
- Every acceptance grep for Tasks 1-3 was re-run and passes (see the tables above)
