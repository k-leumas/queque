# Phase 9: Installed-Only Command Awareness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-07
**Phase:** 09-installed-only-command-awareness
**Areas discussed:** Self-installing commands, Flag look & ranking, Controls hint for Tab, Steering prompt wording

---

## Self-installing commands

| Option | Description | Selected |
|--------|-------------|----------|
| Label it, don't flag | Show "installs fd" instead of "not installed" | ✓ (later reversed) |
| Flag it like any missing tool | Simplest; literally true now | |
| Treat as installed, no label | Quietest | |

**User's choice:** Label it, don't flag. Follow-ups: common package managers count; exact name plus a small shipped alias map; alias map shipped only.
**Notes:**
- Use-before-install: "this should never happen; this is basically a malformed command set" → no special handling.
- Installer missing (apt on macOS): "this should never happen, we send the os in the prompt" → no special case.
- **Reversed during Flag look:** "the list should never contain a command using a script and another installing the script to run the command… the only reason the install command is shown is when the user does not have the app installed and hits the tab while focusing on the candidate option that has the uninstalled tool."
- Confirmed: drop the self-install labelling; the prompt forbids install steps; any that slip through are judged normally.

---

## Flag look & ranking

| Option | Description | Selected |
|--------|-------------|----------|
| Inline mark + footer | Mirror the Phase 6 destructive pattern | ✓ |
| Inline text only | Dim suffix, always visible | |
| Footer only | Only when selected | |

**User's choice:** "option 1 with hold shift key to prepend install command"

| Install key | Description | Selected |
|--------|-------------|----------|
| Tab toggles, Enter accepts | Works in every terminal | ✓ |
| Shift+Enter, Tab fallback | Needs CSI u terminals | |
| Option/Alt+Enter | Terminal.app needs Option-as-Meta | |

| Ranking | Description | Selected |
|--------|-------------|----------|
| Sink below installed ones | Stable re-sort | ✓ (later reversed) |
| Keep model order | Trust the model | ✓ final |

| Installer | Description | Selected |
|--------|-------------|----------|
| Platform's manager from $commands | brew / apt / dnf / pacman; reverse alias map | ✓ |
| brew only | macOS-first | |

| Tab preview | Description | Selected |
|--------|-------------|----------|
| Live in the list row | What you see is what Enter inserts | ✓ |
| Footer only | Row unchanged | |

| Multiple missing tools | Description | Selected |
|--------|-------------|----------|
| One install for all | `brew install fd xh && …` | ✓ |
| Only the first missing tool | Simpler | |

| No alias entry | Description | Selected |
|--------|-------------|----------|
| The tool name itself | Wrong guess fails visibly | ✓ |
| Disable Tab for that tool | Only known packages | |

**Notes:** "now that the ux behind the options has been updated we should return the list of candidates in the order the model responds with." This reversed the sink-to-bottom ranking.

---

## Controls hint for Tab

| Option | Description | Selected |
|--------|-------------|----------|
| Only when a flagged candidate is selected | Appears exactly when Tab works | ✓ |
| Always when any candidate is flagged | | |
| Never — footer explains | | |

- Toggled state: `tab undo install` ✓ (vs keeping `tab install`)
- No package manager: footer reads `"not installed: fd — no package manager found"` ✓ (vs hiding silently)

---

## Steering prompt wording

| Option | Description | Selected |
|--------|-------------|----------|
| Prefer installed, allow better missing tools | Lets the model surface e.g. htop, installable via Tab | ✓ |
| Installed only unless impossible | Spike 003 wording | |
| Strictly installed | Never outside the list | |

- At least one installed-only candidate: **Yes** ✓

---

## Claude's Discretion

- Curated catalog source and contents (area not selected)
- On/off switch and missing-handoff fallback (area not selected)
- Handoff path plumbing, contract version bump, glyph/colour, copy, where `missingTools` lives, final prompt wording

## Deferred Ideas

- Finish spike 003 once API credits are topped up
- User-extendable alias map (declined)
- Catalog from `brew leaves`
