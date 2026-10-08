---
phase: 09-installed-only-command-awareness
plan: 03
subsystem: providers
tags: [zod, prompt-steering, anthropic-sdk, claude-cli, ipc-contract, allow-list]

requires:
  - phase: 09-01
    provides: zsh $commands handoff, QQ_TOOL_AWARENESS kill switch, client-side not-installed flag (the safety net behind steering)
provides:
  - src/shared/tool-catalog.ts shipped 196-name allow list (CATALOG, CATALOG_SET, installedCatalogTools, TOOL_NAME_RE, TOOL_NAME_MAX_LENGTH, INSTALLED_TOOLS_MAX)
  - lenient `installed-tools` variant of contextChunkSchema (daemon side, filters unknown names) and strictInstalledToolsChunkSchema (client side, rejects non-catalog names)
  - src/providers/steering.ts with QUEQUE_SYSTEM (moved), buildSteeringText, buildSystemPrompt
  - SDK `system` and `claude -p --system-prompt` both built by buildSystemPrompt(envelope)
  - `adapters` guard in tests/steering.test.ts (D-18)
  - EXTENSIONS.md "Prompt steering (Phase 9)" section; cross-phase notes in 08-03/08-04 plans
affects: [09-05, 08-03, 08-04]

actuals:
  tokens: 6420
  tasks: 3
  commits: 4
plan_head_before: a23e1a41564a64a163cd082766ccd19db8697309
plan_head_after: 96d1f0800b788afabeb6dc5c63be2a710bf6e637

tech-stack:
  added: []
  patterns:
    - "IPC schemas reject unknown SHAPES but filter unknown VALUES (zod transform), so catalog edits need no pong capability bump"
    - "Provider-neutral system prompt builder in steering.ts; claude.ts re-exports the constant to avoid an import cycle"
    - "Source-scanning guard test over src/providers/ enforcing the builder rule"

key-files:
  created:
    - src/shared/tool-catalog.ts
    - src/providers/steering.ts
    - tests/steering.test.ts
  modified:
    - src/contracts/request.ts
    - src/providers/claude.ts
    - src/providers/claude-cli.ts
    - tests/claude-provider.test.ts
    - tests/claude-cli-provider.test.ts
    - docs/EXTENSIONS.md
    - .planning/phases/08-zero-config-install-and-provider-detection/08-03-PLAN.md
    - .planning/phases/08-zero-config-install-and-provider-detection/08-04-PLAN.md

key-decisions:
  - "Steering wording (draft, spike 003 partial): tools line with 'standard system utilities are also present', D-15 prefer-installed, D-16 at least one installed-only candidate, D-17 never include install steps"
  - "Catalog kept verbatim from spike 003 (196 names) as a template literal split, frozen; header lists the basic utilities and package-only names it keeps and why they are harmless"
  - "Daemon-side chunk keeps the first occurrence of each catalog name in input order; buildSteeringText re-filters, dedupes and sorts before it reaches the prompt"

patterns-established:
  - "Steering lives only in the system prompt, never the user JSON or sampling parameters"
  - "Every src/providers/ file that calls buildPrompt( or hands a system prompt to a model must call buildSystemPrompt("

requirements-completed: [SC-6]

coverage:
  - id: D1
    description: "Shipped catalog allow list with 196 unique plain tool names and a sorted catalog ∩ installed helper"
    requirement: SC-6
    verification:
      - kind: unit
        ref: "tests/steering.test.ts#catalog"
        status: pass
    human_judgment: false
  - id: D2
    description: "Lenient daemon-side installed-tools schema filters unknown names and duplicates, rejects malformed names and >512 entries; strict client schema rejects non-catalog names with the D-04 message"
    requirement: SC-6
    verification:
      - kind: unit
        ref: "tests/steering.test.ts#installed-tools chunk schema"
        status: pass
    human_judgment: false
  - id: D3
    description: "buildSystemPrompt returns QUEQUE_SYSTEM byte-for-byte without the chunk and appends the D-15/D-16/D-17 steering with it"
    requirement: SC-6
    verification:
      - kind: unit
        ref: "tests/steering.test.ts#buildSystemPrompt"
        status: pass
      - kind: unit
        ref: "tests/steering.test.ts#buildSteeringText"
        status: pass
    human_judgment: false
  - id: D4
    description: "SDK system field and claude -p --system-prompt both come from buildSystemPrompt(envelope); user prompt byte-identical with or without the chunk"
    requirement: SC-6
    verification:
      - kind: unit
        ref: "tests/claude-provider.test.ts#sends installed-tools steering in the system prompt only, never the user prompt"
        status: pass
      - kind: unit
        ref: "tests/claude-provider.test.ts#builds a byte-identical user prompt with or without the installed-tools chunk"
        status: pass
      - kind: unit
        ref: "tests/claude-cli-provider.test.ts#passes buildSystemPrompt(envelope) with installed-tools steering as --system-prompt"
        status: pass
    human_judgment: false
  - id: D5
    description: "adapters guard fails any provider file that bypasses buildSystemPrompt (mutation-checked with a temporary bypassing adapter)"
    verification:
      - kind: unit
        ref: "pnpm exec vitest run tests/steering.test.ts -t adapters"
        status: pass
    human_judgment: false
  - id: D6
    description: "Steering wording actually reduces suggestions of missing tools with a live model"
    verification: []
    human_judgment: true
    rationale: "Wording is a draft from a partial spike (003, 6 of 15 queries); effect on live model output needs a finished spike or UAT, and the chunk is not sent until 09-05"

duration: 5min
completed: 2026-10-08
status: complete
---

# Phase 9 Plan 03: Installed-Tools Prompt Steering Summary

**A shipped 196-name catalog allow list, an `installed-tools` envelope chunk (filtered by the daemon, strict on the client), and a provider-neutral `buildSystemPrompt(envelope)`. It appends the D-15/D-16/D-17 steering to both the Anthropic SDK and `claude -p` paths. A source-scanning guard stops future adapters from bypassing it.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-10-08T08:27:22Z
- **Completed:** 2026-10-08T08:32:48Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- `src/shared/tool-catalog.ts`: the spike 003 catalog, verbatim and frozen. Its header now accurately says which basic utilities and package-only names it keeps, and why they are harmless.
- `contextChunkSchema` gained an `installed-tools` variant. It validates name shape (regex, 64 chars, 512 entries) and quietly drops unknown names and duplicates through a zod transform. Catalog drift between a newer client and an older daemon therefore never causes the 800 ms ack-timeout trap. `strictInstalledToolsChunkSchema` is the client-side check, ready for 09-05.
- `src/providers/steering.ts` owns `QUEQUE_SYSTEM` (claude.ts re-exports it). `buildSystemPrompt` runs `filterContextEnvelope` first and re-filters tools to catalog names.
- Both Claude paths now send `buildSystemPrompt(envelope)`. With no chunk the system prompt is byte-identical to before, and the user prompt never changes.
- `adapters` guard, rules (a) to (d). A mutation check with a temporary bypassing adapter failed (a), (b) and (d) as expected.
- EXTENSIONS.md documents the builder rule, the catalog-vs-shape capability rule, the kill switch and the `rehash` side effect. 08-03 and 08-04 carry a cross-phase note before `<tasks>`.

## Task Commits

1. **Task 1 RED: failing tests + throw-on-call stubs** - `ef3899b` (test)
2. **Task 1 GREEN: catalog chunk schemas and steering builder** - `fad6ef3` (feat)
3. **Task 2: route SDK and CLI through buildSystemPrompt + adapters guard** - `f11d400` (feat)
4. **Task 3: EXTENSIONS.md section and Phase 8 cross-phase notes** - `96d1f08` (docs)

No REFACTOR commit; the GREEN code needed no cleanup.

## TDD Gate Compliance

- **RED** (`ef3899b`): 17 of 23 new tests failed and 6 data-only catalog tests passed. Typecheck stayed clean because the stubs export the chunk shape without validation. Classifier: `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`). The target was `tests/steering.test.ts > installed-tools chunk schema > lenient daemon-side variant (contextChunkSchema) > rejects a shell command`, run with `--reporter=tap-flat`.
- **Semantic assessment:** the target ran and failed on its planned assertion (`expected true to be false`), because the stub variant accepted `'rm -rf ~'`. There were no import, syntax or fixture faults.
- **Evidence note:** the first classifier run against the full file returned `INVALID_RED (invalid_record)`. Vitest's TAP reporter writes multi-line `toEqual` diffs without indentation, which is malformed TAP. Re-running a target whose assertion message is one line produced a valid report. Nothing was edited by hand.
- **GREEN** (`fad6ef3`): 23/23 pass, and the full suite (412 tests at that point) passes.

## Files Created/Modified

- `src/shared/tool-catalog.ts` - catalog allow list, shape constants, `installedCatalogTools`
- `src/contracts/request.ts` - lenient `installed-tools` union variant and `strictInstalledToolsChunkSchema` (+ `StrictInstalledToolsChunk` type), privacy-review header extended
- `src/providers/steering.ts` - `QUEQUE_SYSTEM`, `buildSteeringText`, `buildSystemPrompt`
- `src/providers/claude.ts` - re-export of `QUEQUE_SYSTEM`; `system: buildSystemPrompt(envelope)`
- `src/providers/claude-cli.ts` - `--system-prompt` value from `buildSystemPrompt(envelope)`
- `tests/steering.test.ts` - catalog, chunk schemas, builder, `adapters` guard (28 tests)
- `tests/claude-provider.test.ts` - steering in `system` only, unchanged constant without the chunk, byte-stable `buildPrompt`, no sampling params
- `tests/claude-cli-provider.test.ts` - `--system-prompt` equals `buildSystemPrompt(envelope)`
- `docs/EXTENSIONS.md` - "Prompt steering (Phase 9)" section
- `08-03-PLAN.md`, `08-04-PLAN.md` - "Cross-phase note from Phase 9 (09-03)" before `<tasks>`

## Decisions Made

- The catalog stays a template literal split (the spike's own form), not a 196-line array literal. It is easier to diff against the spike, and order is kept.
- The daemon-side transform keeps input order (first occurrence). Sorting happens later, in `buildSteeringText`, so the wire contract makes no ordering promise.
- `StrictInstalledToolsChunk` type exported alongside the strict schema, as the plan asked ("also export its inferred type").

## Deviations from Plan

**1. [Process] Did not run `git restore --staged --worktree -- .wolf` before commits.**
- **Found during:** Task 1 commit
- **Issue:** The plan's `.wolf` rule says to run `git restore --staged --worktree -- .wolf`. The `--worktree` half would discard existing uncommitted `.wolf/anatomy.md`, `.wolf/memory.md` and `.wolf/hooks/_session.json` changes written by the OpenWolf hooks and the orchestrator session. Those changes are not this plan's to destroy.
- **Fix:** Ran `git restore --staged -- .wolf` (unstage only) before each commit and staged files by explicit path. The goal (no `.wolf/` file in any 09-03 commit) is met and was verified by the plan's `git log --grep='(09-03)' -- .wolf` check.
- **Files modified:** none

**2. [Process] RED evidence re-run with a single-line target** (see TDD Gate Compliance). This is a reporter-format workaround, not a change to the tests.

**Total deviations:** 2 process-level, 0 code. **Impact:** none on scope or behaviour.

## Issues Encountered

- `pnpm lint` reports 2 warnings in files this plan never touched (`src/ui/CandidateSelect.tsx` unused suppression, `tests/modal-layout.test.ts` unused import). They are out of scope and were left alone. Lint still exits 0.

## Deferred OpenWolf updates

For 09-05 Task 1 to apply (wave-2 rule: no `.wolf/` commits in this plan):

- **anatomy.md entries**
  - `src/shared/tool-catalog.ts`: shipped 196-name allow list of notable CLI tools (spike 003 seed, frozen), `CATALOG_SET`, `installedCatalogTools(isInstalled)` (sorted in Node), shape constants `TOOL_NAME_RE` / `TOOL_NAME_MAX_LENGTH` (64) / `INSTALLED_TOOLS_MAX` (512). Zero imports. ~1.0k tokens
  - `src/providers/steering.ts`: `QUEQUE_SYSTEM` (moved from claude.ts), `buildSteeringText(tools)` (catalog re-filter, dedupe, sort, 4 lines D-15/16/17), `buildSystemPrompt(envelope)` (filterContextEnvelope first; byte-identical without the chunk). ~0.7k tokens
  - `tests/steering.test.ts`: catalog, lenient/strict `installed-tools` schemas (incl. catalog drift), builder wording and byte-stability, `adapters` source guard over src/providers/ (rules a-d). ~2.3k tokens
  - Update `src/contracts/request.ts` (now also has the `installed-tools` variant and `strictInstalledToolsChunkSchema`), `src/providers/claude.ts` (re-exports `QUEQUE_SYSTEM`; SDK `system` from `buildSystemPrompt`), `src/providers/claude-cli.ts` (`--system-prompt` from `buildSystemPrompt`).
- **cerebrum Decision Log:** `[2026-10-08] Phase 9 steering wording (draft, spike 003 partial): system prompt gets "Notable command-line tools installed on this machine (standard system utilities are also present): …", "Prefer installed tools. A tool that is not installed is acceptable only when it is clearly better for the task.", "At least one candidate must use only installed tools or standard system utilities.", "Never include install steps …". System prompt only; no sampling params; user prompt unchanged.`
- **cerebrum Key Learning:** `[2026-10-08] IPC schemas filter unknown values (zod transform) and reject only unknown shapes; shape changes need a pong capability bump. The installed-tools variant drops non-catalog names instead of failing ipcRequestSchema.`
- **cerebrum Key Learning:** `[2026-10-08] Every src/providers/ adapter must use buildSystemPrompt(envelope) from steering.ts (never raw QUEQUE_SYSTEM); tests/steering.test.ts "adapters" scans the directory and fails otherwise.`
- **cerebrum Do-Not-Repeat:** `[2026-10-08] Vitest --reporter=tap-flat emits multi-line toEqual diffs unindented (malformed TAP), so gsd tdd-red-evidence returns invalid_record. Pick a RED target whose assertion message is a single line (toBe on a boolean) and run it with -t.`
- **buglog:** none. No code bugs were found; the TAP reporter quirk is recorded above as a Do-Not-Repeat.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- 09-05 can send the chunk. It should build it with `installedCatalogTools(name => installedSet.has(name))`, check it with `strictInstalledToolsChunkSchema` before sending, and bump the pong `installedTools` capability. Until then nothing on the wire changes.
- 08-03/08-04 executors are told to use `buildSystemPrompt(envelope)`. The `adapters` guard will fail them if they don't.
- The steering wording is still a draft until spike 003 is finished (deferred idea). The client-side not-installed flag from 09-01 remains the safety net.

---
*Phase: 09-installed-only-command-awareness*
*Completed: 2026-10-08*

## Self-Check: PASSED

All created files exist; commits ef3899b, fad6ef3, f11d400, 96d1f08, bb8049b are ancestors of HEAD. Plan verification: steering/claude-provider/claude-cli-provider tests pass, full suite 421/421, typecheck 0 errors, lint exit 0, no 09-03 commit touches src/client, src/context, src/daemon or .wolf.
