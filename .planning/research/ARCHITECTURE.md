# Architecture Research: Que-Que

## Recommended Component Boundaries

### 1. Shell Adapter

Responsibilities:
- Detect literal `??`
- Capture `LBUFFER`, `RBUFFER`, cursor position, and shell metadata
- Invoke the foreground client
- Apply the returned command/cursor update back to the shell buffer

### 2. Foreground Client

Responsibilities:
- Parse invocation context from the shell adapter
- Talk to the background daemon over IPC
- Render the TUI for command selection and clarification chat
- Return a structured result to the shell adapter

### 3. Background Daemon

Responsibilities:
- Stay warm between requests
- Own provider initialization
- Run intent routing and context enrichment
- Manage active clarification sessions
- Return structured responses to the client

### 4. Intent Router

Responsibilities:
- Categorize the request
- Decide which context providers should run
- Assign or refine confidence for direct command suggestions vs clarification

### 5. Context Provider Registry

Responsibilities:
- Supply cheap base context for every request
- Add intent-specific context only when selected by the router
- Hide implementation details of cwd, git, media tool, or system inspections

### 6. Provider Registry

Responsibilities:
- Encapsulate Claude requests and response parsing
- Support future providers without changing the daemon contract
- Require each backend to implement the same adapter interface for direct-command requests, clarification turns, confidence/result normalization, and user-safe error handling

### 7. Command/TUI State Model

Responsibilities:
- Represent ranked command candidates, explanations, and selected index
- Represent clarification turns and confidence updates in the same session state

## Data Flow

1. User types in `zsh`.
2. Shell adapter detects `??`.
3. Shell adapter sends buffer context to `qq`.
4. Client forwards request to daemon.
5. Daemon routes intent.
6. Daemon gathers base and intent-specific context.
7. Daemon calls Claude provider.
8. Daemon returns either:
   - ranked command candidates
   - clarification question/session state
   - cancel/error
9. Client renders list or chat.
10. User accepts or cancels.
11. Client returns structured result to shell adapter.
12. Shell adapter updates live shell buffer.

## Build Order Implications

- Build shell adapter and result contract first; everything else depends on this loop existing.
- Stand up the daemon before the richer TUI; startup characteristics affect UX.
- Keep candidate list and clarification state in one TUI model; avoid separate mini-apps.
- Put extension registries in place before adding non-default providers or shells.
