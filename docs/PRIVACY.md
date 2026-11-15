# Privacy defaults

[Back to README](../README.md)

QueQue is **insertion-only**: it writes commands into your shell buffer — you press Enter to run them. QueQue never auto-executes suggestions.

**What leaves your machine (Claude and OpenAI, hosted).** The provider you chose receives the same context, whichever it is: Claude (through `claude -p` or the API key) or OpenAI (through `OPENAI_API_KEY`). Only that one provider receives it:

- Your query text and current working directory
- Your OS platform name (for example `darwin` or `linux`) and shell name (`zsh`)
- Git metadata (repository root path, branch, dirty flag, changed file *names* — not file contents)
- Parsed filename hints from your query (no disk reads)
- The names of installed tools that appear in QueQue's public catalog of 196 well-known tools (see [Installed-tool awareness](USAGE.md#installed-tool-awareness)). The rest of your `PATH`, your function names and your alias names stay on your machine. `QQ_TOOL_AWARENESS=0` stops even the catalog names.

**With Ollama**, the same context goes only to your Ollama server (`http://localhost:11434` by default, or the `baseUrl` in `provider.json`). With the default setting, nothing leaves your machine. A `baseUrl` that starts with `http://` and names another machine sends that context across the network unencrypted; for a remote server, use an `https://` URL (for example behind a reverse proxy).

**What QueQue never sends:**

- File contents. `QQ_ALLOW_FILE_READ=1` is reserved for a future opt-in and reads nothing today.
- Paths matching sensitive patterns (`.env`, credentials, `.pem`, `id_rsa`, `.ssh/`, `.aws/`, `secret`) are stripped from git context

**Debug logging:** The client and daemon append short diagnostics to `/tmp/qq-<uid>-debug.log`, or to the file named by `QQ_DEBUG_LOG_FILE`. Shell buffer and query text are redacted unless `QQ_DEBUG_VERBOSE=1`. The zsh widget adds its own lines only when `QQ_DEBUG_LOG_FILE` is set. The log stays on your machine.

**User config:** Copy [docs/config.example.json](config.example.json) to `~/.config/qq/config.json` to add extra sensitive path patterns, log redaction keys, or destructive-command warnings. Built-in defaults always apply — your patterns are merged on top. Override the file path with `QQ_CONFIG_FILE`: a leading `~/` means your home directory, and a relative path is resolved against your home directory. Malformed `config.json` is ignored with a warning; QueQue falls back to built-in defaults (fail-closed).

See [docs/EXTENSIONS.md](EXTENSIONS.md) for the expansion path (local learning, multi-provider, plugins).

## Anonymous telemetry

Telemetry is off unless you say yes. After your first accepted `??`, QueQue asks once:

```text
QueQue: send anonymous usage and error counts (no commands, prompts or paths)? [y/N]
```

The default is No: only `y` or `Y` opts in. `Enter`, `Esc`, any other key or 30 seconds of silence mean no. Your answer is saved in the `telemetry` block of `~/.config/qq/config.json` (or the file named by `QQ_CONFIG_FILE`), so you are asked only once. QueQue never asks without a terminal, never inside Zellij, and never when it could not save your answer. You can change your mind at any time with `qq telemetry on` or `qq telemetry off`.

**Environment overrides.** `DO_NOT_TRACK` or `CI` set to anything other than empty, `0` or `false`, or `QQ_TELEMETRY` set to `0`, `false` or `off`, keeps telemetry off whatever the config says, and the question is not asked.

**What is sent.** Only three events, each limited to a fixed allow list of fields:

- `qq_query_outcome`, once per `??`: the outcome (accepted, escaped or error), how many rows were on screen (0 to 5), the provider kind (`claude-sdk`, `claude-cli`, `openai`, `ollama` or `unknown`) and, for an error, the error kind.
- `qq_error`: the error kind and provider kind of a failure that did not end the query.
- `qq_environment`: the OS (`darwin`, `linux` or other), CPU architecture, distro family, zsh major.minor version, Node.js major version and whether you are inside Zellij. The daemon skips it when it matches the last one it buffered.

Error kinds are fixed names such as `auth_missing` or `provider_timeout`, never error message text. Every event also carries your install id, the QueQue version and a timestamp, and asks PostHog not to geolocate it or build a person profile. QueQue never sends commands, queries, buffer text, paths, error messages, stack traces or timings.

**Identity.** The install id is a random UUID created when you opt in, never derived from your host, user or network. `qq telemetry off` deletes it, so turning telemetry back on starts a new, unlinkable id.

**Delivery.** The client hands events to the background daemon, which keeps them in memory and sends them in batches to PostHog Cloud EU (`eu.i.posthog.com`). A batch that fails to send is dropped: there is no retry and no disk queue. A build without a PostHog project key sends nothing. The daemon reads your choice on every event and every send, so `qq telemetry off` takes effect without a restart and also clears the daemon's buffer.

**Commands:**

- `qq telemetry` or `qq telemetry status`: whether telemetry is on, which setting turned it off, whether this build has a project key, and the endpoint host.
- `qq telemetry on` and `qq telemetry off`: turn it on or off.
- `qq telemetry show`: prints the pending batch and the last sent batch byte for byte, exactly as they leave your machine.
