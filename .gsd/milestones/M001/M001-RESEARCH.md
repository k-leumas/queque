# Research Summary: Que-Que

## Recommended Direction

Build Que-Que as a TypeScript/Node LTS product with three runtime layers: `zsh` shell adapter, foreground TUI client, and a per-user background daemon over a Unix socket. Optimize the fast path first: literal `??` invocation, ranked command candidates with explanations, and safe shell-buffer replacement.

## Table Stakes

- Inline shell-native invocation
- Explainable command suggestions
- Keyboard-only command selection
- Clarification flow for ambiguous requests
- Safe cancel and safe command return

## Differentiators

- Pre-trigger shell text becomes context
- Dynamic intent-driven context enrichment
- Teach while assisting via short command explanations
- Architecture that preserves future shell/provider/plugin expansion

## Watch Out For

- Breaking shell buffer integrity
- Over-sending irrelevant local context
- Letting confidence routing feel opaque
- Overcomplicating the TUI before the fast path is excellent
- Hard-coding provider or shell behavior into the daemon core

## Build Order Recommendation

1. Shell bridge + structured result contract
2. Daemon and request/response plumbing
3. Claude fast path with ranked command suggestions
4. Fuzzy-list TUI interaction
5. Clarification chat inside the same TUI
6. Hardening, privacy defaults, and extension seams

# Architecture Research: Que-Que

## Recommended Component Boundaries

### 1. Shell Adapter

Responsibilities:
- Detect literal `??`
- Capture `LBUFFER`, `RBUFFER`, cursor position, and shell metadata
- Invoke the foreground client
- Apply the returned command/cursor update back to the shell buffer

### 2. Foreground Client

Responsibilities:
- Parse invocation context from the shell adapter
- Talk to the background daemon over IPC
- Render the TUI for command selection and clarification chat
- Return a structured result to the shell adapter

### 3. Background Daemon

Responsibilities:
- Stay warm between requests
- Own provider initialization
- Run intent routing and context enrichment
- Manage active clarification sessions
- Return structured responses to the client

### 4. Intent Router

Responsibilities:
- Categorize the request
- Decide which context providers should run
- Assign or refine confidence for direct command suggestions vs clarification

### 5. Context Provider Registry

Responsibilities:
- Supply cheap base context for every request
- Add intent-specific context only when selected by the router
- Hide implementation details of cwd, git, media tool, or system inspections

### 6. Provider Registry

Responsibilities:
- Encapsulate Claude requests and response parsing
- Support future providers without changing the daemon contract
- Require each backend to implement the same adapter interface for direct-command requests, clarification turns, confidence/result normalization, and user-safe error handling

### 7. Command/TUI State Model

Responsibilities:
- Represent ranked command candidates, explanations, and selected index
- Represent clarification turns and confidence updates in the same session state

## Data Flow

1. User types in `zsh`.
2. Shell adapter detects `??`.
3. Shell adapter sends buffer context to `qq`.
4. Client forwards request to daemon.
5. Daemon routes intent.
6. Daemon gathers base and intent-specific context.
7. Daemon calls Claude provider.
8. Daemon returns either:
   - ranked command candidates
   - clarification question/session state
   - cancel/error
9. Client renders list or chat.
10. User accepts or cancels.
11. Client returns structured result to shell adapter.
12. Shell adapter updates live shell buffer.

## Build Order Implications

- Build shell adapter and result contract first; everything else depends on this loop existing.
- Stand up the daemon before the richer TUI; startup characteristics affect UX.
- Keep candidate list and clarification state in one TUI model; avoid separate mini-apps.
- Put extension registries in place before adding non-default providers or shells.

# Stack Research: Que-Que

## Recommended Stack

### Runtime and Language

- **Node LTS + TypeScript** — fastest path to a working shell/TUI/LLM prototype with strong tooling and shared types across client, daemon, and providers.

### CLI and Packaging

- **Single `qq` CLI package with subcommands** such as daemon/client/debug modes — keeps distribution simple while separating runtime responsibilities internally.
- **`pnpm` 10.33.2** with a workspace-ready layout even if MVP starts as a single package — makes it easier to split shell adapters, provider adapters, and plugin APIs later.
- **`tsup` 8.5.1** — fast TS bundling for development and packaging without over-investing in build complexity.
- **`cac` 6.7.14** — small, proven CLI argument layer for subcommands like `qq daemon`, `qq query`, and debug modes.

### Terminal UI

- **`ink` 7.0.1** — fastest route to a composable command list plus clarification chat in one TUI surface.
- **`ink-select-input` 6.2.0** and **`ink-text-input` 6.0.0** as starting accelerators — use them where they fit, but do not let them dictate the shell-return contract or raw-key behavior.
- **Drop to raw input handling where needed** for exact `Esc`, arrow-key, and focus behavior. The UI abstraction should not own shell integration.

### Shell Integration

- **Native `zsh` + ZLE widget** — required for literal `??` interception and writing the result back into the live buffer.

### IPC and Background Runtime

- **Per-user daemon over a Unix socket** — best way to keep repeat invocations fast and share warm provider/runtime state across terminal windows.

### Data Validation and Internal Contracts

- **`zod` 4.1.5** for runtime schema validation — protects shell integration from malformed provider or daemon responses and gives one schema layer for Claude responses, daemon IPC, config, and future plugin manifests.

### Model Provider

- **`@anthropic-ai/sdk` 0.92.0** — first hosted provider integration using `ANTHROPIC_API_KEY`, isolated behind a provider registry so more providers can land later.

### Testing

- **`vitest` 4.0.4** — covers intent routing, IPC contracts, and shell result formatting quickly.
- **Focused shell integration tests** for the `zsh` wrapper behavior and result contract.

## Concrete MVP Baseline

- Package manager: `pnpm`
- Runtime: `node` LTS
- Language: `typescript`
- CLI parsing: `cac`
- Bundling: `tsup`
- TUI: `ink`
- TUI helpers: `ink-select-input`, `ink-text-input`
- Validation: `zod`
- Provider SDK: `@anthropic-ai/sdk`
- Tests: `vitest`

## Why This Stack Fits

- Optimizes for speed of implementation over binary minimalism.
- Supports shared types across client, daemon, provider, and future plugins.
- Leaves room for a plugin system without forcing a monorepo from day one.
- Keeps the highest-risk pieces explicit: shell integration, raw keyboard handling, and provider routing.

## What Not To Optimize Early

- Native binaries — not needed to validate the product thesis.
- Cross-shell support — keep `zsh` first.
- Provider breadth — one provider behind the right interface is enough for v1.
- Persistent local memory — privacy defaults matter more than convenience.

## Confidence

- **High**: Node LTS, TypeScript, ZLE integration, Unix-socket daemon, Zod, Anthropic SDK, pnpm, tsup, vitest, cac.
- **Medium**: Ink as the long-term TUI layer; verify raw input and focus ergonomics during Phase 4 and be willing to replace helper components if they constrain the UX.

# Features Research: Que-Que

## Table Stakes

### Shell-Native Invocation

- Open inline from the shell without switching to a browser or separate app.
- Return the final command back into the shell buffer.
- Cancel cleanly without damaging the current command line.

### Explainable Command Suggestions

- Show one or more suggested commands, not just a hidden best guess.
- Explain what each command does in plain language.
- Keep keyboard-only navigation fast and predictable.

### Clarification for Ambiguous Requests

- Recognize when a request is not specific enough.
- Ask clarifying questions without abandoning the terminal flow.
- Preserve context across clarification turns and return a refined result.

### General-Purpose Scope

- Work for filesystem, media, git/code, networking, and system tasks.
- Avoid repo-first assumptions when the user request is not code-related.

## Differentiators

### Pre-Trigger Context

- Use text already present before `??` as part of the request context.
- Treat the surrounding shell edit state as a first-class source of intent.

### Dynamic Context Enrichment

- Infer task type first, then gather only relevant local context.
- This keeps results useful without over-sharing irrelevant system data.

### Teaching Through Suggestions

- Make explanations a product feature, not an afterthought.
- Help newer users learn what the terminal is doing while still serving advanced users.

### Extension-Oriented Architecture

- Design shell adapters, providers, context sources, and storage as registrable components.
- This unlocks later `bash`, provider, and plugin work without a rewrite.

## Anti-Features

- Full prompt takeover or alternate-shell UX
- Auto-execution of generated commands
- Repo-centric context gathering for unrelated tasks
- Hidden reasoning with no visible explanation of command behavior
- Persistent logging/history by default

## Complexity Notes

- Shell-native invocation is high leverage and high risk.
- Clarification flow and command-list flow should share one TUI state model.
- Explanation strings must stay concise or the TUI becomes noisy.
- Dynamic context gathering needs strong guardrails so “more context” does not become “too much context.”

# Pitfalls Research: Que-Que

## Pitfall 1: Breaking the Shell Editing Flow

**What goes wrong:** The tool takes over the prompt, loses the current buffer, or returns the user to a surprising shell state.

**Warning signs:**
- Buffer text disappears or reorders after cancel.
- Cursor lands in the wrong place after command insertion.
- The shell wrapper becomes more complex than the client contract.

**Prevention:**
- Keep the shell result contract minimal and explicit.
- Test `Esc`, accept, and error paths before building richer AI behavior.
- Treat shell-buffer integrity as a release gate.

**Phase:** 1 and 4

## Pitfall 2: Over-Contextualizing Requests

**What goes wrong:** The tool sends repo or filesystem context that is irrelevant to the request, making results worse and weakening privacy posture.

**Warning signs:**
- Media/file tasks generate git-heavy commands.
- Provider prompts grow too large for simple tasks.
- New context providers get added without intent gating.

**Prevention:**
- Separate base context from intent-specific context.
- Require every context provider to justify what it improves.
- Keep provider payloads inspectable in debug mode.

**Phase:** 2 and 6

## Pitfall 3: Confidence Routing Feels Arbitrary

**What goes wrong:** The tool asks unnecessary questions for obvious tasks or returns low-quality direct commands for ambiguous tasks.

**Warning signs:**
- Common tasks bounce into chat unexpectedly.
- Users cannot predict why list mode vs chat mode was chosen.
- Confidence scoring logic is hard-coded inside prompts only.

**Prevention:**
- Keep a visible threshold policy and log confidence decisions in debug mode.
- Build test fixtures for clear vs ambiguous prompts.
- Allow prompt and router heuristics to evolve independently.

**Phase:** 3 and 5

## Pitfall 4: TUI Becomes Too Clever

**What goes wrong:** The UI tries to do too much at once and slows down the path for straightforward command selection.

**Warning signs:**
- List mode feels slower than a simple command picker.
- Chat mode and list mode have conflicting keyboard rules.
- Explanations become long, noisy blocks.

**Prevention:**
- Optimize list mode first.
- Keep explanations short and scannable.
- Make chat mode reuse the same command result surface, not a new abstraction.

**Phase:** 4 and 5

## Pitfall 5: No Extension Seam, Future Rewrite

**What goes wrong:** Provider, shell, and storage decisions get hard-coded into the daemon, blocking later plugin work.

**Warning signs:**
- `zsh`, Claude, and base context logic live in one orchestration module.
- Adding `bash` or local history requires touching most core files.
- Registries exist in name only but are bypassed in practice.

**Prevention:**
- Use registries/interfaces from the start.
- Make built-ins register through the same path future plugins will use.
- Keep the plugin system prioritized immediately after cross-OS `zsh`.

**Phase:** 2 and 6