# S04: Update Interface And Interactivity To Match That Of This Git

**Goal:** Wave 0: Establish test infrastructure for Phase 03.
**Demo:** Wave 0: Establish test infrastructure for Phase 03.

## Must-Haves


## Tasks

- [x] **T01: 03.1 01**
  - Wave 0: Establish test infrastructure for Phase 03.1.

Three gaps block the phase from being verifiable:
1. vitest.config.ts only matches `.test.ts` — a new `.test.tsx` file won't be discovered.
2. `tests/client-result.test.ts` line 299 asserts `"Que-Que is thinking..."` which D-05 removes.
3. `tests/client-result.test.ts` has a single-candidate test that assumes the fast-accept bypass (D-03 removes it).

This plan closes all three gaps before any implementation work begins, so subsequent waves have green baselines.

Purpose: Ensure pnpm test:run is green before Wave 1 touches any source files. Prevents "is this my change or a pre-existing failure?" ambiguity during execution.
Output: vitest.config.ts (updated), tests/client-result.test.ts (updated), tests/candidate-select.test.tsx (new scaffold with failing tests for Wave 2 to make green).
- [x] **T02: 03.1 02**
  - Wave 1: Create three new UI support components and update Modal's default width.

These are the dependency primitives that CandidateSelect (Wave 2) will import. They must exist — with correct interfaces and visual contracts — before CandidateSelect can be updated.

Purpose: Establish the shared visual vocabulary: monocle glyphs, ANSI 256 palette, search row contract, controls footer, and animated spinner.
Output: SearchInput.tsx, ControlsLine.tsx, LoadingSpinner.tsx (new); Modal.tsx (modified width 62→80, footer prop removed).
- [x] **T03: 03.1 03**
  - Wave 2: Rewrite CandidateSelect with full monocle contract and refactor run-foreground to modal-first async.

This is the core implementation wave. All locked decisions (D-01 through D-07) ship here.

CandidateSelect gains: nullable candidates prop (D-06), live search state (D-01/D-02), ┌> selection glyph (UI-SPEC), LoadingSpinner/SearchInput/ControlsLine composition, useEffect selectedIndex reset on candidates arrival (Pitfall 2 fix), null-guarded navigation handlers (Pitfall 3 fix).

run-foreground.ts gains: modal-first launch before fetchCandidates (D-05/D-07), rerender() pattern to push resolved candidates into the live modal (D-07), removal of fast-accept bypass (D-03), MODAL_CHROME_LINES=9 (Pitfall 1 fix), error state via rerender with error prop.

Purpose: Ship the complete monocle interface. After this wave, the vitest suite is fully green and manual TTY verification confirms the visual contract.
Output: CandidateSelect.tsx (rewritten), run-foreground.ts (refactored llm branch + renderModal).

## Files Likely Touched

- `vitest.config.ts`
- `tests/client-result.test.ts`
- `tests/candidate-select.test.tsx`
- `src/ui/Modal.tsx`
- `src/ui/SearchInput.tsx`
- `src/ui/ControlsLine.tsx`
- `src/ui/LoadingSpinner.tsx`
- `src/ui/CandidateSelect.tsx`
- `src/client/run-foreground.ts`
