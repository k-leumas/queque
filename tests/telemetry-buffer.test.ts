import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/shared/debug-log.js', () => ({
  appendDebugLog: vi.fn(async () => undefined),
}));

import { telemetryBatchSchema } from '../src/contracts/telemetry.js';
import {
  createTelemetryBuffer,
  sendBatch,
  TELEMETRY_BUFFER_CAP,
  TELEMETRY_FLUSH_INTERVAL_MS,
  TELEMETRY_FLUSH_THRESHOLD,
  type TelemetryBufferDeps,
} from '../src/daemon/telemetry-buffer.js';
import { appendDebugLog } from '../src/shared/debug-log.js';
import type { TelemetryState } from '../src/shared/telemetry-config.js';
import type { TelemetryEndpoint } from '../src/shared/telemetry-endpoint.js';

const INSTALL_ID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const ENDPOINT: TelemetryEndpoint = { host: 'http://127.0.0.1:9', key: 'phc_test' };
const NOW = Date.parse('2026-10-29T12:00:00.000Z');

const OUTCOME = {
  event: 'qq_query_outcome',
  properties: { outcome: 'accepted', candidate_count: 2, provider: 'claude-cli' },
};
const ERROR_EVENT = {
  event: 'qq_error',
  properties: { error_kind: 'provider_timeout', provider: 'claude-sdk' },
};
const ENVIRONMENT = {
  event: 'qq_environment',
  properties: {
    os: 'linux',
    arch: 'x64',
    distro: 'ubuntu',
    zsh: '5.9',
    node_major: 22,
    zellij: false,
  },
};

const ENABLED: TelemetryState = { enabled: true, asked: true, installId: INSTALL_ID };

function okFetch() {
  return vi.fn<typeof fetch>(async () => new Response('{"status":"ok"}'));
}

function makeBuffer(overrides: TelemetryBufferDeps = {}) {
  const fetchImpl = okFetch();
  let state: TelemetryState = ENABLED;
  const buffer = createTelemetryBuffer({
    fetchImpl,
    readState: () => state,
    env: () => ({}),
    endpoint: () => ENDPOINT,
    now: () => NOW,
    version: '0.8.0',
    ...overrides,
  });
  return {
    buffer,
    fetchImpl: (overrides.fetchImpl ?? fetchImpl) as ReturnType<typeof okFetch>,
    setState: (next: TelemetryState) => {
      state = next;
    },
  };
}

function sentBody(fetchImpl: ReturnType<typeof okFetch>, call = 0): string {
  const init = fetchImpl.mock.calls[call]?.[1];
  return String(init?.body);
}

beforeEach(() => {
  vi.mocked(appendDebugLog).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('sendBatch', () => {
  it('POSTs JSON to host + /batch/ with a timeout signal', async () => {
    const fetchImpl = okFetch();
    await sendBatch('https://example.test/ingest', '{"a":1}', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('https://example.test/ingest/batch/');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"a":1}');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('swallows a rejecting fetch (D-07: drop, never throw)', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(sendBatch('http://127.0.0.1:9', '{}', fetchImpl)).resolves.toBeUndefined();
  });
});

describe('createTelemetryBuffer', () => {
  it('pending is byte for byte the body the next flush sends', async () => {
    const { buffer, fetchImpl } = makeBuffer();
    expect(buffer.enqueue(OUTCOME)).toBe(true);

    const pending = buffer.snapshot().pending;
    expect(pending).not.toBeNull();
    expect(telemetryBatchSchema.safeParse(JSON.parse(pending as string)).success).toBe(true);

    await buffer.flush();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('http://127.0.0.1:9/batch/');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(sentBody(fetchImpl)).toBe(pending);
    expect(buffer.snapshot()).toEqual({ pending: null, lastSent: pending });
  });

  it('adds only the five fixed properties and an ISO timestamp', async () => {
    const { buffer, fetchImpl } = makeBuffer();
    buffer.enqueue(OUTCOME);
    await buffer.flush();
    const body = JSON.parse(sentBody(fetchImpl));
    expect(body.api_key).toBe('phc_test');
    expect(body.batch).toEqual([
      {
        event: 'qq_query_outcome',
        timestamp: '2026-10-29T12:00:00.000Z',
        properties: {
          distinct_id: INSTALL_ID,
          $process_person_profile: false,
          $geoip_disable: true,
          $lib: 'queque',
          $lib_version: '0.8.0',
          outcome: 'accepted',
          candidate_count: 2,
          provider: 'claude-cli',
        },
      },
    ]);
  });

  it.each([
    ['CI=1 in the env', { env: () => ({ CI: '1' }) }, ENABLED],
    ['DO_NOT_TRACK=1 in the env', { env: () => ({ DO_NOT_TRACK: '1' }) }, ENABLED],
    ['a disabled state', {}, { enabled: false, asked: true } as TelemetryState],
    ['a missing installId', {}, { enabled: true, asked: true } as TelemetryState],
    ['a null endpoint (empty key, D-22)', { endpoint: () => null }, ENABLED],
  ])('buffers nothing and never fetches with %s', async (_label, overrides, state) => {
    const { buffer, fetchImpl } = makeBuffer({ readState: () => state, ...overrides });
    expect(buffer.enqueue(OUTCOME)).toBe(false);
    expect(buffer.snapshot().pending).toBeNull();
    await buffer.flush();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects an event with an extra property', () => {
    const { buffer } = makeBuffer();
    expect(buffer.enqueue({ ...OUTCOME, cwd: '/home/me' })).toBe(false);
    expect(
      buffer.enqueue({ ...OUTCOME, properties: { ...OUTCOME.properties, cwd: '/home/me' } }),
    ).toBe(false);
    expect(buffer.enqueue({ event: 'qq_other', properties: {} })).toBe(false);
    expect(buffer.enqueue('not an event')).toBe(false);
    expect(buffer.snapshot().pending).toBeNull();
  });

  it('buffers the same environment once and a changed one again', () => {
    const { buffer } = makeBuffer();
    expect(buffer.enqueue(ENVIRONMENT)).toBe(true);
    expect(buffer.enqueue(structuredClone(ENVIRONMENT))).toBe(false);
    const changed = { ...ENVIRONMENT, properties: { ...ENVIRONMENT.properties, zellij: true } };
    expect(buffer.enqueue(changed)).toBe(true);
    const batch = JSON.parse(buffer.snapshot().pending as string).batch;
    expect(batch).toHaveLength(2);
  });

  it('flushes once at the threshold with that many events', async () => {
    const { buffer, fetchImpl } = makeBuffer();
    for (let i = 1; i < TELEMETRY_FLUSH_THRESHOLD; i += 1) {
      buffer.enqueue(ERROR_EVENT);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
    buffer.enqueue(ERROR_EVENT);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    expect(JSON.parse(sentBody(fetchImpl)).batch).toHaveLength(TELEMETRY_FLUSH_THRESHOLD);
  });

  it('caps the buffer at 100 and rejects the newest event when full', async () => {
    let release: (() => void) | undefined;
    const fetchImpl = vi.fn<typeof fetch>(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(new Response('{}'));
        }),
    );
    const { buffer } = makeBuffer({ fetchImpl });
    for (let i = 0; i < TELEMETRY_FLUSH_THRESHOLD; i += 1) {
      buffer.enqueue(ERROR_EVENT);
    }
    // One send in flight: later events wait in the buffer, never a second concurrent POST.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    for (let i = 0; i < TELEMETRY_BUFFER_CAP; i += 1) {
      expect(buffer.enqueue(ERROR_EVENT)).toBe(true);
    }
    expect(buffer.enqueue(ERROR_EVENT)).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.parse(buffer.snapshot().pending as string).batch).toHaveLength(
      TELEMETRY_BUFFER_CAP,
    );

    release?.();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    expect(JSON.parse(sentBody(fetchImpl, 1)).batch).toHaveLength(TELEMETRY_BUFFER_CAP);
    release?.();
  });

  it('start() flushes every 60 s on an unref’d interval; stop() clears it', async () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const { buffer, fetchImpl } = makeBuffer();
    buffer.start();
    buffer.enqueue(OUTCOME);

    await vi.advanceTimersByTimeAsync(TELEMETRY_FLUSH_INTERVAL_MS - 1);
    expect(fetchImpl).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const timer = setIntervalSpy.mock.results[0]?.value as NodeJS.Timeout;
    expect(timer.hasRef()).toBe(false);

    buffer.stop();
    buffer.enqueue(OUTCOME);
    await vi.advanceTimersByTimeAsync(TELEMETRY_FLUSH_INTERVAL_MS * 2);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('drops a batch whose send fails and never retries it', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed');
    });
    const { buffer } = makeBuffer({ fetchImpl });
    buffer.enqueue(OUTCOME);
    const attempted = buffer.snapshot().pending;

    await expect(buffer.flush()).resolves.toBeUndefined();
    expect(buffer.snapshot()).toEqual({ pending: null, lastSent: attempted });

    await buffer.flush();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('drops the buffer without fetching when the state turns off before the flush', async () => {
    const { buffer, fetchImpl, setState } = makeBuffer();
    buffer.enqueue(OUTCOME);
    setState({ enabled: false, asked: true });
    expect(buffer.snapshot().pending).toBeNull();
    await buffer.flush();
    expect(fetchImpl).not.toHaveBeenCalled();

    // Turning telemetry back on does not resurrect what was dropped.
    setState(ENABLED);
    expect(buffer.snapshot()).toEqual({ pending: null, lastSent: null });
  });

  it('never sends events recorded under a previous install id', async () => {
    const { buffer, fetchImpl, setState } = makeBuffer();
    buffer.enqueue(OUTCOME);
    setState({ enabled: true, asked: true, installId: '0a1b2c3d-4e5f-4a6b-9c7d-8e9f0a1b2c3d' });
    await buffer.flush();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reset() clears pending and lastSent', async () => {
    const { buffer } = makeBuffer();
    buffer.enqueue(OUTCOME);
    await buffer.flush();
    buffer.enqueue(ERROR_EVENT);
    expect(buffer.snapshot().pending).not.toBeNull();
    expect(buffer.snapshot().lastSent).not.toBeNull();
    buffer.reset();
    expect(buffer.snapshot()).toEqual({ pending: null, lastSent: null });
  });

  it('logs counts and reasons only: never the install id, the key or a payload value', async () => {
    const { buffer } = makeBuffer();
    buffer.enqueue(OUTCOME);
    buffer.enqueue(ENVIRONMENT);
    buffer.enqueue(ENVIRONMENT);
    buffer.enqueue({ ...OUTCOME, cwd: '/home/secret-user' });
    await buffer.flush();
    const { buffer: blocked } = makeBuffer({ env: () => ({ CI: '1' }) });
    blocked.enqueue(OUTCOME);

    const calls = vi.mocked(appendDebugLog).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const logged = JSON.stringify(calls);
    for (const secret of [INSTALL_ID, 'phc_test', 'claude-cli', 'ubuntu', 'secret-user']) {
      expect(logged).not.toContain(secret);
    }
    expect(calls.some(([, message]) => message === 'telemetry flushed')).toBe(true);
    expect(calls.some(([, message]) => message === 'telemetry buffered')).toBe(true);
    expect(calls.some(([, message]) => message === 'telemetry dropped')).toBe(true);
  });
});
