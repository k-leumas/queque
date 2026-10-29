import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { appendDebugLogMock } = vi.hoisted(() => ({
  appendDebugLogMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/shared/debug-log.js', () => ({
  appendDebugLog: appendDebugLogMock,
}));

import {
  buildEnvironmentEvent,
  buildErrorEvent,
  buildQueryOutcomeEvent,
  reportClientTelemetry,
  sendTelemetryEvents,
  TELEMETRY_CLIENT_SEND_MS,
} from '../src/client/telemetry-events.js';
import type { CommandCandidate } from '../src/contracts/candidates.js';
import {
  type ClientTelemetryEvent,
  clientTelemetryEventSchema,
} from '../src/contracts/telemetry.js';
import { startDaemonServer } from '../src/daemon/server.js';
import { createTelemetryBuffer, type TelemetryBuffer } from '../src/daemon/telemetry-buffer.js';
import { errorKindOf, withErrorKind } from '../src/providers/error-kind.js';
import { resolveProviderKind } from '../src/providers/provider-kind.js';
import { collectEnvironmentShape, type EnvironmentShape } from '../src/shared/environment-shape.js';

const INSTALL_ID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';

const SHAPE: EnvironmentShape = {
  os: 'linux',
  arch: 'x64',
  distro: 'ubuntu',
  zsh: '5.9',
  node_major: 24,
  zellij: false,
};

let tmpDir: string;
let enabledPath: string;
let disabledPath: string;
let missingPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qq-telemetry-events-'));
  enabledPath = path.join(tmpDir, 'enabled.json');
  disabledPath = path.join(tmpDir, 'disabled.json');
  missingPath = path.join(tmpDir, 'missing.json');
  fs.writeFileSync(
    enabledPath,
    JSON.stringify({ telemetry: { enabled: true, asked: true, installId: INSTALL_ID } }),
  );
  fs.writeFileSync(disabledPath, JSON.stringify({ telemetry: { enabled: false, asked: true } }));
  // Guard: a default path must never resolve to the developer's real config.
  vi.stubEnv('QQ_CONFIG_FILE', missingPath);
  vi.stubEnv('QQ_PROVIDER_FILE', path.join(tmpDir, 'provider.json'));
  appendDebugLogMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('resolveProviderKind', () => {
  const pinned = (provider: 'claude' | 'openai' | 'ollama') => () =>
    provider === 'ollama'
      ? ({ kind: 'pinned', pin: { version: 1, provider, model: 'llama3' } } as const)
      : ({ kind: 'pinned', pin: { version: 1, provider } } as const);

  it('maps an openai pin to openai and an ollama pin to ollama', () => {
    expect(resolveProviderKind({ loadPin: pinned('openai'), hasApiKey: () => true })).toBe(
      'openai',
    );
    expect(resolveProviderKind({ loadPin: pinned('ollama'), hasApiKey: () => true })).toBe(
      'ollama',
    );
  });

  it('maps a claude pin or no pin with a key to claude-sdk', () => {
    expect(resolveProviderKind({ loadPin: pinned('claude'), hasApiKey: () => true })).toBe(
      'claude-sdk',
    );
    expect(
      resolveProviderKind({ loadPin: () => ({ kind: 'absent' }), hasApiKey: () => true }),
    ).toBe('claude-sdk');
  });

  it('maps a claude pin or no pin without a key to claude-cli', () => {
    expect(resolveProviderKind({ loadPin: pinned('claude'), hasApiKey: () => false })).toBe(
      'claude-cli',
    );
    expect(
      resolveProviderKind({ loadPin: () => ({ kind: 'absent' }), hasApiKey: () => false }),
    ).toBe('claude-cli');
  });

  it('maps an invalid pin to unknown', () => {
    expect(
      resolveProviderKind({
        loadPin: () => ({ kind: 'invalid', path: '/x/provider.json', message: 'not valid JSON' }),
        hasApiKey: () => true,
      }),
    ).toBe('unknown');
  });

  it('maps a throwing pin loader to unknown', () => {
    expect(
      resolveProviderKind({
        loadPin: () => {
          throw new Error('EACCES /home/alice/.config/qq/provider.json');
        },
      }),
    ).toBe('unknown');
  });
});

describe('event builders', () => {
  it('builds an accepted outcome without error_kind', () => {
    const event = buildQueryOutcomeEvent({ outcome: 'accepted', candidateCount: 2 }, 'claude-cli');
    expect(event).toEqual({
      event: 'qq_query_outcome',
      properties: { outcome: 'accepted', candidate_count: 2, provider: 'claude-cli' },
    });
    expect(clientTelemetryEventSchema.parse(event)).toEqual(event);
  });

  it('clamps the candidate count to 0-5', () => {
    const high = buildQueryOutcomeEvent({ outcome: 'escaped', candidateCount: 9 }, 'openai');
    const low = buildQueryOutcomeEvent({ outcome: 'escaped', candidateCount: -3 }, 'openai');
    const nan = buildQueryOutcomeEvent(
      { outcome: 'escaped', candidateCount: Number.NaN },
      'openai',
    );
    expect(high.properties).toMatchObject({ candidate_count: 5 });
    expect(low.properties).toMatchObject({ candidate_count: 0 });
    expect(nan.properties).toMatchObject({ candidate_count: 0 });
  });

  it('sets error_kind only for an error outcome, defaulting to unknown', () => {
    const withKind = buildQueryOutcomeEvent(
      { outcome: 'error', candidateCount: 0, errorKind: 'provider_timeout' },
      'claude-sdk',
    );
    const withoutKind = buildQueryOutcomeEvent({ outcome: 'error', candidateCount: 0 }, 'ollama');
    const escaped = buildQueryOutcomeEvent(
      { outcome: 'escaped', candidateCount: 1, errorKind: 'provider_failed' },
      'ollama',
    );
    expect(withKind.properties).toMatchObject({ error_kind: 'provider_timeout' });
    expect(withoutKind.properties).toMatchObject({ error_kind: 'unknown' });
    expect(escaped.properties).not.toHaveProperty('error_kind');
    for (const event of [withKind, withoutKind, escaped]) {
      expect(clientTelemetryEventSchema.safeParse(event).success).toBe(true);
    }
  });

  it('builds error and environment events that parse with the client schema', () => {
    const error = buildErrorEvent('socket_failed', 'claude-cli');
    const environment = buildEnvironmentEvent(SHAPE);
    expect(error).toEqual({
      event: 'qq_error',
      properties: { error_kind: 'socket_failed', provider: 'claude-cli' },
    });
    expect(environment).toEqual({ event: 'qq_environment', properties: SHAPE });
    expect(clientTelemetryEventSchema.safeParse(error).success).toBe(true);
    expect(clientTelemetryEventSchema.safeParse(environment).success).toBe(true);
  });
});

describe('reportClientTelemetry gate', () => {
  const record = { outcome: 'accepted' as const, candidateCount: 2 };

  function deps(statePath: string, env: NodeJS.ProcessEnv = {}) {
    const send = vi.fn(async (_socketPath: string, _events: ClientTelemetryEvent[]) => {});
    const provider = vi.fn(() => 'claude-cli' as const);
    const environment = vi.fn(() => SHAPE);
    return { send, provider, environment, input: { env, statePath, send, provider, environment } };
  }

  it('never sends without a config file', async () => {
    const { send, provider, environment, input } = deps(missingPath);
    await reportClientTelemetry({ socketPath: '/tmp/qq-unused.sock', record, ...input });
    expect(send).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
    expect(environment).not.toHaveBeenCalled();
  });

  it('never sends with a disabled state', async () => {
    const { send, input } = deps(disabledPath);
    await reportClientTelemetry({ socketPath: '/tmp/qq-unused.sock', record, ...input });
    expect(send).not.toHaveBeenCalled();
  });

  it('never sends with DO_NOT_TRACK=1 in the client env, even when enabled', async () => {
    const { send, input } = deps(enabledPath, { DO_NOT_TRACK: '1' });
    await reportClientTelemetry({ socketPath: '/tmp/qq-unused.sock', record, ...input });
    expect(send).not.toHaveBeenCalled();
  });

  it('never sends with QQ_TELEMETRY=0 or CI in the client env', async () => {
    for (const env of [{ QQ_TELEMETRY: '0' }, { CI: 'true' }]) {
      const { send, input } = deps(enabledPath, env);
      await reportClientTelemetry({ socketPath: '/tmp/qq-unused.sock', record, ...input });
      expect(send).not.toHaveBeenCalled();
    }
  });

  it('sends once when enabled: environment, error events, then the outcome', async () => {
    const { send, input } = deps(enabledPath);
    await reportClientTelemetry({
      socketPath: '/tmp/qq-test.sock',
      record,
      errors: ['socket_failed', 'provider_failed'],
      ...input,
    });
    expect(send).toHaveBeenCalledTimes(1);
    const [socketPath, events] = send.mock.calls[0] ?? [];
    expect(socketPath).toBe('/tmp/qq-test.sock');
    expect(events?.map((event) => event.event)).toEqual([
      'qq_environment',
      'qq_error',
      'qq_error',
      'qq_query_outcome',
    ]);
    expect(events?.[1]?.properties).toEqual({
      error_kind: 'socket_failed',
      provider: 'claude-cli',
    });
    expect(events?.[3]?.properties).toEqual({
      outcome: 'accepted',
      candidate_count: 2,
      provider: 'claude-cli',
    });
  });

  it('skips the environment event when the shape is null', async () => {
    const { send, input } = deps(enabledPath);
    await reportClientTelemetry({
      socketPath: '/tmp/qq-test.sock',
      record,
      ...input,
      environment: () => null,
    });
    expect(send.mock.calls[0]?.[1].map((event) => event.event)).toEqual(['qq_query_outcome']);
  });

  it('never throws, even when the sender or a collector throws', async () => {
    const { input } = deps(enabledPath);
    await expect(
      reportClientTelemetry({
        socketPath: '/tmp/qq-test.sock',
        record,
        ...input,
        send: async () => {
          throw new Error('boom');
        },
      }),
    ).resolves.toBeUndefined();
    await expect(
      reportClientTelemetry({
        socketPath: '/tmp/qq-test.sock',
        record,
        ...input,
        provider: () => {
          throw new Error('boom');
        },
      }),
    ).resolves.toBeUndefined();
  });

  it('logs counts only', async () => {
    const { input } = deps(enabledPath);
    await reportClientTelemetry({
      socketPath: '/tmp/qq-test.sock',
      record,
      errors: ['socket_failed'],
      ...input,
    });
    const logged = appendDebugLogMock.mock.calls.find((call) => call[1] === 'telemetry reported');
    expect(logged).toBeDefined();
    expect(JSON.stringify(logged?.[2])).not.toMatch(/accepted|socket_failed|claude|ubuntu/);
  });
});

describe('sendTelemetryEvents', () => {
  let socketPath: string;
  let server: net.Server | null = null;
  let buffer: TelemetryBuffer;
  let fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    socketPath = `/tmp/qq-tel-ev-${process.pid}-${Math.random().toString(36).slice(2)}.sock`;
    fetchImpl = vi.fn<typeof fetch>(async () => new Response('{"status":"ok"}'));
    buffer = createTelemetryBuffer({
      fetchImpl,
      readState: () => ({ enabled: true, asked: true, installId: INSTALL_ID }),
      env: () => ({}),
      endpoint: () => ({ host: 'http://127.0.0.1:9', key: 'phc_test' }),
      now: () => Date.parse('2026-10-29T12:00:00.000Z'),
      version: '0.8.0',
    });
  });

  afterEach(() => {
    if (server) {
      server.close();
      server.unref();
      server = null;
    }
    fs.rmSync(socketPath, { force: true });
  });

  it('resolves within 300 ms and never rejects when nothing listens', async () => {
    const started = Date.now();
    await expect(
      sendTelemetryEvents(socketPath, [buildErrorEvent('socket_failed', 'claude-cli')]),
    ).resolves.toBeUndefined();
    expect(Date.now() - started).toBeLessThan(300);
  });

  it('gives up after the timeout when the listener never closes', async () => {
    server = net.createServer({ allowHalfOpen: true }, () => {
      // Accept and hold the connection open: never read to the end, never close.
    });
    await new Promise<void>((resolve) => server?.listen(socketPath, resolve));
    const started = Date.now();
    await sendTelemetryEvents(socketPath, [buildErrorEvent('socket_failed', 'claude-cli')], 100);
    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(90);
    expect(elapsed).toBeLessThan(TELEMETRY_CLIENT_SEND_MS + 250);
  });

  it('delivers every event to a real daemon server and its buffer', async () => {
    server = await startDaemonServer(socketPath, { telemetry: buffer });
    await sendTelemetryEvents(socketPath, [
      buildEnvironmentEvent(SHAPE),
      buildQueryOutcomeEvent({ outcome: 'escaped', candidateCount: 3 }, 'claude-cli'),
    ]);
    await vi.waitFor(() => {
      const pending = buffer.snapshot().pending;
      expect(pending).not.toBeNull();
      expect(JSON.parse(pending as string).batch).toHaveLength(2);
    });
    const batch = JSON.parse(buffer.snapshot().pending as string).batch as Array<{
      event: string;
      properties: Record<string, unknown>;
    }>;
    expect(batch.map((event) => event.event)).toEqual(['qq_environment', 'qq_query_outcome']);
    expect(batch[1]?.properties).toMatchObject({ outcome: 'escaped', candidate_count: 3 });
  });

  // Pitfall 9: realistic secrets, paths, commands and error messages sit in the same process
  // that builds the events. None of them may reach the batch that leaves the machine.
  it('leaks no prompt, path, command or message end to end', async () => {
    server = await startDaemonServer(socketPath, { telemetry: buffer });

    const request = { lbuffer: 'deploy secret-token-xyz to prod', cwd: '/home/alice/proj' };
    const candidates: CommandCandidate[] = [
      { command: 'kubectl apply -f secret.yaml', explanation: 'apply the secret manifest' },
    ];
    const providerError = withErrorKind(new Error('ENOENT /home/alice/proj/x'), 'provider_missing');
    const env: NodeJS.ProcessEnv = {
      QQ_ZSH_VERSION: '5.9',
      PWD: request.cwd,
      HOME: '/home/alice',
      USER: 'alice',
      QQ_LBUFFER: request.lbuffer,
    };

    await reportClientTelemetry({
      socketPath,
      record: { outcome: 'accepted', candidateCount: candidates.length },
      errors: [errorKindOf(providerError)],
      env,
      statePath: enabledPath,
      provider: () =>
        resolveProviderKind({ loadPin: () => ({ kind: 'absent' }), hasApiKey: () => false }),
      environment: () =>
        collectEnvironmentShape({
          env,
          platform: 'linux',
          arch: 'x64',
          nodeVersion: 'v24.14.1',
          readOsRelease: () => `ID=ubuntu\nHOME_URL="file://${request.cwd}"\n`,
        }),
    });

    await vi.waitFor(() => {
      const pending = buffer.snapshot().pending;
      expect(pending).not.toBeNull();
      expect(JSON.parse(pending as string).batch).toHaveLength(3);
    });
    await buffer.flush();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const body = String(fetchImpl.mock.calls[0]?.[1]?.body);
    const sent = JSON.parse(body) as {
      batch: Array<{ event: string; properties: Record<string, unknown> }>;
    };
    expect(sent.batch.map((event) => event.event)).toEqual([
      'qq_environment',
      'qq_error',
      'qq_query_outcome',
    ]);
    expect(sent.batch[1]?.properties).toMatchObject({ error_kind: 'provider_missing' });
    for (const needle of ['secret-token-xyz', '/home/alice', 'kubectl', 'ENOENT', 'alice']) {
      expect(body).not.toContain(needle);
    }
    expect(buffer.snapshot().lastSent).toBe(body);
  });
});
