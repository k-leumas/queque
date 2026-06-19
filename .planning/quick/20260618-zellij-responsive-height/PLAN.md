# Quick Task: Zellij responsive modal height

Resize the Zellij floating pane to fit CandidateSelect content, capped at `QQ_PANE_HEIGHT`.

## Approach

1. Pure `estimateCandidateSelectLines()` mirroring Ink layout
2. `syncZellijFloatingPaneHeight()` calls `zellij action change-floating-pane-coordinates`
3. Wire via `onLayoutLinesChange` from `run-foreground` when `ZELLIJ` is set
4. Export `QQ_PANE_HEIGHT` from `queque.zsh` for the client cap

## Acceptance

- Loading spinner uses compact pane height
- Pane grows/shrinks as candidates, filter, and selection change
- Never exceeds `QQ_PANE_HEIGHT`
