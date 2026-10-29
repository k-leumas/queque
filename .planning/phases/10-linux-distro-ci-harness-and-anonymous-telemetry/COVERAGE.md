# API Coverage — PostHog Cloud EU public capture API, and the GitHub REST API (via `gh` in CI)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> Scope: the external surfaces Phase 10 integrates. PostHog: QueQue sends opt-in, allow-listed, anonymous event batches from the daemon with raw `fetch` (D-05, D-07, D-10). GitHub: the CI auto-revert job reads workflow runs and opens or updates one revert PR (D-15, D-21).

| capability | decision | reason |
|---|---|---|
| posthog.capture-batch | INTEGRATE | |
| posthog.event-timestamp | INTEGRATE | |
| posthog.process-person-profile-false | INTEGRATE | |
| posthog.geoip-disable-property | INTEGRATE | |
| posthog.project-api-key-auth | INTEGRATE | |
| posthog.capture-single-event | OPT-OUT | not needed: the batch endpoint covers one or many events with one code path |
| posthog.identify-person-properties | OPT-OUT | explicitly out of scope: D-06 anonymous install id, no person profiles |
| posthog.alias | OPT-OUT | explicitly out of scope: no identity merging for an anonymous install id |
| posthog.group-analytics | OPT-OUT | not needed: no organisations or accounts in QueQue |
| posthog.feature-flags-decide | OPT-OUT | not needed: no remote configuration; telemetry must never change product behaviour |
| posthog.session-recording | OPT-OUT | explicitly out of scope: terminal tool and privacy defaults (D-10 allow list) |
| posthog.exception-capture | OPT-OUT | explicitly out of scope: D-10 forbids messages and stack traces; errors are an enum event |
| posthog.surveys | OPT-OUT | not needed: consent is the single /dev/tty question (D-09) |
| posthog.historical-migration | OPT-OUT | not needed: no backfill; events are live counts only |
| posthog.retries-and-disk-queue | OPT-OUT | explicitly out of scope: D-07 drops a failed batch, no retries, no disk queue |
| posthog.private-api-query | OPT-OUT | not needed: analysis happens in the PostHog UI; no personal API key ships in a client |
| github.actions-list-jobs-for-run | INTEGRATE | |
| github.actions-list-workflow-runs | INTEGRATE | |
| github.actions-download-artifacts | INTEGRATE | |
| github.pulls-list | INTEGRATE | |
| github.pulls-create | INTEGRATE | |
| github.pulls-update | INTEGRATE | |
| github.issues-comment-on-pr | INTEGRATE | |
| github.git-push-branch | INTEGRATE | |
| github.issues-create | OPT-OUT | explicitly out of scope: D-03 no auto-issue for nightly or live failures |
| github.branch-protection-write | OPT-OUT | explicitly out of scope: a human sets `ci-ok` as the required check (plan 12) |
| github.actions-permissions-write | OPT-OUT | explicitly out of scope: a human enables PR creation for the workflow token (D-21, plan 12) |
| github.pulls-merge-or-approve | OPT-OUT | explicitly out of scope: a revert PR is always reviewed and merged by a human |
| github.check-runs-annotations | OPT-OUT | not needed: diagnostics go into the revert PR body (D-15) |
