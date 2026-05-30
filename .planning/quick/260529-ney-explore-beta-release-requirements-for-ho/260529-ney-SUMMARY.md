---
phase: quick-260529-ney
plan: "01"
subsystem: distribution
tags: [homebrew, zsh, zellij, npm, beta-release, distribution]
dependency_graph:
  requires: []
  provides: [BETA-DIST-01]
  affects: []
tech_stack:
  added: []
  patterns: []
key_files:
  created:
    - .planning/quick/260529-ney-explore-beta-release-requirements-for-ho/BETA-RELEASE-REQUIREMENTS.md
  modified: []
decisions:
  - "Homebrew tap uses npm registry tarball URL (not GitHub) + std_npm_args, consistent with Vercel CLI / Netlify CLI precedent"
  - "QueQue fits awesome-zsh-plugins ## Plugins section (not ZSH Tools) — has direct AI/LLM precedents already listed"
  - "awesome-zellij ## Integrations is the correct Zellij venue — fzf-zellij is a structural precedent"
  - "npm name conflict for 'queque' (Yuichiro Mori, v0.0.0) must be resolved before npm-based distribution"
metrics:
  duration: "109s"
  completed_date: "2026-05-29T23:57:08Z"
  tasks_completed: 2
  files_created: 1
---

# Phase quick Plan 260529-ney: Beta Release Requirements Research Summary

Research and documentation of beta distribution channels for QueQue — Homebrew custom tap formula skeleton (npm-tarball approach + std_npm_args), awesome-zsh-plugins PR process (Plugins section, AI/LLM precedents confirmed), and awesome-zellij Integrations listing (QueQue is not a WASM plugin).

## What Was Built

`BETA-RELEASE-REQUIREMENTS.md` — actionable research document covering three distribution channels with:
- Summary table: channel, artefacts, effort, beta-friendly flag, one-line action
- Homebrew Tap section: tap naming, full formula skeleton, SHA256 calculation, npm name conflict warning, user install command, ongoing maintenance cost
- zsh Plugin Listings section: awesome-zsh-plugins PR checklist, zsh-users clarification (hosting org, not listing), OMZ qualification gap, plugin manager passthrough (no submission needed)
- Zellij Community section: WASM vs. shell integration distinction, awesome-zellij Integrations as correct venue, Discord/Discussions posting guidance, Zellij minimum version (`>= 0.38`)
- Pre-launch checklist spanning all channels

## Decisions Made

- Homebrew tap uses npm registry tarball URL and `std_npm_args` helper (consistent with Vercel CLI, Netlify CLI — well-documented Homebrew pattern for Node CLIs)
- QueQue belongs in awesome-zsh-plugins `## Plugins` section; direct AI/ZLE precedents (`ai-cmd`, `claude`, `zsh-ai-cmd`) already listed there
- awesome-zellij `# Integrations` is the correct Zellij community venue; `fzf-zellij` (fzf in a floating pane) is a structural precedent
- npm name `queque` is registered at 0.0.0 by a different author — must be resolved before npm-based distribution or Homebrew formula can use npm tarball URL

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed and all success criteria met.

## Known Stubs

None — this is a research document, no stubs applicable.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced (research/documentation task only).

## Self-Check: PASSED

- BETA-RELEASE-REQUIREMENTS.md: FOUND
- Contains Homebrew section: FOUND
- Contains awesome-zsh-plugins: FOUND
- Contains Zellij section: FOUND
- Contains Summary table: FOUND
