# Phase 8: Zero-Config Install and Provider Detection - Pattern Map

**Mapped:** 2026-08-25
**Scope:** 08-02 only (Claude CLI subprocess adapter + SDK rescue)
**Files analyzed:** 13 (2 new source, 5 modified source, 1 new test, 4 test extend, 1 docs)
**Analogs found:** 13 / 13

08-01 `src/providers/detect.ts` is shipped and is **not** in this file list. It is analog-only: `claudeOnPath()` is the leftover PATH heuristic; 08-02 fetch must not call `detectProvider()` or `claudeAuthPresent()`.

Out of scope (08-03): `provider.json`, OpenAI/Ollama adapters, first-run picker, `qq init provider`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/providers/claude-cli.ts` (NEW) | provider | request-response (subprocess) | `src/providers/claude.ts` (adapter + parse) + `src/context/providers/git-context.ts` (`execFile`) | role-match + data-flow |
| `src/providers/claude-default.ts` (NEW) | provider | request-response (composite) | `src/providers/claude.ts` (SDK rescue) + `src/providers/resolver.ts` (kind switch / throw copy) | role-match |
| `src/providers/claude.ts` | provider | request-response | self — export prompt/parse; optional remaining-ms timeout | exact |
| `src/providers/resolver.ts` | utility | transform | self — return Claude-default adapter for all kinds | exact |
| `src/providers/index.ts` | config | transform | self — re-export adapters if tests need them | exact |
| `src/registry/bootstrap.ts` | config | transform | self — second `registerProviderBackend` next to `claude` | exact |
| `src/client/run-foreground.ts` | service | request-response | self — drop `detectProvider` selector; keep FIFO error write | exact |
| `docs/EXTENSIONS.md` | config | — | self — replace waterfall-detect copy with Claude default | exact |
| `tests/claude-cli-provider.test.ts` (NEW) | test | request-response | `tests/claude-provider.test.ts` + `tests/context-pipeline.test.ts` (`execFile` mock) | exact + data-flow |
| `tests/provider-resolver.test.ts` | test | transform | self — rewrite “not wired yet” cases | exact |
| `tests/client-result.test.ts` | test | request-response | self — replace ollama-not-wired; keep FIFO `{kind:'error'}` | exact |
| `tests/registry-bootstrap.test.ts` | test | transform | self — assert `claude-cli` id | exact |
| `tests/claude-provider.test.ts` | test | request-response | self — only if `fetchCandidates` gains a timeout param | exact |

**Not modified in 08-02 (analogs only):**

| File | Why analog |
|------|------------|
| `src/providers/detect.ts` | PATH/`claudeAuthPresent` leftover; do not gate fetch (D-10) |
| `src/registry/provider-backends.ts` | Already stores `adapter`; bootstrap just registers a second id |
| `src/providers/provider.ts` | `LLMAdapter` unchanged |
| `src/shared/env-file.ts` | SDK rescue key lookup |
| `src/shared/debug-log.ts` | Log `{ path }` not argv/env |
| `src/client/result-writer.ts` | FIFO `{ kind: 'error', message }` |

---

## Pattern Assignments

### `src/providers/claude-cli.ts` (NEW — provider, request-response / subprocess)

**Analog (adapter contract + parse):** `src/providers/claude.ts`

**Analog (spawn):** `src/context/providers/git-context.ts`

Implement `LLMAdapter.fetchCandidates(envelope)`. Do not invent a conversational parser. Export `claudeCliAdapter` the same way `claudeAdapter` is exported.

**Imports pattern** (`claude.ts` lines 1–7; `git-context.ts` lines 1–9):
```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CandidateList } from '../contracts/candidates.js';
import type { ContextEnvelope } from '../contracts/request.js';
import { appendDebugLog } from '../shared/debug-log.js';
import type { LLMAdapter } from './provider.js';
import { buildPrompt, ensureSelectableCandidates, parseCandidates } from './claude.js';

const execFileAsync = promisify(execFile);
```

**LLMAdapter export pattern** (`claude.ts` lines 158–160):
```typescript
export const claudeAdapter: LLMAdapter = {
  fetchCandidates,
};
```

Copy as `export const claudeCliAdapter: LLMAdapter = { fetchCandidates };`.

**Parse/fail-closed pattern** (`claude.ts` lines 28–43) — feed CLI stdout (text format) into this, unchanged:
```typescript
function parseCandidates(text: string): CandidateList {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(text));
  } catch {
    const trimmed = text.trim();
    return [{ command: trimmed || 'echo ""', explanation: '' }];
  }
  try {
    return candidateListSchema.parse(parsed);
  } catch {
    return [{ command: 'echo ""', explanation: 'QueQue: unexpected response format' }];
  }
}
```

08-02 must **export** `parseCandidates` / `buildPrompt` / `ensureSelectableCandidates` from `claude.ts` (currently private). CLI stdout with `--output-format text` is the same body SDK extracts from `content[].text`.

**Prompt privacy pattern** (`claude.ts` lines 70–96) — call `buildPrompt(envelope)`; do not reimplement:
```typescript
function buildPrompt(envelope: ContextEnvelope): string {
  const filtered = filterContextEnvelope(envelope);
  // ... JSON user message ...
}
```

**System prompt** (`claude.ts` lines 130–131) — pass the **same string** as CLI `--system-prompt`:
```typescript
system:
  'You are QueQue, a terminal shell assistant. Return ONLY a JSON array of command candidates, ranked with the most correct/direct command first. No prose, no markdown, no code fences. When a command requires a value the user must supply (hostname, filename, branch name, etc.), wrap it in angle brackets: <placeholder>. Use descriptive names like <user@host>, <filename>, <branch-name>. Do not use angle brackets for optional flags or known values.',
```

Extract a shared `QUEQUE_SYSTEM` constant from `claude.ts` so SDK and CLI cannot drift.

**execFile timeout + encoding** (`git-context.ts` lines 55–61) — copy options shape; add FIFO-safe remaining ms, SIGTERM, stdin ignore, envelope cwd:
```typescript
const { stdout } = await execFileAsync('git', ['-C', cwd, 'status', '--porcelain'], {
  encoding: 'utf8',
  timeout: GIT_TIMEOUT_MS,
});
```

08-02 spawn (from research, using this analog’s `execFileAsync`):
```typescript
await execFileAsync('claude', args, {
  encoding: 'utf8',
  timeout: remainingMs,
  killSignal: 'SIGTERM',
  maxBuffer: 1024 * 1024,
  cwd: envelope.base.cwd,   // request cwd, not QueQue process cwd
  env: process.env,         // inherit Keychain / exported ANTHROPIC_API_KEY
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'], // never inherit /dev/tty
});
```

Do **not** copy `src/daemon/bootstrap.ts` spawn (`detached: true`, `stdio: 'ignore'` both, `unref`) — that is for a long-lived daemon, not a result-bearing child.

**Debug log pattern** (`claude.ts` lines 118–123, 142–146, 150–153) — log path/exit, never argv/env/tokens:
```typescript
void appendDebugLog('provider', 'request start', {
  model,
  cwd: envelope.base.cwd,
  rbufferLength: rbuffer.length,
  extras: envelope.extras.map((chunk) => chunk.kind),
});
```

CLI equivalent: `appendDebugLog('provider', 'claude-cli path', { path: 'claude-cli', exitCode, authFailure: boolean })`. `appendDebugLog` already redacts via `redactForLog` (`src/shared/debug-log.ts` lines 16–20).

**Error handling:** `git-context.ts` swallows spawn errors (returns `[]`, lines 68–70). **Do not copy that.** CLI adapter must throw (or return a classified failure) so the composite can rescue. Copy `claude.ts` catch-and-rethrow (lines 149–154).

**Locked argv (do not invent flags):** `-p`, `--output-format text`, `--safe-mode`, `--tools ""`, `--no-session-persistence`, `--system-prompt`, `buildPrompt(envelope)` as last argv. Never `--bare`. Never `--output-format json`. Never `--max-turns`.

---

### `src/providers/claude-default.ts` (NEW — provider, request-response / composite)

**Analog:** `src/providers/claude.ts` (`fetchCandidates` + key lookup) and `src/providers/resolver.ts` (user-facing `QueQue:` throws).

No existing composite adapter. Implement one `LLMAdapter` that owns a shared 25s deadline.

**Key lookup for SDK rescue** (`claude.ts` lines 109–112):
```typescript
const apiKey = process.env.ANTHROPIC_API_KEY ?? readEnvValueFromDotEnvLocal('ANTHROPIC_API_KEY');
if (!apiKey) {
  throw new Error('ANTHROPIC_API_KEY is required in the environment or .env.local');
}
```

Composite must **not** inject `.env.local` into the child `env`. CLI inherits `process.env` only. Logged-out CLI + key-only-in-`.env.local` is the D-09 rescue case.

**SDK timeout** (`claude.ts` lines 134–136) — today hardcoded; composite must pass remaining:
```typescript
{
  timeout: 25_000, // 25s — slightly under the zsh 30s FIFO timeout
},
```

Add an optional timeout argument to `fetchCandidates` (or a thin wrapper) so remaining budget is used. If remaining < ~1000ms after CLI, skip SDK and throw timeout — do not start a fresh 25s.

**User-facing error prefix** (`resolver.ts` lines 20–23, 32–33):
```typescript
throw new Error(
  'QueQue: Claude CLI detected but subprocess adapter is not wired yet (Phase 8). Set ANTHROPIC_API_KEY or use .env.local.',
);
```

Replace those throws. Recommended D-13 copy (research):
```
QueQue: Claude is not authenticated. Run `claude /login`, or set ANTHROPIC_API_KEY in the environment or .env.local.
```

ENOENT + no key: mention install Claude Code **or** set the key. Never “not wired yet”. Never mention Ollama/OpenAI.

**Rescue rule (D-09):** on **any** CLI failure (ENOENT, non-zero, timeout, spawn error) if a key exists → SDK. Classify stderr/stdout only to pick copy when there is **no** key. Auth strings match both streams (`/not logged in|login expired|please run \/login|failed to authenticate|oauth (token|session)/i`).

**Do not** call `detectProvider()` or `claudeAuthPresent()` inside this adapter (D-10). PATH check is spawn ENOENT.

---

### `src/providers/claude.ts` (MODIFIED — provider, request-response)

**Analog:** self.

**Required 08-02 edits:**
1. Export `buildPrompt`, `parseCandidates`, `ensureSelectableCandidates`, and a shared `QUEQUE_SYSTEM` constant.
2. Keep `claudeAdapter` as SDK rescue — do not replace it with the CLI path.
3. Accept remaining timeout from the composite (optional param after `envelope`; `rbuffer` is already a side param at lines 105–108).

**Do not** pass `temperature` / `top_p` / `top_k` on `messages.create` (cerebrum Do-Not-Repeat).

**Do not** duplicate `filterContextEnvelope` in the CLI adapter — privacy stays inside `buildPrompt` (lines 70–71).

---

### `src/providers/resolver.ts` (MODIFIED — utility, transform)

**Analog:** self (`src/providers/resolver.ts` lines 1–35).

**Registry lookup + bootstrap guard** (lines 11–18) — keep this for the Claude-default / `claude-cli` id:
```typescript
case 'anthropic-key': {
  const adapter = getProviderAdapter('claude');
  if (!adapter) {
    throw new Error(
      'QueQue: Claude provider is not registered — was bootstrapBuiltins() called?',
    );
  }
  return adapter;
}
```

08-02: every kind (`anthropic-key`, `claude-cli`, `ollama`, `openai-key`, `none`) returns the **composite** Claude-default adapter (or `claude-cli` registry id that points at it). Do not throw “not wired yet”. `none` must not throw `detected.message` — client will no longer early-return on detect none (D-10); composite attempts CLI then SDK then D-13.

`getProviderAdapter('claude-cli')` after bootstrap must be a function (`tests/provider-resolver.test.ts` already asserts `adapter.fetchCandidates` is a function for `anthropic-key`, lines 19–21).

**Imports** (lines 1–3):
```typescript
import { getProviderAdapter } from '../registry/provider-backends.js';
import type { DetectedProvider } from './detect.js';
import type { LLMAdapter } from './provider.js';
```

If the client bypasses detect entirely, add `resolveClaudeDefaultAdapter()` that only does the registry get + bootstrap guard — still no direct `claude.ts` import from `run-foreground.ts`.

---

### `src/registry/bootstrap.ts` (MODIFIED — config, transform)

**Analog:** self, lines 44–49.

```typescript
registerProviderBackend({
  id: 'claude',
  name: 'Claude (Anthropic)',
  description: 'Anthropic Claude adapter — default LLM backend',
  adapter: claudeAdapter,
});
```

Register a second backend immediately after:
```typescript
registerProviderBackend({
  id: 'claude-cli',
  name: 'Claude (CLI)',
  description: 'Claude Code print-mode adapter with SDK rescue',
  adapter: claudeDefaultAdapter, // or claudeCliAdapter if composite is a third id
});
```

Keep existing `id: 'claude'` as the SDK-only adapter so rescue can `getProviderAdapter('claude')` without recursion.

Idempotency: `bootstrapped` flag (lines 9–22) already makes a second `bootstrapBuiltins()` a no-op. Duplicate-id throws live in `registerProviderBackend` (`provider-backends.ts` lines 18–21) — do not register twice.

**Import pattern** (lines 1–7) — add the new adapter import next to `claudeAdapter`. ESM: `.js` extensions.

---

### `src/client/run-foreground.ts` (MODIFIED — service, request-response)

**Analog:** self.

**Today’s selector to remove** (lines 10–11, 103–114, 156–157):
```typescript
import { detectProvider } from '../providers/detect.js';
import { resolveAdapter } from '../providers/resolver.js';
// ...
const detectedProvider = await detectProvider();
if (detectedProvider.kind === 'none') {
  await writeShellResult(resultFile, { kind: 'error', message: detectedProvider.message });
  return;
}
const adapter = resolveAdapter(detectedProvider);
```

08-02: always `resolveAdapter` / `resolveClaudeDefaultAdapter()` for `resultMode === 'llm'`. Do **not** skip fetch when leftover detect would return `none`. Do **not** import `claude.ts` from this file (Phase 6 contract).

**FIFO error on fetch failure** (lines 298–304, 313–317) — keep:
```typescript
.catch(async (err) => {
  const message = err instanceof Error ? err.message : String(err);
  void appendDebugLog('client', 'llm request failed', { message });
  if (resolved) return;
  resolved = true;
  const errorMsg = `QueQue: ${message}`;
  await writeShellResult(resultFile, { kind: 'error', message: errorMsg });
  unmount?.(true);
});
```

If adapter throws already-prefixed `QueQue: …`, avoid `QueQue: QueQue:` — either throw unprefixed from adapters or detect an existing prefix. Current resolver throws already include `QueQue:`; client prepends again (line 303). Existing tests expect both (`client-result.test.ts` lines 462–464). Match current tests unless you change both.

**writeShellResult protocol** (`src/client/result-writer.ts` lines 22–24) — do not change:
```typescript
export async function writeShellResult(resultFile: string, result: ShellResult): Promise<void> {
  const parsed = shellResultSchema.parse(result);
```

**Ink concurrency** (lines 291–293): fetch already runs while the spinner renders. CLI child must not inherit stdio or it will steal the pane.

---

### `src/providers/index.ts` (MODIFIED — config)

**Analog:** self (lines 1–4):
```typescript
export type { DetectedProvider } from './detect.js';
export { detectProvider } from './detect.js';
export type { LLMAdapter } from './provider.js';
export { resolveAdapter } from './resolver.js';
```

Add adapter exports only if tests/docs import the barrel. Production client must keep resolving via registry.

---

### `docs/EXTENSIONS.md` (MODIFIED — config)

**Analog:** self, “Provider resolution” (lines 16–21) and Phase 8 roadmap (lines 31–35).

Replace waterfall copy:
```
1. `detectProvider()` — pre-flight check (anthropic-key → claude-cli → ollama → openai-key → none).
2. `resolveAdapter(detected)` — maps detection to a registered `LLMAdapter`
```

08-02 wording: Claude is the silent default (`claude -p`, then env-key SDK rescue). `detectProvider()` is leftover preflight, not the hot-path selector. Pin + OpenAI/Ollama stay 08-03 — mention as upcoming, do not document a pin file as shipped.

Do **not** edit `src/cli/commands/init.ts` (D-05).

---

### `tests/claude-cli-provider.test.ts` (NEW — test)

**Analog (adapter + envelope + SDK mock):** `tests/claude-provider.test.ts`

**Analog (execFile mock):** `tests/context-pipeline.test.ts` lines 4–15, 43–51

**Analog (argv assertion):** `tests/zellij-pane-resize.test.ts` lines 3–7, 43–47

**Analog (child_process partial mock):** `tests/provider-detect.test.ts` lines 16–22 — `importOriginal` so other exports survive. Prefer mocking `execFile` the way context-pipeline does; do **not** inject a fake `claude` binary (cerebrum Do-Not-Repeat).

**Envelope factory** (`claude-provider.test.ts` lines 27–40):
```typescript
function buildEnvelope(extras: ContextEnvelope['extras'] = []): ContextEnvelope {
  return {
    base: {
      queryText: 'status',
      cwd: '/repo',
      ttyPath: '/dev/tty',
      shellPid: 1234,
      shellName: 'zsh',
      platform: 'darwin',
      timestamp: '2026-05-02T00:00:00.000Z',
    },
    extras,
  };
}
```

**SDK mock hoist** (`claude-provider.test.ts` lines 5–25) — reuse for rescue-path tests:
```typescript
const { createMock, anthropicCtorMock, AnthropicMock } = vi.hoisted(() => {
  const createMock = vi.fn();
  const anthropicCtorMock = vi.fn();
  class AnthropicMock {
    messages: { create: typeof createMock };
    constructor(options: unknown) {
      anthropicCtorMock(options);
      this.messages = { create: createMock };
    }
  }
  return { createMock, anthropicCtorMock, AnthropicMock };
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: AnthropicMock,
}));
```

**execFile callback mock** (`context-pipeline.test.ts` lines 43–51) — promisify(execFile) expects the Node callback form:
```typescript
execFileMock.mockImplementation(
  (
    _command: string,
    _args: string[],
    _options: unknown,
    callback: (error: null, stdout: string, stderr: string) => void,
  ) => {
    callback(null, '', '');
  },
);
```

ENOENT: `callback` with `Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' })`. Timeout: `killed: true` / `signal: 'SIGTERM'`. Auth fail: non-null error + stdout `'Not logged in · Please run /login'`.

**Assert spawn options, not a real binary:**
- `command === 'claude'`
- args include `-p`, `--safe-mode`, `--tools`, `--no-session-persistence`, `--output-format`, `text`; exclude `--bare` and `json` as the format
- `options.stdio[0] === 'ignore'` (or equivalent)
- `options.cwd === envelope.base.cwd`
- `options.timeout` is remaining budget, not a second 25s after a slow CLI
- prompt JSON does not contain `.env` when git extras include it (`claude-provider.test.ts` lines 160–189)

**Key env isolation:** `claude-provider.test.ts` `beforeEach` sets `ANTHROPIC_API_KEY` (lines 43–48). Rescue tests must also mock `readEnvValueFromDotEnvLocal` (`provider-detect.test.ts` lines 43–45) so `.env.local` rescue does not depend on the host file.

---

### `tests/provider-resolver.test.ts` (MODIFIED — test)

**Analog:** self.

**Bootstrap isolation** (lines 9–17):
```typescript
beforeEach(() => {
  clearContextProviders();
  clearProviderBackends();
  clearShellAdapters();
  clearStorageHooks();
  resetBootstrap();
  bootstrapBuiltins();
});
```

Rewrite:
- `claude-cli` → `expect(adapter.fetchCandidates).toBeTypeOf('function')` (same as anthropic-key, lines 19–21)
- `ollama` / `openai-key` → same adapter, **not** `/not wired yet/i` (delete lines 24–34)
- `none` → Claude-default adapter, not `detected.message` throw (delete lines 36–39)
- Keep pre-bootstrap `bootstrapBuiltins()` guard (lines 43–54)

---

### `tests/client-result.test.ts` (MODIFIED — test)

**Analog:** self.

**Mock layout** (lines 19–41) — keep `resolveAdapter` mock; drop `detectProvider` mock if the client no longer imports it:
```typescript
vi.mock('../src/providers/detect.js', () => ({
  detectProvider: vi.fn().mockResolvedValue({ kind: 'anthropic-key' }),
}));

vi.mock('../src/providers/resolver.js', () => ({
  resolveAdapter: vi.fn(() => ({
    fetchCandidates: fetchCandidatesMock,
  })),
}));
```

**beforeEach restore** (lines 340–346) — Phase 6 already learned mock leak: reset `resolveAdapter` after override tests.

**Replace ollama-not-wired** (lines 485–506):
```typescript
it('writes error ShellResult when ollama provider is not wired', async () => {
  // ...
  vi.mocked(resolveAdapter).mockImplementation(() => {
    throw new Error(
      'QueQue: Ollama detected but local adapter is not wired yet (Phase 8). ...',
    );
  });
  expect(parsed.message).toMatch(/ollama|not wired yet/i);
});
```

08-02: ollama kind must **not** produce “not wired yet”. Either resolve Claude-default and let `fetchCandidates` fail with D-13 `/login` copy, or do not special-case ollama in the client at all (detect bypassed). Keep `writes error ShellResult when fetchCandidates rejects` (lines 454–465) as the FIFO contract test.

---

### `tests/registry-bootstrap.test.ts` (MODIFIED — test)

**Analog:** self, lines 48–52:
```typescript
it('registers the claude provider backend with an adapter instance', () => {
  bootstrapBuiltins();
  expect(listProviderBackends().map((backend) => backend.id)).toContain('claude');
  expect(getProviderAdapter('claude')?.fetchCandidates).toBeTypeOf('function');
});
```

Add the same assertion for `'claude-cli'`. Keep `claude` SDK id. Idempotency test (lines 54–60) still uses context-provider length `2` — do not change that; add a provider-backend count assertion if you need to lock two LLM ids.

---

### `tests/claude-provider.test.ts` (MODIFIED only if timeout/export changes)

**Analog:** self. Privacy assertion (lines 160–189) remains the gold standard that CLI tests should mirror via `buildPrompt` export rather than duplicating filter logic.

---

## Shared Patterns

### LLMAdapter + registry (EXT-01)

**Source:** `src/providers/provider.ts` lines 4–6; `src/registry/provider-backends.ts` lines 18–35; `src/registry/bootstrap.ts` lines 44–49

```typescript
export interface LLMAdapter {
  fetchCandidates(envelope: ContextEnvelope): Promise<CandidateList>;
}

export function getProviderAdapter(id: string): LLMAdapter | undefined {
  return registry.get(id)?.adapter;
}
```

**Apply to:** `claude-cli.ts`, `claude-default.ts`, `bootstrap.ts`, `resolver.ts`, `run-foreground.ts`

Client never imports adapter modules. New backends are `registerProviderBackend({ id, name, description, adapter })`.

### Fail-closed candidates (CMD-01 / CMD-02)

**Source:** `src/providers/claude.ts` lines 28–43; `src/contracts/candidates.ts` lines 1–12

```typescript
export const candidateListSchema = z.array(commandCandidateSchema).min(1).max(5);
```

**Apply to:** CLI stdout parse. Do not insert raw CLI prose into the shell buffer except via existing `parseCandidates` fallback (`echo ""` / unexpected-format).

### Privacy before any provider call

**Source:** `src/providers/claude.ts` lines 70–71; `src/shared/privacy-filter.ts` lines 24–39

```typescript
const filtered = filterContextEnvelope(envelope);
```

**Apply to:** CLI and SDK. Call `buildPrompt`; do not re-filter in `claude-cli.ts`.

### Env key + `.env.local`

**Source:** `src/providers/claude.ts` line 109; `src/shared/env-file.ts` lines 57–72

```typescript
process.env.ANTHROPIC_API_KEY ?? readEnvValueFromDotEnvLocal('ANTHROPIC_API_KEY')
```

**Apply to:** SDK rescue only. Do not inject `.env.local` into `claude` child env.

### Debug logging without secrets

**Source:** `src/shared/debug-log.ts` lines 16–20

```typescript
export async function appendDebugLog(
  scope: string,
  message: string,
  details?: unknown,
): Promise<void> {
  const line = `${new Date().toISOString()} [${scope}] ${message}${formatDetails(redactForLog(details))}\n`;
```

**Apply to:** composite path log `{ path: 'claude-cli' | 'sdk-rescue' }`. Never log `args`, `env`, or raw streams that may contain tokens.

### FIFO error, buffer unchanged (SAFE-01 / D-13)

**Source:** `src/client/run-foreground.ts` lines 303–304; `src/client/result-writer.ts` lines 22–40

```typescript
await writeShellResult(resultFile, { kind: 'error', message: errorMsg });
```

**Apply to:** CLI auth miss, ENOENT without key, timeout. Zsh `read -t 30` is unchanged; combined CLI+SDK must stay ≤ 25s.

### execFile, no shell, with timeout

**Source:** `src/context/providers/git-context.ts` lines 1–9, 55–61

```typescript
const execFileAsync = promisify(execFile);
await execFileAsync('git', ['-C', cwd, 'status', '--porcelain'], {
  encoding: 'utf8',
  timeout: GIT_TIMEOUT_MS,
});
```

**Apply to:** `claude -p`. Add `killSignal: 'SIGTERM'`, `stdio: ['ignore','pipe','pipe']`, `cwd: envelope.base.cwd`. Do not `shell: true`. Do not `detached: true`.

### Test isolation

**Source:** `tests/claude-provider.test.ts` (SDK), `tests/context-pipeline.test.ts` (execFile), `tests/provider-detect.test.ts` (env-file mock), `tests/client-result.test.ts` (resolver mock restore)

**Apply to:** mock `execFile`/`spawn`; never put a stub `claude` on PATH. Reset `ANTHROPIC_API_KEY` and `.env.local` mocks per test.

### ESM import convention

**Source:** all `src/` modules — `import … from './foo.js'` even for `.ts` files.

**Apply to:** every new 08-02 module.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/providers/claude-default.ts` (composite deadline) | provider | request-response | No CLI-then-SDK wrapper exists. Copy pieces from `claude.ts` + `resolver.ts` throws; implement deadline math from RESEARCH.md Pattern 3. |

All other 08-02 files have an exact or role-match analog.

---

## Analog-only (08-01, do not treat as selector)

**Source:** `src/providers/detect.ts` lines 13–20, 41–50, 63–71

```typescript
function claudeOnPath(): boolean {
  try {
    execSync('which claude', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function claudeAuthPresent(): Promise<boolean> { /* darwin PATH presence */ }

if (claudeOnPath() && (await claudeAuthPresent())) {
  return { kind: 'claude-cli' };
}
```

08-02 fetch: spawn `claude`; ENOENT means missing CLI. Do not export/call `claudeAuthPresent` as a gate. Leave WR-01/WR-02 (`which` vs `where`, test env isolation) unless a later plan edits `detect.ts`.

---

## Metadata

**Analog search scope:** `src/providers/`, `src/registry/`, `src/client/`, `src/context/providers/`, `src/shared/`, `src/contracts/`, `tests/`, `docs/EXTENSIONS.md`
**Files scanned:** 22 source/test files read or grepped
**Pattern extraction date:** 2026-08-25
**Planner note:** Register composite as `claude-cli`; keep `claude` as SDK-only so rescue cannot recurse. Bypass detect on the hot path; do not delete `detect.ts`.
