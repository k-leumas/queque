---
phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
reviewed: 2026-10-29T00:00:00Z
depth: standard
files_reviewed: 61
files_reviewed_list:
  - .github/workflows/ci.yml
  - .github/workflows/distro.yml
  - .github/workflows/nightly.yml
  - biome.json
  - package.json
  - scripts/ci/auto-revert.sh
  - scripts/ci/code-changed.mjs
  - scripts/ci/install-distro-deps.sh
  - scripts/ci/test-in-distro.sh
  - scripts/smoke-distro-runner.sh
  - scripts/smoke-distro.exp
  - scripts/smoke-distro.sh
  - shell/zsh/queque.zsh
  - src/cli/commands/daemon.ts
  - src/cli/commands/doctor.ts
  - src/cli/commands/telemetry.ts
  - src/cli/main.ts
  - src/client/run-foreground.ts
  - src/client/telemetry-consent.ts
  - src/client/telemetry-events.ts
  - src/contracts/doctor.ts
  - src/contracts/ipc.ts
  - src/contracts/telemetry.ts
  - src/daemon/bootstrap.ts
  - src/daemon/fetch-client.ts
  - src/daemon/server.ts
  - src/daemon/telemetry-buffer.ts
  - src/env.d.ts
  - src/providers/claude-default.ts
  - src/providers/error-kind.ts
  - src/providers/provider-kind.ts
  - src/shared/environment-shape.ts
  - src/shared/qq-config.ts
  - src/shared/telemetry-config.ts
  - src/shared/telemetry-endpoint.ts
  - tests/auto-revert.test.ts
  - tests/client-result.test.ts
  - tests/code-changed.test.ts
  - tests/daemon-bootstrap.test.ts
  - tests/doctor.test.ts
  - tests/environment-shape.test.ts
  - tests/error-kind.test.ts
  - tests/fixtures/auto-revert/gh
  - tests/git-env-isolation.test.ts
  - tests/live/sdk-contract.live.ts
  - tests/lsof-busybox.test.ts
  - tests/prewarm-sleep.test.ts
  - tests/setup/scrub-git-env.ts
  - tests/telemetry-buffer.test.ts
  - tests/telemetry-cli.test.ts
  - tests/telemetry-config.test.ts
  - tests/telemetry-consent.test.ts
  - tests/telemetry-contract.test.ts
  - tests/telemetry-endpoint.test.ts
  - tests/telemetry-events.test.ts
  - tests/telemetry-ipc.test.ts
  - tests/zsh-widget.test.ts
  - tsconfig.json
  - tsup.config.ts
  - vitest.config.ts
  - vitest.live.config.ts
findings:
  critical: 1
  warning: 6
  info: 7
  total: 14
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-10-29
**Depth:** standard
**Files Reviewed:** 61
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I reviewed the phase 10 diff (`489a67a..HEAD`): the CI harness (ci/distro/nightly workflows, the auto-revert script, the path filter, the distro install, test and smoke scripts), `qq doctor`, the telemetry stack (contract, consent, config, endpoint, client events, daemon buffer, IPC wiring) and the widget changes. For the large existing files I looked only at the phase 10 hunks. Tests were checked for reliability only.

The telemetry allow-list contract is strict and well enforced, and the daemon buffer's gating, dedupe and single-flight flush are correct. The empty key and the whole-run definition of a "green" auto-revert base are user decisions, so they are not reported here.

The main defect is in the consent flow. When the config file cannot be updated, the one-time question is asked again after every accepted `??`, and each answer is thrown away. Other problems:
- In Zellij the question appears after the shell already has its result, so it can take the user's next keystroke.
- The consent write replaces a symlinked `config.json` with a regular file.
- `qq doctor` reports a stuck daemon as "not running" with an ok status.
- Push runs pick their diff base in a way that can report a false green `ci-ok`.
- Two branch names can map to the same auto-revert branch.

## Critical Issues

### CR-01: Consent question is asked again after every accepted `??` when the config file cannot be updated

**File:** `src/client/run-foreground.ts:481-503`, `src/shared/telemetry-config.ts:86-108`, `src/shared/telemetry-config.ts:111-135`
**Issue:** `readTelemetryState()` treats an unreadable file, invalid JSON or a non-object file as the defaults (`asked: false`). `markTelemetryAsked()` → `writeTelemetryState()` → `readRawConfig()` refuses to write in those same cases: it throws `TelemetryConfigWriteError` for invalid JSON, a non-object or an unreadable file. A failed `mkdirSync`/`writeFileSync` (EACCES, ENOSPC) also throws. `run-foreground.ts` catches the throw and only writes a debug line. Nothing records that the user was asked, so `shouldAskTelemetryConsent` passes again on the next accepted `??`.

Users with a hand-edited `config.json` that has a syntax error, or with a read-only `~/.config/qq`, get the `[y/N]` question after every accepted command. In the inline path each ask blocks the shell for up to 30 s. A `y` is silently dropped every time. This breaks D-09's "asked once ever" and adds a stall to the `??` loop, where latency is the product constraint.
**Fix:** Do not ask when the answer cannot be saved. Expose a probe that runs the same checks as `readRawConfig` and gate the ask on it:
```ts
// telemetry-config.ts
export function telemetryStateWritable(path: string = defaultConfigPath()): boolean {
  try {
    readRawConfig(path);            // throws for invalid JSON / non-object / unreadable
    accessSync(dirname(path), constants.W_OK); // or: the dir is missing but its parent is writable
    return true;
  } catch {
    return false;
  }
}

// run-foreground.ts
const ask = shouldAskTelemetryConsent({ ... }) && telemetryStateWritable();
```
Add a regression test with an invalid-JSON config: two accepted queries should produce at most one `askTelemetryConsent` call (ideally zero).

## Warnings

### WR-01: In Zellij, the consent question appears after the widget has returned and can take the next keystroke

**File:** `src/client/run-foreground.ts:481`, `shell/zsh/queque.zsh:461-470`
**Issue:** In the Zellij path the widget blocks only on the FIFO read (`IFS= read -r -t 30 result < "$fifo_path"`). `writeShellResult` completes that read before the `finally` block runs the consent ask. So the widget applies the buffer, cleans up the session dir and redraws the prompt while the floating `qq` pane is still open and focused, showing the `[y/N]` question. The user's next keystroke, meant for the restored command line, goes to the pane. It is swallowed and recorded as a permanent "no" (any key other than `y` means no). The ask condition has no `inZellij` guard, and the smoke harness has no Zellij pass that would catch this.
**Fix:** Either skip the ask in Zellij (`&& !inZellij`) until there is a design for it, or, for the Zellij path only, ask before the FIFO result is written so the widget is still blocked:
```ts
if (outcome?.outcome === 'accepted' && !inZellij && ttyReadStream && ttyWriteStream) {
```

### WR-02: The consent write replaces a symlinked `config.json` with a regular file

**File:** `src/shared/telemetry-config.ts:151-156`
**Issue:** `writeTelemetryState` writes `${path}.<pid>.<rand>.tmp` next to `path` and then calls `renameSync(temp, path)`. If `~/.config/qq/config.json` is a symlink (common with dotfile managers such as stow, chezmoi or home-manager), the rename replaces the link, not its target. From then on the user's dotfile repo is detached from the live config without any notice. Before phase 10 nothing wrote this file automatically. Now the first accepted `??` writes it through the consent ask, without the user running a command. The comment says a planted symlink at the temp name fails, but the target itself is not protected.
**Fix:** Resolve the real target before building the temp path, so the temp file and the rename stay in the target's directory:
```ts
let target = path;
try { target = realpathSync(path); } catch { /* ENOENT: write a new file at path */ }
mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
const temp = `${target}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
// ... writeFileSync(temp, ...), renameSync(temp, target)
```

### WR-03: `qq doctor` reports a stuck daemon as "not running" with an ok status

**File:** `src/cli/commands/doctor.ts:367-385` (with `src/daemon/bootstrap.ts:59-100` `pingDaemonFetchCap`)
**Issue:** `pingDaemonFetchCap` returns `'unknown'` in three cases: the socket does not connect, the ping times out on a socket that connects, and the reply is not a valid `pong`. `checkDaemon` maps every `'unknown'` to `ok('daemon', 'daemon not running; starts on the next ??')`. A daemon that accepts connections but never answers is exactly the case where `??` stalls: `ensureDaemon` keeps it because `cap !== 'no'`. Doctor then reports that case as healthy and "not running", which misdirects the user. The doctor JSON is also quoted in auto-revert PR bodies, so the diagnostics there are wrong too.
**Fix:** Tell "no listener" apart from "listener that does not answer". For example, call `tryConnect`/`canConnect` first, or return a fourth state from the probe:
```ts
if (state === 'unknown' && (await deps.socketConnectable(deps.socketPath))) {
  return warn('daemon', 'daemon is not answering', 'run `qq daemon --ensure` (it replaces the listener) or kill it');
}
```

### WR-04: Push runs diff against `github.event.before`, so a doc-only push after an untested code push reports a green `ci-ok`

**File:** `.github/workflows/ci.yml:41`, `.github/workflows/ci.yml:19-21`, `scripts/ci/code-changed.mjs:33-41`
**Issue:** For push events, `QQ_CHANGES_BASE` is the push's `before` SHA. Feature branches use `cancel-in-progress: true`. Take push A (code), whose run is cancelled by push B (docs only), or push A whose run failed, followed by B. B's run computes `A...B`, sees only doc paths, writes `code=false`, skips `checks` and `distro`, and `ci-ok` passes on B. That green `ci-ok` sits on a head whose code changes were never tested in any push run. On `main` (no cancellation) the same happens after a red push: one docs commit turns `ci-ok` green on a broken `main`. The PR run uses `base.sha`, so it is not affected, but its `ci-ok` check run and the push run's `ci-ok` share the head SHA. The header comment already names this premature-green risk for the opposite direction.
**Fix:** For push events, use the merge base with the default branch (the script's fallback), not `before`. Or use the head of the last successful push run of `ci.yml` on that branch (the same query `auto-revert.sh` uses):
```yaml
QQ_CHANGES_BASE: ${{ github.event_name == 'pull_request' && github.event.pull_request.base.sha || '' }}
```
For `main`, an empty base falls back to `resolveBaseRef()` and should run everything when HEAD is `main` itself.

### WR-05: Different branches can map to the same auto-revert branch and overwrite each other's revert PR

**File:** `scripts/ci/auto-revert.sh:216`, `scripts/ci/auto-revert.sh:339-351`
**Issue:** `HEAD_BRANCH="auto-revert/${BRANCH//\//-}"` maps `feat/x` and `feat-x` (or `a/b-c` and `a-b/c`) to the same `auto-revert/feat-x`. A smoke failure on the second branch force-pushes its revert commit over the first one's. `gh pr list --head "$HEAD_BRANCH"` then finds the open PR whose base is the first branch, and `gh pr edit` rewrites its title and body. That PR now proposes merging the second branch's history into the first branch.
**Fix:** Use an unambiguous head name and check the base before editing:
```bash
HEAD_BRANCH="auto-revert/${BRANCH//\//-}-$(printf '%s' "$BRANCH" | sha256sum | cut -c1-8)"
existing=$(gh pr list --repo "$REPO" --head "$HEAD_BRANCH" --base "$BRANCH" --state open --json number --jq '.[0].number // empty')
```

### WR-06: Stale `doctor.json`/`doctor.txt` from an earlier local run survive and are reported as current

**File:** `scripts/smoke-distro.sh:82`, `scripts/smoke-distro-runner.sh:41-44`
**Issue:** `smoke-distro.sh` reuses `${TMPDIR:-/tmp}/qq-smoke-SLUG` (or `$QQ_SMOKE_OUT`) and deletes only `pty-*.log`, `qq-debug.log`, `image.txt`, `df.txt` and `zshrc.txt`. `doctor.json` and `doctor.txt` stay. In the runner, `fail()` collects doctor only when `/out/doctor.json` does not exist. So a failure at exit 30-33 (deps, package install, user, `qq init zsh`) on a rerun keeps the previous run's doctor report next to the new logs, and debugging a red leg locally starts from the wrong report. CI uses a fresh `$RUNNER_TEMP/smoke-out`, so CI is not affected. Local reproduction, the documented way to debug a red leg, is.
**Fix:**
```bash
rm -f "$OUT_DIR"/pty-*.log "$OUT_DIR"/{qq-debug.log,image.txt,df.txt,zshrc.txt,doctor.json,doctor.txt}
```

## Info

### IN-01: Consenting users send events to the daemon even when the build has no project key

**File:** `src/client/telemetry-events.ts:137-161`
**Issue:** `reportClientTelemetry` checks only `effectiveTelemetry()` (env plus consent). With the empty key every build ships today, the daemon drops every event at `gate()` (`no-endpoint`). Each `??` still pays for building the events, connecting to the socket, and waiting for the daemon to close the socket (capped at 250 ms) before the client exits.
**Fix:** Also return early when `resolveTelemetryEndpoint(input.env ?? process.env) === null`. The daemon's gate stays the source of truth.

### IN-02: The mktemp-failure exit skips `zle reset-prompt` after the instant frame scrolled the reserve

**File:** `shell/zsh/queque.zsh:381-393`
**Issue:** The new early return erases the frame with `\e8\e[J` and calls `zle -M`, but unlike the normal exit (`zle reset-prompt; zle -R`) it does not redraw. When the reserve scrolled the screen, ZLE's idea of where the prompt is goes stale.
**Fix:** Call `zle reset-prompt` before `zle -M` when `QQ_INSTANT_FRAME_PAINTED == 1`.

### IN-03: `QQ_ZSH_VERSION` stays exported in the user's interactive shell

**File:** `shell/zsh/queque.zsh:425`
**Issue:** `export` inside the widget changes the interactive shell itself, so every later command the user runs inherits `QQ_ZSH_VERSION`.
**Fix:** In the inline path, pass it only to the client: `QQ_ZSH_VERSION="$ZSH_VERSION" "${qq_cmd[@]}" client ...`. Keep the export only where the Zellij pane needs it.

### IN-04: Only read and parse failures become `TelemetryConfigWriteError`

**File:** `src/shared/telemetry-config.ts:151-164`, `src/cli/commands/telemetry.ts:228-234`
**Issue:** `mkdirSync`/`writeFileSync`/`renameSync` failures (EACCES, ENOSPC) are rethrown raw. `qq telemetry on|off` then prints a bare errno message through `main().catch` instead of the documented "cannot update … No changes made." copy.
**Fix:** Wrap the write block's error: `throw new TelemetryConfigWriteError(path, (error as NodeJS.ErrnoException).code ?? 'write failed')`.

### IN-05: The `socket_failed` error kind can almost never be delivered

**File:** `src/client/run-foreground.ts:182`, `src/client/telemetry-events.ts:95-130`
**Issue:** `socket_failed` is recorded only when `ensureDaemon` fails, and the event is then sent to the same daemon socket. It reaches the buffer only if the daemon happens to come up later, so this enum value carries almost no signal.
**Fix:** Document it as best-effort, or drop it from the client.

### IN-06: A host override with a query or fragment produces a broken batch URL

**File:** `src/shared/telemetry-endpoint.ts:44`, `src/daemon/telemetry-buffer.ts:80`
**Issue:** `QQ_TELEMETRY_HOST=https://h/p?x=1` gives `https://h/p?x=1/batch/`.
**Fix:** Reject hosts where `url.search !== '' || url.hash !== ''`, or build the result from `url.origin + url.pathname`.

### IN-07: Wall-clock latency assertions can be flaky under load

**File:** `tests/telemetry-events.test.ts:319-337`
**Issue:** `toBeLessThan(300)` and `toBeLessThan(TELEMETRY_CLIENT_SEND_MS + 250)` measure real time around socket I/O. cerebrum already records budgets near 200 ms flaking under the serial full suite and in the lefthook pre-push run.
**Fix:** Widen the upper bounds (for example 1000 ms), or assert only the lower bound plus "resolved, never rejected".

---

_Reviewed: 2026-10-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
