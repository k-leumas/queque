---
phase: 08
review: 08-REVIEW.md
titles: json
findings:
  - id: WR-13
    severity: warning
    disposition: fixed
    title: "Any candidate that mentions `<think>` or `</think>` breaks the whole Ollama or OpenAI answer"
  - id: WR-14
    severity: warning
    disposition: fixed
    title: "The strict `json_schema` request has no fallback, so a pinned OpenAI model without structured outputs fails on every `??`"
  - id: WR-15
    severity: warning
    disposition: fixed
    title: "A fixed `num_ctx` of 20480 on every Ollama request changes memory use and forces model reloads for every Ollama user"
  - id: IN-15
    severity: info
    disposition: fixed
    title: "Remote Ollama error text and the pin `baseUrl` still allow bidi and format characters"
  - id: IN-16
    severity: info
    disposition: fixed
    title: "`.env.local` is still searched above the home directory"
  - id: IN-17
    severity: info
    disposition: fixed
    title: "A retry that runs out of time, or an OpenAI `content_filter` finish, shows the wrong message"
  - id: IN-18
    severity: info
    disposition: fixed
    title: "The OpenAI retry ladder does not remember rejected low efforts"
  - id: IN-19
    severity: info
    disposition: fixed
    title: "A `~` in `QQ_CONFIG_FILE` silently drops the user's privacy patterns"
  - id: CR-01
    severity: critical
    disposition: fixed
  - id: WR-01
    severity: warning
    disposition: fixed
  - id: WR-02
    severity: warning
    disposition: fixed
  - id: WR-03
    severity: warning
    disposition: fixed
  - id: WR-04
    severity: warning
    disposition: fixed
  - id: WR-05
    severity: warning
    disposition: fixed
  - id: WR-06
    severity: warning
    disposition: fixed
  - id: WR-07
    severity: warning
    disposition: fixed
  - id: WR-08
    severity: warning
    disposition: fixed
  - id: IN-01
    severity: info
    disposition: fixed
  - id: IN-02
    severity: info
    disposition: fixed
  - id: IN-03
    severity: info
    disposition: fixed
  - id: IN-04
    severity: info
    disposition: fixed
  - id: IN-05
    severity: info
    disposition: fixed
  - id: IN-06
    severity: info
    disposition: fixed
  - id: IN-07
    severity: info
    disposition: fixed
  - id: IN-08
    severity: info
    disposition: fixed
  - id: WR-09
    severity: warning
    disposition: fixed
  - id: WR-10
    severity: warning
    disposition: fixed
  - id: WR-11
    severity: warning
    disposition: fixed
  - id: WR-12
    severity: warning
    disposition: fixed
  - id: IN-09
    severity: info
    disposition: fixed
  - id: IN-10
    severity: info
    disposition: fixed
  - id: IN-11
    severity: info
    disposition: fixed
  - id: IN-12
    severity: info
    disposition: fixed
  - id: IN-13
    severity: info
    disposition: fixed
  - id: IN-14
    severity: info
    disposition: fixed
open: 0
total: 35
recorded: 2026-10-19T08:55:53.763Z
---

# Phase 08: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-13 | warning | fixed | 08-REVIEW-FIX.md |
| WR-14 | warning | fixed | 08-REVIEW-FIX.md |
| WR-15 | warning | fixed | 08-REVIEW-FIX.md |
| IN-15 | info | fixed | 08-REVIEW-FIX.md |
| IN-16 | info | fixed | 08-REVIEW-FIX.md |
| IN-17 | info | fixed | 08-REVIEW-FIX.md |
| IN-18 | info | fixed | 08-REVIEW-FIX.md |
| IN-19 | info | fixed | 08-REVIEW-FIX.md |
| CR-01 | critical | fixed | see 08-REVIEW-FIX.md (not in the current review) |
| WR-01 | warning | fixed | see 08-REVIEW-FIX.md (not in the current review) |
| WR-02 | warning | fixed | see 08-REVIEW-FIX.md (not in the current review) |
| WR-03 | warning | fixed | see 08-REVIEW-FIX.md (not in the current review) |
| WR-04 | warning | fixed | see 08-REVIEW-FIX.md (not in the current review) |
| WR-05 | warning | fixed | see 08-REVIEW-FIX.md (not in the current review) |
| WR-06 | warning | fixed | see 08-REVIEW-FIX.md (not in the current review) |
| WR-07 | warning | fixed | see 08-REVIEW-FIX.md (not in the current review) |
| WR-08 | warning | fixed | see 08-REVIEW-FIX.md (not in the current review) |
| IN-01 | info | fixed | iteration 2, see 08-REVIEW-FIX.md (not in the current review) |
| IN-02 | info | fixed | iteration 2, see 08-REVIEW-FIX.md (not in the current review) |
| IN-03 | info | fixed | iteration 2, see 08-REVIEW-FIX.md (not in the current review) |
| IN-04 | info | fixed | iteration 2, see 08-REVIEW-FIX.md (not in the current review) |
| IN-05 | info | fixed | iteration 2, see 08-REVIEW-FIX.md (not in the current review) |
| IN-06 | info | fixed | iteration 2, see 08-REVIEW-FIX.md (not in the current review) |
| IN-07 | info | fixed | iteration 2, see 08-REVIEW-FIX.md (not in the current review) |
| IN-08 | info | fixed | iteration 2, see 08-REVIEW-FIX.md (not in the current review) |
| WR-09 | warning | fixed | iteration 2, see 08-REVIEW-FIX.md (not in the current review) |
| WR-10 | warning | fixed | iteration 2, see 08-REVIEW-FIX.md (not in the current review) |
| WR-11 | warning | fixed | iteration 2, see 08-REVIEW-FIX.md (not in the current review) |
| WR-12 | warning | fixed | iteration 2, see 08-REVIEW-FIX.md (not in the current review) |
| IN-09 | info | fixed | iteration 2, see 08-REVIEW-FIX.md (not in the current review) |
| IN-10 | info | fixed | iteration 2, see 08-REVIEW-FIX.md (not in the current review) |
| IN-11 | info | fixed | iteration 2, see 08-REVIEW-FIX.md (not in the current review) |
| IN-12 | info | fixed | iteration 2, see 08-REVIEW-FIX.md (not in the current review) |
| IN-13 | info | fixed | iteration 2, see 08-REVIEW-FIX.md (not in the current review) |
| IN-14 | info | fixed | iteration 2, see 08-REVIEW-FIX.md (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
