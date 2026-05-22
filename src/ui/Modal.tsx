import { Box } from 'ink';
import React, { type ReactElement, type ReactNode } from 'react';

interface ModalProps {
  children: ReactNode;
  width?: number;
}

export function Modal({ children, width = 80 }: ModalProps): ReactElement {
  return (
    <Box flexDirection="column" paddingX={1} width={width}>
      {children}
    </Box>
  );
}
