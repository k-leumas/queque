# Phase 09 — Deferred Items

Out-of-scope discoveries logged during plan execution. Not fixed by the plan that found them.

## Found during 09-06

- **Pre-existing biome warning, `src/ui/CandidateSelect.tsx` layout effect:** `suppressions/unused` on the `biome-ignore lint/correctness/useExhaustiveDependencies: layout callback mirrors render inputs` comment (the dependency list is already exhaustive). The same warning is reported at the 09-06 base commit 9da51d9. 09-06 was told to leave the layout effect and its dependency list unchanged. Fix: delete the suppression line.
- **Pre-existing biome warning, `tests/modal-layout.test.ts:1`:** `noUnusedImports` (fixable). File not touched by 09-06.
- **bug-206 timing guards under load:** at load averages of 35–125, `pnpm test:run` failed only in the crafted-input 1 s bound (tests/command-words-fuzz.test.ts), the 25 ms handoff median and the two `daemon prewarm` 2.5 s polls (tests/zsh-widget.test.ts). zsh-widget.test.ts passed in full on re-run. Guards were not loosened. The open candidate fix is still bug-206's: time the lexer inside the child, not the spawn.
