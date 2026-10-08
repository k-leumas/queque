# Phase 9: Installed-Only Command Awareness - Context

**Gathered:** 2026-10-07
**Status:** Ready for planning

<domain>
## Phase Boundary

QueQue finds out which tools the user has installed from zsh, steers the model toward them, and
visibly flags any candidate that uses a tool the user doesn't have. On a flagged candidate, Tab
switches the row to a form that prepends the platform's install command, so the user can install
and run in one insertion. Insertion-only is unchanged. Nothing auto-executes.

Out of scope: auto-installing anything, dropping candidates, non-zsh shells, and sending the full
installed list to the model.

</domain>

<decisions>
## Implementation Decisions

### Carried forward from spikes 001–003 (locked before discussion)
- **D-01:** zsh's `$commands` is the source of truth for what's installed. The `??` widget runs
  `rehash`, then writes `${(k)commands}` and `${(k)builtins}` (names only, a single `print -rl`, no zsh
  loops, no sorting) into the existing private session tmpdir next to `request.json`. Budget: about 7 ms.
  No Node PATH scan, no daemon-side index.
  **Amended 2026-10-08 (after research):** the handoff also writes `${(k)functions:#_*}` and
  `${(k)aliases}` (same single-`print -rl` rule, ~1.6 ms), and these names count as installed, so
  function-only tools such as `nvm`, `conda`, `sdk` and zoxide's `z` are never falsely flagged. They stay
  client-side; only catalog members reach the prompt (D-04).
- **D-19 (added 2026-10-08, SC-2 strictness):** Keep D-01's always-`rehash` handoff (no mtime-gated
  rehash, no background-subshell write). The measured handoff is ~10–12 ms on this Mac against the
  ~10 ms target. The automated timing test is a **regression guard**: median of 5 runs < 25 ms (which
  catches zsh loops/sorting at 136–167 ms). The test prints the measured median so verification can
  record it. Revisit the mtime fallback only if `??` is perceived as slow.
- **D-02:** Builtins (from the `$builtins` handoff, never hardcoded), reserved words, `<placeholders>`,
  `$VAR` commands and path commands (`./x.sh`) are never flagged.
- **D-03:** Command-word extraction uses the spike 002 hand lexer ported to `src/`. It must never hang or
  throw on malformed model output: clamp `indexOf` −1, and fuzz test with a hard per-input timeout.
  shell-quote and sh-syntax are rejected.
- **D-04:** Only `curated catalog ∩ installed` goes into the prompt, never the full `$commands` list
  (spike 003: the full list costs ~33× the tokens and still leaked missing tools). The catalog is a
  public tool-name allow list, so no unusual or internal binary names reach the model. This keeps the
  Phase 6 privacy posture.

### Install steps and self-installing commands
- **D-05:** The prompt forbids install steps. Candidates must not contain `brew install … && …`
  or similar. An install command appears only when the user presses Tab on a flagged candidate (D-09).
- **D-06:** If a model candidate includes an install step anyway, there is no special handling. Its
  command words are judged like any other: a missing tool is flagged, with no "installs X" label.
- **D-07:** Cases the prompt already prevents get no dedicated handling. Examples: use-before-install
  in one command, or a wrong-OS installer like `apt` on macOS (platform is in the prompt). The user's
  rule: don't build edge-case logic for malformed output the prompt already prevents.

### Flag presentation (CandidateSelect)
- **D-08:** A flagged candidate shows an inline mark after its last command line, using the Phase 6
  destructive-warning pattern but a **distinct glyph and colour from the yellow `⚠`**. When it is
  selected, a footer line names the missing tools (e.g. `not installed: fd, xh`). A candidate can be
  both destructive and flagged; both marks and footers must be able to show.
- **D-09:** **Tab** on a selected flagged candidate switches that row in place to the install form:
  `<installer> <pkg…> && <original command>`. Tab again reverts it. Enter inserts exactly what the row
  shows. Tab does nothing on a candidate that isn't flagged. Tab is used because Shift alone isn't
  detectable in terminals and Shift+Enter usually sends the same byte as Enter.
- **D-10:** One install covers every missing tool in the candidate: `brew install fd xh && fd … | xh …`.
- **D-11:** The installer is the platform's package manager, chosen from the same `$commands`
  handoff: `brew` on darwin; on Linux the first of `apt`, `dnf`, `pacman` found (Claude chooses
  `sudo` and `-y` conventions per manager). If no manager is found, Tab is unavailable and the footer
  reads `not installed: fd — no package manager found`.
- **D-12:** Package names come from a small **shipped** tool→package alias map (rg → ripgrep,
  magick/convert → imagemagick, nvim → neovim, http → httpie, fdfind → fd-find, …). If a tool isn't in
  the map, its own name is used (a wrong guess fails visibly when the user runs it). The map isn't
  user-extendable.
- **D-13:** Candidates keep the **model's order**. Flagged candidates aren't re-sorted, because Tab
  install makes them usable. This replaces an earlier "sink flagged to the bottom" answer from the
  same discussion.

### Controls bar
- **D-14:** `tab install` appears in the controls bar (`src/ui/ControlsLine.tsx`) only while the
  selected candidate is flagged and an installer exists. While that row is in its install form, the
  hint reads `tab undo install` and the footer reads `will install: fd, xh`.

### Steering prompt wording
- **D-15:** The system prompt gets the installed catalog tools plus a "standard system utilities
  are also present" clause (from spike 003), and wording like: prefer installed tools; a
  not-installed tool is acceptable when it is clearly better for the task.
- **D-16:** The prompt requires **at least one candidate that uses only installed tools**, so there
  is always a works-now option.
- **D-17:** The prompt says never to include install steps (D-05).
- **D-18:** The steering text applies to every provider path that uses `QUEQUE_SYSTEM`: the SDK,
  `claude -p --system-prompt`, and any OpenAI/Ollama adapters added by Phase 8 (whichever phase
  ships second wires it).

### Claude's Discretion
- **Curated catalog** (not discussed): where it lives (default: shipped data in `src/`, seeded from
  `.claude/skills/spike-findings-tui-llm/sources/003-prompt-steering/catalog.ts`), and its exact
  contents.
- **On/off and fallback** (not discussed): whether there's a config or env switch, and behaviour when
  the handoff files are missing (e.g. an old widget). Sensible default: skip flagging and steering
  silently and log it to debug output. Never error the `??` request.
- How the handoff file paths reach the client (a request-contract field vs a fixed name in the
  request file's directory), and the `version` bump in `src/contracts/shell.ts`.
- The exact glyph and colour for the flag mark, and the exact footer and hint copy beyond D-11/D-14.
- Whether `missingTools` lives on the candidate contract or is computed in the client at render time.
- The steering prompt's final wording.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spike findings (implementation blueprint)
- `.claude/skills/spike-findings-tui-llm/SKILL.md` — requirements and feature-area index
- `.claude/skills/spike-findings-tui-llm/references/installed-command-handoff.md` — widget `rehash` + `$commands` handoff recipe, ~7 ms, what to avoid
- `.claude/skills/spike-findings-tui-llm/references/candidate-command-check.md` — hand lexer design, wrappers, fuzz-test requirement, the indexOf hang
- `.claude/skills/spike-findings-tui-llm/references/prompt-steering.md` — catalog ∩ installed list vs full list (spike 003 is PARTIAL: 6/15 queries)
- `.claude/skills/spike-findings-tui-llm/sources/002-candidate-binary-check/extract.mjs` + `cases.mjs` — reference implementation and 40 fixture cases
- `.claude/skills/spike-findings-tui-llm/sources/003-prompt-steering/catalog.ts` — seed catalog
- `.planning/spikes/MANIFEST.md` — installed-only-commands requirements

### Roadmap
- `.planning/ROADMAP.md` — Phase 9 goal and success criteria 1–6. D-13 (model order) and D-05
  (no install steps) refine SC 3. SC 3's "remains selectable and insertion-only" still holds.

### Prior phase decisions
- `.planning/phases/08-zero-config-install-and-provider-detection/08-CONTEXT.md` — provider pin, adapters that must also get the steering text (D-18)
- `.planning/phases/07-context-aware-learning-and-ambient-suggestions/07-CONTEXT.md` — ambient `??` uses the same prompt path, so steering applies there too

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shell/zsh/queque.zsh` (~L186–213): the widget already makes a private `mktemp -d` session dir
  (chmod 700) with a cleanup trap and writes `request.json` there. The handoff files go alongside it.
- `src/ui/CandidateSelect.tsx` (~L20–24, 228–279): the destructive-warning pattern (inline `⚠` after the
  last command line plus a footer when selected) is the template for the flag (D-08).
- `src/ui/ControlsLine.tsx`: the key-hint bar (`↑↓ select · enter accept · esc cancel`) where the
  conditional `tab install` goes (D-14).
- `src/providers/claude.ts`: `QUEQUE_SYSTEM` and `buildPrompt` are shared by the SDK and CLI paths (D-18).

### Established Patterns
- The context envelope has a discriminated union of chunks (`contextChunkSchema` in
  `src/contracts/request.ts`, kinds `git` and `filesystem`) that `buildPrompt` turns into prompt
  context after `filterContextEnvelope`. An installed-tools chunk fits this pattern.
- In `CandidateSelect.tsx` (~L162–175), `key.return` is checked before the generic input handler, and
  printable characters feed the search filter. Tab must be handled before the generic input path
  and must not reach the filter.
- Phase 6 privacy: `filterContextEnvelope` runs before any prompt assembly.

### Integration Points
- **The daemon builds the prompt.** The envelope crosses IPC (`src/contracts/ipc.ts:23`
  `fetch-candidates`, `src/daemon/fetch-client.ts:93`) and the daemon's adapter calls `buildPrompt`.
  So the catalog ∩ installed list must travel **inside the envelope**, not as files the daemon reads.
  The full installed set stays in the foreground client for flagging (it's 20 KB; keep it off IPC).
- Flagging happens in the foreground client after candidates return, before render (about 3.5 µs per
  candidate).
- `src/contracts/shell.ts`: shell request schema (`version`, `lbuffer`, `rbuffer`, …) for the handoff fields.
- `src/providers/claude-cli.ts:31` passes `QUEQUE_SYSTEM` via `--system-prompt`, so it gets the steering
  text automatically if it's composed into the system prompt.

</code_context>

<specifics>
## Specific Ideas

- The user's original framing: "only have commands shown to me for applications I have installed …
  fast … very little startup time while always being up to date." This led to the rehash-every-`??`
  handoff (D-01).
- The user's original idea was "hold shift to prepend install command". Terminals can't report Shift
  on its own, so this became a Tab toggle (D-09).
- Example install-form row: `brew install ripgrep && rg TODO -t ts`.

</specifics>

<deferred>
## Deferred Ideas

- Finishing spike 003 (`QUERY_START=6`) once Anthropic credits are topped up. This would confirm the
  steering numbers; it is not a build blocker.
- A user-extendable tool→package alias map. Explicitly declined for now (D-12).
- Deriving the catalog from `brew leaves`. Mentioned in spike findings, not chosen.

</deferred>

---

*Phase: 09-installed-only-command-awareness*
*Context gathered: 2026-10-07*
