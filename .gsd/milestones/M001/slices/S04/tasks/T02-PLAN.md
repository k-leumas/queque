# T02: 03.1 02

**Slice:** S04 — **Milestone:** M001

## Description

Wave 1: Create three new UI support components and update Modal's default width.

These are the dependency primitives that CandidateSelect (Wave 2) will import. They must exist — with correct interfaces and visual contracts — before CandidateSelect can be updated.

Purpose: Establish the shared visual vocabulary: monocle glyphs, ANSI 256 palette, search row contract, controls footer, and animated spinner.
Output: SearchInput.tsx, ControlsLine.tsx, LoadingSpinner.tsx (new); Modal.tsx (modified width 62→80, footer prop removed).

## Must-Haves

- [ ] "Modal renders at 80 columns (not 62)"
- [ ] "SearchInput renders 'SEARCH: ' label in cyan bold + query text or dimColor placeholder"
- [ ] "ControlsLine renders key badges with ansi256(238) background and action text with ansi256(245) background"
- [ ] "LoadingSpinner cycles through dot frames at 200ms intervals and clears its timer on unmount"
- [ ] "All new files use named exports and .js import path suffixes"

## Files

- `src/ui/Modal.tsx`
- `src/ui/SearchInput.tsx`
- `src/ui/ControlsLine.tsx`
- `src/ui/LoadingSpinner.tsx`
