import { Box, Text, useInput, useStdin, useStdout } from 'ink';
import { type ReactElement, useEffect, useState } from 'react';
import type { CandidateList } from '../contracts/candidates.js';
import { isDestructiveCommand } from '../shared/privacy-filter.js';
import { ControlsLine } from './ControlsLine.js';
import { LoadingSpinner } from './LoadingSpinner.js';
import { Modal } from './Modal.js';
import { estimateCandidateSelectLines, filterCandidates, wrapText } from './modal-layout.js';
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
 */
interface Props {
  candidates: CandidateList | null;
  initialQuery?: string;
  onSelect: (command: string, explanation: string) => void;
  onCancel: () => void;
  error?: boolean;
  /** Called when rendered row count changes (Zellij pane resize). */
  onLayoutLinesChange?: (lineCount: number) => void;
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
 *   Any printable char → live search (appended to query)
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

  // If the TTY doesn't support raw mode we can't accept keyboard input — cancel
  // immediately rather than leaving the user with an unresponsive TUI.
  useEffect(() => {
    if (!isRawModeSupported) {
      onCancel();
    }
  }, [isRawModeSupported, onCancel]);

  // Reset selectedIndex when candidates arrive (Pitfall 2 fix).
  // Also clear initialQuery pre-filter if it produces zero matches — the lbuffer
  // was already used as context for Claude; filtering candidates by it too is
  // harmful when no command literally contains the lbuffer text.
  // biome-ignore lint/correctness/useExhaustiveDependencies: candidates is a prop; reset on arrival is intentional
  useEffect(() => {
    setSelectedIndex(0);
    if (candidates && candidates.length > 0 && filterCandidates(candidates, query).length === 0) {
      setQuery('');
    }
  }, [candidates]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset selectedIndex when query changes to prevent out-of-bounds access after filter narrows visible list
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const includeDevFooter = process.env.QQ_DEV_ROOT != null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: layout callback mirrors render inputs
  useEffect(() => {
    if (!onLayoutLinesChange) {
      return;
    }
    onLayoutLinesChange(
      estimateCandidateSelectLines({
        candidates,
        initialQuery,
        query,
        selectedIndex,
        error,
        contentWidth,
        includeDevFooter,
      }),
    );
  }, [
    candidates,
    initialQuery,
    query,
    selectedIndex,
    error,
    contentWidth,
    includeDevFooter,
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

      // key.return must be checked before the generic input handler — in raw mode
      // Enter sends '\r' as `input` (truthy), which would otherwise be consumed by
      // setQuery and prevent the accept action from firing.
      if (key.return && candidates) {
        const visible = filterCandidates(candidates, query);
        if (visible.length === 0) return;
        const selected = visible[selectedIndex] ?? visible[0];
        const command = normalizeCommand(selected.command);
        const explanation = selected.explanation || `see man ${command.split(' ')[0]}`;
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
    const selectedCommand = visible[selectedIndex]?.command
      ? normalizeCommand(visible[selectedIndex].command)
      : undefined;
    showDestructiveWarning = selectedCommand !== undefined && isDestructiveCommand(selectedCommand);
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
            const command = normalizeCommand(candidate.command);
            const destructive = isDestructiveCommand(command);
            const commandLines = wrapText(command, contentWidth);
            const explanationLines =
              candidate.explanation.length > 0 ? wrapText(candidate.explanation, contentWidth) : [];
            const blockLines = [...commandLines, ...explanationLines];

            return (
              <Box
                key={`${command}::${candidate.explanation}`}
                flexDirection="column"
                marginBottom={1}
              >
                {blockLines.map((line, lineIndex) => {
                  const isCommandLine = lineIndex < commandLines.length;
                  const isLastCommandLine = isCommandLine && lineIndex === commandLines.length - 1;
                  const prefix = linePrefix(active, lineIndex);
                  return (
                    <Box key={`${prefix}${line}`}>
                      <Text color={active ? 'ansi256(166)' : undefined}>{prefix}</Text>
                      <Text
                        bold={active && isCommandLine}
                        color={active && isCommandLine ? 'white' : undefined}
                        dimColor={!active || !isCommandLine}
                      >
                        {line}
                      </Text>
                      {isLastCommandLine && destructive && (
                        <Text color="yellow">{` ${DESTRUCTIVE_WARNING_MARK}`}</Text>
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
      <ControlsLine />
      {process.env.QQ_DEV_ROOT != null && (
        <Box justifyContent="flex-end">
          <Text color="yellow">{`dev v${__QUEQUE_VERSION__} ${__QUEQUE_COMMIT__}`}</Text>
        </Box>
      )}
    </Modal>
  );
}
