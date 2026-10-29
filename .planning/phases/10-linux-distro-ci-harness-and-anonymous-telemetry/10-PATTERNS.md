# Phase 10: Linux distro CI harness and anonymous telemetry - Pattern Map

**Mapped:** 2026-10-29
**Files analyzed:** 27
**Analogs found:** 23 / 27

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `.github/workflows/ci.yml` (new) | config (CI) | event-driven | `.github/workflows/release.yaml` | role-match |
| `.github/workflows/distro.yml` (new, workflow_call) | config (CI) | batch | `.github/workflows/release.yaml` | role-match |
| `.github/workflows/nightly.yml` (new) | config (CI) | batch | `.github/workflows/release.yaml` (env secret line 13-14) | role-match |
| `scripts/ci/install-distro-deps.sh` (new, POSIX sh) | utility | batch | `scripts/docker-homebrew-smoke-runner.sh` | partial |
| `scripts/ci/auto-revert.sh` (new) | utility | request-response (gh API) | none | no analog |
| `scripts/ci/changes.*` (path filter) | utility | transform | `scripts/changed-files-from-base.mjs` (`resolveBaseRef` l.28, `changedFilesFromBase` l.51) | exact (reuse) |
| `scripts/smoke-distro.sh` (new) | utility | file-I/O / docker | `scripts/smoke-homebrew-docker.sh` | exact |
| `scripts/smoke-distro-runner.sh` (new) | utility | batch | `scripts/docker-homebrew-smoke-runner.sh` | exact |
| `scripts/smoke-distro.exp` (new) | test (PTY) | event-driven | expect heredoc in `scripts/docker-homebrew-smoke-runner.sh` l.28-74 | exact |
| `package.json` (mod: `smoke:distro`) | config | - | existing `scripts` block l.25-26 | exact |
| `tsup.config.ts` (mod: telemetry key/host define) | config | - | `tsup.config.ts` l.52-55 | exact |
| `src/env.d.ts` (mod) | config | - | `src/env.d.ts` l.1-2 | exact |
| `src/daemon/bootstrap.ts` (mod: `listenerPids` busybox fix) | service | request-response | itself l.187-201 | self |
| `shell/zsh/queque.zsh` (mod: mktemp guard ~l.372) | utility | file-I/O | itself | self |
| `src/contracts/telemetry.ts` (new) | model (zod) | transform | `src/providers/provider-pin.ts` l.55-80 (`z.strictObject`) + `src/contracts/ipc.ts` | exact |
| `src/contracts/doctor.ts` (new) | model (zod) | transform | `src/contracts/ipc.ts` | role-match |
| `src/contracts/ipc.ts` (mod: fire-and-forget `telemetry-event` request) | model | request-response | itself l.9-36 (`shutdown` entry) | self |
| `src/shared/telemetry-config.ts` (new) | utility/store | file-I/O | `src/providers/provider-pin.ts` `writeProviderPin` l.175-199; `src/shared/qq-config.ts` `defaultConfigPath` l.105-112 | exact |
| `src/shared/qq-config.ts` (mod: `telemetry` key) | config | file-I/O | itself l.60-76 (`effortSchema ... .optional().catch(undefined)`) | self |
| `src/daemon/telemetry-buffer.ts` (new) | service | batch / outbound HTTP | `src/providers/detect.ts` l.52-61 (`fetch` + `AbortSignal.timeout`) | partial |
| `src/daemon/server.ts` (mod: handle telemetry event, flush on shutdown) | service | request-response | itself l.94-135 switch | self |
| `src/cli/commands/doctor.ts` (new) | controller (CLI) | request-response | `src/cli/commands/init-provider.ts` | role-match |
| `src/cli/commands/telemetry.ts` (new) | controller (CLI) | CRUD (config) | `src/cli/commands/init-provider.ts` + `src/cli/main.ts` l.37-44 | role-match |
| `src/cli/main.ts` (mod: register doctor, telemetry) | route | - | itself l.37-52 | self |
| `src/client/run-foreground.ts` (mod: consent prompt + outcome event) | component | event-driven | itself l.140-144 (`/dev/tty` open), init-provider tty IO | self |
| `tests/telemetry-*.test.ts`, `tests/doctor.test.ts`, `tests/lsof-busybox.test.ts` | test | - | `tests/provider-pin.test.ts` (QQ_CONFIG_FILE + mkdtemp l.52-56) | exact |
| `tests/prewarm-sleep.test.ts` | test | event-driven | `tests/claude-prewarm.test.ts` l.194-198 (kill child from outside) | exact |
| `tests/live/sdk-contract.live.ts` + `vitest.live.config.ts` | test | request-response | none (no live config exists) | no analog |

## Pattern Assignments

### `.github/workflows/ci.yml` / `distro.yml` / `nightly.yml`
**Analog:** `.github/workflows/release.yaml` l.10-40 — copy the `checks` job steps verbatim:
```yaml
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - name: Install shell test dependencies
        run: sudo apt-get update && sudo apt-get install -y zsh jq
      - run: pnpm install --frozen-lockfile
      - name: Lint
        run: pnpm lint
      - name: Type check
        run: pnpm typecheck
      - name: Test
        run: pnpm test:run
```
Deviations (RESEARCH §CI Workflow Design): add `env: LEFTHOOK: 0`, `timeout-minutes: 15`, `pnpm build`. Do NOT put `ANTHROPIC_API_KEY` in ci.yml/distro.yml (D-01); only the nightly live job uses `${{ secrets.ANTHROPIC_API_KEY }}` (release.yaml l.13-14 shape) and guards against forks. No `setup-node` in container legs (Alpine musl); use `install-distro-deps.sh`. No third-party actions (paths-filter, create-pull-request, alls-green).

### `scripts/smoke-distro.sh` / `smoke-distro-runner.sh` / `smoke-distro.exp`
**Analog:** `scripts/smoke-homebrew-docker.sh` l.1-40 (bash header, `usage()` heredoc, `-h/--help`):
```bash
#!/usr/bin/env bash
set -euo pipefail
IMAGE_NAME="${IMAGE_NAME:-queque-homebrew-smoke:local}"
usage() { cat <<'EOF' ... EOF }
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then usage; exit 0; fi
```
Differences: take `<image>` positional + `--out`; no API key reading (drop `read_env_local_key`); D-16 `docker info` check -> warn on stderr, exit 0; mount `tests/fixtures/fake-claude-stream.mjs` (not in package `files`).
**Runner analog:** `scripts/docker-homebrew-smoke-runner.sh` — expect block l.28-74: `set timeout 75`, staged `expect { ... }` with distinct `exit 10/11/12/13/14` per assertion, `expect eof`, outer `exit 20` on setup failure (l.19). Copy the distinct-exit-code convention; runner must be POSIX `sh` (Alpine has no bash by default); add `log_file -noappend /out/pty-<pass>.log`, `set timeout 40`.

### `scripts/ci/changes` path filter
**Reuse:** `scripts/changed-files-from-base.mjs` exports `resolveBaseRef()` (l.28) and `changedFilesFromBase()` (l.51); import rather than reimplement. Fail open to `code=true`.

### `src/contracts/telemetry.ts` / `src/contracts/doctor.ts`
**Analog:** `src/providers/provider-pin.ts` l.55-76:
```ts
export const providerPinSchema = z.discriminatedUnion('provider', [
  z.strictObject({ version, provider: z.literal('claude') }),
  z.strictObject({ version, provider: z.literal('openai'), model: modelName.optional() }),
  ...
]);
export type ProviderPin = z.infer<typeof providerPinSchema>;
```
Use `z.strictObject` at every level (strictness = allow-list guard, same rationale as the pin's secrets guard comment l.55-61), enums for all values, `discriminatedUnion('event', ...)` for event families (errors / query outcome / env shape; no latency per D-11). Doctor schema: stable `{ ok, checks: [{ id, status: 'pass'|'warn'|'fail', detail, hint }] }`.

### `src/contracts/ipc.ts` (add telemetry request)
**Analog (self):** l.30-36 `shutdown` entry shows how a new kind was added with back-compat note ("Old daemons ignore the unknown kind"). Add `z.object({ kind: z.literal('telemetry-event'), event: telemetryEventSchema })`; no response needed (fire-and-forget). Advertise via `pong` capability flag like `providerPin: true` (server.ts l.96-103).

### `src/shared/telemetry-config.ts`
**Path:** reuse `defaultConfigPath()` from `src/shared/qq-config.ts` l.105-112 (honours `QQ_CONFIG_FILE`).
**Atomic write analog:** `src/providers/provider-pin.ts` l.175-199:
```ts
mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
const temp = `${target}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
try {
  writeFileSync(temp, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  chmodSync(temp, 0o600);
  renameSync(temp, target);
} catch (error) {
  try { unlinkSync(temp); } catch { /* already renamed, or never created */ }
  throw error;
}
```
Must read-modify-write preserving other keys (privacy/safety/effort) and be uncached (NOT `loadQqConfig()`, which caches at l.171-174). Env gates `DO_NOT_TRACK`, `QQ_TELEMETRY=0`, `CI` force off.

### `src/shared/qq-config.ts` (mod)
**Self l.64-76:** add `telemetry: telemetryConfigSchema.optional().catch(undefined)` to `qqConfigFileSchema`, mirroring `effortSchema`'s `.optional().catch(undefined)` so a bad block never drops privacy patterns.

### `src/daemon/telemetry-buffer.ts`
**Fetch analog:** `src/providers/detect.ts` l.52-61:
```ts
try {
  const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(300) });
  return res.ok;
} catch { return false; }
```
Swallow all errors, drop batch (D-07). Empty baked key -> never call fetch (D-22). Timer must `.unref()`. Logging via `appendDebugLog('daemon', '...', {...})` as in server.ts. Keep `lastSentBody` in memory for `qq telemetry show`.

### `src/daemon/server.ts` (mod)
**Self l.94-118:** add a `case 'telemetry-event'` in the `switch (req.kind)`; unknown/invalid lines already ignored via `ipcRequestSchema.safeParse` (l.85-89). Flush in the `shutdown` path before `onShutdown()` (l.107-118, ack-then-shutdown ordering).

### `src/cli/commands/doctor.ts` / `telemetry.ts` + `src/cli/main.ts`
**Registration analog:** `src/cli/main.ts` l.37-52:
```ts
cli
  .command('init <shell>', 'Add shell integration ...')
  .action(async (shell: string) => { await dispatchInit(shell); });
```
Add `.command('doctor').option('--json', ...)` and `.command('telemetry [action]')` (status|on|off|show). Set `process.exitCode = 1` only on D-17/D-19/D-20 blockers.
**Command module analog:** `src/cli/commands/init-provider.ts` l.1-80 — imports with `.js` suffix from `../../shared/...`, injectable `PickerIo { input; output }` and `PickerDeps` interfaces for testability, constants for user-facing copy at top. Reuse `socketPath()` (`src/shared/socket-path.ts`), `detectProvider()` (`src/providers/detect.ts`), `loadProviderPin()` for warning-level provider check.

### `src/client/run-foreground.ts` (consent prompt, D-09)
**Self l.140-144:** `const ttyHandle = await fsp.open('/dev/tty', 'r+').catch(() => null);` — prompt only if a tty handle exists; never stdout (08 D-05; init-provider header comment l.22-26). Default No; persist both answers. Outcome event sent after `replace-buffer` result written (l.182).

### `src/daemon/bootstrap.ts` `listenerPids` (fix)
**Self l.187-201** (current, broken on busybox lsof):
```ts
const out = execFileSync('lsof', ['-t', socketPath], { encoding: 'utf8', timeout: 1000, stdio: ['ignore','pipe','ignore'] });
return out.split(/\s+/).map((s) => Number.parseInt(s, 10)).filter((n) => Number.isInteger(n) && n > 0 && n !== process.pid);
```
Fix must validate output is PID-only and actually refers to the socket path; on unexpected format return `[]`. Test in `tests/lsof-busybox.test.ts` by mocking `execFileSync`.

### Tests
- Config isolation: `tests/provider-pin.test.ts` l.4, 52-56 (`vitest` imports; `beforeEach` with `fs.mkdtempSync(join(tmpdir(), 'qq-pin-'))` + `QQ_CONFIG_FILE`).
- Prewarm sleep (D-04): `tests/claude-prewarm.test.ts` l.194-198 ("misses with dead after the idle child is killed from outside") — extend with SIGSTOP/SIGCONT and `vi.useFakeTimers()`.
- Root containers: keep `it.skipIf(process.getuid?.() === 0)` (tests/bundle-startup.test.ts:189, tests/zsh-widget.test.ts:829).

## Shared Patterns

### Build-time constants
**Source:** `tsup.config.ts` l.52-55 + `src/env.d.ts` l.1-2
```ts
define: { __QUEQUE_COMMIT__: JSON.stringify(commit), __QUEQUE_VERSION__: JSON.stringify(version) },
declare const __QUEQUE_VERSION__: string;
```
Apply to: telemetry key/host (`__QUEQUE_TELEMETRY_KEY__` = `''` per D-22), version field in env-shape event and doctor.

### Strict zod + fail-closed
**Source:** provider-pin.ts l.55-76; qq-config.ts l.64-76. Apply to all new contracts/config.

### TTY-only interaction
**Source:** init-provider.ts l.22-26, run-foreground.ts l.140-144. Apply to consent prompt; `qq doctor`/`qq telemetry` print to stdout (non-interactive) is fine.

### Debug logging
**Source:** `appendDebugLog('daemon', msg, data)` in server.ts. Apply to telemetry buffer (never log payload contents beyond counts).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `scripts/ci/auto-revert.sh` | utility | gh API | No gh-CLI automation exists; use RESEARCH §Auto-revert |
| `scripts/ci/install-distro-deps.sh` | utility | batch | No per-distro package logic exists; use RESEARCH §Distro Install Matrix |
| `tests/live/sdk-contract.live.ts`, `vitest.live.config.ts` | test | request-response | No live/separate vitest config yet |
| `src/daemon/telemetry-buffer.ts` | service | batch | No outbound batching/timer service; only partial fetch analog |

## Metadata
**Analog search scope:** `.github/workflows`, `scripts/`, `src/`, `tests/`, `tsup.config.ts`, `lefthook.yml` (all git-tracked)
**Files scanned:** ~20
**Pattern extraction date:** 2026-10-29
