---
phase: "9"
slug: "installed-only-command-awareness"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-08"
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.4 (`environment: 'node'`, includes `tests/**/*.test.ts(x)`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm exec vitest run tests/<file>.test.ts` (never `pnpm test:run -- …`, which runs the whole suite) |
| **Full suite command** | `pnpm test:run && pnpm typecheck && pnpm lint` |
| **Estimated runtime** | ~60 seconds (full suite; fuzz child capped at 15 s) |

---

## Sampling Rate

- **After every task commit:** Run the quick-run command for the touched test files, plus `pnpm typecheck`
- **After every plan wave:** Run `pnpm test:run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Task IDs filled in by the planner (2026-10-08). Rows stay keyed by success criterion; the end-to-end tracer is 09-01-T1 (`pnpm exec vitest run tests/client-result.test.ts tests/candidate-select.test.tsx`), and the manual SC-1/SC-2 checks run in the 09-05-T3 human checkpoint.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-T2 (+T1 e2e) | 09-01 | 1 | SC-1 | T-09-03 | N/A | zsh smoke | `pnpm exec vitest run tests/zsh-widget.test.ts -t "tool handoff"` | ✅ file / ❌ cases | ⬜ pending |
| 09-01-T2 | 09-01 | 1 | SC-2 | — | N/A | zsh timing (regression guard, median of 5 < 25 ms, median printed — D-19) | `pnpm exec vitest run tests/zsh-widget.test.ts -t "handoff timing"` | ❌ W0 | ⬜ pending |
| 09-01-T1, 09-01-T3, 09-04-T1, 09-04-T2 | 09-01, 09-04 | 1, 2 | SC-3 | T-09-10, T-09-11, T-09-20 | Install form only accepts safe package words; comment/heredoc commands are never brace-wrapped | unit + component | `pnpm exec vitest run tests/tool-awareness.test.ts tests/candidate-select.test.tsx tests/controls-line.test.tsx tests/modal-layout.test.ts` | ❌ W0 / ✅ | ⬜ pending |
| 09-02-T1 (+09-01-T3) | 09-02 | 2 | SC-4 | — | N/A | unit table (40 spike cases) | `pnpm exec vitest run tests/command-words.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-T2 | 09-02 | 2 | SC-5 | T-09-01, T-09-05 | Malformed model output cannot hang/crash the client | child-process fuzz | `pnpm exec vitest run tests/command-words-fuzz.test.ts` | ❌ W0 | ⬜ pending |
| 09-03-T1, 09-03-T2, 09-05-T2 | 09-03, 09-05 | 2, 3 | SC-6 | T-09-07, T-09-08, T-09-15 | Only catalog names reach the model (privacy, D-04) | unit + static guard | `pnpm exec vitest run tests/steering.test.ts tests/claude-provider.test.ts tests/claude-cli-provider.test.ts` | ❌ W0 / ✅ | ⬜ pending |
| 09-05-T1 | 09-05 | 3 | Compat | T-09-14, T-09-19 | Unknown catalog names are filtered daemon-side, never a dropped request | unit (stale daemon replaced; catalog drift filtered) | `pnpm exec vitest run tests/daemon-bootstrap.test.ts tests/daemon-fetch.test.ts` | ✅ / ❌ cases | ⬜ pending |
| 09-01-T1, 09-01-T2 | 09-01 | 1 | Fallback | T-09-02, T-09-17 | Handoff failures never reach the widget ERR trap | unit + zsh smoke (missing handoff → no chunk, no flags, no error; partial write / unwritable dir → no files, status 0) | `pnpm exec vitest run tests/tool-handoff.test.ts tests/client-result.test.ts` and `pnpm exec vitest run tests/zsh-widget.test.ts -t "tool handoff"` | ❌ W0 / ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/shared/command-words.ts`, `src/shared/tool-awareness.ts`, `src/client/tool-handoff.ts`, `src/providers/steering.ts` — throw-on-call stubs with public exports so RED tests pass `tsc --noEmit`
- [ ] `tests/fixtures/command-words-cases.ts` — port the 40 cases from `.claude/skills/spike-findings-tui-llm/sources/002-candidate-binary-check/cases.mjs`
- [ ] `tests/fixtures/command-words-fuzz-child.mjs` — modes `fuzz N`, `one <s>`, `deep N`
- [ ] `tests/command-words.test.ts`, `tests/command-words-fuzz.test.ts`, `tests/tool-awareness.test.ts`, `tests/tool-handoff.test.ts`, `tests/steering.test.ts`, `tests/controls-line.test.tsx`

No framework install is needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A tool installed in the same shell is treated as installed on the next `??` | SC-1 | Needs a real interactive shell and package manager | In one zsh session: `brew install <tool>`, then type `<intent>??` and confirm candidates using `<tool>` are not flagged |
| Handoff median vs the ~10 ms target | SC-2 | The automated test is a 25 ms regression guard (D-19) under `zsh -f`, which has almost no functions or aliases; the target is recorded, not asserted | Record two numbers in VERIFICATION.md: the median printed by the `handoff timing` test, and the median of 5 `_qq_write_tool_handoff` runs in the user's real interactive shell (09-05 Task 3 step 6) |
| Kill switch inside and outside Zellij | Fallback | Needs a live Zellij pane; the pane gets argv, not later shell exports | `QQ_TOOL_AWARENESS=0` (shell parameter) then `??` shows no ⊘, once with `ZELLIJ` set and once without (09-05 Task 3 step 7) |
| Linux `apt` / `dnf` / `pacman` install form | SC-3 | No Linux host in the human check; CI's Ubuntu runner only exercises injected inventories | Optional: on a Linux box, Tab on a flagged row shows `sudo apt install …` with both ⚠ and ⊘, and Enter only inserts it |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
