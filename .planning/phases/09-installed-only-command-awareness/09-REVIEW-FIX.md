---
phase: 09-installed-only-command-awareness
fixed_at: 2026-10-10T20:09:49Z
review_path: .planning/phases/09-installed-only-command-awareness/09-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 9: Code Review Fix Report

**Fixed at:** 2026-10-10T20:09:49Z
**Source review:** .planning/phases/09-installed-only-command-awareness/09-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (2 critical, 5 warning; the info findings were out of scope)
- Fixed: 7
- Skipped: 0

**Where the work and verification ran:** in the main checkout (`/Users/samuel/dev/tui-llm`, branch `main`). No worktree was used. The OpenWolf post-write hooks write to the main checkout's `.wolf/` for every edit. A worktree would have put worktree paths into `anatomy.md`, and its fast-forward would have collided with the uncommitted `.wolf/` files in the main checkout. The lefthook gates (typecheck, biome, commitlint) also need the main checkout's `node_modules`. Every commit passed those hooks without `--no-verify`. All test numbers below come from this checkout.

**Commit subjects:** each subject ends with its finding ID, for example `fix(09): … (CR-01)`. commitlint's subject-case rule rejects subjects that start with an upper-case ID such as `CR-01`.

## Fixed Issues

### CR-01: Heredoc bodies and `\`-newline continuations are classified as commands

**Files modified:** `src/shared/command-words.ts`, `tests/fixtures/command-words-cases.ts`, `tests/command-words.test.ts`
**Commit:** b8ea9d7
**Applied fix:**
- **Heredocs.** `lexHand` records the delimiter after `<<` / `<<-` (quotes already stripped). At the next newline it skips each pending body up to and including the delimiter line, stripping leading tabs for `<<-`. An unterminated body runs to the end of the input. The `<<` redir token and the newline `;` op are still emitted, so `buildInstallForm`'s heredoc blocking is unchanged.
- **Line continuations.** A backslash followed by a newline is dropped in three places: at token start, inside a word, and inside double quotes.
- **Tests.** The regression commands are in a new `REVIEW_CASES` table, kept separate because the spike table is locked at 40 cases. Two token-contract tests were added: the heredoc body produces no tokens, and a continuation produces no token. The 10 new cases fail on the pre-fix lexer.

### CR-02: Wrapper operands are misread

**Files modified:** `src/shared/command-words.ts`, `tests/fixtures/command-words-cases.ts`, `tests/tool-awareness.test.ts`
**Commit:** b235597
**Applied fix:**
- **Long options.** The wrapper option tables now list the long options that take a separate value:
  - `sudo --user/--group/--host/--prompt/--chdir/--role/--type/--close-from/--other-user/--command-timeout`
  - `env --unset/--chdir/--split-string`
  - `nice --adjustment`
  - `timeout --signal/--kill-after`
  - `xargs --max-args/--max-procs/--max-chars/--delimiter/--arg-file/--process-slot-var`
  - `watch --interval`
  - `stdbuf -i/-o/-e` (and long forms)
  - `ionice --class/--classdata/--pid`
- **Optional-argument options.** `xargs --max-lines/--replace/--eof` and `watch -d/--differences` never take the next word, so they are deliberately left out. This differs from the review's list. I also removed `watch -d`, which wrongly consumed the program (`watch -d kubectl get pods` had flagged `get`).
- **Unlisted options.** `--opt=value` and any option not in the table are treated as flags.
- **Quoted operands.** A quoted wrapper operand that contains whitespace is recursed into as a command string (`watch -n 2 'kubectl get pods'`).
- **`exec` and `command`.** A new `PRECOMMAND_OPTIONS` table skips their options (`-a NAME`, `-p`, `-cl`).
- **Tests.**
  - 15 fixture cases, 12 of which fail on the pre-fix code.
  - An `annotateCandidates` test: `sudo --user root fd x` flags only `fd`, and its form is `brew install fd && sudo --user root fd x`.

### WR-01: Package alias map uses Homebrew names but is applied to apt/dnf/pacman

**Files modified:** `src/shared/tool-awareness.ts`, `tests/tool-awareness.test.ts`, `tests/candidate-select.test.tsx`
**Commit:** 75f72bd
**Status:** fixed: requires human verification (please check the Linux package names)
**Applied fix:**
- **Per-installer maps.** `PACKAGE_ALIASES` is now `Record<InstallerId, ReadonlyMap<string, string | null>>` and `packageFor(tool, installer)` returns `string | null`.
- **Blocked names.** It returns `null` in three cases:
  - A tool has a Homebrew alias but no verified entry for that Linux manager. Examples: `gsed`, `gtimeout`, `gdate`, `gtime`; `magick` on apt; `vd` on pacman.
  - apt `fd` / `bat`. Debian installs these binaries as `fdfind` / `batcat`, so `&& fd` would still fail after the install.
  - `fdfind` / `batcat` on brew.
- **New block reason.** `planInstall` blocks with a new `InstallBlockReason`, `'unknown-package'`. The UI shows it like the other blocked reasons (ⓘ and the legend, no Tab text).
- **Linux names I entered.** These come from my own knowledge and were not checked against the repositories. Each is either an exact package or blocked; none is a guess:
  - **apt:** `kubectl` → kubectl, `dig` → bind9-dnsutils, `ag` → silversearcher-ag, `tldr` → tldr
  - **dnf:** `kubectl` → kubernetes-client, `dig` → bind-utils, `magick`/`convert` → ImageMagick, `fd` → fd-find, `tldr` → tealdeer
  - **pacman:** `dig` → bind, `aws` → aws-cli, `btm` → bottom, `difft` → difftastic, `rga` → ripgrep-all
- **Tests.** Every new `packageFor` test fails on the pre-fix code (5 tests).

### WR-02: Viewport-reserve comment describes a shared footer margin the code doesn't have

**Files modified:** `src/ui/modal-layout.ts`, `src/client/run-foreground.ts`, `tests/modal-layout.test.ts`
**Commit:** eb6fad1
**Applied fix:**
- The reserve is now `MODAL_VIEWPORT_LINES = 18`, exported from `modal-layout.ts` next to the estimator. Its comment gives the real row count: 1+1+1+9 rows, plus 2 for the ⚠ footer, 2 for the ⓘ legend and 2 for the controls. Each footer has its own margin.
- `run-foreground.ts` imports the constant, and its stale shared-margin comment is gone.
- The footers are still separate boxes. Merging them would have changed the layout you locked earlier in this session.
- **Test.** The estimate for 3 two-line candidates with a query header, the ⚠ footer and the legend is 18, which fits the reserve.

### WR-03: Wall-clock asserts make the tests flaky under parallel load

**Files modified:** `tests/zsh-widget.test.ts`, `tests/command-words-fuzz.test.ts`
**Commit:** ebafa0d
**Applied fix:**
- Neither assertion was removed and the bounds are unchanged: the handoff median must stay under 25 ms and the deep-nesting run under 100 ms.
- Each assertion now measures up to 3 batches (or runs) and requires the best one to meet the bound. It stops as soon as one passes and logs every value. A real regression fails all 3.
- No separate regression test: the fix is to the tests themselves. Both pass (handoff median 18.27 ms; deep nesting 10.2 ms).

### WR-04: Install-form toggle and the search filter disagree on what a row "is"

**Files modified:** `src/ui/modal-layout.ts`, `src/ui/CandidateSelect.tsx`, `tests/modal-layout.test.ts`, `tests/candidate-select.test.tsx`
**Commit:** 6069f44
**Status:** fixed: requires human verification (please confirm the filter behaves as you want)
**Applied fix:**
- **Filtering.** `filterCandidates(list, query, installToggled?)` now matches `displayedCommand()`, so a toggled row matches on its install form. All handlers, the render and the layout estimate pass the toggle set.
- **Arrival effect.** The effect that runs when candidates arrive still filters on the plain commands. It clears the toggles in the same step, so there is nothing to match.
- **Hidden rows.** A row hidden by the query keeps its toggle and comes back toggled. The `filterCandidates` doc comment says so, and a test locks it in.
- **Tests.** Two new tests fail on the pre-fix code:
  - Typing `brew` after Tab keeps the row visible, and Enter inserts the install form.
  - A filter-only test.
- **Known side effect.** If the query matches only the install form (e.g. `brew`), pressing Tab to undo the toggle hides that row, because the filter matches what is shown. This is consistent, but please confirm it.

### WR-05: `lookupOnly` handling is dead

**Files modified:** `src/shared/command-words.ts`, `tests/fixtures/command-words-cases.ts`
**Commit:** d0cf4e8
**Applied fix:**
- I made the intent explicit instead of deleting the flag. `lookupOnly` is now checked right after a word's substitutions are recursed into. It skips every operand up to the next operator.
- It is set by `command -v|-V` and by the new `LOOKUP_BUILTINS` set (`type`, `which`, `whence`, `where`), but only when the handoff lists them as builtins.
- The dead check that came after the builtin branch is removed.
- **Tests.** 7 fixture cases, for example `command -v fd && fd x` → `['fd']`, `type fd` → `[]` and `command -v "$(fd x)"` → `['fd']`. They lock in the behaviour. They also passed before the fix, because the bug was latent: nothing reopened command position yet.

## Verification

- **Where:** main checkout, `/Users/samuel/dev/tui-llm` (no worktree).
- **Per fix:**
  - The affected vitest files pass.
  - `pnpm exec tsc --noEmit` is clean.
  - Biome on the changed files reports no new diagnostics. Its only output is the 2 known warnings, one of them the unused-imports warning in `tests/modal-layout.test.ts`.
  - The lefthook pre-commit (typecheck, lint) and commitlint passed on every commit.
  - For each fix I stashed only the source change and re-ran its tests to confirm they fail. That covered CR-01 (10 tests), CR-02 (12), WR-01 (5) and WR-04 (2).
- **Full suite (`pnpm test:run`):** 522 passed, 6 failed, all of them in `tests/command-words-fuzz.test.ts`.
  - Every failure was a "crafted malformed input finishes within 1 s" case: the spawn-timeout flake already logged as bug-206.
  - Each failing input finishes alone in about 0.25–0.5 s (`one ok`).
  - During the run the machine's load average was 30–70 (Docker hyperkit and other processes).
  - Under the same load, the pre-fix lexer fails the same kind of case (11 of 36), so this is not a regression from these fixes.
- **Fuzz child at HEAD:** `fuzz 20000 1` gives `fuzz ok`; `deep 2000` takes 5–6 ms when the machine is idle.

## .wolf bookkeeping

- Every commit also stages `.wolf/anatomy.md`, `memory.md`, `buglog.json` and `hooks/_session.json`.
- Buglog entries: bug-209 (CR-01), bug-211 (CR-02), bug-212 (WR-01), bug-213 (WR-02), bug-214 (WR-03), bug-215 (WR-04), bug-216 (WR-05). The OpenWolf hook added auto-detected entries in between (bug-207, bug-208, bug-210).
- `.wolf/cerebrum.md` has 3 new Key Learnings and 1 new Do-Not-Repeat entry (review IDs at the end of commit subjects). These are not committed yet.

---

_Fixed: 2026-10-10T20:09:49Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
