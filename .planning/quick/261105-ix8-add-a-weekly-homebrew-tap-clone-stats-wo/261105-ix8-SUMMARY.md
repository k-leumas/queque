---
phase: quick-261105-ix8
plan: 01
subsystem: ci
tags: [github-actions, homebrew, traffic-api, stats-branch, actionlint]
status: complete
requires: []
provides:
  - "Weekly tap clone snapshot with publishing clones subtracted, kept on the orphan `stats` branch"
  - "Offline harness that runs the workflow's own run: bodies against fixtures and a local bare origin"
affects: [release.yaml, homebrew.yml]
tech-stack:
  added: []
  patterns:
    - "Orphan data branch for bot commits (ls-remote exit 2, git switch --orphan, git push origin stats)"
    - "Offline workflow testing: PyYAML-extracted run: bodies + fixture-replaying fake gh + file:// bare origin"
key-files:
  created:
    - .github/workflows/tap-clone-stats.yml
    - .planning/quick/261105-ix8-add-a-weekly-homebrew-tap-clone-stats-wo/verify-tap-clone-stats.sh
  modified:
    - .wolf/anatomy.md
    - .wolf/memory.md
    - .wolf/cerebrum.md
    - .wolf/buglog.json
decisions:
  - "release_clones = 'Release to Homebrew tap' steps (release.yaml, homebrew.yml) with conclusion success or failure, every attempt (filter=all), keyed by started_at UTC day; adjusted = max(raw - release_clones, 0)"
  - "History lives on an orphan `stats` branch pushed with GITHUB_TOKEN; main is never pushed"
  - "`since` is the oldest day in the traffic response ([.clones[].timestamp[:10]] | min)"
metrics:
  duration: "~12 min"
  completed: 2026-11-05
actuals:
  tokens: 6800
  tasks: 3
  commits: 1
plan_head_before: 470c1981c4720efe4dbf5c4cc2aff65d0e70f730
plan_head_after: 27e495e02191a5b903429b4c2a20898d81c71b1f
---

# Quick 261105-ix8: Weekly Homebrew tap clone stats Summary

A Monday 06:17 UTC (plus manual dispatch) workflow snapshots k-leumas/homebrew-tap per-day clone
traffic, subtracts the tap clones made by this repo's own "Release to Homebrew tap" steps (clamped at
0), and merges the history into stats/tap-clones.json on an orphan `stats` branch. An offline harness
proves the shell, jq and git logic end to end.

## Commit

- `27e495e` chore: add weekly tap clone stats workflow (workflow + .wolf/anatomy, buglog, cerebrum,
  memory). No trailer, not pushed, no PR. Lefthook typecheck, lint and commitlint passed.
- The harness, PLAN and this SUMMARY are left uncommitted for the orchestrator's docs commit.

## Verification

- `python3 ... yaml.safe_load` parses the workflow.
- `/usr/local/bin/actionlint .github/workflows/tap-clone-stats.yml` exits 0 (shellcheck on all
  `run:` bodies).
- `bash .planning/quick/261105-ix8-.../verify-tap-clone-stats.sh` prints PASS for first-run,
  overlap, rerun-identical, empty-clones, api-failure, ls-remote-failure, then `ALL PASS`. No network,
  no token. The harness itself is shellcheck-clean.
- Plan grep checks pass (`git push origin stats`, `filter=all`, `adjusted_uniques`, no
  ubuntu-latest / checkout@v4 / ci_runs / run list outside comments).
- Mutation check (scratch copy outside the repo): replacing the file redirect with
  `cat file | while ...; done || true` makes `api-failure` FAIL; removing the clamp makes
  `first-run` FAIL on the JSON assertion. The harness is not vacuous.

## Step-6 survey: what clones the tap

| Source | File / job / step | Trigger and conditions | Counts as a tap clone? |
|---|---|---|---|
| homebrew-releaser | release.yaml / publish-homebrew / "Release to Homebrew tap" (Justintime50/homebrew-releaser@v1, `homebrew_tap: homebrew-tap`) | push to main and beta; job `needs: tag-and-changelog`, `if: github.ref_name == 'main'`; step `if: steps.formula.outputs.exists != 'true'` (release.yaml:174-175) | Yes (git clone of the tap). Subtracted. |
| homebrew-releaser | homebrew.yml / homebrew / "Release to Homebrew tap" | workflow_dispatch; same step condition (homebrew.yml:52-53) | Yes. Subtracted. |
| Formula check | release.yaml and homebrew.yml / "Check existing Homebrew formula" | Always before the release step | No: curl to raw.githubusercontent.com |
| Homebrew install smoke | release.yaml / test / scripts/smoke-homebrew-docker.sh | push to main and beta, when ANTHROPIC_API_KEY is set | No: builds from local source in Docker and mimics the formula install block; never runs `brew tap` (no brew binary in the image) |
| ci.yml, distro.yml, nightly.yml (and scripts/ci/*, smoke-distro*) | - | push / PR / schedule | No: no reference to the tap, brew tap, brew install or a `repository:` checkout |
| tap-clone-stats.yml | this workflow | schedule, workflow_dispatch | No: API calls only; its checkout is of queque |

No other clone source was found, so the subtraction has no known gap among this repo's workflows.
Clones from outside this repo (users, brew update, mirrors, bots) are what remains in "adjusted".

## Caveats and notes (report only)

- **Replaced design:** the user's update replaced the draft's per-day CI-run tag, its 500-run listing
  cap and the CI-free-days row. Publishing runs are listed with `--paginate` and per_page=100, and each
  run costs one jobs call. release.yaml runs on every push to main and beta, so expect a few dozen
  calls a week, far below the PAT's 5,000 per hour.
- **Upper bound:** adjusted values are an upper bound on real installs; brew update and other fetches
  still count. Subtracting one unique per publishing run assumes each run is one distinct cloner, and
  the clamp keeps results at 0 or above.
- **Edge cases:** runs are selected by created_at >= since, so a run created before `since` whose
  publish step starts on `since` is missed (needs a run crossing UTC midnight). `cancelled` publish
  steps are not counted, per the decision. `filter=all` counts every re-run attempt. A first-ever run
  that gets an empty clone list still commits the `{}` seed as the first `stats` commit (the seed
  precedes the empty-data exit, as in the draft); later empty runs change nothing.
- **Visibility:** if k-leumas/queque is public, the `stats` branch makes the tap's clone counts public.
  Normally only admins can see them.
- **Unverified live path:** the real API responses and the TRAFFIC_TOKEN path are unverified until the
  first run; the fake gh only replays fixtures. After merge to main and adding the secret, run
  `gh workflow run tap-clone-stats.yml`, then
  `git fetch origin stats && git show origin/stats:stats/tap-clones.json`.
- **Header:** the plan expected the header to be reconstructed because the original text was not in its
  handoff. The executor's handoff did include the user's original header, so the block uses that
  wording as its base (the "Put this in the queque repo..." lines and the Setup list kept verbatim, with
  "list workflow runs" widened to "list publishing runs and their jobs") and adds the stats-branch,
  subtraction, upper-bound and trigger points.

## Deviations from Plan

1. **[Orchestrator constraint] Branch:** the commit is on `worktree-agent-a6a4182de90cc1f02`, not
   `chore/tap-clone-stats`. The orchestrator's constraints say to commit in this worktree branch, so the
   Task 3 precondition and its `test "$BR" = chore/tap-clone-stats` check do not apply here; the
   orchestrator owns branch naming on merge.
2. **[Orchestrator constraint] One commit for all three tasks** instead of per-task commits; Tasks 1-2
   produced the workflow (committed) and the harness (left for the docs commit).
3. **Draft body not available:** only the header of the user's draft reached the executor, so the
   unchanged parts (cron comment wording, the `since` derivation, the merge shape, the commit step's
   config/add/diff guard) were written from the plan's description of the draft. The cron comment
   reads `# Mondays 06:17 UTC; weekly stays well inside the 14-day window`.
4. **[Rule 1] Harness lint:** shellcheck SC2034 flagged an unused `FAILED_CASE` variable in the
   harness; removed (logged as bug-475).
5. **Harness argument:** naming a case runs all cases up to and including it (later cases depend on
   origin state from earlier ones) and prints `PASS through <case>`; `ALL PASS` is printed only for a
   full run.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model (T-261105-ix8-01..06 all mitigated or accepted as planned).

## Self-Check: PASSED

- FOUND: .github/workflows/tap-clone-stats.yml
- FOUND: .planning/quick/261105-ix8-add-a-weekly-homebrew-tap-clone-stats-wo/verify-tap-clone-stats.sh
- FOUND: commit 27e495e (ancestor of HEAD, not on any remote branch)
