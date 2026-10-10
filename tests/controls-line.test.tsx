/**
 * ControlsLine is a pure component (no hooks), so it is called directly and its element tree
 * flattened to text. Ink's Box and Text are not invoked.
 */

import { describe, expect, it } from 'vitest';
import { ControlsLine } from '../src/ui/ControlsLine.js';

/** Collects string leaves from a React element tree. */
function collectText(node: unknown): string[] {
  if (node == null || typeof node === 'boolean') {
    return [];
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return [String(node)];
  }
  if (Array.isArray(node)) {
    return node.flatMap(collectText);
  }
  if (typeof node === 'object' && node !== null && 'props' in node) {
    const props = (node as { props: { children?: unknown } }).props;
    return collectText(props.children);
  }
  return [];
}

describe('ControlsLine', () => {
  it('shows the same chips for every row, with no tab chip (the ⓘ legend explains Tab)', () => {
    const chips = collectText(ControlsLine());
    expect(chips).toEqual([
      ' ↑↓ ',
      ' select ',
      ' · ',
      ' enter ',
      ' accept ',
      ' · ',
      ' esc ',
      ' cancel ',
    ]);
    expect(chips).not.toContain(' tab ');
  });
});
