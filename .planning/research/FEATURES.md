# Features Research: QueQue

## Table Stakes

### Shell-Native Invocation

- Open inline from the shell without switching to a browser or separate app.
- Return the final command back into the shell buffer.
- Cancel cleanly without damaging the current command line.

### Explainable Command Suggestions

- Show one or more suggested commands, not just a hidden best guess.
- Explain what each command does in plain language.
- Keep keyboard-only navigation fast and predictable.

### Clarification for Ambiguous Requests

- Recognize when a request is not specific enough.
- Ask clarifying questions without abandoning the terminal flow.
- Preserve context across clarification turns and return a refined result.

### General-Purpose Scope

- Work for filesystem, media, git/code, networking, and system tasks.
- Avoid repo-first assumptions when the user request is not code-related.

## Differentiators

### Pre-Trigger Context

- Use text already present before `??` as part of the request context.
- Treat the surrounding shell edit state as a first-class source of intent.

### Dynamic Context Enrichment

- Infer task type first, then gather only relevant local context.
- This keeps results useful without over-sharing irrelevant system data.

### Teaching Through Suggestions

- Make explanations a product feature, not an afterthought.
- Help newer users learn what the terminal is doing while still serving advanced users.

### Extension-Oriented Architecture

- Design shell adapters, providers, context sources, and storage as registrable components.
- This unlocks later `bash`, provider, and plugin work without a rewrite.

## Anti-Features

- Full prompt takeover or alternate-shell UX
- Auto-execution of generated commands
- Repo-centric context gathering for unrelated tasks
- Hidden reasoning with no visible explanation of command behavior
- Persistent logging/history by default

## Complexity Notes

- Shell-native invocation is high leverage and high risk.
- Clarification flow and command-list flow should share one TUI state model.
- Explanation strings must stay concise or the TUI becomes noisy.
- Dynamic context gathering needs strong guardrails so “more context” does not become “too much context.”

