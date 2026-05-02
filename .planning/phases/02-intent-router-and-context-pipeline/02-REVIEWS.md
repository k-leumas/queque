---
phase: 2
reviewers: [codex]
reviewed_at: 2026-05-01T00:00:00Z
plans_reviewed:
  - 02-01-PLAN.md
  - 02-02-PLAN.md
  - 02-03-PLAN.md
---

# Cross-AI Plan Review — Phase 2

## Codex Review

### Plan 02-01: Request Contracts + Intent Router

**Summary**
This plan is directionally strong and matches the phase goal well: deterministic local classification, explicit signals, and a clean contract boundary are the right foundation for the later context pipeline. The main risk is not the classifier logic itself but whether the request contract captures enough normalized structure to avoid brittle regex behavior and whether the intent taxonomy is precise enough to prevent ambiguous routing from leaking into later phases.

**Strengths**
- Deterministic, synchronous classifier aligns directly with D-04 and keeps Phase 2 MVP-safe.
- Clear separation between validation/contracts and routing logic is a good boundary.
- Signal-based output is useful for downstream provider gating, especially `git-prefix`.
- Defaulting away from codebase unless there is an explicit file-path signal respects D-01 and reduces false positives.
- Package-manager exception for `npm/pnpm/yarn` is pragmatic and directly implements D-02.
- TDD-first approach is appropriate for regex-heavy decision logic.

**Concerns**
- `MEDIUM`: The listed intent set includes `unknown`, but the excerpt defaults to `general`; that inconsistency suggests either dead taxonomy or unclear semantics.
- `HIGH`: File path detection can be surprisingly error-prone across relative paths, dotfiles, tilde paths, quoted paths, Windows-like strings in pasted text, extensions without slashes, and filenames with spaces. If tests are too narrow, D-01 may be implemented incorrectly in practice.
- `MEDIUM`: `^git\s` is too literal if normalization does not define behavior for leading whitespace, uppercase variants, or shell prefixes like `command git status`.
- `MEDIUM`: Package-manager detection can overmatch natural language like "how do I run pnpm build?" unless the contract distinguishes raw query intent from literal command text.
- `LOW`: Threat model mentions Zod validation on `lbuffer`, but the real security risk here is misclassification causing irrelevant context gathering, not schema validation failure.
- `LOW`: `filesystem` vs `shell-command` precedence may produce surprising outcomes for inputs like `ls ./foo.txt` or `cat package.json`; the desired behavior is not explicit.

**Suggestions**
- Define the normalized request shape more explicitly, including trimming, whitespace normalization, and case-handling rules before classification.
- Either remove `unknown` or document when it is emitted; avoid taxonomy drift now.
- Add table-driven tests for ambiguous inputs: `git status`, ` Git status`, `pnpm build`, `how to run pnpm build`, `fix src/app.ts`, `debug the login flow`, `open ./README.md`, `rename "my file.txt"`.
- Treat "literal command" detection separately from "natural language mentioning a command" if that distinction matters downstream.
- Document precedence rules as part of the contract, not just the implementation.

**Risk Assessment**: **MEDIUM**. The architecture is good and not overbuilt, but classification bugs here will cascade into the entire context system. Risk is mostly in edge-case coverage, not overall design.

---

### Plan 02-02: Context Pipeline + Provider Rewire

**Summary**
This is the most important plan in the phase and mostly achieves the phase goal: base context is always present, extra context is intent-gated, and provider-specific gathering is pushed behind interfaces. The core design is sound, but there are a few contract and sequencing risks, especially around how the new `ContextEnvelope` interacts with the provider prompt layer and whether the privacy constraints are enforced structurally rather than by convention.

**Strengths**
- Two-pass model cleanly separates base context from optional context and maps well to INT-02 and INT-03.
- `ContextProvider` interface is minimal and extensible without dragging in plugin complexity too early.
- Moving VCS gathering out of `claude.ts` is the right architectural correction.
- Git-provider guard for `git ` queries correctly implements D-09 and avoids blanket repo assumptions.
- Filesystem provider limited to regex extraction respects D-10 and D-11.
- Using `execFile` instead of `exec` is the right subprocess choice.
- Returning `null` on provider failure is pragmatic for MVP resilience.

**Concerns**
- `HIGH`: `buildBaseContext(request)` hardcoding `shellName: 'zsh'` is acceptable for MVP only if the request contract or Phase 1 already guarantees zsh-only execution. Otherwise it risks baking an incorrect invariant into a reusable layer.
- `HIGH`: The privacy rule in D-05 is critical, but the plan does not show a type-level distinction between safe metadata and forbidden file contents. A future provider could violate the rule accidentally.
- `MEDIUM`: `changedFiles[]` from `git status --porcelain` needs careful parsing for renames, copies, untracked files, and paths with spaces. A naive split will be wrong.
- `MEDIUM`: "provider returns null on error" is resilient, but without structured error reporting it may make intent-related failures invisible during debugging and test coverage weak.
- `MEDIUM`: `ContextEnvelope` growth can create prompt-shape churn in `claude.ts`. If the serialization format is not pinned, later providers may destabilize prompt behavior.
- `MEDIUM`: The plan says base context includes TTY metadata and platform, but it does not say whether these come from the normalized request or are recomputed at gather time. Duplicated sourcing can create inconsistencies.
- `LOW`: Running git commands for every `codebase` query may be fine for MVP, but large repos or slow filesystems could make the interaction feel laggy.
- `LOW`: `rbuffer: string = ''` in the new provider signature suggests an API seam that may already be drifting; if `rbuffer` is part of the request context, it should probably live in the envelope or request contract instead of as a side parameter.

**Suggestions**
- Enforce D-05 structurally with explicit safe context schemas — `ContextChunk` union that has no place for file contents.
- Define a stable envelope shape now, including field names, provider namespace keys, and omission semantics for unavailable context.
- Parse porcelain output with tests covering: modified files, untracked files, renamed files, filenames with spaces, non-git cwd.
- Add lightweight diagnostics for provider failures, even if only internal debug metadata excluded from prompts.
- Decide whether base context is sourced entirely from the normalized request or partly from runtime detection, and keep that consistent.
- Consider a subprocess timeout for git gathering rather than relying only on "return null on error".

**Risk Assessment**: **MEDIUM-HIGH**. This plan is fundamentally correct, but it carries the most integration and policy-enforcement risk. If the context contracts are loose, the system can meet the letter of the phase while making later privacy and prompt stability harder.

---

### Plan 02-03: Four Internal Registries + Wire Built-ins

**Summary**
This plan satisfies EXT-01 on paper, but it is the most likely place to over-engineer the MVP. A context-provider registry is justified in this phase; the other three registries are only justified if they remain truly minimal placeholders. The module side-effect registration approach works, but it introduces ordering and test-isolation fragility that should be acknowledged explicitly.

**Strengths**
- Establishes a uniform internal extension pattern before more providers are added.
- Duplicate-ID throws are the right default and prevent silent misconfiguration.
- Replacing hardcoded provider arrays with registry lookup improves architectural consistency.
- Registry tests using fresh module state are sensible for side-effect-based registration.

**Concerns**
- `HIGH`: Four registries in Phase 2 is close to speculative architecture. Only context providers appear to be exercised by actual phase behavior; the others risk becoming ceremony without value in a 2-week MVP.
- `MEDIUM`: Side-effect imports create hidden initialization ordering dependencies. A missed import can silently remove a built-in.
- `MEDIUM`: Self-registration at module load makes test behavior more brittle and can complicate bundling/tree-shaking assumptions.
- `MEDIUM`: Registry APIs are described as `register/get/list`, but it is not clear whether they support reset semantics for tests and process reuse.
- `LOW`: `storage-hooks` and `provider-backends` stubs may confuse future implementation if their descriptor contracts are too vague now.
- `LOW`: If built-ins are only discoverable through side-effect imports in `pipeline.ts`, the provider layer becomes less explicit and harder to trace.

**Suggestions**
- Reduce scope if possible: fully implement the context-provider registry now, and keep the other three as ultra-thin placeholders only if required by project architecture consistency.
- If all four must exist, keep their public API identical and tiny, with explicit `clear()` or test-only reset helpers to avoid leaning too hard on module resets.
- Make built-in registration explicit in one bootstrap module so initialization is inspectable and grep-friendly.
- Add a startup assertion test that verifies required built-ins are registered after bootstrap.
- Document why each registry exists in Phase 2, especially the ones not yet used by runtime flow.

**Risk Assessment**: **MEDIUM**. This plan can succeed, but it has the highest over-engineering risk relative to MVP value. The main danger is adding framework shape faster than real use cases justify.

---

## Cursor Review

*(Cursor CLI exited non-zero — review not available.)*

---

## Consensus Summary

*(Single reviewer — no cross-reviewer consensus. Key findings below.)*

### Agreed Strengths

- Two-pass pipeline design (base always + intent-gated extras) directly achieves phase goal
- `execFile` over `exec` for subprocess safety is explicitly called out as correct
- TDD-first approach is appropriate for regex-heavy classification logic
- Signal-based `IntentDecision` output enables clean downstream gating (D-09)
- Moving VCS gathering out of `claude.ts` is the right architectural move

### Agreed Concerns

- **HIGH**: `changedFiles` parsing from `git status --porcelain` needs broader test coverage (renames, spaces, untracked files)
- **HIGH**: Four registries in Phase 2 risks speculative architecture — only the context-provider registry is exercised by actual runtime behavior
- **MEDIUM**: `unknown` intent in the taxonomy is underspecified relative to `general` default — needs clarification or removal
- **MEDIUM**: Side-effect module registration creates hidden ordering dependencies and test-isolation brittleness

### Divergent Views

*(N/A — single reviewer)*
