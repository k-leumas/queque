import { Box, Text, useInput, useStdin } from 'ink';
import { type ReactElement, useEffect, useState } from 'react';
import type { CandidateList } from '../contracts/candidates.js';
import { ControlsLine } from './ControlsLine.js';
import { LoadingSpinner } from './LoadingSpinner.js';
import { Modal } from './Modal.js';
import { SearchInput } from './SearchInput.js';

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
}

/**
 * Filter candidates by case-insensitive substring match on command text.
 * Returns the full list unchanged when query is empty or falsy.
 */
function filterCandidates(candidates: CandidateList, query: string): CandidateList {
  if (!query) return candidates;
  const lower = query.toLowerCase();
  return candidates.filter((c) => c.command.toLowerCase().includes(lower));
}

/**
 * Monocle-style candidate selector.
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
}: Props): ReactElement {
  const { isRawModeSupported } = useStdin();
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
        const explanation = selected.explanation || `see man ${selected.command.split(' ')[0]}`;
        onSelect(selected.command, explanation);
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
            return (
              <Box key={candidate.command} flexDirection="column" marginBottom={1}>
                <Box>
                  {active ? <Text color="ansi256(166)">{'┌> '}</Text> : <Text>{'   '}</Text>}
                  <Text bold={active} color={active ? 'white' : undefined} dimColor={!active}>
                    {candidate.command}
                  </Text>
                </Box>
                {candidate.explanation.length > 0 && (
                  <Box>
                    <Text>{'   '}</Text>
                    <Text dimColor>{candidate.explanation}</Text>
                  </Box>
                )}
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
        <Box>
          <Text dimColor>{`queque › ${initialQuery}`}</Text>
        </Box>
      )}
      <SearchInput query={query} />
      {content}
      <ControlsLine />
    </Modal>
  );
}
