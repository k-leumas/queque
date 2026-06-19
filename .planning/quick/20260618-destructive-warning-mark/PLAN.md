# Quick Task: Destructive command warning mark

Add a yellow `⚠` footnote beside each destructive candidate command and prefix the selection footer warning with the same symbol.

## Scope

- `src/ui/CandidateSelect.tsx` — inline mark on last command line; shared constant for footer text
- `tests/candidate-select.test.tsx` — mark on selected/unselected destructive rows

## Acceptance

- Destructive candidates show yellow `⚠` after command text
- Safe candidates do not show inline mark
- Footer warning uses same symbol when selected candidate is destructive
