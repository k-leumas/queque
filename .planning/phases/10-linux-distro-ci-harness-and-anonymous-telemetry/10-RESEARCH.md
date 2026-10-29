# Phase 10: Linux distro CI harness and anonymous telemetry - Research

**Researched:** 2026-10-28
**Domain:** GitHub Actions container CI, zsh PTY smoke testing, CLI diagnostics, privacy-safe product telemetry (PostHog capture API)
**Confidence:** HIGH for CI/distro facts (probed in Docker this session), MEDIUM for PostHog/GitHub semantics (official docs and source, not exercised live)

> Executors: do not `@`-include this whole file. Point `<read_first>` at the named sections you need
> (cerebrum: a 70 KB RESEARCH.md costs ~18k tokens per plan).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Live LLM in CI
- **D-01:** PR runs and the distro/smoke matrices never call a real model — they use `tests/fixtures/fake-claude-stream.mjs` as `claude`. Exactly one live job exists: a nightly Ubuntu job using an `ANTHROPIC_API_KEY` repo secret against the SDK path (CI cannot do Claude Code `/login`). It must not run on forked-PR events (secret exposure).
- **D-02:** Live job assertions are contract-level: ≥1 candidate arrives, it passes the zod candidate schema, no `request failed` / `response truncated` in the daemon log, and arrival is under a latency ceiling (Claude picks a generous value). Never assert the specific command text.
- **D-03:** Live job failure turns the nightly red and is NOT a required check — a provider outage must never block merges. No auto-issue.
- **D-04 (folded todo):** "Stale prewarm after laptop sleep" (09.1 IN-03) is covered by vitest simulation, run on every PR: SIGSTOP/SIGCONT the prewarmed child, kill it out from under the daemon, and advance fake timers; assert the next query detects the dead/stale process, runs cold, and re-prewarms. No container sleep simulation.

#### Telemetry backend
- **D-05:** PostHog Cloud **EU** (`eu.i.posthog.com`). No self-hosting. — **Reversibility:** costly — moving region later means a new project and losing history; shipped builds have the host baked in.
- **D-06:** Identity is a random install UUID generated at opt-in, stored in qq config, never derived from hostname/user/MAC. `qq telemetry off` deletes it.
- **D-07:** Transport is raw `fetch` to PostHog `/batch` from the daemon — no `posthog-node` dependency. In-memory buffer, flushed on interval and on daemon shutdown; on any failure the batch is dropped. No disk queue.
- **D-08:** The public `phc_` project key is baked into the build via tsup `define`; `QQ_TELEMETRY_HOST` and `QQ_TELEMETRY_KEY` env vars override it (tests, forks). — **Reversibility:** one-way — released binaries carry the key forever; rotating it orphans old installs' events.

#### Telemetry consent & payload
- **D-09:** The opt-in ask is a one-time `/dev/tty` prompt shown after the **first successful (accepted) `??`**: a single line, default **No**. Asked once ever; the answer (yes or no) persists in config. It never shows when there is no TTY, in CI, or when `DO_NOT_TRACK` / `QQ_TELEMETRY=0` / `CI` is set (those also force telemetry off regardless of config). `qq init zsh` stays silent and pipeable (carries forward 08 D-05). This replaces the roadmap's "opt-in at `qq init`".
- **D-10:** Allow-listed event families (and nothing else):
  - **Errors:** an error-kind enum (e.g. `auth_missing`, `provider_timeout`, `socket_failed`, `parse_failed`, …) + provider kind. No messages, no stack traces.
  - **Query outcome:** per `??` — `accepted` | `escaped` | `error`, candidate count, provider kind.
  - **Environment shape:** os, arch, distro id, zsh major.minor, qq version, node major, Zellij present (bool).
- **D-11:** Latency is **not** collected (not even bucketed) — the user excluded it.
- **D-12:** `qq telemetry show` prints the exact pending in-memory buffer plus the last sent batch (kept in memory only), byte-for-byte what leaves the machine.
- Carried from roadmap: strict zod allow-list in `src/contracts/telemetry.ts`; never prompts, buffers, commands, paths, env; vitest fails on any field outside the allow list; `qq telemetry status|on|off|show`.

#### Smoke gating (replaces roadmap item 3)
- **D-13:** No Docker smoke in lefthook pre-push. Pre-push keeps only its existing fast jobs (typecheck, lint changed, affected tests). The user asked to avoid local pre-push smoke and rely on remote CI.
- **D-14:** CI (checks + container matrix + smoke) triggers on **push to every branch** plus `pull_request`. Claude may add path filters to keep doc-only pushes off the smoke matrix and may dedupe push+PR runs on the same SHA.
- **D-15:** When the smoke fails on a push, the workflow opens an **auto-revert PR** against that branch reverting the offending commit(s). The PR body includes the failing distro(s), `qq doctor --json` output and the PTY log. Deterministic; no LLM fix attempt.
- **D-16:** The "warn and skip if Docker isn't running" answer was given before D-13 and is now moot; if any local smoke script entry remains (e.g. a `pnpm smoke:distro` convenience script), it warns and skips when Docker is unavailable.

#### qq doctor
- **D-17:** Exit 1 only on hard blockers that make `??` impossible: zsh missing/too old, socket path over the platform limit, no writable runtime dir/socket location. Missing provider, odd TERM, non-UTF-8 locale and conflicting widgets are warnings (exit 0) — so smoke runs with fake-claude pass and assert exit 0.
- **D-18:** Output is a ✓/⚠/✗ human checklist with a one-line fix hint per item, plus `--json` with a stable shape (consumed by smoke and by D-15 revert PR bodies; pasteable into bug reports).

### Claude's Discretion
- Exact pinned image tags for PR runs vs `:latest` nightly, and Alpine Node install details.
- Latency ceiling for D-02; flush interval/batch size for D-07.
- Exact error-kind enum values; exact prompt copy for D-09.
- How the auto-revert identifies the offending commit range (e.g. last green SHA on that branch → HEAD) and dedupes repeat revert PRs.
- Which checks are marked required in branch protection (checks + container matrix + smoke yes; live nightly no).

### Folded Todos
- **09.1 live check: stale prewarm after laptop sleep (IN-03)** (`2026-10-13-09.1-stale-prewarm-after-sleep.md`) — originally a manual live check; folded as vitest simulation per D-04.

### Deferred Ideas (OUT OF SCOPE)
- Latency telemetry (bucketed TTFC / time-to-done) — considered and excluded (D-11); revisit only with explicit user approval.
- Claude-authored fix PRs on smoke failure (claude-code-action) — considered, rejected in favour of deterministic auto-revert.
- Reviewed Todos (not folded): **09.1 live check: SDK path with a real ANTHROPIC_API_KEY** (`2026-10-13-09.1-sdk-path-live-check.md`) — user kept it as a manual todo. The D-01 nightly live job partially overlaps (SDK path, contract assertions) but does not cover the Esc-abort log check.
- Bash adapter (separate phase).
</user_constraints>

<phase_requirements>
## Phase Requirements

No REQUIREMENTS.md IDs are mapped to Phase 10 ("Requirements: TBD"). Coverage is derived from the ROADMAP scope and CONTEXT decisions. Suggested working IDs for plan frontmatter:

| ID | Description | Research Support |
|----|-------------|------------------|
| P10-CI | `ci.yml`: checks job + vitest-in-containers matrix (ubuntu 22.04/24.04, debian, fedora, arch, alpine) on push + PR; nightly `:latest` (D-14) | §CI Workflow Design, §Distro Install Matrix |
| P10-SMOKE | `scripts/smoke-distro.sh <image>` real zsh PTY with fake claude, from `pnpm pack`; `smoke` matrix job (D-01, D-16) | §Smoke Harness Design, Pattern 2 |
| P10-REVERT | Auto-revert PR on smoke failure on push (D-15) | §Auto-Revert Design |
| P10-DOCTOR | `qq doctor` + `--json` (D-17, D-18) | §qq doctor Design |
| P10-TEL | Opt-in telemetry: contract, consent, daemon buffer, `/batch` sender, `qq telemetry` cmds (D-05–D-12) | §Telemetry Design |
| P10-LIVE | Nightly live SDK contract job (D-01–D-03) | §Nightly + Live Job |
| P10-PREWARM | D-04 stale-prewarm vitest simulation | §D-04 Prewarm Simulation |
| P10-FIX | Linux portability bugs found by this research (busybox `lsof`, unguarded `mktemp`) | §Research-Discovered Defects |
</phase_requirements>

## Project Constraints (from CLAUDE.md, cerebrum, memory)

- Stack is locked: TypeScript on Node LTS, `pnpm`, `tsup`, `vitest`, `zod`, `cac`, `ink`. No new runtime dependencies for telemetry (D-07: raw `fetch`, no `posthog-node`).
- Safety: never auto-execute commands; return to buffer only.
- Interactive prompts go to `/dev/tty`, never stdout; `qq init zsh` stays non-interactive (08 D-05).
- Use "allow list" / "block list" terminology (memory).
- Never stub a dependency in a smoke/integration test to make it pass (cerebrum 2026-06-08, memory). The fake `claude` binary is the CONTEXT-sanctioned exception (D-01); shell, daemon, socket and TUI stay real.
- commitlint: subject must start lowercase (not an acronym or review ID), body lines ≤ 100 chars (cerebrum Do-Not-Repeat).
- Run biome on changed files before committing; commit `.wolf/` changes with code; no `Co-Authored-By` trailers (memory).
- Bash tool gotchas for executors: `rm`/`cp` are interactive aliases (use `/bin/rm -f`, `/bin/cp -f`); `git` may be a shell function (use `/usr/local/bin/git` when an exit status matters); zsh does not word-split `$LIST`.
- Timing-budget suites flake under high load; rerun a file alone before treating a failure as real (cerebrum 2026-10-17).
- Do not use `??` to resolve env secrets; use `usableSecret()` (cerebrum) — applies to `QQ_TELEMETRY_KEY`/`HOST` overrides too (empty string = unset).
- An invalid optional config key must not drop the whole config file (cerebrum 09.1-02 effort lesson): telemetry config keys use `.optional().catch(undefined)`.
- Always state time estimates for tasks/subagents (user preference).

## Summary

Phase 10 has two independent halves. The **CI half** (container matrix, PTY smoke, auto-revert, doctor) is mostly orchestration around code that already exists. Probing the real distro images in Docker this session showed that its value is real: on a stock Alpine image the current test suite **kills every process in the container**, because Alpine's `lsof` is busybox, which ignores `-t <path>` and lists every open file. `src/daemon/bootstrap.ts` `listenerPids()` then parses PIDs (and fd numbers) out of that output, and `replaceStaleListener()` SIGTERMs and SIGKILLs all of them. On a user's Alpine machine, any stale-daemon replacement (`ensureDaemon` replacing an old daemon, `qq init provider` restart) would signal every process the user owns. This must be fixed before the Alpine matrix can go green. The second discovery is that **`jq` is a hard runtime dependency** of `shell/zsh/queque.zsh` (request building and result parsing). Without it, `??` cannot work and 8 vitest cases fail on every distro image. Containers and smoke must install it, and `qq doctor` should treat it as a blocker.

The recommended CI shape: one `ci.yml` triggered on `push` (all branches) and `pull_request`. It has an in-job `changes` filter (never a workflow-level `paths-ignore`, which leaves required checks Pending), a `checks` job on the host, a reusable distro workflow that runs vitest via `container:` and the smoke via `docker run` from `scripts/smoke-distro.sh`, a single always-run `ci-ok` gate job as the only required check, and an `auto-revert` job on push failures. Install Node per distro: `apk add nodejs npm` on Alpine (24.22.1), `dnf install nodejs24 nodejs24-npm` on Fedora 44 (24.18.0), `pacman -S nodejs-lts-krypton npm` on Arch (24.22.1), and the official nodejs.org tarball pinned to `.nvmrc` on Ubuntu/Debian (distro Node is 12/18/20). Install pnpm with `npm i -g pnpm@12.6.0` everywhere; corepack is absent on Alpine and Arch, and pnpm 12.6.0 ships a `linux-x64-musl` binary. Drive the PTY with Tcl `expect`. It is in every distro's repo, needs no native build, and the existing Homebrew smoke runner already uses it.

The **telemetry half** is greenfield. A strict zod contract (`z.strictObject` everywhere, enums for every value) sits in `src/contracts/telemetry.ts`. Consent state is an uncached `telemetry` block in `~/.config/qq/config.json`, written atomically while preserving the user's other keys. The client produces outcome events and sends them to the daemon over a fire-and-forget IPC message. The daemon keeps an in-memory buffer and sends raw `fetch` POSTs to `https://eu.i.posthog.com/batch/` with `AbortSignal.timeout`. Each event carries `$process_person_profile: false` and `$geoip_disable: true`, and the PostHog project gets "Discard client IP data" enabled at setup.

**Primary recommendation:** Start with a defect-fix plus tracer plan. Fix `listenerPids` and the `mktemp` guard, add `scripts/ci/install-distro-deps.sh`, and run `scripts/smoke-distro.sh alpine:3.24` end to end. Then widen to the full matrix and `ci.yml`, then auto-revert. Build telemetry in parallel as contract → daemon sender/IPC/CLI → client consent/outcome.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Container test matrix, smoke matrix, gate, auto-revert | CI (GitHub Actions) | Repo scripts (`scripts/`) | Workflow YAML only orchestrates; all logic lives in scripts runnable locally (D-16) |
| Distro dependency install (node, zsh, jq, expect, git) | Repo script (`scripts/ci/install-distro-deps.sh`, POSIX sh) | — | Same script for CI container jobs, smoke runner, local docker |
| PTY drive of real zsh + widget + client + daemon | `expect` inside container | fake `claude` shim | Real shell/daemon/socket/TUI; only the model is faked (D-01) |
| `qq doctor` checks | CLI (`src/cli/commands/doctor.ts`) | `src/shared/*` helpers | Diagnostic runs in user's shell env; no daemon needed |
| Telemetry consent state | Shared config (`~/.config/qq/config.json`) | CLI `qq telemetry` | Persisted, user-editable, read uncached by client and daemon |
| Consent prompt (D-09) | Foreground client (`run-foreground.ts`) on `/dev/tty` | — | Only the client knows "first accepted ??" and owns the tty |
| Query-outcome/error event creation | Foreground client | Daemon (attaches error kind to `fetch-error`) | Accept/Esc known only in client; provider error class known in daemon |
| Event buffer + `/batch` send | Daemon (`src/daemon/telemetry-*.ts`) | — | Long-lived process (D-07); flush on interval and shutdown |
| Allow-list enforcement | Contract (`src/contracts/telemetry.ts`) | vitest | Single zod schema used by client, daemon and tests |

## Standard Stack

### Core (no new npm packages)
| Library/Tool | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` (existing) | 4.1.5 | Telemetry + doctor JSON contracts | Project's one validation layer [VERIFIED: package.json] |
| `cac` (existing) | 7.0.0 | `qq doctor`, `qq telemetry <sub>` commands | Existing CLI layer [VERIFIED: package.json] |
| Node built-in `fetch` + `AbortSignal.timeout` | Node 24 | PostHog `/batch` POST | D-07 forbids `posthog-node`; detect.ts already uses `AbortSignal.timeout(300)` [VERIFIED: src/providers/detect.ts:52-61] |
| Node `crypto.randomUUID()` | Node 24 | Install UUID (D-06) | Built-in, RFC 4122 v4 [ASSUMED] |
| Tcl `expect` | 5.45.4 on all six distros | PTY driver for smoke | In every distro repo, no native build; existing runner uses it [VERIFIED: docker probe, apt/dnf/pacman/apk] |
| `jq` | distro package | Runtime dep of the zsh widget | Widget builds request JSON and parses results with jq [VERIFIED: shell/zsh/queque.zsh:250,264,384-394] |

### CI actions (first-party only; no third-party actions)
| Action | Version used in repo | Latest | Purpose |
|--------|---------|---------|---------|
| `actions/checkout` | `@v6` (release.yaml) | v7.0.1 | Checkout (also inside containers) |
| `actions/setup-node` | `@v6` | v7.1.0 | Host `checks` job only (`node-version-file: .nvmrc`) |
| `pnpm/action-setup` | `@v6` | v6.1.0 | Host `checks` job only |
| `actions/upload-artifact` / `download-artifact` | — | upload v7.0.2 | Smoke PTY logs + doctor JSON for auto-revert body |

[VERIFIED: gh api repos/<action>/releases/latest this session]. Recommendation: keep `@v6` for checkout/setup-node/pnpm to match `release.yaml`; upgrading majors is a separate chore. Do **not** add `dorny/paths-filter`, `peter-evans/create-pull-request`, or `re-actors/alls-green`. Their logic is 10 lines of `git`/`gh`/shell, and third-party actions on a `contents: write` job are supply-chain risk.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `expect` | `node-pty` | Native addon; no musl prebuilds → build toolchain in every image. Rejected |
| `expect` | python `pty` | Python absent from base images; extra install everywhere. Rejected |
| `expect` | `script(1)` | util-linux vs busybox variants differ; no pattern matching. Rejected |
| `docker run` for vitest matrix | `container:` | `container:` chosen for vitest (native checkout/artifacts, root OK); `docker run` chosen for smoke (needs non-root user + local parity) |
| `actions/setup-node` in glibc containers | nodejs.org tarball via script | Script works identically locally (D-16) and in CI; verified on Debian 13 |
| GITHUB_TOKEN for revert PR | `secrets.GH_TOKEN` PAT (exists, used by semantic-release) | PAT makes the revert PR's CI run without approval but its push triggers CI on `auto-revert/*` (guarded). See Open Question 2 |

**Installation:** none (no npm additions). Distro packages are installed inside containers by `scripts/ci/install-distro-deps.sh`.

## Package Legitimacy Audit

This phase installs **no new npm packages**. `posthog-node` is explicitly excluded by D-07. In-container tools come from each distro's official repository: `nodejs`, `npm`, `nodejs24`, `nodejs24-npm`, `nodejs-lts-krypton`, `zsh`, `jq`, `expect`, `git`, `procps`, `curl`, `ca-certificates`, `xz-utils`. pnpm is the version already pinned in `packageManager`.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| pnpm@12.6.0 (existing pin) | npm | existing | existing | github.com/pnpm/pnpm | existing dependency | Approved (already in `packageManager`) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Research-Discovered Defects (must-fix, Wave 1)

### Defect 1 (CRITICAL): busybox `lsof` makes `replaceStaleListener` signal every process

Source, verbatim [VERIFIED: src/daemon/bootstrap.ts:187-201]:
```ts
function listenerPids(socketPath: string): number[] {
  try {
    const out = execFileSync('lsof', ['-t', socketPath], {
      encoding: 'utf8',
      timeout: 1000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split(/\s+/)
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isInteger(n) && n > 0 && n !== process.pid);
```
On Alpine 3.24, `/usr/bin/lsof -> /bin/busybox`, and `lsof -t /tmp/nothing.sock` prints every open file of every process, exit 0. Probe output this session:
```
lrwxrwxrwx    1 root     root            12 Oct 21 21:52 /usr/bin/lsof -> /bin/busybox
1	/bin/busybox	0	/dev/null
1	/bin/busybox	1	pipe:[4272030]
10	/bin/busybox	0	pipe:[4272044]
rc=0
```
`replaceStaleListener` (bootstrap.ts:216-255) runs `listenerPids` unconditionally after the IPC shutdown attempt, then SIGTERMs and SIGKILLs every parsed PID. Running `tests/daemon-bootstrap.test.ts` on `alpine:3.24` printed `Terminated` and killed the container's PID 1. Running the whole suite hung for more than 15 minutes because vitest workers were killed. [VERIFIED: docker probe, alpine:3.24]
**Fix:** accept `lsof` output only when every non-empty line matches `/^\d+$/`; otherwise return `[]` and log `lsof output ignored`. Test it with a fake `lsof` on `PATH` that prints busybox-format lines naming the PID of a sacrificial `sleep 30` child, and assert the child survives (a broken fix then kills only the sacrificial child, never the test runner).

### Defect 2 (MEDIUM): `jq` is a silent hard dependency
Without `jq`, `_qq_apply_result_str` cannot parse results and the request JSON is malformed. On `debian:13` and `alpine:3.24` without jq, `tests/zsh-widget.test.ts` (7 cases) and `tests/client-result.test.ts` (1 case) fail. With `apk add jq`, both files pass. [VERIFIED: docker probe; falsified by adding jq]. Release CI only passes because `release.yaml` runs `sudo apt-get install -y zsh jq` [VERIFIED: .github/workflows/release.yaml]. Action: install jq in every container and the smoke image. `qq doctor` should report a missing jq as ✗ (see Open Question 1, since D-17's enumerated list does not name it).

### Defect 3 (LOW): unguarded `mktemp -d` in the widget
Verbatim [VERIFIED: shell/zsh/queque.zsh:372-374]:
```zsh
  tmpdir=$(mktemp -d /tmp/qq-sess.XXXXXX)
  chmod 700 "$tmpdir"
  req_file="$tmpdir/request.json"
```
When `/tmp` was full in the probe container, `tmpdir` came back empty. The widget then wrote `/request.json` (`permission denied: /request.json` as a non-root user; as root it would write to `/` and drop `/commands.txt` etc. via `_qq_write_tool_handoff ""`). The client then failed with `ENOENT ... '/request.json'`. [VERIFIED: docker probe log]. Fix: `tmpdir=$(mktemp -d /tmp/qq-sess.XXXXXX 2>/dev/null) || { restore buffers; zle -M "queque: cannot create a temp dir in /tmp"; return 0; }` with a `[[ -d $tmpdir ]]` guard. `qq doctor`'s "/tmp writable" check covers the diagnosis.

## Distro Install Matrix (probed this session)

| Image (PR pin) | Node source | Node version | zsh | expect | corepack | Notes |
|------|------|------|------|------|------|------|
| `ubuntu:22.04` | nodejs.org tarball (`.nvmrc` 24.14.1) | apt has 12.22.9 (unusable) | 5.8.1 | 5.45.4 | n/a | glibc 2.35; needs `curl ca-certificates xz-utils` |
| `ubuntu:24.04` | nodejs.org tarball | apt has 18.19.1 (unusable) | 5.9 | 5.45.4 | n/a | |
| `debian:13` (= stable, trixie) | nodejs.org tarball | apt has 20.19.2 (unusable) | 5.9 | 5.45.4 | n/a | Full suite passed apart from jq cases |
| `fedora:44` | `dnf install nodejs24 nodejs24-npm` | 24.18.0 | 5.9 | 5.45.4 | n/a | Installs `node`, `npm` plus `node-24` aliases |
| `archlinux:latest` | `pacman -S nodejs-lts-krypton npm` | 24.22.1 | 5.9.2 | 5.45.4 | **absent** | `nodejs` pkg is 26.x; use `-lts-krypton`. Rolling: pinning image date does not pin packages |
| `alpine:3.24` | `apk add nodejs npm` | 24.22.1 | 5.9 | 5.45.4 | **absent** | musl; pnpm 12.6.0 has `@pnpm/exe.linux-x64-musl` |

[VERIFIED: docker probes of each image; `npm view pnpm@12.6.0 optionalDependencies`]. `ubuntu:26.04` (26.04.1 LTS) and `debian:latest` (= 13) exist. Nightly `:latest` tags therefore cover Ubuntu 26.04 automatically.

**Recommended PR pins:** `ubuntu:22.04`, `ubuntu:24.04`, `debian:13`, `fedora:44`, `archlinux:latest`, `alpine:3.24`.
**Nightly:** `ubuntu:latest`, `debian:latest`, `fedora:latest`, `archlinux:latest`, `alpine:latest` (plus optionally `fedora:rawhide`, `alpine:edge`).
**pnpm:** `npm install -g pnpm@12.6.0`. Read the version from `packageManager` (`pnpm@12.6.0+sha512…`) rather than hard-coding, e.g. `node -p "require('./package.json').packageManager.split('@')[1].split('+')[0]"`. Do not rely on corepack.
**Node tarball arch:** map `uname -m` (`x86_64→x64`, `aarch64→arm64`) so local runs on Apple Silicon Docker also work.

**Actions inside Alpine:** the GitHub runner detects Alpine job containers (it runs `cat /etc/*release | grep ^ID`) and runs JavaScript actions such as `actions/checkout` on its bundled `node24_alpine`/`node20_alpine` externals, x64 only. [VERIFIED: actions/runner src/Runner.Worker/Handlers/StepHost.cs:174-199, src/Misc/externals.sh:6-10,177-179]. `actions/setup-node` downloads nodejs.org glibc builds, which do not run on musl [ASSUMED]. Never use it in the Alpine leg; use `apk`.

**Root in containers:** `container:` jobs run as root. The two permission tests already skip as root: `it.skipIf(process.getuid?.() === 0)` at tests/bundle-startup.test.ts:189 and tests/zsh-widget.test.ts:829 [VERIFIED]. Root is therefore acceptable for the vitest matrix. The smoke runs as a non-root user (realistic socket `/tmp/qq-1000.sock`).

**git in containers:** install `git` **before** `actions/checkout`. Without git, checkout falls back to a REST tarball with no `.git` [ASSUMED]. Then run `git config --global --add safe.directory "$GITHUB_WORKSPACE"`, since the workspace is owned by the runner uid [ASSUMED].

## Architecture Patterns

### System Architecture Diagram

```
                         push (any branch) / pull_request / workflow_dispatch
                                              │
                                              ▼
                                  ┌──────────────────────┐
                                  │ changes (git diff)   │──► code=false ─► heavy jobs skipped
                                  └──────────┬───────────┘    (skipped = success)
                                             │ code=true
          ┌──────────────────────────────────┼──────────────────────────────────┐
          ▼                                  ▼                                  ▼
 ┌─────────────────┐       ┌────────────────────────────────┐   ┌────────────────────────────────┐
 │ checks (host)   │       │ test-distro × 6 (container:)   │   │ smoke × 6 (host + docker run)  │
 │ lint/typecheck/ │       │ install-distro-deps.sh →       │   │ pnpm build + pnpm pack (host)  │
 │ test:run/build  │       │ checkout → pnpm i → test:run   │   │ → smoke-distro.sh <image>      │
 └────────┬────────┘       └───────────────┬────────────────┘   │   container: deps, npm i -g tgz│
          │                                │                    │   fake claude shim, user qq    │
          │                                │                    │   qq init zsh, qq doctor --json│
          │                                │                    │   expect: ?? → TUI → accept /  │
          │                                │                    │   Esc / C locale / no XDG      │
          │                                │                    │ → artifacts (pty.log, doctor)  │
          │                                │                    └───────────────┬────────────────┘
          ▼                                ▼                                    ▼
                     ┌────────────────────────────────────────┐
                     │ ci-ok (if: always()) — ONLY required    │
                     │ check; fails on any failure/cancelled   │
                     └────────────────────────────────────────┘
                                             │ smoke failed AND event == push
                                             │ AND ref !~ auto-revert/*
                                             ▼
                     ┌────────────────────────────────────────┐
                     │ auto-revert: last green SHA (smoke ran │
                     │ and passed) → git restore --source=G   │
                     │ → push auto-revert/<branch> → gh pr    │
                     │ create|edit (body: distros, doctor,    │
                     │ PTY log tail, run link)                │
                     └────────────────────────────────────────┘

 Telemetry (opted-in user):
 zsh widget ─► qq client ──(fetch-candidates IPC)──► daemon ──► provider
                  │  accept/Esc/error known here        │ fetch-error now carries errorKind
                  │                                     │
                  ├─(first accepted ??, undecided, gates pass)─► /dev/tty "[y/N]" ─► config.json telemetry{}
                  │
                  └─(telemetry-event IPC, fire-and-forget, zod-validated)─► daemon buffer (≤100, in memory)
                                                                             │ interval (60 s, unref) + shutdown
                                                                             ▼
                                                    fetch POST https://eu.i.posthog.com/batch/ (timeout 3 s)
                                                    failure → drop; lastSentBody kept in memory for `show`
```

### Recommended Project Structure (new files)
```
.github/workflows/
├── ci.yml                    # push(all)+pull_request: changes, checks, distro (call), ci-ok, auto-revert
├── distro.yml                # on: workflow_call(images, ref) — test-distro + smoke matrices
└── nightly.yml               # schedule + workflow_dispatch: distro.yml with :latest images + live job
scripts/
├── ci/install-distro-deps.sh # POSIX sh; detects /etc/os-release ID; node/pnpm/zsh/jq/expect/git
├── ci/code-changed.mjs       # prints true/false: any non-doc path changed in the push/PR range
├── ci/auto-revert.sh         # last-green lookup, restore, push, gh pr create|edit
├── smoke-distro.sh           # host: build, pnpm pack, docker run <image>; D-16 docker check
├── smoke-distro-runner.sh    # in container (POSIX sh): deps, npm i -g tgz, claude shim, user, doctor, expect
└── smoke-distro.exp          # expect script: assertions; writes /out/pty-*.log
src/
├── contracts/telemetry.ts    # strict allow-list schemas + enums
├── contracts/doctor.ts       # doctor --json schema (stable shape)
├── shared/telemetry-config.ts# uncached read/atomic write of config.json `telemetry` block + env gates
├── daemon/telemetry-buffer.ts# in-memory queue, flush timer, lastSentBody, sender
├── cli/commands/doctor.ts
└── cli/commands/telemetry.ts # status|on|off|show
tests/
├── telemetry-contract.test.ts, telemetry-config.test.ts, telemetry-buffer.test.ts,
├── telemetry-consent.test.ts, doctor.test.ts, prewarm-sleep.test.ts, lsof-busybox.test.ts
└── live/sdk-contract.live.ts # excluded from default include; vitest.live.config.ts
```

### Pattern 1: In-job path filter + single gate check (required-check safe)
**What:** never use workflow-level `paths-ignore`. A `changes` job emits `code=true|false`, heavy jobs use `if: needs.changes.outputs.code == 'true'`, and one `ci-ok` job with `if: always()` is the only required check.
**Why:** "If a workflow is skipped due to path filtering … checks associated with that workflow will remain in a 'Pending' state. A pull request that requires those checks … will be blocked from merging." In contrast, "A job that is skipped will report its status as 'Success'." [CITED: docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax; docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions]. Matrix jobs skipped by `if` do not expand, so per-distro check names such as `smoke (alpine:3.24)` would never report. That is why only `ci-ok` should be required [ASSUMED: matrix-name behaviour from common practice].
```yaml
  ci-ok:
    if: always()
    needs: [changes, checks, distro]
    runs-on: ubuntu-24.04
    steps:
      - name: All required jobs succeeded or were skipped
        env:
          RESULTS: ${{ join(needs.*.result, ' ') }}
        run: |
          echo "results: $RESULTS"
          case " $RESULTS " in *" failure "*|*" cancelled "*) exit 1;; esac
```
**Doc-only paths** (`code=false` when every changed path matches): `*.md`, `**/*.md`, `.planning/**`, `.wolf/**`, `docs/**`, `LICENSE`, `.github/ISSUE_TEMPLATE/**`. In this repo most commits touch `.planning/` and `.wolf/`, so the saving is large. Push range: `${{ github.event.before }}..${{ github.sha }}`. When `before` is all zeros (new branch), use `git merge-base origin/main HEAD`. If anything fails, output `true` (fail open to running everything). Reuse `scripts/changed-files-from-base.mjs` (`resolveBaseRef`, `changedFilesFromBase`) for the base fallback [VERIFIED: scripts/changed-files-from-base.mjs].

### Pattern 2: Smoke via `expect` with deterministic, self-proving assertions
**What:** spawn `zsh -i` under `TERM=xterm-256color`, type into the real ZLE, and prove buffer content by **executing** it:
- Accept fills buffer: `list files??` → wait for `tldr z3` (the fake `success` answer [VERIFIED: tests/fixtures/fake-claude-stream.mjs SUCCESS_ANSWER]) → `\r` accepts row 1 → **expect the prompt redraw `-re {QQSMOKE[%#] tldr z3  # }`** → `\r` executes the buffer → expect `command not found: tldr`. Only a filled buffer can produce that line.
- Esc restores: type `print -r -- restored-$((6*7))??` → wait for `tldr z3` → send `\033` alone → **expect `-re {QQSMOKE[%#] print -r -- restored-}`** → `\r` → expect `restored-42`. The typed line only contains `$((6*7))`, so `42` proves execution of the restored buffer.
- Never key a step on text the TUI itself printed (see the prototype race below).
- Wait for candidates before pressing Esc (cerebrum: Esc during `thinking…` leaves the client running, a pre-existing issue).
- Passes: (a) default locale with `env -u XDG_RUNTIME_DIR`; (b) `LANG=C LC_ALL=C`. The fake answer contains `ⓘ` (3-byte UTF-8), so it exercises the C locale.
- `log_file -noappend /out/pty-<pass>.log` for artifacts; `set timeout 40`; distinct `exit` codes per assertion, mirroring `docker-homebrew-smoke-runner.sh`.
**Fake claude shim** (the runtime spawns `claude` from PATH: `export const CLAUDE_COMMAND = 'claude';` [VERIFIED: src/providers/claude-cli.ts:41]; with no `ANTHROPIC_API_KEY` the CLI path is used):
```sh
#!/bin/sh
exec node /opt/fake/fake-claude-stream.mjs "${FAKE_CLAUDE_SCENARIO:-success}" "$@"
```
`tests/fixtures/` is not in `package.json` `files` (`"dist","shell","README.md","LICENSE"` [VERIFIED: package.json]), so the smoke script mounts or copies the fixture separately. The product itself comes only from `pnpm pack` → `npm install -g <tgz>`.

### Pattern 3: Telemetry contract as the allow list
**What:** every object is `z.strictObject`, every value is an enum, literal, bounded int or tight regex, and the event name is a literal discriminator. Free-form `z.string()` is never allowed.
```ts
// src/contracts/telemetry.ts (sketch — values are recommendations, not repo facts)
export const ERROR_KINDS = ['auth_missing', 'key_rejected', 'key_refused', 'provider_missing',
  'provider_timeout', 'provider_failed', 'response_truncated', 'parse_failed', 'pin_invalid',
  'socket_failed', 'tty_unavailable', 'unknown'] as const;
export const PROVIDER_KINDS = ['claude-sdk', 'claude-cli', 'openai', 'ollama', 'unknown'] as const;
const common = {
  distinct_id: z.uuid(),                      // install UUID (D-06)
  $process_person_profile: z.literal(false),
  $geoip_disable: z.literal(true),
  $lib: z.literal('queque'),
  $lib_version: z.string().regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/).max(40),
};
const queryOutcome = z.strictObject({
  event: z.literal('qq_query_outcome'),
  timestamp: z.iso.datetime(),
  properties: z.strictObject({ ...common, outcome: z.enum(['accepted', 'escaped', 'error']),
    candidate_count: z.number().int().min(0).max(5), provider: z.enum(PROVIDER_KINDS),
    error_kind: z.enum(ERROR_KINDS).optional() }),
});
// qq_error and qq_environment analogous; environment: os enum ['darwin','linux','other'],
// arch enum ['x64','arm64','other'], distro enum ['ubuntu','debian','fedora','arch','alpine',
// 'macos','other'], zsh /^\d{1,2}\.\d{1,2}$/, node_major int 18..99, zellij boolean.
export const telemetryBatchSchema = z.strictObject({ api_key: z.string().regex(/^phc_\w+$/),
  batch: z.array(z.discriminatedUnion('event', [queryOutcome, errorEvent, environment])).min(1).max(100) });
```
Check the zod 4 API names (`z.uuid()`, `z.iso.datetime()`, `z.strictObject`) against zod 4.1.5 at implementation. `z.strictObject` is already used in src/providers/provider-pin.ts:63-70 [VERIFIED]. Others [ASSUMED].

### Pattern 4: Uncached consent state, atomic write that preserves user keys
`loadQqConfig()` caches per process [VERIFIED: src/shared/qq-config.ts:171-174], and `readConfigFile()` drops the whole file on a schema error. Telemetry needs its own **uncached** reader (the daemon must see `qq telemetry off` without a restart) and a writer that:
1. reads the raw JSON object (if the file exists but is invalid JSON, **refuse to write** and tell the user. Never clobber privacy patterns);
2. sets only `telemetry: { enabled, asked, installId? }`;
3. writes atomically with the provider-pin pattern: temp file `wx` mode 0600, `chmodSync`, `renameSync`, directory 0700 [VERIFIED: src/providers/provider-pin.ts:175-199].
Add `telemetry` to `qqConfigFileSchema` with `.optional().catch(undefined)` so a malformed block never drops `privacy`/`safety` (current schema: `effort: effortSchema, privacy: privacyConfigSchema, safety: safetyConfigSchema` [VERIFIED: src/shared/qq-config.ts:72-76]). Path: `defaultConfigPath()` honours `QQ_CONFIG_FILE` [VERIFIED: qq-config.ts:105-112], so tests isolate with `QQ_CONFIG_FILE`.

### Pattern 5: Env gates evaluated at both producer and sender
`telemetryBlockedBy(env)` returns `'DO_NOT_TRACK' | 'QQ_TELEMETRY' | 'CI' | null`:
- `DO_NOT_TRACK` set and not one of `''`, `'0'`, `'false'`;
- `QQ_TELEMETRY === '0'` (also `'false'`/`'off'`);
- `CI` set and non-empty (GitHub sets `CI=true`).
The client checks before prompting or producing events, and the daemon checks before buffering and sending. The daemon's env is frozen at spawn (it is usually spawned from `.zshrc` [cerebrum 2026-10-17]), so the client-side gate is what makes a later `export DO_NOT_TRACK=1` effective immediately.

### Anti-Patterns to Avoid
- **Workflow-level `paths-ignore` on a required workflow:** leaves required checks Pending forever on doc-only PRs.
- **Requiring per-matrix check names:** skipped matrices never report expanded names. Require only `ci-ok`.
- **`git revert G..H`:** fails on merge commits (`error: commit … is a merge but no -m option was given`) [VERIFIED: local git probe]. Use tree restore (see Auto-Revert).
- **`pull_request_target` for anything:** runs with secrets on fork code. Never.
- **`posthog-node`, disk queues, retries:** D-07 forbids them; drop on failure.
- **Mapping user-visible error *messages* to error kinds in the client:** brittle. Classify where the error object exists (daemon/provider) and ship an `errorKind` enum on `fetch-error`.
- **Adding a pong flag that makes `ensureDaemon` replace old daemons for telemetry:** telemetry is optional. A `telemetry: true` pong flag may be advertised but must not be a replace trigger (replacement goes through `replaceStaleListener`, which is Defect 1's blast radius).
- **Prompting inside the Ink tree or before the result is written:** the consent ask comes after `writeShellResult` and Ink unmount (see Telemetry Design).

## CI Workflow Design

### Triggers, concurrency, dedupe
```yaml
on:
  push:
    branches: ['**']
  pull_request:
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: ci-${{ github.event_name }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```
- **Dedupe recommendation: do not dedupe push vs pull_request.** For a same-repo PR, a `pull_request` run whose heavy jobs were skipped would produce a green `ci-ok` on the head SHA before the push run finishes, a premature-green risk. The repo is public, so standard runners are free [ASSUMED]. Running both is cheap and correct. Concurrency is keyed per event, so superseded pushes cancel only their own event's older run.
- Cancelled runs never count as "green" for auto-revert.
- `main` is not cancel-in-progress, so every main push gets a verdict.

### `checks` job (host, ubuntu-24.04)
Mirror `release.yaml`'s `test` job: checkout@v6, pnpm/action-setup@v6, setup-node@v6 (`node-version-file: .nvmrc`, `cache: pnpm`), `sudo apt-get install -y zsh jq`, `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm build` [VERIFIED: .github/workflows/release.yaml]. Set `env: LEFTHOOK: 0`. `timeout-minutes: 15`.

### Reusable `distro.yml` (workflow_call, inputs: `images` JSON array)
```yaml
jobs:
  test-distro:
    strategy: { fail-fast: false, matrix: { image: ${{ fromJSON(inputs.images) }} } }
    runs-on: ubuntu-24.04
    container: { image: ${{ matrix.image }} }
    timeout-minutes: 25
    steps:
      - name: Install distro deps (git first, before checkout)
        run: |   # inline bootstrap: the script is not checked out yet
          . /etc/os-release
          case "$ID" in
            alpine) apk add --no-cache git ;;
            ubuntu|debian) apt-get update && apt-get install -y --no-install-recommends git ca-certificates ;;
            fedora) dnf -y install git-core ;;
            arch) pacman -Sy --noconfirm --needed git ;;
          esac
        shell: sh
      - uses: actions/checkout@v6
      - run: git config --global --add safe.directory "$GITHUB_WORKSPACE"
      - run: sh scripts/ci/install-distro-deps.sh   # node (per table), pnpm, zsh, jq, expect, procps
        shell: sh
      - run: pnpm install --frozen-lockfile
        env: { LEFTHOOK: '0' }
      - run: pnpm test:run
  smoke:
    strategy: { fail-fast: false, matrix: { image: ${{ fromJSON(inputs.images) }} } }
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v6
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: scripts/smoke-distro.sh "${{ matrix.image }}" --out "$RUNNER_TEMP/smoke-out"
      - if: always()
        uses: actions/upload-artifact@v7
        with: { name: 'smoke-${{ strategy.job-index }}', path: '${{ runner.temp }}/smoke-out' }
```
- Artifact names must be unique per matrix leg and must not contain `:`. Use `strategy.job-index` or a sanitized image name [ASSUMED: artifact naming rules].
- Pass `shell: sh` on container steps for Alpine (busybox has no bash). The runner's default `run` shell is bash when available, otherwise sh [ASSUMED].
- `test:run` uses ~6–7 minutes per leg on GitHub-hosted runners [ASSUMED; the Docker-Desktop-on-macOS probe was far slower].

## Smoke Harness Design (`scripts/smoke-distro.sh <image>`)

1. **Host side** (bash OK; runs on macOS and the Ubuntu runner):
   - D-16: if `! docker info >/dev/null 2>&1`, print `warning: Docker is not available; skipping distro smoke` to stderr and **exit 0**. Add `"smoke:distro": "scripts/smoke-distro.sh"` to package.json.
   - `pnpm build && pnpm pack --pack-destination "$tmp/pkg"`. The tarball is `k-leumas-queque-cli-<version>.tgz` [VERIFIED: probe produced `k-leumas-queque-cli-0.7.0.tgz`].
   - `docker run --rm -v "$tmp/pkg:/pkg:ro" -v "$ROOT/tests/fixtures/fake-claude-stream.mjs:/opt/fake/fake-claude-stream.mjs:ro" -v "$ROOT/scripts:/opt/qq-scripts:ro" -v "$OUT:/out" -e NODE_VERSION="$(cat .nvmrc)" "$IMAGE" sh /opt/qq-scripts/smoke-distro-runner.sh`.
   - Do **not** forward the host `CI` env into the container. The smoke covers the interactive product path. The consent prompt only shows after an *accepted* `??` with undecided consent, so the smoke sets `QQ_TELEMETRY=0` explicitly to keep the prompt out of the PTY (consent is tested in vitest).
2. **Runner** (POSIX sh, root then user):
   - `sh /opt/qq-scripts/ci/install-distro-deps.sh` (shared with CI); retry package installs 3× (registry/CDN TLS flakes were seen this session).
   - `npm install -g /pkg/*.tgz` → `qq` on PATH.
   - Install the `claude` shim (Pattern 2) at `/usr/local/bin/claude`.
   - `adduser -D qq` (Alpine) / `useradd -m qq` (others); `su qq -c '…'` for the rest.
   - As qq: `qq init zsh`; append `PS1='QQSMOKE%# '`, `export QQ_DEBUG_LOG_FILE=/out/qq-debug.log`, `export QQ_TELEMETRY=0` to `~/.zshrc`; `qq doctor --json > /out/doctor.json; test $? -eq 0` (D-17); `expect /opt/qq-scripts/smoke-distro.exp` twice (default locale with `env -u XDG_RUNTIME_DIR`; `LANG=C LC_ALL=C`).
   - Exit non-zero with a distinct code per failed assertion. Always copy logs to `/out`.
3. **Socket/XDG:** the socket is `/tmp/qq-<uid>.sock` (`return \`/tmp/qq-${uid}.sock\`;` [VERIFIED: src/shared/socket-path.ts:12-14]), so `XDG_RUNTIME_DIR` is irrelevant by design. The unset pass guards against regressions.

**Prototype result (alpine:3.24, this session):** the approach works end to end from a `pnpm pack` install (`k-leumas-queque-cli-0.7.0.tgz` → `npm install -g` → `/usr/local/bin/qq`) with a non-root user and the fake `claude` shim. [VERIFIED: docker probe]
- **Default locale, `env -u XDG_RUNTIME_DIR`:** `qq init zsh` added the integration. `list files??` painted the instant frame, then the Ink TUI with `┌> tldr z3` and `z3 -smt2 <file>`. Enter filled the buffer (`QQSMOKE% tldr z3  # Show concise usage examples for z3`). Enter again printed `zsh: command not found: tldr`. Esc on `print -r -- restored-$((6*7))??` restored the buffer and Enter printed `restored-42`. Result: `SMOKE-OK`, `expect rc=0`.
- **`LANG=C LC_ALL=C`:** the TUI opened and accept filled the buffer, but every non-ASCII glyph rendered as `?`, in both the widget's instant frame (`queque ??? list files`, `thinking???`) and Ink (`???> tldr z3`, `??????  select`). This is cosmetic, and the smoke must assert behaviour, not glyphs.
- **Race found in the prototype:** after accept, my script did `expect -re {tldr z3}` and then sent Enter. That pattern matches text the TUI already printed, so Enter can arrive before ZLE redraws the prompt and the keystroke is lost (it hung in the C-locale pass). **Anchor every post-TUI step on the prompt redraw:** after accept, expect `-re {QQSMOKE[%#] tldr z3  # }`; after Esc, expect `-re {QQSMOKE[%#] print -r -- restored-}` before sending Enter. Also call `expect_before`/flush or use distinct markers per step.
- Docker Desktop's VM disk hit 99% during the probes (`mktemp: : No space left on device`), which is how Defect 3 surfaced. The smoke runner should `df /tmp` on failure and include it in artifacts.

## Auto-Revert Design (D-15)

**Job:** in `ci.yml`, `needs: [changes, distro]`, `if: always() && github.event_name == 'push' && needs.distro.result == 'failure' && !startsWith(github.ref_name, 'auto-revert/')`, with `permissions: { contents: write, pull-requests: write, actions: read }` and `concurrency: { group: auto-revert-${{ github.ref }}, cancel-in-progress: false }`.

Only *smoke* failures should revert (D-15). Have `distro.yml` expose a `smoke_failed` output, or let the job query `gh api repos/$R/actions/runs/$RUN_ID/jobs --paginate` and check for `name` starting with `smoke` and `conclusion == "failure"`. The latter also yields the failing distro list for the PR body.

**Offending range (last green → HEAD):**
1. `gh api "repos/$R/actions/workflows/ci.yml/runs?branch=$BRANCH&event=push&status=success&per_page=20"` gives candidates newest first. `head_sha` and `conclusion` are present [VERIFIED: probe of release.yaml runs returned `{"conclusion":"success","event":"push","head_branch":"main","head_sha":"489a67a…"}`].
2. **Pick the newest run whose smoke jobs actually ran and passed.** A doc-only push after a red code push yields a "success" run with smoke *skipped*, and it still contains the breakage. Check with `…/runs/{id}/jobs`: at least one `smoke*` job with `conclusion == "success"`.
3. Fallbacks: if no such run exists, use `github.event.before` when it is not all zeros and is an ancestor of HEAD. Otherwise use `git merge-base origin/main HEAD` on a non-main branch. On main with no green ever, emit `::warning::` and skip.

**Revert mechanics (tree restore, merge-safe):**
```sh
git switch -C "auto-revert/$BRANCH" "$GITHUB_SHA"
git restore --source="$GOOD" --staged --worktree -- .
git commit -m "revert: restore $BRANCH to last green ${GOOD_SHORT}" -m "Smoke failed at ${HEAD_SHORT}: $DISTROS"
git push --force origin "auto-revert/$BRANCH"
```
[VERIFIED: local git probe. The resulting tree equals G's tree, including deletions of files added after G, across a merge commit where `git revert G..H` failed]. Note: on a feature branch this also undoes `main` merges made after G. That is acceptable and visible in the PR diff.

**Dedupe:** fixed head branch `auto-revert/<branch>` (sanitize `/` to `-` if desired). `gh pr list --head "auto-revert/$BRANCH" --state open --json number --jq '.[0].number'`. If a PR exists, force-push the branch, `gh pr edit --body-file`, and `gh pr comment` with the new failing SHA. Otherwise `gh pr create --base "$BRANCH" --head "auto-revert/$BRANCH" --title "revert: smoke failed on $BRANCH at $HEAD_SHORT" --body-file body.md`.
**PR body:** failing distros, run URL, `doctor.json` per failed distro (fenced), last ~80 lines of `pty-*.log` and `qq-debug.log` from `actions/download-artifact`. Truncate the total body to stay well under GitHub's ~65 536-char body limit [ASSUMED].

**Loop safety:**
- Pushes made with `GITHUB_TOKEN` create no new workflow runs. The only exception is `pull_request` opened/synchronize/reopened from a token-created PR, which runs in an **approval-required** state [CITED: docs.github.com/en/actions/concepts/security/github_token].
- The `auto-revert/` prefix guard stops revert-of-revert even if a PAT is later used.
- Forked PRs never trigger the job (push-only).

**Required repo setting (human checkpoint):** `GET repos/k-leumas/queque/actions/permissions/workflow` returned `{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}` [VERIFIED: gh api this session]. With that setting, `GITHUB_TOKEN` cannot create PRs. Enable "Allow GitHub Actions to create and approve pull requests" (`gh api -X PUT repos/k-leumas/queque/actions/permissions/workflow -f default_workflow_permissions=read -F can_approve_pull_request_reviews=true`), or use `secrets.GH_TOKEN` (Open Question 2).

## Nightly + Live Job

`nightly.yml`: `on: { schedule: [{ cron: '23 3 * * *' }], workflow_dispatch: {} }`.
- `uses: ./.github/workflows/distro.yml` with `images: '["ubuntu:latest","debian:latest","fedora:latest","archlinux:latest","alpine:latest"]'`.
- `live` job: `if: github.repository == 'k-leumas/queque'` (forks with schedules lack the secret). There are no `pull_request`/`pull_request_target` triggers in this file, so the secret never meets PR code (D-01). Not in branch protection (D-03).
  - Steps: checkout, pnpm, node, `pnpm build`, then `pnpm exec vitest run --config vitest.live.config.ts`, with `env: ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}`. The secret already exists and is used by release.yaml [VERIFIED: release.yaml `ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}`].
  - Test (`tests/live/sdk-contract.live.ts`; the default include `tests/**/*.test.ts` will not pick it up [VERIFIED: vitest.config.ts]):
    - spawn the real built daemon `node dist/cli/main.js daemon --socket /tmp/qq-live-<pid>.sock` (passes `assertSafeSocketPath` [VERIFIED: socket-path.ts:29-36]) with `QQ_DEBUG_LOG_FILE=<tmp>`;
    - send `{kind:'fetch-candidates', envelope, stream:true}`;
    - assert a `candidate` or `candidates` message within the ceiling;
    - parse with `ipcResponseSchema` / `candidateListSchema`;
    - assert the log has no `request failed` or `response truncated` [VERIFIED: log messages at src/providers/claude.ts:175,320,487].
- **Latency ceiling (discretion):** first candidate ≤ 15 000 ms and final `candidates` ≤ 25 000 ms. This is the shared budget `const TOTAL_BUDGET_MS = 25_000;` [VERIFIED: src/providers/claude-default.ts:9]. Generous for a ~2–4 s typical SDK turn [ASSUMED typical].
- Never assert command text (D-02).

## qq doctor Design (D-17, D-18)

Register `cli.command('doctor', 'Check this machine for QueQue problems').option('--json', …)` in `src/cli/main.ts` beside `client`/`init`/`daemon` [VERIFIED: src/cli/main.ts:81-111].

| id | Check | ✗ (exit 1) | ⚠ (exit 0) | How |
|----|-------|-----|-----|-----|
| `zsh` | zsh present + version | missing, or < floor (Open Q3) | below tested minimum | `zsh -fc 'print -r -- $ZSH_VERSION'`, timeout 3 s |
| `jq` | jq on PATH | missing (recommended; Open Q1) | — | `command -v`-style PATH scan |
| `tmp` | `/tmp` exists, is a dir, writable | not writable | — | `fs.accessSync('/tmp', W_OK)` + `mkdtemp` probe |
| `socket` | socket path length + ownership | `Buffer.byteLength(path) > 107` (linux) / `> 103` (darwin); existing path owned by another uid | stale socket file (connect refused) | Node docs: "Typical values are 107 bytes on Linux and 103 bytes on macOS" [CITED: nodejs.org/docs/latest-v24.x/api/net.html] |
| `daemon` | daemon answers ping | — | not running (info), or pong lacks flags | existing ping in bootstrap |
| `integration` | `~/.zshrc` sources queque | — | missing | reuse `hasShellIntegration` [VERIFIED: src/cli/commands/init.ts:32] |
| `binding` | `?` bound to `qq-question-widget` in emacs + viins | — | other widget / unknown | `zsh -ic 'bindkey -M emacs "?"; bindkey -M viins "?"'` with `QQ_DAEMON_PREWARMED=1` (skips prewarm [VERIFIED: queque.zsh:188-199]), timeout 5 s |
| `term` | TERM set and not `dumb` | — | unset/dumb | env |
| `locale` | UTF-8 in `LC_ALL`/`LC_CTYPE`/`LANG` | — | non-UTF-8 (C works, per smoke) | env |
| `provider` | pin + detection | — | none/invalid pin/no credentials | `loadProviderPin()` + `detectProvider()` [VERIFIED: provider-pin.ts:135-164, detect.ts:63-96] |
| `node` | node major | — | < 24 | `process.versions.node` |
| `telemetry` | status + reason | — | — (info) | telemetry-config |

- Under fake claude on Linux, `detectProvider()` reports no provider because `claudeAuthPresent()` needs `~/.claude/.credentials.json` off darwin [VERIFIED: detect.ts:41-50]. That is a ⚠ only, so smoke still asserts exit 0 (D-17).
- **JSON shape** (`src/contracts/doctor.ts`, versioned): `{ version: 1, ok: boolean, qqVersion: string, platform: 'darwin'|'linux'|'other', checks: Array<{ id, status: 'ok'|'warn'|'fail'|'info', summary: string, hint?: string }> }`. Check ids are a stable enum; add new ids, never rename. Exit code = `checks.some(c => c.status === 'fail') ? 1 : 0`.
- Doctor output ends up in a **public** revert PR body. It must never include env values, API keys or buffer contents. Paths are acceptable (CI container paths), but `summary` strings should not echo `$HOME` contents beyond the checked path.

## Telemetry Design

### Data flow and module seams
1. **Gate + state** (`src/shared/telemetry-config.ts`):
   - `readTelemetryState()` (uncached) → `{ enabled, asked, installId? }`;
   - `setTelemetry(enabled)` (generates `crypto.randomUUID()` on enable; deletes `installId` on disable, per D-06);
   - `markAsked(answer)`;
   - `telemetryBlockedBy(env)` (Pattern 5);
   - `effectiveTelemetry()` = not blocked AND `enabled` AND `installId`.
2. **Contract** (`src/contracts/telemetry.ts`, Pattern 3) plus `TELEMETRY_IPC` schemas.
3. **IPC additions** in `src/contracts/ipc.ts`. Old daemons log `ignored unknown request` and continue, since `ipcRequestSchema.safeParse` failure is non-fatal [VERIFIED: src/daemon/server.ts:85-89]. Old clients strip unknown keys, since response schemas are `z.object` [VERIFIED: ipc.ts].
   - request `{ kind: 'telemetry-event', event: <client event schema> }`: no response; the client writes, ends, and does not wait beyond ~250 ms.
   - request `{ kind: 'telemetry-show' }` → response `{ kind: 'telemetry-buffer', pending: string|null, lastSent: string|null }` (serialized bodies, byte-for-byte per D-12).
   - request `{ kind: 'telemetry-reset' }` (sent by `qq telemetry off`) → drop the buffer and lastSent.
   - `fetch-error` gains optional `errorKind: z.enum(ERROR_KINDS)`, classified in the daemon from the error object. Classification sources: `ClaudeTurnFailureReason` = `'is-error' | 'exit-without-result' | 'timeout' | 'spawn-error' | 'invalid-result' | 'stale-prewarm' | 'truncated'` [VERIFIED: src/providers/claude-process.ts:56-63]; ENOENT/auth/401/403 branches in claude-default.ts; `TRUNCATED_RESPONSE_MESSAGE` / `UNPARSEABLE_RESPONSE_MESSAGE` constants.
   - Optional pong flag `telemetry: true` (informational only; not a replace trigger).
4. **Daemon buffer** (`src/daemon/telemetry-buffer.ts`):
   - `enqueue(clientEvent)` → re-validate, check `effectiveTelemetry()` (reads state now), wrap with `distinct_id`/`$lib`/`$lib_version` (`__QUEQUE_VERSION__`)/`$process_person_profile:false`/`$geoip_disable:true`/`timestamp`, and validate the full event against the strict schema. Drop if invalid.
   - Cap at 100 events, dropping the newest when full.
   - `setInterval(flush, 60_000).unref()`; flush also when the buffer reaches 20.
   - `flush()`: serialize the body once (this exact string becomes `lastSentBody`), then `fetch(\`${host}/batch/\`, { method:'POST', headers:{'Content-Type':'application/json'}, body, signal: AbortSignal.timeout(3000) })`, ignoring the result. **On any failure the batch is dropped** (D-07).
   - The environment event is enqueued once per daemon lifetime, and again when its hash changes.
5. **Shutdown flush:** in `shutdownDaemon` (cli/commands/daemon.ts:45-64), call `void flushTelemetry()` **before** `server.close()`. The existing `graceMs` window (`SIGKILL_GRACE_MS + 100`) only applies when connections were in flight, so add a small bounded wait (`Promise.race([flush, sleep(1000)])`) before `exit()` [VERIFIED: daemon.ts:45-64]. Never delay shutdown more than ~1 s.
6. **Client** (`run-foreground.ts`):
   - set `outcome` in `onSelect` (`accepted`), `onCancel` (`escaped`), and the error branches (`error` + `errorKind` from `fetch-error`, or a local kind such as `tty_unavailable`/`socket_failed`);
   - after the result is written and Ink has unmounted, if `effectiveTelemetry()`, send `telemetry-event` (fire-and-forget);
   - the env-shape event needs zsh `major.minor`: export `QQ_ZSH_VERSION="$ZSH_VERSION"` in the widget's client invocation (the client cannot read the unexported `$ZSH_VERSION`), and Zellij from `process.env.ZELLIJ !== undefined` [VERIFIED: run-foreground.ts:130].
7. **Consent prompt (D-09):**
   - Condition: outcome `accepted`, `!asked`, not blocked, and a tty is open. CI is already a block.
   - Placement: after `await new Promise(...)` resolves (Ink unmounted, scroll reserve cleared) and **before** `ttyHandle.close()`.
   - Write one line to `ttyWriteStream`. Suggested copy: `QueQue: send anonymous usage and error counts (no commands, prompts or paths)? [y/N] `.
   - Read one key via `setRawMode(true)` + `once('data')`. Only `y`/`Y` means yes; Enter, Esc or anything else means no. Use a 30 s timeout that counts as no.
   - Persist with `markAsked`, then clear the line with `\r\x1b[2K`.
   - Inline mode: the widget applies the buffer only after the client exits [VERIFIED: queque.zsh:454-466], so the user answers, then the buffer fills. Zellij mode: the FIFO result is already delivered and the prompt shows in the floating pane until answered.
8. **Build-time key (D-08):**
   - tsup `define`: `__QUEQUE_TELEMETRY_KEY__: JSON.stringify('phc_…')` and `__QUEQUE_TELEMETRY_HOST__: JSON.stringify('https://eu.i.posthog.com')`, beside the existing `__QUEQUE_COMMIT__`/`__QUEQUE_VERSION__` [VERIFIED: tsup.config.ts:52-55].
   - Declare both in `src/env.d.ts` [VERIFIED: src/env.d.ts:1-2 pattern].
   - **Also add both to `vitest.config.ts` `define`** with inert test values (e.g. `'phc_test'`, `'http://127.0.0.1:9'`) [VERIFIED: vitest.config.ts define block]. Otherwise any test importing the module throws `ReferenceError`.
   - Also update the esbuild repro recipe in cerebrum, which lists the defines.
   - Runtime override: `usableSecret(process.env.QQ_TELEMETRY_KEY) ?? __QUEQUE_TELEMETRY_KEY__`, and the same for HOST (empty string = unset; cerebrum `??` lesson).
   - An empty baked key disables sending (builds before the PostHog project exists).
9. **CLI** (`qq telemetry <status|on|off|show>` → `src/cli/commands/telemetry.ts`):
   - `status` prints enabled/disabled, the blocking reason (env var name), and whether asked.
   - `on`/`off` write the config; `off` also sends `telemetry-reset`.
   - `show` sends `telemetry-show` IPC and prints `pending` and `lastSent` verbatim, or `daemon not running: nothing buffered`.
   - Even when blocked by env, `on` writes config but `status` explains the override.

### PostHog wire format [CITED: posthog.com/docs/api/capture]
```http
POST https://eu.i.posthog.com/batch/
Content-Type: application/json

{"api_key":"phc_…","batch":[{"event":"qq_query_outcome","timestamp":"2026-10-28T12:00:00.000Z",
  "properties":{"distinct_id":"<install-uuid>","$process_person_profile":false,"$geoip_disable":true,
  "$lib":"queque","$lib_version":"0.8.0","outcome":"accepted","candidate_count":2,"provider":"claude-cli"}}]}
```
- Body must be < 20 MB, and the success response is `{"status":"ok"}`. EU public endpoints live on `https://eu.i.posthog.com` [CITED: posthog.com/docs/api/overview].
- `$process_person_profile: false` → no person profile [CITED: posthog.com/docs/libraries/node].
- posthog-node's `disableGeoip` is implemented as `message.properties['$geoip_disable'] = true` [VERIFIED: PostHog/posthog-js packages/core/src/posthog-core-stateless.ts prepareMessage]. Whether raw `/batch/` honours it identically is not documented [ASSUMED → verify in PostHog's event view during the setup checkpoint].
- IP storage is controlled by the project setting **Discard client IP data**. EU organizations default to IP capture disabled [CITED: posthog.com/docs/privacy/data-collection, /docs/privacy/data-storage]. Confirm it is on at setup.
- Do not send `$ip`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PTY automation | Node pty wrapper, custom `script` parsing | `expect` | Mature, in every distro repo, existing runner precedent |
| Revert of a commit range | `git revert` loops with `-m` guessing | `git restore --source=<green> --staged --worktree -- .` | Merge-safe, exact tree; verified |
| PR create/update | REST calls by hand / third-party action | `gh pr list/create/edit/comment` (preinstalled on runners) | Already used in repo tooling; less supply-chain risk |
| Atomic config write | ad-hoc `writeFileSync` | provider-pin's `wx` temp + chmod + rename pattern | Already reviewed (IN-03 etc.) |
| Telemetry SDK | posthog-node | 40 lines of `fetch` + zod | D-07; the SDK adds retries/disk/GeoIP defaults we don't want |
| Required-check aggregation | per-job required checks | one `ci-ok` gate | Matrix/skip semantics |
| UUID | Math.random | `crypto.randomUUID()` | Correct v4 entropy |

**Key insight:** every piece of logic should live in a script or module that runs identically locally (D-16) and in CI. The YAML only wires matrices and permissions.

## D-04 Prewarm Simulation (exact recipe)

**What exists:**
- `tests/claude-prewarm.test.ts` runs the real pool with real fixture children (spawnClaudeChild spied pass-through), and already covers "killed from outside → `miss: 'dead'`, no respawn" at pool level [VERIFIED: tests/claude-prewarm.test.ts:194-206].
- `tests/claude-cli-prewarm.test.ts` mocks both the runner and the pool [VERIFIED: lines 18-41].
- **No test runs `fetchClaudeCliCandidates` end to end against a real stopped or killed prewarmed child.** That is the D-04 gap.

**New file `tests/prewarm-sleep.test.ts`** (real pool + real runner + real fake child):
- `beforeEach`: make a temp dir with an executable `claude` shim containing `#!/bin/sh` + `exec "<process.execPath>" "<FIXTURE>" success "$@"`, and prepend it to `process.env.PATH`. The runner spawns `spec.command` = `CLAUDE_COMMAND` (`'claude'`) with `env: process.env`, and prewarm spawns with `process.env` [VERIFIED: claude-cli.ts:41,136-148; claude-prewarm.ts:137]. Call `enablePrewarm()`.
- `afterEach`: `disablePrewarm()`, SIGKILL tracked pids, restore PATH, `vi.useRealTimers()`. Mock only `../src/shared/debug-log.js` to read stage lines (as the existing tests do).
- Prime the slot: run one query (`fetchClaudeCliCandidates(envelope, 25_000)`), which runs cold and refills the slot in `finally` [VERIFIED: claude-cli.ts:192-197]. Read the idle pid via `prewarmSnapshot()`.
- **Case A, sleep then wake (SIGSTOP → SIGCONT):** `process.kill(pid,'SIGSTOP')`, `process.kill(pid,'SIGCONT')`, query → debug has `prewarm hit` and no `prewarm retry cold`, result has 2 candidates, and the slot is refilled.
- **Case B, still frozen (SIGSTOP only), stale:** `vi.useFakeTimers({ toFake: ['Date'] })` then `vi.setSystemTime(Date.now() + 60_000)`. This ages the child past `PREWARM_BOOT_ALLOWANCE_MS`, so `warmInitDeadlineMs` = `WARM_INIT_DEADLINE_MS` (1500 ms of real `setTimeout`) [VERIFIED: claude-cli.ts:25,32,35-38: `export const WARM_INIT_DEADLINE_MS = 1500;`, `export const PREWARM_BOOT_ALLOWANCE_MS = 3000;`].
  - Run the query and assert `prewarm hit` → `init-timed-out` stage → `prewarm retry cold` → 2 candidates.
  - The stopped child is gone: poll `process.kill(pid, 0)` until it throws ESRCH, since terminateChild SIGKILLs after grace.
  - A new idle pid ≠ old pid.
  - `isRunning()` is true for a stopped child (`child.exitCode === null && child.signalCode === null` [VERIFIED: claude-process.ts:130-132]), which is exactly why the take is a hit and the init deadline is what detects staleness.
- **Case C, killed out from under the daemon:** SIGKILL the idle pid, wait for exit, query → `prewarm miss` with `{ reason: 'dead' }` (`PrewarmMissReason` = `'disabled' | 'empty' | 'dead' | 'cwd' | 'prompt'` [VERIFIED: claude-prewarm.ts:33]), cold result, refilled slot.
- Fake only `Date`, never `setTimeout`. Real child I/O interleaved with `advanceTimersByTimeAsync` is racy. "Advance fake timers" in D-04 is satisfied by advancing the faked clock that `warmInitDeadlineMs` reads.
- Per-test timeout 15 s. Budget ≥ 1000 ms past child boot (cerebrum: never near node boot time).

## Common Pitfalls

### Pitfall 1: busybox tools masquerading as GNU/BSD tools
**What goes wrong:** `lsof`, `ps`, `mktemp`, `timeout`, `su`, `adduser` are busybox applets on Alpine with different flags and output (Defect 1).
**How to avoid:** strict output validation, POSIX-only flags in scripts, and `useradd` vs `adduser -D` per family.
**Warning signs:** "Terminated" with no test output; exit 143 from busybox `timeout`.

### Pitfall 2: Required checks stuck Pending
**What goes wrong:** workflow-level `paths-ignore`, or requiring matrix leg names.
**How to avoid:** Pattern 1 (`changes` job + `ci-ok`).

### Pitfall 3: Doc-only "green" run hides a red code commit
**What goes wrong:** auto-revert computes the range from a run whose smoke was skipped.
**How to avoid:** the last-green lookup requires a successful `smoke*` job in the run.

### Pitfall 4: GITHUB_TOKEN cannot open PRs here; revert PR CI needs approval
**What goes wrong:** `can_approve_pull_request_reviews:false` (verified), so `gh pr create` fails with 403. Token-created PRs' CI runs wait for approval.
**How to avoid:** human checkpoint to enable the setting (or decide on the PAT); note it in the PR body ("Approve workflows to run").

### Pitfall 5: Config clobbering / cache staleness
**What goes wrong:** writing telemetry state through `qqConfigFileSchema.parse` output drops unknown keys and, on invalid JSON, the whole file. The daemon's `loadQqConfig` cache never sees `qq telemetry off`.
**How to avoid:** Pattern 4 (raw-object merge, refuse on invalid JSON, uncached reader).

### Pitfall 6: `define` constants missing in vitest/esbuild harnesses
**What goes wrong:** `ReferenceError: __QUEQUE_TELEMETRY_KEY__ is not defined`.
**How to avoid:** add to `vitest.config.ts` define, `src/env.d.ts`, and the cerebrum esbuild recipe.

### Pitfall 7: Consent prompt corrupting the inline frame
**What goes wrong:** printing while Ink is mounted, or after `zle reset-prompt`.
**How to avoid:** print after unmount + `clearScrollReserve()` (INLINE_SURFACE_CLEAR restores the reserve-top save), then erase the line before exit. Test with a real-hooks render harness (cerebrum 2026-10-11 recipe) or `script -q /dev/null` pty (cerebrum 2026-10-17).

### Pitfall 8: Package registry/CDN flakes inside containers
**What goes wrong:** `apk`/Docker Hub TLS timeouts were observed this session.
**How to avoid:** retry installs 3× with backoff in `install-distro-deps.sh`; `fail-fast: false` on matrices.

### Pitfall 9: Leaking identifiers through "harmless" fields
**What goes wrong:** free-form strings (distro `PRETTY_NAME`, full zsh version with build tags, error messages) become fingerprints or carry paths.
**How to avoid:** enums with `other`, tight regexes, a strictObject everywhere, and a vitest that serializes a full realistic flow (lbuffer `secret-token-xyz`, cwd `/home/alice/proj`) and asserts neither string appears in the body.

### Pitfall 10: Smoke running in CI mode
**What goes wrong:** `CI=true` leaks into the container and changes behaviour (Ink is-in-ci, telemetry gate).
**How to avoid:** `docker run` does not inherit env unless `-e`. Set `QQ_TELEMETRY=0` explicitly. `run-foreground.ts` already forces `interactive: true` [VERIFIED: run-foreground.ts comment "regardless of CI env vars"].

## Code Examples

### Strict lsof parse (Defect 1 fix)
```ts
// Accept only a pure pid list: busybox lsof ignores `-t <path>` and prints every open file.
const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
if (!lines.every((l) => /^\d+$/.test(l))) {
  void appendDebugLog('daemon', 'lsof output ignored', { lines: lines.length });
  return [];
}
return lines.map(Number).filter((n) => n > 0 && n !== process.pid);
```

### Fire-and-forget batch send (D-07)
```ts
export async function sendBatch(host: string, body: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  try {
    await fetchImpl(`${host.replace(/\/+$/, '')}/batch/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // D-07: drop on any failure; never retry, never persist.
  }
}
```
(Join the host and path by string, not `new URL('/batch', base)`. Cerebrum 2026-10-17 warns that drops path prefixes.)

### Allow-list test that fails on any extra field
```ts
it('rejects any property outside the allow list', () => {
  const ok = buildOutcomeEvent(sample);
  expect(telemetryEventSchema.safeParse(ok).success).toBe(true);
  for (const extra of ['cwd', 'lbuffer', 'command', 'message', 'path', 'env', 'hostname', '$ip']) {
    const bad = { ...ok, properties: { ...ok.properties, [extra]: 'x' } };
    expect(telemetryEventSchema.safeParse(bad).success).toBe(false);
  }
});
it('pins the exact allow-list keys', () => {
  expect(Object.keys(queryOutcomeProperties.shape).sort()).toEqual([ /* literal list */ ]);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GITHUB_TOKEN-created PRs never trigger CI | `pull_request` opened/synchronize/reopened from token PRs create runs in approval-required state | per current GitHub docs | Revert PR CI needs one click, or a PAT |
| corepack bundled with Node | Absent from Alpine `nodejs` and Arch packages (Node 25+ dropped it) | probed this session | Use `npm i -g pnpm@<pin>` |
| pnpm as JS package | pnpm 12 ships per-platform native exes incl. musl | pnpm 11/12 | Pin must have a binary for each target (cerebrum) |
| Ubuntu 24.04 newest LTS | Ubuntu 26.04.1 LTS available | 2026 | Nightly `ubuntu:latest` covers it |

**Deprecated/outdated:** `nodejs` from Ubuntu 22.04/24.04 and Debian 13 apt (12/18/20) are too old for the `node24` tsup target [VERIFIED: tsup.config.ts `target: 'node24'`].

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `actions/setup-node` binaries fail on musl | Distro matrix | Low; we use apk anyway |
| A2 | Checkout without git falls back to tarball (no .git); safe.directory needed in containers | CI design | Low; steps are harmless if unneeded |
| A3 | Skipped matrix jobs report only an unexpanded name, so only `ci-ok` should be required | Pattern 1 | Low; `ci-ok` works regardless |
| A4 | Public-repo standard runners are free; doubling push+PR runs is acceptable | Dedupe | Medium; if minutes matter, revisit dedupe |
| A5 | Raw `/batch/` honours `$geoip_disable` like the SDK path | Telemetry | Medium; verify in the PostHog event view at setup; project-level GeoIP off is the fallback |
| A6 | zod 4 exposes `z.uuid()`, `z.iso.datetime()` | Pattern 3 | Low; use `z.string().uuid()` equivalents |
| A7 | ~6–7 min `test:run` per container leg on hosted runners | CI | Low; adjust `timeout-minutes` |
| A8 | Duplicate same-name checks (push and PR events) resolve acceptably for branch protection | Dedupe | Medium; observe on the first PR |
| A9 | Live SDK turn typically 2–4 s; 15 s first-candidate ceiling is generous | Nightly | Low |
| A10 | PR body limit ~65 536 chars | Auto-revert | Low; truncate anyway |
| A11 | Default `run` shell in Alpine container is `sh` | CI | Low; set `shell: sh` explicitly |
| A12 | `crypto.randomUUID` gives an RFC 4122 v4 | Telemetry | Very low |

## Open Questions

1. **Should missing `jq` be a ✗ (exit 1) in `qq doctor`?**
   - What we know: `??` cannot work without jq (verified). D-17's principle is "exit 1 only on hard blockers that make `??` impossible", but its enumerated list omits jq.
   - Recommendation: treat it as ✗ under the D-17 principle. The planner should confirm with the user, or carry it as a decision note. A longer-term alternative is removing the jq dependency from the widget (out of scope).
2. **GITHUB_TOKEN (+ enable repo setting) or the existing `secrets.GH_TOKEN` PAT for revert PRs?**
   - GITHUB_TOKEN: least privilege, but the revert PR's CI needs "Approve workflows to run".
   - PAT: CI runs automatically, and its push triggers CI on `auto-revert/*` (guarded).
   - Recommendation: GITHUB_TOKEN + setting toggle (human checkpoint).
3. **zsh version floor for ✗ vs ⚠.**
   - Oldest tested is 5.8.1 (Ubuntu 22.04). No documented minimum exists in the repo.
   - Recommendation: ✗ below 5.0, ⚠ for 5.0–5.7 ("untested"), ✓ ≥ 5.8 [ASSUMED]. Confirm with the user.
4. **PostHog project creation (human):** create the EU project, enable "Discard client IP data", confirm GeoIP enrichment is not stored for `$geoip_disable` events, and copy the `phc_` key into `tsup.config.ts`. Until then ship an empty key (sending disabled).
5. **Branch protection (human):** add required status check `ci-ok` to `main`. The current protection has PR reviews but no status checks; `enforce_admins` is false [VERIFIED: gh api]. Admin direct pushes to main bypass checks, so the auto-revert PR is the safety net there.

## Environment Availability

| Dependency | Required By | Available (dev machine) | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | local `smoke:distro`, research probes | ✓ | Server 20.10.12 (Docker Desktop, x86_64) | D-16: warn and skip |
| Docker disk space | local smoke | ⚠ 97–99% full during research | ~1.7 GB free | `docker system prune` (user decision) |
| gh CLI | auto-revert (runner has it), research | ✓ | 2.99.0 | — |
| expect | smoke (in container) | ✓ host `/usr/bin/expect`; ✓ all 6 distros | 5.45.4 | — |
| node / pnpm | build, pack | ✓ | v24.14.1 / 12.6.0 | — |
| act | optional local workflow runs | ✓ `/usr/local/bin/act` | — | push to a branch |
| PostHog EU project + key | telemetry send | ✗ | — | ship empty key → sending disabled |
| Repo setting "Actions can create PRs" | auto-revert | ✗ (false) | — | PAT `GH_TOKEN` |
| `ANTHROPIC_API_KEY` repo secret | nightly live | ✓ (used by release.yaml) | — | — |

**Missing dependencies with no fallback:** none blocking. PostHog key and repo setting are human checkpoints.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.4 (`environment: 'node'`, include `tests/**/*.test.ts(x)`) |
| Config file | `vitest.config.ts` (add telemetry defines); new `vitest.live.config.ts` |
| Quick run command | `pnpm exec vitest run <file>` |
| Full suite command | `pnpm test:run` (+ `pnpm typecheck`, `pnpm lint`, `pnpm build`) |
| Distro smoke (local) | `pnpm smoke:distro alpine:3.24` (skips without Docker) |
| Workflow lint | `actionlint` if installed [ASSUMED available via brew]; otherwise a YAML parse via `node -e` + review |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P10-FIX | busybox lsof output ignored; sacrificial child survives | unit/integration | `pnpm exec vitest run tests/lsof-busybox.test.ts` | ❌ Wave 0 |
| P10-FIX | mktemp failure restores buffer, writes nothing to `/` | zsh integration | `pnpm exec vitest run tests/zsh-widget.test.ts -t mktemp` | ✅ file (new case) |
| P10-PREWARM | SIGSTOP/SIGCONT hit; frozen → stale → cold retry → refill; killed → dead miss → refill | integration (real children) | `pnpm exec vitest run tests/prewarm-sleep.test.ts` | ❌ Wave 0 |
| P10-DOCTOR | checks, exit codes, `--json` matches schema, no env values | unit + CLI spawn | `pnpm exec vitest run tests/doctor.test.ts` | ❌ Wave 0 |
| P10-TEL | strict allow list rejects extra keys; key list pinned | unit | `pnpm exec vitest run tests/telemetry-contract.test.ts` | ❌ Wave 0 |
| P10-TEL | env gates; uncached read; atomic write preserves privacy keys; invalid JSON not clobbered; off deletes installId | unit | `pnpm exec vitest run tests/telemetry-config.test.ts` | ❌ Wave 0 |
| P10-TEL | buffer cap, interval/threshold flush, drop on failure, lastSent byte-exact, shutdown flush bounded | unit (fake fetch, fake timers OK here, no child I/O) | `pnpm exec vitest run tests/telemetry-buffer.test.ts` | ❌ Wave 0 |
| P10-TEL | consent prompt only after first accept, default No, persisted, never in CI/no tty/DNT | client (real-hooks or pty) | `pnpm exec vitest run tests/telemetry-consent.test.ts` | ❌ Wave 0 |
| P10-TEL | IPC: telemetry-event / show / reset; old-daemon ignore path | daemon IPC | `pnpm exec vitest run tests/daemon-fetch.test.ts -t telemetry` | ✅ file (new cases) |
| P10-TEL | no lbuffer/cwd/command string ever in serialized body (end-to-end flow) | integration | `pnpm exec vitest run tests/telemetry-contract.test.ts -t leak` | ❌ Wave 0 |
| P10-SMOKE | ?? opens TUI, accept fills buffer, Esc restores, no XDG, C locale, doctor exit 0 | e2e (Docker) | `scripts/smoke-distro.sh alpine:3.24` | ❌ Wave 0 |
| P10-CI | workflow YAML valid; ci-ok gate logic | static + CI run | `actionlint .github/workflows/*.yml` + push branch | ❌ |
| P10-REVERT | last-green selection, restore, dedupe | script unit (fixture JSON for gh api, temp git repo) | `pnpm exec vitest run tests/auto-revert.test.ts` (spawns `scripts/ci/auto-revert.sh` with a stub `gh` on PATH) | ❌ Wave 0 |
| P10-LIVE | contract assertions against real SDK | live (nightly only) | `pnpm exec vitest run --config vitest.live.config.ts` | ❌ |

Note on P10-REVERT: a stub `gh` on PATH in a *unit test of the script's own logic* is a test double for an external API. That is not the "stub in smoke test" anti-pattern; the real end-to-end check is a deliberately failing push on a scratch branch (manual, once).

### Sampling Rate
- **Per task commit:** the touched test file(s) via `pnpm exec vitest run <file>` + `pnpm typecheck`.
- **Per wave merge:** `pnpm test:run && pnpm lint && pnpm build`; after Wave 1, also `pnpm smoke:distro alpine:3.24`.
- **Phase gate:** full suite green locally plus one green CI run on a branch with all six legs. Then one deliberate smoke failure on a scratch branch to observe the auto-revert PR.

### Wave 0 Gaps
- [ ] `tests/lsof-busybox.test.ts`: Defect 1 regression (fake lsof + sacrificial child)
- [ ] `tests/prewarm-sleep.test.ts`: D-04
- [ ] `tests/doctor.test.ts`, `src/contracts/doctor.ts`
- [ ] `tests/telemetry-{contract,config,buffer,consent}.test.ts`
- [ ] `tests/auto-revert.test.ts` (+ fixture gh-api JSON)
- [ ] `vitest.config.ts` defines for `__QUEQUE_TELEMETRY_KEY__` / `__QUEQUE_TELEMETRY_HOST__`; `vitest.live.config.ts`
- [ ] `scripts/smoke-distro.exp` + runner (the smoke is its own test)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes (CI) | Least-privilege `permissions:` per job; `contents: write` only on auto-revert; no `pull_request_target`; secrets only in schedule/dispatch workflow |
| V5 Input Validation | yes | zod strict schemas on IPC (`telemetry-*`), config block, doctor JSON; `assertSafeSocketPath` for any socket arg |
| V6 Cryptography | minimal | `crypto.randomUUID()` for install id; TLS via fetch to PostHog |
| V8 Data Protection / Privacy | yes | Allow-list telemetry, opt-in default No, env kill switches, no IP/GeoIP, no person profiles, `show` transparency |
| V14 Configuration | yes | Config file mode 0600 / dir 0700, refuse-to-clobber |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Fork PR exfiltrates `ANTHROPIC_API_KEY` | Information disclosure | Secret only in `nightly.yml` (schedule/dispatch) + repo guard; no `pull_request_target` |
| Malicious branch name injected into shell in auto-revert | Tampering | Pass `github.ref_name` via `env:`, never inline `${{ }}` in `run:`; quote everywhere |
| Revert-of-revert / PR spam loop | DoS | `auto-revert/` prefix guard, fixed head branch + edit-if-exists, GITHUB_TOKEN no-trigger semantics |
| Local process sends crafted `telemetry-event` to daemon socket | Tampering/Spoofing | Same-user socket in /tmp (existing posture, CR-005 TODO); strict schema means at worst fake counts, never extra data |
| Telemetry leaks commands/paths/prompts | Information disclosure | Strict allow list + leak test + `qq telemetry show` |
| Busybox lsof mass-kill (Defect 1) | DoS | Strict pid-list parse |
| Third-party action compromise on write-token job | Elevation | First-party actions only; `gh` CLI for PRs |
| Doctor JSON in public PR body leaks env | Information disclosure | Doctor never prints env values or secrets; summaries are fixed copy |

## Suggested Plan / Wave Decomposition

**Tracer (thinnest end-to-end slice):** Defect 1 fix + `install-distro-deps.sh` + `smoke-distro.sh` (without the doctor step yet) green on `alpine:3.24` locally. Then a minimal `ci.yml` with `checks` + Alpine-only `test-distro` + `smoke` + `ci-ok`, pushed to a branch. This proves container deps, musl pnpm, PTY drive and the gate in one slice.

| Wave | Plan | Contents | Est. |
|------|------|----------|------|
| 1 | 10-01 Linux defects + deps script | Defect 1 (+ test), Defect 3 (+ zsh test), `scripts/ci/install-distro-deps.sh` | 40–60 min |
| 1 | 10-02 D-04 prewarm simulation | `tests/prewarm-sleep.test.ts` | 25–40 min |
| 1 | 10-03 Telemetry contract + config state | `contracts/telemetry.ts`, `shared/telemetry-config.ts`, qq-config schema key, defines (tsup/vitest/env.d.ts), tests | 45–60 min |
| 1 | 10-04 `qq doctor` | command, contract, tests | 45–60 min |
| 2 | 10-05 Smoke harness (tracer) | `smoke-distro.sh`, runner, `.exp`, `smoke:distro` script; asserts doctor exit 0 | 45–75 min (Docker) |
| 2 | 10-06 Daemon telemetry + IPC + `qq telemetry` | buffer/sender, IPC kinds, `errorKind` on fetch-error, shutdown flush, CLI | 60–90 min |
| 3 | 10-07 CI workflows | `ci.yml` (changes, checks, ci-ok), `distro.yml`, `nightly.yml` + live test/config | 45–60 min + CI wall time |
| 3 | 10-08 Client consent + outcome events | run-foreground hooks, widget `QQ_ZSH_VERSION`, consent tests | 45–60 min |
| 4 | 10-09 Auto-revert + human checkpoints | `scripts/ci/auto-revert.sh` + tests, ci.yml job; checkpoints: repo setting, branch protection `ci-ok`, PostHog project/key | 45–60 min + manual |

Coupling: 10-01 and 10-05 both touch the deps script (10-05 consumes it, so make it sequential). 10-06 and 10-08 both edit `src/contracts/ipc.ts`/`server.ts`/`run-foreground.ts` regions, so keep them in different waves. Total ≈ 7–9 h of executor time plus CI/manual checkpoints.

## Sources

### Primary (HIGH confidence, tool-verified this session)
- Docker probes of `ubuntu:22.04`, `ubuntu:24.04`, `ubuntu:26.04`, `debian:13`, `fedora:44`, `archlinux:latest`, `alpine:3.22/3.23/3.24/edge`: package versions, corepack presence, full test suite per file on alpine/debian, busybox lsof behaviour, PTY smoke prototype
- Repo files read: src/daemon/bootstrap.ts, src/providers/{claude-prewarm,claude-cli,claude-process,claude-default,detect,provider-pin}.ts, src/shared/{qq-config,socket-path}.ts, src/daemon/server.ts, src/contracts/{ipc,shell,candidates}.ts, src/cli/{main,launcher}.ts, src/cli/commands/{daemon,client}.ts, src/client/{run-foreground,result-writer}.ts, shell/zsh/queque.zsh, tests/fixtures/fake-claude-stream.mjs, tests/claude-prewarm.test.ts, tests/claude-cli-prewarm.test.ts, scripts/{smoke-homebrew-docker,docker-homebrew-smoke-runner}.sh, scripts/changed-files-from-base.mjs, lefthook.yml, .github/workflows/{release.yaml,homebrew.yml}, tsup.config.ts, vitest.config.ts, src/env.d.ts, package.json, .nvmrc
- actions/runner source via gh api: StepHost.cs (Alpine detection), externals.sh (node24_alpine 24.22.1)
- PostHog/posthog-js source via gh api: posthog-core-stateless.ts (`$geoip_disable`, `/batch/` payload)
- gh api: repo workflow permissions, branch protection, workflow runs API shape; action release tags
- `npm view pnpm@12.6.0 optionalDependencies` (musl exe present)
- Local git probe: revert range vs restore-to-green

### Secondary (MEDIUM, official docs via Context7/WebFetch)
- docs.github.com: GITHUB_TOKEN trigger semantics, approval-required PR runs, path-filter Pending checks, skipped job = Success, concurrency fallback, secure-use (Actions creating PRs)
- posthog.com/docs/api/capture, /docs/api/overview, /docs/libraries/node, /docs/privacy/data-collection, /docs/privacy/data-storage
- nodejs.org/docs/latest-v24.x/api/net.html (IPC path limits)

### Tertiary (LOW)
- WebSearch on setup-node + musl (no authoritative statement found; claim tagged ASSUMED)
- [PostHog GeoIP plugin README](https://github.com/PostHog/posthog-plugin-geoip/blob/main/README.md) (`$geoip_disable` documented for the plugin)

## Metadata

**Confidence breakdown:**
- Distro install matrix / defects: HIGH (reproduced in Docker)
- CI semantics (gates, tokens, filters): MEDIUM-HIGH (official docs + repo API probes; not yet exercised in a run)
- Telemetry wire format/privacy flags: MEDIUM (docs + SDK source; `$geoip_disable` on raw batch unconfirmed)
- Auto-revert mechanics: HIGH for git, MEDIUM for GitHub API edge cases
- D-04 recipe: HIGH (code paths read; not executed)

**Research date:** 2026-10-28
**Valid until:** ~2026-11-27 (distro `:latest` tags and action majors move monthly)
