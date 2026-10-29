# Phase 10: Linux distro CI harness and anonymous telemetry - Context

**Gathered:** 2026-10-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Catch environment breakage before it reaches main, make zsh support stable across major Linux distros, and add opt-in, privacy-safe error/usage reporting. Deliverables (from ROADMAP.md, with item 3 amended by D-13–D-16 below):

1. `ci.yml`: `checks` job (lint, typecheck, `test:run`, build) + vitest-in-containers matrix (ubuntu 22.04/24.04, debian stable, fedora, arch, alpine); nightly against `:latest`.
2. `scripts/smoke-distro.sh <image>`: generalised from `smoke-homebrew-docker.sh`, installs from `pnpm pack`, drives a real zsh PTY with `fake-claude-stream.mjs` as `claude`; `smoke` matrix job.
3. ~~lefthook pre-push Docker smoke~~ → remote smoke on every push with auto-revert PR on failure (D-13–D-16).
4. `qq doctor`.
5. Opt-in telemetry to PostHog with a strict zod allow-list.

Out of scope: bash adapter (separate phase).

</domain>

<decisions>
## Implementation Decisions

### Live LLM in CI
- **D-01:** PR runs and the distro/smoke matrices never call a real model — they use `tests/fixtures/fake-claude-stream.mjs` as `claude`. Exactly one live job exists: a nightly Ubuntu job using an `ANTHROPIC_API_KEY` repo secret against the SDK path (CI cannot do Claude Code `/login`). It must not run on forked-PR events (secret exposure).
- **D-02:** Live job assertions are contract-level: ≥1 candidate arrives, it passes the zod candidate schema, no `request failed` / `response truncated` in the daemon log, and arrival is under a latency ceiling (Claude picks a generous value). Never assert the specific command text.
- **D-03:** Live job failure turns the nightly red and is NOT a required check — a provider outage must never block merges. No auto-issue.
- **D-04 (folded todo):** "Stale prewarm after laptop sleep" (09.1 IN-03) is covered by vitest simulation, run on every PR: SIGSTOP/SIGCONT the prewarmed child, kill it out from under the daemon, and advance fake timers; assert the next query detects the dead/stale process, runs cold, and re-prewarms. No container sleep simulation.

### Telemetry backend
- **D-05:** PostHog Cloud **EU** (`eu.i.posthog.com`). No self-hosting. — **Reversibility:** costly — moving region later means a new project and losing history; shipped builds have the host baked in.
- **D-06:** Identity is a random install UUID generated at opt-in, stored in qq config, never derived from hostname/user/MAC. `qq telemetry off` deletes it.
- **D-07:** Transport is raw `fetch` to PostHog `/batch` from the daemon — no `posthog-node` dependency. In-memory buffer, flushed on interval and on daemon shutdown; on any failure the batch is dropped. No disk queue.
- **D-08:** The public `phc_` project key is baked into the build via tsup `define`; `QQ_TELEMETRY_HOST` and `QQ_TELEMETRY_KEY` env vars override it (tests, forks). — **Reversibility:** one-way — released binaries carry the key forever; rotating it orphans old installs' events.

### Telemetry consent & payload
- **D-09:** The opt-in ask is a one-time `/dev/tty` prompt shown after the **first successful (accepted) `??`**: a single line, default **No**. Asked once ever; the answer (yes or no) persists in config. It never shows when there is no TTY, in CI, or when `DO_NOT_TRACK` / `QQ_TELEMETRY=0` / `CI` is set (those also force telemetry off regardless of config). `qq init zsh` stays silent and pipeable (carries forward 08 D-05). This replaces the roadmap's "opt-in at `qq init`".
- **D-10:** Allow-listed event families (and nothing else):
  - **Errors:** an error-kind enum (e.g. `auth_missing`, `provider_timeout`, `socket_failed`, `parse_failed`, …) + provider kind. No messages, no stack traces.
  - **Query outcome:** per `??` — `accepted` | `escaped` | `error`, candidate count, provider kind.
  - **Environment shape:** os, arch, distro id, zsh major.minor, qq version, node major, Zellij present (bool).
- **D-11:** Latency is **not** collected (not even bucketed) — the user excluded it.
- **D-12:** `qq telemetry show` prints the exact pending in-memory buffer plus the last sent batch (kept in memory only), byte-for-byte what leaves the machine.
- Carried from roadmap: strict zod allow-list in `src/contracts/telemetry.ts`; never prompts, buffers, commands, paths, env; vitest fails on any field outside the allow list; `qq telemetry status|on|off|show`.

### Smoke gating (replaces roadmap item 3)
- **D-13:** No Docker smoke in lefthook pre-push. Pre-push keeps only its existing fast jobs (typecheck, lint changed, affected tests). The user asked to avoid local pre-push smoke and rely on remote CI.
- **D-14:** CI (checks + container matrix + smoke) triggers on **push to every branch** plus `pull_request`. Claude may add path filters to keep doc-only pushes off the smoke matrix and may dedupe push+PR runs on the same SHA.
- **D-15:** When the smoke fails on a push, the workflow opens an **auto-revert PR** against that branch reverting the offending commit(s). The PR body includes the failing distro(s), `qq doctor --json` output and the PTY log. Deterministic; no LLM fix attempt.
- **D-16:** The "warn and skip if Docker isn't running" answer was given before D-13 and is now moot; if any local smoke script entry remains (e.g. a `pnpm smoke:distro` convenience script), it warns and skips when Docker is unavailable.

### qq doctor
- **D-17:** Exit 1 only on hard blockers that make `??` impossible: zsh missing/too old, socket path over the platform limit, no writable runtime dir/socket location. Missing provider, odd TERM, non-UTF-8 locale and conflicting widgets are warnings (exit 0) — so smoke runs with fake-claude pass and assert exit 0.
- **D-18:** Output is a ✓/⚠/✗ human checklist with a one-line fix hint per item, plus `--json` with a stable shape (consumed by smoke and by D-15 revert PR bodies; pasteable into bug reports).
- **D-19 (post-research, 2026-10-28):** Missing `jq` is a hard blocker in `qq doctor` (exit 1) — the zsh widget depends on it, so `??` is impossible without it. Smoke/CI images install jq.
- **D-20 (post-research):** zsh version thresholds: fail (exit 1) below 5.0, warn 5.0–5.7, pass ≥ 5.8 (oldest CI-tested, Ubuntu 22.04).

### Auto-revert & telemetry key (post-research)
- **D-21:** Auto-revert PRs are opened with `GITHUB_TOKEN` (least privilege), not the `GH_TOKEN` PAT. Requires the human to enable "Allow GitHub Actions to create and approve pull requests" (human checkpoint); CI on the revert PR needs a manual approve/re-run.
- **D-22:** No PostHog key exists yet. Builds bake an **empty** key, and an empty key means the sender never sends (no network call). A human checkpoint at the end of the phase: create the PostHog EU project, enable "Discard client IP data", supply the `phc_` key, and verify `$ip`/GeoIP absence in the event view.

### Claude's Discretion
- Exact pinned image tags for PR runs vs `:latest` nightly, and Alpine Node install details.
- Latency ceiling for D-02; flush interval/batch size for D-07.
- Exact error-kind enum values; exact prompt copy for D-09.
- How the auto-revert identifies the offending commit range (e.g. last green SHA on that branch → HEAD) and dedupes repeat revert PRs.
- Which checks are marked required in branch protection (checks + container matrix + smoke yes; live nightly no).

### Folded Todos
- **09.1 live check: stale prewarm after laptop sleep (IN-03)** (`2026-10-13-09.1-stale-prewarm-after-sleep.md`) — originally a manual live check; folded as vitest simulation per D-04.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` §Phase 10 — scope items 1–5 (item 3 superseded by D-13–D-16; "opt-in at `qq init`" superseded by D-09)

### Prior decisions that constrain this phase
- `.planning/phases/08-zero-config-install-and-provider-detection/08-CONTEXT.md` — D-05: `qq init zsh` is pipeable, no interactive prompts; D-02 provider pin resolution (doctor's provider check)
- `.planning/phases/09.1-provider-latency-and-cancellation/09.1-CONTEXT.md` — D-01 `~/.config/qq/config.json` via `src/shared/qq-config.ts`; D-11/D-12 prewarm semantics (for D-04)
- `.planning/phases/09-installed-only-command-awareness/09-CONTEXT.md` — D-04 privacy posture (only public catalog names leave the machine)
- `.planning/PROJECT.md` — privacy-forward defaults

### Existing harness to generalise
- `scripts/smoke-homebrew-docker.sh`, `scripts/docker-homebrew-smoke-runner.sh` — base for `smoke-distro.sh`
- `tests/fixtures/fake-claude-stream.mjs` — fake `claude` stream-json CLI (scenarios incl. success/auth/hang)
- `lefthook.yml` — current pre-push jobs (keep; do not add Docker smoke)
- `.github/workflows/release.yaml`, `.github/workflows/homebrew.yml` — existing workflow conventions (`.nvmrc` node-version-file)

### Todos
- `.planning/todos/pending/2026-10-13-09.1-stale-prewarm-after-sleep.md` — folded (D-04)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/shared/qq-config.ts`: config loader — home for telemetry consent flag, asked-once marker and install UUID.
- `src/shared/socket-path.ts`: socket is `/tmp/qq-<uid>.sock` (not `$XDG_RUNTIME_DIR`) — doctor's socket-length/writability check targets this; smoke's "unset `$XDG_RUNTIME_DIR` works" assertion must still hold.
- `src/providers/detect.ts`, `src/providers/provider-pin.ts`: provider detection for doctor's provider (warning-level) check.
- `src/contracts/`: zod contract home — add `telemetry.ts` beside `ipc.ts`, `candidates.ts`.
- `scripts/changed-files-from-base.mjs`: changed-file detection, reusable for path filtering/revert range.

### Established Patterns
- CLI subcommands registered in `src/cli/main.ts` (cac); commands in `src/cli/commands/`.
- Interactive prompts go to `/dev/tty`, never stdout (08 D-05).
- Daemon owns long-lived state (`src/daemon/server.ts`) — telemetry buffer lives here.

### Integration Points
- Client accept path (`src/client/result-writer.ts` / `run-foreground.ts`) — trigger point for the first-success consent prompt (D-09) and query-outcome events.
- Daemon shutdown path — final telemetry flush.

</code_context>

<specifics>
## Specific Ideas

- User explicitly wants to avoid local pre-push smoke and have failures surface remotely as an auto-revert PR.
- `qq doctor --json` doubles as the diagnostic payload in revert PR bodies.

</specifics>

<deferred>
## Deferred Ideas

- Latency telemetry (bucketed TTFC / time-to-done) — considered and excluded (D-11); revisit only with explicit user approval.
- Claude-authored fix PRs on smoke failure (claude-code-action) — considered, rejected in favour of deterministic auto-revert.

### Reviewed Todos (not folded)
- **09.1 live check: SDK path with a real ANTHROPIC_API_KEY** (`2026-10-13-09.1-sdk-path-live-check.md`) — user kept it as a manual todo. Note: the D-01 nightly live job partially overlaps (SDK path, contract assertions) but does not cover the Esc-abort log check.

</deferred>

---

*Phase: 10-linux-distro-ci-harness-and-anonymous-telemetry*
*Context gathered: 2026-10-28*
