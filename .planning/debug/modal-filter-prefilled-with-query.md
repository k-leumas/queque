---
status: diagnosed
trigger: "UAT 09.1 Test 5 (G-09.1-5): filter text typed during `thinking…` is appended onto the lbuffer query (\"how to use z3\" -> \"how to use z3 smt\"); filter should be empty when the modal opens because the query is shown as a header above it"
created: 2026-10-12T20:10:00Z
updated: 2026-10-12T20:55:00Z
goal: find_root_cause_only
symptoms_prefilled: true
---

## Current Focus

hypothesis: CONFIRMED — CandidateSelect seeds `query` state from `initialQuery` (lbuffer text left of `??`, 03.1 D-01), so FILTER shows the lbuffer from the first frame and typed keys append to it; the WR-04 guard `query === (initialQuery ?? '')` then skips every zero-match clear once the user has typed, so the combined text is kept
test: done — real-hooks Ink scratch repro + differential (empty seed)
expecting: n/a
bug_class: Bohrbug (deterministic state initializer + key handler; no timing dependence beyond "typed before first row")
known_pattern_candidate: none (KB has no entry; buglog WR-04 entry is the contributing change, not a match)
next_action: return ROOT CAUSE FOUND to orchestrator (goal: find_root_cause_only); no fix applied

reasoning_checkpoint:
  hypothesis: "FILTER is pre-filled because `useState(initialQuery ?? '')` seeds the search query with the lbuffer (03.1 D-01); printable keys do `setQuery(q => q + input)`, so text typed during `thinking…` is appended to the lbuffer; since 17bf7d3 (WR-04) the zero-match clears only fire while `query === initialQuery`, so the appended text is never cleared and the list stays filtered by 'show me how to use z3 smt'"
  confirming_evidence:
    - "Real-Ink repro: loading frame shows `FILTER: show me how to use z3` before any key; after typing ' smt' -> `FILTER: show me how to use z3 smt`; after first row and the complete 3-row list -> still that filter, `no matches`, 0 rows shown"
    - "Differential: identical keystrokes with initialQuery '' -> `FILTER: smt`, survives a non-matching first row (WR-04 intent), complete list shows the smt rows"
    - "Code: CandidateSelect.tsx useState(initialQuery ?? '') and setQuery((q) => q + input); header renders `queque › ${initialQuery}` directly above `<SearchInput query={query} />`"
  falsification_test: "If FILTER started empty with the lbuffer seed in place (or if the typed text replaced rather than appended), the hypothesis would be wrong — the repro shows the seed text in FILTER before any key press and the appended result after"
  fix_rationale: "(direction only) Seeding `query` with '' removes the duplication and makes typed text the whole filter; the zero-match clear branches exist only to undo the seed and become dead code, so removing them (keeping the later-arrival keep-highlight logic) addresses the cause rather than adding another guard"
  blind_spots: "Not re-run in a live zsh/Zellij session (the real-Ink harness mirrors run-foreground's streaming rerenders); not checked whether any user relies on the `git ch??` prefix-narrowing that D-01 gave (candidates are already generated from that lbuffer, so narrowing is redundant)"
  candidate_causes:
    - "code: CandidateSelect query state seeded from initialQuery (CONFIRMED primary)"
    - "code: WR-04 guard `query === initialQuery` disables the zero-match clear once typed (CONFIRMED contributing — turned 'typed text wiped' into 'typed text appended, list empty')"
    - "config/design: 03.1 D-01 decision (pre-filter on non-empty lbuffer) predates the phase-04 `queque ›` header that now shows the same text (CONFIRMED as the origin; superseded by user in UAT)"
    - "environment: zsh instant frame painting the lbuffer into the FILTER row (ELIMINATED — its FILTER row is blank)"
  and_gate: "yes — the visible symptom needs both (1) the lbuffer seed and (2) the WR-04 guard; before 17bf7d3 the same seed produced a different failure (typed filter wiped on a non-matching first row). Removing (1) alone fixes both versions; removing (2) alone reintroduces WR-04"

## Symptoms

expected: The filter input is empty when the QueQue candidate modal opens (the query text is shown above it as a header); text typed during `thinking…` becomes the whole filter and keeps filtering later streamed rows. A filter typed during `thinking…` survives a non-matching first row (WR-04, commit 17bf7d3).
actual: (verbatim user) "when i type into the filter before candidates are populated, my filter text is appeneded onto the query text from the left of the `?` so "how to use z3" becomes "how to use z3 smt".... the filter value should be empty upon opening of the modal as the query text is displayed above this"
errors: None reported.
reproduction: UAT 09.1 Test 5 — type `show me how to use z3??` in zsh with shell/zsh/queque.zsh sourced, then type ` smt` while only `thinking…` shows.
started: Discovered during UAT 2026-10-12, after review fixes WR-04/WR-05/WR-06 (commits 17bf7d3, a1eef40, 2776f9a). Steps 1 and 2 of Test 5 (highlight stability, filtering while rows arrive) passed.

## Eliminated

- hypothesis: SearchInput itself prepends the lbuffer/header text to the filter
  evidence: src/ui/SearchInput.tsx renders only its `query` prop (`FILTER: {query}` or the `type to filter…` placeholder); the text comes from CandidateSelect's query state
  timestamp: 2026-10-12T20:20:00Z

- hypothesis: run-foreground passes a combined lbuffer+typed string as initialQuery on later rerenders
  evidence: run-foreground.ts:290 passes the constant `request.lbuffer` on every rerender; keystrokes never reach run-foreground
  timestamp: 2026-10-12T20:20:00Z

- hypothesis: the zsh instant frame paints the lbuffer into the FILTER row, so the user sees it pre-filled before Ink starts
  evidence: shell/zsh/queque.zsh _qq_instant_frame emits header + two blank rows (FILTER row + margin, QQ_INSTANT_FRAME_ROWS_ABOVE_LOADING=2) + `thinking…`; the pre-fill appears only once Ink takes over
  timestamp: 2026-10-12T20:20:00Z

## Evidence

- timestamp: 2026-10-12T20:10:00Z
  checked: src/ui/CandidateSelect.tsx state init, key handler, header render
  found: `const [query, setQuery] = useState(initialQuery ?? '')` (line ~111); printable input does `setQuery((q) => q + input)`; the header row renders `queque › ${initialQuery}` above `<SearchInput query={query} />` — so the lbuffer appears twice (header + filter) and typed text appends to the lbuffer in the filter
  implication: the filter starts pre-filled with the lbuffer by design of the state initializer; this is the direct mechanism of "how to use z3" -> "how to use z3 smt"

- timestamp: 2026-10-12T20:14:00Z
  checked: src/client/run-foreground.ts:288-290 buildCandidateElement
  found: `initialQuery: request.lbuffer` — the same lbuffer is passed on every rerender (loading, each streamed row, final list); request.lbuffer is QQ_LBUFFER = LBUFFER minus the trigger `?` (shell/zsh/queque.zsh:219-226)
  implication: initialQuery is both the header text and the filter seed; there is no separate "filter seed" source

- timestamp: 2026-10-12T20:15:00Z
  checked: design history — git log -S initialQuery; 03.1-CONTEXT.md D-01/D-02; 03.1-DISCUSSION-LOG.md "Initial Search Filter"; ac90c65 (phase-04 UAT); 04-01-PLAN; 09.1-REVIEW WR-04; buglog bug for WR-04
  found: The pre-fill is an intentional phase-03.1 decision (D-01 "if request.lbuffer is non-empty ... candidates are pre-filtered by that text on first render"; user chose "Both (conditional)" on 2026-05-13, commit 7187358 "live search state pre-populated from initialQuery"). Phase 04 UAT (ac90c65, 2026-05-22) then added the dim `queque › ${initialQuery}` header ABOVE the FILTER row, so the lbuffer is shown twice. Phase 04 (WR-04 of 04-REVIEW) and 09-06 (G-09-7) added the zero-match clear because natural-language lbuffers almost never match a command — that clear is what made D-01 invisible in practice. 09.1 WR-04 (17bf7d3) restricted the clear to `query === initialQuery`, so the clear no longer runs once the user has typed.
  implication: D-01 is an earlier-phase decision that the user's UAT statement ("the filter value should be empty upon opening of the modal as the query text is displayed above this") now supersedes; the header (phase 04) already covers the "visual context" role. Before 17bf7d3 the same scenario wiped the typed text instead (all-or-nothing clear), so the pre-fill was latent-buggy in both versions.

- timestamp: 2026-10-12T20:18:00Z
  checked: real-hooks Ink scratch repro (tests/zz-scratch-g0915.test.tsx, same FakeStdout/FakeStdin + rerender streaming as mountStream in candidate-select-layout.test.tsx; deleted after the run), lbuffer 'show me how to use z3', keys ' ','s','m','t' during loading, then rows ['z3 -smt2 problem.smt2'] arriving, then 3 rows complete
  found: |
    loading (before typing):  FILTER: show me how to use z3
    loading (after ' smt'):   FILTER: show me how to use z3 smt
    row 1 arrived:            FILTER: show me how to use z3 smt | no-matches=true
    complete:                 FILTER: show me how to use z3 smt | no-matches=true | rows shown=0
  implication: exact UAT symptom reproduced deterministically; impact is worse than reported — the completed list shows "no matches" with zero rows until the user backspaces ~20 characters

- timestamp: 2026-10-12T20:19:00Z
  checked: differential — same harness, keys 's','m','t', first row 'z3 -in' (non-matching), then complete; seed = lbuffer vs seed = ''
  found: |
    [lbuffer seed] first row: FILTER: show me how to use z3smt | rows=0 ; complete: same filter, rows none
    [empty seed]   first row: FILTER: smt | rows=0 ; complete: FILTER: smt, rows z3 -smt2 problem.smt2 and cat problem.smt2 | z3 -in
  implication: the only variable is the query seed; with an empty seed the typed text becomes the whole filter, survives a non-matching first row (WR-04 intent) and filters later rows (D-09) — exactly the expected behavior

- timestamp: 2026-10-12T20:21:00Z
  checked: .planning/phases/09.1-provider-latency-and-cancellation/09.1-RESEARCH.md Pitfall 9 and 09.1-REVIEW.md WR-04
  found: Pitfall 9 ("run the zero-match clear ... only while query === initialQuery (the user hasn't typed); once the user types, the typed filter applies to later rows") and WR-04 both assume "typed filter" = what the user typed; neither accounts for typed keys being appended to the lbuffer seed
  implication: the 09.1 design gap — the guard is correct for a fresh filter but wrong for a seeded one

- timestamp: 2026-10-12T20:22:00Z
  checked: tests that encode the pre-fill (grep initialQuery / pre-filter / FILTER: in tests/)
  found: |
    tests/candidate-select.test.tsx: 'CandidateSelect — filterCandidates logic' (initialQuery 'git' filters, ~l.134-155); 'CandidateSelect — D-01 pre-filter' (pre-populates query from initialQuery, ~l.183-212); 'CandidateSelect — zero-match after filter' (relies on initialQuery 'zzz' to create the zero-match, ~l.258-284)
    tests/candidate-select-layout.test.tsx: (a) non-matching lbuffer never draws no-matches (~l.456); (d) 'an lbuffer that matches a command still pre-filters the list on arrival' (smt2, ~l.510); the 'smt2 pre-filter' case in the header-row/fit table (~l.546-571, l.617 expects 'FILTER: smt'); 'Pitfall 9' (~l.950, asserts FILTER no longer shows the lbuffer after clear); 'WR-04' (~l.965, lbuffer 'gr' + typed 'ep' expects 'FILTER: grep' — encodes the exact bug); 'WR-05: a later list that clears the lbuffer pre-filter keeps the highlight position' (~l.987, lbuffer 'git'); 'WR-06' it.each (~l.1036, lbuffer 'gr' + typed 'ep')
    tests/modal-layout.test.ts: 'sizes an lbuffer pre-filter for the unfiltered list' (~l.428; pure function with explicit query, still valid as a generic filter case, name only)
  implication: the fix must rewrite these to the new contract (FILTER empty on open; typed text is the whole filter) rather than delete them; WR-04/WR-06 tests become "typed `grep` during loading" with an empty seed

## Resolution

root_cause: "src/ui/CandidateSelect.tsx seeds the FILTER query with the lbuffer — `const [query, setQuery] = useState(initialQuery ?? '')` — per phase 03.1 decision D-01 (pre-filter candidates by a non-empty lbuffer). Printable keys append (`setQuery((q) => q + input)`), so text typed during `thinking…` extends the lbuffer ('show me how to use z3' -> 'show me how to use z3 smt') while the same lbuffer is already shown in the `queque ›` header (added in phase 04). Contributing: the 09.1 WR-04 fix (17bf7d3) limits both zero-match clears to `query === (initialQuery ?? '')`, so once the user types, the seeded+typed string is never cleared and the whole list renders `no matches`; before 17bf7d3 the same seed instead wiped the typed text on a non-matching first row."
fix: "Plan 09.1-09 (commit 6888d4d): src/ui/CandidateSelect.tsx seeds the FILTER query with an empty string (`useState('')`, still the second of four useState calls) and removes both arrival-time zero-match clears (the first-arrival `setQuery('')` and the later-arrival `nextQuery` branch), which only undid the lbuffer seed. The first-arrival selection/Tab reset, the later-arrival keep-highlight-by-candidateKey and the WR-06 clamp are unchanged. `initialQuery` keeps its name and is documented as header text and layout-estimator input only. run-foreground.ts and queque.zsh unchanged. Tests that encoded the pre-fill were rewritten to the new contract, none deleted (commit 8a1f430)."
verification: "RED (commit f610b6c): the new real-Ink describe `G-09.1-5: FILTER opens empty` failed before the fix: UAT case `expected 'FILTER: show me how to use z3' to be 'FILTER: type to filter…'`, typed-equals-lbuffer case `expected 'FILTER: smtsmt' to be 'FILTER: smt'`; the empty-lbuffer case passed (neighbour pin); gsd tdd-red-evidence = RED_EVIDENCE_OK. GREEN: the describe passes 3/3 after the fix; tests/candidate-select-layout.test.tsx, tests/candidate-select.test.tsx and tests/modal-layout.test.ts 120/120 after the rewrites (counts 32/43/41, none dropped); full pnpm test:run, typecheck, lint and build green (09.1-09 SUMMARY). Live re-test pending /gsd-verify-work UAT test 5."
files_changed:
  - src/ui/CandidateSelect.tsx
  - src/ui/modal-layout.ts (comment only)
  - tests/candidate-select-layout.test.tsx
  - tests/candidate-select.test.tsx
  - tests/modal-layout.test.ts
suggested_fix_direction: "Seed `query` with '' (FILTER empty on open; the placeholder `type to filter…` shows); keep `initialQuery` only for the `queque ›` header and the layout estimator's header row (consider renaming to make that explicit). Remove the zero-match query clears in the arrival block (first-arrival and later-arrival) — they only existed to undo the lbuffer seed and with an empty seed can only ever discard user-typed text; keep the first-arrival selection/toggle reset and the later-arrival keep-highlight-by-candidateKey + WR-06 clamp. Rewrite (not delete) the tests listed in Evidence to the new contract, add a real-Ink regression for the UAT case (lbuffer 'show me how to use z3', type 'smt' during loading -> FILTER: smt, smt rows visible on complete) plus boundary neighbours (empty lbuffer; typed text equal to the lbuffer). Record D-01/D-02 as superseded in planning docs; no zsh instant-frame change needed (its FILTER row is already blank)."
