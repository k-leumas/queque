# Phase 2: Intent Router and Context Pipeline - Research

**Researched:** 2026-05-01
**Domain:** intent classification, context enrichment, and internal extension registries for terminal request routing
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

No phase-specific `CONTEXT.md` exists for Phase 2.

### Locked Decisions
None provided in `CONTEXT.md`.

### Claude's Discretion
None provided in `CONTEXT.md`.

### Deferred Ideas (OUT OF SCOPE)
None provided in `CONTEXT.md`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INT-01 | Tool classifies the user request into a broad intent category before gathering extra context | Use a deterministic, coarse classifier that runs on `ShellRequest` first and returns category plus confidence before any provider I/O. |
| INT-02 | Tool always includes base shell context such as query text, current working directory, shell, platform, and TTY metadata | Promote `ShellRequest` into a stable base-context envelope and keep it separate from optional provider output. |
| INT-03 | Tool gathers extra context only when it is relevant to the inferred intent instead of assuming repo/code context for every request | Add intent-to-provider routing so git/code context only runs for code-related categories, not file/media/system tasks. |
| EXT-01 | Internal registries exist for shell adapters, context providers, provider backends, and storage/extension hooks | Implement typed internal registries now and register built-ins through them instead of direct imports or special cases. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Read `.wolf/OPENWOLF.md` every session.
- Check `.wolf/anatomy.md` before reading project files.
- Check `.wolf/cerebrum.md` before generating code.
- Start file-changing work through a GSD workflow unless the user explicitly bypasses it.
- Optimize for a usable daily-driver product in 2 weeks.
- Use TypeScript on Node LTS.
- Keep the MVP tooling baseline on `pnpm`, `tsup`, `vitest`, `zod`, `cac`, `ink`, and `@anthropic-ai/sdk`.
- Shell integration must be real `zsh` ZLE integration, not a standalone prompt-taker.
- v1 must return commands to the shell buffer and never auto-execute them.

## Summary

Phase 2 should be treated as an architectural decoupling phase, not a model-integration phase. The current code already shows the coupling that must be removed: `src/providers/claude.ts` calls `detectVcsContext()` directly and bakes git assumptions into prompt construction. That violates the Phase 2 goal because repo context is currently provider-owned instead of request-owned, and it will incorrectly leak into non-code requests once more intents arrive.

The cheapest correct design is a deterministic router that classifies from the raw shell request first, then resolves a provider list from that intent, then merges provider output into a context bundle with base context always present. Do not introduce an LLM-based classifier here. Phase 3 owns provider-backed generation, and Phase 2 only needs broad categories with predictable behavior. A small rule table with explicit confidence scoring is enough for `git`, `code`, `files`, `system`, `package`, and `unknown`.

The registry work in this phase should be real, not cosmetic. Built-in context providers, shell adapters, provider backends, and storage hooks should all register through the same typed internal interface that future extensions will use. If built-ins bypass the registry “just for now,” Phase 6 will have to unwind the same coupling again.

**Primary recommendation:** Build Phase 2 around a shared `IntentClassification -> ContextPipeline -> RequestEnvelope` flow, keep classification deterministic and coarse, and move all extra-context gathering behind typed registries before any provider prompt logic runs.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | `24.14.1` | Runtime for classifier, pipeline, and daemon orchestration | Already installed locally and aligns with the project’s Node LTS constraint. |
| TypeScript | `6.0.3` | Shared types for routing, provider contracts, and registry APIs | Existing repo baseline; ideal for stable internal contracts. |
| `zod` | `4.1.5` in repo, `4.4.2` current | Validate intent results, provider outputs, and envelope schemas | Zod 4 supports discriminated unions and registries cleanly for typed routing contracts. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | `4.0.4` | Router, pipeline, and registry tests | Use for unit tests on pure classification and provider gating logic. |
| `cac` | `7.0.0` | Existing CLI boundary | Keep existing CLI surface unchanged in this phase. |
| `@anthropic-ai/sdk` | `0.92.0` | Existing provider dependency | Keep it out of routing logic; Phase 2 should only prepare cleaner inputs for later provider calls. |
| `git` CLI | `2.53.0` local | Existing VCS context source | Keep git detection behind a context provider instead of calling it inside the provider adapter. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Deterministic rule-based classifier | LLM-based classifier | Rejected for this phase because provider routing belongs to Phase 3 and a classifier must run before extra context is gathered. |
| Internal typed registries | Direct built-in imports plus a future plugin layer later | Rejected because it creates two integration paths and guarantees refactor debt in Phase 6. |
| Shared request envelope built from base + extras | One flat mutable context object | Rejected because it makes provenance unclear and encourages accidental cross-intent leakage. |

**Installation:**
```bash
pnpm install
```

**Version verification:** Verified on 2026-05-01 with local `node --version`, `pnpm --version`, and `npm view <package> version` checks. Current registry versions observed: `zod@4.4.2`, `ink@7.0.1`, `@anthropic-ai/sdk@0.92.0`, `vitest@4.1.5`, `typescript@6.0.3`. Phase 2 does not require dependency additions; prefer staying on the repo-pinned stack unless a separate upgrade task is planned.

## Architecture Patterns

### Recommended Project Structure
```text
src/
├── intents/
│   ├── categories.ts       # broad intent enums/schemas
│   ├── classify.ts         # deterministic classifier + confidence
│   └── routing.ts          # intent -> provider IDs
├── context/
│   ├── base.ts             # ShellRequest -> BaseContext
│   ├── pipeline.ts         # provider execution and merge rules
│   ├── providers/
│   │   ├── git.ts          # VCS provider
│   │   ├── repo.ts         # repo/code provider if needed
│   │   └── cwd.ts          # simple cwd/file listing provider if needed
│   └── registry.ts         # context provider registry
├── extensions/
│   ├── shell-registry.ts
│   ├── provider-registry.ts
│   └── storage-registry.ts
├── contracts/
│   ├── shell.ts
│   ├── ipc.ts
│   └── intent.ts           # request envelope and context schemas
└── shared/
    └── vcs-context.ts      # reused by the git context provider only
```

### Pattern 1: Classify Before Any Extra I/O
**What:** Intent classification runs from the raw shell request and returns category plus confidence before invoking any context provider.
**When to use:** Always for Phase 2.
**Example:**
```typescript
// Source: repo architecture + Zod 4 discriminated union guidance
import { z } from 'zod';

export const intentCategorySchema = z.enum([
  'git',
  'code',
  'files',
  'system',
  'package',
  'unknown',
]);

export const intentClassificationSchema = z.object({
  category: intentCategorySchema,
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()).default([]),
});
```

### Pattern 2: Keep Base Context Separate From Optional Context
**What:** Build a stable base envelope from `ShellRequest`, then merge optional provider outputs under explicit keys.
**When to use:** Always; this is how INT-02 and INT-03 stay testable.
**Example:**
```typescript
// Source: repo contracts + phase requirements
type BaseContext = {
  queryText: string;
  cwd: string;
  ttyPath: string;
  shellPid: number;
  platform: NodeJS.Platform;
  shell: 'zsh';
};

type RequestEnvelope = {
  base: BaseContext;
  intent: {
    category: 'git' | 'code' | 'files' | 'system' | 'package' | 'unknown';
    confidence: number;
  };
  extras: Record<string, unknown>;
};
```

### Pattern 3: Registry-Backed Providers With Explicit Intent Filters
**What:** Every built-in provider implements the same interface and declares when it is eligible to run.
**When to use:** Immediately for context providers and extension seams.
**Example:**
```typescript
// Source: repo requirement EXT-01 + Zod 4 registry support
export interface ContextProvider {
  id: string;
  intents: ReadonlyArray<'git' | 'code' | 'files' | 'system' | 'package'>;
  collect(input: RequestEnvelope): Promise<Record<string, unknown>>;
}

export class ContextProviderRegistry {
  #providers = new Map<string, ContextProvider>();

  register(provider: ContextProvider): void {
    this.#providers.set(provider.id, provider);
  }

  forIntent(intent: string): ContextProvider[] {
    return [...this.#providers.values()].filter((provider) => provider.intents.includes(intent as never));
  }
}
```

### Pattern 4: Provider Adapters Consume Envelopes, Not Raw Shell Requests
**What:** The Anthropic adapter should accept a routed envelope or derived prompt input, not reach back into git/filesystem itself.
**When to use:** As part of the Phase 2 extraction from `src/providers/claude.ts`.
**Example:**
```typescript
// Source: repo inference from current claude.ts coupling
type SuggestionInput = {
  envelope: RequestEnvelope;
};

interface LlmBackend {
  suggest(input: SuggestionInput): Promise<unknown>;
}
```

### Anti-Patterns to Avoid
- **Context gathering inside `claude.ts`:** It hides routing decisions inside one backend and breaks intent isolation.
- **Over-granular intent categories:** Broad categories are enough here; detailed task parsing belongs later.
- **Providers that mutate base context:** Base context should be immutable once created.
- **Registry bypasses for built-ins:** Built-ins must register through the same internal path as future extensions.
- **Classifier side effects:** Classification should be pure and cheap; no `git`, `ls`, or network calls before routing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phase 2 intent classification | A trained classifier, embeddings pipeline, or provider round-trip | Deterministic keyword/rule routing with confidence scoring | The requirement only needs broad categories and Phase 3 has not introduced the provider abstraction yet. |
| Envelope validation | Ad-hoc shape checks | `zod` schemas | Router and provider boundaries are too central for loose parsing. |
| VCS parsing | Manual `.git` directory parsing | Existing `git` CLI-backed `detectVcsContext()` moved behind a provider | The repo already has a working VCS seam; reuse it behind the right interface. |
| Extension seams | Separate bespoke registration code in every subsystem | One small typed registry pattern reused across shell/context/provider/storage | Repetition here will cause inconsistent extension behavior later. |

**Key insight:** The risk in this phase is not “missing a smarter classifier.” It is hard-coding extra context in the wrong layer and then having every later phase depend on that mistake.

## Common Pitfalls

### Pitfall 1: Provider-Level Context Leakage
**What goes wrong:** Non-code requests still inherit repo/git assumptions.
**Why it happens:** The provider adapter reaches into VCS or filesystem state on its own.
**How to avoid:** Move all extra context gathering into the shared pipeline and pass providers a finished envelope.
**Warning signs:** `claude.ts` imports `detectVcsContext()` or other context collectors after this phase.

### Pitfall 2: Intent Taxonomy Explosion
**What goes wrong:** Classification logic becomes fragile and impossible to reason about.
**Why it happens:** The phase tries to encode every user request shape instead of broad buckets.
**How to avoid:** Keep Phase 2 categories coarse and optimize for routing correctness, not semantic completeness.
**Warning signs:** More than 6-8 first-pass categories or nested classifiers in the first implementation.

### Pitfall 3: Base Context Is Not Guaranteed
**What goes wrong:** Downstream logic has to null-check basic shell metadata or recompute query text.
**Why it happens:** Base and optional context are merged into one loose object.
**How to avoid:** Make `base` a required object in the envelope and `extras` optional by key.
**Warning signs:** Provider code reading raw `ShellRequest` directly instead of the base envelope.

### Pitfall 4: Registry In Name Only
**What goes wrong:** A registry exists, but built-ins are still wired through direct imports.
**Why it happens:** The registry is added late or only used for hypothetical future plugins.
**How to avoid:** Register built-ins through the registry from day one and test lookup behavior directly.
**Warning signs:** Multiple code paths for “internal provider” versus “extension provider.”

### Pitfall 5: Expensive Context Runs Before Routing
**What goes wrong:** Simple filesystem or system questions still pay git/repo probing costs.
**Why it happens:** Context collection is executed eagerly.
**How to avoid:** Make routing choose providers first, then collect only the selected extras.
**Warning signs:** `runForegroundClient()` or daemon query code always calls VCS detection regardless of intent.

## Code Examples

Verified patterns from official sources and current repo constraints:

### Intent Schema With Coarse Categories
```typescript
// Source: https://zod.dev/v4
import { z } from 'zod';

export const intentCategorySchema = z.enum([
  'git',
  'code',
  'files',
  'system',
  'package',
  'unknown',
]);
```

### Typed Registry Metadata
```typescript
// Source: https://zod.dev/v4
import * as z from 'zod';

const providerRegistry = z.registry<{ id: string; kind: 'context' | 'provider' | 'storage' }>();
```

### Context Pipeline Merge
```typescript
// Source: repo architecture inference from src/providers/claude.ts and src/contracts/shell.ts
export async function buildRequestEnvelope(
  request: ShellRequest,
  classify: (request: ShellRequest) => IntentClassification,
  registry: ContextProviderRegistry,
): Promise<RequestEnvelope> {
  const intent = classify(request);
  const base = {
    queryText: request.lbuffer,
    cwd: request.cwd,
    ttyPath: request.ttyPath,
    shellPid: request.shellPid,
    platform: process.platform,
    shell: 'zsh' as const,
  };

  const extras = Object.assign(
    {},
    ...(await Promise.all(
      registry.forIntent(intent.category).map((provider) => provider.collect({ base, intent, extras: {} })),
    )),
  );

  return { base, intent, extras };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Provider adapters gather their own context | Shared request envelope built before provider invocation | Needed in Phase 2 | Stops git/code assumptions from leaking into unrelated tasks. |
| Always-assume-repo prompting | Intent-gated context providers | Needed in Phase 2 | Makes general shell/file/media/system use cases viable. |
| Direct built-in wiring | Registry-backed built-ins and future extensions | Needed in Phase 2 | Avoids a second refactor when plugin seams harden later. |

**Deprecated/outdated:**
- Context gathering inside [src/providers/claude.ts](/Users/samuel/dev/tui-llm/src/providers/claude.ts:1): this is acceptable as a Phase 1 seam but should be treated as deprecated architecture once Phase 2 lands.

## Open Questions

1. **What are the exact initial intent categories?**
   - What we know: they must be broad and sufficient to stop repo assumptions from leaking into non-code requests.
   - What's unclear: whether `code` and `git` should be distinct from day one or merged initially.
   - Recommendation: start with separate `git`, `code`, `files`, `system`, `package`, `unknown` because current VCS logic already exists and file/media isolation is an explicit success criterion.

2. **Should context collection live in the foreground client or daemon orchestration path?**
   - What we know: the daemon already exists, and `run-query` is still a placeholder in [src/daemon/server.ts](/Users/samuel/dev/tui-llm/src/daemon/server.ts:1).
   - What's unclear: whether this phase should only define shared libs or also move orchestration ownership toward the daemon.
   - Recommendation: keep classifier and envelope builders as shared pure modules; route execution through shared code now so the daemon can own more of it later without another contract change.

3. **How much filesystem context is safe to gather for `files` intent in v1?**
   - What we know: base context must always exist, and irrelevant repo assumptions must not leak in.
   - What's unclear: whether Phase 2 should gather only cwd metadata, a shallow directory listing, or file contents.
   - Recommendation: stop at cwd metadata plus optional shallow listing; do not read arbitrary file contents in this phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Router/pipeline implementation and tests | ✓ | `24.14.1` | — |
| `pnpm` | Install/test/build workflow | ✓ | `10.33.0` | `npm` possible but not aligned with project constraints |
| `git` | Existing VCS context provider | ✓ | `2.53.0` | Treat VCS provider as unavailable and return no git context |
| `zsh` | End-to-end shell request shape remains `zsh`-based in v1 | ✓ | `5.9` | None for v1 |

**Missing dependencies with no fallback:**
- None.

**Missing dependencies with fallback:**
- None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `vitest` 4.0.4 in repo (`4.1.5` current on npm) |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm vitest run tests/intent-router.test.ts tests/context-pipeline.test.ts tests/registry.test.ts` |
| Full suite command | `pnpm test:run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INT-01 | classify broad intent before extra context runs | unit | `pnpm vitest run tests/intent-router.test.ts` | ❌ Wave 0 |
| INT-02 | always include base shell context in envelope | unit | `pnpm vitest run tests/context-pipeline.test.ts` | ❌ Wave 0 |
| INT-03 | only relevant providers run for the inferred intent | unit | `pnpm vitest run tests/context-pipeline.test.ts` | ❌ Wave 0 |
| EXT-01 | built-ins register and resolve through typed registries | unit | `pnpm vitest run tests/registry.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run tests/intent-router.test.ts tests/context-pipeline.test.ts tests/registry.test.ts`
- **Per wave merge:** `pnpm test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/intent-router.test.ts` — intent category and confidence routing coverage for INT-01
- [ ] `tests/context-pipeline.test.ts` — base-context guarantees and provider gating coverage for INT-02 and INT-03
- [ ] `tests/registry.test.ts` — built-in registration path coverage for EXT-01

## Sources

### Primary (HIGH confidence)
- Repository files:
  - [README.md](/Users/samuel/dev/tui-llm/README.md:1)
  - [docs/SYSTEM_DESGN.md](/Users/samuel/dev/tui-llm/docs/SYSTEM_DESGN.md:1)
  - [src/client/run-foreground.ts](/Users/samuel/dev/tui-llm/src/client/run-foreground.ts:1)
  - [src/daemon/server.ts](/Users/samuel/dev/tui-llm/src/daemon/server.ts:1)
  - [src/contracts/shell.ts](/Users/samuel/dev/tui-llm/src/contracts/shell.ts:1)
  - [src/contracts/ipc.ts](/Users/samuel/dev/tui-llm/src/contracts/ipc.ts:1)
  - [src/providers/claude.ts](/Users/samuel/dev/tui-llm/src/providers/claude.ts:1)
  - [src/shared/vcs-context.ts](/Users/samuel/dev/tui-llm/src/shared/vcs-context.ts:1)
- Zod 4 official docs: `https://zod.dev/v4`
- npm registry package metadata verified on 2026-05-01:
  - `https://www.npmjs.com/package/zod`
  - `https://www.npmjs.com/package/vitest`
  - `https://www.npmjs.com/package/typescript`
  - `https://www.npmjs.com/package/ink`
  - `https://www.npmjs.com/package/@anthropic-ai/sdk`

### Secondary (MEDIUM confidence)
- None.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - existing repo stack plus current package/version verification is clear.
- Architecture: MEDIUM - the needed decoupling is clear from the repo, but exact category boundaries and orchestration ownership still need one planning decision.
- Pitfalls: HIGH - they are directly exposed by the current `claude.ts` and `vcs-context.ts` coupling and by the phase success criteria.

**Research date:** 2026-05-01
**Valid until:** 2026-05-31
