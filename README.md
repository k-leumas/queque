# QueQue — copy-pasting shell commands is dead

[![CI](https://img.shields.io/github/actions/workflow/status/k-leumas/queque/ci.yml?branch=main&label=CI&logo=githubactions&logoColor=white)](https://github.com/k-leumas/queque/actions/workflows/ci.yml)
[![Nightly](https://img.shields.io/github/actions/workflow/status/k-leumas/queque/nightly.yml?branch=main&label=Nightly&logo=githubactions&logoColor=white)](https://github.com/k-leumas/queque/actions/workflows/nightly.yml)
[![Release](https://img.shields.io/github/actions/workflow/status/k-leumas/queque/release.yaml?branch=main&label=Release&logo=githubactions&logoColor=white)](https://github.com/k-leumas/queque/actions/workflows/release.yaml)

[![tested on ubuntu:22.04](https://img.shields.io/badge/tested%20on-Ubuntu%2022.04-E95420?logo=ubuntu&logoColor=white)](https://github.com/k-leumas/queque/actions/workflows/ci.yml)
[![tested on ubuntu:24.04](https://img.shields.io/badge/tested%20on-Ubuntu%2024.04-E95420?logo=ubuntu&logoColor=white)](https://github.com/k-leumas/queque/actions/workflows/ci.yml)
[![tested on debian:13](https://img.shields.io/badge/tested%20on-Debian%2013-A81D33?logo=debian&logoColor=white)](https://github.com/k-leumas/queque/actions/workflows/ci.yml)
[![tested on fedora:44](https://img.shields.io/badge/tested%20on-Fedora%2044-51A2DA?logo=fedora&logoColor=white)](https://github.com/k-leumas/queque/actions/workflows/ci.yml)
[![tested on archlinux:latest](https://img.shields.io/badge/tested%20on-Arch%20Linux%20latest-1793D1?logo=archlinux&logoColor=white)](https://github.com/k-leumas/queque/actions/workflows/ci.yml)
[![tested on alpine:3.24](https://img.shields.io/badge/tested%20on-Alpine%203.24-0D597F?logo=alpinelinux&logoColor=white)](https://github.com/k-leumas/queque/actions/workflows/ci.yml)

**Before:** Google it → copy → paste → tweak → pray.

**Now:** Type your intent, hit `??`, pick a command — it lands in your buffer, ready to tweak and run.


#### Copy-pasting commands from the browser is dead.

Welcome to the **future** –
`
 brew install k-leumas/tap/queque
`


![QueQue demo](assets/demo.gif)

> [!NOTE]
> After install, run `qq init zsh && source ~/.zshrc` to wire up the `??` keybinding. `qq init zsh` adds the QueQue source line to the end of `~/.zshrc` itself, so do not redirect its output into the file.


<details>
<summary>Install via npm</summary>

## Requirements

- zsh
- Node.js 24 or newer
- [jq](https://jqlang.github.io/jq/)
- Claude Code signed in, an Anthropic API key, an OpenAI API key, or Ollama (see [Choose a provider](https://github.com/k-leumas/queque/blob/main/docs/PROVIDERS.md))


```shell
npm install -g @k-leumas/queque-cli
qq init zsh && source ~/.zshrc
```

</details>

## Choose a provider

Claude is the default. If you already use Claude Code (signed in with `claude /login`) or have an Anthropic API key (`ANTHROPIC_API_KEY`), there is nothing to set up. To use OpenAI or a local Ollama model instead (both in beta), run `qq init provider`.

See [Choose a provider](https://github.com/k-leumas/queque/blob/main/docs/PROVIDERS.md) for keys, models and restarting the daemon.

## Usage

Type anything before `??` and QueQue turns it into a shell command:

```shell
list files by size??
find docker containers using port 3000??
git undo last commit but keep changes??
```

A selection UI opens in-terminal. Rows appear as the provider answers. Only Claude streams them today, so with Claude you can pick one before the rest have arrived; OpenAI and Ollama show the whole list at once. What you typed stays in the dim `queque ›` header, and the FILTER box opens empty: type to narrow the list, even while `thinking…` is still showing. Move with the arrow keys and press `Enter`. The command lands in your buffer exactly as shown, ready to run or edit. QueQue never runs it for you.

Press `Esc` to cancel. It stops the request to the provider and restores what you were typing, so you can tweak your intent and hit `??` again.

A command that matches a destructive pattern (`rm`, `sudo` and similar) is marked `⚠ review carefully — this command may be destructive`. The mark is a warning only; the row stays selectable.

### Installed-tool awareness

On every `??`, zsh refreshes its list of the commands it can find (`rehash`), so a tool you installed a moment ago in the same shell counts. QueQue uses that list in two ways.

**It tells the provider which well-known tools you have.** QueQue ships a fixed catalog of 196 public command-line tool names that have common alternatives, such as `rg`, `fd`, `bat`, `jq` and `kubectl`. The request includes only the catalog tools you have installed, with instructions to prefer them, to make at least one suggestion that uses only installed tools, and never to suggest install steps. The catalog mostly leaves out basic utilities such as `ls`, `grep` and `find`; the provider is told those are present. Nothing outside the catalog is sent: the rest of your `PATH`, your shell functions and your aliases stay on your machine. The catalog is checked twice, once before the request leaves the client and again just before the prompt is built, so a name that is not in it never reaches a provider.

**It marks suggestions that need a missing tool.** This check runs locally, against the full list. A row that needs a tool zsh cannot find gets `ⓘ` before its explanation, and the legend reads `ⓘ not installed`. The row stays selectable. When QueQue knows how to install that tool with brew, apt, dnf or pacman, the legend adds `tab prepends the install command`: press `Tab` (or `Shift+Tab`) on the row to switch it to the install form, and again to switch back. The install form is inserted like any other command, never run.

Set `QQ_TOOL_AWARENESS=0` in your shell to turn off both: no tool names are sent and no rows are marked.

### Inside Zellij

QueQue detects Zellij automatically and opens in a floating pane instead of inline. Same trigger, same result, better layout.

Set `QQ_PANE_WIDTH` (default `80`) and `QQ_PANE_HEIGHT` (default `24`) to resize the floating pane.

Without Zellij, QueQue falls back to an inline TUI in your current terminal session.

## Privacy defaults

QueQue is **insertion-only**: it writes commands into your shell buffer — you press Enter to run them. QueQue never auto-executes suggestions.

**What leaves your machine (Claude and OpenAI, hosted).** The provider you chose receives the same context, whichever it is: Claude (through `claude -p` or the API key) or OpenAI (through `OPENAI_API_KEY`). Only that one provider receives it:

- Your query text and current working directory
- Your OS platform name (for example `darwin` or `linux`) and shell name (`zsh`)
- Git metadata (repository root path, branch, dirty flag, changed file *names* — not file contents)
- Parsed filename hints from your query (no disk reads)
- The names of installed tools that appear in QueQue's public catalog of 196 well-known tools (see [Installed-tool awareness](#installed-tool-awareness)). The rest of your `PATH`, your function names and your alias names stay on your machine. `QQ_TOOL_AWARENESS=0` stops even the catalog names.

**With Ollama**, the same context goes only to your Ollama server (`http://localhost:11434` by default, or the `baseUrl` in `provider.json`). With the default setting, nothing leaves your machine. A `baseUrl` that starts with `http://` and names another machine sends that context across the network unencrypted; for a remote server, use an `https://` URL (for example behind a reverse proxy).

**What QueQue never sends:**

- File contents. `QQ_ALLOW_FILE_READ=1` is reserved for a future opt-in and reads nothing today.
- Paths matching sensitive patterns (`.env`, credentials, `.pem`, `id_rsa`, `.ssh/`, `.aws/`, `secret`) are stripped from git context

**Debug logging:** The client and daemon append short diagnostics to `/tmp/qq-<uid>-debug.log`, or to the file named by `QQ_DEBUG_LOG_FILE`. Shell buffer and query text are redacted unless `QQ_DEBUG_VERBOSE=1`. The zsh widget adds its own lines only when `QQ_DEBUG_LOG_FILE` is set. The log stays on your machine.

**User config:** Copy [docs/config.example.json](https://github.com/k-leumas/queque/blob/main/docs/config.example.json) to `~/.config/qq/config.json` to add extra sensitive path patterns, log redaction keys, or destructive-command warnings. Built-in defaults always apply — your patterns are merged on top. Override the file path with `QQ_CONFIG_FILE`: a leading `~/` means your home directory, and a relative path is resolved against your home directory. Malformed `config.json` is ignored with a warning; QueQue falls back to built-in defaults (fail-closed).

See [docs/EXTENSIONS.md](https://github.com/k-leumas/queque/blob/main/docs/EXTENSIONS.md) for the expansion path (local learning, multi-provider, plugins).

## Configuration reference

Copy [docs/config.example.json](https://github.com/k-leumas/queque/blob/main/docs/config.example.json) to `~/.config/qq/config.json` (or set `QQ_CONFIG_FILE`). Field meanings:

| Field | Type | Purpose |
|-------|------|---------|
| `effort` | `"low" \| "medium" \| "high" \| "xhigh" \| "max"` | Claude effort for `claude -p` (`--effort`) and for the API-key SDK path, which sends it as `output_config.effort`. The SDK path omits it when `QQ_MODEL` names a model without effort support (Haiku 4.5, Sonnet 4.5 or older); a level that a `QQ_MODEL` model does not support (for example `xhigh` on Opus 4.5) is your responsibility. Default `low`. Trimmed and case-insensitive; invalid values fall back to `low` without affecting the rest of the file. Takes effect after a [daemon restart](https://github.com/k-leumas/queque/blob/main/docs/PROVIDERS.md#after-changing-your-key-or-settings), because the daemon reads config.json once. OpenAI and Ollama ignore it. |
| `privacy.sensitivePathPatterns` | `string[]` | Extra regex patterns merged onto built-in defaults (`.env`, credentials, keys, etc.). Built-in patterns are never removed. An invalid pattern, or one longer than 256 characters, is skipped. |
| `privacy.redactLogKeys` | `string[]` | Extra JSON keys to redact in debug logs (merged with defaults: `lbuffer`, `rbuffer`, `queryText`, `request`). |
| `privacy.allowFileRead` | `boolean` | Opt-in gate for future file-content context. Env `QQ_ALLOW_FILE_READ=1` overrides this. No file reads in v1. |
| `privacy.useGitignore` | `boolean` | Reserved for future gitignore-based filtering. Ignored today. |
| `safety.destructiveCommandPatterns` | `string[]` | Extra warn-only UI patterns merged onto built-in defaults (`rm`, `sudo`, `chmod -R`, writes to `/dev/`, `curl` or `wget` piped to `sh`). The same skip rule applies. |

See [docs/SYSTEM_DESIGN.md](https://github.com/k-leumas/queque/blob/main/docs/SYSTEM_DESIGN.md) for architecture.

## More

- [Choose a provider](https://github.com/k-leumas/queque/blob/main/docs/PROVIDERS.md): Claude Code login, API keys, OpenAI and Ollama (beta), restarting the daemon.
