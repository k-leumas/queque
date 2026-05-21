# T01: 02-intent-router-and-context-pipeline 01

**Slice:** S02 — **Milestone:** M001

## Description

Lock the typed request contracts and deterministic intent router before any provider or pipeline wiring begins.

Purpose: All Phase 2 work depends on stable contract types. Defining them first gives downstream plans a concrete API to implement against — no guessing shapes mid-execution.

Output:
- `src/contracts/request.ts` — all Phase 2 domain types as Zod schemas + inferred types
- `src/intent/router.ts` — `classifyIntent` pure synchronous function
- `tests/intent-router.test.ts` — TDD test file driving the router implementation (RED → GREEN), including edge-case table-driven tests for file-path detection

**Review changes (02-01):**
- HIGH: Added 15 table-driven edge-case tests for file-path detection covering relative paths, dotfiles, tilde paths, filenames with spaces, extensions without path separators.
- MEDIUM: `unknown` intent semantics are now explicit — `unknown` fires ONLY for the empty-string query. All non-empty queries fall through to `general` as the lowest-confidence fallback. This is documented in code and enforced by tests.
- MEDIUM: `^git\s` scope is explicitly documented — leading whitespace and `command git` patterns are out of scope for Phase 2 (the query is sourced from a ZLE lbuffer after the `??` trigger, which strips leading whitespace before sending; `command git` patterns are an explicit non-goal for v1).

## Must-Haves

- [ ] "Every shell request can be classified into exactly one intent category before any context gathering begins"
- [ ] "Base context fields (queryText, cwd, ttyPath, shellPid, shellName, platform, timestamp) are always derivable from a ShellRequest"
- [ ] "Intent classification is deterministic, synchronous, and makes zero I/O calls or LLM calls"
- [ ] "The D-01 rule holds: code verbs alone (fix, debug, refactor) without a file path signal do NOT produce codebase intent"
- [ ] "The D-02 rule holds: npm/pnpm/yarn script commands produce codebase intent even without a file path"
- [ ] "The D-03 rule holds: any query starting with 'git ' routes as shell-command but the signal is recorded for git provider gating later"
- [ ] "'unknown' intent fires ONLY for the empty-string query — all non-empty queries receive 'general' as the lowest-confidence fallback"

## Files

- `src/contracts/request.ts`
- `src/intent/router.ts`
- `tests/intent-router.test.ts`
