---
phase: 09-installed-only-command-awareness
verified: 2026-10-10T21:25:00Z
status: human_needed
score: 4/6 roadmap success criteria verified (SC-2 and SC-3 need a human decision; nothing failed)
covered_files: [".planning/phases/09-installed-only-command-awareness/09-01-PLAN.md", ".planning/phases/09-installed-only-command-awareness/09-01-SUMMARY.md", ".planning/phases/09-installed-only-command-awareness/09-02-PLAN.md", ".planning/phases/09-installed-only-command-awareness/09-02-SUMMARY.md", ".planning/phases/09-installed-only-command-awareness/09-03-PLAN.md", ".planning/phases/09-installed-only-command-awareness/09-03-SUMMARY.md", ".planning/phases/09-installed-only-command-awareness/09-04-PLAN.md", ".planning/phases/09-installed-only-command-awareness/09-04-SUMMARY.md", ".planning/phases/09-installed-only-command-awareness/09-05-PLAN.md", ".planning/phases/09-installed-only-command-awareness/09-05-SUMMARY.md", "docs/EXTENSIONS.md", "shell/zsh/queque.zsh", "src/client/run-foreground.ts", "src/client/tool-handoff.ts", "src/contracts/ipc.ts", "src/contracts/request.ts", "src/daemon/bootstrap.ts", "src/daemon/server.ts", "src/providers/claude-cli.ts", "src/providers/claude.ts", "src/providers/steering.ts", "src/shared/command-words.ts", "src/shared/tool-awareness.ts", "src/shared/tool-catalog.ts", "src/ui/CandidateSelect.tsx", "src/ui/ControlsLine.tsx", "src/ui/modal-layout.ts", "tests/candidate-select.test.tsx", "tests/claude-cli-provider.test.ts", "tests/claude-provider.test.ts", "tests/client-result.test.ts", "tests/command-words-fuzz.test.ts", "tests/command-words.test.ts", "tests/controls-line.test.tsx", "tests/daemon-bootstrap.test.ts", "tests/daemon-fetch.test.ts", "tests/fixtures/command-words-cases.ts", "tests/fixtures/command-words-fuzz-child.mjs", "tests/modal-layout.test.ts", "tests/steering.test.ts", "tests/tool-awareness.test.ts", "tests/tool-handoff.test.ts", "tests/zsh-widget.test.ts"]
covered_digest: "v3:sha256:5b8af77d35d9084057db03f94bd021d14339b514eb1ca37c7c98ff8d1aa44e01"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "SC-3 says the 'not installed' flag names the tool. After the checkpoint UI changes (commit 612fa07), nothing in the default view names the missing tool: the row has a cyan ⓘ before its explanation and the legend reads `ⓘ not installed[ · tab prepends the install command]`. The package only shows up after Tab, and only when an install form exists. Decide whether to accept this and record an override (YAML suggested in the report), or bring the tool name back somewhere that is selection-independent."
    expected: "Either an `overrides:` entry for SC-3's 'naming the tool' clause with accepted_by/accepted_at, or a code change that names the missing tool(s)"
    why_human: "The code deliberately differs from the roadmap wording because the user asked for it at the checkpoint. A verifier cannot accept a roadmap deviation on the user's behalf, and the commit messages do not record the user's words."
  - test: "SC-2 (about 10 ms or less): recorded medians are 10.10 ms under `zsh -f` and 12.37 ms in the real interactive shell (2,175 commands). The verifier measured 15.2 ms under `zsh -f` (9 runs, same 2,175 commands) at load average 21–34. Re-measure on an idle machine (`_qq_write_tool_handoff` median of 5 to 7 runs in the real shell), or accept 12.37 ms as about 10 ms."
    expected: "A real-shell median close to 10 ms on an idle machine, or an explicit acceptance of 12.37 ms"
    why_human: "'About 10 ms' is a judgment threshold. Every number was taken under heavy machine load (load average 20–40), so it cannot be measured cleanly now. The user approved the checkpoint without giving a number."
  - test: "WR-01 (post-checkpoint review fix 75f72bd): check the Linux package names the fixer entered from memory. apt: kubectl→kubectl, dig→bind9-dnsutils, ag→silversearcher-ag, tldr→tldr. dnf: kubectl→kubernetes-client, dig→bind-utils, magick/convert→ImageMagick, fd→fd-find, tldr→tealdeer. pacman: dig→bind, aws→aws-cli, btm→bottom, difft→difftastic, rga→ripgrep-all."
    expected: "Each name is a real package in that manager's default repositories; apt kubectl in particular is not in Debian/Ubuntu main without the Kubernetes apt repo"
    why_human: "Checking these needs package repositories. The fixer flagged it as 'requires human verification'. It came after the 2026-10-10 checkpoint, so the user never saw it."
  - test: "WR-04 (post-checkpoint review fix 6069f44): in the live modal, press Tab on a flagged row, type `brew` as the query, then press Tab again to undo"
    expected: "The row stays visible while it shows the install form. Undoing hides it, because the filter now matches the text the row shows. Confirm this is the behaviour you want."
    why_human: "This is a UX preference the fixer asked to have confirmed. It came after the checkpoint."
---

# Phase 9: Installed-Only Command Awareness Verification Report

**Phase Goal:** Suggestions favour tools that are actually installed, and any suggestion that uses a tool the user does not have is visibly flagged "not installed" (never silently dropped). The `??` widget hands zsh's freshly rehashed `$commands` and `$builtins` to the client; the prompt carries the installed ∩ curated-catalog tool list; each returned candidate's command words are checked against the installed set.
**Verified:** 2026-10-10T21:25:00Z
**Status:** human_needed
**Re-verification:** No. This is the first verification.

## Goal Achievement

The core mechanism is real, wired end to end and tested:

1. The zsh widget runs `rehash` and writes `commands.txt`, `builtins.txt` and `functions.txt`.
2. The client reads them eagerly.
3. The hand lexer extracts command words, and `annotateCandidates` flags missing tools without reordering or dropping candidates.
4. The picker shows a cyan ⓘ mark and a legend.
5. The client sends the strict-validated installed ∩ CATALOG chunk. The daemon accepts it leniently, filtering unknown names.
6. `buildSystemPrompt` is used by both prompt-building adapters, the SDK and `claude -p`.

Nothing failed. Two roadmap criteria need a human decision, not code: SC-3's "naming the tool" clause (removed on purpose at the checkpoint) and SC-2's "about 10 ms" threshold (12.37 ms recorded).

### Observable Truths (ROADMAP success criteria, the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC-1: A tool installed earlier in the same shell session is treated as installed on the next `??` without restarting the shell | ✓ VERIFIED | `shell/zsh/queque.zsh:44-60`: `rehash` runs unconditionally on every enabled call, before the three `print -rl` writes. Behavioural test `tests/zsh-widget.test.ts:767` "SC-1: lists a tool created after the hash table was primed" primes `$commands`, creates an executable, runs the real helper and finds it in commands.txt. It passed in this run. It also passed the human checkpoint on 2026-10-10. |
| 2 | SC-2: The widget handoff adds no more than about 10 ms to `??` startup with about 2k PATH commands | ? UNCERTAIN (human decision) | Recorded medians: `zsh -f` 10.10 ms, real interactive shell 12.37 ms. Verifier run: 15.2 ms median (`zsh -f`, 2,175 commands, load average 21–34). In this run the vitest guard batch was 19.39 ms, under its 25 ms bound. The split shows `rehash` itself costs 0.1–0.5 ms; the cost is the lazy re-hash during the first `${(k)commands}` expansion, which SC-1 requires. Every number was taken under heavy load, so whether this meets "about 10 ms" needs a human call. |
| 3 | SC-3: A candidate that uses a tool not in `$commands` is shown with a "not installed" flag naming the tool; it remains selectable and insertion-only | ? UNCERTAIN (human decision on the "naming the tool" clause) | **Flag:** `CandidateSelect.tsx:290-304` puts a cyan ⓘ before the explanation of any row whose `missingTools` is non-empty. `modal-layout.ts:25-30` renders the legend `ⓘ not installed[ · tab prepends the install command]` above ControlsLine. **Selectable and insertion-only:** Enter calls `onSelect(displayedCommand(...))` (`CandidateSelect.tsx:206-215`) and nothing executes. `annotateCandidates` maps 1:1, so there is no drop or re-sort (`tool-awareness.ts:302-324`). Tests: client-result "case A: flags a missing tool from a real zsh handoff, keeps order, inserts verbatim", plus candidate-select. **Not met literally:** no view names the missing tool. Commit 612fa07 removed the tool names from the legend at the user's request. This needs a recorded override or a code change; see Human Verification 1. |
| 4 | SC-4: Builtins, reserved words, `<placeholders>`, `$VAR` commands and path commands (`./x.sh`) are never flagged | ✓ VERIFIED | `tests/command-words.test.ts` (all 40 spike-002 cases plus review cases, with builtins from a real `zsh -f` listing) passed. Verifier spot-check through jiti on the real modules: `cd <dir> && ls`, `$EDITOR file.txt`, `./x.sh --flag`, `<tool> --help`, `for f in *; do echo $f; done`, `~/bin/foo`, a heredoc body and the function-only `nvm use 20` all returned `[]`. Builtins come from builtins.txt, never a hardcoded list (`missingTools` passes `inventory.builtins`). |
| 5 | SC-5: Malformed model output never hangs or crashes command-word extraction (fuzz test with a hard per-input timeout) | ✓ VERIFIED (test is flaky under load; see Warnings) | In this run the child-process fuzz of 20k and 5k inputs passed, and `deep 2000` took 7.5 ms. In-process benchmark of every crafted input that timed out in the vitest run (`diff <(sort a`, `$(((`, `<<`, `;;;;`, `$(`, `# c`, `echo "a\`): 0.003–0.025 ms per input, with no throw and no `undefined` words. A bare `node -e 0` takes 0.18 s and a child `one` run 0.42–0.61 s, so the 9 failed 1 s cases are Node spawn time under load, not lexer time (bug-206). `extractCommandWords` has a try/catch, an 8192-character cap and a depth cap of 32. |
| 6 | SC-6: The prompt includes only the installed ∩ curated-catalog tool list (not the full `$commands` list), across every provider adapter | ✓ VERIFIED | The client sends `installedCatalogTools(isInstalled)` validated by `strictInstalledToolsChunkSchema` (`run-foreground.ts:61-83`). The daemon's lenient schema filters to CATALOG_SET (`request.ts:127-132`). `buildSystemPrompt` re-filters to CATALOG (`steering.ts:20-50`). Both prompt-building adapters use it: `claude.ts:172` `system: buildSystemPrompt(envelope)` and `claude-cli.ts:27-28` `--system-prompt`. `claude-default.ts` and `resolver.ts` only route to these two. `buildPrompt` (the user prompt) carries only the git and filesystem chunks. CATALOG has 196 names. Tests "sends only installed catalog tools in the envelope" and "sends no installed-tools chunk without the handoff" (byte-identical QUEQUE_SYSTEM), the steering adapters guard and the daemon-fetch catalog-drift and malformed-chunk tests all passed. |

**Score:** 4/6 roadmap truths verified; 2 need a human decision; 0 present but behaviour-unverified; 0 failed.

### Plan must-haves (merged; plans cannot reduce roadmap scope)

| Plan | Must-have group | Status | Evidence |
|------|-----------------|--------|----------|
| 09-01 | Handoff shape: three `print -rl`, no loop or sort, unconditional rehash, ERR-trap-safe, failure leaves no files, kill switch at shell and client level, call placed after request.json and before both launches | ✓ VERIFIED | Shape-guard, partial-write, unwritable-dir, missing-dir, kill-switch and placement tests in `tests/zsh-widget.test.ts:766-905` passed (46/46). `tool-handoff.ts` returns null on `QQ_TOOL_AWARENESS=0`, ENOENT or empty, and logs counts only. |
| 09-01 | functions.txt holds function and alias names (no `_` prefix); a function-only `nvm` is never flagged | ✓ VERIFIED | zsh-widget test "D-01 amended". The spot-check returned `nvm use 20` → `[]`. |
| 09-01 | Hardened lexer: Map/Set tables, escape fallback, depth cap 32, 8192-character cap, no throw | ✓ VERIFIED | command-words tests passed. `"rg\` → `rg` (benchmark). |
| 09-01 | Inventory read eagerly after request.json parses; full set never sent over IPC; logs carry counts only | ✓ VERIFIED | `run-foreground.ts:152-153` reads before `ensureDaemon`. Only the CATALOG-intersected chunk enters the envelope. |
| 09-01 / 09-04 | D-08/D-14 UI wording: ⊘ after the command, selection-dependent `⊘ not installed: <tools>` footer, `⊘ will install:` footer, `tab install` / `undo install` chips, `MISSING_TOOL_MARK`/`missingToolsFooterText` exports | SUPERSEDED (checkpoint-approved) | Replaced at the 2026-10-10 checkpoint (3209e9b, 866956d, 05c3534, 612fa07, 88b08dc) by ⓘ before the explanation, a selection-independent legend and a prop-less ControlsLine. `missingToolsFooterText` no longer exists; `missingToolsLegend` and `explanationText` replace it. The orchestrator reports the user approved this, and the 09-05 SUMMARY records it. No formal override has been recorded yet; see the suggestion below. |
| 09-01 / WR-02 | Layout estimate mirrors the render; viewport reserve | ✓ VERIFIED | `MODAL_VIEWPORT_LINES = 18` (it was 17; WR-02 corrected the row count). It is used by `run-foreground.ts:239-245`. modal-layout tests passed. |
| 09-02 | 40 spike cases (37 core and 3 stretch), token contract frozen, `brew install fd && fd -e ts` gives brew and fd, real-source import in the fuzz child | ✓ VERIFIED | command-words.test.ts passed. The child imports `../../src/shared/command-words.ts` directly. |
| 09-02 | "every crafted malformed input … finishes in its own child process within a hard 1 s timeout" | ? UNCERTAIN (environment-dependent) | 9 of 36 cases timed out at 1.0 s in this run because of process spawn under load; the lexer work is under 0.03 ms. See Warnings. |
| 09-03 | Catalog of 196 names; lenient and strict schemas; steering text for D-15/16/17; byte-identical prompt without a chunk; adapters guard; Phase 8 plan notes; EXTENSIONS.md section | ✓ VERIFIED | steering.test.ts (28 tests) passed. `08-03-PLAN.md` and `08-04-PLAN.md` both mention `buildSystemPrompt`. `docs/EXTENSIONS.md` has 4 references. No temperature, top_p or top_k in `src/providers`. |
| 09-04 | Tab and Shift+Tab toggle in place; Enter inserts the shown text; one install step for all missing tools with deduped packages; installer from the handoff; package alias map (per installer after WR-01); unsafe-name, list-op wrap and comment/heredoc blocking; toggle keyed by `candidateKey` and reset on arrival; no auto-run | ✓ VERIFIED | `CandidateSelect.tsx:185-215`, `tool-awareness.ts:206-275`. tool-awareness and candidate-select tests passed. Spot-check: `fd x; rg y` → `brew install fd ripgrep && { fd x; rg y; }`; `sudo rg foo` → `brew install ripgrep && sudo rg foo`. |
| 09-04 | D-11 copy "`⊘ not installed: fd — no package manager found`" | SUPERSEDED (checkpoint-approved) | The legend drops the Tab clause when no visible row has an install form, and it names no tools. |
| 09-05 | Envelope carries exactly one validated chunk (with `nvm`); pong `installedTools: true`; stale daemon replaced; catalog drift filtered; malformed chunk ignored | ✓ VERIFIED | `server.ts:72`, `bootstrap.ts:97`, `ipc.ts:38`. daemon-bootstrap tests ("replaces a live daemon whose pong lacks installedTools") and daemon-fetch tests passed. |
| 09-05 | SC-1, kill switch and Zellij behaviour (human-verified) | ✓ VERIFIED | User approved the checkpoint on 2026-10-10 (09-05 SUMMARY). SC-1 and the kill switch are also covered by automated tests. |
| 09-05 | SC-2 numbers recorded | ✓ VERIFIED (recorded here) | `zsh -f` guard median 10.10 ms; real shell 12.37 ms (7 runs: 9.93, 10.34, 11.52, 12.37, 13.01, 13.50, 17.59); verifier `zsh -f` 15.2 ms at load average 21–34. Whether this is acceptable is Human Verification 2. |
| 09-05 | "`pnpm test:run` exits 0" | ? UNCERTAIN (environment-dependent) | Not true at load average 20–40: the fuzz 1 s cases and `claude-exec.test.ts` fail. See Warnings. |

### Prohibitions

| Prohibition | Tier | Disposition | Evidence |
|-------------|------|-------------|----------|
| MUST NOT drop or re-sort a flagged candidate | test | VERIFIED | `annotateCandidates` maps 1:1; client-result case A asserts order |
| MUST NOT discover installed tools from Node | test | VERIFIED | `src/` has no `process.env.PATH`, `readdir`, `fs.watch` or `which` lookup; zsh-widget shape guard |
| MUST NOT add a third-party shell parser dependency | test | VERIFIED | package.json has no shell-quote, bash-parser or similar package |
| MUST NOT let the handoff helper return non-zero to the widget | test | VERIFIED | ERR-trap tests passed |
| MUST NOT change lexHand op/redir/comment token values | test | VERIFIED | Token-contract tests passed (also after the CR-01 heredoc change) |
| MUST NOT put the full installed list, function/alias names or non-catalog names in a prompt | test | VERIFIED | strict and lenient schemas plus the `buildSteeringText` re-filter; client-result asserts that `qqpresenttool` and `qqfntool` are absent |
| MUST NOT steer through sampling parameters | test | VERIFIED | grep finds none |
| MUST NOT auto-run an install or the command | test | VERIFIED | Tab only changes the shown text; Enter only calls `onSelect`, and the result is replace-buffer |
| MUST NOT let a quoted or metacharacter word into the installer args | test | VERIFIED | `SAFE_PACKAGE_NAME_RE` gate makes `planInstall` return `unsafe-package-name` |
| MUST NOT emit a brace-wrapped form for a command with a comment or heredoc | test | VERIFIED | `buildInstallForm` returns null, so the plan is `unwrappable-command` |
| MUST NOT stage .wolf in wave-2 plans; 09-03 touches no client, context or daemon file | test | VERIFIED (per commit history) | 09-05 applied the wave-2 .wolf entries (SUMMARY Task 1) |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shell/zsh/queque.zsh` | `_qq_write_tool_handoff` and its call in the widget | ✓ VERIFIED | Lines 44-60 and 250 |
| `src/client/tool-handoff.ts` | `readToolHandoff`, `TOOL_HANDOFF_FILES` | ✓ VERIFIED | 68 lines, substantive; imported by run-foreground |
| `src/shared/command-words.ts` | Hardened lexer | ✓ VERIFIED | 585 lines; used by tool-awareness and the fuzz child |
| `src/shared/tool-awareness.ts` | Inventory, `isInstalled`, `missingTools`, `annotateCandidates`, install plan | ✓ VERIFIED | 324 lines; used by run-foreground |
| `src/shared/tool-catalog.ts` | CATALOG (196), `installedCatalogTools` | ✓ VERIFIED | Used by request.ts, steering.ts and run-foreground |
| `src/contracts/request.ts` | Lenient chunk variant and `strictInstalledToolsChunkSchema` | ✓ VERIFIED | |
| `src/providers/steering.ts` | `QUEQUE_SYSTEM`, `buildSteeringText`, `buildSystemPrompt` | ✓ VERIFIED | Used by claude.ts and claude-cli.ts |
| `src/ui/modal-layout.ts` | Mark, legend, `candidateKey`, estimate | ✓ VERIFIED (exports changed per checkpoint) | `missingToolsFooterText` was replaced by `missingToolsLegend` and `explanationText` |
| `src/ui/CandidateSelect.tsx` | Mark, legend, Tab toggle | ✓ VERIFIED | |
| `src/ui/ControlsLine.tsx` | (was: `tabHint` chips) | SUPERSEDED | Takes no props by user request (88b08dc) |
| `src/contracts/ipc.ts`, `src/daemon/server.ts`, `src/daemon/bootstrap.ts` | installedTools capability | ✓ VERIFIED | |
| Tests (tool-handoff, tool-awareness, command-words, fuzz, steering, controls-line) | Coverage | ✓ VERIFIED | Exist and run |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| queque.zsh | tool-handoff.ts | Fixed sibling file names commands/builtins/functions.txt | ✓ WIRED |
| run-foreground.ts | tool-handoff.ts | `readToolHandoff(path.dirname(requestFile))` (line 153) | ✓ WIRED |
| run-foreground.ts | tool-awareness.ts | `annotateCandidates(candidates, toolInventory)` before `app.rerender` (line 328) | ✓ WIRED |
| tool-awareness.ts | command-words.ts | `extractCommandWords(command, inventory.builtins)`; `lexHand` for the install form | ✓ WIRED |
| run-foreground.ts | tool-catalog.ts / request.ts | `installedCatalogTools(...)` validated by `strictInstalledToolsChunkSchema.safeParse` (lines 68-70) | ✓ WIRED |
| run-foreground.ts | daemon / fallback adapter | `fetchCandidatesForUi(socketPath, envelope)`, which falls back to `resolveClaudeDefaultAdapter().fetchCandidates(envelope)` (same envelope) | ✓ WIRED |
| claude.ts / claude-cli.ts | steering.ts | `system: buildSystemPrompt(envelope)` / `'--system-prompt', buildSystemPrompt(envelope)` | ✓ WIRED |
| steering.ts | privacy-filter.ts | `filterContextEnvelope` (only rewrites the git chunk, keeps installed-tools) | ✓ WIRED |
| bootstrap.ts | server.ts | pong `installedTools` handshake | ✓ WIRED |
| CandidateSelect.tsx | ControlsLine.tsx | `tabHint=` | SUPERSEDED (no props; the legend explains Tab) |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| CandidateSelect ⓘ mark | `candidate.missingTools` | `annotateCandidates`, from the zsh `$commands`/`$builtins`/functions handoff files | Yes. client-result case A uses a real `zsh -f` handoff | ✓ FLOWING |
| System prompt steering | `installed-tools.payload.tools` | handoff → `isInstalled` → CATALOG intersection → envelope → daemon IPC or fallback → `buildSystemPrompt` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase unit suites | `vitest run` over 12 phase test files (tool-awareness, tool-handoff, command-words, steering, candidate-select, modal-layout, controls-line, client-result, daemon-bootstrap, daemon-fetch, claude-provider, claude-cli-provider) | 311/311 passed | ✓ PASS |
| Handoff, freshness, ERR-trap, kill switch, timing guard | `vitest run tests/zsh-widget.test.ts` | 46/46; guard batch median 19.39 ms (< 25) | ✓ PASS |
| Lexer fuzz (child process) | `vitest run tests/command-words-fuzz.test.ts` | 27/36 passed; 20k and 5k fuzz OK; deep 7.5 ms; 9 crafted cases hit the 1 s spawn timeout under load | ⚠ FLAKY (bug-206) |
| Lexer cost per crafted input | jiti/node in-process benchmark over 1000 iterations | 0.003–0.025 ms per input | ✓ PASS |
| SC-4 and install forms on real modules | jiti script calling `annotateCandidates` | Builtins, placeholders, `$VAR`, paths, functions and heredoc bodies are not flagged; forms correct | ✓ PASS |
| Handoff timing | `zsh -f` with `_qq_write_tool_handoff` ×9, 2,175 commands | Median 15.2 ms at load average 21–34 | ? see SC-2 |
| Typecheck | `pnpm typecheck` | Clean | ✓ PASS |

### Probe Execution

Not applicable. No phase plan declares a probe, and the repo has no `scripts/*/tests/probe-*.sh`.

### Requirements Coverage

The SC-1 to SC-6 IDs in the PLAN frontmatter are the ROADMAP success criteria. ROADMAP lists Phase 9 as "**Requirements**: TBD". `.planning/REQUIREMENTS.md` has no SC-* IDs and no Phase 9 rows, so no requirement is orphaned. All six IDs are claimed:

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| SC-1 | 09-01, 09-05 | Same-session install seen without a shell restart | ✓ SATISFIED | Truth 1 |
| SC-2 | 09-01, 09-05 | Handoff about 10 ms or less | ? NEEDS HUMAN | Truth 2 |
| SC-3 | 09-01, 09-04 | Flag naming the tool; selectable; insertion-only | ? NEEDS HUMAN (naming clause) | Truth 3 |
| SC-4 | 09-01, 09-02 | Builtins, reserved words, placeholders, `$VAR` and paths never flagged | ✓ SATISFIED | Truth 4 |
| SC-5 | 09-02 | No hang or crash on malformed input | ✓ SATISFIED | Truth 5 |
| SC-6 | 09-03, 09-05 | Only installed ∩ catalog in the prompt, every adapter | ✓ SATISFIED | Truth 6 |

Note: REQUIREMENTS.md has no traceability rows for Phase 9. If you want SC-1 to SC-6 tracked there, add them.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (phase files) | — | TBD, FIXME or XXX | — | None found in the 33 phase-modified src/shell/tests/docs files |
| src/daemon/server.ts | 24 | `TODO(CR-005)` | ℹ️ Info | Pre-existing (a3b09a35, 2026-05-15), not from this phase |
| tests/command-words-fuzz.test.ts | 105 | 1 s hard timeout covers Node spawn and type-stripping startup (0.4–0.6 s idle-ish, more than 1 s under load) | ⚠️ Warning | The SC-5 guard goes red under load even though lexer work is under 0.03 ms, so `pnpm test:run` is not reliably green (bug-206, introduced by 09-02's test design). Fix idea: time the lexer inside the child and assert on that, and raise the hard kill to a few seconds. |
| src/shared/command-words.ts | — | A lone `\` command yields an empty external word `""` | ℹ️ Info | `annotateCandidates([{command:'\\'}])` flags `[""]` (install is blocked as `unsafe-package-name`). Only cosmetic: a row whose command is a single backslash would show ⓘ. |
| src/shared/command-words.ts | — | Open review items IN-01 (lexer false negatives undocumented) and IN-02 (function definitions flag the function name) | ℹ️ Info | Recorded in 09-REVIEW-DISPOSITION as open |
| src/providers/claude-cli.ts | 27-28 | IN-04: the steering list (catalog names only) is visible in `ps` argv for `claude -p` users | ℹ️ Info | Public catalog names only, so D-04 still holds; open in the disposition |
| tests/steering.test.ts | — | IN-05: adapters guard is marker-based | ℹ️ Info | Open in the disposition |
| src/ui/modal-layout.ts | — | IN-03: legend estimate uses the gutter-reduced width | ℹ️ Info | Could under-count one row on very narrow panes; open |

### Human Verification Required

#### 1. SC-3: missing tool not named in the UI

**Test:** Trigger `??` for a request that yields a candidate that uses a missing tool, for example a command that pipes into `xh` when `xh` is not installed.
**Expected:** Per ROADMAP SC-3, the flag names the tool. The current UI shows only ⓘ and `ⓘ not installed`. Decide whether to accept this (record the override below) or name the tool again, for example `ⓘ not installed: xh` on the row's explanation line, which keeps the height selection-independent.
**Why human:** This is an intentional, user-requested deviation from the roadmap wording (612fa07). Only the user can accept it formally.

#### 2. SC-2: timing threshold

**Test:** On an idle machine, in the real interactive shell, run `_qq_write_tool_handoff "$(mktemp -d)"` 5 to 7 times with `$EPOCHREALTIME` deltas and take the median.
**Expected:** About 10 ms. The recorded real-shell median is 12.37 ms, measured under load.
**Why human:** This is a judgment threshold, and the machine is currently at load average 20–40.

#### 3. WR-01: Linux package names (post-checkpoint)

**Test:** Check the apt, dnf and pacman names listed in the frontmatter against each distribution's repositories, apt `kubectl` especially.
**Expected:** Each one is installable as named, or is changed to `null` (blocked).
**Why human:** Needs repository access; the fixer flagged it.

#### 4. WR-04: filter matches the install form (post-checkpoint)

**Test:** Press Tab on a flagged row, type `brew`, then press Tab again.
**Expected:** Confirm that hiding the row after the undo is acceptable.
**Why human:** UX preference.

### Suggested overrides (only if you accept the checkpoint UI as the contract)

**This looks intentional.** To accept the deviation, add this to the VERIFICATION.md frontmatter:

```yaml
overrides:
  - must_have: "A candidate that uses a tool not in $commands is shown with a 'not installed' flag naming the tool"
    reason: "Checkpoint decision 2026-10-10 (612fa07): the row shows a cyan ⓘ before its explanation and a selection-independent legend `ⓘ not installed[ · tab prepends the install command]`; naming tools was dropped so the modal height never changes with the selection. The candidate's own command text shows the tool, and Tab shows the install packages."
    accepted_by: "<user>"
    accepted_at: "<ISO timestamp>"
  - must_have: "D-08/D-14: ⊘ mark after the command, selection-dependent not-installed / will-install footers, tab install chip in ControlsLine"
    reason: "Superseded at the 2026-10-10 checkpoint by ⓘ before the explanation, a legend above the controls and a prop-less ControlsLine (3209e9b, 866956d, 05c3534, 612fa07, 88b08dc)."
    accepted_by: "<user>"
    accepted_at: "<ISO timestamp>"
```

### Gaps Summary

No blocking gaps. The phase goal's mechanism is in the codebase, wired and behaviourally tested:

- **Freshness:** the zsh `rehash` handoff.
- **Flagging:** missing tools are flagged without being dropped.
- **Steering:** catalog-only steering reaches both prompt-building adapters through `buildSystemPrompt`.
- **Compatibility:** the stale-daemon capability bump.

What remains is decisions, not missing code:

1. **SC-3 "naming the tool":** removed by the user at the checkpoint. Record an override or restore a tool name.
2. **SC-2 "about 10 ms":** the recorded real-shell median is 12.37 ms, measured under heavy load. Re-measure idle or accept.
3. **Post-checkpoint review fixes WR-01 and WR-04:** the fixer asked for human confirmation.

**Warning to track separately:** `tests/command-words-fuzz.test.ts` treats Node spawn time as lexer time, so the suite goes red under load (bug-206). Lexer work measured 0.003–0.025 ms per input, so SC-5 itself holds. The 09-05 must-have "`pnpm test:run` exits 0" is therefore environment-dependent until the test's timing design is fixed.

Whether the model actually *favours* installed tools depends on the model following the steering prompt. The code guarantees that the prompt carries the list and the prefer-installed, works-now and no-install-steps rules (spike 003 is the evidence). The live checkpoint was approved, but there is no automated test of model compliance, nor could there reasonably be one.

---

_Verified: 2026-10-10T21:25:00Z_
_Verifier: Claude (gsd-verifier)_
