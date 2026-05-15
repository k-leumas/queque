---
phase: 03-claude-fast-path-and-ranked-suggestions
plan: 01
subsystem: providers
tags: [typescript, zod, anthropic, llm-adapter, vitest, tdd]

# Dependency graph
requires:
  - phase: 02-intent-router-and-context-pipeline
    provides: ContextEnvelope, CandidateList, candidateListSchema
provides:
  - LLMAdapter interface (src/providers/provider.ts)
  - Claude implementation behind LLMAdapter (claudeAdapter export)
  - fetchCandidates named function for backward compat
  - shellResultSchema error variant (kind: 'error', message: string)
affects:
  - 03-02 (error kind write path in run-foreground.ts)
  - 03-03 (ZSH widget error case handling)
  - any future provider implementation (implements LLMAdapter)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - LLMAdapter interface pattern (single method, import type, .js extension, no default export)
    - resolveModel() env-var-then-dotenv pattern (same as shouldForceSelector)
    - claudeAdapter named const implementing LLMAdapter with standalone function export

key-files:
  created:
    - src/providers/provider.ts
  modified:
    - src/providers/claude.ts
    - src/contracts/shell.ts
    - tests/claude-provider.test.ts
    - tests/shell-contract.test.ts

key-decisions:
  - "claude-haiku-4-5-20251001 is the hardcoded default model (no runtime API poll)"
  - "QQ_MODEL env or .env.local overrides model selection"
  - "suggestShellResult deleted — zero callers confirmed; fetchCandidates is the provider boundary"
  - "claudeAdapter exported as named const implementing LLMAdapter for registry binding"
  - "shellResultSchema error variant uses message string only (no executable payload)"

patterns-established:
  - "LLMAdapter: single-method provider interface following ContextProvider analog pattern"
  - "resolveModel: process.env.QQ_MODEL ?? readEnvValueFromDotEnvLocal('QQ_MODEL') ?? DEFAULT_MODEL"

requirements-completed: [PRV-01, PRV-02, PRV-03, CMD-01, CMD-02]

# Metrics
duration: 15min
completed: 2026-05-15
---

# Phase 03 Plan 01: LLMAdapter Contract, Claude Fast Path, and shellResultSchema Error Variant Summary

**LLMAdapter interface established, Claude refactored to haiku-4-5 default without model polling, and shellResultSchema extended with error variant**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-15T04:32:00Z
- **Completed:** 2026-05-15T04:37:00Z
- **Tasks:** 3 (TDD: RED → GREEN)
- **Files modified:** 5

## Accomplishments

- Created `src/providers/provider.ts` with `LLMAdapter` interface (single `fetchCandidates` method, import-type only)
- Refactored `claude.ts`: removed model-list polling, replaced with `resolveModel()` using `claude-haiku-4-5-20251001` default or `QQ_MODEL` env override
- Deleted `suggestShellResult` (zero callers), added `claudeAdapter: LLMAdapter` named const export
- Extended `shellResultSchema` with `error` variant (`{ kind: 'error', message: string }`)
- Tests updated: removed `modelListMock` entirely, added QQ_MODEL override test, error variant positive/negative tests — all 112 tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: Update failing tests (RED)** - `353655c` (test)
2. **Task 2: Create LLMAdapter interface** - `dc14eec` (feat)
3. **Task 3: Refactor claude.ts + extend shellResultSchema (GREEN)** - `330c416` (feat)

## Files Created/Modified

- `src/providers/provider.ts` — New file: `LLMAdapter` interface with `fetchCandidates(envelope: ContextEnvelope): Promise<CandidateList>`
- `src/providers/claude.ts` — Removed model polling loop, added `resolveModel()`, deleted `suggestShellResult`, added `claudeAdapter` export, updated system prompt
- `src/contracts/shell.ts` — Added `error` variant to `shellResultSchema` discriminated union
- `tests/claude-provider.test.ts` — Removed `modelListMock`, added `QQ_MODEL` override test, updated model assertion to `claude-haiku-4-5-20251001`
- `tests/shell-contract.test.ts` — Added two error variant tests (positive + missing message)

## Decisions Made

- `claude-haiku-4-5-20251001` as default: fast, cheap, no API poll needed at cold start
- `suggestShellResult` deleted rather than deprecated: confirmed zero external callers via grep
- `claudeAdapter` as named const (not class): matches standalone function export, minimal overhead
- `fetchCandidates` kept as named export for backward compatibility with `run-foreground.ts` direct import

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Vitest requires running from worktree directory with `--root` flag since worktree shares node_modules with main repo but has its own test files; used `"$ROOT/node_modules/.bin/vitest" run --root "$WT"` pattern successfully

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 02 is unblocked: `shellResultSchema` error variant enables `writeShellResult` to accept `{ kind: 'error' }` without schema changes
- Plan 03 is unblocked: ZSH widget can now handle the `error` kind returned in FIFO
- `claudeAdapter` exported and typed as `LLMAdapter` — ready for `registerProviderBackend` wiring in bootstrap
- All 112 tests green; full suite passes

---
*Phase: 03-claude-fast-path-and-ranked-suggestions*
*Completed: 2026-05-15*
