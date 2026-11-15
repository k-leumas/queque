# Install

[Back to README](../README.md)

## Homebrew

```shell
brew install k-leumas/tap/queque
qq init zsh && source ~/.zshrc
```

## Install via npm

### Requirements

- zsh
- Node.js 24 or newer
- [jq](https://jqlang.github.io/jq/)
- Claude Code signed in, an Anthropic API key, an OpenAI API key, or Ollama (see [Choose a provider](PROVIDERS.md))

```shell
npm install -g @k-leumas/queque-cli
qq init zsh && source ~/.zshrc
```

## Set up zsh

> [!NOTE]
> After install, run `qq init zsh && source ~/.zshrc` to wire up the `??` keybinding. `qq init zsh` adds the QueQue source line to the end of `~/.zshrc` itself, so do not redirect its output into the file.
