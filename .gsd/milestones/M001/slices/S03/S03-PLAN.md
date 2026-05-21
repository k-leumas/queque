# S03: Claude Fast Path And Ranked Suggestions

**Goal:** Stand up the formal LLMAdapter contract, implement Claude behind it, and simplify model selection.
**Demo:** Stand up the formal LLMAdapter contract, implement Claude behind it, and simplify model selection.

## Must-Haves


## Tasks

- [x] **T01: 03 01** `est:15min`
  - Stand up the formal LLMAdapter contract, implement Claude behind it, and simplify model selection. Also extend shellResultSchema with the error variant (required by Plan 02 for writeShellResult to accept error results without code changes). Run updated tests that go RED first (Wave 0 TDD obligation) then GREEN after implementation.

Purpose: Establish the provider abstraction (PRV-02, PRV-03) and Claude's wiring to it (PRV-01, CMD-01, CMD-02). The shellResultSchema extension in this plan unblocks Plan 02 (error kind write path) and Plan 03 (ZSH widget) in parallel.
Output: src/providers/provider.ts (new), claude.ts refactored, shellResultSchema extended, tests updated and green.
- [x] **T02: 03 02**
  - Wire the confidence field from classifyIntent into NormalizedRequest, change the run-foreground outer catch from writing cancel to writing a typed error ShellResult, and register the Claude backend descriptor in bootstrapBuiltins. Add the client-result test proving error propagation.

Purpose: SAFE-01 (errors surface without mutating shell buffer via typed error kind), PRV-02 (provider registration through bootstrap). Confidence field is needed for Phase 5's 0.8 routing gate (INT-04) — adding it now avoids a schema migration later.
Output: Updated request.ts, run-foreground.ts, bootstrap.ts, and client-result test green.
- [x] **T03: 03 03**
  - Add the `error)` case to both the `_qq_apply_result` helper function and the `qq-question-widget` inline case block in qq.zsh. Add a test to zsh-widget.test.ts verifying that _qq_apply_result no-ops buffer mutation on error kind.

Purpose: SAFE-01 — the shell buffer must never be mutated when the provider returns an error. The error ShellResult written by Plan 02 reaches the ZSH widget via FIFO; the widget must handle it by restoring original buffers and returning control to the user. Both case blocks must be updated because they serve different code paths (tests use _qq_apply_result; runtime uses qq-question-widget inline block).
Output: qq.zsh with explicit error handling, zsh-widget.test.ts with new test, full suite green.

## Files Likely Touched

- `tests/claude-provider.test.ts`
- `tests/shell-contract.test.ts`
- `src/contracts/shell.ts`
- `src/providers/provider.ts`
- `src/providers/claude.ts`
- `src/contracts/request.ts`
- `src/client/run-foreground.ts`
- `src/registry/bootstrap.ts`
- `tests/client-result.test.ts`
- `shell/zsh/qq.zsh`
- `tests/zsh-widget.test.ts`
