---
phase: 08
reviewers: [claude, codex]
reviewed_at: 2026-08-26T02:45:00Z
plans_reviewed: [08-01-PLAN.md, 08-02-PLAN.md]
skipped: [cursor]
note: Cursor skipped (this session is Cursor). gemini/opencode/qwen/agy/ollama/lm_studio/llama_cpp/coderabbit not installed or not running. 08-01 already executed; reviewers focused on 08-02.
---

# Cross-AI Plan Review — Phase 8

Primary target: **08-02** (about to execute). 08-01 is already shipped.

---

## Claude Review

08-01 is narrow, already executed, and does what it says: it closes the macOS Keychain detection gap without expanding scope into call-time auth or adapter wiring. It's low-risk and doesn't need re-litigating.

08-02 correctly operationalizes CONTEXT.md D-01–D-15: Claude-first via `claude -p`, SDK rescue only when a key exists, `detectProvider()` demoted to a bypassed leftover, no "not wired yet" throws, and no OpenAI/Ollama/`provider.json` scope creep. The task breakdown (tests → implementation → resolver/client rewire) is sound TDD sequencing. The main risks are implementation details the research doesn't examine: a Node `util.promisify` mock-shape mismatch, and passing the full rendered prompt as `claude` argv (visible via `ps`/`/proc`).

### Strengths

- Decisions are followed, not reinterpreted. Every D-0x maps into `must_haves` or a task.
- `detectProvider()` is bypassed, not deleted, matching D-10.
- Rescue math is explicit and shared-deadline-aware (25s, skip SDK if remaining < ~1000ms).
- No fake `claude` binary in tests; mock `execFile` instead.
- Registry discipline: `run-foreground.ts` never imports adapters directly.
- Test rewrites are scoped to the assertions that must change.

### Concerns

- **HIGH — `execFile` mock likely doesn't match `promisify`'s real return shape.** Real `promisify(execFile)` resolves `{ stdout, stderr }`. A `vi.fn()` mock of `execFile` (the `context-pipeline.test.ts` pattern) does not carry `[util.promisify.custom]`, so generic promisify yields an **array** `[val1, val2]`. `const { stdout } = await execFileAsync(...)` then gets `undefined`. `git-context` tests hide this because they swallow errors; `fetchClaudeCliCandidates` parses stdout and will not. Risk: Task 1 RED test fails with TypeError, or implementer "fixes" production to destructure an array and breaks real Node. **Suggestion:** mock a thin `execFileAsync` wrapper that resolves `{ stdout, stderr }`, not raw `execFile` + promisify.

- **MEDIUM — Prompt content goes out as child-process argv.** cwd, branch, filenames, query text are a literal argv element, listable via `ps` for up to 25s. T-08-02-01 only covers *logging* argv, not process-list disclosure. Piped stdin (write + close, not inherit) is a different, safer path than inherited TTY stdin. If argv is accepted, log it as an accepted risk in the threat model.

- **LOW — Removing `detectProvider()` from `run-foreground.ts` drops ROADMAP success criterion #6's literal wording.** Composite path logging is more useful; update ROADMAP/STATE at phase close so #6 is not thought dropped.

- **LOW — Task 2 is a large atomic TDD task** (2 new files + 3 modified + tests). Highest-complexity unit; careful line-by-line review when it lands.

### Suggestions

- Spike the `execFile`/`promisify` mock shape before Task 1 assertions.
- Document argv-visible prompt as accepted risk or mitigate via stdin piping.
- Update ROADMAP criterion #6 wording when Task 3 lands.
- Assert no doubled `QueQue: ` prefix in Task 3 `client-result.test.ts`.

### Risk Assessment

**MEDIUM.** Decision-following and scope are excellent. Risk is in promisify mock shape (TDD friction / silently-wrong production fix) and argv prompt exposure. Both are fixable without revisiting D-01–D-15.

---

## Codex Review

08-02 is a strong execution plan: it correctly treats Claude as the silent default, bypasses the outdated detection waterfall, keeps OpenAI/Ollama/provider pinning out of scope, and focuses on the real hard parts: subprocess isolation, shared timeout budget, candidate-contract reuse, and SDK rescue. 08-01's main integration risk is exactly what 08-02 handles: `claudeAuthPresent()` must not become a fetch gate. Ready to execute with tightening around resolver semantics, timeout accounting, debug logging, and test brittleness.

### Strengths

- Clear alignment with D-01 through D-15, especially “pin later, Claude default now.”
- Good scope control: no OpenAI/Ollama/`provider.json`/`qq init zsh` quiz.
- Avoids `detectProvider()` as the hot-path selector.
- Reuses `buildPrompt`, `parseCandidates`, `candidateListSchema`, existing SDK adapter.
- Strong subprocess safety: `execFile`, no shell, stdin ignored, `--safe-mode`, `--tools ""`, no `--bare`.
- Shared 25s deadline matches the 30s zsh FIFO.
- Tests cover CLI-first with key present, ENOENT rescue, logged-out rescue, timeout skip, no fake `claude`, no vendor fallthrough.
- Security model is concrete: no raw argv/env/stdout/stderr logging, no `.env.local` injection into child env.

### Concerns

- **HIGH:** `resolveAdapter(detected)` returning Claude default even for `{ kind: 'none' }` may hide no-provider UX from 08-03. Valid for 08-02; leave a comment/test that this is temporary until pinning exists.

- **HIGH:** Registered `claude-cli` backend must be the **composite** (`claudeDefaultAdapter`), not the raw CLI-only adapter. Otherwise tests pass while SDK rescue is skipped in production.

- **MEDIUM:** `fetchCandidates(envelope, rbuffer?, timeoutMs?)` can be ambiguous; verify existing SDK two-arg call sites and the rescue timeout path.

- **MEDIUM:** Assert `appendDebugLog` never receives `args`, `env`, raw stdout/stderr, or token-like values.

- **MEDIUM:** Centralize `Date.now()` deadline math (`remainingMs(deadline)`) so tests are not brittle.

- **MEDIUM:** Rescue-on-any-CLI-failure can mask flag/prompt bugs when a key exists. Debug log must show `claude-cli` failure then `sdk-rescue`.

- **LOW:** `--tools ""` is CLI-version-sensitive; manual UAT on the installed Claude CLI.

- **LOW:** Do not document `provider.json` as live behavior; frame as 08-03.

### Suggestions

- Comment in `resolver.ts`: `none/openai-key/ollama → Claude default` is an 08-02 bridge until 08-03 pinning.
- Keep names sharp: `claudeCliAdapter` = raw subprocess; `claudeDefaultAdapter` = CLI-first + SDK rescue, registered as `claude-cli`.
- Assert `getProviderAdapter('claude-cli')` is the composite (force CLI failure + env key → SDK rescue).
- `MIN_SDK_RESCUE_MS = 1000` in `claude-default.ts`; test just-above and just-below.
- Test that `run-foreground.ts` has no `detectProvider` import and no `provider.json` read.
- Keep full-suite gate after Task 3 via `pnpm test:run`.

### Risk Assessment

**MEDIUM.** Coherent and well scoped. Biggest risks: adapter registration ambiguity, timeout stacking, accidental return to detection/waterfall. Test plan is strong enough if raw CLI, composite, and resolver stay sharply separated.

---

## Consensus Summary

Two independent reviewers (Claude CLI, Codex). Cursor skipped (this session).

### Agreed Strengths

- CONTEXT.md D-01–D-15 are followed; ROADMAP waterfall-as-selector is not reintroduced.
- `detectProvider()` is bypassed, not deleted.
- Shared 25s CLI+SDK budget under the 30s FIFO is the right shape.
- No fake `claude` binary; spawn safety (`execFile`, stdin ignore, no `--bare`).
- Scope stays Claude-only; OpenAI/Ollama/`provider.json` belong in 08-03.
- Reuse existing `buildPrompt` / `parseCandidates` / SDK adapter.

### Agreed Concerns

- **Overall risk: MEDIUM** — design is locked; execution risk is in adapter wiring, mocks, timeouts, and logging.
- **Register the composite, not the raw CLI adapter, as `claude-cli`.** Codex HIGH; implied by Claude's registry-discipline praise. Executor must not skip SDK rescue in production.
- **Tests must not lie about spawn/timeout/logging.** Claude: promisify mock shape. Codex: `Date.now()` brittleness, `appendDebugLog` leaking argv/env/stdout.
- **CLI-then-SDK rescue must be visible in debug logs** so a key does not silently hide CLI breakage (Codex MEDIUM; Claude's rescue-math notes assume the same).

### Divergent Views

| Topic | Claude | Codex |
|-------|--------|-------|
| Highest unique risk | `promisify(execFile)` mock returns array not `{stdout,stderr}` | Registering raw `claudeCliAdapter` as `claude-cli` skips SDK rescue |
| Privacy | Prompt on argv is process-listable (`ps`) — not in STRIDE | Logging argv is already forbidden; less focus on `ps` |
| `kind: 'none'` | Not flagged | HIGH: may hide 08-03 no-provider UX; comment/test the bridge |
| Task 2 size | LOW: large atomic TDD task | Not flagged as size; flags signature/`rbuffer` ambiguity |
| ROADMAP #6 | Update criterion wording when detect logging goes away | Frame `provider.json` docs as 08-03 only |

### Highest priority before / during execute

1. Mock `execFileAsync` (or equivalent) to resolve `{ stdout, stderr }` — do not copy the git-context promisify mock blindly.
2. Register `claudeDefaultAdapter` as `claude-cli`; keep raw CLI adapter unregistered or test-only.
3. Comment + test that `none` / ollama / openai-key → Claude default is an 08-02 bridge.
4. Either pipe prompt on stdin or accept argv `ps` disclosure in the threat model.
5. Assert debug path `claude-cli` then `sdk-rescue` with no secrets in log payloads.

To incorporate into planning:

`/gsd-plan-phase 8 --reviews`
