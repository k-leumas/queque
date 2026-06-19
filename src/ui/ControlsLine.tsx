import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

/** Keyboard hints shown below the candidate list. */
export function ControlsLine(): ReactElement {
  return (
    <Box marginTop={1}>
      <Text dimColor>{'↑↓ select  ·  enter accept  ·  esc cancel'}</Text>
    </Box>
  );
}
