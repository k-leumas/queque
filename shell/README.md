# Writing a shell adapter

QueQue's shell layer is one adapter script per shell. The adapter owns everything the shell does differently: the key binding, reading and writing the line, the prompt redraw and the result read. Everything after the trigger, from the picker to the provider, is the unchanged `qq client`, and shared code never names a shell.

| Shell | Adapter | Status |
|---|---|---|
| zsh | [`zsh/queque.zsh`](zsh/queque.zsh) (ZLE widget) | shipped, the reference adapter |
| bash | [`bash/queque.bash`](bash/queque.bash) (readline `bind -x`, bash 5.0+) | shipped |
| fish | `fish/queque.fish` | planned (Phase 12) |

This page is the contract a new adapter follows. When in doubt, read the zsh adapter, then the bash one: each section comment there says where and why it differs.

## The contract

- One file, `shell/<name>/queque.<ext>`, sourced from the shell's rc file by `qq init`. All of the shell's quirks stay inside it.
- Non-interactive shells that read the rc file (scp, rsync, `bash -c`) must print nothing and change nothing.
- A shell version that cannot run the adapter refuses at source time with one line on stderr (bash: `queque: the ?? trigger needs bash 5.0+ (found …)`) and defines none of the trigger code. bash below 5.0 binds only a warning: typing `??` keeps both `?` on the line and prints `queque: bash 5.0 or newer is needed for the ?? trigger (this is bash 3.2)`, plus the `brew install bash` fix on macOS (a `??` macro plus a `bind -x` on the private chord `\C-x\C-q`). Keep the code above that check parseable by the oldest version you refuse.
- Call external tools through `command` (or the shell's equivalent), so a user's `alias rm='rm -i'` cannot change what the adapter runs. A user's `set -e` or similar must not leak in or out.
- The adapter never runs the chosen command. It places it in the line; the user presses Enter (insertion-only).

## The trigger

- Bind `?` alone, in the insert-style keymaps only (zsh `emacs` and `viins`, bash `emacs` and `vi-insert`, fish default and `insert`). Never the vi command keymap, where `?` searches history.
- On each `?`, look at the character before the cursor. Not a `?`: insert a literal `?` at once and return. A `?`: remove it, remember the line and the cursor, and start QueQue.
- Never bind the two-key sequence `??`: a lone `?` would then wait for the key-sequence timeout before it appears.
- Leave pasted text alone: a pasted `??` must not open the picker. zsh and bash rely on bracketed paste (`qq doctor --shell bash` checks that it is on); fish handles paste internally.
- Count the cursor in characters, not bytes, so multibyte text needs no special handling.

## The session dir

Every trigger gets a private dir from `mktemp -d /tmp/qq-sess.XXXXXX`, then `chmod 700`. An empty or failed `mktemp` stops right there with `queque: cannot create a temp dir in /tmp`: never fall back to a path like `/request.json`. Every exit after the dir exists removes it (see the two-flag cleanup below).

## request.json

Written into the session dir with a JSON tool (`jq -n --arg …`, or `jq -Rs .` per value), never by string concatenation. The schema is `shellRequestSchema` in [`src/contracts/shell.ts`](../src/contracts/shell.ts):

| Field | Value |
|---|---|
| `version` | `1` |
| `ttyPath` | the terminal, usually `/dev/tty`; the client opens it itself |
| `cwd` | the shell's working directory (absolute) |
| `shellPid` | the shell's pid (a number: `--argjson`) |
| `lbuffer` | the line before the cursor, without the trigger `?` |
| `rbuffer` | the line after the cursor |
| `shell` | the shell's name from `SHELL_NAMES`; it defaults to `zsh`, so always send it |
| `shellVersion` | the raw version string (`$BASH_VERSION`, `$ZSH_VERSION`, fish `$version`), at most 40 characters; telemetry keeps only major.minor |

The line travels as two strings, never as a buffer plus a cursor index: Node counts UTF-16 units and shells count characters.

Then run `qq client --request-file <dir>/request.json --result-file <file>`, and export `QQ_RESULT_FILE=<file>` first so the client's crash handlers can still write a cancel.

## Results

The client writes one JSON object, `shellResultSchema` in the same file:

| `kind` | Adapter does |
|---|---|
| `cancel` | restore the original line and cursor |
| `replace-buffer` | print the query (dim, `queque › …`) and the command above the prompt, set the line to `lbuffer` + `rbuffer` with the cursor between them |
| `error` | print `message`, restore the line and cursor |

Anything else (no file, unparsable JSON, an unknown kind, an empty `lbuffer`) restores the line and cursor. Print user text through a `%s` argument, never as a format string.

**Restore the line and the cursor on every path that does not accept.** zsh gets the cursor back by restoring `LBUFFER` and `RBUFFER`; bash saves `QQ_ORIG_POINT` and sets `READLINE_POINT` back.

**History:** add the natural-language query (`lbuffer` before the trigger) to history, never the command. The command enters history only when the user runs it.

## Inline and Zellij paths

- **Inline** (no `$ZELLIJ`): run the client as a foreground child; it writes `result.json` in the session dir. If the client crashes and leaves no result, the line is restored and the adapter clears the instant frame itself.
- **Zellij** (`$ZELLIJ` set): run the client in `zellij run --floating --close-on-exit --name qq`, with the result coming back as one newline-terminated line through a FIFO in the session dir. Export `QQ_PANE_WIDTH` and `QQ_PANE_HEIGHT` (default 80 and 24) for the client.
  - Open the FIFO before the launch, so a pane that never starts cannot block the open.
  - The result read must time out after 30 seconds and count as a cancel, so a dead pane can never hang the shell. In fish, `read -t` means tokenize, not timeout, and `read` has no timeout at all: use a guard process that writes a cancel into the FIFO after 30 seconds.
  - Setup failures are a restore with a fixed debug-log reason, never a silent wait: `mkfifo failed`, `fifo open failed`, and `zellij run failed` (a launcher that exits non-zero writes a sentinel line into the FIFO, which wakes the read at once).
  - Call `zellij` without `command`, so tests can replace it with a shell function.

## Installed-tool handoff

Before the client starts, the adapter writes the names the shell can resolve into the session dir, next to request.json (`TOOL_HANDOFF_FILES` in [`src/client/tool-handoff.ts`](../src/client/tool-handoff.ts)):

| File | Contents |
|---|---|
| `commands.txt` | every command name the shell resolves, `PATH` included |
| `builtins.txt` | builtins (never flagged as missing) |
| `functions.txt` | functions without a leading `_`, plus alias names; fish abbreviations (`abbr --list`) go here too |

One name per line, unordered. Rescan `PATH` on every trigger so a tool installed a moment ago counts. An empty `commands.txt` means "no handoff": remove all three files. `QQ_TOOL_AWARENESS=0` skips the scan.

**Fast scans** (zsh, about 9 ms) write the files before the client starts and need nothing else.

**Slow scans** (bash `compgen`, about 85 ms; fish is similar) run in a detached writer alongside client startup, behind the `tools.pending` marker (`TOOL_HANDOFF_PENDING`):

1. The adapter creates `<dir>/tools.pending`, then starts the writer detached and silent (no job-control noise in the user's terminal).
2. The writer writes the three files, removes `tools.pending` last, then removes the dir if `closed` exists.
3. The client waits up to 500 ms while `tools.pending` exists (`TOOL_HANDOFF_PENDING_BUDGET_MS`), then gives up and shows no flags.

**Two-flag cleanup:** at every exit the adapter writes `<dir>/closed`, then removes the dir only if `tools.pending` is gone. Each side sets its own flag before it checks the other's, so whichever finishes last removes the dir, exactly once in effect.

## The instant frame

The moment the trigger fires, before `mktemp`, `jq` and Node, the adapter paints the `queque › <lbuffer>` header and a `thinking…` row, so the picker shows something at once. Inline, it paints into the terminal; in Zellij, it writes `instant-frame.txt` into the session dir for the pane wrapper. `QQ_INSTANT_FRAME=0` paints nothing.

The bytes are specified once, in [`src/shared/instant-frame-spec.ts`](../src/shared/instant-frame-spec.ts) (`instantFrameRows`, `inlineInstantFrameBytes`, `paneInstantFrameBytes`, `INSTANT_FRAME_SPEC`). A new adapter ports those functions natively (no forks) and adds itself to `ADAPTERS` in [`tests/instant-frame-parity.test.ts`](../tests/instant-frame-parity.test.ts), which compares every adapter with the reference byte for byte.

## Prompt redraw

After the picker, every line of a multi-line prompt must come back. Each shell needs its own fix: bash reprints the leading lines of `${PS1@P}` itself, because readline repaints only the last one; fish prints a newline first and pads for the lines of `fish_prompt`, then calls `commandline -f repaint`.

## Checklist for a new shell

The shell name is already in `SHELL_NAMES`. To ship it:

1. Write `shell/<name>/queque.<ext>` to this contract.
2. [`src/shared/shell-registry.ts`](../src/shared/shell-registry.ts): fill in its `SHELL_SPECS` entry (rc file, adapter file, version probe, floors, binding widget and keymaps) and set `shipped: true`.
3. [`src/registry/bootstrap.ts`](../src/registry/bootstrap.ts): `registerShellAdapter({ id, shell, description })`.
4. [`src/cli/commands/doctor.ts`](../src/cli/commands/doctor.ts): a binding probe for the shell (bash has `BASH_BINDINGS_SCRIPT` and `parseBashBindings`). The version check reads the registry; the doctor check id already exists in `DOCTOR_CHECK_IDS`.
5. [`src/contracts/telemetry.ts`](../src/contracts/telemetry.ts): `SHELL_KINDS` already lists every `SHELL_NAMES` entry; nothing to add unless the name is new.
6. [`src/shared/command-words.ts`](../src/shared/command-words.ts): the shell's reserved words in `RES_EXPECT_BY_SHELL` and `RES_LOOP_BY_SHELL` if its syntax differs (fish uses the bash rules until then).
7. Tests: a row in `PTY_SHELLS` in [`tests/shell-pty.test.ts`](../tests/shell-pty.test.ts) (the tmux PTY harness, `tests/pty/drive.sh`), a row in `ADAPTERS` in the parity test, adapter unit tests like `tests/bash-widget.test.ts`, and the shipped list in [`tests/shell-names-invariant.test.ts`](../tests/shell-names-invariant.test.ts).
8. Packaging: the Homebrew formula installs the adapter into `share/queque/`, and CI installs the shell.
9. Docs: [docs/INSTALL.md](../docs/INSTALL.md) and the README install block.

Harness variables such as `QQ_TEST_BASH`, `QQ_TEST_ZSH` and `QQ_TEST_RESULT_MODE` are for development only; see [CONTRIBUTING.md](../CONTRIBUTING.md#shell-adapter-tests-pty-harness). A harness that sources an adapter must unset `ZELLIJ`, `ZELLIJ_PANE_ID` and `ZELLIJ_SESSION_NAME` first, or it opens real floating panes in your session.
