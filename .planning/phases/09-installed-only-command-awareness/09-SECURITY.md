---
phase: "09"
slug: "installed-only-command-awareness"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-10"
---

# Phase 09 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| zsh widget → session dir files | Widget writes `$commands`/`$builtins`/`$functions`/`$aliases` names into the private `mktemp -d` (chmod 700) session dir | Local binary, function and alias names (private) |
| model output → lexer | Candidate command strings from the model are parsed by the hand lexer | Untrusted, possibly truncated text |
| model output → install form | Missing command words become installer arguments in text the user may run | Untrusted words → shell text |
| client → shell buffer | Displayed command is inserted into the zsh line, never executed by QueQue | Shell text |
| client → debug log | Client writes diagnostics to a user-readable log | Counts and error codes only |
| client → daemon (Unix socket) | Envelope with the installed-tools chunk crosses IPC to a possibly older daemon | Public catalog tool names |
| client/daemon → hosted model | Steered system prompt leaves the machine (SDK or `claude -p`) | Public catalog tool names |
| process argv | `claude -p --system-prompt <text>` is visible through `ps` | Public catalog tool names |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-09-01 | DoS | `src/shared/command-words.ts` lexer | high | mitigate | `MAX_COMMAND_LENGTH=8192` (L51), `MAX_RECURSION_DEPTH=32` (L54, enforced L418), Map tables (L328–394), `extractCommandWords` try/catch → `[]` (L578–582) | closed |
| T-09-02 | Info Disclosure | `src/client/tool-handoff.ts`, `run-foreground.ts` logs | medium | mitigate | Logs carry `reason` or `commands`/`builtins` sizes only; `tests/tool-handoff.test.ts:113` asserts no tool name is logged | closed |
| T-09-03 | Tampering | handoff files in session dir | medium | mitigate | `readToolHandoff` reads only `path.join(sessionDir, TOOL_HANDOFF_FILES.*)` fixed names; nothing from request JSON | closed |
| T-09-04 | Tampering | flagged candidate inserted into shell | low | accept | Insertion-only contract; flag is display-only — see Accepted Risks | closed |
| T-09-05 | DoS | lexer regression | high | mitigate | `tests/command-words-fuzz.test.ts`: child process, 20k+5k seeded inputs, 15 s/10 s hard kills, 16 MiB buffer; child soft budget 250 ms | closed |
| T-09-06 | Tampering | prototype-key command words | medium | mitigate | `tests/command-words.test.ts:125–157` cover `constructor`/`__proto__` | closed |
| T-09-07 | Info Disclosure | installed-tools chunk / system prompt | high | mitigate | `src/contracts/request.ts:130` regex+length schema, `INSTALLED_TOOLS_MAX=512`, `keepCatalogNames` transform; `strictInstalledToolsChunkSchema` (L141); `steering.ts:21` re-filters to `CATALOG_SET` | closed |
| T-09-08 | Tampering | adapter bypassing steering | medium | mitigate | `tests/steering.test.ts:218–257` `adapters` guard (a–d); `EXTENSIONS.md` "Prompt steering (Phase 9)" builder rule | closed |
| T-09-09 | Info Disclosure | `ps` exposure of `--system-prompt` | low | accept | Covered by T-08-02-07 — see Accepted Risks | closed |
| T-09-10 | Tampering | `planInstall` / install form | high | mitigate | `SAFE_PACKAGE_NAME_RE` (`tool-awareness.ts:45`) gates every missing word (L263); otherwise form blocked | closed |
| T-09-11 | Tampering | install form with list operators | medium | mitigate | Brace-group wrap `${prefix} && { cmd; }` (`tool-awareness.ts:253`) | closed |
| T-09-12 | EoP | `sudo apt/dnf/pacman` forms | medium | mitigate | No `-y`/`--noconfirm` (`tool-awareness.ts:31–38`); insertion-only; `\bsudo\b` destructive pattern (`qq-config.ts:23`) drives ⚠ on the displayed form (`CandidateSelect.tsx:274`) | closed |
| T-09-13 | Spoofing | Tab toggle on wrong row after filter | low | mitigate | Toggle keyed by `candidateKey` (`modal-layout.ts:33`); reset on candidate change (`CandidateSelect.tsx:121`); `tests/modal-layout.test.ts` | closed |
| T-09-14 | DoS | stale daemon dropping chunk | medium | mitigate | Pong advertises `installedTools: true` (`server.ts:72`); `pingDaemonFetchCap` returns `'no'` without it (`bootstrap.ts:42–52`), listener replaced (L222) | closed |
| T-09-15 | Info Disclosure | chunk on IPC / in-process fallback | high | mitigate | Client validates with `strictInstalledToolsChunkSchema` before send (`run-foreground.ts:68`); daemon schema filters; `tests/client-result.test.ts:900` | closed |
| T-09-16 | Info Disclosure | debug log of the chunk | low | mitigate | Logs `steered` count or `issues.length` only (`run-foreground.ts:73–80`) | closed |
| T-09-17 | DoS | `_qq_write_tool_handoff` under ERR trap | high | mitigate | `shell/zsh/queque.zsh`: `|| return 0`, `|| true`, chained writes with partial-file cleanup, stderr discarded, `return 0`; `tests/zsh-widget.test.ts:754–857` | closed |
| T-09-18 | Tampering | escape read → `undefined` word | medium | mitigate | `?? ''` fallback on every escape read (`command-words.ts:207, 229, 248`) | closed |
| T-09-19 | DoS | catalog drift client↔daemon | medium | mitigate | `keepCatalogNames` zod transform filters unknown names instead of failing `ipcRequestSchema` (`request.ts:130`) | closed |
| T-09-20 | Tampering | brace wrapper with `#` comment / heredoc | medium | mitigate | `unwrappable-command` block when wrap needed and comment/heredoc token present (`tool-awareness.ts:235–270`) | closed |
| T-09-21 | Tampering | verification of T-09-18 | medium | mitigate | Fuzz child exits 3 on any word containing `undefined` (`tests/fixtures/command-words-fuzz-child.mjs:13, 48`) | closed |
| T-09-22 | DoS | verification of T-09-19 | medium | mitigate | `tests/daemon-fetch.test.ts:100` "filters a catalog name the daemon does not know instead of dropping the request" | closed |
| T-09-SC | Tampering | npm/pip/cargo installs | high | mitigate | No new runtime or dev dependencies in phase 09 plans. Only `66bc863` (pnpm 11.8.0 → 12.6.0 `packageManager` pin, sha512-hashed) changed the lockfile in the window — a toolchain bump, not a QueQue dependency | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-09-01 | T-09-04 | Flag is display-only; QueQue inserts into the buffer and never executes, so the user reviews before running | Plan 09-01 threat model | 2026-10-10 |
| AR-09-02 | T-09-09 | Already accepted as T-08-02-07; the added text is public catalog tool names only, so `ps` disclosure does not meaningfully grow | Plan 09-03 threat model | 2026-10-10 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-10 | 23 | 23 | 0 | /gsd-secure-phase (orchestrator, ASVS L1 grep-depth; auditor skipped per short-circuit rule) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-10
