# T02: 03 02

**Slice:** S03 — **Milestone:** M001

## Description

Wire the confidence field from classifyIntent into NormalizedRequest, change the run-foreground outer catch from writing cancel to writing a typed error ShellResult, and register the Claude backend descriptor in bootstrapBuiltins. Add the client-result test proving error propagation.

Purpose: SAFE-01 (errors surface without mutating shell buffer via typed error kind), PRV-02 (provider registration through bootstrap). Confidence field is needed for Phase 5's 0.8 routing gate (INT-04) — adding it now avoids a schema migration later.
Output: Updated request.ts, run-foreground.ts, bootstrap.ts, and client-result test green.

## Must-Haves

- [ ] "NormalizedRequest carries a confidence field (number 0–1) sourced from classifyIntent() IntentDecision"
- [ ] "run-foreground.ts outer catch writes { kind: 'error', message: 'Que-Que: <reason> — press any key' } instead of { kind: 'cancel' }"
- [ ] "run-foreground.ts inner fetchCandidates .catch() calls appendDebugLog with the error message"
- [ ] "bootstrapBuiltins() registers a provider backend descriptor for claude"
- [ ] "tests/client-result.test.ts has a test proving error ShellResult is written when fetchCandidates rejects"
- [ ] "pnpm test:run passes green after all changes in this plan"

## Files

- `src/contracts/request.ts`
- `src/client/run-foreground.ts`
- `src/registry/bootstrap.ts`
- `tests/client-result.test.ts`
