---
phase: 03-claude-fast-path-and-ranked-suggestions
verified: 2026-05-15T08:10:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 03: Claude Fast Path and Ranked Suggestions Verification Report

**Phase Goal:** Produce ranked, explainable command suggestions quickly for requests that are clear enough to skip clarification.
**Verified:** 2026-05-15T08:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | QueQue can call Claude using `ANTHROPIC_API_KEY` | VERIFIED | `src/providers/claude.ts` reads `process.env.ANTHROPIC_API_KEY` and passes it to `new Anthropic({ apiKey })`. Test in `tests/claude-provider.test.ts` asserts `anthropicCtorMock` called with `{ apiKey: 'test-key' }`. |
| 2 | Claude is implemented through the shared LLM adapter contract rather than a special-case code path | VERIFIED | `src/providers/provider.ts` exports `LLMAdapter` interface; `src/providers/claude.ts` imports `type { LLMAdapter }` and exports `export const claudeAdapter: LLMAdapter = { fetchCandidates }`. |
| 3 | High-confidence requests return ranked command candidates instead of raw model text | VERIFIED | `fetchCandidates` calls `parseCandidates()` which validates through `candidateListSchema.parse()` (Zod, 1–5 items, command+explanation per item) before returning. `ensureSelectableCandidates` pads for selector. |
| 4 | Every command candidate includes a concise explanation of what it will do | VERIFIED | `candidateListSchema` enforces `{ command: string; explanation: string }` per item. System prompt instructs Claude: "Return ONLY a JSON array of command candidates…". |
| 5 | Provider or parsing failures surface without mutating the shell buffer | VERIFIED | (a) `run-foreground.ts` inner `.catch()` writes `{ kind: 'error', message: 'QueQue: … — press any key' }` to FIFO; (b) outer catch does the same; (c) `qq.zsh` `_qq_apply_result error)` and `qq-question-widget error)` both restore `QQ_ORIG_LBUFFER`/`QQ_ORIG_RBUFFER` without mutation, returning 0. |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/providers/provider.ts` | LLMAdapter interface | VERIFIED | Exports `LLMAdapter` with single `fetchCandidates(envelope: ContextEnvelope): Promise<CandidateList>` method. No runtime code. |
| `src/providers/claude.ts` | Claude LLMAdapter implementor | VERIFIED | Exports `fetchCandidates` (named) and `claudeAdapter: LLMAdapter`. Uses `resolveModel()` with `claude-haiku-4-5-20251001` default. `suggestShellResult` deleted (0 occurrences confirmed). `CHEAPEST_FIRST` deleted (0 occurrences). |
| `src/contracts/shell.ts` | shellResultSchema with error variant | VERIFIED | `z.object({ kind: z.literal('error'), message: z.string() })` present as third discriminated union arm. |
| `src/contracts/request.ts` | normalizedRequestSchema with confidence field | VERIFIED | `shellRequestSchema.extend({ intent: requestIntentSchema, confidence: z.number().min(0).max(1) })` — confidence present. |
| `src/client/run-foreground.ts` | Error ShellResult on failure, confidence wired | VERIFIED | `confidence: decision.confidence` at NormalizedRequest construction. Inner `.catch()` and outer `catch` both write `{ kind: 'error', message: 'QueQue: ${message} — press any key' }`. |
| `src/registry/bootstrap.ts` | Claude provider backend descriptor registered | VERIFIED | `registerProviderBackend({ id: 'claude', name: 'Claude (Anthropic)', description: '...' })` called inside `bootstrapBuiltins()`. |
| `shell/zsh/qq.zsh` | error) case in both case blocks | VERIFIED | `grep -c 'error)'` = 2. `_qq_apply_result error)` returns 0 and restores buffers. `qq-question-widget error)` restores buffers (no return needed in widget block). |
| `tests/claude-provider.test.ts` | No modelListMock; asserts haiku default | VERIFIED | Zero `modelListMock` references. Test 1 asserts `request.model === 'claude-haiku-4-5-20251001'`. Test 2 asserts `QQ_MODEL` env override. |
| `tests/shell-contract.test.ts` | Positive test for error ShellResult variant | VERIFIED | Test "accepts {kind: error, message} ShellResult" passes with `safeParse` success. Test "rejects error variant without message field" passes. |
| `tests/zsh-widget.test.ts` | Test for _qq_apply_result error kind returning 0 | VERIFIED | `describe('result application: error kind restores buffers and returns 0')` — asserts exit=0, lbuffer=original left, rbuffer=original right. |
| `tests/client-result.test.ts` | Test: error ShellResult when fetchCandidates rejects | VERIFIED | "writes error ShellResult to FIFO when fetchCandidates rejects" — asserts `parsed.kind === 'error'`, message contains 'API timeout' and 'QueQue:'. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/providers/claude.ts` | `src/providers/provider.ts` | `import type { LLMAdapter }` | WIRED | Confirmed at line 6 of claude.ts |
| `claude.ts fetchCandidates` | single `client.messages.create` | `resolveModel()` — no loop | WIRED | `resolveModel()` at line 10–12; single `client.messages.create` call; no model array, no loop |
| `src/contracts/shell.ts` | `run-foreground.ts writeShellResult` | `{ kind: 'error' }` | WIRED | `writeShellResult(resultFile, { kind: 'error', message: ... })` present in both inner catch and outer catch |
| `classifyIntent() result` | `NormalizedRequest.confidence` | `run-foreground.ts` construction site | WIRED | `const normalized: NormalizedRequest = { ...request, intent: decision.intent, confidence: decision.confidence }` at line ~99 |
| `run-foreground.ts outer catch` | `writeShellResult` | error kind | WIRED | Lines 198–206: catches top-level errors, writes `{ kind: 'error', message: ... }` |
| `shell/zsh/qq.zsh _qq_apply_result` | `qq-question-widget case block` | both handle `error)` identically | WIRED | Both blocks contain `error)` case: lines 126–131 and 238–241 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `src/providers/claude.ts` | `response` (Claude API result) | `client.messages.create(...)` with live Anthropic SDK | Yes — real API call (no static return) | FLOWING |
| `src/client/run-foreground.ts` | `candidates` | `fetchCandidates(envelope, request.rbuffer)` | Yes — real provider call; `app.rerender(buildCandidateElement(candidates))` pushes to UI | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `LLMAdapter` interface exports single method | `grep -c 'export interface LLMAdapter' src/providers/provider.ts` | 1 | PASS |
| `claudeAdapter` exported from claude.ts | `grep -c 'claudeAdapter: LLMAdapter' src/providers/claude.ts` | 1 | PASS |
| `claude-haiku-4-5-20251001` default model | `grep -c "claude-haiku-4-5-20251001" src/providers/claude.ts` | 1 | PASS |
| `error)` in both zsh case blocks | `grep -c 'error)' shell/zsh/qq.zsh` | 2 | PASS |
| Full test suite green | `pnpm test:run` | 114 tests pass / 12 files | PASS |
| Build clean | `pnpm build` | ESM + DTS success, no TypeScript errors | PASS |

---

### Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| PRV-01 | 03-01 | Tool can call Claude using `ANTHROPIC_API_KEY` | SATISFIED | `claude.ts` reads `ANTHROPIC_API_KEY`; passes to `new Anthropic({ apiKey })`; test asserts API key passed to constructor |
| PRV-02 | 03-01, 03-02 | Provider integration isolated behind provider interface | SATISFIED | `LLMAdapter` interface in `provider.ts`; `claudeAdapter: LLMAdapter` export; `registerProviderBackend` call in `bootstrap.ts` |
| PRV-03 | 03-01 | Every LLM backend implements same adapter contract | SATISFIED | `LLMAdapter.fetchCandidates(envelope): Promise<CandidateList>` is the sole contract; Claude implements it; `claudeAdapter` export enables registry binding |
| CMD-01 | 03-01 | Tool returns ranked list of command candidates | SATISFIED | `candidateListSchema` enforces 1–5 ranked items; `parseCandidates` validates Claude's JSON output; system prompt requests ranked output |
| CMD-02 | 03-01 | Each command candidate includes a short explanation | SATISFIED | `candidateListSchema` per-item shape: `{ command: string; explanation: string }`; validated by Zod before returning to caller |
| SAFE-01 | 03-02, 03-03 | Errors surface without mutating the shell buffer | SATISFIED | `run-foreground.ts` writes `{ kind: 'error' }` on failure; `qq.zsh` `error)` case restores original buffers; message field never written to LBUFFER/RBUFFER |

All 6 requirement IDs from PLAN frontmatter are accounted for and satisfied. No orphaned requirements found for Phase 3 in REQUIREMENTS.md.

---

### Anti-Patterns Found

No debt markers (TBD, FIXME, XXX), placeholder implementations, or empty stubs found in any file modified by this phase. The `XXXXXX` pattern on `qq.zsh` line 178 is a `mktemp` template, not a marker.

---

### Human Verification Required

None. All observable truths are verifiable programmatically. The test suite exercises all code paths including the ZSH widget via `spawnSync` and the error propagation path via mocked `fetchCandidates`.

---

### Gaps Summary

No gaps. All 5 roadmap success criteria verified. All 6 requirement IDs satisfied. All key artifacts exist, are substantive, and are correctly wired. Full test suite passes (114/114 tests). Build is clean.

---

_Verified: 2026-05-15T08:10:00Z_
_Verifier: Claude (gsd-verifier)_
