---
id: S02
parent: M001
milestone: M001
provides:
  - typed phase 2 request and context schemas
  - deterministic classifyIntent router with signal metadata
  - edge-case coverage for git, shell, filesystem, and file-path routing
  - two-pass context assembly with intent-gated extras
  - git and filesystem context providers with privacy-safe payloads
  - Claude prompt rewired to consume ContextEnvelope instead of direct VCS detection
  - multi-candidate command response plus minimal keyboard selection UI
  - explicit registries for context providers, provider backends, shell adapters, and storage hooks
  - single bootstrap module for built-in descriptor registration
  - pipeline provider lookup through registry instead of hardcoded imports
requires: []
affects: []
key_files: []
key_decisions:
  - Intent classification remains fully synchronous and local, with no I/O or provider calls.
  - unknown intent is reserved for empty or whitespace-only queries; all other unmatched queries fall back to general.
  - Filesystem keywords route before generic file-path detection so rename/find prompts stay out of codebase intent.
  - Git context is only gathered for codebase requests and git-prefixed shell commands; filesystem requests never inherit repo state.
  - changedFiles parsing records rename destinations only and never reads file content.
  - Candidate selection is kept minimal in Phase 2 with raw arrow-key navigation instead of bringing in a larger selector dependency.
  - Bootstrap is the single source of truth for built-in registrations; provider modules do not self-register.
  - Three non-context registries remain Phase 2 stubs but exist now so later phases extend seams instead of refactoring architecture.
  - Registry clear/reset helpers are internal test utilities, not production runtime controls.
patterns_established:
  - Phase 2 contracts export Zod schemas and inferred types only, with no runtime logic in contract modules.
  - Intent routing records signal strings alongside intent and confidence for downstream debug and provider gating.
  - Provider gather functions return privacy-safe ContextChunk values or null; pipeline silently skips nulls.
  - Claude prompt building now depends only on ContextEnvelope plus side-channel rbuffer transport state.
  - Built-ins register through explicit bootstrap rather than module-load side effects.
  - Registries reject duplicate ids with user-readable errors that name the conflicting descriptor.
observability_surfaces: []
drill_down_paths: []
duration: 11min
verification_result: passed
completed_at: 2026-05-02
blocker_discovered: false
---
# S02: Intent Router And Context Pipeline

**# Phase 02 Plan 01: Intent contracts and deterministic routing Summary**

## What Happened

# Phase 02 Plan 01: Intent contracts and deterministic routing Summary

**Zod-backed request/context contracts with a pure classifyIntent router covering git, package-manager, filesystem, shell, and fallback request classes**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-02T16:54:30Z
- **Completed:** 2026-05-02T17:00:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added the full Phase 2 request contract surface in `src/contracts/request.ts`, including base context, intent decisions, and privacy-safe context chunks.
- Implemented `classifyIntent` as a deterministic synchronous router with explicit signal metadata and empty-query handling.
- Locked the routing behavior down with 28 Vitest cases covering D-01, D-02, D-03, file-path edge cases, and fallback semantics.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define request contracts** - `9b96f9b` (feat)
2. **Task 2 RED: Add failing router tests** - `3f28d1e` (test)
3. **Task 2 GREEN: Implement classifyIntent router** - `3e0b195` (feat)

## Files Created/Modified
- `src/contracts/request.ts` - Exports the typed request, context, and intent decision schemas for Phase 2.
- `src/intent/router.ts` - Implements the pure intent classifier and its signal-detection rules.
- `tests/intent-router.test.ts` - Verifies routing behavior across core rules and edge cases.

## Decisions Made
- Routed filesystem-keyword prompts before generic file-path detection so rename/find requests with filenames classify as `filesystem`, matching the explicit tests and user-facing intent.
- Used `requestIntentSchema.enum` inside the router to keep runtime values anchored to the Zod enum contract.
- Kept shell-command detection ahead of generic file-path detection so literal commands like `ls ./foo.txt` and `cat package.json` stay in `shell-command`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Bypassed broken Homebrew Node/pnpm shims during verification**
- **Found during:** Task 1 verification and Task 2 verification
- **Issue:** `pnpm` resolved through `/usr/local/opt/node/bin/node`, which crashed with `Library not loaded: /usr/local/opt/llhttp/lib/libllhttp.9.3.dylib`.
- **Fix:** Ran `vitest` and `tsc` through the NVM-backed Node binary and Corepack `pnpm.js` entrypoint instead of the broken Homebrew shim.
- **Files modified:** None
- **Verification:** `vitest run tests/intent-router.test.ts` and `tsc --noEmit` both completed successfully through the NVM-backed command path.
- **Committed in:** None (environment-only workaround)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope creep. The workaround only affected local verification commands.

## Issues Encountered
- Running `pnpm` directly mutated `pnpm-lock.yaml` via a different resolver path. That generated diff was removed so the plan stayed scoped to the owned files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 2 now has stable request and routing contracts for the base-context builder and context pipeline work in `02-02`.
- The environment still has a broken Homebrew Node/pnpm shim, so future verification should keep using the NVM/Corepack path until that local install is repaired.

## Self-Check: PENDING

---
*Phase: 02-intent-router-and-context-pipeline*
*Completed: 2026-05-02*

# Phase 02 Plan 02: Context pipeline and candidate selection Summary

**Two-pass context assembly now gates git/filesystem extras by intent, and the foreground client can return ranked command candidates through a minimal selector.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-05-02T17:03:00Z
- **Completed:** 2026-05-02T17:29:00Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Added the full Phase 2 context layer: base context builder, provider contract, git/filesystem providers, and `gatherContext()` orchestration.
- Removed direct VCS detection from `src/providers/claude.ts`; provider prompts now consume a `ContextEnvelope` and return ranked command candidates.
- Rewired the foreground client to classify intent, gather context, fetch candidates, and show a minimal arrow-key selector when more than one command is returned.
- Added direct coverage for porcelain parsing edge cases, context gating, Claude candidate parsing, and the end-to-end client result path.

## Task Commits

1. **Context pipeline, provider rewiring, and candidate selector** - `3ed1520` (feat)
2. **Replace temporary React shim with real type package** - `d03f499` (chore)

## Files Created/Modified

- `src/context/*` - New Phase 2 context pipeline and provider modules.
- `src/providers/claude.ts` - Reworked to build prompts from `ContextEnvelope` and return candidate lists.
- `src/client/run-foreground.ts` - Now classifies, gathers context, fetches candidates, and conditionally renders a selector.
- `src/contracts/candidates.ts` - Shared candidate contract for provider/client/UI handoff.
- `src/ui/CandidateSelect.ts` - Minimal arrow-key selection UI for multi-candidate responses.
- `tests/context-pipeline.test.ts` and `tests/porcelain-parser.test.ts` - Coverage for intent gating and robust git status parsing.

## Verification

Executed on the NVM/Corepack toolchain because the Homebrew `pnpm` shim remains broken on this machine:

- `~/.nvm/versions/node/v24.14.1/bin/corepack pnpm test:run tests/context-pipeline.test.ts tests/porcelain-parser.test.ts tests/claude-provider.test.ts tests/client-result.test.ts`
- `~/.nvm/versions/node/v24.14.1/bin/corepack pnpm typecheck`

Results:

- 22 targeted tests passed.
- TypeScript compiled cleanly after replacing the temporary local React type shim with `@types/react`.

## Decisions Made

- Kept Phase 2 provider payloads metadata-only: file names and git status data are allowed, file contents are not.
- Used a small in-repo Ink selector built on `useInput` instead of introducing another UI dependency mid-phase.
- Preserved `rbuffer` as shell transport state outside the context envelope so prompt context stays semantic rather than buffer-mechanical.

## Deviations from Plan

### Auto-fixed Issues

**1. React types were missing from the repo’s declared devDependencies**
- **Found during:** Phase 2 typecheck
- **Issue:** the new selector component needed explicit React typing, but the repo had no `@types/react` declaration package.
- **Fix:** added `@types/react` to devDependencies and regenerated the lockfile, then removed the temporary local declaration shim.
- **Committed in:** `d03f499`

## Next Phase Readiness

- `02-03` can now move the hard-coded provider list into registries without changing the context provider contract.
- The foreground client already speaks in candidates and explicit selection, which gives later phases a stable UI/adapter seam instead of another request/response rewrite.

## Self-Check: PASSED

---
*Phase: 02-intent-router-and-context-pipeline*
*Completed: 2026-05-02*

# Phase 02 Plan 03: Registry bootstrap Summary

**Phase 2 now routes built-in context providers through explicit registries and a single bootstrap module, closing the extension seam requirement without changing provider behavior.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-05-02T17:30:00Z
- **Completed:** 2026-05-02T17:41:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added four internal registries with duplicate-id protection and internal clear helpers for test isolation.
- Introduced `bootstrapBuiltins()` so built-in providers and stub descriptors register through one explicit path.
- Rewired `gatherContext()` to read providers from the registry instead of a hardcoded array.
- Added startup assertion coverage proving the required Phase 2 built-ins are registered and bootstrap remains idempotent.

## Task Commits

1. **Registry modules, bootstrap wiring, and tests** - `a8b8e02` (feat)

## Verification

- `~/.nvm/versions/node/v24.14.1/bin/corepack pnpm test:run tests/registry.test.ts tests/registry-bootstrap.test.ts tests/context-pipeline.test.ts tests/intent-router.test.ts tests/claude-provider.test.ts`
- `~/.nvm/versions/node/v24.14.1/bin/corepack pnpm typecheck`

Results:

- 58 targeted tests passed.
- TypeScript compiled cleanly.

## Decisions Made

- Kept provider-backend, shell-adapter, and storage-hook registries as documented stubs rather than inventing fake runtime behavior in Phase 2.
- Used `bootstrapBuiltins()` as the single grep-friendly registration point so future built-ins and plugin seams remain inspectable.
- Preserved provider module purity by keeping registration out of module top-level execution.

## Next Phase Readiness

- Phase 3 can register provider backends through the existing seam instead of hardcoding Claude-specific paths.
- Future shell adapters and storage hooks can attach through registry APIs without touching context-pipeline internals.

## Self-Check: PASSED

---
*Phase: 02-intent-router-and-context-pipeline*
*Completed: 2026-05-02*
