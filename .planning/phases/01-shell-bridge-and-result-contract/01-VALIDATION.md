---
phase: 1
slug: shell-bridge-and-result-contract
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-01
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest` `4.0.4` |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm vitest run tests/shell-contract.test.ts -x` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run tests/shell-contract.test.ts -x`
- **After every plan wave:** Run `pnpm vitest run`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01-01 | 1 | SHL-02 | unit | `pnpm vitest run tests/shell-contract.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01-01 | 1 | SHL-02, SHL-04 | unit | `pnpm vitest run tests/shell-contract.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-02-01 | 01-02 | 2 | SHL-01, SHL-02 | integration | `pnpm vitest run tests/zsh-widget.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-02-02 | 01-02 | 2 | SHL-03, SHL-04 | integration | `pnpm vitest run tests/zsh-widget.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-03-01 | 01-03 | 2 | RUN-01 | integration | `pnpm vitest run tests/daemon-bootstrap.test.ts -x` | ❌ W0 | ⬜ pending |
| 01-03-02 | 01-03 | 2 | SHL-03, SHL-04 | unit | `pnpm vitest run tests/client-result.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` — includes `vitest`, `tsup`, `typescript`, and `pnpm` scripts
- [ ] `vitest.config.ts` — test configuration exists and runs under `pnpm vitest run`
- [ ] `tests/shell-contract.test.ts` — covers SHL-02 and SHL-04 contract behavior
- [ ] `tests/client-result.test.ts` — covers SHL-03 and SHL-04 result application logic
- [ ] `tests/daemon-bootstrap.test.ts` — covers RUN-01 bootstrap and reconnect path
- [ ] `tests/zsh-widget.test.ts` or equivalent spawned-`zsh` smoke harness — covers SHL-01

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Literal `??` opens the client in an interactive shell session without breaking editing flow | SHL-01 | Requires live `zsh` + ZLE behavior beyond unit tests | Source the widget in a local `zsh`, type normal `?` and `??`, confirm single `?` has no lag and `??` opens the client |
| `Esc` returns to the exact pre-trigger shell buffer | SHL-03 | Best validated in a real interactive shell buffer | Type a mixed `LBUFFER`/`RBUFFER` line, trigger `??`, press `Esc`, confirm the line is unchanged |
| Accepted result writes the split buffers back into the live shell line correctly | SHL-04 | End-to-end shell mutation is easiest to validate manually in addition to unit tests | Use a deterministic client result fixture that returns `replace-buffer`, then confirm `LBUFFER` and `RBUFFER` match the expected shell line |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
