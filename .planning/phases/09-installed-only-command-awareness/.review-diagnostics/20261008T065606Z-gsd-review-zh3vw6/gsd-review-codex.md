codex review failed or returned empty output. stderr:
OpenAI Codex v0.145.0
--------
workdir: /Users/samuel/dev/tui-llm
model: gpt-5.5
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: high
reasoning summaries: none
session id: 01a11a40-c16b-7232-888c-57321b55a223
--------
user
# Cross-AI Plan Review Request

You are reviewing implementation plans for a software project phase.
Provide structured feedback on plan quality, completeness, and risks.

## Project Context
# QueQue

## What This Is

QueQue is a `zsh`-integrated command-line assistant that opens from a literal `??` trigger while the user is editing the shell command line. It stays inside the terminal workflow, uses the text already typed before the trigger as context, and returns an explainable shell command back into the live buffer instead of pushing the user out to a browser or a prompt-taking CLI.

The initial product is for developers and terminal users who want faster command recall without giving up control, but it should also make the terminal less intimidating for newer users by showing what suggested commands do.

## Core Value

Turn natural-language intent into a shell command that feels native to the terminal workflow, not bolted on top of it.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Open from a literal `??` trigger inside `zsh` without taking over the shell prompt.
- [ ] Use pre-trigger command-line text plus current shell context to produce relevant command suggestions.
- [ ] Show a fuzzy-finder-like TUI with ranked commands and short explanations for high-confidence requests.
- [ ] Return the selected command back into the shell buffer safely and predictably.
- [ ] Define an LLM adapter interface so each backend implements the same request/response contract.

### Deferred

- [ ] Keep low-confidence requests inside an in-TUI clarification chat until a refined command is ready. *(Phase 5 deferred — Esc + re-query workaround)*

### Out of Scope

- Public plugin marketplace in v1 — extension seams matter now, but third-party loading can wait until the core UX is stable.
- Direct command execution in v1 — insertion-only is safer and preserves user control.
- Multi-shell support in v1 — macOS `zsh` is the fastest route to a usable product in two weeks.
- Persistent history by default — privacy-forward defaults matter more than convenience in the first release.

## Context

The product exists because current AI command-line helpers still feel like strangers in the normal terminal flow. Browser-based chat requires copy-paste, and many CLI tools either take over the prompt, feel constraining, or do not expose enough levers to tune their behavior. QueQue should feel more seamless: invoked inline from the current shell edit session, dismissible with `Esc`, and capable of writing the final command back into the same buffer.

The intended audience spans advanced shell users and newer users. Advanced users should reach for QueQue when they know what they want but do not want to recall exact syntax, quoting, or flag combinations. Newer users should benefit from short command explanations attached to each result so the tool teaches while it assists.

The product is meant to be used during development of the product itself. Daily-driver usage on the local machine is part of the feedback loop for bug fixing and UX refinement.

## Constraints

- **Timeline**: Reach a usable daily-driver product in 2 weeks — optimize for the fastest working path first.
- **Tech stack**: TypeScript on Node LTS — maximize implementation speed and API/TUI ergonomics.
- **Tooling stack**: `pnpm`, `tsup`, `vitest`, `zod`, `cac`, `ink`, `@anthropic-ai/sdk` — lock the MVP toolchain early so implementation can proceed in parallel.
- **Shell integration**: Deep `zsh` integration via ZLE widget — standalone CLI behavior is not enough.
- **Provider**: Start with Claude only via `ANTHROPIC_API_KEY` — provider abstraction must exist so this choice is not permanent.
- **Safety**: Return commands to the shell buffer, do not execute them automatically — users stay in control.
- **UX**: Stay inside terminal flow — avoid prompt takeover and browser detours.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use literal `??` as the trigger | Short, memorable, and purpose-built for inline invocation | — Pending |
| Capture text before the trigger as context | Makes suggestions sensitive to what the user was already building in the shell | — Pending |
| Use a confidence threshold of `0.8` | Supports a fast command-selection path without skipping needed clarification | — Pending |
| Keep high-confidence selection and low-confidence chat in the same TUI | Preserves flow and avoids switching UX modes unnecessarily | — Pending |
| Start with Anthropic/Claude only behind a provider interface | Fastest implementation path while preserving future model/provider expansion | — Pending |
| Model backends must implement one shared LLM adapter interface | Keeps Claude, OpenAI, and local-model support from diverging in behavior or transport shape | — Pending |
| Validate provider and IPC payloads with Zod | Shell mutation depends on trustworthy structured responses, so schemas should fail closed | — Pending |
| Use `pnpm` + `tsup` + `vitest` + `cac` as the CLI/tooling baseline | Keeps scaffolding, packaging, testing, and command parsing simple and fast for a 2-week MVP | — Pending |
| Start the TUI with Ink and helper input/list components, but keep a narrow UI adapter seam | Fastest route to a working fuzzy-list/chat prototype while preserving the option to swap UI internals if raw input handling proves limiting | — Pending |
| Prioritize extension seams early | Future shell adapters, providers, storage, and plugins should land independently | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

## Phase 9: Installed-Only Command Awareness
### Roadmap Section
### Phase 9: Installed-Only Command Awareness

**Goal:** Suggestions favour tools that are actually installed, and any suggestion that uses a tool the user does not have is visibly flagged "not installed" (never silently dropped). The `??` widget hands zsh's freshly rehashed `$commands` and `$builtins` to the client (~7 ms, always current, including tools installed earlier in the same session); the prompt carries the installed ∩ curated-catalog tool list; each returned candidate's command words are checked against the installed set. Blueprint: `.claude/skills/spike-findings-tui-llm` (spikes 001–003).
**Requirements**: TBD
**Depends on:** Phase 6 (prompt + context pipeline). Steering applies to every provider adapter present, including any added by Phase 8.
**Success Criteria** (what must be TRUE):

  1. A tool installed earlier in the same shell session (e.g. `brew install fd`) is treated as installed on the next `??` without restarting the shell.
  2. The widget handoff adds no more than ~10 ms to `??` startup on a machine with ~2k PATH commands.
  3. A candidate that uses a tool not in `$commands` is shown with a "not installed" flag naming the tool; it remains selectable and insertion-only.
  4. Builtins, reserved words, `<placeholders>`, `$VAR` commands and path commands (`./x.sh`) are never flagged.
  5. Malformed model output never hangs or crashes command-word extraction (fuzz test with a hard per-input timeout).
  6. The prompt includes only the installed ∩ curated-catalog tool list (not the full `$commands` list), across every provider adapter.

**Plans:** 5 plans

Plans:
**Wave 1**
- [ ] 09-01-PLAN.md — Tracer: zsh `$commands`/builtins/functions handoff → client reader → ported hand lexer → ⊘ "not installed" flag in the picker; handoff freshness, timing guard and flag tests (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 09-02-PLAN.md — Lexer proof: 40 spike cases as a vitest table, child-process fuzz with hard per-input timeouts (wave 2)
- [ ] 09-03-PLAN.md — Steering: catalog allow list, refine-guarded `installed-tools` chunk, `buildSystemPrompt` for the SDK and `claude -p` paths, adapters guard (wave 2)
- [ ] 09-04-PLAN.md — Tab install form: platform installer, package alias map, guarded install form, Tab toggle, controls hint (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 09-05-PLAN.md — Send the chunk across IPC with a stale-daemon capability bump; human check of the live `??` flow (wave 3)
### Requirements Addressed
No REQ-IDs mapped (ROADMAP: TBD). Success criteria SC-1..SC-6 above and CONTEXT.md decisions D-01..D-19 are the coverage source of truth.

### User Decisions (CONTEXT.md)
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

### Research Findings
# Phase 9: Installed-Only Command Awareness - Research

**Researched:** 2026-10-08
**Domain:** zsh ZLE handoff, shell-word lexing of untrusted model output, prompt steering, Ink keyboard UX
**Confidence:** HIGH for the codebase seams, the handoff, and the lexer. MEDIUM for the steering wording (spike 003 only got partway). MEDIUM for the timing budget (it measured over target today, see Pitfall 1).

## Summary

Phase 9 is almost entirely in-repo work and adds **no npm dependencies**. Spikes 001–003 already proved the three mechanisms:
- a zsh `rehash` + `print -rl -- ${(k)commands}` handoff into the private session tmpdir
- a hand-written lexer that pulls every command word out of a candidate in about 3.5 µs
- prompt steering with `catalog ∩ installed`

This research found where each one plugs into the current code, plus four integration hazards the spikes didn't cover.

1. **Stale daemon (new client, old daemon).** The daemon validates every IPC line with `ipcRequestSchema.safeParse` and silently ignores lines that fail. If you add a new `installed-tools` chunk kind to `contextChunkSchema`, an old daemon (still running after `brew upgrade`) never sends `fetch-accepted`. Every `??` then pays the 800 ms ack timeout plus a cold in-process fetch. Bump the daemon capability advertised in `pong`.
2. **Function-defined tools get false flags.** `nvm` on this machine is a zsh function, not a `$commands` entry (`nvm: cmd=0, fn=1`, probed this session). Under D-01 as written, `nvm use 20` gets flagged "not installed", and `nvm` is never steered as installed. This needs a user decision (Open Question 1).
3. **Timing is over target today.** The handoff measured **~10–12 ms** on this Mac this session (2,176 commands, 26 PATH dirs). The spike measured ~7 ms. SC 2 says "no more than ~10 ms", so a hard 10 ms test would be flaky. Two fallbacks are measured below.
4. **Install-form injection.** The model's command words feed the Tab install form. A quoted word like `"rm -rf ~"` lexes as a single word that isn't installed. Only words matching a strict package-name regex may enter `<installer> <pkg…>`.

**Primary recommendation:** Build these pieces:
- one self-contained `src/shared/command-words.ts`, a TS port of spike 002's `extract.mjs` with no imports and erasable syntax only, so a Node child can run it for the fuzz test
- one `src/shared/tool-awareness.ts` holding the catalog, the alias map, the installer choice, the missing-tool check and the install-form builder
- a `_qq_write_tool_handoff` zsh helper
- an `installed-tools` envelope chunk, validated so its names must be in the catalog
- a provider-neutral `buildSystemPrompt(envelope)`
- client-side flagging right before `app.rerender`

Keep the IPC candidate contract unchanged.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Carried forward from spikes 001–003 (locked before discussion)
- **D-01:** zsh's `$commands` is the source of truth for what's installed. The `??` widget runs
  `rehash`, then writes `${(k)commands}` and `${(k)builtins}` (names only, a single `print -rl`, no zsh
  loops, no sorting) into the existing private session tmpdir next to `request.json`. Budget: about 7 ms.
  No Node PATH scan, no daemon-side index.
- **D-02:** Builtins (from the `$builtins` handoff, never hardcoded), reserved words, `<placeholders>`,
  `$VAR` commands and path commands (`./x.sh`) are never flagged.
- **D-03:** Command-word extraction uses the spike 002 hand lexer ported to `src/`. It must never hang or
  throw on malformed model output: clamp `indexOf` −1, and fuzz test with a hard per-input timeout.
  shell-quote and sh-syntax are rejected.
- **D-04:** Only `curated catalog ∩ installed` goes into the prompt, never the full `$commands` list
  (spike 003: the full list costs ~33× the tokens and still leaked missing tools). The catalog is a
  public tool-name allow list, so no unusual or internal binary names reach the model. This keeps the
  Phase 6 privacy posture.

#### Install steps and self-installing commands
- **D-05:** The prompt forbids install steps. Candidates must not contain `brew install … && …`
  or similar. An install command appears only when the user presses Tab on a flagged candidate (D-09).
- **D-06:** If a model candidate includes an install step anyway, there is no special handling. Its
  command words are judged like any other: a missing tool is flagged, with no "installs X" label.
- **D-07:** Cases the prompt already prevents get no dedicated handling. Examples: use-before-install
  in one command, or a wrong-OS installer like `apt` on macOS (platform is in the prompt). The user's
  rule: don't build edge-case logic for malformed output the prompt already prevents.

#### Flag presentation (CandidateSelect)
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

#### Controls bar
- **D-14:** `tab install` appears in the controls bar (`src/ui/ControlsLine.tsx`) only while the
  selected candidate is flagged and an installer exists. While that row is in its install form, the
  hint reads `tab undo install` and the footer reads `will install: fd, xh`.

#### Steering prompt wording
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

### Deferred Ideas (OUT OF SCOPE)
- Finishing spike 003 (`QUERY_START=6`) once Anthropic credits are topped up. This would confirm the
  steering numbers; it is not a build blocker.
- A user-extendable tool→package alias map. Explicitly declined for now (D-12).
- Deriving the catalog from `brew leaves`. Mentioned in spike findings, not chosen.
</user_constraints>

<phase_requirements>
## Phase Requirements

No REQ-IDs are mapped (ROADMAP: "Requirements: TBD"). The six ROADMAP success criteria (SC) and D-01..D-18 are the source of truth.

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-1 | A tool installed earlier in the same session counts as installed on the next `??` | `rehash` before reading `$commands` in `_qq_write_tool_handoff`. Freshness probe passed this session (Pattern 1) |
| SC-2 | The handoff adds ≤ ~10 ms with ~2k commands | Measured 10–12 ms today. See Pitfall 1 for the test threshold and the two fallbacks |
| SC-3 | A missing tool is flagged and named; the candidate stays selectable and insertion-only | `missingTools()` runs in the client before `rerender`. Inline mark and footer follow the destructive pattern. Enter path unchanged (Pattern 4/5) |
| SC-4 | Builtins, reserved words, `<placeholders>`, `$VAR` and path commands are never flagged | Lexer `kind` classification (`builtin/placeholder/dynamic/path`), builtins from the handoff (Pattern 2) |
| SC-5 | Malformed output never hangs or crashes extraction | Clamp every `indexOf`, add a depth cap and a try/catch, fuzz in a child process with a hard timeout (Pattern 3) |
| SC-6 | The prompt carries only installed ∩ catalog, across every adapter | `installed-tools` chunk with a catalog-membership refine, `buildSystemPrompt()` shared by SDK and CLI. Phase 8 adapters must call it (Pattern 6) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Stack is locked: TypeScript on Node LTS, `pnpm`, `tsup`, `vitest`, `zod`, `cac`, `ink`, `@anthropic-ai/sdk`. **No new dependency is needed. Do not add shell-quote, sh-syntax or bash-parser (D-03).**
- Safety: commands go back to the shell buffer and are never auto-executed. The Tab install form is still insertion-only.
- Deep zsh integration through the ZLE widget. Stay inside the terminal flow.
- Do file edits through a GSD workflow (`/gsd:execute-phase`).
- OpenWolf: check `.wolf/anatomy.md` before reading files and `.wolf/cerebrum.md` (Do-Not-Repeat) before writing code. After edits, update `anatomy.md` and `memory.md`. Log bugs to `.wolf/buglog.json`. Commit `.wolf/` alongside code.
- Global user rule: presentational offsets belong in styling (Ink props such as `marginTop`), not computed in logic.
- Commit messages must respect commitlint. Subjects can't start with an acronym, and spike verdicts must be lowercase (cerebrum Do-Not-Repeat). No Co-Authored-By trailers (user memory).
- Lint changed files with biome before staging (user memory).
- Never stub dependencies in smoke or integration tests to make them pass (user memory, cerebrum 2026-06-08). The zsh tests must use real zsh and a real PATH dir.
- Inclusive terminology: write "allow list", not "whitelist" (the catalog is an allow list).
- Cerebrum learnings that apply here:
  - `pnpm test:run -- tests/x.test.ts` runs the WHOLE suite. Use `pnpm exec vitest run tests/x.test.ts`.
  - TDD RED tests that import new modules fail `tsc --noEmit` in pre-commit. Add throw-on-call stubs with the public exports first.
  - Daemon IPC handler throws must stay inside the promise chain.
  - Clamp `indexOf` −1 in hand lexers, and fuzz with a per-input timeout.
  - Do not import `src/cli/main.ts` in tests.
  - Do not pass `temperature`/`top_p`/`top_k`. Steer only through the system prompt.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fresh installed-command list (`rehash`, `$commands`, `$builtins`) | zsh widget (shell tier) | — | D-01: zsh is the source of truth. Only zsh sees the live hash table and in-session installs |
| Reading the handoff into `Set`s | Foreground client (`run-foreground.ts`) | — | Files live in the per-request tmpdir. The 20 KB set stays off IPC (CONTEXT integration note) |
| `catalog ∩ installed` computation | Foreground client | — | Needs the full set. Only the intersection crosses IPC, inside the envelope |
| Steering text and system prompt assembly | Daemon (provider adapters via `buildSystemPrompt`) | In-process fallback adapter | The daemon builds the prompt. The envelope is its only input |
| Command-word extraction and missing-tool flagging | Foreground client, after candidates arrive and before `rerender` | — | The full installed set lives only here. Costs about 3.5 µs per candidate |
| Installer and package-name choice, install form | Foreground client (`tool-awareness.ts`) | — | Uses the same `$commands` set and `process.platform` |
| Flag mark, footers, Tab toggle, controls hint | Ink UI (`CandidateSelect`, `ControlsLine`) | `modal-layout.ts` line estimate | Presentation only. Spacing goes in Ink props |
| Insertion into the shell buffer | zsh widget (`_qq_apply_result_str`) | — | Unchanged. The install form is just a longer `lbuffer` |

## Standard Stack

### Core (all already installed; nothing to add)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zsh | 5.9 (local) | `rehash`, `$commands`, `$builtins` through `zsh/parameter` | D-01. Verified locally |
| Node | v24.14.1 (local) | runtime. Native TS type-stripping lets the fuzz child run the `.ts` lexer directly | Verified by a probe this session |
| ink | 7.0.1 (package.json) | `useInput` sets `key.tab` | `[VERIFIED: node_modules/ink/build/hooks/use-input.js:54]` `tab: keypress.name === 'tab',` |
| zod | 4.1.5 | new `installed-tools` chunk schema with a catalog refine | Existing contract layer |
| vitest | 4.0.4 | unit, fuzz-driver and zsh smoke tests | Existing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand lexer | shell-quote / sh-syntax / bash-parser | **Rejected by D-03.** shell-quote scored 37/40 and misses `"…$(date)…"`, `<(…)` and backticks. sh-syntax exposes only `{Pos,End}`. bash-parser is unmaintained |
| Child process for the fuzz timeout | `worker_threads` + `worker.terminate()` | Both can stop a sync infinite loop. `terminate()` killed `while(true){}` in a probe this session. `spawnSync` with `timeout` matches the spike's harness and is simpler. Use `spawnSync` |
| vitest per-test `timeout` | — | **Doesn't work for this.** A synchronous infinite loop blocks the worker's event loop, so the timer never fires `[ASSUMED]` |

**Installation:** none. `pnpm install` is unchanged.

## Package Legitimacy Audit

This phase installs **no external packages**. The gate does not apply.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 user types "find big files??"
          │
          ▼
 ┌──────────────────────── zsh widget (qq-question-widget) ────────────────────────┐
 │ mktemp -d /tmp/qq-sess.XXXXXX (chmod 700) → request.json                         │
 │ _qq_write_tool_handoff $tmpdir:  rehash → commands.txt, builtins.txt (~10 ms)    │
 └───────────────┬──────────────────────────────────────────────────────────────────┘
                 │ qq client --request-file $tmpdir/request.json  (inline or zellij pane)
                 ▼
 ┌──────────────────────── foreground client (run-foreground.ts) ──────────────────┐
 │ parse request.json                                                               │
 │ readToolHandoff(dirname(requestFile)) ──missing/unreadable──▶ inventory = null   │
 │        │ (Sets: installed, builtins)                        (skip steer + flag,  │
 │        ▼                                                     debug-log only)     │
 │ gatherContext() → envelope                                                       │
 │ + extras.push({kind:'installed-tools', payload:{tools: CATALOG ∩ installed}})    │
 └───────────────┬──────────────────────────────────────────────────────────────────┘
                 │ IPC fetch-candidates {envelope}  (only ~55 public names, never 2k)
                 ▼
 ┌──────────────────────── daemon / in-process fallback ───────────────────────────┐
 │ adapter → buildSystemPrompt(envelope) = QUEQUE_SYSTEM + steering(tools)         │
 │        → SDK `system:` | claude -p `--system-prompt` | (Phase 8 OpenAI/Ollama)  │
 └───────────────┬──────────────────────────────────────────────────────────────────┘
                 │ candidates (model order, unchanged contract)
                 ▼
 ┌──────────────────────── foreground client ──────────────────────────────────────┐
 │ annotate: for each candidate → commandWords(lexHand(cmd), builtins)              │
 │           external ∉ installed → missingTools[]   (try/catch → [] on any throw)  │
 │ installer = pickInstaller(installed, platform)  (brew | apt | dnf | pacman | ∅)  │
 │ app.rerender(<CandidateSelect candidates=annotated installer=…/>)                │
 └───────────────┬──────────────────────────────────────────────────────────────────┘
                 ▼
 CandidateSelect: inline mark + footer (selected) ── Tab ──▶ row shows install form
                  ControlsLine: "tab install" / "tab undo install" (conditional)
                  Enter ──▶ onSelect(displayed command) ──▶ result → zsh LBUFFER (no exec)
```

### Recommended Project Structure
```
shell/zsh/queque.zsh             # + _qq_write_tool_handoff helper, called after request.json is written
src/shared/command-words.ts      # NEW: lexHand + commandWords (self-contained, zero imports, erasable TS only)
src/shared/tool-awareness.ts     # NEW: CATALOG, PACKAGE_ALIASES, missingTools, pickInstaller, buildInstallForm
src/client/tool-handoff.ts       # NEW: readToolHandoff(sessionDir) → ToolInventory | null
src/contracts/request.ts         # + 'installed-tools' chunk variant (catalog-refined)
src/contracts/ipc.ts             # + pong capability flag (e.g. installedTools: true)
src/daemon/server.ts             # pong advertises the new capability
src/daemon/bootstrap.ts          # replace daemons whose pong lacks the new capability
src/providers/steering.ts        # NEW: buildSteeringText(envelope), buildSystemPrompt(envelope)
src/providers/claude.ts          # system: buildSystemPrompt(envelope)
src/providers/claude-cli.ts      # --system-prompt buildSystemPrompt(envelope)
src/client/run-foreground.ts     # read handoff, push chunk, annotate before rerender
src/ui/CandidateSelect.tsx       # flag mark/footer, Tab toggle, install-form display
src/ui/ControlsLine.tsx          # conditional tab hint props
src/ui/modal-layout.ts           # line estimate counts the new footer(s) + install-form wrap
tests/fixtures/command-words-cases.ts        # 40 cases ported from spike cases.mjs
tests/fixtures/command-words-fuzz-child.mjs  # child process: imports ../../src/shared/command-words.ts
```

### Pattern 1: zsh handoff helper (D-01, SC-1/SC-2)
**What:** a top-level helper so `tests/zsh-widget.test.ts` can call it directly, the same way the suite already calls `_qq_capture_buffers` and `_qq_apply_result_str`.
**Where:** call it in `qq-question-widget` right after the `request.json` heredoc (`[VERIFIED: shell/zsh/queque.zsh:189-213]`). That block contains `tmpdir=$(mktemp -d /tmp/qq-sess.XXXXXX)`, `chmod 700 "$tmpdir"`, `req_file="$tmpdir/request.json"` and `"version": 1,`. Call it before the client launches in both the Zellij and inline branches.
```zsh
# Source: spike 001 (references/installed-command-handoff.md), probed this session under zsh -f
_qq_write_tool_handoff() {
  local dir="$1"
  zmodload zsh/parameter 2>/dev/null
  rehash                                            # drop stale table; picks up in-session installs
  print -rl -- ${(k)commands} > "$dir/commands.txt" # single expansion: no loops, no (o) sorting
  print -rl -- ${(k)builtins} > "$dir/builtins.txt"
}
```
Probe this session: a binary created after the table was primed showed `before rehash: 0`, then `after rehash: 1`. It worked under `zsh -f`, and `zsh/parameter` was loaded.

### Pattern 2: Lexer port (D-02, D-03, SC-4/SC-5)
**What:** a line-for-line TS port of `sources/002-candidate-binary-check/extract.mjs` (`lexHand`, `commandWords`, the `WRAPPERS` table, `RES_EXPECT`, `RES_LOOP`, `SHELLS`, `ASSIGN_RE`, `PLACEHOLDER_RE`, `REDIR_RE`). Leave out `fromShellQuote`, since shell-quote is rejected. Hardening to add to the port:
- every `indexOf` result is clamped (`< 0 → s.length`) before it becomes a cursor. The spike fixed the double-quote-backtick case, so audit **all** call sites: the single-quote branch in `scanBalanced` already returns `s.length`, and the word-level `'` and `` ` `` branches already clamp.
- a recursion depth cap on `commandWords` → `recurse` (e.g. depth > 32 → stop recursing). `'$('.repeat(2000)` finished in the spike, but deeper nesting could throw `RangeError`.
- a public wrapper `extractCommandWords(cmd, builtins)` that wraps everything in `try { … } catch { return [] }` and skips analysis for `cmd.length > 8192`. An internal failure then means "no flag", never a crash.
- **zero imports and erasable-only TS** (no `enum`, no `namespace`, no parameter properties). That lets `tests/fixtures/command-words-fuzz-child.mjs` do `import { … } from '../../src/shared/command-words.ts'` under Node 24's native type stripping. Verified this session: a `.mjs` child importing a `.ts` file with type annotations ran on Node v24.14.1 with exit 0. tsconfig has no `allowImportingTsExtensions`, so only the `.mjs` child may use a `.ts` specifier. `tsconfig.json` `include` covers only `.ts`/`.tsx`, so tsc never sees the `.mjs`.

Word kinds (from extract.mjs, verbatim): `'external'|'builtin'|'placeholder'|'dynamic'|'path'`. Only `external` words are checked against `installed`.

### Pattern 3: Fuzz with a hard per-input timeout (SC-5)
```ts
// tests/command-words-fuzz.test.ts — Source: spike 002 fuzz-child.mjs + find-hang.mjs
import { spawnSync } from 'node:child_process';
const child = new URL('./fixtures/command-words-fuzz-child.mjs', import.meta.url).pathname;
it('20k random inputs finish without hang or throw', () => {
  const r = spawnSync(process.execPath, [child, 'fuzz', '20000'], { timeout: 15_000, encoding: 'utf8' });
  expect(r.error).toBeUndefined();          // ETIMEDOUT here = a hang
  expect(r.status).toBe(0);
  expect(r.stdout).toContain('fuzz ok');
});
it.each(CRAFTED_MALFORMED)('crafted %j finishes within 1 s', (s) => {
  const r = spawnSync(process.execPath, [child, 'one', s], { timeout: 1_000 });
  expect(r.error).toBeUndefined();
  expect(r.status).toBe(0);
});
// deep: child 'deep' 2000 → reports ms; assert < 100
```
Copy `CRAFTED_MALFORMED` verbatim from `find-hang.mjs`, including the minimal repro `"a" "\``. The fuzz alphabet is ``ab $()`'"|&;<>{}[]\#=\n\t-``. The child should print the current input to stderr before each case so a timeout is diagnosable, as the spike did.

### Pattern 4: Client-side annotation (SC-3, Discretion: where `missingTools` lives)
**Recommendation:** compute `missingTools` in the client and attach it to a **UI-local type**. Do **not** change `commandCandidateSchema`/`candidateListSchema`, because the daemon never sees the full installed set. Today the schema is:
```ts
// [VERIFIED: src/contracts/candidates.ts:3-6,10]
export const commandCandidateSchema = z.object({
  command: z.string().trim().min(1),
  explanation: z.string(),
});
export const candidateListSchema = z.array(commandCandidateSchema).min(1).max(5);
```
```ts
// src/shared/tool-awareness.ts (sketch)
export interface ToolInventory { installed: ReadonlySet<string>; builtins: ReadonlySet<string> }
export type DisplayCandidate = CommandCandidate & { missingTools?: readonly string[] };
export function missingTools(command: string, inv: ToolInventory): string[] {
  const seen = new Set<string>();
  for (const { word, kind } of extractCommandWords(command, inv.builtins)) {
    if (kind === 'external' && !inv.installed.has(word)) seen.add(word);
  }
  return [...seen];                       // dedupe: `docker ps | xargs docker stop` → once
}
```
Hook point: `[VERIFIED: src/client/run-foreground.ts:280-284]`
```ts
fetchCandidatesForUi(socketPath, envelope)
  .then((candidates) => {
    void appendDebugLog('client', 'candidates received', { count: candidates.length });
    app.rerender(buildCandidateElement(candidates));
```
Annotate between receipt and `rerender`. When `inventory === null`, pass the candidates through unflagged.

### Pattern 5: CandidateSelect Tab toggle and flag (D-08..D-14)
Current anchors:
- `[VERIFIED: src/ui/CandidateSelect.tsx:21,24]` `const DESTRUCTIVE_WARNING_MARK = '⚠';` and `` const DESTRUCTIVE_WARNING_TEXT = `${DESTRUCTIVE_WARNING_MARK} review carefully — this command may be destructive`; ``
- `[VERIFIED: src/ui/CandidateSelect.tsx:86-87]` state order: `const [selectedIndex, setSelectedIndex] = useState(0);` then `const [query, setQuery] = useState(initialQuery ?? '');`
- `[VERIFIED: src/ui/CandidateSelect.tsx:254-256]` inline mark: `{isLastCommandLine && destructive && ( <Text color="yellow">{` ${DESTRUCTIVE_WARNING_MARK}`}</Text> )}`

Rules:
- **Add the new `useState` (install-form toggles) AFTER the two existing ones.** `tests/candidate-select.test.tsx` mocks `useState` by call order and reads `stateValues[0]`/`stateSetters[1]` (lines 449, 576–630).
- Key the toggle state by candidate identity (`${command}::${explanation}`, the key the component already uses at line 236), **not** by visible index. The search filter re-indexes `visible`. Clear the toggles when `candidates` changes.
- Handle `key.tab` **before** `key.return` and before the generic `input` branch. Ink already passes `input === ''` for Tab, because `'tab'` is in `nonAlphanumericKeys` (`[VERIFIED: node_modules/ink/build/hooks/use-input.js:91-94]`). Even so, an explicit early `return` keeps Tab out of the filter on Kitty-protocol terminals. Shift+Tab (`\x1b[Z`) also reports `key.tab` with `key.shift`. Treat it the same (a toggle).
- Ink's App only cycles focus on Tab when focusable components exist (`[VERIFIED: node_modules/ink/build/components/App.js:290-291]` `if (!isFocusEnabled || focusablesCountRef.current === 0) return;`). CandidateSelect uses no `useFocus`, so Tab reaches our handler.
- Enter sends the **displayed** command (install form if toggled). Build the explanation fallback (`see man ${command.split(' ')[0]}`, line 170) from the **original** command, so it doesn't read `see man brew`.
- Evaluate `isDestructiveCommand` on the displayed text. Note that `DEFAULT_DESTRUCTIVE_COMMAND_PATTERNS` includes `'\\bsudo\\b'` (`[VERIFIED: src/shared/qq-config.ts:21-28]`), so on Linux the apt/dnf/pacman install form also shows `⚠`. D-08 allows both marks. This is expected, not a bug.
- Footer copy (D-08/D-11/D-14): `not installed: fd, xh` · `not installed: fd — no package manager found` · `will install: fd, xh`.
- Glyph (Discretion): recommend `⊘` in `cyan`. It differs from the yellow `⚠` and from the `ansi256(166)` active gutter `[ASSUMED: renders single-width in common macOS terminal fonts]`.
- `ControlsLine` takes an optional prop such as `tabHint?: 'install' | 'undo install'` and renders ` tab ` / ` install ` chips in the existing style (`[VERIFIED: src/ui/ControlsLine.tsx:8-27]`, `backgroundColor="ansi256(238)"` / `"ansi256(245)"`). `candidate-select.test.tsx` mocks `ControlsLine` (line ~45), so add a small separate test for the hint.

### Pattern 6: Provider-neutral steering (D-15..D-18, SC-6)
Current anchors:
- `[VERIFIED: src/providers/claude.ts:39-40]` `export const QUEQUE_SYSTEM = 'You are QueQue, a terminal shell assistant. Return ONLY a JSON array …';`
- `[VERIFIED: src/providers/claude.ts:174]` `system: QUEQUE_SYSTEM,`
- `[VERIFIED: src/providers/claude-cli.ts:31-33]` `'--system-prompt', QUEQUE_SYSTEM, prompt,`

Create `src/providers/steering.ts`:
```ts
export function buildSystemPrompt(envelope: ContextEnvelope): string {
  const steering = buildSteeringText(filterContextEnvelope(envelope));
  return steering ? `${QUEQUE_SYSTEM}\n\n${steering}` : QUEQUE_SYSTEM;
}
// Draft wording (Discretion; D-15/16/17):
// Notable command-line tools installed on this machine (standard system utilities are also present): rg fzf bat jq …
// Prefer installed tools. A tool that is not installed is acceptable only when it is clearly better for the task.
// At least one candidate must use only installed tools or standard system utilities.
// Never include install steps (no brew/apt/dnf/pacman install, no curl | sh) in any candidate.
```
- When the chunk is absent (old widget, missing files, kill switch), return `QUEQUE_SYSTEM` byte-for-byte. Existing behaviour and tests stay unchanged.
- Keep `QUEQUE_SYSTEM` exported. Phase 8's 08-03 (Ollama) and 08-04 (OpenAI) aren't in `src/providers/` yet (the directory has only `claude*.ts`, `detect.ts`, `index.ts`, `provider.ts`, `resolver.ts`). D-18 makes the second phase to ship do the wiring. Add a guard test: no file in `src/providers/` other than `steering.ts`/`claude.ts` passes `QUEQUE_SYSTEM` straight to a model call. Also add a line to `docs/EXTENSIONS.md` saying adapters must call `buildSystemPrompt(envelope)`.
- The CLI path puts the system prompt on argv, so it's visible in `ps`. That's the accepted risk T-08-02-07. The added text is only public catalog names, so the disclosure doesn't grow meaningfully.

### Pattern 7: Envelope chunk with structural privacy (D-04)
Existing union: `[VERIFIED: src/contracts/request.ts:74-94]` `contextChunkSchema = z.discriminatedUnion('kind', [ … z.literal('git') … z.literal('filesystem') … ])`. Add:
```ts
z.object({
  kind: z.literal('installed-tools'),
  payload: z.object({
    /** Public catalog names only — refine rejects anything outside CATALOG (D-04 structural guard). */
    tools: z.array(z.string()).max(CATALOG.length).refine((ts) => ts.every((t) => CATALOG_SET.has(t))),
  }),
}),
```
This keeps the same privacy philosophy as the D-05/D-06 comment on the union. A bug that pushed the full `$commands` list would fail schema validation instead of reaching the model. Sort the intersection in Node (sorting in zsh costs 167 ms).

### Pattern 8: Handoff discovery (Discretion: contract field vs fixed name)
**Recommendation: fixed sibling names, no `version` bump.** The client derives `commands.txt`/`builtins.txt` from `path.dirname(requestFile)`.
- The schema is `[VERIFIED: src/contracts/shell.ts:8-15]` `version: z.literal(1), ttyPath: z.string(), cwd: …, shellPid: …, lbuffer: z.string(), rbuffer: z.string()`. Bumping to `z.literal(2)` would make a **new client reject requests from an old widget** that's still loaded in a long-running shell after `brew upgrade`, and the reverse for dev setups.
- Fixed names confine reads to the chmod-700 session dir. A JSON path field would let the request file point the client at any file.
- Missing or unreadable files mean `inventory = null`: skip steering and flagging, `appendDebugLog('client','tool handoff unavailable',{reason})`, never error.
- Kill switch (Discretion): an env-only `QQ_TOOL_AWARENESS=0`, read in the client, gives `inventory = null`. It's cheap, and it's an escape hatch if flags turn out wrong (see Open Question 1). No config-file key.

### Pattern 9: Installer and install form (D-09..D-12)
```ts
const INSTALLERS = {
  brew:   (pkgs) => `brew install ${pkgs.join(' ')}`,
  apt:    (pkgs) => `sudo apt install ${pkgs.join(' ')}`,
  dnf:    (pkgs) => `sudo dnf install ${pkgs.join(' ')}`,
  pacman: (pkgs) => `sudo pacman -S ${pkgs.join(' ')}`,
};
// darwin → brew if installed.has('brew'); linux → first of apt, dnf, pacman in installed; else null.
```
- **No `-y`/`--noconfirm`** (D-11 discretion). The user runs the command themselves, and the manager's own confirmation keeps them in control `[ASSUMED: user preference; confirm]`.
- **Package-name safety:** only missing words matching `/^[A-Za-z0-9][A-Za-z0-9._+-]*$/` become installable. If any missing word fails the regex, the row is still flagged, but the footer says so and Tab is unavailable. Model words can contain spaces or metacharacters through quoting.
- **List wrapping:** if the original command has a top-level `;`, `||`, `&` or newline op (the lexer exposes `op` tokens), emit `<installer> … && { <cmd>; }`. Otherwise `a || b` / `a; b` would run `b` even when the install fails. Pipelines `a | b` need no wrap, because `&&` binds looser than `|` `[ASSUMED: POSIX/zsh precedence; low risk]`.
- Alias map seed (D-12). Brew formulae verified to exist this session with `brew info --formula --json=v2`: ripgrep, imagemagick, neovim, httpie, fd, git-delta, bottom, difftastic, gnu-time, coreutils, ffmpeg, visidata, csvkit, miller, the_silver_searcher, kubernetes-cli, bind, ripgrep-all, tealdeer, awscli. The binary→formula links confirmed through `brew list`: `rg`→ripgrep, `delta`→git-delta, `nvim`→neovim, `magick`→imagemagick, `ag`→the_silver_searcher, `gtimeout`→coreutils, `ffprobe`→ffmpeg. The rest (`btm`→bottom, `difft`→difftastic, `http`/`https`→httpie, `vd`→visidata, `mlr`→miller, `csvlook`→csvkit, `gtime`→gnu-time, `kubectl`→kubernetes-cli, `dig`→bind, `rga`→ripgrep-all, `tldr`→tealdeer, `aws`→awscli, `convert`→imagemagick, `fdfind`→fd-find, `batcat`→bat) are `[ASSUMED]`.

### Pattern 10: Stale-daemon capability bump
- `[VERIFIED: src/daemon/server.ts:61-65]` invalid requests are dropped silently: `if (!result.success) { void appendDebugLog('daemon', 'ignored unknown request', …); continue; }`
- `[VERIFIED: src/daemon/fetch-client.ts:9]` `export const FETCH_ACK_MS = 800;`. Lines 139–143 fall back to an in-process (cold) adapter on `IpcTransportError`.
- `[VERIFIED: src/contracts/ipc.ts:34-37]` the pong is `kind: z.literal('pong'), fetchCandidates: z.literal(true).optional(),`
- `[VERIFIED: src/daemon/bootstrap.ts:211-216]` the current daemon is kept when `cap !== 'no'`.

Add `installedTools: z.literal(true).optional()` to the pong and send it from `server.ts`. Extend `pingDaemonFetchCap` so that a pong lacking the new flag returns `'no'` and gets replaced. Keep `'unknown'` (no reply) kept, so dumb test sockets survive (cerebrum).

### Anti-Patterns to Avoid
- Looping (`for k v in ${(kv)commands}`, 136 ms) or sorting (`${(ko)commands}`, 167 ms) in zsh. Add a static test asserting the widget source has neither.
- A Node PATH scan, `fs.watch`, or a daemon-side index (D-01).
- Sending the full `$commands` list or `missingTools` over IPC or to the model (D-04).
- Hardcoding builtins (D-02). Use `builtins.txt`.
- Re-sorting flagged candidates (D-13).
- Dropping flagged candidates (SC-3).
- Building "installs X" labels or use-before-install detection (D-06/D-07).
- Logging the installed list. Log counts only: `{ installed: n, builtins: n, steered: n }`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Knowing what's installed | PATH walk in Node, `which` per word | zsh `$commands` after `rehash` | D-01. zsh sees hashing rules, in-session installs and `hash` entries exactly as the shell will |
| Builtin list | hardcoded array | `${(k)builtins}` handoff | Varies with loaded modules (104 here, 103 in the spike) |
| Shell parsing | a new lexer from scratch | **port** spike 002 `extract.mjs` (40/40 cases, fuzzed) | It already handles `$()` in double quotes, `<()`, backticks, wrappers, `find -exec`, `sh -c`, placeholders. Rewriting reintroduces the −1 cursor hang |
| Fuzz timeout | in-process timer | `spawnSync(..., { timeout })` child | A sync infinite loop can't be interrupted in-process |

**Key insight:** each piece is already validated in a spike. The risk is in the seams (IPC compat, test state indexing, layout estimates, shell precedence), not in the algorithms.

## Common Pitfalls

### Pitfall 1: SC-2 timing is over budget on this machine today
**What goes wrong:** the handoff measured `rehash` 0.1–0.5 ms, refill **9.8–19.8 ms**, write 2.1–3.1 ms. Five repeated runs totalled **9.6–10.4 ms**. With interactive `zsh -i` it was 10.1 ms. The spike measured ~7 ms.
**How to avoid:**
- Make the automated test a **regression guard**: median of 5 runs < 25 ms. That catches loops and sorting, which cost 136–167 ms. Print the measured median so the verifier can compare it to the ~10 ms target by hand.
- If the user wants SC-2 met strictly, there are two measured fallbacks, and both need a decision because they modify D-01:
  - (a) an mtime fingerprint (`zstat` over `$path`: **1.4 ms** for 26 dirs). `rehash` runs only when the fingerprint changes, and the no-rehash write measured 2–5 ms. There's a 1 s mtime staleness window.
  - (b) run the handoff in a background subshell `( … ) &!` that writes `*.tmp` then `mv`. Node startup hides the ~10 ms. If the files are absent when the client reads them, it falls back to no steering.
**Warning signs:** a perceptible `??` delay, or the timing test median creeping toward the threshold.

### Pitfall 2: Old daemon rejects the new chunk
See Pattern 10. Without the capability bump, the symptom is +800 ms and a cold fetch on every `??` after an upgrade, with only `ignored unknown request` in the debug log.

### Pitfall 3: useState call order in tests
`tests/candidate-select.test.tsx` maps `useState` calls by index. Put the new state after `query`, or existing tests read the wrong values.

### Pitfall 4: Layout estimate and viewport reserve drift
`estimateCandidateSelectLines` must add 2 lines (marginTop + text) for the flag footer, alongside the existing destructive footer (`[VERIFIED: src/ui/modal-layout.ts:117-123]`, `lines += 1; // marginTop` / `lines += 1; // warning text`). It must also wrap the **displayed** (install-form) command, and it needs the toggle state and flags as new inputs. Also `[VERIFIED: src/client/run-foreground.ts:196]` `const MODAL_VIEWPORT_LINES = 16;` assumes 3 candidates and no footers. Destructive plus flag footers add 4 lines. Raise the reserve to cover both, e.g. 20, or the inline (non-Zellij) render scrolls.

### Pitfall 5: Function and alias tools flagged falsely
`nvm` is a function here (probe: `commands=0, functions=1`). Others are often functions too: `conda`, `sdk`, older `asdf`, zoxide's `z`. They'll be flagged "not installed", and they're never steered as installed. See Open Question 1.

### Pitfall 6: `buildShellBuffers` and the install form
`[VERIFIED: src/client/run-foreground.ts:31-33]` `const stripped = command.replace(/<([^>]+)>/g, '$1'); const firstAngle = command.indexOf('<');`. The install form only adds a literal prefix, so the cursor still lands on the first placeholder. Add one test: `brew install fd && fd <pattern>` → `lbuffer` ends with `fd `.

### Pitfall 7: Zellij path reads the files late
In Zellij the client starts in another pane. The widget only cleans up after the FIFO read, so the files exist. Still, read the handoff **eagerly** at client start (alongside `request.json`), not when candidates arrive.

### Pitfall 8: Steering text in the wrong prompt
D-15 puts the list in the **system** prompt. Don't add it to `buildPrompt`'s user JSON. The `claude-provider` tests assert on `messages[0].content`, so keep the user prompt byte-stable when there's no chunk.

## Code Examples

### Client handoff reader
```ts
// src/client/tool-handoff.ts — Source: spike 001 step 3
export async function readToolHandoff(sessionDir: string): Promise<ToolInventory | null> {
  if (process.env.QQ_TOOL_AWARENESS === '0') return null;
  try {
    const [c, b] = await Promise.all([
      fsp.readFile(path.join(sessionDir, 'commands.txt'), 'utf8'),
      fsp.readFile(path.join(sessionDir, 'builtins.txt'), 'utf8'),
    ]);
    const split = (s: string) => new Set(s.split('\n').filter(Boolean));
    const installed = split(c);
    return installed.size > 0 ? { installed, builtins: split(b) } : null;
  } catch (error) {
    void appendDebugLog('client', 'tool handoff unavailable', { message: String(error) });
    return null;
  }
}
```
`tests/client-result.test.ts` passes `fs/promises.readFile` through to the real implementation (`...original`). Its temp request dirs have no `commands.txt`, so the existing tests exercise the null fallback automatically. Keep it that way: don't stub the handoff there.

### zsh freshness test (SC-1, real zsh, no stubs)
```ts
const { stdout } = runZsh(`
  d=$(mktemp -d); mkdir -p $d/bin; path=($d/bin $path)
  : \${#commands}                       # prime the hash table
  print '#!/bin/sh' > $d/bin/qqfreshtool; chmod +x $d/bin/qqfreshtool
  _qq_write_tool_handoff $d
  grep -cx qqfreshtool $d/commands.txt; grep -cx cd $d/builtins.txt; rm -rf $d`);
expect(stdout.trim().split('\n')).toEqual(['1', '1']);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static `QUEQUE_SYSTEM` string | `buildSystemPrompt(envelope)` = base + optional steering | Phase 9 | Every adapter must call it (D-18) |
| Candidates rendered as returned | Client annotates `missingTools` before render | Phase 9 | No contract change. UI-local type |
| Node 24: running `.ts` needs a loader | Native type stripping runs erasable-syntax `.ts` | Node 23.6+ (unflagged) `[ASSUMED: version]`; verified working on v24.14.1 | The fuzz child can import the real source |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | vitest's per-test timeout can't interrupt a synchronous infinite loop | Alternatives | Low. The child-process approach is used either way |
| A2 | `⊘` renders single-width in common terminal fonts | Pattern 5 | Cosmetic misalignment. Swap the glyph |
| A3 | No `-y`/`--noconfirm` for apt/dnf/pacman is what the user wants | Pattern 9 | Extra confirmation prompt. Trivial to change |
| A4 | Binary→formula mappings not confirmed with `brew list` (btm, difft, http, vd, mlr, csvlook, gtime, kubectl, dig, rga, tldr, aws, convert, fdfind, batcat) | Pattern 9 | Wrong package in the install form. Fails visibly when run (accepted by D-12) |
| A5 | `&&` binds looser than `\|`, so pipelines need no brace wrap | Pattern 9 | Install form runs the wrong scope |
| A6 | Debian/Ubuntu names differ (e.g. `fd`→`fd-find`, `bat` binary is `batcat`). A single platform-agnostic map gives brew names on apt | Pattern 9 | Wrong apt package for a few tools. Accepted by D-12 ("fails visibly") |
| A7 | Native TS stripping has been unflagged since Node 23.6 | State of the Art | None for this repo. Verified on the installed v24.14.1 |

## Open Questions (RESOLVED)

1. **Treat zsh functions and aliases as installed for flagging and steering?**
   - What we know: `nvm` is a function here. `print -rl -- ${(k)functions:#_*} ${(k)aliases}` costs **~1.6 ms**, 494 names. The `:#_*` filter drops completion and private `_qq_*` functions. These names would stay client-side, and only catalog members would ever reach the model.
   - What's unclear: D-01 locks "commands and builtins" only.
   - Recommendation: ask the user. If yes, write a third file `functions.txt` and treat its names as installed, never installable. If no, accept the false flags as documented behaviour.
   - **RESOLVED (2026-10-08):** user chose yes. D-01 amended in 09-CONTEXT.md: functions (`:#_*`) and aliases are handed off and count as installed.
2. **SC-2 strictness.** Accept ~10–12 ms with a < 25 ms regression guard, or adopt fallback (a) or (b) from Pitfall 1? Recommendation: ship D-01 as is, record the measured median in VERIFICATION, and revisit only if the user perceives lag.
   - **RESOLVED (2026-10-08):** user chose the regression guard. Recorded as D-19 in 09-CONTEXT.md (always rehash, median of 5 < 25 ms, median printed).
3. **Spike 003 is partial** (deferred). The steering wording is a draft. The flag is the safety net whatever the steering quality.
   - **RESOLVED (deferred):** finishing spike 003 stays out of scope (09-CONTEXT.md Deferred Ideas); plans ship the draft wording with the flag as the safety net.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| zsh | handoff, zsh tests | ✓ | 5.9 | — |
| node | runtime, fuzz child (type stripping) | ✓ | v24.14.1 | — |
| pnpm | scripts | ✓ | 12.6.0 | — |
| jq | widget (existing) | ✓ | /usr/local/bin/jq | — |
| brew | darwin installer (runtime only) | ✓ | Homebrew 7.0.7 | none needed in tests (inject sets) |
| apt / dnf / pacman | Linux installer branch | ✗ (macOS host) | — | unit-test with injected `installed` sets and `platform: 'linux'` |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.4 (`environment: 'node'`, includes `tests/**/*.test.ts(x)`) |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm exec vitest run tests/<file>.test.ts` (never `pnpm test:run -- …`, which runs the whole suite) |
| Full suite command | `pnpm test:run && pnpm typecheck && pnpm lint` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | Binary created after hashing appears in `commands.txt`. `builtins.txt` contains `cd` | zsh smoke (real zsh) | `pnpm exec vitest run tests/zsh-widget.test.ts -t "tool handoff"` | ✅ file, ❌ cases |
| SC-1 | Widget calls `_qq_write_tool_handoff "$tmpdir"` before both client launches. No `(kv)` loop or `(ko)` sort | static source | same file | ✅ / ❌ cases |
| SC-2 | Median of 5 handoff runs < 25 ms. Median printed | zsh timing | same file `-t "handoff timing"` | ❌ |
| SC-3 | `missingTools` dedupes and names the tools. Flagged rows keep their order and stay selectable. Enter inserts the displayed text | unit + component | `pnpm exec vitest run tests/tool-awareness.test.ts tests/candidate-select.test.tsx` | ❌ / ✅ |
| SC-3 | Tab toggles the install form. Tab is a no-op on unflagged rows and never reaches the filter. No installer → Tab unavailable plus the D-11 footer. Copy per D-14 | component | `pnpm exec vitest run tests/candidate-select.test.tsx -t "install"` | ✅ / ❌ cases |
| SC-3 | ControlsLine shows `tab install` / `tab undo install` only when given | component | `pnpm exec vitest run tests/controls-line.test.tsx` | ❌ |
| SC-3 | Layout estimate counts the flag footer and install-form wrap | unit | `pnpm exec vitest run tests/modal-layout.test.ts` | ✅ / ❌ cases |
| SC-4 | 40 spike cases pass. Builtin/resword/placeholder/`$VAR`/path never `external` | unit table | `pnpm exec vitest run tests/command-words.test.ts` | ❌ |
| SC-5 | 20k fuzz in a child (15 s cap), crafted malformed inputs at 1 s each, `'$('×2000` < 100 ms, wrapper never throws | child-process fuzz | `pnpm exec vitest run tests/command-words-fuzz.test.ts` | ❌ |
| SC-6 | System prompt (SDK `system`, CLI `--system-prompt` arg) contains the steering text and only catalog names. Unchanged when the chunk is absent. Chunk schema rejects non-catalog names | unit | `pnpm exec vitest run tests/steering.test.ts tests/claude-provider.test.ts tests/claude-cli-provider.test.ts` | ❌ / ✅ / ✅ |
| SC-6 | No adapter in `src/providers/` uses `QUEQUE_SYSTEM` directly except through `buildSystemPrompt` | static guard | `pnpm exec vitest run tests/steering.test.ts -t "adapters"` | ❌ |
| Compat | Pong lacking `installedTools` is replaced. No reply is kept | unit | `pnpm exec vitest run tests/daemon-bootstrap.test.ts` | ✅ / ❌ cases |
| Fallback | Missing handoff files → no chunk, no flags, no error | unit | `pnpm exec vitest run tests/tool-handoff.test.ts tests/client-result.test.ts` | ❌ / ✅ |

### Sampling Rate
- **Per task commit:** the quick-run command for the touched test files, plus `pnpm typecheck`
- **Per wave merge:** `pnpm test:run`
- **Phase gate:** `pnpm test:run && pnpm typecheck && pnpm lint` green before `/gsd-verify-work`. Also one manual `??` after `brew install <tool>` in the same shell (SC-1 end-to-end) and a recorded handoff median (SC-2)

### Wave 0 Gaps
- [ ] `src/shared/command-words.ts`, `src/shared/tool-awareness.ts`, `src/client/tool-handoff.ts`, `src/providers/steering.ts`: throw-on-call stubs with public exports, so RED tests pass `tsc --noEmit` (cerebrum)
- [ ] `tests/fixtures/command-words-cases.ts`: port the 40 cases from `sources/002-candidate-binary-check/cases.mjs`
- [ ] `tests/fixtures/command-words-fuzz-child.mjs`: modes `fuzz N`, `one <s>`, `deep N`
- [ ] `tests/command-words.test.ts`, `tests/command-words-fuzz.test.ts`, `tests/tool-awareness.test.ts`, `tests/tool-handoff.test.ts`, `tests/steering.test.ts`, `tests/controls-line.test.tsx`
- No framework install is needed.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes (local files) | Handoff confined to the chmod-700 `mktemp -d` session dir through fixed sibling names. No path taken from JSON |
| V5 Input Validation | yes | Model output is untrusted: total, non-throwing lexer with a depth and length cap. zod `installed-tools` chunk with a catalog refine. Package-name regex before building the install form |
| V6 Cryptography | no | — |
| V8 Data Protection / privacy | yes | Only public catalog names leave the client (D-04). The full list stays off IPC, logs and the model. Debug logs carry counts only |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Crafted or truncated model output hangs the picker | DoS | Clamped cursors, depth cap, try/catch wrapper, child-process fuzz (SC-5) |
| Quoted command word injects args into the install form (`"x -rf ~"`) | Tampering | `/^[A-Za-z0-9][A-Za-z0-9._+-]*$/` gate. Insertion-only, so the user reviews before running |
| Full `$commands` list leaks unusual or internal binary names to the provider | Info disclosure | Catalog intersection plus schema refine. `ps` exposure on the CLI path is limited to public names |
| Symlink or tmp race on handoff files | Tampering | Existing `mktemp -d` + `chmod 700` (CR-006). The files are written inside it |
| Install form chained by `;`/`\|\|` runs the user's command after a failed install | Tampering/Safety | `{ …; }` wrap when top-level list ops exist |

## Sources

### Primary (HIGH confidence)
- In-repo files read this session: `shell/zsh/queque.zsh`, `src/contracts/{shell,request,candidates,ipc}.ts`, `src/providers/{claude,claude-cli,claude-default,resolver,provider,index}.ts`, `src/client/run-foreground.ts`, `src/ui/{CandidateSelect,ControlsLine}.tsx`, `src/ui/modal-layout.ts`, `src/context/{pipeline,provider,base-context}.ts`, `src/shared/privacy-filter.ts`, `src/shared/qq-config.ts` (patterns), `src/daemon/{server,fetch-client,bootstrap}.ts`, `tsconfig.json`, `vitest.config.ts`, `package.json`, `lefthook.yml`, `tests/candidate-select.test.tsx` (mocks), `tests/client-result.test.ts` (fs mocks), `tests/zsh-widget.test.ts` (harness)
- `node_modules/ink/build/hooks/use-input.js`, `parse-keypress.js`, `components/App.js` (installed ink 7.0.1)
- Spike blueprint: `.claude/skills/spike-findings-tui-llm/` (SKILL.md, 3 references, sources 001–003)
- Local probes this session: zsh freshness/timing, functions/aliases cost, Node `.ts` import from `.mjs`, Worker terminate, brew formula existence and binary mapping

### Secondary (MEDIUM confidence)
- Context7 `/vadimdemedes/ink`: `useInput` key fields, Tab/Shift+Tab focus example
- zsh manual, zsh/parameter module (https://zsh.sourceforge.io/Doc/Release/Zsh-Modules.html): `commands`, `builtins`, `functions`, `aliases`, `reswords` semantics

### Tertiary (LOW confidence)
- Spike 003 steering numbers (partial run, n=6)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new dependencies. Versions read from package.json and the local toolchain.
- Architecture: HIGH. Every integration point was read in source and cited.
- Pitfalls: HIGH for IPC compat, state indexing and layout (read in code). MEDIUM for timing (machine-dependent).
- Steering wording: MEDIUM. Spike 003 is partial.

**Research date:** 2026-10-08
**Valid until:** 2026-11-07 (stable in-repo domain; re-check if Phase 8 adapters land first)

### Plans to Review
#### .planning/phases/09-installed-only-command-awareness/09-01-PLAN.md
---
phase: 09-installed-only-command-awareness
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - shell/zsh/queque.zsh
  - src/client/tool-handoff.ts
  - src/shared/command-words.ts
  - src/shared/tool-awareness.ts
  - src/client/run-foreground.ts
  - src/ui/CandidateSelect.tsx
  - src/ui/modal-layout.ts
  - tests/client-result.test.ts
  - tests/candidate-select.test.tsx
  - tests/zsh-widget.test.ts
  - tests/tool-handoff.test.ts
  - tests/tool-awareness.test.ts
  - tests/modal-layout.test.ts
autonomous: true
requirements:
  - SC-1
  - SC-2
  - SC-3
  - SC-4

estimate:
  tokens: 90000
  raw_tokens: 90000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "SC-1 / D-01: after `_qq_write_tool_handoff <dir>` runs, an executable created in a PATH dir after zsh primed its hash table is listed in <dir>/commands.txt (rehash runs on every call), and <dir>/builtins.txt contains `cd`"
    - "D-01 (amended 2026-10-08): <dir>/functions.txt lists zsh function names except names starting with `_`, plus alias names; a candidate whose command word is one of them (e.g. a function-only `nvm`) is never flagged; these names stay in the foreground client"
    - "D-01: the handoff is names only, written by single `print -rl --` expansions with no zsh loop and no zsh sort; there is no Node PATH scan and no daemon-side index"
    - "D-19 / SC-2: the handoff always rehashes (no mtime-gated rehash, no background subshell); the `handoff timing` vitest case prints the median of 5 runs and asserts it is under 25 ms"
    - "The `??` widget calls `_qq_write_tool_handoff \"$tmpdir\"` after request.json is written and before both the Zellij and the inline client launches"
    - "SC-3 / D-08: a candidate with an external command word that is not installed shows a cyan ⊘ mark after its last command line (distinct glyph and colour from the yellow ⚠); when it is selected a footer reads `⊘ not installed: <tool, tool>`; a destructive and flagged candidate shows both marks and both footers"
    - "SC-3: a flagged candidate stays selectable and insertion-only — Enter inserts exactly its command text through the unchanged replace-buffer result; nothing executes"
    - "D-13: annotated candidates keep the model's order; no candidate is re-sorted or dropped"
    - "D-02 / SC-4: builtins (read from builtins.txt, never a hardcoded list), reserved words, `<placeholders>`, `$VAR` commands and path commands (`./x.sh`) are never flagged"
    - "D-03: command words come from a TypeScript port of the spike 002 hand lexer in src/shared/command-words.ts; every closer scan clamps an indexOf of -1 to the input length; recursion depth is capped; extractCommandWords returns [] instead of throwing and skips inputs over 8192 chars"
    - "Fallback (Claude's Discretion): missing or unreadable handoff files, an empty commands.txt, or QQ_TOOL_AWARENESS=0 give a null inventory — no flags, no error, the `??` request proceeds, and the debug log records only a reason or counts"
    - "D-04 privacy posture: the full installed set never leaves the foreground client — it is not added to any IPC message and debug logs carry counts only, never tool names"
    - "The handoff is read eagerly right after request.json parses, before candidates arrive (Zellij pane timing)"
    - "estimateCandidateSelectLines adds 2 rows when the selected candidate is flagged, and MODAL_VIEWPORT_LINES is 20 so destructive plus flag footers fit the inline render"
    - "pnpm exec vitest run tests/client-result.test.ts tests/candidate-select.test.tsx tests/zsh-widget.test.ts tests/tool-handoff.test.ts tests/tool-awareness.test.ts tests/modal-layout.test.ts exits 0 and pnpm typecheck exits 0"
  prohibitions:
    - statement: "MUST NOT drop or re-sort a flagged candidate (SC-3, D-13)"
      category: safety
      status: resolved
      verification: test
    - statement: "MUST NOT discover installed tools from Node (no PATH walk, no which per word, no fs.watch index) — zsh's rehashed tables are the only source (D-01)"
      category: correctness
      status: resolved
      verification: test
    - statement: "MUST NOT add a third-party shell parser dependency for command-word extraction (D-03)"
      category: correctness
      status: resolved
      verification: test
  artifacts:
    - path: "shell/zsh/queque.zsh"
      provides: "_qq_write_tool_handoff helper and its call inside qq-question-widget"
      contains: "_qq_write_tool_handoff"
    - path: "src/client/tool-handoff.ts"
      provides: "reads commands.txt, builtins.txt, functions.txt from the session dir into a ToolInventory or null"
      exports: ["readToolHandoff", "TOOL_HANDOFF_FILES"]
      contains: "QQ_TOOL_AWARENESS"
    - path: "src/shared/command-words.ts"
      provides: "zero-import, erasable-syntax hand lexer port"
      exports: ["lexHand", "commandWords", "extractCommandWords", "MAX_COMMAND_LENGTH", "MAX_RECURSION_DEPTH", "CommandWord", "CommandWordKind", "ShellToken"]
    - path: "src/shared/tool-awareness.ts"
      provides: "inventory type, installed predicate, missing-tool check, candidate annotation"
      exports: ["ToolInventory", "DisplayCandidate", "isInstalled", "missingTools", "annotateCandidates"]
    - path: "src/ui/CandidateSelect.tsx"
      provides: "flag mark and not-installed footer"
      contains: "MISSING_TOOL_MARK"
    - path: "tests/tool-handoff.test.ts"
      provides: "reader fallback and counts-only logging coverage"
    - path: "tests/tool-awareness.test.ts"
      provides: "missingTools / annotateCandidates unit coverage"
  key_links:
    - from: "shell/zsh/queque.zsh"
      to: "src/client/tool-handoff.ts"
      via: "fixed sibling filenames commands.txt / builtins.txt / functions.txt next to request.json"
      pattern: "commands\\.txt"
    - from: "src/client/run-foreground.ts"
      to: "src/client/tool-handoff.ts"
      via: "readToolHandoff(path.dirname(requestFile)) right after the request parses"
      pattern: "readToolHandoff\\("
    - from: "src/client/run-foreground.ts"
      to: "src/shared/tool-awareness.ts"
      via: "annotateCandidates(candidates, toolInventory) before app.rerender"
      pattern: "annotateCandidates\\("
    - from: "src/shared/tool-awareness.ts"
      to: "src/shared/command-words.ts"
      via: "extractCommandWords(command, inventory.builtins)"
      pattern: "extractCommandWords\\("
    - from: "src/ui/CandidateSelect.tsx"
      to: "src/shared/tool-awareness.ts"
      via: "DisplayCandidate.missingTools drives the mark and footer"
      pattern: "missingTools"
---

<objective>
Ship the tracer for Phase 9: one real `??` path that carries zsh's freshly rehashed installed set into the client and visibly flags a candidate that uses a missing tool. Wire it through every layer the flag path touches — zsh widget, session-dir handoff files, client reader, ported hand lexer, missing-tool check, candidate annotation, and the CandidateSelect mark plus footer — then prove the handoff (freshness, functions/aliases, timing guard) and the flag semantics with real-zsh and unit tests.

Purpose: the headline user outcome of the phase ("a suggestion using a tool I don't have is visibly flagged, never dropped") works end-to-end after this plan, on the agent's best early-context tokens. Steering (09-03, 09-05), lexer proof (09-02) and the Tab install form (09-04) expand from this proven slice.

Output: `_qq_write_tool_handoff` in the widget, `src/client/tool-handoff.ts`, `src/shared/command-words.ts`, `src/shared/tool-awareness.ts`, client annotation in `run-foreground.ts`, the ⊘ mark and `not installed:` footer, layout estimate, and tests.

Spec note: no SPEC.md exists for this phase. ⚠ spec-less probe fallback skipped: phase has no requirement IDs to probe (visible skip) — no Edge Coverage or Prohibitions sections to lift. ROADMAP success criteria SC-1..SC-6 and CONTEXT decisions are the coverage source.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/09-installed-only-command-awareness/09-CONTEXT.md
@.planning/phases/09-installed-only-command-awareness/09-RESEARCH.md
@.planning/phases/09-installed-only-command-awareness/09-PATTERNS.md
@.planning/phases/09-installed-only-command-awareness/09-VALIDATION.md
@.claude/skills/spike-findings-tui-llm/SKILL.md
@.claude/skills/spike-findings-tui-llm/references/installed-command-handoff.md
@.claude/skills/spike-findings-tui-llm/references/candidate-command-check.md
@.claude/skills/spike-findings-tui-llm/sources/002-candidate-binary-check/extract.mjs
@.wolf/cerebrum.md
@shell/zsh/queque.zsh
@src/client/run-foreground.ts
@src/ui/CandidateSelect.tsx
@src/ui/modal-layout.ts
@src/contracts/candidates.ts
@src/shared/debug-log.ts
@src/shared/privacy-filter.ts

<interfaces>
Verified against HEAD 6579d10 (read the code, not only this block):

- `src/contracts/candidates.ts`: `commandCandidateSchema = z.object({ command: z.string().trim().min(1), explanation: z.string() })`, `CommandCandidate`, `CandidateList`. Do NOT change this contract — flags are a UI-local type.
- `src/client/run-foreground.ts`: request parsed at L97-98 (`fsp.readFile(requestFile, 'utf-8')` then `shellRequestSchema.parse`); `MODAL_VIEWPORT_LINES = 16` at L196; candidates arrive at L280-284 `fetchCandidatesForUi(socketPath, envelope).then((candidates) => { ...; app.rerender(buildCandidateElement(candidates)); })`; `buildCandidateElement` param type is `Parameters<typeof CandidateSelect>[0]['candidates']`.
- `src/ui/CandidateSelect.tsx`: `DESTRUCTIVE_WARNING_MARK = '⚠'` (L21), state order `selectedIndex` then `query` (L86-87), inline mark at L254-256 renders `{\` ${DESTRUCTIVE_WARNING_MARK}\`}` in yellow after the last command line, footer `<Box marginTop={1}><Text color="yellow">{DESTRUCTIVE_WARNING_TEXT}</Text></Box>` at L277-281, row key `${command}::${candidate.explanation}` at L236.
- `src/ui/modal-layout.ts`: `filterCandidates(candidates: CandidateList, query)`; `estimateCandidateSelectLines` adds `lines += 1 // marginTop` and `lines += 1 // warning text` for the destructive footer at L120-123.
- `shell/zsh/queque.zsh`: session dir `tmpdir=$(mktemp -d /tmp/qq-sess.XXXXXX)` + `chmod 700` at L189-190; request.json heredoc ends at L213 (`JSON`); `qq_cmd` build starts at L220; Zellij launch `zellij run --floating` at L254; inline launch `"${qq_cmd[@]}" client --request-file` at L273.
- `tests/client-result.test.ts`: mocks ink (`render` returns `{ unmount, rerender: vi.fn() }`, auto-selects candidates[0]), `node:tty`, `/dev/tty` open, `ensureDaemon`, socket path, and `resolveClaudeDefaultAdapter` → `fetchCandidatesMock`. The daemon socket is absent so `fetchCandidatesForUi` falls back to the mocked adapter. `node:fs` is mocked narrowly (writeFileSync/realpathSync only) — production code reached from run-foreground must read with `node:fs/promises` (cerebrum).
- `tests/candidate-select.test.tsx`: mocks React `useState` by call order (`stateValues[0]` = selectedIndex, `[1]` = query) and makes `useEffect` a no-op; `collectText(tree)` helper inside the destructive describe flattens rendered strings.
- `tests/zsh-widget.test.ts`: `runZsh(script)` = `spawnSync('zsh', ['-f','-c', \`source ${widgetPath}\n${script}\`], { timeout: 5000 })`.
</interfaces>

<assumption_delta_decision>
Detector: `assumption-delta scan 9` returned detected=true, kind `chosen`, term "selectable" (SC-3 "remains selectable" — UI selection, a false positive for configuration). Re-reading the scope found one real generalization: "installed" grows from "a `$commands` entry" to "a name zsh resolves" (commands plus functions plus aliases, D-01 amended).
- Primary noun: installed name = any command word zsh resolves through `$commands`, functions, or aliases.
- Decision: promote — `isInstalled(inventory, name)` in src/shared/tool-awareness.ts is the single predicate; missingTools, the catalog intersection (09-05) and installer choice (09-04) all call it instead of reading `inventory.commands` directly.
- Invariant test (Task 3): a function-only or alias-only name is treated as installed by missingTools.
</assumption_delta_decision>
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Tracer — zsh handoff to flagged candidate in the picker, one path</name>
  <reversibility rating="costly">Fixed sibling filenames (commands.txt, builtins.txt, functions.txt) become a contract between the widget sourced in long-running shells and the qq client; renaming them later needs both sides to change together, mitigated because missing files degrade to "no flags".</reversibility>
  <files>shell/zsh/queque.zsh, src/client/tool-handoff.ts, src/shared/command-words.ts, src/shared/tool-awareness.ts, src/client/run-foreground.ts, src/ui/CandidateSelect.tsx, src/ui/modal-layout.ts, tests/client-result.test.ts, tests/candidate-select.test.tsx</files>
  <read_first>
    - shell/zsh/queque.zsh (whole file; the widget body L172-283 and the top-level helpers)
    - src/client/run-foreground.ts (whole file)
    - src/ui/CandidateSelect.tsx (whole file)
    - src/ui/modal-layout.ts (whole file)
    - .claude/skills/spike-findings-tui-llm/sources/002-candidate-binary-check/extract.mjs (the reference implementation to port)
    - .claude/skills/spike-findings-tui-llm/references/candidate-command-check.md and references/installed-command-handoff.md
    - src/shared/debug-log.ts (appendDebugLog signature) and src/shared/env-file.ts (line-splitting style)
    - tests/client-result.test.ts (mock scaffolding at L1-185 and the llm-mode test at L401-445)
    - tests/candidate-select.test.tsx (useState mock L55-78, collectText helper L486-501)
    - .wolf/cerebrum.md Do-Not-Repeat (indexOf clamp, node:fs mock narrowness, TDD stubs, test runner command)
  </read_first>
  <action>
Wire one path end-to-end. Every piece is production code; the install form (09-04), steering (09-03/09-05) and the full case/fuzz proof (09-02) build on it without changing these interfaces.

1. shell/zsh/queque.zsh (per D-01 as amended, D-19). Add a top-level function `_qq_write_tool_handoff` (defined at file top level next to `_qq_cleanup`, so tests can call it directly) taking the session dir as `$1`. Body, in order: `zmodload zsh/parameter 2>/dev/null`; `rehash` (unconditionally, every call — D-19: no mtime fingerprint, no background job); then three single `print -rl --` expansions redirected into `"$dir/commands.txt"` (the keys of `commands`), `"$dir/builtins.txt"` (the keys of `builtins`), and `"$dir/functions.txt"` (the keys of `functions` filtered with the `:#_*` exclusion, followed by the keys of `aliases`). Names only — never paths, never a per-entry loop, never an ordering modifier on the key expansion (sorting happens in Node if anything needs it). Add a two-line comment above the helper citing spike 001 and D-19 without spelling out the forbidden zsh syntax. Inside `qq-question-widget`, call `_qq_write_tool_handoff "$tmpdir"` on the line right after the request.json heredoc terminator and before the `local -a qq_cmd` block, so both the Zellij branch and the inline branch see the files. Log `_qq_log "tool handoff written"` after it. Do not change the request.json shape or its `"version": 1`.

2. src/client/tool-handoff.ts (new). Export `TOOL_HANDOFF_FILES = { commands: 'commands.txt', builtins: 'builtins.txt', functions: 'functions.txt' } as const` and `async function readToolHandoff(sessionDir: string): Promise<ToolInventory | null>`. Behaviour: if `process.env.QQ_TOOL_AWARENESS === '0'` return null and debug-log reason `disabled` without reading. Otherwise read all three files in parallel with `readFile` from `node:fs/promises` (never the sync `node:fs` API — client-result.test.ts mocks it narrowly) joined to `sessionDir` with `node:path`; split each on `/\r?\n/`, drop empty strings, build `Set<string>`s. Any read failure → null with `appendDebugLog('client', 'tool handoff unavailable', { reason })` where reason is the error `code` (e.g. `ENOENT`) or `unreadable`; an empty commands set → null with reason `empty`. Success → `appendDebugLog('client', 'tool handoff read', { commands: n, builtins: n, functions: n })` — counts only, never names (D-04 posture). Never throw. Paths are only the fixed names inside the session dir; nothing is taken from request JSON.

3. src/shared/command-words.ts (new, per D-03). A line-for-line TypeScript port of extract.mjs `lexHand` and `commandWords` with all of its tables (`OP_CHARS`, the redirection, assignment and angle-bracket-slot regexes, `RES_EXPECT`, `RES_LOOP`, `SHELLS`, `WRAPPERS`, `NEEDS_POSITIONAL`) and the `lead` assignment detection. Leave out `fromShellQuote`. Constraints: zero import statements and erasable-only TypeScript (no `enum`, no `namespace`, no constructor parameter properties) so a Node 24 `.mjs` child can import the `.ts` file directly in 09-02. Hardening on top of the spike: (a) audit every `indexOf` used as a cursor and clamp a -1 result to `s.length` (scanBalanced single-quote branch, word-level `'` and backtick branches, the backtick-inside-double-quotes branch, the `#` comment branch); (b) make `WRAPPERS` a `Map<string, ReadonlySet<string>>` and `NEEDS_POSITIONAL` a `Map<string, number>` and test membership with `.has()` — the spike's plain-object lookups treat words such as `constructor` or `toString` as wrappers and then throw; (c) `commandWords(tokens, builtins, depth = 0)` recurses into substitution bodies and `sh -c` strings by calling itself on `lexHand(text)` with `depth + 1`, and stops recursing when depth exceeds `MAX_RECURSION_DEPTH = 32`; (d) export `MAX_COMMAND_LENGTH = 8192` and `extractCommandWords(command: string, builtins: ReadonlySet<string>): CommandWord[]` which returns [] for inputs longer than the cap and wraps lex plus classify in try/catch returning [] on any throw. Export types `CommandWordKind` (the five kind strings verbatim from extract.mjs), `CommandWord { word: string; kind: CommandWordKind }`, and `ShellToken` (the token shape: `t` of word/op/redir, `v`, optional `subs`, `quoted`, `dynamic`, the angle-bracket flag, `lead`). Export `lexHand(s: string): ShellToken[]` and `commandWords`. Builtins come only from the `builtins` argument (D-02) — no builtin list in this file.

4. src/shared/tool-awareness.ts (new). Export `interface ToolInventory { readonly commands: ReadonlySet<string>; readonly builtins: ReadonlySet<string>; readonly functions: ReadonlySet<string> }` (doc: `functions` holds zsh function and alias names from functions.txt, D-01 amended); `type DisplayCandidate = CommandCandidate & { readonly missingTools?: readonly string[] }` (type-only import of `CommandCandidate` from ../contracts/candidates.js); `isInstalled(inventory, name): boolean` = commands or functions contains the name (the single installed predicate, see assumption_delta_decision); `missingTools(command, inventory): string[]` = external words from `extractCommandWords(command, inventory.builtins)` that are not `isInstalled`, deduplicated in first-seen order; `annotateCandidates(candidates: readonly CommandCandidate[], inventory: ToolInventory | null): DisplayCandidate[]` — null inventory returns shallow copies with no flag fields; otherwise maps in the given order (D-13), attaching `missingTools` only when non-empty, and passes a candidate through unflagged if anything throws. No sorting, no filtering (SC-3).

5. src/client/run-foreground.ts. Import `node:path`, `readToolHandoff`, `annotateCandidates`. Right after the `request parsed` debug log, when `resultMode === 'llm'`, `const toolInventory = await readToolHandoff(path.dirname(requestFile))` (eager read — Zellij Pitfall 7); other modes use null. In the `fetchCandidatesForUi(...).then` callback compute `const displayCandidates = annotateCandidates(candidates, toolInventory)`, extend the existing `candidates received` debug log with `flagged: <count of candidates with missingTools>`, and rerender with `displayCandidates`. Change `MODAL_VIEWPORT_LINES` to 20 and update its comment (header + filter + up to 3 candidates x 3 rows + destructive footer 2 + flag footer 2 + controls + buffer). Do not send the inventory anywhere else.

6. src/ui/modal-layout.ts. Make `filterCandidates` generic: `<T extends CommandCandidate>(candidates: readonly T[], query: string): readonly T[]` so flag fields survive filtering. Type `CandidateSelectLayoutInput.candidates` as `readonly DisplayCandidate[] | null`. After the destructive-footer block, when the selected visible candidate has a non-empty `missingTools`, add `lines += 1; // marginTop` and `lines += 1; // not-installed footer`.

7. src/ui/CandidateSelect.tsx (D-08). Type `Props.candidates` as `readonly DisplayCandidate[] | null`. Add constant `MISSING_TOOL_MARK = '⊘'` with a doc comment (distinct glyph from the yellow ⚠; rendered cyan; Claude's Discretion per CONTEXT) and a helper `missingToolsFooterText(missing: readonly string[])` returning `` `${MISSING_TOOL_MARK} not installed: ${missing.join(', ')}` ``. In the row renderer, right after the destructive mark element, render `<Text color="cyan">` containing a space followed by `MISSING_TOOL_MARK` when `isLastCommandLine` and the candidate's `missingTools` is non-empty (same literal-leading-space pattern as the destructive mark so existing snapshot regexes keep working). In the footer area, after the destructive footer Box, render `<Box marginTop={1}><Text color="cyan">{missingToolsFooterText(...)}</Text></Box>` when the selected visible candidate is flagged. Spacing only through Ink props (`marginTop`), never computed padding (user rule). Do not add new useState calls in this task. Enter behaviour is unchanged.

8. Tests (the tracer's end-to-end proof). In tests/client-result.test.ts add `describe('runForegroundClient: installed-tool awareness', ...)` with its own tmpDir/requestFile/resultFile setup copied from the `runForegroundClient` describe. Write the handoff with REAL zsh (no stubbed files): one `spawnSync('zsh', ['-f', '-c', ...])` script that sources the widget, creates `$tmpDir/bin`, writes an executable `qqpresenttool` there (shebang line plus chmod +x, done inside zsh), sets `path=($tmpDir/bin /usr/bin /bin)`, defines a function `qqfntool`, and runs `_qq_write_tool_handoff <tmpDir>`; assert status 0. Case A (tracer): `fetchCandidatesMock` resolves `[{ command: 'qqpresenttool --list | qqabsenttool', explanation: 'demo' }, { command: 'qqfntool && cd /tmp', explanation: 'fn' }]`; run `runForegroundClient({ resultMode: 'llm' })`; read the rerendered element from `vi.mocked(render).mock.results` (ink mock) and assert `props.candidates` keeps order, candidate 0 has `missingTools` equal to `['qqabsenttool']`, candidate 1 has no `missingTools`; assert the result file is `{ kind: 'replace-buffer', lbuffer: 'qqpresenttool --list | qqabsenttool', ... }` (flagged, still inserted verbatim). Case B: no handoff files in tmpDir → rerendered candidates carry no `missingTools`. Case C: files present but `process.env.QQ_TOOL_AWARENESS = '0'` → no flags (restore the env in finally). In tests/candidate-select.test.tsx add one case in a new `describe('CandidateSelect — missing-tool flag', ...)` (copy `collectText`): a single candidate `{ command: 'fd -e ts', explanation: 'find ts files', missingTools: ['fd'] }` renders text matching `/fd -e ts\n ⊘/` and contains `⊘ not installed: fd`.

Commit per task with a conventional-commit subject that starts with a lowercase word (commitlint), no Co-Authored-By trailer (user memory). Run `pnpm exec biome check --write` on changed files before staging; stage `.wolf/` updates (anatomy.md for the three new src files, memory.md line) with the code.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/client-result.test.ts tests/candidate-select.test.tsx</automated>
    <fails_when>non-zero exit, or the vitest summary reports "No test files found" or 0 passed tests, or the "installed-tool awareness" cases are reported as skipped</fails_when>
    <automated>pnpm typecheck</automated>
    <fails_when>non-zero exit, or any "error TS" line in the output</fails_when>
  </verify>
  <acceptance_criteria>
    - `grep -n '_qq_write_tool_handoff "\$tmpdir"' shell/zsh/queque.zsh` shows the call on a line number greater than the request.json heredoc terminator line and smaller than the line containing `zellij run --floating` (read the numbers from `grep -n`)
    - `grep -c 'functions.txt' shell/zsh/queque.zsh` >= 1 and `grep -c 'rehash' shell/zsh/queque.zsh` >= 1
    - `grep -cE "^import |require\(" src/shared/command-words.ts` == 0
    - `grep -c 'export function extractCommandWords' src/shared/command-words.ts` >= 1 and `grep -n 'MAX_RECURSION_DEPTH' src/shared/command-words.ts` shows the constant declared with the value 32 and used in the recursion guard
    - `grep -c "node:fs/promises" src/client/tool-handoff.ts` >= 1
    - `grep -c "from 'node:fs'" src/client/tool-handoff.ts` == 0
    - `grep -c 'annotateCandidates(' src/client/run-foreground.ts` >= 1 and `grep -n 'MODAL_VIEWPORT_LINES' src/client/run-foreground.ts` shows the constant declared with the value 20
    - `grep -c "MISSING_TOOL_MARK = '⊘'" src/ui/CandidateSelect.tsx` >= 1
    - client-result case A passes: rerendered candidate 0 `missingTools` equals `['qqabsenttool']`, candidate 1 has none, and the result file lbuffer is `qqpresenttool --list | qqabsenttool`
    - client-result cases B and C pass: no `missingTools` on any rerendered candidate
    - `pnpm exec vitest run tests/client-result.test.ts tests/candidate-select.test.tsx` exits 0
  </acceptance_criteria>
  <done>A real zsh-written handoff in the session dir reaches the client, a candidate using a missing tool arrives in CandidateSelect with `missingTools` in the model's order, renders the cyan ⊘ mark and `⊘ not installed:` footer, and is still inserted verbatim on Enter; missing files or QQ_TOOL_AWARENESS=0 silently disable flagging.</done>
</task>

<task type="auto">
  <name>Task 2: Prove the handoff — freshness, functions/aliases, placement, timing guard, reader fallbacks</name>
  <files>tests/zsh-widget.test.ts, tests/tool-handoff.test.ts, shell/zsh/queque.zsh, src/client/tool-handoff.ts</files>
  <read_first>
    - tests/zsh-widget.test.ts (harness L19-80 and the static-content describes L517-560)
    - shell/zsh/queque.zsh (the helper and widget call from Task 1)
    - src/client/tool-handoff.ts (from Task 1)
    - tests/env-file.test.ts (temp-dir unit-test style)
    - .claude/skills/spike-findings-tui-llm/references/installed-command-handoff.md ("What to Avoid")
    - .planning/phases/09-installed-only-command-awareness/09-RESEARCH.md ("zsh freshness test" and Pitfall 1)
  </read_first>
  <action>
Add real-zsh and unit coverage; fix shell/zsh/queque.zsh or src/client/tool-handoff.ts only if a test exposes a defect. No stubbed binaries or fake zsh — every zsh case runs the real `_qq_write_tool_handoff` under `zsh -f` with real PATH dirs (user rule: no stubs in smoke tests).

In tests/zsh-widget.test.ts add `describe('tool handoff', ...)` with these `it` cases (all through `runZsh`):
- SC-1 freshness (D-01): create a temp dir with a `bin` subdir, prepend it to `path`, prime the hash table with an arithmetic read of the commands count, then create executable `qqfreshtool` in that bin dir, run `_qq_write_tool_handoff` on the temp dir, and print `found`/`absent` from an exact-line `grep -qx` of `qqfreshtool` in commands.txt and of `cd` in builtins.txt; expect both lines to read `found`. Clean up the dir in the same script.
- D-01 amended: define functions `qqfnsample` and `_qqprivatefn`, define alias `qqalsample=ls`, run the helper, and assert functions.txt contains `qqfnsample` and `qqalsample` and does not contain `_qqprivatefn`.
- Placement: read the widget source; assert the index of `_qq_write_tool_handoff "$tmpdir"` is greater than the index of the request.json heredoc and smaller than both the index of `zellij run --floating` and the index of the inline `client --request-file` launch.
- Shape guard (D-01, D-19): slice the helper body from `_qq_write_tool_handoff() {` to the next line that is exactly `}` and assert with regexes in the test file that the body contains `rehash` and three `print -rl --` lines, and contains no `for`/`while` loop keyword, no zsh ordering subscript flag on the key expansions, no key-value flag, no `zstat`, and no trailing background operator.
Add `describe('handoff timing', ...)` with one case: a single `runZsh` script loads `zsh/datetime`, makes a temp dir, runs the helper 5 times recording `(EPOCHREALTIME - start) * 1000` per run on its own line, then removes the dir. In Node compute the median of the 5 numbers, `console.log` it as `handoff median ms: <n>` (D-19: verification records this against the ~10 ms target), and assert median < 25. Use the inherited PATH (realistic ~2k commands).

Create tests/tool-handoff.test.ts for `readToolHandoff` using real temp dirs written by the test (`mkdtempSync` + `writeFileSync` from `node:fs` — this file does not mock fs): all three files present → Sets with the listed names (CRLF tolerated, blank lines dropped); commands.txt missing → null; functions.txt missing → null; empty commands.txt → null; `QQ_TOOL_AWARENESS=0` → null even with files present (restore env); unreadable dir path → null and no throw. Mock `../src/shared/debug-log.js` with `vi.mock` to capture `appendDebugLog` calls and assert the success log details have exactly numeric `commands`/`builtins`/`functions` counts and that no logged argument contains any tool name from the fixture (counts-only privacy).
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/zsh-widget.test.ts -t "tool handoff"</automated>
    <fails_when>non-zero exit, or the summary shows 0 passed (filter matched nothing), or any "tool handoff" case is skipped</fails_when>
    <automated>pnpm exec vitest run tests/zsh-widget.test.ts -t "handoff timing"</automated>
    <fails_when>non-zero exit, or the line "handoff median ms:" is absent from the output, or 0 passed</fails_when>
    <automated>pnpm exec vitest run tests/tool-handoff.test.ts</automated>
    <fails_when>non-zero exit, or "No test files found", or 0 passed</fails_when>
  </verify>
  <acceptance_criteria>
    - `grep -c "describe('tool handoff'" tests/zsh-widget.test.ts` >= 1 and `grep -c "describe('handoff timing'" tests/zsh-widget.test.ts` >= 1
    - `grep -c 'qqfreshtool' tests/zsh-widget.test.ts` >= 1 and `grep -c '_qqprivatefn' tests/zsh-widget.test.ts` >= 1
    - the `handoff timing` run prints a line matching `handoff median ms: [0-9.]+` and the asserted median is below 25
    - tests/tool-handoff.test.ts contains cases for: all files present, commands.txt missing, functions.txt missing, empty commands.txt, QQ_TOOL_AWARENESS=0, counts-only logging
    - all three verify commands exit 0
  </acceptance_criteria>
  <done>Freshness after an in-session install, function/alias names, call placement before both launches, the no-loop/no-sort/no-mtime/no-background shape, the < 25 ms median guard (median printed), and every reader fallback are covered by passing tests against real zsh.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Flag semantics — missingTools, annotation order, both marks, layout rows</name>
  <files>tests/tool-awareness.test.ts, tests/candidate-select.test.tsx, tests/modal-layout.test.ts, src/shared/tool-awareness.ts, src/ui/CandidateSelect.tsx, src/ui/modal-layout.ts</files>
  <read_first>
    - src/shared/tool-awareness.ts and src/shared/command-words.ts (from Task 1)
    - src/ui/CandidateSelect.tsx and src/ui/modal-layout.ts (from Task 1)
    - tests/candidate-select.test.tsx (destructive describe L482-570 for the assertion style)
    - tests/modal-layout.test.ts (estimate describe)
    - .claude/skills/spike-findings-tui-llm/sources/002-candidate-binary-check/cases.mjs (case shapes)
  </read_first>
  <behavior>
    - missingTools('rg TODO | fzf', inv{commands: rg}) → ['fzf']
    - missingTools('docker ps -q | xargs docker stop', inv{commands: xargs}) → ['docker'] (deduplicated)
    - missingTools('nvm use 20', inv{functions: nvm}) → [] and isInstalled(inv, 'nvm') → true (function-only, D-01 amended); alias-only name → []
    - missingTools('cd /tmp && kill -9 1', inv{builtins: cd, kill}) → [] (D-02 builtins from the inventory)
    - missingTools('<editor> ~/.zshrc'), ('$EDITOR x'), ('./scripts/deploy.sh') → [] (SC-4)
    - missingTools('brew install fd && fd -e ts', inv{commands: brew}) → ['fd'] — no special handling for a model-written install step (D-06)
    - annotateCandidates([a, b, c], inv) returns the same commands in the same order (D-13); null inventory → no missingTools fields
    - CandidateSelect: destructive + flagged candidate shows both ` ⚠` and ` ⊘` after the last command line and, when selected, both footers; unflagged candidate shows no ⊘; Enter on a flagged candidate calls onSelect with the original command
    - estimateCandidateSelectLines is 2 higher when the selected candidate has missingTools
  </behavior>
  <action>
Write tests/tool-awareness.test.ts for the behaviours above, building `ToolInventory` objects directly with `new Set([...])` (unit scope; production builtins still come only from builtins.txt). Include the assumption-delta invariant: a name present only in `functions` (function or alias) is installed for `missingTools`. Add a case proving `annotateCandidates` never throws when a candidate command is 9000 characters long (extractCommandWords cap) and returns it unflagged.

Extend tests/candidate-select.test.tsx `describe('CandidateSelect — missing-tool flag')` with: both marks and both footers for `{ command: 'sudo fd -e ts', explanation: 'x', missingTools: ['fd'] }` (`⚠ review carefully` footer and `⊘ not installed: fd` footer present); no ⊘ on an unflagged candidate; footer only for the selected candidate when a flagged candidate is not selected (two candidates, flagged second → `⊘` mark present, `not installed:` footer absent); Enter on the flagged candidate calls `onSelect('fd -e ts', 'find ts files')`.

Extend tests/modal-layout.test.ts: `estimateCandidateSelectLines` with `candidates: [{ command: 'fd -e ts', explanation: 'x', missingTools: ['fd'] }]` equals the same input without `missingTools` plus 2; `filterCandidates` keeps the `missingTools` field on matches.

If any behaviour fails, fix src/shared/tool-awareness.ts, src/ui/CandidateSelect.tsx or src/ui/modal-layout.ts minimally to satisfy it without changing exported signatures from Task 1.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/tool-awareness.test.ts tests/candidate-select.test.tsx tests/modal-layout.test.ts</automated>
    <fails_when>non-zero exit, or "No test files found", or 0 passed</fails_when>
    <automated>pnpm typecheck</automated>
    <fails_when>non-zero exit, or any "error TS" line</fails_when>
  </verify>
  <acceptance_criteria>
    - tests/tool-awareness.test.ts contains a case with `nvm` in `functions` asserting `missingTools` returns `[]`, and a case for `brew install fd && fd -e ts` asserting `['fd']`
    - tests/tool-awareness.test.ts asserts annotateCandidates preserves input order for 3 candidates
    - tests/candidate-select.test.tsx asserts both `⚠ review carefully — this command may be destructive` and `⊘ not installed: fd` appear for one destructive flagged selected candidate
    - tests/modal-layout.test.ts asserts the +2 row difference for a flagged selected candidate
    - `pnpm exec vitest run tests/tool-awareness.test.ts tests/candidate-select.test.tsx tests/modal-layout.test.ts` exits 0
  </acceptance_criteria>
  <done>Flag semantics (dedupe, builtins, function/alias names, D-06 install step, order) and the dual-mark UI plus layout rows are locked by passing tests.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| zsh widget → session dir files | The widget writes names into a `mktemp -d` dir (chmod 700) that the client reads |
| model output → lexer | Candidate command strings are untrusted model output parsed by the hand lexer |
| client → debug log | The client writes diagnostics to a user-readable log file |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-09-01 | Denial of Service | src/shared/command-words.ts (lexHand/commandWords) | high | mitigate | Clamp every indexOf -1 to input length, Map-based WRAPPERS lookups, recursion cap MAX_RECURSION_DEPTH=32, input cap MAX_COMMAND_LENGTH=8192, try/catch wrapper extractCommandWords returning []; 09-02 adds the 20k fuzz plus per-input-timeout crafted cases |
| T-09-02 | Information Disclosure | src/client/tool-handoff.ts, run-foreground.ts debug logs | medium | mitigate | Logs carry counts (`commands`, `builtins`, `functions`, `flagged`) and error codes only; tests/tool-handoff.test.ts asserts no tool name is logged; the inventory is never added to IPC |
| T-09-03 | Tampering | handoff files in /tmp | medium | mitigate | Files live inside the existing private `mktemp -d` + `chmod 700` session dir (CR-006); the client derives fixed names from `path.dirname(requestFile)` and never reads a path taken from JSON |
| T-09-04 | Tampering | Flagged candidate inserted into the shell | low | accept | Insertion-only contract unchanged — the flag is display-only and nothing executes; the user reviews before running |
| T-09-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs in this plan (RESEARCH Package Legitimacy Audit: none); any new dependency would need the legitimacy gate and a blocking human checkpoint |
</threat_model>

<verification>
- `pnpm exec vitest run tests/client-result.test.ts tests/candidate-select.test.tsx tests/zsh-widget.test.ts tests/tool-handoff.test.ts tests/tool-awareness.test.ts tests/modal-layout.test.ts` exits 0
- `pnpm typecheck` exits 0 and `pnpm lint` exits 0
- The `handoff timing` output line `handoff median ms: <n>` is copied into the plan SUMMARY (D-19)
</verification>

<success_criteria>
- A tool installed after the shell primed its hash table is in commands.txt on the next handoff (SC-1)
- The handoff median of 5 runs is under 25 ms and printed (SC-2 guard, D-19)
- A candidate using a missing tool shows ⊘ plus `⊘ not installed: <tools>` and still inserts verbatim (SC-3, D-08, D-13)
- Builtins, reserved words, angle-bracket slots, `$VAR` and path commands are never flagged (SC-4, D-02)
- Missing handoff files or QQ_TOOL_AWARENESS=0 never break `??`
</success_criteria>

## Artifacts this phase produces

- `_qq_write_tool_handoff` (zsh function, shell/zsh/queque.zsh) and session files `commands.txt`, `builtins.txt`, `functions.txt`
- `src/client/tool-handoff.ts`: `readToolHandoff(sessionDir)`, `TOOL_HANDOFF_FILES`
- `src/shared/command-words.ts`: `lexHand`, `commandWords`, `extractCommandWords`, `MAX_COMMAND_LENGTH`, `MAX_RECURSION_DEPTH`, types `CommandWord`, `CommandWordKind`, `ShellToken`
- `src/shared/tool-awareness.ts`: `ToolInventory`, `DisplayCandidate`, `isInstalled`, `missingTools`, `annotateCandidates`
- `src/ui/CandidateSelect.tsx`: `MISSING_TOOL_MARK`, `missingToolsFooterText`; `Props.candidates` widened to `readonly DisplayCandidate[] | null`
- `src/ui/modal-layout.ts`: generic `filterCandidates<T extends CommandCandidate>`, flag-footer rows in `estimateCandidateSelectLines`
- `src/client/run-foreground.ts`: `MODAL_VIEWPORT_LINES = 20`
- Env switch `QQ_TOOL_AWARENESS=0` (kill switch, env only)
- New test files: `tests/tool-handoff.test.ts`, `tests/tool-awareness.test.ts`; new describes in `tests/client-result.test.ts`, `tests/candidate-select.test.tsx`, `tests/zsh-widget.test.ts`, `tests/modal-layout.test.ts`

## Project rules for executors

- OpenWolf: check `.wolf/anatomy.md` before reading files and `.wolf/cerebrum.md` Do-Not-Repeat before writing code; after edits update `.wolf/anatomy.md` and append to `.wolf/memory.md`; log any failed test or fix to `.wolf/buglog.json`; stage `.wolf/` with the code.
- Targeted runs use `pnpm exec vitest run <files>` (never `pnpm test:run -- …`).
- Lint changed files with biome before staging. Commit subjects start with a lowercase word; no Co-Authored-By trailer.
- Presentational spacing goes in Ink props (`marginTop`), not computed in logic.

<output>
Create `.planning/phases/09-installed-only-command-awareness/09-01-SUMMARY.md` when done (include the printed handoff median).
</output>

#### .planning/phases/09-installed-only-command-awareness/09-02-PLAN.md
---
phase: 09-installed-only-command-awareness
plan: 02
type: execute
wave: 2
depends_on:
  - 09-01
files_modified:
  - tests/fixtures/command-words-cases.ts
  - tests/command-words.test.ts
  - tests/fixtures/command-words-fuzz-child.mjs
  - tests/command-words-fuzz.test.ts
  - src/shared/command-words.ts
autonomous: true
requirements:
  - SC-4
  - SC-5

estimate:
  tokens: 50000
  raw_tokens: 50000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "SC-4 / D-02: all 40 spike-002 cases (37 core, 3 stretch) pass against src/shared/command-words.ts with builtins taken from a real `zsh -f` `${(k)builtins}` listing, and builtins, reserved words, `<placeholders>`, `$VAR` commands and path commands are never classified `external`"
    - "D-03: the hand lexer survives 20,000 seeded random inputs over the spike alphabet in a child process with a hard 15 s kill, with no throw from the raw lexHand/commandWords functions and no single input exceeding the 250 ms soft budget"
    - "D-03 / SC-5: every crafted malformed input from spike 002 find-hang.mjs (including the minimal repro of the backtick-inside-double-quotes hang) finishes in its own child process within a hard 1 s timeout"
    - "D-03: 2,000 nested command substitutions finish in under 100 ms, and extractCommandWords never throws (oversized input, prototype-key words such as `constructor` and `toString`, unterminated quotes)"
    - "D-03: the lexer has no third-party parser dependency; the fuzz child imports the real src/shared/command-words.ts through Node's native type stripping, so the tested code is the shipped code"
    - "D-06: `brew install fd && fd -e ts` yields external words brew and fd with no special-case label"
    - "pnpm exec vitest run tests/command-words.test.ts tests/command-words-fuzz.test.ts exits 0"
  artifacts:
    - path: "tests/fixtures/command-words-cases.ts"
      provides: "the 40 spike-002 cases as a typed table"
      exports: ["COMMAND_WORD_CASES", "CommandWordCase"]
    - path: "tests/fixtures/command-words-fuzz-child.mjs"
      provides: "child harness with modes fuzz, one, deep"
      contains: "src/shared/command-words.ts"
    - path: "tests/command-words.test.ts"
      provides: "table plus kind-classification coverage"
    - path: "tests/command-words-fuzz.test.ts"
      provides: "child-process fuzz with hard timeouts"
      contains: "spawnSync"
  key_links:
    - from: "tests/fixtures/command-words-fuzz-child.mjs"
      to: "src/shared/command-words.ts"
      via: "direct .ts import under Node 24 type stripping"
      pattern: "command-words\\.ts"
    - from: "tests/command-words-fuzz.test.ts"
      to: "tests/fixtures/command-words-fuzz-child.mjs"
      via: "spawnSync(process.execPath, [child, mode, ...], { timeout })"
      pattern: "spawnSync\\("
---

<objective>
Prove the lexer that the 09-01 tracer ships: port the spike's 40 accuracy cases into a vitest table and keep the fuzz harness (random, crafted malformed, deep nesting) in the suite with hard per-input timeouts, because the indexOf hang is exactly what regresses silently. Fix src/shared/command-words.ts only where a case or fuzz input exposes a defect, without changing its exported API (09-04 imports `lexHand` in parallel).

Purpose: SC-4 and SC-5 become regression-guarded facts instead of spike claims; malformed model output can never freeze the `??` picker.

Output: tests/fixtures/command-words-cases.ts, tests/command-words.test.ts, tests/fixtures/command-words-fuzz-child.mjs, tests/command-words-fuzz.test.ts, plus any lexer fix.

Spec note: no SPEC.md; ⚠ spec-less probe fallback skipped: phase has no requirement IDs to probe (visible skip).
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-installed-only-command-awareness/09-CONTEXT.md
@.planning/phases/09-installed-only-command-awareness/09-RESEARCH.md
@.planning/phases/09-installed-only-command-awareness/09-01-SUMMARY.md
@.claude/skills/spike-findings-tui-llm/references/candidate-command-check.md
@.claude/skills/spike-findings-tui-llm/sources/002-candidate-binary-check/cases.mjs
@.claude/skills/spike-findings-tui-llm/sources/002-candidate-binary-check/fuzz-child.mjs
@.claude/skills/spike-findings-tui-llm/sources/002-candidate-binary-check/find-hang.mjs
@.claude/skills/spike-findings-tui-llm/sources/002-candidate-binary-check/run.mjs
@src/shared/command-words.ts
@tests/zsh-widget.test.ts
@.wolf/cerebrum.md

<interfaces>
From 09-01 (src/shared/command-words.ts — read the file; this is the contract to test, not to change):
- `lexHand(s: string): ShellToken[]`
- `commandWords(tokens: readonly ShellToken[], builtins: ReadonlySet<string>, depth?: number): CommandWord[]`
- `extractCommandWords(command: string, builtins: ReadonlySet<string>): CommandWord[]` — try/catch wrapper, returns [] over `MAX_COMMAND_LENGTH` (8192)
- `CommandWord { word: string; kind: CommandWordKind }`, kinds verbatim from extract.mjs
- The file has zero imports and erasable-only syntax so a `.mjs` child can `import` it with a `.ts` specifier on Node v24 (verified in RESEARCH). tsconfig `include` covers only `.ts`/`.tsx`, so tsc never sees the `.mjs` child; only that child may use a `.ts` specifier.
- Spike runner semantics (run.mjs): expected list = `external` words in order; builtins come from `zsh -c 'zmodload zsh/parameter; print -rl -- ${(k)builtins}'`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Port the 40 accuracy cases and kind classification into vitest</name>
  <files>tests/fixtures/command-words-cases.ts, tests/command-words.test.ts, src/shared/command-words.ts</files>
  <read_first>
    - .claude/skills/spike-findings-tui-llm/sources/002-candidate-binary-check/cases.mjs (copy every case verbatim, including comments)
    - .claude/skills/spike-findings-tui-llm/sources/002-candidate-binary-check/run.mjs (how expectations are compared)
    - src/shared/command-words.ts (from 09-01)
    - tests/privacy-filter.test.ts (table-test style)
  </read_first>
  <action>
Create tests/fixtures/command-words-cases.ts exporting `interface CommandWordCase { cmd: string; expect: readonly string[]; tier: 'core' | 'stretch' }` and `COMMAND_WORD_CASES: readonly CommandWordCase[]` containing all 40 entries from cases.mjs verbatim (same strings, same order, same tier, keep the inline comments such as "kill is a builtin in zsh"). Add a short header comment naming the spike source.

Create tests/command-words.test.ts. In `beforeAll`, obtain builtins from real zsh with `spawnSync('zsh', ['-f', '-c', 'zmodload zsh/parameter; print -rl -- ${(k)builtins}'], { encoding: 'utf8' })`, split into a Set, and assert it contains `cd` and `kill` (D-02: builtins come from zsh, never a hardcoded list — the test uses the same source). Then:
- `it.each(COMMAND_WORD_CASES)` named with the command text: the `external` words from `extractCommandWords(cmd, builtins)` equal `expect` exactly, in order (SC-4). Assert the case count is 40 (37 core + 3 stretch) in a separate `it`.
- Kind checks: `<editor> ~/.zshrc` yields one word whose kind is the angle-bracket kind; `$EDITOR ~/.zshrc` yields kind `dynamic`; `./scripts/deploy.sh --prod` yields kind `path`; `kill -9 $(lsof -ti :3000)` classifies `kill` as `builtin` and `lsof` as `external`; `time npm test` and `if [ -f .env ]; then cat .env; fi` produce no `external` entry for the reserved words; `command -v jq || brew install jq` yields only `brew` as external.
- D-06: `brew install fd && fd -e ts` externals equal `['brew', 'fd']`.
- Robustness: `extractCommandWords('x'.repeat(8193), builtins)` returns `[]`; words `constructor`, `toString`, `__proto__`, `hasOwnProperty` each classify as `external` without throwing (the Map-based WRAPPERS from 09-01).
If any case fails, fix src/shared/command-words.ts to match extract.mjs behaviour (the spike scored 40/40) while keeping exports, the zero-import rule and erasable-only syntax intact.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/command-words.test.ts</automated>
    <fails_when>non-zero exit, or "No test files found", or fewer than 40 table cases reported as passed</fails_when>
    <automated>pnpm typecheck</automated>
    <fails_when>non-zero exit, or any "error TS" line</fails_when>
  </verify>
  <acceptance_criteria>
    - tests/fixtures/command-words-cases.ts contains the strings `sudo -E env PATH=$PATH ncdu /` and `find . -name "*.tmp" -exec rm {} \\;` (first and last style entries copied verbatim)
    - tests/command-words.test.ts obtains builtins through `spawnSync('zsh'` and asserts the table length is 40
    - the vitest run shows every `it.each` case passing (40 table rows) plus the kind, D-06 and robustness cases
    - `grep -cE "^import |require\(" src/shared/command-words.ts` == 0 after any fix
  </acceptance_criteria>
  <done>All 40 spike cases and the builtin / reserved / angle-bracket / dynamic / path classifications pass against the shipped lexer with zsh-sourced builtins.</done>
</task>

<task type="auto">
  <name>Task 2: Child-process fuzz with hard timeouts (random, crafted malformed, deep nesting)</name>
  <files>tests/fixtures/command-words-fuzz-child.mjs, tests/command-words-fuzz.test.ts, src/shared/command-words.ts</files>
  <read_first>
    - .claude/skills/spike-findings-tui-llm/sources/002-candidate-binary-check/fuzz-child.mjs
    - .claude/skills/spike-findings-tui-llm/sources/002-candidate-binary-check/find-hang.mjs (the crafted input list — copy verbatim)
    - tests/zsh-widget.test.ts (spawnSync harness style)
    - src/shared/command-words.ts
    - .planning/phases/09-installed-only-command-awareness/09-RESEARCH.md (Pattern 3)
  </read_first>
  <action>
Create tests/fixtures/command-words-fuzz-child.mjs (plain ESM JavaScript, biome-clean). It imports `commandWords`, `extractCommandWords`, `lexHand` from `'../../src/shared/command-words.ts'` (the real shipped source via Node 24 type stripping — do not copy the lexer) and dispatches on `process.argv[2]`:
- `fuzz <count> [seed]`: a seeded PRNG (mulberry32, default seed 1, printed at start) generates `count` strings of length 1-40 over the spike alphabet (letters a b, space, `$ ( ) \` ' " | & ; < > { } [ ] \ # =`, newline, tab, `-` — copy the alphabet string from fuzz-child.mjs). Before each input write its JSON to stderr with `writeSync(2, …)` so a kill leaves the culprit as the last stderr line. Call the RAW `commandWords(lexHand(s), new Set())` (so a throw surfaces as a non-zero exit instead of being swallowed by the wrapper), then `extractCommandWords(s, new Set())`. Measure each input with `performance.now()`; if one exceeds 250 ms print `slow <json> <ms>` and exit 2. On completion print `fuzz ok <count> seed <seed>` and exit 0.
- `one <input>`: run the same two calls on argv[3]; print `one ok`.
- `deep <n>`: time `commandWords(lexHand('$('.repeat(n)), new Set())`; print `deep <n> <ms> ms`.

Create tests/command-words-fuzz.test.ts using `spawnSync(process.execPath, [childPath, ...], { encoding: 'utf8', timeout })` with `childPath` from `fileURLToPath(new URL('./fixtures/command-words-fuzz-child.mjs', import.meta.url))`:
- `20k random inputs finish without hang or throw`: args `fuzz 20000 1`, timeout 15_000; assert `r.error` is undefined (an ETIMEDOUT there is a hang — include the last stderr line in the failure message), `r.status` is 0, stdout contains `fuzz ok 20000`. Give the vitest case its own timeout of 20_000.
- A second seed run (`fuzz 5000 7`) with the same assertions so the corpus is not a single fixed sample.
- `it.each(CRAFTED_MALFORMED)` where `CRAFTED_MALFORMED` is the find-hang.mjs input array copied verbatim plus the minimal repro string `"a" "` followed by one backtick: each runs `one <input>` with a hard 1_000 ms timeout; assert no error, status 0, stdout contains `one ok` (D-03 hard per-input timeout).
- `deep nesting stays fast`: `deep 2000` with timeout 5_000; parse the ms from stdout and assert < 100.
If any run hangs, throws or is slow, fix src/shared/command-words.ts (typically an unclamped closer scan or missing depth guard), keeping exports, zero imports and erasable-only syntax.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/command-words-fuzz.test.ts</automated>
    <fails_when>non-zero exit, or "No test files found", or an ETIMEDOUT error in any case, or 0 passed</fails_when>
    <automated>pnpm exec vitest run tests/command-words.test.ts tests/command-words-fuzz.test.ts</automated>
    <fails_when>non-zero exit, or any failed or skipped case in the summary</fails_when>
  </verify>
  <acceptance_criteria>
    - `grep -c "command-words.ts" tests/fixtures/command-words-fuzz-child.mjs` >= 1 (imports the shipped source)
    - `grep -c "writeSync(2" tests/fixtures/command-words-fuzz-child.mjs` >= 1 (culprit diagnostics)
    - tests/command-words-fuzz.test.ts contains a `timeout: 15_000` fuzz run, a `timeout: 1_000` per-input crafted run, and a `deep` run asserting < 100
    - the crafted list in the test includes `echo "unterminated` and `a"b\`c` style entries copied from find-hang.mjs
    - both verify commands exit 0
  </acceptance_criteria>
  <done>The shipped lexer passes 25k seeded random inputs, every crafted malformed input under a hard 1 s per-input timeout, and 2,000-deep nesting under 100 ms, all in child processes so a hang fails the test instead of freezing the runner.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| model output → lexer | Untrusted, possibly truncated candidate text enters the hand lexer in the foreground client |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-09-05 | Denial of Service | src/shared/command-words.ts regression (cursor rewind, unbounded recursion) | high | mitigate | Child-process fuzz (25k seeded inputs, 15 s hard kill, 250 ms per-input soft budget), crafted malformed list at a hard 1 s per input, deep-nesting < 100 ms — all run in the default `pnpm test:run` suite so CI blocks a regression |
| T-09-06 | Tampering | prototype-key command words (`constructor`, `__proto__`) | medium | mitigate | Table cases assert they classify as external without throwing (Map-based WRAPPERS from 09-01) |
| T-09-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs; the test child uses Node's built-in type stripping, no loader dependency |
</threat_model>

<verification>
- `pnpm exec vitest run tests/command-words.test.ts tests/command-words-fuzz.test.ts` exits 0
- `pnpm typecheck` and `pnpm lint` exit 0 (the `.mjs` child is biome-clean)
</verification>

<success_criteria>
- 40/40 spike cases pass with zsh-sourced builtins (SC-4)
- No hang or throw across random, crafted and deep inputs under hard timeouts (SC-5, D-03)
</success_criteria>

## Artifacts this phase produces

- `tests/fixtures/command-words-cases.ts`: `COMMAND_WORD_CASES`, `CommandWordCase`
- `tests/fixtures/command-words-fuzz-child.mjs`: CLI modes `fuzz <count> [seed]`, `one <input>`, `deep <n>`
- `tests/command-words.test.ts`, `tests/command-words-fuzz.test.ts`
- Possible internal fixes in `src/shared/command-words.ts` (exported API unchanged)

## Project rules for executors

- OpenWolf: anatomy/cerebrum before reading and writing; update `.wolf/anatomy.md` and `.wolf/memory.md`; log any hang/throw found and fixed to `.wolf/buglog.json` (tags: lexer, fuzz); stage `.wolf/` with the code.
- `pnpm exec vitest run <files>` for targeted runs. Biome-check changed files before staging. Lowercase commit subjects, no Co-Authored-By trailer.

<output>
Create `.planning/phases/09-installed-only-command-awareness/09-02-SUMMARY.md` when done.
</output>

#### .planning/phases/09-installed-only-command-awareness/09-03-PLAN.md
---
phase: 09-installed-only-command-awareness
plan: 03
type: execute
wave: 2
depends_on:
  - 09-01
files_modified:
  - src/shared/tool-catalog.ts
  - src/contracts/request.ts
  - src/providers/steering.ts
  - src/providers/claude.ts
  - src/providers/claude-cli.ts
  - tests/steering.test.ts
  - tests/claude-provider.test.ts
  - tests/claude-cli-provider.test.ts
  - docs/EXTENSIONS.md
autonomous: true
requirements:
  - SC-6

estimate:
  tokens: 60000
  raw_tokens: 60000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "D-04 / SC-6: only `curated catalog ∩ installed` can reach the model — the `installed-tools` context chunk schema rejects any name outside CATALOG (zod refine) and any array longer than CATALOG; the catalog is a shipped public tool-name allow list seeded from spike 003 (196 names, no basic POSIX utilities)"
    - "D-15: when an `installed-tools` chunk is present, the system prompt lists the installed catalog tools, states that standard system utilities are also present, and says to prefer installed tools, with a not-installed tool acceptable only when it is clearly better for the task"
    - "D-16: the system prompt requires at least one candidate that uses only installed tools or standard system utilities"
    - "D-17 / D-05: the system prompt says never to include install steps (no brew/apt/dnf/pacman install, no curl-to-shell installers) in any candidate"
    - "D-18: the steering text reaches every provider path that used the shared system prompt — the Anthropic SDK `system` field and the `claude -p --system-prompt` argument both come from buildSystemPrompt(envelope); a static `adapters` guard test fails if any file in src/providers/ hands a system prompt to a model without buildSystemPrompt (so Phase 8's OpenAI/Ollama adapters must use it whichever phase ships second)"
    - "With no `installed-tools` chunk (old widget, missing files, QQ_TOOL_AWARENESS=0) buildSystemPrompt returns the original system prompt byte-for-byte and the user prompt from buildPrompt is unchanged (steering lives in the system prompt only, never the user JSON)"
    - "buildSystemPrompt runs filterContextEnvelope first and re-filters chunk tools to CATALOG members (defence in depth for the in-process fallback path)"
    - "The system-prompt constant lives in src/providers/steering.ts and is re-exported from src/providers/claude.ts, so there is no steering ↔ claude import cycle and existing importers keep compiling"
    - "pnpm exec vitest run tests/steering.test.ts tests/claude-provider.test.ts tests/claude-cli-provider.test.ts exits 0 and pnpm typecheck exits 0"
  prohibitions:
    - statement: "MUST NOT place the full installed list, function/alias names, or any non-catalog name in a prompt (D-04)"
      category: privacy
      status: resolved
      verification: test
    - statement: "MUST NOT steer through sampling parameters (temperature/top_p/top_k) — system prompt only (cerebrum Do-Not-Repeat 2026-07-30)"
      category: correctness
      status: resolved
      verification: test
  artifacts:
    - path: "src/shared/tool-catalog.ts"
      provides: "shipped catalog allow list and intersection helper"
      exports: ["CATALOG", "CATALOG_SET", "installedCatalogTools"]
    - path: "src/contracts/request.ts"
      provides: "installed-tools chunk variant with catalog refine"
      contains: "installed-tools"
    - path: "src/providers/steering.ts"
      provides: "system prompt constant, steering text, provider-neutral system prompt builder"
      exports: ["QUEQUE_SYSTEM", "buildSteeringText", "buildSystemPrompt"]
    - path: "tests/steering.test.ts"
      provides: "catalog, chunk schema, steering wording, byte-stability, adapters guard"
  key_links:
    - from: "src/providers/claude.ts"
      to: "src/providers/steering.ts"
      via: "system: buildSystemPrompt(envelope) in messages.create"
      pattern: "system: buildSystemPrompt\\(envelope\\)"
    - from: "src/providers/claude-cli.ts"
      to: "src/providers/steering.ts"
      via: "'--system-prompt', buildSystemPrompt(envelope)"
      pattern: "buildSystemPrompt\\(envelope\\)"
    - from: "src/contracts/request.ts"
      to: "src/shared/tool-catalog.ts"
      via: "CATALOG_SET refine on the installed-tools payload"
      pattern: "CATALOG_SET"
    - from: "src/providers/steering.ts"
      to: "src/shared/privacy-filter.ts"
      via: "filterContextEnvelope before reading the chunk"
      pattern: "filterContextEnvelope\\("
---

<objective>
Build the steering half of the phase: a shipped catalog allow list, a structurally privacy-guarded `installed-tools` envelope chunk, and a provider-neutral `buildSystemPrompt(envelope)` that appends the D-15/D-16/D-17 steering text, then route both existing Claude paths (SDK and `claude -p`) through it and add a guard so every other adapter must too (D-18).

Purpose: suggestions favour installed tools across every provider, while the prompt can only ever carry public catalog names (D-04). The client starts sending the chunk in 09-05 together with the stale-daemon capability bump; until then nothing on the wire changes.

Output: src/shared/tool-catalog.ts, the chunk variant in src/contracts/request.ts, src/providers/steering.ts, wired src/providers/claude.ts and claude-cli.ts, tests, and an EXTENSIONS.md note.

Spec note: no SPEC.md; ⚠ spec-less probe fallback skipped: phase has no requirement IDs to probe (visible skip). Steering wording is a draft (spike 003 partial, RESEARCH Open Question 3; finishing the spike is a deferred idea) — the client-side flag from 09-01 stays the safety net.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-installed-only-command-awareness/09-CONTEXT.md
@.planning/phases/09-installed-only-command-awareness/09-RESEARCH.md
@.planning/phases/09-installed-only-command-awareness/09-PATTERNS.md
@.claude/skills/spike-findings-tui-llm/references/prompt-steering.md
@.claude/skills/spike-findings-tui-llm/sources/003-prompt-steering/catalog.ts
@.wolf/cerebrum.md
@src/contracts/request.ts
@src/providers/claude.ts
@src/providers/claude-cli.ts
@src/providers/claude-default.ts
@src/shared/privacy-filter.ts
@tests/claude-provider.test.ts
@tests/claude-cli-provider.test.ts
@docs/EXTENSIONS.md

<interfaces>
Verified against HEAD 6579d10:
- src/providers/claude.ts L39-40: `export const QUEQUE_SYSTEM = 'You are QueQue, a terminal shell assistant. Return ONLY a JSON array of command candidates, …'` (one string literal — move it verbatim); L109-136 `buildPrompt(envelope)` reads only `git` and `filesystem` chunks into the user JSON; L170-178 `client.messages.create({ model, max_tokens: 1024, system: QUEQUE_SYSTEM, messages: [{ role: 'user', content: prompt }] }, { timeout })`.
- src/providers/claude-cli.ts L1-8 imports `buildPrompt, ensureSelectableCandidates, parseCandidates` and the system constant from './claude.js'; L22-34 args `[... '--system-prompt', <constant>, prompt]` with the prompt last.
- src/contracts/request.ts L74-94 `contextChunkSchema = z.discriminatedUnion('kind', [git, filesystem])` with the D-05/D-06 privacy-review header comment at L66-73.
- src/shared/privacy-filter.ts `filterContextEnvelope(envelope)` maps chunks and passes non-git chunks through.
- Phase 8 status: src/providers/ contains claude.ts, claude-cli.ts, claude-default.ts, claude-exec.ts, detect.ts, index.ts, provider.ts, resolver.ts. The Ollama/OpenAI adapters (08-03/08-04) are planned but not in src/ yet; their plans pass the system constant as the system message.
- Spike 003 catalog: 196 unique names, all match `/^[A-Za-z0-9][A-Za-z0-9._+-]*$/` (checked at planning time).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Catalog allow list, guarded installed-tools chunk, and the steering builder</name>
  <reversibility rating="costly">The `installed-tools` chunk becomes part of the IPC envelope contract between client and daemon processes; changing its shape later needs the 09-05 capability flag bumped again so stale daemons are replaced.</reversibility>
  <files>src/shared/tool-catalog.ts, src/contracts/request.ts, src/providers/steering.ts, tests/steering.test.ts</files>
  <read_first>
    - .claude/skills/spike-findings-tui-llm/sources/003-prompt-steering/catalog.ts (copy the names verbatim)
    - .claude/skills/spike-findings-tui-llm/references/prompt-steering.md (the "standard system utilities" clause and what to avoid)
    - src/contracts/request.ts (whole file)
    - src/providers/claude.ts (the constant and buildPrompt)
    - src/shared/privacy-filter.ts
    - src/shared/qq-config.ts (shipped-constant list style, L15-28)
  </read_first>
  <behavior>
    - CATALOG has 196 unique entries, each matching /^[A-Za-z0-9][A-Za-z0-9._+-]*$/; it contains rg, fd, fzf, jq, nvm, z and excludes ls, grep, find, sed, awk, du
    - installedCatalogTools((n) => ['rg', 'fd', 'qqprivate'].includes(n)) → ['fd', 'rg'] (catalog members only, sorted in Node)
    - contextChunkSchema accepts { kind: 'installed-tools', payload: { tools: ['fd', 'rg'] } } and rejects tools containing 'qqprivate', and rejects an array longer than CATALOG
    - buildSystemPrompt(envelope without the chunk) === QUEQUE_SYSTEM (byte-for-byte)
    - buildSystemPrompt(envelope with tools ['fd','rg']) starts with QUEQUE_SYSTEM, then a blank line, then text containing 'fd rg', 'standard system utilities are also present', 'Prefer installed tools', 'At least one candidate must use only installed tools', 'Never include install steps'
    - buildSystemPrompt with tools [] still emits the rules plus a no-notable-tools sentence
    - buildSteeringText(['rg', 'qqprivate', 'rg']) mentions rg once and never qqprivate (re-filter + dedupe)
  </behavior>
  <action>
TDD per cerebrum: first create src/shared/tool-catalog.ts and src/providers/steering.ts with the public exports as throw-on-call stubs so tsc passes in pre-commit, write tests/steering.test.ts RED and commit, then implement GREEN.

1. src/shared/tool-catalog.ts (new, zero imports; Claude's Discretion: shipped data in src/, seeded from spike 003). Export `CATALOG: readonly string[]` — the 196 names from the spike catalog.ts, same order, as a frozen array (keep its header comment explaining it is a public allow list of notable CLI tools that have common alternatives and deliberately omits basic POSIX/macOS utilities; use the term "allow list"). Export `CATALOG_SET: ReadonlySet<string>` built from it. Export `installedCatalogTools(isInstalled: (name: string) => boolean): string[]` returning the catalog members for which the predicate is true, sorted with `localeCompare`-free plain `sort()` (sorting happens in Node, never in zsh — D-01).

2. src/contracts/request.ts. Import `CATALOG, CATALOG_SET` from '../shared/tool-catalog.js'. Add a third variant to `contextChunkSchema`: `kind: z.literal('installed-tools')`, `payload: z.object({ tools: z.array(z.string()).max(CATALOG.length).refine((tools) => tools.every((tool) => CATALOG_SET.has(tool)), { message: 'installed-tools may only carry curated catalog names (D-04)' }) })`. Extend the union's header comment in the same privacy-review voice: this variant carries public catalog tool names only; the refine is the structural guard that turns a bug which would push the full installed list into a schema failure instead of a prompt leak.

3. src/providers/steering.ts (new). Move the system-prompt string constant out of claude.ts into this file verbatim as `export const QUEQUE_SYSTEM` (keep its doc comment: shared system prompt for the SDK Messages API and Claude CLI). Export `buildSteeringText(tools: readonly string[]): string` — keep only CATALOG_SET members, dedupe, sort, then return four lines joined by newlines: (a) with tools: `Notable command-line tools installed on this machine (standard system utilities are also present): ` + tools joined by single spaces + `.`; with none: `No notable command-line tools from the QueQue catalog were found on this machine; standard system utilities are present.` (b) `Prefer installed tools. A tool that is not installed is acceptable only when it is clearly better for the task.` (D-15) (c) `At least one candidate must use only installed tools or standard system utilities.` (D-16) (d) `Never include install steps in a candidate: no brew, apt, dnf or pacman install commands and no curl-to-shell installers.` (D-17, D-05). Export `buildSystemPrompt(envelope: ContextEnvelope): string` — run `filterContextEnvelope(envelope)`, find the `installed-tools` chunk; absent → return the constant unchanged; present → constant + two newlines + `buildSteeringText(chunk.payload.tools)`. Imports: type `ContextEnvelope` from '../contracts/request.js', `filterContextEnvelope` from '../shared/privacy-filter.js', `CATALOG_SET` from '../shared/tool-catalog.js' — never import the claude.ts module (that would create a cycle).

4. tests/steering.test.ts: `describe('catalog')`, `describe('installed-tools chunk schema')`, `describe('buildSystemPrompt')` covering every behaviour bullet, using a local `buildEnvelope(extras)` like tests/claude-provider.test.ts.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/steering.test.ts</automated>
    <fails_when>non-zero exit, or "No test files found", or 0 passed</fails_when>
    <automated>pnpm typecheck</automated>
    <fails_when>non-zero exit, or any "error TS" line</fails_when>
  </verify>
  <acceptance_criteria>
    - `grep -c "installed-tools" src/contracts/request.ts` >= 1 and `grep -c "CATALOG_SET" src/contracts/request.ts` >= 1
    - `grep -c "standard system utilities are also present" src/providers/steering.ts` >= 1
    - `grep -c "from './claude.js'" src/providers/steering.ts` == 0 (no import cycle)
    - tests/steering.test.ts asserts `buildSystemPrompt` without the chunk is strictly equal (`toBe`) to the exported system constant
    - tests/steering.test.ts asserts the schema rejects a non-catalog name and accepts a catalog subset
    - `pnpm exec vitest run tests/steering.test.ts` exits 0
  </acceptance_criteria>
  <done>The catalog, the refine-guarded chunk and buildSystemPrompt exist and are proven: catalog-only, sorted, deduped, D-15/16/17 wording present, and byte-identical output when the chunk is absent.</done>
</task>

<task type="auto">
  <name>Task 2: Route the SDK and `claude -p` paths through buildSystemPrompt and guard every adapter</name>
  <files>src/providers/claude.ts, src/providers/claude-cli.ts, tests/claude-provider.test.ts, tests/claude-cli-provider.test.ts, tests/steering.test.ts, docs/EXTENSIONS.md</files>
  <read_first>
    - src/providers/claude.ts, src/providers/claude-cli.ts, src/providers/claude-default.ts
    - src/providers/steering.ts (from Task 1)
    - tests/claude-provider.test.ts (createMock request inspection L68-104)
    - tests/claude-cli-provider.test.ts (spawnArgs helper and the argv test L204-231)
    - docs/EXTENSIONS.md (Provider resolution section)
    - `ls src/providers/` at execution time (check whether Phase 8 08-03/08-04 adapters landed)
  </read_first>
  <action>
1. src/providers/claude.ts: delete the local system-prompt constant definition and add `export { QUEQUE_SYSTEM } from './steering.js';` so existing importers (and Phase 8 plans that import it through the claude.ts module) keep compiling. Import `buildSystemPrompt` from './steering.js' and set the Messages API field to `system: buildSystemPrompt(envelope)`. Leave `buildPrompt` untouched — steering goes only in the system prompt (Pitfall 8). No sampling parameters (cerebrum).

2. src/providers/claude-cli.ts: drop the system constant from its claude.ts import list, import `buildSystemPrompt` from './steering.js', and pass `buildSystemPrompt(envelope)` as the value after `'--system-prompt'`. Keep the prompt as the last argv element and every other flag unchanged (accepted ps disclosure T-08-02-07; the added text is public catalog names only).

3. D-18 for Phase 8 adapters: if `src/providers/ollama.ts` or `src/providers/openai.ts` exists when this task runs, change its system-message source to `buildSystemPrompt(envelope)` the same way and update its tests; if neither exists, do nothing here — the guard below forces whichever phase ships second to wire it.

4. Tests. tests/claude-provider.test.ts: add a case with an `installed-tools` chunk `['fd', 'rg']` asserting `createMock.mock.calls[0][0].system` contains `Notable command-line tools installed on this machine` and `fd rg`, and `messages[0].content` does not contain `installed-tools` or `Notable command-line tools`; add a case without the chunk asserting `system` is strictly equal to the exported constant. tests/claude-cli-provider.test.ts: in the argv test (or a sibling), assert `args[args.indexOf('--system-prompt') + 1]` equals `buildSystemPrompt(envelope)` for an envelope carrying the chunk and contains `Never include install steps`. tests/steering.test.ts: add `describe('adapters', ...)` reading every `.ts` file in src/providers/ with `readdirSync`/`readFileSync`: (a) apart from steering.ts, the only file that mentions the system constant identifier is claude.ts, and every claude.ts line mentioning it is the re-export from './steering.js'; (b) every file containing `messages.create(`, `'--system-prompt'`, `/api/chat` or `chat/completions` also contains `buildSystemPrompt(`; (c) claude.ts and claude-cli.ts both contain `buildSystemPrompt(envelope)`. Name the cases so `-t "adapters"` selects them.

5. docs/EXTENSIONS.md: add a `## Prompt steering (Phase 9)` section stating that every provider adapter must build its system prompt with `buildSystemPrompt(envelope)` from src/providers/steering.ts (never the raw constant), that only the `catalog ∩ installed` names from the `installed-tools` chunk ever reach a model, that `QQ_TOOL_AWARENESS=0` turns steering and flagging off, and that the `adapters` test in tests/steering.test.ts enforces this.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/steering.test.ts tests/claude-provider.test.ts tests/claude-cli-provider.test.ts</automated>
    <fails_when>non-zero exit, or "No test files found", or any failed case</fails_when>
    <automated>pnpm exec vitest run tests/steering.test.ts -t "adapters"</automated>
    <fails_when>non-zero exit, or 0 passed (the filter matched nothing)</fails_when>
    <automated>pnpm typecheck</automated>
    <fails_when>non-zero exit, or any "error TS" line</fails_when>
  </verify>
  <acceptance_criteria>
    - `grep -c "system: buildSystemPrompt(envelope)" src/providers/claude.ts` >= 1
    - `grep -c "buildSystemPrompt(envelope)" src/providers/claude-cli.ts` >= 1
    - `grep -c "export { QUEQUE_SYSTEM } from './steering.js'" src/providers/claude.ts` >= 1
    - `grep -c "buildSystemPrompt" docs/EXTENSIONS.md` >= 1
    - the `adapters` cases pass and tests/claude-provider.test.ts asserts the no-chunk `system` value equals the exported constant
    - all three verify commands exit 0
  </acceptance_criteria>
  <done>Both Claude paths send buildSystemPrompt(envelope); with no chunk the system prompt is byte-identical to before; the adapters guard fails for any provider file that sends a system prompt without the builder; EXTENSIONS.md documents the rule.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client/daemon → hosted model | The system prompt and user prompt leave the machine to Anthropic (SDK) or via the `claude` CLI |
| process argv | `claude -p --system-prompt <text>` is visible to same-host users through `ps` |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-09-07 | Information Disclosure | installed-tools chunk / system prompt | high | mitigate | Zod refine rejects any non-CATALOG name and arrays longer than CATALOG; buildSteeringText re-filters to CATALOG_SET; the catalog is a public allow list, so private binary, function and alias names cannot reach the model (D-04) |
| T-09-08 | Tampering | a provider adapter bypassing steering (D-18) | medium | mitigate | `adapters` guard in tests/steering.test.ts scans src/providers/ and fails when a model-calling file lacks buildSystemPrompt; EXTENSIONS.md documents the rule |
| T-09-09 | Information Disclosure | `ps` exposure of `--system-prompt` on the CLI path | low | accept | Accepted risk T-08-02-07; the added text is public catalog tool names only, so the disclosure does not meaningfully grow |
| T-09-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs in this plan |
</threat_model>

<verification>
- `pnpm exec vitest run tests/steering.test.ts tests/claude-provider.test.ts tests/claude-cli-provider.test.ts` exits 0
- `pnpm typecheck` and `pnpm lint` exit 0
</verification>

<success_criteria>
- The prompt can carry only installed ∩ catalog names, and only in the system prompt, for both Claude paths (SC-6, D-04, D-15..D-18)
- Absent chunk → unchanged prompts (existing behaviour and tests intact)
</success_criteria>

## Artifacts this phase produces

- `src/shared/tool-catalog.ts`: `CATALOG`, `CATALOG_SET`, `installedCatalogTools(isInstalled)`
- `src/contracts/request.ts`: `installed-tools` variant of `contextChunkSchema` (`payload.tools`)
- `src/providers/steering.ts`: `QUEQUE_SYSTEM` (moved), `buildSteeringText(tools)`, `buildSystemPrompt(envelope)`
- `src/providers/claude.ts`: re-export of `QUEQUE_SYSTEM`; SDK `system` from `buildSystemPrompt`
- `src/providers/claude-cli.ts`: `--system-prompt` value from `buildSystemPrompt`
- `tests/steering.test.ts` (catalog, schema, builder, `adapters` guard); docs section "Prompt steering (Phase 9)"

## Project rules for executors

- OpenWolf: anatomy/cerebrum first; update `.wolf/anatomy.md` (new steering.ts, tool-catalog.ts) and `.wolf/memory.md`; record the steering-wording decision in `.wolf/cerebrum.md` Decision Log; stage `.wolf/` with the code.
- TDD stubs before RED tests (cerebrum). `pnpm exec vitest run <files>`. Biome-check before staging. Lowercase commit subjects, no Co-Authored-By trailer.

<output>
Create `.planning/phases/09-installed-only-command-awareness/09-03-SUMMARY.md` when done.
</output>

#### .planning/phases/09-installed-only-command-awareness/09-04-PLAN.md
---
phase: 09-installed-only-command-awareness
plan: 04
type: execute
wave: 2
depends_on:
  - 09-01
files_modified:
  - src/shared/tool-awareness.ts
  - tests/tool-awareness.test.ts
  - tests/client-result.test.ts
  - src/ui/CandidateSelect.tsx
  - src/ui/ControlsLine.tsx
  - src/ui/modal-layout.ts
  - tests/candidate-select.test.tsx
  - tests/controls-line.test.tsx
  - tests/modal-layout.test.ts
autonomous: true
requirements:
  - SC-3

estimate:
  tokens: 70000
  raw_tokens: 70000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "D-09: Tab on a selected flagged candidate switches that row in place to `<installer> <pkg…> && <original command>`; Tab again reverts; Shift+Tab behaves the same; Enter inserts exactly the text the row shows; Tab does nothing on an unflagged candidate and never reaches the search filter"
    - "D-10: one install step covers every missing tool in the candidate (`brew install fd xh && fd … | xh …`), with package names deduplicated"
    - "D-11: the installer comes from the same zsh handoff via isInstalled — darwin uses brew; linux uses the first of apt, dnf, pacman (`sudo apt install`, `sudo dnf install`, `sudo pacman -S`, no -y or --noconfirm so the package manager's own confirmation keeps the user in control); with no manager Tab is unavailable and the footer reads `⊘ not installed: fd — no package manager found`"
    - "D-12: package names come from the shipped, non-user-extendable PACKAGE_ALIASES map (rg → ripgrep, magick/convert → imagemagick, nvim → neovim, http → httpie, fdfind → fd-find, …); a tool not in the map installs under its own name"
    - "D-14: the controls bar shows a `tab` `install` chip pair only while the selected candidate is flagged and an install form exists; while that row shows its install form the chip reads `undo install` and the footer reads `⊘ will install: <packages>`"
    - "D-07: there is no use-before-install or wrong-OS-installer logic — `fd -e ts && brew install fd` and `apt install jq` on darwin are judged by the normal missing-tool rule only"
    - "D-08: a candidate can be destructive and flagged at once; the destructive check runs on the displayed text, so a Linux `sudo …` install form also shows the yellow ⚠ alongside the cyan ⊘"
    - "D-13: toggling never reorders candidates; toggle state is keyed by candidate identity (`command::explanation`) so search-filter re-indexing cannot move it to another row, and it resets when new candidates arrive"
    - "Install-form safety: only missing words matching /^[A-Za-z0-9][A-Za-z0-9._+-]*$/ become packages; any other missing word blocks the install form (row still flagged, footer says no safe install command); commands with a `;`, `||`, `&` or newline list operator are wrapped in `{ …; }` so the user's command never runs after a failed install"
    - "SC-3 (insertion-only): the install form is only inserted into the shell buffer; nothing executes; buildShellBuffers still lands the cursor on the first angle-bracket slot of an install-form command"
    - "pnpm exec vitest run tests/tool-awareness.test.ts tests/candidate-select.test.tsx tests/controls-line.test.tsx tests/modal-layout.test.ts tests/client-result.test.ts exits 0"
  prohibitions:
    - statement: "MUST NOT auto-run an install or the original command — Tab only changes the displayed text, Enter only inserts it (CONTEXT out of scope: auto-installing anything)"
      category: safety
      status: resolved
      verification: test
    - statement: "MUST NOT let a quoted or metacharacter-bearing model word into the installer argument list"
      category: security
      status: resolved
      verification: test
  artifacts:
    - path: "src/shared/tool-awareness.ts"
      provides: "installer choice, package map, guarded install-form builder, install plan on annotated candidates"
      exports: ["InstallerId", "INSTALL_COMMANDS", "LINUX_INSTALLER_ORDER", "PACKAGE_ALIASES", "SAFE_PACKAGE_NAME_RE", "InstallPlan", "InstallBlockReason", "pickInstaller", "packageFor", "buildInstallForm", "planInstall"]
    - path: "src/ui/CandidateSelect.tsx"
      provides: "Tab toggle, displayed-command insertion, install footers"
      contains: "key.tab"
    - path: "src/ui/ControlsLine.tsx"
      provides: "optional tab hint chips"
      contains: "tabHint"
    - path: "src/ui/modal-layout.ts"
      provides: "candidateKey and toggle-aware line estimate"
      exports: ["candidateKey"]
    - path: "tests/controls-line.test.tsx"
      provides: "tab hint rendering coverage"
  key_links:
    - from: "src/shared/tool-awareness.ts"
      to: "src/shared/command-words.ts"
      via: "lexHand op tokens decide list wrapping"
      pattern: "lexHand\\("
    - from: "src/ui/CandidateSelect.tsx"
      to: "src/ui/ControlsLine.tsx"
      via: "<ControlsLine tabHint={…} />"
      pattern: "tabHint="
    - from: "src/ui/CandidateSelect.tsx"
      to: "src/shared/tool-awareness.ts"
      via: "DisplayCandidate.install.form shown when toggled"
      pattern: "install\\?\\.form"
    - from: "src/ui/modal-layout.ts"
      to: "src/ui/CandidateSelect.tsx"
      via: "estimateCandidateSelectLines receives installToggled"
      pattern: "installToggled"
---

<objective>
Make a flagged candidate usable in one keystroke: compute the platform installer and a guarded install form for each flagged candidate in the client, and let Tab toggle that row between the model's command and `<installer> <pkg…> && <command>`, with the controls bar and footer explaining what will happen. Enter inserts exactly what the row shows; nothing ever runs automatically.

Purpose: D-13 keeps flagged candidates in the model's order precisely because Tab install makes them usable (D-09..D-14).

Output: installer/package/install-form logic in src/shared/tool-awareness.ts (consumed through the existing `annotateCandidates` call, so run-foreground.ts does not change), Tab handling and footers in CandidateSelect, a tab hint in ControlsLine, a toggle-aware layout estimate, and tests.

Spec note: no SPEC.md; ⚠ spec-less probe fallback skipped: phase has no requirement IDs to probe (visible skip).
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-installed-only-command-awareness/09-CONTEXT.md
@.planning/phases/09-installed-only-command-awareness/09-RESEARCH.md
@.planning/phases/09-installed-only-command-awareness/09-PATTERNS.md
@.planning/phases/09-installed-only-command-awareness/09-01-SUMMARY.md
@.wolf/cerebrum.md
@src/shared/tool-awareness.ts
@src/shared/command-words.ts
@src/ui/CandidateSelect.tsx
@src/ui/ControlsLine.tsx
@src/ui/modal-layout.ts
@src/shared/qq-config.ts
@src/client/run-foreground.ts
@tests/candidate-select.test.tsx

<interfaces>
From 09-01 (read the files; these signatures are the contract):
- `ToolInventory { commands; builtins; functions }`, `isInstalled(inventory, name)`, `missingTools(command, inventory)`, `DisplayCandidate = CommandCandidate & { readonly missingTools?: readonly string[] }`, `annotateCandidates(candidates, inventory)` — called once in run-foreground.ts right before `app.rerender`. Adding a defaulted third parameter `platform: NodeJS.Platform = process.platform` keeps that call site unchanged.
- `lexHand(s)` returns tokens with `t: 'op'` for `|`, `&`, `;`, `(`, `)`, `&&`, `||`, `|&`, `;;`; a newline becomes an op `;`.
- CandidateSelect from 09-01: `MISSING_TOOL_MARK = '⊘'` (cyan), `missingToolsFooterText(missing)`, flag footer in a `<Box marginTop={1}>`; useState order is selectedIndex (0), query (1) — the test file mocks useState by call order and does not invoke lazy initializers.
- Ink 7.0.1 `useInput` sets `key.tab` for Tab and for Shift+Tab (`key.shift` true) and passes `input === ''` for Tab; CandidateSelect has no `useFocus`, so Ink's focus cycling does not consume Tab (RESEARCH Pattern 5, verified in node_modules).
- `DEFAULT_DESTRUCTIVE_COMMAND_PATTERNS` includes `\bsudo\b`, so apt/dnf/pacman install forms are destructive by design (D-08 allows both marks).
- `buildShellBuffers(command, explanation)` in run-foreground.ts strips angle brackets and puts the cursor before the first `<`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Installer choice, package map, and the guarded install-form builder</name>
  <reversibility rating="reversible">Installer prefixes and the alias map are shipped constants behind planInstall; changing a convention (for example adding -y) is a one-file edit.</reversibility>
  <files>src/shared/tool-awareness.ts, tests/tool-awareness.test.ts, tests/client-result.test.ts</files>
  <read_first>
    - src/shared/tool-awareness.ts and src/shared/command-words.ts (from 09-01)
    - tests/tool-awareness.test.ts (from 09-01)
    - src/client/run-foreground.ts (buildShellBuffers L26-40 and the annotateCandidates call)
    - tests/client-result.test.ts (imports and the runForegroundClient describe)
    - .planning/phases/09-installed-only-command-awareness/09-RESEARCH.md (Pattern 9, Assumptions A3-A6)
  </read_first>
  <behavior>
    - pickInstaller(inv with brew, 'darwin') → 'brew'; darwin without brew → null; linux with dnf+pacman → 'dnf'; linux with apt+dnf → 'apt'; linux with none → null; 'win32' → null; brew present only as a function on darwin → 'brew'
    - planInstall('rg TODO -t ts', ['rg'], 'brew').form → 'brew install ripgrep && rg TODO -t ts'
    - planInstall('fd . | xh get example.com', ['fd','xh'], 'brew').form → 'brew install fd xh && fd . | xh get example.com' (D-10, no braces for a pipeline)
    - planInstall('magick a.png b.jpg && convert c.png d.jpg', ['magick','convert'], 'brew').packages → ['imagemagick'] (deduplicated)
    - planInstall('fdfind -e ts', ['fdfind'], 'apt').form → 'sudo apt install fd-find && fdfind -e ts'; pacman form starts 'sudo pacman -S '; dnf form starts 'sudo dnf install '
    - planInstall('cd src; fd x', ['fd'], 'brew').form → 'brew install fd && { cd src; fd x; }'; 'fd x || echo none' → wrapped; 'fd x &' → 'brew install fd && { fd x & }'; a newline-separated command is wrapped
    - planInstall('"rm -rf ~"', ['rm -rf ~'], 'brew') → { form: null, packages: [], blocked: 'unsafe-package-name' }
    - planInstall('fd x', ['fd'], null) → { form: null, blocked: 'no-package-manager' }
    - no form ever contains '-y' or '--noconfirm'; every PACKAGE_ALIASES value matches SAFE_PACKAGE_NAME_RE
    - annotateCandidates([flagged, clean], inv, 'darwin') → flagged gets install with a form, clean gets no install field; order unchanged
    - D-07: missingTools('fd -e ts && brew install fd', inv with brew) → ['fd']; missingTools('apt install jq', darwin inv without apt) → ['apt']
    - buildShellBuffers('brew install fd && fd <pattern>', 'find files') → { lbuffer: 'brew install fd && fd ', rbuffer: 'pattern  # find files' }
  </behavior>
  <action>
TDD per cerebrum: add the new exports to src/shared/tool-awareness.ts as throw-on-call stubs first so tsc passes, write the RED tests, then implement.

In src/shared/tool-awareness.ts (per D-09..D-12):
- `type InstallerId = 'brew' | 'apt' | 'dnf' | 'pacman'`; `INSTALL_COMMANDS: Readonly<Record<InstallerId, string>>` = brew → `brew install`, apt → `sudo apt install`, dnf → `sudo dnf install`, pacman → `sudo pacman -S` (Claude's choice per D-11: sudo for the Linux managers, no auto-confirm flags, so the manager still asks before installing); `LINUX_INSTALLER_ORDER: readonly InstallerId[] = ['apt', 'dnf', 'pacman']`.
- `pickInstaller(inventory: ToolInventory, platform: NodeJS.Platform): InstallerId | null` — darwin: `brew` when `isInstalled(inventory, 'brew')`; linux: the first of LINUX_INSTALLER_ORDER that `isInstalled`; anything else or none found: null.
- `PACKAGE_ALIASES: ReadonlyMap<string, string>` (D-12, shipped, not user-extendable): rg→ripgrep, delta→git-delta, nvim→neovim, magick→imagemagick, convert→imagemagick, identify→imagemagick, mogrify→imagemagick, ag→the_silver_searcher, gtimeout→coreutils, ffprobe→ffmpeg, btm→bottom, difft→difftastic, http→httpie, https→httpie, vd→visidata, mlr→miller, csvlook→csvkit, gtime→gnu-time, kubectl→kubernetes-cli, dig→bind, rga→ripgrep-all, tldr→tealdeer, aws→awscli, fdfind→fd-find, batcat→bat. `packageFor(tool)` returns the mapped name or the tool itself.
- `SAFE_PACKAGE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/`.
- `type InstallBlockReason = 'no-package-manager' | 'unsafe-package-name'`; `interface InstallPlan { readonly form: string | null; readonly packages: readonly string[]; readonly blocked: InstallBlockReason | null }`.
- `buildInstallForm(command: string, packages: readonly string[], installer: InstallerId): string` — trim the command; prefix = the installer command plus the packages joined by single spaces; if `lexHand(command)` contains an op token whose value is `;`, `||`, `&` or `;;`, wrap the command in a brace group: when the trimmed command already ends in `;` or in a single `&` use `{ <cmd> }`, otherwise `{ <cmd>; }`; join prefix and command with ` && `. Pipelines and `&&`-only chains are not wrapped (`&&` binds looser than `|`, RESEARCH A5).
- `planInstall(command, missing, installer: InstallerId | null): InstallPlan` — installer null → blocked `no-package-manager` (form null, packages []); any missing word failing SAFE_PACKAGE_NAME_RE → blocked `unsafe-package-name`; otherwise packages = missing mapped through packageFor, deduplicated in first-seen order, form from buildInstallForm, blocked null.
- `DisplayCandidate` gains `readonly install?: InstallPlan`. `annotateCandidates(candidates, inventory, platform: NodeJS.Platform = process.platform)` computes `pickInstaller` once per call and attaches `install: planInstall(...)` to each flagged candidate. Do not add any branch that looks for install verbs, use-before-install, or wrong-OS installers in the model's text (D-06, D-07).

Extend tests/tool-awareness.test.ts with every behaviour bullet (inject `platform` explicitly; build inventories with Sets). In tests/client-result.test.ts add one `buildShellBuffers` case (import from '../src/client/run-foreground.js' inside the test, as the file already does for runForegroundClient) for the install-form cursor (Pitfall 6).
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/tool-awareness.test.ts tests/client-result.test.ts</automated>
    <fails_when>non-zero exit, or "No test files found", or 0 passed</fails_when>
    <automated>pnpm typecheck</automated>
    <fails_when>non-zero exit, or any "error TS" line</fails_when>
  </verify>
  <acceptance_criteria>
    - `grep -c "SAFE_PACKAGE_NAME_RE" src/shared/tool-awareness.ts` >= 2 (declared and used)
    - `grep -c "'sudo pacman -S'" src/shared/tool-awareness.ts` >= 1 and `grep -c "'brew install'" src/shared/tool-awareness.ts` >= 1
    - `grep -c "fdfind" src/shared/tool-awareness.ts` >= 1 (D-12 seed present)
    - tests/tool-awareness.test.ts asserts the exact form `brew install ripgrep && rg TODO -t ts` and the wrapped form `brew install fd && { cd src; fd x; }`
    - tests/tool-awareness.test.ts asserts an unsafe missing word yields `blocked: 'unsafe-package-name'` and `form: null`
    - tests/client-result.test.ts asserts buildShellBuffers on `brew install fd && fd <pattern>` returns lbuffer `brew install fd && fd `
    - both verify commands exit 0
  </acceptance_criteria>
  <done>Each flagged candidate arrives with an install plan: the right platform manager, mapped and deduplicated packages, a list-safe form, or an explicit blocked reason; run-foreground.ts is untouched.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Tab toggle, install footers, controls hint, and toggle-aware layout</name>
  <files>src/ui/CandidateSelect.tsx, src/ui/ControlsLine.tsx, src/ui/modal-layout.ts, tests/candidate-select.test.tsx, tests/controls-line.test.tsx, tests/modal-layout.test.ts</files>
  <read_first>
    - src/ui/CandidateSelect.tsx, src/ui/ControlsLine.tsx, src/ui/modal-layout.ts (current state after 09-01)
    - src/shared/tool-awareness.ts (InstallPlan from Task 1)
    - tests/candidate-select.test.tsx (useState/useInput mocks L14-105; re-render pattern L572-635)
    - tests/modal-layout.test.ts
    - .planning/phases/09-installed-only-command-awareness/09-RESEARCH.md (Pattern 5, Pitfalls 3-4)
  </read_first>
  <behavior>
    - Tab on a selected flagged candidate with install.form calls the third state setter; after re-render the row text is the install form and the footer is `⊘ will install: fd`; a second Tab restores the original command and `⊘ not installed: fd`
    - Shift+Tab (tab and shift true) toggles the same way; Tab with input '\t' never calls the query setter
    - Enter after toggling calls onSelect('brew install fd && fd -e ts', 'find ts files'); with an empty explanation the fallback is `see man fd` (from the original command, not `see man brew`)
    - Tab on an unflagged candidate, or on a flagged one with install.blocked set, calls neither the toggle setter nor the query setter
    - blocked 'no-package-manager' footer: `⊘ not installed: fd — no package manager found`; blocked 'unsafe-package-name' footer ends with `— no safe install command`
    - a toggled `sudo apt install fd-find && fdfind -e ts` row shows both ` ⚠` and ` ⊘` and both footers (D-08)
    - toggle state survives a narrowing search query that re-indexes the visible list (keyed by candidateKey)
    - ControlsLine(): no `tab` chip; ControlsLine({ tabHint: 'install' }) shows ` tab ` and ` install `; ({ tabHint: 'undo install' }) shows ` undo install `
    - estimateCandidateSelectLines with installToggled containing a long candidate's key counts the wrapped install-form lines instead of the original command lines
  </behavior>
  <action>
src/ui/modal-layout.ts: export `candidateKey(candidate: CommandCandidate): string` returning the trimmed command, `::`, then the explanation (the same identity CandidateSelect already uses as the row React key). Add `installToggled?: ReadonlySet<string>` to `CandidateSelectLayoutInput`; when estimating each candidate, wrap the displayed text — the install form when the candidate's key is toggled and `install?.form` exists, otherwise the trimmed command. The flag footer stays one footer (+2 rows) in every state.

src/ui/ControlsLine.tsx: accept `{ tabHint?: 'install' | 'undo install' }` (exported props interface `ControlsLineProps`). When set, render between the `enter accept` pair and the `esc cancel` pair a dim ` · ` separator, a ` tab ` chip with `backgroundColor="ansi256(238)" color="white" bold`, and a ` <tabHint> ` chip with `backgroundColor="ansi256(245)" color="black"` — the existing chip style. No change when unset.

src/ui/CandidateSelect.tsx (D-09, D-14, D-08, D-13):
- Add the toggle state as the THIRD useState call, after `query`: `useState<ReadonlySet<string>>(new Set())` — an eager value, because the test mock stores the initial argument as-is and never calls a lazy initializer (Pitfall 3). Clear it with `setInstallToggled(new Set())` inside the existing `[candidates]` effect.
- A local `displayedCommand(candidate)` returns `candidate.install.form` when `candidateKey(candidate)` is in the toggle set and the form is non-null, otherwise the trimmed command.
- In the input handler, add a Tab branch right after the backspace branch and before the return branch: when `key.tab` is true (Shift+Tab included), if candidates exist find the selected visible candidate; if its `install?.form` is non-null toggle its key in a new Set; then `return` in every case so Tab never falls through to the search filter.
- Enter sends `displayedCommand(selected)`; the explanation fallback is built from the first word of the ORIGINAL trimmed command.
- Rows wrap and render `displayedCommand(candidate)`; `isDestructiveCommand` runs on the displayed text; the row key stays `candidateKey(candidate)`; order is untouched.
- Footer text for the selected flagged candidate (extend `missingToolsFooterText` to take the candidate and its toggled flag): toggled → `⊘ will install: <packages joined by ", ">`; blocked `no-package-manager` → `⊘ not installed: <tools> — no package manager found` (D-11 copy); blocked `unsafe-package-name` → `⊘ not installed: <tools> — no safe install command`; otherwise `⊘ not installed: <tools>`.
- Pass `tabHint` to `<ControlsLine />`: `'undo install'` when the selected candidate is toggled, `'install'` when it has a non-null `install.form`, otherwise undefined (D-14).
- Pass `installToggled` into `estimateCandidateSelectLines` and its effect dependency list.
- Update the component's Keys doc comment with `Tab — toggle the install form on a flagged candidate`. Spacing only through Ink props.

Tests: extend tests/candidate-select.test.tsx with a `describe('CandidateSelect — Tab install form')` covering every behaviour bullet (use `stateValues[2]` / `stateSetters[2]` for the toggle state, the existing `stateCallCount = 0` re-render pattern, and fixture candidates that carry `missingTools` and `install` objects directly). Create tests/controls-line.test.tsx that calls `ControlsLine(props)` directly (no hooks, no mocks needed) and flattens the returned element tree with a local collectText. Extend tests/modal-layout.test.ts with the toggle-aware estimate case.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/candidate-select.test.tsx tests/controls-line.test.tsx tests/modal-layout.test.ts</automated>
    <fails_when>non-zero exit, or "No test files found", or 0 passed</fails_when>
    <automated>pnpm exec vitest run tests/candidate-select.test.tsx -t "install"</automated>
    <fails_when>non-zero exit, or 0 passed (the filter matched nothing)</fails_when>
    <automated>pnpm typecheck</automated>
    <fails_when>non-zero exit, or any "error TS" line</fails_when>
  </verify>
  <acceptance_criteria>
    - `grep -c "key.tab" src/ui/CandidateSelect.tsx` >= 1 and `grep -c "tabHint=" src/ui/CandidateSelect.tsx` >= 1
    - `grep -c "no package manager found" src/ui/CandidateSelect.tsx` >= 1 and `grep -c "will install:" src/ui/CandidateSelect.tsx` >= 1
    - `grep -c "export function candidateKey" src/ui/modal-layout.ts` >= 1
    - tests/candidate-select.test.tsx asserts onSelect receives `brew install fd && fd -e ts` after Tab, and asserts the query setter (`stateSetters[1]`) is not called on Tab
    - tests/controls-line.test.tsx asserts the `undo install` chip text
    - all three verify commands exit 0
  </acceptance_criteria>
  <done>Tab toggles a flagged row between its command and its install form, the footer and controls bar explain the state, blocked rows explain why, Enter inserts exactly what is shown, and the Zellij layout estimate tracks the displayed text.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| model output → install form | Untrusted command words become installer arguments in text the user may run |
| client → shell buffer | The displayed command is inserted into the user's zsh line (never executed by QueQue) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-09-10 | Tampering | planInstall / buildInstallForm | high | mitigate | Only missing words matching SAFE_PACKAGE_NAME_RE become packages; any other word blocks the form (form null, footer explains); alias-map values are constants tested against the same regex |
| T-09-11 | Tampering | install form chained with `;` / `||` / `&` | medium | mitigate | Brace-group wrapping when lexHand finds a list operator, so a failed install never runs the user's command; pipelines rely on `&&` binding looser than `|` |
| T-09-12 | Elevation of Privilege | `sudo apt/dnf/pacman` install forms | medium | mitigate | Insertion-only (Enter inserts, never executes); no -y/--noconfirm so the manager confirms; the destructive ⚠ mark and footer appear on sudo forms (D-08) |
| T-09-13 | Spoofing | Tab state attached to the wrong row after filtering | low | mitigate | Toggle state keyed by candidateKey identity and cleared when candidates change; test covers a narrowing query |
| T-09-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs in this plan; QueQue itself never runs brew/apt/dnf/pacman |
</threat_model>

<verification>
- `pnpm exec vitest run tests/tool-awareness.test.ts tests/candidate-select.test.tsx tests/controls-line.test.tsx tests/modal-layout.test.ts tests/client-result.test.ts` exits 0
- `pnpm typecheck` and `pnpm lint` exit 0
</verification>

<success_criteria>
- Tab install, revert, Enter-inserts-what-is-shown, and the controls/footer copy match D-09..D-14
- Unsafe words and missing package managers block the form visibly instead of producing a dangerous command
</success_criteria>

## Artifacts this phase produces

- `src/shared/tool-awareness.ts`: `InstallerId`, `INSTALL_COMMANDS`, `LINUX_INSTALLER_ORDER`, `PACKAGE_ALIASES`, `SAFE_PACKAGE_NAME_RE`, `InstallBlockReason`, `InstallPlan`, `pickInstaller`, `packageFor`, `buildInstallForm`, `planInstall`; `DisplayCandidate.install`; `annotateCandidates(…, platform)`
- `src/ui/modal-layout.ts`: `candidateKey`, `CandidateSelectLayoutInput.installToggled`
- `src/ui/ControlsLine.tsx`: `ControlsLineProps { tabHint?: 'install' | 'undo install' }`
- `src/ui/CandidateSelect.tsx`: Tab toggle state (third useState), install footers, `tabHint` wiring
- New test file `tests/controls-line.test.tsx`

## Project rules for executors

- OpenWolf: anatomy/cerebrum first; update `.wolf/anatomy.md` (tests/controls-line.test.tsx) and `.wolf/memory.md`; add a cerebrum Key Learning that CandidateSelect's third useState is the install toggle (test index 2); stage `.wolf/` with the code.
- TDD stubs before RED tests. `pnpm exec vitest run <files>`. Biome-check before staging. Lowercase commit subjects, no Co-Authored-By trailer. Spacing via Ink props only.

<output>
Create `.planning/phases/09-installed-only-command-awareness/09-04-SUMMARY.md` when done.
</output>

#### .planning/phases/09-installed-only-command-awareness/09-05-PLAN.md
---
phase: 09-installed-only-command-awareness
plan: 05
type: execute
wave: 3
depends_on:
  - 09-01
  - 09-02
  - 09-03
  - 09-04
files_modified:
  - src/contracts/ipc.ts
  - src/daemon/server.ts
  - src/daemon/bootstrap.ts
  - tests/daemon-bootstrap.test.ts
  - tests/daemon-fetch.test.ts
  - src/client/run-foreground.ts
  - tests/client-result.test.ts
autonomous: false
requirements:
  - SC-1
  - SC-2
  - SC-6

estimate:
  tokens: 55000
  raw_tokens: 55000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "SC-6 / D-04: when the handoff is present, the envelope the client sends (to the daemon and to the in-process fallback) carries exactly one `installed-tools` chunk whose tools are the sorted catalog members that isInstalled reports — including function-only names such as `nvm` (D-01 amended) — and never a non-catalog name; the client validates the chunk with contextChunkSchema before sending and drops it (debug log, no names) if validation fails"
    - "D-15 / D-16 / D-17 end-to-end: buildSystemPrompt applied to the envelope the adapter actually receives lists the installed catalog tools, the standard-utilities clause, the prefer-installed rule, the works-now rule and the no-install-steps rule"
    - "D-18: because the chunk travels inside the envelope, every adapter that builds its system prompt with buildSystemPrompt (SDK, `claude -p`, and any Phase 8 adapter) receives the same steering"
    - "Without handoff files (old widget, QQ_TOOL_AWARENESS=0) no chunk is sent, so both prompts stay byte-identical to pre-phase behaviour"
    - "Stale-daemon compatibility: the daemon's pong advertises `installedTools: true`; ensureDaemon replaces a live daemon whose pong lacks it (it would silently drop envelopes carrying the new chunk and cost the 800 ms ack timeout plus a cold fetch on every `??`); a pong with both flags is kept; an unanswered ping is still kept"
    - "Daemon-side structural guard: a fetch-candidates request whose chunk carries a non-catalog name fails ipcRequestSchema, is ignored, and never reaches the adapter"
    - "SC-1 (human-verified): a tool made available earlier in the same shell is not flagged on the next `??` without restarting the shell"
    - "SC-2 / D-19 (human-recorded): the `handoff timing` median printed by the regression guard is recorded in VERIFICATION against the ~10 ms target"
    - "pnpm exec vitest run tests/daemon-bootstrap.test.ts tests/daemon-fetch.test.ts tests/client-result.test.ts exits 0 and pnpm test:run exits 0"
  artifacts:
    - path: "src/contracts/ipc.ts"
      provides: "pong installedTools capability flag"
      contains: "installedTools"
    - path: "src/daemon/server.ts"
      provides: "pong advertises installedTools"
      contains: "installedTools: true"
    - path: "src/daemon/bootstrap.ts"
      provides: "pingDaemonFetchCap requires both capability flags"
      contains: "installedTools"
    - path: "src/client/run-foreground.ts"
      provides: "installed-tools chunk appended to the envelope"
      contains: "installed-tools"
  key_links:
    - from: "src/client/run-foreground.ts"
      to: "src/shared/tool-catalog.ts"
      via: "installedCatalogTools((name) => isInstalled(toolInventory, name))"
      pattern: "installedCatalogTools\\("
    - from: "src/client/run-foreground.ts"
      to: "src/contracts/request.ts"
      via: "contextChunkSchema.safeParse on the chunk before fetchCandidatesForUi"
      pattern: "contextChunkSchema\\.safeParse"
    - from: "src/daemon/bootstrap.ts"
      to: "src/daemon/server.ts"
      via: "ping/pong capability handshake"
      pattern: "installedTools"
---

<objective>
Ship the steering list across the process boundary: the client appends the validated `installed-tools` chunk (sorted `catalog ∩ installed`) to the envelope it sends, and the daemon advertises a new capability so `ensureDaemon` replaces any pre-Phase-9 daemon that would silently drop that envelope. Close the phase with one human check of the live `??` experience (glyph, Tab, insertion-only, same-session freshness, timing median).

Purpose: completes SC-6 end-to-end (steering for every adapter via the envelope) without the stale-daemon regression the research found (+800 ms and a cold fetch per `??` after an upgrade), and records the manual-only SC-1/SC-2 evidence from VALIDATION.md.

Output: capability flag in ipc.ts/server.ts/bootstrap.ts, chunk push in run-foreground.ts, daemon/client tests, and a human-verify checkpoint.

Spec note: no SPEC.md; ⚠ spec-less probe fallback skipped: phase has no requirement IDs to probe (visible skip).
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-installed-only-command-awareness/09-CONTEXT.md
@.planning/phases/09-installed-only-command-awareness/09-RESEARCH.md
@.planning/phases/09-installed-only-command-awareness/09-VALIDATION.md
@.planning/phases/09-installed-only-command-awareness/09-01-SUMMARY.md
@.planning/phases/09-installed-only-command-awareness/09-03-SUMMARY.md
@.wolf/cerebrum.md
@src/contracts/ipc.ts
@src/daemon/server.ts
@src/daemon/bootstrap.ts
@src/daemon/fetch-client.ts
@src/client/run-foreground.ts
@src/shared/tool-catalog.ts
@src/providers/steering.ts
@tests/daemon-bootstrap.test.ts
@tests/daemon-fetch.test.ts
@tests/client-result.test.ts

<interfaces>
Verified against HEAD 6579d10 plus the 09-01/09-03 outputs:
- src/contracts/ipc.ts L34-37: pong is `z.object({ kind: z.literal('pong'), fetchCandidates: z.literal(true).optional() })`.
- src/daemon/server.ts L72: `writeJson({ kind: 'pong', fetchCandidates: true });`; header comment L11 documents the pong; L61-65 drops any line failing `ipcRequestSchema.safeParse` with `appendDebugLog('daemon', 'ignored unknown request', …)`.
- src/daemon/bootstrap.ts L37-95 `pingDaemonFetchCap(socketPath): Promise<'yes' | 'no' | 'unknown'>` resolves `'yes'` when `response.data.fetchCandidates === true`, else `'no'`; timeout/no reply → `'unknown'`; `ensureDaemon` keeps the listener when `cap !== 'no'` (L211-216) and otherwise calls `replaceStaleListener`.
- src/daemon/fetch-client.ts: `FETCH_ACK_MS = 800`; `requestDaemonFetch` rejects with a "not accepted" IpcTransportError when no `fetch-accepted` arrives; `fetchCandidatesForUi` falls back to `resolveClaudeDefaultAdapter().fetchCandidates(envelope)` on transport errors.
- From 09-03: `contextChunkSchema` has the `installed-tools` variant (catalog refine); `installedCatalogTools(isInstalled)` in src/shared/tool-catalog.ts; `buildSystemPrompt(envelope)` and `QUEQUE_SYSTEM` exported from src/providers/steering.ts.
- From 09-01: `toolInventory` is read in run-foreground.ts right after the request parses; `isInstalled(inventory, name)` in src/shared/tool-awareness.ts; tests/client-result.test.ts has `describe('runForegroundClient: installed-tool awareness')` writing the handoff with real zsh.
- tests/daemon-bootstrap.test.ts L192 currently expects the server pong to equal `{ kind: 'pong', fetchCandidates: true }`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Capability flag so pre-Phase-9 daemons are replaced, plus daemon-side chunk guard tests</name>
  <reversibility rating="costly">The ping/pong capability set is a cross-process contract; every later envelope change must bump it the same way, and dropping the flag would let stale daemons stall `??` again.</reversibility>
  <files>src/contracts/ipc.ts, src/daemon/server.ts, src/daemon/bootstrap.ts, tests/daemon-bootstrap.test.ts, tests/daemon-fetch.test.ts</files>
  <read_first>
    - src/contracts/ipc.ts, src/daemon/server.ts, src/daemon/bootstrap.ts, src/daemon/fetch-client.ts
    - tests/daemon-bootstrap.test.ts (legacy-pong replacement test L80-109, server ping test L144-195)
    - tests/daemon-fetch.test.ts (whole file)
    - .wolf/cerebrum.md ("Stale daemons ignore new IPC" learning and the 2026-08-26 Do-Not-Repeat)
  </read_first>
  <action>
1. src/contracts/ipc.ts: add `installedTools: z.literal(true).optional()` to the pong variant next to `fetchCandidates`, with a one-line comment: daemon accepts envelopes carrying the `installed-tools` chunk (Phase 9).
2. src/daemon/server.ts: reply `{ kind: 'pong', fetchCandidates: true, installedTools: true }` and update the header comment's ping line accordingly.
3. src/daemon/bootstrap.ts: `pingDaemonFetchCap` resolves `'yes'` only when the pong has both `fetchCandidates === true` and `installedTools === true`; a pong missing either resolves `'no'`; no reply, a timeout or an unparseable reply stays `'unknown'` (kept, so dumb test sockets survive — cerebrum). Update its doc comment and the `ensureDaemon` doc comment step 1 to say a pong lacking either capability is replaced because such a daemon silently drops `fetch-candidates` envelopes it cannot validate.
4. tests/daemon-bootstrap.test.ts: update the server ping expectation to `{ kind: 'pong', fetchCandidates: true, installedTools: true }`; add `replaces a live daemon whose pong lacks installedTools` (legacy server answers `{ kind: 'pong', fetchCandidates: true }` → spawn called once, same structure as the existing legacy test); add `keeps a live daemon whose pong has both capabilities` (spawn not called). Keep the existing unanswered-ping and lacks-fetchCandidates tests passing unchanged.
5. tests/daemon-fetch.test.ts: add `accepts an envelope carrying an installed-tools chunk` — real `startDaemonServer`, envelope extras `[{ kind: 'installed-tools', payload: { tools: ['fd', 'rg'] } }]`, assert candidates return and `fetchMock` received the chunk; add `ignores an envelope whose installed-tools chunk carries a non-catalog name` — tools `['qqprivatetool']` sent with `requestDaemonFetch` must reject with /not accepted/ in under 2000 ms and `fetchMock` must not be called (the D-04 refine guards the daemon side too). Build the bad envelope as a plain object cast to `ContextEnvelope` so the test compiles.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/daemon-bootstrap.test.ts tests/daemon-fetch.test.ts</automated>
    <fails_when>non-zero exit, or "No test files found", or 0 passed</fails_when>
    <automated>pnpm typecheck</automated>
    <fails_when>non-zero exit, or any "error TS" line</fails_when>
  </verify>
  <acceptance_criteria>
    - `grep -c "installedTools: z.literal(true).optional()" src/contracts/ipc.ts` >= 1
    - `grep -c "installedTools: true" src/daemon/server.ts` >= 1
    - `grep -c "installedTools" src/daemon/bootstrap.ts` >= 1
    - tests/daemon-bootstrap.test.ts contains a test named `replaces a live daemon whose pong lacks installedTools` that asserts `spawnFn` was called once
    - tests/daemon-fetch.test.ts asserts the non-catalog chunk request rejects with /not accepted/ and `fetchMock` was not called
    - both verify commands exit 0
  </acceptance_criteria>
  <done>Current daemons advertise installedTools, older daemons are replaced before the first steered fetch, and a daemon refuses an envelope whose chunk carries non-catalog names.</done>
</task>

<task type="auto">
  <name>Task 2: Send the validated installed-tools chunk from the client and prove the steered prompt end-to-end</name>
  <files>src/client/run-foreground.ts, tests/client-result.test.ts</files>
  <read_first>
    - src/client/run-foreground.ts (current state: toolInventory read, gatherContext, fetchCandidatesForUi call)
    - src/shared/tool-catalog.ts, src/shared/tool-awareness.ts, src/providers/steering.ts, src/contracts/request.ts
    - tests/client-result.test.ts (the `installed-tool awareness` describe from 09-01)
  </read_first>
  <action>
1. src/client/run-foreground.ts: import `contextChunkSchema` (and the `ContextEnvelope` type) from '../contracts/request.js', `installedCatalogTools` from '../shared/tool-catalog.js', and `isInstalled` from '../shared/tool-awareness.js'. Add a module-private function `withInstalledToolsChunk(envelope: ContextEnvelope, inventory: ToolInventory | null): ContextEnvelope`: null inventory → return the envelope unchanged; otherwise `contextChunkSchema.safeParse({ kind: 'installed-tools', payload: { tools: installedCatalogTools((name) => isInstalled(inventory, name)) } })`; on success return a new envelope with the chunk appended to `extras` and `appendDebugLog('client', 'installed-tools chunk', { steered: <tool count> })`; on failure return the envelope unchanged and log `installed-tools chunk rejected` with no tool names. Apply it right after `gatherContext(normalized)` and pass the result to `fetchCandidatesForUi`. Keep the annotation of returned candidates from 09-01 as is. The full inventory still never goes into the envelope — only the catalog intersection (D-04).
2. tests/client-result.test.ts, in the `installed-tool awareness` describe: extend the real-zsh handoff script to also create an executable named `fd` in `$tmpDir/bin` and define a shell function `nvm`. Add `sends only installed catalog tools in the envelope`: after `runForegroundClient` in llm mode, take the envelope from `fetchCandidatesMock.mock.calls[0][0]`; assert exactly one extras chunk has kind `installed-tools`; its tools include `fd` and `nvm`, exclude `qqpresenttool` and `qqfntool`, are all members of `CATALOG_SET`, and are sorted; assert `buildSystemPrompt(envelope)` contains `fd`, `nvm` and `standard system utilities are also present` and does not contain `qqpresenttool`. Add `sends no installed-tools chunk without the handoff`: no handoff files → no chunk, and `buildSystemPrompt(envelope)` is strictly equal to `QUEQUE_SYSTEM`. Keep the 09-01 flag assertions passing.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/client-result.test.ts</automated>
    <fails_when>non-zero exit, or "No test files found", or 0 passed</fails_when>
    <automated>pnpm test:run</automated>
    <fails_when>non-zero exit, or any "failed" count above 0 in the vitest summary</fails_when>
    <automated>pnpm typecheck</automated>
    <fails_when>non-zero exit, or any "error TS" line</fails_when>
  </verify>
  <acceptance_criteria>
    - `grep -c "contextChunkSchema.safeParse" src/client/run-foreground.ts` >= 1 and `grep -c "installedCatalogTools(" src/client/run-foreground.ts` >= 1
    - tests/client-result.test.ts asserts the envelope's installed-tools chunk includes `nvm` (function-only name) and excludes `qqpresenttool`
    - tests/client-result.test.ts asserts `buildSystemPrompt(envelope)` equals `QUEQUE_SYSTEM` when no handoff files exist
    - `pnpm test:run` exits 0 (whole suite, including 09-01..09-04 tests)
  </acceptance_criteria>
  <done>The client sends a schema-validated, sorted catalog ∩ installed chunk (functions/aliases included) and the system prompt built from the adapter's actual envelope carries the steering; without the handoff nothing on the wire or in the prompts changes.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Live `??` check — flag, Tab install, insertion-only, same-session freshness, timing median</name>
  <files>none (verification only)</files>
  <read_first>
    - .planning/phases/09-installed-only-command-awareness/09-VALIDATION.md (Manual-Only Verifications)
    - .planning/phases/09-installed-only-command-awareness/09-01-SUMMARY.md (recorded handoff median)
  </read_first>
  <action>Pause for the human. Before pausing, run `pnpm build` so `dist/cli/main.js` contains this phase, and print the steps below. Do not mark the phase complete until the user replies.</action>
  <what-built>Installed-only command awareness: the `??` widget hands zsh's rehashed commands, builtins, functions and aliases to the client; candidates using a missing tool show a cyan ⊘ and a `not installed` footer; Tab toggles an install form; the prompt is steered with installed catalog tools; stale daemons are replaced automatically.</what-built>
  <how-to-verify>
    1. Open a fresh zsh with the dev widget (`export QQ_DEV_ROOT=/Users/samuel/dev/tui-llm` then `source /Users/samuel/dev/tui-llm/shell/zsh/queque.zsh`, or your usual dev setup). The first `??` may replace an older running daemon automatically.
    2. Pick a tool you do not have (`whence -p dust` prints nothing) and type `show disk usage with dust??`. Expect: the dust candidate shows a cyan ⊘ right after its command, the gutter and text stay aligned (⊘ takes one column), selecting it shows `⊘ not installed: dust`, and at least one other candidate uses installed tools and has no ⊘ (D-16).
    3. On the flagged row press Tab: the row becomes `brew install dust && …`, the controls bar shows `tab` `undo install`, the footer shows `⊘ will install: dust`. Press Tab again: it reverts. Press Tab, then Enter: the prompt line holds the install form and nothing ran (`whence -p dust` still prints nothing).
    4. Clear the line. In the SAME shell make a tool available: `brew install dust` (or `mkdir -p /tmp/qqbin && print '#!/bin/sh' > /tmp/qqbin/dust && chmod +x /tmp/qqbin/dust && path=(/tmp/qqbin $path)`). Type `show disk usage with dust??` again: the dust candidate has no ⊘ (SC-1). Remove the temp dir if you used it.
    5. If `nvm` is a shell function here (`whence -w nvm` prints `nvm: function`), type `switch to node 20 with nvm??`: the nvm candidate has no ⊘ (D-01 amended).
    6. Run `pnpm exec vitest run tests/zsh-widget.test.ts -t "handoff timing"` and note the printed `handoff median ms:` value for VERIFICATION (SC-2 target ~10 ms, guard 25 ms, D-19). Say whether `??` feels slower than before.
    7. Optional: `QQ_TOOL_AWARENESS=0` then any `??` shows no ⊘ (kill switch).
  </how-to-verify>
  <resume-signal>Type "approved" with the median from step 6, or describe what looked wrong (glyph width, Tab ignored, flag missing, slow `??`)</resume-signal>
  <verify>
    <automated>pnpm build</automated>
    <fails_when>non-zero exit, or dist/cli/main.js missing afterwards</fails_when>
  </verify>
  <acceptance_criteria>
    - the user replies "approved" with a recorded handoff median, or lists issues that are turned into follow-up fixes before the phase is verified
  </acceptance_criteria>
  <done>The user has seen the flag, Tab install, insertion-only Enter and same-session freshness work in a real terminal, and the handoff median is recorded.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| foreground client → daemon (Unix socket) | The envelope, now with the installed-tools chunk, crosses IPC to a possibly older daemon process |
| client/daemon → hosted model | The steered system prompt leaves the machine |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-09-14 | Denial of Service | stale daemon dropping the new chunk | medium | mitigate | Pong advertises `installedTools: true`; pingDaemonFetchCap returns `'no'` for a pong lacking it and ensureDaemon replaces that listener before fetching; tests cover both legacy pong shapes |
| T-09-15 | Information Disclosure | installed-tools chunk on IPC and in the in-process fallback | high | mitigate | Client builds the chunk only from installedCatalogTools and validates it with contextChunkSchema.safeParse before sending; the daemon's ipcRequestSchema refine drops any non-catalog name; buildSteeringText re-filters (09-03) |
| T-09-16 | Information Disclosure | debug log of the chunk | low | mitigate | Logs carry the steered count only, never tool names |
| T-09-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs; the human check may run `brew install` of a tool the user chooses, outside QueQue |
</threat_model>

<verification>
- `pnpm test:run && pnpm typecheck && pnpm lint` exit 0 (phase gate)
- Human checkpoint approved with the handoff median recorded
</verification>

<success_criteria>
- The prompt for every adapter carries only installed ∩ catalog names, delivered inside the envelope (SC-6)
- Upgrading never leaves a stale daemon stalling `??`
- SC-1 and SC-2 manual evidence recorded
</success_criteria>

## Artifacts this phase produces

- `src/contracts/ipc.ts`: pong field `installedTools`
- `src/daemon/server.ts`: pong `{ kind: 'pong', fetchCandidates: true, installedTools: true }`
- `src/daemon/bootstrap.ts`: `pingDaemonFetchCap` requires both capabilities
- `src/client/run-foreground.ts`: `withInstalledToolsChunk(envelope, inventory)` (module-private), chunk appended before `fetchCandidatesForUi`
- New test cases in `tests/daemon-bootstrap.test.ts`, `tests/daemon-fetch.test.ts`, `tests/client-result.test.ts`

## Project rules for executors

- OpenWolf: anatomy/cerebrum first; update `.wolf/anatomy.md` descriptions for bootstrap.ts/server.ts/run-foreground.ts and `.wolf/memory.md`; add a cerebrum Key Learning that envelope changes require a pong capability bump (installedTools is the second one); stage `.wolf/` with the code.
- `pnpm exec vitest run <files>` for targeted runs. Biome-check before staging. Lowercase commit subjects, no Co-Authored-By trailer.

<output>
Create `.planning/phases/09-installed-only-command-awareness/09-05-SUMMARY.md` when done (include the human-recorded handoff median).
</output>

## Review Instructions

**Verify against source — do not review the plan text in isolation.** The plans reference real files, migrations, routes, and tests in this repo.
1. Open the referenced files and check each claim against the actual code.
2. For every strength or concern, cite concrete `path/to/file:line` evidence plus the mechanism.
3. When a plan asserts a mechanism works (a guard, a query filter, a test that exercises a path), trace whether it actually does what is claimed — do not take the plan's word for it.
4. If you cannot read the repo (no file access), say so and downgrade that finding to an open question rather than asserting it.

Findings citing `file:line` evidence are weighted far more heavily than impressionistic ones; a review that only restates the plan's own claims has low value.

**Plan coverage is mandatory (#3301).** The exact list of plan ids and the total plan count for this review are given in the "## Plan Coverage Manifest" section below. Give **every** listed id its own `##`-level section headed with that id **verbatim** (e.g. `## 12.6-01`) before writing any cross-plan comparison, an overall risk assessment, or a consensus-style summary. A review that stops before every id has its own section is an incomplete review, not a summary — if you must stop early, say so explicitly and name which ids you did not reach.

Analyze each plan and provide:

1. **Summary** — One-paragraph assessment
2. **Strengths** — What's well-designed (bullet points)
3. **Concerns** — Potential issues, gaps, risks (bullet points with severity: HIGH/MEDIUM/LOW)
4. **Suggestions** — Specific improvements (bullet points)
5. **Risk Assessment** — Overall risk level (LOW/MEDIUM/HIGH) with justification

Focus on:
- Missing edge cases or error handling
- Dependency ordering issues
- Scope creep or over-engineering
- Security considerations
- Performance implications
- Whether the plans actually achieve the phase goals

Output your review in markdown format.

## Plan Coverage Manifest

Total plans in this review: 5

Plan ids (give each one its own `##`-level section, headed verbatim):
- 09-01
- 09-02
- 09-03
- 09-04
- 09-05

warning: failed to parse hooks config /Users/samuel/.codex/hooks.json: unknown field `SessionStart`, expected `description` or `hooks` at line 2 column 16
2026-10-08T06:43:35.724236Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer error=\"invalid_token\", error_description=\"No authorization provided\", resource_metadata=\"https://mcp.vercel.com/.well-known/oauth-protected-resource\"" })
warning: Skill descriptions were shortened to fit the 2% skills context budget. Codex can still see every skill, but some descriptions are shorter. Disable unused skills or plugins to leave more room for the rest.
hook: SessionStart
hook: SessionStart
hook: SessionStart
hook: SessionStart Failed
hook: SessionStart Failed
hook: SessionStart Failed
ERROR: You've hit your usage limit. Upgrade to Plus to continue using Codex (https://chatgpt.com/explore/plus), or try again at Nov 4th, 2026 3:06 AM.
ERROR: You've hit your usage limit. Upgrade to Plus to continue using Codex (https://chatgpt.com/explore/plus), or try again at Nov 4th, 2026 3:06 AM.

Diagnosis: codex ran at effort=high and exited with status 1.
