---
phase: 08-zero-config-install-and-provider-detection
plan: 01
subsystem: providers
tags: [claude-cli, detectProvider, keychain, darwin, vitest]

requires:
  - phase: 260522-vfd-prototype-provider-detection
    provides: detectProvider waterfall (ANTHROPIC_API_KEY → claude-cli → ollama → openai → none)
provides:
  - Platform-aware claudeAuthPresent() for macOS Keychain and setup-token env vars
  - Platform-split vitest coverage for claude-cli detection
affects:
  - 08-02-claude-cli-subprocess-adapter
  - resolver adapter wiring

tech-stack:
  added: []
  patterns:
    - "Presence-only Claude auth: env truthiness, darwin PATH gate, non-darwin credentials file stat — never read secrets or probe claude -p"

key-files:
  created: []
  modified:
    - src/providers/detect.ts
    - tests/provider-detect.test.ts

key-decisions:
  - "darwin treats claude on PATH as auth-present (Keychain); false positives fail at 08-02 request time"
  - "CLAUDE_CODE_OAUTH_TOKEN and ANTHROPIC_AUTH_TOKEN count as auth without reading values"

patterns-established:
  - "claudeAuthPresent() wraps env/platform/file checks; claudeOnPath() remains the outer gate"
  - "Mock process.platform via Object.defineProperty in provider-detect tests"

requirements-completed: [RUN-01, EXT-01]

duration: 2min
completed: 2026-07-31
---

# Phase 08 Plan 01: Platform-Aware Claude Auth Detection Summary

**Platform-aware `claudeAuthPresent()` so macOS Keychain `/login` users and setup-token env vars detect as `claude-cli` without reading secrets**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-31T23:38:53Z
- **Completed:** 2026-07-31T23:40:28Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Added `claudeAuthPresent()` covering setup-token env vars, darwin Keychain presence, and non-darwin credentials-file stat
- Wired Step 2 to use `claudeAuthPresent()` while keeping `claudeOnPath()` as the outer gate
- Clarified Step 5 `none` message to mention credentials file or macOS Keychain login
- Platform-split and env-token vitest coverage (12/12 green)

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Platform-aware claudeAuthPresent() + tests** - `284a2fa` (test)
2. **Task 1 (GREEN): implement claudeAuthPresent** - `ddad55b` (feat)

_Note: TDD task produced test → feat commits_

## Files Created/Modified
- `src/providers/detect.ts` - `claudeAuthPresent()`, Step 2 call site, clearer none message
- `tests/provider-detect.test.ts` - darwin/linux split, env-token cases, none-message assertion

## Decisions Made
- Darwin Keychain auth is presence-only via `process.platform === 'darwin'` after PATH check; no Keychain query and no `claude -p` during detection (preserves &lt; 200 ms / T-vfd-01)
- Env tokens tested for truthiness only; values never logged
- Non-darwin still requires credentials file unless a setup-token env var is set

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Detection returns `claude-cli` for macOS Keychain-style auth; 08-02 can wire the subprocess adapter and validate auth at call time
- Do not change resolver/adapter wiring in this plan (left for 08-02)

## Verification Results
- `pnpm vitest run tests/provider-detect.test.ts` — 12 passed
- `rg -n "claudeAuthPresent" src/providers/detect.ts` — definition + Step 2 call site present

## Self-Check: PASSED
- FOUND: `src/providers/detect.ts`, `tests/provider-detect.test.ts`
- FOUND: commits `284a2fa`, `ddad55b`

---
*Phase: 08-zero-config-install-and-provider-detection*
*Completed: 2026-07-31*
