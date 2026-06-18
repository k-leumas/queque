---
phase: 20260617-privacy-config-file
reviewed: 2026-06-18T15:17:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - src/shared/qq-config.ts
  - src/shared/privacy-filter.ts
  - src/providers/resolver.ts
  - docs/EXTENSIONS.md
  - docs/config.example.json
  - src/shared/debug-log.ts
  - src/registry/provider-backends.ts
  - src/registry/bootstrap.ts
  - src/client/run-foreground.ts
  - src/context/pipeline.ts
  - src/cli/commands/init.ts
  - src/providers/claude.ts
  - src/providers/index.ts
  - src/ui/CandidateSelect.tsx
  - tests/privacy-filter.test.ts
  - tests/qq-config.test.ts
  - tests/provider-resolver.test.ts
  - tests/client-result.test.ts
  - tests/registry-bootstrap.test.ts
  - tests/zsh-widget.test.ts
  - tests/context-pipeline.test.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: resolved
remediated: 2026-06-18T22:45:00Z
remediation_commit: 1f19b96
---

# Phase 20260617-privacy-config-file: Code Review Report

**Reviewed:** 2026-06-18T15:17:00Z  
**Depth:** standard  
**Files Reviewed:** 21  
**Status:** resolved (2026-06-18)

All critical and warning findings remediated in follow-up commits. Info items (IN-01–IN-03) remain intentional deferrals documented in EXTENSIONS.md.

## Summary

| Severity | Count | Pass/Fail |
|----------|-------|-----------|
| Critical | 1 | **FAIL** |
| Warning | 4 | FAIL |
| Info | 3 | — |

Privacy filtering, config merge, registry-backed provider resolution, and destructive-command UI warnings are architecturally sound and align with Phase 6 goals. However, **`src/shared/qq-config.ts` has a syntax error that prevents the project from compiling or running any test that imports the privacy stack.** `pnpm test:run` fails at esbuild transform on line 34 (`optional().` trailing dot), cascading into 36 test failures across privacy, resolver, pipeline, client, claude, and candidate-select suites.

After fixing the syntax error, re-run the full suite (`pnpm test:run`) — several unrelated daemon sandbox EPERM failures may still appear in restricted environments.

---

## Critical Issues

### CR-01: Syntax error in qq-config schema blocks build

**File:** `src/shared/qq-config.ts:34-35`  
**Issue:** Trailing `.` after `z.boolean().optional().` makes the file invalid TypeScript. esbuild reports `Expected identifier but found "}"`. Every module importing `qq-config` or `privacy-filter` fails to load, breaking the CLI, debug-log redaction, context pipeline filtering, and CandidateSelect destructive warnings.

**Fix:**
```typescript
    useGitignore: z.boolean().optional(),
  })
  .optional();
```

---

## Warnings

### WR-01: replace-buffer-fixture debug log still writes raw shell buffers

**File:** `src/client/run-foreground.ts:130-134`  
**Issue:** LLM-mode request logging was redacted (`redactForLog` + length-only fields), but `replace-buffer-fixture` mode still logs full `lbuffer` and `rbuffer` via `appendDebugLog`. Debug logs land in `/tmp/qq-<uid>-debug.log` (mode 0o600) but violate the Phase 6 privacy default for buffer text.

**Fix:** Apply the same redaction pattern used at lines 96–101, or log lengths only:
```typescript
void appendDebugLog('client', 'wrote replace-buffer result', redactForLog({
  resultFile,
  lbufferLength: fixtureLbuffer.length,
  rbufferLength: request.rbuffer.length,
}));
```

### WR-02: Invalid config file fails silently

**File:** `src/shared/qq-config.ts:90-99`  
**Issue:** `readConfigFile()` catches all errors (missing file, invalid JSON, Zod schema mismatch) and returns `{}`. A user who typo'd `config.json` or supplied malformed regex keys gets no feedback — custom privacy patterns are silently dropped while built-ins still apply, which is confusing during security tuning.

**Fix:** Distinguish `ENOENT` from parse/validation failures; `console.warn` or debug-log a one-line message for invalid config (still fall back to defaults).

### WR-03: `qq init` idempotency check is inverted (pre-existing, touched file)

**File:** `src/cli/commands/init.ts:44`  
**Issue:** `if (existing.search(marker))` treats `-1` (not found) as truthy, so `qq init zsh` exits with "already present" for most `.zshrc` files that do **not** contain queque. Only a match at index `0` (falsy) allows append. This file was modified in this changeset (registry bootstrap) but the bug predates Phase 6.

**Fix:**
```typescript
if (marker.test(existing)) {
  console.error('queque: shell integration already present in ~/.zshrc');
  process.exit(0);
}
```

### WR-04: User-supplied regex patterns have no ReDoS guard

**File:** `src/shared/qq-config.ts:71-82`  
**Issue:** `compilePatterns()` compiles arbitrary user strings from `config.json` into `RegExp` with no length cap or timeout. A pathological pattern in `~/.config/qq/config.json` could stall `isSensitivePath()` / `isDestructiveCommand()` on every keystroke in the TUI. Risk is local (user's own config) but still a robustness concern for a privacy feature.

**Fix:** Cap pattern length (e.g. 256 chars), skip patterns over the limit, and consider anchoring/simplifying user patterns in docs.

---

## Info

### IN-01: `useGitignore` schema field is parsed but never applied

**File:** `src/shared/qq-config.ts:34`, `src/shared/privacy-filter.ts`  
**Issue:** Config schema and docs reserve `privacy.useGitignore`, but `loadQqConfig()` ignores it. Documented as intentional in EXTENSIONS.md — not a bug, but dead schema surface until implemented.

### IN-02: `isFileReadAllowed()` exported but not wired to context providers

**File:** `src/shared/privacy-filter.ts:16-18`  
**Issue:** D-06 gate exists and is tested, but no production caller checks it before file reads. Acceptable for forward-looking seam; filesystem provider only emits filenames today.

### IN-03: Double redaction in some client log paths

**File:** `src/client/run-foreground.ts:96`, `src/shared/debug-log.ts:21`  
**Issue:** `runForegroundClient` calls `redactForLog()` before `appendDebugLog`, which applies `redactForLog()` again. Harmless but redundant; could pass details through directly to `appendDebugLog`.

---

## Per-file notes

| File | Notes |
|------|-------|
| `src/shared/qq-config.ts` | **CR-01** syntax error. Good merge semantics (defaults + user patterns, env override for file read). Config cache is fine for CLI lifecycle. |
| `src/shared/privacy-filter.ts` | Clean git-chunk filtering; correctly does not use `.gitignore`. `redactForLog` recursion handles nested objects under redact keys. |
| `src/providers/resolver.ts` | Correct anthropic-key → claude mapping; explicit Phase 8 throws for other kinds. Relies on `main.ts` calling `bootstrapBuiltins()` before client — verified. |
| `src/shared/debug-log.ts` | Central redaction hook is the right seam; mode 0o600 preserved. |
| `src/registry/provider-backends.ts` | Adapter stored on registration; `getProviderAdapter()` is clean. Return type of `getProviderBackend()` omits `adapter` field (type-only nit). |
| `src/registry/bootstrap.ts` | Claude adapter registered correctly. |
| `src/client/run-foreground.ts` | Registry resolver integration good. **WR-01** fixture log leak. LLM path correctly resolves adapter after provider detection. |
| `src/context/pipeline.ts` | `filterContextEnvelope` applied at assembly boundary — correct ordering before provider API call. |
| `src/cli/commands/init.ts` | Registry-driven shell list is good. **WR-03** pre-existing search bug. |
| `src/providers/claude.ts` | Filesystem chunk now included in prompt when present — consistent with envelope. |
| `src/providers/index.ts` | Re-exports resolver — fine. |
| `src/ui/CandidateSelect.tsx` | Destructive warning is warn-only, tied to selected visible candidate — correct UX. |
| `docs/EXTENSIONS.md` | Accurate registry and privacy documentation. |
| `docs/config.example.json` | Valid example; matches schema intent. |
| `tests/privacy-filter.test.ts` | Good coverage; blocked by CR-01 at transform time. |
| `tests/qq-config.test.ts` | Schema tests minimal but adequate. |
| `tests/provider-resolver.test.ts` | Covers anthropic-key + Phase 8 throws; missing openai-key/none cases (minor). |
| `tests/client-result.test.ts` | Resolver mock migration looks correct. |
| `tests/registry-bootstrap.test.ts` | Adapter registration assertion added. |
| `tests/zsh-widget.test.ts` | CMD-04 no-eval grep test is a good safety net. |
| `tests/context-pipeline.test.ts` | Blocked by CR-01 import chain; structure unchanged and sound. |

---

_Reviewed: 2026-06-18T15:17:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
