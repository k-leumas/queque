---
phase: 8
slug: zero-config-install-and-provider-detection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-25
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Focus for 08-02: Claude CLI subprocess + SDK rescue. 08-01 detection tests already exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.4 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm test:run -- tests/claude-cli-provider.test.ts tests/provider-resolver.test.ts tests/registry-bootstrap.test.ts` |
| **Full suite command** | `pnpm test:run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:run -- tests/claude-cli-provider.test.ts tests/provider-resolver.test.ts tests/registry-bootstrap.test.ts`
- **After every plan wave:** Run `pnpm test:run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-02-01 | 02 | 1 | EXT-01 | T-08-02-01 | `claude-cli` registered; spawn argv never includes tokens or `--bare` | unit | `pnpm test:run -- tests/claude-cli-provider.test.ts tests/registry-bootstrap.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 1 | RUN-01 / D-08 / D-09 | T-08-02-02 | PATH CLI first; SDK rescue on fail+key; combined timeout ≤ 25s | unit | `pnpm test:run -- tests/claude-cli-provider.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-03 | 02 | 1 | D-10 / D-11 / D-12 / D-13 | T-08-02-03 | No `claudeAuthPresent` fetch gate; no “not wired yet”; `/login` error copy; no vendor fallthrough | unit | `pnpm test:run -- tests/claude-cli-provider.test.ts tests/provider-resolver.test.ts tests/client-result.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/claude-cli-provider.test.ts` — mock `execFile`/`spawn`; argv contract; stdin ignore; timeout remaining; auth-fail rescue; ENOENT rescue; D-13 copy; no fake binary
- [ ] `tests/provider-resolver.test.ts` — replace “not wired yet” expectations; `claude-cli` returns adapter; ollama/openai-key → Claude default
- [ ] `tests/client-result.test.ts` — replace ollama-not-wired case; none/claude-cli paths write error or candidates via composite
- [ ] `tests/registry-bootstrap.test.ts` — assert `claude-cli` backend id
- [ ] Export `buildPrompt` / `parseCandidates` (or move to shared module) so CLI tests can assert prompt privacy without duplicating filter logic
- [ ] Framework install: none — vitest already configured

*Existing infrastructure covers vitest; Wave 0 is new CLI-adapter tests plus resolver rewrites.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live `??` with Keychain `/login` and no `ANTHROPIC_API_KEY` | Phase 8 SC #1, #7 | Needs real Claude Code session | Trigger `??` on macOS logged in via `/login`; candidates appear |
| Logged-out CLI with `.env.local` key (SDK rescue) | D-09 | Needs real CLI auth failure | Log out of `claude`, set key, trigger `??`; SDK path succeeds |
| Zellij pane does not show Claude TUI chrome | RUN-01 | Interactive pane | Confirm spawn stdin ignored; no Claude Code TUI in floating pane |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
