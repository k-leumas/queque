---
phase: quick
plan: 260522-vfd
type: execute
wave: 1
depends_on: []
files_modified:
  - src/providers/detect.ts
  - src/providers/index.ts
  - src/client/run-foreground.ts
  - tests/provider-detect.test.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "detectProvider() returns a typed DetectedProvider union for each of the 5 branches"
    - "The foreground client logs the detected provider to debug output before ensureDaemon()"
    - "All 5 detection branches have passing vitest unit tests using mocked fs/fetch/env"
  artifacts:
    - path: "src/providers/detect.ts"
      provides: "detectProvider() function and DetectedProvider union type"
      exports: ["detectProvider", "DetectedProvider"]
    - path: "src/providers/index.ts"
      provides: "Re-exports detect.ts for unified provider surface"
    - path: "tests/provider-detect.test.ts"
      provides: "Vitest unit tests for all 5 branches"
  key_links:
    - from: "src/client/run-foreground.ts"
      to: "src/providers/detect.ts"
      via: "import detectProvider, called before ensureDaemon"
      pattern: "detectProvider"
---

<objective>
Prototype provider detection: a `detectProvider()` function running a 5-step waterfall that determines which LLM backend is available, wired into the foreground client for debug logging.

Purpose: Lay the foundation for multi-provider support by detecting available providers at startup without changing which provider is actually used.
Output: src/providers/detect.ts, src/providers/index.ts, tests/provider-detect.test.ts, and a wired call in src/client/run-foreground.ts.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@src/shared/debug-log.ts
@src/client/run-foreground.ts
@src/providers/provider.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement DetectedProvider type and detectProvider() waterfall</name>
  <files>src/providers/detect.ts, src/providers/index.ts</files>
  <action>
Create src/providers/detect.ts with the DetectedProvider discriminated union and detectProvider() async function.

The union type:
- { kind: 'anthropic-key' }
- { kind: 'claude-cli' }
- { kind: 'ollama'; baseUrl: string }
- { kind: 'openai-key' }
- { kind: 'none' }

The detectProvider() waterfall (short-circuit on first match):

Step 1 — Anthropic key env: return { kind: 'anthropic-key' } if process.env.ANTHROPIC_API_KEY is a non-empty string.

Step 2 — Claude CLI: return { kind: 'claude-cli' } if BOTH conditions are true:
  a. The claude binary is on PATH — check by calling `which claude` via execa/execSync, or use import('node:child_process').execSync('which claude', { stdio: 'pipe' }) wrapped in try/catch (throws if not found).
  b. The ~/.claude/ directory contains at least one auth-related file — use fs/promises stat on os.homedir() + '/.claude/.credentials.json', and also try os.homedir() + '/.claude/credentials.json' as a fallback. If either stat succeeds (file exists), the condition is met.

Step 3 — Ollama health: perform fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(300) }). If the response is ok (status 2xx), return { kind: 'ollama', baseUrl: 'http://localhost:11434' }. Catch ALL errors (network, timeout, AbortError) and continue to next step.

Step 4 — OpenAI key env: return { kind: 'openai-key' } if process.env.OPENAI_API_KEY is a non-empty string.

Step 5 — return { kind: 'none' }.

Import pattern for child_process: use node:child_process execSync with stdio: 'pipe' so a missing binary throws synchronously (no stdout noise). Wrap in try/catch.

Import pattern for fs: import * as fsp from 'node:fs/promises' — consistent with the rest of the codebase.

Import pattern for os: import * as os from 'node:os'.

Do not use any third-party libraries — node built-ins only.

Export detectProvider and DetectedProvider from this file.

Create src/providers/index.ts that re-exports everything from detect.ts:
  export { detectProvider } from './detect.js';
  export type { DetectedProvider } from './detect.js';

Also re-export from provider.ts (LLMAdapter) so index.ts is the unified providers entry point:
  export type { LLMAdapter } from './provider.js';
  </action>
  <verify>
    <automated>cd /Users/samuel/dev/tui-llm && npx tsc --noEmit 2>&1 | grep -E "detect|index" | head -20</automated>
  </verify>
  <done>src/providers/detect.ts compiles without TypeScript errors. detectProvider() is exported. src/providers/index.ts re-exports it. No runtime logic changed in claude.ts.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Vitest unit tests for all 5 detection branches</name>
  <files>tests/provider-detect.test.ts</files>
  <behavior>
    - Branch 1: ANTHROPIC_API_KEY set → returns { kind: 'anthropic-key' }
    - Branch 2: ANTHROPIC_API_KEY unset, claude in PATH + ~/.claude/.credentials.json present → returns { kind: 'claude-cli' }
    - Branch 3: ANTHROPIC_API_KEY unset, claude not in PATH, fetch returns 200 → returns { kind: 'ollama', baseUrl: 'http://localhost:11434' }
    - Branch 4: ANTHROPIC_API_KEY unset, claude not in PATH, fetch throws, OPENAI_API_KEY set → returns { kind: 'openai-key' }
    - Branch 5: nothing set, fetch throws, no PATH hits → returns { kind: 'none' }
    - Fetch timeout (AbortError) → falls through to next branch (same as fetch throwing)
    - Claude in PATH but no auth file → falls through to Ollama check
  </behavior>
  <action>
Write tests/provider-detect.test.ts following the patterns in tests/client-result.test.ts (vi.mock at module top, vi.hoisted for shared refs, afterEach cleanup).

Mock strategy:
- vi.stubEnv for ANTHROPIC_API_KEY and OPENAI_API_KEY. Call vi.unstubAllEnvs() in afterEach.
- vi.mock('node:child_process', ...) to control execSync: have it throw for "not found" or return Buffer.from('/usr/local/bin/claude') for "found".
- vi.mock('node:fs/promises', async (importOriginal) => { ...original, stat: vi.fn() }) to control whether ~/.claude/.credentials.json appears to exist. stat should throw an error with code 'ENOENT' when the file is absent, or resolve to a stats-like object when present.
- vi.stubGlobal('fetch', vi.fn()) to control Ollama check. In the success branch, the mock returns { ok: true, status: 200 }. In failure branches, it throws new Error('connection refused').

Each describe block should isolate env state and mocks:
- Restore vi.mocked(execSync).mockReset() and vi.mocked(stat).mockReset() in beforeEach.
- Use afterEach(() => vi.unstubAllEnvs()) to clean env.

Import detectProvider from '../src/providers/detect.js' (not index.js, to avoid side effects).

Note: execSync in the detect.ts implementation is imported as a named import. The test must mock 'node:child_process' such that the execSync mock is honoured in the detect.ts module scope. Use vi.hoisted if a stable mock reference is needed before vi.mock factories run.
  </action>
  <verify>
    <automated>cd /Users/samuel/dev/tui-llm && pnpm vitest run tests/provider-detect.test.ts 2>&1 | tail -20</automated>
  </verify>
  <done>All test branches pass. `pnpm vitest run tests/provider-detect.test.ts` exits 0 with all tests green. No existing tests broken.</done>
</task>

<task type="auto">
  <name>Task 3: Wire detectProvider() into run-foreground.ts for debug logging</name>
  <files>src/client/run-foreground.ts</files>
  <action>
Add a single import at the top of src/client/run-foreground.ts:
  import { detectProvider } from '../providers/detect.js';

Inside runForegroundClient(), add a detectProvider() call immediately before the await ensureDaemon(socketPath) line. Store the result and log it:

  const detectedProvider = await detectProvider();
  void appendDebugLog('client', 'provider detected', { kind: detectedProvider.kind });

This is the only change to run-foreground.ts. Do not modify any other logic, do not change which provider is used, and do not gate any existing behaviour on the detection result.

The call position: after the request is parsed and logged (after the `void appendDebugLog('client', 'request parsed', request)` line), before `await ensureDaemon(socketPath)`.
  </action>
  <verify>
    <automated>cd /Users/samuel/dev/tui-llm && npx tsc --noEmit 2>&1 | grep run-foreground | head -10 && pnpm vitest run tests/client-result.test.ts 2>&1 | tail -10</automated>
  </verify>
  <done>run-foreground.ts compiles cleanly. Existing client-result tests still pass (ensureDaemon is mocked, detectProvider will resolve to { kind: 'none' } in the test environment where env vars are unset). Debug log now captures provider detection on every invocation.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| env → detect | ANTHROPIC_API_KEY and OPENAI_API_KEY are read from process.env; values are only tested for truthiness, never logged |
| fs → detect | ~/.claude/ directory stat is read-only; no credentials content is read |
| network → detect | Ollama health check hits localhost only, with a 300ms hard timeout |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-vfd-01 | Information Disclosure | appendDebugLog 'provider detected' | accept | Only { kind } is logged — no key values, no file contents |
| T-vfd-02 | Denial of Service | Ollama fetch with 300ms timeout | mitigate | AbortSignal.timeout(300) hard-caps the network call; waterfall continues on any error |
| T-vfd-03 | Tampering | execSync('which claude') | accept | Read-only PATH lookup; no shell expansion; output ignored, only exit code matters |
</threat_model>

<verification>
Run the full test suite to confirm no regressions:

```
cd /Users/samuel/dev/tui-llm && pnpm vitest run 2>&1 | tail -20
```

Confirm detect.ts and index.ts are present:

```
ls /Users/samuel/dev/tui-llm/src/providers/
```

Confirm detectProvider import appears in run-foreground.ts:

```
grep -n "detectProvider" /Users/samuel/dev/tui-llm/src/client/run-foreground.ts
```
</verification>

<success_criteria>
- src/providers/detect.ts exports DetectedProvider union and detectProvider() function
- src/providers/index.ts re-exports detect.ts and provider.ts
- All 5 waterfall branches covered by passing vitest tests (7+ test cases)
- run-foreground.ts calls detectProvider() before ensureDaemon() and logs { kind }
- TypeScript compiles cleanly (npx tsc --noEmit exits 0)
- Full test suite passes with no regressions
</success_criteria>

<output>
Create `.planning/quick/260522-vfd-prototype-provider-detection/260522-vfd-SUMMARY.md` when done.
</output>
