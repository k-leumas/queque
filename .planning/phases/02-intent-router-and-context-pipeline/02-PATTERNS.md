# Phase 2: Intent Router and Context Pipeline - Pattern Map

**Mapped:** 2026-05-01
**Files analyzed:** 13 new/modified files
**Analogs found:** 11 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/contracts/request.ts` | contract/model | transform | `src/contracts/shell.ts` | role-match |
| `src/intent/router.ts` | utility | transform | `src/shared/vcs-context.ts` | partial (async transform returning typed decision) |
| `src/context/base-context.ts` | service | request-response | `src/shared/vcs-context.ts` | role-match |
| `src/context/provider.ts` | contract/model | — | `src/contracts/ipc.ts` | role-match (typed descriptor interface) |
| `src/context/pipeline.ts` | service | request-response | `src/client/run-foreground.ts` | partial (orchestrating sequential async steps) |
| `src/context/providers/git-context.ts` | service | request-response | `src/shared/vcs-context.ts` | exact (wraps detectVcsContext, adds changedFiles) |
| `src/context/providers/filesystem-context.ts` | service | request-response | `src/shared/vcs-context.ts` | role-match (async context gatherer, returns typed chunk or null) |
| `src/registry/context-providers.ts` | utility | — | `src/daemon/server.ts` | partial (Map-based dispatch table pattern) |
| `src/registry/provider-backends.ts` | utility | — | `src/daemon/server.ts` | partial |
| `src/registry/shell-adapters.ts` | utility | — | `src/daemon/server.ts` | partial |
| `src/registry/storage-hooks.ts` | utility | — | `src/daemon/server.ts` | partial |
| `src/client/run-foreground.ts` (modify) | service | request-response | self | exact |
| `src/providers/claude.ts` (modify) | service | request-response | self | exact |
| `tests/intent-router.test.ts` | test | — | `tests/shell-contract.test.ts` | role-match (pure unit tests, no mocking needed) |
| `tests/context-pipeline.test.ts` | test | — | `tests/claude-provider.test.ts` | role-match (vi.mock + async import pattern) |
| `tests/registry.test.ts` | test | — | `tests/shell-contract.test.ts` | role-match |

---

## Pattern Assignments

### `src/contracts/request.ts` (contract/model, transform)

**Analog:** `src/contracts/shell.ts`

**Imports pattern** (`src/contracts/shell.ts` lines 1):
```typescript
import { z } from 'zod';
```

**Core Zod schema pattern** (`src/contracts/shell.ts` lines 8-17):
```typescript
export const shellRequestSchema = z.object({
  version: z.literal(1),
  ttyPath: z.string(),
  cwd: z.string(),
  shellPid: z.number().int().positive(),
  lbuffer: z.string(),
  rbuffer: z.string(),
});

export type ShellRequest = z.infer<typeof shellRequestSchema>;
```

**Key pattern:** Every exported type is `z.infer<typeof schema>`. Schemas are named `<TypeName>Schema` in camelCase. Types are named in PascalCase. File exports only schemas and their inferred types — no runtime logic.

**Apply to `src/contracts/request.ts`:** Define `normalizedRequestSchema`, `intentDecisionSchema`, `baseContextSchema`, `contextChunkSchema`, and `contextEnvelopeSchema` using this exact pattern. Export `RequestIntent` as a `z.enum([...])` schema plus inferred type.

---

### `src/intent/router.ts` (utility, transform)

**Analog:** `src/shared/vcs-context.ts`

**Imports pattern** (`src/shared/vcs-context.ts` lines 1-3):
```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
```

The intent router is pure synchronous logic — no Node built-in imports needed. Import only the contract types:
```typescript
import { type NormalizedRequest, type IntentDecision, RequestIntent } from '../contracts/request.js';
```

**Core pure-function pattern** (`src/shared/vcs-context.ts` lines 28-46):
```typescript
export async function detectVcsContext(cwd: string): Promise<VcsContext> {
  const insideWorkTree = await runGit(cwd, ['rev-parse', '--is-inside-work-tree']);

  if (insideWorkTree !== 'true') {
    return { kind: 'none', cwd };
  }
  // ...
  return {
    kind: 'git',
    cwd,
    root,
    branch,
    dirty,
  };
}
```

**Key pattern:** Named export of a single primary async function. Uses early-return for base cases. Returns a typed discriminated union. The router equivalent: `export function classifyIntent(request: NormalizedRequest): IntentDecision` — synchronous not async (D-04: no LLM calls). Internal helper arrays/regexes are module-level constants, not exported.

---

### `src/context/base-context.ts` (service, request-response)

**Analog:** `src/shared/vcs-context.ts`

**Imports pattern** (`src/shared/vcs-context.ts` lines 1-3):
```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
```

For base-context, no child_process needed — all values come from the normalized request and `process` globals:
```typescript
import { type NormalizedRequest, type BaseContext } from '../contracts/request.js';
```

**Core function pattern** (`src/shared/vcs-context.ts` lines 28-32):
```typescript
export async function detectVcsContext(cwd: string): Promise<VcsContext> {
```

Apply as:
```typescript
export function buildBaseContext(request: NormalizedRequest): BaseContext {
  return {
    queryText: request.lbuffer.trim(),
    cwd: request.cwd,
    ttyPath: request.ttyPath,
    shellPid: request.shellPid,
    shellName: 'zsh',
    platform: process.platform,
    timestamp: new Date().toISOString(),
  };
}
```

Synchronous — base context requires no I/O. `shellName` is hardcoded `'zsh'` per CONTEXT.md specifics.

---

### `src/context/provider.ts` (contract/model, —)

**Analog:** `src/contracts/ipc.ts`

**Imports pattern** (`src/contracts/ipc.ts` lines 1-2):
```typescript
import { z } from 'zod';
import { shellRequestSchema } from './shell.js';
```

**Typed descriptor interface pattern** (`src/contracts/ipc.ts` lines 7-20):
```typescript
export const ipcRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('ping'),
  }),
  z.object({
    kind: z.literal('run-query'),
    request: shellRequestSchema,
  }),
]);

export type IpcRequest = z.infer<typeof ipcRequestSchema>;
```

**Key pattern:** Use `z.discriminatedUnion` or `z.object` for descriptor shapes. Export both schema and inferred type. This file should export the `ContextProvider` interface (as a TypeScript `interface`, not a Zod schema, since provider implementations can't be validated at runtime) plus `GatherContextInput` and `ContextChunk` as Zod schemas with inferred types.

---

### `src/context/pipeline.ts` (service, request-response)

**Analog:** `src/client/run-foreground.ts`

**Imports pattern** (`src/client/run-foreground.ts` lines 1-7):
```typescript
import * as fsp from 'node:fs/promises';
import { shellRequestSchema } from '../contracts/shell.js';
import { ensureDaemon } from '../daemon/bootstrap.js';
import { suggestShellResult } from '../providers/claude.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { socketPathForUid } from '../shared/socket-path.js';
import { writeShellResult } from './result-writer.js';
```

**Sequential async orchestration pattern** (`src/client/run-foreground.ts` lines 36-102):
```typescript
export async function runForegroundClient(args: ForegroundClientArgs): Promise<void> {
  // ...
  void appendDebugLog('client', 'foreground start', { ... });

  try {
    // Step 1
    const request = shellRequestSchema.parse(JSON.parse(raw.trim()));
    void appendDebugLog('client', 'request parsed', request);

    // Step 2
    await ensureDaemon(socketPath);
    void appendDebugLog('client', 'daemon ensured', { socketPath });

    // Step 3 (branching)
    if (resultMode === 'llm') {
      try {
        const shellResult = await suggestShellResult(request);
        // ...
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void appendDebugLog('client', 'llm request failed; falling back to cancel', { message });
        await writeShellResult(resultFile, { kind: 'cancel' });
      }
    }
  } finally {
    await ttyHandle.close();
  }
}
```

**Key patterns to copy:**
- `void appendDebugLog(...)` at every step boundary (non-blocking, fire-and-forget)
- Named exported async function with typed args interface
- try/catch in the LLM call with graceful fallback
- Sequential pipeline: parse → validate → step-1 → step-2 → step-3

Apply as `export async function gatherContext(request: NormalizedRequest): Promise<ContextEnvelope>`:
1. Build base context (unconditional)
2. Classify intent
3. Query registry for providers matching intent
4. Run each matching provider, collect chunks
5. Return assembled envelope

---

### `src/context/providers/git-context.ts` (service, request-response)

**Analog:** `src/shared/vcs-context.ts` — this file IS the direct evolution of that analog.

**Full existing pattern** (`src/shared/vcs-context.ts` lines 1-46 — full file):
```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type VcsContext = ...;

async function runGit(cwd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function detectVcsContext(cwd: string): Promise<VcsContext> {
  const insideWorkTree = await runGit(cwd, ['rev-parse', '--is-inside-work-tree']);
  if (insideWorkTree !== 'true') {
    return { kind: 'none', cwd };
  }
  const root = (await runGit(cwd, ['rev-parse', '--show-toplevel'])) ?? cwd;
  const branch = (await runGit(cwd, ['branch', '--show-current'])) || null;
  const dirty = Boolean((await runGit(cwd, ['status', '--porcelain=v1']))?.length);
  return { kind: 'git', cwd, root, branch, dirty };
}
```

**What to keep:** `runGit` helper, `execFileAsync`, the early-return on `insideWorkTree !== 'true'`.

**What to add for D-07/D-08:** After fetching `dirty`, add:
```typescript
const statusOutput = await runGit(cwd, ['status', '--porcelain']);
const changedFiles = statusOutput
  ? statusOutput.split('\n').filter(Boolean).map((line) => line.slice(3))
  : [];
```

**Provider interface shape** (new — no existing analog):
```typescript
export const gitContextProvider: ContextProvider = {
  id: 'git-context',
  intents: ['codebase', 'shell-command'],  // shell-command with git prefix per D-09
  async gather(input: GatherContextInput): Promise<ContextChunk | null> {
    const vcs = await detectVcsContext(input.base.cwd);
    if (vcs.kind === 'none') return null;
    return { kind: 'git', payload: { ...vcs, changedFiles } };
  },
};
```

Note: per D-09, the pipeline must gate `shell-command` git-context on whether `queryText` starts with `git `. The provider itself declares `intents: ['codebase', 'shell-command']` but the pipeline or the provider's `gather` can short-circuit based on the intent decision's signals.

---

### `src/context/providers/filesystem-context.ts` (service, request-response)

**Analog:** `src/shared/vcs-context.ts`

**Core pattern to copy:** The async function returning typed chunk or null — same shape as `detectVcsContext` returning `{ kind: 'none' }` as the null case.

**Key differences:**
- D-10: string parse only, no disk I/O
- Extracts `apparentFilename` from `queryText` via regex token scan
- Returns `{ kind: 'filesystem', payload: { cwd, apparentFilename } }` or `null`

```typescript
// No child_process import — pure string parse
import { type ContextProvider, type ContextChunk, type GatherContextInput } from '../provider.js';

const FILENAME_RE = /\b[\w.-]+\.\w{2,6}\b/g;  // matches token.ext patterns

export const filesystemContextProvider: ContextProvider = {
  id: 'filesystem-context',
  intents: ['filesystem'],
  async gather(input: GatherContextInput): Promise<ContextChunk | null> {
    const match = input.base.queryText.match(FILENAME_RE);
    return {
      kind: 'filesystem',
      payload: {
        cwd: input.base.cwd,
        apparentFilename: match?.[0] ?? null,
      },
    };
  },
};
```

---

### `src/registry/context-providers.ts` (utility, —)

**Analog:** `src/daemon/server.ts` — shares the Map-based dispatch / switch pattern.

**Map dispatch pattern** (`src/daemon/server.ts` lines 58-77):
```typescript
switch (req.kind) {
  case 'ping': {
    socket.write(JSON.stringify({ kind: 'pong' }) + '\n');
    void appendDebugLog('daemon', 'replied pong');
    break;
  }
  case 'run-query': {
    const requestId = Math.random().toString(36).slice(2);
    socket.write(JSON.stringify({ kind: 'query-accepted', requestId }) + '\n');
    break;
  }
}
```

The registry is a typed Map, not a switch — but the underlying pattern is the same (id → handler lookup). Per RESEARCH.md "Make registries boring":

```typescript
import { type ContextProvider } from '../context/provider.js';

const registry = new Map<string, ContextProvider>();

export function registerContextProvider(descriptor: ContextProvider): void {
  if (registry.has(descriptor.id)) {
    throw new Error(`Context provider already registered: "${descriptor.id}"`);
  }
  registry.set(descriptor.id, descriptor);
}

export function getContextProvider(id: string): ContextProvider | undefined {
  return registry.get(id);
}

export function listContextProviders(): ContextProvider[] {
  return Array.from(registry.values());
}
```

**Note on duplicate-ID error:** CONTEXT.md Claude's Discretion specifies "throw with explicit error message including the conflicting ID" — the above error message template satisfies this.

**Apply the same Map + register/get/list shape to all four registry files.** Only the descriptor type differs.

---

### `src/client/run-foreground.ts` (modify)

**Analog:** self — read lines 80-94 for the LLM call block to rewire.

**Current LLM call block** (lines 80-94):
```typescript
} else if (resultMode === 'llm') {
  try {
    const shellResult = await suggestShellResult(request);
    await writeShellResult(resultFile, shellResult);
    void appendDebugLog('client', 'wrote llm result', {
      resultFile,
      kind: shellResult.kind,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void appendDebugLog('client', 'llm request failed; falling back to cancel', {
      message,
    });
    await writeShellResult(resultFile, { kind: 'cancel' });
  }
}
```

**What changes:** Insert normalization and context pipeline before `suggestShellResult`. The normalized request replaces the raw `ShellRequest` passed to the provider. Keep the try/catch + cancel fallback pattern unchanged. Keep `void appendDebugLog(...)` at each new step boundary.

---

### `src/providers/claude.ts` (modify)

**Analog:** self — read `buildPrompt` (lines 62-86) and `suggestShellResult` (lines 98-150).

**Current `buildPrompt` signature** (lines 62-65):
```typescript
function buildPrompt(
  request: ShellRequest,
  vcsContext: Awaited<ReturnType<typeof detectVcsContext>>,
): string {
```

**What changes:** Replace `ShellRequest` + `vcsContext` parameters with a `ContextEnvelope`. Remove the `detectVcsContext` import and call. The prompt string assembly using `JSON.stringify` with indentation stays — just change the data source from inline detection to the pre-assembled envelope passed in.

**Pattern to keep** (lines 109-113):
```typescript
void appendDebugLog('provider', 'request start', {
  models,
  cwd: request.cwd,
  versionControl: vcsContext,
});
```

Keep `void appendDebugLog(...)` calls, update their payload fields to reference the context envelope instead.

---

### `tests/intent-router.test.ts` (test)

**Analog:** `tests/shell-contract.test.ts`

**Pure unit test pattern** (`tests/shell-contract.test.ts` lines 1-5):
```typescript
import { describe, it, expect } from 'vitest';
import { shellResultSchema, shellRequestSchema } from '../src/contracts/shell.js';
import { socketPathForUid } from '../src/shared/socket-path.js';
```

**Test structure** (lines 6-73):
```typescript
describe('shellResultSchema', () => {
  it('accepts {kind: cancel} and rejects buffer fields on cancel', () => {
    const validCancel = shellResultSchema.safeParse({ kind: 'cancel' });
    expect(validCancel.success).toBe(true);
    // ...
  });
});
```

**Key pattern:** No vi.mock, no async imports — direct static imports. Tests exercise pure synchronous functions with table-driven `it` blocks. One `describe` per exported function.

**Apply to `tests/intent-router.test.ts`:** Import `classifyIntent` directly. One `describe('classifyIntent', ...)` with individual `it` cases per intent category: shell-command, codebase (with file path), codebase (with package manager prefix), filesystem, general/unknown. Include an `it` for the D-01 negative case (code verbs alone not triggering codebase).

---

### `tests/context-pipeline.test.ts` (test)

**Analog:** `tests/claude-provider.test.ts`

**vi.hoisted + vi.mock pattern** (`tests/claude-provider.test.ts` lines 1-31):
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createMock, vcsMock } = vi.hoisted(() => {
  const createMock = vi.fn();
  const vcsMock = vi.fn();
  return { createMock, vcsMock };
});

vi.mock('../src/shared/vcs-context.js', () => ({
  detectVcsContext: vcsMock,
}));
```

**Async dynamic import pattern** (`tests/claude-provider.test.ts` lines 67-68):
```typescript
const { suggestShellResult } = await import('../src/providers/claude.js');
const result = await suggestShellResult({ ... });
```

**Key pattern:** `vi.hoisted` creates stable mock references before `vi.mock`. Mock the git provider's `detectVcsContext` dependency. Use dynamic `await import(...)` inside `it` blocks to pick up mocked modules. `beforeEach` resets all mocks.

**Apply to `tests/context-pipeline.test.ts`:** Mock `detectVcsContext` for the git provider. Test that `gatherContext` returns git chunk only when intent is `codebase` or `shell-command` starting with `git `. Test that filesystem intent returns filesystem chunk, not git chunk.

---

### `tests/registry.test.ts` (test)

**Analog:** `tests/shell-contract.test.ts` (pure synchronous unit tests)

**Pattern:** Direct imports, no mocking. Test `register` happy path, `get` lookup, `list` returns all registered entries, duplicate `register` throws with the conflicting ID in the message.

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
// import registry under test with dynamic import or direct import
// reset registry state in beforeEach via a reset export or by re-importing
```

Note: registry state is module-level, so tests need either a `clearRegistry()` export or to use `vi.resetModules()` in `beforeEach` to get a fresh registry each test.

---

## Shared Patterns

### Debug Logging
**Source:** `src/shared/debug-log.ts`
**Apply to:** All new service and provider files

```typescript
import { appendDebugLog } from '../shared/debug-log.js';

// Fire-and-forget — NEVER await in the hot path
void appendDebugLog('scope', 'event description', { ...details });
```

The scope string convention observed in the codebase: `'client'`, `'provider'`, `'daemon'`. New scopes for Phase 2: `'intent'`, `'context'`, `'registry'`.

### Zod Schema + Inferred Type Export
**Source:** `src/contracts/shell.ts` and `src/contracts/ipc.ts`
**Apply to:** `src/contracts/request.ts`, `src/context/provider.ts`

```typescript
export const fooSchema = z.object({ ... });
export type Foo = z.infer<typeof fooSchema>;
```

Never export the type without the schema. Never use `interface` for data contracts that cross module boundaries — use Zod + inferred type.

### `.js` Extension on All Relative Imports
**Source:** Every existing file in the codebase
**Apply to:** All new files

```typescript
// Correct
import { appendDebugLog } from '../shared/debug-log.js';
import { type ShellRequest } from '../contracts/shell.js';

// Wrong — omitting .js breaks ESM resolution
import { appendDebugLog } from '../shared/debug-log';
```

All relative imports use `.js` extension even for `.ts` source files. This is the ESM TypeScript convention used throughout the project.

### Error Handling — try/catch with Fire-and-Forget Debug Log
**Source:** `src/client/run-foreground.ts` lines 88-93
**Apply to:** `src/context/pipeline.ts`, provider `gather` implementations

```typescript
try {
  const result = await someAsyncOp();
  void appendDebugLog('scope', 'success', { result });
  return result;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  void appendDebugLog('scope', 'failed', { message });
  // Return null or fallback, do not rethrow unless caller must handle
}
```

Provider `gather` functions should return `null` on errors (not throw), so the pipeline can continue with other providers.

### Named Export Functions (no default exports)
**Source:** All files in `src/`
**Apply to:** All new files

```typescript
// Correct
export function classifyIntent(...) { ... }
export async function gatherContext(...) { ... }
export const gitContextProvider: ContextProvider = { ... };

// Wrong — not used anywhere in the codebase
export default function classifyIntent(...) { ... }
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/context/provider.ts` (interface portion) | contract | — | No existing TypeScript `interface` for async pluggable descriptors; closest is the Zod discriminated union in `ipc.ts` but providers are not data-only |

---

## Metadata

**Analog search scope:** `src/`, `tests/`
**Files scanned:** 14 source files, 6 test files
**Pattern extraction date:** 2026-05-01
