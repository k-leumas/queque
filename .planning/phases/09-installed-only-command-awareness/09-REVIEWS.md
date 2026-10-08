---
phase: 9
reviewers: [cursor, claude]
reviewed_at: 2026-10-08T06:55:19Z
plans_reviewed: [09-01-PLAN.md, 09-02-PLAN.md, 09-03-PLAN.md, 09-04-PLAN.md, 09-05-PLAN.md]
models:
  cursor: "unknown"
  claude: "unknown"
model_sources:
  cursor: "unknown"
  claude: "unknown"
---

# Cross-AI Plan Review — Phase 9

<!-- gsd:plan-revision-conflicts:begin -->
## Plan-Revision Conflicts
<!-- gsd:plan-revision-conflicts:end -->

> **Lanes:** Codex was selected (`--all`) but dropped — the account hit its usage limit (resets 2026-11-04); its stub is in `.review-diagnostics/`. Ollama was skipped at the user's request. Claude was added at the user's request as a separate headless session (normally skipped for independence because the orchestrator is also Claude).

## Cursor Review

# Cross-AI Plan Review — Phase 9 (Installed-Only Command Awareness)

Verified against repo at `/Users/samuel/dev/tui-llm` (HEAD seams cited below). Plans map cleanly to SC-1..SC-6 and D-01..D-19; the main risks are execution size in the tracer, one wrong catalog count, Tab/`ControlsLine` test gaps, and the known `⊘` width assumption.

---

## 09-01

### Summary

Wave-1 tracer is the right shape: fixed sibling handoff files (no `shellRequestSchema` version bump), client-only inventory, UI-local `DisplayCandidate`, and no IPC candidate-contract change. Line anchors in the plan match the code (`run-foreground.ts:97-98,196,280-284`, `CandidateSelect.tsx:21,86-87,254-256,236`, `queque.zsh:189-213,254,273`). Task 1 is large and ships an unproven lexer port before 09-02’s fuzz net.

### Strengths

- Placement of `_qq_write_tool_handoff "$tmpdir"` after the `JSON` heredoc (`queque.zsh:213`) and before both Zellij and inline launches matches how the widget already builds `qq_cmd` at `queque.zsh:220`.
- Correctly avoids Node PATH scanning; `fs/promises` for the reader avoids the narrow `node:fs` mock in `tests/client-result.test.ts:92-95`.
- Keeps `commandCandidateSchema` untouched (`src/contracts/candidates.ts:3-6`); flags stay UI-local.
- D-01 amended (functions/aliases) and D-19 (always-`rehash`, &lt;25 ms median guard) are encoded in must-haves and Task 2 tests.
- Annotates after `fetchCandidatesForUi` and before `app.rerender` at the real hook (`run-foreground.ts:280-284`).
- Threat model T-09-01..T-09-03 matches cerebrum (indexOf clamp, Map `WRAPPERS`, counts-only logs, chmod-700 session dir).

### Concerns

- **HIGH — Task 1 is one mega-tracer.** It ports the full hand lexer, handoff, awareness, UI marks, layout, and e2e tests in one commit unit. A hang or Map/`indexOf` miss lands before 09-02’s child-process net (`extract.mjs:114,210` still uses plain-object `WRAPPERS[w]`).
- **MEDIUM — `MODAL_VIEWPORT_LINES` is a fixed scroll reserve, not `estimateCandidateSelectLines`.** Plan raises 16→20 (`run-foreground.ts:196-199`); Zellij uses `onLayoutLinesChange` (`:237`). Dual footers need both paths updated or inline scroll still clips.
- **MEDIUM — Glyph `⊘` width is assumed single-column.** Research A2; East Asian Width is Ambiguous. Misalignment is deferred to the 09-05 human check.
- **LOW — `functions.txt` holds functions and aliases.** Documented, but easy for a later reader to “fix” by splitting files.

### Suggestions

- Keep Task 1 production-complete but treat lexer hardening (Map/`indexOf`/depth/cap) as non-negotiable before commit; do not leave “09-02 will fix hangs” as an escape hatch for known spike bugs.
- Assert in Task 2’s shape guard that the helper body has exactly three `print -rl --` redirects and an unconditional `rehash` (already planned).
- In Task 3, assert dual-footer layout estimate when both destructive and `missingTools` are set (+4 vs baseline).

### Risk Assessment

**MEDIUM.** Design and seam choices are strong; risk is concentrated in Task 1 size and shipping the lexer before the fuzz harness.

---

## 09-02

### Summary

Lexer proof plan is appropriately narrow: port all 40 spike cases, fuzz in a child with hard timeouts, import the real `src/shared/command-words.ts` under Node 24 type stripping (`.nvmrc` = `24.14.1`). This is what makes SC-5 real.

### Strengths

- Cases source matches spike (`cases.mjs` has 40 entries; stretch cases at lines 41–43).
- `find-hang.mjs` crafted list is the right regression set; plan adds the minimal backtick-in-double-quotes repro.
- Child `spawnSync(..., { timeout })` is the correct hang detector (in-process timers cannot stop a sync infinite loop).
- Zero-import / erasable-syntax constraint matches the Node 24 import strategy already recorded in cerebrum.
- Prototype-key cases (`constructor`, `toString`, `__proto__`) lock the Map-based `WRAPPERS` fix from 09-01.

### Concerns

- **MEDIUM — 20k + 5k fuzz in the default suite.** Fine for correctness; can add noticeable CI time. Soft 250 ms per-input budget may flake on loaded runners even when correct.
- **MEDIUM — Deep-nesting `&lt;100 ms` for `deep 2000` can be environment-sensitive.** Same class of flake risk as the handoff timing guard.
- **LOW — Plan says “37 core + 3 stretch”.** Spike comments say stretch is nice-to-have; plan still requires all 40 to pass (good), but wording could confuse an executor into skipping stretch.

### Suggestions

- Keep fuzz in `pnpm test:run`, but log seed and last stderr JSON on failure (already planned via `writeSync(2, …)`).
- If deep/fuzz flakes appear, raise budgets slightly while keeping hard kill timeouts (do not drop child-process isolation).
- Assert `extractCommandWords` (wrapper) never throws while raw `commandWords(lexHand(...))` is what the fuzz child uses to surface throws — already specified; keep that distinction in test names.

### Risk Assessment

**LOW–MEDIUM.** Scope is right; residual risk is CI timing flake, not design.

---

## 09-03

### Summary

Steering plan correctly introduces the catalog allow list, a refine-guarded `installed-tools` chunk on `contextChunkSchema` (`request.ts:74-94` today is git+filesystem only), and `buildSystemPrompt` without sending the chunk yet — matching the research pitfall that old daemons silently drop bad IPC (`server.ts:61-65`). Claude paths today use static `QUEQUE_SYSTEM` (`claude.ts:174`, `claude-cli.ts:31-32`); wiring them through the builder is correct. No OpenAI/Ollama files exist under `src/providers/` yet, so the adapters guard is the right D-18 bridge.

### Strengths

- Schema refine + `buildSteeringText` re-filter is defense in depth for D-04.
- Moving `QUEQUE_SYSTEM` to `steering.ts` and re-exporting from `claude.ts` avoids import cycles and keeps Phase 8 importers compiling.
- Explicitly leaves `buildPrompt` user JSON alone (Pitfall 8); `buildPrompt` already only reads git/filesystem (`claude.ts:110-133`).
- `filterContextEnvelope` already passes non-git chunks through (`privacy-filter.ts:28-29`), so installed-tools survives filtering.
- Docs + static `adapters` scan encode D-18 before OpenAI/Ollama land.

### Concerns

- **HIGH — Catalog size claim is wrong.** Plan/tests require **196** names. Spike `catalog.ts` splits to **195** unique tokens (lines 6–33). A `toHaveLength(196)` test will fail until the number is corrected.
- **MEDIUM — Adapters guard is heuristic** (`messages.create`, `--system-prompt`, `/api/chat`, `chat/completions`). A future adapter using another client shape can bypass it; EXTENSIONS.md helps but is not enforcement.
- **MEDIUM — Shipping the schema in Wave 2 before the 09-05 capability flag is intentional and safe only while clients do not send the chunk.** Executor must not “helpfully” push the chunk early.
- **LOW — Catalog includes names like `time`, `cut`, `ping` that overlap reserved/common utilities.** Harmless for flagging (lexer kinds), mild steering noise.

### Suggestions

- Fix must-haves/tests to assert `CATALOG.length === 195` (or re-count after any catalog edit) before Task 1 goes green.
- Keep Task 2’s “if ollama/openai exist, wire them” branch; directory listing today confirms they are absent.
- Add an assertion that `buildPrompt(envelopeWithInstalledTools)` user content does not contain the steering sentences (only `system` does).

### Risk Assessment

**MEDIUM.** Privacy architecture is excellent; the hard-coded 196 count is a concrete plan bug that will block TDD.

---

## 09-04

### Summary

Tab install form plan correctly extends `tool-awareness` / `CandidateSelect` / `ControlsLine` without changing `run-foreground`’s `annotateCandidates` call site (defaulted `platform` param). It respects Ink Tab behavior, useState mock call-order (`candidate-select.test.tsx:63-73`), destructive-on-displayed-text for `sudo` installers (`qq-config.ts` includes `\\bsudo\\b`), and install-form injection guards (`SAFE_PACKAGE_NAME_RE`, brace-wrap for `;`/`||`/`&`).

### Strengths

- Toggle keyed by `candidateKey` matching existing row key `` `${command}::${explanation}` `` (`CandidateSelect.tsx:236`).
- Third `useState` after `query` with eager `new Set()` matches cerebrum Pitfall 3.
- Tab handled before return/generic input; Enter uses displayed command; `see man` fallback from original command (`CandidateSelect.tsx:170`).
- No `-y`/`--noconfirm` keeps package managers interactive (D-11 / research A3).
- Unsafe quoted words block the form rather than entering argv-like package lists (T-09-10).
- Separate `controls-line.test.tsx` is required because `ControlsLine` is mocked to `() => null` in `candidate-select.test.tsx:44-45`.

### Concerns

- **HIGH — Install-form metacharacter / list-operator handling is easy to get subtly wrong.** Brace rules for trailing `&` vs `;`, and not wrapping pipelines, depend on `lexHand` op tokens (`interfaces` claim newline→`;`). Needs the planned exact-string tests; do not improvise.
- **MEDIUM — No CandidateSelect→ControlsLine prop assertion.** With `ControlsLine` mocked away, `tabHint` wiring can regress unless the mock is updated to capture props or a shallow render asserts them.
- **MEDIUM — Brew-centric `PACKAGE_ALIASES` on apt (research A6).** Accepted by D-12, but `rg→ripgrep` etc. will be wrong on Debian; failures are user-visible only after Enter+run.
- **LOW — Shift+Tab = toggle** may surprise users who expect unindent; acceptable given terminal constraints (D-09).

### Suggestions

- Change the ControlsLine mock to record last props so Tab tests assert `tabHint: 'install' | 'undo install' | undefined`.
- Keep exact form strings in acceptance criteria (`brew install ripgrep && rg TODO -t ts`, wrapped `{ cd src; fd x; }`).
- Confirm `buildShellBuffers('brew install fd && fd <pattern>', …)` cursor behavior (`run-foreground.ts:26-39`) stays as planned.

### Risk Assessment

**MEDIUM.** UX/security design is solid; highest risk is implementer error in wrap/package rules and untested `tabHint` wiring.

---

## 09-05

### Summary

Wave-3 correctly closes SC-6: client appends a schema-validated `catalog ∩ installed` chunk, daemon advertises `installedTools`, and `pingDaemonFetchCap` requires both flags — mirroring the existing `fetchCandidates` stale-daemon pattern (`bootstrap.ts:45-89,211-216`, `ipc.ts:34-37`, `server.ts:72`, `FETCH_ACK_MS = 800` in `fetch-client.ts:9`). Human checkpoint covers SC-1/SC-2 evidence the automated suite cannot fully own.

### Strengths

- Capability bump before sending the chunk is the only safe upgrade path given silent `safeParse` drops (`server.ts:61-65`).
- `ensureDaemon` runs before fetch in `run-foreground.ts:108`, so replacement precedes any steered envelope.
- Client `contextChunkSchema.safeParse` before send + daemon refine + `buildSteeringText` re-filter = three layers for D-04.
- Tests for legacy pong-with-only-`fetchCandidates`, both-flags keep, unanswered ping keep, and non-catalog chunk → `/not accepted/` mirror existing bootstrap patterns (`daemon-bootstrap.test.ts:80-109,192`).
- In-process fallback receives the same envelope (`fetch-client.ts:143`), so steering is not daemon-only.
- Kill switch / missing handoff → no chunk → byte-identical `QUEQUE_SYSTEM` preserves Phase 8 behavior.

### Concerns

- **MEDIUM — Task 2 extends the 09-01 real-zsh handoff describe heavily** (add `fd` binary + `nvm` function, envelope assertions, `buildSystemPrompt`). Brittle if earlier plans drifted filenames or inventory shape.
- **MEDIUM — Human checkpoint is blocking and necessary**, but SC-1/SC-2/glyph/`nvm` depend on the user’s machine and attention; automation already covers most mechanics.
- **LOW — Debug log `{ steered: count }` only** is correct; ensure no accidental tool-name logging when validation fails.

### Suggestions

- Implement Task 1 (capability) before Task 2 (chunk send) exactly as ordered — never reverse.
- In the non-catalog daemon test, assert failure in &lt;2000 ms (ack is 800 ms) and `fetchMock` not called.
- Record handoff median from `handoff timing` into SUMMARY/VERIFICATION as the plan requires (D-19).

### Risk Assessment

**LOW–MEDIUM.** This is the integration plan the research called for; residual risk is sequencing discipline and human-verify variance.

---

## Cross-plan / phase assessment

### Coverage vs success criteria

| SC | Primary plans | Verdict |
|----|---------------|---------|
| SC-1 freshness | 09-01 Task 2, 09-05 human | Covered |
| SC-2 timing | 09-01 D-19 guard + 09-05 record | Covered (guard 25 ms, not hard 10 ms — intentional) |
| SC-3 flag + selectable | 09-01, 09-04 Tab | Covered |
| SC-4 kinds / builtins | 09-01, 09-02 table | Covered |
| SC-5 no hang | 09-02 fuzz | Covered |
| SC-6 catalog∩installed everywhere | 09-03 builder, 09-05 wire | Covered |

### Wave ordering

Wave 1 tracer → Wave 2 (lexer proof ∥ steering schema ∥ Tab UX) → Wave 3 (capability + send + UAT) is correct. Delaying chunk **send** until the pong flag exists is the phase’s most important architectural call.

### Agreed top fixes before execute

1. Correct catalog length **195** (not 196) in 09-03 must-haves/tests.
2. Do not send `installed-tools` from any Wave 2 plan.
3. Capture `ControlsLine` props in CandidateSelect tests (09-04).
4. Treat 09-01 Task 1 lexer hardening as blocking, not deferrable to 09-02.

### Overall phase risk

**MEDIUM.** Plans are unusually well grounded in verified seams and spike evidence. They achieve the phase goal without scope creep (no auto-exec, no full `$commands` in prompts, no new npm parsers). Remaining risk is mostly execution: tracer bulk, catalog count typo, install-form edge cases, and Tab hint test gaps — not a wrong product design.


---

## Claude Review

# Phase 9 plan review: installed-only command awareness

I checked each plan against the source at HEAD (`e2c9df2`). The plans' interface blocks say they were verified at `6579d10`, but the line numbers they cite still match the current code. I couldn't run the test suite in this session because the commands needed approval. Where a finding depends on runtime behaviour, I say so.

## 09-01

**Summary.** The tracer covers the right path: zsh handoff, then the reader, then the lexer port, then annotation, then the ⊘ flag. The integration points are accurate. The UI, layout and test details are well thought through. The main risks are three things the plan doesn't mention: the widget's existing `ERR` trap, a small bug carried over from the spike lexer, and the size of Task 1.

**Strengths**
- The anchors are correct:
  - `queque.zsh:189-191` creates the session directory.
  - `:213` ends the heredoc.
  - `:220` is `local -a qq_cmd`.
  - `:254` and `:273` are the two launch sites.
  - `run-foreground.ts:280-284` is the rerender hook.
  - `:196` is `MODAL_VIEWPORT_LINES = 16`.
  - `CandidateSelect.tsx:254-256` is the inline mark and `:277-281` is the footer.
- The handoff is called after the heredoc and before the `qq_cmd` block, so both the Zellij and inline branches see the files. Pitfall 7 (reading eagerly) is handled.
- Using `Map`/`Set` for word-keyed tables is necessary. The spike's `WRAPPERS[current]` and `WRAPPERS[w]` lookups (`extract.mjs:182,210`) and `WRAPPERS[wrapper.name].has` (`:174`) do return `Object.prototype` members for words like `constructor`.
- The plan respects the `useState` call-order constraint: no new state in 09-01, and later state goes third. The `candidate-select.test.tsx:63-74` mock stores the initial value as given.
- Making `filterCandidates` generic is the right fix. Today its type is `CandidateList → CandidateList` (`modal-layout.ts:57`), which would drop `missingTools` at the type level.
- The tracer test writes real zsh handoff files instead of stubs, which follows the cerebrum no-stub rule.
- The comment above the helper is told not to spell out the forbidden zsh syntax, so the static shape test can't trip on its own comment.

**Concerns**
- **MEDIUM: the widget's `ERR` trap turns any non-zero status in the handoff into a broken `??`.**
  - `queque.zsh:195` sets `trap "_qq_cleanup '$tmpdir'" EXIT ERR INT`. That trap is global and fires on any failing simple command, including ones inside called functions.
  - If `zmodload zsh/parameter` fails (a minimal build without the module) or a write fails (disk full), `_qq_cleanup` deletes the session directory, including `request.json`, and resets the traps. The client then launches against a missing request file.
  - That breaks the plan's own fallback rule ("never error the `??` request"). No test sets an `ERR` trap.
- **LOW: a bug in the spike lexer will be ported verbatim.** At `extract.mjs:77`, `v += s[++i]` inside double quotes appends the string `"undefined"` when the input ends in a backslash. For example, `"rg\` lexes as the command word `rgundefined`. That word is flagged, and it also passes `SAFE_PACKAGE_NAME_RE`, so in 09-04 the install form would read `brew install rgundefined`. Line 69 already guards the same case with `?? ''`; line 77 doesn't.
- **LOW: the clamp "audit" is mostly done already.** Every `indexOf` site in `extract.mjs` (`:15, :32, :71-72, :83, :97`) already clamps. The work that actually matters is the depth cap, the `Map` change, and the `?? ''` fix above.
- **MEDIUM (process): Task 1 is very large.** It touches 9 files and includes the lexer port, the widget, the reader, the UI, the layout, and two test suites. Estimated confidence is "low", and one failure in the middle blocks everything in wave 2. Task 3 is marked `tdd="true"` but tests code that Task 1 already shipped, so its "RED" phase will start green.
- **LOW: the reserved lines grow on every `??`.** Raising `MODAL_VIEWPORT_LINES` from 16 to 20 (`run-foreground.ts:196-199`) scrolls 4 more lines of history on every inline `??`, not just flagged ones. The number is fixed before candidates arrive. It is still too small when an install form wraps, or when commands wrap past one line.
- **LOW: the marks can push a line past the width.** Adding ` ⊘` after the ` ⚠` mark can push a line that is already at `contentWidth` past the modal width. `wrapText` budgets only the command text, so Ink re-wraps the line and the layout estimate drifts. This issue already exists for ⚠ and gets worse with a second mark.
- **LOW: `rehash` has a side effect.** It is `hash -r`, which also clears entries the user added by hand (`hash foo=/opt/x/foo`) on every `??`. The spike notes call this "harmless", which isn't quite true. It should be documented.

**Suggestions**
- Guard the helper's commands with `|| true` (or wrap the body in `{ … } always { … }`), so a handoff failure only means "no files". Add a zsh test that installs an `ERR` trap and runs the helper with a directory that can't be written to.
- In the port, write `v += s[++i] ?? ''`. Add `"rg\` to the robustness cases.
- Split Task 1 into two: (a) the lexer port with its stubs, and (b) widget, reader, annotation and UI.
- Check `QQ_TOOL_AWARENESS=0` in the widget too, and skip writing the files. That saves about 10 ms, and it doesn't depend on whether the environment reaches the Zellij pane (see 09-05).

**Risk: MEDIUM.** The design is sound. The `ERR` trap interaction is the one finding that can break `??` outright.

## 09-02

**Summary.** This plan turns the spike's evidence into regression tests. The case table, the child process with hard timeouts, and importing the real `.ts` source are all correct, and they work in CI: `.nvmrc` pins Node 24.14.1, `release.yaml` installs zsh, and `tsconfig.json` includes `tests/**/*.ts` but not `.mjs`. The gaps are small.

**Strengths**
- The case count is right: 37 core and 3 stretch cases (`cases.mjs`), and the plan asserts 40 explicitly.
- Builtins come from real `zsh -f` output, which matches `run.mjs:8-12`. Cases such as `kill -9 $(lsof …)` depend on `kill` being a zsh builtin.
- The fuzz run calls the raw `commandWords(lexHand())` instead of the try/catch wrapper. A throw therefore shows up as a test failure instead of being swallowed. This is the right choice.
- A seeded PRNG plus a second seed means a failure can be reproduced, which the spike's `Math.random()` (`fuzz-child.mjs:7`) couldn't do.
- The prototype-key robustness cases lock in the `Map` fix from 09-01.

**Concerns**
- **LOW: `spawnSync` has a default output cap.** Its `maxBuffer` defaults to 1 MiB. The child writes every input's JSON to stderr, which is the spike pattern (`fuzz-child.mjs:9`). By my estimate, 20k inputs come to roughly 0.5–0.6 MB of stderr, which is under the cap but only by about 2×. Raising the input count or length later would kill the child with `ENOBUFS` and look like a hang.
- **LOW: the second-seed run has no test timeout of its own.** The plan says it uses "the same assertions" but doesn't give it its own vitest `timeout`. vitest's default is 5 s, so a slow CI runner could time out on Node startup plus 5k inputs.
- **LOW: this runs in parallel with 09-04, which imports `lexHand` op tokens.** Any lexer fix here can change 09-04's `buildInstallForm` results after the merge. The wave-2 merge then needs a full `pnpm test:run` (the plan's sampling already requires one).

**Suggestions**
- Pass `maxBuffer: 16 * 1024 * 1024`, or have the child write only the current input to a file and print the culprit on exit.
- Give every `spawnSync`-based `it` an explicit timeout.
- Add `"rg\` (from 09-01) and an input that ends inside double quotes followed by a backslash to `CRAFTED_MALFORMED`.

**Risk: LOW.**

## 09-03

**Summary.** The steering design is clean. `QUEQUE_SYSTEM` moves into `steering.ts` and is re-exported, so there is no import cycle. `buildSystemPrompt` returns the original prompt byte for byte when no chunk is present. The adapter guard forces D-18 for the Phase 8 adapters. The one structural problem is the daemon-side `refine`: it makes the contents of the catalog part of the IPC contract.

**Strengths**
- The anchors are accurate: `claude.ts:39-40` (the constant), `:174` (`system:`), `claude-cli.ts:31-33`, `request.ts:74-94` (the union).
- The steering text goes only into the system prompt, so `buildPrompt` stays byte-stable (`claude.ts:110-136`). The existing `messages[0].content` assertions keep passing.
- The catalog has 196 entries. I counted them by hand from the spike file and found no duplicates, and every name matches the safe-name pattern.
- There are three layers of protection: the client's `safeParse` (09-05), the schema `refine`, and `buildSteeringText` filtering again against `CATALOG_SET`.
- No sampling parameters, as the cerebrum notes require.

**Concerns**
- **HIGH: catalog changes become a stale-daemon trap.**
  - The `refine` makes the whole `fetch-candidates` line fail `ipcRequestSchema.safeParse` if even one name is unknown. The server then drops the request silently (`server.ts:61-65`).
  - The 09-05 capability is just `installedTools: true`, and it says nothing about catalog contents.
  - So after any future release that adds a catalog name, a still-running older daemon passes the ping (`bootstrap.ts:89, :211-216`), rejects every envelope that includes the new name, and makes every `??` pay the 800 ms ack timeout (`fetch-client.ts:9`) plus a cold in-process fallback (`:139-143`).
  - This is the same failure class as the cerebrum's "stale daemons ignore new IPC" entry, and latency is the product constraint. The reversibility note covers changes to the chunk's shape but not to its contents.
- **MEDIUM: other phases' plans will now fail the guard.** The Phase 8 plans 08-03 and 08-04 (still open) are written to pass `QUEQUE_SYSTEM` straight through. Once this guard lands, they fail CI until they are re-planned. That should be flagged to the 08-03/08-04 plans rather than discovered at execution time.
- **LOW: the catalog isn't what its header says.** It includes basic utilities (`cut`, `ssh`, `scp`, `ping`, `whois`, `traceroute`, `pbcopy`) and the reserved word `time`, even though the header says these are omitted. It also includes package-only names that are never binaries (`bottom`, `httpie`, `git-delta`, `csvkit`, `moreutils`). The cost is a few wasted tokens and a misleading comment.

**Suggestions**
- Make the daemon-side schema lenient: a `transform` that filters to `CATALOG_SET`, not a `refine` that rejects. Keep the strict check in the client before sending.
- Alternatively, add a build or catalog hash to the pong (`build: __QUEQUE_COMMIT__`) and replace the daemon whenever it differs. That removes this whole class of bug for every future envelope change.
- Add a note to 08-03 and 08-04 (or to the roadmap) saying they must call `buildSystemPrompt(envelope)`.
- Clean up the seed catalog, or fix its header comment.

**Risk: MEDIUM.** It works correctly today, but it creates a latency regression that will surface on a future release.

## 09-04

**Summary.** The Tab install form follows D-09 to D-14 closely. The package-name rule, the brace wrapping for lists, the toggle state keyed by candidate, and the explanation fallback built from the original command all show careful thought. The remaining issues are edge cases in the wrapping and gaps in the alias map.

**Strengths**
- `SAFE_PACKAGE_NAME_RE` correctly blocks words that only exist because of quoting. Blocked rows stay flagged and explain why.
- The wrapping logic is correct for the lexer's tokens. `2>&1` doesn't produce an `&` op because the fd-number branch pops it (`extract.mjs:52`), so `nohup … 2>&1 &` wraps as `{ … & }`, which is valid. A plain `&&` chain or pipeline isn't wrapped.
- The toggle is the third `useState`, with a value given directly instead of a lazy initializer, so the test mock at `candidate-select.test.tsx:63-74` keeps working. Toggles are keyed by `candidateKey` and survive filtering.
- The Tab branch returns early, so Tab never reaches the filter. The plan's test with input `'\t'` proves this even on terminals using the Kitty keyboard protocol.
- The destructive check runs on the displayed text, so a `sudo` install form also shows ⚠ (the `\bsudo\b` pattern at `qq-config.ts:23`). This matches D-08.

**Concerns**
- **LOW: wrapping can produce broken shell.** If a candidate contains `#` (a comment) or a heredoc, wrapping it as `{ cmd; }` comments out the closing brace, or moves the heredoc body. The user then lands at a `>` continuation prompt (PS2). The model rarely emits these, and D-07 discourages special-casing, but the result is broken shell rather than a visible failure.
- **LOW: common missing GNU tools on macOS aren't mapped.** `timeout` is missing on macOS. With no alias it becomes `brew install timeout`, which isn't a formula. Mapping `timeout` → `coreutils` (and similar GNU tools) is safe on every platform, because Linux already has these and never flags them.
- **LOW: the Linux path is only checked with injected sets.** CI runs on Ubuntu (`release.yaml:29`), but the tests use injected inventories, so the real `apt`/`sudo` path is never exercised. That's acceptable, but it should be recorded as manual-only.

**Suggestions**
- If `lexHand` saw a comment (the `#` branch at `extract.mjs:32`), or the command contains `<<`, don't wrap. Either block the form or prefix it without braces.
- Add `timeout` → `coreutils` to the alias map, and consider `gdate`/`gsed` → `coreutils`/`gnu-sed`.

**Risk: LOW.**

## 09-05

**Summary.** The ordering is right: the chunk is only sent once the capability bump is in place, so no client sends something an old daemon would drop. The client validates the chunk before sending. The tests cover both shapes of legacy pong and the daemon-side guard. The weak spots are the SC-2 evidence, the kill switch under Zellij, and a non-deterministic human check.

**Strengths**
- `pingDaemonFetchCap` now needs both flags, and an unanswered ping is still treated as "kept". This preserves the test dummy-socket behaviour (`daemon-bootstrap.test.ts:63-78`).
- The chunk goes into the envelope, so the in-process fallback (`fetch-client.ts:143`) gets the same steering as the daemon.
- The end-to-end test checks `buildSystemPrompt` on the envelope the adapter actually received, including the function-only name `nvm`.

**Concerns**
- **MEDIUM: the recorded SC-2 number isn't representative.** Step 6 records the `handoff timing` median from vitest, which runs under `zsh -f` (`zsh-widget.test.ts:36`). There, `${(k)functions}` and `${(k)aliases}` are almost empty. In the user's real interactive shell (~494 functions according to research), the handoff costs about 1.6 ms more. The number recorded in VERIFICATION will therefore understate real `??` cost against the ~10 ms target.
- **MEDIUM (open question): the kill switch may not work under Zellij.** `QQ_TOOL_AWARENESS=0` is read in the client. On the Zellij path, the client runs in a pane created by `zellij run` (`queque.zsh:254`). I'm not sure that pane inherits variables exported later in the invoking shell. I couldn't confirm this here; step 7 should be tried with `ZELLIJ` set and unset.
- **LOW: the human check may never show a flag.** Steering (D-15, D-16) actively pushes the model away from missing tools. If the model avoids `dust`, the tester never sees a flagged row, so step 2 is a nondeterministic way to verify the flag, Tab and Enter.
- **LOW: the catalog-drift problem from 09-03 isn't covered.** This task's reversibility note says later envelope changes must bump the capability, but catalog-content changes still need it too.

**Suggestions**
- In step 6, also time `_qq_write_tool_handoff` in the user's actual shell, for example `s=$EPOCHREALTIME; _qq_write_tool_handoff $(mktemp -d); print $(( (EPOCHREALTIME-s)*1000 ))` repeated 5 times. Record both numbers.
- Make the kill switch work in the widget as well (see 09-01), so the check doesn't depend on whether the environment reaches the pane.
- Give the human check a deterministic flagged row. One option is a dev-only fixture mode that injects `{command:'dust .', …}`; another is to accept the steering risk and note it in the checkpoint.

**Risk: LOW–MEDIUM.**

## Cross-plan observations

- **Merge conflicts in wave 2 are certain.** 09-02, 09-03 and 09-04 run in parallel and all edit `.wolf/anatomy.md` and `.wolf/memory.md`; 09-03 and 09-04 both also edit `.wolf/cerebrum.md`. The source files don't overlap, but these will conflict when worktrees merge. Either do the `.wolf/` updates once, after the wave merges, or run wave 2 one plan at a time.
- **Every requirement is covered.** SC-1 to SC-6 and D-01 to D-19 each map to a task. D-13 (keep model order), D-05/D-06/D-07 (no special-casing of install steps) and D-12 (alias map that users can't extend) are followed and not over-built.
- **One fix removes a whole class of bugs.** Advertising the build version in the pong would fix the 09-03 HIGH and every future envelope change, at about the cost of the `installedTools` flag.

## Overall risk assessment: MEDIUM

The plans will achieve the phase goal, and they are unusually well grounded in the actual code. Every anchor I checked matched. Three fixes are worth making before execution:

1. **09-03:** have the daemon filter unknown catalog names instead of rejecting the whole request, or replace the daemon when its build version differs. Otherwise a future catalog edit silently adds 800 ms to every `??`.
2. **09-01:** add `|| true` guards to the handoff helper so the widget's existing `ERR` trap can't delete `request.json`.
3. **09-01:** port `extract.mjs:77` with `?? ''` so `"rg\` doesn't produce the word `rgundefined` and the install form `brew install rgundefined`.

Everything else is LOW, apart from the MEDIUM process issues: wave-2 `.wolf/` conflicts, the size of 09-01 Task 1, the unrepresentative SC-2 measurement, and the open question about the kill switch under Zellij.



---

## Consensus Summary

Both reviewers checked the plans against the source and cited `file:line` evidence; both rate the phase **MEDIUM** overall, say every anchor they checked matches HEAD, and find SC-1..SC-6 and D-01..D-19 fully covered without scope creep.

### Agreed Strengths
- The tracer's integration points are accurate (`queque.zsh:189-213,220,254,273`, `run-foreground.ts:196,280-284`, `CandidateSelect.tsx:254-256`), and the handoff call sits before both the Zellij and inline launches.
- `Map`-based `WRAPPERS` is a required fix: the spike's plain-object lookups return `Object.prototype` members for words like `constructor`.
- The `useState` call order is respected (toggle is the third state, eager initial value), and the toggle is keyed by `candidateKey`.
- The child-process fuzz with hard `spawnSync` timeouts is the correct way to catch sync hangs, and the fuzz calls the raw lexer, not the try/catch wrapper.
- Moving `QUEQUE_SYSTEM` into `steering.ts` avoids the import cycle; steering stays in the system prompt so `buildPrompt` is byte-stable.
- Sending the chunk only after the `installedTools` pong capability (09-05) is the phase's most important ordering call, and the in-process fallback gets the same envelope.
- `SAFE_PACKAGE_NAME_RE` and the brace wrapping for list operators are sound protection for the install form.

### Agreed Concerns (highest priority)
1. **09-01 Task 1 is too large** (both MEDIUM–HIGH). It ships the full lexer port, widget, reader, annotation, UI and layout in one task before 09-02's fuzz net. Cursor: treat the lexer hardening as blocking within Task 1. Claude: split it into lexer port + stubs, then widget/reader/UI; Task 3's `tdd` RED will start green.
2. **Fixed `MODAL_VIEWPORT_LINES` and line-width drift** (both MEDIUM/LOW). Raising 16→20 reserves 4 more lines on every inline `??` and is still too small for wrapped install forms; a second mark (` ⚠ ⊘`) can push a line past `contentWidth`, and `⊘`'s width is ambiguous.
3. **09-03's adapter guard and the Phase 8 adapters** (both MEDIUM). The guard is heuristic, and the open 08-03/08-04 plans pass `QUEQUE_SYSTEM` directly, so they fail CI once it lands. Flag this in those plans rather than finding it at execution.
4. **Install-form wrapping edge cases** (Cursor HIGH, Claude LOW). Cursor wants exact-string tests and no improvising; Claude adds that `#` comments and heredocs break `{ cmd; }` wrapping.

### Single-reviewer findings worth acting on
- **Claude, MEDIUM — the widget's `ERR` trap** (`queque.zsh:195`) fires inside the handoff helper; a failing `zmodload` or write runs `_qq_cleanup`, deleting `request.json` and breaking `??`. Fix: `|| true` guards and a zsh test with an `ERR` trap and an unwritable directory.
- **Claude, HIGH — catalog content is now part of the IPC contract.** The daemon-side `refine` rejects a whole request on one unknown name, so after any future catalog addition a still-running older daemon silently costs 800 ms per `??`. Fix: make the daemon schema a filtering `transform` (keep the client check strict), or advertise a build hash in the pong.
- **Claude, LOW — a spike lexer bug carried over:** `extract.mjs:77` `v += s[++i]` yields `rgundefined` for input `"rg\`, which then passes `SAFE_PACKAGE_NAME_RE` into `brew install rgundefined`. Fix: `?? ''` and a robustness case.
- **Claude, MEDIUM — recorded SC-2 median is unrepresentative:** vitest uses `zsh -f`, where functions/aliases are nearly empty. Also time the helper in the user's real shell.
- **Claude, MEDIUM — kill switch under Zellij:** `QQ_TOOL_AWARENESS=0` is read in the client, which may not inherit the variable in a `zellij run` pane; also check it in the widget.
- **Claude, MEDIUM (process) — `.wolf/` merge conflicts in wave 2:** 09-02/03/04 all edit `.wolf/anatomy.md`/`memory.md` (03 and 04 also `cerebrum.md`).
- **Cursor, MEDIUM — `tabHint` wiring is untested** because `ControlsLine` is mocked to `() => null`; capture its props in the mock.
- **Claude, LOW — 09-02 `spawnSync` `maxBuffer`** (1 MiB default, ~2× headroom) and no explicit per-`it` timeout on the second-seed run.
- **Claude, LOW — `timeout` → `coreutils`** alias missing on macOS; human check may never show a flagged row because steering avoids missing tools.

### Divergent Views
- **Catalog count:** Cursor (HIGH) says the spike catalog has 195 names and the plans' `196` will fail; Claude says 196 with no duplicates. **Orchestrator check:** splitting `sources/003-prompt-steering/catalog.ts` gives 196 tokens, 196 unique — **the plans are correct; Cursor's finding is a false positive.** Claude separately notes the catalog includes basic utilities and package-only names despite its header comment.
- **Install-form severity:** Cursor HIGH vs Claude LOW (see Agreed Concern 4).
- **The daemon `refine`:** Cursor lists it as a strength (defense in depth); Claude calls it the top HIGH risk for future releases.
