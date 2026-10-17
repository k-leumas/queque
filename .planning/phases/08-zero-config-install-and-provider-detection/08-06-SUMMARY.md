---
phase: 08-zero-config-install-and-provider-detection
plan: 06
subsystem: providers
tags: [provider-pin, failure-copy, docs, claude-default, d-02, d-13]

requires:
  - phase: 08-zero-config-install-and-provider-detection
    provides: "08-03 provider.json pin + resolveProviderAdapter + ollama; 08-04 openai adapter (gpt-5.5); 08-05 qq init provider picker"
provides:
  - "Claude setup-failure copy (ENOENT and auth/D-13) that ends with the `qq init provider` path; timeout copy unchanged"
  - "resolveAdapter doc comment: detection never selects; runtime selector is resolveProviderAdapter()"
  - "docs/EXTENSIONS.md: pin or Claude default resolution, pin examples, picker, QQ_PROVIDER_FILE, OPENAI_API_KEY, ollama/openai backends"
  - "README.md: Choose a provider section, per-provider privacy notes"
affects: [phase 08 verification / UAT, future provider adapters (docs contract)]

actuals:
  tokens: 5200
  tasks: 2
  commits: 2
plan_head_before: 3d3dd69103ed91ed17922a297f7a1d3aa637164f
plan_head_after: 8a077812403cefc46ff2f1de8342dd50392760e5

tech-stack:
  added: []
  patterns:
    - "Setup-failure copy names every way forward as static text; the path into the picker is copy only, never a prompt on the ?? path (D-03)"

key-files:
  created: []
  modified:
    - src/providers/claude-default.ts
    - tests/claude-cli-provider.test.ts
    - src/providers/resolver.ts
    - tests/provider-resolver.test.ts
    - docs/EXTENSIONS.md
    - README.md

key-decisions:
  - "README's 'Expose API Key' section no longer exists (it became 'Authentication' earlier); 'Authentication' was renamed 'Choose a provider' with Claude (default) and OpenAI or Ollama subsections, and the Requirements anchor was updated"
  - "README keeps 'Rows stream in as Claude answers': the OpenAI and Ollama adapters do not stream rows, so a provider-neutral wording would be inaccurate"
  - "EXTENSIONS.md env table heading widened to 'Privacy and provider env vars' so QQ_PROVIDER_FILE and OPENAI_API_KEY fit"

patterns-established:
  - "Docs describe provider selection as: the pin, otherwise the Claude default; no fallthrough; detectProvider() is leftover preflight"

requirements-completed: [RUN-01, EXT-01]

coverage:
  - id: D1
    description: "ENOENT and auth (D-13) failures name `claude /login`, ANTHROPIC_API_KEY and `qq init provider`, in that order; ENOENT says 'No AI provider is ready'"
    requirement: RUN-01
    verification:
      - kind: unit
        ref: "tests/claude-cli-provider.test.ts#throws D-13 copy and skips SDK when CLI is ENOENT and no key exists (D-09, D-13)"
        status: pass
      - kind: unit
        ref: "tests/claude-cli-provider.test.ts#throws D-13 copy when the result is_error auth text comes back and no key can rescue"
        status: pass
    human_judgment: false
  - id: D2
    description: "Timeout copy stays a plain retry message without the picker hint; claude-default.ts never references the picker (D-03)"
    requirement: RUN-01
    verification:
      - kind: unit
        ref: "tests/claude-cli-provider.test.ts#timeout copy stays a retry message"
        status: pass
      - kind: unit
        ref: "tests/claude-cli-provider.test.ts#Claude default source never references the picker"
        status: pass
    human_judgment: false
  - id: D3
    description: "Failure text reaches the client as one QueQue: line through the daemon fetch-error path"
    requirement: RUN-01
    verification:
      - kind: integration
        ref: "pnpm exec vitest run tests/client-result.test.ts tests/daemon-fetch.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "resolveAdapter maps ollama/openai-key/none detection to the Claude default and ignores a provider.json pin (D-01, D-11)"
    requirement: EXT-01
    verification:
      - kind: unit
        ref: "tests/provider-resolver.test.ts#resolveAdapter ignores a provider.json pin"
        status: pass
      - kind: unit
        ref: "tests/provider-resolver.test.ts#maps ollama detection to the Claude default — detection never selects (D-01)"
        status: pass
    human_judgment: false
  - id: D5
    description: "docs/EXTENSIONS.md and README.md describe pin or Claude default, the picker, OPENAI_API_KEY, Ollama and per-provider privacy as shipped, with no runtime auto-detection or vendor fallthrough"
    requirement: EXT-01
    verification:
      - kind: other
        ref: "grep QQ_PROVIDER_FILE/qq init provider/OPENAI_API_KEY in docs/EXTENSIONS.md and README.md"
        status: pass
    human_judgment: true
    rationale: "Doc accuracy and tone (D-01 transparency prohibition) is a judgment call; greps only prove the required strings exist"
  - id: D6
    description: "Live: claude logged out, no key, no provider.json; ?? prints one line naming claude /login, ANTHROPIC_API_KEY and qq init provider, and the typed query is restored"
    requirement: RUN-01
    verification: []
    human_judgment: true
    rationale: "Needs an interactive zsh and a logged-out Claude Code; tracer human-check deferred to end-of-phase UAT"

duration: 7min
completed: 2026-10-17
status: complete
---

# Phase 8 Plan 06: Failure Hint and Shipped-Behavior Docs Summary

**When Claude is the default and cannot answer, the first failed `??` now prints one line that names `claude /login`, `ANTHROPIC_API_KEY`, and `qq init provider`. The resolver comment, the tests, `docs/EXTENSIONS.md`, and `README.md` now describe what shipped: the pin, otherwise the Claude default.**

## Performance

- **Duration:** ~7 min of task work (worktree started 2026-10-17T19:22Z)
- **Started:** 2026-10-17T19:22:00Z
- **Completed:** 2026-10-17T19:29:12Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `ENOENT_MESSAGE`: "QueQue: No AI provider is ready. Install Claude Code and run `claude /login`, or set ANTHROPIC_API_KEY in the environment or .env.local. To use OpenAI or Ollama instead, run `qq init provider`."
- `D13_MESSAGE`: "QueQue: Claude is not authenticated. Run `claude /login`, or set ANTHROPIC_API_KEY in the environment or .env.local. To use OpenAI or Ollama instead, run `qq init provider`."
- `TIMEOUT_MESSAGE`, `hardError` classification, the SDK-first rule, the 25s budget, and debug logging are unchanged. Nothing is imported from `src/cli`.
- `resolveAdapter` doc comment: detection never selects (D-01, D-11), and the runtime selector is `resolveProviderAdapter()`. Resolver tests are retitled, and a new test shows that an ollama pin in `QQ_PROVIDER_FILE` does not change `resolveAdapter`.
- EXTENSIONS.md: the registry row lists `ollama` and `openai`. "Provider resolution" is rewritten: the pin, otherwise the Claude default. It covers no fallthrough, per-`??` re-read, invalid pin as a hard error, three pin examples in the versioned-union schema, the picker, and detectProvider as leftover preflight. 08-03..08-06 are marked shipped, and `QQ_PROVIDER_FILE` and `OPENAI_API_KEY` are added to the env table.
- README: "Choose a provider" has a Claude (default) part and an OpenAI or Ollama part (picker, key never stored, editable provider.json, re-run to switch). The daemon section notes that provider.json is read on every `??`. Privacy covers Claude and OpenAI as hosted providers and Ollama as going only to your Ollama server.

## Task Commits

1. **Task 1: Tracer, the first failed ?? points at `qq init provider`**: `84425ea` (feat)
2. **Task 2: Detection-never-selects comment and shipped-behavior docs**: `8a07781` (docs)

## Files Created/Modified

- `src/providers/claude-default.ts`: new ENOENT and D-13 copy
- `tests/claude-cli-provider.test.ts`: picker-hint and ordering assertions, plus the "timeout copy stays a retry message" and "Claude default source never references the picker" tests. The ENOENT copy regex was updated for the new wording.
- `src/providers/resolver.ts`: `resolveAdapter` doc comment only
- `tests/provider-resolver.test.ts`: retitled cases and "resolveAdapter ignores a provider.json pin"
- `docs/EXTENSIONS.md`: registry table, provider resolution, Phase 8 roadmap, env vars
- `README.md`: Choose a provider, daemon restart notes, privacy defaults

## Decisions Made

See `key-decisions` in the frontmatter. The README's section was named "Authentication", not the "Expose API Key" the plan mentions. I renamed it in place and kept its Claude content.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing ENOENT copy assertion updated for the new wording**
- **Found during:** Task 1
- **Issue:** `tests/claude-cli-provider.test.ts` matched `/Install Claude Code, run \`claude \/login\`/`. The plan's exact new string says "Install Claude Code and run", so the old regex would fail.
- **Fix:** The regex now matches the new wording. The assertion is kept, not removed.
- **Files modified:** tests/claude-cli-provider.test.ts
- **Committed in:** 84425ea

**2. [Rule 1 - Accuracy] EXTENSIONS.md previously said Claude spawns `claude -p` first, then uses the SDK as a rescue**
- **Found during:** Task 2
- **Issue:** The shipped composite is SDK-first when a key is usable, otherwise `claude -p`. The old doc had the order backwards.
- **Fix:** The rewritten section states the shipped order.
- **Committed in:** 8a07781

---

**Total deviations:** 2 auto-fixed (Rule 1). **Impact:** None on scope. Both keep tests and docs consistent with the shipped behavior.

## Tracer Feedback Gate (Task 1)

The tracer `<verify>` (claude-cli-provider, client-result, daemon-fetch: 3 files, 96 tests) passed on the committed code. `human_verify_mode` is end-of-phase, and the orchestrator dispatched this plan as autonomous into a worktree that is removed on return. Following 08-03..08-05, the live `<human-check>` (claude logged out in zsh) is deferred to end-of-phase UAT (coverage D6).

## Issues Encountered

- A fresh worktree has no `node_modules`, so I ran `pnpm install --frozen-lockfile --prefer-offline`. It changed no tracked file.
- My first Task 1 commit was rejected by commitlint (`body-max-line-length` 100). I re-wrapped the body and the commit succeeded. Nothing was bypassed.

## Verification

- `pnpm exec vitest run tests/claude-cli-provider.test.ts tests/client-result.test.ts tests/daemon-fetch.test.ts --maxWorkers=1`: 3 files, 96 passed
- `pnpm exec vitest run tests/provider-resolver.test.ts`: 7 passed
- Full suite `pnpm exec vitest run --maxWorkers=2`: 42 files, 928/928 passed, exit 0. This includes `tests/claude-exec.test.ts`, so CR-01 stays closed.
- `pnpm typecheck`: 0 errors
- `pnpm exec biome check src tests`: clean (108 files)
- Acceptance greps for both tasks: all PASS ("To use OpenAI or Ollama instead, run `qq init provider`", "No AI provider is ready", both new test titles, `resolveProviderAdapter` in resolver.ts, "resolveAdapter ignores a provider.json pin", `ollama`/`openai` in the registry row, the "Choose a provider" heading, Ollama in Privacy defaults, and the QQ_PROVIDER_FILE/qq init provider/OPENAI_API_KEY doc check)
- Docs contain no `qq init zsh >> ~/.zshrc` and no whitelist/blacklist wording

## Deferred Human Check (end-of-phase UAT, not blocking)

With claude logged out (`claude /logout`), no ANTHROPIC_API_KEY, and no `~/.config/qq/provider.json`, trigger `??` in zsh. One line should print above the prompt naming `claude /login`, ANTHROPIC_API_KEY, and `qq init provider`, and the typed query should be restored in the buffer.

## User Setup Required

None.

## Next Phase Readiness

The gap-closure set 08-03..08-06 is complete. End-of-phase UAT still needs a live Ollama pin, a live OpenAI pin, a nothing-set-up run reaching a working provider in under 60 seconds, and a check that `qq init zsh` is unchanged.

## OpenWolf entries (deferred)

The orchestrator applies these; nothing under `.wolf/` was committed from the worktree.

**anatomy.md**
- Update `src/providers/claude-default.ts`: ENOENT copy starts "No AI provider is ready"; ENOENT and D-13 copy end with "To use OpenAI or Ollama instead, run `qq init provider`"; timeout copy unchanged.
- Update `src/providers/resolver.ts`: `resolveAdapter` documents that detection never selects; points at `resolveProviderAdapter()`.
- Update `docs/EXTENSIONS.md`: provider resolution = pin, otherwise the Claude default (pin examples, picker, QQ_PROVIDER_FILE, OPENAI_API_KEY).
- Update `README.md`: "Choose a provider" section (Claude default, OpenAI or Ollama via `qq init provider`), per-provider privacy.

**cerebrum.md, Key Learnings**
- [2026-10-17] 08-06: Commit bodies are limited to 100 characters per line (`body-max-line-length`), not only the subject. Wrap bullets before committing.
- [2026-10-17] The README provider section is "Choose a provider" (formerly "Authentication"). Its anchor `#choose-a-provider` is linked from Requirements.
- [2026-10-17] Only the Claude adapters stream rows (`onCandidate`). OpenAI and Ollama return the full list at once, so user docs saying rows "stream in" must say Claude.

**buglog.json**
- bug: commitlint `body-max-line-length` rejected the 08-06 Task 1 commit (body bullet over 100 chars). Fix: re-wrap the body lines. Tags: commitlint, git, commit-msg.

## Self-Check: PASSED

- FOUND: src/providers/claude-default.ts, tests/claude-cli-provider.test.ts, src/providers/resolver.ts, tests/provider-resolver.test.ts, docs/EXTENSIONS.md, README.md
- FOUND commits (ancestors of HEAD): 84425ea, 8a07781
- Commits measured: `git rev-list --count 3d3dd69..8a07781` = 2
