# Phase 7: Context-Aware Learning and Ambient Suggestions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 07-Context-Aware Learning and Ambient Suggestions
**Areas discussed:** Phase scope reduction, empty-lbuffer UX shape, ambient signal priority, provider path

---

## Phase Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full Phase 7 (event log + SQLite + empty-lbuffer + precmd) | Original ROADMAP.md scope — all three plans | |
| Empty-lbuffer ambient `??` only | Defer learning infrastructure and precmd hooks | ✓ |
| Defer Phase 7 entirely | Skip to Phase 8 | |

**User's choice:** Empty-lbuffer ambient `??` only — user feels event logging, SQLite cache, and precmd suggestions are nice-to-have with uncertain usefulness.
**Notes:** User explicitly called out empty-lbuffer (roadmap option B / 07-02) as the interesting and useful part.

---

## UX Shape (empty-lbuffer `??`)

| Option | Description | Selected |
|--------|-------------|----------|
| Full TUI with pre-loaded context-driven candidates | Same CandidateSelect flow; candidates from ambient context | ✓ |
| Single best-guess suggestion | Instant one-liner, minimal browsing | |
| Context header + Claude interprets | TUI with ambient label, flexible LLM response | |
| You decide | Agent picks optimal shell-native UX | |

**User's choice:** Full TUI with pre-loaded context-driven candidates.
**Notes:** Safest path — reuses existing TUI; user still picks from ranked list.

---

## Ambient Signal Priority

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed priority: failed command → dirty git → new cwd → nothing obvious | First match is primary label; lower signals as secondary context | ✓ |
| Equal weighting | Claude weighs all signals without explicit priority | |
| User-configurable priority | config.json ordering | |

**User's choice:** Fixed priority order: (1) last command failed, (2) dirty git tree, (3) new/unfamiliar cwd, (4) nothing obvious.

---

## Provider Path

| Option | Description | Selected |
|--------|-------------|----------|
| Always call Claude with ambient context | No rule-only candidate generation | ✓ |
| Rule-based first, Claude fallback | Cheaper/faster when rules match | |
| Cache hits before Claude | Requires SQLite index (deferred) | |

**User's choice:** Always call Claude with ambient context for more precise suggestions.

---

## Claude's Discretion

- "New/unfamiliar cwd" heuristic without full event log
- Shell transport fields vs. client-side history read for last command / exit code
- TUI ambient header copy and styling
- Empty-query prompt template structure

## Deferred Ideas

- Event log on accepted commands (`events.jsonl`)
- SQLite pattern index for cache hits
- Precmd proactive post-error suggestions
- Full "learn from every interaction" loop from original Phase 7 goal
