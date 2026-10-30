---
phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
reviewed: 2026-10-30T15:00:00Z
depth: standard
iteration: 2
files_reviewed: 14
files_reviewed_list:
  - .github/workflows/ci.yml
  - scripts/ci/auto-revert.sh
  - scripts/ci/code-changed.mjs
  - scripts/smoke-distro-runner.sh
  - scripts/smoke-distro.sh
  - src/cli/commands/doctor.ts
  - src/client/run-foreground.ts
  - src/daemon/bootstrap.ts
  - src/shared/telemetry-config.ts
  - tests/auto-revert.test.ts
  - tests/client-result.test.ts
  - tests/code-changed.test.ts
  - tests/doctor.test.ts
  - tests/telemetry-config.test.ts
findings:
  critical: 0
  warning: 1
  info: 12
  total: 13
status: issues_found
---

# Phase 10: Code Review Report (re-review after the fix run)

**Reviewed:** 2026-10-30T15:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

This re-review covers the 14 files the fix run changed (`git diff 3ce3a1d HEAD`), which address CR-01 and WR-01..WR-06 (see 10-REVIEW-FIX.md). I checked each fix against the original finding. I also traced the helpers the fixes call: `readRawConfig`, `tryConnect`/`pingDaemonFetchCap`/`ensureDaemon`, `resolveBaseRef`, the telemetry CLI error path and the smoke runner's `fail()`/`collect_doctor`.

**How each original finding stands:**
- **CR-01 (fixed).** `telemetryStateWritable` runs the same `readRawConfig` checks as the write. It also checks the directory the write will use, and it never throws. The client calls it only after `shouldAskTelemetryConsent` passes, so a normal `??` pays nothing extra. A failed write such as ENOSPC can still lead to a repeat ask; the fix report already says so.
- **WR-01 (fixed).** The fix skips the ask in Zellij. One edge remains, IN-08: the client and the widget detect Zellij differently.
- **WR-02 (fixed).** A symlinked `config.json` now keeps its link. Side effect: a link into a read-only store (home-manager) now makes `qq telemetry on|off` fail with a raw errno message. Before the fix, those commands worked by replacing the link. See WR-01 below.
- **WR-03 (fixed).** Doctor now tells "nothing listening" apart from "a listener that accepts connections but never answers". The default probe is the `tryConnect` that ensureDaemon itself uses.
- **WR-04 (fixed).** Pushes now diff against the merge base with `origin/main`, and an empty range runs everything. With `fetch-depth: 0`, `origin/main` is present. Side effect: docs-only pushes to main now run the full matrix and can trigger auto-revert. See IN-11.
- **WR-05 (fixed).** The head branch name now ends with a short hash of the exact branch name, and the PR lookup filters on `--base`. Revert PRs opened under the old name are orphaned. See IN-12.
- **WR-06 (fixed).** Both the wrapper and the runner clear stale doctor files, so `fail()` can no longer report an old run's doctor output.

I found no regressions in the tests. The new tests skip the read-only directory cases when run as root and clean up their chmods in `afterEach`. Before testing a push, the code-changed tests remove the base variables (`QQ_CHANGES_BASE`, `QQ_BASE_REF`, `GITHUB_BASE_REF`).

IN-01..IN-07 from the previous review were out of the fix scope and are all still present, so they are carried forward. IN-04 is now easier to hit (see WR-01).

## Warnings

### WR-01: With a config.json linked into a read-only store, `qq telemetry on|off` now fails with a raw errno message

**File:** `src/shared/telemetry-config.ts:234-247`, `src/cli/commands/telemetry.ts:228-234`, `src/cli/main.ts:139-143`
**Issue:** The WR-02 fix resolves the link and writes the temp file next to the target (`writeTarget` → `realpathSync`). The fix report names home-manager as a target scenario, and there `~/.config/qq/config.json` resolves into `/nix/store`, which is read-only. `telemetryStateWritable` correctly reports false, so the `??` path never asks. But `qq telemetry on` and `qq telemetry off` still call `writeTelemetryState`. Its `mkdirSync`/`writeFileSync(temp, …, 'wx')` then throws a raw `EACCES`/`EROFS`. That error is not a `TelemetryConfigWriteError` (this is IN-04), so `telemetryCommand`'s catch rethrows it. `main().catch` then prints something like `EACCES: permission denied, open '/nix/store/…-config.json.1234.ab12cd34.tmp'`, with none of the documented "cannot update … No changes made." wording and no hint that the file is managed elsewhere.

Before the fix, the same commands succeeded, because the rename replaced the link. For the opt-out (`qq telemetry off`), the user now gets an unexplained crash message. That only matters when the managed file itself enables telemetry, but there it is the privacy-relevant path. The fix moved a working case into IN-04's unhandled path.
**Fix:** Wrap the write block in `TelemetryConfigWriteError`, and name the read-only target when the target differs from `path`:
```ts
const target = writeTarget(path);
try {
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
} catch (error) {
  throw new TelemetryConfigWriteError(path, `cannot create ${dirname(target)} (${(error as NodeJS.ErrnoException).code ?? 'error'})`);
}
const temp = `${target}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
try {
  writeFileSync(temp, …, { mode: 0o600, flag: 'wx' });
  chmodSync(temp, 0o600);
  renameSync(temp, target);
} catch (error) {
  try { unlinkSync(temp); } catch {}
  const code = (error as NodeJS.ErrnoException).code ?? 'write failed';
  throw new TelemetryConfigWriteError(
    path,
    target === path ? `cannot write (${code})` : `it links to ${target}, which cannot be written (${code}); change it where it is managed, or set QQ_TELEMETRY=0`,
  );
}
```
Add a test: a link into a `0o500` directory makes `setTelemetryEnabled(false, link)` throw `TelemetryConfigWriteError`, and the link is left unchanged.

## Info

### IN-01: Consenting users send events to the daemon even when the build has no project key (carried forward)

**File:** `src/client/telemetry-events.ts:137-161`
**Issue:** `reportClientTelemetry` checks only `effectiveTelemetry()` (env plus consent). Every build ships today with an empty key, so the daemon drops every event at `gate()` (`no-endpoint`). Each `??` still builds the events, connects to the socket, and waits (capped at 250 ms) before the client exits.
**Fix:** Also return early when `resolveTelemetryEndpoint(input.env ?? process.env) === null`.

### IN-02: The mktemp-failure exit skips `zle reset-prompt` after the instant frame scrolled the reserve (carried forward)

**File:** `shell/zsh/queque.zsh:385-393`
**Issue:** The early return erases the frame (`\e8\e[J`) and calls `zle -M`, but it never redraws the prompt. When the reserve scrolled the screen, ZLE's saved prompt position is stale.
**Fix:** When `QQ_INSTANT_FRAME_PAINTED == 1`, call `zle reset-prompt` before `zle -M`.

### IN-03: `QQ_ZSH_VERSION` stays exported in the user's interactive shell (carried forward)

**File:** `shell/zsh/queque.zsh:425`
**Issue:** The `export` inside the widget changes the interactive shell itself, so every later command the user runs inherits the variable.
**Fix:** Pass it only to the client in the inline path (`QQ_ZSH_VERSION="$ZSH_VERSION" "${qq_cmd[@]}" client …`). Keep the export only for the Zellij pane.

### IN-04: Only read and parse failures become `TelemetryConfigWriteError` (carried forward; now easier to hit, see WR-01)

**File:** `src/shared/telemetry-config.ts:235-247`, `src/cli/commands/telemetry.ts:228-234`
**Issue:** `mkdirSync`/`writeFileSync`/`renameSync` failures are rethrown raw, so `qq telemetry on|off` prints a bare errno message. WR-01 above describes a common setup that now reaches this path.
**Fix:** The `TelemetryConfigWriteError` wrapping in WR-01's fix.

### IN-05: The `socket_failed` error kind can almost never be delivered (carried forward)

**File:** `src/client/run-foreground.ts:183`, `src/client/telemetry-events.ts:95-130`
**Issue:** `socket_failed` is recorded only when `ensureDaemon` fails, and the event is then sent to that same daemon socket.
**Fix:** Document it as best-effort, or drop it from the client.

### IN-06: A host override with a query or fragment produces a broken batch URL (carried forward)

**File:** `src/shared/telemetry-endpoint.ts:44`, `src/daemon/telemetry-buffer.ts:80`
**Issue:** `QQ_TELEMETRY_HOST=https://h/p?x=1` gives `https://h/p?x=1/batch/`.
**Fix:** Reject hosts where `url.search !== '' || url.hash !== ''`.

### IN-07: Wall-clock latency assertions can be flaky under load (carried forward)

**File:** `tests/telemetry-events.test.ts:325`, `tests/telemetry-events.test.ts:337`
**Issue:** `toBeLessThan(300)` and `toBeLessThan(TELEMETRY_CLIENT_SEND_MS + 250)` measure real time around socket I/O.
**Fix:** Widen the upper bounds (for example 1000 ms), or assert only the lower bound and that the call resolved.

### IN-08: The client and the widget detect Zellij differently, and the consent skip now depends on that check

**File:** `src/client/run-foreground.ts:140`, `src/client/run-foreground.ts:488`, `shell/zsh/queque.zsh:373`, `shell/zsh/queque.zsh:427`
**Issue:** The widget picks the Zellij path with `[[ -n "$ZELLIJ" ]]`, but the client uses `process.env.ZELLIJ !== undefined`. If `ZELLIJ` is exported but empty, the widget takes the inline path while the client acts as if it runs in Zellij. The new `!inZellij` guard then skips the consent question on an inline run, where asking is safe. The same flag already drives the other Zellij branches (lines 255, 347, 364); that mismatch predates this fix.
**Fix:** `const inZellij = (process.env.ZELLIJ ?? '') !== '';`

### IN-09: A chain of dangling links is followed only one hop, so an intermediate link is replaced

**File:** `src/shared/telemetry-config.ts:156-170`
**Issue:** If `realpathSync` fails, `writeTarget` follows one `readlink` hop. When `config.json` points to a link that is itself dangling (`a -> b -> missing`), the result is `b`, and `renameSync(temp, b)` replaces link `b` with a regular file. That is the WR-02 behaviour, one level down. This is rare: it needs a two-level link chain whose final target does not exist yet.
**Fix:** Loop `lstat`/`readlink` up to a small bound (for example 8 hops, matching ELOOP semantics). If the loop ends on a link, return `path` or throw.

### IN-10: The doctor hint `lsof -t <socket>` gives wrong output on Alpine (busybox lsof)

**File:** `src/cli/commands/doctor.ts:397-401`
**Issue:** The new warn hint tells the user to find the holder with `lsof -t <socket>`. busybox `lsof` on Alpine, one of the smoke distros, ignores its arguments and lists every open file. `bootstrap.ts:190-205` (`parseLsofPidList`, Defect 1) already guards against this. A user who runs `kill $(lsof -t …)` there gets garbage.
**Fix:** Phrase the hint without depending on lsof's output format (for example "stop the qq daemon process (`pkill -f 'qq daemon'`)"), or name both forms.

### IN-11: Docs-only pushes to main now run the full distro matrix and can trigger auto-revert

**File:** `.github/workflows/ci.yml:45`, `scripts/ci/code-changed.mjs:52-53`
**Issue:** On main, the merge base with `origin/main` is HEAD, so every push to main now gives `code=true`. That includes docs-only and `.planning/` pushes. The full 6-image smoke now runs for those pushes too. Because `auto-revert` gates on `needs.distro.result == 'failure'`, a flaky leg on a docs commit opens a revert PR against main that restores the last green tree, undoing the docs commit and anything else since. This follows from the WR-04 fix, which chose to fail open. It is noted so the trade-off is deliberate.
**Fix:** For pushes to main only, pass the last successful push run's head as `QQ_CHANGES_BASE`. That is the same `green_runs` query `auto-revert.sh` uses, and it is safe because the base was itself tested. Otherwise, document the trade-off in the ci.yml header.

### IN-12: Revert PRs opened under the old head-branch name are no longer found

**File:** `scripts/ci/auto-revert.sh:219-220`, `scripts/ci/auto-revert.sh:349`
**Issue:** The head branch name gained the `-<hash8>` suffix. A revert PR still open on `auto-revert/<branch>` from before this change is not matched by `gh pr list --head <new name>`. The next smoke failure on that branch opens a second PR, which goes against the "one pull request per source branch" promise in the PR body text. This matters only if such PRs exist on the remote.
**Fix:** Close any open `auto-revert/*` PRs that lack the suffix by hand once. Alternatively, have the script also look up the legacy name with `--base "$BRANCH"` and edit that PR if one is found.

---

_Reviewed: 2026-10-30T15:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
