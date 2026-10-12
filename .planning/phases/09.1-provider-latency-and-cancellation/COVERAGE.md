# API Coverage — Anthropic Messages API (TS SDK 0.92.0) and Claude Code print mode (2.1.285)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> Scope: the capabilities of the two existing provider surfaces that Phase 09.1 touches. QueQue makes one interactive, latency-sensitive request per `??` and returns text candidates; it never executes commands.

| capability | decision | reason |
|---|---|---|
| sdk.messages.stream | INTEGRATE | |
| sdk.request-signal-abort | INTEGRATE | |
| sdk.request-timeout | INTEGRATE | |
| sdk.output_config.effort | INTEGRATE | |
| sdk.system-prompt | INTEGRATE | |
| sdk.messages.create-non-streaming | OPT-OUT | replaced by messages.stream with finalMessage, which raises APIUserAbortError on abort |
| sdk.thinking-config | OPT-OUT | omitted on purpose: adaptive by omission on claude-sonnet-5 and effort is the control (D-03) |
| sdk.sampling-params | OPT-OUT | rejected with a 400 by claude-sonnet-5 (cerebrum 2026-07-30) |
| sdk.model-switch | OPT-OUT | explicitly out of scope: D-03 keeps claude-sonnet-5; a Haiku-class model is a deferred idea |
| sdk.prompt-caching | OPT-OUT | explicitly out of scope: measured about 0 gain; the request is below every minimum cacheable prefix |
| sdk.tool-use | OPT-OUT | not needed: candidates are plain text and are never executed |
| sdk.structured-outputs | OPT-OUT | not needed yet: candidate JSON is validated with zod, and its interplay with streamed partial parsing is unverified |
| sdk.message-batches | OPT-OUT | not needed: interactive single requests where latency is the product constraint |
| sdk.files-api | OPT-OUT | not needed: no file inputs (privacy default, no file reads) |
| sdk.token-counting | OPT-OUT | not needed: prompt size is fixed and small |
| sdk.models-api | OPT-OUT | not needed: effort support for a QQ_MODEL override is decided by a local id pattern (D-03 guard) |
| sdk.fast-mode | OPT-OUT | explicitly out of scope: model and speed-tier changes are outside this phase |
| cli.input-format-stream-json | INTEGRATE | |
| cli.output-format-stream-json-verbose | INTEGRATE | |
| cli.include-partial-messages | INTEGRATE | |
| cli.effort | INTEGRATE | |
| cli.safe-mode-no-tools-no-session-system-prompt | INTEGRATE | |
| cli.model | OPT-OUT | D-02: the account default model stays in charge |
| cli.bare | OPT-OUT | skips Keychain and OAuth, which breaks /login users (cerebrum 2026-08-25) |
| cli.json-schema | OPT-OUT | not needed: unverified with streaming partial messages |
| cli.replay-user-messages | OPT-OUT | not needed: the prompt is known locally |
| cli.session-resume-continue | OPT-OUT | not needed: no session persistence, matching the no-local-memory privacy default |
