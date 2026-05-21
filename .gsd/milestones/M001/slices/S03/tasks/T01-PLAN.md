# T01: 03 01

**Slice:** S03 — **Milestone:** M001

## Description

Stand up the formal LLMAdapter contract, implement Claude behind it, and simplify model selection. Also extend shellResultSchema with the error variant (required by Plan 02 for writeShellResult to accept error results without code changes). Run updated tests that go RED first (Wave 0 TDD obligation) then GREEN after implementation.

Purpose: Establish the provider abstraction (PRV-02, PRV-03) and Claude's wiring to it (PRV-01, CMD-01, CMD-02). The shellResultSchema extension in this plan unblocks Plan 02 (error kind write path) and Plan 03 (ZSH widget) in parallel.
Output: src/providers/provider.ts (new), claude.ts refactored, shellResultSchema extended, tests updated and green.

## Must-Haves

- [ ] "src/providers/provider.ts exports a LLMAdapter interface with a single fetchCandidates method"
- [ ] "src/providers/claude.ts exports claudeAdapter satisfying LLMAdapter and fetchCandidates as a named function"
- [ ] "claude.ts resolves model from QQ_MODEL env or DEFAULT_MODEL constant (no runtime API poll)"
- [ ] "shellResultSchema accepts error kind with message string"
- [ ] "tests/claude-provider.test.ts has no modelListMock references and asserts default model is claude-haiku-4-5-20251001"
- [ ] "tests/shell-contract.test.ts has positive test for error ShellResult variant"
- [ ] "pnpm test:run passes green after all changes in this plan"

## Files

- `tests/claude-provider.test.ts`
- `tests/shell-contract.test.ts`
- `src/contracts/shell.ts`
- `src/providers/provider.ts`
- `src/providers/claude.ts`
