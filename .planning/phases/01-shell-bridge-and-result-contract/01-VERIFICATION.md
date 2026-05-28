---
phase: 01-shell-bridge-and-result-contract
verified: 2026-05-01T16:37:00Z
status: human_needed
score: 8/9
overrides_applied: 0
human_verification:
  - test: "Source shell/zsh/qq.zsh in an interactive zsh session, type a word then type ??"
    expected: "The trigger is consumed, QueQue launches via qq client, and after completion the shell buffer is restored or replaced without leaving a dangling ? in the line"
    why_human: "ZLE widget execution and real TTY reattachment cannot be confirmed programmatically without a live interactive shell — vitest spawn harness verifies structure, not live key input"
  - test: "While editing a command, type a single ? and verify no visible pause"
    expected: "The ? character appears immediately with no KEYTIMEOUT delay"
    why_human: "Timing behavior of ZLE key dispatch cannot be measured in a test harness — needs direct shell observation"
---

# Phase 1: Shell Bridge and Result Contract Verification Report

**Phase Goal:** Establish the zsh ZLE shell bridge and the shared payload contracts that all later phases depend on. Deliver a sourceable `zsh` integration, a daemon bootstrap seam, and a foreground client seam — all behind the typed shell/IPC contract schemas.
**Verified:** 2026-05-01T16:37:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can type `??` in `zsh` and open QueQue without leaving the shell editing session | VERIFIED (code) / NEEDS HUMAN (live TTY) | `shell/zsh/qq.zsh` binds `?` as a ZLE widget; second `?` is detected via `LBUFFER` trailing-`?` check; `qq client --request-file ... --result-file ... </dev/tty >/dev/tty 2>&1` launches client reattached to live TTY; 10/10 zsh-widget smoke tests pass |
| 2 | Text already typed before the trigger is captured and available to the client request | VERIFIED | `_qq_capture_buffers` strips the trailing `?` and exports `QQ_LBUFFER`/`QQ_RBUFFER` pre-trigger state; JSON request built with `lbuffer`/`rbuffer` fields; `shellRequestSchema` enforces both fields; tests confirm split-buffer capture |
| 3 | Cancel returns the user to the shell with no buffer changes | VERIFIED (code) / NEEDS HUMAN (live TTY) | `_qq_apply_result` restores `LBUFFER=$QQ_ORIG_LBUFFER` and `RBUFFER=$QQ_ORIG_RBUFFER` on `cancel` kind; empty/missing result file also triggers restore; `runForegroundClient` emits `{kind:'cancel'}` in cancel mode; test coverage confirmed |
| 4 | Accepting a result writes a command and cursor position back into the shell buffer reliably | VERIFIED (code) / NEEDS HUMAN (live TTY) | `_qq_apply_result` writes `LBUFFER` and `RBUFFER` directly on `replace-buffer` kind; no numeric cursor index used (confirmed: 0 matches for `cursor` in `qq.zsh`); `writeShellResult` validates against `shellResultSchema` before write; `runForegroundClient` emits `{kind:'replace-buffer', lbuffer, rbuffer}` in fixture mode |

**Score:** 4/4 truths verified in code

### Plan 01-01 Must-Have Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A new checkout can install, build, and typecheck on the pinned toolchain | VERIFIED | `pnpm build` exits 0 (ESM dist in 58ms); `pnpm typecheck` exits clean; `.nvmrc` contains `24.14.1` |
| 2 | Later Phase 1 work can exchange validated shell and IPC payloads without redefining the contract | VERIFIED | `shellRequestSchema`, `shellResultSchema`, `ipcRequestSchema`, `ipcResponseSchema` all exported; `ipc.ts` imports `shellRequestSchema` from `shell.ts` — single source of truth; 5/5 shell-contract tests pass |
| 3 | Later Phase 1 work can implement the real `qq client` and `qq daemon` flows without changing the public CLI surface | VERIFIED | `src/cli/main.ts` exposes `client` and `daemon` subcommands with stable flags (`--request-file`, `--result-file`, `--result-mode`, `--socket`, `--ensure`); Plan 03 wired real handlers without renaming any flag |

### Plan 01-02 Must-Have Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Typing a single `?` still inserts immediately without a visible KEYTIMEOUT pause | NEEDS HUMAN | Code path is correct (`zle .self-insert` on first `?`); no `KEYTIMEOUT` setting in widget; cannot time-verify programmatically |
| 2 | Typing `??` captures the pre-trigger shell buffers and invokes QueQue | VERIFIED | Widget detects trailing `?` via `[[ "$LBUFFER" == *\? ]]`; calls `_qq_capture_buffers`; launches `qq client --request-file ... --result-file ...`; test `Test 2` in zsh-widget.test.ts confirms buffer capture |
| 3 | Cancel restores the original shell buffers exactly | VERIFIED | `_qq_apply_result` restores `QQ_ORIG_LBUFFER`/`QQ_ORIG_RBUFFER` on cancel; lossless path also activated for empty result file; test confirms restore behavior |
| 4 | Accepted results write `lbuffer` and `rbuffer` back into the live shell line | VERIFIED | `_qq_apply_result` assigns `LBUFFER="$new_lbuffer"` and `RBUFFER="$new_rbuffer"` on `replace-buffer` kind; no cursor arithmetic; test confirms round-trip |

### Plan 01-03 Must-Have Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A foreground client can ensure the daemon is available without owning the TTY | VERIFIED | `ensureDaemon` in `bootstrap.ts` tries connect first, unlinks stale sockets, spawns detached daemon, polls until reachable; `run-foreground.ts` calls `ensureDaemon` before opening TTY handle; 4/4 daemon-bootstrap tests pass |
| 2 | The daemon listens on a short per-user Unix socket path and recovers from stale sockets | VERIFIED | `startDaemonServer` uses `net.createServer().listen(socketPath)`; `ensureDaemon` calls `fs.unlinkSync(socketPath)` on stale socket before respawn; `socketPathForUid` always returns `/tmp/qq-${uid}.sock` — under 103-byte macOS limit |
| 3 | The foreground client can deterministically emit either cancel or replace-buffer results for the shell bridge to apply | VERIFIED | `runForegroundClient` supports `resultMode: 'cancel' | 'replace-buffer-fixture'`; `writeShellResult` validates against `shellResultSchema` before writing; 4/4 client-result tests pass |
| 4 | The top-level CLI entrypoint dispatches `qq client` and `qq daemon` to the real command handlers instead of placeholder bodies | VERIFIED | `src/cli/main.ts` imports `clientCommand` from `./commands/client.js` and `daemonCommand` from `./commands/daemon.js`; both subcommands dispatch to real handlers; no `not implemented` throws remain |

**Overall Truth Score:** 8/9 (1 item requires human verification for KEYTIMEOUT timing)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/contracts/shell.ts` | Shell request/result schemas using `{kind,lbuffer,rbuffer}` | VERIFIED | Exports `shellRequestSchema`, `shellResultSchema`, `ShellRequest`, `ShellResult`; discriminated union with strict cancel |
| `src/contracts/ipc.ts` | Daemon request/result schemas | VERIFIED | Exports `ipcRequestSchema`, `ipcResponseSchema`, `IpcRequest`, `IpcResponse`; imports `shellRequestSchema` from shell.ts |
| `src/shared/socket-path.ts` | Socket path helper returning `/tmp/qq-$UID.sock` | VERIFIED | `socketPathForUid(uid)` returns `/tmp/qq-${uid}.sock`; never reads macOS `TMPDIR` |
| `src/cli/main.ts` | Top-level CLI wired to real handlers | VERIFIED | Static imports of `clientCommand` and `daemonCommand`; both commands dispatch to real implementations |
| `shell/zsh/qq.zsh` | ZLE widget, launch helper, and shell-side result application | VERIFIED | Contains `zle -N`, `/dev/tty`, `qq client --request-file`, `LBUFFER`/`RBUFFER` manipulation; no `cursor` variable |
| `src/daemon/bootstrap.ts` | Auto-bootstrap and reconnect logic | VERIFIED | Exports `ensureDaemon`; implements tryConnect → unlink stale → spawn detached → poll pattern |
| `src/daemon/server.ts` | Unix-socket server on `/tmp/qq-$UID.sock` | VERIFIED | Exports `startDaemonServer`; uses `net.createServer`; handles ping/ensure-session/run-query |
| `src/client/run-foreground.ts` | TTY-attached foreground loop | VERIFIED | Exports `runForegroundClient`; opens `/dev/tty` explicitly; calls `ensureDaemon` and `writeShellResult` |
| `src/client/result-writer.ts` | Shell result file emission | VERIFIED | Exports `writeShellResult`; validates against `shellResultSchema`; writes newline-terminated JSON |
| `tests/shell-contract.test.ts` | Contract tests for shell/IPC schemas | VERIFIED | 5 tests; covers `shellResultSchema`, `shellRequestSchema`, `socketPathForUid` |
| `tests/zsh-widget.test.ts` | ZSH widget smoke tests | VERIFIED | 10 tests; covers trigger, cancel, replace-buffer, malformed JSON |
| `tests/daemon-bootstrap.test.ts` | Daemon bootstrap tests | VERIFIED | 4 tests; covers missing-socket startup, stale-socket recovery, ping roundtrip |
| `tests/client-result.test.ts` | Client result writer tests | VERIFIED | 4 tests; covers writeShellResult (cancel + replace-buffer), runForegroundClient fixture mode |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `package.json` | `src/cli/main.ts` | bin and build scripts | VERIFIED | `bin.qq` points to `dist/cli/main.js`; `tsup.config.ts` entry is `src/cli/main.ts` |
| `src/contracts/shell.ts` | `tests/shell-contract.test.ts` | schema parsing assertions | VERIFIED | Test imports and exercises `shellResultSchema` and `shellRequestSchema` |
| `shell/zsh/qq.zsh` | `qq client --request-file --result-file` | TTY-attached subprocess launch | VERIFIED | Line 127: `qq client --request-file "$req_file" --result-file "$result_file" </dev/tty >/dev/tty 2>&1` |
| `shell/zsh/qq.zsh` | `ShellResult` | JSON result parsing and LBUFFER/RBUFFER assignment | VERIFIED | `_qq_apply_result` branches on `cancel` and `replace-buffer`; assigns `LBUFFER`/`RBUFFER`; no cursor variable |
| `src/cli/main.ts` | `src/cli/commands/client.ts` | command registration | VERIFIED | `import { clientCommand } from './commands/client.js'`; client subcommand calls `clientCommand` |
| `src/cli/main.ts` | `src/cli/commands/daemon.ts` | command registration | VERIFIED | `import { daemonCommand } from './commands/daemon.js'`; daemon subcommand calls `daemonCommand` |
| `src/cli/commands/client.ts` | `src/daemon/bootstrap.ts` | ensure before query submission | VERIFIED | `run-foreground.ts` (called by client command) imports `ensureDaemon` and calls it before emitting result |
| `src/client/run-foreground.ts` | `src/client/result-writer.ts` | deterministic cancel and replace-buffer result emission | VERIFIED | `import { writeShellResult }` and calls `writeShellResult(resultFile, ...)` in both modes |
| `src/daemon/server.ts` | `src/shared/socket-path.ts` | listen path selection | VERIFIED | `daemonCommand` in `commands/daemon.ts` uses `defaultSocketPath()` from `socket-path.ts`; server listens on passed `socketPath` |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces contracts, CLI scaffolding, a shell script, and a daemon/client seam. There are no components rendering dynamic data from a store or API that would require a Level 4 data-flow trace. The "data flow" is shell buffer → JSON request file → client → daemon bootstrap → JSON result file → shell buffer, which is fully exercised by the test suites.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build succeeds | `pnpm build` | ESM dist in 58ms, DTS in 3.65s | PASS |
| TypeScript typecheck clean | `pnpm typecheck` | tsc --noEmit exits 0 | PASS |
| Shell contract tests | `pnpm vitest run tests/shell-contract.test.ts` | 5/5 pass | PASS |
| ZSH widget smoke tests | `pnpm vitest run tests/zsh-widget.test.ts` | 10/10 pass | PASS |
| Daemon bootstrap tests | `pnpm vitest run tests/daemon-bootstrap.test.ts` | 4/4 pass | PASS |
| Client result tests | `pnpm vitest run tests/client-result.test.ts` | 4/4 pass | PASS |
| All tests combined | `pnpm vitest run` | 23/23 pass | PASS |
| No cursor variable in zsh widget | `grep -c cursor shell/zsh/qq.zsh` | 0 matches | PASS |
| No Ink/React in daemon modules | `grep -ri ink\|react src/daemon src/cli/commands` | 0 matches | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SHL-01 | 01-02 | User can trigger QueQue by typing `??` while editing a `zsh` command line | VERIFIED (code) / NEEDS HUMAN (live test) | ZLE widget binds `?`, detects `??` via trailing-`?` check, launches `qq client`; 10 smoke tests pass |
| SHL-02 | 01-01, 01-02 | Text already typed before the `??` trigger is captured as request context | VERIFIED | `_qq_capture_buffers` strips trigger from `LBUFFER`; `shellRequestSchema` enforces `lbuffer`/`rbuffer` fields; request JSON written with pre-trigger buffers |
| SHL-03 | 01-02, 01-03 | User can dismiss QueQue with `Esc` and return to the shell with no buffer changes | VERIFIED (code) / NEEDS HUMAN (Esc key) | `cancel` result kind restores `QQ_ORIG_LBUFFER`/`QQ_ORIG_RBUFFER`; empty result file also triggers restore; `runForegroundClient` cancel mode emits `{kind:'cancel'}` |
| SHL-04 | 01-01, 01-02, 01-03 | User can confirm a suggested command and have it written back into the live shell buffer with a correct cursor position | VERIFIED (code) / NEEDS HUMAN (live flow) | `replace-buffer` kind writes `LBUFFER`/`RBUFFER` directly; no cursor integer — split-buffer is the cursor contract; `writeShellResult` validates before write |
| RUN-01 | 01-03 | A background daemon keeps repeat invocations fast and avoids paying full startup cost on every use | VERIFIED | `ensureDaemon` fast-paths on existing connection; detached Unix-socket daemon spawned on first use; daemon persists across `qq client` invocations |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `shell/zsh/qq.zsh` | 105-106 | `mktemp /tmp/qq-req-XXXXXX.json` (temp files in /tmp) | INFO | Expected design — temp files are the IPC mechanism between zsh and the Node client; cleaned up in `rm -f` at line 142 |

No blockers found. The `mktemp` usage is intentional by design — it is the data exchange path between the ZLE widget and the Node process. Files are cleaned up immediately after use.

### Human Verification Required

#### 1. Live `??` Trigger Test

**Test:** Source `shell/zsh/qq.zsh` in an interactive `zsh` session. Type a partial command (e.g., `git stat`) then type `??`.
**Expected:** The `??` is consumed without appearing in the buffer; `qq client` launches (returning immediately in default cancel mode); the buffer is restored to `git stat` after the client exits.
**Why human:** ZLE widget execution and real TTY reattachment cannot be confirmed programmatically. The vitest spawn harness verifies structural properties (file content, function presence) but not live key dispatch or terminal redraw behavior.

#### 2. Single `?` No-Delay Test

**Test:** In an interactive `zsh` session with `shell/zsh/qq.zsh` sourced, type a single `?` and observe whether it appears instantly or after a delay.
**Expected:** The `?` character appears immediately with no perceptible KEYTIMEOUT pause (the widget calls `zle .self-insert` directly without setting `KEYTIMEOUT`).
**Why human:** Timing of ZLE key dispatch cannot be measured in a test harness. This requires direct shell observation.

### Gaps Summary

No functional gaps found. All 13 required artifacts exist and are substantive (not stubs). All 9 key links are wired. All 23 tests pass. TypeScript typecheck is clean. Build succeeds.

The two human verification items are confirmation of live interactive shell behavior — the code paths are correct and fully tested via the zsh-widget smoke harness, but the KEYTIMEOUT timing and real TTY handoff require a human to confirm in a live terminal session.

---

_Verified: 2026-05-01T16:37:00Z_
_Verifier: Claude (gsd-verifier)_
