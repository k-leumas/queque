# Pitfalls Research: Que-Que

## Pitfall 1: Breaking the Shell Editing Flow

**What goes wrong:** The tool takes over the prompt, loses the current buffer, or returns the user to a surprising shell state.

**Warning signs:**
- Buffer text disappears or reorders after cancel.
- Cursor lands in the wrong place after command insertion.
- The shell wrapper becomes more complex than the client contract.

**Prevention:**
- Keep the shell result contract minimal and explicit.
- Test `Esc`, accept, and error paths before building richer AI behavior.
- Treat shell-buffer integrity as a release gate.

**Phase:** 1 and 4

## Pitfall 2: Over-Contextualizing Requests

**What goes wrong:** The tool sends repo or filesystem context that is irrelevant to the request, making results worse and weakening privacy posture.

**Warning signs:**
- Media/file tasks generate git-heavy commands.
- Provider prompts grow too large for simple tasks.
- New context providers get added without intent gating.

**Prevention:**
- Separate base context from intent-specific context.
- Require every context provider to justify what it improves.
- Keep provider payloads inspectable in debug mode.

**Phase:** 2 and 6

## Pitfall 3: Confidence Routing Feels Arbitrary

**What goes wrong:** The tool asks unnecessary questions for obvious tasks or returns low-quality direct commands for ambiguous tasks.

**Warning signs:**
- Common tasks bounce into chat unexpectedly.
- Users cannot predict why list mode vs chat mode was chosen.
- Confidence scoring logic is hard-coded inside prompts only.

**Prevention:**
- Keep a visible threshold policy and log confidence decisions in debug mode.
- Build test fixtures for clear vs ambiguous prompts.
- Allow prompt and router heuristics to evolve independently.

**Phase:** 3 and 5

## Pitfall 4: TUI Becomes Too Clever

**What goes wrong:** The UI tries to do too much at once and slows down the path for straightforward command selection.

**Warning signs:**
- List mode feels slower than a simple command picker.
- Chat mode and list mode have conflicting keyboard rules.
- Explanations become long, noisy blocks.

**Prevention:**
- Optimize list mode first.
- Keep explanations short and scannable.
- Make chat mode reuse the same command result surface, not a new abstraction.

**Phase:** 4 and 5

## Pitfall 5: No Extension Seam, Future Rewrite

**What goes wrong:** Provider, shell, and storage decisions get hard-coded into the daemon, blocking later plugin work.

**Warning signs:**
- `zsh`, Claude, and base context logic live in one orchestration module.
- Adding `bash` or local history requires touching most core files.
- Registries exist in name only but are bypassed in practice.

**Prevention:**
- Use registries/interfaces from the start.
- Make built-ins register through the same path future plugins will use.
- Keep the plugin system prioritized immediately after cross-OS `zsh`.

**Phase:** 2 and 6

