# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-05-01

## User Preferences

- **Commit planning/context with code:** Treat `.wolf/`, `.planning/`, and `.gsd/` as first-class project artifacts — commit them alongside the code they affect, not as optional or local-only files.
- **Phase 7 scope — empty-lbuffer only:** User deprioritized event logging, SQLite pattern cache, and precmd proactive suggestions as nice-to-have with uncertain value. Phase 7 should focus on empty-lbuffer ambient `??` (full TUI, Claude with ambient context). Signal priority: failed last command → dirty git → new cwd → nothing obvious.

## Key Learnings

- **Project:** tui-llm
- ZLE user-defined widgets run with stdin redirected from `/dev/null`; any foreground TUI client launched from the widget must be reattached to `/dev/tty` explicitly.
- For shell-return contracts between `zsh` and Node, split-buffer payloads (`lbuffer`/`rbuffer`) are safer than numeric cursor offsets because they avoid cross-runtime Unicode indexing mismatches.
- Phase 2 should treat context gathering as a pre-provider concern; `src/providers/claude.ts` owning git detection is acceptable as a Phase 1 seam but the planner should remove that coupling before more intents are added.

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->
- [2026-05-01] When planning shell-bridge phases, do not stop at cancel-only seams or placeholder CLI stubs; Phase 1 plans must include a deterministic accepted `replace-buffer` round trip and real `main.ts` handler wiring, plus executable install/build verification for toolchain claims.
- [2026-05-14] In ES modules, `const` declarations at module level are in the temporal dead zone until their line executes. If the file has a top-level `await` call (e.g. `await main()`), any `const` placed after that line will throw a TDZ ReferenceError at runtime. Always place module-level constants before the first top-level `await`. Biome and vitest will not catch this — only manual inspection or running the script will.
- [2026-06-08] Never stub or fake a dependency (e.g. injecting a fake `git` binary) in a smoke/integration test just to make the build succeed. Stubbing hides the exact failure mode real users will hit. If a dependency is unavailable in the test environment, the test must either (a) remove/skip it so the code path exercises the real fallback, or (b) fail loudly so the underlying code is fixed. A test that passes by construction rather than by correctness is worse than no test.

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->
