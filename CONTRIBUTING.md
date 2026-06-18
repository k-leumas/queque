# Contributing

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

## Daily driver / dev workflow

Use this loop when developing against your checkout:

```bash
pnpm build && pnpm test:run
```

If `pnpm` is not on your PATH, use `corepack pnpm` instead.

Point the widget at your checkout:

```bash
export QQ_DEV_ROOT="$HOME/dev/tui-llm"
source "$QQ_DEV_ROOT/shell/zsh/queque.zsh"
```

Then reload your shell (`source ~/.zshrc`) and trigger `??` — rebuilds from `pnpm dev` or `pnpm build` pick up immediately.

### Privacy and config env vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `QQ_ALLOW_FILE_READ` | off | Gate for any future file-content context (no reads in v1) |
| `QQ_DEBUG_VERBOSE` | off | Log full buffer text in debug logs |
| `QQ_CONFIG_FILE` | `~/.config/qq/config.json` | Privacy/safety config path |
| `QQ_PANE_WIDTH` | `80` | Zellij floating pane width |
| `QQ_PANE_HEIGHT` | `24` | Zellij floating pane height |

Copy [docs/config.example.json](docs/config.example.json) to `~/.config/qq/config.json` for extra sensitive path patterns and destructive-command warnings. See [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) and [docs/EXTENSIONS.md](docs/EXTENSIONS.md) for architecture and expansion path.

## Load The CLI In Your Shell During Development

Because the project already defines a `qq` bin that points at `dist/cli/main.js`, the simplest development setup is to source the widget directly from your checkout.

Add this to `~/.zshrc`:

```bash
export QQ_DEV_ROOT="$HOME/dev/tui-llm"

source "$QQ_DEV_ROOT/shell/zsh/queque.zsh"
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

Set these environment variables before running the client (or place them in `.env.local` in the repo root):

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required. Your Anthropic API key. |
| `QQ_MODEL` | `claude-haiku-4-5-20251001` | Override the Claude model used for suggestions. If omitted, the provider uses the default model. |
| `QQ_DEBUG_LOG_FILE` | — | Path to write a plain-text debug log (e.g. `/tmp/qq.log`). |

When the current directory is inside a git repository, the prompt includes the repo root, branch, and dirty state as extra context.

## How to Contribute

1. Fork the repo on GitHub
2. Create a branch off `main` — name it something descriptive (`feat/my-thing`, `fix/bug-name`)
3. Make your changes, run the checks (`typecheck`, `test:run`, `build`)
4. Open a PR against `main` on this repo — keep it focused and link any related issue
5. Direct pushes to `main` are blocked; all changes go through PRs

## Code of Conduct

Be respectful. Critique code, not people. If something is unwelcoming or hostile, it doesn't belong here.

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
