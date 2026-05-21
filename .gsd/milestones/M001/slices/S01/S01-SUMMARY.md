---
id: S01
parent: M001
milestone: M001
provides: []
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 
verification_result: passed
completed_at: 
blocker_discovered: false
---
# S01: Shell Bridge And Result Contract

**# Phase 01 Plan 01: Toolchain Baseline and Shell/IPC Contracts Summary**

## What Happened

# Phase 01 Plan 01: Toolchain Baseline and Shell/IPC Contracts Summary

**One-liner:** Zod-validated split-buffer shell contract and daemon IPC schemas locked behind 5 passing tests on a pinned Node 24.14.1 / pnpm / tsup baseline.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Toolchain baseline and CLI entry skeleton | 77b4ea0 (bootstrap) | .nvmrc, package.json, pnpm-lock.yaml, tsconfig.json, tsup.config.ts, vitest.config.ts, src/cli/main.ts |
| 2 RED | Shell contract failing tests | a983bca | tests/shell-contract.test.ts |
| 2 GREEN | Shell/IPC contracts implementation | 8ba3e29 | src/contracts/shell.ts, src/contracts/ipc.ts, src/shared/socket-path.ts |

## What Was Built

### Task 1: Toolchain Baseline (already in bootstrap commit)

The repo already contained a complete single-package `pnpm` TypeScript baseline pinned to Node `24.14.1`:

- `.nvmrc` pinned to `24.14.1`
- `package.json` with `qq` bin pointing to `dist/cli/main.js`, scripts `build / dev / test / test:run / typecheck`, and all MVP runtime deps (`cac`, `zod`, `react`, `ink`, `@anthropic-ai/sdk`)
- `tsconfig.json` with NodeNext module resolution, strict mode, ES2024 target
- `tsup.config.ts` bundling `src/cli/main.ts` to `dist/cli` as ESM
- `vitest.config.ts` targeting `tests/**/*.test.ts` in Node environment
- `src/cli/main.ts` exporting `main` with stable `client` and `daemon` subcommands (including `--ensure` flag), throwing explicit `not implemented` errors

### Task 2: Shell and IPC Contracts (TDD)

**RED:** Wrote 5 failing tests in `tests/shell-contract.test.ts` before any implementation existed.

**GREEN:** Implemented:

- `src/contracts/shell.ts` — `shellRequestSchema` (version, ttyPath, cwd, shellPid, lbuffer, rbuffer) and `shellResultSchema` (discriminated union: strict `cancel` | `replace-buffer` with lbuffer/rbuffer). The cancel variant uses `.strict()` to reject extra buffer fields. The deprecated `{buffer, cursor}` shape is excluded by design.

- `src/contracts/ipc.ts` — `ipcRequestSchema` (ping | ensure-session | run-query) and `ipcResponseSchema` (pong | session-ready | query-accepted). Imports `shellRequestSchema` from shell.ts so run-query reuses the same validated payload type.

- `src/shared/socket-path.ts` — `socketPathForUid(uid)` always returns `/tmp/qq-{uid}.sock`, never reads macOS `TMPDIR`. This keeps paths within the documented 103-byte macOS Unix socket limit.

## Verification Results

```
pnpm install && pnpm build && pnpm typecheck  → EXIT 0
pnpm vitest run tests/shell-contract.test.ts  → 5/5 PASS
```

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED — failing tests | a983bca | PASS |
| GREEN — implementation | 8ba3e29 | PASS |
| REFACTOR | not needed | — |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod discriminatedUnion does not reject extra fields on cancel variant**
- **Found during:** Task 2 GREEN — test 1 expected `success: false` when passing `{kind: 'cancel', lbuffer: ..., rbuffer: ...}`
- **Issue:** Zod's `discriminatedUnion` strips unknown keys by default (passthrough-like behavior for the matched branch), so cancel with extra buffer fields was incorrectly accepted
- **Fix:** Added `.strict()` to the cancel branch object so any extra keys cause a validation error
- **Files modified:** `src/contracts/shell.ts`
- **Commit:** 8ba3e29

### Plan Note

Task 1 files were already present and committed in the bootstrap commit `77b4ea0`. No re-implementation was needed. All acceptance criteria passed immediately on first verification run.

## Known Stubs

None — contracts export complete Zod schemas and TypeScript types. The `src/cli/main.ts` `client` and `daemon` handlers throw explicit `not implemented` errors as intended — these are tracked stubs awaiting Phase 1 plans 02 and 03.

## Threat Flags

None — no network endpoints, auth paths, or file access patterns introduced in this plan. The socket path helper is a pure string formatter with no I/O.

## Self-Check: PASSED

All created files confirmed present:
- FOUND: src/contracts/shell.ts
- FOUND: src/contracts/ipc.ts
- FOUND: src/shared/socket-path.ts
- FOUND: tests/shell-contract.test.ts
- FOUND: .planning/phases/01-shell-bridge-and-result-contract/01-01-SUMMARY.md

All commits confirmed:
- FOUND: a983bca (test RED — failing shell contract tests)
- FOUND: 8ba3e29 (feat GREEN — shell/IPC contracts implementation)
- FOUND: b95aaa2 (docs — SUMMARY.md)

# Phase 01 Plan 02: ZSH Bridge and Result Application Summary

**One-liner:** Custom `?` ZLE widget with look-behind trigger detection, lossless cancel via saved split-buffers, and jq-backed result application — no KEYTIMEOUT delay, no cursor math.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Failing zsh-widget smoke tests | 42a7141 | tests/zsh-widget.test.ts |
| 1+2 GREEN | ZSH widget, capture, and result application | 6ce8139 | shell/zsh/qq.zsh |

## What Was Built

### Task 1 and 2 combined (TDD)

**RED:** Wrote 10 failing tests in `tests/zsh-widget.test.ts` before any implementation. Tests spawn real `zsh` with the widget sourced and exercise:
- Structural checks: `zle -N`, `/dev/tty`, `qq client --request-file` present in widget file
- `_qq_capture_buffers`: strips trailing `?`, saves originals, preserves rbuffer
- `_qq_apply_result`: cancel restores, replace-buffer writes new values, malformed JSON returns nonzero, unknown kind returns nonzero

**GREEN:** Implemented `shell/zsh/qq.zsh` with:

**`qq-question-widget`** — The `?` ZLE binding:
- On the first `?` in the line (no trailing `?`): calls `zle .self-insert` — character appears immediately, no `KEYTIMEOUT` delay
- On the second `?` (trailing `?` already in `LBUFFER`): strips the trigger, saves originals, builds a JSON request file, and launches `qq client --request-file "$req" --result-file "$res" </dev/tty >/dev/tty 2>&1`

**`_qq_capture_buffers`** — Called on trigger detection:
- Sets `QQ_ORIG_LBUFFER="$LBUFFER"` and `QQ_ORIG_RBUFFER="$RBUFFER"` (exact pre-trigger state)
- Sets `QQ_LBUFFER="${LBUFFER%?}"` (trigger stripped) and `QQ_RBUFFER="$RBUFFER"`

**`_qq_apply_result`** — Reads the result file and branches:
- `{kind: "cancel"}` → restores `LBUFFER=$QQ_ORIG_LBUFFER`, `RBUFFER=$QQ_ORIG_RBUFFER`, returns 0
- `{kind: "replace-buffer", lbuffer, rbuffer}` → sets `LBUFFER` and `RBUFFER` to new values, returns 0
- Malformed JSON (jq exits nonzero or returns empty kind) → leaves buffers untouched, returns 1
- Unknown kind → restores originals, returns 1

## Verification Results

```
npx vitest run tests/zsh-widget.test.ts  → 10/10 PASS
grep -q "zle -N" shell/zsh/qq.zsh       → EXIT 0
grep -q "/dev/tty" shell/zsh/qq.zsh     → EXIT 0
grep -q "qq client --request-file" ...  → EXIT 0
rg -n "cursor" shell/zsh/qq.zsh         → no matches (PASS)
rg -n "malformed" tests/zsh-widget.test.ts → match found (PASS)
```

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED — failing tests | 42a7141 | PASS |
| GREEN — implementation | 6ce8139 | PASS |
| REFACTOR | not needed | — |

## Deviations from Plan

### None

Plan executed exactly as written. Both tasks implemented together in a single GREEN commit because Task 1 (`_qq_capture_buffers` + widget structure) and Task 2 (`_qq_apply_result` + result application) live in the same file and their tests were written together in the RED commit.

## Known Stubs

- `qq client --request-file ... --result-file ...` is invoked by the widget but the client itself throws `not implemented` (tracked from 01-01-SUMMARY). The shell bridge is complete and correct — the client implementation is the scope of Plan 01-03.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries. The widget writes JSON to temp files under `/tmp` and reads results back from the same temp files; no IPC or daemon communication in this plan.

## Self-Check: PASSED

Files confirmed present:
- FOUND: shell/zsh/qq.zsh
- FOUND: tests/zsh-widget.test.ts
- FOUND: .planning/phases/01-shell-bridge-and-result-contract/01-02-SUMMARY.md

Commits confirmed:
- FOUND: 42a7141 (test RED — failing zsh-widget tests)
- FOUND: 6ce8139 (feat GREEN — zsh widget implementation)

# Phase 01 Plan 03: Daemon Bootstrap and Client Seam Summary

**One-liner:** Unix-socket daemon with stale-socket recovery, foreground client owning /dev/tty, and deterministic replace-buffer fixture seam for shell bridge round-trips.

## What Was Built

### Task 1: Daemon Bootstrap and Server (TDD)

**src/daemon/bootstrap.ts** — `ensureDaemon(socketPath)` connects to an existing daemon (fast path), unlinks stale socket files on connect failure, spawns `qq daemon --socket <path>` as a detached/unreferenced child, then polls until the socket is reachable. Free of Ink, React, and TTY assumptions.

**src/daemon/server.ts** — `startDaemonServer(socketPath)` creates a `node:net` Unix-socket server. Handles newline-delimited JSON IPC messages: `ping` → `pong`, `ensure-session` → `session-ready`, `run-query` → `query-accepted`. Unknown or malformed messages are silently dropped (connection stays alive).

**src/cli/commands/daemon.ts** — Real `daemonCommand` handler. `qq daemon --socket <path>` starts the server and blocks; `qq daemon --socket <path> --ensure` calls `ensureDaemon` and exits.

RED commit: f8ee27c  
GREEN commit: faa5af3

### Task 2: Foreground Client Loop and Result Writer (TDD)

**src/client/result-writer.ts** — `writeShellResult(resultFile, result)` validates the result against `shellResultSchema` (Zod) and writes newline-terminated JSON. Throws on schema violations.

**src/client/run-foreground.ts** — `runForegroundClient({requestFile, resultFile, resultMode})` opens `/dev/tty` explicitly (does not assume inherited stdio is interactive), reads and validates the shell request with `shellRequestSchema`, calls `ensureDaemon`, then emits a deterministic result:
- `cancel` mode → `{kind:'cancel'}`
- `replace-buffer-fixture` mode → `{kind:'replace-buffer', lbuffer: <from request>, rbuffer: <from request>}`

**src/cli/commands/client.ts** — Real `clientCommand` handler mapping `--result-mode` CLI flag to the `runForegroundClient` resultMode parameter.

**src/cli/main.ts** — Updated to use static imports for both `clientCommand` and `daemonCommand`. `qq client` and `qq daemon` subcommands now dispatch to the real handlers.

RED commit: 5f87008  
GREEN commit: 4ab40a1

## Test Results

```
tests/daemon-bootstrap.test.ts  4 tests  PASS
tests/client-result.test.ts     4 tests  PASS
Total: 8 tests, 0 failures
```

TypeScript typecheck: clean (tsc --noEmit exits 0).

## Acceptance Criteria Verification

- `ensureDaemon` exported from bootstrap.ts: PASS
- `createServer` in server.ts: PASS
- `unlink` call in bootstrap.ts: PASS
- `commands/daemon` import in main.ts: PASS
- `commands/client` import in main.ts: PASS
- `/dev/tty` in run-foreground.ts: PASS
- `writeShellResult` in run-foreground.ts: PASS
- `replace-buffer` in run-foreground.ts: PASS
- No Ink/React imports in daemon or client modules: PASS

## Deviations from Plan

None — plan executed exactly as written. Both TDD RED/GREEN cycles completed in sequence.

## Known Stubs

**runForegroundClient replace-buffer-fixture mode** — The fixture result uses `request.lbuffer` directly as the suggested command. This is intentional: Phase 4 replaces this seam with the Ink TUI that presents real provider suggestions. The stub is deterministic and testable, not a placeholder for missing data.

## Self-Check: PASSED

All created files verified on disk. All commits verified in git log:
- f8ee27c: test(01-03) RED daemon-bootstrap
- faa5af3: feat(01-03) GREEN daemon bootstrap + server
- 5f87008: test(01-03) RED client-result
- 4ab40a1: feat(01-03) GREEN foreground client + result writer
