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
> After install, run `qq init zsh >> ~/.zshrc && source ~/.zshrc` to wire up the `??` keybinding.


<details>
<summary>Install via npm</summary>

## Requirements

- zsh
- Node.js ≥ 20
- [jq](https://jqlang.github.io/jq/)


```shell
npm install -g @k-leumas/queque-cli
qq init zsh >> ~/.zshrc && source ~/.zshrc
```

</details>

## Expose API Key

QueQue resolves `ANTHROPIC_API_KEY` in order:

1. **Environment variable** — `export ANTHROPIC_API_KEY="sk-ant-..."` in your shell or `.zshrc`
2. **`.env.local` file** — place a `.env.local` in your project directory (or any parent). QueQue searches upward from the current working directory:
   ```shell
   ANTHROPIC_API_KEY=sk-ant-...
   ```

The `.env.local` option is useful for project-specific keys or keeping the key out of your shell profile.

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
| `privacy.sensitivePathPatterns` | `string[]` | Extra regex patterns merged onto built-in defaults (`.env`, credentials, keys, etc.). Built-in patterns are never removed. |
| `privacy.redactLogKeys` | `string[]` | Extra JSON keys to redact in debug logs (merged with defaults: `lbuffer`, `rbuffer`, `queryText`, `request`). |
| `privacy.allowFileRead` | `boolean` | Opt-in gate for future file-content context. Env `QQ_ALLOW_FILE_READ=1` overrides this. No file reads in v1. |
| `privacy.useGitignore` | `boolean` | Reserved for future gitignore-based filtering. Ignored today. |
| `safety.destructiveCommandPatterns` | `string[]` | Extra warn-only UI patterns merged onto built-in defaults (`rm`, `sudo`, etc.). |

See [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) for architecture and [docs/EXTENSIONS.md](docs/EXTENSIONS.md) for Phase 7/8 expansion.


