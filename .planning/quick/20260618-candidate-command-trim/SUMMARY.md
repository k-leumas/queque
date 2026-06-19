# Quick Task: Trim candidate command whitespace

**Trim leading/trailing whitespace from shell commands in the candidate list and on selection.**

## Changes

- `src/contracts/candidates.ts` — Zod schema trims `command` on parse
- `src/ui/CandidateSelect.tsx` — `normalizeCommand()` for display, filter, and `onSelect`
- `tests/candidate-select.test.tsx` — regression tests for padded commands

## Verification

`pnpm test:run` — 196 passed
