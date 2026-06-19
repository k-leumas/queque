---
status: complete
---

# Quick Task: Zellij responsive modal height

Zellij floating pane height now tracks CandidateSelect content via `zellij action change-floating-pane-coordinates`, capped at `QQ_PANE_HEIGHT`.

## Changes

- `src/ui/modal-layout.ts` — `wrapText`, `estimateCandidateSelectLines`
- `src/client/zellij-pane-resize.ts` — resize helper + config cap
- `src/ui/CandidateSelect.tsx` — `onLayoutLinesChange` callback
- `src/client/run-foreground.ts` — wire resize in Zellij branch
- `shell/zsh/queque.zsh` — export `QQ_PANE_WIDTH` / `QQ_PANE_HEIGHT`
- `tests/modal-layout.test.ts`, `tests/zellij-pane-resize.test.ts`

## Verification

`pnpm test:run tests/modal-layout.test.ts tests/zellij-pane-resize.test.ts tests/candidate-select.test.tsx` — pass
