import { Box, Text, useInput, useStdin, useStdout } from 'ink';
import { type ReactElement, useEffect, useRef, useState } from 'react';
import { isDestructiveCommand } from '../shared/privacy-filter.js';
import type { DisplayCandidate } from '../shared/tool-awareness.js';
import { ControlsLine } from './ControlsLine.js';
import { LoadingSpinner } from './LoadingSpinner.js';
import { Modal } from './Modal.js';
import {
  type CandidateListState,
  candidateKey,
  displayedCommand,
  explanationText,
  filterCandidates,
  heldPaneLines,
  MISSING_TOOL_MARK,
  missingToolsLegend,
  wrapText,
} from './modal-layout.js';
import { SearchInput } from './SearchInput.js';

/** Fixed left gutter width — active glyph and inactive spaces both occupy this width so command text never shifts. */
const ROW_GUTTER = '   ';

/** Selection glyph on the first line of the active block (3 display columns). */
const ACTIVE_HEAD = '┌> ';

/** Vertical tail on wrapped continuation lines of the active block (3 display columns). */
const ACTIVE_TAIL = '│  ';

/** Warn-only footnote shown beside destructive commands and in the selection footer. */
const DESTRUCTIVE_WARNING_MARK = '⚠';

/** Footer copy when the selected candidate matches a destructive command pattern. */
const DESTRUCTIVE_WARNING_TEXT = `${DESTRUCTIVE_WARNING_MARK} review carefully — this command may be destructive`;

/** Modal max width — keep in sync with Modal.tsx. */
const MODAL_MAX_WIDTH = 80;

/** Horizontal padding inside Modal (paddingX={1} on each side). */
const MODAL_PADDING_X = 2;

/**
 * Returns the 3-column gutter prefix for a line within a candidate block.
 */
function linePrefix(active: boolean, lineIndex: number): string {
  if (!active) {
    return ROW_GUTTER;
  }
  return lineIndex === 0 ? ACTIVE_HEAD : ACTIVE_TAIL;
}

/**
 * Props for CandidateSelect.
 *
 * D-06: candidates is nullable — null means loading state (spinner shown).
 * D-08: a candidate's optional `missingTools` puts ⓘ before its explanation and in the legend; it stays selectable.
 * D-09: a flagged candidate's optional `install.form` is what Tab switches the row to.
 */
interface Props {
  candidates: readonly DisplayCandidate[] | null;
  initialQuery?: string;
  onSelect: (command: string, explanation: string) => void;
  onCancel: () => void;
  error?: boolean;
  /**
   * Called with the content rows the Zellij pane should hold (heldPaneLines), not the rows
   * drawn: sized for the unfiltered list and never lower while the same list is shown.
   */
  onLayoutLinesChange?: (lineCount: number) => void;
  /** Where the candidate list stands (09.1 D-05); defaults to `'complete'`. */
  listState?: CandidateListState;
}

/**
 * Strips leading and trailing whitespace from a shell command string.
 */
function normalizeCommand(command: string): string {
  return command.trim();
}

/**
 * Keyboard-driven candidate selector.
 *
 * Keys:
 *   ↑ / ↓     — move selection (wraps)
 *   Enter     — accept selected command
 *   Esc       — cancel and restore shell buffer
 *   Backspace — delete last char from live search query
 *   Tab       — toggle the install form on a flagged candidate (Shift+Tab too)
 *   Any printable char → live search (appended to query)
 *
 * Nothing is ever executed: Enter inserts exactly the text the selected row shows.
 */
export function CandidateSelect({
  candidates,
  initialQuery,
  onSelect,
  onCancel,
  error,
  onLayoutLinesChange,
}: Props): ReactElement {
  const { isRawModeSupported } = useStdin();
  const { stdout } = useStdout();
  const modalWidth = Math.min(MODAL_MAX_WIDTH, stdout.columns || MODAL_MAX_WIDTH);
  const contentWidth = modalWidth - MODAL_PADDING_X - ROW_GUTTER.length;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState(initialQuery ?? '');
  // Third useState (tests index state by call order): keys (candidateKey) of rows showing
  // their install form. Eager initial value — the test mock never calls lazy initializers.
  const [installToggled, setInstallToggled] = useState<ReadonlySet<string>>(new Set());
  // Fourth useState: the candidates array the arrival reset below last ran for. Eager null
  // initial value, so a mount that already has candidates still runs the reset.
  const [prevCandidates, setPrevCandidates] = useState<readonly DisplayCandidate[] | null>(null);
  // The Zellij pane hold (quick-261011-f9o): the content rows last reported for `candidates`.
  // A ref, not a fifth state, so the mocked test's useState indices are unchanged and writing
  // it never triggers a render. Eager initial value, like the states above.
  const paneHold = useRef<{ candidates: readonly DisplayCandidate[] | null; lines: number }>({
    candidates: null,
    lines: 0,
  });

  // Reset selection and Tab toggles when candidates arrive (Pitfall 2 fix, D-09).
  // Also clear the initialQuery pre-filter if it produces zero matches — the lbuffer
  // was already used as context for Claude; filtering candidates by it too is
  // harmful when no command literally contains the lbuffer text.
  // This runs during render (React's "adjust state when a prop changes" pattern), not in
  // an effect: an effect would commit one stale render first, and the layout effect would
  // report that render's 'no matches' height to Zellij (G-09-7). React discards this
  // render and retries before committing, so no effect ever sees the stale state.
  // Each setter runs only when its value would change.
  if (candidates !== prevCandidates) {
    setPrevCandidates(candidates);
    if (selectedIndex !== 0) {
      setSelectedIndex(0);
    }
    if (installToggled.size > 0) {
      setInstallToggled(new Set());
    }
    // Toggles are being cleared, so the filter matches the plain commands.
    if (candidates && candidates.length > 0 && filterCandidates(candidates, query).length === 0) {
      setQuery('');
    }
  }

  // If the TTY doesn't support raw mode we can't accept keyboard input — cancel
  // immediately rather than leaving the user with an unresponsive TUI.
  useEffect(() => {
    if (!isRawModeSupported) {
      onCancel();
    }
  }, [isRawModeSupported, onCancel]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset selectedIndex when query changes to prevent out-of-bounds access after filter narrows visible list
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const includeDevFooter = process.env.QQ_DEV_ROOT != null;

  // The Zellij pane stays at QQ_PANE_HEIGHT while loading. On arrival it is sized for the
  // unfiltered list, and while the same candidates array is shown it never shrinks: filtering
  // and Backspace report the held height (an equal height spawns no resize), and only a taller
  // frame grows it. A new candidates array resets the hold. No state is set here (G-09-7).
  useEffect(() => {
    if (!onLayoutLinesChange) {
      return;
    }
    if (candidates === null && error !== true) {
      return;
    }
    const layout = {
      candidates,
      initialQuery,
      query,
      selectedIndex,
      error,
      contentWidth,
      includeDevFooter,
      installToggled,
    };
    const previousHeld = paneHold.current.candidates === candidates ? paneHold.current.lines : 0;
    const lines = heldPaneLines(previousHeld, layout);
    paneHold.current = { candidates, lines };
    onLayoutLinesChange(lines);
  }, [
    candidates,
    initialQuery,
    query,
    selectedIndex,
    error,
    contentWidth,
    includeDevFooter,
    installToggled,
    onLayoutLinesChange,
  ]);

  // Single useInput handler with null-guards (Pitfall 3 fix).
  // isActive:false when raw mode is unavailable — prevents Ink from throwing
  // "Raw mode is not supported" as an uncaughtException (production ZLE crash fix).
  useInput(
    (input, key) => {
      if (key.escape) {
        onCancel();
        return;
      }

      if (key.backspace) {
        setQuery((q) => q.slice(0, -1));
        return;
      }

      // Tab / Shift+Tab (D-09): toggle the selected flagged row between its command and its
      // install form. Always consumed so Tab never reaches the search filter.
      if (key.tab) {
        if (!candidates) return;
        const visible = filterCandidates(candidates, query);
        const selected = visible[selectedIndex] ?? visible[0];
        if (selected?.install?.form == null) return;
        const id = candidateKey(selected);
        setInstallToggled((previous) => {
          const next = new Set(previous);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return next;
        });
        return;
      }

      // key.return must be checked before the generic input handler — in raw mode
      // Enter sends '\r' as `input` (truthy), which would otherwise be consumed by
      // setQuery and prevent the accept action from firing.
      if (key.return && candidates) {
        const visible = filterCandidates(candidates, query);
        if (visible.length === 0) return;
        const selected = visible[selectedIndex] ?? visible[0];
        // Insert exactly what the row shows; the fallback names the original tool, not the installer.
        const command = displayedCommand(selected, installToggled);
        const original = normalizeCommand(selected.command);
        const explanation = selected.explanation || `see man ${original.split(' ')[0]}`;
        onSelect(command, explanation);
        return;
      }

      if (input && !key.ctrl && !key.meta) {
        setQuery((q) => q + input);
        return;
      }

      // Navigation: guard against null candidates
      if (key.upArrow && candidates) {
        const visible = filterCandidates(candidates, query);
        setSelectedIndex((i) => (i === 0 ? visible.length - 1 : i - 1));
        return;
      }

      if (key.downArrow && candidates) {
        const visible = filterCandidates(candidates, query);
        setSelectedIndex((i) => (i + 1) % visible.length);
        return;
      }
    },
    { isActive: isRawModeSupported },
  );

  let content: ReactElement;
  let showDestructiveWarning = false;
  let selectedCandidate: DisplayCandidate | undefined;
  let legend: string | undefined;
  if (error === true) {
    content = (
      <Box marginTop={1}>
        <Text dimColor>{'provider error — press esc to return'}</Text>
      </Box>
    );
  } else if (candidates === null) {
    content = (
      <Box marginTop={1}>
        <LoadingSpinner />
      </Box>
    );
  } else {
    const visible = filterCandidates(candidates, query);
    selectedCandidate = visible[selectedIndex];
    const selectedCommand = selectedCandidate?.command
      ? displayedCommand(selectedCandidate, installToggled)
      : undefined;
    showDestructiveWarning = selectedCommand !== undefined && isDestructiveCommand(selectedCommand);
    legend = missingToolsLegend(visible);
    if (visible.length === 0) {
      content = (
        <Box marginTop={1}>
          <Text dimColor>{'no matches — try a different query'}</Text>
        </Box>
      );
    } else {
      content = (
        <Box flexDirection="column" marginTop={1}>
          {visible.map((candidate, index) => {
            const active = index === selectedIndex;
            // The displayed text (install form when toggled) drives wrapping and the ⚠ check (D-08).
            const command = displayedCommand(candidate, installToggled);
            const destructive = isDestructiveCommand(command);
            const flagged = (candidate.missingTools?.length ?? 0) > 0;
            const commandLines = wrapText(command, contentWidth);
            const explanation = explanationText(candidate);
            const explanationLines =
              explanation.length > 0 ? wrapText(explanation, contentWidth) : [];
            const blockLines = [...commandLines, ...explanationLines];

            return (
              <Box key={candidateKey(candidate)} flexDirection="column" marginBottom={1}>
                {blockLines.map((line, lineIndex) => {
                  const isCommandLine = lineIndex < commandLines.length;
                  const isLastCommandLine = isCommandLine && lineIndex === commandLines.length - 1;
                  // explanationText puts the mark first, and wrapText keeps it on this line.
                  const marked = flagged && lineIndex === commandLines.length;
                  const prefix = linePrefix(active, lineIndex);
                  return (
                    <Box key={`${prefix}${line}`}>
                      {/* flexShrink={0} on the gutter and ⚠: Ink wraps the command text, never a mark. */}
                      <Box flexShrink={0}>
                        <Text color={active ? 'ansi256(166)' : undefined}>{prefix}</Text>
                      </Box>
                      {marked && <Text color="cyan">{MISSING_TOOL_MARK}</Text>}
                      <Text
                        bold={active && isCommandLine}
                        color={active && isCommandLine ? 'white' : undefined}
                        dimColor={!active || !isCommandLine}
                      >
                        {marked ? line.slice(MISSING_TOOL_MARK.length) : line}
                      </Text>
                      {isLastCommandLine && destructive && (
                        <Box flexShrink={0}>
                          <Text color="yellow">{` ${DESTRUCTIVE_WARNING_MARK}`}</Text>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            );
          })}
        </Box>
      );
    }
  }

  return (
    <Modal>
      {initialQuery && initialQuery.length > 0 && (
        <Box flexGrow={0} height={1}>
          <Text dimColor wrap="truncate">{`queque › ${initialQuery}`}</Text>
        </Box>
      )}
      <SearchInput query={query} />
      {content}
      {showDestructiveWarning && (
        <Box marginTop={1}>
          <Text color="yellow">{DESTRUCTIVE_WARNING_TEXT}</Text>
        </Box>
      )}
      {legend !== undefined && (
        <Box marginTop={1}>
          <Text color="cyan">{MISSING_TOOL_MARK}</Text>
          <Text dimColor>{legend.slice(MISSING_TOOL_MARK.length)}</Text>
        </Box>
      )}
      <ControlsLine />
      {process.env.QQ_DEV_ROOT != null && (
        <Box justifyContent="flex-end">
          <Text color="yellow">{`dev v${__QUEQUE_VERSION__} ${__QUEQUE_COMMIT__}`}</Text>
        </Box>
      )}
    </Modal>
  );
}
