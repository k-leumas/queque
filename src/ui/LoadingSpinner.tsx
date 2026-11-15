import { Text } from 'ink';
import { type ReactElement, useEffect, useState } from 'react';
import { INSTANT_FRAME_LOADING_TEXT } from '../shared/instant-frame-spec.js';

// FRAMES[0] is the loading text the shell adapters paint in the instant frame (Phase 11 D-04).
const FRAMES = [INSTANT_FRAME_LOADING_TEXT, 'thinking.', 'thinking..', 'thinking…'];

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
