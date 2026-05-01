# Que-Que

Que-Que is a `zsh`-integrated command helper that is intended to open from a literal `??` trigger in your live shell buffer, gather the text around the cursor, and return an explainable shell command back into the buffer instead of executing it for you.

## Current Status

This repository is still in early Phase 1.

- The TypeScript CLI scaffold exists.
- The `qq client` and `qq daemon` command surfaces exist.
- The real `zsh` widget and shell sourcing script do **not** exist yet.

That means you can wire up the CLI for active development today, but you cannot yet source a finished `??` shell integration from this repo.

## Prerequisites

- `zsh`
- Node `24.14.1`
- `pnpm`

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

In another terminal, use the current checks:

```bash
pnpm typecheck
pnpm test:run
pnpm build
```

## Load The CLI In Your Shell Today

Because the project already defines a `qq` bin that points at `dist/cli/main.js`, the simplest development setup is to add a shell function that executes the built file from your checkout.

Add this to `~/.zshrc`:

```bash
export QQ_DEV_ROOT="$HOME/dev/tui-llm"

qq() {
  node "$QQ_DEV_ROOT/dist/cli/main.js" "$@"
}
```

Then reload your shell:

```bash
source ~/.zshrc
```

With `pnpm dev` running, every rebuild updates the code behind `qq` immediately.

## Smoke-Test The Current CLI

Right now the commands are scaffolds and intentionally fail with explicit `not implemented` errors. That is still useful for verifying your shell wiring.

```bash
qq --help
qq client --request-file /tmp/request.json --result-file /tmp/result.json
qq daemon --socket /tmp/qq-test.sock
qq daemon --ensure --socket /tmp/qq-test.sock
```

Expected result today: help output works, and the command handlers exit with `not implemented` messages instead of performing real work.

## Commit Workflow

This repo now uses:

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

## Future `zsh` Integration

Once the repo adds `shell/zsh/qq.zsh`, the shell wiring will look more like this:

```bash
export QQ_DEV_ROOT="$HOME/dev/tui-llm"

qq() {
  node "$QQ_DEV_ROOT/dist/cli/main.js" "$@"
}

if [[ -f "$QQ_DEV_ROOT/shell/zsh/qq.zsh" ]]; then
  source "$QQ_DEV_ROOT/shell/zsh/qq.zsh"
fi
```

At that point, `qq` will still resolve to your local checkout, and the sourced widget file can register the `??` trigger against the same development build.
