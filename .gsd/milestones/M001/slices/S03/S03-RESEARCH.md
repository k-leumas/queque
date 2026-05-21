# Phase 3: Claude Fast Path and Ranked Suggestions - Research

**Researched:** 2026-05-14
**Domain:** TypeScript provider adapter pattern, Zod schema extension, ZSH widget error handling
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `LLMAdapter` interface in `src/providers/provider.ts` with method `fetchCandidates(envelope: ContextEnvelope): Promise<CandidateList>`. Fast-path only — no clarification stub.
- **D-02:** `src/providers/claude.ts` implements `LLMAdapter` and registers through the existing provider registry from Phase 2.
- **D-03:** Interface is narrow by design. Do not add clarification stubs — Phase 5.
- **D-04:** Add `confidence: number` field to `NormalizedRequest` in `src/contracts/request.ts`. Value derived from intent type inside `classifyIntent()` — no model call.
- **D-05:** Phase 3 ignores confidence value for routing — always proceeds to candidate generation.
- **D-06:** Intent-to-confidence mapping is Claude's discretion (planner decides defaults).
- **D-07:** Default model: `claude-haiku-4-5` (constant in `claude.ts`). Fastest, lowest latency.
- **D-08:** `QQ_MODEL` env var (and `.env.local` override) overrides the default.
- **D-09:** Remove `CHEAPEST_FIRST_MODEL_IDS` and `listAvailableModelIds`. Replace with: use `QQ_MODEL` if set, else `DEFAULT_MODEL = 'claude-haiku-4-5-20251001'`.
- **D-10:** On Claude failure: render short error in pane, write `{ kind: 'error', message: string }` ShellResult to FIFO.
- **D-11:** Extend `shellResultSchema` in `src/contracts/shell.ts` with `error` variant using `z.discriminatedUnion`. ZSH widget's `_qq_apply_result` must handle `error` kind with no buffer mutation.
- **D-12:** Error message in pane: `"Que-Que: <reason> — press any key"` then pane closes.
- **D-13:** Existing prompt structure `{ command, explanation }` JSON array is kept. `candidateListSchema` unchanged.
- **D-14:** Claude's discretion on prompt tuning for better ranking (most-likely-correct first).

### Claude's Discretion

- Intent-to-confidence mapping defaults per intent type (D-06)
- Prompt tuning for ranking quality (D-14)
- Whether `suggestShellResult` is retired or kept as a compatibility shim (assessed in research)

### Deferred Ideas (OUT OF SCOPE)

- Confidence-based routing gate (0.8 threshold → clarification) — Phase 5 (INT-04)
- Clarification continuation method on `LLMAdapter` — Phase 5
- Additional provider backends (OpenAI, local models) — Phase 6 / post-MVP
- Streaming responses for lower perceived latency — post-MVP

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRV-01 | Tool can call Claude using `ANTHROPIC_API_KEY` | `fetchCandidates` in `claude.ts` already reads key from env + `.env.local`. Simplify model selection per D-09. |
| PRV-02 | Provider integration isolated behind a provider interface | New `LLMAdapter` interface in `src/providers/provider.ts`. Claude registers through `provider-backends` registry. |
| PRV-03 | Every LLM backend implements the same adapter contract | `LLMAdapter.fetchCandidates()` is the single method contract for Phase 3. |
| CMD-01 | Tool returns ranked list of command candidates | `candidateListSchema` (1–5 items) already enforces ordering. Prompt tuning nudges model to rank best candidate first. |
| CMD-02 | Each command candidate includes short explanation | `commandCandidateSchema` requires `explanation: z.string()`. Already in place. |
| SAFE-01 | Errors surface cleanly without mutating shell buffer | New `error` variant in `shellResultSchema` + `_qq_apply_result` no-op on `error` kind. |

</phase_requirements>

---

## Summary

Phase 3 is primarily a refactoring and wiring phase. The core Claude call path (`fetchCandidates`, `buildPrompt`, `parseCandidates`, `extractText`) already works and is well-tested in `tests/claude-provider.test.ts`. The work is focused on four surgical changes: (1) extracting a formal `LLMAdapter` interface so the provider contract is explicit and testable, (2) adding a `confidence` field to `NormalizedRequest` so the classifier's scoring is preserved in the request object, (3) simplifying model selection by removing the runtime API list and hardcoding Haiku with an env override, and (4) adding an `error` ShellResult variant so failures surface without touching the shell buffer.

The ZSH widget (`shell/zsh/qq.zsh`) already reads one JSON line from the FIFO and dispatches on `kind` with a `case` statement. Adding the `error` case is a three-line addition — the `*` wildcard branch already handles unknown kinds with buffer preservation, so the shell contract is safe even before the update. The `writeShellResult` function in `result-writer.ts` validates against `shellResultSchema` before writing, so the Zod schema extension is the single authoritative change that flows through both the Node side and the shell side.

The `suggestShellResult` export in `claude.ts` has no callers outside the file itself (grep-verified). It can be safely removed. The `run-foreground.ts` calls `fetchCandidates` directly from `../providers/claude.js` — after Phase 3 this import should come from the provider registry or at minimum the import path should align with the adapter interface, but the CONTEXT.md decisions do not require `run-foreground.ts` to be decoupled in this phase.

**Primary recommendation:** Make the four changes in the order that minimizes broken-import windows — contracts first (shell.ts, request.ts), then provider interface (provider.ts), then claude.ts refactor, then registry wiring, then ZSH widget update.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| LLMAdapter interface definition | API / Backend | — | Interface lives in `src/providers/provider.ts`; it is a TypeScript contract, not a runtime tier |
| Claude API call (`fetchCandidates`) | API / Backend | — | Calls external Anthropic API; result is a typed `CandidateList` |
| Confidence scoring | API / Backend | — | Derived inside `classifyIntent()` in `src/intent/router.ts`; no I/O, purely synchronous |
| Error ShellResult production | API / Backend | — | `result-writer.ts` serializes; `shellResultSchema` validates |
| Shell buffer protection on error | Browser / Client (ZSH) | — | `_qq_apply_result` in `qq.zsh` no-ops on `error` kind; the shell widget owns buffer mutation |
| Model selection logic | API / Backend | — | Constants + env var read in `claude.ts`; no user interaction |

---

## Standard Stack

### Core (verified in project)

| Library | Project Version | Current Version | Purpose | Confidence |
|---------|----------------|-----------------|---------|------------|
| `@anthropic-ai/sdk` | 0.92.0 | 0.96.0 | Claude API client | HIGH [VERIFIED: npm registry] |
| `zod` | 4.1.5 | 4.1.5 | Schema validation for contracts | HIGH [VERIFIED: package.json] |
| `vitest` | 4.0.4 | 4.0.4 | Test runner | HIGH [VERIFIED: package.json] |

**Note on SDK version:** Project uses 0.92.0; current is 0.96.0. The `client.messages.create()` and `client.models.list()` API surface is stable across this range. No upgrade needed for Phase 3. [ASSUMED: 0.92.0→0.96.0 is backward-compatible for `messages.create`]

### Project conventions (all verified by codebase grep)

- All schema extensions use `z.discriminatedUnion('kind', [...])` — the existing `shellResultSchema` uses this pattern. Adding `error` variant must be appended to the union array. [VERIFIED: codebase grep]
- All registries follow: `register*()`, `get*()`, `list*()`, `clear*()` (test only) pattern. [VERIFIED: `src/registry/provider-backends.ts`]
- `bootstrapBuiltins()` in `src/registry/bootstrap.ts` is the single registration call-site for built-ins. Phase 3 adds claude adapter registration here. [VERIFIED: `src/registry/bootstrap.ts`]
- Env var + `.env.local` reads use `readEnvValueFromDotEnvLocal()` from `src/shared/env-file.ts`. [VERIFIED: `src/providers/claude.ts`]
- Debug logging uses `appendDebugLog(category, event, data)` from `src/shared/debug-log.ts`. Keep all existing calls. [VERIFIED: `src/providers/claude.ts`]

---

## Architecture Patterns

### System Architecture Diagram

```
ZSH widget (qq.zsh)
    |
    | writes request JSON to tmp file
    v
run-foreground.ts
    |
    |-- classifyIntent() --> NormalizedRequest (+ confidence field, Phase 3 adds this)
    |-- gatherContext()  --> ContextEnvelope
    |
    | calls LLMAdapter.fetchCandidates(envelope)
    v
claude.ts (implements LLMAdapter)
    |
    | builds prompt from ContextEnvelope
    | calls Anthropic API (claude-haiku-4-5-20251001)
    | parses JSON array response into CandidateList
    |
    | on success: returns CandidateList
    | on failure: throws Error (caught by run-foreground.ts)
    v
run-foreground.ts (error handler)
    |
    | writeShellResult(resultFile, { kind: 'error', message }) on failure
    | writeShellResult(resultFile, { kind: 'replace-buffer', ... }) on selection
    v
result-writer.ts
    |
    | validates ShellResult against shellResultSchema (including error variant)
    | writes JSON line to FIFO
    v
ZSH widget reads FIFO
    |
    | case 'error': restore original buffers, no mutation
    | case 'replace-buffer': apply lbuffer/rbuffer
    | case 'cancel': restore original buffers
```

### Recommended File Locations

```
src/
├── providers/
│   ├── provider.ts      # NEW: LLMAdapter interface (D-01)
│   └── claude.ts        # MODIFIED: implements LLMAdapter, simplified model selection
├── contracts/
│   ├── request.ts       # MODIFIED: confidence field on NormalizedRequest (D-04)
│   └── shell.ts         # MODIFIED: error variant on shellResultSchema (D-11)
├── registry/
│   ├── provider-backends.ts  # UNCHANGED: descriptor registry (no LLMAdapter here)
│   └── bootstrap.ts          # MODIFIED: register claude adapter
shell/zsh/
└── qq.zsh               # MODIFIED: error case in _qq_apply_result
```

### Pattern 1: LLMAdapter Interface (D-01, D-02)

**What:** Single-method TypeScript interface that all LLM backends must implement. The interface lives in `src/providers/provider.ts` (a new file). Claude's `fetchCandidates` function signature already matches — the refactor is wrapping it in a class or object that satisfies the interface.

**When to use:** This is the only approach — D-02 is locked.

```typescript
// src/providers/provider.ts
// Source: CONTEXT.md D-01, verified against existing src/context/provider.ts pattern
import type { CandidateList } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';

export interface LLMAdapter {
  fetchCandidates(envelope: ContextEnvelope): Promise<CandidateList>;
}
```

**Note:** The existing `src/context/provider.ts` defines `ContextProvider` as an interface with an `id` field and a `gather()` method — the same pattern. `LLMAdapter` follows the same shape. The Phase 2 `provider-backends` registry stores `ProviderBackendDescriptor` (metadata only, no method). Phase 3 may need to decide: does the descriptor registry also store the `LLMAdapter` instance, or does `run-foreground.ts` import `claude.ts` directly? See Open Questions #1.

### Pattern 2: Zod discriminatedUnion Extension (D-11)

**What:** Add `error` variant to `shellResultSchema` by extending the existing discriminated union array.

**When to use:** Required for D-11.

```typescript
// src/contracts/shell.ts — modified
// Source: VERIFIED from existing shellResultSchema pattern in codebase
export const shellResultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('cancel') }).strict(),
  z.object({
    kind: z.literal('replace-buffer'),
    lbuffer: z.string(),
    rbuffer: z.string(),
  }),
  z.object({
    kind: z.literal('error'),
    message: z.string(),
  }),
]);

export type ShellResult = z.infer<typeof shellResultSchema>;
```

**Warning:** `writeShellResult` calls `shellResultSchema.parse(result)` before writing. Once the schema is extended, it will accept `{ kind: 'error', message }` without any changes to `result-writer.ts`. The ZSH widget and test mocks are the only other consumers that must be updated.

### Pattern 3: NormalizedRequest confidence field (D-04)

**What:** Add `confidence: number` to `NormalizedRequest` via the `normalizedRequestSchema` extension.

**Current state:** `normalizedRequestSchema` is `shellRequestSchema.extend({ intent: requestIntentSchema })`. Phase 3 also extends with `confidence`.

**Important:** `IntentDecision` already has `confidence: z.number().min(0).max(1)` — this field is the classifier's output. `NormalizedRequest` needs to carry it forward so downstream consumers can read it without re-running the classifier.

```typescript
// src/contracts/request.ts — modified
// Source: VERIFIED from existing normalizedRequestSchema in codebase
export const normalizedRequestSchema = shellRequestSchema.extend({
  intent: requestIntentSchema,
  confidence: z.number().min(0).max(1),
});

export type NormalizedRequest = z.infer<typeof normalizedRequestSchema>;
```

**Downstream impact:** `run-foreground.ts` constructs `NormalizedRequest` at line 96:
```typescript
const normalized: NormalizedRequest = { ...request, intent: decision.intent };
```
This line must also pass `confidence: decision.confidence`. That is the only construction site (grep-verified — one location in `run-foreground.ts`).

### Pattern 4: ZSH widget error case (D-11)

**What:** Add `error)` case to the `case "$kind" in` statement in `qq-question-widget()`. The error kind restores original buffers (same as `cancel`).

```zsh
# shell/zsh/qq.zsh — in qq-question-widget(), case block
# Source: VERIFIED from qq.zsh lines 203-218
error)
  LBUFFER="$QQ_ORIG_LBUFFER"
  RBUFFER="$QQ_ORIG_RBUFFER"
  ;;
```

**Note:** The `*` wildcard branch already handles unknown kinds by restoring buffers. Adding an explicit `error)` case ensures the behavior is documented and readable, and prevents it from silently becoming a no-op if the wildcard behavior is changed later.

### Pattern 5: Confidence mapping inside classifyIntent (D-06)

**What:** The classifier already returns `IntentDecision` with a `confidence` value. The values in the current implementation are:

| Intent | Current confidence | Signal |
|--------|-------------------|--------|
| `unknown` | 1.0 | `empty-query` |
| `shell-command` (git) | 1.0 | `git-prefix` |
| `codebase` (pkg manager) | 1.0 | `pkg-manager-script` |
| `filesystem` | 0.85 | `filesystem-keyword` |
| `shell-command` (regex) | 0.8 | `shell-command-signal` |
| `codebase` (file path) | 0.9 | `file-path-signal` |
| `general` | 0.5 | `no-strong-signal` |

These are already sensible values. D-06 gives the planner discretion — no changes to the classifier's confidence mapping are required. The `confidence` field on `NormalizedRequest` will simply carry whatever `classifyIntent()` returns.

### Anti-Patterns to Avoid

- **Touching `candidateListSchema` or `commandCandidateSchema`:** D-13 locks these as unchanged. Do not add fields.
- **Calling `listAvailableModelIds` for any path:** D-09 removes this function entirely. The model selection must be: env var → constant. No runtime API round-trip.
- **Adding `LLMAdapter` to `ProviderBackendDescriptor`:** The descriptor registry stores metadata (id, name, description). It does not store callable objects. Follow the existing pattern. See Open Questions #1 for how the adapter instance is resolved.
- **Using `async/await` on `classifyIntent`:** It is and must remain synchronous (Phase 2 decision confirmed in STATE.md). Do not introduce I/O here.
- **Leaving `suggestShellResult` in place without assessing call sites:** It has zero external callers (grep-verified). Remove it to keep the provider surface clean. If removal breaks any test, the test was testing the shim not the adapter.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON schema validation for error variant | Custom type guard | `z.discriminatedUnion` extension | Already the project pattern; Zod guarantees parse-time validation before FIFO write |
| Model fallback logic | Runtime API polling for available models | `QQ_MODEL` env var + constant default | Adds a round-trip latency that defeats Haiku's speed advantage |
| Shell buffer protection | Manual try/catch in zsh | Typed `error` ShellResult + `case` no-op | The FIFO contract already handles all kinds uniformly; adding a type removes ambiguity |
| Interface conformance checks | Runtime duck-typing | TypeScript `implements LLMAdapter` | Zero runtime cost; TypeScript compiler enforces at build time |

---

## Common Pitfalls

### Pitfall 1: NormalizedRequest construction missing confidence

**What goes wrong:** `run-foreground.ts` line 96 constructs `NormalizedRequest` as `{ ...request, intent: decision.intent }`. If `confidence` is added to the schema but not to this construction site, the Zod parse at this line will throw a runtime validation error (if `normalizedRequestSchema.parse()` is called) or produce a TypeScript error at compile time (if the type is enforced).

**Why it happens:** There is one and only one construction site for `NormalizedRequest` in production code. It is easy to miss when extending the schema.

**How to avoid:** Grep for all `NormalizedRequest` construction sites before and after the schema change. There is currently one: `src/client/run-foreground.ts:96`. Update it to `{ ...request, intent: decision.intent, confidence: decision.confidence }`.

**Warning signs:** TypeScript error `Property 'confidence' is missing in type`.

### Pitfall 2: shellResultSchema tests fail after error variant addition

**What goes wrong:** `tests/shell-contract.test.ts` and `tests/client-result.test.ts` test the `shellResultSchema`. Adding a new variant changes the discriminated union. Tests that assert "only cancel and replace-buffer are valid" will fail.

**Why it happens:** The `shellResultSchema` is tested directly. The existing test for invalid kinds must be updated to exclude `error` from the "invalid" set.

**How to avoid:** Read `tests/shell-contract.test.ts` before touching `shell.ts`. Add a positive test for `{ kind: 'error', message: 'test' }` and update any negative test that checked the closed set of valid kinds.

**Warning signs:** Test failure in `shell-contract.test.ts` with "Expected kind to be one of...".

### Pitfall 3: writeShellResult validation rejects error kind

**What goes wrong:** `result-writer.ts` calls `shellResultSchema.parse(result)` before writing. If the schema is not updated before calling `writeShellResult` with an error result, the parse will throw and the error will not be written to the FIFO — the shell times out and uses the 30s default cancel.

**Why it happens:** Schema and call site changes must happen atomically in the same commit. The write path is safe once the schema is extended.

**How to avoid:** Extend `shellResultSchema` in the same commit as the `run-foreground.ts` error-handling code.

### Pitfall 4: ZSH widget wildcard already handles error — but silently

**What goes wrong:** The `*` wildcard in `qq-question-widget()` already restores buffers for any unknown kind. If the `error` case is not added explicitly, the behavior is correct but the intent is invisible. More importantly, `_qq_apply_result()` (used in tests, lines 83–122) does NOT have this fallback for unknown kinds — it returns 1. The widget function and the helper function have slightly different behavior.

**Why it happens:** The widget inlines its case handling rather than calling `_qq_apply_result`. The two implementations diverged.

**How to avoid:** Update both the widget case block (in `qq-question-widget()`) and the `_qq_apply_result` helper to handle `error`. The helper is used by tests; the widget is used at runtime. Both need the update.

**Warning signs:** `tests/zsh-widget.test.ts` passes but manual trigger fails, or vice versa.

### Pitfall 5: LLMAdapter interface conflicts with existing provider.ts in src/context/

**What goes wrong:** There is already a `src/context/provider.ts` that defines `ContextProvider`. The new `LLMAdapter` goes in `src/providers/provider.ts` (different directory). Using the wrong path causes import resolution failures.

**Why it happens:** Both are named `provider.ts` in different subdirectories.

**How to avoid:** The new file is `src/providers/provider.ts`. Verify no existing file at that path before creating.

**Warning signs:** `ENOENT` at import, or unexpectedly importing `ContextProvider` instead of `LLMAdapter`.

### Pitfall 6: claude-provider.test.ts mocks modelListMock — must be removed

**What goes wrong:** The existing `tests/claude-provider.test.ts` mocks `client.models.list()` via `modelListMock` because the current code calls `listAvailableModelIds()`. After D-09 removes that function, the test assertions that rely on `modelListMock` being called (or its return value) will fail or become meaningless.

**Why it happens:** Test was written for the current dynamic-model-selection logic, which is being replaced.

**How to avoid:** Update `tests/claude-provider.test.ts` to remove `modelListMock` setup and assertions. Replace with assertions that the correct hardcoded model is used (`claude-haiku-4-5-20251001`) unless `QQ_MODEL` is set.

---

## Code Examples

### suggestShellResult removal assessment

**Result:** `suggestShellResult` has zero external callers. [VERIFIED: grep across `src/` and `tests/`]. It can be removed cleanly. The only internal caller is itself calling `fetchCandidates`. Removing it eliminates dead code.

### Error handling in run-foreground.ts

The existing outer `catch` block (lines 178–184) already writes `{ kind: 'cancel' }` on failure:

```typescript
// Source: src/client/run-foreground.ts lines 178-184 — VERIFIED
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  void appendDebugLog('client', 'llm request failed; falling back to cancel', { message });
  await writeShellResult(resultFile, { kind: 'cancel' });
}
```

Phase 3 changes the fallback from `cancel` to `error`:

```typescript
// Updated pattern per D-10/D-11
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  void appendDebugLog('client', 'llm request failed', { message });
  await writeShellResult(resultFile, { kind: 'error', message: `Que-Que: ${message} — press any key` });
}
```

The inner `.catch()` block on `fetchCandidates` (lines 171–174) renders an error state in the Ink UI (`app.rerender(buildCandidateElement(null, true))`). The outer catch covers cases where the request setup itself fails (before Ink is rendered). D-12 requires the error message format `"Que-Que: <reason> — press any key"` — apply this consistently in both error paths.

### Model selection simplification

```typescript
// Source: src/providers/claude.ts — refactored per D-07/D-08/D-09
// [VERIFIED: existing QQ_MODEL read pattern from readEnvValueFromDotEnvLocal]
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

function resolveModel(): string {
  return process.env.QQ_MODEL ?? readEnvValueFromDotEnvLocal('QQ_MODEL') ?? DEFAULT_MODEL;
}
```

Remove: `CHEAPEST_FIRST_MODEL_IDS`, `listAvailableModelIds`, `chooseCheapestAvailableModel`, `getCandidateModels`.

Replace the `models` loop (lines 152–183) with a single `client.messages.create({ model: resolveModel(), ... })` call — no loop needed.

### Prompt ranking nudge (D-14)

Current system prompt: `"You are Que-Que, a terminal assistant. Return only JSON matching {"command":"..."} and nothing else."`

Current user prompt ends with: `"Return ONLY a JSON array of 1-3 shell command candidates, most likely first."`

The ranking instruction ("most likely first") is already present. To strengthen it, the system prompt can be updated to reinforce ranking explicitly. Example improvement:

```
System: You are Que-Que, a terminal shell assistant. Return ONLY a JSON array of command candidates, ranked with the most correct/direct command first. No prose, no markdown, no code fences.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dynamic cheapest-first model selection (API poll) | Fixed default + env override | Phase 3 | Removes one round-trip; Haiku is always used unless overridden |
| Direct `fetchCandidates` import in run-foreground | Import through `LLMAdapter` interface | Phase 3 | Provider is swappable without touching run-foreground |
| `cancel` on all failures | `error` kind with message | Phase 3 | User sees error reason instead of silent cancel |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@anthropic-ai/sdk` 0.92.0 → 0.96.0 is backward-compatible for `messages.create` call signature | Standard Stack | Low — if breaking, `fetchCandidates` call will fail at runtime; but no upgrade needed for Phase 3 |
| A2 | `claude-haiku-4-5-20251001` is a valid model ID available to the project's API key | Standard Stack / Model Selection | Medium — if the model ID is wrong or unavailable, the API call returns 404; D-08 env override is the mitigation |

---

## Open Questions

1. **How does `run-foreground.ts` obtain the `LLMAdapter` instance after Phase 3?**
   - What we know: Currently it does `import { fetchCandidates } from '../providers/claude.js'` directly (line 10). D-02 says claude.ts "registers through the existing provider registry." The `provider-backends` registry stores `ProviderBackendDescriptor` (metadata only — id, name, description), not callable instances.
   - What's unclear: Should the planner (a) have `run-foreground.ts` import `claude.ts` directly (still satisfies D-02 if claude.ts implements the interface), or (b) add an adapter instance to the registry alongside the descriptor?
   - Recommendation: Option (a) is simpler and satisfies the letter of D-02. The TypeScript `implements LLMAdapter` declaration on the claude adapter provides the contract enforcement. The registry can remain descriptor-only for Phase 3. Phase 6 (multiple providers) will require instance lookup — that's the right time to extend the registry.

2. **Does `_qq_apply_result` need the error case or only `qq-question-widget`?**
   - What we know: The widget (`qq-question-widget`) inlines its own case handling and does NOT call `_qq_apply_result`. The helper is called from tests in `zsh-widget.test.ts`.
   - What's unclear: If tests use `_qq_apply_result`, they should verify error handling there too. The helper currently returns `1` for unknown kinds (not silent restoration). The widget silently restores on unknown kinds.
   - Recommendation: Update both. Consistency matters for test coverage.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node` | Runtime | ✓ | LTS (project constraint) | — |
| `ANTHROPIC_API_KEY` | PRV-01 | Runtime env | — | Test with mock |
| `jq` | ZSH widget JSON parse | ✓ | Assumed present (used in existing widget) | — |

No blocking missing dependencies. `ANTHROPIC_API_KEY` is required at runtime but tests mock it (verified in `tests/claude-provider.test.ts` `beforeEach`).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.0.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm test:run` |
| Full suite command | `pnpm test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRV-01 | Claude called with ANTHROPIC_API_KEY | unit | `pnpm test:run -- tests/claude-provider.test.ts` | ✅ |
| PRV-02 | Provider isolated behind LLMAdapter interface | unit | `pnpm test:run -- tests/claude-provider.test.ts` | ✅ (update needed) |
| PRV-03 | Adapter contract enforced | unit (TS compile) | `pnpm build` | ✅ |
| CMD-01 | Returns ranked CandidateList | unit | `pnpm test:run -- tests/claude-provider.test.ts` | ✅ |
| CMD-02 | explanation field present | unit | `pnpm test:run -- tests/claude-provider.test.ts` | ✅ |
| SAFE-01 | Error writes error ShellResult, no buffer mutation | unit | `pnpm test:run -- tests/shell-contract.test.ts tests/client-result.test.ts` | ✅ (update needed) |

### Sampling Rate

- **Per task commit:** `pnpm test:run`
- **Per wave merge:** `pnpm test:run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/claude-provider.test.ts` — remove `modelListMock` dependency, add `QQ_MODEL` env override test, add hardcoded model assertion
- [ ] `tests/shell-contract.test.ts` — add positive test for `{ kind: 'error', message: '...' }` variant
- [ ] `tests/client-result.test.ts` — add test for error ShellResult written on `fetchCandidates` rejection

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | zod — `shellResultSchema`, `candidateListSchema` validate all data before write |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed Claude response injecting shell commands | Tampering | `candidateListSchema.parse()` rejects non-conforming responses; malformed text becomes `echo ""` fallback |
| Error message containing shell metacharacters written to buffer | Tampering | `error` kind never mutates the shell buffer — ZSH widget no-ops on error kind |
| ANTHROPIC_API_KEY leaking into debug log | Information Disclosure | `appendDebugLog` should never log the API key value (existing behavior — key is passed to Anthropic constructor, not logged) |

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: codebase] `src/providers/claude.ts` — full implementation read
- [VERIFIED: codebase] `src/contracts/shell.ts` — shellResultSchema structure
- [VERIFIED: codebase] `src/contracts/request.ts` — NormalizedRequest, IntentDecision, ContextEnvelope
- [VERIFIED: codebase] `src/contracts/candidates.ts` — CandidateList, CommandCandidate
- [VERIFIED: codebase] `src/intent/router.ts` — classifyIntent, existing confidence values
- [VERIFIED: codebase] `src/client/run-foreground.ts` — fetchCandidates call site, NormalizedRequest construction
- [VERIFIED: codebase] `src/client/result-writer.ts` — writeShellResult FIFO path
- [VERIFIED: codebase] `shell/zsh/qq.zsh` — case dispatch, _qq_apply_result
- [VERIFIED: codebase] `src/registry/bootstrap.ts` — built-in registration pattern
- [VERIFIED: codebase] `src/registry/provider-backends.ts` — registry interface
- [VERIFIED: codebase] `src/context/provider.ts` — ContextProvider interface pattern
- [VERIFIED: codebase] `tests/claude-provider.test.ts` — existing test coverage
- [VERIFIED: npm registry] `@anthropic-ai/sdk` current version: 0.96.0 (project: 0.92.0)
- [VERIFIED: package.json] Project dependency versions confirmed

### Tertiary (LOW confidence — needs validation)

- [ASSUMED] `claude-haiku-4-5-20251001` model ID is valid for the API key in use
- [ASSUMED] `@anthropic-ai/sdk` 0.92.0 → 0.96.0 is backward-compatible for `messages.create`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — read directly from package.json and codebase
- Architecture: HIGH — all canonical files read and cross-referenced
- Pitfalls: HIGH — derived from actual code inspection, not general knowledge
- Model ID validity: LOW — not verifiable without a live API key

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (stable stack, 30-day window)