---
phase: quick-261115-3qz
plan: 01
subsystem: docs
status: complete
tags: [readme, badges, support-matrix, drift-guard]
requires: []
provides:
  - README shell badge row (zsh 5.0+, bash 5.0+, fish coming soon (Phase 12))
  - README "Tests passing on:" row (six CI distros, no label segment, plus macOS tested by hand)
  - README `### Supported platforms` table at the end of Install
  - tests/readme-badges.test.ts contract tied to ci.yml images and SHELL_SPECS
affects: [README.md, tests/readme-badges.test.ts]
tech-stack:
  added: []
  patterns:
    - "README support facts asserted against code (SHELL_SPECS failBelow/warnBelow/shipped, ci.yml images)"
key-files:
  created: []
  modified:
    - README.md
    - tests/readme-badges.test.ts
decisions:
  - "Per-task commits (Task 1, Task 2) instead of the plan's single commit, per the orchestrator's atomic-commit constraint; .wolf bookkeeping is handed back to the orchestrator"
  - "macOS badge links docs/INSTALL.md (tested by hand) and the test pins that while no workflow runs-on macOS; supersedes the 261030-en8 'no macOS badge' rule"
metrics:
  duration: about 6 min (08:49Z to 08:55Z)
  completed: 2026-11-15
actuals:
  tokens: 4100
  tasks: 3
  commits: 2
plan_head_before: 0ab31be6cb1f96a3083dd526435dbf37cd72abf8
plan_head_after: b22e860
---

# Phase quick-261115-3qz Plan 01: README support matrix Summary

The README now shows a shell badge row, a "Tests passing on:" row with six distro badges (name only)
plus a macOS badge linking the install guide, and a Supported platforms table. A drift guard ties
all of it to ci.yml and src/shared/shell-registry.ts.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | "Tests passing on:" row, test contract first (tracer) | 48d3385 | README.md, tests/readme-badges.test.ts |
| 2 | Shell badge row and Supported platforms table, tied to SHELL_SPECS | b22e860 | README.md, tests/readme-badges.test.ts |
| 3 | Full suite and OpenWolf bookkeeping | (no code commit) | .wolf entries returned to orchestrator |

## TDD evidence

- Task 1 RED: 4 of 5 badge tests failed against the old README (distro alts still `tested on ...`,
  no `Tests passing on:\` line, no macOS badge). GREEN after the README edit: 9/9 with docs-links.
- Task 2 RED: the shell-badge and table tests failed (no zsh badge, no `### Supported platforms`).
  GREEN after the README edit: 28/28 across readme-badges, docs-links and shell-names-invariant.
- Tracer gate: Task 1's automated verify was re-run end to end and passed before expanding.

## What changed

- README.md: shell row between the workflow row and the distro row; `Tests passing on:\` (hard line
  break) above six distro badges whose alt text is the docker ref and whose only text is the distro
  name, then a macOS badge linking docs/INSTALL.md. Install ends with the six-row table from the
  spec; the "On macOS, /bin/bash is 3.2" sentence moved into the table's bash row. README is 86 lines.
- tests/readme-badges.test.ts: removed TESTED_ON; added REPO_BLOB, INSTALL_DOC, isStaticShieldsBadge,
  staticBadgeParts and badgeMarkdown helpers. distroBadges() selects static shields badges linking
  the CI runs page. New tests: distro badges have no label segment; the distro row sits under the
  `Tests passing on:\` line; exactly one macOS badge, linking INSTALL.md while no macOS runner; shell
  badges and table rows derive every version from SHELL_SPECS (no hard-coded 5.0/5.8/5.1).

## Full suite

`QQ_TEST_BASH=/opt/local/bin/bash` with /opt/local/bin first on PATH, `pnpm test:run`: 66 test
files, 1875 tests passed, exit 0, 66.96s. No load flakes on this run, so no reruns. Biome on the test
file and `tsc --noEmit` are clean; `grep -c 'tested%20on' README.md` prints 0.

## Deviations from Plan

- **Commit layout:** two per-task commits instead of the plan's single Task 3 commit, and no .wolf
  files committed, per the orchestrator's constraints (atomic per-task commits; .wolf edits are
  applied by the orchestrator). Commit headers use `docs(quick-261115-3qz): ...` as the plan asked.
- **Test readability:** the Supported platforms heading check uses a boolean assertion so a failure
  does not print the whole README.

## Known Stubs

None.

## Threat Flags

None. T-261115-3qz-01 and -02 are mitigated by the new assertions (macOS href and "tested by hand"
row; versions from SHELL_SPECS; distro alts from ci.yml).

## Self-Check: PASSED

- FOUND: README.md, tests/readme-badges.test.ts
- FOUND: 48d3385, b22e860 (ancestors of HEAD); 2 commits since 0ab31be; no Co-Authored-By trailer
