# QueQue Extension Seams

QueQue is built around registries so new shells, providers, context sources, and storage backends can land without rewriting the client.

## Registries (Phase 2 + Phase 6)

| Registry | Register | Resolve | Default built-in |
|----------|----------|---------|------------------|
| Context providers | `registerContextProvider()` | `listContextProviders()` | `git-context`, `filesystem-context` |
| Provider backends | `registerProviderBackend()` | `getProviderAdapter()` | `claude` (SDK), `claude-cli` (CLI + SDK rescue) |
| Shell adapters | `registerShellAdapter()` | `listShellAdapters()` | `zsh` |
| Storage hooks | `registerStorageHook()` | `listStorageHooks()` | `noop` (no persistence) |

Built-ins wire up in `src/registry/bootstrap.ts`. Production code should resolve through registries — not import adapters directly.

## Provider resolution

Claude is the silent default: spawn `claude -p` first, then rescue with the Anthropic SDK when `ANTHROPIC_API_KEY` is in the environment or `.env.local`. Runtime resolves `getProviderAdapter('claude-cli')` (the CLI+SDK composite) — it does not select a backend from `detectProvider()`.

`detectProvider()` remains as leftover preflight for debug callers. It is not the hot-path adapter selector.

OpenAI, Ollama, and a `~/.config/qq/provider.json` pin are upcoming in 08-03. They are not shipped in 08-02. Changing provider later means re-running the 08-03 picker or editing the pin — not re-detecting the machine on every `??`.

## Roadmap expansion

### Phase 7 — Local learning

- `storage-hooks` registry → event log on accepted commands
- SQLite pattern index in the daemon for cache hits before LLM calls
- All data stays on disk under `~/.local/share/qq/` — no cloud sync

### Phase 8 — Zero-config providers

- 08-01: Platform-aware Claude CLI detection (macOS Keychain `/login` gap; OAuth env tokens)
- 08-02: Claude silent default (`claude -p` then env-key SDK rescue); `detectProvider()` leftover, not selector
- 08-03 (upcoming): persist an explicit provider pin and optional OpenAI/Ollama adapters — not live yet

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
| `privacy.useGitignore` | Reserved for future gitignore-based filtering; ignored today |
| `safety.destructiveCommandPatterns` | Extra warn-only UI patterns merged onto built-in defaults |

Built-in sensitive patterns are never removed by user config.

## Privacy env vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `QQ_ALLOW_FILE_READ` | off | Gate for any future file-content context (D-06) |
| `QQ_DEBUG_VERBOSE` | off | Log full buffer text in debug logs |
| `QQ_DEBUG_LOG_FILE` | `/tmp/qq-<uid>-debug.log` | Debug log path |
| `QQ_CONFIG_FILE` | `~/.config/qq/config.json` | Privacy/safety config path |
