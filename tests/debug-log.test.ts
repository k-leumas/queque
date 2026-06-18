import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const appendFileMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('node:fs/promises', () => ({
  appendFile: appendFileMock,
}));

describe('appendDebugLog', () => {
  let previousVerbose: string | undefined;

  beforeEach(async () => {
    vi.resetModules();
    appendFileMock.mockClear();
    previousVerbose = process.env.QQ_DEBUG_VERBOSE;
    delete process.env.QQ_DEBUG_VERBOSE;
  });

  afterEach(() => {
    if (previousVerbose === undefined) {
      delete process.env.QQ_DEBUG_VERBOSE;
    } else {
      process.env.QQ_DEBUG_VERBOSE = previousVerbose;
    }
  });

  it('redacts lbuffer before writing to the debug log', async () => {
    const { appendDebugLog } = await import('../src/shared/debug-log.js');

    await appendDebugLog('client', 'request parsed', {
      lbuffer: 'secret query',
      cwd: '/tmp',
    });

    expect(appendFileMock).toHaveBeenCalledTimes(1);
    const writtenLine = String(appendFileMock.mock.calls[0]?.[1]);
    expect(writtenLine).toContain('[redacted:12chars]');
    expect(writtenLine).not.toContain('secret query');
    expect(writtenLine).toContain('"/tmp"');
  });

  it('preserves lbuffer when QQ_DEBUG_VERBOSE=1', async () => {
    process.env.QQ_DEBUG_VERBOSE = '1';
    const { appendDebugLog } = await import('../src/shared/debug-log.js');

    await appendDebugLog('client', 'request parsed', {
      lbuffer: 'secret query',
      cwd: '/tmp',
    });

    expect(appendFileMock).toHaveBeenCalledTimes(1);
    const writtenLine = String(appendFileMock.mock.calls[0]?.[1]);
    expect(writtenLine).toContain('secret query');
  });
});
