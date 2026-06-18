---
slug: privacy-config-file
date: 2026-06-17
status: in-progress
---

# Quick Task: User privacy config file

## Goal

Move privacy filter settings from hardcoded regexes to `~/.config/qq/config.json` with Zod validation. User patterns merge onto built-in defaults; env vars override where noted.

## Tasks

1. Add `src/shared/qq-config.ts` — schema, load, merge, cache
2. Refactor `src/shared/privacy-filter.ts` to use `loadQqConfig()`
3. Add `docs/config.example.json` and document in README + EXTENSIONS.md
4. Tests: `tests/qq-config.test.ts`, extend `tests/privacy-filter.test.ts`

## Out of scope

- `.gitignore` integration (`privacy.useGitignore` reserved in schema only)
