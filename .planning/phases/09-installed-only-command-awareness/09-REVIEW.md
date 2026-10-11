---
phase: 09-installed-only-command-awareness
reviewed: 2026-10-11T10:42:33Z
depth: standard
files_reviewed: 36
files_reviewed_list:
  - docs/EXTENSIONS.md
  - shell/zsh/queque.zsh
  - src/client/run-foreground.ts
  - src/client/tool-handoff.ts
  - src/client/zellij-pane-resize.ts
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
  - tests/candidate-select-layout.test.tsx
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
  - tests/zellij-pane-resize.test.ts
  - tests/zsh-widget.test.ts
findings:
  critical: 2
  warning: 8
  info: 9
  total: 19
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

## Gap-Closure Review: Plan 09-06

**Reviewed:** 2026-10-11T10:42:33Z
**Depth:** standard
**Scope:** `git diff 8b4c1c9^..e8677f3 -- src tests` (G-09-7, the empty Zellij modal)
**Files Reviewed:** 5 (`src/ui/CandidateSelect.tsx`, `src/client/zellij-pane-resize.ts`, `tests/candidate-select-layout.test.tsx`, `tests/zellij-pane-resize.test.ts`, `tests/candidate-select.test.tsx`)
**New findings:** 0 critical, 3 warning, 4 info

### Summary

Plan 09-06 removes the two races behind G-09-7. First, `CandidateSelect` now resets on candidate arrival during render (the `prevCandidates` pattern), so the stale "no matches" height is never committed or reported. Second, `syncZellijFloatingPaneHeight` now runs a one-slot queue where the newest request wins. I checked both against the source and ran the three test files: 58 pass.

Parts that hold up:

- **Render-phase reset.** The guard `candidates !== prevCandidates` runs once per new array reference. `setPrevCandidates` makes it converge on the retried render, so there is no re-render loop. Each setter runs only when its value would change. All hooks stay unconditional and in the same order. The `[query]` effect that fires after a render-phase `setQuery('')` sets `selectedIndex` to 0, which is already its value, so there is no second layout report. In `run-foreground.ts` the only arrival is the one `app.rerender`, and arrows and Tab are guarded with `!candidates` during loading, so there is no stale selection or toggle when the list arrives.
- **Queue, normal path.** There is one waiting slot, so the queue cannot grow. A waiting height equal to the running height is dropped. Late `exit`/`error` events are ignored, both through the per-action `settled` flag and through the `action !== current` check. The `'error'` listener uses `on`, which closes the old unhandled-`'error'` crash. Both the child and the timer are unref'd. There are no promises in this path, so there can be no unhandled rejections.

The defects are in the failure paths of the queue: timeout and non-zero exit. In those paths, the guarantee "the last height applied is the last requested" (zellij-pane-resize.ts:158-161) no longer holds. There is also a test-harness gap: the mocked-hooks suite never replays render-phase updates.

### Warnings

#### WR-06: The timeout path starts the next resize without waiting for the killed action to exit, which can bring back the G-09-7 ordering race

**File:** `src/client/zellij-pane-resize.ts:141-148`
**Issue:** On timeout, the code calls `action.child?.kill()` (a SIGTERM) and then calls `settle()` right away. `settleResize` then spawns the waiting height. Two problems follow:

- The killed `zellij` client may still be alive, because SIGTERM is asynchronous and can be handled or delayed. During that time two actions run at once, which breaks the "at most one runs at a time" invariant (line 39).
- A slow `zellij action` most likely stalls *after* it has sent its request to the server, while it waits for the reply. Killing the client does not cancel a request the server already has.

Either way, the server can apply the old height after the new one. That is the completion-order reversal G-09-7 was about (lines 158-160). The test at `tests/zellij-pane-resize.test.ts:180-197` checks only that the next spawn happens. It does not model a killed action that still lands later.
**Fix:** Settle only when the killed child exits, with a hard deadline. Then always re-send the newest height once, so the last action to land is the newest:
```ts
const timer = setTimeout(() => {
  const child = action.child;
  if (child === undefined || child.exitCode !== null || child.signalCode !== null) {
    settle();
    return;
  }
  child.kill();                           // the existing once('exit', settle) settles on death
  setTimeout(() => { child.kill('SIGKILL'); settle(); }, 500).unref();
  // After a timeout we cannot know whether the height landed: re-assert it.
  if (waiting === undefined) waiting = { height: request.height, paneId: request.paneId };
  spawnedHeight = undefined;              // so settleResize does not dedupe the re-assert
}, RESIZE_SETTLE_TIMEOUT_MS);
```
Add a test where the killed action's fake child applies its height *after* the next action exits. Assert that `applied.at(-1)` is the newest height.

#### WR-07: A failed, killed or non-zero-exit action still counts as the applied height, so the pane can stay at a stale size and later requests for the right height are deduped

**File:** `src/client/zellij-pane-resize.ts:103, 130, 133, 178, 181-183`
**Issue:**

- `spawnedHeight` is set before the spawn (line 103) and is never rolled back.
- `exit` settles whatever the exit code is (line 130), and `error` and the timeout settle the same way.
- Line 178 throws away a waiting request whose height equals the in-flight height. Lines 181-183 skip any later request for that height.

So when the action for height H fails, for example a non-zero exit because the server is busy, or a kill on timeout, the pane stays at its old height. Every later `syncZellijFloatingPaneHeight` call that resolves to H is then a no-op. A concrete sequence: H=24 is running, a stale 9 arrives, then 24 arrives again. Line 178 drops the waiting entry because it matches the in-flight 24. If that in-flight 24 action then exits non-zero or is killed, nothing re-sends 24, and the modal stays at the size it had before. That is the empty-modal symptom.

The old code also set the dedupe key before spawning. The new timeout-kill path and the drop-equal-waiting rule add new ways to reach this state.
**Fix:** Dedupe against the last height *known* to be applied, not the last one spawned:
```ts
let appliedHeight: number | undefined;   // updated only on exit code 0
child.once('exit', (code) => {
  if (code === 0 && action === current) appliedHeight = request.height;
  settle();
});
// error / timeout / non-zero: leave appliedHeight as is, and if nothing newer is waiting,
// keep the failed request as `waiting` for at most one retry.
```
In `syncZellijFloatingPaneHeight`, compare with `spawnedHeight` only to decide whether a request needs to wait behind the running action. Compare with `appliedHeight` to decide whether to skip it. Add tests for a non-zero exit followed by the same height, and for a timeout followed by the same height.

#### WR-08: The mocked-hooks suite never replays render-phase updates, so the zero-match test now checks a state production cannot reach

**File:** `tests/candidate-select.test.tsx:55-78, 239-259`; `src/ui/CandidateSelect.tsx:118-130`
**Issue:** Since 09-06, the arrival reset runs during render. With `initialQuery: 'zzz'`, the first mocked render calls `setQuery('')`, and the mock stores `''` in `stateValues[1]`. However, the mock does not re-run the component the way React does. The `useInput` closure that the test captures still holds `query = 'zzz'`. Enter therefore hits the zero-match guard, and the test passes.

In production, React discards that render and re-renders with `query = ''` before committing. The real-hooks test `(a)` in `tests/candidate-select-layout.test.tsx` shows this. So Enter would accept `git status`, which is the opposite of what the test is named for. The test now passes only because of how the harness works, and any future mocked test that renders once with a non-matching `initialQuery` gets the same stale closure. The harness gap also means the render-phase reset cannot be observed in this file at all (see IN-06).
**Fix:** Either:

- set up the zero-match state the way production reaches it: render with `initialQuery: 'git'`, type `z` through `capturedInputHandler`, set `stateCallCount = 0`, re-render, then press Enter; or
- make the mocked `useState` harness act like React: record whether any setter ran during the call, and re-invoke the component (resetting `stateCallCount`) until no render-phase setter fires, with a cap of 25 like React's.

Then add an assertion that a non-matching `initialQuery` is cleared on arrival.

### Info

#### IN-06: No test covers the arrival reset of `selectedIndex` and Tab toggles (D-09), although the 09-06 SUMMARY D3 claims it

**File:** `src/ui/CandidateSelect.tsx:120-125`; `tests/candidate-select.test.tsx`; `tests/candidate-select-layout.test.tsx`
**Issue:** SUMMARY D3 says "arrival still resets selection and clears Tab toggles (D-09 kept)" and cites the mocked suite. However, every mocked test reuses one `candidates` reference, so the reset branch never runs after a selection or toggle. A grep for arrival/reset tests finds only a comment. The real-hooks harness checks only the query branch, in tests (a) to (d). With today's single arrival these setters never fire, because arrows and Tab are no-ops while loading, so the impact is low. A future retry or refresh path that pushes a second array would not be covered.
**Fix:** In the real-hooks harness, render list A, press down and Tab through stdin (`stdin.push('\x1b[B')` and `'\t'`), rerender with list B, and assert that the first row is active and shown in its plain form.

#### IN-07: The queue tests skip the synchronous spawn-throw branch and the timer `unref`

**File:** `src/client/zellij-pane-resize.ts:136-139, 149-150, 190-198`; `tests/zellij-pane-resize.test.ts:169-215`
**Issue:**

- **Spawn-throw branch.** The `catch` branch (spawn throws synchronously, e.g. `EACCES` or bad args) is never run.
- **Timer `unref`.** "unrefs every spawned child" checks `child.unref` but not `timer.unref()`. That call is what stops a pending 2 s timer from delaying client exit, and fake timers make it a silent no-op.
- **Reset leaves listeners attached.** `resetZellijPaneHeightCache` leaves an in-flight child's listeners attached. This is harmless thanks to the `action !== current` guard, but the function is exported from a production module.

**Fix:**

- Add a test where `spawnMock` throws once. Assert that no exception escapes and that the next request spawns.
- Spy on `setTimeout`'s return value, or use `vi.spyOn(globalThis, 'setTimeout')` with real timers, to assert that `unref` is called.

#### IN-08: The real-hooks layout tests rely on a 200 ms real-time sleep to catch late reports

**File:** `tests/candidate-select-layout.test.tsx:84-85, 158`
**Issue:** `SETTLE_MS = 200` is a wall-clock wait. The negative asserts depend on it: `not.toContain(noMatch)`, `reports` all equal to `full`, and exactly one spawn in (c). Under parallel load, a late report or a second spawn after 200 ms would be missed, so these tests can pass vacuously instead of catching a regression. The wait also adds about 800 ms to the suite.
**Fix:** Wait for a deterministic condition. After `waitUntilRenderFlush`, drain the macrotask queue a few times (`await new Promise(setImmediate)` x3, since the fake child exits on `setImmediate`). Assert that the resize queue is idle, for example through a test-only `isZellijResizeIdle()` export. Then run the asserts.

#### IN-09: An effect-count assertion stands in for the behaviour the test names

**File:** `tests/candidate-select.test.tsx:214-231`
**Issue:** The test "registers a useEffect hook for query dependency" only checks `useEffect` was called 3 times. It breaks on any unrelated effect added or removed (it was edited in this plan for exactly that reason), and it never checks that any effect depends on `query`.
**Fix:** Find the call whose deps array contains the query value, e.g. `vi.mocked(useEffect).mock.calls.some(([, deps]) => deps?.length === 1 && deps[0] === '')`. Drop the exact count.

---

_Gap-closure review: 2026-10-11T10:42:33Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
