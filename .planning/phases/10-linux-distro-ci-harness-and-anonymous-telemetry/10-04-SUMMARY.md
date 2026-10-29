---
phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
plan: 04
subsystem: telemetry
tags: [telemetry, zod, posthog, privacy, config, tsup]
status: complete

requires: []
provides:
  - "src/contracts/telemetry.ts: strict allow-list contract (enums, payload, common, wire, batch schemas and types)"
  - "src/shared/telemetry-config.ts: uncached consent state, atomic key-preserving writer, env gates, effectiveTelemetry"
  - "telemetry config key + telemetryConfigSchema in src/shared/qq-config.ts"
  - "src/shared/telemetry-endpoint.ts: resolveTelemetryEndpoint (null for an empty key)"
  - "build defines __QUEQUE_TELEMETRY_KEY__ (empty) and __QUEQUE_TELEMETRY_HOST__ (EU) in tsup, vitest, env.d.ts"
affects: [10-06, 10-09, 10-10, 10-11, 10-13]

actuals:
  tokens: 12000
  tasks: 3
  commits: 6
plan_head_before: a7bdf0bdb7a48125c349d0d7fb60fa7a2f2e04ca
plan_head_after: 3df27d16031914fc630c182b5854f1f27d8ad013

tech-stack:
  added: []
  patterns:
    - "Telemetry allow list = z.strictObject everywhere + enums/literals/bounded ints/tight regexes; wire properties built as new strict objects from shared field maps"
    - "Consent state read fresh from config.json on every call; raw-object read-modify-write that sets only one key"
    - "Build-time public key with usableSecret() env override; empty key = no endpoint"

key-files:
  created:
    - src/contracts/telemetry.ts
    - src/shared/telemetry-config.ts
    - src/shared/telemetry-endpoint.ts
    - tests/telemetry-contract.test.ts
    - tests/telemetry-config.test.ts
    - tests/telemetry-endpoint.test.ts
  modified:
    - src/shared/qq-config.ts
    - tsup.config.ts
    - vitest.config.ts
    - src/env.d.ts

key-decisions:
  - "setTelemetryEnabled(true) reuses the install id only when telemetry is already enabled; any off-to-on transition generates a fresh randomUUID (stricter reading of 'keep an existing installId' so an id can never survive an off state)"
  - "resolveTelemetryEndpoint also rejects a host URL with a username or password (credentials would travel with every batch)"
  - "telemetryBatchSchema api_key regex gets a max(200) bound and TELEMETRY_BATCH_MAX = 100 is exported for the plan-06 buffer"
  - "An invalid installId (not a UUID) makes the whole telemetry block read as defaults (off), failing closed"

requirements-completed: [P10-TEL]

duration: 9min
completed: 2026-10-29
---

# Phase 10 Plan 04: Telemetry foundation Summary

**Strict zod allow list for three PostHog event families, uncached consent state in config.json with DO_NOT_TRACK/QQ_TELEMETRY/CI kill switches, and an inert build-time EU endpoint whose empty key means nothing can be sent.**

## Performance

- **Duration:** about 9 min
- **Started:** 2026-10-29T19:37:00Z
- **Completed:** 2026-10-29T19:46:20Z
- **Tasks:** 3 (all TDD, RED then GREEN)
- **Files modified:** 10

## Accomplishments

- `src/contracts/telemetry.ts` is the allow list: `qq_query_outcome`, `qq_error` and `qq_environment` as strict objects. Values are enums, literals, bounded ints or tight regexes only. Client events carry no identity and no timestamp. Wire events add `distinct_id` (UUID), `$process_person_profile: false`, `$geoip_disable: true`, `$lib: 'queque'` and `$lib_version`. A batch is `{ api_key: phc_…, batch: 1..100 }`.
- 87 contract tests check the following. Every forbidden field (cwd, lbuffer, $ip, latency_ms, ...) is rejected at client, wire and batch level. Unknown top-level keys and free-form values are rejected. The error_kind/outcome coupling holds. The key list of every schema is pinned. A recursive walk of every schema finds no timing key (D-11).
- `src/shared/telemetry-config.ts` reads the state uncached. Writes go through a temp file (`wx`, 0600), chmod and rename, with the directory created 0700, and every other config key is kept. Invalid JSON or a non-object file is never overwritten (`TelemetryConfigWriteError`). The install id comes from `randomUUID()` and is deleted on off. `effectiveTelemetry` returns `{on:false, reason}` when a gate is set or telemetry is disabled.
- `qqConfigFileSchema` gains `telemetry: telemetryConfigSchema.optional().catch(undefined)`; a test proves a malformed block still leaves the privacy patterns and effort in `loadQqConfig()`.
- `tsup.config.ts` bakes `https://eu.i.posthog.com` and an empty key. `vitest.config.ts` bakes an empty key and `http://127.0.0.1:9`. `resolveTelemetryEndpoint` returns null for an empty or non-`phc_` key and for a non-http(s) host or one with credentials. Overrides go through `usableSecret()`.

## Task Commits

1. **Task 1: allow-list contract.** RED `f20eaa6` (test), GREEN `ba040ed` (feat)
2. **Task 2: consent state and env gates.** RED `3152968` (test), GREEN `726c9db` (feat)
3. **Task 3: build defines and endpoint.** RED `e087d8d` (test), GREEN `3df27d1` (feat)

No REFACTOR commits were needed.

## TDD Gate Compliance

Each RED commit has a test file plus a stub module that only exports the public names. Per cerebrum 2026-08-26, the stub exists so `tsc --noEmit` passes in pre-commit. Each RED record was validated with `gsd-tools check tdd-red-evidence` → `RED_EVIDENCE_OK`:

- Task 1: target `tests/telemetry-contract.test.ts > valid samples parse > accepts one sample of each wire event`. It failed with `expected false to be true` because the `z.never()` stub rejects a valid wire event. Semantic assessment: the target executed and failed on the planned assertion.
- Task 2: target `tests/telemetry-config.test.ts > setTelemetryEnabled > enabling sets enabled, asked and a random UUID v4 install id`. It failed because the throw-on-call stub (`not implemented`) ran inside the function under test. Semantic assessment: this is the planned missing-behaviour failure, not a load or fixture fault.
- Task 3: target `tests/telemetry-endpoint.test.ts > resolveTelemetryEndpoint > uses a QQ_TELEMETRY_KEY override with the baked host`. It failed the same way, with the throw-on-call stub.

GREEN: each task's verify command exits 0.

## Verification

- `pnpm exec vitest run tests/telemetry-endpoint.test.ts tests/telemetry-contract.test.ts tests/telemetry-config.test.ts`: 131 passed
- `pnpm exec vitest run tests/telemetry-config.test.ts tests/qq-config.test.ts`: 55 passed
- `pnpm test:run`: 46 files, 1214 tests passed
- `pnpm typecheck` and `pnpm build`: exit 0
- Lint: `pnpm exec biome check src tests tsup.config.ts vitest.config.ts` found no issues in 118 files. Bare `pnpm lint` (`biome check .`) exits 1 with "No files were processed" in this worktree, because the worktree path is under `.claude/` and biome.json excludes `!!**/.claude`. This is an environment artifact, not a code issue. The pre-commit lint job (explicit staged files) passed on every commit.
- All acceptance greps match. Task 1: strictObject 12, unbounded `z.string()` 0. Task 2: randomUUID ≥1, host/user/network APIs 0, loadQqConfig 0, catch line 1, `flag: 'wx'` 1. Task 3: every grep = 1, except `__QUEQUE_TELEMETRY` in env.d.ts = 2.

## Files Created/Modified

- `src/contracts/telemetry.ts`: the allow list (enums, strict schemas, inferred types, `TELEMETRY_BATCH_MAX`)
- `src/shared/telemetry-config.ts`: `TELEMETRY_BLOCK_REASONS`, `TelemetryState`, `EffectiveTelemetry`, `telemetryBlockedBy`, `readTelemetryState`, `setTelemetryEnabled`, `markTelemetryAsked`, `effectiveTelemetry`, `TelemetryConfigWriteError`
- `src/shared/telemetry-endpoint.ts`: `TelemetryEndpoint`, `resolveTelemetryEndpoint`
- `src/shared/qq-config.ts`: exported `telemetryConfigSchema`, `telemetry` key on `qqConfigFileSchema`
- `tsup.config.ts`, `vitest.config.ts`, `src/env.d.ts`: the two telemetry defines
- `tests/telemetry-contract.test.ts`, `tests/telemetry-config.test.ts`, `tests/telemetry-endpoint.test.ts`

## Decisions Made

See `key-decisions` in the frontmatter. Each one is the same as the plan or stricter (fails closed); none changes an interface that later plans consume.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree had no node_modules**
- **Found during:** setup, before Task 1
- **Issue:** the fresh worktree had no `node_modules`, so vitest, tsc and biome could not run.
- **Fix:** `pnpm install --frozen-lockfile --offline`. This installs the locked dependencies from the local store and adds no new package. package.json and pnpm-lock.yaml are unchanged.
- **Files modified:** none (node_modules is gitignored)

**2. [Rule 2 - Security] Host override with URL credentials rejected**
- **Found during:** Task 3
- **Issue:** the plan only required an http(s) protocol. A `QQ_TELEMETRY_HOST` like `https://user:secret@host` would have sent credentials with every batch.
- **Fix:** `resolveTelemetryEndpoint` returns null when the URL has a username or password, and a test covers it.
- **Commit:** `3df27d1`

Otherwise the plan was executed as written. The extra exports (`telemetryCommonPropertiesSchema`, the three `*WirePropertiesSchema`, `TELEMETRY_BATCH_MAX`) are additive; they let the pinned-keys tests read each shape directly.

## Issues Encountered

None in the code. See the note under Verification about bare `pnpm lint` inside a `.claude/worktrees/` checkout.

## OpenWolf entries

Plan 11 applies these; this plan committed no `.wolf/` file.

**anatomy.md**
- `src/contracts/telemetry.ts`: telemetry allow list. Strict zod schemas for `qq_query_outcome` / `qq_error` / `qq_environment` (client, wire, batch), plus the enums ERROR_KINDS, PROVIDER_KINDS, QUERY_OUTCOMES, OS_KINDS, ARCH_KINDS, DISTRO_IDS, TELEMETRY_EVENTS and TELEMETRY_BATCH_MAX. (~1.6k tok)
- `src/shared/telemetry-config.ts`: uncached consent state in config.json `telemetry`. Exports telemetryBlockedBy (DO_NOT_TRACK > QQ_TELEMETRY > CI), readTelemetryState, setTelemetryEnabled, markTelemetryAsked, effectiveTelemetry and TelemetryConfigWriteError. Atomic key-preserving writer. (~1.9k tok)
- `src/shared/telemetry-endpoint.ts`: resolveTelemetryEndpoint(env). Baked host/key with usableSecret overrides; null for an empty or non-phc_ key, a non-http(s) host, or a host with credentials. (~0.4k tok)
- `tests/telemetry-contract.test.ts`: allow-list, forbidden-field, free-form-value, pinned-keys and no-timing (recursive schema walk) tests. (~3.7k tok)
- `tests/telemetry-config.test.ts`: env gates, uncached read, atomic write modes, install id lifecycle, invalid-JSON refusal, qq-config leniency. (~2.5k tok)
- `tests/telemetry-endpoint.test.ts`: endpoint resolution under the vitest defines. (~0.6k tok)
- Update the descriptions of `src/shared/qq-config.ts` (now also exports telemetryConfigSchema), `tsup.config.ts`, `vitest.config.ts` and `src/env.d.ts` (the telemetry defines).

**cerebrum.md**
- Key Learnings, esbuild repro recipe (2026-10-11 Zellij entry): the define list is now `__QUEQUE_VERSION__`, `__QUEQUE_COMMIT__`, `__QUEQUE_TELEMETRY_KEY__` (`''`) and `__QUEQUE_TELEMETRY_HOST__`. Any esbuild/vitest harness that bundles a module that reads them must define all four, or it throws `ReferenceError`.
- Key Learnings, zod 4.1.5: `z.strictObject`, `z.uuid()` and `z.iso.datetime()` all exist. `.extend()` on a strict object stays strict. `.refine()` on a ZodObject returns a ZodObject (`.shape` is still reachable, and it works inside `z.discriminatedUnion`). A schema's nested keys can be walked through `schema._zod.def` (`shape`, `innerType`, `element`, `options`, `in`/`out`).
- Key Learnings: the telemetry state is uncached by design. Never read it through `loadQqConfig()`, which caches per process.
- Do-Not-Repeat [2026-10-29]: inside a `.claude/worktrees/` checkout, `pnpm lint` (`biome check .`) processes 0 files and exits 1, because biome.json excludes `!!**/.claude`. Lint explicit paths (`pnpm exec biome check src tests ...`) in worktrees.
- Do-Not-Repeat [2026-10-29]: a fresh agent worktree has no node_modules. Run `pnpm install --frozen-lockfile --offline` (no new packages) before vitest/tsc.

## Next Phase Readiness

- Plans 06 (daemon buffer), 09 (CLI/doctor), 10 (client events) and 11 (consent prompt) can import the contract, the consent state and the endpoint now.
- Nothing can be sent until plan 13 bakes a real `phc_` key, because the shipped key is empty.

## Self-Check: PASSED

- FOUND: src/contracts/telemetry.ts, src/shared/telemetry-config.ts, src/shared/telemetry-endpoint.ts, tests/telemetry-contract.test.ts, tests/telemetry-config.test.ts, tests/telemetry-endpoint.test.ts
- FOUND commits: f20eaa6, ba040ed, 3152968, 726c9db, e087d8d, 3df27d1
