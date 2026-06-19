---
status: complete
---

# Quick Task: Destructive command warning mark

Yellow `⚠` footnote on destructive candidate commands (all visible rows) and matching prefix on the selection footer warning.

## Changes

- `src/ui/CandidateSelect.tsx` — `DESTRUCTIVE_WARNING_MARK`, inline mark on last command line, footer uses shared text
- `tests/candidate-select.test.tsx` — mark on selected and unselected destructive rows

## Verification

`pnpm test:run` — all pass
