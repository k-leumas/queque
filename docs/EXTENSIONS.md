# QueQue Extension Seams

QueQue is built around registries so new shells, providers, context sources, and storage backends can land without rewriting the client.

## Registries (Phase 2 + Phase 6)

| Registry | Register | Resolve | Default built-in |
|----------|----------|---------|------------------|
| Context providers | `registerContextProvider()` | `listContextProviders()` | `git-context`, `filesystem-context` |
| Provider backends | `registerProviderBackend()` | `getProviderAdapter()` | `claude` (SDK), `claude-cli` (Claude default composite), `ollama`, `openai` |
| Shell adapters | `registerShellAdapter()` | `listShellAdapters()` | `zsh` |
| Storage hooks | `registerStorageHook()` | `listStorageHooks()` | `noop` (no persistence) |

Built-ins wire up in `src/registry/bootstrap.ts`. Production code should resolve through registries — not import adapters directly.

## Provider resolution

The rule is: the pin, otherwise the Claude default. Both the daemon's `fetch-candidates` handler and the in-process fallback (used when the daemon is down) call `resolveProviderAdapter()` from `src/providers/provider-pin.ts`:

- **No `provider.json`, or a `claude` pin**: the Claude default, registered as `claude-cli`. It uses the Anthropic SDK first when `ANTHROPIC_API_KEY` is usable (environment, then `~/.env.local`). Otherwise it runs `claude -p` on the user's Claude Code `/login`.
- **An `openai` or `ollama` pin**: only that backend (`openai` or `ollama`) runs.
- **An invalid or unreadable `provider.json`**: a hard error naming the file and `qq init provider`. It never falls back to Claude, so a prompt meant for a local model is never sent to a hosted provider.
- **No fallthrough.** When the selected backend fails, `??` shows that backend's one-line error. QueQue never retries with another vendor.
- **Re-read on every `??`.** The pin is read again for each request, so an edit applies on the next `??` without a daemon restart.

The pin lives at `~/.config/qq/provider.json` (override with `QQ_PROVIDER_FILE`). It is a versioned, strict JSON object with no secret fields. Any extra key, such as `apiKey`, makes the file invalid:

```json
{"version":1,"provider":"claude"}
```

```json
{"version":1,"provider":"openai","model":"gpt-5.5"}
```

```json
{"version":1,"provider":"ollama","model":"gemma4","baseUrl":"http://localhost:11434"}
```

For OpenAI, `model` is optional (default `gpt-5.5`), and there is no `baseUrl` field, so a pin cannot send the key to another host. For Ollama, `model` is required and `baseUrl` is optional (default `http://localhost:11434`, http or https only). A path in `baseUrl` is kept, so a reverse-proxied `https://gpu.lan/ollama` is called at `https://gpu.lan/ollama/api/chat`.

`qq init provider` is the only way to write the pin interactively. It asks once on `/dev/tty` (Claude, OpenAI, Ollama), writes the file atomically with mode 0600, and restarts the daemon so it picks up a newly exported key. It pins OpenAI only when `OPENAI_API_KEY` is already usable. For Ollama, it lists your installed models. The `??` path never opens the picker. When the Claude default cannot answer (no `claude`, logged out, no key), the error text points at `qq init provider`.

`detectProvider()` is leftover preflight for debug callers, not the selector. `resolveAdapter(detected)` in `src/providers/resolver.ts` maps every detected kind to the Claude default and never reads `provider.json`.

## Prompt steering (Phase 9)

Suggestions favour tools that are installed, whichever provider answers.

- **Builder rule.** Every provider adapter must build its system prompt with `buildSystemPrompt(envelope)` from `src/providers/steering.ts`, never the raw `QUEQUE_SYSTEM` constant. It must keep building its user prompt with `buildPrompt(envelope)` (the Phase 6 privacy filter runs there). Steering lives only in the system prompt: never in the user JSON, and never through sampling parameters.
- **Adapter options (Phase 09.1).** Adapters implement `fetchCandidates(envelope, options?)`. `options.signal` must cancel the provider request (kill the child process, or pass the signal to the HTTP request) and reject with an AbortError (`abortError()` from `src/providers/provider.ts`); never map an abort to an error message, because the daemon writes nothing for it. `options.onCandidate` may be called with each schema-valid candidate, in order, as it parses out of the streamed text, and never after the signal aborts. The returned list stays the authoritative result.
- **What reaches the model.** Only `catalog ∩ installed` names from the `installed-tools` envelope chunk. The catalog (`src/shared/tool-catalog.ts`) is a shipped allow list of public tool names, so the full installed list, private binaries, shell functions and aliases never reach a model. `buildSystemPrompt` re-filters to catalog names as defence in depth.
- **No chunk, no change.** Without an `installed-tools` chunk, `buildSystemPrompt` returns `QUEQUE_SYSTEM` byte-for-byte.
- **Kill switch.** `QQ_TOOL_AWARENESS=0` turns steering and the "not installed" flag off: the widget writes no handoff files, and the client ignores any that exist.
- **Guard.** The `adapters` test in `tests/steering.test.ts` fails for any `src/providers/` file that sends a system prompt without `buildSystemPrompt(`, or that calls `buildPrompt(` without it.
- **Compatibility.** Adding or removing catalog names needs no daemon capability bump: the daemon-side chunk schema filters names it does not know instead of rejecting the request. Changing the chunk's shape (or any other envelope shape) does need a new pong capability flag, like `installedTools` (09-05), so stale daemons are replaced instead of silently dropping requests.
- **Known side effect.** The widget runs `rehash` on every `??` so `$commands` is current. `rehash` also drops manual `hash name=path` entries.

## Roadmap expansion

### Phase 7 — Local learning

- `storage-hooks` registry → event log on accepted commands
- SQLite pattern index in the daemon for cache hits before LLM calls
- All data stays on disk under `~/.local/share/qq/` — no cloud sync

### Phase 8 — Zero-config providers

- 08-01: Platform-aware Claude CLI detection (macOS Keychain `/login` gap; OAuth env tokens)
- 08-02: Claude silent default (`claude -p` then env-key SDK rescue); `detectProvider()` leftover, not selector
- 08-03 (shipped): `~/.config/qq/provider.json` pin (`resolveProviderAdapter()`) and the Ollama adapter
- 08-04 (shipped): OpenAI Chat Completions adapter (`OPENAI_API_KEY`, default model `gpt-5.5`)
- 08-05 (shipped): `qq init provider` picker
- 08-06 (shipped): Claude setup failures point at `qq init provider`; docs describe the pin, otherwise the Claude default

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

## Privacy and provider env vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `QQ_ALLOW_FILE_READ` | off | Gate for any future file-content context (D-06) |
| `QQ_DEBUG_VERBOSE` | off | Log full buffer text in debug logs |
| `QQ_DEBUG_LOG_FILE` | `/tmp/qq-<uid>-debug.log` | Debug log path |
| `QQ_CONFIG_FILE` | `~/.config/qq/config.json` | Privacy/safety config path |
| `QQ_PROVIDER_FILE` | `~/.config/qq/provider.json` | Provider pin path (read on every `??`); must be absolute, empty means unset |
| `OPENAI_API_KEY` | unset | OpenAI key for an `openai` pin, from the environment or `~/.env.local`. The daemon reads it, so re-run `qq init provider` after exporting it |
