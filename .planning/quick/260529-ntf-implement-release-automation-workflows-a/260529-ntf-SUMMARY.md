---
phase: quick-260529-ntf
plan: "01"
subsystem: ci
tags: [release-automation, semantic-release, homebrew, github-actions, beta]
dependency_graph:
  requires: []
  provides: [release-automation]
  affects: [npm-publish, homebrew-tap, beta-prerelease]
tech_stack:
  added: []
  patterns:
    - pnpm exec semantic-release for local version pinning
    - Justintime50/homebrew-releaser@v1 for tap formula sync
    - semantic-release beta prerelease branch pattern
key_files:
  created:
    - .github/workflows/homebrew.yml
  modified:
    - .github/workflows/release.yaml
    - .releaserc.json
decisions:
  - Use pnpm exec over npx to guarantee the locally installed semantic-release version is used
  - homebrew.yml triggers on release.types[published] so it fires for both manual and semantic-release-created releases
  - HOMEBREW_TAP_TOKEN scoped to repo only on k-leumas/homebrew-queque per threat model T-ntf-02
metrics:
  duration: "~3 minutes"
  completed: "2026-05-29"
  tasks_completed: 3
  files_changed: 3
---

# Phase quick-260529-ntf Plan 01: Release Automation Workflows Summary

**One-liner:** Beta-aware semantic-release CI with automated Homebrew tap updates via homebrew-releaser on published GitHub Releases.

## What Was Built

Three targeted changes to wire the full release pipeline for QueQue:

1. **`.github/workflows/release.yaml`** — added `beta` to the push branch trigger, upgraded both `pnpm/action-setup@v2` references to `@v4`, replaced `npx semantic-release` with `pnpm exec semantic-release`, and added a secrets documentation comment above the release step env block.

2. **`.github/workflows/homebrew.yml`** — new workflow that fires on `release.types: [published]` and delegates to `Justintime50/homebrew-releaser@v1` to update the `k-leumas/homebrew-queque` tap formula automatically.

3. **`.releaserc.json`** — extended `branches` from `["main"]` to include `{ "name": "beta", "prerelease": true }` alongside `main`, leaving the full plugin chain untouched.

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1+2+3 | ci: add release automation workflows and beta branch config | 1c0e36d |

## Deviations from Plan

None — plan executed exactly as written. All three edits were surgical (no file restructuring).

## Threat Surface Scan

The new workflow files are CI/CD config only. No new network endpoints, auth paths, file access patterns, or schema changes in the application code. Threat model mitigations T-ntf-01 through T-ntf-SC were reviewed:

- NPM_TOKEN is an Actions secret, masked in logs, scoped to Automation token type.
- HOMEBREW_TAP_TOKEN documented with `repo`-only scope recommendation in the workflow comment.
- `persist-credentials: false` remains in place on the release job checkout.
- Justintime50/homebrew-releaser@v1 accepted as T-ntf-SC (1k+ stars, actively maintained).

## Known Stubs

None — these are CI/CD configuration files with no UI or data rendering.

## Self-Check: PASSED

- `.github/workflows/release.yaml` — exists with beta, @v4 actions, pnpm exec
- `.github/workflows/homebrew.yml` — exists with published trigger, homebrew-releaser@v1
- `.releaserc.json` — valid JSON, beta prerelease branch present
- Commit `1c0e36d` — verified in git log
- 148 tests passed, no deletions
