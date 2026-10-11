import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

/** A fake `zellij action` child: exits only when a test emits 'exit' (or 'error'). */
type FakeChild = EventEmitter & { unref: Mock; kill: Mock };

interface SpawnedAction {
  height: number;
  child: FakeChild;
}

/** Every action spawned in the current test, in spawn order. */
let spawned: SpawnedAction[] = [];

/**
 * Fake Zellij server: a height is applied when its action exits. The G-09-7 debug session
 * showed Zellij applies resize actions in completion order, not spawn order.
 */
let applied: number[] = [];

/** Per-test hook run for each spawned action (e.g. to schedule its exit). */
let onSpawn: ((action: SpawnedAction) => void) | undefined;

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

function fakeSpawn(_command: string, args: readonly string[]): FakeChild {
  const height = Number(args[args.indexOf('--height') + 1]);
  const child = Object.assign(new EventEmitter(), { unref: vi.fn(), kill: vi.fn() });
  child.once('exit', () => applied.push(height));
  const action = { height, child };
  spawned.push(action);
  onSpawn?.(action);
  return child;
}

function setZellijEnv(): void {
  process.env.ZELLIJ = '0';
  process.env.ZELLIJ_PANE_ID = '3';
  process.env.QQ_PANE_HEIGHT = '24';
}

describe('zellij-pane-resize', () => {
  beforeEach(() => {
    spawned = [];
    applied = [];
    onSpawn = undefined;
    spawnMock.mockReset();
    spawnMock.mockImplementation(fakeSpawn);
    delete process.env.ZELLIJ;
    delete process.env.ZELLIJ_PANE_ID;
    delete process.env.QQ_PANE_HEIGHT;
  });

  afterEach(async () => {
    const { resetZellijPaneHeightCache } = await import('../src/client/zellij-pane-resize.js');
    resetZellijPaneHeightCache();
    vi.useRealTimers();
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

  describe('serialized latest-wins queue (G-09-7)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      setZellijEnv();
    });

    it('final applied height equals the last requested height when the earlier action is slower', async () => {
      const { syncZellijFloatingPaneHeight } = await import('../src/client/zellij-pane-resize.js');
      // Measured in the G-09-7 repro: each action takes ~100-420 ms to exit.
      const exitAfterMs: Record<number, number> = { 9: 400, 24: 100 };
      let alive = 0;
      let maxAlive = 0;
      onSpawn = ({ height, child }) => {
        alive += 1;
        maxAlive = Math.max(maxAlive, alive);
        child.once('exit', () => {
          alive -= 1;
        });
        setTimeout(() => child.emit('exit', 0), exitAfterMs[height]);
      };

      syncZellijFloatingPaneHeight(7); // height 9: the stale shrink
      vi.advanceTimersByTime(30);
      syncZellijFloatingPaneHeight(22); // height 24: the real list
      vi.advanceTimersByTime(1000);

      expect(applied.at(-1)).toBe(24);
      expect(applied).toEqual([9, 24]);
      expect(spawned.map((action) => action.height)).toEqual([9, 24]);
      expect(maxAlive).toBe(1);
    });

    it('requests made while an action runs collapse to the newest', async () => {
      const { resolveZellijPaneHeight, syncZellijFloatingPaneHeight } = await import(
        '../src/client/zellij-pane-resize.js'
      );

      syncZellijFloatingPaneHeight(22);
      syncZellijFloatingPaneHeight(7);
      syncZellijFloatingPaneHeight(11);
      syncZellijFloatingPaneHeight(18);
      expect(spawned).toHaveLength(1);

      spawned[0]?.child.emit('exit', 0);

      expect(spawned.map((action) => action.height)).toEqual([24, resolveZellijPaneHeight(18)]);
    });

    it('a waiting height equal to the running height is dropped', async () => {
      const { syncZellijFloatingPaneHeight } = await import('../src/client/zellij-pane-resize.js');

      syncZellijFloatingPaneHeight(22);
      syncZellijFloatingPaneHeight(7);
      syncZellijFloatingPaneHeight(22);
      spawned[0]?.child.emit('exit', 0);

      expect(spawned).toHaveLength(1);
      expect(applied.at(-1)).toBe(24);
    });

    it('a spawn error releases the queue without throwing', async () => {
      const { syncZellijFloatingPaneHeight } = await import('../src/client/zellij-pane-resize.js');

      syncZellijFloatingPaneHeight(22);
      syncZellijFloatingPaneHeight(7);
      const enoent = Object.assign(new Error('spawn zellij ENOENT'), { code: 'ENOENT' });

      expect(() => spawned[0]?.child.emit('error', enoent)).not.toThrow();
      expect(spawned.map((action) => action.height)).toEqual([24, 9]);
    });

    it('a hung action is killed after RESIZE_SETTLE_TIMEOUT_MS', async () => {
      const { RESIZE_SETTLE_TIMEOUT_MS, syncZellijFloatingPaneHeight } = await import(
        '../src/client/zellij-pane-resize.js'
      );

      syncZellijFloatingPaneHeight(22);
      syncZellijFloatingPaneHeight(7);
      vi.advanceTimersByTime(RESIZE_SETTLE_TIMEOUT_MS - 1);
      expect(spawned).toHaveLength(1);

      vi.advanceTimersByTime(2);
      expect(spawned[0]?.child.kill).toHaveBeenCalledTimes(1);
      expect(spawned.map((action) => action.height)).toEqual([24, 9]);

      // The killed action exiting late must not settle the new one or spawn again.
      spawned[0]?.child.emit('exit', null);
      expect(spawned).toHaveLength(2);
    });

    it('unrefs every spawned child so the client never waits for zellij', async () => {
      const { syncZellijFloatingPaneHeight } = await import('../src/client/zellij-pane-resize.js');
      onSpawn = ({ child }) => {
        setTimeout(() => child.emit('exit', 0), 50);
      };

      syncZellijFloatingPaneHeight(22);
      syncZellijFloatingPaneHeight(7);
      vi.advanceTimersByTime(100);
      syncZellijFloatingPaneHeight(11);
      vi.advanceTimersByTime(100);

      expect(spawned.length).toBeGreaterThanOrEqual(2);
      for (const { child } of spawned) {
        expect(child.unref).toHaveBeenCalled();
      }
    });
  });
  describe('failure to start never blocks later resizes (09-06 truth 5)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      setZellijEnv();
    });

    it('a synchronous spawn throw does not crash and a later different height still spawns', async () => {
      const { syncZellijFloatingPaneHeight } = await import('../src/client/zellij-pane-resize.js');
      spawnMock.mockImplementationOnce(() => {
        throw new Error('spawn EAGAIN');
      });

      expect(() => syncZellijFloatingPaneHeight(8)).not.toThrow();
      expect(spawnMock).toHaveBeenCalledTimes(1);

      // No timer advance: the slot must already be free after the synchronous throw.
      syncZellijFloatingPaneHeight(14);
      expect(spawnMock).toHaveBeenCalledTimes(2);
      expect(spawned.map((action) => action.height)).toEqual([16]);
    });

    it("the settle timeout timer is unref'd so it never keeps the client alive", async () => {
      const { syncZellijFloatingPaneHeight } = await import('../src/client/zellij-pane-resize.js');
      const realSetTimeout = globalThis.setTimeout;
      const timers: { unref: Mock }[] = [];
      const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
        fn: () => void,
        ms?: number,
      ) => {
        const handle = realSetTimeout(fn, ms);
        const unref = vi.fn(() => handle);
        const wrapped = Object.assign(handle, { unref });
        timers.push(wrapped as unknown as { unref: Mock });
        return wrapped;
      }) as unknown as typeof setTimeout);
      try {
        syncZellijFloatingPaneHeight(8);
      } finally {
        spy.mockRestore();
      }

      expect(spawnMock).toHaveBeenCalledTimes(1);
      expect(timers).toHaveLength(1);
      expect(timers[0]?.unref).toHaveBeenCalledTimes(1);
    });
  });
});
