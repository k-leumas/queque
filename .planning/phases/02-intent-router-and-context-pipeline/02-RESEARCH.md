# Phase 2: Intent Router and Context Pipeline - Research

**Researched:** 2026-05-01
**Domain:** request modeling, intent classification, context routing, internal registries
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

No phase-specific `CONTEXT.md` exists for Phase 2.

### Locked Decisions
None provided in `CONTEXT.md`.

### Claude's Discretion
- Choose a request model that keeps the shell bridge stable while allowing non-code intents.
- Choose the first built-in intent categories and providers.
- Choose extension seams that do not over-engineer plugin loading yet.

### Deferred Ideas (OUT OF SCOPE)
- Public plugin loading and third-party manifests.
- Full clarification UX.
- Final provider abstraction work for all LLM backends.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INT-01 | Tool classifies the user request into a broad intent category before gathering extra context | Introduce a typed router that derives `intent`, `confidence`, and `reasoning` from a normalized request built from the shell payload. |
| INT-02 | Tool always includes base shell context such as query text, current working directory, shell, platform, and TTY metadata | Split base context from intent-specific context and make base providers unconditional. |
| INT-03 | Tool gathers extra context only when it is relevant to the inferred intent instead of assuming repo/code context for every request | Move git/code context behind intent-gated providers and add non-code/file-safe categories. |
| EXT-01 | Internal registries exist for shell adapters, context providers, provider backends, and storage/extension hooks | Create registry modules with shared descriptor interfaces so built-ins use the same path as future extensions. |
</phase_requirements>

## Summary

Phase 2 is the first real architectural split between "shell transport" and "assistant reasoning." Today the foreground client treats every request as a `ShellRequest`, and the Claude provider directly adds git context whenever the cwd is inside a repository. That violates the Phase 2 product goal because repo-specific assumptions leak into all requests. The correct move is not to mutate the shell contract again. Keep `ShellRequest` as the shell bridge boundary, then add a second internal layer: a normalized assistant request/session model that carries the user query, base environment facts, inferred intent, and provider-selected extra context.

The safest shape is a pipeline:

1. Parse `ShellRequest`.
2. Normalize it into a `UserRequest` / `SessionContext` model.
3. Run an intent router that classifies broad categories before expensive context gathering.
4. Gather base context unconditionally.
5. Gather intent-specific context only from providers whose declared capabilities match the intent.
6. Hand the assembled context to the suggestion provider.

This keeps Phase 1 shell transport stable while making the assistant general-purpose. It also makes Phase 3 cleaner because the Claude fast path can consume a stable, provider-neutral context object instead of rebuilding prompt state ad hoc from `ShellRequest`.

**Primary recommendation:** Add a typed routing layer and provider registry between `ShellRequest` and `suggestShellResult`, with git/code context moved behind an intent-gated provider instead of being injected inline in `src/providers/claude.ts`.

## Current Code Implications

### What exists now
- `src/contracts/shell.ts` defines the shell-facing `ShellRequest` / `ShellResult`.
- `src/client/run-foreground.ts` reads a `ShellRequest` and either emits a fixture result or calls `suggestShellResult`.
- `src/providers/claude.ts` builds its prompt directly from `ShellRequest` and unconditionally calls `detectVcsContext(request.cwd)`.
- `src/daemon/server.ts` accepts `run-query` but only acknowledges it; no real routing/session machinery exists yet.

### What is missing for Phase 2
- No internal request type distinct from the shell payload.
- No intent enum or classifier result type.
- No context provider interface.
- No routing pipeline or assembled context object.
- No registry abstraction; built-ins are imported directly.

### Constraint from Phase 1
Do not change the shell bridge contract unless unavoidable. Phase 1 intentionally stabilized the outer request/result schema; Phase 2 should build inward from that seam.

## Recommended Request Model

### Pattern 1: Separate transport request from assistant request

Use the existing shell contract as input only. Add a normalized model in a new internal contract module:

```ts
type RequestIntent =
  | 'shell-command'
  | 'codebase'
  | 'filesystem'
  | 'general'
  | 'unknown';

type BaseContext = {
  queryText: string;
  cwd: string;
  ttyPath: string;
  shellPid: number;
  shellName: 'zsh';
  platform: NodeJS.Platform;
  timestamp: string;
};

type IntentDecision = {
  intent: RequestIntent;
  confidence: number;
  signals: string[];
};

type ContextEnvelope = {
  base: BaseContext;
  extras: Array<{ kind: string; payload: unknown }>;
};
```

Prefer deriving `queryText` from `lbuffer.trim()` for now. Preserve `rbuffer` in the internal request/session object as editing context, but do not force every provider to care about it.

### Pattern 2: Keep intent categories broad

For MVP routing, broad categories are better than a taxonomy explosion. Recommended initial set:

| Intent | Use For | Must Avoid |
|--------|---------|------------|
| `shell-command` | direct command generation requests, CLI syntax help, command recall | assuming a git repo unless extra signals justify it |
| `codebase` | requests mentioning files, source code, tests, refactors, repo status | using for image/media tasks just because cwd is inside git |
| `filesystem` | file search, rename, move, inspect, image/document tasks | injecting git branch/dirty state as if it were relevant |
| `general` | conceptual questions or terminal-adjacent guidance | scraping code context by default |
| `unknown` | low-signal or ambiguous requests | pretending certainty |

`filesystem` is important because it gives a home for file/media tasks that are not code tasks. That directly addresses the roadmap criterion about media/file tasks not inheriting git/code assumptions.

## Recommended Context Pipeline

### Base context providers

Always-on providers should be cheap and deterministic:
- shell request provider: `cwd`, `ttyPath`, `shellPid`, `lbuffer`, `rbuffer`
- platform provider: `process.platform`, `process.arch`, timestamp
- working-directory provider: cwd basename and existence checks

### Intent-gated providers

Context providers should declare which intents they support:

```ts
type ContextProvider = {
  id: string;
  intents: RequestIntent[] | ['*'];
  gather(input: GatherContextInput): Promise<ContextChunk | null>;
};
```

Recommended first built-ins:
- `git-context-provider` for `codebase` and some `shell-command` requests
- `file-selection-provider` or `cwd-listing-provider` for `filesystem`
- `shell-history-provider` stays deferred unless already available

For Phase 2, `git-context-provider` can wrap the existing `detectVcsContext` logic rather than keeping it inside the Claude provider. That move is the clearest indicator that context gathering is now routed instead of hard-coded.

### Router heuristics for MVP

Do not add an LLM classifier yet. Phase 2 should stay local and deterministic. Start with keyword and shape heuristics:
- codebase signals: `test`, `repo`, `branch`, `commit`, `src/`, file extensions, `fix`, `refactor`
- filesystem signals: `find file`, `rename`, `move`, `image`, `png`, `pdf`, `folder`
- shell-command signals: command-like prefixes, flags, pipes, package-manager verbs
- fallback to `general` or `unknown`

Expose classifier signals in the decision object so debugging later is straightforward.

## Registry Design

Phase 2 should add internal registries but not runtime plugin loading. The goal is to make built-ins register through the same interface future extensions will use.

Recommended registry modules:
- `src/registry/context-providers.ts`
- `src/registry/provider-backends.ts`
- `src/registry/shell-adapters.ts`
- `src/registry/storage-hooks.ts`

Each registry should support:
- `register(descriptor)`
- `get(id)`
- `list()`

Avoid premature complexity:
- no dynamic discovery
- no package loading
- no capability permissions yet

The important architectural rule is that built-ins call `register(...)` during bootstrap/module load instead of being imported as bespoke singletons throughout the codebase.

## File-Level Planning Direction

### Likely new modules
- `src/contracts/request.ts` or `src/contracts/session.ts`
- `src/intent/router.ts`
- `src/context/base-context.ts`
- `src/context/provider.ts`
- `src/context/pipeline.ts`
- `src/registry/context-providers.ts`
- `src/registry/provider-backends.ts`
- `src/registry/shell-adapters.ts`
- `src/registry/storage-hooks.ts`
- tests covering request normalization, routing, provider selection, and registry behavior

### Likely modifications
- `src/client/run-foreground.ts` should build a normalized request and route context before calling provider logic.
- `src/providers/claude.ts` should stop owning VCS detection directly and instead accept a routed context envelope or prompt-ready assistant request.
- `src/contracts/ipc.ts` may need a new internal daemon query message later, but Phase 2 can likely defer daemon protocol expansion if the foreground client still owns the first real pipeline.

## Architecture Patterns

### Pattern 1: Normalize early, preserve original shell payload

Keep the original shell request available for debugging, but route the normalized request through the rest of the system.

### Pattern 2: Gather context in two passes

Base pass first, intent-specific pass second. This keeps requirements INT-02 and INT-03 separate and testable.

### Pattern 3: Move repo-specific knowledge out of the provider adapter

The provider adapter should focus on prompt translation and response parsing. It should not decide that git context is always relevant.

### Pattern 4: Make registries boring

Plain Maps plus typed descriptor objects are enough. The architectural win comes from consistent use, not from sophisticated container features.

## Anti-Patterns to Avoid

- **Treating `ShellRequest` as the permanent application request model:** this preserves the Phase 1 leak and makes later clarification/session work harder.
- **Running git detection for every request:** violates INT-03 and bloats non-code prompts.
- **Classifying with the LLM in Phase 2:** adds latency and external failure modes before the basic shape is proven.
- **Building plugin loading now:** EXT-01 requires seams, not a marketplace.
- **Hiding router decisions:** later debugging needs visibility into why a request got code vs filesystem context.

## Common Pitfalls

### Pitfall 1: Routing based only on `cwd` being inside git
**What goes wrong:** Image or document tasks inside a repo get code-centric context.
**How to avoid:** Require query-text signals before adding codebase providers.

### Pitfall 2: Overfitting the intent taxonomy
**What goes wrong:** The router becomes brittle before the product has usage data.
**How to avoid:** Start with 4-5 broad intents and keep a visible `unknown` fallback.

### Pitfall 3: Registry seams that built-ins bypass
**What goes wrong:** Future plugin work still needs refactors because built-ins call each other directly.
**How to avoid:** Convert the first-party context/provider/storage modules to register through the registry immediately.

### Pitfall 4: Prompt adapters rebuilding context ad hoc
**What goes wrong:** Different providers or modes diverge in what context they include.
**How to avoid:** Centralize assembled context into one typed envelope before prompt creation.

## Validation Architecture

Phase 2 can be validated mostly with fast unit tests:

- request normalization tests
- intent classification tests
- context provider gating tests
- registry registration/listing tests
- Claude prompt-building tests that confirm git/code context is only present when routed in

Recommended quick command: `pnpm vitest run tests/intent-router.test.ts tests/context-pipeline.test.ts tests/registry.test.ts tests/claude-provider.test.ts`

Manual verification should be limited to smoke-checking a few representative requests once implementation exists:
- repo command request
- filesystem/media request inside a git repo
- general question request

## Planning Implications

1. The first plan should lock types and routing contracts before any provider rewiring.
2. The second plan should move current git-aware context gathering into routed providers and prove non-code safety with tests.
3. The third plan should add registry seams and convert built-ins to use them so later phases inherit the architecture instead of bypassing it.

## Recommendation

Plan Phase 2 as three executable slices:

1. Define normalized request/session contracts plus the deterministic intent router.
2. Build the base-context pipeline and intent-gated built-in providers, then wire the foreground client and Claude adapter to consume it.
3. Add internal registries for shell, context, provider, and storage seams, then convert built-ins to register through them.
