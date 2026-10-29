---
phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
plan: 01
subsystem: infra
tags: [docker, expect, zsh, alpine, debian, busybox, lsof, smoke, ci]

requires:
  - phase: 09.1
    provides: "claude -p stream-json contract and tests/fixtures/fake-claude-stream.mjs (the fake model)"
provides:
  - "scripts/ci/install-distro-deps.sh [--no-pnpm]: git, zsh, jq, expect, procps, Node 24 on alpine/ubuntu/debian/fedora/arch"
  - "scripts/ci/test-in-distro.sh IMAGE [vitest args] (git archive HEAD into docker run), npm script test:distro"
  - "scripts/smoke-distro.sh IMAGE [--out DIR] + smoke-distro-runner.sh + smoke-distro.exp (passes default, c-locale), npm script smoke:distro"
  - "parseLsofPidList(output, selfPid); listenerPids and replaceStaleListener exported; debug line `lsof output ignored` {lines}"
affects: [10-05 distro.yml, 10-07 auto-revert, 10-11 consent pass, 10-03 doctor]

actuals:
  tokens: 9049
  tasks: 3
  commits: 5
plan_head_before: a7bdf0bdb7a48125c349d0d7fb60fa7a2f2e04ca
plan_head_after: 005a507c0a0cef6aa2a5df4deb14bf673965d374

tech-stack:
  added: []
  patterns:
    - "Distro smoke = pnpm pack tarball + npm install -g in a fresh image, only `claude` faked by a shim"
    - "Expect steps anchored on the zsh prompt redraw; buffer state proven by executing it"
    - "D-16: no Docker -> warn + exit 0 locally, exit 1 when CI is set"

key-files:
  created:
    - scripts/ci/install-distro-deps.sh
    - scripts/ci/test-in-distro.sh
    - scripts/smoke-distro.sh
    - scripts/smoke-distro-runner.sh
    - scripts/smoke-distro.exp
    - tests/lsof-busybox.test.ts
  modified:
    - src/daemon/bootstrap.ts
    - package.json

key-decisions:
  - "Smoke exports (QQ_DEBUG_LOG_FILE, QQ_TELEMETRY=0) are written to ~/.zshrc BEFORE `qq init zsh` appends the source line, because the widget prewarms the daemon while ~/.zshrc loads and the daemon keeps that env"
  - "The idle-prompt anchor allows trailing CSI sequences and ESC=/ESC> after `QQSMOKE% `; zsh emits ESC[K ESC[?2004h, and Debian's /etc/zsh/zshrc adds ESC[?1h ESC="
  - "The RED commit extracted the existing parse unchanged into an exported parseLsofPidList instead of adding throw-on-call stubs, so RED failed on the planned assertions"

patterns-established:
  - "scripts/ci/*.sh are POSIX sh (shellcheck -s sh) when they run inside images; host entries are bash"
  - "Distinct exit codes per smoke assertion: expect 10-16, 19; runner 30-33"

requirements-completed: [P10-SMOKE, P10-FIX]

coverage:
  - id: D1
    description: "Accept round trip: `list files??` in a real zsh PTY inside alpine:3.24 and debian:13 from a pnpm pack install, Enter on row 1 fills the buffer and running it prints `command not found: tldr`"
    requirement: P10-SMOKE
    verification:
      - kind: e2e
        ref: "pnpm smoke:distro alpine:3.24 && pnpm smoke:distro debian:13"
        status: pass
    human_judgment: false
  - id: D2
    description: "Esc on `print -r -- restored-$((6*7))??` restores the line (restored-42) in pass default (XDG_RUNTIME_DIR unset) and pass c-locale (LANG=C LC_ALL=C), on musl and glibc"
    requirement: P10-SMOKE
    verification:
      - kind: e2e
        ref: "pnpm smoke:distro alpine:3.24 && pnpm smoke:distro debian:13"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-16: without Docker, smoke-distro.sh and test-in-distro.sh warn and exit 0 locally and exit 1 with CI set"
    verification:
      - kind: other
        ref: "DOCKER_HOST=unix:///tmp/qq-no-docker.sock CI= scripts/smoke-distro.sh alpine:3.24; ! DOCKER_HOST=unix:///tmp/qq-no-docker.sock CI=true scripts/smoke-distro.sh alpine:3.24"
        status: pass
      - kind: other
        ref: "DOCKER_HOST=unix:///tmp/qq-no-docker.sock CI= / CI=true scripts/ci/test-in-distro.sh alpine:3.24 (rc 0 / rc 1)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Defect 1: busybox-format lsof output yields [] and logs `lsof output ignored`; a sacrificial child named by the fake lsof survives replaceStaleListener"
    requirement: P10-FIX
    verification:
      - kind: unit
        ref: "tests/lsof-busybox.test.ts#leaves the process named by busybox lsof lines alive"
        status: pass
      - kind: integration
        ref: "pnpm test:distro alpine:3.24 tests/lsof-busybox.test.ts tests/daemon-bootstrap.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "install-distro-deps.sh on fedora, arch and ubuntu (written to the research matrix, not run in this plan)"
    verification: []
    human_judgment: true
    rationale: "Only alpine:3.24 and debian:13 were exercised locally; fedora/arch/ubuntu legs are first run by plan 05's distro.yml"

duration: 24min
completed: 2026-10-29
status: complete
---

# Phase 10 Plan 01: Distro Smoke Harness and Busybox lsof Fix Summary

**A real `??` round trip (accept and Esc, unset XDG and C locale) through zsh, the widget, the daemon socket and Ink, installed from `pnpm pack` into fresh alpine:3.24 and debian:13 containers with only `claude` faked. Also a strict `lsof -t` parse, so busybox `lsof` can no longer make replaceStaleListener kill every process in an Alpine container.**

## Performance

- **Duration:** about 24 min
- **Started:** 2026-10-29T19:37Z
- **Completed:** 2026-10-29T20:01Z
- **Tasks:** 3 of 3
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments
- `pnpm smoke:distro IMAGE` packs the checkout, installs the tarball with `npm install -g` in a fresh image as a non-root user, and drives a real zsh PTY with expect. The debug log shows the real path: `ensureDaemon`, then `/tmp/qq-1000.sock`, then `fetch-candidates`, then `cli spawned` (the fake `claude`).
- Passes `default` (XDG_RUNTIME_DIR unset) and `c-locale` (LANG=C LC_ALL=C) each prove accept (`command not found: tldr`) and Esc (`restored-42`), on musl with apk Node and on glibc with the nodejs.org tarball (`node-v24.14.1-linux-x64.tar.xz: OK` against SHASUMS256.txt).
- Defect 1 fixed: `parseLsofPidList` rejects any non-pid line. In RED, the old parse killed the sacrificial child. After the fix the bootstrap tests pass inside alpine:3.24 against the real busybox `lsof` (26 tests, no `Terminated`).
- `pnpm test:distro IMAGE [files]` runs vitest inside any supported image from `git archive HEAD`. Plan 05 calls it from distro.yml.

## Smoke exit codes

| Code | Where | Meaning |
|------|-------|---------|
| 10 | smoke-distro.exp | first zsh prompt never appeared |
| 11 | smoke-distro.exp | no `tldr z3` candidate row after `??` |
| 12 | smoke-distro.exp | no prompt redraw with the accepted command |
| 13 | smoke-distro.exp | accepted buffer did not run (`command not found: tldr` missing) |
| 14 | smoke-distro.exp | no prompt after the accepted command, or no redraw with the restored line after Esc |
| 15 | smoke-distro.exp | restored buffer did not run (`restored-42` missing) |
| 16 | smoke-distro.exp | `queque:` / `QueQue:` error text |
| 19 | smoke-distro.exp | unknown pass name |
| 30 | smoke-distro-runner.sh | install-distro-deps.sh failed (incl. unsupported distro) |
| 31 | smoke-distro-runner.sh | `npm install -g` of the tarball failed or `qq` not on PATH |
| 32 | smoke-distro-runner.sh | creating the smoke user or making /out writable failed |
| 33 | smoke-distro-runner.sh | `qq init zsh` failed or ~/.zshrc does not source queque.zsh |
| 2 / 3 / 64 | install-distro-deps.sh | unsupported distro or arch / install or checksum failure / bad argument |

Codes 34-35 (doctor) belong to plan 05 and 36 (consent) to plan 11.

## Docker run times (this machine, Docker Desktop VM 81% full, 10.7 GB free)

| Run | Result | Time |
|-----|--------|------|
| `smoke:distro alpine:3.24` (first, image cached) | exit 10 (prompt anchor bug) | 72 s |
| `smoke:distro alpine:3.24` tracer, default pass | PASS | 34 s |
| `smoke:distro alpine:3.24` tracer gate re-run | PASS | ~35 s |
| `test:distro alpine:3.24` lsof-busybox + daemon-bootstrap | 26 passed | 40 s |
| `smoke:distro alpine:3.24` default + c-locale | PASS | 30 s |
| `smoke:distro debian:13` (first, includes image pull) | exit 14 (Debian ESC= prompt) | 89 s |
| `smoke:distro debian:13` default + c-locale | PASS | 43 s |
| Task 3 verify, alpine then debian | PASS, PASS | ~75 s |
| `smoke:distro busybox:1.37` (failure-artifact check) | exit 30, df.txt written | ~25 s |

## Task Commits

1. **Task 1: tracer, one accepted `??` in alpine:3.24** - `77c3fed` (feat)
2. **Task 2: busybox lsof (Defect 1)**: RED `1f8c2cb` (test), GREEN `dac09ed` (fix), REFACTOR `1016524` (refactor)
3. **Task 3: Esc, C locale, artifacts, D-16** - `005a507` (feat)

## Files Created/Modified
- `scripts/ci/install-distro-deps.sh`: POSIX installer per `/etc/os-release` ID, with retry (3 attempts, 2 s/5 s), the Node tarball checked against SHASUMS256.txt, and pnpm from `packageManager`
- `scripts/ci/test-in-distro.sh`: vitest in a distro image from `git archive HEAD`; vitest args go in as positional parameters; D-16 skip
- `scripts/smoke-distro.sh`: host entry with usage, `--out`/`QQ_SMOKE_OUT`, D-16, `pnpm build`, `pnpm pack`, `docker run`, and PASS/FAIL with log tails
- `scripts/smoke-distro-runner.sh`: in-container deps, tarball install, `claude` shim, user `qq`, `qq init zsh`, both passes, artifacts
- `scripts/smoke-distro.exp`: PTY driver with prompt-anchored accept and Esc steps
- `src/daemon/bootstrap.ts`: `parseLsofPidList`; `listenerPids` and `replaceStaleListener` exported; signal backstop kept
- `tests/lsof-busybox.test.ts`: parse cases plus the sacrificial-child test with a fake busybox `lsof` on PATH
- `package.json`: `smoke:distro`, `test:distro`

## TDD Gate Compliance

- RED `1f8c2cb` test(10-01): target `replaceStaleListener with busybox lsof > leaves the process named by busybox lsof lines alive`, run with `--reporter=tap-flat -t`. `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` / `target_test_failed`. Semantic assessment: the target ran and failed on its planned assertion (`expected false to be true`, because the sacrificial child was signalled through the old parse). The busybox parse cases also failed on assertions (`expected 3 to be +0`). There were no load, syntax or fixture faults.
- GREEN `dac09ed` uses type `fix(10-01)`, not `feat(10-01)`, because it is a bug fix and the changelog should say so. A gate that only looks for `^feat\(` will not find it. The commit is the GREEN step.
- REFACTOR `1016524`: JSDoc wording only, so the string `lsof output ignored` appears exactly once (acceptance criterion).

## Decisions Made
- See key-decisions in the frontmatter: exports go above the source line, the prompt anchor tolerates control sequences, and RED used a behaviour-preserving extraction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's idle-prompt regex `QQSMOKE[%#] $` never matched**
- **Found during:** Task 1, first run (exit 10)
- **Issue:** zsh prints `QQSMOKE% ` and then `ESC[K ESC[?2004h`, so `$` never directly follows the space. On debian:13 the prompt also ends in `ESC[?1h ESC=` (keypad transmit mode from /etc/zsh/zshrc). That made Task 3's first Debian run fail with exit 14.
- **Fix:** `set prompt_idle {QQSMOKE[%#] (?:\x1b\[[0-9;?]*[A-Za-z]|\x1b[=>])*$}` is used for the first prompt, the prompt before the Esc step and the final prompt. The accept and Esc redraw anchors are unchanged from the plan.
- **Files modified:** scripts/smoke-distro.exp
- **Commits:** 77c3fed, 005a507

**2. [Rule 1 - Bug] Smoke exports must sit above the QueQue source line**
- **Found during:** Task 1
- **Issue:** The plan said to append `QQ_DEBUG_LOG_FILE` and `QQ_TELEMETRY=0` after `qq init zsh`. But the widget prewarms the daemon while ~/.zshrc loads, so exports below the source line would never reach the daemon (cerebrum 2026-10-17).
- **Fix:** The runner writes both exports to ~/.zshrc first, then runs `qq init zsh` (which appends the source line), checks for `queque.zsh`, and only then appends `PS1`.
- **Files modified:** scripts/smoke-distro-runner.sh
- **Commit:** 77c3fed

**3. [Rule 2 - Missing critical] Retry on the tarball's `npm install -g`**
- **Found during:** Task 1
- **Issue:** That install pulls the runtime dependencies from the npm registry. Research Pitfall 8 recorded registry/CDN flakes inside containers.
- **Fix:** 3 attempts 5 s apart, then exit 31.
- **Commit:** 77c3fed

**4. [Rule 2 - Missing critical] Unknown arguments to install-distro-deps.sh exit 64**
- An unknown flag was silently undefined in the plan. It now exits with its own code (64) instead of reusing 2 (unsupported distro) or 3 (install failure). Commit 77c3fed.

**5. [Process] RED commit shape and GREEN commit type**
- RED extracted the current parse unchanged into the exported `parseLsofPidList` (plus the two exports) instead of adding throw-on-call stubs, so typecheck passed and RED failed on assertions rather than on a stub throw.
- GREEN is typed `fix`. See TDD Gate Compliance.

---

**Total deviations:** 5 (2 bugs, 2 missing critical, 1 process). **Impact:** All of them were needed for a passing smoke or a correct changelog. No scope creep. pnpm-lock.yaml is untouched.

## Issues Encountered
- In the full `pnpm test:run`, `tests/zsh-widget.test.ts > handoff timing > median of 5 handoffs ... below the 25 ms guard` failed under load (medians 30.65/46.87/63.01 ms, load average about 5). It passed when the file was re-run alone. This is a known load-flaky timing test (cerebrum, bug-206), and this plan does not touch that file. Otherwise 43 of 44 files passed. `pnpm typecheck` passed, and `biome check src tests scripts shell docs package.json` is clean (`pnpm lint` processes no files inside a `.claude/worktrees` checkout).
- Observation: in the accept step, Enter can arrive while row 2 is still streaming. The client then accepts row 1 and aborts the fetch, which is real product behaviour (debug log: `fetch aborted` after `first candidate received`). The assertion still proves the buffer was filled.
- The failure-artifact check pulled `busybox:1.37` (about 4 MB). It was not deleted, following the rule against deleting images without asking.

## User Setup Required

None.

## Next Phase Readiness
- Plan 05 can call `scripts/ci/test-in-distro.sh` and `scripts/smoke-distro.sh` from distro.yml, add the `qq doctor --json` step (exit codes 34-35) to the runner after `qq init zsh`, and upload `$QQ_SMOKE_OUT`.
- Plan 11 adds a `consent` pass to smoke-distro.exp (the pass dispatch is an if/elseif chain; unknown names exit 19).
- The fedora, arch and ubuntu branches of install-distro-deps.sh were not run locally (D5).

## OpenWolf entries (for plan 11 to apply)

**anatomy.md**
- `## scripts/ci/`: `install-distro-deps.sh`: POSIX sh, run as root. Installs git, zsh, jq, expect, procps and Node 24 per /etc/os-release ID (apk on alpine; nodejs.org tarball checked against SHASUMS256.txt on ubuntu/debian; dnf nodejs24 on fedora; pacman nodejs-lts-krypton on arch). Also pnpm from packageManager unless --no-pnpm. Exits 2 unsupported, 3 install failure, 64 usage. (~1000 tok)
- `## scripts/ci/`: `test-in-distro.sh IMAGE [vitest args]`: pipes `git archive HEAD` into `docker run`, then install-distro-deps, `pnpm install --frozen-lockfile`, and `pnpm test:run` or `vitest run ARGS`. D-16: without Docker, warns and exits 0 locally, exits 1 with CI set. (~500 tok)
- `## scripts/`: `smoke-distro.sh IMAGE [--out DIR]`: host entry with D-16 check, `pnpm build`, `pnpm pack`, and `docker run` of smoke-distro-runner.sh. Mounts the tarball, the fake-claude fixture, scripts/ (ro) and the out dir; prints `smoke-distro: PASS|FAIL IMAGE`. (~850 tok)
- `## scripts/`: `smoke-distro-runner.sh`: in-container POSIX sh. Installs deps, `npm install -g` of the tarball, the `claude` shim, user qq, `qq init zsh`, then expect passes default and c-locale. Artifacts: image.txt, pty-*.log, qq-debug.log, and df.txt/zshrc.txt on failure. Exits 30-33. (~700 tok)
- `## scripts/`: `smoke-distro.exp PASS`: expect PTY driver. Accept (`command not found: tldr`) and Esc (`restored-42`) are anchored on the `QQSMOKE%` prompt redraw. Exits 10-16, 19. (~900 tok)
- `## tests/`: `lsof-busybox.test.ts`: Defect 1 regression. parseLsofPidList cases, plus a fake busybox `lsof` on PATH naming a sacrificial `sleep 30` child that must survive replaceStaleListener. (~850 tok)
- `## src/daemon/`: update the `bootstrap.ts` line: exports `parseLsofPidList` (strict, every line must be `^\d+$`, else [] and debug `lsof output ignored`), `listenerPids` and `replaceStaleListener`.

**buglog.json**
```json
{
  "id": "bug-NNN",
  "timestamp": "2026-10-29T19:50:00Z",
  "error_message": "busybox lsof -t PATH lists every open file; replaceStaleListener signalled every pid",
  "file": "src/daemon/bootstrap.ts",
  "root_cause": "On Alpine, lsof is busybox: it ignores `-t <path>` and prints `PID\\t/bin/busybox\\tFD\\tTARGET` for every open file of every process. listenerPids split on whitespace and parseInt'd every token, so replaceStaleListener SIGTERMed and SIGKILLed every pid, PID 1 included (daemon-bootstrap.test.ts printed Terminated and killed the container).",
  "fix": "parseLsofPidList accepts the output only when every non-empty line is ^\\d+$; otherwise it returns [] and logs `lsof output ignored` {lines}. The IPC shutdown-first order and the SIGTERM/SIGKILL backstop are unchanged. Regression: tests/lsof-busybox.test.ts (sacrificial child) and pnpm test:distro alpine:3.24.",
  "tags": ["lsof", "busybox", "alpine", "daemon", "signal", "phase-10", "defect-1"],
  "related_bugs": [],
  "occurrences": 1,
  "last_seen": "2026-10-29T19:50:00Z"
}
```
```json
{
  "id": "bug-NNN+1",
  "timestamp": "2026-10-29T19:45:00Z",
  "error_message": "smoke-distro.exp: timed out waiting for the first zsh prompt (exit 10); on debian:13 exit 14 waiting for the prompt",
  "file": "scripts/smoke-distro.exp",
  "root_cause": "zsh ends the prompt with ESC[K ESC[?2004h (and on Debian ESC[?1h ESC= from /etc/zsh/zshrc smkx), so `QQSMOKE[%#] $` never matches",
  "fix": "prompt_idle regex `QQSMOKE[%#] (?:\\x1b\\[[0-9;?]*[A-Za-z]|\\x1b[=>])*$`",
  "tags": ["expect", "zsh", "prompt", "smoke", "debian", "phase-10"],
  "related_bugs": [],
  "occurrences": 2,
  "last_seen": "2026-10-29T19:56:00Z"
}
```

**cerebrum.md (Key Learnings)**
- [2026-10-29] Expect against a zsh prompt: zsh ends the prompt with `ESC[K` and bracketed paste `ESC[?2004h`, and Debian's /etc/zsh/zshrc also emits keypad transmit `ESC[?1h ESC=`. An idle-prompt regex must allow those after the text: `QQSMOKE[%#] (?:\x1b\[[0-9;?]*[A-Za-z]|\x1b[=>])*$`.
- [2026-10-29] Tcl `switch` treats a `default` pattern as the catch-all, so a smoke pass literally named `default` needs an if/elseif chain.
- [2026-10-29] In the distro smoke, write the exports (QQ_DEBUG_LOG_FILE, QQ_TELEMETRY) to ~/.zshrc before `qq init zsh` appends the source line. The widget prewarms the daemon during ~/.zshrc load.
- [2026-10-29] Local distro smoke timings with images cached: alpine:3.24 two passes ~30 s, debian:13 ~43 s (89 s with the image pull), `test:distro alpine:3.24` on two test files ~40 s.
- [2026-10-29] The worktree Bash guard also refuses commands that pass a computed variable where an option could stand (`sed -n ... $f`) and quoted multi-word `-t "..."` arguments inside `;` chains. Run those as plain single commands. The TDD RED record must live inside the project (node_modules/.cache/gsd/ works); the classifier is `node ~/.claude/gsd-core/bin/gsd-tools.cjs check tdd-red-evidence`.

## Self-Check: PASSED
