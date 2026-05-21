# S02: Intent Router And Context Pipeline

**Goal:** Lock the typed request contracts and deterministic intent router before any provider or pipeline wiring begins.
**Demo:** Lock the typed request contracts and deterministic intent router before any provider or pipeline wiring begins.

## Must-Haves


## Tasks

- [x] **T01: 02-intent-router-and-context-pipeline 01** `est:7min`
  - Lock the typed request contracts and deterministic intent router before any provider or pipeline wiring begins.

Purpose: All Phase 2 work depends on stable contract types. Defining them first gives downstream plans a concrete API to implement against — no guessing shapes mid-execution.

Output:
- `src/contracts/request.ts` — all Phase 2 domain types as Zod schemas + inferred types
- `src/intent/router.ts` — `classifyIntent` pure synchronous function
- `tests/intent-router.test.ts` — TDD test file driving the router implementation (RED → GREEN), including edge-case table-driven tests for file-path detection

**Review changes (02-01):**
- HIGH: Added 15 table-driven edge-case tests for file-path detection covering relative paths, dotfiles, tilde paths, filenames with spaces, extensions without path separators.
- MEDIUM: `unknown` intent semantics are now explicit — `unknown` fires ONLY for the empty-string query. All non-empty queries fall through to `general` as the lowest-confidence fallback. This is documented in code and enforced by tests.
- MEDIUM: `^git\s` scope is explicitly documented — leading whitespace and `command git` patterns are out of scope for Phase 2 (the query is sourced from a ZLE lbuffer after the `??` trigger, which strips leading whitespace before sending; `command git` patterns are an explicit non-goal for v1).
- [x] **T02: 02-intent-router-and-context-pipeline 02** `est:26min`
  - Build the two-pass context pipeline — base context always, intent-gated extras only when relevant — and rewire the foreground client and Claude adapter to consume the assembled ContextEnvelope instead of building context ad hoc.

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
- [x] **T03: 02-intent-router-and-context-pipeline 03** `est:11min`
  - Add four internal registries (context-providers, provider-backends, shell-adapters, storage-hooks), an explicit bootstrap module, and wire the built-in providers through the registry so future extensions use the same path instead of bypassing the architecture.

Purpose: EXT-01 requires that extension seams exist and that built-ins use them. Without this plan, the pipeline hardcodes imports directly and future plugin work would require refactors instead of additions.

Output:
- Four registry modules following the same Map + register/get/list/clear pattern
- `src/registry/bootstrap.ts` — single explicit call to register all Phase 2 built-ins (replaces side-effect imports)
- `gatherContext` reads providers from the registry instead of the hardcoded array, calls `bootstrapBuiltins()` at startup
- `tests/registry.test.ts` — TDD tests driving registry behavior
- `tests/registry-bootstrap.test.ts` — startup assertion test

**Review changes (02-03):**
- HIGH: Four registries risk is addressed: three non-context-provider registries are explicitly marked as Phase 2 stubs with `STUB` in their module header comment and a brief justification for why the seam exists in Phase 2 even though no runtime behavior uses it yet. The context-providers registry is fully exercised by actual runtime behavior.
- MEDIUM: Side-effect imports replaced with an explicit bootstrap module. `bootstrapBuiltins()` registers all built-ins in one inspectable, grep-friendly location. No hidden initialization ordering — pipeline calls `bootstrapBuiltins()` once at startup.
- MEDIUM: All four registries expose a `clear()` function for test isolation, removing the need for `vi.resetModules()` in tests (which creates module-graph churn).

## Files Likely Touched

- `src/contracts/request.ts`
- `src/intent/router.ts`
- `tests/intent-router.test.ts`
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
- `src/registry/context-providers.ts`
- `src/registry/provider-backends.ts`
- `src/registry/shell-adapters.ts`
- `src/registry/storage-hooks.ts`
- `src/registry/bootstrap.ts`
- `src/context/pipeline.ts`
- `tests/registry.test.ts`
- `tests/registry-bootstrap.test.ts`
