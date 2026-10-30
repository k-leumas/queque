---
phase: 10
review: 10-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "With a config.json linked into a read-only store, `qq telemetry on|off` now fails with a raw errno message"
  - id: IN-01
    severity: info
    disposition: open
    title: "Consenting users send events to the daemon even when the build has no project key (carried forward)"
  - id: IN-02
    severity: info
    disposition: open
    title: "The mktemp-failure exit skips `zle reset-prompt` after the instant frame scrolled the reserve (carried forward)"
  - id: IN-03
    severity: info
    disposition: open
    title: "`QQ_ZSH_VERSION` stays exported in the user's interactive shell (carried forward)"
  - id: IN-04
    severity: info
    disposition: open
    title: "Only read and parse failures become `TelemetryConfigWriteError` (carried forward; now easier to hit, see WR-01)"
  - id: IN-05
    severity: info
    disposition: open
    title: "The `socket_failed` error kind can almost never be delivered (carried forward)"
  - id: IN-06
    severity: info
    disposition: open
    title: "A host override with a query or fragment produces a broken batch URL (carried forward)"
  - id: IN-07
    severity: info
    disposition: open
    title: "Wall-clock latency assertions can be flaky under load (carried forward)"
  - id: IN-08
    severity: info
    disposition: open
    title: "The client and the widget detect Zellij differently, and the consent skip now depends on that check"
  - id: IN-09
    severity: info
    disposition: open
    title: "A chain of dangling links is followed only one hop, so an intermediate link is replaced"
  - id: IN-10
    severity: info
    disposition: open
    title: "The doctor hint `lsof -t <socket>` gives wrong output on Alpine (busybox lsof)"
  - id: IN-11
    severity: info
    disposition: open
    title: "Docs-only pushes to main now run the full distro matrix and can trigger auto-revert"
  - id: IN-12
    severity: info
    disposition: open
    title: "Revert PRs opened under the old head-branch name are no longer found"
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "Consent question is asked again after every accepted `??` when the config file cannot be updated"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "The consent write replaces a symlinked `config.json` with a regular file"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "`qq doctor` reports a stuck daemon as \"not running\" with an ok status"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "Push runs diff against `github.event.before`, so a doc-only push after an untested code push reports a green `ci-ok`"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "Different branches can map to the same auto-revert branch and overwrite each other's revert PR"
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "Stale `doctor.json`/`doctor.txt` from an earlier local run survive and are reported as current"
open: 13
total: 19
recorded: 2026-10-30T16:20:51.127Z
---

# Phase 10: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| IN-08 | info | open | - |
| IN-09 | info | open | - |
| IN-10 | info | open | - |
| IN-11 | info | open | - |
| IN-12 | info | open | - |
| CR-01 | critical | fixed | 10-REVIEW-FIX.md (not in the current review) |
| WR-02 | warning | fixed | 10-REVIEW-FIX.md (not in the current review) |
| WR-03 | warning | fixed | 10-REVIEW-FIX.md (not in the current review) |
| WR-04 | warning | fixed | 10-REVIEW-FIX.md (not in the current review) |
| WR-05 | warning | fixed | 10-REVIEW-FIX.md (not in the current review) |
| WR-06 | warning | fixed | 10-REVIEW-FIX.md (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
