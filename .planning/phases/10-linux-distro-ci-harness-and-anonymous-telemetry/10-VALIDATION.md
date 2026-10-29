---
phase: "10"
slug: "linux-distro-ci-harness-and-anonymous-telemetry"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-28"
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.4 |
| **Config file** | `vitest.config.ts` (add telemetry defines); new `vitest.live.config.ts` |
| **Quick run command** | `pnpm exec vitest run <file>` |
| **Full suite command** | `pnpm test:run && pnpm typecheck && pnpm lint && pnpm build` |
| **Distro smoke** | `pnpm smoke:distro alpine:3.24` (warns and skips without Docker) |
| **Estimated runtime** | ~90 seconds (full suite); ~3–5 min per distro smoke |

---

## Sampling Rate

- **After every task commit:** touched test file(s) via `pnpm exec vitest run <file>` + `pnpm typecheck`
- **After every plan wave:** `pnpm test:run && pnpm lint && pnpm build`; after Wave 2 also `pnpm smoke:distro alpine:3.24`
- **Before `/gsd-verify-work`:** full suite green locally plus one green CI run with all six distro legs
- **Max feedback latency:** 120 seconds (unit); smoke excluded

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01 | 01 | 1 | P10-FIX | DoS (busybox lsof) | non-numeric lsof output never signals a pid | integration | `pnpm exec vitest run tests/lsof-busybox.test.ts` | ❌ W0 | ⬜ pending |
| 10-01 | 01 | 1 | P10-FIX | — | mktemp failure restores buffer, writes nothing to `/` | zsh integration | `pnpm exec vitest run tests/zsh-widget.test.ts -t mktemp` | ✅ | ⬜ pending |
| 10-02 | 02 | 1 | P10-PREWARM | — | N/A | integration | `pnpm exec vitest run tests/prewarm-sleep.test.ts` | ❌ W0 | ⬜ pending |
| 10-03 | 03 | 1 | P10-TEL | Info disclosure | strict allow list rejects extra keys | unit | `pnpm exec vitest run tests/telemetry-contract.test.ts tests/telemetry-config.test.ts` | ❌ W0 | ⬜ pending |
| 10-04 | 04 | 1 | P10-DOCTOR | Info disclosure | doctor JSON never contains env values | unit + CLI | `pnpm exec vitest run tests/doctor.test.ts` | ❌ W0 | ⬜ pending |
| 10-05 | 05 | 2 | P10-SMOKE | — | N/A | e2e (Docker) | `scripts/smoke-distro.sh alpine:3.24` | ❌ W0 | ⬜ pending |
| 10-06 | 06 | 2 | P10-TEL | Info disclosure / Tampering | buffer cap, drop on failure, no leaks | unit + IPC | `pnpm exec vitest run tests/telemetry-buffer.test.ts tests/daemon-fetch.test.ts -t telemetry` | ❌ W0 | ⬜ pending |
| 10-07 | 07 | 3 | P10-CI | Secret exfiltration | no secrets on PR events | static + CI | `actionlint .github/workflows/*.yml` | ❌ | ⬜ pending |
| 10-08 | 08 | 3 | P10-TEL | Info disclosure | consent default No; never in CI/no tty/DNT | client | `pnpm exec vitest run tests/telemetry-consent.test.ts` | ❌ W0 | ⬜ pending |
| 10-09 | 09 | 4 | P10-REVERT | Tampering / DoS | branch names via env; no revert-of-revert | script unit | `pnpm exec vitest run tests/auto-revert.test.ts` | ❌ W0 | ⬜ pending |
| 10-LIVE | 07 | 3 | P10-LIVE | Secret exfiltration | nightly-only | live | `pnpm exec vitest run --config vitest.live.config.ts` | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

(Plan/task numbering above follows the RESEARCH.md suggested decomposition; the planner may renumber.)

---

## Wave 0 Requirements

- [ ] `tests/lsof-busybox.test.ts` — Defect 1 regression (fake lsof + sacrificial child)
- [ ] `tests/prewarm-sleep.test.ts` — D-04
- [ ] `tests/doctor.test.ts`, `src/contracts/doctor.ts`
- [ ] `tests/telemetry-{contract,config,buffer,consent}.test.ts`
- [ ] `tests/auto-revert.test.ts` (+ fixture gh-api JSON)
- [ ] `vitest.config.ts` defines for telemetry key/host; `vitest.live.config.ts`
- [ ] `scripts/smoke-distro.exp` + runner (the smoke is its own test)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Auto-revert PR opens on real smoke failure | P10-REVERT | needs a real GitHub push + Actions run | push a deliberately broken commit to a scratch branch; confirm `auto-revert/<branch>` PR with distro, doctor JSON, PTY log |
| PostHog receives events without IP/GeoIP | P10-TEL | external service | opt in locally, run `??`, check PostHog EU event view for `$ip` absence |
| `ci-ok` is a required check on `main` | P10-CI | repo admin setting | GitHub branch protection settings |
| Actions may create PRs | P10-REVERT | repo admin setting | Settings → Actions → Workflow permissions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
