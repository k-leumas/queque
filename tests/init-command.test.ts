import { describe, expect, it } from 'vitest';
import { hasShellIntegration } from '../src/cli/commands/init.js';

describe('hasShellIntegration', () => {
  it('returns false for an empty or unrelated .zshrc', () => {
    expect(hasShellIntegration('', 'zsh')).toBe(false);
    expect(hasShellIntegration('export PATH=$PATH\n', 'zsh')).toBe(false);
  });

  it('returns false when queque appears only in an unrelated shell function stub', () => {
    expect(hasShellIntegration('queque() { :; }\n', 'zsh')).toBe(false);
  });

  it('returns true when the queque source line is present', () => {
    expect(hasShellIntegration('source "/opt/homebrew/share/queque/queque.zsh"\n', 'zsh')).toBe(
      true,
    );
  });

  it('returns true when the integration marker comment is present', () => {
    expect(hasShellIntegration('# queque shell integration\n', 'zsh')).toBe(true);
  });
});

describe('initCommand marker check', () => {
  it('documents the old search()-as-boolean bug that RegExp.test avoids', () => {
    const marker = /\bqueque\b/;
    const withoutMarker = 'export PATH=$PATH\n';

    expect(marker.test(withoutMarker)).toBe(false);
    expect(Boolean(withoutMarker.search(marker))).toBe(true);
  });
});
