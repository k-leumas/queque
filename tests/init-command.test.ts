import { describe, expect, it } from 'vitest';

describe('initCommand marker check', () => {
  it('uses RegExp.test so missing marker does not block install', () => {
    const marker = /\bqueque\b/;
    const withoutMarker = 'export PATH=$PATH\n';
    const withMarker = 'source /opt/homebrew/share/queque/queque.zsh\n';

    expect(marker.test(withoutMarker)).toBe(false);
    expect(marker.test(withMarker)).toBe(true);
    // Document the bug: search() returns -1 which is truthy in an if().
    expect(Boolean(withoutMarker.search(marker))).toBe(true);
  });
});
