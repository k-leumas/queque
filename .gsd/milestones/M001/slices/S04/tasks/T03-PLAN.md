# T03: 03.1 03

**Slice:** S04 — **Milestone:** M001

## Description

Wave 2: Rewrite CandidateSelect with full monocle contract and refactor run-foreground to modal-first async.

This is the core implementation wave. All locked decisions (D-01 through D-07) ship here.

CandidateSelect gains: nullable candidates prop (D-06), live search state (D-01/D-02), ┌> selection glyph (UI-SPEC), LoadingSpinner/SearchInput/ControlsLine composition, useEffect selectedIndex reset on candidates arrival (Pitfall 2 fix), null-guarded navigation handlers (Pitfall 3 fix).

run-foreground.ts gains: modal-first launch before fetchCandidates (D-05/D-07), rerender() pattern to push resolved candidates into the live modal (D-07), removal of fast-accept bypass (D-03), MODAL_CHROME_LINES=9 (Pitfall 1 fix), error state via rerender with error prop.

Purpose: Ship the complete monocle interface. After this wave, the vitest suite is fully green and manual TTY verification confirms the visual contract.
Output: CandidateSelect.tsx (rewritten), run-foreground.ts (refactored llm branch + renderModal).

## Must-Haves

- [ ] "CandidateSelect renders LoadingSpinner when candidates prop is null"
- [ ] "CandidateSelect renders filtered candidate rows when candidates is CandidateList"
- [ ] "CandidateSelect uses ┌> glyph in ansi256(166) orange for active row, 3 spaces for inactive"
- [ ] "Live search filters candidates by case-insensitive substring match on command text"
- [ ] "Arrow navigation and Enter/Esc work on the visible (filtered) list"
- [ ] "D-01: initialQuery pre-populates search from request.lbuffer"
- [ ] "D-02: empty lbuffer shows all candidates unfiltered; search box placeholder reads 'type to filter…'"
- [ ] "D-03: fast-accept bypass (single-candidate direct write) is removed"
- [ ] "D-04: CandidateSelect renders candidates in received order (no UI-side re-ranking)"
- [ ] "D-05: showLoadingIndicator raw ANSI write is removed"
- [ ] "D-06: CandidateSelect accepts candidates: CandidateList | null; renders spinner when null, candidate rows when CandidateList"
- [ ] "D-07: modal opens before fetchCandidates resolves; rerender() pushes resolved CandidateList in"
- [ ] "Provider error triggers error state inside modal; Esc writes cancel result"
- [ ] "MODAL_CHROME_LINES updated to 9"

## Files

- `src/ui/CandidateSelect.tsx`
- `src/client/run-foreground.ts`
