---
phase: "11"
slug: "multi-shell-trigger-support-bash-and-fish"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-13"
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `11-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.4 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm exec vitest run tests/<file>.test.ts` |
| **Full suite command** | `pnpm test:run && pnpm typecheck && pnpm lint` |
| **Estimated runtime** | ~5–15 s per shell for the PTY suite, plus a 10–60 s bundle build; parity test ~2–4 s; distro smoke 30–45 s per image |

---

## Sampling Rate

- **After every task commit:** the touched test file(s) via `pnpm exec vitest run <files>` plus `pnpm exec biome check <files>`, `shellcheck -s bash shell/bash/queque.bash`, and `actionlint` on changed workflows
- **After every plan wave:** `pnpm test:run && pnpm typecheck && pnpm lint`
- **Before `/gsd-verify-work`:** full suite green with bash ≥5 present (locally after `brew install bash`, or in CI), plus one `pnpm smoke:distro` leg or a green CI distro matrix
- **Max feedback latency:** ~60 seconds (per-file runs)

---

## Per-Task Verification Map

Task IDs are filled in by the planner. Requirement and decision rows come from research:

| Req / Decision | Behavior | Test Type | Automated Command | File Exists | Status |
|----------------|----------|-----------|-------------------|-------------|--------|
| BASH-01 / D-01 | First `?` inserts, second fires; mid-line, multibyte, vi-insert | PTY | `pnpm exec vitest run tests/shell-pty.test.ts -t bash` | ❌ W0 | ⬜ pending |
| BASH-01 / D-13 | Replace-buffer round trip; cancel restores; history has the query | PTY + unit | `pnpm exec vitest run tests/shell-pty.test.ts tests/bash-widget.test.ts` | ❌ W0 | ⬜ pending |
| BASH-01 | Pasted `??` does not fire | PTY | `pnpm exec vitest run tests/shell-pty.test.ts -t paste` | ❌ W0 | ⬜ pending |
| BASH-01 | Multi-line PS1 head reprinted | PTY | `pnpm exec vitest run tests/shell-pty.test.ts -t prompt-multiline` | ❌ W0 | ⬜ pending |
| D-02 | Request `shell` defaults to zsh; enum accepts bash/fish; old JSON parses | unit | `pnpm exec vitest run tests/shell-contract.test.ts` | ✅ extend | ⬜ pending |
| D-02 | Lexer dialect (bash vs zsh reserved words) | unit | `pnpm exec vitest run tests/command-words.test.ts` | ✅ extend | ⬜ pending |
| D-02 / D-05 | Pending marker waits, reads, times out to null; zsh unchanged | unit | `pnpm exec vitest run tests/tool-handoff.test.ts` | ✅ extend | ⬜ pending |
| D-04 | zsh and bash frame bytes == TS oracle over fixtures (incl. ESC/CSI) | unit | `pnpm exec vitest run tests/instant-frame-parity.test.ts` | ❌ W0 | ⬜ pending |
| D-05 | bash handoff files, marker removed, no job notices, compgen landmine | unit + PTY | `pnpm exec vitest run tests/bash-widget.test.ts -t handoff` | ❌ W0 | ⬜ pending |
| D-06 | `buildPrompt` carries `shellName: bash` + syntax sentence | unit | `pnpm exec vitest run tests/claude-provider.test.ts` | ✅ extend | ⬜ pending |
| D-07 | Zellij path: faked `zellij` gets pane argv; FIFO result applied | unit | `pnpm exec vitest run tests/bash-widget.test.ts -t zellij` | ❌ W0 | ⬜ pending |
| D-08 / D-14 | init detection, `~/.bashrc` write, idempotent; darwin 3.2 refusal | unit | `pnpm exec vitest run tests/init-command.test.ts` | ✅ extend | ⬜ pending |
| D-09 / D-12 | doctor bash_profile warn/ok; fails <5.0 | unit | `pnpm exec vitest run tests/doctor.test.ts` | ✅ extend | ⬜ pending |
| D-10 | Harness runs zsh + bash in PR CI; distro bash smoke | CI | `ci.yml` checks job; `pnpm smoke:distro debian:13` | ❌ W0 | ⬜ pending |
| D-11 | Telemetry `shell`/`shell_version` strict; version shaping | unit | `pnpm exec vitest run tests/telemetry-contract.test.ts tests/environment-shape.test.ts` | ✅ extend | ⬜ pending |
| D-12 | Refusal on bash 3.2/4.4: one line, `?` literal, rc 0 | docker matrix | `docker run --rm -v "$PWD:/w:ro" bash:4.4 bash -ic 'source /w/shell/bash/queque.bash'` | ❌ W0 (CI job) | ⬜ pending |
| D-03 | Docs updated | grep | `grep -n "BASH-01 \| Phase 11" .planning/REQUIREMENTS.md` | ✅ | ⬜ pending |
| Pitfall | Non-interactive source prints nothing | unit | `pnpm exec vitest run tests/bash-widget.test.ts -t non-interactive` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/helpers/shells.ts`: find bash ≥5 and tmux; skip locally, throw under `CI`
- [ ] `tests/pty/drive.sh` + `tests/shell-pty.test.ts`: bundle build in `beforeAll` (reuse the `tests/bundle-startup.test.ts` tsup pattern)
- [ ] `tests/bash-widget.test.ts`: mirrors `tests/zsh-widget.test.ts` helper style
- [ ] `tests/instant-frame-parity.test.ts`
- [ ] CI: tmux in `ci.yml` and `release.yaml`; `bash tmux` in `scripts/ci/install-distro-deps.sh`; `bash-versions` docker job in `ci-ok` needs
- [ ] Smoke: `scripts/smoke-distro.exp` shell parameter + bash pass in `scripts/smoke-distro-runner.sh`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| macOS login-shell bash (Homebrew bash 5) end-to-end with a live model | BASH-01, D-09, D-14 | No macOS CI runner; this machine lacks bash ≥5 until `brew install bash` | `brew install bash`, `qq init bash`, open a new Terminal tab running bash 5, type `list files ??`, pick, confirm the buffer and history |
| Feel parity: the first `?` is instant and the frame paints before Node | D-04 | Perceptual | Compare zsh and bash side by side, inline and in Zellij |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
