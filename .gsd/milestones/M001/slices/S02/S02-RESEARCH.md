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

---

## Wave 3 Supplemental Research

**Supplemented:** 2026-05-02
**Scope:** Registry and bootstrap implementation — what the planner needs to know before executing 02-03-PLAN.md
**Confidence:** HIGH

### Codebase State at Wave 3 Entry

**Critical finding:** Waves 1 and 2 have not been executed yet. The `src/` tree contains only Phase 1 files. There are no `src/context/`, `src/intent/`, or `src/registry/` directories. The planned dependencies of wave 3 (`src/context/provider.ts`, `src/context/pipeline.ts`, `src/context/providers/git-context.ts`, `src/context/providers/filesystem-context.ts`) do not exist on disk. [VERIFIED: filesystem scan of /Users/samuel/dev/tui-llm/src/]

Wave 3 depends on wave 2 output. The 02-03-PLAN.md `depends_on: [02-02]` is a hard dependency — wave 3 cannot execute until wave 2 has produced its files. The planner must treat this as a sequencing constraint, not an optional ordering preference.

**Existing tests** in `tests/` cover Phase 1 only: `shell-contract.test.ts`, `claude-provider.test.ts`, `client-result.test.ts`, `daemon-bootstrap.test.ts`, `env-file.test.ts`, `zsh-widget.test.ts`. None of the wave 2 or wave 3 test files exist. [VERIFIED: filesystem scan of /Users/samuel/dev/tui-llm/tests/]

### Registry Pattern — Key Design Decisions Already Made

The plan fully specifies the four registry modules. These decisions are locked in CONTEXT.md or the plan itself — the implementer must not deviate:

**Descriptor types per registry** [VERIFIED: 02-03-PLAN.md Task 1 behavior section]

| Registry | Descriptor Type | Shape |
|----------|-----------------|-------|
| `context-providers` | `ContextProvider` | imported from `src/context/provider.ts` — fully typed with `intents`, `gather()` |
| `provider-backends` | `ProviderBackendDescriptor` | `{ id: string; name: string; description: string }` — Phase 2 stub |
| `shell-adapters` | `ShellAdapterDescriptor` | `{ id: string; shell: string; description: string }` — Phase 2 stub |
| `storage-hooks` | `StorageHookDescriptor` | `{ id: string; description: string }` — Phase 2 stub |

**Duplicate-ID error message format** is a locked decision from CONTEXT.md Claude's Discretion:
```
Context provider already registered: "git-context"
```
Pattern: `<EntityType> already registered: "<id>"` — the entity name is Title Case with spaces, the id is in double quotes. The error message must be exact for tests to pass. Do not use backticks, single quotes, or a different capitalization.

**`clear()` is for test isolation only** — not a production API. Mark with `@internal` JSDoc and a code comment. Tests use `beforeEach(() => clearXxx())` instead of `vi.resetModules()`. This avoids module-graph churn that would break the vitest module cache during test runs. [VERIFIED: 02-03-PLAN.md, rationale in objective review comments]

### Bootstrap Module — Critical Idempotency Pattern

The `bootstrapBuiltins()` function uses a module-level `let bootstrapped = false` guard. This makes it safe to call on every `gatherContext()` invocation without double-registering providers.

The guard creates a test isolation problem: if a test calls `bootstrapBuiltins()` and the flag remains `true`, subsequent tests in the same module cannot re-bootstrap a clean registry. The solution is `resetBootstrap()` — a companion function that resets the flag. Tests use it in `beforeEach` alongside the registry `clear()` functions.

**The three-step test teardown pattern** required by bootstrap tests:
```typescript
beforeEach(() => {
  clearContextProviders();    // empty the Map
  clearShellAdapters();       // empty the Map
  clearStorageHooks();        // empty the Map
  resetBootstrap();           // reset the bootstrapped flag
});
```
Missing any one of these steps will cause bootstrap tests to fail non-deterministically depending on test execution order. [VERIFIED: 02-03-PLAN.md Task 2 test listing]

### Pipeline Rewire — The Two Lines That Must Be Removed

When updating `src/context/pipeline.ts`, two specific import lines must be removed and not just dead-coded:

```typescript
// REMOVE these two lines:
import { gitContextProvider } from './providers/git-context.js';
import { filesystemContextProvider } from './providers/filesystem-context.js';

// REMOVE this constant:
const BUILTIN_PROVIDERS = [gitContextProvider, filesystemContextProvider];
```

If these remain alongside the registry read, providers will be duplicated in `gatherContext` or the bootstrap will throw a duplicate-ID error. The acceptance criterion in the plan explicitly checks that `BUILTIN_PROVIDERS` is gone and the direct provider imports are gone. [VERIFIED: 02-03-PLAN.md Task 2 acceptance criteria]

### Stub Registry Documentation Requirement

The three non-context-provider registries must include a module-level comment that passes three checks:
1. Starts with the literal text `PHASE 2 STUB`
2. Explains *why the seam exists now* (not just that it's a stub)
3. Gives a one-line example of a future registration call

This is not optional polish — it is a stated acceptance criterion. The rationale: without the explanation, a future maintainer may delete the stub as dead code before Phase 3 or a plugin phase lands. The comment preserves the architectural intent. [VERIFIED: 02-03-PLAN.md Task 1 acceptance criteria and behavior section]

### No Self-Registration in Provider Files

The provider files (`git-context.ts`, `filesystem-context.ts`) produced by wave 2 must NOT contain a `registerContextProvider(...)` call at module level. Registration is owned exclusively by `bootstrap.ts`. If wave 2 happens to add self-registration as a convenience (a common pattern in plugin architectures), wave 3 must remove it before wiring bootstrap.

Wave 3 Task 2 explicitly requires reading both provider files before writing bootstrap.ts to verify this. The acceptance criteria check for the absence of `registerContextProvider(` at module level in both files. [VERIFIED: 02-03-PLAN.md Task 2 read_first and acceptance criteria]

### Test Structure — What TDD Means Here

Wave 3 Task 1 is typed `tdd` (RED/GREEN/REFACTOR). The RED/GREEN commit sequence is:

1. **RED commit:** `tests/registry.test.ts` exists, imports from registry modules that do not exist yet — all tests fail with import errors. Commit: `test(02-03): add failing registry tests`
2. **GREEN commit:** Four registry files created. All tests pass. Commit: `feat(02-03): implement four extension registries with clear() helpers`

Task 2 is typed `auto` (no explicit RED phase). Write bootstrap, rewire pipeline, write bootstrap tests, then verify everything green together.

The test file for registries uses one `describe` block per registry. Each block covers five cases:
- register happy-path
- get returns registered descriptor
- list returns all registered entries
- duplicate ID throws with id in error message
- clear() empties the Map

The bootstrap test file covers six cases: git-context registered, filesystem-context registered, total count = 2 (not more, not less), zsh adapter registered, noop storage hook registered, memory storage hook registered, idempotent (calling twice does not throw, count stays 2). [VERIFIED: 02-03-PLAN.md full test listings in both tasks]

### Vitest Test Configuration — No Special Setup Needed

The project vitest config (`vitest.config.ts`) uses `environment: 'node'` and `include: ['tests/**/*.test.ts']`. New test files at `tests/registry.test.ts` and `tests/registry-bootstrap.test.ts` will be auto-discovered. No vitest config changes are needed for wave 3. [VERIFIED: vitest.config.ts in project root]

The verification command after wave 3 completes:
```bash
pnpm vitest run tests/intent-router.test.ts tests/porcelain-parser.test.ts tests/context-pipeline.test.ts tests/registry.test.ts tests/registry-bootstrap.test.ts tests/claude-provider.test.ts
pnpm test:run
pnpm tsc --noEmit
```
All three must exit 0 before wave 3 is considered done. [VERIFIED: 02-03-PLAN.md verification section]

### TypeScript Import Convention

All relative imports in this project use `.js` extensions even for `.ts` source files. This is the ESM TypeScript convention enforced throughout `src/`. Wave 3 files must follow this:

```typescript
// Correct
import { type ContextProvider } from '../context/provider.js';
import { bootstrapBuiltins } from '../registry/bootstrap.js';

// Wrong — breaks ESM resolution at runtime
import { type ContextProvider } from '../context/provider';
```

[VERIFIED: 02-PATTERNS.md shared patterns section, confirmed in existing source files]

### EXT-01 Closure Conditions

EXT-01 is closed when all of the following are true:
1. Four registry modules exist with register/get/list/clear APIs
2. Duplicate-ID throws with the id in the error message
3. Three stub registries have `PHASE 2 STUB` documentation
4. `bootstrap.ts` is the single explicit source of built-in registration
5. `gatherContext` in `pipeline.ts` reads providers from the registry (not a hardcoded array)
6. Startup assertion test verifies required built-ins after `bootstrapBuiltins()`
7. Full test suite green, TypeScript compilation clean

None of these are stretch goals — all are required by the plan's success criteria. [VERIFIED: 02-03-PLAN.md success criteria section]

### What Wave 3 Does NOT Do

To prevent scope creep during execution:
- Does not add provider backend runtime behavior (the registry is a stub — Phase 3 registers Claude)
- Does not add shell adapter runtime dispatch (the registry is a stub — zsh support is already in the ZLE widget layer from Phase 1)
- Does not add storage hook behavior (the registry is a stub — no persistence in Phase 2)
- Does not change the `ShellRequest` / `ShellResult` contract
- Does not modify `src/client/run-foreground.ts` (that was wave 2's responsibility)
- Does not modify `src/providers/claude.ts` (that was wave 2's responsibility)

The only modifications in wave 3 are: create four registry files, create bootstrap.ts, update pipeline.ts to call bootstrapBuiltins() and read from registry instead of hardcoded array, create two test files. [VERIFIED: 02-03-PLAN.md files_modified frontmatter]