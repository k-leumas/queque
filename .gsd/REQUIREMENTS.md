# Requirements

## Active

### SHL-01 — User can trigger Que-Que by typing a literal `??` while editing a `zsh` command line.

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

User can trigger Que-Que by typing a literal `??` while editing a `zsh` command line.

### SHL-02 — Text already typed before the `??` trigger is captured as request context.

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Text already typed before the `??` trigger is captured as request context.

### SHL-03 — User can dismiss Que-Que with `Esc` and return to the shell with no buffer changes.

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

User can dismiss Que-Que with `Esc` and return to the shell with no buffer changes.

### SHL-04 — User can confirm a suggested command and have it written back into the live shell buffer with a correct cursor position.

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

User can confirm a suggested command and have it written back into the live shell buffer with a correct cursor position.

### INT-04 — Tool routes requests with confidence below `0.8` into a clarification flow inside the TUI.

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Tool routes requests with confidence below `0.8` into a clarification flow inside the TUI.

### CMD-01 — Tool returns a ranked list of command candidates for requests with confidence at or above `0.8`.

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Tool returns a ranked list of command candidates for requests with confidence at or above `0.8`.

### CMD-02 — Each command candidate includes a short explanation of what the command will do.

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Each command candidate includes a short explanation of what the command will do.

### CMD-03 — User can navigate command candidates with keyboard-only controls and confirm a selection.

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

User can navigate command candidates with keyboard-only controls and confirm a selection.

### CMD-04 — Tool never auto-executes commands in v1; it only returns them to the shell buffer.

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Tool never auto-executes commands in v1; it only returns them to the shell buffer.

### TUI-01 — Trigger opens a fuzzy-finder-style TUI with initial keyboard focus in the input area.

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Trigger opens a fuzzy-finder-style TUI with initial keyboard focus in the input area.

### TUI-02 — Low-confidence clarification stays inside the same TUI instead of bouncing the user into a separate prompt flow.

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Low-confidence clarification stays inside the same TUI instead of bouncing the user into a separate prompt flow.

### TUI-03 — TUI can show clarifying turns and then return a refined command candidate list or final command.

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

TUI can show clarifying turns and then return a refined command candidate list or final command.

### PRV-01 — Tool can call Claude using `ANTHROPIC_API_KEY`.

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Tool can call Claude using `ANTHROPIC_API_KEY`.

### PRV-02 — Provider integration is isolated behind a provider interface so more models/providers can be added later.

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Provider integration is isolated behind a provider interface so more models/providers can be added later.

### PRV-03 — Every LLM backend implements the same adapter contract for direct suggestion, clarification continuation, structured confidence/result parsing, and error mapping.

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Every LLM backend implements the same adapter contract for direct suggestion, clarification continuation, structured confidence/result parsing, and error mapping.

### RUN-01 — A background daemon keeps repeat invocations fast and avoids paying full startup cost on every use.

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

A background daemon keeps repeat invocations fast and avoids paying full startup cost on every use.

### RUN-02 — If the daemon is missing or stale, the client can recover without corrupting shell state.

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

If the daemon is missing or stale, the client can recover without corrupting shell state.

### SAFE-01 — Errors and provider failures surface cleanly without mutating the shell buffer.

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Errors and provider failures surface cleanly without mutating the shell buffer.

### EXT-01 — Internal registries exist for shell adapters, context providers, provider backends, and storage/extension hooks.

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Internal registries exist for shell adapters, context providers, provider backends, and storage/extension hooks.

## Validated

### INT-01 — Tool classifies the user request into a broad intent category before gathering extra context.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Tool classifies the user request into a broad intent category before gathering extra context.

### INT-02 — Tool always includes base shell context such as query text, current working directory, shell, platform, and TTY metadata.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Tool always includes base shell context such as query text, current working directory, shell, platform, and TTY metadata.

### INT-03 — Tool gathers extra context only when it is relevant to the inferred intent instead of assuming repo/code context for every request.

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Tool gathers extra context only when it is relevant to the inferred intent instead of assuming repo/code context for every request.

## Deferred

## Out of Scope
