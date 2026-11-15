# Phase 11: Multi-shell trigger support (bash, fish-ready) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves the alternatives considered.

**Date:** 2026-11-13
**Phase:** 11-multi-shell-trigger-support-bash-and-fish
**Areas discussed:** Shell scope and order, Parity with zsh, Install/doctor/CI, bash 4.x policy, History entries, Install UX

---

## Shell scope and order

**User's choice (free text):** "bash now for audience reach and fish later on the roadmap for fullness"

**Clarification from the user:** "I'd like all of them to work similarly so it'd be nice to iron out what all needs for fish support now and build with it in view... however if each shell handles its own nuances then this can all be wrapped up inside of the fish adapter code — am I right in my thinking?"
Claude's answer: mostly yes. Adapter quirks are local, but several shared parts hardcode zsh today (request shellName, handoff format, lexer, init/doctor, telemetry, instant frame, harness).

| Option | Description | Selected |
|--------|-------------|----------|
| Design for all, ship bash | Make the shared parts shell-aware for zsh/bash/fish; ship only bash; add Phase 12 fish | ✓ |
| Ship bash and fish together | The same shared work plus the fish adapter now | |
| Bash only, no fish design | Special-case bash; rework the shared parts later | |

| Option | Description | Selected |
|--------|-------------|----------|
| Update docs now | Map BASH-01, add FISH-01 (v2), update the PROJECT.md out-of-scope line | ✓ |
| CONTEXT.md only | Leave the project docs alone | |

---

## Parity with zsh

| Question | Options | Selected |
|----------|---------|----------|
| Instant frame | Shared frame, per-shell paint / Port zsh code / Skip for bash v1 | Shared frame, per-shell paint |
| Tool scan (~85 ms) | Overlap with Node startup / Inline / Client PATH scan | Overlap with Node startup |
| Suggestion syntax | Shell-native / POSIX-ish | Shell-native |
| Picker paths | Inline + Zellij / Zellij only | Inline + Zellij |

---

## Install, doctor and CI

| Question | Options | Selected |
|----------|---------|----------|
| `qq init` shell pick | Detect $SHELL + override / Explicit arg only / Every installed shell | Detect $SHELL + override |
| bash rc file | ~/.bashrc + doctor check / also fix bash_profile / Per-OS file | ~/.bashrc + doctor check |
| CI coverage | Distro smoke + PTY harness / PR CI harness only / Local only | Distro smoke + PTY harness |
| Telemetry | Add shell + version / No change | Add shell + version |

---

## bash 4.x policy, History, Install UX

| Question | Options | Selected |
|----------|---------|----------|
| bash 4.x | Refuse like 3.2 / ASCII-only best effort | Refuse like 3.2 |
| History | Match zsh (query via history -s) / Command only | Match zsh |
| Install docs | Shell-neutral `qq init` / Separate bash section | Shell-neutral `qq init` |

## Claude's Discretion

- How the instant-frame helper is built; how the compgen scan runs alongside client startup; doctor and telemetry naming; whether adapter authors get a doc.

## Deferred Ideas

- fish adapter: Phase 12.
- Line-editor add-ons (ble.sh, starship, bash-preexec): not discussed.
- Todos reviewed but not folded: 09.1 SDK live check, Phase 10 telemetry key bake.
