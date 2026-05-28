---
phase: quick
plan: 260528-mk1
subsystem: branding
tags: [rename, branding, chore]
dependency_graph:
  requires: []
  provides: [consistent-brand-name]
  affects: [package.json, all prose files, shell display, test assertions]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - package.json
    - README.md
    - CLAUDE.md
    - docs/SYSTEM_DESGN.md
    - docs/RELEASING.md
    - shell/zsh/qq.zsh
    - src/ui/CandidateSelect.tsx
    - src/providers/claude.ts
    - src/client/run-foreground.ts
    - src/cli/main.ts
    - tests/zsh-widget.test.ts
    - tests/client-result.test.ts
    - tests/shell-contract.test.ts
decisions:
  - "Package name changed from 'que-que' to 'queque'"
  - "Prose title case form: QueQue (no hyphen, camel case)"
  - "Display label in shell/TUI: queque (all lowercase)"
  - "Repository URL updated to github.com/k-leumas/queque"
metrics:
  duration: ~15 minutes
  completed: 2026-05-28
---

# Phase quick Plan 260528-mk1: Rename que-que to queque Summary

**One-liner:** Renamed project brand from "que-que" (hyphenated) to "queque" across all prose, display strings, package manifest, and test assertions — 79 files updated in a single clean commit.

## What Was Done

Executed a complete rename of the QueQue project from the hyphenated form "que-que" to the single-word form "queque" across the entire codebase.

### Changes by category

**Package manifest (package.json):**
- `"name": "que-que"` → `"name": "queque"`
- Repository URL updated to `https://github.com/k-leumas/queque.git`

**Prose and documentation (README.md, CLAUDE.md, docs/):**
- All "Que-Que" → "QueQue" (title case)
- All "que-que" → "queque" (lowercase)
- Dev path example `$HOME/dev/que-que` → `$HOME/dev/queque`

**Shell display string (shell/zsh/qq.zsh):**
- Comment header: "QueQue ZLE widget..."
- Display label: `queque › ${escaped_query}` (dim color)
- Comment near widget definition: "QueQue using the Zellij..."

**Source code string literals (src/):**
- `CandidateSelect.tsx`: display label `que-que › ${initialQuery}` → `queque › ${initialQuery}`
- `providers/claude.ts`: error string and system prompt updated to "QueQue"
- `client/run-foreground.ts`: two error message strings updated to "QueQue:"
- `cli/main.ts`: uncaught exception and unhandled rejection log strings updated

**Test assertions (tests/):**
- `zsh-widget.test.ts`: all `.toContain('que-que ...')` assertions → `queque`; grep pattern updated
- `client-result.test.ts`: `.toContain('Que-Que:')` → `.toContain('QueQue:')`
- `shell-contract.test.ts`: two error message string literals updated

**Planning and wolf files (.planning/, .gsd/, .wolf/):**
- All `.planning/` phase and research files updated
- `.gsd/PROJECT.md`, `.gsd/REQUIREMENTS.md`, and all milestone/slice files updated
- `.wolf/anatomy.md`: package.json description updated to "(name: queque)"
- `.wolf/buglog.json` and `.wolf/memory.md`: historical references updated
- Memory entry appended documenting the rename

## Deviations from Plan

### Additional scope (auto-expanded to satisfy must_haves)

The plan's `files_modified` list was not exhaustive. The `must_haves.truths` required zero remaining occurrences across the repo. The following directories had occurrences not listed in the plan:

- `.gsd/PROJECT.md`, `.gsd/REQUIREMENTS.md`, and 17 `.gsd/milestones/` files — updated
- `.planning/phases/01-*`, `03-*`, `03.2-*`, `04-*` files beyond the two listed — updated
- `.planning/.continue-here.md`, `.planning/HANDOFF.json` — updated
- `.wolf/buglog.json`, `.wolf/memory.md` — updated (historical bug log entries referenced old name)

**Excluded (intentional):**
- `CHANGELOG.md` — contains historical GitHub commit URLs (`github.com/k-leumas/que-que/commit/...`) that are permanent git history references; changing these would break the links
- `.wolf/hooks/_session.json` — session tracking file with plan directory path (the path itself contains "que-que" as the plan ID — not a brand reference)
- `.planning/quick/260528-mk1-rename-que-que-to-queque-in-prose-write-/` — the plan directory itself (name is a permanent artifact)

## Verification

| Check | Result |
|-------|--------|
| `grep -rn "que-que\|Que-Que" ... \| grep -v CHANGELOG \| grep -v 260528-mk1 \| grep -v worktrees` | 0 matches |
| `node -e "require('./package.json').name"` | `queque` |
| `pnpm test` | 148/148 tests pass |
| `pnpm biome check src/ tests/` | 3 pre-existing warnings, 0 errors |

## Self-Check: PASSED

- Commit `492f2f6` exists at HEAD with 79 files changed
- `package.json` `name` field is `queque`
- `shell/zsh/qq.zsh` display label reads `queque ›`
- `src/ui/CandidateSelect.tsx` display string reads `queque ›`
- All test assertions updated to match new strings
- All 148 tests pass
