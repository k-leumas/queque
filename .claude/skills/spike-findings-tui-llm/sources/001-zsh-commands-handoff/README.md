---
spike: 001
idea: installed-only-commands
name: zsh-commands-handoff
type: standard
validates: "Given the user's live zsh session, when the ?? widget hands zsh's $commands table to the qq client, then the list is current (includes binaries installed this session) and the widget adds < 10 ms"
verdict: VALIDATED
related: []
tags: [zsh, zle, commands-hash, startup-latency, freshness]
---

# Spike 001: zsh `$commands` handoff

## What This Validates
Given the user's live zsh session, when the `??` widget hands zsh's `$commands` table to the qq
client, then the list is current (includes binaries installed this session) and the widget adds
< 10 ms before the client launches.

User decision going in: **zsh `$commands` is the source of truth** ("treat it as gospel") — no
Node-side PATH scan, no daemon-side cache.

## Research
- `$commands` (zsh/parameter) is zsh's command hash table: name → absolute path for every
  executable in `$path`. It is filled lazily and only refreshed by `rehash` (or `hash -r`).
- The widget already writes a request JSON temp file before launching the client
  (`shell/zsh/queque.zsh` ~L200). A sibling file is the natural handoff.
- Other ideas considered and dropped per user choice: a PATH scan in Node at trigger time, and a
  daemon-kept index watched with `fs.watch`.

## How to Run
```
zsh bench.zsh          # first-pass: size, serialize, freshness (originally run with zsh -i)
zsh rehash-cost.zsh    # cost of an always-fresh handoff + staleness signals
```

## What to Expect
Timings per step in ms; a freshness probe showing whether a newly created binary appears.

## Investigation Trail
1. **Size.** 2,175 entries on this machine (27 PATH dirs). Names only = 19.9 KB. Also present:
   228 aliases, 1,533 functions (mostly `_completion` funcs), 104 builtins.
2. **Serialize.** `print -rl -- ${(k)commands} > file` = **1.3–2.5 ms** warm.
   Writing `name\tpath` in a `for k v` loop = **136 ms** — zsh loops are slow; never iterate
   per entry in the widget. Sorting keys with `${(ko)commands}` = **167 ms** (locale collation)
   — never sort in zsh; the client can sort if it needs to.
3. **Freshness (the surprise).** Dropping a new executable into a PATH dir: it is **not** in
   `$commands` until `rehash` (`whence -p` finds it by a PATH search; the table does not).
   A removed binary **stays** in the table until `rehash`. So "gospel" is only true after
   a rehash — a bare `$commands` read would hide tools installed in the current session,
   for example `brew install fd` followed by `find large files??`.
4. **Cost of always fresh.** `rehash` itself = 0.3 ms (it just drops the table); the refill
   happens on the next access = **~5.2 ms** for 27 dirs; write = 1.4 ms. **Total ≈ 7 ms**
   on every `??`, stable across 5 runs.
5. **Cheaper gate.** `zstat +mtime` over all 27 PATH dirs = **0.9 ms**. A dir's mtime changes
   when a binary is created in it, so `rehash` only when that fingerprint changes → ~2.3 ms
   typical. Caveat: mtime has 1 s granularity in `zstat`, and a second change within the same
   second was missed (symlink add right after a file add). A missed refresh just means
   one `??` is stale until the next mtime tick. Also, the brew `Cellar` symlinks land in
   `/opt/homebrew/bin`, which is in PATH, so the mtime signal does fire on brew installs.

## Results
**VALIDATED.** Always-fresh handoff = unconditional `rehash` + `print -rl -- ${(k)commands}` to
a temp file next to the request JSON: **~7 ms** in the widget, synchronous, before the client
launches. That's under one frame and well within the "very little startup time" budget, and
it removes the staleness problem entirely. The mtime-gated variant (~2.3 ms) is an optional
optimization with a small, self-healing staleness window. The simpler unconditional rehash is
recommended unless profiling says otherwise.

Signals for the build:
- Do: names only, one `print -rl`, no loops, no sort, rehash first.
- Don't: read `$commands` without rehash; iterate entries in zsh; serialize paths.
- The list is ~20 KB / ~2.2k names. Whether it can go into the prompt is spike 003's question.
- Side effect to keep in mind: running `rehash` in the widget also refreshes the user's
  interactive hash table. That's harmless, and arguably helpful.
