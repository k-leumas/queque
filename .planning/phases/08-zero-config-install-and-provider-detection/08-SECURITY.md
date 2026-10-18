---
phase: "08"
slug: "zero-config-install-and-provider-detection"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-18"
---

# Phase 08 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| qq ↔ `claude -p` child | Daemon spawns the Claude Code CLI; auth stays in Claude Code (Keychain/OAuth) | Filtered prompt (stdin), system prompt (argv), candidate text back |
| qq ↔ Anthropic API (SDK) | Used first when ANTHROPIC_API_KEY is set (D-08) | API key (header), filtered prompt |
| qq ↔ Ollama server | Pinned baseUrl (default localhost:11434, may be remote, http/https) | Filtered prompt, model name; no auth header; server error text back |
| qq ↔ api.openai.com | Constant endpoint; pin cannot redirect it | OPENAI_API_KEY (Bearer), filtered prompt |
| provider.json (user-editable file) | Read on every fetch; written by `qq init provider` | Provider id, model, baseUrl — never secrets (strict schema) |
| `qq init provider` ↔ /dev/tty, daemon socket | Interactive picker; restarts the daemon over IPC / lsof | Menu answers; shutdown request |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-08-01-01 | Information Disclosure | detectProvider logging | medium | mitigate | `src/providers/detect.ts` no longer logs at all and is never called on the `??` path (only re-exported from `index.ts`) | closed |
| T-08-01-02 | Spoofing | darwin PATH-only auth presence | low | accept | See AR-01 | closed |
| T-08-01-03 | Denial of Service | detection latency | low | mitigate | No detection on the fetch path (D-01/D-10); selector is one `readFileSync` of the pin | closed |
| T-08-02-01 | Information Disclosure | debug log / FIFO | high | mitigate | `claude-default.ts` debug lines carry path/exit/auth flags only; no argv, env, or raw output | closed |
| T-08-02-02 | Information Disclosure | `--bare` / child env | high | mitigate | `claude-cli.ts` never passes `--bare`; child `env: process.env` only (no `.env.local` copy) | closed |
| T-08-02-03 | Tampering / Hijack | stdin / tools / MCP | high | mitigate | `--safe-mode`, `--tools ""`, `--no-session-persistence` (`claude-cli.ts:62-65`). Since 09.1 the prompt is written to stdin and stdin is closed (`claude-process.ts:467-468`), so print mode always sees EOF | closed |
| T-08-02-04 | Denial of Service | stacked timeouts vs 30s FIFO | medium | mitigate | Single `TOTAL_BUDGET_MS = 25_000` (`claude-default.ts:9`). The `MIN_SDK_RESCUE_MS` rescue path was removed when SDK-first landed (07738ca, D-08); budget still single | closed |
| T-08-02-05 | Spoofing / Auth bypass | call-time auth | low | accept | See AR-02 | closed |
| T-08-02-06 | Elevation / vendor steal | waterfall to OpenAI/Ollama | high | mitigate | `claude-default.ts` imports no other vendor adapter; failure is a hard error (D-01, D-12) | closed |
| T-08-02-07 | Information Disclosure | spawn argv process list | medium | accept | See AR-03 (risk reduced since 09.1: the user prompt moved to stdin) | closed |
| T-08-08 | Information Disclosure | invalid/unreadable pin | high | mitigate | `provider-pin.ts:193` throws "not a valid provider pin … run `qq init provider`"; never resolves Claude. Empty/relative `QQ_PROVIDER_FILE` also fails closed (WR-03 fix 2834ebb) | closed |
| T-08-09 | Tampering | provider.json baseUrl | low | mitigate | Only `http:`/`https:` accepted (`provider-pin.ts:33`); strict schema has no openai baseUrl | closed |
| T-08-10 | Information Disclosure | Ollama request + debug log | medium | mitigate | Prompt via `buildPrompt` only; debug lines model/status/durationMs | closed |
| T-08-11 | Denial of Service | slow Ollama model load | medium | mitigate | `OLLAMA_TIMEOUT_MS = 25_000` + abort signal | closed |
| T-08-12 | Elevation of Privilege | pinned Ollama → Claude waterfall | high | mitigate | `ollama.ts` imports only shared parse helpers from `claude.js` (buildPrompt, finalCandidateListWithoutProse…), no adapter or SDK; tests assert SDK/runClaudeTurn never called | closed |
| T-08-13 | Information Disclosure | openai.ts errors and debug log | high | mitigate | Static copy; upstream `error.message` never read (`openai.ts:47`); tests assert no key/"Bearer"/prompt in logs | closed |
| T-08-14 | Information Disclosure | request destination | high | mitigate | `OPENAI_CHAT_COMPLETIONS_URL` constant (`openai.ts:25,172`); no openai baseUrl in schema | closed |
| T-08-15 | Information Disclosure | prompt content | medium | mitigate | `buildPrompt(envelope)` → filterContextEnvelope (`openai.ts:182`) | closed |
| T-08-16 | Denial of Service | slow or hung API call | medium | mitigate | `OPENAI_TIMEOUT_MS = 25_000` + abort signal | closed |
| T-08-17 | Elevation of Privilege | OpenAI → other vendor fallthrough | high | mitigate | `openai.ts` imports only shared parse helpers; tests assert Anthropic SDK, runClaudeTurn and localhost:11434 untouched | closed |
| T-08-18 | Information Disclosure | provider.json contents and mode | high | mitigate | Schema-validated before write; `mode: 0o600`, dir `0o700` (`provider-pin.ts:160-163`) | closed |
| T-08-19 | Tampering | temp file during atomic write | medium | mitigate | Temp written with `flag: 'wx'`, then `renameSync`; unlinked on error | closed |
| T-08-20 | Elevation of Privilege | restartDaemon process signalling | medium | mitigate | `assertSafeSocketPath` gate; IPC `shutdown` first, lsof listeners of the qq socket only as fallback (WR-07 fix 789b50d) | closed |
| T-08-21 | Tampering | `qq init zsh` output piped into ~/.zshrc | medium | mitigate | `dispatchInit` routes only literal `provider` (`init-provider.ts:434`); picker writes to /dev/tty only; docs use `qq init zsh && source ~/.zshrc` | closed |
| T-08-22 | Spoofing | URL opener / command execution | medium | mitigate | Opens only `OLLAMA_DOWNLOAD_URL` constant after explicit `y`, spawn without shell | closed |
| T-08-23 | Information Disclosure | Claude failure copy | low | mitigate | Static copy constants (`claude-default.ts:17,20`); WR-01 neutral copy never includes raw output | closed |
| T-08-24 | Spoofing | provider quiz on the `??` path (D-03) | medium | mitigate | Test "Claude default source never references the picker" (`tests/claude-cli-provider.test.ts:611`) | closed |
| T-08-25 | Information Disclosure | README key guidance | low | mitigate | README directs keys to env / `~/.env.local`; provider.json never holds keys (strict schema) | closed |
| T-08-SC | Tampering | npm/pip/cargo installs | low | accept | See AR-04 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

Severity for 08-01/08-02 rows is assigned here (those plans' registers had no severity column); 08-03..08-06 severities are as planned.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-08-01-02 | A PATH-only false positive (claude installed, logged out) fails at request time with clear copy pointing at `claude /login` / `qq init provider`; preferable to missing logged-in users | Plan 08-01 (developer-approved plan) | 2026-10-17 |
| AR-02 | T-08-02-05 | D-10: no `claudeAuthPresent()` gate; logged-out CLI fails closed at call time | Plan 08-02 (developer-approved plan) | 2026-10-17 |
| AR-03 | T-08-02-07 | The `--system-prompt` (installed-tools steering) is still on argv and listable via `ps` for up to 25s. The user prompt (cwd, branch, filenames, query) moved to stdin in 09.1, so the original exposure is largely removed. Do not log argv | Plan 08-02 (developer-approved plan) | 2026-10-17 |
| AR-04 | T-08-SC | No package installs in 08-03..08-06; HTTP via Node built-in fetch; the `openai` npm SDK deliberately not added | Plans 08-03..08-06 | 2026-10-17 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-18 | 29 | 29 | 0 | /gsd-secure-phase 08 (orchestrator, ASVS L1 grep-depth; plan-time registers; code review 08-REVIEW.md CR-01/WR-01..08 fixed) |

Related advisory (not a register threat): IN-01..IN-08 from 08-REVIEW.md remain open (see 08-REVIEW-DISPOSITION.md); IN-02 (pin error echoes unescaped key names) and IN-08 (plain-http remote baseUrl accepted) are security-adjacent, low.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-18
