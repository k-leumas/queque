# Que-Que

## What This Is

Que-Que is a `zsh`-integrated command-line assistant that opens from a literal `??` trigger while the user is editing the shell command line. It stays inside the terminal workflow, uses the text already typed before the trigger as context, and returns an explainable shell command back into the live buffer instead of pushing the user out to a browser or a prompt-taking CLI.

The initial product is for developers and terminal users who want faster command recall without giving up control, but it should also make the terminal less intimidating for newer users by showing what suggested commands do.

## Core Value

Turn natural-language intent into a shell command that feels native to the terminal workflow, not bolted on top of it.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Open from a literal `??` trigger inside `zsh` without taking over the shell prompt.
- [ ] Use pre-trigger command-line text plus current shell context to produce relevant command suggestions.
- [ ] Show a fuzzy-finder-like TUI with ranked commands and short explanations for high-confidence requests.
- [ ] Keep low-confidence requests inside an in-TUI clarification chat until a refined command is ready.
- [ ] Return the selected command back into the shell buffer safely and predictably.
- [ ] Define an LLM adapter interface so each backend implements the same request/response contract.

### Out of Scope

- Public plugin marketplace in v1 — extension seams matter now, but third-party loading can wait until the core UX is stable.
- Direct command execution in v1 — insertion-only is safer and preserves user control.
- Multi-shell support in v1 — macOS `zsh` is the fastest route to a usable product in two weeks.
- Persistent history by default — privacy-forward defaults matter more than convenience in the first release.

## Context

The product exists because current AI command-line helpers still feel like strangers in the normal terminal flow. Browser-based chat requires copy-paste, and many CLI tools either take over the prompt, feel constraining, or do not expose enough levers to tune their behavior. Que-Que should feel more seamless: invoked inline from the current shell edit session, dismissible with `Esc`, and capable of writing the final command back into the same buffer.

The intended audience spans advanced shell users and newer users. Advanced users should reach for Que-Que when they know what they want but do not want to recall exact syntax, quoting, or flag combinations. Newer users should benefit from short command explanations attached to each result so the tool teaches while it assists.

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

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-15 — Phase 03 complete (Claude fast path, LLMAdapter contract, ranked candidates, error propagation, ZSH buffer safety)*
