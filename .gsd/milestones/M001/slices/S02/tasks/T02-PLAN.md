# T02: 02-intent-router-and-context-pipeline 02

**Slice:** S02 — **Milestone:** M001

## Description

Build the two-pass context pipeline — base context always, intent-gated extras only when relevant — and rewire the foreground client and Claude adapter to consume the assembled ContextEnvelope instead of building context ad hoc.

Purpose: This is the core of Phase 2. After this plan, media/file tasks inside a git repo no longer receive git context, and the Claude adapter no longer owns VCS detection.

Output:
- `src/context/provider.ts` — ContextProvider interface + GatherContextInput type
- `src/context/base-context.ts` — `buildBaseContext` (synchronous, no I/O)
- `src/context/providers/git-context.ts` — git provider wrapping `detectVcsContext` + `changedFiles` with robust porcelain parsing
- `src/context/providers/filesystem-context.ts` — filesystem provider (string-parse only, no disk I/O)
- `src/context/pipeline.ts` — `gatherContext` orchestrating the two-pass pipeline
- `src/client/run-foreground.ts` — insert normalization + pipeline before provider call
- `src/providers/claude.ts` — accept ContextEnvelope, remove `detectVcsContext` import
- `tests/context-pipeline.test.ts` — TDD tests driving intent-gating behavior
- Updated `tests/claude-provider.test.ts` to match new `suggestShellResult` signature

**Review changes (02-02):**
- HIGH: `changedFiles` parsing rewritten — `line.slice(3)` replaced with a robust parser that handles renames (`R old -> new` extracts destination only), merge conflicts (two-char status prefix), untracked files (`??`), and paths with spaces. Dedicated test coverage added.
- HIGH: D-05 privacy enforcement is now structural: `contextChunkSchema` union (defined in 02-01) has no field for file content in any variant. This plan documents and tests that enforcement — acceptance criteria verify no content/bytes/text fields exist in any chunk reaching the prompt.
- MEDIUM: `rbuffer` as side parameter — kept as `rbuffer: string = ''` on `suggestShellResult`. This is the stable Phase 2 API seam. Rationale: `ContextEnvelope.base` does not carry `rbuffer` because it is shell transport state, not context. Phase 4 TUI will own buffer writing and can pass rbuffer explicitly. Documented in code comments.

## Must-Haves

- [ ] "Base context (queryText, cwd, ttyPath, shellPid, shellName, platform, timestamp) is always present in the context envelope regardless of intent"
- [ ] "Git context chunk is present ONLY when intent is 'codebase' OR when intent is 'shell-command' with a 'git-prefix' signal (D-09)"
- [ ] "Filesystem context chunk is present ONLY when intent is 'filesystem' — never leaks into codebase or shell-command requests (D-11)"
- [ ] "A 'rename hero.png' request from inside a git repo does NOT receive a git context chunk"
- [ ] "claude.ts no longer calls detectVcsContext directly — VCS data arrives only via the ContextEnvelope"
- [ ] "run-foreground.ts normalizes the ShellRequest into a NormalizedRequest before calling the context pipeline"
- [ ] "File content is never read or included in any context chunk (D-05, D-06)"
- [ ] "changedFiles parsing correctly handles renames (R old -> new), merge conflicts (MM prefix), and paths with spaces"
- [ ] "rbuffer is passed as an explicit second parameter to suggestShellResult — this is documented as the stable Phase 2 API seam"

## Files

- `src/context/provider.ts`
- `src/context/base-context.ts`
- `src/context/pipeline.ts`
- `src/context/providers/git-context.ts`
- `src/context/providers/filesystem-context.ts`
- `src/client/run-foreground.ts`
- `src/providers/claude.ts`
- `src/contracts/candidates.ts`
- `src/ui/CandidateSelect.tsx`
- `tests/context-pipeline.test.ts`
- `tests/claude-provider.test.ts`
