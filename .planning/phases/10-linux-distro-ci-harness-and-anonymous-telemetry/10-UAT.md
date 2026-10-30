---
status: testing
phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
source: [10-VERIFICATION.md]
started: 2026-10-30T06:05:56Z
updated: 2026-10-30T06:05:56Z
---

## Current Test

number: 1
name: Nightly live SDK run and the :latest matrix legs
expected: |
  After pushing main, `gh workflow run nightly.yml` then `gh run watch` ends green: the
  `:latest` distro legs and the live SDK contract test (needs the ANTHROPIC_API_KEY repo secret).
awaiting: user response

## Tests

### 1. Nightly live SDK run and the :latest matrix legs
expected: push main; `gh workflow run nightly.yml`; `gh run watch` is green (distro :latest legs + live job)
result: [pending]

### 2. Telemetry key bake and the $ip/GeoIP check (deferred by keep-empty)
expected: per .planning/todos/pending/2026-10-30-10-bake-telemetry-key.md, one real event shows no $ip, no GeoIP and no person profile; or the user confirms the deferral stands
result: [pending]

### 3. Review finding CR-01: fix or accept
expected: with an invalid or unwritable ~/.config/qq/config.json the consent question is not asked again after every accepted ?? (fix), or the user accepts the risk
result: [pending]

### 4. Requirement IDs P10-* traceability
expected: the eight P10-* IDs are added to REQUIREMENTS.md (and ZSHX-01 marked done), or the user accepts 10-RESEARCH.md as their source
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
