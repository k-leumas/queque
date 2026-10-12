---
phase: quick-261012-kp1
plan: 01
status: complete
completed: 2026-10-12
---

# Summary: User-facing changelog

CHANGELOG.md now leads with outcome copy (Features / Bug Fixes; Deprecations only when needed). Conventional-commit lists sit under `<details>Detailed changes</details>`. Unreleased documents v0.5.0..HEAD (streamed suggestions, Esc cancel, faster Claude Code, empty FILTER).

Future releases use `scripts/semantic-release-user-notes.ts` instead of `@semantic-release/release-notes-generator`. An LLM summarizes the changeset since the last tag; a missing API key or a failed model call still publishes details-only notes. `prepare` strips `## [Unreleased]` before the changelog plugin prepends the new version.
