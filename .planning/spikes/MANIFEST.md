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

## Spikes

| # | Idea | Name | Type | Validates | Verdict | Tags |
|---|------|------|------|-----------|---------|------|
| 001 | installed-only-commands | zsh-commands-handoff | standard | Given a live zsh session, when the ?? widget hands $commands to the client, then the list is current and costs < 10 ms | VALIDATED | zsh, zle, freshness, startup-latency |
| 002 | installed-only-commands | candidate-binary-check | standard | Given a model-suggested command, when every program it runs is extracted and classified, then installed/builtin/missing are correct, fast, and never hang | VALIDATED | shell-parsing, tokenizer, flagging, robustness |
