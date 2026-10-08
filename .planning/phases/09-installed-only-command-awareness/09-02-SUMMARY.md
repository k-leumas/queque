---
phase: 09-installed-only-command-awareness
plan: 02
subsystem: shared lexer, tests
tags: [lexer, fuzz, command-words, regression, child-process, vitest]
status: complete

requires:
  - phase: 09-01
    provides: "src/shared/command-words.ts (lexHand, commandWords, extractCommandWords, MAX_COMMAND_LENGTH, MAX_RECURSION_DEPTH, comment tokens)"
provides:
  - "tests/fixtures/command-words-cases.ts: COMMAND_WORD_CASES (40 spike 002 cases), CommandWordCase"
  - "tests/command-words.test.ts: 40-case table with zsh-sourced builtins, kind classification, D-06, robustness, frozen lexHand token contract"
  - "tests/fixtures/command-words-fuzz-child.mjs: child harness, modes fuzz <count> [seed] / one <input> / deep <n>; exit 0 ok, 2 slow, 3 undefined leak"
  - "tests/command-words-fuzz.test.ts: spawnSync fuzz with hard kills and a 16 MiB maxBuffer"
affects: [09-04 Tab install form (token contract now locked), 09-05 wave-merge gate and OpenWolf entries]

actuals:
  tokens: 4378
  tasks: 2
  commits: 2
plan_head_before: b6b82d451959a7a3a9ec0c58e60d43b05af2c6db
plan_head_after: 6e6d58cb6622bac0b48eaecc30fdc0b0bc805267

tech-stack:
  added: []
  patterns:
    - "A .mjs test child imports the shipped .ts source directly through Node 24 type stripping, so the fuzzed code is the shipped code"
    - "Child processes write stdout with writeSync(1) before process.exit, so the last line is not lost on a pipe"
    - "Fuzz inputs are written to stderr before each call, so after a hard kill the last stderr line is the culprit (shown in the failure message)"

key-files:
  created:
    - tests/fixtures/command-words-cases.ts
    - tests/command-words.test.ts
    - tests/fixtures/command-words-fuzz-child.mjs
    - tests/command-words-fuzz.test.ts
  modified: []

key-decisions:
  - "No lexer fix was needed: the 09-01 port passed all 40 cases, every robustness input, 25k seeded fuzz inputs, every crafted input and the deep-nesting run on the first try, so src/shared/command-words.ts (API, token values, zero imports) is unchanged"
  - "The hard 1 s per-input kill stays as specified: a crafted run normally takes about 175-185 ms (Node start plus type stripping); one transient 955 ms run was seen while the machine load average was about 8.8, recorded below as a flake risk rather than raised now"
  - "runChild takes { timeout } as an options object so each call site reads `timeout: 15_000` and so on"

patterns-established:
  - "Fuzz child exit-code contract: 0 ok, 2 slow (soft budget), 3 undefined leak, 64 unknown mode"

requirements-completed: [SC-4, SC-5]

coverage:
  - id: D1
    description: "All 40 spike 002 cases (37 core, 3 stretch, none optional) match the external words in order, with builtins from zsh -f ${(k)builtins}"
    requirement: SC-4
    verification:
      - kind: unit
        ref: "tests/command-words.test.ts#spike 002 accuracy table (SC-4)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Placeholder, dynamic, path, builtin and reserved-word kinds are never external; command -v is a lookup only; brew install fd && fd -e ts gives brew, fd (D-06)"
    requirement: SC-4
    verification:
      - kind: unit
        ref: "tests/command-words.test.ts#kind classification"
        status: pass
      - kind: unit
        ref: "tests/command-words.test.ts#D-06: install commands are ordinary commands"
        status: pass
    human_judgment: false
  - id: D3
    description: "Robustness: oversized input returns [], prototype-key words classify as external, trailing-backslash inputs yield rg / a, no word contains undefined"
    requirement: SC-5
    verification:
      - kind: unit
        ref: "tests/command-words.test.ts#robustness (D-03)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Token contract for 09-04: one op & in nohup fd x 2>&1 &, redir << in a heredoc, one comment token in cd src; fd x # note, # c is a single comment token"
    requirement: SC-4
    verification:
      - kind: unit
        ref: "tests/command-words.test.ts#lexHand token contract (frozen for 09-04)"
        status: pass
    human_judgment: false
  - id: D5
    description: "25k seeded random inputs (seed 1 x 20k under a 15 s kill, seed 7 x 5k under a 10 s kill), 33 crafted malformed inputs at a 1 s kill each, 2,000 nested $( under 100 ms, all in child processes"
    requirement: SC-5
    verification:
      - kind: integration
        ref: "tests/command-words-fuzz.test.ts"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-08
---

# Phase 9 Plan 02: Lexer Proof Summary

**The 09-01 hand lexer now has regression tests: all 40 spike 002 cases checked against zsh-sourced builtins, a frozen op/redir/comment token contract for 09-04, and child-process fuzzing (25k seeded random inputs, 33 crafted malformed inputs at a hard 1 s kill each, 2,000-deep nesting under 100 ms). No lexer change was needed.**

## Performance

- **Duration:** about 6 min
- **Started:** 2026-10-08T08:19:04Z
- **Completed:** 2026-10-08T08:24:57Z
- **Tasks:** 2
- **Files modified:** 4 (all new test files)

## Accomplishments

- `COMMAND_WORD_CASES` is a typed, verbatim copy of spike 002 `cases.mjs`. The header comment says `stretch` is a label, not an opt-out, and a test asserts 40 rows with 3 stretch rows. All 40 pass.
- Builtins come from `spawnSync('zsh', ['-f', '-c', 'zmodload zsh/parameter; print -rl -- ${(k)builtins}'])`. The `beforeAll` asserts that `cd` and `kill` are in the list (D-02).
- The kind checks cover placeholder, dynamic, path, builtin vs external (`kill` / `lsof`), reserved words and `command -v`. D-06 gets exact output `[brew external, fd external]`.
- Robustness checks: an 8193-character input returns `[]`. `constructor`, `toString`, `__proto__` and `hasOwnProperty` each classify as `external` and do not throw. `"rg\` gives `['rg']` and `a "b\` gives `['a']`. No word or token value for any robustness input contains `undefined`.
- The token contract 09-04 builds on is now under test: `nohup fd x 2>&1 &` has exactly one op (`&`), a heredoc has redir `<<`, `cd src; fd x # note` has one comment token and the external `fd`, and `# c` lexes to a single comment token.
- The fuzz child imports `../../src/shared/command-words.ts` directly. It calls the raw `commandWords(lexHand(s))` first, so a throw surfaces, then calls the wrapper. It exits 3 on any word containing `undefined` and exits 2 on any input over 250 ms.
- The fuzz test passes `maxBuffer: 16 * 1024 * 1024` and its own hard `timeout` to every spawn, and gives every spawning `it` an explicit vitest timeout (20 s, 15 s, 5 s, 10 s). On failure it reports the error code, exit status, stdout and the last stderr input.

## Measured numbers

- Standalone child runs: `fuzz 20000 1` passes in about 1.0 s wall time, `fuzz 5000 7` in about 0.6 s, and `deep 2000` reports **7.0 ms** (budget 100 ms).
- A crafted per-input child normally takes about 175-185 ms. One run reached 834-955 ms while the machine load average was about 8.8. The full `pnpm test:run` passed twice (28 files, 389 tests).

## Task Commits

1. **Task 1: Port the 40 accuracy cases, kind classification, robustness cases and the token contract into vitest** - `6ff2680` (test)
2. **Task 2: Child-process fuzz with hard timeouts (random, crafted malformed, deep nesting)** - `6e6d58c` (test)

## Files Created/Modified

- `tests/fixtures/command-words-cases.ts` - the 40 spike 002 cases as `COMMAND_WORD_CASES` / `CommandWordCase`
- `tests/command-words.test.ts` - table, kinds, D-06, robustness and token-contract tests (60 tests)
- `tests/fixtures/command-words-fuzz-child.mjs` - fuzz/one/deep child harness that imports the shipped `.ts`
- `tests/command-words-fuzz.test.ts` - spawnSync fuzz with hard kills (35 tests: 2 random, 32 crafted, 1 deep)

## Decisions Made

- Did not change `src/shared/command-words.ts`. No case or fuzz input exposed a defect, so the exported API, token values, zero-import rule and erasable-only syntax are all unchanged (`grep -cE "^import |require\(" src/shared/command-words.ts` == 0).
- Kept the 1 s hard kill per crafted input as the plan specifies. See the flake risk under Issues Encountered.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Child stdout written with writeSync(1) instead of console.log**
- **Found during:** Task 2
- **Issue:** On a POSIX pipe, `console.log` followed right away by `process.exit(2|3)` can lose the `slow …` / `undefined-leak …` line, which is the diagnostic the test reports.
- **Fix:** An `out()` helper writes stdout lines synchronously with `writeSync(1, …)`, and the unknown-mode message goes through `writeSync(2, …)`.
- **Files modified:** tests/fixtures/command-words-fuzz-child.mjs
- **Commit:** 6e6d58c

**2. [Rule 3 - Blocking] biome `noTemplateCurlyInString` warnings on zsh `${…}` text**
- **Found during:** Task 1
- **Issue:** The zsh builtins listing command and the verbatim `"${f%.png}.jpg"` case look like JS template placeholders to biome.
- **Fix:** Added `biome-ignore` comments with a reason. Both strings stay verbatim.
- **Files modified:** tests/command-words.test.ts, tests/fixtures/command-words-cases.ts
- **Commit:** 6ff2680

Otherwise the plan ran as written.

## Issues Encountered

- **Flake risk (not a defect):** the crafted runs share a 1 s hard kill with Node startup plus type stripping (about 230 ms cold from a shell, about 180 ms under vitest). One 955 ms run was seen on a heavily loaded machine. If CI ever flakes here, the plan allows raising the budget slightly while keeping the hard kill and child isolation, for example to 2 s. Do not move the fuzz in-process.
- `pnpm lint` reports 2 warnings that predate this plan and are out of scope: an unused import in `tests/modal-layout.test.ts` and a `biome-ignore` that biome considers unused. Neither is in this plan's files, and lint exits 0.
- Per the wave-2 rule, both task commits ran `git restore --staged --worktree -- .wolf` first. The OpenWolf hook edits (`anatomy.md`, `memory.md`, `hooks/_session.json`) were dropped and not committed.

## Deferred OpenWolf updates

For 09-05 Task 1 to apply on the merged tree:

**anatomy.md** (under `tests/` and `tests/fixtures/`):
- `tests/command-words.test.ts` - Spike 002 40-case table (zsh -f `${(k)builtins}` builtins), kind classification, D-06 install words, robustness (8193 chars, prototype keys, `"rg\`), frozen lexHand op/redir/comment token contract for 09-04. (~1700 tok)
- `tests/command-words-fuzz.test.ts` - spawnSync fuzz of the shipped lexer in child processes: 20k seed 1 (15 s kill), 5k seed 7 (10 s kill), 33 crafted malformed inputs (1 s kill each), deep 2000 < 100 ms; 16 MiB maxBuffer; reports the last stderr input on failure. (~900 tok)
- `tests/fixtures/command-words-cases.ts` - `COMMAND_WORD_CASES` / `CommandWordCase`: the 40 spike 002 cases verbatim; `stretch` is a label, not an opt-out. (~900 tok)
- `tests/fixtures/command-words-fuzz-child.mjs` - Fuzz child that imports `src/shared/command-words.ts` via Node 24 type stripping; modes `fuzz <count> [seed]` (mulberry32), `one <input>`, `deep <n>`; exit 0 ok / 2 slow / 3 undefined leak / 64 unknown mode. (~800 tok)

**buglog.json:** no lexer defect was found, so there is no lexer entry. Optional entry (tags: fuzz, child-process): "console.log then process.exit in a piped child can drop the last line; use writeSync(1) for diagnostics the parent must read" (tests/fixtures/command-words-fuzz-child.mjs, fixed before commit).

**cerebrum.md - Key Learnings:**
- A `.mjs` test fixture can `import '../../src/…/x.ts'` directly on Node 24 (type stripping, no loader) when the `.ts` file has zero imports and erasable-only syntax. tsconfig `include` never sees the `.mjs`, so only that child may use a `.ts` specifier.
- The per-process child cost on this machine is about 120 ms for bare Node plus about 110 ms for type-stripping the lexer. Per-input 1 s hard kills have roughly 4x headroom, less under heavy load.
- In biome, zsh `${…}` text inside single-quoted JS strings triggers `noTemplateCurlyInString`. Suppress it with a `biome-ignore` that gives the reason, and do not rewrite the shell text.

## Next Phase Readiness

- 09-04 can rely on the token contract: any change to lexHand's op, redir or comment output now fails `tests/command-words.test.ts`.
- Wave-merge gate for 09-05: run `pnpm test:run` after 09-03 and 09-04 land. It passed on this tree (28 files, 389 tests).

## Self-Check: PASSED
