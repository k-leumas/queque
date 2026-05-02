import React, { type ReactElement, useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { CandidateList } from '../contracts/candidates.js';

interface Props {
  candidates: CandidateList;
  onSelect: (command: string) => void;
  onCancel: () => void;
}

export function CandidateSelect({
  candidates,
  onSelect,
  onCancel,
}: Props): ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((_, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((current: number) =>
        current === 0 ? candidates.length - 1 : current - 1,
      );
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((current: number) => (current + 1) % candidates.length);
      return;
    }

    if (key.return) {
      onSelect(candidates[selectedIndex]?.command ?? candidates[0].command);
    }
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, []);

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    React.createElement(Text, null, 'Select a command:'),
    ...candidates.map((candidate, index) => {
      const active = index === selectedIndex;
      const line = `${active ? '>' : ' '} ${candidate.command}${
        candidate.explanation ? ` — ${candidate.explanation}` : ''
      }`;

      return React.createElement(
        Text,
        {
          key: `${candidate.command}-${index}`,
          color: active ? 'green' : undefined,
        },
        line,
      );
    }),
  );
}
