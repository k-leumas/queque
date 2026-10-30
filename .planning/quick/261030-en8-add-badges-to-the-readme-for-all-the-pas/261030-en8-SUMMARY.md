---
phase: quick-261030-en8
plan: 01
subsystem: docs
status: complete
tags: [readme, badges, shields.io, ci, drift-guard]
requires: []
provides:
  - README workflow status badge row (CI, Nightly, Release)
  - README "tested on" distro badge row matching the ci.yml images array
  - tests/readme-badges.test.ts offline drift guard
affects: [README.md, .github/workflows/ci.yml (images array is now load-bearing for the README)]
tech-stack:
  added: []
  patterns: [static shields /badge/ URLs in brand colors, vitest file-parity guard over workflow YAML via regex]
key-files:
  created:
    - tests/readme-badges.test.ts
  modified:
    - README.md
    - .wolf/anatomy.md
    - .wolf/buglog.json
    - .wolf/cerebrum.md
    - .wolf/memory.md
decisions:
  - Distro badges are static and brand-colored so they never imitate a live passing result; live status comes only from the three workflow badges
  - No macOS badge and no nightly :latest badges; the test forbids a macOS badge while no workflow runs on macOS
metrics:
  duration: ~15 min
  completed: 2026-10-30
actuals:
  tokens: 5500
  tasks: 2
  commits: 1
plan_head_before: f22327e8994fcff2280e3607f5c8bb54aaac816d
plan_head_after: 9155f834f246ec7ea2751a62e8a46a70bef19a59
---

# Quick 261030-en8 Plan 01: README Badges Summary

The README now shows three live shields.io GitHub Actions badges under the H1 (CI, Nightly, Release on main). Below them are six static "tested on" badges, one for each Docker image in the ci.yml distro matrix. tests/readme-badges.test.ts keeps those badges equal to the CI matrix.

## What was built

- **README.md**: nine badge lines between the H1 (unchanged) and `**Before:**`. The workflow row links to each workflow's runs page (`ci.yml`, `nightly.yml`, `release.yaml`). The distro row covers ubuntu:22.04, ubuntu:24.04, debian:13, fedora:44, archlinux:latest and alpine:3.24, in brand colors with simple-icons logos, each linking to the CI runs page.
- **tests/readme-badges.test.ts** has four tests:
  - Workflow badges: shields host, path, `branch=main`, `label`, the href, and that the workflow file exists.
  - Distro badge alt refs must equal the ci.yml `images:` JSON array, in order.
  - Distro badge shape: the `tested on` label, the tag in the message, the logo slug from LOGO_SLUGS, and the CI href.
  - No macOS badge unless some `runs-on:` names macOS.

## TDD gate

- **RED** (before the README edit): `pnpm exec vitest run tests/readme-badges.test.ts` gave 3 failed and 1 passed.
  - `README must have exactly one "CI" workflow badge; add it under the H1 in README.md: expected +0 to be 1`
  - `README distro badges must equal ci.yml images; update the tested-on badges in README.md: expected [] to deeply equal [ Array(6) ]`
  - `README must have tested-on distro badges: expected 0 to be greater than 0`
  - The macOS guard passed, as expected, because there were no badges yet.
  - The red state was not committed.
- **GREEN**: 4/4 passed after the README edit, and again after biome formatting.

## Verification

- Task 1 verify:
  - vitest 4/4 passed.
  - Exactly 9 badge lines come before `**Before:**`.
  - The H1 is unchanged.
  - Live render check: all 9 shields URLs returned 200 with an embedded logo and no error text. The SVG titles were `CI: passing`, `Nightly: passing`, `Release: passing` and `tested on: Ubuntu 22.04` … `tested on: Alpine 3.24`.
- Task 2 verify:
  - `biome check tests/readme-badges.test.ts` is clean.
  - `pnpm typecheck` is clean.
  - The lefthook pre-commit typecheck and lint passed, and the commit-msg commitlint passed.
  - HEAD contains README.md, the test and the .wolf/ files, with no .mov and no co-author trailer.
  - The working tree is clean, and HEAD differs from origin/main. Nothing was pushed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome format finding in the new test**
- **Found during:** Task 2, step 1
- **Issue:** One assertion message used `\'` escapes inside a single-quoted string, and biome's formatter wanted double quotes.
- **Fix:** `biome check --write`. Only the string quoting changed; no assertion changed. Logged as bug-472 in .wolf/buglog.json.
- **Files modified:** tests/readme-badges.test.ts
- **Commit:** 9155f83

Other notes:
- The plan's inline `node -e` render check was run as an equivalent temporary script. The fetch logic and pass criteria were the same, and the script also printed SVG titles. The script was deleted afterwards and not committed.
- Per the user's memory and the orchestrator's constraint, the commit has no Co-Authored-By trailer. This overrides the harness attribution default.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: README.md (badge block present, 9 lines before **Before:**)
- FOUND: tests/readme-badges.test.ts
- FOUND: commit 9155f83 is on HEAD
