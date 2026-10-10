---
phase: 09
review: 09-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "Heredoc bodies and `\\`-newline continuations are classified as commands (false \"not installed\" marks, real commands missed)"
  - id: CR-02
    severity: critical
    disposition: open
    title: "Wrapper operands are misread: `watch 'cmd'` is flagged, and long options produce an install form for an unrelated package"
  - id: WR-01
    severity: warning
    disposition: open
    title: "Package alias map uses Homebrew names but is applied to apt/dnf/pacman"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Viewport-reserve comment describes a shared footer margin that the code doesn't have, and the 17-line reserve is short when both footers show"
  - id: WR-03
    severity: warning
    disposition: open
    title: "Wall-clock asserts make the tests flaky under parallel load"
  - id: WR-04
    severity: warning
    disposition: open
    title: "Install-form toggle and the search filter disagree on what a row \"is\""
  - id: WR-05
    severity: warning
    disposition: open
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
open: 12
total: 12
recorded: 2026-10-10T19:41:05.934Z
---

# Phase 09: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | open | - |
| CR-02 | critical | open | - |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
