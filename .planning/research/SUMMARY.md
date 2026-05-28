# Research Summary: QueQue

## Recommended Direction

Build QueQue as a TypeScript/Node LTS product with three runtime layers: `zsh` shell adapter, foreground TUI client, and a per-user background daemon over a Unix socket. Optimize the fast path first: literal `??` invocation, ranked command candidates with explanations, and safe shell-buffer replacement.

## Table Stakes

- Inline shell-native invocation
- Explainable command suggestions
- Keyboard-only command selection
- Clarification flow for ambiguous requests
- Safe cancel and safe command return

## Differentiators

- Pre-trigger shell text becomes context
- Dynamic intent-driven context enrichment
- Teach while assisting via short command explanations
- Architecture that preserves future shell/provider/plugin expansion

## Watch Out For

- Breaking shell buffer integrity
- Over-sending irrelevant local context
- Letting confidence routing feel opaque
- Overcomplicating the TUI before the fast path is excellent
- Hard-coding provider or shell behavior into the daemon core

## Build Order Recommendation

1. Shell bridge + structured result contract
2. Daemon and request/response plumbing
3. Claude fast path with ranked command suggestions
4. Fuzzy-list TUI interaction
5. Clarification chat inside the same TUI
6. Hardening, privacy defaults, and extension seams

