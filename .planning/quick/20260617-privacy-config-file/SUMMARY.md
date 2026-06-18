---
phase: quick
plan: privacy-config-file
status: complete
completed: "2026-06-18"
commit: 7bf0799
subsystem: privacy
tags: [config, privacy-filter, zod]
key_files:
  created:
    - src/shared/qq-config.ts
    - docs/config.example.json
    - tests/qq-config.test.ts
  modified:
    - src/shared/privacy-filter.ts
    - tests/privacy-filter.test.ts
    - README.md
    - docs/EXTENSIONS.md
metrics:
  completed: "2026-06-17"
  tasks_completed: 4
---

# Quick Task: User privacy config file

## Summary

Privacy filter settings now load from `~/.config/qq/config.json` (or `QQ_CONFIG_FILE`). Built-in sensitive path, log redaction, and destructive-command patterns always apply; user config merges additional patterns on top. Env vars (`QQ_ALLOW_FILE_READ`, `QQ_DEBUG_VERBOSE`) still override where documented.

## What changed

- **`src/shared/qq-config.ts`** — Zod schema, `loadQqConfig()`, pattern compilation, cache + test reset
- **`src/shared/privacy-filter.ts`** — delegates to resolved config instead of hardcoded arrays
- **`docs/config.example.json`** — copy-paste starter config
- **Docs** — README + EXTENSIONS.md describe config fields; `useGitignore` reserved (not implemented)

## Verification

- `pnpm test:run` — 177/177 tests pass (post-review remediation)
