---
id: T02
parent: S02
milestone: M001
provides:
  - two-pass context assembly with intent-gated extras
  - git and filesystem context providers with privacy-safe payloads
  - Claude prompt rewired to consume ContextEnvelope instead of direct VCS detection
  - multi-candidate command response plus minimal keyboard selection UI
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 26min
verification_result: passed
completed_at: 2026-05-02
blocker_discovered: false
---
# T02: 02-intent-router-and-context-pipeline 02

**# Phase 02 Plan 02: Context pipeline and candidate selection Summary**

## What Happened

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
