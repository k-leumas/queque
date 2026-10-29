---
phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
plan: 07
subsystem: infra
tags: [ci, github-actions, auto-revert, gh, git, bash, smoke]

requires:
  - phase: 10-05
    provides: "ci.yml jobs changes/checks/distro/ci-ok, smoke check names `distro / smoke (IMAGE)`, artifacts smoke-IMAGE_SLUG with doctor.json, pty-*.log, qq-debug.log, df.txt"
  - phase: 10-01
    provides: "smoke artifact file names (image.txt holds the image name)"
provides:
  - "scripts/ci/auto-revert.sh: env REPO, BRANCH, HEAD_SHA, BEFORE_SHA, RUN_ID, RUN_URL, ARTIFACTS_DIR, REMOTE, WORKFLOW_FILE, MAX_ANCESTORS (GH_TOKEN read by gh); head branch auto-revert/ + branch with / replaced by -"
  - "tests/auto-revert.test.ts (13 tests) and tests/fixtures/auto-revert/gh (gh test double)"
  - ".github/workflows/ci.yml job auto-revert (push only, distro failed, not auto-revert/*)"
affects: [10-11 openwolf entries, 10-12 live revert drill and repo setting D-21]

actuals:
  tokens: 9300
  tasks: 2
  commits: 3
plan_head_before: 4b290325567099b8edf04dc62c8c277b8abfaff3
plan_head_after: 8c82014d41339a085cf9387342682cc7948d38de

tech-stack:
  added: []
  patterns:
    - "CI scripts take inputs only from env, validate them (check-ref-format, SHA/number/name regexes) and quote every expansion"
    - "API output is filtered with local `jq --arg`, never by building a jq program from data"
    - "External CLI test double on PATH that logs argv as JSON and serves fixture files keyed by API path"

key-files:
  created:
    - scripts/ci/auto-revert.sh
    - tests/auto-revert.test.ts
    - tests/fixtures/auto-revert/gh
  modified:
    - .github/workflows/ci.yml

key-decisions:
  - "Files under .github/workflows stay at HEAD in the revert commit: GITHUB_TOKEN cannot push workflow-file changes, so a full restore would fail the push whenever the reverted range touched a workflow. The PR body names this."
  - "A `timed_out` smoke job counts as a smoke failure, like `failure`"
  - "The first-parent ancestor lookup also filters to event=push, the same green definition as the branch lookup"
  - "Smoke artifacts download to runner.temp/smoke-artifacts, outside the work tree, so the tree restore and commit never see them"
  - "actions/download-artifact@v8 (latest release v8.0.2, checked with gh api)"
  - "Per-file excerpt budget = 48000 / (failing distros x 4) bytes, clamped to 1500-8000, then a hard 60000-byte cap that closes open fences and <details>"

patterns-established:
  - "auto-revert body: header, failing jobs, run URL, chosen base and the rule that chose it, D-21 approval note, then per distro <details> blocks with four-backtick fences"

requirements-completed: [P10-REVERT]

coverage:
  - id: D1
    description: "On a failed smoke leg, auto-revert.sh restores the last green tree on auto-revert/BRANCH and opens one PR whose body has the failing distros, run URL, doctor.json and log tails"
    requirement: P10-REVERT
    verification:
      - kind: integration
        ref: "tests/auto-revert.test.ts#restores the last green tree on auto-revert/feat-x and opens one PR with diagnostics"
        status: pass
      - kind: integration
        ref: "pnpm test:distro debian:13 tests/auto-revert.test.ts (bash 5, GNU sed/coreutils)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Last-green lookup order: branch run with smoke passed (skipped smoke passed over), first-parent ancestor by head_sha, before SHA, merge base; warning on main with none"
    requirement: P10-REVERT
    verification:
      - kind: integration
        ref: "tests/auto-revert.test.ts#passes over a newer successful run whose smoke jobs were skipped"
        status: pass
      - kind: integration
        ref: "tests/auto-revert.test.ts#falls back to the nearest first-parent ancestor with a green run on any branch"
        status: pass
      - kind: integration
        ref: "tests/auto-revert.test.ts#falls back to the push before SHA when no green run exists"
        status: pass
      - kind: integration
        ref: "tests/auto-revert.test.ts#falls back to the merge base with main on a non-main branch"
        status: pass
      - kind: integration
        ref: "tests/auto-revert.test.ts#warns and reverts nothing on main with no green base"
        status: pass
    human_judgment: false
  - id: D3
    description: "Guards: only smoke failures revert, no revert-of-revert, invalid branch rejected, shell syntax in a branch name never runs, one PR updated on repeat failures"
    requirement: P10-REVERT
    verification:
      - kind: integration
        ref: "tests/auto-revert.test.ts#opens no PR when only test-distro failed"
        status: pass
      - kind: integration
        ref: "tests/auto-revert.test.ts#never reverts a push to an auto-revert branch (no revert-of-revert)"
        status: pass
      - kind: integration
        ref: "tests/auto-revert.test.ts#never executes shell syntax in a branch name"
        status: pass
      - kind: integration
        ref: "tests/auto-revert.test.ts#edits and comments on the open PR instead of opening another"
        status: pass
    human_judgment: false
  - id: D4
    description: "ci.yml auto-revert job: push only, distro failed, not auto-revert/*, job-level contents/pull-requests write and actions read, GH_TOKEN from github.token"
    requirement: P10-REVERT
    verification:
      - kind: other
        ref: "actionlint .github/workflows/ci.yml .github/workflows/distro.yml"
        status: pass
    human_judgment: true
    rationale: "The live drill (a deliberately broken push on a scratch branch, with 'Allow GitHub Actions to create and approve pull requests' enabled) is plan 12; it cannot run locally."

duration: 25min
completed: 2026-10-29
status: complete
---

# Phase 10 Plan 07: Smoke Auto-Revert PR Summary

**A failed smoke leg on a push now gets a revert PR: `scripts/ci/auto-revert.sh` finds the newest base whose smoke actually passed, restores that tree on `auto-revert/<branch>`, and opens or updates one PR. The PR body carries the failing distros, the run URL, and each distro's `doctor.json` and log tails. It is deterministic bash plus `gh` and runs with the workflow token.**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-10-29T21:08:54Z
- **Tasks:** 2
- **Files:** 3 created, 1 modified

## Accomplishments

- Last-green lookup in the planned order. A green run only counts if at least one smoke job in it succeeded, so a doc-only "green" run with skipped smoke is passed over (Pitfall 3). Every candidate must also be an ancestor of HEAD.
- The revert is a tree restore (`git restore --source="$GOOD" --staged --worktree -- .`). It works across merge commits and removes files added after the green commit. The result is pushed with `--force` to `auto-revert/<branch with / as ->`, and the source branch is never touched.
- One PR per source branch. If a PR is open, the script edits its title and body and comments with the new SHA. Otherwise it creates one with `--base BRANCH --head auto-revert/...`.
- PR body: ANSI CSI/OSC/charset sequences and all control characters except newline and tab are stripped, and runs of four or more backticks are shortened so log text cannot close a fence. Each excerpt is the last 80 lines within a byte budget, and the whole body is capped at 60000 bytes with fences and `<details>` closed.
- `auto-revert` job in ci.yml, after `ci-ok` and not in its needs. The token is least-privilege, and inputs reach the script only through `env:`.

## Task Commits

1. **Task 1 RED: failing tests** - `1e9f33e` (test)
2. **Task 1 GREEN: auto-revert.sh** - `027b59b` (feat)
3. **Task 2: auto-revert job in ci.yml** - `8c82014` (feat)

No REFACTOR commit was needed.

## TDD Gate Compliance

- **RED:** `tests/auto-revert.test.ts > scripts/ci/auto-revert.sh > restores the last green tree on auto-revert/feat-x and opens one PR with diagnostics`, run with `--reporter=tap-flat`. `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`). Semantic assessment: the fixture (bare remote, merge commit, stub gh) was built without error, and the target failed only on its first exit-status assertion (`expected 127 to be +0`) because `scripts/ci/auto-revert.sh` did not exist yet. That is the planned RED, not a setup or load fault.
- **GREEN:** all 13 tests pass on macOS (bash 3.2, BSD sed) and in `debian:13` through `pnpm test:distro debian:13 tests/auto-revert.test.ts` (bash 5, GNU sed and coreutils).

## Files Created/Modified

- `scripts/ci/auto-revert.sh` (100755): last-green lookup, tree restore, push, PR create or edit, body builder.
- `tests/auto-revert.test.ts`: 13 tests against temp git repos (bare remote plus work clone) with the gh double first on PATH. The suite skips where `bash` is missing (Alpine test-distro leg); the script itself runs only on ubuntu-24.04 runners.
- `tests/fixtures/auto-revert/gh`: the gh test double. It logs argv as one JSON array per line and serves `jobs-ID.json`, `sha-runs-SHA.json`, `branch-runs.json` and `pr-list.txt`, applying `--jq` through the real jq.
- `.github/workflows/ci.yml`: the `auto-revert` job, at the marked spot after `ci-ok`.

## Decisions Made

See `key-decisions` in the frontmatter. The workflow-files rule is the one that changes behaviour; the deviations below explain it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Files under `.github/workflows` stay at HEAD in the revert commit**
- **Found during:** Task 1
- **Issue:** GitHub rejects a GITHUB_TOKEN push that creates or updates a workflow file, because the token has no `workflows` permission. A full tree restore over a range that touched `.github/workflows` would fail the push, so no PR would be opened. Phase 10 itself changes workflows, so this is a likely case.
- **Fix:** After the full restore, if GOOD and HEAD differ under `.github/workflows`, the script restores that directory from HEAD. The body then says those files were kept and need a manual revert if they caused the failure. If only workflow files differ, it logs and exits 0. This assumption about GitHub should be confirmed in the plan 12 drill.
- **Files modified:** scripts/ci/auto-revert.sh, tests/auto-revert.test.ts (test "keeps workflow files at HEAD...")
- **Committed in:** 027b59b

**2. [Rule 2 - Correctness] `timed_out` smoke jobs count as failures; the ancestor lookup also uses `event=push`**
- **Found during:** Task 1
- **Issue:** A smoke leg killed by its 20-minute timeout is a smoke failure. The must_haves define "such a run" (a push run) for the ancestor rule too.
- **Fix:** The current run is filtered on conclusions `failure,timed_out`. The `head_sha=` query adds `&event=push&status=success`.
- **Committed in:** 027b59b

**3. [Rule 2 - Correctness] Lone-artifact layout and artifact path outside the work tree**
- **Found during:** Task 2 (download-artifact v8 docs via Context7)
- **Issue:** When exactly one artifact matches `pattern`, download-artifact v8 extracts it straight into `path`, with no `smoke-SLUG` directory. Downloading into the workspace (`path: artifacts`) would also put untracked files in the tree being restored.
- **Fix:** The script falls back to `ARTIFACTS_DIR` when its `image.txt` names the failing image. The job downloads to `${{ runner.temp }}/smoke-artifacts` instead of `artifacts`.
- **Committed in:** 027b59b, 8c82014

**4. [Rule 3 - Blocking] gh test double logged argv through `jq --args`, which parsed `--paginate` as a jq option**
- **Fix:** Each argument is encoded separately (`jq -Rs .`), then slurped into one array.
- **Committed in:** 027b59b

**5. Extra file outside `files_modified`:** `tests/fixtures/auto-revert/gh`. The phase artifact table lists `tests/fixtures/auto-revert/` for plan 07, so this matches the shared contract.

**6. Additional tests beyond `<behavior>`:** before-SHA fallback, merge-base fallback, invalid ref name (exit 1, no gh call), the workflow-files rule, and the body cap with balanced fences. That makes 13 tests where the plan asked for at least 8.

---

**Total deviations:** 4 auto-fixed (3 Rule 2, 1 Rule 3), plus one in-contract extra file and added tests.
**Impact on plan:** All of these keep the job working on real GitHub runs. No scope creep beyond the D-15 contract.

## Issues Encountered

- The acceptance grep `grep -c 'git restore --source="$GOOD" --staged --worktree -- .'` prints 0 with macOS BSD grep, which treats a mid-pattern `$` as an anchor. `grep -cF` and GNU grep both print 1.
- In this worktree harness, `actionlint` had to be invoked as `/usr/local/bin/actionlint`; a bare `actionlint` call was refused.

## Verification

- `pnpm exec vitest run tests/auto-revert.test.ts`: 13 passed (macOS), and 13 passed in debian:13.
- `shellcheck scripts/ci/auto-revert.sh tests/fixtures/auto-revert/gh`: clean. A file-wide `SC2016` disable is documented: backticks in single-quoted printf formats are Markdown code spans.
- `actionlint .github/workflows/ci.yml .github/workflows/distro.yml`: clean. `grep 'secrets\.' ci.yml`: no match.
- `pnpm lint`: clean (144 files). `pnpm test:run`: 54 files, 1342 tests passed.
- Acceptance strings in ci.yml (`GH_TOKEN: ${{ github.token }}`, `github.event_name == 'push'`, the `startsWith(...)` guard, `contents: write`, `pull-requests: write`, `bash scripts/ci/auto-revert.sh`): each appears exactly once. `eval` count in the script: 0. Both files are mode 100755.

## User Setup Required

None for this plan. Plan 12 enables "Allow GitHub Actions to create and approve pull requests" (D-21) and runs the live drill. Until then, `gh pr create` in the job will get a 403 (Pitfall 4).

## Next Phase Readiness

- Plan 12 Task 2: push a deliberately broken commit to a scratch branch and check that `auto-revert/<scratch>` and its PR appear. Then confirm that a workflow-file change in the range is kept at HEAD and the push succeeds.

## OpenWolf entries

For plan 11 to apply (this plan commits no `.wolf/` file):

- **anatomy.md** `## scripts/ci/`: `auto-revert.sh`: D-15 smoke auto-revert (bash, env-only inputs). Last green = branch push run with smoke passed, then first-parent ancestor by head_sha, then before SHA, then merge base with main; else ::warning::. Tree restore on `auto-revert/<branch / to ->`, workflow files kept at HEAD, force-push, then gh pr edit+comment if open else create. Body: failing jobs, run URL, doctor.json and log tails, sanitized, 60000 cap. (~3600 tok)
- **anatomy.md** `## tests/`: `auto-revert.test.ts`: 13 tests for auto-revert.sh against temp repos (bare remote, merge commit) with the gh double on PATH; skips without bash. (~4600 tok)
- **anatomy.md** `## tests/fixtures/`: `auto-revert/gh`: gh CLI test double. Logs argv as JSON lines to $GH_LOG, serves jobs-ID.json, sha-runs-SHA.json, branch-runs.json and pr-list.txt from $GH_FIXTURES, copies --body-file to $GH_LOG.body. (~600 tok)
- **anatomy.md** `## .github/workflows/`: ci.yml gains the `auto-revert` job (push only, distro failed, not auto-revert/*, contents/pull-requests write + actions read, download-artifact@v8 into runner.temp).
- **cerebrum Key Learnings:** [2026-10-29] GITHUB_TOKEN cannot push changes to `.github/workflows/*` (no `workflows` permission). Any bot commit made with it must leave workflow files unchanged, so auto-revert keeps them at HEAD.
- **cerebrum Key Learnings:** [2026-10-29] download-artifact v8 with `pattern:` extracts into `path/<artifact-name>/` only when 2 or more artifacts match. A single match goes straight into `path`, so consumers must handle both layouts.
- **cerebrum Do-Not-Repeat:** [2026-10-29] Do not log a stub's argv with `jq -n '$ARGS.positional' --args "$@"`: jq still parses later `--flags` (`--paginate`) as its own options. Encode each argument with `printf '%s' "$a" | jq -Rs .` and slurp.
- **cerebrum Do-Not-Repeat:** [2026-10-29] On macOS, BSD `grep` treats `$` in the middle of a basic regex as an anchor, so plan acceptance greps containing `"$VAR"` print 0. Use `grep -F` for literal code strings.
- **buglog:** bug-NNN "jq: Unknown option --paginate" in tests/fixtures/auto-revert/gh. Root cause: `jq --args` keeps parsing options. Fix: per-argument `jq -Rs .` then `jq -sc .`. Tags: [jq, test-double, gh, auto-revert].

## Self-Check: PASSED

- FOUND: scripts/ci/auto-revert.sh, tests/auto-revert.test.ts, tests/fixtures/auto-revert/gh, .github/workflows/ci.yml
- FOUND commits: 1e9f33e, 027b59b, 8c82014 (ancestors of HEAD)

---
*Phase: 10-linux-distro-ci-harness-and-anonymous-telemetry*
*Completed: 2026-10-29*
