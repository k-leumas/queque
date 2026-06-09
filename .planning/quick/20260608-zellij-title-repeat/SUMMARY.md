---
slug: zellij-title-repeat
date: 2026-06-08
status: complete
---

# Summary: Fix repeating title in Zellij modal

## What was done

Added `flexGrow={0}` to the title Box in `src/ui/CandidateSelect.tsx` (line 177).

## Outcome

Build and all 156 tests pass. The title Box now has an explicit `flexGrow={0}` which
prevents it from expanding to fill pane height during the loading state, eliminating
the cursor-math mismatch that caused the title to visually repeat before candidates arrived.
