# QueQue Extension Seams

QueQue is built around registries so new shells, providers, context sources, and storage backends can land without rewriting the client.

## Registries (Phase 2 + Phase 6)

| Registry | Register | Resolve | Default built-in |
|----------|----------|---------|------------------|
| Context providers | `registerContextProvider()` | `listContextProviders()` | `git-context`, `filesystem-context` |
| Provider backends | `registerProviderBackend()` | `getProviderAdapter()` | `claude` (Anthropic SDK) |
| Shell adapters | `registerShellAdapter()` | `listShellAdapters()` | `zsh` |
| Storage hooks | `registerStorageHook()` | `listStorageHooks()` | `noop` (no persistence) |

Built-ins wire up in `src/registry/bootstrap.ts`. Production code should resolve through registries — not import adapters directly.

## Provider resolution

1. `detectProvider()` — pre-flight check (anthropic-key → claude-cli → ollama → openai-key → none)
2. `resolveAdapter(detected)` — maps detection to a registered `LLMAdapter`

Phase 8 adds subprocess adapters for Claude CLI, Ollama, and OpenAI. Phase 6 wires the Anthropic SDK path through the registry.

## Roadmap expansion

### Phase 7 — Local learning

- `storage-hooks` registry → event log on accepted commands
- SQLite pattern index in the daemon for cache hits before LLM calls
- All data stays on disk under `~/.local/share/qq/` — no cloud sync

### Phase 8 — Zero-config providers

- Extend `resolveAdapter()` for `claude-cli`, `ollama`, `openai-key`
- Setup wizard when `detectProvider()` returns `none`

### Phase 5 (deferred) — Clarification chat

- In-TUI refinement loop for low-confidence queries
- Workaround today: `Esc` → edit query → `??` again

### Cross-OS zsh

- `qq init zsh` resolves `queque.zsh` from Homebrew (`/opt/homebrew`, `/usr/local`, Linuxbrew) or npm package
- Future: additional shell adapters via `registerShellAdapter()`

### Plugins (post-MVP)

- Manifest loading for third-party `registerContextProvider` / `registerProviderBackend` modules
- No public marketplace in v1

## Privacy configuration

QueQue loads `~/.config/qq/config.json` (override with `QQ_CONFIG_FILE`). See [config.example.json](config.example.json).

| Field | Purpose |
|-------|---------|
| `privacy.sensitivePathPatterns` | Extra regex patterns merged onto built-in defaults (`.env`, credentials, keys, etc.) |
| `privacy.redactLogKeys` | Extra JSON keys to redact in debug logs |
| `privacy.allowFileRead` | Opt-in for future file-content context (D-06); env `QQ_ALLOW_FILE_READ` wins |
| `privacy.useGitignore` | Reserved — not implemented; filtering does not read `.gitignore` today |
| `safety.destructiveCommandPatterns` | Extra warn-only UI patterns merged onto built-in defaults |

Built-in sensitive patterns are never removed by user config.

## Privacy env vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `QQ_ALLOW_FILE_READ` | off | Gate for any future file-content context (D-06) |
| `QQ_DEBUG_VERBOSE` | off | Log full buffer text in debug logs |
| `QQ_DEBUG_LOG_FILE` | `/tmp/qq-<uid>-debug.log` | Debug log path |
| `QQ_CONFIG_FILE` | `~/.config/qq/config.json` | Privacy/safety config path |
