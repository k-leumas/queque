---
phase: quick-261017-4kt
plan: 01
subsystem: docs
tags: [readme, authentication, claude-code, install, privacy, tool-awareness]
status: complete
requires: []
provides:
  - "README Authentication section: claude -p on the Claude Code /login (no key), ANTHROPIC_API_KEY precedence, QQ_MODEL scope, daemon restart"
  - "Working install command `qq init zsh && source ~/.zshrc`"
affects: [README.md]
tech-stack:
  added: []
  patterns: ["README claims traced to live code and gated by a QQ_*/config-key/link invention check"]
key-files:
  created: []
  modified:
    - README.md
    - .wolf/anatomy.md
    - .wolf/memory.md
    - .wolf/cerebrum.md
    - .wolf/buglog.json
decisions:
  - "Debug logging is documented as always-on and redacted (Node appendDebugLog has no off switch), not 'off by default'"
  - "Filter is described as type-to-narrow, not 'fuzzy search' (filterCandidates is a substring match)"
  - "Dropped the duplicate docs/EXTENSIONS.md link with internal 'Phase 7/8' wording; the privacy-section link remains"
metrics:
  duration: "~25 min"
  completed: 2026-10-17
actuals:
  tokens: 4224
  tasks: 2
  commits: 2
plan_head_before: bb16c955bdf84b71e9909accb98b5f879b1ab929
plan_head_after: 4a0ef47d60b4360f49f92d550ef28d8bd6a65f49
---

# Phase quick-261017-4kt Plan 01: README refresh Summary

The README now says that a Claude Code `/login` user needs no API key, because QueQue runs `claude -p` on that login. It gives the real precedence: a non-empty ANTHROPIC_API_KEY always wins, and neither route falls back to the other. It fixes the `qq init zsh` command that was writing into ~/.zshrc, adds a daemon restart procedure checked against the live argv, and covers the Phase 9 / 09.1 picker and privacy behaviour as it ships today.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (tracer) | Authentication + install path end to end | 9ff87b7 | README.md |
| 2 | Usage, privacy, config text + invention gate + OpenWolf | 4a0ef47 | README.md, .wolf/anatomy.md, .wolf/buglog.json, .wolf/cerebrum.md, .wolf/memory.md |

Tracer gate: the Task 1 `<verify>` was re-run end to end after the commit and exited 0, so Task 2 went ahead.

## What changed in README.md

- **Install:** the NOTE box and the npm block now read `qq init zsh && source ~/.zshrc`, plus a note not to redirect its output (F6).
- **Requirements:** Node.js 24 or newer (F7). Added "Claude Code signed in, or an Anthropic API key".
- **`## Authentication`** (replaces "Expose API Key"):
  - The Claude Code login route uses a `claude /login` block. QueQue passes no model flag, runs with tools off and session persistence off, and the README quotes D13_MESSAGE verbatim.
  - The API-key route keeps the env-then-`.env.local` order. `.env.local` is searched upward from the daemon's start directory and read once. The README adds a tip that `~/.env.local` is found from any start directory under home, and says empty values count as unset.
  - It states the precedence and that neither route falls back to the other. QQ_MODEL applies to the SDK route only (default `claude-sonnet-5`).
- **`### After changing your key or settings`:**
  - The daemon reads the key, QQ_MODEL, `.env.local` and config.json once, at start.
  - Exports go above the `# queque shell integration` block.
  - Restart with `pkill -f 'daemon --socket /tmp/qq-'` then `qq daemon --ensure`. The pattern was confirmed read-only with `pgrep -fl`, and the live daemon was not touched.
- **Usage:**
  - Rows stream in.
  - The `queque ›` header holds the typed text, and FILTER opens empty.
  - Typing during `thinking…` filters the list.
  - Esc stops the request.
  - The ⚠ copy is quoted from `DESTRUCTIVE_WARNING_TEXT`.
  - Enter inserts the row exactly as shown, never runs it.
- **`### Installed-tool awareness`:** the ⓘ mark, the legend copy quoted from `missingToolsLegend` (`ⓘ not installed` / `tab prepends the install command`), the Tab/Shift+Tab install form (brew, apt, dnf, pacman), and `QQ_TOOL_AWARENESS=0`.
- **Privacy:**
  - The README says both routes send the same prompt.
  - It adds the platform and shell name.
  - It adds catalog-only installed tool names. The full inventory stays local, and the kill switch stops even the catalog names.
  - The debug-log line is rewritten (see Deviations).
- **Config table:** the effort row now links to the restart section.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The "Debug logging: Off by default" claim was false**
- **Found during:** Task 2 re-check of src/shared/debug-log.ts
- **Issue:** `appendDebugLog` always appends to `QQ_DEBUG_LOG_FILE` or `/tmp/qq-<uid>-debug.log`. Only the zsh `_qq_log` is gated on `QQ_DEBUG_LOG_FILE`, and the widget also sends client stderr to that file. So QQ_DEBUG_LOG_FILE does not "turn debug logging on", which is what the plan's wording assumed.
- **Fix:** the README now says the client and daemon append redacted diagnostics to that path (overridable with QQ_DEBUG_LOG_FILE), that the widget adds lines only when the variable is set, and that the log stays local.
- **Commit:** 4a0ef47

**2. [Rule 1 - Bug] "fuzzy search" was inaccurate**
- **Issue:** `filterCandidates` does a case-insensitive substring match on the command and the install form, not a fuzzy match.
- **Fix:** the README now says "type to narrow the list".
- **Commit:** 4a0ef47

**3. Minor:** removed the trailing duplicate EXTENSIONS.md link that used internal "Phase 7/8" wording. The privacy-section link still covers the expansion path.

Every other planner fact (F1–F10) held when re-checked against the cited code.

## Out-of-scope follow-ups (F11, not edited)

1. **.github/workflows/homebrew.yml caveats** still use the broken `qq init zsh >> ~/.zshrc` form, and the Step 2 there covers the API key only. It should match the README: `qq init zsh && source ~/.zshrc`, and offer `claude /login` as the no-key route.
2. **The `init <shell>` help string in src/cli/main.ts** repeats the stale init/redirect guidance. Align it with `initCommand`, which writes ~/.zshrc itself.
3. **CONTRIBUTING.md** says ANTHROPIC_API_KEY is "Required" and gives a stale haiku QQ_MODEL default. It should say the key is optional, with `claude -p` on the Claude Code login otherwise, and give the default as `claude-sonnet-5`.
4. **`.env.local` lookup uses the daemon's cwd:** `readEnvValueFromDotEnvLocal` defaults to `process.cwd()` and caches per process. On the daemon path it therefore resolves from wherever the daemon was spawned, not from the `??` cwd as the old README promised. This may be a behaviour bug; per-request lookup would need the envelope cwd plus a cache keyed on it. The README now documents the actual behaviour.
5. **(new) Debug log is always on:** see Deviation 1. If the product intent is "off by default", the Node side needs a gate. Otherwise the current behaviour is now documented.
6. **(observation) Two live daemons:** `pgrep -fl 'daemon --socket /tmp/qq-'` showed two daemons (pids 905 and 4280, different node binaries) on the same socket path. One is probably orphaned. Left untouched, as instructed.

## Known Stubs

None.

## Threat Flags

None. This is a docs-only change; T-261017-01..04 are mitigated as planned (privacy fields match buildPrompt/buildSystemPrompt, `sk-ant-...` placeholder only, narrow pkill pattern verified with pgrep, init snippet fixed, invention gate passed).

## Self-Check: PASSED

- README.md, .wolf/anatomy.md, .wolf/buglog.json, .wolf/cerebrum.md and .wolf/memory.md all exist, and the changes are committed.
- Commits 9ff87b7 and 4a0ef47 are ancestors of HEAD. `git rev-list --count bb16c95..HEAD` = 2.
- The Task 1 verify exits 0. The Task 2 verify exits 0: the gate passed, HEAD contains README.md and no .pnpm-store or .mov files, and the subject matches `^docs\(readme\): [a-z]`.
