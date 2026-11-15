---
phase: 11
review: 11-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "The `en_US.UTF-8` locale fallback prints a setlocale warning into the user's terminal"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "A missing `jq` makes `??` a silent no-op that swallows both `?`"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "`QQ_RESULT_FILE`, `QQ_PANE_WIDTH` and `QQ_PANE_HEIGHT` stay exported in the user's shell after every `??`"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "Client stderr is appended to a fixed, predictable path in world-writable `/tmp`"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "The production client reads the test-only `QQ_TEST_RESULT_MODE`, and an empty or unknown value silently cancels every `??`"
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "A commented-out source line counts as installed in `qq init`, the `integration` check and the `bash_profile` check"
  - id: IN-01
    severity: info
    disposition: open
    title: "The error and setup-failure paths do not reprint the head of a multi-line prompt"
  - id: IN-02
    severity: info
    disposition: open
    title: "The `qq not found` hint is circular"
  - id: IN-03
    severity: info
    disposition: open
    title: "`shellVersion` longer than 40 characters rejects the whole request"
  - id: IN-04
    severity: info
    disposition: open
    title: "`init` and `doctor` do not fall back to the PATH bash when `$SHELL` names a stale bash"
  - id: IN-05
    severity: info
    disposition: open
    title: "Duplicated helpers and copy between `init.ts` and `doctor.ts`"
  - id: IN-06
    severity: info
    disposition: open
    title: "The docs say `qq doctor` checks \"the shell you use\", but it checks your login shell"
open: 6
total: 12
recorded: 2026-11-15T08:41:03.482Z
---

# Phase 11: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | 11-REVIEW-FIX.md |
| WR-02 | warning | fixed | 11-REVIEW-FIX.md |
| WR-03 | warning | fixed | 11-REVIEW-FIX.md |
| WR-04 | warning | fixed | 11-REVIEW-FIX.md |
| WR-05 | warning | fixed | 11-REVIEW-FIX.md |
| WR-06 | warning | fixed | 11-REVIEW-FIX.md |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
