import { Box, useStdout } from 'ink';
import type { ReactElement, ReactNode } from 'react';

interface ModalProps {
  children: ReactNode;
}

// Cap at 80 but respect narrower terminals (e.g. Zellij floating panes where
// --width 80 means the outer frame including a ~2-col border, leaving 78 cols
// for the PTY). Without the cap, yoga renders at 80 on a 78-col terminal,
// wrapping each line — log-update then undercounts visual lines and
// eraseLines() doesn't reach the top, causing the title to stack on each tick.
export function Modal({ children }: ModalProps): ReactElement {
  const { stdout } = useStdout();
  const width = Math.min(80, stdout.columns || 80);
  return (
    <Box flexDirection="column" paddingX={1} width={width}>
      {children}
    </Box>
  );
}
