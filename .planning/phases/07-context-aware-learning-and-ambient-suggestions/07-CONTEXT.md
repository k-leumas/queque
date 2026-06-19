# Phase 7: Context-Aware Learning and Ambient Suggestions - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

**Narrowed scope:** Deliver empty-lbuffer ambient `??` — when the user triggers QueQue with no query text, classify ambient shell context and open the existing TUI with context-driven command candidates pre-loaded.

**Out of this phase (deferred):** Event log on accepted commands, SQLite pattern index / local cache hits, and proactive `precmd` post-error suggestions. These were in the original roadmap but deprioritized as nice-to-have with uncertain daily-driver value.

The phase still satisfies the core product moment: "I'm in the shell, I don't know what to type, but QueQue should read the room and help."

</domain>

<decisions>
## Implementation Decisions

### Scope Reduction (user-directed)

- **D-01:** Phase 7 implements **empty-lbuffer ambient `??` only**. Plans 07-01 (event log + SQLite index) and 07-03 (precmd proactive suggestions) are **deferred** to a future phase or backlog.
- **D-02:** No local learning infrastructure in this phase — no `events.jsonl`, no SQLite, no storage-hook persistence beyond what is strictly needed for ambient signal detection (see Claude's discretion on "new cwd" without a full event store).

### UX Shape

- **D-03:** Empty-lbuffer `??` opens the **full existing TUI** (`CandidateSelect` in Zellij or inline path) — same keyboard flow as a normal query.
- **D-04:** Candidates are **pre-loaded** from Claude based on ambient context; the user still navigates and confirms from the ranked list. No single-instant auto-fill, no separate prompt surface.

### Ambient Signal Priority

When multiple signals apply, classify in this **fixed priority order** (first match wins as the primary ambient reason shown to Claude and optionally in the TUI):

1. **Last command failed** — `$? != 0` at trigger time; recovery-oriented suggestions.
2. **Dirty git tree** — uncommitted changes / dirty working tree from git context.
3. **New/unfamiliar cwd** — user is in a directory that feels unfamiliar (see Claude's discretion for heuristic without a full event log).
4. **Nothing obvious** — no strong ambient signal; fall back to general helpful defaults for the current cwd/project type.

Lower-priority signals may still be included as **secondary context** in the Claude prompt, but the primary ambient label follows the order above.

### Provider Path

- **D-05:** **Always call Claude** for empty-lbuffer ambient requests. Do not short-circuit with rule-only candidate lists. Ambient context is assembled into the prompt so suggestions stay precise and contextual.
- **D-06:** Integrate with the existing provider path: `gatherContext()` → `resolveAdapter()` → `fetchCandidates()` — same as non-empty queries, with an augmented prompt for the `unknown`/empty-query intent path.

### Privacy and Safety (carry-forward)

- **D-07:** Respect Phase 6 privacy defaults — `filterContextEnvelope` before prompt assembly, no file content reads, insertion-only shell contract unchanged.
- **D-08:** Ambient context sent to Claude may include: last exit code, last command string (if available from shell), cwd, git branch/dirty/changed file names, project-type markers (e.g. presence of `package.json`). Follow existing sensitive-path redaction.

### Claude's Discretion

- **"New/unfamiliar cwd" heuristic** without a persistent event log — e.g. no project markers in cwd, shallow directory depth, or optional lightweight marker file under `~/.local/share/qq/` (minimal, not full learning). Pick the simplest approach that makes signal #3 useful without building 07-01.
- **Shell transport extension** — add fields to `ShellRequest` / widget JSON (e.g. `lastExitCode`, `lastCommand`) vs. reading from zsh history inside the client. Prefer passing from zsh at trigger time for accuracy.
- **TUI ambient header** — whether to show the primary ambient reason above the candidate list (e.g. "Last command failed") and exact copy/styling.
- **Prompt template** for empty-query ambient requests — structure of the system/user message that tells Claude which signal fired and what kind of candidates to return.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and Roadmap
- `.planning/ROADMAP.md` — Phase 7 goal and success criteria (note: scope narrowed in this CONTEXT.md)
- `.planning/REQUIREMENTS.md` — EXT-01, RUN-01 traceability; HIST-01/HIST-02 remain v2/deferred
- `.planning/PROJECT.md` — Core value, privacy-forward defaults, insertion-only constraint

### Shell and Request Contracts
- `src/contracts/shell.ts` — `ShellRequest` / `ShellResult`; likely needs ambient fields extension
- `src/contracts/request.ts` — `unknown` intent taxonomy (empty query only), `ContextEnvelope` shape
- `shell/zsh/queque.zsh` — ZLE widget; must capture `$?` and last command at `??` trigger time

### Context and Provider Pipeline
- `src/intent/router.ts` — empty query → `unknown` intent with confidence 1
- `src/context/pipeline.ts` — two-pass gather + `filterContextEnvelope`
- `src/context/providers/git-context.ts` — branch, dirty, changedFiles for signal #2
- `src/client/run-foreground.ts` — foreground orchestration and TUI render path
- `src/providers/claude.ts` — prompt assembly; extend for ambient empty-query mode
- `src/ui/CandidateSelect.tsx` — existing TUI surface for pre-loaded candidates

### Privacy and Extension Seams
- `src/shared/privacy-filter.ts` — envelope filtering before API/log surfaces
- `src/shared/qq-config.ts` — user privacy config at `~/.config/qq/config.json`
- `docs/EXTENSIONS.md` — registry seams (storage-hooks deferred for this phase)

### Prior Phase Context
- `.planning/phases/06-hardening-privacy-defaults-and-extension-seams/06-VERIFICATION.md` — privacy and insertion-only verification
- `.planning/phases/02-intent-router-and-context-pipeline/02-CONTEXT.md` — intent taxonomy and file-access privacy gates (D-05/D-06)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `classifyIntent()` already routes empty lbuffer to `unknown` with `signals: ['empty-query']` — extend downstream handling, not the classifier itself.
- Git context provider already supplies `branch`, `dirty`, `changedFiles[]` — ready for dirty-tree ambient signal.
- `CandidateSelect` + modal-first async render in `run-foreground.ts` — reuse for pre-loaded candidates; no new TUI framework.
- `filterContextEnvelope()` and `resolveAdapter()` — Phase 6 wiring; ambient path should use the same pipeline.

### Established Patterns
- Zod schemas for all contract extensions — any new `ShellRequest` fields get schema + widget JSON updates.
- Zellij FIFO path and inline path both flow through `runForegroundClient` — ambient behavior must work in both.
- Privacy filter runs before Claude prompt assembly — ambient fields must pass through the same filter rules.

### Integration Points
- **Zsh widget** — capture `$?` and `$history[$((HISTCMD-1))]` (or equivalent) when `??` fires; add to request JSON.
- **`run-foreground.ts`** — branch on empty query / `unknown` intent to assemble ambient prompt and fetch candidates before/during TUI render.
- **`claude.ts` `buildPrompt`** — new ambient section when `queryText` is empty, naming primary signal and secondary context.
- **Optional TUI** — ambient reason line in `CandidateSelect` header area (Claude's discretion).

</code_context>

<specifics>
## Specific Ideas

- User finds full event logging, SQLite caching, and precmd proactive suggestions **nice-to-have with questionable usefulness** — only empty-lbuffer ambient `??` is worth building now.
- UX preference: normal TUI with pre-loaded candidates, not instant single suggestion or a separate chat surface.
- Signal priority explicitly ordered: failed last command → dirty git → new cwd → nothing obvious.
- Always use Claude with ambient context for precision — no rule-only fallback for candidate generation.

</specifics>

<deferred>
## Deferred Ideas

### From Original Phase 7 Roadmap (deferred)

- **Event log** — `~/.local/share/qq/events.jsonl` on every accepted selection (原 07-01)
- **SQLite pattern index** — query hash → accepted command frequency for cache hits before Claude (原 07-01)
- **Precmd proactive suggestions** — dim post-error suggestion line after non-zero exit, background query (原 07-03)
- **Local learning loop** — "learn from every interaction" as originally scoped in ROADMAP.md

These remain valid future work (aligns with v2 HIST-01/HIST-02) but are **explicitly out of Phase 7** after discussion.

### Scope Creep Avoided

- Persistent history enabled by default — still out of scope per PROJECT.md
- Phase 5 clarification chat — still deferred
- Phase 8 zero-config providers — separate phase

</deferred>

---

*Phase: 07-Context-Aware Learning and Ambient Suggestions*
*Context gathered: 2026-06-19*
