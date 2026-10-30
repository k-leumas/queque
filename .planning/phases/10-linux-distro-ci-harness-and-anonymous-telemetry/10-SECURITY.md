---
phase: "10"
slug: "linux-distro-ci-harness-and-anonymous-telemetry"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-30"
---

# Phase 10 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register built from the `<threat_model>` blocks of plans 10-01..10-13 (authored at plan time). `block_on: high`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Host → distro container | smoke and test-distro run the packed product in throwaway images | tarball, fixture model, two env vars; no keys |
| GitHub Actions → repository | CI jobs read the repo; only auto-revert writes (branch + PR) | workflow token (read by default, write only in the auto-revert job) |
| Nightly → Anthropic API | live SDK contract test on schedule/dispatch only | `ANTHROPIC_API_KEY` repo secret (step env only) |
| Client/daemon → telemetry endpoint | opt-in anonymous counts | enum/count events; key empty today, so nothing is sent |
| Local config / socket | `~/.config/qq/config.json`, daemon Unix socket | consent state, install id; IPC events |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-10-01 | DoS | lsof pid parse | high | mitigate | bootstrap.ts:197-222 bare-pid lines only; lsof-busybox test | closed |
| T-10-02 | Tampering | Node tarball download | medium | mitigate | install-distro-deps.sh:74-83 HTTPS + sha256sum -c | closed |
| T-10-03 | Info disc | docker run in the smoke | medium | mitigate | smoke-distro.sh:93-100, test-in-distro.sh:55 pass only NODE_VERSION/QQ_SMOKE_IMAGE | closed |
| T-10-04 | DoS (false green) | Docker skip path | medium | mitigate | smoke-distro.sh:67-75 exits 1 under CI | closed |
| T-10-05 | Tampering | widget session dir | medium | mitigate | queque.zsh:381-394 returns before any write; zsh-widget mktemp test | closed |
| T-10-06 | DoS | stopped test children | low | mitigate | prewarm-sleep.test.ts:139-151 SIGCONT/SIGKILL | closed |
| T-10-07 | Info disc | doctor summaries | high | mitigate | doctor.ts:445-519 names only; strict schema; canary test | closed |
| T-10-08 | DoS | zsh probes | low | mitigate | doctor.ts:46-47 timeouts, SIGKILL | closed |
| T-10-09 | Tampering | socket checks | low | mitigate | doctor.ts:200-203 lstat; rmSync only on own mkdtemp | closed |
| T-10-10 | Info disc | telemetry contract | high | mitigate | contracts/telemetry.ts:70-145 strict enums/bounded ints | closed |
| T-10-11 | Tampering | config.json writer | high | mitigate | telemetry-config.ts:111-163 refuse invalid, wx 0600 temp + rename | closed |
| T-10-12 | Info disc | install id | medium | mitigate | randomUUID; dropped on off; no host identifiers | closed |
| T-10-13 | Spoofing | QQ_TELEMETRY_HOST | low | accept | http(s) only, no URL credentials (telemetry-endpoint.ts:34-41) | closed |
| T-10-14 | Info disc | ci/distro secrets | high | mitigate | no secrets., no pull_request_target, contents: read | closed |
| T-10-15 | EoP | uses: supply chain | medium | mitigate | first-party actions only; read token | closed |
| T-10-16 | DoS / false green | path filter, ci-ok | medium | mitigate | code-changed.mjs fails open; ci-ok always() | closed |
| T-10-17 | Tampering | expressions in run: | medium | mitigate | values via env:; actionlint clean | closed |
| T-10-18 | Info disc | buffer wrap/flush | high | mitigate | telemetry-buffer.ts gates + schemas at enqueue and flush | closed |
| T-10-19 | Tampering / Spoofing | forged telemetry-event | low | accept | strict event schema; CR-005 TODO | closed |
| T-10-20 | DoS | buffer growth/send | medium | mitigate | cap 100, 3 s send, 1 s shutdown, unref | closed |
| T-10-21 | Info disc | daemon debug log | medium | mitigate | debug lines carry only count/reason/status | closed |
| T-10-22 | Info disc | fetch-error.errorKind | low | mitigate | enum with catch; classified from tags, never message text | closed |
| T-10-23 | Tampering | branch name in auto-revert | high | mitigate | env:, check-ref-format, no eval; test | closed |
| T-10-24 | DoS | revert loops/PR spam | medium | mitigate | skip auto-revert/*; fixed head; edit open PR | closed |
| T-10-25 | EoP | write-scoped job | high | mitigate | job-level write perms only in auto-revert; github.token | closed |
| T-10-26 | Info disc | PR body | medium | mitigate | ANSI/control strip, 60000 cap; #15/#16 scanned clean | closed |
| T-10-27 | Tampering | wrong revert base | medium | mitigate | fully green run + smoke_passed; ancestry check; output is a PR for human review | closed |
| T-10-28 | Info disc | nightly live job | high | mitigate | schedule/dispatch only; repo guard; step env; contents: read | closed |
| T-10-29 | Info disc | live test logs | medium | mitigate | boolean asserts, no artifact upload | closed |
| T-10-30 | DoS | provider outage blocking merges | medium | mitigate | only ci-ok required | closed |
| T-10-31 | DoS / cost | runaway live requests | low | mitigate | 10-min timeout, one request, daily cron | closed |
| T-10-32 | Repudiation / Tampering | qq telemetry off | medium | mitigate | config first, then telemetry-reset; id dropped | closed |
| T-10-33 | Info disc | status/doctor row | low | mitigate | names, booleans, host only | closed |
| T-10-34 | Tampering | config writes | high | mitigate | TelemetryConfigWriteError → stderr, exit 1 | closed |
| T-10-35 | Spoofing | foreign socket listener | low | accept | replies schema-checked; local output only | closed |
| T-10-36 | Info disc | event builders | high | mitigate | enums/counts + strict schema; leak test | closed |
| T-10-37 | Info disc | client gate | high | mitigate | effectiveTelemetry before any build/socket | closed |
| T-10-38 | DoS | ?? latency | medium | mitigate | report after result write; 250 ms cap; never rejects | closed |
| T-10-39 | Info disc | QQ_ZSH_VERSION export | low | accept | major.minor only, regex-enforced | closed |
| T-10-40 | Info disc | consent default | high | mitigate | default No; y/Y only; timeout = no; smoke consent pass | closed |
| T-10-41 | DoS | prompt blocking the shell | medium | mitigate | 30 s timeout; asked saved for both answers | closed |
| T-10-42 | Tampering | terminal frame | medium | mitigate | prompt after unmount; wrapped-row erase; PTY pass green | closed |
| T-10-43 | Repudiation | OpenWolf records | low | mitigate | buglog parses; bug-453..461 present | closed |
| T-10-44 | EoP | Actions may create/approve PRs | medium | mitigate | read default token, no pull_request_target, write only in auto-revert. Missing: main requires 0 approvals and enforce_admins is false | open — below high threshold (non-blocking) |
| T-10-45 | Info disc | drill PR body | low | mitigate | #15/#16 closed unmerged; branches deleted; bodies clean | closed |
| T-10-46 | Tampering | required-check setup | medium | mitigate | required checks = ci-ok, strict false | closed |
| T-10-47 | Info disc | IP/GeoIP at ingestion | high | mitigate | $geoip_disable / $process_person_profile:false literals in schema; empty key sends nothing. Human PostHog check deferred (see Accepted Risks) | closed (code side) |
| T-10-48 | Spoofing | public phc_ key | low | accept | write-only ingestion key; none published today | closed |
| T-10-49 | Tampering | one-way key bake | medium | mitigate | keep-empty decision recorded; key '' in tsup and vitest | closed |
| T-10-SC | Tampering | package installs (all plans) | high | mitigate | lockfile unchanged; --frozen-lockfile everywhere; no new deps | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-10-01 | T-10-13 | Host override is a local env var the user sets; http(s) only and no credentials in the URL | plan 10-04 | 2026-10-30 |
| AR-10-02 | T-10-19 | Any local process that can reach the user's socket can already do more; strict schema bounds the event (CR-005 tracks socket auth) | plan 10-06 | 2026-10-30 |
| AR-10-03 | T-10-35 | A foreign listener on the user's socket path only affects local status output; replies are schema-checked | plan 10-09 | 2026-10-30 |
| AR-10-04 | T-10-39 | `QQ_ZSH_VERSION` holds major.minor only, which the shell already exposes | plan 10-10 | 2026-10-30 |
| AR-10-05 | T-10-48 | PostHog project keys are public write-only ingestion keys; worst case is noisy counts | plan 10-13 | 2026-10-30 |
| AR-10-06 | T-10-47 (human part) | Deferred, not accepted forever: no key is baked, so nothing is sent. Re-audit and do the PostHog "Discard client IP data" check before any bake (todo 2026-10-30-10-bake-telemetry-key.md) | user (keep-empty) | 2026-10-30 |

*Accepted risks do not resurface in future audit runs.*

### Unregistered flags (warnings, not blockers)

- Test-harness git env leak (bug-461): fixed by `tests/setup/scrub-git-env.ts` and `tests/git-env-isolation.test.ts`.
- Smoke out dir permissions widened (`chmod -R a+rX /out`, fallback `chmod 0777 /out`): fixture-only contents; low impact.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-30 | 50 | 49 | 1 (non-blocking, medium) | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-30
