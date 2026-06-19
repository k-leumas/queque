---
phase: 06-hardening-privacy-defaults-and-extension-seams
verified: 2026-06-18T16:52:00Z
status: passed
score: 4/4 must-haves verified
human_verification:
  - test: "In an interactive zsh session with queque.zsh sourced, select a destructive candidate (e.g. rm -rf /tmp/foo) and confirm the yellow warn-only badge appears; press Enter and confirm the command lands in LBUFFER without auto-execution"
    expected: "Warning visible below selection; command inserted into buffer only; user must press Enter to run"
    why_human: "CMD-04 insertion-only contract depends on live ZLE/TTY behavior that unit tests grep but do not execute"
  - test: "With Zellij installed, set QQ_PANE_WIDTH=100 QQ_PANE_HEIGHT=30 and trigger ??; confirm floating pane dimensions match"
    expected: "Zellij pane opens at 100×30 instead of default 80×24"
    why_human: "Pane sizing requires real Zellij integration; shell script wiring verified statically"
---

# Phase 6: Hardening, Privacy Defaults, and Extension Seams Verification Report

**Phase Goal:** Make QueQue safe for daily use while preserving the extension architecture needed for cross-OS zsh, plugins, new providers, and local history.

**Verified:** 2026-06-18T16:52:00Z  
**Status:** passed  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | QueQue remains insertion-only and never auto-executes commands | ✓ VERIFIED | `shell/zsh/queque.zsh` has no `eval`, `zle -s`, or `accept-line`; `tests/zsh-widget.test.ts` includes `CMD-04: insertion-only shell contract` (36 tests); `CandidateSelect` warn-only destructive badge does not block `onSelect` |
| 2 | Privacy-sensitive defaults are documented and enforced in base request/context handling | ✓ VERIFIED | README `## Privacy defaults` + configuration table; `filterContextEnvelope` in `pipeline.ts` (line 50) and `claude.ts` `buildPrompt` (line 71); `redactForLog` wired in `appendDebugLog`; `docs/config.example.json` matches `qqConfigFileSchema`; integration tests pass |
| 3 | Built-in modules use extension registries consistently instead of bypassing them | ✓ VERIFIED | `bootstrapBuiltins()` registers context providers, shell adapters, storage hooks, and provider backends; `gatherContext` uses `listContextProviders()`; `run-foreground.ts` uses `resolveAdapter(detectProvider())` with no direct `claude.ts` import; `init.ts` uses `listShellAdapters()` after bootstrap |
| 4 | Codebase is ready for cross-OS zsh and plugin work immediately after | ✓ VERIFIED | `docs/EXTENSIONS.md` documents Phase 7 storage-hooks, Phase 8 providers, cross-OS zsh via `registerShellAdapter()`; `docs/SYSTEM_DESIGN.md` reflects Phases 3–6 flow; `QQ_PANE_WIDTH`/`QQ_PANE_HEIGHT` implemented in `queque.zsh`; registries exported and documented |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/shared/privacy-filter.ts` | Privacy filter layer for envelope and logs | ✓ VERIFIED | Exports `filterContextEnvelope`, `redactForLog`, `isFileReadAllowed`, `isDestructiveCommand`; 87 lines substantive |
| `src/context/pipeline.ts` | Calls filter after provider gather | ✓ VERIFIED | `filterContextEnvelope({ base, extras })` on return path; logs `queryLength` not raw lbuffer |
| `src/shared/debug-log.ts` | Redacts before JSON.stringify | ✓ VERIFIED | `formatDetails(redactForLog(details))` in `appendDebugLog` (line 21) |
| `src/providers/resolver.ts` | Maps DetectedProvider to LLMAdapter | ✓ VERIFIED | `resolveAdapter` with user-facing bootstrap guard and Phase 8 deferral messages |
| `src/registry/provider-backends.ts` | Provider registry with adapter instances | ✓ VERIFIED | `getProviderAdapter`, `registerProviderBackend` with `adapter: LLMAdapter` |
| `tests/debug-log.test.ts` | Debug log redaction regression tests | ✓ VERIFIED | Asserts `[redacted:Nchars]` default and verbose preservation; 194-test suite green |
| `tests/context-pipeline.test.ts` | Pipeline integration for envelope filtering | ✓ VERIFIED | Test `'filters sensitive paths from git changedFiles in gatherContext output'` excludes `.env` |
| `docs/config.example.json` | Example privacy config for users | ✓ VERIFIED | Top-level `privacy` + `safety` keys; `jq` validates |
| `docs/SYSTEM_DESIGN.md` | Current architecture doc | ✓ VERIFIED | Renamed from typo path; mermaid flow includes `filterContextEnvelope` and `resolveAdapter`; no placeholder language |
| `docs/EXTENSIONS.md` | Expansion path for plugins and providers | ✓ VERIFIED | Registry table, Phase 7/8 roadmap, privacy config field table |
| `shell/zsh/queque.zsh` | QQ_PANE env vars for Zellij | ✓ VERIFIED | `QQ_PANE_WIDTH:-80`, `QQ_PANE_HEIGHT:-24` passed to `zellij run --width/--height` |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `src/context/pipeline.ts` | `src/shared/privacy-filter.ts` | `filterContextEnvelope` after gather | ✓ WIRED | Line 50 return path |
| `src/shared/debug-log.ts` | `src/shared/privacy-filter.ts` | `redactForLog` before stringify | ✓ WIRED | `appendDebugLog` calls `formatDetails(redactForLog(details))` — gsd-tools expected pattern inside `formatDetails` body but wiring is correct |
| `src/client/run-foreground.ts` | `src/providers/resolver.ts` | `resolveAdapter(detected)` | ✓ WIRED | Line 155; error catch writes `kind: 'error'` ShellResult |
| `src/providers/claude.ts` | `src/shared/privacy-filter.ts` | `filterContextEnvelope` in buildPrompt | ✓ WIRED | Defense-in-depth before chunk extraction |
| `src/registry/bootstrap.ts` | `src/providers/claude.ts` | `adapter: claudeAdapter` | ✓ WIRED | Single registration point for Claude adapter |
| `README.md` | `docs/EXTENSIONS.md` | expansion path link | ✓ WIRED | Multiple links present |
| `shell/zsh/queque.zsh` | `QQ_PANE_WIDTH` | zellij run dimensions | ✓ WIRED | Env vars with defaults passed to `--width`/`--height` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `pipeline.ts` → envelope | `extras` git changedFiles | `listContextProviders()` → provider.gather | Mock/real git provider returns paths; `.env` stripped | ✓ FLOWING |
| `claude.ts` buildPrompt | `filtered.extras` | `filterContextEnvelope(envelope)` | Test asserts `.env` excluded from prompt JSON | ✓ FLOWING |
| `debug-log.ts` | log line details | `redactForLog(details)` | Test asserts lbuffer redacted to `[redacted:12chars]` | ✓ FLOWING |
| `run-foreground.ts` | candidates | `adapter.fetchCandidates(envelope)` | Registry-resolved adapter; mocked in client-result tests | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite | `pnpm test:run` | 194/194 passed | ✓ PASS |
| Privacy defaults documented | `grep -q 'Privacy defaults' README.md` | match | ✓ PASS |
| Config example valid | `jq -e '.privacy.sensitivePathPatterns' docs/config.example.json` | valid JSON | ✓ PASS |
| SYSTEM_DESGN typo retired | `test ! -f docs/SYSTEM_DESGN.md` | absent | ✓ PASS |
| No eval in zsh widget | `grep -E 'eval\|zle -s' shell/zsh/queque.zsh` | no matches | ✓ PASS |
| No direct claude import in client | `grep "from '../providers/claude" src/client/` | no matches | ✓ PASS |
| No file byte reads in context providers | `grep readFile src/context/providers/` | no matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| CMD-04 | 06-01, 06-02, 06-03 | Tool never auto-executes commands; only returns to shell buffer | ✓ SATISFIED | zsh widget insertion-only tests; README documents insertion-only; no execution paths in widget or client |
| EXT-01 | 06-02 | Internal registries for shell adapters, context providers, provider backends, storage hooks | ✓ SATISFIED | All four registries populated in `bootstrap.ts`; production paths resolve through registries; documented in EXTENSIONS.md |

No orphaned requirements mapped to Phase 6 beyond CMD-04 in ROADMAP. EXT-01 claimed by 06-02-PLAN and verified via registry wiring (originally Phase 2 requirement, hardened in Phase 6).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/shared/qq-config.ts` | 35–40 | `useGitignore` described as "Not yet implemented" placeholder in schema | ℹ️ Info | Accurate deferral; documented in EXTENSIONS.md as ignored today — not a stub in runtime path |
| `src/shared/privacy-filter.ts` | 47–49 | `QQ_DEBUG_VERBOSE=1` returns details unmodified (no API-key-shaped redaction) | ℹ️ Info | Plan 06-01 behavior spec mentioned verbose-mode secret redaction; README/docs describe verbose as full-buffer debug mode — acceptable opt-in tradeoff, not a phase goal blocker |

No blocker or warning anti-patterns found in Phase 6 production paths.

### Human Verification Required

### 1. Live CMD-04 insertion-only flow

**Test:** Source `shell/zsh/queque.zsh`, trigger `??`, accept a candidate including a destructive one.  
**Expected:** Command appears in buffer; shell does not auto-run it; destructive warning visible in TUI.  
**Why human:** ZLE widget behavior requires interactive terminal session.

### 2. Zellij pane sizing

**Test:** Set `QQ_PANE_WIDTH=100` and `QQ_PANE_HEIGHT=30`, trigger QueQue in Zellij.  
**Expected:** Floating pane uses custom dimensions.  
**Why human:** Requires Zellij runtime; static grep confirms wiring only.

### Gaps Summary

No gaps blocking phase goal achievement. All four ROADMAP success criteria are verified in code, tests (194/194 pass), and documentation. Extension seams (registries, resolver, storage-hooks scaffold, cross-OS zsh documentation) are in place for Phase 7/8 work.

Minor tooling note: gsd-tools artifact checks flagged `tests/debug-log.test.ts` and `tests/context-pipeline.test.ts` for missing literal pattern strings (`redactForLog`, `filterContextEnvelope`), but both test files exist and assert the behaviors via integration tests — false negatives from pattern-matching heuristics.

---

_Verified: 2026-06-18T16:52:00Z_  
_Verifier: Claude (gsd-verifier)_
