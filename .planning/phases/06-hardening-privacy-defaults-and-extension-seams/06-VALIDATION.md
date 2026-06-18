---
phase: 06
slug: hardening-privacy-defaults-and-extension-seams
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-18
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.4 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm test:run` |
| **Full suite command** | `pnpm test:run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:run`
- **After every plan wave:** Run `pnpm test:run` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 6 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 0 | CMD-04 | unit | `pnpm test:run -- tests/privacy-filter.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 0 | CMD-04 | unit | `pnpm test:run -- tests/debug-log.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 0 | CMD-04 | unit | `pnpm test:run -- tests/zsh-widget.test.ts` | ✅ (extend) | ⬜ pending |
| 06-01-04 | 01 | 1 | CMD-04 | unit | `pnpm test:run -- tests/privacy-filter.test.ts tests/context-pipeline.test.ts` | ✅ | ⬜ pending |
| 06-01-05 | 01 | 1 | CMD-04 | unit | `pnpm test:run -- tests/candidate-select.test.tsx` | ✅ (extend) | ⬜ pending |
| 06-02-01 | 02 | 0 | EXT-01 | unit | `pnpm test:run -- tests/provider-resolver.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 1 | EXT-01 | unit | `pnpm test:run -- tests/registry-bootstrap.test.ts tests/client-result.test.ts` | ✅ | ⬜ pending |
| 06-02-03 | 02 | 1 | EXT-01 | unit | `pnpm test:run -- tests/registry-bootstrap.test.ts` | ✅ | ⬜ pending |
| 06-03-01 | 03 | 1 | CMD-04 | manual | grep README.md docs/ for privacy + expansion sections | ✅ | ⬜ pending |
| 06-03-02 | 03 | 1 | CMD-04 | manual | grep docs/SYSTEM_DESGN.md for placeholder language | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/privacy-filter.test.ts` — sensitive path redaction, redactForLog, isFileReadAllowed, isDestructiveCommand
- [ ] `tests/debug-log.test.ts` — redactForLog applied in appendDebugLog output
- [ ] `tests/provider-resolver.test.ts` — resolveAdapter mapping for anthropic-key and Phase 8 kinds
- [ ] Extend `tests/zsh-widget.test.ts` — CMD-04 insertion-only explicit assertions

*Note: partial implementation may exist from quick task 20260617-privacy-config — Wave 0 verifies and fills gaps.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Daily-driver install path (Zellij + inline) | CMD-04 | Requires live terminal | Run `??` with and without Zellij; confirm command lands in buffer only after Enter |
| Privacy config merge at `~/.config/qq/config.json` | CMD-04 | File I/O outside vitest tmp | Add custom sensitive pattern; trigger query with matching git path; confirm stripped from prompt |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 6s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
