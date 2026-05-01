# Phase 1: Shell Bridge and Result Contract - Research

**Researched:** 2026-05-01
**Domain:** `zsh` ZLE integration, shell/TTY handoff, Node foreground client + Unix-socket daemon
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

No phase-specific `CONTEXT.md` exists for Phase 1.

### Locked Decisions
None provided in `CONTEXT.md`.

### Claude's Discretion
None provided in `CONTEXT.md`.

### Deferred Ideas (OUT OF SCOPE)
None provided in `CONTEXT.md`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHL-01 | Trigger Que-Que from literal `??` while editing a `zsh` command line | Use a custom `?` ZLE widget with look-behind on `LBUFFER`; do not bind `??` directly. |
| SHL-02 | Capture text already typed before the trigger | Treat `LBUFFER` without the consumed trigger `?` as canonical pre-trigger context; pass `lbuffer`/`rbuffer` separately. |
| SHL-03 | Dismiss with `Esc` and return with no buffer changes | Run the foreground client on `/dev/tty`; return a structured `cancel` result that leaves `LBUFFER`/`RBUFFER` untouched. |
| SHL-04 | Write a chosen command back into the live shell buffer with correct cursor position | Use a shell result contract that returns replacement `lbuffer` and `rbuffer`, not a raw numeric cursor offset. |
| RUN-01 | Keep repeat invocations fast with a background daemon | Use a detached Node daemon over a Unix socket with client-side auto-bootstrap and stale-socket cleanup. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Read `.wolf/OPENWOLF.md` every session.
- Check `.wolf/anatomy.md` before reading project files.
- Check `.wolf/cerebrum.md` before generating code.
- Start file-changing work through a GSD workflow unless the user explicitly bypasses it.
- Optimize for a usable daily-driver product in 2 weeks.
- Use TypeScript on Node LTS.
- Keep the MVP tooling baseline on `pnpm`, `tsup`, `vitest`, `zod`, `cac`, `ink`, and `@anthropic-ai/sdk`.
- Shell integration must be real `zsh` ZLE integration, not a standalone prompt-taker.
- v1 must return commands to the shell buffer and never auto-execute them.

## Summary

Phase 1 should lock down three seams and avoid solving anything else yet: the ZLE trigger widget, a UI-neutral shell result contract, and the warm daemon bootstrap path. The correct `zsh` trigger pattern is not a `bindkey '??'` sequence. Because `?` is already bound, binding both `?` and `??` would make single `?` subject to `KEYTIMEOUT`; every literal `?` would feel delayed. The stable pattern is to bind `?` to a custom widget, call `.self-insert` for the first `?`, and on the second `?` detect the trailing `?` in `LBUFFER`, consume it, and launch Que-Que.

The most important shell/TUI fact is that ZLE widget functions run with stdin redirected from `/dev/null`. A foreground Ink client launched naively from the widget will not receive keyboard input. The widget must therefore spawn the client with `</dev/tty >/dev/tty 2>&1`, while result transport happens out-of-band. For the shell mutation contract, do not send back `buffer + cursor` as the canonical result. `zsh` cursor positions are character-oriented while Node string indexes are UTF-16 code-unit-oriented. Returning `{lbuffer, rbuffer}` avoids cross-runtime cursor math and lets the shell restore the cursor by assigning `LBUFFER` and `RBUFFER`.

The daemon should be a detached Node process reachable over a short Unix-socket path such as `/tmp/qq-$UID.sock`. Do not place the socket under macOS `TMPDIR`; the path is usually too long and Node documents a 103-byte macOS Unix-socket limit. The daemon must never own the TTY. Ink can coexist with this model later if it stays isolated to the foreground client, uses UI-neutral request/response schemas, and does not become part of the shell bridge contract.

**Primary recommendation:** Build Phase 1 around a `?` ZLE widget, `/dev/tty` foreground client reattachment, split-buffer result schema, and a detached `/tmp/qq-$UID.sock` daemon.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | `24.14.1` latest LTS on 2026-05-01 | Runtime for CLI, client, and daemon | Matches project constraint to use Node LTS; official downloads page lists `v24.14.1` as latest LTS. |
| TypeScript | `6.0.3` published 2026-04-16 | Shared types across shell contract, IPC, and daemon | Best fit for typed contracts and fast CLI development. |
| `zod` | `4.1.5` published 2026-04-21 | Runtime validation for shell and IPC payloads | Shell buffer mutation should fail closed on malformed data. |
| `cac` | `7.0.0` published 2026-02-27 | Single binary with `client` and `daemon` subcommands | Small, current CLI parser with no framework drag. |
| `ink` | `7.0.1` published 2026-04-17 | Foreground TUI layer | Official docs support custom `stdin`/`stdout`, `useInput`, and explicit raw-mode control. |
| React | `19.2.5` published 2026-04-08 | Required runtime for Ink | Necessary dependency for Ink; keep it only in the foreground client. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsup` | `8.5.1` published 2025-11-12 | Fast bundle/build for one CLI package | Use for `dist/qq` builds and local packaging. |
| `vitest` | `4.0.4` published 2025-10-27 | Contract and bootstrap tests | Use for shell payload schemas, daemon bootstrap, and client result parsing. |
| `ink-select-input` | `6.2.0` published 2025-04-29 | Fast list prototype | Use only in later TUI phases if it does not fight raw-key behavior. |
| `ink-text-input` | `6.0.0` published 2024-05-14 | Fast text-input prototype | Use later for clarification UI, not for shell bridge semantics. |
| `@anthropic-ai/sdk` | `0.92.0` published 2026-04-30 | Future provider integration | Not needed in Phase 1 execution, but safe to scaffold now per project constraints. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom `?` widget with look-behind | Direct `bindkey '??'` trigger | Rejected because single `?` becomes subject to `KEYTIMEOUT` and feels laggy. |
| `{lbuffer, rbuffer}` result contract | `{buffer, cursor}` result contract | Rejected because zsh and Node index strings differently for non-ASCII text. |
| `/tmp/qq-$UID.sock` | Socket under macOS `TMPDIR` | Rejected because Node documents a 103-byte macOS path limit and `TMPDIR` is often too long. |

**Installation:**
```bash
pnpm add react zod cac ink ink-select-input ink-text-input @anthropic-ai/sdk
pnpm add -D typescript tsup vitest @types/node
```

**Version verification:** Verified on 2026-05-01 with `npm view <package> version time` and Node’s official downloads page.

## Architecture Patterns

### Recommended Project Structure
```text
shell/
└── zsh/
    └── qq.zsh              # ZLE widget and shell-side bridge
src/
├── cli/
│   ├── main.ts             # cac entrypoint
│   └── commands/
│       ├── client.ts       # foreground TTY client
│       └── daemon.ts       # detached daemon bootstrap
├── contracts/
│   ├── shell.ts            # shell request/result zod schemas
│   └── ipc.ts              # daemon request/result zod schemas
├── daemon/
│   ├── server.ts           # Unix-socket server
│   └── bootstrap.ts        # spawn/check/retry logic
├── client/
│   ├── run-foreground.ts   # TTY-attached loop
│   └── result-writer.ts    # out-of-band shell result emission
└── shared/
    ├── socket-path.ts      # short macOS-safe socket path helper
    └── protocol.ts         # JSON framing helpers
tests/
├── shell-contract.test.ts
├── daemon-bootstrap.test.ts
└── client-result.test.ts
```

### Pattern 1: Consume `??` inside a `?` widget
**What:** Replace the `?` key binding with a user-defined ZLE widget that inspects `LBUFFER`.
**When to use:** Always for Phase 1 on `zsh`.
**Example:**
```zsh
# Source: zsh ZLE docs for user-defined widgets, .self-insert, LBUFFER/RBUFFER
qq-question-widget() {
  if [[ $LBUFFER == *\? ]]; then
    local pre_trigger=${LBUFFER[1,-2]}
    local original_lbuffer=$LBUFFER
    local original_rbuffer=$RBUFFER

    LBUFFER=$pre_trigger
    if qq client --request-file "$req" --response-file "$res" </dev/tty >/dev/tty 2>&1; then
      # apply parsed result here
      :
    else
      LBUFFER=$pre_trigger
      RBUFFER=$original_rbuffer
    fi
    return
  fi

  zle .self-insert
}
zle -N qq-question-widget
bindkey -M emacs '?' qq-question-widget
bindkey -M viins '?' qq-question-widget
```

### Pattern 2: Keep shell mutation UI-neutral
**What:** The shell request/result schema is independent of Ink and the daemon.
**When to use:** Immediately in Phase 1.
**Example:**
```ts
// Source: project recommendation based on zsh LBUFFER/RBUFFER semantics
export type ShellRequest = {
  version: 1;
  trigger: '??';
  shell: 'zsh';
  cwd: string;
  tty: string;
  pid: number;
  lbuffer: string;
  rbuffer: string;
};

export type ShellResult =
  | {kind: 'cancel'}
  | {kind: 'replace-buffer'; lbuffer: string; rbuffer: string}
  | {kind: 'error'; message: string};
```

### Pattern 3: Bootstrap daemon from the client, not from zsh
**What:** The shell widget launches one foreground client command. The client checks the socket, starts the daemon if missing, retries, then continues.
**When to use:** Always; keep zsh small and dumb.
**Example:**
```ts
// Source: Node net IPC docs + child_process detached stdio docs
const socketPath = `/tmp/qq-${process.getuid?.() ?? 'user'}.sock`;

try {
  await connect(socketPath);
} catch {
  const child = spawn(process.execPath, [cliPath, 'daemon', '--socket', socketPath], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  await retryConnect(socketPath);
}
```

### Anti-Patterns to Avoid
- **Binding `??` directly:** It will make single `?` depend on `KEYTIMEOUT`.
- **Letting the daemon own stdin/stdout:** The daemon should never touch the controlling TTY.
- **Returning a numeric cursor as the only truth:** It creates avoidable Unicode/index mismatch bugs.
- **Using macOS `TMPDIR` for the socket path:** The path can exceed the documented macOS limit.
- **Letting Ink define the shell contract:** Ink is a replaceable UI layer, not a protocol boundary.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Runtime payload validation | Ad-hoc `JSON.parse` checks | `zod` schemas for shell and IPC contracts | Shell mutation is too sensitive for best-effort parsing. |
| Terminal key decoding in the TUI | Manual ANSI parser | Ink `useInput` / `useStdin` | Ink already exposes `escape`, arrows, enter, and raw-mode helpers. |
| Long-lived daemon transport | Custom polling/temp-loop protocol | One-request-per-connection JSON over `node:net` Unix socket | Node has first-class IPC path support and simple framing is enough here. |
| Background process management | Shell-only job control tricks | Node `spawn(..., {detached: true, stdio: 'ignore'})` + `unref()` | Official behavior is documented and avoids TTY attachment mistakes. |

**Key insight:** Hand-rolling terminal state and cursor math is the fastest way to make Phase 1 flaky. Hand-roll only the ZLE widget and the narrow shell contract.

## Common Pitfalls

### Pitfall 1: ZLE widget launches a TUI with no input
**What goes wrong:** The client opens but cannot read keys.
**Why it happens:** ZLE redirects widget stdin from `/dev/null`.
**How to avoid:** Spawn the client with `</dev/tty >/dev/tty 2>&1`; keep result transport separate.
**Warning signs:** `Esc` and arrows do nothing, Ink appears frozen, or `process.stdin.isTTY` is false.

### Pitfall 2: Single `?` becomes laggy
**What goes wrong:** Typing a literal `?` pauses before it appears.
**Why it happens:** `?` is a bound prefix of a longer `??` key binding, so ZLE waits for `KEYTIMEOUT`.
**How to avoid:** Bind only `?` and detect the second `?` by inspecting `LBUFFER`.
**Warning signs:** Roughly 400ms delay on every standalone `?`.

### Pitfall 3: Cancel mutates the shell buffer
**What goes wrong:** Cancel leaves a stray `?`, clears text, or moves the cursor.
**Why it happens:** The widget mutates `LBUFFER` before saving originals, or treats cancel as a partial replacement.
**How to avoid:** Save original `LBUFFER`/`RBUFFER` before launch; only apply replacement on explicit `replace-buffer`.
**Warning signs:** `Esc` returns to a different line than the pre-trigger state.

### Pitfall 4: Daemon socket appears busy forever
**What goes wrong:** Client cannot start or reconnect after a crash.
**Why it happens:** Stale filesystem socket left behind after abnormal exit.
**How to avoid:** On bootstrap, attempt a connect; if it fails and the socket path exists, unlink and re-listen.
**Warning signs:** `EADDRINUSE` on startup with no live daemon process.

### Pitfall 5: Cursor lands in the wrong place with non-ASCII text
**What goes wrong:** Accepted commands place the cursor off by one or more characters.
**Why it happens:** Node and zsh count string positions differently.
**How to avoid:** Return split buffers, not raw cursor offsets.
**Warning signs:** Repro only on emoji, accented characters, or pasted Unicode.

## Code Examples

Verified patterns from official sources:

### Ink input handling and cancel path
```tsx
// Source: Context7 /vadimdemedes/ink readme
import {useApp, useInput} from 'ink';

function App() {
  const {exit} = useApp();

  useInput((_input, key) => {
    if (key.escape) {
      // write {kind: 'cancel'} to the response transport first
      exit();
    }
  });

  return null;
}
```

### Node Unix-socket server
```ts
// Source: Node net docs
import net from 'node:net';

const server = net.createServer(socket => {
  socket.once('data', data => {
    const request = JSON.parse(String(data));
    socket.end(JSON.stringify(handle(request)) + '\n');
  });
});

server.listen('/tmp/qq-501.sock');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Standalone CLI that takes over the prompt | Shell-native ZLE trigger + return-to-buffer flow | Current product direction | Keeps the terminal editing session intact. |
| Per-invocation cold process for all work | Warm daemon behind a thin foreground client | Current CLI assistant pattern | Makes repeated invocations fast and keeps provider state warm. |
| Full buffer + numeric cursor contract | Split-buffer contract (`lbuffer`/`rbuffer`) | Recommended for this phase | Avoids cross-runtime cursor index bugs. |

**Deprecated/outdated:**
- Binding `??` as a literal multi-key sequence in ZLE for this UX: outdated for this use case because it degrades standalone `?` typing.

## Open Questions

1. **Should v1 support inserting a literal `??` without quoted-insert?**
   - What we know: the requested product behavior treats `??` as a reserved trigger.
   - What's unclear: whether early users need an escape hatch for commands that legitimately contain `??`.
   - Recommendation: keep `??` reserved in Phase 1 and document `quoted-insert`/`Ctrl-V ?` as the escape hatch; do not expand scope now.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `zsh` | ZLE widget and shell smoke tests | ✓ | `5.9` | — |
| `node` | CLI, client, daemon, tests | ✓ | `25.8.1` | Pin project to Node LTS before implementation |
| `pnpm` | Package install and scripts | ✓ | `10.33.0` | `npm` is available, but `pnpm` is the locked project tool |
| `npm` | Version verification and registry access | ✓ | `11.11.0` | — |

**Missing dependencies with no fallback:**
- None for Phase 1 research.

**Missing dependencies with fallback:**
- Node LTS is not the locally active runtime. Local `node` is `25.8.1` on 2026-05-01, while Node’s official downloads page lists `24.14.1` as latest LTS. Planner should add an `.nvmrc` or equivalent pin before implementation.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `vitest` `4.0.4` |
| Config file | none - Wave 0 |
| Quick run command | `pnpm vitest run tests/shell-contract.test.ts -x` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHL-01 | `?` widget consumes literal `??` without delaying single `?` | integration | `pnpm vitest run tests/zsh-widget.test.ts -x` | ❌ Wave 0 |
| SHL-02 | pre-trigger text is serialized correctly from `LBUFFER`/`RBUFFER` | unit | `pnpm vitest run tests/shell-contract.test.ts -x` | ❌ Wave 0 |
| SHL-03 | cancel returns original buffer unchanged | unit | `pnpm vitest run tests/client-result.test.ts -x` | ❌ Wave 0 |
| SHL-04 | accepted result writes replacement split buffers correctly | unit | `pnpm vitest run tests/client-result.test.ts -x` | ❌ Wave 0 |
| RUN-01 | client auto-starts and reconnects to daemon | integration | `pnpm vitest run tests/daemon-bootstrap.test.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run tests/shell-contract.test.ts -x`
- **Per wave merge:** `pnpm vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `package.json` with `vitest`, `tsup`, `typescript`, and `pnpm` scripts
- [ ] `vitest.config.ts`
- [ ] `tests/shell-contract.test.ts` - covers SHL-02 and SHL-04
- [ ] `tests/client-result.test.ts` - covers SHL-03 and SHL-04
- [ ] `tests/daemon-bootstrap.test.ts` - covers RUN-01
- [ ] `tests/zsh-widget.test.ts` or equivalent spawned-`zsh` smoke harness - covers SHL-01

## Sources

### Primary (HIGH confidence)
- Context7 `/vadimdemedes/ink` - `useInput`, `useStdin`, render options, raw-mode guidance
- zsh manual: https://zsh.sourceforge.io/Doc/Release/Zsh-Line-Editor.html - keymaps, `KEYTIMEOUT`, user-defined widgets, `.self-insert`, `LBUFFER`, `RBUFFER`, `CURSOR`
- Node TTY docs: https://nodejs.org/download/release/v24.1.0/docs/api/tty.html - `isTTY`, `setRawMode`, raw-mode behavior
- Node net docs: https://nodejs.org/download/release/latest-v20.x/docs/api/net.html - Unix-socket IPC support and macOS path-length limit
- Node child_process docs: https://r2.nodejs.org/docs/v20.19.2/api/child_process.html - detached processes and `stdio` behavior
- Node releases: https://nodejs.org/en/download/current and https://nodejs.org/en/about/previous-releases - current vs LTS status on 2026-05-01

### Secondary (MEDIUM confidence)
- npm registry metadata verified locally with `npm view <package> version time --json` for `typescript`, `zod`, `cac`, `tsup`, `vitest`, `react`, `ink`, `ink-select-input`, `ink-text-input`, and `@anthropic-ai/sdk`

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions verified against npm and Node official pages on 2026-05-01
- Architecture: HIGH - based on official zsh and Node runtime behavior
- Pitfalls: MEDIUM - shell/TTY issues are documented; Ink coexistence guidance includes some informed inference

**Research date:** 2026-05-01
**Valid until:** 2026-05-31
