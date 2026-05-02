# Phase 2: Intent Router and Context Pipeline - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the typed routing layer between the shell bridge (Phase 1) and the LLM (Phase 3). Three deliverables: a deterministic intent classifier, a two-pass context pipeline with intent-gated providers, and typed extension registries. The product becomes general-purpose only when extra context is chosen by routed intent — not by the cwd being inside a git repo.

</domain>

<decisions>
## Implementation Decisions

### Intent Classification

- **D-01:** `codebase` intent requires an **explicit file path signal** in the query text (e.g. `src/`, `.ts`, `.py`, `/`, a filename pattern). Code-flavored verbs alone (`fix`, `debug`, `refactor`) without a path do NOT qualify as codebase. Keeps git context out of general "fix my tests" requests.
- **D-02:** Package manager script commands (`npm test`, `pnpm build`, `yarn lint`, `pnpm run *`) classify as `codebase` even without an explicit file path. These are inherently code-project commands.
- **D-03:** Any query starting with `git ` routes as `shell-command` intent but **always receives git context** from the git provider regardless of the broader intent gate. All `git *` sub-commands qualify — no sub-command exclusions.
- **D-04:** Phase 2 classifier is fully deterministic and local (no LLM calls). Phase 3 can layer LLM-assisted intent refinement on top once the provider path is live.

### File Access Privacy Gate (CRITICAL)

- **D-05:** **Explicit user opt-in is required before the tool reads any file contents.** This gate applies globally — context providers in Phase 2 may only surface file *names* (from `git status --porcelain`, query text parsing, etc.), never file content.
- **D-06:** File content parsing (reading actual file bytes/text) is **deferred** to a future phase behind an explicit opt-in mechanism. No file content must appear in any context chunk in Phase 2.

### Git Context Provider

- **D-07:** The git provider gathers: `{ branch, dirty, changedFiles[] }` — branch name, dirty flag, and changed file names from `git status --porcelain` (file names only, no content, consistent with D-05/D-06).
- **D-08:** The existing `detectVcsContext` in `src/shared/vcs-context.ts` should be extended or wrapped to add `changedFiles` from `git status --porcelain`. File names only — no diff content.
- **D-09:** Git provider runs for: (a) `codebase` intent requests, (b) any `shell-command` query starting with `git `.

### Filesystem Context Provider

- **D-10:** Filesystem provider contributes: `{ cwd, apparentFilename }` — the working directory plus any filename-looking token extracted from the query text (e.g. `hero-banner.png` from "rename this png to hero-banner.png"). String parse only — no disk I/O, no directory listing.
- **D-11:** Filesystem provider runs for `filesystem` intent requests only.

### Claude's Discretion

- Intent keyword/syntax signal table specifics (exact keywords, regex patterns) — Claude picks the simplest table consistent with D-01 through D-04.
- `ContextChunk` serialization format for prompt assembly — Claude decides the shape as long as base + extras chunks are clearly separated in the assembled prompt.
- Registry duplicate-ID behavior — throw with explicit error message including the conflicting ID (as specified in plans).
- `zsh` shell adapter descriptor shape and `memory`/`noop` storage hook descriptor shape — Claude picks reasonable stubs consistent with the registry contract.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Shell Contract
- `src/contracts/shell.ts` — `ShellRequest` and `ShellResult` types; the boundary Phase 2 normalizes behind

### Existing Context Infrastructure
- `src/shared/vcs-context.ts` — existing `detectVcsContext` that git provider will wrap/extend
- `src/providers/claude.ts` — current prompt-building and `buildPrompt` logic that Phase 2 rewires

### Phase Context
- `.planning/phases/02-intent-router-and-context-pipeline/02-RESEARCH.md` — research notes for this phase
- `.planning/phases/02-intent-router-and-context-pipeline/02-VALIDATION.md` — validation criteria

### Requirements Traceability
- `.planning/REQUIREMENTS.md` §Intent and Context — INT-01, INT-02, INT-03, EXT-01 are the requirements this phase closes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/shared/vcs-context.ts:detectVcsContext` — already fetches branch + dirty; extend to add `changedFiles` via `git status --porcelain`
- `src/contracts/shell.ts` — `ShellRequest` shape (lbuffer, rbuffer, cwd, ttyPath, shellPid) is the normalization input
- `src/client/run-foreground.ts` — foreground path that gets the normalization + context pipeline wired in

### Established Patterns
- Zod schemas for all contracts — every new type (NormalizedRequest, ContextChunk, ContextProvider) gets a Zod schema
- Module-level exports with named functions — `buildBaseContext`, `classifyIntent`, `gatherContext` follow the existing pattern
- Debug log via `appendDebugLog` — existing pattern for tracing without blocking user flow

### Integration Points
- `src/client/run-foreground.ts` → normalization → context pipeline → `src/providers/claude.ts`
- `src/context/providers/index.ts` → `src/registry/context-providers.ts` (new in Plan 02-03)
- `src/shared/vcs-context.ts` is consumed by `src/providers/claude.ts` today; after Phase 2 it is consumed only by `src/context/providers/git-context.ts`

</code_context>

<specifics>
## Specific Ideas

- The zsh widget strips the trailing `?` before sending lbuffer — `queryText = lbuffer.trim()` is already clean, no further stripping needed.
- `shellName` is hardcoded to `'zsh'` in base context for Phase 2; cross-shell support is v2 scope.
- File content parsing deferred with explicit note: "revisit file content parsing with user opt-in gate in a later phase."

</specifics>

<deferred>
## Deferred Ideas

- **File content parsing** — User explicitly flagged that reading file contents requires an explicit opt-in gate. Mechanism TBD — note for Phase 6 (hardening + privacy defaults) or a dedicated phase.
- **LLM-assisted intent scoring** — Phase 2 classifier is deterministic only. LLM-aided refinement (e.g. confidence scoring on ambiguous queries) belongs in Phase 3 or later.
- **Directory listing in filesystem context** — `ls cwd` would give the LLM better signal for filesystem requests but involves disk I/O and file names that could be sensitive. Deferred; revisit with the file access gate.

</deferred>

---

*Phase: 02-intent-router-and-context-pipeline*
*Context gathered: 2026-05-02*
