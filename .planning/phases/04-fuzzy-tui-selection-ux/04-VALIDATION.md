---
phase: 04
slug: fuzzy-tui-selection-ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-16
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.4 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm test:run` |
| **Full suite command** | `pnpm test:run` |
| **Estimated runtime** | ~2.5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:run`
- **After every plan wave:** Run `pnpm test:run` (full suite, ~114 tests)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | CMD-03 | — | N/A | unit | `pnpm test:run -- tests/candidate-select.test.tsx` | ✅ (extend) | ⬜ pending |
| 04-01-02 | 01 | 0 | CMD-03 | — | N/A | unit | `pnpm test:run -- tests/candidate-select.test.tsx` | ✅ (extend) | ⬜ pending |
| 04-01-03 | 01 | 0 | CMD-03 | — | N/A | unit | `pnpm test:run -- tests/candidate-select.test.tsx` | ✅ (extend) | ⬜ pending |
| 04-01-04 | 01 | 1 | TUI-01 | — | N/A | unit | `pnpm test:run -- tests/candidate-select.test.tsx` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 0 | RUN-02 | — | resolved flag prevents double FIFO write | unit | `pnpm test:run -- tests/client-result.test.ts` | ✅ (extend) | ⬜ pending |
| 04-02-02 | 02 | 1 | RUN-02 | — | N/A | unit | `pnpm test:run -- tests/daemon-bootstrap.test.ts` | ✅ | ⬜ pending |
| 04-03-01 | 03 | 1 | RUN-02 | — | cancel written on all failure paths | unit | `pnpm test:run -- tests/client-result.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

New test cases needed (extend existing files — no new test files needed):

- [ ] `tests/candidate-select.test.tsx` — `selectedIndex` resets to 0 when query changes (CMD-03 edge case)
- [ ] `tests/candidate-select.test.tsx` — Enter on zero-match filter is a no-op (CMD-03 edge case)
- [ ] `tests/candidate-select.test.tsx` — wrapping: Up at index 0 wraps to last; Down at last wraps to 0 (CMD-03)
- [ ] `tests/client-result.test.ts` — `resolved` flag prevents double FIFO write when `onSelect` and error path race (RUN-02)

*Existing infrastructure (vitest, tsx support) covers all phase requirements — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TUI opens with focus active (input area receives keystrokes immediately) | TUI-01 | Requires live Zellij PTY — can't mock Ink raw mode and Zellij PTY interaction in vitest | Type `??` in a Zellij pane, verify first keystroke after open goes to the search box |
| Pane closes cleanly after selection | CMD-03 | Zellij close-on-exit behavior is not testable in unit tests | Select a candidate, verify Zellij pane closes and command appears in shell buffer |
| Daemon restart recovery under rapid double-invoke | RUN-02 | Requires two live terminal sessions and timing | Open two Zellij panes, trigger `??` in both within 500ms, verify neither hangs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
