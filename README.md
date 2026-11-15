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

![QueQue demo](https://raw.githubusercontent.com/k-leumas/queque/main/assets/demo.gif)

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

## More

- [Install](https://github.com/k-leumas/queque/blob/main/docs/INSTALL.md): requirements, Homebrew and npm.
- [Choose a provider](https://github.com/k-leumas/queque/blob/main/docs/PROVIDERS.md): Claude Code login, API keys, OpenAI and Ollama (beta), restarting the daemon.
- [Usage](https://github.com/k-leumas/queque/blob/main/docs/USAGE.md): the picker, installed-tool awareness, Zellij.
- [Privacy](https://github.com/k-leumas/queque/blob/main/docs/PRIVACY.md): what leaves your machine, debug logging, opt-in anonymous telemetry.
- [Configuration](https://github.com/k-leumas/queque/blob/main/docs/CONFIGURATION.md): the `config.json` fields.
- [System design](https://github.com/k-leumas/queque/blob/main/docs/SYSTEM_DESIGN.md) and [Extensions](https://github.com/k-leumas/queque/blob/main/docs/EXTENSIONS.md): architecture and extension seams.
- [Contributing](https://github.com/k-leumas/queque/blob/main/CONTRIBUTING.md): development setup and developer-only settings.
