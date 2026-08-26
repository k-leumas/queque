---
phase: 08-zero-config-install-and-provider-detection
plan: 02
subsystem: providers
tags: [claude-cli, claude-p, sdk-rescue, execFileAsync, vitest, ink]

requires:
  - phase: 08-zero-config-install-and-provider-detection
    provides: platform-aware claudeAuthPresent leftover preflight (not the 08-02 fetch gate)
  - phase: 06-hardening-privacy-defaults-and-extension-seams
    provides: LLMAdapter registry, filterContextEnvelope, FIFO error ShellResult
provides:
  - Claude-default composite (claude -p then env-key SDK rescue) registered as claude-cli
  - execFileAsync mockable spawn surface returning { stdout, stderr }
  - remainingMs + MIN_SDK_RESCUE_MS shared 25s CLI+SDK budget
  - resolveClaudeDefaultAdapter hot path that bypasses detectProvider
affects:
  - 08-03-provider-pin-and-openai-ollama
  - foreground FIFO error copy

tech-stack:
  added: []
  patterns:
    - "Mock thin execFileAsync resolving { stdout, stderr }; never raw execFile + promisify"
    - "Register claudeDefaultAdapter as claude-cli; keep raw claudeCliAdapter unregistered"
    - "Shared 25s deadline via remainingMs(deadline) and MIN_SDK_RESCUE_MS = 1000"

key-files:
  created:
    - src/providers/claude-exec.ts
    - src/providers/claude-cli.ts
    - src/providers/claude-default.ts
    - tests/claude-cli-provider.test.ts
  modified:
    - src/providers/claude.ts
    - src/providers/resolver.ts
    - src/providers/index.ts
    - src/registry/bootstrap.ts
    - src/client/run-foreground.ts
    - tests/registry-bootstrap.test.ts
    - tests/provider-resolver.test.ts
    - tests/client-result.test.ts
    - docs/EXTENSIONS.md

key-decisions:
  - "Register the CLI+SDK composite as claude-cli, not raw claudeCliAdapter"
  - "Keep the prompt as last argv with stdin ignore (accepted ps disclosure T-08-02-07)"
  - "none/ollama/openai-key resolve to Claude default as an 08-02 bridge until 08-03 pinning"

patterns-established:
  - "Spawn argv: -p --output-format text --safe-mode --tools \"\" --no-session-persistence --system-prompt QUEQUE_SYSTEM prompt; never --bare"
  - "FIFO error messages keep a single QueQue: prefix"
  - "detectProvider remains leftover preflight; runtime selector is resolveClaudeDefaultAdapter"

requirements-completed: [RUN-01, EXT-01]

duration: 12min
completed: 2026-08-26
---

# Phase 08 Plan 02: Claude CLI-First Fetch with SDK Rescue Summary

**CLI-first `claude -p` composite with Anthropic SDK rescue, registered as `claude-cli`, so `??` works from `/login` or `ANTHROPIC_API_KEY` with no provider quiz**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-26T03:47:52Z
- **Completed:** 2026-08-26T04:00:10Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments
- Spawn `claude -p` with `--safe-mode`, `--tools ""`, ignored stdin, and the privacy-filtered prompt as last argv
- Rescue via the existing Anthropic SDK adapter when CLI is missing or fails and a key exists in env or `.env.local`, under a shared 25s budget
- Bypass `detectProvider()` as the hot-path selector; map none/ollama/openai-key to Claude default until 08-03 pinning
- FIFO errors use D-13 `/login` copy with a single `QueQue:` prefix; shell buffer stays unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 tests for Claude CLI spawn, SDK rescue, and registry id** - `038f683` (test)
2. **Task 2: Implement claude -p adapter, composite SDK rescue, and bootstrap registration** - `f42dec1` (feat)
3. **Task 3: Bypass detect selector, resolve Claude default, FIFO errors, docs** - `29d7318` (feat)

_Note: TDD Task 1 RED included throw-on-call stubs so pre-commit `tsc` could commit missing-module tests._

## Files Created/Modified
- `src/providers/claude-exec.ts` - thin `execFileAsync` returning `{ stdout, stderr }`
- `src/providers/claude-cli.ts` - unregistered raw `claude -p` adapter
- `src/providers/claude-default.ts` - CLI-first composite, `remainingMs`, `MIN_SDK_RESCUE_MS`
- `src/providers/claude.ts` - exported `QUEQUE_SYSTEM` / `buildPrompt` / `parseCandidates`; optional `timeoutMs`
- `src/registry/bootstrap.ts` - registers `claudeDefaultAdapter` as `claude-cli`
- `src/providers/resolver.ts` - `resolveClaudeDefaultAdapter()`; 08-02 Claude-default bridge
- `src/client/run-foreground.ts` - resolve via registry; no `detectProvider`; single FIFO prefix
- `tests/claude-cli-provider.test.ts` - Wave 0 object-shaped spawn mocks
- `docs/EXTENSIONS.md` - Claude silent default; `provider.json` framed as upcoming 08-03

## Decisions Made
- Register the composite as `claude-cli` so production rescue cannot be skipped by wiring the raw CLI adapter
- Keep prompt on argv (`stdio: ['ignore','pipe','pipe']`); process-list disclosure is accepted risk T-08-02-07
- none / ollama / openai-key map to Claude default until 08-03 reads `~/.config/qq/provider.json`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Throw-on-call stubs so RED tests could pass pre-commit typecheck**
- **Found during:** Task 1 (Wave 0 tests)
- **Issue:** lefthook `tsc --noEmit` rejects commits that import modules that do not exist yet
- **Fix:** Added `claude-exec.ts` / `claude-cli.ts` / `claude-default.ts` stubs that export the public API and throw on fetch; tests still failed on unimplemented behavior and missing `claude-cli` registry id
- **Files modified:** `src/providers/claude-exec.ts`, `src/providers/claude-cli.ts`, `src/providers/claude-default.ts`
- **Verification:** `pnpm typecheck` passed; 14/15 CLI tests still failed until Task 2
- **Committed in:** `038f683` (Task 1)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for TDD RED under this repo's typecheck hook. No scope creep.

## Issues Encountered
None beyond the typecheck-hook stub (documented as a deviation).

## User Setup Required
None - no external service configuration required. Live `??` still needs Claude Code `/login` or `ANTHROPIC_API_KEY` on the host (manual UAT, not blocking this plan).

## Next Phase Readiness
- Claude `/login` and API-key users get candidates with no provider quiz
- 08-03 can persist `provider.json` and add OpenAI/Ollama adapters; do not reintroduce a detect waterfall selector
- Leftover `detectProvider()` / `claudeAuthPresent()` stay for preflight/debug only

## Verification Results
- `pnpm test:run tests/claude-cli-provider.test.ts tests/provider-resolver.test.ts tests/registry-bootstrap.test.ts tests/client-result.test.ts tests/claude-provider.test.ts` — 50 passed
- `pnpm test:run` — 236 passed (22 files)
- `rg detectProvider src/client/run-foreground.ts` — no matches
- `rg "not wired yet" src/providers/resolver.ts src/client` — no matches
- `rg --bare src/providers` — no matches
- bootstrap registers `claude-cli` with `claudeDefaultAdapter`; `claudeCliAdapter` absent

## Self-Check: PASSED
- FOUND: `src/providers/claude-exec.ts`, `src/providers/claude-cli.ts`, `src/providers/claude-default.ts`, `tests/claude-cli-provider.test.ts`
- FOUND: commits `038f683`, `f42dec1`, `29d7318`

---
*Phase: 08-zero-config-install-and-provider-detection*
*Completed: 2026-08-26*
