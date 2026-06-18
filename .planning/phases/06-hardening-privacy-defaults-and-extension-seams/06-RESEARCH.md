# Phase 6: Hardening, Privacy Defaults, and Extension Seams - Research

**Researched:** 2026-06-17
**Domain:** Safety guards, privacy-aware context filtering, extension registry wiring, MVP packaging
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from ROADMAP, PROJECT.md, and upstream phase decisions)

No Phase 6 CONTEXT.md exists. Constraints below are synthesized from locked roadmap success criteria, project constraints, and deferred items from Phases 2 and 3.2 that Phase 6 explicitly owns.

### Locked Decisions

- **Insertion-only (CMD-04):** QueQue never auto-executes commands in v1. Selected commands are written to `LBUFFER`/`RBUFFER`; the user presses Enter to run. (PROJECT.md, REQUIREMENTS.md CMD-04)
- **Privacy-forward defaults:** No persistent history by default. File content must not leave the machine without explicit opt-in. (PROJECT.md Out of Scope / Constraints)
- **Phase 2 D-05/D-06 (file access):** Context providers may surface file *names* only (git porcelain, query parsing). File content parsing requires explicit user opt-in — mechanism TBD in Phase 6.
- **Extension seams over hardcoding:** Built-ins register through registries (`context-providers`, `provider-backends`, `shell-adapters`, `storage-hooks`). Direct imports that bypass registries should be converted in Phase 6.
- **Phase 5 deferred:** Clarification chat is out of scope. Phase 6 proceeds after Phase 4 without Phase 5.
- **Zellij preferred, non-Zellij revived:** Phase 3.2 made Zellij the primary path; non-Zellij inline rendering was deferred to Phase 6. Current `shell/zsh/queque.zsh` already implements both Zellij (FIFO) and inline (foreground) paths — Phase 6 should harden and document both rather than remove inline.

### Claude's Discretion

- Exact privacy filter rules (sensitive path patterns, env var names to redact from logs/API payloads).
- Provider registry shape: extend descriptor registry vs. add `resolveActiveAdapter()` module — as long as `run-foreground.ts` stops importing `fetchCandidates` directly from `claude.ts`.
- Whether to implement daemon socket auth (CR-005 TODO) in Phase 6 or defer to Phase 7/8.
- Cleanup of Phase 1 test scaffolding (`resultMode: 'replace-buffer-fixture'`, `MODAL_VIEWPORT_LINES` scroll hack) — recommended but not blocking.
- Documentation location for expansion path (README vs. new `docs/EXTENSIONS.md`).

### Deferred Ideas (OUT OF SCOPE)

- Phase 5 in-TUI clarification chat.
- Phase 7 local learning / event log / SQLite pattern index.
- Phase 8 zero-config multi-provider routing (Ollama, Claude CLI subprocess adapters).
- Public plugin marketplace and dynamic plugin loading.
- Cross-shell adapters beyond documenting the zsh seam for future bash/fish work.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMD-04 | Tool never auto-executes commands in v1; it only returns them to the shell buffer | Verified: `queque.zsh` `_qq_apply_result_str` sets buffers only; no `eval`, `source`, or `zle -s` on candidate text. Phase 6 adds explicit guards, tests, and documentation to make this fail-closed and auditable. |
</phase_requirements>

---

## Summary

Phase 6 is a **hardening and architecture-consolidation phase**, not a feature phase. Phases 1–4 delivered a working daily-driver path: ZLE widget → Ink TUI → Claude → FIFO result → buffer replacement. The codebase is ~148 automated tests green (14 test files), ships as `@k-leumas/queque-cli` 0.3.8, and already implements insertion-only shell behavior.

What remains for daily-driver confidence:

1. **06-01 (Safety + privacy):** Enforce and document privacy defaults that Phase 2 designed but did not fully operationalize — especially debug-log redaction, outbound API payload filtering, and an explicit opt-in gate for any future file-content reads. Add CMD-04 safety assertions (no execution paths, optional destructive-command UI warnings).
2. **06-02 (Extension seams):** Close the largest registry bypass: `run-foreground.ts` imports `fetchCandidates` directly from `claude.ts` while `bootstrapBuiltins()` only registers a descriptor in `provider-backends`. Wire provider resolution through a registry-backed resolver; align `detectProvider()` prototype with that resolver without implementing Phase 8 backends yet.
3. **06-03 (MVP packaging):** Update user-facing docs for privacy defaults, dual Zellij/inline paths, and the next expansion path (Phase 7 local learning, Phase 8 provider detection, plugin seams). Refresh stale references (`qq.zsh` → `queque.zsh`, outdated SYSTEM_DESIGN.md).

**Primary recommendation:** Treat Phase 6 as three audit-and-wire passes — privacy filter layer → provider resolver → docs/packaging — each with targeted tests. Avoid new features; extend existing registries minimally.

---

## Current State Assessment

### Architectural flow (verified in codebase)

```
ZSH widget (shell/zsh/queque.zsh)
  ├─ Zellij path: mkfifo → zellij run → qq client → FIFO
  └─ Inline path: foreground qq client → result.json
         │
         ▼
run-foreground.ts
  ├─ detectProvider()          ← gate only; does not select adapter
  ├─ gatherContext()           ← uses context-providers registry ✓
  ├─ fetchCandidates()         ← DIRECT import from claude.ts ✗ bypass
  └─ writeShellResult()        ← Zod-validated ShellResult ✓
```

### Key files and status

| Area | Path | Status |
|------|------|--------|
| Foreground orchestrator | `src/client/run-foreground.ts` | Works; registry bypass on provider; logs full request object |
| Claude adapter | `src/providers/claude.ts` | Implements `LLMAdapter`; builds API prompt from envelope |
| Provider detection (prototype) | `src/providers/detect.ts` | Priority chain: anthropic-key → claude-cli → ollama → openai-key → none; **not wired to adapter selection** |
| Provider contract | `src/providers/provider.ts` | `LLMAdapter { fetchCandidates(envelope) }` |
| Provider registry | `src/registry/provider-backends.ts` | **Descriptor-only** (id, name, description) — no callable instances |
| Built-in bootstrap | `src/registry/bootstrap.ts` | Registers context providers, zsh adapter descriptor, storage hook descriptors, claude **descriptor** — not `claudeAdapter` instance |
| Context pipeline | `src/context/pipeline.ts` | Iterates `listContextProviders()` correctly |
| Git context | `src/context/providers/git-context.ts` | File names via `git status --porcelain`; no content |
| Filesystem context | `src/context/providers/filesystem-context.ts` | Regex filename from query; no disk I/O |
| Context schema | `src/contracts/request.ts` | D-05/D-06 enforced in Zod — no content fields in chunk variants |
| Shell widget | `shell/zsh/queque.zsh` | Insertion-only; jq JSON parse; Zellij + inline paths |
| Debug logging | `src/shared/debug-log.ts` | Writes to `/tmp/qq-*-debug.log` with mode 0o600; **may log full lbuffer** |
| Daemon IPC | `src/daemon/server.ts` | CR-005 TODO: no session token auth |
| Init / packaging | `src/cli/commands/init.ts`, `package.json` | npm bin `qq`; ships `dist/` + `shell/` |

### Registry bypass inventory

| Bypass | Location | Severity |
|--------|----------|----------|
| `import { fetchCandidates } from '../providers/claude.js'` | `run-foreground.ts:10,282` | **High** — blocks multi-provider and plugin model |
| `detectProvider()` used only as gate, not resolver | `run-foreground.ts:97-108` | **Medium** — prototype ahead of Phase 8 |
| `registerProviderBackend({ id: 'claude', ... })` without instance | `bootstrap.ts:41-45` | **High** — registry is metadata theater |
| `shellName: 'zsh'` hardcoded | `base-context.ts:13`, `request.ts` schema | **Low** — acceptable for v1; shell-adapters registry unused |
| Storage hooks registered but never invoked | `registry/storage-hooks.ts` | **Low** — intentional seam for Phase 7 |
| `claudeAdapter` exported but never bound to registry | `claude.ts:155-157` | **Medium** — ready but unwired |

### Privacy exposure points (live audit)

| Surface | What leaks | Risk |
|---------|-----------|------|
| Claude API prompt | `queryText`, `cwd`, git `branch`/`dirty`/`changedFiles[]` | **Medium** — changed file paths may include `.env`, credentials filenames |
| Debug log (`appendDebugLog`) | Full `request` object incl. `lbuffer`/`rbuffer`; pipeline logs `lbuffer` | **Medium** — default log path `/tmp/qq-*-debug.log` |
| `.env.local` lookup | `readEnvValueFromDotEnvLocal` walks up from `cwd` for API keys only | **Low** — keys not sent to API in prompt; only used locally |
| Git provider | `changedFiles` array sent in prompt JSON | **Medium** — path names only, but may reveal project structure |
| Daemon socket | Unauthenticated Unix socket in `/tmp` | **Low-Medium** — local user only; CR-005 noted |

### Gaps vs success criteria

| # | Success criterion | Current state | Gap |
|---|-------------------|---------------|-----|
| 1 | Insertion-only, never auto-executes | Shell widget sets buffers; user runs Enter | Missing explicit CMD-04 test contract; no candidate safety lint/warning |
| 2 | Privacy defaults documented and enforced | Zod schema blocks file content; D-05/D-06 in comments | No runtime filter layer; debug logs over-log; no README privacy section; opt-in gate not implemented |
| 3 | Built-ins use registries consistently | Context pipeline ✓; provider ✗ | Wire `claudeAdapter` through resolver; stop direct `claude.ts` import in client |
| 4 | Ready for cross-OS zsh + plugins | Registries exist as stubs; inline path present | Document adapter registration API; fix doc drift; optional `QQ_PANE_*` env vars |

### Non-Zellij path (Phase 3.2 deferred → Phase 6)

Phase 3.2 CONTEXT deferred non-Zellij to Phase 6. Current code **already restored** inline support:

- `queque.zsh:267-278` — foreground client, regular `result.json`
- `run-foreground.ts:199-207` — `MODAL_VIEWPORT_LINES` scroll reserve when `!inZellij`

Phase 6 should **harden and document** this path (README, CONTRIBUTING), not delete it. Zellij remains the recommended UX; inline is the cross-terminal fallback.

---

## Recommended Approach by Plan

### 06-01: Safety guards and privacy-aware context filtering

**Goal:** Make privacy defaults operational and CMD-04 auditable.

**Recommended tasks:**

1. **Privacy filter module** (`src/context/privacy-filter.ts` or `src/shared/privacy-filter.ts`):
   - `filterContextEnvelope(envelope): ContextEnvelope` — redact sensitive path segments from `git.changedFiles` (e.g. `.env*`, `*credentials*`, `*.pem`, `id_rsa`, `.ssh/`).
   - `redactForLog(details): unknown` — strip/replace `lbuffer`, `rbuffer`, and path lists in debug log payloads.
   - Apply filter in `gatherContext()` before return **and** in `claude.ts` `buildPrompt()` as defense-in-depth.

2. **Opt-in gate for file content** (Phase 2 D-06 closure):
   - Env var `QQ_ALLOW_FILE_READ=1` (default off). No provider reads file bytes in Phase 6 — gate exists so Phase 7+ cannot accidentally add reads without checking.
   - Document in README under "Privacy defaults".

3. **CMD-04 safety guards:**
   - Add `assertInsertionOnly()` documentation comment at shell contract boundary.
   - Test: `zsh-widget.test.ts` asserts no subprocess spawned with candidate command (grep widget for `eval|source|zle -s` — already absent; add negative assertion test).
   - Optional UI: `CandidateSelect` shows a subtle warning badge when command matches destructive patterns (`rm -rf`, `sudo`, `chmod -R`, `> /dev/`, `curl | sh`) — **warn only**, do not block (user control preserved).

4. **Debug log hardening:**
   - Replace `appendDebugLog('client', 'request parsed', request)` with redacted summary (`lbufferLength`, `cwd`, `shellPid`).
   - Same for `context/pipeline.ts` `lbuffer` log → log `queryLength` only unless `QQ_DEBUG_VERBOSE=1`.

5. **Documentation:** README section "What QueQue sends to Claude" listing base context + git metadata + explicit "never sends file contents".

### 06-02: Audit extension seams and registry-backed modules

**Goal:** Single resolution path for LLM adapters; built-ins register instances at bootstrap.

**Recommended design (minimal diff):**

```typescript
// src/providers/resolver.ts (new)
export interface RegisteredProvider {
  descriptor: ProviderBackendDescriptor;
  adapter: LLMAdapter;
}

export function registerProvider(registration: RegisteredProvider): void;
export function resolveAdapter(detected: DetectedProvider): LLMAdapter;
```

- Extend `bootstrap.ts` to call `registerProvider({ descriptor: {...}, adapter: claudeAdapter })`.
- `resolveAdapter()` maps `detected.kind === 'anthropic-key'` → claude adapter; other kinds throw clear "not yet implemented" until Phase 8.
- `run-foreground.ts` changes:
  ```typescript
  const detected = await detectProvider();
  const adapter = resolveAdapter(detected);
  // ...
  adapter.fetchCandidates(envelope)
  ```
- Keep `provider-backends.ts` as the descriptor store **or** merge into resolver — planner picks one file; avoid duplicate registries.
- Add `tests/provider-resolver.test.ts`: bootstrap registers claude; resolve returns adapter for anthropic-key; ollama-kind throws with helpful message.

**Do not hand-roll in Phase 6:**
- Ollama/OpenAI/Claude CLI adapter implementations (Phase 8).
- Plugin dynamic import / manifest loading (post-MVP).
- Daemon session tokens (optional; document as follow-up if descoped).

### 06-03: Package MVP for daily-driver usage and document expansion path

**Goal:** A developer can install, understand privacy boundaries, and see where the project goes next.

**Recommended deliverables:**

1. **README updates:**
   - Privacy defaults section (from 06-01).
   - Zellij recommended + inline fallback explained.
   - `qq init zsh` path references `queque.zsh` (fix any `qq.zsh` drift in docs).

2. **Expansion path doc** (short section in README or `docs/EXTENSIONS.md`):
   - **Phase 7:** `storage-hooks` registry → local event log, no cloud.
   - **Phase 8:** `detectProvider()` + `resolveAdapter()` → Ollama, Claude CLI, OpenAI.
   - **Plugins:** `registerContextProvider`, `registerProvider` API for future manifest loading.
   - **Cross-OS zsh:** Homebrew prefix list in `init.ts` already includes Linuxbrew; document macOS + Linux zsh paths.

3. **Stale doc refresh:**
   - `docs/SYSTEM_DESGN.md` still describes TUI/daemon as "placeholders" — update to reflect Phases 3–4 reality or add banner pointing to README.

4. **Optional env vars (Phase 3.2 deferred):**
   - `QQ_PANE_WIDTH` / `QQ_PANE_HEIGHT` for Zellij pane in `queque.zsh` (defaults 80×24).

5. **Daily-driver checklist in CONTRIBUTING.md:**
   - Build, test, `QQ_DEV_ROOT`, debug log opt-in, privacy env vars.

---

## Standard Stack

Phase 6 uses the locked project stack. No new runtime dependencies expected.

### Core (in use, no changes)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `zod` | 4.1.5 | Contract validation | Extend with privacy filter tests, not schema changes unless adding opt-in fields |
| `@anthropic-ai/sdk` | 0.92.0 | Claude provider | Unchanged; accessed via resolver |
| `vitest` | 4.0.4 | Tests | ~148 tests across 14 files |
| `cac` | 7.0.0 | CLI | Unchanged |
| `ink` | 7.0.1 | TUI | Optional destructive-command badge only |

**Installation:** No new packages.

---

## Architecture Patterns

### Pattern 1: Privacy filter at envelope boundary

**What:** Single pure function filters outbound context before logging and API calls.

```typescript
// Recommended shape — implement in Phase 6
export function filterContextEnvelope(envelope: ContextEnvelope): ContextEnvelope {
  return {
    ...envelope,
    extras: envelope.extras.map((chunk) =>
      chunk.kind === 'git'
        ? {
            ...chunk,
            payload: {
              ...chunk.payload,
              changedFiles: chunk.payload.changedFiles.filter(
                (p) => !isSensitivePath(p),
              ),
            },
          }
        : chunk,
    ),
  };
}
```

**When:** Always after `gatherContext()`, before `fetchCandidates()` and debug logs.

### Pattern 2: Registry-backed provider resolution

**What:** Bootstrap registers `{ descriptor, adapter }`; client calls `resolveAdapter(detectProvider())`.

**When:** Any code that needs LLM candidates — only `run-foreground.ts` today.

### Pattern 3: Insertion-only shell contract (existing, preserve)

**What:** `ShellResult` kinds are `cancel | replace-buffer | error` only. Widget applies buffers; never executes.

```102:140:shell/zsh/queque.zsh
    replace-buffer)
      // ...
      LBUFFER="$new_lbuffer"
      RBUFFER="$new_rbuffer"
      return 0
      ;;
```

### Anti-Patterns to Avoid

- **Blocking destructive commands:** Violates user control and CMD-04 spirit (insertion-only ≠ command approval gate).
- **Reading file content without opt-in:** Violates Phase 2 D-05/D-06.
- **Logging full lbuffer/rbuffer by default:** Violates privacy-forward defaults.
- **Second parallel provider registry:** Extend existing bootstrap/resolver, don't add `ProviderRegistry2`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Provider instance lookup | Ad-hoc switch in run-foreground | `resolveAdapter()` + bootstrap registration | Phase 8 adds backends in one place |
| Sensitive path detection | Full secrets scanner | Small denylist regex set + unit tests | MVP scope; expand iteratively |
| JSON shell result validation | Manual parsing | `shellResultSchema` (existing) | Already fail-closed |
| Context provider iteration | Inline git/fs logic in client | `gatherContext()` + registry | Already correct |
| FIFO result write | Custom pipe handling | `writeShellResult()` | FIFO vs file already handled |

---

## Threat Model and Pitfalls

### Threat model (STRIDE-lite)

| Threat | Vector | Current mitigation | Phase 6 action |
|--------|--------|-------------------|----------------|
| **Command execution without consent** | Malicious/code bug auto-runs candidate | Widget only sets buffers | CMD-04 tests + code audit; no new exec paths |
| **Sensitive data to LLM** | Git changedFiles, query text in prompt | User triggers intentionally | Filter paths; document payload |
| **Local log disclosure** | Debug log in `/tmp` | mode 0o600 | Redact query text by default |
| **Shell injection via result JSON** | Crafted lbuffer in result | jq parse, no eval | Keep; test malformed JSON paths |
| **FIFO/path tampering** | `QQ_RESULT_FILE` env | Regex guard in main.ts | Extend pattern if inline path uses same dir |
| **Daemon IPC hijack** | Local user connects to socket | Same UID | Document CR-005; optional token in 06-02 if low effort |

### Pitfall 1: detectProvider vs resolveAdapter mismatch

**What goes wrong:** User has Ollama running; `detectProvider` returns `{ kind: 'ollama' }`; client passes gate but still calls Claude or crashes.

**Why:** Detection was added as prototype without adapter wiring.

**How to avoid:** `resolveAdapter` must handle every non-`none` kind explicitly — either return adapter or throw user-visible error. Until Phase 8, only `anthropic-key` resolves; others get "detected but not yet supported" message.

### Pitfall 2: Privacy filter breaks git context usefulness

**What goes wrong:** Over-aggressive redaction removes all `changedFiles`; Claude loses useful signal.

**How to avoid:** Redact known-sensitive patterns only; log redaction counts in debug verbose mode.

### Pitfall 3: Registry refactor breaks tests

**What goes wrong:** `client-result.test.ts` mocks `../providers/claude.js` directly.

**How to avoid:** Mock `resolveAdapter` or provider resolver module; update vi.mock paths in same PR as wiring change.

### Pitfall 4: Documentation drift (`qq.zsh` vs `queque.zsh`)

**What goes wrong:** Users source wrong file after Homebrew install.

**How to avoid:** Grep docs for `qq.zsh`; align to `queque.zsh` and `qq init zsh` output.

### Pitfall 5: Removing inline path during "cleanup"

**What goes wrong:** Non-Zellij users lose QueQue entirely.

**How to avoid:** Phase 6 hardens inline path; Zellij remains recommended in README, not required in code.

---

## Code Examples

### Verified: Context envelope schema blocks file content

```74:94:src/contracts/request.ts
export const contextChunkSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('git'),
    payload: z.object({
      // ...
      /** File paths only (from git status --porcelain). No diff content, no file bytes. */
      changedFiles: z.array(z.string()),
    }),
  }),
  // ...
]);
```

### Verified: Direct provider bypass (to fix in 06-02)

```10:11:src/client/run-foreground.ts
import { fetchCandidates } from '../providers/claude.js';
import { detectProvider } from '../providers/detect.js';
```

### Verified: detectProvider priority chain (prototype)

```47:79:src/providers/detect.ts
export async function detectProvider(): Promise<DetectedProvider> {
  if (process.env.ANTHROPIC_API_KEY || readEnvValueFromDotEnvLocal('ANTHROPIC_API_KEY')) {
    return { kind: 'anthropic-key' };
  }
  // ... claude-cli, ollama, openai-key ...
  return { kind: 'none', message: '...' };
}
```

### Verified: Descriptor-only registry

```8:12:src/registry/provider-backends.ts
export interface ProviderBackendDescriptor {
  id: string;
  name: string;
  description: string;
}
```

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
| CMD-04 | Shell widget never executes candidate command | unit (zsh) | `pnpm test:run -- tests/zsh-widget.test.ts` | ✅ (extend) |
| CMD-04 | Client has no exec/spawn of candidate text | unit | `pnpm test:run -- tests/client-result.test.ts` | ✅ (extend) |
| Privacy | Sensitive paths redacted from envelope | unit | `pnpm test:run -- tests/privacy-filter.test.ts` | ❌ Wave 0 |
| Privacy | Debug log redacts lbuffer by default | unit | `pnpm test:run -- tests/debug-log.test.ts` | ❌ Wave 0 |
| EXT | Provider resolver returns claude adapter for anthropic-key | unit | `pnpm test:run -- tests/provider-resolver.test.ts` | ❌ Wave 0 |
| EXT | run-foreground uses resolver not direct claude import | unit | `pnpm test:run -- tests/client-result.test.ts` | ✅ (update mocks) |

### Sampling Rate

- **Per task commit:** `pnpm test:run`
- **Per wave merge:** `pnpm test:run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/privacy-filter.test.ts` — sensitive path redaction, envelope passthrough for safe paths
- [ ] `tests/provider-resolver.test.ts` — bootstrap + resolveAdapter mapping
- [ ] `tests/debug-log.test.ts` — redactForLog strips query text
- [ ] Extend `tests/zsh-widget.test.ts` — CMD-04 explicit "no execution" assertion
- [ ] Update `tests/client-result.test.ts` — mock resolver instead of `claude.js` after 06-02

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js LTS | qq runtime | ✓ | v26.3.0 | — |
| zsh | Shell widget tests | ✓ | system | — |
| jq | Widget JSON parse | ✓ | system | — |
| Zellij | Recommended UX | ✓ | 0.44.1 | Inline path in queque.zsh |
| pnpm | Build/test | ✗ in sandbox | 10.x (lockfile) | npm compatible |
| ANTHROPIC_API_KEY | Runtime LLM | runtime env | — | Mock in tests |

**Missing dependencies with no fallback:** None for Phase 6 implementation (code + unit tests).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Phase 6 action |
|--------------|------------------|--------------|----------------|
| Direct `fetchCandidates` import | Should use resolver | Phase 3 deferred to Phase 6 | Wire in 06-02 |
| Metadata-only provider registry | Needs instance binding | Phase 2 stub | Extend in 06-02 |
| Privacy in schema comments only | Needs runtime filter | Phase 2 D-05/D-06 | Implement in 06-01 |
| Zellij-only (Phase 3.2 plan) | Dual Zellij + inline | Post-3.2 code drift | Document both in 06-03 |
| `resultMode` test scaffolding | Still in run-foreground | Phase 1 | Optional cleanup |

---

## Open Questions

1. **Daemon socket authentication (CR-005) — Phase 6 or later?**
   - What we know: TODO in `daemon/server.ts`; local UID isolation provides partial protection.
   - Recommendation: Document in expansion path; implement only if planner estimates < half-day. Not blocking CMD-04.

2. **Should detected-but-unsupported providers error or fall through to Claude?**
   - What we know: Ollama may be running while user has ANTHROPIC_API_KEY; detect order prefers anthropic-key first.
   - Recommendation: Strict resolution — no silent fallthrough. Clear error message listing detected vs active provider.

3. **Destructive command UI warning — in or out of Phase 6?**
   - Recommendation: Include as optional 06-01 polish if timeboxed; warn-only badge in `CandidateSelect`.

---

## Sources

### Primary (HIGH confidence)

- Live codebase audit: `src/client/run-foreground.ts`, `src/providers/*`, `src/registry/*`, `src/context/*`, `shell/zsh/queque.zsh`
- `.planning/ROADMAP.md` — Phase 6 goal, plans, success criteria
- `.planning/REQUIREMENTS.md` — CMD-04
- `.planning/phases/02-intent-router-and-context-pipeline/02-CONTEXT.md` — D-05/D-06 privacy gate
- `.planning/phases/03.2-zellij-floating-pane-integration-for-best-ux/03.2-CONTEXT.md` — non-Zellij deferred to Phase 6
- `.planning/phases/04-fuzzy-tui-selection-ux/04-RESEARCH.md` — format reference

### Secondary (MEDIUM confidence)

- `.planning/PROJECT.md` — privacy-forward defaults, insertion-only constraint
- `.planning/phases/03-claude-fast-path-and-ranked-suggestions/03-RESEARCH.md` — Open Question #1 on registry instance lookup (resolved: Phase 6)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; locked versions in package.json
- Architecture: HIGH — direct codebase audit with file paths
- Pitfalls: HIGH — derived from known bypasses and Phase 2/3.2 deferred items
- Test coverage: MEDIUM — Wave 0 gaps identified; exact test count not re-run (pnpm unavailable in research sandbox)

**Research date:** 2026-06-17
**Valid until:** 2026-07-17 (stable hardening phase; low external API churn)
