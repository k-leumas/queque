import { Text } from 'ink';
import React, { type ReactElement, useEffect, useState } from 'react';

const FRAMES = ['thinking…', 'thinking.', 'thinking..', 'thinking…'];

export function LoadingSpinner(): ReactElement {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length);
    }, 200);
    return () => clearInterval(id);
  }, []);

  return <Text dimColor>{FRAMES[frame]}</Text>;
}
