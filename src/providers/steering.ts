import type { ContextEnvelope } from '../contracts/request.js';
import { filterContextEnvelope } from '../shared/privacy-filter.js';
import { CATALOG_SET } from '../shared/tool-catalog.js';

// Phase 9 steering (D-15..D-18). Lives apart from claude.ts so every provider adapter can
// import it without a steering <-> claude import cycle; claude.ts re-exports QUEQUE_SYSTEM.
// Steering goes into the system prompt only, never the user JSON and never sampling params.

/**
 * Shared system prompt for the SDK Messages API and Claude CLI `--system-prompt`.
 */
export const QUEQUE_SYSTEM =
  'You are QueQue, a terminal shell assistant. Return ONLY a JSON array of command candidates, ranked with the most correct/direct command first. No prose, no markdown, no code fences. When a command requires a value the user must supply (hostname, filename, branch name, etc.), wrap it in angle brackets: <placeholder>. Use descriptive names like <user@host>, <filename>, <branch-name>. Do not use angle brackets for optional flags or known values.';

/**
 * Steering lines appended to the system prompt when the client sent an
 * `installed-tools` chunk. Re-filters to catalog names (D-04 defence in depth),
 * dedupes and sorts, so only public catalog names can ever reach a model.
 */
export function buildSteeringText(tools: readonly string[]): string {
  const installed = [...new Set(tools.filter((tool) => CATALOG_SET.has(tool)))].sort();
  const toolsLine =
    installed.length > 0
      ? `Notable command-line tools installed on this machine (standard system utilities are also present): ${installed.join(' ')}.`
      : 'No notable command-line tools from the QueQue catalog were found on this machine; standard system utilities are present.';

  return [
    toolsLine,
    // D-15
    'Prefer installed tools. A tool that is not installed is acceptable only when it is clearly better for the task.',
    // D-16
    'At least one candidate must use only installed tools or standard system utilities.',
    // D-17 / D-05
    'Never include install steps in a candidate: no brew, apt, dnf or pacman install commands and no curl-to-shell installers.',
  ].join('\n');
}

/**
 * Provider-neutral system prompt (D-18): every adapter must send this, never the raw
 * constant. Without an `installed-tools` chunk (old widget, missing handoff files,
 * QQ_TOOL_AWARENESS=0) it returns QUEQUE_SYSTEM byte-for-byte.
 */
export function buildSystemPrompt(envelope: ContextEnvelope): string {
  const filtered = filterContextEnvelope(envelope);
  const chunk = filtered.extras.find((extra) => extra.kind === 'installed-tools');
  if (!chunk) {
    return QUEQUE_SYSTEM;
  }
  return `${QUEQUE_SYSTEM}\n\n${buildSteeringText(chunk.payload.tools)}`;
}
