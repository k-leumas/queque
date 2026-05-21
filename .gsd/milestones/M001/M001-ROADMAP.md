# M001: Migration

**Vision:** Que-Que is a `zsh`-integrated command-line assistant that opens from a literal `?

## Success Criteria


## Slices

- [x] **S01: Shell Bridge And Result Contract** `risk:medium` `depends:[]`
  > After this: Establish the repo baseline and the shared contracts that every later Phase 1 plan depends on.
- [x] **S02: Intent Router And Context Pipeline** `risk:medium` `depends:[S01]`
  > After this: Lock the typed request contracts and deterministic intent router before any provider or pipeline wiring begins.
- [ ] **S03: Claude Fast Path And Ranked Suggestions** `risk:medium` `depends:[S02]`
  > After this: Stand up the formal LLMAdapter contract, implement Claude behind it, and simplify model selection.
- [x] **S04: Update Interface And Interactivity To Match That Of This Git** `risk:medium` `depends:[S03]`
  > After this: Wave 0: Establish test infrastructure for Phase 03.
- [x] **S05: Zellij Floating Pane Integration For Best Ux** `risk:medium` `depends:[S04]`
  > After this: Update both existing test files so that they cover Phase 3.
- [ ] **S06: Fuzzy Tui Selection Ux** `risk:medium` `depends:[S05]`
  > After this: Add failing test cases to the two existing test files before any implementation
changes.
- [ ] **S07: Clarification Chat in the Same TUI** `risk:medium` `depends:[S06]`
  > After this: unit tests prove Clarification Chat in the Same TUI works
- [ ] **S08: Hardening, Privacy Defaults, and Extension Seams** `risk:medium` `depends:[S07]`
  > After this: unit tests prove Hardening, Privacy Defaults, and Extension Seams works
