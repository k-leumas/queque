# Phase 10: Linux distro CI harness and anonymous telemetry - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-28
**Phase:** 10-linux-distro-ci-harness-and-anonymous-telemetry
**Areas discussed:** Live LLM in CI, Telemetry backend, qq doctor & smoke gating, Telemetry consent & payload

---

## Todo cross-reference

| Option | Selected |
|--------|----------|
| Fold SDK-path live check | |
| Fold stale-prewarm check | ✓ |
| Keep both as todos | |

## Live LLM in CI

| Question | Options | Selected |
|----------|---------|----------|
| Any CI run calls the real model? | Nightly only, one job / Never / Manual dispatch only | Nightly only, one job |
| Live assertion strictness | Contract-level / Golden-ish | Contract-level |
| On live failure | Red nightly, non-blocking / Auto GitHub issue | Red nightly, non-blocking |
| Stale-prewarm coverage | Simulate in vitest / Smoke step in container / Both | Simulate in vitest |

## Telemetry backend

| Question | Options | Selected |
|----------|---------|----------|
| Host | PostHog Cloud EU / PostHog Cloud US / Self-hosted | PostHog Cloud EU |
| Identity | Random install UUID / No ID | Random install UUID |
| Transport | Raw fetch to /batch, drop on failure / posthog-node / Fetch + disk queue | Raw fetch, drop on failure |
| Key shipping | Baked into build, env override / Env/config only | Baked into build, env override |

## qq doctor & smoke gating

| Question | Options | Selected |
|----------|---------|----------|
| Non-zero exit | Only hard blockers / Any problem incl. provider / Warnings exit 2 | Only hard blockers |
| Output | Human checklist + --json / Human only | Human checklist + --json |
| Docker not running on pre-push | Warn and skip / Fail the push | Warn and skip (later moot) |
| Pre-push time budget | ≤90s parallel / Ubuntu only / No budget | (not answered — user asked to clarify) |

**User clarification:** "is there a way to avoid prepush checks and only run them on remote and open a PR when there is a failure"

| Question | Options | Selected |
|----------|---------|----------|
| What to open on remote failure | Auto-revert PR / Fix PR via Claude / Tracking issue only | Auto-revert PR |
| Trigger | push to main + pull_request / Every branch push / pull_request only | Every branch push |

**Notes:** Supersedes roadmap item 3 (lefthook pre-push Docker smoke).

## Telemetry consent & payload

| Question | Options | Selected |
|----------|---------|----------|
| Ask point | /dev/tty prompt after first successful ?? / Only `qq telemetry on` / In `qq init provider` | /dev/tty prompt after first successful ?? |
| Allow-list (multi) | Errors / Query outcome counts / Latency buckets / Environment shape | Errors, Query outcome counts, Environment shape |
| `qq telemetry show` | Pending buffer + last batch / Schema only | Pending buffer + last batch |

## Claude's Discretion

- Image tag pinning, Alpine Node install, latency ceiling, flush interval, error-kind enum, prompt copy, revert-range detection, required-check selection.

## Deferred Ideas

- Latency telemetry (excluded).
- Claude-authored fix PRs (rejected for auto-revert).
