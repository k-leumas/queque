# Quick Task: Selection arrow vertical tail

Extended the active-row `┌>` glyph with a `│  ` tail on every wrapped continuation line (command + explanation) so the selection indicator spans the full block height without shifting text.

## Changes

- `src/ui/CandidateSelect.tsx` — `wrapText()`, `ACTIVE_TAIL`, line-by-line gutter prefixes
- `tests/candidate-select.test.tsx` — tail + wrap tests, `useStdout` mock

## Verification

`pnpm test:run` — all pass
