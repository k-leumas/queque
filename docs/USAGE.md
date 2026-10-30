# Usage

[Back to README](../README.md)

Type anything before `??` and QueQue turns it into a shell command:

```shell
list files by size??
find docker containers using port 3000??
git undo last commit but keep changes??
```

A selection UI opens in-terminal. Rows appear as the provider answers. Only Claude streams them today, so with Claude you can pick one before the rest have arrived; OpenAI and Ollama show the whole list at once. What you typed stays in the dim `queque ›` header, and the FILTER box opens empty: type to narrow the list, even while `thinking…` is still showing. Move with the arrow keys and press `Enter`. The command lands in your buffer exactly as shown, ready to run or edit. QueQue never runs it for you.

Press `Esc` to cancel. It stops the request to the provider and restores what you were typing, so you can tweak your intent and hit `??` again.

A command that matches a destructive pattern (`rm`, `sudo` and similar) is marked `⚠ review carefully — this command may be destructive`. The mark is a warning only; the row stays selectable.

## Installed-tool awareness

On every `??`, zsh refreshes its list of the commands it can find (`rehash`), so a tool you installed a moment ago in the same shell counts. QueQue uses that list in two ways.

**It tells the provider which well-known tools you have.** QueQue ships a fixed catalog of 196 public command-line tool names that have common alternatives, such as `rg`, `fd`, `bat`, `jq` and `kubectl`. The request includes only the catalog tools you have installed, with instructions to prefer them, to make at least one suggestion that uses only installed tools, and never to suggest install steps. The catalog mostly leaves out basic utilities such as `ls`, `grep` and `find`; the provider is told those are present. Nothing outside the catalog is sent: the rest of your `PATH`, your shell functions and your aliases stay on your machine. The catalog is checked twice, once before the request leaves the client and again just before the prompt is built, so a name that is not in it never reaches a provider.

**It marks suggestions that need a missing tool.** This check runs locally, against the full list. A row that needs a tool zsh cannot find gets `ⓘ` before its explanation, and the legend reads `ⓘ not installed`. The row stays selectable. When QueQue knows how to install that tool with brew, apt, dnf or pacman, the legend adds `tab prepends the install command`: press `Tab` (or `Shift+Tab`) on the row to switch it to the install form, and again to switch back. The install form is inserted like any other command, never run.

Set `QQ_TOOL_AWARENESS=0` in your shell to turn off both: no tool names are sent and no rows are marked.

## Inside Zellij

QueQue detects Zellij automatically and opens in a floating pane instead of inline. Same trigger, same result, better layout.

Set `QQ_PANE_WIDTH` (default `80`) and `QQ_PANE_HEIGHT` (default `24`) to resize the floating pane.

Without Zellij, QueQue falls back to an inline TUI in your current terminal session.
