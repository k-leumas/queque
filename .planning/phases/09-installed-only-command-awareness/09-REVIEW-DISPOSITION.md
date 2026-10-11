---
phase: 09
review: 09-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "Heredoc bodies and `\\`-newline continuations are classified as commands (false \"not installed\" marks, real commands missed)"
  - id: CR-02
    severity: critical
    disposition: fixed
    title: "Wrapper operands are misread: `watch 'cmd'` is flagged, and long options produce an install form for an unrelated package"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "Package alias map uses Homebrew names but is applied to apt/dnf/pacman"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "Viewport-reserve comment describes a shared footer margin that the code doesn't have, and the 17-line reserve is short when both footers show"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "Wall-clock asserts make the tests flaky under parallel load"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "Install-form toggle and the search filter disagree on what a row \"is\""
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "`lookupOnly` handling is dead, so `command -v`, `type` and `which` operands work only by accident"
  - id: IN-01
    severity: info
    disposition: open
    title: "Known false negatives in the lexer are undocumented"
  - id: IN-02
    severity: info
    disposition: open
    title: "Function definitions flag the function name"
  - id: IN-03
    severity: info
    disposition: open
    title: "Legend line estimate uses the gutter-reduced width"
  - id: IN-04
    severity: info
    disposition: open
    title: "The installed-tools list now also appears in `ps` output for `/login` users"
  - id: IN-05
    severity: info
    disposition: open
    title: "Steering guard test is marker-based and easy to bypass"
  - id: WR-06
    severity: warning
    disposition: open
    title: "The timeout path starts the next resize without waiting for the killed action to exit, which can bring back the G-09-7 ordering race"
  - id: WR-07
    severity: warning
    disposition: open
    title: "A failed, killed or non-zero-exit action still counts as the applied height, so the pane can stay at a stale size and later requests for the right height are deduped"
  - id: WR-08
    severity: warning
    disposition: open
    title: "The mocked-hooks suite never replays render-phase updates, so the zero-match test now checks a state production cannot reach"
  - id: IN-06
    severity: info
    disposition: open
    title: "No test covers the arrival reset of `selectedIndex` and Tab toggles (D-09), although the 09-06 SUMMARY D3 claims it"
  - id: IN-07
    severity: info
    disposition: open
    title: "The queue tests skip the synchronous spawn-throw branch and the timer `unref`"
  - id: IN-08
    severity: info
    disposition: open
    title: "The real-hooks layout tests rely on a 200 ms real-time sleep to catch late reports"
  - id: IN-09
    severity: info
    disposition: open
    title: "An effect-count assertion stands in for the behaviour the test names"
open: 12
total: 19
recorded: 2026-10-11T10:50:00.000Z
---

# Phase 09: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | 09-REVIEW-FIX.md (b8ea9d7) |
| CR-02 | critical | fixed | 09-REVIEW-FIX.md (b235597) |
| WR-01 | warning | fixed | 09-REVIEW-FIX.md |
| WR-02 | warning | fixed | 09-REVIEW-FIX.md (eb6fad1) |
| WR-03 | warning | fixed | 09-REVIEW-FIX.md |
| WR-04 | warning | fixed | 09-REVIEW-FIX.md |
| WR-05 | warning | fixed | 09-REVIEW-FIX.md (d0cf4e8) |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| WR-06 | warning | open | 09-06 gap-closure review |
| WR-07 | warning | open | 09-06 gap-closure review |
| WR-08 | warning | open | 09-06 gap-closure review |
| IN-06 | info | open | 09-06 gap-closure review |
| IN-07 | info | open | 09-06 gap-closure review |
| IN-08 | info | open | 09-06 gap-closure review |
| IN-09 | info | open | 09-06 gap-closure review |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
