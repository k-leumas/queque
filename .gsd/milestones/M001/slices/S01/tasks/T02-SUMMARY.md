---
id: T02
parent: S01
milestone: M001
provides: []
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 
verification_result: passed
completed_at: 
blocker_discovered: false
---
# T02: 01-shell-bridge-and-result-contract 02

**# Phase 01 Plan 02: ZSH Bridge and Result Application Summary**

## What Happened

# Phase 01 Plan 02: ZSH Bridge and Result Application Summary

**One-liner:** Custom `?` ZLE widget with look-behind trigger detection, lossless cancel via saved split-buffers, and jq-backed result application — no KEYTIMEOUT delay, no cursor math.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Failing zsh-widget smoke tests | 42a7141 | tests/zsh-widget.test.ts |
| 1+2 GREEN | ZSH widget, capture, and result application | 6ce8139 | shell/zsh/qq.zsh |

## What Was Built

### Task 1 and 2 combined (TDD)

**RED:** Wrote 10 failing tests in `tests/zsh-widget.test.ts` before any implementation. Tests spawn real `zsh` with the widget sourced and exercise:
- Structural checks: `zle -N`, `/dev/tty`, `qq client --request-file` present in widget file
- `_qq_capture_buffers`: strips trailing `?`, saves originals, preserves rbuffer
- `_qq_apply_result`: cancel restores, replace-buffer writes new values, malformed JSON returns nonzero, unknown kind returns nonzero

**GREEN:** Implemented `shell/zsh/qq.zsh` with:

**`qq-question-widget`** — The `?` ZLE binding:
- On the first `?` in the line (no trailing `?`): calls `zle .self-insert` — character appears immediately, no `KEYTIMEOUT` delay
- On the second `?` (trailing `?` already in `LBUFFER`): strips the trigger, saves originals, builds a JSON request file, and launches `qq client --request-file "$req" --result-file "$res" </dev/tty >/dev/tty 2>&1`

**`_qq_capture_buffers`** — Called on trigger detection:
- Sets `QQ_ORIG_LBUFFER="$LBUFFER"` and `QQ_ORIG_RBUFFER="$RBUFFER"` (exact pre-trigger state)
- Sets `QQ_LBUFFER="${LBUFFER%?}"` (trigger stripped) and `QQ_RBUFFER="$RBUFFER"`

**`_qq_apply_result`** — Reads the result file and branches:
- `{kind: "cancel"}` → restores `LBUFFER=$QQ_ORIG_LBUFFER`, `RBUFFER=$QQ_ORIG_RBUFFER`, returns 0
- `{kind: "replace-buffer", lbuffer, rbuffer}` → sets `LBUFFER` and `RBUFFER` to new values, returns 0
- Malformed JSON (jq exits nonzero or returns empty kind) → leaves buffers untouched, returns 1
- Unknown kind → restores originals, returns 1

## Verification Results

```
npx vitest run tests/zsh-widget.test.ts  → 10/10 PASS
grep -q "zle -N" shell/zsh/qq.zsh       → EXIT 0
grep -q "/dev/tty" shell/zsh/qq.zsh     → EXIT 0
grep -q "qq client --request-file" ...  → EXIT 0
rg -n "cursor" shell/zsh/qq.zsh         → no matches (PASS)
rg -n "malformed" tests/zsh-widget.test.ts → match found (PASS)
```

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED — failing tests | 42a7141 | PASS |
| GREEN — implementation | 6ce8139 | PASS |
| REFACTOR | not needed | — |

## Deviations from Plan

### None

Plan executed exactly as written. Both tasks implemented together in a single GREEN commit because Task 1 (`_qq_capture_buffers` + widget structure) and Task 2 (`_qq_apply_result` + result application) live in the same file and their tests were written together in the RED commit.

## Known Stubs

- `qq client --request-file ... --result-file ...` is invoked by the widget but the client itself throws `not implemented` (tracked from 01-01-SUMMARY). The shell bridge is complete and correct — the client implementation is the scope of Plan 01-03.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries. The widget writes JSON to temp files under `/tmp` and reads results back from the same temp files; no IPC or daemon communication in this plan.

## Self-Check: PASSED

Files confirmed present:
- FOUND: shell/zsh/qq.zsh
- FOUND: tests/zsh-widget.test.ts
- FOUND: .planning/phases/01-shell-bridge-and-result-contract/01-02-SUMMARY.md

Commits confirmed:
- FOUND: 42a7141 (test RED — failing zsh-widget tests)
- FOUND: 6ce8139 (feat GREEN — zsh widget implementation)
