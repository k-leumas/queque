---
slug: zellij-title-repeat
date: 2026-06-08
status: in-progress
---

# Quick Task: Fix repeating title in Zellij modal

## Problem

In the zellij floating pane, the `queque › <query>` title text visually repeats until
the candidates list finishes rendering. After candidates arrive, the title shows once
correctly. This is a cursor-position artifact caused by Ink's re-render cursor math
producing a different height during loading state vs. loaded state.

The title Box in `CandidateSelect.tsx` does not have `flexGrow={0}` set explicitly.
In yoga (Ink's layout engine), if the containing column flex box has extra height from
the terminal dimensions, the title Box may expand — causing the rendered height to be
larger on the first render than on subsequent ones. When Ink moves the cursor up by the
previous render height and the heights don't match, old content (including the title)
peeks through above the new render.

## Fix

Add `flexGrow={0}` to the title Box in `src/ui/CandidateSelect.tsx`.

**File:** `src/ui/CandidateSelect.tsx`
**Change:** Add `flexGrow={0}` prop to the `<Box>` wrapping the title Text at line 177.

Before:
```tsx
<Box>
  <Text dimColor>{`queque › ${initialQuery}`}</Text>
</Box>
```

After:
```tsx
<Box flexGrow={0}>
  <Text dimColor>{`queque › ${initialQuery}`}</Text>
</Box>
```

## Verification

- Build succeeds (`pnpm build`)
- Tests pass (`pnpm test`)
- Invoke `??` in a zellij floating pane; title should appear once and remain stable while spinner animates
