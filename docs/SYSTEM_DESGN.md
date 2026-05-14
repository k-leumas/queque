# System Design

This document describes how Que-Que is structured today, how the major pieces interact, and where the current implementation stops versus the intended end-state.

## Purpose

Que-Que is a `zsh`-integrated command helper. The intended user flow is:

1. The user types `??` inside an active shell buffer.
2. A `zsh` widget captures the shell context around the cursor.
3. The foreground `qq client` starts, ensures a background daemon exists, and runs an interactive selection flow.
4. The selected command is written back as a structured result.
5. The shell widget applies that result to `LBUFFER` and `RBUFFER` instead of executing anything directly.

Today, steps 1, 2, 4, and 5 are implemented with a deterministic seam. The interactive TUI and most daemon-side query orchestration are still placeholders.

## Main Pieces

```mermaid
flowchart LR
    U[User in zsh]
    Z[ZLE widget\nshell/zsh/qq.zsh]
    C[Foreground client\nsrc/client/*]
    CLI[CLI entrypoint\nsrc/cli/*]
    D[Daemon process\nsrc/daemon/*]
    CT[Contracts\nsrc/contracts/*]
    SH[Socket path helper\nsrc/shared/socket-path.ts]
    TMP["/tmp request/result files"]
    SOCK["/tmp/qq-UID.sock"]

    U --> Z
    Z --> TMP
    Z --> CLI
    CLI --> C
    CLI --> D
    C --> CT
    D --> CT
    C --> SH
    D --> SH
    C --> SOCK
    D --> SOCK
    C --> TMP
    Z --> TMP
```

### Annotations

- `shell/zsh/qq.zsh` is the shell-facing boundary. It owns keyboard binding, buffer capture, temp-file exchange, and buffer mutation.
- `src/cli/main.ts` is the process entrypoint and only routes commands to `client` or `daemon`.
- `src/client/run-foreground.ts` is the foreground control loop. It validates input, checks `/dev/tty`, ensures the daemon exists, and writes the final shell result.
- `src/daemon/server.ts` hosts a Unix-socket server for newline-delimited JSON IPC.
- `src/daemon/bootstrap.ts` is responsible for daemon discovery and detached startup.
- `src/contracts/shell.ts` and `src/contracts/ipc.ts` define the stable message boundaries.
- `src/shared/socket-path.ts` centralizes socket naming to avoid path drift between caller and server.

## End-To-End Interaction

```mermaid
sequenceDiagram
    participant User
    participant Zsh as zsh widget
    participant Client as qq client
    participant Bootstrap as daemon bootstrap
    participant Daemon as qq daemon
    participant Files as temp files

    User->>Zsh: Type `??`
    Zsh->>Zsh: Detect second `?`
    Zsh->>Zsh: Capture LBUFFER/RBUFFER
    Zsh->>Files: Write shell request JSON
    Zsh->>Client: Run `qq client --request-file --result-file`
    Client->>Client: Open `/dev/tty`
    Client->>Files: Read and validate request
    Client->>Bootstrap: ensureDaemon(/tmp/qq-UID.sock)
    Bootstrap->>Daemon: Connect or spawn detached daemon
    Daemon-->>Bootstrap: Socket becomes reachable
    Bootstrap-->>Client: Daemon ready
    Client->>Files: Write shell result JSON atomically
    Client-->>Zsh: Exit
    Zsh->>Files: Read result JSON
    Zsh->>Zsh: Apply cancel or replace-buffer
    Zsh-->>User: Updated shell buffer
```

### Interaction notes

- The shell and client communicate through temp files, not pipes. That keeps the contract simple and lets the shell apply the result after the client exits.
- The client and daemon communicate through a Unix socket in `/tmp`, which avoids macOS socket path length problems from long `TMPDIR` values.
- The client explicitly opens `/dev/tty` because ZLE widgets run with redirected stdin, which would break future interactive TUI input.

## Component Responsibilities

### 1. Shell Integration

File: [shell/zsh/qq.zsh](/Users/samuel/dev/tui-llm/shell/zsh/qq.zsh)

Responsibilities:

- Bind `?` in `emacs` and `viins` keymaps.
- Detect `??` without relying on `KEYTIMEOUT`.
- Capture split-buffer shell state as `lbuffer` and `rbuffer`.
- Serialize a shell request JSON file.
- Launch `qq client` attached to `/dev/tty`.
- Apply a `cancel` result by restoring original buffers.
- Apply a `replace-buffer` result by overwriting `LBUFFER` and `RBUFFER`.

Design reasons:

- Split buffers avoid cross-runtime cursor math bugs between Node string indexing and `zsh` buffer semantics.
- `jq -Rs` is used to escape shell-derived values safely during JSON generation.
- Result application treats malformed output as cancel-safe behavior.

### 2. CLI Layer

Files:

- [src/cli/main.ts](/Users/samuel/dev/tui-llm/src/cli/main.ts)
- [src/cli/commands/client.ts](/Users/samuel/dev/tui-llm/src/cli/commands/client.ts)
- [src/cli/commands/daemon.ts](/Users/samuel/dev/tui-llm/src/cli/commands/daemon.ts)

Responsibilities:

- Parse command-line options with `cac`.
- Enforce required arguments for `qq client`.
- Route to the foreground client or daemon control path.
- Keep process wiring separate from business logic.

Design reasons:

- The command handlers are intentionally thin so the foreground client and daemon can evolve independently from CLI argument parsing.

### 3. Foreground Client

Files:

- [src/client/run-foreground.ts](/Users/samuel/dev/tui-llm/src/client/run-foreground.ts)
- [src/client/result-writer.ts](/Users/samuel/dev/tui-llm/src/client/result-writer.ts)

Responsibilities:

- Read the serialized shell request.
- Validate request shape with Zod.
- Ensure the daemon is running before interactive work begins.
- Produce a shell result and write it atomically.

Current state:

- The client currently supports deterministic result modes `cancel`, `replace-buffer-fixture`, and `llm`.
- The `llm` mode asks Claude for a strict JSON command suggestion and maps it to a `replace-buffer` shell result.
- When the current directory is inside git, the prompt includes the repo root, branch, and dirty state as extra context.
- This is still a Phase 1 seam in place of the future interactive TUI.

Design reasons:

- Atomic `write -> rename` prevents the shell from observing partial JSON.
- The client remains free of Ink and React imports today, so UI can be added later without changing the shell contract.

### 4. Daemon

Files:

- [src/daemon/bootstrap.ts](/Users/samuel/dev/tui-llm/src/daemon/bootstrap.ts)
- [src/daemon/server.ts](/Users/samuel/dev/tui-llm/src/daemon/server.ts)

Responsibilities:

- Own the long-lived background process.
- Listen on a Unix socket.
- Accept newline-delimited JSON IPC requests.
- Support bootstrap behaviors such as connect-if-running, unlink stale socket, detached spawn, and readiness polling.

Current supported IPC messages:

- `ping` -> `pong`
- `ensure-session` -> `session-ready`
- `run-query` -> `query-accepted`

Current limitations:

- `run-query` only acknowledges receipt; it does not orchestrate a real query flow yet.
- Stale-socket cleanup has a documented race window if multiple callers try to ensure the daemon concurrently.

## Contracts

```mermaid
classDiagram
    class ShellRequest {
      +version: 1
      +ttyPath: string
      +cwd: string
      +shellPid: number
      +lbuffer: string
      +rbuffer: string
    }

    class ShellResult {
      <<union>>
      cancel
      replace-buffer
    }

    class IpcRequest {
      <<union>>
      ping
      ensure-session
      run-query
    }

    class IpcResponse {
      <<union>>
      pong
      session-ready
      query-accepted
    }
```

### Contract notes

- `ShellRequest` captures shell state at trigger time and is the boundary between `zsh` and Node.
- `ShellResult` intentionally avoids `{buffer, cursor}` to prevent Unicode cursor-position mismatch bugs.
- IPC contracts are separate from shell contracts because the daemon should not depend on shell temp-file mechanics.

## Runtime Paths

```mermaid
flowchart TD
    A[Current user UID] --> B[/tmp/qq-UID.sock]
    C[zsh widget] --> D[/tmp/qq-req-XXXXXX.json]
    C --> E[/tmp/qq-res-XXXXXX.json]
    F[client result writer] --> E
```

### Path annotations

- The daemon socket always lives in `/tmp` and follows `qq-<uid>.sock`.
- Request and result files are short-lived temp files created by the shell widget.
- Keeping the socket path short is a deliberate macOS compatibility choice.

## Phase 3.2: Zellij Floating Pane + FIFO

Phase 3.2 replaces the inline `/dev/tty` rendering path with a Zellij floating pane. The key architectural change is the result channel: instead of an atomic-rename temp file polled after the client exits, the shell widget blocks on a named pipe (FIFO) that the client writes to directly.

### End-to-End Flow

```mermaid
sequenceDiagram
    participant User
    participant Zsh as zsh widget
    participant Zellij as Zellij (floating pane)
    participant Client as qq client
    participant Daemon as qq daemon
    participant LLM as Claude API
    participant FIFO as FIFO\n/tmp/qq-fifo.XXXXXX

    User->>Zsh: Type ??
    Zsh->>Zsh: Check $ZELLIJ — exit with message if unset
    Zsh->>Zsh: Capture LBUFFER / RBUFFER
    Zsh->>Zsh: mktemp → req_file
    Zsh->>FIFO: mkfifo → fifo_path
    Zsh->>Zsh: Write shell request JSON to req_file
    Zsh->>Zellij: zellij run --floating --close-on-exit\n--width 80 --height 24\n-- qq client --request-file $req --result-file $fifo &!
    Zsh->>FIFO: Block: IFS= read -r -t 30 result < fifo_path

    Zellij->>Client: Spawn in floating pane (own PTY)
    Client->>Client: Detect ZELLIJ env — skip /dev/tty open
    Client->>Client: Read + validate shell request (Zod)
    Client->>Daemon: ensureDaemon(socket)
    Daemon-->>Client: Ready
    Client->>Client: Render Ink TUI to pane stdout
    Client->>LLM: Stream candidates
    LLM-->>Client: Streamed tokens
    Client->>Client: Display candidates in pane

    User->>Client: Select candidate (Enter) or cancel (Esc)
    Client->>FIFO: fsp.writeFile(fifo_path, result JSON)
    Note over Client,FIFO: Direct write — rename() would destroy FIFO inode

    FIFO-->>Zsh: Unblocks read
    Zsh->>Zsh: Parse result: cancel or replace-buffer
    Zsh->>Zsh: Apply LBUFFER / RBUFFER
    Zsh->>Zsh: _qq_cleanup — rm -f req_file fifo_path
    Zellij->>Zellij: Pane closes (--close-on-exit)
    Zsh-->>User: Updated shell buffer
```

### FIFO Data Flow

```mermaid
flowchart TD
    subgraph zsh["ZSH Widget (ZLE context)"]
        W1[Detect ??]
        W2[mkfifo /tmp/qq-fifo.XXXXXX]
        W3[Write request JSON to /tmp/qq-req.XXXXXX]
        W4["zellij run --floating &!"]
        W5["Block: read < fifo_path"]
        W6[Apply result to LBUFFER / RBUFFER]
        W7[rm -f req_file fifo_path]
    end

    subgraph pane["Floating Pane (own PTY, 80×24)"]
        P1[qq client starts]
        P2[Detect ZELLIJ env — skip /dev/tty]
        P3[Read + validate request JSON]
        P4[ensureDaemon]
        P5[Ink renders to pane stdout]
        P6[Fetch candidates from LLM]
        P7[User selection]
        P8["fsp.writeFile(fifo_path, result)"]
    end

    FIFO["/tmp/qq-fifo.XXXXXX\n(named pipe)"]
    REQ["/tmp/qq-req.XXXXXX\n(request JSON)"]
    SOCK["/tmp/qq-UID.sock\n(daemon socket)"]

    W1 --> W2 --> W3 --> W4 --> W5
    W4 --> P1
    W3 --> REQ
    REQ --> P3
    P1 --> P2 --> P3 --> P4 --> P5 --> P6 --> P7 --> P8
    P4 <--> SOCK
    P8 --> FIFO
    FIFO --> W5
    W5 --> W6 --> W7
```

### What Changed from Phase 3.1

| | Phase 3.1 | Phase 3.2 |
|---|---|---|
| Pane rendering | Inline in current terminal pane (`/dev/tty` + scroll hack) | Floating pane (`zellij run --floating`) |
| Result channel | Atomic temp file (`write .tmp → rename`) | Named pipe (`mkfifo` + direct `writeFile`) |
| Client TTY | Opens `/dev/tty` explicitly | Uses pane's own PTY (`process.stdout`) |
| Widget blocking | Polls or waits for client exit | Blocks on `read < fifo_path` |
| MODAL_CHROME_LINES | Required (scroll room for modal) | Removed (pane is its own viewport) |
| Non-Zellij behavior | Degraded inline rendering | Hard exit with message |

### Runtime Paths (Phase 3.2)

```mermaid
flowchart LR
    UID[Current user UID] --> SOCK["/tmp/qq-UID.sock\ndaemon socket"]
    ZSH[zsh widget] --> REQ["/tmp/qq-req.XXXXXX\nrequest JSON — short-lived"]
    ZSH --> FIFO["/tmp/qq-fifo.XXXXXX\nnamed pipe — short-lived"]
    CLIENT[qq client] --> FIFO
    FIFO --> ZSH
```

---

## Implemented vs Intended Architecture

| Area | Implemented now | Intended later |
|---|---|---|
| Shell trigger | `??` widget and buffer capture | same |
| Foreground client | request validation, `/dev/tty` check, daemon ensure, deterministic result | full interactive TUI |
| Daemon | socket server, request parsing, placeholder acknowledgements | session management, query orchestration, background state |
| Result application | cancel or replace-buffer | same contract |
| Message validation | Zod schemas for shell and IPC | same, expanded as features grow |

## Key Design Decisions

### Split buffer contract

The system passes `lbuffer` and `rbuffer` instead of a single string plus cursor index. This keeps cursor semantics owned by `zsh`, which avoids subtle Unicode and indexing mismatches across runtimes.

### Foreground client plus background daemon

The client handles the immediate shell interaction while the daemon provides a long-lived process boundary. That split is useful because interactive shell entry and background orchestration have different lifecycle and TTY requirements.

### Temp files for shell handoff

The shell widget must regain control after the client exits and then decide how to mutate the shell buffer. A file-based handoff keeps that boundary deterministic and shell-friendly.

### Socket IPC for daemon communication

The daemon is a local per-user service, so a Unix socket is simpler and safer than a TCP port. The fixed `/tmp` path also keeps discovery cheap.

## Risks And Follow-Up Work

- The daemon bootstrap has a known race around unlinking a stale socket during concurrent startup attempts.
- The daemon currently accepts `run-query` without performing real work, so the architecture is ahead of the implementation.
- The shell script depends on `jq` for JSON serialization and result parsing.
- The document name is intentionally `SYSTEM_DESGN.md` to match the requested filename, even though `SYSTEM_DESIGN.md` would be the conventional spelling.
