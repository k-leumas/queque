import type { CommandCandidate } from '../contracts/candidates.js';
import { isDestructiveCommand } from '../shared/privacy-filter.js';
import type { DisplayCandidate } from '../shared/tool-awareness.js';

/**
 * Mark that starts the explanation of a candidate using a tool zsh cannot resolve (D-08).
 * U+24D8 (circled i) is East Asian Width A, measured as one column by Ink's string-width.
 * Rendered cyan. The legend above the controls explains it; the legend depends on the
 * visible list, never on the selection, so moving the selection never changes the height.
 */
export const MISSING_TOOL_MARK = 'ⓘ';

/** Explanation text a row shows: prefixed with the mark when the candidate is flagged. */
export function explanationText(candidate: DisplayCandidate): string {
  if ((candidate.missingTools?.length ?? 0) === 0) return candidate.explanation;
  return candidate.explanation.length > 0
    ? `${MISSING_TOOL_MARK} ${candidate.explanation}`
    : MISSING_TOOL_MARK;
}

/**
 * Legend for the mark, or undefined when no visible candidate is flagged. It says what ⓘ means,
 * not which tools are missing, and adds what Tab does when Tab can act on a visible row (D-14).
 */
export function missingToolsLegend(visible: readonly DisplayCandidate[]): string | undefined {
  if (!visible.some((candidate) => (candidate.missingTools?.length ?? 0) > 0)) return undefined;
  const legend = `${MISSING_TOOL_MARK} not installed`;
  const installable = visible.some((candidate) => candidate.install?.form != null);
  return installable ? `${legend} · tab prepends the install command` : legend;
}

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
 * Filter candidates by case-insensitive substring match on a row's command or, for a flagged
 * row, its install form. Matching both regardless of the Tab toggle means pressing Tab never
 * shows or hides a row: typing text from the install form keeps the row visible after Tab
 * undoes it. A hidden row keeps its toggle (keyed by `candidateKey`), so it comes back as it
 * was when the query is cleared.
 * Returns the full list unchanged when query is empty or falsy.
 */
export function filterCandidates<T extends DisplayCandidate>(
  candidates: readonly T[],
  query: string,
): readonly T[] {
  if (!query) return candidates;
  const lower = query.toLowerCase();
  return candidates.filter(
    (c) =>
      c.command.toLowerCase().includes(lower) ||
      (c.install?.form?.toLowerCase().includes(lower) ?? false),
  );
}

/**
 * Lines the inline (non-Zellij) client scrolls up before the modal renders, so prior terminal
 * content stays visible above it. Sized for the typical tallest modal: query header (1) +
 * filter (1) + content marginTop (1) + 3 two-line candidates with marginBottom (9) + the
 * destructive ⚠ footer (marginTop + line = 2) + the ⓘ legend (marginTop + line = 2) +
 * controls (marginTop + line = 2) = 18. The two footers are separate boxes with their own
 * margins, so each adds two lines. A fixed approximation written before candidates arrive:
 * 5-candidate lists, wrapped rows or a wrapped legend can exceed it.
 */
export const MODAL_VIEWPORT_LINES = 18;

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
 * (⚠). Estimate-only — render spacing stays in Ink props.
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
        const explanation = explanationText(candidate);
        const explanationLines =
          explanation.length > 0 ? wrapText(explanation, input.contentWidth) : [];
        lines += commandLines.length + explanationLines.length;
        // The gutter and ⚠ have flexShrink={0}: when ⚠ no longer fits after the last
        // command line, Ink wraps the command text onto one more row.
        const lastCommandLine = commandLines[commandLines.length - 1] ?? '';
        if (
          isDestructiveCommand(command) &&
          lastCommandLine.length + MARK_COLUMNS > input.contentWidth
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

  const legend = missingToolsLegend(visible);
  if (legend !== undefined) {
    lines += 1; // legend marginTop
    lines += wrapText(legend, input.contentWidth).length;
  }

  lines += 1; // ControlsLine marginTop
  lines += 1; // ControlsLine text

  if (input.includeDevFooter) {
    lines += 1;
  }

  return lines;
}

/**
 * Content rows the Zellij floating pane should hold for the current frame (quick-261011-f9o).
 * The caller adds the pane's frame and cursor rows (resolveZellijPaneHeight).
 *
 * - The pane is sized for the unfiltered list: the frame the user sees after clearing the
 *   filter (query '', row 0 selected — the query reset selects row 0 — and the current Tab
 *   toggles, which hidden rows keep). That holds even when the lbuffer pre-filters the list
 *   on arrival, so clearing a filter never needs a grow.
 * - It is a per-list high-water mark: the result is never below `previousHeld`, so filtering,
 *   Backspace, arrow keys and Tab undo never shrink the pane. The caller resets
 *   `previousHeld` to 0 when a new candidates array arrives.
 * - It is never below the frame drawn now (`input`), so a taller frame (the ⚠ footer, a
 *   wrapped install form) still grows the pane and its PTY rows stay >= the rows Ink draws
 *   (261011-e43).
 *
 * It is a max of existing estimates and adds no row offset of its own.
 */
export function heldPaneLines(previousHeld: number, input: CandidateSelectLayoutInput): number {
  const unfiltered = estimateCandidateSelectLines({ ...input, query: '', selectedIndex: 0 });
  return Math.max(previousHeld, estimateCandidateSelectLines(input), unfiltered);
}
