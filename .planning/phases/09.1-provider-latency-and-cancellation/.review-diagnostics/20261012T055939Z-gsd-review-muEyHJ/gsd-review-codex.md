codex review failed or returned empty output. stderr:
OpenAI Codex v0.145.0
--------
[1mworkdir:[0m /Users/samuel/dev/tui-llm
[1mmodel:[0m gpt-5.5
[1mprovider:[0m openai
[1mapproval:[0m never
[1msandbox:[0m workspace-write [workdir, /tmp, $TMPDIR]
[1mreasoning effort:[0m high
[1mreasoning summaries:[0m none
[1msession id:[0m 01a12ea7-de86-70e1-96a1-cb843bec6312
--------
[36muser[0m
# Cross-AI Plan Review Request

You are reviewing implementation plans for a software project phase.
Provide structured feedback on plan quality, completeness, and risks.


## Project Context
# QueQue

## What This Is

QueQue is a `zsh`-integrated command-line assistant that opens from a literal `??` trigger while the user is editing the shell command line. It stays inside the terminal workflow, uses the text already typed before the trigger as context, and returns an explainable shell command back into the live buffer instead of pushing the user out to a browser or a prompt-taking CLI.

The initial product is for developers and terminal users who want faster command recall without giving up control, but it should also make the terminal less intimidating for newer users by showing what suggested commands do.

## Core Value

Turn natural-language intent into a shell command that feels native to the terminal workflow, not bolted on top of it.

## Requirements

### Validated

- ✓ Suggestions favour installed tools; a candidate using a missing tool stays selectable and is flagged with a cyan ⓘ (legend above the controls), with Tab prepending a guarded install command — Phase 9

### Active

- [ ] Open from a literal `??` trigger inside `zsh` without taking over the shell prompt.
- [ ] Use pre-trigger command-line text plus current shell context to produce relevant command suggestions.
- [ ] Show a fuzzy-finder-like TUI with ranked commands and short explanations for high-confidence requests.
- [ ] Return the selected command back into the shell buffer safely and predictably.
- [ ] Define an LLM adapter interface so each backend implements the same request/response contract.

### Deferred

- [ ] Keep low-confidence requests inside an in-TUI clarification chat until a refined command is ready. *(Phase 5 deferred — Esc + re-query workaround)*

### Out of Scope

- Public plugin marketplace in v1 — extension seams matter now, but third-party loading can wait until the core UX is stable.
- Direct command execution in v1 — insertion-only is safer and preserves user control.
- Multi-shell support in v1 — macOS `zsh` is the fastest route to a usable product in two weeks.
- Persistent history by default — privacy-forward defaults matter more than convenience in the first release.

## Context

The product exists because current AI command-line helpers still feel like strangers in the normal terminal flow. Browser-based chat requires copy-paste, and many CLI tools either take over the prompt, feel constraining, or do not expose enough levers to tune their behavior. QueQue should feel more seamless: invoked inline from the current shell edit session, dismissible with `Esc`, and capable of writing the final command back into the same buffer.

The intended audience spans advanced shell users and newer users. Advanced users should reach for QueQue when they know what they want but do not want to recall exact syntax, quoting, or flag combinations. Newer users should benefit from short command explanations attached to each result so the tool teaches while it assists.

The product is meant to be used during development of the product itself. Daily-driver usage on the local machine is part of the feedback loop for bug fixing and UX refinement.

## Constraints

- **Timeline**: Reach a usable daily-driver product in 2 weeks — optimize for the fastest working path first.
- **Tech stack**: TypeScript on Node LTS — maximize implementation speed and API/TUI ergonomics.
- **Tooling stack**: `pnpm`, `tsup`, `vitest`, `zod`, `cac`, `ink`, `@anthropic-ai/sdk` — lock the MVP toolchain early so implementation can proceed in parallel.
- **Shell integration**: Deep `zsh` integration via ZLE widget — standalone CLI behavior is not enough.
- **Provider**: Start with Claude only via `ANTHROPIC_API_KEY` — provider abstraction must exist so this choice is not permanent.
- **Safety**: Return commands to the shell buffer, do not execute them automatically — users stay in control.
- **UX**: Stay inside terminal flow — avoid prompt takeover and browser detours.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use literal `??` as the trigger | Short, memorable, and purpose-built for inline invocation | — Pending |
| Capture text before the trigger as context | Makes suggestions sensitive to what the user was already building in the shell | — Pending |
| Use a confidence threshold of `0.8` | Supports a fast command-selection path without skipping needed clarification | — Pending |
| Keep high-confidence selection and low-confidence chat in the same TUI | Preserves flow and avoids switching UX modes unnecessarily | — Pending |
| Start with Anthropic/Claude only behind a provider interface | Fastest implementation path while preserving future model/provider expansion | — Pending |
| Model backends must implement one shared LLM adapter interface | Keeps Claude, OpenAI, and local-model support from diverging in behavior or transport shape | — Pending |
| Validate provider and IPC payloads with Zod | Shell mutation depends on trustworthy structured responses, so schemas should fail closed | — Pending |
| Use `pnpm` + `tsup` + `vitest` + `cac` as the CLI/tooling baseline | Keeps scaffolding, packaging, testing, and command parsing simple and fast for a 2-week MVP | — Pending |
| Start the TUI with Ink and helper input/list components, but keep a narrow UI adapter seam | Fastest route to a working fuzzy-list/chat prototype while preserving the option to swap UI internals if raw input handling proves limiting | — Pending |
| Prioritize extension seams early | Future shell adapters, providers, storage, and plugins should land independently | — Pending |
| Installed-tool awareness from zsh's own `$commands`/builtins/functions, rehashed on every `??` | Always current (incl. tools installed earlier in the session) at ~10–12 ms, no background cache | ✓ Good — Phase 9 |
| Missing tools are flagged (ⓘ + selection-independent legend), never dropped; the modal never changes height with the selection | User decision at the Phase 9 checkpoint | ✓ Good — Phase 9 |
| Install commands are built locally and insertion-only (safe package names, no `-y`); package names from per-installer aliases | The model never writes install text; model-supplied package names are backlog 999.1 | — Pending (999.1) |
| Zellij floating-pane resizes run one at a time, newest height wins; layout height is decided during render, never from a transient filtered frame | Detached `zellij action` calls applied in finish order left the modal empty (G-09-7) | ✓ Good — Phase 9 (09-06) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason

## Phase 09.1: Provider Latency and Cancellation
### Roadmap Section
### Phase 09.1: Provider Latency and Cancellation (INSERTED)

**Goal:** Cut the `??` thinking→candidates wait on the `claude -p` path from ~5.3 s (keypress → candidates, measured median) toward ~2 s to the first candidate, and make Esc actually stop the in-flight model call. Evidence and measurements: `.planning/debug/llm-response-latency-profile.md`.
**Scope:**
1. Pass `--effort low` to `claude -p`. Today QueQue passes no `--model`/`--effort`, so it inherits the account default (Opus 5.5 at `xhigh`). Saves ~1.05 s and the thinking variance.
2. `--output-format stream-json`. Resolve on the `result` event, not process exit (−0.44 s). Rules:
   - Parse only the final result text, after checking `is_error`.
   - Use a line-buffered, UTF-8-safe parser.
   - Keep the auth-failure error contract.
   - Let the child exit on its own, with a backstop kill.
3. Stream the first candidate early: a new daemon IPC message and a candidate list that grows as candidates arrive (first row ~3.3 s, ~2.3 s with #1).
4. Keep one prewarmed `claude -p` process in the daemon (−0.93 s). The prompt then goes over stdin instead of argv, which closes T-08-02-07.
5. Cancellation end to end:
   - Esc in the client closes the IPC request.
   - The daemon handles socket `close` and aborts the provider call through an `AbortSignal`: SDK `messages.create({signal})`, and a kill of the `claude -p` child.
   - This also fixes the deferred bug from quick 261011-jbh: Esc during `thinking…` leaves the client running.

**Out of scope:** Switching models (Haiku-class), the API-key SDK path's `.env.local` cwd bug, and prompt caching (~0 gain, measured).
**Requirements**: TBD (no REQ IDs mapped; coverage target is 09.1-CONTEXT.md D-01..D-17)
**Depends on:** Phase 9
**Plans:** 8 plans

Plans:
**Wave 1**
- [ ] 09.1-01-PLAN.md — Tracer: Esc kills the `claude -p` call end to end; stream-json turn with the prompt on stdin resolves on `result`; per-stage turn logs (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 09.1-02-PLAN.md — `--effort low` default with a config.json override; candidates parsed from the stream on the `claude -p` path (wave 2)
- [ ] 09.1-03-PLAN.md — Streaming IPC: `candidate` messages, `streamCandidates` pong flag, no in-process re-query after rows (wave 2)
- [ ] 09.1-06-PLAN.md — stream-json runner hardening: UTF-8 parser with carry cap, stderr cap, post-result backstop, every failure path proven against real children (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 09.1-04-PLAN.md — SDK path parity: `messages.stream` with abort signal, streamed candidates, `output_config.effort` (wave 3)
- [ ] 09.1-05-PLAN.md — One prewarmed `claude -p` in the daemon, matched on cwd and argv, refilled after every query, one cold retry (wave 3)
- [ ] 09.1-07-PLAN.md — Growing candidate list: steady highlight, spinner row, live filter, one Zellij resize at completion, partial-failure rows (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 09.1-08-PLAN.md — Phase gate: OpenWolf records, full suite and build, manual real-provider latency and cancel UAT (wave 4)

### Requirements Addressed
No requirement IDs are mapped to this phase; coverage target is CONTEXT.md decisions D-01..D-17.

# Requirements: QueQue

**Defined:** 2026-04-30
**Core Value:** Turn natural-language intent into a shell command that feels native to the terminal workflow, not bolted on top of it.

## v1 Requirements

### Shell Integration

- [ ] **SHL-01**: User can trigger QueQue by typing a literal `??` while editing a `zsh` command line.
- [ ] **SHL-02**: Text already typed before the `??` trigger is captured as request context.
- [ ] **SHL-03**: User can dismiss QueQue with `Esc` and return to the shell with no buffer changes.
- [ ] **SHL-04**: User can confirm a suggested command and have it written back into the live shell buffer with a correct cursor position.

### Intent and Context

- [x] **INT-01**: Tool classifies the user request into a broad intent category before gathering extra context.
- [x] **INT-02**: Tool always includes base shell context such as query text, current working directory, shell, platform, and TTY metadata.
- [x] **INT-03**: Tool gathers extra context only when it is relevant to the inferred intent instead of assuming repo/code context for every request.
- [ ] **INT-04**: Tool routes requests with confidence below `0.8` into a clarification flow inside the TUI. *(Deferred — Phase 5)*

### Command Suggestions

- [ ] **CMD-01**: Tool returns a ranked list of command candidates for requests with confidence at or above `0.8`.
- [ ] **CMD-02**: Each command candidate includes a short explanation of what the command will do.
- [ ] **CMD-03**: User can navigate command candidates with keyboard-only controls and confirm a selection.
- [x] **CMD-04**: Tool never auto-executes commands in v1; it only returns them to the shell buffer.

### TUI Experience

- [ ] **TUI-01**: Trigger opens a fuzzy-finder-style TUI with initial keyboard focus in the input area.
- [ ] **TUI-02**: Low-confidence clarification stays inside the same TUI instead of bouncing the user into a separate prompt flow. *(Deferred — Phase 5)*
- [ ] **TUI-03**: TUI can show clarifying turns and then return a refined command candidate list or final command. *(Deferred — Phase 5)*

### Provider and Runtime

- [ ] **PRV-01**: Tool can call Claude using `ANTHROPIC_API_KEY`.
- [ ] **PRV-02**: Provider integration is isolated behind a provider interface so more models/providers can be added later.
- [ ] **PRV-03**: Every LLM backend implements the same adapter contract for direct suggestion, clarification continuation, structured confidence/result parsing, and error mapping.
- [x] **RUN-01**: A background daemon keeps repeat invocations fast and avoids paying full startup cost on every use.
- [ ] **RUN-02**: If the daemon is missing or stale, the client can recover without corrupting shell state.

### Safety and Extensibility

- [ ] **SAFE-01**: Errors and provider failures surface cleanly without mutating the shell buffer.
- [x] **EXT-01**: Internal registries exist for shell adapters, context providers, provider backends, and storage/extension hooks.

## v2 Requirements

### Shell Expansion

- **BASH-01**: User can invoke QueQue from `bash` with equivalent buffer-replacement behavior.
- **ZSHX-01**: User can use QueQue on non-macOS `zsh` environments.

### History and Personalization

- **HIST-01**: User can opt into local history for queries, accepted commands, and follow-up context.
- **HIST-02**: User can clear local history and disable persistence per feature area.

### Provider and Plugin Growth

- **LLM-01**: Tool supports additional hosted providers behind the same provider interface.
- **LLM-02**: Tool supports local model backends for privacy-sensitive usage.
- **PLG-01**: Tool supports a public plugin manifest and capability-based plugin loading model.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-executing the selected command | Safety and trust are more important than saving the final Enter key in v1 |
| Browser-based chat companion | The product thesis is seamless terminal-native interaction |
| Prompt takeover / alternate shell replacement | Users should return to the same shell buffer, not a different shell UX |
| Persistent history enabled by default | Privacy-forward defaults are required for the first release |
| Public plugin marketplace | Extension architecture matters now, external plugin distribution does not |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHL-01 | Phase 1 | Pending |
| SHL-02 | Phase 1 | Pending |
| SHL-03 | Phase 1 | Pending |
| SHL-04 | Phase 1 | Pending |
| RUN-01 | Phase 1 | Complete |
| INT-01 | Phase 2 | Complete |
| INT-02 | Phase 2 | Complete |
| INT-03 | Phase 2 | Complete |
| EXT-01 | Phase 2 | Complete |
| PRV-01 | Phase 3 | Pending |
| PRV-02 | Phase 3 | Pending |
| PRV-03 | Phase 3 | Pending |
| CMD-01 | Phase 3 | Pending |
| CMD-02 | Phase 3 | Pending |
| SAFE-01 | Phase 3 | Pending |
| TUI-01 | Phase 4 | Pending |
| CMD-03 | Phase 4 | Pending |
| RUN-02 | Phase 4 | Pending |
| INT-04 | Phase 5 | Deferred |
| TUI-02 | Phase 5 | Deferred |
| TUI-03 | Phase 5 | Deferred |
| CMD-04 | Phase 6 | Complete |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-30*
*Last updated: 2026-06-17 after Phase 5 deferral*


### User Decisions (CONTEXT.md)
# Phase 09.1: Provider Latency and Cancellation - Context

**Gathered:** 2026-10-11
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase cuts the `??` wait between `thinking…` and the candidates on the `claude -p` path. The measured median today is ~5.3 s from keypress to candidates. The target is the first candidate in about 2 s.

It also makes Esc, and Enter before every candidate has arrived, actually stop the model call, from the client through the daemon to the provider.

There are four levers, all measured in `.planning/debug/llm-response-latency-profile.md`:
1. Lower the effort setting.
2. Resolve on the `result` event from stream-json instead of waiting for the process to exit.
3. Stream candidates to the UI as each one arrives.
4. Keep a prewarmed `claude -p` process in the daemon.

Out of scope:
- switching to a Haiku-class model
- the `.env.local` lookup bug on the API-key SDK path, which depends on the daemon's working directory
- prompt caching, which was measured at about 0 gain
- new providers

</domain>

<decisions>
## Implementation Decisions

### Model and effort
- **D-01:** `claude -p` gets `--effort low` by default.
  - An optional `effort` key in `~/.config/qq/config.json` overrides it. That file is loaded by `src/shared/qq-config.ts`, which today holds privacy patterns.
  - Invalid values fall back to the default; they don't fail the query.
- **D-02:** Don't pass `--model`. The account's default model stays in charge (Opus 5.5 today).
- **D-03:** The SDK path (API key) reads the same `effort` setting and maps it onto the Messages request, so both paths behave alike.
  - This can't be measured on the dev machine, which has no API key, so it relies on tests only.
  - Keep the SDK's current model (`claude-sonnet-5`). Mapping effort onto it is the researcher's job: check the current Anthropic API docs for which effort or thinking parameter applies.

### Output parsing (stream-json)
- **D-04:** Switch `claude -p` to `--output-format stream-json`. The rules carry over from the debug session's specialist review:
  - Use a line-buffered parser that keeps multi-byte UTF-8 characters intact when they're split across chunks.
  - Only the final answer text reaches `parseCandidates`, and only after checking `is_error`. Error text such as "Not logged in" must never become a command candidate. See `src/providers/claude.ts` lines 73-75, where any non-JSON text is treated as a command.
  - Keep the existing auth-failure and error message rules (08 D-12/D-13).
  - Resolve as soon as the result arrives. Let the child exit on its own, with a backstop kill.
  - Research must confirm whether `--verbose` is needed alongside stream-json for the Claude Code version installed (2.1.285).

### Candidates arriving one by one
- **D-05:** The daemon sends each candidate to the client over IPC as soon as it parses.
  - This needs a new message kind in `src/contracts/ipc.ts`, plus a final "done" signal.
  - The pong capability flag must change so an old daemon gets replaced (the existing `bootstrap.ts` capability check).
- **D-06:** The highlight stays where the user put it.
  - The first arrival is highlighted.
  - Later rows are added below and never move the highlighted row.
  - Rows stay in the model's order (09 D-13).
- **D-07:** Enter works on any row that has arrived, straight away. It returns that row and cancels the rest of the call through the same abort path as Esc (D-13).
- **D-08:** While more rows are coming, the existing `thinking…` spinner row sits below the last candidate. It disappears when the list is complete.
- **D-09:** Text typed into FILTER also applies to rows that arrive later. A new row only shows if it matches.
- **D-10:** In Zellij, the floating pane opens at the full capped height (`QQ_PANE_HEIGHT`) and fills in, so there are no resizes while rows arrive.
  - The user chose this over growing per row.
  - It needs to fit with the existing serialized resize queue and the f9o filter hold: no shrinking while rows are still arriving.

### Prewarmed `claude -p` process
- **D-11:** Keep one prewarmed `claude -p` process ready.
  - Start a fresh one right after each query uses the current one.
  - *Amended 2026-10-11 after research:* no prewarm at daemon start. The daemon doesn't yet know the cwd or the installed-tools prompt, so a startup process never matches the D-12 key. The first `??` after a daemon start runs cold.
  - It is never stopped for being idle. The user accepts one Claude Code process staying in memory while the daemon runs.
  - The prompt goes over stdin (stream-json input or similar), not the command line, which closes T-08-02-07 (`ps` can no longer see the prompt).
- **D-12:** A prewarmed process is used only when it matches the query's cwd and a hash of its system prompt (steering plus installed tools). Otherwise:
  - kill it,
  - run this query cold, as today,
  - then prewarm again with the new cwd and prompt.

  The replacement is started in the last query's cwd, so repeated queries in one directory stay warm.

### Cancellation and Esc
- **D-13:** The provider call is killed right away when the client goes away.
  - The client closes the IPC socket on Esc or on an early Enter.
  - The daemon listens for socket `close` and aborts through an `AbortSignal` threaded into the provider call:
    - SDK: `messages.create(..., { signal })`.
    - `claude -p`: SIGTERM, then SIGKILL as a backup after a short grace period.
  - A killed prewarmed process uses up that slot, so a new one is started (D-11).
- **D-14:** Candidates that arrived before Esc are thrown away. The buffer is unchanged and nothing is stored, which matches today's cancel rule and the no-local-memory privacy default.
- **D-15:** On Esc the client writes the cancel result, closes the socket and exits straight away, without waiting for the daemon to confirm. This fixes the deferred bug from quick 261011-jbh ("Esc during `thinking…` leaves the client running"; see that task's `deferred-items.md` #1).

### Amendments after research (2026-10-11)
- **D-16:** If the call fails after some candidates are already on screen (timeout, crash, or a non-zero exit after rows arrived), the arrived rows stay selectable. The `thinking…` row becomes a short dim note that the list may be incomplete. The error view shows only when no rows arrived.
- **D-17:** Zellij: the pane opens at the capped height while rows arrive (D-10). When the list is complete, it shrinks once to fit, with exactly one resize per `??`, and then the f9o filter hold applies.

### Claude's Discretion
- How the prewarmed process takes its prompt: stream-json input or plain stdin. Pick whichever Claude Code 2.1.285 supports with one prompt per process, and verify it with one live call.
- How the backstop kill and SIGKILL grace period are timed.
- How the incremental candidate parser pulls whole candidates out of a JSON array that is still streaming in. Option: change the output format the prompt asks for, for example one JSON object per line. That needs both adapters and the steering tests to stay consistent.
- Whether to retry once, cold, when a prewarmed process fails. Research recommends yes, but only when the child died before `init` or exited without a `result`.
- How per-stage provider timing is logged in the debug log. The debug session's guard recommendation is a latency regression check; pick a shape that won't flake under load (bug-206).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Evidence and measurements
- `.planning/debug/llm-response-latency-profile.md`: stage timing table, ranked fixes, specialist pitfalls. This is the main evidence for the phase.
- `.planning/quick/261011-jbh-instant-first-frame-from-the-zsh-widget-/deferred-items.md`: the Esc-during-`thinking…` bug (#1) that D-15 fixes.
- `.planning/debug/resolved/modal-blank-before-loading.md`: how debug-log stage timestamps are read, and how first-frame probes are run.

### Prior decisions that constrain this phase
- `.planning/phases/08-zero-config-install-and-provider-detection/08-CONTEXT.md`: provider selection (SDK when a key exists, `claude -p` only for `/login`), failure and error copy (D-12/D-13), and T-08-02-07 (prompt visible in `ps`).
- `.planning/phases/09-installed-only-command-awareness/09-CONTEXT.md`: candidate order (D-13) and steering on every provider path (D-18).
- `.planning/phases/09-installed-only-command-awareness/09-REVIEW-DISPOSITION.md`: open Zellij resize queue findings WR-06/WR-07, relevant to D-10.
- `.planning/ROADMAP.md`: the Phase 09.1 entry with scope and out-of-scope.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/providers/claude-exec.ts`: the current child-process wrapper (timeout, kill signal). Extend it to stream and accept an abort signal, or replace it.
- `src/providers/claude-cli.ts`: builds the `claude -p` argv (`--safe-mode --tools '' --no-session-persistence --system-prompt …`) and runs it in `envelope.base.cwd`.
- `src/providers/claude-default.ts`: chooses SDK or CLI, keeps the 25 s total budget, and maps timeouts and kills to `TIMEOUT_MESSAGE`.
- `src/providers/steering.ts` `buildSystemPrompt(envelope)`: the system prompt, which the prewarm key (D-12) hashes.
- `src/shared/qq-config.ts`: the existing config loader that gets the `effort` key (D-01).
- `src/ui/LoadingSpinner.tsx`, `src/ui/CandidateSelect.tsx`: the spinner row and the list. 09-06 added a render-phase reset for new candidates (`prevCandidates`), which streaming has to change so the highlight is never reset (D-06).

### Established Patterns
- IPC is zod-validated in `src/contracts/ipc.ts`. Changes to message shape need a capability bump so old daemons get replaced (`src/daemon/bootstrap.ts`).
- The daemon sends `fetch-accepted` before `candidates`. `src/daemon/fetch-client.ts` has ack and total timers (26 s).
- Zellij resizes run through a serialized latest-wins queue with a 2 s settle timeout (09-06).
- Tests: vitest, written TDD-first in recent quick tasks. Measurements must use the real provider, not stubs.

### Integration Points
- `src/daemon/server.ts`: today it only handles `'error'` on the socket. It needs `'close'` handling to fire the abort (D-13) and a way to push candidates one by one (D-05).
- `src/client/run-foreground.ts` `onCancel` and `onSelect`: they need to close the IPC request and exit (D-15, D-07).
- `src/providers/claude.ts` `messages.create`: add `signal` and the effort mapping.

</code_context>

<specifics>
## Specific Ideas

- The user's words: "i wish the llm response was faster".
- The user asked directly whether the fetch had an abort signal. It doesn't, at any layer. Making cancellation real is a first-class goal, not a side effect.
- The target from the profile is the first candidate in about 1.7-2.0 s with all four levers combined. That's an estimate to check after the work, not a promise.

</specifics>

<deferred>
## Deferred Ideas

- A Haiku-class model with thinking explicitly off (profile fix #5, about -1.4 s at some cost to quality). This would be its own phase, if wanted.
- Shorter candidate explanations (profile fix #6, estimated -0.4 to -0.7 s). This changes the product's output style.
- The SDK path's `.env.local` lookup depends on the directory the daemon happened to start in (`src/daemon/bootstrap.ts`, `src/shared/env-file.ts`). It's a real bug but outside this phase; it could be a quick task.
- Ink frame rows left behind after accept when the frame is taller than the inline reserve (quick 261011-jbh `deferred-items.md` #2).

</deferred>

---

*Phase: 09.1-provider-latency-and-cancellation*
*Context gathered: 2026-10-11*


### Research Findings
# Phase 09.1: Provider Latency and Cancellation - Research

**Researched:** 2026-10-11
**Domain:** Claude Code `claude -p` stream-json I/O, child-process lifecycle and cancellation, Anthropic TS SDK effort and abort, streaming IPC, and an Ink list that grows
**Confidence:** HIGH for Claude Code 2.1.285 behaviour (live probes this session), HIGH for in-repo contracts (read this session), MEDIUM for the SDK path (types and docs only; no API key on this machine)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Model and effort
- **D-01:** `claude -p` gets `--effort low` by default.
  - An optional `effort` key in `~/.config/qq/config.json` overrides it. That file is loaded by `src/shared/qq-config.ts`, which today holds privacy patterns.
  - Invalid values fall back to the default; they don't fail the query.
- **D-02:** Don't pass `--model`. The account's default model stays in charge (Opus 5.5 today).
- **D-03:** The SDK path (API key) reads the same `effort` setting and maps it onto the Messages request, so both paths behave alike.
  - This can't be measured on the dev machine, which has no API key, so it relies on tests only.
  - Keep the SDK's current model (`claude-sonnet-5`). Mapping effort onto it is the researcher's job: check the current Anthropic API docs for which effort or thinking parameter applies.

#### Output parsing (stream-json)
- **D-04:** Switch `claude -p` to `--output-format stream-json`. The rules carry over from the debug session's specialist review:
  - Use a line-buffered parser that keeps multi-byte UTF-8 characters intact when they're split across chunks.
  - Only the final answer text reaches `parseCandidates`, and only after checking `is_error`. Error text such as "Not logged in" must never become a command candidate. See `src/providers/claude.ts` lines 73-75, where any non-JSON text is treated as a command.
  - Keep the existing auth-failure and error message rules (08 D-12/D-13).
  - Resolve as soon as the result arrives. Let the child exit on its own, with a backstop kill.
  - Research must confirm whether `--verbose` is needed alongside stream-json for the Claude Code version installed (2.1.285).

#### Candidates arriving one by one
- **D-05:** The daemon sends each candidate to the client over IPC as soon as it parses.
  - This needs a new message kind in `src/contracts/ipc.ts`, plus a final "done" signal.
  - The pong capability flag must change so an old daemon gets replaced (the existing `bootstrap.ts` capability check).
- **D-06:** The highlight stays where the user put it.
  - The first arrival is highlighted.
  - Later rows are added below and never move the highlighted row.
  - Rows stay in the model's order (09 D-13).
- **D-07:** Enter works on any row that has arrived, straight away. It returns that row and cancels the rest of the call through the same abort path as Esc (D-13).
- **D-08:** While more rows are coming, the existing `thinking…` spinner row sits below the last candidate. It disappears when the list is complete.
- **D-09:** Text typed into FILTER also applies to rows that arrive later. A new row only shows if it matches.
- **D-10:** In Zellij, the floating pane opens at the full capped height (`QQ_PANE_HEIGHT`) and fills in, so there are no resizes while rows arrive.
  - The user chose this over growing per row.
  - It needs to fit with the existing serialized resize queue and the f9o filter hold: no shrinking while rows are still arriving.

#### Prewarmed `claude -p` process
- **D-11:** Keep one prewarmed `claude -p` process ready.
  - Start it when the daemon starts, and start a fresh one right after each query uses the current one.
  - It is never stopped for being idle. The user accepts one Claude Code process staying in memory while the daemon runs.
  - The prompt goes over stdin (stream-json input or similar), not the command line, which closes T-08-02-07 (`ps` can no longer see the prompt).
- **D-12:** A prewarmed process is used only when it matches the query's cwd and a hash of its system prompt (steering plus installed tools). Otherwise:
  - kill it,
  - run this query cold, as today,
  - then prewarm again with the new cwd and prompt.

  The replacement is started in the last query's cwd, so repeated queries in one directory stay warm.

#### Cancellation and Esc
- **D-13:** The provider call is killed right away when the client goes away.
  - The client closes the IPC socket on Esc or on an early Enter.
  - The daemon listens for socket `close` and aborts through an `AbortSignal` threaded into the provider call:
    - SDK: `messages.create(..., { signal })`.
    - `claude -p`: SIGTERM, then SIGKILL as a backup after a short grace period.
  - A killed prewarmed process uses up that slot, so a new one is started (D-11).
- **D-14:** Candidates that arrived before Esc are thrown away. The buffer is unchanged and nothing is stored, which matches today's cancel rule and the no-local-memory privacy default.
- **D-15:** On Esc the client writes the cancel result, closes the socket and exits straight away, without waiting for the daemon to confirm. This fixes the deferred bug from quick 261011-jbh ("Esc during `thinking…` leaves the client running"; see that task's `deferred-items.md` #1).

### Claude's Discretion
- How the prewarmed process takes its prompt: stream-json input or plain stdin. Pick whichever Claude Code 2.1.285 supports with one prompt per process, and verify it with one live call.
- How the backstop kill and SIGKILL grace period are timed.
- How the incremental candidate parser pulls whole candidates out of a JSON array that is still streaming in. Option: change the output format the prompt asks for, for example one JSON object per line. That needs both adapters and the steering tests to stay consistent.
- How per-stage provider timing is logged in the debug log. The debug session's guard recommendation is a latency regression check; pick a shape that won't flake under load (bug-206).

### Deferred Ideas (OUT OF SCOPE)
- A Haiku-class model with thinking explicitly off (profile fix #5, about -1.4 s at some cost to quality). This would be its own phase, if wanted.
- Shorter candidate explanations (profile fix #6, estimated -0.4 to -0.7 s). This changes the product's output style.
- The SDK path's `.env.local` lookup depends on the directory the daemon happened to start in (`src/daemon/bootstrap.ts`, `src/shared/env-file.ts`). It's a real bug but outside this phase; it could be a quick task.
- Ink frame rows left behind after accept when the frame is taller than the inline reserve (quick 261011-jbh `deferred-items.md` #2).
</user_constraints>

<phase_requirements>
## Phase Requirements

No REQUIREMENTS.md IDs are mapped to this phase (null). The coverage target is CONTEXT.md D-01..D-15. SHL-03 ("User can dismiss QueQue with `Esc` and return to the shell with no buffer changes") is the closest existing requirement, and D-14/D-15 strengthen it.

| ID | Description | Research Support |
|----|-------------|------------------|
| D-01 | `--effort low` default, config override, invalid values fall back | Probe 6 (invalid values are only a stderr warning, so QueQue must validate); zod `.catch(undefined)` keeps the rest of config.json valid (Probe 9); Pattern 6 |
| D-02 | No `--model` | Model stays `claude-opus-5-5` in every probe's init event |
| D-03 | SDK maps the same effort | `output_config: { effort }` (SDK 0.92.0 `OutputConfig`, skill model table: Sonnet 5 takes low..max); Pattern 7 |
| D-04 | stream-json, line parser, `is_error` first, resolve on `result` | Probes 1-3 (`--verbose` required; event schema; the auth failure is `subtype:"success"` + `is_error:true`); Patterns 1-2 |
| D-05 | Per-candidate IPC + done signal + pong bump | Pattern 4 (opt-in `stream: true` request flag, `candidate` kind, `candidates` stays as done); zod strips unknown keys (Probe 9) |
| D-06 | Highlight never moves | CandidateSelect reset rule (lines 128-140) must key on the first arrival, not on array identity; Pattern 5 |
| D-07 | Early Enter returns the row and aborts | Shared client abort path; Pattern 3 |
| D-08 | Spinner row below the last candidate while streaming | New `complete` prop; Pattern 5 |
| D-09 | Filter applies to later rows | `filterCandidates` runs at render, so it is automatic; the zero-match clear rule needs a tweak (Pitfall 9) |
| D-10 | Zellij pane stays at the cap while rows arrive | Layout effect must not report while `complete === false`; the pane hold is keyed by array identity today (Pitfall 8) |
| D-11 | One prewarmed process, stdin prompt | Probes 4/5 (stream-json stdin works; plain text stdin fails after 3 s; 10-min idle OK; EOF retires it cleanly); Pattern 8 |
| D-12 | Match on cwd + system-prompt hash | Probe 7 (cwd reaches the request through Claude Code's environment block even under `--safe-mode`, but CLAUDE.md/AGENTS.md/hooks do not) |
| D-13 | Socket close → AbortSignal → SIGTERM + SIGKILL | Probe 8 (SIGTERM exit takes 0.45-0.58 s with code 143, not a signal); SDK abort semantics read from source; Unix socket close arrives in 1.6 ms |
| D-14 | Drop arrived rows on Esc | Client-only; no store; Pattern 3 |
| D-15 | Client exits straight away on Esc | Root cause: nothing calls `process.exit`, and the IPC socket + 26 s timer + a post-unmount `rerender` keep the loop alive; Pattern 3 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Stack is locked: TypeScript on Node LTS, `pnpm`, `tsup`, `vitest`, `zod`, `cac`, `ink`, `@anthropic-ai/sdk`. This phase needs **no new packages**.
- Safety: never execute commands. Results go back into the shell buffer only.
- UX: stay inside the terminal flow.
- Provider abstraction must stay. Claude is the only provider today.
- GSD workflow: edits go through `/gsd:execute-phase`.
- OpenWolf: check `.wolf/anatomy.md` before reading files and `.wolf/cerebrum.md` before generating code; log bugs to `.wolf/buglog.json`; update anatomy/memory after writes. The OpenWolf post-Edit hook rewrites anatomy lines and appends `auto-detected` buglog entries. Restore and drop those before committing (cerebrum 2026-10-11).
- Parallel wave plans must not commit `.wolf/` files (Phase 9 decision); the last plan in the phase applies them.
- Commit messages: commitlint subject-case means no leading acronym or review ID, and no `Co-Authored-By` trailers (user memory).
- Lint changed files with biome before staging (user memory).
- **Never stub the provider in smoke, integration or latency measurement** (user memory, cerebrum Do-Not-Repeat 2026-06-08). Unit tests of a parser may replay recorded NDJSON. The phase's latency check must use the real `claude`.
- UI offsets belong in named presentational constants (global CLAUDE.md), the way `INK_TRAILING_CURSOR_ROWS` is.
- Cerebrum rules that apply directly here:
  - Never pass sampling params (`temperature`, `top_p`, `top_k`) to the SDK.
  - Never feed a wrapper envelope into `parseCandidates`.
  - Never `--bare` (it skips Keychain/OAuth).
  - Mock `node:child_process` with an importOriginal spread in real-Ink tests.
  - New CandidateSelect `useState` calls go after the 4th (`prevCandidates`).
  - Targeted vitest runs use `pnpm exec vitest run tests/x.test.ts`.
  - A TDD RED commit needs throw-on-call stubs so `tsc --noEmit` passes.
  - Envelope or IPC SHAPE changes need a pong capability bump.

## Summary

Every lever in the profile holds up on Claude Code 2.1.285, and the probes this session add five facts the plans depend on.

1. `--output-format stream-json` **requires `--verbose`** in print mode. Without it the process exits 1 after ~1 s with `Error: When using --print, --output-format=stream-json requires --verbose`.
2. The auth failure arrives as a `result` event with **`subtype: "success"` and `is_error: true`**, `result: "Not logged in · Please run /login"`, exit code 1 and empty stderr. Code must branch on `is_error`, never on `subtype`.
3. Plain-text stdin **cannot** be used for prewarm. Claude Code waits 3 s for stdin, then exits 1 with `Input must be provided either through stdin or as a prompt argument`. `--input-format stream-json` works: idle → write one user line → close stdin. The prompt write to `init` takes 29-52 ms, against 844-1003 ms for a cold boot.
4. **SIGTERM does not stop `claude` at once.** It exits with **code 143 (signal `null`)** 0.45-0.58 s later, and stream events keep arriving in between. Closing an idle process's stdin makes it exit cleanly (code 0) in ~0.4 s.
5. With `--system-prompt` and `--safe-mode`, cwd still reaches the model through Claude Code's own `# Environment` block ("Primary working directory: …", "Is a git repository: …"). CLAUDE.md, AGENTS.md, project settings and hooks from the cwd do **not**. That justifies D-12's cwd match.

Measured with `--effort low` and the real QueQue prompt:

| Path | Prompt write (or spawn) → first complete candidate | → `result` | Runs |
|------|----------------------------------------------------|------------|------|
| Cold | 2.12-2.31 s | 3.11-3.28 s | 4 |
| Prewarmed | **1.32-1.40 s** | 2.09-2.39 s | 5 |

Adding the ~0.4 s client/IPC overhead puts the first candidate at **~1.8 s after the keypress** on the warm path, which meets the ~2 s target. After a 10-minute idle the warm path still worked, but time-to-headers rose to 1.52 s (n=1), probably because the pre-opened TLS connections went stale.

For the SDK path, effort maps to `output_config: { effort }`. SDK 0.92.0 types `effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | null`, and `claude-sonnet-5` supports all five levels, with adaptive thinking when `thinking` is omitted. Abort goes through the per-request `signal` option. Use `client.messages.stream(...)` with `.finalMessage()`: there an abort surfaces as `APIUserAbortError` ("Request was aborted."). A raw `messages.create({stream:true})` iterator ends silently on abort.

**Primary recommendation:** Build one streaming child runner that every `claude -p` call goes through, cold or prewarmed. It always uses `--input-format stream-json --output-format stream-json --verbose --include-partial-messages --effort <e>`, sends the prompt as one stdin line and then closes stdin, and settles on the validated `result` event. Track kills with QueQue's own `timedOut`/`aborted` flags; never read them from exit code or signal. On top of it, put an incremental JSON-array scanner (no prompt-format change), an opt-in streaming IPC (`stream: true` → `candidate` messages → final `candidates` as the done signal), and a one-slot prewarm pool keyed by `sha256(cwd + argv)`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Effort setting (config → argv / `output_config`) | Daemon (provider layer) | Shared config (`qq-config.ts`) | Provider calls run in the daemon; config is read there |
| stream-json parsing, `is_error` check, resolve on `result` | Daemon (provider layer) | — | Child process lives in the daemon |
| Incremental candidate extraction | Daemon (provider layer) | — | One scanner serves both adapters; IPC carries validated objects only |
| Per-candidate IPC + done signal | Daemon server ↔ client fetch-client | contracts (`ipc.ts`) | zod contract on both sides; capability flag in `bootstrap.ts` |
| Abort on client disconnect | Daemon server (socket `close`) | Provider layer (signal → kill / SDK abort) | Only the daemon can see the client is gone |
| Child SIGTERM → SIGKILL backstop | Provider layer (runner) | — | Owns the child pid |
| Prewarmed process pool | Daemon process (provider layer module) | Daemon command (start/shutdown hook) | Must outlive single requests; dies with the daemon |
| Growing list, stable highlight, spinner row, filter | Client UI (`CandidateSelect`) | Client (`run-foreground.ts`) | Presentation state |
| Esc/Enter → abort + immediate exit | Client (`run-foreground.ts`, CLI action) | fetch-client (socket destroy) | The client decides; the daemon only reacts to `close` |
| Zellij pane height while streaming | Client UI layout effect | `zellij-pane-resize.ts` queue (unchanged) | Hold logic lives where heights are reported (f9o decision) |

## Verified Claude Code 2.1.285 Behaviour (answers to research questions 1-3)

All probes ran `/usr/local/bin/claude` 2.1.285 (`2.1.285 (Claude Code)` [VERIFIED: `claude --version`]) with QueQue's real system prompt (1,194 chars + installed-tools steering) and user prompt (`show me how to use z3`, cwd tui-llm), load 3.7-6.3 on 12 CPUs. Scripts and raw JSONL are in the session scratchpad: `p91-raw.mjs`, `p91-cfg.mjs`, `p91-sum.mjs`, `p91/*.jsonl`.

### Probe 1: `--verbose` is required [VERIFIED: live probe]
Running `claude -p --output-format stream-json --safe-mode --tools '' --no-session-persistence --effort low --system-prompt … "say ok"` without `--verbose` gives this stderr, and the process exits 1 at 1,039 ms with no stdout:
```
Error: When using --print, --output-format=stream-json requires --verbose
```

### Probe 2: event/line schema (success) [VERIFIED: live probe, `p91/cold-partial-1.jsonl`]
Each stdout line is one JSON object. Order on a cold `--include-partial-messages --effort low` run:

| t (ms) | `type` / `subtype` | Notes |
|---|---|---|
| 921 | `system` / `init` | keys: `type subtype cwd session_id tools mcp_servers model permissionMode slash_commands terminal_slash_commands apiKeySource claude_code_version output_style agents skills plugins capabilities analytics_disabled product_feedback_disabled uuid messaging_socket_path fast_mode_state fast_mode_disabled_reason per_turn_effort_active view_mode`; `"model":"claude-opus-5-5"`, `"tools":[]`, `"apiKeySource":"none"` |
| 927 | `system` / `status` | `"status":"requesting"` |
| 2549 | `stream_event` `message_start` | `event.message.model`, `ttft_ms` on the line |
| 2549 | `stream_event` `content_block_start` | `{"type":"text","text":""}` (a `thinking` block would appear here at higher effort) |
| 2549-4326 | `stream_event` `content_block_delta` | `event.delta.type === "text_delta"`, `event.delta.text` = answer fragments, e.g. `"[{\"command\":"`, `"\"tldr z3\",\"expl"` |
| 4329 | `assistant` | full `message.content[0].text`; for errors it carries `"error":"authentication_failed"` |
| 4329-4342 | `stream_event` `content_block_stop`, `message_delta`, `message_stop` | |
| 4344 | `rate_limit_event` | ignore |
| 4355 | `result` / `success` | see below |
| 4879 | process exit 0 | result → exit 524 ms |

`result` keys [VERIFIED]: `duration_api_ms stop_reason session_id total_cost_usd usage modelUsage permission_denials terminal_reason fast_mode_state fast_mode_disabled_reason subagent_stats is_error num_turns subtype api_error_status result ttft_ms type duration_ms uuid ttft_stream_ms time_to_request_ms first_content_frame_ms queued_turn_count result_index`. Relevant values from this run:
```json
{"type":"result","subtype":"success","is_error":false,"duration_ms":3458,"duration_api_ms":3397,"num_turns":1,"stop_reason":"end_turn","terminal_reason":"completed","result":"[{\"command\":\"tldr z3\",\"explanation\":\"Show concise usage examples ...\"}, ...]"}
```
`usage.output_tokens_details.thinking_tokens` was `0` at `--effort low` in every run (14/14).

**Partial text before `result`: yes.** `--include-partial-messages` yields `text_delta` events. On the warm path the first complete candidate object closes at 1.32-1.40 s and `result` follows at 2.09-2.39 s.

### Probe 3: event/line schema (auth failure) [VERIFIED: live probe with an empty `CLAUDE_CONFIG_DIR`, `p91/noauth.jsonl`]
```json
{"type":"assistant","message":{"model":"<synthetic>", "content":[{"type":"text","text":"Not logged in · Please run /login"}], ...},"error":"authentication_failed","is_api_error_message":true}
{"type":"result","subtype":"success","is_error":true,"terminal_reason":"api_error","api_error_status":null,"result":"Not logged in · Please run /login","duration_api_ms":0, ...}
```
Exit code 1, signal null, stderr empty, init at 539 ms, result at 618 ms. **`subtype` is `"success"` even here.** Gate on `is_error`. `"Not logged in · Please run /login"` matches the existing `AUTH_FAILURE_RE` (quoted below), so passing the result text as the error's `stdout` keeps 08 D-13 intact.

### Probe 4: process exit after `result` [VERIFIED: live probes]
- Cold: result → exit 406-528 ms (n=4).
- Warm: 236-501 ms (n=5).
- After 10 minutes idle: 540 ms.

The profile's median was 0.44 s. Resolving on `result` saves that on every query.

### Probe 5: prewarm and stdin [VERIFIED: live probes]
| Variant | Result |
|---|---|
| `--input-format stream-json`, idle 4-8 s, write `{"type":"user","message":{"role":"user","content":<prompt>}}\n`, `stdin.end()` | Works 5/5. **No stdout line before the write.** write→init 29-48 ms, →message_start 945-1004 ms, →first candidate 1320-1397 ms, →result 2085-2386 ms, →exit 2452-2622 ms |
| Same, idle **600 s** | Works. init 52, message_start 1522, first candidate 1983, result 2964, exit 3504 ms (n=1) |
| Same, write immediately after spawn (cold path through stdin) | Works 2/2, same 1,004 input tokens as the argv path. init 954-1003, first candidate 2345-2819, result 3610-4250 ms (load 6.1-6.3) |
| Plain text stdin (no `--input-format`), idle 4 s | **Fails 4/4**: exit 1 at ~120-210 ms after the write; stderr `Warning: no stdin data received in 3s, proceeding without it. …` then `Error: Input must be provided either through stdin or as a prompt argument when using --print` |
| Idle, `stdin.end()` with no message | Clean exit code 0 in 418 ms; this is how a prewarm is retired, and what happens when the daemon dies |
| Idle process resources | RSS 186-196 MB, 0.0 % CPU at 5 min, 5-6 ESTABLISHED TCP sockets to `160.79.104.10:443` (= `api.anthropic.com` per `dig`), no child processes |

`--system-prompt` and `--effort` are argv, so they are fixed at spawn time. The user message arrives later over stdin. `--effort low` held on the warm path (thinking_tokens 0, 5/5). "No API call before the write" is evidenced by the absence of any `status: requesting` or stream event before the write and one `iterations[]` entry in `result.usage`. The pre-opened sockets are connection warm-up, not a billed request [ASSUMED for billing; there was no wire capture].

### Probe 6: `--effort` values [VERIFIED: `claude --help`, live probe]
Help text: `--effort <level>  Effort level for the current session (low, medium, high, xhigh, max)`. An invalid value does **not** fail. stderr says `Warning: Unknown --effort value 'bogus' — ignoring it and using the default effort. Valid values: low, medium, high, xhigh, max.` and the run continues at the account default (`xhigh` on this account, per the debug profile). `LOW` was accepted silently. **QueQue must validate and normalise (trim + lowercase) itself.**

### Probe 7: cwd under `--safe-mode --tools '' --no-session-persistence --system-prompt …` [VERIFIED: live probes, `p91/cwd-*.jsonl`]
The test dir held a `CLAUDE.md` (marker PINEAPPLE-CLAUDEMD), an `AGENTS.md` (MANGO-AGENTSMD) and a `.claude/settings.json` with `SessionStart` + `UserPromptSubmit` hooks that `touch` marker files.

| Run | Input tokens | Hooks ran | Markers in answer |
|---|---|---|---|
| `--safe-mode`, test dir | 513 | no | none |
| `--safe-mode`, empty dir | 513 | no | none |
| `--safe-mode`, repo | 463 | no | none |
| **no** `--safe-mode`, test dir (positive control) | 21,224 | yes (14 hook events, both marker files) | PINEAPPLE-CLAUDEMD |

Under `--safe-mode` the model still receives a Claude Code `<system-reminder>` (account email) and an `# Environment` block with `Primary working directory: <cwd>`, `Is a git repository: true|false`, platform, OS version, model name and today's date. The token difference is the cwd path length. **Bearing on D-12:** a process prewarmed in another cwd would tell the model a different working directory than QueQue's own user JSON (`"cwd": …`), so the cwd match is needed for consistent answers. The system-prompt hash covers the steering. Hashing the full argv also covers `--effort`.

### Probe 8: SIGTERM / kill timing [VERIFIED: live probes, `p91/sig-*.jsonl`]
| When SIGTERM was sent | SIGTERM → exit | Exit code / signal | Events after SIGTERM |
|---|---|---|---|
| Warm, 1,202 ms after write (mid-generation) | 491 ms | 143 / null | yes (a candidate closed at +1311) |
| Warm, 502 ms after write (before headers) | 548 ms | 143 / null | yes (`message_start` at +1020) |
| Cold, 1,506 ms after spawn | 583 ms | 143 / null | yes (`message_start`) |
| Idle prewarm | 455 ms | 143 / null | — |

Claude Code catches SIGTERM and exits with code 143. `child.on('exit', (code, signal))` reports `code=143, signal=null`, so today's `isTimeoutOrKilled` (which reads `signal === 'SIGTERM'` or `killed`) would see a plain non-zero exit and map it to the **auth** message (D13). The runner must set its own `timedOut` / `aborted` flags.

### Probe 9: supporting facts [VERIFIED: node probes in repo `node_modules`]
- zod 4.1.5: `discriminatedUnion` of `z.object(...)` **strips** unknown keys: `{kind:'fetch-candidates', envelope, stream:true}` parses with success and `stream` dropped. An old daemon therefore accepts a new client's `stream: true` request and answers with one `candidates` message.
- zod `.catch(undefined)` on an enum key keeps sibling keys: `{effort:'bogus', privacy:{x:1}}` → `{"privacy":{"x":1}}`.
- Unix socket: when the client calls `destroy()`, the server-side `'close'` fires 1.6 ms later.

## Standard Stack

### Core (all already installed; no additions)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:child_process` `spawn` | Node 24.14.1 (probe), daemon on Homebrew Node 26.3.0 | Streaming child with stdin pipe | Already used by `claude-exec.ts`; `execFile` ignores `stdio` (cerebrum) |
| `node:stream` `setEncoding('utf8')` / `node:string_decoder` | built-in | Multi-byte-safe chunk decoding | StringDecoder holds back incomplete UTF-8 sequences across chunks [CITED: nodejs.org/api/string_decoder.html] |
| `node:crypto` `createHash('sha256')` | built-in | D-12 prewarm key | No dependency |
| `zod` | 4.1.5 [VERIFIED: package.json:39] | Validate `result` event, each streamed candidate, IPC, config | Project contract layer |
| `@anthropic-ai/sdk` | 0.92.0 [VERIFIED: node_modules package.json] | `messages.stream`, `output_config.effort`, `signal` | Project provider SDK |
| `ink` | 7.0.1 | Growing list rerender | Project TUI |
| `vitest` | 4.0.4 | Tests | Project test runner |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Incremental array scanner | NDJSON-per-candidate prompt contract | Needs prompt changes in both adapters plus steering-test churn, risks format drift at `--effort low`, and buys nothing: the scanner found the first candidate in 14/14 runs. **Rejected.** |
| `readline.createInterface` | `setEncoding('utf8')` + carry buffer | Either works; the carry buffer is fewer moving parts and is what the probes used |
| `--json-schema` structured output (Claude Code flag) | — | Unverified with streaming partials; not needed |
| `messages.create({stream:true})` | `messages.stream()` | Raw iterator ends **silently** on abort (`core/streaming.js:91-94`); `.stream()` + `finalMessage()` raises `APIUserAbortError` |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed by this phase. Every capability uses Node built-ins or dependencies already pinned in `package.json` (`@anthropic-ai/sdk` 0.92.0, `zod` 4.1.5, `ink` 7.0.1, `vitest` 4.0.4).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none new) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## In-Repo Contracts the Plans Change (verbatim)

`src/contracts/ipc.ts:22-25` request (strip semantics, no `.strict()`) [VERIFIED: Read]:
```ts
  z.object({
    kind: z.literal('fetch-candidates'),
    envelope: contextEnvelopeSchema,
  }),
```
`src/contracts/ipc.ts:33-39, 48-58` responses [VERIFIED: Read]:
```ts
export const ipcResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('pong'),
    fetchCandidates: z.literal(true).optional(),
    // Daemon accepts envelopes carrying the `installed-tools` chunk (Phase 9).
    installedTools: z.literal(true).optional(),
  }),
...
  z.object({
    kind: z.literal('fetch-accepted'),
  }),
  z.object({
    kind: z.literal('candidates'),
    candidates: candidateListSchema,
  }),
  z.object({
    kind: z.literal('fetch-error'),
    message: z.string(),
  }),
```
`src/daemon/server.ts:72` pong: `writeJson({ kind: 'pong', fetchCandidates: true, installedTools: true });`. `src/daemon/server.ts:110-112` is the only socket handler besides `data`: `socket.on('error', () => { … });` (no `close`) [VERIFIED: Read].
`src/daemon/bootstrap.ts:96-97` [VERIFIED: Read]:
```ts
      const current =
        response.data.fetchCandidates === true && response.data.installedTools === true;
```
`src/contracts/candidates.ts:3-10` [VERIFIED: Read]:
```ts
export const commandCandidateSchema = z.object({
  command: z.string().trim().min(1),
  explanation: z.string(),
});
...
export const candidateListSchema = z.array(commandCandidateSchema).min(1).max(5);
```
`src/providers/claude-cli.ts:19-30` current argv [VERIFIED: Read]:
```ts
  const args = [
    '-p',
    '--output-format',
    'text',
    '--safe-mode',
    '--tools',
    '',
    '--no-session-persistence',
    '--system-prompt',
    buildSystemPrompt(envelope),
    prompt,
  ];
```
`src/providers/claude-default.ts:9, 11-12, 20-21, 50-55` [VERIFIED: Read]:
```ts
const TOTAL_BUDGET_MS = 25_000;
const AUTH_FAILURE_RE =
  /not logged in|login expired|please run \/login|failed to authenticate|oauth (token|session)/i;
const TIMEOUT_MESSAGE =
  'QueQue: Claude timed out. Run `claude /login`, or set ANTHROPIC_API_KEY in the environment or .env.local.';
function isTimeoutOrKilled(error: unknown): boolean {
  const killed = errorField(error, 'killed') === true;
  const signal = errorField(error, 'signal');
  const message = error instanceof Error ? error.message : String(error);
  return killed || signal === 'SIGTERM' || /timed out|ETIMEDOUT/i.test(message);
}
```
`src/providers/claude.ts:13` `export const DEFAULT_MODEL = 'claude-sonnet-5';`. Lines 72-76 are the prose fallback that D-04 guards:
```ts
  } catch {
    // Not JSON at all — treat entire text as a plain command (prose fallback)
    const trimmed = text.trim();
    return [{ command: trimmed || 'echo ""', explanation: '' }];
  }
```
Lines 176-186 are the SDK call: `client.messages.create({ model, max_tokens: 1024, system: buildSystemPrompt(envelope), messages: [{ role: 'user', content: prompt }] }, { timeout: timeoutMs })` [VERIFIED: Read].
`src/providers/provider.ts:4-6` [VERIFIED: Read]: `export interface LLMAdapter { fetchCandidates(envelope: ContextEnvelope): Promise<CandidateList>; }`
`src/daemon/fetch-client.ts:9-10` [VERIFIED: Read]: `export const FETCH_ACK_MS = 800;` / `const FETCH_TIMEOUT_MS = 26_000;`
`src/shared/qq-config.ts:50-53` [VERIFIED: Read]:
```ts
export const qqConfigFileSchema = z.object({
  privacy: privacyConfigSchema,
  safety: safetyConfigSchema,
});
```
On a parse failure, lines 118-124 drop the **whole file** (`console.warn(...)` then `return {};`), so a strict `effort` enum would also discard the user's privacy patterns.
`src/ui/CandidateSelect.tsx:128-140` is the reset that streaming must change, and 179-181 the hold key [VERIFIED: Read]:
```tsx
  if (candidates !== prevCandidates) {
    setPrevCandidates(candidates);
    if (selectedIndex !== 0) {
      setSelectedIndex(0);
    }
    if (installToggled.size > 0) {
      setInstallToggled(new Set());
    }
...
    const previousHeld = paneHold.current.candidates === candidates ? paneHold.current.lines : 0;
    const lines = heldPaneLines(previousHeld, layout);
    paneHold.current = { candidates, lines };
```
`src/client/zellij-pane-resize.ts:4` `const DEFAULT_MAX_PANE_HEIGHT = 24;` and `:30` `export const RESIZE_SETTLE_TIMEOUT_MS = 2000;`. `shell/zsh/queque.zsh:412` `local qq_pane_height="${QQ_PANE_HEIGHT:-24}"`, and `:434` launches `zellij run --floating --close-on-exit --width "$qq_pane_width" --height "$qq_pane_height"` [VERIFIED: Read/grep], so the pane already *opens* at the cap.
`tests/steering.test.ts:242` adapter-scan markers [VERIFIED: Read]: `const modelCalls = ['messages.create(', "'--system-prompt'", '/api/chat', 'chat/completions'];`. Any `src/providers/*.ts` file containing one of these strings must also contain `buildSystemPrompt(`.

SDK 0.92.0 [VERIFIED: Read `node_modules/@anthropic-ai/sdk`]:
- `resources/messages/messages.d.ts:708-718`:
  ```ts
  export interface OutputConfig { effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | null; format?: JSONOutputFormat | null; }
  ```
  `MessageCreateParams` has `output_config?: OutputConfig;` (line 1912).
- `internal/request-options.d.ts`: `signal?: AbortSignal | undefined | null;` ("An AbortSignal that can be used to cancel the request.").
- `core/error.js:70-74`: `APIUserAbortError` message `'Request was aborted.'`.
- `core/streaming.js:91-94`: `// If the user calls \`stream.controller.abort()\`, we should exit without throwing.` then `if ((0, errors_1.isAbortError)(e)) return;`.
- `lib/MessageStream.js:155-158`: `if (stream.controller.signal?.aborted) { throw new error_1.APIUserAbortError(); }`.

## Architecture Patterns

### System Architecture Diagram

```
 keypress ?? ──> zsh widget (instant frame) ──> qq client (Ink CandidateSelect, complete=false, spinner)
                                                   │  fetchCandidatesForUi(envelope, {signal, onCandidate})
                                                   ▼
                                    Unix socket  {kind:'fetch-candidates', envelope, stream:true}
                                                   │                       ▲  {kind:'fetch-accepted'}
                                                   ▼                       │  {kind:'candidate', candidate} xN  (as each parses)
 daemon server ── per-connection AbortController ──┤                       │  {kind:'candidates', candidates}  (= done, authoritative)
   socket 'close' ──> controller.abort()           │                       │  | {kind:'fetch-error', message}
                                                   ▼
                     claudeDefaultAdapter.fetchCandidates(envelope, {signal, onCandidate})
                         ├── API key? ──> SDK messages.stream({.., output_config:{effort}}, {signal, timeout})
                         │                   on('text') ──> CandidateScanner ──> onCandidate
                         └── no key ──> claude-cli: argv(effort, systemPrompt) + key=sha256(cwd+argv)
                                          │
                                prewarm pool: idle child with same key? ── yes ──> take it (warm)
                                          │ no: retire idle child (stdin.end), spawn cold
                                          ▼
                                stream-json runner: write 1 user line, stdin.end()
                                   stdout ─ utf8 line parser ─┬─ stream_event text_delta ──> CandidateScanner ──> onCandidate
                                                              └─ result (zod) ── is_error? ──> reject {stdout:result, stderr, code}
                                                                                └─ ok ──> parseCandidates(result.result) ──> resolve
                                   timers: budget (25 s) → kill + timedOut | post-result backstop | abort → SIGTERM → SIGKILL
                                          ▼
                                after settle: pool.prewarm(spec of this query)  (cwd + argv of the last query)
 client: Esc / early Enter ──> write result, controller.abort() (socket destroy), unmount, process.exit
```

### Recommended Project Structure
```
src/providers/
├── provider.ts            # LLMAdapter gains optional FetchOptions {signal?, onCandidate?}
├── stream-json.ts         # NEW: pure line parser + zod schema for the `result` event (no spawn)
├── claude-process.ts      # NEW: run one turn on a child (cold or prewarmed): write, parse, settle, timers, abort
├── claude-prewarm.ts      # NEW: one-slot pool keyed by sha256(cwd + argv); spawn/retire/take
├── candidate-stream.ts    # NEW: incremental JSON-array scanner → validated CommandCandidate per object
├── claude-cli.ts          # builds argv (keeps buildSystemPrompt(envelope) + '--system-prompt' here)
├── claude-default.ts      # budget, error mapping, abort pass-through
└── claude.ts              # SDK: messages.stream + output_config.effort + signal
src/shared/qq-config.ts    # + effort (lenient) and resolveEffort()
src/contracts/ipc.ts       # + stream flag, candidate kind, streamCandidates pong flag
src/daemon/server.ts       # + socket 'close' → abort; stream candidate messages
src/daemon/fetch-client.ts # + onCandidate, signal → destroy socket
src/daemon/bootstrap.ts    # + require streamCandidates
src/cli/commands/daemon.ts # + pool start at listen, retire on shutdown
src/client/run-foreground.ts / src/cli/main.ts  # abort + exit on Esc/Enter
src/ui/CandidateSelect.tsx # + complete prop, first-arrival reset, spinner row, no report while incomplete
```
Keep the literal `'--system-prompt'` **only** in `claude-cli.ts` (which calls `buildSystemPrompt(envelope)`); `claude-prewarm.ts` and `claude-process.ts` receive an opaque `argv: readonly string[]`. Otherwise `tests/steering.test.ts` "adapters (b)" fails.

### Pattern 1: line-buffered, UTF-8-safe stream-json parser
**What:** feed decoded strings; split on `\n`; keep the tail; `JSON.parse` each non-empty line; skip non-JSON lines; dispatch by `type`. Validate only the `result` event with zod.
**Example:**
```ts
// Source: probe-verified event shapes (Probe 2/3); Node StringDecoder via setEncoding
import { z } from 'zod';
export const streamJsonResultSchema = z.object({
  type: z.literal('result'),
  is_error: z.boolean(),
  result: z.string().optional(), // present on success and on is_error (auth text)
  subtype: z.string().optional(), // NOT a success signal: auth failure is subtype "success"
  duration_api_ms: z.number().optional(),
});
export function createLineParser(onLine: (event: unknown) => void) {
  let carry = '';
  return (chunk: string): void => {
    carry += chunk;
    let nl = carry.indexOf('\n');
    while (nl !== -1) {
      const line = carry.slice(0, nl).trim();
      carry = carry.slice(nl + 1);
      nl = carry.indexOf('\n');
      if (!line) continue;
      try { onLine(JSON.parse(line)); } catch { /* non-JSON line: ignore */ }
    }
  };
}
// child.stdout.setEncoding('utf8'); child.stdout.on('data', createLineParser(handle));
// text deltas: ev.type==='stream_event' && ev.event?.type==='content_block_delta'
//              && ev.event.delta?.type==='text_delta' → ev.event.delta.text
```
Cap the carry buffer and stderr (for example 1 MiB / 64 KiB) with running byte counts, not `Buffer.concat` per chunk (the specialist review's note; `claude-exec.ts` concatenates on every chunk today).

### Pattern 2: one turn on a child, settle on `result`
- Spawn (cold) or take (warm) a child with `stdio: ['pipe','pipe','pipe']`, then write `JSON.stringify({type:'user',message:{role:'user',content:prompt}}) + '\n'` and `stdin.end()` **straight away** (Probe 5: never leave stdin open on a turn; the old "stdin must be ignore" hang came from an open pipe that was never closed).
- `settled` guard; the first of these wins:
  - `result` with `is_error:false`: `resolve(parseCandidates(result.result))`, clear the budget timer, then arm the post-result backstop (`setTimeout(SIGTERM, 2000).unref()` followed by `SIGKILL` 1500 ms later, cleared on exit).
  - `result` with `is_error:true`: `reject(Object.assign(new Error('Command failed: claude'), {code: exitCodeOr1, killed:false, signal:null, stdout: result.result ?? '', stderr}))`. AUTH_FAILURE_RE then matches and the message is D13.
  - Budget timer fires: `timedOut = true`, SIGTERM, plus a SIGKILL backstop at 1500 ms, then `reject({killed:true, signal:'SIGTERM', code:null, stdout:'', stderr})` and the message is TIMEOUT_MESSAGE. Reject at kill time; don't wait for exit (exit takes ~0.5 s, Probe 8).
  - `signal` aborts: `aborted = true`, SIGTERM + SIGKILL backstop, `reject(new DOMException('aborted','AbortError'))` (or an error with `name === 'AbortError'`). The adapter re-throws it unmapped, and the daemon writes nothing.
  - `close` without a `result`: `reject({code, killed:false, signal, stdout:'', stderr})`, mapped as today (D13, or ENOENT on spawn `error`).
- After settling, ignore every later event (Probe 8: events keep arriving for ~0.5 s after SIGTERM).
- Grace timing: SIGTERM → SIGKILL after **1500 ms**, which is 2.6x the slowest measured SIGTERM exit (583 ms). Post-result backstop at **2000 ms**, about 4x the slowest measured result→exit (540 ms). Unref every timer.

### Pattern 3: client cancel and exit (D-07, D-13 client side, D-14, D-15)
Root cause of deferred #1 [VERIFIED: Read `run-foreground.ts:283-300, 344-367`, `main.ts:85-90`, `commands/client.ts:43-47`]:
- `onCancel` writes the result and unmounts, but nothing destroys the fetch socket or clears the 26 s timers.
- The `.then` still calls `app.rerender(...)` after `resolved`.
- Nothing calls `process.exit`, so the process stays alive while handles stay open. The deferred note saw it alive at 66-75 s, longer than the 26 s timer. So a post-unmount `rerender` probably re-engages the tty read stream [ASSUMED; not reproduced this session].

Fix:
1. Create `const fetchAbort = new AbortController()` in `run-foreground.ts` and pass `{signal: fetchAbort.signal, onCandidate}` to `fetchCandidatesForUi`.
2. `onCancel` / `onSelect`: `if (resolved) return; resolved = true; fetchAbort.abort();`, then write the result, then `unmount()`.
3. Guard every `.then` / `onCandidate` with `if (resolved) return`.
4. `fetch-client`: on `signal` abort, `client.destroy()`, clear both timers, and reject with an AbortError that the UI ignores.
5. In `src/cli/main.ts`'s `client` action, after `await clientCommand(...)`, call `process.exit(process.exitCode ?? 0)`. No test imports `clientCommand` or `main.ts` [VERIFIED: grep tests]. Keep `runForegroundClient` itself exit-free for `client-result.test.ts`.

In Zellij the result goes to a FIFO the widget blocks on (`read -r -t 30`), and the pane is `--close-on-exit`, so the exit also closes the pane straight away.

### Pattern 4: streaming IPC contract (D-05), compatible both ways
- Request: `fetch-candidates` gains `stream: z.literal(true).optional()`. Old daemons strip it (Probe 9) and answer with one `candidates` message.
- Responses, added:
  - `{ kind: 'candidate', candidate: commandCandidateSchema }`: one per validated object, in model order.
  - Keep `{ kind: 'candidates', candidates }` as the **done signal**, carrying the authoritative final list (after `parseCandidates` + `ensureSelectableCandidates`).
- Pong gains `streamCandidates: z.literal(true).optional()`. `server.ts` sends it, and `bootstrap.ts:96-97` requires all three flags. That way an old daemon gets replaced, which is the established pattern (cerebrum 2026-10-08).
- The daemon sends `candidate` messages only when the request asked (`stream === true`). An older installed client (the Homebrew widget runs a different build, cerebrum 2026-10-10) would otherwise fail its zod parse on the unknown kind and fall back to a cold in-process fetch.
- Client reconcile on `candidates`: if the final list starts with the streamed rows (compare by `candidateKey`), append the missing tail. Otherwise replace the list and clamp the selected index. Either way, mark `complete`.
- In-process fallback (`IpcTransportError`): call the adapter with the same `{signal, onCandidate}`.

### Pattern 5: CandidateSelect growing list (D-06, D-08, D-09, D-10)
- New prop `complete?: boolean`, default `true`, so today's callers and tests keep their behaviour.
- **Reset only on the first arrival:** `if (candidates !== prevCandidates) { setPrevCandidates(candidates); if (prevCandidates === null && candidates !== null) { /* reset selection + toggles + zero-match clear */ } }`. Appended rows keep `selectedIndex`. Index-based selection stays valid because rows are only appended and `filterCandidates` preserves order.
- Spinner: when `candidates !== null && !complete`, render `<Box marginTop={1}><LoadingSpinner /></Box>` after the rows (D-08).
- Zellij (D-10): in the layout effect, `return` early while `!complete`, as it already does while loading. The pane stays at the cap it opened with. On `complete`, report `heldPaneLines` once. Key `paneHold` on the list (one list per client process), not on array identity. Never reset it when the array grows.

### Pattern 6: effort config (D-01)
```ts
// qq-config.ts
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const; // = claude --help and SDK OutputConfig
export const DEFAULT_EFFORT = 'low';
const effortSchema = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.enum(EFFORT_LEVELS),
).optional().catch(undefined); // invalid → undefined, never fails the file
// add `effort: effortSchema` to qqConfigFileSchema; ResolvedQqConfig.effort = file.effort ?? DEFAULT_EFFORT
```
`loadQqConfig()` caches for the process lifetime, and the daemon is long-lived, so editing `effort` takes effect after a daemon restart. Document this. The prewarm key includes the argv, so a restarted daemon never reuses a process with the old effort.

### Pattern 7: SDK path (D-03, D-13)
```ts
// Source: SDK 0.92.0 types (OutputConfig, RequestOptions.signal); claude-api skill typescript/claude-api/streaming.md
const stream = client.messages.stream(
  {
    model,                       // DEFAULT_MODEL 'claude-sonnet-5' (or QQ_MODEL)
    max_tokens: 1024,
    system: buildSystemPrompt(envelope),
    messages: [{ role: 'user', content: prompt }],
    output_config: { effort },   // no `thinking` key: omitted = adaptive on Sonnet 5; no sampling params
  },
  { timeout: timeoutMs, signal },
);
stream.on('text', (delta) => scanner.push(delta));       // → onCandidate
const message = await stream.finalMessage();             // throws APIUserAbortError on abort
```
`claude-sonnet-5`: effort `low`/`medium`/`high`/`xhigh`/`max`, default `high`. Thinking is adaptive when omitted, and `{type:"disabled"}` is accepted [CITED: claude-api skill, Thinking & Effort table, Sonnet 5 row]. Keep `thinking` omitted. D-03 asks only for the effort mapping. Switching `claude.ts` from `messages.create(` to `messages.stream(` removes the string the steering guard looks for. Add `'messages.stream('` to the `modelCalls` markers in `tests/steering.test.ts:242` in the same change, so the guard still covers the SDK file.

### Pattern 8: prewarm pool (D-11, D-12)
- `key = sha256(JSON.stringify({cwd, argv}))`, where argv already contains `--effort` and `--system-prompt <steered prompt>`.
- `take(key)`: if an idle, alive child matches, mark it in use and return it. Otherwise retire the idle child (`stdin.end()` gives exit 0 in ~0.4 s; SIGKILL backstop at 1500 ms) and return `undefined`. The caller spawns cold.
- After **every** settle (success, error or abort), `prewarm({cwd, argv})` for the query just served. Do it after settle, not at take, so the ~0.9 s Claude Code boot doesn't compete with the streaming turn.
- Daemon start (D-11): prewarm with `cwd = os.homedir()` and `buildSystemPrompt` of an envelope with no `installed-tools` chunk (= `QUEQUE_SYSTEM`). Expect the first steered query to miss (see Open Question 1).
- If the idle child exits unexpectedly, clear the slot and **don't** respawn in a loop. The next query runs cold and then prewarms.
- If the idle child prints anything before the write, ignore it (none was observed).
- Daemon shutdown (`daemon.ts` SIGTERM/SIGINT handler): retire the child. If the daemon is SIGKILLed, the stdin pipe closes and the child exits by itself (Probe 5, EOF → exit 0).
- Concurrency: the pool has one slot. A second simultaneous `??` (another terminal) runs cold.

### Anti-Patterns to Avoid
- **Branching on `result.subtype === 'success'`:** the auth failure has that subtype (Probe 3).
- **Reading kill/timeout state from `code`/`signal`:** `claude` exits 143 with a null signal (Probe 8).
- **Prompt on argv for the cold path:** use stdin for every query, so T-08-02-07 closes for cold queries too (Probe 5, cold-through-stdin works).
- **Plain-text stdin prewarm:** it fails after 3 s (Probe 5).
- **Resetting selection / hold on every new candidates array:** this breaks D-06 and D-10.
- **`messages.create({stream:true})` + `for await`:** it ends silently on abort and the code then mis-reads a partial answer as a full one.
- **Feeding raw NDJSON, or an `is_error` result, into `parseCandidates`:** the prose fallback turns it into a command.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UTF-8 across chunk boundaries | manual byte stitching | `stream.setEncoding('utf8')` (StringDecoder) | Handles 2-4 byte sequences split anywhere |
| SDK cancellation | a racing `Promise` with a timeout | `RequestOptions.signal` + `messages.stream().finalMessage()` | Typed `APIUserAbortError`; also aborts retries (`client.js:241-250`) |
| SSE text accumulation (SDK) | parse `content_block_delta` by hand | `stream.on('text', delta => …)` | SDK helper [CITED: skill streaming.md] |
| Candidate validation | ad-hoc field checks | `commandCandidateSchema.safeParse` per object; `candidateListSchema` for the final list | Same contract the IPC and UI already trust |
| Daemon capability negotiation | version strings / build hash | pong boolean flag (`streamCandidates`) | Established; build-hash option was rejected in Phase 9 |

**Key insight:** the risky parts are lifecycle and error mapping, not parsing. Claude Code's own signal handling, `subtype`, and exit-after-result behaviour all differ from what a generic child wrapper assumes.

## Common Pitfalls

### Pitfall 1: auth failure turns into a command
**What goes wrong:** "Not logged in · Please run /login" lands in the shell buffer.
**Why:** the `result` event's `subtype` is `"success"`; the prose fallback in `parseCandidates` accepts any text.
**How to avoid:** check `is_error` first; on `true`, reject with `stdout: result.result`; never call `parseCandidates` on it. Also never feed it into the candidate scanner. The scanner only reads `text_delta` events, and auth errors arrive only as an `assistant` message (no stream events), so this holds naturally.
**Warning signs:** a test with the recorded Probe-3 lines yields candidates.

### Pitfall 2: SIGTERM'd child maps to the auth message
**Why:** exit code 143 with a null signal; `isTimeoutOrKilled` reads `killed`/`signal`.
**How to avoid:** the runner sets `killed:true, signal:'SIGTERM'` on its own timeout error, and rejects at kill time with QueQue's flags.

### Pitfall 3: events after abort or after settle
**Why:** Claude Code keeps streaming ~0.5 s after SIGTERM.
**How to avoid:** a `settled` guard in the runner; the daemon's `writeJson` already no-ops on a destroyed socket (`server.ts:31-36`), but `onCandidate` must also check `signal.aborted`.

### Pitfall 4: invalid `effort` silently means `xhigh`
**Why:** Claude Code only warns on stderr. A strict zod enum in `qqConfigFileSchema` would also wipe the privacy patterns (`qq-config.ts:118-124`).
**How to avoid:** Pattern 6 (normalise + `.catch(undefined)` + default `low`).

### Pitfall 5: `QQ_MODEL` pointing at a model without effort support
**What goes wrong:** the SDK request 400s. The skill table says effort "errors on Sonnet 4.5 / Haiku 4.5".
**How to avoid:** document that `QQ_MODEL` must support effort, or omit `output_config` when `QQ_MODEL` is set to a `haiku-4-5` / pre-4.6 id. Tests only; flag to the user [CITED: claude-api skill].

### Pitfall 6: steering-guard test fails on new provider files
**Why:** `tests/steering.test.ts:242` scans every `src/providers/*.ts` for `'--system-prompt'` / `messages.create(`.
**How to avoid:** keep argv building in `claude-cli.ts`; extend the marker list with `'messages.stream('` when `claude.ts` switches.

### Pitfall 7: old client meets a new daemon
**Why:** the brew-installed widget/client can be a different build than the dev daemon (cerebrum 2026-10-10). An unknown `candidate` kind fails the old client's zod parse → `IpcTransportError` → cold in-process fetch (slow, and the daemon's call gets aborted).
**How to avoid:** stream only when the request carries `stream: true` (Pattern 4).

### Pitfall 8: the Zellij pane shrinks mid-stream (D-10, f9o, WR-06/WR-07)
**Why:** `paneHold` is keyed by array identity (`CandidateSelect.tsx:179`), and every streamed arrival is a new array, so the hold resets and `heldPaneLines` can report a smaller height. Each report may spawn a `zellij action` through the serialized queue.
**How to avoid:** don't report while `!complete`; report once on completion. That gives at most one resize per `??` (same as today) plus filter-driven growth. The fewer resizes, the less exposure to the open WR-06 (timeout path starts the next action before the killed one exits) and WR-07 (a failed action still counts as applied). This phase neither fixes nor worsens them, so leave them open unless the planner chooses to bundle a fix.
**Warning signs:** a real-hooks layout test sees `onLayoutLinesChange` calls before `complete`.

### Pitfall 9: lbuffer pre-filter and later rows (D-09)
**Why:** today the zero-match clear (`CandidateSelect.tsx:137-139`) runs once against the full list. When the first row arrives, the lbuffer (e.g. `show me how to use z3`) usually matches nothing, so the query clears and later rows show unfiltered. That is today's net behaviour.
**How to avoid:** run the zero-match clear on each arrival only while `query === (initialQuery ?? '')` (the user hasn't typed); once the user types, the typed filter applies to later rows (D-09).

### Pitfall 10: inline frame grows past the reserve while streaming
**Why:** the spinner row (2 lines incl. margin) under up to 3 wrapped candidates can exceed `MODAL_VIEWPORT_LINES` = 18, which is the known deferred #2 residue.
**How to avoid:** add a layout-test assertion that a 3-candidate + spinner frame fits within the reserve at 80 columns; if not, render the spinner on the controls line instead. Don't fix deferred #2 itself (out of scope).

### Pitfall 11: prewarm first-query miss and memory
**Why:** the daemon starts before any envelope exists (cwd `/` or `$HOME`, no installed-tools steering), so the D-11 start-time prewarm mismatches the first steered query. One idle process costs ~190 MB RSS (Probe 5).
**How to avoid:** accept it (locked by D-11/D-12); log `prewarm: miss (cwd|prompt)` so it's visible in the debug log.

### Pitfall 12: timing assertions flake (bug-206)
**How to avoid:** no wall-clock thresholds in vitest. Assert the **order** and presence of debug-log stages. Measure latency with a scratchpad script against the real `claude`, the way the profile did.

## Code Examples

### Incremental candidate scanner (Discretion: pull whole objects out of a streaming array)
```ts
// Source: same state machine as the probe scanner that found candidate 1 in 14/14 runs (p91-sum.mjs)
import { type CommandCandidate, commandCandidateSchema } from '../contracts/candidates.js';
export function createCandidateScanner(onCandidate: (c: CommandCandidate) => void) {
  let depth = 0, inStr = false, esc = false, start = -1, buf = '', emitted = 0;
  return (text: string): void => {
    for (const ch of text) {
      buf += ch;
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '[' || ch === '{') { depth++; if (ch === '{' && depth === 2) start = buf.length - 1; }
      else if (ch === ']' || ch === '}') {
        if (ch === '}' && depth === 2 && start >= 0 && emitted < 5) {
          try {
            const parsed = commandCandidateSchema.safeParse(JSON.parse(buf.slice(start)));
            if (parsed.success) { emitted++; onCandidate(parsed.data); }
          } catch { /* malformed object: skip; the final parse decides */ }
          start = -1;
        }
        depth--;
      }
    }
  };
}
```
Text before the first `[` (e.g. a code fence) leaves `depth` at 0 and is ignored. Trim `buf` after each emit if memory matters (answers are ~1 KB). The final authoritative list still comes from `parseCandidates(result.result)`.

### Daemon: abort on client disconnect
```ts
// server.ts, inside net.createServer((socket) => { … })
const connectionAbort = new AbortController();
socket.on('close', () => connectionAbort.abort()); // fires ~1.6 ms after client destroy (Probe 9)
// case 'fetch-candidates':
const onCandidate = req.stream === true
  ? (candidate: CommandCandidate) => { if (!connectionAbort.signal.aborted) writeJson({ kind: 'candidate', candidate }); }
  : undefined;
void Promise.resolve()                       // keep resolution throws inside the chain (cerebrum)
  .then(() => adapter.fetchCandidates(req.envelope, { signal: connectionAbort.signal, onCandidate }))
  .then((candidates) => writeJson({ kind: 'candidates', candidates }))
  .catch((error) => {
    if (connectionAbort.signal.aborted) { void appendDebugLog('daemon', 'fetch aborted'); return; }
    writeJson({ kind: 'fetch-error', message: error instanceof Error ? error.message : String(error) });
  });
```

### Per-stage debug logging (Discretion)
Log one line per stage from the provider with `msSinceFetchStart`. Stages: `prewarm hit|miss(reason)`, `spawned`, `init`, `first candidate`, `result`, `exit`, `aborted|timed out`, plus `effort` and `warm: boolean`. Log no prompt text (redaction rules in `qq-config.ts`). Tests assert stage order only.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `--output-format text`, wait for exit | `stream-json` + `--verbose` + resolve on `result` | this phase | -0.44 s per query; partial text available |
| Prompt as last argv | stream-json user line on stdin | this phase | closes T-08-02-07; enables prewarm |
| `thinking: {type:"enabled", budget_tokens}` | `output_config.effort` (+ adaptive thinking by omission) | Claude 4.6+ models | effort is the control; never send `budget_tokens` to Sonnet 5 (400) [CITED: claude-api skill] |
| No cancellation | `AbortSignal` from socket close to child kill / SDK abort | this phase | Esc stops billing and frees the daemon |

**Deprecated/outdated:** the cerebrum line "`claude -p` flags for QueQue: Use `--safe-mode --tools "" --no-session-persistence --output-format text` and argv prompt … Stdin must be `ignore`" is superseded by this phase. Update cerebrum after execution.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No billed API request happens while a prewarmed process is idle (only connection warm-up) | Probe 5 | Idle cost per prewarm; low (no events, single `iterations[]` entry) |
| A2 | The 26 s socket timer + post-unmount `rerender` are what keep the client alive after Esc (deferred #1) | Pattern 3 | If another handle holds it, the explicit `process.exit` in the CLI action still fixes D-15 |
| A3 | Claude Code refreshes OAuth tokens and reconnects after laptop sleep for a long-idle prewarm (only 10 min was tested) | Pattern 8 | A stale prewarm could fail its turn; mitigated by mapping errors as today and re-prewarming after settle. Consider a cold retry on a warm-path non-auth failure |
| A4 | `claude-sonnet-5` accepts `output_config.effort: 'low'` (skill table, not a live call) | Pattern 7 | SDK users would get a 400; covered only by tests (D-03 accepts this) |
| A5 | The warm path's higher time-to-headers after 10 min idle (1.52 s vs ~0.97 s) is stale pooled connections (n=1) | Summary | Long-idle warm gain shrinks from ~0.9 s to ~0.4 s; still positive |
| A6 | Claude Code's `# Environment` block (cwd, date) is computed at boot, so a prewarmed process carries its spawn-time cwd | Probe 7 / D-12 | If computed at write time, cwd matching would be over-cautious, which is harmless |

## Open Questions

1. **The daemon-start prewarm (D-11) almost always misses the first query.**
   - What we know: the daemon has no envelope at start. The cwd is `/` or wherever the first shell was, and there is no installed-tools steering. So the key mismatches the first steered query, costing a ~0.9 s boot and ~190 MB for nothing.
   - Recommendation: implement as locked, with `cwd = os.homedir()` and the unsteered system prompt, and log the miss reason. Ask the user whether to drop the start-time prewarm if the debug log shows it never hits.
2. **The provider fails after some rows have already arrived** (timeout, or a mid-stream server error).
   - What's unclear: whether to keep showing the arrived rows (mark the list `complete`, log the error) or switch to the error view as today.
   - Recommendation: keep the arrived rows, because they are valid validated commands. Show the error view only when zero rows arrived. Confirm with the user at plan check.
3. **A warm-path failure that is not an auth error** (the prewarm went stale).
   - Recommendation: one cold retry inside the remaining budget, only when the warm child died before emitting `init`, or exited without a `result`. Otherwise map as today.
4. **D-10: shrink once at completion, or stay at the cap?**
   - What we know: f9o's user quote prefers not shrinking. D-10 only forbids resizes *while rows arrive*.
   - Recommendation: one report at completion (today's single resize). Never shrink below that for the rest of the list (f9o hold).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Claude Code CLI | `claude -p` path, live measurement | ✓ `/usr/local/bin/claude` (daemon PATH) | 2.1.285 | none needed. Note: the interactive tool shell resolves `claude` to a cmux shim first; probes must call `/usr/local/bin/claude` |
| Claude `/login` auth | live calls | ✓ (OAuth, `apiKeySource: none`) | — | — |
| ANTHROPIC_API_KEY | SDK path live test | ✗ | — | tests only (D-03 accepts this) |
| Node | runtime | ✓ | 24.14.1 (shell), daemon on Homebrew 26.3.0 | — |
| pnpm | scripts | ✓ | 12.6.0 | — |
| zellij / tmux | D-10 live UAT | per cerebrum recipes (not re-probed) | — | real-hooks layout tests |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** API key (SDK path is test-only).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.4 |
| Config file | `vitest.config.*` at repo root (existing) |
| Quick run command | `pnpm exec vitest run tests/<file>.test.ts` (filters and fails on "No test files found"; never `pnpm test:run -- <file>`) |
| Full suite command | `pnpm test:run && pnpm typecheck && pnpm lint` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | `effort` default `low`; valid override; `LOW`/` high ` normalised; `bogus` → `low` with privacy patterns kept | unit | `pnpm exec vitest run tests/qq-config.test.ts` | ✅ extend |
| D-01/D-02/D-11 | argv has `--input-format stream-json --output-format stream-json --verbose --include-partial-messages --effort low`, no `--model`, no prompt on argv; prompt arrives as one stdin line then EOF | unit | `pnpm exec vitest run tests/claude-cli-provider.test.ts` | ✅ rewrite seam (today mocks `execFileAsync`) |
| D-03 | SDK request has `output_config: {effort}`, no `thinking`/sampling keys; `signal` passed; abort → AbortError not mapped | unit | `pnpm exec vitest run tests/claude-provider.test.ts` | ✅ update (mock `messages.stream`) |
| D-04 | line parser: split lines, split multi-byte (`ⓘ` U+24D8 split mid-sequence), non-JSON skipped, `is_error` + `subtype:"success"` rejects with auth text, resolves before exit | unit | `pnpm exec vitest run tests/claude-stream-json.test.ts` | ❌ Wave 0 |
| D-04/D-13 | real child (node fixture replaying recorded NDJSON from this research): resolve on `result`, backstop kill, budget timeout → TIMEOUT_MESSAGE, exit 143 handling, abort → SIGTERM then SIGKILL | unit (real child process, not the provider) | `pnpm exec vitest run tests/claude-process.test.ts` | ❌ Wave 0 (+ `tests/fixtures/fake-claude-stream.mjs`) |
| D-05 | scanner emits each object at every split point of a recorded answer; brackets/quotes inside strings; code-fence prefix; invalid object skipped; ≤5 | unit | `pnpm exec vitest run tests/candidate-stream.test.ts` | ❌ Wave 0 |
| D-05 | daemon streams `candidate` xN then `candidates`; no `candidate` without `stream:true`; pong carries `streamCandidates` | integration (real socket, mocked adapter) | `pnpm exec vitest run tests/daemon-fetch.test.ts` | ✅ extend |
| D-05 | pong lacking `streamCandidates` → replaced | unit | `pnpm exec vitest run tests/daemon-bootstrap.test.ts` | ✅ extend |
| D-13 | client socket close → adapter `signal.aborted === true`; no `fetch-error` written | integration | `pnpm exec vitest run tests/daemon-fetch.test.ts` | ✅ extend |
| D-06/D-08/D-09/D-10 | growing list keeps highlight; spinner row while incomplete; filter hides non-matching later rows; no `onLayoutLinesChange` before `complete`; exactly one after | real-hooks UI | `pnpm exec vitest run tests/candidate-select-layout.test.tsx` | ✅ extend |
| D-06 | mocked suite still passes with the `complete` prop | unit | `pnpm exec vitest run tests/candidate-select.test.tsx` | ✅ update if needed |
| D-07/D-14/D-15 | Esc during loading: cancel result written, fetch signal aborted, no rerender after resolve; early Enter returns that row and aborts | unit | `pnpm exec vitest run tests/client-result.test.ts` | ✅ extend (keep its narrow `node:fs` mock in mind) |
| D-11/D-12 | key match → warm take; cwd or prompt mismatch → retire + cold + re-prewarm; abort uses up the slot; unexpected idle exit → cold next time | unit (fake spawn) | `pnpm exec vitest run tests/claude-prewarm.test.ts` | ❌ Wave 0 |
| D-18 guard | adapter scan still green with new provider files | unit | `pnpm exec vitest run tests/steering.test.ts` | ✅ (add `'messages.stream('` marker) |
| Latency (all levers) | real `claude` e2e, first candidate ~2 s, Esc kills the child (`ps` shows no `claude` child of the daemon within ~2 s) | manual/scratch, real provider, never stubbed | scratchpad tmux script (cerebrum inline-capture recipe) | manual-only (real network + timing) |

### Sampling Rate
- **Per task commit:** the task's `pnpm exec vitest run tests/<file>` + `pnpm typecheck`
- **Per wave merge:** `pnpm test:run && pnpm typecheck && pnpm lint`
- **Phase gate:** full suite green, plus one real-provider latency/cancel run on an idle machine (check `uptime`; bug-206) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/claude-stream-json.test.ts`: parser (D-04)
- [ ] `tests/claude-process.test.ts` + `tests/fixtures/fake-claude-stream.mjs`: replays recorded success/auth-failure NDJSON with delays, honours SIGTERM by exiting 143 after a delay (models Probe 8)
- [ ] `tests/candidate-stream.test.ts`: scanner (D-05)
- [ ] `tests/claude-prewarm.test.ts`: pool (D-11/D-12)
- [ ] Throw-on-call stubs for each new module so RED commits pass `tsc --noEmit` (cerebrum 2026-08-26)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (Claude Code / SDK own auth) | keep D13 copy on auth failure |
| V3 Session Management | no (`--no-session-persistence`) | — |
| V4 Access Control | partial | daemon socket is unauthenticated (pre-existing TODO CR-005); prewarm adds no new surface |
| V5 Input Validation | yes | zod on the `result` event, every streamed candidate (`commandCandidateSchema`), IPC (`ipcRequestSchema`/`ipcResponseSchema`), config (`effort` enum) |
| V6 Cryptography | no | `sha256` used only as a cache key |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt (filtered context) visible in `ps` (T-08-02-07) | Information disclosure | Prompt over stdin for cold and warm queries. **Closed** by this phase. The system prompt (catalog tool names) stays on argv, so IN-04 remains open |
| Error/prose text placed into the shell buffer | Tampering | `is_error` gate; scanner reads only `text_delta`; final list via `candidateListSchema` |
| Orphaned `claude` processes billing after Esc | DoS / cost | Socket close → abort → SIGTERM + SIGKILL backstop; prewarm retired on shutdown; EOF retire on daemon death |
| Resource use of a permanent prewarm (~190 MB) | DoS | Single slot; accepted by user (D-11) |
| Killing the wrong process | Tampering | Only `child.kill()` on handles this daemon spawned; never `process.kill(pid)` by lookup |

## Sources

### Primary (HIGH confidence)
- Live probes against `/usr/local/bin/claude` 2.1.285, this session: Probes 1-8. Raw dumps in scratchpad `p91/*.jsonl`, scripts `p91-raw.mjs`, `p91-cfg.mjs`, `p91-sum.mjs`.
- `claude --help` (2.1.285): `--effort`, `--input-format`, `--output-format`, `--include-partial-messages`, `--safe-mode`, `--replay-user-messages`.
- `node_modules/@anthropic-ai/sdk` 0.92.0: `resources/messages/messages.d.ts:708-718, 977-1023, 1912`; `internal/request-options.d.ts` (`signal`); `core/error.js:70-74`; `core/streaming.js:91-94`; `lib/MessageStream.js:136-158`; `client.js:236-250, 336-351`.
- Repo source read this session: `src/providers/{claude,claude-cli,claude-default,claude-exec,provider,steering,resolver}.ts`, `src/contracts/{ipc,candidates}.ts`, `src/daemon/{server,fetch-client,bootstrap}.ts`, `src/client/{run-foreground,zellij-pane-resize}.ts`, `src/ui/{CandidateSelect,LoadingSpinner}.tsx`, `src/ui/modal-layout.ts` (excerpts), `src/shared/qq-config.ts`, `src/cli/{main,commands/daemon,commands/client}.ts`, `tests/steering.test.ts`, `tests/daemon-fetch.test.ts` (setup).
- `.planning/debug/llm-response-latency-profile.md` (measurement baseline), `.wolf/cerebrum.md`.

### Secondary (MEDIUM confidence)
- claude-api skill (bundled with Claude Code 2.1.285, model table cached 2026-09-25): Thinking & Effort table (Sonnet 5 row), `typescript/claude-api/streaming.md`, `shared/models.md`.
- Node docs on StringDecoder/`setEncoding` (multi-byte safety). Not re-fetched; standard documented behaviour.

### Tertiary (LOW confidence)
- Billing and connection-staleness interpretations (A1, A5); deferred #1 root cause (A2).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new deps; versions read from the repo.
- Claude Code behaviour: HIGH. Directly probed, with recorded outputs.
- Architecture: HIGH for contracts and lifecycle; MEDIUM for UI details (to prove in real-hooks tests).
- SDK path: MEDIUM. Types and source verified; no live call possible.
- Pitfalls: HIGH. Most were reproduced in probes.

**Research date:** 2026-10-11
**Valid until:** 2026-10-25 (Claude Code updates often; re-run Probes 1-3 and 8 if `claude --version` changes)


### Plans to Review

#### .planning/phases/09.1-provider-latency-and-cancellation/09.1-01-PLAN.md
---
phase: 09.1-provider-latency-and-cancellation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/providers/provider.ts
  - src/providers/stream-json.ts
  - src/providers/claude-process.ts
  - src/providers/claude-cli.ts
  - src/providers/claude-default.ts
  - src/daemon/server.ts
  - src/daemon/fetch-client.ts
  - src/client/run-foreground.ts
  - src/cli/main.ts
  - tests/fixtures/fake-claude-stream.mjs
  - tests/claude-process.test.ts
  - tests/claude-cli-provider.test.ts
  - tests/daemon-fetch.test.ts
  - tests/client-result.test.ts
  - .wolf/anatomy.md
  - .wolf/cerebrum.md
  - .wolf/memory.md
  - .wolf/buglog.json
autonomous: true
requirements: [D-04, D-07, D-11, D-13, D-14, D-15]

estimate:
  tokens: 85000
  raw_tokens: 85000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "D-13/D-15: pressing Esc while `thinking…` is shown writes the cancel result, destroys the IPC socket and lets `qq client` exit at once, without waiting for the daemon; the daemon sees the socket `close` and aborts the provider call through an AbortSignal"
    - "D-13: an aborted `claude -p` turn gets SIGTERM at once and SIGKILL after SIGKILL_GRACE_MS (1500 ms) if it has not exited; the abort rejects with an AbortError that claudeDefaultAdapter re-throws unmapped, and the daemon writes no `fetch-error` for it"
    - "D-07 (abort half): Enter on a candidate writes the replace-buffer result and fires the same abort as Esc"
    - "D-14: after Esc or Enter nothing the provider still produces is shown or kept: no rerender after the result is written, nothing stored"
    - "D-04: `claude -p` runs with `--input-format stream-json --output-format stream-json --verbose --include-partial-messages` plus the existing `--safe-mode --tools '' --no-session-persistence --system-prompt`; no model flag (D-02) and no bare mode are passed"
    - "D-04: the turn resolves on the validated `result` event, before the child process exits; the child is left to exit on its own (plan 06 adds the post-result backstop kill)"
    - "D-04: a `result` event with `is_error: true` (including the auth failure whose subtype is \"success\") never reaches parseCandidates; it rejects with the result text as `stdout`, so the 08 D-13 not-authenticated copy is shown and no command candidate is ever produced from it"
    - "D-04: a turn that runs past the 25 s budget rejects with `killed: true` and `signal: 'SIGTERM'` at kill time and maps to TIMEOUT_MESSAGE, even though claude itself exits with code 143 and a null signal"
    - "D-11 (stdin rule) / T-08-02-07: the prompt reaches claude as exactly one stream-json user line on stdin, then stdin is closed; the prompt text is never in argv, so `ps` cannot show it"
    - "D-04: the debug log shows each `claude -p` turn's stages in order (`cli spawned`, `cli init`, `cli first delta`, `cli result`, `cli exit`, or `cli aborted` / `cli timed out`) with the elapsed ms, and never the prompt, argv, stdout or stderr"
  artifacts:
    - path: "src/providers/stream-json.ts"
      provides: "line-buffered stream-json parser, result-event zod schema, text-delta and init helpers, stream-json user line builder"
      contains: "streamJsonResultSchema"
    - path: "src/providers/claude-process.ts"
      provides: "one claude -p turn on a child: stdin prompt, settle on result, budget timeout, abort with SIGTERM then SIGKILL"
      contains: "runClaudeTurn"
    - path: "tests/fixtures/fake-claude-stream.mjs"
      provides: "real child process replaying the recorded Claude Code 2.1.285 stream-json event shapes (success, auth failure, SIGTERM exit 143)"
      contains: "is_error"
    - path: "tests/claude-process.test.ts"
      provides: "runner tests against real child processes"
      contains: "runClaudeTurn"
  key_links:
    - from: "src/client/run-foreground.ts"
      to: "src/daemon/fetch-client.ts"
      via: "fetchCandidatesForUi(socketPath, envelope, { signal: fetchAbort.signal }); onCancel and onSelect call fetchAbort.abort()"
      pattern: "fetchAbort\\.abort\\(\\)"
    - from: "src/daemon/fetch-client.ts"
      to: "src/daemon/server.ts"
      via: "abort destroys the client socket; the server's socket 'close' handler aborts the per-connection AbortController"
      pattern: "on\\('close'"
    - from: "src/daemon/server.ts"
      to: "src/providers/claude-default.ts"
      via: "adapter.fetchCandidates(req.envelope, { signal: connectionAbort.signal })"
      pattern: "signal: connectionAbort\\.signal"
    - from: "src/providers/claude-cli.ts"
      to: "src/providers/claude-process.ts"
      via: "runClaudeTurn({ command, argv, cwd, prompt, budgetMs, signal })"
      pattern: "runClaudeTurn\\("
    - from: "src/providers/claude-process.ts"
      to: "src/providers/stream-json.ts"
      via: "child.stdout (utf8) feeds createLineParser; result events validated by streamJsonResultSchema"
      pattern: "createLineParser\\("
---

<objective>
Tracer for Phase 09.1: make Esc during `thinking…` actually stop the model call, end to end, and move `claude -p` onto stream-json so a turn resolves on the `result` event instead of process exit.

One path, through every layer this phase changes: the client's Esc (or Enter) aborts the fetch, the fetch destroys the IPC socket, the daemon's socket `close` aborts an AbortController threaded into the adapter, and the new stream-json runner kills the `claude -p` child with SIGTERM then SIGKILL. The same runner sends the prompt as one stream-json user line on stdin (the prompt leaves argv, closing T-08-02-07) and resolves on the validated `result` event, with the `is_error` gate in front of parseCandidates.

Purpose: D-13, D-14, D-15 (and the abort half of D-07) make cancellation real, which the user asked for directly. D-04 removes the ~0.44 s wait for process exit on every query and is the base every later plan builds on (runner hardening in 06, streamed candidates in 02, 03 and 07, prewarm in 05).
Output: `src/providers/stream-json.ts`, `src/providers/claude-process.ts`, a replay fixture plus runner tests, the abort wiring in the provider, daemon and client, and per-stage debug lines for each turn.

Scope boundary (context budget): the parser carry cap, the stderr cap, the post-result backstop and the runner's failure-path tests against real children (hang after `result`, exit without `result`, death before `init`, missing binary, zero budget, stderr flood) are plan 06, which runs in wave 2 beside plans 02 and 03. This plan implements the budget timer, spawn-error and exit-without-result branches of the runner because the tracer path needs real error handling; plan 06 proves them against real children.

Spec-less probe fallback: skipped (no SPEC.md and no requirement IDs mapped to this phase). This is a recorded choice; no probe predicates were generated.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-CONTEXT.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-PATTERNS.md
@src/providers/provider.ts
@src/providers/claude-exec.ts
@src/providers/claude-cli.ts
@src/providers/claude-default.ts
@src/daemon/server.ts
@src/daemon/fetch-client.ts
@src/client/run-foreground.ts
@src/cli/main.ts

`.planning/phases/09.1-provider-latency-and-cancellation/09.1-RESEARCH.md` is 72 KB: read only the sections each task's `<read_first>` names (find them with `grep -n '^##' 09.1-RESEARCH.md`), not the whole file. This keeps the plan inside the per-plan context budget.

Project rules that apply to every task in this plan:
- OpenWolf: check `.wolf/anatomy.md` before reading a file and `.wolf/cerebrum.md` (Do-Not-Repeat, Key Learnings) before writing code. Read `.wolf/buglog.json` before fixing any failure and log every fix there. The OpenWolf post-Edit hook rewrites anatomy lines and appends `auto-detected` buglog entries: restore curated lines and drop the auto entries before committing (cerebrum 2026-10-11). This plan is alone in wave 1, so each task stages its own `.wolf/` entries with its code.
- Targeted tests: `pnpm exec vitest run tests/x.test.ts` (never `pnpm test:run -- <file>`, which runs the whole suite).
- TDD RED commits need throw-on-call stubs for new module exports so `tsc --noEmit` passes in the pre-commit hook (cerebrum 2026-08-26).
- Lint changed files with `pnpm exec biome check <files>` before staging. Commit subjects start with a lowercase word (no leading acronym or review ID) and carry no Co-Authored-By trailer.
- Never stub the provider in a smoke, integration or latency check. Unit tests here use a real child process (`tests/fixtures/fake-claude-stream.mjs`) that replays the recorded event shapes from RESEARCH Probes 2, 3 and 8. The real-`claude` check is manual (the `<human-check>` below, harvested at end of phase).
- Fix, don't delete: when a test or the typechecker complains, add what is missing; never remove surrounding logic to silence it.
- `src/providers/claude-exec.ts` and `tests/claude-exec.test.ts` stay as they are. After this plan nothing in `src/` imports `claude-exec.ts`; removing it is not part of this phase.
</context>

## Artifacts this phase produces

Shared contract for all eight plans. Names are fixed here so parallel plans agree; a plan only creates the rows marked with its number.

| Kind | Name | Where | Plan |
|---|---|---|---|
| file (new) | `src/providers/stream-json.ts` | provider layer | 01 (06 enforces the carry cap) |
| file (new) | `src/providers/claude-process.ts` | provider layer | 01 (06 adds the caps, the post-result backstop and the `backstopMs`/`killGraceMs` options; 05 adds the `child` option) |
| file (new) | `src/providers/candidate-stream.ts` | provider layer | 02 |
| file (new) | `src/providers/claude-prewarm.ts` | provider layer | 05 |
| file (new) | `tests/fixtures/fake-claude-stream.mjs` | real child replaying recorded stream-json | 01 (`success`, `auth`, `sigterm-slow`); 06 adds `hang-after-result`, `exit-no-result`, `die-before-init`, `stderr-flood`; 05 adds `ignore-eof` |
| file (new) | `tests/claude-process.test.ts` | tests | 01 (06 and 05 extend it) |
| file (new) | `tests/claude-stream-json.test.ts` | tests | 06 |
| file (new) | `tests/candidate-stream.test.ts` | tests | 02 |
| file (new) | `tests/claude-prewarm.test.ts`, `tests/claude-cli-prewarm.test.ts` | tests | 05 |
| file (new, planning) | `.planning/phases/09.1-provider-latency-and-cancellation/COVERAGE.md` | API coverage matrix | planning |
| type | `FetchOptions { signal?: AbortSignal; onCandidate?: (candidate: CommandCandidate) => void }` | `src/providers/provider.ts` | 01 |
| signature | `LLMAdapter.fetchCandidates(envelope, options?: FetchOptions)` | `src/providers/provider.ts` | 01 |
| function | `abortError()`, `isAbortError(error)` | `src/providers/provider.ts` | 01 |
| schema/type | `streamJsonResultSchema`, `StreamJsonResult` | `src/providers/stream-json.ts` | 01 |
| function | `createLineParser(onEvent, options?)`, `textDeltaOf(event)`, `isInitEvent(event)`, `buildStreamJsonUserLine(prompt)` | `src/providers/stream-json.ts` | 01 |
| option | `createLineParser` options `maxCarryBytes`, `onOverflow` | `src/providers/stream-json.ts` | 06 |
| const | `STREAM_JSON_CARRY_CAP_BYTES` = 1 MiB | `src/providers/stream-json.ts` | 01 declares it, 06 enforces it |
| const | `SIGKILL_GRACE_MS` = 1500, `POST_RESULT_BACKSTOP_MS` = 2000, `STDERR_CAP_BYTES` = 64 KiB | `src/providers/claude-process.ts` | 01 declares them; 06 arms the backstop and enforces the stderr cap |
| type | `ClaudeTurnOptions`, `ClaudeTurnStage`, `ClaudeTurnStageDetail`, `ClaudeTurnFailure`, `ClaudeTurnFailureReason` | `src/providers/claude-process.ts` | 01 |
| option | `ClaudeTurnOptions.backstopMs`, `ClaudeTurnOptions.killGraceMs` | `src/providers/claude-process.ts` | 06 |
| option | `ClaudeTurnOptions.child` (run the turn on a prewarmed child) | `src/providers/claude-process.ts` | 05 |
| function | `spawnClaudeChild(command, argv, cwd, env?)`, `terminateChild(child, graceMs?)`, `runClaudeTurn(options)` | `src/providers/claude-process.ts` | 01 |
| const/function | `CLAUDE_COMMAND` = `'claude'`, `buildClaudeCliArgv(envelope)` | `src/providers/claude-cli.ts` | 01 |
| signature | `fetchClaudeCliCandidates(envelope, remainingBudgetMs, options?)` | `src/providers/claude-cli.ts` | 01 |
| claude flags | `--input-format stream-json`, `--output-format stream-json`, `--verbose`, `--include-partial-messages` | claude argv | 01 |
| claude flag | `--effort <level>` | claude argv | 02 |
| const/type/function | `EFFORT_LEVELS`, `Effort`, `DEFAULT_EFFORT` = `'low'`, `resolveEffort()`, `ResolvedQqConfig.effort` | `src/shared/qq-config.ts` | 02 |
| config key | `effort` in `~/.config/qq/config.json` | qq-config, README, `docs/config.example.json` | 02 |
| const/function | `MAX_STREAMED_CANDIDATES` = 5, `createCandidateScanner(onCandidate)`, `parseStrictCandidateList(text)` | `src/providers/candidate-stream.ts` | 02 |
| IPC request field | `fetch-candidates.stream: z.literal(true).optional()` | `src/contracts/ipc.ts` | 03 |
| IPC response kind | `{ kind: 'candidate', candidate: commandCandidateSchema }` | `src/contracts/ipc.ts` | 03 |
| pong flag | `streamCandidates: true` | `ipc.ts`, `server.ts`, `bootstrap.ts` | 03 |
| signature | `requestDaemonFetch(socketPath, envelope, timeoutMs?, options?)`, `fetchCandidatesForUi(socketPath, envelope, options?)` | `src/daemon/fetch-client.ts` | 01 (03 adds `onCandidate` forwarding and the no-re-query-after-rows rule) |
| type | `CandidateListState` = `'arriving' \| 'complete' \| 'partial'` | `src/ui/modal-layout.ts` | 07 |
| const | `LIST_STATUS_ROW_LINES` = 1, `INCOMPLETE_LIST_NOTE` = `'list may be incomplete'` | `src/ui/modal-layout.ts` | 07 |
| field/prop | `CandidateSelectLayoutInput.listState`; `CandidateSelect` prop `listState` (default `'complete'`) | `modal-layout.ts`, `CandidateSelect.tsx` | 07 |
| function/const | `sdkOutputConfig(model, effort)`, `EFFORT_UNSUPPORTED_MODEL_RE` | `src/providers/claude.ts` | 04 |
| signature | SDK `fetchCandidates(envelope, rbuffer = '', timeoutMs = 25_000, options: FetchOptions = {})`; `claudeAdapter` forwards `options` | `src/providers/claude.ts` | 04 |
| test marker | `'messages.stream('` in the adapters (b) model-call list | `tests/steering.test.ts` | 04 |
| type | `PrewarmSpec { command, argv, cwd }`, `PrewarmMissReason` = `'disabled' \| 'empty' \| 'dead' \| 'cwd' \| 'prompt'`, `PrewarmTake` = `{ child } \| { miss }` | `src/providers/claude-prewarm.ts` | 05 |
| function | `prewarmKey(spec)`, `enablePrewarm()`, `disablePrewarm()`, `takePrewarmed(spec)`, `schedulePrewarm(spec)`, `retirePrewarmed()`, `prewarmSnapshot()` | `src/providers/claude-prewarm.ts` | 05 |
| debug-log stages | provider `cli spawned`, `cli init`, `cli first delta`, `cli result`, `cli exit`, `cli aborted`, `cli timed out`, `claude-cli aborted`; daemon `fetch aborted`; client `fetch aborted` | debug log | 01 |
| debug-log stages | provider `cli first candidate` (02); daemon `replied candidate` (03); provider `request aborted` (04); provider `prewarm hit`, `prewarm miss`, `prewarm spawned`, `prewarm retired`, `prewarm retry cold` (05); client `first candidate received`, `llm request failed after rows` (07) | debug log | 02-05, 07 |
| qq CLI flags | none added | — | — |

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Tracer — Esc during thinking… kills the claude -p turn end to end, and the turn runs stream-json and resolves on result</name>
  <reversibility rating="reversible">Every signature change is additive (optional `options` parameters); the runner replaces one internal wrapper behind the same adapter interface.</reversibility>
  <files>src/providers/provider.ts, src/providers/stream-json.ts, src/providers/claude-process.ts, src/providers/claude-cli.ts, src/providers/claude-default.ts, src/daemon/server.ts, src/daemon/fetch-client.ts, src/client/run-foreground.ts, src/cli/main.ts, tests/fixtures/fake-claude-stream.mjs, tests/claude-process.test.ts, tests/claude-cli-provider.test.ts, tests/daemon-fetch.test.ts, tests/client-result.test.ts, .wolf/anatomy.md, .wolf/memory.md, .wolf/buglog.json</files>
  <read_first>
    - .wolf/cerebrum.md (Do-Not-Repeat: spawn vs execFile, throw-on-call stubs for RED, never feed a wrapper envelope into parseCandidates; Key Learnings: daemon resolution throws stay inside the promise chain, client-result.test.ts fs mock is narrow, do not import src/cli/main.ts in tests)
    - .planning/phases/09.1-provider-latency-and-cancellation/09.1-RESEARCH.md (Probes 1-3, 5, 8, 9; Patterns 1-3; Pitfalls 1-3; "Daemon: abort on client disconnect")
    - .planning/phases/09.1-provider-latency-and-cancellation/09.1-PATTERNS.md (claude-process.ts, stream-json.ts, server.ts, fetch-client.ts, run-foreground.ts sections)
    - src/providers/claude-exec.ts (settled guard, SpawnFailure shape, timeout reject shape to reuse; do not copy its per-chunk Buffer.concat)
    - src/providers/claude-cli.ts, src/providers/claude-default.ts, src/providers/provider.ts
    - src/daemon/server.ts, src/daemon/fetch-client.ts
    - src/client/run-foreground.ts (lines 270-367), src/cli/main.ts (client action), src/cli/commands/client.ts
    - tests/claude-exec.test.ts (real `process.execPath` child pattern and afterEach SIGKILL cleanup)
    - tests/claude-cli-provider.test.ts, tests/daemon-fetch.test.ts, tests/client-result.test.ts (existing mocks and seams)
  </read_first>
  <behavior>
    - claude-process, `success` scenario: runClaudeTurn resolves with the fixture's answer text; at the moment it resolves, the `result` stage has fired and the `exit` stage has not (the fixture exits 300 ms after `result`). Order assertion only, no wall-clock threshold (bug-206).
    - claude-process, prompt on stdin: with FAKE_CLAUDE_STDIN_FILE set, the recorded stdin is exactly one line that parses to `{type:'user', message:{role:'user', content:<prompt>}}`, and the argv the child received does not contain the prompt.
    - claude-process, `sigterm-slow` scenario aborted after the `first-delta` stage: the promise rejects with `isAbortError(error) === true`; onTextDelta is never called after the abort although the fixture keeps writing for 300 ms; the `exit` stage then reports code 143.
    - claude-process, `auth` scenario: rejects with `reason: 'is-error'`, `stdout: 'Not logged in · Please run /login'`, `killed: false`; onTextDelta was never called.
    - claude-cli-provider (runner mocked): argv contains `-p`, `--input-format` `stream-json`, `--output-format` `stream-json`, `--verbose`, `--include-partial-messages`, `--safe-mode`, `--tools` `''`, `--no-session-persistence`, `--system-prompt` followed by buildSystemPrompt(envelope); argv does not contain the prompt; the runner's `prompt` equals buildPrompt(envelope); `cwd` is envelope.base.cwd; `budgetMs` is at most 25000; `command` is `'claude'`.
    - claude-cli-provider: when the runner rejects with abortError(), claudeDefaultAdapter.fetchCandidates rejects with an error for which isAbortError is true (not the D13 or timeout copy).
    - daemon-fetch: requestDaemonFetch with an AbortController aborted after `fetch-accepted` rejects with an AbortError, and the mocked adapter's received `options.signal` becomes aborted (vi.waitFor), proving socket close reaches the adapter.
    - client-result: Esc during loading (call the loading element's onCancel captured from the ink `render` mock while the adapter is still pending): the cancel result is written, the adapter's signal is aborted, `rerender` is never called after the cancel, and runForegroundClient resolves.
  </behavior>
  <action>
Build the single cancellable stream-json path. RESEARCH Patterns 1-3 and the "Daemon: abort on client disconnect" example are the reference; follow them with the names fixed in "Artifacts this phase produces".

1. `src/providers/provider.ts`: add `FetchOptions` with optional `signal: AbortSignal` and optional `onCandidate(candidate: CommandCandidate)`. Change `LLMAdapter.fetchCandidates` to `(envelope, options?: FetchOptions)`. Add `abortError()` (an Error whose `name` is `'AbortError'`, message `'QueQue: request aborted'`) and `isAbortError(error)` (true when `error` is an object whose `name` is `'AbortError'` or `'APIUserAbortError'`). `onCandidate` is part of the shared adapter contract for the phase; adapters that never stream simply do not call it.

2. `src/providers/stream-json.ts` (pure, no spawn, no fs): `streamJsonResultSchema` is a non-strict `z.object` with `type: z.literal('result')`, `is_error: z.boolean()`, and optional `result` (string), `subtype` (string), `duration_api_ms` (number); export `StreamJsonResult`. `createLineParser(onEvent, options?)` keeps a carry string, splits on newline, trims, skips empty lines, and passes each line that parses as JSON to `onEvent`; lines that are not JSON are skipped silently (they never reach any candidate parser). Plan 06 enforces the carry cap; declare `STREAM_JSON_CARRY_CAP_BYTES` (1 MiB) now so its name is fixed. `textDeltaOf(event)` returns `event.event.delta.text` only when `event.type === 'stream_event'`, `event.event.type === 'content_block_delta'`, `event.event.delta.type === 'text_delta'` and the text is a string; otherwise undefined. `isInitEvent(event)` is true for `type 'system'` with `subtype 'init'`. `buildStreamJsonUserLine(prompt)` returns the JSON of `{type:'user', message:{role:'user', content: prompt}}` plus a newline.

3. `src/providers/claude-process.ts`: argv stays an opaque `readonly string[]` in this file, so the steering guard in `tests/steering.test.ts` (which scans every `src/providers/*.ts`) keeps applying only to `claude-cli.ts`. Export `SIGKILL_GRACE_MS = 1500`, `POST_RESULT_BACKSTOP_MS = 2000` (armed in plan 06), `STDERR_CAP_BYTES = 64 * 1024` (enforced in plan 06), the types from the artifacts table, and:
   - `ClaudeTurnStage` = `'spawned' | 'init' | 'first-delta' | 'result' | 'exit' | 'aborted' | 'timed-out'`; `ClaudeTurnStageDetail` = optional `pid`, `code`, `signal`.
   - `ClaudeTurnFailureReason` = `'is-error' | 'exit-without-result' | 'timeout' | 'spawn-error' | 'invalid-result'`; `ClaudeTurnFailure` extends Error with the claude-exec SpawnFailure fields (`code`, `killed`, `signal`, `stdout`, `stderr`) plus `reason` and `sawInit`.
   - `ClaudeTurnOptions`: `command`, `argv`, `cwd`, optional `env`, `prompt`, `budgetMs`, optional `signal`, optional `onTextDelta(text)`, optional `onStage(stage, detail?)`.
   - `spawnClaudeChild(command, argv, cwd, env?)` spawns with `stdio: ['pipe','pipe','pipe']`, `shell: false`, `windowsHide: true`.
   - `terminateChild(child, graceMs = SIGKILL_GRACE_MS)`: if the child is still running (exitCode and signalCode both null) send SIGTERM, then SIGKILL after `graceMs` if it has not exited; the timer is unref'd and cleared on `exit`. Only handles this process spawned are ever signalled; never look up or signal a pid.
   - `runClaudeTurn(options): Promise<string>`: if `signal` is already aborted, reject with abortError() without spawning; if `budgetMs <= 0`, reject with the timeout failure without spawning. Otherwise spawn, emit `spawned` with the pid, use the claude-exec `settled`/`finish` guard, set utf8 encoding on stdout and stderr (Node's StringDecoder keeps split multi-byte characters intact), feed stdout into createLineParser, collect stderr, attach a no-op `error` listener on `child.stdin` (EPIPE from an early-dying child must not crash the daemon), write buildStreamJsonUserLine(prompt) and call `stdin.end()` straight away (Probe 5).
   - Event handling: the first init event emits `init` and sets `sawInit`; a text delta, while not settled, emits `first-delta` once and calls onTextDelta; a `type: 'result'` line goes through streamJsonResultSchema.safeParse — invalid rejects with reason `invalid-result`; `is_error: true` rejects with message `Command failed: claude`, reason `is-error`, `code: 1`, `killed: false`, `signal: null`, `stdout: result ?? ''`, the collected stderr; otherwise emit `result` and resolve with `result ?? ''`. Never branch on `subtype` (Probe 3: the auth failure is `subtype: "success"`).
   - Budget timer (unref'd): on expiry emit `timed-out`, call terminateChild and reject at kill time (do not wait for exit; Probe 8) with message `Command timed out: claude`, reason `timeout`, `killed: true`, `signal: 'SIGTERM'`, `code: null`, `stdout: ''`, stderr. QueQue's own flags decide this, never the exit code or signal (claude exits 143 with a null signal).
   - Abort listener (`once`): emit `aborted`, terminateChild, reject with abortError(). Remove the listener and clear the budget timer when the turn settles, so a socket close after a finished turn never signals a child that is shutting down normally.
   - Child `error` (spawn failure such as ENOENT): reject with that error, adding `reason: 'spawn-error'` and `sawInit`. `exit` emits the `exit` stage with code and signal. `close` while not settled rejects with message `Command failed: claude`, reason `exit-without-result`, the exit code and signal, `killed: false`, `stdout: ''`, stderr.

4. `src/providers/claude-cli.ts`: export `CLAUDE_COMMAND = 'claude'` and `buildClaudeCliArgv(envelope)` returning, in order: `-p`, `--input-format`, `stream-json`, `--output-format`, `stream-json`, `--verbose`, `--include-partial-messages`, `--safe-mode`, `--tools`, `''`, `--no-session-persistence`, `--system-prompt`, `buildSystemPrompt(envelope)`. No positional prompt. `fetchClaudeCliCandidates(envelope, remainingBudgetMs, options = {})` calls runClaudeTurn with `command: CLAUDE_COMMAND`, that argv, `cwd: envelope.base.cwd`, `env: process.env`, `prompt: buildPrompt(envelope)`, `budgetMs: remainingBudgetMs`, `signal: options.signal`, and returns `ensureSelectableCandidates(parseCandidates(text))`. `claudeCliAdapter.fetchCandidates(envelope, options)` forwards `options`. Drop the claude-exec import from this file.

5. `src/providers/claude-default.ts`: `fetchCandidates(envelope, options?)` passes `options` to fetchClaudeCliCandidates. In the catch, when `isAbortError(error)` is true, log `appendDebugLog('provider', 'claude-cli aborted')` and re-throw the error unchanged; every other error keeps today's hardError mapping. The SDK branch is unchanged in this plan (plan 04 adds its signal).

6. `src/daemon/server.ts`: in the connection handler create `connectionAbort = new AbortController()` and register `socket.on('close', () => connectionAbort.abort())` next to the existing `error` handler. In `fetch-candidates`, write `fetch-accepted`, then run the fetch inside a `Promise.resolve().then(...)` chain (cerebrum: resolution throws must stay inside the chain): bootstrapBuiltins, resolveClaudeDefaultAdapter, `fetchCandidates(req.envelope, { signal: connectionAbort.signal })`. On success, if aborted log `fetch aborted` and write nothing; otherwise write `candidates` and log as today. On failure, if aborted log `fetch aborted` and write nothing; otherwise write `fetch-error` as today. Update the file's doc comment to say the provider call is aborted when the client closes the socket.

7. `src/daemon/fetch-client.ts`: `requestDaemonFetch(socketPath, envelope, timeoutMs = FETCH_TIMEOUT_MS, options: FetchOptions = {})`. If `options.signal` is already aborted, reject with abortError() before connecting. Otherwise add a `once` abort listener that calls `finish(abortError())` (finish already clears both timers and destroys the socket, which is what the daemon sees as `close`), and remove that listener inside `finish`. `fetchCandidatesForUi(socketPath, envelope, options = {})` passes `options` through; on IpcTransportError, if the signal is aborted throw abortError(), else fall back to `resolveClaudeDefaultAdapter().fetchCandidates(envelope, options)`.

8. `src/client/run-foreground.ts`: inside the render Promise create `const fetchAbort = new AbortController()`. In both `onSelect` and `onCancel`, right after `resolved = true`, call `fetchAbort.abort()` before awaiting writeShellResult (D-07, D-13, D-15). `cleanupOnSignal` also calls `fetchAbort.abort()` before exiting. Call `fetchCandidatesForUi(socketPath, envelope, { signal: fetchAbort.signal })`. The `.then` handler starts with `if (resolved) return;` (D-14: nothing renders after the result is written). The `.catch` handler returns early, logging `appendDebugLog('client', 'fetch aborted')`, when `isAbortError(err)`; the rest of the catch is unchanged. `runForegroundClient` itself must not call `process.exit` (client-result.test.ts runs it in-process).

9. `src/cli/main.ts`: in the `client` action, after `await clientCommand(...)`, call `process.exit(process.exitCode ?? 0)` (D-15: an open handle can never keep the client alive after the result is written; RESEARCH Pattern 3 and assumption A2). Leave `main()`, the process handlers and the isDirectRun block unchanged.

10. `tests/fixtures/fake-claude-stream.mjs`: a Node ESM script; the scenario is `process.argv[2]`. It writes nothing to stdout until it has read the first stdin line (Probe 5). On stdin EOF with no line it exits 0 (the idle-retire behaviour from Probe 5). If the first line is not a stream-json user message it prints `Error: Input must be provided either through stdin or as a prompt argument when using --print` to stderr and exits 1. When `FAKE_CLAUDE_STDIN_FILE` is set it writes the received stdin text there. Event lines copy the shapes from RESEARCH Probe 2 (success) and Probe 3 (auth failure); do not read anything outside the repo. Scenarios:
    - `success`: system init, system status requesting, stream_event message_start, content_block_start, the answer as at least four text_delta events 20 ms apart, an assistant message, content_block_stop, message_delta, message_stop, rate_limit_event, then `result` with `subtype: 'success'`, `is_error: false` and the full answer, then exit 0 after 300 ms. The answer is a JSON array of two candidates; one explanation contains `ⓘ` (U+24D8), and the stdout bytes of that character are written in two separate writes 20 ms apart.
    - `auth`: system init, the assistant message with `error: 'authentication_failed'`, then `result` with `subtype: 'success'`, `is_error: true`, `result: 'Not logged in · Please run /login'`; empty stderr; exit 1 after 50 ms.
    - `sigterm-slow`: init, then one text_delta every 100 ms for 10 s; on SIGTERM keep writing deltas for 300 ms, then exit with code 143 (Probe 8).
    - Only these three scenarios belong to this plan. Plan 06 adds the failure scenarios its runner tests need, and plan 05 adds `ignore-eof`; write the scenario switch so new cases slot in without touching these three.

11. Tests per `<behavior>`. `tests/claude-process.test.ts` runs the fixture with `command: process.execPath` and `argv: [fixturePath, scenario]`, collects stages through onStage, records pids from the `spawned` detail and SIGKILLs any that are still alive in afterEach. `tests/claude-cli-provider.test.ts`: replace the claude-exec mock with a mock of `../src/providers/claude-process.js` built with an importOriginal spread that overrides only runClaudeTurn (a vi.fn resolving the CANDIDATE_JSON text), so exports added by later plans stay available to modules that import them; rewrite the argv test as "runs claude with stream-json argv, the prompt on stdin, and no bare flag" and the stdin test as "uses the envelope cwd and the remaining budget"; keep the timeout, ENOENT and D13 tests by having the runner mock reject with the matching failure shapes (`killed: true, signal: 'SIGTERM'`; `code: 'ENOENT'`; `reason: 'is-error'` with the "Not logged in" stdout); add the abort test. Leave the SDK-path tests as they are (plan 04 changes them). `tests/daemon-fetch.test.ts` and `tests/client-result.test.ts`: add the abort cases using the existing resolver mocks; the adapter mock rejects with abortError() when its received signal aborts.

The real-`claude` end-to-end run of this path is a manual check (user rule: real-provider checks are manual-only); it is the `<human-check>` below and is harvested into the end-of-phase UAT.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/claude-process.test.ts tests/claude-cli-provider.test.ts tests/daemon-fetch.test.ts tests/client-result.test.ts tests/steering.test.ts</automated>
    <fails_when>non-zero exit, a "FAIL" line in the vitest output, or "No test files found"</fails_when>
    <automated>pnpm typecheck</automated>
    <fails_when>non-zero exit or any "error TS" line</fails_when>
    <human-check>After `pnpm build`, stop the running dev daemon (it does not get replaced automatically by this plan), then in a fresh `env -u ZELLIJ zsh -f -i` with `QQ_DEV_ROOT` set and `shell/zsh/queque.zsh` sourced, type `show me how to use z3??`: candidates still arrive. Repeat and press Esc during `thinking…`: the prompt returns at once, and within about 2 s `ps -o pid,ppid,command -ax | grep 'claude -p'` shows no `claude -p` child of the daemon. While a query runs, the `claude -p` line in `ps` contains no query text.</human-check>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run tests/claude-process.test.ts tests/claude-cli-provider.test.ts tests/daemon-fetch.test.ts tests/client-result.test.ts tests/steering.test.ts` exits 0
    - `pnpm typecheck` exits 0
    - `grep -c "runClaudeTurn(" src/providers/claude-cli.ts` is at least 1
    - `grep -c "'--input-format'" src/providers/claude-cli.ts` is at least 1 and `grep -c "'--include-partial-messages'" src/providers/claude-cli.ts` is at least 1
    - `grep -c "on('close'" src/daemon/server.ts` is at least 1 and `grep -c "signal: connectionAbort.signal" src/daemon/server.ts` is at least 1
    - `grep -c "fetchAbort.abort()" src/client/run-foreground.ts` is at least 3 (onSelect, onCancel, cleanupOnSignal)
    - `grep -c "process.exit(process.exitCode ?? 0)" src/cli/main.ts` is at least 1
    - `grep -c "createLineParser(" src/providers/claude-process.ts` is at least 1
    - `tests/fixtures/fake-claude-stream.mjs` exists and `grep -c "is_error" tests/fixtures/fake-claude-stream.mjs` is at least 2
  </acceptance_criteria>
  <done>Esc and Enter abort the fetch, the daemon aborts the provider call on socket close, the `claude -p` child is SIGTERMed (SIGKILL after 1.5 s), the client exits at once, and a normal `claude -p` turn sends its prompt over stdin and resolves on the validated `result` event. The tracer path is committed with its tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Log each claude -p turn stage, keep every runner failure on today's copy, and record the tracer in OpenWolf</name>
  <files>src/providers/claude-cli.ts, tests/claude-cli-provider.test.ts, .wolf/anatomy.md, .wolf/cerebrum.md, .wolf/memory.md, .wolf/buglog.json</files>
  <read_first>
    - src/providers/claude-cli.ts and src/providers/claude-process.ts (ClaudeTurnStage, onStage; as written in Task 1)
    - .planning/phases/09.1-provider-latency-and-cancellation/09.1-RESEARCH.md ("Per-stage debug logging", Pitfall 12)
    - tests/claude-cli-provider.test.ts (FORBIDDEN_DEBUG regex and the debug-log mock)
    - .wolf/cerebrum.md (Key Learnings line "`claude -p` flags for QueQue", which this plan supersedes)
  </read_first>
  <behavior>
    - claude-default via claude-cli (runner mocked): the timeout shape maps to TIMEOUT_MESSAGE, the is-error "Not logged in · Please run /login" shape maps to the D13 copy, ENOENT maps to ENOENT_MESSAGE, and none of them ever yields a candidate.
    - claude-cli stage logs (D-04): given runner stages spawned → init → first-delta → result → exit, the debug-log calls whose message starts with `cli ` are `cli spawned`, `cli init`, `cli first delta`, `cli result`, `cli exit` in that order (order only, no timing assertion); each detail has a numeric `ms`, and `cli exit` also carries `code` and `signal`. Details are matched with expect.objectContaining, so a field added later (plan 05's `warm`) or another provider line (plan 05's `prewarm miss`) does not break the test.
    - A turn whose runner emits `aborted` logs `cli aborted`; one that emits `timed-out` logs `cli timed out`.
    - No logged detail matches FORBIDDEN_DEBUG.
  </behavior>
  <action>
Make each turn's timing visible in the debug log (Claude's Discretion: per-stage provider timing) and pin the error-copy mapping on the new runner (D-04, 08 D-12/D-13 rules kept).

1. `src/providers/claude-cli.ts`: pass an `onStage` that logs `appendDebugLog('provider', 'cli <stage>', { ms })` with stage names `spawned`, `init`, `first delta`, `result`, `exit`, `aborted`, `timed out`, where `ms` is the time since the turn started; for `exit` also log `code` and `signal`. Log no prompt, argv, stdout or stderr, and no detail key containing `args`, `argv`, `env`, `stdout`, `stderr` or `token` (the FORBIDDEN_DEBUG regex in tests/claude-cli-provider.test.ts). Tests assert stage order only; wall-clock latency is measured manually on an idle machine (bug-206).

2. Tests per `<behavior>` in `tests/claude-cli-provider.test.ts`. Filter the debug-log mock's calls to messages starting with `cli ` before asserting order: plan 05 (wave 3) adds the `warm` detail field and the `prewarm hit`/`prewarm miss` lines in claude-cli.ts but does not own this test file, and plan 04 edits this file in the same wave, so the assertion must hold before and after plan 05 lands.

3. OpenWolf, staged with this task's commit (this plan is alone in wave 1): `.wolf/anatomy.md` entries for `src/providers/stream-json.ts`, `src/providers/claude-process.ts`, `tests/fixtures/fake-claude-stream.mjs`, `tests/claude-process.test.ts`, and updated lines for provider.ts, claude-cli.ts, claude-default.ts, server.ts, fetch-client.ts, run-foreground.ts, main.ts. `.wolf/cerebrum.md`: replace the Key Learnings line on `claude -p` flags with the new contract (stdin pipe with one stream-json user line then EOF; `--input-format stream-json --output-format stream-json --verbose --include-partial-messages`; resolve on the zod-validated `result` event; gate on `is_error`, never `subtype`; QueQue's own timeout and abort flags, because claude exits 143 with a null signal after SIGTERM; still never bare mode). `.wolf/buglog.json`: one entry for the deferred bug from quick 261011-jbh ("Esc during thinking… leaves the client running"): root cause per RESEARCH Pattern 3, fix = fetch abort plus socket destroy plus process.exit in the client action. `.wolf/memory.md`: one line per action.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/claude-cli-provider.test.ts</automated>
    <fails_when>non-zero exit, a "FAIL" line in the vitest output, or "No test files found"</fails_when>
    <automated>pnpm test:run && pnpm typecheck && pnpm lint</automated>
    <fails_when>non-zero exit from any of the three commands, or a "FAIL" line in the vitest output</fails_when>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run tests/claude-cli-provider.test.ts` exits 0
    - `pnpm test:run && pnpm typecheck && pnpm lint` exits 0
    - `grep -c "cli first delta" src/providers/claude-cli.ts` is at least 1
    - `.wolf/anatomy.md` contains `stream-json.ts`, `claude-process.ts` and `fake-claude-stream.mjs`
    - `.wolf/buglog.json` parses as JSON (`node -e "JSON.parse(require('fs').readFileSync('.wolf/buglog.json','utf8'))"` exits 0) and contains an entry whose `file` names `src/client/run-foreground.ts`
  </acceptance_criteria>
  <done>Each `claude -p` turn logs its stages in order without prompt text; timeout, auth failure and missing binary still map to today's copy and never yield a candidate; the full suite, typecheck and lint pass; OpenWolf records the tracer.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| claude child stdout → daemon | Untrusted model and Claude Code output (NDJSON events, error text) enters the provider layer |
| client → daemon Unix socket | Local IPC; a socket close now triggers a kill of a child process |
| daemon → claude child (argv, stdin, signals) | The daemon controls process lifetime and what is visible in `ps` |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-09.1-01 | Tampering | `runClaudeTurn` result handling → parseCandidates → shell buffer | high | mitigate | Gate on `is_error` (never `subtype`); only the zod-validated `result.result` of a non-error result reaches parseCandidates; non-JSON lines and raw NDJSON never reach it; auth text rejects with `stdout` so claude-default shows the D13 copy (tests: `auth` scenario, claude-cli-provider D13 case) |
| T-09.1-02 | Information disclosure | claude argv (T-08-02-07) | medium | mitigate | Prompt sent as one stream-json line on stdin, never in argv (test asserts argv lacks the prompt; human-check inspects `ps`) |
| T-09.1-03 | Denial of service / cost | orphaned `claude -p` after Esc or client disconnect | medium | mitigate | Socket `close` → AbortController → SIGTERM, SIGKILL after 1500 ms; budget timer kills at 25 s (plan 06 adds the 2000 ms post-result backstop) |
| T-09.1-04 | Tampering | process signalling | low | mitigate | `terminateChild` only signals ChildProcess handles this process spawned; no pid lookup or `process.kill(pid)` in `src/` |
| T-09.1-06 | Information disclosure | provider debug-log stage lines | low | mitigate | Stage details carry only `ms`, `code`, `signal`; FORBIDDEN_DEBUG test asserts no args, env, stdout, stderr or token fields |
| T-09.1-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs in this plan (RESEARCH Package Legitimacy Audit lists none); `package.json` and `pnpm-lock.yaml` are not in files_modified and must be unchanged by this plan's commits |
</threat_model>

<verification>
- `pnpm test:run && pnpm typecheck && pnpm lint` exits 0 after Task 2.
- `git diff --stat <plan-base-sha>..HEAD -- package.json pnpm-lock.yaml` is empty.
- The tracer `<human-check>` is listed in the plan SUMMARY so the verifier harvests it into the end-of-phase UAT.
</verification>

<success_criteria>
- Esc and early Enter abort the in-flight `claude -p` call through client, socket, daemon and runner (D-07 abort half, D-13, D-14, D-15).
- `claude -p` runs stream-json in and out with the prompt on stdin, and the turn resolves on the validated `result` event with the `is_error` gate (D-04, D-11 stdin rule).
- All existing user-facing error copy (D13 not-authenticated, ENOENT, TIMEOUT_MESSAGE) is unchanged.
</success_criteria>

<output>
Create `.planning/phases/09.1-provider-latency-and-cancellation/09.1-01-SUMMARY.md` when done. Include the tracer `<human-check>` text verbatim under a "Human checks for end-of-phase UAT" heading.
</output>


#### .planning/phases/09.1-provider-latency-and-cancellation/09.1-02-PLAN.md
---
phase: 09.1-provider-latency-and-cancellation
plan: 02
type: execute
wave: 2
depends_on: [09.1-01]
coupling_justified: ["09.1-06: this plan's claude-cli.ts calls runClaudeTurn with the plan-01 options only (onTextDelta) and its tests mock runClaudeTurn; plan 06 adds optional ClaudeTurnOptions fields with defaults and changes runner internals only, so either merge order gives the same result"]
files_modified:
  - src/shared/qq-config.ts
  - src/providers/claude-cli.ts
  - src/providers/candidate-stream.ts
  - README.md
  - docs/config.example.json
  - tests/qq-config.test.ts
  - tests/candidate-stream.test.ts
  - tests/claude-cli-provider.test.ts
autonomous: true
requirements: [D-01, D-02, D-05]

estimate:
  tokens: 75000
  raw_tokens: 75000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "D-01: `claude -p` gets `--effort low` by default; an `effort` key in `~/.config/qq/config.json` (`low`, `medium`, `high`, `xhigh` or `max`, trimmed and case-insensitive) overrides it"
    - "D-01: an invalid `effort` value falls back to `low` and never fails the query or discards the rest of config.json (privacy and safety patterns still load, no 'ignoring invalid config' warning)"
    - "D-02: no model flag is passed to `claude -p`; the account default model stays in charge"
    - "D-05 (provider half): on the `claude -p` path each candidate object is parsed out of the streaming text deltas as soon as its closing brace arrives, validated with commandCandidateSchema, and handed to `options.onCandidate` in the model's order (09 D-13), at most 5"
    - "D-05: the final list is the strict parse of the `result` text when it is a valid candidate array; if that strict parse fails after rows were streamed, the streamed (already validated) rows are the final list; only when nothing streamed does today's parseCandidates fallback apply"
    - "D-04 kept: an `is_error` result or partial text never becomes a candidate; the scanner only sees text_delta text and never runs the prose fallback"
    - "Effort changes in config.json take effect after the daemon restarts (the daemon caches config.json), and README says so"
  artifacts:
    - path: "src/shared/qq-config.ts"
      provides: "lenient `effort` config key, EFFORT_LEVELS, DEFAULT_EFFORT, resolveEffort()"
      contains: "resolveEffort"
    - path: "src/providers/candidate-stream.ts"
      provides: "incremental JSON-array candidate scanner and strict final-list parser"
      contains: "createCandidateScanner"
    - path: "tests/candidate-stream.test.ts"
      provides: "scanner tests at every split point of a recorded answer"
      contains: "createCandidateScanner"
  key_links:
    - from: "src/providers/claude-cli.ts"
      to: "src/shared/qq-config.ts"
      via: "buildClaudeCliArgv adds '--effort', resolveEffort()"
      pattern: "resolveEffort\\(\\)"
    - from: "src/providers/claude-cli.ts"
      to: "src/providers/candidate-stream.ts"
      via: "runClaudeTurn onTextDelta feeds createCandidateScanner, which calls options.onCandidate"
      pattern: "createCandidateScanner\\("
---

<objective>
Two provider-side levers for the `claude -p` path: the effort setting (D-01, D-02) and parsing candidates out of the stream as they arrive (the provider half of D-05).

Purpose: `--effort low` removes Claude Code's default `xhigh` thinking (about -1.05 s median on unfamiliar queries, and the 0-1.8 s thinking tail). The incremental scanner lets the adapter hand each validated candidate to `options.onCandidate` the moment its object closes, which plan 03 forwards over IPC and plan 07 renders as a growing list (first row ~1 s before `result`).
Output: `effort` in qq-config with docs, `--effort` in the claude argv, `src/providers/candidate-stream.ts`, and the scanner wired into claude-cli.

Runs in parallel with plans 03 and 06 (no shared files; the runner coupling with plan 06 is declared in `coupling_justified`). This plan does not stage any `.wolf/` file: list the anatomy, cerebrum and memory entries in the SUMMARY under "OpenWolf entries for plan 08" (Phase 9 decision for parallel waves).
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-CONTEXT.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-RESEARCH.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-01-SUMMARY.md
@src/shared/qq-config.ts
@src/providers/claude-cli.ts
@src/providers/claude.ts
@src/contracts/candidates.ts

Project rules: check `.wolf/anatomy.md` before reading files and `.wolf/cerebrum.md` before writing code; read `.wolf/buglog.json` before fixing a failure. Do not stage `.wolf/` files in this plan (parallel wave); record buglog-worthy fixes in the SUMMARY for plan 08. Targeted tests use `pnpm exec vitest run tests/x.test.ts`. RED commits need throw-on-call stubs so `tsc --noEmit` passes. Lint changed files with `pnpm exec biome check <files>` before staging. Commit subjects start lowercase, no Co-Authored-By trailer. Fix, don't delete.
</context>

## Artifacts this phase produces

Shared contract for all eight plans; this plan creates the rows marked 02.

| Kind | Name | Where | Plan |
|---|---|---|---|
| file (new) | `src/providers/stream-json.ts` | provider layer | 01 (06 enforces the carry cap) |
| file (new) | `src/providers/claude-process.ts` | provider layer | 01 (06 adds the caps, the post-result backstop and the `backstopMs`/`killGraceMs` options; 05 adds the `child` option) |
| file (new) | `src/providers/candidate-stream.ts` | provider layer | 02 |
| file (new) | `src/providers/claude-prewarm.ts` | provider layer | 05 |
| file (new) | `tests/fixtures/fake-claude-stream.mjs` | real child replaying recorded stream-json | 01 (`success`, `auth`, `sigterm-slow`); 06 adds `hang-after-result`, `exit-no-result`, `die-before-init`, `stderr-flood`; 05 adds `ignore-eof` |
| file (new) | `tests/claude-process.test.ts` | tests | 01 (06 and 05 extend it) |
| file (new) | `tests/claude-stream-json.test.ts` | tests | 06 |
| file (new) | `tests/candidate-stream.test.ts` | tests | 02 |
| file (new) | `tests/claude-prewarm.test.ts`, `tests/claude-cli-prewarm.test.ts` | tests | 05 |
| file (new, planning) | `.planning/phases/09.1-provider-latency-and-cancellation/COVERAGE.md` | API coverage matrix | planning |
| type | `FetchOptions { signal?: AbortSignal; onCandidate?: (candidate: CommandCandidate) => void }` | `src/providers/provider.ts` | 01 |
| signature | `LLMAdapter.fetchCandidates(envelope, options?: FetchOptions)` | `src/providers/provider.ts` | 01 |
| function | `abortError()`, `isAbortError(error)` | `src/providers/provider.ts` | 01 |
| schema/type | `streamJsonResultSchema`, `StreamJsonResult` | `src/providers/stream-json.ts` | 01 |
| function | `createLineParser(onEvent, options?)`, `textDeltaOf(event)`, `isInitEvent(event)`, `buildStreamJsonUserLine(prompt)` | `src/providers/stream-json.ts` | 01 |
| option | `createLineParser` options `maxCarryBytes`, `onOverflow` | `src/providers/stream-json.ts` | 06 |
| const | `STREAM_JSON_CARRY_CAP_BYTES` = 1 MiB | `src/providers/stream-json.ts` | 01 declares it, 06 enforces it |
| const | `SIGKILL_GRACE_MS` = 1500, `POST_RESULT_BACKSTOP_MS` = 2000, `STDERR_CAP_BYTES` = 64 KiB | `src/providers/claude-process.ts` | 01 declares them; 06 arms the backstop and enforces the stderr cap |
| type | `ClaudeTurnOptions`, `ClaudeTurnStage`, `ClaudeTurnStageDetail`, `ClaudeTurnFailure`, `ClaudeTurnFailureReason` | `src/providers/claude-process.ts` | 01 |
| option | `ClaudeTurnOptions.backstopMs`, `ClaudeTurnOptions.killGraceMs` | `src/providers/claude-process.ts` | 06 |
| option | `ClaudeTurnOptions.child` (run the turn on a prewarmed child) | `src/providers/claude-process.ts` | 05 |
| function | `spawnClaudeChild(command, argv, cwd, env?)`, `terminateChild(child, graceMs?)`, `runClaudeTurn(options)` | `src/providers/claude-process.ts` | 01 |
| const/function | `CLAUDE_COMMAND` = `'claude'`, `buildClaudeCliArgv(envelope)` | `src/providers/claude-cli.ts` | 01 |
| signature | `fetchClaudeCliCandidates(envelope, remainingBudgetMs, options?)` | `src/providers/claude-cli.ts` | 01 |
| claude flags | `--input-format stream-json`, `--output-format stream-json`, `--verbose`, `--include-partial-messages` | claude argv | 01 |
| claude flag | `--effort <level>` | claude argv | 02 |
| const/type/function | `EFFORT_LEVELS`, `Effort`, `DEFAULT_EFFORT` = `'low'`, `resolveEffort()`, `ResolvedQqConfig.effort` | `src/shared/qq-config.ts` | 02 |
| config key | `effort` in `~/.config/qq/config.json` | qq-config, README, `docs/config.example.json` | 02 |
| const/function | `MAX_STREAMED_CANDIDATES` = 5, `createCandidateScanner(onCandidate)`, `parseStrictCandidateList(text)` | `src/providers/candidate-stream.ts` | 02 |
| IPC request field | `fetch-candidates.stream: z.literal(true).optional()` | `src/contracts/ipc.ts` | 03 |
| IPC response kind | `{ kind: 'candidate', candidate: commandCandidateSchema }` | `src/contracts/ipc.ts` | 03 |
| pong flag | `streamCandidates: true` | `ipc.ts`, `server.ts`, `bootstrap.ts` | 03 |
| signature | `requestDaemonFetch(socketPath, envelope, timeoutMs?, options?)`, `fetchCandidatesForUi(socketPath, envelope, options?)` | `src/daemon/fetch-client.ts` | 01 (03 adds `onCandidate` forwarding and the no-re-query-after-rows rule) |
| type | `CandidateListState` = `'arriving' \| 'complete' \| 'partial'` | `src/ui/modal-layout.ts` | 07 |
| const | `LIST_STATUS_ROW_LINES` = 1, `INCOMPLETE_LIST_NOTE` = `'list may be incomplete'` | `src/ui/modal-layout.ts` | 07 |
| field/prop | `CandidateSelectLayoutInput.listState`; `CandidateSelect` prop `listState` (default `'complete'`) | `modal-layout.ts`, `CandidateSelect.tsx` | 07 |
| function/const | `sdkOutputConfig(model, effort)`, `EFFORT_UNSUPPORTED_MODEL_RE` | `src/providers/claude.ts` | 04 |
| signature | SDK `fetchCandidates(envelope, rbuffer = '', timeoutMs = 25_000, options: FetchOptions = {})`; `claudeAdapter` forwards `options` | `src/providers/claude.ts` | 04 |
| test marker | `'messages.stream('` in the adapters (b) model-call list | `tests/steering.test.ts` | 04 |
| type | `PrewarmSpec { command, argv, cwd }`, `PrewarmMissReason` = `'disabled' \| 'empty' \| 'dead' \| 'cwd' \| 'prompt'`, `PrewarmTake` = `{ child } \| { miss }` | `src/providers/claude-prewarm.ts` | 05 |
| function | `prewarmKey(spec)`, `enablePrewarm()`, `disablePrewarm()`, `takePrewarmed(spec)`, `schedulePrewarm(spec)`, `retirePrewarmed()`, `prewarmSnapshot()` | `src/providers/claude-prewarm.ts` | 05 |
| debug-log stages | provider `cli spawned`, `cli init`, `cli first delta`, `cli result`, `cli exit`, `cli aborted`, `cli timed out`, `claude-cli aborted`; daemon `fetch aborted`; client `fetch aborted` | debug log | 01 |
| debug-log stages | provider `cli first candidate` (02); daemon `replied candidate` (03); provider `request aborted` (04); provider `prewarm hit`, `prewarm miss`, `prewarm spawned`, `prewarm retired`, `prewarm retry cold` (05); client `first candidate received`, `llm request failed after rows` (07) | debug log | 02-05, 07 |
| qq CLI flags | none added | — | — |

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: claude -p runs at low effort by default, overridable from config.json</name>
  <reversibility rating="reversible">The `effort` key is optional and the schema strips unknown keys, so removing or renaming it later breaks no existing config file.</reversibility>
  <files>src/shared/qq-config.ts, src/providers/claude-cli.ts, README.md, docs/config.example.json, tests/qq-config.test.ts, tests/claude-cli-provider.test.ts</files>
  <read_first>
    - src/shared/qq-config.ts (qqConfigFileSchema at lines 50-53; readConfigFile at 103-125 drops the whole file on a parse error; loadQqConfig caches per process)
    - src/providers/claude-cli.ts (buildClaudeCliArgv from plan 01)
    - .planning/phases/09.1-provider-latency-and-cancellation/09.1-RESEARCH.md (Probe 6, Pattern 6, Pitfall 4)
    - tests/qq-config.test.ts, tests/claude-cli-provider.test.ts (the argv test from plan 01)
    - README.md "Configuration reference" table and docs/config.example.json
  </read_first>
  <behavior>
    - qqConfigFileSchema: `{effort:'high'}` → `'high'`; `{effort:' LOW '}` → `'low'`; `{effort:'Max'}` → `'max'`; `{effort:'bogus', privacy:{sensitivePathPatterns:['x']}}` → effort undefined and the privacy patterns kept; `{effort: 3}` → undefined; `{}` → no effort key.
    - loadQqConfig with `QQ_CONFIG_FILE` pointing at a temp file `{"effort":"medium"}` → `effort === 'medium'`; a missing file → `'low'`; `{"effort":"bogus","privacy":{"sensitivePathPatterns":["zz"]}}` → `'low'`, the `zz` pattern is compiled, and console.warn is not called. resetQqConfigCache between cases.
    - resolveEffort() returns loadQqConfig().effort.
    - claude-cli argv: contains `--effort` immediately followed by `low` by default, and by `high` when the config file sets `"effort":"high"`; it contains no model flag.
  </behavior>
  <action>
Implement D-01 and D-02 per RESEARCH Pattern 6.

1. `src/shared/qq-config.ts`: export `EFFORT_LEVELS` = `['low','medium','high','xhigh','max'] as const` (the values `claude --help` 2.1.285 lists and SDK OutputConfig types), `type Effort`, and `DEFAULT_EFFORT: Effort = 'low'`. Add `effort` to qqConfigFileSchema as a `z.preprocess` that trims and lowercases strings, then `z.enum(EFFORT_LEVELS)`, `.optional()` and `.catch(undefined)`, so an invalid value becomes undefined instead of failing the whole file (Pitfall 4: a strict enum would make readConfigFile drop the privacy patterns too). Add `effort: Effort` to ResolvedQqConfig, set from `file.effort ?? DEFAULT_EFFORT` in loadQqConfig. Export `resolveEffort(): Effort` returning `loadQqConfig().effort`. QueQue validates the value itself because Claude Code only warns on stderr and silently falls back to the account default (`xhigh`) for an unknown value (Probe 6).

2. `src/providers/claude-cli.ts`: buildClaudeCliArgv inserts `'--effort', resolveEffort()` right after `'--include-partial-messages'`. Do not add any model-selection flag (D-02: the account default model stays in charge).

3. `tests/claude-cli-provider.test.ts`: in beforeEach point `QQ_CONFIG_FILE` at a path inside a fresh `fs.mkdtempSync` dir that has no config file and call resetQqConfigCache, so the developer's real `~/.config/qq/config.json` never leaks into the tests; restore the variable in afterEach. Extend the argv test with the effort cases from `<behavior>`.

4. Docs: add a row to the README "Configuration reference" table: `effort` | `"low" \| "medium" \| "high" \| "xhigh" \| "max"` | Claude effort for `claude -p` (and the API-key SDK path, plan 04). Default `low`. Invalid values fall back to `low`. Takes effect after the daemon restarts, because the daemon reads config.json once. Add `"effort": "low"` to `docs/config.example.json` (keep the file valid JSON).
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/qq-config.test.ts tests/claude-cli-provider.test.ts</automated>
    <fails_when>non-zero exit, a "FAIL" line in the vitest output, or "No test files found"</fails_when>
    <automated>pnpm typecheck</automated>
    <fails_when>non-zero exit or any "error TS" line</fails_when>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run tests/qq-config.test.ts tests/claude-cli-provider.test.ts` exits 0
    - `pnpm typecheck` exits 0
    - `grep -c "resolveEffort()" src/providers/claude-cli.ts` is at least 1 and `grep -c "'--effort'" src/providers/claude-cli.ts` is at least 1
    - `grep -c "export const DEFAULT_EFFORT" src/shared/qq-config.ts` is at least 1 and `grep -c ".catch(undefined)" src/shared/qq-config.ts` is at least 1
    - `node -e "const c=JSON.parse(require('fs').readFileSync('docs/config.example.json','utf8')); process.exit(c.effort==='low'?0:1)"` exits 0
    - `grep -n "effort" README.md` lists a new Configuration reference table row that starts with the `effort` field name
  </acceptance_criteria>
  <done>`claude -p` runs with `--effort low` unless config.json sets a valid level; invalid values fall back without touching the rest of the config; README and the example config document the key.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Parse candidates out of the stream as they arrive on the claude -p path</name>
  <files>src/providers/candidate-stream.ts, src/providers/claude-cli.ts, tests/candidate-stream.test.ts, tests/claude-cli-provider.test.ts</files>
  <read_first>
    - .planning/phases/09.1-provider-latency-and-cancellation/09.1-RESEARCH.md ("Incremental candidate scanner" example, Alternatives Considered row rejecting an NDJSON prompt contract, Pitfall 1)
    - src/contracts/candidates.ts (commandCandidateSchema, candidateListSchema min 1 max 5)
    - src/providers/claude.ts (parseCandidates, stripCodeFence, ensureSelectableCandidates)
    - src/providers/claude-cli.ts, src/providers/claude-process.ts (onTextDelta), src/providers/provider.ts (FetchOptions)
  </read_first>
  <behavior>
    - Scanner: the recorded answer `[{"command":"tldr z3","explanation":"Show concise usage examples"},{"command":"z3 -h","explanation":"Print z3 options ⓘ"}]` fed as two pieces split at every index from 1 to length-1 emits exactly those two candidates, in order, each time.
    - Scanner: braces, brackets, escaped quotes and backslashes inside string values (`"explanation":"use {x} and [y] and \"q\" and \\"`) do not end an object early.
    - Scanner: a leading code fence (```` ```json ```` and a newline) before `[` is ignored; an object that fails commandCandidateSchema (empty command) is skipped and the next valid one is still emitted.
    - Scanner: a seven-object array emits exactly MAX_STREAMED_CANDIDATES (5).
    - parseStrictCandidateList: a valid array → that list; the same array inside a json code fence → that list; prose → undefined; six items → undefined; `[]` → undefined; invalid JSON → undefined.
    - claude-cli (runner mocked to call onTextDelta with pieces of the recorded answer before resolving): onCandidate is called with both candidates in order before fetchClaudeCliCandidates resolves; once options.signal is aborted, onCandidate is not called again; without onCandidate no scanner is created.
    - claude-cli final list: a valid result text → its strict parse; a result text that fails the strict parse after two candidates streamed → those two candidates; a prose result with nothing streamed → parseCandidates' existing fallback (unchanged behaviour).
    - claude-cli logs `cli first candidate` once per turn.
  </behavior>
  <action>
Implement the provider half of D-05 with the bracket- and string-aware depth scanner from RESEARCH ("Incremental candidate scanner"); keep the prompt's output format unchanged (an NDJSON prompt contract was rejected in research).

1. `src/providers/candidate-stream.ts`: export `MAX_STREAMED_CANDIDATES = 5` and `createCandidateScanner(onCandidate)`, returning a function that takes text pieces. State: depth, in-string, escape, object start, emitted count, and the text consumed so far. Text before the first `[` leaves depth at 0 and is ignored. When a `}` closes an object at depth 2, JSON.parse that object's text inside try/catch, run commandCandidateSchema.safeParse, and call onCandidate with the parsed data on success (malformed or invalid objects are skipped; the final parse decides). Stop emitting after MAX_STREAMED_CANDIDATES. Drop the text before the current object start after each emit so memory stays bounded. Never apply a prose fallback to partial text (Pitfall 1). Also export `parseStrictCandidateList(text)`: strip a json code fence with the same rule as claude.ts stripCodeFence, JSON.parse inside try/catch, then candidateListSchema.safeParse; return the data or undefined.

2. `src/providers/claude-cli.ts`: when `options.onCandidate` is set, create a scanner whose callback records each candidate in a local `streamed` array, logs `appendDebugLog('provider', 'cli first candidate', { ms })` once, and calls `options.onCandidate(candidate)` only while `options.signal` is not aborted. Pass the scanner as runClaudeTurn's `onTextDelta`. Build the final list as: `parseStrictCandidateList(text)` when defined; otherwise the `streamed` rows when there are any; otherwise `parseCandidates(text)`; then `ensureSelectableCandidates(...)`. The auth `is_error` path never reaches this code (the runner rejects, and auth failures carry no text deltas).

3. Tests per `<behavior>` in `tests/candidate-stream.test.ts` (new) and `tests/claude-cli-provider.test.ts` (the runner mock invokes its `onTextDelta` argument before resolving).
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/candidate-stream.test.ts tests/claude-cli-provider.test.ts tests/steering.test.ts</automated>
    <fails_when>non-zero exit, a "FAIL" line in the vitest output, or "No test files found"</fails_when>
    <automated>pnpm typecheck && pnpm lint</automated>
    <fails_when>non-zero exit, any "error TS" line, or biome reporting an error</fails_when>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run tests/candidate-stream.test.ts tests/claude-cli-provider.test.ts tests/steering.test.ts` exits 0
    - `pnpm typecheck && pnpm lint` exits 0
    - `grep -c "createCandidateScanner(" src/providers/claude-cli.ts` is at least 1 and `grep -c "parseStrictCandidateList(" src/providers/claude-cli.ts` is at least 1
    - `grep -n "export const MAX_STREAMED_CANDIDATES" src/providers/candidate-stream.ts` prints one line whose value is 5
    - `grep -c "commandCandidateSchema" src/providers/candidate-stream.ts` is at least 1
  </acceptance_criteria>
  <done>The `claude -p` adapter calls onCandidate with each validated candidate as soon as its object closes (in order, at most 5, never after abort), and the final list prefers the strict parse, then the streamed rows, then today's fallback.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| config.json → claude argv | A user-edited value becomes a child-process argument |
| model text deltas → candidate objects | Partial, untrusted model output becomes shell-buffer candidates |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-09.1-07 | Tampering | `effort` config value → argv | low | mitigate | zod enum of five levels after trim/lowercase, invalid → `low`; spawn runs with `shell: false` so the value is one argv element, never shell text |
| T-09.1-08 | Tampering | candidate scanner → onCandidate → shell buffer | high | mitigate | Every streamed object passes commandCandidateSchema before it is emitted; no prose fallback on partial text; at most 5 rows; the final list prefers the strict candidateListSchema parse; is_error text never reaches the scanner (tests cover each) |
| T-09.1-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs in this plan (RESEARCH audit lists none); `package.json` and `pnpm-lock.yaml` unchanged by this plan's commits |
</threat_model>

<verification>
- `pnpm test:run && pnpm typecheck && pnpm lint` exits 0 at the end of the plan.
- `git diff --stat <plan-base-sha>..HEAD -- package.json pnpm-lock.yaml .wolf` is empty (no dependency changes, no `.wolf/` commits in a parallel wave).
</verification>

<success_criteria>
- D-01 and D-02 hold for the `claude -p` path and are documented.
- The `claude -p` adapter streams validated candidates to `options.onCandidate` in model order (D-05 provider half), ready for plan 03's IPC and plan 07's growing list.
</success_criteria>

<output>
Create `.planning/phases/09.1-provider-latency-and-cancellation/09.1-02-SUMMARY.md` when done, with a section "OpenWolf entries for plan 08" listing anatomy lines for `src/providers/candidate-stream.ts`, `tests/candidate-stream.test.ts`, the updated qq-config.ts and claude-cli.ts lines, any buglog entries, and a cerebrum line for "effort is validated by QueQue; Claude Code only warns on an unknown --effort value".
</output>


#### .planning/phases/09.1-provider-latency-and-cancellation/09.1-03-PLAN.md
---
phase: 09.1-provider-latency-and-cancellation
plan: 03
type: execute
wave: 2
depends_on: [09.1-01]
files_modified:
  - src/contracts/ipc.ts
  - src/daemon/server.ts
  - src/daemon/bootstrap.ts
  - src/daemon/fetch-client.ts
  - docs/SYSTEM_DESIGN.md
  - tests/daemon-fetch.test.ts
  - tests/daemon-bootstrap.test.ts
autonomous: true
requirements: [D-05, D-14, D-16]

estimate:
  tokens: 50000
  raw_tokens: 50000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "D-05: for a `fetch-candidates` request carrying `stream: true`, the daemon writes one `{kind:'candidate'}` message per parsed candidate as soon as the adapter reports it, then the final `{kind:'candidates'}` message as the done signal; a request without `stream` gets exactly `fetch-accepted` then `candidates`, as today"
    - "D-05: the pong advertises `streamCandidates: true` and ensureDaemon replaces a live daemon whose pong lacks it, so an old daemon never answers a streaming client"
    - "D-05: the client's fetch forwards each streamed candidate to `options.onCandidate` in arrival order, with multi-byte characters intact across socket reads, before it resolves with the final list"
    - "D-14 (daemon side): once the client has closed its socket, a candidate the provider still reports is not written anywhere"
    - "D-16 (transport side): when the daemon connection fails after at least one candidate was forwarded, the client's fetch rejects instead of starting an in-process re-query, so no row is duplicated and no second cold provider call is paid; with no candidate yet it falls back in-process as today"
  artifacts:
    - path: "src/contracts/ipc.ts"
      provides: "`stream` request flag, `candidate` response kind, `streamCandidates` pong flag"
      contains: "streamCandidates"
    - path: "src/daemon/fetch-client.ts"
      provides: "`stream: true` request, utf8 socket decoding, `candidate` → onCandidate, no in-process re-query after rows"
      contains: "onCandidate"
  key_links:
    - from: "src/daemon/server.ts"
      to: "src/providers/provider.ts"
      via: "adapter.fetchCandidates(req.envelope, { signal, onCandidate }) with onCandidate only when req.stream === true"
      pattern: "kind: 'candidate'"
    - from: "src/daemon/fetch-client.ts"
      to: "src/contracts/ipc.ts"
      via: "request carries stream: true; 'candidate' responses call options.onCandidate"
      pattern: "stream: true"
    - from: "src/daemon/bootstrap.ts"
      to: "src/daemon/server.ts"
      via: "current daemon requires pong.streamCandidates === true"
      pattern: "streamCandidates === true"
---

<objective>
Carry candidates from the daemon to the client one by one as each parses (D-05): the IPC contract, the pong capability bump that replaces old daemons, the daemon writes, and the client fetch that forwards each row to `options.onCandidate`. Also the transport half of D-16: after rows have arrived, a dropped daemon connection is not re-queried in-process.

Purpose: plan 02 makes the `claude -p` adapter call `options.onCandidate`; this plan carries those calls over IPC, and plan 07 (wave 3) renders them as a growing list. The IPC tests drive the daemon with an adapter test double that calls `onCandidate`, so this plan does not depend on plan 02. The UI half was split into plan 07 to keep each plan inside the per-plan context budget.
Output: IPC contract and pong capability bump, daemon and fetch-client streaming, the no-re-query-after-rows rule, and the SYSTEM_DESIGN IPC paragraph.

Runs in wave 2 beside plans 02 and 06 (no shared files). This plan does not stage any `.wolf/` file (parallel wave): list the OpenWolf entries in the SUMMARY under "OpenWolf entries for plan 08".
</objective>

<assumption_delta_decision>
- Detector: `assumption-delta scan 09.1` fired `pluralization` on the word "also" in the ROADMAP scope ("This also fixes the deferred bug"). That sentence is not itself a generalization. The real singular-to-plural seam in this phase is here: one `candidates` reply becomes many `candidate` messages plus a done signal.
- Primary noun: the streamed candidate row (`{kind:'candidate', candidate}`), validated by the same commandCandidateSchema as the list.
- Decision: add-alongside. `{kind:'candidates'}` stays as the done signal and the authoritative final list, because an older installed client (the Homebrew build can lag the dev daemon, cerebrum 2026-10-10) never sends `stream: true` and must keep getting one reply; streaming is opt-in per request.
- Accepted debt: rows travel in two message kinds. A later promote (only `candidate` messages plus a bare done message) becomes possible once no supported client lacks `stream` support; it would need its own pong flag.
- Invariant test (included in Task 1): for a streaming request, every `candidate` message precedes the `candidates` message, and the streamed rows match the first rows of the final list when the adapter streams them in order.
</assumption_delta_decision>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-CONTEXT.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-PATTERNS.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-01-SUMMARY.md
@src/contracts/ipc.ts
@src/daemon/server.ts
@src/daemon/bootstrap.ts
@src/daemon/fetch-client.ts

`.planning/phases/09.1-provider-latency-and-cancellation/09.1-RESEARCH.md` is 72 KB: read only the sections each task's `<read_first>` names (find them with `grep -n '^##' 09.1-RESEARCH.md`), not the whole file. This keeps the plan inside the per-plan context budget.

Project rules: check `.wolf/anatomy.md` before reading files and `.wolf/cerebrum.md` before writing code (Do-Not-Repeat: capability bump for IPC shape changes; daemon resolution throws stay inside the promise chain; client-result.test.ts fs mock is narrow). Read `.wolf/buglog.json` before fixing a failure. Do not stage `.wolf/` files in this plan. Targeted tests use `pnpm exec vitest run tests/x.test.ts`. RED commits need throw-on-call stubs so `tsc --noEmit` passes. Lint changed files with `pnpm exec biome check <files>` before staging. Commit subjects start lowercase, no Co-Authored-By trailer. Fix, don't delete.
</context>

## Artifacts this phase produces

Shared contract for all eight plans; this plan creates the rows marked 03.

| Kind | Name | Where | Plan |
|---|---|---|---|
| file (new) | `src/providers/stream-json.ts` | provider layer | 01 (06 enforces the carry cap) |
| file (new) | `src/providers/claude-process.ts` | provider layer | 01 (06 adds the caps, the post-result backstop and the `backstopMs`/`killGraceMs` options; 05 adds the `child` option) |
| file (new) | `src/providers/candidate-stream.ts` | provider layer | 02 |
| file (new) | `src/providers/claude-prewarm.ts` | provider layer | 05 |
| file (new) | `tests/fixtures/fake-claude-stream.mjs` | real child replaying recorded stream-json | 01 (`success`, `auth`, `sigterm-slow`); 06 adds `hang-after-result`, `exit-no-result`, `die-before-init`, `stderr-flood`; 05 adds `ignore-eof` |
| file (new) | `tests/claude-process.test.ts` | tests | 01 (06 and 05 extend it) |
| file (new) | `tests/claude-stream-json.test.ts` | tests | 06 |
| file (new) | `tests/candidate-stream.test.ts` | tests | 02 |
| file (new) | `tests/claude-prewarm.test.ts`, `tests/claude-cli-prewarm.test.ts` | tests | 05 |
| file (new, planning) | `.planning/phases/09.1-provider-latency-and-cancellation/COVERAGE.md` | API coverage matrix | planning |
| type | `FetchOptions { signal?: AbortSignal; onCandidate?: (candidate: CommandCandidate) => void }` | `src/providers/provider.ts` | 01 |
| signature | `LLMAdapter.fetchCandidates(envelope, options?: FetchOptions)` | `src/providers/provider.ts` | 01 |
| function | `abortError()`, `isAbortError(error)` | `src/providers/provider.ts` | 01 |
| schema/type | `streamJsonResultSchema`, `StreamJsonResult` | `src/providers/stream-json.ts` | 01 |
| function | `createLineParser(onEvent, options?)`, `textDeltaOf(event)`, `isInitEvent(event)`, `buildStreamJsonUserLine(prompt)` | `src/providers/stream-json.ts` | 01 |
| option | `createLineParser` options `maxCarryBytes`, `onOverflow` | `src/providers/stream-json.ts` | 06 |
| const | `STREAM_JSON_CARRY_CAP_BYTES` = 1 MiB | `src/providers/stream-json.ts` | 01 declares it, 06 enforces it |
| const | `SIGKILL_GRACE_MS` = 1500, `POST_RESULT_BACKSTOP_MS` = 2000, `STDERR_CAP_BYTES` = 64 KiB | `src/providers/claude-process.ts` | 01 declares them; 06 arms the backstop and enforces the stderr cap |
| type | `ClaudeTurnOptions`, `ClaudeTurnStage`, `ClaudeTurnStageDetail`, `ClaudeTurnFailure`, `ClaudeTurnFailureReason` | `src/providers/claude-process.ts` | 01 |
| option | `ClaudeTurnOptions.backstopMs`, `ClaudeTurnOptions.killGraceMs` | `src/providers/claude-process.ts` | 06 |
| option | `ClaudeTurnOptions.child` (run the turn on a prewarmed child) | `src/providers/claude-process.ts` | 05 |
| function | `spawnClaudeChild(command, argv, cwd, env?)`, `terminateChild(child, graceMs?)`, `runClaudeTurn(options)` | `src/providers/claude-process.ts` | 01 |
| const/function | `CLAUDE_COMMAND` = `'claude'`, `buildClaudeCliArgv(envelope)` | `src/providers/claude-cli.ts` | 01 |
| signature | `fetchClaudeCliCandidates(envelope, remainingBudgetMs, options?)` | `src/providers/claude-cli.ts` | 01 |
| claude flags | `--input-format stream-json`, `--output-format stream-json`, `--verbose`, `--include-partial-messages` | claude argv | 01 |
| claude flag | `--effort <level>` | claude argv | 02 |
| const/type/function | `EFFORT_LEVELS`, `Effort`, `DEFAULT_EFFORT` = `'low'`, `resolveEffort()`, `ResolvedQqConfig.effort` | `src/shared/qq-config.ts` | 02 |
| config key | `effort` in `~/.config/qq/config.json` | qq-config, README, `docs/config.example.json` | 02 |
| const/function | `MAX_STREAMED_CANDIDATES` = 5, `createCandidateScanner(onCandidate)`, `parseStrictCandidateList(text)` | `src/providers/candidate-stream.ts` | 02 |
| IPC request field | `fetch-candidates.stream: z.literal(true).optional()` | `src/contracts/ipc.ts` | 03 |
| IPC response kind | `{ kind: 'candidate', candidate: commandCandidateSchema }` | `src/contracts/ipc.ts` | 03 |
| pong flag | `streamCandidates: true` | `ipc.ts`, `server.ts`, `bootstrap.ts` | 03 |
| signature | `requestDaemonFetch(socketPath, envelope, timeoutMs?, options?)`, `fetchCandidatesForUi(socketPath, envelope, options?)` | `src/daemon/fetch-client.ts` | 01 (03 adds `onCandidate` forwarding and the no-re-query-after-rows rule) |
| type | `CandidateListState` = `'arriving' \| 'complete' \| 'partial'` | `src/ui/modal-layout.ts` | 07 |
| const | `LIST_STATUS_ROW_LINES` = 1, `INCOMPLETE_LIST_NOTE` = `'list may be incomplete'` | `src/ui/modal-layout.ts` | 07 |
| field/prop | `CandidateSelectLayoutInput.listState`; `CandidateSelect` prop `listState` (default `'complete'`) | `modal-layout.ts`, `CandidateSelect.tsx` | 07 |
| function/const | `sdkOutputConfig(model, effort)`, `EFFORT_UNSUPPORTED_MODEL_RE` | `src/providers/claude.ts` | 04 |
| signature | SDK `fetchCandidates(envelope, rbuffer = '', timeoutMs = 25_000, options: FetchOptions = {})`; `claudeAdapter` forwards `options` | `src/providers/claude.ts` | 04 |
| test marker | `'messages.stream('` in the adapters (b) model-call list | `tests/steering.test.ts` | 04 |
| type | `PrewarmSpec { command, argv, cwd }`, `PrewarmMissReason` = `'disabled' \| 'empty' \| 'dead' \| 'cwd' \| 'prompt'`, `PrewarmTake` = `{ child } \| { miss }` | `src/providers/claude-prewarm.ts` | 05 |
| function | `prewarmKey(spec)`, `enablePrewarm()`, `disablePrewarm()`, `takePrewarmed(spec)`, `schedulePrewarm(spec)`, `retirePrewarmed()`, `prewarmSnapshot()` | `src/providers/claude-prewarm.ts` | 05 |
| debug-log stages | provider `cli spawned`, `cli init`, `cli first delta`, `cli result`, `cli exit`, `cli aborted`, `cli timed out`, `claude-cli aborted`; daemon `fetch aborted`; client `fetch aborted` | debug log | 01 |
| debug-log stages | provider `cli first candidate` (02); daemon `replied candidate` (03); provider `request aborted` (04); provider `prewarm hit`, `prewarm miss`, `prewarm spawned`, `prewarm retired`, `prewarm retry cold` (05); client `first candidate received`, `llm request failed after rows` (07) | debug log | 02-05, 07 |
| qq CLI flags | none added | — | — |

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: The daemon streams each candidate to a stream:true client; old clients still get one reply</name>
  <reversibility rating="costly">An IPC shape change: undoing it means removing the `candidate` kind and bumping the pong flag again so stale daemons are replaced. Gated by the `streamCandidates` pong flag and the opt-in `stream` request field, so no installed client breaks.</reversibility>
  <files>src/contracts/ipc.ts, src/daemon/server.ts, src/daemon/bootstrap.ts, src/daemon/fetch-client.ts, docs/SYSTEM_DESIGN.md, tests/daemon-fetch.test.ts, tests/daemon-bootstrap.test.ts</files>
  <read_first>
    - src/contracts/ipc.ts, src/contracts/candidates.ts
    - src/daemon/server.ts and src/daemon/fetch-client.ts as changed by plan 01 (connectionAbort, FetchOptions)
    - src/daemon/bootstrap.ts (lines 90-110, the `current` capability check)
    - .planning/phases/09.1-provider-latency-and-cancellation/09.1-RESEARCH.md (Pattern 4, Probe 9 zod strip semantics, Pitfall 7)
    - tests/daemon-fetch.test.ts (resolver mock with fetchMock), tests/daemon-bootstrap.test.ts (pong fixtures at lines ~80-160 and the ping test at ~222-250)
    - docs/SYSTEM_DESIGN.md (IPC paragraph near line 199)
  </read_first>
  <behavior>
    - Raw socket client sends `{kind:'fetch-candidates', envelope, stream:true}`; the adapter double calls `options.onCandidate(a)`, `options.onCandidate(b)` and resolves `[a, b]`: the response kinds are exactly `fetch-accepted`, `candidate`, `candidate`, `candidates`, and the two `candidate` payloads equal `a` and `b` in order (the invariant from the assumption-delta block).
    - requestDaemonFetch with `onCandidate` records `[a, b]` before it resolves with `[a, b]`.
    - A request without `stream`: kinds are exactly `fetch-accepted`, `candidates`, and the adapter received `options.onCandidate === undefined`.
    - `ping` → the pong has `fetchCandidates: true`, `installedTools: true`, `streamCandidates: true`.
    - ensureDaemon replaces a live listener whose pong has `fetchCandidates` and `installedTools` but no `streamCandidates`, and keeps one whose pong has all three.
    - After the client destroys its socket, a later `options.onCandidate(c)` call inside the adapter does not throw and nothing is written.
    - A `candidate` whose explanation contains `ⓘ` arrives intact through requestDaemonFetch.
    - A `candidate` message with an empty command makes requestDaemonFetch reject with IpcTransportError (zod), as any malformed response does today.
  </behavior>
  <action>
Implement RESEARCH Pattern 4 (D-05).

1. `src/contracts/ipc.ts`: the `fetch-candidates` request gains `stream: z.literal(true).optional()` (comment: the client wants one `candidate` message per parsed row before the final `candidates`; Phase 09.1). The response union gains `z.object({ kind: z.literal('candidate'), candidate: commandCandidateSchema })`. The pong gains `streamCandidates: z.literal(true).optional()` with a comment in the style of the `installedTools` line. Keep `candidates` unchanged: it is the done signal and the authoritative final list.

2. `src/daemon/server.ts`: the pong also carries `streamCandidates: true`. In `fetch-candidates`, build `onCandidate` only when `req.stream === true`: it returns without writing when `connectionAbort.signal.aborted`, skips any value that fails commandCandidateSchema.safeParse (defence in depth), writes `{ kind: 'candidate', candidate }`, and logs `appendDebugLog('daemon', 'replied candidate', { index })` with no command text. Pass `{ signal: connectionAbort.signal, onCandidate }` to the adapter. Update the doc comment's request table (`fetch-candidates` → `fetch-accepted`, then `candidate` × N when `stream: true`, then `candidates` | `fetch-error`; aborted on socket close).

3. `src/daemon/bootstrap.ts`: the `current` check also requires `response.data.streamCandidates === true`; update its comment and any stale-daemon log text that lists the required flags.

4. `src/daemon/fetch-client.ts`: write `{ kind: 'fetch-candidates', envelope, stream: true }`. Call `client.setEncoding('utf8')` and append the string chunks directly, so a multi-byte character split across socket reads stays intact. In handleResponse, a `candidate` response sets `accepted = true`, clears the ack timer and calls `options.onCandidate?.(response.data.candidate)`, then returns without settling.

5. `docs/SYSTEM_DESIGN.md`: in the daemon IPC paragraph, describe `fetch-candidates` with `stream: true` → `candidate` messages then `candidates`; the `streamCandidates` pong flag; and the abort when the client closes the socket.

6. Tests per `<behavior>`. Update the existing bootstrap fixtures and the ping assertion to the three-flag pong.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/daemon-fetch.test.ts tests/daemon-bootstrap.test.ts</automated>
    <fails_when>non-zero exit, a "FAIL" line in the vitest output, or "No test files found"</fails_when>
    <automated>pnpm typecheck</automated>
    <fails_when>non-zero exit or any "error TS" line</fails_when>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run tests/daemon-fetch.test.ts tests/daemon-bootstrap.test.ts` exits 0
    - `pnpm typecheck` exits 0
    - `grep -c "streamCandidates" src/contracts/ipc.ts` is at least 1, `grep -c "streamCandidates: true" src/daemon/server.ts` is at least 1, `grep -c "streamCandidates === true" src/daemon/bootstrap.ts` is at least 1
    - `grep -c "kind: z.literal('candidate')" src/contracts/ipc.ts` is at least 1
    - `grep -c "stream: true" src/daemon/fetch-client.ts` is at least 1 and `grep -c "setEncoding('utf8')" src/daemon/fetch-client.ts` is at least 1
    - `grep -c "req.stream === true" src/daemon/server.ts` is at least 1
  </acceptance_criteria>
  <done>A `stream: true` client receives each candidate as its own message before the final list, a client without the flag sees no change, and stale daemons are replaced through the `streamCandidates` pong flag.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: After rows have arrived, a dropped daemon connection is not re-queried in-process</name>
  <files>src/daemon/fetch-client.ts, tests/daemon-fetch.test.ts</files>
  <read_first>
    - src/daemon/fetch-client.ts (as changed by plan 01 and Task 1: abort listener, `candidate` forwarding, and the IpcTransportError fallback in fetchCandidatesForUi, which today re-queries in-process on any transport error)
    - .planning/phases/09.1-provider-latency-and-cancellation/09.1-CONTEXT.md (D-16)
    - tests/daemon-fetch.test.ts (resolver mock with fetchMock; the raw-socket helpers added in Task 1)
  </read_first>
  <behavior>
    - fetchCandidatesForUi against a test listener that writes `fetch-accepted` and one `candidate` and then destroys the connection: onCandidate received that row once, the promise rejects with IpcTransportError, and the in-process adapter (resolver mock) was never called.
    - The same listener destroying the connection right after `fetch-accepted`, before any `candidate`: falls back to the in-process adapter with the same options, as today.
    - No listener at the socket path: falls back to the in-process adapter, as today.
    - With the signal aborted, a transport error rejects with an AbortError and no fallback (plan 01 behaviour kept).
  </behavior>
  <action>
Implement the transport half of D-16.

1. `src/daemon/fetch-client.ts`: fetchCandidatesForUi counts the candidates it forwards to `options.onCandidate` (wrap the callback it hands to requestDaemonFetch). On IpcTransportError it throws abortError() when the signal is aborted, rethrows the transport error when at least one candidate was forwarded (an in-process re-query would duplicate the rows already on screen and pay a second cold provider call), and otherwise falls back to the in-process adapter as today. Plan 07 turns that rejection into the `partial` list on screen.

2. Tests per `<behavior>` in tests/daemon-fetch.test.ts, with a small `net.createServer` on a temp socket path that writes the scripted messages (or the Task 1 raw-socket helpers if they fit). Close every listener in afterEach.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/daemon-fetch.test.ts tests/daemon-bootstrap.test.ts</automated>
    <fails_when>non-zero exit, a "FAIL" line in the vitest output, or "No test files found"</fails_when>
    <automated>pnpm test:run && pnpm typecheck && pnpm lint</automated>
    <fails_when>non-zero exit from any of the three commands, or a "FAIL" line in the vitest output</fails_when>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run tests/daemon-fetch.test.ts tests/daemon-bootstrap.test.ts` exits 0
    - `pnpm test:run && pnpm typecheck && pnpm lint` exits 0
    - tests/daemon-fetch.test.ts has a case in which the resolver mock's fetchCandidates is asserted `not.toHaveBeenCalled()` after a candidate arrived and the connection dropped
  </acceptance_criteria>
  <done>A connection lost after rows arrived rejects without a duplicate in-process query, a connection lost before any row still falls back as today, and the whole suite is green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| daemon → client Unix socket | Streamed rows cross a local IPC boundary into the UI and then the shell buffer |
| client fetch → in-process provider | A transport failure can trigger a second, in-process provider call |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-09.1-09 | Tampering | `candidate` IPC message | low | mitigate | Server re-validates each row with commandCandidateSchema before writing; client parses every message with ipcResponseSchema (zod) and rejects a malformed one as IpcTransportError (test) |
| T-09.1-10 | Spoofing | unauthenticated daemon socket (pre-existing CR-005) | low | accept | No new request kind; `stream` only changes the reply shape for the same request. Socket authentication stays tracked as CR-005 in server.ts |
| T-09.1-11 | Tampering | rows the provider reports after the client left | low | mitigate | The daemon's onCandidate writes nothing once the connection's AbortSignal has fired (test: onCandidate after the client destroyed its socket neither throws nor writes); the client-side guard is T-09.1-23 in plan 07 |
| T-09.1-24 | Denial of service / cost | in-process re-query after a late transport failure | low | mitigate | fetchCandidatesForUi rethrows instead of falling back once a candidate was forwarded, so a lost daemon connection never starts a second provider call or duplicates rows (Task 2 test) |
| T-09.1-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs in this plan (RESEARCH audit lists none); `package.json` and `pnpm-lock.yaml` unchanged by this plan's commits |
</threat_model>

<verification>
- `pnpm test:run && pnpm typecheck && pnpm lint` exits 0 at the end of the plan.
- `git diff --stat <plan-base-sha>..HEAD -- package.json pnpm-lock.yaml .wolf src/client src/ui` is empty (no dependency changes, no `.wolf/` commits in a parallel wave, and the client UI is left to plan 07).
</verification>

<success_criteria>
- D-05 streaming IPC with the pong capability bump: a `stream: true` client receives each candidate before the final list, an old client sees no change, and stale daemons are replaced.
- D-14 holds on the daemon side and D-16 on the transport side: nothing is written after the client leaves, and no in-process re-query follows a late transport failure.
</success_criteria>

<output>
Create `.planning/phases/09.1-provider-latency-and-cancellation/09.1-03-SUMMARY.md` when done, with "OpenWolf entries for plan 08" (anatomy lines for ipc.ts, server.ts, bootstrap.ts, fetch-client.ts, docs/SYSTEM_DESIGN.md and the changed tests; cerebrum lines: `streamCandidates` is the third pong flag; `candidates` stays the done signal and the authoritative list; fetchCandidatesForUi never re-queries in-process after a row arrived).
</output>


#### .planning/phases/09.1-provider-latency-and-cancellation/09.1-04-PLAN.md
---
phase: 09.1-provider-latency-and-cancellation
plan: 04
type: execute
wave: 3
depends_on: [09.1-01, 09.1-02]
coupling_justified: ["09.1-05: this plan edits only the SDK-path tests in tests/claude-cli-provider.test.ts (an API key is present, so claude-cli.ts never runs in them) and leaves the CLI-path tests untouched; plan 05 changes claude-cli.ts and runs that test file against it in its own verify; outside the daemon the prewarm pool is disabled (asserted in tests/claude-prewarm.test.ts), so claude-cli.ts behaves for these tests as before, and plan 01's stage-log assertion only reads `cli ` lines; either merge order gives the same result, and plan 08 runs the full suite on the merge"]
files_modified:
  - src/providers/claude.ts
  - src/providers/claude-default.ts
  - tests/claude-provider.test.ts
  - tests/claude-cli-provider.test.ts
  - tests/steering.test.ts
  - README.md
  - docs/EXTENSIONS.md
autonomous: true
requirements: [D-03, D-05, D-13]

estimate:
  tokens: 70000
  raw_tokens: 70000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "D-03: the API-key SDK path reads the same `effort` setting (resolveEffort, default `low`) and sends it as `output_config: { effort }` on the `claude-sonnet-5` request; the model stays DEFAULT_MODEL `claude-sonnet-5` (or QQ_MODEL)"
    - "D-03: no `thinking` key and no sampling parameters are sent (adaptive thinking by omission on Sonnet 5; sampling parameters 400 on this model, cerebrum 2026-07-30)"
    - "D-03 guard: when QQ_MODEL names a model that rejects effort (Haiku 4.5, Sonnet 4.5 or an older id), `output_config` is omitted instead of letting the request 400"
    - "D-13: the SDK request receives the AbortSignal (`{ timeout, signal }` request options); an abort rejects with an AbortError that claudeDefaultAdapter passes through unmapped, so the daemon writes nothing"
    - "D-05: on the SDK path each candidate is parsed out of the streamed text as it arrives and handed to `options.onCandidate` in order, like the `claude -p` path; the final list uses the same strict-parse, then streamed rows, then parseCandidates rule"
    - "09 D-18 guard still covers the SDK file: tests/steering.test.ts treats `messages.stream(` as a model-call marker"
  artifacts:
    - path: "src/providers/claude.ts"
      provides: "streaming SDK request with effort, abort signal and incremental candidates; sdkOutputConfig and EFFORT_UNSUPPORTED_MODEL_RE"
      contains: "messages.stream("
    - path: "tests/steering.test.ts"
      provides: "adapter scan marker for messages.stream("
      contains: "messages.stream("
  key_links:
    - from: "src/providers/claude-default.ts"
      to: "src/providers/claude.ts"
      via: "SDK branch passes options: fetchSdkCandidates(envelope, '', remainingMs(deadline), options)"
      pattern: "remainingMs\\(deadline\\), options"
    - from: "src/providers/claude.ts"
      to: "src/shared/qq-config.ts"
      via: "sdkOutputConfig(model, resolveEffort())"
      pattern: "resolveEffort\\(\\)"
    - from: "src/providers/claude.ts"
      to: "src/providers/candidate-stream.ts"
      via: "stream text listener feeds createCandidateScanner"
      pattern: "createCandidateScanner\\("
---

<objective>
Bring the API-key SDK path to parity with the `claude -p` path: the same effort setting (D-03), a real abort through the request's AbortSignal (D-13), and candidates streamed to `options.onCandidate` as they parse (D-05).

Purpose: users with ANTHROPIC_API_KEY take the SDK path, and today Esc cannot cancel their request. This dev machine has no API key, so this path is proven by tests only (D-03 accepts that); the effort mapping follows the SDK 0.92.0 types and the claude-api skill's Thinking & Effort table (RESEARCH Pattern 7, assumption A4).
Output: `src/providers/claude.ts` on `messages.stream` with `finalMessage()`, `sdkOutputConfig`, the claude-default pass-through, the steering-guard marker, and adapter docs.

Runs in wave 3 beside plans 05 and 07 (no shared files). Plan 05 changes claude-cli.ts, which other tests in tests/claude-cli-provider.test.ts exercise; that coupling is declared in `coupling_justified`: keep this plan's edits to that file on the SDK-path tests and the AnthropicMock. This plan does not stage any `.wolf/` file: list OpenWolf entries in the SUMMARY under "OpenWolf entries for plan 08".
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-CONTEXT.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-RESEARCH.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-01-SUMMARY.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-02-SUMMARY.md
@src/providers/claude.ts
@src/providers/claude-default.ts
@src/providers/candidate-stream.ts
@src/shared/qq-config.ts

Project rules: check `.wolf/anatomy.md` before reading files and `.wolf/cerebrum.md` before writing code (Do-Not-Repeat 2026-07-30: no sampling parameters on the Messages API; every adapter builds its system prompt with buildSystemPrompt(envelope)). Read `.wolf/buglog.json` before fixing a failure. Do not stage `.wolf/` files in this plan. Targeted tests use `pnpm exec vitest run tests/x.test.ts`. RED commits need throw-on-call stubs so `tsc --noEmit` passes. Lint changed files with `pnpm exec biome check <files>` before staging. Commit subjects start lowercase (commitlint rejects a leading acronym such as "SDK ..."), no Co-Authored-By trailer. Fix, don't delete.

SDK facts this plan relies on (verified in RESEARCH against node_modules/@anthropic-ai/sdk 0.92.0): `MessageCreateParams.output_config?: { effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | null }`; request options accept `signal` and `timeout` (milliseconds); `client.messages.stream(params, options)` returns a MessageStream with `.on('text', delta => …)` and `.finalMessage()`, which throws `APIUserAbortError` ("Request was aborted.") on abort. A raw streaming create iterator ends silently on abort, so it is not used.
</context>

## Artifacts this phase produces

Shared contract for all eight plans; this plan creates the rows marked 04.

| Kind | Name | Where | Plan |
|---|---|---|---|
| file (new) | `src/providers/stream-json.ts` | provider layer | 01 (06 enforces the carry cap) |
| file (new) | `src/providers/claude-process.ts` | provider layer | 01 (06 adds the caps, the post-result backstop and the `backstopMs`/`killGraceMs` options; 05 adds the `child` option) |
| file (new) | `src/providers/candidate-stream.ts` | provider layer | 02 |
| file (new) | `src/providers/claude-prewarm.ts` | provider layer | 05 |
| file (new) | `tests/fixtures/fake-claude-stream.mjs` | real child replaying recorded stream-json | 01 (`success`, `auth`, `sigterm-slow`); 06 adds `hang-after-result`, `exit-no-result`, `die-before-init`, `stderr-flood`; 05 adds `ignore-eof` |
| file (new) | `tests/claude-process.test.ts` | tests | 01 (06 and 05 extend it) |
| file (new) | `tests/claude-stream-json.test.ts` | tests | 06 |
| file (new) | `tests/candidate-stream.test.ts` | tests | 02 |
| file (new) | `tests/claude-prewarm.test.ts`, `tests/claude-cli-prewarm.test.ts` | tests | 05 |
| file (new, planning) | `.planning/phases/09.1-provider-latency-and-cancellation/COVERAGE.md` | API coverage matrix | planning |
| type | `FetchOptions { signal?: AbortSignal; onCandidate?: (candidate: CommandCandidate) => void }` | `src/providers/provider.ts` | 01 |
| signature | `LLMAdapter.fetchCandidates(envelope, options?: FetchOptions)` | `src/providers/provider.ts` | 01 |
| function | `abortError()`, `isAbortError(error)` | `src/providers/provider.ts` | 01 |
| schema/type | `streamJsonResultSchema`, `StreamJsonResult` | `src/providers/stream-json.ts` | 01 |
| function | `createLineParser(onEvent, options?)`, `textDeltaOf(event)`, `isInitEvent(event)`, `buildStreamJsonUserLine(prompt)` | `src/providers/stream-json.ts` | 01 |
| option | `createLineParser` options `maxCarryBytes`, `onOverflow` | `src/providers/stream-json.ts` | 06 |
| const | `STREAM_JSON_CARRY_CAP_BYTES` = 1 MiB | `src/providers/stream-json.ts` | 01 declares it, 06 enforces it |
| const | `SIGKILL_GRACE_MS` = 1500, `POST_RESULT_BACKSTOP_MS` = 2000, `STDERR_CAP_BYTES` = 64 KiB | `src/providers/claude-process.ts` | 01 declares them; 06 arms the backstop and enforces the stderr cap |
| type | `ClaudeTurnOptions`, `ClaudeTurnStage`, `ClaudeTurnStageDetail`, `ClaudeTurnFailure`, `ClaudeTurnFailureReason` | `src/providers/claude-process.ts` | 01 |
| option | `ClaudeTurnOptions.backstopMs`, `ClaudeTurnOptions.killGraceMs` | `src/providers/claude-process.ts` | 06 |
| option | `ClaudeTurnOptions.child` (run the turn on a prewarmed child) | `src/providers/claude-process.ts` | 05 |
| function | `spawnClaudeChild(command, argv, cwd, env?)`, `terminateChild(child, graceMs?)`, `runClaudeTurn(options)` | `src/providers/claude-process.ts` | 01 |
| const/function | `CLAUDE_COMMAND` = `'claude'`, `buildClaudeCliArgv(envelope)` | `src/providers/claude-cli.ts` | 01 |
| signature | `fetchClaudeCliCandidates(envelope, remainingBudgetMs, options?)` | `src/providers/claude-cli.ts` | 01 |
| claude flags | `--input-format stream-json`, `--output-format stream-json`, `--verbose`, `--include-partial-messages` | claude argv | 01 |
| claude flag | `--effort <level>` | claude argv | 02 |
| const/type/function | `EFFORT_LEVELS`, `Effort`, `DEFAULT_EFFORT` = `'low'`, `resolveEffort()`, `ResolvedQqConfig.effort` | `src/shared/qq-config.ts` | 02 |
| config key | `effort` in `~/.config/qq/config.json` | qq-config, README, `docs/config.example.json` | 02 |
| const/function | `MAX_STREAMED_CANDIDATES` = 5, `createCandidateScanner(onCandidate)`, `parseStrictCandidateList(text)` | `src/providers/candidate-stream.ts` | 02 |
| IPC request field | `fetch-candidates.stream: z.literal(true).optional()` | `src/contracts/ipc.ts` | 03 |
| IPC response kind | `{ kind: 'candidate', candidate: commandCandidateSchema }` | `src/contracts/ipc.ts` | 03 |
| pong flag | `streamCandidates: true` | `ipc.ts`, `server.ts`, `bootstrap.ts` | 03 |
| signature | `requestDaemonFetch(socketPath, envelope, timeoutMs?, options?)`, `fetchCandidatesForUi(socketPath, envelope, options?)` | `src/daemon/fetch-client.ts` | 01 (03 adds `onCandidate` forwarding and the no-re-query-after-rows rule) |
| type | `CandidateListState` = `'arriving' \| 'complete' \| 'partial'` | `src/ui/modal-layout.ts` | 07 |
| const | `LIST_STATUS_ROW_LINES` = 1, `INCOMPLETE_LIST_NOTE` = `'list may be incomplete'` | `src/ui/modal-layout.ts` | 07 |
| field/prop | `CandidateSelectLayoutInput.listState`; `CandidateSelect` prop `listState` (default `'complete'`) | `modal-layout.ts`, `CandidateSelect.tsx` | 07 |
| function/const | `sdkOutputConfig(model, effort)`, `EFFORT_UNSUPPORTED_MODEL_RE` | `src/providers/claude.ts` | 04 |
| signature | SDK `fetchCandidates(envelope, rbuffer = '', timeoutMs = 25_000, options: FetchOptions = {})`; `claudeAdapter` forwards `options` | `src/providers/claude.ts` | 04 |
| test marker | `'messages.stream('` in the adapters (b) model-call list | `tests/steering.test.ts` | 04 |
| type | `PrewarmSpec { command, argv, cwd }`, `PrewarmMissReason` = `'disabled' \| 'empty' \| 'dead' \| 'cwd' \| 'prompt'`, `PrewarmTake` = `{ child } \| { miss }` | `src/providers/claude-prewarm.ts` | 05 |
| function | `prewarmKey(spec)`, `enablePrewarm()`, `disablePrewarm()`, `takePrewarmed(spec)`, `schedulePrewarm(spec)`, `retirePrewarmed()`, `prewarmSnapshot()` | `src/providers/claude-prewarm.ts` | 05 |
| debug-log stages | provider `cli spawned`, `cli init`, `cli first delta`, `cli result`, `cli exit`, `cli aborted`, `cli timed out`, `claude-cli aborted`; daemon `fetch aborted`; client `fetch aborted` | debug log | 01 |
| debug-log stages | provider `cli first candidate` (02); daemon `replied candidate` (03); provider `request aborted` (04); provider `prewarm hit`, `prewarm miss`, `prewarm spawned`, `prewarm retired`, `prewarm retry cold` (05); client `first candidate received`, `llm request failed after rows` (07) | debug log | 02-05, 07 |
| qq CLI flags | none added | — | — |

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: The SDK request streams, honours the abort signal and hands candidates over as they parse</name>
  <files>src/providers/claude.ts, src/providers/claude-default.ts, tests/claude-provider.test.ts, tests/claude-cli-provider.test.ts, tests/steering.test.ts</files>
  <read_first>
    - src/providers/claude.ts (fetchCandidates at lines 152-205, claudeAdapter at 207-209, extractText, parseCandidates, ensureSelectableCandidates)
    - src/providers/claude-default.ts (SDK branch at lines 91-96, as changed by plan 01)
    - src/providers/candidate-stream.ts (plan 02), src/providers/provider.ts (FetchOptions, abortError, isAbortError)
    - .planning/phases/09.1-provider-latency-and-cancellation/09.1-RESEARCH.md (Pattern 7, "SDK 0.92.0" notes, Pitfall 6, Alternatives row on the raw streaming iterator)
    - tests/claude-provider.test.ts and tests/claude-cli-provider.test.ts (AnthropicMock with `messages.create` only)
    - tests/steering.test.ts (adapters (b) at line ~242)
  </read_first>
  <behavior>
    - The SDK mock gains `messages.stream`, returning a fake stream object that records `.on('text', cb)` listeners and whose `finalMessage()` resolves `{ content: [{ type: 'text', text }] }` after the test has emitted text pieces.
    - fetchCandidates calls `messages.stream` once with `model`, `max_tokens: 1024`, `system: buildSystemPrompt(envelope)` and the user prompt, and with request options `{ timeout: timeoutMs, signal }` where `signal` is the one passed in options.
    - Text pieces of the recorded two-candidate answer reach `options.onCandidate` in order before fetchCandidates resolves; the resolved list is the strict parse of the final text.
    - A final text that fails the strict parse after two candidates streamed resolves to those two; a prose final text with nothing streamed resolves to parseCandidates' fallback (unchanged behaviour); the existing malformed-JSON test stays green.
    - Abort: `finalMessage()` rejects with an error whose `name` is `'APIUserAbortError'` after the test aborts the signal → fetchCandidates rejects with isAbortError true, the debug log has `request aborted` and not `request failed`, and claudeDefaultAdapter (with an API key present) rejects with that AbortError unmapped.
    - The request object has no `thinking`, `temperature`, `top_p` or `top_k` key.
    - claudeAdapter.fetchCandidates(envelope, options) forwards options (onCandidate is called).
    - The existing SDK-path tests in claude-provider.test.ts and claude-cli-provider.test.ts (QQ_MODEL, .env.local fallback, client reuse, steering in the system prompt only, no spawn when a key exists) pass against the stream mock.
    - tests/steering.test.ts adapters (b) includes `messages.stream(` and still passes.
  </behavior>
  <action>
1. `src/providers/claude.ts`: change the signature to `fetchCandidates(envelope, rbuffer = '', timeoutMs = 25_000, options: FetchOptions = {})`. Replace the single-shot Messages request (lines 176-186) with `client.messages.stream({ model, max_tokens: 1024, system: buildSystemPrompt(envelope), messages: [{ role: 'user', content: prompt }] }, { timeout: timeoutMs, signal: options.signal })` (RESEARCH Pattern 7; keep `buildSystemPrompt(envelope)` literally in this file for the steering guard). When `options.onCandidate` is set, create a scanner with createCandidateScanner whose callback records the row in a local `streamed` array and calls `options.onCandidate` only while the signal is not aborted, and register it with the stream's `text` listener. Await `stream.finalMessage()`, take its text with extractText, and build the list with the same rule as claude-cli (parseStrictCandidateList, else the streamed rows when any, else parseCandidates), then ensureSelectableCandidates. In the catch, when `isAbortError(error)` or `options.signal?.aborted`, log `appendDebugLog('provider', 'request aborted', { model })` and throw abortError(); otherwise keep today's `request failed` log and re-throw. Send no `thinking` key and no sampling parameters. Change claudeAdapter to `{ fetchCandidates: (envelope, options) => fetchCandidates(envelope, '', 25_000, options) }` so it matches the LLMAdapter signature.

2. `src/providers/claude-default.ts`: the SDK branch passes `options` as the fourth argument (`fetchSdkCandidates(envelope, '', remainingMs(deadline), options)`). Abort errors pass through unmapped, as on the CLI branch.

3. `tests/steering.test.ts`: add `'messages.stream('` to the `modelCalls` list in adapters (b), so the guard keeps covering the SDK file after the switch (Pitfall 6).

4. Tests per `<behavior>`: add `stream` to both AnthropicMock classes and move every SDK-path assertion from the create mock to the stream mock. Keep each existing test's intent.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/claude-provider.test.ts tests/claude-cli-provider.test.ts tests/steering.test.ts</automated>
    <fails_when>non-zero exit, a "FAIL" line in the vitest output, or "No test files found"</fails_when>
    <automated>pnpm typecheck</automated>
    <fails_when>non-zero exit or any "error TS" line</fails_when>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run tests/claude-provider.test.ts tests/claude-cli-provider.test.ts tests/steering.test.ts` exits 0
    - `pnpm typecheck` exits 0
    - `grep -c "messages.stream(" src/providers/claude.ts` is at least 1 and `grep -c "messages.create(" src/providers/claude.ts` is 0
    - `grep -c "finalMessage()" src/providers/claude.ts` is at least 1
    - `grep -c "signal: options.signal" src/providers/claude.ts` is at least 1
    - `grep -c "'messages.stream('" tests/steering.test.ts` is at least 1
    - `grep -c "remainingMs(deadline), options" src/providers/claude-default.ts` is at least 1
  </acceptance_criteria>
  <done>The SDK path streams with `finalMessage()`, aborts through the request signal with an unmapped AbortError, emits candidates as they parse, and the steering guard covers the new call.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: The SDK request carries the effort setting, guarded for models without effort</name>
  <files>src/providers/claude.ts, tests/claude-provider.test.ts, README.md, docs/EXTENSIONS.md</files>
  <read_first>
    - src/providers/claude.ts (as changed by Task 1; resolveModel, DEFAULT_MODEL)
    - src/shared/qq-config.ts (resolveEffort, Effort from plan 02)
    - .planning/phases/09.1-provider-latency-and-cancellation/09.1-RESEARCH.md (Pattern 7, Pitfall 5, assumption A4)
    - README.md (the `effort` row added by plan 02), docs/EXTENSIONS.md (Builder rule paragraph, line ~28)
  </read_first>
  <behavior>
    - Default model with no config: the request has `output_config: { effort: 'low' }`.
    - Config file `{"effort":"high"}` (QQ_CONFIG_FILE + resetQqConfigCache): `output_config: { effort: 'high' }`.
    - `QQ_MODEL=claude-haiku-4-5`: the request has no `output_config` key; `QQ_MODEL=claude-sonnet-4-5`: none; `QQ_MODEL=claude-opus-5-5`: `output_config: { effort: 'low' }`.
    - sdkOutputConfig(model, effort) returns `{ effort }` for `claude-sonnet-5` and `claude-opus-5-5` and undefined for `claude-haiku-4-5`, `claude-sonnet-4-5`, `claude-3-7-sonnet-latest` and `claude-sonnet-4-20250514`.
    - The `request start` debug line includes `effort` (the value or `none`) and still matches no FORBIDDEN_DEBUG pattern.
  </behavior>
  <action>
Implement D-03 per RESEARCH Pattern 7.

1. `src/providers/claude.ts`: export `EFFORT_UNSUPPORTED_MODEL_RE`, a case-insensitive regex matching model ids that reject the effort parameter per the claude-api skill's Thinking & Effort table: any Haiku id, Sonnet 4.5, Claude 3.x ids, and the 4.0/4.1 ids (`haiku`, `sonnet-4-5`, `claude-3`, `sonnet-4-0`, `opus-4-0`, `opus-4-1`, and the dated `sonnet-4-2025…` / `opus-4-2025…` forms). Export `sdkOutputConfig(model, effort)` returning undefined when the regex matches, else `{ effort }`. In fetchCandidates compute `const outputConfig = sdkOutputConfig(model, resolveEffort())` and add `output_config: outputConfig` to the stream params only when it is defined. Keep DEFAULT_MODEL `claude-sonnet-5` (Sonnet 5 accepts all five levels and runs adaptive thinking when `thinking` is omitted). Add `effort: outputConfig?.effort ?? 'none'` to the `request start` debug detail.

2. Docs: extend the README `effort` row to say the API-key SDK path sends it as `output_config.effort`, and that it is omitted when QQ_MODEL names a model without effort support (Haiku 4.5, Sonnet 4.5 or older); levels a QQ_MODEL does not support (for example `xhigh` on Opus 4.5) are the user's responsibility. In docs/EXTENSIONS.md, next to the Builder rule, document the adapter options: `fetchCandidates(envelope, options?)`, where `options.signal` must cancel the provider request and reject with an AbortError, and `options.onCandidate` may be called with each schema-valid candidate in order as it parses; the returned list stays the authoritative result.

3. Tests per `<behavior>` in tests/claude-provider.test.ts (isolate config with QQ_CONFIG_FILE in a temp dir and resetQqConfigCache; restore QQ_MODEL after each case).
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/claude-provider.test.ts tests/claude-cli-provider.test.ts</automated>
    <fails_when>non-zero exit, a "FAIL" line in the vitest output, or "No test files found"</fails_when>
    <automated>pnpm test:run && pnpm typecheck && pnpm lint</automated>
    <fails_when>non-zero exit from any of the three commands, or a "FAIL" line in the vitest output</fails_when>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run tests/claude-provider.test.ts tests/claude-cli-provider.test.ts` exits 0
    - `pnpm test:run && pnpm typecheck && pnpm lint` exits 0
    - `grep -c "export function sdkOutputConfig" src/providers/claude.ts` is at least 1 and `grep -c "EFFORT_UNSUPPORTED_MODEL_RE" src/providers/claude.ts` is at least 2
    - `grep -c "resolveEffort()" src/providers/claude.ts` is at least 1
    - `grep -c "export const DEFAULT_MODEL = 'claude-sonnet-5'" src/providers/claude.ts` is at least 1
    - `grep -c "output_config" README.md` is at least 1 and `grep -c "onCandidate" docs/EXTENSIONS.md` is at least 1
  </acceptance_criteria>
  <done>The SDK request sends the configured effort as `output_config.effort` on Sonnet 5, omits it for models that reject it, and the adapter options are documented.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| daemon → Anthropic API (HTTPS via SDK) | Paid request whose lifetime must follow the client |
| model text → candidates | Untrusted streamed text becomes shell-buffer candidates |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-09.1-12 | Denial of service / cost | SDK request after Esc | medium | mitigate | Request options carry the connection AbortSignal; `finalMessage()` raises APIUserAbortError on abort, normalised to an AbortError and not mapped (test) |
| T-09.1-13 | Denial of service | `output_config.effort` on a QQ_MODEL that rejects it (400) | low | mitigate | `sdkOutputConfig` omits the parameter for models matching EFFORT_UNSUPPORTED_MODEL_RE (tests) |
| T-09.1-14 | Tampering | streamed SDK text → onCandidate | high | mitigate | Same scanner and strict final-parse rule as plan 02: every row passes commandCandidateSchema, no prose fallback on partial text |
| T-09.1-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs (the SDK is already pinned at 0.92.0); `package.json` and `pnpm-lock.yaml` unchanged by this plan's commits |
</threat_model>

<verification>
- `pnpm test:run && pnpm typecheck && pnpm lint` exits 0 at the end of the plan.
- `git diff --stat <plan-base-sha>..HEAD -- package.json pnpm-lock.yaml .wolf` is empty.
</verification>

<success_criteria>
- D-03: effort reaches the SDK request on Sonnet 5 and is guarded for models without effort.
- D-13 and D-05 hold on the SDK path, matching the `claude -p` path.
</success_criteria>

<output>
Create `.planning/phases/09.1-provider-latency-and-cancellation/09.1-04-SUMMARY.md` when done, with "OpenWolf entries for plan 08" (anatomy line for claude.ts; cerebrum lines: the SDK path uses `messages.stream` + `finalMessage()` because the raw streaming iterator ends silently on abort; effort goes in `output_config` and is omitted for models matching EFFORT_UNSUPPORTED_MODEL_RE) and a note that the SDK path is test-only on the dev machine (no API key).
</output>


#### .planning/phases/09.1-provider-latency-and-cancellation/09.1-05-PLAN.md
---
phase: 09.1-provider-latency-and-cancellation
plan: 05
type: execute
wave: 3
depends_on: [09.1-01, 09.1-02, 09.1-06]
coupling_justified: ["09.1-04: plan 04 edits only the SDK-path tests and the AnthropicMock in tests/claude-cli-provider.test.ts, which never reach claude-cli.ts; this plan's claude-cli.ts change runs against the CLI-path tests of that file in this plan's verify, and with the pool disabled outside the daemon those tests see claude-cli.ts behave as before; either merge order gives the same result"]
files_modified:
  - src/providers/claude-prewarm.ts
  - src/providers/claude-process.ts
  - src/providers/claude-cli.ts
  - src/cli/commands/daemon.ts
  - tests/fixtures/fake-claude-stream.mjs
  - tests/claude-prewarm.test.ts
  - tests/claude-process.test.ts
  - tests/claude-cli-prewarm.test.ts
autonomous: true
requirements: [D-11, D-12, D-13]

estimate:
  tokens: 100000
  raw_tokens: 100000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "D-11: in the daemon, one idle `claude -p` process (stream-json input, argv fixed at spawn) is kept ready; a fresh one is started right after each `claude -p` query settles (success, error or abort), in that query's cwd with that query's argv"
    - "D-11 (amended): nothing is prewarmed when the daemon starts; the first `??` after a daemon start runs cold. The idle process is never stopped for being idle; it is retired on daemon shutdown (stdin EOF, SIGKILL backstop after 1500 ms) and exits by itself if the daemon dies (stdin EOF)"
    - "D-11: a warm turn sends the prompt over the idle process's stdin as one stream-json user line, so the prompt never appears in argv"
    - "D-12: the prewarmed process is used only when its cwd and its argv (which holds the steered system prompt and the effort) match the query; otherwise it is retired, the query runs cold, and a new process is prewarmed for the new cwd and argv; the miss reason (`cwd`, `prompt`, `dead`, `empty`) is logged"
    - "D-13: an aborted warm turn is killed like a cold one, and the slot is refilled after it settles"
    - "Discretion (recorded): a warm turn whose child exits without a `result` (died before `init`, or ended with no result) and that streamed no candidate is retried once cold within the remaining budget; is_error, timeout and abort are never retried"
    - "Prewarm is daemon-only: it is enabled from the daemon command, so the in-process client fallback never leaves an idle `claude` behind"
    - "A prewarm that fails to spawn or dies while idle clears the slot without throwing and is not respawned in a loop; the next query runs cold and then prewarms"
  artifacts:
    - path: "src/providers/claude-prewarm.ts"
      provides: "one-slot prewarm pool keyed by sha256 of {command, cwd, argv}"
      contains: "takePrewarmed"
    - path: "tests/claude-prewarm.test.ts"
      provides: "pool tests against real fixture children"
      contains: "schedulePrewarm"
    - path: "tests/claude-cli-prewarm.test.ts"
      provides: "claude-cli warm/cold selection, refill and cold-retry tests"
      contains: "takePrewarmed"
  key_links:
    - from: "src/providers/claude-cli.ts"
      to: "src/providers/claude-prewarm.ts"
      via: "takePrewarmed(spec) before the turn; schedulePrewarm(spec) in finally"
      pattern: "schedulePrewarm\\("
    - from: "src/providers/claude-cli.ts"
      to: "src/providers/claude-process.ts"
      via: "runClaudeTurn({ ..., child }) for a warm turn"
      pattern: "child:"
    - from: "src/cli/commands/daemon.ts"
      to: "src/providers/claude-prewarm.ts"
      via: "enablePrewarm() after the server starts; retirePrewarmed() in the shutdown handler"
      pattern: "retirePrewarmed\\(\\)"
---

<objective>
Keep one prewarmed `claude -p` process in the daemon so a query skips Claude Code's ~0.9 s boot (D-11), reuse it only when cwd and system prompt match (D-12), and refill the slot after every query, including aborted ones (D-13).

Purpose: the warm path measured 1.32-1.40 s from prompt write to the first complete candidate against 2.12-2.31 s cold (RESEARCH Probe 5), which is what brings the first row to about 2 s after the keypress.
Output: `src/providers/claude-prewarm.ts`, the runner's `child` option, claude-cli warm/cold selection with one cold retry, and the daemon lifecycle hooks.

Runs in wave 3 beside plans 04 and 07 (no shared files; the claude-cli-provider.test.ts coupling with plan 04 is declared in `coupling_justified`, so do not edit that test file here: if a CLI-path case in it breaks, fix claude-cli.ts, or record the conflict in the SUMMARY for plan 08). Builds on plan 06's runner options (`killGraceMs`, `backstopMs`) and fixture scenarios. This plan does not stage any `.wolf/` file: list OpenWolf entries in the SUMMARY under "OpenWolf entries for plan 08".
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-CONTEXT.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-RESEARCH.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-PATTERNS.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-01-SUMMARY.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-02-SUMMARY.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-06-SUMMARY.md
@src/providers/claude-process.ts
@src/providers/claude-cli.ts
@src/cli/commands/daemon.ts

Project rules: check `.wolf/anatomy.md` before reading files and `.wolf/cerebrum.md` before writing code. Read `.wolf/buglog.json` before fixing a failure. Do not stage `.wolf/` files in this plan. Targeted tests use `pnpm exec vitest run tests/x.test.ts`. RED commits need throw-on-call stubs so `tsc --noEmit` passes. Lint changed files with `pnpm exec biome check <files>` before staging. Commit subjects start lowercase, no Co-Authored-By trailer. Fix, don't delete. Never stub the provider in a smoke or latency check: pool tests use real fixture children (`tests/fixtures/fake-claude-stream.mjs`); the claude-cli selection tests mock the runner and pool modules because they test call order, not the provider. The argv stays opaque in claude-prewarm.ts and claude-process.ts so the steering guard (tests/steering.test.ts adapters (b)) keeps applying only to claude-cli.ts.
</context>

## Artifacts this phase produces

Shared contract for all eight plans; this plan creates the rows marked 05.

| Kind | Name | Where | Plan |
|---|---|---|---|
| file (new) | `src/providers/stream-json.ts` | provider layer | 01 (06 enforces the carry cap) |
| file (new) | `src/providers/claude-process.ts` | provider layer | 01 (06 adds the caps, the post-result backstop and the `backstopMs`/`killGraceMs` options; 05 adds the `child` option) |
| file (new) | `src/providers/candidate-stream.ts` | provider layer | 02 |
| file (new) | `src/providers/claude-prewarm.ts` | provider layer | 05 |
| file (new) | `tests/fixtures/fake-claude-stream.mjs` | real child replaying recorded stream-json | 01 (`success`, `auth`, `sigterm-slow`); 06 adds `hang-after-result`, `exit-no-result`, `die-before-init`, `stderr-flood`; 05 adds `ignore-eof` |
| file (new) | `tests/claude-process.test.ts` | tests | 01 (06 and 05 extend it) |
| file (new) | `tests/claude-stream-json.test.ts` | tests | 06 |
| file (new) | `tests/candidate-stream.test.ts` | tests | 02 |
| file (new) | `tests/claude-prewarm.test.ts`, `tests/claude-cli-prewarm.test.ts` | tests | 05 |
| file (new, planning) | `.planning/phases/09.1-provider-latency-and-cancellation/COVERAGE.md` | API coverage matrix | planning |
| type | `FetchOptions { signal?: AbortSignal; onCandidate?: (candidate: CommandCandidate) => void }` | `src/providers/provider.ts` | 01 |
| signature | `LLMAdapter.fetchCandidates(envelope, options?: FetchOptions)` | `src/providers/provider.ts` | 01 |
| function | `abortError()`, `isAbortError(error)` | `src/providers/provider.ts` | 01 |
| schema/type | `streamJsonResultSchema`, `StreamJsonResult` | `src/providers/stream-json.ts` | 01 |
| function | `createLineParser(onEvent, options?)`, `textDeltaOf(event)`, `isInitEvent(event)`, `buildStreamJsonUserLine(prompt)` | `src/providers/stream-json.ts` | 01 |
| option | `createLineParser` options `maxCarryBytes`, `onOverflow` | `src/providers/stream-json.ts` | 06 |
| const | `STREAM_JSON_CARRY_CAP_BYTES` = 1 MiB | `src/providers/stream-json.ts` | 01 declares it, 06 enforces it |
| const | `SIGKILL_GRACE_MS` = 1500, `POST_RESULT_BACKSTOP_MS` = 2000, `STDERR_CAP_BYTES` = 64 KiB | `src/providers/claude-process.ts` | 01 declares them; 06 arms the backstop and enforces the stderr cap |
| type | `ClaudeTurnOptions`, `ClaudeTurnStage`, `ClaudeTurnStageDetail`, `ClaudeTurnFailure`, `ClaudeTurnFailureReason` | `src/providers/claude-process.ts` | 01 |
| option | `ClaudeTurnOptions.backstopMs`, `ClaudeTurnOptions.killGraceMs` | `src/providers/claude-process.ts` | 06 |
| option | `ClaudeTurnOptions.child` (run the turn on a prewarmed child) | `src/providers/claude-process.ts` | 05 |
| function | `spawnClaudeChild(command, argv, cwd, env?)`, `terminateChild(child, graceMs?)`, `runClaudeTurn(options)` | `src/providers/claude-process.ts` | 01 |
| const/function | `CLAUDE_COMMAND` = `'claude'`, `buildClaudeCliArgv(envelope)` | `src/providers/claude-cli.ts` | 01 |
| signature | `fetchClaudeCliCandidates(envelope, remainingBudgetMs, options?)` | `src/providers/claude-cli.ts` | 01 |
| claude flags | `--input-format stream-json`, `--output-format stream-json`, `--verbose`, `--include-partial-messages` | claude argv | 01 |
| claude flag | `--effort <level>` | claude argv | 02 |
| const/type/function | `EFFORT_LEVELS`, `Effort`, `DEFAULT_EFFORT` = `'low'`, `resolveEffort()`, `ResolvedQqConfig.effort` | `src/shared/qq-config.ts` | 02 |
| config key | `effort` in `~/.config/qq/config.json` | qq-config, README, `docs/config.example.json` | 02 |
| const/function | `MAX_STREAMED_CANDIDATES` = 5, `createCandidateScanner(onCandidate)`, `parseStrictCandidateList(text)` | `src/providers/candidate-stream.ts` | 02 |
| IPC request field | `fetch-candidates.stream: z.literal(true).optional()` | `src/contracts/ipc.ts` | 03 |
| IPC response kind | `{ kind: 'candidate', candidate: commandCandidateSchema }` | `src/contracts/ipc.ts` | 03 |
| pong flag | `streamCandidates: true` | `ipc.ts`, `server.ts`, `bootstrap.ts` | 03 |
| signature | `requestDaemonFetch(socketPath, envelope, timeoutMs?, options?)`, `fetchCandidatesForUi(socketPath, envelope, options?)` | `src/daemon/fetch-client.ts` | 01 (03 adds `onCandidate` forwarding and the no-re-query-after-rows rule) |
| type | `CandidateListState` = `'arriving' \| 'complete' \| 'partial'` | `src/ui/modal-layout.ts` | 07 |
| const | `LIST_STATUS_ROW_LINES` = 1, `INCOMPLETE_LIST_NOTE` = `'list may be incomplete'` | `src/ui/modal-layout.ts` | 07 |
| field/prop | `CandidateSelectLayoutInput.listState`; `CandidateSelect` prop `listState` (default `'complete'`) | `modal-layout.ts`, `CandidateSelect.tsx` | 07 |
| function/const | `sdkOutputConfig(model, effort)`, `EFFORT_UNSUPPORTED_MODEL_RE` | `src/providers/claude.ts` | 04 |
| signature | SDK `fetchCandidates(envelope, rbuffer = '', timeoutMs = 25_000, options: FetchOptions = {})`; `claudeAdapter` forwards `options` | `src/providers/claude.ts` | 04 |
| test marker | `'messages.stream('` in the adapters (b) model-call list | `tests/steering.test.ts` | 04 |
| type | `PrewarmSpec { command, argv, cwd }`, `PrewarmMissReason` = `'disabled' \| 'empty' \| 'dead' \| 'cwd' \| 'prompt'`, `PrewarmTake` = `{ child } \| { miss }` | `src/providers/claude-prewarm.ts` | 05 |
| function | `prewarmKey(spec)`, `enablePrewarm()`, `disablePrewarm()`, `takePrewarmed(spec)`, `schedulePrewarm(spec)`, `retirePrewarmed()`, `prewarmSnapshot()` | `src/providers/claude-prewarm.ts` | 05 |
| debug-log stages | provider `cli spawned`, `cli init`, `cli first delta`, `cli result`, `cli exit`, `cli aborted`, `cli timed out`, `claude-cli aborted`; daemon `fetch aborted`; client `fetch aborted` | debug log | 01 |
| debug-log stages | provider `cli first candidate` (02); daemon `replied candidate` (03); provider `request aborted` (04); provider `prewarm hit`, `prewarm miss`, `prewarm spawned`, `prewarm retired`, `prewarm retry cold` (05); client `first candidate received`, `llm request failed after rows` (07) | debug log | 02-05, 07 |
| qq CLI flags | none added | — | — |

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Run a turn on a prewarmed child, and keep a one-slot pool keyed by cwd and argv</name>
  <files>src/providers/claude-prewarm.ts, src/providers/claude-process.ts, tests/fixtures/fake-claude-stream.mjs, tests/claude-prewarm.test.ts, tests/claude-process.test.ts</files>
  <read_first>
    - src/providers/claude-process.ts (runClaudeTurn, spawnClaudeChild, terminateChild from plan 01; `killGraceMs`, `backstopMs`, the caps and the backstop from plan 06)
    - tests/fixtures/fake-claude-stream.mjs and tests/claude-process.test.ts (scenarios, pid cleanup)
    - .planning/phases/09.1-provider-latency-and-cancellation/09.1-RESEARCH.md (Probe 5, Pattern 8, Pitfall 11, Probe 7 on cwd)
    - .planning/phases/09.1-provider-latency-and-cancellation/09.1-CONTEXT.md (D-11 amendment, D-12)
  </read_first>
  <behavior>
    - runClaudeTurn with `child` set to an idle fixture child (`success` scenario, spawned with spawnClaudeChild and left idle for 300 ms): resolves the answer, never emits `spawned`, and FAKE_CLAUDE_STDIN_FILE holds exactly one user line.
    - runClaudeTurn with a `child` that has already exited: rejects at once with `reason: 'exit-without-result'` and `sawInit: false` (no hang).
    - runClaudeTurn with a `child` and an already-aborted signal: the child is terminated and the promise rejects with an AbortError.
    - prewarmKey: equal for equal {command, cwd, argv}; different when cwd differs or any argv element differs (effort value, system prompt text).
    - Pool disabled (the default): takePrewarmed returns `{ miss: 'disabled' }` and schedulePrewarm spawns nothing (prewarmSnapshot stays empty).
    - Pool enabled: schedulePrewarm(spec) leaves one idle child (snapshot `idle` with a pid); scheduling the same spec again keeps the same pid; takePrewarmed(spec) returns that child and empties the slot.
    - takePrewarmed with a different cwd returns `{ miss: 'cwd' }`, empties the slot, and the old idle child exits with code 0 (stdin EOF, Probe 5); a different argv returns `{ miss: 'prompt' }`; an empty slot returns `{ miss: 'empty' }`; an idle child killed from outside returns `{ miss: 'dead' }` and nothing is respawned until the next schedulePrewarm.
    - retirePrewarmed: the idle child exits with code 0 and the slot is empty; with the `ignore-eof` scenario the child is SIGKILLed after the grace period (use a small grace in the test via an optional argument or module test hook).
    - schedulePrewarm with a missing command: the spawn `error` clears the slot, nothing throws, and exactly one spawn was attempted.
  </behavior>
  <action>
Implement RESEARCH Pattern 8 (D-11, D-12) on top of the plan 01 runner.

1. `src/providers/claude-process.ts`: add optional `child` to ClaudeTurnOptions. When it is set, do not spawn and do not emit `spawned`. If the signal is already aborted, terminateChild(child) and reject with abortError(). If `budgetMs <= 0`, terminateChild(child) and reject with the timeout failure. If the child has already exited (exitCode or signalCode not null), reject with the `exit-without-result` failure (`sawInit: false`), because its `close` event has already fired. Otherwise attach the same listeners and write the user line exactly as for a cold turn.

2. `tests/fixtures/fake-claude-stream.mjs`: add an `ignore-eof` scenario: it does not exit on stdin EOF and ignores SIGTERM, so only SIGKILL ends it.

3. `src/providers/claude-prewarm.ts` (new; argv stays opaque here): module state `enabled` (default false) and a single slot holding the child, the spec, its cwd and an argv key. Export:
   - `PrewarmSpec`, `PrewarmMissReason`, `PrewarmTake` as in the artifacts table.
   - `prewarmKey(spec)`: sha256 hex (node:crypto) of `JSON.stringify({ command, cwd, argv })`. The argv already holds `--effort` and `--system-prompt` with the steered prompt, so the key covers D-12's system-prompt hash and the effort.
   - `enablePrewarm()` and `disablePrewarm()` (retires and disables; used by tests).
   - `schedulePrewarm(spec)`: no-op unless enabled. If the slot holds a live child with the same key, keep it. Otherwise retire the current child and spawn a new idle one with spawnClaudeChild in `spec.cwd` with `process.env`. Attach at once a `child.on('error')` handler (an unhandled `error` event would crash the daemon), a no-op `child.stdin` error handler, and a `child.on('exit')` handler; both clear the slot only if it still holds that same child, and log. Never respawn from these handlers (no loop; Pitfall 11). Log `appendDebugLog('provider', 'prewarm spawned', { pid })`. Do not attach stdout data listeners or set encodings; the runner does that when it takes the child.
   - `takePrewarmed(spec)`: `{ miss: 'disabled' }` when disabled; `{ miss: 'empty' }` when the slot is empty; `{ miss: 'dead' }` (slot cleared) when the child is no longer running; `{ miss: 'cwd' }` or `{ miss: 'prompt' }` (child retired, slot cleared) when cwd or the argv key differs; otherwise clear the slot and return `{ child }`.
   - `retirePrewarmed()`: clear the slot, call `child.stdin.end()` (Claude Code exits 0 in about 0.4 s on EOF while idle), and SIGKILL it after SIGKILL_GRACE_MS if it is still running (unref'd timer, cleared on exit). Log `prewarm retired`.
   - `prewarmSnapshot()`: `{ enabled, state: 'empty' | 'idle', pid? }` for tests and logs.
   Never signal a pid that this module did not spawn.

4. Tests per `<behavior>` in `tests/claude-prewarm.test.ts` (new; real fixture children via `command: process.execPath` and `argv: [fixturePath, scenario]`; disablePrewarm and SIGKILL of tracked pids in afterEach) and `tests/claude-process.test.ts`.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/claude-prewarm.test.ts tests/claude-process.test.ts tests/steering.test.ts</automated>
    <fails_when>non-zero exit, a "FAIL" line in the vitest output, or "No test files found"</fails_when>
    <automated>pnpm typecheck</automated>
    <fails_when>non-zero exit or any "error TS" line</fails_when>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run tests/claude-prewarm.test.ts tests/claude-process.test.ts tests/steering.test.ts` exits 0
    - `pnpm typecheck` exits 0
    - `grep -c "createHash('sha256')" src/providers/claude-prewarm.ts` is at least 1
    - `grep -c "export function takePrewarmed" src/providers/claude-prewarm.ts` is at least 1, `grep -c "export function schedulePrewarm" src/providers/claude-prewarm.ts` is at least 1, `grep -c "export function retirePrewarmed" src/providers/claude-prewarm.ts` is at least 1
    - `grep -c "on('error'" src/providers/claude-prewarm.ts` is at least 2 (child and stdin)
    - `grep -c "ignore-eof" tests/fixtures/fake-claude-stream.mjs` is at least 1
  </acceptance_criteria>
  <done>A turn can run on an idle prewarmed child, and the pool spawns, matches, retires and survives failures without loops, all proven against real child processes.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: The daemon's claude -p queries use the prewarmed process, refill it, and retry once cold when it was stale</name>
  <files>src/providers/claude-cli.ts, src/cli/commands/daemon.ts, tests/claude-cli-prewarm.test.ts</files>
  <read_first>
    - src/providers/claude-cli.ts (as changed by plans 01 and 02: argv with effort, scanner wiring, stage logs)
    - src/providers/claude-prewarm.ts (Task 1), src/providers/claude-process.ts (ClaudeTurnFailure.reason)
    - src/cli/commands/daemon.ts (startDaemonServer and the shutdown handler at lines 29-42)
    - .planning/phases/09.1-provider-latency-and-cancellation/09.1-RESEARCH.md (Pattern 8, Open Question 3, assumption A3)
  </read_first>
  <behavior>
    - With the runner and pool modules mocked: on a hit, runClaudeTurn is called with that `child` and the spec `{ command: 'claude', argv: buildClaudeCliArgv(envelope), cwd: envelope.base.cwd }`; `prewarm hit` is logged; after the result, schedulePrewarm is called once with the same spec (D-11 refill).
    - On a miss (`cwd`), runClaudeTurn is called without `child`, `prewarm miss` is logged with `reason: 'cwd'`, and schedulePrewarm(spec) is called after the turn settles (D-12: the replacement starts in this query's cwd).
    - An aborted warm turn rejects with the AbortError and schedulePrewarm is still called (D-13).
    - A warm turn rejecting with `reason: 'exit-without-result'` and no candidate streamed is retried once without `child` within the remaining budget; `prewarm retry cold` is logged; the cold result is returned. The same failure after a candidate was streamed is not retried. `is-error`, `timeout` and abort failures are not retried.
    - schedulePrewarm is called exactly once per query, after the last attempt settles.
    - Logged details hold no prompt, argv, stdout or stderr (FORBIDDEN_DEBUG).
  </behavior>
  <action>
1. `src/providers/claude-cli.ts`: build `spec = { command: CLAUDE_COMMAND, argv: buildClaudeCliArgv(envelope), cwd: envelope.base.cwd }` once per query and compute a deadline from `remainingBudgetMs`. Call `takePrewarmed(spec)`; log `appendDebugLog('provider', 'prewarm hit')` or `appendDebugLog('provider', 'prewarm miss', { reason })`, and add `warm: true|false` to the existing `cli <stage>` details. Run the turn with `child` on a hit. If a warm turn fails with `reason === 'exit-without-result'`, no candidate was streamed, the signal is not aborted and the deadline has time left, log `prewarm retry cold` and run one cold turn with the remaining budget (stale prewarm after a long idle or laptop sleep, assumption A3). Never retry `is-error`, `timeout` or abort failures. In a `finally` around the whole attempt, call `schedulePrewarm(spec)`, so the next process boots after this turn settled and does not compete with it (Pattern 8), and an aborted or killed process's slot is refilled (D-13). The pool does nothing outside the daemon because it is only enabled there.

2. `src/cli/commands/daemon.ts`: call `enablePrewarm()` right after startDaemonServer resolves. Do not spawn anything at start (D-11 amendment: the daemon does not know the cwd or the installed-tools prompt yet). In the shutdown handler, call `retirePrewarmed()` before `server.close`. If the daemon is killed outright, the idle child gets stdin EOF and exits by itself (Probe 5).

3. `tests/claude-cli-prewarm.test.ts` (new): mock `../src/providers/claude-process.js` (runClaudeTurn) and `../src/providers/claude-prewarm.js` (takePrewarmed, schedulePrewarm) with vi.fn and assert the call order per `<behavior>`; isolate config with QQ_CONFIG_FILE in a temp dir and resetQqConfigCache; mock the debug log as tests/claude-cli-provider.test.ts does.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/claude-cli-prewarm.test.ts tests/claude-cli-provider.test.ts tests/claude-prewarm.test.ts</automated>
    <fails_when>non-zero exit, a "FAIL" line in the vitest output, or "No test files found"</fails_when>
    <automated>pnpm test:run && pnpm typecheck && pnpm lint</automated>
    <fails_when>non-zero exit from any of the three commands, or a "FAIL" line in the vitest output</fails_when>
    <human-check>On an idle machine after `pnpm build` and a daemon restart: run `show me how to use z3??` twice in the same directory. The debug log (QQ_DEBUG_LOG_FILE) shows `prewarm miss` with reason `empty` for the first query and `prewarm hit` for the second, and `ps -o pid,ppid,command -ax | grep 'claude -p'` shows exactly one idle `claude -p` child of the daemon between queries, with no query text in its command line. Run one query from another directory: the log shows `prewarm miss` with reason `cwd`.</human-check>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run tests/claude-cli-prewarm.test.ts tests/claude-cli-provider.test.ts tests/claude-prewarm.test.ts` exits 0
    - `pnpm test:run && pnpm typecheck && pnpm lint` exits 0
    - `grep -c "takePrewarmed(" src/providers/claude-cli.ts` is at least 1 and `grep -c "schedulePrewarm(" src/providers/claude-cli.ts` is at least 1
    - `grep -c "prewarm retry cold" src/providers/claude-cli.ts` is at least 1
    - `grep -c "enablePrewarm()" src/cli/commands/daemon.ts` is at least 1 and `grep -c "retirePrewarmed()" src/cli/commands/daemon.ts` is at least 1
    - `grep -c "schedulePrewarm(" src/cli/commands/daemon.ts` is 0 (no prewarm at daemon start, D-11 amendment)
  </acceptance_criteria>
  <done>Daemon `claude -p` queries take the prewarmed process when cwd and argv match, otherwise run cold; every query refills the slot after it settles; a stale prewarm gets one cold retry; the daemon enables the pool at start without spawning and retires it on shutdown.</done>
</task>

</tasks>

<!-- planner-discipline-allow: schedulePrewarm( -->

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| daemon → long-lived idle `claude -p` child | A process that outlives single requests and holds open API connections |
| query context → prewarmed process | A process booted for one cwd and system prompt must not answer for another |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-09.1-15 | Denial of service | permanent idle prewarm (~190 MB RSS, 5-6 idle TLS sockets) | low | accept | Accepted by the user in D-11; a single slot; retired on shutdown; exits on stdin EOF if the daemon dies |
| T-09.1-16 | Tampering (integrity) | prewarmed process reused for a different cwd or system prompt | medium | mitigate | D-12 key = sha256 of {command, cwd, argv}; any mismatch retires it and runs cold (tests for `cwd` and `prompt` misses) |
| T-09.1-17 | Denial of service | respawn loop when spawning fails or the idle child dies | low | mitigate | Exit and error handlers only clear the slot; spawning happens only after a query settles (test: one spawn attempt for a missing command) |
| T-09.1-18 | Information disclosure | system prompt (catalog tool names) on the idle child's argv (IN-04) | low | accept | Tool names are public catalog entries; the user prompt is on stdin only (D-11); IN-04 stays open as before |
| T-09.1-19 | Tampering | signalling processes | low | mitigate | Only ChildProcess handles spawned by the pool or runner are signalled; no pid lookup |
| T-09.1-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs (node:crypto is built in); `package.json` and `pnpm-lock.yaml` unchanged by this plan's commits |
</threat_model>

<verification>
- `pnpm test:run && pnpm typecheck && pnpm lint` exits 0 at the end of the plan.
- `git diff --stat <plan-base-sha>..HEAD -- package.json pnpm-lock.yaml .wolf` is empty.
- The Task 2 `<human-check>` is listed in the SUMMARY for the end-of-phase UAT.
</verification>

<success_criteria>
- D-11, D-12 and D-13 (slot refill after abort) hold, proven by pool tests on real children and call-order tests in claude-cli.
- No prewarm happens outside the daemon or at daemon start.
</success_criteria>

<output>
Create `.planning/phases/09.1-provider-latency-and-cancellation/09.1-05-SUMMARY.md` when done, with "OpenWolf entries for plan 08" (anatomy lines for claude-prewarm.ts, the two new test files, claude-process.ts, claude-cli.ts and daemon.ts; cerebrum lines: prewarm is daemon-only and enabled in daemon.ts, keyed by sha256 of {command, cwd, argv}, refilled after every settle, never at daemon start; one cold retry only for `exit-without-result` with no streamed rows) and the Task 2 human check under "Human checks for end-of-phase UAT".
</output>


#### .planning/phases/09.1-provider-latency-and-cancellation/09.1-06-PLAN.md
---
phase: 09.1-provider-latency-and-cancellation
plan: 06
type: execute
wave: 2
depends_on: [09.1-01]
files_modified:
  - src/providers/stream-json.ts
  - src/providers/claude-process.ts
  - tests/fixtures/fake-claude-stream.mjs
  - tests/claude-stream-json.test.ts
  - tests/claude-process.test.ts
autonomous: true
requirements: [D-04, D-13]
coupling_justified: ["09.1-02: plan 02's claude-cli.ts calls runClaudeTurn with the plan-01 options only and its tests mock runClaudeTurn; this plan adds optional ClaudeTurnOptions fields with defaults and changes runner internals only, so either merge order gives the same result"]

estimate:
  tokens: 50000
  raw_tokens: 50000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "D-04: a `claude -p` answer whose multi-byte characters (such as `ⓘ`) are split across stdout chunks arrives intact; blank and non-JSON stdout lines never reach any candidate parser"
    - "D-04: a turn whose stdout grows past 1 MiB without a newline is killed and fails with `invalid-result` instead of exhausting daemon memory; collected stderr never exceeds 64 KiB"
    - "D-04: after a valid `result` the child is left to exit on its own; if it is still running 2000 ms later it gets SIGTERM, then SIGKILL after the grace, and the already-resolved answer is unaffected"
    - "D-04/D-13: every runner failure ends in the shape claude-default maps to today's copy: budget timeout (`killed: true`, `signal: 'SIGTERM'`, although claude exits 143), exit without `result` (`sawInit` tells a death before `init` apart), missing binary (`ENOENT`, `spawn-error`), and a zero budget or an already-aborted signal (no process spawned)"
    - "D-13: no text delta is reported after a turn has settled, although Claude Code keeps streaming for about 0.5 s after SIGTERM"
  artifacts:
    - path: "src/providers/stream-json.ts"
      provides: "carry cap with onOverflow on createLineParser"
      contains: "maxCarryBytes"
    - path: "src/providers/claude-process.ts"
      provides: "post-result backstop, stderr cap, overflow kill, backstopMs and killGraceMs options"
      contains: "POST_RESULT_BACKSTOP_MS"
    - path: "tests/claude-stream-json.test.ts"
      provides: "parser tests: chunk splits, split multi-byte character, non-JSON lines, carry cap"
      contains: "createLineParser"
    - path: "tests/claude-process.test.ts"
      provides: "runner failure-path tests against real fixture children"
      contains: "hang-after-result"
  key_links:
    - from: "src/providers/claude-process.ts"
      to: "src/providers/stream-json.ts"
      via: "createLineParser(onEvent, { onOverflow }) kills the child and rejects with reason invalid-result"
      pattern: "onOverflow"
    - from: "tests/claude-process.test.ts"
      to: "tests/fixtures/fake-claude-stream.mjs"
      via: "one real child per scenario, spawned with process.execPath"
      pattern: "fake-claude-stream\\.mjs"
---

<objective>
Harden the stream-json turn from plan 01 against everything that is not the happy path, and prove each branch against real child processes: split UTF-8, oversize stdout and stderr, a child that hangs after `result`, early exits, a missing binary, and zero or exhausted budgets (D-04 rules from the specialist review, with the D-13 kill timing).

Purpose: plan 01's tracer proves cancellation and the stream-json path end to end, and already implements the runner's budget-timeout, spawn-error and exit-without-result branches. This plan adds the caps and the post-result backstop and proves every failure branch against the fixture, so a misbehaving `claude` can neither wedge nor crash the daemon. It was split out of plan 01 to keep both plans inside the per-plan context budget.
Output: the carry cap in `src/providers/stream-json.ts`; the backstop, stderr cap and overflow kill in `src/providers/claude-process.ts`; four failure scenarios in the fixture; `tests/claude-stream-json.test.ts`; runner failure-path tests.

Runs in wave 2 beside plans 02 and 03 (no shared files; the call-site coupling with plan 02 is declared in `coupling_justified`). Plan 05 (wave 3) builds on this plan's runner options and fixture. This plan does not stage any `.wolf/` file (parallel wave): list the OpenWolf entries in the SUMMARY under "OpenWolf entries for plan 08".
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-CONTEXT.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-01-SUMMARY.md
@src/providers/stream-json.ts
@src/providers/claude-process.ts
@tests/fixtures/fake-claude-stream.mjs

`.planning/phases/09.1-provider-latency-and-cancellation/09.1-RESEARCH.md` is 72 KB: read only the sections each task's `<read_first>` names (find them with `grep -n '^##' 09.1-RESEARCH.md`), not the whole file.

Project rules: check `.wolf/anatomy.md` before reading files and `.wolf/cerebrum.md` before writing code (Do-Not-Repeat: spawn vs execFile; throw-on-call stubs for RED). Read `.wolf/buglog.json` before fixing a failure. Do not stage `.wolf/` files in this plan; record buglog-worthy fixes in the SUMMARY for plan 08. Targeted tests use `pnpm exec vitest run tests/x.test.ts`. RED commits need throw-on-call stubs so `tsc --noEmit` passes. Lint changed files with `pnpm exec biome check <files>` before staging. Commit subjects start lowercase, no Co-Authored-By trailer. Fix, don't delete. Never stub the provider: runner tests use real fixture children (`command: process.execPath`, `argv: [fixturePath, scenario]`). Assert stage order, never wall-clock thresholds (bug-206). argv stays opaque in claude-process.ts so the steering guard in tests/steering.test.ts keeps applying only to claude-cli.ts.
</context>

## Artifacts this phase produces

Shared contract for all eight plans; this plan creates the rows marked 06.

| Kind | Name | Where | Plan |
|---|---|---|---|
| file (new) | `src/providers/stream-json.ts` | provider layer | 01 (06 enforces the carry cap) |
| file (new) | `src/providers/claude-process.ts` | provider layer | 01 (06 adds the caps, the post-result backstop and the `backstopMs`/`killGraceMs` options; 05 adds the `child` option) |
| file (new) | `src/providers/candidate-stream.ts` | provider layer | 02 |
| file (new) | `src/providers/claude-prewarm.ts` | provider layer | 05 |
| file (new) | `tests/fixtures/fake-claude-stream.mjs` | real child replaying recorded stream-json | 01 (`success`, `auth`, `sigterm-slow`); 06 adds `hang-after-result`, `exit-no-result`, `die-before-init`, `stderr-flood`; 05 adds `ignore-eof` |
| file (new) | `tests/claude-process.test.ts` | tests | 01 (06 and 05 extend it) |
| file (new) | `tests/claude-stream-json.test.ts` | tests | 06 |
| file (new) | `tests/candidate-stream.test.ts` | tests | 02 |
| file (new) | `tests/claude-prewarm.test.ts`, `tests/claude-cli-prewarm.test.ts` | tests | 05 |
| file (new, planning) | `.planning/phases/09.1-provider-latency-and-cancellation/COVERAGE.md` | API coverage matrix | planning |
| type | `FetchOptions { signal?: AbortSignal; onCandidate?: (candidate: CommandCandidate) => void }` | `src/providers/provider.ts` | 01 |
| signature | `LLMAdapter.fetchCandidates(envelope, options?: FetchOptions)` | `src/providers/provider.ts` | 01 |
| function | `abortError()`, `isAbortError(error)` | `src/providers/provider.ts` | 01 |
| schema/type | `streamJsonResultSchema`, `StreamJsonResult` | `src/providers/stream-json.ts` | 01 |
| function | `createLineParser(onEvent, options?)`, `textDeltaOf(event)`, `isInitEvent(event)`, `buildStreamJsonUserLine(prompt)` | `src/providers/stream-json.ts` | 01 |
| option | `createLineParser` options `maxCarryBytes`, `onOverflow` | `src/providers/stream-json.ts` | 06 |
| const | `STREAM_JSON_CARRY_CAP_BYTES` = 1 MiB | `src/providers/stream-json.ts` | 01 declares it, 06 enforces it |
| const | `SIGKILL_GRACE_MS` = 1500, `POST_RESULT_BACKSTOP_MS` = 2000, `STDERR_CAP_BYTES` = 64 KiB | `src/providers/claude-process.ts` | 01 declares them; 06 arms the backstop and enforces the stderr cap |
| type | `ClaudeTurnOptions`, `ClaudeTurnStage`, `ClaudeTurnStageDetail`, `ClaudeTurnFailure`, `ClaudeTurnFailureReason` | `src/providers/claude-process.ts` | 01 |
| option | `ClaudeTurnOptions.backstopMs`, `ClaudeTurnOptions.killGraceMs` | `src/providers/claude-process.ts` | 06 |
| option | `ClaudeTurnOptions.child` (run the turn on a prewarmed child) | `src/providers/claude-process.ts` | 05 |
| function | `spawnClaudeChild(command, argv, cwd, env?)`, `terminateChild(child, graceMs?)`, `runClaudeTurn(options)` | `src/providers/claude-process.ts` | 01 |
| const/function | `CLAUDE_COMMAND` = `'claude'`, `buildClaudeCliArgv(envelope)` | `src/providers/claude-cli.ts` | 01 |
| signature | `fetchClaudeCliCandidates(envelope, remainingBudgetMs, options?)` | `src/providers/claude-cli.ts` | 01 |
| claude flags | `--input-format stream-json`, `--output-format stream-json`, `--verbose`, `--include-partial-messages` | claude argv | 01 |
| claude flag | `--effort <level>` | claude argv | 02 |
| const/type/function | `EFFORT_LEVELS`, `Effort`, `DEFAULT_EFFORT` = `'low'`, `resolveEffort()`, `ResolvedQqConfig.effort` | `src/shared/qq-config.ts` | 02 |
| config key | `effort` in `~/.config/qq/config.json` | qq-config, README, `docs/config.example.json` | 02 |
| const/function | `MAX_STREAMED_CANDIDATES` = 5, `createCandidateScanner(onCandidate)`, `parseStrictCandidateList(text)` | `src/providers/candidate-stream.ts` | 02 |
| IPC request field | `fetch-candidates.stream: z.literal(true).optional()` | `src/contracts/ipc.ts` | 03 |
| IPC response kind | `{ kind: 'candidate', candidate: commandCandidateSchema }` | `src/contracts/ipc.ts` | 03 |
| pong flag | `streamCandidates: true` | `ipc.ts`, `server.ts`, `bootstrap.ts` | 03 |
| signature | `requestDaemonFetch(socketPath, envelope, timeoutMs?, options?)`, `fetchCandidatesForUi(socketPath, envelope, options?)` | `src/daemon/fetch-client.ts` | 01 (03 adds `onCandidate` forwarding and the no-re-query-after-rows rule) |
| type | `CandidateListState` = `'arriving' \| 'complete' \| 'partial'` | `src/ui/modal-layout.ts` | 07 |
| const | `LIST_STATUS_ROW_LINES` = 1, `INCOMPLETE_LIST_NOTE` = `'list may be incomplete'` | `src/ui/modal-layout.ts` | 07 |
| field/prop | `CandidateSelectLayoutInput.listState`; `CandidateSelect` prop `listState` (default `'complete'`) | `modal-layout.ts`, `CandidateSelect.tsx` | 07 |
| function/const | `sdkOutputConfig(model, effort)`, `EFFORT_UNSUPPORTED_MODEL_RE` | `src/providers/claude.ts` | 04 |
| signature | SDK `fetchCandidates(envelope, rbuffer = '', timeoutMs = 25_000, options: FetchOptions = {})`; `claudeAdapter` forwards `options` | `src/providers/claude.ts` | 04 |
| test marker | `'messages.stream('` in the adapters (b) model-call list | `tests/steering.test.ts` | 04 |
| type | `PrewarmSpec { command, argv, cwd }`, `PrewarmMissReason` = `'disabled' \| 'empty' \| 'dead' \| 'cwd' \| 'prompt'`, `PrewarmTake` = `{ child } \| { miss }` | `src/providers/claude-prewarm.ts` | 05 |
| function | `prewarmKey(spec)`, `enablePrewarm()`, `disablePrewarm()`, `takePrewarmed(spec)`, `schedulePrewarm(spec)`, `retirePrewarmed()`, `prewarmSnapshot()` | `src/providers/claude-prewarm.ts` | 05 |
| debug-log stages | provider `cli spawned`, `cli init`, `cli first delta`, `cli result`, `cli exit`, `cli aborted`, `cli timed out`, `claude-cli aborted`; daemon `fetch aborted`; client `fetch aborted` | debug log | 01 |
| debug-log stages | provider `cli first candidate` (02); daemon `replied candidate` (03); provider `request aborted` (04); provider `prewarm hit`, `prewarm miss`, `prewarm spawned`, `prewarm retired`, `prewarm retry cold` (05); client `first candidate received`, `llm request failed after rows` (07) | debug log | 02-05, 07 |
| qq CLI flags | none added | — | — |

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: The stream-json line parser keeps split UTF-8 intact and caps its carry</name>
  <files>src/providers/stream-json.ts, tests/claude-stream-json.test.ts</files>
  <read_first>
    - src/providers/stream-json.ts (as written in plan 01: createLineParser, textDeltaOf, isInitEvent, STREAM_JSON_CARRY_CAP_BYTES)
    - .planning/phases/09.1-provider-latency-and-cancellation/09.1-RESEARCH.md (Pattern 1 and its caps, Pitfall 1)
    - .planning/debug/llm-response-latency-profile.md ("Specialist Review" section only)
  </read_first>
  <behavior>
    - A line split across three chunks arrives as one event; two lines in one chunk arrive as two events in order; blank lines and a non-JSON line (`Warning: something`) are skipped.
    - `ⓘ` whose UTF-8 bytes are split across two Buffers and decoded with `new StringDecoder('utf8')` (the decoder `setEncoding` uses) arrives intact inside the event text.
    - Once the carry exceeds `maxCarryBytes` without a newline, `onOverflow` is called once and later chunks are ignored (no further events).
    - Without options the cap is STREAM_JSON_CARRY_CAP_BYTES.
    - textDeltaOf returns the text only for text_delta stream events (not for message_start, assistant or result lines); isInitEvent matches only system init.
  </behavior>
  <action>
Close the parser edge cases (D-04: line-buffered, UTF-8-safe, bounded).

1. `src/providers/stream-json.ts`: `createLineParser(onEvent, options?)` takes options `maxCarryBytes` (default STREAM_JSON_CARRY_CAP_BYTES) and `onOverflow`. Track the carry size as a running count (Buffer.byteLength of the carry after each append is fine; never concatenate all chunks). On overflow call onOverflow once, clear the carry and ignore later input. Keep the plan-01 behaviour for everything else (newline split, trim, empty lines skipped, non-JSON lines skipped silently).

2. `tests/claude-stream-json.test.ts` (new): the cases in `<behavior>`. Build the split-character case from `Buffer.from('ⓘ')` cut between its bytes and pushed through one StringDecoder, as the runner's `setEncoding('utf8')` does.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/claude-stream-json.test.ts</automated>
    <fails_when>non-zero exit, a "FAIL" line in the vitest output, or "No test files found"</fails_when>
    <automated>pnpm typecheck</automated>
    <fails_when>non-zero exit or any "error TS" line</fails_when>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run tests/claude-stream-json.test.ts` exits 0
    - `pnpm typecheck` exits 0
    - `grep -c "STREAM_JSON_CARRY_CAP_BYTES" src/providers/stream-json.ts` is at least 2 (declared and used as the default)
    - `grep -c "onOverflow" src/providers/stream-json.ts` is at least 1
  </acceptance_criteria>
  <done>The parser delivers whole JSON lines with split multi-byte characters intact, skips noise, and stops at the 1 MiB carry cap with one onOverflow call.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Every runner failure path, the caps and the post-result backstop hold against real children</name>
  <files>src/providers/claude-process.ts, tests/fixtures/fake-claude-stream.mjs, tests/claude-process.test.ts</files>
  <read_first>
    - src/providers/claude-process.ts, tests/fixtures/fake-claude-stream.mjs, tests/claude-process.test.ts (as written in plan 01: settled guard, budget timer, abort listener, close and error handlers, pid tracking and afterEach SIGKILL)
    - .planning/phases/09.1-provider-latency-and-cancellation/09.1-RESEARCH.md (Pattern 2 grace timing, Probe 4, Probe 8, Pitfalls 2, 3 and 12)
    - .planning/debug/llm-response-latency-profile.md ("Specialist Review" section only: why an immediate SIGTERM after `result` is avoided)
  </read_first>
  <behavior>
    - `success`: the delta text joined by onTextDelta contains `ⓘ` intact although the fixture wrote its bytes in two pieces, and the resolved text equals the fixture's answer.
    - Budget timeout (`budgetMs: 200`, `sigterm-slow`): rejects with `reason: 'timeout'`, `killed: true`, `signal: 'SIGTERM'`, `code: null`; the `timed-out` stage fires before `exit`, which reports code 143; onTextDelta is not called after the rejection.
    - `hang-after-result` with `backstopMs: 100` and `killGraceMs: 100`: resolves with the answer; afterwards the `exit` stage reports signal SIGKILL.
    - `exit-no-result`: rejects with `reason: 'exit-without-result'`, `code: 1`, stderr containing `boom`, `stdout: ''`, `sawInit: true`; `die-before-init`: same reason with `sawInit: false`.
    - Missing binary (`command: '/nonexistent/claude-qq-test'`): rejects with `code: 'ENOENT'` and `reason: 'spawn-error'`.
    - `budgetMs: 0` rejects with the timeout shape and spawns nothing (no `spawned` stage); an already-aborted signal rejects with an AbortError and spawns nothing.
    - `stderr-flood`: the rejection's `stderr` length is at most STDERR_CAP_BYTES.
  </behavior>
  <action>
1. `tests/fixtures/fake-claude-stream.mjs`: add four scenarios beside plan 01's three, using the same event shapes (RESEARCH Probes 2 and 8):
   - `hang-after-result`: the `success` events, then ignore SIGTERM and never exit until SIGKILL.
   - `exit-no-result`: init, then `boom` on stderr and exit 1.
   - `die-before-init`: exit 1 straight after reading the stdin line, with no stdout.
   - `stderr-flood`: write 200 KB to stderr, then exit 1 without a result.

2. `src/providers/claude-process.ts`, `runClaudeTurn`: add optional `backstopMs` (default POST_RESULT_BACKSTOP_MS) and `killGraceMs` (default SIGKILL_GRACE_MS) to ClaudeTurnOptions and use killGraceMs in every terminateChild call. After a successful `result`, arm an unref'd timer of `backstopMs` that calls terminateChild if the child has not exited, cleared on `exit`: the child is left to exit on its own first, because the specialist review warns that an immediate SIGTERM can cut off Claude Code's credential writes. Cap collected stderr at STDERR_CAP_BYTES with a running count (drop the excess). Pass `onOverflow` to createLineParser: on overflow call terminateChild and reject with reason `invalid-result`. Check that no handler calls onTextDelta or emits `first-delta` after the turn has settled (Pitfall 3: Claude Code keeps streaming for about 0.5 s after SIGTERM). Leave the plan-01 settle, budget-timer, abort and spawn-error logic in place; this task proves it and adds to it.

3. `tests/claude-process.test.ts`: the cases in `<behavior>`, with the plan-01 harness (`command: process.execPath`, `argv: [fixturePath, scenario]`, stages collected through onStage, pids from the `spawned` detail SIGKILLed in afterEach). Assert stage order and failure shapes only, never elapsed times.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/claude-process.test.ts tests/claude-stream-json.test.ts</automated>
    <fails_when>non-zero exit, a "FAIL" line in the vitest output, or "No test files found"</fails_when>
    <automated>pnpm test:run && pnpm typecheck && pnpm lint</automated>
    <fails_when>non-zero exit from any of the three commands, or a "FAIL" line in the vitest output</fails_when>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run tests/claude-process.test.ts tests/claude-stream-json.test.ts` exits 0
    - `pnpm test:run && pnpm typecheck && pnpm lint` exits 0
    - `grep -c "POST_RESULT_BACKSTOP_MS" src/providers/claude-process.ts` is at least 2 and `grep -c "STDERR_CAP_BYTES" src/providers/claude-process.ts` is at least 2
    - `grep -c "onOverflow" src/providers/claude-process.ts` is at least 1 and `grep -c "killGraceMs" src/providers/claude-process.ts` is at least 2
    - `grep -c "hang-after-result" tests/fixtures/fake-claude-stream.mjs`, `grep -c "exit-no-result" tests/fixtures/fake-claude-stream.mjs`, `grep -c "die-before-init" tests/fixtures/fake-claude-stream.mjs` and `grep -c "stderr-flood" tests/fixtures/fake-claude-stream.mjs` are each at least 1
  </acceptance_criteria>
  <done>Budget timeouts with exit 143, hangs after `result`, early exits, missing binaries, zero budgets, aborted signals and stderr floods each end in the documented failure shape against real children; stdout and stderr are bounded; a child that outlives its `result` is killed by the backstop.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| claude child stdout and stderr → daemon | Untrusted, possibly unbounded output from Claude Code enters the provider layer |
| daemon → claude child (signals) | The daemon decides when a child that outlives its turn is killed |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-09.1-05 | Denial of service | stdout carry and stderr buffering | medium | mitigate | 1 MiB carry cap with overflow → kill + `invalid-result`; 64 KiB stderr cap; running counts, no per-chunk concatenation (parser cap test, `stderr-flood` test) |
| T-09.1-21 | Denial of service / cost | `claude -p` child still running after `result` | low | mitigate | Post-result backstop: SIGTERM after 2000 ms, SIGKILL after the 1500 ms grace; only the ChildProcess handle this runner spawned is signalled (`hang-after-result` test) |
| T-09.1-22 | Tampering | partial output of a turn that exits without `result` | medium | mitigate | The turn rejects with `exit-without-result` and `stdout: ''`; partial text deltas never reach parseCandidates (`exit-no-result` and `die-before-init` tests) |
| T-09.1-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs in this plan (RESEARCH Package Legitimacy Audit lists none); `package.json` and `pnpm-lock.yaml` unchanged by this plan's commits |
</threat_model>

<verification>
- `pnpm test:run && pnpm typecheck && pnpm lint` exits 0 at the end of the plan.
- `git diff --stat <plan-base-sha>..HEAD -- package.json pnpm-lock.yaml .wolf` is empty (no dependency changes, no `.wolf/` commits in a parallel wave).
</verification>

<success_criteria>
- The stream-json runner meets every D-04 rule from the specialist review (UTF-8-safe lines, bounded buffers, resolve on `result`, backstop instead of an immediate kill) and every failure branch maps to a documented shape, proven against real children.
- Plan 01's user-facing copy (TIMEOUT_MESSAGE, D13, ENOENT) is unchanged.
</success_criteria>

<output>
Create `.planning/phases/09.1-provider-latency-and-cancellation/09.1-06-SUMMARY.md` when done, with "OpenWolf entries for plan 08": anatomy lines for `tests/claude-stream-json.test.ts` and the updated `stream-json.ts`, `claude-process.ts`, `tests/fixtures/fake-claude-stream.mjs` and `tests/claude-process.test.ts`; any buglog entries; and a cerebrum line "the runner caps stdout carry at 1 MiB and stderr at 64 KiB; a child still alive 2 s after `result` gets SIGTERM, then SIGKILL after 1.5 s".
</output>


#### .planning/phases/09.1-provider-latency-and-cancellation/09.1-07-PLAN.md
---
phase: 09.1-provider-latency-and-cancellation
plan: 07
type: execute
wave: 3
depends_on: [09.1-01, 09.1-03]
files_modified:
  - src/ui/modal-layout.ts
  - src/ui/CandidateSelect.tsx
  - src/client/run-foreground.ts
  - tests/candidate-select-layout.test.tsx
  - tests/candidate-select.test.tsx
  - tests/modal-layout.test.ts
  - tests/client-result.test.ts
autonomous: true
requirements: [D-05, D-06, D-07, D-08, D-09, D-10, D-14, D-16, D-17]

estimate:
  tokens: 90000
  raw_tokens: 90000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "D-05 (client half): each streamed row appears in the modal as soon as it arrives, before the full list is in"
    - "D-06: the first row to arrive is highlighted; later rows are added below in the model's order (09 D-13) and never move the highlighted row; the Tab toggles on arrived rows survive later arrivals"
    - "D-07: Enter works on any row that has arrived, straight away, and returns that row (the abort from plan 01 cancels the rest)"
    - "D-08: while more rows are coming, the `thinking…` spinner row sits directly below the last row; it disappears when the list is complete"
    - "D-09: text typed into FILTER also filters rows that arrive later; a new row only shows if it matches. An lbuffer pre-filter that matches nothing is cleared on the first arrival, as today"
    - "D-10/D-17: in Zellij no pane resize is requested while rows are arriving (the pane stays at the QQ_PANE_HEIGHT it opened with); when the list completes it is resized once to fit, and the f9o filter hold applies afterwards (filtering never shrinks it)"
    - "D-14: a row that arrives after Esc or Enter is not rendered or kept"
    - "D-16: if the call fails after at least one row arrived (timeout, crash, non-zero exit, IPC error), the arrived rows stay selectable and the spinner row becomes the dim note `list may be incomplete`; the error view shows only when no row arrived"
    - "Inline (non-Zellij) path: three two-line candidates plus the spinner row fit within MODAL_VIEWPORT_LINES (18) at 80 columns"
  artifacts:
    - path: "src/ui/CandidateSelect.tsx"
      provides: "`listState` prop: first-arrival-only reset, highlight kept by candidateKey, spinner or incomplete note row, no layout report while arriving"
      contains: "listState"
    - path: "src/ui/modal-layout.ts"
      provides: "CandidateListState, LIST_STATUS_ROW_LINES, INCOMPLETE_LIST_NOTE; estimator counts the status row"
      contains: "CandidateListState"
    - path: "src/client/run-foreground.ts"
      provides: "accumulates streamed rows, rerenders per arrival, completes or marks the list partial"
      contains: "onCandidate"
  key_links:
    - from: "src/client/run-foreground.ts"
      to: "src/daemon/fetch-client.ts"
      via: "fetchCandidatesForUi(socketPath, envelope, { signal, onCandidate }) with the plan 03 streaming"
      pattern: "onCandidate"
    - from: "src/client/run-foreground.ts"
      to: "src/ui/CandidateSelect.tsx"
      via: "app.rerender(buildCandidateElement(rows, undefined, 'arriving' | 'complete' | 'partial'))"
      pattern: "'arriving'"
    - from: "src/ui/CandidateSelect.tsx"
      to: "src/ui/modal-layout.ts"
      via: "layout input carries listState; the layout effect returns early while 'arriving'"
      pattern: "listState"
---

<objective>
Render streamed candidates as a list that grows in the modal (D-05 client half): the first row is highlighted and later rows never move the highlight (D-06), Enter works on any arrived row (D-07), the spinner sits below the rows while more come (D-08), a typed filter keeps applying to later rows (D-09), the Zellij pane holds steady until completion and resizes once (D-10, D-17), late rows after Esc or Enter are dropped (D-14), and a late failure keeps the arrived rows selectable (D-16).

Purpose: this is the user-visible half of the streaming lever. Plan 03 carries each candidate over IPC to `options.onCandidate`; this plan renders them. It was split out of plan 03 to keep each plan inside the per-plan context budget.
Output: `listState` in CandidateSelect and the layout estimator, and run-foreground streaming and partial-failure handling.

Runs in wave 3 beside plans 04 and 05 (no shared files). This plan does not stage any `.wolf/` file (parallel wave): list the OpenWolf entries in the SUMMARY under "OpenWolf entries for plan 08".
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-CONTEXT.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-PATTERNS.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-01-SUMMARY.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-03-SUMMARY.md
@.planning/phases/09-installed-only-command-awareness/09-REVIEW-DISPOSITION.md
@src/client/run-foreground.ts
@src/ui/CandidateSelect.tsx
@src/ui/modal-layout.ts

`.planning/phases/09.1-provider-latency-and-cancellation/09.1-RESEARCH.md` is 72 KB: read only the sections each task's `<read_first>` names (find them with `grep -n '^##' 09.1-RESEARCH.md`), not the whole file. `tests/candidate-select.test.tsx` (42 KB) is read only if a mocked-hooks case breaks. This keeps the plan inside the per-plan context budget.

Project rules: check `.wolf/anatomy.md` before reading files and `.wolf/cerebrum.md` before writing code (Do-Not-Repeat: render-phase `prevX` pattern instead of prop-driven state in effects; CandidateSelect test mock indexes useState by call order, any new state goes after the fourth; real-hooks tests live in tests/candidate-select-layout.test.tsx; client-result.test.ts fs mock is narrow). Read `.wolf/buglog.json` before fixing a failure. Do not stage `.wolf/` files in this plan. Targeted tests use `pnpm exec vitest run tests/x.test.ts`. RED commits need throw-on-call stubs so `tsc --noEmit` passes. Lint changed files with `pnpm exec biome check <files>` before staging. Commit subjects start lowercase, no Co-Authored-By trailer. UI offsets go in named presentational constants (global CLAUDE.md). Fix, don't delete. Do not touch `src/client/zellij-pane-resize.ts`: the open WR-06/WR-07 findings stay open, and fewer resizes (one per `??`) lower exposure to them.
</context>

## Artifacts this phase produces

Shared contract for all eight plans; this plan creates the rows marked 07.

| Kind | Name | Where | Plan |
|---|---|---|---|
| file (new) | `src/providers/stream-json.ts` | provider layer | 01 (06 enforces the carry cap) |
| file (new) | `src/providers/claude-process.ts` | provider layer | 01 (06 adds the caps, the post-result backstop and the `backstopMs`/`killGraceMs` options; 05 adds the `child` option) |
| file (new) | `src/providers/candidate-stream.ts` | provider layer | 02 |
| file (new) | `src/providers/claude-prewarm.ts` | provider layer | 05 |
| file (new) | `tests/fixtures/fake-claude-stream.mjs` | real child replaying recorded stream-json | 01 (`success`, `auth`, `sigterm-slow`); 06 adds `hang-after-result`, `exit-no-result`, `die-before-init`, `stderr-flood`; 05 adds `ignore-eof` |
| file (new) | `tests/claude-process.test.ts` | tests | 01 (06 and 05 extend it) |
| file (new) | `tests/claude-stream-json.test.ts` | tests | 06 |
| file (new) | `tests/candidate-stream.test.ts` | tests | 02 |
| file (new) | `tests/claude-prewarm.test.ts`, `tests/claude-cli-prewarm.test.ts` | tests | 05 |
| file (new, planning) | `.planning/phases/09.1-provider-latency-and-cancellation/COVERAGE.md` | API coverage matrix | planning |
| type | `FetchOptions { signal?: AbortSignal; onCandidate?: (candidate: CommandCandidate) => void }` | `src/providers/provider.ts` | 01 |
| signature | `LLMAdapter.fetchCandidates(envelope, options?: FetchOptions)` | `src/providers/provider.ts` | 01 |
| function | `abortError()`, `isAbortError(error)` | `src/providers/provider.ts` | 01 |
| schema/type | `streamJsonResultSchema`, `StreamJsonResult` | `src/providers/stream-json.ts` | 01 |
| function | `createLineParser(onEvent, options?)`, `textDeltaOf(event)`, `isInitEvent(event)`, `buildStreamJsonUserLine(prompt)` | `src/providers/stream-json.ts` | 01 |
| option | `createLineParser` options `maxCarryBytes`, `onOverflow` | `src/providers/stream-json.ts` | 06 |
| const | `STREAM_JSON_CARRY_CAP_BYTES` = 1 MiB | `src/providers/stream-json.ts` | 01 declares it, 06 enforces it |
| const | `SIGKILL_GRACE_MS` = 1500, `POST_RESULT_BACKSTOP_MS` = 2000, `STDERR_CAP_BYTES` = 64 KiB | `src/providers/claude-process.ts` | 01 declares them; 06 arms the backstop and enforces the stderr cap |
| type | `ClaudeTurnOptions`, `ClaudeTurnStage`, `ClaudeTurnStageDetail`, `ClaudeTurnFailure`, `ClaudeTurnFailureReason` | `src/providers/claude-process.ts` | 01 |
| option | `ClaudeTurnOptions.backstopMs`, `ClaudeTurnOptions.killGraceMs` | `src/providers/claude-process.ts` | 06 |
| option | `ClaudeTurnOptions.child` (run the turn on a prewarmed child) | `src/providers/claude-process.ts` | 05 |
| function | `spawnClaudeChild(command, argv, cwd, env?)`, `terminateChild(child, graceMs?)`, `runClaudeTurn(options)` | `src/providers/claude-process.ts` | 01 |
| const/function | `CLAUDE_COMMAND` = `'claude'`, `buildClaudeCliArgv(envelope)` | `src/providers/claude-cli.ts` | 01 |
| signature | `fetchClaudeCliCandidates(envelope, remainingBudgetMs, options?)` | `src/providers/claude-cli.ts` | 01 |
| claude flags | `--input-format stream-json`, `--output-format stream-json`, `--verbose`, `--include-partial-messages` | claude argv | 01 |
| claude flag | `--effort <level>` | claude argv | 02 |
| const/type/function | `EFFORT_LEVELS`, `Effort`, `DEFAULT_EFFORT` = `'low'`, `resolveEffort()`, `ResolvedQqConfig.effort` | `src/shared/qq-config.ts` | 02 |
| config key | `effort` in `~/.config/qq/config.json` | qq-config, README, `docs/config.example.json` | 02 |
| const/function | `MAX_STREAMED_CANDIDATES` = 5, `createCandidateScanner(onCandidate)`, `parseStrictCandidateList(text)` | `src/providers/candidate-stream.ts` | 02 |
| IPC request field | `fetch-candidates.stream: z.literal(true).optional()` | `src/contracts/ipc.ts` | 03 |
| IPC response kind | `{ kind: 'candidate', candidate: commandCandidateSchema }` | `src/contracts/ipc.ts` | 03 |
| pong flag | `streamCandidates: true` | `ipc.ts`, `server.ts`, `bootstrap.ts` | 03 |
| signature | `requestDaemonFetch(socketPath, envelope, timeoutMs?, options?)`, `fetchCandidatesForUi(socketPath, envelope, options?)` | `src/daemon/fetch-client.ts` | 01 (03 adds `onCandidate` forwarding and the no-re-query-after-rows rule) |
| type | `CandidateListState` = `'arriving' \| 'complete' \| 'partial'` | `src/ui/modal-layout.ts` | 07 |
| const | `LIST_STATUS_ROW_LINES` = 1, `INCOMPLETE_LIST_NOTE` = `'list may be incomplete'` | `src/ui/modal-layout.ts` | 07 |
| field/prop | `CandidateSelectLayoutInput.listState`; `CandidateSelect` prop `listState` (default `'complete'`) | `modal-layout.ts`, `CandidateSelect.tsx` | 07 |
| function/const | `sdkOutputConfig(model, effort)`, `EFFORT_UNSUPPORTED_MODEL_RE` | `src/providers/claude.ts` | 04 |
| signature | SDK `fetchCandidates(envelope, rbuffer = '', timeoutMs = 25_000, options: FetchOptions = {})`; `claudeAdapter` forwards `options` | `src/providers/claude.ts` | 04 |
| test marker | `'messages.stream('` in the adapters (b) model-call list | `tests/steering.test.ts` | 04 |
| type | `PrewarmSpec { command, argv, cwd }`, `PrewarmMissReason` = `'disabled' \| 'empty' \| 'dead' \| 'cwd' \| 'prompt'`, `PrewarmTake` = `{ child } \| { miss }` | `src/providers/claude-prewarm.ts` | 05 |
| function | `prewarmKey(spec)`, `enablePrewarm()`, `disablePrewarm()`, `takePrewarmed(spec)`, `schedulePrewarm(spec)`, `retirePrewarmed()`, `prewarmSnapshot()` | `src/providers/claude-prewarm.ts` | 05 |
| debug-log stages | provider `cli spawned`, `cli init`, `cli first delta`, `cli result`, `cli exit`, `cli aborted`, `cli timed out`, `claude-cli aborted`; daemon `fetch aborted`; client `fetch aborted` | debug log | 01 |
| debug-log stages | provider `cli first candidate` (02); daemon `replied candidate` (03); provider `request aborted` (04); provider `prewarm hit`, `prewarm miss`, `prewarm spawned`, `prewarm retired`, `prewarm retry cold` (05); client `first candidate received`, `llm request failed after rows` (07) | debug log | 02-05, 07 |
| qq CLI flags | none added | — | — |

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Rows appear one by one in the modal with a steady highlight, a spinner below, live filtering and no Zellij resize until complete</name>
  <files>src/ui/modal-layout.ts, src/ui/CandidateSelect.tsx, src/client/run-foreground.ts, tests/candidate-select-layout.test.tsx, tests/modal-layout.test.ts, tests/client-result.test.ts, tests/candidate-select.test.tsx</files>
  <read_first>
    - src/ui/CandidateSelect.tsx (render-phase reset lines 119-140, the `[query]` effect at 151-153, the layout effect 157-193, render 266-377)
    - src/ui/modal-layout.ts (estimateCandidateSelectLines, heldPaneLines, MODAL_VIEWPORT_LINES comment, candidateKey, filterCandidates)
    - src/client/run-foreground.ts (buildCandidateElement and the fetch block, as changed by plan 01; fetchCandidatesForUi forwards `onCandidate` since plan 03)
    - .planning/phases/09.1-provider-latency-and-cancellation/09.1-RESEARCH.md (Pattern 5, Pitfalls 8-10)
    - tests/candidate-select-layout.test.tsx (mountArrival, spawnedHeights, settle, tests (a)-(g) and "CandidateSelect arrival reset")
    - tests/client-result.test.ts (ink mock that auto-selects the first candidate on render/rerender)
    - .wolf/cerebrum.md (Do-Not-Repeat 2026-10-11 on prop-driven state in effects; Key Learnings on useState order and real-hooks tests; Decision Log f9o hold)
  </read_first>
  <behavior>
    - Real hooks: mount with `null`, rerender `[a]` arriving, `[a, b]` arriving: row a is highlighted (`┌> `). Press Down: b is highlighted. Rerender `[a, b, c]` arriving: b is still highlighted. Press Enter: onSelect receives b's command (D-06, D-07).
    - Real hooks: while `listState` is `'arriving'` with rows, the last frame contains `thinking` below the last row; after rerendering with `'complete'` it does not (D-08).
    - Real hooks: rows `[git status, git log]` arriving; type `log`: only `git log` shows; arrival of `git log --oneline` shows it; arrival of `ls -la` does not show it (D-09).
    - Real hooks: an lbuffer that matches no command is cleared on the first arrival and every later row shows (today's net behaviour, Pitfall 9).
    - Real hooks, Zellij env as in test (c): three arriving rerenders spawn no `zellij action`; the `'complete'` rerender spawns exactly one, with height `resolveZellijPaneHeight(heldPaneLines(0, final layout), 24)`; typing a filter afterwards spawns none (D-10, D-17).
    - Rewritten on purpose (D-06): the former "a new candidates array resets selection to row 0 and clears every Tab install toggle" test becomes "a later arrival keeps the highlighted row and its Tab toggle; the reset runs only on the first arrival". Test (g) is unchanged (a complete list replaced by a new complete array still resets the hold; production never does that within one `??`).
    - modal-layout: with candidates present and `listState: 'arriving'`, the estimate is the complete estimate plus LIST_STATUS_ROW_LINES; three two-line candidates plus the spinner at contentWidth 75 (80 columns) is at most MODAL_VIEWPORT_LINES (Pitfall 10).
    - client-result: the adapter calls `onCandidate(a)` and then stays pending; the ink mock auto-selects the first arrived row: the result file holds a replace-buffer for a's command and the adapter's signal is aborted (D-07 early Enter cancels the rest); an `onCandidate(b)` call after that does not call `rerender` (D-14).
  </behavior>
  <action>
Implement RESEARCH Pattern 5 for the arriving and complete states (D-05 client half, D-06, D-07, D-08, D-09, D-10, D-14, D-17). Task 2 adds the partial state.

1. `src/ui/modal-layout.ts`: export `type CandidateListState = 'arriving' | 'complete'` (Task 2 adds `'partial'`) and `LIST_STATUS_ROW_LINES = 1` (the status row sits directly under the last row block, whose own bottom margin is the gap, so it adds one line; a named presentational constant per the global UI rule). Add optional `listState` to CandidateSelectLayoutInput. In estimateCandidateSelectLines, when candidates are present, error is not true, and listState is `'arriving'`, add LIST_STATUS_ROW_LINES after the rows block. heldPaneLines needs no change.

2. `src/ui/CandidateSelect.tsx`: add prop `listState?: CandidateListState` defaulting to `'complete'`, so every existing caller and test keeps today's behaviour. Rewrite the render-phase block (keep it in render, never in an effect; Do-Not-Repeat 2026-10-11), still calling each setter only when its value changes:
   - When `candidates !== prevCandidates`, call setPrevCandidates(candidates).
   - First arrival (`prevCandidates === null` and `candidates !== null`): do exactly what the block does today (selection to 0, clear Tab toggles, clear a pre-filter that matches nothing).
   - Later arrival (both non-null): keep the highlighted row by candidateKey. Find the key of `filterCandidates(prevCandidates, query)[selectedIndex]`, look it up in `filterCandidates(candidates, query)`, and set selectedIndex to that index if it differs. If the key is gone, clamp selectedIndex to the last visible index. Keep the Tab toggles (they are keyed by candidateKey). Clear a pre-filter that matches nothing only while `query === (initialQuery ?? '')`, so a filter the user typed keeps applying to later rows (D-09, Pitfall 9).
   Do not add a useState (the mocked test indexes state by call order; the paneHold useRef stays as it is). Render the status row after `content` when candidates are present, error is not true and listState is `'arriving'`: `<LoadingSpinner />` with no margin of its own. In the layout effect, return early while `listState === 'arriving'` (as it already does while loading), pass listState into the layout input, and add it to the dependency list. The pane keeps the cap it opened with while rows arrive, and the completion report gives the single shrink-to-fit (heldPaneLines with the identity-keyed hold resets to 0 for the final array). After that, the f9o hold applies.

3. `src/client/run-foreground.ts`: buildCandidateElement takes a third argument `listState` (default `'complete'`) and passes it through. Keep a `streamed` array. Pass `onCandidate` with `signal` to fetchCandidatesForUi. The callback returns at once if `resolved` (D-14); otherwise it appends the row, logs `appendDebugLog('client', 'first candidate received')` for the first one, and calls `app.rerender(buildCandidateElement(annotateCandidates([...streamed], toolInventory), undefined, 'arriving'))`. The `.then` handler (already guarded by `if (resolved) return;`) rerenders with `annotateCandidates(candidates, toolInventory)` and `'complete'`.

4. Tests per `<behavior>`. Add a streaming mount helper to tests/candidate-select-layout.test.tsx, or extend mountArrival with an optional listState argument, whichever keeps the existing tests unchanged. Update tests/candidate-select.test.tsx only if a mocked-hooks case breaks; its useState indices must not change.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/candidate-select-layout.test.tsx tests/candidate-select.test.tsx tests/modal-layout.test.ts tests/client-result.test.ts</automated>
    <fails_when>non-zero exit, a "FAIL" line in the vitest output, or "No test files found"</fails_when>
    <automated>pnpm typecheck</automated>
    <fails_when>non-zero exit or any "error TS" line</fails_when>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run tests/candidate-select-layout.test.tsx tests/candidate-select.test.tsx tests/modal-layout.test.ts tests/client-result.test.ts` exits 0
    - `pnpm typecheck` exits 0
    - `grep -c "listState" src/ui/CandidateSelect.tsx` is at least 4 (prop, render-phase or status row, layout input, deps)
    - `grep -c "useState" src/ui/CandidateSelect.tsx` equals the count before this task (no new state)
    - `grep -c "export const LIST_STATUS_ROW_LINES = 1" src/ui/modal-layout.ts` is at least 1
    - `grep -c "'arriving'" src/client/run-foreground.ts` is at least 1
    - `grep -c "first candidate received" src/client/run-foreground.ts` is at least 1
    - `git log --oneline <plan-base-sha>..HEAD -- src/client/zellij-pane-resize.ts` prints nothing, where <plan-base-sha> is the commit before this plan's first commit (resize queue untouched)
  </acceptance_criteria>
  <done>Rows render as they arrive with the first highlighted and the highlight never moved by later rows, Enter works on any arrived row, the spinner sits below the rows until completion, filters apply to later rows, and Zellij gets exactly one resize per `??` at completion.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: A late provider failure keeps the arrived rows selectable with an "incomplete" note</name>
  <files>src/ui/modal-layout.ts, src/ui/CandidateSelect.tsx, src/client/run-foreground.ts, tests/candidate-select-layout.test.tsx, tests/modal-layout.test.ts, tests/client-result.test.ts</files>
  <read_first>
    - src/ui/modal-layout.ts, src/ui/CandidateSelect.tsx, src/client/run-foreground.ts (as changed by Task 1)
    - .planning/phases/09.1-provider-latency-and-cancellation/09.1-CONTEXT.md (D-16)
    - tests/client-result.test.ts ("writes error ShellResult to FIFO when fetchCandidates rejects" and the ink mock)
  </read_first>
  <behavior>
    - client-result, with the ink mock's auto-select switched off for the test: the adapter calls `onCandidate(a)` and then rejects with `Error('boom')`: the last rerendered element has `candidates` [a], `listState: 'partial'`, no `error`; no result is written yet; calling that element's onSelect with a's command writes the replace-buffer result.
    - client-result: a rejection with no row arrived still writes the error result (the existing test stays green).
    - client-result: an AbortError rejection after Esc writes nothing more and rerenders nothing.
    - Real hooks: `listState: 'partial'` shows `list may be incomplete` below the rows, no `thinking`, and Enter still selects; in Zellij the partial list reports once, like a complete one.
    - modal-layout: a partial list estimates the same as an arriving one (complete + LIST_STATUS_ROW_LINES).
  </behavior>
  <action>
Implement the UI half of D-16 (plan 03 already makes fetchCandidatesForUi reject, instead of re-querying in-process, once a row has arrived).

1. `src/ui/modal-layout.ts`: extend CandidateListState with `'partial'`; export `INCOMPLETE_LIST_NOTE = 'list may be incomplete'`; the estimator adds LIST_STATUS_ROW_LINES for `'partial'` exactly as for `'arriving'`.

2. `src/ui/CandidateSelect.tsx`: for `'partial'` the status row is `<Text dimColor>{INCOMPLETE_LIST_NOTE}</Text>` instead of the spinner. Only `'arriving'` skips the layout report; `'partial'` reports like `'complete'`.

3. `src/client/run-foreground.ts`: in the fetch `.catch`, after the AbortError early return and the failure log, and only while not `resolved`: if `streamed.length > 0`, log `appendDebugLog('client', 'llm request failed after rows', { count })`, rerender with `annotateCandidates([...streamed], toolInventory)` and `'partial'`, and return. The user then picks a row or presses Esc through the normal onSelect/onCancel path. Otherwise keep today's error path unchanged (set resolved, clearNow, error result, unmount with skipClear).

4. Tests per `<behavior>`. Give the client-result ink mock a module-level switch for auto-select (default on, so existing tests are unchanged).
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/candidate-select-layout.test.tsx tests/modal-layout.test.ts tests/client-result.test.ts</automated>
    <fails_when>non-zero exit, a "FAIL" line in the vitest output, or "No test files found"</fails_when>
    <automated>pnpm test:run && pnpm typecheck && pnpm lint</automated>
    <fails_when>non-zero exit from any of the three commands, or a "FAIL" line in the vitest output</fails_when>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run tests/candidate-select-layout.test.tsx tests/modal-layout.test.ts tests/client-result.test.ts` exits 0
    - `pnpm test:run && pnpm typecheck && pnpm lint` exits 0
    - `grep -c "INCOMPLETE_LIST_NOTE" src/ui/CandidateSelect.tsx` is at least 1 and `grep -c "export const INCOMPLETE_LIST_NOTE = 'list may be incomplete'" src/ui/modal-layout.ts` is at least 1
    - `grep -c "'partial'" src/client/run-foreground.ts` is at least 1 and `grep -c "llm request failed after rows" src/client/run-foreground.ts` is at least 1
  </acceptance_criteria>
  <done>A failure after rows arrived leaves those rows selectable under a dim "list may be incomplete" note, and the error view appears only when no row arrived.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| daemon → client UI | Streamed rows reach the modal as they arrive |
| UI → shell buffer | A selected row becomes editable text in the user's prompt (never executed) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-09.1-23 | Tampering | rows arriving after Esc or Enter (client side) | low | mitigate | The onCandidate callback returns at once once `resolved` is set, and nothing rerenders after the result is written (D-14 test); the daemon side is T-09.1-11 in plan 03 |
| T-09.1-25 | Tampering | rows kept after a late failure | low | mitigate | The `partial` list holds only rows that already passed commandCandidateSchema (daemon re-validation and the client's zod parse, plan 03); error text never becomes a row; the user must still pick a row, and nothing runs automatically |
| T-09.1-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs in this plan (RESEARCH audit lists none); `package.json` and `pnpm-lock.yaml` unchanged by this plan's commits |
</threat_model>

<verification>
- `pnpm test:run && pnpm typecheck && pnpm lint` exits 0 at the end of the plan.
- `git diff --stat <plan-base-sha>..HEAD -- package.json pnpm-lock.yaml .wolf src/client/zellij-pane-resize.ts` is empty.
- Human check for end-of-phase UAT (record it in the SUMMARY): inside Zellij, `show me how to use z3??` opens the pane at its cap, rows fill in with the first one highlighted and the `thinking…` row below them, and the pane resizes once when the list completes; typing a filter afterwards does not shrink it.
</verification>

<success_criteria>
- D-05 (client half), D-06 to D-10, D-14, D-16 and D-17 hold in the client UI, proven by real-hooks Ink tests.
- No resize while rows arrive and exactly one at completion in Zellij.
</success_criteria>

<output>
Create `.planning/phases/09.1-provider-latency-and-cancellation/09.1-07-SUMMARY.md` when done, with "OpenWolf entries for plan 08" (anatomy lines for run-foreground.ts, CandidateSelect.tsx, modal-layout.ts and the changed tests; cerebrum lines: CandidateSelect resets only on the first arrival and keeps the highlight by candidateKey; the layout effect does not report while `listState` is `'arriving'`) and a "Human checks for end-of-phase UAT" section with the Zellij check above.
</output>


#### .planning/phases/09.1-provider-latency-and-cancellation/09.1-08-PLAN.md
---
phase: 09.1-provider-latency-and-cancellation
plan: 08
type: execute
wave: 4
depends_on: [09.1-04, 09.1-05, 09.1-07]
files_modified:
  - .wolf/anatomy.md
  - .wolf/cerebrum.md
  - .wolf/memory.md
  - .wolf/buglog.json
autonomous: true
requirements: [D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-13, D-14, D-15, D-16, D-17]

estimate:
  tokens: 50000
  raw_tokens: 50000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "The OpenWolf records listed by plans 02-07 (parallel waves, which committed no `.wolf/` file) are applied: anatomy entries for every new and changed file, cerebrum learnings, buglog entries, memory lines"
    - "The superseded cerebrum guidance on `claude -p` (text output, prompt on argv, stdin ignored) no longer appears as current advice; the stream-json, effort, abort and prewarm contract of this phase replaces it, and the Decision Log records D-04, D-05, D-11/D-12 and D-13"
    - "Human UAT on an idle machine (harvested at end of phase): D-01/D-04/D-05/D-11 the first row appears well before the 5.3 s baseline, with the warm-path median measured and recorded against the ~2 s estimate; D-12 the log shows prewarm miss then hit in one directory and a `cwd` miss in another; D-13/D-15 Esc during `thinking…` returns the prompt at once and leaves no `claude -p` child running except the one idle prewarm; D-07 early Enter on the first row inserts it and cancels the rest; D-06/D-08/D-09 the list grows under a steady highlight with the spinner below and a typed filter applies to later rows; D-10/D-17 in Zellij the pane opens at its cap and resizes once at completion; D-14 nothing is inserted or stored after Esc"
    - "D-02 and D-03 are covered by tests only on this machine (no API key; no model flag on the claude argv is asserted in tests), and D-16 by tests plus an opportunistic live observation; the UAT notes say so"
  artifacts:
    - path: ".wolf/cerebrum.md"
      provides: "phase 09.1 learnings and decisions; superseded claude -p guidance replaced"
      contains: "stream-json"
    - path: ".wolf/anatomy.md"
      provides: "entries for every file the phase created or changed"
      contains: "claude-prewarm.ts"
  key_links:
    - from: ".wolf/anatomy.md"
      to: "src/providers/claude-prewarm.ts"
      via: "anatomy entry describing the prewarm pool"
      pattern: "claude-prewarm\\.ts"
---

<objective>
Close Phase 09.1: apply the OpenWolf records the parallel plans deferred, run the full gate on the merged code, and set up the manual real-provider latency and cancellation check that the user requires to run by hand on an idle machine.

Purpose: plans 02-07 ran in parallel waves and, by the Phase 9 rule, committed no `.wolf/` files. The latency target (~2 s to the first candidate) and real cancellation can only be judged against the real `claude` (never a stub, user rule), so they are `<human-check>` items harvested into the end-of-phase UAT.
Output: updated `.wolf/` records, a green full gate, and a scratch latency summarizer in a fresh `mktemp -d` directory (never committed).
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-CONTEXT.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-VALIDATION.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-01-SUMMARY.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-02-SUMMARY.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-03-SUMMARY.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-04-SUMMARY.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-05-SUMMARY.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-06-SUMMARY.md
@.planning/phases/09.1-provider-latency-and-cancellation/09.1-07-SUMMARY.md
@.planning/debug/llm-response-latency-profile.md

Project rules: this plan is alone in wave 4 and owns the `.wolf/` commits for the phase. Restore curated anatomy lines and drop `auto-detected` buglog entries the OpenWolf hook adds before committing (cerebrum 2026-10-11). The working tree may already hold uncommitted `.wolf/` edits from before the phase; keep them (never revert user changes) and add this phase's entries on top. Commit subjects start lowercase, no Co-Authored-By trailer. Never stub the provider in the latency or cancel check; measurement scaffolding lives only in a fresh `mktemp -d` directory, never in the repo or its tests.
</context>

## Artifacts this phase produces

Shared contract for all eight plans; this plan (the phase gate) creates no source artifact.

| Kind | Name | Where | Plan |
|---|---|---|---|
| file (new) | `src/providers/stream-json.ts` | provider layer | 01 (06 enforces the carry cap) |
| file (new) | `src/providers/claude-process.ts` | provider layer | 01 (06 adds the caps, the post-result backstop and the `backstopMs`/`killGraceMs` options; 05 adds the `child` option) |
| file (new) | `src/providers/candidate-stream.ts` | provider layer | 02 |
| file (new) | `src/providers/claude-prewarm.ts` | provider layer | 05 |
| file (new) | `tests/fixtures/fake-claude-stream.mjs` | real child replaying recorded stream-json | 01 (`success`, `auth`, `sigterm-slow`); 06 adds `hang-after-result`, `exit-no-result`, `die-before-init`, `stderr-flood`; 05 adds `ignore-eof` |
| file (new) | `tests/claude-process.test.ts` | tests | 01 (06 and 05 extend it) |
| file (new) | `tests/claude-stream-json.test.ts` | tests | 06 |
| file (new) | `tests/candidate-stream.test.ts` | tests | 02 |
| file (new) | `tests/claude-prewarm.test.ts`, `tests/claude-cli-prewarm.test.ts` | tests | 05 |
| file (new, planning) | `.planning/phases/09.1-provider-latency-and-cancellation/COVERAGE.md` | API coverage matrix | planning |
| type | `FetchOptions { signal?: AbortSignal; onCandidate?: (candidate: CommandCandidate) => void }` | `src/providers/provider.ts` | 01 |
| signature | `LLMAdapter.fetchCandidates(envelope, options?: FetchOptions)` | `src/providers/provider.ts` | 01 |
| function | `abortError()`, `isAbortError(error)` | `src/providers/provider.ts` | 01 |
| schema/type | `streamJsonResultSchema`, `StreamJsonResult` | `src/providers/stream-json.ts` | 01 |
| function | `createLineParser(onEvent, options?)`, `textDeltaOf(event)`, `isInitEvent(event)`, `buildStreamJsonUserLine(prompt)` | `src/providers/stream-json.ts` | 01 |
| option | `createLineParser` options `maxCarryBytes`, `onOverflow` | `src/providers/stream-json.ts` | 06 |
| const | `STREAM_JSON_CARRY_CAP_BYTES` = 1 MiB | `src/providers/stream-json.ts` | 01 declares it, 06 enforces it |
| const | `SIGKILL_GRACE_MS` = 1500, `POST_RESULT_BACKSTOP_MS` = 2000, `STDERR_CAP_BYTES` = 64 KiB | `src/providers/claude-process.ts` | 01 declares them; 06 arms the backstop and enforces the stderr cap |
| type | `ClaudeTurnOptions`, `ClaudeTurnStage`, `ClaudeTurnStageDetail`, `ClaudeTurnFailure`, `ClaudeTurnFailureReason` | `src/providers/claude-process.ts` | 01 |
| option | `ClaudeTurnOptions.backstopMs`, `ClaudeTurnOptions.killGraceMs` | `src/providers/claude-process.ts` | 06 |
| option | `ClaudeTurnOptions.child` (run the turn on a prewarmed child) | `src/providers/claude-process.ts` | 05 |
| function | `spawnClaudeChild(command, argv, cwd, env?)`, `terminateChild(child, graceMs?)`, `runClaudeTurn(options)` | `src/providers/claude-process.ts` | 01 |
| const/function | `CLAUDE_COMMAND` = `'claude'`, `buildClaudeCliArgv(envelope)` | `src/providers/claude-cli.ts` | 01 |
| signature | `fetchClaudeCliCandidates(envelope, remainingBudgetMs, options?)` | `src/providers/claude-cli.ts` | 01 |
| claude flags | `--input-format stream-json`, `--output-format stream-json`, `--verbose`, `--include-partial-messages` | claude argv | 01 |
| claude flag | `--effort <level>` | claude argv | 02 |
| const/type/function | `EFFORT_LEVELS`, `Effort`, `DEFAULT_EFFORT` = `'low'`, `resolveEffort()`, `ResolvedQqConfig.effort` | `src/shared/qq-config.ts` | 02 |
| config key | `effort` in `~/.config/qq/config.json` | qq-config, README, `docs/config.example.json` | 02 |
| const/function | `MAX_STREAMED_CANDIDATES` = 5, `createCandidateScanner(onCandidate)`, `parseStrictCandidateList(text)` | `src/providers/candidate-stream.ts` | 02 |
| IPC request field | `fetch-candidates.stream: z.literal(true).optional()` | `src/contracts/ipc.ts` | 03 |
| IPC response kind | `{ kind: 'candidate', candidate: commandCandidateSchema }` | `src/contracts/ipc.ts` | 03 |
| pong flag | `streamCandidates: true` | `ipc.ts`, `server.ts`, `bootstrap.ts` | 03 |
| signature | `requestDaemonFetch(socketPath, envelope, timeoutMs?, options?)`, `fetchCandidatesForUi(socketPath, envelope, options?)` | `src/daemon/fetch-client.ts` | 01 (03 adds `onCandidate` forwarding and the no-re-query-after-rows rule) |
| type | `CandidateListState` = `'arriving' \| 'complete' \| 'partial'` | `src/ui/modal-layout.ts` | 07 |
| const | `LIST_STATUS_ROW_LINES` = 1, `INCOMPLETE_LIST_NOTE` = `'list may be incomplete'` | `src/ui/modal-layout.ts` | 07 |
| field/prop | `CandidateSelectLayoutInput.listState`; `CandidateSelect` prop `listState` (default `'complete'`) | `modal-layout.ts`, `CandidateSelect.tsx` | 07 |
| function/const | `sdkOutputConfig(model, effort)`, `EFFORT_UNSUPPORTED_MODEL_RE` | `src/providers/claude.ts` | 04 |
| signature | SDK `fetchCandidates(envelope, rbuffer = '', timeoutMs = 25_000, options: FetchOptions = {})`; `claudeAdapter` forwards `options` | `src/providers/claude.ts` | 04 |
| test marker | `'messages.stream('` in the adapters (b) model-call list | `tests/steering.test.ts` | 04 |
| type | `PrewarmSpec { command, argv, cwd }`, `PrewarmMissReason` = `'disabled' \| 'empty' \| 'dead' \| 'cwd' \| 'prompt'`, `PrewarmTake` = `{ child } \| { miss }` | `src/providers/claude-prewarm.ts` | 05 |
| function | `prewarmKey(spec)`, `enablePrewarm()`, `disablePrewarm()`, `takePrewarmed(spec)`, `schedulePrewarm(spec)`, `retirePrewarmed()`, `prewarmSnapshot()` | `src/providers/claude-prewarm.ts` | 05 |
| debug-log stages | provider `cli spawned`, `cli init`, `cli first delta`, `cli result`, `cli exit`, `cli aborted`, `cli timed out`, `claude-cli aborted`; daemon `fetch aborted`; client `fetch aborted` | debug log | 01 |
| debug-log stages | provider `cli first candidate` (02); daemon `replied candidate` (03); provider `request aborted` (04); provider `prewarm hit`, `prewarm miss`, `prewarm spawned`, `prewarm retired`, `prewarm retry cold` (05); client `first candidate received`, `llm request failed after rows` (07) | debug log | 02-05, 07 |
| qq CLI flags | none added | — | — |

<tasks>

<task type="auto">
  <name>Task 1: Apply the phase's OpenWolf records and replace the superseded claude -p guidance</name>
  <files>.wolf/anatomy.md, .wolf/cerebrum.md, .wolf/memory.md, .wolf/buglog.json</files>
  <read_first>
    - .planning/phases/09.1-provider-latency-and-cancellation/09.1-02-SUMMARY.md through 09.1-07-SUMMARY.md ("OpenWolf entries for plan 08" sections)
    - .wolf/cerebrum.md (Key Learnings line on `claude -p` flags, as updated by plan 01; Decision Log; Do-Not-Repeat)
    - .wolf/anatomy.md (src/providers, src/daemon, src/client, src/ui, src/shared, tests sections)
    - .wolf/buglog.json (highest existing bug id)
  </read_first>
  <action>
1. `.wolf/anatomy.md`: add or rewrite the entries listed in the plan 02-07 SUMMARYs: `src/providers/candidate-stream.ts`, `src/providers/claude-prewarm.ts`, `tests/candidate-stream.test.ts`, `tests/claude-stream-json.test.ts`, `tests/claude-prewarm.test.ts`, `tests/claude-cli-prewarm.test.ts`, and the changed `qq-config.ts`, `claude-cli.ts`, `claude.ts`, `claude-default.ts`, `stream-json.ts`, `claude-process.ts`, `tests/fixtures/fake-claude-stream.mjs`, `ipc.ts`, `server.ts`, `bootstrap.ts`, `fetch-client.ts`, `run-foreground.ts`, `CandidateSelect.tsx`, `modal-layout.ts`, `src/cli/commands/daemon.ts` and the changed tests. Keep curated descriptions; one line each, in the file's existing style.

2. `.wolf/cerebrum.md`:
   - Make sure no Key Learnings line still recommends text output, a prompt on argv or an ignored stdin for `claude -p` (plan 01 rewrote it; extend it with `--effort` from config and the prewarm rule).
   - Add the learnings the SUMMARYs list (the runner caps stdout carry at 1 MiB and stderr at 64 KiB, and a child still alive 2 s after `result` gets SIGTERM, then SIGKILL after 1.5 s; effort validated by QueQue because Claude Code only warns on an unknown value; `streamCandidates` is the third pong flag; CandidateSelect resets only on the first arrival and keeps the highlight by candidateKey; no Zellij report while `listState` is `'arriving'`; the SDK path uses `messages.stream` + `finalMessage()`; prewarm is daemon-only, keyed by sha256 of {command, cwd, argv}, refilled after every settle, never at daemon start).
   - Decision Log entry dated today for Phase 09.1: stream-json with resolve-on-result and an `is_error` gate (D-04); per-candidate IPC with `candidates` kept as the done signal, add-alongside (D-05); one prewarmed process matched on cwd + argv, not started at daemon start (D-11 amended, D-12); abort from socket close to SIGTERM/SIGKILL and the SDK signal (D-13).

3. `.wolf/buglog.json`: append the entries the SUMMARYs list (next free ids); keep the file valid JSON. `.wolf/memory.md`: one line per action and a session summary for the phase.
  </action>
  <verify>
    <automated>node -e "JSON.parse(require('fs').readFileSync('.wolf/buglog.json','utf8'))" && grep -c "claude-prewarm.ts" .wolf/anatomy.md && grep -c "candidate-stream.ts" .wolf/anatomy.md && grep -c "streamCandidates" .wolf/cerebrum.md</automated>
    <fails_when>non-zero exit (invalid JSON, or grep -c printing 0 and exiting 1 for a missing entry)</fails_when>
  </verify>
  <acceptance_criteria>
    - `.wolf/buglog.json` parses as JSON
    - `grep -c "claude-prewarm.ts" .wolf/anatomy.md`, `grep -c "candidate-stream.ts" .wolf/anatomy.md` and `grep -c "stream-json.ts" .wolf/anatomy.md` are each at least 1
    - `grep -c "streamCandidates" .wolf/cerebrum.md` is at least 1 and `grep -c "09.1" .wolf/cerebrum.md` is at least 1
    - `grep -n "output-format text" .wolf/cerebrum.md` prints no Key Learnings line that presents text output as the current `claude -p` flags (a Do-Not-Repeat or history mention is fine)
  </acceptance_criteria>
  <done>Every new and changed file has an anatomy entry, cerebrum carries the phase's learnings and decisions with the old `claude -p` advice replaced, and buglog and memory are up to date.</done>
</task>

<task type="auto">
  <name>Task 2: Run the full gate and prepare the manual real-provider latency and cancel check</name>
  <files>.wolf/memory.md</files>
  <read_first>
    - .planning/phases/09.1-provider-latency-and-cancellation/09.1-VALIDATION.md (Manual-Only Verifications)
    - .planning/debug/llm-response-latency-profile.md (baseline table and how stage timestamps were read)
    - .planning/debug/resolved/modal-blank-before-loading.md (reading debug-log stage timestamps)
    - .wolf/cerebrum.md (inline live-capture recipe 2026-10-11; the brew widget shadows the dev widget, 2026-10-10; Zellij repro recipe)
    - The "Human checks for end-of-phase UAT" sections of the 01, 05 and 07 SUMMARYs
  </read_first>
  <action>
1. Run the full gate: `pnpm test:run && pnpm typecheck && pnpm lint && pnpm build`. If a timing-sensitive test fails, check `uptime` first (bug-206); re-run on an idle machine before treating it as a regression, and record the load in the SUMMARY.

2. Create a fresh scratch directory with `mktemp -d` (never a path inside the repo, never a reused session scratchpad) and write a small Node script there that reads a QueQue debug log (path given as its argument) and prints, per `??` session, the milliseconds from the client `command start` line to `first candidate received` and to `candidates received`, plus the provider `prewarm hit`/`prewarm miss` reason and the `cli init`, `cli first delta` and `cli result` offsets. It prints no prompt or command text (the log redacts it by default; do not set QQ_DEBUG_VERBOSE). Print the scratch directory path in the SUMMARY. Nothing from it is committed.

3. Write the human checks below into the SUMMARY verbatim, together with the human checks collected in the 01, 05 and 07 SUMMARYs, so the verifier harvests them into the end-of-phase UAT. Append a memory line.
  </action>
  <verify>
    <automated>pnpm test:run && pnpm typecheck && pnpm lint && pnpm build</automated>
    <fails_when>non-zero exit from any command, or a "FAIL" line in the vitest output</fails_when>
    <human-check>Real-provider latency and cancellation, on an idle machine (`uptime` load average well below the CPU count; the profile ran at 3-6 on 12 CPUs). Setup: `pnpm build`; stop any running dev daemon so the new build is used (plan 03's `streamCandidates` flag also forces replacement); open `env -u ZELLIJ zsh -f -i`, set `QQ_DEV_ROOT` to the repo and `QQ_DEBUG_LOG_FILE` to a file in the scratch dir, and `source shell/zsh/queque.zsh` (the brew widget otherwise wins, cerebrum 2026-10-10). (1) D-01/D-04/D-05/D-11: type `show me how to use z3??` five times in the repo directory, pressing Enter on a row each time. The first row appears before the rest, under the `thinking…` row. Run the scratch summarizer on the log: the first query shows `prewarm miss` (`empty`) and runs cold; the later ones show `prewarm hit`. Record the warm-path median of `command start` → `first candidate received` (plus about 0.38 s from keypress to `command start`, per the profile) next to the 5.3 s baseline and the ~2 s estimate. (2) D-12: run one query from another directory; the log shows `prewarm miss` with reason `cwd`. (3) D-13/D-15/D-14: start a query and press Esc during `thinking…`; the prompt returns at once with the buffer unchanged, and within about 2 s `ps -o pid,ppid,command -ax | grep 'claude -p'` shows only the one idle prewarm child of the daemon, whose command line contains no query text. (4) D-07: start a query and press Enter as soon as the first row appears; that row is inserted and the same `ps` check passes. (5) D-06/D-08/D-09: while rows arrive, press Down to the second row; later rows do not move the highlight; type a filter word and check that later rows only appear if they match. (6) D-10/D-17: inside Zellij (`zellij` session, `??` in a pane), the floating pane opens at its cap, fills in, and resizes once when the list completes; filtering afterwards does not shrink it. (7) D-16 (opportunistic): if a query fails after rows arrived (for example by cutting the network mid-answer), the rows stay selectable under `list may be incomplete`. D-02 and D-03 are covered by tests only (no API key on this machine); note that in the UAT.</human-check>
  </verify>
  <acceptance_criteria>
    - `pnpm test:run && pnpm typecheck && pnpm lint && pnpm build` exits 0
    - The SUMMARY contains a "Human checks for end-of-phase UAT" section with the check above and the checks from the 01, 05 and 07 SUMMARYs
    - The SUMMARY names the scratch directory and `git status --porcelain` shows no new untracked file from it inside the repo
  </acceptance_criteria>
  <done>The merged phase passes the full gate, a scratch latency summarizer is ready outside the repo, and every manual real-provider check is recorded for the end-of-phase UAT.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| debug log → scratch summarizer | Log lines may hold redacted request metadata |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-09.1-20 | Information disclosure | live-check debug log and scratch summarizer | low | mitigate | QQ_DEBUG_VERBOSE stays unset so lbuffer, rbuffer, queryText and request are redacted; the summarizer prints only timings and stage names; the scratch dir comes from `mktemp -d` and is never committed |
| T-09.1-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs; `package.json` and `pnpm-lock.yaml` unchanged by this plan's commits |
</threat_model>

<verification>
- `pnpm test:run && pnpm typecheck && pnpm lint && pnpm build` exits 0.
- `git diff --stat <plan-base-sha>..HEAD -- package.json pnpm-lock.yaml src tests` is empty (this plan changes only `.wolf/`).
</verification>

<success_criteria>
- OpenWolf records for the whole phase are committed once, by this plan.
- The full gate is green and the manual latency and cancellation checks (D-01 to D-17) are ready for the end-of-phase UAT.
</success_criteria>

<output>
Create `.planning/phases/09.1-provider-latency-and-cancellation/09.1-08-SUMMARY.md` when done, with the "Human checks for end-of-phase UAT" section and the scratch directory path.
</output>


## Review Instructions

**Verify against source — do not review the plan text in isolation.** The plans reference real files, migrations, routes, and tests in this repo.
1. Open the referenced files and check each claim against the actual code.
2. For every strength or concern, cite concrete `path/to/file:line` evidence plus the mechanism.
3. When a plan asserts a mechanism works (a guard, a query filter, a test that exercises a path), trace whether it actually does what is claimed — do not take the plan's word for it.
4. If you cannot read the repo (no file access), say so and downgrade that finding to an open question rather than asserting it.

Findings citing `file:line` evidence are weighted far more heavily than impressionistic ones; a review that only restates the plan's own claims has low value.

**Plan coverage is mandatory (#3301).** The exact list of plan ids and the total plan count for this review are given in the "## Plan Coverage Manifest" section below. Give **every** listed id its own `##`-level section headed with that id **verbatim** (e.g. `## 09.1-01`) before writing any cross-plan comparison, an overall risk assessment, or a consensus-style summary. A review that stops before every id has its own section is an incomplete review, not a summary — if you must stop early, say so explicitly and name which ids you did not reach.

Analyze each plan and provide:

1. **Summary** — One-paragraph assessment
2. **Strengths** — What's well-designed (bullet points)
3. **Concerns** — Potential issues, gaps, risks (bullet points with severity: HIGH/MEDIUM/LOW)
4. **Suggestions** — Specific improvements (bullet points)
5. **Risk Assessment** — Overall risk level (LOW/MEDIUM/HIGH) with justification

Focus on:
- Missing edge cases or error handling
- Dependency ordering issues
- Scope creep or over-engineering
- Security considerations
- Performance implications
- Whether the plans actually achieve the phase goals

Output your review in markdown format.

## Plan Coverage Manifest

Total plans in this review: 8

Plan ids (give each one its own `##`-level section, headed verbatim):
- 09.1-01
- 09.1-02
- 09.1-03
- 09.1-04
- 09.1-05
- 09.1-06
- 09.1-07
- 09.1-08

[1m[33mwarning:[0m[0m failed to parse hooks config /Users/samuel/.codex/hooks.json: unknown field `SessionStart`, expected `description` or `hooks` at line 2 column 16
[2m2026-10-12T05:48:36.563490Z[0m [31mERROR[0m [2mrmcp::transport::worker[0m[2m:[0m worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer error=\"invalid_token\", error_description=\"No authorization provided\", resource_metadata=\"https://mcp.vercel.com/.well-known/oauth-protected-resource\"" })
[1m[33mwarning:[0m[0m Skill descriptions were shortened to fit the 2% skills context budget. Codex can still see every skill, but some descriptions are shorter. Disable unused skills or plugins to leave more room for the rest.
[1mhook:[0m [2mSessionStart[0m
[1mhook:[0m [2mSessionStart[0m
[1mhook:[0m [2mSessionStart[0m
[1mhook:[0m [2mSessionStart[0m Failed
[1mhook:[0m [2mSessionStart[0m Failed
[1mhook:[0m [2mSessionStart[0m Failed
[1m[31mERROR:[0m[0m You've hit your usage limit. Upgrade to Plus to continue using Codex (https://chatgpt.com/explore/plus), or try again at Nov 4th, 2026 3:06 AM.
[1m[31mERROR:[0m[0m You've hit your usage limit. Upgrade to Plus to continue using Codex (https://chatgpt.com/explore/plus), or try again at Nov 4th, 2026 3:06 AM.

Diagnosis: codex ran at effort=high and exited with status 1.
