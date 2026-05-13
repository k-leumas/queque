import { Box, Text } from 'ink';
import React, { type ReactElement, type ReactNode } from 'react';

interface ModalProps {
  title?: string;
  children: ReactNode;
  width?: number;
}

export function Modal({ title = 'que-que', children, width = 80 }: ModalProps): ReactElement {
  const innerWidth = width - 4;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} width={width}>
      <Box flexDirection="column">
        <Text color="cyan" bold>
          {title}
        </Text>
        <Text dimColor>{'─'.repeat(innerWidth)}</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {children}
      </Box>
    </Box>
  );
}
