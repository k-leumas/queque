# Install

[Back to README](../README.md)

QueQue works in zsh and in bash 5.0 or newer. fish support is planned.

## Homebrew

```shell
brew install k-leumas/tap/queque
qq init
source ~/.zshrc    # zsh
source ~/.bashrc   # bash
```

## Install via npm

### Requirements

- zsh, or bash 5.0 or newer
- Node.js 24 or newer
- [jq](https://jqlang.github.io/jq/)
- Claude Code signed in, an Anthropic API key, an OpenAI API key, or Ollama (see [Choose a provider](PROVIDERS.md))

```shell
npm install -g @k-leumas/queque-cli
qq init
source ~/.zshrc    # or: source ~/.bashrc
```

## Set up your shell

> [!NOTE]
> `qq init` detects your shell from `$SHELL` (or your login shell) and adds two lines to the end of its rc file itself: a `# queque shell integration` comment and a `source` line for the QueQue script. Do not redirect its output into the file. Run it again and it changes nothing. To pick the shell yourself, run `qq init zsh` or `qq init bash`.

### zsh

```shell
qq init zsh
source ~/.zshrc
```

### bash

QueQue needs bash 5.0 or newer for the `??` trigger. `qq init bash` checks the bash you use and refuses an older one; an older bash that sources the script prints `queque: the ?? trigger needs bash 5.0+` and does nothing else.

```shell
qq init bash
source ~/.bashrc
```

On macOS, `/bin/bash` is 3.2, so install a current bash first:

```shell
brew install bash
```

If your login shell is `/bin/bash`, `qq init bash` refuses and says how to make the Homebrew bash your login shell: add its path to `/etc/shells`, then run `chsh -s` with that path. Whether to do that is up to you; QueQue never edits `/etc/shells` and never runs `chsh`. If your login shell is zsh and you start bash yourself, nothing needs to change.

macOS terminals start login shells, and a login bash reads `~/.bash_profile` (or `~/.bash_login`, or `~/.profile`) instead of `~/.bashrc`. If yours does not load `~/.bashrc` yet, add this line to it:

```shell
[ -f ~/.bashrc ] && . ~/.bashrc
```

`qq init bash` and `qq doctor --shell bash` warn when that line is missing. QueQue never edits your login files, so this step is yours.

## Check your setup

`qq doctor` checks your shell, jq, the daemon, the keybinding and your provider, and says how to fix anything that fails. It checks the shell you use; `qq doctor --shell bash` or `qq doctor --shell zsh` picks one.

## Undo `qq init`

Open your rc file (`~/.zshrc` or `~/.bashrc`) and delete the two lines `qq init` added:

- `# queque shell integration`
- the `source` line after it, ending in `queque.zsh` or `queque.bash`

Then open a new terminal. A `~/.bash_profile` line that loads `~/.bashrc` is not QueQue's and can stay.
