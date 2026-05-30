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
- `ANTHROPIC_API_KEY` from [console.anthropic.com](https://console.anthropic.com)

## Usage

Type a partial command or a natural-language description, then type `??`:

```
list all running docker containers ??
```

QueQue opens a selection UI inline. When running inside a [Zellij](https://zellij.dev) session, the UI renders as a floating modal pane. Press `Enter` to accept a suggestion or edit it before running.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
