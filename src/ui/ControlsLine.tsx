import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

/** Keyboard hints shown below the candidate list. */
export function ControlsLine(): ReactElement {
  return (
    <Box marginTop={1}>
      <Text backgroundColor="ansi256(238)" color="white" bold>
        {' ↑↓ '}
      </Text>
      <Text backgroundColor="ansi256(245)" color="black">
        {' select '}
      </Text>
      <Text dimColor>{' · '}</Text>
      <Text backgroundColor="ansi256(238)" color="white" bold>
        {' enter '}
      </Text>
      <Text backgroundColor="ansi256(245)" color="black">
        {' accept '}
      </Text>
      <Text dimColor>{' · '}</Text>
      <Text backgroundColor="ansi256(238)" color="white" bold>
        {' esc '}
      </Text>
      <Text backgroundColor="ansi256(245)" color="black">
        {' cancel '}
      </Text>
    </Box>
  );
}
