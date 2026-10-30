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

![QueQue demo](assets/demo.gif)

## Install

```shell
brew install k-leumas/tap/queque
qq init zsh && source ~/.zshrc
```

`qq init zsh` wires up the `??` keybinding and adds the QueQue source line to the end of `~/.zshrc` itself, so do not redirect its output into the file.

Or with npm (needs zsh, Node.js 24 or newer and jq):

```shell
npm install -g @k-leumas/queque-cli
qq init zsh && source ~/.zshrc
```

See [Install](https://github.com/k-leumas/queque/blob/main/docs/INSTALL.md) for the full requirements.

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

A picker opens in your terminal: move with the arrow keys and press `Enter`. The command lands in your buffer exactly as shown, ready to run or edit; QueQue never runs it for you. `Esc` cancels and restores what you typed.

See [Usage](https://github.com/k-leumas/queque/blob/main/docs/USAGE.md) for filtering, destructive-command warnings, installed-tool awareness and Zellij.

## Privacy defaults

QueQue is **insertion-only**: it writes commands into your shell buffer — you press Enter to run them. QueQue never auto-executes suggestions.

**What leaves your machine (Claude and OpenAI, hosted).** The provider you chose receives the same context, whichever it is: Claude (through `claude -p` or the API key) or OpenAI (through `OPENAI_API_KEY`). Only that one provider receives it:

- Your query text and current working directory
- Your OS platform name (for example `darwin` or `linux`) and shell name (`zsh`)
- Git metadata (repository root path, branch, dirty flag, changed file *names* — not file contents)
- Parsed filename hints from your query (no disk reads)
- The names of installed tools that appear in QueQue's public catalog of 196 well-known tools (see [Installed-tool awareness](https://github.com/k-leumas/queque/blob/main/docs/USAGE.md#installed-tool-awareness)). The rest of your `PATH`, your function names and your alias names stay on your machine. `QQ_TOOL_AWARENESS=0` stops even the catalog names.

**With Ollama**, the same context goes only to your Ollama server (`http://localhost:11434` by default, or the `baseUrl` in `provider.json`). With the default setting, nothing leaves your machine. A `baseUrl` that starts with `http://` and names another machine sends that context across the network unencrypted; for a remote server, use an `https://` URL (for example behind a reverse proxy).

**What QueQue never sends:**

- File contents. `QQ_ALLOW_FILE_READ=1` is reserved for a future opt-in and reads nothing today.
- Paths matching sensitive patterns (`.env`, credentials, `.pem`, `id_rsa`, `.ssh/`, `.aws/`, `secret`) are stripped from git context

**Debug logging:** The client and daemon append short diagnostics to `/tmp/qq-<uid>-debug.log`, or to the file named by `QQ_DEBUG_LOG_FILE`. Shell buffer and query text are redacted unless `QQ_DEBUG_VERBOSE=1`. The zsh widget adds its own lines only when `QQ_DEBUG_LOG_FILE` is set. The log stays on your machine.

**User config:** Copy [docs/config.example.json](https://github.com/k-leumas/queque/blob/main/docs/config.example.json) to `~/.config/qq/config.json` to add extra sensitive path patterns, log redaction keys, or destructive-command warnings. Built-in defaults always apply — your patterns are merged on top. Override the file path with `QQ_CONFIG_FILE`: a leading `~/` means your home directory, and a relative path is resolved against your home directory. Malformed `config.json` is ignored with a warning; QueQue falls back to built-in defaults (fail-closed).

See [docs/EXTENSIONS.md](https://github.com/k-leumas/queque/blob/main/docs/EXTENSIONS.md) for the expansion path (local learning, multi-provider, plugins).

## More

- [Install](https://github.com/k-leumas/queque/blob/main/docs/INSTALL.md): requirements, Homebrew and npm.
- [Choose a provider](https://github.com/k-leumas/queque/blob/main/docs/PROVIDERS.md): Claude Code login, API keys, OpenAI and Ollama (beta), restarting the daemon.
- [Usage](https://github.com/k-leumas/queque/blob/main/docs/USAGE.md): the picker, installed-tool awareness, Zellij.
- [Configuration](https://github.com/k-leumas/queque/blob/main/docs/CONFIGURATION.md): the `config.json` fields.
