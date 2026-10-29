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
| 10-01-T1 | 01 | 1 | P10-SMOKE | T-10-03 | no key forwarded; only `claude` faked | e2e (Docker) | `pnpm smoke:distro alpine:3.24` | ❌ W0 | ⬜ pending |
| 10-01-T2 | 01 | 1 | P10-FIX | T-10-01 | non-numeric lsof output never signals a pid | integration + in-Alpine | `pnpm exec vitest run tests/lsof-busybox.test.ts tests/daemon-bootstrap.test.ts` and `pnpm test:distro alpine:3.24 tests/lsof-busybox.test.ts tests/daemon-bootstrap.test.ts` | ❌ W0 | ⬜ pending |
| 10-01-T3 | 01 | 1 | P10-SMOKE | T-10-04 | CI never skips the smoke | e2e (Docker) | `pnpm smoke:distro alpine:3.24 && pnpm smoke:distro debian:13` | ❌ W0 | ⬜ pending |
| 10-02-T1 | 02 | 1 | P10-PREWARM | T-10-06 | — | integration (real children) | `pnpm exec vitest run tests/prewarm-sleep.test.ts tests/claude-prewarm.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-T2 | 02 | 1 | P10-FIX | T-10-05 | mktemp failure restores buffer, writes nothing to `/` | zsh integration | `pnpm exec vitest run tests/zsh-widget.test.ts` | ✅ | ⬜ pending |
| 10-03-T1/T2 | 03 | 1 | P10-DOCTOR | T-10-07 | doctor JSON never contains env values | unit + CLI | `pnpm exec vitest run tests/doctor.test.ts` | ❌ W0 | ⬜ pending |
| 10-04-T1..T3 | 04 | 1 | P10-TEL | T-10-10, T-10-11 | strict allow list; key-preserving atomic config write; empty key = no endpoint | unit | `pnpm exec vitest run tests/telemetry-contract.test.ts tests/telemetry-config.test.ts tests/telemetry-endpoint.test.ts` | ❌ W0 | ⬜ pending |
| 10-05-T1 | 05 | 2 | P10-CI | T-10-16 | path filter fails open | unit (temp git repos) | `pnpm exec vitest run tests/code-changed.test.ts` | ❌ W0 | ⬜ pending |
| 10-05-T2 | 05 | 2 | P10-SMOKE | — | doctor exit 0 in the smoke | e2e (Docker) | `pnpm smoke:distro alpine:3.24 --out "${TMPDIR:-/tmp}/qq-smoke-p05"` | ❌ W0 | ⬜ pending |
| 10-05-T3 | 05 | 2 | P10-CI | T-10-14, T-10-15 | no secrets on push/PR events; first-party actions | static | `actionlint .github/workflows/ci.yml .github/workflows/distro.yml` | ❌ | ⬜ pending |
| 10-06-T1..T3 | 06 | 2 | P10-TEL | T-10-18..T-10-22 | buffer cap, drop on failure, byte-exact show, enum error kinds | unit + IPC | `pnpm exec vitest run tests/telemetry-buffer.test.ts tests/telemetry-ipc.test.ts tests/error-kind.test.ts` | ❌ W0 | ⬜ pending |
| 10-07-T1/T2 | 07 | 3 | P10-REVERT | T-10-23..T-10-27 | branch names via env; no revert-of-revert; least privilege | script unit (stub gh) + static | `pnpm exec vitest run tests/auto-revert.test.ts` and `actionlint .github/workflows/ci.yml` | ❌ W0 | ⬜ pending |
| 10-08-T1/T2 | 08 | 3 | P10-LIVE | T-10-28 | secret only on schedule/dispatch | static + live (nightly) | `pnpm exec vitest list --config vitest.live.config.ts` and `actionlint .github/workflows/nightly.yml` | ❌ | ⬜ pending |
| 10-09-T1/T2 | 09 | 3 | P10-TEL | T-10-32..T-10-34 | `off` deletes install id and resets the buffer | unit | `pnpm exec vitest run tests/telemetry-cli.test.ts tests/doctor.test.ts` | ❌ W0 | ⬜ pending |
| 10-10-T1/T2 | 10 | 3 | P10-TEL | T-10-36, T-10-37 | no lbuffer/cwd/command/message ever in a sent body; client-side gate | unit + integration | `pnpm exec vitest run tests/telemetry-events.test.ts tests/environment-shape.test.ts tests/client-result.test.ts` | ❌ W0 | ⬜ pending |
| 10-11-T1/T2 | 11 | 4 | P10-TEL | T-10-40..T-10-42 | consent default No; once; never in CI/no tty/DNT | unit + PTY smoke | `pnpm exec vitest run tests/telemetry-consent.test.ts` and `pnpm smoke:distro alpine:3.24` | ❌ W0 | ⬜ pending |
| 10-11-T3 | 11 | 4 | all | T-10-43 | phase gate | full suite | `pnpm test:run && pnpm typecheck && pnpm lint && pnpm build` | ✅ | ⬜ pending |
| 10-12-T2 | 12 | 5 | P10-CI, P10-REVERT | T-10-44..T-10-46 | six green legs; one revert PR | CI (GitHub) | `gh run list --workflow ci.yml --branch ci/phase-10-verify --event push --limit 1 --json conclusion --jq '.[0].conclusion'` | ❌ | ⬜ pending |
| 10-13-T2 | 13 | 6 | P10-TEL | T-10-47..T-10-49 | key baked only after a human decision; no $ip/GeoIP | build + manual | `pnpm build && grep -c "phc_" dist/cli/app.js` | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

(Numbering follows the 13 PLAN.md files written by the planner; the RESEARCH.md 9-plan suggestion was re-sliced to keep each plan under the 100k-token smart zone.)

---

## Wave 0 Requirements

- [ ] `tests/lsof-busybox.test.ts` — Defect 1 regression (fake lsof + sacrificial child)
- [ ] `tests/prewarm-sleep.test.ts` — D-04
- [ ] `tests/doctor.test.ts`, `src/contracts/doctor.ts`
- [ ] `tests/telemetry-{contract,config,endpoint,buffer,ipc,cli,events,consent}.test.ts`, `tests/error-kind.test.ts`, `tests/environment-shape.test.ts`, `tests/code-changed.test.ts`
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
