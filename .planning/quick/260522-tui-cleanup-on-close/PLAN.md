---
slug: tui-cleanup-on-close
date: 2026-05-22
status: in_progress
---

# Quick Task: TUI Cleanup on Close

## Goal

When the terminal/zsh session closes while the Ink TUI is rendering, the process receives
SIGHUP (terminal hangup) or SIGTERM and exits immediately. Ink never calls `app.unmount()`,
so the candidate list, search box, and cursor artifacts remain visible on screen.

Fix: register SIGHUP + SIGTERM handlers inside the `new Promise<void>` block (after `render()`
returns), so the Ink app is cleanly unmounted before the process exits.

## File

`src/client/run-foreground.ts` — the only change needed

## Change

After `unmount` is assigned post-`render()`, add:

```typescript
const cleanupOnSignal = () => {
  app.unmount();
  process.exit(0);
};
process.once('SIGHUP', cleanupOnSignal);
process.once('SIGTERM', cleanupOnSignal);
```

Also update `unmount` to deregister the signal handlers on normal exit:

```typescript
unmount = () => {
  process.off('SIGHUP', cleanupOnSignal);
  process.off('SIGTERM', cleanupOnSignal);
  app.unmount();
  resolve();
};
```

## Tests

No new tests needed — signal handlers are a process-level side effect.
132 existing tests must remain green.
