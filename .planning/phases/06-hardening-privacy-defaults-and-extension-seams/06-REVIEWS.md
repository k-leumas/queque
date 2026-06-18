---
phase: 06
reviewers: [claude, codex]
reviewed_at: 2026-06-18T16:15:00Z
plans_reviewed:
  - 06-01-PLAN.md
  - 06-02-PLAN.md
  - 06-03-PLAN.md
skipped_reviewers:
  cursor: "Skipped — running inside Cursor agent for independence"
  ollama: "Timed out — local model did not return output within 120s"
---

# Cross-AI Plan Review — Phase 06

## Claude Review

## Phase 6 Plan Review — QueQue Hardening

---

### Plan 06-01: Safety Guards and Privacy-Aware Context Filtering

**Summary**

A well-scoped TDD plan that correctly identifies the three work streams (privacy filter module, debug log redaction, CMD-04 zsh tests + destructive warning). The quick-task conditional ("if 20260617-privacy-config already exists, verify...") is the main structural risk — it means executors take different paths depending on what was shipped, which can produce unpredictable outcomes. Otherwise the plan is tight and respects the warn-only constraint on destructive commands.

**Strengths**

- TDD ordering is correct: tests define acceptance before implementation
- Destructive command warning is explicitly warn-only with no blocking, preserving user control (CMD-04 spirit)
- `QQ_ALLOW_FILE_READ` env var is the right minimal D-06 gate — it closes the Phase 2 deferred item without over-engineering
- Defense-in-depth is mentioned: filter in pipeline AND buildPrompt
- Quick-task check is a legitimate risk mitigation

**Concerns**

- **MEDIUM — Defense-in-depth gap not assigned to a task.** The research recommends applying `filterContextEnvelope` in both `pipeline.ts` and `claude.ts buildPrompt()`. Task 2 wires the filter into the pipeline. The buildPrompt application is not assigned here (it's picked up loosely in 06-02 Task 3, but only for adding filesystem extras, not for filtering). This gap means one of the two defense layers will likely be missed.

- **MEDIUM — Ambiguous acceptance criterion for `debug-log.ts`.** `"src/shared/debug-log.ts contains redactForLog"` could mean "defines it" or "calls it." The function is defined in `privacy-filter.ts` and called in `debug-log.ts`. The wording will trip up an executor reading it literally.

- **MEDIUM — No test for pipeline wiring itself.** Tests confirm the module functions work in isolation, but no test asserts that `filterContextEnvelope` is actually called inside `gatherContext()`. A unit test can be green while the pipeline hook is missing.

- **MEDIUM — CandidateSelect.tsx destructive warning placement unspecified.** The plan says to show a "warn-only badge" but doesn't specify where in the component (above the list, inline with the selected item, footer). Ambiguous UI placement can lead to an implementation that passes the text-content test but is invisible to users.

- **LOW — `isFileReadAllowed()` config=true path not tested.** Acceptance criteria cover env var=unset → false, but no test covers env var=unset + config `allowFileRead: true` → true. This is the config override path the module must support.

**Suggestions**

- Add acceptance criterion: `src/context/pipeline.ts` calls `filterContextEnvelope(envelope)` after `gatherContext` loop and before returning (grep-verifiable)
- Change acceptance criterion to: `src/shared/debug-log.ts` calls `redactForLog(details)` (not "contains")
- Add a context-pipeline test: mock a git provider returning `.env` path; assert final envelope excludes it
- Specify destructive warning placement: "below the selected candidate, in the detail area, not blocking the list"
- Add `isFileReadAllowed()` test case: config with `allowFileRead: true` overrides env default

**Risk Assessment: LOW-MEDIUM** — Plan correctly closes the most important privacy gaps. The defense-in-depth miss and pipeline wiring gap are the only items that could escape unnoticed.

---

### Plan 06-02: Extension Seams and Registry-Backed Modules

**Summary**

Architecturally sound plan that correctly routes through the resolver pattern rather than ad-hoc switching. The three-task breakdown (resolver module → rewire client → init + prompt) maps cleanly to the dependency chain. Two risks stand out: a potential null-dereference if bootstrap hasn't run when `resolveAdapter` is called, and a Task 1 acceptance criterion that bleeds into Task 2's scope.

**Strengths**

- Follows `context-providers.ts` registry pattern exactly — no invention
- Correctly updates test mocks to `resolver.js` instead of `claude.js`, handling Pitfall 3
- `resolveAdapter` throws on unsupported providers rather than silently falling through to Claude
- Bootstrap idempotency guard makes the `init.ts` bootstrap call safe
- Filesystem extras added to Claude prompt in same plan that wires the resolver, keeping context complete

**Concerns**

- **HIGH — `resolveAdapter` will crash if bootstrap hasn't run.** `resolveAdapter({ kind: 'anthropic-key' })` calls `getProviderAdapter('claude')` which returns `undefined` if bootstrap hasn't run. `adapter.fetchCandidates()` then throws a cryptic `Cannot read properties of undefined`. There's no test for "resolveAdapter called without bootstrap" and no guard in the resolver. This is a real runtime failure path.

- **MEDIUM — Task 1 acceptance criterion scope bleeds.** `"grep -n 'from '../providers/claude.js'' src/client/run-foreground.ts returns no fetchCandidates import"` is Task 2's deliverable, not Task 1's. Including it in Task 1 acceptance criteria means Task 1 will fail until Task 2 is complete, which confuses incremental verification.

- **MEDIUM — No test for run-foreground error path when resolveAdapter throws.** Task 2 says "Ensure error path when resolveAdapter throws writes kind:'error' ShellResult" but no test is specified. If Ollama is detected and `resolveAdapter` throws "Phase 8 not yet wired," the error must become a `ShellResult { kind: 'error' }` — this path needs a test.

- **MEDIUM — `init.ts` `bootstrapBuiltins()` call may be redundant.** `main.ts:78` already calls `bootstrapBuiltins()` before commands dispatch. Adding it inside `initCommand` is idempotent but creates confusion — future readers won't know if this is deliberate belt-and-suspenders or a missed cleanup. The plan should explicitly note "called here as defensive initialization" or rely on `main.ts`.

- **LOW — Circular dependency not audited.** `bootstrap.ts` → `claude.ts` (claudeAdapter); `resolver.ts` → `provider-backends.ts`; `run-foreground.ts` → `resolver.ts`. This chain needs a quick `pnpm tsc --noEmit` check before shipping to confirm no circular module graph.

- **LOW — `buildPrompt` filesystem inclusion without filtering.** Task 3 adds filesystem extras to the Claude prompt. The research recommends `filterContextEnvelope` as defense-in-depth in `buildPrompt` too. Neither 06-01 nor 06-02 explicitly assigns this application.

**Suggestions**

- Add guard in `resolveAdapter`: if `getProviderAdapter(id)` returns `undefined`, throw `"Provider '${id}' registered without adapter — was bootstrapBuiltins() called?"` rather than returning undefined
- Move the `run-foreground.ts` grep check to Task 2 acceptance criteria only
- Add test: `resolveAdapter({ kind: 'anthropic-key' })` before bootstrap throws clearly (not undefined-deref)
- Add test: run-foreground catches `resolveAdapter` throw and writes `{ kind: 'error', message }` ShellResult
- Add `filterContextEnvelope(envelope)` call in `buildPrompt` (Task 3) for defense-in-depth, matching 06-01's research intent

**Risk Assessment: MEDIUM** — The null-dereference on unbootstrapped resolveAdapter is a real crash path in prod and the most important item to fix before execution.

---

### Plan 06-03: MVP Packaging and Documentation

**Summary**

Appropriate scope for a doc-only wave. Verification is grep-based which is correct for docs work. The main risks are the ambiguous QQ_PANE_WIDTH/HEIGHT conditional ("skip if risky") and the JSON comment anti-pattern. The plan correctly depends on 06-01 and 06-02 completing first, since it documents env vars that those plans introduce.

**Strengths**

- Acceptance criteria are all mechanically verifiable (grep)
- `qq.zsh` drift fix is explicitly checked with `grep 'qq\.zsh' README.md`
- Optional Zellij pane env vars are correctly marked optional with a fallback
- config.example.json covers all privacy schema fields introduced in 06-01
- No code changes in this plan — pure docs reduces risk significantly

**Concerns**

- **MEDIUM — QQ_PANE_WIDTH/HEIGHT "skip if risky" is unresolvable ambiguity.** If the code change is skipped but the env vars are documented as supported, users will set them and nothing will happen. The plan must decide: implement them (research showed `zellij run` supports `--width`/`--height` via `queque.zsh`) or don't document them at all. Half-documentation is worse than no documentation.

- **MEDIUM — SYSTEM_DESGN.md typo not fixed.** The plan modifies `docs/SYSTEM_DESGN.md` but doesn't fix the filename typo (should be `SYSTEM_DESIGN.md`). This is an opportunity — a rename + content update in one PR. If not fixed now, it stays forever.

- **LOW — JSON doesn't support comments.** Task 1 says `"_comment fields if supported"` — standard JSON parsers reject `_comment` keys only if validation is strict; `zod` will ignore them via `.passthrough()`. But documenting JSON config with comment fields is fragile and non-standard. Better to use a `// see README` note in the adjacent docs rather than embedding comments in the config file.

- **LOW — docs/EXTENSIONS.md pre-existence not handled.** The file may already exist with partial content (from earlier sessions). Task 2 reads it first, which is correct, but the acceptance criteria check for new content ('resolveAdapter', 'Phase 8') without verifying existing content is removed/updated. Could result in outdated sections alongside new ones.

- **LOW — config.example.json structure not specified.** Plan says "contains privacy.sensitivePathPatterns array" but doesn't give the expected JSON shape. Executor might write `{"sensitivePathPatterns": [...]}` instead of `{"privacy": {"sensitivePathPatterns": [...]}}` — mismatch with `qq-config.ts` schema.

**Suggestions**

- Resolve QQ_PANE_WIDTH/HEIGHT: check `zellij run --help` in the plan's verification step; if `--width`/`--height` flags exist, implement them; otherwise omit from docs entirely
- Rename `docs/SYSTEM_DESGN.md` → `docs/SYSTEM_DESIGN.md` as part of Task 2 (update all references in one pass)
- Replace JSON `_comment` fields with a "Configuration Reference" table in the adjacent README section
- Specify expected JSON structure for config.example.json: `{"privacy": {...}, "safety": {...}}` matching `QqConfig` type
- Add acceptance criterion: `docs/EXTENSIONS.md` does not contain stale "placeholder" or pre-resolver language

**Risk Assessment: LOW** — Documentation-only changes are low-blast-radius. The QQ_PANE_WIDTH ambiguity is the one item that could confuse real users.

---

### Cross-Plan Findings

**Defense-in-depth filter gap (MEDIUM — spans 06-01 and 06-02):** The research explicitly recommends `filterContextEnvelope` in both `pipeline.ts` AND `claude.ts buildPrompt()`. Plan 06-01 assigns the pipeline application. Plan 06-02 Task 3 modifies `buildPrompt` to add filesystem extras but does not add the filter call. Neither plan owns the buildPrompt filter. This will be missed unless explicitly assigned.

**Test mock fragility after 06-02 (MEDIUM):** Once 06-02 rewires `run-foreground.ts` to import `resolver.js`, any test file still mocking `claude.js` will silently pass with the old codepath. The plan updates `client-result.test.ts` but doesn't audit other test files for stale `claude.js` mocks.

**Overall Phase Risk: MEDIUM.** The plans are well-researched, correctly scoped, and follow established patterns. The three items most likely to cause unnoticed failures in production: (1) the missing buildPrompt filter application, (2) the null-dereference in `resolveAdapter` when bootstrap is absent, and (3) the QQ_PANE_WIDTH half-documentation. All three are fixable with targeted additions to acceptance criteria before execution begins.

---

## Codex Review

## Summary

The Phase 6 plans are strong overall: they map directly to the stated hardening goals, preserve the MVP constraint of insertion-only behavior, and focus on making earlier extension and privacy decisions real in code. The plan set is coherent and mostly well ordered: 06-01 establishes safety/privacy primitives, 06-02 wires registry-backed provider resolution, and 06-03 documents the operational model. The main risks are scope creep in 06-01, subtle provider-detection behavior in 06-02, and docs drifting from implementation if 06-03 assumes optional code changes landed.

## Plan 06-01 Review

### Strengths

- Directly addresses the biggest Phase 6 gap: privacy rules move from comments/schema intent into runtime behavior.
- Good TDD framing around `filterContextEnvelope`, `redactForLog`, `isFileReadAllowed`, and destructive-command detection.
- Debug log redaction is correctly treated as a default behavior, with `QQ_DEBUG_VERBOSE=1` as an explicit escape hatch.
- CMD-04 is tested at the shell boundary, which is the right place to prove insertion-only behavior.
- Warn-only destructive command handling preserves user control and avoids turning QueQue into an execution approval system.

### Concerns

- **HIGH:** `QQ_ALLOW_FILE_READ=1` plus config `privacy.allowFileRead` introduces an opt-in mechanism before any file-reading feature exists. That is fine as a guardrail, but the plan should ensure no current code starts reading file contents merely because the flag exists.
- **MEDIUM:** Config loading in `privacy-filter.ts` could make pure filtering functions unexpectedly dependent on filesystem state and environment variables, which may complicate tests and runtime determinism.
- **MEDIUM:** `QQ_DEBUG_VERBOSE=1` preserving the "full object" can reintroduce sensitive data into `/tmp` logs. That may be acceptable for explicit debug mode, but docs and tests should make that tradeoff clear.
- **MEDIUM:** Regex-based destructive command detection can easily produce false positives/negatives. Since it is warn-only, this is acceptable, but tests should include quoted/compound commands enough to avoid brittle behavior.
- **LOW:** Grepping the zsh file for `eval|zle -s` is useful but incomplete. Shell execution can also happen through `command`, `builtin`, process substitution, function invocation, or accidental `zle accept-line`.

### Suggestions

- Keep `filterContextEnvelope(envelope, config?)` and `redactForLog(details, config?)` pure where possible; have thin wrappers load config at the boundary.
- Add tests for nested log payloads, arrays, and error objects so `redactForLog` does not only handle shallow `{ lbuffer }`.
- Treat `QQ_DEBUG_VERBOSE=1` as "less redacted" only if necessary; consider still redacting obvious secret-shaped fields like API keys.
- Add sensitive path tests for `.env.local`, `.ssh/id_rsa`, `foo.pem`, `credentials.json`, `secrets/`, and case-insensitive variants.
- In zsh tests, assert selected command text appears in `LBUFFER` but no accept-line behavior occurs.

### Risk Assessment

**MEDIUM.** The privacy/logging work is necessary and well targeted, but it touches shared context and debug paths. The largest risk is over-coupling filtering to config/env loading and accidentally making tests or behavior nondeterministic.

## Plan 06-02 Review

### Strengths

- Correctly fixes the main extension-seam problem: `run-foreground.ts` should not import Claude directly.
- The `detectProvider → resolveAdapter → adapter.fetchCandidates` flow is the right architectural shape for Phase 8.
- Explicit unsupported-provider errors are better than silently falling back to Claude.
- Tests cover both registry bootstrap and runtime resolution, which reduces the chance of "metadata theater" returning.
- Keeping unsupported Ollama/OpenAI/Claude CLI backends out of scope is the right MVP discipline.

### Concerns

- **HIGH:** If `detectProvider()` currently detects `ollama` or `openai-key` when no Anthropic key exists, 06-02 will convert a previously "provider found" path into a hard error. That is architecturally honest, but the user-facing error must be clear and not look like a crash.
- **HIGH:** Registry state can become test-order dependent if `bootstrapBuiltins()` mutates a module-level map without reset/idempotency semantics.
- **MEDIUM:** Extending `ProviderBackendDescriptor` with `adapter` may blur public descriptor metadata with runtime implementation. That is acceptable for MVP, but the type name should probably change to `RegisteredProviderBackend`.
- **MEDIUM:** `init.ts` calling `bootstrapBuiltins()` just to validate shell adapters may create unwanted side effects if bootstrap later registers providers or reads env/config.
- **LOW:** Adding filesystem chunk payload to Claude prompt is related but slightly orthogonal to registry hardening. It is safe if metadata-only, but it belongs under privacy-filter defense-in-depth.

### Suggestions

- Make `bootstrapBuiltins()` idempotent and add a test that calling it twice does not duplicate or throw.
- Add `clearProviderBackendsForTest()` or equivalent test helper if registry state is module-global.
- Ensure `resolveAdapter()` throws typed/user-displayable errors, not generic exceptions that produce noisy stack traces in the TUI.
- Consider separate fields/types: `ProviderBackendDescriptor` for docs/listing, `RegisteredProviderBackend` for descriptor plus adapter.
- Add an acceptance criterion that unsupported provider errors are written as `ShellResult { kind: 'error' }` and do not leave partial result files.
- Avoid importing provider adapters from registry modules in a way that creates circular imports between `bootstrap`, `provider-backends`, `resolver`, and `claude`.

### Risk Assessment

**MEDIUM.** The design is right, but registry state and provider-detection semantics are easy to get subtly wrong. The plan should be explicit about idempotency, test isolation, and user-facing unsupported-provider errors.

## Plan 06-03 Review

### Strengths

- Strongly aligned with Phase 6 success criteria around daily-driver readiness and expansion path clarity.
- README privacy documentation is essential and correctly includes what leaves the machine and what never leaves by default.
- `docs/EXTENSIONS.md` is a good place to explain Phase 7/8 seams without implementing plugin loading prematurely.
- Stale `qq.zsh` cleanup is a practical high-value documentation fix.
- CONTRIBUTING daily-driver workflow helps the product be used during its own development, matching project intent.

### Concerns

- **MEDIUM:** `docs/config.example.json` cannot contain real JSON comments unless the config loader supports JSONC. The plan mentions `_comment` fields as an option; it should choose one explicitly.
- **MEDIUM:** Optional `QQ_PANE_WIDTH` / `QQ_PANE_HEIGHT` can create doc/code drift if documented but not implemented, or implemented without verifying Zellij flag behavior.
- **MEDIUM:** `grep 'placeholder' docs/SYSTEM_DESGN.md` may flag legitimate historical text or miss stale wording that does not use the exact word "placeholder."
- **LOW:** The file name `SYSTEM_DESGN.md` appears misspelled. If that is the existing canonical path, fine; otherwise the plan may preserve a typo.
- **LOW:** Docs-only verification is mostly grep-based. That catches drift but does not validate install snippets or config schema examples.

### Suggestions

- Make `docs/config.example.json` strict JSON unless the app explicitly supports JSONC. Use `_comment` keys or explain fields in adjacent markdown.
- Only document `QQ_PANE_WIDTH` / `QQ_PANE_HEIGHT` if the shell implementation lands in the same plan and has a small test or manual verification note.
- Add a check that every config field in `docs/config.example.json` exists in `qq-config.ts`.
- Include a tiny "current architecture" diagram in `SYSTEM_DESGN.md` showing `widget → client → context filter → resolver → provider → TUI → shell result`.
- Add a final verification command for docs drift: `grep -R "qq\.zsh\|placeholder\|not implemented\|TODO placeholder" README.md CONTRIBUTING.md docs`.

### Risk Assessment

**LOW to MEDIUM.** The docs work is lower implementation risk, but it depends on 06-01 and 06-02 landing as described. The main risk is documenting optional or intended behavior before it is actually implemented.

## Cross-Plan Concerns

- **HIGH:** Plan 06-01 and 06-02 both affect the outbound provider request path. The final API boundary should be unambiguous: context is gathered, filtered, then passed to the resolved adapter, and the adapter also applies defense-in-depth filtering before prompt construction.
- **MEDIUM:** Config loading is introduced in 06-01 and documented in 06-03, but the plans do not clearly specify malformed config behavior. It should fail closed or ignore invalid user config with a redacted debug warning.
- **MEDIUM:** The plans depend on `pnpm`, while research says `pnpm` was unavailable in one sandbox. If this execution environment also lacks `pnpm`, the plan should allow `corepack pnpm` or document the fallback.
- **MEDIUM:** Phase 6 success criterion 4 mentions cross-OS zsh readiness. The plans document this, but do not test path assumptions outside macOS. That is probably acceptable, but should be called "ready by seam/docs," not validated cross-OS support.
- **LOW:** Summary artifacts are required after each plan, but the plans do not specify minimum content. Use a consistent template: changes, tests run, risks, follow-ups.

## Overall Risk Assessment

**MEDIUM.** The plans are well decomposed and should achieve Phase 6's goals if implemented carefully. The highest-risk areas are not algorithmic complexity; they are boundary correctness: avoiding accidental sensitive data leakage, keeping registry state deterministic, and making unsupported-provider behavior explicit. Scope is mostly controlled, though the destructive UI badge, config system, filesystem prompt forwarding, and optional Zellij pane env vars should be watched so the hardening phase does not become a feature phase.

---

## Ollama Review

Ollama review failed or returned empty output (timed out after 120s).

---

## Consensus Summary

### Agreed Strengths

- **Correct phase decomposition:** 06-01 (privacy/safety) → 06-02 (registry seams) → 06-03 (docs/packaging) is the right order and matches roadmap success criteria.
- **Insertion-only preserved:** Both reviewers agree CMD-04 testing at the shell boundary and warn-only destructive UI (no blocking) is the right approach.
- **Registry resolver pattern:** `detectProvider → resolveAdapter → adapter.fetchCandidates` is architecturally sound and unblocks Phase 8 without scope creep.
- **TDD-first privacy work:** Filter module, log redaction, and pipeline integration are well-targeted at closing Phase 2 D-05/D-06 gaps.

### Agreed Concerns (highest priority)

1. **Defense-in-depth filter gap (MEDIUM/HIGH)** — Both reviewers flag that `filterContextEnvelope` should run in both `pipeline.ts` AND `claude.ts buildPrompt()`, but neither plan explicitly assigns the buildPrompt call. This is the most likely silent miss during execution.

2. **`resolveAdapter` null-dereference / bootstrap guard (HIGH)** — Claude flags crash when bootstrap hasn't run; Codex flags test-order-dependent registry state. Both want explicit guards, idempotent bootstrap, and tests for unbootstrapped resolution.

3. **Unsupported provider error UX (HIGH)** — Codex warns that detecting Ollama/OpenAI without adapters becomes a hard error; both want clear user-facing `ShellResult { kind: 'error' }` paths with tests, not stack traces.

4. **QQ_PANE_WIDTH/HEIGHT doc/code drift (MEDIUM)** — Both reviewers agree: either implement the Zellij pane env vars or omit from docs entirely — half-documentation confuses users.

5. **Config purity and determinism (MEDIUM)** — Codex emphasizes keeping filter functions pure with config loaded at boundaries; malformed config behavior is unspecified across 06-01 and 06-03.

### Divergent Views

- **06-01 overall risk:** Claude rates 06-01 LOW-MEDIUM; Codex rates MEDIUM due to config-coupling concerns. Codex is more cautious about `QQ_DEBUG_VERBOSE=1` reintroducing sensitive data and about config loading inside filter modules.
- **SYSTEM_DESIGN rename:** Claude explicitly recommends renaming `SYSTEM_DESGN.md` → `SYSTEM_DESIGN.md`; Codex notes the typo but accepts keeping the canonical path if already established.
- **QQ_ALLOW_FILE_READ gate:** Codex flags HIGH concern that the opt-in flag must not trigger file reads before Phase 7; Claude treats it as a strength with only LOW follow-up on config override tests.

### Recommended Pre-Execution Fixes

Before `/gsd-execute-phase 06`, incorporate these into plan acceptance criteria:

| Priority | Fix | Plans |
|----------|-----|-------|
| HIGH | Add `filterContextEnvelope` call in `buildPrompt()` (defense-in-depth) | 06-02 Task 3 |
| HIGH | Guard `resolveAdapter` against missing bootstrap; test pre-bootstrap throw | 06-02 Task 1 |
| HIGH | Test `resolveAdapter` throw → `ShellResult { kind: 'error' }` in run-foreground | 06-02 Task 2 |
| MEDIUM | Test pipeline actually calls `filterContextEnvelope` (not just module in isolation) | 06-01 Task 2 |
| MEDIUM | Decide QQ_PANE_WIDTH/HEIGHT: implement or omit from docs | 06-03 Task 3 |
| MEDIUM | Specify `config.example.json` shape matching `QqConfig` schema | 06-03 Task 1 |
| LOW | Rename `SYSTEM_DESGN.md` or document canonical typo path | 06-03 Task 2 |
