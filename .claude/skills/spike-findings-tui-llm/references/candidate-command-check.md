# Candidate Command Check (flag suggestions that use missing tools)

## Requirements

- Suggestions that use a tool that isn't installed are **shown, flagged "not installed"**,
  not dropped.
- Builtins (from `${(k)builtins}`) are never flagged.
- Extracting command words from a candidate must never hang or throw on malformed model output.

## How to Build It

1. Port `sources/002-candidate-binary-check/extract.mjs` to TypeScript in `src/` (for example
   `src/shared/command-words.ts`). Two pieces:
   - `lexHand(s)` — handles quotes (`'…'`, `"…"`, `\`), `$(…)` / backticks / `<(…)`
     (recorded as nested command text and recursed), `$((…))` / `${…}` (skipped),
     redirections (the target word is skipped), and QueQue placeholders (`<user@host>`
     beats redirection via `/^<[A-Za-z0-9@._:\/+~-]+>/`).
   - `commandWords(tokens, builtins)` returns `{ word, kind }[]` where kind is one of
     `external | builtin | placeholder | dynamic ($EDITOR) | path (./x.sh)`. It knows:
     - assignments, detected from the literal prefix before the first quote (`tok.lead`), so
       `BAZ="a b" node` works
     - zsh reserved words (`if then do ! { time …`), with `for/foreach/select` skipped until `do`,
       `[[` skipped to `]]`, and `case` to `esac`
     - `command -v x` and other lookup-only forms
     - wrappers and their argument-taking options: `sudo -u X`, `env VAR=…`, `nice -n N`,
       `timeout DURATION`, `xargs -n/-P/-I…`, `watch -n N`, `nohup`, `doas`, `caffeinate`, `stdbuf`
     - `find -exec/-execdir CMD` and `bash|sh|zsh -c "…"` (recursed)
2. Classify: `external` words not in the `$commands` Set are missing. Attach them to the
   candidate, e.g. extend `commandCandidateSchema` (`src/contracts/candidates.ts`) with an
   optional `missingTools: string[]`, or compute it in the client right before rendering.
3. Render the flag in `src/ui/CandidateSelect.tsx`, for example as a dim
   `not installed: fd` suffix. Keep insertion behaviour unchanged: the user can still pick a
   flagged command.
4. Tests (vitest):
   - Use the 40 cases in `sources/002-candidate-binary-check/cases.mjs` as table fixtures.
   - Fuzz: 20k random strings over ``ab $()`'"|&;<>{}[]\#=\n\t-`` plus the crafted malformed
     list. Run them in a **child process with a hard timeout**, because an in-process hang
     just hangs the test runner.
   - Pathological nesting: `'$('.repeat(2000)` must finish in < 100 ms.
5. Cost: ~3.5 µs per candidate. Run it after the response arrives; it adds nothing measurable.

## What to Avoid

- **`indexOf` returning −1 used as a cursor.** An unterminated backtick inside double quotes
  set `i = -1`, which rewound to 0 and looped forever once an earlier `"` existed. Smallest
  repro: `"a" "\``. Clamp to `s.length` everywhere you scan for a closer.
- **shell-quote** (1.12): misses `"…$(date)…"` (substitution inside double quotes is very
  common in model output), `<(…)` process substitution, and backticks. It scored 37/40.
- **sh-syntax** (0.7, WASM mvdan/sh): its JS bridge returns command nodes as `{Pos, End}` only,
  so names can't be extracted. It also adds ~50 ms cold and a 750 KB WASM file. Dead end.
- **bash-parser**: unmaintained since 2022, POSIX only.
- Checking assignments with "is the word unquoted?" fails on `BAZ="a b"`. Check the literal
  prefix instead.
- Hardcoding the builtin list. Use the handoff.

## Constraints

- **Open decision:** `brew install fd && fd -e ts` currently flags `fd` even though the same
  command installs it. Options: label it "installed by this command" when an earlier segment
  is `brew|apt|dnf|pacman install <name>` (package names often differ from binary names, e.g.
  ripgrep → rg), or accept the flag. Ask the user.
- Aliases and personal functions aren't checked. If the model suggests one it gets flagged.
  Handing off `${(k)aliases}` is cheap if that matters.
- Path commands (`./deploy.sh`, `/usr/local/bin/x`) and `$VAR` commands aren't checked.

## Origin

Synthesized from spikes: 002
Source files available in: sources/002-candidate-binary-check/
