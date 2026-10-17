# Phase 09.1 Plan Review

Verified against current source under `/Users/samuel/dev/tui-llm` (plans not yet implemented: no `stream-json.ts` / `claude-process.ts` / `candidate-stream.ts` / `claude-prewarm.ts`; CLI still uses text output and `execFileAsync`).

---

## 09.1-01

### Summary

Strong tracer plan: abort end-to-end plus stream-json resolve-on-result matches the measured gaps (`src/daemon/server.ts` has no `close`/AbortSignal; `src/client/run-foreground.ts:295-300` cancels without aborting fetch; `src/providers/claude-cli.ts:19-43` uses `--output-format text` with prompt on argv). Scope split with 06 is sensible. One blocking type/contract hole: changing `LLMAdapter` without updating `claudeAdapter`.

### Strengths

- Correctly targets real cancel gaps: server only handles `error` (`src/daemon/server.ts:110-112`); client `onCancel`/`onSelect` never destroy the fetch (`src/client/run-foreground.ts:283-300`, `:344`).
- Prompt-on-stdin + no positional prompt closes T-08-02-07 against current argv (`src/providers/claude-cli.ts:19-30`).
- `is_error` gate before `parseCandidates` is necessary: prose fallback treats any non-JSON as a command (`src/providers/claude.ts:68-76`).
- Abort mapped via `AbortError` avoids `hardError`/`isTimeoutOrKilled` turning SIGTERM into `TIMEOUT_MESSAGE` (`src/providers/claude-default.ts:50-55`, `:69-79`).
- Fake child fixture + stage-order assertions (no wall-clock thresholds) respects bug-206.

### Concerns

- **HIGH — `claudeAdapter` vs new `LLMAdapter`:** Plan changes `fetchCandidates(envelope, options?)` in `src/providers/provider.ts:4-5` but leaves `claudeAdapter = { fetchCandidates }` with `(envelope, rbuffer?, timeoutMs?)` (`src/providers/claude.ts:152-156`, `:207-209`) until plan 04. That is a TypeScript assignability break on plan 01’s `pnpm typecheck`, and would be unsound if anything called the adapter with `options` early.
- **MEDIUM — SDK cancel deferred:** CLI abort is wired in 01; SDK path still `messages.create` without signal (`src/providers/claude.ts:176-186`) until wave 3. API-key users stay uncancellable across waves 1–2.
- **MEDIUM — `process.exit` after client:** `src/cli/main.ts:86-91` currently awaits and returns; forcing `process.exit` is right for D-15 open handles, but must not run when tests import `main` for non-client paths — confirm no client-through-`main` tests break.
- **LOW — orphaned `claude-exec.ts`:** Explicitly kept unused; fine for the phase, but worth a follow-up delete so spawn paths do not diverge.

### Suggestions

- In plan 01, add a one-line adapter wrap: `claudeAdapter = { fetchCandidates: (e, o) => fetchCandidates(e, '', 25_000 /* ignore o until 04 */) }` or a throw-on-options stub so typecheck passes and options are not misread as `rbuffer`.
- Keep SDK “no signal yet” as an explicit SUMMARY note so wave-1 UAT does not claim Esc works on the API-key path.

### Risk Assessment

**MEDIUM** — Tracer design is sound and evidence-backed; the `claudeAdapter` signature gap can fail the plan’s own typecheck gate.

---

## 09.1-02

### Summary

Clean provider-side latency lever: `--effort low` via `qq-config` plus incremental candidate scanning. Aligns with profile savings (~1.05 s effort, early row from deltas). Config invalid-effort handling correctly avoids today’s whole-file drop (`src/shared/qq-config.ts:118-124`).

### Strengths

- Field-level `.catch(undefined)` for `effort` avoids `readConfigFile` wiping privacy patterns on one bad key (`src/shared/qq-config.ts:118-124`) — matches Pitfall 4.
- Scanner validates with `commandCandidateSchema` before emit; caps at 5 matching `candidateListSchema` (`src/contracts/candidates.ts:3-10`).
- Final-list rule (strict → streamed → `parseCandidates`) preserves today’s prose fallback only when nothing streamed — avoids turning partial JSON into a fake command.
- Coupling note with 06 (optional runner options; 02 mocks `runClaudeTurn`) is accurate given current call sites.

### Concerns

- **MEDIUM — Scanner complexity:** Bracket/string depth parser over streamed JSON is the highest implementation-risk piece of the phase; tests cover splits and escapes, but real Claude deltas may interleave non-array chatter — plan skips non-`[` prefix, which helps, yet malformed mid-stream objects rely on skip + final strict parse.
- **LOW — Daemon config cache:** Documented “restart daemon for effort” matches `loadQqConfig` process cache (`src/shared/qq-config.ts:131-160`); easy to miss in UAT if only the client is rebuilt.
- **LOW — Wave-2 parallel with 03:** No shared files; OK. Shared `tests/claude-cli-provider.test.ts` churn with later plans needs careful merge order (already partly noted for 04/05).

### Suggestions

- Add one fixture where deltas include a `stream_event` noise line / assistant wrapper text before `[` to lock the “ignore until `[`” rule.
- Assert argv has no `--model` in the same test as `--effort` (D-02).

### Risk Assessment

**MEDIUM** — Effort change is low risk; incremental scanner is medium risk but well-tested on paper.

---

## 09.1-03

### Summary

IPC half of streaming is well matched to existing capability-bump pattern (`installedTools` in `src/daemon/bootstrap.ts:96-98`, `src/contracts/ipc.ts:33-38`). Add-alongside `candidate` + keeping `candidates` as done signal is the right compatibility choice. Transport half of D-16 (no in-process re-query after rows) fixes a real footgun in `fetchCandidatesForUi` (`src/daemon/fetch-client.ts:130-144`).

### Strengths

- Pong flag `streamCandidates` mirrors the Phase 9 `installedTools` replacement mechanism (`src/daemon/bootstrap.ts:96-98`).
- Server re-validates with `commandCandidateSchema` before write — defence in depth on top of client zod (`src/contracts/ipc.ts`).
- `setEncoding('utf8')` fixes multi-byte splits that `chunk.toString()` concatenation can break (`src/daemon/fetch-client.ts:96-97`).
- Abort-after-close write suppression pairs with plan 01’s `connectionAbort`.
- Task 2 correctly identifies that today’s fallback would duplicate on-screen rows and start a second cold provider call.

### Concerns

- **MEDIUM — Always `stream: true` from new client:** Fine if daemon is replaced via pong; if capability check is buggy, old daemon would ignore unknown request fields (zod strip) and never stream — client would wait for final `candidates` only. Bootstrap bump must ship with this plan (it does).
- **MEDIUM — `depends_on` omits nothing critical for IPC, but UI (07) assumes this contract:** OK. Ensure plan 01’s abort fields in `requestDaemonFetch` are merged before Task 1’s signature edits (depends_on includes 01).
- **LOW — CR-005 unauthenticated socket accepted again** (`src/daemon/server.ts:24-26`) — correctly tracked, not regressed by shape-only change.

### Suggestions

- In bootstrap tests, keep an explicit fixture for “has fetchCandidates+installedTools, lacks streamCandidates → replace”.
- Log when `onCandidate` is skipped due to abort (already has `fetch aborted`) to make D-14 daemon-side debuggable.

### Risk Assessment

**LOW–MEDIUM** — Pattern is proven in-repo; main risk is merge conflict on `server.ts` / `fetch-client.ts` after plan 01.

---

## 09.1-04

### Summary

Necessary SDK parity: abort, effort, streaming. Correctly notes this machine cannot live-measure the path. Plan explicitly fixes the adapter wrap that plan 01 leaves broken (`claudeAdapter` forwarding `options`).

### Strengths

- Replaces `messages.create` (`src/providers/claude.ts:176-186`) with `messages.stream` + `finalMessage()` and `signal` — matches D-13 for API-key users.
- `sdkOutputConfig` / `EFFORT_UNSUPPORTED_MODEL_RE` avoids 400s on Haiku/older Sonnet when `QQ_MODEL` overrides — real operational risk.
- Steering guard update (`messages.stream(`) prevents a silent coverage hole in `tests/steering.test.ts`.
- Same scanner/final-list rule as CLI path — contract unity.

### Concerns

- **MEDIUM — Signature remains `(envelope, rbuffer, timeoutMs, options)`:** Awkward vs `LLMAdapter`’s `(envelope, options?)`; the adapter wrap fixes the interface, but direct `fetchCandidates(..., options)` callers can still pass options as `rbuffer` if arity is wrong. Tests mostly use `(envelope, '')` today (`tests/claude-provider.test.ts`).
- **MEDIUM — Effort on Sonnet 5 via `output_config`:** Relies on RESEARCH/API assumptions (A4); wrong shape fails only in tests/mocks here — keep mocks honest to SDK 0.92.0 types.
- **LOW — Parallel with 05 on `tests/claude-cli-provider.test.ts`:** `coupling_justified` is plausible (SDK vs CLI path) but merge-conflict prone; plan 08 full suite is the real safety net.

### Suggestions

- Prefer renaming/removing unused `rbuffer` in a later cleanup so options cannot be positional-shadowed.
- Assert abort does not map through `hardError` on the SDK branch in `claude-default.ts` the same way as CLI.

### Risk Assessment

**MEDIUM** — Right scope; unverifiable live on this machine; adapter wrap is mandatory and well specified.

---

## 09.1-05

### Summary

Prewarm plan matches measured −0.93 s boot and amended D-11 (no warmup at daemon start). Keying by sha256 of `{command, cwd, argv}` is equivalent to CONTEXT’s “cwd + system prompt hash” because argv embeds `--system-prompt` and `--effort` (`buildClaudeCliArgv`). Daemon-only enable avoids orphan `claude` processes on client fallback.

### Strengths

- Cold-first after daemon start matches reality: daemon cwd/tools unknown at listen time.
- `schedulePrewarm` in `finally` after settle (including abort) satisfies D-13 slot refill.
- One cold retry only for `exit-without-result` with no streamed rows — avoids retry storms on auth/timeout/abort.
- `child` option on `runClaudeTurn` is the right seam; argv stays opaque for steering tests.
- Idle RSS / TLS cost accepted explicitly (T-09.1-15) — honest threat model.

### Concerns

- **MEDIUM — Argv-key churn:** Installed-tools steering changes every inventory change → systematic prewarm miss (`prompt`/`argv` mismatch). Correct per D-12, but warm-path UAT must use a stable cwd/tools set or median will look cold.
- **MEDIUM — Parallel with 04 on CLI tests:** Declared; still the riskiest wave-3 file overlap.
- **LOW — `ignore-eof` fixture + retire on shutdown:** Easy to get stdin-EOF vs SIGKILL ordering wrong; plan’s grace backstop helps.
- **LOW — CONTEXT wording vs plan:** D-12 says “hash of system prompt”; implementation hashes full argv — document that effort/flags are intentionally part of the key.

### Suggestions

- Log miss reason in human-check script (plan 08 summarizer already wants `prewarm hit/miss`).
- Ensure `enablePrewarm()` cannot run in `fetchCandidatesForUi` in-process fallback (`src/daemon/fetch-client.ts:143`).

### Risk Assessment

**MEDIUM** — Highest operational complexity after the scanner; lifecycle edge cases are covered by tests but live Claude may still surprise (auth expiry, sleep).

---

## 09.1-06

### Summary

Necessary hardening extracted from 01 for context budget. Caps and post-result backstop address real daemon DoS/wedge modes that plan 01 deliberately leaves open. Coupling with 02 is clean (optional options + mocked call sites).

### Strengths

- Carry cap (1 MiB) + stderr cap (64 KiB) prevent unbounded buffering vs current `maxBuffer`/concat patterns (`src/providers/claude-exec.ts:39`, `:83-88`).
- Post-result backstop (2 s) matches “resolve on result, don’t wait forever for exit” without racing the success path.
- Real-child failure scenarios (`hang-after-result`, `stderr-flood`, etc.) are the right proof strategy.
- Stage-order assertions continue to avoid bug-206 flaky timing.

### Concerns

- **MEDIUM — Extends files owned by 01 (and later 05):** `claude-process.ts`, `fake-claude-stream.mjs`, `claude-process.test.ts` — wave-2 parallel with 02 is OK; wave-3 plan 05 must rebase carefully on 06’s fixture switch.
- **LOW — `invalid-result` on carry overflow:** Mapped through existing error paths; confirm `claude-default` surfaces a usable message, not a opaque failure, if a huge line ever appears.

### Suggestions

- Keep scenario switch in the fixture additive (as 01 requires) so 05’s `ignore-eof` is a pure append.
- Document that backstop must not reject an already-resolved promise (plan says answer unaffected — enforce with a double-settle test).

### Risk Assessment

**LOW–MEDIUM** — Well scoped; risk is mostly merge/extension discipline, not design.

---

## 09.1-07

### Summary

UI half is the make-or-break for D-06–D-10/D-16/D-17. It correctly rewrites the render-phase reset that today always snaps selection to 0 on any new array (`src/ui/CandidateSelect.tsx:128-140`) — which would destroy streaming UX. Zellij “no report while `arriving`” fits the serialized resize queue and f9o hold.

### Strengths

- Identifies the exact reset block that contradicts D-06 (`src/ui/CandidateSelect.tsx:119-140`).
- Highlight stability via `candidateKey` + filtered index lookup is the right approach with FILTER (`src/ui/modal-layout.ts:33`, `:113`).
- Early Enter abort + ignore late `onCandidate` matches D-07/D-14 against current fetch-then-rerender (`src/client/run-foreground.ts:344-351`).
- Partial-failure UX (keep rows, dim note) matches D-16 and plan 03’s no-requery transport behavior.
- Default `listState: 'complete'` preserves all existing callers/tests.

### Concerns

- **HIGH — `depends_on` omits `09.1-02`:** Listed as `[09.1-01, 09.1-03]` only. Streaming IPC without the CLI scanner means `onCandidate` never fires on the default `claude -p` path (`src/providers/claude-cli.ts` today has no deltas). Wave ordering usually runs 02 first, but the dependency graph should require it.
- **MEDIUM — Acceptance `grep -c useState` equals prior count:** Brittle; a legitimate refactor fails the gate.
- **MEDIUM — Annotate-on-each-arrival:** `annotateCandidates` per row is correct for missing-tool flags, but must stay sync/cheap on the Ink thread.
- **LOW — Initial Zellij height at cap:** Layout effect already no-ops while `candidates === null` (`src/ui/CandidateSelect.tsx:166-168`); plan assumes pane open height is already `QQ_PANE_HEIGHT` — confirm shell/widget side still does that (not changed here).

### Suggestions

- Add `09.1-02` (and ideally `09.1-04` for SDK streaming parity) to `depends_on`.
- Replace the useState count grep with a behavioral test that mocked-hooks indices remain stable.
- Explicitly test: user moved highlight + Tab install toggle survives third arrival.

### Risk Assessment

**MEDIUM–HIGH** — Design matches code reality; missing depends_on on 02 is a real sequencing hazard; highlight/Zellij interactions are historically bug-prone (G-09-7).

---

## 09.1-08

### Summary

Appropriate phase gate: deferred OpenWolf commits, full green suite, and manual real-provider UAT with a scratch-only latency summarizer. Transitive `depends_on` through 04/05/07 covers 02/03/06. Human checks map cleanly onto D-01–D-17 and the 5.3 s → ~2 s evidence in `.planning/debug/llm-response-latency-profile.md`.

### Strengths

- Refuses to stub the provider for latency/cancel — consistent with project rules and profile methodology.
- Scratch dir via `mktemp -d`, never committed — good privacy posture with redacted logs (`DEFAULT_REDACT_LOG_KEYS` in `src/shared/qq-config.ts:17-18`).
- Explicit idle-machine / load-average guidance (bug-206).
- Cerebrum replacement of superseded `claude -p` text/argv guidance is necessary so future agents do not reintroduce the old path.
- Keeps pre-existing uncommitted `.wolf/` edits — correct OpenWolf hygiene.

### Concerns

- **MEDIUM — Gate does not add `09.1-02`/`03`/`06` explicitly:** Transitively covered, but a partial merge that skips a wave-2 plan could still look “green” if 04/05/07 somehow landed on incomplete providers — low probability if waves are enforced.
- **MEDIUM — UAT burden:** Seven real-provider checks (latency, cwd miss, Esc, early Enter, filter, Zellij, opportunistic partial) are necessary but easy to under-run; summarizer helps only if debug stages from 01/02/05/07 all shipped.
- **LOW — Anatomy/cerebrum volume:** Parallel plans defer many OpenWolf lines to 08 — conflict risk with hook auto-detected entries (called out correctly).

### Suggestions

- Make the summarizer fail loudly if expected stage names are missing (detect incomplete phase merge).
- Record warm-path median next to keypress→candidates (profile’s +~0.38 s) in the SUMMARY table format for easy comparison to 5.3 s.

### Risk Assessment

**LOW** for plan quality; **MEDIUM** for phase success overall because outcomes depend on real Claude variance and thorough human UAT.

---

## Cross-plan comparison

| Topic | Assessment |
|---|---|
| Goal fit (latency + cancel) | Four measured levers + Esc abort are covered end-to-end; evidence in latency profile matches plan scope. |
| Wave / file ownership | Mostly clean; hottest overlaps: `claude-cli.ts` (01→02→05), `claude-process`/fixture (01→06→05), `fetch-client`/`server` (01→03), `claude-cli-provider.test.ts` (02/04/05). |
| Contract consistency | Shared artifacts table is a strength; `FetchOptions` / `onCandidate` / `streamCandidates` / `listState` align across layers. |
| Biggest holes | (1) Plan 01 `claudeAdapter` type hole until 04; (2) Plan 07 missing `depends_on: 09.1-02`; (3) SDK cancel absent until wave 3. |
| Security | Prompt off argv, zod on IPC/candidates, no auto-exec preserved; CR-005 unchanged; prewarm idle cost accepted. |

## Overall risk assessment

**MEDIUM**

The plan set is unusually well grounded in measured code and debug evidence, with clear seams and threat models. It should achieve the phase goals if the three holes above are fixed before execution: adapter signature in wave 1, UI dependency on the scanner, and clear communication that API-key cancel/streaming lands only in wave 3. Residual risk is implementation difficulty (JSON scanner, prewarm lifecycle, CandidateSelect highlight/Zellij) plus real-provider variance on the ~2 s target — not missing product decisions.
