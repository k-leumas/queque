---
phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
review: 10-REVIEW.md
recorded: 2026-10-30
counts: {critical: 1, warning: 6, info: 7, total: 14}
---

# Phase 10 Code Review Disposition

One row per finding in `10-REVIEW.md`. Default `open` until fixed, accepted, or deferred.

| ID | Severity | Finding | Disposition | Note |
|---|---|---|---|---|
| CR-01 | critical | Consent question is asked again after every accepted `??` when the config file cannot be updated | open | |
| WR-01 | warning | In Zellij, the consent question appears after the widget has returned and can take the next keystroke | open | |
| WR-02 | warning | The consent write replaces a symlinked `config.json` with a regular file | open | |
| WR-03 | warning | `qq doctor` reports a stuck daemon as "not running" with an ok status | open | |
| WR-04 | warning | Push runs diff against `github.event.before`, so a doc-only push after an untested code push reports a green `ci-ok` | open | |
| WR-05 | warning | Different branches can map to the same auto-revert branch and overwrite each other's revert PR | open | |
| WR-06 | warning | Stale `doctor.json`/`doctor.txt` from an earlier local run survive and are reported as current | open | |
| IN-01 | info | Consenting users send events to the daemon even when the build has no project key | open | |
| IN-02 | info | The mktemp-failure exit skips `zle reset-prompt` after the instant frame scrolled the reserve | open | |
| IN-03 | info | `QQ_ZSH_VERSION` stays exported in the user's interactive shell | open | |
| IN-04 | info | Only read and parse failures become `TelemetryConfigWriteError` | open | |
| IN-05 | info | The `socket_failed` error kind can almost never be delivered | open | |
| IN-06 | info | A host override with a query or fragment produces a broken batch URL | open | |
| IN-07 | info | Wall-clock latency assertions can be flaky under load | open | |
