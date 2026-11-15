---
phase: 11-multi-shell-trigger-support-bash-and-fish
reviewed: 2026-11-15T08:12:34Z
depth: standard
files_reviewed: 70
files_reviewed_list:
  - .github/workflows/ci.yml
  - .github/workflows/homebrew.yml
  - .github/workflows/release.yaml
  - CONTRIBUTING.md
  - README.md
  - docs/EXTENSIONS.md
  - docs/INSTALL.md
  - docs/PRIVACY.md
  - docs/PROVIDERS.md
  - docs/SYSTEM_DESIGN.md
  - docs/USAGE.md
  - scripts/ci/bash-version-check.sh
  - scripts/ci/install-distro-deps.sh
  - scripts/smoke-distro-runner.sh
  - scripts/smoke-distro.exp
  - scripts/smoke-distro.sh
  - scripts/smoke-homebrew-docker.sh
  - shell/README.md
  - shell/bash/queque.bash
  - shell/zsh/queque.zsh
  - src/cli/commands/client.ts
  - src/cli/commands/doctor.ts
  - src/cli/commands/init-provider.ts
  - src/cli/commands/init.ts
  - src/cli/main.ts
  - src/client/instant-frame.ts
  - src/client/run-foreground.ts
  - src/client/telemetry-events.ts
  - src/client/tool-handoff.ts
  - src/context/base-context.ts
  - src/contracts/doctor.ts
  - src/contracts/request.ts
  - src/contracts/shell.ts
  - src/contracts/telemetry.ts
  - src/providers/claude.ts
  - src/providers/ollama.ts
  - src/providers/openai.ts
  - src/registry/bootstrap.ts
  - src/shared/command-words.ts
  - src/shared/environment-shape.ts
  - src/shared/instant-frame-spec.ts
  - src/shared/shell-registry.ts
  - src/shared/tool-awareness.ts
  - src/ui/CandidateSelect.tsx
  - src/ui/LoadingSpinner.tsx
  - src/ui/modal-layout.ts
  - tests/bash-widget.test.ts
  - tests/claude-provider.test.ts
  - tests/client-result.test.ts
  - tests/command-words.test.ts
  - tests/context-pipeline.test.ts
  - tests/doctor.test.ts
  - tests/environment-shape.test.ts
  - tests/helpers/shells.ts
  - tests/init-command.test.ts
  - tests/init-provider.test.ts
  - tests/instant-frame-parity.test.ts
  - tests/intent-router.test.ts
  - tests/pty/drive.sh
  - tests/registry-bootstrap.test.ts
  - tests/shell-contract.test.ts
  - tests/shell-names-invariant.test.ts
  - tests/shell-pty.test.ts
  - tests/shell-registry.test.ts
  - tests/telemetry-buffer.test.ts
  - tests/telemetry-contract.test.ts
  - tests/telemetry-events.test.ts
  - tests/tool-awareness.test.ts
  - tests/tool-handoff.test.ts
  - tests/zsh-widget.test.ts
findings:
  critical: 0
  warning: 6
  info: 6
  total: 12
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-11-15T08:12:34Z
**Depth:** standard
**Files Reviewed:** 70
**Status:** issues_found

## Summary

I reviewed the phase-11 diff (`db5e68e..HEAD`) across the bash adapter, the zsh request change, the shell registry, `qq init` / `qq doctor`, the client tool-handoff wait, the telemetry shape, the instant-frame spec, CI and smoke scripts, tests, and the docs (checked only for wrong or stale commands).

The core bash adapter holds up under tracing:
- The two-flag cleanup between the adapter and the detached writer is race-free. Every interleaving of the `closed` and `tools.pending` flags ends with one side removing the dir.
- The Zellij FIFO is opened read-write before the launch, and the sentinel write cannot block.
- `local -` contains a user's `set -euE` / `pipefail`. `noclobber` is safe because every write goes to a new file.
- The doctor `bash -ic` binding probe parses real bash 5.3 output correctly. I checked this against `/opt/local/bin/bash`.
- The seven core test files (410 tests) pass locally.

D-12 (bash below 5 prints one line and binds nothing) is the intended behavior and is not flagged.

No blockers. The warnings are:
- WR-01: a stderr leak in the locale fallback, proven with bash 5.3.
- WR-02: a silent no-op when `jq` is missing.
- WR-03, WR-04: two patterns copied from the zsh adapter that leak state or trust a fixed `/tmp` path. The bash port could fix both cheaply.
- WR-05: a test-only environment variable read in the production client.
- WR-06: an integration check that counts commented-out lines as installed.

## Warnings

### WR-01: The `en_US.UTF-8` locale fallback prints a setlocale warning into the user's terminal

**File:** `shell/bash/queque.bash:128-131`
**Issue:** The comment says that if no UTF-8 locale exists, "its warning goes to /dev/null". That holds only for the first assignment. `local LC_ALL=C.UTF-8 2>/dev/null` is a builtin, so the redirect applies. The second assignment, `LC_ALL=en_US.UTF-8 2>/dev/null`, is an assignment-only simple command. bash runs that redirection separately and does not apply it to the assignment, so the warning goes to the real stderr. I reproduced it with bash 5.3:
```
f(){ local LC_ALL=zz_ZZ.UTF-8 2>/dev/null; LC_ALL=yy_YY.UTF-8 2>/dev/null; }; f
# -> bash: warning: setlocale: LC_ALL: cannot change locale (yy_YY.UTF-8): No such file or directory
```
On any glibc host that has neither `C.UTF-8` nor `en_US.UTF-8`, every `??` prints this line in the middle of the instant-frame paint, which corrupts the modal surface. The case is rare because modern glibc ships `C.UTF-8`, but the documented behavior is wrong.
**Fix:** Put the assignment in a group so the redirect covers it. I verified that this is silent:
```bash
if (( ${#probe} != 1 )); then
  { LC_ALL=en_US.UTF-8; } 2>/dev/null
fi
```

### WR-02: A missing `jq` makes `??` a silent no-op that swallows both `?`

**File:** `shell/bash/queque.bash:456-465`
**Issue:** The instant frame is painted before `jq` runs (line 436). If `jq` is not installed, `jq -n` fails, the frame is cleared, the reason goes only to the debug log (normally off), and the function returns. By then the line has already been reset to `QQ_ORIG_LBUFFER` + `QQ_ORIG_RBUFFER` (line 409). The user sees a flash, both `?` disappear, and nothing explains why. Every other setup failure the user can fix gets a stderr line: `qq not found` (line 424) and `cannot create a temp dir` (line 447). `jq` is a hard prerequisite (doctor fails on it), and it is the dependency most likely to be missing on a fresh bash host.
**Fix:** Print one fixed line when the request write fails, and preferably check before painting:
```bash
if ! command -v jq >/dev/null 2>&1; then
  printf '%s\n' 'queque: jq not found; install jq (see: qq doctor)' >&2
  return 0
fi
```
Or add the same `printf` to the existing `request.json could not be written` branch.

### WR-03: `QQ_RESULT_FILE`, `QQ_PANE_WIDTH` and `QQ_PANE_HEIGHT` stay exported in the user's shell after every `??`

**File:** `shell/bash/queque.bash:501`, `:505`, `:553`
**Issue:** `export QQ_RESULT_FILE=$fifo` / `=$result_file` runs inside `_qq_question` in the interactive shell. The variable outlives the function, so every later command the user runs inherits a path into a session dir that has already been deleted.

The crash handlers in `src/cli/main.ts:53-77` write `{"kind":"cancel"}` to `QQ_RESULT_FILE` with `fs.writeFileSync`, which follows symlinks and blocks on a FIFO with no reader. They do this for any `qq` subcommand that crashes, including `qq doctor`, `qq init` and `qq daemon` started later from that shell. The path regex (`^/tmp/qq-sess\.`) does not help, because the stale name already matches it. A local user who saw the name in `/tmp` can recreate the dir with a symlink (overwrite one of the victim's files) or a FIFO (hang the crashing `qq`).

The pattern is copied from the zsh widget. bash has a one-word fix that zsh lacks.
**Fix:** Scope the exports to the function call:
```bash
local -x QQ_RESULT_FILE=$fifo
local -x QQ_PANE_WIDTH=$qq_pane_width QQ_PANE_HEIGHT=$qq_pane_height
# inline path
local -x QQ_RESULT_FILE=$result_file
```
Children (the client, the launcher subshell) still inherit the values, and they disappear when `_qq_question` returns.

### WR-04: Client stderr is appended to a fixed, predictable path in world-writable `/tmp`

**File:** `shell/bash/queque.bash:471`, `:530`, `:556`
**Issue:** `qq_log_file=${QQ_DEBUG_LOG_FILE:-/tmp/qq-${UID}-debug.log}` is used as `2>>"$qq_log_file"` on every `??`. That redirect follows symlinks and opens FIFOs. macOS has no `fs.protected_symlinks`, so another local user can create the path in advance:
- As a symlink, the victim's client stderr is appended to any file the victim can write, such as `~/.bashrc`.
- As a FIFO, the `2>>` open blocks forever inside the `bind -x` function and hangs the victim's shell.

This is copied from `shell/zsh/queque.zsh:465,484`, but it is new code in this file.
**Fix:** Send stderr to the 0700 session dir when debug logging is off, for example `qq_log_file=${QQ_DEBUG_LOG_FILE:-$tmpdir/client.err}`. Or use a per-user directory such as `${XDG_RUNTIME_DIR:-$HOME/.cache/qq}`. Apply the same change to the zsh adapter.

### WR-05: The production client reads the test-only `QQ_TEST_RESULT_MODE`, and an empty or unknown value silently cancels every `??`

**File:** `src/cli/commands/client.ts:36`
**Issue:** `parseResultMode(options.resultMode ?? process.env.QQ_TEST_RESULT_MODE)` puts a test hook into the shipped client. `parseResultMode` maps anything other than `undefined`, `llm`, `cancel` or `replace-buffer-fixture` to `cancel`, and records that only in the debug log. If a harness or CI job leaks `QQ_TEST_RESULT_MODE=` (empty) or a stale value into a user's environment, every `??` returns a cancel with no visible sign. CONTRIBUTING.md says "Never set it in a real shell", but nothing enforces that.
**Fix:** Treat empty as unset, and ignore the variable unless it names a fixture mode:
```ts
const envMode = process.env.QQ_TEST_RESULT_MODE;
const testMode = envMode === 'cancel' || envMode === 'replace-buffer-fixture' ? envMode : undefined;
const resultMode = parseResultMode(options.resultMode ?? testMode);
```

### WR-06: A commented-out source line counts as installed in `qq init`, the `integration` check and the `bash_profile` check

**File:** `src/cli/commands/init.ts:38-50`, `src/shared/shell-registry.ts:190-191`
**Issue:** Both regexes accept a command word preceded by any whitespace, and that includes the space after `#`. I verified both with node:
- `hasShellIntegration('# source "/opt/homebrew/share/queque/queque.bash"\n', 'bash')` returns `true`.
- `BASHRC_SOURCE_RE.test('# . ~/.bashrc\n')` returns `true`.

A user who disabled QueQue by commenting out the line then gets wrong answers everywhere:
- `qq init bash` prints "already present" and refuses to re-add it.
- `qq doctor` reports `~/.bashrc loads QueQue` as ok.
- On macOS, the `bash_profile` row reports ok while the login shell skips `~/.bashrc`.

This is the exact misconfiguration D-09 exists to catch. The marker check (`/# queque shell integration/`) has the same weakness when only the source line was deleted. The looser matching is older than this phase, but this phase broadened the regex (bare and `.` forms) and applied it to two new bash checks.
**Fix:** Ignore commented lines before matching, for example by stripping `#` comments line by line before `scriptPattern.test` / `BASHRC_SOURCE_RE.test`:
```ts
const active = existing.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
```
For the integration check, also require the source line itself rather than accepting the marker alone.

## Info

### IN-01: The error and setup-failure paths do not reprint the head of a multi-line prompt

**File:** `shell/bash/queque.bash:361-368`, `:424`, `:447`
**Issue:** `_qq_reprint_prompt_head` runs only on `replace-buffer`. The `error` path prints `message`, and the `qq not found` and `mktemp` paths print to stderr. After any of these, readline repaints only the last prompt line, so a multi-line prompt ends up split around the message.
**Fix:** Call `_qq_reprint_prompt_head` after printing in the `error` branch and the two early-return branches.

### IN-02: The `qq not found` hint is circular

**File:** `shell/bash/queque.bash:424`
**Issue:** When `qq` is not on PATH, the hint tells the user to run `qq init bash`, which cannot run either.
**Fix:** Say what is actually wrong: `queque: qq not found on PATH (reinstall, or check PATH)`.

### IN-03: `shellVersion` longer than 40 characters rejects the whole request

**File:** `src/contracts/shell.ts:34`
**Issue:** `z.string().max(40).optional()` fails `shellRequestSchema` for a long custom build string, such as a dev zsh with a long suffix. That breaks `??` entirely over a field that only feeds telemetry.
**Fix:** Truncate or drop the value instead of rejecting: `z.string().transform((v) => v.slice(0, 40)).optional()`, or `.catch(undefined)`.

### IN-04: `init` and `doctor` do not fall back to the PATH bash when `$SHELL` names a stale bash

**File:** `src/cli/commands/init.ts:159-169`, `src/cli/commands/doctor.ts:305-308`, `:419`
**Issue:**
- `init`: when `$SHELL`'s basename is `bash` but the file no longer exists (common after a Homebrew prefix move), the probe returns null and init prints `bash not found`, even when a bash 5 is on PATH.
- `doctor`: it gates on `which('bash')` (PATH) but probes `$SHELL`. A login bash outside PATH reports "bash not found on PATH".
**Fix:** In init, fall back to `pathBash` when probing `loginBash` fails. In doctor, gate on the same binary that gets probed.

### IN-05: Duplicated helpers and copy between `init.ts` and `doctor.ts`

**File:** `src/cli/commands/init.ts:70-94,144`, `src/cli/commands/doctor.ts:113-129,278-284,549`
**Issue:** The two files have identical copies of:
- `whichOnPath` and `passwdShell`
- the `.bashrc` source snippet (`BASHRC_SNIPPET` and `BASHRC_SOURCE_LINE`)

The copies can drift apart.
**Fix:** Move them into `src/shared/shell-registry.ts`, or a small `src/shared/which.ts`, and import from both files.

### IN-06: The docs say `qq doctor` checks "the shell you use", but it checks your login shell

**File:** `docs/INSTALL.md` ("Check your setup"), `src/cli/commands/doctor.ts:759-765`
**Issue:** `resolveDoctorShell` uses `--shell`, then `$SHELL`, then the passwd shell. A user whose login shell is zsh and who runs `qq doctor` from bash gets a zsh report. `bash` has its own adapter, rc file and binding check, so this matters.
**Fix:** Change the sentence to "It checks your login shell (`$SHELL`); `qq doctor --shell bash` or `--shell zsh` picks one."

---

_Reviewed: 2026-11-15T08:12:34Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
