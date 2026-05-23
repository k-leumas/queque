---
phase: quick
plan: 260522-vfd
subsystem: providers
tags: [provider-detection, multi-provider, debug-logging, vitest]
dependency_graph:
  requires: [src/providers/provider.ts, src/shared/debug-log.ts, src/client/run-foreground.ts]
  provides: [src/providers/detect.ts, src/providers/index.ts]
  affects: [src/client/run-foreground.ts]
tech_stack:
  added: []
  patterns: [discriminated-union, waterfall-detection, vi.hoisted-mocking]
key_files:
  created:
    - src/providers/detect.ts
    - src/providers/index.ts
    - tests/provider-detect.test.ts
  modified:
    - src/client/run-foreground.ts
decisions:
  - Use execSync('which claude') with stdio:'pipe' for silent PATH check
  - Stat both .credentials.json paths as fallback chain for Claude CLI auth detection
  - AbortSignal.timeout(300) hard-caps Ollama health check — no AbortController needed
  - DOMException('msg', 'AbortError') constructor sets .name correctly (Object.assign breaks on read-only getter)
metrics:
  duration: "3 minutes"
  completed: "2026-05-23T05:46:14Z"
  tasks_completed: 3
  files_changed: 4
---

# Phase quick Plan 260522-vfd: Prototype Provider Detection Summary

5-step provider detection waterfall (anthropic-key, claude-cli, ollama, openai-key, none) with typed discriminated union, 7 vitest unit tests covering all branches, and wired debug logging in the foreground client.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Implement DetectedProvider type and detectProvider() waterfall | 1147fbe | src/providers/detect.ts, src/providers/index.ts |
| 2 | Vitest unit tests for all 5 detection branches | 99bd94e | tests/provider-detect.test.ts |
| 3 | Wire detectProvider() into run-foreground.ts | 1a66b8b | src/client/run-foreground.ts |

## What Was Built

`detectProvider()` runs a short-circuit waterfall:

1. **anthropic-key** — `process.env.ANTHROPIC_API_KEY` is truthy
2. **claude-cli** — `execSync('which claude')` succeeds AND `~/.claude/.credentials.json` (or `credentials.json`) exists
3. **ollama** — `fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(300) })` returns ok
4. **openai-key** — `process.env.OPENAI_API_KEY` is truthy
5. **none** — nothing matched

All 7 test branches pass. The full test suite (139 tests, 13 files) passes with no regressions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DOMException AbortError test construction**
- **Found during:** Task 2 (test run)
- **Issue:** `Object.assign(new DOMException(...), { name: 'AbortError' })` throws `TypeError: Cannot set property name of [DOMException] which has only a getter`
- **Fix:** Used `new DOMException('msg', 'AbortError')` constructor — the second argument sets the name correctly
- **Files modified:** tests/provider-detect.test.ts
- **Commit:** 99bd94e

## Verification Results

- TypeScript compiles cleanly (no errors in detect.ts or index.ts)
- `pnpm vitest run tests/provider-detect.test.ts`: 7/7 tests pass
- Full suite: 139/139 tests pass across 13 files
- `detectProvider` import confirmed in run-foreground.ts at lines 11 and 97

## Known Stubs

None — no stub patterns found in created/modified files.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes outside the plan's threat model.

## Self-Check: PASSED

- [x] src/providers/detect.ts exists
- [x] src/providers/index.ts exists
- [x] tests/provider-detect.test.ts exists
- [x] Commits 1147fbe, 99bd94e, 1a66b8b all exist in git log
