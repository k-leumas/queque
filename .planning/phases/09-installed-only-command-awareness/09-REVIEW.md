---
phase: 09-installed-only-command-awareness
reviewed: 2026-10-10T19:38:42Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - docs/EXTENSIONS.md
  - shell/zsh/queque.zsh
  - src/client/run-foreground.ts
  - src/client/tool-handoff.ts
  - src/contracts/ipc.ts
  - src/contracts/request.ts
  - src/daemon/bootstrap.ts
  - src/daemon/server.ts
  - src/providers/claude-cli.ts
  - src/providers/claude.ts
  - src/providers/steering.ts
  - src/shared/command-words.ts
  - src/shared/tool-awareness.ts
  - src/shared/tool-catalog.ts
  - src/ui/CandidateSelect.tsx
  - src/ui/ControlsLine.tsx
  - src/ui/modal-layout.ts
  - tests/candidate-select.test.tsx
  - tests/claude-cli-provider.test.ts
  - tests/claude-provider.test.ts
  - tests/client-result.test.ts
  - tests/command-words-fuzz.test.ts
  - tests/command-words.test.ts
  - tests/controls-line.test.tsx
  - tests/daemon-bootstrap.test.ts
  - tests/daemon-fetch.test.ts
  - tests/fixtures/command-words-cases.ts
  - tests/fixtures/command-words-fuzz-child.mjs
  - tests/modal-layout.test.ts
  - tests/steering.test.ts
  - tests/tool-awareness.test.ts
  - tests/tool-handoff.test.ts
  - tests/zsh-widget.test.ts
findings:
  critical: 2
  warning: 5
  info: 5
  total: 12
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-10-10T19:38:42Z
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

I reviewed the whole Phase 9 diff (`993e4bf..HEAD`). That covers the zsh handoff helper, the handoff reader, the lexer, the annotate/install planner, the catalog, the steering prompt, the IPC chunk schemas, the pong capability bump and the picker UI. I didn't take the lexer's behaviour on trust: I ran realistic model-style commands through `extractCommandWords` and `annotateCandidates`, using a throwaway probe that I then deleted.

Parts that hold up:

- **zsh helper.** The ERR-trap guarding is sound and the tests cover the failure modes.
- **IPC.** The lenient daemon schema and the strict client schema split correctly. The pong flag replaces stale daemons. Every path from the handoff to the prompt sends only names from the catalog.
- **Kill switch.** `QQ_TOOL_AWARENESS=0` works on both the shell side and the client side.

The main defects are in how command words are classified. Two kinds of common multi-line commands produce false "not installed" marks:

- **Heredoc bodies** are lexed as commands.
- **`\`-newline continuations** are lexed as commands.

In addition, `watch 'cmd'` and wrapper long options with a separate value (`sudo --user root`) are misread. The long-option case produces a Tab install form for an unrelated real package (`brew install root`). Other findings:

- The package alias map uses Homebrew names but is also applied to apt, dnf and pacman.
- The viewport-reserve comment describes a footer layout that the code doesn't have.
- Two wall-clock asserts make the tests flaky under load. These are separate from the known bug-206.

Out of scope as instructed: bug-206 (the 1 s spawn-timeout flake) and the 2 known biome warnings.

## Critical Issues

### CR-01: Heredoc bodies and `\`-newline continuations are classified as commands (false "not installed" marks, real commands missed)

**File:** `src/shared/command-words.ts:102-106, 130-140, 159-164, 326-333`
**Issue:** Two lexing mistakes cause valid commands to get a ⓘ mark.

1. **Heredocs.** `lexHand` emits `<<` as a `redir`. `commandWords` then skips only the delimiter word. The newline after it becomes an `op ';'`, which resets to command position, so every body line and the closing delimiter are lexed as commands. Verified output:
   - `cat <<EOF\nhello world\nEOF` → `missingTools: ["hello","EOF"]`
   - `cat > out.txt <<'EOF'\nfoo bar\nbaz\nEOF` → `foo`, `baz` and `EOF` are flagged as external commands.

   Models often answer "write X to a file" with exactly this shape. Every such candidate gets a ⓘ mark and the "not installed" legend even though `cat` is installed. The install plan is blocked as `unwrappable-command`, so the false mark can't be explained or cleared.
2. **Line continuations.** A backslash followed by a newline is a line continuation and should be removed. The word loop at 159-164 instead appends the newline character to the word. In command position this produces an external command named `"\n"`, and the real command becomes an argument that is never checked. Verified output:
   - `FOO=1 \\\n  fd x` → `missingTools: ["\n"]`. `fd` is never checked, which is a false negative on top of the false mark.
   - `sudo \\\n  apt update` → `"\n"` is flagged and `apt` is skipped.

   Multi-line `env`/`sudo`/assignment-prefixed commands with continuations are a normal model output shape.

**Fix:** In the word loop, treat a backslash followed by a newline as a continuation, and do the same at token start before the `OP_CHARS` newline branch:
```ts
if (ch === '\\') {
  if (s[i + 1] === '\n') { i += 2; continue; }   // line continuation: no text, no word break
  v += s[i + 1] ?? '';
  i += 2;
  quoted = true;
  continue;
}
```
For heredocs, record any pending heredoc delimiters (strip quotes from `'EOF'`/`"EOF"`, and note `<<-`) when a `<<`/`<<-` redir's target word is consumed. On the next newline, skip input up to and including the line that equals the delimiter (after stripping leading tabs for `<<-`). Do not lex the body. Add both shapes to `tests/fixtures/command-words-cases.ts`.

### CR-02: Wrapper operands are misread: `watch 'cmd'` is flagged, and long options produce an install form for an unrelated package

**File:** `src/shared/command-words.ts:268-281, 361-372`; `src/shared/tool-awareness.ts:163-169`
**Issue:**

- **`watch` with a quoted command.** `watch` is in `WRAPPERS`, so its first non-option operand is treated as a program name. Users nearly always quote the whole command for `watch`, so the operand is a full command string. Verified: `watch -n 2 'kubectl get pods'` → `missingTools: ["kubectl get pods"]` with kubectl installed. The row gets a false ⓘ mark, and the install plan is blocked as `unsafe-package-name`.
- **Long options with a separate value.** The wrapper tables list only short options. When an option and its value are separate words (`sudo --user root`, `xargs --max-args 1`), the value becomes the "program". Verified:
  - `sudo --user root fd x` → `missingTools: ["root"]`, `install.form: "brew install root && sudo --user root fd x"`. Homebrew has a real `root` formula, the multi-GB CERN ROOT framework, and `fd` is never checked.
  - `xargs --max-args 1 rm` → install form `brew install xargs 1 && …`.

  The legend tells the user that Tab "prepends the install command", so the product is offering this form as the fix.
- **`command` and `exec` options.** The same pattern affects options after these builtins (lines 410-424). `command -p ls` flags `-p` as an external command and never checks `ls`. `exec -a name fd` flags `-a`.

**Fix:**
- For `watch` (and `sh -c`-style operands), if the operand is a single quoted word containing whitespace, call `recurse(w)` instead of classifying it as a word. More generally, recurse into any quoted wrapper operand that contains a space.
- Make the wrapper option tables recognise `--long=value` (no skip) and `--long value`. List the long forms that take a value: `sudo --user/--group/--host/--prompt/--chdir/--role/--type/--close-from/--other-user`, `xargs --max-args/--max-procs/--max-lines/--replace/--delimiter/--eof/--arg-file`, `timeout --signal/--kill-after`, `nice --adjustment`, `watch --interval/--differences`, `env --unset/--chdir/--split-string`. Treat an unknown `--opt` as a flag with no value.
- After `command` and `exec`, skip leading `-p`/`-a NAME`/`-c`/`-l` before returning to command position.
- Add `sudo --user root fd`, `watch -n 1 'ls -la'` and `command -p ls` to the fixture table.

## Warnings

### WR-01: Package alias map uses Homebrew names but is applied to apt/dnf/pacman

**File:** `src/shared/tool-awareness.ts:66-100, 127-129, 166`
**Issue:** `packageFor` is used for every installer, but several map entries are Homebrew formula names that don't exist under the Linux managers. Examples:
- `kubectl → kubernetes-cli`: apt has `kubectl`, dnf has `kubernetes-client`.
- `dig → bind`: apt has `bind9-dnsutils`, dnf has `bind-utils`.
- `ag → the_silver_searcher`: apt has `silversearcher-ag`.
- `gsed → gnu-sed` and `gtimeout`/`gdate → coreutils` are macOS-only concepts.

D-12 accepts that a tool missing from the map can be a wrong guess that "fails visibly". Here, though, the shipped map itself produces the wrong name on Linux, so the guess is wrong by construction. Also, `apt install fd`/`bat` installs binaries named `fdfind`/`batcat`, so the `&& fd …` half still fails afterwards.
**Fix:** Key the alias map by installer, for example `ReadonlyMap<InstallerId, ReadonlyMap<string, string>>` with a shared default, and pass `installer` into `packageFor(tool, installer)`. At minimum, apply only the brew-specific entries when `installer === 'brew'`.

### WR-02: Viewport-reserve comment describes a shared footer margin that the code doesn't have, and the 17-line reserve is short when both footers show

**File:** `src/client/run-foreground.ts:238-246`
**Issue:** The comment says "The destructive and missing-tool footers share one margin, so flags grow the reserve by one line, not four". In fact, `CandidateSelect.tsx:330-340` renders the destructive warning and the legend as separate `<Box marginTop={1}>` blocks. `estimateCandidateSelectLines` (modal-layout.ts:193-202) also counts a margin for each. So each footer adds 2 lines.

With 3 two-line candidates, header, destructive warning and legend, the modal is 1+1+1+9+2+2+2 = 18 lines, which exceeds the 17 reserved. The comment is a leftover from the dropped `missingToolsFooterText` design. A future editor would trust it.
**Fix:** Correct the comment. Either reserve 18 lines, or render the two footers in one `<Box marginTop={1} flexDirection="column">` so the shared margin claim becomes true. Update the estimate to match whichever you choose.

### WR-03: Wall-clock asserts make the tests flaky under parallel load

**File:** `tests/zsh-widget.test.ts:933`; `tests/command-words-fuzz.test.ts:109-115`
**Issue:**
- The zsh handoff median is held to under 25 ms. The cerebrum records a real measurement of 10-12 ms, so that's about 2x headroom.
- The 2,000-level nesting run must finish in under 100 ms of in-child time.

Both run while vitest is executing other suites in parallel workers, including spawn-heavy ones such as the fuzz children. These are the same class of flake as bug-206 but in separate asserts, so fixing bug-206 won't cover them.
**Fix:** Gate the absolute-latency asserts behind an env flag (e.g. `QQ_PERF_TESTS=1`), or widen them to a ceiling that only a real regression would hit (e.g. 100 ms and 500 ms). Keep the measurement logged.

### WR-04: Install-form toggle and the search filter disagree on what a row "is"

**File:** `src/ui/modal-layout.ts:109-116`; `src/ui/CandidateSelect.tsx:184-200, 255-261`
**Issue:**
- `filterCandidates` matches the query against `candidate.command`, but a toggled row shows and inserts `install.form`. After Tab, typing `brew` (text the user can see) hides the row.
- Typing a query that narrows the list resets `selectedIndex` but keeps `installToggled`, so a hidden row keeps its toggle.

The behaviour is consistent with itself but surprising, and it isn't covered by tests.
**Fix:** Filter on `displayedCommand(c, installToggled)`, passing `installToggled` into `filterCandidates`. Or document that the filter matches only the original command and add a test that locks it in.

### WR-05: `lookupOnly` handling is dead, so `command -v`, `type` and `which` operands work only by accident

**File:** `src/shared/command-words.ts:313, 414-421, 428`
**Issue:** `command -v` sets `lookupOnly = true` and `expect = false` together. Every path that makes `expect` true again (an `op` → `reset()`) also clears `lookupOnly`. Line 428 `if (lookupOnly) continue;` is therefore unreachable. Operands of `command -v x` are skipped only because `expect` is false, and `type`/`which` have no lookup handling at all (they rely on being builtins).

The dead flag suggests a lookup-only design that was never wired up. A later change (for example, re-opening command position after options as CR-02 suggests) could silently start classifying `command -v fd` operands as commands.
**Fix:** Remove `lookupOnly` and the line-428 check. Or make the intent explicit: after `command -v|-V`, set `skipUntil`-style "args until next op" state, and add `command -v fd && fd` / `type fd` cases to the fixture table.

## Info

### IN-01: Known false negatives in the lexer are undocumented

**File:** `src/shared/command-words.ts:356, 384-387, 261`
**Issue:** These commands are never checked:
- `bash -lc 'fd x'`: `prev === '-c'` only matches a separate `-c`.
- `env -S 'fd x'`.
- Every command inside a `case … esac` body: `skipUntil = 'esac'` skips the arms.
- The zsh short `for f (*.txt) cmd` form: `skipUntil = 'do'` never matches.

These fail open (no flag), which is the safe direction, but the module header doesn't list them.
**Fix:** List them in the module header, or match `-*c` clusters for shells and recurse into `case` arms after `)`.

### IN-02: Function definitions flag the function name

**File:** `src/shared/command-words.ts:141-145, 430`
**Issue:** `foo() { fd; }` returns `foo` as an external command (verified), so the name gets a ⓘ mark. `(( i++ ))` likewise flags `i++`. Both are rare in model output.
**Fix:** When a word is followed by the `(` `)` op pair, treat it as a function name. When `(` `(` appears at command position, skip to the matching `))`.

### IN-03: Legend line estimate uses the gutter-reduced width

**File:** `src/ui/modal-layout.ts:198-202`
**Issue:** The legend is wrapped with `input.contentWidth`, which subtracts the 3-column row gutter. The legend Box has no gutter. On terminals narrower than about 55 columns the estimate is one line too high, so the Zellij pane is one row taller than needed.
**Fix:** Wrap the legend at `contentWidth + ROW_GUTTER.length`. Export the gutter width from one place so it doesn't drift.

### IN-04: The installed-tools list now also appears in `ps` output for `/login` users

**File:** `src/providers/claude-cli.ts:27-28`
**Issue:** `buildSystemPrompt(envelope)` is passed on argv. The steered system prompt therefore exposes the catalog ∩ installed list to anyone who can run `ps`, in addition to the user prompt already accepted under T-08-02-07. The names are only public catalog names, so the impact is low, but the threat register entry doesn't mention the list.
**Fix:** Extend the T-08-02-07 note to cover the steering text.

### IN-05: Steering guard test is marker-based and easy to bypass

**File:** `tests/steering.test.ts:241-250`
**Issue:** The guard detects "sends a system prompt" only through 4 string markers (`messages.create(`, `'--system-prompt'`, `/api/chat`, `chat/completions`). An adapter using an SDK method such as `responses.create(`, or a `"--system-prompt"` literal in double quotes, would pass without calling `buildSystemPrompt`.
**Fix:** Also require that every non-helper file in `src/providers/` that exports an `LLMAdapter` imports `buildSystemPrompt`.

---

_Reviewed: 2026-10-10T19:38:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
