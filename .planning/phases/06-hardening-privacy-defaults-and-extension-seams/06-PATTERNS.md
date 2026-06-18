# Phase 6: Hardening, Privacy Defaults, and Extension Seams - Pattern Map

**Mapped:** 2026-06-17
**Files analyzed:** 14 (8 modify, 4 test extend, 2 audit-only)
**Analogs found:** 12 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/registry/provider-backends.ts` | utility | transform | `src/registry/context-providers.ts` | exact |
| `src/registry/bootstrap.ts` | config | transform | `src/registry/bootstrap.ts` (self — extend) | exact |
| `src/client/run-foreground.ts` | service | request-response | `src/client/run-foreground.ts` (self — rewire provider lookup) | exact |
| `src/providers/claude.ts` | provider | request-response | `src/providers/claude.ts` (self — prompt privacy) | exact |
| `src/context/pipeline.ts` | service | request-response | `src/context/pipeline.ts` (self — privacy filter hook) | exact |
| `src/contracts/request.ts` | model | transform | `src/contracts/request.ts` (self — D-05/D-06 docs) | exact |
| `src/cli/commands/init.ts` | controller | request-response | `src/registry/shell-adapters.ts` + `src/registry/bootstrap.ts` | role-match |
| `shell/zsh/queque.zsh` | hook | event-driven | `shell/zsh/queque.zsh` (self — CMD-04 audit) | exact |
| `src/cli/main.ts` | middleware | event-driven | `src/cli/main.ts` (self — audit FIFO safety net) | exact |
| `src/providers/detect.ts` | utility | request-response | `src/registry/provider-backends.ts` | partial |
| `tests/registry-bootstrap.test.ts` | test | — | `tests/registry-bootstrap.test.ts` (self — extend) | exact |
| `tests/context-pipeline.test.ts` | test | request-response | `tests/context-pipeline.test.ts` (self — extend) | exact |
| `tests/claude-provider.test.ts` | test | request-response | `tests/claude-provider.test.ts` (self — extend) | exact |
| `tests/zsh-widget.test.ts` | test | event-driven | `tests/zsh-widget.test.ts` (self — CMD-04 assertion) | exact |
| `src/providers/resolver.ts` (likely new) | utility | transform | `src/registry/context-providers.ts` | role-match |
| `docs/` or README expansion (06-03) | config | — | — | no analog |

---

## Pattern Assignments

### `src/registry/provider-backends.ts` (utility, transform — extend for adapter instances)

**Analog:** `src/registry/context-providers.ts` — the only registry that stores callable objects today.

**Imports pattern** (`context-providers.ts` lines 1–3):
```typescript
import type { ContextProvider } from '../context/provider.js';

const registry = new Map<string, ContextProvider>();
```

**Register/get/list/clear pattern** (`context-providers.ts` lines 5–27):
```typescript
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

/** @internal For test isolation only — do not call in production code. */
export function clearContextProviders(): void {
  registry.clear();
}
```

**Current descriptor-only stub** (`provider-backends.ts` lines 8–22):
```typescript
export interface ProviderBackendDescriptor {
  id: string;
  name: string;
  description: string;
}

const registry = new Map<string, ProviderBackendDescriptor>();

export function registerProviderBackend(descriptor: ProviderBackendDescriptor): void {
  if (registry.has(descriptor.id)) {
    throw new Error(`Provider backend already registered: "${descriptor.id}"`);
  }
  registry.set(descriptor.id, descriptor);
}
```

**Phase 6 extension pattern:** Merge descriptor metadata + `LLMAdapter` instance into one registered object (mirror `ContextProvider`, which carries both `id` and `gather()`). Add `getProviderAdapter(id: string): LLMAdapter | undefined` alongside existing `getProviderBackend`. Keep duplicate-ID throw with ID in message — same template as context providers.

**Why:** Phase 3 deferred instance lookup to Phase 6 (`03-RESEARCH.md` Open Question #1). `run-foreground.ts` still bypasses the registry with a direct import.

---

### `src/registry/bootstrap.ts` (config, transform — extend)

**Analog:** itself — single grep-friendly registration site established in Phases 2–3.

**Idempotent guard + registration block** (lines 8–45):
```typescript
let bootstrapped = false;

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

  registerProviderBackend({
    id: 'claude',
    name: 'Claude (Anthropic)',
    description: 'Anthropic Claude adapter — default LLM backend',
  });
}

/** @internal For test isolation only — do not call in production code. */
export function resetBootstrap(): void {
  bootstrapped = false;
}
```

**Direct imports acceptable here only** — bootstrap is the one sanctioned coupling point (`02-03-PLAN.md`):
```typescript
import { filesystemContextProvider } from '../context/providers/filesystem-context.js';
import { gitContextProvider } from '../context/providers/git-context.js';
```

**Phase 6 addition:** After extending `provider-backends`, also import and bind `claudeAdapter`:
```typescript
import { claudeAdapter } from '../providers/claude.js';
// registerProviderBackend({ ...descriptor, adapter: claudeAdapter })
```

**Startup call site** (`src/cli/main.ts` lines 77–78):
```typescript
export async function main(argv = process.argv.slice(2)): Promise<void> {
  bootstrapBuiltins();
```

WR-002 fix: bootstrap runs once at CLI startup, not inside `gatherContext()`.

---

### `src/client/run-foreground.ts` (service, request-response — rewire provider + cleanup)

**Analog:** itself — preserve FIFO/`resolved` guard patterns from Phase 4; replace direct provider import.

**Registry bypass to fix** (line 10):
```typescript
import { fetchCandidates } from '../providers/claude.js';
```

**Target resolution pattern** — copy the pipeline's registry read (`pipeline.ts` lines 21–22):
```typescript
const providers = listContextProviders();

for (const provider of providers) {
```

Phase 6 equivalent: resolve default backend from registry after `bootstrapBuiltins()` (already called in `main()`):
```typescript
import { getProviderAdapter } from '../registry/provider-backends.js';

const adapter = getProviderAdapter('claude');
if (!adapter) {
  throw new Error('No LLM provider registered');
}
// adapter.fetchCandidates(envelope)
```

**`resolved` double-write guard — keep unchanged** (lines 211–238):
```typescript
let resolved = false;

onSelect: async (command: string, explanation: string) => {
  if (resolved) return;
  resolved = true;
  const { lbuffer, rbuffer } = buildShellBuffers(command, explanation);
  await writeShellResult(resultFile, {
    kind: 'replace-buffer',
    lbuffer,
    rbuffer,
    query: request.lbuffer,
  });
  unmount?.();
},
onCancel: async () => {
  if (resolved) return;
  resolved = true;
  await writeShellResult(resultFile, { kind: 'cancel' });
  unmount?.();
},
```

**Insertion-only contract — verify, do not change** (lines 226–231): `writeShellResult` with `kind: 'replace-buffer'` only; no `spawn`, `exec`, or shell invocation anywhere in this file.

**Dead scroll hack to remove** (lines 194–207 — non-Zellij branch only):
```typescript
const MODAL_VIEWPORT_LINES = 16;
if (ttyWriteStream && !inZellij) {
  ttyWriteStream.write('\n'.repeat(MODAL_VIEWPORT_LINES));
  ttyWriteStream.write(`\x1b[${MODAL_VIEWPORT_LINES}A`);
  ttyWriteStream.write('\x1b7');
}
```
Phase 4 deferred this cleanup; Phase 6 should delete the scroll reserve + `clearScrollReserve` when Zellij is the hard requirement, or gate behind explicit non-Zellij support decision.

**Error path — typed error ShellResult, buffers untouched in zsh** (lines 302–306):
```typescript
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  void appendDebugLog('client', 'llm request failed', { message });
  const errorMsg = `QueQue: ${message}`;
  await writeShellResult(resultFile, { kind: 'error', message: errorMsg });
}
```

---

### `src/providers/claude.ts` (provider, request-response — privacy-aware prompt)

**Analog:** itself — `buildPrompt` already consumes `ContextEnvelope`; extend to include all safe extras.

**Current prompt assembly — git-only** (lines 69–91):
```typescript
function buildPrompt(envelope: ContextEnvelope): string {
  const gitChunk = envelope.extras.find((chunk) => chunk.kind === 'git');

  return [
    'Return ONLY a JSON array of 1-3 shell command candidates, most likely first.',
    // ...
    'Shell context:',
    JSON.stringify(
      {
        cwd: envelope.base.cwd,
        queryText: envelope.base.queryText,
        platform: envelope.base.platform,
        shellName: envelope.base.shellName,
        ...(gitChunk ? { versionControl: gitChunk.payload } : {}),
      },
      null,
      2,
    ),
  ].join('\n');
}
```

**Gap:** `filesystem` chunks from `filesystemContextProvider` are gathered by the pipeline but never forwarded to the LLM. Phase 6 should include `apparentFilename` (metadata only — D-05 compliant) or explicitly document why it is excluded.

**Privacy-safe adapter export** (lines 155–157):
```typescript
export const claudeAdapter: LLMAdapter = {
  fetchCandidates,
};
```

**LLMAdapter contract** (`src/providers/provider.ts` lines 4–6):
```typescript
export interface LLMAdapter {
  fetchCandidates(envelope: ContextEnvelope): Promise<CandidateList>;
}
```

**Error re-throw pattern — preserve** (lines 146–152):
```typescript
} catch (error) {
  void appendDebugLog('provider', 'request failed', {
    model,
    message: error instanceof Error ? error.message : String(error),
  });
  throw error;
}
```

---

### `src/context/pipeline.ts` (service, request-response — privacy filter)

**Analog:** itself — provider loop with silent skip on null/error is the extension point.

**Registry-backed provider iteration** (lines 21–47):
```typescript
const extras: ContextEnvelope['extras'] = [];
const providers = listContextProviders();

for (const provider of providers) {
  const supportsAllIntents = provider.intents.includes('*');
  const supportsIntent = provider.intents.includes(decision.intent);

  if (!supportsAllIntents && !supportsIntent) {
    continue;
  }

  try {
    const chunk = await provider.gather({ base, decision });
    if (chunk !== null) {
      extras.push(chunk);
      void appendDebugLog('context', 'provider chunk gathered', {
        providerId: provider.id,
        kind: chunk.kind,
      });
    }
  } catch (error) {
    void appendDebugLog('context', 'provider error', {
      providerId: provider.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
```

**Phase 6 privacy hook:** Insert a filter between `chunk !== null` and `extras.push(chunk)` that validates against `contextChunkSchema` and rejects any chunk with forbidden fields (defense-in-depth beyond Zod — mirrors D-05/D-06). The existing test in `context-pipeline.test.ts` lines 132–142 already asserts no `content`/`bytes`/`text`/`lines` on git payloads — extend to filesystem and add a runtime filter if planners choose belt-and-suspenders.

**No bootstrap call here** — confirmed WR-002; tests must call `bootstrapBuiltins()` explicitly.

---

### `src/contracts/request.ts` (model, transform — privacy boundary documentation)

**Analog:** itself — structural D-05/D-06 enforcement via discriminated union.

**Privacy gate in schema comments + shape** (lines 65–94):
```typescript
/**
 * D-05/D-06 structural enforcement: neither variant has any field for file
 * content (bytes, text, lines). File names only. A future provider that needs
 * to include file content MUST add a new `kind` variant and will require an
 * explicit privacy review — it cannot sneak content in through the existing variants.
 */
export const contextChunkSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('git'),
    payload: z.object({
      cwd: z.string(),
      root: z.string(),
      branch: z.string().nullable(),
      dirty: z.boolean(),
      /** File paths only (from git status --porcelain). No diff content, no file bytes. */
      changedFiles: z.array(z.string()),
    }),
  }),
  z.object({
    kind: z.literal('filesystem'),
    payload: z.object({
      cwd: z.string(),
      /** Apparent filename extracted from query text. No file bytes read. */
      apparentFilename: z.string().nullable(),
    }),
  }),
]);
```

**Phase 6:** Document the deferred file-content opt-in gate (`02-CONTEXT.md` D-05/D-06) as a named future variant (e.g. `kind: 'file-content'` behind explicit user flag). Do not add the variant without the opt-in mechanism — only document the seam.

**Shell safety contract** (`shell.ts` lines 19–29):
```typescript
/**
 * Shell result — written by the qq client so the zsh widget can apply it.
 *
 * Three variants:
 *   cancel        — leave LBUFFER/RBUFFER untouched (Esc or dismiss)
 *   replace-buffer — overwrite LBUFFER and RBUFFER with the chosen command
 *   error         — provider or client error; message shown to user, buffers restored
 */
```

CMD-04 is enforced at the zsh layer: only `replace-buffer` mutates buffers; user presses Enter to execute.

---

### `src/context/providers/git-context.ts` + `filesystem-context.ts` (audit — privacy boundaries)

**Analog:** Phase 2 providers — reference implementations for privacy-safe gathering.

**Git provider — file names only, no content** (`git-context.ts` lines 55–70, 99–107):
```typescript
async function getChangedFiles(cwd: string): Promise<string[]> {
  try {
    assertSafeCwd(cwd);
    const { stdout } = await execFileAsync('git', ['-C', cwd, 'status', '--porcelain'], {
      encoding: 'utf8',
      timeout: GIT_TIMEOUT_MS,
    });
    return stdout.split('\n').filter(Boolean).map(parsePorcelainLine).filter(/* ... */);
  } catch {
    return [];
  }
}

return {
  kind: 'git',
  payload: { cwd: vcs.cwd, root: vcs.root, branch: vcs.branch, dirty: vcs.dirty, changedFiles },
};
```

**Filesystem provider — string parse only, no disk I/O** (`filesystem-context.ts` lines 6–18):
```typescript
export const filesystemContextProvider: ContextProvider = {
  id: 'filesystem-context',
  intents: ['filesystem'],
  async gather(input: GatherContextInput): Promise<ContextChunk> {
    const match = input.base.queryText.match(FILENAME_RE);
    return {
      kind: 'filesystem',
      payload: { cwd: input.base.cwd, apparentFilename: match?.[0] ?? null },
    };
  },
};
```

**`assertSafeCwd` guard** (`git-context.ts` lines 12–20) — copy this pattern for any new I/O-touching provider in Phase 6+.

---

### `src/cli/commands/init.ts` (controller — wire shell-adapters registry)

**Analog:** `src/registry/bootstrap.ts` + `listShellAdapters()`.

**Current hardcoded bypass** (lines 8–28):
```typescript
const SUPPORTED_SHELLS = ['zsh'] as const;
type Shell = (typeof SUPPORTED_SHELLS)[number];

export function initCommand(shell: string): void {
  if (!SUPPORTED_SHELLS.includes(shell as Shell)) {
    console.error(`Unsupported shell: '${shell}'. Supported: ${SUPPORTED_SHELLS.join(', ')}`);
    process.exit(1);
  }
```

**Target pattern:** Read supported shells from registry after bootstrap:
```typescript
import { listShellAdapters } from '../../registry/shell-adapters.js';

const adapters = listShellAdapters();
const supported = adapters.map((a) => a.shell);
```

Bootstrap already registers `{ id: 'zsh', shell: 'zsh', ... }`. `init.ts` is the only user-facing shell validation — it should not hardcode what the registry owns.

---

### `src/providers/detect.ts` (utility — partial registry alignment)

**Analog:** `src/registry/provider-backends.ts` — detection results should map to registered backend IDs.

**Current ad-hoc detection** (lines 47–79):
```typescript
export async function detectProvider(): Promise<DetectedProvider> {
  if (process.env.ANTHROPIC_API_KEY || readEnvValueFromDotEnvLocal('ANTHROPIC_API_KEY')) {
    return { kind: 'anthropic-key' };
  }
  // ... claude-cli, ollama, openai-key ...
  return { kind: 'none', message: '...' };
}
```

**Gap:** Detects Ollama/OpenAI but only `claude` is registered in bootstrap. Phase 6 should either (a) align detection output with `listProviderBackends()` IDs, or (b) document that detection is pre-flight only and registry is authoritative for invocation. Avoid advertising providers that have no registered adapter.

---

### `shell/zsh/queque.zsh` (hook, event-driven — CMD-04 audit)

**Analog:** itself — insertion-only contract is already correct.

**Replace-buffer applies to buffer, never executes** (lines 118–140):
```zsh
replace-buffer)
  # ...
  LBUFFER="$new_lbuffer"
  RBUFFER="$new_rbuffer"
  return 0
  ;;
```

No `eval`, `source`, or command substitution on the selected command. The widget runs `"${qq_cmd[@]}" client ...` (the QueQue client), not the user's selected command.

**Error/cancel restore originals** (lines 113–116, 142–148):
```zsh
cancel)
  LBUFFER="$QQ_ORIG_LBUFFER"
  RBUFFER="$QQ_ORIG_RBUFFER"
  return 0
  ;;
error)
  err_message=$(printf '%s' "$json_str" | jq -r '.message // empty' 2>/dev/null)
  [[ -n "$err_message" ]] && print -r -- "$err_message"
  LBUFFER="$QQ_ORIG_LBUFFER"
  RBUFFER="$QQ_ORIG_RBUFFER"
  return 0
  ;;
```

**Phase 6 test addition:** Explicit assertion that `_qq_apply_result_str` with `replace-buffer` sets LBUFFER but does not invoke the command (extend `tests/zsh-widget.test.ts` replace-buffer describe blocks).

---

### `src/cli/main.ts` (middleware — FIFO safety net audit)

**Analog:** itself — top-level handlers are the last-resort shell-state guard.

**Path-validated FIFO write** (lines 47–74):
```typescript
const QQ_RESULT_FILE_PATTERN = /^\/tmp\/qq-sess\.[A-Za-z0-9]+\//;

process.on('uncaughtException', (err: Error) => {
  console.error('QueQue: uncaught exception:', err.message);
  const resultFile = process.env.QQ_RESULT_FILE;
  if (resultFile && QQ_RESULT_FILE_PATTERN.test(resultFile)) {
    try {
      fs.writeFileSync(resultFile, '{"kind":"cancel"}\n');
    } catch { /* ... */ }
  }
  process.exit(1);
});
```

**Note:** Handlers write `cancel`, not `error` — acceptable for crash safety (SAFE-01). Phase 6 audit only unless path pattern needs broadening for non-Zellij inline mode (`result.json` under same tmpdir prefix — already matches pattern).

---

### `tests/registry-bootstrap.test.ts` (test — extend assertions)

**Analog:** itself.

**beforeEach isolation — all four registries** (lines 9–15):
```typescript
beforeEach(() => {
  clearContextProviders();
  clearProviderBackends();
  clearShellAdapters();
  clearStorageHooks();
  resetBootstrap();
});
```

**Missing assertion to add:**
```typescript
it('registers the claude provider backend', () => {
  bootstrapBuiltins();
  expect(listProviderBackends().map((b) => b.id)).toContain('claude');
});
```

After adapter instance registration, add assertion that `getProviderAdapter('claude')` returns an object with `fetchCandidates`.

**Test bootstrap pattern from context-pipeline** (lines 53–57):
```typescript
const { bootstrapBuiltins } = await import('../src/registry/bootstrap.js');
bootstrapBuiltins();
```

---

### `tests/context-pipeline.test.ts` (test — extend privacy)

**Analog:** itself — existing privacy test at lines 132–142.

**Copy pattern:**
```typescript
it('keeps git payload privacy-safe by excluding file content fields', async () => {
  const gitChunk = envelope.extras.find((chunk) => chunk.kind === 'git');
  expect(gitChunk?.payload).not.toHaveProperty('content');
  expect(gitChunk?.payload).not.toHaveProperty('bytes');
  // ...
});
```

**Add:** filesystem chunk privacy test (no `content`, `bytes`, `readPath`, `stat` fields). Add test that pipeline rejects/forbidden-fields if runtime filter is added.

---

### `tests/claude-provider.test.ts` (test — prompt includes safe extras)

**Analog:** itself — git context in prompt test (lines 50–79).

**Mock + dynamic import pattern** (lines 1–24, 60):
```typescript
vi.mock('@anthropic-ai/sdk', () => ({ default: AnthropicMock }));

const { fetchCandidates } = await import('../src/providers/claude.js');
```

**Add:** test with filesystem extra in envelope; assert prompt JSON includes `apparentFilename` once `buildPrompt` is fixed.

---

### `tests/zsh-widget.test.ts` (test — CMD-04 explicit)

**Analog:** itself — replace-buffer describe blocks (lines 255+).

**spawnSync zsh pattern** (lines 35–45):
```typescript
function runZsh(script: string): { stdout: string; stderr: string; status: number } {
  const result = spawnSync('zsh', ['-f', '-c', `source ${widgetPath}\n${script}`], {
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, PATH: process.env.PATH },
  });
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', status: result.status ?? 1 };
}
```

**Add describe block:** verify selected command appears in LBUFFER only; stdout must not contain command execution side effects (e.g. mock `git status` output absent when result is `replace-buffer` with `git status`).

---

## Shared Patterns

### Registry Map + register/get/list/clear
**Source:** `src/registry/context-providers.ts` lines 3–27
**Apply to:** Any registry extension in Phase 6 (`provider-backends` adapter lookup)

All four registries share identical API shape. Duplicate registration throws with quoted ID. Tests call matching `clear*()` in `beforeEach` alongside `resetBootstrap()`.

### `bootstrapBuiltins()` as sole built-in wiring
**Source:** `src/registry/bootstrap.ts` lines 16–45; called from `src/cli/main.ts` line 78
**Apply to:** All new built-in modules — register here, consume via registry elsewhere

Direct imports of built-in implementations are allowed **only** inside `bootstrap.ts`. Every other module resolves through `list*()` / `get*()`.

### Privacy-safe context chunks (D-05/D-06)
**Source:** `src/contracts/request.ts` lines 65–94; enforced in tests at `tests/context-pipeline.test.ts` lines 132–142
**Apply to:** Pipeline filter, prompt assembly, any new provider

File names and metadata only. No file bytes. New content-bearing variants require explicit opt-in gate and schema variant addition.

### `resolved` double-write guard + `writeShellResult`
**Source:** `src/client/run-foreground.ts` lines 211–238; `src/client/result-writer.ts` lines 22–46
**Apply to:** Any new client callback that writes shell results

Check `if (resolved) return` before write. Always use `writeShellResult()` — never direct `fsp.writeFile` on FIFO paths.

### FIFO crash safety net
**Source:** `src/cli/main.ts` lines 47–74; `shell/zsh/queque.zsh` lines 251–253
**Apply to:** Any new code path that could escape the Promise chain

`QQ_RESULT_FILE` exported by zsh widget; path validated with `/^\/tmp\/qq-sess\.[A-Za-z0-9]+\//` before sync write.

### Provider error → typed ShellResult (SAFE-01)
**Source:** `src/client/run-foreground.ts` lines 287–306; `shell/zsh/queque.zsh` error case lines 142–148
**Apply to:** All failure paths

Client writes `{ kind: 'error', message }`. Zsh restores original buffers. Never fall back to silent `cancel` on provider errors (Phase 3 fix — preserve).

### Test isolation: `vi.resetModules()` + explicit bootstrap
**Source:** `tests/context-pipeline.test.ts` lines 32–57
**Apply to:** Any test touching registry or pipeline

After `vi.resetModules()`, dynamically import and call `bootstrapBuiltins()` before importing modules under test.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/providers/resolver.ts` (if created) | utility | transform | No existing provider resolver — pattern from `context-providers` registry is the template |
| Daily-driver packaging docs (06-03) | config | — | No prior phase produced end-user hardening docs; use ROADMAP success criteria as outline |

---

## Metadata

**Analog search scope:** `src/registry/`, `src/context/`, `src/providers/`, `src/client/`, `src/cli/`, `shell/zsh/`, `tests/`
**Files scanned:** 22
**Pattern extraction date:** 2026-06-17

**Phase 1–4 bootstrap wiring summary:**
| Phase | What `bootstrapBuiltins()` gained |
|-------|-----------------------------------|
| 2 (02-03) | `gitContextProvider`, `filesystemContextProvider`, `zsh` shell adapter, `noop`/`memory` storage hooks |
| 3 (03-02) | `claude` provider backend descriptor (metadata only) |
| 4 | No bootstrap changes — UX/lifecycle hardening only |

**Direct imports bypassing registries (Phase 6 audit targets):**
| Import site | Bypasses | Resolution target |
|-------------|----------|-------------------|
| `run-foreground.ts:10` | `fetchCandidates` from `claude.ts` | `getProviderAdapter('claude')` |
| `init.ts:8` | hardcoded `SUPPORTED_SHELLS` | `listShellAdapters()` |
| `detect.ts` | ad-hoc provider kinds | align with `listProviderBackends()` IDs |
| `base-context.ts:13` | hardcoded `shellName: 'zsh'` | future: `getShellAdapter` (lower priority) |
| Nowhere | `listStorageHooks()` | unused registry — document default `noop` in 06-03 |
