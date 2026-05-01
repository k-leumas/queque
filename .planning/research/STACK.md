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
