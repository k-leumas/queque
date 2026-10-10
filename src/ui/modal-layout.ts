import type { CommandCandidate } from '../contracts/candidates.js';
import { isDestructiveCommand } from '../shared/privacy-filter.js';
import type { DisplayCandidate } from '../shared/tool-awareness.js';

/**
 * Mark shown after the last command line of a candidate that uses a tool zsh cannot resolve
 * (D-08). U+24D8 (circled i) is East Asian Width A, measured as one column by Ink's
 * string-width, so it occupies one column. Rendered cyan, distinct from the yellow destructive
 * ⚠. There is deliberately no missing-tool footer line: a footer that appears only for flagged
 * rows makes the modal jump as the selection moves; the Tab chip carries the install action.
 */
export const MISSING_TOOL_MARK = 'ⓘ';

/** Candidate identity (`command::explanation`) — the row key and the install-toggle key (D-13). */
export function candidateKey(candidate: CommandCandidate): string {
  return `${normalizeCommand(candidate.command)}::${candidate.explanation}`;
}

/** Whether `candidate` currently shows its install form (toggled and a form exists). */
export function isInstallToggled(
  candidate: DisplayCandidate,
  installToggled: ReadonlySet<string> | undefined,
): boolean {
  return candidate.install?.form != null && installToggled?.has(candidateKey(candidate)) === true;
}

/** The command text a row shows: its install form when toggled, else the trimmed command. */
export function displayedCommand(
  candidate: DisplayCandidate,
  installToggled: ReadonlySet<string> | undefined,
): string {
  const form = candidate.install?.form;
  return form != null && isInstallToggled(candidate, installToggled)
    ? form
    : normalizeCommand(candidate.command);
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
  /** Keys (candidateKey) of rows currently showing their install form. */
  installToggled?: ReadonlySet<string>;
}

/**
 * Columns one inline mark takes after the last command line: a space plus a one-column glyph
 * (⚠ or ⓘ). Estimate-only — render spacing stays in Ink props.
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
        // Wrap, destructive check and mark overflow all use the text the row shows.
        const command = displayedCommand(candidate, input.installToggled);
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
  const selectedCandidate = visible[input.selectedIndex];
  const selectedCommand = selectedCandidate?.command
    ? displayedCommand(selectedCandidate, input.installToggled)
    : undefined;
  const showDestructiveWarning =
    selectedCommand !== undefined && isDestructiveCommand(selectedCommand);

  if (showDestructiveWarning) {
    lines += 1; // footer marginTop
    lines += 1; // destructive warning text
  }

  lines += 1; // ControlsLine marginTop
  lines += 1; // ControlsLine text

  if (input.includeDevFooter) {
    lines += 1;
  }

  return lines;
}
