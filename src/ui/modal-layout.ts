import type { CommandCandidate } from '../contracts/candidates.js';
import { isDestructiveCommand } from '../shared/privacy-filter.js';
import type { DisplayCandidate } from '../shared/tool-awareness.js';

/**
 * Mark shown after the last command line of a candidate that uses a tool zsh cannot resolve
 * (D-08, glyph choice is Claude's Discretion per CONTEXT). U+2298 has East Asian Width N in
 * Unicode 16 and width 1 in Ink's string-width, so it occupies one column. Rendered cyan,
 * distinct from the yellow destructive ⚠. Lives here, not in CandidateSelect.tsx, so the line
 * estimate can measure the same footer text without an import cycle.
 */
export const MISSING_TOOL_MARK = '⊘';

/** Footer line shown when the selected candidate uses tools that are not installed. */
export function missingToolsFooterText(missing: readonly string[]): string {
  return `${MISSING_TOOL_MARK} not installed: ${missing.join(', ')}`;
}

/**
 * Wraps text to fit within maxWidth, breaking on whitespace and hard-splitting long tokens.
 */
export function wrapText(text: string, maxWidth: number): string[] {
  if (maxWidth < 1) {
    return [text];
  }

  const words = text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return [''];
  }

  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    let remaining = word;
    while (remaining.length > 0) {
      const candidate = line ? `${line} ${remaining}` : remaining;
      if (candidate.length <= maxWidth) {
        line = candidate;
        remaining = '';
        break;
      }

      if (line) {
        lines.push(line);
        line = '';
        continue;
      }

      lines.push(remaining.slice(0, maxWidth));
      remaining = remaining.slice(maxWidth);
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

/** Strips leading and trailing whitespace from a shell command string. */
function normalizeCommand(command: string): string {
  return command.trim();
}

/**
 * Filter candidates by case-insensitive substring match on command text.
 * Returns the full list unchanged when query is empty or falsy.
 */
export function filterCandidates<T extends CommandCandidate>(
  candidates: readonly T[],
  query: string,
): readonly T[] {
  if (!query) return candidates;
  const lower = query.toLowerCase();
  return candidates.filter((c) => normalizeCommand(c.command).toLowerCase().includes(lower));
}

/** Input for estimating how many terminal rows the candidate modal occupies. */
export interface CandidateSelectLayoutInput {
  candidates: readonly DisplayCandidate[] | null;
  initialQuery?: string;
  query: string;
  selectedIndex: number;
  error?: boolean;
  contentWidth: number;
  includeDevFooter?: boolean;
}

/**
 * Columns one inline mark takes after the last command line: a space plus a one-column glyph
 * (⚠ or ⊘). Estimate-only — render spacing stays in Ink props.
 */
const MARK_COLUMNS = 2;

/**
 * Estimates rendered row count for CandidateSelect, mirroring Ink layout structure.
 * Used to size the Zellij floating pane to content without exceeding QQ_PANE_HEIGHT.
 */
export function estimateCandidateSelectLines(input: CandidateSelectLayoutInput): number {
  let lines = 0;

  if (input.initialQuery && input.initialQuery.length > 0) {
    lines += 1;
  }

  lines += 1; // SearchInput
  lines += 1; // content marginTop

  if (input.error === true) {
    lines += 1;
  } else if (input.candidates === null) {
    lines += 1; // LoadingSpinner
  } else {
    const visible = filterCandidates(input.candidates, input.query);
    if (visible.length === 0) {
      lines += 1;
    } else {
      for (const candidate of visible) {
        const command = normalizeCommand(candidate.command);
        const commandLines = wrapText(command, input.contentWidth);
        const explanationLines =
          candidate.explanation.length > 0
            ? wrapText(candidate.explanation, input.contentWidth)
            : [];
        lines += commandLines.length + explanationLines.length;
        // The gutter and marks have flexShrink={0}: when the marks no longer fit after the
        // last command line, Ink wraps the command text onto one more row.
        const markCount =
          (isDestructiveCommand(command) ? 1 : 0) +
          ((candidate.missingTools?.length ?? 0) > 0 ? 1 : 0);
        const lastCommandLine = commandLines[commandLines.length - 1] ?? '';
        if (
          markCount > 0 &&
          lastCommandLine.length + MARK_COLUMNS * markCount > input.contentWidth
        ) {
          lines += 1;
        }
        lines += 1; // marginBottom per candidate block
      }
    }
  }

  const visible =
    input.candidates !== null && input.error !== true
      ? filterCandidates(input.candidates, input.query)
      : [];
  const selectedCommand = visible[input.selectedIndex]?.command
    ? normalizeCommand(visible[input.selectedIndex].command)
    : undefined;
  const showDestructiveWarning =
    selectedCommand !== undefined && isDestructiveCommand(selectedCommand);
  const selectedMissingTools = visible[input.selectedIndex]?.missingTools ?? [];

  // Mirrors CandidateSelect's single footer block: one shared marginTop, then the
  // destructive line and the (possibly wrapped) missing-tool line.
  if (showDestructiveWarning || selectedMissingTools.length > 0) {
    lines += 1; // shared footer marginTop
    if (showDestructiveWarning) {
      lines += 1; // destructive warning text
    }
    if (selectedMissingTools.length > 0) {
      lines += wrapText(missingToolsFooterText(selectedMissingTools), input.contentWidth).length;
    }
  }

  lines += 1; // ControlsLine marginTop
  lines += 1; // ControlsLine text

  if (input.includeDevFooter) {
    lines += 1;
  }

  return lines;
}
