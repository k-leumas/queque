---
phase: 08-zero-config-install-and-provider-detection
plan: 05
subsystem: cli
tags: [provider-pin, picker, dev-tty, readline, ollama, daemon, zod, atomic-write]

requires:
  - phase: 08-zero-config-install-and-provider-detection
    provides: "08-03 providerPinSchema (versioned strict union, no secrets), loadProviderPin, resolveProviderAdapter, OLLAMA_DEFAULT_BASE_URL, ollama backend"
provides:
  - "`qq init provider`: ask-once picker on /dev/tty (Claude, OpenAI, Ollama in D-04 order) that writes ~/.config/qq/provider.json"
  - "writeProviderPin(pin): schema-validated atomic write (wx temp + rename), 0600 file, new dir 0700"
  - "listOllamaModels(baseUrl?, timeoutMs?): one GET /api/tags, 2s budget, server order, never throws"
  - "restartDaemon(socketPath): replaces even a current daemon so it inherits the caller's environment"
  - "dispatchInit(shell): only the literal `provider` reaches the picker; `qq init zsh` still runs initCommand"
affects: [08-06 failure hint + docs (points the first failed ?? at `qq init provider`), 08-04 openai adapter (an openai pin the picker writes resolves once `openai` is registered)]

actuals:
  tokens: 10473
  tasks: 2
  commits: 4
plan_head_before: 99433e35b2b1e7985647ccfe5d07bfbb63e7c3f5
plan_head_after: 72152225563ffc657593114b951a2c943c4e8ad2

tech-stack:
  added: []
  patterns:
    - "Interactive CLI prompts read lines through the readline async iterator (buffers lines), not readline/promises question() (drops lines typed before the prompt)"
    - "Picker IO is injected ({input, output}) so tests drive it with a PassThrough plus a synchronous Writable; side effects (restartDaemon, openUrl, listOllamaModels) are injectable deps"
    - "/dev/tty opened as two descriptors (r and w), one per tty stream, so each stream owns and closes its own fd"
    - "Modules imported by main.ts bind cross-module defaults lazily (`(x) => fn(x)`) so loading main.ts touches nothing"

key-files:
  created:
    - src/cli/commands/init-provider.ts
    - tests/init-provider.test.ts
  modified:
    - src/cli/main.ts
    - src/providers/provider-pin.ts
    - src/providers/ollama.ts
    - src/daemon/bootstrap.ts
    - tests/daemon-bootstrap.test.ts

key-decisions:
  - "Picker reads answers via the readline async iterator instead of readline/promises question(): question() drops a line that arrives before the prompt is printed (pasted or piped answers)"
  - "/dev/tty is opened twice (r for tty.ReadStream, w for tty.WriteStream) instead of one r+ fd shared by both streams, so destroying one stream cannot close the other's descriptor"
  - "`qq init` help text keeps the accurate `qq init zsh && source ~/.zshrc`: initCommand appends to ~/.zshrc itself, so the plan's `qq init zsh >> ~/.zshrc` wording would write its status line into the rc file"
  - "A pin write failure (for example provider.json is a directory) prints `Could not save <path> (<code>). No changes made.`, exits 1 and skips the daemon restart"
  - "listOllamaModels drops names with terminal control bytes or names the pin schema would reject, so a listed model can always be pinned and printed safely"

patterns-established:
  - "Provider setup is opt-in and lives only in `qq init provider`; no ?? path, daemon or `qq init zsh` code references init-provider (source-guard tests)"

requirements-completed: [RUN-01, EXT-01]

coverage:
  - id: D1
    description: "Menu lists Claude, OpenAI, Ollama in that order; Enter picks Claude and writes a 0600 pin in a 0700 dir"
    requirement: EXT-01
    verification:
      - kind: unit
        ref: "tests/init-provider.test.ts#menu lists Claude, OpenAI, Ollama in that order"
        status: pass
      - kind: unit
        ref: "tests/init-provider.test.ts#Enter selects Claude and writes a 0600 pin"
        status: pass
      - kind: manual_procedural
        ref: "script -q /dev/null node dist/cli/main.js init provider (Enter) with QQ_PROVIDER_FILE in scratch: -rw------- file in drwx------ dir, exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "OpenAI is pinned only when OPENAI_API_KEY is usable (env or .env.local); otherwise export guidance, nothing written, exit 1; the key never reaches output or the file"
    requirement: EXT-01
    verification:
      - kind: unit
        ref: "tests/init-provider.test.ts#OpenAI with a usable key writes an openai pin and never prints the key"
        status: pass
      - kind: unit
        ref: "tests/init-provider.test.ts#OpenAI accepts a key from .env.local without printing it"
        status: pass
      - kind: unit
        ref: "tests/init-provider.test.ts#OpenAI without a usable key exits 1 with export guidance"
        status: pass
    human_judgment: false
  - id: D3
    description: "Ollama models are listed in /api/tags order with Enter picking the first; unreachable prints the download URL + `ollama serve` and opens the URL only after y; zero models prints `ollama pull`; nothing written on any dead end"
    requirement: RUN-01
    verification:
      - kind: unit
        ref: "tests/init-provider.test.ts#Ollama lists models in /api/tags order and Enter picks the first"
        status: pass
      - kind: unit
        ref: "tests/init-provider.test.ts#Ollama unreachable prints the download URL and ollama serve; Enter does not open it"
        status: pass
      - kind: unit
        ref: "tests/init-provider.test.ts#Ollama unreachable with y opens only the download URL"
        status: pass
      - kind: unit
        ref: "tests/init-provider.test.ts#Ollama with zero models prints ollama pull guidance"
        status: pass
    human_judgment: false
  - id: D4
    description: "Invalid answers re-ask up to three times; EOF or an unwritable pin path prints the next step, writes nothing and exits 1"
    requirement: RUN-01
    verification:
      - kind: unit
        ref: "tests/init-provider.test.ts#three invalid menu answers exit 1 without writing"
        status: pass
      - kind: unit
        ref: "tests/init-provider.test.ts#input ending before an answer exits 1 without writing"
        status: pass
      - kind: unit
        ref: "tests/init-provider.test.ts#an unwritable pin path exits 1 with the reason and does not restart"
        status: pass
    human_judgment: false
  - id: D5
    description: "After a saved pin the daemon is restarted with socketPath(); a failed restart keeps the pin, warns and exits 0; restartDaemon replaces even a current daemon and rejects unsafe paths"
    requirement: RUN-01
    verification:
      - kind: unit
        ref: "tests/init-provider.test.ts#restartDaemon is called once with socketPath() after a successful write"
        status: pass
      - kind: unit
        ref: "tests/init-provider.test.ts#a failed restart keeps the pin, warns, and still exits 0"
        status: pass
      - kind: integration
        ref: "tests/daemon-bootstrap.test.ts#restartDaemon replaces a current daemon and spawns once"
        status: pass
      - kind: unit
        ref: "tests/daemon-bootstrap.test.ts#restartDaemon rejects an unsafe socket path"
        status: pass
    human_judgment: false
  - id: D6
    description: "D-03/D-05: only `qq init provider` reaches the picker; it writes nothing to stdout; no /dev/tty exits 1 with one stderr line; the ?? path, daemon and init.ts never reference init-provider"
    requirement: EXT-01
    verification:
      - kind: unit
        ref: "tests/init-provider.test.ts#dispatchInit sends provider to the picker and zsh to initCommand"
        status: pass
      - kind: unit
        ref: "tests/init-provider.test.ts#picker writes nothing to process.stdout"
        status: pass
      - kind: unit
        ref: "tests/init-provider.test.ts#without /dev/tty exits 1 with a one-line stderr error and writes nothing"
        status: pass
      - kind: unit
        ref: "tests/init-provider.test.ts#src/cli/commands/init.ts never references init-provider"
        status: pass
    human_judgment: false
  - id: D7
    description: "Re-running the picker shows the current pin (or that the file is invalid) and replaces it (D-15); written claude and ollama pins resolve the claude-cli and ollama backends"
    requirement: RUN-01
    verification:
      - kind: unit
        ref: "tests/init-provider.test.ts#shows the current ollama pin"
        status: pass
      - kind: unit
        ref: "tests/init-provider.test.ts#says an invalid file is invalid and replaces it"
        status: pass
      - kind: unit
        ref: "tests/init-provider.test.ts#written claude and ollama pins round-trip through resolveProviderAdapter"
        status: pass
    human_judgment: false
  - id: D8
    description: "Under 60s end to end on a real machine: failed ?? → `qq init provider` → pick → ?? shows candidates from the new backend through the restarted daemon"
    verification: []
    human_judgment: true
    rationale: "Needs an interactive zsh, a real daemon restart at /tmp/qq-$UID.sock (not exercised from the worktree, to avoid replacing the developer's running daemon with a worktree build), and 08-06's failure hint; plan marks it end-of-phase UAT"

duration: 51min
completed: 2026-10-17
status: complete
---

# Phase 8 Plan 05: `qq init provider` Picker Summary

**`qq init provider` asks once on /dev/tty (Claude, OpenAI, Ollama). It writes a schema-valid 0600 `provider.json` atomically (wx temp file, then rename) and restarts the daemon so a key exported a moment ago is visible on the next `??`. Every dead end prints the next step and writes nothing. `qq init zsh` and the `??` path never reach the picker.**

## Performance

- **Duration:** ~51 min
- **Started:** 2026-10-17T18:15:30Z
- **Completed:** 2026-10-17T19:06:48Z
- **Tasks:** 2 (Task 1 tracer, Task 2 TDD)
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- `runProviderPicker(io, deps)` prints the D-04 menu and saves a pin after at most two answers (provider, then Ollama model). Enter picks Claude, and Enter at the model prompt picks the first model from `/api/tags`. No backend is probed before the user answers (D-04).
- `writeProviderPin` runs `providerPinSchema.parse` first, so the writer cannot store anything the loader would reject (an `apiKey` key throws). It writes to `<target>.<pid>.<hex>.tmp` with `{mode: 0o600, flag: 'wx'}`, renames over the target, then runs `chmod 0600`, and unlinks the temp file on error. A new directory is created 0700.
- OpenAI is pinned only when `usableSecret(OPENAI_API_KEY)` (from the env or `.env.local`) is present. The key's value is never printed, prompted for, logged, or stored.
- Dead ends: Ollama down → the download URL, `ollama serve`, and a `[y/N]` prompt (the opener spawns without a shell, only for `https://ollama.com/download`, only after y/yes). Zero models → `ollama pull gemma4`. Three invalid answers or end of input → "No changes made.". Unwritable path → `Could not save <path> (<code>)`. All of these exit 1 without writing.
- `restartDaemon(socketPath)` checks `assertSafeSocketPath`, calls `replaceStaleListener` (which never signals the current pid), then `spawnDaemon`, and waits up to the existing 2s socket poll. If the restart fails, the picker keeps the pin, prints a warning, and exits 0.
- `providerInitCommand` writes nothing to stdout. Without /dev/tty it prints `qq init provider needs an interactive terminal (/dev/tty).` and exits 1.

## Task Commits

1. **Task 1: Tracer, `qq init provider` asks once and persists a working pin**: `369566e` (feat)
2. **Task 2: Picker failure paths, daemon restart, D-03/D-05 guards (TDD)**
   - RED: `6bcb1a3` (test)
   - GREEN: `bc64571` (feat)
   - Fix: `7215222` (fix, lazy `restartDaemon` binding found by the full-suite run)
   - REFACTOR: none needed

## Files Created/Modified

- `src/cli/commands/init-provider.ts` (new): `PROVIDER_MENU`, `OLLAMA_DOWNLOAD_URL`, `PickerIo`/`PickerDeps`, `runProviderPicker`, `providerInitCommand`, `dispatchInit`, plus the line `Prompter` (async iterator, three attempts)
- `src/providers/provider-pin.ts`: `writeProviderPin`
- `src/providers/ollama.ts`: `listOllamaModels`, `OllamaModelList`, `OLLAMA_LIST_TIMEOUT_MS`
- `src/daemon/bootstrap.ts`: `restartDaemon` (ensureDaemon unchanged)
- `src/cli/main.ts`: the `init <shell>` action is async and calls `dispatchInit(shell)`; the description mentions `qq init provider`
- `tests/init-provider.test.ts` (new, 38 tests): flows, ordering, file and dir mode, key hygiene, dead ends, restart, D-15 re-run, no-tty, source guards, `writeProviderPin`, `listOllamaModels`
- `tests/daemon-bootstrap.test.ts`: 4 `restartDaemon` tests (replaces a current daemon, starts when none is running, rejects when the new daemon never listens, rejects an unsafe path)

## Decisions Made

See `key-decisions` in the frontmatter. In short: the async-iterator line reader, two /dev/tty descriptors, accurate `qq init` help text, a pin write failure exits 1 without restarting the daemon, and Ollama model names are filtered so they are safe to print and to pin.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `qq init` help text: kept the accurate `&& source` form**
- **Found during:** Task 1
- **Issue:** The plan's description was "Print a source line … (`qq init zsh >> ~/.zshrc`)". `initCommand` (which D-05 keeps unchanged) appends to `~/.zshrc` itself and prints `queque: added shell integration…` on stdout. Following that help would append the status line to the rc file.
- **Fix:** The description is "Add shell integration to ~/.zshrc (`qq init zsh && source ~/.zshrc`), or run `qq init provider` to pick OpenAI or Ollama".
- **Files modified:** src/cli/main.ts
- **Committed in:** 369566e

**2. [Rule 1 - Bug] readline async iterator instead of `readline/promises` question()**
- **Found during:** Task 1
- **Issue:** `question()` only takes the next line after the prompt is printed. A line typed or pasted earlier (or written up front by a test) is emitted and dropped, which would hang the picker.
- **Fix:** `createInterface({terminal: false})` plus `rl[Symbol.asyncIterator]()`, which buffers lines. A rejected `next()` (input closed or aborted) is treated as end of input.
- **Files modified:** src/cli/commands/init-provider.ts
- **Committed in:** 369566e, bc64571

**3. [Rule 1 - Bug] /dev/tty opened as two descriptors instead of one shared `r+` fd**
- **Found during:** Task 1
- **Issue:** Wrapping one fd in both `tty.ReadStream` and `tty.WriteStream` means destroying one stream can close the descriptor the other still uses.
- **Fix:** `openSync('/dev/tty','r')` for input and `openSync('/dev/tty','w')` for output. Each stream is destroyed after `end()`. A partial open is closed before the no-terminal error.
- **Files modified:** src/cli/commands/init-provider.ts
- **Committed in:** 369566e, bc64571

**4. [Rule 2 - Correctness] Pin write failure handled; Ollama names filtered**
- **Found during:** Task 2
- **Issue:** The plan had no branch for a failed `writeProviderPin` (for example `provider.json` is a directory, EISDIR). The picker would have crashed with a stack trace. Model names from the local server were printed raw (terminal escape injection) and could fail the pin schema (over 200 chars or blank).
- **Fix:** `savePin` prints `Could not save <path> (<code>). No changes made.`, returns 1, and skips the restart. `listOllamaModels` keeps only names that pass the schema and contain no `\p{Cc}` control bytes.
- **Files modified:** src/cli/commands/init-provider.ts, src/providers/ollama.ts
- **Committed in:** 369566e, bc64571 (tests: "an unwritable pin path exits 1…", "drops names with terminal control bytes")

**5. [Rule 1 - Bug] Picker's default `restartDaemon` bound lazily**
- **Found during:** plan-level verification (full suite)
- **Issue:** main.ts now imports init-provider on every `qq` run. `defaultDeps` read the `restartDaemon` import when the module loaded, so `tests/client-result.test.ts` failed with `No "restartDaemon" export is defined on the "../src/daemon/bootstrap.js" mock`. That test mocks bootstrap.js without the new export and imports main.ts.
- **Fix:** `restartDaemon: (path) => restartDaemon(path)`, the same lazy form `listOllamaModels` already used. No test files outside this plan were changed.
- **Files modified:** src/cli/commands/init-provider.ts
- **Verification:** `tests/client-result.test.ts` 26/26 pass
- **Committed in:** 7215222

**Process notes:**
- Task 1 tests do not pass `restartDaemon`/`openUrl`, because those deps only exist from Task 2. From Task 2 on, the test helper always injects mocks for both, so no test can signal the developer's real daemon or open a browser.
- Task 2 followed RED → GREEN, as 08-03 did, rather than one combined commit. A throw-on-call `restartDaemon` stub and the new dep fields let the RED commit type-check (cerebrum 2026-08-26).

---

**Total deviations:** 5 auto-fixed (4 Rule 1, 1 Rule 2)
**Impact on plan:** All were needed for correctness or robustness. Public exports match the plan's artifact list, plus `OllamaModelList`, `OLLAMA_LIST_TIMEOUT_MS`, and `InitHandlers`. No 08-04-owned file, STATE.md, ROADMAP.md, or `.wolf/` file was touched.

## Tracer Feedback Gate (Task 1)

The config is interactive (`auto_advance: false`) and `human_verify_mode` defaults to end-of-phase. The tracer `<verify>` carries a `<human-check>`. The orchestrator dispatched this plan as autonomous and the worktree is removed when I return, so I re-ran the automated verify (49/49 pass, typecheck clean) and automated the human check through a real pty instead of stopping. `script -q /dev/null node dist/cli/main.js init provider` with Enter and `QQ_PROVIDER_FILE` in scratch showed the menu with Claude first, wrote `-rw-------` provider.json in a `drwx------` dir, and exited 0. The same pty run against the developer's live Ollama listed 12 models in server order; an invalid model answer re-asked, and EOF printed "No changes made." without writing anything. The remaining human check (a real terminal with the real daemon restart) is deferred to end-of-phase UAT (D8).

## TDD Gate Compliance (Task 2)

- **RED** `6bcb1a3`: target `tests/init-provider.test.ts > daemon restart after a saved pin > restartDaemon is called once with socketPath() after a successful write`, run with `--reporter=tap-flat -t` (pattern regex-escaped for the `()`), exit 1. Classifier verdict: `RED_EVIDENCE_OK` (target_test_failed). Semantic assessment: the target executed and failed on its planned assertion (`expected "vi.fn()" to be called 1 times, but got 0 times`), because the tracer picker did not restart the daemon. This was not a load, import, or fixture fault. 15 planned-behavior tests failed in RED: Ollama dead ends, re-ask, unwritable path, restart, no-tty, and the 4 `restartDaemon` tests.
- **GREEN** `bc64571`: init-provider, daemon-bootstrap, and provider-pin pass 82/82.
- **REFACTOR:** not needed.

## Issues Encountered

- A fresh worktree had no `node_modules`, so I ran `pnpm install --frozen-lockfile --prefer-offline` (no tracked-file changes).
- Full suite (`vitest run`, load average about 120 to 225): 854/893 passed on the first full run. Two of the failures were client-result, my bug, fixed in 7215222. The other 18 were in the known timing-budget files (command-words-fuzz 11, zsh-widget 3, claude-prewarm 3, claude-process 1) plus claude-exec 1 (`expected 1899 to be less than 1500`). Rerun alone and serially, those 5 files pass 128/128. These are load flakes, not caused by this plan.
- An earlier `pnpm test:run` sat with idle workers for about 11 minutes, so I killed it and reran with the verbose reporter to a file. That rerun completed normally.

## Verification

- `pnpm exec vitest run tests/init-provider.test.ts tests/daemon-bootstrap.test.ts tests/provider-pin.test.ts tests/client-result.test.ts`: 4 files, 108 tests passed
- `pnpm typecheck`: 0 errors (also enforced by the lefthook pre-commit on every commit)
- `pnpm exec biome check` on all changed files: clean
- All 17 acceptance greps from both tasks: PASS
- `node dist/cli/main.js init provider </dev/null` (no tty): one stderr line, exit 1, no file
- Forbidden files unchanged since base 99433e3: init.ts, openai.ts, registry/bootstrap.ts, daemon-fetch/registry-bootstrap/openai-provider tests, STATE.md, ROADMAP.md, `.wolf/`

## Deferred Human Check (end-of-phase UAT, not blocking)

1. In a real terminal (back up `~/.config/qq/provider.json` or set `QQ_PROVIDER_FILE`), run `qq init provider`. The menu should show Claude first, Enter should save, `ls -l` should show `-rw-------`, and the last line should read "Restarted the QueQue daemon…".
2. With claude logged out and Ollama running with one model: trigger `??` (it fails; 08-06 adds the hint), run `qq init provider`, press 3 then Enter, and trigger `??` again. Candidates should appear in under 60s total.
3. `qq init zsh` should still only append the source line and never prompt.

## Threat Flags

None. The new surface (the provider.json write, the daemon restart, the URL opener, and the GET /api/tags) is covered by T-08-18..T-08-22, and each mitigation has a test: mode and key hygiene, the `wx` temp file, unsafe-path rejection, no stdout and dispatch, and y-only fixed-URL opening.

## Next Phase Readiness

- 08-06 can point the first failed `??` and the invalid-pin error at `qq init provider`; both already name it.
- Once 08-04 registers `openai`, an openai pin written by the picker resolves through `PIN_BACKEND_IDS.openai`. This plan does not assert that resolution.

## OpenWolf entries (deferred)

The orchestrator applies these; nothing under `.wolf/` was committed from the worktree.

**anatomy.md**
- `## src/cli/commands/`: `init-provider.ts`: `qq init provider` picker on /dev/tty (D-04 menu Claude, OpenAI, Ollama; Enter = 1). Writes provider.json via writeProviderPin, then restartDaemon. Dead ends (no OpenAI key, Ollama down with `[y/N]` open of the fixed URL, zero models, 3 invalid answers, EOF, write failure) print the next step and exit 1. Exports PROVIDER_MENU, OLLAMA_DOWNLOAD_URL, runProviderPicker(io, deps), providerInitCommand, dispatchInit. (~2900 tok)
- `## tests/`: `init-provider.test.ts`: 38 tests. PassThrough input plus a sync Writable output; restartDaemon and openUrl are always mocked; `node:fs` openSync throws for /dev/tty; `.env.local` reader mocked; D-03/D-05 source guards. (~4600 tok)
- Update `src/providers/provider-pin.ts`: plus `writeProviderPin` (validate, wx temp file, rename, chmod 0600, dir 0700).
- Update `src/providers/ollama.ts`: plus `listOllamaModels` (GET /api/tags, 2s, never throws, filters unsafe names).
- Update `src/daemon/bootstrap.ts`: plus `restartDaemon` (forced replace and spawn; inherits the caller's env).
- Update `src/cli/main.ts`: the `init <shell>` action calls `dispatchInit`.
- Update `tests/daemon-bootstrap.test.ts`: plus 4 restartDaemon tests.

**cerebrum.md, Key Learnings**
- [2026-10-17] 08-05: `readline/promises` `question()` drops lines that arrive before the prompt is printed. For scripted or pasted answers, read lines with `createInterface({terminal:false})[Symbol.asyncIterator]()`, which buffers them.
- [2026-10-17] Anything main.ts imports must not read cross-module bindings at module load. `tests/client-result.test.ts` imports main.ts with a strict `vi.mock` of daemon/bootstrap.js, and touching a missing export throws `No "x" export is defined on the mock`. Wrap defaults lazily (`(p) => fn(p)`).
- [2026-10-17] Picker and daemon tests must inject `restartDaemon`. The real one signals `lsof` listeners of `/tmp/qq-$UID.sock`, so it would kill the developer's running daemon and respawn it from a worktree build.
- [2026-10-17] A real-pty smoke test for /dev/tty CLIs works from the Bash tool: `(sleep 1.5; printf '\n') | script -q /dev/null node dist/cli/main.js init provider` (with QQ_PROVIDER_FILE in scratch).
- [2026-10-17] Vitest `-t` is a regex. A test name containing `()` must be escaped (`socketPath\(\)`), or nothing matches and every test is skipped (exit 0), which tdd-red-evidence reports as `invalid_record`.

**cerebrum.md, Do-Not-Repeat**
- [2026-10-17] Do not write `qq init zsh >> ~/.zshrc` in help or docs: initCommand appends to ~/.zshrc itself and prints a status line on stdout, so the redirect would put that line in the rc file. Use `qq init zsh && source ~/.zshrc`.

**buglog.json**
- bug: `tests/client-result.test.ts` failed with `[vitest] No "restartDaemon" export is defined on the "../src/daemon/bootstrap.js" mock`. File: src/cli/commands/init-provider.ts. Root cause: main.ts imports init-provider, whose `defaultDeps` read the `restartDaemon` import when the module loaded, and the test's strict mock lacks that export. Fix: lazy wrapper `restartDaemon: (path) => restartDaemon(path)`. Tags: vitest, vi.mock, module-load, main.ts.
- bug: tdd-red-evidence `invalid_record` (0 tests failed, all `# SKIP`). Root cause: `-t "…socketPath() after…"` is a regex, and `()` matched an empty group. Fix: escape the parentheses. Tags: vitest, tdd, tap.

## Self-Check: PASSED

- FOUND: src/cli/commands/init-provider.ts, tests/init-provider.test.ts, src/providers/provider-pin.ts, src/providers/ollama.ts, src/daemon/bootstrap.ts, src/cli/main.ts, tests/daemon-bootstrap.test.ts
- FOUND commits (ancestors of HEAD): 369566e, 6bcb1a3, bc64571, 7215222
- Commits measured: `git rev-list --count 99433e3..72152225` = 4
