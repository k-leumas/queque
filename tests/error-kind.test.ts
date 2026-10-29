import * as fs from 'node:fs';
import * as net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextEnvelope } from '../src/contracts/request.js';

const { daemonFetchMock, sdkFetchMock, cliFetchMock, appendDebugLogMock } = vi.hoisted(() => ({
  daemonFetchMock: vi.fn(),
  sdkFetchMock: vi.fn(),
  cliFetchMock: vi.fn(),
  appendDebugLogMock: vi.fn().mockResolvedValue(undefined),
}));

// The daemon and the in-process fallback resolve the Claude default through the resolver.
vi.mock('../src/providers/resolver.js', () => ({
  resolveClaudeDefaultAdapter: () => ({ fetchCandidates: daemonFetchMock }),
  resolveAdapter: vi.fn(),
}));

// claudeDefaultAdapter's two transports; every other export stays real.
vi.mock('../src/providers/claude.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/providers/claude.js')>();
  return { ...actual, fetchCandidates: sdkFetchMock };
});

vi.mock('../src/providers/claude-cli.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/providers/claude-cli.js')>();
  return { ...actual, fetchClaudeCliCandidates: cliFetchMock };
});

vi.mock('../src/shared/env-file.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/shared/env-file.js')>();
  return { ...actual, readEnvValueFromDotEnvLocal: () => null };
});

vi.mock('../src/shared/debug-log.js', () => ({
  appendDebugLog: appendDebugLogMock,
}));

import { TRUNCATED_RESPONSE_MESSAGE } from '../src/providers/claude.js';
import { claudeDefaultAdapter, lookupApiKey } from '../src/providers/claude-default.js';
import { errorKindOf, withErrorKind } from '../src/providers/error-kind.js';
import {
  abortError,
  isAbortError,
  UNPARSEABLE_RESPONSE_MESSAGE,
} from '../src/providers/provider.js';

function buildEnvelope(): ContextEnvelope {
  return {
    base: {
      queryText: 'status',
      cwd: '/repo',
      ttyPath: '/dev/tty',
      shellPid: 1234,
      shellName: 'zsh',
      platform: 'darwin',
      timestamp: '2026-05-02T00:00:00.000Z',
    },
    extras: [],
  };
}

function cliError(fields: Record<string, unknown>, message = 'Command failed: claude -p'): Error {
  return Object.assign(new Error(message), fields);
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected a rejection');
    },
    (error: unknown) => error,
  );
}

describe('errorKindOf / withErrorKind', () => {
  it('reads the kind withErrorKind set, on the same object', () => {
    const error = new Error('x');
    expect(withErrorKind(error, 'provider_timeout')).toBe(error);
    expect(errorKindOf(error)).toBe('provider_timeout');
  });

  it('classifies the truncated and unparseable constants', () => {
    expect(errorKindOf(new Error(TRUNCATED_RESPONSE_MESSAGE))).toBe('response_truncated');
    expect(errorKindOf(new Error(UNPARSEABLE_RESPONSE_MESSAGE))).toBe('parse_failed');
  });

  it('is unknown for anything else, a non-Error and a bogus tag', () => {
    expect(errorKindOf(new Error('something else'))).toBe('unknown');
    expect(errorKindOf('provider_timeout')).toBe('unknown');
    expect(errorKindOf(null)).toBe('unknown');
    expect(errorKindOf({ errorKind: 'provider_timeout' })).toBe('unknown');
    const bogus = Object.assign(new Error('x'), { errorKind: 'not_a_kind' });
    expect(errorKindOf(bogus)).toBe('unknown');
  });
});

describe('claudeDefaultAdapter error kinds', () => {
  beforeEach(() => {
    sdkFetchMock.mockReset();
    cliFetchMock.mockReset();
    vi.stubEnv('ANTHROPIC_API_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('lookupApiKey ignores an empty key', () => {
    expect(lookupApiKey()).toBeUndefined();
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    expect(lookupApiKey()).toBe('sk-test');
  });

  it.each([
    [
      'ENOENT',
      cliError({ code: 'ENOENT' }, 'spawn claude ENOENT'),
      'provider_missing',
      /No AI provider is ready/,
    ],
    [
      'a timeout',
      cliError({ killed: true, signal: 'SIGTERM' }),
      'provider_timeout',
      /Claude timed out/,
    ],
    [
      'not authenticated',
      cliError({ code: 1, stdout: 'Not logged in · Please run /login' }),
      'auth_missing',
      /Claude is not authenticated/,
    ],
    [
      'another CLI failure',
      cliError({ code: 1, stdout: 'overloaded' }),
      'provider_failed',
      /claude -p failed/,
    ],
    [
      'a truncated answer',
      new Error(TRUNCATED_RESPONSE_MESSAGE),
      'response_truncated',
      /truncated/,
    ],
  ])('CLI path: %s', async (_label, thrown, kind, copy) => {
    cliFetchMock.mockRejectedValue(thrown);
    const error = await rejection(claudeDefaultAdapter.fetchCandidates(buildEnvelope()));
    expect(errorKindOf(error)).toBe(kind);
    expect((error as Error).message).toMatch(copy);
  });

  it('CLI path: an abort stays untagged', async () => {
    cliFetchMock.mockRejectedValue(abortError());
    const error = await rejection(claudeDefaultAdapter.fetchCandidates(buildEnvelope()));
    expect(isAbortError(error)).toBe(true);
    expect('errorKind' in (error as object)).toBe(false);
  });

  it.each([
    [401, 'key_rejected', /rejected ANTHROPIC_API_KEY \(HTTP 401\)/],
    [403, 'key_refused', /refused the request for ANTHROPIC_API_KEY \(HTTP 403\)/],
  ])('SDK path: HTTP %s → %s', async (status, kind, copy) => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    sdkFetchMock.mockRejectedValue(Object.assign(new Error('raw sdk text'), { status }));
    const error = await rejection(claudeDefaultAdapter.fetchCandidates(buildEnvelope()));
    expect(errorKindOf(error)).toBe(kind);
    expect((error as Error).message).toMatch(copy);
  });

  it('SDK path: an abort stays untagged and unmapped', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const aborted = abortError();
    sdkFetchMock.mockRejectedValue(aborted);
    const error = await rejection(claudeDefaultAdapter.fetchCandidates(buildEnvelope()));
    expect(error).toBe(aborted);
    expect('errorKind' in (error as object)).toBe(false);
  });
});

type RawMessage = { kind: string; [key: string]: unknown };

function rawFetch(socketPath: string): Promise<RawMessage> {
  return new Promise((resolve, reject) => {
    let buf = '';
    const client = net.createConnection(socketPath, () => {
      client.write(`${JSON.stringify({ kind: 'fetch-candidates', envelope: buildEnvelope() })}\n`);
    });
    client.setEncoding('utf8');
    client.on('data', (chunk) => {
      buf += String(chunk);
      let nl = buf.indexOf('\n');
      while (nl !== -1) {
        const message = JSON.parse(buf.slice(0, nl)) as RawMessage;
        buf = buf.slice(nl + 1);
        nl = buf.indexOf('\n');
        if (message.kind === 'fetch-error' || message.kind === 'candidates') {
          client.destroy();
          resolve(message);
          return;
        }
      }
    });
    client.on('error', reject);
  });
}

describe('fetch-error errorKind over IPC', () => {
  let socketPath: string;
  let server: net.Server | null = null;
  let pinDir: string;
  let pinFile: string;

  beforeEach(() => {
    socketPath = `/tmp/qq-errkind-${process.pid}-${Math.random().toString(36).slice(2)}.sock`;
    daemonFetchMock.mockReset();
    pinDir = fs.mkdtempSync(join(tmpdir(), 'qq-errkind-'));
    pinFile = join(pinDir, 'provider.json');
    vi.stubEnv('QQ_PROVIDER_FILE', pinFile);
    vi.stubEnv('QQ_CONFIG_FILE', join(pinDir, 'config.json'));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (server) {
      server.close();
      server.unref();
      server = null;
    }
    fs.rmSync(socketPath, { force: true });
    fs.rmSync(pinDir, { recursive: true, force: true });
  });

  it('the daemon replies with the adapter error kind', async () => {
    daemonFetchMock.mockRejectedValue(
      withErrorKind(new Error('QueQue: Claude timed out.'), 'provider_timeout'),
    );
    const { startDaemonServer } = await import('../src/daemon/server.js');
    server = await startDaemonServer(socketPath);

    expect(await rawFetch(socketPath)).toEqual({
      kind: 'fetch-error',
      message: 'QueQue: Claude timed out.',
      errorKind: 'provider_timeout',
    });
  });

  it('an untagged adapter error is unknown', async () => {
    daemonFetchMock.mockRejectedValue(new Error('boom'));
    const { startDaemonServer } = await import('../src/daemon/server.js');
    server = await startDaemonServer(socketPath);

    expect((await rawFetch(socketPath)).errorKind).toBe('unknown');
  });

  it('an invalid provider pin is pin_invalid', async () => {
    fs.writeFileSync(pinFile, '{}');
    const { startDaemonServer } = await import('../src/daemon/server.js');
    server = await startDaemonServer(socketPath);

    const reply = await rawFetch(socketPath);
    expect(reply.kind).toBe('fetch-error');
    expect(reply.errorKind).toBe('pin_invalid');
    expect(daemonFetchMock).not.toHaveBeenCalled();
  });

  it('requestDaemonFetch rejects with the received kind', async () => {
    daemonFetchMock.mockRejectedValue(withErrorKind(new Error('copy'), 'key_rejected'));
    const { startDaemonServer } = await import('../src/daemon/server.js');
    const { requestDaemonFetch } = await import('../src/daemon/fetch-client.js');
    server = await startDaemonServer(socketPath);

    const error = await rejection(requestDaemonFetch(socketPath, buildEnvelope()));
    expect((error as Error).message).toBe('copy');
    expect(errorKindOf(error)).toBe('key_rejected');
  });

  it('a fetch-error without errorKind (old daemon) gives unknown', async () => {
    const { requestDaemonFetch } = await import('../src/daemon/fetch-client.js');
    server = await new Promise<net.Server>((resolve) => {
      const old = net.createServer((socket) => {
        socket.once('data', () => {
          socket.write(`${JSON.stringify({ kind: 'fetch-accepted' })}\n`);
          socket.write(`${JSON.stringify({ kind: 'fetch-error', message: 'old copy' })}\n`);
        });
      });
      old.listen(socketPath, () => resolve(old));
    });

    const error = await rejection(requestDaemonFetch(socketPath, buildEnvelope()));
    expect((error as Error).message).toBe('old copy');
    expect(errorKindOf(error)).toBe('unknown');
  });

  it('the in-process fallback yields the same tagged errors', async () => {
    const { fetchCandidatesForUi } = await import('../src/daemon/fetch-client.js');
    const missing = `/tmp/qq-errkind-missing-${process.pid}.sock`;

    daemonFetchMock.mockRejectedValue(withErrorKind(new Error('copy'), 'provider_timeout'));
    expect(errorKindOf(await rejection(fetchCandidatesForUi(missing, buildEnvelope())))).toBe(
      'provider_timeout',
    );

    fs.writeFileSync(pinFile, '{}');
    expect(errorKindOf(await rejection(fetchCandidatesForUi(missing, buildEnvelope())))).toBe(
      'pin_invalid',
    );
  });
});
