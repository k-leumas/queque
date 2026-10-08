# Installed-Command Handoff (zsh → qq client)

## Requirements

- zsh's `$commands` table is the source of truth for what is installed. No separate PATH scan
  in Node, no daemon-side index.
- The handoff must be fresh: `rehash` before reading `$commands`. A bare read misses binaries
  installed earlier in the same session.
- Builtins come from zsh's `${(k)builtins}` in the same handoff and are never flagged as missing.

## How to Build It

1. In the `??` widget (`shell/zsh/queque.zsh`), the session already creates a private dir
   (`tmpdir=$(mktemp -d /tmp/qq-sess.XXXXXX); chmod 700`) and writes `$tmpdir/request.json`.
   Write the tool lists right next to it, **before** launching the client:

   ```zsh
   zmodload zsh/parameter              # usually already loaded in interactive zsh
   rehash                              # 0.3 ms — just drops the table
   print -rl -- ${(k)commands} > "$tmpdir/commands.txt"   # refill ~5 ms + write ~1.4 ms
   print -rl -- ${(k)builtins} > "$tmpdir/builtins.txt"   # 103 names, negligible
   ```

   The total is **~7 ms** on a machine with 2,175 commands across 27 PATH dirs (stable across 5 runs).
2. Add a field to the shell request contract (`src/contracts/shell.ts`, `version` bump), such
   as `commandsFile` / `builtinsFile` paths, or have the client derive them from the request
   file's directory. Keep the lists out of the JSON itself: a 20 KB names list doesn't belong
   in a `jq -Rs` string pipeline.
3. Client: read both files into `Set<string>` (split on `\n`). The cleanup trap already
   removes the session dir, so the files never outlive the request.
4. The `??` call doesn't depend on the list unless the prompt uses it (see
   `prompt-steering.md`). Writing it synchronously in the widget is still simplest: 7 ms is
   under one frame, and it guarantees the file exists before the client starts.

Optional optimization (~2.3 ms instead of 7 ms): only `rehash` when the PATH-dir mtime
fingerprint changes (`zmodload -F zsh/stat b:zstat`, `zstat -A s +mtime -- $dir` over `$path`
= 0.9 ms). There's a self-healing staleness window, because zstat mtime has 1 s granularity.
Not worth it unless profiling says so.

## What to Avoid

- **Reading `$commands` without `rehash`.** A newly created binary is absent until `rehash`
  (`whence -p` finds it, the table doesn't), and a deleted binary lingers. For example,
  `brew install fd` followed by `find large files??` would hide `fd`.
- **Looping over `$commands` in zsh.** Writing `name\tpath` with `for k v in ${(kv)commands}`
  took **136 ms**. Use a single `print -rl` expansion.
- **Sorting in zsh.** `${(ko)commands}` took **167 ms** (locale collation). Sort in Node if needed.
- **Serializing paths.** Names-only is 20 KB; with paths it's 66 KB, and nothing needs the paths.
- Don't add a Node PATH scan or `fs.watch` daemon index. That contradicts the user's
  "zsh is gospel" decision.

## Constraints

- About 2.2k entries / 20 KB on a typical dev Mac. Scales with PATH size.
- `rehash` in the widget also refreshes the user's interactive hash table. That's harmless.
- `$builtins` varies with loaded zsh modules, so pass it rather than hardcoding it.
- zsh only. bash's `compgen -c` is the analog if bash support ever lands. Untested.

## Origin

Synthesized from spikes: 001
Source files available in: sources/001-zsh-commands-handoff/
