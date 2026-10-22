---
phase: quick-261021-sya
plan: 01
subsystem: release
tags: [release, changelog, semantic-release, security]
status: complete
requires: []
provides:
  - normalizeRepositoryUrl that strips user info/credentials and converts ssh/scp forms to https
affects:
  - scripts/semantic-release-user-notes.ts (generateNotes compare and commit links)
  - CHANGELOG.md
tech-stack:
  added: []
  patterns: [regex-only URL normalization (no new URL()), so it never throws during a release]
key-files:
  created: []
  modified:
    - scripts/semantic-release-user-notes.ts
    - tests/semantic-release-user-notes.test.ts
    - CHANGELOG.md
    - .wolf/anatomy.md
    - .wolf/buglog.json
    - .wolf/memory.md
decisions:
  - normalizeRepositoryUrl uses plain regex replacements, not new URL(), so scp-like input and odd user info pass through without throwing
  - The ssh port is dropped only for URLs converted from ssh:// or git://; an explicit https port (GitHub Enterprise) is kept
metrics:
  duration: ~5 min
  completed: 2026-10-21
actuals:
  tokens: 7986
  tasks: 2
  commits: 2
plan_head_before: 408f7c8b107b9a1604f4952221271ce1262a8792
plan_head_after: 6b3e986a6d57e49db8e80c4e049442b611ef2fec
---

# Quick 261021-sya Plan 01: Fix Changelog Links Leaking x-access-token Summary

normalizeRepositoryUrl now strips credential user info and converts ssh/scp forms to a public https base. A generateNotes test passes a token-shaped CI URL to prove it. The 78 broken `x-access-token:[secure]@` links in CHANGELOG.md now point at `https://github.com/k-leumas/queque`.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 (tracer, TDD) | Strip credentials and ssh forms in normalizeRepositoryUrl, tested end-to-end through generateNotes | bac2fc6 | scripts/semantic-release-user-notes.ts, tests/semantic-release-user-notes.test.ts |
| 2 | Rewrite the 78 credential links in CHANGELOG.md | 6b3e986 | CHANGELOG.md, .wolf/anatomy.md, .wolf/buglog.json, .wolf/memory.md |

## Verification

- RED: the 9 new userinfo/ssh/scp/trailing-slash cases and the credential generateNotes case failed. The clean-URL case, the empty-string case and all 18 existing tests passed.
- GREEN: `pnpm exec vitest run tests/semantic-release-user-notes.test.ts` gives 30/30 passing. `tsc --noEmit` and biome are clean, and the lefthook typecheck, lint and commitlint hooks passed on both commits.
- Tracer gate: the automated `<verify>` passed again before expanding to Task 2.
- CHANGELOG.md before the rewrite: 78 `x-access-token` lines and 96 public-URL lines. After: 0 `@github.com` matches and 174 public-URL lines. `git diff --numstat` shows `78 78`.
- The Task 2 automated verify command printed OK. README.md, screen-cap-filename.mov and .wolf/hooks/_session.json stayed unstaged.

## TDD Gate Compliance

RED and GREEN were checked in order before the commit. Following the plan's action ("Commit only these two files"), the test and the implementation went into one task commit, bac2fc6, not separate test/feat commits.

## Deviations from Plan

- Small change to the order of step 4 versus step 5: for converted ssh/git URLs, user info is removed before the port is dropped. The port regex then never has to skip a `user@`. The result is the same for every input in the plan.
- Kept `.wolf/buglog.json` without a trailing newline, matching the file as it was.

Otherwise the plan was followed as written.

## Known Stubs

None.

## Threat Flags

None. T-261021-sya-01 and -02 were mitigated as planned. No new surface was added.

## Self-Check: PASSED

- FOUND: scripts/semantic-release-user-notes.ts, tests/semantic-release-user-notes.test.ts, CHANGELOG.md
- FOUND: bac2fc6, 6b3e986 (both ancestors of HEAD)
