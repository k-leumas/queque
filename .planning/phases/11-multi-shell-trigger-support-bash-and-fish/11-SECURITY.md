---
phase: "11"
slug: "multi-shell-trigger-support-bash-and-fish"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-15"
---

# Phase 11 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register built from the `<threat_model>` blocks of plans 11-01..11-11 (authored at plan time). `block_on: high`.
> Mitigations verified at L1 (grep at file:line) by gsd-security-auditor, backed by 12 related test files (608 tests) run with bash 5.3.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| bash readline → adapter | `??` binding reads the live line and writes it back | the user's typed line and cursor; only assignment to READLINE_LINE/POINT, never eval |
| adapter → client | per-invocation 0700 session dir in /tmp | request.json (jq-built), tool lists, result/frame files with fixed names |
| request.json → Node | zod parse of the shell request | `shell` enum, `shellVersion` (≤40 chars, never in prompt or logs) |
| `qq init` / `qq doctor` → user dotfiles | appends one source line to the shell's rc file; probes bash read-only | rc path from the registry; version numbers only in output |
| client/daemon → telemetry endpoint | opt-in anonymous counts | `shell` enum and major.minor `shell_version`, never the raw build string |
| CI → Docker images | distro smoke and `bash:<tag>` version job | read-only repo mount; no secrets |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-11-01 | Tampering | `_qq_apply_result_str` summary print | medium | mitigate | values only via `%s` with a fixed format; line set by assignment (shell/bash/queque.bash) | closed |
| T-11-02 | Tampering | request.json construction | high | mitigate | `jq -n --arg/--argjson`; `shell: z.enum(SHELL_NAMES)`, `shellVersion` max 40 (src/contracts/shell.ts); parsed in run-foreground | closed |
| T-11-03 | Tampering / EoP | session dir in /tmp | high | mitigate | `command mktemp -d`, return before any write on failure, `chmod 700`; bash-widget b9 | closed |
| T-11-04 | EoP | result application | high | mitigate | READLINE_LINE/POINT assignment only; no eval/accept-line; b5 static + functional | closed |
| T-11-05 | DoS | user `set -e`, aliases, functions | medium | mitigate | `local -` + `set +euE +o pipefail`; `command` prefix; b6, PTY errexit | closed |
| T-11-06 | Tampering | test harness | medium | mitigate | tests/pty/drive.sh strips ZELLIJ/TMUX env, private tmux socket; throwaway HOME, telemetry off | closed |
| T-11-07 | Spoofing | `QQ_TEST_RESULT_MODE` in a real shell | low | accept | dev/test only (CONTRIBUTING.md); see accepted risks | closed |
| T-11-08 | Tampering | `shellName` in the prompt | medium | mitigate | `z.enum(SHELL_NAMES)` in request + shell contracts; shell-contract rejects `tcsh`, `''` | closed |
| T-11-09 | Info disclosure | `shellVersion` | low | mitigate | max 40; not in base context, logs or prompts; telemetry shapes to major.minor | closed |
| T-11-10 | DoS | pending-marker wait | medium | mitigate | 500 ms budget, null on `pending-timeout` (src/client/tool-handoff.ts); test | closed |
| T-11-11 | Info disclosure | handoff debug logs | medium | mitigate | logs reasons/counts only; tests assert no tool names | closed |
| T-11-12 | DoS | lexer on malformed model output | medium | mitigate | length/depth caps + never-throw wrapper (src/shared/command-words.ts); fuzz test | closed |
| T-11-13 | Tampering | rc file writes | high | mitigate | registry-gated, writes only `spec.rcFile`, idempotent append (src/cli/commands/init.ts); other rc files byte-identical in tests | closed |
| T-11-14 | Tampering | source line path | medium | mitigate | `resolveAdapterPath` uses fixed prefixes or the package dir, never env; path double-quoted | closed |
| T-11-15 | Info disclosure | init output | low | mitigate | fixed copy constants and `rcDisplay` literals | closed |
| T-11-16 | DoS | bash version probe | low | mitigate | `--noprofile --norc`, 3 s timeout, stdin ignored, BASH_ENV/ENV dropped | closed |
| T-11-17 | Tampering | instant frame painters (zsh, bash) | high | mitigate | `${1//[[:cntrl:]]/}` in both adapters, `\p{Cc}` in the TS oracle; parity fixtures incl. ESC/CSI/C1 | closed |
| T-11-18 | Info disclosure | Zellij pane frame | medium | mitigate | frame file in the 0700 dir; pane argv carries only the path; b18 | closed |
| T-11-19 | Info disclosure | `qq_environment` event | high | mitigate | telemetry allow list, major.minor regex or `unknown`; wire canary lacks `5.2.21`, `(1)-release`, `.bashrc` | closed |
| T-11-20 | Spoofing | `shell` from request.json | low | mitigate | request enum + `z.enum(SHELL_KINDS)` re-validation; SHELL_KINDS == SHELL_NAMES test | closed |
| T-11-21 | Tampering | session dir lifecycle | medium | mitigate | closed marker; dir removed only without `tools.pending`; fixed names; b13, b14 | closed |
| T-11-22 | DoS | job notices and stray output | medium | mitigate | `( { … } </dev/null >/dev/null 2>&1 & )` form; PTY handoff-quiet | closed |
| T-11-23 | DoS | Zellij FIFO read | high | mitigate | 30 s `read -t`, mkfifo failure returns before launch, read-write open, sentinel; b20, b22, b23 | closed |
| T-11-24 | Tampering | alias/function shadowing | medium | mitigate | every external `command`-prefixed (zellij by design); b16, PTY hostile-env | closed |
| T-11-25 | Info disclosure | doctor summaries and hints | high | mitigate | parsed version numbers and fixed copy only; doctor "no leaks for a bash target" | closed |
| T-11-26 | DoS | `bash -ic` binding probe | low | mitigate | 5 s SIGKILL timeout, stdin ignored, prewarm off, marker-line parse, skipped below 5.0 | closed |
| T-11-27 | Tampering | `bash:<tag>` images | low | accept | official images, read-only mount, no secrets; see accepted risks | closed |
| T-11-28 | Repudiation | smoke legs passing by skipping | medium | mitigate | smoke exits 1 without Docker under CI; runner requires an ok `binding` row | closed |
| T-11-29 | Tampering | Homebrew adapter path | medium | mitigate | formula installs to `share/queque`; registry resolves it; Docker smoke `test -f` | closed |
| T-11-30 | Tampering | documented install/undo commands | medium | mitigate | no rc redirects in docs; guarded `[ -f ~/.bashrc ] && . ~/.bashrc`; manual undo | closed |
| T-11-31 | Tampering | developer `~/.bashrc` during UAT | low | mitigate | append-only single write; documented undo; `~/.bash_profile` untouched in UAT | closed |
| T-11-SC (×11, one per plan) | Tampering | npm/pip/cargo installs | high | mitigate | no package.json/pnpm-lock changes in the phase; CI adds distro packages only (bash, tmux, jq, expect) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

Auditor notes (not gaps): the fuzz test runs only the zsh dialect (guards are dialect-independent); T-11-04's proof is the b5 functional test plus the PTY cancel scenario; the Homebrew Docker smoke mimics the formula block rather than running it.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-11-01 | T-11-07 | Fixture mode only writes back the user's own lbuffer (or `echo hello` on an empty line) and never runs it; documented as dev/test only and never set in a real shell (CONTRIBUTING.md). | plan 11-01 threat model | 2026-11-15 |
| AR-11-02 | T-11-27 | The CI version job pulls official Docker Hub `bash:<tag>` images by tag, mounts the repo read-only and uses no repository secret (Phase 10 D-01). | plan 11-09 threat model | 2026-11-15 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-15 | 42 | 42 | 0 | gsd-security-auditor (L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-15
