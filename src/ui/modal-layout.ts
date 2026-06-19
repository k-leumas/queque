import type { CandidateList } from '../contracts/candidates.js';
import { isDestructiveCommand } from '../shared/privacy-filter.js';

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
export function filterCandidates(candidates: CandidateList, query: string): CandidateList {
  if (!query) return candidates;
  const lower = query.toLowerCase();
  return candidates.filter((c) => normalizeCommand(c.command).toLowerCase().includes(lower));
}

/** Input for estimating how many terminal rows the candidate modal occupies. */
export interface CandidateSelectLayoutInput {
  candidates: CandidateList | null;
  initialQuery?: string;
  query: string;
  selectedIndex: number;
  error?: boolean;
  contentWidth: number;
  includeDevFooter?: boolean;
}

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

  if (showDestructiveWarning) {
    lines += 1; // marginTop
    lines += 1; // warning text
  }

  lines += 1; // ControlsLine marginTop
  lines += 1; // ControlsLine text

  if (input.includeDevFooter) {
    lines += 1;
  }

  return lines;
}
