---
phase: 11
reviewers: [codex, cursor]
reviewed_at: 2026-11-14T03:14:33Z
plans_reviewed: [11-01-PLAN.md, 11-02-PLAN.md, 11-03-PLAN.md, 11-04-PLAN.md, 11-05-PLAN.md, 11-06-PLAN.md, 11-07-PLAN.md, 11-08-PLAN.md, 11-09-PLAN.md, 11-10-PLAN.md, 11-11-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=high)"
  cursor: "unknown"
model_sources:
  codex: "manual-override"
  cursor: "unknown"
---

# Cross-AI Plan Review — Phase 11

<!-- gsd:plan-revision-conflicts:begin -->
## Plan-Revision Conflicts
<!-- gsd:plan-revision-conflicts:end -->

> Run notes: Claude was skipped as the host runtime. Ollama was detected but skipped: only ≤8B local models, which can't hold the ~95k-token prompt or read the repo. The first Codex run failed because `~/.codex/config.toml` pins `gpt-5.5`, which isn't available on a ChatGPT account. It was re-run with `--model gpt-5.6-terra`. Diagnostics are in `.review-diagnostics/`.

## Codex Review

# Phase 11 Plan Review

Overall: the phase is thoughtfully decomposed and unusually well-tested on paper, but three execution gaps should be fixed before implementation starts: the zsh PTY harness would not load `.zshrc`, bash restore paths omit `READLINE_POINT`, and the macOS UAT starts a login bash without ensuring `.bashrc` is sourced.

## 11-01

**Summary:** Strong tracer-first plan with a real client and PTY round trip, but two defects mean the proposed harness and cancellation behavior do not prove the requirement as written.

**Strengths:**

- It correctly extends the actual shell transport seam, which is currently zsh-only in [`src/contracts/shell.ts:4-15`](/Users/samuel/dev/tui-llm/src/contracts/shell.ts:4), and uses the existing fixture mode in [`src/client/run-foreground.ts:190-203`](/Users/samuel/dev/tui-llm/src/client/run-foreground.ts:190).
- The adapter deliberately follows the existing widget’s insertion-only result application path in [`shell/zsh/queque.zsh:255-318`](/Users/samuel/dev/tui-llm/shell/zsh/queque.zsh:255), rather than adding a separate command execution mechanism.

**Concerns:**

- **HIGH — The zsh PTY leg will not source its rc file.** The driver specifies `ZDOTDIR=RCDIR zsh -d -i` in [`11-01-PLAN.md:212`](/Users/samuel/dev/tui-llm/.planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-01-PLAN.md:212). `-d` disables zsh startup files, including the `.zshrc` that the same plan says sources the adapter. This makes the zsh parity leg either fail or exercise no widget.
- **HIGH — Cancel/error/malformed-result restoration cannot restore the cursor exactly.** The plan restores only `READLINE_LINE` for these cases in [`11-01-PLAN.md:207-208`](/Users/samuel/dev/tui-llm/.planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-01-PLAN.md:207), while first-trigger handling increments `READLINE_POINT`. The stated truth requires exact line and cursor restoration. The existing zsh adapter restores separate left/right buffers in [`shell/zsh/queque.zsh:266-269`](/Users/samuel/dev/tui-llm/shell/zsh/queque.zsh:266), which implicitly restores cursor position; bash needs an explicit saved original point.

**Suggestions:**

- Start zsh as `zsh -i` with isolated `ZDOTDIR`, or explicitly source the generated rc after `zsh -d -i`; do not combine `-d` with a `.zshrc`-based test setup.
- Save `QQ_ORIG_POINT=$(( READLINE_POINT - 1 ))` when consuming the trigger and set `READLINE_POINT=$QQ_ORIG_POINT` on every restoration path. Add a mid-buffer cancel/error PTY assertion.

**Risk Assessment:** **HIGH** until the two issues above are fixed; otherwise the plan’s central zsh+bash parity proof is invalid.

## 11-02

**Summary:** This is a well-scoped contract-and-prompt propagation plan that directly removes the current zsh hardcodes.

**Strengths:**

- It targets the real hardcoded values: `shellName: z.literal('zsh')` in [`src/contracts/request.ts:67-68`](/Users/samuel/dev/tui-llm/src/contracts/request.ts:67) and `shellName: 'zsh'` in [`src/context/base-context.ts:7-16`](/Users/samuel/dev/tui-llm/src/context/base-context.ts:7).
- Updating the zsh request payload is necessary because the widget currently writes only version, tty, cwd, pid, and buffers in [`shell/zsh/queque.zsh:409-418`](/Users/samuel/dev/tui-llm/shell/zsh/queque.zsh:409).
- Keeping the system prompt shell-independent is a good performance choice given the existing prewarm-sensitive client behavior.

**Concerns:**

- **LOW — Provider coverage is asserted mostly through Claude tests.** The plan relies on shared `buildPrompt`, but its test file is only `tests/claude-provider.test.ts`. A future provider could bypass the shared builder without this phase detecting it.

**Suggestions:**

- Add a small invariant test or static assertion covering all provider call sites that they invoke the shared prompt builder.

**Risk Assessment:** **LOW.** The code locations and backward-compatible default are correctly identified.

## 11-03

**Summary:** The pending-marker design addresses a real race in the current client, but it needs an integration test for the proposed “start early, await late” wiring.

**Strengths:**

- It accurately identifies that the current code awaits the handoff before daemon startup in [`src/client/run-foreground.ts:168-180`](/Users/samuel/dev/tui-llm/src/client/run-foreground.ts:168), while the inventory is needed for steering at [`src/client/run-foreground.ts:288-294`](/Users/samuel/dev/tui-llm/src/client/run-foreground.ts:288).
- The no-marker path preserves existing zsh behavior, matching the current fixed-file contract in [`src/client/tool-handoff.ts:6-17`](/Users/samuel/dev/tui-llm/src/client/tool-handoff.ts:6).
- Passing the shell dialect through `ToolInventory` is aligned with the existing later use of inventory in both prompt steering and candidate annotation [`src/client/run-foreground.ts:293`, `404-416`](/Users/samuel/dev/tui-llm/src/client/run-foreground.ts:293).

**Concerns:**

- **MEDIUM — The tests described validate the reader, not the important scheduling behavior.** The plan proposes unit tests for `readToolHandoff`, but no test proves that `runForegroundClient` starts the promise before `ensureDaemon` and awaits it before `withInstalledToolsChunk`. Those are distinct semantics in the current code paths above.

**Suggestions:**

- Add an injected/deferred handoff reader or an integration test that holds `tools.pending`, resolves it after daemon startup, and asserts the provider envelope contains the installed-tools chunk.

**Risk Assessment:** **MEDIUM.** The design is sound; the critical concurrency guarantee needs executable coverage.

## 11-04

**Summary:** The registry and injectable init design are appropriate for making shell support extensible without changing user files beyond the selected rc file.

**Strengths:**

- It replaces the actual one-shell initialization implementation in [`src/cli/commands/init.ts:11-25`](/Users/samuel/dev/tui-llm/src/cli/commands/init.ts:11) and preserves Homebrew’s stable adapter path behavior.
- It correctly plans to register bash beside the current zsh descriptor in [`src/registry/bootstrap.ts:32-36`](/Users/samuel/dev/tui-llm/src/registry/bootstrap.ts:32).
- Injectable dependencies are a substantial improvement over the current direct `homedir`, filesystem, and `process.exit` calls in [`src/cli/commands/init.ts:41-64`](/Users/samuel/dev/tui-llm/src/cli/commands/init.ts:41).

**Concerns:**

- **MEDIUM — Idempotence remains too narrow for a shell-facing installer.** The current `hasShellIntegration` recognizes only `source "…"` syntax in [`src/cli/commands/init.ts:32-38`](/Users/samuel/dev/tui-llm/src/cli/commands/init.ts:32). The plan says to preserve it, so a valid dot-source form (`. "/path/queque.bash"`) can be duplicated by `qq init`, despite the plan’s idempotence guarantee.

**Suggestions:**

- Expand `hasShellIntegration` to recognize both `source` and `.` forms, then add zsh and bash tests for each.

**Risk Assessment:** **MEDIUM.** The main workflow is solid; duplicate rc edits are recoverable but violate the promised idempotence.

## 11-05

**Summary:** This is a disciplined telemetry extension that maintains the strict allow-list model and old-widget fallback.

**Strengths:**

- It preserves the existing strict contract model in [`src/contracts/telemetry.ts:4-18`](/Users/samuel/dev/tui-llm/src/contracts/telemetry.ts:4) instead of forwarding raw shell details.
- The proposed default-to-zsh fallback matches the present `QQ_ZSH_VERSION` collection behavior in [`src/shared/environment-shape.ts:94-103`](/Users/samuel/dev/tui-llm/src/shared/environment-shape.ts:94).
- Threading values at the foreground-client call site is correct because telemetry is currently emitted there in [`src/client/run-foreground.ts:510-516`](/Users/samuel/dev/tui-llm/src/client/run-foreground.ts:510).

**Concerns:**

- No material issue found.

**Suggestions:**

- Keep the raw-build-string leakage canary; it is the most valuable regression test in this plan.

**Risk Assessment:** **LOW.**

## 11-06

**Summary:** The TypeScript oracle plus native painters is the right tradeoff for instant rendering and future fish support.

**Strengths:**

- The shared reference derives from real values currently split across [`src/ui/modal-layout.ts:127-135`](/Users/samuel/dev/tui-llm/src/ui/modal-layout.ts:127), [`src/ui/LoadingSpinner.tsx:4`](/Users/samuel/dev/tui-llm/src/ui/LoadingSpinner.tsx:4), and [`src/ui/CandidateSelect.tsx:37-41`](/Users/samuel/dev/tui-llm/src/ui/CandidateSelect.tsx:37).
- The plan correctly treats the existing zsh painter as the byte-level reference implementation in [`shell/zsh/queque.zsh:88-185`](/Users/samuel/dev/tui-llm/shell/zsh/queque.zsh:88).
- It preserves the client’s existing reserve behavior in [`src/client/instant-frame.ts:48-55`](/Users/samuel/dev/tui-llm/src/client/instant-frame.ts:48).

**Concerns:**

- **LOW — Byte parity is strong but not a complete visual assertion.** The zsh painter’s actual placement relies on widget execution order around its inline paint and cleanup [`shell/zsh/queque.zsh:370-394`, `478-491`](/Users/samuel/dev/tui-llm/shell/zsh/queque.zsh:370). The plan has static placement checks and later UAT, which is adequate, but no automated terminal rendering check can catch all cursor-state interactions.

**Suggestions:**

- Keep the proposed static placement test, and record the final macOS visual UAT result as required rather than treating byte parity as sufficient.

**Risk Assessment:** **MEDIUM** due to terminal-specific behavior, mitigated well by the planned parity suite and UAT.

## 11-07

**Summary:** The plan covers the difficult async handoff, silent background jobs, aliases, and Zellij FIFO path in useful depth.

**Strengths:**

- It correctly builds on the existing zsh structure: tool handoff/prewarm logic exists near [`shell/zsh/queque.zsh:19-56`, `197-210`](/Users/samuel/dev/tui-llm/shell/zsh/queque.zsh:19), and the current Zellij path is at [`shell/zsh/queque.zsh:427-491`](/Users/samuel/dev/tui-llm/shell/zsh/queque.zsh:427).
- The planned two-flag cleanup directly addresses the race introduced by making bash handoff asynchronous.
- Keeping `zellij` unprefixed is justified by function-based testing, while ordinary external commands retain the `command` defense.

**Concerns:**

- **MEDIUM — The Zellij error-path tests omit FIFO creation and launcher failure.** The existing zsh path assumes `mkfifo` succeeds and starts `zellij` without checking the result [`shell/zsh/queque.zsh:429-467`](/Users/samuel/dev/tui-llm/shell/zsh/queque.zsh:429). The bash plan tests a dead pane, but not `mkfifo` failure or an immediate nonzero `zellij run`. Those are distinct failures that can otherwise become a silent cancellation.
  
**Suggestions:**

- Guard `mkfifo`; on failure restore the line, clear any frame, log a fixed reason, and return.
- Add tests for `mkfifo` failure and a fake `zellij` that exits unsuccessfully before writing the FIFO.

**Risk Assessment:** **MEDIUM.** The normal and timeout paths are well designed; setup failures need explicit handling.

## 11-08

**Summary:** The doctor refactor is comprehensive and correctly treats the registry as the single source of shell-specific facts.

**Strengths:**

- It replaces genuinely zsh-specific probes and rc reads in [`src/cli/commands/doctor.ts:57-79`, `215-245`](/Users/samuel/dev/tui-llm/src/cli/commands/doctor.ts:57).
- It preserves the existing privacy discipline: doctor output is deliberately constrained to fixed strings, versions, widget names, and approved paths in [`src/contracts/doctor.ts:4-10`](/Users/samuel/dev/tui-llm/src/contracts/doctor.ts:4).
- The planned explicit bash binding parser is much safer than parsing arbitrary startup output; the existing zsh parser already uses marker-only parsing in [`src/cli/commands/doctor.ts:165-186`](/Users/samuel/dev/tui-llm/src/cli/commands/doctor.ts:165).

**Concerns:**

- No material design gap found.

**Suggestions:**

- Preserve the plan’s canary tests for home paths, rc content, and raw version suffixes; they protect a public-reporting boundary.

**Risk Assessment:** **MEDIUM** because the refactor has broad surface area, not because the proposed design is weak.

## 11-09

**Summary:** The plan appropriately adds real packaged-product smoke coverage, an old-version matrix, and Homebrew shipping changes.

**Strengths:**

- It correctly extends the actual six-image reusable workflow matrix in [`.github/workflows/distro.yml:19-69`](/Users/samuel/dev/tui-llm/.github/workflows/distro.yml:19).
- Adding bash and tmux to distro dependency installation is necessary: the current installer provisions zsh/jq/expect but not tmux, and Alpine lacks an explicit bash package [`scripts/ci/install-distro-deps.sh:94-117`](/Users/samuel/dev/tui-llm/scripts/ci/install-distro-deps.sh:94).
- It correctly updates both Homebrew formula sources; they currently install only `queque.zsh` and show zsh-only caveats [`.github/workflows/homebrew.yml:61-89`](/Users/samuel/dev/tui-llm/.github/workflows/homebrew.yml:61), [`.github/workflows/release.yaml:183-212`](/Users/samuel/dev/tui-llm/.github/workflows/release.yaml:183).

**Concerns:**

- **LOW — Bash smoke diagnostics would be incomplete on failure.** The plan adds `pty-bash-default.log`, but `scripts/smoke-distro.sh` currently tails only three zsh log names on failure [`scripts/smoke-distro.sh:106-114`](/Users/samuel/dev/tui-llm/scripts/smoke-distro.sh:106). Plan 09 does not list this file for modification, making local failures harder to debug.

**Suggestions:**

- Add `pty-bash-default.log`, `doctor-bash.json`, `doctor-bash.txt`, and `bashrc.txt` to local failure reporting and artifact cleanup patterns.

**Risk Assessment:** **MEDIUM.** Functional coverage is strong; improve the diagnostic path.

## 11-10

**Summary:** The documentation and invariant-test plan gives Phase 12 a useful concrete contract rather than relying on prose alone.

**Strengths:**

- It correctly recognizes that current docs and caveats are zsh-specific, as seen in the Homebrew caveat text [`.github/workflows/homebrew.yml:80-85`](/Users/samuel/dev/tui-llm/.github/workflows/homebrew.yml:80).
- The invariant test connects the right future-extension seams: shell request schema, registry, telemetry allow list, doctor ids, and shipped adapters.
- The requested adapter guide directly documents the lifecycle represented by the existing zsh implementation: request JSON, handoff, result application, and redraw [`shell/zsh/queque.zsh:402-425`, `491-510`](/Users/samuel/dev/tui-llm/shell/zsh/queque.zsh:402).

**Concerns:**

- **MEDIUM — Declared dependencies omit plans whose artifacts this documentation describes.** Plan 10 depends on 02/04/05/08, but its required docs describe `tools.pending` from 03/07 and `instant-frame-spec.ts` from 06. If execution honors only `depends_on`, the plan can run before those artifacts exist.

**Suggestions:**

- Add direct dependencies on 06 and 07, or split the generic adapter documentation from the sections specific to the frame and pending-marker protocols.

**Risk Assessment:** **MEDIUM** until the execution dependency graph is made unambiguous.

## 11-11

**Summary:** The final gate appropriately combines automated verification, CI confirmation, and human terminal UX testing, but the macOS UAT sequence does not reliably load the newly installed bash adapter.

**Strengths:**

- It retains a strong full-suite gate, including shellcheck and actionlint, and it acknowledges that the current project has no macOS CI equivalent.
- The UAT checks the real user-visible risks that byte tests cannot: instant feel, insertion-only behavior, history, missing-tool UI, Zellij, and old-bash refusal.

**Concerns:**

- **HIGH — The UAT can test an unconfigured login shell.** Step 1 runs `qq init bash`, which intentionally writes only `.bashrc`; Step 2 then starts `bash -l` without first ensuring `.bash_profile` sources `.bashrc` in [`11-11-PLAN.md`, Task 2]. A macOS login bash reads its login startup file rather than `.bashrc`, exactly why the phase adds the `bash_profile` warning. The UAT may therefore fail before testing BASH-01—or pass only on machines with pre-existing unrelated configuration.

**Suggestions:**

- Make the UAT branch explicit: either start non-login Homebrew bash and `source ~/.bashrc`, or, after the user confirms the standard guarded `.bash_profile` line is present, start `bash -l`.
- Record which route was used in the summary so the approval has reproducible meaning.

**Risk Assessment:** **HIGH** until the UAT setup accurately loads the adapter.

## Cross-plan assessment

The phase has excellent separation of concerns: transport/context, tool handoff, init, telemetry, instant frame, Zellij, doctor, packaging, docs, and UAT are independently testable. The most important fixes are:

1. Fix the 11-01 zsh harness startup and bash cursor restoration.
2. Add a run-foreground integration test for 11-03’s scheduling guarantee.
3. Fix 11-11’s macOS login-shell UAT setup.
4. Make 11-10 explicitly depend on the artifacts it documents.

No repository files were modified during this review.
---

## Cursor Review

# Phase 11 Cross-AI Plan Review

Verified against `/Users/samuel/dev/tui-llm` source (plans under `.planning/phases/11-multi-shell-trigger-support-bash-and-fish/`). Claims checked against live code, not plan text alone.

## 11-01

### Summary
Strong wave-1 tracer: bash adapter + `SHELL_NAMES` schema + fixture PTY harness + CI deps. Scope correctly excludes instant frame / handoff / Zellij (06/07). The biggest hole is schema blast radius — adding `shell` to `shellRequestSchema` changes `NormalizedRequest` via `.extend`, but fixture updates are not in `files_modified`.

### Strengths
- Correctly diagnoses current gaps: no `shell` on `shellRequestSchema` (`src/contracts/shell.ts:8-15`); `parseResultMode` ignores env (`src/cli/commands/client.ts:26-35`); CI installs only `zsh jq` (`ci.yml:67-68`).
- Fixture path is real and usable without LLM (`src/client/run-foreground.ts:190-198`).
- Spike landmines are treated as constraints, not copy-paste (`compgen` exit, sync handoff deferred).
- Skip-locally / fail-under-CI mirrors existing smoke rule (`scripts/smoke-distro.sh:67-74`).

### Concerns
- **HIGH** — `normalizedRequestSchema = shellRequestSchema.extend(...)` (`src/contracts/request.ts:51-56`). `shell: z.enum(...).default('zsh')` makes output-type `shell` required. `tests/context-pipeline.test.ts:17-28` builds `NormalizedRequest` without `shell`; plan `files_modified` omits that (and similar) fixtures → `pnpm typecheck` likely fails after Task 1.
- **MEDIUM** — Must-have citing zsh **z2** at `tests/zsh-widget.test.ts:1009` is wrong: z2 is instant-frame empty-header (`:1009-1010`), and plan 01 sets `QQ_INSTANT_FRAME=0`. Empty-line picker behavior is still needed; the z2 anchor is not.
- **MEDIUM** — Paste scenario assumes bracketed paste (bash **5.1+**) while harness accepts bash `min: [5, 0]` → false `??` trigger on paste under 5.0.
- **LOW** — Spike refusal copy differs from planned `needs bash 5.0+` substring; acceptance still works if substring is stable.

### Suggestions
- Add `shell: 'zsh'` (or spread defaults) to every manual `NormalizedRequest` / `ShellRequest` construction; put those test files in `files_modified`.
- Retarget the empty-line must-have to the PTY `cancel`/empty scenarios, not z2.
- Gate the paste assertion with `bash >= 5.1` or document 5.0 as known-fail for paste-only.

### Risk Assessment
**MEDIUM** — Tracer design is sound; schema/typecheck fallout is the main execution risk.

---

## 11-02

### Summary
Focused, correctly scoped seam for D-06: widen `shellName`, thread `request.shell` into `buildBaseContext`, add a syntax instruction in `buildPrompt`, and teach the zsh widget to emit `shell`/`shellVersion`. Depends on 01’s `SHELL_NAMES` for good reason.

### Strengths
- Hardcoded zsh is real: `z.literal('zsh')` (`src/contracts/request.ts:67-68`), `shellName: 'zsh'` (`src/context/base-context.ts:13`), zsh request heredoc omits `shell` (`shell/zsh/queque.zsh:409-417`).
- Correctly keeps system prompt stable so prewarm argv hashing stays intact; instruction goes in user prompt via `buildPrompt` (`src/providers/claude.ts:370-376`).
- Preserves `QQ_ZSH_VERSION` export (`queque.zsh:425`) for plan 05’s back-compat path.

### Concerns
- **MEDIUM** — After 01, many envelopes still hardcode `shellName: 'zsh'` in tests; Task 1 must prove `buildBaseContext` copies `request.shell` for bash/fish, not only widen the enum.
- **LOW** — One generic `SHELL_SYNTAX_INSTRUCTION` may under-specify bash vs zsh quoting/arrays; acceptable for MVP if UAT watches syntax quality.
- **LOW** — Soft line ranges in `read_first` (e.g. `request.ts` “40-80”) — content exists, but implementers should re-locate anchors.

### Suggestions
- Add an explicit unit test: `buildBaseContext({ ..., shell: 'bash' })` → `base.shellName === 'bash'`, and prompt contains the bash syntax cue.
- Keep provider comment edits (`ollama.ts` / `openai.ts` FIFO wording) in the same PR as the instruction change so wording doesn’t drift.

### Risk Assessment
**LOW** — Small surface, clear dependency on 01, low collision with parallel wave-2 plans.

---

## 11-03

### Summary
Client half of D-05 is well specified: pending-marker wait, start-early/await-late, shell-aware lexer tables, `ToolInventory.shell`. Correctly notes bash writer lands in 07. Main risk is incomplete await wiring leaving annotations unflagged.

### Strengths
- Accurately describes today’s eager read with no pending API (`src/client/tool-handoff.ts:38-67`; `run-foreground.ts:168-172`).
- Zsh “no marker → read at once” matches widget writing handoff before client (`queque.zsh` handoff ~419).
- Hard 500 ms budget + never-throw contract matches existing degrade-to-null pattern.
- Fish aliases to bash lexer tables until Phase 12 matches D-02 “design for three, ship bash.”

### Concerns
- **HIGH (phase, not 03 alone)** — Until 07 writes `tools.pending` + files, bash LLM mode still gets null inventory (`ENOENT`). Fine if expected; dangerous if anyone claims BASH-01 tool flags after 01+03 only.
- **MEDIUM** — Start-early/await-late must feed **both** `withInstalledToolsChunk` (~293) and every `annotateCandidates` (~404/416/444). Easy to await only for steering.
- **MEDIUM** — Bash reserved-word table = zsh minus listed tokens; must keep zsh path byte-identical, including builtin precommand special-case (`command-words.ts:541` still lists `noglob`/`nocorrect`).
- **LOW** — Test `pendingBudgetMs: 100` vs production 500 is fine if default constant stays 500.

### Suggestions
- Acceptance: one test that a late-resolved inventory still annotates candidates (not only the steering chunk).
- Explicit comment in 03 SUMMARY: “bash flags green only after 07.”

### Risk Assessment
**MEDIUM** — Protocol design is good; end-to-end bash parity depends on 07 landing the writer correctly.

---

## 11-04

### Summary
The right place for D-08/D-09/D-12/D-14 init work: one `SHELL_SPECS` registry, bash → `~/.bashrc`, version gate, macOS login hint without editing `~/.bash_profile`. Highest internal hazard is Task 1 registering bash before Task 2 stops writing `~/.zshrc`.

### Strengths
- Today’s init is exactly as claimed: `SUPPORTED_SHELLS = ['zsh']`, always appends `~/.zshrc` (`src/cli/commands/init.ts:11-63`), accepts shells via `listShellAdapters()` (`:44-48`).
- Doctor floors to move (`doctor.ts:33-36`, `versionBelow` `:268-283`) are real and should be shared.
- Strong safety prohibition: append-only, never `bash_profile` / `chsh`.

### Concerns
- **HIGH** — Task 1 registers bash in bootstrap while current `initCommand` still writes `~/.zshrc` for any accepted shell (`init.ts:51-63`). If Task 1 merges alone, `qq init bash` corrupts zshrc with a bash adapter source line.
- **MEDIUM** — “bash that will run” (`SHELL` basename vs `which('bash')`) can disagree on macOS Homebrew vs `/bin/bash`; tests must pin both binaries.
- **LOW** — key_links mention `listShellAdapters()` validation while Task 2 moves to `shippedShellNames` / `detectShell` — clarify the final acceptance path.

### Suggestions
- Land Task 1+2 in one commit, or gate bootstrap bash registration behind init’s rc-path rewrite.
- Add a regression test: `qq init bash` never creates/touches `~/.zshrc` or `~/.bash_profile`.

### Risk Assessment
**MEDIUM** — Design matches decisions; task ordering inside the plan is the critical failure mode.

---

## 11-05

### Summary
Telemetry allow-list extension for `shell` / `shell_version` is aligned with existing privacy rules. Correctly keeps raw versions out of the wire and preserves the old-widget `QQ_ZSH_VERSION` path.

### Strengths
- Current `environmentFields` are zsh-only (`src/contracts/telemetry.ts:85-93`); `collectEnvironmentShape` reads only `QQ_ZSH_VERSION` (`environment-shape.ts:94-102`); call site at `run-foreground.ts:513` is accurate.
- Additive-field policy in the telemetry header (`telemetry.ts:3-18`) matches D-11.
- Plan to add a raw build-string canary is necessary — leak suite today doesn’t cover it (`tests/telemetry-events.test.ts` ~361-415).

### Concerns
- **HIGH** — Shipping `shell`/`shell_version` without cutting to major.minor would violate D-11; schema + serialized-body canary must assert the wire payload, not only the parsed shape.
- **MEDIUM** — Default `shell = input.shell ?? 'zsh'` can mis-label a buggy bash adapter as zsh until widgets always emit `shell`.
- **MEDIUM** — Full zsh path using request `shellVersion` (not only env) needs 02’s widget fields; contract work can proceed earlier, but E2E zsh telemetry completeness waits on 02.
- **LOW** — `SHELL_KINDS` vs `SHELL_NAMES` duplication until plan 10’s invariant test.

### Suggestions
- Assert PostHog batch body / event props never contain `BASH_VERSION`-shaped strings (`-release`, long build tags).
- Prefer failing closed (`unknown`) over defaulting shell when request.shell is missing in bash sessions if detectable.

### Risk Assessment
**MEDIUM** — Privacy contract is the sensitive edge; plan mitigations are adequate if tests hit the serialized body.

---

## 11-06

### Summary
D-04 instant-frame approach (TS oracle + parity tests + bash painter; leave zsh painter alone) is the right trade. Strict dependency on 01’s bash skeleton is correct.

### Strengths
- Instant-frame machinery exists (`src/client/instant-frame.ts`; zsh painters `queque.zsh:60-185`; paint before mktemp `:370-376`).
- UI constants cited are real (`MODAL_VIEWPORT_LINES`, `FRAMES[0]`, `MODAL_MAX_WIDTH`).
- Empty-lbuffer / control-strip behavior matches z2/z3 (`tests/zsh-widget.test.ts:1009-1017`).
- Correctly keeps Zellij pane writer wiring in 07.

### Concerns
- **HIGH** — Byte parity of TS `\p{Cc}` vs bash `[[:cntrl:]]` under `LC_ALL=C` (C1 controls, multibyte) is a real harness/product footgun; fixtures must cover ESC/CSI and non-ASCII.
- **MEDIUM** — `src/shared/instant-frame-spec.ts` importing from `../client/instant-frame.js` inverts shared→client layering; works only if client never imports the spec (plan says so — enforce with lint/import rule or move oracle to shared).
- **MEDIUM** — Bash paints `"$QQ_ORIG_LBUFFER"` while zsh paints `"$QQ_LBUFFER"` (`queque.zsh:374`) — must match 01’s globals exactly.
- **LOW** — bash 5.2 `patsub_replacement` + `&` in replacements — plan notes it; don’t drop that comment in the adapter.

### Suggestions
- Prefer putting the pure byte oracle fully under `src/shared/` to avoid the layering inversion.
- Parity tests must run the bash painter through a temp-file REPLY path (plan notes this) — do not capture interactive stdout.

### Risk Assessment
**MEDIUM** — Highest technical risk in wave 2 after the schema work; parity tests are the right falsifier.

---

## 11-07

### Summary
Completes bash product parity: async compgen handoff, two-flag cleanup, prewarm, Zellij O_RDWR FIFO, hostile-env hardening. Correctly depends on 03+06 and deliberately diverges from the spike’s sync/sorted handoff.

### Strengths
- Zsh references check out: cleanup/handoff (`queque.zsh:19-59`), prewarm (`:187-210`), Zellij FIFO (`:427-467`), single-line JSON result (`src/client/result-writer.ts:26`).
- Spike landmines are respected: never chain on `compgen` exit; drive.sh unsets `ZELLIJ*`.
- Two-flag cleanup + pending marker is the right fix for async lifecycle races.

### Concerns
- **HIGH** — Shipping async writer before 03’s client wait → empty/missing reads → silent “no flags.” `depends_on: [11-03, 11-06]` is mandatory and currently unsatisfied in tree.
- **MEDIUM** — Cancel/ERR paths must always write `closed` so the dir cannot leak; writer `</dev/null` must not skip cleanup.
- **MEDIUM** — Hostile `alias grep` — plan requires `command grep`; spike still uses bare `grep` — easy to regress by “porting” spike.
- **LOW** — Log string differences vs zsh (`tool handoff started` vs `written`) are fine if tests don’t over-lock on copy.

### Suggestions
- Acceptance tests for cancel and client-crash paths proving session dir removal.
- Keep “no sort” and “command grep/compgen” as grep gates in verify.

### Risk Assessment
**HIGH** — Largest bash-runtime surface; correctness depends on 03 protocol + careful cleanup. Do not start early.

---

## 11-08

### Summary
Doctor generalization matches Phase 10’s injectable-probe pattern and D-09/D-12. Hard-blocked on 04’s registry; correctly keeps zsh report length at 12 while extending id enums for fish later.

### Strengths
- Doctor is zsh-shaped today: `DoctorDeps` (`doctor.ts:52-79`), floors (`:34-36`), `checkZsh` (`:266-322`), no `--shell` in CLI (`main.ts:109-113`).
- Id-order test `toEqual([...DOCTOR_CHECK_IDS])` (`tests/doctor.test.ts:59-61`) is correctly called out for replacement.
- Leak canaries already exist — plan extends rather than invents the privacy posture.
- Exit-code rule (usage → 2, hard blockers → 1) matches Phase 10 decision.

### Concerns
- **HIGH** — Without `src/shared/shell-registry.ts` from 04, Task 1 cannot compile as written.
- **MEDIUM** — Live `bash -ic` binding probe sources user `~/.bashrc` (side effects / prewarm); unit tests inject deps, but Task 2 live verify can warn if adapter isn’t installed.
- **MEDIUM** — Don’t over-delete local `versionParts` / `versionBelow` while `checkNode` still needs version helpers (`doctor.ts` ~500).
- **LOW** — Adding `'fish'` to check ids without emitting fish rows is OK if no code assumes `checks.length === DOCTOR_CHECK_IDS.length`.

### Suggestions
- Explicit verify: zsh JSON still `checks.length === 12`; bash JSON length/ids documented separately.
- Keep `rcDisplay` literals only in public strings (existing doctor copy rule at `doctor.ts:8-10` / `:261-263`).

### Risk Assessment
**MEDIUM** — Straightforward once 04 lands; probe side effects are the main operational risk.

---

## 11-09

### Summary
CI/smoke expansion for D-10/D-12 is thorough (expect dual-shell, runner bash pass, `bash-versions` job, Homebrew caveats). One concrete host-cleanup bug: new bash artifacts are not cleared where WR-06 already taught that lesson.

### Strengths
- Accurately maps current zsh-only smoke: `zsh -i` spawn, `command not found: tldr`, Esc `print -r --`, runner doctor without `--shell`, Homebrew `qq init zsh`.
- Local skip vs CI fail claim holds (`scripts/smoke-distro.sh:67-75`).
- Binding-ok assertion on bash doctor is a strong falsifier for 08 probe + 04 init.
- `package.json` `files` already includes `shell/`, so bash adapter ships once present.

### Concerns
- **HIGH** — Bash pass asserts binding **ok** — needs 08 probe + sourced `queque.bash` from `qq init bash` (04). Soft either side → every distro leg fails.
- **MEDIUM** — Host cleanup only removes `pty-*.log` / `doctor.json` / `doctor.txt` (`smoke-distro.sh:84`), **not** `pty-bash-*`, `doctor-bash.*`, `bashrc.txt`. Plan puts those artifacts in the runner but does **not** list `smoke-distro.sh` in `files_modified` → WR-06-style stale reuse.
- **MEDIUM** — Esc change to `echo restored-…` for both shells must update expect redraw match (`smoke-distro.exp` ~155 still expects `print -r -- restored-`).
- **LOW** — Official `bash:3.2`/`4.4`/`5.0` image availability / Hub rate limits.

### Suggestions
- Add `scripts/smoke-distro.sh` to `files_modified` and extend the `rm -f` allow list for bash artifacts.
- Keep refuse-message assertion on substring `needs bash 5.0+` so copy can vary slightly from spike vs production.

### Risk Assessment
**MEDIUM** — Solid plan; cleanup omission is a concrete defect to fix before execute.

---

## 11-10

### Summary
Docs/adapter-contract plan correctly finishes D-03/D-14 user-facing work and the `SHELL_NAMES` invariant. Much of D-03 is already applied in planning docs; runtime docs (README/INSTALL/EXTENSIONS) are still zsh-only.

### Strengths
- REQUIREMENTS/PROJECT/ROADMAP already map BASH-01→11 and FISH-01→12 (`.planning/REQUIREMENTS.md:65-66,125-126`; `PROJECT.md:38`; `ROADMAP.md` Phase 12).
- README still `qq init zsh` (`README.md:22-34`); EXTENSIONS/SYSTEM_DESIGN still zsh-only — real work remains.
- Correctly leaves Homebrew caveat edits to 09 (current caveats still zsh-only in `homebrew.yml:80-84`).
- Fish `read -t` tokenize note is real in spike findings — good contract README fodder.

### Concerns
- **MEDIUM** — Success criteria say “D-14 holds in the docs” but CONTEXT D-14 also includes Homebrew caveats owned by **09**, not 10 — overclaim for this plan alone.
- **MEDIUM** — `depends_on: [11-02, 11-04, 11-05, 11-08]` omits 01/06/07 whose adapter/instant-frame/handoff `shell/README.md` must document; wave-4 ordering helps, GSD depends_on does not.
- **MEDIUM** — INSTALL `chsh` / `/etc/shells` guidance can over-prescribe vs D-09 (init never edits login files; doctor only warns).
- **LOW** — README budget “~75” vs verify `≤78` soft mismatch.

### Suggestions
- Narrow D-14 success text to “user docs + INSTALL; Homebrew caveats verified present after 09.”
- Add `depends_on` entries for 01/06/07 (or state “wave-4 after 07” explicitly in the plan header).
- Keep INSTALL login-shell section warn-only; point to doctor’s `bash_profile` check.

### Risk Assessment
**LOW** — Documentation risk only; main issue is claiming D-14 complete without 09’s caveat half.

---

## 11-11

### Summary
Appropriate phase gate: automated green + human macOS Homebrew bash UAT covering D-04/D-07/D-09/D-12/D-13. Transitive deps reach 01–10. Preconditions understate toolchain and live-model needs.

### Strengths
- Matches VALIDATION’s “macOS + live model is manual” rationale.
- Doctor `r.ok` with daemon-not-running as non-fail matches `doctor.ts` behavior (~403).
- UAT steps map cleanly onto locked decisions; FISH-01 correctly stays out.
- `ci-ok` + planned `bash-versions` need-list is consistent with 09.

### Concerns
- **HIGH** — `CI=true pnpm test:run` fails closed without bash≥5 (`ciRequired`); Mac with only `/bin/bash` 3.2 cannot pass Task 1 until `brew install bash` (stated, easy to miss).
- **MEDIUM** — `files_modified` lists only `.wolf/*` while Task 1 says fix owning files on gate failure — metadata understates blast radius.
- **MEDIUM** — UAT step 5 (`/bin/bash -l`) only exercises D-12 if that login shell sources the same `~/.bashrc`; without bash_profile→bashrc, “?? inserts two `?`” can mean “adapter never loaded.”
- **MEDIUM** — Live-model UAT needs Claude login/API key; not listed beside bash/tmux. Verify also needs `shellcheck`/`actionlint`, not installed by project scripts.
- **LOW** — Init success copy in UAT is shortened vs 04’s full `queque: added … — run: source ~/.bashrc`.

### Suggestions
- Precondition checklist: Homebrew bash 5+, tmux, jq, shellcheck, actionlint, provider credentials.
- UAT step 5: force `bash --noprofile --rcfile ~/.bashrc -i` (or assert doctor `bash_profile` warn) before interpreting 3.2 behavior.
- Expand `files_modified` note to “any owning plan file if gate fails.”

### Risk Assessment
**MEDIUM** — Good closeout design; local toolchain/login-shell pitfalls can falsely fail or falsely pass UAT.

---

## Cross-plan comparison

| Area | Assessment |
|------|------------|
| Wave ordering | Sound: 01 → (02∥03∥04∥06) → (05∥07∥08) → (09∥10) → 11. 07 correctly waits on 03+06. |
| BASH-01 coverage | Full product parity only after **07** (handoff + Zellij) + **09** (CI proof) + **11** (macOS UAT). 01 alone is a correct tracer, not parity. |
| Fish readiness (D-02) | Generally good (`SHELL_NAMES`, fish registry `shipped: false`, handoff `functions.txt` slot, lexer stub). Phase 12 stays adapter-only if 10’s invariant holds. |
| Biggest systemic risks | (1) Schema/type fixture blast radius in 01; (2) 04 Task1/Task2 split writing wrong rc; (3) 09 host cleanup WR-06 regression; (4) 03/07 pending-protocol coupling. |
| Decision fidelity | D-01…D-14 are represented; D-03 largely pre-applied in `.planning/`; D-14 split across 09+10 needs clearer ownership language. |

## Overall risk assessment

**MEDIUM** (bordering **HIGH** only if 07 or 04 task-ordering slips).

Plans are unusually well-grounded in spike findings and current zsh code. The phase will achieve BASH-01 if execute order is respected and the four concrete defects above are fixed in planning before coding: typecheck fixtures for `shell`, atomic init registry+writer, smoke host cleanup for bash artifacts, and paste/version expectations for bash 5.0 vs 5.1.

---

## Consensus Summary

Both reviewers read the repo and cited `file:line` evidence. They covered all 11 plans and rate the phase **MEDIUM** risk overall. Both say the decomposition and wave order are sound and well grounded in the spike findings and current zsh code.

**Orchestrator verification (Claude, against source).** Claims re-checked before consolidation:
- **Refuted:** Codex 11-01 HIGH "the zsh PTY leg will not source `.zshrc` because of `zsh -d`". `-d` is `NO_GLOBAL_RCS` and only skips `/etc` files. Verified: `ZDOTDIR=$tmp zsh -d -i -c true` prints the `$tmp/.zshrc` marker. No change needed.
- **Confirmed:** Cursor 11-01 HIGH typecheck blast radius. `tests/context-pipeline.test.ts:17-28` `buildRequest` returns a `NormalizedRequest` with no `shell` field, and that file is not in 11-01 `files_modified`.
- **Partly confirmed:** Cursor/Codex 11-09 cleanup. `scripts/smoke-distro.sh:84` already removes `pty-*.log`, which covers `pty-bash-default.log`. It does not remove `doctor-bash.json`, `doctor-bash.txt` or `bashrc.txt`, and the failure tail at `:106-114` lists only zsh logs. `smoke-distro.sh` is not in 11-09 `files_modified`.
- **Confirmed (plausible gap):** Codex 11-01 cursor restore. 11-01-PLAN.md:207 restores `QQ_ORIG_LBUFFER`/`QQ_ORIG_RBUFFER` on cancel but never sets `READLINE_POINT` back to the original split point.

### Agreed Strengths
- The tracer-first 11-01 drives the real `qq client` in fixture mode (`src/client/run-foreground.ts:190-203`) through a real PTY. The scope split between 01 and 06/07 is correct.
- The zsh hardcodes are correctly identified: `request.ts:67-68`, `base-context.ts:13`, `init.ts:11`, `doctor.ts`, `telemetry.ts:85-93`, `environment-shape.ts:94-102`.
- The system prompt stays shell-independent, so the prewarm hash survives. The shell syntax cue goes in `buildPrompt` (11-02).
- The pending-marker / start-early-await-late design fixes a real ordering race (11-03). Zsh's no-marker path keeps its current behaviour.
- The TS oracle plus native painters plus byte-parity test is the right D-04 trade (11-06).
- The telemetry allow list stays strict, and the raw-build-string canary is the most valuable test in 11-05.
- 11-07 respects the spike landmines: never chain on compgen's exit status, use `command` prefixes, and two-flag cleanup.
- 11-08 extends doctor's injectable-probe and privacy-canary patterns rather than inventing new ones.

### Agreed Concerns (fix before execute)
1. **11-11 UAT login shell (Codex HIGH, Cursor MEDIUM).** `qq init bash` writes only `~/.bashrc`, but UAT steps 2 and 5 start `bash -l`. On macOS that reads `~/.bash_profile`, so the adapter may never load. A test can then falsely fail (step 2), or falsely pass the 3.2 refusal check (step 5: "?? inserts two `?`" may only mean the adapter never loaded). Fix: use `bash --noprofile --rcfile ~/.bashrc -i`, or confirm the guarded `.bash_profile` source line first. Record which route was used.
2. **11-10 `depends_on` (both MEDIUM).** The plan documents `tools.pending` (03/07) and `instant-frame-spec.ts` (06) but depends only on 02/04/05/08. Add 06 and 07, which brings in 03.
3. **11-09 smoke host artifacts (Cursor MEDIUM, Codex LOW).** Add `scripts/smoke-distro.sh` to `files_modified`. Extend the `rm -f` list with `doctor-bash.json`, `doctor-bash.txt` and `bashrc.txt`, so the WR-06 stale-report bug can't recur. Add the bash log and doctor files to the failure tail.
4. **11-03 / 11-07 coupling (Cursor HIGH-phase, Codex MEDIUM).** The tests check the reader, not the scheduling. Add a `runForegroundClient` test that holds `tools.pending` across `ensureDaemon`, resolves it late, and asserts both the installed-tools chunk **and** the candidate annotations (`run-foreground.ts:293`, `404-444`). Note in 03's SUMMARY that bash flags turn green only after 07.

### Single-reviewer concerns worth folding in
- **11-01 (Cursor HIGH, confirmed):** add `shell` to the hand-built `NormalizedRequest`/`ShellRequest` fixtures (`tests/context-pipeline.test.ts` and similar) and list them in `files_modified`.
- **11-01 (Codex HIGH → MEDIUM, plausible):** save `QQ_ORIG_POINT` and restore `READLINE_POINT` on cancel, error and malformed-result paths. Add a mid-buffer cancel PTY assertion.
- **11-01 (Cursor MEDIUM):** the paste scenario relies on bracketed paste (bash ≥5.1), but the harness accepts 5.0. Gate the assertion on 5.1, or document 5.0 as a known gap. Also retarget the "empty line" must-have away from z2 (an instant-frame test; 01 sets `QQ_INSTANT_FRAME=0`).
- **11-04 (Cursor HIGH):** Task 1 registers bash before Task 2 moves the rc write. If they're committed separately, `qq init bash` appends a bash source line to `~/.zshrc`. Land both together, or keep bash out of the bootstrap until Task 2. Add a regression test that `qq init bash` never touches `~/.zshrc` or `~/.bash_profile`.
- **11-04 (Codex MEDIUM):** `hasShellIntegration` only matches `source "…"` (`init.ts:32-38`). Also match `. "…"` so idempotence holds.
- **11-07 (Codex MEDIUM):** guard `mkfifo`, and handle a `zellij run` that exits nonzero straight away. Restore the line, clear the frame, log a fixed reason. Add tests for both.
- **11-06 (Cursor MEDIUM):** `src/shared/instant-frame-spec.ts` importing `../client/instant-frame.js` inverts the shared→client layering. Keep the oracle in `src/shared/`.
- **11-11 (Cursor MEDIUM):** list the preconditions: shellcheck, actionlint and provider credentials, alongside Homebrew bash and tmux.

### Divergent Views
- **11-01 overall:** Codex rates it HIGH, Cursor MEDIUM. Codex's first HIGH (`zsh -d`) is refuted, so MEDIUM stands once the fixture and cursor-restore fixes land.
- **11-05:** Codex found no material issue. Cursor wants a check on the serialized wire body, not just the parsed shape, and suggests `unknown` over defaulting to `zsh`. The default to `zsh` is deliberate, for old widgets that send no `shell` (D-02 back-compat). The wire-body canary is cheap and worth adding.
- **11-08:** Codex found no gap. Cursor flags the live `bash -ic` probe sourcing the user's `~/.bashrc` (side effects), and over-deleting the version helpers `checkNode` still uses. Both are worth a line in the plan.
