# T03: 02-intent-router-and-context-pipeline 03

**Slice:** S02 — **Milestone:** M001

## Description

Add four internal registries (context-providers, provider-backends, shell-adapters, storage-hooks), an explicit bootstrap module, and wire the built-in providers through the registry so future extensions use the same path instead of bypassing the architecture.

Purpose: EXT-01 requires that extension seams exist and that built-ins use them. Without this plan, the pipeline hardcodes imports directly and future plugin work would require refactors instead of additions.

Output:
- Four registry modules following the same Map + register/get/list/clear pattern
- `src/registry/bootstrap.ts` — single explicit call to register all Phase 2 built-ins (replaces side-effect imports)
- `gatherContext` reads providers from the registry instead of the hardcoded array, calls `bootstrapBuiltins()` at startup
- `tests/registry.test.ts` — TDD tests driving registry behavior
- `tests/registry-bootstrap.test.ts` — startup assertion test

**Review changes (02-03):**
- HIGH: Four registries risk is addressed: three non-context-provider registries are explicitly marked as Phase 2 stubs with `STUB` in their module header comment and a brief justification for why the seam exists in Phase 2 even though no runtime behavior uses it yet. The context-providers registry is fully exercised by actual runtime behavior.
- MEDIUM: Side-effect imports replaced with an explicit bootstrap module. `bootstrapBuiltins()` registers all built-ins in one inspectable, grep-friendly location. No hidden initialization ordering — pipeline calls `bootstrapBuiltins()` once at startup.
- MEDIUM: All four registries expose a `clear()` function for test isolation, removing the need for `vi.resetModules()` in tests (which creates module-graph churn).

## Must-Haves

- [ ] "Four internal registries exist: context-providers, provider-backends, shell-adapters, storage-hooks"
- [ ] "Each registry supports register(descriptor), get(id), and list() operations with a clear() helper for test isolation"
- [ ] "Registering a duplicate ID throws an error that includes the conflicting ID in the message"
- [ ] "Built-in context providers (git-context, filesystem-context) register through a single explicit bootstrap module — not via module-load side effects"
- [ ] "The context pipeline reads providers from the registry instead of a hardcoded array"
- [ ] "Three non-context-provider registries are clearly marked as Phase 2 stubs — their descriptor types are minimal and their purpose is documented in comments"
- [ ] "A startup assertion test verifies required built-ins are registered after bootstrap runs"

## Files

- `src/registry/context-providers.ts`
- `src/registry/provider-backends.ts`
- `src/registry/shell-adapters.ts`
- `src/registry/storage-hooks.ts`
- `src/registry/bootstrap.ts`
- `src/context/pipeline.ts`
- `tests/registry.test.ts`
- `tests/registry-bootstrap.test.ts`
