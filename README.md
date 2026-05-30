# QueQue

QueQue is a `zsh`-integrated command helper triggered by typing `??` in your live shell buffer. It takes the text you've already typed as context, asks an LLM for a shell command, and returns it back into your buffer — no browser, no prompt takeover, no auto-execution.

## Install

### Homebrew (recommended)

```bash
brew tap k-leumas/tap
brew install queque
```

After install, Homebrew will print a caveats block with the exact paths. Add the following to your `~/.zshrc`:

```zsh
source $(brew --prefix k-leumas/tap/queque)/libexec/shell/zsh/qq.zsh
export ANTHROPIC_API_KEY="sk-ant-..."
```

Then reload:

```bash
source ~/.zshrc
```

### npm

```bash
npm install -g @k-leumas/queque-cli
```

Add to `~/.zshrc`:

```zsh
source $(npm root -g)/@k-leumas/queque-cli/shell/zsh/qq.zsh
export ANTHROPIC_API_KEY="sk-ant-..."
```

## Usage

Type a partial command or a natural-language description, then type `??`:

```
list all running docker containers ??
```

QueQue opens a floating pane, shows ranked command suggestions, and writes the selected command back into your shell buffer. Press `Enter` to run it or edit it first.

## Prerequisites

- `zsh`
- Node `24+`
- `pnpm`
- [Zellij](https://zellij.dev) >= 0.38 (`brew install zellij`)

If you use `nvm`:

```bash
nvm use
corepack enable
pnpm install
```

## Local Development

Install dependencies and start the watch build in one terminal:

```bash
pnpm install
pnpm dev
```

That keeps `dist/cli/main.js` rebuilt as you edit `src/cli/main.ts`.

If you want a simple restart wrapper that logs when it reacts to file changes, run:

```bash
pnpm dev:restart
```

It rebuilds first, then starts the dev command, and logs when it sees a change and restarts.

In another terminal, use the current checks:

```bash
pnpm typecheck
pnpm test:run
pnpm build
```

## Load The CLI In Your Shell During Development

Because the project already defines a `qq` bin that points at `dist/cli/main.js`, the simplest development setup is to add a shell function that executes the built file from your checkout, then source the widget directly.

Add this to `~/.zshrc`:

```bash
export QQ_DEV_ROOT="$HOME/dev/queque"

source "$QQ_DEV_ROOT/shell/zsh/qq.zsh"
```

Then reload your shell:

```bash
source ~/.zshrc
```

With `pnpm dev` running, every rebuild updates the code behind `??` immediately.

## Live Debug Log

For shell/widget debugging, you can opt into a plain-text log by setting:

```bash
export QQ_DEBUG_LOG_FILE=/tmp/qq-debug.log
```

When enabled, the repo writes to `/tmp/qq-debug.log`. Watch it live with:

```bash
tail -f /tmp/qq-debug.log
```

If you want to change the location, point `QQ_DEBUG_LOG_FILE` somewhere else before sourcing your shell config.

The interactive shell hook also prewarms the daemon once per shell session, so the first `??` does not pay the full startup cost.

## Claude Provider

The foreground client asks Claude for a strict JSON command suggestion.

Set these environment variables before running the client:

```bash
# read from .env.local in the repo root, or export directly
ANTHROPIC_API_KEY="..."
# optional
QQ_MODEL="claude-haiku-4-5"
```

If `QQ_MODEL` is omitted, the provider uses a default model. You can override it with `QQ_MODEL` if needed.

When the current directory is inside a git repository, the prompt includes the repo root, branch, and dirty state as extra context.

## Commit Workflow

This repo uses:

- `commitlint` to enforce Conventional Commits
- `lefthook` to run Git hooks locally
- `biome` for formatting and linting

After `pnpm install`, Lefthook installs automatically through the `prepare` script.

Current hook behavior:

- `pre-commit`: runs `biome check --write --staged` and `pnpm test:run`
- `commit-msg`: runs `commitlint --edit`

Examples of valid commit messages:

```text
feat: add daemon bootstrap
fix: handle missing request file
docs: document shell wiring
chore: add biome and commit hooks
```
