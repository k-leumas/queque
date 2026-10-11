---
status: investigating
trigger: "UAT G-09-7: when i reenable tool awareness, and retrigger the qq ui, the list shows 3 results and then dwindles down to zero  so its just a modal with nothing in it"
created: 2026-10-11T09:00:00Z
updated: 2026-10-11T09:00:00Z
---

## Current Focus

hypothesis: (none yet)
test: (none yet)
expecting: (none yet)
next_action: Read .wolf/buglog.json, cerebrum Do-Not-Repeat, /tmp/qq-debug.log; then read src/ui/CandidateSelect.tsx, src/client/tool-handoff.ts, shell/zsh/queque.zsh

## Symptoms

expected: After running `QQ_TOOL_AWARENESS=0` and using `??` (no ⓘ marks), re-enabling tool awareness and triggering `??` again shows the candidate list and keeps it.
actual: "when i reenable tool awareness, and retrigger the qq ui, the list shows 3 results and then dwindles down to zero  so its just a modal with nothing in it"
errors: None reported
reproduction: Test 7 in .planning/phases/09-installed-only-command-awareness/09-UAT.md. QQ_TOOL_AWARENESS=0 as shell parameter, use ??, re-enable (method unknown), retrigger ??. Possibly inside/outside Zellij.
started: Discovered during UAT 2026-10-11 after phase 09 execution.

## Eliminated

## Evidence

## Resolution

root_cause:
fix:
verification:
files_changed: []
