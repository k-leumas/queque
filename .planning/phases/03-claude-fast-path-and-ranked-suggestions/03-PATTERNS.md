# Phase 3: Claude Fast Path and Ranked Suggestions - Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 9 (1 new, 8 modified)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/providers/provider.ts` (NEW) | interface/contract | — | `src/context/provider.ts` | exact (same interface pattern) |
| `src/providers/claude.ts` | service | request-response | itself (refactor in place) | self |
| `src/contracts/request.ts` | contract/schema | — | `src/contracts/shell.ts` | exact (same Zod extend pattern) |
| `src/contracts/shell.ts` | contract/schema | — | itself (discriminatedUnion extension) | self |
| `src/registry/bootstrap.ts` | config/registry | — | itself (add one registration call) | self |
| `shell/zsh/qq.zsh` | middleware/shell | event-driven | itself (`case` block extension) | self |
| `tests/claude-provider.test.ts` | test | request-response | itself (update mocks) | self |
| `tests/shell-contract.test.ts` | test | — | itself (add positive case) | self |
| `tests/client-result.test.ts` | test | request-response | itself (add error variant test) | self |

---

## Pattern Assignments

### `src/providers/provider.ts` (NEW — interface/contract)

**Analog:** `src/context/provider.ts`

The project's established interface pattern for pluggable adapters. `ContextProvider` is a direct model for `LLMAdapter`: a named TypeScript interface with typed method(s), no class, no runtime overhead.

**Full analog file** (`src/context/provider.ts`, lines 1–25):
```typescript
import type {
  BaseContext,
  ContextChunk,
  IntentDecision,
  RequestIntent,
} from '../contracts/request.js';

export interface GatherContextInput {
  base: BaseContext;
  decision: IntentDecision;
}

export interface ContextProvider {
  id: string;
  intents: Array<RequestIntent | '*'>;
  gather(input: GatherContextInput): Promise<ContextChunk | null>;
}
```

**Pattern to copy for `LLMAdapter`:**
```typescript
// src/providers/provider.ts
import type { CandidateList } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';

export interface LLMAdapter {
  fetchCandidates(envelope: ContextEnvelope): Promise<CandidateList>;
}
```

Key conventions from analog:
- Import with `import type` (no runtime value needed)
- `.js` extension on all local imports (ESM project convention)
- Interface is the only export — no default export, no class
- Method signature is async (returns `Promise<T>`)

---

### `src/providers/claude.ts` (MODIFIED — service, request-response)

**Analog:** Itself, plus `src/context/providers/git-context.ts` (pattern for implementing an interface)

**Imports pattern** (current file, lines 1–6):
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { type CandidateList, candidateListSchema } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';
import { type ShellResult, shellResultSchema } from '../contracts/shell.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { readEnvValueFromDotEnvLocal } from '../shared/env-file.js';
```

After Phase 3, add `import type { LLMAdapter } from './provider.js';` and remove the `ShellResult`/`shellResultSchema` import (used only by `suggestShellResult` which is removed).

**Model selection — REMOVE** (lines 8–46, delete entirely):
```typescript
// DELETE: DEFAULT_MODEL = 'claude-sonnet-4-0'
// DELETE: CHEAPEST_FIRST_MODEL_IDS array
// DELETE: listAvailableModelIds()
// DELETE: chooseCheapestAvailableModel()
// DELETE: getCandidateModels()
```

**Model selection — REPLACE WITH** (D-07/D-08/D-09):
```typescript
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

function resolveModel(): string {
  return process.env.QQ_MODEL ?? readEnvValueFromDotEnvLocal('QQ_MODEL') ?? DEFAULT_MODEL;
}
```

**Existing `resolveModel` analog** — `shouldForceSelector()` (lines 65–69) uses the exact same env-var-then-dotenv pattern:
```typescript
function shouldForceSelector(): boolean {
  const configured =
    process.env.QQ_FORCE_SELECTOR ?? readEnvValueFromDotEnvLocal('QQ_FORCE_SELECTOR');
  return configured === '1' || configured === 'true';
}
```

**`fetchCandidates` core pattern** (lines 132–183) — keep all of this, replace the model loop:

Replace the `for (const model of models)` loop (lines 152–183) with a direct single call:
```typescript
const model = resolveModel();
try {
  const response = await client.messages.create({
    model,
    max_tokens: 256,
    temperature: 0,
    system:
      'You are Que-Que, a terminal shell assistant. Return ONLY a JSON array of command candidates, ranked with the most correct/direct command first. No prose, no markdown, no code fences.',
    messages: [{ role: 'user', content: prompt }],
  });
  const text = extractText(response.content);
  const candidates = ensureSelectableCandidates(parseCandidates(text));
  void appendDebugLog('provider', 'response parsed', {
    model,
    candidateCount: candidates.length,
    forceSelector: shouldForceSelector(),
  });
  return candidates;
} catch (error) {
  void appendDebugLog('provider', 'request failed', {
    model,
    message: error instanceof Error ? error.message : String(error),
  });
  throw error;
}
```

**`implements LLMAdapter` declaration** — add to the exported class or object, or export as a named const typed as `LLMAdapter`. Since the current code exports a standalone function (not a class), the simplest Phase 3 approach is to declare a class or object:
```typescript
export const claudeAdapter: LLMAdapter = {
  fetchCandidates,
};
// Keep the named function export for backward-compat with run-foreground.ts direct import
export { fetchCandidates };
```

**`suggestShellResult` — DELETE** (lines 185–197): zero external callers (grep-verified by RESEARCH.md). Remove entirely.

**Debug logging pattern** — keep all `appendDebugLog` calls unchanged. They are the only observability in the provider layer.

---

### `src/contracts/request.ts` (MODIFIED — contract/schema)

**Analog:** `src/contracts/request.ts` itself, `src/contracts/shell.ts`

**Existing `normalizedRequestSchema` extension pattern** (lines 29–33):
```typescript
export const normalizedRequestSchema = shellRequestSchema.extend({
  intent: requestIntentSchema,
});
export type NormalizedRequest = z.infer<typeof normalizedRequestSchema>;
```

**Add `confidence` field** (D-04) — copy the `.extend()` chain, add one field:
```typescript
export const normalizedRequestSchema = shellRequestSchema.extend({
  intent: requestIntentSchema,
  confidence: z.number().min(0).max(1),
});
export type NormalizedRequest = z.infer<typeof normalizedRequestSchema>;
```

**`IntentDecision` already has `confidence`** (lines 57–62) — do not touch:
```typescript
export const intentDecisionSchema = z.object({
  intent: requestIntentSchema,
  confidence: z.number().min(0).max(1),
  signals: z.array(z.string()),
});
```

**Downstream construction site to update** — `src/client/run-foreground.ts` line 96:
```typescript
// BEFORE:
const normalized: NormalizedRequest = { ...request, intent: decision.intent };

// AFTER (D-04):
const normalized: NormalizedRequest = { ...request, intent: decision.intent, confidence: decision.confidence };
```

---

### `src/contracts/shell.ts` (MODIFIED — contract/schema)

**Existing `shellResultSchema` discriminated union** (lines 30–43, full file):
```typescript
export const shellResultSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('cancel'),
    })
    .strict(),
  z.object({
    kind: z.literal('replace-buffer'),
    lbuffer: z.string(),
    rbuffer: z.string(),
  }),
]);
export type ShellResult = z.infer<typeof shellResultSchema>;
```

**Add `error` variant** (D-11) — append to the union array:
```typescript
export const shellResultSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('cancel'),
    })
    .strict(),
  z.object({
    kind: z.literal('replace-buffer'),
    lbuffer: z.string(),
    rbuffer: z.string(),
  }),
  z.object({
    kind: z.literal('error'),
    message: z.string(),
  }),
]);
export type ShellResult = z.infer<typeof shellResultSchema>;
```

**No other changes to `shell.ts`** — `shellRequestSchema` is unchanged, `writeShellResult` in `result-writer.ts` requires no changes (it calls `shellResultSchema.parse()` — the schema extension is the only authoritative change).

---

### `src/registry/bootstrap.ts` (MODIFIED — config/registry)

**Analog:** The file itself. Pattern: call `register*()` inside `bootstrapBuiltins()`.

**Existing registration pattern** (lines 15–39):
```typescript
export function bootstrapBuiltins(): void {
  if (bootstrapped) {
    return;
  }
  bootstrapped = true;

  registerContextProvider(gitContextProvider);
  registerContextProvider(filesystemContextProvider);

  registerShellAdapter({
    id: 'zsh',
    shell: 'zsh',
    description: 'zsh ZLE widget adapter (Phase 2 built-in)',
  });

  registerStorageHook({ id: 'noop', description: 'No-op storage hook (default — no persistence)' });
  registerStorageHook({ id: 'memory', description: 'In-memory storage hook (test and ephemeral use)' });
}
```

**Add claude adapter registration** — same pattern as `registerProviderBackend` in `src/registry/provider-backends.ts`:
```typescript
import { registerProviderBackend } from './provider-backends.js';

// Inside bootstrapBuiltins(), after existing registrations:
registerProviderBackend({
  id: 'claude',
  name: 'Claude (Anthropic)',
  description: 'Anthropic Claude adapter — default LLM backend',
});
```

**Registry interface for reference** (`src/registry/provider-backends.ts`, lines 16–38):
```typescript
export function registerProviderBackend(descriptor: ProviderBackendDescriptor): void {
  if (registry.has(descriptor.id)) {
    throw new Error(`Provider backend already registered: "${descriptor.id}"`);
  }
  registry.set(descriptor.id, descriptor);
}
```

The descriptor registry stores metadata only. The `LLMAdapter` instance (`claudeAdapter`) is accessed via direct import in `run-foreground.ts` — the registry is for discovery/listing, not instance resolution (per RESEARCH.md Open Question #1 resolution).

---

### `shell/zsh/qq.zsh` (MODIFIED — shell middleware, event-driven)

**Existing `_qq_apply_result` case block** (lines 95–121):
```zsh
case "$kind" in
  cancel)
    LBUFFER="$QQ_ORIG_LBUFFER"
    RBUFFER="$QQ_ORIG_RBUFFER"
    return 0
    ;;
  replace-buffer)
    local new_lbuffer new_rbuffer
    new_lbuffer=$(jq -r '.lbuffer // empty' "$result_file" 2>/dev/null)
    new_rbuffer=$(jq -r '.rbuffer // ""' "$result_file" 2>/dev/null)
    if [[ $? -ne 0 ]]; then
      LBUFFER="$QQ_ORIG_LBUFFER"
      RBUFFER="$QQ_ORIG_RBUFFER"
      return 1
    fi
    LBUFFER="$new_lbuffer"
    RBUFFER="$new_rbuffer"
    return 0
    ;;
  *)
    LBUFFER="$QQ_ORIG_LBUFFER"
    RBUFFER="$QQ_ORIG_RBUFFER"
    return 1
    ;;
esac
```

**Add `error)` case** — insert before the `*)` wildcard (D-11, Pitfall 4):
```zsh
  error)
    # Error kind — restore original buffers, no mutation (D-11)
    LBUFFER="$QQ_ORIG_LBUFFER"
    RBUFFER="$QQ_ORIG_RBUFFER"
    return 0
    ;;
```

**Existing `qq-question-widget` inline case block** (lines 204–220) — same pattern, both must be updated:
```zsh
  case "$kind" in
    cancel)
      LBUFFER="$QQ_ORIG_LBUFFER"
      RBUFFER="$QQ_ORIG_RBUFFER"
      ;;
    replace-buffer)
      new_lbuffer=$(printf '%s' "$result" | jq -r '.lbuffer // empty' 2>/dev/null)
      new_rbuffer=$(printf '%s' "$result" | jq -r '.rbuffer // ""'    2>/dev/null)
      LBUFFER="$new_lbuffer"
      RBUFFER="$new_rbuffer"
      ;;
    *)
      LBUFFER="$QQ_ORIG_LBUFFER"
      RBUFFER="$QQ_ORIG_RBUFFER"
      ;;
  esac
```

Add `error)` before `*)` in the widget block as well:
```zsh
    error)
      LBUFFER="$QQ_ORIG_LBUFFER"
      RBUFFER="$QQ_ORIG_RBUFFER"
      ;;
```

**Both locations must be updated** — the helper (`_qq_apply_result`) is used by tests; the widget inline block is used at runtime. Divergence causes test pass / runtime fail (Pitfall 4 from RESEARCH.md).

---

### `tests/claude-provider.test.ts` (MODIFIED — unit test)

**Current mock setup to REMOVE** (lines 4–9, 12–24, 53–54):
```typescript
// REMOVE: modelListMock from vi.hoisted()
// REMOVE: models: { list: typeof modelListMock } from AnthropicMock
// REMOVE: modelListMock.mockReset() from beforeEach
```

**Current test assertions to REMOVE** — any assertion on `modelListMock`:
```typescript
// REMOVE in test "returns candidate JSON from Claude...":
expect(modelListMock).toHaveBeenCalledTimes(1);
// and:
modelListMock.mockImplementation(async function* () { ... });
```

**Keep** — `createMock`, `anthropicCtorMock`, the mock of `@anthropic-ai/sdk`, `buildEnvelope()`, and all non-model-list assertions.

**ADD — hardcoded model assertion** (D-09):
```typescript
it('uses claude-haiku-4-5-20251001 as the default model', async () => {
  createMock.mockResolvedValue({
    content: [{ type: 'text', text: '[{"command":"git status","explanation":"Show repo status"}]' }],
  });

  const { fetchCandidates } = await import('../src/providers/claude.js');
  await fetchCandidates(buildEnvelope(), '');

  const request = createMock.mock.calls[0][0];
  expect(request.model).toBe('claude-haiku-4-5-20251001');
});

it('uses QQ_MODEL env var when set', async () => {
  process.env.QQ_MODEL = 'claude-opus-custom';
  createMock.mockResolvedValue({
    content: [{ type: 'text', text: '[{"command":"git status","explanation":""}]' }],
  });

  const { fetchCandidates } = await import('../src/providers/claude.js');
  await fetchCandidates(buildEnvelope(), '');

  const request = createMock.mock.calls[0][0];
  expect(request.model).toBe('claude-opus-custom');
});
```

**Pattern for `beforeEach` cleanup after adding `QQ_MODEL` test** (already present at line 49):
```typescript
beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  delete process.env.QQ_MODEL;          // already there, keep
  delete process.env.QQ_FORCE_SELECTOR; // keep
  createMock.mockReset();
  anthropicCtorMock.mockClear();
  // Remove: modelListMock.mockReset()
});
```

---

### `tests/shell-contract.test.ts` (MODIFIED — unit test)

**Existing positive test pattern** (lines 5–22) for reference:
```typescript
it('accepts {kind: cancel} and rejects buffer fields on cancel', () => {
  const validCancel = shellResultSchema.safeParse({ kind: 'cancel' });
  expect(validCancel.success).toBe(true);
  // ...
});
```

**ADD — positive test for `error` variant** (D-11, Pitfall 2):
```typescript
it('accepts {kind: error, message} ShellResult', () => {
  const validError = shellResultSchema.safeParse({
    kind: 'error',
    message: 'Que-Que: API unreachable — press any key',
  });
  expect(validError.success).toBe(true);
  expect(validError.data).toEqual({
    kind: 'error',
    message: 'Que-Que: API unreachable — press any key',
  });
});

it('rejects error variant without message field', () => {
  const noMessage = shellResultSchema.safeParse({ kind: 'error' });
  expect(noMessage.success).toBe(false);
});
```

---

### `tests/client-result.test.ts` (MODIFIED — integration test)

**Existing mock declaration for `fetchCandidates`** (lines 28–30) — keep as-is:
```typescript
vi.mock('../src/providers/claude.js', () => ({
  fetchCandidates: vi.fn(),
}));
```

**Existing llm-mode test pattern** (lines 322–360) for reference — shows `fetchCandidates` mock + `runForegroundClient` + result file read:
```typescript
it('emits a replace-buffer result in llm mode and the shell applies it', async () => {
  const { fetchCandidates } = await import('../src/providers/claude.js');
  const mockedFetchCandidates = vi.mocked(fetchCandidates);
  mockedFetchCandidates.mockResolvedValue([{ command: 'git status', explanation: '' }]);

  const { runForegroundClient } = await import('../src/client/run-foreground.js');
  await runForegroundClient({ requestFile, resultFile, resultMode: 'llm' });

  const resultContent = fs.readFileSync(resultFile, 'utf-8');
  expect(JSON.parse(resultContent.trim())).toEqual({
    kind: 'replace-buffer', lbuffer: 'git status', rbuffer: '',
  });
});
```

**ADD — error ShellResult test** (D-10/D-11, Pitfall 2):
```typescript
it('writes error ShellResult to FIFO when fetchCandidates rejects', async () => {
  const { fetchCandidates } = await import('../src/providers/claude.js');
  vi.mocked(fetchCandidates).mockRejectedValue(new Error('API timeout'));

  const { runForegroundClient } = await import('../src/client/run-foreground.js');
  await runForegroundClient({ requestFile, resultFile, resultMode: 'llm' });

  const resultContent = fs.readFileSync(resultFile, 'utf-8');
  const parsed = JSON.parse(resultContent.trim());
  expect(parsed.kind).toBe('error');
  expect(parsed.message).toContain('API timeout');
  expect(parsed.message).toContain('Que-Que:');
});
```

Note: This test requires `run-foreground.ts` outer catch to write `{ kind: 'error', message }` instead of `{ kind: 'cancel' }` (D-10). The existing mock infrastructure at lines 13–103 is already in place — just add the test inside the `runForegroundClient` describe block.

---

## Shared Patterns

### Zod `.extend()` schema extension
**Source:** `src/contracts/request.ts` line 29, `src/contracts/shell.ts` line 30
**Apply to:** `src/contracts/request.ts` (confidence field), `src/contracts/shell.ts` (error variant)

Pattern: extend an existing schema with additional fields (`.extend()`) or add variants to a `z.discriminatedUnion` array. Never mutate a previously exported schema constant — always reassign and re-infer the type.

### ESM import conventions
**Source:** Every file in `src/`
**Apply to:** `src/providers/provider.ts` (new file)

All local imports use `.js` extension (not `.ts`). `import type` for type-only imports. No `require()`. No default exports from contract files.

### `appendDebugLog` usage
**Source:** `src/providers/claude.ts` lines 26–30, 145–151, 165–170, 174–178
**Apply to:** Any error handling path added to `claude.ts` or `run-foreground.ts`

```typescript
void appendDebugLog('client', 'llm request failed', { message });
```

Always `void`-prefix the call (fire-and-forget). Use category strings `'provider'` or `'client'` consistently with existing calls.

### Error message format (D-12)
**Source:** CONTEXT.md D-12
**Apply to:** `src/client/run-foreground.ts` outer catch, inner `.catch()` error render

```typescript
`Que-Que: ${message} — press any key`
```

Apply consistently in both the outer catch (FIFO write) and the inner `.catch()` (Ink rerender with error state).

### Registry `register/get/list/clear` pattern
**Source:** `src/registry/provider-backends.ts` lines 16–38
**Apply to:** `src/registry/bootstrap.ts` (add one `registerProviderBackend` call)

The registry guard `if (registry.has(descriptor.id)) { throw ... }` prevents double-registration. `bootstrapBuiltins()` is idempotent via the `bootstrapped` flag — no additional guarding needed in callers.

### Test isolation — `beforeEach` env cleanup
**Source:** `tests/claude-provider.test.ts` lines 47–54
**Apply to:** New `QQ_MODEL` env-override test case

```typescript
beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  delete process.env.QQ_MODEL;
  // ...
});
```

Always `delete process.env.QQ_MODEL` in `beforeEach` so tests that set it do not leak into subsequent tests.

---

## No Analog Found

All files have analogs or are self-referential modifications. No files require patterns from RESEARCH.md alone.

---

## Pitfall Quick Reference (from RESEARCH.md)

| Pitfall | File | Guard |
|---------|------|-------|
| `NormalizedRequest` construction missing `confidence` | `run-foreground.ts` line 96 | Add `confidence: decision.confidence` alongside `intent` |
| `shellResultSchema` tests fail after `error` variant added | `shell-contract.test.ts` | Add positive test AND update any negative "closed set" assertion |
| `writeShellResult` rejects `error` kind | `result-writer.ts` / `shell.ts` | Extend schema before writing; schema is the only change needed |
| ZSH wildcard already handles `error` silently | `qq.zsh` lines 95–121 and 204–220 | Update BOTH `_qq_apply_result` AND `qq-question-widget` inline case |
| Import path collision `src/context/provider.ts` vs `src/providers/provider.ts` | new file | New file goes in `src/providers/provider.ts` — different directory |
| `claude-provider.test.ts` `modelListMock` must be removed | `tests/claude-provider.test.ts` | Remove from `vi.hoisted()`, `AnthropicMock`, and `beforeEach` |

---

## Metadata

**Analog search scope:** `src/providers/`, `src/contracts/`, `src/registry/`, `src/context/`, `src/client/`, `src/intent/`, `shell/zsh/`, `tests/`
**Files read:** 14 source files + 3 test files
**Pattern extraction date:** 2026-05-14
