# Choose a provider

[Back to README](../README.md)

Claude is the default. If you already use Claude Code or have an Anthropic API key, there is nothing to set up. To use OpenAI or a local Ollama model instead (both in beta), run `qq init provider` once.

## Claude (default)

QueQue talks to Claude in one of two ways. You only need one.

**Claude Code login (no API key needed).** If you already use Claude Code, QueQue runs `claude -p` on your existing login whenever no API key is set. Sign in once through Claude Code's `/login`:

```shell
claude /login
```

On this route QueQue uses whatever account and default model Claude Code is set to; it passes no model flag. `claude -p` runs with its tools disabled and session persistence off, so it only answers the query. If `claude` is not signed in, `??` shows this message and puts back what you typed:

```text
QueQue: Claude is not authenticated. Run `claude /login`, or set ANTHROPIC_API_KEY in the environment or ~/.env.local. To use OpenAI or Ollama instead, run `qq init provider`.
```

If `claude` is not on your `PATH` at all, the message starts with `QueQue: No AI provider is ready.` and lists the same three options. Any other `claude -p` failure, such as an overloaded API or a usage limit, shows `QueQue: Claude Code could not answer (claude -p failed).`; run `claude -p "hi"` to see the underlying error.

**Anthropic API key.** QueQue looks for `ANTHROPIC_API_KEY` in this order:

1. **Environment variable**: `export ANTHROPIC_API_KEY="sk-ant-..."` in `~/.zshrc`, above the QueQue source line.
2. **`.env.local` file**: a line `ANTHROPIC_API_KEY=sk-ant-...` in `~/.env.local`. QueQue reads only `~/.env.local` itself: never the directory you run `??` from and never a directory above your home directory, so a `.env.local` inside a project (or in `/tmp`) is not used. The background daemon reads the file once, when it starts.

An empty or whitespace-only value counts as unset.

**Which route wins.** A non-empty `ANTHROPIC_API_KEY` always wins: QueQue calls Claude through the Anthropic SDK and never runs `claude -p`. There is no automatic fallback in either direction. If the API-key request fails, QueQue shows that error instead of trying your Claude Code login, and a failed `claude -p` run never falls back to a key. To switch to your Claude Code login, remove the key from your environment and `~/.env.local`, then restart the daemon.

`QQ_MODEL` (in your environment or `~/.env.local`) picks the model on the API-key route only. The default is `claude-sonnet-5`.

## OpenAI or Ollama (beta)

Run the picker in a terminal:

```shell
qq init provider
```

It asks one question (Claude, OpenAI or Ollama), saves your answer to `~/.config/qq/provider.json`, and restarts the background daemon. Nothing is probed until you answer, and `??` never asks you to choose.

- **OpenAI (beta)** needs `OPENAI_API_KEY` in your environment (`export OPENAI_API_KEY="sk-..."` in `~/.zshrc`, above the QueQue source line) or in `~/.env.local`. Set the key first, open a new terminal, then run `qq init provider`. QueQue never asks for the key and never stores it: `provider.json` only records that you chose OpenAI. The default model is `gpt-5.5`.
- **Ollama (beta)** lists the models you have already pulled and pins the one you pick. If Ollama is not running, the picker prints the download link and `ollama serve`. If it has no models, the picker tells you to run `ollama pull`. When `provider.json` has a `baseUrl` (a remote server), the picker lists and keeps that server; to go back to Ollama on this machine, remove `baseUrl` from `provider.json`.

Your choice sticks. If the chosen provider fails, `??` shows that provider's error; QueQue never switches to a different provider on its own. Run `qq init provider` again to switch, including back to Claude.

Every provider gets 25 seconds per `??`. If an OpenAI or Ollama answer is cut off before a full command, QueQue asks the same provider once more within those same 25 seconds. If the second try also falls short, you get the commands that did arrive, or a "cut off" message when none did. When an OpenAI model rejects one of QueQue's request settings, QueQue re-sends without it and remembers that for the model until the daemon restarts.

`provider.json` is plain JSON you can edit by hand, and QueQue reads it again on every `??`:

```json
{"version":1,"provider":"ollama","model":"gemma4"}
```

Add `"model"` to an OpenAI pin to change the model, or `"baseUrl"` to an Ollama pin to use a server other than `http://localhost:11434`. Keys are not allowed in this file: an extra field such as `"apiKey"` makes it invalid, and `??` then tells you to fix the file or run `qq init provider`. Set `QQ_PROVIDER_FILE` to an absolute path to keep the file somewhere else; a relative path makes the pin invalid.

## After changing your key or settings

A background daemon answers `??` for every terminal. It starts with your first interactive shell (and again on the next `??` if it is not running) and inherits that shell's environment. It reads `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `QQ_MODEL`, `~/.env.local` and `~/.config/qq/config.json` once, when it starts. `provider.json` is the exception: it is read on every `??`. On the Claude Code login route, the daemon also keeps one idle `claude -p` process ready, so the next `??` skips Claude Code's start-up.

- `qq init provider` restarts the daemon for you, so running it after exporting a new key is enough.

- Put your `export` lines in `~/.zshrc` above the `# queque shell integration` block that `qq init zsh` appended, so the daemon started during shell startup sees them.
- After changing any of them, restart the daemon from a shell that has the new values:

```shell
qq daemon --restart
```

After an upgrade or a rebuild of qq, the next `??` (or a new shell) replaces a daemon from another qq build by itself.
