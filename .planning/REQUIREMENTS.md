# Requirements: QueQue

**Defined:** 2026-04-30
**Core Value:** Turn natural-language intent into a shell command that feels native to the terminal workflow, not bolted on top of it.

## v1 Requirements

### Shell Integration

- [ ] **SHL-01**: User can trigger QueQue by typing a literal `??` while editing a `zsh` command line.
- [ ] **SHL-02**: Text already typed before the `??` trigger is captured as request context.
- [ ] **SHL-03**: User can dismiss QueQue with `Esc` and return to the shell with no buffer changes.
- [ ] **SHL-04**: User can confirm a suggested command and have it written back into the live shell buffer with a correct cursor position.

### Intent and Context

- [x] **INT-01**: Tool classifies the user request into a broad intent category before gathering extra context.
- [x] **INT-02**: Tool always includes base shell context such as query text, current working directory, shell, platform, and TTY metadata.
- [x] **INT-03**: Tool gathers extra context only when it is relevant to the inferred intent instead of assuming repo/code context for every request.
- [ ] **INT-04**: Tool routes requests with confidence below `0.8` into a clarification flow inside the TUI. *(Deferred — Phase 5)*

### Command Suggestions

- [ ] **CMD-01**: Tool returns a ranked list of command candidates for requests with confidence at or above `0.8`.
- [ ] **CMD-02**: Each command candidate includes a short explanation of what the command will do.
- [ ] **CMD-03**: User can navigate command candidates with keyboard-only controls and confirm a selection.
- [x] **CMD-04**: Tool never auto-executes commands in v1; it only returns them to the shell buffer.

### TUI Experience

- [ ] **TUI-01**: Trigger opens a fuzzy-finder-style TUI with initial keyboard focus in the input area.
- [ ] **TUI-02**: Low-confidence clarification stays inside the same TUI instead of bouncing the user into a separate prompt flow. *(Deferred — Phase 5)*
- [ ] **TUI-03**: TUI can show clarifying turns and then return a refined command candidate list or final command. *(Deferred — Phase 5)*

### Provider and Runtime

- [ ] **PRV-01**: Tool can call Claude using `ANTHROPIC_API_KEY`.
- [ ] **PRV-02**: Provider integration is isolated behind a provider interface so more models/providers can be added later.
- [ ] **PRV-03**: Every LLM backend implements the same adapter contract for direct suggestion, clarification continuation, structured confidence/result parsing, and error mapping.
- [x] **RUN-01**: A background daemon keeps repeat invocations fast and avoids paying full startup cost on every use.
- [ ] **RUN-02**: If the daemon is missing or stale, the client can recover without corrupting shell state.

### Safety and Extensibility

- [ ] **SAFE-01**: Errors and provider failures surface cleanly without mutating the shell buffer.
- [x] **EXT-01**: Internal registries exist for shell adapters, context providers, provider backends, and storage/extension hooks.

### CI, Diagnostics and Telemetry (Phase 10)

IDs and scope defined in `.planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-RESEARCH.md`.

- [x] **P10-CI**: `ci.yml` runs the checks job and a vitest-in-containers matrix (ubuntu 22.04/24.04, debian, fedora, arch, alpine) on push and PR; nightly runs the `:latest` images.
- [x] **P10-SMOKE**: `scripts/smoke-distro.sh <image>` drives a real zsh PTY with a fake `claude` against the `pnpm pack` tarball; a `smoke` matrix job runs it per distro.
- [x] **P10-REVERT**: A smoke failure on push opens one auto-revert PR with diagnostics.
- [x] **P10-DOCTOR**: `qq doctor` and `qq doctor --json` report install health without leaking env values.
- [x] **P10-TEL**: Telemetry is opt-in and anonymous: strict event contract, one-time consent, daemon buffer, PostHog `/batch` sender, `qq telemetry` commands.
- [x] **P10-LIVE**: A nightly job runs the live SDK contract test.
- [x] **P10-PREWARM**: A vitest simulation covers stale prewarm after sleep (SIGSTOP/SIGCONT and killed children).
- [x] **P10-FIX**: Linux portability defects are fixed (busybox `lsof` output, unguarded `mktemp`).

## v2 Requirements

### Shell Expansion

- **BASH-01**: User can invoke QueQue from `bash` with equivalent buffer-replacement behavior.
- [x] **ZSHX-01**: User can use QueQue on non-macOS `zsh` environments. (Done in Phase 10: CI and smoke pass on six Linux distros.)

### History and Personalization

- **HIST-01**: User can opt into local history for queries, accepted commands, and follow-up context.
- **HIST-02**: User can clear local history and disable persistence per feature area.

### Provider and Plugin Growth

- **LLM-01**: Tool supports additional hosted providers behind the same provider interface.
- **LLM-02**: Tool supports local model backends for privacy-sensitive usage.
- **PLG-01**: Tool supports a public plugin manifest and capability-based plugin loading model.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-executing the selected command | Safety and trust are more important than saving the final Enter key in v1 |
| Browser-based chat companion | The product thesis is seamless terminal-native interaction |
| Prompt takeover / alternate shell replacement | Users should return to the same shell buffer, not a different shell UX |
| Persistent history enabled by default | Privacy-forward defaults are required for the first release |
| Public plugin marketplace | Extension architecture matters now, external plugin distribution does not |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHL-01 | Phase 1 | Pending |
| SHL-02 | Phase 1 | Pending |
| SHL-03 | Phase 1 | Pending |
| SHL-04 | Phase 1 | Pending |
| RUN-01 | Phase 1 | Complete |
| INT-01 | Phase 2 | Complete |
| INT-02 | Phase 2 | Complete |
| INT-03 | Phase 2 | Complete |
| EXT-01 | Phase 2 | Complete |
| PRV-01 | Phase 3 | Pending |
| PRV-02 | Phase 3 | Pending |
| PRV-03 | Phase 3 | Pending |
| CMD-01 | Phase 3 | Pending |
| CMD-02 | Phase 3 | Pending |
| SAFE-01 | Phase 3 | Pending |
| TUI-01 | Phase 4 | Pending |
| CMD-03 | Phase 4 | Pending |
| RUN-02 | Phase 4 | Pending |
| INT-04 | Phase 5 | Deferred |
| TUI-02 | Phase 5 | Deferred |
| TUI-03 | Phase 5 | Deferred |
| CMD-04 | Phase 6 | Complete |
| P10-CI | Phase 10 | Complete |
| P10-SMOKE | Phase 10 | Complete |
| P10-REVERT | Phase 10 | Complete |
| P10-DOCTOR | Phase 10 | Complete |
| P10-TEL | Phase 10 | Complete |
| P10-LIVE | Phase 10 | Complete |
| P10-PREWARM | Phase 10 | Complete |
| P10-FIX | Phase 10 | Complete |
| ZSHX-01 | Phase 10 | Complete |

**Coverage:**
- v1 requirements: 22 total, plus 8 Phase 10 requirements (P10-*)
- v2 requirements pulled forward: ZSHX-01 (Phase 10)
- Mapped to phases: 31
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-30*
*Last updated: 2026-10-30 after Phase 10 (P10-* IDs added, ZSHX-01 done)*
