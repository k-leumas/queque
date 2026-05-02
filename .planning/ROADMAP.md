# Roadmap: Que-Que

## Overview

Que-Que moves from a shell-bridge prototype to a daily-driver terminal assistant by locking down the shell contract first, then layering in dynamic intent routing, Claude-backed command generation, a fuzzy-finder-style TUI, clarification chat, and hardening/extension seams. The roadmap is ordered to get a usable macOS `zsh` product working quickly while preserving room for cross-OS `zsh`, plugins, additional providers, and local models after the MVP.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Shell Bridge and Result Contract** - Make literal `??` invocation and shell-buffer replacement real.
- [x] **Phase 2: Intent Router and Context Pipeline** - Build the request model that keeps Que-Que general-purpose instead of repo-centric.
- [ ] **Phase 3: Claude Fast Path and Ranked Suggestions** - Return explainable command candidates for clear requests.
- [ ] **Phase 4: Fuzzy TUI Selection UX** - Make command selection feel natural, keyboard-first, and stable.
- [ ] **Phase 5: Clarification Chat in the Same TUI** - Keep ambiguous requests in flow until a refined command is ready.
- [ ] **Phase 6: Hardening, Privacy Defaults, and Extension Seams** - Make the product safe enough to use daily and future-proof enough to extend.

## Phase Details

### Phase 1: Shell Bridge and Result Contract
**Goal**: Deliver a working `zsh` loop where literal `??` opens Que-Que, `Esc` cancels safely, and a chosen command comes back into the live shell buffer.
**Depends on**: Nothing (first phase)
**Requirements**: SHL-01, SHL-02, SHL-03, SHL-04, RUN-01
**Success Criteria** (what must be TRUE):
  1. User can type `??` in `zsh` and open Que-Que without leaving the shell editing session.
  2. Text already typed before the trigger is captured and available to the client request.
  3. Cancel returns the user to the shell with no buffer changes.
  4. Accepting a result writes a command and cursor position back into the shell buffer reliably.
**Plans**: 3 plans
**UI hint**: no

Plans:
- [x] 01-01-PLAN.md — Scaffold the repo baseline with `pnpm`, TypeScript, `cac`, `tsup`, `vitest`, and shared `zod` schemas.
- [x] 01-02-PLAN.md — Implement ZLE widget and literal `?` interception strategy plus the structured shell result contract.
- [x] 01-03-PLAN.md — Stand up the daemon bootstrap path and basic client invocation loop.

### Phase 2: Intent Router and Context Pipeline
**Goal**: Make Que-Que general-purpose by separating base context from intent-specific context and by registering context sources behind clean interfaces.
**Depends on**: Phase 1
**Requirements**: INT-01, INT-02, INT-03, EXT-01
**Success Criteria** (what must be TRUE):
  1. Requests are classified into broad task categories before extra context is gathered.
  2. Base context is always present and intent-specific context only appears when relevant.
  3. Media/file tasks do not incorrectly inherit git/code assumptions.
  4. Built-in context providers register through the same internal interface future extensions will use.
**Plans**: 3 plans
**UI hint**: no

Plans:
- [x] 02-01-PLAN.md — Define request contracts (RequestIntent, NormalizedRequest, ContextEnvelope) and implement deterministic classifyIntent router.
- [x] 02-02-PLAN.md — Build base context builder, git/filesystem providers, two-pass pipeline, and rewire foreground client + Claude adapter.
- [x] 02-03-PLAN.md — Add four internal registries (context-providers, provider-backends, shell-adapters, storage-hooks) and wire built-ins through them.

### Phase 3: Claude Fast Path and Ranked Suggestions
**Goal**: Produce ranked, explainable command suggestions quickly for requests that are clear enough to skip clarification.
**Depends on**: Phase 2
**Requirements**: PRV-01, PRV-02, PRV-03, CMD-01, CMD-02, SAFE-01
**Success Criteria** (what must be TRUE):
  1. Que-Que can call Claude using `ANTHROPIC_API_KEY`.
  2. Claude is implemented through the shared LLM adapter contract rather than a special-case code path.
  3. High-confidence requests return ranked command candidates instead of raw model text.
  4. Every command candidate includes a concise explanation of what it will do.
  5. Provider or parsing failures surface without mutating the shell buffer.
**Plans**: 3 plans
**UI hint**: no

Plans:
- [ ] 03-01: Define the shared LLM adapter contract and implement the Claude backend against it.
- [ ] 03-02: Build the fast-path prompt contract, confidence extraction, and ranking model on top of the adapter.
- [ ] 03-03: Add error handling, debug surfaces, and shell-safe fallback behavior.

### Phase 4: Fuzzy TUI Selection UX
**Goal**: Turn high-confidence command selection into a fast, intuitive, keyboard-only flow with explanations visible inline.
**Depends on**: Phase 3
**Requirements**: TUI-01, CMD-03, RUN-02
**Success Criteria** (what must be TRUE):
  1. The TUI opens with focus in the input area.
  2. User can navigate command candidates with arrow keys and confirm one without leaving the TUI.
  3. The TUI stays responsive across repeated invocations through the daemon.
  4. Daemon reconnect/restart behavior does not break selection flow or corrupt shell state.
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [ ] 04-01: Build the command-list UI shell in Ink with input focus and candidate rendering.
- [ ] 04-02: Implement keyboard navigation, selection, and result handoff.
- [ ] 04-03: Harden client/daemon lifecycle around stale sockets and reconnects.

### Phase 5: Clarification Chat in the Same TUI
**Goal**: Keep ambiguous requests inside a refinement loop until the tool can return a stronger command suggestion.
**Depends on**: Phase 4
**Requirements**: INT-04, TUI-02, TUI-03
**Success Criteria** (what must be TRUE):
  1. Requests below the confidence threshold enter clarification mode instead of forcing a weak command guess.
  2. Clarification happens in the same TUI surface, not a separate prompt flow.
  3. Clarification turns can refine intent and return either a final command or a ranked command list.
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [ ] 05-01: Add clarification session state and confidence-router branching.
- [ ] 05-02: Implement chat-style message rendering and follow-up input flow.
- [ ] 05-03: Return refined command suggestions from clarification back into the existing selection UX.

### Phase 6: Hardening, Privacy Defaults, and Extension Seams
**Goal**: Make Que-Que safe for daily use while preserving the extension architecture needed for cross-OS `zsh`, plugins, new providers, and local history.
**Depends on**: Phase 5
**Requirements**: CMD-04
**Success Criteria** (what must be TRUE):
  1. Que-Que remains insertion-only and never auto-executes commands.
  2. Privacy-sensitive defaults are documented and enforced in base request/context handling.
  3. Built-in modules use extension registries consistently instead of bypassing them.
  4. The codebase is ready for cross-OS `zsh` as the next delivery step and plugin work immediately after.
**Plans**: 3 plans
**UI hint**: no

Plans:
- [ ] 06-01: Implement safety guards and privacy-aware context filtering.
- [ ] 06-02: Audit extension seams and convert any direct built-in coupling to registry-backed modules.
- [ ] 06-03: Package the MVP for daily-driver usage and document the next expansion path.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Shell Bridge and Result Contract | 3/3 | Complete | 2026-05-02 |
| 2. Intent Router and Context Pipeline | 3/3 | Complete | 2026-05-02 |
| 3. Claude Fast Path and Ranked Suggestions | 0/3 | Not started | - |
| 4. Fuzzy TUI Selection UX | 0/3 | Not started | - |
| 5. Clarification Chat in the Same TUI | 0/3 | Not started | - |
| 6. Hardening, Privacy Defaults, and Extension Seams | 0/3 | Not started | - |
