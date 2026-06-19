import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const spawnMock = vi.fn().mockReturnValue({ unref: vi.fn() });

vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

describe('zellij-pane-resize', () => {
  beforeEach(() => {
    spawnMock.mockClear();
    delete process.env.ZELLIJ;
    delete process.env.ZELLIJ_PANE_ID;
    delete process.env.QQ_PANE_HEIGHT;
  });

  afterEach(async () => {
    const { resetZellijPaneHeightCache } = await import('../src/client/zellij-pane-resize.js');
    resetZellijPaneHeightCache();
  });

  it('formats numeric pane ids for zellij CLI', async () => {
    const { formatZellijPaneId } = await import('../src/client/zellij-pane-resize.js');
    expect(formatZellijPaneId('0')).toBe('terminal_0');
    expect(formatZellijPaneId('terminal_3')).toBe('terminal_3');
  });

  it('caps pane height at QQ_PANE_HEIGHT', async () => {
    process.env.QQ_PANE_HEIGHT = '12';
    const { resolveZellijPaneHeight } = await import('../src/client/zellij-pane-resize.js');
    expect(resolveZellijPaneHeight(20)).toBe(12);
    expect(resolveZellijPaneHeight(6)).toBe(8);
  });

  it('spawns zellij resize action when inside Zellij', async () => {
    process.env.ZELLIJ = '0';
    process.env.ZELLIJ_PANE_ID = '2';
    process.env.QQ_PANE_HEIGHT = '24';

    const { syncZellijFloatingPaneHeight } = await import('../src/client/zellij-pane-resize.js');
    syncZellijFloatingPaneHeight(8);

    expect(spawnMock).toHaveBeenCalledWith(
      'zellij',
      ['action', 'change-floating-pane-coordinates', '--pane-id', 'terminal_2', '--height', '10'],
      { stdio: 'ignore' },
    );
  });

  it('skips duplicate resize when height is unchanged', async () => {
    process.env.ZELLIJ = '0';
    process.env.ZELLIJ_PANE_ID = '1';

    const { syncZellijFloatingPaneHeight } = await import('../src/client/zellij-pane-resize.js');
    syncZellijFloatingPaneHeight(8);
    syncZellijFloatingPaneHeight(8);

    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it('no-ops outside Zellij', async () => {
    const { syncZellijFloatingPaneHeight } = await import('../src/client/zellij-pane-resize.js');
    syncZellijFloatingPaneHeight(8);
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
