---
phase: 11-multi-shell-trigger-support-bash-and-fish
verified: 2026-11-15T09:10:00Z
status: passed
score: 82/82 must-haves verified (1 by override)
covered_files: [".github/workflows/ci.yml", ".github/workflows/homebrew.yml", ".github/workflows/release.yaml", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-01-PLAN.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-01-SUMMARY.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-02-PLAN.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-02-SUMMARY.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-03-PLAN.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-03-SUMMARY.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-04-PLAN.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-04-SUMMARY.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-05-PLAN.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-05-SUMMARY.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-06-PLAN.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-06-SUMMARY.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-07-PLAN.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-07-SUMMARY.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-08-PLAN.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-08-SUMMARY.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-09-PLAN.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-09-SUMMARY.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-10-PLAN.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-10-SUMMARY.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-11-PLAN.md", ".planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-11-SUMMARY.md", "README.md", "docs/INSTALL.md", "scripts/ci/bash-version-check.sh", "scripts/ci/install-distro-deps.sh", "scripts/smoke-distro-runner.sh", "scripts/smoke-distro.exp", "scripts/smoke-distro.sh", "shell/README.md", "shell/bash/queque.bash", "shell/zsh/queque.zsh", "src/cli/commands/client.ts", "src/cli/commands/doctor.ts", "src/cli/commands/init-provider.ts", "src/cli/commands/init.ts", "src/cli/main.ts", "src/client/instant-frame.ts", "src/client/run-foreground.ts", "src/client/telemetry-events.ts", "src/client/tool-handoff.ts", "src/context/base-context.ts", "src/contracts/doctor.ts", "src/contracts/request.ts", "src/contracts/shell.ts", "src/contracts/telemetry.ts", "src/providers/claude.ts", "src/registry/bootstrap.ts", "src/shared/command-words.ts", "src/shared/environment-shape.ts", "src/shared/instant-frame-spec.ts", "src/shared/shell-registry.ts", "src/shared/tool-awareness.ts", "tests/bash-widget.test.ts", "tests/helpers/shells.ts", "tests/instant-frame-parity.test.ts", "tests/pty/drive.sh", "tests/shell-names-invariant.test.ts", "tests/shell-pty.test.ts"]
covered_digest: "v3:sha256:1befddbe2da2cb5a6933a4998b28008acd35e754d06e773894d20d3dd6b1f0f2"
behavior_unverified: 0
overrides_applied: 1
gaps: []
human_verification: []
overrides:
  - must_have: "README stays at or under 78 lines, no doc tells users to >> into an rc file, and developer-only variables stay in CONTRIBUTING.md"
    reason: "The line budget was replaced after the phase by user-requested quick task 261115-3qz (shell badge row + supported-platforms table, README 86 lines). The no->> and CONTRIBUTING-only clauses still hold."
    accepted_by: "Samuel Kimama"
    accepted_at: "2026-11-15T09:07:59Z"
---

# Phase 11: Multi-shell trigger support (bash, fish-ready): Verification Report

**Phase Goal:** Ship the literal `??` trigger and picker handoff in bash ≥5.0 (`bind -x`) with zsh parity (instant frame, tool awareness, inline + Zellij), and make every shared seam (request contract, tool handoff, lexer, `qq init`/`qq doctor`, telemetry, PTY harness) shell-aware for zsh/bash/fish so Phase 12 is adapter-only.
**Verified:** 2026-11-15T09:10:00Z
**Status:** passed (one doc line-budget must-have accepted by override on 2026-11-15T09:07:59Z; see Overrides)
**Re-verification:** No. This is the first verification.

ROADMAP gives phase 11 no `success_criteria`, so the must-haves are the union of the `must_haves` blocks in the 11 PLAN files: 82 truths and 6 prohibitions.

## Goal Achievement

### Observable Truths

Truths are grouped by plan. Each row lists every truth in that plan and the evidence I checked myself in the codebase or with a test run.

| # | Truths | Status | Evidence |
|---|--------|--------|----------|
| 01 (12) | bash `??` round trip with lbuffer/rbuffer; accepted result prints the summary, sets the line, runs nothing; cancel/error/missing/malformed restore line and `READLINE_POINT=$QQ_ORIG_POINT`; D-13 history; D-12 refusal and non-interactive silence; shell-parameterized PTY harness (skip locally, fail under CI); empty line; bracketed paste; multibyte char split; no job notice + `set -e`; request without `shell` parses as zsh; CI installs tmux + bash | ✓ VERIFIED | `shell/bash/queque.bash` read in full (594 lines): `_qq_restore_line` used on every restore path, `history -s --`, `local -` + `set +euE +o pipefail`, guards in order (line 21 interactive, line 24 version). `CI=true vitest run tests/shell-pty.test.ts` passed all 19 zsh+bash rows (round-trip, cancel, cancel mid-line `keepmeX tail`, empty, empty cancel, multibyte, vi-insert, paste, prompt-multiline, errexit, handoff-quiet, hostile-env) with no skips. bash-widget b1-b7 passed (b2 ran against /bin/bash 3.2). ci.yml/release.yaml install `zsh jq bash tmux` |
| 02 (4) | `baseContextSchema.shellName` is an enum and copied from `request.shell`; request parsing default/enum/max 40; zsh widget writes `"shell": "zsh"` + `shellVersion`; `SHELL_SYNTAX_INSTRUCTION` + `shellName` in the user prompt for every provider | ✓ VERIFIED | `src/contracts/request.ts:71`, `src/context/base-context.ts:13`, `shell/zsh/queque.zsh:415-416`, `src/providers/claude.ts:360-385`. ollama/openai call `buildPrompt`. shell-contract and claude-provider tests pass |
| 03 (8) | `tools.pending` wait (10 ms poll, 500 ms budget, `pending-timeout`); immediate read without the marker; start early, await late; late inventory feeds steering + `missingTools`; shell-aware reserved words; inventory remembers its shell; functions.txt documented; shell-neutral error copy | ✓ VERIFIED | `src/client/tool-handoff.ts:28-124`, `run-foreground.ts:176` (`readToolHandoff(..., { shell: request.shell })`) awaited at :304, `command-words.ts:333-446` `RES_EXPECT_BY_SHELL`/`RES_LOOP_BY_SHELL`, `run-foreground.ts:274` copy. `client-result.test.ts` "tools.pending held across ensureDaemon" and tool-handoff tests pass |
| 04 (8) | `qq init [shell]` detection; `SHELL_SPECS` registry (fish not shipped); `~/.bashrc` only, macOS hint; bash below 5.0 gate with both copies; fish/undetectable copy, exit 1; idempotent with every source-line form; bash registered with the rc move, never touches `.zshrc`/`.bash_profile`; `qq init provider` intact | ✓ VERIFIED | `src/shared/shell-registry.ts` (fish `shipped: false`), `init.ts:134-233`, `main.ts:101` `init [shell]`, `bootstrap.ts:40` `id: 'bash'`. init-command tests :157/:169 ("never touches .zshrc or .bash_profile", "byte-identical"), init-provider and registry-bootstrap pass |
| 05 (6) | telemetry `shell` enum + `shell_version` major.minor, `zsh` field kept; bash/zsh/old-widget reporting; values that do not fit are dropped; serialized `/batch/` body carries `"shell_version":"5.2"` and no raw build string; old widget reported as zsh; PRIVACY.md updated | ✓ VERIFIED | `telemetry.ts:54,101-103`, `environment-shape.ts:74-118`. `telemetry-events.test.ts:245-254` RAW_NEEDLES (`5.2.21`, `(1)-release`, `.bashrc`) and `:507` wire-body assertion pass |
| 06 (6) | one TS frame oracle shared with the Ink constants; byte parity zsh/bash over the fixture table; bash paints before mktemp, clears on non-zero/mktemp failure, no paint on non-tty or `QQ_INSTANT_FRAME=0`, Zellij writes a file; empty bash line gives no header row (z2) + Esc restores; control characters stripped; `src/shared` imports nothing from upper layers | ✓ VERIFIED | `src/shared/instant-frame-spec.ts`; adapter lines 104-223 and 441-459. `instant-frame-parity.test.ts` (z1, z2, C0/DEL/C1, code-point cut, layer-direction scan) and bash-widget b8/b9/b24 pass. PTY `empty cancel` restores the empty prompt |
| 07 (11) | detached compgen writer with `tools.pending`; compgen exit status never deletes the files; fresh binary listed; two-flag cleanup + `QQ_TOOL_AWARENESS=0`; Zellij floating pane, FIFO `read -t 30`, lbuffer not in argv; timeout restores; mkfifo / `zellij run` failures return quickly with fixed log reasons; dir removed after cancel and crash; prewarm once, silent; hostile aliases/`jq` function; no job notices | ✓ VERIFIED | adapter lines 241-306 and 486-564. bash-widget b10-b23, b26, b27 pass (b12 fresh binary, b14 both cleanup orders, b20 timeout, b22/b23 failure paths, b21 cancel/crash). PTY handoff-quiet and hostile-env pass on bash |
| 08 (8) | doctor bash version floor (fail below 5.0, warn below 5.1); macOS `bash_profile` row; target `--shell` > `$SHELL` > passwd > zsh through the registry; binding row (both keymaps, other widget, paste off, ble.sh); id counts 12/12/13; node row unchanged; `--shell fish` exits 2 with copy; fixed-copy-only output | ✓ VERIFIED | `doctor.ts:202-249` (probe/parser), `:408-439`, `:552-633`, `:835-855`; `main.ts:112` `--shell <name>`. doctor tests pass, including `:511` "never puts environment values, the home directory or file contents in the report" |
| 09 (6) | bash pass on every distro smoke leg; zsh smoke pinned to `--shell zsh`; `bash-versions` job (3.2/4.4 refuse, 5.0 accept) in `ci-ok` needs; Homebrew formula installs `queque.bash`, caveats say `qq init`; no skip under CI; WR-06 artifacts cleared | ✓ VERIFIED | `ci.yml:97-128` (`ci-ok` needs `[changes, checks, distro, bash-versions]`), `homebrew.yml:67`, `release.yaml:189`, `smoke-homebrew-docker.sh:109-111`, `smoke-distro.sh:87`, runner exits 37-39. `gh run view 43634554226`: all bash-versions, test-distro and smoke legs succeeded |
| 10 (7) | shell-neutral docs with the `qq init` + bash examples, `brew install bash` note; undo guidance; `shell/README.md` adapter contract; SHELL_NAMES invariant test; REQUIREMENTS/PROJECT/ROADMAP mapping; README ≤78 lines with no `>>` advice; login-shell advice not required | 6 ✓ VERIFIED, 1 ✗ FAILED | `README.md:30-52`, `docs/INSTALL.md:11-48`, `shell/README.md` (tools.pending, two-flag cleanup, parity, registry steps), `tests/shell-names-invariant.test.ts` passes, `REQUIREMENTS.md:65-66`, `PROJECT.md:38`, `ROADMAP.md:432` Phase 12. **FAILED:** README.md is 86 lines (see Gaps) |
| 11 (6) | macOS bash UAT parity with a live model; Zellij pane; doctor + /bin/bash 3.2 refusal; route recorded; green `ci-ok` on the pushed branch; gate green + OpenWolf records | ✓ VERIFIED (with caveats) | The UAT approval (route A, MacPorts bash 5.3.20, Ollama, zellij 0.44.1) is a human record: in 11-11-SUMMARY and confirmed by the orchestrator, not something I can re-run. `gh` shows run 43634554226 green on `origin/spike/multi-shell-trigger` = 69e3e81. My own gate: typecheck, `biome check .`, shellcheck and actionlint clean. Full suite: 1873/1875, and the 2 failures are known load flakes that pass alone (see Anti-Patterns). `.wolf/anatomy.md` has the `queque.bash` entry |

**Score:** 81/82 truths verified (0 present but behavior-unverified)

Every behavior-dependent truth (cursor restore, cleanup ordering, FIFO timeout, mkfifo/launcher failure, option restore, prewarm once) has a passing named test, so none is left PRESENT_BEHAVIOR_UNVERIFIED.

### Prohibitions (6, all test-tier)

| Plan | Prohibition | Enforcement evidence | Status |
|------|-------------|----------------------|--------|
| 01 | MUST NOT run the chosen command (insertion only) | b5 (static + runtime "puts a command into the line without running it"), PTY rows only print output after Enter | ✓ enforced |
| 01 | MUST NOT leave the shell changed (options, readline vars) | `local -` + `set +euE +o pipefail`; b6 and PTY errexit; adapter calls `bind` only for the two `-x` lines | ✓ enforced |
| 04 | MUST NOT write any file but the chosen rc, append only | init-command :157 and :169; `appendFile` is the only write dep | ✓ enforced |
| 05 | MUST NOT send free-form shell data | telemetry-events RAW_NEEDLES on the serialized body | ✓ enforced |
| 07 | MUST NOT let the scan or prewarm print or change shell state | PTY handoff-quiet, b13, b17; `hash -r` runs only inside the detached subshell | ✓ enforced |
| 08 | MUST NOT print env values, rc contents, home paths or the raw build string | doctor.test :511 canary test | ✓ enforced |

None is flagged or unverified.

### Required Artifacts

`gsd-tools verify.artifacts` passed for all 11 plans (32/32 artifacts). I also checked each one by hand for real content and wiring.

| Artifact | Status | Details |
|----------|--------|---------|
| `shell/bash/queque.bash` | ✓ VERIFIED | 594 lines, sourced by `qq init bash` and run in the PTY harness; contains the frame painter, handoff, prewarm and Zellij path |
| `src/contracts/shell.ts` | ✓ VERIFIED | `SHELL_NAMES`, `shell` defaults to zsh, `shellVersion` max 40 |
| `src/shared/shell-registry.ts` | ✓ VERIFIED | imported by init.ts and doctor.ts |
| `src/shared/instant-frame-spec.ts` | ✓ VERIFIED | imported by client/instant-frame.ts, modal-layout, LoadingSpinner; the parity oracle |
| `src/client/tool-handoff.ts` | ✓ VERIFIED | pending wait wired into run-foreground |
| `src/cli/commands/init.ts`, `doctor.ts` | ✓ VERIFIED | `init [shell]` and `--shell <name>` wired in main.ts |
| `src/contracts/telemetry.ts`, `environment-shape.ts` | ✓ VERIFIED | `shell`/`shell_version` reach the wire body |
| `scripts/ci/bash-version-check.sh`, `scripts/smoke-distro.exp` | ✓ VERIFIED | run by ci.yml and the smoke runner; green in CI |
| `tests/shell-pty.test.ts`, `bash-widget.test.ts`, `instant-frame-parity.test.ts`, `shell-names-invariant.test.ts`, `helpers/shells.ts`, `pty/drive.sh` | ✓ VERIFIED | all run and pass under `CI=true` |
| `shell/README.md` | ✓ VERIFIED | adapter contract for Phase 12 |

### Key Link Verification

`gsd-tools verify.key-links` passed for all 11 plans (28/28). I confirmed the critical ones by hand:

| From | To | Via | Status |
|------|----|-----|--------|
| queque.bash | shell.ts | `jq -n ... shell:"bash", shellVersion:$v` | ✓ WIRED |
| client.ts | run-foreground.ts | `QQ_TEST_RESULT_MODE` fallback | ✓ WIRED |
| run-foreground.ts | tool-handoff.ts | `readToolHandoff(dir, { shell: request.shell })` early, awaited before `withInstalledToolsChunk` | ✓ WIRED |
| tool-awareness.ts | command-words.ts | `inventory.shell` passed to `extractCommandWords` | ✓ WIRED |
| run-foreground → telemetry-events → environment-shape | — | `shellVersion: request.shellVersion` → `collectEnvironmentShape` | ✓ WIRED |
| init.ts / doctor.ts | shell-registry.ts | imports | ✓ WIRED |
| ci.yml | bash-version-check.sh | `docker run bash:TAG` matrix, gated by `ci-ok` | ✓ WIRED |
| homebrew.yml / release.yaml | shell-registry `resolveAdapterPath` | `share/queque/queque.bash` | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| request.json (bash) | lbuffer/rbuffer/shell/shellVersion | `READLINE_LINE` split at `READLINE_POINT`, `$BASH_VERSION` | yes (PTY round trip reaches the client and back) | ✓ FLOWING |
| prompt `shellName` | `request.shell` → base context → `buildPrompt` | request.json | yes (claude-provider bash rows) | ✓ FLOWING |
| telemetry env | `shell`, `shell_version` | request → reportClientTelemetry → wire body | yes (wire-body test) | ✓ FLOWING |
| tool inventory | commands/builtins/functions.txt | detached compgen writer | yes (b10, b12, client-result late-inventory test) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase test files, CI mode, bash 5 | `CI=true QQ_TEST_BASH=/opt/local/bin/bash PATH=/opt/local/bin:$PATH pnpm exec vitest run` on 21 phase files (shell-pty, bash-widget, parity, invariant, registry, init, doctor, tool-handoff, client-result, command-words, tool-awareness, telemetry x3, shell-contract, claude-provider, zsh-widget, intent-router, context-pipeline, registry-bootstrap, init-provider) | 21 files, 949/949 passed, 0 skipped, 30 s | ✓ PASS |
| Full suite (run once) | `QQ_TEST_BASH=... pnpm test:run` | 1873/1875. The failures: b22 (`2048 < 2000` ms bound) and zsh-widget prewarm, at load average 36 | ? flaky, see below |
| Failing tests alone | `vitest run -t b22`, `-t "starts a background ensure call once"` | both pass | ✓ PASS |
| Typecheck / lint | `pnpm typecheck`, `pnpm lint` | exit 0; biome checked 167 files | ✓ PASS |
| Shell/workflow lint | `shellcheck -s bash` adapter, driver, version check; `actionlint` ci/release/homebrew | clean | ✓ PASS |
| CI on the pushed branch | `gh run view 43634554226` | every job success, including ci-ok | ✓ PASS (69e3e81) |

### Probe Execution

Step 7c: SKIPPED. The phase declares no `probe-*.sh`, and none exists under `scripts/*/tests/`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BASH-01 | 11-01 … 11-11 (all 11 plans) | User can invoke QueQue from `bash` with equivalent buffer-replacement behavior | ✓ SATISFIED | PTY round trip and edge parity for bash 5 next to zsh; inline and Zellij paths tested; macOS UAT approved; distro CI green |

No orphaned requirements: REQUIREMENTS.md maps only BASH-01 to Phase 11, and FISH-01 belongs to Phase 12. Note: the REQUIREMENTS.md traceability row (line 125) still says `Pending`. Phase completion should flip it.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (71 phase-modified files) | — | TBD / FIXME / XXX / TODO / HACK / placeholder | none found | — |
| tests/bash-widget.test.ts (b22), tests/zsh-widget.test.ts (prewarm), command-words-fuzz, b12 | — | wall-clock bounds that fail under full-suite load | ⚠️ Warning | Known flakes, tracked in `.planning/todos/pending/2026-11-14-fuzz-single-input-budget.md`. They can redden a CI or pre-push run without a real regression |
| src/shared/shell-registry.ts | 14 | doc comment says "fish in Phase 11" | ℹ️ Info | Stale wording: fish ships in Phase 12 |
| 11-REVIEW-DISPOSITION.md | — | IN-01..IN-06 still `open` | ℹ️ Info | Info-level review items (prompt-head reprint on error paths, circular `qq not found` hint, etc.). None blocks the goal |

### Human Verification Required

None blocks this status. One follow-up is recommended:

### 1. Confirm CI on the post-review commits

**Test:** Push `spike/multi-shell-trigger` (HEAD 18a4f7c, 21 commits after the last green run on 69e3e81) and wait for `ci-ok`.
**Expected:** `checks`, `bash-versions` and all six distro `test-distro` and `smoke` legs are green.
**Why human:** the WR-01..WR-06 fixes changed `shell/bash/queque.bash` (the locale fallback, the jq check, `local -x QQ_RESULT_FILE`, client stderr to the session dir), plus `init.ts`, `shell-registry.ts` and `client.ts`. The macOS tests cover them, but the glibc `C` locale path from WR-01 only runs in the Linux distro legs, and no CI run has covered these commits yet. The macOS UAT was also approved before these fixes.

### Gaps Summary

There is one gap, and it is not code: plan 11-10's must-have caps README.md at 78 lines, and README.md is now 86. The phase met the cap when it finished (69 lines at e0b5d11). The user's later quick task 261115-3qz added a shell badge row and a supported-platforms table, and its PLAN (line 94) says that request replaces the earlier line target. Every substantive part of the phase goal is in the codebase and tested: the bash `??` trigger with zsh parity (instant frame, tool awareness, inline and Zellij), and shell-aware seams (request contract, tool handoff, lexer, `qq init`/`qq doctor`, telemetry, PTY harness, registry with a not-yet-shipped fish entry, adapter contract doc).

**This looks intentional.** To accept the deviation, add this to the VERIFICATION.md frontmatter and re-verify:

```yaml
overrides:
  - must_have: "README stays at or under 78 lines, no doc tells users to >> into an rc file, and developer-only variables stay in CONTRIBUTING.md"
    reason: "The line budget was replaced after the phase by user-requested quick task 261115-3qz (shell badge row + supported-platforms table, README 86 lines). The no->> and CONTRIBUTING-only clauses still hold."
    accepted_by: "Samuel Kimama"
    accepted_at: "2026-11-15T09:07:59Z"
```

The other option is to shrink README.md to 78 lines or fewer, which would undo part of the user's quick-task request. Do not plan a gap-closure phase for this.

---

_Verified: 2026-11-15T09:10:00Z_
_Verifier: Claude (gsd-verifier)_
