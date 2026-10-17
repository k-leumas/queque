# QueQue — copy-pasting shell commands is dead

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
- Claude Code signed in, or an Anthropic API key (see [Authentication](#authentication))


```shell
npm install -g @k-leumas/queque-cli
qq init zsh && source ~/.zshrc
```

</details>

## Authentication

QueQue talks to Claude in one of two ways. You only need one.

**Claude Code login (no API key needed).** If you already use Claude Code, QueQue runs `claude -p` on your existing login whenever no API key is set. Sign in once through Claude Code's `/login`:

```shell
claude /login
```

On this route QueQue uses whatever account and default model Claude Code is set to; it passes no model flag. `claude -p` runs with its tools disabled and session persistence off, so it only answers the query. If `claude` is not on your `PATH` or is not signed in, `??` shows a message like this one:

```text
QueQue: Claude is not authenticated. Run `claude /login`, or set ANTHROPIC_API_KEY in the environment or .env.local.
```

**Anthropic API key.** QueQue looks for `ANTHROPIC_API_KEY` in this order:

1. **Environment variable**: `export ANTHROPIC_API_KEY="sk-ant-..."` in `~/.zshrc`, above the QueQue source line.
2. **`.env.local` file**: a line `ANTHROPIC_API_KEY=sk-ant-...`. The background daemon searches upward from the directory it was started in, usually the directory your first terminal opened in, and reads the file once. A `~/.env.local` is found from any start directory inside your home directory.

An empty or whitespace-only value counts as unset.

**Which route wins.** A non-empty `ANTHROPIC_API_KEY` always wins: QueQue calls Claude through the Anthropic SDK and never runs `claude -p`. There is no automatic fallback in either direction. If the API-key request fails, QueQue shows that error instead of trying your Claude Code login, and a failed `claude -p` run never falls back to a key. To switch to your Claude Code login, remove the key from your environment and `.env.local`, then restart the daemon.

`QQ_MODEL` picks the model on the API-key route only. The default is `claude-sonnet-5`.

### After changing your key or settings

A background daemon answers `??` for every terminal. It starts with your first interactive shell (and again on the next `??` if it is not running) and inherits that shell's environment. It reads `ANTHROPIC_API_KEY`, `QQ_MODEL`, `.env.local` and `~/.config/qq/config.json` once, when it starts.

- Put your `export` lines in `~/.zshrc` above the `# queque shell integration` block that `qq init zsh` appended, so the daemon started during shell startup sees them.
- After changing any of them, restart the daemon from a shell that has the new values:

```shell
pkill -f 'daemon --socket /tmp/qq-'
qq daemon --ensure
```

## Usage

Type anything before `??` and QueQue turns it into a shell command:

```shell
list files by size??
find docker containers using port 3000??
git undo last commit but keep changes??
```

A selection UI opens in-terminal. Pick a command with arrow keys or fuzzy search, press `Enter`, and the command lands in your buffer — ready to run or edit before you commit.

Press `Esc` to cancel and return to what you were typing, you can even tweak your intent and hit `??` again.

### Inside Zellij

QueQue detects Zellij automatically and opens in a floating pane instead of inline. Same trigger, same result, better layout.

Set `QQ_PANE_WIDTH` (default `80`) and `QQ_PANE_HEIGHT` (default `24`) to resize the floating pane.

Without Zellij, QueQue falls back to an inline TUI in your current terminal session.

## Privacy defaults

QueQue is **insertion-only**: it writes commands into your shell buffer — you press Enter to run them. QueQue never auto-executes suggestions.

**What leaves your machine (when using Claude):**

- Your query text and current working directory
- Git metadata (branch, dirty flag, changed file *names* — not file contents)
- Parsed filename hints from your query (no disk reads)

**What QueQue never sends:**

- File contents (unless you explicitly opt in later with `QQ_ALLOW_FILE_READ=1`)
- Paths matching sensitive patterns (`.env`, credentials, `.pem`, `id_rsa`, etc.) are stripped from git context

**Debug logging:** Off by default. When enabled, logs redact shell buffer text unless `QQ_DEBUG_VERBOSE=1`.

**User config:** Copy [docs/config.example.json](docs/config.example.json) to `~/.config/qq/config.json` to add extra sensitive path patterns, log redaction keys, or destructive-command warnings. Built-in defaults always apply — your patterns are merged on top. Override the file path with `QQ_CONFIG_FILE`. Malformed `config.json` is ignored with a warning; QueQue falls back to built-in defaults (fail-closed).

See [docs/EXTENSIONS.md](docs/EXTENSIONS.md) for the expansion path (local learning, multi-provider, plugins).

## Configuration reference

Copy [docs/config.example.json](docs/config.example.json) to `~/.config/qq/config.json` (or set `QQ_CONFIG_FILE`). Field meanings:

| Field | Type | Purpose |
|-------|------|---------|
| `effort` | `"low" \| "medium" \| "high" \| "xhigh" \| "max"` | Claude effort for `claude -p` (`--effort`) and for the API-key SDK path, which sends it as `output_config.effort`. The SDK path omits it when `QQ_MODEL` names a model without effort support (Haiku 4.5, Sonnet 4.5 or older); a level that a `QQ_MODEL` model does not support (for example `xhigh` on Opus 4.5) is your responsibility. Default `low`. Trimmed and case-insensitive; invalid values fall back to `low` without affecting the rest of the file. Takes effect after a [daemon restart](#after-changing-your-key-or-settings), because the daemon reads config.json once. |
| `privacy.sensitivePathPatterns` | `string[]` | Extra regex patterns merged onto built-in defaults (`.env`, credentials, keys, etc.). Built-in patterns are never removed. |
| `privacy.redactLogKeys` | `string[]` | Extra JSON keys to redact in debug logs (merged with defaults: `lbuffer`, `rbuffer`, `queryText`, `request`). |
| `privacy.allowFileRead` | `boolean` | Opt-in gate for future file-content context. Env `QQ_ALLOW_FILE_READ=1` overrides this. No file reads in v1. |
| `privacy.useGitignore` | `boolean` | Reserved for future gitignore-based filtering. Ignored today. |
| `safety.destructiveCommandPatterns` | `string[]` | Extra warn-only UI patterns merged onto built-in defaults (`rm`, `sudo`, etc.). |

See [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) for architecture and [docs/EXTENSIONS.md](docs/EXTENSIONS.md) for Phase 7/8 expansion.


