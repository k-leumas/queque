---
status: resolved
trigger: "Renovate PR #8 (vitest 4.0.4 -> 4.1.12) fails CI: shell-result/FIFO contract tests fail (writes {kind:\"cancel\"} JSON to result file, replace-buffer, writes directly to FIFO when isFIFO() true, atomic rename tmp+rename, opens /dev/tty for interactive stdio, in-process fallback when daemon cannot start (WR-12), error ShellResult when fetchCandidates rejects, invalid provider pin, D-13 /login copy). Log also shows \"QueQue: uncaught exception: test error\". Failing run: https://github.com/k-leumas/queque/actions/runs/44848014840. Likely vitest 4.1 mock/spy semantics change rather than product bug. Reproduce locally on branch renovate/vitest-monorepo after rebasing on current main."
created: 2026-11-21
updated: 2026-11-21
---

## Symptoms

- expected: Full vitest suite passes on vitest 4.1.12 exactly as it does on 4.0.4 (main is green).
- actual: On PR #8 (renovate/vitest-monorepo), `checks` and `distro / test-distro (alpine:3.24)` jobs fail. Failing tests (all fail in 0-7 ms, i.e. likely setup/mocking, not logic):
  - writes {kind: "cancel"} JSON to the result file
  - writes {kind: "replace-buffer"} JSON with lbuffer and rbuffer to the result file
  - writes directly to FIFO path without rename when isFIFO() is true
  - uses atomic rename (tmp + rename) for regular file paths when isFIFO() is false
  - emits a replace-buffer result in replace-buffer-fixture mode
  - opens /dev/tty for interactive stdio instead of using inherited stdio
  - emits a replace-buffer result in llm mode and the shell applies it
  - still runs the in-process fallback when the daemon cannot start (WR-12)
  - writes error ShellResult to FIFO when fetchCandidates rejects
  - writes error ShellResult for an invalid provider pin and never calls a provider
  - writes FIFO kind error with D-13 /login copy and a single QueQue prefix
- errors: Log line `QueQue: uncaught exception: test error` immediately precedes the failures. Full log: `gh run view 44848014840 --log-failed`.
- timeline: Main is green on vitest 4.0.4. Fails only with the 4.0.4 -> 4.1.12 bump (vitest monorepo: vitest + @vitest/* packages).
- repro: `gh pr checkout 8`, rebase onto current origin/main (main just took deps merges: @anthropic-ai/sdk 0.137, react, node 24.22.3, pnpm 12.21, checkout v7), `pnpm install`, `pnpm exec vitest run`.

## Prior knowledge

- bug-351 (.wolf/buglog.json): `[vitest] No "restartDaemon" export is defined on the "../src/daemon/bootstrap.js" mock` — tests/client-result.test.ts uses a strict vi.mock factory; main.ts pulls init-provider whose defaultDeps read imports at module load. Failing test names look like they live in client-result / main tests, so a vitest 4.1 change to vi.mock factory / hoisting / process-listener semantics is a lead.
- "QueQue: uncaught exception" suggests main.ts registers process.on('uncaughtException'); a test throwing "test error" may now surface differently (vitest 4.1 unhandled-error handling or onUncaughtException behavior).

## Constraints

- Do NOT fix by deleting or skipping tests, or by injecting stubs that hide real behavior (user memory: fix don't delete; no stubs in smoke tests).
- Prefer adapting tests to vitest 4.1 semantics if product code is correct; fix product code if the test reveals a real bug.
- Run biome on changed files before committing; run full suite (also on a tty) before pushing.
- Push fix commits to the renovate/vitest-monorepo branch (PR #8). No Co-Authored-By trailers. Respect commitlint length.
- Log the fix to .wolf/buglog.json and stage .wolf/ with code.

## Current Focus

- bug_class: Bohrbug (deterministic, 57/64 fail every run on 4.1.12)
- status: fix pushed to PR #8 (f9076b7); CI runs 44943934578 / 44943941895 in progress
- next_action: confirm CI `checks` + distro jobs green on PR #8, then human verifies and archives session (do NOT merge PR #8)

reasoning_checkpoint:
  hypothesis: "tests/client-result.test.ts fails on vitest 4.1.12 because 4.1 applies the file's strict `vi.mock('node:fs', () => ({ writeFileSync, realpathSync }))` to the test file's OWN `import * as fs from 'node:fs'` (4.0.4 only applied it to modules under test), so the harness's real-fs calls (mkdtempSync/writeFileSync/readFileSync/rmSync/existsSync) hit the strict mock and throw / no-op."
  confirming_evidence:
    - "Every failure's first error is `No \"mkdtempSync\" export is defined on the \"node:fs\" mock` thrown at the test file's own beforeEach lines (257, 302, 395, 792, ...)."
    - "Probe: 4.0.4 test-file static/plain/dynamic node:fs isMock=false, src isMock=true; 4.1.12 all isMock=true. Same file passes 64/64 on 4.0.4 in the base worktree."
    - "Branch diff vs main is only vitest + @vitest/coverage-v8 version bump + lockfile."
  falsification_test: "If giving the harness the real module via vi.importActual leaves any of the 57 failing, or if reverting the change does not bring back the mkdtempSync error, H1 is wrong/incomplete."
  fix_rationale: "Restores exactly the 4.0.4 contract the tests were written for: code under test keeps the identical strict node:fs mock (src side unchanged on both versions), the harness uses the real filesystem explicitly instead of relying on the old leak. No assertions, mocks, or product code change. A partial importOriginal mock was rejected: it would turn the harness's request-file writes into vi.fn no-ops and change what src sees for realpathSync."
  blind_spots: "Whether other test files rely on the same 4.0 leak (full suite shows no other vitest-related failure; fuzz/bash-widget are load flakes that pass alone and in CI). Exact upstream changelog entry not located (behavior observed directly instead)."
  candidate_causes:
    - "code (test harness): test file depends on 4.0 leak where builtin vi.mock skipped the test file's own imports — CONFIRMED"
    - "environment/config (dependency): vitest 4.1 changed uncaught-exception/process-listener handling (the `QueQue: uncaught exception: test error` line) — ELIMINATED: that line is stdout of the one PASSING test"
    - "code (product): main.ts / client writes broke — ELIMINATED: no product diff on the branch, src sees the same mock on both versions"
    - "environment (CPU load): fuzz/bash-widget timeouts — separate local flake, not part of this failure"
  and_gate: "no — a single condition (strict builtin mock now reaching the test file's own import) explains all 57 failures; the version bump is the trigger, the harness's reliance on the leak is the cause."

## Evidence

- timestamp: 2026-11-21
  checked: worktree /Users/samuel/dev/tui-llm-vitest (origin/renovate/vitest-monorepo bdaea21, already rebased by Renovate onto origin/main b76f3df); diff vs main = only vitest + @vitest/coverage-v8 4.0.4 -> 4.1.12 and lockfile
  found: `pnpm exec vitest run tests/client-result.test.ts` -> 64 tests, 57 failed, reproduces CI exactly
  implication: deterministic, local repro, no CI-env factor

- timestamp: 2026-11-21
  checked: first error of every failing test
  found: `Error: [vitest] No "mkdtempSync" export is defined on the "node:fs" mock` thrown from the TEST FILE's own beforeEach (`fs.mkdtempSync(...)` at tests/client-result.test.ts:257, 302, 395, 792 ...). The test file has `import * as fs from 'node:fs'` and a strict `vi.mock('node:fs', () => ({ writeFileSync: vi.fn(), realpathSync: (p) => p }))` (line 154). Only test that passes is the main.ts uncaughtException one (which wants the mock).
  implication: not a product bug and not an uncaught-exception semantics change; the "QueQue: uncaught exception: test error" stderr line is the expected output of the one PASSING test. The failure is the test file now receiving the strict node:fs mock for its own import.

- timestamp: 2026-11-21
  checked: probe test (strict vi.mock('node:fs') + static/plain/dynamic imports in the test file + a src module importing writeFileSync) run in base worktree (origin/main, vitest 4.0.4) and PR worktree (4.1.12)
  found: |
    4.0.4  static node:fs isMock=false (mkdtempSync real) | plain 'fs' isMock=false | dynamic import isMock=false | src module isMock=true
    4.1.12 static node:fs isMock=true (mkdtempSync THROWS) | plain 'fs' isMock=true  | dynamic import isMock=true  | src module isMock=true
  implication: H1 CONFIRMED. 4.0.4 never applied a builtin vi.mock to the test file's own imports (only to modules under test). 4.1 applies it everywhere (documented vi.mock semantics). Code under test sees the identical mock on both versions, so product behavior and the main.ts assertions are unaffected; only the test harness's own real-fs usage broke.

- timestamp: 2026-11-21
  checked: base worktree (vitest 4.0.4) `vitest run tests/client-result.test.ts`; full suite on 4.1.12 locally; CI log totals
  found: 4.0.4 -> 64/64 pass. 4.1.12 full suite locally -> 3 files failed: client-result (57), command-words-fuzz (4, spawnSync ETIMEDOUT at 1 s, file took 21 s vs 3.7 s in CI), bash-widget b22 (2018 ms vs <2000 ms budget). fuzz + bash-widget rerun alone on 4.1.12 -> 80/80 pass. CI on 4.1.12: every job "1 failed | 71 passed" — only client-result.
  implication: fuzz/bash-widget are local CPU-load timing flakes (environment), unrelated to the bump. client-result is the only real failure. The test file uses real fs heavily (11 writeFileSync request/handoff writes, 21 readFileSync result reads, mkdtempSync/rmSync/existsSync) and reads the mock only via `await import('node:fs')` after vi.resetModules() in the two main.ts handler tests.

- timestamp: 2026-11-21
  checked: fix applied in worktree (tests/client-result.test.ts: static `import * as fs from 'node:fs'` -> `const fs = await vi.importActual<typeof import('node:fs')>('node:fs')` after the strict node:fs mock, + 3-line comment)
  found: client-result 64/64 pass on 4.1.12. Revert (git apply -R) -> 57 failed / 7 passed with the mkdtempSync error again; reapply -> 64/64. Seeded mutants: M1 main.ts uncaughtException writes {"kind":"cancelX"} -> 1 failed (mocked side still asserts); M2 result-writer adds a field -> 11 failed (real-fs harness side still asserts). biome check clean, tsc --noEmit clean.
  implication: the fix is what greens the file, and it does not weaken any assertion on either the mocked or real-fs path.

- timestamp: 2026-11-21
  checked: origin/main moved during session (zod 4.6.7 #12, semantic-release #3, releases 0.11.3/0.11.4); committed fix (10c8bef) then rebased branch onto origin/main b72197a in the worktree
  found: clean rebase (vitest bump 8616e12 + fix cb6df6e); `pnpm install --frozen-lockfile` passes (zod 4.6.7 installed); branch diff vs origin/main = vitest/@vitest/coverage-v8 versions, lockfile, tests/client-result.test.ts, .wolf files. Full suite on tty (script -q /dev/null): 72/72 files, 2017/2017 tests. Non-tty full runs while load avg was 30-106 (other agents/background merges): only command-words-fuzz + bash-widget b9/b22 wall-clock budgets failed; same class fails on base 4.0.4 under load (3 fuzz cases) and both files pass alone (144/144 with client-result on tty).
  implication: fix holds on current main; remaining local failures are pre-existing load flakes, not related to the bump or the fix.

- timestamp: 2026-11-21
  checked: origin/main moved again to 2d6501c (#46 renovate.json ignorePaths + .wolf/memory.md line); rebased again (memory.md append conflict resolved by keeping both lines; `git diff --stat ORIG_HEAD HEAD -- .wolf` = +1 main line, nothing lost). Commits now 86b6aa6 (vitest bump) + e1a657c (fix). First push attempt with --force-with-lease=...:bdaea21
  found: pre-push hook typecheck + lint passed; `vitest run --changed` (full suite, package.json changed) -> 2016/2017 pass, only bash-widget b22 failed (4057 ms vs <2000 ms budget; file took 46 s vs ~5 s in CI; vitest import time 60 s) under a load spike. Push rejected by the hook; not bypassed.
  implication: retry the push once load drops; same pre-existing load flake class as before.

- timestamp: 2026-11-21
  checked: main moved twice more (914832f setup-node v7 #45 + release 0.11.5; 6179f6d release 0.11.6, workflow/CHANGELOG/version only); rebased cleanly each time, frozen-lockfile install OK, wolf files lost nothing. Second hook attempt (load 18 -> spike): typecheck/lint ok, 23 timing failures in zsh-widget/fuzz/bash-widget; those 3 files rerun alone at load 56 -> 145/145 pass. Third attempt with `VITEST_MAX_WORKERS=4` (vitest 4.1 reads it into resolved.maxWorkers; ~CI 4-vCPU parallelism, hook unchanged, nothing skipped) at load 38.
  found: pre-push hook passed (typecheck, lint changed from base, test affected from base 106 s). Pushed `+ bdaea21...f9076b7 HEAD -> renovate/vitest-monorepo` (lease on bdaea21). Commits on branch: 521cfd4 (Renovate vitest bump, rebased) + f9076b7 (fix). CI triggered for f9076b7: https://github.com/k-leumas/queque/actions/runs/44943934578 and https://github.com/k-leumas/queque/actions/runs/44943941895. Worktrees /Users/samuel/dev/tui-llm-vitest and /Users/samuel/dev/tui-llm-vitest-base removed.
  implication: fix is on PR #8; awaiting CI `checks` + distro results.

- timestamp: 2026-11-21
  checked: CI on f9076b7 (`gh run view`)
  found: pull_request run 44943941895: changes, checks, bash-versions x3, distro test-distro x6 (incl. alpine:3.24) and smoke x6 all success; auto-revert skipped; ci-ok (aggregate) queued for a runner at 14:03. push run 44943934578: checks + test-distro x5 success, remaining smoke/test-distro legs in progress.
  implication: the previously failing `checks` and `distro / test-distro (alpine:3.24)` jobs are green on vitest 4.1.12 with the fix.

## Eliminated

- hypothesis: vitest 4.1 changed uncaught-exception / process-listener semantics (the "QueQue: uncaught exception: test error" log line)
  evidence: that stderr line belongs to `main.ts: uncaughtException handler ... writes cancel JSON` which PASSES on 4.1.12; every failure is the node:fs strict-mock error in the harness
  timestamp: 2026-11-21

- hypothesis: product regression in client/main.ts writes
  evidence: branch diff vs origin/main touches only package.json vitest versions + lockfile; probe shows src modules get the same node:fs mock on 4.0.4 and 4.1.12
  timestamp: 2026-11-21

## Resolution

root_cause: "vitest 4.1 applies a file-level builtin vi.mock to the test file's own imports (4.0.4 only replaced it for the code under test). tests/client-result.test.ts declares a strict `vi.mock('node:fs', () => ({ writeFileSync: vi.fn(), realpathSync }))` meant for main.ts, while its own harness used `import * as fs from 'node:fs'` for mkdtempSync/writeFileSync/readFileSync/rmSync/existsSync. On 4.1.12 those harness calls hit the strict mock and 57/64 tests threw in setup. Not a product bug."
fix: "tests/client-result.test.ts: removed the static `import * as fs from 'node:fs'`; added `const fs = await vi.importActual<typeof import('node:fs')>('node:fs')` (with a 3-line comment) after the strict node:fs mock. The code under test keeps the identical mock; no assertion changed."
oracle_type: specified (existing tests assert exact ShellResult JSON written to real files and the mocked writeFileSync call args)
verification:
  target_test:          { result: pass, detail: "client-result 64/64 on vitest 4.1.12 (was 57 failed)" }
  mutation_check:       { result: pass, reason_if_skipped: "Stryker not installed; manual mutants used", mutant_killed: "M1 main.ts uncaughtException writes {kind:cancelX} -> 1 test fails; M2 result-writer adds a field -> 11 tests fail" }
  no_op_deletion:       { result: pass, deletion_justified_by_rca: true, detail: "only the static import line removed and replaced by an explicit real-module binding; no test, assertion, or mock removed" }
  adjacent_tests:       { result: pass, suites_run: ["full suite tty 72/72 files 2017/2017 tests (rebased on origin/main b72197a)", "non-tty full suite: only pre-existing load flakes (fuzz/bash-widget), reproduced on base 4.0.4 under load, pass alone"] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  guardrail_verdict:    accepted
files_changed: [tests/client-result.test.ts, .wolf/buglog.json (bug-565), .wolf/cerebrum.md, .wolf/anatomy.md, .wolf/memory.md]
commits: ["f9076b7 test(client-result): give the harness the real node:fs under vitest 4.1 (on top of 521cfd4 vitest bump, rebased on origin/main 6179f6d; pushed to renovate/vitest-monorepo)"]
merged: "PR #8 squash-merged to main as 439ac25 after all 36 CI checks passed (ci-ok green); human-verified 2026-11-21"
