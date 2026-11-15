# Phase 11: Multi-shell trigger support (bash, fish-ready) - Context

**Gathered:** 2026-11-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the literal `??` trigger in **bash ≥5.0** with the same experience as zsh: the first `?` inserts instantly, the second opens the unchanged `qq client` picker with the text before the cursor as context, and the chosen command lands back in the live buffer (Esc restores the buffer).

The phase also makes every **shared part** shell-aware for zsh, bash and fish, so the later fish phase (Phase 12) is mostly one adapter file plus registry entries. **fish's adapter itself does not ship in this phase.**

Covers requirement **BASH-01**.

</domain>

<decisions>
## Implementation Decisions

### Shell scope and order
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

### Parity with zsh
- **D-04:** Instant frame: pull the modal skeleton zsh paints before Node starts (`_qq_inline_instant_frame_bytes` / `_qq_paint_inline_instant_frame` in `shell/zsh/queque.zsh`) out into a shared spec or helper. Each adapter paints it, so bash feels as instant as zsh. Avoid two diverging hand copies.
- **D-05:** Installed-tool awareness has full parity: "not installed" flags plus installed∩catalog prompt steering. The shell stays the source of truth: bash uses `hash -r` plus `compgen -c/-b/-A function/-a`. The ~85 ms scan **runs alongside Node/client startup**, not before it. Never chain on compgen's exit status (spike landmine).
- **D-06:** Suggestions use the current shell's syntax. `shellName` reaches the provider prompt, so the model writes bash syntax for bash, zsh syntax for zsh, and later fish syntax for fish.
- **D-07:** bash supports both picker paths, like zsh: the Zellij floating pane when `$ZELLIJ` is set, otherwise inline. The Zellij path reads the FIFO with `read -r -t 30`.

### Install, doctor and CI
- **D-08:** `qq init` detects the login shell from `$SHELL`, and `qq init zsh|bash` overrides it. `SUPPORTED_SHELLS` in `src/cli/commands/init.ts` becomes a per-shell registry: rc file, source-line pattern, version check, and adapter path under `shell/<name>/`. **Reversibility:** costly. It writes to user rc files, so a revert needs cleanup guidance.
- **D-09:** bash integration goes in `~/.bashrc`. On macOS, terminals start login shells that read `~/.bash_profile`. There, `qq doctor` warns when `~/.bash_profile` doesn't source `~/.bashrc`. init does **not** edit `~/.bash_profile`.
- **D-10:** CI runs the spike's tmux PTY round-trip in PR CI using `--result-mode replace-buffer-fixture`, with no LLM call. The harness takes the shell as a parameter (zsh/bash now, fish later). A bash pass is added to the six-distro smoke matrix (`scripts/smoke-distro.sh`, `.github/workflows/distro.yml`).
- **D-11:** Telemetry adds an allow-listed `shell` enum (`zsh|bash|fish`) plus that shell's major.minor version to the strict contract in `src/contracts/telemetry.ts`, following its existing rules: no free-form strings. **Reversibility:** costly. A published event schema changes, and dashboards and the contract test depend on it.

### bash version policy
- **D-12:** bash <5.0, which includes macOS `/bin/bash` 3.2 and RHEL/CentOS 8's 4.4, is refused. The adapter prints one clear line ("needs bash 5.0+"), leaves `?` untouched and returns 0. `qq doctor` fails below 5.0. There's no ASCII-only fallback for 4.x.

### History
- **D-13:** Match zsh. After a pick, add the original natural-language query to history (`history -s -- "$QQ_ORIG_LBUFFER"`). The accepted command enters history when the user runs it.

### Install UX
- **D-14:** Docs become shell-neutral. README and the Homebrew caveats (`.github/workflows/homebrew.yml`) say `qq init`, which auto-detects, with zsh and bash examples. On macOS with `/bin/bash` 3.2, `qq init` prints "bash 5+ needed: brew install bash" and does not write the rc file.

### Claude's Discretion
- How the shared instant-frame helper is built (a generated byte file, a tiny shared sh helper, or client-side), as long as bash paints before Node is up.
- Exactly how the compgen scan runs alongside client startup (backgrounded writer plus a wait, or client-side polling for the handoff files), as long as the handoff is complete before candidates are flagged.
- Exact doctor check names, warn/fail wording, and the telemetry field names, within the existing contract rules.
- Whether the `shell/<name>/` layout needs a shared README or contract doc for adapter authors.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spike findings (validated patterns and landmines)
- `.claude/skills/spike-findings-tui-llm/SKILL.md`: multi-shell-trigger requirements and the findings index
- `.claude/skills/spike-findings-tui-llm/references/bash-integration.md`: the bash adapter shape, things to avoid, and constraints (5.0 char-vs-byte cursor, bracketed paste, compgen exit-status landmine, tmux harness)
- `.claude/skills/spike-findings-tui-llm/references/fish-integration.md`: fish quirks the shared parts must leave room for (`read -t` means tokenize, `string collect`, prompt padding, `abbr --list`)
- `.claude/skills/spike-findings-tui-llm/references/installed-command-handoff.md`: the handoff file contract the bash adapter must fill
- `.claude/skills/spike-findings-tui-llm/sources/005-bash-tui-handoff/queque.bash`: the working bash adapter to productionize
- `.claude/skills/spike-findings-tui-llm/sources/005-bash-tui-handoff/drive.sh`: the tmux PTY driver to generalize into the shell-parameterized harness

### Existing zsh integration (reference implementation)
- `shell/zsh/queque.zsh`: the widget, instant frame, FIFO/inline paths, and history behavior (`print -s` at line ~289)
- `src/contracts/shell.ts`: the shell request/result contract (cursor index math, result kinds)

### Project docs to update (D-03)
- `.planning/REQUIREMENTS.md`: BASH-01 (v2 Shell Expansion); add FISH-01
- `.planning/PROJECT.md`: the line 38 out-of-scope statement
- `.planning/ROADMAP.md`: Phase 11 entry; add Phase 12

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `qq client`: used unchanged as the picker for every shell (the spikes proved this for bash and fish). It opens `/dev/tty` itself and writes a result file or FIFO.
- `src/shared/tool-awareness.ts` / `src/shared/tool-catalog.ts`: installed∩catalog steering and missing-tool flags. They read the commands/builtins/functions files from the session dir, so bash only has to fill the same files.
- `src/cli/commands/init.ts`: `hasShellIntegration()` already builds its source-line regex from a shell name (`queque\.${shell}`), so the registry generalization has a starting point.
- `src/cli/commands/doctor.ts`: its injectable probe interface (`zshVersion`, `zshBindings`, `readZshrc`) is the pattern for per-shell probes.

### Established Patterns
- Hardcoded zsh assumptions to remove:
  - `shellName: z.literal('zsh')` (`src/contracts/request.ts:68`)
  - `shellName: 'zsh'` (`src/context/base-context.ts:13`)
  - `SUPPORTED_SHELLS = ['zsh']` (`src/cli/commands/init.ts:11`)
  - the doctor contract's `'zsh'` literal (`src/contracts/doctor.ts:13`)
  - the telemetry `zsh` version field (`src/contracts/telemetry.ts:90`)
  - zsh wording in provider timeout comments (`src/providers/ollama.ts`, `src/providers/openai.ts`)
- 30 s shell-side result read vs a 26 s IPC client wait: bash keeps the same budget.
- Zod strict schemas fail closed on shell input. The telemetry contract file IS the allow list.
- `package.json` `files` already ships the whole `shell/` directory, so `shell/bash/` is packaged automatically.

### Integration Points
- New `shell/bash/queque.bash` adapter, sourced from `~/.bashrc` by `qq init`.
- PR CI (`.github/workflows/ci.yml` installs `zsh jq`; add `bash` ≥5 and `tmux`), distro smoke (`scripts/smoke-distro*.sh`, `.github/workflows/distro.yml`).
- Homebrew caveats (`.github/workflows/homebrew.yml`) and README install section.

</code_context>

<specifics>
## Specific Ideas

- The user's framing: "I'd like all of them to work similarly … build with [fish] in view … each shell handles its own nuances … wrapped up inside the fish adapter code." Shared code is shell-agnostic, and shell quirks live only in adapters.
- Bash feel bar from the spike: the first `?` feels instant by hand. The fixture round-trip was ~395 ms; D-04 and D-05 should bring the time to first paint close to zsh.

</specifics>

<deferred>
## Deferred Ideas

- **fish adapter (`shell/fish/queque.fish`)**: Phase 12, fish trigger support. It uses the spike 006/007 findings, including fish-syntax lexer cases.
- **Line-editor add-ons** (ble.sh replacing readline breaks `bind -x`; starship/bash-preexec hooks): not discussed. Planner may add a doctor warning at its discretion, but supporting them is out of scope.

### Reviewed Todos (not folded)
- "09.1 live check: SDK path with a real ANTHROPIC_API_KEY" (`2026-10-13-09.1-sdk-path-live-check.md`): provider work, not shell-related.
- "Bake the telemetry key and verify $ip/GeoIP absence (D-22)" (`2026-10-30-10-bake-telemetry-key.md`): Phase 10 telemetry follow-up, not shell-related.

</deferred>

---

*Phase: 11-multi-shell-trigger-support-bash-and-fish*
*Context gathered: 2026-11-13*
