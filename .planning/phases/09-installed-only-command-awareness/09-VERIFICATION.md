---
phase: 09-installed-only-command-awareness
verified: 2026-10-10T21:00:37Z
status: passed
score: 6/6 roadmap success criteria verified (4 verified on evidence, 2 passed by user override: SC-2 timing, SC-3 naming clause)
covered_files: [".planning/phases/09-installed-only-command-awareness/09-01-PLAN.md", ".planning/phases/09-installed-only-command-awareness/09-01-SUMMARY.md", ".planning/phases/09-installed-only-command-awareness/09-02-PLAN.md", ".planning/phases/09-installed-only-command-awareness/09-02-SUMMARY.md", ".planning/phases/09-installed-only-command-awareness/09-03-PLAN.md", ".planning/phases/09-installed-only-command-awareness/09-03-SUMMARY.md", ".planning/phases/09-installed-only-command-awareness/09-04-PLAN.md", ".planning/phases/09-installed-only-command-awareness/09-04-SUMMARY.md", ".planning/phases/09-installed-only-command-awareness/09-05-PLAN.md", ".planning/phases/09-installed-only-command-awareness/09-05-SUMMARY.md", "docs/EXTENSIONS.md", "shell/zsh/queque.zsh", "src/client/run-foreground.ts", "src/client/tool-handoff.ts", "src/contracts/ipc.ts", "src/contracts/request.ts", "src/daemon/bootstrap.ts", "src/daemon/server.ts", "src/providers/claude-cli.ts", "src/providers/claude.ts", "src/providers/steering.ts", "src/shared/command-words.ts", "src/shared/tool-awareness.ts", "src/shared/tool-catalog.ts", "src/ui/CandidateSelect.tsx", "src/ui/ControlsLine.tsx", "src/ui/modal-layout.ts", "tests/candidate-select.test.tsx", "tests/claude-cli-provider.test.ts", "tests/claude-provider.test.ts", "tests/client-result.test.ts", "tests/command-words-fuzz.test.ts", "tests/command-words.test.ts", "tests/controls-line.test.tsx", "tests/daemon-bootstrap.test.ts", "tests/daemon-fetch.test.ts", "tests/fixtures/command-words-cases.ts", "tests/fixtures/command-words-fuzz-child.mjs", "tests/modal-layout.test.ts", "tests/steering.test.ts", "tests/tool-awareness.test.ts", "tests/tool-handoff.test.ts", "tests/zsh-widget.test.ts"]
covered_digest: "v3:sha256:376ff87bbd1e568eb2fb4a3bfd17e80fe499e3b432bd6e375d3086e63c5f1cb7"
behavior_unverified: 0
overrides_applied: 5
overrides:
  - must_have: "A candidate that uses a tool not in $commands is shown with a 'not installed' flag naming the tool"
    reason: "Accepted as designed. Checkpoint decision 2026-10-10 (612fa07): the row shows a cyan ⓘ before its explanation, and a selection-independent legend reads `ⓘ not installed[ · tab prepends the install command]`. At the user's request the legend names no tools, so the modal never changes height with the selection. The candidate's own command text shows the tool, and Tab shows the install packages. The flag, selectability and insertion-only parts of SC-3 are verified on evidence; only the 'naming the tool' clause is overridden."
    accepted_by: "user (Samuel Kimama)"
    accepted_at: "2026-10-10T21:00:37Z"
  - must_have: "D-08/D-14: ⊘ mark after the command, selection-dependent not-installed / will-install footers, tab install chip in ControlsLine"
    reason: "Superseded at the 2026-10-10 checkpoint by ⓘ before the explanation, a legend above the controls and a prop-less ControlsLine (3209e9b, 866956d, 05c3534, 612fa07, 88b08dc). The user accepted it as designed on 2026-10-10. The same applies to the D-11 copy `⊘ not installed: fd — no package manager found`: the legend drops the Tab clause when no visible row has an install form."
    accepted_by: "user (Samuel Kimama)"
    accepted_at: "2026-10-10T21:00:37Z"
  - must_have: "The widget handoff adds no more than ~10 ms to ?? startup on a machine with ~2k PATH commands"
    reason: "User: 'accept 12.37 ms'. The real interactive shell median is 12.37 ms (7 runs: 9.93, 10.34, 11.52, 12.37, 13.01, 13.50, 17.59) and the zsh -f median is 10.10 ms, both with 2,175 PATH commands and all measured at load average 20–40. 12.37 ms is accepted as meeting 'about 10 ms'. The automated 25 ms guard (median of 5 under zsh -f) still passes."
    accepted_by: "user (Samuel Kimama)"
    accepted_at: "2026-10-10T21:00:37Z"
  - must_have: "09-02: every crafted malformed input finishes in its own child process within a hard 1 s timeout"
    reason: "User decision 2026-10-10: bug-206 (Node child spawn time exceeds the 1 s per-input timeout under machine load) stays a tracked warning, not a phase gap. The lexer itself takes 0.003–0.025 ms per crafted input in process (0.0168 ms worst case in this run). The 20k and 5k child-process fuzz cases pass."
    accepted_by: "user (Samuel Kimama)"
    accepted_at: "2026-10-10T21:00:37Z"
  - must_have: "09-05: pnpm test:run exits 0"
    reason: "Environment-dependent for the same reason as bug-206 (accepted as a tracked warning by the user on 2026-10-10). Every phase test file passes. The only failures are the fuzz file's 1 s spawn-bound crafted cases, and only at load average 20–40. claude-exec.test.ts passes when run alone (2/2)."
    accepted_by: "user (Samuel Kimama)"
    accepted_at: "2026-10-10T21:00:37Z"
re_verification:
  previous_status: human_needed
  previous_score: 4/6
  previous_verified: 2026-10-10T21:25:00Z
  trigger: "Covered files changed after the previous report (674ca9f before the report was committed but not reflected in it; aa55dd5 after)"
  gaps_closed:
    - "SC-3 'naming the tool': user accepted as designed; override recorded"
    - "SC-2 'about 10 ms': user accepted 12.37 ms; override recorded"
    - "WR-01 Linux package names: apt kubectl is now null and blocked as unknown-package (aa55dd5). The remaining hand-typed Linux names are accepted for now, with backlog phase 999.1 'Model-supplied install package names' (33cab84) as the follow-up"
    - "WR-04 filter vs Tab: the user chose 'keep the row visible after undoing tab'. filterCandidates(candidates, query) now matches the command or the install form whatever the toggle state (674ca9f), and both tests pass"
  gaps_remaining: []
  regressions: []
---

# Phase 9: Installed-Only Command Awareness Verification Report

**Phase Goal:** Suggestions favour tools that are actually installed, and any suggestion that uses a tool the user does not have is visibly flagged "not installed" (never silently dropped). The `??` widget hands zsh's freshly rehashed `$commands` and `$builtins` to the client; the prompt carries the installed ∩ curated-catalog tool list; each returned candidate's command words are checked against the installed set.
**Verified:** 2026-10-10T21:00:37Z
**Status:** passed
**Re-verification:** Yes. The previous report (human_needed, 4/6) went stale when covered files changed in 674ca9f and aa55dd5. This round fully re-checks those two commits, applies the user's 2026-10-10 decisions as overrides, and regression-checks everything else.

## Goal Achievement

The core mechanism is real, wired end to end and tested. The regression check this round confirms each step:

1. The zsh widget runs `rehash` and writes `commands.txt`, `builtins.txt` and `functions.txt` (`shell/zsh/queque.zsh:44-60`, called at line 250).
2. The client reads them eagerly (`run-foreground.ts:153`).
3. The hand lexer extracts command words, and `annotateCandidates` flags missing tools without reordering or dropping candidates (`run-foreground.ts:328`).
4. The picker shows a cyan ⓘ mark and a selection-independent legend (`modal-layout.ts:11-30`).
5. The client sends the strictly validated installed ∩ CATALOG chunk (`run-foreground.ts:68-70`). The daemon accepts it leniently, filtering unknown names.
6. `buildSystemPrompt` is used by both prompt-building adapters (`claude.ts:172`, `claude-cli.ts:28`).

The two items that previously needed a human decision (SC-2 timing and SC-3 naming) are now covered by user overrides. The two post-checkpoint review items are settled:

- **WR-04:** the user's choice is implemented and tested.
- **WR-01:** kubectl is fixed; the remaining Linux names are accepted, with backlog 999.1 as the follow-up.

### What changed since the previous report (verified in code)

| Commit | Claim | Verified evidence |
|--------|-------|-------------------|
| 674ca9f | `filterCandidates(candidates, query)` matches the command or the install form regardless of the Tab toggle, so Tab never shows or hides a row | `modal-layout.ts:112-124`: the signature has no `installToggled` parameter. The predicate is `c.command.toLowerCase().includes(lower) \|\| (c.install?.form?.toLowerCase().includes(lower) ?? false)`. A grep finds no call with three arguments: all 6 call sites in `CandidateSelect.tsx` (lines 123, 187, 207, 225, 231, 256) and both in `modal-layout.ts` (175, 203) pass two. Named tests pass: candidate-select "keeps a row matched by its install form visible after Tab undoes it" and modal-layout "matches a row by its command or its install form, toggled or not (WR-04)". The jiti spot-check on the real module gives `brew` and `BREW` → `['fd -e ts']` and `ls` → `['ls -la']`. Enter still inserts `displayedCommand(selected, installToggled)`, so it inserts exactly what the row shows. |
| aa55dd5 | APT_PACKAGES kubectl → null, so planInstall blocks it as `unknown-package` | `tool-awareness.ts:125` is `['kubectl', null]` with a comment. Spot-check: `packageFor('kubectl','apt')` → `null`. `planInstall('kubectl get pods',['kubectl'],'apt')` → `{form:null,packages:[],blocked:'unknown-package'}`. brew is unchanged: `brew install kubernetes-cli && kubectl get pods`. dnf `kubernetes-client` and pacman `kubectl` are unchanged. The row is still flagged ⓘ, because `explanationText` depends only on `missingTools`. The legend drops the Tab clause when no visible row has an install form (`modal-layout.ts:25-30`). Named tests pass: "uses each Linux manager its own package names (WR-01)" and the blocked-plans group. |
| 33cab84 | Backlog item 999.1 committed | `.planning/ROADMAP.md` has "Phase 999.1: Model-supplied install package names (BACKLOG)", which says it "Replaces the hand-typed Linux alias names (phase 9 WR-01)". |

### Observable Truths (ROADMAP success criteria, the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC-1: A tool installed earlier in the same shell session is treated as installed on the next `??` without restarting the shell | ✓ VERIFIED | `queque.zsh:50`: `rehash` runs unconditionally on every enabled call, before the three `print -rl` writes (52-54). The behavioural test `tests/zsh-widget.test.ts` "SC-1: lists a tool created after the hash table was primed" passed in this run (46/46). It also passed the human checkpoint on 2026-10-10. |
| 2 | SC-2: The widget handoff adds no more than about 10 ms to `??` startup with about 2k PATH commands | ✓ PASSED (override) | Override: the user accepted 12.37 ms on 2026-10-10. Recorded medians are 10.10 ms (`zsh -f`) and 12.37 ms (real interactive shell), with 2,175 commands, at load average 20–40. The automated guard "median of 5 handoffs under zsh -f stays below the 25 ms guard (D-19)" passed in this run at load average 37–40. The cost is the lazy re-hash during the first `${(k)commands}` expansion, which SC-1 requires; `rehash` itself costs 0.1–0.5 ms. |
| 3 | SC-3: A candidate that uses a tool not in `$commands` is shown with a "not installed" flag naming the tool; it remains selectable and insertion-only | ✓ PASSED (override, naming clause only) | **Flag (verified):** `explanationText` puts ⓘ before the explanation of any row whose `missingTools` is non-empty (`modal-layout.ts:14-19`, rendered at `CandidateSelect.tsx:279-289`). `missingToolsLegend` renders `ⓘ not installed[ · tab prepends the install command]`. **Selectable and insertion-only (verified):** Enter calls `onSelect(displayedCommand(...))` and nothing executes. `annotateCandidates` maps 1:1, with no drop or re-sort. Tests: client-result "case A: flags a missing tool from a real zsh handoff, keeps order, inserts verbatim", plus candidate-select. **Naming clause:** overridden, because the user accepted the design on 2026-10-10 (the legend names no tools, so the modal height is selection-independent). |
| 4 | SC-4: Builtins, reserved words, `<placeholders>`, `$VAR` commands and path commands (`./x.sh`) are never flagged | ✓ VERIFIED | The command-words tests passed in this run: all 40 spike cases plus review cases, with builtins from a real `zsh -f` listing. Spot-checks from the previous round (unchanged, since neither new commit touches the lexer): `cd <dir> && ls`, `$EDITOR file.txt`, `./x.sh --flag`, `<tool> --help`, `for f in *; do echo $f; done`, `~/bin/foo`, a heredoc body and the function-only `nvm use 20` all give `[]`. Builtins come from builtins.txt, never a hardcoded list. |
| 5 | SC-5: Malformed model output never hangs or crashes command-word extraction (fuzz test with a hard per-input timeout) | ✓ VERIFIED (test is flaky under load; bug-206 tracked) | This run: in-process jiti benchmark on the real `extractCommandWords` over the 10 crafted inputs that timed out in vitest (`rg 'open`, `echo $(date`, `((((((`, `>`, `&&&&`, `${`, `<placeholder`, `` x ` ``, `a'`, `a "b\`). Worst case was 0.0168 ms per input over 1000 iterations, with no throw and no `undefined` words. The 20k and 5k child-process fuzz cases passed. The 10 crafted-case failures are the 1 s child-spawn bound at load average 37 (bug-206), not lexer time. `extractCommandWords` has a try/catch, an 8192-character cap and a depth cap of 32. |
| 6 | SC-6: The prompt includes only the installed ∩ curated-catalog tool list (not the full `$commands` list), across every provider adapter | ✓ VERIFIED | The client sends `installedCatalogTools(isInstalled)` validated by `strictInstalledToolsChunkSchema` (`run-foreground.ts:68-70`). The daemon's lenient schema filters to CATALOG_SET. `buildSystemPrompt` (`steering.ts:43`) re-filters to CATALOG. Both prompt-building adapters use it: `claude.ts:172` `system: buildSystemPrompt(envelope)` and `claude-cli.ts:28` `--system-prompt`. Tests passed in this run: steering (adapters guard), client-result "sends only installed catalog tools in the envelope", and the daemon-fetch catalog-drift and malformed-chunk tests. |

**Score:** 6/6 roadmap truths (4 verified on evidence, 2 passed by override); 0 present but behaviour-unverified; 0 failed.

### Plan must-haves (merged; plans cannot reduce roadmap scope)

| Plan | Must-have group | Status | Evidence |
|------|-----------------|--------|----------|
| 09-01 | Handoff shape: three `print -rl`, no loop or sort, unconditional rehash, ERR-trap-safe, failure leaves no files, kill switch at shell and client level, call placed after request.json and before both launches | ✓ VERIFIED | zsh-widget tests 46/46 in this run (shape guard, partial write, unwritable dir, missing dir, kill switch, placement). |
| 09-01 | functions.txt holds function and alias names (no `_` prefix); a function-only `nvm` is never flagged | ✓ VERIFIED | `queque.zsh:54` `${(k)functions:#_*} ${(k)aliases}`; zsh-widget test "D-01 amended". |
| 09-01 | Hardened lexer: Map/Set tables, escape fallback, depth cap 32, 8192-character cap, no throw | ✓ VERIFIED | command-words tests pass; in-process benchmark is clean. |
| 09-01 | Inventory read eagerly after request.json parses; full set never sent over IPC; logs carry counts only | ✓ VERIFIED | `run-foreground.ts:153` reads before `ensureDaemon`. Only the CATALOG-intersected chunk enters the envelope. |
| 09-01 / 09-04 | D-08/D-14/D-11 UI wording (⊘ after the command, selection-dependent footers, `tab install` chips) | ✓ PASSED (override) | Superseded at the checkpoint and accepted as designed by the user on 2026-10-10. Replaced by `MISSING_TOOL_MARK = 'ⓘ'`, `explanationText`, `missingToolsLegend` and a prop-less ControlsLine. |
| 09-01 / WR-02 | Layout estimate mirrors the render; viewport reserve | ✓ VERIFIED | `MODAL_VIEWPORT_LINES = 18`. After 674ca9f, `estimateCandidateSelectLines` uses the same two-argument `filterCandidates` as the render (`modal-layout.ts:175, 203`), so estimate and render agree on the visible rows. modal-layout tests pass. |
| 09-02 | 40 spike cases, token contract frozen, real-source import in the fuzz child | ✓ VERIFIED | command-words.test.ts passes. The fuzz child imports `src/shared/command-words.ts` directly. |
| 09-02 | "every crafted malformed input … finishes in its own child process within a hard 1 s timeout" | ✓ PASSED (override) | Under load, 10 of 36 cases hit the 1 s spawn bound in this run. The user accepted bug-206 as a tracked warning. The lexer work is under 0.02 ms per input. |
| 09-03 | Catalog of 196 names; lenient and strict schemas; steering text for D-15/16/17; byte-identical prompt without a chunk; adapters guard; Phase 8 plan notes; EXTENSIONS.md section | ✓ VERIFIED | steering tests pass. Unchanged since the previous round. |
| 09-04 | Tab and Shift+Tab toggle in place; Enter inserts the shown text; one install step with deduped packages; installer from the handoff; per-installer alias map; unsafe-name, list-op wrap and comment/heredoc blocking; toggle keyed by `candidateKey` and reset on arrival; no auto-run | ✓ VERIFIED | `CandidateSelect.tsx:185-215` (the Tab, Enter and arrow handlers now all use the same two-argument `filterCandidates`, so the selected index means the same row in each). `tool-awareness.ts` planInstall/packageFor. The tool-awareness tests (including apt kubectl → `unknown-package`) and the candidate-select tests pass. |
| 09-04 / WR-04 | Filter and Tab agree on what a row is | ✓ VERIFIED | The user chose "keep the row visible after undoing tab". 674ca9f implements it, and the named tests pass (see above). |
| 09-04 / WR-01 | Linux manager package names | ✓ VERIFIED (accepted for now) | apt kubectl → null (aa55dd5). The remaining hand-typed Linux names are accepted by the user, with backlog phase 999.1 (33cab84) as the follow-up. |
| 09-05 | Envelope carries exactly one validated chunk; pong `installedTools: true`; stale daemon replaced; catalog drift filtered; malformed chunk ignored | ✓ VERIFIED | daemon-bootstrap "replaces a live daemon whose pong lacks installedTools" and the daemon-fetch tests passed in this run. |
| 09-05 | SC-1, kill switch and Zellij behaviour (human-verified) | ✓ VERIFIED | Checkpoint approved on 2026-10-10. SC-1 and the kill switch are also covered by automated tests. |
| 09-05 | SC-2 numbers recorded | ✓ VERIFIED | `zsh -f` 10.10 ms; real shell 12.37 ms (accepted, see the override). |
| 09-05 | "`pnpm test:run` exits 0" | ✓ PASSED (override) | Environment-dependent (bug-206). Every phase test file passes. `claude-exec.test.ts` passes when run alone (2/2). |

### Prohibitions

| Prohibition | Tier | Disposition | Evidence |
|-------------|------|-------------|----------|
| MUST NOT drop or re-sort a flagged candidate | test | VERIFIED | `annotateCandidates` maps 1:1; client-result case A asserts order. 674ca9f only widens the filter match; it never drops a row on toggle. |
| MUST NOT discover installed tools from Node | test | VERIFIED | `src/` has no PATH, readdir, watch or which discovery; zsh-widget shape guard. |
| MUST NOT add a third-party shell parser dependency | test | VERIFIED | package.json has none. |
| MUST NOT let the handoff helper return non-zero to the widget | test | VERIFIED | ERR-trap tests passed. |
| MUST NOT change lexHand op/redir/comment token values | test | VERIFIED | Token-contract tests passed. |
| MUST NOT put the full installed list, function/alias names or non-catalog names in a prompt | test | VERIFIED | Strict and lenient schemas plus the steering re-filter; client-result asserts the absence of non-catalog names. |
| MUST NOT steer through sampling parameters | test | VERIFIED | None in `src/providers`. |
| MUST NOT auto-run an install or the command | test | VERIFIED | Tab only changes the shown text; Enter calls `onSelect` (replace-buffer). A blocked plan (apt kubectl) offers no form at all. |
| MUST NOT let a quoted or metacharacter word into the installer args | test | VERIFIED | The `SAFE_PACKAGE_NAME_RE` gate makes `planInstall` return `unsafe-package-name`. |
| MUST NOT emit a brace-wrapped form for a command with a comment or heredoc | test | VERIFIED | Blocked-plans tests passed in this run. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shell/zsh/queque.zsh` | `_qq_write_tool_handoff` and its call in the widget | ✓ VERIFIED | Lines 44-60 and 250 |
| `src/client/tool-handoff.ts` | `readToolHandoff`, `TOOL_HANDOFF_FILES` | ✓ VERIFIED | Imported by run-foreground |
| `src/shared/command-words.ts` | Hardened lexer | ✓ VERIFIED | Unchanged since the previous round |
| `src/shared/tool-awareness.ts` | Inventory, `isInstalled`, `missingTools`, `annotateCandidates`, install plan | ✓ VERIFIED | aa55dd5: APT kubectl → null |
| `src/shared/tool-catalog.ts` | CATALOG (196), `installedCatalogTools` | ✓ VERIFIED | |
| `src/contracts/request.ts` | Lenient chunk variant and strict schema | ✓ VERIFIED | |
| `src/providers/steering.ts` | `QUEQUE_SYSTEM`, `buildSteeringText`, `buildSystemPrompt` | ✓ VERIFIED | Used by claude.ts and claude-cli.ts |
| `src/ui/modal-layout.ts` | Mark, legend, `candidateKey`, `filterCandidates`, estimate | ✓ VERIFIED | 674ca9f: two-argument filter on command or install form |
| `src/ui/CandidateSelect.tsx` | Mark, legend, Tab toggle | ✓ VERIFIED | All handlers and the render use the same filter |
| `src/ui/ControlsLine.tsx` | (was: `tabHint` chips) | ✓ PASSED (override) | Prop-less by user request (88b08dc) |
| `src/contracts/ipc.ts`, `src/daemon/server.ts`, `src/daemon/bootstrap.ts` | installedTools capability | ✓ VERIFIED | |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| queque.zsh | tool-handoff.ts | Fixed sibling files commands/builtins/functions.txt | ✓ WIRED |
| run-foreground.ts | tool-handoff.ts | `readToolHandoff(path.dirname(requestFile))` (line 153) | ✓ WIRED |
| run-foreground.ts | tool-awareness.ts | `annotateCandidates(candidates, toolInventory)` (line 328) | ✓ WIRED |
| tool-awareness.ts | command-words.ts | `extractCommandWords`; `lexHand` for the install form | ✓ WIRED |
| run-foreground.ts | tool-catalog.ts / request.ts | `installedCatalogTools(...)` validated by `strictInstalledToolsChunkSchema.safeParse` (lines 68-70) | ✓ WIRED |
| run-foreground.ts | daemon / fallback adapter | Same envelope on both paths | ✓ WIRED |
| claude.ts / claude-cli.ts | steering.ts | `buildSystemPrompt(envelope)` (claude.ts:172, claude-cli.ts:28) | ✓ WIRED |
| bootstrap.ts | server.ts | pong `installedTools` handshake | ✓ WIRED |
| CandidateSelect.tsx | modal-layout.ts | `filterCandidates(candidates, query)` in render and in every key handler; the layout estimate uses the same call | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| CandidateSelect ⓘ mark | `candidate.missingTools` | `annotateCandidates`, from the zsh handoff files | Yes. client-result case A uses a real `zsh -f` handoff | ✓ FLOWING |
| CandidateSelect install form | `candidate.install.form` | `planInstall` with the installer from the handoff | Yes; apt kubectl correctly yields none | ✓ FLOWING |
| System prompt steering | `installed-tools.payload.tools` | handoff → `isInstalled` → CATALOG intersection → envelope → IPC or fallback → `buildSystemPrompt` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks (this run, load average 24–40)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase unit suites | `vitest run` over 12 files (tool-awareness, tool-handoff, command-words, steering, candidate-select, modal-layout, controls-line, client-result, daemon-bootstrap, daemon-fetch, claude-provider, claude-cli-provider) | 312/312 passed | ✓ PASS |
| New-commit named tests | `vitest run -t` for "keeps a row matched by its install form visible after Tab undoes it", "matches a row by its command or its install form", "uses each Linux manager its own package names", "blocked plans" | 9/9 passed | ✓ PASS |
| Handoff, freshness, ERR-trap, kill switch, timing guard | `vitest run tests/zsh-widget.test.ts` | 46/46, including the 25 ms median guard | ✓ PASS |
| Lexer fuzz (child process) | `vitest run tests/command-words-fuzz.test.ts` | 20k and 5k fuzz passed; 10 crafted cases hit the 1 s spawn bound at load average 37 | ⚠ FLAKY (bug-206, accepted) |
| Lexer cost per crafted input | jiti in-process benchmark, 1000 iterations | Worst case 0.0168 ms; no throw, no undefined | ✓ PASS |
| kubectl and filter on real modules | jiti script: `packageFor`, `planInstall`, `filterCandidates` | apt → null/`unknown-package`; brew → kubernetes-cli; filter `brew`/`BREW` → flagged row, `ls` → `ls -la` | ✓ PASS |
| claude-exec alone | `vitest run tests/claude-exec.test.ts` | 2/2 | ✓ PASS |
| Typecheck | `npx tsc --noEmit` | exit 0 | ✓ PASS |

### Probe Execution

Not applicable. No phase plan declares a probe, and the repo has no `scripts/*/tests/probe-*.sh`.

### Requirements Coverage

The SC-1 to SC-6 IDs in the PLAN frontmatter are the ROADMAP success criteria. ROADMAP lists Phase 9 "**Requirements**: TBD". `.planning/REQUIREMENTS.md` has no Phase 9 rows, so no requirement is orphaned.

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| SC-1 | 09-01, 09-05 | Same-session install seen without a shell restart | ✓ SATISFIED | Truth 1 |
| SC-2 | 09-01, 09-05 | Handoff about 10 ms or less | ✓ SATISFIED (override: 12.37 ms accepted) | Truth 2 |
| SC-3 | 09-01, 09-04 | Flag naming the tool; selectable; insertion-only | ✓ SATISFIED (override on the naming clause) | Truth 3 |
| SC-4 | 09-01, 09-02 | Builtins, reserved words, placeholders, `$VAR` and paths never flagged | ✓ SATISFIED | Truth 4 |
| SC-5 | 09-02 | No hang or crash on malformed input | ✓ SATISFIED | Truth 5 |
| SC-6 | 09-03, 09-05 | Only installed ∩ catalog in the prompt, every adapter | ✓ SATISFIED | Truth 6 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (files changed by 674ca9f and aa55dd5) | — | TBD, FIXME or XXX | — | None found (grep exit 1) |
| src/daemon/server.ts | 24 | `TODO(CR-005)` | ℹ️ Info | Pre-existing, not from this phase |
| tests/command-words-fuzz.test.ts | 105 | 1 s hard timeout includes Node spawn time | ⚠️ Warning (tracked, bug-206) | Goes red under load although lexer work is under 0.02 ms. The user decided on 2026-10-10 that it is not a phase gap. Fix idea: time the lexer inside the child and raise the hard kill to a few seconds. |
| tests/modal-layout.test.ts | 1 | Biome `noUnusedImports` (`afterEach`, `beforeEach`, `vi`) | ℹ️ Info | Pre-existing (674ca9f's diff does not touch the import line); a warning, not an error |
| src/ui/CandidateSelect.tsx | 136 | Biome `suppressions/unused` on the layout-effect `biome-ignore` | ℹ️ Info | Pre-existing (not in 674ca9f's diff); a warning, not an error |
| src/shared/command-words.ts | — | A lone `\` command yields an empty external word `""` | ℹ️ Info | Cosmetic; install is blocked as `unsafe-package-name` |
| src/shared/tool-awareness.ts | — | Remaining hand-typed Linux alias names (WR-01) | ℹ️ Info | Accepted by the user for now; backlog phase 999.1 replaces them with model-supplied names |
| (review) | — | IN-01 to IN-05 open in 09-REVIEW-DISPOSITION | ℹ️ Info | Lexer false negatives undocumented, function definitions flag their name, legend estimate width, `ps` visibility of catalog names for `claude -p`, marker-based adapters guard. None affects a success criterion. |

### Advisory (New Scope, Unevidenced)

None.

### Human Verification Required

None. Every item from the previous report is resolved:

1. **SC-3 naming:** override recorded (the user accepted it as designed).
2. **SC-2 timing:** override recorded (the user accepted 12.37 ms).
3. **WR-01 Linux names:** kubectl fixed (aa55dd5); the rest are accepted, with backlog 999.1 as the follow-up.
4. **WR-04 filter:** the user's choice is implemented and tested (674ca9f).

### Gaps Summary

No gaps. The phase goal's mechanism is in the codebase, wired and behaviourally tested:

- **Freshness:** zsh `rehash` handoff.
- **Flagging:** missing tools are flagged without being dropped, and Tab no longer changes which rows are visible.
- **Steering:** the catalog-only list reaches both prompt-building adapters through `buildSystemPrompt`.
- **Compatibility:** the stale-daemon capability bump.

Neither new commit introduced a regression. typecheck is clean, all 12 phase unit files pass (312 tests), and the zsh widget suite passes (46).

**Tracked warning (not a gap, by user decision):** bug-206. The fuzz file's 1 s per-input bound counts Node spawn time, so it goes red at high load average.

**Follow-up (not a gap):** backlog phase 999.1 replaces the hand-typed Linux package names with model-supplied names.

Whether the model actually *favours* installed tools depends on the model following the steering prompt. The code guarantees that the prompt carries the list and the prefer-installed rules. The live checkpoint was approved; there is no automated test of model compliance, nor could there reasonably be one.

---

_Verified: 2026-10-10T21:00:37Z_
_Verifier: Claude (gsd-verifier)_
