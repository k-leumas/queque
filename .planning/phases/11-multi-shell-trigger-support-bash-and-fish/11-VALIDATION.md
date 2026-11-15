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

| Req / Decision | Plan / Task | Behavior | Test Type | Automated Command | File Exists | Status |
|----------------|-------------|----------|-----------|-------------------|-------------|--------|
| BASH-01 / D-01 | 11-01 T1, T2 | First `?` inserts, second fires; mid-line, multibyte, vi-insert | PTY | `CI=true pnpm exec vitest run tests/shell-pty.test.ts -t bash` | ❌ W0 (11-01 T1) | ⬜ pending |
| BASH-01 / D-13 | 11-01 T1, T2 | Replace-buffer round trip; cancel restores; history has the query | PTY + unit | `CI=true pnpm exec vitest run tests/shell-pty.test.ts tests/bash-widget.test.ts` | ❌ W0 (11-01) | ⬜ pending |
| BASH-01 | 11-01 T1, T2 | Cancel/error/malformed restore the line AND the cursor (`QQ_ORIG_POINT`), proven mid-line | PTY + unit | `CI=true pnpm exec vitest run tests/shell-pty.test.ts -t cancel` and `CI=true pnpm exec vitest run tests/bash-widget.test.ts -t b4` | ❌ W0 (11-01 T2) | ⬜ pending |
| BASH-01 | 11-01 T2 | Pasted `??` does not fire (shells 5.1+; on a 5.0 shell the row skips with the stated reason) | PTY | `CI=true pnpm exec vitest run tests/shell-pty.test.ts -t paste` | ❌ W0 (11-01 T2) | ⬜ pending |
| BASH-01 | 11-01 T2 | Multi-line PS1 head reprinted | PTY | `CI=true pnpm exec vitest run tests/shell-pty.test.ts -t prompt-multiline` | ❌ W0 (11-01 T2) | ⬜ pending |
| D-02 | 11-01 T1, 11-02 T1 | Request `shell` defaults to zsh; enum accepts bash/fish; old JSON parses | unit | `pnpm exec vitest run tests/shell-contract.test.ts` | ✅ extend | ⬜ pending |
| D-02 | 11-01 T1 | Hand-built `NormalizedRequest` fixtures (intent-router, context-pipeline) carry `shell`, so the defaulted field keeps typecheck green | typecheck | `pnpm typecheck` | ✅ extend | ⬜ pending |
| D-02 | 11-03 T2 | Lexer dialect (bash vs zsh reserved words) | unit | `pnpm exec vitest run tests/command-words.test.ts` | ✅ extend | ⬜ pending |
| D-02 / D-05 | 11-03 T1 | Pending marker waits, reads, times out to null; zsh unchanged; `runForegroundClient` holds `tools.pending` across `ensureDaemon` and the late inventory feeds both the steering chunk and the annotations | unit | `pnpm exec vitest run tests/tool-handoff.test.ts tests/client-result.test.ts` | ✅ extend | ⬜ pending |
| D-02 | 11-10 T2 | Every SHELL_NAMES entry round-trips through request, registry, telemetry, doctor ids | unit | `pnpm exec vitest run tests/shell-names-invariant.test.ts` | ❌ (11-10 T2) | ⬜ pending |
| D-04 | 11-06 T1, T2 | zsh and bash frame bytes == TS oracle over fixtures (incl. ESC/CSI); `src/shared` imports nothing from client/ui/cli/daemon | unit | `CI=true pnpm exec vitest run tests/instant-frame-parity.test.ts` | ❌ (11-06 T1) | ⬜ pending |
| D-05 | 11-07 T1 | bash handoff files, marker removed, no job notices, compgen landmine; session dir removed after cancel and client crash (b21) | unit + PTY | `CI=true pnpm exec vitest run tests/bash-widget.test.ts tests/shell-pty.test.ts -t handoff` and `CI=true pnpm exec vitest run tests/bash-widget.test.ts -t b21` | ❌ (11-07 T1) | ⬜ pending |
| D-06 | 11-02 T1, T2 | `buildBaseContext` copies `shell`; `buildPrompt` carries `shellName: bash` + syntax sentence; every provider adapter calls `buildPrompt` | unit | `pnpm exec vitest run tests/claude-provider.test.ts` | ✅ extend | ⬜ pending |
| D-07 | 11-07 T2 | Zellij path: faked `zellij` gets pane argv; FIFO result applied; dead pane times out; mkfifo failure (b22) and a non-zero launcher (b23) restore fast with a fixed log reason | unit | `CI=true pnpm exec vitest run tests/bash-widget.test.ts -t b1[89]` / `-t b2[023]` | ❌ (11-07 T2) | ⬜ pending |
| D-08 / D-14 | 11-04 T1, T2, T3 | init detection, `~/.bashrc` write, idempotent over `source`/`.` forms; never touches `~/.zshrc` or `~/.bash_profile` for bash; bash registered with the rc rewrite; darwin 3.2 refusal; `init [shell]` | unit | `pnpm exec vitest run tests/init-command.test.ts tests/shell-registry.test.ts tests/registry-bootstrap.test.ts tests/init-provider.test.ts` | ✅ extend | ⬜ pending |
| D-09 / D-12 | 11-08 T1, T2 | doctor bash_profile warn/ok; fails below 5.0; `--shell` | unit | `pnpm exec vitest run tests/doctor.test.ts` | ✅ extend | ⬜ pending |
| D-10 | 11-01 T3, 11-09 T1 | Harness runs zsh + bash in PR CI; distro bash smoke; host clears bash artifacts (WR-06) and tails the bash log on failure | CI | `ci.yml` checks job; `CI=true pnpm smoke:distro debian:13` | ❌ W0 (11-01 T3) | ⬜ pending |
| D-11 | 11-05 T1, T2 | Telemetry `shell`/`shell_version` strict; version shaping; serialized `/batch/` wire body has no raw build string | unit | `pnpm exec vitest run tests/telemetry-contract.test.ts tests/environment-shape.test.ts tests/telemetry-events.test.ts` | ✅ extend | ⬜ pending |
| D-12 | 11-09 T2 | Refusal on bash 3.2/4.4: one line, `?` literal, rc 0; 5.0 accepts | docker matrix | `docker run --rm -e QQ_DAEMON_PREWARMED=1 -v "$PWD:/w:ro" bash:4.4 sh /w/scripts/ci/bash-version-check.sh refuse` | ❌ (11-09 T2, CI job `bash-versions`) | ⬜ pending |
| D-03 | 11-10 T2 | Docs updated (already applied; verified) | grep | `grep -cF "\| BASH-01 \| Phase 11 \|" .planning/REQUIREMENTS.md` | ✅ | ⬜ pending |
| Pitfall | 11-01 T2 (b1) | Non-interactive source prints nothing | unit | `pnpm exec vitest run tests/bash-widget.test.ts -t b1` | ❌ W0 (11-01 T2) | ⬜ pending |
| BASH-01 (macOS) | 11-11 T2 | Homebrew bash UAT, inline + Zellij, live model; green CI | manual | see Manual-Only Verifications | n/a | ⬜ pending |

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
| macOS Homebrew bash 5 end-to-end with a live model | BASH-01, D-09, D-12, D-14 | No macOS CI runner; this machine lacks bash ≥5 until `brew install bash` | `brew install bash`, `qq init bash`, start bash with route A (`--noprofile --rcfile ~/.bashrc -i`) or route B (`-l` only after doctor's `bash_profile` row is ok), type `find big files??`, pick, confirm the buffer and history; `/bin/bash --noprofile --rcfile ~/.bashrc -i` must print the refusal line; record the route (11-11 T2) |
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
