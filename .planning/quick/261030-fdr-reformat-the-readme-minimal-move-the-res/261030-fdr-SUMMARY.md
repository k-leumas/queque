---
phase: quick-261030-fdr
plan: 01
subsystem: docs
status: complete
tags: [readme, docs, links, telemetry, privacy]
requires: []
provides:
  - minimal README (H1, badges, pitch, gif, Install, Choose a provider, Usage, More)
  - docs/INSTALL.md, docs/PROVIDERS.md, docs/USAGE.md, docs/PRIVACY.md, docs/CONFIGURATION.md
  - tests/docs-links.test.ts link and anchor guard
affects: [README.md, CONTRIBUTING.md, docs/SYSTEM_DESIGN.md]
tech-stack:
  added: []
  patterns:
    - README links repo docs through absolute https://github.com/k-leumas/queque/blob/main/ URLs
    - docs-to-docs and CONTRIBUTING links stay relative
key-files:
  created:
    - docs/INSTALL.md
    - docs/PROVIDERS.md
    - docs/USAGE.md
    - docs/PRIVACY.md
    - docs/CONFIGURATION.md
    - tests/docs-links.test.ts
    - .planning/quick/261030-fdr-reformat-the-readme-minimal-move-the-res/check-readme-moved.mjs
  modified:
    - README.md
    - CONTRIBUTING.md
    - docs/SYSTEM_DESIGN.md
    - .wolf/anatomy.md
    - .wolf/memory.md
    - .wolf/cerebrum.md
decisions:
  - README links to docs are absolute GitHub blob URLs because npm ships README.md without docs/
  - Old sections were moved by line-range copy (sed) so the docs text is byte-identical to b45f6db apart from link targets and heading level
metrics:
  duration: ~10 min
  completed: 2026-10-30
actuals:
  tokens: 8600
  tasks: 3
  commits: 3
plan_head_before: b43fcbd33cef2ed41a1c9ef9a37b344d8b1e6d21
plan_head_after: c857dbe
---

# Quick 261030-fdr Plan 01: Minimal README with docs split Summary

README.md is now 66 lines: the H1, the unchanged badge block, the Before/Now pitch, the demo gif, Install (brew first, then npm), Choose a provider, Usage and a More list. Everything else moved verbatim into five docs pages. A new vitest link guard checks every relative link and anchor, and requires the README to use absolute GitHub URLs.

## Tasks

| Task | Commit | What |
|------|--------|------|
| 1 (tracer) | b37be9f | tests/docs-links.test.ts (red for the four expected reasons, then green); Choose a provider moved to docs/PROVIDERS.md; CONTRIBUTING anchors repointed (README#authentication was broken); six docs/SYSTEM_DESIGN.md source links fixed with `../` |
| 2 | e8f0654 | docs/INSTALL.md, docs/USAGE.md, docs/CONFIGURATION.md; README Install and Usage steps; duplicate tagline and inline brew line dropped |
| 3 | c857dbe | docs/PRIVACY.md with a source-checked Anonymous telemetry section; README More list finished; check-readme-moved.mjs passes (98 lines checked against b45f6db) |

## Verification

- `pnpm exec vitest run tests/docs-links.test.ts tests/readme-badges.test.ts`: 8/8 passed
- `node .planning/quick/261030-fdr-reformat-the-readme-minimal-move-the-res/check-readme-moved.mjs`: ok, all 98 checked lines present
- README.md: 66 lines, `copy-pasting` once, no `QQ_DEBUG_LOG_FILE`, `QQ_PANE_WIDTH` or `sensitivePathPatterns`; badge lines 3 to 12 unchanged against b45f6db
- `pnpm exec tsc --noEmit` and `pnpm exec biome check tests/docs-links.test.ts`: clean
- Every telemetry claim in docs/PRIVACY.md was checked against src/client/telemetry-consent.ts, src/shared/telemetry-config.ts, src/cli/commands/telemetry.ts, src/client/telemetry-events.ts, src/daemon/telemetry-buffer.ts, src/shared/telemetry-endpoint.ts, src/contracts/telemetry.ts, src/client/run-foreground.ts and tsup.config.ts

## Deviations from Plan

1. **[Rule 2, accuracy] The telemetry section says more than the plan's expected points, because the source says it.** The consent question is also skipped inside Zellij and when the answer cannot be saved (src/client/run-foreground.ts). The environment event is skipped when it matches the last one the daemon buffered. A build without a PostHog project key sends nothing. The current tsup.config.ts bakes an empty key.
2. **Tooling: OpenWolf hook writes went to the main checkout.** Edit/Write calls in this worktree triggered OpenWolf's post-write hook. That hook appended entries with `.claude/worktrees/agent-acf881fce15f7602f/...` paths to the main checkout's `/Users/samuel/dev/tui-llm/.wolf/anatomy.md` and `memory.md`. It did not write to the worktree's `.wolf/`. I did not change the main checkout because it is outside the worktree. The worktree's own `.wolf/buglog.json` was not changed, so it was not committed.
3. The timestamps on the three `.wolf/memory.md` lines (11:25, 11:35, 11:50) are estimates and are later than the real times (about 11:15 to 11:23).

## Known Stubs

None.

## Self-Check: PASSED

- All created files exist: docs/INSTALL.md, docs/PROVIDERS.md, docs/USAGE.md, docs/PRIVACY.md, docs/CONFIGURATION.md, tests/docs-links.test.ts, check-readme-moved.mjs
- Commits b37be9f, e8f0654 and c857dbe are ancestors of HEAD; none has a Co-Authored-By trailer
