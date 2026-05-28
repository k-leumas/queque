---
phase: 3
slug: claude-fast-path-and-ranked-suggestions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-14
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.4 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm test:run` |
| **Full suite command** | `pnpm test:run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:run`
- **After every plan wave:** Run `pnpm test:run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | PRV-02 | — | N/A | unit | `pnpm test:run -- tests/claude-provider.test.ts` | ✅ | ⬜ pending |
| 03-01-02 | 01 | 0 | SAFE-01 | Tamper-1 | error kind never mutates shell buffer | unit | `pnpm test:run -- tests/shell-contract.test.ts tests/client-result.test.ts` | ✅ | ⬜ pending |
| 03-01-03 | 01 | 1 | PRV-01, PRV-02, PRV-03 | — | N/A | unit | `pnpm test:run -- tests/claude-provider.test.ts` | ✅ | ⬜ pending |
| 03-01-04 | 01 | 1 | CMD-01, CMD-02 | Tamper-2 | candidateListSchema rejects malformed response | unit | `pnpm test:run -- tests/claude-provider.test.ts` | ✅ | ⬜ pending |
| 03-02-01 | 02 | 1 | SAFE-01 | Tamper-1 | error ShellResult written on fetchCandidates rejection | unit | `pnpm test:run -- tests/client-result.test.ts` | ✅ | ⬜ pending |
| 03-03-01 | 03 | 1 | SAFE-01 | Tamper-1 | ZSH widget no-ops on error kind | unit | `pnpm test:run -- tests/zsh-widget.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/claude-provider.test.ts` — remove `modelListMock` dependency; add `QQ_MODEL` env override test; add hardcoded model constant assertion (PRV-01, PRV-02, PRV-03)
- [ ] `tests/shell-contract.test.ts` — add positive test for `{ kind: 'error', message: '...' }` variant (SAFE-01)
- [ ] `tests/client-result.test.ts` — add test for error ShellResult written when `fetchCandidates` rejects (SAFE-01)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Error message appears in Zellij pane as `"QueQue: <reason> — press any key"` | SAFE-01, D-12 | Requires live Zellij session | (1) Invoke `??` with `ANTHROPIC_API_KEY` unset. (2) Observe error message in floating pane. (3) Press any key — pane closes, buffer unchanged. |

---

## Known Threats

| Threat | STRIDE | Mitigation |
|--------|--------|------------|
| Tamper-1: malformed Claude response injecting shell commands | Tampering | `candidateListSchema.parse()` rejects non-conforming responses before write |
| Tamper-2: error message containing shell metacharacters written to buffer | Tampering | `error` kind never mutates shell buffer — ZSH `_qq_apply_result` no-ops |
| Tamper-3: `ANTHROPIC_API_KEY` leaking into debug log | Information Disclosure | Key passed to Anthropic constructor, never logged (existing behavior) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
