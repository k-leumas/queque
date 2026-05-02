---
phase: 2
slug: intent-router-and-context-pipeline
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-01
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm vitest run tests/intent-router.test.ts tests/context-pipeline.test.ts tests/registry.test.ts tests/claude-provider.test.ts` |
| **Full suite command** | `pnpm test:run` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run tests/intent-router.test.ts tests/context-pipeline.test.ts tests/registry.test.ts tests/claude-provider.test.ts`
- **After every plan wave:** Run `pnpm test:run`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | INT-01 | unit | `pnpm vitest run tests/intent-router.test.ts` | ✅ task-local | ⬜ pending |
| 2-01-02 | 01 | 1 | INT-02 | unit | `pnpm vitest run tests/context-pipeline.test.ts tests/client-result.test.ts` | ✅ task-local | ⬜ pending |
| 2-02-01 | 02 | 2 | INT-02 | unit | `pnpm vitest run tests/context-pipeline.test.ts` | ✅ task-local | ⬜ pending |
| 2-02-02 | 02 | 2 | INT-03 | unit | `pnpm vitest run tests/claude-provider.test.ts tests/context-pipeline.test.ts tests/client-result.test.ts` | ✅ | ⬜ pending |
| 2-03-01 | 03 | 3 | EXT-01 | unit | `pnpm vitest run tests/registry.test.ts` | ✅ task-local | ⬜ pending |
| 2-03-02 | 03 | 3 | EXT-01 | unit | `pnpm vitest run tests/registry.test.ts tests/context-pipeline.test.ts tests/claude-provider.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing test infrastructure covers this phase. The referenced test files are task-local TDD artifacts created inside the plans themselves, not separate Wave 0 prerequisites.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Filesystem/media request inside a git repo does not receive repo-specific wording in the final prompt path | INT-03 | Best confirmed with an end-to-end smoke request after the routed pipeline is wired | Run a request such as "rename this png to hero-banner.png" from inside the repo and inspect debug output or prompt assembly to confirm git branch/dirty data is absent |
| Code-oriented request does include routed repo context when relevant | INT-01, INT-03 | End-to-end smoke confirms the router, provider gate, and prompt assembly are connected | Run a request such as "show me the git status command for this repo" and confirm routed git context is present |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or task-local TDD coverage
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No separate Wave 0 prerequisites remain for this phase
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
