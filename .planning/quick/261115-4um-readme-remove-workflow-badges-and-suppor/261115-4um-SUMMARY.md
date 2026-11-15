---
phase: quick-261115-4um
plan: 01
subsystem: docs
tags: [readme, badges, docs, tests]
status: complete
requires: []
provides:
  - README badge block without workflow-status badges
  - README Install section without the support table, plus a one-sentence macOS bash note
  - readme-badges absence guard for the removed badges and table
affects: [README.md, tests/readme-badges.test.ts]
tech-stack:
  added: []
  patterns: [absence guard test for removed README content]
key-files:
  created: []
  modified:
    - README.md
    - tests/readme-badges.test.ts
decisions:
  - No workflow-status badges and no support table in README (user, they take up space and are not useful); the macOS bash note is one Install sentence
  - The "tested by hand" invariant moved from the deleted table row onto the macOS badge alt check
metrics:
  duration: 3m12s
  completed: 2026-11-15
actuals:
  tokens: 5200
  tasks: 2
  commits: 1
plan_head_before: 97ba532e5f8de9b828bab6c0dc71e0addb4e8367
plan_head_after: 5c0a9f27aad4d4cd638df25791da2f5867f3b0cf
---

# Phase quick-261115-4um Plan 01: Remove README workflow badges and support table Summary

The README loses the CI/Nightly/Release status badges and the `### Supported platforms` table. The
macOS bash 3.2 fact is now one Install sentence. readme-badges.test.ts guards the kept rows and
fails if the removed content comes back.

## What changed

- **README.md**: the H1 is now followed by one blank line and then the zsh/bash/fish shell badge
  row. The shell row and the `Tests passing on:` row are byte-identical to before. The Install
  section now goes npm block, then
  `On macOS, `/bin/bash` is 3.2, too old for `??`: bash users run `brew install bash` first.`,
  then the unchanged `See [Install](...)` line, then `## Choose a provider`.
- **tests/readme-badges.test.ts** (6 cases): removed the workflow-badge case, the Supported
  platforms table case, `WORKFLOW_BADGES` and the `existsSync` import. Reworded the stale
  `distroBadges()` comment and the shell-badge message (now "in the shell row under the H1").
  The macOS case now also checks that the badge alt contains `tested by hand` while no workflow
  runs on macOS. Added `README has no workflow-status badges and no Supported platforms table`,
  which fails on shields workflow-status URLs, GitHub-native `.../actions/workflows/*.yml/badge`
  URLs and a `### Supported platforms` heading.

## Verification

- `pnpm exec vitest run tests/readme-badges.test.ts tests/docs-links.test.ts`: 10/10 pass (6 + 4)
- `pnpm exec biome check tests/readme-badges.test.ts`: clean
- `pnpm typecheck`: clean
- Full suite (`QQ_TEST_BASH=/opt/local/bin/bash ... pnpm test:run`): 66 files, 1874 tests pass,
  first run, no flakes
- Pre-commit hooks (typecheck, lint, commitlint): pass

## Commits

| Task | Commit | Message |
| --- | --- | --- |
| 1 + 2 | 5c0a9f2 | docs(quick-261115-4um): drop workflow badges and the supported platforms table |

The plan asked for one commit covering both tasks. Task 1 (the tracer) passed its verify gate
before Task 2 started.

## Deviations from Plan

None. The plan ran as written. The commit has no Co-Authored-By trailer, as the user's rule says.

## For the orchestrator (.wolf/ updates, not applied by executor)

- memory.md row:
  `| 09:37 | quick 261115-4um: removed README workflow badges + Supported platforms table, macOS bash note now one Install sentence; readme-badges.test.ts 6 cases incl. absence guard | README.md, tests/readme-badges.test.ts | full suite 1874/1874 green, commit 5c0a9f2 | ~5k |`
- anatomy.md:
  - `README.md`: H1, shell badge row (zsh/bash/fish), `Tests passing on:` distro + macOS row (no
    workflow-status badges); Install has brew/npm blocks, one macOS bash 3.2 sentence and the
    See-Install link (no support table).
  - `tests/readme-badges.test.ts`: 6 cases: distro badges equal the ci.yml matrix, distro badge
    shape, Tests passing on: line, macOS badge links INSTALL.md with a "tested by hand" alt, shell
    badges match SHELL_SPECS, and an absence guard for workflow badges and the support table.
- cerebrum.md: replace the 2026-11-15 "short support table" preference and the "Badges and the
  support table are guarded" learning with: "README has no workflow-status badges and no support
  table (user: they take up space but are not useful). The macOS bash note is one Install
  sentence. readme-badges.test.ts guards the shell row, the distro row (ci.yml images), the macOS
  badge (INSTALL.md link, alt says tested by hand) and fails if either removed item comes back."

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: README.md, tests/readme-badges.test.ts
- FOUND: 5c0a9f2 is an ancestor of HEAD
