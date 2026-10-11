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
