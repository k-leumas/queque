---
phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
plan: 13
subsystem: telemetry
tags: [telemetry, posthog, consent, decision]

requires:
  - phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
    provides: "telemetry endpoint and empty build define (plan 04), daemon buffer (06), consent prompt (11)"
provides:
  - "D-08/D-22 decision recorded: keep the telemetry key empty; no release sends anything"
  - "D-09 carry-over answer recorded: a consent yes from a keyless build carries over to a keyed build"
  - "Pending todo to choose a backend, bake the key and run the $ip/GeoIP check"
affects: [telemetry, release]

actuals:
  tokens: 4000
  tasks: 1
  commits: 0  # docs-only plan; the docs commit itself is excluded
plan_head_before: 070ec2acbd617f41a1275195fb2e4bb0eaca4b08
plan_head_after: 070ec2acbd617f41a1275195fb2e4bb0eaca4b08

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-13-SUMMARY.md
    - .planning/todos/pending/2026-10-30-10-bake-telemetry-key.md
  modified:
    - .wolf/cerebrum.md
    - .wolf/memory.md

key-decisions:
  - "keep-empty: tsup.config.ts keeps __QUEQUE_TELEMETRY_KEY__ empty, so telemetry is off in every build"
  - "carry-over ok: a yes saved in a keyless build is honoured once a keyed build ships"
  - "Backend choice left open (PostHog EU, Aptabase or an own endpoint such as a Vercel Function)"

patterns-established: []

requirements-completed: [P10-TEL]

coverage:
  - id: D1
    description: "D-08: the key is baked only after an explicit human decision"
    requirement: P10-TEL
    verification:
      - kind: other
        ref: "user reply 'keep-empty, carry-over ok' (2026-10-30); grep -c \"__QUEQUE_TELEMETRY_KEY__: JSON.stringify('')\" tsup.config.ts vitest.config.ts -> 1 and 1"
        status: pass
    human_judgment: true
    rationale: "Decision gate; the user chose not to cross the one-way door yet"
  - id: D2
    description: "D-22: a real event reaches PostHog EU without $ip, GeoIP or a person profile"
    requirement: P10-TEL
    verification: []
    human_judgment: true
    rationale: "Deferred by the keep-empty decision; tracked in .planning/todos/pending/2026-10-30-10-bake-telemetry-key.md"
  - id: D3
    description: "D-09/D-22: consent carry-over from keyless builds is decided"
    requirement: P10-TEL
    verification:
      - kind: other
        ref: "user reply 'carry-over ok' (2026-10-30)"
        status: pass
    human_judgment: true

duration: 3min
completed: 2026-10-30
status: complete
---

# Phase 10 Plan 13: Telemetry Key Decision Summary

**The user chose keep-empty: every build keeps an empty `__QUEQUE_TELEMETRY_KEY__`, so QueQue sends no telemetry from any release yet. A consent yes given in a keyless build carries over to a future keyed build ("carry-over ok"). Tasks 2 and 3 (bake and $ip/GeoIP check) are skipped per the plan and tracked as a pending todo.**

## Decision

| Question | Answer |
|---|---|
| Bake the key now (D-08, one-way)? | **keep-empty** |
| Consent carry-over from keyless builds (D-09/D-22)? | **carry-over ok** |
| Backend | Open. The user asked about alternatives. PostHog EU needs no code change; Aptabase or an own endpoint (for example a Vercel Function with a Marketplace store) needs a configurable endpoint and a new payload builder |

## State after this plan

- `tsup.config.ts` and `vitest.config.ts` both keep `__QUEQUE_TELEMETRY_KEY__: JSON.stringify('')`; the host stays `https://eu.i.posthog.com` (D-05).
- With an empty key `resolveTelemetryEndpoint` yields no endpoint, so the daemon buffer never sends. The consent prompt, `qq telemetry status|on|off|show` and the buffer still ship and stay tested.
- Users can still point a build at an endpoint with `QQ_TELEMETRY_KEY` / `QQ_TELEMETRY_HOST`.

## Task Commits

1. **Task 1: decision checkpoint**: answered "keep-empty, carry-over ok"; no code commit
2. **Task 2: bake the key**: skipped (precondition not met); pending todo added
3. **Task 3: $ip/GeoIP check**: skipped; part of the same todo

## Deviations from Plan

None. The keep-empty branch of the plan was followed as written.

## Gaps

None. "carry-over ok" means no re-ask gap.

## User Setup Required

None now. When telemetry is enabled later, follow the pending todo.

## Self-Check: PASSED

- FOUND: this SUMMARY and `.planning/todos/pending/2026-10-30-10-bake-telemetry-key.md`
- Key still empty in both configs (grep counts 1 and 1)
