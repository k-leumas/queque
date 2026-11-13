# Phase 11: Multi-shell trigger support (bash, fish-ready) - Research

**Researched:** 2026-11-13
**Domain:** Shell line-editor integration (bash readline `bind -x`), shell-agnostic contracts (zod), PTY test harnesses (tmux/expect), install/doctor UX
**Confidence:** HIGH for the code inventory and seam design (read this session). MEDIUM for bash 5.0–5.2 runtime behaviour: the spikes ran on 5.3 only, and this machine has no bash ≥5.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Shell scope and order
- **D-01:** bash ships now to reach more Linux users. fish follows in Phase 12 so all three shells are covered. The user wants every shell to work alike, with each shell's quirks kept inside its own adapter (`shell/<name>/queque.<ext>`).
- **D-02:** Design for all three, ship bash only. No shared code may hardcode zsh. Every shared part takes a shell identifier (`zsh | bash | fish`). Phase 12 must need no contract changes. The shared parts are:
  - the request contract's `shellName` (`src/contracts/request.ts`, `src/context/base-context.ts`)
  - the tool-handoff file format (`src/shared/tool-awareness.ts`), which needs a slot for fish abbreviations later
  - the command-word lexer (`src/shared/command-words.ts`), as a shell-aware entry point (fish syntax cases can land in Phase 12)
  - `qq init` / `qq doctor` per-shell registry
  - the telemetry shell fields
  - the instant frame
  - the PTY test harness

  **Reversibility:** costly. Every shared part changes shape at once, and a later revert would touch the contracts, init, doctor, telemetry and tests.
- **D-03:** Update the project docs in this phase:
  - map BASH-01 to Phase 11 in REQUIREMENTS.md traceability
  - add FISH-01 under v2 Shell Expansion
  - change PROJECT.md's "bash and fish stay out of scope" line to "zsh first, bash in Phase 11, fish in Phase 12"
  - add Phase 12 "fish trigger support" to ROADMAP.md

#### Parity with zsh
- **D-04:** Instant frame: pull the modal skeleton zsh paints before Node starts (`_qq_inline_instant_frame_bytes` / `_qq_paint_inline_instant_frame` in `shell/zsh/queque.zsh`) out into a shared spec or helper. Each adapter paints it, so bash feels as instant as zsh. Avoid two diverging hand copies.
- **D-05:** Installed-tool awareness has full parity: "not installed" flags plus installed∩catalog prompt steering. The shell stays the source of truth: bash uses `hash -r` plus `compgen -c/-b/-A function/-a`. The ~85 ms scan **runs alongside Node/client startup**, not before it. Never chain on compgen's exit status (spike landmine).
- **D-06:** Suggestions use the current shell's syntax. `shellName` reaches the provider prompt, so the model writes bash syntax for bash, zsh syntax for zsh, and later fish syntax for fish.
- **D-07:** bash supports both picker paths, like zsh: the Zellij floating pane when `$ZELLIJ` is set, otherwise inline. The Zellij path reads the FIFO with `read -r -t 30`.

#### Install, doctor and CI
- **D-08:** `qq init` detects the login shell from `$SHELL`, and `qq init zsh|bash` overrides it. `SUPPORTED_SHELLS` in `src/cli/commands/init.ts` becomes a per-shell registry: rc file, source-line pattern, version check, and adapter path under `shell/<name>/`. **Reversibility:** costly. It writes to user rc files, so a revert needs cleanup guidance.
- **D-09:** bash integration goes in `~/.bashrc`. On macOS, terminals start login shells that read `~/.bash_profile`. There, `qq doctor` warns when `~/.bash_profile` doesn't source `~/.bashrc`. init does **not** edit `~/.bash_profile`.
- **D-10:** CI runs the spike's tmux PTY round-trip in PR CI using `--result-mode replace-buffer-fixture`, with no LLM call. The harness takes the shell as a parameter (zsh/bash now, fish later). A bash pass is added to the six-distro smoke matrix (`scripts/smoke-distro.sh`, `.github/workflows/distro.yml`).
- **D-11:** Telemetry adds an allow-listed `shell` enum (`zsh|bash|fish`) plus that shell's major.minor version to the strict contract in `src/contracts/telemetry.ts`, following its existing rules: no free-form strings. **Reversibility:** costly. A published event schema changes, and dashboards and the contract test depend on it.

#### bash version policy
- **D-12:** bash <5.0, which includes macOS `/bin/bash` 3.2 and RHEL/CentOS 8's 4.4, is refused. The adapter prints one clear line ("needs bash 5.0+"), leaves `?` untouched and returns 0. `qq doctor` fails below 5.0. There's no ASCII-only fallback for 4.x.

#### History
- **D-13:** Match zsh. After a pick, add the original natural-language query to history (`history -s -- "$QQ_ORIG_LBUFFER"`). The accepted command enters history when the user runs it.

#### Install UX
- **D-14:** Docs become shell-neutral. README and the Homebrew caveats (`.github/workflows/homebrew.yml`) say `qq init`, which auto-detects, with zsh and bash examples. On macOS with `/bin/bash` 3.2, `qq init` prints "bash 5+ needed: brew install bash" and does not write the rc file.

### Claude's Discretion
- How the shared instant-frame helper is built (a generated byte file, a tiny shared sh helper, or client-side), as long as bash paints before Node is up.
- Exactly how the compgen scan runs alongside client startup (backgrounded writer plus a wait, or client-side polling for the handoff files), as long as the handoff is complete before candidates are flagged.
- Exact doctor check names, warn/fail wording, and the telemetry field names, within the existing contract rules.
- Whether the `shell/<name>/` layout needs a shared README or contract doc for adapter authors.

### Deferred Ideas (OUT OF SCOPE)
- **fish adapter (`shell/fish/queque.fish`)**: Phase 12, fish trigger support. It uses the spike 006/007 findings, including fish-syntax lexer cases.
- **Line-editor add-ons** (ble.sh replacing readline breaks `bind -x`; starship/bash-preexec hooks): not discussed. Planner may add a doctor warning at its discretion, but supporting them is out of scope.

#### Reviewed Todos (not folded)
- "09.1 live check: SDK path with a real ANTHROPIC_API_KEY" (`2026-10-13-09.1-sdk-path-live-check.md`): provider work, not shell-related.
- "Bake the telemetry key and verify $ip/GeoIP absence (D-22)" (`2026-10-30-10-bake-telemetry-key.md`): Phase 10 telemetry follow-up, not shell-related.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BASH-01 | User can invoke QueQue from `bash` with equivalent buffer-replacement behavior. (Phase 11) [VERIFIED: .planning/REQUIREMENTS.md:65] | Adapter shape (Pattern 1) from spike 005; shell-aware contracts (Inventory §1); instant-frame spec plus parity test (Pattern 3); async handoff with a pending marker (Pattern 4); init/doctor registry (Pattern 5); telemetry fields (Pattern 6); shell-parameterized tmux harness plus a bash smoke pass (Validation Architecture) |
</phase_requirements>

## Summary

bash support is proven by spikes 004–005 (bash 5.3, inline and Zellij, the unchanged `qq client`). This phase is mostly about **seams**. Eight shared places hardcode zsh today. The biggest ones are `shellName: z.literal('zsh')`, `SUPPORTED_SHELLS = ['zsh']`, the telemetry `zsh` field, the doctor's zsh-only probes and `~/.zshrc` writes, and the zsh-only Homebrew formula install line. Each needs a `zsh | bash | fish` shape now, so Phase 12 only adds an adapter and flips registry entries. Most seams can grow without a version bump. `shellRequestSchema` is a non-strict `z.object` with `version: z.literal(1)`, so an optional `shell` field defaulting to `'zsh'` keeps old zsh widgets in long-running shells working. Daemons from an older build are replaced on a build-id mismatch, so IPC schema changes are safe.

There are three design problems the planner must not improvise:

1. **Instant frame (D-04).** It is computed inside the shell from constants that mirror TS (`QQ_MODAL_VIEWPORT_LINES=18`, max 80 columns, padding 1, `thinking…`). Only the scroll-reserve prefix is drift-guarded (test z5). Recommendation: a **TS reference implementation** (`src/shared/instant-frame-spec.ts`) plus a **cross-shell byte-parity test** that runs every adapter's frame functions against it over a fixture table. Each adapter keeps a native, fork-free implementation, because fish cannot source POSIX sh and a fork defeats "instant".
2. **Async tool handoff (D-05).** The client reads `commands.txt`/`builtins.txt`/`functions.txt` **eagerly**, right after parsing request.json and before `ensureDaemon` (`run-foreground.ts:171-172`). A missing file returns `null` (no flags) right away. A backgrounded bash writer would therefore race. Recommendation: a shell-agnostic **`tools.pending` marker** protocol. The adapter creates the marker synchronously, a detached `( … & )` writer removes it last, and the client starts the read early but `await`s it just before `withInstalledToolsChunk`, polling for the marker with a bounded budget.
3. **Job-control noise.** Probed in a real PTY this session (bash 3.2): a bare `cmd &` inside a function prints `[1] PID` and later `[1]+ Done`. `set +m` and `wait` don't fully suppress this. Only the `( cmd & )` subshell form was silent, and that is the form the bash writer must use.

**Primary recommendation:** Build in four waves. Wave 1 is the shared seams (contracts, lexer entry point, pending-marker reader, telemetry, instant-frame spec), each with tests. Wave 2 is `shell/bash/queque.bash` (spike 005 hardened) and the init/doctor registry. Wave 3 is a shell-parameterized tmux harness run from vitest, so it covers PR CI and all six distro legs (bash 5.1/5.2/5.3), plus a bash pass in the expect smoke, a `bash:<tag>` version-matrix job, the Homebrew formula and the docs. Wave 4 is a human UAT in real bash (inline and Zellij, macOS Homebrew bash).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `?`/`??` key handling, buffer read/write, history, prompt redraw | Shell adapter (`shell/bash/queque.bash`) | — | Only readline can see `READLINE_LINE`/`POINT`. Per-shell quirks stay in the adapter (D-01). |
| Instant frame paint (pre-Node) | Shell adapter | Shared spec (TS reference + parity test) | Must paint before Node exists, so it runs in the shell. Correctness is owned by a shared spec. |
| Installed-tool scan | Shell adapter (`compgen`) | Client (pending-marker wait + reader) | The shell is the source of truth (D-05). The client only reads and waits. |
| Shell identity (`zsh|bash|fish`) | Request contract (`src/contracts/shell.ts`) | Base context → provider prompt, lexer, telemetry | One field written by the adapter and read everywhere downstream. |
| Command-word lexing per shell syntax | Client (`src/shared/command-words.ts`) | — | Pure TS, untrusted model output (never hangs or throws). |
| rc-file integration, version gate | CLI (`qq init`, `qq doctor`) | Shell registry module | Node writes and reads rc files. The adapter only self-guards its version. |
| Picker UI | Client (`qq client`, Ink) | — | Unchanged for every shell (spike 005). |
| Telemetry shape | Client (environment shape) | Daemon (strict wire validation) | Strict allow list in `src/contracts/telemetry.ts`. |

## Inventory §1 — Every zsh hardcode in shared code, and what it becomes

All rows were read this session. Values are quoted verbatim.

| # | Location | Today (verbatim) | Becomes |
|---|----------|------------------|---------|
| 1 | `src/contracts/shell.ts:8-15` [VERIFIED] | `export const shellRequestSchema = z.object({ version: z.literal(1), ttyPath: z.string(), cwd: …, shellPid: z.number().int().positive(), lbuffer: z.string(), rbuffer: z.string(), });` | Add `export const SHELL_NAMES = ['zsh', 'bash', 'fish'] as const;` and fields `shell: z.enum(SHELL_NAMES).default('zsh')` and `shellVersion: z.string().max(40).optional()`. Keep `version: z.literal(1)`: the object is non-strict, so an old client strips the new keys and an old widget (no `shell`) parses as zsh. Update the header comments ("sent from the zsh widget"). |
| 2 | `src/contracts/request.ts:67-68` [VERIFIED] | `/** Hardcoded 'zsh' for Phase 2 — cross-shell support is v2 scope. */` `shellName: z.literal('zsh'),` | `shellName: z.enum(SHELL_NAMES)`. The 12 test fixtures that use `shellName: 'zsh'` stay valid [VERIFIED: grep tests → 12 hits]. |
| 3 | `src/context/base-context.ts:13` [VERIFIED] | `shellName: 'zsh',` | `shellName: request.shell` (`NormalizedRequest` extends `shellRequestSchema`, so it inherits the field). |
| 4 | `src/providers/claude.ts:358-382` `buildPrompt` [VERIFIED] | `shellName: filtered.base.shellName,` (line 376) inside the `Shell context:` JSON | Already reaches the model for SDK, CLI, OpenAI and Ollama (all call `buildPrompt`) [VERIFIED: grep]. For D-06, add one explicit sentence to the **user** prompt, e.g. `Write every command in the syntax of the shell named in shellName.` Keep it out of `buildSystemPrompt`: claude-prewarm keys a warm process on the system-prompt argv (`claude-prewarm.ts:62-64`), so the system prompt should stay shell-independent. No test pins the prompt text [VERIFIED: grep "Shell context" tests → none]. |
| 5 | `src/contracts/telemetry.ts:85-93` [VERIFIED] | `zsh: z.union([z.string().regex(/^\d{1,2}\.\d{1,2}$/), z.literal('unknown')]),` | **Add** (the file says "add, do not rename"): `shell: z.enum(SHELL_KINDS)` with `SHELL_KINDS = ['zsh','bash','fish'] as const` declared in this file (it is the allow list), and `shell_version: <same major.minor regex> | 'unknown'`. Keep `zsh`: it is the zsh version when `shell === 'zsh'`, else `'unknown'`. Update pinned `ENVIRONMENT_KEYS` (`tests/telemetry-contract.test.ts:339`: `['arch', 'distro', 'node_major', 'os', 'zellij', 'zsh']`). |
| 6 | `src/shared/environment-shape.ts:64-68, 98-99` [VERIFIED] | `function zshMajorMinor(version…)` / `zsh: zshMajorMinor(env.QQ_ZSH_VERSION),` | Generalize to `shellMajorMinor`. `collectEnvironmentShape({ env, shell, shellVersion })` takes the request's `shell`/`shellVersion`, falling back to `QQ_ZSH_VERSION` for old widgets. Thread them from `run-foreground.ts:513` (`reportClientTelemetry({ socketPath, record: outcome, errors: telemetryErrors })`). Dedupe still works: the daemon keys on `installId + stableJson(properties)` (`telemetry-buffer.ts:227`), so switching shells sends a new environment event. |
| 7 | `src/contracts/doctor.ts:12-25` [VERIFIED] | `DOCTOR_CHECK_IDS = ['zsh','jq','tmp','socket','daemon','integration','binding','term','locale','provider','node','telemetry']` | Add ids (the file says "add new ids, never rename or remove"): `'bash'`, `'fish'` (reserved, not emitted until Phase 12) and `'bash_profile'`. Update the comment that allows only "the literal `~/.zshrc`" so it also allows `~/.bashrc` and `~/.bash_profile`. |
| 8 | `src/cli/commands/doctor.ts` [VERIFIED] | `ZSH_FAIL_BELOW = '5.0'` / `ZSH_WARN_BELOW = '5.8'` (33-36); `DoctorDeps` has `zshVersion()`, `zshBindings()`, `readZshrc()` (67-69); `checkIntegration` reads `~/.zshrc` (406-411); `checkBinding` expects `qq-question-widget` in `emacs`/`viins` (413-433); `runDoctorChecks` always runs `checkZsh` (556-576) | Per-shell probes: `shellVersion(shell, binary)`, `shellBindings(shell)`, `readRc(path)`. Target shell = `--shell` flag > `$SHELL` basename > `os.userInfo().shell` basename > `'zsh'`. Emit that shell's version row (id `zsh` or `bash`), `integration` and `binding` for it, and `bash_profile` on darwin+bash. `tests/doctor.test.ts:61` (`expect(report.checks.map((c) => c.id)).toEqual([...DOCTOR_CHECK_IDS]);`) must become a per-shell expected list. Smoke still needs `>= 11` checks (`smoke-distro-runner.sh:120`): zsh target = 12, Linux bash = 12, darwin bash = 13. |
| 9 | `src/cli/commands/init.ts` [VERIFIED] | `const SUPPORTED_SHELLS = ['zsh'] as const;` (11); `const zshrc = join(homedir(), '.zshrc');` (51); messages name `~/.zshrc` (58, 63); `_resolveScriptPath` looks under `share/queque/queque.${shell}` then `../../shell/${shell}/queque.${shell}` (20-26) | A per-shell registry (Pattern 5). `hasShellIntegration` (32-39) is already shell-parameterized, so keep it. Refactor `initCommand` to injectable deps (home, env, platform, version probe, fs) for tests. Today only `hasShellIntegration` is unit-tested (`tests/init-command.test.ts`). |
| 10 | `src/cli/main.ts:100-106` [VERIFIED] | `'init <shell>'` + help `'Add shell integration to ~/.zshrc (`qq init zsh && source ~/.zshrc`)…'` | `'init [shell]'`; `dispatchInit(undefined)` → detect. Make the help text shell-neutral. Add `qq doctor --shell <name>`. |
| 11 | `src/registry/bootstrap.ts:32-36` [VERIFIED] | `registerShellAdapter({ id: 'zsh', shell: 'zsh', description: 'zsh ZLE widget adapter (Phase 2 built-in)' })` | Register `bash`. `initCommand` validates against `listShellAdapters()` (init.ts:44), so bash must be registered or init rejects it. |
| 12 | `src/shared/command-words.ts:296-319, 387-392` [VERIFIED] | `// zsh reserved words that leave us expecting a command word next.` `RES_EXPECT` includes `'coproc','nocorrect','noglob','repeat','end'`; `RES_LOOP = new Set(['for', 'foreach', 'select'])` | Shell-aware entry: `extractCommandWords(command, builtins, shell: ShellName = 'zsh')` → `commandWords(tokens, builtins, depth, dialect)`. Per-shell tables: bash drops the zsh-only `nocorrect`, `noglob`, `repeat`, `foreach`, `end`. fish temporarily maps to the bash table, and Phase 12 adds `begin/end/and/or/not`. `lexHand` stays shared (`$( )`, `$(( ))` and `${ }` are the same in bash). |
| 13 | `src/shared/tool-awareness.ts:8-15` and `src/client/tool-handoff.ts:13-17` [VERIFIED] | `TOOL_HANDOFF_FILES = { commands: 'commands.txt', builtins: 'builtins.txt', functions: 'functions.txt' }`; doc comments say "Keys of zsh `$commands`" | Keep the three files. Redefine `functions.txt` as "names the shell resolves that are not on PATH: functions, aliases and, in fish, abbreviations". That is the fish-abbr slot (spike 007 already writes `abbr --list` into functions.txt). Add the optional `tools.pending` marker (Pattern 4). Add `shell?: ShellName` to `ToolInventory` so `missingTools` passes it to the lexer. |
| 14 | `src/client/run-foreground.ts:267` [VERIFIED] | `'\r\nqueque: terminal does not support interactive mode\r\nRun ?? from an interactive ZSH session.\r\n'` | Make it shell-neutral ("from an interactive shell"). |
| 15 | `src/providers/ollama.ts:25`, `src/providers/openai.ts:35` [VERIFIED] | `/** Same budget as Claude: zsh reads the FIFO for 30s …` | Comment wording only ("the shell adapter reads…"). The 30 s / 26 s budget stays the same for bash. |
| 16 | `src/cli/commands/init-provider.ts:71` [VERIFIED] | `'OPENAI_API_KEY is not set. Add `export OPENAI_API_KEY=...` to ~/.zshrc …'` | Shell-neutral copy ("to your shell rc file"). |
| 17 | `.github/workflows/homebrew.yml:66` and `release.yaml:188` [VERIFIED] | `(share/"queque").install "shell/zsh/queque.zsh"` | Add `(share/"queque").install "shell/bash/queque.bash"` in **both** files. Without it, `_resolveScriptPath` falls back to the package dir under the versioned Cellar, and that path breaks on `brew upgrade` [ASSUMED: Cellar path is versioned]. Mirror it in `scripts/smoke-homebrew-docker.sh:106` (`cp /src/shell/zsh/queque.zsh …`). Do not rename the step "Release to Homebrew tap": `tap-clone-stats.yml` matches it [VERIFIED: cerebrum 2026-11-05]. |
| 18 | Caveats `homebrew.yml:83-84`, `release.yaml:205-206`, README:22-34, docs/INSTALL, PROVIDERS, USAGE, SYSTEM_DESIGN, EXTENSIONS, PRIVACY:10,44 [VERIFIED: grep] | `qq init zsh && source ~/.zshrc` | Use `qq init`, with zsh and bash examples (D-14). Never `>>` into an rc file [VERIFIED: cerebrum 2026-10-17]. README stays ≤ ~75 lines [VERIFIED: anatomy note]. |

**D-03 is already applied.** REQUIREMENTS.md:65-66, 125-126 map BASH-01→Phase 11 and FISH-01→Phase 12. PROJECT.md:38 reads "bash follows in Phase 11 and fish in Phase 12". ROADMAP.md:412-420 has Phase 12 [VERIFIED: read this session]. The planner only needs a verify step, not a rewrite.

## Standard Stack

No new npm dependencies. Everything uses the locked toolchain plus system tools.

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| bash | ≥5.0 at runtime; CI images 5.1–5.3 | Adapter host (`bind -x`, `READLINE_LINE`/`POINT`) | `READLINE_POINT` counts characters from 5.0 (spike 004 citing bash CHANGES 5.0-alpha) [CITED: spike 004 README] |
| zod | 4.1.5 (pinned) | `SHELL_NAMES` enum, request/doctor/telemetry schemas | Project standard [VERIFIED: package.json] |
| vitest | 4.0.4 | Unit, parity and PTY-harness tests | Project standard [VERIFIED: package.json] |
| tsup | 8.5.1 | Harness builds a bundle into a temp dir (same pattern as `tests/bundle-startup.test.ts`) | Project standard [VERIFIED: tests/bundle-startup.test.ts:7-9] |
| cac | 7.0.0 | `init [shell]`, `doctor --shell` | Installed version is 7.0.0, not the 6.7.14 named in CLAUDE.md [VERIFIED: package.json] |
| jq | 1.x | Request JSON (`jq -n --arg`) and result parsing in the bash adapter | Already a hard runtime dependency [VERIFIED: cerebrum 2026-10-28] |
| tmux | 3.x (local 3.6a) | PTY harness (`capture-pane`, `send-keys -l`, `paste-buffer -p`) | `paste-buffer -p` "inserts paste bracket control codes … if the application has requested bracketed paste mode" [VERIFIED: local `man tmux` 3.6a] |
| expect | system | Distro smoke (existing `scripts/smoke-distro.exp`) | Already in use [VERIFIED] |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| Official `bash:<tag>` Docker images (3.2, 4.4, 5.0, 5.1, 5.2, 5.3; bash at `/usr/local/bin/bash`) | Version-matrix job: refuses on 3.2/4.4, accepts on 5.0 | The only cheap way to test 3.2/4.4 refusal and 5.0 (bracketed paste off) in Linux CI [CITED: hub.docker.com/_/bash] |
| shellcheck 0.11.0 (local) | Lint `shell/bash/queque.bash` | Biome ignores shell files. The spike adapter shows SC2125 at line 60 (`READLINE_LINE=$lbuf?$rbuf`; quote it) [VERIFIED: ran locally] |
| actionlint (local) | Lint changed workflows | Biome ignores `.yml` [VERIFIED: cerebrum 2026-11-05] |

### Distro bash versions (for the doctor warn floor and CI coverage)
| Image | bash | Source |
|-------|------|--------|
| ubuntu:22.04 | 5.1 | [CITED: packages.ubuntu.com/jammy/bash — 5.1-6ubuntu1.1] |
| ubuntu:24.04 | 5.2.21 | [CITED: packages.ubuntu.com/noble/bash] |
| debian:13 | 5.2.37 | [CITED: repology.org/project/bash] |
| fedora:44 | 5.3.9 | [CITED: repology] |
| archlinux:latest | 5.3.20 | [CITED: repology] |
| alpine:3.24 | 5.3.9, **not in the base image** (`apk add bash`) | [CITED: repology]; base-image absence [ASSUMED] |
| macOS `/bin/bash` | 3.2.57 | [VERIFIED: local probe] |
| Homebrew bash | 5.3.20 | [CITED: repology] |
| CentOS/AlmaLinux 8 | 4.4.20 (refused) | [CITED: repology] |

Recommended doctor policy, mirroring the zsh rule "warn below the oldest CI image": `BASH_FAIL_BELOW = '5.0'`, `BASH_WARN_BELOW = '5.1'`. 5.1 is ubuntu:22.04, and it is also the release where bracketed paste became the default, so 5.0 users can have pasted `??` fire.

**Installation:** none (no `npm install`). CI adds system packages only (see Environment Availability).

## Package Legitimacy Audit

No external packages are installed by this phase. `tmux`, `bash` and `expect` are OS packages from distro repositories, not registry packages.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | No new npm/PyPI/crates packages |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 user types "find big files??" in bash (readline)
        │ each "?" → bind -x '"?": _qq_question'  (emacs + vi-insert keymaps)
        ▼
 _qq_question ── char before point != "?" ──► insert "?" (READLINE_LINE/POINT) ─► return
        │ second "?"
        ▼
 capture QQ_ORIG_LBUFFER / RBUFFER ─► resolve qq (QQ_DEV_ROOT node … | type -P qq)
        │
        ├─ inline: paint instant frame (reserve + ESC7 + CSI J + frame + ESC8)  ◄── spec: src/shared/instant-frame-spec.ts
        ▼                                                                           (parity test guards zsh/bash/fish)
 mktemp -d (0700) ─► request.json via jq -n --arg {version:1,…,shell:"bash",shellVersion}
        │
        ├─ : > tools.pending ; ( compgen writer → commands/builtins/functions.txt ; rm tools.pending ) & )   [detached]
        ▼
 ┌─────────────── $ZELLIJ set? ───────────────┐
 │ no: run qq client in foreground             │ yes: mkfifo; pane frame file; ( zellij run … & disown );
 │     (opens /dev/tty itself)                 │      IFS= read -r -t 30 result <fifo
 └────────────────────┬────────────────────────┘
                      ▼
 qq client: parse request ─► start readToolHandoff (waits while tools.pending exists, ≤ budget)
            ensureDaemon ─► Ink takeover of instant frame ─► gatherContext ─► await inventory
            ─► installed∩catalog chunk ─► provider (buildPrompt carries shellName) ─► stream
            ─► annotateCandidates(lexer with shell dialect) ─► user picks / Esc
            ─► writeShellResult (file rename or FIFO line)
                      ▼
 _qq_apply_result_str: replace-buffer → print "queque › q" + command, reprint ${PS1@P} head,
                       history -s -- query, set READLINE_LINE/POINT │ cancel/error → restore
        ▼
 two-flag cleanup of the session dir ─► readline redraws the last prompt line
```

### Recommended Project Structure
```
shell/
├── zsh/queque.zsh          # unchanged behaviour; adds "shell"/"shellVersion" to request.json
├── bash/queque.bash        # NEW: spike 005 productionized
└── README.md               # OPTIONAL (discretion): adapter contract for authors (request fields,
                            #   handoff files + tools.pending, result kinds, frame spec, env hooks)
src/shared/
├── shell-registry.ts       # NEW: per-shell spec (rc file, adapter file, source pattern, version gates, probes)
├── instant-frame-spec.ts   # NEW: constants + TS reference frame/bytes (test oracle)
├── command-words.ts        # shell-aware dialect tables
└── tool-awareness.ts       # ToolInventory.shell
src/client/tool-handoff.ts  # pending-marker wait
tests/
├── bash-widget.test.ts            # NEW: helper-level tests (mirrors zsh-widget.test.ts)
├── instant-frame-parity.test.ts   # NEW: every adapter vs the TS reference, byte for byte
├── shell-pty.test.ts              # NEW: describe.each(['zsh','bash']) tmux round trips
├── pty/drive.sh                   # NEW: generalized spike drive.sh (shell param)
└── helpers/shells.ts              # NEW: findShell('bash', {min:5}) — skip locally, FAIL when CI is set
```

### Pattern 1: bash adapter shape (spike 005, hardened)
**What:** `bind -x` on `?` in `emacs` and `vi-insert`. Look at the character before `READLINE_POINT`. The second `?` fires.
**Hardening the spike lacks (all required):**
- **Interactive guard first, then version guard.** `[[ $- == *i* ]] || return 0` must come before the "needs bash 5.0+" line, so non-interactive shells that read `~/.bashrc` (scp, `ssh host cmd`) print nothing. bash parses a sourced file one command at a time, so 5.x-only syntax after the `return` is never parsed by 3.2 [ASSUMED; the refusal test on `bash:3.2` falsifies this].
- **`local -` then `set +euE +o pipefail`** as the first lines of `_qq_question` and the helpers. A user with `set -e` in an interactive shell would otherwise lose the shell on compgen's exit 1. `local -` restores `set` options on return [CITED: gnu.org bash manual, "local": "If name is '-', it makes the set of shell options local to the function"]. bash ≥4.4, so it is always available under the 5.0 floor.
- **`command` prefix for every external tool** (`command jq`, `command rm`, `command mktemp`, `command mkfifo`, `command chmod`, `command sort`, `command grep`, `command cat`). bash expands aliases when a function is **defined**, and our source line sits at the end of `~/.bashrc`, after the user's aliases (`alias grep='grep --color=always'`, `alias rm='rm -i'`) [ASSUMED: alias-at-definition semantics; the harness defines such aliases before sourcing]. Leave `zellij` un-prefixed so a shell-function fake works and matches zsh (cerebrum Do-Not-Repeat 2026-11-13).
- **`${VAR:-}` everywhere** (`QQ_DEBUG_LOG_FILE`, `ZELLIJ`, `QQ_DEV_ROOT`, `QQ_TOOL_AWARENESS`, `QQ_INSTANT_FRAME`). Belt and braces with `set +u`.
- **`shopt -s interactive_comments`** at source time, mirroring zsh `setopt interactivecomments` (queque.zsh:12). The accepted buffer is `cmd  # explanation`, and with it off the `#` becomes arguments.
- **Daemon prewarm** at source time: `( qq daemon --ensure >/dev/null 2>&1 & )`, gated by `QQ_DAEMON_PREWARMED`, the same as `_qq_prewarm_daemon` (queque.zsh:197-210).
- **Debug log** gated on `QQ_DEBUG_LOG_FILE`, tag `[bash]` (zsh uses `[zsh]`, queque.zsh:194).
- **`ttyPath`:** `$(tty)` forks. Fall back to `/dev/tty`.
- **Quote `READLINE_LINE="${lbuf}?${rbuf}"`** (shellcheck SC2125).

**Example (trigger core, from spike 005 `queque.bash:57-65`):**
```bash
# Source: .claude/skills/spike-findings-tui-llm/sources/005-bash-tui-handoff/queque.bash
_qq_question() {
  local -; set +euE +o pipefail
  local lbuf=${READLINE_LINE:0:READLINE_POINT} rbuf=${READLINE_LINE:READLINE_POINT}
  if [[ $lbuf != *\? ]]; then
    READLINE_LINE="${lbuf}?${rbuf}"; (( READLINE_POINT++ )); return 0
  fi
  QQ_ORIG_LBUFFER=${lbuf%\?} QQ_ORIG_RBUFFER=$rbuf
  # … resolve qq, paint frame, session dir, request, async handoff, client, apply, cleanup
}
bind -m emacs     -x '"?": _qq_question'
bind -m vi-insert -x '"?": _qq_question'
```

### Pattern 2: Shell request carries shell identity
```typescript
// src/contracts/shell.ts (proposed)
export const SHELL_NAMES = ['zsh', 'bash', 'fish'] as const;
export type ShellName = (typeof SHELL_NAMES)[number];
export const shellRequestSchema = z.object({
  version: z.literal(1),            // unchanged: additive, non-strict object
  ttyPath: z.string(),
  cwd: z.string().regex(/^\/[^\0]*$/, 'cwd must be an absolute POSIX path'),
  shellPid: z.number().int().positive(),
  lbuffer: z.string(),
  rbuffer: z.string(),
  shell: z.enum(SHELL_NAMES).default('zsh'),   // old zsh widgets omit it
  shellVersion: z.string().max(40).optional(), // raw $BASH_VERSION/$ZSH_VERSION; cut to major.minor before telemetry
});
```
bash writes it with `jq -n --arg … '{version:1, ttyPath:$tty, cwd:$cwd, shellPid:$pid, lbuffer:$l, rbuffer:$r, shell:"bash", shellVersion:$v}'` (spike 005 `queque.bash:79-81` plus the two new keys). Update the zsh heredoc (queque.zsh:409-418) to add `"shell": "zsh"` and `"shellVersion"`. Keep `export QQ_ZSH_VERSION` (queque.zsh:425) as the telemetry fallback.

### Pattern 3: Instant frame — shared spec plus native painters plus a parity test (D-04)
**How it couples today (verified):**
- zsh constants (queque.zsh:88-96): `QQ_MODAL_VIEWPORT_LINES=18  # mirrors MODAL_VIEWPORT_LINES (modal-layout.ts)`, `QQ_MODAL_MAX_COLUMNS=80`, `QQ_MODAL_PADDING_COLUMNS=1`, `QQ_ZELLIJ_FRAME_COLUMNS=2`, `QQ_INSTANT_FRAME_ROWS_ABOVE_LOADING=2`, `QQ_INSTANT_FRAME_LOADING_TEXT='thinking…'`, `QQ_INSTANT_FRAME_FILE='instant-frame.txt'`, `QQ_PANE_PAINT_SCRIPT='cat "$1" 2>/dev/null; shift; exec "$@"'`.
- TS truths: `export const MODAL_VIEWPORT_LINES = 18;` (modal-layout.ts:135); `const MODAL_MAX_WIDTH = 80;` (CandidateSelect.tsx:38); `const FRAMES = ['thinking…', …]` (LoadingSpinner.tsx:4); `inlineScrollReserve(lines)` returns `` `${'\n'.repeat(lines)}\u001B[${lines}A\r${SAVE_CURSOR}` `` (instant-frame.ts:53-55).
- Frame (`_qq_instant_frame`, queque.zsh:100-137): rows are `pad+dim+"queque › "+lbuffer+undim` (only when the raw `$1` is non-empty; truncated to `width-1` chars + `…` when longer than `width = columns - 2*padding`), then 2 empty rows, then `pad+dim+"thinking…"+undim`, joined by `\r\n`. Control characters are stripped with `${1//[[:cntrl:]]/}`. Non-numeric or out-of-range columns become 80. A temporary `LC_ALL=C.UTF-8` (then `en_US.UTF-8`) makes counting use characters in the C locale.
- Inline bytes (queque.zsh:142-150): 18×`\n` + `CSI 18 A` + `\r` + `ESC 7` + `CSI J` + frame + `ESC 8`. The client writes the same reserve again on its llm branch (run-foreground.ts:248-253), and that write moves nothing. Zellij: frame + `CSI H` into `$tmpdir/instant-frame.txt`, and the pane command is `/bin/sh -c "$QQ_PANE_PAINT_SCRIPT" queque-instant-frame <file> <client argv>` (queque.zsh:446-456).
- **Current drift guard:** only z5 (`tests/zsh-widget.test.ts:1051-1062`) asserts that the inline bytes start with `inlineScrollReserve(MODAL_VIEWPORT_LINES)`. The frame rows themselves (z1–z4b) are pinned as literals and are not derived from TS.

**Recommendation (prescriptive):**
1. `src/shared/instant-frame-spec.ts` exports `INSTANT_FRAME_SPEC` (viewport lines = imported `MODAL_VIEWPORT_LINES`, max columns, padding, Zellij frame columns, rows above loading, loading text = `FRAMES[0]` exported from LoadingSpinner or moved into the spec, header prefix `queque › `, file name, pane paint script) plus the pure functions `instantFrameRows(lbuffer, columns)`, `inlineInstantFrameBytes(lbuffer, columns)` and `paneInstantFrameBytes(lbuffer, columns)`. These are the oracle. The client never calls them at runtime. Its own reserve already comes from `inlineScrollReserve`.
2. Each adapter keeps a **native, fork-free** `_qq_instant_frame` / `_qq_inline_instant_frame_bytes` / `_qq_write_pane_instant_frame` with the constant block at the top.
3. `tests/instant-frame-parity.test.ts`: `describe.each(ADAPTERS)` where `ADAPTERS = [{shell:'zsh', run: zsh -f -c}, {shell:'bash', run: bash5 --noprofile --norc -c}]` (fish gets added in Phase 12). It runs each adapter's three functions over a fixture table and asserts `===` against the TS reference. Table: ASCII, empty, only control characters, ESC/TAB/NL/DEL, 200×`a` at columns `78`/`40`/`wide`/`0`/`1`/`2`, 200×`é` at 40 in `LC_ALL=C`, an emoji. Keep z1–z10 unchanged.
4. Rejected options. A generated byte file can't work because the frame depends on the lbuffer and the column count. A shared POSIX `sh` helper costs a fork, fish can't source it, Homebrew installs only per-shell files, and zsh/bash array semantics differ. Painting from the client defeats the purpose.

**bash port notes:** `printf -v pad '%*s' "$QQ_MODAL_PADDING_COLUMNS" ''`. The reserve is `printf -v nl '%*s' 18 ''; nl=${nl// /$'\n'}`. For zsh's `<1->` use `[[ $columns =~ ^[0-9]+$ ]] && (( 10#$columns >= 1 && 10#$columns <= max ))`. Truncate with `${text:0:width-1}…`. Switch locale with `local LC_ALL=C.UTF-8 2>/dev/null`. On macOS bash 3.2 this switch made `${#probe}` count 1 for `›` and was restored on return [VERIFIED: local probe]. The glibc "cannot change locale" warning when C.UTF-8 is missing is [ASSUMED], hence the `2>/dev/null`. Do not put `&` in any `${var//pat/rep}` replacement: bash 5.2 enables `patsub_replacement` by default [ASSUMED].

### Pattern 4: Async tool handoff with a `tools.pending` marker (D-05)
**Verified constraint:** `readToolHandoff` (tool-handoff.ts:38-68) uses `Promise.all(readFile×3)`. Any missing file → `null` with reason `ENOENT`. run-foreground calls it **before** `ensureDaemon`:
```typescript
// src/client/run-foreground.ts:168-172 (verbatim)
// Installed-tool handoff from the widget (D-01). Read eagerly alongside request.json, not
// when candidates arrive: the session dir only lives until the widget's cleanup (Zellij
// pane timing). The inventory stays in this process — never sent over IPC (D-04).
const toolInventory =
  resultMode === 'llm' ? await readToolHandoff(path.dirname(requestFile)) : null;
```
The inventory is needed **before the fetch** (`withInstalledToolsChunk(await gatherContext(normalized), toolInventory)` at line 293, the steering chunk), not just before flagging.

**Protocol (shell-agnostic, so fish reuses it in Phase 12):**
- Adapter, synchronously, before launching the client: `: >"$tmpdir/tools.pending"`, then start the writer **detached through a subshell** so no job notices print:
  ```bash
  ( { _qq_write_tool_handoff "$tmpdir"; command rm -f -- "$tmpdir/tools.pending"
      [[ -e $tmpdir/closed ]] && command rm -rf -- "$tmpdir"; } </dev/null >/dev/null 2>&1 & )
  ```
  The writer body stays spike-safe: never chain on compgen's status, and a failed write removes all three files.
- Client: `readToolHandoff(dir, { pendingBudgetMs })`. While `tools.pending` exists, poll every ~10 ms up to the budget (recommend 500 ms), then read. On timeout return `null` with debug reason `pending-timeout`. With no marker (zsh), read at once, so zsh behaviour and cost don't change. **Start** the promise where it is today, but **await** it right before `withInstalledToolsChunk`, so the scan overlaps with `ensureDaemon`, Ink setup and `gatherContext`. `readToolHandoff` never throws [VERIFIED: tool-handoff.ts:34-37], so an un-awaited start is safe.
- Two-flag cleanup in the adapter (replaces a plain `rm -rf`): `: >"$tmpdir/closed"; [[ -e $tmpdir/tools.pending ]] || command rm -rf -- "$tmpdir"`. The writer removes the marker first and then checks `closed`. Neither side can skip removal: if the widget sees `pending`, the writer has not yet removed it, so the writer will later see `closed`. A double `rm -rf` is harmless.
- *Superseded by Open Questions 1 (RESOLVED): `hash -r` is kept per D-05.* **Drop `hash -r` from the bash writer** (D-05 lists it, but it is a no-op here). In the subshell it can't refresh the parent's table, and `compgen -c` lists a binary created after the shell started without it. On bash 3.2 `compgen -c | grep qqprobe` went 0 → 1 with no rehash [VERIFIED: local probe]. Re-verify on 5.x with a bash version of the zsh SC-1 test ("lists a tool created after the hash table was primed"). If the user wants `hash -r` kept literally, it is harmless in the subshell.
- **Landmine re-verified:** `compgen -a` with no aliases exits 1 [VERIFIED: local probe bash 3.2]. Never use `&&` with it.

**Job-control probe (this session, bash 3.2, real PTY via tmux):**

| Form inside an interactive function | Output seen |
|---|---|
| `sleep 0.3 &` | `[1] 27411` … `[1]+  Done  sleep 0.3` |
| `{ sleep 0.3 & } 2>/dev/null; wait $!` | `[1]+  Done  sleep 0.3` |
| `set +m; sleep … & wait` | `[1] 27971` |
| `sleep … & disown` | `[1] 27625` |
| `( sleep 0.3 & )` | nothing |

[VERIFIED on 3.2; ASSUMED the same on 5.x. Falsify it in the harness by asserting that no `[1]` appears in the pane capture.]

### Pattern 5: Per-shell registry for init/doctor (D-08, D-09, D-12, D-14)
```typescript
// src/shared/shell-registry.ts (proposed)
export interface ShellSpec {
  shell: ShellName;
  shipped: boolean;                  // fish:false in Phase 11 → init says "fish support is coming"
  rcPath: (home: string) => string;  // zsh ~/.zshrc, bash ~/.bashrc, fish ~/.config/fish/conf.d/queque.fish (Phase 12)
  rcDisplay: string;                 // '~/.zshrc' | '~/.bashrc' (the only path literals doctor may print)
  adapterFile: string;               // 'queque.zsh' | 'queque.bash' | 'queque.fish'
  sourceLine: (scriptPath: string) => string;   // `source "${p}"` (all three use `source`)
  versionProbe: { args: string[] };  // bash: ['--noprofile','--norc','-c','printf %s "$BASH_VERSION"']
  failBelow: string; warnBelow: string;  // zsh 5.0/5.8, bash 5.0/5.1
  bindingProbe: { args: string[]; widget: string; keymaps: readonly string[] };
}
```
- **Detection:** `[shell]` arg > `basename($SHELL)` if it is in the registry > `basename(os.userInfo().shell)` > an error that names `qq init zsh` / `qq init bash`. Under `su -s /bin/sh user -c …` (smoke runner), `$SHELL` may be `/bin/sh` [ASSUMED], and the `userInfo` fallback then finds the passwd shell. The smoke should still pass explicit `qq init bash` / `qq doctor --shell bash`.
- **Version gate in init:** probe the bash that will actually run. That is `$SHELL` when its basename is `bash`, otherwise `which('bash')`. Below 5.0: print `bash 5+ needed: brew install bash` on darwin (D-14), or `bash 5.0 or newer is needed` elsewhere, write nothing and exit 1. Edge case: Homebrew bash is installed but the login shell is still `/bin/bash`. Print a fixed-copy follow-up about `chsh` and `/etc/shells`, with no paths taken from the environment.
- **macOS login shells (D-09):** login bash reads the first of `~/.bash_profile`, `~/.bash_login`, `~/.profile` [ASSUMED: bash INVOCATION semantics]. On darwin+bash, `bash_profile` warns when none of them exists or the first one found does not reference `.bashrc` (regex `/(^|[\s;])(\.|source)\s+["']?(~|\$HOME|\$\{HOME\})\/\.bashrc\b/m`). init prints the same hint and does not edit the file.
- **bash binding probe:** `bash -ic` with markers, mirroring zsh's `BINDINGS_SCRIPT` (doctor.ts:184-186): `printf '__qq_emacs__ %s\n' "$(bind -m emacs -X | command grep -F '"?"')"`, the same for `vi-insert`, plus `printf '__qq_paste__ %s\n' "$(bind -v | command grep enable-bracketed-paste)"`. Under `bash -ic` with no tty, `bind -x` worked on 3.2 without a "line editing not enabled" warning, and readline printed a stray `ESC[?1034h` that the marker parser must ignore [VERIFIED: local probe 3.2]. `bind -m keymap -X` is documented [CITED: gnu.org bash manual via Context7]. The 3.2 build lacks `-X` [VERIFIED: local probe], so only use the probe after the version gate. Warn when bracketed paste is off. Optionally warn when `BLE_VERSION` is set (deferred-ideas allowance).
- **Doctor copy rule:** fixed copy plus versions, a widget name and the `rcDisplay` literals only [VERIFIED: doctor.ts:259-263, cerebrum 2026-10-29].
- **Revert guidance (D-08 is costly):** document in docs/INSTALL.md that removing the `# queque shell integration` line and the `source …queque.bash` line undoes init.

### Pattern 6: Telemetry fields (D-11)
```typescript
// src/contracts/telemetry.ts (proposed additions)
export const SHELL_KINDS = ['zsh', 'bash', 'fish'] as const;
const majorMinor = z.union([z.string().regex(/^\d{1,2}\.\d{1,2}$/), z.literal('unknown')]);
const environmentFields = {
  os: z.enum(OS_KINDS), arch: z.enum(ARCH_KINDS), distro: z.enum(DISTRO_IDS),
  zsh: majorMinor,                 // kept (add, never rename): zsh version when shell==='zsh', else 'unknown'
  shell: z.enum(SHELL_KINDS),
  shell_version: majorMinor,       // "5.2.21(1)-release" → "5.2"
  node_major: z.number().int().min(18).max(99), zellij: z.boolean(),
};
```
Risk is low. No telemetry key is baked yet, so nothing has ever been sent [VERIFIED: cerebrum 2026-10-30]. Also update docs/PRIVACY.md:10 and :44 [VERIFIED: grep].

### Anti-Patterns to Avoid
- **`bind -x '"??": fn'`:** a lone `?` then waits `keyseq-timeout` (500 ms) [CITED: spike 004].
- **`{ compgen …; } && …`:** this exit-status chain deletes the handoff [VERIFIED: spike 005, local probe].
- **Bare `&` for the writer or prewarm inside an interactive function:** it prints job notices into the user's line [VERIFIED: probe above].
- **One hand-copied frame per shell with no oracle:** it drifts silently. Always add the adapter to the parity table.
- **Binding `vi-command` `?`:** that is reverse search. Bind only `vi-insert`, mirroring zsh `viins`.
- **Inheriting `ZELLIJ*`/`TMUX` into harness shells:** this opens real floating panes in the developer's session [VERIFIED: cerebrum Do-Not-Repeat 2026-11-13].
- **Removing the zsh `rehash`/sync handoff to "match" bash:** `tests/zsh-widget.test.ts:894` pins "no loop/sort/background" for zsh. The async path is for slow scanners only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON from shell variables | `printf`-built JSON | `jq -n --arg/--argjson` | Quoting, newlines and control characters in buffers [CITED: spike 005] |
| Multibyte cursor maths | byte/char conversion | bash ≥5.0 `READLINE_POINT` (chars) + `${var:0:n}` | Same unit in UTF-8 and C locales [CITED: spike 004] |
| Bracketed-paste detection | your own paste heuristics | readline `enable-bracketed-paste` (default on from 5.1) | Pasted text never calls `bind -x` [CITED: spike 004] |
| PTY driving | `script`, custom node-pty | tmux private server (`-L`, `-f /dev/null`) + `capture-pane`; existing expect smoke | Proven in spikes 004–007 and Phase 10 |
| Shell detection by parsing rc files | heuristics | `$SHELL` → `os.userInfo().shell` → explicit arg | Deterministic and testable |
| Telemetry version strings | free-form | regex major.minor or `'unknown'` | Contract rule: no free-form strings [VERIFIED: telemetry.ts:6-15] |

**Key insight:** every shell-side correctness risk here has a falsifier available: a byte-parity oracle, a tmux snapshot, or a `bash:<tag>` image. The plan should land the falsifier in the same wave as the code.

## Runtime State Inventory

This is not a rename, but contracts change under long-running processes:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `~/.config/qq/config.json` (telemetry consent/install id) has no shell-dependent data [VERIFIED: telemetry-config usage]. No PostHog data exists (no key baked). | None |
| Live service config | None. PostHog EU project not created [VERIFIED: cerebrum 2026-10-30]. | None |
| OS-registered state | None. No launchd/systemd (LaunchAgent reverted) [VERIFIED: cerebrum 2026-08-26]. | None |
| Long-running processes | (a) Running zsh sessions with the **old widget** sourced send request.json without `shell` → schema `.default('zsh')` handles it. (b) Running daemons from an older build reject the new IPC envelope → `ensureDaemon` replaces any daemon whose build id differs [VERIFIED: cerebrum 261030-tq3]. | Code: default `shell` to `'zsh'`. Test that old request JSON parses. |
| Secrets/env vars | `QQ_ZSH_VERSION` exported by the zsh widget (queque.zsh:425). Keep it for the telemetry fallback. bash may export `QQ_RESULT_FILE`/`QQ_PANE_*` like zsh does. | None (additive) |
| Build artifacts / installed packages | Homebrew `share/queque/` holds **only** `queque.zsh` [VERIFIED: homebrew.yml:66, release.yaml:188]. npm ships the whole `shell/` dir (`"files": ["dist","shell",…]`) [VERIFIED: package.json]. | Formula install line for `queque.bash` in both workflows + docker Homebrew smoke |

## Common Pitfalls

### Pitfall 1: Bracketed paste on bash 5.0
**What goes wrong:** pasting `foo??` fires the trigger mid-paste, and the rest of the paste goes to Ink as keystrokes.
**Why it happens:** `enable-bracketed-paste` defaults to off before 5.1 [CITED: spike 004].
**How to avoid:** doctor warns below 5.1 **and** whenever the binding probe sees bracketed paste off. Don't change the user's readline setting.
**Warning signs:** harness `paste` scenario on `bash:5.0` fires.

### Pitfall 2: Characters vs bytes for `READLINE_POINT`
**What goes wrong:** on 4.x the slice lands mid-character. **How to avoid:** refuse <5.0 (D-12). Test `echo café??` and an emoji mid-line in the harness [CITED: spike 004 point=10 vs bytes 11].

### Pitfall 3: Job notices and `set -e` inside `bind -x`
See Pattern 4 (`( … & )` only) and Pattern 1 (`local -; set +euE +o pipefail`). **Warning sign:** `[1]` or `Done` appears in a harness capture, or the test shell exits after `??` under `set -e`.

### Pitfall 4: Aliases and functions shadowing tools
`alias grep='grep --color=always'` corrupts functions.txt, `alias rm='rm -i'` hangs cleanup (this repo's own Claude Code shell does exactly that, per cerebrum), and a user function `jq` breaks parsing. **Avoid:** prefix externals with `command`. **Test:** the harness defines `alias grep='grep --color=always'; jq(){ echo broken; }` before sourcing the adapter.

### Pitfall 5: Non-interactive rc sourcing prints output
scp/rsync break when `~/.bashrc` prints for non-interactive shells. **Avoid:** `[[ $- == *i* ]] || return 0` before the version message. **Test:** `bash -c 'source shell/bash/queque.bash'` prints nothing and exits 0, on 3.2 as well.

### Pitfall 6: Multi-line PS1 redraw
readline repaints only the last prompt line after `bind -x` [CITED: spike 005]. **Avoid:** `_qq_reprint_prompt_head` with `${PS1@P}` [CITED: gnu.org manual `@P`] on the replace-buffer path only. Caveats [ASSUMED]: `${PS1@P}` runs PS1 command substitutions again (cost, side effects, e.g. `__git_ps1`, starship), and heads printed by `PROMPT_COMMAND` are not in PS1, so they are not reprinted. **Test:** harness `prompt-multiline` with `PS1='\w\n\$ '`.

### Pitfall 7: Zellij env leakage in tests
Claude Code runs inside the user's Zellij (`ZELLIJ_SESSION_NAME=tui`). **Avoid:** start the tmux server with `env -u ZELLIJ -u ZELLIJ_PANE_ID -u ZELLIJ_SESSION_NAME -u TMUX`. Fake `zellij` as a **shell function**, asserted with `type -t zellij` = `function` [VERIFIED: cerebrum Do-Not-Repeat].

### Pitfall 8: FIFO open blocks before `read -t` starts
`IFS= read -r -t 30 result <"$fifo"` blocks in `open()` until a writer appears, so if `zellij run` never starts the pane, the 30 s timeout never starts either. zsh has the same pre-existing behaviour (queque.zsh:467). **Optional bash hardening that keeps D-07's `read -r -t 30`:** `exec {fd}<>"$fifo"; IFS= read -r -t 30 -u "$fd" result; exec {fd}<&-`. This works because the client writes a **newline-terminated** line [VERIFIED: result-writer.ts:26 `` const line = `${JSON.stringify(parsed)}\n`; ``]. O_RDWR on a FIFO is Linux-defined and works on macOS in practice [ASSUMED].

### Pitfall 9: The PTY harness touching the developer's daemon
Fixture mode still calls `ensureDaemon` (pinned by `tests/client-result.test.ts:404-415`). The socket is fixed at `/tmp/qq-${uid}.sock` (socket-path.ts:10-12), and a different build id replaces the developer's running daemon. **Avoid:** set `QQ_DAEMON_PREWARMED=1` before sourcing, use a throwaway `HOME`, and accept that a local run swaps the dev daemon (the next `??` swaps it back). Don't add a socket-path override.

### Pitfall 10: The harness passing by skipping in CI
**Avoid:** a `findShell()` helper that skips **locally** with a warning when bash ≥5 or tmux is missing, but **throws when `CI` is set**, mirroring the Phase 10 smoke skip rule (Phase 10 decision 16) [VERIFIED: smoke-distro.sh:67-75]. Add tmux to `ci.yml:67-68` (`sudo apt-get install -y zsh jq`), to `release.yaml:29`, and to `install-distro-deps.sh` for all five families. Add `bash` explicitly for alpine (`apk add … bash tmux`, line 96).

### Pitfall 11: Expect smoke patterns are zsh-shaped
`smoke-distro.exp` expects `command not found: tldr` (zsh wording; bash prints `tldr: command not found` [ASSUMED]), `print -r --` (zsh builtin), `QQSMOKE[%#]` prompt and the `[y/N]` consent text. **Avoid:** take the shell as a second argument with per-shell spawn, prompt regex (`QQSMOKE[%#$] `), not-found regex and restore command (`echo restored-$((6*7))` works in both). Add new exit codes (e.g. 37 for `qq init bash`). Keep `QQ_TELEMETRY=0` in the bash rc so the consent question never trips `(queque|QueQue): ` (cerebrum 2026-10-29/30).

### Pitfall 12: Control-character classes differ across libcs
`[[:cntrl:]]` follows `iswcntrl`. glibc counts U+2028/2029 as cntrl, and macOS may not [ASSUMED]. **Avoid:** keep parity fixtures to C0, DEL, ESC and C1. Use `/\p{Cc}/gu` in the TS oracle.

### Pitfall 13: Doctor's exact-order test and the smoke count
Per-shell rows break `tests/doctor.test.ts:61`. Keep ids unique (one target shell per report) so `>= 11` (smoke-distro-runner.sh:120) holds and auto-revert PR bodies stay readable.

## Code Examples

### Two-flag cleanup and pending marker (bash)
```bash
# Proposed — pattern verified for silence on bash 3.2 ((… &) subshell form); not yet run on 5.x
: >"$tmpdir/tools.pending"
( { _qq_write_tool_handoff "$tmpdir"
    command rm -f -- "$tmpdir/tools.pending"
    [[ -e $tmpdir/closed ]] && command rm -rf -- "$tmpdir"
  } </dev/null >/dev/null 2>&1 & )
# … client runs …
: >"$tmpdir/closed"
[[ -e $tmpdir/tools.pending ]] || command rm -rf -- "$tmpdir"
```

### Client wait (TS sketch)
```typescript
// src/client/tool-handoff.ts (proposed addition)
export const TOOL_HANDOFF_PENDING = 'tools.pending';
async function waitWhilePending(dir: string, budgetMs: number): Promise<boolean> {
  const marker = path.join(dir, TOOL_HANDOFF_PENDING);
  const deadline = Date.now() + budgetMs;
  for (;;) {
    try { await access(marker); } catch { return true; }   // gone → ready
    if (Date.now() >= deadline) return false;               // → null, reason 'pending-timeout'
    await new Promise((r) => setTimeout(r, 10));
  }
}
```

### Shell-parameterized tmux driver (generalized from spike 005 `drive.sh`)
```bash
# tests/pty/drive.sh SHELL SCENARIO — sketch; per-shell table drives start cmd and PS1
case $1 in
  zsh)  start="zsh -f -i";                 ps1="PS1='QQPTY%# '"; src=shell/zsh/queque.zsh ;;
  bash) start="$QQ_TEST_BASH --noprofile --norc -i"; ps1="PS1='QQPTY\$ '"; src=shell/bash/queque.bash ;;
esac
T="tmux -L qq-pty-$$"
env -u ZELLIJ -u ZELLIJ_PANE_ID -u ZELLIJ_SESSION_NAME -u TMUX \
  $T -f /dev/null new-session -d -x 100 -y 30 \
  -e HOME="$tmp_home" -e QQ_DEV_ROOT="$bundle_root" -e QQ_DAEMON_PREWARMED=1 \
  -e QQ_TELEMETRY=0 -e LANG="$utf8_locale" -e QQ_DEBUG_LOG_FILE="$log" "$start"
# wait_for anchors on prompt redraws (never fixed sleeps); type with send-keys -l char by char;
# paste scenario: $T set-buffer 'echo pasted??' && $T paste-buffer -p -t 0
```
The harness needs to put the client into fixture mode. The zsh widget has no hook today [VERIFIED: grep queque.zsh], and `--result-mode` is only a CLI flag (main.ts:88). `parseResultMode` treats `undefined` as `'llm'` (client.ts:25-31). Recommend one client-side hook, `parseResultMode(options.resultMode ?? process.env.QQ_TEST_RESULT_MODE)`, documented as dev-only in CONTRIBUTING.md (cerebrum 2026-10-17: dev variables live there). That keeps all three adapters free of test code.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `READLINE_POINT` in bytes | in characters | bash 5.0 | 5.0 floor [CITED: spike 004] |
| bracketed paste opt-in | default on | bash 5.1 | warn floor 5.1 [CITED: spike 004] |
| `local -` unavailable | restores `set` options | bash 4.4 | safe option scoping [CITED: gnu.org manual] |
| `${PS1@P}` unavailable | prompt expansion | bash 4.4 | multi-line head reprint [CITED: spike 005] |

**Deprecated/outdated:** CLAUDE.md lists `cac 6.7.14` and `pnpm 10.33.2`. The repo pins `cac 7.0.0` [VERIFIED: package.json], and the local pnpm is 12.6.0 [VERIFIED: probe]. Use the repo pins.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Job-notice behaviour (`( … & )` silent, bare `&` noisy) is the same on bash 5.x as on 3.2 | Pattern 4 | Writer/prewarm noise in users' lines. Harness asserts no `[1]` |
| A2 | `compgen -c` sees new binaries without `hash -r` on 5.x | Pattern 4 | Stale flags. Add a bash SC-1 test |
| A3 | readline's post-`bind -x` redraw and the inline frame placement behave like 5.3 on 5.0–5.2 | Pattern 1/3 | Garbled frame on older bash. Covered by distro legs 5.1/5.2 + `bash:5.0` job |
| A4 | bash expands aliases at function definition, so `command` is required | Pattern 1 | Without `command`, aliases corrupt files |
| A5 | `su -s /bin/sh` sets `$SHELL=/bin/sh` in the smoke runner | Pattern 5 | Detection falls to `userInfo`. Smoke passes explicit shells anyway |
| A6 | Login bash reads the first of `.bash_profile`/`.bash_login`/`.profile` | Pattern 5 | Wrong doctor warning |
| A7 | bash prints `tldr: command not found` (format) in containers | Pitfall 11 | Smoke anchor misses. Use a regex for both orders |
| A8 | Alpine base image lacks bash | Stack | Smoke fails at spawn. `apk add bash` regardless |
| A9 | Homebrew Cellar path is versioned, so the fallback adapter path breaks on upgrade | Inventory #17 | Stale `source` line after `brew upgrade` |
| A10 | glibc bash warns on an unavailable `LC_ALL` (hence `2>/dev/null`) | Pattern 3 | Stray warning on the line |
| A11 | `patsub_replacement` default-on in 5.2 | Pattern 3 | `&` in replacement strings misbehaves |
| A12 | O_RDWR FIFO open works on macOS | Pitfall 8 | Optional hardening only |
| A13 | 3.2 never parses 5.x syntax after the early `return` | Pattern 1 | Parse error on macOS `/bin/bash`. Falsify on `bash:3.2` |
| A14 | `${PS1@P}` re-running command substitutions is acceptable | Pitfall 6 | Slow or duplicated prompt side effects (starship) |

## Open Questions (RESOLVED)

All five questions were settled during planning. Each entry names the plan and task that implement the answer.

1. **Keep `hash -r` in the bash writer literally (D-05 wording) or drop it?**
   - Known: it is a no-op for `compgen -c` freshness on 3.2, and inside the subshell it can't touch the user's table.
   - Recommendation: drop it, note why in a comment, and keep a bash SC-1 freshness test. If the user prefers the literal wording, it is harmless in the subshell.
   - **RESOLVED: kept, per locked D-05** (it names `hash -r`; the research recommendation to drop it is overridden). It runs first inside the detached writer subshell, where it is harmless, with a comment that compgen scans PATH itself. Freshness is proven by bash-widget test b12 (SC-1 mirror), not by that line. Implemented in **11-07 Task 1**.
2. **Pending-marker budget.**
   - Known: the scan takes 80–88 ms, and under load (load avg 70+) timings balloon [VERIFIED: cerebrum 2026-10-17].
   - Recommendation: 500 ms, logged as `pending-timeout`. Make it a constant, not configuration.
   - **RESOLVED: 500 ms, a named constant.** `TOOL_HANDOFF_PENDING_BUDGET_MS = 500` and `TOOL_HANDOFF_PENDING_POLL_MS = 10` in `src/client/tool-handoff.ts`; no config key or env var. The `pendingBudgetMs` option exists only so tests can shorten the wait. On timeout the client returns no inventory and logs debug reason `pending-timeout` (threat T-11-10). Implemented in **11-03 Task 1**.
3. **macOS CI.**
   - Known: no workflow uses a macOS runner [VERIFIED: grep runs-on]. The darwin-specific logic (3.2 refusal in init, `bash_profile` warning) can be unit-tested with injected `platform: 'darwin'`.
   - Recommendation: no macOS runner this phase. Cover macOS by unit tests plus the Wave 4 human UAT on the developer's Mac with Homebrew bash.
   - **RESOLVED: no macOS runner this phase.** Darwin logic is unit-tested with an injected platform: `InitDeps.platform` covers the init refusal copy, the `.bash_profile` hint and the unchanged `.bash_profile` in **11-04 Task 2**; the existing `DoctorDeps.platform` covers the darwin-only `bash_profile` row in **11-08 Task 1**. The developer confirms on macOS with Homebrew bash (inline and Zellij, live model) in the blocking human check, **11-11 Task 2**.
4. **Optional FIFO O_RDWR hardening (Pitfall 8)**: is it in scope as parity-plus, or deferred for both shells? Recommendation: bash-only, behind the same `read -r -t 30`, flagged in the plan.
   - **RESOLVED: in scope, bash only.** bash opens the FIFO read-write (`exec {fd}<>`) and keeps D-07's `read -r -t 30` (`QQ_RESULT_READ_TIMEOUT_S=30`), so the timeout also covers a pane that never starts. Test b20 proves this (dead pane), and it mitigates threat T-11-23. zsh is not changed this phase: the 11-07 SUMMARY records the read-write open as a zsh follow-up candidate. Implemented in **11-07 Task 2**.
5. **How does the PTY harness put the client into fixture mode?** (raised under the "Shell-parameterized tmux driver" code example)
   - Known: the zsh widget has no hook, `--result-mode` is only a CLI flag, and `parseResultMode(undefined)` is `'llm'`.
   - Recommendation: one client-side hook reading `QQ_TEST_RESULT_MODE`, documented as dev-only in CONTRIBUTING.md.
   - **RESOLVED: client-side hook, documented in CONTRIBUTING.md only.** `parseResultMode(options.resultMode ?? process.env.QQ_TEST_RESULT_MODE)`; the `--result-mode` flag wins. No adapter carries test code, and README never mentions the variable (threat T-11-07, accepted). Implemented in **11-01 Task 1** (`src/cli/commands/client.ts`) and **11-01 Task 3** (CONTRIBUTING.md).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bash ≥5.0 | bash adapter tests, harness, parity test | ✗ (only `/bin/bash` 3.2.57) | — | `brew install bash` (5.3 via Homebrew, `/usr/local/bin/bash`). Needs a human OK as a system install. Otherwise tests skip locally and CI covers them |
| tmux | PTY harness | ✓ | 3.6a | — |
| jq | adapter | ✓ | 1.8.1 | — |
| expect | distro smoke | ✓ | system | — |
| zsh | zsh harness/parity | ✓ | 5.9 | — |
| Docker daemon | `pnpm test:distro`, `pnpm smoke:distro` | ✗ (client present; daemon not running) | — | Skips locally with a warning (Phase 10 skip rule, decision 16), CI runs it. Starting Docker Desktop enables it |
| shellcheck / actionlint | lint adapter / workflows | ✓ | 0.11.0 / present | — |
| node | everything | ✓ | v24.14.1 | — |
| fish | Phase 12 only | ✗ | — | not needed |

**Missing dependencies with no fallback:** none block planning. The executor can't run bash tests locally without `brew install bash` (add a `checkpoint:human-action` or accept CI-only bash coverage).
**Missing dependencies with fallback:** Docker (CI legs).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.4 (`vitest.config.ts` includes `tests/**/*.test.ts(x)`, setup `tests/setup/scrub-git-env.ts`) |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm exec vitest run tests/<file>.test.ts` |
| Full suite command | `pnpm test:run` (and `pnpm lint && pnpm typecheck`) |
| Distro | `pnpm test:distro <image>`, `pnpm smoke:distro <image>` (Docker) |

### Phase Requirements → Test Map
| Req / Decision | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BASH-01 / D-01 | first `?` inserts instantly, second fires; mid-line, multibyte, vi-insert | PTY | `pnpm exec vitest run tests/shell-pty.test.ts -t bash` | ❌ Wave 0 |
| BASH-01 | replace-buffer round trip executes; cancel restores; summary lines; history has the query (D-13) | PTY + unit | `… tests/shell-pty.test.ts`; `… tests/bash-widget.test.ts` | ❌ Wave 0 |
| BASH-01 | pasted `??` does not fire (`paste-buffer -p`) | PTY | `… tests/shell-pty.test.ts -t paste` | ❌ Wave 0 |
| BASH-01 | multi-line PS1 head reprinted | PTY | `… -t prompt-multiline` | ❌ Wave 0 |
| D-02 | request `shell` defaults to zsh; enum accepts bash/fish; old JSON parses | unit | `… tests/shell-contract.test.ts` | ✅ extend |
| D-02 | lexer dialect: bash treats `noglob`/`repeat` as commands, zsh as reserved | unit | `… tests/command-words.test.ts` | ✅ extend |
| D-02/D-05 | pending marker: waits, reads, times out to null; zsh path unchanged | unit | `… tests/tool-handoff.test.ts` | ✅ extend |
| D-04 | zsh and bash frame bytes == TS oracle over the fixture table | unit (spawns shells) | `… tests/instant-frame-parity.test.ts` | ❌ Wave 0 |
| D-05 | bash handoff: files written, marker removed, no job notices, compgen landmine (no aliases/functions), new binary listed | unit + PTY | `… tests/bash-widget.test.ts -t handoff` | ❌ Wave 0 |
| D-06 | `buildPrompt` carries `"shellName": "bash"` and the syntax sentence | unit | `… tests/claude-provider.test.ts` | ✅ extend |
| D-07 | Zellij path: function-faked `zellij` receives the pane argv; FIFO result applied | unit | `… tests/bash-widget.test.ts -t zellij` | ❌ Wave 0 |
| D-08 | init detection order, `~/.bashrc` write, idempotent marker, unsupported/fish-not-shipped messages | unit (injected deps) | `… tests/init-command.test.ts` | ✅ extend |
| D-09 | darwin+bash `bash_profile` warn and ok cases | unit | `… tests/doctor.test.ts` | ✅ extend |
| D-10 | harness runs zsh and bash in PR CI; distro bash smoke pass | CI | `ci.yml` checks job; `pnpm smoke:distro debian:13` | ❌ Wave 0 (`tests/pty/`, smoke edits) |
| D-11 | telemetry `shell`/`shell_version` strict and pinned; env shape maps `5.2.21(1)-release` → `5.2` | unit | `… tests/telemetry-contract.test.ts tests/environment-shape.test.ts` | ✅ extend |
| D-12 | refusal on 3.2/4.4 (one line, `?` literal, rc 0); doctor fails <5.0, warns <5.1 | docker matrix + unit | `docker run --rm -v "$PWD:/w:ro" bash:4.4 bash -ic 'source /w/shell/bash/queque.bash'`; `… tests/doctor.test.ts` | ❌ Wave 0 (CI job) |
| D-14 | init on darwin with bash 3.2 prints `bash 5+ needed: brew install bash` and writes nothing | unit | `… tests/init-command.test.ts` | ✅ extend |
| D-03 | docs already updated | grep | `grep -n "BASH-01 \| Phase 11" .planning/REQUIREMENTS.md` | ✅ |
| Pitfall 5 | non-interactive source prints nothing (3.2 locally, 5.x CI) | unit | `… tests/bash-widget.test.ts -t non-interactive` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the touched test file(s) via `pnpm exec vitest run <files>` plus `pnpm exec biome check <files>`, `shellcheck -s bash shell/bash/queque.bash`, and `actionlint` on changed workflows.
- **Per wave merge:** `pnpm test:run && pnpm typecheck && pnpm lint`.
- **Phase gate:** full suite green with bash 5 present (locally after `brew install bash`, or in CI), plus at least one `pnpm smoke:distro` leg locally or a green CI distro matrix, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/helpers/shells.ts`: find bash ≥5 or tmux; skip locally, throw under `CI`
- [ ] `tests/pty/drive.sh` + `tests/shell-pty.test.ts`: bundle build in `beforeAll` (reuse the `tests/bundle-startup.test.ts` tsup pattern, ~180 s timeout under load)
- [ ] `tests/bash-widget.test.ts`: mirrors `tests/zsh-widget.test.ts` helper style (`spawnSync(bash, ['--noprofile','--norc','-c', 'source "$0"\n…', adapter, ...args])`)
- [ ] `tests/instant-frame-parity.test.ts`
- [ ] CI: tmux in `ci.yml` and `release.yaml`; `bash tmux` in `install-distro-deps.sh`; `bash-versions` job (`bash:3.2`, `bash:4.4` refuse; `bash:5.0` sources and binds) added to `ci-ok` needs
- [ ] Smoke: `smoke-distro.exp` shell parameter + bash pass in `smoke-distro-runner.sh`

Rough timings: the PTY suite takes about 5–15 s per shell plus a 10–60 s bundle build. The parity test takes about 2–4 s. A distro smoke leg takes 30–45 s per image cached [VERIFIED: cerebrum 2026-10-29].

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes (local files) | 0700 `mktemp -d` session dir; rc writes only to the invoking user's home |
| V5 Input Validation | yes | zod: `shell` enum, bounded `shellVersion`, strict telemetry; jq `--arg` for JSON; result `kind` allow list |
| V6 Cryptography | no | — |
| V7 Errors & Logging | yes | Debug logs carry counts and reasons only, never tool names or buffers (D-04, tool-handoff.ts:35); doctor fixed copy |
| V12 Files & Resources | yes | No `/` fallback when mktemp fails (Phase 10 Defect 3 pattern, queque.zsh:382-394); two-flag cleanup |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Terminal escape injection via lbuffer in the instant frame | Tampering | Strip `[[:cntrl:]]` before painting (zsh line 114); parity test includes ESC/CSI input |
| JSON injection from buffer/cwd | Tampering | `jq -n --arg`; never string-built JSON |
| Symlink/race in /tmp | Tampering/EoP | `mktemp -d` + `chmod 700`; marker files only inside the 0700 dir |
| Command execution of the pick | EoP | Insertion only: no `eval`, no auto-accept (zsh CMD-04 tests at zsh-widget.test.ts:717-766; mirror them for bash) |
| lbuffer in process argv (visible in `ps`) | Info disclosure | Zellij frame goes through a file, never argv (queque.zsh:71-75) |
| PII in telemetry/doctor | Info disclosure | Enum and major.minor only; doctor prints only `rcDisplay` literals |
| rc-file corruption | Tampering | Append only, idempotent marker, never `>>` docs (bug-332) |

## Project Constraints (from CLAUDE.md and memory)
- Toolchain: pnpm, tsup, vitest, zod, cac, ink, `@anthropic-ai/sdk`. No new dependencies are needed.
- Insertion only: never execute the picked command. zsh first, bash now. TypeScript on Node LTS.
- Start work through a GSD command. Commit `.wolf/` and `.planning/` with code. Lint changed files (biome, shellcheck, actionlint) before staging.
- No `Co-Authored-By` trailers (user memory). Headers within commitlint config-conventional limits (100 chars).
- No stubs in smoke/integration tests. The distro smoke keeps the real product with only the fake `claude`. The fixture result mode is the D-10-sanctioned exception for the PR harness.
- Fix, don't delete. Use inclusive terms ("allow list"). State time estimates.
- Harness hygiene: unset `ZELLIJ*`. Use `/bin/rm -f` / `/bin/cp -f` in the Claude Code shell. Use `grep -F` for literal shell text in acceptance criteria (BSD grep `$` anchor).
- README stays trim. Developer-only variables (e.g. `QQ_TEST_RESULT_MODE`) go in CONTRIBUTING.md.

## Sources

### Primary (HIGH confidence)
- Read this session: `shell/zsh/queque.zsh`, `src/contracts/{shell,request,telemetry,doctor}.ts`, `src/context/base-context.ts`, `src/client/{tool-handoff,instant-frame,run-foreground,result-writer}.ts`, `src/shared/{environment-shape,command-words,tool-awareness,socket-path}.ts`, `src/cli/{main.ts,commands/init.ts,commands/doctor.ts,commands/client.ts}`, `src/registry/*`, `src/providers/claude.ts`, `tests/zsh-widget.test.ts`, `tests/telemetry-contract.test.ts`, `tests/init-command.test.ts`, `scripts/smoke-distro*.{sh,exp}`, `scripts/ci/*.sh`, `.github/workflows/{ci,distro,homebrew,release}.y*ml`
- Spike skill: `.claude/skills/spike-findings-tui-llm/` (SKILL.md, references/bash-integration.md, fish-integration.md, installed-command-handoff.md, sources/004, 005, 007)
- Local probes (bash 3.2.57, tmux 3.6a): job notices, `local LC_ALL`, `compgen` freshness and exit codes, `history -s --`, `bind -x` under `bash -ic`, `man tmux` paste-buffer
- Context7 `/websites/gnu_software_bash_manual_html_node`: `bind -x`/`-X`/`-m`, `local -`, `${parameter@P}`

### Secondary (MEDIUM confidence)
- hub.docker.com/_/bash: tags 3.2–5.3, `/usr/local/bin/bash`
- repology.org/project/bash: distro versions; packages.ubuntu.com jammy/noble

### Tertiary (LOW confidence)
- Behaviour of bash 5.0–5.2 `bind -x` redraw (not run this session; spikes used 5.3)

## Metadata

**Confidence breakdown:**
- Code inventory and seams: HIGH (every file read, quoted verbatim)
- bash adapter patterns: MEDIUM-HIGH (spike-validated on 5.3; hardening based on 3.2 probes plus the manual)
- Cross-version runtime (5.0–5.2): MEDIUM (CI matrix is the falsifier)
- CI/smoke changes: HIGH (scripts read; distro versions cited)

**Research date:** 2026-11-13
**Valid until:** 2026-12-13 (stable domain; recheck distro bash versions if the image pins change)
