---
phase: quick-261117-jpp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/shared/update-check.ts
  - src/shared/install-detect.ts
  - src/shared/telemetry-config.ts
  - src/contracts/ipc.ts
  - src/contracts/doctor.ts
  - src/daemon/server.ts
  - src/cli/commands/daemon.ts
  - src/cli/commands/doctor.ts
  - src/client/run-foreground.ts
  - src/ui/CandidateSelect.tsx
  - src/ui/modal-layout.ts
  - vitest.config.ts
  - vitest.live.config.ts
  - package.json
  - .github/workflows/release.yaml
  - .github/workflows/homebrew.yml
  - scripts/smoke-homebrew-docker.sh
  - scripts/docker-homebrew-smoke-runner.sh
  - scripts/ci/test-in-distro.sh
  - scripts/smoke-distro.sh
  - scripts/smoke-distro-runner.sh
  - README.md
  - docs/PRIVACY.md
  - tests/update-check.test.ts
  - tests/update-hint-ipc.test.ts
  - tests/install-detect.test.ts
  - tests/install-marker-formula.test.ts
  - tests/modal-layout.test.ts
  - tests/doctor.test.ts
  - .planning/todos/done/2026-11-15-update-notifier.md
  - .wolf/anatomy.md
  - .wolf/memory.md
  - .wolf/cerebrum.md
autonomous: true
requirements: [quick-261117-jpp]

estimate:
  tokens: 145000
  raw_tokens: 145000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "When the cached npm `latest` is newer than the running qq, a `??` opened from a terminal shows exactly one dim, truncated line directly under the controls row, e.g. `qq 0.11.0 available · brew upgrade queque`. All terminals together see it at most once per 24 h, and daemon restarts do not reset that window (shownAt is stored in the cache file)"
    - "`??` never waits on the network. The registry GET (`https://registry.npmjs.org/@k-leumas/queque-cli/latest`, 1.5 s timeout) runs in the daemon in the background, at most once per 24 h, and only after a TTY client asked for a hint. Offline, a timeout, a non-200 reply or a malformed body all fail silently: they set checkedAt, keep the previous latest and retry in the next 24 h window"
    - "With `QQ_NO_UPDATE_CHECK` set (any value other than empty, 0 or false), `CI` set, or a stdout that is not a TTY, there is no registry request and no hint. This holds in the client (which never sends `update-hint`), in the daemon (which re-checks its own env) and in `qq doctor` (whose row says the check is off and why)"
    - "detectInstall() answers who installed qq, never which package manager exists (pickInstaller is not used). The order is: a WSL /mnt/<drive>/ Node warning, then the `.install-source` marker next to dist/, then path rules (/Cellar/queque/ brew, volta, pnpm, /nix/store, nvm, fnm, npm global), then, on Linux only and for unmatched /usr paths, the dpkg -S / rpm -qf / pacman -Qo owner queries (first hit wins, run once per daemon), then the npm fallback, then unknown"
    - "Hint copy follows the install. Brew/volta/pnpm/npm installs get the exact command. nvm/fnm get the npm command with `(this Node version only)`. A non-writable npm global dir gets a user-prefix note and never sudo npm. /nix/store gets no hint at all. Distro packages (an owner-query hit or a non-homebrew marker) get `upstream qq X released; your package may not have it yet` plus their command, or `update via your AUR helper` for AUR. Unknown installs get `qq X available · https://github.com/k-leumas/queque/releases` with no command. When the latest release needs a newer Node, the hint is `qq X needs Node N+; you have M` instead of a command"
    - "`qq doctor` (human and --json) has an `update` row directly before `telemetry`, showing latest, install method and command. It is warn when an update exists and ok otherwise (up to date, check off, unknown), and doctorReportSchema still validates every row at 200 chars max"
    - "The Homebrew formula install block in BOTH release.yaml and homebrew.yml writes `.install-source` = {\"source\":\"homebrew\",\"upgrade\":\"brew upgrade queque\"} next to dist/. The smoke-homebrew-docker.sh emulation writes the same bytes, and a test keeps all three byte-identical and valid against installMarkerSchema"
    - "vitest (default and live configs) and every distro/Homebrew Docker smoke and test container run with QQ_NO_UPDATE_CHECK=1, so no test or CI leg ever reaches registry.npmjs.org"
    - "README documents the QQ_NO_UPDATE_CHECK opt-out next to the Privacy/telemetry line, and docs/PRIVACY.md has an `## Update check` section saying what is sent and when"
  artifacts:
    - path: "src/shared/update-check.ts"
      provides: "gate, registry fetch, semver + engines compare, 24 h cache with shownAt, formatUpdateHint, createUpdateChecker"
      contains: "createUpdateChecker"
    - path: "src/shared/install-detect.ts"
      provides: "detectInstall(): { method, upgradeCommand | null, note?, packaged }, installMarkerSchema"
      contains: "detectInstall"
    - path: "src/contracts/ipc.ts"
      provides: "update-hint request and response kinds"
      contains: "update-hint"
    - path: "src/daemon/server.ts"
      provides: "update-hint case replying with the checker's hint inside a Promise chain"
      contains: "update-hint"
    - path: "src/ui/CandidateSelect.tsx"
      provides: "updateHint prop rendered as one dim truncated row under ControlsLine"
      contains: "updateHint"
    - path: "src/cli/commands/doctor.ts"
      provides: "checkUpdate row before telemetry; DoctorDeps.updateStatus"
      contains: "checkUpdate"
    - path: "tests/install-detect.test.ts"
      provides: "detectInstall matrix for every spec row"
    - path: "tests/update-check.test.ts"
      provides: "24 h cache, offline/timeout silent, opt-out env, non-TTY, engines mismatch, once-per-day tests"
  key_links:
    - from: "src/client/run-foreground.ts"
      to: "src/daemon/server.ts"
      via: "requestDaemonOnce(socketPath, {kind:'update-hint'}, 500), started after ensureDaemon, never awaited before render"
      pattern: "update-hint"
    - from: "src/cli/commands/daemon.ts"
      to: "src/shared/update-check.ts"
      via: "createUpdateChecker passed to startDaemonServer as options.updates"
      pattern: "createUpdateChecker"
    - from: "src/shared/update-check.ts"
      to: "src/shared/install-detect.ts"
      via: "memoized detectInstall() feeding formatUpdateHint"
      pattern: "detectInstall"
    - from: ".github/workflows/release.yaml"
      to: "src/shared/install-detect.ts"
      via: "formula writes .install-source JSON that installMarkerSchema parses"
      pattern: "install-source"
---

<objective>
Build the update notifier exactly as specified in `.planning/todos/pending/2026-11-15-update-notifier.md`. The daemon checks the npm registry at most once per 24 h and caches the result. It compares semver and engines.node. `detectInstall()` names the upgrade command for how *this* qq was installed, or gives no command when that cannot be known. The client shows one dim line at most once a day. `qq doctor` gets an `update` row. Users can opt out (QQ_NO_UPDATE_CHECK=1, CI, non-TTY), and the README documents it. The Homebrew formula writes the `.install-source` marker. Tests and distro CI never reach the registry.

Purpose: nothing tells users that a newer qq exists. Homebrew users only get it on `brew upgrade`, and npm users only on a manual reinstall. A wrong upgrade command is worse than none.
Output: two new shared modules, an IPC kind, daemon and client wiring, a doctor row, docs, the formula marker, CI opt-outs and the full unit-test matrix.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/todos/pending/2026-11-15-update-notifier.md
@.wolf/cerebrum.md

Check .wolf/anatomy.md entries before opening any of these. Read only the line ranges given:
- src/shared/telemetry-config.ts lines 55-90 (`normalized`, `flagSet`, `telemetryBlockedBy`: the CI flag semantics to reuse)
- src/cli/launcher.ts lines 40-80 (`isPrivateDirectory`: lstat real dir, owned by getuid, no group/world write; the cache-dir pattern to mirror)
- src/contracts/ipc.ts (whole file, 121 lines)
- src/daemon/server.ts lines 20-160 (`DaemonServerOptions`, the request switch, `writeJson`)
- src/cli/commands/telemetry.ts lines 55-110 (`requestDaemonOnce(socketPath, request, timeoutMs)`: one-shot, schema-validated, null on error/close/timeout)
- src/cli/commands/daemon.ts (whole file: where startDaemonServer gets its options)
- src/client/run-foreground.ts lines 179-475 (ensureDaemon, `buildCandidateElement`, `app.rerender`, the `resolved` guard)
- src/ui/CandidateSelect.tsx lines 61-80 (Props), 240-275 (layout effect + deps), 440-480 (footer render)
- src/ui/modal-layout.ts lines 151-250 (`CandidateSelectLayoutInput`, `estimateCandidateSelectLines`)
- src/cli/commands/doctor.ts lines 76-110 (DoctorDeps), 300-370 (defaultDoctorDeps), 380-395 (ok/warn helpers), 720-815 (checkTelemetry, runDoctorChecks)
- src/contracts/doctor.ts (whole file, ~60 lines)
- tests/doctor.test.ts lines 60-110 (`healthyDeps` fixture, `toHaveLength(12)`), 695-705, 775-790
- tests/telemetry-ipc.test.ts lines 1-60 and 95-115 (temp-socket startDaemonServer test pattern)
- .github/workflows/release.yaml lines 176-190 and .github/workflows/homebrew.yml lines 58-68 (formula `install: |` blocks)
- scripts/smoke-homebrew-docker.sh lines 75-125 (quoted `<<'DOCKERFILE'` heredoc with the formula emulation, then `docker run`)

<interfaces>
Existing code to reuse (do not copy it):
- `requestDaemonOnce(socketPath: string, request: IpcRequest, timeoutMs?: number): Promise<IpcResponse | null>` in src/cli/commands/telemetry.ts
- `flagSet(value: string | undefined): boolean` in src/shared/telemetry-config.ts. It is module-private today: add `export` and change nothing else
- `__QUEQUE_VERSION__` (build define; vitest defines it as '0.0.0-test'), `process.versions.node`
- `startDaemonServer(socketPath, options: DaemonServerOptions)`; options today are `{ onShutdown?, telemetry? }`
- `doctorReportSchema`, `DOCTOR_TEXT_MAX = 200`, and `ok(id, summary)` / `warn(id, summary, hint)` in doctor.ts
- `InstallerId = 'brew' | 'apt' | 'dnf' | 'pacman'` in src/shared/tool-awareness.ts. Reuse these ID strings as InstallMethod values. Do NOT call pickInstaller

New contracts this plan creates. The executor writes them; they are named here so every task agrees:
- src/shared/install-detect.ts:
  - `InstallMethod = 'marker' | 'brew' | 'volta' | 'pnpm' | 'nvm' | 'fnm' | 'npm' | 'nix' | 'apt' | 'dnf' | 'zypper' | 'rpm' | 'pacman' | 'aur' | 'windows-node' | 'unknown'`
  - `InstallInfo = { method: InstallMethod; upgradeCommand: string | null; note?: string; packaged: boolean; source?: string }`
  - `InstallDetectDeps = { modulePath: string; execPath: string; env: NodeJS.ProcessEnv; homeDir: string; platform: NodeJS.Platform; realpath(p: string): string; readFile(p: string): string | null; isWritable(dir: string): boolean; runOwnerQuery(cmd: string, args: string[]): Promise<{ ok: boolean; stdout: string }>; readOsRelease(): string | null }`
  - `defaultInstallDetectDeps(): InstallDetectDeps`, `detectInstall(deps?: InstallDetectDeps): Promise<InstallInfo>`, `installMarkerSchema` (zod strictObject), `NPM_PACKAGE = '@k-leumas/queque-cli'`
- src/shared/update-check.ts:
  - constants `UPDATE_REGISTRY_URL`, `UPDATE_CHECK_INTERVAL_MS` (24 h), `UPDATE_HINT_INTERVAL_MS` (24 h), `UPDATE_FETCH_TIMEOUT_MS` (1500), `UPDATE_HINT_REQUEST_TIMEOUT_MS` (500), `UPDATE_HINT_MAX` (200), `RELEASES_URL = 'https://github.com/k-leumas/queque/releases'`, `UPDATE_CACHE_FILE_NAME = 'update-check.json'`
  - `UpdateBlockReason = 'QQ_NO_UPDATE_CHECK' | 'CI' | 'not a terminal'`
  - `updateCheckBlockedBy(env: NodeJS.ProcessEnv, isTTY: boolean): UpdateBlockReason | null`
  - `compareVersions(a: string, b: string): -1 | 0 | 1 | null`, `isNewerVersion(latest: string, current: string): boolean`, `nodeFloor(range: string): string | null`, `nodeBelowFloor(floor: string, nodeVersion: string): boolean`
  - `updateCacheSchema` (strictObject `{ version: 1, checkedAt: number, latest: string | null, enginesNode: string | null, shownAt: number | null }`), `updateCacheDir({ env, platform, homeDir }): string`, `readUpdateCache(file: string): UpdateCache | null`, `writeUpdateCache(file: string, cache: UpdateCache): boolean`
  - `fetchLatestRelease(fetchImpl: typeof fetch, timeoutMs: number): Promise<{ latest: string; enginesNode: string | null } | null>`
  - `UpdateStatus = { state: 'blocked'; reason: UpdateBlockReason } | { state: 'unknown' } | { state: 'current'; current: string } | { state: 'available'; current: string; latest: string; nodeTooOld: { floor: string; have: string } | null; install: InstallInfo }`
  - `formatUpdateHint(status: UpdateStatus): string | null`
  - `createUpdateChecker(deps: { env: NodeJS.ProcessEnv; cacheFile: string; fetchImpl: typeof fetch; now: () => number; currentVersion: string; nodeVersion: string; detectInstall: () => Promise<InstallInfo>; fetchTimeoutMs?: number }): { hint(): Promise<string | null>; status(opts: { isTTY: boolean; refresh: boolean }): Promise<UpdateStatus> }`
- IPC: request `{ kind: 'update-hint' }`; response `{ kind: 'update-hint', hint: string | null }`
</interfaces>

Discretion decisions. The spec leaves these open; each was chosen here and is not to be revisited during execution:
1. Cache location (USER DECISION 2026-11-17 — locked, overrides the spec's ~/Library/Caches wording): reuse the existing qq cache dir, `${XDG_CACHE_HOME (absolute only) or ~/.cache}/queque/update-check.json`, on EVERY platform including darwin — the same base dir src/cli/launcher.ts uses for node-compile-cache. Both get launcher.ts's private-dir check. The launcher's compile cache stays where it is, and launcher.ts is untouched: it must keep zero non-builtin imports.
2. The daemon fetches only when a client that passed the env + TTY gate sends `update-hint`, never at daemon start. That is how non-TTY and CI runs never fetch. The very first `??` starts the check, and the hint appears on a later `??`.
3. Once-per-day display uses `shownAt` in the cache file, so it is shared by all terminals and survives daemon restarts. The daemon sets it when it returns a hint. hint() reads the file, decides and writes it synchronously, so two hint() calls in the single-threaded daemon cannot interleave.
4. Display surface: one dim `wrap="truncate"` row right under ControlsLine, inside the Ink modal. A line printed after the result would collide with the widget's prompt redraw, and it would be lost when a Zellij pane closes.
5. A marker with `source: "homebrew"` gets the plain wording (`qq X available · brew upgrade queque`), matching the spec's own example: the first-party tap is updated in the same release run. Any other marker source counts as distro-packaged (spec rule 4).
6. Owner-query hits use the spec's literal commands (`queque`) only when the owning package name parses as exactly `queque`. Any other owner name gets the distro wording with no command, because a wrong command is worse than none.
7. Owner queries run only on Linux. On darwin, an unmatched /usr path (for example /usr/local/lib/node_modules) goes straight to the npm fallback.
8. A non-writable npm global dir keeps the npm command and adds the note `set a user npm prefix first, not sudo`. The doctor hint spells it out as `npm config set prefix ~/.local, then npm i -g @k-leumas/queque-cli@latest (not sudo)`.
9. package.json gets `"engines": { "node": ">=24" }`, so the published manifest carries the floor that the hint compares against. docs/INSTALL.md and tsup's node24 target already require Node 24, so no supported user is affected.
10. QQ_NO_UPDATE_CHECK and CI use telemetry's `flagSet` semantics: set means anything but empty, 0 or false.
11. `qq doctor` computes the status in-process with the same module and cache file, so the row works with no daemon. It refreshes a stale cache (1.5 s timeout) and never touches shownAt.
12. A WSL Node under /mnt/<drive>/ gets the warning line `qq X available · this qq runs on a Windows Node; install Node inside WSL` instead of a command (spec out-of-scope note).
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Tracer, update hint end-to-end from the registry through the daemon cache and IPC to one dim modal line (marker, Homebrew Cellar, unknown installs)</name>
  <files>src/shared/update-check.ts, src/shared/install-detect.ts, src/shared/telemetry-config.ts, src/contracts/ipc.ts, src/daemon/server.ts, src/cli/commands/daemon.ts, src/client/run-foreground.ts, src/ui/CandidateSelect.tsx, src/ui/modal-layout.ts, vitest.config.ts, vitest.live.config.ts, tests/update-check.test.ts, tests/update-hint-ipc.test.ts, tests/modal-layout.test.ts</files>
  <behavior>
    Write these tests first in tests/update-check.test.ts. They must fail first, then pass. Use injected deps only: a fake fetchImpl, now(), a temp-dir cacheFile and a fake detectInstall. Never use the real network.
    - Gate: QQ_NO_UPDATE_CHECK=1 → 'QQ_NO_UPDATE_CHECK'; QQ_NO_UPDATE_CHECK of '' / '0' / 'false' does not block; CI=true → 'CI'; CI=0 → null; isTTY false → 'not a terminal'; precedence is QQ_NO_UPDATE_CHECK, then CI, then TTY
    - compareVersions/isNewerVersion: 0.11.0 > 0.10.5; 0.10.10 > 0.10.9 (numeric, not lexical); 1.0.0 > 1.0.0-beta.2; 1.0.0-beta.10 > 1.0.0-beta.9; equal → false; a non-semver input → isNewerVersion false
    - nodeFloor: '>=24' → '24'; '>= 22.12.0' → '22.12.0'; '^20.19 || >=22.12' → '20.19' (lowest floor across alternatives); '24.x' → '24'; '*' or 'banana' → null. nodeBelowFloor('26','24.14.1') true; ('24','24.0.0') false; ('22.12','22.5.0') true
    - fetchLatestRelease: body {version:'0.11.0', engines:{node:'>=24'}} → {latest:'0.11.0', enginesNode:'>=24'}; no engines → enginesNode null; status 500 → null; version 'x\u001b[2J' or longer than 64 chars → null; engines.node with a control char → enginesNode null; fetch rejects → null; a fetch that never settles unless aborted, with timeoutMs 20, → null well under 1 s (the AbortSignal is honored)
    - Cache: missing, corrupt JSON or a wrong shape → null; write then read round-trips; the written file is mode 0600 and its dir 0700; a group-writable cache dir → read returns null and write returns false; updateCacheDir: darwin → <home>/.cache/queque (same as linux), linux with XDG_CACHE_HOME=/x → /x/queque, a relative XDG_CACHE_HOME is ignored → <home>/.cache/queque
    - Checker 24 h cache: with no cache, hint() returns null and starts exactly one fetch (two concurrent hint() calls → fetch called once); a fresh cache (checkedAt 1 h old) → fetch not called; a 24 h old cache → one fetch
    - Checker offline: a rejecting fetch → hint() resolves null, never throws or rejects unhandled, and the cache keeps the previous latest with checkedAt = now, so the next call within 24 h does not refetch
    - Checker opt-out: QQ_NO_UPDATE_CHECK=1 or CI=1 in the checker env → hint() null and fetch never called
    - Checker once-per-day: cache latest 0.11.0, current 0.10.5, install brew → first hint() `qq 0.11.0 available · brew upgrade queque`; the second call at the same now → null; a call at now + 24 h → the line again
    - Equal latest → null. Engines mismatch: enginesNode '>=26', node 24.14.1 → `qq 0.11.0 needs Node 26+; you have 24.14.1`
    - Copy for the Task 1 install rows: unknown → `qq 0.11.0 available · https://github.com/k-leumas/queque/releases`; marker {source:'homebrew', upgrade:'brew upgrade queque'} → `qq 0.11.0 available · brew upgrade queque`; marker {source:'aur', upgrade:'paru -S queque'} → `upstream qq 0.11.0 released; your package may not have it yet · paru -S queque`
    - detectInstall with a faked realpath: /opt/homebrew/Cellar/queque/0.10.5/libexec/lib/node_modules/@k-leumas/queque-cli/dist/cli/app.js → {method:'brew', upgradeCommand:'brew upgrade queque', packaged:false}; a valid marker at <pkgRoot>/.install-source beats the path rule; a malformed marker is ignored and the path rules apply (bad JSON, an unknown key, a control char in upgrade, upgrade over 120 chars, source not matching /^[a-z0-9][a-z0-9._-]{0,31}$/); /Users/x/dev/queque/dist/cli/app.js → {method:'unknown', upgradeCommand:null}
    In tests/update-hint-ipc.test.ts, follow the telemetry-ipc.test.ts temp-socket pattern:
    - startDaemonServer with options.updates = { hint: async () => 'qq 0.11.0 available · brew upgrade queque' } → requestDaemonOnce replies {kind:'update-hint', hint:<that string>}
    - Without options.updates → hint null; a hint() that rejects → hint null, and the daemon stays up for a following ping
    - ipcResponseSchema maps a non-string hint, or one over 200 chars, to null (.catch(null)); ipcRequestSchema accepts {kind:'update-hint'}
    In tests/modal-layout.test.ts:
    - estimateCandidateSelectLines with updateHint set is exactly 1 more than without it, for both a short hint and a 300-char hint (the row truncates)
  </behavior>
  <action>
Build the thinnest complete path first, then fill it out. This task runs about 25-35 min.

1) In src/shared/telemetry-config.ts, export `flagSet` and change nothing else.

2) Create src/shared/install-detect.ts with the types and functions in the interfaces block. It must have no top-level side effects (cerebrum: modules main.ts loads must not do work at import).
   - `defaultInstallDetectDeps()`:
     - modulePath = `fileURLToPath(import.meta.url)`. In the bundle this is dist/cli/app.js.
     - execPath = process.execPath; env = process.env; homeDir = os.homedir(); platform = process.platform.
     - realpath = fs.realpathSync. If it throws, return the input unchanged.
     - readFile: readFileSync utf8, null on error.
     - isWritable: fs.accessSync(dir, W_OK).
     - runOwnerQuery: `spawn(cmd, args, { stdio: ['ignore','pipe','ignore'], env: { ...process.env, LC_ALL: 'C' } })`. Use spawn, not execFile, per cerebrum 2026-08-26. Keep a 2000 ms kill timer, cap stdout at 4096 bytes, and resolve `{ ok: exitCode === 0, stdout }`. ENOENT or any spawn error resolves `{ ok: false, stdout: '' }`. It never rejects.
     - readOsRelease reads /etc/os-release and returns null on error.
   - `detectInstall(deps)`:
     - Compute `real = deps.realpath(deps.modulePath)`.
     - pkgRoot = the part of `real` before its LAST `/dist/` segment. Without a `/dist/` segment there is no marker lookup.
     - Marker rule (spec rule 1): read `<pkgRoot>/.install-source` and parse it with `installMarkerSchema`, a strictObject of
       - `source`: string matching /^[a-z0-9][a-z0-9._-]{0,31}$/
       - `upgrade`: string 1-120 chars matching /^[\x20-\x7e]+$/
       A valid marker returns `{ method: 'marker', source, upgradeCommand: upgrade, packaged: source !== 'homebrew' }` (discretion 5). An invalid marker is ignored silently.
     - Path rule `/Cellar/queque/` → `{ method: 'brew', upgradeCommand: 'brew upgrade queque', packaged: false }`. This covers macOS and Linuxbrew.
     - Anything else → `{ method: 'unknown', upgradeCommand: null, packaged: false }`.
     - Task 2 inserts the remaining rows into this same function, at the positions its action names.

3) Create src/shared/update-check.ts with the constants, types and functions in the interfaces block. It has no top-level side effects.
   - `updateCheckBlockedBy` uses `flagSet` for both variables (discretion 10).
   - `compareVersions`:
     - Accept only SEMVER_RE `^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$`, max 64 chars; anything else returns null.
     - Compare major/minor/patch numerically. A version without a prerelease ranks above the same version with one.
     - Compare prerelease identifiers dot by dot: numeric ones numerically, numeric below alphanumeric, and a shorter list below a longer one when the shared prefix is equal.
     - Hand-roll this small compare. Do not add the `semver` package (no new dependencies).
   - `nodeFloor`: split on `||`. In each alternative, accept `>= N[.M[.P]]`, `^N[.M[.P]]`, `~N[.M[.P]]` or `N[.x]` (whitespace tolerated). Return the lowest floor as written without its operator. If any alternative is unparseable, return null: no engines check, because a wrong block is worse than none.
   - `fetchLatestRelease`:
     - `fetchImpl(UPDATE_REGISTRY_URL, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) })`, plus `AbortSignal.any` with nothing else.
     - Require `res.ok`, then parse JSON with a non-strict zod object: version passes SEMVER_RE, and `engines.node` is optional, max 64 chars, /^[\x20-\x7e]+$/ (an invalid engines value becomes null and never rejects the version).
     - Wrap everything in try/catch and return null. Never log the body.
   - `updateCacheDir` follows discretion 1.
   - `readUpdateCache` and `writeUpdateCache` mirror launcher.ts isPrivateDirectory:
     - mkdirSync recursive with mode 0o700.
     - lstat the dir: it must be a real dir owned by getuid with no group/world write bits; otherwise read returns null and write returns false.
     - Write `<file>.<pid>.tmp` with mode 0o600, then renameSync.
     - Every error is swallowed: read returns null, write returns false.
   - `formatUpdateHint(status)`:
     - null unless state is 'available'.
     - install.method 'nix' → null. Task 1 can already include this branch.
     - nodeTooOld → `qq ${latest} needs Node ${floor}+; you have ${have}`.
     - install.packaged → `upstream qq ${latest} released; your package may not have it yet · ${upgradeCommand}`. Task 2 extends the null-command fallbacks.
     - upgradeCommand → `qq ${latest} available · ${upgradeCommand}`, plus ` (${note})` when a note exists.
     - Otherwise → `qq ${latest} available · ${RELEASES_URL}`.
     - Truncate to UPDATE_HINT_MAX.
   - `createUpdateChecker(deps)`:
     - Memoize one detectInstall promise for the checker's lifetime (spec: run once in the daemon and cache).
     - Keep one in-flight refresh promise, deduped.
     - The file is the source of truth: re-read it on every hint()/status() call.
     - `refresh()`:
       - Call fetchLatestRelease with `deps.fetchTimeoutMs ?? UPDATE_FETCH_TIMEOUT_MS`.
       - Re-read the cache just before writing, so a shownAt written in the meantime survives.
       - Write `{ version: 1, checkedAt: now(), latest: result?.latest ?? prev?.latest ?? null, enginesNode: result ? result.enginesNode : (prev?.enginesNode ?? null), shownAt: prev?.shownAt ?? null }`.
       - Catch everything, so there is no unhandled rejection in the daemon.
     - `computeStatus(cache, install)` (internal):
       - No cache or a null latest → unknown.
       - Not newer → current.
       - Otherwise available. nodeTooOld comes from nodeFloor(enginesNode) and nodeBelowFloor against deps.nodeVersion, with have = deps.nodeVersion.
     - `hint()`:
       - Return null if `updateCheckBlockedBy(deps.env, true)` is non-null. The client already passed the TTY half of the gate.
       - Read the cache. If it is missing or `now - checkedAt >= UPDATE_CHECK_INTERVAL_MS`, start `void refresh()` and do not await it.
       - Await the memoized install, then compute the status and run formatUpdateHint.
       - If the line is non-null and (shownAt is null or `now - shownAt >= UPDATE_HINT_INTERVAL_MS`), write shownAt = now and return the line; otherwise return null.
       - The final read-decide-write runs synchronously after the install await (discretion 3).
     - `status({ isTTY, refresh })`:
       - A blocked gate returns `{ state: 'blocked', reason }`.
       - Otherwise, if the cache is stale and refresh is true, await refresh(). It is bounded by the fetch timeout.
       - Return the computed status. It never touches shownAt.

4) Edit src/contracts/ipc.ts.
   - Add the request variant `z.object({ kind: z.literal('update-hint') })`. Its comment: the client sends it only after its env + TTY gate; old daemons drop the unknown kind and the client times out to no hint; replied with `update-hint`.
   - Add the response variant `z.object({ kind: z.literal('update-hint'), hint: z.string().max(200).nullable().catch(null) })`. Keep the 200 literal in ipc.ts with a comment naming UPDATE_HINT_MAX, because contracts import nothing from shared.
   - No pong flag: a new build id already replaces older daemons (quick 261030-tq3).

5) Edit src/daemon/server.ts.
   - Add `updates?: { hint(): Promise<string | null> }` to DaemonServerOptions.
   - Add `case 'update-hint':` that runs `Promise.resolve().then(() => options.updates?.hint() ?? null).catch(() => null).then((hint) => { writeJson({ kind: 'update-hint', hint }); void appendDebugLog('daemon', 'replied update-hint', { shown: hint !== null }); })`. Keep the socket handler inside the Promise chain (cerebrum Daemon/IPC) and never log the hint text.
   - Add the `{kind:'update-hint'}` line to the header comment list.

6) Edit src/cli/commands/daemon.ts. Where the server options are assembled, after the telemetry buffer and not at module top level:
   - Build `createUpdateChecker` with:
     - `env: process.env`
     - `cacheFile: join(updateCacheDir({ env: process.env, platform: process.platform, homeDir: os.homedir() }), UPDATE_CACHE_FILE_NAME)`
     - `fetchImpl: fetch`, `now: Date.now`
     - `currentVersion: __QUEQUE_VERSION__`, `nodeVersion: process.versions.node`
     - `detectInstall: () => detectInstall()`
   - Pass it as `updates`.

7) Edit src/client/run-foreground.ts, in the `llm` branch only. The fixture and cancel modes send nothing.
   - Right after the ensureDaemon try/catch, start `const updateHintRead: Promise<string | null>`:
     - If `updateCheckBlockedBy(process.env, process.stdout.isTTY === true) === null`, it is `requestDaemonOnce(socketPath, { kind: 'update-hint' }, UPDATE_HINT_REQUEST_TIMEOUT_MS)` mapped to `reply?.kind === 'update-hint' ? reply.hint : null`, with `.catch(() => null)`.
     - Otherwise it is `Promise.resolve(null)`.
   - It is NEVER awaited on the path to render or result write: `??` never waits on it.
   - Inside the render Promise:
     - Keep `let updateHint: string | undefined` and `let lastView` = the last `[candidates, errorState, listState]` passed to buildCandidateElement. Update lastView on every render/rerender call.
     - buildCandidateElement passes `updateHint` as a prop.
     - On `updateHintRead.then(h => …)`: if h is non-null and not `resolved`, set updateHint and `app.rerender(buildCandidateElement(...lastView))`.
   - Import requestDaemonOnce from '../cli/commands/telemetry.js'.

8) Edit src/ui/CandidateSelect.tsx.
   - Add the optional prop `updateHint?: string`, with a doc comment: once-a-day dim update line, selection-independent.
   - Render it right after `<ControlsLine />` and before the dev footer as `{updateHint !== undefined && (<Box flexShrink={0}><Text dimColor wrap="truncate">{updateHint}</Text></Box>)}`. Ink 7 Text takes no layout props (cerebrum). ControlsLine itself stays prop-less.
   - Add `updateHint` to the layout object and to the effect deps.

9) Edit src/ui/modal-layout.ts. Add `updateHint?: string` to CandidateSelectLayoutInput. In estimateCandidateSelectLines, after the two ControlsLine lines, add `if (input.updateHint !== undefined) lines += 1;` with the comment `// update hint: one truncated row, no margin`. The Zellij pane height then includes it.

10) In vitest.config.ts, add `env: { QQ_NO_UPDATE_CHECK: '1' }` to the `test` block. Add the same to vitest.live.config.ts's `test` block: it is a fresh config and does not merge. That way every worker, and every daemon/CLI child it spawns, inherits the opt-out. Tests that exercise the gate pass their own env objects.

Commit, with no Co-Authored-By trailer (user rule). Run `pnpm exec biome check` on the changed files first. Message: `feat(daemon): check npm for a newer qq once a day and show a dim hint in ??`. The body says why, with lines of 100 chars max.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/update-check.test.ts tests/update-hint-ipc.test.ts tests/modal-layout.test.ts tests/candidate-select-layout.test.tsx tests/candidate-select.test.tsx tests/telemetry-ipc.test.ts && pnpm typecheck</automated>
  </verify>
  <done>Every Task 1 behavior test passes and typecheck is clean. A daemon given an `updates` checker answers `update-hint` over the real socket. The client requests the hint after ensureDaemon without awaiting it before render, and CandidateSelect renders the dim truncated row under ControlsLine, which the estimator counts as exactly one row. vitest runs with QQ_NO_UPDATE_CHECK=1. Committed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: detectInstall covers every spec row (volta, pnpm, nvm, fnm, npm, nix, dpkg, rpm suse/fedora, pacman repo/AUR, WSL) with exact hint copy</name>
  <files>src/shared/install-detect.ts, src/shared/update-check.ts, tests/install-detect.test.ts, tests/update-check.test.ts</files>
  <behavior>
    Write these first in tests/install-detect.test.ts. Every case uses fake deps: realpath returns the given path, plus readFile, isWritable, a runOwnerQuery spy and readOsRelease. HOME is /home/u on linux and /Users/u on darwin.
    - brew macOS: /opt/homebrew/Cellar/queque/0.10.5/libexec/lib/node_modules/@k-leumas/queque-cli/dist/cli/app.js → brew, 'brew upgrade queque'. brew Linux: /home/linuxbrew/.linuxbrew/Cellar/queque/0.10.5/libexec/... → the same. runOwnerQuery is never called
    - volta: /home/u/.volta/tools/image/packages/@k-leumas/queque-cli/lib/node_modules/@k-leumas/queque-cli/dist/cli/app.js → volta, 'volta install @k-leumas/queque-cli'. VOLTA_HOME=/opt/volta with a path under it → volta
    - pnpm: PNPM_HOME=/Users/u/Library/pnpm and path /Users/u/Library/pnpm/global/5/.pnpm/@k-leumas+queque-cli@0.10.5/node_modules/@k-leumas/queque-cli/dist/cli/app.js → pnpm, 'pnpm add -g @k-leumas/queque-cli'. The same path with PNPM_HOME unset → pnpm (the /pnpm/global/ segment)
    - nvm: /home/u/.nvm/versions/node/v24.14.1/lib/node_modules/@k-leumas/queque-cli/dist/cli/app.js → nvm, 'npm i -g @k-leumas/queque-cli@latest', note 'this Node version only'
    - fnm: /home/u/.local/share/fnm/node-versions/v24.14.1/installation/lib/node_modules/@k-leumas/queque-cli/dist/cli/app.js → fnm, the same command and note. FNM_DIR=/opt/fnm with a path under it → fnm
    - user npm prefix: /home/u/.npm-global/lib/node_modules/@k-leumas/queque-cli/dist/cli/app.js, writable → npm, the npm command, no note, runOwnerQuery not called
    - system npm: /usr/lib/node_modules/@k-leumas/queque-cli/dist/cli/app.js on linux, all three owner queries {ok:false}, isWritable false → npm, the npm command, note 'set a user npm prefix first, not sudo'. The command never contains 'sudo npm'
    - darwin /usr/local/lib/node_modules/@k-leumas/queque-cli/dist/cli/app.js → npm, and runOwnerQuery is never called
    - nix: /nix/store/abc123-queque-0.10.5/lib/node_modules/@k-leumas/queque-cli/dist/cli/app.js → nix, upgradeCommand null
    - dpkg: /usr/lib/queque/dist/cli/app.js; dpkg -S → {ok:true, stdout:'queque: /usr/lib/queque/dist/cli/app.js'} → apt, 'sudo apt install --only-upgrade queque', packaged true. rpm and pacman are not queried after the dpkg hit
    - rpm on suse: dpkg fails; `rpm -qf --qf %{NAME}\n <path>` → 'queque'; os-release ID="opensuse-tumbleweed" ID_LIKE="opensuse suse" → zypper, 'sudo zypper up queque', packaged
    - rpm on fedora: ID=fedora → dnf, 'sudo dnf upgrade queque'. ID="rocky" ID_LIKE="rhel centos fedora" → dnf. An unknown rpm distro (ID=mageia) → rpm, null command, packaged
    - pacman repo: dpkg and rpm fail; `pacman -Qoq <path>` → 'queque'; `pacman -Qm queque` {ok:false} → pacman, 'sudo pacman -Syu', packaged
    - pacman AUR: as above but `pacman -Qm queque` {ok:true} → aur, null command, note 'update via your AUR helper', packaged
    - Owner not named queque (dpkg stdout 'nodejs-queque: /usr/…') → apt, null command, packaged (discretion 6)
    - WSL: linux, execPath /mnt/c/Program Files/nodejs/node.exe → windows-node, null command (checked before the marker)
    - unknown: /home/u/src/queque/dist/cli/app.js → unknown, null
    In tests/update-check.test.ts, add the formatUpdateHint row for each method, with latest 0.11.0:
    - brew → 'qq 0.11.0 available · brew upgrade queque'
    - nvm → 'qq 0.11.0 available · npm i -g @k-leumas/queque-cli@latest (this Node version only)'
    - system npm, non-writable → '… (set a user npm prefix first, not sudo)'
    - nix → null
    - apt → 'upstream qq 0.11.0 released; your package may not have it yet · sudo apt install --only-upgrade queque'
    - aur → 'upstream qq 0.11.0 released; your package may not have it yet · update via your AUR helper'
    - packaged with a null command and no note → 'upstream qq 0.11.0 released; your package may not have it yet · update it with your package manager'
    - windows-node → 'qq 0.11.0 available · this qq runs on a Windows Node; install Node inside WSL'
    - every line is at most 200 chars and has no control chars
  </behavior>
  <action>
Extend detectInstall in src/shared/install-detect.ts. Do not restructure it. This task runs about 15-20 min. The final rule order follows the spec:
- (a) WSL first: when platform is linux and `deps.execPath` matches `^/mnt/[a-z]/`, return `{ method: 'windows-node', upgradeCommand: null, packaged: false }`. This is the spec's out-of-scope note, discretion 12.
- (b) The marker rule from Task 1.
- (c) /Cellar/queque/ brew from Task 1.
- (d) volta: `real` starts with `${env.VOLTA_HOME || homeDir + '/.volta'}/` → 'volta install @k-leumas/queque-cli'.
- (e) pnpm: `env.PNPM_HOME` is set and `real` starts with it + '/', or `real` contains '/pnpm/global/' → 'pnpm add -g @k-leumas/queque-cli'.
- (f) nix: `real` starts with '/nix/store/' → `{ method: 'nix', upgradeCommand: null }`.
- (g) nvm: under `${env.NVM_DIR || homeDir + '/.nvm'}/`, or contains '/.nvm/versions/node/' → method nvm with the npm command and note 'this Node version only'.
- (h) fnm: under `${env.FNM_DIR}/` when set, or contains '/fnm/node-versions/' → method fnm with the same command and note.
- (i) npm global: contains `/lib/node_modules/${NPM_PACKAGE}/` and does NOT start with '/usr/' → method npm, command `npm i -g ${NPM_PACKAGE}@latest`.
- (j) Unmatched '/usr/' paths: on linux only, run the owner queries in order and stop at the first ok one. On darwin skip straight to (k).
  - `dpkg -S <real>`: the owner is the text before the first ':'. → apt, `sudo apt install --only-upgrade queque`.
  - `rpm -qf --qf %{NAME}\n <real>`: the owner is the trimmed stdout. Classify readOsRelease's ID and ID_LIKE tokens (unquoted, space-split): any token containing 'suse' → zypper, `sudo zypper up queque`; any of fedora/rhel/centos → dnf, `sudo dnf upgrade queque`; else rpm with a null command.
  - `pacman -Qoq <real>`: the owner is the trimmed first line. Then `pacman -Qm queque`: ok → aur, null command, note 'update via your AUR helper'; else pacman, `sudo pacman -Syu`.
  - Every owner hit is `packaged: true`. If the parsed owner name is not exactly 'queque', keep that method but set upgradeCommand null (discretion 6).
  - Pass argv arrays only: no shell, and the path is a single argv element.
  - No hit → fall through to (k).
- (k) The npm fallback for unowned /usr paths: method npm with the npm command.
- (l) Else unknown.

For every npm-command result in (g), (h), (i) and (k), find the global node_modules dir: the prefix of `real` up to and including the `/node_modules` segment just before `/@k-leumas/`. If `deps.isWritable(dir)` is false, add the note 'set a user npm prefix first, not sudo', joined to any existing note with '; ' (discretion 8). Never emit a sudo npm command.

In src/shared/update-check.ts, finish formatUpdateHint:
- packaged with a null command → use the note when present ('update via your AUR helper'), else 'update it with your package manager'.
- windows-node → `qq ${latest} available · this qq runs on a Windows Node; install Node inside WSL`.
- Keep nix → null.

Pin every row with the tests above. Commit with no Co-Authored-By trailer: `feat(update): name the upgrade command for each install method` (body ≤ 100-char lines, after biome on the changed files).
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/install-detect.test.ts tests/update-check.test.ts && pnpm typecheck</automated>
  </verify>
  <done>Every spec acceptance row has a passing detectInstall test with faked realpaths, markers and owner-command outputs: brew mac/linux, volta, pnpm, nvm, fnm, system npm, user npm, nix, dpkg, rpm on suse and fedora, pacman repo and AUR, WSL and unknown. Owner queries run only for unmatched /usr paths on Linux, and the first hit wins. formatUpdateHint has a pinned line per method, every line 200 chars max. Committed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: `qq doctor` update row, Homebrew .install-source marker, distro CI opt-out, engines floor, README + PRIVACY docs, wolf records and the full suite on a tty</name>
  <files>src/contracts/doctor.ts, src/cli/commands/doctor.ts, tests/doctor.test.ts, tests/install-marker-formula.test.ts, package.json, .github/workflows/release.yaml, .github/workflows/homebrew.yml, scripts/smoke-homebrew-docker.sh, scripts/docker-homebrew-smoke-runner.sh, scripts/ci/test-in-distro.sh, scripts/smoke-distro.sh, scripts/smoke-distro-runner.sh, README.md, docs/PRIVACY.md, .planning/todos/done/2026-11-15-update-notifier.md, .wolf/anatomy.md, .wolf/memory.md, .wolf/cerebrum.md</files>
  <behavior>
    - doctor, zsh report: 13 rows (was 12); `update` is second to last and `telemetry` still last. Linux bash: 13. macOS bash: 14 (was 13). Update every existing count assertion
    - DOCTOR_CHECK_IDS: 'update' is appended as the last id; slice(0, 12) still equals ZSH_IDS (add, never rename)
    - Row per updateStatus:
      - blocked QQ_NO_UPDATE_CHECK → ok 'update check off (QQ_NO_UPDATE_CHECK is set)'; CI → ok 'update check off (CI is set)'; not a terminal → ok 'update check off (not a terminal)'
      - unknown → ok 'latest version unknown (registry not reached yet)'
      - current → ok 'qq 0.10.5 is the latest'
      - available brew → warn 'qq 0.11.0 available (installed via brew)', hint 'brew upgrade queque'
      - available npm non-writable → hint 'npm config set prefix ~/.local, then npm i -g @k-leumas/queque-cli@latest (not sudo)'
      - available unknown → hint 'see https://github.com/k-leumas/queque/releases'
      - available nix → warn 'qq 0.11.0 available (installed via nix)', hint 'update it through nix'
      - packaged apt → warn 'upstream qq 0.11.0 released (installed via apt); your package may not have it yet', hint 'sudo apt install --only-upgrade queque'
      - aur → hint 'update via your AUR helper'
      - nodeTooOld → warn 'qq 0.11.0 needs Node 26+; you have 24.14.1', hint 'upgrade Node first'
      - updateStatus throws → ok 'update check failed'
      Every row passes doctorReportSchema (200 chars max). `ok` stays true, because no update state is fail
    - tests/install-marker-formula.test.ts: release.yaml and homebrew.yml each contain exactly one `.install-source").write '<json>'` line; both JSON strings are byte-identical, parse with installMarkerSchema, and equal {source:'homebrew', upgrade:'brew upgrade queque'}; scripts/smoke-homebrew-docker.sh writes the same JSON
  </behavior>
  <action>
This task runs about 20-30 min, plus 2-10 min for each full-suite run.

1) In src/contracts/doctor.ts:
   - Append 'update' to the END of DOCTOR_CHECK_IDS. Ids are stable: add, never rename or reorder.
   - Extend the contract comment's allowed strings: the update row may carry version numbers, a fixed upgrade command, or the install marker's validated upgrade text (printable ASCII, 120 chars max). Never a path or environment value.

2) In src/cli/commands/doctor.ts:
   - Add `updateStatus(): Promise<UpdateStatus>` to DoctorDeps.
   - defaultDoctorDeps builds `createUpdateChecker({ env, cacheFile: join(updateCacheDir({ env, platform, homeDir }), UPDATE_CACHE_FILE_NAME), fetchImpl: fetch, now: Date.now, currentVersion: __QUEQUE_VERSION__, nodeVersion: process.versions.node, detectInstall: () => detectInstall() })` lazily inside the dep function. It calls `.status({ isTTY: process.stdout.isTTY === true, refresh: true })` (discretion 11).
   - Add `checkUpdate(deps)` with the exact copy from the behavior list. Install label = `install.source ?? install.method` for markers, else `install.method`.
     - The hint comes from upgradeCommand plus note. The npm non-writable case uses the spelled-out doctor hint (discretion 8).
     - A missing command uses the releases or nix or AUR copy.
     - It catches a throwing updateStatus.
   - Insert it in runDoctorChecks between checkNode and checkTelemetry, started in the Promise.all next to daemon/provider so its up-to-1.5 s refresh overlaps the other probes.
   - Update the runDoctorChecks doc comment's row list.
   - In tests/doctor.test.ts:
     - Add `updateStatus: async () => ({ state: 'current', current: '0.10.5' })` to the `healthyDeps` fixture (cerebrum 2026-11-14: grep tests for hand-built DoctorDeps fixtures and fix all of them).
     - Update the 12/13 counts to 13/14.
     - Add the row tests.
     - The 'defaultDoctorDeps (real machine, read-only)' block stays offline because vitest sets QQ_NO_UPDATE_CHECK=1.

3) Homebrew marker:
   - In BOTH `install: |` blocks (.github/workflows/release.yaml and .github/workflows/homebrew.yml), add this line right after the `system "npm", "install", *std_npm_args, …` line, byte-identical in both files: `(libexec/"lib/node_modules/@k-leumas/queque-cli/.install-source").write '{"source":"homebrew","upgrade":"brew upgrade queque"}'`.
   - In scripts/smoke-homebrew-docker.sh's quoted-heredoc RUN block (the formula emulation), add after the npm install line `printf '%s' '{"source":"homebrew","upgrade":"brew upgrade queque"}' >"$libexec/lib/node_modules/@k-leumas/queque-cli/.install-source"; \`, and update the emulation comment to list the marker write.
   - The npm tarball never contains the marker: package.json `files` is dist/shell/README/LICENSE. Leave that unchanged.
   - Write tests/install-marker-formula.test.ts per the behavior list. Read the files with readFileSync from the repo root and use installMarkerSchema from src/shared/install-detect.ts.

4) Distro CI and smoke opt-out:
   - scripts/ci/test-in-distro.sh: add `-e QQ_NO_UPDATE_CHECK=1` to the docker run.
   - scripts/smoke-distro.sh: add `-e QQ_NO_UPDATE_CHECK=1` next to the other `-e` flags.
   - scripts/smoke-distro-runner.sh: add `export QQ_NO_UPDATE_CHECK=1` to both rc writes (the .zshrc printf near line 116 and the .bashrc printf near line 150), because as_user may not pass the container env through.
   - scripts/smoke-homebrew-docker.sh: add `-e QQ_NO_UPDATE_CHECK=1` to its docker run.
   - scripts/docker-homebrew-smoke-runner.sh: add `export QQ_NO_UPDATE_CHECK=1` next to `export QQ_TELEMETRY=0`, with a one-line comment.
   - The hint never shows in any expect smoke, so no expect pattern changes (cerebrum 2026-10-30: grep scripts/ for expect and confirm every expect-driven run has the opt-out).

5) In package.json, add `"engines": { "node": ">=24" }` after `bin` (discretion 9).

6) Docs:
   - In README.md, under `## More`, add one bullet directly after the Privacy bullet: `- Update check: once a day the background daemon asks the npm registry for the latest qq and shows one dim line in ?? when a newer one exists. Turn it off with \`export QQ_NO_UPDATE_CHECK=1\` (it is also off when \`CI\` is set or there is no terminal); details in [Privacy](https://github.com/k-leumas/queque/blob/main/docs/PRIVACY.md#update-check).`
   - In docs/PRIVACY.md, add `## Update check` directly before `## Anonymous telemetry`. It covers:
     - what is sent: one HTTPS GET of `https://registry.npmjs.org/@k-leumas/queque-cli/latest` with no query text, no install id and no custom headers; npm sees your IP like any npm install
     - when: at most once per 24 h, from the daemon, only after a `??` in a terminal
     - the cache file location per OS
     - how the upgrade command is chosen: the install marker or install path; on Linux, for /usr installs only, the local dpkg/rpm/pacman owner queries, which never leave the machine
     - the opt-outs: QQ_NO_UPDATE_CHECK, CI, no terminal
     - the hint shows at most once a day
   - Keep the README short (cerebrum Docs). tests/readme-badges.test.ts must stay green.

7) Move .planning/todos/pending/2026-11-15-update-notifier.md to .planning/todos/done/ with `git mv`.

8) OpenWolf (cerebrum Do-Not-Repeat 2026-11-15):
   - Add anatomy entries for src/shared/update-check.ts, src/shared/install-detect.ts, tests/update-check.test.ts, tests/update-hint-ipc.test.ts, tests/install-detect.test.ts and tests/install-marker-formula.test.ts.
   - Append short notes to the entries of every touched file.
   - Restore any curated anatomy lines the post-write hook rewrote, using HEAD's text, and drop `auto-detected` buglog noise.
   - Append the session lines to .wolf/memory.md.
   - Add one cerebrum Key Learning. Content: the update check is daemon-side and triggered only by a gated TTY client; the cache plus shownAt live in update-check.json; detectInstall answers who installed qq, never pickInstaller; the formula marker lives in both workflow install blocks and the smoke emulation; every Docker smoke and test container needs QQ_NO_UPDATE_CHECK=1.
   - Stage .wolf/ with the code.

9) Gates before the commit:
   - `pnpm exec biome check` on the changed files, `actionlint .github/workflows/release.yaml .github/workflows/homebrew.yml` and `pnpm typecheck`.
   - Then the FULL suite twice: `pnpm test:run`, and on a pty like the pre-push hook, `script -q /dev/null pnpm test:run`. Each takes 2-10 min.
   - A timing test that fails under load is rerun alone on an idle machine, never loosened (cerebrum 2026-10-10).
   - Commit with no Co-Authored-By trailer: `feat(doctor): add the update row, homebrew install marker and opt-out docs`. The subject starts lower-case; body lines are 100 chars max. Do not push.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/doctor.test.ts tests/install-marker-formula.test.ts tests/readme-badges.test.ts tests/shell-names-invariant.test.ts && actionlint .github/workflows/release.yaml .github/workflows/homebrew.yml && pnpm typecheck && pnpm lint && pnpm test:run</automated>
  </verify>
  <done>
- `qq doctor` and `qq doctor --json` show the `update` row before `telemetry` for every state, and the schema validates.
- Both formula install blocks and the smoke emulation write the identical marker JSON, guarded by a test.
- Every Docker test and smoke path sets QQ_NO_UPDATE_CHECK=1.
- package.json declares engines.node >=24.
- README and PRIVACY document the check and its opt-out.
- The todo is moved to done/ and the wolf records are updated.
- The full suite is green both plain and on a pty.
- Committed.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| npm registry → daemon | Untrusted JSON (version, engines.node) over HTTPS. Its text reaches the user's terminal and the doctor JSON |
| package dir → daemon/doctor | The `.install-source` marker file content is printed as a command |
| cache dir → daemon/doctor | update-check.json is read back on every hint/status |
| daemon → system binaries | dpkg/rpm/pacman are spawned with the install path as an argument |
| doctor JSON → public PR bodies | The auto-revert PR embeds doctor.json (D-18) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261117jpp-01 | Tampering | fetchLatestRelease → hint text | medium | mitigate | version must match SEMVER_RE (64 chars max); engines.node must be printable ASCII (64 chars max) or it becomes null; the hint is built from fixed copy plus validated values and truncated to 200; the IPC schema caps hint at 200 |
| T-261117jpp-02 | Tampering | `.install-source` marker | medium | mitigate | installMarkerSchema strictObject: source /^[a-z0-9][a-z0-9._-]{0,31}$/, upgrade printable ASCII, 120 chars max; any invalid marker is ignored and the path rules apply |
| T-261117jpp-03 | Tampering | update-check.json cache | low | mitigate | dir must be a real 0700 dir owned by getuid (launcher isPrivateDirectory pattern); file 0600 via tmp + rename; strict zod read, so an invalid cache counts as missing |
| T-261117jpp-04 | Information disclosure | registry GET | low | accept | npm sees the IP and that qq checked; no identifiers, no query text, once per 24 h; documented in PRIVACY.md with the QQ_NO_UPDATE_CHECK opt-out and the CI/non-TTY skip |
| T-261117jpp-05 | Denial of service | `??` latency | high | mitigate | the fetch runs in the daemon in the background with a 1.5 s AbortSignal timeout; the client's IPC ask is capped at 500 ms and never awaited before render or result write; refreshes are deduped |
| T-261117jpp-06 | Elevation of privilege | owner queries | medium | mitigate | spawn with argv arrays only (no shell), stdin ignored, LC_ALL=C, 2 s kill, stdout capped at 4 KB; Linux only and only for unmatched /usr paths; never emits a sudo npm command (user-prefix note instead) |
| T-261117jpp-07 | Information disclosure | doctor update row | low | mitigate | fixed copy plus validated versions, fixed commands or the validated marker text; no paths or env values; CI skips the check, so revert PR bodies show `update check off (CI is set)` |
| T-261117jpp-SC | Tampering | npm/pip/cargo installs | high | mitigate | no new dependencies: the semver compare is a small local function, not the `semver` package; no install tasks in this plan |
</threat_model>

<verification>
- `pnpm exec vitest run tests/update-check.test.ts tests/update-hint-ipc.test.ts tests/install-detect.test.ts tests/install-marker-formula.test.ts tests/doctor.test.ts tests/modal-layout.test.ts` passes
- `pnpm typecheck`, `pnpm lint`, and `actionlint .github/workflows/release.yaml .github/workflows/homebrew.yml` are clean
- `pnpm test:run` and `script -q /dev/null pnpm test:run` (pty, like pre-push) both pass
- `grep -c "QQ_NO_UPDATE_CHECK" vitest.config.ts vitest.live.config.ts scripts/ci/test-in-distro.sh scripts/smoke-distro.sh scripts/smoke-homebrew-docker.sh scripts/docker-homebrew-smoke-runner.sh` reports at least 1 per file, and `grep -c "QQ_NO_UPDATE_CHECK" scripts/smoke-distro-runner.sh` reports at least 2
- `grep -c "install-source" .github/workflows/release.yaml .github/workflows/homebrew.yml` reports 1 per file
- Manual spot check (optional, on a dev build with QQ_NO_UPDATE_CHECK unset): write update-check.json with latest 99.0.0 and checkedAt now. The next `??` shows one dim line under the controls, and the following `??` does not
</verification>

<success_criteria>
- Every behavior from the spec's Behavior, Install-method detection and Acceptance sections is covered by a passing test:
  - the detectInstall rows: brew mac/linux, volta, pnpm, nvm, system npm, nix, dpkg, rpm suse/fedora, pacman repo/AUR, unknown
  - the 24 h cache, offline/timeout silence, the opt-out env, the non-TTY skip, the engines mismatch message and once-per-day display
- `??` never awaits the network; the hint arrives over a new IPC kind from the daemon
- `qq doctor` shows the update row; README and PRIVACY document the opt-out
- The Homebrew formula writes `.install-source` in both release.yaml and homebrew.yml
- vitest and every distro/Homebrew container run with QQ_NO_UPDATE_CHECK=1
- Three atomic commits on feat/update-notifier, none with a Co-Authored-By trailer, all passing commitlint
</success_criteria>

<output>
Create `.planning/quick/261117-jpp-implement-update-notifier-per-planning-t/261117-jpp-SUMMARY.md` when done
</output>
