# Phase 8: Zero-Config Install and Provider Detection - Research

**Researched:** 2026-08-25 (refreshed for 08-02; 08-01 Keychain section preserved)
**Domain:** Claude Code print-mode subprocess, CLI-then-SDK rescue, provider registry
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Provider selection — pin, not waterfall
- **D-01:** Do not auto-select among Claude / OpenAI / Ollama at runtime. A silent “try Claude, then OpenAI, then Ollama” chain is still a waterfall and can steal the request (e.g. local Ollama up while Claude is logged out).
- **D-02:** Runtime resolution is:
  1. If `~/.config/qq/provider.json` pins `openai` or `ollama` → that adapter only.
  2. Else → Claude default (see D-05–D-07).
  3. Else → hard error with `/login` or API-key copy, and a path into the provider picker (08-03).
- **D-03:** Claude is the silent default. A developer with Claude Code `/login` or `ANTHROPIC_API_KEY` must get a working `??` with no QueQue provider quiz (Phase 8 success criterion #1).
- **D-04:** OpenAI and Ollama are opt-in. Ask once (first-run wizard or `qq init provider`), persist the pin, reuse it. Menu order when asking: Claude → OpenAI → Ollama. That order is the prompt, not a probe chain.
- **D-05:** Do not attach the provider question to `qq init zsh`. That command is shell wiring and is documented as pipeable into `~/.zshrc`. Interactive prompts belong on `/dev/tty` at first failed `??`, or a separate provider-init command.

### 08-02 — Claude only
- **D-06:** 08-02 ships Claude only. No OpenAI or Ollama adapters in this plan.
- **D-07:** Both Claude auth modes work: `claude /login` (CLI) and `ANTHROPIC_API_KEY` from the environment or `.env.local`.
- **D-08:** If `claude` is on PATH, always call `claude -p` first — even when an API key is set. One primary code path; `/login` is preferred because it is easier and keeps key storage out of QueQue.
- **D-09:** Anthropic SDK is rescue only: (a) CLI not on PATH and a key is set, or (b) `claude -p` fails and a key is set. A logged-out CLI must not strand someone who already has a key.
- **D-10:** PATH-first is the fetch rule. Do not require `claudeAuthPresent()` to be true before attempting `claude -p`. If the CLI is present, try it; validate auth at call time. `detectProvider()` / `claudeAuthPresent()` are leftover preflight, not the long-term selector.
- **D-11:** `ollama` and `openai-key` detections must not surface “not wired yet”. Until those adapters and a pin exist, treat them as a Claude setup miss (same `/login` or key guidance).

### Failure UX
- **D-12:** When Claude CLI fails and no key can rescue, hard-error. Do not fall through to OpenAI or Ollama.
- **D-13:** Error copy prefers `claude /login`. Alternative: add `ANTHROPIC_API_KEY` to the env / `.env.local`. Carry forward Phase 3: write `{kind:'error', message}` to the FIFO and leave the shell buffer unchanged.

### 08-03 — pin + remaining adapters
- **D-14:** 08-03 persists `~/.config/qq/provider.json` and implements OpenAI + Ollama adapters for the pinned kinds. Next `??` skips probing and honors the pin.
- **D-15:** Changing provider is re-running the picker (or editing the pin), not re-detecting the machine.

### Claude's Discretion
- How to implement CLI-then-SDK rescue (try subprocess then SDK vs inspect auth-error kinds).
- Exact `provider.json` schema (single `provider` field vs extra model/baseUrl for Ollama).
- Exact picker copy and whether 08-03 lives in first-failed-`??` vs `qq init provider`.
- Parse `claude -p` output: reuse `buildPrompt` / `parseCandidates` JSON contract unless research shows a better CLI flag.
- Exact error-string wording.
- Whether 08-02 deletes or bypasses `detectProvider()` vs leaving it as debug-only.
- 08-01 review leftovers (Windows `which` vs `where`, test env isolation) if touching `detect.ts`.

### Deferred Ideas (OUT OF SCOPE)
- Native token reuse / SDK `authToken` from Claude Code credentials — ROADMAP: later optimization after subprocess.
- Merging `provider.json` into `config.json` — not required; sibling file matches 08-03 ROADMAP text.
- Phase 5 clarification chat — still deferred.
- Auto-try OpenAI then Ollama when Claude fails — explicitly rejected (D-01, D-12).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RUN-01 | A background daemon keeps repeat invocations fast and avoids paying full startup cost on every use. | 08-02 must not break the existing daemon/FIFO loop. Cap `claude -p` (and CLI+SDK rescue combined) at 25s so the zsh `read -t 30` FIFO never hangs. Write `{kind:'error'}` on timeout/auth miss via existing `writeShellResult`. Do not probe `claude -p` during detection. |
| EXT-01 | Internal registries exist for shell adapters, context providers, provider backends, and storage/extension hooks. | Register a `claude-cli` `LLMAdapter` in `bootstrapBuiltins()` / `registerProviderBackend`. Keep the existing `claude` SDK adapter as rescue. Resolution goes through the registry — no direct `claude.ts` import from `run-foreground.ts`. |
</phase_requirements>

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/` directory in this repo. Honor OpenWolf / cerebrum instead:

- Do not pass `temperature` / `top_p` / `top_k` on Anthropic Messages API (SDK rescue path).
- Do not stub a fake `claude` binary in smoke/integration tests.
- Do not quiz on `qq init zsh` (D-05).
- Privacy: `filterContextEnvelope` before any prompt; never log token values.

## Summary

08-01 shipped platform-aware `claudeAuthPresent()` so macOS Keychain `/login` users detect as `claude-cli`. That detection is **not** the 08-02 adapter selector (D-10). 08-02 must make `??` work for Claude users with zero QueQue config by calling `claude -p` when the binary can be spawned, then rescuing with the existing Anthropic SDK when a key exists in `ANTHROPIC_API_KEY` or `.env.local`.

Official Claude Code print-mode (verified 2026-08-25 against [headless docs](https://code.claude.com/docs/en/headless), [CLI reference](https://code.claude.com/docs/en/cli-reference), and local `claude` **2.1.206**): `-p`/`--print` is non-interactive; default `--output-format text` prints the model text to stdout; `--output-format json` wraps that text in a metadata envelope (`result` field) — **not** QueQue's candidate array. `--bare` skips Keychain/OAuth and would break `/login` users — **never use `--bare`**. Use `--safe-mode --tools "" --no-session-persistence` plus `--system-prompt` and the existing `buildPrompt` user message. Spawn with `stdio: ['ignore','pipe','pipe']` so Ink/Zellij TTY is not stolen. Shared 25s deadline for CLI then SDK so FIFO stays under 30s.

**Primary recommendation:** Add `claudeCliAdapter` + a composite Claude-default adapter (spawn `claude -p`, rescue SDK). Bypass `detectProvider()` as the runtime selector; do not delete it. Reuse `buildPrompt` / `parseCandidates` / `candidateListSchema` with `--output-format text` (default). Do not parse conversational prose. Do not implement OpenAI/Ollama or `provider.json` in 08-02.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node `child_process.spawn` / `execFile` | Node 24 (`.nvmrc` 24.14.1; research host v26.3.0) | Run `claude -p` with timeout + SIGTERM | Already used for daemon spawn and git `execFile`; no extra dependency |
| `AbortSignal.timeout` / `timeout` + `killSignal: 'SIGTERM'` | Node 14.18+ / 15.13+ | 25s cap matching SDK | Official Node API; Claude docs: SIGTERM → exit 143, process tree cleaned |
| `@anthropic-ai/sdk` | 0.92.0 (package.json) | SDK rescue only | Existing `claudeAdapter`; do not add Agent SDK npm package |
| `zod` | 4.1.5 | `candidateListSchema` fail-closed | Existing CMD-01/CMD-02 contract |
| `vitest` | 4.0.4 | Unit tests with mocked spawn | Existing `vitest.config.ts` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ink` 7.0.1 | existing | Foreground TUI spinner during fetch | Do not inherit stdio into `claude` |
| `src/shared/env-file.ts` | existing | `.env.local` key for rescue | Same helper as SDK path |
| `src/shared/privacy-filter.ts` | existing | `filterContextEnvelope` + log redaction | Call via `buildPrompt`; never log secrets |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `claude -p` subprocess | `@anthropic-ai/claude-agent-sdk` | Deferred — ROADMAP says subprocess first; token reuse later |
| `--output-format text` + `parseCandidates` | `--output-format json --json-schema` | Schema is more rigid but returns `{structured_output}` wrapper; extra parse layer; skip for 08-02 |
| `--bare` | `--safe-mode` | `--bare` skips Keychain/OAuth (official + local help). `--safe-mode` keeps auth, disables CLAUDE.md/hooks/MCP |
| `execa` | Node `child_process` | Do not add a package; project already spawns processes |
| Conversational stdout parse | JSON candidate contract | ROADMAP 08-02 mentioned conversational parse; CONTEXT + CLI flags make JSON the right contract |

**Installation:** none — no new packages.

**Version verification:** `package.json` pins vitest 4.0.4, zod 4.1.5, `@anthropic-ai/sdk` 0.92.0. Local Claude Code CLI: **2.1.206** (`claude --version`, 2026-08-25). Official docs fetched the same day.

## Architecture Patterns

### Recommended Project Structure
```
src/providers/
├── provider.ts              # LLMAdapter (unchanged)
├── claude.ts                # SDK adapter; EXPORT buildPrompt + parseCandidates + ensureSelectableCandidates
├── claude-cli.ts            # NEW: spawn claude -p; parse stdout via parseCandidates
├── claude-default.ts        # NEW: spawn-first composite; SDK rescue; shared 25s deadline
├── detect.ts                # KEEP: leftover preflight; export claudeOnPath if tests need it; do not gate fetch
├── resolver.ts              # 08-02: Claude default for all non-pin kinds; no "not wired yet"
└── index.ts                 # export new adapters if needed

src/registry/bootstrap.ts    # register id: 'claude-cli' next to existing 'claude'
src/client/run-foreground.ts # bypass detectProvider as selector; still write error FIFO
```

`provider.json` is 08-03. Do not read/write it in 08-02.

### Pattern 1: Print-mode invocation (locked flags)

**What:** Headless `claude -p` with tools off, auth on, QueQue system+user prompts.
**When to use:** Every Claude-default fetch when `spawn('claude', …)` does not return ENOENT.

**Do use:**
```typescript
// Source: https://code.claude.com/docs/en/headless + local claude 2.1.206 --help
const args = [
  '-p',
  '--output-format', 'text',          // default; stdout IS the model text (candidate JSON)
  '--safe-mode',                      // skip CLAUDE.md/hooks/MCP; auth + Keychain still work
  '--tools', '',                      // disable all tools — no permission-prompt hang
  '--no-session-persistence',         // do not pollute ~/.claude sessions
  '--system-prompt', QUEQUE_SYSTEM,   // same string as SDK system prompt in claude.ts
  buildPrompt(envelope),              // argv prompt, not stdin
];
```

**Do not use:**
- `--bare` — official: never reads OAuth or system keychain; local help: “keychain reads” skipped; Anthropic auth becomes API key only. Breaks D-03 `/login` users.
- `--output-format json` — stdout is `{ type, result, session_id, … }`; `parseCandidates` would treat the envelope as invalid schema or swallow `.result` incorrectly.
- `--json-schema` in 08-02 — valid later hardening; data lives in `structured_output`, not the text body.
- `--max-turns 1` — documented on code.claude.com but **absent from `claude --help` on 2.1.206**. Unknown flags error on stderr *before* the run. Omit until a version check exists.
- Prompt on stdin / `stdio inherit` — print mode reads stdin; inherited TTY would hang Ink/Zellij or steal keystrokes.

### Pattern 2: Spawn without hanging the TUI

**What:** Isolated stdio + 25s SIGTERM + consume stdout/stderr so the pipe cannot block.
**When to use:** All `claude` child processes from the foreground client.

```typescript
// Source: https://nodejs.org/docs/latest-v22.x/api/child_process.html
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

await execFileAsync('claude', args, {
  encoding: 'utf8',
  timeout: remainingMs,          // shared budget, never a fresh 25s after a slow CLI
  killSignal: 'SIGTERM',         // Claude headless: SIGTERM exits 143, kills bash tree
  maxBuffer: 1024 * 1024,
  cwd: envelope.base.cwd,
  env: process.env,              // inherit so Keychain / exported ANTHROPIC_API_KEY work
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'], // stdin closed; do not inherit /dev/tty
});
```

`execFile` (no shell) matches git-context. Do not `shell: true`. Do not `detached: true` (need the result). `cwd` must be the shell request cwd, not QueQue's process cwd.

Ink already fetches concurrently while the spinner renders (`run-foreground.ts`). The child must not write to the pane PTY.

### Pattern 3: CLI-then-SDK rescue with a shared deadline

**What:** One composite adapter. Rescue is inside Claude only (D-09, D-12).
**When to use:** The 08-02 default path (no `provider.json` yet).

```
deadline = now + 25_000
try spawn claude -p with timeout = remaining
  success → parseCandidates(stdout) → return
  ENOENT  → CLI missing
  non-zero / timeout / spawn error → CLI failed
if CLI missing or CLI failed:
  if ANTHROPIC_API_KEY in env OR .env.local:
    SDK fetchCandidates with timeout = remaining (if remaining < ~1s, skip and throw timeout)
  else:
    throw setup error (D-13 copy)
```

**Auth vs other errors (discretion — recommended):** Rescue on **any** CLI failure when a key exists (matches D-09 literally), including logged-out CLI. Classify stderr/stdout **only to pick error copy** when there is no key:

| Signal | Treat as | User copy when no key |
|--------|----------|------------------------|
| `error.code === 'ENOENT'` | CLI missing | Install Claude Code, or set `ANTHROPIC_API_KEY` / `.env.local` |
| stdout/stderr matches `/not logged in|login expired|please run \/login|failed to authenticate|oauth (token|session)/i` | Auth miss | Prefer `claude /login`; alternative key |
| `error.killed` / `error.signal === 'SIGTERM'` | Timeout | Timed out; try again / `/login` |
| other non-zero | CLI error | Prefer `/login`; include short CLI message (no tokens) |

Official auth strings ([errors](https://code.claude.com/docs/en/errors)): `Not logged in · Please run /login`, `Login expired · Please run /login`, `Failed to authenticate: OAuth session expired and could not be refreshed`, `OAuth token revoked · Please run /login`. Failures inside the run are printed on **stdout** (not only stderr); match both streams. Exit code is non-zero but not unique — do not key off `1` vs `143` for auth.

**`.env.local` vs CLI env:** QueQue reads `.env.local`; Claude CLI does not. Do **not** inject `.env.local` keys into the child `env`. Logged-out CLI + key-only-in-`.env.local` is the rescue case D-09 exists for. Exported `ANTHROPIC_API_KEY` is inherited naturally; CLI may use it (still CLI-first per D-08).

**Timeout math:** If CLI burns 25s, do not start SDK (would exceed FIFO). If CLI auth-fails in ~1s, SDK gets the rest. Pass remaining ms into SDK `messages.create({ timeout })` — today `claude.ts` hardcodes `25_000`; add a parameter or compute inside the composite.

### Pattern 4: Reuse prompt/parse, do not conversational-parse

Export from `claude.ts` (currently private):

- `buildPrompt` — already calls `filterContextEnvelope` (Phase 6 defense-in-depth)
- `parseCandidates` — JSON array or fail-closed fallback (`echo ""` + unexpected-format explanation)
- `ensureSelectableCandidates` — `QQ_FORCE_SELECTOR` padding
- Shared `QUEQUE_SYSTEM` string — SDK `system` and CLI `--system-prompt` must stay identical

With `--output-format text`, stdout is the same text the SDK extracts from `content[].text`. Feed it to `parseCandidates` unchanged.

`--output-format json` is **not** a better flag for this contract: you would `JSON.parse` the envelope, then `parseCandidates(envelope.result)`. Extra failure modes, no quality gain.

### Pattern 5: `detectProvider()` — bypass, do not delete (D-10)

**Recommendation:** Bypass as selector. Keep the module for 08-01 tests, debug, and 08-03 pin work.

| Today | 08-02 |
|-------|--------|
| `run-foreground`: `detectProvider()` → early-return on `none` → `resolveAdapter` | Call `resolveAdapter` / `resolveClaudeDefaultAdapter()` always for llm mode |
| `anthropic-key` → SDK only | Violates D-08. Composite is CLI-first even when a key exists |
| `claude-cli` → throw “not wired yet” | Return composite (CLI adapter registered) |
| `ollama` / `openai-key` → throw “not wired yet” | Forbidden (D-11). Same Claude default; on failure D-13 copy — never “not wired yet” |
| `none` → FIFO error, skip fetch | Also try Claude default (detect can be wrong; D-10) |
| `claudeAuthPresent()` gates Step 2 | Must **not** gate spawn |

Do not call `detectProvider()` on the hot path: Step 3 still hits Ollama `localhost:11434` with a 300ms timeout, which is a waterfall probe D-01 rejected. Optional: log `{ path: 'claude-cli' | 'sdk-rescue' }` from the composite (replaces success criterion #6 “detected provider”).

08-01 review WR-01/WR-02: only if `detect.ts` is edited. Fetch does not need `which`; spawn ENOENT is the PATH check. Leave Windows `which` vs `where` unless the plan touches detection.

### Anti-Patterns to Avoid
- **`--bare` for “faster scripts”:** skips `/login` Keychain. Use `--safe-mode` instead.
- **`--output-format json` into `parseCandidates`:** envelope is not a candidate list.
- **Preflight `claudeAuthPresent()` before spawn:** D-10; darwin false positives are supposed to fail at call time.
- **Injecting a fake `claude` onto PATH in tests:** cerebrum Do-Not-Repeat. Mock `execFile`/`spawn`.
- **`stdio: inherit` or default stdin pipe left open:** Claude waits for stdin / writes over Ink.
- **Fresh 25s SDK after 25s CLI:** FIFO 30s overrun.
- **Vendor fallthrough** on Claude failure.
- **“not wired yet”** for ollama/openai-key in 08-02.
- **Logging `args`, `env`, or raw stderr that could contain tokens.** Log `{ path, exitCode, authFailure: boolean }` only.
- **Passing `temperature` on SDK rescue.**

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Candidate JSON parse | Conversational regex / NLP | Existing `parseCandidates` + `candidateListSchema` | Fail-closed already handles prose and bad JSON |
| Process timeout / kill | Custom `setTimeout` + `child.kill` loops | `execFile` `timeout` + `killSignal: 'SIGTERM'` | Node kills; Claude documents SIGTERM behavior |
| Keychain read | `security find-generic-password` | Call-time `claude -p` | 08-01 already rejected Keychain scraping |
| Prompt privacy | Ad-hoc redaction in CLI adapter | `buildPrompt` → `filterContextEnvelope` | Phase 6 contract |
| `.env.local` lookup | Duplicate parser | `readEnvValueFromDotEnvLocal` | Existing cache + find-up |
| FIFO error write | New shell protocol | `{ kind: 'error', message }` via `writeShellResult` | Phase 3 SAFE-01 |
| HTTP Agent SDK | New npm client for Claude Code | Subprocess `claude -p` | Locked 08-02 approach |

**Key insight:** The hard parts are TTY isolation, Keychain-preserving flags, and a shared FIFO budget — not a new parser or a new HTTP client.

## Common Pitfalls

### Pitfall 1: `--bare` drops `/login` users
**What goes wrong:** `claude -p --bare` never reads OAuth/Keychain; only `ANTHROPIC_API_KEY` / `apiKeyHelper`. Zero-config `/login` users get “not logged in” and 08-02 looks broken.
**Why it happens:** Docs recommend `--bare` for CI hermeticity.
**How to avoid:** `--safe-mode` (auth stays; customizations off) + `--tools ""`.
**Warning signs:** Tests pass with a key but fail for Keychain-only users.

### Pitfall 2: Stdin inherit hangs Ink / Zellij
**What goes wrong:** Print mode reads stdin (10MB cap). An open pipe without EOF or inherited `/dev/tty` waits forever until Node timeout — spinner frozen, pane corrupted if stdout is inherited.
**Why it happens:** Default stdio is pipe; Ink also uses `/dev/tty`.
**How to avoid:** `stdio: ['ignore','pipe','pipe']`. Pass prompt as argv. Never `inherit`.
**Warning signs:** FIFO hits 30s; pane fills with Claude TUI chrome.

### Pitfall 3: Tools/MCP permission prompt in `-p`
**What goes wrong:** Default `-p` still has Bash/Read/Edit; MCP from project `.mcp.json` can wait up to `MCP_TIMEOUT` (30s) — exactly the FIFO budget.
**Why it happens:** `-p` skips workspace trust dialogs but still loads project config unless `--safe-mode`.
**How to avoid:** `--safe-mode` and `--tools ""`.
**Warning signs:** Hang ~30s with no stdout.

### Pitfall 4: JSON output format is a wrapper
**What goes wrong:** `--output-format json` yields `{ result: "<text>", type, session_id, … }`. Feeding stdout to `parseCandidates` hits schema fallback (`echo ""`).
**Why it happens:** “JSON” sounds like the candidate contract.
**How to avoid:** Default `text`; parse stdout as the model body.
**Warning signs:** Every CLI success shows “unexpected response format”.

### Pitfall 5: Rescue exceeds FIFO
**What goes wrong:** CLI 25s + SDK 25s = 50s; zsh `read -t 30` already gave up.
**Why it happens:** Copying SDK timeout onto a second call.
**How to avoid:** Single 25s deadline from fetch start.
**Warning signs:** User sees widget timeout, then a late FIFO write.

### Pitfall 6: Logging secrets
**What goes wrong:** spawn `env` or argv `--system-prompt` dumped to `/tmp/qq-*-debug.log`.
**Why it happens:** Debug “log the CLI command”.
**How to avoid:** Log path kind only. `appendDebugLog` already redacts `queryText`/`lbuffer` keys — still never put `apiKey` in details.
**Warning signs:** debug log contains `sk-ant-` or OAuth tokens.

### Pitfall 7: Fake `claude` in tests
**What goes wrong:** Smoke tests inject a stub binary; missing-CLI/auth paths never run.
**Why it happens:** Desire for a green “integration” test.
**How to avoid:** `vi.mock('node:child_process')`. If CLI is absent in CI, skip live spawn; do not fake it.
**Warning signs:** Test PATH includes tmp dir with a `claude` script.

### Pitfall 8: Unknown CLI flags abort the run
**What goes wrong:** Invalid flag → stderr error, non-zero, **before** the model runs. Rescue may then fire even for a healthy `/login` user if a key exists (wrong backend), or hard-error if not.
**Why it happens:** Docs list `--max-turns`; 2.1.206 help does not.
**How to avoid:** Only flags present in local `--help` / verified docs for the pinned CLI generation: `-p`, `--output-format text`, `--safe-mode`, `--tools`, `--no-session-persistence`, `--system-prompt`.

### Pitfall 9: Early `none` return skips Claude
**What goes wrong:** `run-foreground.ts` writes detect's none message and returns without spawn. Linux user with CLI but no credentials file never reaches 08-02.
**Why it happens:** Prototype waterfall still in the client.
**How to avoid:** Bypass detect; always run the composite.

## Code Examples

Verified patterns from official sources:

### Headless print (text)
```bash
# Source: https://code.claude.com/docs/en/headless
claude -p "What does the auth module do?"
# exit 0 success; non-zero failure. Auth failures print on stdout.
```

### Structured JSON envelope (do not feed to parseCandidates)
```bash
# Source: https://code.claude.com/docs/en/headless
claude -p "Summarize this project" --output-format json
# jq -r '.result'  → model text
```

### Disable tools (local 2.1.206 help)
```bash
claude -p --tools "" --safe-mode --no-session-persistence --output-format text \
  --system-prompt "You are QueQue..." \
  "Return ONLY a JSON array..."
```

### Node timeout + SIGTERM
```javascript
// Source: https://nodejs.org/docs/latest-v22.x/api/child_process.html
execFile('claude', args, { timeout: remainingMs, killSignal: 'SIGTERM', stdio: ['ignore', 'pipe', 'pipe'] }, cb);
```

### FIFO error (existing — do not change protocol)
```typescript
await writeShellResult(resultFile, { kind: 'error', message: errorMsg });
```
Zsh: `IFS= read -r -t 30 result < "$fifo_path"` in `shell/zsh/qq.zsh`.

### Recommended error copy (D-13, discretion on wording)
```
QueQue: Claude is not authenticated. Run `claude /login`, or set ANTHROPIC_API_KEY in the environment or .env.local.
```
Do not mention Ollama/OpenAI. Do not say “not wired yet”.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ROADMAP: detect every backend, first available | CONTEXT D-01–D-05: pin + Claude silent default | 2026-08-25 discuss | 08-02 must not implement the ROADMAP waterfall selector |
| `detectProvider` → `resolveAdapter` (Phase 6) | Composite Claude default; detect is leftover | 08-02 | Client/resolver change |
| Credentials file = Claude CLI auth | macOS Keychain `/login`; presence-only in 08-01 | 08-01 | Call-time `claude -p` is the real auth check |
| `--bare` as default for `-p` (docs: future default) | Do not use `--bare` until QueQue has a pin/key path | 2026 docs | Keychain users depend on non-bare |
| Conversational CLI parse (ROADMAP 08-02 text) | `--output-format text` + existing JSON contract | 08-02 research | No new parser |

**Deprecated/outdated:**
- Resolver throws “subprocess adapter is not wired yet” — 08-02 deletes those throws.
- Client-result test “ollama not wired” — rewrite to Claude-default / D-13 error.
- ROADMAP success criteria #2–#3 (Ollama/OpenAI zero-config without a pin) — superseded by D-04/D-14; belong in 08-03 behind a pin, not silent detect.
- ROADMAP “detection under 200ms” as a fetch gate — still applies to leftover detect; fetch may take seconds. Do not probe `claude -p` inside `detectProvider`.

## Open Questions

1. **`--max-turns` support on 2.1.206**
   - What we know: Official CLI reference lists it; local `--help` does not.
   - What's unclear: Whether the binary accepts it anyway.
   - Recommendation: Omit. `--tools ""` already prevents agentic tool loops.

2. **Exact non-zero exit code for “Not logged in”**
   - What we know: Non-zero; message on stdout; SIGTERM is 143.
   - What's unclear: Whether auth is always `1`.
   - Recommendation: Classify by message substring, not exit code.

3. **`claude /login` vs `claude auth login`**
   - What we know: Errors say “Please run /login”. CLI reference also has `claude auth login`.
   - What's unclear: Which string converts more users.
   - Recommendation: Honor D-13 (`claude /login`). Optional second line `claude auth login` is 08-03 copy polish, not required.

4. **SDK timeout parameter**
   - What we know: `messages.create` already accepts `timeout: 25_000`.
   - What's unclear: Smallest useful remaining budget (recommend ≥ 1000ms or skip SDK).
   - Recommendation: Composite owns the deadline; pass remaining into SDK.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | CLI + tests | ✓ | v26.3.0 (host); `.nvmrc` 24.14.1 | — |
| pnpm | test/build | ✓ | 11.8.0 | — |
| vitest | unit tests | ✓ | 4.0.4 | — |
| Claude Code CLI (`claude`) | Live `/login` path | ✓ on research host | 2.1.206 | CI/tests: mock `execFile`; do not fake binary |
| `ANTHROPIC_API_KEY` / `.env.local` | SDK rescue | optional | — | D-13 `/login` error |
| Ollama / OpenAI CLI | 08-02 | n/a | — | Out of scope (D-06) |

**Missing dependencies with no fallback:** none for planning/unit tests.

**Missing dependencies with fallback:** Claude CLI absent in CI — mock spawn; ENOENT branch must be tested without installing Claude.

**Step 2.6:** Audited. 08-02 is code + mocked-process tests; live `claude -p` is manual UAT only.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm test:run -- tests/claude-cli-provider.test.ts tests/provider-resolver.test.ts tests/registry-bootstrap.test.ts` |
| Full suite command | `pnpm test:run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RUN-01 | CLI+SDK combined timeout ≤ 25s; SIGTERM on overrun | unit | `pnpm test:run -- tests/claude-cli-provider.test.ts` | ❌ Wave 0 |
| RUN-01 | FIFO `{kind:'error'}` on Claude setup miss; buffer unchanged | unit | `pnpm test:run -- tests/client-result.test.ts tests/zsh-widget.test.ts` | ✅ (update client-result) |
| EXT-01 | `claude-cli` registered beside `claude` in bootstrap | unit | `pnpm test:run -- tests/registry-bootstrap.test.ts` | ✅ (extend) |
| EXT-01 | `resolveAdapter` returns fetchable adapter for `claude-cli`; no “not wired yet” | unit | `pnpm test:run -- tests/provider-resolver.test.ts` | ✅ (rewrite throws) |
| D-08 | PATH/spawn CLI before SDK even when key set | unit | `pnpm test:run -- tests/claude-cli-provider.test.ts` | ❌ Wave 0 |
| D-09 | Logged-out CLI + `.env.local` key → SDK rescue | unit | `pnpm test:run -- tests/claude-cli-provider.test.ts` | ❌ Wave 0 |
| D-09 | CLI ENOENT + key → SDK; ENOENT + no key → D-13 error | unit | `pnpm test:run -- tests/claude-cli-provider.test.ts` | ❌ Wave 0 |
| D-10 | Fetch does not call `claudeAuthPresent()` | unit | `pnpm test:run -- tests/claude-cli-provider.test.ts` | ❌ Wave 0 |
| D-11 | `ollama` / `openai-key` kinds do not throw “not wired yet” | unit | `pnpm test:run -- tests/provider-resolver.test.ts tests/client-result.test.ts` | ✅ (rewrite) |
| D-12 | No OpenAI/Ollama adapter calls on Claude failure | unit | `pnpm test:run -- tests/claude-cli-provider.test.ts` | ❌ Wave 0 |
| D-13 | Error message mentions `claude /login` and `ANTHROPIC_API_KEY` | unit | `pnpm test:run -- tests/claude-cli-provider.test.ts` | ❌ Wave 0 |
| CMD-01/02 | CLI stdout JSON array parsed via `parseCandidates` | unit | `pnpm test:run -- tests/claude-cli-provider.test.ts tests/claude-provider.test.ts` | ⚠️ parse already tested in claude-provider; CLI wiring Wave 0 |
| SAFE-01 / PRV | `buildPrompt` used (privacy filter); spawn args omit tokens | unit | `pnpm test:run -- tests/claude-cli-provider.test.ts tests/claude-provider.test.ts` | ⚠️ extend CLI tests |
| — | Spawn uses stdin ignore; no `inherit` | unit | `pnpm test:run -- tests/claude-cli-provider.test.ts` | ❌ Wave 0 |
| — | `--bare` not in argv; `--safe-mode` and `--tools` are | unit | `pnpm test:run -- tests/claude-cli-provider.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test:run -- tests/claude-cli-provider.test.ts tests/provider-resolver.test.ts tests/registry-bootstrap.test.ts`
- **Per wave merge:** `pnpm test:run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/claude-cli-provider.test.ts` — mock `execFile`/`spawn`; argv contract; stdin ignore; timeout remaining; auth-fail rescue; ENOENT rescue; D-13 copy; no fake binary
- [ ] `tests/provider-resolver.test.ts` — replace “not wired yet” expectations; `claude-cli` returns adapter; ollama/openai-key → Claude default
- [ ] `tests/client-result.test.ts` — replace ollama-not-wired case; none/claude-cli paths write error or candidates via composite
- [ ] `tests/registry-bootstrap.test.ts` — assert `claude-cli` backend id
- [ ] Export `buildPrompt` / `parseCandidates` (or move to `claude-prompt.ts`) so CLI tests can assert prompt privacy without duplicating filter logic
- [ ] Framework install: none — vitest already configured

Manual-only (do not block Wave 0): live `??` with Keychain `/login` and no `ANTHROPIC_API_KEY`; live logged-out CLI with `.env.local` key (rescue); Zellij pane does not show Claude TUI chrome.

## 08-01 historical (completed) — Keychain detection

**Status:** Shipped 2026-07-31 (`claudeAuthPresent()` in `src/providers/detect.ts`). Do not re-plan. Do not use as 08-02 fetch gate (D-10).

### Claude Code auth storage (platform table)

| Platform | Where `/login` stores credentials | Detectable via file stat? |
|----------|-----------------------------------|---------------------------|
| macOS | Encrypted macOS Keychain | No |
| Linux | `~/.claude/.credentials.json` (mode `0600`) | Yes |
| Windows | `%USERPROFILE%\.claude\.credentials.json` | Yes |

Source: [Claude Code authentication docs](https://code.claude.com/docs/en/authentication).

Additional env-based auth (any platform):

| Variable | Origin | Notes |
|----------|--------|-------|
| `CLAUDE_CODE_OAUTH_TOKEN` | `claude setup-token` | Long-lived OAuth; subscription-backed |
| `ANTHROPIC_AUTH_TOKEN` | Gateway / bearer setups | Sent as `Authorization: Bearer` |
| `ANTHROPIC_API_KEY` | Claude Console | SDK rescue / Step 1 leftover detect |

**08-01 strategy (still valid for leftover detect):** no Keychain read; no `claude -p` probe (200ms budget); darwin + `claude` on PATH ⇒ presence; false positives fail at 08-02 call time.

**08-01 review leftovers (optional if touching `detect.ts`):** WR-01 host env tokens masking file tests; WR-02 `which` vs Windows `where`. Not required to ship 08-02 fetch.

## 08-03 preview (do not implement in 08-02)

- Write `~/.config/qq/provider.json` (sibling of `config.json`).
- Register OpenAI + Ollama adapters for pinned kinds only.
- Picker on `/dev/tty` or `qq init provider` — never `qq init zsh`.
- Schema (discretion): start with `{ "provider": "openai" | "ollama" | "claude" }`; add `baseUrl`/`model` only if Ollama needs it.

## Sources

### Primary (HIGH confidence)
- [Claude Code headless](https://code.claude.com/docs/en/headless) — `-p` exit codes, stdin, `--output-format`, `--bare` Keychain skip, SIGTERM 143
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference) — flags including `--tools`, `--safe-mode`, `--no-session-persistence`, `--system-prompt`, `--json-schema`
- [Claude Code authentication](https://code.claude.com/docs/en/authentication) — `/login`, Keychain, `ANTHROPIC_API_KEY` skip-login, `claude auth login`
- [Claude Code errors](https://code.claude.com/docs/en/errors) — `Not logged in · Please run /login` and OAuth refresh failures
- Local `claude --help` / `claude --version` **2.1.206** (2026-08-25) — `--bare` keychain wording; `--tools ""`; `--max-turns` missing from help
- [Node.js child_process](https://nodejs.org/docs/latest-v22.x/api/child_process.html) — `timeout`, `killSignal`, `stdio`, `signal`
- Context7 `/websites/code_claude` — print-mode, auth errors
- Context7 `/websites/nodejs_latest-v22_x_api` — spawn abort/timeout
- In-repo: `src/providers/claude.ts`, `detect.ts`, `resolver.ts`, `run-foreground.ts`, `shell/zsh/qq.zsh` FIFO `read -t 30`

### Secondary (MEDIUM confidence)
- ROADMAP Phase 8 plan text (waterfall / conversational parse) — superseded by CONTEXT.md where they conflict

### Tertiary (LOW confidence)
- Third-party blogs on `--output-format json` CI usage — verified against official headless page before citing JSON envelope shape

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; versions from package.json + local CLI
- Architecture: HIGH — flags verified against official docs and `claude --help` 2.1.206; existing adapter/FIFO patterns mapped
- Pitfalls: HIGH — `--bare`, stdin, FIFO budget, JSON wrapper are documented failure modes

**Research date:** 2026-08-25
**Valid until:** 2026-09-25 (Claude Code CLI flags move quickly; re-check `--help` if targeting a CLI much newer than 2.1.206)
