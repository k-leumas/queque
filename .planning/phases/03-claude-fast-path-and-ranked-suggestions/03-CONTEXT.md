# Phase 3: Claude Fast Path and Ranked Suggestions - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Introduce the formal LLM adapter contract, implement Claude behind it, extract a confidence value from intent classification, and surface ranked command candidates through the existing Zellij FIFO path. Phase 3 always produces candidates — confidence-based routing (the 0.8 gate) is Phase 5. Error failures write a typed error sentinel to the FIFO so the shell buffer is never mutated.

</domain>

<decisions>
## Implementation Decisions

### Adapter Contract (PRV-02, PRV-03)
- **D-01:** Define `LLMAdapter` interface in `src/providers/provider.ts` with a single method: `fetchCandidates(envelope: ContextEnvelope): Promise<CandidateList>`. Fast-path only — clarification continuation is Phase 5.
- **D-02:** `src/providers/claude.ts` implements `LLMAdapter` and registers through the existing provider registry from Phase 2. No new registry needed.
- **D-03:** The interface is narrow by design. Do not add clarification stubs now — Phase 5 will extend the interface when the actual shape is known.

### Confidence Scoring (INT-04 prep)
- **D-04:** Add `confidence: number` field to `NormalizedRequest` in `src/contracts/request.ts`. Value is derived from intent type inside `classifyIntent()` — no model call, no heuristics on candidates.
- **D-05:** Phase 3 ignores the confidence value for routing — it always proceeds to candidate generation. The 0.8 threshold gate is Phase 5's responsibility (INT-04).
- **D-06:** Intent-to-confidence mapping is Claude's discretion (planner decides sensible defaults per intent type).

### Model Selection
- **D-07:** Default model: `claude-haiku-4-5` (fastest, lowest latency — correct for a shell assistant). Constant in `claude.ts`.
- **D-08:** `QQ_MODEL` env var (and `.env.local` override) overrides the default. The dynamic cheapest-first API list logic from the current `claude.ts` is removed — it adds a round-trip and complexity that isn't needed with a clear default.
- **D-09:** Remove `CHEAPEST_FIRST_MODEL_IDS` and `listAvailableModelIds` — replace with: use `QQ_MODEL` if set, else `DEFAULT_MODEL = 'claude-haiku-4-5-20251001'`.

### Error Handling (SAFE-01)
- **D-10:** On Claude failure (API error, bad JSON, timeout): render a short error message in the Zellij pane, then write an `{ kind: 'error', message: string }` `ShellResult` to the FIFO. The ZSH widget reads it and returns to the shell buffer unchanged.
- **D-11:** Extend `shellResultSchema` in `src/contracts/shell.ts` with an `error` variant: `z.object({ kind: z.literal('error'), message: z.string() })`. The widget's `_qq_apply_result` function must handle this kind and no-op on buffer mutation.
- **D-12:** Error message shown in pane should be concise: `"QueQue: <reason> — press any key"` then the pane closes.

### Prompt Contract (CMD-01, CMD-02)
- **D-13:** The existing prompt structure (JSON array of `{ command, explanation }`) is kept. No changes to the response schema — `candidateListSchema` already covers 1–5 candidates.
- **D-14:** Claude's discretion on prompt tuning for ranking quality — the planner should review and tighten the system prompt to encourage better ranking (most-likely-correct candidate first).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Contracts (read before touching any schema)
- `src/contracts/request.ts` — `NormalizedRequest`, `ContextEnvelope` — D-04 adds `confidence` field here
- `src/contracts/shell.ts` — `ShellResult` schema — D-11 adds the `error` variant here
- `src/contracts/candidates.ts` — `CandidateList`, `CommandCandidate` — unchanged, confirm before touching

### Provider layer (direct implementation target)
- `src/providers/claude.ts` — existing direct impl that becomes the `LLMAdapter` implementor; D-08/D-09 simplify model selection here
- `src/registry/` — Phase 2 provider registry; claude adapter registers here

### Shell integration (error kind must be handled here)
- `shell/zsh/qq.zsh` — `_qq_apply_result` function must handle `kind: 'error'` from D-11
- `src/client/result-writer.ts` — FIFO write path; error ShellResult flows through here

### Intent routing (confidence field lands here)
- `src/intent/router.ts` — `classifyIntent()` — D-04/D-06 add confidence derivation here

### Requirements
- `.planning/REQUIREMENTS.md` — PRV-01, PRV-02, PRV-03, CMD-01, CMD-02, SAFE-01 are Phase 3's requirements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/providers/claude.ts`: `fetchCandidates()`, `buildPrompt()`, `parseCandidates()`, `extractText()` — all reusable. Only model selection logic (lines ~18–40) is replaced by D-08/D-09.
- `src/contracts/candidates.ts`: `candidateListSchema` / `CandidateList` — unchanged, already the right shape.
- `src/shared/debug-log.ts`: `appendDebugLog()` — keep all existing debug logging in `claude.ts`.
- `src/shared/env-file.ts`: `readEnvValueFromDotEnvLocal()` — used for `QQ_MODEL` and `ANTHROPIC_API_KEY` override, keep as-is.

### Established Patterns
- Phase 2 registries: context providers, provider backends, shell adapters, storage hooks all use the same register/resolve pattern. The `LLMAdapter` registration follows this pattern.
- Zod schema unions for `ShellResult`: the existing `shellResultSchema` uses `z.discriminatedUnion('kind', [...])` — add the `error` variant to this union (D-11).
- `IFS= read -r -t 30 result < "$fifo_path"` in `qq.zsh` — the widget already reads one JSON line from the FIFO; the error kind is just another valid JSON line.

### Integration Points
- `src/client/run-foreground.ts` — calls `fetchCandidates` or `suggestShellResult`. Phase 3 routes through the adapter interface instead of direct import.
- `src/client/result-writer.ts` — writes `ShellResult` JSON to FIFO. The `error` variant passes through unchanged (just another serializable kind).
- `shell/zsh/qq.zsh` → `_qq_apply_result` — currently only handles `replace-buffer`. Must handle `error` kind: no buffer mutation, optionally `zle -M` the message.

</code_context>

<specifics>
## Specific Ideas

- User wants minimum wiring for a broad-serving MVP — keep Phase 3 strictly to the adapter contract + confidence field + error kind. No confidence routing gate (Phase 5).
- Speed matters: Haiku is the deliberate choice, not a compromise.
- The `suggestShellResult` export in `claude.ts` (takes first candidate, returns `ShellResult`) may be retired or kept as a compatibility shim — planner should assess if anything still calls it directly.

</specifics>

<deferred>
## Deferred Ideas

- Confidence-based routing gate (0.8 threshold → clarification branch) — Phase 5 (INT-04)
- Clarification continuation method on `LLMAdapter` — Phase 5
- Additional provider backends (OpenAI, local models) — Phase 6 / post-MVP
- Streaming responses for lower perceived latency — post-MVP

</deferred>

---

*Phase: 3-Claude Fast Path and Ranked Suggestions*
*Context gathered: 2026-05-14*
