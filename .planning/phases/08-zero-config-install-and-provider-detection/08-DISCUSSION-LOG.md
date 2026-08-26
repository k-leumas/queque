# Phase 8: Zero-Config Install and Provider Detection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-25
**Phase:** 08-zero-config-install-and-provider-detection
**Areas discussed:** 08-02 backend set, logged-out Claude CLI / failure copy, pin vs waterfall

---

## Which backends 08-02 wires

| Option | Description | Selected |
|--------|-------------|----------|
| Claude CLI only | Wire `claude -p` this plan; leave OpenAI/Ollama | |
| Claude + OpenAI | Subprocess Claude and OpenAI | |
| All three including Ollama | Match ROADMAP success criteria #1–#3 in 08-02 | |
| Freeform | Claude only; CLI `/login` and env key both work | ✓ |

**User's choice:** Claude only for now. Use CLI `/login` and the env key. On failure tell them to fix it with `/login` (preferred — easier, fewer moving parts) or by adding an API key to the env file.

**Notes:** ROADMAP 08-02 text listed `claude -p` and `openai` CLI; resolver stubs also mention Ollama. User narrowed 08-02 to Claude.

---

## Non-Claude detections during 08-02

| Option | Description | Selected |
|--------|-------------|----------|
| Skip Ollama/OpenAI in detection until wired | No Claude → none / wizard, not a dead-end | |
| Keep detecting, leave “not wired yet” | Honest but strands users | |
| You decide | Smallest 08-02 without stranding users | ✓ |

**User's choice:** You decide.

**Notes:** Locked as: do not show “not wired yet.” Treat Ollama/OpenAI detections as a Claude setup miss until pins/adapters exist.

---

## Both API key and Claude CLI present

| Option | Description | Selected |
|--------|-------------|----------|
| Key wins SDK | Keep 08-01 waterfall: key → SDK, CLI only if no key | |
| CLI wins | If `claude` on PATH, always `claude -p`; key is fallback when CLI is missing | ✓ |
| You decide | | |

**User's choice:** CLI wins.

**Notes:** Follow-up footgun: logged-out CLI with a working key. User then chose SDK rescue (below).

---

## CLI fail while key is set

| Option | Description | Selected |
|--------|-------------|----------|
| SDK rescue | If `claude -p` fails and a key is set, fall back to SDK | ✓ |
| Hard error | Show `/login` or env-key error even if a key is present | |
| You decide | | |

**User's choice:** SDK rescue.

**Notes:** Vendor fallthrough (OpenAI/Ollama) remains forbidden. Rescue is inside Claude only.

---

## Support all backends without a waterfall

| Option | Description | Selected |
|--------|-------------|----------|
| Keep runtime detect waterfall | Probe Claude, Ollama, OpenAI every `??` | |
| Silent try Claude → OpenAI → Ollama at request time | Still a waterfall; can steal the request | |
| Pin at install / first-run; Claude silent default | Explicit OpenAI/Ollama; no probe chain | ✓ |

**User's choice:** Lock pin-over-waterfall. Ask at install/first-run for non-Claude; default Claude so zero-config holds.

**Notes:** Do not hang the quiz on `qq init zsh` (pipeable into `.zshrc`). Interactive picker on `/dev/tty` or `qq init provider`. Persist `~/.config/qq/provider.json`. Menu order Claude → OpenAI → Ollama is prompt order only.

---

## Claude's Discretion

- CLI-then-SDK rescue implementation (try/catch vs typed auth errors)
- `provider.json` schema details
- 08-03 picker surface (first failed `??` vs `qq init provider`)
- `claude -p` output parsing (reuse JSON `parseCandidates` unless research says otherwise)
- Whether 08-02 removes `detectProvider()` or leaves it debug-only
- Exact error copy

## Deferred Ideas

- OpenAI and Ollama adapters (08-03, behind a pin)
- Native token reuse from Claude Code credentials
- Auto-fallback across vendors (rejected)
- Phase 5 clarification chat
