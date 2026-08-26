# Phase 8: Zero-Config Install and Provider Detection - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning
**Focus:** 08-02 (08-01 complete; 08-03 shape locked here, not yet planned)

<domain>
## Phase Boundary

Make `??` work on first run for Claude users with zero extra QueQue config. Non-Claude backends (OpenAI, Ollama) are supported by an explicit pin, not by probing every backend on every invocation.

08-01 already shipped platform-aware Claude *presence* heuristics. 08-02 does not use those heuristics as the adapter selector. 08-02 wires Claude (`claude -p`, env-key SDK rescue). 08-03 writes a provider pin and the OpenAI/Ollama adapters; it is not another detection waterfall.

</domain>

<decisions>
## Implementation Decisions

### Provider selection — pin, not waterfall
- **D-01:** Do not auto-select among Claude / OpenAI / Ollama at runtime. A silent “try Claude, then OpenAI, then Ollama” chain is still a waterfall and can steal the request (e.g. local Ollama up while Claude is logged out).
- **D-02:** Runtime resolution is:
  1. If `~/.config/qq/provider.json` pins `openai` or `ollama` → that adapter only.
  2. Else → Claude default (see D-05–D-07).
  3. Else → hard error with `/login` or API-key copy, and a path into the provider picker (08-03).
- **D-03:** Claude is the silent default. A developer with Claude Code `/login` or `ANTHROPIC_API_KEY` must get a working `??` with no QueQue provider quiz (Phase 8 success criterion #1).
- **D-04:** OpenAI and Ollama are opt-in. Ask once (first-run wizard or `qq init provider`), persist the pin, reuse it. Menu order when asking: Claude → OpenAI → Ollama. That order is the prompt, not a probe chain.
- **D-05:** Do not attach the provider question to `qq init zsh`. That command is shell wiring and is documented as pipeable into `~/.zshrc`. Interactive prompts belong on `/dev/tty` at first failed `??`, or a separate provider-init command.

### 08-02 — Claude only
- **D-06:** 08-02 ships Claude only. No OpenAI or Ollama adapters in this plan.
- **D-07:** Both Claude auth modes work: `claude /login` (CLI) and `ANTHROPIC_API_KEY` from the environment or `.env.local`.
- **D-08:** If `claude` is on PATH, always call `claude -p` first — even when an API key is set. One primary code path; `/login` is preferred because it is easier and keeps key storage out of QueQue.
- **D-09:** Anthropic SDK is rescue only: (a) CLI not on PATH and a key is set, or (b) `claude -p` fails and a key is set. A logged-out CLI must not strand someone who already has a key.
- **D-10:** PATH-first is the fetch rule. Do not require `claudeAuthPresent()` to be true before attempting `claude -p`. If the CLI is present, try it; validate auth at call time. `detectProvider()` / `claudeAuthPresent()` are leftover preflight, not the long-term selector.
- **D-11:** `ollama` and `openai-key` detections must not surface “not wired yet”. Until those adapters and a pin exist, treat them as a Claude setup miss (same `/login` or key guidance).

### Failure UX
- **D-12:** When Claude CLI fails and no key can rescue, hard-error. Do not fall through to OpenAI or Ollama.
- **D-13:** Error copy prefers `claude /login`. Alternative: add `ANTHROPIC_API_KEY` to the env / `.env.local`. Carry forward Phase 3: write `{kind:'error', message}` to the FIFO and leave the shell buffer unchanged.

### 08-03 — pin + remaining adapters
- **D-14:** 08-03 persists `~/.config/qq/provider.json` and implements OpenAI + Ollama adapters for the pinned kinds. Next `??` skips probing and honors the pin.
- **D-15:** Changing provider is re-running the picker (or editing the pin), not re-detecting the machine.

### Claude's Discretion
- How to implement CLI-then-SDK rescue (try subprocess then SDK vs inspect auth-error kinds).
- Exact `provider.json` schema (single `provider` field vs extra model/baseUrl for Ollama).
- Exact picker copy and whether 08-03 lives in first-failed-`??` vs `qq init provider`.
- Parse `claude -p` output: reuse `buildPrompt` / `parseCandidates` JSON contract unless research shows a better CLI flag.
- Exact error-string wording.
- Whether 08-02 deletes or bypasses `detectProvider()` vs leaving it as debug-only.
- 08-01 review leftovers (Windows `which` vs `where`, test env isolation) if touching `detect.ts`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` — Phase 8 goal and success criteria. D-01–D-05 supersede “detect every backend in priority order and use the first available” as the *selector*. Zero-config still means Claude works with no quiz. 08-03’s `provider.json` pin is confirmed; the none-path wizard must not require a quiz for Claude users.
- `.planning/REQUIREMENTS.md` — PRV-01, PRV-02, PRV-03, SAFE-01, EXT-01, RUN-01
- `.planning/PROJECT.md` — insertion-only; provider behind one adapter interface
- `.planning/phases/08-zero-config-install-and-provider-detection/08-RESEARCH.md` — Claude Code auth by platform; no Keychain read; no `claude -p` during *detection*. Call-time `claude -p` in 08-02 is allowed and is the real auth check.
- `.planning/phases/08-zero-config-install-and-provider-detection/08-01-SUMMARY.md` — `claudeAuthPresent()` shipped; do not treat it as the 08-02 fetch gate (D-10)
- `.planning/phases/08-zero-config-install-and-provider-detection/08-REVIEW.md` — WR-01/WR-02 if editing detection

### Provider layer
- `src/providers/detect.ts` — current waterfall; 08-02 must not use it as the adapter selector
- `src/providers/resolver.ts` — throws for `claude-cli` / `ollama` / `openai-key` today
- `src/providers/claude.ts` — SDK adapter; `buildPrompt`, `parseCandidates`, 25s timeout (under 30s FIFO)
- `src/providers/provider.ts` — `LLMAdapter.fetchCandidates(envelope) → CandidateList`
- `src/registry/bootstrap.ts` / `src/registry/provider-backends.ts` — register CLI adapter here
- `src/contracts/candidates.ts` — 1–5 `{command, explanation}`
- `src/client/run-foreground.ts` — today: `detectProvider` → `resolveAdapter` → `fetchCandidates`
- `src/cli/commands/init.ts` — zsh integration only; do not add the provider quiz here (D-05)
- `src/shared/qq-config.ts` — existing `~/.config/qq/config.json`; keep provider pin separate (`provider.json`) unless a later plan merges them
- `docs/EXTENSIONS.md` — provider resolution seam; update from “waterfall detect” to “pin, else Claude default”

### Prior decisions to carry
- `.planning/phases/03-claude-fast-path-and-ranked-suggestions/03-CONTEXT.md` — adapter contract, error FIFO, JSON candidate prompt
- `.planning/phases/06-hardening-privacy-defaults-and-extension-seams/06-02-SUMMARY.md` — `filterContextEnvelope` in `buildPrompt`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `claudeAdapter` in `src/providers/claude.ts` — keep as SDK rescue; do not replace it.
- `parseCandidates` / `buildPrompt` / `ensureSelectableCandidates` — reuse for subprocess output so CMD-01/CMD-02 stay one contract.
- `claudeOnPath()` in `detect.ts` — fetch-time gate for D-08.
- `appendDebugLog` — log which Claude path ran (CLI vs SDK rescue) and whether a pin was used.
- Privacy config at `~/.config/qq/config.json` — pattern for a sibling `provider.json`.

### Established Patterns
- `LLMAdapter` is a single method; each backend is another registered adapter, not a TUI fork.
- Zod `candidateListSchema` fail-closed; do not insert raw CLI prose into the buffer.
- Privacy: `filterContextEnvelope` before any prompt sent to CLI or SDK.
- Tests: do not stub a fake `claude` binary to hide missing-CLI behavior.

### Integration Points
- 08-02: PATH → `claude -p` → SDK rescue → D-13 error. `resolveAdapter({ kind: 'claude-cli' })` must return a real adapter.
- `bootstrapBuiltins()` registers the CLI adapter next to `claude`.
- 08-03: read/write `provider.json`; register OpenAI and Ollama backends; first-failed-`??` or `qq init provider` on `/dev/tty`.
- Zsh FIFO timeout remains 30s; SDK already uses 25s — subprocess needs a similar cap.

</code_context>

<specifics>
## Specific Ideas

- `/login` is the preferred recovery because it is easier and keeps keys out of QueQue.
- Env key remains a supported fallback, not the happy path.
- User asked whether env + `/login` at call time is simpler than 08-01 presence detection: yes; 08-02 should implement that model.
- User then asked whether all three backends can work without a waterfall by asking at install time: yes, via a pin with Claude as silent default (D-01–D-05).
- Discussed specifically for 08-02 (`/gsd-discuss-phase 8 --plan 2`).

</specifics>

<deferred>
## Deferred Ideas

- Native token reuse / SDK `authToken` from Claude Code credentials — ROADMAP: later optimization after subprocess.
- Merging `provider.json` into `config.json` — not required; sibling file matches 08-03 ROADMAP text.
- Phase 5 clarification chat — still deferred.
- Auto-try OpenAI then Ollama when Claude fails — explicitly rejected (D-01, D-12).

</deferred>

---

*Phase: 08-zero-config-install-and-provider-detection*
*Context gathered: 2026-08-25*
