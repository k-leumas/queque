# Phase 2: Intent Router and Context Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 02-intent-router-and-context-pipeline
**Areas discussed:** Codebase intent signals, Git context depth, Filesystem context payload

---

## Codebase Intent Signals

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit file path required | Only classify as codebase if query contains a plausible file path (src/, .ts, .py, /). Conservative gate. | ✓ |
| Code-flavored verbs + any path signal | Classify if query has code verbs OR any path signal. Broader. | |
| Claude decides | Keep classifier minimal in Phase 2; Phase 3 refines with LLM. | |

**User's choice:** Explicit file path required

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — treat npm/pnpm/yarn scripts as codebase | Package manager commands get git context even without file path | ✓ |
| No — treat as shell-command | Consistent with strict path-required rule | |
| You decide | Claude handles edge case | |

**User's choice:** Yes — npm/pnpm/yarn scripts classify as codebase

---

| Option | Description | Selected |
|--------|-------------|----------|
| All 'git *' commands get git context | Any query starting with 'git ' gets git context. Simple rule. | ✓ |
| Only working-tree commands | git status, diff, add, commit, push — yes. git log, remote, stash — no. | |

**User's choice:** All 'git *' commands get git context

**Notes:** User clarified mid-discussion: there must be an explicit gate/flag before the tool reads any file contents. For now, only file names are permitted in context (not file content). File content parsing to be revisited in a later phase with an opt-in mechanism.

---

## Git Context Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Branch + dirty flag only | Keep existing detectVcsContext output. Fastest. | |
| Branch + dirty + changed file names | Adds git status --porcelain file names. One extra git call. File names only (consistent with privacy gate). | ✓ |
| Branch + dirty + file names + recent commits | Also adds git log --oneline -5. Most context, two extra git calls. | |

**User's choice:** Branch + dirty + changed file names

---

## Filesystem Context Payload

| Option | Description | Selected |
|--------|-------------|----------|
| Cwd path only | Minimal. Safe. Phase 3 can expand. | |
| Cwd + apparent filename from query text | Extract filename-looking token from query. String parse, no disk I/O. | ✓ |
| Cwd + shallow directory listing | ls cwd, file names only. One extra I/O call. | |

**User's choice:** Cwd + apparent filename from query text

---

## Claude's Discretion

- Exact intent signal keyword/regex table contents
- ContextChunk serialization format for prompt assembly
- Registry duplicate-ID error message format
- zsh shell adapter descriptor shape
- memory/noop storage hook descriptor shape

## Deferred Ideas

- File content parsing opt-in gate — user flagged explicitly; revisit in Phase 6 or dedicated phase
- LLM-assisted intent scoring — Phase 3+
- Directory listing in filesystem context — sensitive without file access gate; deferred
