# Spike Manifest

## Ideas

### installed-only-commands
Only suggest commands for applications actually installed on the user's machine. Collection
must be fast (very little added startup time on `??`) and always up to date, including tools
installed earlier in the same shell session.

**Requirements:**

- zsh's `$commands` table is the source of truth for what is installed. No separate PATH scan
  or daemon-side index.
- Suggestions that use a tool that isn't installed are shown, flagged "not installed" — not dropped.
- The handoff must be fresh. `rehash` before reading `$commands`, because a bare read misses
  binaries installed this session (spike 001).
- Builtins come from zsh's `${(k)builtins}` in the same handoff; they are never flagged.
- Extracting command words from a candidate must never hang or throw on malformed model output
  (spike 002 found and fixed an infinite loop).
- Don't send the full `$commands` list to the model: about 33× the input tokens and no better
  at avoiding missing tools (spike 003, partial).

### multi-shell-trigger
Bring the literal `??` trigger to bash and fish with the same feel as zsh: the first `?` inserts
instantly, the second opens the picker with the text before the cursor as context, and the chosen
command lands back in the live buffer (Esc restores). The spike decides whether bash ships next
and whether fish comes back onto the roadmap.

**Requirements:**

- Same single-key approach as zsh: bind `?` and inspect the character before the cursor. No
  two-key `??` sequence binding (it delays every lone `?` by `keyseq-timeout`).
- bash 3.2 (macOS `/bin/bash`) must be refused with one clear line, leaving `?` untouched.
- A pasted `??` must not open the picker.

## Spikes

| # | Idea | Name | Type | Validates | Verdict | Tags |
|---|------|------|------|-----------|---------|------|
| 001 | installed-only-commands | zsh-commands-handoff | standard | Given a live zsh session, when the ?? widget hands $commands to the client, then the list is current and costs < 10 ms | VALIDATED | zsh, zle, freshness, startup-latency |
| 002 | installed-only-commands | candidate-binary-check | standard | Given a model-suggested command, when every program it runs is extracted and classified, then installed/builtin/missing are correct, fast, and never hang | VALIDATED | shell-parsing, tokenizer, flagging, robustness |
| 003 | installed-only-commands | prompt-steering | comparison | Given real ?? queries, when the prompt carries nothing / installed∩catalog / full list / full list cached, then compare missing-tool rate, steering, tokens, latency | PARTIAL | prompt, steering, tokens, prompt-caching |
| 004 | multi-shell-trigger | bash-readline-trigger | standard | Given interactive bash in a pty, when the user types `foo??` (emacs/vi-insert, multibyte, mid-line, pasted), then the trigger fires correctly and writes back to READLINE_LINE | VALIDATED (bash ≥5.0; 4.x untested) | bash, readline, bind-x, multibyte, bracketed-paste |
| 006 | multi-shell-trigger | fish-commandline-trigger | standard | Given interactive fish 4.x, when the user types `foo??` (default/vi insert, multibyte, multi-line, pasted), then bind + commandline fire and write back correctly | VALIDATED (fish 4.9; 3.x untested) | fish, commandline, bind, multibyte, paste |
