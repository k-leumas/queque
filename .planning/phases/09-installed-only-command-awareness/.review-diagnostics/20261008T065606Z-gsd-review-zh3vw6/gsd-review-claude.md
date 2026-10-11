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

Separately: the Gmail, Google Calendar, Google Drive and Vercel connectors need to be authorized in your claude.ai connector settings before they can be used. This review didn't need them.
