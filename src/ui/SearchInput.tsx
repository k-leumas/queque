import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

interface SearchInputProps {
  query: string;
}

export function SearchInput({ query }: SearchInputProps): ReactElement {
  return (
    <Box>
      <Text color="cyan" bold>
        {'FILTER: '}
      </Text>
      {query ? <Text>{query}</Text> : <Text dimColor>{'type to filter…'}</Text>}
    </Box>
  );
}
