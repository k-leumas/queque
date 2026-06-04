# QueQue

[![npm (latest)](https://img.shields.io/npm/v/%40k-leumas%2Fqueque-cli/latest?label=npm%20stable)](https://www.npmjs.com/package/@k-leumas/queque-cli)
[![npm (beta)](https://img.shields.io/npm/v/%40k-leumas%2Fqueque-cli/beta?label=npm%20beta)](https://www.npmjs.com/package/@k-leumas/queque-cli?activeTab=versions)
[![GitHub release](https://img.shields.io/github/v/release/k-leumas/queque)](https://github.com/k-leumas/queque/releases)

**Turn natural-language intent into a shell command — without leaving the terminal.**

Type your intent, hit `??`, pick a command. It lands in your buffer ready to run or edit. No browser, no prompt takeover, no clipboard gymnastics.

<!-- demo gif goes here -->

## Install

```zsh
brew install k-leumas/tap/queque
```

> [!NOTE]
> The homebrew script automagically appends the shell-integration command and sources your `.zshrc`, which is shown during install.


<details>
<summary>Install via npm or source</summary>

```zsh
npm install -g @k-leumas/queque-cli
qq init zsh >> ~/.zshrc && source ~/.zshrc
```

</details>

## Expose API Key

QueQue resolves `ANTHROPIC_API_KEY` in order:

1. **Environment variable** — `export ANTHROPIC_API_KEY="sk-ant-..."` in your shell or `.zshrc`
2. **`.env.local` file** — place a `.env.local` in your project directory (or any parent). QueQue searches upward from the current working directory:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

The `.env.local` option is useful for project-specific keys or keeping the key out of your shell profile.

## Usage

Type anything before `??` and QueQue turns it into a shell command:

```
list files by size??
find docker containers using port 3000??
git undo last commit but keep changes??
```

A selection UI opens in-terminal. Pick a command with arrow keys or fuzzy search, press `Enter`, and the command lands in your buffer — ready to run or edit before you commit.

Press `Esc` to cancel and return to what you were typing.

### Inside Zellij

QueQue detects Zellij automatically and opens in a floating pane instead of inline. Same trigger, same result, better layout.

## Requirements

- zsh
- Node.js ≥ 20
- [jq](https://jqlang.github.io/jq/)
- `ANTHROPIC_API_KEY`

## Configuration

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required. Your Anthropic API key. |
| `QQ_MODEL` | `claude-haiku-4-5-20251001` | Override the Claude model. |
| `QQ_DEBUG_LOG_FILE` | — | Path to write a debug log (e.g. `/tmp/qq.log`). |

Both env vars and `.env.local` are supported for all variables.

## Contributing

```zsh
git clone https://github.com/k-leumas/queque
cd queque
pnpm install
pnpm dev        # watch build
pnpm test:run   # run tests
```

To wire up the dev build as the live `??` trigger:

```zsh
export QQ_DEV_ROOT="$PWD"
qq init zsh >> ~/.zshrc
source ~/.zshrc
```

Changes to `src/` rebuild automatically and the widget picks them up immediately.
