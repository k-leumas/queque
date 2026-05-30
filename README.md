# QueQue

QueQue is a `zsh`-integrated command helper triggered by typing `??` in your live shell buffer. It takes the text you've already typed as context, asks an LLM for a shell command, and returns it back into your buffer — no browser, no prompt takeover, no auto-execution.

## Install

### Homebrew (recommended)

```bash
brew tap k-leumas/tap
brew install queque
```

### npm

```bash
npm install -g @k-leumas/queque-cli
```

## Configuration

Add to `~/.zshrc`:

```zsh
eval "$(qq init zsh)"
export ANTHROPIC_API_KEY="sk-ant-..."
```

Then reload:

```bash
source ~/.zshrc
```

## Requirements

- `zsh`
- Node 24+
- [Zellij](https://zellij.dev) >= 0.38 (`brew install zellij`)
- `ANTHROPIC_API_KEY` from [console.anthropic.com](https://console.anthropic.com)

## Usage

Type a partial command or a natural-language description, then type `??`:

```
list all running docker containers ??
```

QueQue opens a floating pane, shows ranked command suggestions, and writes the selected command back into your shell buffer. Press `Enter` to run it or edit it first.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
