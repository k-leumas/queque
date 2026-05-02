# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-05-01

## User Preferences

<!-- How the user likes things done. Code style, tools, patterns, communication. -->

## Key Learnings

- **Project:** tui-llm
- ZLE user-defined widgets run with stdin redirected from `/dev/null`; any foreground TUI client launched from the widget must be reattached to `/dev/tty` explicitly.
- For shell-return contracts between `zsh` and Node, split-buffer payloads (`lbuffer`/`rbuffer`) are safer than numeric cursor offsets because they avoid cross-runtime Unicode indexing mismatches.
- Phase 2 should treat context gathering as a pre-provider concern; `src/providers/claude.ts` owning git detection is acceptable as a Phase 1 seam but the planner should remove that coupling before more intents are added.

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->
- [2026-05-01] When planning shell-bridge phases, do not stop at cancel-only seams or placeholder CLI stubs; Phase 1 plans must include a deterministic accepted `replace-buffer` round trip and real `main.ts` handler wiring, plus executable install/build verification for toolchain claims.

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->
