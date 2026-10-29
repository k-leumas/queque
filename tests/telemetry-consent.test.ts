import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  askTelemetryConsent,
  CONSENT_PROMPT,
  CONSENT_TIMEOUT_MS,
  shouldAskTelemetryConsent,
} from '../src/client/telemetry-consent.js';
import type { TelemetryState } from '../src/shared/telemetry-config.js';

const ERASE_LINE = '\r\x1b[2K';

const UNASKED: TelemetryState = { enabled: false, asked: false };

describe('shouldAskTelemetryConsent', () => {
  it('asks after an accepted ?? when never asked, unblocked and on a tty', () => {
    expect(
      shouldAskTelemetryConsent({
        outcome: 'accepted',
        state: UNASKED,
        blockedBy: null,
        hasTty: true,
      }),
    ).toBe(true);
  });

  it.each(['escaped', 'error', undefined] as const)('never asks after outcome %s', (outcome) => {
    expect(
      shouldAskTelemetryConsent({ outcome, state: UNASKED, blockedBy: null, hasTty: true }),
    ).toBe(false);
  });

  it('never asks twice: asked true (yes or no) stays silent', () => {
    for (const state of [
      { enabled: false, asked: true },
      { enabled: true, asked: true, installId: '9b7e2c1a-1111-4222-8333-444455556666' },
    ]) {
      expect(
        shouldAskTelemetryConsent({ outcome: 'accepted', state, blockedBy: null, hasTty: true }),
      ).toBe(false);
    }
  });

  it.each(['DO_NOT_TRACK', 'QQ_TELEMETRY', 'CI'] as const)('never asks when %s blocks', (gate) => {
    expect(
      shouldAskTelemetryConsent({
        outcome: 'accepted',
        state: UNASKED,
        blockedBy: gate,
        hasTty: true,
      }),
    ).toBe(false);
  });

  it('never asks without a tty', () => {
    expect(
      shouldAskTelemetryConsent({
        outcome: 'accepted',
        state: UNASKED,
        blockedBy: null,
        hasTty: false,
      }),
    ).toBe(false);
  });
});

class FakeTtyInput extends EventEmitter {
  isTTY = true;
  rawMode = false;
  paused = true;
  setRawMode = vi.fn((mode: boolean) => {
    this.rawMode = mode;
    return this;
  });
  resume = vi.fn(() => {
    this.paused = false;
    return this;
  });
  pause = vi.fn(() => {
    this.paused = true;
    return this;
  });
}

function fakeIo(columns?: number) {
  const input = new FakeTtyInput();
  const writes: string[] = [];
  const output = {
    columns,
    write: vi.fn((text: string) => {
      writes.push(text);
      return true;
    }),
  };
  return { input, output, writes };
}

function expectRestored(io: ReturnType<typeof fakeIo>): void {
  expect(io.input.rawMode).toBe(false);
  expect(io.input.setRawMode).toHaveBeenLastCalledWith(false);
  expect(io.input.paused).toBe(true);
  expect(io.input.listenerCount('data')).toBe(0);
  expect(io.writes).toContain(ERASE_LINE);
}

describe('askTelemetryConsent', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes the prompt once, in raw mode', async () => {
    const io = fakeIo();
    const answer = askTelemetryConsent(io);
    expect(io.writes.filter((text) => text === CONSENT_PROMPT)).toHaveLength(1);
    expect(io.input.rawMode).toBe(true);
    expect(io.input.paused).toBe(false);
    io.input.emit('data', Buffer.from('n'));
    await answer;
  });

  it.each(['y', 'Y'])('a chunk %s means yes', async (key) => {
    const io = fakeIo();
    const answer = askTelemetryConsent(io);
    io.input.emit('data', Buffer.from(key));
    expect(await answer).toBe(true);
    expectRestored(io);
  });

  it.each([
    ['n', 'n'],
    ['Enter', '\r'],
    ['Esc', '\x1b'],
    ['Ctrl-C', '\x03'],
    ['any other key', 'q'],
  ])('%s means no', async (_name, key) => {
    const io = fakeIo();
    const answer = askTelemetryConsent(io);
    io.input.emit('data', Buffer.from(key));
    expect(await answer).toBe(false);
    expectRestored(io);
  });

  it('reads only the first character of a multi-byte chunk', async () => {
    const yes = fakeIo();
    const first = askTelemetryConsent(yes);
    yes.input.emit('data', Buffer.from('yes-but-later'));
    expect(await first).toBe(true);

    const no = fakeIo();
    const second = askTelemetryConsent(no);
    no.input.emit('data', 'ny');
    expect(await second).toBe(false);
  });

  it('settles once: a second chunk is ignored and not consumed', async () => {
    const io = fakeIo();
    const answer = askTelemetryConsent(io);
    io.input.emit('data', Buffer.from('n'));
    io.input.emit('data', Buffer.from('y'));
    expect(await answer).toBe(false);
    expect(io.writes.filter((text) => text === CONSENT_PROMPT)).toHaveLength(1);
  });

  it('30 s of silence means no', async () => {
    vi.useFakeTimers();
    const io = fakeIo();
    const answer = askTelemetryConsent(io);
    expect(CONSENT_TIMEOUT_MS).toBe(30_000);
    await vi.advanceTimersByTimeAsync(CONSENT_TIMEOUT_MS - 1);
    let settled = false;
    void answer.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await answer).toBe(false);
    expectRestored(io);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the timer after an answer', async () => {
    vi.useFakeTimers();
    const io = fakeIo();
    const answer = askTelemetryConsent(io);
    io.input.emit('data', Buffer.from('y'));
    expect(await answer).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('erases every row of a prompt that wrapped on a narrow terminal', async () => {
    const io = fakeIo(40);
    const answer = askTelemetryConsent(io);
    io.input.emit('data', Buffer.from('n'));
    await answer;
    const rows = Math.ceil(CONSENT_PROMPT.length / 40);
    const erase = io.writes.slice(1).join('');
    expect(erase).toBe(`${ERASE_LINE}${'\x1b[1A\x1b[2K'.repeat(rows - 1)}`);
  });

  it('a terminal that refuses raw mode is a silent no', async () => {
    const io = fakeIo();
    io.input.setRawMode.mockImplementationOnce(() => {
      throw new Error('EIO');
    });
    expect(await askTelemetryConsent(io)).toBe(false);
    expect(io.writes).not.toContain(CONSENT_PROMPT);
    expect(io.input.listenerCount('data')).toBe(0);
  });
});
